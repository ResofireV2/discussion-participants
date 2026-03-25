<?php

namespace Resofire\BlogCards\Console;

use Resofire\BlogCards\Listener\UpdateParticipantPreview;
use Flarum\Discussion\Discussion;
use Illuminate\Console\Command;

/**
 * One-time population command for existing forums.
 *
 * Run once after installing the extension on a forum that already has
 * discussions and posts. New posts after installation are handled
 * automatically by UpdateParticipantPreview.
 *
 * Usage:
 *   php flarum participants:populate
 *   php flarum participants:populate --chunk=200   (default: 100)
 *
 * The command chunks discussion IDs to avoid loading thousands of Eloquent
 * models at once. Each chunk issues one query to the posts table and one
 * DELETE + INSERT on the preview table. Memory usage is O(chunk_size × 6).
 */
class PopulateParticipantPreviews extends Command
{
    protected $signature   = 'participants:populate {--chunk=100 : Discussion IDs processed per batch}';
    protected $description = 'Populate the participant preview table for all existing discussions.';

    public function __construct(
        protected UpdateParticipantPreview $listener
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        $chunkSize = max(1, (int) $this->option('chunk'));
        $total     = Discussion::query()->count();

        if ($total === 0) {
            $this->info('No discussions found. Nothing to do.');
            return self::SUCCESS;
        }

        $this->info("Populating participant previews for {$total} discussions (chunk size: {$chunkSize})…");

        $bar       = $this->output->createProgressBar($total);
        $processed = 0;

        Discussion::query()
            ->select('id')
            ->orderBy('id')
            ->chunk($chunkSize, function ($discussions) use ($bar, &$processed) {
                foreach ($discussions as $discussion) {
                    $this->listener->recompute((int) $discussion->id);
                    $bar->advance();
                    $processed++;
                }
            });

        $bar->finish();
        $this->newLine();
        $this->info("Done. Populated previews for {$processed} discussions.");

        return self::SUCCESS;
    }
}
