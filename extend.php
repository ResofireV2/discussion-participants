<?php

use Resofire\DiscussionParticipants\Api\Controller\ListDiscussionParticipantsController;
use Resofire\DiscussionParticipants\Api\Controller\RecalculateParticipantsController;
use Resofire\DiscussionParticipants\Console\PopulateParticipantPreviews;
use Resofire\DiscussionParticipants\Listener\UpdateParticipantPreview;
use Flarum\Extend;


return [
    // -------------------------------------------------------------------------
    // Frontend assets
    // -------------------------------------------------------------------------
    (new Extend\Frontend('forum'))
        ->js(__DIR__ . '/js/dist/forum.js')
        ->css(__DIR__ . '/less/forum.less'),

    (new Extend\Frontend('admin'))
        ->js(__DIR__ . '/js/dist/admin.js'),

    new Extend\Locales(__DIR__ . '/locale'),

    // -------------------------------------------------------------------------
    // Console command (one-time backfill for existing forums)
    //
    // Run once after installation:
    //   php flarum participants:populate
    //   php flarum participants:populate --chunk=200
    //
    // New posts after installation are handled by the event listener below.
    // -------------------------------------------------------------------------
    (new Extend\Console())
        ->command(PopulateParticipantPreviews::class),

    // -------------------------------------------------------------------------
    // Event subscriber: keeps preview table in sync with posts.
    //
    // Uses ->subscribe() rather than four ->listen() calls. The subscriber
    // pattern is the documented Flarum approach for grouping multiple event
    // handlers in one class. UpdateParticipantPreview::subscribe() registers
    // all four handlers internally.
    //
    // Posted   — recompute if preview has room and user is new to it
    // Hidden   — recompute if the hidden author was in the preview
    // Restored — recompute if the restored author is not yet in the preview
    // Deleted  — recompute if the deleted author was in the preview
    //
    // All paths go through the transactional recompute() — no race conditions.
    // -------------------------------------------------------------------------
    (new Extend\Event())
        ->subscribe(UpdateParticipantPreview::class),

    // -------------------------------------------------------------------------
    // New API route: paginated participant list for the modal
    //
    // GET /api/discussions/{id}/participants
    //   ?page[offset]=0&page[limit]=20
    //
    // Returns minimal user data (id, username, slug, avatarUrl, displayName).
    // The modal paginates rather than loading all participants at once.
    // Permission: uses Discussion::whereVisibleTo($actor) inside the controller.
    // -------------------------------------------------------------------------
    (new Extend\Routes('api'))
        ->get(
            '/discussions/{id}/participants',
            'resofire.discussions.participants',
            ListDiscussionParticipantsController::class
        )
        ->get(
            '/resofire/participants/recalculate',
            'resofire.participants.recalculate.get',
            RecalculateParticipantsController::class
        )
        ->post(
            '/resofire/participants/recalculate',
            'resofire.participants.recalculate',
            RecalculateParticipantsController::class
        ),

    // -------------------------------------------------------------------------
    // Discussion list: participantPreview from the bounded preview table
    //
    // The relationship reads from discussion_participant_previews (max 6 rows
    // per discussion) rather than doing a full posts JOIN with no LIMIT.
    //
    // Query on list page:
    //   SELECT users.*
    //   FROM users
    //   INNER JOIN discussion_participant_previews dpp ON dpp.user_id = users.id
    //   WHERE dpp.discussion_id IN (?, ?, ...)
    //   ORDER BY dpp.sort_order
    //
    // 20 discussions x 6 = 120 rows max. Always bounded.
    // -------------------------------------------------------------------------
    (new Extend\Model(\Flarum\Discussion\Discussion::class))
        ->relationship('participantPreview', function (\Flarum\Discussion\Discussion $discussion) {
            return $discussion
                ->belongsToMany(
                    \Flarum\User\User::class,
                    'discussion_participant_previews',
                    'discussion_id',
                    'user_id'
                )
                ->withPivot('sort_order')
                ->orderBy('discussion_participant_previews.sort_order');
        }),

    (new Extend\ApiSerializer(\Flarum\Api\Serializer\DiscussionSerializer::class))
        ->hasMany('participantPreview', \Flarum\Api\Serializer\UserSerializer::class),

    (new Extend\ApiController(\Flarum\Api\Controller\ListDiscussionsController::class))
        ->addInclude('participantPreview')
        ->load(['participantPreview']),

    // No prepareDataForSerialization needed: the preview table is bounded at
    // write time. No PHP trim needed, no full hydration, no memory spike.
    //
    // No ShowDiscussionController block needed: the modal uses the dedicated
    // paginated endpoint above instead of a single massive include.
];
