// Eggklokke 2: the clock is painted on an egg you can roll around while it boils
import { createWorld } from './world.js';
import { createInput } from './input.js';
import { haptic } from './native.js';
import { sound, unlockAudio } from './sound.js';
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

const IDLE_MS = 10000;           // roll back to the middle after this long without play
const SHELL_START = '#FBF6EC';   // fresh egg
const SHELL_END = '#F6D79C';     // done egg (the shell warms up step by step)

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

const val = (name) => document.querySelector(`input[name="${name}"]:checked`).value;
const currentTotal = () => totalSeconds(val('d'), val('s'), +altEl.value);

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
let shellNow = hexToRgb(SHELL_START); // float rgb, eased every frame
let theme = {};
let lastPaint = 0;
let lastText = '';

const input = createInput(stage);

// The first tap anywhere unlocks sound and asks for gyro access (iOS rules)
let unlocked = false;
function unlock() {
  if (unlocked) return;
  unlocked = true;
  unlockAudio();
  input.requestPermission().then(updateTip);
}
document.addEventListener('pointerdown', unlock, { capture: true });

function updateTip() {
  tipEl.textContent = input.gyroActive
    ? 'Vipp telefonen for å rulle egget.'
    : 'Dra i panna for å rulle egget.';
}

function refreshIdle() {
  const h = +altEl.value;
  altOut.textContent = h + ' m';
  altNote.textContent = h < 100
    ? 'Vannet koker ved 100 °C.'
    : 'Vannet koker ved ca. ' + boilTemp(h).toFixed(1).replace('.', ',') + ' °C, så egget trenger ca. ' +
      Math.round((altFactor(h) - 1) * 100) + ' % lengre tid.';
}

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
  subEl.textContent = NAMES[val('d')].charAt(0).toUpperCase() + NAMES[val('d')].slice(1) + ', ' + SIZENAMES[val('s')] + ' egg';
  sound.beep();
  haptic.press();
  input.touch();
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
  refreshIdle();
}

goBtn.addEventListener('click', () => {
  if (done) { haptic.press(); reset(); } else if (!running) start();
});
resetBtn.addEventListener('click', () => { haptic.press(); reset(); });
document.querySelectorAll('input[name="d"], input[name="s"]').forEach((el) =>
  el.addEventListener('change', () => { haptic.select(); refreshIdle(); }));
altEl.addEventListener('input', refreshIdle);

refreshIdle();
updateTip();

// ---------- 3D ----------
const world = await createWorld(stage);
stage.classList.add('ready');
// Debugging in the console: __egg.skip(330) jumps 330 seconds ahead
window.__egg = { ...world.debug, world, skip(s) { if (running) endAt -= s * 1000; } };

function applyTheme() {
  theme = { yolk: cssVar('--yolk'), yolkInk: cssVar('--yolk-ink'), alert: cssVar('--alert') || '#C2410C' };
  world.setTheme({ dish: cssVar('--track'), lip: cssVar('--line'), line: cssVar('--ink'), shadow: cssVar('--ink') });
}
applyTheme();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

world.onBump((s) => {
  haptic.bump(s);
  sound.bump(s);
});

world.start((dt, now) => {
  // ---- Tilt, or roll back to the middle when nobody plays ----
  const idle = input.idleFor() > IDLE_MS;
  if (idle && !centerMode) { centerMode = true; input.recalibrate(); }
  if (!idle && centerMode) centerMode = false;
  const want = centerMode ? { x: 0, z: 0 } : input.tilt();
  const k = 1 - Math.exp(-dt * 10);
  tiltNow.x += (want.x - tiltNow.x) * k;
  tiltNow.z += (want.z - tiltNow.z) * k;
  world.setTilt(tiltNow.x, tiltNow.z);
  world.setCenterPull(centerMode);

  // ---- Time ----
  let text;
  let glow = 0;
  let shellTarget = SHELL_START;
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
    // The shell warms up one small step every 30 seconds
    const elapsed = total - Math.max(0, remaining);
    const steps = Math.max(1, Math.floor(total / 30));
    shellTarget = mix(SHELL_START, SHELL_END, Math.min(1, Math.floor(elapsed / 30) / steps));
    // A soft flash on each 30-second beep, a clear pulse every second at the end
    const f = sec - remaining; // 0 right after a tick
    if (remaining <= 10) glow = 0.55 * Math.exp(-f * 5);
    else if (sec % 30 === 0) glow = 0.22 * Math.exp(-f * 4);
    if (remaining <= 0) finish();
  } else if (done) {
    text = '0:00';
    shellTarget = SHELL_END;
    glow = 0.35 + 0.25 * Math.sin(now * 0.01);
    if (now - lastAlarm > 1200) {
      lastAlarm = now;
      sound.alarm();
      haptic.alarm();
      world.jump(0.8);
    }
    if (now - alarmStart > 90000) reset();
  } else {
    text = fmt(currentTotal());
  }

  // Ease the shell color towards its target
  const target = hexToRgb(shellTarget);
  const e = 1 - Math.exp(-dt * 3);
  shellNow = shellNow.map((v, i) => v + (target[i] - v) * e);
  const shellHex = rgbToHex(shellNow);
  world.setGlow(theme.alert, glow);

  // Repaint the shell at most 10 times a second
  if (text !== lastText || now - lastPaint > 100) {
    lastPaint = now;
    world.paint(text, {
      shell: shellHex,
      dot: mix(shellHex, '#14303B', 0.13),
      band: done ? theme.alert : theme.yolk,
      ink: done ? '#FFFFFF' : theme.yolkInk
    });
  }
  if (text !== lastText) {
    lastText = text;
    srTime.textContent = text;
  }
});
