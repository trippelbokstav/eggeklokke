// Tilt input: gyro (phone tilt) and finger/mouse drag. Both give a tilt of -1..1 on x and z.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const GYRO_RANGE = 25;      // degrees of tilt for full effect
const MOVE_THRESHOLD = 0.1; // how much the tilt must change to count as "playing"

export function createInput(stage) {
  let beta = null;
  let gamma = null;
  let base = null;          // neutral phone angle
  let anchor = { x: 0, z: 0 };
  let gyroActive = false;
  let lastInteract = performance.now();

  const gyro = { x: 0, z: 0 };
  const drag = { x: 0, z: 0, active: false, sx: 0, sy: 0 };

  function touch() { lastInteract = performance.now(); }

  function onOrientation(e) {
    if (e.beta == null || e.gamma == null) return;
    beta = e.beta;
    gamma = e.gamma;
    if (!gyroActive) {
      gyroActive = true;
      base = { beta, gamma };
      anchor = { x: 0, z: 0 };
    }
    gyro.x = clamp((gamma - base.gamma) / GYRO_RANGE, -1, 1);
    gyro.z = clamp((beta - base.beta) / GYRO_RANGE, -1, 1);
    if (Math.hypot(gyro.x - anchor.x, gyro.z - anchor.z) > MOVE_THRESHOLD) {
      anchor = { x: gyro.x, z: gyro.z };
      touch();
    }
  }
  window.addEventListener('deviceorientation', onOrientation);

  // Drag: pull in the direction you want the egg to roll
  stage.addEventListener('pointerdown', (e) => {
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
          await DOE.requestPermission();
        }
      } catch (e) { /* denied or not available: drag still works */ }
    },
    get gyroActive() { return gyroActive; },
    tilt() {
      return { x: clamp(gyro.x + drag.x, -1, 1), z: clamp(gyro.z + drag.z, -1, 1) };
    },
    idleFor() { return performance.now() - lastInteract; },
    // Make the current phone angle the new "flat"
    recalibrate() {
      if (beta == null) return;
      base = { beta, gamma };
      gyro.x = 0;
      gyro.z = 0;
      anchor = { x: 0, z: 0 };
    },
    touch
  };
}
