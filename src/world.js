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

// Two-tone gradient = flat, graphic shading
function toonGradient() {
  const data = new Uint8Array([170, 170, 170, 255, 255, 255, 255, 255]);
  const tex = new THREE.DataTexture(data, 2, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

export async function createWorld(container, P) {
  await RAPIER.init();

  // ---------- three.js ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(P.fov, 1, 1, 500);
  camera.up.set(0, 0, -1); // screen up = world -Z

  scene.add(new THREE.AmbientLight(0xffffff, 1.5));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
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

  const startRot = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, 0.4, Math.PI / 2));
  const eggBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(0, 2, 0)
      .setRotation({ x: startRot.x, y: startRot.y, z: startRot.z, w: startRot.w })
      .setCanSleep(false)
  );
  let eggCollider = null;
  let mass = 1;

  // ---------- State ----------
  const tilt = { x: 0, z: 0 };
  let centerPull = false;
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
    eggBody.setAngularDamping(centerPull ? Math.max(1.6, P.angDamp) : P.angDamp);
    eggMat.bumpScale = P.rough * 2;
    outline.visible = P.outline > 0;
    outline.scale.setScalar(1 + P.outline);
    shadow.visible = P.shadowOpacity > 0;
    camera.fov = P.fov;
    resize();
  }

  function step() {
    const g = P.gravity;
    world.gravity = { x: tilt.x * g * P.tilt, y: -g, z: tilt.z * g * P.tilt };

    eggBody.resetForces(true);
    if (centerPull) {
      // Soft spring towards the middle, with damping, so the egg settles
      const p = eggBody.translation();
      const v = eggBody.linvel();
      const k = P.centerSpring;
      const c = Math.sqrt(k);
      eggBody.addForce({ x: mass * (-k * p.x - c * v.x), y: 0, z: mass * (-k * p.z - c * v.z) }, true);
    }

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
    const threshold = 1.1;
    if (dv > threshold && bumpHandler) bumpHandler(Math.min(1, (dv - threshold) / 5));

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
    // Visible area at the height of the egg's middle, a little inside the edge
    const atEgg = dist - P.eggWidth / 2;
    // Keep the outline and the shadow inside the screen too
    const inset = 0.06 + P.shadowOffset;
    placeWalls(atEgg * Math.tan(hHalf) - inset, atEgg * Math.tan(vHalf) - inset);
  }
  new ResizeObserver(resize).observe(container);

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

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  return {
    paint: shell.paint,
    setTilt(x, z) { tilt.x = x; tilt.z = z; },
    setCenterPull(on) {
      if (on === centerPull) return;
      centerPull = on;
      eggBody.setAngularDamping(on ? Math.max(1.6, P.angDamp) : P.angDamp);
    },
    setGlow(color, amount) { eggMat.emissive.set(color).multiplyScalar(amount); },
    setLineColor(color) {
      outline.material.color.set(color);
      shadowMat.color.set(color);
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
