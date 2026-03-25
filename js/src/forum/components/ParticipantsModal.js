import app from 'flarum/forum/app';
import Modal from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
// Flarum 2.x: avatar() helper REMOVED → Avatar component
import Avatar from 'flarum/common/components/Avatar';

const PAGE_SIZE = 10;

export default class ParticipantsModal extends Modal {
  oninit(vnode) {
    super.oninit(vnode);
    this._discussionId = vnode.attrs.discussion.id();
    this.participants = [];
    this.page = 0;
    this.total = null;
    this.loading = false;
    this.loadPage();
  }

  onbeforeupdate(vnode) {
    const newId = vnode.attrs.discussion.id();
    if (newId !== this._discussionId) {
      this._discussionId = newId;
      this.participants = [];
      this.page = 0;
      this.total = null;
      this.loading = false;
      this.loadPage();
    }
  }

  className() {
    return 'ParticipantsModal Modal--small';
  }

  title() {
    const c = this.total !== null ? this.total : (this.attrs.discussion.attribute('participantCount') || '');
    return app.translator.trans('resofire_blog_cards.forum.modal_title', { count: c });
  }

  content() {
    if (this.participants.length === 0 && this.loading) {
      return <div className="Modal-body">{LoadingIndicator.component()}</div>;
    }

    const totalPages = this.total !== null ? Math.ceil(this.total / PAGE_SIZE) : null;
    const hasPrev = this.page > 0;
    const hasNext = this.total === null || ((this.page + 1) * PAGE_SIZE) < this.total;

    const items = this.participants.map((u) => {
      const displayName = u.displayName ? u.displayName() : (u.username ? u.username() : '');
      const slug = u.slug ? u.slug() : (displayName || '');
      return (
        <li className="ParticipantsModal-item">
          <a href={app.route('user', { username: slug })} onclick={() => app.modal.close()}>
            {/* 2.x: avatar(u) → m(Avatar, { user: u }) */}
            {m(Avatar, { user: u })}
            <span className="ParticipantsModal-username">{displayName}</span>
          </a>
        </li>
      );
    });

    const pagination = (hasPrev || hasNext) ? (
      <div className="ParticipantsModal-pagination">
        {Button.component({
          className: 'Button',
          disabled: !hasPrev || this.loading,
          onclick: () => { this.page--; this.loadPage(); },
        }, '← Prev')}
        <span className="ParticipantsModal-pageInfo">
          {(this.page + 1)}{totalPages !== null ? ` / ${totalPages}` : ''}
        </span>
        {Button.component({
          className: 'Button Button--primary',
          disabled: !hasNext || this.loading,
          onclick: () => { this.page++; this.loadPage(); },
        }, 'Next →')}
      </div>
    ) : null;

    return (
      <div className="Modal-body">
        {this.loading ? LoadingIndicator.component() : null}
        <ul className="ParticipantsModal-list">{items}</ul>
        {pagination}
      </div>
    );
  }

  loadPage() {
    if (this.loading) return;
    this.loading = true;
    m.redraw();

    app.request({
      method: 'GET',
      url: app.forum.attribute('apiUrl') + '/discussions/' + this.attrs.discussion.id() + '/participants',
      params: {
        'page[offset]': this.page * PAGE_SIZE,
        'page[limit]': PAGE_SIZE,
      },
    }).then((r) => {
      const remapped = {
        data: (r.data || []).map((i) => ({
          type: 'users',
          id: i.attributes.userId != null ? String(i.attributes.userId) : i.id,
          attributes: {
            username: i.attributes.username,
            slug: i.attributes.slug,
            avatarUrl: i.attributes.avatarUrl,
            displayName: i.attributes.displayName,
            color: i.attributes.color,
          },
        })),
      };
      app.store.pushPayload(remapped);
      this.participants = (r.data || []).map((i) => {
        const uid = i.attributes.userId != null ? i.attributes.userId : i.id;
        return app.store.getById('users', String(uid));
      }).filter(Boolean);
      this.total = (r.meta && r.meta.total != null) ? r.meta.total : null;
      this.loading = false;
      m.redraw();
    }).catch(() => {
      this.loading = false;
      m.redraw();
    });
  }
}
