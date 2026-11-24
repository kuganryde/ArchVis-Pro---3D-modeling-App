/**
 * Furnishes a floor plan: furniture, decor and lighting for every room, in the
 * chosen style. Everything goes through RoomPlacer, so nothing overlaps, nothing
 * blocks a door swing and tall pieces stay off windows.
 */
import type { AssetType, PlacedAsset, RoomKind } from '../types';
import { HOUSE_ASSET_SPECS } from './assetSpecs';
import type { DesignStyle, FixtureStyle } from './styles';
import { RoomPlacer, OPPOSITE, WALLS, WALL_ROT, INWARD, type Wall, type Placed } from './placer';
import { WALL_T, type Plan, type Rect } from './layout';
import type { HouseBrief } from './types';

export const CEILING_HEIGHT = 2.7;
const LIGHT_TYPES: AssetType[] = ['ceiling_light', 'pendant_light', 'downlight', 'wall_sconce'];

/** Small seeded generator (mulberry32) so a variation always gives the same house. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const hashString = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};

/** Light colour for a colour temperature (rough black-body tint), as a hex string. */
export function kelvinColor(k: number): string {
  const t = Math.min(6500, Math.max(1800, k)) / 100;
  const r = t <= 66 ? 255 : Math.min(255, Math.max(0, 329.7 * Math.pow(t - 60, -0.1332)));
  const g = t <= 66 ? Math.min(255, Math.max(0, 99.47 * Math.log(t) - 161.12)) : Math.min(255, Math.max(0, 288.1 * Math.pow(t - 60, -0.0755)));
  const b = t >= 66 ? 255 : t <= 19 ? 0 : Math.min(255, Math.max(0, 138.52 * Math.log(t - 10) - 305.04));
  const hex = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

export const KELVIN: Record<NonNullable<HouseBrief['lighting']>, number> = { warm: 2700, neutral: 3500, cool: 4500 };

export interface FurnishCtx {
  plan: Plan;
  brief: HouseBrief;
  style: DesignStyle;
  levelIds: string[];
  roomIds: Map<Rect, string>;
  nextId: () => string;
  kelvin: number;
}

const PALETTE_SPECS = (c: FurnishCtx) => ({ Wood: c.style.palette.wood });

const fabric = (c: FurnishCtx, i: number) => c.style.palette.fabrics[((i % c.style.palette.fabrics.length) + c.style.palette.fabrics.length) % c.style.palette.fabrics.length];

function exteriorOf(r: Rect, plan: Plan): Record<Wall, boolean> {
  const e = 0.02;
  return {
    n: Math.abs(r.z0 + plan.depth / 2) < e, s: Math.abs(r.z1 - plan.depth / 2) < e,
    w: Math.abs(r.x0 + plan.width / 2) < e, e: Math.abs(r.x1 - plan.width / 2) < e,
  };
}

/** Add curtains on each window if the style has them. */
function curtains(p: RoomPlacer, c: FurnishCtx) {
  if (!c.style.decor.curtains) return;
  for (const w of WALLS) for (const [s, e] of p.windowSpans(w)) {
    p.placeWallItem('curtain', w, (s + e) / 2, { color: fabric(c, 2), specs: PALETTE_SPECS(c), y: 0 });
  }
}

/** Framed art centred at `a` on `wall`. */
function art(p: RoomPlacer, c: FurnishCtx, wall: Wall, a: number, y = 1.3, tone = 0) {
  if (!c.style.decor.art) return;
  p.placeWallItem('wall_art', wall, a, { color: fabric(c, tone + 1), specs: PALETTE_SPECS(c), y });
}

function plant(p: RoomPlacer, c: FurnishCtx) {
  const want = c.style.decor.plants;
  if (want <= 0) return;
  for (const corner of ['ne', 'nw', 'se', 'sw'] as const) if (p.placeInCorner('plant_pot', corner, { specs: PALETTE_SPECS(c) })) return;
}

function sofaArea(p: RoomPlacer, c: FurnishCtx, rng: () => number): Wall | undefined {
  const solid = p.solidWalls();
  const long = solid.filter((w) => p.freeLength(w) >= 3.2);
  const order = long.length ? [...long] : [...solid];
  if (order.length > 1 && rng() < 0.4) [order[0], order[1]] = [order[1], order[0]];
  let sofa: Placed | null = null;
  let wall: Wall | undefined;
  for (const w of order) {
    sofa = p.placeOnWall('sofa', w, 'center', { color: fabric(c, 0), specs: PALETTE_SPECS(c), clear: 1.7 }) ?? p.placeOnWall('sofa', w, 'center', { color: fabric(c, 0), specs: PALETTE_SPECS(c) });
    if (sofa) { wall = w; break; }
  }
  if (!sofa || !wall) return undefined;
  const [ix, iz] = INWARD[wall];
  const sc = sofa.asset.position;
  // Coffee table and rug in front of the sofa.
  const tableAt = { x: sc.x + ix * (0.475 + 0.45 + 0.3), z: sc.z + iz * (0.475 + 0.45 + 0.3) };
  p.placeAt('coffee_table', tableAt.x, tableAt.z, WALL_ROT[wall], { specs: PALETTE_SPECS(c) });
  if (c.style.decor.rugs) {
    const rw = Math.min(2.6, wall === 'n' || wall === 's' ? p.width - 0.4 : p.depth - 0.4);
    p.placeAt('rug', sc.x + ix * 1.0, sc.z + iz * 1.0, WALL_ROT[wall], { color: c.style.palette.rug, scale: { x: rw, y: 1, z: 1.8 } });
  }
  // End table and lamp either side of the sofa.
  const len = p.wallLen(wall);
  for (const [dir, type] of [[-1, 'side_table'], [1, 'floor_lamp']] as const) {
    const a = sofa.a + dir * (1.05 + 0.3);
    p.placeOnWall(type, wall, { at: Math.min(len - 0.5, Math.max(0.5, a)) }, { specs: PALETTE_SPECS(c), color: type === 'floor_lamp' ? '#f3e8d0' : undefined });
  }
  art(p, c, wall, sofa.a, 1.3, 0);
  // Television opposite, or on a side wall when the room is short.
  const perpendicular = wall === 'n' || wall === 's' ? p.depth : p.width;
  const tvWalls = perpendicular >= 3.9 && p.freeLength(OPPOSITE[wall]) >= 1.8 ? [OPPOSITE[wall]] : WALLS.filter((w) => w !== wall && w !== OPPOSITE[wall] && p.freeLength(w) >= 1.8);
  for (const tw of tvWalls) {
    const unit = p.placeOnWall('tv_unit', tw, 'center', { specs: PALETTE_SPECS(c) });
    if (unit) { p.placeWallItem('lcd_display', tw, unit.a, { y: 1.0 }); break; }
  }
  // Bookshelf, armchair and a plant on the remaining walls.
  for (const w of p.solidWalls()) if (w !== wall && p.placeOnWall('bookshelf', w, 'start', { specs: PALETTE_SPECS(c) })) break;
  for (const w of WALLS) if (w !== wall && p.placeOnWall('chair_lounge', w, 'end', { color: fabric(c, 1) })) break;
  plant(p, c);
  curtains(p, c);
  return wall;
}

/** Rotate a local offset by `rot` about a centre, the same way the models rotate. */
const around = (cx: number, cz: number, dx: number, dz: number, rot: number): [number, number] =>
  [cx + dx * Math.cos(rot) + dz * Math.sin(rot), cz - dx * Math.sin(rot) + dz * Math.cos(rot)];

function dining(p: RoomPlacer, c: FurnishCtx): Wall | undefined {
  const rot = p.width >= p.depth ? 0 : Math.PI / 2;
  const spot = p.findSpot('dining_table', rot, { clear: 1.5 }) ?? p.findSpot('dining_table', rot, { clear: 0.9 }) ?? p.findSpot('dining_table', rot);
  if (spot) {
    const [tx, tz] = spot;
    p.placeAt('dining_table', tx, tz, rot, { specs: PALETTE_SPECS(c) });
    // Chairs: two a side along the long edges, one at each end. Chairs face the table.
    const seats: Array<[number, number, number]> = [[-0.4, 0.72, 0], [0.4, 0.72, 0], [-0.4, -0.72, Math.PI], [0.4, -0.72, Math.PI], [1.07, 0, -Math.PI / 2], [-1.07, 0, Math.PI / 2]];
    for (const [dx, dz, face] of seats) {
      // The chair on the +z side faces -z (rot PI); the -z side faces +z (rot 0).
      const [x, z] = around(tx, tz, dx, dz, rot);
      const chairRot = dz > 0 ? Math.PI + rot : dz < 0 ? rot : face + rot;
      p.placeAt('dining_chair', x, z, chairRot, { color: fabric(c, 2), specs: PALETTE_SPECS(c) });
    }
  }
  let feature: Wall | undefined;
  for (const w of p.solidWalls()) {
    if (p.placeOnWall('sideboard', w, 'center', { specs: PALETTE_SPECS(c) })) {
      feature = w;
      const sb = p.assets[p.assets.length - 1];
      const a = w === 'n' || w === 's' ? sb.position.x - p.rect.x0 : sb.position.z - p.rect.z0;
      art(p, c, w, a, 1.2, 2);
      break;
    }
  }
  plant(p, c);
  curtains(p, c);
  return feature ?? p.solidWalls()[0];
}

function kitchen(p: RoomPlacer, c: FurnishCtx): Wall | undefined {
  const cab = c.style.palette.cabinet;
  let counterWall: Wall | undefined;
  let base: Placed | null = null;
  for (const w of p.solidWalls()) {
    if (p.freeLength(w) < 2.6) continue;
    base = p.placeOnWall('kitchen_base', w, 'start', { color: cab, specs: PALETTE_SPECS(c), clear: 0.9 }) ?? p.placeOnWall('kitchen_base', w, 'end', { color: cab, specs: PALETTE_SPECS(c) });
    if (base) { counterWall = w; break; }
  }
  if (base && counterWall) {
    p.placeWallItem('kitchen_upper', counterWall, base.a, { color: cab, specs: PALETTE_SPECS(c) });
    // Fridge beside the run, on whichever side has room.
    const len = p.wallLen(counterWall);
    const right = base.a + 1.2 + 0.375 + 0.01, left = base.a - 1.2 - 0.375 - 0.01;
    const fridge = p.placeOnWall('fridge', counterWall, { at: right <= len - 0.6 ? right : left }, {});
    if (!fridge) for (const w of p.solidWalls()) if (w !== counterWall && p.placeOnWall('fridge', w, 'start', {})) break;
    // Island if there is room for a 1 m aisle either side.
    const across = counterWall === 'n' || counterWall === 's' ? p.depth : p.width;
    if (across >= 4.1) {
      const [ix, iz] = INWARD[counterWall];
      const dist = 0.3 + 1.05 + 0.45;
      const swapAxis = counterWall === 'e' || counterWall === 'w';
      const irot = swapAxis ? Math.PI / 2 : 0;
      const bx = (swapAxis ? p.rect.x0 + (counterWall === 'w' ? 0 : p.rect.x1 - p.rect.x0) : 0);
      const centre = swapAxis
        ? { x: (counterWall === 'w' ? p.ix0 + 0.6 : p.ix1 - 0.6) + ix * dist, z: p.cz }
        : { x: p.cx, z: (counterWall === 'n' ? p.iz0 + 0.6 : p.iz1 - 0.6) + iz * dist };
      void bx;
      const island = p.placeAt('kitchen_island', centre.x, centre.z, irot, { color: cab, specs: PALETTE_SPECS(c) });
      if (island) {
        for (const dx of [-0.45, 0.45]) {
          const [sx, sz] = around(centre.x, centre.z, dx, 0.45 + 0.2 + 0.03, irot);
          p.placeAt('bar_stool', sx, sz, irot + Math.PI, { color: fabric(c, 2), specs: PALETTE_SPECS(c) });
        }
      }
    }
  }
  curtains(p, c);
  return counterWall;
}

function bedroom(p: RoomPlacer, c: FurnishCtx, rng: () => number, master: boolean, index: number): Wall | undefined {
  const bedType: AssetType = master ? 'bed_king' : Math.min(p.width, p.depth) >= 3.0 ? 'bed_double' : 'bed_single';
  const bedW = HOUSE_ASSET_SPECS[bedType as 'bed_king'].size.x;
  // Headboard wall: solid, no windows if possible, with space for bedside tables.
  const solid = p.solidWalls();
  const order = [
    ...solid.filter((w) => !p.hasWindow(w) && p.freeLength(w) >= bedW + 1.2),
    ...solid.filter((w) => !p.hasWindow(w) && p.freeLength(w) >= bedW + 0.3),
    ...solid.filter((w) => p.freeLength(w) >= bedW + 0.3),
  ];
  const seen = new Set<Wall>();
  let bed: Placed | null = null;
  let bedWall: Wall | undefined;
  for (const w of order) {
    if (seen.has(w)) continue;
    seen.add(w);
    bed = p.placeOnWall(bedType, w, 'center', { color: fabric(c, index), specs: PALETTE_SPECS(c) });
    if (bed) { bedWall = w; break; }
  }
  if (bed && bedWall) {
    const len = p.wallLen(bedWall);
    const side = bedW / 2 + 0.225 + 0.04;
    for (const dir of [-1, 1]) {
      const a = bed.a + dir * side;
      if (a - 0.225 > 0.14 && a + 0.225 < len - 0.14) p.placeOnWall('bedside_table', bedWall, { at: a }, { specs: PALETTE_SPECS(c) });
    }
    if (c.style.decor.rugs) {
      const [ix, iz] = INWARD[bedWall];
      p.placeAt('rug', bed.asset.position.x + ix * 1.0, bed.asset.position.z + iz * 1.0, WALL_ROT[bedWall], { color: c.style.palette.rug, scale: { x: Math.min(2.4, bedW + 0.8), y: 1, z: 2.0 } });
    }
    art(p, c, bedWall, bed.a, 1.35, index);
  }
  // Storage on solid walls away from the bed.
  const wardrobe = solid.filter((w) => w !== bedWall).find((w) => p.placeOnWall('wardrobe', w, 'start', { color: c.style.palette.cabinet, specs: PALETTE_SPECS(c), clear: 0.8 }));
  if (!wardrobe) for (const w of solid) if (w !== bedWall && p.placeOnWall('dresser', w, 'center', { specs: PALETTE_SPECS(c) })) break;
  if (master) {
    for (const w of solid) if (w !== bedWall && p.placeOnWall('dresser', w, 'center', { specs: PALETTE_SPECS(c) })) break;
    for (const corner of ['se', 'sw', 'ne', 'nw'] as const) if (p.placeInCorner('chair_lounge', corner, { color: fabric(c, 1) })) break;
  } else if (rng() < 0.5) {
    for (const w of WALLS) if (p.placeOnWall('desk_single', w, 'center', { clear: 0.8 })) { break; }
    const desk = p.assets.find((a) => a.type === 'desk_single');
    if (desk) {
      const rot = desk.rotationY;
      p.placeAt('chair_office', desk.position.x + Math.sin(rot) * (0.35 + 0.33), desk.position.z + Math.cos(rot) * (0.35 + 0.33), rot + Math.PI, { color: fabric(c, 0) });
    }
  }
  plant(p, c);
  curtains(p, c);
  return bedWall;
}

function bathroom(p: RoomPlacer, c: FurnishCtx, kind: RoomKind): Wall | undefined {
  const cab = c.style.palette.cabinet;
  const solid = p.solidWalls();
  let vanityWall: Wall | undefined;
  if (kind !== 'powder') {
    // Shower in the corner farthest from the door.
    for (const corner of ['nw', 'ne', 'sw', 'se'] as const) if (p.placeInCorner('shower', corner)) break;
  }
  for (const w of solid) {
    const v = p.placeOnWall('vanity', w, 'center', { color: cab, specs: PALETTE_SPECS(c), clear: 0.5 }) ?? p.placeOnWall('vanity', w, 'end', { color: cab, specs: PALETTE_SPECS(c) });
    if (v) {
      vanityWall = w;
      p.placeWallItem('mirror', w, v.a, { y: 1.0, specs: PALETTE_SPECS(c) });
      break;
    }
  }
  for (const w of [...solid, ...WALLS]) if (p.placeOnWall('toilet', w, 'end', {}) ?? p.placeOnWall('toilet', w, 'start', {})) break;
  if (kind === 'bathroom' && p.width * p.depth >= 5.5) for (const w of solid) if (p.placeOnWall('bathtub', w, 'center', {})) break;
  curtains(p, c);
  return vanityWall;
}

function study(p: RoomPlacer, c: FurnishCtx): Wall | undefined {
  let deskWall: Wall | undefined;
  for (const w of p.solidWalls()) {
    const d = p.placeOnWall('desk_single', w, 'center', { specs: PALETTE_SPECS(c), clear: 1.0 });
    if (d) {
      deskWall = w;
      const rot = d.asset.rotationY;
      p.placeAt('chair_office', d.asset.position.x + Math.sin(rot) * (0.35 + 0.33), d.asset.position.z + Math.cos(rot) * (0.35 + 0.33), rot + Math.PI, { color: fabric(c, 0) });
      art(p, c, w, d.a, 1.3, 1);
      break;
    }
  }
  for (const w of p.solidWalls()) if (w !== deskWall && p.placeOnWall('bookshelf', w, 'center', { specs: PALETTE_SPECS(c) })) break;
  for (const corner of ['ne', 'nw', 'se', 'sw'] as const) if (p.placeInCorner('floor_lamp', corner, { color: '#f3e8d0' })) break;
  plant(p, c);
  curtains(p, c);
  return deskWall;
}

function laundry(p: RoomPlacer, c: FurnishCtx): Wall | undefined {
  for (const w of p.solidWalls()) {
    const a = p.placeOnWall('washer', w, 'start', { clear: 0.7 });
    if (a) { p.placeOnWall('cabinet', w, 'end', {}); return w; }
  }
  return undefined;
}

function entrance(p: RoomPlacer, c: FurnishCtx, plan: Plan, level: number): Wall | undefined {
  if (plan.floors === 2 && plan.stair && level === 0) {
    // Straight stair against the west wall, climbing north.
    const stair = { x: plan.stair.x, z: plan.stair.z };
    p.placeAt('staircase', stair.x, stair.z, 0, { color: c.style.palette.wood });
  }
  let feature: Wall | undefined;
  for (const w of p.solidWalls()) {
    const s = p.placeOnWall('sideboard', w, 'center', { specs: PALETTE_SPECS(c), clear: 0.9 });
    if (s) {
      feature = w;
      p.placeWallItem('mirror', w, s.a, { y: 1.1, specs: PALETTE_SPECS(c) });
      break;
    }
  }
  plant(p, c);
  return feature;
}

function corridor(p: RoomPlacer, c: FurnishCtx): Wall | undefined {
  if (!c.style.decor.art) return undefined;
  const w = p.solidWalls().find((x) => p.freeLength(x) >= 3);
  if (!w) return undefined;
  const len = p.wallLen(w);
  const n = Math.max(1, Math.min(3, Math.floor(len / 3.2)));
  for (let i = 0; i < n; i++) art(p, c, w, ((i + 0.5) * len) / n, 1.4, i);
  return w;
}

// ---------------------------------------------------------------------------
// Lighting
// ---------------------------------------------------------------------------

const lightSpecs = (c: FurnishCtx, lumens: number): Record<string, string> => ({
  Lumens: String(Math.round(lumens * c.style.lighting.brightness)),
  Kelvin: String(c.kelvin),
  Glow: kelvinColor(c.kelvin),
});

/** Ceiling and wall lights for one room, placed relative to the furniture already in it. */
export function lightRoom(p: RoomPlacer, c: FurnishCtx, kind: RoomKind, fixtures: FixtureStyle): PlacedAsset[] {
  const before = p.assets.length;
  const R = p.rect;
  const ceilingY = (type: AssetType) => CEILING_HEIGHT - HOUSE_ASSET_SPECS[type as 'downlight'].size.y;
  const lights: Array<{ type: AssetType; x: number; z: number; lumens: number }> = [];
  const hasTable = p.assets.find((a) => a.type === 'dining_table');
  const island = p.assets.find((a) => a.type === 'kitchen_island');
  const bed = p.assets.find((a) => a.type.startsWith('bed_'));
  const habitable = ['living', 'dining', 'kitchen', 'master_bedroom', 'bedroom', 'study'].includes(kind);

  const grid = (spacing: number, lumens: number, type: AssetType = 'downlight') => {
    const nx = Math.max(1, Math.round((p.width - 0.6) / spacing));
    const nz = Math.max(1, Math.round((p.depth - 0.6) / spacing));
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      lights.push({ type, x: p.ix0 + ((i + 0.5) * p.width) / nx, z: p.iz0 + ((j + 0.5) * p.depth) / nz, lumens });
    }
  };
  const centre = (type: AssetType, lumens: number) => lights.push({ type, x: p.cx, z: p.cz, lumens });
  const pendantsOver = (a: PlacedAsset | undefined, along: 'x' | 'z', count: number, spread: number) => {
    if (!a) return false;
    const rot = Math.abs(Math.sin(a.rotationY)) > 0.5;
    const axisX = along === 'x' ? !rot : rot;
    for (let i = 0; i < count; i++) {
      const off = (i - (count - 1) / 2) * spread;
      lights.push({ type: 'pendant_light', x: a.position.x + (axisX ? off : 0), z: a.position.z + (axisX ? 0 : off), lumens: 500 });
    }
    return true;
  };

  switch (kind) {
    case 'living':
      if (fixtures === 'downlights' || fixtures === 'mixed') grid(1.9, 450);
      else if (fixtures === 'pendants') centre('pendant_light', 900);
      else centre('ceiling_light', 900);
      break;
    case 'dining':
      if (fixtures === 'downlights') grid(2.0, 450);
      else if (fixtures === 'sconces' || !pendantsOver(hasTable, 'x', 1, 0)) centre('ceiling_light', 700);
      break;
    case 'kitchen':
      if (fixtures === 'pendants' || fixtures === 'mixed') { if (!pendantsOver(island, 'x', 2, 0.9)) grid(1.8, 500); else grid(2.4, 400); }
      else grid(1.8, 500);
      break;
    case 'master_bedroom':
    case 'bedroom':
      if (fixtures === 'downlights') grid(2.2, 350); else centre('ceiling_light', 700);
      break;
    case 'bathroom': case 'ensuite': case 'powder':
      if (fixtures === 'pendants' || fixtures === 'sconces') centre('ceiling_light', 600); else grid(1.5, 400);
      break;
    case 'laundry': case 'store':
      centre('ceiling_light', 600);
      break;
    case 'study':
      if (fixtures === 'downlights') grid(2.0, 450); else centre('ceiling_light', 700);
      break;
    default: {
      // Foyer, hall, landing: a line down the middle.
      const long = p.width >= p.depth;
      const n = Math.max(1, Math.round((long ? p.width : p.depth) / 2.4));
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const x = long ? p.ix0 + t * p.width : p.cx, z = long ? p.cz : p.iz0 + t * p.depth;
        lights.push({ type: fixtures === 'downlights' || fixtures === 'mixed' ? 'downlight' : 'ceiling_light', x, z, lumens: fixtures === 'downlights' ? 350 : 500 });
      }
    }
  }
  void R;
  for (const l of lights) {
    const keepOut = l.x < p.ix0 + 0.2 || l.x > p.ix1 - 0.2 || l.z < p.iz0 + 0.2 || l.z > p.iz1 - 0.2;
    if (keepOut) continue;
    const asset: PlacedAsset = {
      id: c.nextId(), type: l.type, category: 'furniture', name: HOUSE_ASSET_SPECS[l.type as 'downlight'].label,
      position: { x: l.x, y: ceilingY(l.type), z: l.z }, rotationY: 0, scale: { x: 1, y: 1, z: 1 },
      color: HOUSE_ASSET_SPECS[l.type as 'downlight'].color, specs: lightSpecs(c, l.lumens),
      assignedRoomId: p.roomId, levelId: p.levelId,
    };
    p.assets.push(asset);
  }
  // Wall sconces flanking the bed or the sofa wall.
  if (fixtures === 'sconces' || (fixtures === 'mixed' && (kind === 'master_bedroom' || kind === 'bedroom'))) {
    const anchor = bed ?? p.assets.find((a) => a.type === 'sofa');
    if (anchor && habitable) {
      const rot = anchor.rotationY;
      // Which wall is the anchor against? Its back faces opposite its front.
      const wall = (['n', 's', 'w', 'e'] as Wall[]).find((w) => Math.abs(WALL_ROT[w] - rot) < 0.01 || Math.abs(Math.abs(WALL_ROT[w] - rot) - Math.PI * 2) < 0.01);
      if (wall) {
        const a = wall === 'n' || wall === 's' ? anchor.position.x - p.rect.x0 : anchor.position.z - p.rect.z0;
        const half = (HOUSE_ASSET_SPECS[anchor.type as 'sofa'].size.x) / 2 + 0.45;
        for (const dir of [-1, 1]) {
          const s = p.placeWallItem('wall_sconce', wall, a + dir * half, { color: '#f3e8d0', specs: lightSpecs(c, 250), y: 1.7 });
          if (s) s.specs = lightSpecs(c, 250);
        }
      }
    }
  }
  return p.assets.slice(before);
}

// ---------------------------------------------------------------------------

export interface FurnishedRoom { rect: Rect; assets: PlacedAsset[]; featureWall?: Wall }

/** Furnish and light every room of a plan. */
export function furnishPlan(c: FurnishCtx, openings: Plan['openings']): FurnishedRoom[] {
  const rng = seeded(hashString(`${c.brief.styleId}|${c.brief.variation}|${c.plan.width.toFixed(1)}|${c.plan.depth.toFixed(1)}`));
  const out: FurnishedRoom[] = [];
  let bedIndex = 0;
  for (const rect of c.plan.rects) {
    const roomId = rect.id;
    const placer = new RoomPlacer(rect, openings[rect.id] ?? [], c.levelIds[rect.level], roomId, c.nextId, exteriorOf(rect, c.plan), CEILING_HEIGHT);
    let feature: Wall | undefined;
    switch (rect.kind) {
      case 'living': feature = sofaArea(placer, c, rng); break;
      case 'dining': feature = dining(placer, c); break;
      case 'kitchen': feature = kitchen(placer, c); break;
      case 'master_bedroom': feature = bedroom(placer, c, rng, true, bedIndex++); break;
      case 'bedroom': feature = bedroom(placer, c, rng, false, bedIndex++); break;
      case 'bathroom': case 'ensuite': case 'powder': feature = bathroom(placer, c, rect.kind); break;
      case 'study': feature = study(placer, c); break;
      case 'laundry': feature = laundry(placer, c); break;
      case 'foyer': feature = entrance(placer, c, c.plan, rect.level); break;
      case 'hall': case 'landing': feature = corridor(placer, c); break;
      default: break;
    }
    lightRoom(placer, c, rect.kind, c.style.lighting.fixtures);
    out.push({ rect, assets: placer.assets, featureWall: feature });
  }
  return out;
}

export { LIGHT_TYPES, WALL_T };
