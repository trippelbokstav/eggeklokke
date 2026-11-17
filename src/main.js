// Eggklokke 2: the clock is painted on an egg you can roll around while it boils
import { loadParams } from './params.js';
import { createWorld } from './world.js';
import { createInput } from './input.js';
import { createGame } from './game.js';
import { haptic, hapticDiag } from './native.js';
import { sound, unlockAudio } from './sound.js';
import { createYolk, YOLK_STATES } from './yolk.js';
import { createTerrain } from './terrain.js';
import { totalSeconds, fmt, boilTemp, altFactor, NAMES, SIZENAMES } from './timer.js';

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
let sizeKey = 'm';
const currentTotal = () => totalSeconds(doneKey, sizeKey, +altEl.value);

// Yolk: picked with − and + around a morphing yolk (soft / smiling / hard)
const DONE_NAME = { soft: 'Bløtkokt', smile: 'Smilende', hard: 'Hardkokt' };
let doneKey = 'smile';
const yolk = createYolk($('yolkCanvas'), P);
function setDone(k) {
  doneKey = k;
  yolk.set(k);
  $('yolkName').textContent = DONE_NAME[k];
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

// Altitude: a terrain line grows out of the slider track as you drag
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
  if (!running && !done) tipEl.textContent = 'Trykk Start, så våkner egget.';
  else tipEl.textContent = input.gyroActive ? 'Vipp telefonen for å rulle egget.' : 'Dra på skjermen for å rulle egget.';
}

function refreshIdle() {
  const h = +altEl.value;
  altOut.textContent = h + ' m';
  const extra = Math.round((altFactor(h) - 1) * 100);
  altNote.textContent = 'Koker ved ' + boilTemp(h).toFixed(1).replace('.', ',') + ' °C' + (extra > 0 ? ' · ' + extra + ' % lengre tid' : '');
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
  subEl.textContent = NAMES[doneKey].charAt(0).toUpperCase() + NAMES[doneKey].slice(1) + ', ' + SIZENAMES[sizeKey] + ' egg';
  sound.beep();
  haptic.press();
  input.touch();
  input.recalibrate(); // "flat" = how you hold the phone when you press Start
  if (world) { world.setFit(1); world.setPosed(false); }
  if (game && P.gameOn) game.start();
  scoreEl.className = 'score';
  scoreEl.textContent = '';
  updateTip();
  try {
    if (navigator.wakeLock) navigator.wakeLock.request('screen').then((w) => { wake = w; }).catch(() => {});
  } catch (e) { /* ignore */ }
}

function finish() {
  running = false;
  done = true;
  document.body.classList.add('done');
  subEl.textContent = 'Egget er ferdig! Ta det opp og skyll i kaldt vann.';
  goBtn.hidden = false;
  goBtn.textContent = 'Stopp alarmen';
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
    const parts = [`${st.eggs} egg`];
    if (st.bonus > 0) parts.push(`+ ${st.bonus} bonus`);
    if (st.penalties > 0) parts.push(`− ${st.penalties} dult`);
    scoreEl.textContent = parts.length > 1 ? `${parts.join(' ')} = ${st.total}` : `${st.eggs} egg samlet`;
  }
}

function reset() {
  running = false;
  done = false;
  try { if (wake) wake.release(); } catch (e) { /* ignore */ }
  wake = null;
  document.body.classList.remove('running', 'done');
  goBtn.hidden = false;
  goBtn.textContent = 'Start';
  goBtn.classList.remove('alarm');
  resetBtn.hidden = true;
  subEl.textContent = 'Start klokka når egget går ned i kokende vann.';
  if (game) game.stop();
  scoreEl.className = 'score';
  scoreEl.textContent = '';
  if (world) world.setPosed(true);
  if (world) placeSizer();
  updateTip();
  refreshIdle();
}

goBtn.addEventListener('click', () => {
  if (done) { haptic.press(); reset(); } else if (!running) start();
});
resetBtn.addEventListener('click', () => { haptic.press(); reset(); });
altEl.addEventListener('input', refreshIdle);

refreshIdle();
updateTip();

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

// Intro: keep the title up for 2 seconds from page start (the 3D loaded behind it), then let the app in
setTimeout(() => {
  $('splash').classList.add('gone');
  placeSizer();
  document.body.classList.remove('intro');
  setTimeout(() => $('splash').remove(), 800);
}, Math.max(0, 2000 - performance.now()));

// ---------- Size picker: − egg + ----------
const sizer = $('sizer');
const sizeDown = $('sizeDown');
const sizeUp = $('sizeUp');
const sizeScale = (k) => (k === 's' ? P.sizeSmall : k === 'l' ? P.sizeLarge : 1);
function setSize(k, force = false) {
  sizeKey = k;
  const name = SIZENAMES[k];
  $('sizeName').textContent = name.charAt(0).toUpperCase() + name.slice(1) + ' egg';
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
  // Fit: the largest egg must fit between the altitude (top) and the yolk (bottom), with its name above it
  let p = world.poseScreen();
  const top = document.querySelector('header').getBoundingClientRect().bottom;
  const bottom = $('panel').getBoundingClientRect().top - 20; // the floating yolk reaches up a bit
  const halfL = P.eggLength * P.sizeLarge / 2 * p.ppu;
  const room = Math.min(p.y - top - 52, bottom - p.y - 6); // room above for the name and some air under the slider
  world.setFit(Math.max(0.3, Math.min(1, room / halfL)) || 1);
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
  sizer.style.setProperty('--label-y', (eggTop - r.top - 30) + 'px');
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
setSize(sizeKey);
// Debugging in the console: __egg.skip(330) jumps 330 seconds ahead
window.__egg = { ...world.debug, world, P, game, yolk, skip(s) { if (running) endAt -= s * 1000; } };

function applyTheme() {
  theme = { alert: cssVar('--alert') || '#C2410C', bg: cssVar('--bg') || '#E3ECEF' };
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
      yolk,
      terrain
    });
    lab.open();
    return;
  }
  lab.show(lab._hidden);
}
$('labBtn').addEventListener('click', toggleLab);
if (isLab) toggleLab();

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
      scoreEl.textContent = st.eggs === 0 && st.penalties === 0 ? '' : (st.streak > 1 ? `🥚 ${st.total}  ·  rekke ×${st.streak}` : `🥚 ${st.total}`);
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
