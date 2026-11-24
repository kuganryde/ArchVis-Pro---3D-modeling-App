/**
 * Draws every finish pattern (tiles, timber, stone, wallpapers) onto a canvas and
 * wraps it as a three.js texture. One texture repeat covers `repeat` metres, so
 * callers map UVs in metres and a 60 cm tile is 60 cm in any room.
 *
 * Browser only: needs a canvas. Patterns are seeded from the finish id, so a finish
 * looks identical every time it is drawn.
 */
import * as THREE from 'three';
import type { Finish, FinishPattern } from '../house/finishes';

/** Cells of the tile pattern drawn in one repeat, [across, down], so tones can vary tile to tile. */
const CELLS: Partial<Record<FinishPattern, [number, number]>> = {
  grid: [2, 2], checker: [2, 2], plank: [1, 4], zellige: [3, 3],
};

export const repeatMeters = (f: Finish): [number, number] => {
  const [cx, cy] = CELLS[f.pattern] ?? [1, 1];
  return [f.tile[0] * cx, f.tile[1] * cy];
};

function rng(seedStr: string): () => number {
  let a = 2166136261;
  for (let i = 0; i < seedStr.length; i++) { a ^= seedStr.charCodeAt(i); a = Math.imul(a, 16777619); }
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Lighten (amt > 0) or darken (amt < 0) a hex colour. */
function tone(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt * 255)));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

type Ctx = CanvasRenderingContext2D;

/** Draw a shape at its position and at every wrapped offset so the repeat is seamless. */
function wrapped(w: number, h: number, draw: (dx: number, dy: number) => void) {
  for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) draw(dx, dy);
}

function speckle(ctx: Ctx, w: number, h: number, r: () => number, amount: number, color = '#000') {
  ctx.save();
  ctx.globalAlpha = amount;
  ctx.fillStyle = color;
  const n = Math.round((w * h) / 90);
  for (let i = 0; i < n; i++) ctx.fillRect(r() * w, r() * h, 1 + r() * 1.5, 1 + r() * 1.5);
  ctx.restore();
}

function drawGrid(ctx: Ctx, f: Finish, w: number, h: number, r: () => number, nx: number, ny: number) {
  const tw = w / nx, th = h / ny, g = Math.max(1.5, Math.min(tw, th) * 0.018);
  ctx.fillStyle = f.colors[1] ?? '#cccccc';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    ctx.fillStyle = tone(f.colors[0], (r() - 0.5) * 0.06);
    ctx.fillRect(i * tw + g / 2, j * th + g / 2, tw - g, th - g);
    if (f.kind === 'stone') speckle(ctx, w, h, r, 0.04);
  }
}

function drawMarble(ctx: Ctx, f: Finish, w: number, h: number, r: () => number) {
  ctx.fillStyle = f.colors[0];
  ctx.fillRect(0, 0, w, h);
  // Soft cloud
  for (let i = 0; i < 14; i++) {
    const gr = ctx.createRadialGradient(r() * w, r() * h, 0, r() * w, r() * h, w * (0.2 + r() * 0.3));
    gr.addColorStop(0, tone(f.colors[2] ?? f.colors[0], 0)); gr.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha = 0.08; ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
  }
  ctx.globalAlpha = 1;
  // Veins
  ctx.lineCap = 'round';
  for (let v = 0; v < 6; v++) {
    ctx.strokeStyle = f.colors[1];
    ctx.globalAlpha = 0.25 + r() * 0.5;
    ctx.lineWidth = 0.5 + r() * 2.5;
    ctx.beginPath();
    let x = r() * w, y = 0;
    ctx.moveTo(x, y);
    while (y < h) { y += 10 + r() * 24; x += (r() - 0.5) * 60; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = tone(f.colors[0], -0.12); ctx.lineWidth = 3; ctx.strokeRect(0, 0, w, h);
}

function drawTerrazzo(ctx: Ctx, f: Finish, w: number, h: number, r: () => number) {
  ctx.fillStyle = f.colors[0]; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 110; i++) {
    const x = r() * w, y = r() * h, s = 3 + r() * 11, a = r() * Math.PI;
    const col = f.colors[1 + Math.floor(r() * (f.colors.length - 1))];
    const pts = Array.from({ length: 5 }, (_, k) => { const ang = a + (k / 5) * Math.PI * 2; const rad = s * (0.6 + r() * 0.5); return [Math.cos(ang) * rad, Math.sin(ang) * rad]; });
    wrapped(w, h, (dx, dy) => {
      ctx.beginPath(); pts.forEach(([px, py], k) => (k ? ctx.lineTo(x + dx + px, y + dy + py) : ctx.moveTo(x + dx + px, y + dy + py)));
      ctx.closePath(); ctx.fillStyle = col; ctx.fill();
    });
  }
}

function drawPlank(ctx: Ctx, f: Finish, w: number, h: number, r: () => number) {
  const rows = 4, ph = h / rows;
  for (let j = 0; j < rows; j++) {
    const cut = (0.2 + r() * 0.6) * w; // end joint position
    for (const [x0, x1] of [[0, cut], [cut, w]] as const) {
      ctx.fillStyle = f.colors[Math.floor(r() * f.colors.length)];
      ctx.fillRect(x0, j * ph, x1 - x0, ph);
      // grain
      ctx.strokeStyle = 'rgba(0,0,0,0.13)'; ctx.lineWidth = 1;
      for (let g = 0; g < 7; g++) { const y = j * ph + r() * ph; ctx.beginPath(); ctx.moveTo(x0, y); ctx.bezierCurveTo(x0 + (x1 - x0) * 0.3, y + (r() - 0.5) * 4, x0 + (x1 - x0) * 0.7, y + (r() - 0.5) * 4, x1, y); ctx.stroke(); }
      ctx.fillStyle = 'rgba(0,0,0,0.32)'; ctx.fillRect(x0, j * ph, 1.5, ph); ctx.fillRect(x0, j * ph, x1 - x0, 1.5);
    }
  }
}

/** Zigzag planks meeting at a centre seam. */
function drawChevron(ctx: Ctx, f: Finish, w: number, h: number, r: () => number, stripe = false) {
  const rows = 8, p = h / rows, amp = w / 2;
  ctx.fillStyle = f.colors[stripe ? 0 : 1] ?? f.colors[0]; ctx.fillRect(0, 0, w, h);
  for (let k = -rows; k <= rows * 2; k++) {
    const y0 = k * p;
    const col = stripe ? (k % 2 ? f.colors[1] : f.colors[0]) : tone(f.colors[Math.floor(r() * f.colors.length)], 0);
    for (const half of [0, 1]) {
      ctx.beginPath();
      if (half === 0) { ctx.moveTo(0, y0); ctx.lineTo(w / 2, y0 - amp); ctx.lineTo(w / 2, y0 - amp + p); ctx.lineTo(0, y0 + p); }
      else { ctx.moveTo(w / 2, y0 - amp); ctx.lineTo(w, y0); ctx.lineTo(w, y0 + p); ctx.lineTo(w / 2, y0 - amp + p); }
      ctx.closePath(); ctx.fillStyle = col; ctx.fill();
      if (!stripe) { ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 1.2; ctx.stroke(); }
    }
  }
}

function drawBrick(ctx: Ctx, f: Finish, w: number, h: number, r: () => number) {
  const rows = 2, bh = h / rows, g = Math.max(1.5, h * 0.02);
  ctx.fillStyle = f.colors[1]; ctx.fillRect(0, 0, w, h);
  for (let j = 0; j < rows; j++) {
    const off = j % 2 ? w / 2 : 0;
    for (const x of [off - w, off]) {
      ctx.fillStyle = tone(f.colors[0], (r() - 0.5) * 0.05);
      ctx.fillRect(x + g / 2, j * bh + g / 2, w - g, bh - g);
    }
  }
  // glossy highlight
  const gr = ctx.createLinearGradient(0, 0, w, h); gr.addColorStop(0, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
}

function drawHex(ctx: Ctx, f: Finish, w: number, h: number) {
  const rr = h / 3;
  ctx.fillStyle = f.colors[1]; ctx.fillRect(0, 0, w, h);
  const hex = (cx: number, cy: number, col: string) => {
    ctx.beginPath();
    for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + (k * Math.PI) / 3; const x = cx + Math.cos(a) * rr * 0.93, y = cy + Math.sin(a) * rr * 0.93; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.closePath(); ctx.fillStyle = col; ctx.fill();
    ctx.strokeStyle = f.colors[2] ?? '#c9a24a'; ctx.lineWidth = Math.max(1.5, rr * 0.05); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, rr * 0.38, 0, Math.PI * 2); ctx.strokeStyle = f.colors[1]; ctx.stroke();
  };
  wrapped(w, h, (dx, dy) => { hex(dx, dy, f.colors[0]); hex(dx + w / 2, dy + 1.5 * rr, f.colors[0]); hex(dx + w, dy, f.colors[0]); hex(dx + w / 2 + w, dy + 1.5 * rr, f.colors[0]); });
}

function drawChecker(ctx: Ctx, f: Finish, w: number, h: number) {
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { ctx.fillStyle = (i + j) % 2 ? f.colors[1] : f.colors[0]; ctx.fillRect((i * w) / 2, (j * h) / 2, w / 2, h / 2); }
}

function drawZellige(ctx: Ctx, f: Finish, w: number, h: number, r: () => number) {
  const n = 3, tw = w / n, th = h / n, g = 2;
  ctx.fillStyle = tone(f.colors[1], -0.1); ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const base = f.colors[Math.floor(r() * f.colors.length)];
    const gr = ctx.createLinearGradient(i * tw, j * th, (i + 1) * tw, (j + 1) * th);
    gr.addColorStop(0, tone(base, 0.07 + r() * 0.05)); gr.addColorStop(1, tone(base, -0.07 - r() * 0.05));
    ctx.fillStyle = gr; ctx.fillRect(i * tw + g, j * th + g, tw - 2 * g, th - 2 * g);
  }
}

function drawStripe(ctx: Ctx, f: Finish, w: number, h: number) {
  ctx.fillStyle = f.colors[0]; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = f.colors[1];
  ctx.fillRect(0, 0, w * 0.12, h);
  ctx.globalAlpha = 0.5; ctx.fillRect(w * 0.5, 0, w * 0.035, h); ctx.globalAlpha = 1;
}

function flower(ctx: Ctx, x: number, y: number, s: number, petal: string, leaf: string, r: () => number) {
  ctx.fillStyle = leaf;
  for (let k = 0; k < 3; k++) { const a = r() * Math.PI * 2; ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.beginPath(); ctx.ellipse(s * 0.9, 0, s * 0.8, s * 0.22, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
  ctx.fillStyle = petal;
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * s * 0.42, y + Math.sin(a) * s * 0.42, s * 0.34, s * 0.2, a, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#f4d58d'; ctx.beginPath(); ctx.arc(x, y, s * 0.16, 0, Math.PI * 2); ctx.fill();
}

function drawFloral(ctx: Ctx, f: Finish, w: number, h: number, r: () => number) {
  ctx.fillStyle = f.colors[0]; ctx.fillRect(0, 0, w, h);
  const spots: Array<[number, number, number]> = [[0.22, 0.25, 0.17], [0.72, 0.18, 0.12], [0.55, 0.62, 0.19], [0.15, 0.78, 0.12], [0.88, 0.85, 0.15]];
  for (const [fx, fy, fs] of spots) wrapped(w, h, (dx, dy) => flower(ctx, fx * w + dx, fy * h + dy, fs * w, f.colors[2], f.colors[1], r));
}

function drawGeometric(ctx: Ctx, f: Finish, w: number, h: number) {
  ctx.fillStyle = f.colors[0]; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = f.colors[1]; ctx.lineWidth = Math.max(1.5, w * 0.012);
  const dia = (cx: number, cy: number, r2: number) => { ctx.beginPath(); ctx.moveTo(cx, cy - r2); ctx.lineTo(cx + r2, cy); ctx.lineTo(cx, cy + r2); ctx.lineTo(cx - r2, cy); ctx.closePath(); ctx.stroke(); };
  wrapped(w, h, (dx, dy) => { dia(w / 2 + dx, h / 2 + dy, w * 0.5); dia(w / 2 + dx, h / 2 + dy, w * 0.28); dia(dx, dy, w * 0.2); dia(w + dx, dy, w * 0.2); dia(dx, h + dy, w * 0.2); dia(w + dx, h + dy, w * 0.2); });
  ctx.fillStyle = f.colors[1]; ctx.beginPath(); ctx.arc(w / 2, h / 2, w * 0.035, 0, Math.PI * 2); ctx.fill();
}

function drawDamask(ctx: Ctx, f: Finish, w: number, h: number) {
  ctx.fillStyle = f.colors[0]; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = f.colors[1];
  const motif = (cx: number, cy: number, s: number) => {
    ctx.beginPath(); ctx.ellipse(cx, cy, s * 0.22, s * 0.42, 0, 0, Math.PI * 2); ctx.fill();
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(cx + sx * s * 0.3, cy + s * 0.1, s * 0.16, s * 0.3, sx * 0.6, 0, Math.PI * 2); ctx.fill(); }
    ctx.beginPath(); ctx.arc(cx, cy - s * 0.5, s * 0.07, 0, Math.PI * 2); ctx.fill();
  };
  wrapped(w, h, (dx, dy) => { motif(w / 2 + dx, h / 2 + dy, h * 0.9); motif(dx, dy, h * 0.9); motif(w + dx, dy, h * 0.9); motif(dx, h + dy, h * 0.9); motif(w + dx, h + dy, h * 0.9); });
}

function drawGrasscloth(ctx: Ctx, f: Finish, w: number, h: number, r: () => number) {
  ctx.fillStyle = f.colors[0]; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < h / 2; i++) {
    ctx.strokeStyle = r() > 0.5 ? f.colors[1] : tone(f.colors[0], 0.06);
    ctx.globalAlpha = 0.25 + r() * 0.5; ctx.lineWidth = 0.5 + r() * 1.5;
    const y = r() * h, x = r() * w, l = 20 + r() * 120;
    wrapped(w, h, (dx, dy) => { ctx.beginPath(); ctx.moveTo(x + dx, y + dy); ctx.lineTo(x + l + dx, y + (r() - 0.5) * 3 + dy); ctx.stroke(); });
  }
  ctx.globalAlpha = 1;
}

function drawFan(ctx: Ctx, f: Finish, w: number, h: number) {
  ctx.fillStyle = f.colors[0]; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = f.colors[1]; ctx.lineWidth = Math.max(1.2, w * 0.008);
  const fan = (cx: number, cy: number) => { for (let k = 1; k <= 4; k++) { ctx.beginPath(); ctx.arc(cx, cy, (w / 2) * (k / 4), Math.PI, 0); ctx.stroke(); } };
  wrapped(w, h, (dx, dy) => { fan(w / 2 + dx, h + dy); fan(dx, h / 2 + dy); fan(w + dx, h / 2 + dy); fan(w / 2 + dx, dy); });
}

function drawSlat(ctx: Ctx, f: Finish, w: number, h: number, r: () => number) {
  ctx.fillStyle = f.colors[1]; ctx.fillRect(0, 0, w, h);
  const n = 4, sw = w / n;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = tone(f.colors[0], (r() - 0.5) * 0.08); ctx.fillRect(i * sw + sw * 0.1, 0, sw * 0.8, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    for (let g = 0; g < 4; g++) { const x = i * sw + sw * (0.2 + r() * 0.6); ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + (r() - 0.5) * 6, h); ctx.stroke(); }
  }
}

/** Draw one repeat of a finish onto `ctx`, which is `w` x `h` pixels. */
export function drawFinish(ctx: Ctx, f: Finish, w: number, h: number): void {
  const r = rng(f.id);
  switch (f.pattern) {
    case 'solid':
      ctx.fillStyle = f.colors[0]; ctx.fillRect(0, 0, w, h);
      if (f.kind === 'concrete') { speckle(ctx, w, h, r, 0.1, '#ffffff'); speckle(ctx, w, h, r, 0.08); }
      break;
    case 'grid': { const [nx, ny] = CELLS.grid!; drawGrid(ctx, f, w, h, r, nx, ny); break; }
    case 'checker': drawChecker(ctx, f, w, h); break;
    case 'marble': drawMarble(ctx, f, w, h, r); break;
    case 'terrazzo': drawTerrazzo(ctx, f, w, h, r); break;
    case 'plank': drawPlank(ctx, f, w, h, r); break;
    case 'chevron': drawChevron(ctx, f, w, h, r, f.surface === 'wall'); break;
    case 'brick': drawBrick(ctx, f, w, h, r); break;
    case 'hex': drawHex(ctx, f, w, h); break;
    case 'zellige': drawZellige(ctx, f, w, h, r); break;
    case 'stripe': drawStripe(ctx, f, w, h); break;
    case 'floral': drawFloral(ctx, f, w, h, r); break;
    case 'geometric': drawGeometric(ctx, f, w, h); break;
    case 'damask': drawDamask(ctx, f, w, h); break;
    case 'grasscloth': drawGrasscloth(ctx, f, w, h, r); break;
    case 'fan': drawFan(ctx, f, w, h); break;
    case 'slat': drawSlat(ctx, f, w, h, r); break;
    default: ctx.fillStyle = f.colors[0]; ctx.fillRect(0, 0, w, h);
  }
}

/** Pixel size of the canvas for a finish: about 600 px per metre, capped for memory. */
export function canvasSize(f: Finish): [number, number] {
  const [rw, rh] = repeatMeters(f);
  const ppm = Math.min(600, 1024 / Math.max(rw, rh));
  const clamp = (v: number) => Math.max(96, Math.min(1024, Math.round(v)));
  // Hexagons need w:h = 1:sqrt(3) to tile, which the tile sizes already give.
  return [clamp(rw * ppm), clamp(rh * ppm)];
}

const cache = new Map<string, THREE.MeshStandardMaterial>();

/** Shared, textured material for a finish. UVs on geometry are in metres divided by repeatMeters. */
export function materialForFinish(f: Finish): THREE.MeshStandardMaterial {
  const hit = cache.get(f.id);
  if (hit) return hit;
  const mat = new THREE.MeshStandardMaterial({ color: f.pattern === 'solid' && f.kind !== 'concrete' ? f.colors[0] : '#ffffff', roughness: f.roughness, metalness: f.metalness ?? 0.02 });
  if (!(f.pattern === 'solid' && f.kind === 'paint') && typeof document !== 'undefined') {
    const [w, h] = canvasSize(f);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      drawFinish(ctx, f, w, h);
      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      mat.map = tex;
    }
  }
  cache.set(f.id, mat);
  return mat;
}

/** A data URL swatch of a finish for the UI (about `px` pixels square, showing a few repeats). */
export function swatchDataUrl(f: Finish, px = 72): string {
  if (typeof document === 'undefined') return '';
  const [w, h] = canvasSize(f);
  const src = document.createElement('canvas');
  src.width = w; src.height = h;
  const sctx = src.getContext('2d');
  if (!sctx) return '';
  drawFinish(sctx, f, w, h);
  const out = document.createElement('canvas');
  out.width = px; out.height = px;
  const octx = out.getContext('2d');
  if (!octx) return '';
  // Show about 0.9 m of the surface so tile size reads correctly.
  const [rw, rh] = repeatMeters(f);
  const tw = (px * rw) / 0.9, th = (px * rh) / 0.9;
  for (let x = 0; x < px; x += tw) for (let y = 0; y < px; y += th) octx.drawImage(src, x, y, tw, th);
  return out.toDataURL('image/png');
}
