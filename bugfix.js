/* =========================
   bugfix.js (终极安全排雷版)
========================= */

// ===== 公共工具 =====
(function(){
  function bfGet(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}}
  function bfSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true;}catch(e){return false;}}
  function bfDel(k){try{localStorage.removeItem(k);}catch(e){}}
  function bfToast(msg){if(typeof showToast==='function')showToast(msg);else console.log('[BUGFIX]',msg);}

  const DB_NAME='tq_bugfix_assets';
  const STORE_NAME='kv';
  let dbPromise=null;
  function idbOpen(){
    if(dbPromise)return dbPromise;
    dbPromise=new Promise(resolve=>{
      if(!('indexedDB' in window)){resolve(null);return;}
      try{
        const req=indexedDB.open(DB_NAME,1);
        req.onupgradeneeded=function(){
          const db=req.result;
          if(!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
        };
        req.onsuccess=function(){resolve(req.result);};
        req.onerror=function(){resolve(null);};
      }catch(e){resolve(null);}
    });
    return dbPromise;
  }
  async function idbGet(key){
    const db=await idbOpen();if(!db)return null;
    return new Promise(resolve=>{
      try{
        const tx=db.transaction(STORE_NAME,'readonly');
        const rq=tx.objectStore(STORE_NAME).get(key);
        rq.onsuccess=()=>resolve(rq.result != null ? rq.result : null);
        rq.onerror=()=>resolve(null);
      }catch(e){resolve(null);}
    });
  }
  async function idbSet(key,val){
    const db=await idbOpen();if(!db)return false;
    return new Promise(resolve=>{
      try{
        const tx=db.transaction(STORE_NAME,'readwrite');
        tx.objectStore(STORE_NAME).put(val,key);
        tx.oncomplete=()=>resolve(true);
        tx.onerror=()=>resolve(false);
      }catch(e){resolve(false);}
    });
  }
  async function idbDel(key){
    const db=await idbOpen();if(!db)return false;
    return new Promise(resolve=>{
      try{
        const tx=db.transaction(STORE_NAME,'readwrite');
        tx.objectStore(STORE_NAME).delete(key);
        tx.oncomplete=()=>resolve(true);
        tx.onerror=()=>resolve(false);
      }catch(e){resolve(false);}
    });
  }
  window.__TQ_BF={bfGet,bfSet,bfDel,bfToast,idbGet,idbSet,idbDel};
})();


// ===== 001 壁纸持久化修复 =====
(function(){
  const BF=window.__TQ_BF;if(!BF)return;
  function ensureWpLayer(){
    let layer=document.getElementById('tq-wp-layer');
    if(!layer){
      layer=document.createElement('div');layer.id='tq-wp-layer';
      layer.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none;background-size:cover;background-position:center;background-repeat:no-repeat;';
      document.body.insertBefore(layer,document.body.firstChild);
    }
    return layer;
  }
  function applyWallpaperVisual(src){
    const layer=ensureWpLayer();const old=document.getElementById('wallpaper');
    if(src){
      layer.style.backgroundImage='url("'+String(src).replace(/"/g,'%22')+'")';
      document.body.classList.add('has-wp');
      if(old)old.style.display='none';
    }else{
      layer.style.backgroundImage='none';document.body.classList.remove('has-wp');
      if(old){old.style.display='';old.style.background='var(--bg-pri)';}
    }
  }
  function compressDataUrl(src,maxW,limitBytes){
    maxW=maxW||1400;limitBytes=limitBytes||450*1024;
    return new Promise(resolve=>{
      try{
        const img=new Image();
        img.onload=function(){
          let w=img.width,h=img.height;if(w>maxW){h=Math.round(h*maxW/w);w=maxW;}
          const cvs=document.createElement('canvas');cvs.width=w;cvs.height=h;
          cvs.getContext('2d').drawImage(img,0,0,w,h);
          let q=0.86,out=cvs.toDataURL('image/jpeg',q);
          while(out.length>limitBytes&&q>0.45){q-=0.08;out=cvs.toDataURL('image/jpeg',q);}
          resolve(out);
        };
        img.onerror=function(){resolve(src);};img.src=src;
      }catch(e){resolve(src);}
    });
  }
  async function saveWallpaper(src){
    let out=src;
    if(/^data:image\//.test(out)&&out.length>700000)out=await compressDataUrl(out,1400,450*1024);
    const ok1=BF.bfSet('tq_wallpaper_home',out);BF.bfSet('tq_img_wallpaper_home',out);
    await BF.idbSet('wallpaper_home',out);return {src:out,okLS:ok1};
  }
  window.pickWallpaper=function(){
    if(typeof openUploadModal!=='function'){BF.bfToast('上传模块未就绪');return;}
    openUploadModal('wallpaper_home',function(k,src){
      window._wpTemp=src;const prev=document.getElementById('set-wp-home');
      if(prev)prev.innerHTML='<img src="'+src+'" alt="">';
      BF.bfToast('预览已更新，点击"应用保存"生效');
    });
  };
  window.applyWallpaper=async function(){
    const input=document.getElementById('set-wp-url');const urlVal=input?input.value.trim():'';
    if(urlVal){window._wpTemp=urlVal;const prev=document.getElementById('set-wp-home');if(prev)prev.innerHTML='<img src="'+urlVal+'" alt="">';}
    if(!window._wpTemp){BF.bfToast('请选择图片或输入URL');return;}
    const ret=await saveWallpaper(window._wpTemp);window._wpTemp=ret.src;
    applyWallpaperVisual(ret.src);
    if(ret.okLS)BF.bfToast('壁纸已应用保存');else BF.bfToast('壁纸已应用');
  };
  window.clearWallpaper=function(){
    function doClear(){
      window._wpTemp=null;BF.bfDel('tq_wallpaper_home');BF.bfDel('tq_img_wallpaper_home');BF.idbDel('wallpaper_home');
      applyWallpaperVisual(null);
      const prev=document.getElementById('set-wp-home');if(prev)prev.innerHTML='<span style="font-size:12px;color:var(--txt-light);">点击下方按钮设置</span>';
      const input=document.getElementById('set-wp-url');if(input)input.value='';
      BF.bfToast('壁纸已清除');
    }
    if(typeof showModal==='function')showModal('清除壁纸','确定清除主页壁纸？',[{text:'取消',type:'cancel'},{text:'确定',type:'confirm',cb:doClear}]);
    else doClear();
  };
  async function restoreWallpaper(){
    let src=BF.bfGet('tq_wallpaper_home',null)||BF.bfGet('tq_img_wallpaper_home',null);
    if(!src){src=await BF.idbGet('wallpaper_home');if(src)BF.bfSet('tq_wallpaper_home',src);}
    if(src){
      window._wpTemp=src;applyWallpaperVisual(src);
      const prev=document.getElementById('set-wp-home');if(prev)prev.innerHTML='<img src="'+src+'" alt="">';
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',restoreWallpaper);else restoreWallpaper();
  window.addEventListener('pageshow',restoreWallpaper);
})();


// ===== 002 本地字体保存方案修复 =====
(function(){
  const BF=window.__TQ_BF;if(!BF)return;
  function renderFontSchemeSelect(){
    const sel=document.getElementById('set-font-scheme');if(!sel)return;
    const schemes=BF.bfGet('tq_font_schemes',[]);sel.innerHTML='<option value="">选择已保存字体方案</option>';
    schemes.forEach(function(s,i){const opt=document.createElement('option');opt.value=i;opt.textContent=s.name||('方案'+(i+1));sel.appendChild(opt);});
  }
  async function applyLocalFontData(dataUrl,fontName){
    try{
      const ffName='TQPatchFont_'+Date.now();const ff=new FontFace(ffName,'url('+dataUrl+')');
      const loaded=await ff.load();document.fonts.add(loaded);
      let st=document.getElementById('tq-font-scheme-patch-style');
      if(!st){st=document.createElement('style');st.id='tq-font-scheme-patch-style';document.head.appendChild(st);}
      st.textContent=`body,.p1-clock .time,.p1-clock .date,.p1-editable .text-display,.p1-editable .edit-box input,.p2-bubble,#p2-bubble-show,#p2-bubble-input,.p2-long-edit .long-text,#p2-long-input,.p3-card-title,.p3-mood .mood-content,.p3-mood .mood-content .silver-text,.p3-note textarea,.p3-countdown .cd-target,.p3-countdown .cd-time,.p3-countdown input,.app-name,.dock-label,.set-body,.set-input,.set-select,.set-label,.set-group-header .sg-title,.set-switch-label,.modal-title,.modal-msg{font-family:"${ffName}", var(--font-body) !important;}`;
      BF.bfSet('tq_custom_font_url',dataUrl);BF.bfSet('tq_custom_font_name',fontName||'本地字体');
      const cur=document.getElementById('set-font-current');if(cur)cur.textContent=fontName||'本地字体';
      return true;
    }catch(e){BF.bfToast('字体加载失败');return false;}
  }
  (async function migrateOldDataSchemes(){
    const schemes=BF.bfGet('tq_font_schemes',[]);let changed=false;
    for(let i=0;i<schemes.length;i++){
      const s=schemes[i];
      if(s&&typeof s.url==='string'&&s.url.startsWith('data:')){
        const id='fa_'+Date.now()+'_'+i;await BF.idbSet('font_asset_'+id,s.url);
        s.url='__IDB__'+id;changed=true;
      }
    }
    if(changed)BF.bfSet('tq_font_schemes',schemes);renderFontSchemeSelect();
  })();
  window.saveFontScheme=async function(){
    const currentUrl=BF.bfGet('tq_custom_font_url',null);const currentName=BF.bfGet('tq_custom_font_name','系统默认');
    if(!currentUrl){BF.bfToast('请先应用一个字体');return;}
    const name=prompt('请为此字体方案命名：');if(!name||!name.trim())return;
    const schemes=BF.bfGet('tq_font_schemes',[]);const nm=name.trim();
    if(typeof currentUrl==='string'&&currentUrl.startsWith('data:')){
      const id='fa_'+Date.now()+'_'+Math.random().toString(36).slice(2,6);
      await BF.idbSet('font_asset_'+id,currentUrl);
      schemes.push({name:nm,url:'__IDB__'+id,fontName:currentName||'本地字体'});
    }else{schemes.push({name:nm,url:currentUrl,fontName:currentName||'URL字体'});}
    if(!BF.bfSet('tq_font_schemes',schemes)){BF.bfToast('保存失败：存储空间不足');return;}
    renderFontSchemeSelect();BF.bfToast('字体方案「'+nm+'」已保存');
  };
  window.applyFontScheme=async function(){
    const sel=document.getElementById('set-font-scheme');if(!sel||sel.value===''){BF.bfToast('请先选择方案');return;}
    const schemes=BF.bfGet('tq_font_schemes',[]);const s=schemes[parseInt(sel.value,10)];if(!s){BF.bfToast('方案不存在');return;}
    if(typeof s.url==='string'&&s.url.startsWith('__IDB__')){
      const id=s.url.slice('__IDB__'.length);const data=await BF.idbGet('font_asset_'+id);
      if(!data){BF.bfToast('本地字体资源丢失');return;}
      const ok=await applyLocalFontData(data,s.fontName||'本地字体');if(ok)BF.bfToast('字体方案「'+s.name+'」已应用');return;
    }
    const inp=document.getElementById('set-font-url');if(inp)inp.value=s.url||'';
    if(typeof window.applyFont==='function'){window.applyFont();BF.bfToast('字体方案「'+s.name+'」已应用');}
    else if(s.url){const ok=await applyLocalFontData(s.url,s.fontName||'字体');if(ok)BF.bfToast('字体方案「'+s.name+'」已应用');}
  };
  setTimeout(renderFontSchemeSelect,0);
})();


// ===== 003 字体颜色作用范围修复 =====
(function(){
  const BF=window.__TQ_BF;if(!BF)return;
  const COLOR_TARGETS=['.p1-clock .time','.p1-clock .date','.p1-editable .text-display','.p2-bubble','#p2-bubble-show','.p2-long-edit .long-text','#p2-long-show','.p3-card-title','.p3-mood .mood-content','.p3-mood .mood-content .silver-text','.p3-note textarea','.p3-countdown .cd-target','.p3-countdown .cd-time','.p3-countdown input','#cd-user-name','#cd-user-date','.p3-countdown .cd-col','.app-name','.dock-label','.circle-frame .placeholder','.p1-right-bubble','.p2-long-inner .lt-item','#p2-long-show .lt-item'];
  function applyColor(color){
    COLOR_TARGETS.forEach(sel=>{document.querySelectorAll(sel).forEach(el=>{el.style.color=color;});});
    let ph=document.getElementById('tq-ph-color-bf');if(!ph){ph=document.createElement('style');ph.id='tq-ph-color-bf';document.head.appendChild(ph);}
    ph.textContent=`#cd-user-name::placeholder{color:${color}!important;opacity:.6;} .p3-note textarea::placeholder{color:${color}!important;opacity:.5;}`;
  }
  function clearColor(){
    COLOR_TARGETS.forEach(sel=>{document.querySelectorAll(sel).forEach(el=>{el.style.color='';});});
    const ph=document.getElementById('tq-ph-color-bf');if(ph)ph.textContent='';
  }
  window.applyFontColor=function(){
    const picker=document.getElementById('set-font-color');const color=picker?picker.value:'#2c2c2c';
    applyColor(color);BF.bfSet('tq_font_color',color);
    const pv=document.getElementById('set-color-preview');if(pv)pv.textContent='当前：'+color;
    BF.bfToast('字体颜色已应用');
  };
  window.resetFontColor=function(){
    clearColor();BF.bfDel('tq_font_color');
    const picker=document.getElementById('set-font-color');if(picker)picker.value='#2c2c2c';
    const pv=document.getElementById('set-color-preview');if(pv)pv.textContent='当前：#2c2c2c';
    BF.bfToast('字体颜色已恢复默认');
  };
  const oldToggleDark=window.toggleDarkMode;
  if(typeof oldToggleDark==='function'){
    window.toggleDarkMode=function(){
      oldToggleDark();
      const isDark=BF.bfGet('tq_dark_mode',false);
      if(isDark)clearColor();else{const c=BF.bfGet('tq_font_color',null);if(c)applyColor(c);}
    };
  }
  setTimeout(function(){
    const isDark=BF.bfGet('tq_dark_mode',false);const c=BF.bfGet('tq_font_color',null);
    if(c&&!isDark)applyColor(c);
  },400);
})();

// ===== 004 图片慢加载/灰块下滑修复 =====
(function BF_IMG_RENDER_FIX(){
  function bfToast(msg){if(typeof showToast==='function')showToast(msg);else console.log('[BF]',msg);}
  const st=document.createElement('style');
  st.textContent=`img.bf-img-pending{opacity:0 !important;visibility:hidden !important;} img.bf-img-ready{opacity:1 !important;visibility:visible !important;transition:opacity .12s ease;}`;
  document.head.appendChild(st);
  function bindImg(img){
    if(!img||img.dataset.bfImgBound==='1')return;
    img.dataset.bfImgBound='1';img.decoding='sync';img.loading='eager';img.classList.add('bf-img-pending');
    const done=()=>{img.classList.remove('bf-img-pending');img.classList.add('bf-img-ready');};
    if(img.complete&&img.naturalWidth>0)done();else{img.addEventListener('load',done,{once:true});img.addEventListener('error',done,{once:true});}
  }
  function scanImgs(root){(root||document).querySelectorAll('img').forEach(bindImg);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>scanImgs(document));else scanImgs(document);
  
  // 安全的图片监控
  const mo=new MutationObserver(list=>{
    list.forEach(m=>{
      m.addedNodes.forEach(n=>{
        if(!n||n.nodeType!==1)return;
        if(n.tagName==='IMG')bindImg(n);
        else if(n.querySelectorAll)n.querySelectorAll('img').forEach(bindImg);
      });
    });
  });
  function startObserve(){if(document.body)mo.observe(document.body,{childList:true,subtree:true});else setTimeout(startObserve,80);}
  startObserve();
})();

/* =========================
   [PATCH-013] 聊天页稳定合并版 (安全去循环版)
========================= */
(function(){
  if(window.__TQ_PATCH_013__) return;
  window.__TQ_PATCH_013__ = 1;

  const $ = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);

  function g(k,d){try{return localStorage.getItem(k)?JSON.parse(localStorage.getItem(k)):d;}catch(e){return d;}}
  function s(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
  function del(k){try{localStorage.removeItem(k);}catch(e){}}
  function toast(msg){if(typeof showToast==='function')showToast(msg);}
  function esc(v){return String(v||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

  (function injectCss(){
    if($('#tq-patch-013-style')) return;
    const st=document.createElement('style');st.id='tq-patch-013-style';
    st.textContent=`
      #app-chat .chat-topbar{position:relative !important;display:flex !important;align-items:center !important;justify-content:space-between !important;flex-shrink:0 !important;}
      #app-chat .chat-topbar .ct-title{position:absolute !important;left:50% !important;transform:translateX(-50%) !important;width:auto !important;max-width:58%;text-align:center !important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none;z-index:1;}
      #app-chat .chat-topbar .ct-back{min-width:44px;position:relative;z-index:2;}
      .chat-top-actions{min-width:84px;display:flex;align-items:center;justify-content:flex-end;position:relative;z-index:2;}
      .chat-top-actions .ct-act{font-size:20px;color:var(--txt-sec);cursor:pointer;padding:4px 8px;line-height:1;user-select:none;}
      .chat-top-actions .ct-act:active{transform:scale(0.88);}
      body.dark-mode .chat-top-actions .ct-act{color:#999;}
      #app-chat{display:flex !important;flex-direction:column !important;min-height:0 !important;overflow:hidden !important;}
      #app-chat .chat-tabs{flex-shrink:0 !important;}
      #app-chat .chat-tab-content{flex:1 !important;min-height:0 !important;overflow:hidden !important;display:block !important;}
      #app-chat .chat-tab-panel{display:none !important;height:100% !important;overflow-y:auto !important;-webkit-overflow-scrolling:touch;}
      #app-chat .chat-tab-panel.active{display:block !important;}
      .msg-search-wrap{transition:max-height .22s ease,opacity .2s ease,padding .2s ease;max-height:56px;opacity:1;overflow:hidden;}
      .msg-search-wrap.collapsed{max-height:0 !important;opacity:0 !important;padding-top:0 !important;padding-bottom:0 !important;pointer-events:none;}
      .msg-item-avatar{position:relative;overflow:visible !important;}
      .msg-badge{top:-6px !important;right:-6px !important;z-index:9 !important;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.12);}
      body.dark-mode .msg-badge{border-color:#1a1a1a;}
      .msg-item-wrap{position:relative;overflow:hidden !important;}
      .msg-actions{position:absolute;right:0;top:0;height:100%;width:140px;display:flex;z-index:1;opacity:0 !important;pointer-events:none !important;transition:opacity .12s ease;}
      .msg-item-wrap.open .msg-actions{opacity:1 !important;pointer-events:auto !important;}
      .msg-act{width:70px;height:100%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;letter-spacing:1px;user-select:none;}
      .msg-act.pin{background:#9aabb8;} .msg-act.del{background:#e07070;}
      .msg-item{position:relative;z-index:2;transition:transform .2s ease !important;}
      .msg-item-wrap:not(.open) .msg-item{transform:translateX(0) !important;}
      .msg-item-wrap.open .msg-item{transform:translateX(-140px) !important;}
      .msg-item.pinned{background:rgba(154,171,184,0.09) !important;}
      body.dark-mode .msg-item.pinned{background:rgba(154,171,184,0.13) !important;}
      #app-chat.has-chat-home-bg{background-image:var(--chat-home-bg, none) !important;background-size:cover !important;background-position:center !important;background-repeat:no-repeat !important;}
      #app-chat.has-chat-home-bg .chat-topbar, #app-chat.has-chat-home-bg .chat-tabs{background:rgba(255,255,255,.20) !important;backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border-color:rgba(255,255,255,.35) !important;}
      #app-chat.has-chat-home-bg .msg-item{background:rgba(255,255,255,.22) !important;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.30);}
      body.dark-mode #app-chat.has-chat-home-bg .chat-topbar, body.dark-mode #app-chat.has-chat-home-bg .chat-tabs{background:rgba(0,0,0,.28) !important;border-color:rgba(255,255,255,.12) !important;}
      body.dark-mode #app-chat.has-chat-home-bg .msg-item{background:rgba(0,0,0,.28) !important;border-color:rgba(255,255,255,.12);}
      #chat-detail.has-chat-detail-bg{background-image:var(--chat-detail-bg, none) !important;background-size:cover !important;background-position:center !important;background-repeat:no-repeat !important;}
      #dock .dock-item:nth-child(2) .dock-icon:empty::before{content:"☼";}
    `;
    document.head.appendChild(st);
  })();

  function bindTabs(){
    const tabs=[...$$('#app-chat .chat-tab')];
    const panels=[...$$('#app-chat .chat-tab-panel')];
    if(!tabs.length || !panels.length) return false;
    const titleEl=$('#app-chat .ct-title');
    const map={messages:'消息',contacts:'联系人',moments:'朋友圈',profile:'我'};
    
    tabs.forEach(tab=>{
      tab.onclick=function(){
        const target=tab.dataset.tab;
        tabs.forEach(t=>t.classList.remove('active'));tab.classList.add('active');
        panels.forEach(p=>p.classList.remove('active'));
        const panel=$('#tab-'+target);if(panel)panel.classList.add('active');
        // 安全赋值：只有不一样才赋值，打破死循环
        const nt = map[target]||'消息';
        if(titleEl && titleEl.textContent !== nt) titleEl.textContent = nt;
      };
    });

    let active=tabs.find(t=>t.classList.contains('active')) || tabs[0];
    tabs.forEach(t=>t.classList.remove('active'));active.classList.add('active');
    panels.forEach(p=>p.classList.remove('active'));
    const p=$('#tab-'+active.dataset.tab);if(p)p.classList.add('active');
    const nt2 = map[active.dataset.tab]||'消息';
    if(titleEl && titleEl.textContent !== nt2) titleEl.textContent = nt2;
    return true;
  }

  function initSearchToggle(){
    const plus=$('#chat-new-btn');const wrap=$('#tab-messages .msg-search-wrap');const oldInput=$('#msg-search');
    if(!plus || !wrap || !oldInput) return false;
    if(!$('#chat-top-actions-holder')){
      const holder=document.createElement('div');holder.id='chat-top-actions-holder';holder.className='chat-top-actions';
      plus.parentNode.insertBefore(holder, plus);
      const searchBtn=document.createElement('span');searchBtn.id='chat-search-toggle';searchBtn.className='ct-act';searchBtn.textContent='⌕';
      holder.appendChild(searchBtn);holder.appendChild(plus);plus.classList.add('ct-act');
    }
    let input=$('#msg-search');
    if(input && !input.dataset.p13Bound){
      const neo=input.cloneNode(true);input.parentNode.replaceChild(neo,input);input=neo;input.dataset.p13Bound='1';
      input.addEventListener('input',()=>{window.__chat013_kw=input.value.trim();window.renderMsgList();});
    }
    if(!wrap.dataset.p13Inited){wrap.classList.add('collapsed');wrap.dataset.p13Inited='1';}
    const btn=$('#chat-search-toggle');
    if(btn && !btn.dataset.p13Bound){
      btn.dataset.p13Bound='1';
      btn.onclick=function(e){
        e.stopPropagation();
        if(wrap.classList.contains('collapsed')){wrap.classList.remove('collapsed');const i=$('#msg-search');if(i)setTimeout(()=>i.focus(),30);}
        else{wrap.classList.add('collapsed');const i2=$('#msg-search');if(i2){i2.value='';window.__chat013_kw='';window.renderMsgList();}}
      };
    }
    return true;
  }

  function pinsGet(){return g('tq_chat_pinned',[]);}
  function pinsSet(v){s('tq_chat_pinned',v);}
  function normalizePins(contacts){
    const ids=new Set(contacts.map(c=>c.id));
    let pins=pinsGet().filter((id,idx,arr)=>id && ids.has(id) && arr.indexOf(id)===idx);
    pinsSet(pins);return pins;
  }
  function getLast(cid){const msgs=g('tq_msgs_'+cid,[]);return msgs.length?msgs[msgs.length-1]:null;}
  function getUnread(cid){
    const msgs=g('tq_msgs_'+cid,[]);let n=0;
    for(let i=msgs.length-1;i>=0;i--){if(msgs[i].role==='char' && msgs[i].read===false)n++;else break;}
    return n;
  }
  function fmtTime(ts){
    if(!ts) return '';
    const d=new Date(ts), now=new Date();const diff=now-d;
    if(diff<60000) return '刚刚';if(diff<3600000) return Math.floor(diff/60000)+'分钟前';
    if(d.toDateString()===now.toDateString()) return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
    const y=new Date(now); y.setDate(y.getDate()-1);
    if(d.toDateString()===y.toDateString()) return '昨天';
    return (d.getMonth()+1)+'/'+d.getDate();
  }
  function setOpen(wrap,open){
    const row=wrap.querySelector('.msg-item');if(!row) return;
    if(open){wrap.classList.add('open');row.style.transform='translateX(-140px)';}
    else{wrap.classList.remove('open');row.style.transform='translateX(0)';}
  }
  function closeAllOpen(except){$$('.msg-item-wrap.open').forEach(w=>{if(w!==except) setOpen(w,false);});}

  function renderSearch(kw){
    const q=String(kw||'').trim().toLowerCase();
    const contacts=g('tq_contacts',[]);
    const container=$('#msg-list');const empty=$('#msg-empty');
    if(!container || !empty) return;
    const result=[];
    contacts.forEach(c=>{
      const nameHit=(c.name||'').toLowerCase().includes(q) || (c.remark||'').toLowerCase().includes(q) || (c.nickname||'').toLowerCase().includes(q);
      const msgs=g('tq_msgs_'+c.id,[]);
      const hitMsgs=msgs.filter(m=>String(m.text||'').toLowerCase().includes(q));
      if(nameHit || hitMsgs.length) result.push({c,count:hitMsgs.length,preview:hitMsgs.length?hitMsgs[hitMsgs.length-1].text.slice(0,40):'联系人匹配'});
    });
    empty.style.display='none';
    if(!result.length){container.innerHTML='<div class="chat-empty" style="min-height:150px;"><div class="ce-icon">⌕</div><div>未找到相关结果</div></div>';return;}
    container.innerHTML='';
    result.forEach(r=>{
      const c=r.c;
      const av=c.avatar?`<img src="${esc(c.avatar)}" alt="">`:`<span class="mi-ph">${esc((c.name||'?').charAt(0))}</span>`;
      const row=document.createElement('div');row.className='msg-item';
      row.innerHTML=`<div class="msg-item-avatar">${av}</div><div class="msg-item-body"><div class="msg-item-top"><div class="msg-item-name">${esc(c.remark||c.name||'未命名')}</div></div><div class="msg-item-preview">${esc(r.preview)}${r.count?('（命中'+r.count+'条）'):''}</div></div>`;
      row.addEventListener('click',()=>{ if(typeof openChatDetail==='function') openChatDetail(c.id); });
      container.appendChild(row);
    });
  }

  function renderNormal(){
    const contacts=g('tq_contacts',[]);
    const container=$('#msg-list');const empty=$('#msg-empty');
    if(!container || !empty) return;
    if(!contacts.length){empty.style.display='';container.innerHTML='';return;}
    const pins=normalizePins(contacts);
    const list=contacts.map(c=>{
      const last=getLast(c.id);
      return {c,last,unread:getUnread(c.id),sortTime:last?last.time:(c.createdAt||0),pinIdx:pins.indexOf(c.id)};
    });
    list.sort((a,b)=>{
      const ap=a.pinIdx>-1, bp=b.pinIdx>-1;
      if(ap && bp) return a.pinIdx-b.pinIdx;
      if(ap && !bp) return -1;
      if(!ap && bp) return 1;
      return b.sortTime-a.sortTime;
    });
    empty.style.display='none';container.innerHTML='';
    list.forEach(item=>{
      const c=item.c;const pinned=item.pinIdx>-1;
      const av=c.avatar?`<img src="${esc(c.avatar)}" alt="">`:`<span class="mi-ph">${esc((c.name||'?').charAt(0))}</span>`;
      const badge=item.unread>0?`<div class="msg-badge">${item.unread}</div>`:'';
      const preview=item.last?esc((item.last.role==='user'?'我：':'')+String(item.last.text||'').slice(0,30)):'点击开始聊天';
      const wrap=document.createElement('div');wrap.className='msg-item-wrap';
      const actions=document.createElement('div');actions.className='msg-actions';
      actions.innerHTML=`<div class="msg-act pin">${pinned?'取消':'置顶'}</div><div class="msg-act del">删除</div>`;
      wrap.appendChild(actions);
      const row=document.createElement('div');row.className='msg-item'+(pinned?' pinned':'');
      row.innerHTML=`<div class="msg-item-avatar">${av}${badge}</div><div class="msg-item-body"><div class="msg-item-top"><div class="msg-item-name">${esc(c.remark||c.name||'未命名')}</div><div class="msg-item-time">${item.last?fmtTime(item.last.time):''}</div></div><div class="msg-item-preview">${preview}</div></div>`;
      wrap.appendChild(row);

      let sx=0, sy=0, dx=0, sw=false, longTimer=null, longTriggered=false;
      row.addEventListener('touchstart',e=>{
        closeAllOpen(wrap);const t=e.touches[0];sx=t.clientX;sy=t.clientY;dx=0;sw=false;longTriggered=false;
        longTimer=setTimeout(()=>{
          longTriggered=true;
          if(typeof showModal==='function'){
            showModal('清空聊天记录','确定清空与「'+(c.remark||c.name)+'」的聊天记录？',[{text:'取消',type:'cancel'},{text:'清空',type:'confirm',cb:()=>{del('tq_msgs_'+c.id);window.renderMsgList();toast('已清空');}}]);
          }
        },600);
      },{passive:true});
      row.addEventListener('touchmove',e=>{
        const t=e.touches[0];const mx=t.clientX-sx;const my=t.clientY-sy;
        if(Math.abs(mx)>10 || Math.abs(my)>10){if(longTimer){clearTimeout(longTimer);longTimer=null;}}
        if(Math.abs(mx)>Math.abs(my) && mx<-18){sw=true;dx=Math.max(mx,-140);row.style.transform='translateX('+dx+'px)';}
      },{passive:true});
      row.addEventListener('touchend',()=>{
        if(longTimer){clearTimeout(longTimer);longTimer=null;}
        if(longTriggered){longTriggered=false;return;}
        if(sw){if(dx<-85)setOpen(wrap,true);else setOpen(wrap,false);}
        else{if(wrap.classList.contains('open'))setOpen(wrap,false);else if(typeof openChatDetail==='function')openChatDetail(c.id);}
      },{passive:true});

      actions.querySelector('.pin').addEventListener('click',e=>{
        e.stopPropagation();let pins=pinsGet();
        if(pins.includes(c.id)){pins=pins.filter(x=>x!==c.id);pinsSet(pins);toast('已取消置顶');}
        else{pins.push(c.id);pinsSet(pins);toast('已置顶');}
        window.renderMsgList();
      });
      actions.querySelector('.del').addEventListener('click',e=>{
        e.stopPropagation();
        if(typeof showModal==='function'){
          showModal('删除聊天','确定删除与「'+(c.remark||c.name)+'」的聊天？',[{text:'取消',type:'cancel'},{text:'删除',type:'confirm',cb:()=>{del('tq_msgs_'+c.id);let pins=pinsGet().filter(x=>x!==c.id);pinsSet(pins);window.renderMsgList();toast('已删除');}}]);
        }
      });
      container.appendChild(wrap);
    });
  }

  window.renderMsgList=function(){const kw=String(window.__chat013_kw||'').trim();if(kw)renderSearch(kw);else renderNormal();};

  if(!window.__TQ_PATCH_013_OUTSIDE__){
    window.__TQ_PATCH_013_OUTSIDE__=1;
    document.addEventListener('touchstart',e=>{if(!e.target.closest('.msg-item-wrap'))closeAllOpen(null);},{passive:true});
  }

  const HOME_KEY='tq_chat_home_bg';const DETAIL_KEY_PREFIX='tq_chat_detail_bg_';
  function applyChatHomeBg(){
    const app=$('#app-chat');if(!app)return;
    const src=g(HOME_KEY,null);
    if(src){app.style.setProperty('--chat-home-bg','url("'+String(src).replace(/"/g,'%22')+'")');app.classList.add('has-chat-home-bg');}
    else{app.style.setProperty('--chat-home-bg','none');app.classList.remove('has-chat-home-bg');}
  }
  function applyChatDetailBg(cid){
    const page=$('#chat-detail');if(!page || !cid)return;
    const detail=g(DETAIL_KEY_PREFIX+cid,null);const home=g(HOME_KEY,null);const src=detail || home || null;
    if(src){page.style.setProperty('--chat-detail-bg','url("'+String(src).replace(/"/g,'%22')+'")');page.classList.add('has-chat-detail-bg');}
    else{page.style.setProperty('--chat-detail-bg','none');page.classList.remove('has-chat-detail-bg');}
  }
  function refreshBeautifyPreview(){
    const el=$('#set-chat-home-preview');if(!el)return;const src=g(HOME_KEY,null);
    if(src)el.innerHTML='<img src="'+src+'" alt="">';else el.innerHTML='<span style="font-size:12px;color:var(--txt-light);">点击下方按钮设置</span>';
  }
  function injectBeautifyGroup(){
    const body=$('#app-settings .set-body');
    if(!body || $('#sg-beautify')) return false;
    body.insertAdjacentHTML('beforeend',`<div class="set-group" id="sg-beautify"><div class="set-group-header" onclick="toggleSetGroup('sg-beautify')"><span class="sg-title">美化</span><span class="sg-arrow">▾</span></div><div class="set-group-body"><div class="set-group-content"><div class="set-label">聊天主页壁纸（聊天列表页）</div><div class="set-wp-preview" id="set-chat-home-preview"><span style="font-size:12px;color:var(--txt-light);">点击下方按钮设置</span></div><div class="set-btn-row"><button class="set-btn set-btn-sec" onclick="pickChatHomeBg()">选择图片</button><button class="set-btn set-btn-sec" onclick="clearChatHomeBg()">清除</button></div><div style="font-size:10px;color:var(--txt-sec);line-height:1.6;margin-top:8px;">单聊壁纸在聊天页右上角（☰）设置。<br>优先级：单聊壁纸 > 聊天主页壁纸</div></div></div></div>`);
    refreshBeautifyPreview();return true;
  }
  window.pickChatHomeBg=function(){
    if(typeof openUploadModal!=='function')return;
    openUploadModal('chat_home_bg',(k,src)=>{s(HOME_KEY,src);applyChatHomeBg();refreshBeautifyPreview();toast('聊天主页壁纸已设置');});
  };
  window.clearChatHomeBg=function(){del(HOME_KEY);applyChatHomeBg();refreshBeautifyPreview();toast('聊天主页壁纸已清除');};

  window.openChatSettings=function(){
    const cid=window._cdChatId;if(!cid){toast('请先进入聊天');return;}
    const ov=document.createElement('div');
    ov.style.cssText='position:fixed;inset:0;z-index:700;background:rgba(0,0,0,.22);display:flex;align-items:flex-end;justify-content:center;';
    ov.innerHTML=`<div style="width:100%;max-width:520px;background:rgba(255,255,255,.94);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-radius:18px 18px 0 0;padding:12px 12px calc(env(safe-area-inset-bottom,0px) + 12px);"><div style="text-align:center;font-size:13px;color:#666;padding:8px 0 10px;">聊天美化</div><button id="p13-set-detail" style="width:100%;padding:12px;border-radius:12px;margin-bottom:8px;background:#f3f1ee;">设置当前聊天壁纸</button><button id="p13-clear-detail" style="width:100%;padding:12px;border-radius:12px;margin-bottom:8px;background:#f3f1ee;">清除当前聊天壁纸</button><button id="p13-set-home" style="width:100%;padding:12px;border-radius:12px;margin-bottom:8px;background:#f3f1ee;">设置聊天主页壁纸</button><button id="p13-clear-home" style="width:100%;padding:12px;border-radius:12px;margin-bottom:8px;background:#f3f1ee;">清除聊天主页壁纸</button><button id="p13-cancel" style="width:100%;padding:12px;border-radius:12px;background:#e9e9e9;">取消</button></div>`;
    document.body.appendChild(ov);
    const close=()=>ov.remove();
    ov.addEventListener('click',e=>{if(e.target===ov)close();});
    ov.querySelector('#p13-set-detail').onclick=function(){close();openUploadModal('chat_detail_bg_'+cid,(k,src)=>{s(DETAIL_KEY_PREFIX+cid,src);applyChatDetailBg(cid);toast('当前聊天壁纸已设置');});};
    ov.querySelector('#p13-clear-detail').onclick=function(){del(DETAIL_KEY_PREFIX+cid);applyChatDetailBg(cid);close();toast('当前聊天壁纸已清除');};
    ov.querySelector('#p13-set-home').onclick=function(){close();window.pickChatHomeBg();};
    ov.querySelector('#p13-clear-home').onclick=function(){close();window.clearChatHomeBg();};
    ov.querySelector('#p13-cancel').onclick=close;
  };

  if(typeof window.openChatDetail==='function' && !window.__P13_WRAP_DETAIL__){
    window.__P13_WRAP_DETAIL__=1;const old=window.openChatDetail;
    window.openChatDetail=function(cid){old(cid);setTimeout(()=>applyChatDetailBg(cid),60);};
  }
  if(typeof window.openApp==='function' && !window.__P13_WRAP_OPENAPP__){
    window.__P13_WRAP_OPENAPP__=1;const oldOpen=window.openApp;
    window.openApp=function(name){oldOpen(name);if(name==='chat')setTimeout(applyChatHomeBg,60);};
  }

  function ensureSettingsIcon(){
    const docks=$$('#dock .dock-item');if(!docks || docks.length<2) return;
    const icon=docks[1].querySelector('.dock-icon');if(!icon) return;
    if(!icon.querySelector('img') && !(icon.textContent||'').trim()) icon.textContent='☼';
  }

  function boot(){
    bindTabs();initSearchToggle();injectBeautifyGroup();applyChatHomeBg();
    if(window._cdChatId) applyChatDetailBg(window._cdChatId);
    ensureSettingsIcon();
    if(typeof window.renderMsgList==='function') window.renderMsgList();
  }

  // 完美安全的加载机制：代替会导致死循环的 MutationObserver
  let bootInterval = setInterval(()=>{
    if($('#app-chat') && $('#tab-messages') && $('#msg-list') && $('#chat-new-btn')){
      clearInterval(bootInterval);
      boot();
    }
  }, 200);
  
  // 给设置抽屉单独绑一次注入
  document.addEventListener('click', e=>{
    if(e.target.closest('.dock-item') || e.target.closest('.app-item')){
      setTimeout(boot, 100);
    }
  });

})();

// ===== [终极安全版] iOS 专属修复：防白条 + 防Emoji =====
(function fixIOS(){
  // 1. 纯 CSS 解决底部白条和 Emoji，绝对不会引起卡死
  const st = document.createElement('style');
  st.textContent = `
    /* 强制网页占满全屏，背景涂黑，防止出现白底 */
    html, body {
      height: 100% !important;
      height: -webkit-fill-available !important;
      height: 100dvh !important;
      background-color: #000000 !important;
      overscroll-behavior-y: none; /* 防止上下拉出现白底缝隙 */
    }
    
    /* 壁纸层强制拉伸到底部 */
    #tq-wp-layer, #wallpaper, #desktop {
      height: 100% !important;
      height: -webkit-fill-available !important;
      height: 100dvh !important;
      top: 0 !important; 
      bottom: 0 !important;
    }
    
    /* 让底部的 Dock 栏稍微往上抬一点，避开苹果的那根横线 */
    #dock {
      margin-bottom: env(safe-area-inset-bottom, 8px) !important;
    }
    
    /* 页面内容区底部留出安全距离 */
    .page {
      padding-bottom: calc(90px + env(safe-area-inset-bottom, 0px)) !important;
    }

    /* 强制图标显示为单色文本，拒绝苹果彩色 Emoji！ */
    .app-icon, .dock-icon {
      font-family: "Apple Symbols", "Arial Unicode MS", "Segoe UI Symbol", sans-serif !important;
      font-variant-emoji: text !important;
    }
  `;
  document.head.appendChild(st);

  // 2. 针对苹果里最顽固的几个图标（比如红心和邮件），贴上“纯文本符”
  // 只在页面加载时执行一次，没有死循环，非常安全！
  setTimeout(function(){
    document.querySelectorAll('.app-icon, .dock-icon').forEach(el => {
      // 如果里面只有文字没有图片
      if(el.children.length === 0 && el.textContent) { 
        let txt = el.textContent.trim();
        // 遇到这些容易变彩色的符号，强行加上 \uFE0E (文本显示指令)
        if(['❣', '❤', '✉', '☾', '♪', '☼', '❝'].includes(txt)) {
           el.textContent = txt + '\uFE0E';
        }
      }
    });
  }, 800);
})();

// ===== [完美收官补丁] UI微调 + 全局图片压缩 =====
(function finalPolish(){
  // 1. CSS 修复顶部缝隙和头像溢出，绝对安全
  const st = document.createElement('style');
  st.textContent = `
        /* 消除页面顶部的空白缝隙，整体上移，不再强行拉伸变胖 */
    .app-page, #app-chat {
      padding-top: 0 !important;
      margin-top: 0 !important;
    }
    .chat-topbar, .app-header {
      padding-top: 12px !important; /* 恢复它原本精致的高级大小 */
    }
    
    /* 强制头像图片在圆框内，防旧浏览器溢出 */
    .msg-item-avatar img,
    .contact-item-avatar img,
    .circle-frame img,
    .me-avatar img,
    .mask-avatar img,
    .cd-msg-avatar img {
      border-radius: 50% !important;
      transform: translateZ(0); /* 开启硬件加速，强行把溢出的边角切掉 */
    }
  `;
  document.head.appendChild(st);

  // 2. 全局拦截图片上传：自动把超大图片无损压缩，彻底解决存不进去的问题！
  const origOpenUpload = window.openUploadModal;
  if(origOpenUpload && !window.__TQ_IMG_COMPRESSOR_BOUND__) {
    window.__TQ_IMG_COMPRESSOR_BOUND__ = 1;
    
    function compressBase64(src, maxW, quality) {
      return new Promise(resolve => {
        if(!src || !src.startsWith('data:image/')) return resolve(src);
        const img = new Image();
        img.onload = function() {
          let w = img.width, h = img.height;
          if(w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
          const cvs = document.createElement('canvas');
          cvs.width = w; cvs.height = h;
          cvs.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(cvs.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => resolve(src);
        img.src = src;
      });
    }

    window.openUploadModal = function(targetKey, callback) {
      origOpenUpload(targetKey, async function(k, src) {
        let finalSrc = src;
        // 如果是本地图片，且体积过大，就全自动静默压缩
        if(src && src.startsWith('data:image/') && src.length > 250000) {
          if(typeof showToast === 'function') showToast('图片较大，正在自动瘦身...');
          finalSrc = await compressBase64(src, 1080, 0.7); // 压缩到安全大小
        }
        callback(k, finalSrc);
      });
    };
  }
})();

// ===== [完美收官补丁2：选项卡移到底部] =====
(function moveTabsToBottom(){
  const st = document.createElement('style');
  st.textContent = `
    /* 让聊天页的三大块重新排队：顶栏第1，内容第2，选项卡跑到第3（最底下） */
    #app-chat {
      display: flex !important;
      flex-direction: column !important;
    }
    #app-chat .chat-topbar { 
      order: 1 !important; 
    }
    #app-chat .chat-tab-content { 
      order: 2 !important; 
      flex: 1 !important; /* 内容区占满中间所有空间 */
    }
    
    /* 底部选项卡的美颜和适配 */
    #app-chat .chat-tabs { 
      order: 3 !important; 
      border-bottom: none !important; /* 去掉以前的下边框 */
      border-top: 1px solid rgba(255,255,255,0.3) !important; /* 加上高级的上边框 */
      padding-top: 8px !important;
      /* 核心：自动识别苹果底部白条，给它留出安全距离，完美贴合！ */
      padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 12px) !important;
      box-shadow: 0 -2px 16px rgba(0,0,0,0.04) !important;
      flex-shrink: 0 !important;
    }
    
    /* 夜间模式的深色适配 */
    body.dark-mode #app-chat .chat-tabs {
      border-top-color: rgba(255,255,255,0.08) !important;
      box-shadow: 0 -2px 16px rgba(0,0,0,0.2) !important;
    }
  `;
  document.head.appendChild(st);
})();
