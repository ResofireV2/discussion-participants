(()=>{var t={n:o=>{var s=o&&o.__esModule?()=>o.default:()=>o;return t.d(s,{a:s}),s},d:(o,s)=>{for(var n in s)t.o(s,n)&&!t.o(o,n)&&Object.defineProperty(o,n,{enumerable:!0,get:s[n]})},o:(t,o)=>Object.prototype.hasOwnProperty.call(t,o),r:t=>{"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(t,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(t,"__esModule",{value:!0})}},o={};(()=>{"use strict";t.r(o);

// Inheritance helpers — exact pattern from flarum/likes compiled bundle.
function g(t,o){return g=Object.setPrototypeOf?Object.setPrototypeOf.bind():function(t,o){return t.__proto__=o,t},g(t,o)}
function _(t,o){t.prototype=Object.create(o.prototype),t.prototype.constructor=t,g(t,o)}

// --- Imports (2.x: flarum.reg.get replaces flarum.core.compat) ---
// "components/ExtensionPage" renamed to "admin/components/ExtensionPage" in 2.x.
const _app=flarum.reg.get("core","admin/app");var app=t.n(_app);
const _Button=flarum.reg.get("core","common/components/Button");var Button=t.n(_Button);
const _Modal=flarum.reg.get("core","common/components/Modal");var Modal=t.n(_Modal);
const _LoadingIndicator=flarum.reg.get("core","common/components/LoadingIndicator");var LoadingIndicator=t.n(_LoadingIndicator);
const _ExtensionPage=flarum.reg.get("core","admin/components/ExtensionPage");var ExtensionPage=t.n(_ExtensionPage);

var CHUNK_SIZE=2000;

// ---------------------------------------------------------------------------
// RecalculateModal
// ---------------------------------------------------------------------------
var RecalculateModal=function(base){
  function C(){return base.apply(this,arguments)||this}
  _(C,base);

  // isDismissible must be a static property on the constructor — Flarum reads
  // Constructor.dismissibleOptions which checks the static isDismissible flag.
  // Setting it on the prototype via p.isDismissible = fn has no effect.
  C.isDismissible=false;

  var p=C.prototype;

  p.oninit=function(vnode){
    base.prototype.oninit.call(this,vnode);
    this.total=0;
    this.processed=0;
    this.running=true;
    this.complete=false;
    this.errorMsg=null;
    this.chunkLog=[];
    this.totalElapsed=null;
    this.run();
  };

  p.className=function(){return"RecalculateModal Modal--small";};

  p.title=function(){
    return app().translator.trans("resofire-discussion-participants.admin.recalculate_modal_title");
  };

  p.content=function(){
    var self=this;
    var pct=self.total>0?Math.round((self.processed/self.total)*100):0;

    var warning=self.running
      ?m("div.Alert.Alert--warning",{style:"margin-bottom:1rem;display:flex;align-items:center;gap:8px;"},
          m("span.fas.fa-exclamation-triangle",{style:"flex-shrink:0;"}),
          m("span",app().translator.trans("resofire-discussion-participants.admin.recalculate_modal_warning")))
      :null;

    var progressBar=m("div",{style:"background:var(--control-bg);border-radius:6px;overflow:hidden;height:18px;margin-bottom:0.75rem;"},
      m("div",{style:"width:"+pct+"%;height:100%;background:var(--primary-color);transition:width 0.3s ease;"})
    );

    var statusLine=self.complete
      ?m("p",{style:"text-align:center;margin:0;color:var(--success-color,#57a957);font-weight:600;"},
          app().translator.trans("resofire-discussion-participants.admin.recalculate_modal_complete",{total:self.total}))
      :self.errorMsg
        ?m("p",{style:"text-align:center;margin:0;color:#c0392b;"},self.errorMsg)
        :m("p",{style:"text-align:center;margin:0;color:var(--muted-color);"},
            app().translator.trans("resofire-discussion-participants.admin.recalculate_modal_progress",
              {processed:self.processed,total:self.total}),
            " ("+pct+"%)");

    var action=self.running
      ?m("div",{style:"display:flex;justify-content:center;margin-top:1.25rem;"},
          m(LoadingIndicator(),{size:"small",display:"inline"}))
      :m("div",{style:"display:flex;justify-content:center;margin-top:1.25rem;"},
          m(Button(),{
            className:"Button Button--primary",
            onclick:function(){app().modal.close();}
          },app().translator.trans("resofire-discussion-participants.admin.recalculate_modal_close")));

    // Chunk log — appears after the first chunk completes, scrollable.
    var chunkLog=self.chunkLog.length>0
      ?m("div",{style:"margin-top:1rem;max-height:160px;overflow-y:auto;font-size:0.8rem;font-family:monospace;background:var(--control-bg);border-radius:4px;padding:0.5rem 0.75rem;"},
          self.chunkLog.map(function(entry,i){
            return m("div",{key:i,style:"padding:1px 0;color:var(--muted-color);"},
              "Chunk "+(i+1)+": discussions "+entry.from+"–"+entry.to+" — "+entry.secs+"s"
            );
          }),
          self.complete&&self.totalElapsed!==null
            ?m("div",{style:"margin-top:0.4rem;padding-top:0.4rem;border-top:1px solid var(--control-border-color,#ddd);font-weight:600;color:var(--body-color);"},
                "Total: "+self.totalElapsed+"s")
            :null
        )
      :null;

    return m("div.Modal-body",{style:"padding:1.5rem;"},
      warning,
      progressBar,
      statusLine,
      chunkLog,
      action
    );
  };

  p.run=function(){
    var self=this;
    var recalcUrl=app().forum.attribute("apiUrl")+"/resofire/participants/recalculate";

    // Suppress Flarum's default global error alert for all our requests so
    // that failures surface only inside the modal, not as a page-level Oops.
    var suppressAlert={errorHandler:function(e){throw e;}};

    // Step 1: GET total.
    app().request(Object.assign({method:"GET",url:recalcUrl},suppressAlert))
      .then(function(r){
        self.total=(r&&r.total)||0;
        var totalMs=0;
        m.redraw();

        if(self.total===0){
          self.running=false;
          self.complete=true;
          self.totalElapsed="0.0";
          m.redraw();
          return;
        }

        // Step 2: sequential chunk loop.
        // Pass body as a plain object — m.request serialises it to JSON and
        // sets Content-Type: application/json automatically. Passing a
        // pre-stringified string causes double-encoding and a parse failure.
        function runChunk(offset){
          return app().request(Object.assign({
            method:"POST",
            url:recalcUrl,
            body:{offset:offset,limit:CHUNK_SIZE}
          },suppressAlert)).then(function(d){
            var recomputed=d&&d.recomputed||0;
            var chunkMs=d&&d.duration_ms||0;
            totalMs+=chunkMs;
            var done=offset+recomputed;
            self.processed=Math.min(done,self.total);

            // Log this chunk: range and server-measured duration.
            var rangeFrom=offset+1;
            var rangeTo=Math.min(offset+recomputed,self.total);
            var secs=(chunkMs/1000).toFixed(1);
            self.chunkLog.push({from:rangeFrom,to:rangeTo,secs:secs});
            m.redraw();

            if(done<self.total){
              return runChunk(offset+CHUNK_SIZE);
            }

            // All chunks complete — sum of chunk times is the total.
            self.processed=self.total;
            self.running=false;
            self.complete=true;
            self.totalElapsed=(totalMs/1000).toFixed(1);
            m.redraw();
          });
        }

        return runChunk(0);
      })
      .catch(function(e){
        self.running=false;
        self.errorMsg=(e&&e.message)||app().translator.trans("resofire-discussion-participants.admin.recalculate_error");
        m.redraw();
      });
  };

  return C;
}(Modal());

// ---------------------------------------------------------------------------
// ParticipantsExtensionPage
// Custom extension page that renders the Recalculate button without a
// settings form wrapper, eliminating the spurious Save Changes button that
// registerSetting appends automatically.
// Extends ExtensionPage so the standard header (title, enable toggle,
// description, version) is preserved unchanged.
// ---------------------------------------------------------------------------
var ParticipantsExtensionPage=function(base){
  function C(){return base.apply(this,arguments)||this}
  _(C,base);

  // Override only content() — header(), sections(), permissions grid etc.
  // all remain from ExtensionPage unchanged.
  C.prototype.content=function(){
    return m("div.ExtensionPage-settings",
      m("div.container",
        m("p.helpText",app().translator.trans("resofire-discussion-participants.admin.recalculate_help")),
        m("div.Form-group",
          m(Button(),{
            className:"Button Button--primary",
            onclick:function(){app().modal.show(RecalculateModal);}
          },app().translator.trans("resofire-discussion-participants.admin.recalculate_button"))
        )
      )
    );
  };

  return C;
}(ExtensionPage());

// ---------------------------------------------------------------------------
// Admin initializer — registers the custom page (no registerSetting needed).
// ---------------------------------------------------------------------------
app().initializers.add("resofire-discussion-participants",function(){
  app().extensionData.for("resofire-discussion-participants")
    .registerPage(ParticipantsExtensionPage);
});

})(),module.exports=o})();
