(()=>{var t={n:o=>{var s=o&&o.__esModule?()=>o.default:()=>o;return t.d(s,{a:s}),s},d:(o,s)=>{for(var n in s)t.o(s,n)&&!t.o(o,n)&&Object.defineProperty(o,n,{enumerable:!0,get:s[n]})},o:(t,o)=>Object.prototype.hasOwnProperty.call(t,o),r:t=>{"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(t,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(t,"__esModule",{value:!0})}},o={};(()=>{"use strict";t.r(o);

// Inheritance helpers — exact pattern from flarum/likes compiled bundle.
function g(t,o){return g=Object.setPrototypeOf?Object.setPrototypeOf.bind():function(t,o){return t.__proto__=o,t},g(t,o)}
function _(t,o){t.prototype=Object.create(o.prototype),t.prototype.constructor=t,g(t,o)}

const _app=flarum.core.compat["forum/app"];var app=t.n(_app);
const _ReplyComposer=flarum.core.compat["forum/components/ReplyComposer"];var ReplyComposer=t.n(_ReplyComposer);
const _extend=flarum.core.compat["common/extend"];
const _extenders=flarum.core.compat["common/extenders"];var extenders=t.n(_extenders);
const _Discussion=flarum.core.compat["common/models/Discussion"];var Discussion=t.n(_Discussion);
const _Component=flarum.core.compat["Component"];var Component=t.n(_Component);
const _Modal=flarum.core.compat["common/components/Modal"];var Modal=t.n(_Modal);
const _Button=flarum.core.compat["common/components/Button"];var Button=t.n(_Button);
const _LoadingIndicator=flarum.core.compat["common/components/LoadingIndicator"];var LoadingIndicator=t.n(_LoadingIndicator);
const _Tooltip=flarum.core.compat["common/components/Tooltip"];var Tooltip=t.n(_Tooltip);
const _avatar=flarum.core.compat["common/helpers/avatar"];var avatar=t.n(_avatar);
const _DiscussionListItem=flarum.core.compat["forum/components/DiscussionListItem"];var DiscussionListItem=t.n(_DiscussionListItem);
const _DiscussionListState=flarum.core.compat["forum/states/DiscussionListState"];var DiscussionListState=t.n(_DiscussionListState);

// Model extender — registers Discussion.prototype.participantPreview = hasMany(...)
// Exported as 'extend' array so bootExtensions calls extender.extend(app, ...).
var E=[(new(extenders().Model)(Discussion())).hasMany("participantPreview")];
t.d(o,{extend:()=>E});

// ParticipantsModal — extends Modal, using proper inheritance helpers
var PAGE_SIZE=10;
var ParticipantsModal=function(base){
  function C(){return base.apply(this,arguments)||this}
  _(C,base);
  var p=C.prototype;
  p.oninit=function(vnode){
    base.prototype.oninit.call(this,vnode);
    this._discussionId=vnode.attrs.discussion.id();
    this.participants=[];this.page=0;this.total=null;this.loading=false;
    this.loadPage();
  };
  p.onbeforeupdate=function(vnode){
    // Flarum reuses the modal component instance between opens.
    // If the discussion changed, reset all state and reload from page 0.
    var newId=vnode.attrs.discussion.id();
    if(newId!==this._discussionId){
      this._discussionId=newId;
      this.participants=[];this.page=0;this.total=null;this.loading=false;
      this.loadPage();
    }
  };
  p.className=function(){return"ParticipantsModal Modal--small";};
  p.title=function(){var c=this.total!==null?this.total:(this.attrs.discussion.attribute("participantCount")||"");return app().translator.trans("resofire-discussion-participants.forum.modal_title",{count:c});};
  p.content=function(){
    var self=this;
    if(this.participants.length===0&&this.loading)return m("div.Modal-body",m(LoadingIndicator()));
    var totalPages=this.total!==null?Math.ceil(this.total/PAGE_SIZE):null;
    var hasPrev=this.page>0;
    var hasNext=this.total===null||((this.page+1)*PAGE_SIZE)<this.total;
    var items=this.participants.map(function(u){
      var displayName=u.displayName?u.displayName():(u.username?u.username():"");
      var slug=u.slug?u.slug():(displayName||"");
      return m("li.ParticipantsModal-item",m("a",{href:app().route("user",{username:slug}),onclick:function(){app().modal.close();}},
        avatar()(u),
        m("span.ParticipantsModal-username",displayName)));
    });
    var pagination=null;
    if(hasPrev||hasNext){
      pagination=m("div.ParticipantsModal-pagination",
        m(Button(),{className:"Button",disabled:!hasPrev||this.loading,onclick:function(){self.page--;self.loadPage();}},"\u2190 Prev"),
        m("span.ParticipantsModal-pageInfo",(this.page+1)+(totalPages!==null?" / "+totalPages:"")),
        m(Button(),{className:"Button Button--primary",disabled:!hasNext||this.loading,onclick:function(){self.page++;self.loadPage();}},"Next \u2192")
      );
    }
    return m("div.Modal-body",
      this.loading?m(LoadingIndicator()):null,
      m("ul.ParticipantsModal-list",items),
      pagination
    );
  };
  p.loadPage=function(){
    if(this.loading)return;
    var self=this;this.loading=true;m.redraw();
    app().request({method:"GET",url:app().forum.attribute("apiUrl")+"/discussions/"+this.attrs.discussion.id()+"/participants",params:{"page[offset]":self.page*PAGE_SIZE,"page[limit]":PAGE_SIZE}})
      .then(function(r){
        var remapped={data:(r.data||[]).map(function(i){return{type:"users",id:i.attributes.userId!=null?String(i.attributes.userId):i.id,attributes:{username:i.attributes.username,slug:i.attributes.slug,avatarUrl:i.attributes.avatarUrl,displayName:i.attributes.displayName,color:i.attributes.color}};})};
        app().store.pushPayload(remapped);
        var users=(r.data||[]).map(function(i){var uid=i.attributes.userId!=null?i.attributes.userId:i.id;return app().store.getById("users",String(uid));}).filter(Boolean);
        self.participants=users;
        self.total=(r.meta&&r.meta.total!=null)?r.meta.total:null;
        self.loading=false;m.redraw();
      })
      .catch(function(){self.loading=false;m.redraw();});
  };
  return C;
}(Modal());

// DiscussionParticipants — preview strip in discussion list.
// 'preview' items are Flarum User models from the store (via hasMany relationship).
// Use user.displayName() for tooltip text (not username() helper — that returns a vnode).
var DiscussionParticipants=function(base){
  function C(){return base.apply(this,arguments)||this}
  _(C,base);
  C.prototype.view=function(){
    var discussion=this.attrs.discussion;
    var preview=(discussion.participantPreview()||[]).filter(Boolean);
    if(!preview.length)return m("[");
    // 7 avatars are always shown when the strip is full: 1 OP (shown by Flarum
    // core) + 6 repliers (our strip). Overflow is simply how many participants
    // are not represented by one of those 7 avatars.
    var total=discussion.attribute("participantCount")!=null?discussion.attribute("participantCount"):0;
    var overflowN=Math.max(0,total-7);
    var avatars=preview.map(function(user){
      var name=user.displayName?user.displayName():(user.username?user.username():"");
      return m(Tooltip(),{text:name,position:"bottom"},
        m("a.DiscussionParticipants-avatar",{href:app().route("user",{username:user.slug()}),onclick:function(e){e.stopPropagation();}},
          avatar()(user)));
    });
    var overflowBtn=null;
    if(overflowN>0){
      overflowBtn=m("button.DiscussionParticipants-overflow.Button.Button--icon.Button--flat",{type:"button",
        title:app().translator.trans("resofire-discussion-participants.forum.show_all_participants"),
        onclick:function(e){e.stopPropagation();e.preventDefault();app().modal.show(ParticipantsModal,{discussion:discussion});}
      },"+"+overflowN);
    }
    return m("div.DiscussionParticipants",avatars,overflowBtn);
  };
  return C;
}(Component());

app().initializers.add("resofire-discussion-participants",function(){
  // Extend DiscussionListState.requestParams to add participantPreview to the
  // include array. PaginatedListState.loadPage joins this into ?include=...,
  // so the server serializes participantPreview users on every load-more fetch,
  // not just the initial preloaded document. Without this, hasMany lookups
  // return empty on every page after the first.
  (0,_extend.extend)(DiscussionListState().prototype,"requestParams",function(params){
    params.include.push("participantPreview");
  });

  (0,_extend.extend)(DiscussionListItem().prototype,"infoItems",function(items){
    var discussion=this.attrs.discussion;
    var preview=(discussion.participantPreview()||[]).filter(Boolean);
    if(!preview.length)return;
    items.add("participants",m(DiscussionParticipants,{discussion:discussion}),-10);
  });


  // When a new post is saved successfully and the preview strip has fewer than
  // 6 avatars, append the current user's avatar to the strip immediately so it
  // appears without a page refresh.
  //
  // Strategy: override ReplyComposer.onsubmit. Before calling original(), wrap
  // app.store.createRecord so we can chain onto the save promise. When the post
  // resolves we check if the current user is already in the preview strip; if
  // not and there is room (< 6), we patch the participantPreview relationship
  // data directly on the discussion model in the store and trigger a redraw.
  // createRecord is restored immediately after being called so no other code
  // is affected.
  (0,_extend.override)(ReplyComposer().prototype,"onsubmit",function(original){
    var self=this;
    var discussion=self.attrs.discussion;
    var discussionId=String(discussion.id());
    var currentUser=app().session.user;

    // If we can't identify the current user, just run normally.
    if(!currentUser){
      original();
      return;
    }

    var currentUserId=String(currentUser.id());

    // Wrap createRecord just-in-time so we intercept only this save call.
    var originalCreateRecord=app().store.createRecord.bind(app().store);
    app().store.createRecord=function(type,data){
      // Restore immediately — only intercept this one call.
      app().store.createRecord=originalCreateRecord;
      var record=originalCreateRecord(type,data);
      if(type==="posts"){
        var originalSave=record.save.bind(record);
        record.save=function(saveData){
          return originalSave(saveData).then(function(post){
            var disc=app().store.getById("discussions",discussionId);
            if(!disc)return post;

            var preview=(disc.participantPreview()||[]).filter(Boolean);

            // Only patch if strip has room (< 6) and user not already present.
            if(preview.length>=6)return post;
            var alreadyIn=preview.some(function(u){return String(u.id())===currentUserId;});
            if(alreadyIn)return post;

            // Append current user to the participantPreview relationship data.
            var rel=disc.data.relationships=disc.data.relationships||{};
            rel.participantPreview=rel.participantPreview||{data:[]};
            if(!Array.isArray(rel.participantPreview.data)){
              rel.participantPreview.data=[];
            }
            rel.participantPreview.data.push({type:"users",id:currentUserId});
            disc.freshness=new Date();
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

Object.assign(flarum.core.compat,{});
})(),module.exports=o})();
