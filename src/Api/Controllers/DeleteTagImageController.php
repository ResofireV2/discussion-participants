<?php

namespace Resofire\BlogCards\Api\Controllers;

use Flarum\Api\Controller\AbstractDeleteController;
use Flarum\Http\RequestUtil;
use Flarum\Tags\Tag;
use Flarum\User\Exception\PermissionDeniedException;
use Illuminate\Contracts\Filesystem\Factory;
use Illuminate\Contracts\Filesystem\Filesystem;
use Psr\Http\Message\ServerRequestInterface;

/**
 * DELETE /api/resofire/blog-cards/upload-tag-image
 *
 * Deletes a per-tag default card image.
 *
 * Ported to Flarum 2.x:
 *   - AbstractDeleteController still exists in 2.x unchanged.
 *   - Flysystem 1.x Adapter\Local replaced with Laravel Filesystem (Flysystem 3.x).
 *   - Column name updated from walsgit_discussion_cards_tag_default_image
 *     to resofire_blog_cards_tag_image for namespace consistency.
 */
class DeleteTagImageController extends AbstractDeleteController
{
    protected Filesystem $uploadDir;

    public function __construct(Factory $filesystemFactory)
    {
        $this->uploadDir = $filesystemFactory->disk('flarum-assets');
    }

    protected function delete(ServerRequestInterface $request): void
    {
        $actor = RequestUtil::getActor($request);

        if (! $actor->isAdmin()) {
            throw new PermissionDeniedException();
        }

        $tagId = $request->getParsedBody()['tagId'] ?? null;
        $tag   = Tag::findOrFail($tagId);

        $path = $tag->resofire_blog_cards_tag_image;

        $tag->resofire_blog_cards_tag_image = null;
        $tag->save();

        if ($path && $this->uploadDir->exists($path)) {
            $this->uploadDir->delete($path);
        }
    }
}
