// All tunable values in one place. The lab (?lab) edits a copy of these live.
// To make lab values the new default: paste the copied JSON here.
export const DEFAULT_PARAMS = {
  // Egg shape (scene units)
  eggLength: 2.85,
  eggWidth: 2.18,
  eggPointy: 0.11,        // how much fatter the blunt end is

  // Placement on the setup screen (pixels, + = down). The egg is lifted (+ = up).
  eggLift: 45,            // the resting egg sits this far above the screen middle
  posAlt: 5,              // altitude block (label, mountains, slider)
  altWidth: 290,          // width of the altitude slider and mountains (pixels)
  posYolk: -55,             // yolk row (yolk, − +, its name)
  posStart: -45,            // Start
  // Text (pixels, + = down)
  txtAlt: 35,              // altitude heading (label / number / info line)
  txtEgg: -13,              // egg name ("Medium egg"), relative to its spot above the egg
  txtYolk: -16,
  txtStart: 0,            // "Start klokka" on the egg, relative to its spot under the time             // yolk name ("Smilende"), relative to its spot above the yolk

  // Egg size picker (− egg +): the big egg itself grows and shrinks, and you play with that size
  sizeSmall: 0.84,        // scale of a small egg (medium = 1)
  sizeLarge: 1.16,        // scale of a large egg
  sizeStiff: 260,         // spring stiffness (higher = snappier)
  sizeDamp: 12,           // spring damping (lower = more wobble/overshoot)

  // Yolk picker (− yolk +): 10 points that spring between soft, smiling and hard
  // Motion depends on where it goes: soft = wobbly, hard = firm and concise
  yolkSoftStiff: 150,      // spring stiffness toward soft (higher = snappier)
  yolkSoftDamp: 6,         // damping toward soft (lower = more jelly wobble)
  yolkSmileStiff: 200,
  yolkSmileDamp: 18,
  yolkHardStiff: 520,
  yolkHardDamp: 44,        // about 2 * sqrt(stiffness) = no overshoot
  yolkLobe: 0.85,          // how far the soft yolk splashes out (5 lobes)
  yolkWaist: 0.62,        // soft: how far in the gaps between the lobes go (lower = deeper)
  yolkSmile: 0.6,          // smiling: 0 = plain circle, 1 = full crooked smile
  yolkSoftColor: '#E2560B',
  yolkSmileColor: '#F07C10',
  yolkHardColor: '#F7A743',

  // Altitude terrain: a line over the slider that grows from hills (low) to sharp mountains (2500 m)
  terrainHeight: 72,       // pixels: how tall the highest mountain gets
  terrainSharp: 1,         // how ridged/sharp the mountains get up high (0 = always soft hills)
  terrainOct: 3,           // noise detail at the top (higher = more small jagged bits)
  terrainFreq: 1,          // how many peaks across the width
  terrainWidth: 1,         // how wide the mountain massif around the thumb is
  terrainLag: 60,          // spring: how fast the peak follows the thumb (lower = more lag)
  terrainDamp: 12,         // damping (lower = more swing before it lands)
  terrainScroll: 1.5,      // how much the landscape glides past as you drag
  terrainChaos: 1,         // how wild it gets when you drag fast
  terrainLine: 1.5,        // line width in pixels

  // Look
  matchBackground: true,  // fresh egg = the page background color (colorStart is used if off)
  colorStart: '#FFE49A',  // egg color (when matchBackground is off). The egg itself never changes color.
  lineColor: '#E2B341',   // outline while setting the timer, and the dots
  // While boiling, the outline steps every 30 s: white -> yellow -> red
  outlineStart: '#FFFFFF',
  outlineMid: '#F07C10',
  outlineEnd: '#D9372B',
  pulse: 1.2,             // how much the outline swells on the beeps at the end
  dotCount: 400,
  dotSize: 1.4,           // pixels on the 1024 x 512 shell texture
  dotStrength: 0.2,       // 0 = invisible, 1 = full line color
  rough: 0.5,             // bumpy surface
  shade: 0.15,            // how dark the shadow side of the egg is (0 = completely flat)
  digitColor: '#E0680A',
  digitSize: 115,
  digitRepeat: 1,         // how many times the time is painted around the egg
  outline: 0.03,          // 0 = no outline
  shadowOpacity: 0.08,
  shadowOffset: 0.14,

  // Rendering
  pixelRatio: 2,          // max pixels per screen point (lower = lighter for the phone, a bit softer)

  // Camera (straight down)
  fov: 4,                 // small = flat, far away
  view: 5.3,              // visible size of the short screen side, in scene units

  // Gyro (tilting the phone)
  gyroAbsolute: true,     // true: flat = screen level (like a marble in a tray). false: flat = how you hold it at Start
  tilt: 0.66,             // how much of gravity tilting can turn sideways (strength at full tilt)
  gyroRange: 20,          // degrees of tilt for full strength (low = sensitive)
  gyroDead: 1.5,          // degrees around "flat" that are ignored (calm hands)
  gyroSmooth: 0.1,        // seconds: how softly the egg follows the tilt (low = quick)
  stillDeg: 1,            // a change smaller than this (degrees) is "lying still", not playing

  // Physics
  gravity: 18,
  friction: 0.7,
  bounce: 0.41,
  linDamp: 0.15,
  angDamp: 0.35,

  // Game: collect small eggs while the big one boils
  gameOn: true,
  miniScale: 0.22,         // size of the small eggs compared with the big one
  pickup: 0.8,           // how close the big egg's middle must come (0 = dead center, 1 = edge touch)
  comboSec: 4,            // seconds per small egg to keep the streak (its countdown: yellow -> orange -> red)
  miniOrange: '#E2470B',  // middle color of the countdown (start = digitColor, end = outlineEnd, expired = lineColor)
  ticks: false,           // tick sound during the countdown (small vibrations in red are always on)
  spotInset: 0.12,        // keep small eggs this far in from the screen edges (fraction of the area on each side)
  bumpPenalty: 1,         // points lost per wall bump while playing (0 = no penalty)
  dotNextSize: 0.03,      // the dot for the next egg (yellow)
  dotLaterSize: 0.025,    // the dot for the egg after that (light blue)

  // Behaviour
  idleSec: 10,            // glide home to the zero position after this many seconds without play
  homeSpeed: 1.8,         // how fast it glides home (higher = faster)
  wallOut: 0.77,          // how far outside the screen the walls are, in egg widths (0 = at the edge)
  alarmJump: 0.8
};

const STORE_KEY = 'eggeklokke-lab-v9'; // bump when defaults change, so old lab values don't override them

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
