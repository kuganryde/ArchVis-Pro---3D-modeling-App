/**
 * Generates a complete house design from a brief: floor plan, rooms with their
 * finishes, furniture, decor and lighting, plus a finish schedule and cost summary.
 * Pure and deterministic: the same brief always gives the same house.
 */
import type { Level, PlacedAsset, RoomDefinition, RoomKind } from '../types';
import { ALL_FINISHES, getFinish } from './finishes';
import { DESIGN_STYLES, getStyle, pick, zoneOf, type DesignStyle } from './styles';
import { generatePlan, WALL_T, type Plan, type Rect } from './layout';
import { furnishPlan, KELVIN, CEILING_HEIGHT, lightRoom, type FurnishCtx } from './furnish';
import { RoomPlacer, type Wall } from './placer';
import { ASSET_COSTS } from './costs';
import type { GeneratedHouse, HouseBrief, HouseDesign, HouseMeta, ScheduleRow } from './types';
import { DEFAULT_BRIEF } from './types';

export const FLOOR_TO_FLOOR = 3.0;
const SQFT = 10.7639;

const ROOM_NAME: Record<RoomKind, string> = {
  living: 'Living Room', dining: 'Dining Room', kitchen: 'Kitchen', foyer: 'Entrance Hall', hall: 'Hallway',
  landing: 'Stair Landing', master_bedroom: 'Master Bedroom', bedroom: 'Bedroom', ensuite: 'Ensuite',
  bathroom: 'Bathroom', powder: 'Powder Room', study: 'Study', laundry: 'Laundry', store: 'Store',
};

/** Where a room's finishes come from: the brief's preferences first, then the style. */
function finishesFor(kind: RoomKind, style: DesignStyle, brief: HouseBrief) {
  const zone = zoneOf(kind);
  const v = brief.variation;
  const wet = zone === 'wet';
  const prefs = brief.prefs ?? {};
  const floor = (wet ? prefs.wetFloor : undefined) ?? (!wet ? prefs.floor : undefined) ?? pick(style.floors[zone], v);
  const wall = (wet ? prefs.wetWall : undefined) ?? (!wet ? prefs.wall : undefined) ?? pick(style.walls[zone], v);
  return { floor, wall };
}

/** Accent finish for a room, or undefined when this style keeps the room plain. */
function accentFor(kind: RoomKind, style: DesignStyle, brief: HouseBrief): string | undefined {
  if (!style.accentRooms.includes(kind)) return undefined;
  return brief.prefs?.accent ?? pick(style.accents, brief.variation + (kind === 'master_bedroom' ? 1 : 0));
}

function makeIdFactory(uid: string) {
  let n = 0;
  return () => `${uid}_a${++n}`;
}

/** Number rooms of the same kind ("Bedroom 2") only when there is more than one. */
function roomNames(rects: Rect[]): Map<string, string> {
  const counts: Partial<Record<RoomKind, number>> = {};
  rects.forEach((r) => { counts[r.kind] = (counts[r.kind] ?? 0) + 1; });
  const seen: Partial<Record<RoomKind, number>> = {};
  const out = new Map<string, string>();
  for (const r of rects) {
    seen[r.kind] = (seen[r.kind] ?? 0) + 1;
    const base = ROOM_NAME[r.kind];
    const n = seen[r.kind]!;
    // The master is "Master Bedroom", so ordinary bedrooms start at 2.
    const label = counts[r.kind]! > 1 ? `${base} ${r.kind === 'bedroom' ? n + 1 : n}` : base;
    out.set(r.id, label);
  }
  return out;
}

const levelsFor = (plan: Plan, uid: string): Level[] => plan.floors === 2
  ? [
      { id: `${uid}_L0`, name: 'Ground Floor', elevation: 0, height: FLOOR_TO_FLOOR },
      { id: `${uid}_L1`, name: 'First Floor', elevation: FLOOR_TO_FLOOR, height: FLOOR_TO_FLOOR },
    ]
  : [{ id: `${uid}_L0`, name: 'House', elevation: 0, height: FLOOR_TO_FLOOR }];

/** Build rooms, assets and the schedule on an existing plan. */
function build(plan: Plan, brief: HouseBrief, uid: string, planNotes: string[], existingLevels?: Level[]): GeneratedHouse {
  const style = getStyle(brief.styleId);
  const levels = existingLevels ?? levelsFor(plan, uid);
  const nextId = makeIdFactory(uid);
  const kelvin = brief.lighting ? KELVIN[brief.lighting] : style.lighting.kelvin;
  const ctx: FurnishCtx = { plan, brief, style, levelIds: levels.map((l) => l.id), roomIds: new Map(), nextId, kelvin };
  const furnished = furnishPlan(ctx, plan.openings);
  const names = roomNames(plan.rects);

  const rooms: RoomDefinition[] = [];
  const assets: PlacedAsset[] = [];
  const schedule: ScheduleRow[] = [];
  let finishCost = 0;

  for (const f of furnished) {
    const r = f.rect;
    const { floor, wall } = finishesFor(r.kind, style, brief);
    const accentId = accentFor(r.kind, style, brief);
    const feature = f.featureWall;
    const w = r.x1 - r.x0, d = r.z1 - r.z0;
    const floorF = getFinish(floor)!, wallF = getFinish(wall)!;
    rooms.push({
      id: r.id, name: names.get(r.id)!, kind: r.kind, levelId: levels[r.level].id,
      x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2, width: w, depth: d,
      areaSqFt: Math.round(w * d * SQFT), color: floorF.colors[0], textColor: '#1f2937',
      floorFinishId: floor, wallFinishId: wall, wallHeight: CEILING_HEIGHT,
      featureWall: feature,
      accentWall: accentId && feature ? { wall: feature, finishId: accentId } : undefined,
      openings: plan.openings[r.id] ?? [],
    });
    assets.push(...f.assets);

    const perimeter = 2 * (w + d);
    const accentArea = accentId && feature ? ((feature === 'n' || feature === 's' ? w : d) * CEILING_HEIGHT) : 0;
    const wallArea = (perimeter * CEILING_HEIGHT - accentArea) * 0.85;
    finishCost += w * d * floorF.pricePerSqm + wallArea * wallF.pricePerSqm + accentArea * 0.85 * (getFinish(accentId)?.pricePerSqm ?? 0);
    schedule.push({
      roomId: r.id, room: names.get(r.id)!, kind: r.kind, levelName: levels[r.level].name, areaSqm: Math.round(w * d * 10) / 10,
      floor: { id: floor, name: floorF.name }, wall: { id: wall, name: wallF.name },
      accent: accentId ? { id: accentId, name: getFinish(accentId)!.name } : undefined,
    });
  }

  const furnishings = assets.reduce((a, x) => a + (ASSET_COSTS[x.type] ?? 0), 0);
  const total = Math.round(plan.width * plan.depth * plan.floors);
  const meta: HouseMeta = {
    styleId: style.id, styleName: style.name, variation: brief.variation,
    bedrooms: plan.brief.bedrooms, bathrooms: plan.brief.bathrooms, floors: plan.floors,
    width: plan.width, depth: plan.depth, totalAreaSqm: total,
    lighting: { kelvin, fixtures: style.lighting.fixtures },
    schedule,
    cost: { finishes: Math.round(finishCost), furnishings: Math.round(furnishings), total: Math.round(finishCost + furnishings) },
    lightCount: assets.filter((a) => ['ceiling_light', 'pendant_light', 'downlight', 'wall_sconce', 'floor_lamp'].includes(a.type)).length,
    notes: planNotes,
  };
  return { design: { levels, rooms, assets }, meta, brief: plan.brief };
}

/** Generate a house. `uid` keeps ids unique when a design is regenerated in the same session. */
export function generateHouse(input: Partial<HouseBrief>, uid = 'h'): GeneratedHouse | null {
  const brief: HouseBrief = { ...DEFAULT_BRIEF, ...input };
  if (!DESIGN_STYLES.some((s) => s.id === brief.styleId)) brief.styleId = DEFAULT_BRIEF.styleId;
  brief.floors = brief.floors === 2 ? 2 : 1;
  const plan = generatePlan(brief, uid);
  if (!plan) return null;
  return build(plan, { ...brief, ...plan.brief, styleId: brief.styleId, variation: brief.variation, prefs: brief.prefs, lighting: brief.lighting }, uid, plan.notes);
}

/** Several alternatives for one request: different layouts and finish alternates. */
export function generateVariations(input: Partial<HouseBrief>, count = 3, uid = 'h'): GeneratedHouse[] {
  const out: GeneratedHouse[] = [];
  for (let i = 0; i < count; i++) {
    const g = generateHouse({ ...input, variation: (input.variation ?? 0) + i }, `${uid}${i}`);
    if (g) out.push(g);
  }
  return out;
}

/** Rebuild a plan from an existing design's rooms, keeping every wall and opening where it is. */
function planFromDesign(design: HouseDesign, brief: HouseBrief): Plan | null {
  if (design.rooms.length === 0) return null;
  const levelIndex = new Map(design.levels.map((l, i) => [l.id, i]));
  const rects: Rect[] = design.rooms.map((r) => ({
    id: r.id, kind: r.kind ?? 'living', level: levelIndex.get(r.levelId ?? '') ?? 0,
    x0: r.x - r.width / 2, x1: r.x + r.width / 2, z0: r.z - r.depth / 2, z1: r.z + r.depth / 2,
  }));
  const minX = Math.min(...rects.map((r) => r.x0)), maxX = Math.max(...rects.map((r) => r.x1));
  const minZ = Math.min(...rects.map((r) => r.z0)), maxZ = Math.max(...rects.map((r) => r.z1));
  const openings: Plan['openings'] = {};
  design.rooms.forEach((r) => { openings[r.id] = r.openings ?? []; });
  const floors = Math.max(1, design.levels.length) >= 2 ? 2 : 1;
  // Stair position: on the ground floor, against the west wall of the foyer.
  const foyer = rects.find((r) => r.kind === 'foyer');
  const stair = floors === 2 && foyer ? { x: foyer.x0 + 0.77, z: foyer.z0 + 2.4 } : undefined;
  return { width: maxX - minX, depth: maxZ - minZ, floors, rects, openings, links: [], stair, brief, notes: [] };
}

/**
 * Re-style an existing house: same walls, doors and windows, new finishes,
 * furniture, decor and lighting. Furniture the user moved is replaced.
 */
export function restyleHouse(design: HouseDesign, input: Partial<HouseBrief>, uid = 'r'): GeneratedHouse | null {
  const brief: HouseBrief = { ...DEFAULT_BRIEF, ...input };
  const plan = planFromDesign(design, brief);
  if (!plan) return null;
  return build(plan, brief, uid, [], design.levels);
}

/** Swap only the lighting scheme of a house (fixture style and colour temperature). */
export function relightHouse(design: HouseDesign, fixtures: DesignStyle['lighting']['fixtures'], kelvin: number, uid = 'l'): HouseDesign {
  const plan = planFromDesign(design, DEFAULT_BRIEF);
  if (!plan) return design;
  let n = 0;
  const nextId = () => `${uid}_l${++n}`;
  const isLight = (t: string) => ['ceiling_light', 'pendant_light', 'downlight', 'wall_sconce'].includes(t);
  const keep = design.assets.filter((a) => !isLight(a.type));
  const lights: PlacedAsset[] = [];
  const style = { ...getStyle('modern'), lighting: { ...getStyle('modern').lighting, fixtures } };
  const ctx: FurnishCtx = { plan, brief: DEFAULT_BRIEF, style, levelIds: design.levels.map((l) => l.id), roomIds: new Map(), nextId, kelvin };
  for (const room of design.rooms) {
    const rect = plan.rects.find((r) => r.id === room.id)!;
    const none: Record<Wall, boolean> = { n: false, s: false, e: false, w: false };
    const placer = new RoomPlacer(rect, room.openings ?? [], room.levelId ?? design.levels[0].id, room.id, nextId, none, CEILING_HEIGHT);
    // Adopt the furniture already in the room so lights hang over the right pieces and avoid decor.
    const existing = keep.filter((a) => a.assignedRoomId === room.id);
    existing.forEach((a) => placer.adopt(a));
    lights.push(...lightRoom(placer, ctx, room.kind ?? 'living', fixtures));
  }
  return { ...design, assets: [...keep, ...lights] };
}

export { ALL_FINISHES, WALL_T };
