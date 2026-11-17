// Eggklokke 2: the clock is painted on an egg you can roll around while it boils
import { loadParams } from './params.js';
import { createWorld } from './world.js';
import { fontReady } from './eggTexture.js';
import { createInput } from './input.js';
import { createGame } from './game.js';
import { haptic, hapticDiag } from './native.js';
import { sound, unlockAudio } from './sound.js';
import { createYolk, YOLK_STATES } from './yolk.js';
import { createTerrain } from './terrain.js';
import { totalSeconds, fmt, boilTemp, altFactor, setCustom } from './timer.js';
import { setLang, t, num } from './i18n.js';
import { loadSettings, saveSettings, createSettingsSheet } from './settings.js';

const $ = (id) => document.getElementById(id);
const stage = $('stage');
const subEl = $('sub');
const tipEl = $('tip');
const srTime = $('srTime');
const goBtn = $('go');
const resetBtn = $('reset');
const altEl = $('alt');
const altOut = $('altOut');
const altNote = $('altNote');
const scoreEl = $('score');

// All tunable values live in params.js. The ⚙︎ button (or ?lab) opens the lab to edit them live.
// Values tuned in the lab are saved in this browser and used every time.
const isLab = new URLSearchParams(location.search).has('lab');
const P = loadParams(true);

// Settings saved on this phone: look, language, my own times + home altitude, last size and yolk
const S = loadSettings();
setLang(S.lang);
setCustom(S);
function applyThemeAttr() {
  if (S.theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = S.theme;
}
applyThemeAttr();

// ---------- Small color helpers ----------
const hexToRgb = (h) => {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgbToHex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex(A.map((v, i) => v + (B[i] - v) * t));
};
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// Outline color along the boil: 0 = white, 0.5 = yellow, 1 = red
const edgeColor = (p) => (p < 0.5 ? mix(P.outlineStart, P.outlineMid, p * 2) : mix(P.outlineMid, P.outlineEnd, (p - 0.5) * 2));

// Egg size: picked with − and + around the big egg (the egg itself grows)
const SIZES = ['s', 'm', 'l'];
let sizeKey = ['s', 'm', 'l'].includes(S.size) ? S.size : 'm';
const currentTotal = () => totalSeconds(doneKey, sizeKey, +altEl.value);

// Yolk: picked with − and + around a morphing yolk (soft / smiling / hard)
let doneKey = YOLK_STATES.includes(S.done) ? S.done : 'smile';
const yolk = createYolk($('yolkCanvas'), P);
function setDone(k, save = true) {
  doneKey = k;
  yolk.set(k);
  $('yolkName').textContent = t(k);
  if (save && S.done !== k) { S.done = k; saveSettings(S); }
  $('yolkDown').disabled = k === 'soft';
  $('yolkUp').disabled = k === 'hard';
}
function stepDone(dir) {
  const i = YOLK_STATES.indexOf(doneKey) + dir;
  if (i < 0 || i >= YOLK_STATES.length) return;
  haptic.select();
  setDone(YOLK_STATES[i]);
  refreshIdle();
}
$('yolkDown').addEventListener('click', () => stepDone(-1));
$('yolkUp').addEventListener('click', () => stepDone(1));
setDone(doneKey);

// Altitude: starts at the altitude where you live (My values). A terrain line grows out of the slider track.
altEl.value = S.home;
const terrain = createTerrain($('terrain'), altEl, P);

// ---------- State ----------
let running = false;
let done = false;
let endAt = 0;
let total = 0;
let lastSec = null;
let alarmStart = 0;
let lastAlarm = 0;
let wake = null;
let centerMode = false;
const tiltNow = { x: 0, z: 0 };
let edgeNow = null; // outline color as float rgb, eased every frame
let theme = {};
let lastPaint = 0;
let lastText = '';

const input = createInput(stage, P);

// The first tap unlocks sound. Gyro access must be asked from a real "click" (iOS ignores
// pointerdown for this), so ask on clicks until it is granted (Start is a click too).
let unlocked = false;
function unlock() {
  if (!unlocked) {
    unlocked = true;
    unlockAudio();
  }
  askGyro();
}
let gyroAsked = false;
function askGyro() {
  const state = input.diag.permission;
  if (gyroAsked && state !== 'denied' && !String(state).startsWith('feil')) return;
  gyroAsked = true;
  input.requestPermission().then(updateTip);
}
document.addEventListener('pointerdown', () => { if (!unlocked) { unlocked = true; unlockAudio(); } }, { capture: true });
document.addEventListener('click', askGyro, { capture: true });

function updateTip() {
  if (!running && !done) tipEl.textContent = t('tipStart');
  else tipEl.textContent = input.gyroActive ? t('tipTilt') : t('tipDrag');
}

// Score: the number big in the display font, a line under it in the text font
let shownScore = '';
function showScore(n, line = '') {
  const key = n === null ? '' : n + '|' + line;
  if (key === shownScore) return;
  shownScore = key;
  scoreEl.innerHTML = '';
  if (n === null) return;
  const big = document.createElement('span');
  big.className = 'score-num';
  big.textContent = n;
  scoreEl.appendChild(big);
  if (line) {
    const small = document.createElement('span');
    small.className = 'score-line';
    small.textContent = line;
    scoreEl.appendChild(small);
  }
}

function statusLine() { return t(doneKey) + ' · ' + t({ s: 'sizeS', m: 'sizeM', l: 'sizeL' }[sizeKey]); }

// Put every fixed text on the page in the chosen language
function applyLang() {
  const set = (sel, text) => { const el = document.querySelector(sel); if (el) el.textContent = text; };
  set('#hint', t('introSub'));
  set('.alt-label', t('altitude'));
  const es = $('eggStart');
  if (es) es.innerHTML = t('start1') + '<br>' + t('start2');
  if (!done) goBtn.textContent = t('start1'); else goBtn.textContent = t('stopAlarm');
  resetBtn.textContent = t('cancel');
  $('sizeDown').setAttribute('aria-label', t('ariaSmaller'));
  $('sizeUp').setAttribute('aria-label', t('ariaLarger'));
  $('yolkDown').setAttribute('aria-label', t('ariaSofter'));
  $('yolkUp').setAttribute('aria-label', t('ariaFirmer'));
  $('labBtn').setAttribute('aria-label', t('settings'));
  $('yolkName').textContent = t(doneKey);
  const sn = $('sizeName');
  if (sn) sn.textContent = t({ s: 'sizeS', m: 'sizeM', l: 'sizeL' }[sizeKey]);
  subEl.textContent = running ? statusLine() : done ? t('doneMsg') : t('introSub');
  refreshIdle();
  updateTip();
}

function refreshIdle() {
  const h = +altEl.value;
  altOut.textContent = h + ' m';
  const extra = Math.round((altFactor(h) - 1) * 100);
  altNote.textContent = t('boilsAt', { t: num(boilTemp(h)) }) + (extra > 0 ? ' · ' + t('longer', { p: extra }) : '');
}

// Altitude heading: the label at 0 m, only the number while dragging, the info slides in when you let go
const altHead = $('altHead');
altEl.addEventListener('input', () => { altHead.dataset.state = +altEl.value > 0 ? 'drag' : 'zero'; });
altEl.addEventListener('change', () => { altHead.dataset.state = +altEl.value > 0 ? 'rest' : 'zero'; });

function start() {
  unlock();
  total = currentTotal();
  endAt = Date.now() + total * 1000;
  lastSec = null;
  running = true;
  done = false;
  document.body.classList.add('running');
  goBtn.hidden = true;
  resetBtn.hidden = false;
  subEl.textContent = statusLine();
  sound.beep();
  haptic.press();
  input.touch();
  input.recalibrate(); // "flat" = how you hold the phone when you press Start
  if (world) { world.setFit(1); world.setPosed(false); }
  if (game && P.gameOn) game.start();
  scoreEl.className = 'score';
  showScore(null);
  updateTip();
  try {
    if (navigator.wakeLock) navigator.wakeLock.request('screen').then((w) => { wake = w; }).catch(() => {});
  } catch (e) { /* ignore */ }
}

function finish() {
  running = false;
  done = true;
  document.body.classList.add('done');
  subEl.textContent = t('doneMsg');
  goBtn.hidden = false;
  goBtn.textContent = t('stopAlarm');
  goBtn.classList.add('alarm');
  resetBtn.hidden = true;
  alarmStart = performance.now();
  lastAlarm = 0;
  centerMode = false;
  // The game ends: the egg rolls back to the start position, and we show the score
  const played = game && game.active;
  if (game) game.stop();
  world.setPosed(true, 3);
  if (played) {
    const st = game.stats(performance.now());
    scoreEl.className = 'score final';
    // Big total, and the breakdown under it: "5 eggs collected · + 3 bonus · − 1 bumps"
    const parts = [t('collected', { n: st.eggs })];
    if (st.bonus > 0) parts.push(`+ ${st.bonus} ${t('bonus')}`);
    if (st.penalties > 0) parts.push(`− ${st.penalties} ${t('bumps')}`);
    showScore(st.total, parts.join('  ·  '));
  }
}

function reset() {
  running = false;
  done = false;
  try { if (wake) wake.release(); } catch (e) { /* ignore */ }
  wake = null;
  document.body.classList.remove('running', 'done');
  goBtn.hidden = false;
  goBtn.textContent = t('start1');
  goBtn.classList.remove('alarm');
  resetBtn.hidden = true;
  subEl.textContent = t('introSub');
  if (game) game.stop();
  scoreEl.className = 'score';
  showScore(null);
  if (world) world.setPosed(true);
  if (world) placeSizer();
  updateTip();
  refreshIdle();
}

goBtn.addEventListener('click', () => {
  if (done) { haptic.press(); reset(); } else if (!running) start();
});
resetBtn.addEventListener('click', () => { haptic.press(); reset(); });

// The egg is the start button: a tap on the resting egg starts the clock (a drag is not a tap)
let tapFrom = null;
stage.addEventListener('pointerdown', (e) => { tapFrom = { x: e.clientX, y: e.clientY }; });
stage.addEventListener('click', (e) => {
  if (running || done || !world || !tapFrom) return;
  if (e.target.closest && e.target.closest('button')) return;
  if (Math.hypot(e.clientX - tapFrom.x, e.clientY - tapFrom.y) > 12) return;
  const p = world.poseScreen();
  const ry = p.bottom - p.y;              // half length on screen
  const rx = ry * P.eggWidth / P.eggLength; // half width on screen
  const dx = (e.clientX - p.x) / rx;
  const dy = (e.clientY - p.y) / ry;
  if (dx * dx + dy * dy <= 1.1) start();
});
altEl.addEventListener('input', refreshIdle);

if (+altEl.value > 0) altHead.dataset.state = 'rest';
applyLang();

// ---------- 3D ----------
let world = null;
let game = null;
// The stage covers the whole app, so the egg rests at the vertical center of the screen
world = await createWorld($('scene'), P, stage, $('panel'));

// The little game: collect small eggs while the big one boils
game = createGame(world, P, {
  digitColor: () => theme.bg,
  onTick(urgency, red) {
    if (P.ticks) sound.tick(urgency);
    if (red) haptic.tick();
  },
  onPickup(e) {
    haptic.pickup();
    sound.pickup(e.combo);
    floatLabel(e);
  }
});

// A "+1" (or "+1 ×3" in a streak) that floats up from the small egg
function floatLabel(e) {
  const p = world.game.project(e.x, e.z);
  const el = document.createElement('div');
  el.className = e.minus ? 'float minus' : 'float';
  el.textContent = e.text || '+' + e.combo; // in a streak, each egg is worth more
  // Keep the label on screen, also when the egg is half outside the edge
  el.style.left = Math.min(innerWidth - 30, Math.max(30, p.x)) + 'px';
  el.style.top = Math.min(innerHeight - 120, Math.max(90, p.y)) + 'px';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}
stage.classList.add('ready');

// The display font (Sniglet) loads from the web: repaint the egg's time once it is there
if (document.fonts) Promise.all([document.fonts.load('800 100px Sniglet'), document.fonts.load('700 100px Comfortaa')]).then(() => { fontReady(); world.invalidate(); }).catch(() => {});

// ---------- Intro: the title, then a quick tour of the parts ----------
// The title stands for 1.5 s (the 3D loads behind it) and fades out. Then the tour shows the parts one by one,
// centered on the screen: the altitude slider runs 2500 → home, the egg pops in and steps small/medium/large,
// the yolk joins and steps hard/jammy/soft. "Start klokka" comes 3 s after everything has landed.
// A tap anywhere skips straight to the main view.
let touring = true;
let tourDone = false;
const tourTimers = [];
const wait = (ms) => new Promise((res) => tourTimers.push(setTimeout(res, ms)));
const hideEls = () => [document.querySelector('.altblock'), document.querySelector('.szlabel'), sizeDown, sizeUp, $('eggStart'), document.querySelector('.stepper'), document.querySelector('.steplabel'), $('yolkDown'), $('yolkUp')];
const showEl = (el) => el && el.classList.remove('thide');
function setTourAlt(px) { document.documentElement.style.setProperty('--tour-alt', px + 'px'); }
function setAlt(v, phase) {
  altEl.value = v;
  altEl.dispatchEvent(new Event(phase));
}

function endSplash() {
  const sp = $('splash');
  if (!sp) return;
  sp.classList.add('textout', 'gone');
  document.body.classList.remove('intro');
  setTimeout(() => sp.remove(), 700);
}

// The explanation line at the bottom: in once everything has landed, out again after 4 s
let hintShown = false;
function showHint() {
  if (hintShown) return;
  hintShown = true;
  const h = $('hint');
  h.classList.add('show');
  setTimeout(() => h.classList.remove('show'), 4000 + 700);
}

function finishTour() {
  if (tourDone) return;
  tourDone = true;
  tourTimers.forEach(clearTimeout);
  touring = false;
  endSplash();
  $('tourTitle').classList.remove('show');
  setTourAlt(0);
  world.setTourShift(0);
  world.setEggVisible(true);
  hideEls().forEach(showEl);
  setAlt(S.home, 'input');
  setAlt(S.home, 'change');
  setSize(S.size, false, false);
  setDone(S.done, false);
  placeSizer();
  document.removeEventListener('click', skipTour, true);
  showHint();
}
function skipTour(e) {
  if (tourDone) return;
  e.preventDefault();
  e.stopPropagation();
  finishTour();
}

async function runTour() {
  document.addEventListener('click', skipTour, true);
  hideEls().forEach((el) => el && el.classList.add('thide'));
  world.setEggVisible(false);
  setDone('smile', false); // the tour's own story; your yolk pops in at the end
  setAlt(2500, 'input');
  const title = $('tourTitle');
  const mid = innerHeight / 2;
  const rect = (el) => el.getBoundingClientRect();
  const alt = document.querySelector('.altblock');
  const a = rect(alt);
  const titleH = rect(title).height;
  // The title is anchored by its bottom edge (it grows upward if a web font makes it taller)
  const titleBottom = a.top - 28;
  const titleTop = titleBottom - titleH;
  const placeTitle = (bottomY) => title.style.setProperty('--tt-y', bottomY + 'px');

  // 0) The title alone, in the middle of the screen
  placeTitle(mid + titleH / 2);
  endSplash();
  title.classList.add('show');
  await wait(1300);
  if (tourDone) return;

  // 1) The altitude joins under the title, both centered. The slider runs from 2500 down to 0.
  const shift1 = mid - (titleTop + a.bottom) / 2;
  setTourAlt(shift1);
  placeTitle(titleBottom + shift1);
  showEl(alt);
  await wait(600);
  if (tourDone) return;
  // The tour always shows the same story (2500 m -> 0 m, small -> medium, soft -> jammy);
  // your own settings pop into place once everything has landed
  const from = 2500;
  const to = 0;
  const t0 = performance.now();
  await new Promise((res) => {
    const tick = (now) => {
      if (tourDone) return res();
      const k = Math.min(1, (now - t0) / 1600);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; // ease in-out
      setAlt(Math.round((from + (to - from) * e) / 50) * 50, 'input');
      if (k < 1) requestAnimationFrame(tick); else res();
    };
    requestAnimationFrame(tick);
  });
  if (tourDone) return;
  setAlt(to, 'change');
  await wait(600);
  if (tourDone) return;

  // 2) The egg joins: title, altitude and egg centered together (the title glides up). Small, then your size.
  const p = world.poseScreen();
  const shift2 = mid - (titleTop + p.bottom) / 2;
  // The medium egg is taller than the small one it starts as: give the altitude block room for it
  const half = p.bottom - p.y;
  const extra = Math.max(0, half * (sizeScale('m') / sizeScale(sizeKey) - 1)) + 10;
  setTourAlt(shift2 - extra);
  placeTitle(titleBottom + shift2 - extra);
  world.setTourShift(shift2);
  await wait(350); // the blocks move first, then the egg pops in
  if (tourDone) return;
  setSize('s', false, false);
  world.snapToPose();
  world.setEggVisible(true);
  world.popIn();
  placeSizer();
  showEl(document.querySelector('.szlabel'));
  await wait(900);
  if (tourDone) return;
  setSize('m', false, false);
  await wait(900);
  if (tourDone) return;

  // 3) The yolk joins: everything in its normal place, the title glides out and fades. Soft, then your yolk.
  setTourAlt(0);
  world.setTourShift(0);
  placeTitle(titleBottom - 140);
  title.classList.remove('show');
  placeSizer();
  setDone('soft', false);
  showEl(document.querySelector('.steplabel'));
  showEl(document.querySelector('.stepper'));
  await wait(1000);
  if (tourDone) return;
  setDone('smile', false);
  await wait(900);
  if (tourDone) return;
  // All the − + come in together, at the very end
  [sizeDown, sizeUp, $('yolkDown'), $('yolkUp')].forEach(showEl);
  await wait(400);
  if (tourDone) return;
  touring = false;
  // Everything has landed: your own settings pop into place
  setAlt(S.home, 'input');
  setAlt(S.home, 'change');
  setSize(S.size, false, false);
  setDone(S.done, false);
  placeSizer();
  showHint();
  // 4) "Start klokka" 3 s after everything has landed
  await wait(3000);
  if (tourDone) return;
  showEl($('eggStart'));
  tourDone = true;
  document.removeEventListener('click', skipTour, true);
}

// ---------- Size picker: − egg + ----------
const sizer = $('sizer');
const sizeDown = $('sizeDown');
const sizeUp = $('sizeUp');
const SIZE_KEY = { s: 'sizeS', m: 'sizeM', l: 'sizeL' };
const sizeScale = (k) => (k === 's' ? P.sizeSmall : k === 'l' ? P.sizeLarge : 1);
function setSize(k, force = false, save = true) {
  sizeKey = k;
  $('sizeName').textContent = t(SIZE_KEY[k]);
  if (save && S.size !== k) { S.size = k; saveSettings(S); }
  sizeDown.disabled = k === 's';
  sizeUp.disabled = k === 'l';
  world.setSize(sizeScale(k), force);
  placeSizer();
  refreshIdle();
}
// Put the buttons beside the resting egg and the name under it (in stage pixels)
function placeSizer() {
  world.relayout(); // make sure the resting spot matches the layout right now
  const r = stage.getBoundingClientRect();
  // Fit: sized from the free space in the base layout (between the altitude block and the yolk row),
  // NOT from where things are moved to. The lab's Plassering/Tekst offsets only move things; they never resize the egg.
  let p = world.poseScreen();
  const top = document.querySelector('header').getBoundingClientRect().bottom; // layout boxes: not moved by the offsets
  const bottom = $('panel').getBoundingClientRect().top;
  const halfL = P.eggLength * P.sizeLarge / 2 * p.ppu;
  const room = (bottom - top) / 2 - 66; // half the free space, minus room for the name above the egg
  world.setFit(Math.max(0.3, Math.min(1, room / halfL)) || 1);
  // Lift as asked, but never so high that the egg's name runs into the altitude block (then it sits lower)
  // (Not during the intro tour: the blocks are moved around then, the cut from the real layout stays.)
  if (!touring) {
    world.setLiftCut(0);
    p = world.poseScreen();
    const nameTop = (2 * p.y - p.bottom) - 30 + P.txtEgg;
    const altBottom = document.querySelector('.altblock').getBoundingClientRect().bottom + 6;
    if (nameTop < altBottom) { world.setLiftCut(altBottom - nameTop); p = world.poseScreen(); }
  }
  p = world.poseScreen();
  const fit = (p.bottom - p.y) / (P.eggLength * sizeScale(sizeKey) / 2 * p.ppu);
  const half = P.eggWidth * P.sizeLarge / 2 * fit * p.ppu; // half width of a large egg, in pixels
  // Same column as the yolk row and the altitude: button centers at half the row width minus half a button
  const rowW = Math.min(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--row-w')) || 298, r.width);
  const gap = Math.max(half + 30, rowW / 2 - 26);
  sizer.style.setProperty('--egg-y', (p.y - r.top) + 'px');
  sizer.style.setProperty('--minus-x', (p.x - r.left - gap) + 'px');
  sizer.style.setProperty('--plus-x', (p.x - r.left + gap) + 'px');
  const eggTop = 2 * p.y - p.bottom; // the egg is symmetric around its middle
  sizer.style.setProperty('--label-y', (eggTop - r.top - 30 + P.txtEgg) + 'px');
  // "Start klokka" under the time painted on the egg (the time sits at the egg's middle)
  sizer.style.setProperty('--start-y', (p.y - r.top + (p.bottom - p.y) * 0.36 + P.txtStart) + 'px');
}
function stepSize(dir) {
  const i = SIZES.indexOf(sizeKey) + dir;
  if (i < 0 || i >= SIZES.length) return;
  haptic.select();
  setSize(SIZES[i]);
}
sizeDown.addEventListener('click', () => stepSize(-1));
sizeUp.addEventListener('click', () => stepSize(1));
const sizerRO = new ResizeObserver(() => requestAnimationFrame(placeSizer));
[stage, document.querySelector('header'), $('panel')].forEach((el) => sizerRO.observe(el));
sizer.hidden = false;

// Placement and text offsets from the lab (Plassering / Tekst), as CSS variables
function applyLayout() {
  const root = document.documentElement.style;
  root.setProperty('--pos-alt', P.posAlt + 'px');
  root.setProperty('--alt-w', P.altWidth + 'px');
  root.setProperty('--pos-yolk', P.posYolk + 'px');
  root.setProperty('--pos-start', P.posStart + 'px');
  root.setProperty('--txt-alt', P.txtAlt + 'px');
  root.setProperty('--txt-yolk', P.txtYolk + 'px');
  placeSizer();
}
applyLayout();
setSize(sizeKey);
runTour();
// Debugging in the console: __egg.skip(330) jumps 330 seconds ahead
window.__egg = { ...world.debug, world, P, game, yolk, skip(s) { if (running) endAt -= s * 1000; } };

function applyTheme() {
  theme = { alert: cssVar('--alert') || '#C2410C', bg: cssVar('--bg') || '#E3ECEF' };
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme.bg;
  world.setShadowColor(cssVar('--ink'));
  terrain.setColor(cssVar('--muted'));
  world.game.setDotColors(P.digitColor, P.lineColor);
}
applyTheme();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

let lastBumpAt = 0;
world.onBump((s) => {
  const t = performance.now();
  if (t - lastBumpAt < 150) return; // one bump at a time, not one per physics step
  lastBumpAt = t;
  haptic.bump(s);
  sound.bump(s);
  // Minus points for bumping into the walls while playing
  if (game && game.active) {
    const lost = game.bump(t);
    if (lost > 0) {
      const e = world.eggPos();
      floatLabel({ x: e.x, z: e.z, text: '−' + lost, minus: true });
    }
  }
});

// Lab: the ⚙︎ button toggles it (?lab opens it at start)
let lab = null;
async function toggleLab() {
  if (!lab) {
    const m = await import('./lab.js');
    lab = m.createLab(P, world, {
      haptics: hapticDiag,
      gyro: input.diag,
      testHaptic() { haptic.alarm(); },
      testLight() { haptic.test('light'); },
      testMedium() { haptic.test('medium'); },
      testHeavy() { haptic.test('heavy'); },
      testPickup() { haptic.pickup(); },
      askGyro() { input.requestPermission().then(updateTip); },
      calibrate() { input.recalibrate(); haptic.press(); },
      resize() { setSize(sizeKey, true); },
      layout() { applyLayout(); },
      yolk,
      terrain
    });
    lab.open();
    return;
  }
  lab.show(lab._hidden);
}
if (isLab) toggleLab();

// ---------- Settings (⋯ in the corner) ----------
const settingsSheet = createSettingsSheet(S, (what) => {
  if (what === 'theme') { applyThemeAttr(); applyTheme(); }
  if (what === 'lang') { setLang(S.lang); applyLang(); }
  if (what === 'times' || what === 'home') setCustom(S);
  if (what === 'home' && !running && !done) { altEl.value = S.home; altEl.dispatchEvent(new Event('input')); altEl.dispatchEvent(new Event('change')); }
  refreshIdle();
}, toggleLab);
$('labBtn').addEventListener('click', () => settingsSheet.open());

// FPS meter: add ?fps to the address
const fpsEl = new URLSearchParams(location.search).has('fps') ? document.createElement('div') : null;
if (fpsEl) {
  fpsEl.className = 'fps';
  document.body.appendChild(fpsEl);
  setInterval(() => {
    fpsEl.textContent = `${world.stats.fps} fps · tegner ${world.stats.draws}/s · fysikk ${world.stats.physicsMs.toFixed(1)} ms`;
  }, 500);
}

world.start((dt, now) => {
  // ---- Tilt, or glide home to the zero position when nobody plays ----
  const idle = running && input.idleFor() > P.idleSec * 1000;
  if (idle && !centerMode) { centerMode = true; input.recalibrate(true); world.setPosed(true, P.homeSpeed); }
  if (!idle && centerMode) { centerMode = false; if (running) world.setPosed(false); }
  const want = centerMode ? { x: 0, z: 0 } : input.tilt();
  const k = 1 - Math.exp(-dt / Math.max(0.01, P.gyroSmooth)); // smoothing time in seconds
  tiltNow.x += (want.x - tiltNow.x) * k;
  tiltNow.z += (want.z - tiltNow.z) * k;
  world.setTilt(tiltNow.x, tiltNow.z);

  // ---- Time ----
  let text;
  let pulse = 0;
  let edgeTarget = P.lineColor; // outline color: light blue while setting the timer
  if (running) {
    const remaining = (endAt - Date.now()) / 1000;
    const sec = Math.ceil(remaining);
    text = fmt(remaining);
    if (sec !== lastSec) {
      const prev = lastSec;
      lastSec = sec;
      if (prev !== null && sec > 0) {
        if (sec <= 10) { sound.beep(); haptic.tick(); } else if (sec % 30 === 0) sound.beep();
      }
    }
    // The outline steps every 30 seconds: white -> yellow -> red
    const elapsed = total - Math.max(0, remaining);
    const steps = Math.max(1, Math.floor(total / 30));
    edgeTarget = edgeColor(Math.min(1, Math.floor(elapsed / 30) / steps));
    // The outline swells a little on each 30-second beep, and every second at the end
    const f = sec - remaining; // 0 right after a tick
    if (remaining <= 10) pulse = P.pulse * Math.exp(-f * 5);
    else if (sec % 30 === 0) pulse = P.pulse * 0.4 * Math.exp(-f * 4);
    if (game.active) {
      game.update(now);
      const st = game.stats(now);
      if (st.eggs === 0 && st.penalties === 0) showScore(null);
      else showScore(st.total, st.streak > 1 ? `${t('streak')} ×${st.streak}` : '');
    }
    if (remaining <= 0) finish();
  } else if (done) {
    text = '0:00';
    edgeTarget = P.outlineEnd;
    pulse = P.pulse * (0.6 + 0.4 * Math.sin(now * 0.01));
    if (now - lastAlarm > 1200) {
      lastAlarm = now;
      sound.alarm();
      haptic.alarm();
    }
    if (now - alarmStart > 90000) reset();
  } else {
    text = fmt(currentTotal());
  }

  // Ease the outline color to its new step (a soft change, not a jump)
  const target = hexToRgb(edgeTarget);
  if (!edgeNow) edgeNow = target.slice();
  const e = 1 - Math.exp(-dt * 4);
  edgeNow = edgeNow.map((v, i) => v + (target[i] - v) * e);
  world.setOutline(rgbToHex(edgeNow), pulse);

  // The egg itself keeps its color. Repaint the shell when the time or the look changes.
  const shellHex = P.matchBackground ? theme.bg : P.colorStart;
  if (text !== lastText || now - lastPaint > 100) {
    lastPaint = now;
    world.paint(text, {
      shell: shellHex,
      dot: mix(shellHex, P.lineColor, P.dotStrength),
      digit: P.digitColor
    }, P);
  }
  if (text !== lastText) {
    lastText = text;
    srTime.textContent = text;
  }
});
