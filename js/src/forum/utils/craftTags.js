import Link from 'flarum/common/components/Link';
// Flarum 2.x: cross-extension imports require the 'ext:' prefix.
// 'flarum/tags/utils/sortTags' (1.x) → 'ext:flarum/tags/utils/sortTags' (2.x).
// Without this prefix, flarum-webpack-config 3.x will not resolve the import.
import sortTags from 'ext:flarum/tags/utils/sortTags';

export default function craftTags(tags) {
  if (tags) {
    return [sortTags(tags).map(function (tag) {
      return [
        <Link className="cardTag"
              style={{backgroundColor: tag.color()}}
              href={app.route('tag', {tags: tag.slug()})}>
          {tag.name()}
        </Link>
      ];
    })];
  }
}
