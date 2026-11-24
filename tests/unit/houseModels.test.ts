import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { HOUSE_ASSET_SPECS, HOUSE_ASSET_TYPES } from '../../src/house/assetSpecs';
import { buildHouseModel, resolveColor } from '../../src/three/houseModels';
import { buildProceduralAssetMesh } from '../../src/three/proceduralAssets';
import { getAssetSize, getDefaultHeight, isOverlapping, isAssetOutsideRooms } from '../../src/utils/geometry';
import { getAssetHeightLayer, type PlacedAsset } from '../../src/types';

const asset = (type: PlacedAsset['type'], over: Partial<PlacedAsset> = {}): PlacedAsset => ({
  id: `h_${type}`, type, category: 'furniture', name: type, position: { x: 0, y: getDefaultHeight(type), z: 0 },
  rotationY: 0, scale: { x: 1, y: 1, z: 1 }, ...over,
} as PlacedAsset);

const boundsOf = (a: PlacedAsset) => {
  const g = new THREE.Group();
  buildHouseModel(a, g, true);
  g.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(g);
  return { box, size: box.getSize(new THREE.Vector3()), centre: box.getCenter(new THREE.Vector3()) };
};

describe('house model bounding boxes', () => {
  it.each(HOUSE_ASSET_TYPES)('%s is built to its real-world size', (type) => {
    const want = HOUSE_ASSET_SPECS[type].size;
    const { size } = boundsOf(asset(type));
    expect(size.x, `${type} width`).toBeCloseTo(want.x, 1);
    expect(size.y, `${type} height`).toBeCloseTo(want.y, 1);
    expect(size.z, `${type} depth`).toBeCloseTo(want.z, 1);
    // within 2 cm
    expect(Math.abs(size.x - want.x), `${type} width`).toBeLessThanOrEqual(0.02);
    expect(Math.abs(size.y - want.y), `${type} height`).toBeLessThanOrEqual(0.02);
    expect(Math.abs(size.z - want.z), `${type} depth`).toBeLessThanOrEqual(0.02);
  });

  it.each(HOUSE_ASSET_TYPES)('%s has its origin at the bottom centre', (type) => {
    const { box, centre } = boundsOf(asset(type));
    expect(box.min.y, `${type} bottom`).toBeCloseTo(0, 2);
    expect(Math.abs(centre.x), `${type} x centre`).toBeLessThanOrEqual(0.03);
    expect(Math.abs(centre.z), `${type} z centre`).toBeLessThanOrEqual(0.03);
  });

  it.each(HOUSE_ASSET_TYPES)('%s footprint matches the model', (type) => {
    const a = asset(type);
    const fp = getAssetSize(a);
    const { size } = boundsOf(a);
    expect(Math.abs(fp.width - size.x)).toBeLessThanOrEqual(0.02);
    expect(Math.abs(fp.depth - size.z)).toBeLessThanOrEqual(0.02);
  });

  it('rugs take their size from the asset scale', () => {
    const a = asset('rug', { scale: { x: 3, y: 1, z: 2 } });
    expect(getAssetSize(a)).toEqual({ width: 3, depth: 2 });
    const { size } = boundsOf(a);
    expect(size.x).toBeCloseTo(3, 2);
    expect(size.z).toBeCloseTo(2, 2);
  });

  it('floor items stand on the floor wherever their stored height is; wall and ceiling items hang from it', () => {
    const world = (a: PlacedAsset) => {
      const g = new THREE.Group();
      buildProceduralAssetMesh(a, g, { isSelected: false, viewMode: '3D' });
      g.position.set(0, a.position.y, 0);
      g.updateMatrixWorld(true);
      return new THREE.Box3().setFromObject(g);
    };
    expect(world(asset('sofa', { position: { x: 0, y: 0.4, z: 0 } })).min.y).toBeCloseTo(0, 3);
    expect(world(asset('sofa', { position: { x: 0, y: 0, z: 0 } })).min.y).toBeCloseTo(0, 3);
    const sconce = world(asset('wall_sconce'));
    expect(sconce.min.y).toBeCloseTo(1.7, 2);
    const pendant = world(asset('pendant_light'));
    expect(pendant.max.y).toBeCloseTo(2.7, 2); // plate meets a 2.7 m ceiling
  });

  it('lights glow only when switched on', () => {
    const emissive = (lit: boolean) => {
      const g = new THREE.Group();
      buildHouseModel(asset('pendant_light'), g, lit);
      let max = 0;
      g.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined; if (m?.emissive && m.emissive.getHex() !== 0) max = Math.max(max, m.emissiveIntensity); });
      return max;
    };
    expect(emissive(true)).toBeGreaterThan(emissive(false) * 5);
  });

  it('resolves colour tokens against the asset', () => {
    const a = asset('sofa', { color: '#336699', specs: { Wood: '#112233' } });
    expect(resolveColor('P', a)).toBe('#336699');
    expect(resolveColor('W', a)).toBe('#112233');
    expect(resolveColor('#abcdef', a)).toBe('#abcdef');
    expect(resolveColor('P2', a)).not.toBe('#336699');
  });
});

describe('layers and collisions for house assets', () => {
  it('puts lights on the ceiling layer, wall items on the port layer and rugs on a flat layer', () => {
    expect(getAssetHeightLayer('pendant_light')).toBe('ceiling');
    expect(getAssetHeightLayer('wall_art')).toBe('port');
    expect(getAssetHeightLayer('rug')).toBe('flat');
    expect(getAssetHeightLayer('sofa')).toBe('ground');
  });
  it('rugs never collide, but furniture does', () => {
    const at = (type: PlacedAsset['type'], x: number, z: number, rot = 0) => asset(type, { position: { x, y: 0, z }, rotationY: rot });
    expect(isOverlapping(at('rug', 0, 0), at('sofa', 0, 0))).toBe(false);
    expect(isOverlapping(at('sofa', 0, 0), at('sofa', 1, 0))).toBe(true);
    expect(isOverlapping(at('sofa', 0, 0), at('sofa', 2.2, 0))).toBe(false);
  });
  it('uses real rectangles, so rotation matters', () => {
    const at = (type: PlacedAsset['type'], x: number, z: number, rot = 0) => asset(type, { position: { x, y: 0, z }, rotationY: rot });
    // A 2.1 m sofa lies along X; a table 1.2 m away on X touches it, but not when the sofa is turned to lie along Z.
    expect(isOverlapping(at('sofa', 0, 0), at('side_table', 1.1, 0))).toBe(true);
    expect(isOverlapping(at('sofa', 0, 0, Math.PI / 2), at('side_table', 1.1, 0))).toBe(false);
  });
  it('checks room bounds with the rotated footprint', () => {
    const room = { id: 'r', name: 'r', areaSqFt: 0, color: '#fff', x: 0, z: 0, width: 3, depth: 6 };
    // 2.1 m sofa along X in a 3 m wide room fits; turned along Z at x=1.0 it spans 0.5..1.5 in X and fits, but unrotated at x=1.2 it sticks out.
    expect(isAssetOutsideRooms(asset('sofa', { position: { x: 0, y: 0, z: 0 } }), [room])).toBe(false);
    expect(isAssetOutsideRooms(asset('sofa', { position: { x: 1.2, y: 0, z: 0 } }), [room])).toBe(true);
    expect(isAssetOutsideRooms(asset('sofa', { position: { x: 1.0, y: 0, z: 0 }, rotationY: Math.PI / 2 }), [room])).toBe(false);
  });
});
