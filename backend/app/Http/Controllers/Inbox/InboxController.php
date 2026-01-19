<?php

namespace App\Http\Controllers\Inbox;

use App\Http\Controllers\Controller;
use App\Models\Conversation;
use App\Models\LinkedInMessage;
use App\Models\Prospect;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InboxController extends Controller
{
    /**
     * Normalize LinkedIn conversation ID to consistent format.
     * Handles various URN formats and extracts the base ID.
     *
     * @param string $conversationId
     * @return string
     */
    private function normalizeConversationId(string $conversationId): string
    {
        // Already normalized (just the ID like "2-xxx")
        if (preg_match('/^[\d]+-[a-zA-Z0-9_-]+$/', $conversationId)) {
            return $conversationId;
        }

        // Format: urn:li:fs_conversation:2-xxx
        if (preg_match('/fs_conversation:([^,)\s]+)/', $conversationId, $matches)) {
            return $matches[1];
        }

        // Format: urn:li:messagingThread:2-xxx
        if (preg_match('/messagingThread:([^,)\s]+)/', $conversationId, $matches)) {
            return $matches[1];
        }

        // Format: urn:li:msg_conversation:(xxx,2-xxx)
        if (preg_match('/,([^)]+)\)/', $conversationId, $matches)) {
            return $matches[1];
        }

        // Return as-is if no pattern matches
        return $conversationId;
    }

    /**
     * Check if two names match (for is_from_me detection).
     * Handles slight variations like extra spaces, different casing, etc.
     *
     * @param string $name1
     * @param string $name2
     * @return bool
     */
    private function namesMatch(string $name1, string $name2): bool
    {
        // Exact match after normalization
        if ($name1 === $name2) {
            return true;
        }

        // Check if one name contains the other (handles "John" vs "John Smith")
        if (str_contains($name1, $name2) || str_contains($name2, $name1)) {
            return true;
        }

        // Use similar_text for fuzzy matching (handles typos, slight variations)
        $similarity = 0;
        similar_text($name1, $name2, $similarity);

        // If 80% similar, consider it a match
        return $similarity >= 80;
    }

    /**
     * Get all conversations for the user.
     *
     * GET /api/inbox
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $conversations = Conversation::where('user_id', $user->id)
            ->with(['prospect:id,full_name,linkedin_id,avatar_url'])
            ->latestFirst()
            ->paginate($request->input('per_page', 20));

        return response()->json($conversations);
    }

    /**
     * Get a single conversation with its messages.
     *
     * GET /api/inbox/{id}
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        $conversation = Conversation::where('id', $id)
            ->where('user_id', $user->id)
            ->with(['messages', 'prospect'])
            ->first();

        if (!$conversation) {
            return response()->json([
                'message' => 'Conversation not found.',
            ], 404);
        }

        // Mark as read when viewing
        $conversation->markAsRead();

        return response()->json([
            'conversation' => $conversation,
        ]);
    }

    /**
     * Get inbox stats (unread count, total conversations).
     *
     * GET /api/inbox/stats
     */
    public function stats(Request $request): JsonResponse
    {
        $user = $request->user();

        // OPTIMIZATION: Use conditional aggregation to reduce 4 queries to 2
        $conversationStats = Conversation::where('user_id', $user->id)
            ->selectRaw('COUNT(*) as total')
            ->selectRaw('SUM(CASE WHEN is_unread = true THEN 1 ELSE 0 END) as unread')
            ->first();

        $messageStats = LinkedInMessage::where('user_id', $user->id)
            ->selectRaw('SUM(CASE WHEN is_read = false AND is_from_me = false THEN 1 ELSE 0 END) as total_unread')
            ->selectRaw("SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending")
            ->first();

        $stats = [
            'total_conversations' => (int) ($conversationStats->total ?? 0),
            'unread_conversations' => (int) ($conversationStats->unread ?? 0),
            'total_unread_messages' => (int) ($messageStats->total_unread ?? 0),
            'pending_messages' => (int) ($messageStats->pending ?? 0),
        ];

        return response()->json($stats);
    }

    /**
     * Sync conversations from extension.
     * Extension sends extracted conversation list.
     *
     * POST /api/inbox/sync
     */
    public function sync(Request $request): JsonResponse
    {
        $request->validate([
            'conversations' => 'present|array',  // Allow empty array
            'conversations.*.linkedin_conversation_id' => 'required|string',
            'conversations.*.participant_name' => 'required|string',
            'conversations.*.participant_linkedin_id' => 'nullable|string',
            'conversations.*.participant_profile_url' => 'nullable|string',
            'conversations.*.participant_avatar_url' => 'nullable|string',
            'conversations.*.participant_headline' => 'nullable|string',
            'conversations.*.last_message_preview' => 'nullable|string',
            'conversations.*.last_message_at' => 'nullable|string',
            'conversations.*.is_unread' => 'nullable|boolean',
            'conversations.*.unread_count' => 'nullable|integer',
            'conversations.*.messages' => 'nullable|array',
        ]);

        $user = $request->user();
        $conversationsData = $request->input('conversations');

        DB::beginTransaction();

        try {
            $synced = 0;
            $created = 0;

            // OPTIMIZATION: Bulk fetch existing conversations and prospects to avoid N+1 queries
            // Normalize all conversation IDs first to prevent duplicates
            $normalizedConvData = [];
            foreach ($conversationsData as $convData) {
                $normalizedId = $this->normalizeConversationId($convData['linkedin_conversation_id'] ?? '');
                if (empty($normalizedId)) continue;
                $convData['linkedin_conversation_id'] = $normalizedId;
                $normalizedConvData[] = $convData;
            }
            $conversationsData = $normalizedConvData;

            $linkedinConvIds = collect($conversationsData)->pluck('linkedin_conversation_id')->filter()->unique()->toArray();
            $linkedinProspectIds = collect($conversationsData)->pluck('participant_linkedin_id')->filter()->unique()->toArray();

            // Fetch all existing conversations in one query (keyed by linkedin_conversation_id)
            $existingConversations = Conversation::where('user_id', $user->id)
                ->whereIn('linkedin_conversation_id', $linkedinConvIds)
                ->get()
                ->keyBy('linkedin_conversation_id');

            // Fetch all matching prospects in one query (keyed by linkedin_id)
            $existingProspects = !empty($linkedinProspectIds)
                ? Prospect::where('user_id', $user->id)
                    ->whereIn('linkedin_id', $linkedinProspectIds)
                    ->get()
                    ->keyBy('linkedin_id')
                : collect();

            foreach ($conversationsData as $convData) {
                // Use pre-fetched conversation instead of querying
                $conversation = $existingConversations->get($convData['linkedin_conversation_id']);

                // Fallback: If not found in pre-fetched (possible if DB has non-normalized IDs), query directly
                if (!$conversation) {
                    $conversation = Conversation::where('user_id', $user->id)
                        ->where('linkedin_conversation_id', $convData['linkedin_conversation_id'])
                        ->first();
                }

                // Use pre-fetched prospect instead of querying
                $prospectId = null;
                if (!empty($convData['participant_linkedin_id'])) {
                    $prospect = $existingProspects->get($convData['participant_linkedin_id']);
                    $prospectId = $prospect?->id;
                }

                // Base fields that are always safe to update
                $conversationFields = [
                    'user_id' => $user->id,
                    'prospect_id' => $prospectId,
                    'linkedin_conversation_id' => $convData['linkedin_conversation_id'],
                    'participant_name' => $convData['participant_name'],
                    'participant_linkedin_id' => $convData['participant_linkedin_id'] ?? null,
                    'participant_profile_url' => $convData['participant_profile_url'] ?? null,
                    'participant_avatar_url' => $convData['participant_avatar_url'] ?? null,
                    'participant_headline' => $convData['participant_headline'] ?? null,
                    'last_message_preview' => $convData['last_message_preview'] ?? null,
                    'last_message_at' => $convData['last_message_at'] ?? now(),
                    'last_synced_at' => now(),
                ];

                if ($conversation) {
                    // IMPORTANT: Do NOT overwrite is_unread/unread_count for existing conversations!
                    // The user may have read messages in the webapp but not on LinkedIn.
                    // Unread status is only set by incoming-message endpoint for NEW messages.
                    $conversation->update($conversationFields);
                    $synced++;
                } else {
                    // For NEW conversations, use LinkedIn's unread status as initial value
                    // Handle race condition: another request might create this conversation simultaneously
                    try {
                        $conversationFields['is_unread'] = $convData['is_unread'] ?? false;
                        $conversationFields['unread_count'] = $convData['unread_count'] ?? 0;
                        $conversation = Conversation::create($conversationFields);
                        $created++;
                    } catch (\Illuminate\Database\QueryException $e) {
                        // Unique constraint violation (PostgreSQL code 23505) - conversation was created by another request
                        if ($e->getCode() === '23505') {
                            // Fetch the existing conversation and update it instead
                            $conversation = Conversation::where('user_id', $user->id)
                                ->where('linkedin_conversation_id', $convData['linkedin_conversation_id'])
                                ->first();
                            if ($conversation) {
                                $conversation->update($conversationFields);
                                $synced++;
                            }
                        } else {
                            throw $e; // Re-throw other database errors
                        }
                    }
                }

                // Sync messages if provided
                if (!empty($convData['messages'])) {
                    $this->syncMessagesInternal($conversation, $convData['messages'], $user->id);
                }
            }

            DB::commit();

            return response()->json([
                'message' => "Synced {$synced} conversations, created {$created} new.",
                'synced' => $synced,
                'created' => $created,
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Failed to sync conversations: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Sync messages for a conversation.
     *
     * POST /api/inbox/{id}/sync-messages
     */
    public function syncMessages(Request $request, int $conversationId): JsonResponse
    {
        $request->validate([
            'messages' => 'required|array',
            'messages.*.linkedin_message_id' => 'nullable|string',
            'messages.*.content' => 'required|string',
            'messages.*.is_from_me' => 'required|boolean',
            'messages.*.sender_name' => 'nullable|string',
            'messages.*.sender_linkedin_id' => 'nullable|string',
            'messages.*.sent_at' => 'nullable|string',
        ]);

        $user = $request->user();

        $conversation = Conversation::where('id', $conversationId)
            ->where('user_id', $user->id)
            ->first();

        if (!$conversation) {
            return response()->json([
                'message' => 'Conversation not found.',
            ], 404);
        }

        $messagesData = $request->input('messages');
        $result = $this->syncMessagesInternal($conversation, $messagesData, $user->id);

        // Update conversation's last message info
        $lastMessage = $conversation->messages()->latest('sent_at')->first();
        if ($lastMessage) {
            $conversation->update([
                'last_message_preview' => substr($lastMessage->content, 0, 100),
                'last_message_at' => $lastMessage->sent_at,
                'last_synced_at' => now(),
            ]);
        }

        return response()->json([
            'message' => "Synced {$result['synced']} messages, created {$result['created']} new.",
            'synced' => $result['synced'],
            'created' => $result['created'],
        ]);
    }

    /**
     * Send a message (queue for extension to send).
     * Supports scheduling by passing scheduled_at parameter.
     *
     * POST /api/inbox/{id}/send
     */
    public function sendMessage(Request $request, int $conversationId): JsonResponse
    {
        $request->validate([
            'content' => 'required|string|max:5000',
            'scheduled_at' => 'nullable|date|after:now',
        ]);

        $user = $request->user();

        $conversation = Conversation::where('id', $conversationId)
            ->where('user_id', $user->id)
            ->first();

        if (!$conversation) {
            return response()->json([
                'message' => 'Conversation not found.',
            ], 404);
        }

        $scheduledAt = $request->input('scheduled_at');
        $isScheduled = !empty($scheduledAt);

        // Create message (pending or scheduled)
        $message = LinkedInMessage::create([
            'conversation_id' => $conversation->id,
            'user_id' => $user->id,
            'content' => $request->input('content'),
            'is_from_me' => true,
            'sender_name' => $user->name,
            'sent_at' => $isScheduled ? null : now(),
            'is_read' => true,
            'status' => $isScheduled ? LinkedInMessage::STATUS_SCHEDULED : LinkedInMessage::STATUS_PENDING,
            'scheduled_at' => $scheduledAt,
        ]);

        // Update conversation (only if sending now)
        if (!$isScheduled) {
            $conversation->update([
                'last_message_preview' => substr($message->content, 0, 100),
                'last_message_at' => $message->sent_at,
            ]);
        }

        return response()->json([
            'message' => $isScheduled ? 'Message scheduled.' : 'Message queued for sending.',
            'scheduled' => $isScheduled,
            'data' => $message,
        ]);
    }

    /**
     * Get scheduled messages for the user.
     *
     * GET /api/inbox/scheduled
     */
    public function scheduledMessages(Request $request): JsonResponse
    {
        $user = $request->user();

        $messages = LinkedInMessage::where('user_id', $user->id)
            ->scheduled()
            ->with(['conversation:id,linkedin_conversation_id,participant_name,participant_avatar_url'])
            ->orderBy('scheduled_at', 'asc')
            ->get();

        return response()->json([
            'messages' => $messages,
        ]);
    }

    /**
     * Cancel a scheduled message.
     *
     * DELETE /api/inbox/scheduled/{id}
     */
    public function cancelScheduledMessage(Request $request, int $messageId): JsonResponse
    {
        $user = $request->user();

        $message = LinkedInMessage::where('id', $messageId)
            ->where('user_id', $user->id)
            ->where('status', LinkedInMessage::STATUS_SCHEDULED)
            ->first();

        if (!$message) {
            return response()->json([
                'message' => 'Scheduled message not found.',
            ], 404);
        }

        $message->delete();

        return response()->json([
            'message' => 'Scheduled message cancelled.',
        ]);
    }

    /**
     * Update a scheduled message (reschedule or edit content).
     *
     * PUT /api/inbox/scheduled/{id}
     */
    public function updateScheduledMessage(Request $request, int $messageId): JsonResponse
    {
        $request->validate([
            'content' => 'nullable|string|max:5000',
            'scheduled_at' => 'nullable|date|after:now',
        ]);

        $user = $request->user();

        $message = LinkedInMessage::where('id', $messageId)
            ->where('user_id', $user->id)
            ->where('status', LinkedInMessage::STATUS_SCHEDULED)
            ->first();

        if (!$message) {
            return response()->json([
                'message' => 'Scheduled message not found.',
            ], 404);
        }

        $updates = [];
        if ($request->has('content')) {
            $updates['content'] = $request->input('content');
        }
        if ($request->has('scheduled_at')) {
            $updates['scheduled_at'] = $request->input('scheduled_at');
        }

        if (!empty($updates)) {
            $message->update($updates);
        }

        return response()->json([
            'message' => 'Scheduled message updated.',
            'data' => $message->fresh(),
        ]);
    }

    /**
     * Get pending messages to be sent by extension.
     *
     * GET /api/inbox/pending-messages
     */
    public function pendingMessages(Request $request): JsonResponse
    {
        $user = $request->user();

        $messages = LinkedInMessage::where('user_id', $user->id)
            ->pending()
            ->with(['conversation:id,linkedin_conversation_id,participant_linkedin_id,participant_profile_url'])
            ->get();

        return response()->json([
            'messages' => $messages,
        ]);
    }

    /**
     * Mark a message as sent by extension.
     *
     * POST /api/inbox/messages/{id}/mark-sent
     */
    public function markMessageSent(Request $request, int $messageId): JsonResponse
    {
        $request->validate([
            'linkedin_message_id' => 'nullable|string',
            'success' => 'required|boolean',
            'error_message' => 'nullable|string',
        ]);

        $user = $request->user();

        $message = LinkedInMessage::where('id', $messageId)
            ->where('user_id', $user->id)
            ->first();

        if (!$message) {
            return response()->json([
                'message' => 'Message not found.',
            ], 404);
        }

        if ($request->boolean('success')) {
            $updateData = [
                'status' => LinkedInMessage::STATUS_SENT,
                'linkedin_message_id' => $request->input('linkedin_message_id'),
            ];
            // Set sent_at if not already set (for scheduled messages)
            if (!$message->sent_at) {
                $updateData['sent_at'] = now();
            }
            $message->update($updateData);

            // Update conversation's last message info
            if ($message->conversation) {
                $message->conversation->update([
                    'last_message_preview' => substr($message->content, 0, 100),
                    'last_message_at' => $message->sent_at ?? now(),
                ]);
            }
        } else {
            $message->update([
                'status' => LinkedInMessage::STATUS_FAILED,
                'error_message' => $request->input('error_message', 'Unknown error'),
            ]);
        }

        return response()->json([
            'message' => 'Message status updated.',
            'data' => $message,
        ]);
    }

    /**
     * Mark conversation as read.
     *
     * POST /api/inbox/{id}/read
     */
    public function markAsRead(Request $request, int $conversationId): JsonResponse
    {
        $user = $request->user();

        $conversation = Conversation::where('id', $conversationId)
            ->where('user_id', $user->id)
            ->first();

        if (!$conversation) {
            return response()->json([
                'message' => 'Conversation not found.',
            ], 404);
        }

        $conversation->markAsRead();

        return response()->json([
            'message' => 'Conversation marked as read.',
        ]);
    }

    /**
     * Create a conversation (used by extension for auto-creating).
     *
     * POST /api/inbox/conversations
     */
    public function createConversation(Request $request): JsonResponse
    {
        $request->validate([
            'linkedin_conversation_id' => 'required|string',
            'participant_name' => 'required|string',
            'participant_linkedin_url' => 'nullable|string',
        ]);

        $user = $request->user();
        $normalizedConvId = $this->normalizeConversationId($request->input('linkedin_conversation_id'));

        // Check if conversation already exists (using normalized ID)
        $existing = Conversation::where('user_id', $user->id)
            ->where('linkedin_conversation_id', $normalizedConvId)
            ->first();

        if ($existing) {
            return response()->json([
                'message' => 'Conversation already exists.',
                'data' => $existing,
            ]);
        }

        // Create new conversation with normalized ID
        $conversation = Conversation::create([
            'user_id' => $user->id,
            'linkedin_conversation_id' => $normalizedConvId,
            'participant_name' => $request->input('participant_name'),
            'participant_profile_url' => $request->input('participant_linkedin_url'),
            'last_message_at' => now(),
            'last_synced_at' => now(),
        ]);

        return response()->json([
            'message' => 'Conversation created.',
            'data' => $conversation,
        ], 201);
    }

    /**
     * Delete a conversation.
     *
     * DELETE /api/inbox/{id}
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        $conversation = Conversation::where('id', $id)
            ->where('user_id', $user->id)
            ->first();

        if (!$conversation) {
            return response()->json([
                'message' => 'Conversation not found.',
            ], 404);
        }

        $conversation->delete();

        return response()->json([
            'message' => 'Conversation deleted.',
        ]);
    }

    /**
     * Internal helper to sync messages for a conversation.
     * Uses multiple strategies to prevent duplicates.
     */
    private function syncMessagesInternal(Conversation $conversation, array $messagesData, int $userId): array
    {
        $synced = 0;
        $created = 0;
        $skipped = 0;

        // Pre-fetch existing messages for this conversation to avoid N+1 queries
        $existingByLinkedInId = LinkedInMessage::where('conversation_id', $conversation->id)
            ->whereNotNull('linkedin_message_id')
            ->pluck('id', 'linkedin_message_id')
            ->toArray();

        // Also get recent messages for content-based dedup (last 24 hours)
        $recentMessages = LinkedInMessage::where('conversation_id', $conversation->id)
            ->where('created_at', '>=', now()->subHours(24))
            ->get(['id', 'content', 'is_from_me', 'sent_at'])
            ->toArray();

        // Get participant name for reliable is_from_me detection
        $participantName = strtolower(trim($conversation->participant_name ?? ''));

        foreach ($messagesData as $msgData) {
            $content = trim($msgData['content'] ?? '');
            if (empty($content)) {
                $skipped++;
                continue;
            }

            $linkedinMsgId = $msgData['linkedin_message_id'] ?? null;
            $sentAt = $msgData['sent_at'] ?? null;
            $senderName = strtolower(trim($msgData['sender_name'] ?? ''));

            // Reliable is_from_me detection:
            // Compare sender_name with participant_name (the other person)
            // If sender matches participant → message is FROM them (is_from_me = false)
            // If sender doesn't match → message is FROM me (is_from_me = true)
            $isFromMe = $msgData['is_from_me'] ?? false; // Default from extension

            if (!empty($senderName) && !empty($participantName)) {
                // Use string similarity to handle slight variations in names
                $isFromMe = !$this->namesMatch($senderName, $participantName);
            }

            // Strategy 1: Check by LinkedIn message ID (most reliable)
            $existing = null;
            if (!empty($linkedinMsgId) && isset($existingByLinkedInId[$linkedinMsgId])) {
                $existing = LinkedInMessage::find($existingByLinkedInId[$linkedinMsgId]);
            }

            // Strategy 2: Check by content + sender + approximate time (fallback for missing IDs)
            if (!$existing) {
                $contentHash = md5($content . ($isFromMe ? '1' : '0'));
                foreach ($recentMessages as $recent) {
                    $recentHash = md5(trim($recent['content']) . ($recent['is_from_me'] ? '1' : '0'));
                    if ($contentHash === $recentHash) {
                        // Same content and sender within 24 hours = likely duplicate
                        $existing = LinkedInMessage::find($recent['id']);
                        break;
                    }
                }
            }

            $messageFields = [
                'conversation_id' => $conversation->id,
                'user_id' => $userId,
                'linkedin_message_id' => $linkedinMsgId,
                'content' => $content,
                'is_from_me' => $isFromMe,
                'sender_name' => $msgData['sender_name'] ?? null,
                'sender_linkedin_id' => $msgData['sender_linkedin_id'] ?? null,
                'sent_at' => $sentAt ?? now(),
                'is_read' => $isFromMe, // Messages from me are always read
                'status' => LinkedInMessage::STATUS_SYNCED,
            ];

            if ($existing) {
                // Only update if we have new info (e.g., linkedin_message_id was missing)
                if (empty($existing->linkedin_message_id) && !empty($linkedinMsgId)) {
                    $existing->update(['linkedin_message_id' => $linkedinMsgId]);
                }
                $synced++;
            } else {
                $newMessage = LinkedInMessage::create($messageFields);
                // Add to recent messages for subsequent dedup in same batch
                $recentMessages[] = [
                    'id' => $newMessage->id,
                    'content' => $content,
                    'is_from_me' => $isFromMe,
                    'sent_at' => $sentAt,
                ];
                $created++;
            }
        }

        return ['synced' => $synced, 'created' => $created, 'skipped' => $skipped];
    }

    /**
     * Receive incoming message from extension (real-time).
     *
     * POST /api/inbox/incoming-message
     */
    public function incomingMessage(Request $request): JsonResponse
    {
        $request->validate([
            'linkedin_conversation_id' => 'required|string',
            'message' => 'required|array',
            'message.content' => 'required|string',
            'message.linkedin_message_id' => 'nullable|string',
            'message.sender_name' => 'nullable|string',
            'message.sender_linkedin_id' => 'nullable|string',
            'message.sent_at' => 'nullable|string',
            'message.is_from_me' => 'nullable|boolean',
        ]);

        $user = $request->user();
        $linkedinConversationId = $this->normalizeConversationId($request->input('linkedin_conversation_id'));
        $messageData = $request->input('message');

        // Find the conversation using normalized ID
        $conversation = Conversation::where('linkedin_conversation_id', $linkedinConversationId)
            ->where('user_id', $user->id)
            ->first();

        if (!$conversation) {
            return response()->json([
                'message' => 'Conversation not found.',
            ], 404);
        }

        // Check if message already exists (by linkedin_message_id or by content+time)
        $linkedinMessageId = $messageData['linkedin_message_id'] ?? null;
        $content = $messageData['content'];
        $sentAt = $messageData['sent_at'] ?? null;

        // Method 1: Check by LinkedIn message ID (most reliable)
        if ($linkedinMessageId) {
            $existing = LinkedInMessage::where('conversation_id', $conversation->id)
                ->where('linkedin_message_id', $linkedinMessageId)
                ->first();

            if ($existing) {
                return response()->json([
                    'message' => 'Message already exists.',
                    'data' => $existing,
                ]);
            }
        }

        // Method 2: Check by content + approximate time (fallback for messages without ID)
        // Check for same content within 5 minutes
        $recentDuplicate = LinkedInMessage::where('conversation_id', $conversation->id)
            ->where('content', $content)
            ->where('is_from_me', $messageData['is_from_me'] ?? false)
            ->where('created_at', '>=', now()->subMinutes(5))
            ->first();

        if ($recentDuplicate) {
            return response()->json([
                'message' => 'Duplicate message detected.',
                'data' => $recentDuplicate,
            ]);
        }

        $isFromMe = $messageData['is_from_me'] ?? false;

        // Create the new message
        $message = LinkedInMessage::create([
            'conversation_id' => $conversation->id,
            'user_id' => $user->id,
            'linkedin_message_id' => $linkedinMessageId,
            'content' => $messageData['content'],
            'is_from_me' => $isFromMe,
            'sender_name' => $messageData['sender_name'] ?? null,
            'sender_linkedin_id' => $messageData['sender_linkedin_id'] ?? null,
            'sent_at' => $messageData['sent_at'] ?? now(),
            'is_read' => $isFromMe, // Messages from me are already read
            'status' => LinkedInMessage::STATUS_SYNCED,
        ]);

        // Update conversation's last message timestamp
        // Only mark as unread if the message is NOT from the user
        $updateData = ['last_message_at' => $message->sent_at];
        if (!$isFromMe) {
            $updateData['is_unread'] = true;
            $updateData['unread_count'] = $conversation->unread_count + 1;
        }
        $conversation->update($updateData);

        return response()->json([
            'message' => 'Incoming message received.',
            'data' => $message,
        ]);
    }
}
