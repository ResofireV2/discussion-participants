<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

// participant_count on the discussions table.
//
// This stores the total number of distinct users who have posted a visible
// comment in each discussion (excluding the OP). It is kept in sync by
// UpdateParticipantPreview on every post Posted/Hidden/Restored/Deleted event,
// and backfilled by the participants:populate console command.
//
// Storing the count on the discussion row means the discussion list page never
// needs a COUNT(DISTINCT user_id) subquery — it reads a single integer column
// that is already there.
//
// NOTE: participant_count is owned by Flarum core — it has been present since
// core's own 2015_02_24_000000_create_discussions_table migration and is read
// by core's DiscussionPolicy for rename-permission checks. The up() function is
// a guarded no-op on any standard Flarum install because the column already
// exists. The down() function must never drop it — doing so would silently
// break core functionality when this extension is uninstalled.

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
        // participant_count is owned by Flarum core. We do not drop it on
        // uninstall — doing so would break core's DiscussionPolicy checks.
    },
];
