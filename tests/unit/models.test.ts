import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { PNG } from 'pngjs';
import { MODEL_SPECS, computeModelFit, instantiateModel, hasModel } from '../../src/three/modelLibrary';
import { buildDeviceModel, buildWhiteboardModel, DEVICE_TYPES } from '../../src/three/deviceModels';
import { buildProceduralAssetMesh } from '../../src/three/proceduralAssets';
import { getAssetSize } from '../../src/utils/geometry';
import { ISO_ASSET_TYPES } from '../../src/data/isoAssets';
import type { PlacedAsset } from '../../src/types';

const MODELS_DIR = path.resolve('public/models/kaykit');
const manifest = JSON.parse(readFileSync(path.join(MODELS_DIR, 'manifest.json'), 'utf8')) as {
  license: string; author: string; files: Array<{ name: string; sha256: string; bytes: number }>;
};

const asset = (type: PlacedAsset['type'], over: Partial<PlacedAsset> = {}): PlacedAsset => ({
  id: `t_${type}`, type, category: 'furniture', name: type, position: { x: 0, y: 0.4, z: 0 },
  rotationY: 0, scale: { x: 1, y: 1, z: 1 }, ...over,
} as PlacedAsset);

describe('library model provenance', () => {
  it('is CC0 and credits the author', () => {
    expect(manifest.license).toBe('CC0-1.0');
    expect(manifest.author).toMatch(/Kay Lousberg/);
    expect(readFileSync(path.join(MODELS_DIR, 'LICENSE.txt'), 'utf8')).toMatch(/Creative Commons Zero|CC0/);
  });
  it('every committed model file matches its pinned SHA-256', () => {
    for (const f of manifest.files) {
      const buf = readFileSync(path.join(MODELS_DIR, f.name));
      expect(buf.length, f.name).toBe(f.bytes);
      expect(createHash('sha256').update(buf).digest('hex'), f.name).toBe(f.sha256);
    }
  });
  it('every registered model (and what it references) is in the manifest', () => {
    const listed = new Set(manifest.files.map((f) => f.name));
    for (const [type, spec] of Object.entries(MODEL_SPECS)) {
      expect(listed.has(spec!.file), `${type} -> ${spec!.file}`).toBe(true);
      const gltf = JSON.parse(readFileSync(path.join(MODELS_DIR, spec!.file), 'utf8'));
      const refs: string[] = [...gltf.buffers.map((b: any) => b.uri), ...(gltf.images ?? []).map((i: any) => i.uri)];
      for (const uri of refs) {
        // Only plain sibling files: no path traversal, no remote or data URIs.
        expect(uri, `${spec!.file} references ${uri}`).toMatch(/^[A-Za-z0-9_.-]+$/);
        expect(listed.has(uri), `${spec!.file} -> ${uri}`).toBe(true);
      }
    }
  });
});

describe('model fitting', () => {
  it('stretches X/Z to the footprint and Y to the real height', () => {
    expect(computeModelFit({ x: 3, y: 1, z: 2 }, { fit: 'stretch', height: 0.75 }, { width: 2.2, depth: 1.4 }))
      .toEqual({ x: 2.2 / 3, y: 0.75, z: 0.7 });
  });
  it('scales uniformly to height for chairs and plants', () => {
    const s = computeModelFit({ x: 0.75, y: 1.26, z: 0.85 }, { fit: 'height', height: 0.95 }, { width: 9, depth: 9 });
    expect(s.x).toBe(s.y);
    expect(s.z).toBe(s.y);
    expect(s.y * 1.26).toBeCloseTo(0.95);
  });
  it('never divides by zero for degenerate models', () => {
    const s = computeModelFit({ x: 0, y: 0, z: 0 }, { fit: 'stretch', height: 1 }, { width: 1, depth: 1 });
    expect(Object.values(s).every(Number.isFinite)).toBe(true);
  });
  it('falls back to the procedural model until a library model has loaded', () => {
    expect(hasModel('chair_office')).toBe(false);
    expect(instantiateModel(asset('chair_office'))).toBeNull();
    expect(instantiateModel(asset('ap'))).toBeNull(); // devices have no library model at all
  });
});

describe('hand-built device models', () => {
  const dims = (build: (g: THREE.Group) => void) => {
    const g = new THREE.Group();
    build(g);
    g.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(g);
    return { g, box, size: box.getSize(new THREE.Vector3()) };
  };

  it.each(DEVICE_TYPES)('%s stays inside its footprint and rests on its mounting point', (type) => {
    const a = asset(type, { category: 'infrastructure', position: { x: 0, y: 0.8, z: 0 } });
    const { g, box, size } = dims((grp) => buildDeviceModel(a, grp));
    const fp = getAssetSize(a);
    expect(g.children.length).toBeGreaterThan(2);
    expect(size.x).toBeLessThanOrEqual(fp.width * 1.05);
    expect(size.z).toBeLessThanOrEqual(fp.depth * 1.05 + 0.1); // wall devices are shallow; floor box fills it
    expect(box.min.y).toBeGreaterThanOrEqual(-1e-6);
    expect(box.min.y).toBeLessThan(0.01); // bottom sits on the origin
  });

  it('shares geometry and materials between instances (cheap per-edit rebuilds)', () => {
    const meshes = (g: THREE.Group) => g.children.filter((c): c is THREE.Mesh => (c as THREE.Mesh).isMesh);
    const a = new THREE.Group(); buildDeviceModel(asset('dp'), a);
    const b = new THREE.Group(); buildDeviceModel(asset('dp'), b);
    expect(meshes(a)[0].geometry).toBe(meshes(b)[0].geometry);
    expect(meshes(a)[0].material).toBe(meshes(b)[0].material);
  });

  it('whiteboard is ~1.6 m tall and about 1.2 m wide, as before', () => {
    const { size } = dims(buildWhiteboardModel);
    expect(size.y).toBeGreaterThan(1.4);
    expect(size.y).toBeLessThan(1.7);
    expect(size.z).toBeGreaterThan(1.1);
    expect(size.z).toBeLessThan(1.4);
  });

  it('CCTV coverage overlay can be switched off for icons', () => {
    const count = (showCoverage: boolean) => {
      const g = new THREE.Group();
      buildProceduralAssetMesh(asset('cctv', { category: 'infrastructure' }), g, { isSelected: false, viewMode: '3D', showCoverage });
      let n = 0; g.traverse(() => n++);
      return n;
    };
    expect(count(true)).toBeGreaterThan(count(false));
  });

  it('every asset type that has a model or icon builds without throwing', () => {
    for (const type of ISO_ASSET_TYPES) {
      const g = new THREE.Group();
      expect(() => buildProceduralAssetMesh(asset(type), g, { isSelected: false, viewMode: '3D' }), type).not.toThrow();
      expect(g.children.length, type).toBeGreaterThan(0);
    }
  });
});

describe('isometric icon set', () => {
  it.each(ISO_ASSET_TYPES)('has a valid PNG for %s', (type) => {
    const file = path.resolve('public/iso', `${type}.png`);
    expect(existsSync(file), file).toBe(true);
    const buf = readFileSync(file);
    expect(buf.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a'); // PNG signature
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.length).toBeLessThan(150_000);
  });

  it.each(ISO_ASSET_TYPES)('%s icon has visible content', (type) => {
    const png = PNG.sync.read(readFileSync(path.resolve('public/iso', `${type}.png`)));
    let opaque = 0;
    for (let i = 3; i < png.data.length; i += 4) if (png.data[i] > 200) opaque++;
    expect(opaque).toBeGreaterThan(500);
  });

  // Textured library models must not render black (the THREE.Cache + ImageBitmap bug measured
  // ~0-15; real icons are well above 45). Hand-built devices are dark on purpose (slate plate,
  // black card reader), so only the textured library models are checked.
  it.each(Object.keys(MODEL_SPECS))('library model icon %s is not black', (type) => {
    const png = PNG.sync.read(readFileSync(path.resolve('public/iso', `${type}.png`)));
    let lum = 0, opaque = 0;
    for (let i = 0; i < png.data.length; i += 4) {
      if (png.data[i + 3] > 200) {
        lum += 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
        opaque++;
      }
    }
    expect(lum / opaque, `${type} mean luminance`).toBeGreaterThan(45);
  });
});
