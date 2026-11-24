/**
 * Walls for house rooms: real door and window openings, an inside face that carries
 * the room's finish, and a plain outside. Each room's four walls sit inside its own
 * rectangle, so two rooms sharing a wall get two skins and each shows its own finish.
 *
 * `wallPieces` is pure geometry (no three.js) so it can be unit-tested.
 */
import * as THREE from 'three';
import type { Opening, RoomDefinition } from '../types';
import { WALL_T } from '../house/layout';
import { getFinish, type Finish } from '../house/finishes';
import { materialForFinish, repeatMeters } from './finishTextures';

export const DOOR_HEIGHT = 2.1;
export const ARCH_HEIGHT = 2.3;
export const WINDOW_SILL = 0.9;
export const WINDOW_HEAD = 2.1;

export interface Piece { a0: number; a1: number; y0: number; y1: number }

/**
 * Break one wall into solid boxes around its openings. `a` runs along the wall from
 * its start (west or north end). Doors and arches leave the floor open up to their
 * head; windows leave a hole between sill and head.
 */
export function wallPieces(length: number, height: number, openings: Opening[]): Piece[] {
  const holes = openings
    .map((o) => {
      const head = o.kind === 'window' ? WINDOW_HEAD : o.kind === 'arch' ? ARCH_HEIGHT : DOOR_HEIGHT;
      const sill = o.kind === 'window' ? WINDOW_SILL : 0;
      return { a0: Math.max(0, o.offset - o.width / 2), a1: Math.min(length, o.offset + o.width / 2), sill, head: Math.min(head, height) };
    })
    .sort((p, q) => p.a0 - q.a0);
  const out: Piece[] = [];
  let cursor = 0;
  for (const h of holes) {
    if (h.a0 > cursor + 1e-6) out.push({ a0: cursor, a1: h.a0, y0: 0, y1: height });
    if (h.sill > 0) out.push({ a0: h.a0, a1: h.a1, y0: 0, y1: h.sill });
    if (h.head < height - 1e-6) out.push({ a0: h.a0, a1: h.a1, y0: h.head, y1: height });
    cursor = Math.max(cursor, h.a1);
  }
  if (cursor < length - 1e-6) out.push({ a0: cursor, a1: length, y0: 0, y1: height });
  return out;
}

type Side = 'n' | 's' | 'e' | 'w';
const PLASTER = new THREE.MeshStandardMaterial({ color: '#efece6', roughness: 0.9 });
const TRIM = new THREE.MeshStandardMaterial({ color: '#f8f8f6', roughness: 0.5 });
const GLASS = new THREE.MeshStandardMaterial({ color: '#cfe8f5', transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.3, side: THREE.DoubleSide });
const DOOR_LEAF = new THREE.MeshStandardMaterial({ color: '#5b4636', roughness: 0.5 });

/**
 * Remap the UVs of one face so a texture repeat spans `repeat` metres and the
 * pattern continues across neighbouring pieces. (u0, v0) is the face's origin in metres.
 */
function mapFace(g: THREE.BoxGeometry, face: number, u0: number, v0: number, du: number, dv: number, repeat: [number, number], flipU: boolean) {
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < 4; i++) {
    const idx = face * 4 + i;
    const u = uv.getX(idx), v = uv.getY(idx);
    uv.setXY(idx, (u0 + (flipU ? 1 - u : u) * du) / repeat[0], (v0 + v * dv) / repeat[1]);
  }
  uv.needsUpdate = true;
}

/** Interior face index of a wall's box and whether its U runs against the wall's own direction. */
const FACE: Record<Side, { face: number; reversed: boolean }> = {
  n: { face: 4, reversed: false }, // +z face, u grows toward +x
  s: { face: 5, reversed: true },  // -z face, u grows toward -x
  w: { face: 0, reversed: true },  // +x face, u grows toward -z
  e: { face: 1, reversed: false }, // -x face, u grows toward +z
};

export interface RoomShellOptions {
  wallHeight: number;
  /** Draw only the floor and the lower part of the walls (plan view uses the floor only). */
  withWalls: boolean;
}

/** Build a room's floor and walls with their finishes. Returns the group to add to the scene. */
export function buildHouseRoom(room: RoomDefinition, floorOverride: THREE.Material | null, opts: RoomShellOptions): THREE.Group {
  const group = new THREE.Group();
  group.name = `room_${room.id}`;
  const H = opts.wallHeight;
  const x0 = room.x - room.width / 2, z0 = room.z - room.depth / 2;

  // Floor
  const floorFinish = getFinish(room.floorFinishId);
  const floorGeo = new THREE.BoxGeometry(room.width, 0.06, room.depth);
  const floorMat: THREE.Material[] = Array(6).fill(PLASTER);
  if (floorOverride) floorMat[2] = floorOverride;
  else if (floorFinish) {
    floorMat[2] = materialForFinish(floorFinish);
    const rep = repeatMeters(floorFinish);
    mapFace(floorGeo, 2, 0, 0, room.width, room.depth, rep, false);
  } else floorMat[2] = new THREE.MeshStandardMaterial({ color: room.color, roughness: 0.9 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.set(room.x, 0.03, room.z);
  floor.receiveShadow = true;
  group.add(floor);

  if (!opts.withWalls) return group;

  const wallFinish = getFinish(room.wallFinishId);
  const accent = room.accentWall ? getFinish(room.accentWall.finishId) : undefined;
  const byWall: Record<Side, Opening[]> = { n: [], s: [], e: [], w: [] };
  (room.openings ?? []).forEach((o) => byWall[o.wall].push(o));

  const skin = (finish: Finish | undefined): { mat: THREE.Material; rep: [number, number] } =>
    finish ? { mat: materialForFinish(finish), rep: repeatMeters(finish) } : { mat: PLASTER, rep: [1, 1] };

  for (const side of ['n', 's', 'e', 'w'] as Side[]) {
    const horizontal = side === 'n' || side === 's';
    const length = horizontal ? room.width : room.depth;
    // North and south walls run the full width; east and west fit between them.
    const lo = horizontal ? 0 : WALL_T, hi = horizontal ? length : length - WALL_T;
    const finish = room.accentWall?.wall === side && accent ? accent : wallFinish;
    const { mat, rep } = skin(finish);
    const { face, reversed } = FACE[side];

    for (const piece of wallPieces(length, H, byWall[side])) {
      const a0 = Math.max(piece.a0, lo), a1 = Math.min(piece.a1, hi);
      if (a1 - a0 < 1e-3) continue;
      const len = a1 - a0, h = piece.y1 - piece.y0;
      const geo = horizontal ? new THREE.BoxGeometry(len, h, WALL_T) : new THREE.BoxGeometry(WALL_T, h, len);
      const mats: THREE.Material[] = Array(6).fill(PLASTER);
      mats[face] = mat;
      if (finish && finish.pattern !== 'solid') {
        const uStart = reversed ? length - a1 : a0;
        mapFace(geo, face, uStart, piece.y0, len, h, rep, false);
      }
      const mesh = new THREE.Mesh(geo, mats);
      const mid = (a0 + a1) / 2, y = (piece.y0 + piece.y1) / 2;
      if (horizontal) mesh.position.set(x0 + mid, y, side === 'n' ? z0 + WALL_T / 2 : z0 + room.depth - WALL_T / 2);
      else mesh.position.set(side === 'w' ? x0 + WALL_T / 2 : x0 + room.width - WALL_T / 2, y, z0 + mid);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }

    // Window glass with a thin frame, and the front door leaf.
    for (const o of byWall[side]) {
      if (o.kind !== 'window' && o.kind !== 'front_door') continue;
      const a0 = o.offset - o.width / 2;
      const centre = side === 'n' ? { x: x0 + o.offset, z: z0 + WALL_T / 2 } : side === 's' ? { x: x0 + o.offset, z: z0 + room.depth - WALL_T / 2 }
        : side === 'w' ? { x: x0 + WALL_T / 2, z: z0 + o.offset } : { x: x0 + room.width - WALL_T / 2, z: z0 + o.offset };
      void a0;
      const y0 = o.kind === 'window' ? WINDOW_SILL : 0, y1 = Math.min(H, o.kind === 'window' ? WINDOW_HEAD : DOOR_HEIGHT);
      if (y1 - y0 < 0.15) continue;
      const place = (w: number, h: number, t: number, dy: number, mat: THREE.Material, dAlong = 0) => {
        const g = new THREE.Mesh(horizontal ? new THREE.BoxGeometry(w, h, t) : new THREE.BoxGeometry(t, h, w), mat);
        g.position.set(centre.x + (horizontal ? dAlong : 0), y0 + dy, centre.z + (horizontal ? 0 : dAlong));
        group.add(g);
      };
      if (o.kind === 'window') {
        const hh = y1 - y0;
        place(o.width, hh, 0.02, hh / 2, GLASS);
        place(o.width + 0.06, 0.05, WALL_T + 0.02, 0.025, TRIM);
        place(o.width + 0.06, 0.05, WALL_T + 0.02, hh - 0.025, TRIM);
        place(0.05, hh, WALL_T + 0.02, hh / 2, TRIM, -o.width / 2);
        place(0.05, hh, WALL_T + 0.02, hh / 2, TRIM, o.width / 2);
        place(0.03, hh, 0.03, hh / 2, TRIM);
      } else {
        place(o.width - 0.05, y1 - 0.05, 0.05, (y1 - 0.05) / 2, DOOR_LEAF);
      }
    }
  }
  return group;
}
