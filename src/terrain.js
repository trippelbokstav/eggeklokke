// The altitude terrain: a thin line over the altitude slider that bulges into hills and then
// sharp mountains as you drag right. The highest peak sits over the slider thumb.
// Built from seeded 1D noise: soft fBm at low altitude, blending into ridged noise up high.
// The peak follows the thumb on a spring (it lags, gets a bit wild when you drag fast, lands softly),
// and the landscape glides past as you drag, like driving through it.
// The slider track is the ground: at 0 m the line lies flat on the track.

// Small seeded random generator (mulberry32)
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 1D gradient noise, roughly in -0.5 .. 0.5
function makeNoise(rand) {
  const SIZE = 512;
  const grad = Float32Array.from({ length: SIZE }, () => rand() * 2 - 1);
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  return (x) => {
    const i = Math.floor(x);
    const f = x - i;
    const g0 = grad[((i % SIZE) + SIZE) % SIZE];
    const g1 = grad[(((i + 1) % SIZE) + SIZE) % SIZE];
    const a = g0 * f;
    const b = g1 * (f - 1);
    return a + (b - a) * fade(f);
  };
}

export function createTerrain(canvas, input, P, seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0) {
  const rand = rng(seed);
  const noise = makeNoise(rand);
  const off = rand() * 200;         // where in the noise this landscape lives
  const offFar = rand() * 200 + 300; // background hills
  const ctx = canvas.getContext('2d');
  const THUMB = 12;                 // half the thumb width (the range's travel starts and ends here)

  const target = () => +input.value / +input.max; // 0 .. 1
  // Springs: peak position (0..1 along the track) and altitude (0..1)
  const pos = { x: target(), v: 0 };
  const alt = { x: target(), v: 0 };
  let travel = 0;   // how far the landscape has glided
  let chaos = 0;    // extra roughness while you drag fast, fades out
  let running = false;
  let last = 0;
  let color = '#55707C';

  function setColor(c) { color = c; draw(); }

  // fBm (soft) and ridged (sharp) noise, mixed by how high we are
  function ground(u, t, oct) {
    let fbm = 0;
    let ridge = 0;
    let amp = 0.5;
    let freq = 1;
    let norm = 0;
    for (let o = 0; o < oct; o++) {
      const w = Math.min(1, oct - o); // fractional last octave, so detail fades in smoothly
      const n = noise(u * freq + o * 31.7);
      fbm += n * amp * w;
      ridge += (1 - Math.abs(n * 2)) ** 2 * amp * w; // 0..1 per octave, sharp creases
      norm += amp * w;
      amp *= 0.42;  // gentle detail: big ridges first, little jitter
      freq *= 2.3;
    }
    fbm /= norm;
    ridge = ridge / norm - 0.5;
    const r = Math.min(1, t ** 1.4 * P.terrainSharp);
    return fbm + (ridge - fbm) * r;
  }

  function draw() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const t = Math.max(0, alt.x);               // altitude 0..1 (can overshoot a little on the spring)
    const base = h - 1;                         // the ground = the slider track
    const xt = THUMB + pos.x * (w - 2 * THUMB); // the peak, in pixels
    const A = Math.min(t, 1.15) * P.terrainHeight;
    const oct = 1.5 + 3.5 * Math.min(1, t) * (P.terrainOct / 5);
    const freq = (2.2 + 4 * Math.min(1, t)) * P.terrainFreq; // features per track width: wider hills low, more peaks high
    const spread = (0.6 - 0.12 * Math.min(1, t)) * P.terrainWidth; // how wide the mountain massif is (share of the width)
    const rough = (0.35 + 0.95 * Math.min(1, t)) * (1 + chaos);
    const glide = travel * P.terrainScroll;
    const shapePow = 2 - 1.15 * Math.min(1, t) * Math.min(1, P.terrainSharp);

    const at = (x) => (x / w) * freq + off + glide;
    const peakN = ground(at(xt), t, oct);
    const step = 1.5;
    ctx.beginPath();
    for (let x = 0; x <= w + 0.01; x += step) {
      const dx = (x - xt) / w;
      // Round hump low (power 2), a pointed summit high (power below 1)
      const env = Math.exp(-(Math.abs(dx / spread) ** shapePow) * 3);
      // The noise is pinned to 1 at the thumb and falls away from it, so the top is always over the thumb
      const d = Math.max(0, 1 - rough * Math.abs(ground(at(x), t, oct) - peakN));
      // Low background hills, so it reads as a landscape and not a lone bump
      const far = Math.max(0, ground((x / w) * freq * 0.7 + offFar + glide * 0.5, t * 0.6, 3) + 0.25) * 0.28 * (1 - env);
      const y = base - A * (env * d + far);
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    // Fade the line out toward both ends, so it melts into the page
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.05, color);
    g.addColorStop(0.95, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.strokeStyle = g;
    ctx.lineWidth = P.terrainLine;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.globalAlpha = Math.min(1, t * 25); // at 0 m the line hides in the slider track
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function step(dt) {
    const goal = target();
    const n = Math.max(1, Math.ceil(dt / (1 / 240)));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      // Peak position: a soft, lagging spring (ease in, ease out)
      pos.v += ((goal - pos.x) * P.terrainLag - pos.v * P.terrainDamp) * h;
      pos.x += pos.v * h;
      // Altitude: a little bouncier, so the mountains settle with a small overshoot
      alt.v += ((goal - alt.x) * P.terrainLag * 1.3 - alt.v * P.terrainDamp * 0.8) * h;
      alt.x += alt.v * h;
    }
    // Glide through the landscape as the peak moves; dragging fast stirs it up
    travel += pos.v * dt;
    chaos += (Math.min(1.2, Math.abs(pos.v) * 0.5 * P.terrainChaos) - chaos) * (1 - Math.exp(-dt * 6));
    return Math.abs(goal - pos.x) > 1e-4 || Math.abs(pos.v) > 1e-4 ||
      Math.abs(goal - alt.x) > 1e-4 || Math.abs(alt.v) > 1e-4 || chaos > 1e-3;
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const moving = step(dt);
    draw();
    if (moving) requestAnimationFrame(frame);
    else running = false;
  }
  function wake() {
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }

  input.addEventListener('input', wake);
  new ResizeObserver(() => draw()).observe(canvas);
  draw();

  return { wake, setColor, seed };
}
