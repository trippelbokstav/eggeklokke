// The 3D scene (three.js) and the physics (Rapier): an egg rolling in a shallow dish
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { createEggTexture } from './eggTexture.js';

// Sizes in scene units (the egg is about 1 unit long)
const EGG_L = 1.45;
const EGG_W = 1.1;
const DISH_R = 1.85;      // flat-ish bottom of the dish
const DISH_DEPTH = 0.3;   // how much the bottom curves up towards the edge
const RIM_R = 2.25;       // top of the wall
const RIM_H = 0.8;
const G = 18;             // gravity (stronger than real, feels livelier at this scale)
const TILT_G = 0.55;      // how much of G tilting can turn sideways
const STEP = 1 / 60;

// Height of the dish surface at radius r
export function dishY(r) {
  if (r <= DISH_R) return DISH_DEPTH * (r / DISH_R) ** 2;
  const t = Math.min(1, (r - DISH_R) / (RIM_R - DISH_R));
  return DISH_DEPTH + (RIM_H - DISH_DEPTH) * (1 - Math.cos(t * Math.PI / 2));
}

function eggProfile(n = 40) {
  // From the blunt end (bottom) to the pointy end (top)
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI;
    const y = -Math.cos(t) * EGG_L / 2;
    const r = (EGG_W / 2) * Math.sin(t) * (1 + 0.11 * Math.cos(t));
    pts.push(new THREE.Vector2(Math.max(r, 0), y));
  }
  return pts;
}

function dishProfile(n = 28) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const r = (i / n) * RIM_R;
    pts.push(new THREE.Vector2(r, dishY(r)));
  }
  return pts;
}

// Two-tone gradient = flat, graphic shading
function toonGradient() {
  const data = new Uint8Array([150, 150, 150, 255, 255, 255, 255, 255]);
  const tex = new THREE.DataTexture(data, 2, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

export async function createWorld(container) {
  await RAPIER.init();

  // ---------- three.js ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const target = new THREE.Vector3(0, 0.25, 0.15);
  const viewDir = new THREE.Vector3(0, Math.sin(THREE.MathUtils.degToRad(58)), Math.cos(THREE.MathUtils.degToRad(58)));

  scene.add(new THREE.AmbientLight(0xffffff, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(-3, 7, 4);
  scene.add(sun);

  const gradientMap = toonGradient();

  // Dish
  const dishGeo = new THREE.LatheGeometry(dishProfile(), 64);
  const dishMat = new THREE.MeshToonMaterial({ color: 0xdde7ea, gradientMap, side: THREE.DoubleSide });
  const dish = new THREE.Mesh(dishGeo, dishMat);
  scene.add(dish);

  const lipGeo = new THREE.RingGeometry(RIM_R, RIM_R + 0.22, 96);
  const lipMat = new THREE.MeshBasicMaterial({ color: 0xc9d7dc, side: THREE.DoubleSide });
  const lip = new THREE.Mesh(lipGeo, lipMat);
  lip.rotation.x = -Math.PI / 2;
  lip.position.y = RIM_H;
  scene.add(lip);

  const circle = (radius, y) => {
    const pts = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * radius, y, Math.sin(a) * radius));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  };
  const lineMat = new THREE.LineBasicMaterial({ color: 0x14303b });
  scene.add(new THREE.Line(circle(RIM_R + 0.22, RIM_H), lineMat));
  scene.add(new THREE.Line(circle(RIM_R, RIM_H + 0.001), lineMat));

  // Egg
  const eggGeo = new THREE.LatheGeometry(eggProfile(), 48);
  const shell = createEggTexture();
  const eggMat = new THREE.MeshToonMaterial({ map: shell.texture, gradientMap, emissive: 0x000000 });
  const egg = new THREE.Mesh(eggGeo, eggMat);
  const outline = new THREE.Mesh(eggGeo, new THREE.MeshBasicMaterial({ color: 0x14303b, side: THREE.BackSide }));
  outline.scale.setScalar(1.035);
  egg.add(outline);
  scene.add(egg);

  // Flat blob shadow
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x14303b, transparent: true, opacity: 0.14, depthWrite: false });
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.6, 40), shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  scene.add(shadow);

  // ---------- Rapier ----------
  const world = new RAPIER.World({ x: 0, y: -G, z: 0 });
  world.timestep = STEP;

  // Dish as a triangle mesh: same shape as the visible dish, but far fewer triangles (cheaper physics)
  const dishColGeo = new THREE.LatheGeometry(dishProfile(12), 32);
  const dishBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(
    RAPIER.ColliderDesc.trimesh(
      new Float32Array(dishColGeo.attributes.position.array),
      new Uint32Array(dishColGeo.index.array)
    ).setFriction(0.8).setRestitution(0.25),
    dishBody
  );
  // Invisible fence above the rim, so the egg never leaves the dish
  const fence = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a);
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.1, 2.5, 0.42)
        .setTranslation(Math.cos(a) * (RIM_R + 0.1), RIM_H + 2.3, Math.sin(a) * (RIM_R + 0.1))
        .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
        .setFriction(0.3).setRestitution(0.3),
      fence
    );
  }

  // Egg as a convex hull of the egg mesh: it wobbles and rolls in curves like a real egg
  const startRot = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, 0.4, Math.PI / 2));
  const eggBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(0, 1.6, 0)
      .setRotation({ x: startRot.x, y: startRot.y, z: startRot.z, w: startRot.w })
      .setCanSleep(false)
      .setLinearDamping(0.15)
      .setAngularDamping(0.35)
  );
  world.createCollider(
    // Low-res hull for physics: the egg still wobbles, but collisions are much cheaper
    RAPIER.ColliderDesc.convexHull(new Float32Array(new THREE.LatheGeometry(eggProfile(10), 14).attributes.position.array))
      .setDensity(1).setFriction(0.7).setRestitution(0.3),
    eggBody
  );
  const mass = eggBody.mass();

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
  readBody(currPos, currRot);
  prevPos.copy(currPos);
  prevRot.copy(currRot);

  function resetEgg() {
    eggBody.setTranslation({ x: 0, y: 1.6, z: 0 }, true);
    eggBody.setRotation({ x: startRot.x, y: startRot.y, z: startRot.z, w: startRot.w }, true);
    eggBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
    eggBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  function step() {
    world.gravity = { x: tilt.x * G * TILT_G, y: -G, z: tilt.z * G * TILT_G };

    eggBody.resetForces(true);
    if (centerPull) {
      // Soft spring towards the middle, with damping, so the egg settles
      const p = eggBody.translation();
      const v = eggBody.linvel();
      const k = 5;
      const c = 2.2;
      eggBody.addForce({ x: mass * (-k * p.x - c * v.x), y: 0, z: mass * (-k * p.z - c * v.z) }, true);
    }

    world.step();

    // Bump detection: a sudden change in velocity that gravity can't explain
    const v = eggBody.linvel();
    const g = world.gravity;
    const dv = Math.hypot(
      v.x - prevVel.x - g.x * STEP,
      v.y - prevVel.y - g.y * STEP,
      v.z - prevVel.z - g.z * STEP
    );
    prevVel.set(v.x, v.y, v.z);
    const threshold = 1.1;
    if (dv > threshold && bumpHandler) bumpHandler(Math.min(1, (dv - threshold) / 5));

    // Safety: if the egg somehow escapes, put it back
    const p = eggBody.translation();
    if (p.y < -2 || Math.hypot(p.x, p.z) > RIM_R + 1.5) resetEgg();
  }

  // ---------- Camera fit ----------
  function resize() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Distance so the whole dish fits, whatever the aspect ratio
    const radius = RIM_R + 0.45;
    const vHalf = THREE.MathUtils.degToRad(camera.fov / 2);
    const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
    const dist = radius / Math.sin(Math.min(vHalf, hHalf));
    camera.position.copy(target).addScaledVector(viewDir, dist);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  resize();

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

    const r = Math.hypot(egg.position.x, egg.position.z);
    const lift = Math.max(0, egg.position.y - dishY(r) - EGG_W / 2);
    shadow.position.set(egg.position.x, dishY(r) + 0.01, egg.position.z);
    shadow.scale.setScalar(Math.max(0.4, 1 - lift * 0.35));
    shadowMat.opacity = 0.14 * Math.max(0.3, 1 - lift * 0.4);

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  return {
    paint: shell.paint,
    setTilt(x, z) { tilt.x = x; tilt.z = z; },
    setCenterPull(on) {
      if (on === centerPull) return;
      centerPull = on;
      eggBody.setAngularDamping(on ? 1.6 : 0.35);
    },
    setGlow(color, amount) { eggMat.emissive.set(color).multiplyScalar(amount); },
    setTheme({ dish: d, lip: l, line, shadow: s }) {
      dishMat.color.set(d);
      lipMat.color.set(l);
      lineMat.color.set(line);
      outline.material.color.set(line);
      shadowMat.color.set(s);
    },
    jump(power = 1) {
      eggBody.applyImpulse({
        x: (Math.random() - 0.5) * 2 * mass * power,
        y: 7 * mass * power,
        z: (Math.random() - 0.5) * 2 * mass * power
      }, true);
      eggBody.applyTorqueImpulse({
        x: (Math.random() - 0.5) * 0.3 * mass * power,
        y: (Math.random() - 0.5) * 0.3 * mass * power,
        z: (Math.random() - 0.5) * 0.3 * mass * power
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
    debug: { world, eggBody, scene, camera, renderer }
  };
}
