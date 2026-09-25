/* Aurora: a slow, domain-warped liquid field rendered with WebGL.
   It sits behind every glass surface so the glass has colour and motion to
   bend. Rendered at a fraction of screen resolution (the field is soft, so it
   upscales cleanly), throttled to ~30fps, and paused when the tab is hidden. */
(() => {
  const canvas = document.getElementById('aurora');
  if (!canvas) return;

  const gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'low-power',
    preserveDrawingBuffer: false,
  });
  if (!gl) return;

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;

  const vert = `
    attribute vec2 p;
    void main() { gl_Position = vec4(p, 0.0, 1.0); }
  `;

  const frag = `
    precision mediump float;
    uniform vec2 uRes;
    uniform float uTime;
    uniform vec2 uMouse;
    uniform float uScroll;

    vec2 hash(vec2 p) {
      p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
      return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
    }
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(dot(hash(i), f),
                     dot(hash(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
                 mix(dot(hash(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
                     dot(hash(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x), u.y);
    }
    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
      for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p = m * p;
        a *= 0.5;
      }
      return v;
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / uRes;
      float s = min(uRes.x, uRes.y);
      vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / s;
      float t = uTime * 0.045;

      // the field drifts upward as the page scrolls
      p.y -= uScroll * 0.9;

      // soft push away from the cursor
      vec2 m = (uMouse - 0.5 * uRes) / s;
      m.y -= uScroll * 0.9;
      vec2 dm = p - m;
      p += dm * 0.22 * exp(-dot(dm, dm) * 5.0);

      vec2 q = vec2(fbm(p * 1.05 + vec2(0.0, t)),
                    fbm(p * 1.05 + vec2(5.2, 1.3) - t));
      vec2 r = vec2(fbm(p * 1.25 + 3.2 * q + vec2(1.7, 9.2) + 1.1 * t),
                    fbm(p * 1.25 + 3.2 * q + vec2(8.3, 2.8) - 0.8 * t));
      float f = fbm(p * 1.1 + 2.8 * r);

      vec3 ink   = vec3(0.018, 0.022, 0.050);
      vec3 mint  = vec3(0.26, 0.92, 0.80);
      vec3 azure = vec3(0.30, 0.50, 1.00);
      vec3 iris  = vec3(0.55, 0.42, 1.00);
      vec3 coral = vec3(1.00, 0.52, 0.42);

      // iridescent hue that shifts across the warp
      vec3 hue = mix(azure, mint, smoothstep(-0.25, 0.35, q.x));
      hue = mix(hue, iris, smoothstep(-0.1, 0.45, r.y));
      hue = mix(hue, coral, smoothstep(0.25, 0.6, r.x) * 0.75);

      float a = clamp(f * 1.7 + 0.52, 0.0, 1.0);
      float glow = pow(smoothstep(0.32, 1.0, a), 2.0);

      vec3 col = ink + hue * glow * 0.85;

      // thin silky ridges, like light on moving liquid
      float ridge = 1.0 - abs(sin(f * 10.0 + t * 3.0));
      col += mix(hue, vec3(1.0), 0.35) * pow(ridge, 14.0) * 0.22 * glow;

      // deep pools for contrast
      col *= mix(0.55, 1.0, smoothstep(-0.3, 0.2, q.y + r.x * 0.5));

      // vignette
      vec2 v = uv - 0.5;
      col *= 1.0 - dot(v, v) * 0.9;

      // dither against banding
      col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn(gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  const vs = compile(gl.VERTEX_SHADER, vert);
  const fs = compile(gl.FRAGMENT_SHADER, frag);
  if (!vs || !fs) return;

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, 'uRes');
  const uTime = gl.getUniformLocation(prog, 'uTime');
  const uMouse = gl.getUniformLocation(prog, 'uMouse');
  const uScroll = gl.getUniformLocation(prog, 'uScroll');

  // render at about half the CSS resolution, capped in total pixels: the
  // field is soft, so a smaller buffer upscales without visible loss
  let w = 0;
  let h = 0;

  function resize() {
    const cw = canvas.clientWidth || innerWidth;
    const ch = canvas.clientHeight || innerHeight;
    const scale = Math.min(0.5, Math.sqrt((coarse ? 160000 : 360000) / (cw * ch)));
    w = Math.max(1, Math.round(cw * scale));
    h = Math.max(1, Math.round(ch * scale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }

  const mouse = { x: 0.62, y: 0.4, tx: 0.62, ty: 0.4 };
  let scrollNow = 0;
  let scrollTarget = 0;

  addEventListener('pointermove', (e) => {
    mouse.tx = e.clientX / innerWidth;
    mouse.ty = 1 - e.clientY / innerHeight;
  }, { passive: true });

  function readScroll() {
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    scrollTarget = scrollY / max;
  }
  addEventListener('scroll', readScroll, { passive: true });
  addEventListener('resize', () => { resize(); readScroll(); if (reduceMotion) draw(0); });

  function draw(time) {
    mouse.x += (mouse.tx - mouse.x) * 0.04;
    mouse.y += (mouse.ty - mouse.y) * 0.04;
    scrollNow += (scrollTarget - scrollNow) * 0.06;
    gl.uniform2f(uRes, w, h);
    gl.uniform1f(uTime, time);
    gl.uniform2f(uMouse, mouse.x * w, mouse.y * h);
    gl.uniform1f(uScroll, scrollNow);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  resize();
  readScroll();

  const start = performance.now();
  const seed = 40 + Math.random() * 60; // start mid-flow so the first frame is already interesting
  const frameGap = 1000 / (coarse ? 24 : 30);
  let last = 0;
  let raf = 0;

  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (now - last < frameGap) return;
    last = now;
    draw(seed + (now - start) / 1000);
  }

  if (reduceMotion) {
    draw(seed);
    addEventListener('scroll', () => requestAnimationFrame(() => { scrollNow = scrollTarget; draw(seed); }), { passive: true });
  } else {
    raf = requestAnimationFrame(loop);
    document.addEventListener('visibilitychange', () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(loop);
    });
  }

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    cancelAnimationFrame(raf);
    document.documentElement.classList.remove('gl-ready');
  });

  requestAnimationFrame(() => document.documentElement.classList.add('gl-ready'));
})();
