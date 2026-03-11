console.log('[bugfix2] loaded final0404');
setTimeout(function(){
  var tag = document.createElement('div');
  tag.textContent = 'bugfix2 已加载';
  tag.style.cssText = 'position:fixed;right:10px;top:10px;z-index:999999;background:#2e7d32;color:#fff;padding:6px 10px;border-radius:8px;font-size:12px;';
  document.body.appendChild(tag);
  setTimeout(function(){ tag.remove(); }, 2000);
}, 0);

(function(){
  var tag = document.createElement('div');
  tag.textContent = 'bugfix2 v3 已加载';
  tag.style.cssText = 'position:fixed;right:10px;top:10px;z-index:999999;background:#2e7d32;color:#fff;padding:6px 10px;border-radius:8px;font-size:12px;';
  document.body.appendChild(tag);
  setTimeout(function(){ tag.remove(); }, 2000);
})();

(function(){
  if (window.__BUGFIX2_V3__) return;
  window.__BUGFIX2_V3__ = true;

  function $(s){ return document.querySelector(s); }
  function $$(s){ return document.querySelectorAll(s); }

  function toast(msg){
    if (typeof showToast === 'function') showToast(msg);
  }

  function getFlex(key){
    try{
      var raw = localStorage.getItem(key);
      if (raw == null) return null;
      try { return JSON.parse(raw); } catch(e){ return raw; }
    }catch(e){ return null; }
  }

  function setJson(key, val){
    try{ localStorage.setItem(key, JSON.stringify(val)); }catch(e){}
  }

  // 关键：把“原始字符串”统一成 JSON，避免 lsGet 读不到
  function normalizeKey(key){
    try{
      var raw = localStorage.getItem(key);
      if (raw == null) return;
      try { JSON.parse(raw); } catch(e){
        localStorage.setItem(key, JSON.stringify(raw));
      }
    }catch(e){}
  }

  function ensureStyle(){
    if ($('#bugfix2-style')) return;
    var st = document.createElement('style');
    st.id = 'bugfix2-style';
    st.textContent = [
      '#tab-messages{display:flex !important;flex-direction:column !important;}',
      '#tab-messages .msg-search-wrap{position:sticky !important;top:0 !important;z-index:50 !important;background:var(--bg-pri) !important;padding-top:6px !important;}',
      'body.dark-mode #tab-messages .msg-search-wrap{background:#1a1a1a !important;}',
      '.bf2-ph{font-size:14px;color:var(--txt-light);}'
    ].join('\n');
    document.head.appendChild(st);
  }

  // ---------- A. 搜索栏上移 ----------
  function fixSearchBar(){
    var panel = $('#tab-messages');
    if (!panel) return;
    var wrap = panel.querySelector('.msg-search-wrap');
    if (!wrap){
      var input = $('#msg-search');
      if (input) wrap = input.closest ? input.closest('.msg-search-wrap') : null;
    }
    if (wrap && panel.firstElementChild !== wrap){
      panel.insertBefore(wrap, panel.firstElementChild);
    }
  }

  // ---------- B. 壁纸修复 ----------
  function getWallpaperSrc(){
    var s1 = getFlex('tq_wallpaper_home');
    var s2 = getFlex('tq_img_wallpaper_home');
    return (typeof s1 === 'string' && s1) ? s1 : ((typeof s2 === 'string' && s2) ? s2 : null);
  }

  function applyWallpaperNow(src){
    var wp = $('#wallpaper');
    if (wp){
      if (src){
        wp.style.backgroundImage = 'url("' + String(src).replace(/"/g, '%22') + '")';
        wp.style.backgroundSize = 'cover';
        wp.style.backgroundPosition = 'center';
        wp.style.backgroundRepeat = 'no-repeat';
      }else{
        wp.style.backgroundImage = 'none';
      }
    }

    // 兼容你脚本里新增的 tq-wp-layer
    var layer = $('#tq-wp-layer');
    if (layer){
      if (src){
        layer.style.backgroundImage = 'url("' + String(src).replace(/"/g, '%22') + '")';
        document.body.classList.add('has-wp');
      }else{
        layer.style.backgroundImage = 'none';
        document.body.classList.remove('has-wp');
      }
    }

    var preview = $('#set-wp-home');
    if (preview){
      preview.innerHTML = src
        ? '<img src="' + src + '" alt="">'
        : '<span style="font-size:12px;color:var(--txt-light);">点击下方按钮设置</span>';
    }
  }

  function patchWallpaperFuncs(){
    // 覆盖为稳定版
    window.pickWallpaper = function(){
      if (typeof openUploadModal !== 'function'){ toast('上传模块未就绪'); return; }
      openUploadModal('wallpaper_home', function(k, src){
        window._wpTemp = src;
        var p = $('#set-wp-home');
        if (p) p.innerHTML = '<img src="' + src + '" alt="">';
        toast('预览已更新，点击“应用保存”生效');
      });
    };

    window.applyWallpaper = function(){
      var inp = $('#set-wp-url');
      var urlVal = inp ? inp.value.trim() : '';
      if (urlVal) window._wpTemp = urlVal;
      if (!window._wpTemp){
        toast('请先选择图片或输入URL');
        return;
      }
      setJson('tq_wallpaper_home', window._wpTemp);
      setJson('tq_img_wallpaper_home', window._wpTemp);
      applyWallpaperNow(window._wpTemp);
      toast('壁纸已应用保存');
    };

    window.clearWallpaper = function(){
      try{
        localStorage.removeItem('tq_wallpaper_home');
        localStorage.removeItem('tq_img_wallpaper_home');
      }catch(e){}
      window._wpTemp = null;
      var inp = $('#set-wp-url');
      if (inp) inp.value = '';
      applyWallpaperNow(null);
      toast('壁纸已清除');
    };
  }

  // ---------- C. 聊天头像修复 ----------
  function bindAvatarFallback(root){
    var sel = [
      '.cd-msg-avatar img',
      '.contact-item-avatar img',
      '.msg-item-avatar img',
      '.me-avatar img',
      '.me-ue-avatar img'
    ].join(',');

    (root || document).querySelectorAll(sel).forEach(function(img){
      if (img.__bf2__) return;
      img.__bf2__ = 1;

      if (!img.getAttribute('src')) {
        var p0 = img.parentNode;
        if (p0 && !p0.querySelector('.bf2-ph')){
          var s0 = document.createElement('span');
          s0.className = 'bf2-ph';
          s0.textContent = '𖥦';
          p0.appendChild(s0);
        }
        try{ img.remove(); }catch(e){}
        return;
      }

      img.addEventListener('error', function(){
        var p = img.parentNode;
        if (p && !p.querySelector('.bf2-ph')){
          var s = document.createElement('span');
          s.className = 'bf2-ph';
          s.textContent = '𖥦';
          p.appendChild(s);
        }
        try{ img.remove(); }catch(e){}
      });
    });
  }

  function patchRenderHooks(){
    ['renderMsgList','renderContactList','renderChatMessages','refreshMeTab'].forEach(function(fn){
      var old = window[fn];
      if (typeof old === 'function' && !old.__bf2wrap){
        var nw = function(){
          var r = old.apply(this, arguments);
          setTimeout(function(){
            fixSearchBar();
            bindAvatarFallback(document);
          }, 0);
          return r;
        };
        nw.__bf2wrap = true;
        window[fn] = nw;
      }
    });
  }

  function boot(){
    normalizeKey('tq_wallpaper_home');
    normalizeKey('tq_img_wallpaper_home');
    normalizeKey('tq_user_avatar');

    ensureStyle();
    patchWallpaperFuncs();
    patchRenderHooks();

    fixSearchBar();
    applyWallpaperNow(getWallpaperSrc());
    bindAvatarFallback(document);

    // 给动态页面反复补刀（不重）
    var n = 0;
    var timer = setInterval(function(){
      n++;
      fixSearchBar();
      applyWallpaperNow(getWallpaperSrc());
      bindAvatarFallback(document);
      if (n > 12) clearInterval(timer);
    }, 800);

    // 监听DOM新增
    var mo = new MutationObserver(function(muts){
      muts.forEach(function(m){
        (m.addedNodes || []).forEach(function(node){
          if (node && node.nodeType === 1) bindAvatarFallback(node);
        });
      });
    });
    mo.observe(document.body, {childList:true, subtree:true});

    console.log('[bugfix2] v3 loaded');
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
