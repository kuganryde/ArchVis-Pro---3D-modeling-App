/**
 * Interior design styles. Each style is a complete recipe: which floors and wall
 * finishes go in which kind of room, the furniture palette, how the house is lit
 * and how much decoration it gets. Every list has alternates, and the variation
 * number picks one (modulo the list length), so the same style yields visibly
 * different but coherent designs.
 */
import type { RoomKind } from '../types';

export type SurfaceZone = 'living' | 'bedroom' | 'wet' | 'kitchen' | 'circulation';
export type FixtureStyle = 'pendants' | 'downlights' | 'mixed' | 'sconces';

export interface DesignStyle {
  id: string;
  name: string;
  blurb: string;
  palette: {
    /** Timber tone for tables, shelves and frames. */
    wood: string;
    /** Upholstery and bedding colours, used in rotation. */
    fabrics: string[];
    /** Rug colour. */
    rug: string;
    /** Cabinet colour for kitchens, wardrobes and vanities. */
    cabinet: string;
    /** Swatches shown in the style picker. */
    swatches: string[];
  };
  floors: Record<SurfaceZone, string[]>;
  walls: Record<SurfaceZone, string[]>;
  /** Wallpaper or panel candidates for one feature wall. */
  accents: string[];
  accentRooms: RoomKind[];
  lighting: { kelvin: number; fixtures: FixtureStyle; brightness: number };
  decor: { art: boolean; rugs: boolean; curtains: boolean; plants: number };
}

export const DESIGN_STYLES: DesignStyle[] = [
  {
    id: 'modern', name: 'Modern', blurb: 'Clean lines, neutral walls, large-format tiles and downlights.',
    palette: { wood: '#9c7a54', fabrics: ['#6e7683', '#3f4650', '#a39a8c'], rug: '#bfb8ab', cabinet: '#e9e9e6', swatches: ['#f1f1ee', '#6e7683', '#9c7a54', '#2d3138'] },
    floors: { living: ['porcelain_large', 'oak_plank', 'concrete'], bedroom: ['oak_plank', 'grey_wood'], wet: ['porcelain_grey', 'porcelain_large'], kitchen: ['porcelain_large', 'porcelain_grey'], circulation: ['porcelain_large', 'oak_plank'] },
    walls: { living: ['paint_white', 'paint_greige'], bedroom: ['paint_greige', 'paint_white'], wet: ['tile_grey_large', 'tile_subway_white'], kitchen: ['paint_white', 'paint_greige'], circulation: ['paint_white'] },
    accents: ['wp_geometric_grey', 'wp_slat_oak', 'paint_charcoal'], accentRooms: ['living', 'master_bedroom'],
    lighting: { kelvin: 3500, fixtures: 'downlights', brightness: 0.9 }, decor: { art: true, rugs: true, curtains: true, plants: 1 },
  },
  {
    id: 'scandinavian', name: 'Scandinavian', blurb: 'Pale oak, white walls, soft textiles and warm light.',
    palette: { wood: '#d3b48a', fabrics: ['#d9d3c7', '#8f9fa8', '#c9b79c'], rug: '#e3ddd0', cabinet: '#f2f0ea', swatches: ['#f7f5ef', '#d3b48a', '#8f9fa8', '#c9b79c'] },
    floors: { living: ['oak_plank', 'oak_chevron'], bedroom: ['oak_plank', 'carpet_oat'], wet: ['porcelain_white', 'porcelain_grey'], kitchen: ['oak_plank', 'porcelain_white'], circulation: ['oak_plank'] },
    walls: { living: ['paint_white', 'paint_warm_white'], bedroom: ['paint_warm_white', 'paint_sky'], wet: ['tile_subway_white'], kitchen: ['paint_white'], circulation: ['paint_white'] },
    accents: ['wp_stripe_sage', 'wp_floral_blush', 'paint_sky'], accentRooms: ['master_bedroom', 'dining'],
    lighting: { kelvin: 2800, fixtures: 'mixed', brightness: 0.85 }, decor: { art: true, rugs: true, curtains: true, plants: 3 },
  },
  {
    id: 'japandi', name: 'Japandi', blurb: 'Calm earth tones, slatted timber and low furniture.',
    palette: { wood: '#a98b66', fabrics: ['#b9ad9a', '#7e8a74', '#5b5a55'], rug: '#cfc6b6', cabinet: '#d9d2c4', swatches: ['#ece6da', '#a98b66', '#7e8a74', '#5b5a55'] },
    floors: { living: ['oak_plank', 'concrete'], bedroom: ['oak_plank', 'carpet_oat'], wet: ['slate', 'porcelain_grey'], kitchen: ['oak_plank', 'porcelain_large'], circulation: ['oak_plank'] },
    walls: { living: ['paint_greige', 'paint_warm_white'], bedroom: ['paint_greige', 'paint_sage'], wet: ['tile_grey_large', 'tile_zellige_green'], kitchen: ['paint_warm_white'], circulation: ['paint_greige'] },
    accents: ['wp_slat_oak', 'wp_grasscloth', 'paint_sage'], accentRooms: ['living', 'master_bedroom'],
    lighting: { kelvin: 2700, fixtures: 'mixed', brightness: 0.75 }, decor: { art: true, rugs: true, curtains: true, plants: 2 },
  },
  {
    id: 'industrial', name: 'Industrial', blurb: 'Concrete floors, charcoal walls, dark metal and timber.',
    palette: { wood: '#6b4a33', fabrics: ['#4b4f55', '#7a5a3c', '#2f3237'], rug: '#4a4d52', cabinet: '#3b3e43', swatches: ['#3b3e43', '#6b4a33', '#a6a8a8', '#c9a24a'] },
    floors: { living: ['concrete', 'walnut_plank'], bedroom: ['walnut_plank', 'grey_wood'], wet: ['slate', 'porcelain_grey'], kitchen: ['concrete', 'slate'], circulation: ['concrete'] },
    walls: { living: ['paint_charcoal', 'paint_greige'], bedroom: ['paint_charcoal', 'paint_greige'], wet: ['tile_grey_large', 'tile_subway_white'], kitchen: ['paint_charcoal', 'paint_white'], circulation: ['paint_charcoal'] },
    accents: ['tile_terracotta', 'wp_geometric_gold', 'wp_slat_oak'], accentRooms: ['living', 'dining'],
    lighting: { kelvin: 2700, fixtures: 'pendants', brightness: 0.8 }, decor: { art: true, rugs: true, curtains: false, plants: 1 },
  },
  {
    id: 'mid_century', name: 'Mid-Century', blurb: 'Walnut, mustard and teal accents, geometric papers.',
    palette: { wood: '#7a5238', fabrics: ['#cf9f3a', '#3c7f86', '#b5603f'], rug: '#d7c7a6', cabinet: '#7a5238', swatches: ['#7a5238', '#cf9f3a', '#3c7f86', '#f1ebe0'] },
    floors: { living: ['walnut_plank', 'oak_chevron'], bedroom: ['walnut_plank', 'oak_plank'], wet: ['checker_bw', 'porcelain_white'], kitchen: ['checker_bw', 'walnut_plank'], circulation: ['walnut_plank'] },
    walls: { living: ['paint_warm_white', 'paint_mustard'], bedroom: ['paint_warm_white', 'paint_sky'], wet: ['tile_zellige_green', 'tile_subway_white'], kitchen: ['paint_warm_white'], circulation: ['paint_warm_white'] },
    accents: ['wp_chevron_teal', 'wp_geometric_gold', 'paint_mustard'], accentRooms: ['living', 'dining', 'master_bedroom'],
    lighting: { kelvin: 2700, fixtures: 'pendants', brightness: 0.85 }, decor: { art: true, rugs: true, curtains: true, plants: 2 },
  },
  {
    id: 'traditional', name: 'Traditional', blurb: 'Damask papers, herringbone timber and warm lamps.',
    palette: { wood: '#6b4a33', fabrics: ['#8a6f5a', '#5f6f63', '#a58a6e'], rug: '#8c6f5b', cabinet: '#e6dfd0', swatches: ['#e6dfd0', '#6b4a33', '#5f6f63', '#a58a6e'] },
    floors: { living: ['oak_chevron', 'walnut_plank'], bedroom: ['carpet_oat', 'oak_plank'], wet: ['marble_white', 'checker_bw'], kitchen: ['travertine', 'oak_chevron'], circulation: ['oak_chevron'] },
    walls: { living: ['paint_warm_white', 'paint_greige'], bedroom: ['paint_blush', 'paint_warm_white'], wet: ['tile_subway_white', 'tile_marble_wall'], kitchen: ['paint_warm_white'], circulation: ['paint_warm_white'] },
    accents: ['wp_damask_grey', 'wp_floral_botanical', 'wp_stripe_navy'], accentRooms: ['dining', 'master_bedroom', 'foyer'],
    lighting: { kelvin: 2700, fixtures: 'sconces', brightness: 0.8 }, decor: { art: true, rugs: true, curtains: true, plants: 2 },
  },
  {
    id: 'boho', name: 'Boho', blurb: 'Terracotta, grasscloth, botanical prints and plants.',
    palette: { wood: '#b08a5e', fabrics: ['#c27a5a', '#7d9a7a', '#d9c7a0'], rug: '#c8a57c', cabinet: '#d9c7a0', swatches: ['#c27a5a', '#7d9a7a', '#d9c7a0', '#b08a5e'] },
    floors: { living: ['oak_plank', 'encaustic_hex'], bedroom: ['oak_plank', 'carpet_oat'], wet: ['encaustic_hex', 'terrazzo'], kitchen: ['encaustic_hex', 'terrazzo'], circulation: ['encaustic_hex', 'oak_plank'] },
    walls: { living: ['paint_terracotta', 'paint_warm_white'], bedroom: ['paint_blush', 'paint_sage'], wet: ['tile_zellige_green', 'tile_terracotta'], kitchen: ['paint_warm_white', 'paint_blush'], circulation: ['paint_warm_white'] },
    accents: ['wp_floral_botanical', 'wp_grasscloth', 'wp_stripe_sage'], accentRooms: ['living', 'master_bedroom', 'dining'],
    lighting: { kelvin: 2500, fixtures: 'mixed', brightness: 0.75 }, decor: { art: true, rugs: true, curtains: true, plants: 5 },
  },
  {
    id: 'luxury', name: 'Luxury Art Deco', blurb: 'Marble, deep teal, brass-gold papers and layered light.',
    palette: { wood: '#3b2a22', fabrics: ['#1f4a4f', '#c9a24a', '#2b2b33'], rug: '#2c2f3a', cabinet: '#1f2a3a', swatches: ['#14323a', '#c9a24a', '#f4f4f2', '#2b2b33'] },
    floors: { living: ['marble_white', 'marble_black'], bedroom: ['carpet_oat', 'oak_chevron'], wet: ['marble_black', 'marble_white'], kitchen: ['marble_white', 'checker_bw'], circulation: ['marble_white', 'checker_bw'] },
    walls: { living: ['paint_warm_white', 'paint_navy'], bedroom: ['paint_navy', 'paint_blush'], wet: ['tile_marble_wall'], kitchen: ['paint_warm_white', 'paint_navy'], circulation: ['paint_warm_white'] },
    accents: ['wp_deco_fan', 'wp_geometric_gold', 'wp_damask_teal'], accentRooms: ['living', 'master_bedroom', 'dining', 'foyer'],
    lighting: { kelvin: 2700, fixtures: 'mixed', brightness: 0.85 }, decor: { art: true, rugs: true, curtains: true, plants: 2 },
  },
  {
    id: 'coastal', name: 'Coastal', blurb: 'Sea-mist blues, white timber, stripes and linen.',
    palette: { wood: '#d6c4a4', fabrics: ['#9fb8c4', '#e6dfd0', '#5b7f95'], rug: '#d9d3c4', cabinet: '#f1efe8', swatches: ['#bfd3dc', '#f1efe8', '#5b7f95', '#d6c4a4'] },
    floors: { living: ['grey_wood', 'oak_plank'], bedroom: ['grey_wood', 'carpet_oat'], wet: ['porcelain_white', 'porcelain_grey'], kitchen: ['grey_wood', 'porcelain_white'], circulation: ['grey_wood'] },
    walls: { living: ['paint_sky', 'paint_white'], bedroom: ['paint_sky', 'paint_warm_white'], wet: ['tile_subway_white', 'tile_zellige_green'], kitchen: ['paint_white', 'paint_sky'], circulation: ['paint_white'] },
    accents: ['wp_stripe_navy', 'wp_chevron_teal', 'wp_stripe_sage'], accentRooms: ['master_bedroom', 'living'],
    lighting: { kelvin: 3000, fixtures: 'pendants', brightness: 0.95 }, decor: { art: true, rugs: true, curtains: true, plants: 2 },
  },
  {
    id: 'minimalist', name: 'Minimalist', blurb: 'White on white, concrete and almost no decoration.',
    palette: { wood: '#bda27e', fabrics: ['#e0ddd6', '#8e9094', '#b8b5ad'], rug: '#d9d6cf', cabinet: '#f3f3f1', swatches: ['#f5f5f2', '#e0ddd6', '#8e9094', '#bda27e'] },
    floors: { living: ['concrete', 'porcelain_large'], bedroom: ['oak_plank', 'concrete'], wet: ['porcelain_white', 'porcelain_large'], kitchen: ['concrete', 'porcelain_large'], circulation: ['concrete'] },
    walls: { living: ['paint_white'], bedroom: ['paint_white', 'paint_greige'], wet: ['tile_subway_white', 'tile_grey_large'], kitchen: ['paint_white'], circulation: ['paint_white'] },
    accents: ['paint_greige', 'wp_grasscloth', 'paint_charcoal'], accentRooms: ['living'],
    lighting: { kelvin: 4000, fixtures: 'downlights', brightness: 1 }, decor: { art: false, rugs: false, curtains: false, plants: 1 },
  },
];

const BY_ID = new Map(DESIGN_STYLES.map((s) => [s.id, s]));

export const getStyle = (id: string | undefined): DesignStyle => (id && BY_ID.get(id)) || DESIGN_STYLES[0];

/** Pick from a list by variation number, wrapping around. */
export const pick = <T,>(list: T[], variation: number): T => list[((variation % list.length) + list.length) % list.length];

/** Which surface zone a room kind belongs to. */
export function zoneOf(kind: RoomKind): SurfaceZone {
  switch (kind) {
    case 'bathroom': case 'ensuite': case 'powder': case 'laundry': return 'wet';
    case 'kitchen': return 'kitchen';
    case 'master_bedroom': case 'bedroom': return 'bedroom';
    case 'foyer': case 'hall': case 'landing': case 'store': return 'circulation';
    default: return 'living';
  }
}
