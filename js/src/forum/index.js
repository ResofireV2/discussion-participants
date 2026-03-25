import app from 'flarum/forum/app';
// Flarum 2.x: 'flarum/common/extenders' uses a DEFAULT export (an object with Model, Store, etc.)
// NOT named exports. Importing { Model } would be undefined at runtime.
// The correct pattern (confirmed from approval, gdpr, tags extensions in 2.x source):
//   import Extend from 'flarum/common/extenders';  → then use Extend.Model
import Extend from 'flarum/common/extenders';
import Discussion from 'flarum/common/models/Discussion';
// Flarum 2.x: 'flarum/extend' is NOT a valid module path — the correct path is
// 'flarum/common/extend' (confirmed in approval/embed/gdpr/tags 2.x source).
import { extend as extendUtil, override } from 'flarum/common/extend';
import DiscussionList from 'flarum/forum/components/DiscussionList';
import DiscussionListState from 'flarum/forum/states/DiscussionListState';
import ReplyComposer from 'flarum/forum/components/ReplyComposer';
import IndexPage from 'flarum/forum/components/IndexPage';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import Placeholder from 'flarum/common/components/Placeholder';
import Button from 'flarum/common/components/Button';
import CardItem from './components/CardItem';
import checkOverflowingTags from './helpers/checkOverflowingTags';

// Flarum 2.x: 'compat' is NOT exported from '@flarum/core/forum' or anywhere in 2.x.
// Bundled 2.x extensions do not use compat at all.
// The compat block from 1.x is removed.

export const extend = [
  new Extend.Model(Discussion).hasMany('participantPreview'),
];

app.initializers.add('resofire/blog-cards', () => {

  // Forum attributes cached lazily on first render — app.forum is not available
  // at initializer time, only after boot(). Values never change without a page reload.
  let cachedSettings = null;
  function getSettings() {
    if (!cachedSettings) {
      cachedSettings = {
        onIndexPage: Number(app.forum.attribute('resofireBlogCardsOnIndexPage')) === 1,
        configuredTagIds: JSON.parse(app.forum.attribute('resofireBlogCardsTagIds') || '[]'),
        fullWidth: Number(app.forum.attribute('resofireBlogCardsFullWidth')) === 1,
        showParticipants: Number(app.forum.attribute('resofireBlogCardsShowParticipants') ?? 1) !== 0,
      };
    }
    return cachedSettings;
  }

  extendUtil(DiscussionList.prototype, 'oncreate', checkOverflowingTags);
  extendUtil(DiscussionList.prototype, 'onupdate', checkOverflowingTags);

  // Include participantPreview on every load-more fetch (guard against duplicates).
  extendUtil(DiscussionListState.prototype, 'requestParams', function(params) {
    if (!params.include.includes('participantPreview')) {
      params.include.push('participantPreview');
    }
  });

  override(DiscussionList.prototype, 'view', function (original) {
    const { onIndexPage, configuredTagIds, fullWidth, showParticipants } = getSettings();
    const isIndex = app.current.matches(IndexPage);
    const state = this.attrs.state;
    let loading;

    if (state.isInitialLoading() || state.isLoadingNext()) {
      loading = <LoadingIndicator />;
    } else if (state.hasNext()) {
      loading = (
        <Button className="Button" onclick={state.loadNext.bind(state)}>
          {app.translator.trans('core.forum.discussion_list.load_more_button')}
        </Button>
      );
    }

    if (state.isEmpty()) {
      const text = app.translator.trans('core.forum.discussion_list.empty_text');
      return (
        <div className="DiscussionList">
          <Placeholder text={text} />
        </div>
      );
    }

    const isTagPage = isIndex && !!m.route.param('tags');
    const isMainIndex = isIndex && !m.route.param('tags');
    const isDiscussionPage = !isIndex;

    if (isMainIndex && !onIndexPage) return original();

    // On DiscussionPage sidebar: use the discussion list's own params to determine
    // which tag is active, same logic as the tag filter check below.
    if (isDiscussionPage) {
      const discussionTagSlug = state.params && state.params.tags;
      if (!discussionTagSlug) return original();
      if (configuredTagIds.length > 0) {
        const currentTag = app.store.all('tags').find(
          (t) => t.slug().localeCompare(discussionTagSlug, undefined, { sensitivity: 'base' }) === 0
        );
        if (!currentTag || !configuredTagIds.includes(currentTag.id())) {
          return original();
        }
      }
    }

    if (configuredTagIds.length > 0 && isTagPage) {
      const currentSlug = m.route.param('tags');
      const currentTag = app.store.all('tags').find(
        (t) => t.slug().localeCompare(currentSlug, undefined, { sensitivity: 'base' }) === 0
      );
      if (!currentTag || !configuredTagIds.includes(currentTag.id())) {
        return original();
      }
    }

    // Flarum 2.x: DiscussionList.view() now wraps items in:
    //   <ul role="feed" aria-busy={...} className="DiscussionList-discussions">
    //     <li key=... role="article" aria-setsize="-1" aria-posinset={...}>...</li>
    //   </ul>
    // We mirror that structure here so screen readers and CSS behave correctly.
    // The flexCard layout is applied via CSS on .DiscussionList-discussions itself.
    const pageSize = state.pageSize || 20;

    return (
      <div className={'DiscussionList' + (state.isSearchResults() ? ' DiscussionList--searchResults' : '')}>
        <ul
          role="feed"
          aria-busy={false}
          className={'DiscussionList-discussions flexCard' + (fullWidth ? ' flexCard--full' : '')}
        >
          {state.getPages().map((pg, pageNum) => {
            return pg.items.map((discussion, itemNum) => (
              <li
                key={discussion.id()}
                data-id={discussion.id()}
                role="article"
                aria-setsize="-1"
                aria-posinset={pageNum * pageSize + itemNum + 1}
              >
                {m(CardItem, { discussion, showParticipants })}
              </li>
            ));
          })}
        </ul>
        <div className="DiscussionList-loadMore">{loading}</div>
      </div>
    );
  });

  // Optimistic avatar append after replying — copied exactly from discussion-participants.
  override(ReplyComposer.prototype, 'onsubmit', function(original) {
    const discussion = this.attrs.discussion;
    const discussionId = String(discussion.id());
    const currentUser = app.session.user;

    if (!currentUser) {
      original();
      return;
    }

    const currentUserId = String(currentUser.id());
    const originalCreateRecord = app.store.createRecord.bind(app.store);

    app.store.createRecord = function(type, data) {
      app.store.createRecord = originalCreateRecord;
      const record = originalCreateRecord(type, data);

      if (type === 'posts') {
        const originalSave = record.save.bind(record);
        record.save = function(saveData) {
          return originalSave(saveData).then(function(post) {
            const disc = app.store.getById('discussions', discussionId);
            if (!disc) return post;

            const preview = (disc.participantPreview() || []).filter(Boolean);
            if (preview.length >= 6) return post;

            const alreadyIn = preview.some((u) => String(u.id()) === currentUserId);
            if (alreadyIn) return post;

            const rel = disc.data.relationships = disc.data.relationships || {};
            rel.participantPreview = rel.participantPreview || { data: [] };
            if (!Array.isArray(rel.participantPreview.data)) {
              rel.participantPreview.data = [];
            }
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

}, -1);
