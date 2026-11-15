// Native bridge: real haptics in the iOS app, plain web fallback in the browser
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export const isNative = Capacitor.isNativePlatform();

// What the haptics bridge has done, for the Diagnose folder in the lab
export const hapticDiag = {
  native: isNative ? 'ja' : 'nei (nettleser)',
  platform: Capacitor.getPlatform(),
  plugin: Capacitor.isPluginAvailable('Haptics') ? 'funnet' : 'MANGLER',
  calls: 0,
  ok: 0,
  lastError: '-'
};

const webVibrate = (pattern) => {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* ignore */ }
};
// Run a haptics call and note how it went (the calls return promises, so catch those too)
const safe = (fn) => {
  hapticDiag.calls++;
  try {
    Promise.resolve(fn())
      .then(() => { hapticDiag.ok++; })
      .catch((e) => { hapticDiag.lastError = String((e && e.message) || e); });
  } catch (e) {
    hapticDiag.lastError = String((e && e.message) || e);
  }
};

let lastBump = 0;

export const haptic = {
  // Light click when choosing an option
  select() { if (isNative) safe(() => Haptics.selectionChanged()); },
  // Firm press on Start / Cancel
  press() { if (isNative) safe(() => Haptics.impact({ style: ImpactStyle.Medium })); },
  // Tiny tick for the last 10 seconds
  tick() { if (isNative) safe(() => Haptics.impact({ style: ImpactStyle.Light })); },
  // The egg hits the dish. strength 0..1
  bump(strength) {
    const now = performance.now();
    if (now - lastBump < 90) return; // avoid buzzing on every contact frame
    lastBump = now;
    if (!isNative) return;
    const style = strength > 0.75 ? ImpactStyle.Heavy : strength > 0.4 ? ImpactStyle.Medium : ImpactStyle.Light;
    safe(() => Haptics.impact({ style }));
  },
  // Alarm: "success" pattern followed by a long buzz
  alarm() {
    if (isNative) {
      safe(() => Haptics.notification({ type: NotificationType.Success })
        .then(() => Haptics.vibrate({ duration: 500 })));
    } else {
      webVibrate([400, 200, 400, 200, 400]);
    }
  }
};
