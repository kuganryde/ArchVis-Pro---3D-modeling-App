#!/usr/bin/env node
/**
 * Provenance + integrity for library models under public/models/<library>/.
 *
 *   node scripts/models.mjs verify   # files match manifest.json (run in CI via tests)
 *   node scripts/models.mjs update   # regenerate manifest.json from the files on disk
 *   node scripts/models.mjs fetch    # re-download every listed file from upstream, then update
 *
 * Models are committed unmodified so the build never depends on the network; the
 * manifest pins their SHA-256 so any change (or tampering) is visible in review.
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';

const DIR = path.resolve('public/models/kaykit');
const MANIFEST = path.join(DIR, 'manifest.json');
const UPSTREAM =
  'https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-Furniture-Bits-1.0/main/addons/kaykit_furniture_bits/Assets/gltf';
const META = {
  library: 'KayKit : Furniture Bits (1.0)',
  author: 'Kay Lousberg (www.kaylousberg.com)',
  license: 'CC0-1.0',
  licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  source: 'https://github.com/KayKit-Game-Assets/KayKit-Furniture-Bits-1.0',
  homepage: 'https://kaylousberg.itch.io/furniture-bits',
};

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const DATA = /\.(gltf|bin|png)$/i;

async function listFiles() {
  return (await readdir(DIR)).filter((f) => DATA.test(f)).sort();
}

async function buildManifest() {
  const files = [];
  for (const name of await listFiles()) {
    const buf = await readFile(path.join(DIR, name));
    files.push({ name, bytes: buf.length, sha256: sha256(buf) });
  }
  return { ...META, files };
}

const cmd = process.argv[2];
if (cmd === 'update') {
  await writeFile(MANIFEST, JSON.stringify(await buildManifest(), null, 2) + '\n');
  console.log('manifest.json updated');
} else if (cmd === 'fetch') {
  const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
  await mkdir(DIR, { recursive: true });
  for (const f of manifest.files) {
    const res = await fetch(`${UPSTREAM}/${f.name}`);
    if (!res.ok) throw new Error(`${f.name}: HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (sha256(buf) !== f.sha256) console.warn(`${f.name}: upstream differs from the pinned hash — review before updating`);
    await writeFile(path.join(DIR, f.name), buf);
  }
  console.log('fetched; run "update" to re-pin if upstream changed intentionally');
} else if (cmd === 'verify') {
  const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
  const onDisk = await listFiles();
  const listed = manifest.files.map((f) => f.name);
  let bad = 0;
  for (const f of manifest.files) {
    try {
      const buf = await readFile(path.join(DIR, f.name));
      if (sha256(buf) !== f.sha256) { console.error(`HASH MISMATCH: ${f.name}`); bad++; }
    } catch { console.error(`MISSING: ${f.name}`); bad++; }
  }
  for (const f of onDisk) if (!listed.includes(f)) { console.error(`UNLISTED FILE: ${f}`); bad++; }
  if (bad) process.exit(1);
  console.log(`ok: ${manifest.files.length} files match manifest.json`);
} else {
  console.error('usage: node scripts/models.mjs verify|update|fetch');
  process.exit(2);
}
