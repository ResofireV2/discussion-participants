<?php

namespace Resofire\BlogCards\Api\Controllers;

use Flarum\Http\RequestUtil;
use Flarum\Settings\SettingsRepositoryInterface;
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
 * POST /api/resofire/blog-cards/upload-image
 *
 * Uploads a default card image for use as a placeholder.
 *
 * Ported to Flarum 2.x:
 *   - No longer extends ShowForumController (constructor signature changed in 2.x)
 *   - Flysystem 1.x Adapter\Local / MountManager replaced with Laravel's Filesystem
 *     abstraction backed by Flysystem 3.x (League\Flysystem\Local\LocalFilesystemAdapter)
 *   - Intervention\Image 2.x ImageManagerStatic::make()->encode() replaced with
 *     ImageManager (3.x) ->read()->scaleDown()->toPng()
 */
class UploadImageController implements RequestHandlerInterface
{
    protected Filesystem $uploadDir;

    public function __construct(
        protected SettingsRepositoryInterface $settings,
        protected ImageManager $imageManager,
        Factory $filesystemFactory
    ) {
        // 'flarum-assets' disk maps to the public/assets directory.
        // This is the same disk used by core's UploadLogoController etc.
        $this->uploadDir = $filesystemFactory->disk('flarum-assets');
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);

        if (! $actor->isAdmin()) {
            throw new PermissionDeniedException();
        }

        $file = Arr::get($request->getUploadedFiles(), 'resofire_blog_cards_default_image');

        // Read the uploaded file via a temp path — Intervention 3.x reads from a URI.
        $tmpPath = $file->getStream()->getMetadata('uri');

        // Intervention Image 3.x API: read() → scaleDown() → toPng()
        // scaleDown keeps aspect ratio and never upscales (equivalent to 1.x upsize constraint).
        $encodedImage = $this->imageManager
            ->read($tmpPath)
            ->scaleDown(width: 400)
            ->toPng();

        $settingKey = 'resofire_blog_cards_default_image_path';

        // Delete the previous image if one exists.
        if (($existingPath = $this->settings->get($settingKey)) && $this->uploadDir->exists($existingPath)) {
            $this->uploadDir->delete($existingPath);
        }

        $uploadName = 'blog-cards-image-' . Str::lower(Str::random(8)) . '.png';

        // Flysystem 3.x / Laravel Filesystem: put() writes content directly.
        $this->uploadDir->put($uploadName, $encodedImage);

        $this->settings->set($settingKey, $uploadName);

        return new JsonResponse([
            'status'  => 'success',
            'path'    => $uploadName,
        ]);
    }
}
