<?php

namespace Resofire\BlogCards\Api\Controllers;

use Flarum\Http\RequestUtil;
use Flarum\Tags\Tag;
use Flarum\User\Exception\PermissionDeniedException;
use Illuminate\Contracts\Filesystem\Factory;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;
use Intervention\Image\ImageManager;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * POST /api/resofire/blog-cards/upload-tag-image
 *
 * Uploads a per-tag default card image.
 *
 * Ported to Flarum 2.x:
 *   - No longer extends ShowForumController
 *   - Flysystem 1.x Adapter\Local / MountManager replaced with Laravel Filesystem (Flysystem 3.x)
 *   - Intervention\Image 3.x API
 */
class UploadTagImageController implements RequestHandlerInterface
{
    protected Filesystem $uploadDir;

    public function __construct(
        protected ImageManager $imageManager,
        Factory $filesystemFactory
    ) {
        $this->uploadDir = $filesystemFactory->disk('flarum-assets');
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);

        if (! $actor->isAdmin()) {
            throw new PermissionDeniedException();
        }

        $file  = Arr::get($request->getUploadedFiles(), 'resofire_blog_cards_tag_image');
        $tagId = Arr::get($request->getParsedBody(), 'tagId');

        $tag = Tag::findOrFail($tagId);

        $tmpPath = $file->getStream()->getMetadata('uri');

        $encodedImage = $this->imageManager
            ->read($tmpPath)
            ->scaleDown(width: 400)
            ->toPng();

        // Delete the previous tag image if one exists.
        $existingPath = $tag->resofire_blog_cards_tag_image;
        if ($existingPath && $this->uploadDir->exists($existingPath)) {
            $this->uploadDir->delete($existingPath);
        }

        $uploadName = 'blog-cards-tag-' . $tagId . '-' . Str::lower(Str::random(8)) . '.png';

        $this->uploadDir->put($uploadName, $encodedImage);

        $tag->resofire_blog_cards_tag_image = $uploadName;
        $tag->save();

        return new JsonResponse([
            'status' => 'success',
            'path'   => $uploadName,
        ]);
    }
}
