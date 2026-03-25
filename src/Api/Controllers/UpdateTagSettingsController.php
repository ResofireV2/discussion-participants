<?php

namespace Resofire\BlogCards\Api\Controllers;

use Flarum\Foundation\ValidationException;
use Flarum\Http\RequestUtil;
use Flarum\Tags\Tag;
use Flarum\User\Exception\PermissionDeniedException;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * POST /api/resofire/blog-cards/tag-settings
 *
 * Saves per-tag display settings (card widths, primaryCards count).
 *
 * Ported to Flarum 2.x:
 *   - AbstractShowController is REMOVED in 2.x (part of the old tobscure/json-api stack).
 *   - Tobscure\JsonApi\Document no longer exists.
 *   - TagSerializer no longer exists in the old form.
 *   - Rewritten as a plain RequestHandlerInterface returning JsonResponse,
 *     consistent with RecalculateParticipantsController and the Tags extension's
 *     OrderTagsController pattern in 2.x.
 */
class UpdateTagSettingsController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);

        if (! $actor->isAdmin()) {
            throw new PermissionDeniedException();
        }

        $body = $request->getParsedBody();
        $id   = Arr::get($request->getQueryParams(), 'id');
        $data = Arr::get($body, 'data', []);

        $tagSettingsRaw = $data['tagSettings'] ?? '{}';
        $tagSettings    = json_decode($tagSettingsRaw, true) ?? [];

        $this->validateTagSettings($tagSettings);

        $tag = Tag::findOrFail($id);
        $tag->resofire_blog_cards_tag_settings = $tagSettingsRaw;
        $tag->save();

        return new JsonResponse([
            'status' => 'success',
            'id'     => $tag->id,
        ]);
    }

    private function validateTagSettings(array $settings): void
    {
        /** @var \Illuminate\Contracts\Validation\Factory $validatorFactory */
        $validatorFactory = resolve('validator');
        /** @var \Symfony\Contracts\Translation\TranslatorInterface $translator */
        $translator = resolve('translator');

        $validator = $validatorFactory->make($settings, [
            'primaryCards'     => 'nullable|numeric|min:0',
            'desktopCardWidth' => 'nullable|numeric|min:10|max:100',
            'tabletCardWidth'  => 'nullable|numeric|min:10|max:100',
        ], [
            'primaryCards.min'     => $translator->trans('resofire_blog_cards.admin.tag_modal.validation.primaryCards_error'),
            'desktopCardWidth.min' => $translator->trans('resofire_blog_cards.admin.tag_modal.validation.desktopCardWidth_error'),
            'desktopCardWidth.max' => $translator->trans('resofire_blog_cards.admin.tag_modal.validation.desktopCardWidth_error'),
            'tabletCardWidth.min'  => $translator->trans('resofire_blog_cards.admin.tag_modal.validation.tabletCardWidth_error'),
            'tabletCardWidth.max'  => $translator->trans('resofire_blog_cards.admin.tag_modal.validation.tabletCardWidth_error'),
        ]);

        if ($validator->fails()) {
            $errors     = $validator->errors()->toArray();
            $firstError = reset($errors);
            throw new ValidationException([
                'message' => is_array($firstError) ? $firstError[0] : $firstError,
            ]);
        }
    }
}
