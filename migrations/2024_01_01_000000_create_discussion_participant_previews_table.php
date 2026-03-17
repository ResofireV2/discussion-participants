<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

// Creates the discussion_participant_previews table.
//
// This table stores the first 6 participants per discussion (ordered by their
// first post in that discussion). It is written once when a new participant
// joins a discussion, and read on every discussion list page load.
//
// Read profile:  SELECT 6 rows per discussion, integer PK join to users.
//                20 discussions = 120 rows maximum. Always bounded.
//
// Write profile: INSERT or DELETE triggered by post events only (rare vs reads).
//
// The `sort_order` column preserves the chronological order of first posts so
// the same 6 avatars are shown consistently on every page load.

return [
    'up' => function (Builder $schema) {
        // Drop first in case a previous failed migration attempt left a partial table.
        $schema->dropIfExists('discussion_participant_previews');

        $schema->create('discussion_participant_previews', function (Blueprint $table) {
            $table->unsignedBigInteger('discussion_id');
            $table->unsignedBigInteger('user_id');
            // 0-based position ordered by the user's first post date in this discussion.
            // Only values 0–5 are stored (MAX_PREVIEW = 6).
            $table->unsignedTinyInteger('sort_order');

            $table->primary(['discussion_id', 'user_id']);

            // The primary read path: fetch all previews for a set of discussion IDs
            // ordered by sort_order. This index covers the query exactly.
            $table->index(['discussion_id', 'sort_order'], 'idx_dpp_discussion_order');

            // Note: foreign keys are intentionally omitted. MySQL requires the exact
            // prefixed table name in the constraint, which breaks on Flarum installs
            // that use a database table prefix (e.g. 'brf'). Referential integrity is
            // handled at the application level by Flarum's own cascade logic.
        });
    },

    'down' => function (Builder $schema) {
        $schema->dropIfExists('discussion_participant_previews');
    },
];
