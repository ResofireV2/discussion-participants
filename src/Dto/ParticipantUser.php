<?php

namespace Resofire\DiscussionParticipants\Dto;

/**
 * Lightweight data transfer object representing one participant.
 *
 * Used by ListDiscussionParticipantsController and ParticipantUserSerializer
 * to avoid constructing bare Flarum\User\User Eloquent models from raw DB rows.
 *
 * A manually-constructed User() has several problems:
 *   - $model->getKey() returns null (primary key not set via Eloquent)
 *   - slug() calls the registered slug driver which may query the DB
 *   - Eloquent marks all directly-assigned properties as dirty
 *
 * This DTO is a plain PHP object with no Eloquent dependency.
 * AbstractSerializer::getId() calls $model->id, which works on any object
 * with a public $id property — it does not require an Eloquent model.
 */
final class ParticipantUser
{
    public function __construct(
        public readonly int    $id,
        public readonly string $username,
        public readonly string $slug,
        public readonly ?string $avatarUrl,
        public readonly string $displayName,
        public readonly ?string $color = null,
    ) {}
}
