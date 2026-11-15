// All tunable values in one place. The lab (?lab) edits a copy of these live.
// To make lab values the new default: paste the copied JSON here.
export const DEFAULT_PARAMS = {
  // Egg shape (scene units)
  eggLength: 1.9,
  eggWidth: 1.45,
  eggPointy: 0.11,        // how much fatter the blunt end is

  // Look
  colorStart: '#F0AE0B',  // fresh egg
  colorEnd: '#E8822A',    // done egg (the shell shifts a little every 30 s)
  dotCount: 160,
  dotSize: 9,             // pixels on the 1024 x 512 shell texture
  dotStrength: 0.07,      // 0 = invisible, 1 = full contrast
  rough: 0.5,             // bumpy surface
  digitContrast: 0.22,
  digitSize: 120,
  digitRepeat: 3,         // how many times the time is painted around the egg
  outline: 0.03,          // 0 = no outline
  shadowOpacity: 0.12,
  shadowOffset: 0.14,

  // Camera (straight down)
  fov: 14,                // small = flat, far away
  view: 7,                // visible size of the short screen side, in scene units

  // Physics
  gravity: 18,
  tilt: 0.55,             // how much of gravity tilting can turn sideways
  friction: 0.7,
  bounce: 0.35,
  linDamp: 0.15,
  angDamp: 0.35,

  // Behaviour
  idleSec: 10,            // roll back to the middle after this many seconds without play
  centerSpring: 5,
  alarmJump: 0.8
};

const STORE_KEY = 'eggeklokke-lab-v1';

export function loadParams(useStored) {
  const params = { ...DEFAULT_PARAMS };
  if (!useStored) return params;
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    for (const k of Object.keys(params)) if (k in saved) params[k] = saved[k];
  } catch (e) { /* storage not available */ }
  return params;
}

export function saveParams(params) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(params)); } catch (e) { /* ignore */ }
}

export function clearParams() {
  try { localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ }
}
