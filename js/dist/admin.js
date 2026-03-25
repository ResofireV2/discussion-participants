(()=>{var t={n:o=>{var s=o&&o.__esModule?()=>o.default:()=>o;return t.d(s,{a:s}),s},d:(o,s)=>{for(var n in s)t.o(s,n)&&!t.o(o,n)&&Object.defineProperty(o,n,{enumerable:!0,get:s[n]})},o:(t,o)=>Object.prototype.hasOwnProperty.call(t,o),r:t=>{"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(t,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(t,"__esModule",{value:!0})}},o={};(()=>{"use strict";t.r(o);

// ---------------------------------------------------------------------------
// Imports — flarum.reg.get() is the 2.x module system.
// Reference classes directly; do NOT wrap in .n() — that returns a function
// that returns the class, not the class itself, breaking `new` and `extends`.
// ---------------------------------------------------------------------------
const app              = flarum.reg.get("core","admin/app");
const Button           = flarum.reg.get("core","common/components/Button");
const Modal            = flarum.reg.get("core","common/components/Modal");
const LoadingIndicator = flarum.reg.get("core","common/components/LoadingIndicator");
const ExtensionPage    = flarum.reg.get("core","admin/components/ExtensionPage");
const extenders        = flarum.reg.get("core","common/extenders");

const CHUNK_SIZE = 2000;

// ---------------------------------------------------------------------------
// RecalculateModal — ES6 class extends (required for native ES6 base classes)
// ---------------------------------------------------------------------------
class RecalculateModal extends Modal {
  static get isDismissibleViaCloseButton()  { return false; }
  static get isDismissibleViaEscKey()       { return false; }
  static get isDismissibleViaBackdropClick(){ return false; }

  oninit(vnode) {
    super.oninit(vnode);
    this.total        = 0;
    this.processed    = 0;
    this.running      = true;
    this.complete     = false;
    this.errorMsg     = null;
    this.chunkLog     = [];
    this.totalElapsed = null;
    this.run();
  }

  className() { return "RecalculateModal Modal--small"; }

  title() {
    return app.translator.trans("resofire-discussion-participants.admin.recalculate_modal_title");
  }

  content() {
    const pct = this.total > 0 ? Math.round((this.processed / this.total) * 100) : 0;

    const warning = this.running
      ? m("div", {className:"Alert Alert--warning", style:"margin-bottom:1rem;display:flex;align-items:center;gap:8px;"},
          m("span", {className:"fas fa-exclamation-triangle", style:"flex-shrink:0;"}),
          m("span", app.translator.trans("resofire-discussion-participants.admin.recalculate_modal_warning")))
      : null;

    const progressBar = m("div", {style:"background:var(--control-bg);border-radius:6px;overflow:hidden;height:18px;margin-bottom:0.75rem;"},
      m("div", {style:"width:"+pct+"%;height:100%;background:var(--primary-color);transition:width 0.3s ease;"})
    );

    const statusLine = this.complete
      ? m("p", {style:"text-align:center;margin:0;color:var(--success-color,#57a957);font-weight:600;"},
          app.translator.trans("resofire-discussion-participants.admin.recalculate_modal_complete", {total:this.total}))
      : this.errorMsg
        ? m("p", {style:"text-align:center;margin:0;color:#c0392b;"}, this.errorMsg)
        : m("p", {style:"text-align:center;margin:0;color:var(--muted-color);"},
            app.translator.trans("resofire-discussion-participants.admin.recalculate_modal_progress",
              {processed:this.processed, total:this.total}),
            " ("+pct+"%)");

    const action = this.running
      ? m("div", {style:"display:flex;justify-content:center;margin-top:1.25rem;"},
          m(LoadingIndicator, {size:"small", display:"inline"}))
      : m("div", {style:"display:flex;justify-content:center;margin-top:1.25rem;"},
          m(Button, {
            className:"Button Button--primary",
            onclick: () => app.modal.close()
          }, app.translator.trans("resofire-discussion-participants.admin.recalculate_modal_close")));

    const chunkLog = this.chunkLog.length > 0
      ? m("div", {style:"margin-top:1rem;max-height:160px;overflow-y:auto;font-size:0.8rem;font-family:monospace;background:var(--control-bg);border-radius:4px;padding:0.5rem 0.75rem;"},
          this.chunkLog.map((entry, i) =>
            m("div", {key:i, style:"padding:1px 0;color:var(--muted-color);"},
              "Chunk "+(i+1)+": discussions "+entry.from+"-"+entry.to+" - "+entry.secs+"s"
            )
          ),
          (this.complete && this.totalElapsed !== null)
            ? m("div", {style:"margin-top:0.4rem;padding-top:0.4rem;border-top:1px solid var(--control-border-color,#ddd);font-weight:600;color:var(--body-color);"},
                "Total: "+this.totalElapsed+"s")
            : null
        )
      : null;

    return m("div", {className:"Modal-body", style:"padding:1.5rem;"},
      warning, progressBar, statusLine, chunkLog, action
    );
  }

  run() {
    const recalcUrl    = app.forum.attribute("apiUrl") + "/resofire/participants/recalculate";
    const suppressAlert = {errorHandler: (e) => { throw e; }};

    app.request(Object.assign({method:"GET", url:recalcUrl}, suppressAlert))
      .then(r => {
        this.total = (r && r.total) || 0;
        let totalMs = 0;
        m.redraw();

        if (this.total === 0) {
          this.running      = false;
          this.complete     = true;
          this.totalElapsed = "0.0";
          m.redraw();
          return;
        }

        const runChunk = (offset) =>
          app.request(Object.assign({
            method:"POST", url:recalcUrl,
            body:{offset:offset, limit:CHUNK_SIZE}
          }, suppressAlert)).then(d => {
            const recomputed = (d && d.recomputed) || 0;
            const chunkMs    = (d && d.duration_ms)  || 0;
            totalMs += chunkMs;
            const done = offset + recomputed;
            this.processed = Math.min(done, this.total);
            this.chunkLog.push({
              from: offset + 1,
              to:   Math.min(offset + recomputed, this.total),
              secs: (chunkMs / 1000).toFixed(1)
            });
            m.redraw();

            if (done < this.total) return runChunk(offset + CHUNK_SIZE);

            this.processed    = this.total;
            this.running      = false;
            this.complete     = true;
            this.totalElapsed = (totalMs / 1000).toFixed(1);
            m.redraw();
          });

        return runChunk(0);
      })
      .catch(e => {
        this.running  = false;
        this.errorMsg = (e && e.message) ||
          app.translator.trans("resofire-discussion-participants.admin.recalculate_error");
        m.redraw();
      });
  }
}

// ---------------------------------------------------------------------------
// ParticipantsExtensionPage — only content() overridden; full header/toggle
// inherited from ExtensionPage unchanged.
// ---------------------------------------------------------------------------
class ParticipantsExtensionPage extends ExtensionPage {
  content() {
    return m("div", {className:"ExtensionPage-settings"},
      m("div", {className:"container"},
        m("p", {className:"helpText"},
          app.translator.trans("resofire-discussion-participants.admin.recalculate_help")),
        m("div", {className:"Form-group"},
          m(Button, {
            className:"Button Button--primary",
            onclick: () => app.modal.show(RecalculateModal)
          }, app.translator.trans("resofire-discussion-participants.admin.recalculate_button"))
        )
      )
    );
  }
}

// ---------------------------------------------------------------------------
// Export the extend array — Flarum's bootExtensions() calls .extend() on each
// item. Admin.page() registers our custom page for this extension's route.
// ---------------------------------------------------------------------------
t.d(o, {extend: () => _extend});
const _extend = [(new extenders.Admin()).page(ParticipantsExtensionPage)];

app.initializers.add("resofire-discussion-participants", () => {});

})(),module.exports=o})();
