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

  // ---- The seed's personality ----
  const spin = rand() * Math.PI * 2;                       // where the first splash lobe points
  const lobeLen = Array.from({ length: 5 }, () => 0.75 + rand() * 0.5);   // each lobe a bit different
  const lobeTwist = Array.from({ length: 5 }, () => (rand() - 0.5) * 0.5); // pulled a bit sideways
  const smileTilt = (rand() < 0.5 ? -1 : 1) * (0.12 + rand() * 0.18);    // the crooked smile leans left or right
  const smileLean = (rand() - 0.5) * 0.5;                  // one cheek fuller than the other
  const hiAngle = -2.3 + (rand() - 0.5) * 0.6;             // highlight up-left, give or take
  const stiffJitter = Array.from({ length: N }, () => 0.75 + rand() * 0.5);

  // Point angles around the middle (evenly spread, starting at the first lobe)
  const angle = (i) => spin + (i / N) * Math.PI * 2;

  // Target shape for a state, in units of the yolk radius (1 = medium yolk)
  function targets(state) {
    const out = [];
    for (let i = 0; i < N; i++) {
      let a = angle(i);
      let r;
      if (state === 'hard') {
        r = 0.86; // tight and round
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
        r -= P.yolkSmile * 0.35 * up ** 3;
        // the bottom swells a little
        r += 0.06 * Math.max(0, s) ** 2;
      } else {
        // Splash: 5 lobes (even points) and 5 waists (odd points), pulled in different directions
        const k = i >> 1;
        if (i % 2 === 0) {
          r = 1 + P.yolkLobe * lobeLen[k];
          a += lobeTwist[k];
        } else {
          r = 0.84;
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

  // Closed Catmull-Rom curve through the points, drawn as cubic Beziers
  function tracePath(px) {
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const p0 = px[(i - 1 + N) % N];
      const p1 = px[i];
      const p2 = px[(i + 1) % N];
      const p3 = px[(i + 2) % N];
      if (i === 0) ctx.moveTo(p1[0], p1[1]);
      ctx.bezierCurveTo(
        p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
        p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6,
        p2[0], p2[1]
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
    // Radius: leave room for the longest splash lobe
    const R = Math.min(w, h) / 2 / (1 + P.yolkLobe * 1.25 + 0.08);
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
    const n = Math.max(1, Math.ceil(dt / (1 / 240)));
    const h = dt / n;
    let moving = false;
    for (let k = 0; k < n; k++) {
      for (let i = 0; i < N; i++) {
        const p = pts[i];
        const K = P.yolkStiff * stiffJitter[i];
        p.vx += ((tg[i][0] - p.x) * K - p.vx * P.yolkDamp) * h;
        p.vy += ((tg[i][1] - p.y) * K - p.vy * P.yolkDamp) * h;
        p.x += p.vx * h;
        p.y += p.vy * h;
      }
      const K = P.yolkStiff * 0.6;
      hi.vd += ((H[0] - hi.d) * K - hi.vd * P.yolkDamp) * h; hi.d += hi.vd * h;
      hi.vs += ((H[1] - hi.s) * K - hi.vs * P.yolkDamp) * h; hi.s += hi.vs * h;
      hi.vo += ((H[2] - hi.o) * K - hi.vo * P.yolkDamp) * h; hi.o += hi.vo * h;
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
      // A little kick outward when it splashes, inward when it sets: more jelly
      const kick = s === 'soft' ? 2.5 : s === 'hard' ? -1.5 : 1;
      pts.forEach((p) => { p.vx += p.x * kick; p.vy += p.y * kick; });
      wake();
    },
    wake, // after lab changes
    seed
  };
}
