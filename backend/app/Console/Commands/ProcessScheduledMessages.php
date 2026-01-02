<?php

namespace App\Console\Commands;

use App\Models\LinkedInMessage;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class ProcessScheduledMessages extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'messages:process-scheduled';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Process scheduled LinkedIn messages that are due to be sent';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $dueMessages = LinkedInMessage::dueToSend()->get();

        if ($dueMessages->isEmpty()) {
            $this->line('No scheduled messages due to be sent.');
            return Command::SUCCESS;
        }

        $this->info("Processing {$dueMessages->count()} scheduled message(s)...");

        $processed = 0;
        foreach ($dueMessages as $message) {
            try {
                // Change status to pending so the extension picks it up
                $message->update([
                    'status' => LinkedInMessage::STATUS_PENDING,
                ]);

                $processed++;

                Log::info('Scheduled message queued for sending', [
                    'message_id' => $message->id,
                    'conversation_id' => $message->conversation_id,
                    'scheduled_at' => $message->scheduled_at,
                ]);
            } catch (\Exception $e) {
                Log::error('Failed to process scheduled message', [
                    'message_id' => $message->id,
                    'error' => $e->getMessage(),
                ]);

                $this->error("Failed to process message {$message->id}: {$e->getMessage()}");
            }
        }

        $this->info("Successfully queued {$processed} message(s) for sending.");

        return Command::SUCCESS;
    }
}
