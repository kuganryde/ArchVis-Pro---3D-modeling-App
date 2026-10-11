import { describe, it, expect } from 'vitest';
import {
  normalizeDesign, addLevel, deleteLevel, duplicateLevel, renameLevel, replaceLevelContent,
  entitiesForLevel, summarizeLevels, nextLevelName, sanitizeLevelName, MAX_LEVELS, Design,
  computeStackElevations, buildStackView, uniqueLevelName,
} from '../../src/utils/levels';
import type { PlacedAsset, RoomDefinition } from '../../src/types';

const room = (id: string, levelId?: string): RoomDefinition =>
  ({ id, name: id, areaSqFt: 0, color: '#fff', x: 0, z: 0, width: 10, depth: 10, levelId } as RoomDefinition);
const asset = (id: string, over: Partial<PlacedAsset> = {}): PlacedAsset =>
  ({ id, type: 'ap', category: 'infrastructure', name: id, position: { x: 0, y: 3, z: 0 }, rotationY: 0, scale: { x: 1, y: 1, z: 1 }, ...over } as PlacedAsset);

const twoLevel = (): Design => ({
  levels: [
    { id: 'L1', name: 'Level 1', elevation: 0, height: 3 },
    { id: 'L2', name: 'Level 2', elevation: 3, height: 3 },
  ],
  rooms: [room('r1', 'L1'), room('r2', 'L2')],
  assets: [asset('a1', { levelId: 'L1', assignedRoomId: 'r1' }), asset('a2', { levelId: 'L2', assignedRoomId: 'r2' })],
});

describe('normalizeDesign (legacy upgrade)', () => {
  it('turns a pre-multi-floor design into a single Level 1 owning everything', () => {
    const d = normalizeDesign({ rooms: [room('r1')], assets: [asset('a1')] });
    expect(d.levels).toHaveLength(1);
    expect(d.levels[0].name).toBe('Level 1');
    expect(d.levels[0].height).toBe(3.6);
    expect(d.rooms[0].levelId).toBe(d.levels[0].id);
    expect(d.assets[0].levelId).toBe(d.levels[0].id);
  });
  it('re-homes entities whose levelId no longer exists', () => {
    const d = normalizeDesign({ levels: twoLevel().levels, rooms: [room('r', 'GONE')], assets: [] });
    expect(d.rooms[0].levelId).toBe('L1');
  });
  it('repairs malformed levels (blank name, NaN elevation, bad height) and drops invalid ones', () => {
    const d = normalizeDesign({
      levels: [{ id: 'x', name: '   ', elevation: NaN, height: -4 }, null as any, { id: '', name: 'bad' } as any],
      rooms: [], assets: [],
    });
    expect(d.levels).toEqual([{ id: 'x', name: 'Level', elevation: 0, height: 3.6 }]);
  });
  it('is idempotent', () => {
    const once = normalizeDesign({ rooms: [room('r')], assets: [asset('a')] });
    expect(normalizeDesign(once)).toEqual(once);
  });
});

describe('level operations', () => {
  it('adds a level stacked above the current top', () => {
    const { design, levelId } = addLevel(twoLevel());
    const added = design.levels.find((l) => l.id === levelId)!;
    expect(added.elevation).toBe(6);
    expect(added.name).toBe('Level 3');
  });
  it('refuses to exceed MAX_LEVELS', () => {
    let d = twoLevel();
    while (d.levels.length < MAX_LEVELS) d = addLevel(d).design;
    expect(addLevel(d).levelId).toBeNull();
  });
  it('generates unique sequential names', () => {
    expect(nextLevelName([{ id: 'a', name: 'Level 2', elevation: 0, height: 3 }])).toBe('Level 3');
  });
  it('renames, trimming and rejecting blank names', () => {
    const d = twoLevel();
    expect(renameLevel(d, 'L1', '  Ground   Floor ').levels[0].name).toBe('Ground Floor');
    expect(renameLevel(d, 'L1', '   ')).toBe(d);
    expect(sanitizeLevelName('x'.repeat(200))).toHaveLength(60);
  });
  it('deletes a level with its contents and picks a neighbour to select', () => {
    const res = deleteLevel(twoLevel(), 'L1')!;
    expect(res.design.levels.map((l) => l.id)).toEqual(['L2']);
    expect(res.design.rooms.map((r) => r.id)).toEqual(['r2']);
    expect(res.design.assets.map((a) => a.id)).toEqual(['a2']);
    expect(res.nextActiveId).toBe('L2');
  });
  it('never deletes the last level or an unknown one', () => {
    const single = normalizeDesign({ rooms: [], assets: [] });
    expect(deleteLevel(single, single.levels[0].id)).toBeNull();
    expect(deleteLevel(twoLevel(), 'nope')).toBeNull();
  });
  it('duplicates a floor with fresh ids and remapped room bindings', () => {
    const src = twoLevel();
    const res = duplicateLevel(src, 'L1')!;
    const copy = entitiesForLevel(res.design, res.levelId);
    expect(copy.rooms).toHaveLength(1);
    expect(copy.assets).toHaveLength(1);
    expect(copy.rooms[0].id).not.toBe('r1');
    expect(copy.assets[0].id).not.toBe('a1');
    expect(copy.assets[0].assignedRoomId).toBe(copy.rooms[0].id); // bound to the COPY
    expect(res.design.levels.find((l) => l.id === res.levelId)!.name).toBe('Level 1 (copy)');
    // originals untouched
    expect(entitiesForLevel(res.design, 'L1').assets[0].id).toBe('a1');
  });
  it('duplicate does not alias mutable nested objects', () => {
    const src = twoLevel();
    src.assets[0].specs = { Cost: '$1' };
    const res = duplicateLevel(src, 'L1')!;
    const copy = entitiesForLevel(res.design, res.levelId).assets[0];
    expect(copy.position).not.toBe(src.assets[0].position);
    expect(copy.specs).not.toBe(src.assets[0].specs);
  });
  it('replaces one level without touching the others (AI generate on Level 2 keeps Level 1)', () => {
    const d = replaceLevelContent(twoLevel(), 'L2', [room('new')], [asset('n1'), asset('n2')]);
    expect(entitiesForLevel(d, 'L1').rooms.map((r) => r.id)).toEqual(['r1']);
    expect(entitiesForLevel(d, 'L2').rooms.map((r) => r.id)).toEqual(['new']);
    expect(entitiesForLevel(d, 'L2').assets).toHaveLength(2);
    expect(d.assets.find((a) => a.id === 'a2')).toBeUndefined();
  });
  it('summarises each level', () => {
    const s = summarizeLevels(twoLevel());
    expect(s.map((x) => [x.roomCount, x.assetCount])).toEqual([[1, 1], [1, 1]]);
    expect(s[0].areaSqFt).toBe(Math.round(100 * 10.7639));
  });
});

describe('stacked building view', () => {
  it('stacks floors by height with no gaps, ordered by stored elevation', () => {
    const levels = [
      { id: 'top', name: 'Top', elevation: 99, height: 4 },
      { id: 'g', name: 'Ground', elevation: 0, height: 3 },
      { id: 'mid', name: 'Mid', elevation: 50, height: 3.6 },
    ];
    const e = computeStackElevations(levels);
    expect(e.get('g')).toBe(0);
    expect(e.get('mid')).toBe(3);
    expect(e.get('top')).toBeCloseTo(6.6);
  });
  it('closes the hole left by deleting a middle floor', () => {
    const d = twoLevel();
    d.levels.push({ id: 'L3', name: 'Level 3', elevation: 6, height: 3 });
    const res = deleteLevel(d, 'L2')!;
    const e = computeStackElevations(res.design.levels);
    expect(e.get('L3')).toBe(3); // directly above L1, not floating at its old 6 m
  });
  it('is stable for equal elevations (keeps array order)', () => {
    const e = computeStackElevations([
      { id: 'a', name: 'A', elevation: 0, height: 3 },
      { id: 'b', name: 'B', elevation: 0, height: 3 },
    ]);
    expect(e.get('a')).toBe(0);
    expect(e.get('b')).toBe(3);
  });
  it('builds per-floor rooms/assets and the total height', () => {
    const v = buildStackView(twoLevel(), 'L2', true);
    expect(v.activeLevelId).toBe('L2');
    expect(v.cutAbove).toBe(true);
    expect(v.totalHeight).toBe(6);
    expect(v.levels.map((l) => [l.id, l.baseElevation, l.rooms.length, l.assets.length])).toEqual([
      ['L1', 0, 1, 1],
      ['L2', 3, 1, 1],
    ]);
  });
  it('new floors default to a height that clears ceiling-mounted devices (3.2 m)', () => {
    const d = normalizeDesign({ rooms: [], assets: [] });
    expect(d.levels[0].height).toBeGreaterThan(3.2);
  });
});

describe('unique floor names', () => {
  it('numbers repeated copies instead of colliding', () => {
    expect(uniqueLevelName('Level 1 (copy)', [])).toBe('Level 1 (copy)');
    const once = duplicateLevel(twoLevel(), 'L1')!.design;
    const twice = duplicateLevel(once, 'L1')!.design;
    const thrice = duplicateLevel(twice, 'L1')!.design;
    expect(thrice.levels.map((l) => l.name)).toEqual(['Level 1', 'Level 2', 'Level 1 (copy)', 'Level 1 (copy 2)', 'Level 1 (copy 3)']);
  });
  it('is case-insensitive', () => {
    expect(uniqueLevelName('roof', [{ id: 'a', name: 'ROOF', elevation: 0, height: 3 }])).toBe('roof 2');
  });
});
