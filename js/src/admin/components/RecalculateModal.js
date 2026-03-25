import app from 'flarum/admin/app';
import Modal from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';

const CHUNK_SIZE = 2000;

export default class RecalculateModal extends Modal {
  // Flarum 2.x: `static isDismissible = false` no longer exists.
  // The 2.x Modal uses three separate protected static readonly booleans.
  // All three must be set to prevent every dismissal vector.
  static isDismissibleViaCloseButton = false;
  static isDismissibleViaEscKey = false;
  static isDismissibleViaBackdropClick = false;

  oninit(vnode) {
    super.oninit(vnode);
    this.total = 0;
    this.processed = 0;
    this.running = true;
    this.complete = false;
    this.errorMsg = null;
    this.chunkLog = [];
    this.totalElapsed = null;
    this.run();
  }

  className() {
    return 'RecalculateModal Modal--small';
  }

  title() {
    return app.translator.trans('resofire_blog_cards.admin.recalculate_modal_title');
  }

  content() {
    const pct = this.total > 0 ? Math.round((this.processed / this.total) * 100) : 0;

    const warning = this.running
      ? <div className="Alert Alert--warning" style="margin-bottom:1rem;display:flex;align-items:center;gap:8px;">
          <span className="fas fa-exclamation-triangle" style="flex-shrink:0;" />
          <span>{app.translator.trans('resofire_blog_cards.admin.recalculate_modal_warning')}</span>
        </div>
      : null;

    const progressBar = (
      <div style="background:var(--control-bg);border-radius:6px;overflow:hidden;height:18px;margin-bottom:0.75rem;">
        <div style={`width:${pct}%;height:100%;background:var(--primary-color);transition:width 0.3s ease;`} />
      </div>
    );

    const statusLine = this.complete
      ? <p style="text-align:center;margin:0;color:var(--success-color,#57a957);font-weight:600;">
          {app.translator.trans('resofire_blog_cards.admin.recalculate_modal_complete', { total: this.total })}
        </p>
      : this.errorMsg
        ? <p style="text-align:center;margin:0;color:#c0392b;">{this.errorMsg}</p>
        : <p style="text-align:center;margin:0;color:var(--muted-color);">
            {app.translator.trans('resofire_blog_cards.admin.recalculate_modal_progress', { processed: this.processed, total: this.total })}
            {` (${pct}%)`}
          </p>;

    const action = this.running
      ? <div style="display:flex;justify-content:center;margin-top:1.25rem;">
          {LoadingIndicator.component({ size: 'small', display: 'inline' })}
        </div>
      : <div style="display:flex;justify-content:center;margin-top:1.25rem;">
          {Button.component({ className: 'Button Button--primary', onclick: () => app.modal.close() },
            app.translator.trans('resofire_blog_cards.admin.recalculate_modal_close'))}
        </div>;

    const chunkLog = this.chunkLog.length > 0
      ? <div style="margin-top:1rem;max-height:160px;overflow-y:auto;font-size:0.8rem;font-family:monospace;background:var(--control-bg);border-radius:4px;padding:0.5rem 0.75rem;">
          {this.chunkLog.map((entry, i) => (
            <div key={i} style="padding:1px 0;color:var(--muted-color);">
              {`Chunk ${i + 1}: discussions ${entry.from}–${entry.to} — ${entry.secs}s`}
            </div>
          ))}
          {this.complete && this.totalElapsed !== null
            ? <div style="margin-top:0.4rem;padding-top:0.4rem;border-top:1px solid var(--control-border-color,#ddd);font-weight:600;color:var(--body-color);">
                {`Total: ${this.totalElapsed}s`}
              </div>
            : null}
        </div>
      : null;

    return (
      <div className="Modal-body" style="padding:1.5rem;">
        {warning}
        {progressBar}
        {statusLine}
        {chunkLog}
        {action}
      </div>
    );
  }

  run() {
    const recalcUrl = app.forum.attribute('apiUrl') + '/resofire/blog-cards/recalculate';
    const suppressAlert = { errorHandler: (e) => { throw e; } };
    let totalMs = 0;

    app.request(Object.assign({ method: 'GET', url: recalcUrl }, suppressAlert))
      .then((r) => {
        this.total = (r && r.total) || 0;
        m.redraw();

        if (this.total === 0) {
          this.running = false;
          this.complete = true;
          this.totalElapsed = '0.0';
          m.redraw();
          return;
        }

        const runChunk = (offset) => {
          return app.request(Object.assign({
            method: 'POST',
            url: recalcUrl,
            body: { offset, limit: CHUNK_SIZE },
          }, suppressAlert)).then((d) => {
            const recomputed = (d && d.recomputed) || 0;
            const chunkMs = (d && d.duration_ms) || 0;
            totalMs += chunkMs;
            const done = offset + recomputed;
            this.processed = Math.min(done, this.total);

            const rangeFrom = offset + 1;
            const rangeTo = Math.min(offset + recomputed, this.total);
            const secs = (chunkMs / 1000).toFixed(1);
            this.chunkLog.push({ from: rangeFrom, to: rangeTo, secs });
            m.redraw();

            if (done < this.total) return runChunk(offset + CHUNK_SIZE);

            this.processed = this.total;
            this.running = false;
            this.complete = true;
            this.totalElapsed = (totalMs / 1000).toFixed(1);
            m.redraw();
          });
        };

        return runChunk(0);
      })
      .catch((e) => {
        this.running = false;
        this.errorMsg = (e && e.message) || app.translator.trans('resofire_blog_cards.admin.recalculate_error');
        m.redraw();
      });
  }
}
