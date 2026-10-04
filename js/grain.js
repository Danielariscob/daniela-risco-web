/* ---------------------------------------------------------
   Grain ripple — a live, generative version of the print
   reference. Every pixel picks one colour from a small palette
   at random, weighted by a warped ripple field, so the image
   is made of coloured grain rather than smooth gradients.
   --------------------------------------------------------- */
(function () {
  const canvas = document.getElementById('grain');
  if (!canvas) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
  if (!gl) { document.documentElement.classList.add('no-webgl'); return; }

  const vert = `
    attribute vec2 aPos;
    void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
  `;

  const frag = `
    precision highp float;
    uniform vec2  uRes;
    uniform float uTime;
    uniform vec2  uShift;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      float d = dot(p, p + 45.32);
      p += d;
      return fract(p.x * p.y);
    }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      float a = hash(i), b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
      vec2 u = f * f * (3.0 - 2.0 * f);
      return a + (b - a) * u.x + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }
    float fbm(vec2 p) {
      float v = 0.0, a = 0.5;
      for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.02 + vec2(3.1, 1.7); a *= 0.5; }
      return v;
    }
    float bell(float x, float m, float s) { float k = (x - m) / s; return exp(-k * k); }

    void main() {
      vec2 frag = gl_FragCoord.xy;
      vec2 p = frag / uRes.y;
      float aspect = uRes.x / uRes.y;
      float t = uTime;

      // warp the plane so the rings wobble like water
      float w  = fbm(p * 1.4 + vec2(t * 0.02, -t * 0.015));
      float w2 = fbm(p * 3.5 + vec2(-1.3, 2.1 + t * 0.02));
      vec2 q = p + (vec2(w, w2) - 0.5) * 0.16;

      vec2 c  = vec2(0.18 * aspect, 0.22) + uShift;
      vec2 dv = q - c;
      float d   = length(dv);
      float ang = atan(dv.y, dv.x);

      float r   = smoothstep(0.15, 0.85, 0.5 + 0.5 * sin(d * 58.0 - t * 0.5 + (w - 0.5) * 2.2));
      float top = smoothstep(0.2, 1.0, p.y);

      float lobe = smoothstep(0.15, 0.8, bell(d, 0.55, 0.24) * bell(ang, 1.45, 0.5) * (0.6 + 0.8 * w));
      float arcs = r * bell(d, 0.63, 0.11) * bell(ang, 1.15, 0.45);
      float hi   = smoothstep(0.9, 1.0, r) * bell(d, 0.62, 0.05) * bell(ang, 1.0, 0.22);

      // weights for each colour of the palette
      float wBlue  = (1.0 - r) * (0.35 + 1.6 * top);
      float wLilac = 0.18 + 0.25 * (1.0 - r) * (1.0 - top);
      float wPink  = 0.22 + 0.3 * r * (1.0 - top) + 3.5 * lobe;
      float wOrng  = 0.05 + 2.6 * arcs + 0.1 * r * (1.0 - top);
      float wPeach = r * (0.25 + 1.2 * (1.0 - top)) * (1.0 - lobe);
      float wWhite = 0.07 + 6.0 * hi;

      float sum = wBlue + wLilac + wPink + wOrng + wPeach + wWhite;
      float g = hash(frag * vec2(0.731, 0.917) + vec2(11.0, 7.0)) * sum;

      vec3 col = vec3(1.0);
      if      (g < wBlue)                                 col = vec3(0.478, 0.643, 0.776);
      else if (g < wBlue + wLilac)                        col = vec3(0.588, 0.502, 0.745);
      else if (g < wBlue + wLilac + wPink)                col = vec3(0.953, 0.463, 0.549);
      else if (g < wBlue + wLilac + wPink + wOrng)        col = vec3(0.965, 0.647, 0.235);
      else if (g < wBlue + wLilac + wPink + wOrng + wPeach) col = vec3(0.957, 0.745, 0.667);

      gl_FragColor = vec4(col * 0.9 + 0.1, 1.0);
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
  const prog = gl.createProgram();
  if (!vs || !fs) { document.documentElement.classList.add('no-webgl'); return; }
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { document.documentElement.classList.add('no-webgl'); return; }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, 'uRes');
  const uTime = gl.getUniformLocation(prog, 'uTime');
  const uShift = gl.getUniformLocation(prog, 'uShift');

  // size: grain is tied to device pixels, capped for performance
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }

  // pointer: the ripple centre leans towards the cursor
  const target = { x: 0, y: 0 };
  const shift = { x: 0, y: 0 };
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    target.x = ((e.clientX - r.left) / r.width - 0.5) * 0.18;
    target.y = -((e.clientY - r.top) / r.height - 0.5) * 0.18;
  });
  canvas.addEventListener('pointerleave', () => { target.x = 0; target.y = 0; });

  let time = 4.0;
  let last = performance.now();
  let visible = true;
  let raf = 0;

  function draw() {
    resize();
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, time);
    gl.uniform2f(uShift, shift.x, shift.y);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    time += dt;
    shift.x += (target.x - shift.x) * 0.04;
    shift.y += (target.y - shift.y) * 0.04;
    draw();
    if (visible) raf = requestAnimationFrame(frame);
  }

  function start() {
    if (reduceMotion || raf) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() { cancelAnimationFrame(raf); raf = 0; }

  // only animate while on screen and while the tab is visible
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    visible ? start() : stop();
  }).observe(canvas);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : visible && start()));
  new ResizeObserver(() => draw()).observe(canvas);

  draw();
  start();
})();
