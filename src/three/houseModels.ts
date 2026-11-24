/**
 * Hand-built models for the house designer: furniture, fixtures, lights and decor.
 * Each model is a short list of boxes, cylinders and spheres authored at real size
 * (see src/house/assetSpecs.ts) with the origin at the bottom centre and the front
 * facing +Z. A single generic builder turns the part lists into meshes, sharing
 * geometry and materials between instances.
 *
 * Colour tokens: 'P' is the asset's own colour (fabric, paint), 'P2' a lighter and
 * 'P3' a darker shade of it, 'W' the wood tone from asset.specs.Wood, 'GLOW' the light
 * colour from asset.specs.Glow. Anything else
 * is a literal hex colour.
 */
import * as THREE from 'three';
import type { HouseAssetType, PlacedAsset } from '../types';
import { HOUSE_ASSET_SPECS } from '../house/assetSpecs';

type Shape = 'box' | 'cyl' | 'sphere';
export interface Part {
  s: Shape;
  /** box: [w, h, d]; cyl: [radiusTop, radiusBottom, h]; sphere: [r]. */
  size: number[];
  /** Centre of the part. */
  pos: [number, number, number];
  c: string;
  /** Rotation about X in radians (cylinders lying on their side). */
  rx?: number;
  /** Glows when the light is on. */
  glow?: boolean;
  opacity?: number;
  rough?: number;
  metal?: number;
}

interface Ctx { w: number; d: number }

/** Box with its bottom face at y0. */
const bx = (w: number, h: number, d: number, x: number, y0: number, z: number, c: string, o: Partial<Part> = {}): Part =>
  ({ s: 'box', size: [w, h, d], pos: [x, y0 + h / 2, z], c, ...o });
/** Cylinder or cone with its bottom face at y0. */
const cy = (rt: number, rb: number, h: number, x: number, y0: number, z: number, c: string, o: Partial<Part> = {}): Part =>
  ({ s: 'cyl', size: [rt, rb, h], pos: [x, y0 + h / 2, z], c, ...o });
const sp = (r: number, x: number, y: number, z: number, c: string, o: Partial<Part> = {}): Part =>
  ({ s: 'sphere', size: [r], pos: [x, y, z], c, ...o });

const METAL = '#9aa3ad';
const DARK = '#1f2937';
const WHITE = '#f8fafc';
const STONE = '#e2e0dc';
const FRONT = '#8a6a4a';

/** Bed of the given width and headboard height; always 2.1 m long unless `len` is given. */
function bed(w: number, headH: number, len = 2.1): Part[] {
  const hw = w / 2;
  const parts: Part[] = [
    bx(w, 0.2, len, 0, 0.1, 0, 'W'),
    bx(w - 0.1, 0.25, len - 0.1, 0, 0.3, 0.0, WHITE),
    bx(w - 0.08, 0.06, len * 0.62, 0, 0.55, len * 0.17, 'P'),
    bx(w, headH - 0.2, 0.08, 0, 0.2, -len / 2 + 0.04, 'P3'),
  ];
  for (const x of [-hw + 0.06, hw - 0.06]) for (const z of [-len / 2 + 0.06, len / 2 - 0.06]) parts.push(bx(0.08, 0.1, 0.08, x, 0, z, 'W'));
  const pillowW = w > 1.2 ? 0.7 : 0.55;
  const xs = w > 1.2 ? [-w / 4, w / 4] : [0];
  for (const x of xs) parts.push(bx(pillowW, 0.12, 0.4, x, 0.55, -len / 2 + 0.38, WHITE));
  return parts;
}

export const HOUSE_PARTS: Record<HouseAssetType, (c: Ctx) => Part[]> = {
  sofa: () => [
    ...[-0.95, 0.95].flatMap((x) => [-0.4, 0.4].map((z) => bx(0.06, 0.1, 0.06, x, 0, z, DARK))),
    bx(2.1, 0.3, 0.95, 0, 0.1, 0, 'P'),
    bx(2.1, 0.45, 0.25, 0, 0.4, -0.35, 'P'),
    bx(0.2, 0.25, 0.7, -0.95, 0.4, 0.125, 'P3'),
    bx(0.2, 0.25, 0.7, 0.95, 0.4, 0.125, 'P3'),
    bx(0.8, 0.12, 0.7, -0.4, 0.4, 0.125, 'P2'),
    bx(0.8, 0.12, 0.7, 0.4, 0.4, 0.125, 'P2'),
  ],
  coffee_table: () => [
    bx(1.1, 0.04, 0.6, 0, 0.36, 0, 'W'),
    ...[-0.5, 0.5].flatMap((x) => [-0.25, 0.25].map((z) => bx(0.05, 0.36, 0.05, x, 0, z, 'W'))),
    bx(0.95, 0.02, 0.45, 0, 0.12, 0, 'W'),
  ],
  side_table: () => [cy(0.225, 0.225, 0.03, 0, 0.47, 0, 'W'), cy(0.02, 0.02, 0.44, 0, 0.03, 0, METAL, { metal: 0.8 }), cy(0.16, 0.16, 0.03, 0, 0, 0, METAL, { metal: 0.8 })],
  tv_unit: () => [
    ...[-0.74, 0.74].flatMap((x) => [-0.16, 0.16].map((z) => bx(0.04, 0.1, 0.04, x, 0, z, DARK))),
    bx(1.6, 0.3, 0.4, 0, 0.1, 0, 'W'),
    bx(1.6, 0.05, 0.4, 0, 0.4, 0, 'W'),
    bx(0.76, 0.24, 0.01, -0.4, 0.13, 0.195, FRONT),
    bx(0.76, 0.24, 0.01, 0.4, 0.13, 0.195, FRONT),
  ],
  bookshelf: () => {
    const parts: Part[] = [bx(0.03, 1.9, 0.32, -0.435, 0, 0, 'W'), bx(0.03, 1.9, 0.32, 0.435, 0, 0, 'W'), bx(0.84, 1.9, 0.01, 0, 0, -0.155, 'W')];
    const books = ['#8c4a4a', '#4a6a8c', '#c9a24a', '#5f7f5f', '#d8d3ca', '#6b5b8c'];
    [0, 0.45, 0.9, 1.35, 1.875].forEach((y, i) => {
      parts.push(bx(0.84, 0.025, 0.3, 0, y, 0, 'W'));
      if (i < 4) for (let k = 0; k < 6; k++) parts.push(bx(0.05, 0.22 + (k % 3) * 0.04, 0.2, -0.33 + k * 0.1, y + 0.025, -0.02, books[(k + i) % books.length]));
    });
    return parts;
  },
  rug: ({ w, d }) => [bx(w, 0.016, d, 0, 0, 0, 'P'), bx(w - 0.16, 0.004, d - 0.16, 0, 0.016, 0, 'P2')],

  dining_table: () => [
    bx(1.6, 0.04, 0.9, 0, 0.71, 0, 'W'),
    ...[-0.72, 0.72].flatMap((x) => [-0.37, 0.37].map((z) => bx(0.07, 0.71, 0.07, x, 0, z, 'W'))),
  ],
  dining_chair: () => [
    bx(0.45, 0.04, 0.45, 0, 0.44, 0.025, 'P'),
    ...[-0.19, 0.19].flatMap((x) => [bx(0.035, 0.44, 0.035, x, 0, 0.2325, 'W'), bx(0.035, 0.9, 0.035, x, 0, -0.2325, 'W')]),
    bx(0.45, 0.4, 0.03, 0, 0.5, -0.235, 'P'),
  ],
  sideboard: () => [
    ...[-0.65, 0.65].flatMap((x) => [-0.16, 0.16].map((z) => bx(0.04, 0.12, 0.04, x, 0, z, DARK))),
    bx(1.4, 0.7, 0.4, 0, 0.12, 0, 'W'),
    bx(1.4, 0.03, 0.4, 0, 0.82, 0, 'W'),
    ...[-0.46, 0, 0.46].map((x) => bx(0.44, 0.5, 0.01, x, 0.22, 0.195, FRONT)),
  ],
  kitchen_base: () => [
    bx(2.38, 0.1, 0.55, 0, 0, -0.025, DARK),
    bx(2.4, 0.76, 0.58, 0, 0.1, -0.01, 'P'),
    ...[-0.9, -0.3, 0.3, 0.9].map((x) => bx(0.58, 0.7, 0.02, x, 0.13, 0.29, 'P2')),
    bx(2.4, 0.04, 0.6, 0, 0.86, 0, STONE),
    bx(0.58, 0.004, 0.5, 0.45, 0.896, 0, '#111827'),
  ],
  kitchen_upper: () => [
    bx(2.4, 0.7, 0.33, 0, 0, -0.01, 'P'),
    ...[-0.9, -0.3, 0.3, 0.9].map((x) => bx(0.58, 0.66, 0.02, x, 0.02, 0.165, 'P2')),
  ],
  kitchen_island: () => [
    bx(1.7, 0.1, 0.8, 0, 0, 0, DARK),
    bx(1.8, 0.76, 0.9, 0, 0.1, 0, 'P'),
    bx(1.8, 0.04, 0.9, 0, 0.86, 0, STONE),
  ],
  fridge: () => [
    bx(0.75, 1.8, 0.68, 0, 0, -0.01, METAL, { metal: 0.6, rough: 0.3 }),
    bx(0.73, 0.55, 0.02, 0, 1.22, 0.34, '#b6c0cb', { metal: 0.6 }),
    bx(0.73, 1.2, 0.02, 0, 0.02, 0.34, '#b6c0cb', { metal: 0.6 }),
    bx(0.02, 0.4, 0.02, -0.3, 1.3, 0.335, DARK),
    bx(0.02, 0.5, 0.02, -0.3, 0.55, 0.335, DARK),
  ],
  bar_stool: () => [cy(0.2, 0.2, 0.05, 0, 0.7, 0, 'P'), cy(0.025, 0.025, 0.62, 0, 0.08, 0, METAL, { metal: 0.8 }), cy(0.18, 0.18, 0.08, 0, 0, 0, METAL, { metal: 0.8 })],

  bed_king: () => bed(1.9, 1.1),
  bed_double: () => bed(1.6, 1.0),
  bed_single: () => bed(0.95, 0.9, 2.0),
  bedside_table: () => [
    ...[-0.2, 0.2].flatMap((x) => [-0.16, 0.16].map((z) => bx(0.03, 0.1, 0.03, x, 0, z, DARK))),
    bx(0.45, 0.37, 0.4, 0, 0.1, 0, 'W'),
    bx(0.45, 0.03, 0.4, 0, 0.47, 0, 'W'),
    bx(0.4, 0.15, 0.01, 0, 0.3, 0.195, FRONT),
  ],
  wardrobe: () => [
    bx(1.8, 2.1, 0.58, 0, 0, -0.01, 'P'),
    ...[-0.6, 0, 0.6].map((x) => bx(0.59, 2.0, 0.02, x, 0.05, 0.29, 'P2')),
    ...[-0.3, 0.3].map((x) => bx(0.015, 0.4, 0.01, x, 1.0, 0.298, METAL)),
  ],
  dresser: () => [
    ...[-0.55, 0.55].flatMap((x) => [-0.17, 0.17].map((z) => bx(0.05, 0.12, 0.05, x, 0, z, DARK))),
    bx(1.2, 0.7, 0.43, 0, 0.12, -0.01, 'W'),
    bx(1.2, 0.03, 0.45, 0, 0.82, 0, 'W'),
    ...[0.15, 0.37, 0.59].map((y) => bx(1.14, 0.19, 0.02, 0, y, 0.215, FRONT)),
  ],

  toilet: () => [
    bx(0.4, 0.4, 0.2, 0, 0.4, -0.25, WHITE),
    bx(0.36, 0.38, 0.5, 0, 0, 0.1, WHITE),
    bx(0.38, 0.04, 0.46, 0, 0.38, 0.12, '#eef2f6'),
  ],
  vanity: () => [
    bx(0.8, 0.76, 0.46, 0, 0, -0.02, 'P'),
    bx(0.8, 0.04, 0.5, 0, 0.76, 0, STONE),
    bx(0.42, 0.01, 0.32, 0, 0.8, 0.03, WHITE),
    cy(0.015, 0.015, 0.04, 0, 0.81, -0.18, METAL, { metal: 0.9 }),
  ],
  shower: () => [
    bx(0.9, 0.06, 0.9, 0, 0, 0, WHITE),
    bx(0.9, 1.94, 0.01, 0, 0.06, 0.445, '#bfdbfe', { opacity: 0.25, rough: 0.05 }),
    bx(0.01, 1.94, 0.9, 0.445, 0.06, 0, '#bfdbfe', { opacity: 0.25, rough: 0.05 }),
    bx(0.03, 1.9, 0.03, -0.4, 0.06, -0.4, METAL, { metal: 0.9 }),
    cy(0.08, 0.08, 0.04, -0.3, 1.96, -0.36, METAL, { metal: 0.9 }),
  ],
  bathtub: () => [
    bx(1.7, 0.5, 0.75, 0, 0, 0, WHITE),
    bx(1.7, 0.05, 0.75, 0, 0.5, 0, WHITE),
    bx(1.5, 0.01, 0.55, 0, 0.54, 0, '#dbeafe'),
    cy(0.02, 0.02, 0.05, 0.75, 0.5, 0, METAL, { metal: 0.9 }),
  ],
  washer: () => [
    bx(0.6, 0.85, 0.58, 0, 0, -0.01, WHITE),
    { s: 'cyl', size: [0.22, 0.22, 0.02], pos: [0, 0.45, 0.29], c: '#9fb1c1', rx: Math.PI / 2, metal: 0.4 },
    bx(0.5, 0.05, 0.01, 0, 0.77, 0.29, DARK),
  ],

  ceiling_light: () => [cy(0.2, 0.2, 0.05, 0, 0, 0, 'GLOW', { glow: true }), cy(0.2, 0.2, 0.03, 0, 0.05, 0, '#cbd5e1', { metal: 0.5 })],
  pendant_light: () => [
    cy(0.09, 0.225, 0.25, 0, 0, 0, 'P', { glow: true, rough: 0.5 }),
    sp(0.06, 0, 0.16, 0, 'GLOW', { glow: true }),
    cy(0.006, 0.006, 0.62, 0, 0.25, 0, DARK),
    cy(0.05, 0.05, 0.03, 0, 0.87, 0, '#cbd5e1', { metal: 0.5 }),
  ],
  downlight: () => [cy(0.06, 0.06, 0.01, 0, 0, 0, 'GLOW', { glow: true }), cy(0.055, 0.055, 0.02, 0, 0.01, 0, '#e5e7eb')],
  floor_lamp: () => [
    cy(0.15, 0.15, 0.03, 0, 0, 0, METAL, { metal: 0.8 }),
    cy(0.012, 0.012, 1.35, 0, 0.03, 0, METAL, { metal: 0.8 }),
    cy(0.13, 0.175, 0.22, 0, 1.38, 0, 'P', { glow: true, rough: 0.8 }),
  ],
  wall_sconce: () => [
    bx(0.14, 0.22, 0.015, 0, 0, -0.0525, METAL, { metal: 0.8 }),
    bx(0.03, 0.03, 0.07, 0, 0.1, -0.015, METAL, { metal: 0.8 }),
    cy(0.045, 0.06, 0.15, 0, 0.1, 0, 'P', { glow: true, rough: 0.8 }),
  ],

  wall_art: () => [
    bx(0.9, 0.6, 0.03, 0, 0, -0.005, 'W'),
    bx(0.8, 0.5, 0.02, 0, 0.05, 0.01, 'P'),
    bx(0.3, 0.2, 0.005, -0.15, 0.2, 0.0175, 'P2'),
    bx(0.22, 0.3, 0.005, 0.2, 0.12, 0.0175, 'P3'),
  ],
  mirror: () => [bx(0.6, 1.5, 0.03, 0, 0, -0.005, METAL, { metal: 0.8 }), bx(0.54, 1.44, 0.01, 0, 0.03, 0.015, '#bfdbfe', { metal: 0.9, rough: 0.05 })],
  curtain: () => {
    const parts: Part[] = [bx(1.6, 0.03, 0.03, 0, 2.27, 0, METAL, { metal: 0.8 })];
    [-0.75, -0.65, -0.55, -0.45, -0.35].forEach((x, i) => parts.push(bx(0.1, 2.25, 0.09, x, 0, (i % 2 ? 0.015 : -0.015), 'P')));
    [0.35, 0.45, 0.55, 0.65, 0.75].forEach((x, i) => parts.push(bx(0.1, 2.25, 0.09, x, 0, (i % 2 ? -0.015 : 0.015), 'P')));
    return parts;
  },
  staircase: () => {
    const parts: Part[] = [];
    const rise = 3.0 / 17;
    const run = 4.3 / 17;
    for (let i = 0; i < 17; i++) {
      // Climbs toward -Z: the lowest step is at the front (+Z).
      const z = 2.15 - run * (i + 0.5);
      parts.push(bx(1.0, rise * (i + 1), run, 0, 0, z, i % 2 ? 'P' : 'P2'));
    }
    return parts;
  },
};

// ---------------------------------------------------------------------------

const geoCache = new Map<string, THREE.BufferGeometry>();
const matCache = new Map<string, THREE.MeshStandardMaterial>();

function geometryFor(p: Part): THREE.BufferGeometry {
  const key = `${p.s}|${p.size.join(',')}`;
  let g = geoCache.get(key);
  if (!g) {
    g = p.s === 'box' ? new THREE.BoxGeometry(p.size[0], p.size[1], p.size[2])
      : p.s === 'cyl' ? new THREE.CylinderGeometry(p.size[0], p.size[1], p.size[2], 24)
      : new THREE.SphereGeometry(p.size[0], 16, 12);
    geoCache.set(key, g);
  }
  return g;
}

const shade = (hex: string, amount: number): string => {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.min(1, Math.max(0, hsl.l + amount)));
  return `#${c.getHexString()}`;
};

/** Resolve a colour token against the asset's own colours. */
export function resolveColor(token: string, asset: Pick<PlacedAsset, 'color' | 'specs' | 'type'>): string {
  const base = asset.color || HOUSE_ASSET_SPECS[asset.type as HouseAssetType]?.color || '#999999';
  switch (token) {
    case 'P': return base;
    case 'P2': return shade(base, 0.1);
    case 'P3': return shade(base, -0.12);
    case 'W': return asset.specs?.Wood || '#a97c50';
    case 'GLOW': return asset.specs?.Glow || '#fff4d6';
    default: return token;
  }
}

function materialFor(p: Part, color: string, lit: boolean): THREE.MeshStandardMaterial {
  const key = `${color}|${p.rough ?? 0.6}|${p.metal ?? 0.05}|${p.opacity ?? 1}|${p.glow ? (lit ? 'on' : 'off') : ''}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color, roughness: p.rough ?? 0.6, metalness: p.metal ?? 0.05,
      transparent: (p.opacity ?? 1) < 1, opacity: p.opacity ?? 1,
      ...(p.glow ? { emissive: new THREE.Color(color), emissiveIntensity: lit ? 1.4 : 0.12 } : {}),
    });
    matCache.set(key, m);
  }
  return m;
}

/** Part list for an asset, with the rug sized from its scale. */
export function partsFor(asset: PlacedAsset): Part[] {
  const spec = HOUSE_ASSET_SPECS[asset.type as HouseAssetType];
  // A scale of exactly 1 means "not resized" (same rule as getAssetSize).
  const sized = (v: number | undefined, def: number) => (v && v !== 1 ? v : def);
  const w = spec.scalable ? sized(asset.scale?.x, spec.size.x) : spec.size.x;
  const d = spec.scalable ? sized(asset.scale?.z, spec.size.z) : spec.size.z;
  return HOUSE_PARTS[asset.type as HouseAssetType]({ w, d });
}

/** Add the meshes of a house asset to `group`. `lit` turns on glowing parts (lights). */
export function buildHouseModel(asset: PlacedAsset, group: THREE.Group, lit = false): void {
  for (const p of partsFor(asset)) {
    const mesh = new THREE.Mesh(geometryFor(p), materialFor(p, resolveColor(p.c, asset), lit));
    mesh.position.set(...p.pos);
    if (p.rx) mesh.rotation.x = p.rx;
    mesh.castShadow = !p.glow && (p.opacity ?? 1) >= 1;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
}
