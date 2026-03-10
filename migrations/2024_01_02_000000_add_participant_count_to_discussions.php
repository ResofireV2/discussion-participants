<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

// Adds a participant_count column to the discussions table.
//
// This stores the total number of distinct users who have posted a visible
// comment in each discussion (excluding the OP). It is kept in sync by
// UpdateParticipantPreview on every post Posted/Hidden/Restored/Deleted event,
// and backfilled by the participants:populate console command.
//
// Storing the count on the discussion row means the discussion list page never
// needs a COUNT(DISTINCT user_id) subquery — it reads a single integer column
// that is already there.

return [
    'up' => function (Builder $schema) {
        if (!$schema->hasColumn('discussions', 'participant_count')) {
            $schema->table('discussions', function (Blueprint $table) {
                // Nullable so existing rows start as NULL until backfilled.
                // The JS falls back gracefully when the value is absent.
                $table->unsignedInteger('participant_count')->nullable()->after('comment_count');
            });
        }
    },

    'down' => function (Builder $schema) {
        $schema->table('discussions', function (Blueprint $table) {
            $table->dropColumn('participant_count');
        });
    },
];
