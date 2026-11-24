import type { Level, PlacedAsset, RoomDefinition, RoomKind } from '../types';

/** What the user wants, after parsing their request. */
export interface HouseBrief {
  bedrooms: number;
  bathrooms: number;
  floors: 1 | 2;
  /** Total floor area across all floors, in square metres. Omit to let the generator decide. */
  areaSqm?: number;
  styleId: string;
  /** Chooses among alternate layouts, finishes and colours. 0 is the first option. */
  variation: number;
  study: boolean;
  laundry: boolean;
  /** Finish overrides asked for in the request (finish ids). */
  prefs?: {
    floor?: string;
    wall?: string;
    accent?: string;
    wetFloor?: string;
    wetWall?: string;
  };
  /** Override the style's light colour. */
  lighting?: 'warm' | 'neutral' | 'cool';
  /** Free text the request was parsed from (shown back to the user). */
  request?: string;
}

export interface HouseDesign {
  levels: Level[];
  rooms: RoomDefinition[];
  assets: PlacedAsset[];
}

export interface ScheduleRow {
  roomId: string;
  room: string;
  kind: RoomKind;
  levelName: string;
  areaSqm: number;
  floor: { id: string; name: string };
  wall: { id: string; name: string };
  accent?: { id: string; name: string };
}

export interface HouseMeta {
  styleId: string;
  styleName: string;
  variation: number;
  bedrooms: number;
  bathrooms: number;
  floors: number;
  /** Footprint of one floor, metres. */
  width: number;
  depth: number;
  totalAreaSqm: number;
  lighting: { kelvin: number; fixtures: string };
  schedule: ScheduleRow[];
  /** Finishes (supplied and fitted) plus furniture, fixtures and decor, USD. */
  cost: { finishes: number; furnishings: number; total: number };
  lightCount: number;
  notes: string[];
}

export interface GeneratedHouse {
  design: HouseDesign;
  meta: HouseMeta;
  brief: HouseBrief;
}

export const DEFAULT_BRIEF: HouseBrief = {
  bedrooms: 3, bathrooms: 2, floors: 1, styleId: 'modern', variation: 0, study: false, laundry: true,
};
