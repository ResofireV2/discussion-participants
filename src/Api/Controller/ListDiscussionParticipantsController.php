<?php

namespace Resofire\DiscussionParticipants\Api\Controller;

use Resofire\DiscussionParticipants\Api\Serializer\ParticipantUserSerializer;
use Resofire\DiscussionParticipants\Dto\ParticipantUser;
use Flarum\Api\Controller\AbstractListController;
use Flarum\Discussion\Discussion;
use Flarum\Http\RequestUtil;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Psr\Http\Message\ServerRequestInterface;
use Tobscure\JsonApi\Document;

/**
 * GET /api/discussions/{id}/participants
 *
 * Returns a paginated list of users who have participated in a discussion,
 * ordered by their first visible post date (oldest first).
 *
 * Pagination via AbstractListController's built-in extractLimit/extractOffset,
 * which read page[number] and page[size] per JSON:API convention and enforce
 * the $limit/$maxLimit properties declared below.
 *
 * Route parameter access: Flarum merges route parameters into query params,
 * so {id} from the route path is available via $request->getQueryParams()['id'].
 * This is the documented approach in the Flarum 1.x routes documentation.
 * Do NOT use $request->getAttribute('routeParameters') — that is not the
 * documented API for Flarum 1.x controllers.
 *
 * Serializer type: 'discussion-participants' (not 'users').
 * Using 'users' would cause the frontend store to merge these minimal objects
 * into fully-loaded User models, silently stripping their attributes.
 *
 * Permission: Discussion::whereVisibleTo($actor) enforces Flarum's visibility
 * scopes — private discussions, approval queues, etc. are all respected.
 */
class ListDiscussionParticipantsController extends AbstractListController
{
    public $serializer = ParticipantUserSerializer::class;

    // These two properties are enforced by AbstractListController's
    // extractLimit() method. They must be set here — the controller's own
    // manual min/max logic was bypassed in the previous version.
    public $limit    = 10;
    public $maxLimit = 10;

    public $include = [];

    public function __construct(
        protected ConnectionInterface $db
    ) {}

    protected function data(ServerRequestInterface $request, Document $document): Collection
    {
        $actor = RequestUtil::getActor($request);

        // Documented route parameter access for Flarum 1.x:
        // Route parameters are merged into query params. Use getQueryParams().
        $discussionId = (int) Arr::get($request->getQueryParams(), 'id');

        // AbstractListController::extractLimit reads page[limit], extractOffset reads page[offset].
        $limit  = $this->extractLimit($request);
        $offset = $this->extractOffset($request);

        // Verify the discussion exists and the actor can view it.
        $discussion = Discussion::whereVisibleTo($actor)->findOrFail($discussionId);

        // Count total distinct participants for the meta block.
        $total = (int) $this->db->table('posts')
            ->where('discussion_id', $discussion->id)
            ->where('type', 'comment')
            ->whereNull('hidden_at')
            ->whereNotNull('user_id')
            ->distinct()
            ->count('user_id');

        // Fetch paginated participants ordered by first post date.
        // Raw DB query — we do not hydrate full Eloquent User models.
        //
        // IMPORTANT: Do NOT use table aliases with selectRaw when a table prefix
        // is set. The query builder prefixes BOTH sides of 'posts as p', making
        // the actual alias '{prefix}p'. A raw MIN(`p`.`created_at`) then fails
        // because the real alias is e.g. `brfp`. Solution: no alias; use the
        // full prefixed table name in the raw expression via getTablePrefix().
        //
        // Flarum column names: 'created_at' (not 'time'), 'hidden_at' (not 'hide_time').
        // 'display_name' does not exist in all Flarum versions — use 'username'.
        $prefix = $this->db->getTablePrefix();
        $rows = $this->db->table('posts')
            ->join('users', 'users.id', '=', 'posts.user_id')
            ->select('users.id', 'users.username', 'users.avatar_url', 'users.preferences')
            ->selectRaw('MIN(`'.$prefix.'posts`.`created_at`) as first_post_at')
            ->where('posts.discussion_id', $discussion->id)
            ->where('posts.type', 'comment')
            ->whereNull('posts.hidden_at')
            ->whereNotNull('posts.user_id')
            ->groupBy('users.id', 'users.username', 'users.avatar_url', 'users.preferences')
            ->orderBy('first_post_at')
            ->offset($offset)
            ->limit($limit)
            ->get();

        $document->setMeta([
            'total'  => $total,
            'offset' => $offset,
            'limit'  => $limit,
        ]);

        // Map raw rows to ParticipantUser DTOs.
        // No Eloquent model construction — no slug driver, no getKey(), no
        // dirty attributes, no fillable guards. Just plain PHP objects.
        return $rows->map(function ($row) {
            // Flarum stores the letter-avatar background color in the user's
            // preferences JSON under the key 'avatarColor'.
            $prefs = $row->preferences ? json_decode($row->preferences, true) : [];
            $color = $prefs['avatarColor'] ?? null;

            return new ParticipantUser(
                id:          (int) $row->id,
                username:    $row->username,
                slug:        $row->username,
                avatarUrl:   $row->avatar_url,
                displayName: $row->username,
                color:       is_string($color) ? $color : null,
            );
        });
    }
}
