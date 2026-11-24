/**
 * Contract for the AI pass that turns a house request into a structured brief:
 * response schema, prompt and a sanitiser that never trusts the model's output.
 * Shared by the browser client and the server so both behave identically.
 */
import { DESIGN_STYLES } from '../house/styles';
import { ALL_FINISHES, getFinish } from '../house/finishes';
import type { HouseBrief } from '../house/types';

const Type = { OBJECT: 'OBJECT', STRING: 'STRING', NUMBER: 'NUMBER', BOOLEAN: 'BOOLEAN', INTEGER: 'INTEGER' } as const;

const STYLE_IDS = DESIGN_STYLES.map((s) => s.id);

export const HOUSE_BRIEF_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    bedrooms: { type: Type.INTEGER, description: 'Number of bedrooms, 1 to 6' },
    bathrooms: { type: Type.INTEGER, description: 'Number of bathrooms including ensuites and powder rooms, 1 to 5' },
    floors: { type: Type.INTEGER, description: '1 for single storey, 2 for two storeys' },
    areaSqm: { type: Type.NUMBER, description: 'Total floor area in square metres, if the user gave one' },
    styleId: { type: Type.STRING, description: `One of: ${STYLE_IDS.join(', ')}` },
    study: { type: Type.BOOLEAN },
    laundry: { type: Type.BOOLEAN },
    lighting: { type: Type.STRING, description: 'warm, neutral or cool' },
    floorFinishId: { type: Type.STRING, description: 'Floor finish id for living areas and bedrooms' },
    wallFinishId: { type: Type.STRING, description: 'Wall paint id for living areas and bedrooms' },
    accentFinishId: { type: Type.STRING, description: 'Wallpaper or panel id for feature walls' },
    wetFloorFinishId: { type: Type.STRING, description: 'Floor tile id for bathrooms' },
    wetWallFinishId: { type: Type.STRING, description: 'Wall tile id for bathrooms' },
    summary: { type: Type.STRING, description: 'One sentence describing the design you chose' },
  },
};

const ids = (surface: 'floor' | 'wall') => ALL_FINISHES.filter((f) => f.surface === surface).map((f) => `${f.id} (${f.name})`).join('; ');

export function buildHouseBriefInstructions(request: string): string {
  return `
You are an interior design assistant for a house planner. Read the client's request and
return the brief as JSON. Only fill fields the request implies; leave the rest out.

Client request: "${request.replace(/"/g, "'")}"

Rules:
- styleId must be one of: ${STYLE_IDS.join(', ')}.
- Floor finish ids: ${ids('floor')}.
- Wall finish ids (paints, wall tiles, wallpapers): ${ids('wall')}.
- Use a wallpaper id only for accentFinishId; use paints (paint_*) for wallFinishId;
  use tile ids (tile_*) or marble for the bathroom wall; use floor tile ids for the bathroom floor.
- Bathrooms must be wet-safe finishes (tiles, stone, concrete).
- bedrooms 1-6, bathrooms 1-5, floors 1 or 2. Do not invent an area the user did not give.
`;
}

/** The parts of a brief the AI can set, validated. Anything unknown or out of range is dropped. */
export function sanitizeAiBrief(raw: unknown): { brief: Partial<HouseBrief>; summary?: string } {
  const r = (raw ?? {}) as Record<string, unknown>;
  const brief: Partial<HouseBrief> = {};
  const int = (v: unknown, lo: number, hi: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n >= lo && n <= hi ? n : undefined;
  };
  const bedrooms = int(r.bedrooms, 1, 6); if (bedrooms) brief.bedrooms = bedrooms;
  const bathrooms = int(r.bathrooms, 1, 5); if (bathrooms) brief.bathrooms = bathrooms;
  const floors = int(r.floors, 1, 2); if (floors) brief.floors = floors as 1 | 2;
  const area = Number(r.areaSqm);
  if (Number.isFinite(area) && area >= 40 && area <= 900) brief.areaSqm = area;
  if (typeof r.styleId === 'string' && STYLE_IDS.includes(r.styleId)) brief.styleId = r.styleId;
  if (typeof r.study === 'boolean') brief.study = r.study;
  if (typeof r.laundry === 'boolean') brief.laundry = r.laundry;
  if (r.lighting === 'warm' || r.lighting === 'neutral' || r.lighting === 'cool') brief.lighting = r.lighting;

  const prefs: NonNullable<HouseBrief['prefs']> = {};
  const finish = (v: unknown, surface: 'floor' | 'wall', wet = false) => {
    if (typeof v !== 'string') return undefined;
    const f = getFinish(v);
    return f && f.surface === surface && (!wet || f.wet) ? f.id : undefined;
  };
  const pf = finish(r.floorFinishId, 'floor'); if (pf) prefs.floor = pf;
  const pw = finish(r.wallFinishId, 'wall'); if (pw && getFinish(pw)!.kind === 'paint') prefs.wall = pw;
  const pa = finish(r.accentFinishId, 'wall'); if (pa) prefs.accent = pa;
  const pwf = finish(r.wetFloorFinishId, 'floor', true); if (pwf) prefs.wetFloor = pwf;
  const pww = finish(r.wetWallFinishId, 'wall', true); if (pww) prefs.wetWall = pww;
  if (Object.keys(prefs).length) brief.prefs = prefs;

  const summary = typeof r.summary === 'string' ? r.summary.replace(/\s+/g, ' ').trim().slice(0, 300) : undefined;
  return { brief, summary: summary || undefined };
}

/** Merge two partial briefs; `over` wins, and preference maps merge key by key. */
export function mergeBriefs(base: Partial<HouseBrief>, over: Partial<HouseBrief>): Partial<HouseBrief> {
  return { ...base, ...over, prefs: { ...base.prefs, ...over.prefs } };
}
