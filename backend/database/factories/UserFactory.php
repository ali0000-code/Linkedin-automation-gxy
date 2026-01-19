<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\User>
 */
class UserFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'linkedin_id' => $this->faker->unique()->uuid(),
            'name' => $this->faker->name(),
            'email' => $this->faker->unique()->safeEmail(),
            'profile_url' => 'https://linkedin.com/in/' . $this->faker->slug(),
            'profile_image_url' => $this->faker->imageUrl(200, 200, 'people'),
            'oauth_access_token' => Str::random(64),
            'oauth_refresh_token' => Str::random(64),
            'token_expires_at' => now()->addDays(60),
            'is_active' => true,
            'last_login_at' => now(),
        ];
    }

    /**
     * Indicate that the user is inactive.
     */
    public function inactive(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_active' => false,
        ]);
    }
}
