/**
 * Access point planning. Uses the same rule as the Wi-Fi heatmap: a room is well
 * covered when its centre is within `WIFI_GOOD_RANGE_M` of an access point. This is a
 * distance rule, not an RF simulation (walls and materials are not modelled).
 */

/** Rooms closer than this to an access point show as "excellent" on the heatmap. */
export const WIFI_GOOD_RANGE_M = 6.5;
/** Rooms smaller than this (closets, lobbies) are covered from next door. */
const MIN_ROOM_AREA_M2 = 5;

interface Point { x: number; z: number }
interface RoomLike extends Point { id: string; width: number; depth: number }

export interface PlannedAp extends Point { roomId: string }

/** Distance from `p` to the nearest of `aps`, or Infinity when there are none. */
export function nearestDistance(p: Point, aps: Point[]): number {
  let best = Infinity;
  for (const a of aps) best = Math.min(best, Math.hypot(a.x - p.x, a.z - p.z));
  return best;
}

/**
 * Where to add access points so every room centre is within range. Largest rooms
 * are served first, so an access point in a big room also covers its neighbours and
 * the plan adds as few as it can.
 */
export function planAccessPoints(rooms: RoomLike[], existing: Point[], maxDistance = WIFI_GOOD_RANGE_M): PlannedAp[] {
  const all: Point[] = [...existing];
  const planned: PlannedAp[] = [];
  const bySize = [...rooms].sort((a, b) => b.width * b.depth - a.width * a.depth || a.id.localeCompare(b.id));
  for (const r of bySize) {
    if (r.width * r.depth < MIN_ROOM_AREA_M2) continue;
    if (nearestDistance(r, all) > maxDistance) {
      planned.push({ x: r.x, z: r.z, roomId: r.id });
      all.push({ x: r.x, z: r.z });
    }
  }
  return planned;
}
