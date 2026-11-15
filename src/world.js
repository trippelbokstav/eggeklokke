// The 3D scene (three.js) and the physics (Rapier): an egg rolling freely on the screen,
// seen straight from above. The edges of the screen are the walls.
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { createEggTexture } from './eggTexture.js';

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
export async function createWorld(container, P, focus = container) {
  await RAPIER.init();

  // ---------- three.js ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
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
  const minis = [0, 1].map(() => {
    const tex = createEggTexture();
    const m = new THREE.Mesh(egg.geometry, new THREE.MeshToonMaterial({ map: tex.texture, gradientMap }));
    m.visible = false;
    m.userData = { tex, mode: 'off', t: 0, x: 0, z: 0 }; // mode: in | idle | pop | off
    scene.add(m);
    return m;
  });
  let miniIdx = 0;
  const dotGeo = new THREE.CircleGeometry(1, 32);
  const dotMat = new THREE.MeshBasicMaterial({ color: 0xa9c8da, depthWrite: false });
  const dots = [0, 1].map(() => {
    const m = new THREE.Mesh(dotGeo, dotMat);
    m.rotation.x = -Math.PI / 2;
    m.visible = false;
    m.renderOrder = -2;
    m.userData = { t: 0, x: NaN, z: NaN };
    scene.add(m);
    return m;
  });
  const floorHalf = { x: 3, z: 5 }; // visible half size on the floor, set in resize()
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
  let poseSpeed = 9;     // glide speed to the zero position
  let outlinePulse = 0;
  const tmpPos = new THREE.Vector3();
  const tmpRot = new THREE.Quaternion();
  let eggCollider = null;
  let mass = 1;

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
    if (eggCollider) world.removeCollider(eggCollider, true);
    // Low-res hull for physics: the egg still wobbles, but collisions stay cheap
    const hull = new THREE.LatheGeometry(eggProfile(P.eggLength, P.eggWidth, P.eggPointy, 10), 14);
    eggCollider = world.createCollider(
      RAPIER.ColliderDesc.convexHull(new Float32Array(hull.attributes.position.array)).setDensity(1),
      eggBody
    );
    hull.dispose();
    mass = eggBody.mass();
    applyParams();
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
    posePos.y = P.eggWidth / 2;
    outline.visible = P.outline > 0;
    outline.scale.setScalar(1 + P.outline * (1 + outlinePulse));
    shadow.visible = P.shadowOpacity > 0;
    camera.fov = P.fov;
    resize();
  }

  function step() {
    if (posed) {
      // Glide to the zero position and stay there
      const t = eggBody.translation();
      const r = eggBody.rotation();
      const e = 1 - Math.exp(-STEP * poseSpeed);
      tmpPos.set(t.x, t.y, t.z).lerp(posePos, e);
      tmpRot.set(r.x, r.y, r.z, r.w).slerp(poseRot, e);
      eggBody.setNextKinematicTranslation({ x: tmpPos.x, y: tmpPos.y, z: tmpPos.z });
      eggBody.setNextKinematicRotation({ x: tmpRot.x, y: tmpRot.y, z: tmpRot.z, w: tmpRot.w });
      world.step();
      prevVel.set(0, 0, 0);
      return;
    }
    const g = P.gravity;
    world.gravity = { x: tilt.x * g * P.tilt, y: -g, z: tilt.z * g * P.tilt };


    world.step();

    // Bump detection: a sudden change in velocity that gravity can't explain
    const v = eggBody.linvel();
    const wg = world.gravity;
    const dv = Math.hypot(
      v.x - prevVel.x - wg.x * STEP,
      v.y - prevVel.y - wg.y * STEP,
      v.z - prevVel.z - wg.z * STEP
    );
    prevVel.set(v.x, v.y, v.z);
    const threshold = 0.8;
    if (dv > threshold && bumpHandler) bumpHandler(Math.min(1, (dv - threshold) / 4));

    // Safety: if the egg ends up well outside the screen (e.g. after a resize), put it back inside
    const p = eggBody.translation();
    const m = P.eggLength / 2;
    if (Math.abs(p.x) > bounds.x + m || Math.abs(p.z) > bounds.z + m || p.y < -1) {
      eggBody.setTranslation({
        x: THREE.MathUtils.clamp(p.x, -bounds.x + m, bounds.x - m),
        y: Math.max(p.y, P.eggWidth),
        z: THREE.MathUtils.clamp(p.z, -bounds.z + m, bounds.z - m)
      }, true);
    }
  }

  // ---------- Game layer animation ----------
  function animateGame(dt) {
    const sc = P.miniScale;
    minis.forEach((m) => {
      const u = m.userData;
      if (u.mode === 'off') return;
      u.t += dt;
      let k = 1;
      if (u.mode === 'in') {
        const t = Math.min(1, u.t / 0.35);
        k = backOut(t);
        if (t >= 1) { u.mode = 'idle'; u.t = 0; }
      } else if (u.mode === 'idle') {
        k = 1 + 0.04 * Math.sin(u.t * 4); // gentle breathing
      } else if (u.mode === 'pop') {
        const t = Math.min(1, u.t / 0.25);
        k = t < 0.35 ? 1 + 0.5 * (t / 0.35) : 1.5 * (1 - (t - 0.35) / 0.65);
        if (t >= 1) { u.mode = 'off'; m.visible = false; }
      }
      m.scale.setScalar(sc * Math.max(0.0001, k));
      m.position.set(u.x, posePos.y * sc * Math.max(0.0001, k), u.z);
      m.quaternion.copy(poseRot);
    });
    dots.forEach((d) => {
      if (!d.visible) return;
      d.userData.t += dt;
      d.scale.setScalar(P.markerSize * backOut(Math.min(1, d.userData.t / 0.3)));
    });
  }

  // ---------- Camera: straight down, far away ----------
  function resize() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
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
    const atEgg = dist - P.eggWidth / 2;
    // The walls sit outside the screen, so the egg can slip partly out of view before it bounces back
    const out = P.wallOut * P.eggWidth;
    const hx = atEgg * Math.tan(hHalf);
    const hz = atEgg * Math.tan(vHalf);
    placeWalls(hx + out, hz + out);
    // Zero position: the middle of the free area (between the title and the panel)
    const r = focus.getBoundingClientRect();
    const c = container.getBoundingClientRect();
    posePos.x = (((r.left + r.width / 2) - c.left) / w * 2 - 1) * hx;
    posePos.z = (((r.top + r.height / 2) - c.top) / h * 2 - 1) * hz;
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
  const stats = { fps: 0, physicsMs: 0, frames: 0, since: performance.now(), physSum: 0 };

  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (frameHook) frameHook(dt, now);

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
      stats.fps = Math.round(stats.frames * 1000 / (now - stats.since));
      stats.physicsMs = stats.physSum / stats.frames;
      stats.frames = 0;
      stats.physSum = 0;
      stats.since = now;
    }

    // Interpolate between physics steps (smooth on 120 Hz screens)
    const a = acc / STEP;
    egg.position.lerpVectors(prevPos, currPos, a);
    egg.quaternion.slerpQuaternions(prevRot, currRot, a);
    egg.updateMatrixWorld();

    // Shadow: flatten the egg onto the floor, shift it down-right (away from the light)
    const lift = Math.max(0, egg.position.y - P.eggWidth / 2);
    const off = P.shadowOffset * (1 + lift * 0.8);
    flatten.makeScale(1, 0.0001, 1);
    shift.makeTranslation(off, 0.002, off);
    shadow.matrix.copy(shift).multiply(flatten).multiply(egg.matrixWorld);
    shadowMat.opacity = P.shadowOpacity * Math.max(0.35, 1 - lift * 0.3);

    animateGame(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  return {
    paint: shell.paint,
    setTilt(x, z) { tilt.x = x; tilt.z = z; },
    setGlow(color, amount) { eggMat.emissive.set(color).multiplyScalar(amount); },
    setShadowColor(color) { shadowMat.color.set(color); },
    // Outline color and a swell (0 = normal width)
    setOutline(color, pulse = 0) {
      outline.material.color.set(color);
      outlinePulse = pulse;
      outline.scale.setScalar(1 + P.outline * (1 + pulse));
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
        m.userData.tex.paint(String(n), { shell: colors.shell, dot: colors.shell, digit: colors.digit },
          { dotCount: 0, dotSize: 1, digitSize: 300, digitRepeat: 1 });
        Object.assign(m.userData, { mode: 'in', t: 0, x, z });
        m.visible = true;
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
      setDotColor(color) { dotMat.color.set(color); },
      clear() {
        minis.forEach((m) => { if (m.userData.mode !== 'off') Object.assign(m.userData, { mode: 'pop', t: 0 }); });
        dots.forEach((d) => { d.visible = false; d.userData.x = NaN; });
      },
      // The free area (between the title and the panel) in floor coordinates
      freeArea() {
        const r = focus.getBoundingClientRect();
        const c = container.getBoundingClientRect();
        const X = (px) => ((px - c.left) / c.width * 2 - 1) * floorHalf.x;
        const Z = (py) => ((py - c.top) / c.height * 2 - 1) * floorHalf.z;
        return { x0: X(r.left), x1: X(r.right), z0: Z(r.top), z1: Z(r.bottom) };
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
}
