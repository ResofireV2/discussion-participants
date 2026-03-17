<?php

use Flarum\Extend;
use Flarum\Api\Resource\DiscussionResource;
use Resofire\DiscussionParticipants\Api\Resource\ParticipantResource;
use Resofire\DiscussionParticipants\Api\Controller\RecalculateParticipantsController;
use Resofire\DiscussionParticipants\Console\PopulateParticipantPreviews;
use Resofire\DiscussionParticipants\Listener\UpdateParticipantPreview;

return [
    // Migrations
    (new Extend\Migration()),

    // Event subscriber: keeps preview table in sync with posts.
    (new Extend\Event())
        ->subscribe(UpdateParticipantPreview::class),

    // Expose participantPreview relationship on the Discussion resource.
    // In 2.x the removed ApiSerializer extender is replaced by extending
    // the DiscussionResource directly using the ApiResource extender.
    (new Extend\ApiResource(DiscussionResource::class))
        ->fields(fn () => [
            \Flarum\Api\Schema\Relationship\ToMany::make('participantPreview')
                ->type('users')
                ->includable(),
        ]),

    // Register our custom participant list resource.
    (new Extend\ApiResource(ParticipantResource::class)),

    // Routes
    (new Extend\Routes('api'))
        ->get(
            '/discussions/{discussionId}/participants',
            'resofire.discussions.participants',
            ParticipantResource::class
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

    // Console command for CLI backfill.
    (new Extend\Console())
        ->command(PopulateParticipantPreviews::class),

    // Frontend assets.
    (new Extend\Frontend('forum'))
        ->js(__DIR__ . '/js/dist/forum.js')
        ->css(__DIR__ . '/less/forum.less'),

    (new Extend\Frontend('admin'))
        ->js(__DIR__ . '/js/dist/admin.js'),

    // Translations.
    (new Extend\Locales(__DIR__ . '/locale')),
];
