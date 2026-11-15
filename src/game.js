// The little game while the egg boils: roll over small eggs in order (1, 2, 3 ...).
// Two dots show where the next two eggs will appear, so you can plan a route.
// Each small egg has its own countdown (comboSec): it goes yellow -> orange -> red, with ticks.
// Take it while it still has color and the streak (rekke) grows: each egg is worth the streak number.
// Too late (light blue): it still counts +1, but the streak starts over.

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const hex = (h) => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mix = (a, b, t) => '#' + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');

// hooks: { digitColor() -> string, onPickup({ n, combo, eggs, bonus, x, z }), onTick(urgency, red) }
export function createGame(world, P, hooks) {
  let active = false;
  let eggs = 0;
  let bonus = 0;
  let combo = 0;
  let lastPick = -1e9;
  let penalties = 0;
  let lastPenalty = -1e9;
  let target = null;   // { x, z, n, at }
  let plan = [];       // upcoming spots; the dots show the first two
  let nextTick = 0;
  let lastTint = 0;

  // Countdown 0..1 for the current egg (>= 1 = too late for the streak)
  const progress = (now) => (now - target.at) / (P.comboSec * 1000);

  function countdownColor(f) {
    if (f >= 1) return P.lineColor;
    if (f < 0.5) return mix(P.digitColor, P.miniOrange, f / 0.5);
    return mix(P.miniOrange, P.outlineEnd, (f - 0.5) / 0.5);
  }
  const colors = (f) => ({ shell: countdownColor(f), digit: hooks.digitColor() });

  // The play area in floor coordinates, kept so the whole small egg is in view
  function area() {
    const a = world.game.freeArea();
    const x0 = Math.min(a.x0, a.x1);
    const x1 = Math.max(a.x0, a.x1);
    const z0 = Math.min(a.z0, a.z1);
    const z1 = Math.max(a.z0, a.z1);
    // Keep a band along the edges free (spotInset), plus room for the whole small egg
    const mx = (x1 - x0) * P.spotInset + P.eggLength * P.miniScale * 0.6;
    const mz = (z1 - z0) * P.spotInset + P.eggLength * P.miniScale * 0.6;
    return { x0: x0 + mx, x1: x1 - mx, z0: z0 + mz, z1: z1 - mz };
  }
  const clampTo = (p, A) => ({ x: Math.min(A.x1, Math.max(A.x0, p.x)), z: Math.min(A.z1, Math.max(A.z0, p.z)) });
  const rnd = (a, b) => a + Math.random() * (b - a);

  // Little "setups" instead of pure chance: a column to roll down (or up), a row across,
  // a diagonal, or a single far jump. E.g. one egg at the top, then three in a row going down.
  function pattern(from) {
    const A = area();
    const W = A.x1 - A.x0;
    const H = A.z1 - A.z0;
    const step = P.eggWidth * 0.75;
    const jitter = () => rnd(-0.15, 0.15);
    const pts = [];
    const r = Math.random();
    if (r < 0.4) {
      // Column: start near the top (roll down) or the bottom (roll up)
      const down = from.z > (A.z0 + A.z1) / 2; // start on the far side from where we are
      const x = rnd(A.x0, A.x1);
      const z = down ? A.z0 + rnd(0, H * 0.15) : A.z1 - rnd(0, H * 0.15);
      const n = 3 + (Math.random() < 0.4 ? 1 : 0);
      for (let i = 0; i < n; i++) pts.push({ x: x + jitter(), z: z + (down ? 1 : -1) * i * step });
    } else if (r < 0.6) {
      // Row across, starting on the far side
      const right = from.x < (A.x0 + A.x1) / 2;
      const z = rnd(A.z0, A.z1);
      const x = right ? A.x1 - rnd(0, W * 0.1) : A.x0 + rnd(0, W * 0.1);
      for (let i = 0; i < 3; i++) pts.push({ x: x + (right ? -1 : 1) * i * step, z: z + jitter() });
    } else if (r < 0.8) {
      // Diagonal from a corner
      const sx = Math.random() < 0.5 ? 1 : -1;
      const sz = Math.random() < 0.5 ? 1 : -1;
      const x = sx > 0 ? A.x0 + rnd(0, W * 0.15) : A.x1 - rnd(0, W * 0.15);
      const z = sz > 0 ? A.z0 + rnd(0, H * 0.15) : A.z1 - rnd(0, H * 0.15);
      const d = step * 0.8;
      for (let i = 0; i < 3; i++) pts.push({ x: x + sx * i * d, z: z + sz * i * d * 1.3 });
    } else {
      // A single far jump
      let best = null;
      for (let i = 0; i < 8; i++) {
        const p = { x: rnd(A.x0, A.x1), z: rnd(A.z0, A.z1) };
        if (!best || dist(p, from) > dist(best, from)) best = p;
      }
      pts.push(best);
    }
    return pts.map((p) => clampTo(p, A));
  }

  function refill(from) {
    while (plan.length < 3) plan.push(...pattern(plan.length ? plan[plan.length - 1] : from));
  }

  function show(now) {
    target.at = now;
    nextTick = now + 500;
    world.game.showTarget(target.x, target.z, target.n, colors(0));
    world.game.setDots(plan.slice(0, 2));
  }

  function pick(now) {
    eggs++;
    combo = progress(now) < 1 ? combo + 1 : 1; // in time keeps the streak, too late starts over
    bonus += combo - 1;
    lastPick = now;
    hooks.onPickup({ n: target.n, combo, eggs, bonus, x: target.x, z: target.z });
    world.game.popTarget();
    // The first dot becomes the next egg, and the plan moves on
    const next = plan.shift();
    next.n = target.n + 1;
    target = next;
    refill(target);
    show(now);
  }

  return {
    start() {
      active = true;
      eggs = 0;
      bonus = 0;
      combo = 0;
      lastPick = -1e9;
      penalties = 0;
      lastPenalty = -1e9;
      plan = [];
      refill(world.eggPos());
      target = { ...plan.shift(), n: 1 };
      refill(target);
      show(performance.now());
    },
    stop() {
      active = false;
      world.game.clear();
    },
    update(now) {
      if (!active || !target) return;
      // Countdown: color and ticks (faster towards the end)
      const f = progress(now);
      // Recolor ~12 times a second (smooth enough, and each recolor means a redraw)
      if (now - lastTint > 80) { lastTint = now; world.game.tintTarget(colors(f)); }
      if (f < 1 && now >= nextTick) {
        hooks.onTick(f, f > 0.75);
        nextTick = now + (f < 0.5 ? 500 : f < 0.8 ? 300 : 160);
      }
      if (now - target.at < 300) return; // a fresh egg can't be taken the same instant it appears
      // Roll well over it: the big egg's middle must come close, the edge is not enough
      if (dist(world.eggPos(), target) < P.pickup * P.eggWidth / 2) pick(now);
    },
    // The egg hit a wall: lose points (one bounce sequence counts once)
    bump(now) {
      if (!active || P.bumpPenalty <= 0 || now - lastPenalty < 600) return 0;
      lastPenalty = now;
      penalties += P.bumpPenalty;
      return P.bumpPenalty;
    },
    get active() { return active; },
    // For the score line
    stats(now) {
      const streak = target && progress(now) < 1 ? combo : 0;
      return { eggs, bonus, penalties, total: eggs + bonus - penalties, streak };
    }
  };
}
