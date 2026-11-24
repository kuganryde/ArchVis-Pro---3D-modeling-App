/**
 * Real-world specification for every house asset: size in metres, how it is
 * mounted, which way its front faces, and an indicative cost. One table feeds the
 * footprints in getAssetSize(), the hand-built models (src/three/houseModels.ts),
 * the bill of materials, the library UI and the bounding-box tests.
 *
 * Sizes are the bounding box of the model with its origin at the bottom centre.
 * Costs are indicative USD list prices; adjust to your suppliers.
 */
import type { HouseAssetType } from '../types';

export type Mount = 'floor' | 'wall' | 'ceiling';
export type HouseGroup = 'Living' | 'Dining & Kitchen' | 'Bedroom' | 'Bath & Laundry' | 'Lighting' | 'Decor & Structure';

export interface HouseAssetSpec {
  label: string;
  group: HouseGroup;
  /** Width (x), height (y), depth (z) in metres. */
  size: { x: number; y: number; z: number };
  mount: Mount;
  /** Direction the front of the model faces in its own frame. */
  front: '+z';
  /** Footprint comes from the asset's own scale (rugs). */
  scalable?: boolean;
  /** Default fabric / paint colour; the style palette overrides it. */
  color: string;
  cost: number;
  desc: string;
}

export const HOUSE_ASSET_SPECS: Record<HouseAssetType, HouseAssetSpec> = {
  sofa: { label: 'Sofa (3-seat)', group: 'Living', size: { x: 2.1, y: 0.85, z: 0.95 }, mount: 'floor', front: '+z', color: '#6b7a8f', cost: 900, desc: 'Three-seat fabric sofa, 2.1 m wide.' },
  coffee_table: { label: 'Coffee Table', group: 'Living', size: { x: 1.1, y: 0.4, z: 0.6 }, mount: 'floor', front: '+z', color: '#a97c50', cost: 220, desc: 'Low table with lower shelf, 1.1 x 0.6 m.' },
  side_table: { label: 'Side Table', group: 'Living', size: { x: 0.45, y: 0.5, z: 0.45 }, mount: 'floor', front: '+z', color: '#a97c50', cost: 90, desc: 'Round side table, 0.45 m across.' },
  tv_unit: { label: 'TV Unit', group: 'Living', size: { x: 1.6, y: 0.45, z: 0.4 }, mount: 'floor', front: '+z', color: '#a97c50', cost: 380, desc: 'Low media console, 1.6 m wide.' },
  bookshelf: { label: 'Bookshelf', group: 'Living', size: { x: 0.9, y: 1.9, z: 0.32 }, mount: 'floor', front: '+z', color: '#a97c50', cost: 260, desc: 'Open shelving with books, 1.9 m tall.' },
  rug: { label: 'Area Rug', group: 'Living', size: { x: 2.0, y: 0.02, z: 1.4 }, mount: 'floor', front: '+z', scalable: true, color: '#c9b79c', cost: 240, desc: 'Flat rug, sized by its scale (default 2.0 x 1.4 m).' },

  dining_table: { label: 'Dining Table', group: 'Dining & Kitchen', size: { x: 1.6, y: 0.75, z: 0.9 }, mount: 'floor', front: '+z', color: '#a97c50', cost: 520, desc: 'Six-seat table, 1.6 x 0.9 m.' },
  dining_chair: { label: 'Dining Chair', group: 'Dining & Kitchen', size: { x: 0.45, y: 0.9, z: 0.5 }, mount: 'floor', front: '+z', color: '#8b8f98', cost: 95, desc: 'Upholstered seat with timber legs.' },
  sideboard: { label: 'Sideboard', group: 'Dining & Kitchen', size: { x: 1.4, y: 0.85, z: 0.4 }, mount: 'floor', front: '+z', color: '#a97c50', cost: 480, desc: 'Three-door storage unit, 1.4 m wide.' },
  kitchen_base: { label: 'Kitchen Base Units', group: 'Dining & Kitchen', size: { x: 2.4, y: 0.9, z: 0.6 }, mount: 'floor', front: '+z', color: '#e5e7eb', cost: 1400, desc: 'Base cabinets with worktop and hob, 2.4 m run.' },
  kitchen_upper: { label: 'Kitchen Wall Units', group: 'Dining & Kitchen', size: { x: 2.4, y: 0.7, z: 0.35 }, mount: 'wall', front: '+z', color: '#e5e7eb', cost: 900, desc: 'Wall cabinets, 2.4 m run, mounted at 1.4 m.' },
  kitchen_island: { label: 'Kitchen Island', group: 'Dining & Kitchen', size: { x: 1.8, y: 0.9, z: 0.9 }, mount: 'floor', front: '+z', color: '#e5e7eb', cost: 1600, desc: 'Island with stone top, 1.8 x 0.9 m.' },
  fridge: { label: 'Refrigerator', group: 'Dining & Kitchen', size: { x: 0.75, y: 1.8, z: 0.7 }, mount: 'floor', front: '+z', color: '#cbd5e1', cost: 1100, desc: 'Double-door fridge freezer.' },
  bar_stool: { label: 'Bar Stool', group: 'Dining & Kitchen', size: { x: 0.4, y: 0.75, z: 0.4 }, mount: 'floor', front: '+z', color: '#8b8f98', cost: 80, desc: 'Counter-height stool, seat at 0.75 m.' },

  bed_king: { label: 'King Bed', group: 'Bedroom', size: { x: 1.9, y: 1.1, z: 2.1 }, mount: 'floor', front: '+z', color: '#7b8794', cost: 1300, desc: 'King bed with upholstered headboard.' },
  bed_double: { label: 'Double Bed', group: 'Bedroom', size: { x: 1.6, y: 1.0, z: 2.1 }, mount: 'floor', front: '+z', color: '#7b8794', cost: 950, desc: 'Queen bed with headboard.' },
  bed_single: { label: 'Single Bed', group: 'Bedroom', size: { x: 0.95, y: 0.9, z: 2.0 }, mount: 'floor', front: '+z', color: '#7b8794', cost: 520, desc: 'Single bed, 0.95 x 2.0 m.' },
  bedside_table: { label: 'Bedside Table', group: 'Bedroom', size: { x: 0.45, y: 0.5, z: 0.4 }, mount: 'floor', front: '+z', color: '#a97c50', cost: 110, desc: 'Single-drawer bedside cabinet.' },
  wardrobe: { label: 'Wardrobe', group: 'Bedroom', size: { x: 1.8, y: 2.1, z: 0.6 }, mount: 'floor', front: '+z', color: '#d8d3ca', cost: 1100, desc: 'Three-door wardrobe, 1.8 m wide.' },
  dresser: { label: 'Dresser', group: 'Bedroom', size: { x: 1.2, y: 0.85, z: 0.45 }, mount: 'floor', front: '+z', color: '#a97c50', cost: 450, desc: 'Three-drawer chest on legs.' },

  toilet: { label: 'Toilet', group: 'Bath & Laundry', size: { x: 0.4, y: 0.8, z: 0.7 }, mount: 'floor', front: '+z', color: '#f8fafc', cost: 260, desc: 'Close-coupled toilet.' },
  vanity: { label: 'Vanity Unit', group: 'Bath & Laundry', size: { x: 0.8, y: 0.85, z: 0.5 }, mount: 'floor', front: '+z', color: '#e5e7eb', cost: 480, desc: 'Basin on cabinet, 0.8 m wide.' },
  shower: { label: 'Shower Enclosure', group: 'Bath & Laundry', size: { x: 0.9, y: 2.0, z: 0.9 }, mount: 'floor', front: '+z', color: '#bfdbfe', cost: 750, desc: 'Glass enclosure with tray, 0.9 m square.' },
  bathtub: { label: 'Bathtub', group: 'Bath & Laundry', size: { x: 1.7, y: 0.55, z: 0.75 }, mount: 'floor', front: '+z', color: '#f8fafc', cost: 820, desc: 'Freestanding tub, 1.7 m long.' },
  washer: { label: 'Washing Machine', group: 'Bath & Laundry', size: { x: 0.6, y: 0.85, z: 0.6 }, mount: 'floor', front: '+z', color: '#f1f5f9', cost: 650, desc: 'Front-loading washer.' },

  ceiling_light: { label: 'Ceiling Light', group: 'Lighting', size: { x: 0.4, y: 0.08, z: 0.4 }, mount: 'ceiling', front: '+z', color: '#f8fafc', cost: 70, desc: 'Flush ceiling disc light, 0.4 m.' },
  pendant_light: { label: 'Pendant Light', group: 'Lighting', size: { x: 0.45, y: 0.9, z: 0.45 }, mount: 'ceiling', front: '+z', color: '#e5e7eb', cost: 160, desc: 'Cone pendant on a cord, 0.9 m drop.' },
  downlight: { label: 'Downlight', group: 'Lighting', size: { x: 0.12, y: 0.03, z: 0.12 }, mount: 'ceiling', front: '+z', color: '#f8fafc', cost: 18, desc: 'Recessed LED downlight, 0.12 m.' },
  floor_lamp: { label: 'Floor Lamp', group: 'Lighting', size: { x: 0.35, y: 1.6, z: 0.35 }, mount: 'floor', front: '+z', color: '#f3e8d0', cost: 140, desc: 'Standing lamp with fabric shade.' },
  wall_sconce: { label: 'Wall Sconce', group: 'Lighting', size: { x: 0.14, y: 0.25, z: 0.12 }, mount: 'wall', front: '+z', color: '#f3e8d0', cost: 75, desc: 'Wall light, mounted at 1.7 m.' },

  wall_art: { label: 'Wall Art', group: 'Decor & Structure', size: { x: 0.9, y: 0.6, z: 0.04 }, mount: 'wall', front: '+z', color: '#9aa8b8', cost: 120, desc: 'Framed artwork, 0.9 x 0.6 m.' },
  mirror: { label: 'Mirror', group: 'Decor & Structure', size: { x: 0.6, y: 1.5, z: 0.04 }, mount: 'wall', front: '+z', color: '#bfdbfe', cost: 140, desc: 'Framed wall mirror, 1.5 m tall.' },
  curtain: { label: 'Curtains', group: 'Decor & Structure', size: { x: 1.6, y: 2.3, z: 0.12 }, mount: 'wall', front: '+z', color: '#d6cfc2', cost: 180, desc: 'Floor-length curtains on a rod.' },
  staircase: { label: 'Staircase', group: 'Decor & Structure', size: { x: 1.0, y: 3.0, z: 4.3 }, mount: 'floor', front: '+z', color: '#c9b79c', cost: 4200, desc: 'Straight stair, 17 risers to a 3.0 m floor-to-floor height.' },
};

export const HOUSE_ASSET_TYPES = Object.keys(HOUSE_ASSET_SPECS) as HouseAssetType[];

export const isHouseAssetType = (type: string): type is HouseAssetType =>
  Object.prototype.hasOwnProperty.call(HOUSE_ASSET_SPECS, type);

/** Standard mounting height (bottom edge, metres) for wall-mounted house assets. */
export const WALL_MOUNT_HEIGHT: Partial<Record<HouseAssetType, number>> = {
  kitchen_upper: 1.4,
  wall_art: 1.3,
  mirror: 1.0,
  curtain: 0,
  wall_sconce: 1.7,
};
