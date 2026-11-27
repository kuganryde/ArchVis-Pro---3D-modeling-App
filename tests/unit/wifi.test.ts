import { describe, it, expect } from 'vitest';
import { planAccessPoints, nearestDistance, WIFI_GOOD_RANGE_M } from '../../src/utils/wifi';
import { generateHouse } from '../../src/house/generate';

const room = (id: string, x: number, z: number, w = 6, d = 6) => ({ id, x, z, width: w, depth: d });

describe('access point planning', () => {
  it('measures the nearest access point and handles none', () => {
    expect(nearestDistance({ x: 0, z: 0 }, [])).toBe(Infinity);
    expect(nearestDistance({ x: 0, z: 0 }, [{ x: 3, z: 4 }, { x: 10, z: 0 }])).toBe(5);
  });
  it('adds nothing when every room is already in range', () => {
    expect(planAccessPoints([room('a', 0, 0), room('b', 5, 0)], [{ x: 2, z: 0 }])).toEqual([]);
  });
  it('puts an access point at the centre of a room that is out of range', () => {
    const plan = planAccessPoints([room('a', 0, 0), room('b', 20, 0)], [{ x: 0, z: 0 }]);
    expect(plan).toEqual([{ x: 20, z: 0, roomId: 'b' }]);
  });
  it('starts from the biggest rooms so one access point serves its neighbours', () => {
    // A big room next to two small ones: one access point in the big room covers both.
    const rooms = [room('small1', -6, 0, 3, 3), room('big', 0, 0, 12, 10), room('small2', 6, 0, 3, 3)];
    const plan = planAccessPoints(rooms, []);
    expect(plan).toEqual([{ x: 0, z: 0, roomId: 'big' }]);
  });
  it('leaves every room within range after planning, and plans nothing twice', () => {
    const rooms = Array.from({ length: 12 }, (_, i) => room(`r${i}`, (i % 4) * 9, Math.floor(i / 4) * 9, 7, 7));
    const plan = planAccessPoints(rooms, []);
    const all = plan.map((p) => ({ x: p.x, z: p.z }));
    for (const r of rooms) expect(nearestDistance(r, all)).toBeLessThanOrEqual(WIFI_GOOD_RANGE_M);
    expect(planAccessPoints(rooms, all)).toEqual([]);
  });
  it('ignores closets, and works on a generated house', () => {
    expect(planAccessPoints([room('closet', 30, 30, 1.5, 2)], [])).toEqual([]);
    const house = generateHouse({ bedrooms: 4, bathrooms: 3, floors: 1 }, 'w')!;
    const level = house.design.rooms;
    const plan = planAccessPoints(level, []);
    expect(plan.length).toBeGreaterThan(0);
    expect(plan.length).toBeLessThan(level.length); // far fewer than one per room
  });
});
