/* Page interactions: navigation, scroll reveals, counters, the eval
   terminal, the draggable lens, pointer lighting and the project diagrams. */
(() => {
  const root = document.documentElement;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (reduceMotion) root.classList.add('reduced');

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ── Small details ─────────────────────────────────────────── */
  $$('[data-year]').forEach((n) => { n.textContent = new Date().getFullYear(); });

  const clockFmt = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false,
  });
  function tick() {
    const t = `${clockFmt.format(new Date())} IST`;
    $$('[data-clock]').forEach((n) => { n.textContent = t; });
  }
  tick();
  setInterval(tick, 20000);

  /* ── Navigation ────────────────────────────────────────────── */
  const nav = $('.nav');
  const links = $$('.nav-links a');
  const drop = $('.nav-drop');
  const progress = $('.nav-progress');
  const menuBtn = $('.nav-menu');
  const menu = $('#mobile-menu');
  let activeId = null;

  function moveDrop(link) {
    if (!drop) return;
    if (!link) { drop.classList.remove('is-on'); return; }
    const box = link.parentElement.getBoundingClientRect();
    const r = link.getBoundingClientRect();
    const wasOn = drop.classList.contains('is-on');
    drop.style.setProperty('--x', `${r.left - box.left}px`);
    drop.style.setProperty('--w', `${r.width}px`);
    if (wasOn && !reduceMotion) {
      drop.classList.remove('is-moving');
      void drop.offsetWidth;
      drop.classList.add('is-moving');
    }
    drop.classList.add('is-on');
  }

  function setActive(id) {
    if (id === activeId) return;
    activeId = id;
    let current = null;
    links.forEach((a) => {
      const on = a.dataset.nav === id;
      a.classList.toggle('is-active', on);
      if (on) { a.setAttribute('aria-current', 'true'); current = a; } else a.removeAttribute('aria-current');
    });
    moveDrop(current);
  }

  const sections = links.map((a) => document.getElementById(a.dataset.nav)).filter(Boolean);
  function updateActive() {
    const line = innerHeight * 0.4;
    let id = null;
    for (const s of sections) {
      const r = s.getBoundingClientRect();
      if (r.top <= line && r.bottom > line) id = s.id;
    }
    // the contact section is short; treat the bottom of the page as contact
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) id = 'contact';
    setActive(id);
  }

  let scrollQueued = false;
  function onScroll() {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(() => {
      scrollQueued = false;
      const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      progress && progress.style.setProperty('--p', (scrollY / max).toFixed(4));
      updateActive();
      updateTimeline();
    });
  }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', () => {
    const current = links.find((a) => a.dataset.nav === activeId);
    if (current) moveDrop(current);
    onScroll();
  });
  if (document.fonts) document.fonts.ready.then(() => { const c = links.find((a) => a.dataset.nav === activeId); if (c) moveDrop(c); });

  function closeMenu() {
    if (!menu || menu.hidden) return;
    menu.hidden = true;
    menuBtn.setAttribute('aria-expanded', 'false');
  }
  menuBtn && menuBtn.addEventListener('click', () => {
    const open = menu.hidden;
    menu.hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
  });
  menu && menu.addEventListener('click', (e) => { if (e.target.closest('a')) closeMenu(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
  document.addEventListener('click', (e) => { if (!e.target.closest('.nav-wrap')) closeMenu(); });

  /* ── Split headings into words ─────────────────────────────── */
  $$('[data-split]').forEach((h) => {
    const words = [];
    [...h.childNodes].forEach((node) => {
      if (node.nodeType === 3) {
        node.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          words.push(/^\s+$/.test(part) ? document.createTextNode(' ') : part);
        });
      } else {
        words.push(node.cloneNode(true));
      }
    });
    h.textContent = '';
    let i = 0;
    words.forEach((w) => {
      if (w.nodeType === 3) { h.appendChild(w); return; }
      const outer = document.createElement('span');
      outer.className = 'w';
      const inner = document.createElement('span');
      inner.style.setProperty('--i', i++);
      if (typeof w === 'string') inner.textContent = w; else inner.appendChild(w);
      outer.appendChild(inner);
      h.appendChild(outer);
    });
  });

  /* ── Scroll reveals ────────────────────────────────────────── */
  // Only content below the first screen starts hidden, so the page is
  // complete at rest and nothing above the fold waits on an observer.
  const revealables = $$('[data-reveal], [data-split]');
  const counters = $$('[data-count]');

  function formatCount(el, v) {
    const dec = parseInt(el.dataset.decimals || '0', 10);
    return dec ? v.toFixed(dec) : Math.round(v).toLocaleString('en-US');
  }
  function runCount(el) {
    const end = parseFloat(el.dataset.count);
    const dur = 1600;
    const t0 = performance.now();
    function step(now) {
      const p = clamp((now - t0) / dur, 0, 1);
      const e = 1 - Math.pow(2, -10 * p);
      el.textContent = formatCount(el, end * (p === 1 ? 1 : e));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  if (!reduceMotion && 'IntersectionObserver' in window) {
    const fold = innerHeight * 0.92;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const t = entry.target;
        t.classList.remove('is-pending');
        $$('[data-count]', t).forEach(runCount);
        io.unobserve(t);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

    revealables.forEach((n) => {
      if (n.getBoundingClientRect().top < fold) return;
      n.classList.add('is-pending');
      $$('[data-count]', n).forEach((c) => { c.textContent = formatCount(c, 0); });
      io.observe(n);
    });
  }

  /* ── Timeline progress ─────────────────────────────────────── */
  const timeline = $('[data-timeline]');
  function updateTimeline() {
    if (!timeline || reduceMotion) return;
    const r = timeline.getBoundingClientRect();
    const p = clamp((innerHeight * 0.7 - r.top) / r.height, 0, 1);
    timeline.style.setProperty('--tp', p.toFixed(3));
  }
  onScroll();

  /* ── Eval terminal ─────────────────────────────────────────── */
  const termBody = $('.term-body');
  if (termBody && !reduceMotion) {
    const lines = $$('.tl', termBody);
    const typed = lines.filter((l) => l.hasAttribute('data-type')).map((l) => {
      const tx = $('.tx', l);
      return { l, tx, text: tx.textContent };
    });
    typed.forEach((t) => { t.tx.textContent = ''; });
    termBody.classList.add('is-typing');

    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      await wait(1300);
      for (const line of lines) {
        line.classList.add('is-shown');
        const t = typed.find((x) => x.l === line);
        if (t) {
          for (const ch of t.text) {
            t.tx.textContent += ch;
            await wait(55 + Math.random() * 50);
          }
          await wait(260);
        } else {
          await wait(line.classList.contains('head') ? 150 : 85);
        }
      }
    })();
  }

  /* ── Pointer lighting: spotlight + rim highlight ───────────── */
  if (finePointer) {
    document.addEventListener('pointermove', (e) => {
      const el = e.target.closest && e.target.closest('.glass, .btn');
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    }, { passive: true });

    // subtle 3D tilt on the terminal and diagram screens
    $$('[data-tilt]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        el.style.setProperty('--ry', `${(x * 7).toFixed(2)}deg`);
        el.style.setProperty('--rx', `${(-y * 6).toFixed(2)}deg`);
      });
      el.addEventListener('pointerleave', () => {
        el.style.setProperty('--ry', '0deg');
        el.style.setProperty('--rx', '0deg');
      });
    });

    // magnetic buttons
    if (!reduceMotion) {
      $$('.btn, .social').forEach((b) => {
        b.addEventListener('pointermove', (e) => {
          const r = b.getBoundingClientRect();
          const x = e.clientX - (r.left + r.width / 2);
          const y = e.clientY - (r.top + r.height / 2);
          b.style.setProperty('--tx', `${(x * 0.18).toFixed(1)}px`);
          b.style.setProperty('--ty', `${(y * 0.28).toFixed(1)}px`);
        });
        b.addEventListener('pointerleave', () => {
          b.style.setProperty('--tx', '0px');
          b.style.setProperty('--ty', '0px');
        });
      });
    }
  }

  /* ── The lens: drag it, it wobbles and settles ─────────────── */
  const orb = $('.orb');
  const orbZone = $('.hero-orb-zone');
  if (orb && orbZone) {
    const s = { x: 0, y: 0, vx: 0, vy: 0, dragging: false, px: 0, py: 0, t0: performance.now() };
    let lastX = 0;
    let lastY = 0;

    orb.addEventListener('pointerdown', (e) => {
      s.dragging = true;
      orb.setPointerCapture(e.pointerId);
      lastX = e.clientX;
      lastY = e.clientY;
      orbZone.classList.add('orb-zone-touched');
    });
    orb.addEventListener('pointermove', (e) => {
      if (!s.dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      s.x += dx;
      s.y += dy;
      s.vx = dx;
      s.vy = dy;
    });
    const release = () => { s.dragging = false; };
    orb.addEventListener('pointerup', release);
    orb.addEventListener('pointercancel', release);
    orb.addEventListener('dblclick', () => { s.vx = -s.x * 0.08; s.vy = -s.y * 0.08; s.home = true; });

    let sx = 1;
    let sy = 1;
    function frame(now) {
      requestAnimationFrame(frame);
      if (!s.dragging) {
        if (s.home) {
          s.vx += -s.x * 0.02;
          s.vy += -s.y * 0.02;
          if (Math.hypot(s.x, s.y) < 0.5 && Math.hypot(s.vx, s.vy) < 0.3) s.home = false;
        }
        s.vx *= 0.92;
        s.vy *= 0.92;
        s.x += s.vx;
        s.y += s.vy;
        // keep it on screen
        const r = orbZone.getBoundingClientRect();
        const minX = -r.left + 8;
        const maxX = innerWidth - r.right - 8;
        if (s.x < minX) { s.x = minX; s.vx *= -0.5; }
        if (s.x > maxX) { s.x = maxX; s.vx *= -0.5; }
        // and inside the hero
        const minY = -orbZone.offsetTop + 40;
        const maxY = orbZone.offsetParent.offsetHeight - orbZone.offsetTop - orbZone.offsetHeight;
        if (s.y < minY) { s.y = minY; s.vy *= -0.5; }
        if (s.y > maxY) { s.y = maxY; s.vy *= -0.5; }
      }
      const speed = Math.hypot(s.vx, s.vy);
      const stretch = clamp(speed / 40, 0, 0.22);
      const angle = Math.atan2(s.vy, s.vx);
      sx += ((1 + stretch) - sx) * 0.2;
      sy += ((1 - stretch * 0.7) - sy) * 0.2;
      const float = reduceMotion ? 0 : Math.sin((now - s.t0) / 1400) * 8;
      orb.style.setProperty('--ox', `${s.x.toFixed(1)}px`);
      orb.style.setProperty('--oy', `${(s.y + float).toFixed(1)}px`);
      orb.style.setProperty('--sx', sx.toFixed(3));
      orb.style.setProperty('--sy', sy.toFixed(3));
      orb.style.setProperty('--rot', `${speed > 0.5 ? angle : 0}rad`);
    }
    requestAnimationFrame(frame);
  }

  /* ── PatchPilot: draw the repair loop from test back to patch ─ */
  const gtop = $('[data-gtop]');
  function drawLoop() {
    if (!gtop) return;
    const test = $('[data-n="test"]', gtop);
    const patch = $('[data-n="patch"]', gtop);
    const repair = $('[data-n="repair"]', gtop);
    const g = gtop.getBoundingClientRect();
    const t = test.getBoundingClientRect();
    const p = patch.getBoundingClientRect();
    const rw = repair.offsetWidth;
    const x1 = t.left + t.width / 2 - g.left;
    const y1 = t.bottom - g.top + 2;
    const x2 = p.left + p.width / 2 - g.left;
    const y2 = p.bottom - g.top + 4;
    const yr = Math.max(y1, y2) + 36;
    const xr = (x1 + x2) / 2;
    gtop.style.setProperty('--rx-pos', `${xr}px`);
    gtop.style.setProperty('--ry-pos', `${yr}px`);
    $('.gl-a', gtop).setAttribute('d', `M${x1} ${y1} C${x1} ${yr} ${x1} ${yr} ${xr + rw / 2} ${yr}`);
    $('.gl-b', gtop).setAttribute('d', `M${xr - rw / 2} ${yr} C${x2} ${yr} ${x2} ${yr} ${x2} ${y2 + 3}`);
  }
  drawLoop();
  addEventListener('resize', drawLoop);
  if (document.fonts) document.fonts.ready.then(drawLoop);

  /* ── PatchPilot: step through the agent loop ───────────────── */
  const graph = $('[data-graph]');
  if (graph && !reduceMotion) {
    const node = (n) => $(`[data-n="${n}"]`, graph);
    const logs = $$('[data-log]', graph);
    const steps = [
      { on: 'index' }, { on: 'retrieve' }, { on: 'plan' }, { on: 'patch' },
      { on: 'test', fail: true, log: 0 },
      { on: 'repair', log: 1 },
      { on: 'patch' },
      { on: 'test', log: 2, pass: true },
      { rest: true },
    ];
    let i = 0;
    let timer = 0;
    function run() {
      const st = steps[i];
      $$('.gnode', graph).forEach((n) => n.classList.remove('is-on', 'is-fail'));
      if (i === 0) {
        logs.forEach((l) => l.classList.remove('is-shown'));
        $$('.gnode', graph).forEach((n) => n.classList.remove('is-done'));
      }
      if (st.on) {
        const n = node(st.on);
        n.classList.add(st.fail ? 'is-fail' : 'is-on');
        n.classList.add('is-done');
      }
      if (st.log !== undefined) logs[st.log].classList.add('is-shown');
      i = (i + 1) % steps.length;
      timer = setTimeout(run, st.rest ? 2600 : st.fail || st.pass ? 1400 : 800);
    }
    new IntersectionObserver(([e]) => {
      clearTimeout(timer);
      if (e.isIntersecting) { graph.classList.add('is-live'); run(); }
    }, { threshold: 0.3 }).observe(graph);
  }

  /* ── GroundTruth: verify sentences one by one ──────────────── */
  const verify = $('[data-verify]');
  if (verify && !reduceMotion) {
    const s = $$('.vs', verify);
    const seq = [
      [0, 'check'], [0, 'ok'],
      [1, 'check'], [1, 'ok'],
      [2, 'check'], [2, 'bad'], [2, 'regen'],
    ];
    let i = 0;
    let timer = 0;
    function run() {
      if (i === 0) s.forEach((n) => n.removeAttribute('data-state'));
      if (i === 0) s.forEach((n) => n.setAttribute('data-state', 'idle'));
      if (i < seq.length) {
        const [k, state] = seq[i];
        s[k].setAttribute('data-state', state);
        i++;
        timer = setTimeout(run, state === 'check' ? 700 : 1000);
      } else {
        i = 0;
        timer = setTimeout(run, 3200);
      }
    }
    new IntersectionObserver(([e]) => {
      clearTimeout(timer);
      if (e.isIntersecting) run();
    }, { threshold: 0.3 }).observe(verify);
  }

  /* ── Copy email ────────────────────────────────────────────── */
  const toast = $('.toast');
  let toastTimer = 0;
  function say(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-on'), 2400);
  }
  $$('[data-copy]').forEach((btn) => {
    const label = $('.copy-label', btn);
    btn.addEventListener('click', () => {
      const text = btn.dataset.copy;
      const done = () => {
        btn.classList.add('is-done');
        if (label) label.textContent = 'Copied';
        say('Email copied to clipboard');
        setTimeout(() => { btn.classList.remove('is-done'); if (label) label.textContent = 'Copy email'; }, 2400);
      };
      const fallback = () => {
        const t = $('#email-text');
        const range = document.createRange();
        range.selectNodeContents(t);
        const sel = getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        say('Email selected. Press Ctrl+C or ⌘C to copy');
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, fallback);
      } else {
        fallback();
      }
    });
  });

  /* ── A note for whoever opens devtools ─────────────────────── */
  console.log('%cHi, I\'m Hardik.', 'font: 700 20px system-ui; color: #5cf2d6');
  console.log('This site is hand-written HTML, CSS and WebGL. Say hello: hardikgaonkar2025@gmail.com');
})();
