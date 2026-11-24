import { describe, it, expect } from 'vitest';
import { parseBrief } from '../../src/house/parseBrief';
import { sanitizeAiBrief, mergeBriefs, buildHouseBriefInstructions, HOUSE_BRIEF_SCHEMA } from '../../src/shared/houseSpec';
import { generateHouse } from '../../src/house/generate';

describe('parseBrief', () => {
  it('reads rooms, floors, style and area', () => {
    const { brief } = parseBrief('A modern 3 bedroom, 2 bathroom double storey home of 180 sqm with a study');
    expect(brief).toMatchObject({ bedrooms: 3, bathrooms: 2, floors: 2, areaSqm: 180, styleId: 'modern', study: true });
  });
  it('understands words and units', () => {
    expect(parseBrief('four bedroom scandinavian house').brief).toMatchObject({ bedrooms: 4, styleId: 'scandinavian' });
    expect(parseBrief('2000 sq ft bungalow, three bed').brief).toMatchObject({ floors: 1, bedrooms: 3, areaSqm: 186 });
    expect(parseBrief('2BHK flat').brief.bedrooms).toBe(2);
    expect(parseBrief('studio apartment').brief.bedrooms).toBe(1);
    expect(parseBrief('a 3-storey townhouse').brief.floors).toBe(2);
  });
  it('picks the style from synonyms', () => {
    expect(parseBrief('art deco villa').brief.styleId).toBe('luxury');
    expect(parseBrief('cozy hygge cabin').brief.styleId).toBe('scandinavian');
    expect(parseBrief('industrial loft').brief.styleId).toBe('industrial');
    expect(parseBrief('mid-century family home').brief.styleId).toBe('mid_century');
    expect(parseBrief('beach house').brief.styleId).toBe('coastal');
    expect(parseBrief('just a house').brief.styleId).toBeUndefined();
  });
  it('picks finishes: floors, bathroom tiles, wallpaper and wall colours', () => {
    const { brief, understood } = parseBrief('walnut floors, marble bathrooms, floral wallpaper feature wall, sage walls, warm lighting');
    expect(brief.prefs).toMatchObject({ floor: 'walnut_plank', wetFloor: 'marble_white', wetWall: 'tile_marble_wall', accent: 'wp_floral_botanical', wall: 'paint_sage' });
    expect(brief.lighting).toBe('warm');
    expect(understood.join(' ')).toMatch(/Walnut/);
  });
  it('only treats a wallpaper word as a feature wall when wallpaper is asked for', () => {
    expect(parseBrief('a floral garden outside').brief.prefs?.accent).toBeUndefined();
    expect(parseBrief('striped wallpaper in the bedroom').brief.prefs?.accent).toBe('wp_stripe_navy');
  });
  it('clamps and ignores nonsense', () => {
    expect(parseBrief('99 bedroom palace').brief.bedrooms).toBe(6);
    expect(parseBrief('5 sqm').brief.areaSqm).toBeUndefined();
    expect(parseBrief('').brief.bedrooms).toBeUndefined();
  });
  it('drives the generator end to end', () => {
    const { brief } = parseBrief('Scandinavian 4 bedroom 3 bathroom two storey with a study, oak floors and blush floral wallpaper');
    const g = generateHouse(brief, 'e2e')!;
    expect(g.design.levels).toHaveLength(2);
    expect(g.meta.styleId).toBe('scandinavian');
    expect(g.design.rooms.filter((r) => r.kind === 'bedroom' || r.kind === 'master_bedroom')).toHaveLength(4);
    expect(g.design.rooms.find((r) => r.kind === 'living')!.floorFinishId).toBe('oak_plank');
  });
});

describe('AI brief sanitiser', () => {
  it('keeps valid fields and drops invalid ones', () => {
    const { brief, summary } = sanitizeAiBrief({ bedrooms: 4, bathrooms: 9, floors: 2, areaSqm: 10, styleId: 'japandi', lighting: 'warm', floorFinishId: 'oak_plank', wallFinishId: 'wp_stripe_navy', accentFinishId: 'wp_deco_fan', wetFloorFinishId: 'oak_plank', wetWallFinishId: 'tile_zellige_green', summary: '  A calm   home. ' });
    expect(brief).toMatchObject({ bedrooms: 4, floors: 2, styleId: 'japandi', lighting: 'warm' });
    expect(brief.bathrooms).toBeUndefined();
    expect(brief.areaSqm).toBeUndefined();
    expect(brief.prefs).toEqual({ floor: 'oak_plank', accent: 'wp_deco_fan', wetWall: 'tile_zellige_green' }); // wallpaper is not a paint; oak is not wet-safe
    expect(summary).toBe('A calm home.');
  });
  it('rejects unknown ids, wrong surfaces and non-objects', () => {
    expect(sanitizeAiBrief({ styleId: 'gothic', floorFinishId: 'nope', accentFinishId: 'oak_plank' }).brief).toEqual({});
    expect(sanitizeAiBrief(null).brief).toEqual({});
    expect(sanitizeAiBrief('text').brief).toEqual({});
  });
  it('merges, letting the AI win but keeping other preferences', () => {
    const merged = mergeBriefs({ bedrooms: 2, prefs: { floor: 'oak_plank', wall: 'paint_white' } }, { bedrooms: 3, prefs: { floor: 'concrete' } });
    expect(merged).toMatchObject({ bedrooms: 3, prefs: { floor: 'concrete', wall: 'paint_white' } });
  });
  it('builds a prompt that lists the valid ids and escapes quotes', () => {
    const p = buildHouseBriefInstructions('a "cozy" home');
    expect(p).toContain('wp_floral_botanical');
    expect(p).toContain('oak_plank');
    expect(p).toContain("a 'cozy' home");
    expect(HOUSE_BRIEF_SCHEMA.properties.styleId.description).toContain('boho');
  });
});
