/* sticky nav gains its frosted background once the page scrolls */
(() => {
  const nav = document.getElementById('nav');
  const on = () => nav.classList.toggle('is-stuck', scrollY > 8);
  addEventListener('scroll', on, { passive: true }); on();
})();

/* reveal-on-scroll: fade-in-up 30px, the same motion Stripe's dialog uses */
(() => {
  const els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('is-in')); return; }
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -8% 0px' });
  els.forEach(e => io.observe(e));
})();

/* Background canvases.
 *   ledgers  the home-page card's story: two invoice ledgers (blue, amber)
 *            drift out of phase, align, and turn green when they agree
 *   ramp     HubbleUI: a tonal colour scale whose hue sweeps the blues
 *   trend    redPro: a wall of noisy metrics settling into one clear trend
 *   graph    Stealth Canvas: a tangle of grey links between rows of nodes that
 *            thins out until only one node's channels stay, in colour
 *   aurora   light-on-navy ribbons for the dark bands (hue from data-hue)
 * Drawn only while visible; a single still frame under reduced motion. */
(() => {
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const smooth = (a, b, x) => { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  function lines(ctx, w, n, yOf, color, lw) {
    for (let i = 0; i < n; i++) {
      ctx.beginPath();
      for (let x = -8; x <= w + 8; x += 8) { const y = yOf(x / w, i); x === -8 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
      ctx.strokeStyle = typeof color === 'function' ? color(i) : color; ctx.lineWidth = lw; ctx.stroke();
    }
  }
  function mask(ctx, w, h, stops) {
    ctx.globalCompositeOperation = 'destination-in';
    const g = ctx.createLinearGradient(0, 0, 0, h);
    stops.forEach(([o, a]) => g.addColorStop(o, `rgba(0,0,0,${a})`));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
  }
  // the hero band runs low on the left (behind the screenshots) and rises into
  // the empty space right of the headline, so it never crosses the copy
  const heroBase = u => 980 - 760 * smooth(.05, .95, u);
  function fadeLeft(ctx, w, h) {
    ctx.globalCompositeOperation = 'destination-in';
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(0,0,0,.12)'); g.addColorStop(.5, 'rgba(0,0,0,.35)'); g.addColorStop(.72, 'rgba(0,0,0,1)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
  }
  const scenes = {
    ledgers(ctx, w, h, t) {
      const n = 26, amp = 60, gap = 5.2;
      const off = Math.PI * (.5 + .5 * Math.cos(t * .7));
      const match = 1 - smooth(.15, 1.3, off);
      const y = ph => (u, i) => heroBase(u) + amp * Math.sin(u * 4.2 + t * .5 + ph) + amp * .6 * Math.sin(u * 1.7 - t * .28 + ph * .5)
        + (i - n / 2) * gap * (.6 + u * 1.1);
      lines(ctx, w, n, y(0), `rgba(59,133,200,${.4 * (1 - match * .8)})`, 1.2);
      lines(ctx, w, n, y(off), `rgba(245,158,11,${.38 * (1 - match * .8)})`, 1.2);
      if (match > .01) lines(ctx, w, n, y(0), `rgba(0,128,117,${.55 * match})`, 1.3);
      fadeLeft(ctx, w, h);
    },
    ramp(ctx, w, h, t) {
      const n = 30, amp = 64, hue = 222 + 26 * Math.sin(t * .25);
      lines(ctx, w, n, (u, i) => heroBase(u) + amp * Math.sin(u * 4 + t * .45) + amp * .5 * Math.sin(u * 8.5 - t * .35)
        + (i - n / 2) * 5 * (.6 + u),
        i => `hsla(${hue + i * .9},78%,${88 - i * 1.7}%,.85)`, 1.4);
      fadeLeft(ctx, w, h);
    },
    trend(ctx, w, h, t) {
      const M = 16, c = .5 + .5 * Math.cos(t * .55), order = smooth(.3, .72, c);
      const trend = u => heroBase(u) + 18 * Math.sin(u * 6 + t * .4);
      const series = (u, j) => {
        const seed = j * 1.73, spread = (j / (M - 1) - .5) * 360;
        const chaos = heroBase(u) + spread + 46 * (Math.sin(u * 9 + seed + t * .9)
          + .6 * Math.sin(u * 17 + seed * 2 - t * 1.3) + .4 * Math.sin(u * 31 + seed * 3 + t * .7));
        return chaos + (trend(u) + (j - M / 2) * 1.4 - chaos) * order;
      };
      lines(ctx, w, M, series, 'rgba(216,78,85,.28)', 1.2);
      if (order > .01) {
        ctx.beginPath();
        for (let x = -8; x <= w + 8; x += 8) { const y = trend(x / w); x === -8 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
        ctx.strokeStyle = `rgba(216,78,85,${.9 * order})`; ctx.lineWidth = 2.6; ctx.stroke();
      }
      fadeLeft(ctx, w, h);
    },
    graph(ctx, w, h, t) {
      // on phones the band runs behind the copy, so it stays faint there
      ctx.globalAlpha = w < 700 ? .3 : 1;
      const c = .5 + .5 * Math.cos(t * .5), order = smooth(.3, .75, c);
      const cols = 11, rows = 4, nodes = [];
      for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
        const u = .3 + .68 * k / (cols - 1), j = (1 - order) * 26;
        nodes.push({ r, k, x: u * w + j * Math.sin(k * 2.1 + r * 1.3 + t * .8), y: heroBase(u) + (r - 1.5) * 52 + j * Math.cos(k * 1.7 + r + t * .7) });
      }
      const at = (r, k) => nodes[r * cols + k];
      const link = (a, b, style, lw) => {
        ctx.beginPath(); ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 - 30, b.x, b.y);
        ctx.strokeStyle = style; ctx.lineWidth = lw; ctx.stroke();
      };
      // the hairball: every COI (top row) to roles all over the map
      for (let k = 0; k < cols; k++) for (let m = 0; m < cols; m += 2) for (let r = 1; r < rows; r++)
        link(at(0, k), at(r, (m + k * 3 + r) % cols), `rgba(120,130,150,${.16 * (1 - order * .75)})`, 1);
      // as it settles, one COI's channels stand out
      if (order > .01) for (let r = 1; r < rows; r++) for (let m = 5; m < cols; m += 2)
        link(at(0, 8), at(r, m), `rgba(122,62,200,${.75 * order})`, 1.4);
      nodes.forEach(n => {
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r ? 3.4 : 4.6, 0, Math.PI * 2);
        ctx.fillStyle = n.r ? 'rgba(20,115,204,.75)' : (n.k === 8 ? '#7a3ec8' : 'rgba(19,128,121,.8)'); ctx.fill();
      });
      ctx.globalAlpha = 1;
      fadeLeft(ctx, w, h);
    },
    aurora(ctx, w, h, t, el) {
      const n = 30, amp = h * .1, hue0 = +(el.dataset.hue || 200);
      lines(ctx, w, n, (u, i) => h * .78 + amp * Math.sin(u * 3.4 + t * .35) + amp * .5 * Math.sin(u * 7 - t * .3) + (i - n / 2) * 4.2 * (.5 + u),
        i => `hsla(${hue0 + i * 2.2},85%,${62 + i * .6}%,${.22 + i * .006})`, 1.2);
      mask(ctx, w, h, [[0, 0], [.35, 0], [.85, 1], [1, 1]]);
    }
  };
  document.querySelectorAll('canvas[data-scene]').forEach(canvas => {
    const draw = scenes[canvas.dataset.scene], ctx = canvas.getContext('2d');
    let w = 0, h = 0, t = 0, last = 0, raf = 0, visible = false;
    const paint = () => { ctx.clearRect(0, 0, w, h); if (w && h) draw(ctx, w, h, t, canvas); };
    const resize = () => {
      const r = canvas.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
      w = r.width; h = r.height; canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); paint();
    };
    const frame = now => {
      raf = 0; if (!visible || reduce.matches) return;
      t += Math.min(.05, (now - last) / 1000); last = now; paint(); raf = requestAnimationFrame(frame);
    };
    new ResizeObserver(resize).observe(canvas);
    new IntersectionObserver(es => {
      visible = es[0].isIntersecting;
      if (visible && !raf && !reduce.matches) { last = performance.now(); raf = requestAnimationFrame(frame); }
    }).observe(canvas);
  });
})();

/* Theme switch: built here once for every page, floating bottom-right.
   Remembers the choice; the reveal spreads from the switch. */
(() => {
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const NS = 'http://www.w3.org/2000/svg';

  // the icon's geometry (512 grid): the rocker's front face per position,
  // and the fixed back edges its end faces connect to
  const FACE = {
    light: [[110, 148], [276, 148], [348, 412], [182, 412]],   // top end raised, as drawn
    dark:  [[182, 96],  [348, 96],  [276, 360], [110, 360]]    // bottom end raised
  };
  const BACK = { tl: [185, 96], tr: [350, 96], br: [350, 412], bl: [185, 412] };

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'theme-switch';
  btn.setAttribute('role', 'switch');
  btn.setAttribute('aria-label', 'Dark mode');
  btn.innerHTML = `<svg viewBox="0 0 512 512" aria-hidden="true">
      <rect class="sw-line" x="140" y="56" width="256" height="400" rx="40"/>
      <path class="sw-face sw-top"/><path class="sw-face sw-bottom"/>
      <path class="sw-face sw-front"/><path class="sw-line sw-side"/>
      <path class="sw-line sw-i"/><ellipse class="sw-line sw-o" rx="24" ry="24"/>
    </svg>`;
  document.body.appendChild(btn);
  const $ = c => btn.querySelector(c);
  const parts = { top: $('.sw-top'), bottom: $('.sw-bottom'), front: $('.sw-front'), side: $('.sw-side'), i: $('.sw-i'), o: $('.sw-o') };

  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const poly = pts => 'M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L') + 'Z';
  // a point printed on the face, by its place across (u) and down (v) the face
  const onFace = (f, u, v) => mix(mix(f[0], f[1], u), mix(f[3], f[2], u), v);

  let p = root.dataset.theme === 'dark' ? 1 : 0;      // 0 = light position, 1 = dark
  const render = () => {
    const f = FACE.light.map((pt, k) => mix(pt, FACE.dark[k], p));
    parts.top.setAttribute('d', poly([f[0], BACK.tl, BACK.tr, f[1]]));
    parts.bottom.setAttribute('d', poly([f[3], BACK.bl, BACK.br, f[2]]));
    parts.front.setAttribute('d', poly(f));
    parts.side.setAttribute('d', `M${BACK.tr[0]} ${BACK.tr[1]}L${BACK.br[0]} ${BACK.br[1]}`);
    const i0 = onFace(f, 0.49, 0.12), i1 = onFace(f, 0.483, 0.30), o = onFace(f, 0.45, 0.78);
    parts.i.setAttribute('d', `M${i0[0].toFixed(1)} ${i0[1].toFixed(1)}L${i1[0].toFixed(1)} ${i1[1].toFixed(1)}`);
    parts.o.setAttribute('cx', o[0].toFixed(1)); parts.o.setAttribute('cy', o[1].toFixed(1));
  };
  // ease-out with a small overshoot, so the rocker snaps over and settles
  const backOut = t => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  let anim = 0;
  const flipTo = target => {
    cancelAnimationFrame(anim);
    if (reduce.matches) { p = target; render(); return; }
    const from = p, t0 = performance.now(), D = 380;
    const step = now => {
      const k = Math.min(1, (now - t0) / D);
      p = from + (target - from) * backOut(k);
      render();
      if (k < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  };

  const sync = () => {
    const dark = root.dataset.theme === 'dark';
    btn.setAttribute('aria-checked', String(dark));
    btn.setAttribute('title', dark ? 'Switch to light mode' : 'Switch to dark mode');
  };
  const set = t => { root.dataset.theme = t; try { localStorage.setItem('theme', t); } catch (e) {} sync(); };

  btn.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    flipTo(next === 'dark' ? 1 : 0);
    if (document.startViewTransition && !reduce.matches) {
      const r = btn.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      root.style.setProperty('--vt-x', x + 'px'); root.style.setProperty('--vt-y', y + 'px');
      root.style.setProperty('--vt-r', Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 'px');
      root.classList.add('theme-switching');
      // let the rocker get going before the page is snapshotted
      setTimeout(() => {
        const vt = document.startViewTransition(() => set(next));
        vt.finished.finally(() => root.classList.remove('theme-switching'));
      }, 120);
    } else {
      root.classList.add('theme-fade'); set(next);
      setTimeout(() => root.classList.remove('theme-fade'), 500);
    }
  });
  // follow the system setting until the visitor picks one
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    let saved = null; try { saved = localStorage.getItem('theme'); } catch (_) {}
    if (!saved) { root.dataset.theme = e.matches ? 'dark' : 'light'; sync(); flipTo(e.matches ? 1 : 0); }
  });
  render(); sync();
})();
