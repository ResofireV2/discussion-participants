<?php

use Flarum\Api\Endpoint;
use Flarum\Api\Resource;
use Flarum\Api\Schema;
use Flarum\Discussion\Discussion;
use Flarum\Extend;
use Flarum\User\User;
use Resofire\BlogCards\Api\Controller\RecalculateParticipantsController;
use Resofire\BlogCards\Console\PopulateParticipantPreviews;
use Resofire\BlogCards\Listener\UpdateParticipantPreview;

return [
    (new Extend\Frontend('forum'))
        ->js(__DIR__ . '/js/dist/forum.js')
        ->css(__DIR__ . '/less/forum.less'),

    (new Extend\Frontend('admin'))
        ->js(__DIR__ . '/js/dist/admin.js')
        ->css(__DIR__ . '/less/admin.less'),

    (new Extend\Locales(__DIR__ . '/locale')),

    (new Extend\Settings())
        ->serializeToForum('resofireBlogCardsOnIndexPage', 'resofire_blog_cards_onIndexPage')
        ->default('resofire_blog_cards_onIndexPage', 0)
        ->serializeToForum('resofireBlogCardsTagIds', 'resofire_blog_cards_tagIds')
        ->default('resofire_blog_cards_tagIds', '[]')
        ->serializeToForum('resofireBlogCardsFullWidth', 'resofire_blog_cards_fullWidth')
        ->default('resofire_blog_cards_fullWidth', 0)
        ->serializeToForum('resofireBlogCardsShowParticipants', 'resofire_blog_cards_showParticipants')
        ->default('resofire_blog_cards_showParticipants', 1),

    // Register the participantPreview Eloquent relationship on the Discussion model.
    // This is identical to 1.x — Extend\Model is unchanged in 2.x.
    (new Extend\Model(Discussion::class))
        ->relationship('participantPreview', function (Discussion $discussion) {
            return $discussion
                ->belongsToMany(
                    User::class,
                    'discussion_participant_previews',
                    'discussion_id',
                    'user_id'
                )
                ->withPivot('sort_order')
                ->orderBy('discussion_participant_previews.sort_order');
        }),

    // Flarum 2.x: Extend\ApiController and Extend\ApiSerializer are REMOVED.
    // Relationships and includes are now declared on the resource via Extend\ApiResource.
    (new Extend\ApiResource(Resource\DiscussionResource::class))
        // Add the participantPreview ToMany relationship field so it can be included.
        // The null-user filter (previously in prepareDataForSerialization) is handled
        // by the ->scope() callback on the relationship below.
        ->fields(fn () => [
            Schema\Relationship\ToMany::make('participantPreview')
                ->type('users')
                ->includable()
                // Filter null users so a deleted user's missing row does not
                // crash the JS store — mirrors the 1.x prepareDataForSerialization guard.
                ->scope(function (\Illuminate\Database\Eloquent\Relations\BelongsToMany $query) {
                    $query->whereNotNull('users.id');
                }),
        ])
        // Add firstPost and participantPreview to the Index endpoint's default includes
        // and eager loads. firstPost is already a default include on Show/Create but
        // NOT on Index in core 2.x — it must be added explicitly.
        ->endpoint(Endpoint\Index::class, function (Endpoint\Index $endpoint): Endpoint\Endpoint {
            return $endpoint
                ->addDefaultInclude(['firstPost', 'participantPreview'])
                ->eagerLoad(['participantPreview']);
        }),

    (new Extend\Routes('api'))
        ->get(
            '/resofire/blog-cards/recalculate',
            'resofire.blog-cards.participants.recalculate.get',
            RecalculateParticipantsController::class
        )
        ->post(
            '/resofire/blog-cards/recalculate',
            'resofire.blog-cards.participants.recalculate',
            RecalculateParticipantsController::class
        ),

    (new Extend\Console())
        ->command(PopulateParticipantPreviews::class),

    (new Extend\Event())
        ->subscribe(UpdateParticipantPreview::class),
];
