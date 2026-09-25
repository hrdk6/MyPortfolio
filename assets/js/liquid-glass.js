/* Liquid glass refraction.
   Chromium can use an SVG filter as a backdrop-filter, which lets a glass
   element bend whatever sits behind it. For every [data-liquid] element this
   draws a displacement map that matches its rounded shape (strong at the rim,
   neutral in the middle, like a thick glass bezel) and feeds it to
   feDisplacementMap. Other browsers keep the frosted CSS glass in style.css.

   Options, as data attributes on the element:
     data-liquid-bezel   rim width in px, or "full" for a lens (default 24)
     data-liquid-scale   displacement strength in px (default 40)
     data-liquid-blur    frost, as a Gaussian std deviation (default 0)
     data-liquid-sat     saturation boost (default 1.6)
     data-liquid-curve   rim profile exponent; higher = sharper edge (default 2)
*/
(() => {
  const brands = navigator.userAgentData && navigator.userAgentData.brands;
  const chromium = !!brands && brands.some((b) => /Chromium/i.test(b.brand));
  const lessGlass = matchMedia('(prefers-reduced-transparency: reduce)').matches;
  if (!chromium || lessGlass || !CSS.supports('backdrop-filter', 'url(#x)')) {
    window.LiquidGlass = { refresh() {} };
    return;
  }

  const NS = 'http://www.w3.org/2000/svg';
  const host = document.createElementNS(NS, 'svg');
  host.setAttribute('aria-hidden', 'true');
  host.setAttribute('focusable', 'false');
  host.setAttribute('width', '0');
  host.setAttribute('height', '0');
  host.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
  document.body.appendChild(host);
  document.documentElement.classList.add('liquid');

  const maps = new Map();
  let uid = 0;

  function radiusOf(el, w, h) {
    const raw = getComputedStyle(el).borderTopLeftRadius;
    let r = parseFloat(raw) || 0;
    if (raw.trim().endsWith('%')) r = (Math.min(w, h) * r) / 100;
    return Math.min(r, w / 2, h / 2);
  }

  // Displacement map for a rounded rectangle. Red/green encode the x/y offset
  // around a neutral 128; pixels near the rim sample from further inside the
  // shape, which reads as light bending through a curved glass edge.
  function buildMap(w, h, r, bezel, curve) {
    const key = `${w}x${h}:${r}:${bezel}:${curve}`;
    if (maps.has(key)) return maps.get(key);

    const k = Math.min(1, Math.sqrt(90000 / (w * h)));
    const cw = Math.max(2, Math.round(w * k));
    const ch = Math.max(2, Math.round(h * k));
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(cw, ch);
    const d = img.data;
    const hw = w / 2;
    const hh = h / 2;

    for (let j = 0; j < ch; j++) {
      for (let i = 0; i < cw; i++) {
        const px = (i + 0.5) / k - hw;
        const py = (j + 0.5) / k - hh;
        const qx = Math.abs(px) - (hw - r);
        const qy = Math.abs(py) - (hh - r);
        const dist = r - Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - Math.min(Math.max(qx, qy), 0);

        let nx = 0;
        let ny = 0;
        if (qx > 0 && qy > 0) {
          const l = Math.hypot(qx, qy) || 1;
          nx = (qx / l) * Math.sign(px);
          ny = (qy / l) * Math.sign(py);
        } else if (qx > qy) {
          nx = Math.sign(px);
        } else {
          ny = Math.sign(py);
        }

        let m = 0;
        if (dist >= 0 && dist < bezel) m = Math.pow(1 - dist / bezel, curve);

        const o = (j * cw + i) * 4;
        d[o] = 128 - nx * m * 127;
        d[o + 1] = 128 - ny * m * 127;
        d[o + 2] = 128;
        d[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const url = canvas.toDataURL();
    maps.set(key, url);
    return url;
  }

  function el(name, attrs) {
    const node = document.createElementNS(NS, name);
    for (const a in attrs) node.setAttribute(a, attrs[a]);
    return node;
  }

  function apply(target) {
    const w = Math.round(target.offsetWidth);
    const h = Math.round(target.offsetHeight);
    if (!w || !h) return;

    const ds = target.dataset;
    const r = radiusOf(target, w, h);
    const bezel = ds.liquidBezel === 'full'
      ? Math.min(w, h) / 2
      : Math.min(parseFloat(ds.liquidBezel) || 24, Math.min(w, h) / 2);
    const scale = parseFloat(ds.liquidScale) || 40;
    const blur = parseFloat(ds.liquidBlur) || 0;
    const sat = parseFloat(ds.liquidSat) || 1.6;
    const curve = parseFloat(ds.liquidCurve) || 2;

    const sig = `${w}|${h}|${r}|${bezel}|${scale}|${blur}|${sat}|${curve}`;
    if (target._lgSig === sig) return;
    target._lgSig = sig;

    const id = `lg-${++uid}`;
    const filter = el('filter', {
      id,
      x: 0,
      y: 0,
      width: w,
      height: h,
      filterUnits: 'userSpaceOnUse',
      primitiveUnits: 'userSpaceOnUse',
      'color-interpolation-filters': 'sRGB',
    });
    let src = 'SourceGraphic';
    if (blur > 0) {
      filter.appendChild(el('feGaussianBlur', { in: src, stdDeviation: blur, edgeMode: 'duplicate', result: 'frost' }));
      src = 'frost';
    }
    const image = el('feImage', { x: 0, y: 0, width: w, height: h, preserveAspectRatio: 'none', result: 'map' });
    image.setAttribute('href', buildMap(w, h, r, bezel, curve));
    filter.appendChild(image);
    filter.appendChild(el('feDisplacementMap', { in: src, in2: 'map', scale, xChannelSelector: 'R', yChannelSelector: 'G', result: 'bent' }));
    filter.appendChild(el('feColorMatrix', { in: 'bent', type: 'saturate', values: sat }));
    host.appendChild(filter);

    const old = target._lgFilter;
    target._lgFilter = filter;
    target.style.setProperty('-webkit-backdrop-filter', `url(#${id})`);
    target.style.setProperty('backdrop-filter', `url(#${id})`);
    target.classList.add('is-liquid');
    if (old) requestAnimationFrame(() => old.remove());
  }

  const pending = new Set();
  let queued = false;
  function schedule(target) {
    pending.add(target);
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      pending.forEach(apply);
      pending.clear();
    });
  }

  const ro = new ResizeObserver((entries) => entries.forEach((e) => schedule(e.target)));

  function init() {
    document.querySelectorAll('[data-liquid]').forEach((node) => {
      apply(node);
      ro.observe(node);
    });
  }

  window.LiquidGlass = { refresh: schedule };

  // fonts change element widths; wait for them before the first measure
  if (document.fonts && document.fonts.status !== 'loaded') {
    init();
    document.fonts.ready.then(() => document.querySelectorAll('[data-liquid]').forEach(schedule));
  } else {
    init();
  }
})();
