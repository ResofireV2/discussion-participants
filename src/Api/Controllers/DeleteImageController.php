<?php

namespace Resofire\BlogCards\Api\Controllers;

use Flarum\Api\Controller\AbstractDeleteController;
use Flarum\Http\RequestUtil;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\Exception\PermissionDeniedException;
use Illuminate\Contracts\Filesystem\Factory;
use Illuminate\Contracts\Filesystem\Filesystem;
use Psr\Http\Message\ServerRequestInterface;

/**
 * DELETE /api/resofire/blog-cards/upload-image
 *
 * Deletes the default card image.
 *
 * Ported to Flarum 2.x:
 *   - AbstractDeleteController still exists in 2.x with the same interface.
 *   - Flysystem 1.x Adapter\Local / Filesystem replaced with Laravel's Filesystem
 *     abstraction (Flysystem 3.x under the hood).
 */
class DeleteImageController extends AbstractDeleteController
{
    protected Filesystem $uploadDir;

    public function __construct(
        protected SettingsRepositoryInterface $settings,
        Factory $filesystemFactory
    ) {
        $this->uploadDir = $filesystemFactory->disk('flarum-assets');
    }

    protected function delete(ServerRequestInterface $request): void
    {
        $actor = RequestUtil::getActor($request);

        if (! $actor->isAdmin()) {
            throw new PermissionDeniedException();
        }

        $settingKey = 'resofire_blog_cards_default_image_path';
        $path = $this->settings->get($settingKey);

        $this->settings->set($settingKey, null);

        // Flysystem 3.x / Laravel Filesystem: exists() + delete() are identical method names.
        if ($path && $this->uploadDir->exists($path)) {
            $this->uploadDir->delete($path);
        }
    }
}
