/**
 * Local persistence for the working design. The previous build kept rooms and
 * assets purely in React state, so a refresh wiped the whole layout. We now
 * autosave a versioned snapshot to localStorage and restore it on load.
 */
import { PlacedAsset, RoomDefinition } from '../types';

const STORAGE_KEY = 'archviz_pro_design_v1';
const STORAGE_VERSION = 1;

export interface PersistedDesign {
  version: number;
  savedAt: string;
  rooms: RoomDefinition[];
  assets: PlacedAsset[];
  blueprintImage: string | null;
}

/** Persist the current design. Silently no-ops if storage is unavailable/full. */
export function saveDesign(
  rooms: RoomDefinition[],
  assets: PlacedAsset[],
  blueprintImage: string | null
): void {
  try {
    const payload: PersistedDesign = {
      version: STORAGE_VERSION,
      savedAt: new Date().toISOString(),
      rooms,
      assets,
      blueprintImage,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    // Quota exceeded (large blueprint data URIs) or storage disabled — ignore.
    console.warn('Autosave skipped:', err);
  }
}

/** Restore a previously saved design, or null when none/invalid. */
export function loadDesign(): PersistedDesign | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedDesign;
    if (parsed?.version !== STORAGE_VERSION || !Array.isArray(parsed.rooms)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Remove the saved design (used when resetting the workspace). */
export function clearDesign(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
