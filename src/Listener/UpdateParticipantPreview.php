<?php

namespace Resofire\DiscussionParticipants\Listener;

use Flarum\Post\Event\Deleted;
use Flarum\Post\Event\Hidden;
use Flarum\Post\Event\Posted;
use Flarum\Post\Event\Restored;
use Flarum\Post\Post;
use Illuminate\Database\ConnectionInterface;

/**
 * Keeps discussion_participant_previews in sync with the posts table.
 *
 * Registered as an event subscriber (not individual listeners) so that all
 * four handlers live in one class while still being resolved from the
 * container with dependency injection. The subscriber pattern is explicitly
 * documented and supported by Flarum's Event extender via ->subscribe().
 *
 * Handler summary:
 *
 *   Posted    — On the poster's FIRST post in a discussion, insert the poster
 *               into the preview strip if they are a replier and the strip has
 *               room. The OP is never added to the strip — their avatar is
 *               already shown by Flarum in the discussion list item.
 *               Guard: only comment-type, non-hidden posts.
 *
 *   Hidden    — Always recompute. The hidden post's author may be in the
 *               overflow rather than the visible strip, so the guard-based
 *               optimisation would leave the overflow count stale.
 *
 *   Restored  — Always recompute. Same reasoning as Hidden in reverse.
 *
 *   Deleted   — Always recompute. Same reasoning as Hidden.
 *
 * participant_count is owned by Flarum core's DiscussionMetadataUpdater,
 * which keeps it current on live post events. We do NOT touch it in
 * whenPosted() — Flarum overwrites it moments later anyway. However,
 * recompute() DOES write it, using Flarum's identical inclusive formula
 * (all distinct posters including OP), so that batch recalculation corrects
 * any stale values left by older versions of this extension.
 *
 * The JS overflow formula: overflowN = (participantCount - 1) - preview.length,
 * where -1 subtracts the OP who is always shown by Flarum core separately.
 */
class UpdateParticipantPreview
{
    /** Maximum avatars shown in the discussion list strip. */
    public const MAX_PREVIEW = 6;

    public function __construct(
        protected ConnectionInterface $db
    ) {}

    // -------------------------------------------------------------------------
    // Subscriber registration
    // Called by Laravel's event dispatcher when registered via ->subscribe().
    // -------------------------------------------------------------------------

    public function subscribe($events): void
    {
        $events->listen(Posted::class,   [$this, 'whenPosted']);
        $events->listen(Hidden::class,   [$this, 'whenHidden']);
        $events->listen(Restored::class, [$this, 'whenRestored']);
        $events->listen(Deleted::class,  [$this, 'whenDeleted']);
    }

    // -------------------------------------------------------------------------
    // Event handlers
    // -------------------------------------------------------------------------

    public function whenPosted(Posted $event): void
    {
        $post = $event->post;

        // Only visible comment posts create participation.
        if ($post->type !== 'comment' || $post->hidden_at !== null) {
            return;
        }

        $discussionId = (int) $post->discussion_id;
        $userId       = (int) $post->user_id;

        // The OP's avatar is already shown in the discussion list item itself,
        // so we exclude them from the participant strip entirely. One indexed
        // PK lookup on discussions — essentially free, always in buffer pool.
        $opUserId = (int) $this->db->table('discussions')
            ->where('id', $discussionId)
            ->value('user_id');

        // Check if this user has already posted in this discussion.
        // If so, they are already counted — nothing to do regardless of whether
        // they are the OP or a replier.
        $alreadyPosted = $this->db->table('posts')
            ->where('discussion_id', $discussionId)
            ->where('user_id', $userId)
            ->where('type', 'comment')
            ->whereNull('hidden_at')
            ->where('id', '!=', $post->id)
            ->exists();

        if ($alreadyPosted) {
            return;
        }

        // First post by this user in this discussion.
        // If they are the OP, they are already a participant — the discussion
        // itself is their first post. Never increment for them here.
        if ($userId === $opUserId) {
            return;
        }

        // Replier: insert into the preview strip if it has room.
        // We re-check inside a transaction to close the race window where two
        // concurrent first-posters both pass the outer guard and both attempt
        // to insert. sort_order = currentCount is correct by definition.
        // insertOrIgnore guards against any unforeseen duplicate on the PK.
        $this->db->transaction(function () use ($discussionId, $userId) {
            $currentCount = $this->db->table('discussion_participant_previews')
                ->where('discussion_id', $discussionId)
                ->count();

            if ($currentCount < self::MAX_PREVIEW) {
                $this->db->table('discussion_participant_previews')->insertOrIgnore([
                    'discussion_id' => $discussionId,
                    'user_id'       => $userId,
                    'sort_order'    => $currentCount,
                ]);
            }

            // participant_count is owned by Flarum core's DiscussionMetadataUpdater,
            // which overwrites it with its own full count on every post event.
            // We do not touch it here — our overflow calculation uses Flarum's
            // value directly via the adjusted formula: (participantCount - 1) - preview.length.
        });
    }

    public function whenHidden(Hidden $event): void
    {
        $post = $event->post;

        if ($post->type !== 'comment') {
            return;
        }

        // Always recompute — the hidden post's author may be in the overflow
        // rather than the visible strip, but participant_count still needs to
        // reflect the change regardless of where they appear in the UI.
        $this->recompute((int) $post->discussion_id);
    }

    public function whenRestored(Restored $event): void
    {
        $post = $event->post;

        if ($post->type !== 'comment') {
            return;
        }

        // Always recompute — the restored post's author may have been in the
        // overflow before being hidden, and needs to be reinstated correctly
        // regardless of whether they were in the visible strip.
        $this->recompute((int) $post->discussion_id);
    }

    public function whenDeleted(Deleted $event): void
    {
        $post = $event->post;

        if ($post->type !== 'comment') {
            return;
        }

        // Always recompute — same reasoning as whenHidden: the deleted post's
        // author may be in the overflow rather than the visible strip.
        $this->recompute((int) $post->discussion_id);
    }

    // -------------------------------------------------------------------------
    // Core recompute logic
    // -------------------------------------------------------------------------

    /**
     * Atomically recompute the preview rows for a single discussion.
     *
     * Fetches the first MAX_PREVIEW distinct *repliers* (the original poster is
     * excluded — their avatar is already shown in the discussion list item)
     * ordered by their earliest visible post, then replaces the preview rows
     * in a single database transaction (DELETE + INSERT).
     *
     * Because this runs inside a transaction, concurrent calls for the same
     * discussion will serialize at the DB level — one will wait for the other
     * to commit before proceeding. The final state will always reflect the
     * correct set of participants regardless of ordering.
     *
     * Called by the console command's chunk loop as well as all four event
     * handlers above.
     */
    public function recompute(int $discussionId): void
    {
        $prefix = $this->db->getTablePrefix();

        // Recompute participant_count using Flarum's own inclusive formula: all
        // distinct users who have a visible comment post in this discussion,
        // including the OP. This matches exactly what DiscussionMetadataUpdater
        // stores on live post events via Discussion::refreshParticipantCount().
        // We must write this during recalculation because old discussions may
        // have our previous extension's value (repliers only, OP excluded) still
        // stored, which would make the JS overflow formula produce wrong results.
        $participantCount = (int) $this->db->table('posts')
            ->where('discussion_id', $discussionId)
            ->where('type', 'comment')
            ->where('is_private', false)
            ->whereNull('hidden_at')
            ->whereNotNull('user_id')
            ->distinct()
            ->count('user_id');

        // First MAX_PREVIEW repliers ordered by their earliest post.
        // The OP is excluded inline by joining discussions and filtering out
        // posts where user_id = discussions.user_id — no separate OP lookup needed.
        $participants = $this->db->table('posts')
            ->select('posts.user_id')
            ->selectRaw('MIN(`'.$prefix.'posts`.`created_at`) as first_post_at')
            ->join('discussions', 'discussions.id', '=', 'posts.discussion_id')
            ->where('posts.discussion_id', $discussionId)
            ->where('posts.type', 'comment')
            ->whereNull('posts.hidden_at')
            ->whereNotNull('posts.user_id')
            ->whereRaw('`'.$prefix.'posts`.`user_id` != `'.$prefix.'discussions`.`user_id`')
            ->groupBy('posts.user_id')
            ->orderBy('first_post_at')
            ->limit(self::MAX_PREVIEW)
            ->get();

        $this->db->transaction(function () use ($discussionId, $participants, $participantCount) {
            $this->db->table('discussion_participant_previews')
                ->where('discussion_id', $discussionId)
                ->delete();

            $rows = $participants->values()->map(function ($row, $index) use ($discussionId) {
                return [
                    'discussion_id' => $discussionId,
                    'user_id'       => (int) $row->user_id,
                    'sort_order'    => $index,
                ];
            })->all();

            if (!empty($rows)) {
                $this->db->table('discussion_participant_previews')->insert($rows);
            }

            // Sync participant_count to Flarum's inclusive formula (all distinct
            // posters including OP, visible comments only). This corrects any
            // stale values left by our previous extension version.
            // On live post events Flarum core keeps this up to date itself.
            $this->db->table('discussions')
                ->where('id', $discussionId)
                ->update(['participant_count' => $participantCount]);
        });
    }
}
