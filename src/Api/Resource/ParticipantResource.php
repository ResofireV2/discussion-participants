<?php

namespace Resofire\DiscussionParticipants\Api\Resource;

use Flarum\Api\Context;
use Flarum\Api\Resource\AbstractResource;
use Flarum\Api\Schema;
use Flarum\Api\Endpoint;
use Flarum\Http\RequestUtil;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Collection;
use Tobscure\JsonApi\Document;

/**
 * Read-only resource that lists participants for a single discussion.
 *
 * In 2.x the AbstractResource / AbstractDatabaseResource pattern replaces
 * the old controller + serializer + DTO combination. Because our data is not
 * a standard Eloquent model (it is a lightweight projection of user rows),
 * we extend AbstractResource directly rather than AbstractDatabaseResource.
 *
 * Route: GET /api/discussions/{id}/participants?page[offset]=N&page[limit]=10
 *
 * Returns a JSON:API collection of user-like objects with only the fields
 * needed to render the modal list: id, username, slug, avatarUrl.
 * No full UserSerializer is used — keeping payloads minimal.
 */
class ParticipantResource extends AbstractResource
{
    public function __construct(
        protected ConnectionInterface $db
    ) {}

    public function type(): string
    {
        return 'discussion-participants';
    }

    public function endpoints(): array
    {
        return [
            Endpoint\Index::make()
                ->authenticated(false),
        ];
    }

    public function fields(): array
    {
        return [
            Schema\Str::make('username'),
            Schema\Str::make('slug'),
            Schema\Str::make('avatarUrl')->nullable(),
        ];
    }

    /**
     * Return the paginated list of participants for the requested discussion.
     *
     * The discussion ID is extracted from the route parameter. Participants
     * are all distinct users (including the OP) who have at least one visible
     * comment post, ordered by their first post date ascending.
     */
    public function index(Context $context): iterable|object
    {
        $request  = $context->request;
        $actor    = RequestUtil::getActor($request);
        $queryParams = $request->getQueryParams();

        $discussionId = (int) $request->getAttribute('discussionId');

        // Pagination — default 10 per page, maximum 20.
        $pageParams = $queryParams['page'] ?? [];
        $limit  = min((int) ($pageParams['limit']  ?? 10), 20);
        $offset = max((int) ($pageParams['offset'] ?? 0),  0);

        // Total distinct participants (all users with visible comment posts).
        $total = (int) $this->db->table('posts')
            ->where('discussion_id', $discussionId)
            ->where('type', 'comment')
            ->where('is_private', false)
            ->whereNull('hidden_at')
            ->whereNotNull('user_id')
            ->distinct()
            ->count('user_id');

        // Fetch a page of participants ordered by first post date.
        $rows = $this->db->table('posts')
            ->select('users.id', 'users.username', 'users.slug', 'users.avatar_url')
            ->join('users', 'users.id', '=', 'posts.user_id')
            ->where('posts.discussion_id', $discussionId)
            ->where('posts.type', 'comment')
            ->where('posts.is_private', false)
            ->whereNull('posts.hidden_at')
            ->whereNotNull('posts.user_id')
            ->groupBy('users.id', 'users.username', 'users.slug', 'users.avatar_url')
            ->orderByRaw('MIN(posts.created_at)')
            ->limit($limit)
            ->offset($offset)
            ->get();

        // Build lightweight objects that the fields() schema can serialize.
        $results = $rows->map(function ($row) {
            $obj             = new \stdClass();
            $obj->id         = (string) $row->id;
            $obj->username   = $row->username;
            $obj->slug       = $row->slug;
            $obj->avatarUrl  = $row->avatar_url;
            return $obj;
        });

        // Attach pagination meta so the JS modal can drive prev/next buttons.
        $context->document->setMeta([
            'total'  => $total,
            'offset' => $offset,
            'limit'  => $limit,
        ]);

        return $results;
    }
}
