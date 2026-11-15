// All tunable values in one place. The lab (?lab) edits a copy of these live.
// To make lab values the new default: paste the copied JSON here.
export const DEFAULT_PARAMS = {
  // Egg shape (scene units)
  eggLength: 2.85,
  eggWidth: 2.18,
  eggPointy: 0.11,        // how much fatter the blunt end is

  // Look
  matchBackground: true,  // fresh egg = the page background color (colorStart is used if off)
  colorStart: '#E3ECEF',  // egg color (when matchBackground is off). The egg itself never changes color.
  lineColor: '#A9C8DA',   // outline while setting the timer, and the dots
  // While boiling, the outline steps every 30 s: white -> yellow -> red
  outlineStart: '#FFFFFF',
  outlineMid: '#F0AE0B',
  outlineEnd: '#D9372B',
  pulse: 1.2,             // how much the outline swells on the beeps at the end
  dotCount: 400,
  dotSize: 1.4,           // pixels on the 1024 x 512 shell texture
  dotStrength: 0.2,       // 0 = invisible, 1 = full line color
  rough: 0.5,             // bumpy surface
  shade: 0.15,            // how dark the shadow side of the egg is (0 = completely flat)
  digitColor: '#F0AE0B',
  digitSize: 115,
  digitRepeat: 1,         // how many times the time is painted around the egg
  outline: 0.03,          // 0 = no outline
  shadowOpacity: 0.08,
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

const STORE_KEY = 'eggeklokke-lab-v3'; // bump when defaults change, so old lab values don't override them

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
