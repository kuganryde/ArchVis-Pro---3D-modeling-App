import { describe, it, expect } from 'vitest';
import {
  getAssetSize, isOverlapping, isAssetOutsideRooms, findContainingRoom,
  getDefaultHeight, isInfrastructureType, getRoomWallStyle, getOccupancyColor, makeId,
} from '../../src/utils/geometry';
import type { PlacedAsset, RoomDefinition } from '../../src/types';

const asset = (over: Partial<PlacedAsset> & { type: PlacedAsset['type'] }): PlacedAsset => ({
  id: 'a', category: 'furniture', name: 'n', position: { x: 0, y: 0, z: 0 },
  rotationY: 0, scale: { x: 1, y: 1, z: 1 }, ...over,
} as PlacedAsset);
const room = (over: Partial<RoomDefinition> = {}): RoomDefinition => ({
  id: 'r1', name: 'Open Office', areaSqFt: 0, color: '#fff', x: 0, z: 0, width: 10, depth: 10, ...over,
} as RoomDefinition);

describe('geometry', () => {
  it('sizes assets, honouring custom scale only for scalable types', () => {
    expect(getAssetSize(asset({ type: 'desk_single' }))).toEqual({ width: 1.2, depth: 0.7 });
    expect(getAssetSize(asset({ type: 'conference_table', scale: { x: 3, y: 1, z: 2 } }))).toEqual({ width: 3, depth: 2 });
  });
  it('classifies infrastructure and mounting heights', () => {
    expect(isInfrastructureType('ap')).toBe(true);
    expect(isInfrastructureType('desk_single')).toBe(false);
    expect(getDefaultHeight('ap')).toBe(3.2);
    expect(getDefaultHeight('dp')).toBe(0.8);
    expect(getDefaultHeight('cabinet')).toBe(0.4);
  });
  it('detects overlap only on the same height layer', () => {
    const a = asset({ type: 'desk_single', position: { x: 0, y: 0, z: 0 } });
    const b = asset({ type: 'desk_single', position: { x: 0.1, y: 0, z: 0 } });
    const farAway = asset({ type: 'desk_single', position: { x: 5, y: 0, z: 0 } });
    const ceilingAp = asset({ type: 'ap', position: { x: 0, y: 3, z: 0 } });
    expect(isOverlapping(a, b)).toBe(true);
    expect(isOverlapping(a, farAway)).toBe(false);
    expect(isOverlapping(a, ceilingAp)).toBe(false);
  });
  it('flags assets outside every room, with a small tolerance', () => {
    const rooms = [room()];
    expect(isAssetOutsideRooms(asset({ type: 'desk_single', position: { x: 0, y: 0, z: 0 } }), rooms)).toBe(false);
    expect(isAssetOutsideRooms(asset({ type: 'desk_single', position: { x: 20, y: 0, z: 0 } }), rooms)).toBe(true);
    expect(isAssetOutsideRooms(asset({ type: 'desk_single', position: { x: 20, y: 0, z: 0 } }), [])).toBe(false);
  });
  it('finds the containing room', () => {
    const rooms = [room({ id: 'a', x: 0 }), room({ id: 'b', x: 20 })];
    expect(findContainingRoom(19, 0, rooms)?.id).toBe('b');
    expect(findContainingRoom(100, 0, rooms)).toBeUndefined();
  });
  it('derives wall style from name keywords unless explicit', () => {
    expect(getRoomWallStyle(room({ name: 'Server Room' }))).toBe('concrete');
    expect(getRoomWallStyle(room({ name: 'Open Office' }))).toBe('glass');
    expect(getRoomWallStyle(room({ name: 'Server Room', wallStyle: 'glass' }))).toBe('glass');
  });
  it('colours empty rooms green and crowded rooms red', () => {
    expect(getOccupancyColor(0, 5, 5)).toBe('#10b981');
    expect(getOccupancyColor(500, 5, 5)).toBe('rgb(239, 68, 68)');
  });
  it('makes unique prefixed ids', () => {
    const ids = new Set(Array.from({ length: 200 }, () => makeId('asset')));
    expect(ids.size).toBe(200);
    expect([...ids][0].startsWith('asset_')).toBe(true);
  });
});
