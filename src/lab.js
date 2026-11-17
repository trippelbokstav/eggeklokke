// The lab: sliders for every value in params.js. Open with ?lab in the address.
// Values are saved in this browser. "Kopier verdier" gives you JSON to paste to Claude.
import GUI from 'lil-gui';
import { DEFAULT_PARAMS, saveParams, clearParams } from './params.js';

// diag: { haptics, gyro, testHaptic(), askGyro() } from main.js
export function createLab(P, world, diag) {
  const gui = new GUI({ title: 'Eggelab' });
  gui.domElement.classList.add('egglab');

  const changed = () => { saveParams(P); world.applyParams(); };
  const reshaped = () => { saveParams(P); world.buildEgg(); };
  const repaint = () => saveParams(P); // the shell repaints by itself when values change

  const shape = gui.addFolder('Eggform');
  shape.add(P, 'eggLength', 1, 4.5, 0.05).name('lengde').onChange(reshaped);
  shape.add(P, 'eggWidth', 0.6, 3.5, 0.05).name('bredde').onChange(reshaped);
  shape.add(P, 'eggPointy', 0, 0.3, 0.01).name('spiss ende').onChange(reshaped);
  shape.add(P, 'sizeSmall', 0.5, 1, 0.01).name('lite egg (skala)').onChange(() => { saveParams(P); diag && diag.resize && diag.resize(); });
  shape.add(P, 'sizeLarge', 1, 1.6, 0.01).name('stort egg (skala)').onChange(() => { saveParams(P); diag && diag.resize && diag.resize(); });
  shape.add(P, 'sizeStiff', 40, 800, 5).name('størrelse spring').onChange(repaint);
  shape.add(P, 'sizeDamp', 2, 40, 0.5).name('størrelse demping').onChange(repaint);

  // Placement and text: Y offsets in pixels for each block on the setup screen
  const relayout = () => { saveParams(P); if (diag && diag.layout) diag.layout(); };
  const pos = gui.addFolder('Plassering');
  pos.add(P, 'posAlt', -150, 150, 1).name('høyde-blokka (px)').onChange(relayout);
  pos.add(P, 'eggLift', -150, 150, 1).name('egget: løft (px)').onChange(relayout);
  pos.add(P, 'posYolk', -150, 150, 1).name('plommeraden (px)').onChange(relayout);
  pos.add(P, 'posStart', -150, 150, 1).name('Start (px)').onChange(relayout);
  const txt = gui.addFolder('Tekst');
  txt.add(P, 'txtAlt', -60, 60, 1).name('høyde-tekst (px)').onChange(relayout);
  txt.add(P, 'txtEgg', -60, 60, 1).name('egg-navn (px)').onChange(relayout);
  txt.add(P, 'txtYolk', -60, 60, 1).name('plomme-navn (px)').onChange(relayout);

  const yolk = gui.addFolder('Plomme');
  const yolkChanged = () => { saveParams(P); if (diag && diag.yolk) diag.yolk.wake(); };
  yolk.add(P, 'yolkSoftStiff', 30, 800, 5).name('til bløt: spring').onChange(yolkChanged);
  yolk.add(P, 'yolkSoftDamp', 1, 60, 0.5).name('til bløt: demping').onChange(yolkChanged);
  yolk.add(P, 'yolkSmileStiff', 30, 800, 5).name('til smilende: spring').onChange(yolkChanged);
  yolk.add(P, 'yolkSmileDamp', 1, 60, 0.5).name('til smilende: demping').onChange(yolkChanged);
  yolk.add(P, 'yolkHardStiff', 30, 800, 5).name('til hard: spring').onChange(yolkChanged);
  yolk.add(P, 'yolkHardDamp', 1, 60, 0.5).name('til hard: demping').onChange(yolkChanged);
  yolk.add(P, 'yolkLobe', 0, 1, 0.01).name('bløt: splash').onChange(yolkChanged);
  yolk.add(P, 'yolkWaist', 0.3, 1, 0.01).name('bløt: midje').onChange(yolkChanged);
  yolk.add(P, 'yolkSmile', 0, 1.5, 0.05).name('smilende: smil (0 = sirkel)').onChange(yolkChanged);
  yolk.addColor(P, 'yolkSoftColor').name('farge bløt').onChange(yolkChanged);
  yolk.addColor(P, 'yolkSmileColor').name('farge smilende').onChange(yolkChanged);
  yolk.addColor(P, 'yolkHardColor').name('farge hard').onChange(yolkChanged);

  const terr = gui.addFolder('Terreng');
  const terrChanged = () => { saveParams(P); if (diag && diag.terrain) diag.terrain.wake(); };
  terr.add(P, 'terrainHeight', 10, 88, 1).name('fjellhøyde (px)').onChange(terrChanged);
  terr.add(P, 'terrainSharp', 0, 2, 0.05).name('skarphet').onChange(terrChanged);
  terr.add(P, 'terrainOct', 1, 8, 0.5).name('detalj (oktaver)').onChange(terrChanged);
  terr.add(P, 'terrainWidth', 0.3, 2, 0.05).name('massiv bredde').onChange(terrChanged);
  terr.add(P, 'terrainFreq', 0.3, 3, 0.05).name('antall topper').onChange(terrChanged);
  terr.add(P, 'terrainLag', 5, 300, 1).name('følge (lav = mer lag)').onChange(terrChanged);
  terr.add(P, 'terrainDamp', 1, 40, 0.5).name('demping').onChange(terrChanged);
  terr.add(P, 'terrainScroll', 0, 5, 0.1).name('gli gjennom landskap').onChange(terrChanged);
  terr.add(P, 'terrainChaos', 0, 4, 0.1).name('kaos ved fart').onChange(terrChanged);
  terr.add(P, 'terrainLine', 0.5, 4, 0.25).name('linjetykkelse').onChange(terrChanged);

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
  cam.add(P, 'fov', 1, 60, 0.5).name('perspektiv (fov)').onChange(changed);
  cam.add(P, 'view', 3, 16, 0.1).name('utsnitt (zoom)').onChange(changed);
  cam.add(P, 'pixelRatio', 0.75, 3, 0.25).name('oppløsning').onChange(changed);

  const gyro = gui.addFolder('Gyro');
  gyro.add(P, 'gyroAbsolute').name('vannrett = null').onChange(repaint);
  gyro.add(P, 'gyroRange', 5, 60, 1).name('vinkel for full fart (°)').onChange(repaint);
  gyro.add(P, 'gyroDead', 0, 10, 0.1).name('dødsone (°)').onChange(repaint);
  gyro.add(P, 'gyroSmooth', 0.01, 1, 0.01).name('glatting (s)').onChange(repaint);
  gyro.add(P, 'tilt', 0.1, 1.5, 0.01).name('vippe-styrke').onChange(changed);
  gyro.add(P, 'stillDeg', 0.2, 5, 0.1).name('stille-grense (°)').onChange(repaint);
  if (diag) {
    gyro.add(diag.gyro, 'tiltX').name('vipp nå: sideveis').disable().listen();
    gyro.add(diag.gyro, 'tiltZ').name('vipp nå: fram/bak').disable().listen();
    gyro.add(diag, 'calibrate').name('🎯 Kalibrer: «flatt» = slik du holder nå');
  }

  const phys = gui.addFolder('Fysikk');
  phys.add(P, 'gravity', 4, 40, 0.5).name('tyngdekraft').onChange(changed);
  phys.add(P, 'friction', 0, 1.5, 0.01).name('friksjon').onChange(changed);
  phys.add(P, 'bounce', 0, 1, 0.01).name('sprett').onChange(changed);
  phys.add(P, 'linDamp', 0, 2, 0.01).name('demping fart').onChange(changed);
  phys.add(P, 'angDamp', 0, 3, 0.01).name('demping rotasjon').onChange(changed);

  const game = gui.addFolder('Spill');
  game.add(P, 'gameOn').name('spill på').onChange(repaint);
  game.add(P, 'miniScale', 0.1, 0.6, 0.01).name('småegg størrelse').onChange(repaint);
  game.add(P, 'pickup', 0.05, 1, 0.01).name('treff-radius').onChange(repaint);
  game.add(P, 'comboSec', 1, 10, 0.5).name('bonus-tid per egg (s)').onChange(repaint);
  game.addColor(P, 'miniOrange').name('nedtelling midt').onChange(repaint);
  game.add(P, 'ticks').name('tikking').onChange(repaint);
  game.add(P, 'spotInset', 0, 0.35, 0.01).name('avstand fra kant').onChange(repaint);
  game.add(P, 'bumpPenalty', 0, 5, 1).name('minus per dult').onChange(repaint);
  game.add(P, 'dotNextSize', 0.005, 0.2, 0.005).name('prikk neste (gul)').onChange(repaint);
  game.add(P, 'dotLaterSize', 0.005, 0.2, 0.005).name('prikk etter (blå)').onChange(repaint);

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
  // Diagnose: what the phone actually does (haptics + gyro)
  if (diag) {
    const d = gui.addFolder('Diagnose');
    const h = diag.haptics;
    const g = diag.gyro;
    d.add(world.stats, 'fps').name('bilder per sekund').disable().listen();
    d.add(world.stats, 'draws').name('tegner per sekund').disable().listen();
    d.add(h, 'native').name('kjører som app').disable().listen();
    d.add(h, 'plugin').name('haptics-plugin').disable().listen();
    d.add(h, 'calls').name('haptics kalt').disable().listen();
    d.add(h, 'ok').name('haptics ok').disable().listen();
    d.add(h, 'lastError').name('haptics feil').disable().listen();
    d.add(g, 'api').name('gyro-API').disable().listen();
    d.add(g, 'askApi').name('tillatelse-API').disable().listen();
    d.add(g, 'permission').name('gyro-tillatelse').disable().listen();
    d.add(g, 'events').name('gyro-hendelser').disable().listen();
    d.add(g, 'beta').name('vipp fram/bak').disable().listen();
    d.add(g, 'gamma').name('vipp sideveis').disable().listen();
    d.add(diag, 'testHaptic').name('📳 Test alarm-vibrasjon');
    d.add(diag, 'testLight').name('Test lett støt');
    d.add(diag, 'testMedium').name('Test middels støt (vegg)');
    d.add(diag, 'testHeavy').name('Test kraftig støt (vegg)');
    d.add(diag, 'testPickup').name('Test plukk-egg');
    d.add(diag, 'askGyro').name('🧭 Be om gyro-tilgang');
    d.close();
  }

  gui.add(actions, 'jump').name('🥚 Test hopp');
  gui.add(actions, 'copy').name('📋 Kopier verdier');
  gui.add(actions, 'reset').name('↺ Nullstill');

  // Folders start closed, and on small screens the whole lab too, so the egg is visible
  [shape, look, cam, gyro, phys, game, beh].forEach((f) => f.close());
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
