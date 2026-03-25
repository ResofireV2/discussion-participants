<?php

namespace Resofire\BlogCards\Api\Controller;

use Resofire\BlogCards\Listener\UpdateParticipantPreview;
use Flarum\Http\RequestUtil;
use Flarum\User\Exception\PermissionDeniedException;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * POST /api/resofire/participants/recalculate
 *
 * Chunked recalculation endpoint. Processes one slice of discussions per
 * request so that no single request exceeds the server's PHP/web timeout.
 *
 * Request body (JSON):
 *   { "offset": 0, "limit": 2000 }
 *
 * Response:
 *   {
 *     "recomputed":    2000,   // discussions processed in this chunk
 *     "total":         8432,   // total discussions on the forum
 *     "offset":        0,      // echo of the requested offset
 *     "limit":         2000,   // echo of the requested limit
 *     "duration_ms":   4210
 *   }
 *
 * The frontend calls this endpoint repeatedly, incrementing offset by limit
 * each time, until offset + recomputed >= total.
 *
 * GET /api/resofire/participants/recalculate (same route, different method)
 * is handled by returning only { "total": N } so the frontend can initialise
 * the progress bar before the first chunk fires.
 */
class RecalculateParticipantsController implements RequestHandlerInterface
{
    /** Discussions processed per chunk. Kept low enough to stay under 60 s. */
    public const CHUNK_SIZE = 2000;

    public function __construct(
        protected ConnectionInterface      $db,
        protected UpdateParticipantPreview $listener
    ) {}

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        if (! $actor->isAdmin()) {
            throw new PermissionDeniedException();
        }

        $total = (int) $this->db->table('discussions')->count();

        // GET → return total only (used by frontend to initialise progress bar).
        if ($request->getMethod() === 'GET') {
            return new JsonResponse(['total' => $total]);
        }

        // POST → process one chunk.
        $body   = $request->getParsedBody() ?? [];
        $offset = (int) Arr::get($body, 'offset', 0);
        $limit  = (int) Arr::get($body, 'limit', self::CHUNK_SIZE);

        // Clamp limit to a safe maximum so a rogue client cannot request an
        // unbounded chunk that would still time out.
        $limit = min($limit, self::CHUNK_SIZE);

        $start      = microtime(true);
        $recomputed = 0;

        $this->db->table('discussions')
            ->orderBy('id')
            ->offset($offset)
            ->limit($limit)
            ->get(['id'])
            ->each(function ($discussion) use (&$recomputed) {
                $this->listener->recompute((int) $discussion->id);
                $recomputed++;
            });

        $durationMs = (int) round((microtime(true) - $start) * 1000);

        return new JsonResponse([
            'recomputed'  => $recomputed,
            'total'       => $total,
            'offset'      => $offset,
            'limit'       => $limit,
            'duration_ms' => $durationMs,
        ]);
    }
}
