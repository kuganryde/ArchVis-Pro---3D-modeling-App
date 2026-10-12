#!/usr/bin/env node
/**
 * Renders isometric PNG icons for every placeable asset type, plus a labelled
 * contact sheet. Uses the real models (library + procedural) through tools/iso.
 *
 *   npm run assets:iso                       # icons -> public/iso/*.png, sheet -> docs/isometric-assets.png
 *   npm run assets:iso -- --raw a.gltf,b.gltf        # contact sheet of raw library files (to choose models)
 *   npm run assets:iso -- --compare chair_office,... --out /tmp/x.png   # procedural vs library, side by side
 *
 * Set E2E_CHROMIUM_PATH to use an existing Chromium (CI uses Playwright's own).
 */
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ISO_ASSET_TYPES } from '../src/data/isoAssets.ts';

const root = process.cwd();
const argv = process.argv.slice(2);
const rawArg = argv.includes('--raw') ? argv[argv.indexOf('--raw') + 1] : null;
const outSheet = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : 'docs/isometric-assets.png';

const TYPES = ISO_ASSET_TYPES;

const server = await createServer({ root, server: { port: 5190, strictPort: false }, logLevel: 'error', appType: 'mpa' });
await server.listen();
const origin = `http://localhost:${server.config.server.port}`;
const browser = await chromium.launch({
  executablePath: process.env.E2E_CHROMIUM_PATH || undefined,
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
page.on('pageerror', (e) => console.error('pageerror:', e.message));
await page.goto(`${origin}/tools/iso/index.html`);
await page.waitForFunction(() => window.__iso);
await page.evaluate(() => window.__iso.ready);

const dataUrlToBuf = (u) => Buffer.from(u.split(',')[1], 'base64');

/** Lay labelled images out in a grid page and screenshot it. */
async function sheet(items, file, cols) {
  await page.evaluate(({ items, cols }) => {
    document.body.innerHTML = '';
    const grid = document.createElement('div');
    grid.style.cssText = `display:grid;grid-template-columns:repeat(${cols},176px);gap:8px;padding:16px;background:#f8fafc`;
    for (const it of items) {
      const cell = document.createElement('div');
      cell.style.cssText = 'background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:6px;text-align:center';
      cell.innerHTML = `<img src="${it.png}" width="${it.w ?? 160}" height="${it.w ?? 160}" style="display:block;margin:0 auto"><div style="font:600 12px system-ui;color:#0f172a">${it.label}</div><div style="font:11px system-ui;color:#64748b">${it.sub ?? ''}</div>`;
      grid.appendChild(cell);
    }
    document.body.appendChild(grid);
  }, { items, cols });
  await page.waitForTimeout(300);
  const el = await page.locator('body > div').first();
  const target = path.resolve(root, file); // absolute paths are honoured
  await mkdir(path.dirname(target), { recursive: true });
  await el.screenshot({ path: target });
  console.log('wrote', file);
}

const compareArg = argv.includes('--compare') ? argv[argv.indexOf('--compare') + 1] : null;
if (compareArg) {
  const items = [];
  for (const t of compareArg.split(',')) {
    const r = await page.evaluate((t) => window.__iso.compare(t), t);
    items.push({ png: r.png, label: t, sub: 'procedural (left) vs library (right); red bar = +X' });
  }
  await sheet(items, outSheet, 3);
} else if (rawArg) {
  const files = rawArg.split(',');
  const items = [];
  for (const f of files) {
    const r = await page.evaluate((f) => window.__iso.renderFile(f), f);
    items.push({ png: r.png, label: f.replace('.gltf', ''), sub: r.size.join(' × ') });
  }
  await sheet(items, outSheet, 6);
} else {
  await mkdir(path.join(root, 'public/iso'), { recursive: true });
  const items = [];
  for (const type of TYPES) {
    const r = await page.evaluate((t) => window.__iso.render(t), type);
    const lum = await page.evaluate(async (png) => {
      // mean luminance (0-255) of the opaque pixels: a black icon means broken materials/textures
      const img = new Image(); img.src = png; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let sum = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) { sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; n++; }
      return n ? sum / n : 0;
    }, r.png);
    // Only textured library models are checked: hand-built devices are dark on purpose.
    if (r.source.startsWith('KayKit') && lum < 45) throw new Error(`icon "${type}" rendered nearly black (mean luminance ${lum.toFixed(1)}) — check materials/textures`);
    await writeFile(path.join(root, 'public/iso', `${type}.png`), dataUrlToBuf(r.png));
    items.push({ png: r.png, label: type, sub: r.source });
  }
  await sheet(items, outSheet, 6);
}

await browser.close();
await server.close();
