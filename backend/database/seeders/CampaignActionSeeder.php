<?php

namespace Database\Seeders;

use App\Models\CampaignAction;
use Illuminate\Database\Seeder;

/**
 * Campaign Action Seeder
 *
 * Seeds the campaign_actions table with the initial set of available action types.
 * These are the building blocks for creating campaigns.
 */
class CampaignActionSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * Inserts the following action types:
     * 1. Visit - Visit prospect's LinkedIn profile
     * 2. Invite - Send connection request with optional message
     * 3. Message - Send direct message to existing connection
     * 4. Follow - Follow the prospect's profile
     * 5. Email - Send email to prospect (requires extracted email)
     */
    public function run(): void
    {
        $actions = [
            [
                'key' => 'visit',
                'name' => 'Visit Profile',
                'description' => 'Visit your prospects\' LinkedIn profile to increase visibility',
                'icon' => 'eye',
                'requires_template' => false,
                'requires_connection' => false,
                'config' => [
                    'min_delay' => 2,
                    'max_delay' => 5,
                ],
                'is_active' => true,
                'order' => 1,
            ],
            [
                'key' => 'invite',
                'name' => 'Send Connection Request',
                'description' => 'Send a connection request with an optional personalized message',
                'icon' => 'user-plus',
                'requires_template' => true,
                'requires_connection' => false,
                'config' => [
                    'min_delay' => 3,
                    'max_delay' => 7,
                    'message_max_length' => 300,
                    'template_type' => 'invitation',
                ],
                'is_active' => true,
                'order' => 2,
            ],
            [
                'key' => 'message',
                'name' => 'Send Message',
                'description' => 'Send a direct message to your existing connections',
                'icon' => 'message-square',
                'requires_template' => true,
                'requires_connection' => true,
                'config' => [
                    'min_delay' => 5,
                    'max_delay' => 10,
                    'template_type' => 'message',
                ],
                'is_active' => true,
                'order' => 3,
            ],
            [
                'key' => 'follow',
                'name' => 'Follow Profile',
                'description' => 'Follow the prospect\'s LinkedIn profile',
                'icon' => 'user-check',
                'requires_template' => false,
                'requires_connection' => false,
                'config' => [
                    'min_delay' => 2,
                    'max_delay' => 4,
                ],
                'is_active' => true,
                'order' => 4,
            ],
            [
                'key' => 'email',
                'name' => 'Email',
                'description' => 'Extract emails from prospects\' profiles and send personalized emails',
                'icon' => 'mail',
                'requires_template' => true,
                'requires_connection' => false,
                'config' => [
                    'min_delay' => 3,
                    'max_delay' => 7,
                    'template_type' => 'email',
                    'requires_tag' => true, // Must select a tag to filter prospects
                ],
                'is_active' => true,
                'order' => 5,
            ],
        ];

        foreach ($actions as $action) {
            CampaignAction::updateOrCreate(
                ['key' => $action['key']],
                $action
            );
        }

        $this->command->info('✅ Campaign actions seeded successfully!');
        $this->command->info('   - Visit Profile');
        $this->command->info('   - Send Connection Request');
        $this->command->info('   - Send Message');
        $this->command->info('   - Follow Profile');
        $this->command->info('   - Email');
    }
}
