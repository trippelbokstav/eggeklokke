# Eggklokke

An egg timer that entertains you until the egg is done: the clock is painted on an egg
that you roll around the screen by tilting the phone (or dragging with a finger/mouse).
Seen straight from above; the edges of the screen are the walls.

Also a test rig for the Store O workflow: web app (Vite) → iOS app (Capacitor) → iPhone.
The first, simple SVG version is kept on the branch `v1-svg`.

## How it works

- **three.js** draws the egg from straight above (flat toon shading, outline, silhouette drop shadow, faint dots, a slightly rough bump map).
- **Rapier** (`@dimforge/rapier3d-compat`) simulates the egg as a convex hull, so it wobbles and rolls in curves like a real egg.
- **Zero position:** while you set the timer, the egg lies straight (pointy end up, clock facing you). Start wakes it up; stop glides it back.
- **Tilt** (gyro, or drag) turns gravity sideways. After 10 s without play, the egg glides home to the zero position.
- **Walls** sit just outside the screen (`wallOut`), so the egg can slip half out of view. The canvas fills the whole screen behind the UI.
- **The clock** is painted on a canvas texture in low contrast, repeated around the egg.
- **Color:** the egg keeps the background color. The outline steps every 30 s from white via yellow to red, and swells on the beeps in the last 10 s.
- **The game** (`src/game.js`): while the egg boils, roll over small yellow eggs in order (1, 2, 3 …). Two dots show where the next two appear. You must roll well over an egg (`pickup`), the edge is not enough. Each small egg counts down (`comboSec`): yellow → orange → red with ticks. Take it in time and the streak (rekke) grows: each egg is worth the streak number. Too late (light blue): +1, and the streak starts over. At the alarm the game ends, the egg glides home and the score shows.
- **Haptics** (`@capacitor/haptics`): clicks on buttons, ticks at the end, bumps when the egg hits the dish. Only in the iOS app.

| File | What |
|---|---|
| `src/params.js` | all tunable values (defaults) |
| `src/lab.js` | the lab: sliders for everything (`?lab`) |
| `src/game.js` | the egg-collecting game |
| `src/main.js` | UI, timer, colors, idle logic |
| `src/world.js` | three.js scene + Rapier physics |
| `src/eggTexture.js` | painting the shell |
| `src/input.js` | gyro + drag |
| `src/native.js` | haptics bridge |
| `src/sound.js` | beeps |
| `src/timer.js` | boiling time math |

Gyro only works over https or in the app. On the dev server over the local network, use drag.

## Lab

Tap the ⚙︎ button top left (or add `?lab` to the address). Every value in `src/params.js`
gets a slider. Values are saved in that browser and used every time, also with the lab closed. **Kopier verdier** shows the JSON:
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
