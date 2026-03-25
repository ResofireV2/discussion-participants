import app from 'flarum/admin/app';
import Extend from 'flarum/common/extenders';
import Button from 'flarum/common/components/Button';
import RecalculateModal from './components/RecalculateModal';

// Flarum 2.x admin settings registration.
// The idiomatic 2.x approach is to register settings via the Admin extender,
// NOT via a custom ExtensionPage subclass. The Admin extender's .setting() and
// .customSetting() methods populate the default ExtensionPage content() automatically.
// This avoids any reliance on ExtensionPageResolver.getPage() working correctly.

export const extend = [
  new Extend.Admin()
    // Standard switch settings — rendered by ExtensionPage.content() via AdminRegistry
    .setting(() => ({
      type: 'switch',
      setting: 'resofire_blog_cards_onIndexPage',
      label: app.translator.trans('resofire_blog_cards.admin.settings.onIndexPage_label'),
      help: app.translator.trans('resofire_blog_cards.admin.settings.onIndexPage_help'),
    }), 100)

    .setting(() => ({
      type: 'flarum-tags.select-tags',
      setting: 'resofire_blog_cards_tagIds',
      label: app.translator.trans('resofire_blog_cards.admin.settings.tagIds_label'),
      help: app.translator.trans('resofire_blog_cards.admin.settings.tagIds_help'),
    }), 90)

    .setting(() => ({
      type: 'switch',
      setting: 'resofire_blog_cards_fullWidth',
      label: app.translator.trans('resofire_blog_cards.admin.settings.fullWidth_label'),
      help: app.translator.trans('resofire_blog_cards.admin.settings.fullWidth_help'),
    }), 80)

    .setting(() => ({
      type: 'switch',
      setting: 'resofire_blog_cards_showParticipants',
      label: app.translator.trans('resofire_blog_cards.admin.settings.showParticipants_label'),
      help: app.translator.trans('resofire_blog_cards.admin.settings.showParticipants_help'),
    }), 70)

    // Recalculate tool — custom UI rendered inline in the settings form
    .customSetting(() => (
      <div className="Form-group" style={{ marginTop: '2rem' }}>
        <h3>{app.translator.trans('resofire_blog_cards.admin.tools_heading')}</h3>
        <p className="helpText">{app.translator.trans('resofire_blog_cards.admin.recalculate_help')}</p>
        {Button.component(
          { className: 'Button Button--primary', onclick: () => app.modal.show(RecalculateModal) },
          app.translator.trans('resofire_blog_cards.admin.recalculate_button')
        )}
      </div>
    ), 10),
];
