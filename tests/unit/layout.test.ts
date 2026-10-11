import { describe, it, expect } from 'vitest';
import { mapApiLayout, mapApiRooms, mapApiAssets } from '../../src/utils/layout';

describe('AI payload normalisation', () => {
  it('returns empty arrays for garbage input instead of throwing', () => {
    expect(mapApiLayout(null)).toEqual({ rooms: [], assets: [] });
    expect(mapApiLayout({ rooms: 'x', assets: 5 })).toEqual({ rooms: [], assets: [] });
  });
  it('fills defaults and computes area for sparse rooms', () => {
    const [r] = mapApiRooms([{ width: 10, depth: 5 }]);
    expect(r.name).toBe('Room 1');
    expect(r.areaSqFt).toBe(Math.round(50 * 10.7639));
  });
  it('coerces non-numeric / NaN coordinates to safe numbers', () => {
    const [r] = mapApiRooms([{ x: 'abc', z: Infinity, width: 'w', depth: null }]);
    expect(Number.isFinite(r.x) && Number.isFinite(r.z)).toBe(true);
    expect(r.width).toBe(4);
  });
  it('binds assets to the room that contains them and categorises by type', () => {
    const rooms = mapApiRooms([{ name: 'A', x: 0, z: 0, width: 10, depth: 10 }]);
    const [ap, desk] = mapApiAssets([{ type: 'ap', x: 1, z: 1 }, { type: 'desk_single', x: 50, z: 50 }], rooms);
    expect(ap.category).toBe('infrastructure');
    expect(ap.assignedRoomId).toBe(rooms[0].id);
    expect(ap.position.y).toBe(3.2);
    expect(desk.category).toBe('furniture');
    expect(desk.assignedRoomId).toBeUndefined();
  });
});
