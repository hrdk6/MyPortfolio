/* Page interactions: navigation, the eval terminal, the draggable lens,
   pointer lighting, the project diagrams and the AegisOps incident replay. */
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

  /* ── AegisOps: replay the recorded incident ────────────────── */
  // The flagship scenario as recorded live, replayed fast: the playhead sweeps
  // the 210s timeline, each stage lights up as it starts and the readout says
  // what happened. It plays once on arrival. Hover or focus a stage to read
  // it (arrow keys move between stages), and Replay runs it again.
  const incident = $('[data-incident]');
  if (incident) {
    const SPAN = 210;
    const HOLD = 1000; // ms on a stage that happens at one instant
    const PER_S = 24; // ms of replay per second of incident time
    const list = $('[data-lanes]', incident);
    const grid = $('.inc-grid', incident);
    const roTime = $('[data-ro-time]', incident);
    const roStage = $('[data-ro-stage]', incident);
    const roNote = $('[data-ro-note]', incident);
    const replay = $('[data-replay]', incident);
    const colors = { fault: 'var(--viz-fault)', engine: 'var(--viz-1)', ctrl: 'var(--viz-2)' };

    const lanes = $$('.lane', list).map((el) => ({
      el,
      a: parseFloat(el.style.getPropertyValue('--a')),
      b: parseFloat(el.style.getPropertyValue('--b')),
      name: $('.lane-k', el).textContent,
      note: $('.lane-note', el),
      color: colors[el.dataset.who],
    }));
    const rest = {
      time: roTime.textContent,
      stage: roStage.textContent,
      note: [...roNote.childNodes].map((n) => n.cloneNode(true)),
    };

    function read(ln) {
      roTime.textContent = ln.b > ln.a ? `${ln.a}–${ln.b}s` : `${ln.a}s`;
      roStage.textContent = ln.name;
      roStage.classList.remove('is-done');
      roStage.style.setProperty('--c', ln.color);
      // the note without its time stamp, which the readout shows large
      const nodes = [...ln.note.childNodes].filter((n) => !(n.classList && n.classList.contains('lane-t')));
      roNote.replaceChildren(...nodes.map((n) => n.cloneNode(true)));
    }
    function readRest() {
      roTime.textContent = rest.time;
      roStage.textContent = rest.stage;
      roStage.classList.add('is-done');
      roNote.replaceChildren(...rest.note.map((n) => n.cloneNode(true)));
    }

    // t is the incident clock in seconds; stages after `cur` are still waiting
    function paint(t, cur) {
      grid.style.setProperty('--t', (t / SPAN).toFixed(4));
      lanes.forEach((ln, i) => {
        let p = 0;
        if (i < cur) p = 1;
        else if (i === cur) p = ln.b > ln.a ? clamp((t - ln.a) / (ln.b - ln.a), 0, 1) : 1;
        ln.el.style.setProperty('--p', p.toFixed(3));
        ln.el.classList.toggle('is-wait', i > cur);
        ln.el.classList.toggle('is-now', i === cur);
      });
    }
    function settle() {
      lanes.forEach((ln) => {
        ln.el.style.removeProperty('--p');
        ln.el.classList.remove('is-wait', 'is-now');
      });
      incident.classList.remove('is-playing');
    }

    // The schedule, in replay milliseconds: travel to each stage, then hold
    // on it (an instant) or sweep through it (a span).
    const plan = [];
    let clock = 0;
    let at = 0;
    lanes.forEach((ln, i) => {
      if (ln.a > at) {
        const d = Math.max(260, (ln.a - at) * PER_S);
        plan.push({ from: clock, to: clock + d, t0: at, t1: ln.a, cur: i - 1, ease: true });
        clock += d;
        at = ln.a;
      }
      if (ln.b > ln.a) {
        const d = Math.max(700, (ln.b - ln.a) * PER_S);
        plan.push({ from: clock, to: clock + d, t0: ln.a, t1: ln.b, cur: i });
        plan.push({ from: clock + d, to: clock + d + 450, t0: ln.b, t1: ln.b, cur: i });
        clock += d + 450;
        at = ln.b;
      } else {
        plan.push({ from: clock, to: clock + HOLD, t0: at, t1: at, cur: i });
        clock += HOLD;
      }
    });
    const total = clock;

    let raf = 0;
    let elapsed = 0;
    let last = 0;
    let shown = -1;
    function frame(now) {
      elapsed += Math.min(64, now - last);
      last = now;
      if (elapsed >= total) { stop(); readRest(); return; }
      const s = plan.find((x) => elapsed < x.to);
      const k = (elapsed - s.from) / (s.to - s.from);
      const e = s.ease ? (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2) : k;
      paint(s.t0 + (s.t1 - s.t0) * e, s.cur);
      if (s.cur !== shown && s.cur >= 0) { shown = s.cur; read(lanes[s.cur]); }
      raf = requestAnimationFrame(frame);
    }
    function stop() {
      cancelAnimationFrame(raf);
      raf = 0;
      settle();
    }
    function arm() {
      incident.classList.add('is-playing');
      paint(0, -1);
    }
    function play() {
      stop();
      unhot();
      arm();
      elapsed = 0;
      shown = -1;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }

    let hot = null;
    function unhot() {
      if (hot) hot.el.classList.remove('is-hot');
      hot = null;
      incident.classList.remove('is-scrub');
    }
    function setHot(ln) {
      if (raf) stop();
      if (ln && ln === hot) return;
      unhot();
      if (!ln) { readRest(); return; }
      hot = ln;
      ln.el.classList.add('is-hot');
      incident.classList.add('is-scrub');
      grid.style.setProperty('--t', (ln.a / SPAN).toFixed(4));
      read(ln);
    }
    const laneOf = (el) => lanes.find((l) => l.el === el);

    list.addEventListener('pointermove', (e) => {
      // browsers send a motionless pointermove after scrolling; only a real move counts
      if (!e.movementX && !e.movementY) return;
      const ln = laneOf(e.target.closest('.lane'));
      if (ln) setHot(ln);
    });
    list.addEventListener('pointerleave', () => {
      if (hot) setHot(laneOf(document.activeElement) || null);
    });

    // one tab stop for the whole timeline; arrow keys move between stages
    lanes.forEach((ln, i) => ln.el.setAttribute('tabindex', i ? '-1' : '0'));
    list.addEventListener('focusin', (e) => {
      const ln = laneOf(e.target);
      if (!ln) return;
      lanes.forEach((l) => l.el.setAttribute('tabindex', l === ln ? '0' : '-1'));
      setHot(ln);
    });
    list.addEventListener('focusout', (e) => {
      if (!list.contains(e.relatedTarget)) setHot(null);
    });
    list.addEventListener('keydown', (e) => {
      const i = lanes.findIndex((l) => l.el === document.activeElement);
      const to = { ArrowDown: i + 1, ArrowRight: i + 1, ArrowUp: i - 1, ArrowLeft: i - 1, Home: 0, End: lanes.length - 1 }[e.key];
      if (i < 0 || to === undefined) return;
      e.preventDefault();
      lanes[clamp(to, 0, lanes.length - 1)].el.focus();
    });

    if (!reduceMotion) {
      replay.hidden = false;
      replay.addEventListener('click', play);
      if ('IntersectionObserver' in window) {
        // empty the timeline just before it scrolls in, then play once it's in view
        const io = new IntersectionObserver(([en]) => {
          if (hot) { io.disconnect(); return; }
          if (en.intersectionRatio >= 0.45) { io.disconnect(); play(); }
          else if (en.isIntersecting && en.boundingClientRect.top > 0 && !raf) arm();
        }, { threshold: [0, 0.45] });
        io.observe(incident);
      }
    }
  }

  /* ── Proof: read out a run of the AegisOps benchmark ──────── */
  const runs = $('[data-runs]');
  const runsNote = $('[data-runs-note]');
  if (runs && runsNote) {
    const rest = runsNote.textContent;
    const show = (li) => {
      runsNote.textContent = li ? li.dataset.read : rest;
      runsNote.classList.toggle('is-read', !!li);
    };
    $$('.run', runs).forEach((li) => {
      li.addEventListener('pointerenter', () => show(li));
      li.addEventListener('focus', () => show(li));
      li.addEventListener('pointerleave', () => show(runs.contains(document.activeElement) ? document.activeElement : null));
      li.addEventListener('blur', () => show(null));
    });
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
