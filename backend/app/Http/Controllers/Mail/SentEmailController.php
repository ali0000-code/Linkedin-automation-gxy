<?php

namespace App\Http\Controllers\Mail;

use App\Http\Controllers\Controller;
use App\Models\Campaign;
use App\Models\CampaignAction;
use App\Models\MessageTemplate;
use App\Models\Prospect;
use App\Models\SentEmail;
use App\Services\EmailService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * SentEmailController
 *
 * Handles viewing sent emails and statistics.
 */
class SentEmailController extends Controller
{
    protected EmailService $emailService;

    public function __construct(EmailService $emailService)
    {
        $this->emailService = $emailService;
    }

    /**
     * Create a custom email (not from campaign).
     *
     * POST /api/mail
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'to_email' => 'required|email|max:255',
            'subject' => 'required|string|max:255',
            'body' => 'required|string',
        ]);

        $user = $request->user();

        $sentEmail = SentEmail::create([
            'user_id' => $user->id,
            'prospect_id' => null,
            'campaign_id' => null,
            'to_email' => $request->input('to_email'),
            'subject' => $request->input('subject'),
            'body' => $request->input('body'),
            'status' => SentEmail::STATUS_PENDING,
        ]);

        return response()->json([
            'message' => 'Email created successfully.',
            'data' => $sentEmail,
        ], 201);
    }

    /**
     * List sent emails.
     *
     * GET /api/mail
     */
    public function index(Request $request): JsonResponse
    {
        $query = SentEmail::where('user_id', $request->user()->id)
            ->with(['prospect:id,full_name,profile_url,email', 'campaign:id,name'])
            ->orderBy('created_at', 'desc');

        // Filter by status
        if ($request->has('status') && in_array($request->status, ['pending', 'sent', 'failed'])) {
            $query->where('status', $request->status);
        }

        // Search by recipient email or subject
        if ($request->has('search') && $request->search) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('to_email', 'like', "%{$search}%")
                    ->orWhere('subject', 'like', "%{$search}%");
            });
        }

        // Paginate
        $perPage = min($request->input('per_page', 20), 100);
        $emails = $query->paginate($perPage);

        return response()->json([
            'data' => $emails->items(),
            'meta' => [
                'current_page' => $emails->currentPage(),
                'last_page' => $emails->lastPage(),
                'per_page' => $emails->perPage(),
                'total' => $emails->total(),
            ],
        ]);
    }

    /**
     * Get email statistics.
     *
     * GET /api/mail/stats
     */
    public function stats(Request $request): JsonResponse
    {
        $stats = $this->emailService->getStats($request->user());

        return response()->json($stats);
    }

    /**
     * Get single email details.
     *
     * GET /api/mail/{id}
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $email = SentEmail::where('user_id', $request->user()->id)
            ->with(['prospect', 'campaign'])
            ->find($id);

        if (!$email) {
            return response()->json([
                'message' => 'Email not found.',
            ], 404);
        }

        return response()->json([
            'data' => $email,
        ]);
    }

    /**
     * Get completed email campaigns with extraction results.
     * These are campaigns that have finished and have prospects with extracted emails.
     *
     * GET /api/mail/pending-extractions
     */
    public function getPendingExtractions(Request $request): JsonResponse
    {
        $user = $request->user();

        // Get the email action
        $emailAction = CampaignAction::where('key', 'email')->first();

        if (!$emailAction) {
            return response()->json([
                'campaigns' => [],
            ]);
        }

        // Find completed campaigns with email action that haven't been processed yet
        $campaigns = Campaign::where('user_id', $user->id)
            ->where('status', Campaign::STATUS_COMPLETED)
            ->where('emails_processed', false) // Not yet processed
            ->whereHas('steps', function ($q) use ($emailAction) {
                $q->where('campaign_action_id', $emailAction->id);
            })
            ->with([
                'campaignProspects.prospect',
                'steps.messageTemplate' // Include the template from the campaign step
            ])
            ->orderBy('completed_at', 'desc')
            ->get();

        $result = $campaigns->map(function ($campaign) {
            $prospectsWithEmail = $campaign->campaignProspects
                ->filter(fn($cp) => !empty($cp->prospect?->email))
                ->map(fn($cp) => [
                    'id' => $cp->prospect->id,
                    'full_name' => $cp->prospect->full_name,
                    'email' => $cp->prospect->email,
                    'profile_url' => $cp->prospect->profile_url,
                ]);

            $prospectsWithoutEmail = $campaign->campaignProspects
                ->filter(fn($cp) => empty($cp->prospect?->email))
                ->map(fn($cp) => [
                    'id' => $cp->prospect->id,
                    'full_name' => $cp->prospect->full_name,
                    'profile_url' => $cp->prospect->profile_url,
                ]);

            // Get the template from the first step (email campaigns have one step)
            $template = $campaign->steps->first()?->messageTemplate;

            return [
                'id' => $campaign->id,
                'name' => $campaign->name,
                'completed_at' => $campaign->completed_at?->toIso8601String(),
                'total_prospects' => $campaign->total_prospects,
                'with_email_count' => $prospectsWithEmail->count(),
                'without_email_count' => $prospectsWithoutEmail->count(),
                'prospects_with_email' => $prospectsWithEmail->values(),
                'prospects_without_email' => $prospectsWithoutEmail->values(),
                'template' => $template ? [
                    'id' => $template->id,
                    'name' => $template->name,
                    'subject' => $template->subject,
                    'content' => $template->content,
                    'type' => $template->type,
                ] : null,
            ];
        })->filter(fn($c) => $c['with_email_count'] > 0); // Only include campaigns with found emails

        return response()->json([
            'campaigns' => $result->values(),
        ]);
    }

    /**
     * Queue emails from a completed email campaign.
     * Creates sent_emails entries for all prospects with emails.
     *
     * POST /api/mail/queue-from-campaign
     */
    public function queueFromCampaign(Request $request): JsonResponse
    {
        $sendNow = $request->boolean('send_now', false);

        // Template is required only if sending now
        $request->validate([
            'campaign_id' => 'required|integer|exists:campaigns,id',
            'template_id' => $sendNow ? 'required|integer|exists:message_templates,id' : 'nullable|integer|exists:message_templates,id',
            'send_now' => 'boolean',
        ]);

        $user = $request->user();
        $campaignId = $request->input('campaign_id');
        $templateId = $request->input('template_id');

        // Get the campaign with its step template
        $campaign = Campaign::where('id', $campaignId)
            ->where('user_id', $user->id)
            ->with(['campaignProspects.prospect', 'steps.messageTemplate'])
            ->first();

        if (!$campaign) {
            return response()->json([
                'message' => 'Campaign not found.',
            ], 404);
        }

        // Get the template - either from request or from campaign step
        $template = null;
        if ($templateId) {
            $template = MessageTemplate::where('id', $templateId)
                ->where('user_id', $user->id)
                ->where('type', 'email')
                ->first();

            if (!$template) {
                return response()->json([
                    'message' => 'Email template not found.',
                ], 404);
            }
        } elseif ($sendNow) {
            // If sending now but no template provided, try to get from campaign step
            $template = $campaign->steps->first()?->messageTemplate;
            if (!$template) {
                return response()->json([
                    'message' => 'Template is required for sending emails.',
                ], 400);
            }
        }

        // Get prospects with emails
        $prospectsWithEmail = $campaign->campaignProspects
            ->filter(fn($cp) => !empty($cp->prospect?->email))
            ->map(fn($cp) => $cp->prospect);

        if ($prospectsWithEmail->isEmpty()) {
            return response()->json([
                'message' => 'No prospects with emails found.',
            ], 400);
        }

        DB::beginTransaction();

        try {
            $createdCount = 0;

            foreach ($prospectsWithEmail as $prospect) {
                $subject = null;
                $body = null;

                // Only personalize content if we have a template
                if ($template) {
                    $subject = $this->personalizeContent($template->subject ?? 'Message from LinkedIn', $prospect);
                    $body = $this->personalizeContent($template->content, $prospect);
                }

                // Create sent_email entry
                SentEmail::create([
                    'user_id' => $user->id,
                    'prospect_id' => $prospect->id,
                    'campaign_id' => $campaign->id,
                    'to_email' => $prospect->email,
                    'subject' => $subject,
                    'body' => $body,
                    'status' => $sendNow ? SentEmail::STATUS_PENDING : 'draft',
                ]);

                $createdCount++;
            }

            // Mark campaign as processed so it won't show in pending extractions
            $campaign->update(['emails_processed' => true]);

            DB::commit();

            // If send_now, trigger the email sending service
            if ($sendNow) {
                $this->emailService->sendPendingEmails($user);
            }

            return response()->json([
                'message' => $sendNow
                    ? "Queued {$createdCount} emails for sending."
                    : "Saved {$createdCount} emails as drafts.",
                'count' => $createdCount,
                'status' => $sendNow ? 'pending' : 'draft',
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Failed to queue emails: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Delete/discard emails from a campaign extraction.
     * User chose not to save the extracted emails.
     *
     * DELETE /api/mail/discard-extraction/{campaignId}
     */
    public function discardExtraction(Request $request, int $campaignId): JsonResponse
    {
        $user = $request->user();

        // Find the campaign
        $campaign = Campaign::where('id', $campaignId)
            ->where('user_id', $user->id)
            ->first();

        if (!$campaign) {
            return response()->json([
                'message' => 'Campaign not found.',
            ], 404);
        }

        // Mark the campaign as processed so it won't show in pending extractions
        $campaign->update(['emails_processed' => true]);

        return response()->json([
            'message' => 'Extraction discarded.',
        ]);
    }

    /**
     * Personalize content with prospect data.
     */
    protected function personalizeContent(string $content, Prospect $prospect): string
    {
        $nameParts = explode(' ', trim($prospect->full_name ?? ''));
        $firstName = $nameParts[0] ?? '';
        $lastName = count($nameParts) > 1 ? implode(' ', array_slice($nameParts, 1)) : '';

        $replacements = [
            '{firstName}' => $firstName,
            '{lastName}' => $lastName,
            '{fullName}' => $prospect->full_name ?? '',
            '{company}' => $prospect->company ?? '',
            '{headline}' => $prospect->headline ?? '',
            '{location}' => $prospect->location ?? '',
            '{email}' => $prospect->email ?? '',
        ];

        return str_replace(array_keys($replacements), array_values($replacements), $content);
    }

    /**
     * Send a single email.
     *
     * POST /api/mail/{id}/send
     */
    public function send(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        $sentEmail = SentEmail::where('id', $id)
            ->where('user_id', $user->id)
            ->first();

        if (!$sentEmail) {
            return response()->json([
                'message' => 'Email not found.',
            ], 404);
        }

        $result = $this->emailService->sendSingleEmail($user, $sentEmail);

        return response()->json([
            'success' => $result['success'],
            'message' => $result['message'],
        ], $result['success'] ? 200 : 400);
    }

    /**
     * Send multiple emails in bulk.
     *
     * POST /api/mail/send-bulk
     */
    public function sendBulk(Request $request): JsonResponse
    {
        $request->validate([
            'email_ids' => 'required|array|min:1',
            'email_ids.*' => 'integer|exists:sent_emails,id',
        ]);

        $user = $request->user();
        $emailIds = $request->input('email_ids');

        $result = $this->emailService->sendBulkEmails($user, $emailIds);

        return response()->json([
            'success' => $result['success'],
            'message' => $result['message'],
            'sent' => $result['sent'],
            'failed' => $result['failed'],
        ]);
    }

    /**
     * Delete a single email.
     *
     * DELETE /api/mail/{id}
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        $sentEmail = SentEmail::where('id', $id)
            ->where('user_id', $user->id)
            ->first();

        if (!$sentEmail) {
            return response()->json([
                'message' => 'Email not found.',
            ], 404);
        }

        $sentEmail->delete();

        return response()->json([
            'message' => 'Email deleted successfully.',
        ]);
    }

    /**
     * Delete multiple emails in bulk.
     *
     * DELETE /api/mail/bulk-delete
     */
    public function bulkDelete(Request $request): JsonResponse
    {
        $request->validate([
            'email_ids' => 'required|array|min:1',
            'email_ids.*' => 'integer|exists:sent_emails,id',
        ]);

        $user = $request->user();
        $emailIds = $request->input('email_ids');

        $deleted = SentEmail::where('user_id', $user->id)
            ->whereIn('id', $emailIds)
            ->delete();

        return response()->json([
            'message' => "Deleted {$deleted} emails.",
            'deleted' => $deleted,
        ]);
    }

    /**
     * Update an email (for editing draft).
     *
     * PUT /api/mail/{id}
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'subject' => 'sometimes|string|max:255',
            'body' => 'sometimes|string',
        ]);

        $user = $request->user();

        $sentEmail = SentEmail::where('id', $id)
            ->where('user_id', $user->id)
            ->first();

        if (!$sentEmail) {
            return response()->json([
                'message' => 'Email not found.',
            ], 404);
        }

        // Can only edit draft or pending emails
        if ($sentEmail->status === SentEmail::STATUS_SENT) {
            return response()->json([
                'message' => 'Cannot edit sent emails.',
            ], 400);
        }

        $sentEmail->update($request->only(['subject', 'body']));

        return response()->json([
            'message' => 'Email updated successfully.',
            'data' => $sentEmail->fresh(['prospect', 'campaign']),
        ]);
    }
}
