// The egg shell is painted on a canvas: faint random dots + the time in low contrast,
// repeated around the egg so you can read it whichever way the egg lies.
// A second canvas holds fine noise, used as a bump map for a slightly rough shell.
import * as THREE from 'three';

const FONT = '"Nunito", "Avenir Next", system-ui, sans-serif';

// Small seeded random, so the dots stay in the same place every repaint
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeBump() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(c.width, c.height);
  const r = rng(7);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (r() - 0.5) * 90;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  // Soften: draw it blurred on top, so it reads as a soft grain, not pixel noise
  ctx.filter = 'blur(1px)';
  ctx.drawImage(c, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(2, 1);
  return tex;
}

// w, h: canvas size. The small eggs use a smaller canvas, so recoloring them every frame stays cheap.
export function createEggTexture(W = 1024, H = 512) {
  const k = H / 512; // sizes in opts are given for a 512 px high canvas
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const bump = makeBump();

  let last = '';

  // colors: { shell, dot, digit }, opts: { dotCount, dotSize, digitSize, digitRepeat }
  function paint(timeText, colors, opts) {
    const key = [timeText, colors.shell, colors.dot, colors.digit, opts.dotCount, opts.dotSize, opts.digitSize, opts.digitRepeat].join('|');
    if (key === last) return;
    last = key;

    ctx.fillStyle = colors.shell;
    ctx.fillRect(0, 0, W, H);

    // Faint random dots (skip the poles, where the texture is squeezed)
    ctx.fillStyle = colors.dot;
    const r = rng(42);
    for (let i = 0; i < opts.dotCount; i++) {
      const x = r() * W;
      const y = H * (0.1 + r() * 0.8);
      const size = opts.dotSize * k * (0.6 + r() * 0.8);
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
      if (x < size) { ctx.beginPath(); ctx.arc(x + W, y, size, 0, Math.PI * 2); ctx.fill(); } // wrap the seam
    }

    // The time, repeated around the egg's waist
    const repeat = Math.max(1, Math.round(opts.digitRepeat));
    const cell = W / repeat;
    let size = opts.digitSize * k;
    ctx.font = `800 ${size}px ${FONT}`;
    const width = ctx.measureText(timeText).width;
    if (width > cell * 0.85) {
      size = Math.floor(size * (cell * 0.85) / width);
      ctx.font = `800 ${size}px ${FONT}`;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = colors.digit;
    for (let i = 0; i < repeat; i++) ctx.fillText(timeText, cell * (i + 0.5), H / 2 + size * 0.04);

    texture.needsUpdate = true;
  }

  return { texture, bump, paint };
}
