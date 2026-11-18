// The 3D scene (three.js) and the physics (Rapier): an egg rolling freely on the screen,
// seen straight from above. The edges of the screen are the walls.
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { createEggTexture, TEXT_FONT, fontStamp } from './eggTexture.js';

const STEP = 1 / 60;
const WALL = 0.5;      // half thickness of the invisible walls
const CEILING = 4;     // the egg can jump, but not up into the camera

function eggProfile(L, W, pointy, n) {
  // From the blunt end (bottom) to the pointy end (top)
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI;
    const y = -Math.cos(t) * L / 2;
    const r = (W / 2) * Math.sin(t) * (1 + pointy * Math.cos(t));
    pts.push(new THREE.Vector2(Math.max(r, 0), y));
  }
  return pts;
}

// Two-tone gradient = flat, graphic shading. The light intensities decide how dark the shadow side is.
function toonGradient() {
  const data = new Uint8Array([0, 0, 0, 255, 255, 255, 255, 255]);
  const tex = new THREE.DataTexture(data, 2, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

// container: the full-screen element the canvas fills. focus: the free area where the egg rests (zero position).
// bottomEl: the UI block at the bottom (the small eggs in the game stay above it)
export async function createWorld(container, P, focus = container, bottomEl = null) {
  await RAPIER.init();

  // ---------- three.js ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, stencil: true }); // stencil: figure lines
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, P.pixelRatio));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(P.fov, 1, 1, 500);
  camera.up.set(0, 0, -1); // screen up = world -Z

  // ambient + sun = PI, so the lit side shows the shell color exactly (three.js divides diffuse by PI)
  const ambient = new THREE.AmbientLight(0xffffff, Math.PI);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffffff, 0);
  sun.position.set(-4, 10, -4); // from the top left of the screen
  scene.add(sun);

  const gradientMap = toonGradient();
  const shell = createEggTexture();
  const eggMat = new THREE.MeshToonMaterial({
    map: shell.texture,
    bumpMap: shell.bump,
    gradientMap,
    emissive: 0x000000
  });
  const egg = new THREE.Mesh(new THREE.BufferGeometry(), eggMat);
  const outline = new THREE.Mesh(egg.geometry, new THREE.MeshBasicMaterial({ color: 0x14303b, side: THREE.BackSide }));
  egg.add(outline);
  scene.add(egg);

  // Drop shadow = the egg's own silhouette, squashed flat onto the floor and nudged sideways
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x14303b, transparent: true, depthWrite: false });
  const shadow = new THREE.Mesh(egg.geometry, shadowMat);
  shadow.matrixAutoUpdate = false;
  shadow.renderOrder = -1;
  scene.add(shadow);
  const flatten = new THREE.Matrix4();
  const shift = new THREE.Matrix4();

  // ---------- Game layer: small eggs to collect, and dots that show where the next ones come ----------
  // Two small eggs take turns: one pops while the next one appears.
  // The number sits flat on top of the small egg, like a sticker (not bent around the shell)
  function makeLabel() {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    // Always drawn on top: on a phone's depth buffer the flat label can otherwise hide under the egg
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = 0;
    mesh.renderOrder = 10;
    let last = '';
    mesh.userData.draw = (text, color) => {
      const key = text + color + fontStamp(); // repaint once the web font has arrived
      if (key === last) return;
      last = key;
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, 128, 128);
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      let size = 92;
      ctx.font = `700 ${size}px ${TEXT_FONT}`;
      const w = ctx.measureText(text).width;
      if (w > 116) { size = Math.floor(size * 116 / w); ctx.font = `700 ${size}px ${TEXT_FONT}`; }
      ctx.fillText(text, 64, 68);
      tex.needsUpdate = true;
      dirty = true;
    };
    return mesh;
  }
  const minis = [0, 1].map(() => {
    const tex = createEggTexture(64, 32); // plain color only, so it is tiny
    const m = new THREE.Mesh(egg.geometry, new THREE.MeshToonMaterial({ map: tex.texture, gradientMap }));
    m.visible = false;
    const label = makeLabel();
    label.visible = false;
    scene.add(label);
    m.userData = { tex, label, mode: 'off', t: 0, x: 0, z: 0 }; // mode: in | idle | pop | off
    scene.add(m);
    return m;
  });
  let miniIdx = 0;
  const dotGeo = new THREE.CircleGeometry(1, 32);
  // Dot 0 = the next egg (yellow), dot 1 = the one after (light blue): you can see the order
  const dotMats = [
    new THREE.MeshBasicMaterial({ color: 0xf0ae0b, depthWrite: false }),
    new THREE.MeshBasicMaterial({ color: 0xa9c8da, depthWrite: false })
  ];
  const dots = [0, 1].map((i) => {
    const m = new THREE.Mesh(dotGeo, dotMats[i]);
    m.rotation.x = -Math.PI / 2;
    m.visible = false;
    m.renderOrder = -2;
    m.userData = { t: 0, x: NaN, z: NaN };
    scene.add(m);
    return m;
  });
  const floorHalf = { x: 3, z: 5 }; // visible half size on the floor, set in resize()

  // ---------- Figure lines (connect the dots) ----------
  // Flat strips on the floor, under the eggs. Each group draws with the stencil, so where its
  // strips and round joints overlap the color is laid down once (no darker spots at the joints).
  const stripGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0.5, 0, 0); // length along +x from 0
  const capGeo = new THREE.CircleGeometry(0.5, 20).rotateX(-Math.PI / 2);
  let stencilRef = 0;
  function lineGroup(color, opacity) {
    stencilRef = (stencilRef % 250) + 1;
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity, depthWrite: false,
      stencilWrite: true, stencilRef, stencilFunc: THREE.NotEqualStencilFunc,
      stencilZPass: THREE.ReplaceStencilOp
    });
    const g = new THREE.Group();
    g.renderOrder = -3;
    g.userData = { mat, segs: [], mode: 'on', t: 0, from: opacity, base: opacity };
    scene.add(g);
    return g;
  }
  function disposeGroup(g) { scene.remove(g); g.userData.mat.dispose(); }
  let figNow = null;     // the figure being drawn
  const figOld = [];     // finished (or abandoned) figures fading out
  function placeSeg(s, k) {
    const dx = s.bx - s.ax, dz = s.bz - s.az;
    const len = Math.hypot(dx, dz) * k;
    const w = P.figLineWidth;
    s.strip.scale.set(Math.max(1e-4, len), 1, w);
    s.strip.rotation.y = -Math.atan2(dz, dx);
    s.strip.position.set(s.ax, s.y, s.az);
    s.capA.scale.set(w, 1, w);
    s.capA.position.set(s.ax, s.y, s.az);
    s.capB.scale.set(w, 1, w);
    s.capB.position.set(s.ax + (s.bx - s.ax) * k, s.y, s.az + (s.bz - s.az) * k);
  }
  function animateLines(dt) {
    let busy = false;
    const groups = figNow ? [figNow, ...figOld] : figOld;
    for (const g of groups) {
      const u = g.userData;
      for (const s of u.segs) {
        if (s.k >= 1) continue;
        s.delay -= dt;
        if (s.delay > 0) { busy = true; s.strip.visible = s.capA.visible = s.capB.visible = false; continue; }
        s.strip.visible = s.capA.visible = s.capB.visible = true;
        s.k = Math.min(1, s.k + dt / Math.max(0.01, P.figGrowSec));
        placeSeg(s, 1 - (1 - s.k) ** 3); // ease out
        busy = true;
      }
      u.t += dt;
      if (u.mode === 'done') {
        // Flash up clear, hold, then fade away slowly
        const up = 0.15, hold = P.figHoldSec;
        const o = u.t < up ? u.from + (P.figDoneOpacity - u.from) * (u.t / up)
          : u.t < up + hold ? P.figDoneOpacity
          : P.figDoneOpacity * Math.max(0, 1 - (u.t - up - hold) / Math.max(0.01, P.figFadeSec));
        u.mat.opacity = o;
        busy = true;
        if (u.t > up + hold + P.figFadeSec) u.mode = 'gone';
      } else if (u.mode === 'out') {
        u.mat.opacity = u.from * Math.max(0, 1 - u.t / 0.5);
        busy = true;
        if (u.t > 0.5) u.mode = 'gone';
      }
    }
    for (let i = figOld.length - 1; i >= 0; i--) if (figOld[i].userData.mode === 'gone') { disposeGroup(figOld[i]); figOld.splice(i, 1); }
    return busy;
  }
  const backOut = (t) => { const c1 = 1.70158; const c3 = c1 + 1; return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2; };

  // ---------- Rapier ----------
  const world = new RAPIER.World({ x: 0, y: -P.gravity, z: 0 });
  world.timestep = STEP;

  const fixed = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const floor = world.createCollider(
    RAPIER.ColliderDesc.cuboid(100, WALL, 100).setTranslation(0, -WALL, 0).setFriction(0.8),
    fixed
  );
  world.createCollider(RAPIER.ColliderDesc.cuboid(100, WALL, 100).setTranslation(0, CEILING + WALL, 0), fixed);
  const walls = [0, 1, 2, 3].map(() =>
    world.createCollider(RAPIER.ColliderDesc.cuboid(WALL, CEILING, WALL).setRestitution(0.4).setFriction(0.3), fixed));
  const bounds = { x: 3, z: 5 }; // inner half size of the play area, set in resize()

  function placeWalls(hx, hz) {
    bounds.x = hx;
    bounds.z = hz;
    const set = (c, x, z, ex, ez) => {
      c.setTranslationWrtParent({ x, y: CEILING / 2, z });
      c.setHalfExtents({ x: ex, y: CEILING, z: ez });
    };
    set(walls[0], -hx - WALL, 0, WALL, hz + 2 * WALL); // left
    set(walls[1], hx + WALL, 0, WALL, hz + 2 * WALL);  // right
    set(walls[2], 0, -hz - WALL, hx + 2 * WALL, WALL); // top of the screen
    set(walls[3], 0, hz + WALL, hx + 2 * WALL, WALL);  // bottom of the screen
  }

  // "Zero position" while you set the timer: lying straight, pointy end up the screen, clock facing the camera.
  // The clock is painted at u = 0.5 (local -Z); turn it to face up (+Y), and the pointy end (+Y) to screen up (-Z).
  const poseRot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2)
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
  const posePos = new THREE.Vector3(0, P.eggWidth / 2, 0);
  const eggBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(posePos.x, posePos.y, posePos.z)
      .setRotation({ x: poseRot.x, y: poseRot.y, z: poseRot.z, w: poseRot.w })
      .setCanSleep(false)
  );
  let posed = true;
  let dirty = true;      // something changed that must be drawn
  let poseSpeed = 9;     // glide speed to the zero position
  let outlinePulse = 0;
  const tmpPos = new THREE.Vector3();
  const tmpRot = new THREE.Quaternion();
  let eggCollider = null;
  let mass = 1;
  // Egg size (small / medium / large): a scale that springs to its target, with a little overshoot
  const size = { now: 1, vel: 0, target: 1, fit: 1 };
  let liftCut = 0; // pixels taken off P.eggLift when there is no room up there (set from the UI)
  let tourShift = 0; // pixels the resting egg is moved down during the intro tour
  // fit: extra shrink while you set the timer, so even a large egg fits between the title and the panel
  const shown = () => size.target * size.fit;

  // ---------- State ----------
  const tilt = { x: 0, z: 0 };
  let bumpHandler = null;
  const prevVel = new THREE.Vector3();
  const prevPos = new THREE.Vector3();
  const currPos = new THREE.Vector3();
  const prevRot = new THREE.Quaternion();
  const currRot = new THREE.Quaternion();
  const readBody = (pos, rot) => {
    const t = eggBody.translation();
    const r = eggBody.rotation();
    pos.set(t.x, t.y, t.z);
    rot.set(r.x, r.y, r.z, r.w);
  };

  // (Re)build the egg mesh and its collider from the current params
  function buildEgg() {
    const geo = new THREE.LatheGeometry(eggProfile(P.eggLength, P.eggWidth, P.eggPointy, 40), 48);
    egg.geometry.dispose();
    egg.geometry = geo;
    outline.geometry = geo;
    shadow.geometry = geo;
    minis.forEach((m) => { m.geometry = geo; });
    buildCollider();
    applyParams();
  }

  // Physics hull at the chosen egg size. Mass follows the volume (density 1), so a big egg is heavier.
  function buildCollider() {
    if (eggCollider) world.removeCollider(eggCollider, true);
    // Low-res hull for physics: the egg still wobbles, but collisions stay cheap
    const s = size.target;
    const hull = new THREE.LatheGeometry(eggProfile(P.eggLength * s, P.eggWidth * s, P.eggPointy, 10), 14);
    eggCollider = world.createCollider(
      RAPIER.ColliderDesc.convexHull(new Float32Array(hull.attributes.position.array)).setDensity(1),
      eggBody
    );
    hull.dispose();
    eggCollider.setFriction(P.friction);
    eggCollider.setRestitution(P.bounce);
    mass = eggBody.mass();
  }

  // Spring the visible size toward the target. Returns true while it moves.
  function animateSize(dt) {
    const goal = shown();
    const d = goal - size.now;
    if (Math.abs(d) < 1e-4 && Math.abs(size.vel) < 1e-3) {
      if (size.now === goal) return false;
      size.now = goal;
      size.vel = 0;
    } else {
      // Semi-implicit Euler in small steps, so a stiff spring stays stable
      const n = Math.ceil(dt / (1 / 240));
      const h = dt / n;
      for (let i = 0; i < n; i++) {
        size.vel += ((goal - size.now) * P.sizeStiff - size.vel * P.sizeDamp) * h;
        size.now += size.vel * h;
      }
    }
    egg.scale.setScalar(size.now);
    posePos.y = P.eggWidth / 2 * size.now; // keep it resting on the floor while it grows
    return true;
  }

  // Live values from the lab
  function applyParams() {
    if (eggCollider) {
      eggCollider.setFriction(P.friction);
      eggCollider.setRestitution(P.bounce);
    }
    eggBody.setLinearDamping(P.linDamp);
    eggBody.setAngularDamping(P.angDamp);
    eggMat.bumpScale = P.rough * 2;
    ambient.intensity = Math.PI * (1 - P.shade);
    sun.intensity = Math.PI * P.shade;
    posePos.y = P.eggWidth / 2 * size.now;
    outline.visible = P.outline > 0;
    outline.scale.setScalar(1 + P.outline * (1 + outlinePulse));
    shadow.visible = P.shadowOpacity > 0;
    camera.fov = P.fov;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, P.pixelRatio));
    resize();
    dirty = true;
  }

  function step() {
    if (posed) {
      // Glide to the zero position and stay there
      const t = eggBody.translation();
      const r = eggBody.rotation();
      const e = 1 - Math.exp(-STEP * poseSpeed);
      tmpPos.set(t.x, t.y, t.z).lerp(posePos, e);
      tmpRot.set(r.x, r.y, r.z, r.w).slerp(poseRot, e);
      // Snap the last bit, so it really stops (and nothing needs redrawing)
      if (tmpPos.distanceToSquared(posePos) < 1e-6 && 1 - Math.abs(tmpRot.dot(poseRot)) < 1e-7) {
        tmpPos.copy(posePos);
        tmpRot.copy(poseRot);
      }
      eggBody.setNextKinematicTranslation({ x: tmpPos.x, y: tmpPos.y, z: tmpPos.z });
      eggBody.setNextKinematicRotation({ x: tmpRot.x, y: tmpRot.y, z: tmpRot.z, w: tmpRot.w });
      world.step();
      prevVel.set(0, 0, 0);
      return;
    }
    const g = P.gravity;
    world.gravity = { x: tilt.x * g * P.tilt, y: -g, z: tilt.z * g * P.tilt };


    world.step();

    // Wall bumps: a sudden SIDEWAYS change in velocity that gravity can't explain, close to a wall.
    // (The egg rocking on the floor while it rolls changes the up/down velocity all the time,
    // so that must not count, or it would buzz constantly.)
    const v = eggBody.linvel();
    const wg = world.gravity;
    const dv = Math.hypot(v.x - prevVel.x - wg.x * STEP, v.z - prevVel.z - wg.z * STEP);
    prevVel.set(v.x, v.y, v.z);
    const tp = eggBody.translation();
    const reach = P.eggLength * size.now * 0.75;
    const nearWall = bounds.x - Math.abs(tp.x) < reach || bounds.z - Math.abs(tp.z) < reach;
    const threshold = 1.2;
    if (nearWall && dv > threshold && bumpHandler) bumpHandler(Math.min(1, (dv - threshold) / 4));

    // Safety: if the egg ends up well outside the screen (e.g. after a resize), put it back inside
    const p = eggBody.translation();
    const m = P.eggLength * size.now / 2;
    if (Math.abs(p.x) > bounds.x + m || Math.abs(p.z) > bounds.z + m || p.y < -1) {
      eggBody.setTranslation({
        x: THREE.MathUtils.clamp(p.x, -bounds.x + m, bounds.x - m),
        y: Math.max(p.y, P.eggWidth * size.now),
        z: THREE.MathUtils.clamp(p.z, -bounds.z + m, bounds.z - m)
      }, true);
    }
  }

  // ---------- Game layer animation ----------
  // Returns true while something animates (so the frame must be drawn)
  function animateGame(dt) {
    const sc = P.miniScale;
    let busy = false;
    minis.forEach((m) => {
      const u = m.userData;
      if (u.mode === 'off') return;
      if (u.mode !== 'idle') busy = true;
      u.t += dt;
      let k = 1;
      if (u.mode === 'in') {
        const t = Math.min(1, u.t / 0.35);
        k = backOut(t);
        if (t >= 1) { u.mode = 'idle'; u.t = 0; }
      } else if (u.mode === 'idle') {
        k = 1; // stands still (no breathing), so nothing needs redrawing
      } else if (u.mode === 'pop') {
        const t = Math.min(1, u.t / 0.25);
        k = t < 0.35 ? 1 + 0.5 * (t / 0.35) : 1.5 * (1 - (t - 0.35) / 0.65);
        if (t >= 1) { u.mode = 'off'; m.visible = false; u.label.visible = false; }
      }
      const kk = Math.max(0.0001, k);
      m.scale.setScalar(sc * kk);
      m.position.set(u.x, posePos.y * sc * kk, u.z);
      m.quaternion.copy(poseRot);
      // Flat number on top, sized to the small egg's width
      const lw = P.eggWidth * sc * kk * 0.9;
      u.label.visible = m.visible;
      u.label.scale.set(lw, lw, 1);
      u.label.position.set(u.x, P.eggWidth * sc * kk + 0.01, u.z);
    });
    dots.forEach((d) => {
      if (!d.visible) return;
      d.userData.t += dt;
      if (d.userData.t < 0.35) busy = true;
      const size = d === dots[0] ? P.dotNextSize : P.dotLaterSize;
      const sz = size * backOut(Math.min(1, d.userData.t / 0.3));
      if (d.scale.x !== sz) { d.scale.setScalar(sz); busy = true; }
    });
    if (animateLines(dt)) busy = true;
    return busy;
  }

  // ---------- Camera: straight down, far away ----------
  function resize() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    dirty = true;
    camera.aspect = w / h;
    const vHalf = THREE.MathUtils.degToRad(camera.fov / 2);
    const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
    const dist = (P.view / 2) / Math.tan(Math.min(vHalf, hHalf));
    camera.position.set(0, dist, 0);
    camera.near = dist * 0.5;
    camera.far = dist * 1.5;
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    floorHalf.x = dist * Math.tan(hHalf);
    floorHalf.z = dist * Math.tan(vHalf);
    // Visible area at the height of the egg's middle, a little inside the edge
    const atEgg = dist - P.eggWidth * size.target / 2;
    // The walls sit outside the screen, so the egg can slip partly out of view before it bounces back
    const out = P.wallOut * P.eggWidth * size.target;
    const hx = atEgg * Math.tan(hHalf);
    const hz = atEgg * Math.tan(vHalf);
    placeWalls(hx + out, hz + out);
    // Zero position: the middle of the free area (between the title and the panel)
    const r = focus.getBoundingClientRect();
    const c = container.getBoundingClientRect();
    posePos.x = (((r.left + r.width / 2) - c.left) / w * 2 - 1) * hx;
    // eggLift: rest a bit above the middle (pixels)
    posePos.z = (((r.top + r.height / 2 - Math.max(0, P.eggLift - liftCut) + tourShift) - c.top) / h * 2 - 1) * hz;
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  if (focus !== container) ro.observe(focus);

  buildEgg();
  readBody(currPos, currRot);
  prevPos.copy(currPos);
  prevRot.copy(currRot);

  // ---------- Loop ----------
  let acc = 0;
  let last = performance.now();
  let frameHook = null;
  const stats = { fps: 0, draws: 0, physicsMs: 0, frames: 0, drawCount: 0, since: performance.now(), physSum: 0 };
  const drawnPos = new THREE.Vector3(Infinity, 0, 0);
  const drawnRot = new THREE.Quaternion();

  function frame(now) {
    requestAnimationFrame(frame);
    // Max 60 frames a second (a 120 Hz iPhone would otherwise do everything twice as often)
    if (now - last < 1000 / 60 - 2) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (frameHook) frameHook(dt, now);
    const sizing = animateSize(dt);

    acc += dt;
    let steps = 0;
    const p0 = performance.now();
    while (acc >= STEP && steps < 3) {
      prevPos.copy(currPos);
      prevRot.copy(currRot);
      step();
      readBody(currPos, currRot);
      acc -= STEP;
      steps++;
    }
    if (steps === 3) acc = 0; // never try to catch up forever (avoids a slow-motion spiral)
    stats.physSum += performance.now() - p0;
    stats.frames++;
    if (now - stats.since >= 1000) {
      const secs = (now - stats.since) / 1000;
      stats.fps = Math.round(stats.frames / secs);
      stats.draws = Math.round(stats.drawCount / secs);
      stats.physicsMs = stats.physSum / stats.frames;
      stats.frames = 0;
      stats.drawCount = 0;
      stats.physSum = 0;
      stats.since = now;
    }

    // Interpolate between physics steps (smooth on 120 Hz screens)
    const a = acc / STEP;
    egg.position.lerpVectors(prevPos, currPos, a);
    egg.quaternion.slerpQuaternions(prevRot, currRot, a);
    egg.updateMatrixWorld();

    // Shadow: flatten the egg onto the floor, shift it down-right (away from the light)
    const lift = Math.max(0, egg.position.y - P.eggWidth * size.now / 2);
    const off = P.shadowOffset * (1 + lift * 0.8);
    flatten.makeScale(1, 0.0001, 1);
    shift.makeTranslation(off, 0.002, off);
    shadow.matrix.copy(shift).multiply(flatten).multiply(egg.matrixWorld);
    shadowMat.opacity = P.shadowOpacity * Math.max(0.35, 1 - lift * 0.3);

    // Draw only when something changed: the egg moved, an animation runs, or a texture/color changed.
    // When the egg lies still (zero position, or the phone on the counter) the GPU can rest.
    const animating = animateGame(dt);
    const moved = egg.position.distanceToSquared(drawnPos) > 1e-7 || 1 - Math.abs(egg.quaternion.dot(drawnRot)) > 1e-8;
    if (moved || animating || sizing || dirty) {
      renderer.render(scene, camera);
      drawnPos.copy(egg.position);
      drawnRot.copy(egg.quaternion);
      dirty = false;
      stats.drawCount++;
    }
  }

  const api = {
    paint(text, colors, opts) { if (shell.paint(text, colors, opts)) dirty = true; },
    invalidate() { dirty = true; },
    setTilt(x, z) { tilt.x = x; tilt.z = z; },
    setGlow(color, amount) { eggMat.emissive.set(color).multiplyScalar(amount); dirty = true; },
    setShadowColor(color) { shadowMat.color.set(color); dirty = true; },
    // Outline color and a swell (0 = normal width)
    setOutline(color, pulse = 0) {
      if (outline.material.color.getHexString() === color.replace('#', '').toLowerCase() && pulse === outlinePulse) return;
      outline.material.color.set(color);
      outlinePulse = pulse;
      outline.scale.setScalar(1 + P.outline * (1 + pulse));
      dirty = true;
    },
    // true: glide to the zero position (setting the timer, or idle). false: let it roll.
    setPosed(on, speed = 9) {
      poseSpeed = speed;
      if (on === posed) return;
      posed = on;
      if (on) {
        eggBody.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
      } else {
        eggBody.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
        eggBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
        eggBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
        mass = eggBody.mass();
      }
    },
    applyParams,
    buildEgg,
    // Egg size as a scale (1 = medium). Springs there; the physics hull is rebuilt at once.
    setSize(s, force = false) {
      if (s === size.target && !force) return;
      size.target = s;
      buildCollider();
      resize();
    },
    eggScale() { return size.now; },
    // Re-measure the layout now (resting spot, walls), e.g. before placing UI around the egg
    relayout() { resize(); },
    // Shrink the shown egg while setting the timer (1 = full size, used while playing)
    setFit(f) { size.fit = f; },
    // Take this many pixels off the egg's lift (keeps its name clear of the block above)
    setLiftCut(px) { if (px !== liftCut) { liftCut = px; resize(); } },
    // Intro tour: move the resting egg (it glides there), hide/show it, and let it pop in from nothing
    setTourShift(px) { if (px !== tourShift) { tourShift = px; resize(); } },
    setEggVisible(v) { egg.visible = v; shadow.visible = v && P.shadowOpacity > 0; dirty = true; },
    popIn() { size.now = 0.02; size.vel = 0; dirty = true; },
    // Put the resting egg at its spot at once (no glide), e.g. before it pops in
    snapToPose() {
      eggBody.setTranslation({ x: posePos.x, y: posePos.y, z: posePos.z }, true);
      eggBody.setRotation({ x: poseRot.x, y: poseRot.y, z: poseRot.z, w: poseRot.w }, true);
      readBody(currPos, currRot);
      prevPos.copy(currPos);
      prevRot.copy(currRot);
      dirty = true;
    },
    // The resting egg on screen, in pixels: center, and how far down its bottom end reaches (at the target size)
    poseScreen() {
      const c = api.game.project(posePos.x, posePos.z);
      const b = api.game.project(posePos.x, posePos.z + P.eggLength * shown() / 2);
      const ppu = (b.y - c.y) / (P.eggLength * shown() / 2); // screen pixels per scene unit
      return { x: c.x, y: c.y, bottom: b.y, ppu };
    },
    jump(power = 1) {
      eggBody.applyImpulse({
        x: (Math.random() - 0.5) * 2 * mass * power,
        y: 7 * mass * power,
        z: (Math.random() - 0.5) * 2 * mass * power
      }, true);
      eggBody.applyTorqueImpulse({
        x: (Math.random() - 0.5) * 0.6 * mass * power,
        y: (Math.random() - 0.5) * 0.6 * mass * power,
        z: (Math.random() - 0.5) * 0.6 * mass * power
      }, true);
    },
    onBump(cb) { bumpHandler = cb; },
    // Where the big egg is now (on the floor)
    eggPos() { return { x: egg.position.x, z: egg.position.z }; },
    game: {
      // Show the next small egg at x, z with number n. colors: { shell, digit }
      showTarget(x, z, n, colors) {
        miniIdx = 1 - miniIdx;
        const m = minis[miniIdx];
        Object.assign(m.userData, { mode: 'in', t: 0, x, z, n });
        this.tintTarget(colors);
        m.visible = true;
      },
      // Recolor the current small egg (its countdown: yellow -> orange -> red -> light blue)
      tintTarget(colors) {
        const m = minis[miniIdx];
        if (m.userData.tex.paint('', { shell: colors.shell, dot: colors.shell, digit: colors.shell },
          { dotCount: 0, dotSize: 1, digitSize: 10, digitRepeat: 1 })) dirty = true;
        m.userData.label.userData.draw(String(m.userData.n), colors.digit);
      },
      // The current small egg pops
      popTarget() {
        const m = minis[miniIdx];
        if (m.userData.mode !== 'off') Object.assign(m.userData, { mode: 'pop', t: 0 });
      },
      // The dots that show where the next eggs come: [{ x, z }, ...]
      setDots(list) {
        dots.forEach((d, i) => {
          const p = list[i];
          d.visible = !!p;
          if (!p) return;
          if (p.x !== d.userData.x || p.z !== d.userData.z) d.userData.t = 0; // new dot: pop in
          d.userData.x = p.x;
          d.userData.z = p.z;
          d.position.set(p.x, 0.003, p.z);
        });
      },
      setDotColors(next, later) { dotMats[0].color.set(next); dotMats[1].color.set(later); dirty = true; },
      clear() {
        minis.forEach((m) => { if (m.userData.mode !== 'off') Object.assign(m.userData, { mode: 'pop', t: 0 }); });
        dots.forEach((d) => { d.visible = false; d.userData.x = NaN; });
        dirty = true;
      },
      // A line of the figure from a to b (floor points). grow: animate it; delay: seconds before it starts
      figLine(a, b, { grow = true, delay = 0 } = {}) {
        if (!figNow) figNow = lineGroup(P.figLineColor, P.figLineOpacity);
        const u = figNow.userData;
        const s = { ax: a.x, az: a.z, bx: b.x, bz: b.z, y: 0.001, k: grow ? 0 : 1, delay };
        s.strip = new THREE.Mesh(stripGeo, u.mat);
        s.capA = new THREE.Mesh(capGeo, u.mat);
        s.capB = new THREE.Mesh(capGeo, u.mat);
        for (const m of [s.strip, s.capA, s.capB]) { m.renderOrder = -3; figNow.add(m); }
        placeSeg(s, grow ? 0 : 1);
        if (grow || delay > 0) s.strip.visible = s.capA.visible = s.capB.visible = delay <= 0;
        u.segs.push(s);
        dirty = true;
      },
      // The figure is finished: it flashes up clear and fades out slowly, while the next one starts
      figDone() {
        if (!figNow) return;
        const u = figNow.userData;
        u.mode = 'done'; u.t = 0; u.from = u.mat.opacity;
        u.mat.color.set(P.figDoneColor);
        figOld.push(figNow);
        figNow = null;
        dirty = true;
      },
      // Hide the figure being drawn (quick fade), e.g. when the game stops
      figHide() {
        if (!figNow) return;
        const u = figNow.userData;
        u.mode = 'out'; u.t = 0; u.from = u.mat.opacity;
        figOld.push(figNow);
        figNow = null;
        dirty = true;
      },
      // The free area (between the title and the panel) in floor coordinates
      freeArea() {
        const r = focus.getBoundingClientRect();
        const c = container.getBoundingClientRect();
        const X = (px) => ((px - c.left) / c.width * 2 - 1) * floorHalf.x;
        const Z = (py) => ((py - c.top) / c.height * 2 - 1) * floorHalf.z;
        // Whole screen width, from the top of the screen down to the panel (the egg may roll a bit outside)
        const b = bottomEl ? Math.min(r.bottom, bottomEl.getBoundingClientRect().top) : r.bottom;
        return { x0: -floorHalf.x, x1: floorHalf.x, z0: -floorHalf.z, z1: Z(b) };
      },
      // Floor point -> screen pixels (for the floating "+1" labels)
      project(x, z) {
        const v = new THREE.Vector3(x, 0, z).project(camera);
        const c = container.getBoundingClientRect();
        return { x: c.left + (v.x + 1) / 2 * c.width, y: c.top + (1 - v.y) / 2 * c.height };
      }
    },
    stats,
    start(hook) {
      frameHook = hook;
      last = performance.now();
      requestAnimationFrame(frame);
    },
    // For debugging in the console: window.__egg
    debug: { world, eggBody, scene, camera, renderer, floor }
  };
  return api;
}
