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
        'linkedin_id',
        'name',
        'email',
        'profile_url',
        'profile_image_url',
        'oauth_access_token',
        'oauth_refresh_token',
        'token_expires_at',
        'is_active',
        'last_login_at',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'oauth_access_token',
        'oauth_refresh_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'token_expires_at' => 'datetime',
            'last_login_at' => 'datetime',
            'is_active' => 'boolean',
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

    /**
     * Get all message templates created by this user.
     *
     * Templates are reusable messages for campaigns (invitation or direct messages).
     */
    public function messageTemplates()
    {
        return $this->hasMany(MessageTemplate::class);
    }

    /**
     * Get the Gmail settings for this user.
     *
     * Gmail settings store SMTP credentials for sending emails.
     */
    public function gmailSetting()
    {
        return $this->hasOne(GmailSetting::class);
    }

    /**
     * Get all emails sent by this user.
     */
    public function sentEmails()
    {
        return $this->hasMany(SentEmail::class);
    }

    /**
     * Create a Sanctum token while enforcing a per-user device limit.
     *
     * Prevents token sprawl by pruning old tokens when the limit is reached.
     * When a user has >= $maxDevices tokens, we keep the ($maxDevices - 1) most
     * recent ones and delete the rest, then create a new one -- so the total
     * never exceeds $maxDevices.
     *
     * Tokens expire after 30 days (hardcoded here; also configured in sanctum.php).
     *
     * @param string $name Token name for identification (e.g., 'webapp', 'extension')
     * @param array $abilities Token abilities/scopes (default: all)
     * @param int $maxDevices Maximum concurrent tokens allowed (default: 3)
     * @return \Laravel\Sanctum\NewAccessToken
     */
    public function createTokenWithDeviceLimit(string $name, array $abilities = ['*'], int $maxDevices = 3): \Laravel\Sanctum\NewAccessToken
    {
        // Enforce the limit per token name separately so webapp sessions
        // and extension tokens don't compete for the same slots.
        $existingTokens = $this->tokens()
            ->where('name', $name)
            ->orderBy('created_at', 'desc')
            ->get();

        if ($existingTokens->count() >= $maxDevices) {
            // Keep the ($maxDevices - 1) most recent, delete the rest
            $tokensToKeep = $existingTokens->take($maxDevices - 1)->pluck('id');
            $this->tokens()->where('name', $name)->whereNotIn('id', $tokensToKeep)->delete();
        }

        return $this->createToken($name, $abilities, now()->addDays(30));
    }

    /**
     * Generate a new random auth key and persist it.
     *
     * Calling this invalidates any Chrome extension instance using the old key,
     * forcing the user to re-enter the new key. Useful if the key is compromised.
     *
     * @return string The newly generated 22-character auth key
     */
    public function regenerateAuthKey(): string
    {
        $key = Str::random(22);
        $this->update(['auth_key' => $key]);
        return $key;
    }

    /**
     * Ensure the user has an auth key, generating one lazily if missing.
     *
     * Called during OAuth callback to guarantee every user has an auth key
     * without forcing regeneration on existing users.
     *
     * @return string The existing or newly generated auth key
     */
    public function ensureAuthKey(): string
    {
        if (!$this->auth_key) {
            return $this->regenerateAuthKey();
        }
        return $this->auth_key;
    }
}
