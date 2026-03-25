<?php

namespace Resofire\DiscussionParticipants\Api\Serializer;

use Resofire\DiscussionParticipants\Dto\ParticipantUser;
use Flarum\Api\Serializer\AbstractSerializer;
use Flarum\Settings\SettingsRepositoryInterface;

/**
 * Serializer for the paginated participant modal endpoint.
 *
 * Works against ParticipantUser DTOs, not Eloquent User models.
 * This avoids the problems that come with constructing bare User() instances:
 *   - slug() on a new User() may fail depending on the slug driver installed
 *   - getKey() on a manually-constructed model returns null
 *   - Eloquent fillable/guarded rules apply unpredictably on direct assignment
 *
 * TYPE: 'discussion-participants' — deliberately NOT 'users'.
 *
 * Using 'users' would cause the Flarum frontend store to merge these minimal
 * 4-field objects into any fully-loaded User models already in the store,
 * silently downgrading them. A custom type is invisible to the store's user
 * cache and avoids that corruption entirely.
 *
 * avatarUrl: The raw DB column stores either a full URL (http/https) or a
 * relative path (e.g. "avatars/abc.jpg"). Flarum's own UserSerializer resolves
 * relative paths by prepending the configured base_url + "/assets/". We mirror
 * that logic here so the frontend receives an absolute URL it can use directly.
 * Users without an uploaded avatar receive null — the frontend renders the
 * standard Flarum letter-avatar fallback.
 */
class ParticipantUserSerializer extends AbstractSerializer
{
    protected $type = 'discussion-participants';

    public function __construct(
        protected SettingsRepositoryInterface $settings
    ) {}

    /**
     * @param ParticipantUser $user
     */
    protected function getDefaultAttributes($user): array
    {
        return [
            'userId'      => $user->id,
            'username'    => $user->username,
            'slug'        => $user->slug,
            'avatarUrl'   => $this->resolveAvatarUrl($user->avatarUrl),
            'displayName' => $user->displayName,
            'color'       => $user->color,
        ];
    }

    /**
     * Mirror Flarum's UserSerializer avatar URL resolution.
     *
     * Flarum stores avatars as either:
     *   - A full URL (when using S3/CDN): returned as-is.
     *   - A relative path like "avatars/abc123.png": prepend base_url + "/assets/avatars/".
     *   - null/empty: no uploaded avatar, return null.
     */
    private function resolveAvatarUrl(?string $avatarUrl): ?string
    {
        if ($avatarUrl === null || $avatarUrl === '') {
            return null;
        }

        if (str_starts_with($avatarUrl, 'http://') || str_starts_with($avatarUrl, 'https://')) {
            return $avatarUrl;
        }

        $baseUrl = rtrim((string) $this->settings->get('url', ''), '/');
        return $baseUrl . '/assets/avatars/' . $avatarUrl;
    }
}
