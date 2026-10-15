/**
 * content.js —— 注入到电商商品详情页
 * 职责一：在页面右下角创建悬浮「获取图片」按钮
 * 职责二：点击后扫描整页商品图片，过滤掉图标/占位图，发送给 background
 * 只在 manifest 里配置的淘宝 / 天猫 / 京东 / 拼多多域名下注入
 */
(function () {
  'use strict';

  // 小于这个尺寸（像素）的图片会被过滤，用于排除图标与小占位图
  var MIN_SIZE = 100;

  // URL 命中这些关键词的图片视为图标 / 占位图，直接丢弃
  var IGNORE_KEYWORDS = [
    'icon', 'logo', 'placeholder', 'sprite', 'loading', 'default-avatar',
    '1x1', 'spacer', 'blank', 'qrcode', 'qr-code', 'emoji'
  ];

  var state = {
    button: null,
    loading: false
  };

  /**
   * 把可能是相对路径的图片地址补全成绝对 URL
   * 同时过滤掉 base64、blob、svg 这类无法当作商品图保存的内容
   */
  function toAbsolute(url) {
    if (!url) return null;
    url = url.trim();
    if (!url) return null;
    if (/^(data|blob|javascript):/i.test(url)) return null;
    if (/\.svg(\?|$)/i.test(url)) return null;
    try {
      // 处理 //xxx.com/a.jpg 这种协议相对路径
      if (url.indexOf('//') === 0) {
        url = location.protocol + url;
      }
      return new URL(url, location.href).href;
    } catch (e) {
      return null;
    }
  }

  /**
   * 判断这张图是否应该被过滤掉
   * 优先用元素真实的 naturalWidth / naturalHeight 判断，比看 URL 更准
   */
  function shouldIgnore(url, el) {
    if (!url) return true;
    var lower = url.toLowerCase();
    for (var i = 0; i < IGNORE_KEYWORDS.length; i++) {
      if (lower.indexOf(IGNORE_KEYWORDS[i]) !== -1) return true;
    }
    if (el && el.naturalWidth && el.naturalHeight) {
      if (el.naturalWidth < MIN_SIZE || el.naturalHeight < MIN_SIZE) return true;
    }
    return false;
  }

  /**
   * 从 srcset 中挑出分辨率最大的那一张
   * srcset 形如 "a.jpg 100w, b.jpg 800w"
   */
  function pickFromSrcset(srcset) {
    if (!srcset) return null;
    var parts = srcset.split(',');
    var best = null;
    var bestWidth = -1;
    for (var i = 0; i < parts.length; i++) {
      var seg = parts[i].trim().split(/\s+/);
      if (!seg[0]) continue;
      var w = parseInt(seg[1], 10) || 0;
      if (w > bestWidth) {
        bestWidth = w;
        best = seg[0];
      }
    }
    return best;
  }

  /**
   * 扫描整个页面提取商品图片
   * 来源 1：img 标签的 src 及各类懒加载属性 + srcset
   * 来源 2：元素的 CSS background-image（部分平台用背景图渲染商品图）
   */
  function extractImages() {
    var result = [];
    var seen = Object.create(null);

    function add(url, el) {
      var abs = toAbsolute(url);
      if (!abs) return;
      if (seen[abs]) return;              // 去重
      if (shouldIgnore(abs, el)) return;  // 过滤图标与小图
      seen[abs] = true;
      result.push({
        url: abs,
        width: el && el.naturalWidth ? el.naturalWidth : 0,
        height: el && el.naturalHeight ? el.naturalHeight : 0
      });
    }

    // 1) 所有 img 标签
    var imgs = document.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      var attrs = [
        'src', 'data-src', 'data-lazy-src', 'data-lazyload',
        'data-original', 'data-ks-lazyload', 'data-img', 'data-echo'
      ];
      for (var j = 0; j < attrs.length; j++) {
        add(img.getAttribute(attrs[j]), img);
      }
      add(pickFromSrcset(img.getAttribute('srcset')), img);
    }

    // 2) 元素的 CSS 背景图
    var all = document.querySelectorAll('*');
    for (var k = 0; k < all.length; k++) {
      var bg = getComputedStyle(all[k]).backgroundImage;
      if (!bg || bg === 'none') continue;
      var m = bg.match(/url\(['"]?([^'")]+)['"]?\)/);
      if (m) add(m[1], null);
    }

    return result;
  }

  /** 创建右下角悬浮按钮 */
  function createButton() {
    if (state.button) return;
    var btn = document.createElement('div');
    btn.id = 'imagegrab-fab';
    btn.className = 'imagegrab-fab';
    btn.innerHTML = '<span class="imagegrab-fab-text">获取图片</span>';
    btn.title = '提取本页所有商品图片';
    btn.addEventListener('click', onButtonClick);
    document.body.appendChild(btn);
    state.button = btn;
  }

  /** 切换按钮文案与 loading 状态 */
  function setButtonState(text, loading) {
    if (!state.button) return;
    var span = state.button.querySelector('.imagegrab-fab-text');
    if (span) span.textContent = text;
    if (loading) {
      state.button.classList.add('is-loading');
    } else {
      state.button.classList.remove('is-loading');
    }
  }

  /** 按钮点击：提取图片 → 发给 background → 由 background 打开结果页 */
  function onButtonClick() {
    if (state.loading) return;
    state.loading = true;
    setButtonState('提取中…', true);

    // 延迟一小会儿，先让 loading 状态渲染出来，再执行较重的扫描
    setTimeout(function () {
      var images = [];
      try {
        images = extractImages();
      } catch (e) {
        images = [];
      }

      chrome.runtime.sendMessage(
        {
          type: 'IMAGES_EXTRACTED',
          images: images,
          pageUrl: location.href,
          pageTitle: document.title
        },
        function () {
          state.loading = false;
          setButtonState('获取图片', false);
          if (images.length === 0) {
            alert('没有从当前页面提取到图片，请确认页面已完全加载后重试。');
          }
        }
      );
    }, 60);
  }

  // body 可能还没就绪，两种情况都兜住
  if (document.body) {
    createButton();
  } else {
    window.addEventListener('DOMContentLoaded', createButton);
  }
})();
