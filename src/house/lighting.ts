/**
 * Lighting preview: time-of-day presets and the real light sources derived from the
 * placed light fixtures. Pure data and maths (no three.js) so it can be tested.
 */
import type { AssetType, PlacedAsset, RoomDefinition } from '../types';
import { HOUSE_ASSET_SPECS, isHouseAssetType } from './assetSpecs';

export type LightingMode = 'day' | 'evening' | 'night';

export interface LightingPreset {
  label: string;
  ambient: number;
  sun: number;
  sunColor: string;
  background: string;
  /** Multiplier on fixture brightness; 0 leaves the fixtures glowing only faintly. */
  gain: number;
}

export const LIGHTING_PRESETS: Record<LightingMode, LightingPreset> = {
  day: { label: 'Day', ambient: 0.65, sun: 0.8, sunColor: '#ffffff', background: '#fafafa', gain: 0 },
  evening: { label: 'Evening', ambient: 0.3, sun: 0.2, sunColor: '#ffb98a', background: '#cdd5e3', gain: 1 },
  night: { label: 'Night', ambient: 0.07, sun: 0, sunColor: '#8fa6ff', background: '#0b1020', gain: 1.4 },
};

export const LIGHT_SOURCE_TYPES: AssetType[] = ['ceiling_light', 'pendant_light', 'downlight', 'wall_sconce', 'floor_lamp'];

/** A room is drawn with the house builder when it has finishes or openings. */
export const isHouseRoom = (r: Pick<RoomDefinition, 'floorFinishId' | 'wallFinishId' | 'openings'>): boolean =>
  Boolean(r.floorFinishId || r.wallFinishId || (r.openings && r.openings.length > 0));

export interface LightSource {
  id: string;
  x: number; y: number; z: number;
  color: string;
  /** Candela. */
  intensity: number;
  distance: number;
}

const GAIN = 0.35;

/** The point light for a fixture, or null when the asset is not a light. */
export function lightSourceFor(a: PlacedAsset, gain: number): LightSource | null {
  if (!LIGHT_SOURCE_TYPES.includes(a.type) || gain <= 0) return null;
  const size = isHouseAssetType(a.type) ? HOUSE_ASSET_SPECS[a.type].size : { y: 0.1 };
  const lumens = Number(a.specs?.Lumens) || 400;
  // Hang the light just below ceiling fixtures and at the shade of lamps and sconces.
  const dy = a.type === 'floor_lamp' ? 1.45 : a.type === 'pendant_light' ? 0.12 : a.type === 'wall_sconce' ? 0.15 : -0.12 + size.y / 2;
  return {
    id: a.id, x: a.position.x, y: a.position.y + dy, z: a.position.z,
    color: a.specs?.Glow || '#fff4d6',
    intensity: (lumens / (4 * Math.PI)) * GAIN * gain,
    distance: 7,
  };
}

/**
 * Real-time lights are the expensive part of the preview, so cap them. When a house
 * has more fixtures than the cap, keep the brightest and spread the rest evenly.
 */
export function pickLightSources(assets: PlacedAsset[], gain: number, max = 24): LightSource[] {
  const all = assets.map((a) => lightSourceFor(a, gain)).filter((l): l is LightSource => l !== null);
  if (all.length <= max) return all;
  const sorted = [...all].sort((p, q) => q.intensity - p.intensity || p.id.localeCompare(q.id));
  const keep: LightSource[] = [];
  for (const l of sorted) {
    if (keep.length >= max) break;
    // Skip a fixture that sits within 0.8 m of one already kept (a downlight grid).
    if (keep.some((k) => Math.hypot(k.x - l.x, k.z - l.z) < 0.8 && Math.abs(k.y - l.y) < 1)) continue;
    keep.push(l);
  }
  // Top up from the remainder if the spacing rule dropped too many.
  for (const l of sorted) { if (keep.length >= max) break; if (!keep.includes(l)) keep.push(l); }
  return keep;
}
