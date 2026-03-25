<?php

namespace Resofire\DiscussionParticipants\Api\Controller;

use Flarum\Api\JsonApiResponse;
use Flarum\Discussion\Discussion;
use Flarum\Http\RequestUtil;
use Illuminate\Contracts\Filesystem\Factory as FilesystemFactory;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Arr;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Resofire\DiscussionParticipants\Dto\ParticipantUser;

/**
 * GET /api/discussions/{id}/participants
 *
 * Returns a paginated JSON:API document of users who have participated in a
 * discussion, ordered by their first visible post date (oldest first).
 *
 * Pagination: reads page[limit] and page[offset] from query params directly.
 * Default limit 10, max limit 10 — enforced here rather than by a base class.
 *
 * Route parameter access: Flarum merges route parameters into query params,
 * so {id} from the route path is available via getQueryParams()['id'].
 *
 * Response type: 'discussion-participants' (not 'users').
 * Using 'users' would cause the frontend store to merge these minimal objects
 * into fully-loaded User models, silently stripping their attributes.
 *
 * Permission: Discussion::whereVisibleTo($actor) enforces Flarum's visibility
 * scopes — private discussions, approval queues, etc. are all respected.
 *
 * Avatar URL resolution: uses the 'flarum-avatars' filesystem disk, mirroring
 * exactly what User::getAvatarUrlAttribute() does in 2.x. This correctly
 * handles local storage, S3, and any other configured filesystem driver
 * without hardcoding the base URL.
 */
class ListDiscussionParticipantsController implements RequestHandlerInterface
{
    private const DEFAULT_LIMIT = 10;
    private const MAX_LIMIT     = 10;

    public function __construct(
        protected ConnectionInterface $db,
        protected FilesystemFactory   $filesystem,
    ) {}

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $params = $request->getQueryParams();

        // Route parameters are merged into query params in Flarum.
        $discussionId = (int) Arr::get($params, 'id');

        // PSR-7 parses page[limit]=10 as $params['page']['limit'] — a nested array,
        // not a dot-notation key. Arr::get() with dots would never find these.
        $limit  = min((int) ($params['page']['limit']  ?? self::DEFAULT_LIMIT), self::MAX_LIMIT);
        $offset = max((int) ($params['page']['offset'] ?? 0), 0);

        // Verify the discussion exists and the actor can view it.
        $discussion = Discussion::whereVisibleTo($actor)->findOrFail($discussionId);

        // Total distinct participants for the meta block.
        $total = (int) $this->db->table('posts')
            ->where('discussion_id', $discussion->id)
            ->where('type', 'comment')
            ->whereNull('hidden_at')
            ->whereNotNull('user_id')
            ->distinct()
            ->count('user_id');

        // Paginated participants ordered by first post date.
        // Raw DB query — we do not hydrate full Eloquent User models.
        //
        // Do NOT use table aliases with selectRaw when a table prefix is set.
        // The query builder prefixes BOTH sides of 'posts as p', making the
        // actual alias '{prefix}p'. A raw MIN(`p`.`created_at`) then fails.
        // Solution: no alias; reference the full prefixed table name via
        // getTablePrefix() in the raw expression.
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

        // Map raw rows to ParticipantUser DTOs, then to JSON:API resource
        // objects. No Eloquent model construction — no slug driver, no
        // getKey(), no fillable guards.
        $data = $rows->map(function ($row) {
            $prefs = $row->preferences ? json_decode($row->preferences, true) : [];
            $color = $prefs['avatarColor'] ?? null;

            $dto = new ParticipantUser(
                id:          (int) $row->id,
                username:    $row->username,
                slug:        $row->username,
                avatarUrl:   $this->resolveAvatarUrl($row->avatar_url),
                displayName: $row->username,
                color:       is_string($color) ? $color : null,
            );

            return [
                'type'       => 'discussion-participants',
                'id'         => (string) $dto->id,
                'attributes' => [
                    'userId'      => $dto->id,
                    'username'    => $dto->username,
                    'slug'        => $dto->slug,
                    'avatarUrl'   => $dto->avatarUrl,
                    'displayName' => $dto->displayName,
                    'color'       => $dto->color,
                ],
            ];
        })->values()->all();

        return new JsonApiResponse([
            'data' => $data,
            'meta' => [
                'total'  => $total,
                'offset' => $offset,
                'limit'  => $limit,
            ],
        ]);
    }

    /**
     * Resolve an avatar URL the same way User::getAvatarUrlAttribute() does
     * in Flarum 2.x: relative paths go through the 'flarum-avatars' filesystem
     * disk so that S3, CDN, and local storage are all handled correctly.
     */
    private function resolveAvatarUrl(?string $avatarUrl): ?string
    {
        if ($avatarUrl === null || $avatarUrl === '') {
            return null;
        }

        if (str_contains($avatarUrl, '://')) {
            return $avatarUrl;
        }

        return $this->filesystem->disk('flarum-avatars')->url($avatarUrl);
    }
}
