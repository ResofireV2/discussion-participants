/*! resofire/discussion-participants - admin (Flarum 2.x) */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // 2.x import pattern: Export Registry instead of flarum.core.compat.
  // ---------------------------------------------------------------------------

  var app          = function () { return flarum.reg.get('flarum/admin/app').default; };
  var m            = flarum.reg.get('mithril').default;

  var _extend      = flarum.reg.get('flarum/common/extend');
  var extend       = _extend.extend;

  var Modal            = function () { return flarum.reg.get('flarum/common/components/Modal').default; };
  var Button           = function () { return flarum.reg.get('flarum/common/components/Button').default; };
  var LoadingIndicator = function () { return flarum.reg.get('flarum/common/components/LoadingIndicator').default; };
  var ExtensionPage    = function () { return flarum.reg.get('flarum/admin/components/ExtensionPage').default; };

  var CHUNK_SIZE = 2000;

  // ---------------------------------------------------------------------------
  // RecalculateModal
  // ---------------------------------------------------------------------------
  var RecalculateModal = function (base) {
    function C() { return base.apply(this, arguments) || this; }
    C.prototype = Object.create(base.prototype);
    C.prototype.constructor = C;

    C.isDismissible = false;

    C.prototype.oninit = function (vnode) {
      base.prototype.oninit.call(this, vnode);
      this.total        = 0;
      this.processed    = 0;
      this.running      = true;
      this.complete     = false;
      this.errorMsg     = null;
      this.chunkLog     = [];
      this.totalElapsed = null;
      this.run();
    };

    C.prototype.className = function () { return 'RecalculateModal Modal--small'; };

    C.prototype.title = function () {
      return app().translator.trans('resofire-discussion-participants.admin.recalculate_modal_title');
    };

    C.prototype.content = function () {
      var self = this;
      var pct  = self.total > 0 ? Math.round((self.processed / self.total) * 100) : 0;

      var warning = self.running
        ? m('div.Alert.Alert--warning', { style: 'margin-bottom:1rem;display:flex;align-items:center;gap:8px;' },
            m('span.fas.fa-exclamation-triangle', { style: 'flex-shrink:0;' }),
            m('span', app().translator.trans('resofire-discussion-participants.admin.recalculate_modal_warning')))
        : null;

      var progressBar = m('div', { style: 'background:var(--control-bg);border-radius:6px;overflow:hidden;height:18px;margin-bottom:0.75rem;' },
        m('div', { style: 'width:' + pct + '%;height:100%;background:var(--primary-color);transition:width 0.3s ease;' })
      );

      var statusLine = self.complete
        ? m('p', { style: 'text-align:center;margin:0;color:var(--success-color,#57a957);font-weight:600;' },
            app().translator.trans('resofire-discussion-participants.admin.recalculate_modal_complete', { total: self.total }))
        : self.errorMsg
          ? m('p', { style: 'text-align:center;margin:0;color:#c0392b;' }, self.errorMsg)
          : m('p', { style: 'text-align:center;margin:0;color:var(--muted-color);' },
              app().translator.trans('resofire-discussion-participants.admin.recalculate_modal_progress',
                { processed: self.processed, total: self.total }),
              ' (' + pct + '%)');

      var chunkLog = self.chunkLog.length > 0
        ? m('div', { style: 'margin-top:1rem;max-height:160px;overflow-y:auto;font-size:0.8rem;font-family:monospace;background:var(--control-bg);border-radius:4px;padding:0.5rem 0.75rem;' },
            self.chunkLog.map(function (entry, i) {
              return m('div', { key: i, style: 'padding:1px 0;color:var(--muted-color);' },
                'Chunk ' + (i + 1) + ': discussions ' + entry.from + '\u2013' + entry.to + ' \u2014 ' + entry.secs + 's'
              );
            }),
            self.complete && self.totalElapsed !== null
              ? m('div', { style: 'margin-top:0.4rem;padding-top:0.4rem;border-top:1px solid var(--control-border-color,#ddd);font-weight:600;color:var(--body-color);' },
                  'Total: ' + self.totalElapsed + 's')
              : null
          )
        : null;

      var action = self.running
        ? m('div', { style: 'display:flex;justify-content:center;margin-top:1.25rem;' },
            m(LoadingIndicator(), { size: 'small', display: 'inline' }))
        : m('div', { style: 'display:flex;justify-content:center;margin-top:1.25rem;' },
            m(Button(), {
              className: 'Button Button--primary',
              onclick: function () { app().modal.close(); }
            }, app().translator.trans('resofire-discussion-participants.admin.recalculate_modal_close')));

      return m('div.Modal-body', { style: 'padding:1.5rem;' },
        warning,
        progressBar,
        statusLine,
        chunkLog,
        action
      );
    };

    C.prototype.run = function () {
      var self       = this;
      var recalcUrl  = app().forum.attribute('apiUrl') + '/resofire/participants/recalculate';
      var suppressAlert = { errorHandler: function (e) { throw e; } };

      app().request(Object.assign({ method: 'GET', url: recalcUrl }, suppressAlert))
        .then(function (r) {
          self.total = (r && r.total) || 0;
          var totalMs = 0;
          m.redraw();

          if (self.total === 0) {
            self.running      = false;
            self.complete     = true;
            self.totalElapsed = '0.0';
            m.redraw();
            return;
          }

          function runChunk(offset) {
            return app().request(Object.assign({
              method: 'POST',
              url: recalcUrl,
              body: { offset: offset, limit: CHUNK_SIZE }
            }, suppressAlert)).then(function (d) {
              var recomputed = d && d.recomputed || 0;
              var chunkMs    = d && d.duration_ms || 0;
              totalMs += chunkMs;
              var done       = offset + recomputed;
              self.processed = Math.min(done, self.total);

              var rangeFrom = offset + 1;
              var rangeTo   = Math.min(offset + recomputed, self.total);
              var secs      = (chunkMs / 1000).toFixed(1);
              self.chunkLog.push({ from: rangeFrom, to: rangeTo, secs: secs });
              m.redraw();

              if (done < self.total) {
                return runChunk(offset + CHUNK_SIZE);
              }

              self.processed    = self.total;
              self.running      = false;
              self.complete     = true;
              self.totalElapsed = (totalMs / 1000).toFixed(1);
              m.redraw();
            });
          }

          return runChunk(0);
        })
        .catch(function (e) {
          self.running  = false;
          self.errorMsg = (e && e.message) || app().translator.trans('resofire-discussion-participants.admin.recalculate_error');
          m.redraw();
        });
    };

    return C;
  }(Modal());

  // ---------------------------------------------------------------------------
  // ParticipantsExtensionPage — custom admin page with Recalculate button.
  // In 2.x we use the Admin extender's page() method instead of registerPage().
  // app.extensionData has been removed; the Admin extender handles registration.
  // ---------------------------------------------------------------------------
  var ParticipantsExtensionPage = function (base) {
    function C() { return base.apply(this, arguments) || this; }
    C.prototype = Object.create(base.prototype);
    C.prototype.constructor = C;

    C.prototype.content = function () {
      return m('div.Form', { style: 'padding:1.5rem;' },
        m('p.helpText',
          app().translator.trans('resofire-discussion-participants.admin.recalculate_help')),
        m(Button(), {
          className: 'Button Button--primary',
          onclick: function () {
            app().modal.show(RecalculateModal);
          }
        }, app().translator.trans('resofire-discussion-participants.admin.recalculate_button'))
      );
    };

    return C;
  }(ExtensionPage());

  // ---------------------------------------------------------------------------
  // Initializer
  // In 2.x, the Admin extender handles page registration via extend.php on the
  // PHP side. On the JS side we simply export the page component so the Admin
  // extender can reference it.
  // ---------------------------------------------------------------------------
  app().initializers.add('resofire-discussion-participants', function () {
    // Nothing to do here — page is registered via the Admin extender in extend.php.
    // The ParticipantsExtensionPage export is picked up automatically by the
    // Export Registry.
  });

})();

// Export the page component for the Admin extender to reference.
Object.assign(flarum.reg.exports, {
  'resofire/discussion-participants/admin/components/ParticipantsExtensionPage': ParticipantsExtensionPage
});
