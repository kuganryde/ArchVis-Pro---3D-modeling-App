/**
 * Wall-aware placement helper used by the furnisher. A RoomPlacer owns one room: it
 * knows the usable interior (inside the wall thickness), the door swings that must
 * stay clear, the windows that tall furniture must not cover, and everything already
 * placed, and it only ever returns items that fit. Rotations are multiples of 90
 * degrees, so footprints are axis-aligned boxes.
 *
 * Facing: an asset's front is +Z at rotation 0. Rotation r turns its front to
 * (sin r, cos r) in (x, z). Placed with its back to a wall it therefore uses
 * n: 0, s: PI, w: PI/2, e: -PI/2.
 */
import type { AssetType, PlacedAsset, Opening } from '../types';
import { HOUSE_ASSET_SPECS, WALL_MOUNT_HEIGHT, isHouseAssetType } from './assetSpecs';
import { getAssetSize, isInfrastructureType, getDefaultHeight } from '../utils/geometry';
import { WALL_T, type Rect } from './layout';

export type Wall = 'n' | 's' | 'e' | 'w';
export const WALLS: Wall[] = ['n', 's', 'e', 'w'];
export const OPPOSITE: Record<Wall, Wall> = { n: 's', s: 'n', e: 'w', w: 'e' };
export const WALL_ROT: Record<Wall, number> = { n: 0, s: Math.PI, w: Math.PI / 2, e: -Math.PI / 2 };
export const INWARD: Record<Wall, [number, number]> = { n: [0, 1], s: [0, -1], w: [1, 0], e: [-1, 0] };

interface Box { x0: number; z0: number; x1: number; z1: number }

/** Size and mounting of any asset the furnisher places (house assets plus a few older ones). */
export function dims(type: AssetType): { w: number; d: number; h: number; mount: 'floor' | 'wall' | 'ceiling'; scalable: boolean } {
  if (isHouseAssetType(type)) {
    const s = HOUSE_ASSET_SPECS[type];
    return { w: s.size.x, d: s.size.z, h: s.size.y, mount: s.mount, scalable: Boolean(s.scalable) };
  }
  const fp = getAssetSize({ type, scale: { x: 1, y: 1, z: 1 } } as PlacedAsset);
  // The wall display is thin along its own X and wide along Z, and faces +X.
  if (type === 'lcd_display') return { w: fp.depth, d: fp.width, h: 0.82, mount: 'wall', scalable: false };
  return { w: fp.width, d: fp.depth, h: 0.8, mount: 'floor', scalable: false };
}

const MARGIN = WALL_T + 0.01;
const EPS = 0.005;

export interface PlaceOpts {
  color?: string;
  specs?: Record<string, string>;
  name?: string;
  /** Free floor (metres) required in front of the item. */
  clear?: number;
  scale?: { x: number; y: number; z: number };
  y?: number;
}

export interface Placed { asset: PlacedAsset; /** Distance along the wall from its start to the item centre. */ a: number }

export class RoomPlacer {
  readonly assets: PlacedAsset[] = [];
  private ground: Box[] = [];
  private wallItems: Array<Box & { wall: Wall }> = [];
  private zones: Box[] = [];
  private windows: Record<Wall, Array<[number, number]>> = { n: [], s: [], e: [], w: [] };
  private blocked: Record<Wall, Array<[number, number]>> = { n: [], s: [], e: [], w: [] };

  constructor(
    readonly rect: Rect,
    openings: Opening[],
    readonly levelId: string,
    readonly roomId: string,
    private readonly nextId: () => string,
    readonly exterior: Record<Wall, boolean>,
    readonly wallHeight: number
  ) {
    for (const o of openings) {
      const span: [number, number] = [o.offset - o.width / 2, o.offset + o.width / 2];
      if (o.kind === 'window') this.windows[o.wall].push(span);
      else {
        this.blocked[o.wall].push(span);
        this.zones.push(this.swingZone(o));
      }
    }
  }

  get ix0() { return this.rect.x0 + MARGIN; }
  get ix1() { return this.rect.x1 - MARGIN; }
  get iz0() { return this.rect.z0 + MARGIN; }
  get iz1() { return this.rect.z1 - MARGIN; }
  get width() { return this.ix1 - this.ix0; }
  get depth() { return this.iz1 - this.iz0; }
  get cx() { return (this.rect.x0 + this.rect.x1) / 2; }
  get cz() { return (this.rect.z0 + this.rect.z1) / 2; }

  wallLen(w: Wall) { return w === 'n' || w === 's' ? this.rect.x1 - this.rect.x0 : this.rect.z1 - this.rect.z0; }
  hasDoor(w: Wall) { return this.blocked[w].length > 0; }
  hasWindow(w: Wall) { return this.windows[w].length > 0; }
  windowSpans(w: Wall) { return this.windows[w]; }
  /** Longest unbroken stretch of wall, clear of doors and arches and their swing margins. */
  freeLength(w: Wall): number {
    const len = this.wallLen(w);
    const spans = this.blocked[w].map(([s, e]) => [s - 0.1, e + 0.1] as [number, number]).sort((a, b) => a[0] - b[0]);
    let best = 0, cursor = MARGIN;
    for (const [s, e] of spans) { best = Math.max(best, s - cursor); cursor = Math.max(cursor, e); }
    return Math.max(best, len - MARGIN - cursor);
  }
  /** Walls with at least a metre of clear length, longest clear stretch first. */
  solidWalls(): Wall[] {
    return WALLS.filter((w) => this.freeLength(w) >= 1.0).sort((a, b) => this.freeLength(b) - this.freeLength(a));
  }

  private swingZone(o: Opening): Box {
    const r = this.rect;
    const depth = o.kind === 'arch' ? 0.3 : 0.95;
    const lo = o.offset - o.width / 2 - 0.1, hi = o.offset + o.width / 2 + 0.1;
    switch (o.wall) {
      case 'n': return { x0: r.x0 + lo, x1: r.x0 + hi, z0: r.z0, z1: r.z0 + depth };
      case 's': return { x0: r.x0 + lo, x1: r.x0 + hi, z0: r.z1 - depth, z1: r.z1 };
      case 'w': return { z0: r.z0 + lo, z1: r.z0 + hi, x0: r.x0, x1: r.x0 + depth };
      default: return { z0: r.z0 + lo, z1: r.z0 + hi, x0: r.x1 - depth, x1: r.x1 };
    }
  }

  private box(cx: number, cz: number, w: number, d: number, rot: number): Box {
    const swap = Math.abs(Math.sin(rot)) > 0.5;
    const hx = (swap ? d : w) / 2, hz = (swap ? w : d) / 2;
    return { x0: cx - hx, x1: cx + hx, z0: cz - hz, z1: cz + hz };
  }

  private inside(b: Box) {
    return b.x0 >= this.ix0 - 1e-6 && b.x1 <= this.ix1 + 1e-6 && b.z0 >= this.iz0 - 1e-6 && b.z1 <= this.iz1 + 1e-6;
  }
  private static overlap(a: Box, b: Box) {
    return Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > EPS && Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) > EPS;
  }

  /** Is this floor box free of furniture and door swings and inside the room? */
  isFree(b: Box, ignoreZones = false) {
    return this.inside(b) && !this.ground.some((g) => RoomPlacer.overlap(g, b)) && (ignoreZones || !this.zones.some((z) => RoomPlacer.overlap(z, b)));
  }

  /** Is this box free of furniture only (used for the clear space in front of items)? */
  private clearOf(b: Box) {
    return this.inside(b) && !this.ground.some((g) => RoomPlacer.overlap(g, b));
  }

  private windowsCover(wall: Wall, a0: number, a1: number) {
    return this.windows[wall].some(([s, e]) => a1 > s + 0.05 && a0 < e - 0.05);
  }

  private make(type: AssetType, x: number, y: number, z: number, rot: number, o: PlaceOpts): PlacedAsset {
    const spec = isHouseAssetType(type) ? HOUSE_ASSET_SPECS[type] : undefined;
    const asset: PlacedAsset = {
      id: this.nextId(), type, category: isInfrastructureType(type) ? 'infrastructure' : 'furniture', name: o.name ?? spec?.label ?? type.replace(/_/g, ' '),
      position: { x, y, z }, rotationY: rot, scale: o.scale ?? { x: 1, y: 1, z: 1 },
      color: o.color ?? spec?.color, specs: o.specs, assignedRoomId: this.roomId, levelId: this.levelId,
    };
    this.assets.push(asset);
    return asset;
  }

  /** Put a floor item at a position, if it fits. */
  placeAt(type: AssetType, cx: number, cz: number, rot: number, o: PlaceOpts = {}): PlacedAsset | null {
    const spec = dims(type);
    let w = o.scale && spec.scalable ? o.scale.x : spec.w;
    let d = o.scale && spec.scalable ? o.scale.z : spec.d;
    if (spec.mount !== 'floor') return null;
    if (type === 'rug') {
      // A rug shrinks to fit the room; it may lie under furniture but not run up the walls.
      const swap = Math.abs(Math.sin(rot)) > 0.5;
      const maxX = 2 * Math.min(cx - this.ix0, this.ix1 - cx), maxZ = 2 * Math.min(cz - this.iz0, this.iz1 - cz);
      const wMax = swap ? maxZ : maxX, dMax = swap ? maxX : maxZ;
      w = Math.min(w, wMax); d = Math.min(d, dMax);
      if (w < 1.0 || d < 1.0) return null;
      o = { ...o, scale: { x: w, y: 1, z: d } };
    }
    const b = this.box(cx, cz, w, d, rot);
    if (type !== 'rug') {
      if (!this.isFree(b)) return null;
      this.ground.push(b);
    }
    return this.make(type, cx, o.y ?? 0, cz, rot, o);
  }

  /** Register an asset that is already in the room so later placements respect it. */
  adopt(a: PlacedAsset) {
    const spec = dims(a.type);
    if (!this.assets.includes(a)) this.assets.push(a);
    if (spec.mount === 'floor' && a.type !== 'rug') {
      this.ground.push(this.box(a.position.x, a.position.z, spec.w, spec.d, a.rotationY));
    } else if (spec.mount === 'wall') {
      const turn = a.type === 'lcd_display' ? Math.PI / 2 : 0;
      const wall = WALLS.find((w) => Math.abs(Math.sin(WALL_ROT[w] - (a.rotationY + turn))) < 0.01 && Math.abs(Math.cos(WALL_ROT[w] - (a.rotationY + turn)) - 1) < 0.01);
      if (wall) this.wallItems.push({ ...(a.type === 'lcd_display' ? this.box(a.position.x, a.position.z, spec.d, spec.w, a.rotationY) : this.box(a.position.x, a.position.z, spec.w, spec.d, a.rotationY)), wall });
    }
  }

  /** Reserve floor space without placing anything (keeps paths clear). */
  reserve(b: Box) { this.ground.push(b); }

  /** Floor item with its back to a wall. `align` picks where along the wall it goes. */
  placeOnWall(type: AssetType, wall: Wall, align: 'center' | 'start' | 'end' | { at: number }, o: PlaceOpts = {}): Placed | null {
    const spec = dims(type);
    const w = spec.w, d = spec.d, len = this.wallLen(wall);
    const lo = MARGIN + w / 2, hi = len - MARGIN - w / 2;
    if (hi < lo - 1e-6) return null;
    const cands: number[] = [];
    for (let a = lo; a <= hi + 1e-6; a += 0.05) cands.push(Math.min(a, hi));
    const key = (a: number) =>
      align === 'center' ? Math.abs(a - len / 2) : align === 'start' ? a : align === 'end' ? -a : Math.abs(a - align.at);
    cands.sort((p, q) => key(p) - key(q));
    const [ix, iz] = INWARD[wall];
    for (const a of cands) {
      const centre = wall === 'n' || wall === 's'
        ? { x: this.rect.x0 + a, z: wall === 'n' ? this.rect.z0 + MARGIN + d / 2 : this.rect.z1 - MARGIN - d / 2 }
        : { z: this.rect.z0 + a, x: wall === 'w' ? this.rect.x0 + MARGIN + d / 2 : this.rect.x1 - MARGIN - d / 2 };
      const rot = WALL_ROT[wall];
      const b = this.box(centre.x, centre.z, w, d, rot);
      if (!this.isFree(b)) continue;
      if (spec.h > 0.9 && this.windowsCover(wall, a - w / 2, a + w / 2)) continue;
      if (o.clear) {
        const cl = this.box(centre.x + ix * (d / 2 + o.clear / 2), centre.z + iz * (d / 2 + o.clear / 2), w, o.clear, rot);
        if (!this.clearOf(cl)) continue;
      }
      this.ground.push(b);
      return { asset: this.make(type, centre.x, o.y ?? 0, centre.z, rot, o), a };
    }
    return null;
  }

  /** Floor item in a corner, back to the two walls. */
  placeInCorner(type: AssetType, corner: 'nw' | 'ne' | 'sw' | 'se', o: PlaceOpts = {}): PlacedAsset | null {
    const spec = dims(type);
    const w = spec.w, d = spec.d;
    const rotFor = { nw: 0, ne: -Math.PI / 2, sw: Math.PI / 2, se: Math.PI }[corner];
    const x = corner.endsWith('w') ? this.ix0 + w / 2 : this.ix1 - w / 2;
    const z = corner.startsWith('n') ? this.iz0 + d / 2 : this.iz1 - d / 2;
    return this.placeAt(type, x, z, rotFor, o);
  }

  /** Wall-mounted item centred at `a` along `wall`. Avoids doors, arches and (unless it is a curtain) windows. */
  placeWallItem(type: AssetType, wall: Wall, a: number, o: PlaceOpts = {}): PlacedAsset | null {
    const spec = dims(type);
    const w = spec.w, d = spec.d, len = this.wallLen(wall);
    const a0 = a - w / 2, a1 = a + w / 2;
    if (a0 < MARGIN || a1 > len - MARGIN) return null;
    const span = (s: Array<[number, number]>) => s.some(([p, q]) => a1 > p - 0.02 && a0 < q + 0.02);
    if (span(this.blocked[wall])) return null;
    const isCurtain = type === 'curtain';
    if (!isCurtain && span(this.windows[wall])) return null;
    // The wall display faces +X rather than +Z, so it turns a further quarter.
    const rot = WALL_ROT[wall] - (type === 'lcd_display' ? Math.PI / 2 : 0);
    const centre = wall === 'n' || wall === 's'
      ? { x: this.rect.x0 + a, z: wall === 'n' ? this.rect.z0 + MARGIN + d / 2 - 0.005 : this.rect.z1 - MARGIN - d / 2 + 0.005 }
      : { z: this.rect.z0 + a, x: wall === 'w' ? this.rect.x0 + MARGIN + d / 2 - 0.005 : this.rect.x1 - MARGIN - d / 2 + 0.005 };
    const swapBox = type === 'lcd_display' ? this.box(centre.x, centre.z, d, w, rot) : this.box(centre.x, centre.z, w, d, rot);
    const b = { ...swapBox, wall };
    if (this.wallItems.some((g) => g.wall === wall && RoomPlacer.overlap(g, b))) return null;
    this.wallItems.push(b);
    return this.make(type, centre.x, o.y ?? (isHouseAssetType(type) ? WALL_MOUNT_HEIGHT[type] : undefined) ?? getDefaultHeight(type), centre.z, rot, o);
  }

  /** Centre of a free spot: tries the room centre first, then spirals out. */
  findSpot(type: AssetType, rot: number, o: { near?: [number, number]; clear?: number } = {}): [number, number] | null {
    const spec = dims(type);
    const [nx, nz] = o.near ?? [this.cx, this.cz];
    for (let r = 0; r <= 3; r += 0.1) {
      for (let k = 0; k < (r === 0 ? 1 : 16); k++) {
        const ang = (k / 16) * Math.PI * 2;
        const x = nx + Math.cos(ang) * r, z = nz + Math.sin(ang) * r;
        const b = this.box(x, z, spec.w + (o.clear ?? 0), spec.d + (o.clear ?? 0), rot);
        if (this.isFree(b)) return [x, z];
      }
    }
    return null;
  }
}
