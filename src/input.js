// Tilt input: gyro (phone tilt) and finger/mouse drag. Both give a tilt of -1..1 on x and z.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const rad = (d) => (d * Math.PI) / 180;

// The "up" direction seen from the phone (screen x = right, y = up, z = out of the screen),
// from the orientation angles. This is what a real ball on the screen feels, and it works the
// same however you hold the phone (raw beta/gamma get very insensitive when the phone is upright).
function upVector(beta, gamma) {
  const b = rad(beta);
  const g = rad(gamma);
  return { x: -Math.cos(b) * Math.sin(g), y: Math.sin(b), z: Math.cos(b) * Math.cos(g) };
}

// Two angles from the up vector, in degrees:
// side = how far the screen leans left/right (also when you turn it like a steering wheel),
// pitch = how far the screen leans back from flat (0 = lying flat, 90 = upright).
// Both change one degree per degree of tilt, however you hold the phone.
const deg = (r) => (r * 180) / Math.PI;
function angles(u) {
  return { side: deg(Math.asin(clamp(u.x, -1, 1))), pitch: deg(Math.atan2(u.y, u.z)) };
}
const wrap = (d) => ((d + 540) % 360) - 180;
const FLAT = { side: 0, pitch: 0 }; // screen level, facing up

// Degrees of tilt -> -1..1, with a dead zone in the middle and full effect at `range` degrees
function shape(d, range, dead) {
  const a = Math.abs(d);
  if (a <= dead) return 0;
  return clamp(Math.sign(d) * (a - dead) / Math.max(1, range - dead), -1, 1);
}

// P: params (gyroRange, gyroDead are read live, so the lab can change them)
export function createInput(stage, P) {
  let up = null;            // current tilt angles { side, pitch } (see angles)
  let base = null;          // the angles when the phone is held "flat" (how you hold it)
  let anchor = null;        // angles at the last real movement (for "is anyone playing?")
  // After the egg went home: ignore the gyro until the phone has moved and is held still again,
  // then make that the new "flat". (So picking the phone up from the table doesn't fling the egg.)
  const settle = { on: false, moved: false, firstMove: 0 };
  let gyroActive = false;
  let lastInteract = performance.now();

  const gyro = { x: 0, z: 0 };

  // What the gyro has done, for the Diagnose folder in the lab
  const diag = {
    api: window.DeviceOrientationEvent ? 'finnes' : 'MANGLER',
    askApi: (window.DeviceOrientationEvent && typeof window.DeviceOrientationEvent.requestPermission === 'function') ? 'finnes' : 'finnes ikke',
    permission: 'ikke spurt',
    events: 0,
    beta: '-',
    gamma: '-',
    tiltX: '-',
    tiltZ: '-'
  };
  const drag = { x: 0, z: 0, active: false, sx: 0, sy: 0 };

  function touch() { lastInteract = performance.now(); }

  function onOrientation(e) {
    diag.events++;
    if (e.beta == null || e.gamma == null) return;
    diag.beta = e.beta.toFixed(1);
    diag.gamma = e.gamma.toFixed(1);
    up = angles(upVector(e.beta, e.gamma));
    const now = performance.now();
    if (!gyroActive) {
      gyroActive = true;
      base = up;
      anchor = up;
    }
    // Absolute mode: "flat" = the screen is level (at right angles to gravity), like a marble in a tray
    if (P.gyroAbsolute) { base = FLAT; settle.on = false; }
    // Interaction = the angle CHANGES. A phone lying on a table (or held dead still) is not playing,
    // however tilted it is. Hands always move a little more than stillDeg; a table doesn't.
    const moved = Math.max(Math.abs(up.side - anchor.side), Math.abs(wrap(up.pitch - anchor.pitch))) > P.stillDeg;
    if (moved) {
      anchor = up;
      touch();
      if (settle.on && !settle.moved) { settle.moved = true; settle.firstMove = now; }
    }
    if (settle.on) {
      // Give the pick-up 0.7 s, then take the angle you hold as the new "flat". (Waiting for the hand
      // to be completely still never happened: a hand always moves a little, so the game froze.)
      gyro.x = 0;
      gyro.z = 0;
      if (settle.moved && now - settle.firstMove > 700) { base = up; anchor = up; settle.on = false; }
      diag.tiltX = 'venter';
      diag.tiltZ = 'venter';
      return;
    }
    // Right side down -> side falls -> roll right. Top edge down -> pitch falls -> roll up the screen.
    gyro.x = shape(base.side - up.side, P.gyroRange, P.gyroDead);
    gyro.z = shape(wrap(up.pitch - base.pitch), P.gyroRange, P.gyroDead);
    diag.tiltX = gyro.x.toFixed(2);
    diag.tiltZ = gyro.z.toFixed(2);
  }
  window.addEventListener('deviceorientation', onOrientation);

  // Drag: pull in the direction you want the egg to roll
  stage.addEventListener('pointerdown', (e) => {
    if (e.target.closest && e.target.closest('button')) return;
    drag.active = true;
    drag.sx = e.clientX;
    drag.sy = e.clientY;
    stage.setPointerCapture(e.pointerId);
    touch();
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag.active) return;
    const scale = Math.min(stage.clientWidth, stage.clientHeight) * 0.3;
    drag.x = clamp((e.clientX - drag.sx) / scale, -1, 1);
    drag.z = clamp((e.clientY - drag.sy) / scale, -1, 1);
    touch();
  });
  const end = () => { drag.active = false; drag.x = 0; drag.z = 0; };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);

  return {
    // Ask for gyro permission (iOS). Must be called from a tap.
    async requestPermission() {
      try {
        const DOE = window.DeviceOrientationEvent;
        if (DOE && typeof DOE.requestPermission === 'function') {
          diag.permission = 'spør …';
          diag.permission = await DOE.requestPermission();
        } else {
          diag.permission = 'trengs ikke';
        }
      } catch (e) {
        diag.permission = 'feil: ' + String((e && e.message) || e); // drag still works
      }
    },
    diag,
    get gyroActive() { return gyroActive; },
    tilt() {
      return { x: clamp(gyro.x + drag.x, -1, 1), z: clamp(gyro.z + drag.z, -1, 1) };
    },
    idleFor() { return performance.now() - lastInteract; },
    // Make the current phone angle the new "flat".
    // settleAfterMove: wait until the phone has been moved and held still again (used when the egg goes home)
    recalibrate(settleAfterMove = false) {
      if (!up || P.gyroAbsolute) return; // absolute mode never recalibrates: level is level
      base = up;
      anchor = up;
      gyro.x = 0;
      gyro.z = 0;
      settle.on = settleAfterMove;
      settle.moved = false;
    },
    touch
  };
}
