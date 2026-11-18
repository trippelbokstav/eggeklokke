// Connect-the-dots figures, drawn in Illustrator and exported as SVG to src/figures/.
// Each anchor point becomes a small egg; the path direction is the order.
// Several paths = "lift the pen" between them (taken in document order).
// A closed path (Z, or <polygon>) gets its closing line when the last point is taken.
// Curves are ignored: only the anchor points count.
// Pure string parsing (no DOM), so scripts/check-figures.mjs can use it in Node too.

const num = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi;
const attr = (tag, name) => {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, 'i')) || tag.match(new RegExp(`\\s${name}\\s*=\\s*'([^']*)'`, 'i'));
  return m ? m[1] : null;
};
const nums = (s) => (s || '').match(num)?.map(Number) || [];

// SVG path "d" -> strokes of anchor points [{ pts: [[x, y], ...], closed }]
function parsePath(d) {
  const strokes = [];
  let cur = null;
  let x = 0, y = 0, sx = 0, sy = 0;
  const tokens = d.match(/[a-df-z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) || [];
  let i = 0, cmd = '';
  const n = () => Number(tokens[i++]);
  const add = () => { cur.pts.push([x, y]); };
  // Arguments per command, and which pair is the end point
  const argc = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };
  while (i < tokens.length) {
    if (/[a-z]/i.test(tokens[i])) cmd = tokens[i++];
    const c = cmd.toLowerCase();
    const rel = cmd !== cmd.toUpperCase();
    if (c === 'z') {
      if (cur) { cur.closed = true; x = sx; y = sy; }
      cur = null;
      if (!/[a-z]/i.test(tokens[i] || 'z')) cmd = 'l'; // stray numbers after Z: treat as lines
      continue;
    }
    if (!(c in argc)) { i++; continue; }
    const a = [];
    for (let k = 0; k < argc[c]; k++) a.push(n());
    if (a.some(Number.isNaN)) break;
    if (c === 'm') {
      x = rel ? x + a[0] : a[0]; y = rel ? y + a[1] : a[1];
      sx = x; sy = y;
      cur = { pts: [], closed: false };
      strokes.push(cur);
      add();
      cmd = rel ? 'l' : 'L'; // extra pairs after M are lines
      continue;
    }
    if (!cur) { cur = { pts: [[x, y]], closed: false }; strokes.push(cur); sx = x; sy = y; }
    if (c === 'h') x = rel ? x + a[0] : a[0];
    else if (c === 'v') y = rel ? y + a[0] : a[0];
    else { const ex = a[a.length - 2], ey = a[a.length - 1]; x = rel ? x + ex : ex; y = rel ? y + ey : ey; }
    add();
  }
  return strokes;
}

// Whole SVG text -> strokes, in document order
export function parseSvg(text) {
  const strokes = [];
  const body = text.replace(/<!--[\s\S]*?-->/g, '').replace(/<defs[\s\S]*?<\/defs>/gi, '');
  for (const m of body.matchAll(/<(path|polyline|polygon|line)\b[^>]*>/gi)) {
    const tag = m[0];
    const kind = m[1].toLowerCase();
    if (kind === 'path') strokes.push(...parsePath(attr(tag, 'd') || ''));
    else if (kind === 'line') {
      const [x1, y1, x2, y2] = ['x1', 'y1', 'x2', 'y2'].map((k) => Number(attr(tag, k) || 0));
      strokes.push({ pts: [[x1, y1], [x2, y2]], closed: false });
    } else {
      const v = nums(attr(tag, 'points'));
      const pts = [];
      for (let k = 0; k + 1 < v.length; k += 2) pts.push([v[k], v[k + 1]]);
      strokes.push({ pts, closed: kind === 'polygon' });
    }
  }
  for (const s of strokes) {
    // Illustrator often repeats the first point at the end of a closed shape
    const a = s.pts[0], b = s.pts[s.pts.length - 1];
    if (s.pts.length > 2 && Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6) { s.pts.pop(); s.closed = true; }
    // Drop points on top of the one before (a zero-length segment)
    s.pts = s.pts.filter((p, k) => k === 0 || Math.hypot(p[0] - s.pts[k - 1][0], p[1] - s.pts[k - 1][1]) > 1e-6);
  }
  return strokes.filter((s) => s.pts.length > 0);
}

// Strokes -> a figure: nodes in play order, normalized to 0..1 on the longest side (aspect kept).
// Each node: { u, v, line } where line = draw a line to it from the node before.
// closes: [{ from, to }] = closing lines, drawn when node `from` is taken in time.
export function buildFigure(name, strokes) {
  const all = strokes.flatMap((s) => s.pts);
  if (!all.length) return null;
  const xs = all.map((p) => p[0]), ys = all.map((p) => p[1]);
  const x0 = Math.min(...xs), y0 = Math.min(...ys);
  const size = Math.max(Math.max(...xs) - x0, Math.max(...ys) - y0) || 1;
  const w = (Math.max(...xs) - x0) / size, h = (Math.max(...ys) - y0) / size;
  const nodes = [];
  const closes = [];
  for (const s of strokes) {
    const first = nodes.length;
    s.pts.forEach((p, k) => nodes.push({ u: (p[0] - x0) / size, v: (p[1] - y0) / size, line: k > 0 }));
    if (s.closed && s.pts.length > 2) closes.push({ from: nodes.length - 1, to: first });
  }
  return { name, nodes, closes, w, h };
}

// Smallest distance between two nodes that follow each other, and between any two nodes (0..1 units)
export function spacing(fig) {
  let next = Infinity, any = Infinity;
  fig.nodes.forEach((a, i) => fig.nodes.forEach((b, j) => {
    if (j <= i) return;
    const d = Math.hypot(a.u - b.u, a.v - b.v);
    any = Math.min(any, d);
    if (j === i + 1) next = Math.min(next, d);
  }));
  return { next, any };
}

// All figures in src/figures/, bundled at build time (Vite)
let cache = null;
export function loadFigures() {
  if (cache) return cache;
  const files = import.meta.glob('./figures/*.svg', { query: '?raw', import: 'default', eager: true });
  cache = Object.entries(files)
    .map(([path, text]) => buildFigure(path.split('/').pop().replace(/\.svg$/i, ''), parseSvg(text)))
    .filter((f) => f && f.nodes.length >= 2)
    .sort((a, b) => a.name.localeCompare(b.name));
  return cache;
}
