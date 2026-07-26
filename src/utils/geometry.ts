/**
 * Shared geometry, sizing and collision helpers.
 *
 * Previously these functions were duplicated verbatim across ThreeCanvas.tsx
 * and CADSidebar.tsx. Centralising them here keeps the collision / sizing
 * rules in a single source of truth.
 */
import { PlacedAsset, RoomDefinition, AssetType, getAssetHeightLayer } from '../types';

/** Asset types that belong to the low-current / infrastructure category. */
export const INFRASTRUCTURE_TYPES: AssetType[] = [
  'ap',
  'dp',
  'tp',
  'cctv',
  'door_access',
  'intercom',
  'power_outlet',
  'hdmi_port',
  'projector_port',
];

/** True when the given type is a low-current infrastructure device. */
export function isInfrastructureType(type: string): boolean {
  return (INFRASTRUCTURE_TYPES as string[]).includes(type);
}

/** Standard mounting height (metres) for a given asset type. */
export function getDefaultHeight(type: string): number {
  if (type === 'ap' || type === 'cctv') return 3.2; // ceiling mounted
  if (isInfrastructureType(type)) return 0.8; // wall / port height
  return 0.4; // ground furniture
}

/** Footprint of an asset on the floor plane, honouring any custom scale. */
export function getAssetSize(asset: PlacedAsset): { width: number; depth: number } {
  const scaleX = asset.scale?.x || 1.0;
  const scaleZ = asset.scale?.z || 1.0;

  switch (asset.type) {
    case 'ap':
      return { width: 0.8, depth: 0.8 };
    case 'dp':
    case 'tp':
    case 'hdmi_port':
    case 'projector_port':
    case 'door_access':
    case 'intercom':
      return { width: 0.4, depth: 0.4 };
    case 'power_outlet':
      return { width: 0.6, depth: 0.6 };
    case 'cctv':
      return { width: 0.5, depth: 0.5 };
    case 'desk_single':
      return { width: 1.2, depth: 0.7 };
    case 'desk_cluster_4':
    case 'desk_cluster_6':
      return { width: scaleX, depth: scaleZ };
    case 'conference_table':
      return { width: scaleX, depth: scaleZ };
    case 'chair_office':
    case 'chair_lounge':
      return { width: 0.6, depth: 0.6 };
    case 'reception_desk':
      return { width: 2.4, depth: 1.2 };
    case 'whiteboard':
      return { width: 0.2, depth: 1.2 };
    case 'cabinet':
      return { width: 1.0, depth: 0.5 };
    case 'plant_pot':
      return { width: 0.6, depth: 0.6 };
    default:
      return { width: 0.8, depth: 0.8 };
  }
}

/** Circle-approximation collision test between two assets on the same layer. */
export function isOverlapping(assetA: PlacedAsset, assetB: PlacedAsset): boolean {
  // Only check collision if they share the same height layer.
  if (getAssetHeightLayer(assetA.type) !== getAssetHeightLayer(assetB.type)) {
    return false;
  }

  const sizeA = getAssetSize(assetA);
  const sizeB = getAssetSize(assetB);

  const rA = Math.max(sizeA.width, sizeA.depth) * 0.42;
  const rB = Math.max(sizeB.width, sizeB.depth) * 0.42;

  const dx = assetA.position.x - assetB.position.x;
  const dz = assetA.position.z - assetB.position.z;
  const dist = Math.sqrt(dx * dx + dz * dz);

  return dist < rA + rB;
}

/** True when an asset's footprint falls outside every defined room. */
export function isAssetOutsideRooms(asset: PlacedAsset, rooms: RoomDefinition[]): boolean {
  if (rooms.length === 0) return false;

  const size = getAssetSize(asset);
  const halfW = size.width / 2;
  const halfD = size.depth / 2;

  return !rooms.some((room) => {
    const roomMinX = room.x - room.width / 2;
    const roomMaxX = room.x + room.width / 2;
    const roomMinZ = room.z - room.depth / 2;
    const roomMaxZ = room.z + room.depth / 2;

    const assetMinX = asset.position.x - halfW;
    const assetMaxX = asset.position.x + halfW;
    const assetMinZ = asset.position.z - halfD;
    const assetMaxZ = asset.position.z + halfD;

    // Allow a small nesting tolerance.
    return (
      assetMinX >= roomMinX - 0.08 &&
      assetMaxX <= roomMaxX + 0.08 &&
      assetMinZ >= roomMinZ - 0.08 &&
      assetMaxZ <= roomMaxZ + 0.08
    );
  });
}

/** Which room (if any) contains the given world-space coordinate. */
export function findContainingRoom(
  x: number,
  z: number,
  rooms: RoomDefinition[]
): RoomDefinition | undefined {
  return rooms.find((room) => {
    const halfW = room.width / 2;
    const halfD = room.depth / 2;
    return (
      x >= room.x - halfW &&
      x <= room.x + halfW &&
      z >= room.z - halfD &&
      z <= room.z + halfD
    );
  });
}

/** Emerald -> amber -> red occupancy colour based on asset density. */
export function getOccupancyColor(assetCount: number, width: number, depth: number): string {
  const areaSqFt = width * depth * 10.7639;
  const capacity = Math.max(1, Math.floor(areaSqFt / 80));
  const ratio = Math.min(1.5, assetCount / capacity);

  if (assetCount === 0) {
    return '#10b981'; // Cozy emerald green for empty / light space
  }

  // Interpolate Emerald (16,185,129) -> Amber (245,158,11) -> Red (239,68,68)
  if (ratio <= 0.6) {
    const t = ratio / 0.6;
    const r = Math.round(16 + (245 - 16) * t);
    const g = Math.round(185 + (158 - 185) * t);
    const b = Math.round(129 + (11 - 129) * t);
    return `rgb(${r}, ${g}, ${b})`;
  }
  const t = Math.min(1.0, (ratio - 0.6) / 0.9);
  const r = Math.round(245 + (239 - 245) * t);
  const g = Math.round(158 + (68 - 158) * t);
  const b = Math.round(11 + (68 - 11) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Wall finish for a room. AI-generated / imported rooms carry no hardcoded id,
 * so we derive a sensible finish from an explicit `wallStyle` when present,
 * otherwise from keywords in the room name (meeting / server / boardroom rooms
 * get solid partitions, everything else gets glass).
 */
export function getRoomWallStyle(room: RoomDefinition): 'glass' | 'concrete' {
  if (room.wallStyle) return room.wallStyle;
  const haystack = `${room.id} ${room.name}`.toLowerCase();
  if (/(server|meeting|board|comms|mdf|idf|store|utility|electrical)/.test(haystack)) {
    return 'concrete';
  }
  return 'glass';
}

/** Collision-free-ish unique id generator for placed assets / rooms. */
export function makeId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}
