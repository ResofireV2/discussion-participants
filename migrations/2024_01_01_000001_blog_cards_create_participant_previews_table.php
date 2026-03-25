<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

return [
    'up' => function (Builder $schema) {
        // Only create if not already present — discussion-participants creates
        // the same table. Whichever extension runs first wins; the second skips.
        if ($schema->hasTable('discussion_participant_previews')) {
            return;
        }

        $schema->create('discussion_participant_previews', function (Blueprint $table) {
            $table->unsignedBigInteger('discussion_id');
            $table->unsignedBigInteger('user_id');
            $table->unsignedTinyInteger('sort_order');

            $table->primary(['discussion_id', 'user_id']);
            $table->index(['discussion_id', 'sort_order'], 'idx_dpp_discussion_order');
        });
    },

    'down' => function (Builder $schema) {
        // Do not drop — discussion-participants may own this table.
        // Dropping is handled by that extension's own migration rollback.
    },
];
