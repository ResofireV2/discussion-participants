<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

// participant_count on the discussions table.
//
// This column is owned by Flarum core — it has been present since core's own
// 2015_02_24_000000_create_discussions_table migration and is read by core's
// DiscussionPolicy and written by Discussion::refreshParticipantCount().
//
// The up() function is a guarded no-op on any standard Flarum install because
// the column already exists. It is kept only for edge-case environments (e.g.
// a bare schema constructed without running core migrations in order) where
// the column might genuinely be absent.
//
// The down() function is intentionally a no-op. Dropping participant_count on
// uninstall would silently break core functionality — rename-permission checks
// in DiscussionPolicy depend on it. Because the column belongs to core, this
// extension must never remove it.

return [
    'up' => function (Builder $schema) {
        if (! $schema->hasColumn('discussions', 'participant_count')) {
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
