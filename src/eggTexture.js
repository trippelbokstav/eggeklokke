// The egg shell is painted on a canvas: dots + a band with the time, repeated
// around the egg so you can always read it, whichever way the egg lies.
import * as THREE from 'three';

const W = 1024;
const H = 512;
const REPEAT = 3;            // the time is painted this many times around the egg
const BAND_TOP = 196;        // band in canvas pixels (v near the egg's waist)
const BAND_BOTTOM = 316;

export function createEggTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;

  let last = '';

  // colors: { shell, dot, band, ink }
  function paint(timeText, colors) {
    const key = timeText + colors.shell + colors.dot + colors.band + colors.ink;
    if (key === last) return;
    last = key;

    ctx.fillStyle = colors.shell;
    ctx.fillRect(0, 0, W, H);

    // Dots in offset rows, above and below the band
    ctx.fillStyle = colors.dot;
    const rows = [
      { y: 64, r: 13 }, { y: 128, r: 17 },
      { y: 384, r: 17 }, { y: 448, r: 13 }
    ];
    rows.forEach((row, i) => {
      const count = 12;
      const offset = (i % 2) * (W / count / 2);
      for (let k = 0; k <= count; k++) {
        ctx.beginPath();
        ctx.arc(k * (W / count) + offset, row.y, row.r, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // The band
    ctx.fillStyle = colors.band;
    ctx.fillRect(0, BAND_TOP, W, BAND_BOTTOM - BAND_TOP);
    ctx.fillStyle = colors.ink;
    ctx.fillRect(0, BAND_TOP - 6, W, 4);
    ctx.fillRect(0, BAND_BOTTOM + 2, W, 4);

    // The time, REPEAT times around
    const cell = W / REPEAT;
    let size = 104;
    ctx.font = `800 ${size}px "Nunito", "Avenir Next", system-ui, sans-serif`;
    const width = ctx.measureText(timeText).width;
    if (width > cell * 0.82) {
      size = Math.floor(size * (cell * 0.82) / width);
      ctx.font = `800 ${size}px "Nunito", "Avenir Next", system-ui, sans-serif`;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cy = (BAND_TOP + BAND_BOTTOM) / 2 + 4;
    for (let i = 0; i < REPEAT; i++) {
      const cx = cell * (i + 0.5);
      ctx.fillText(timeText, cx, cy);
    }

    texture.needsUpdate = true;
  }

  return { texture, paint };
}
