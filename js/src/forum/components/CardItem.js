import Component from 'flarum/common/Component';
import craftBadges from '../utils/craftBadges';
import craftTags from '../utils/craftTags';
import humanTime from 'flarum/common/utils/humanTime';
// Flarum 2.x: icon() helper REMOVED → Icon component
import Icon from 'flarum/common/components/Icon';
import username from 'flarum/common/helpers/username';
// Flarum 2.x: avatar() helper REMOVED → Avatar component
import Avatar from 'flarum/common/components/Avatar';
import Dropdown from 'flarum/common/components/Dropdown';
import DiscussionControls from 'flarum/forum/utils/DiscussionControls';
import Link from 'flarum/common/components/Link';
import { truncate } from 'flarum/common/utils/string';
import getFirstPostImage from '../utils/getFirstPostImage';
import CardParticipants from './CardParticipants';

export default class CardItem extends Component {
  oninit(vnode) {
    super.oninit(vnode);
    this.discussion = this.attrs.discussion;
  }

  view() {
    const discussion = this.discussion;

    const jumpTo = Math.min(
      discussion.lastPostNumber() ?? 0,
      (discussion.lastReadPostNumber() || 0) + 1
    );

    const unreadCount = discussion.unreadCount();
    const replyCount = discussion.replyCount() || 0;
    const displayCount = unreadCount || replyCount;

    const imageUrl = getFirstPostImage(discussion);

    let excerpt = '';
    try {
      const firstPost = discussion.firstPost();
      if (firstPost) {
        const html = firstPost.contentHtml() || '';
        const doc = new DOMParser().parseFromString(html, 'text/html');
        excerpt = truncate((doc.body.textContent || '').trim().replace(/\s+/g, ' '), 260);
      }
    } catch (e) {}

    return (
      <div
        key={discussion.id()}
        data-id={discussion.id()}
        className={
          'CardsListItem Card'
          + (discussion.isHidden() ? ' Hidden' : '')
          + (discussion.isUnread() ? ' unread' : '')
          + (discussion.isRead() ? ' read' : '')
        }
      >
        {DiscussionControls.controls(discussion, this).toArray().length
          ? m(Dropdown, {
              icon: 'fas fa-ellipsis-v',
              className: 'DiscussionListItem-controls',
              buttonClassName: 'Button Button--icon Button--flat Slidable-underneath Slidable-underneath--right',
            }, DiscussionControls.controls(discussion, this).toArray())
          : ''}

        <Link href={app.route.discussion(discussion, jumpTo)} className="cardLink">

          <div className="cardImageWrap">
            {imageUrl
              ? <div className="cardImage" style={{ backgroundImage: `url(${imageUrl})` }} aria-hidden="true" />
              : <div className="cardImage cardImage--placeholder" aria-hidden="true" />}
          </div>

          <div className="cardBody">
            {craftBadges(discussion.badges().toArray())}
            <div className="cardTags">{craftTags(discussion.tags())}</div>
            <h2 className="cardTitle" title={discussion.title()}>
              {truncate(discussion.title(), 80)}
            </h2>
            {excerpt ? <p className="cardExcerpt">{excerpt}</p> : ''}
          </div>

          <div className="cardFooter">
            <span className="cardAuthor">
              {/* 2.x: avatar(user, attrs) → m(Avatar, { user, ...attrs }) */}
              {m(Avatar, { user: discussion.user(), className: 'cardAvatar' })}
              {username(discussion.user())}
            </span>
            <span className="cardReplies">
              {/* 2.x: icon('name', attrs) → m(Icon, { name: 'name', ...attrs }) */}
              {m(Icon, { name: 'fas fa-comment-alt', className: 'cardRepliesIcon' })}
              <strong className="cardRepliesCount">{displayCount}</strong>
            </span>
          </div>

          {this.attrs.showParticipants !== false && (
            <div className="cardParticipantsRow">
              {m(CardParticipants, { discussion })}
            </div>
          )}

        </Link>
      </div>
    );
  }
}
