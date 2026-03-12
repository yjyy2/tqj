/* =========================
   bugfix.js
   修复：
   1) QQ浏览器重进壁纸丢失
   2) 本地字体可保存为方案
   3) 第一页气泡/第二页长条字体颜色可更改
   // stable v1 - 图片加载修复完成
========================= */

// ===== 公共工具 =====
(function(){
  function bfGet(k,d){
    try{
      const v=localStorage.getItem(k);
      return v?JSON.parse(v):d;
    }catch(e){return d;}
  }
  function bfSet(k,v){
    try{
      localStorage.setItem(k,JSON.stringify(v));
      return true;
    }catch(e){return false;}
  }
  function bfDel(k){
    try{localStorage.removeItem(k);}catch(e){}
  }
  function bfToast(msg){
    if(typeof showToast==='function')showToast(msg);
    else console.log('[BUGFIX]',msg);
  }

  // IndexedDB（用于大资源：壁纸/本地字体）
  const DB_NAME='tq_bugfix_assets';
  const STORE_NAME='kv';
  let dbPromise=null;

  function idbOpen(){
    if(dbPromise)return dbPromise;
    dbPromise=new Promise(resolve=>{
      if(!('indexedDB' in window)){resolve(null);return;}
      const req=indexedDB.open(DB_NAME,1);
      req.onupgradeneeded=function(){
        const db=req.result;
        if(!db.objectStoreNames.contains(STORE_NAME)){
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess=function(){resolve(req.result);};
      req.onerror=function(){resolve(null);};
    });
    return dbPromise;
  }

  async function idbGet(key){
    const db=await idbOpen();
    if(!db)return null;
    return new Promise(resolve=>{
      const tx=db.transaction(STORE_NAME,'readonly');
      const rq=tx.objectStore(STORE_NAME).get(key);
      rq.onsuccess=()=>resolve(rq.result != null ? rq.result : null);
      rq.onerror=()=>resolve(null);
    });
  }

  async function idbSet(key,val){
    const db=await idbOpen();
    if(!db)return false;
    return new Promise(resolve=>{
      const tx=db.transaction(STORE_NAME,'readwrite');
      tx.objectStore(STORE_NAME).put(val,key);
      tx.oncomplete=()=>resolve(true);
      tx.onerror=()=>resolve(false);
    });
  }

  async function idbDel(key){
    const db=await idbOpen();
    if(!db)return false;
    return new Promise(resolve=>{
      const tx=db.transaction(STORE_NAME,'readwrite');
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete=()=>resolve(true);
      tx.onerror=()=>resolve(false);
    });
  }

  window.__TQ_BF={bfGet,bfSet,bfDel,bfToast,idbGet,idbSet,idbDel};
})();


// ===== [BUGFIX-001] 壁纸持久化修复（QQ浏览器） =====
(function(){
  const BF=window.__TQ_BF;
  if(!BF)return;

  function ensureWpLayer(){
    let layer=document.getElementById('tq-wp-layer');
    if(!layer){
      layer=document.createElement('div');
      layer.id='tq-wp-layer';
      layer.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none;background-size:cover;background-position:center;background-repeat:no-repeat;';
      document.body.insertBefore(layer,document.body.firstChild);
    }
    return layer;
  }

  function applyWallpaperVisual(src){
    const layer=ensureWpLayer();
    const old=document.getElementById('wallpaper');

    if(src){
      const safe=String(src).replace(/"/g,'%22');
      layer.style.backgroundImage='url("'+safe+'")';
      document.body.classList.add('has-wp');
      if(old)old.style.display='none';
    }else{
      layer.style.backgroundImage='none';
      document.body.classList.remove('has-wp');
      if(old){
        old.style.display='';
        old.style.background='var(--bg-pri)';
      }
    }
  }

  function compressDataUrl(src,maxW,limitBytes){
    maxW=maxW||1400;
    limitBytes=limitBytes||450*1024;
    return new Promise(resolve=>{
      try{
        const img=new Image();
        img.onload=function(){
          let w=img.width,h=img.height;
          if(w>maxW){h=Math.round(h*maxW/w);w=maxW;}
          const cvs=document.createElement('canvas');
          cvs.width=w;cvs.height=h;
          const ctx=cvs.getContext('2d');
          ctx.drawImage(img,0,0,w,h);

          let q=0.86;
          let out=cvs.toDataURL('image/jpeg',q);
          while(out.length>limitBytes && q>0.45){
            q-=0.08;
            out=cvs.toDataURL('image/jpeg',q);
          }
          resolve(out);
        };
        img.onerror=function(){resolve(src);};
        img.src=src;
      }catch(e){
        resolve(src);
      }
    });
  }

  async function saveWallpaper(src){
    let out=src;
    if(/^data:image\//.test(out) && out.length>700000){
      out=await compressDataUrl(out,1400,450*1024);
    }

    const ok1=BF.bfSet('tq_wallpaper_home',out);
    BF.bfSet('tq_img_wallpaper_home',out);
    await BF.idbSet('wallpaper_home',out);

    return {src:out,okLS:ok1};
  }

  // 覆盖 pickWallpaper（保持原交互）
  window.pickWallpaper=function(){
    if(typeof openUploadModal!=='function'){BF.bfToast('上传模块未就绪');return;}
    openUploadModal('wallpaper_home',function(k,src){
      window._wpTemp=src;
      const prev=document.getElementById('set-wp-home');
      if(prev)prev.innerHTML='<img src="'+src+'" alt="">';
      BF.bfToast('预览已更新，点击"应用保存"生效');
    });
  };

  // 覆盖 applyWallpaper（保存到LS + IDB）
  window.applyWallpaper=async function(){
    const input=document.getElementById('set-wp-url');
    const urlVal=input?input.value.trim():'';
    if(urlVal){
      window._wpTemp=urlVal;
      const prev=document.getElementById('set-wp-home');
      if(prev)prev.innerHTML='<img src="'+urlVal+'" alt="">';
    }

    if(!window._wpTemp){
      BF.bfToast('请先选择图片或输入URL');
      return;
    }

    const ret=await saveWallpaper(window._wpTemp);
    window._wpTemp=ret.src;
    applyWallpaperVisual(ret.src);

    if(ret.okLS) BF.bfToast('壁纸已应用保存');
    else BF.bfToast('壁纸已应用（已走兼容存储）');
  };

  // 覆盖 clearWallpaper（同时清LS+IDB）
  window.clearWallpaper=function(){
    function doClear(){
      window._wpTemp=null;
      BF.bfDel('tq_wallpaper_home');
      BF.bfDel('tq_img_wallpaper_home');
      BF.idbDel('wallpaper_home');
      applyWallpaperVisual(null);

      const prev=document.getElementById('set-wp-home');
      if(prev)prev.innerHTML='<span style="font-size:12px;color:var(--txt-light);">点击下方按钮设置</span>';
      const input=document.getElementById('set-wp-url');
      if(input)input.value='';
      BF.bfToast('壁纸已清除');
    }

    if(typeof showModal==='function'){
      showModal('清除壁纸','确定清除主页壁纸？',[
        {text:'取消',type:'cancel'},
        {text:'确定',type:'confirm',cb:doClear}
      ]);
    }else{
      doClear();
    }
  };

  async function restoreWallpaper(){
    let src=BF.bfGet('tq_wallpaper_home',null) || BF.bfGet('tq_img_wallpaper_home',null);
    if(!src){
      src=await BF.idbGet('wallpaper_home');
      if(src){
        BF.bfSet('tq_wallpaper_home',src);
      }
    }
    if(src){
      window._wpTemp=src;
      applyWallpaperVisual(src);
      const prev=document.getElementById('set-wp-home');
      if(prev)prev.innerHTML='<img src="'+src+'" alt="">';
    }
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',restoreWallpaper);
  }else{
    restoreWallpaper();
  }
  window.addEventListener('pageshow',restoreWallpaper);
})();


// ===== [BUGFIX-002] 本地字体保存方案修复 =====
(function(){
  const BF=window.__TQ_BF;
  if(!BF)return;

  function renderFontSchemeSelect(){
    const sel=document.getElementById('set-font-scheme');
    if(!sel)return;
    const schemes=BF.bfGet('tq_font_schemes',[]);
    sel.innerHTML='<option value="">选择已保存字体方案</option>';
    schemes.forEach(function(s,i){
      const opt=document.createElement('option');
      opt.value=i;
      opt.textContent=s.name||('方案'+(i+1));
      sel.appendChild(opt);
    });
  }

  async function applyLocalFontData(dataUrl,fontName){
    try{
      const ffName='TQPatchFont_'+Date.now();
      const ff=new FontFace(ffName,'url('+dataUrl+')');
      const loaded=await ff.load();
      document.fonts.add(loaded);

      let st=document.getElementById('tq-font-scheme-patch-style');
      if(!st){
        st=document.createElement('style');
        st.id='tq-font-scheme-patch-style';
        document.head.appendChild(st);
      }
      st.textContent=`
      body,.p1-clock .time,.p1-clock .date,.p1-editable .text-display,.p1-editable .edit-box input,.p2-bubble,#p2-bubble-show,#p2-bubble-input,.p2-long-edit .long-text,#p2-long-input,.p3-card-title,.p3-mood .mood-content,.p3-mood .mood-content .silver-text,.p3-note textarea,.p3-countdown .cd-target,.p3-countdown .cd-time,.p3-countdown input,.app-name,.dock-label,.set-body,.set-input,.set-select,.set-label,.set-group-header .sg-title,.set-switch-label,.modal-title,.modal-msg{
        font-family:"${ffName}", var(--font-body) !important;
      }`;

      BF.bfSet('tq_custom_font_url',dataUrl);
      BF.bfSet('tq_custom_font_name',fontName||'本地字体');
      const cur=document.getElementById('set-font-current');
      if(cur)cur.textContent=fontName||'本地字体';
      return true;
    }catch(e){
      BF.bfToast('字体加载失败');
      return false;
    }
  }

  // 把历史里 data: 的方案迁移到 IDB，避免 localStorage 爆掉
  (async function migrateOldDataSchemes(){
    const schemes=BF.bfGet('tq_font_schemes',[]);
    let changed=false;
    for(let i=0;i<schemes.length;i++){
      const s=schemes[i];
      if(s && typeof s.url==='string' && s.url.startsWith('data:')){
        const id='fa_'+Date.now()+'_'+i;
        await BF.idbSet('font_asset_'+id,s.url);
        s.url='__IDB__'+id;
        changed=true;
      }
    }
    if(changed)BF.bfSet('tq_font_schemes',schemes);
    renderFontSchemeSelect();
  })();

  // 覆盖：保存字体方案
  window.saveFontScheme=async function(){
    const currentUrl=BF.bfGet('tq_custom_font_url',null);
    const currentName=BF.bfGet('tq_custom_font_name','系统默认');
    if(!currentUrl){
      BF.bfToast('请先应用一个字体');
      return;
    }

    const name=prompt('请为此字体方案命名：');
    if(!name||!name.trim())return;

    const schemes=BF.bfGet('tq_font_schemes',[]);
    const nm=name.trim();

    if(typeof currentUrl==='string' && currentUrl.startsWith('data:')){
      const id='fa_'+Date.now()+'_'+Math.random().toString(36).slice(2,6);
      await BF.idbSet('font_asset_'+id,currentUrl);
      schemes.push({name:nm,url:'__IDB__'+id,fontName:currentName||'本地字体'});
    }else{
      schemes.push({name:nm,url:currentUrl,fontName:currentName||'URL字体'});
    }

    if(!BF.bfSet('tq_font_schemes',schemes)){
      BF.bfToast('保存失败：存储空间不足');
      return;
    }

    renderFontSchemeSelect();
    BF.bfToast('字体方案「'+nm+'」已保存');
  };

  // 覆盖：应用字体方案
  window.applyFontScheme=async function(){
    const sel=document.getElementById('set-font-scheme');
    if(!sel||sel.value===''){
      BF.bfToast('请先选择方案');
      return;
    }
    const schemes=BF.bfGet('tq_font_schemes',[]);
    const s=schemes[parseInt(sel.value,10)];
    if(!s){
      BF.bfToast('方案不存在');
      return;
    }

    if(typeof s.url==='string' && s.url.startsWith('__IDB__')){
      const id=s.url.slice('__IDB__'.length);
      const data=await BF.idbGet('font_asset_'+id);
      if(!data){
        BF.bfToast('本地字体资源丢失，请重新保存该方案');
        return;
      }
      const ok=await applyLocalFontData(data,s.fontName||'本地字体');
      if(ok)BF.bfToast('字体方案「'+s.name+'」已应用');
      return;
    }

    // 普通URL方案：走原来的 applyFont 流程
    const inp=document.getElementById('set-font-url');
    if(inp)inp.value=s.url||'';
    if(typeof window.applyFont==='function'){
      window.applyFont();
      BF.bfToast('字体方案「'+s.name+'」已应用');
    }else if(s.url){
      const ok=await applyLocalFontData(s.url,s.fontName||'字体');
      if(ok)BF.bfToast('字体方案「'+s.name+'」已应用');
    }
  };

  setTimeout(renderFontSchemeSelect,0);
})();


// ===== [BUGFIX-003] 字体颜色作用范围修复 =====
(function(){
  const BF=window.__TQ_BF;
  if(!BF)return;

  const COLOR_TARGETS=[
    '.p1-clock .time','.p1-clock .date',
    '.p1-editable .text-display',
    '.p2-bubble','#p2-bubble-show',
    '.p2-long-edit .long-text','#p2-long-show',
    '.p3-card-title','.p3-mood .mood-content',
    '.p3-mood .mood-content .silver-text',
    '.p3-note textarea',
    '.p3-countdown .cd-target','.p3-countdown .cd-time',
    '.p3-countdown input','#cd-user-name','#cd-user-date',
    '.p3-countdown .cd-col',
    '.app-name','.dock-label',
    '.circle-frame .placeholder',

    // 这两个是你说改不到颜色的重点
    '.p1-right-bubble',
    '.p2-long-inner .lt-item',
    '#p2-long-show .lt-item'
  ];

  function applyColor(color){
    COLOR_TARGETS.forEach(sel=>{
      document.querySelectorAll(sel).forEach(el=>{
        el.style.color=color;
      });
    });

    let ph=document.getElementById('tq-ph-color-bf');
    if(!ph){
      ph=document.createElement('style');
      ph.id='tq-ph-color-bf';
      document.head.appendChild(ph);
    }
    ph.textContent=`
      #cd-user-name::placeholder{color:${color}!important;opacity:.6;}
      .p3-note textarea::placeholder{color:${color}!important;opacity:.5;}
    `;
  }

  function clearColor(){
    COLOR_TARGETS.forEach(sel=>{
      document.querySelectorAll(sel).forEach(el=>{
        el.style.color='';
      });
    });
    const ph=document.getElementById('tq-ph-color-bf');
    if(ph)ph.textContent='';
  }

  window.applyFontColor=function(){
    const picker=document.getElementById('set-font-color');
    const color=picker?picker.value:'#2c2c2c';
    applyColor(color);
    BF.bfSet('tq_font_color',color);

    const pv=document.getElementById('set-color-preview');
    if(pv)pv.textContent='当前：'+color;

    BF.bfToast('字体颜色已应用');
  };

  window.resetFontColor=function(){
    clearColor();
    BF.bfDel('tq_font_color');

    const picker=document.getElementById('set-font-color');
    if(picker)picker.value='#2c2c2c';
    const pv=document.getElementById('set-color-preview');
    if(pv)pv.textContent='当前：#2c2c2c';

    BF.bfToast('字体颜色已恢复默认');
  };

  // 修复夜间模式切换后颜色状态
  const oldToggleDark=window.toggleDarkMode;
  if(typeof oldToggleDark==='function'){
    window.toggleDarkMode=function(){
      oldToggleDark();
      const isDark=BF.bfGet('tq_dark_mode',false);
      if(isDark){
        clearColor();
      }else{
        const c=BF.bfGet('tq_font_color',null);
        if(c)applyColor(c);
      }
    };
  }

  // 启动时恢复颜色（非夜间）
  setTimeout(function(){
    const isDark=BF.bfGet('tq_dark_mode',false);
    const c=BF.bfGet('tq_font_color',null);
    if(c && !isDark)applyColor(c);
  },400);
})();
/* =========================
   [BUGFIX-004] 图片慢加载/灰块下滑修复
========================= */
(function BF_IMG_RENDER_FIX(){
  function bfToast(msg){
    if(typeof showToast==='function') showToast(msg);
    else console.log('[BF]', msg);
  }

  // A. 图片未完成前隐藏，避免“灰块扫描感”
  const st=document.createElement('style');
  st.textContent=`
    img.bf-img-pending{
      opacity:0 !important;
      visibility:hidden !important;
    }
    img.bf-img-ready{
      opacity:1 !important;
      visibility:visible !important;
      transition:opacity .12s ease;
    }
  `;
  document.head.appendChild(st);

  function bindImg(img){
    if(!img || img.dataset.bfImgBound==='1') return;
    img.dataset.bfImgBound='1';
    img.decoding='sync';
    img.loading='eager';
    img.classList.add('bf-img-pending');

    const done=()=>{
      img.classList.remove('bf-img-pending');
      img.classList.add('bf-img-ready');
    };

    if(img.complete && img.naturalWidth>0){
      done();
    }else{
      img.addEventListener('load', done, {once:true});
      img.addEventListener('error', done, {once:true});
    }
  }

  function scanImgs(root){
    (root || document).querySelectorAll('img').forEach(bindImg);
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', ()=>scanImgs(document));
  }else{
    scanImgs(document);
  }

  const mo=new MutationObserver(list=>{
    list.forEach(m=>{
      m.addedNodes.forEach(n=>{
        if(!n || n.nodeType!==1) return;
        if(n.tagName==='IMG') bindImg(n);
        else if(n.querySelectorAll) n.querySelectorAll('img').forEach(bindImg);
      });
    });
  });

  function startObserve(){
    if(document.body){
      mo.observe(document.body,{childList:true,subtree:true});
    }else{
      setTimeout(startObserve,80);
    }
  }
  startObserve();

  // B. 上传图片自动压缩转码（后续更快）
  function compactDataUrl(src){
    return new Promise(resolve=>{
      if(!src || typeof src!=='string' || !src.startsWith('data:image/')){
        resolve(src); return;
      }
      try{
        const im=new Image();
        im.onload=function(){
          let w=im.width, h=im.height;
          const MAX_W=1200;
          if(w>MAX_W){ h=Math.round(h*MAX_W/w); w=MAX_W; }

          const c=document.createElement('canvas');
          c.width=w; c.height=h;
          const ctx=c.getContext('2d');
          ctx.drawImage(im,0,0,w,h);

          // 优先 webp，不行再 jpeg
          let out=c.toDataURL('image/webp',0.82);
          if(!out || out.length>=src.length){
            out=c.toDataURL('image/jpeg',0.80);
          }
          if(out.length>650000){
            out=c.toDataURL('image/jpeg',0.72);
          }
          resolve(out || src);
        };
        im.onerror=function(){ resolve(src); };
        im.src=src;
      }catch(e){
        resolve(src);
      }
    });
  }

  if(typeof window.applyUploadedImage==='function' && !window.__bfApplyUploadedWrapped){
    window.__bfApplyUploadedWrapped=true;
    const oldApply=window.applyUploadedImage;
    window.applyUploadedImage=async function(src){
      const out=await compactDataUrl(src);
      return oldApply(out);
    };
  }

  // C. 旧图一次性迁移压缩（仅 data:image）
  function readMaybeJsonString(raw){
    if(raw==null) return {src:null,isJson:false};
    try{
      const p=JSON.parse(raw);
      if(typeof p==='string') return {src:p,isJson:true};
    }catch(e){}
    return {src:raw,isJson:false};
  }

  async function migrateOldImagesOnce(){
    const FLAG='tq_bf_img_migrated_v1';
    if(localStorage.getItem(FLAG)==='1') return;

    const keys=[];
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i);
      if(!k) continue;
      if(
        k.startsWith('tq_img_') ||
        k==='tq_user_avatar' ||
        k==='tq_user_bg' ||
        k==='tq_user_frame' ||
        k==='tq_custom_icons'
      ){
        keys.push(k);
      }
    }

    // custom icons 是对象，单独处理
    for(const k of keys){
      if(k==='tq_custom_icons'){
        try{
          const obj=JSON.parse(localStorage.getItem(k)||'{}');
          let changed=false;
          for(const app in obj){
            const val=obj[app];
            if(typeof val==='string' && val.startsWith('data:image/') && val.length>150000){
              obj[app]=await compactDataUrl(val);
              changed=true;
            }
          }
          if(changed) localStorage.setItem(k,JSON.stringify(obj));
        }catch(e){}
        continue;
      }

      const raw=localStorage.getItem(k);
      const {src,isJson}=readMaybeJsonString(raw);
      if(typeof src!=='string') continue;
      if(!src.startsWith('data:image/')) continue;
      if(src.length<150000) continue; // 小图不动

      const out=await compactDataUrl(src);
      if(out && out!==src){
        try{
          localStorage.setItem(k, isJson?JSON.stringify(out):out);
        }catch(e){
          // 空间不足就跳过
        }
      }
    }

    localStorage.setItem(FLAG,'1');
    bfToast('图片资源已优化，重进后加载更快');
  }

  // 避免阻塞首屏：延后执行
  setTimeout(migrateOldImagesOnce, 1200);

  // 兼容从后台回来
  window.addEventListener('pageshow', ()=>scanImgs(document));
})();
/* =========================
   [PATCH-013] 聊天页稳定合并版
   覆盖功能：
   1) 搜索栏收起为右上角搜索键（在 + 左边）
   2) 搜索联系人 + 所有聊天记录
   3) 未读红点移到头像外右上角完整显示
   4) 右滑增加“置顶 + 删除”，仅左滑 open 时显示
   5) 多置顶按先后顺序；后置顶排在置顶区更下面
   6) 置顶颜色浅一点
   7) 顶部标题强制居中
   8) 长按聊天项清空聊天记录
   9) 设置新增“美化”折叠：聊天主页壁纸 + 单聊壁纸（单聊优先）
  10) 聊天主页毛玻璃效果
========================= */
(function(){
  if(window.__TQ_PATCH_013__) return;
  window.__TQ_PATCH_013__ = 1;

  const $ = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);

  function g(k,d){
    try{
      if(typeof lsGet==='function') return lsGet(k,d);
      const v=localStorage.getItem(k);
      return v ? JSON.parse(v) : d;
    }catch(e){ return d; }
  }
  function s(k,v){
    try{
      if(typeof lsSet==='function') return lsSet(k,v);
      localStorage.setItem(k,JSON.stringify(v));
    }catch(e){}
  }
  function del(k){ try{ localStorage.removeItem(k); }catch(e){} }
  function toast(msg){ if(typeof showToast==='function') showToast(msg); }
  function esc(v){
    return String(v||'')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  // ---------- 样式 ----------
  (function injectCss(){
    if($('#tq-patch-013-style')) return;
    const st=document.createElement('style');
    st.id='tq-patch-013-style';
    st.textContent=`
      /* 顶栏 */
      #app-chat .chat-topbar{
        position:relative !important;
        display:flex !important;
        align-items:center !important;
        justify-content:space-between !important;
        flex-shrink:0 !important;
      }
      #app-chat .chat-topbar .ct-title{
        position:absolute !important;
        left:50% !important;
        transform:translateX(-50%) !important;
        width:auto !important;
        max-width:58%;
        text-align:center !important;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
        pointer-events:none;
        z-index:1;
      }
      #app-chat .chat-topbar .ct-back{
        min-width:44px;
        position:relative;
        z-index:2;
      }
      .chat-top-actions{
        min-width:84px;
        display:flex;
        align-items:center;
        justify-content:flex-end;
        position:relative;
        z-index:2;
      }
      .chat-top-actions .ct-act{
        font-size:20px;
        color:var(--txt-sec);
        cursor:pointer;
        padding:4px 8px;
        line-height:1;
        user-select:none;
      }
      .chat-top-actions .ct-act:active{transform:scale(0.88);}
      body.dark-mode .chat-top-actions .ct-act{color:#999;}

      /* 聊天页布局兜底（避免半屏） */
      #app-chat{
        display:flex !important;
        flex-direction:column !important;
        min-height:0 !important;
        overflow:hidden !important;
      }
      #app-chat .chat-tabs{flex-shrink:0 !important;}
      #app-chat .chat-tab-content{
        flex:1 !important;
        min-height:0 !important;
        overflow:hidden !important;
        display:block !important;
      }
      #app-chat .chat-tab-panel{
        display:none !important;
        height:100% !important;
        overflow-y:auto !important;
        -webkit-overflow-scrolling:touch;
      }
      #app-chat .chat-tab-panel.active{
        display:block !important;
      }

      /* 搜索栏折叠 */
      .msg-search-wrap{
        transition:max-height .22s ease,opacity .2s ease,padding .2s ease;
        max-height:56px;
        opacity:1;
        overflow:hidden;
      }
      .msg-search-wrap.collapsed{
        max-height:0 !important;
        opacity:0 !important;
        padding-top:0 !important;
        padding-bottom:0 !important;
        pointer-events:none;
      }

      /* 红点外置 */
      .msg-item-avatar{
        position:relative;
        overflow:visible !important;
      }
      .msg-badge{
        top:-6px !important;
        right:-6px !important;
        z-index:9 !important;
        border:2px solid #fff;
        box-shadow:0 1px 4px rgba(0,0,0,.12);
      }
      body.dark-mode .msg-badge{
        border-color:#1a1a1a;
      }

      /* 右滑动作区 */
      .msg-item-wrap{
        position:relative;
        overflow:hidden !important;
      }
      .msg-actions{
        position:absolute;
        right:0;
        top:0;
        height:100%;
        width:140px;
        display:flex;
        z-index:1;
        opacity:0 !important;
        pointer-events:none !important;
        transition:opacity .12s ease;
      }
      .msg-item-wrap.open .msg-actions{
        opacity:1 !important;
        pointer-events:auto !important;
      }
      .msg-act{
        width:70px;
        height:100%;
        display:flex;
        align-items:center;
        justify-content:center;
        color:#fff;
        font-size:13px;
        letter-spacing:1px;
        user-select:none;
      }
      .msg-act.pin{background:#9aabb8;}
      .msg-act.del{background:#e07070;}

      .msg-item{
        position:relative;
        z-index:2;
        transition:transform .2s ease !important;
      }
      .msg-item-wrap:not(.open) .msg-item{
        transform:translateX(0) !important;
      }
      .msg-item-wrap.open .msg-item{
        transform:translateX(-140px) !important;
      }

      /* 置顶颜色浅一点 */
      .msg-item.pinned{
        background:rgba(154,171,184,0.09) !important;
      }
      body.dark-mode .msg-item.pinned{
        background:rgba(154,171,184,0.13) !important;
      }

      /* 聊天主页壁纸毛玻璃 */
      #app-chat.has-chat-home-bg{
        background-image:var(--chat-home-bg, none) !important;
        background-size:cover !important;
        background-position:center !important;
        background-repeat:no-repeat !important;
      }
      #app-chat.has-chat-home-bg .chat-topbar,
      #app-chat.has-chat-home-bg .chat-tabs{
        background:rgba(255,255,255,.20) !important;
        backdrop-filter:blur(18px);
        -webkit-backdrop-filter:blur(18px);
        border-color:rgba(255,255,255,.35) !important;
      }
      #app-chat.has-chat-home-bg .msg-item{
        background:rgba(255,255,255,.22) !important;
        backdrop-filter:blur(14px);
        -webkit-backdrop-filter:blur(14px);
        border:1px solid rgba(255,255,255,.30);
      }
      body.dark-mode #app-chat.has-chat-home-bg .chat-topbar,
      body.dark-mode #app-chat.has-chat-home-bg .chat-tabs{
        background:rgba(0,0,0,.28) !important;
        border-color:rgba(255,255,255,.12) !important;
      }
      body.dark-mode #app-chat.has-chat-home-bg .msg-item{
        background:rgba(0,0,0,.28) !important;
        border-color:rgba(255,255,255,.12);
      }

      /* 单聊背景 */
      #chat-detail.has-chat-detail-bg{
        background-image:var(--chat-detail-bg, none) !important;
        background-size:cover !important;
        background-position:center !important;
        background-repeat:no-repeat !important;
      }

      /* 设置图标兜底 */
      #dock .dock-item:nth-child(2) .dock-icon:empty::before{
        content:"☼";
      }
    `;
    document.head.appendChild(st);
  })();

  // ---------- 聊天tab切换重绑 ----------
  function bindTabs(){
    const tabs=[...$$('#app-chat .chat-tab')];
    const panels=[...$$('#app-chat .chat-tab-panel')];
    if(!tabs.length || !panels.length) return false;

    const titleEl=$('#app-chat .ct-title');
    const map={messages:'消息',contacts:'联系人',moments:'朋友圈',profile:'我'};

    tabs.forEach(tab=>{
      tab.onclick=function(){
        const target=tab.dataset.tab;
        tabs.forEach(t=>t.classList.remove('active'));
        tab.classList.add('active');
        panels.forEach(p=>p.classList.remove('active'));
        const panel=$('#tab-'+target);
        if(panel) panel.classList.add('active');
        if(titleEl) titleEl.textContent=map[target]||'消息';
      };
    });

    // 保底激活
    let active=tabs.find(t=>t.classList.contains('active')) || tabs[0];
    tabs.forEach(t=>t.classList.remove('active'));
    active.classList.add('active');
    panels.forEach(p=>p.classList.remove('active'));
    const p=$('#tab-'+active.dataset.tab);
    if(p) p.classList.add('active');
    if(titleEl) titleEl.textContent=map[active.dataset.tab]||'消息';
    return true;
  }

  // ---------- 搜索键化 ----------
  function initSearchToggle(){
    const plus=$('#chat-new-btn');
    const wrap=$('#tab-messages .msg-search-wrap');
    const oldInput=$('#msg-search');
    if(!plus || !wrap || !oldInput) return false;

    if(!$('#chat-top-actions-holder')){
      const holder=document.createElement('div');
      holder.id='chat-top-actions-holder';
      holder.className='chat-top-actions';

      plus.parentNode.insertBefore(holder, plus);
      const searchBtn=document.createElement('span');
      searchBtn.id='chat-search-toggle';
      searchBtn.className='ct-act';
      searchBtn.textContent='⌕';

      holder.appendChild(searchBtn);
      holder.appendChild(plus);
      plus.classList.add('ct-act');
    }

    // 去掉旧监听（克隆输入框）
    let input=$('#msg-search');
    if(input && !input.dataset.p13Bound){
      const neo=input.cloneNode(true);
      input.parentNode.replaceChild(neo,input);
      input=neo;
      input.dataset.p13Bound='1';
      input.addEventListener('input',()=>{
        window.__chat013_kw=input.value.trim();
        window.renderMsgList();
      });
    }

    if(!wrap.dataset.p13Inited){
      wrap.classList.add('collapsed');
      wrap.dataset.p13Inited='1';
    }

    const btn=$('#chat-search-toggle');
    if(btn && !btn.dataset.p13Bound){
      btn.dataset.p13Bound='1';
      btn.onclick=function(e){
        e.stopPropagation();
        const isClosed=wrap.classList.contains('collapsed');
        if(isClosed){
          wrap.classList.remove('collapsed');
          const i=$('#msg-search');
          if(i) setTimeout(()=>i.focus(),30);
        }else{
          wrap.classList.add('collapsed');
          const i2=$('#msg-search');
          if(i2){
            i2.value='';
            window.__chat013_kw='';
            window.renderMsgList();
          }
        }
      };
    }
    return true;
  }

  // ---------- 聊天列表渲染 ----------
  function pinsGet(){ return g('tq_chat_pinned',[]); }
  function pinsSet(v){ s('tq_chat_pinned',v); }

  function normalizePins(contacts){
    const ids=new Set(contacts.map(c=>c.id));
    let pins=pinsGet().filter((id,idx,arr)=>id && ids.has(id) && arr.indexOf(id)===idx);
    pinsSet(pins);
    return pins;
  }

  function getLast(cid){
    const msgs=g('tq_msgs_'+cid,[]);
    return msgs.length?msgs[msgs.length-1]:null;
  }

  function getUnread(cid){
    const msgs=g('tq_msgs_'+cid,[]);
    let n=0;
    for(let i=msgs.length-1;i>=0;i--){
      if(msgs[i].role==='char' && msgs[i].read===false) n++;
      else break;
    }
    return n;
  }

  function fmtTime(ts){
    if(!ts) return '';
    const d=new Date(ts), now=new Date();
    const diff=now-d;
    if(diff<60000) return '刚刚';
    if(diff<3600000) return Math.floor(diff/60000)+'分钟前';
    if(d.toDateString()===now.toDateString()){
      return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
    }
    const y=new Date(now); y.setDate(y.getDate()-1);
    if(d.toDateString()===y.toDateString()) return '昨天';
    return (d.getMonth()+1)+'/'+d.getDate();
  }

  function setOpen(wrap,open){
    const row=wrap.querySelector('.msg-item');
    if(!row) return;
    if(open){
      wrap.classList.add('open');
      row.style.transform='translateX(-140px)';
    }else{
      wrap.classList.remove('open');
      row.style.transform='translateX(0)';
    }
  }

  function closeAllOpen(except){
    $$('.msg-item-wrap.open').forEach(w=>{
      if(w!==except) setOpen(w,false);
    });
  }

  function renderSearch(kw){
    const q=String(kw||'').trim().toLowerCase();
    const contacts=g('tq_contacts',[]);
    const container=$('#msg-list');
    const empty=$('#msg-empty');
    if(!container || !empty) return;

    const result=[];
    contacts.forEach(c=>{
      const nameHit=(c.name||'').toLowerCase().includes(q)
        || (c.remark||'').toLowerCase().includes(q)
        || (c.nickname||'').toLowerCase().includes(q);
      const msgs=g('tq_msgs_'+c.id,[]);
      const hitMsgs=msgs.filter(m=>String(m.text||'').toLowerCase().includes(q));

      if(nameHit || hitMsgs.length){
        result.push({
          c,
          count:hitMsgs.length,
          preview:hitMsgs.length?hitMsgs[hitMsgs.length-1].text.slice(0,40):'联系人匹配'
        });
      }
    });

    empty.style.display='none';
    if(!result.length){
      container.innerHTML='<div class="chat-empty" style="min-height:150px;"><div class="ce-icon">⌕</div><div>未找到相关结果</div></div>';
      return;
    }

    container.innerHTML='';
    result.forEach(r=>{
      const c=r.c;
      const av=c.avatar
        ? `<img src="${esc(c.avatar)}" alt="">`
        : `<span class="mi-ph">${esc((c.name||'?').charAt(0))}</span>`;

      const row=document.createElement('div');
      row.className='msg-item';
      row.innerHTML=`
        <div class="msg-item-avatar">${av}</div>
        <div class="msg-item-body">
          <div class="msg-item-top"><div class="msg-item-name">${esc(c.remark||c.name||'未命名')}</div></div>
          <div class="msg-item-preview">${esc(r.preview)}${r.count?('（命中'+r.count+'条）'):''}</div>
        </div>
      `;
      row.addEventListener('click',()=>{ if(typeof openChatDetail==='function') openChatDetail(c.id); });
      container.appendChild(row);
    });
  }

  function renderNormal(){
    const contacts=g('tq_contacts',[]);
    const container=$('#msg-list');
    const empty=$('#msg-empty');
    if(!container || !empty) return;

    if(!contacts.length){
      empty.style.display='';
      container.innerHTML='';
      return;
    }

    const pins=normalizePins(contacts);

    const list=contacts.map(c=>{
      const last=getLast(c.id);
      return {
        c,
        last,
        unread:getUnread(c.id),
        sortTime:last?last.time:(c.createdAt||0),
        pinIdx:pins.indexOf(c.id)
      };
    });

    list.sort((a,b)=>{
      const ap=a.pinIdx>-1, bp=b.pinIdx>-1;
      if(ap && bp) return a.pinIdx-b.pinIdx; // 置顶按先后
      if(ap && !bp) return -1;
      if(!ap && bp) return 1;
      return b.sortTime-a.sortTime; // 非置顶按最新
    });

    empty.style.display='none';
    container.innerHTML='';

    list.forEach(item=>{
      const c=item.c;
      const pinned=item.pinIdx>-1;
      const av=c.avatar
        ? `<img src="${esc(c.avatar)}" alt="">`
        : `<span class="mi-ph">${esc((c.name||'?').charAt(0))}</span>`;
      const badge=item.unread>0?`<div class="msg-badge">${item.unread}</div>`:'';
      const preview=item.last
        ? esc((item.last.role==='user'?'我：':'')+String(item.last.text||'').slice(0,30))
        : '点击开始聊天';

      const wrap=document.createElement('div');
      wrap.className='msg-item-wrap';

      const actions=document.createElement('div');
      actions.className='msg-actions';
      actions.innerHTML=`
        <div class="msg-act pin">${pinned?'取消':'置顶'}</div>
        <div class="msg-act del">删除</div>
      `;
      wrap.appendChild(actions);

      const row=document.createElement('div');
      row.className='msg-item'+(pinned?' pinned':'');
      row.innerHTML=`
        <div class="msg-item-avatar">${av}${badge}</div>
        <div class="msg-item-body">
          <div class="msg-item-top">
            <div class="msg-item-name">${esc(c.remark||c.name||'未命名')}</div>
            <div class="msg-item-time">${item.last?fmtTime(item.last.time):''}</div>
          </div>
          <div class="msg-item-preview">${preview}</div>
        </div>
      `;
      wrap.appendChild(row);

      // 手势：左滑 + 长按清空
      let sx=0, sy=0, dx=0, sw=false;
      let longTimer=null, longTriggered=false;

      row.addEventListener('touchstart',e=>{
        closeAllOpen(wrap);
        const t=e.touches[0];
        sx=t.clientX; sy=t.clientY;
        dx=0; sw=false;
        longTriggered=false;

        longTimer=setTimeout(()=>{
          longTriggered=true;
          if(typeof showModal==='function'){
            showModal('清空聊天记录','确定清空与「'+(c.remark||c.name)+'」的聊天记录？',[
              {text:'取消',type:'cancel'},
              {text:'清空',type:'confirm',cb:()=>{
                del('tq_msgs_'+c.id);
                window.renderMsgList();
                toast('已清空');
              }}
            ]);
          }
        },600);
      },{passive:true});

      row.addEventListener('touchmove',e=>{
        const t=e.touches[0];
        const mx=t.clientX-sx;
        const my=t.clientY-sy;

        if(Math.abs(mx)>10 || Math.abs(my)>10){
          if(longTimer){ clearTimeout(longTimer); longTimer=null; }
        }

        if(Math.abs(mx)>Math.abs(my) && mx<-18){
          sw=true;
          dx=Math.max(mx,-140);
          row.style.transform='translateX('+dx+'px)';
        }
      },{passive:true});

      row.addEventListener('touchend',()=>{
        if(longTimer){ clearTimeout(longTimer); longTimer=null; }
        if(longTriggered){ longTriggered=false; return; }

        if(sw){
          if(dx<-85) setOpen(wrap,true);
          else setOpen(wrap,false);
        }else{
          if(wrap.classList.contains('open')){
            setOpen(wrap,false);
          }else{
            if(typeof openChatDetail==='function') openChatDetail(c.id);
          }
        }
      },{passive:true});

      // 置顶
      actions.querySelector('.pin').addEventListener('click',e=>{
        e.stopPropagation();
        let pins=pinsGet();
        if(pins.includes(c.id)){
          pins=pins.filter(x=>x!==c.id);
          pinsSet(pins);
          toast('已取消置顶');
        }else{
          pins.push(c.id); // 后置顶排在置顶区更下面
          pinsSet(pins);
          toast('已置顶');
        }
        window.renderMsgList();
      });

      // 删除
      actions.querySelector('.del').addEventListener('click',e=>{
        e.stopPropagation();
        if(typeof showModal==='function'){
          showModal('删除聊天','确定删除与「'+(c.remark||c.name)+'」的聊天？',[
            {text:'取消',type:'cancel'},
            {text:'删除',type:'confirm',cb:()=>{
              del('tq_msgs_'+c.id);
              let pins=pinsGet().filter(x=>x!==c.id);
              pinsSet(pins);
              window.renderMsgList();
              toast('已删除');
            }}
          ]);
        }
      });

      container.appendChild(wrap);
    });
  }

  window.renderMsgList=function(){
    const kw=String(window.__chat013_kw||'').trim();
    if(kw) renderSearch(kw);
    else renderNormal();
  };

  // 点击空白收起滑动
  if(!window.__TQ_PATCH_013_OUTSIDE__){
    window.__TQ_PATCH_013_OUTSIDE__=1;
    document.addEventListener('touchstart',e=>{
      if(!e.target.closest('.msg-item-wrap')){
        closeAllOpen(null);
      }
    },{passive:true});
  }

  // ---------- 设置“美化” ----------
  const HOME_KEY='tq_chat_home_bg';
  const DETAIL_KEY_PREFIX='tq_chat_detail_bg_';

  function applyChatHomeBg(){
    const app=$('#app-chat');
    if(!app) return;
    const src=g(HOME_KEY,null);
    if(src){
      app.style.setProperty('--chat-home-bg','url("'+String(src).replace(/"/g,'%22')+'")');
      app.classList.add('has-chat-home-bg');
    }else{
      app.style.setProperty('--chat-home-bg','none');
      app.classList.remove('has-chat-home-bg');
    }
  }

  function applyChatDetailBg(cid){
    const page=$('#chat-detail');
    if(!page || !cid) return;
    const detail=g(DETAIL_KEY_PREFIX+cid,null);
    const home=g(HOME_KEY,null);
    const src=detail || home || null; // 单聊优先
    if(src){
      page.style.setProperty('--chat-detail-bg','url("'+String(src).replace(/"/g,'%22')+'")');
      page.classList.add('has-chat-detail-bg');
    }else{
      page.style.setProperty('--chat-detail-bg','none');
      page.classList.remove('has-chat-detail-bg');
    }
  }

  function refreshBeautifyPreview(){
    const el=$('#set-chat-home-preview');
    if(!el) return;
    const src=g(HOME_KEY,null);
    if(src) el.innerHTML='<img src="'+src+'" alt="">';
    else el.innerHTML='<span style="font-size:12px;color:var(--txt-light);">点击下方按钮设置</span>';
  }

  function injectBeautifyGroup(){
    const body=$('#app-settings .set-body');
    if(!body || $('#sg-beautify')) return false;

    body.insertAdjacentHTML('beforeend',`
      <div class="set-group" id="sg-beautify">
        <div class="set-group-header" onclick="toggleSetGroup('sg-beautify')">
          <span class="sg-title">美化</span>
          <span class="sg-arrow">▾</span>
        </div>
        <div class="set-group-body">
          <div class="set-group-content">
            <div class="set-label">聊天主页壁纸（聊天列表页）</div>
            <div class="set-wp-preview" id="set-chat-home-preview">
              <span style="font-size:12px;color:var(--txt-light);">点击下方按钮设置</span>
            </div>
            <div class="set-btn-row">
              <button class="set-btn set-btn-sec" onclick="pickChatHomeBg()">选择图片</button>
              <button class="set-btn set-btn-sec" onclick="clearChatHomeBg()">清除</button>
            </div>
            <div style="font-size:10px;color:var(--txt-sec);line-height:1.6;margin-top:8px;">
              单聊壁纸在聊天页右上角（☰）设置。<br>
              优先级：单聊壁纸 > 聊天主页壁纸
            </div>
          </div>
        </div>
      </div>
    `);

    refreshBeautifyPreview();
    return true;
  }

  window.pickChatHomeBg=function(){
    if(typeof openUploadModal!=='function') return;
    openUploadModal('chat_home_bg',(k,src)=>{
      s(HOME_KEY,src);
      applyChatHomeBg();
      refreshBeautifyPreview();
      toast('聊天主页壁纸已设置');
    });
  };
  window.clearChatHomeBg=function(){
    del(HOME_KEY);
    applyChatHomeBg();
    refreshBeautifyPreview();
    toast('聊天主页壁纸已清除');
  };

  // 聊天右上角菜单改为美化菜单
  window.openChatSettings=function(){
    const cid=window._cdChatId;
    if(!cid){ toast('请先进入聊天'); return; }

    const ov=document.createElement('div');
    ov.style.cssText='position:fixed;inset:0;z-index:700;background:rgba(0,0,0,.22);display:flex;align-items:flex-end;justify-content:center;';
    ov.innerHTML=`
      <div style="width:100%;max-width:520px;background:rgba(255,255,255,.94);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
                  border-radius:18px 18px 0 0;padding:12px 12px calc(env(safe-area-inset-bottom,0px) + 12px);">
        <div style="text-align:center;font-size:13px;color:#666;padding:8px 0 10px;">聊天美化</div>
        <button id="p13-set-detail" style="width:100%;padding:12px;border-radius:12px;margin-bottom:8px;background:#f3f1ee;">设置当前聊天壁纸</button>
        <button id="p13-clear-detail" style="width:100%;padding:12px;border-radius:12px;margin-bottom:8px;background:#f3f1ee;">清除当前聊天壁纸</button>
        <button id="p13-set-home" style="width:100%;padding:12px;border-radius:12px;margin-bottom:8px;background:#f3f1ee;">设置聊天主页壁纸</button>
        <button id="p13-clear-home" style="width:100%;padding:12px;border-radius:12px;margin-bottom:8px;background:#f3f1ee;">清除聊天主页壁纸</button>
        <button id="p13-cancel" style="width:100%;padding:12px;border-radius:12px;background:#e9e9e9;">取消</button>
      </div>
    `;
    document.body.appendChild(ov);

    const close=()=>ov.remove();
    ov.addEventListener('click',e=>{ if(e.target===ov) close(); });

    ov.querySelector('#p13-set-detail').onclick=function(){
      close();
      openUploadModal('chat_detail_bg_'+cid,(k,src)=>{
        s(DETAIL_KEY_PREFIX+cid,src);
        applyChatDetailBg(cid);
        toast('当前聊天壁纸已设置');
      });
    };
    ov.querySelector('#p13-clear-detail').onclick=function(){
      del(DETAIL_KEY_PREFIX+cid);
      applyChatDetailBg(cid);
      close();
      toast('当前聊天壁纸已清除');
    };
    ov.querySelector('#p13-set-home').onclick=function(){ close(); window.pickChatHomeBg(); };
    ov.querySelector('#p13-clear-home').onclick=function(){ close(); window.clearChatHomeBg(); };
    ov.querySelector('#p13-cancel').onclick=close;
  };

  // 包装 openChatDetail / openApp
  if(typeof window.openChatDetail==='function' && !window.__P13_WRAP_DETAIL__){
    window.__P13_WRAP_DETAIL__=1;
    const old=window.openChatDetail;
    window.openChatDetail=function(cid){
      old(cid);
      setTimeout(()=>applyChatDetailBg(cid),60);
    };
  }
  if(typeof window.openApp==='function' && !window.__P13_WRAP_OPENAPP__){
    window.__P13_WRAP_OPENAPP__=1;
    const oldOpen=window.openApp;
    window.openApp=function(name){
      oldOpen(name);
      if(name==='chat') setTimeout(applyChatHomeBg,60);
    };
  }

  // ---------- 初始化 ----------
  function ensureSettingsIcon(){
    const docks=$$('#dock .dock-item');
    if(!docks || docks.length<2) return;
    const icon=docks[1].querySelector('.dock-icon');
    if(!icon) return;
    if(!icon.querySelector('img') && !(icon.textContent||'').trim()){
      icon.textContent='☼';
    }
  }

  function boot(){
    bindTabs();
    initSearchToggle();
    injectBeautifyGroup();
    applyChatHomeBg();
    if(window._cdChatId) applyChatDetailBg(window._cdChatId);
    ensureSettingsIcon();
    if(typeof window.renderMsgList==='function') window.renderMsgList();
  }

  function waitReady(){
    const ok = $('#app-chat') && $('#tab-messages') && $('#msg-list') && $('#chat-new-btn');
    if(ok){ boot(); return; }
    setTimeout(waitReady,180);
  }
  waitReady();

  const mo=new MutationObserver(()=>{
    bindTabs();
    initSearchToggle();
    injectBeautifyGroup();
    ensureSettingsIcon();
  });
  function startObserve(){
    if(document.body){
      mo.observe(document.body,{childList:true,subtree:true});
    }else setTimeout(startObserve,100);
  }
  startObserve();

  window.addEventListener('pageshow',boot);
})();
/* =========================
   [BUGFIX-014] iOS 全系统安全区 / 底部白条自适配
========================= */
(function(){
  if(window.__TQ_IOS_ADAPTIVE_014__) return;
  window.__TQ_IOS_ADAPTIVE_014__ = 1;

  const isIOS =
    /iP(hone|od|ad)/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  if(!isIOS) return;

  function ensureViewportFit(){
    let meta = document.querySelector('meta[name="viewport"]');
    if(!meta){
      meta = document.createElement('meta');
      meta.name = 'viewport';
      document.head.appendChild(meta);
    }
    let content = meta.getAttribute('content') || 'width=device-width, initial-scale=1';
    if(!/viewport-fit\s*=\s*cover/i.test(content)){
      content = content.replace(/\s*,\s*$/, '');
      content += ', viewport-fit=cover';
      meta.setAttribute('content', content);
    }
  }

  ensureViewportFit();

  const style = document.createElement('style');
  style.id = 'tq-ios-adaptive-014-style';
  style.textContent = `
    :root{
      --tq-ios-vh: 100vh;
      --tq-ios-root-bg: #111111;
      --tq-ios-root-bg-img: none;
      --tq-ios-root-bg-size: cover;
      --tq-ios-root-bg-pos: center center;
      --tq-ios-root-bg-repeat: no-repeat;
    }

    html{
      min-height: var(--tq-ios-vh) !important;
      background-color: var(--tq-ios-root-bg) !important;
      background-image: var(--tq-ios-root-bg-img) !important;
      background-size: var(--tq-ios-root-bg-size) !important;
      background-position: var(--tq-ios-root-bg-pos) !important;
      background-repeat: var(--tq-ios-root-bg-repeat) !important;
      overscroll-behavior: none;
    }

    body{
      min-height: var(--tq-ios-vh) !important;
      background: transparent !important;
      -webkit-text-size-adjust: 100%;
      text-size-adjust: 100%;
      overscroll-behavior: none;
    }

    #wallpaper,
    #tq-wp-layer{
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      width: auto !important;
      height: auto !important;
      min-height: 0 !important;
    }

    #desktop,
    #pages-wrap{
      min-height: var(--tq-ios-vh) !important;
      height: var(--tq-ios-vh) !important;
    }

    .app-page,
    #chat-detail,
    #contact-create-page,
    .me-sub-page,
    .page{
      min-height: var(--tq-ios-vh) !important;
    }

    .tq-ios-safe-top-auto,
    .tq-ios-safe-bottom-auto{
      box-sizing: border-box;
      background-clip: padding-box !important;
    }

    .tq-ios-safe-top-auto{
      padding-top: calc(var(--tq-ios-base-pt, 0px) + constant(safe-area-inset-top)) !important;
      padding-top: calc(var(--tq-ios-base-pt, 0px) + env(safe-area-inset-top, 0px)) !important;
    }

    .tq-ios-safe-bottom-auto{
      padding-bottom: calc(var(--tq-ios-base-pb, 0px) + constant(safe-area-inset-bottom)) !important;
      padding-bottom: calc(var(--tq-ios-base-pb, 0px) + env(safe-area-inset-bottom, 0px)) !important;
    }

    .tq-ios-safe-bottom-auto::after{
      content: "";
      position: absolute;
      left: 0;
      right: 0;
      bottom: calc(-1 * constant(safe-area-inset-bottom));
      bottom: calc(-1 * env(safe-area-inset-bottom, 0px));
      height: constant(safe-area-inset-bottom);
      height: env(safe-area-inset-bottom, 0px);
      background: inherit;
      pointer-events: none;
      border-radius: 0 !important;
    }

    .tq-ios-kb-open .tq-ios-safe-bottom-auto{
      padding-bottom: var(--tq-ios-base-pb, 0px) !important;
    }

    .tq-ios-kb-open .tq-ios-safe-bottom-auto::after{
      display: none !important;
    }
  `;
  document.head.appendChild(style);

  function hasRealColor(v){
    return !!v && v !== 'transparent' && v !== 'rgba(0, 0, 0, 0)';
  }

  function pickBgInfo(){
    const info = {
      color: '#111111',
      image: 'none',
      size: 'cover',
      pos: 'center center',
      repeat: 'no-repeat'
    };

    const imgSelectors = [
      '#tq-wp-layer',
      '#wallpaper',
      '.page.active',
      '.app-page.active',
      '#chat-detail',
      '#app-chat',
      '#desktop',
      'body'
    ];

    const colorSelectors = [
      '.page.active',
      '.app-page.active',
      '#chat-detail',
      '#app-chat',
      '#desktop',
      'body',
      'html'
    ];

    for(const sel of imgSelectors){
      const el = document.querySelector(sel);
      if(!el) continue;
      const st = getComputedStyle(el);
      if(st.backgroundImage && st.backgroundImage !== 'none'){
        info.image = st.backgroundImage;
        info.size = st.backgroundSize || 'cover';
        info.pos = st.backgroundPosition || 'center center';
        info.repeat = st.backgroundRepeat || 'no-repeat';
        break;
      }
    }

    for(const sel of colorSelectors){
      const el = document.querySelector(sel);
      if(!el) continue;
      const st = getComputedStyle(el);
      if(hasRealColor(st.backgroundColor)){
        info.color = st.backgroundColor;
        break;
      }
    }

    return info;
  }

  function clearAutoSafeMarks(){
    document.querySelectorAll('[data-tq-ios-safe]').forEach(el=>{
      el.classList.remove('tq-ios-safe-top-auto','tq-ios-safe-bottom-auto');
      el.removeAttribute('data-tq-ios-safe');
      el.style.removeProperty('--tq-ios-base-pt');
      el.style.removeProperty('--tq-ios-base-pb');
    });
  }

  function isVisibleFixedBar(el){
    if(!(el instanceof HTMLElement)) return false;
    const st = getComputedStyle(el);

    if(!/fixed|sticky/.test(st.position)) return false;
    if(st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) return false;

    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if(rect.width < vw * 0.45) return false;
    if(rect.height < 24 || rect.height > 220) return false;
    if(rect.bottom < -4 || rect.top > vh + 4) return false;

    return true;
  }

  function markAutoSafeBars(){
    if(!document.body) return;

    clearAutoSafeMarks();

    const all = Array.from(document.body.querySelectorAll('*'));
    const vh = window.innerHeight;

    all.forEach(el=>{
      if(!isVisibleFixedBar(el)) return;

      const st = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const topGap = Math.abs(rect.top);
      const bottomGap = Math.abs(vh - rect.bottom);

      if(topGap <= 6){
        el.classList.add('tq-ios-safe-top-auto');
        el.setAttribute('data-tq-ios-safe','top');
        el.style.setProperty('--tq-ios-base-pt', st.paddingTop || '0px');
      }else if(bottomGap <= 6){
        el.classList.add('tq-ios-safe-bottom-auto');
        el.setAttribute('data-tq-ios-safe','bottom');
        el.style.setProperty('--tq-ios-base-pb', st.paddingBottom || '0px');
      }
    });
  }

  function syncVh(){
    const vv = window.visualViewport;
    let h = Math.max(
      window.innerHeight || 0,
      document.documentElement.clientHeight || 0
    );

    if(vv && vv.height){
      h = Math.max(h, Math.round(vv.height + (vv.offsetTop || 0)));
    }

    document.documentElement.style.setProperty('--tq-ios-vh', h + 'px');
    document.documentElement.style.setProperty('--app-vh', h + 'px');
    document.documentElement.style.setProperty('--ios-vh', h + 'px');

    const kbOpen = !!(vv && (window.innerHeight - vv.height > 140));
    document.documentElement.classList.toggle('tq-ios-kb-open', kbOpen);
  }

  function syncRootBg(){
    const bg = pickBgInfo();
    document.documentElement.style.setProperty('--tq-ios-root-bg', bg.color || '#111111');
    document.documentElement.style.setProperty('--tq-ios-root-bg-img', bg.image || 'none');
    document.documentElement.style.setProperty('--tq-ios-root-bg-size', bg.size || 'cover');
    document.documentElement.style.setProperty('--tq-ios-root-bg-pos', bg.pos || 'center center');
    document.documentElement.style.setProperty('--tq-ios-root-bg-repeat', bg.repeat || 'no-repeat');
  }

  let rafId = 0;
  function refreshAll(){
    syncVh();
    syncRootBg();
    markAutoSafeBars();
  }

  function queueRefresh(){
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(refreshAll);
  }

  window.addEventListener('resize', queueRefresh, {passive:true});
  window.addEventListener('orientationchange', ()=>setTimeout(queueRefresh, 160), {passive:true});
  window.addEventListener('pageshow', queueRefresh, {passive:true});
  window.addEventListener('focusin', ()=>setTimeout(queueRefresh, 50), {passive:true});
  window.addEventListener('focusout', ()=>setTimeout(queueRefresh, 120), {passive:true});

  if(window.visualViewport){
    window.visualViewport.addEventListener('resize', queueRefresh, {passive:true});
    window.visualViewport.addEventListener('scroll', queueRefresh, {passive:true});
  }

  const mo = new MutationObserver(queueRefresh);
  function startObserve(){
    if(document.body){
      mo.observe(document.body,{
        childList:true,
        subtree:true,
        attributes:true,
        attributeFilter:['class','style']
      });
    }else{
      setTimeout(startObserve, 100);
    }
  }
  startObserve();

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', queueRefresh, {once:true});
  }else{
    queueRefresh();
  }

  window.TQIOSAdaptive014 = {
    refresh: queueRefresh
  };
})();
/* =========================
   [BUGFIX-015] iOS 图标防 Emoji 化修复
========================= */
(function(){
  if(window.__TQ_IOS_ICON_FIX_015__) return;
  window.__TQ_IOS_ICON_FIX_015__ = 1;

  const isIOS =
    /iP(hone|od|ad)/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  if(!isIOS) return;

  const dockApps = ['chat','settings','worldbook'];

  const SAFE_TEXT_FALLBACK = {
    music: '♪',
    weather: '☾',
    playwhat: 'ꕥ',
    calendar: '⌘',
    fanfic: '❈',
    intimate: '♡',
    monitor: '☍',
    chat: '❝',
    settings: '☼',
    worldbook: '◉'
  };

  // 这两个最容易在 iOS 里变 emoji，直接改成 SVG，最稳
  const SVG_MAP = {
    mail: `
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <rect x="4.5" y="6.5" width="15" height="11" rx="1.8"></rect>
        <path d="M5.5 8.2L12 13l6.5-4.8"></path>
      </svg>
    `,
    diary: `
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="4.5" x2="12" y2="7.7"></line>
        <circle cx="12" cy="9.6" r="0.7" fill="currentColor" stroke="none"></circle>
        <path d="M12 19s-4.7-3-6.1-4.8c-1.3-1.6-.8-3.8.8-4.6 1.4-.7 2.9 0 3.7 1.1.8-1.1 2.3-1.8 3.7-1.1 1.6.8 2.1 3 .8 4.6C16.7 16 12 19 12 19z"></path>
      </svg>
    `
  };

  function getCustomIcons(){
    try{
      return JSON.parse(localStorage.getItem('tq_custom_icons') || '{}');
    }catch(e){
      return {};
    }
  }

  function isImageValue(v){
    return typeof v === 'string' &&
      (v.startsWith('http') || v.startsWith('data:image/') || v.startsWith('blob:'));
  }

  function escAttr(s){
    return String(s)
      .replace(/&/g,'&amp;')
      .replace(/"/g,'&quot;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;');
  }

  function normalizeTextIcon(txt){
    let t = String(txt || '')
      .replace(/\uFE0F/g,'')
      .replace(/\uFE0E/g,'')
      .trim();

    if(!t) return '';

    // 单字符图标强制走文本样式，减少 iOS emoji 化
    if(Array.from(t).length === 1){
      t += '\uFE0E';
    }
    return t;
  }

  function ensureStyle(){
    if(document.getElementById('tq-ios-icon-fix-015-style')) return;

    const st = document.createElement('style');
    st.id = 'tq-ios-icon-fix-015-style';
    st.textContent = `
      .app-icon,
      .dock-icon{
        display:flex !important;
        align-items:center !important;
        justify-content:center !important;
        line-height:1 !important;
        color:inherit !important;
        font-variant-emoji:text !important;
        font-family:
          "Times New Roman",
          "Georgia",
          "Noto Sans Symbols 2",
          "Segoe UI Symbol",
          "PingFang SC",
          "Hiragino Sans GB",
          serif !important;
        -webkit-font-smoothing:antialiased;
        text-rendering:geometricPrecision;
      }

      .app-icon svg,
      .dock-icon svg{
        width:72%;
        height:72%;
        display:block;
        overflow:visible;
      }

      #dock .dock-icon svg{
        width:70%;
        height:70%;
      }

      .app-icon img,
      .dock-icon img{
        display:block;
        width:100%;
        height:100%;
        object-fit:cover;
        border-radius:6px;
      }
    `;
    document.head.appendChild(st);
  }

  function setImgIcon(el, src){
    const sig = 'img:' + src;
    if(el.dataset.tqIosIconSig === sig) return;
    el.dataset.tqIosIconSig = sig;
    el.innerHTML = '<img src="' + escAttr(src) + '" alt="">';
  }

  function setSvgIcon(el, key){
    const svg = SVG_MAP[key];
    if(!svg) return false;
    const sig = 'svg:' + key;
    if(el.dataset.tqIosIconSig === sig) return true;
    el.dataset.tqIosIconSig = sig;
    el.innerHTML = svg;
    return true;
  }

  function setTextIcon(el, txt){
    const out = normalizeTextIcon(txt);
    if(!out) return;
    const sig = 'txt:' + out;
    if(el.dataset.tqIosIconSig === sig) return;
    el.dataset.tqIosIconSig = sig;
    el.textContent = out;
  }

  function applyOne(el, app, customMap){
    if(!el || !app) return;

    const custom = customMap[app];

    // 自定义图片图标：保留
    if(isImageValue(custom)){
      setImgIcon(el, custom);
      return;
    }

    // 自定义文字图标：保留，但做文本化处理
    if(typeof custom === 'string' && custom.trim()){
      setTextIcon(el, custom);
      return;
    }

    // 没有自定义时，优先处理最容易 emoji 化的默认图标
    if(app === 'mail' || app === 'diary'){
      if(setSvgIcon(el, app)) return;
    }

    // 如果当前已经是图片，就不动
    const hasImg = el.querySelector('img');
    if(hasImg && hasImg.getAttribute('src')) return;

    // 其它图标：保留原字符，但强制文本风格
    const current = (el.textContent || '').trim();
    setTextIcon(el, current || SAFE_TEXT_FALLBACK[app] || '');
  }

  function refreshIcons(){
    ensureStyle();
    const customMap = getCustomIcons();

    document.querySelectorAll('.app-item[data-app]').forEach(item=>{
      const app = item.dataset.app;
      const icon = item.querySelector('.app-icon');
      applyOne(icon, app, customMap);
    });

    document.querySelectorAll('#dock .dock-item').forEach((item, i)=>{
      const app = dockApps[i];
      const icon = item.querySelector('.dock-icon');
      applyOne(icon, app, customMap);
    });
  }

  let rafId = 0;
  function queueRefresh(){
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(refreshIcons);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', queueRefresh, {once:true});
  }else{
    queueRefresh();
  }

  window.addEventListener('pageshow', queueRefresh, {passive:true});
  window.addEventListener('load', queueRefresh, {passive:true});

  const mo = new MutationObserver(queueRefresh);
  function startObserve(){
    if(document.body){
      mo.observe(document.body,{
        childList:true,
        subtree:true,
        attributes:true,
        attributeFilter:['class','style']
      });
    }else{
      setTimeout(startObserve, 100);
    }
  }
  startObserve();

  window.TQIOSIconFix015 = {
    refresh: queueRefresh
  };
})();
