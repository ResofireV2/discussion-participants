import app from 'flarum/admin/app';
import ExtensionPage from 'flarum/admin/components/ExtensionPage';
import Button from 'flarum/common/components/Button';
import RecalculateModal from './RecalculateModal';

export default class Settings extends ExtensionPage {
  content() {
    return (
      <div className="BlogCardsSettings">
        <div className="container">
          <div className="BlogCardsSettings--content">

            <div className="Section" style="margin-top: 1.5rem;">
              {this.buildSettingComponent({
                type: 'switch',
                setting: 'resofire_blog_cards_onIndexPage',
                label: app.translator.trans('resofire_blog_cards.admin.settings.onIndexPage_label'),
                help: app.translator.trans('resofire_blog_cards.admin.settings.onIndexPage_help'),
              })}
            </div>

            <div className="Section" style="margin-top: 1rem;">
              {this.buildSettingComponent({
                type: 'flarum-tags.select-tags',
                setting: 'resofire_blog_cards_tagIds',
                label: app.translator.trans('resofire_blog_cards.admin.settings.tagIds_label'),
                help: app.translator.trans('resofire_blog_cards.admin.settings.tagIds_help'),
              })}
            </div>

            <div className="Section" style="margin-top: 1rem;">
              {this.buildSettingComponent({
                type: 'switch',
                setting: 'resofire_blog_cards_fullWidth',
                label: app.translator.trans('resofire_blog_cards.admin.settings.fullWidth_label'),
                help: app.translator.trans('resofire_blog_cards.admin.settings.fullWidth_help'),
              })}
            </div>

            <div className="Section" style="margin-top: 1rem;">
              {this.buildSettingComponent({
                type: 'switch',
                setting: 'resofire_blog_cards_showParticipants',
                label: app.translator.trans('resofire_blog_cards.admin.settings.showParticipants_label'),
                help: app.translator.trans('resofire_blog_cards.admin.settings.showParticipants_help'),
              })}
            </div>

            {this.submitButton()}

            <div className="Section" style="margin-top: 2rem;">
              <h3>{app.translator.trans('resofire_blog_cards.admin.tools_heading')}</h3>
              <p className="helpText">{app.translator.trans('resofire_blog_cards.admin.recalculate_help')}</p>
              <div className="Form-group">
                {Button.component({
                  className: 'Button Button--primary',
                  onclick: () => app.modal.show(RecalculateModal),
                }, app.translator.trans('resofire_blog_cards.admin.recalculate_button'))}
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  }
}
