// The lab: sliders for every value in params.js. Open with ?lab in the address.
// Values are saved in this browser. "Kopier verdier" gives you JSON to paste to Claude.
import GUI from 'lil-gui';
import { DEFAULT_PARAMS, saveParams, clearParams } from './params.js';

export function createLab(P, world) {
  const gui = new GUI({ title: 'Eggelab' });
  gui.domElement.classList.add('egglab');

  const changed = () => { saveParams(P); world.applyParams(); };
  const reshaped = () => { saveParams(P); world.buildEgg(); };
  const repaint = () => saveParams(P); // the shell repaints by itself when values change

  const shape = gui.addFolder('Eggform');
  shape.add(P, 'eggLength', 1, 4.5, 0.05).name('lengde').onChange(reshaped);
  shape.add(P, 'eggWidth', 0.6, 3.5, 0.05).name('bredde').onChange(reshaped);
  shape.add(P, 'eggPointy', 0, 0.3, 0.01).name('spiss ende').onChange(reshaped);

  const look = gui.addFolder('Utseende');
  look.add(P, 'matchBackground').name('egg = bakgrunn').onChange(repaint);
  look.addColor(P, 'colorStart').name('farge start').onChange(repaint);
  look.addColor(P, 'lineColor').name('kant (innstilling) og prikker').onChange(repaint);
  look.addColor(P, 'outlineStart').name('kant start').onChange(repaint);
  look.addColor(P, 'outlineMid').name('kant midt').onChange(repaint);
  look.addColor(P, 'outlineEnd').name('kant slutt').onChange(repaint);
  look.add(P, 'pulse', 0, 4, 0.1).name('kant-puls').onChange(repaint);
  look.addColor(P, 'digitColor').name('klokke-farge').onChange(repaint);
  look.add(P, 'dotCount', 0, 600, 10).name('prikker antall').onChange(repaint);
  look.add(P, 'dotSize', 0.3, 30, 0.1).name('prikker størrelse').onChange(repaint);
  look.add(P, 'dotStrength', 0, 1, 0.01).name('prikker styrke').onChange(repaint);
  look.add(P, 'rough', 0, 3, 0.05).name('ru overflate').onChange(changed);
  look.add(P, 'shade', 0, 0.6, 0.01).name('skyggeside').onChange(changed);
  look.add(P, 'digitSize', 40, 200, 2).name('tall størrelse').onChange(repaint);
  look.add(P, 'digitRepeat', 1, 5, 1).name('tall rundt egget').onChange(repaint);
  look.add(P, 'outline', 0, 0.12, 0.005).name('omriss').onChange(changed);
  look.add(P, 'shadowOpacity', 0, 0.5, 0.01).name('skygge styrke').onChange(changed);
  look.add(P, 'shadowOffset', 0, 0.6, 0.01).name('skygge forskyvning').onChange(changed);

  const cam = gui.addFolder('Kamera');
  cam.add(P, 'fov', 4, 60, 1).name('perspektiv (fov)').onChange(changed);
  cam.add(P, 'view', 3, 16, 0.1).name('utsnitt (zoom)').onChange(changed);

  const phys = gui.addFolder('Fysikk');
  phys.add(P, 'gravity', 4, 40, 0.5).name('tyngdekraft').onChange(changed);
  phys.add(P, 'tilt', 0.1, 1, 0.01).name('vippe-styrke').onChange(changed);
  phys.add(P, 'friction', 0, 1.5, 0.01).name('friksjon').onChange(changed);
  phys.add(P, 'bounce', 0, 1, 0.01).name('sprett').onChange(changed);
  phys.add(P, 'linDamp', 0, 2, 0.01).name('demping fart').onChange(changed);
  phys.add(P, 'angDamp', 0, 3, 0.01).name('demping rotasjon').onChange(changed);

  const beh = gui.addFolder('Oppførsel');
  beh.add(P, 'idleSec', 2, 60, 1).name('hjem etter (s)').onChange(changed);
  beh.add(P, 'homeSpeed', 0.5, 10, 0.1).name('hjem-fart').onChange(changed);
  beh.add(P, 'wallOut', -0.2, 1, 0.01).name('vegg utenfor kant').onChange(changed);
  beh.add(P, 'alarmJump', 0, 3, 0.05).name('alarm-hopp').onChange(changed);

  const actions = {
    copy() {
      const json = JSON.stringify(P, null, 2);
      showCopyBox(json);
      try { if (navigator.clipboard) navigator.clipboard.writeText(json).catch(() => {}); } catch (e) { /* http: no clipboard */ }
    },
    reset() {
      clearParams();
      Object.assign(P, DEFAULT_PARAMS);
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
      world.buildEgg();
    },
    jump() { world.jump(P.alarmJump || 1); }
  };
  gui.add(actions, 'jump').name('🥚 Test hopp');
  gui.add(actions, 'copy').name('📋 Kopier verdier');
  gui.add(actions, 'reset').name('↺ Nullstill');

  // Folders start closed, and on small screens the whole lab too, so the egg is visible
  [shape, look, cam, phys, beh].forEach((f) => f.close());
  if (window.innerWidth < 600) gui.close();
  return gui;
}

// A box with the JSON, selected and ready to copy (the clipboard API needs https)
function showCopyBox(text) {
  let box = document.querySelector('.copybox');
  if (!box) {
    box = document.createElement('div');
    box.className = 'copybox';
    box.innerHTML = '<p>Kopier og lim inn til Claude:</p><textarea readonly></textarea><button type="button">Lukk</button>';
    box.querySelector('button').addEventListener('click', () => box.remove());
    document.body.appendChild(box);
  }
  const ta = box.querySelector('textarea');
  ta.value = text;
  ta.focus();
  ta.select();
}
