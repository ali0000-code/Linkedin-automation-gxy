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
            // Combo Actions - Named by their action sequence
            [
                'key' => 'connect_message',
                'name' => 'Connect + Message',
                'description' => 'Sends connection request if not connected, or message if already connected. Best for universal outreach.',
                'icon' => 'zap',
                'requires_template' => true,
                'requires_connection' => false,
                'config' => [
                    'min_delay' => 3,
                    'max_delay' => 7,
                    'is_conditional' => true,
                    'conditions' => [
                        'if_connected' => [
                            'action' => 'message',
                            'template_type' => 'message',
                        ],
                        'if_not_connected' => [
                            'action' => 'invite',
                            'template_type' => 'invitation',
                            'message_max_length' => 300,
                        ],
                    ],
                    'requires_two_templates' => true,
                ],
                'is_active' => true,
                'order' => 6,
            ],
            [
                'key' => 'visit_follow_connect',
                'name' => 'Visit + Follow + Connect',
                'description' => 'Warms up prospects: Visit profile → Follow → Send connection request. Higher acceptance rates.',
                'icon' => 'heart',
                'requires_template' => true,
                'requires_connection' => false,
                'config' => [
                    'min_delay' => 5,
                    'max_delay' => 10,
                    'is_combo' => true,
                    'steps' => ['visit', 'follow', 'invite'],
                    'template_type' => 'invitation',
                    'message_max_length' => 300,
                ],
                'is_active' => true,
                'order' => 7,
            ],
            [
                'key' => 'email_message',
                'name' => 'Email + Message',
                'description' => 'Sends email if available, falls back to LinkedIn message if no email found.',
                'icon' => 'mail',
                'requires_template' => true,
                'requires_connection' => false,
                'config' => [
                    'min_delay' => 3,
                    'max_delay' => 7,
                    'is_conditional' => true,
                    'conditions' => [
                        'if_has_email' => [
                            'action' => 'email',
                            'template_type' => 'email',
                        ],
                        'if_no_email' => [
                            'action' => 'extract_then_email',
                        ],
                        'fallback' => [
                            'action' => 'message',
                            'template_type' => 'message',
                        ],
                    ],
                    'requires_two_templates' => true,
                ],
                'is_active' => true,
                'order' => 8,
            ],
        ];

        foreach ($actions as $action) {
            CampaignAction::updateOrCreate(
                ['key' => $action['key']],
                $action
            );
        }

        $this->command->info('✅ Campaign actions seeded successfully!');
        $this->command->info('   Basic Actions:');
        $this->command->info('   - Visit Profile');
        $this->command->info('   - Send Connection Request');
        $this->command->info('   - Send Message');
        $this->command->info('   - Follow Profile');
        $this->command->info('   - Email');
        $this->command->info('   Combo Actions:');
        $this->command->info('   - Connect + Message');
        $this->command->info('   - Visit + Follow + Connect');
        $this->command->info('   - Email + Message');
    }
}
