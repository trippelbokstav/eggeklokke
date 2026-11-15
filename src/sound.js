// Simple synthesized sounds with Web Audio (no audio files needed)
let ctx = null;

// Must be called from a user gesture the first time (iOS requirement)
export function unlockAudio() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* no audio */ }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, vol, when = 0, type = 'sine') {
  if (!ctx || ctx.state !== 'running') return;
  const t0 = ctx.currentTime + when;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  g.connect(ctx.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

export const sound = {
  beep() { tone(880, 0.09, 0.15); },
  alarm() { for (let i = 0; i < 4; i++) tone(1320, 0.12, 0.35, i * 0.18); },
  // Countdown tick on a small egg. urgency 0..1 makes it brighter.
  tick(urgency) { tone(1400 + urgency * 600, 0.025, 0.05 + urgency * 0.06, 0, 'square'); },
  // A small egg is collected. The tone rises with the streak.
  pickup(streak) {
    const f = 660 * Math.pow(2, Math.min(streak - 1, 12) / 12);
    tone(f, 0.08, 0.16);
    tone(f * 1.5, 0.12, 0.14, 0.07);
  },
  // Soft "tok" when the egg hits a wall. strength 0..1
  bump(strength) { tone(170 + strength * 90, 0.07, 0.04 + strength * 0.14, 0, 'triangle'); }
};
