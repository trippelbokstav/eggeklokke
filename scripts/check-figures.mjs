// Check the connect-the-dots figures in src/figures/: points, order and spacing.
// Run: node scripts/check-figures.mjs
import { readdirSync, readFileSync } from 'node:fs';
import { parseSvg, buildFigure, spacing } from '../src/figures.js';

const dir = new URL('../src/figures/', import.meta.url);
const MIN = 0.06; // points closer than this (fraction of the figure's longest side) are hard to tell apart
let bad = 0;
for (const file of readdirSync(dir).filter((f) => f.endsWith('.svg')).sort()) {
  const fig = buildFigure(file.replace(/\.svg$/, ''), parseSvg(readFileSync(new URL(file, dir), 'utf8')));
  if (!fig) { console.log(`✗ ${file}: no points found`); bad++; continue; }
  const s = spacing(fig);
  const strokes = fig.nodes.filter((n) => !n.line).length;
  const lifts = strokes - 1; // pen lifts = holes in the figure (fine, but use them rarely)
  const lines = fig.nodes.filter((n) => n.line).length + fig.closes.length;
  const warn = s.any < MIN ? `  ⚠ two points only ${s.any.toFixed(3)} apart (min ${MIN})` : '';
  if (warn) bad++;
  const hole = lifts ? `  ✎ ${lifts} pen lift(s) = hole(s)` : '  connected';
  console.log(`${warn ? '✗' : '✓'} ${fig.name}: ${fig.nodes.length} points, ${lines} lines, ${fig.closes.length} closed, ${fig.w.toFixed(2)}×${fig.h.toFixed(2)}${hole}${warn}`);
}
process.exit(bad ? 1 : 0);
