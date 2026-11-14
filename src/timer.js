// Boiling time logic (unchanged from v1)

// Seconds for a medium egg at sea level, straight from the fridge
export const BASE = { soft: 360, smile: 450, hard: 600 };
export const SIZE = { s: 0.9, m: 1, l: 1.1 };
export const NAMES = { soft: 'bløtkokt', smile: 'smilende', hard: 'hardkokt' };
export const SIZENAMES = { s: 'lite', m: 'medium', l: 'stort' };

// Water boils about 1 °C lower per 300 m
export function boilTemp(h) { return 100 - 0.0034 * h; }
export function altFactor(h) { return Math.pow(2, (100 - boilTemp(h)) / 12); }

export function totalSeconds(doneness, size, altitude) {
  const t = BASE[doneness] * SIZE[size] * altFactor(altitude);
  return Math.round(t / 5) * 5;
}

export function fmt(s) {
  s = Math.max(0, Math.ceil(s));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m + ':' + (r < 10 ? '0' : '') + r;
}
