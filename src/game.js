// The little game while the egg boils: roll over small eggs in order (1, 2, 3 ...).
// Two dots show where the next two eggs will appear, so you can plan a route.
// Each small egg has its own countdown (comboSec): it goes yellow -> orange -> red, with ticks.
// Take it while it still has color and the streak (rekke) grows: each egg is worth the streak number.
// Too late (light blue): it still counts +1, but the streak starts over.
// Connect the dots: the eggs follow a figure from src/figures/. Each egg taken in time draws a line
// from the one before, too late = no line (the figure stays incomplete). A finished figure flashes up
// and fades out while the next one starts. The figure in progress is saved, so the next boil goes on
// where this one stopped.

import { loadFigures } from './figures.js';

const FIG_KEY = 'trillekok-figure-v1';
const loadProgress = () => { try { return JSON.parse(localStorage.getItem(FIG_KEY) || 'null'); } catch (e) { return null; } };
const saveProgress = (p) => { try { localStorage.setItem(FIG_KEY, JSON.stringify(p)); } catch (e) { /* ignore */ } };

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const hex = (h) => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mix = (a, b, t) => '#' + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');

// hooks: { digitColor() -> string, onPickup({ n, combo, eggs, bonus, x, z }), onTick(urgency, red) }
export function createGame(world, P, hooks) {
  let active = false;
  let paused = false;
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
  // Connect the dots
  const figures = loadFigures();
  const useFigures = () => P.figuresOn && figures.length > 0;
  let prog = null;       // the figure being drawn: { name, next, drawn: [node], closes: [node], prev }
  let queueFig = null;   // the figure whose nodes are being put in the plan, and the next node to put
  let queueIdx = 0;
  const placed = new Map(); // figure name -> node index -> floor point, for this round

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

  // Fit a figure into the play area (aspect kept, centered) -> floor point of node i
  function nodePos(fig, i) {
    let m = placed.get(fig.name);
    if (!m) {
      const A = area();
      const W = A.x1 - A.x0, H = A.z1 - A.z0;
      const k = Math.min(W / Math.max(fig.w, 1e-3), H / Math.max(fig.h, 1e-3));
      const ox = A.x0 + (W - fig.w * k) / 2, oz = A.z0 + (H - fig.h * k) / 2;
      m = fig.nodes.map((n) => ({ x: ox + n.u * k, z: oz + n.v * k }));
      placed.set(fig.name, m);
    }
    return m[i];
  }
  const figByName = (name) => figures.find((f) => f.name === name);
  // A new figure at random, not the same as the last one
  function nextFigure(prev) {
    const pool = figures.length > 1 ? figures.filter((f) => f.name !== prev) : figures;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function refill(from) {
    while (plan.length < 3) {
      if (!useFigures()) { plan.push(...pattern(plan.length ? plan[plan.length - 1] : from)); continue; }
      if (queueIdx >= queueFig.nodes.length) { queueFig = nextFigure(queueFig.name); queueIdx = 0; }
      plan.push({ ...nodePos(queueFig, queueIdx), fig: queueFig, i: queueIdx });
      queueIdx++;
    }
  }

  // Draw the lines already made in the figure in progress (quickly one after another, or at once)
  function redraw(stagger) {
    world.game.figHide();
    const fig = prog && figByName(prog.name);
    if (!fig) return;
    let k = 0;
    const opts = () => (stagger ? { grow: true, delay: (k++) * stagger } : { grow: false });
    for (const i of prog.drawn) if (i > 0) world.game.figLine(nodePos(fig, i - 1), nodePos(fig, i), opts());
    for (const i of prog.closes) {
      const c = fig.closes.find((cl) => cl.from === i);
      if (c) world.game.figLine(nodePos(fig, c.from), nodePos(fig, c.to), opts());
    }
  }

  // A node of the figure was taken: draw its line (only in time), and finish the figure at the end
  function connect(node, inTime) {
    const fig = node.fig;
    if (!prog || prog.name !== fig.name) prog = { name: fig.name, next: 0, drawn: [], closes: [], prev: prog ? prog.name : null };
    if (inTime && fig.nodes[node.i].line) {
      world.game.figLine(nodePos(fig, node.i - 1), nodePos(fig, node.i));
      prog.drawn.push(node.i);
    }
    for (const c of fig.closes) {
      if (c.from !== node.i || !inTime) continue;
      world.game.figLine(nodePos(fig, c.from), nodePos(fig, c.to));
      prog.closes.push(c.from);
    }
    prog.next = node.i + 1;
    if (prog.next >= fig.nodes.length) {
      world.game.figDone();
      if (hooks.onFigure) hooks.onFigure({ name: fig.name, complete: prog.drawn.length + prog.closes.length });
      // The next figure in the plan (already chosen) becomes the one in progress
      const nextFig = plan[0] && plan[0].fig;
      prog = nextFig ? { name: nextFig.name, next: 0, drawn: [], closes: [], prev: fig.name } : null;
    }
    saveProgress(prog);
  }

  function show(now) {
    target.at = now;
    nextTick = now + 500;
    world.game.showTarget(target.x, target.z, target.n, colors(0));
    world.game.setDots(plan.slice(0, 2));
  }

  function pick(now) {
    eggs++;
    const inTime = progress(now) < 1;
    combo = inTime ? combo + 1 : 1; // in time keeps the streak, too late starts over
    bonus += combo - 1;
    lastPick = now;
    hooks.onPickup({ n: target.n, combo, eggs, bonus, x: target.x, z: target.z });
    world.game.popTarget();
    if (target.fig) connect(target, inTime);
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
      paused = false;
      eggs = 0;
      bonus = 0;
      combo = 0;
      lastPick = -1e9;
      penalties = 0;
      lastPenalty = -1e9;
      plan = [];
      placed.clear();
      // Go on with the figure from last time, or start a new one
      prog = useFigures() ? loadProgress() : null;
      const saved = prog && figByName(prog.name);
      if (saved && prog.next < saved.nodes.length) { queueFig = saved; queueIdx = prog.next; }
      else if (useFigures()) { queueFig = nextFigure(prog && prog.prev); queueIdx = 0; prog = null; }
      if (useFigures()) redraw(0.06);
      refill(world.eggPos());
      target = { ...plan.shift(), n: 1 };
      refill(target);
      show(performance.now());
    },
    stop() {
      active = false;
      paused = false;
      world.game.clear();
      world.game.figHide();
    },
    // Cancel with a way back: hide the eggs but keep the score, streak and plan
    pause() {
      if (!active) return;
      active = false;
      paused = true;
      world.game.clear();
      world.game.figHide();
    },
    // Back to the countdown: the same egg and dots come back, the score is as before
    resume(now) {
      if (!paused || !target) return false;
      paused = false;
      active = true;
      if (useFigures()) redraw(0);
      show(now);
      return true;
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
      if (dist(world.eggPos(), target) < P.pickup * P.eggWidth * world.eggScale() / 2) pick(now);
    },
    // The egg hit a wall: lose points (one bounce sequence counts once)
    bump(now) {
      if (!active || P.bumpPenalty <= 0 || now - lastPenalty < 600) return 0;
      lastPenalty = now;
      penalties += P.bumpPenalty;
      return P.bumpPenalty;
    },
    get active() { return active; },
    // For debugging/tests: the egg to take now, and the figure in progress
    get debug() { return { target, prog, plan }; },
    // For the score line
    stats(now) {
      const streak = target && progress(now) < 1 ? combo : 0;
      return { eggs, bonus, penalties, total: eggs + bonus - penalties, streak };
    }
  };
}
