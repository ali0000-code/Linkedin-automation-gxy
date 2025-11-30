<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Tag Model
 *
 * Represents a custom label for categorizing prospects.
 * Users can create tags like "Hot Lead", "Marketing", "CEO", etc.
 * Many-to-many relationship with prospects.
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
