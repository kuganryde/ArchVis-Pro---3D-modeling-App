import { describe, it, expect } from 'vitest';
import { generateHouse, generateVariations, restyleHouse, relightHouse } from '../../src/house/generate';
import { DESIGN_STYLES } from '../../src/house/styles';
import { getFinish } from '../../src/house/finishes';
import { getAssetSize, isOverlapping, isAssetOutsideRooms } from '../../src/utils/geometry';
import { getAssetHeightLayer, type PlacedAsset, type RoomDefinition } from '../../src/types';
import { DEFAULT_BRIEF, type HouseBrief } from '../../src/house/types';

const houses: Array<{ brief: Partial<HouseBrief>; label: string }> = [];
for (const style of DESIGN_STYLES) for (const [floors, bedrooms, bathrooms, study] of [[1, 2, 1, false], [1, 3, 2, true], [1, 4, 3, false], [2, 3, 2, false], [2, 4, 3, true], [2, 5, 3, false]] as const) {
  houses.push({ brief: { styleId: style.id, floors, bedrooms, bathrooms, study }, label: `${style.id} ${floors}f ${bedrooms}bed ${bathrooms}bath ${study ? 'study' : ''}` });
}

const gens = houses.map((h) => ({ ...h, g: generateHouse(h.brief, 'g')! }));
const onLevel = (g: NonNullable<ReturnType<typeof generateHouse>>, levelId: string) => ({
  rooms: g.design.rooms.filter((r) => r.levelId === levelId),
  assets: g.design.assets.filter((a) => a.levelId === levelId),
});

describe('generated houses', () => {
  it('generates every house', () => {
    for (const { g, label } of gens) expect(g, label).toBeTruthy();
  });

  it('has no overlapping furniture and nothing outside its room', () => {
    for (const { g, label } of gens) {
      for (const level of g.design.levels) {
        const { rooms, assets } = onLevel(g, level.id);
        for (let i = 0; i < assets.length; i++) for (let j = i + 1; j < assets.length; j++) {
          expect(isOverlapping(assets[i], assets[j]), `${label}: ${assets[i].type} overlaps ${assets[j].type} in ${assets[i].assignedRoomId}`).toBe(false);
        }
        for (const a of assets) {
          const room = rooms.find((r) => r.id === a.assignedRoomId)!;
          expect(isAssetOutsideRooms(a, [room]), `${label}: ${a.type} sticks out of ${room.name}`).toBe(false);
        }
      }
    }
  });

  it('keeps door swings and archways clear', () => {
    for (const { g, label } of gens) {
      for (const room of g.design.rooms) {
        const assets = g.design.assets.filter((a) => a.assignedRoomId === room.id && getAssetHeightLayer(a.type) === 'ground');
        for (const o of room.openings ?? []) {
          if (o.kind === 'window') continue;
          const lo = o.offset - o.width / 2, hi = o.offset + o.width / 2;
          const x0 = room.x - room.width / 2, z0 = room.z - room.depth / 2;
          const swing = o.kind === 'arch' ? 0.3 : 0.6;
          const zone = o.wall === 'n' ? { x0: x0 + lo, x1: x0 + hi, z0, z1: z0 + swing }
            : o.wall === 's' ? { x0: x0 + lo, x1: x0 + hi, z0: z0 + room.depth - swing, z1: z0 + room.depth }
            : o.wall === 'w' ? { z0: z0 + lo, z1: z0 + hi, x0, x1: x0 + swing }
            : { z0: z0 + lo, z1: z0 + hi, x0: x0 + room.width - swing, x1: x0 + room.width };
          for (const a of assets) {
            const fp = getAssetSize(a);
            const swap = Math.abs(Math.sin(a.rotationY)) > 0.5;
            const hx = (swap ? fp.depth : fp.width) / 2, hz = (swap ? fp.width : fp.depth) / 2;
            const ox = Math.min(a.position.x + hx, zone.x1) - Math.max(a.position.x - hx, zone.x0);
            const oz = Math.min(a.position.z + hz, zone.z1) - Math.max(a.position.z - hz, zone.z0);
            expect(ox > 0.02 && oz > 0.02, `${label}: ${a.type} blocks a ${o.kind} in ${room.name}`).toBe(false);
          }
        }
      }
    }
  });

  it('furnishes each kind of room appropriately', () => {
    for (const { g, label } of gens) {
      for (const room of g.design.rooms) {
        const types = g.design.assets.filter((a) => a.assignedRoomId === room.id).map((a) => a.type);
        const has = (...t: string[]) => t.some((x) => types.includes(x as never));
        switch (room.kind) {
          case 'living': expect(has('sofa'), `${label} living has no sofa`).toBe(true); expect(has('tv_unit')).toBe(true); break;
          case 'dining': expect(has('dining_table'), `${label} dining has no table`).toBe(true); expect(types.filter((t) => t === 'dining_chair').length).toBeGreaterThanOrEqual(4); break;
          case 'kitchen': expect(has('kitchen_base'), `${label} kitchen has no counter`).toBe(true); break;
          case 'master_bedroom': expect(has('bed_king'), `${label} master has no bed`).toBe(true); break;
          case 'bedroom': expect(has('bed_double', 'bed_single'), `${label} ${room.name} has no bed`).toBe(true); break;
          case 'bathroom': case 'ensuite': case 'powder': expect(has('toilet'), `${label} ${room.name} has no toilet`).toBe(true); expect(has('vanity'), `${label} ${room.name} has no basin`).toBe(true); break;
          case 'study': expect(has('desk_single'), `${label} study has no desk`).toBe(true); break;
          case 'laundry': expect(has('washer')).toBe(true); break;
        }
        if (room.kind === 'bathroom' || room.kind === 'ensuite') expect(has('shower', 'bathtub'), `${label} ${room.name} has no shower or bath`).toBe(true);
      }
    }
  });

  it('lights every room, with the right colour temperature', () => {
    for (const { g, label } of gens) {
      for (const room of g.design.rooms) {
        const lights = g.design.assets.filter((a) => a.assignedRoomId === room.id && ['ceiling_light', 'pendant_light', 'downlight'].includes(a.type));
        expect(lights.length, `${label}: ${room.name} has no ceiling light`).toBeGreaterThan(0);
        for (const l of lights) {
          expect(Number(l.specs?.Kelvin)).toBe(g.meta.lighting.kelvin);
          expect(l.specs?.Glow).toMatch(/^#[0-9a-f]{6}$/);
          expect(l.position.y + 0.0).toBeLessThanOrEqual(2.7);
        }
      }
    }
  });

  it('puts only wet-safe tiles in wet rooms and a floor and wall finish in every room', () => {
    for (const { g, label } of gens) {
      for (const room of g.design.rooms) {
        expect(getFinish(room.floorFinishId), `${label} ${room.name} floor`).toBeTruthy();
        expect(getFinish(room.wallFinishId), `${label} ${room.name} wall`).toBeTruthy();
        if (['bathroom', 'ensuite', 'powder', 'laundry'].includes(room.kind!)) {
          expect(getFinish(room.floorFinishId)!.wet, `${label} ${room.name} floor`).toBe(true);
          expect(getFinish(room.wallFinishId)!.wet, `${label} ${room.name} wall`).toBe(true);
        }
        if (room.accentWall) {
          expect(getFinish(room.accentWall.finishId)).toBeTruthy();
          expect(['n', 's', 'e', 'w']).toContain(room.accentWall.wall);
        }
      }
    }
  });

  it('names rooms sensibly and numbers repeats', () => {
    const g = generateHouse({ bedrooms: 4, bathrooms: 3, floors: 2 }, 'n')!;
    const names = g.design.rooms.map((r) => r.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain('Master Bedroom');
    expect(names).toContain('Bedroom 2');
    expect(names).toContain('Bedroom 4');
    expect(names).toContain('Living Room');
  });

  it('builds two storeys with a staircase on the ground floor only', () => {
    const g = generateHouse({ floors: 2, bedrooms: 4, bathrooms: 3 }, 's')!;
    expect(g.design.levels.map((l) => l.name)).toEqual(['Ground Floor', 'First Floor']);
    expect(g.design.levels[1].elevation).toBeCloseTo(3, 3);
    const stairs = g.design.assets.filter((a) => a.type === 'staircase');
    expect(stairs).toHaveLength(1);
    expect(stairs[0].levelId).toBe(g.design.levels[0].id);
    const upper = g.design.rooms.filter((r) => r.levelId === g.design.levels[1].id).map((r) => r.kind);
    expect(upper).toContain('master_bedroom');
    expect(upper).not.toContain('kitchen');
  });

  it('is deterministic and varies with the variation number and the style', () => {
    const a = generateHouse({ styleId: 'boho' }, 'd')!, b = generateHouse({ styleId: 'boho' }, 'd')!;
    expect(a.design).toEqual(b.design);
    const finishes = (g: typeof a) => g.design.rooms.map((r) => `${r.floorFinishId}|${r.wallFinishId}`).join();
    expect(finishes(generateHouse({ styleId: 'modern', variation: 0 }, 'v')!)).not.toBe(finishes(generateHouse({ styleId: 'modern', variation: 1 }, 'v')!));
    expect(finishes(generateHouse({ styleId: 'modern' }, 'v')!)).not.toBe(finishes(generateHouse({ styleId: 'luxury' }, 'v')!));
    const variants = generateVariations({ styleId: 'modern', bedrooms: 3 }, 3);
    expect(variants).toHaveLength(3);
    const sizes = new Set(variants.map((v) => `${v.meta.width.toFixed(1)}x${v.meta.depth.toFixed(1)}`));
    expect(sizes.size).toBeGreaterThan(1);
  });

  it('honours finish preferences from the request', () => {
    const g = generateHouse({ styleId: 'modern', prefs: { floor: 'walnut_plank', accent: 'wp_floral_botanical', wetFloor: 'marble_black' } }, 'p')!;
    const living = g.design.rooms.find((r) => r.kind === 'living')!;
    expect(living.floorFinishId).toBe('walnut_plank');
    expect(g.design.rooms.find((r) => r.kind === 'ensuite')?.floorFinishId ?? 'marble_black').toBe('marble_black');
    expect(living.accentWall?.finishId).toBe('wp_floral_botanical');
  });

  it('applies the lighting temperature override', () => {
    expect(generateHouse({ lighting: 'cool' }, 'k')!.meta.lighting.kelvin).toBe(4500);
    expect(generateHouse({ lighting: 'warm' }, 'k')!.meta.lighting.kelvin).toBe(2700);
  });

  it('summarises finishes and costs', () => {
    const g = generateHouse({}, 'c')!;
    expect(g.meta.schedule).toHaveLength(g.design.rooms.length);
    expect(g.meta.cost.finishes).toBeGreaterThan(0);
    expect(g.meta.cost.furnishings).toBeGreaterThan(0);
    expect(g.meta.cost.total).toBe(g.meta.cost.finishes + g.meta.cost.furnishings);
    expect(g.meta.lightCount).toBeGreaterThan(g.design.rooms.length);
  });

  it('restyles in place: same walls and openings, new finishes and furniture', () => {
    const base = generateHouse({ styleId: 'modern', floors: 2, bedrooms: 3 }, 'b')!;
    const re = restyleHouse(base.design, { styleId: 'boho', floors: 2 }, 'r')!;
    const geom = (d: typeof base.design) => d.rooms.map((r) => [r.id, ...[r.x, r.z, r.width, r.depth].map((n) => +n.toFixed(6))]);
    expect(geom(re.design)).toEqual(geom(base.design));
    expect(re.design.rooms.map((r) => r.openings)).toEqual(base.design.rooms.map((r) => r.openings));
    expect(re.design.levels).toEqual(base.design.levels);
    expect(re.design.rooms.map((r) => r.floorFinishId).join()).not.toBe(base.design.rooms.map((r) => r.floorFinishId).join());
    for (const a of re.design.assets) expect(base.design.levels.some((l) => l.id === a.levelId)).toBe(true);
  });

  it('relights without moving furniture', () => {
    const base = generateHouse({ styleId: 'modern' }, 'b')!;
    const lit = relightHouse(base.design, 'pendants', 2700, 'q');
    const furniture = (d: typeof base.design) => d.assets.filter((a) => !['ceiling_light', 'pendant_light', 'downlight', 'wall_sconce'].includes(a.type)).map((a) => a.id);
    expect(furniture(lit)).toEqual(furniture(base.design));
    expect(lit.assets.some((a) => a.type === 'pendant_light')).toBe(true);
    expect(lit.assets.some((a) => a.type === 'ceiling_light')).toBe(true);
    const rooms = lit.rooms as RoomDefinition[];
    for (const level of lit.levels) {
      const assets = lit.assets.filter((a) => a.levelId === level.id) as PlacedAsset[];
      for (let i = 0; i < assets.length; i++) for (let j = i + 1; j < assets.length; j++) expect(isOverlapping(assets[i], assets[j]), `${assets[i].type} vs ${assets[j].type}`).toBe(false);
    }
    expect(rooms.length).toBeGreaterThan(0);
  });
});
