import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { wallPieces, buildHouseRoom, DOOR_HEIGHT, WINDOW_SILL, WINDOW_HEAD } from '../../src/three/houseWalls';
import { LIGHTING_PRESETS, lightSourceFor, pickLightSources, isHouseRoom, LIGHT_SOURCE_TYPES } from '../../src/house/lighting';
import { generateHouse } from '../../src/house/generate';
import { kelvinColor } from '../../src/house/furnish';
import type { PlacedAsset, RoomDefinition } from '../../src/types';

describe('wall pieces', () => {
  it('is one full panel without openings', () => {
    expect(wallPieces(4, 2.7, [])).toEqual([{ a0: 0, a1: 4, y0: 0, y1: 2.7 }]);
  });
  it('leaves a floor-to-head gap for a door, with a lintel above it', () => {
    const p = wallPieces(4, 2.7, [{ wall: 'n', offset: 2, width: 0.9, kind: 'door' }]);
    const solidAtDoor = p.filter((x) => x.a0 < 2.0 && x.a1 > 2.0);
    expect(solidAtDoor).toEqual([{ a0: 1.55, a1: 2.45, y0: DOOR_HEIGHT, y1: 2.7 }]);
    expect(p.some((x) => x.a1 === 1.55 && x.y0 === 0 && x.y1 === 2.7)).toBe(true);
    expect(p.some((x) => x.a0 === 2.45 && x.y0 === 0)).toBe(true);
  });
  it('leaves a window hole between sill and head', () => {
    const p = wallPieces(4, 2.7, [{ wall: 'n', offset: 2, width: 1.4, kind: 'window' }]);
    const at = p.filter((x) => x.a0 <= 2 && x.a1 >= 2).sort((a, b) => a.y0 - b.y0);
    expect(at).toEqual([{ a0: 1.3, a1: 2.7, y0: 0, y1: WINDOW_SILL }, { a0: 1.3, a1: 2.7, y0: WINDOW_HEAD, y1: 2.7 }]);
  });
  it('covers exactly the wall area minus the holes', () => {
    const openings = [{ wall: 'n' as const, offset: 1, width: 0.9, kind: 'door' as const }, { wall: 'n' as const, offset: 3, width: 1.2, kind: 'window' as const }];
    const area = wallPieces(5, 2.7, openings).reduce((a, p) => a + (p.a1 - p.a0) * (p.y1 - p.y0), 0);
    expect(area).toBeCloseTo(5 * 2.7 - 0.9 * DOOR_HEIGHT - 1.2 * (WINDOW_HEAD - WINDOW_SILL), 5);
  });
});

describe('house room builder', () => {
  const house = generateHouse({ styleId: 'luxury', bedrooms: 3, bathrooms: 2 }, 'w')!;
  const room = house.design.rooms.find((r) => r.kind === 'living')!;

  it('builds a floor and walls that stay inside the room', () => {
    const g = buildHouseRoom(room, null, { wallHeight: 2.7, withWalls: true });
    g.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(g);
    expect(box.min.x).toBeGreaterThanOrEqual(room.x - room.width / 2 - 0.05);
    expect(box.max.x).toBeLessThanOrEqual(room.x + room.width / 2 + 0.05);
    expect(box.min.z).toBeGreaterThanOrEqual(room.z - room.depth / 2 - 0.05);
    expect(box.max.z).toBeLessThanOrEqual(room.z + room.depth / 2 + 0.05);
    expect(box.max.y).toBeCloseTo(2.7, 2);
  });

  it('plan view draws only the floor', () => {
    const g = buildHouseRoom(room, null, { wallHeight: 2.7, withWalls: false });
    expect(g.children).toHaveLength(1);
  });

  it('keeps every door and archway open: no wall piece fills the gap', () => {
    for (const r of house.design.rooms) {
      const g = buildHouseRoom(r, null, { wallHeight: 2.7, withWalls: true });
      g.updateMatrixWorld(true);
      for (const o of r.openings ?? []) {
        if (o.kind !== 'door' && o.kind !== 'arch') continue;
        const x0 = r.x - r.width / 2, z0 = r.z - r.depth / 2;
        const horizontal = o.wall === 'n' || o.wall === 's';
        const c = horizontal ? { x: x0 + o.offset, z: o.wall === 'n' ? z0 + 0.06 : z0 + r.depth - 0.06 } : { z: z0 + o.offset, x: o.wall === 'w' ? x0 + 0.06 : x0 + r.width - 0.06 };
        const probe = new THREE.Vector3(c.x ?? 0, 1.0, c.z ?? 0);
        // A point at the middle of the doorway, one metre up, must be inside no wall mesh.
        g.traverse((m) => {
          if (!(m as THREE.Mesh).isMesh) return;
          const b = new THREE.Box3().setFromObject(m);
          const thin = b.getSize(new THREE.Vector3());
          const isWall = Math.max(thin.x, thin.z) > 0.3 && thin.y > 0.2 && Math.min(thin.x, thin.z) < 0.2;
          if (isWall && b.containsPoint(probe)) {
            // doors only: glass and door leaves are small meshes; a solid wall piece there is a bug
            expect.fail(`wall blocks the ${o.kind} in ${r.name}`);
          }
        });
      }
    }
  });

  it('puts the accent finish on one wall only', () => {
    const withAccent = house.design.rooms.find((r) => r.accentWall)!;
    expect(withAccent).toBeTruthy();
    const g = buildHouseRoom(withAccent, null, { wallHeight: 2.7, withWalls: true });
    const mats = new Set<THREE.Material>();
    g.traverse((m) => { const mesh = m as THREE.Mesh; if (mesh.isMesh && Array.isArray(mesh.material)) mesh.material.forEach((x) => mats.add(x)); });
    expect(mats.size).toBeGreaterThanOrEqual(3); // plaster, wall finish, accent finish
  });
});

describe('lighting preview', () => {
  const light = (type: PlacedAsset['type'], lumens: string, x = 0, z = 0): PlacedAsset => ({
    id: `${type}${x}${z}`, type, category: 'furniture', name: type, position: { x, y: 2.6, z }, rotationY: 0, scale: { x: 1, y: 1, z: 1 },
    specs: { Lumens: lumens, Kelvin: '2700', Glow: '#ffd9a0' },
  });

  it('has day, evening and night presets that get darker', () => {
    const p = LIGHTING_PRESETS;
    expect(p.day.ambient).toBeGreaterThan(p.evening.ambient);
    expect(p.evening.ambient).toBeGreaterThan(p.night.ambient);
    expect(p.day.gain).toBe(0);
    expect(p.night.gain).toBeGreaterThan(p.evening.gain);
  });
  it('makes a point light for fixtures only, scaled by lumens and gain', () => {
    expect(lightSourceFor(light('sofa' as never, '500'), 1)).toBeNull();
    expect(lightSourceFor(light('downlight', '500'), 0)).toBeNull();
    const a = lightSourceFor(light('downlight', '500'), 1)!, b = lightSourceFor(light('downlight', '1000'), 1)!, c = lightSourceFor(light('downlight', '500'), 2)!;
    expect(b.intensity).toBeCloseTo(a.intensity * 2, 5);
    expect(c.intensity).toBeCloseTo(a.intensity * 2, 5);
    expect(a.color).toBe('#ffd9a0');
    expect(LIGHT_SOURCE_TYPES).toContain('floor_lamp');
  });
  it('caps the number of real lights, keeping the brightest and spreading the rest', () => {
    const many = Array.from({ length: 80 }, (_, i) => light('downlight', String(300 + (i % 7) * 20), (i % 10) * 0.5, Math.floor(i / 10) * 0.5));
    const chosen = pickLightSources(many, 1, 24);
    expect(chosen).toHaveLength(24);
    const few = pickLightSources(many.slice(0, 5), 1, 24);
    expect(few).toHaveLength(5);
  });
  it('lights a generated house within the cap', () => {
    const g = generateHouse({ bedrooms: 5, bathrooms: 3, floors: 2 }, 'l')!;
    const n = pickLightSources(g.design.assets, 1).length;
    expect(n).toBeGreaterThan(5);
    expect(n).toBeLessThanOrEqual(24);
  });
  it('tints light by colour temperature', () => {
    const warm = kelvinColor(2700), cool = kelvinColor(5000);
    const blue = (h: string) => parseInt(h.slice(5, 7), 16);
    expect(blue(warm)).toBeLessThan(blue(cool));
    expect(warm).toMatch(/^#[0-9a-f]{6}$/);
  });
  it('treats rooms with finishes or openings as house rooms', () => {
    const base = { id: 'r', name: 'r', areaSqFt: 0, color: '#fff', x: 0, z: 0, width: 3, depth: 3 } as RoomDefinition;
    expect(isHouseRoom(base)).toBe(false);
    expect(isHouseRoom({ ...base, floorFinishId: 'oak_plank' })).toBe(true);
    expect(isHouseRoom({ ...base, openings: [{ wall: 'n', offset: 1, width: 1, kind: 'door' }] })).toBe(true);
  });
});
