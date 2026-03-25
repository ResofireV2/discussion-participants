(()=>{var t={n:o=>{var s=o&&o.__esModule?()=>o.default:()=>o;return t.d(s,{a:s}),s},d:(o,s)=>{for(var n in s)t.o(s,n)&&!t.o(o,n)&&Object.defineProperty(o,n,{enumerable:!0,get:s[n]})},o:(t,o)=>Object.prototype.hasOwnProperty.call(t,o),r:t=>{"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(t,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(t,"__esModule",{value:!0})}},o={};(()=>{"use strict";t.r(o);

// ---------------------------------------------------------------------------
// Imports
//
// IMPORTANT: DiscussionListItem, DiscussionListState and ReplyComposer are all
// chunk modules (lazy-loaded). flarum.reg.get() returns undefined for them at
// boot time. Do NOT reference them directly in the initializer — use the
// string-path form of extend/override instead, which calls flarum.reg.onLoad
// internally and defers until the chunk is loaded.
//
// Components used in vnodes (Avatar, Tooltip, etc.) are eagerly registered and
// safe to import directly.
// ---------------------------------------------------------------------------
const app              = flarum.reg.get("core","forum/app");
const { extend, override } = flarum.reg.get("core","common/extend");
const extenders        = flarum.reg.get("core","common/extenders");
const Discussion       = flarum.reg.get("core","common/models/Discussion");
const Component        = flarum.reg.get("core","common/Component");
const Modal            = flarum.reg.get("core","common/components/Modal");
const Button           = flarum.reg.get("core","common/components/Button");
const LoadingIndicator = flarum.reg.get("core","common/components/LoadingIndicator");
const Tooltip          = flarum.reg.get("core","common/components/Tooltip");
const Avatar           = flarum.reg.get("core","common/components/Avatar");
// Chunk modules — imported by string path only, never as direct references.
// const DiscussionListItem  — chunk, use string path
// const DiscussionListState — chunk, use string path
// const ReplyComposer       — chunk, use string path

// ---------------------------------------------------------------------------
// Model extender — registers Discussion.prototype.participantPreview = hasMany
// ---------------------------------------------------------------------------
const _extend = [(new extenders.Model(Discussion)).hasMany("participantPreview")];
t.d(o, {extend: () => _extend});

// ---------------------------------------------------------------------------
// ParticipantsModal — paginated list of all discussion participants
// ---------------------------------------------------------------------------
const PAGE_SIZE = 10;

class ParticipantsModal extends Modal {
  oninit(vnode) {
    super.oninit(vnode);
    this._discussionId = vnode.attrs.discussion.id();
    this.participants  = [];
    this.page          = 0;
    this.total         = null;
    this.loading       = false;
    this.loadPage();
  }

  onbeforeupdate(vnode) {
    const newId = vnode.attrs.discussion.id();
    if (newId !== this._discussionId) {
      this._discussionId = newId;
      this.participants  = [];
      this.page          = 0;
      this.total         = null;
      this.loading       = false;
      this.loadPage();
    }
  }

  className() { return "ParticipantsModal Modal--small"; }

  title() {
    const c = this.total !== null
      ? this.total
      : (this.attrs.discussion.attribute("participantCount") || "");
    return app.translator.trans("resofire-discussion-participants.forum.modal_title", {count: c});
  }

  content() {
    if (this.participants.length === 0 && this.loading) {
      return m("div", {className:"Modal-body"}, m(LoadingIndicator));
    }

    const totalPages = this.total !== null ? Math.ceil(this.total / PAGE_SIZE) : null;
    const hasPrev    = this.page > 0;
    const hasNext    = this.total === null || ((this.page + 1) * PAGE_SIZE) < this.total;

    const items = this.participants.map(u => {
      const displayName = u.displayName ? u.displayName() : (u.username ? u.username() : "");
      const slug        = u.slug ? u.slug() : (displayName || "");
      return m("li", {className:"ParticipantsModal-item"},
        m("a", {
          href:    app.route("user", {username: slug}),
          onclick: () => app.modal.close()
        },
          m(Avatar, {user: u}),
          m("span", {className:"ParticipantsModal-username"}, displayName)
        )
      );
    });

    let pagination = null;
    if (hasPrev || hasNext) {
      pagination = m("div", {className:"ParticipantsModal-pagination"},
        m(Button, {
          className:"Button",
          disabled: !hasPrev || this.loading,
          onclick:  () => { this.page--; this.loadPage(); }
        }, "\u2190 Prev"),
        m("span", {className:"ParticipantsModal-pageInfo"},
          (this.page + 1) + (totalPages !== null ? " / " + totalPages : "")
        ),
        m(Button, {
          className:"Button Button--primary",
          disabled: !hasNext || this.loading,
          onclick:  () => { this.page++; this.loadPage(); }
        }, "Next \u2192")
      );
    }

    return m("div", {className:"Modal-body"},
      this.loading ? m(LoadingIndicator) : null,
      m("ul", {className:"ParticipantsModal-list"}, items),
      pagination
    );
  }

  loadPage() {
    if (this.loading) return;
    this.loading = true;
    m.redraw();

    app.request({
      method: "GET",
      url:    app.forum.attribute("apiUrl") + "/discussions/" + this.attrs.discussion.id() + "/participants",
      params: {
        "page[offset]": this.page * PAGE_SIZE,
        "page[limit]":  PAGE_SIZE
      }
    })
    .then(r => {
      const remapped = {
        data: (r.data || []).map(i => ({
          type: "users",
          id:   i.attributes.userId != null ? String(i.attributes.userId) : i.id,
          attributes: {
            username:    i.attributes.username,
            slug:        i.attributes.slug,
            avatarUrl:   i.attributes.avatarUrl,
            displayName: i.attributes.displayName,
            color:       i.attributes.color
          }
        }))
      };
      app.store.pushPayload(remapped);

      this.participants = (r.data || []).map(i => {
        const uid = i.attributes.userId != null ? i.attributes.userId : i.id;
        return app.store.getById("users", String(uid));
      }).filter(Boolean);

      this.total   = (r.meta && r.meta.total != null) ? r.meta.total : null;
      this.loading = false;
      m.redraw();
    })
    .catch(() => { this.loading = false; m.redraw(); });
  }
}

// ---------------------------------------------------------------------------
// DiscussionParticipants — avatar strip shown in the discussion list
// ---------------------------------------------------------------------------
class DiscussionParticipants extends Component {
  view() {
    const discussion = this.attrs.discussion;
    const preview    = (discussion.participantPreview() || []).filter(Boolean);
    if (!preview.length) return m("[");

    const total     = discussion.attribute("participantCount") != null
                        ? discussion.attribute("participantCount") : 0;
    const overflowN = Math.max(0, total - 7);

    const avatars = preview.map(user => {
      const name = user.displayName ? user.displayName() : (user.username ? user.username() : "");
      return m(Tooltip, {text: name, position: "bottom"},
        m("a", {
          className: "DiscussionParticipants-avatar",
          href:      app.route("user", {username: user.slug()}),
          onclick:   e => e.stopPropagation()
        },
          m(Avatar, {user})
        )
      );
    });

    const overflowBtn = overflowN > 0
      ? m("button", {
          className: "DiscussionParticipants-overflow Button Button--icon Button--flat",
          type:      "button",
          title:     app.translator.trans("resofire-discussion-participants.forum.show_all_participants"),
          onclick:   e => {
            e.stopPropagation();
            e.preventDefault();
            app.modal.show(ParticipantsModal, {discussion});
          }
        }, "+" + overflowN)
      : null;

    return m("div", {className:"DiscussionParticipants"}, avatars, overflowBtn);
  }
}

// ---------------------------------------------------------------------------
// Initializer — uses STRING-PATH form of extend/override for all three chunk
// targets. This defers execution via flarum.reg.onLoad until the chunk loads,
// avoiding the undefined.prototype crash.
//
// String path format for core modules: "flarum/forum/components/ComponentName"
// ---------------------------------------------------------------------------
app.initializers.add("resofire-discussion-participants", () => {

  // extend(stringPath, method, callback) — defers until chunk is loaded
  extend(
    "flarum/forum/states/DiscussionListState",
    "requestParams",
    function(params) {
      params.include.push("participantPreview");
    }
  );

  extend(
    "flarum/forum/components/DiscussionListItem",
    "infoItems",
    function(items) {
      const discussion = this.attrs.discussion;
      const preview    = (discussion.participantPreview() || []).filter(Boolean);
      if (!preview.length) return;
      items.add("participants", m(DiscussionParticipants, {discussion}), -10);
    }
  );

  override(
    "flarum/forum/components/ReplyComposer",
    "onsubmit",
    function(original) {
      const discussion   = this.attrs.discussion;
      const discussionId = String(discussion.id());
      const currentUser  = app.session.user;

      if (!currentUser) { original(); return; }

      const currentUserId = String(currentUser.id());

      const originalCreateRecord = app.store.createRecord.bind(app.store);
      app.store.createRecord = (type, data) => {
        app.store.createRecord = originalCreateRecord;
        const record = originalCreateRecord(type, data);

        if (type === "posts") {
          const originalSave = record.save.bind(record);
          record.save = saveData => originalSave(saveData).then(post => {
            const disc = app.store.getById("discussions", discussionId);
            if (!disc) return post;

            const preview = (disc.participantPreview() || []).filter(Boolean);
            if (preview.length >= 6) return post;

            const alreadyIn = preview.some(u => String(u.id()) === currentUserId);
            if (alreadyIn) return post;

            const rel = disc.data.relationships = disc.data.relationships || {};
            rel.participantPreview = rel.participantPreview || {data: []};
            if (!Array.isArray(rel.participantPreview.data)) rel.participantPreview.data = [];
            rel.participantPreview.data.push({type: "users", id: currentUserId});
            disc.freshness = new Date();
            m.redraw();

            return post;
          });
        }
        return record;
      };

      original();
    }
  );
});

})(),module.exports=o})();
