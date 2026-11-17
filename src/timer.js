// Boiling time logic (unchanged from v1)

// Seconds for a medium egg at sea level, straight from the fridge
export const BASE = { soft: 360, smile: 450, hard: 600 };
export const SIZE = { s: 0.9, m: 1, l: 1.1 };

// Water boils about 1 °C lower per 300 m
export function boilTemp(h) { return 100 - 0.0034 * h; }
export function altFactor(h) { return Math.pow(2, (100 - boilTemp(h)) / 12); }

// "My values": your own times for a medium egg at the altitude where you live.
// Everything else (small/large egg, other altitudes) is worked out from there.
let custom = { times: null, home: 0 };
export function setCustom(c) { custom = { times: c.times || null, home: +c.home || 0 }; }

// Standard times for a medium egg at a given altitude (what "My values" starts from)
export function standardTimesAt(h) {
  const f = altFactor(h);
  return Object.fromEntries(Object.entries(BASE).map(([k, v]) => [k, Math.round(v * f / 5) * 5]));
}

export function totalSeconds(doneness, size, altitude) {
  const t = custom.times
    ? custom.times[doneness] * SIZE[size] * altFactor(altitude) / altFactor(custom.home)
    : BASE[doneness] * SIZE[size] * altFactor(altitude);
  return Math.round(t / 5) * 5;
}

export function fmt(s) {
  s = Math.max(0, Math.ceil(s));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m + ':' + (r < 10 ? '0' : '') + r;
}
