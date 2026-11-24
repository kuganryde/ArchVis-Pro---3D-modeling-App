import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MODEL_SPECS, computeModelFit } from '../../src/three/modelLibrary';
import { buildDeviceModel, buildWhiteboardModel, DEVICE_TYPES } from '../../src/three/deviceModels';
import { getAssetSize } from '../../src/utils/geometry';
import type { PlacedAsset } from '../../src/types';

const MODELS_DIR = path.resolve('public/models/kaykit');

const asset = (type: PlacedAsset['type'], over: Partial<PlacedAsset> = {}): PlacedAsset => ({
  id: `bb_${type}`, type, category: 'furniture', name: type, position: { x: 0, y: 0.4, z: 0 },
  rotationY: 0, scale: { x: 1, y: 1, z: 1 }, ...over,
} as PlacedAsset);

/** Size of a glTF file's bounding box in metres, measured on the committed file. */
async function sourceSize(file: string): Promise<THREE.Vector3> {
  const json = JSON.parse(readFileSync(path.join(MODELS_DIR, file), 'utf8'));
  // Geometry only: node has no image decoder, and textures do not change the bounds.
  delete json.images;
  delete json.textures;
  delete json.samplers;
  for (const m of json.materials ?? []) {
    if (m.pbrMetallicRoughness) delete m.pbrMetallicRoughness.baseColorTexture;
  }
  const bin = readFileSync(path.join(MODELS_DIR, json.buffers[0].uri));
  const buf = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength) as ArrayBuffer;
  json.buffers[0] = { byteLength: buf.byteLength };
  const gltf = await new GLTFLoader().parseAsync(
    buildGlb(json, new Uint8Array(buf)), ''
  );
  gltf.scene.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(gltf.scene).getSize(new THREE.Vector3());
}

/** Pack a glTF JSON and its binary buffer into a GLB so the loader needs no file access. */
function buildGlb(json: object, bin: Uint8Array): ArrayBuffer {
  const pad = (n: number) => (4 - (n % 4)) % 4;
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonLen = jsonBytes.length + pad(jsonBytes.length);
  const binLen = bin.length + pad(bin.length);
  const total = 12 + 8 + jsonLen + 8 + binLen;
  const out = new Uint8Array(total).fill(0x20);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true); // 'glTF'
  dv.setUint32(4, 2, true);
  dv.setUint32(8, total, true);
  dv.setUint32(12, jsonLen, true);
  dv.setUint32(16, 0x4e4f534a, true); // 'JSON'
  out.set(jsonBytes, 20);
  const binStart = 20 + jsonLen;
  out.fill(0, binStart, total);
  dv.setUint32(binStart, binLen, true);
  dv.setUint32(binStart + 4, 0x004e4942, true); // 'BIN'
  out.set(bin, binStart + 8);
  return out.buffer;
}

/**
 * Footprints used for the types whose size comes from the asset's own scale. These are
 * the sizes the editor creates by default (App.tsx), so the test measures real usage.
 */
const SCALED_FOOTPRINT: Partial<Record<PlacedAsset['type'], { x: number; z: number }>> = {
  desk_cluster_4: { x: 1.8, z: 1.4 },
  desk_cluster_6: { x: 2.2, z: 1.4 },
  conference_table: { x: 2.4, z: 1.2 },
};

/**
 * How far a 'height'-fitted model may overhang its declared footprint before the
 * collision and occupancy maths stop matching what is drawn. Everything else must stay
 * within 5%. The plant pot is KNOWN to be larger than its footprint. Tighten these when the
 * footprints or models are corrected; the test fails if they get worse.
 */
const MAX_OVERHANG: Partial<Record<PlacedAsset['type'], number>> = {
  plant_pot: 1.45,
};
const DEFAULT_OVERHANG = 1.05;

/** Same idea for stretched models: the library table_small and cabinet are blocky, so filling a real footprint distorts them. */
const MAX_DISTORTION: Partial<Record<PlacedAsset['type'], number>> = {
  desk_single: 1.75,
  cabinet: 2.05,
};
const DEFAULT_DISTORTION = 1.6;

/** Largest ratio between the three axis scales; 1 means the model is not distorted. */
const distortion = (s: { x: number; y: number; z: number }) => {
  const v = [s.x, s.y, s.z];
  return Math.max(...v) / Math.min(...v);
};

describe('library model bounding boxes', () => {
  it.each(Object.entries(MODEL_SPECS))('%s matches its footprint and real height', async (type, spec) => {
    const t = type as PlacedAsset['type'];
    const sc = SCALED_FOOTPRINT[t];
    const a = asset(t, sc ? { scale: { x: sc.x, y: 0.75, z: sc.z } } : {});
    const fp = getAssetSize(a);
    const src = await sourceSize(spec!.file);
    const s = computeModelFit(src, spec!, fp);

    // Placed size in the asset's local frame; a 90 degree yaw swaps the X and Z extents.
    const swapped = Math.abs(Math.sin(spec!.yaw ?? 0)) > 0.5;
    const w = (swapped ? src.z * s.z : src.x * s.x);
    const d = (swapped ? src.x * s.x : src.z * s.z);
    const h = src.y * s.y;

    expect(h, `${type} height`).toBeCloseTo(spec!.height, 2);
    if (spec!.fit === 'stretch') {
      expect(w / fp.width, `${type} width`).toBeCloseTo(1, 2);
      expect(d / fp.depth, `${type} depth`).toBeCloseTo(1, 2);
      // A stretched model must not look like a different object once it fills the footprint.
      expect(distortion(s), `${type} distortion`).toBeLessThanOrEqual(MAX_DISTORTION[t] ?? DEFAULT_DISTORTION);
    } else {
      const limit = MAX_OVERHANG[t] ?? DEFAULT_OVERHANG;
      expect(Math.max(w / fp.width, d / fp.depth), `${type} overhang`).toBeLessThanOrEqual(limit);
    }
  });
});

describe('hand-built device bounding boxes', () => {
  const sizeOf = (a: PlacedAsset) => {
    const g = new THREE.Group();
    buildDeviceModel(a, g);
    g.updateMatrixWorld(true);
    return new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());
  };

  it.each(DEVICE_TYPES)('%s is a plausible size for real hardware', (type) => {
    const size = sizeOf(asset(type, { category: 'infrastructure', position: { x: 0, y: 0.8, z: 0 } }));
    // Every device is between 2 cm and 1 m on its longest side; anything else is a unit error.
    const longest = Math.max(size.x, size.y, size.z);
    expect(longest, type).toBeGreaterThan(0.02);
    expect(longest, type).toBeLessThan(1);
  });

  it('whiteboard bounds are 1.4-1.7 m tall and 1.1-1.4 m wide', () => {
    const g = new THREE.Group();
    buildWhiteboardModel(g);
    g.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());
    expect(size.y).toBeGreaterThan(1.4);
    expect(size.y).toBeLessThan(1.7);
    expect(size.z).toBeGreaterThan(1.1);
    expect(size.z).toBeLessThan(1.4);
  });
});
