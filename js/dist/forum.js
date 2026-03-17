/*! resofire/discussion-participants - forum (Flarum 2.x) */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // 2.x import pattern: Export Registry instead of flarum.core.compat.
  // flarum.reg.get() resolves modules registered at boot time.
  // ---------------------------------------------------------------------------

  var app         = function () { return flarum.reg.get('flarum/forum/app').default; };
  var m           = flarum.reg.get('mithril').default;

  var _extend     = flarum.reg.get('flarum/common/extend');
  var extend      = _extend.extend;
  var override    = _extend.override;

  var Component        = function () { return flarum.reg.get('flarum/common/Component').default; };
  var Modal            = function () { return flarum.reg.get('flarum/common/components/Modal').default; };
  var Button           = function () { return flarum.reg.get('flarum/common/components/Button').default; };
  var LoadingIndicator = function () { return flarum.reg.get('flarum/common/components/LoadingIndicator').default; };
  var Tooltip          = function () { return flarum.reg.get('flarum/common/components/Tooltip').default; };
  var avatarHelper     = function () { return flarum.reg.get('flarum/common/helpers/avatar').default; };

  var DiscussionListItem  = function () { return flarum.reg.get('flarum/forum/components/DiscussionListItem').default; };
  var DiscussionListState = function () { return flarum.reg.get('flarum/forum/states/DiscussionListState').default; };
  var ReplyComposer       = function () { return flarum.reg.get('flarum/forum/components/ReplyComposer').default; };

  // ---------------------------------------------------------------------------
  // Simple prototype chain helper
  // ---------------------------------------------------------------------------
  function _inherits(C, base) {
    C.prototype = Object.create(base.prototype);
    C.prototype.constructor = C;
  }

  // ---------------------------------------------------------------------------
  // ParticipantsModal — paginated list of all discussion participants
  // ---------------------------------------------------------------------------
  var ParticipantsModal = function (base) {
    function C() { return base.apply(this, arguments) || this; }
    _inherits(C, base);

    C.isDismissible = true;

    C.prototype.oninit = function (vnode) {
      base.prototype.oninit.call(this, vnode);
      this.users   = [];
      this.total   = null;
      this.offset  = 0;
      this.limit   = 10;
      this.loading = true;
      this.loadPage(0);
    };

    C.prototype.className = function () { return 'ParticipantsModal Modal--small'; };

    C.prototype.title = function () {
      var c = this.total !== null ? this.total : (this.attrs.discussion.attribute('participantCount') || '');
      return app().translator.trans('resofire-discussion-participants.forum.modal_title', { count: c });
    };

    C.prototype.loadPage = function (offset) {
      var self = this;
      self.loading = true;
      m.redraw();

      var baseUrl      = app().forum.attribute('apiUrl');
      var discussionId = self.attrs.discussion.id();
      var url = baseUrl + '/discussions/' + discussionId + '/participants'
              + '?page[offset]=' + offset + '&page[limit]=' + self.limit;

      app().request({ method: 'GET', url: url })
        .then(function (r) {
          self.users = (r.data || []).map(function (item) {
            return {
              id:        item.id,
              username:  item.attributes.username,
              slug:      item.attributes.slug,
              avatarUrl: item.attributes.avatarUrl || null,
            };
          });
          if (r.meta && r.meta.total != null) self.total = r.meta.total;
          self.offset  = offset;
          self.loading = false;
          m.redraw();
        })
        .catch(function () {
          self.loading = false;
          m.redraw();
        });
    };

    C.prototype.content = function () {
      var self = this;

      if (self.loading) {
        return m('div.Modal-body', { style: 'padding:1.5rem;text-align:center;' },
          m(LoadingIndicator(), { size: 'medium', display: 'inline' })
        );
      }

      var totalPages  = self.total !== null ? Math.ceil(self.total / self.limit) : null;
      var currentPage = Math.floor(self.offset / self.limit) + 1;

      var items = self.users.map(function (u) {
        return m('li.ParticipantsModal-item',
          m('a', {
            href: app().route('user', { username: u.slug }),
            onclick: function (e) {
              e.preventDefault();
              m.route.set(app().route('user', { username: u.slug }));
              app().modal.close();
            }
          },
            m('.Avatar', {
              style: u.avatarUrl
                ? 'background-image:url(' + u.avatarUrl + ');width:32px;height:32px;border-radius:50%;background-size:cover;display:inline-block;flex-shrink:0;'
                : 'width:32px;height:32px;border-radius:50%;background:var(--control-bg);display:inline-flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;flex-shrink:0;'
            }, u.avatarUrl ? null : u.username.charAt(0).toUpperCase()),
            m('span.ParticipantsModal-username', u.username)
          )
        );
      });

      var pagination = m('div.ParticipantsModal-pagination',
        m(Button(), {
          className: 'Button Button--text',
          disabled: self.offset === 0,
          onclick: function () { self.loadPage(self.offset - self.limit); }
        }, '\u2190 ' + app().translator.trans('resofire-discussion-participants.forum.prev_button')),
        totalPages !== null
          ? m('span.ParticipantsModal-pageInfo', currentPage + ' / ' + totalPages)
          : null,
        m(Button(), {
          className: 'Button Button--text',
          disabled: self.total !== null && (self.offset + self.limit) >= self.total,
          onclick: function () { self.loadPage(self.offset + self.limit); }
        }, app().translator.trans('resofire-discussion-participants.forum.next_button') + ' \u2192')
      );

      return m('div.Modal-body', { style: 'padding:1.5rem;' },
        m('ul.ParticipantsModal-list', items),
        pagination
      );
    };

    return C;
  }(Modal());

  // ---------------------------------------------------------------------------
  // DiscussionParticipants — avatar strip + overflow badge
  // ---------------------------------------------------------------------------
  var DiscussionParticipants = function (base) {
    function C() { return base.apply(this, arguments) || this; }
    _inherits(C, base);

    C.prototype.view = function () {
      var discussion = this.attrs.discussion;
      var preview    = (discussion.participantPreview() || []).filter(Boolean);
      if (!preview.length) return m('[');

      // Flarum core's DiscussionMetadataUpdater owns participant_count and
      // counts ALL distinct posters including the OP. Overflow = total - 7
      // (1 OP avatar always shown by core + 6 strip avatars).
      var total     = discussion.attribute('participantCount') != null ? discussion.attribute('participantCount') : 0;
      var overflowN = Math.max(0, total - 7);

      var self = this;

      var avatars = preview.map(function (user) {
        var name = user.displayName ? user.displayName() : (user.username ? user.username() : '');
        return m(Tooltip(), { text: name, position: 'top' },
          m('span.DiscussionParticipants-avatar', avatarHelper()(user))
        );
      });

      var overflowBtn = overflowN > 0
        ? m('button.DiscussionParticipants-overflow', {
            title: app().translator.trans('resofire-discussion-participants.forum.show_all_participants'),
            onclick: function (e) {
              e.preventDefault();
              e.stopPropagation();
              app().modal.show(ParticipantsModal, { discussion: discussion });
            }
          }, '+' + overflowN)
        : null;

      return m('span.DiscussionParticipants', avatars, overflowBtn);
    };

    return C;
  }(Component());

  // ---------------------------------------------------------------------------
  // Initializer
  // ---------------------------------------------------------------------------
  app().initializers.add('resofire-discussion-participants', function () {

    // Include participantPreview in discussion list requests.
    extend(DiscussionListState().prototype, 'requestParams', function (params) {
      params.include = params.include || [];
      if (params.include.indexOf('participantPreview') === -1) {
        params.include.push('participantPreview');
      }
    });

    // Add avatar strip to each discussion list item.
    extend(DiscussionListItem().prototype, 'infoItems', function (items) {
      var discussion = this.attrs.discussion;
      var preview    = (discussion.participantPreview() || []).filter(Boolean);
      if (!preview.length) return;
      items.add('participants', m(DiscussionParticipants, { discussion: discussion }), -10);
    });

    // When a user posts for the first time in a discussion and the strip has
    // room (< 6 avatars), append their avatar immediately without a page refresh.
    override(ReplyComposer().prototype, 'onsubmit', function (original) {
      var self        = this;
      var discussion  = self.attrs.discussion;
      var discussionId = String(discussion.id());
      var currentUser  = app().session.user;

      if (!currentUser) { original(); return; }
      var currentUserId = String(currentUser.id());

      var originalCreateRecord = app().store.createRecord.bind(app().store);
      app().store.createRecord = function (type, data) {
        app().store.createRecord = originalCreateRecord;
        var record = originalCreateRecord(type, data);
        if (type === 'posts') {
          var originalSave = record.save.bind(record);
          record.save = function (saveData) {
            return originalSave(saveData).then(function (post) {
              var disc = app().store.getById('discussions', discussionId);
              if (!disc) return post;
              var preview = (disc.participantPreview() || []).filter(Boolean);
              if (preview.length >= 6) return post;
              var alreadyIn = preview.some(function (u) { return String(u.id()) === currentUserId; });
              if (alreadyIn) return post;
              var rel = disc.data.relationships = disc.data.relationships || {};
              rel.participantPreview = rel.participantPreview || { data: [] };
              if (!Array.isArray(rel.participantPreview.data)) rel.participantPreview.data = [];
              rel.participantPreview.data.push({ type: 'users', id: currentUserId });
              disc.freshness = new Date();
              m.redraw();
              return post;
            });
          };
        }
        return record;
      };

      original();
    });

  });

})();

Object.assign(flarum.reg.exports, {});
