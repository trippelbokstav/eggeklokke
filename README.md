# Eggklokke

An egg timer that entertains you until the egg is done: the clock is painted on an egg
that you roll around the screen by tilting the phone (or dragging with a finger/mouse).
Seen straight from above; the edges of the screen are the walls.

Also a test rig for the Store O workflow: web app (Vite) → iOS app (Capacitor) → iPhone.
The first, simple SVG version is kept on the branch `v1-svg`.

## How it works

- **three.js** draws the egg from straight above (flat toon shading, outline, silhouette drop shadow, faint dots, a slightly rough bump map).
- **Rapier** (`@dimforge/rapier3d-compat`) simulates the egg as a convex hull, so it wobbles and rolls in curves like a real egg.
- **Tilt** (gyro, or drag) turns gravity sideways. After 10 s without play, the egg rolls back to the middle.
- **The clock** is painted on a canvas texture in low contrast, repeated around the egg.
- **Color:** the shell warms up a little every 30 s, pulses every second in the last 10 s, and turns red at the alarm.
- **Haptics** (`@capacitor/haptics`): clicks on buttons, ticks at the end, bumps when the egg hits the dish. Only in the iOS app.

| File | What |
|---|---|
| `src/params.js` | all tunable values (defaults) |
| `src/lab.js` | the lab: sliders for everything (`?lab`) |
| `src/main.js` | UI, timer, colors, idle logic |
| `src/world.js` | three.js scene + Rapier physics |
| `src/eggTexture.js` | painting the shell |
| `src/input.js` | gyro + drag |
| `src/native.js` | haptics bridge |
| `src/sound.js` | beeps |
| `src/timer.js` | boiling time math |

Gyro only works over https or in the app. On the dev server over the local network, use drag.

## Lab

Add `?lab` to the address (e.g. `http://192.168.x.x:5173/?lab`). Every value in `src/params.js`
gets a slider. Values are saved in that browser. **Kopier verdier** shows the JSON:
paste it to Claude, and it becomes the new default in `src/params.js`.
Add `?fps` for an FPS meter (`?lab&fps` for both).

Debug in the console: `__egg.skip(300)` jumps 300 seconds ahead while the timer runs.

## Commands

```bash
npm install          # first time, and after pulling new dependencies
npm run dev          # dev server, open the Network URL in Safari on the iPhone
npm run build        # build to dist/
npm run ios          # build + sync to Xcode + open Xcode (requires Xcode)
```

## First iOS setup (once, after Xcode is installed)

```bash
npx cap add ios
npm run ios
```

App ID: `no.storeo.eggeklokke`
