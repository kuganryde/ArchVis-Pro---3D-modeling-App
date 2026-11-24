/**
 * Floor-plan generator. Tiles a rectangular footprint with rooms, connects them with
 * doors and arches, and cuts windows into the outer walls. Pure geometry: no
 * furniture, finishes or randomness (variation just picks among valid candidates).
 *
 * Coordinates: metres, +X east, +Z south, the house centred on the origin.
 *
 * Single storey: three bands from south to north, all full width:
 *   public row (foyer, living, dining, kitchen, study, laundry)
 *   hall (a 1.2 m corridor)
 *   private row (bedrooms, bathrooms, master with ensuite)
 * Two storeys: a full-depth stair hall in the west, and beside it
 *   ground: living (south) and kitchen, dining, powder room, study, laundry (north)
 *   upper:  private rooms in one or two rows either side of a corridor.
 */
import type { Opening, RoomKind } from '../types';
import type { HouseBrief } from './types';

export interface Rect {
  id: string;
  kind: RoomKind;
  level: number;
  x0: number; z0: number; x1: number; z1: number;
}

export interface Plan {
  width: number;
  depth: number;
  floors: number;
  rects: Rect[];
  /** Openings keyed by room id. */
  openings: Record<string, Opening[]>;
  /** Pairs of room ids joined by a door or arch (for connectivity checks). */
  links: Array<[string, string]>;
  /** Stair position and facing on the ground floor, two-storey houses only. */
  stair?: { x: number; z: number };
  /** The brief actually built, after any relaxation. */
  brief: HouseBrief;
  /** Things the user should know: rooms dropped, area adjusted. */
  notes: string[];
}

export const WALL_T = 0.12;
const CORRIDOR = 1.2;
const STAIR_HALL = 3.0;
const FOYER_W = 2.8;

const AREA: Partial<Record<RoomKind, number>> = {
  foyer: 8, living: 24, dining: 12, kitchen: 12, master_bedroom: 16, ensuite: 6, bedroom: 11,
  bathroom: 5, study: 9, laundry: 5, powder: 3.5,
};

/** [shortest side, longest side] minimums in metres. */
const MIN: Partial<Record<RoomKind, [number, number]>> = {
  foyer: [2.2, 2.6], living: [3.4, 4.2], dining: [2.6, 3.0], kitchen: [2.7, 3.2],
  master_bedroom: [3.0, 3.6], bedroom: [2.7, 3.0], ensuite: [1.6, 2.2], bathroom: [1.6, 2.2],
  powder: [1.2, 1.6], study: [2.3, 2.6], laundry: [1.6, 2.0],
};
const NO_ASPECT_LIMIT: RoomKind[] = ['foyer', 'hall', 'landing'];
const MAX_ASPECT = 3.3;

interface Slot { kind: RoomKind; area: number }

/** Split a row into rooms by area weights, honouring minimum widths. Null if it cannot fit. */
function splitRow(slots: Slot[], width: number, depth: number): number[] | null {
  const minW = slots.map((s) => {
    const m = MIN[s.kind];
    if (!m) return 1;
    if (depth < m[0] - 1e-6) return Infinity;
    return depth >= m[1] ? m[0] : Math.max(m[0], m[1]);
  });
  if (minW.some((m) => !isFinite(m)) || minW.reduce((a, b) => a + b, 0) > width + 1e-6) return null;
  const fixed = new Array(slots.length).fill(false);
  let w = slots.map((s) => (width * s.area) / slots.reduce((a, b) => a + b.area, 0));
  for (let iter = 0; iter < 12; iter++) {
    let changed = false;
    w.forEach((v, i) => { if (!fixed[i] && v < minW[i]) { w[i] = minW[i]; fixed[i] = true; changed = true; } });
    const free = slots.map((_, i) => i).filter((i) => !fixed[i]);
    const left = width - w.reduce((a, v, i) => (fixed[i] ? a + v : a), 0);
    const weight = free.reduce((a, i) => a + slots[i].area, 0);
    free.forEach((i) => { w[i] = (left * slots[i].area) / weight; });
    if (!changed) break;
  }
  if (w.some((v, i) => v < minW[i] - 1e-6)) return null;
  return w;
}

function roomOk(kind: RoomKind, w: number, d: number): boolean {
  const m = MIN[kind];
  const short = Math.min(w, d), long = Math.max(w, d);
  if (m && (short < m[0] - 1e-6 || long < m[1] - 1e-6)) return false;
  if (!NO_ASPECT_LIMIT.includes(kind) && long / short > MAX_ASPECT) return false;
  return true;
}

interface Candidate { rects: Omit<Rect, 'id'>[]; width: number; depth: number; score: number; stair?: { x: number; z: number } }

/** Lay out a row of slots left to right between x0 and x1, from z0 to z1. */
function row(slots: Slot[], x0: number, x1: number, z0: number, z1: number, level: number): Omit<Rect, 'id'>[] | null {
  const widths = splitRow(slots, x1 - x0, z1 - z0);
  if (!widths) return null;
  const out: Omit<Rect, 'id'>[] = [];
  let x = x0;
  slots.forEach((s, i) => {
    if (!roomOk(s.kind, widths[i], z1 - z0)) { out.length = 0; x = NaN; return; }
    out.push({ kind: s.kind, level, x0: x, z0, x1: x + widths[i], z1 });
    x += widths[i];
  });
  return Number.isNaN(x) ? null : out;
}

function programSlots(b: HouseBrief) {
  const bedrooms = Math.max(1, Math.min(6, b.bedrooms));
  const baths = Math.max(1, Math.min(5, b.bathrooms));
  const ensuite = baths >= 2;
  const powder = b.floors === 2 && baths >= 3;
  const common = Math.max(1, baths - (ensuite ? 1 : 0) - (powder ? 1 : 0));
  const area = (kind: RoomKind) => AREA[kind] ?? 8;
  const privateRoomsOrdered: Slot[] = [];
  const beds: Slot[] = Array.from({ length: bedrooms - 1 }, () => ({ kind: 'bedroom' as RoomKind, area: area('bedroom') }));
  const bathSlots: Slot[] = Array.from({ length: common }, () => ({ kind: 'bathroom' as RoomKind, area: area('bathroom') }));
  // Bathrooms sit between bedrooms; master and ensuite finish the row.
  const half = Math.ceil(beds.length / 2);
  privateRoomsOrdered.push(...beds.slice(0, half), ...bathSlots, ...beds.slice(half), { kind: 'master_bedroom', area: area('master_bedroom') });
  if (ensuite) privateRoomsOrdered.push({ kind: 'ensuite', area: area('ensuite') });
  return { privateRoomsOrdered, ensuite, powder, bedrooms, baths, area };
}

const sum = (slots: Slot[], k = 1) => slots.reduce((a, s) => a + s.area * k, 0);
const K_VALUES = [0.9, 1, 1.1, 1.25, 1.4, 1.6];

function singleStorey(b: HouseBrief, target: number): Candidate[] {
  const { privateRoomsOrdered, area } = programSlots(b);
  const out: Candidate[] = [];
  for (const k of K_VALUES) {
    for (let W = 8; W <= 24; W += 0.5) {
      const pub: Slot[] = [{ kind: 'foyer', area: area('foyer') }, { kind: 'living', area: area('living') }, { kind: 'dining', area: area('dining') }, { kind: 'kitchen', area: area('kitchen') }];
      if (b.study) pub.push({ kind: 'study', area: area('study') });
      if (b.laundry) pub.push({ kind: 'laundry', area: area('laundry') });
      // Rows never get shallower than a usable room, even when the programme is small.
      const dP = Math.max(4.0, sum(pub, k) / W);
      const dV = Math.max(3.2, sum(privateRoomsOrdered, k) / W);
      if (dP > 7.4 || dV > 6.8) continue;
      const D = dP + CORRIDOR + dV;
      if (D > 30 || W > 34) continue;
      const zN = -D / 2, zS = D / 2, x0 = -W / 2, x1 = W / 2;
      const priv = row(privateRoomsOrdered, x0, x1, zN, zN + dV, 0);
      const pubRects = row(pub, x0, x1, zS - dP, zS, 0);
      if (!priv || !pubRects) continue;
      const hall = { kind: 'hall' as RoomKind, level: 0, x0, z0: zN + dV, x1, z1: zN + dV + CORRIDOR };
      const areaPerFloor = W * D;
      out.push({ rects: [...priv, hall, ...pubRects], width: W, depth: D, score: Math.abs(areaPerFloor - target) / target + 0.3 * Math.abs(W / D - 1.35) });
    }
  }
  return out;
}

function twoStorey(b: HouseBrief, target: number): Candidate[] {
  const { privateRoomsOrdered, powder, area } = programSlots(b);
  const out: Candidate[] = [];
  const master = privateRoomsOrdered.filter((s) => s.kind === 'master_bedroom' || s.kind === 'ensuite');
  const rest = privateRoomsOrdered.filter((s) => s.kind !== 'master_bedroom' && s.kind !== 'ensuite');
  for (const k of K_VALUES) {
    for (let Wb = 6; Wb <= 18; Wb += 0.5) {
      for (const nRows of [1, 2]) {
        // Upper floor private rows. With two rows the master (and ensuite) take the north row.
        let north: Slot[], south: Slot[];
        if (nRows === 1) { north = [...rest, ...master]; south = []; }
        else {
          north = [...master]; south = [];
          const half = sum(privateRoomsOrdered) / 2;
          rest.forEach((s) => { (sum(north) < half ? north : south).push(s); });
          if (south.length === 0) continue;
        }
        const dN = Math.max(3.2, sum(north, k) / Wb);
        const dS = south.length ? Math.max(3.2, sum(south, k) / Wb) : 0;
        if (dN > 6.8 || (south.length && dS > 6.8)) continue;
        const D = dN + CORRIDOR + dS;
        if (D < 5.6 || D > 20) continue;
        const W = STAIR_HALL + Wb;
        if (W > 34) continue;
        const zN = -D / 2, zS = D / 2, xa = -W / 2, xb = xa + STAIR_HALL, xe = W / 2;

        // Ground floor main block: living in the south, the rest in the north.
        const dLiving = Math.min(Math.max((k * area('living')) / Wb, 4.2), D - 3.2);
        const gN: Slot[] = [];
        if (powder) gN.push({ kind: 'powder', area: area('powder') });
        gN.push({ kind: 'dining', area: area('dining') }, { kind: 'kitchen', area: area('kitchen') });
        if (b.laundry) gN.push({ kind: 'laundry', area: area('laundry') });
        if (b.study) gN.push({ kind: 'study', area: area('study') });
        const liv = row([{ kind: 'living', area: 1 }], xb, xe, zS - dLiving, zS, 0);
        const gnRects = row(gN, xb, xe, zN, zS - dLiving, 0);
        const upN = row(north, xb, xe, zN, zN + dN, 1);
        const upS = south.length ? row(south, xb, xe, zS - dS, zS, 1) : [];
        if (!liv || !gnRects || !upN || !upS) continue;

        const rects: Omit<Rect, 'id'>[] = [
          { kind: 'foyer', level: 0, x0: xa, z0: zN, x1: xb, z1: zS },
          ...liv, ...gnRects,
          { kind: 'landing', level: 1, x0: xa, z0: zN, x1: xb, z1: zS },
          ...upN,
          { kind: 'hall', level: 1, x0: xb, z0: zN + dN, x1: xe, z1: zN + dN + CORRIDOR },
          ...upS,
        ];
        // For one row the corridor is the south edge; the corridor's own south side is exterior.
        const areaPerFloor = W * D;
        out.push({
          rects, width: W, depth: D,
          score: Math.abs(areaPerFloor - target) / target + 0.3 * Math.abs(W / D - 1.3),
          stair: { x: xa + 0.12 + 0.5 + 0.15, z: zN + 0.15 + 2.15 + 0.1 },
        });
      }
    }
  }
  return out;
}

/** Shared walls between two rects on the same level, as an overlap along one axis. */
function shared(a: Rect, b: Rect): { aWall: 'n' | 's' | 'e' | 'w'; bWall: 'n' | 's' | 'e' | 'w'; from: number; to: number } | null {
  if (a.level !== b.level) return null;
  const eps = 0.02;
  const ov = (p0: number, p1: number, q0: number, q1: number) => [Math.max(p0, q0), Math.min(p1, q1)] as const;
  if (Math.abs(a.x1 - b.x0) < eps) { const [f, t] = ov(a.z0, a.z1, b.z0, b.z1); if (t - f > 0.5) return { aWall: 'e', bWall: 'w', from: f, to: t }; }
  if (Math.abs(a.x0 - b.x1) < eps) { const [f, t] = ov(a.z0, a.z1, b.z0, b.z1); if (t - f > 0.5) return { aWall: 'w', bWall: 'e', from: f, to: t }; }
  if (Math.abs(a.z1 - b.z0) < eps) { const [f, t] = ov(a.x0, a.x1, b.x0, b.x1); if (t - f > 0.5) return { aWall: 's', bWall: 'n', from: f, to: t }; }
  if (Math.abs(a.z0 - b.z1) < eps) { const [f, t] = ov(a.x0, a.x1, b.x0, b.x1); if (t - f > 0.5) return { aWall: 'n', bWall: 's', from: f, to: t }; }
  return null;
}

const HUBS: RoomKind[] = ['foyer', 'hall', 'landing', 'living', 'dining', 'kitchen'];
const OPEN_PAIRS: Array<[RoomKind, RoomKind]> = [['foyer', 'living'], ['living', 'dining'], ['dining', 'kitchen'], ['living', 'kitchen'], ['foyer', 'dining']];
/** Hubs a leaf room prefers to open onto, best first. */
const PARENT_PREF: Partial<Record<RoomKind, RoomKind[]>> = {
  bedroom: ['hall', 'landing', 'foyer'], master_bedroom: ['hall', 'landing', 'foyer'],
  bathroom: ['hall', 'landing', 'foyer'], ensuite: ['master_bedroom', 'hall', 'landing'],
  powder: ['foyer', 'hall', 'living'], study: ['foyer', 'living', 'hall', 'dining'],
  laundry: ['kitchen', 'hall', 'foyer'], store: ['foyer', 'kitchen', 'hall'],
};

const offsetFor = (r: Rect, wall: 'n' | 's' | 'e' | 'w', centre: number) =>
  wall === 'n' || wall === 's' ? centre - r.x0 : centre - r.z0;

/** Connect rooms with doors and arches so every room can be reached from the foyer. */
function connect(rects: Rect[], openings: Record<string, Opening[]>, links: Array<[string, string]>) {
  const parent = new Map<string, string>(rects.map((r) => [r.id, r.id]));
  const find = (x: string): string => (parent.get(x) === x ? x : (parent.set(x, find(parent.get(x)!)), parent.get(x)!));
  const addLink = (a: Rect, b: Rect, kind: 'door' | 'arch') => {
    const s = shared(a, b);
    if (!s) return false;
    const len = s.to - s.from;
    const width = kind === 'arch' ? Math.min(1.9, Math.max(1.0, len - 0.8)) : Math.min(0.9, len - 0.3);
    // Long shared walls get the opening near one end, which leaves a continuous stretch of wall
    // for kitchen units, beds and wardrobes. Short walls get it in the middle.
    const roomy = len > width + 1.8;
    const nearStart = ((a.id.length + b.id.length + a.id.charCodeAt(a.id.length - 1) + b.id.charCodeAt(b.id.length - 1)) & 1) === 0;
    const centre = !roomy ? (s.from + s.to) / 2 : nearStart ? s.from + 0.55 + width / 2 : s.to - 0.55 - width / 2;
    (openings[a.id] ||= []).push({ wall: s.aWall, offset: offsetFor(a, s.aWall, centre), width, kind });
    (openings[b.id] ||= []).push({ wall: s.bWall, offset: offsetFor(b, s.bWall, centre), width, kind });
    links.push([a.id, b.id]);
    parent.set(find(a.id), find(b.id));
    return true;
  };

  for (const level of [0, 1]) {
    const onLevel = rects.filter((r) => r.level === level);
    const hubs = onLevel.filter((r) => HUBS.includes(r.kind));
    // Hub-to-hub links, open-plan pairs first.
    const edges: Array<{ a: Rect; b: Rect; w: number; kind: 'door' | 'arch' }> = [];
    for (let i = 0; i < hubs.length; i++) for (let j = i + 1; j < hubs.length; j++) {
      const a = hubs[i], b = hubs[j];
      if (!shared(a, b)) continue;
      const open = OPEN_PAIRS.some(([p, q]) => (a.kind === p && b.kind === q) || (a.kind === q && b.kind === p));
      edges.push({ a, b, kind: open ? 'arch' : 'door', w: open ? 0 : 1 });
    }
    edges.sort((x, y) => x.w - y.w);
    for (const e of edges) if (find(e.a.id) !== find(e.b.id)) addLink(e.a, e.b, e.kind);
    // Leaves attach to their preferred hub (the master for an ensuite).
    for (const r of onLevel) {
      if (HUBS.includes(r.kind)) continue;
      const prefs = PARENT_PREF[r.kind] ?? ['hall', 'foyer', 'living'];
      let done = false;
      for (const pk of prefs) {
        const cand = onLevel.find((o) => o.kind === pk && shared(r, o) && (pk !== 'master_bedroom' || true));
        if (cand && addLink(r, cand, 'door')) { done = true; break; }
      }
      if (!done) {
        // Fall back to any neighbouring hub, then any non-wet neighbour.
        const alt = onLevel.find((o) => HUBS.includes(o.kind) && shared(r, o))
          ?? onLevel.find((o) => !['bathroom', 'ensuite', 'powder'].includes(o.kind) && o !== r && shared(r, o));
        if (alt) addLink(r, alt, 'door');
      }
    }
  }
  // Staircase: the stair hall and landing are one space vertically, nothing to cut.
}

/** Cut windows into exterior walls, avoiding doors, arches and corners. */
function addWindows(r: Rect, plan: { width: number; depth: number }, openings: Record<string, Opening[]>) {
  const hw = plan.width / 2, hd = plan.depth / 2, eps = 0.02;
  const exterior: Array<'n' | 's' | 'e' | 'w'> = [];
  if (Math.abs(r.z0 + hd) < eps) exterior.push('n');
  if (Math.abs(r.z1 - hd) < eps) exterior.push('s');
  if (Math.abs(r.x0 + hw) < eps) exterior.push('w');
  if (Math.abs(r.x1 - hw) < eps) exterior.push('e');
  const wet = ['bathroom', 'ensuite', 'powder', 'laundry', 'store'].includes(r.kind);
  const list = (openings[r.id] ||= []);
  for (const wall of exterior) {
    const len = wall === 'n' || wall === 's' ? r.x1 - r.x0 : r.z1 - r.z0;
    const ww = wet ? 0.7 : r.kind === 'living' ? 1.8 : r.kind === 'hall' || r.kind === 'landing' || r.kind === 'foyer' ? 0.9 : 1.4;
    const count = wet ? 1 : Math.max(1, Math.floor(len / 3.0));
    if (['hall', 'landing', 'foyer'].includes(r.kind) && count > 1) continue;
    for (let i = 0; i < count; i++) {
      const centre = ((i + 0.5) * len) / count;
      const blocked = list.some((o) => o.wall === wall && Math.abs(o.offset - centre) < (o.width + ww) / 2 + 0.3);
      if (blocked || centre - ww / 2 < 0.35 || centre + ww / 2 > len - 0.35) continue;
      list.push({ wall, offset: centre, width: ww, kind: 'window' });
    }
  }
}

export interface LayoutOptions { variation: number; target?: number }

function buildPlan(b: HouseBrief, uid: string): Omit<Plan, 'brief' | 'notes'> | null {
  const programme = sum(programSlots(b).privateRoomsOrdered) + AREA.foyer! + AREA.living! + AREA.dining! + AREA.kitchen! + 10;
  const perFloor = (b.areaSqm ?? programme * 1.15) / b.floors;
  const candidates = (b.floors === 2 ? twoStorey(b, perFloor) : singleStorey(b, perFloor)).sort((x, y) => x.score - y.score);
  if (!candidates.length) return null;
  // Variation picks among distinct footprints, best first.
  const distinct: Candidate[] = [];
  for (const c of candidates) {
    if (!distinct.some((d) => Math.abs(d.width - c.width) < 0.9 && Math.abs(d.depth - c.depth) < 0.9)) distinct.push(c);
    if (distinct.length >= 4) break;
  }
  const chosen = distinct[((b.variation % distinct.length) + distinct.length) % distinct.length];

  let n = 0;
  const rects: Rect[] = chosen.rects.map((r) => ({ ...r, id: `${uid}_r${++n}` }));
  const openings: Record<string, Opening[]> = {};
  const links: Array<[string, string]> = [];
  connect(rects, openings, links);

  // Front door on the foyer's south wall (ground floor).
  const foyer = rects.find((r) => r.kind === 'foyer')!;
  (openings[foyer.id] ||= []).push({ wall: 's', offset: Math.min(foyer.x1 - foyer.x0 - 0.8, Math.max(0.8, (foyer.x1 - foyer.x0) / 2)), width: 1.0, kind: 'front_door' });

  rects.forEach((r) => addWindows(r, chosen, openings));
  return { width: chosen.width, depth: chosen.depth, floors: b.floors, rects, openings, links, stair: chosen.stair };
}

/**
 * Generate a plan. If the brief cannot be fitted (a very small area with every
 * extra, or six bedrooms on one floor), extras are dropped one at a time and the
 * notes say what changed. Returns null only if nothing at all fits.
 */
export function generatePlan(brief: HouseBrief, uid: string): Plan | null {
  let b: HouseBrief = {
    ...brief,
    bedrooms: Math.max(1, Math.min(6, Math.round(brief.bedrooms))),
    bathrooms: Math.max(1, Math.min(5, Math.round(brief.bathrooms))),
  };
  const notes: string[] = [];
  const attempts: Array<[string, (x: HouseBrief) => HouseBrief]> = [
    ['', (x) => x],
    ['Dropped the laundry to fit the plan.', (x) => ({ ...x, laundry: false })],
    ['Dropped the study to fit the plan.', (x) => ({ ...x, study: false })],
    ['Reduced the bathrooms to fit the plan.', (x) => ({ ...x, bathrooms: Math.max(1, Math.min(x.bathrooms, x.bedrooms)) })],
    ['Reduced the bedrooms to fit one floor.', (x) => ({ ...x, bedrooms: Math.min(x.bedrooms, 5), bathrooms: Math.min(x.bathrooms, 4) })],
  ];
  for (const [note, apply] of attempts) {
    b = apply(b);
    if (note) notes.push(note);
    const plan = buildPlan(b, uid);
    if (plan) {
      const total = plan.width * plan.depth * plan.floors;
      if (brief.areaSqm && Math.abs(total - brief.areaSqm) / brief.areaSqm > 0.15) {
        notes.push(`Built ${Math.round(total)} m² instead of ${Math.round(brief.areaSqm)} m²: that is the closest size at which every room stays usable.`);
      }
      return { ...plan, brief: b, notes };
    }
  }
  return null;
}
