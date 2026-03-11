(function(){
  if (window.__BUGFIX3_LOADED__) return;
  window.__BUGFIX3_LOADED__ = true;

  function q(s){ return document.querySelector(s); }
  function qa(s){ return document.querySelectorAll(s); }

  // ===== 关键修复：lsGet 兼容“JSON字符串 + 原始字符串” =====
  // 你项目里有的地方 setItem 原始字符串，有的地方 lsSet(JSON) 存储，导致读不到
  window.lsGet = function(k, d){
    try{
      var raw = localStorage.getItem(k);
      if (raw === null || raw === undefined) return (d === undefined ? null : d);
      try { return JSON.parse(raw); } catch(e){ return raw; }
    }catch(e){
      return (d === undefined ? null : d);
    }
  };

  function lsSetJson(k,v){
    try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){}
  }

  // ===== A. 搜索栏上移并固定 =====
  function fixSearchBar(){
    var panel = q('#tab-messages');
    if (!panel) return;

    var wrap = q('#tab-messages .msg-search-wrap') || q('.msg-search-wrap');
    if (!wrap) return;

    // 放到第一个
    if (panel.firstElementChild !== wrap) {
      panel.insertBefore(wrap, panel.firstElementChild);
    }

    // 强制置顶
    wrap.style.setProperty('position', 'sticky', 'important');
    wrap.style.setProperty('top', '0', 'important');
    wrap.style.setProperty('z-index', '80', 'important');
    wrap.style.setProperty('background', 'var(--bg-pri)', 'important');
    wrap.style.setProperty('padding-top', '6px', 'important');
  }

  // ===== B. 壁纸显示修复 =====
  function getWallpaperSrc(){
    var a = window.lsGet('tq_wallpaper_home', null);
    var b = window.lsGet('tq_img_wallpaper_home', null);
    if (typeof a === 'string' && a) return a;
    if (typeof b === 'string' && b) return b;
    return null;
  }

  function applyWallpaper(src){
    var wp = q('#wallpaper');
    if (wp){
      if (src){
        wp.style.backgroundImage = 'url("' + String(src).replace(/"/g, '%22') + '")';
        wp.style.backgroundSize = 'cover';
        wp.style.backgroundPosition = 'center';
        wp.style.backgroundRepeat = 'no-repeat';
      } else {
        wp.style.backgroundImage = 'none';
      }
    }

    // 兼容你后面补丁里的 tq-wp-layer
    var layer = q('#tq-wp-layer');
    if (layer){
      if (src){
        layer.style.backgroundImage = 'url("' + String(src).replace(/"/g, '%22') + '")';
        document.body.classList.add('has-wp');
      } else {
        layer.style.backgroundImage = 'none';
        document.body.classList.remove('has-wp');
      }
    }

    var preview = q('#set-wp-home');
    if (preview){
      preview.innerHTML = src
        ? '<img src="'+src+'" alt="">'
        : '<span style="font-size:12px;color:var(--txt-light);">点击下方按钮设置</span>';
    }
  }

  function patchWallpaperFunctions(){
    var oldApply = window.applyWallpaper;
    window.applyWallpaper = function(){
      try{ if (oldApply) oldApply.apply(this, arguments); }catch(e){}

      var inp = q('#set-wp-url');
      var urlVal = inp ? inp.value.trim() : '';
      var src = window._wpTemp || urlVal || getWallpaperSrc();

      if (src){
        lsSetJson('tq_wallpaper_home', src);
        lsSetJson('tq_img_wallpaper_home', src);
      }
      setTimeout(function(){ applyWallpaper(getWallpaperSrc()); }, 50);
      setTimeout(function(){ applyWallpaper(getWallpaperSrc()); }, 400);
    };

    var oldClear = window.clearWallpaper;
    window.clearWallpaper = function(){
      try{ if (oldClear) oldClear.apply(this, arguments); }catch(e){}
      try{
        localStorage.removeItem('tq_wallpaper_home');
        localStorage.removeItem('tq_img_wallpaper_home');
      }catch(e){}
      setTimeout(function(){ applyWallpaper(null); }, 30);
    };
  }

  // ===== C. 聊天头像兜底 =====
  function bindAvatarFallback(root){
    var sel = [
      '.cd-msg-avatar img',
      '.contact-item-avatar img',
      '.msg-item-avatar img',
      '.me-avatar img',
      '.me-ue-avatar img'
    ].join(',');

    var list = (root || document).querySelectorAll(sel);
    for (var i=0;i<list.length;i++){
      (function(img){
        if (img.__bf3_bound__) return;
        img.__bf3_bound__ = true;

        function fail(){
          var p = img.parentNode;
          if (!p) return;
          if (!p.querySelector('.bf3-ph')){
            var s = document.createElement('span');
            s.className = 'bf3-ph';
            s.textContent = '𖥦';
            s.style.cssText = 'font-size:14px;color:var(--txt-light);';
            p.appendChild(s);
          }
          try{ img.remove(); }catch(e){}
        }

        if (!img.getAttribute('src')) fail();
        img.addEventListener('error', fail);
      })(list[i]);
    }
  }

  function patchRenderHooks(){
    var names = ['renderMsgList','renderContactList','renderChatMessages','refreshMeTab'];
    for (var i=0;i<names.length;i++){
      (function(fn){
        var old = window[fn];
        if (typeof old === 'function' && !old.__bf3_wrap__){
          var nw = function(){
            var r = old.apply(this, arguments);
            setTimeout(function(){
              fixSearchBar();
              bindAvatarFallback(document);
            }, 0);
            return r;
          };
          nw.__bf3_wrap__ = true;
          window[fn] = nw;
        }
      })(names[i]);
    }
  }

  function boot(){
    patchWallpaperFunctions();
    patchRenderHooks();

    fixSearchBar();
    applyWallpaper(getWallpaperSrc());
    bindAvatarFallback(document);

    // 初期多次补刀
    var n = 0;
    var t = setInterval(function(){
      n++;
      fixSearchBar();
      applyWallpaper(getWallpaperSrc());
      bindAvatarFallback(document);
      if (n >= 12) clearInterval(t);
    }, 800);

    // 监听动态节点
    var mo = new MutationObserver(function(muts){
      for (var i=0;i<muts.length;i++){
        var nodes = muts[i].addedNodes || [];
        for (var j=0;j<nodes.length;j++){
          if (nodes[j] && nodes[j].nodeType === 1){
            bindAvatarFallback(nodes[j]);
          }
        }
      }
    });
    mo.observe(document.body, {childList:true, subtree:true});

    console.log('[bugfix3] loaded');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

