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
  let target = null;   // { x, z, n, at }
  let queue = [];      // the two dots: [{ x, z }, { x, z }]
  let nextTick = 0;

  // Countdown 0..1 for the current egg (>= 1 = too late for the streak)
  const progress = (now) => (now - target.at) / (P.comboSec * 1000);

  function countdownColor(f) {
    if (f >= 1) return P.lineColor;
    if (f < 0.5) return mix(P.digitColor, P.miniOrange, f / 0.5);
    return mix(P.miniOrange, P.outlineEnd, (f - 0.5) / 0.5);
  }
  const colors = (f) => ({ shell: countdownColor(f), digit: hooks.digitColor() });

  // A random free spot in view, away from the big egg and the other eggs/dots
  function randomSpot(avoid) {
    const a = world.game.freeArea();
    const m = P.eggLength * P.miniScale * 0.6 + 0.25; // keep the whole small egg in view
    const x0 = Math.min(a.x0, a.x1) + m;
    const x1 = Math.max(a.x0, a.x1) - m;
    const z0 = Math.min(a.z0, a.z1) + m;
    const z1 = Math.max(a.z0, a.z1) - m;
    const minD = P.eggWidth * 0.9;
    let p = null;
    for (let i = 0; i < 40; i++) {
      p = { x: x0 + Math.random() * Math.max(0, x1 - x0), z: z0 + Math.random() * Math.max(0, z1 - z0) };
      if (avoid.every((q) => dist(p, q) > minD)) return p;
    }
    return p;
  }

  function show(now) {
    target.at = now;
    nextTick = now + 500;
    world.game.showTarget(target.x, target.z, target.n, colors(0));
    world.game.setDots(queue);
  }

  function pick(now) {
    eggs++;
    combo = progress(now) < 1 ? combo + 1 : 1; // in time keeps the streak, too late starts over
    bonus += combo - 1;
    lastPick = now;
    hooks.onPickup({ n: target.n, combo, eggs, bonus, x: target.x, z: target.z });
    world.game.popTarget();
    // The first dot becomes the next egg, and a new dot appears
    const next = queue.shift();
    next.n = target.n + 1;
    target = next;
    queue.push(randomSpot([world.eggPos(), target, ...queue]));
    show(now);
  }

  return {
    start() {
      active = true;
      eggs = 0;
      bonus = 0;
      combo = 0;
      lastPick = -1e9;
      const e = world.eggPos();
      target = { ...randomSpot([e]), n: 1 };
      queue = [];
      queue.push(randomSpot([e, target]));
      queue.push(randomSpot([e, target, ...queue]));
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
      world.game.tintTarget(colors(f));
      if (f < 1 && now >= nextTick) {
        if (P.ticks) hooks.onTick(f, f > 0.75);
        nextTick = now + (f < 0.5 ? 500 : f < 0.8 ? 300 : 160);
      }
      if (now - target.at < 300) return; // a fresh egg can't be taken the same instant it appears
      // Roll well over it: the big egg's middle must come close, the edge is not enough
      if (dist(world.eggPos(), target) < P.pickup * P.eggWidth / 2) pick(now);
    },
    get active() { return active; },
    // For the score line
    stats(now) {
      const streak = target && progress(now) < 1 ? combo : 0;
      return { eggs, bonus, total: eggs + bonus, streak };
    }
  };
}
