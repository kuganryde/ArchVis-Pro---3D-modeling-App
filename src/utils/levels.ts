/**
 * Multi-floor model: pure helpers over a `Design` (levels + rooms + assets).
 *
 * Designs saved before multi-floor existed have no levels and no `levelId` on
 * rooms/assets. `normalizeDesign` upgrades them losslessly into a single
 * "Level 1", so every loader (localStorage, cloud, JSON import) can call it and
 * nothing downstream has to handle the legacy shape.
 */
import { Level, PlacedAsset, RoomDefinition } from '../types';
import { makeId } from './geometry';

export interface Design {
  levels: Level[];
  rooms: RoomDefinition[];
  assets: PlacedAsset[];
}

// Floor-to-floor (metres). 3.6 leaves room for ceiling-mounted devices (mounted at
// 3.2 m) plus the slab above; the previous 3.0 put them inside the next floor.
export const DEFAULT_LEVEL_HEIGHT = 3.6;
export const MAX_LEVELS = 60;
export const MAX_LEVEL_NAME = 60;

export const makeLevel = (name: string, elevation: number, height = DEFAULT_LEVEL_HEIGHT): Level => ({
  id: makeId('level'),
  name: sanitizeLevelName(name) || 'Level',
  elevation,
  height,
});

/** Trim, collapse whitespace and cap length (names are rendered in the UI and exports). */
export function sanitizeLevelName(name: string): string {
  return String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_LEVEL_NAME);
}

/**
 * Guarantee at least one level and that every room/asset points at a level that
 * exists (missing or dangling `levelId` → the first level). Returns the SAME
 * object when nothing needs fixing so callers can cheaply skip re-renders.
 */
export function normalizeDesign(input: {
  levels?: Level[] | null;
  rooms: RoomDefinition[];
  assets: PlacedAsset[];
}): Design {
  const valid = (Array.isArray(input.levels) ? input.levels : []).filter(
    (l) => l && typeof l.id === 'string' && l.id.length > 0
  );
  const levels: Level[] = valid.length
    ? valid.map((l) => ({
        id: l.id,
        name: sanitizeLevelName(l.name) || 'Level',
        elevation: Number.isFinite(l.elevation) ? l.elevation : 0,
        height: Number.isFinite(l.height) && l.height > 0 ? l.height : DEFAULT_LEVEL_HEIGHT,
      }))
    : [{ id: makeId('level'), name: 'Level 1', elevation: 0, height: DEFAULT_LEVEL_HEIGHT }];

  const ids = new Set(levels.map((l) => l.id));
  const first = levels[0].id;
  const fix = <T extends { levelId?: string }>(item: T): T =>
    item.levelId && ids.has(item.levelId) ? item : { ...item, levelId: first };

  return {
    levels,
    rooms: input.rooms.map(fix),
    assets: input.assets.map(fix),
  };
}

/** Rooms and assets that live on one level. */
export function entitiesForLevel(design: Design, levelId: string) {
  return {
    rooms: design.rooms.filter((r) => r.levelId === levelId),
    assets: design.assets.filter((a) => a.levelId === levelId),
  };
}

/** `base`, or `base 2`, `base 3`… — the first variant no existing level already uses. */
export function uniqueLevelName(base: string, levels: Level[]): string {
  const taken = new Set(levels.map((l) => l.name.toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  for (let n = 2; n < 1000; n++) {
    const candidate = base.endsWith(')') ? `${base.slice(0, -1)} ${n})` : `${base} ${n}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return base;
}

/** "Level 2", "Level 3"… — next unused sequential name. */
export function nextLevelName(levels: Level[]): string {
  const taken = new Set(levels.map((l) => l.name.toLowerCase()));
  for (let n = levels.length + 1; n < levels.length + 1000; n++) {
    if (!taken.has(`level ${n}`)) return `Level ${n}`;
  }
  return `Level ${levels.length + 1}`;
}

/** Add an empty level above the current top one. No-op at MAX_LEVELS. */
export function addLevel(design: Design, name?: string): { design: Design; levelId: string | null } {
  if (design.levels.length >= MAX_LEVELS) return { design, levelId: null };
  const top = design.levels.reduce((a, b) => (b.elevation + b.height > a.elevation + a.height ? b : a));
  const level = makeLevel(name || nextLevelName(design.levels), top.elevation + top.height);
  return { design: { ...design, levels: [...design.levels, level] }, levelId: level.id };
}

export function renameLevel(design: Design, levelId: string, name: string): Design {
  const clean = sanitizeLevelName(name);
  if (!clean) return design;
  return { ...design, levels: design.levels.map((l) => (l.id === levelId ? { ...l, name: clean } : l)) };
}

/**
 * Delete a level and everything on it. The last remaining level cannot be
 * deleted (a design always has ≥1). Returns the neighbouring level to select.
 */
export function deleteLevel(
  design: Design,
  levelId: string
): { design: Design; nextActiveId: string } | null {
  if (design.levels.length <= 1) return null;
  const idx = design.levels.findIndex((l) => l.id === levelId);
  if (idx === -1) return null;
  const levels = design.levels.filter((l) => l.id !== levelId);
  const nextActive = levels[Math.min(idx, levels.length - 1)];
  return {
    design: {
      levels,
      rooms: design.rooms.filter((r) => r.levelId !== levelId),
      assets: design.assets.filter((a) => a.levelId !== levelId),
    },
    nextActiveId: nextActive.id,
  };
}

/**
 * Copy a level (rooms + assets) onto a new level directly above the top one —
 * the "typical floor" workflow. New ids everywhere; `assignedRoomId` is remapped
 * so copied assets stay bound to the copied rooms, not the originals.
 */
export function duplicateLevel(
  design: Design,
  levelId: string
): { design: Design; levelId: string } | null {
  const src = design.levels.find((l) => l.id === levelId);
  if (!src || design.levels.length >= MAX_LEVELS) return null;
  const { design: withLevel, levelId: newId } = addLevel(design, uniqueLevelName(`${src.name} (copy)`, design.levels));
  if (!newId) return null;

  const roomIdMap = new Map<string, string>();
  const { rooms, assets } = entitiesForLevel(design, levelId);
  const newRooms = rooms.map((r) => {
    const id = makeId('room');
    roomIdMap.set(r.id, id);
    return { ...r, id, levelId: newId };
  });
  const newAssets = assets.map((a) => ({
    ...a,
    id: makeId(a.type),
    levelId: newId,
    position: { ...a.position },
    scale: { ...a.scale },
    specs: a.specs ? { ...a.specs } : a.specs,
    assignedRoomId: a.assignedRoomId ? roomIdMap.get(a.assignedRoomId) : undefined,
  }));
  return {
    design: { ...withLevel, rooms: [...withLevel.rooms, ...newRooms], assets: [...withLevel.assets, ...newAssets] },
    levelId: newId,
  };
}

/**
 * Replace everything on ONE level (used by AI digitize / rebuild so generating a
 * layout for Level 2 never wipes Level 1).
 */
export function replaceLevelContent(
  design: Design,
  levelId: string,
  rooms: RoomDefinition[],
  assets: PlacedAsset[]
): Design {
  return {
    levels: design.levels,
    rooms: [
      ...design.rooms.filter((r) => r.levelId !== levelId),
      ...rooms.map((r) => ({ ...r, levelId })),
    ],
    assets: [
      ...design.assets.filter((a) => a.levelId !== levelId),
      ...assets.map((a) => ({ ...a, levelId })),
    ],
  };
}

export interface LevelSummary {
  level: Level;
  roomCount: number;
  assetCount: number;
  areaSqFt: number;
}

/** Per-level rollup for the building summary. */
export function summarizeLevels(design: Design): LevelSummary[] {
  return design.levels.map((level) => {
    const { rooms, assets } = entitiesForLevel(design, level.id);
    return {
      level,
      roomCount: rooms.length,
      assetCount: assets.length,
      areaSqFt: Math.round(rooms.reduce((s, r) => s + r.width * r.depth * 10.7639, 0)),
    };
  });
}

// ---------------------------------------------------------------------------
// Stacked building view
// ---------------------------------------------------------------------------

/** One floor prepared for the stacked 3D view. */
export interface StackLevelData {
  id: string;
  name: string;
  /** Height of this floor's slab above ground in the stack (metres). */
  baseElevation: number;
  height: number;
  rooms: RoomDefinition[];
  assets: PlacedAsset[];
}

export interface StackView {
  levels: StackLevelData[];
  activeLevelId: string;
  /** Hide floors above the active one so you can look down into it. */
  cutAbove: boolean;
  /** Total stack height in metres (for camera framing). */
  totalHeight: number;
}

/**
 * Display elevation of each floor: floors sorted by their stored elevation, then
 * stacked by height with no gaps. Deleting a middle floor, or a hand-edited
 * elevation, therefore never leaves a hole in the building.
 */
export function computeStackElevations(levels: Level[]): Map<string, number> {
  const ordered = levels
    .map((level, index) => ({ level, index }))
    .sort((a, b) => a.level.elevation - b.level.elevation || a.index - b.index);
  const out = new Map<string, number>();
  let base = 0;
  for (const { level } of ordered) {
    out.set(level.id, base);
    base += level.height;
  }
  return out;
}

/** Everything the canvas needs to draw the whole building around the active floor. */
export function buildStackView(design: Design, activeLevelId: string, cutAbove: boolean): StackView {
  const elevations = computeStackElevations(design.levels);
  const levels = design.levels.map((level) => ({
    id: level.id,
    name: level.name,
    baseElevation: elevations.get(level.id) ?? 0,
    height: level.height,
    rooms: design.rooms.filter((r) => r.levelId === level.id),
    assets: design.assets.filter((a) => a.levelId === level.id),
  }));
  return {
    levels,
    activeLevelId,
    cutAbove,
    totalHeight: design.levels.reduce((sum, l) => sum + l.height, 0),
  };
}
