# resofire/discussion-participants

Shows an inline avatar strip of the first 6 repliers in each discussion on the Flarum discussion list. A "+N more" badge opens a paginated modal listing all participants.

## How it works

### Avatar strip

Participant avatars are served from a dedicated `discussion_participant_previews` table rather than from a live query against `posts`. This table stores at most 6 rows per discussion — the first 6 repliers by first-post date, with the original poster excluded (Flarum already shows the OP's avatar natively in the discussion list item).

The discussion list query fetches at most `20 discussions × 6 rows = 120 rows`, always bounded regardless of how active discussions are.

Preview rows are written at post-event time (Posted, Hidden, Restored, Deleted) — not at read time. This moves cost to writes (rare) rather than reads (every page load).

### Overflow badge

The overflow count (+N more) is derived from `participantCount`, a native Flarum core attribute maintained by `DiscussionMetadataUpdater`. The formula is simply `participantCount - 7`: 7 being the OP avatar plus the 6 avatars in the strip. No extra query is needed and the badge only appears once the strip is full.

### Live updates

When a user posts for the first time in a discussion, their avatar is appended to the strip immediately in the UI without a page refresh, provided the strip has fewer than 6 entries. The overflow badge also updates instantly via Flarum's own post-save API response.

### Paginated modal

The "+N more" button opens a modal that hits a dedicated endpoint (`GET /api/discussions/{id}/participants`) returning 20 users per page with minimal attributes (id, username, slug, avatarUrl). No full UserSerializer, no single large payload.

## Installation

```bash
composer require resofire/discussion-participants
php flarum migrate
php flarum cache:clear
```

Then enable the extension in the Flarum admin panel.

### Existing forums (one-time backfill)

For forums with existing discussions, run the backfill command to populate the preview table:

```bash
php flarum participants:populate
```

Alternatively, use the **Recalculate** button in the extension's admin page, which processes discussions in chunks of 2,000 and displays per-chunk timing and a total elapsed time.

## Upgrading from resofire-v2/discussion-participants

1. Disable the old extension in the admin panel
2. `composer remove resofire-v2/discussion-participants`
3. `composer require resofire/discussion-participants`
4. `php flarum migrate`
5. `php flarum cache:clear`
6. Enable the new extension in the admin panel

Your existing data (`discussion_participant_previews` table and `participant_count` column) is preserved — no recalculation needed.

## Memory profile

| Scenario | Without extension | With extension |
|---|---|---|
| Discussion list (20 discussions) | Up to 2,000 User models | 120 rows, 6 fields each |
| Participant data per request | ~6 MB | ~50 KB |
| Modal (300 participants) | 300 models, ~500 KB JSON | 20 models per page, ~4 KB JSON |

## Requirements

- Flarum 1.8 or later
