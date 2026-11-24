import { describe, it, expect } from 'vitest';
import { generatePlan, WALL_T, type Plan, type Rect } from '../../src/house/layout';
import { DEFAULT_BRIEF, type HouseBrief } from '../../src/house/types';

const briefs: HouseBrief[] = [];
for (const floors of [1, 2] as const) for (const bedrooms of [1, 2, 3, 4, 5, 6]) for (const bathrooms of [1, 2, 3, 5]) for (const study of [false, true]) for (const variation of [0, 1, 2]) {
  briefs.push({ ...DEFAULT_BRIEF, floors, bedrooms, bathrooms, study, variation });
}

const area = (r: Rect) => (r.x1 - r.x0) * (r.z1 - r.z0);

function reachable(plan: Plan, level: number): boolean {
  const ids = plan.rects.filter((r) => r.level === level).map((r) => r.id);
  const start = level === 0 ? plan.rects.find((r) => r.kind === 'foyer')!.id : plan.rects.find((r) => r.kind === 'landing')!.id;
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const [a, b] of plan.links) {
      const next = a === cur ? b : b === cur ? a : null;
      if (next && !seen.has(next)) { seen.add(next); queue.push(next); }
    }
  }
  return ids.every((id) => seen.has(id));
}

describe('house floor plans', () => {
  const plans = briefs.map((b) => ({ b, plan: generatePlan(b, 't') }));

  it('finds a plan for every supported brief', () => {
    const missing = plans.filter((p) => !p.plan).map((p) => JSON.stringify({ f: p.b.floors, bed: p.b.bedrooms, bath: p.b.bathrooms, study: p.b.study, v: p.b.variation }));
    expect(missing).toEqual([]);
  });

  it('tiles each floor exactly: no gaps, no overlaps', () => {
    for (const { plan, b } of plans) {
      if (!plan) continue;
      for (let level = 0; level < plan.floors; level++) {
        const rs = plan.rects.filter((r) => r.level === level);
        const total = rs.reduce((a, r) => a + area(r), 0);
        expect(total, JSON.stringify(b)).toBeCloseTo(plan.width * plan.depth, 3);
        for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
          const a = rs[i], c = rs[j];
          const ox = Math.min(a.x1, c.x1) - Math.max(a.x0, c.x0);
          const oz = Math.min(a.z1, c.z1) - Math.max(a.z0, c.z0);
          expect(ox > 1e-6 && oz > 1e-6, `${a.kind} overlaps ${c.kind}`).toBe(false);
        }
      }
    }
  });

  it('has the requested rooms', () => {
    for (const { plan, b } of plans) {
      if (!plan) continue;
      const count = (k: string) => plan.rects.filter((r) => r.kind === k).length;
      const eff = plan.brief;
      expect(count('master_bedroom') + count('bedroom'), JSON.stringify(b)).toBe(eff.bedrooms);
      expect(count('living')).toBe(1);
      expect(count('kitchen')).toBe(1);
      expect(count('dining')).toBe(1);
      expect(count('foyer')).toBe(1);
      expect(count('study')).toBe(eff.study ? 1 : 0);
      const baths = count('bathroom') + count('ensuite') + count('powder');
      expect(baths, JSON.stringify(b)).toBe(eff.bathrooms);
    }
  });

  it('keeps every room at a usable size', () => {
    const min: Record<string, number> = { living: 3.4, bedroom: 2.7, master_bedroom: 3.0, kitchen: 2.7, dining: 2.6, bathroom: 1.6, ensuite: 1.6, powder: 1.2, study: 2.3 };
    for (const { plan, b } of plans) {
      if (!plan) continue;
      for (const r of plan.rects) {
        const short = Math.min(r.x1 - r.x0, r.z1 - r.z0);
        if (min[r.kind]) expect(short, `${r.kind} in ${JSON.stringify(b)}`).toBeGreaterThanOrEqual(min[r.kind] - 1e-6);
      }
    }
  });

  it('reaches every room from the entrance, and wet rooms are never walked through', () => {
    for (const { plan, b } of plans) {
      if (!plan) continue;
      for (let level = 0; level < plan.floors; level++) expect(reachable(plan, level), `level ${level} of ${JSON.stringify(b)}`).toBe(true);
      const wet = new Set(plan.rects.filter((r) => ['bathroom', 'ensuite', 'powder'].includes(r.kind)).map((r) => r.id));
      for (const id of wet) {
        const degree = plan.links.filter(([a, c]) => a === id || c === id).length;
        expect(degree, `a wet room has ${degree} doors in ${JSON.stringify(b)}`).toBe(1);
      }
    }
  });

  it('opens the ensuite onto the master bedroom when they touch', () => {
    for (const { plan } of plans) {
      if (!plan) continue;
      const ens = plan.rects.find((r) => r.kind === 'ensuite');
      const master = plan.rects.find((r) => r.kind === 'master_bedroom');
      if (!ens || !master) continue;
      const linked = plan.links.some(([a, c]) => (a === ens.id && c === master.id) || (c === ens.id && a === master.id));
      expect(linked).toBe(true);
    }
  });

  it('keeps openings inside their walls and gives the foyer a front door', () => {
    for (const { plan, b } of plans) {
      if (!plan) continue;
      for (const r of plan.rects) {
        for (const o of plan.openings[r.id] ?? []) {
          const len = o.wall === 'n' || o.wall === 's' ? r.x1 - r.x0 : r.z1 - r.z0;
          expect(o.offset - o.width / 2, `${r.kind} ${o.kind}`).toBeGreaterThanOrEqual(-1e-6);
          expect(o.offset + o.width / 2, `${r.kind} ${o.kind} in ${JSON.stringify(b)}`).toBeLessThanOrEqual(len + 1e-6);
        }
        // no two openings on the same wall overlap
        const byWall = (plan.openings[r.id] ?? []).reduce<Record<string, typeof plan.openings[string]>>((m, o) => ((m[o.wall] ||= []).push(o), m), {});
        for (const list of Object.values(byWall)) for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
          expect(Math.abs(list[i].offset - list[j].offset), `${r.kind} openings overlap`).toBeGreaterThanOrEqual((list[i].width + list[j].width) / 2 - 1e-6);
        }
      }
      const foyer = plan.rects.find((r) => r.kind === 'foyer')!;
      expect(plan.openings[foyer.id].some((o) => o.kind === 'front_door' && o.wall === 's')).toBe(true);
    }
  });

  it('puts windows on every habitable room that has an outside wall', () => {
    for (const { plan } of plans) {
      if (!plan) continue;
      for (const r of plan.rects.filter((x) => ['living', 'kitchen', 'master_bedroom', 'bedroom'].includes(x.kind))) {
        const exterior = Math.abs(r.z0 + plan.depth / 2) < 0.02 || Math.abs(r.z1 - plan.depth / 2) < 0.02 || Math.abs(r.x0 + plan.width / 2) < 0.02 || Math.abs(r.x1 - plan.width / 2) < 0.02;
        if (exterior) expect((plan.openings[r.id] ?? []).some((o) => o.kind === 'window'), `${r.kind} has no window`).toBe(true);
      }
    }
  });

  it('is deterministic and offers distinct layouts per variation', () => {
    const a = generatePlan({ ...DEFAULT_BRIEF, variation: 0 }, 'x')!;
    const b = generatePlan({ ...DEFAULT_BRIEF, variation: 0 }, 'x')!;
    expect(a).toEqual(b);
    const sizes = new Set([0, 1, 2, 3].map((v) => { const p = generatePlan({ ...DEFAULT_BRIEF, variation: v }, 'x')!; return `${p.width.toFixed(1)}x${p.depth.toFixed(1)}`; }));
    expect(sizes.size).toBeGreaterThan(1);
  });

  it('respects a requested floor area within 25%', () => {
    for (const areaSqm of [130, 170, 240]) {
      const p = generatePlan({ ...DEFAULT_BRIEF, areaSqm }, 'a');
      if (!p) throw new Error('no plan');
      const total = p.width * p.depth * p.floors;
      expect(Math.abs(total - areaSqm) / areaSqm, `asked ${areaSqm}, got ${total.toFixed(0)}`).toBeLessThan(0.25);
    }
  });

  it('explains when it cannot build the asked-for area, and relaxes extras instead of failing', () => {
    const tiny = generatePlan({ ...DEFAULT_BRIEF, areaSqm: 60 }, 'a')!;
    expect(tiny.notes.some((n) => /instead of 60/.test(n))).toBe(true);
    const huge = generatePlan({ ...DEFAULT_BRIEF, floors: 1, bedrooms: 6, bathrooms: 5, study: true }, 'a')!;
    expect(huge).toBeTruthy();
    expect(huge.notes.length).toBeGreaterThan(0);
    expect(generatePlan({ ...DEFAULT_BRIEF, floors: 1, bedrooms: 1, bathrooms: 1, study: true, laundry: true }, 'a')).toBeTruthy();
  });

  it('wall thickness leaves usable rooms', () => {
    expect(WALL_T).toBeLessThan(0.2);
  });
});
