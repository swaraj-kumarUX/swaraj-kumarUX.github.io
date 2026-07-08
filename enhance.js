/* ============================================================
   enhance.js — shared interaction polish
   - buttery custom cursor with hover states
   - magnetic buttons/links
   - page-transition curtain between pages
   - Lenis smooth scroll (if the library is present on the page)
   Degrades gracefully: touch devices & reduced-motion get nothing intrusive.
   ============================================================ */
(function () {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover:hover) and (pointer:fine)').matches;

  /* ---------- theme (light / dark) ---------- */
  const root = document.documentElement;
  function applyTheme(t, animate) {
    if (animate) {
      root.classList.add('theme-anim');
      clearTimeout(applyTheme.__t);
      applyTheme.__t = setTimeout(() => root.classList.remove('theme-anim'), 800);
    }
    root.dataset.theme = t;
    try { localStorage.setItem('theme', t); } catch (e) {}
    dispatchEvent(new CustomEvent('themechange', { detail: { theme: t } }));
    const btn = document.querySelector('.theme-toggle');
    if (btn) { btn.textContent = t === 'light' ? '☾' : '☀'; btn.setAttribute('aria-label', t === 'light' ? 'Switch to dark mode' : 'Switch to light mode'); }
  }
  // initial (set ASAP; inline head script may have done it already)
  let saved = null; try { saved = localStorage.getItem('theme'); } catch (e) {}
  const initial = saved || root.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  applyTheme(initial, false);

  const tbtn = document.createElement('button');
  tbtn.className = 'theme-toggle';
  tbtn.type = 'button';
  tbtn.textContent = initial === 'light' ? '☾' : '☀';
  tbtn.setAttribute('aria-label', initial === 'light' ? 'Switch to dark mode' : 'Switch to light mode');
  tbtn.addEventListener('click', () => applyTheme(root.dataset.theme === 'light' ? 'dark' : 'light', true));
  document.body.appendChild(tbtn);

  /* ---------- Lenis smooth scroll (only if loaded) ---------- */
  if (!reduce && window.Lenis) {
    try {
      const lenis = new window.Lenis({
        lerp: 0.14,             // responsive smoothing — tracks the wheel closely
        wheelMultiplier: 1.15,  // keep native-feeling scroll distance per tick
        smoothWheel: true,
        touchMultiplier: 1.6,
      });
      document.documentElement.classList.add('lenis');
      window.__lenis = lenis;
      function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
      requestAnimationFrame(raf);
      // keep in-page anchor clicks smooth
      document.querySelectorAll('a[href^="#"]').forEach((a) => {
        a.addEventListener('click', (e) => {
          const id = a.getAttribute('href');
          if (id.length > 1) {
            const t = document.querySelector(id);
            if (t) { e.preventDefault(); lenis.scrollTo(t, { offset: 0, duration: 1.2 }); }
          }
        });
      });
    } catch (e) { /* no-op */ }
  }

  /* ---------- custom cursor ---------- */
  if (finePointer && !reduce) {
    document.documentElement.classList.add('cur-on');
    const dot = document.createElement('div'); dot.className = 'cursor-dot';
    const ring = document.createElement('div'); ring.className = 'cursor-ring';
    document.body.appendChild(dot); document.body.appendChild(ring);

    let mx = innerWidth / 2, my = innerHeight / 2;   // target
    let rx = mx, ry = my;                             // ring (lagged)
    let visible = false;

    addEventListener('mousemove', (e) => {
      mx = e.clientX; my = e.clientY;
      if (!visible) { visible = true; dot.classList.remove('hidden'); ring.classList.remove('hidden'); }
      dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%,-50%)`;
    }, { passive: true });
    addEventListener('mouseleave', () => { dot.classList.add('hidden'); ring.classList.add('hidden'); visible = false; });
    addEventListener('mousedown', () => ring.classList.add('down'));
    addEventListener('mouseup', () => ring.classList.remove('down'));

    (function ringLoop() {
      rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
      ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%,-50%)`;
      requestAnimationFrame(ringLoop);
    })();

    const hoverSel = 'a, button, .card, .featured, .cta, .rail button, [data-cursor]';
    const bind = () => document.querySelectorAll(hoverSel).forEach((el) => {
      if (el.__cur) return; el.__cur = true;
      el.addEventListener('mouseenter', () => ring.classList.add('hover'));
      el.addEventListener('mouseleave', () => ring.classList.remove('hover'));
    });
    bind();
    // re-bind if DOM changes (e.g. rail dots injected later)
    new MutationObserver(bind).observe(document.body, { childList: true, subtree: true });
  }

  /* ---------- magnetic elements ---------- */
  if (finePointer && !reduce) {
    const mags = document.querySelectorAll('[data-magnetic]');
    mags.forEach((el) => {
      const strength = parseFloat(el.getAttribute('data-magnetic')) || 0.3;
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - (r.left + r.width / 2);
        const y = e.clientY - (r.top + r.height / 2);
        el.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
      });
      el.addEventListener('mouseleave', () => { el.style.transform = 'translate(0,0)'; });
    });
  }

  /* ---------- page-transition curtain ---------- */
  const fade = document.createElement('div');
  fade.className = 'page-fade';
  fade.innerHTML = '<span class="pf-mark">SK</span>';
  document.body.appendChild(fade);

  function isInternalDoc(a) {
    if (!a || !a.href) return false;
    if (a.target === '_blank' || a.hasAttribute('download')) return false;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return false;
    if (url.pathname === location.pathname) return false;      // same page (anchor)
    return /\.html?$/.test(url.pathname) || url.pathname.endsWith('/');
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a || !isInternalDoc(a) || reduce) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    const href = a.href;
    fade.classList.add('show');
    setTimeout(() => { location.href = href; }, 480);
  });

  // handle bfcache restore
  addEventListener('pageshow', (ev) => { if (ev.persisted) fade.classList.remove('show'); });
})();
