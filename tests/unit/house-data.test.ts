import { describe, it, expect } from 'vitest';
import { ALL_FINISHES, FLOOR_FINISHES, WALL_FINISHES, getFinish } from '../../src/house/finishes';
import { DESIGN_STYLES, getStyle, pick, zoneOf } from '../../src/house/styles';
import { HOUSE_ASSET_SPECS, HOUSE_ASSET_TYPES } from '../../src/house/assetSpecs';

describe('finishes', () => {
  it('has unique ids and sane values', () => {
    const ids = ALL_FINISHES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of ALL_FINISHES) {
      expect(f.colors.length, f.id).toBeGreaterThan(0);
      f.colors.forEach((c) => expect(c, f.id).toMatch(/^#[0-9a-f]{6}$/i));
      expect(f.tile[0], f.id).toBeGreaterThan(0.05);
      expect(f.tile[1], f.id).toBeGreaterThan(0.05);
      expect(f.pricePerSqm, f.id).toBeGreaterThan(0);
    }
  });
  it('keeps floors and walls on the right surface', () => {
    expect(FLOOR_FINISHES.every((f) => f.surface === 'floor')).toBe(true);
    expect(WALL_FINISHES.every((f) => f.surface === 'wall')).toBe(true);
  });
  it('offers wet-area tiles, wallpapers and timber', () => {
    expect(ALL_FINISHES.some((f) => f.kind === 'wallpaper')).toBe(true);
    expect(FLOOR_FINISHES.some((f) => f.kind === 'tile' && f.wet)).toBe(true);
    expect(FLOOR_FINISHES.some((f) => f.kind === 'wood')).toBe(true);
  });
});

describe('design styles', () => {
  it('only reference finishes that exist, on the right surface', () => {
    for (const s of DESIGN_STYLES) {
      for (const [zone, ids] of Object.entries(s.floors)) for (const id of ids) {
        expect(getFinish(id)?.surface, `${s.id}.floors.${zone}.${id}`).toBe('floor');
      }
      for (const [zone, ids] of Object.entries(s.walls)) for (const id of ids) {
        expect(getFinish(id)?.surface, `${s.id}.walls.${zone}.${id}`).toBe('wall');
      }
      for (const id of s.accents) expect(getFinish(id)?.surface, `${s.id}.accents.${id}`).toBe('wall');
    }
  });
  it('puts only wet-safe finishes in wet rooms', () => {
    for (const s of DESIGN_STYLES) {
      for (const id of s.floors.wet) expect(getFinish(id)?.wet, `${s.id} wet floor ${id}`).toBe(true);
      for (const id of s.walls.wet) expect(getFinish(id)?.wet, `${s.id} wet wall ${id}`).toBe(true);
    }
  });
  it('has unique ids, valid swatches and warm-to-neutral lighting', () => {
    expect(new Set(DESIGN_STYLES.map((s) => s.id)).size).toBe(DESIGN_STYLES.length);
    for (const s of DESIGN_STYLES) {
      s.palette.swatches.forEach((c) => expect(c).toMatch(/^#[0-9a-f]{6}$/i));
      expect(s.lighting.kelvin).toBeGreaterThanOrEqual(2200);
      expect(s.lighting.kelvin).toBeLessThanOrEqual(5000);
    }
  });
  it('falls back to the first style and wraps variations', () => {
    expect(getStyle('nope').id).toBe(DESIGN_STYLES[0].id);
    expect(pick(['a', 'b', 'c'], 4)).toBe('b');
    expect(pick(['a', 'b', 'c'], -1)).toBe('c');
    expect(zoneOf('ensuite')).toBe('wet');
    expect(zoneOf('master_bedroom')).toBe('bedroom');
  });
});

describe('house asset specs', () => {
  it('covers every house type with real, positive sizes', () => {
    expect(HOUSE_ASSET_TYPES.length).toBeGreaterThan(30);
    for (const t of HOUSE_ASSET_TYPES) {
      const s = HOUSE_ASSET_SPECS[t];
      expect(s.size.x, t).toBeGreaterThan(0);
      expect(s.size.y, t).toBeGreaterThan(0);
      expect(s.size.z, t).toBeGreaterThan(0);
      expect(s.size.y, t).toBeLessThanOrEqual(3.01);
      expect(s.cost, t).toBeGreaterThan(0);
    }
  });
});
