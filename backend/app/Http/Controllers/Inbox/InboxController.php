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
     *
     * POST /api/inbox/{id}/send
     */
    public function sendMessage(Request $request, int $conversationId): JsonResponse
    {
        $request->validate([
            'content' => 'required|string|max:5000',
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

        // Create pending message
        $message = LinkedInMessage::create([
            'conversation_id' => $conversation->id,
            'user_id' => $user->id,
            'content' => $request->input('content'),
            'is_from_me' => true,
            'sender_name' => $user->name,
            'sent_at' => now(),
            'is_read' => true,
            'status' => LinkedInMessage::STATUS_PENDING,
        ]);

        // Update conversation
        $conversation->update([
            'last_message_preview' => substr($message->content, 0, 100),
            'last_message_at' => $message->sent_at,
        ]);

        return response()->json([
            'message' => 'Message queued for sending.',
            'data' => $message,
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
            $message->update([
                'status' => LinkedInMessage::STATUS_SENT,
                'linkedin_message_id' => $request->input('linkedin_message_id'),
            ]);
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

        // Check if message already exists
        $linkedinMessageId = $messageData['linkedin_message_id'] ?? null;
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
