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
        // participant_count has been a core Flarum column since the 2018 rename migration
        // (2018_01_11_155200_change_discussions_rename_columns.php renames participants_count
        // → participant_count). On Flarum 2.x this column already exists in every installation.
        //
        // On Flarum 1.x this extension added the column itself (core did not expose it in the
        // serializer). On Flarum 2.x core owns the column, casts it, and serializes it — this
        // extension must NOT attempt to create it again or the migration will throw
        // "Column 'participant_count' already exists" and block enabling the extension.
        //
        // The hasColumn() guard makes this migration safe on both 1.x (adds the column if
        // somehow absent) and 2.x (no-op because core already provides the column).
        if ($schema->hasColumn('discussions', 'participant_count')) {
            return;
        }

        $schema->table('discussions', function (Blueprint $table) {
            $table->unsignedInteger('participant_count')->nullable()->after('comment_count');
        });
    },

    'down' => function (Builder $schema) {
        $schema->table('discussions', function (Blueprint $table) {
            $table->dropColumn('participant_count');
        });
    },
];
