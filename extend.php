<?php

use Flarum\Api\Endpoint;
use Flarum\Api\Resource\DiscussionResource;
use Flarum\Api\Schema;
use Flarum\Extend;
use Resofire\DiscussionParticipants\Api\Controller\ListDiscussionParticipantsController;
use Resofire\DiscussionParticipants\Api\Controller\RecalculateParticipantsController;
use Resofire\DiscussionParticipants\Console\PopulateParticipantPreviews;
use Resofire\DiscussionParticipants\Listener\UpdateParticipantPreview;


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
    // -------------------------------------------------------------------------
    (new Extend\Event())
        ->subscribe(UpdateParticipantPreview::class),

    // -------------------------------------------------------------------------
    // New API route: paginated participant list for the modal
    //
    // GET /api/discussions/{id}/participants
    //   ?page[offset]=0&page[limit]=20
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
    // Discussion list: participantPreview relationship and eager loading.
    //
    // Replaces the 1.x ApiSerializer + ApiController extenders.
    //
    // The Eloquent belongsToMany definition on Discussion is unchanged (still
    // registered via Extend\Model below). This block wires the relationship
    // into the JSON:API layer so it is serialized and included by default on
    // the discussion list endpoint.
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

    (new Extend\ApiResource(DiscussionResource::class))
        ->fields(fn () => [
            Schema\Relationship\ToMany::make('participantPreview')
                ->type('users')
                ->includable(),
        ])
        ->endpoint(
            Endpoint\Index::class,
            fn (Endpoint\Index $endpoint): Endpoint\Endpoint => $endpoint
                ->addDefaultInclude(['participantPreview'])
                ->eagerLoad(['participantPreview'])
        ),
];
