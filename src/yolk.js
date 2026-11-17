// The yolk picker: a 2D yolk on a canvas that morphs between soft, smiling and hard.
// 10 points on a closed Catmull-Rom curve. Each state is a set of target positions;
// every point springs there on its own (slightly different stiffness), so it wobbles like jelly.
// A new seed every time the app opens: the splash, the crooked smile and the highlight vary a little.

const N = 10;
export const YOLK_STATES = ['soft', 'smile', 'hard'];

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

const hexToRgb = (h) => {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export function createYolk(canvas, P, seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0) {
  const rand = rng(seed);
  const ctx = canvas.getContext('2d');

  // ---- The seed's personality: rolled again on every change, so the yolk stays alive ----
  let spin = rand() * Math.PI * 2;                        // where the first splash lobe points
  let lobeLen, lobeTwist, smileTilt, smileLean, hiAngle, stiffJitter;
  function roll() {
    // Turn only a little each time, so the points never have to cross over each other
    spin += (rand() - 0.5) * 0.9;
    lobeLen = Array.from({ length: 5 }, () => 0.75 + rand() * 0.5);   // each lobe a bit different
    lobeTwist = Array.from({ length: 5 }, () => (rand() - 0.5) * 0.5); // pulled a bit sideways
    smileTilt = (rand() < 0.5 ? -1 : 1) * (0.12 + rand() * 0.18);    // the crooked smile leans left or right
    smileLean = (rand() - 0.5) * 0.5;                     // one cheek fuller than the other
    hiAngle = -2.3 + (rand() - 0.5) * 0.6;                // highlight up-left, give or take
    stiffJitter = Array.from({ length: N }, () => 0.75 + rand() * 0.5);
  }
  roll();

  // Point angles around the middle (evenly spread, starting at the first lobe)
  const angle = (i) => spin + (i / N) * Math.PI * 2;
  // Motion per target state: [stiffness, damping, kick]. Soft = wobbly, hard = firm and concise.
  const motion = (st) => (st === 'soft' ? [P.yolkSoftStiff, P.yolkSoftDamp, 2.5]
    : st === 'hard' ? [P.yolkHardStiff, P.yolkHardDamp, 0]
    : [P.yolkSmileStiff, P.yolkSmileDamp, 0.3]);

  // Target shape for a state, in units of the yolk radius (1 = medium yolk)
  function targets(state) {
    const out = [];
    for (let i = 0; i < N; i++) {
      let a = angle(i);
      let r;
      if (state === 'hard') {
        r = 0.88; // tight and round
      } else if (state === 'smile') {
        // A soft, wide blob, flatter on top and full at the bottom, tilted: a crooked smile
        const t = a - smileTilt;
        const ex = 1.12 + smileLean * Math.cos(t);        // fuller on one side
        const ey = 0.84;
        const c = Math.cos(t);
        const s = Math.sin(t);
        r = (ex * ey) / Math.sqrt((ey * c) ** 2 + (ex * s) ** 2);
        // dent on top (screen up = negative sin), so the upper edge curves like a smile
        const up = Math.max(0, -s);
        r -= 0.35 * up ** 3;
        // the bottom swells a little
        r += 0.06 * Math.max(0, s) ** 2;
        // yolkSmile blends from a plain circle (0) to the full crooked smile (1)
        r = 0.95 + (r - 0.95) * P.yolkSmile;
      } else {
        // Splash: 5 lobes (even points) and 5 waists (odd points), pulled in different directions
        const k = i >> 1;
        if (i % 2 === 0) {
          r = 1 + P.yolkLobe * lobeLen[k];
          a += lobeTwist[k];
        } else {
          r = P.yolkWaist;
        }
      }
      out.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    return out;
  }

  // Highlight per state: [offset (radius units), size, opacity]
  const HIGHLIGHT = { soft: [0.42, 0.26, 0.85], smile: [0.38, 0.2, 0.75], hard: [0.3, 0.12, 0] };

  let state = 'smile';
  const pts = targets(state).map(([x, y]) => ({ x, y, vx: 0, vy: 0 }));
  const hi = { d: HIGHLIGHT.smile[0], s: HIGHLIGHT.smile[1], o: HIGHLIGHT.smile[2], vd: 0, vs: 0, vo: 0 };
  let color = hexToRgb(P.yolkSmileColor);
  let running = false;
  let last = 0;

  function colorFor(s) {
    return hexToRgb(s === 'soft' ? P.yolkSoftColor : s === 'hard' ? P.yolkHardColor : P.yolkSmileColor);
  }

  // Closed uniform cubic B-spline: the points pull on the curve like CVs (softer than passing through them)
  const onCurve = (px, i) => {
    const a = px[(i - 1 + N) % N];
    const b = px[i];
    const c = px[(i + 1) % N];
    return [(a[0] + 4 * b[0] + c[0]) / 6, (a[1] + 4 * b[1] + c[1]) / 6];
  };
  function tracePath(px) {
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const p1 = px[i];
      const p2 = px[(i + 1) % N];
      if (i === 0) { const s = onCurve(px, 0); ctx.moveTo(s[0], s[1]); }
      const e = onCurve(px, (i + 1) % N);
      ctx.bezierCurveTo(
        (2 * p1[0] + p2[0]) / 3, (2 * p1[1] + p2[1]) / 3,
        (p1[0] + 2 * p2[0]) / 3, (p1[1] + 2 * p2[1]) / 3,
        e[0], e[1]
      );
    }
    ctx.closePath();
  }

  function draw() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    // Radius: the longest splash lobe must fit. B-spline tip = (waist + 4 * tip + waist) / 6
    const reach = (2 * P.yolkWaist + 4 * (1 + P.yolkLobe * 1.25)) / 6;
    const R = Math.min(w, h) / 2 / Math.max(1.05, reach);
    const cx = w / 2;
    const cy = h / 2;
    const px = pts.map((p) => [cx + p.x * R, cy + p.y * R]);

    tracePath(px);
    ctx.fillStyle = `rgb(${color.map(Math.round).join(',')})`;
    ctx.fill();
    // Highlight: a small tilted oval up-left, fades away when the yolk sets
    if (hi.o > 0.01) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, hi.o);
      ctx.translate(cx + Math.cos(hiAngle) * hi.d * R, cy + Math.sin(hiAngle) * hi.d * R);
      ctx.rotate(hiAngle + Math.PI / 2);
      ctx.beginPath();
      ctx.ellipse(0, 0, Math.max(0.1, hi.s * R), Math.max(0.1, hi.s * R * 0.55), 0, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.restore();
    }
  }

  // Spring everything toward the current state. Returns true while anything still moves.
  function step(dt) {
    const tg = targets(state);
    const H = HIGHLIGHT[state];
    const goalColor = colorFor(state);
    const [stiff, damp] = motion(state);
    const n = Math.max(1, Math.ceil(dt / (1 / 480)));
    const h = dt / n;
    let moving = false;
    for (let k = 0; k < n; k++) {
      for (let i = 0; i < N; i++) {
        const p = pts[i];
        // Soft gets uneven point speeds (jelly); hard moves all points together (firm)
        const jit = state === 'hard' ? 1 : stiffJitter[i];
        const K = stiff * jit;
        p.vx += ((tg[i][0] - p.x) * K - p.vx * damp) * h;
        p.vy += ((tg[i][1] - p.y) * K - p.vy * damp) * h;
        p.x += p.vx * h;
        p.y += p.vy * h;
      }
      const K = stiff * 0.6;
      hi.vd += ((H[0] - hi.d) * K - hi.vd * damp) * h; hi.d += hi.vd * h;
      hi.vs += ((H[1] - hi.s) * K - hi.vs * damp) * h; hi.s += hi.vs * h;
      hi.vo += ((H[2] - hi.o) * K - hi.vo * damp) * h; hi.o += hi.vo * h;
    }
    const e = 1 - Math.exp(-dt * 6);
    color = color.map((v, i) => v + (goalColor[i] - v) * e);
    for (let i = 0; i < N; i++) {
      const p = pts[i];
      if (Math.abs(tg[i][0] - p.x) + Math.abs(tg[i][1] - p.y) > 1e-4 || Math.abs(p.vx) + Math.abs(p.vy) > 1e-3) moving = true;
    }
    if (Math.abs(H[2] - hi.o) > 1e-3 || Math.abs(hi.vo) > 1e-3 || Math.abs(H[1] - hi.s) > 1e-3) moving = true;
    if (color.some((v, i) => Math.abs(v - goalColor[i]) > 0.5)) moving = true;
    return moving;
  }

  // Animate only while something moves; sleep when the yolk has settled
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

  new ResizeObserver(() => draw()).observe(canvas);
  draw();

  return {
    get state() { return state; },
    set(s) {
      if (s === state) return;
      state = s;
      roll(); // a new shape every time
      // A kick outward when it splashes (jelly); none when it sets (firm)
      const kick = motion(s)[2];
      pts.forEach((p) => { p.vx += p.x * kick; p.vy += p.y * kick; });
      wake();
    },
    wake, // after lab changes
    seed
  };
}
