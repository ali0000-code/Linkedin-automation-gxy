<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

/**
 * User Model
 *
 * Represents a user account in the system.
 * Each user can have one LinkedIn account, multiple prospects, tags, and campaigns.
 */
class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, Notifiable, HasApiTokens;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    /**
     * Get the LinkedIn account associated with this user.
     *
     * Returns the connected LinkedIn profile (1-to-1 relationship).
     * A user can only have ONE LinkedIn account in MVP.
     */
    public function linkedInAccount()
    {
        return $this->hasOne(LinkedInAccount::class);
    }

    /**
     * Get all prospects belonging to this user.
     *
     * Returns all leads extracted by this user from LinkedIn.
     */
    public function prospects()
    {
        return $this->hasMany(Prospect::class);
    }

    /**
     * Get all tags created by this user.
     *
     * Tags are used to categorize prospects.
     */
    public function tags()
    {
        return $this->hasMany(Tag::class);
    }

    /**
     * Get all campaigns created by this user.
     *
     * Campaigns automate LinkedIn actions (e.g., sending connection requests).
     */
    public function campaigns()
    {
        return $this->hasMany(Campaign::class);
    }

    /**
     * Get all actions in the queue for this user.
     *
     * Actions are scheduled LinkedIn tasks to be performed by the extension.
     */
    public function actionQueue()
    {
        return $this->hasMany(ActionQueue::class);
    }
}
