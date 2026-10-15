/**
 * main.js —— 官网交互脚本
 * 1. 滚动进入视口时元素淡入上移（IntersectionObserver）
 * 2. 导航栏当前区块高亮（滚动监听）
 * 3. 移动端汉堡菜单展开 / 收起
 * 4. 导航栏滚动后加阴影
 */

(function () {
  'use strict';

  var navbar = document.getElementById('navbar');
  var navLinks = document.getElementById('navLinks');
  var hamburger = document.getElementById('hamburger');

  /* ---------- 1. 滚动淡入动画 ---------- */
  var revealEls = document.querySelectorAll('.reveal');

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target); // 只触发一次，避免重复动画
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    // 老浏览器兜底：直接全部显示
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* ---------- 2. 导航当前区块高亮 ---------- */
  // 需要做高亮的区块，顺序与导航栏一致
  var sections = [
    { id: 'intro', link: null },
    { id: 'features', link: null },
    { id: 'install', link: null },
    { id: 'download', link: null }
  ];

  // 把每个区块和对应的导航链接关联起来
  sections.forEach(function (s) {
    s.el = document.getElementById(s.id);
    s.link = document.querySelector('.nav-link[href="#' + s.id + '"]');
  });

  function updateActiveNav() {
    // 以视口上方 100px 作为判定线
    var line = window.scrollY + 100;
    var current = null;

    sections.forEach(function (s) {
      if (s.el && s.el.offsetTop <= line) {
        current = s;
      }
    });

    sections.forEach(function (s) {
      if (!s.link) return;
      if (s === current) {
        s.link.classList.add('is-active');
      } else {
        s.link.classList.remove('is-active');
      }
    });
  }

  /* ---------- 3. 导航栏滚动阴影 ---------- */
  function updateNavbarShadow() {
    if (window.scrollY > 8) {
      navbar.classList.add('is-scrolled');
    } else {
      navbar.classList.remove('is-scrolled');
    }
  }

  // 滚动事件统一处理，用 rAF 节流
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      updateActiveNav();
      updateNavbarShadow();
      ticking = false;
    });
  }, { passive: true });

  /* ---------- 4. 移动端汉堡菜单 ---------- */
  hamburger.addEventListener('click', function () {
    var open = navLinks.classList.toggle('is-open');
    hamburger.classList.toggle('is-open', open);
  });

  // 点击导航项后自动收起菜单（移动端体验更好）
  navLinks.addEventListener('click', function (e) {
    if (e.target.classList.contains('nav-link')) {
      navLinks.classList.remove('is-open');
      hamburger.classList.remove('is-open');
    }
  });

  // 初始化一次，处理刷新时不在顶部的情况
  updateActiveNav();
  updateNavbarShadow();
})();
