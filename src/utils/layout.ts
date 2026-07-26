/**
 * Normalisation helpers that turn loosely-typed AI / imported payloads into
 * strongly-typed RoomDefinition and PlacedAsset objects. Shared by the
 * blueprint digitizer and the prompt-to-layout rebuilder so both paths produce
 * identical, well-formed state.
 */
import { PlacedAsset, RoomDefinition, AssetCategory } from '../types';
import {
  findContainingRoom,
  getDefaultHeight,
  isInfrastructureType,
  makeId,
} from './geometry';

const num = (value: unknown, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

/** Map an arbitrary AI/imported room array into RoomDefinition[]. */
export function mapApiRooms(rawRooms: unknown): RoomDefinition[] {
  if (!Array.isArray(rawRooms)) return [];
  return rawRooms.map((raw: any, index: number) => {
    const width = num(raw?.width, 4);
    const depth = num(raw?.depth, 4);
    return {
      id: makeId('room'),
      name: typeof raw?.name === 'string' && raw.name.trim() ? raw.name : `Room ${index + 1}`,
      x: num(raw?.x),
      z: num(raw?.z),
      width,
      depth,
      areaSqFt: raw?.areaSqFt ? num(raw.areaSqFt) : Math.round(width * depth * 10.7639),
      color: typeof raw?.color === 'string' ? raw.color : '#ecfdf5',
      textColor: typeof raw?.textColor === 'string' ? raw.textColor : '#065f46',
    };
  });
}

/** Map an arbitrary AI/imported asset array into PlacedAsset[], auto-binding rooms. */
export function mapApiAssets(rawAssets: unknown, rooms: RoomDefinition[]): PlacedAsset[] {
  if (!Array.isArray(rawAssets)) return [];
  return rawAssets.map((raw: any, index: number) => {
    const type = typeof raw?.type === 'string' ? raw.type : 'ap';
    const category: AssetCategory = isInfrastructureType(type) ? 'infrastructure' : 'furniture';
    const x = num(raw?.x ?? raw?.position?.x);
    const z = num(raw?.z ?? raw?.position?.z);
    const assignedRoom = findContainingRoom(x, z, rooms);

    return {
      id: makeId('asset'),
      type: type as PlacedAsset['type'],
      category,
      name:
        typeof raw?.name === 'string' && raw.name.trim()
          ? raw.name
          : `${type.toUpperCase()} Node ${index + 1}`,
      position: { x, y: getDefaultHeight(type), z },
      rotationY: num(raw?.rotationY),
      scale:
        raw?.scale && typeof raw.scale === 'object'
          ? { x: num(raw.scale.x, 1), y: num(raw.scale.y, 1), z: num(raw.scale.z, 1) }
          : { x: 1, y: 1, z: 1 },
      specs:
        raw?.specs && typeof raw.specs === 'object'
          ? raw.specs
          : { Manufacturer: 'AI Recommended', Status: 'Provisioned' },
      assignedRoomId: assignedRoom?.id,
    };
  });
}

/** Map a full AI/imported layout payload into typed rooms + assets. */
export function mapApiLayout(data: any): { rooms: RoomDefinition[]; assets: PlacedAsset[] } {
  const rooms = mapApiRooms(data?.rooms);
  const assets = mapApiAssets(data?.assets, rooms);
  return { rooms, assets };
}
