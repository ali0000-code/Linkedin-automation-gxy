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

        $stats = [
            'total_conversations' => Conversation::where('user_id', $user->id)->count(),
            'unread_conversations' => Conversation::where('user_id', $user->id)->unread()->count(),
            'total_unread_messages' => LinkedInMessage::where('user_id', $user->id)
                ->where('is_read', false)
                ->where('is_from_me', false)
                ->count(),
            'pending_messages' => LinkedInMessage::where('user_id', $user->id)
                ->pending()
                ->count(),
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

            foreach ($conversationsData as $convData) {
                // Try to find existing conversation
                $conversation = Conversation::where('user_id', $user->id)
                    ->where('linkedin_conversation_id', $convData['linkedin_conversation_id'])
                    ->first();

                // Try to link to prospect by linkedin_id
                $prospectId = null;
                if (!empty($convData['participant_linkedin_id'])) {
                    $prospect = Prospect::where('user_id', $user->id)
                        ->where('linkedin_id', $convData['participant_linkedin_id'])
                        ->first();
                    $prospectId = $prospect?->id;
                }

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
                    'is_unread' => $convData['is_unread'] ?? false,
                    'unread_count' => $convData['unread_count'] ?? 0,
                    'last_synced_at' => now(),
                ];

                if ($conversation) {
                    $conversation->update($conversationFields);
                    $synced++;
                } else {
                    $conversation = Conversation::create($conversationFields);
                    $created++;
                }

                // Sync messages if provided
                if (!empty($convData['messages'])) {
                    $this->syncMessages($conversation, $convData['messages'], $user->id);
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

        // Check if conversation already exists
        $existing = Conversation::where('user_id', $user->id)
            ->where('linkedin_conversation_id', $request->input('linkedin_conversation_id'))
            ->first();

        if ($existing) {
            return response()->json([
                'message' => 'Conversation already exists.',
                'data' => $existing,
            ]);
        }

        // Create new conversation
        $conversation = Conversation::create([
            'user_id' => $user->id,
            'linkedin_conversation_id' => $request->input('linkedin_conversation_id'),
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
     */
    private function syncMessagesInternal(Conversation $conversation, array $messagesData, int $userId): array
    {
        $synced = 0;
        $created = 0;

        foreach ($messagesData as $msgData) {
            // Try to find existing message by linkedin_message_id
            $existing = null;
            if (!empty($msgData['linkedin_message_id'])) {
                $existing = LinkedInMessage::where('conversation_id', $conversation->id)
                    ->where('linkedin_message_id', $msgData['linkedin_message_id'])
                    ->first();
            }

            $messageFields = [
                'conversation_id' => $conversation->id,
                'user_id' => $userId,
                'linkedin_message_id' => $msgData['linkedin_message_id'] ?? null,
                'content' => $msgData['content'],
                'is_from_me' => $msgData['is_from_me'] ?? false,
                'sender_name' => $msgData['sender_name'] ?? null,
                'sender_linkedin_id' => $msgData['sender_linkedin_id'] ?? null,
                'sent_at' => $msgData['sent_at'] ?? now(),
                'is_read' => $msgData['is_from_me'] ?? true, // Messages from me are always read
                'status' => LinkedInMessage::STATUS_SYNCED,
            ];

            if ($existing) {
                $existing->update($messageFields);
                $synced++;
            } else {
                LinkedInMessage::create($messageFields);
                $created++;
            }
        }

        return ['synced' => $synced, 'created' => $created];
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
        $linkedinConversationId = $request->input('linkedin_conversation_id');
        $messageData = $request->input('message');

        // Find the conversation
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

        // Create the new message
        $message = LinkedInMessage::create([
            'conversation_id' => $conversation->id,
            'user_id' => $user->id,
            'linkedin_message_id' => $linkedinMessageId,
            'content' => $messageData['content'],
            'is_from_me' => $messageData['is_from_me'] ?? false,
            'sender_name' => $messageData['sender_name'] ?? null,
            'sender_linkedin_id' => $messageData['sender_linkedin_id'] ?? null,
            'sent_at' => $messageData['sent_at'] ?? now(),
            'is_read' => false,
            'status' => LinkedInMessage::STATUS_SYNCED,
        ]);

        // Update conversation's last message timestamp
        $conversation->update([
            'last_message_at' => $message->sent_at,
            'is_unread' => true,
            'unread_count' => $conversation->unread_count + 1,
        ]);

        return response()->json([
            'message' => 'Incoming message received.',
            'data' => $message,
        ]);
    }
}
