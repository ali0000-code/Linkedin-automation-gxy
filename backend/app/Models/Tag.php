<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Tag Model
 *
 * Represents a user-defined label for categorizing and filtering prospects.
 * Examples: "Hot Lead", "Marketing", "CEO", "Batch #3".
 *
 * Tags serve two purposes:
 * 1. Organization -- users can filter/search prospects by tag in the UI
 * 2. Campaign targeting -- a campaign can have a tag_id to auto-include all
 *    prospects with that tag when the campaign starts
 *
 * Many-to-many relationship with Prospect via the prospect_tag pivot table.
 *
 * The color field stores a hex color code (e.g., '#3b82f6') used for visual
 * differentiation in the frontend. Default is blue if not specified.
 * The frontend provides a preset palette, but any valid hex color is accepted.
 */
class Tag extends Model
{
    /**
     * The table associated with the model.
     */
    protected $table = 'tags';

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'user_id',
        'name',
        'color',
    ];

    /**
     * Get the user that owns this tag.
     */
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get all prospects tagged with this tag.
     *
     * Many-to-many relationship via prospect_tag pivot table.
     */
    public function prospects()
    {
        return $this->belongsToMany(Prospect::class, 'prospect_tag')
            ->withTimestamps();
    }
}
