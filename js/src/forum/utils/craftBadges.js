// Flarum 2.x: 'flarum/common/helpers/icon' is REMOVED.
// icon() was a helper function; it is now the Icon component at 'flarum/common/components/Icon'.
// Call signature changes: icon('fas fa-x', attrs) → m(Icon, { name: 'fas fa-x', ...attrs })
import Icon from 'flarum/common/components/Icon';
import Tooltip from 'flarum/common/components/Tooltip';

export default function craftBadges(badges) {
  if (badges.length) {
    return [m('.cardBadges', [badges.map((badge) => {
      return [
        m(Tooltip, {
          text: badge.attrs.label ? badge.attrs.label[0] : '',
          position: 'right'
        },
        m('span.cardBadge.Badge.Badge--' + badge.attrs.type, [m(Icon, { name: badge.attrs.icon })]))]
    })])];
  }
};
