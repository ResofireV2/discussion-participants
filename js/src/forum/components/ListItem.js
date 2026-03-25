import Component from 'flarum/common/Component';
import craftBadges from '../utils/craftBadges';
import craftTags from '../utils/craftTags';
import humanTime from 'flarum/common/utils/humanTime';
// Flarum 2.x: icon() helper REMOVED → Icon component
import Icon from 'flarum/common/components/Icon';
import username from 'flarum/common/helpers/username';
import Dropdown from 'flarum/common/components/Dropdown';
import DiscussionControls from 'flarum/forum/utils/DiscussionControls';
import Link from 'flarum/common/components/Link';
import { truncate } from 'flarum/common/utils/string';
import abbreviateNumber from 'flarum/common/utils/abbreviateNumber';

export default class ListItem extends Component {
  oninit(vnode) {
    super.oninit(vnode);
  }

  view() {
    const discussion = this.attrs.discussion;

    const jumpTo = Math.min(
      discussion.lastPostNumber() ?? 0,
      (discussion.lastReadPostNumber() || 0) + 1
    );

    const unreadCount = discussion.unreadCount();
    const replyCount = discussion.replyCount() || 0;
    const displayCount = unreadCount || replyCount;

    const replyText = unreadCount
      ? app.translator.trans('resofire_blog_cards.forum.unreadReplies', { count: unreadCount })
      : app.translator.trans('resofire_blog_cards.forum.replies', { count: replyCount });

    return (
      <div
        key={discussion.id()}
        data-id={discussion.id()}
        className={'BlogCardsItem List' + (discussion.isHidden() ? ' Hidden' : '')}
      >
        {DiscussionControls.controls(discussion, this).toArray().length
          ? m(Dropdown, {
              icon: 'fas fa-ellipsis-v',
              className: 'DiscussionListItem-controls',
              buttonClassName: 'Button Button--icon Button--flat Slidable-underneath Slidable-underneath--right',
            }, DiscussionControls.controls(discussion, this).toArray())
          : ''}

        <Link href={app.route.discussion(discussion, jumpTo)} className="cardLink">
          {craftBadges(discussion.badges().toArray())}

          <div className="cardGrid">
            <div className="rowSpan-3 colSpan-2">
              <div className="flexBox">
                <div className="cardTitle">
                  <h2 title={discussion.title()} className="title">
                    {truncate(discussion.title(), 80)}
                  </h2>
                  {app.screen() !== 'phone'
                    ? <div className="DiscussionListItem-count">
                        <span aria-hidden="true">
                          {abbreviateNumber(displayCount)}{unreadCount ? '*' : ''}
                        </span>
                        <span className="visually-hidden">
                          {app.translator.trans('core.forum.discussion_list.unread_replies_a11y_label', { count: replyCount })}
                        </span>
                      </div>
                    : ''}
                </div>
                <div className="cardTags">{craftTags(discussion.tags())}</div>
              </div>

              <div className="cardMeta">
                <span className="cardAuthor">{username(discussion.user())}</span>
                <span className="cardDate">{humanTime(discussion.createdAt())}</span>
              </div>

              {app.screen() === 'phone'
                ? <div className="cardSpacer">
                    <Link
                      className="Replies"
                      href={app.route.discussion(discussion, discussion.lastPostNumber())}
                    >
                      <div className="Left">
                        <div className="Repcount">{replyText}</div>
                      </div>
                      {/* 2.x: icon('name') → m(Icon, { name: 'name' }) */}
                      <div className="Arrow">{m(Icon, { name: 'fas fa-angle-right' })}</div>
                    </Link>
                  </div>
                : <div className="imageLabel discussionReplyCount">
                    {/* 2.x: icon('name', attrs) → m(Icon, { name: 'name', ...attrs }) */}
                    {m(Icon, { name: 'fas fa-comment', className: 'labelIcon' })}
                    {abbreviateNumber(displayCount)}{unreadCount ? '*' : ''}
                  </div>}
            </div>
          </div>
        </Link>
      </div>
    );
  }
}
