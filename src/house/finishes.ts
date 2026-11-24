/**
 * Surface finishes for the house designer: floor tiles and timber, wall paints,
 * wall tiles and wallpapers. Pure data: src/three/finishTextures.ts draws each
 * pattern, and the cost per square metre feeds the finish schedule.
 *
 * `tile` is the real size in metres of one repeat of the pattern, so a 60 cm tile
 * really is 60 cm on screen whatever the room size.
 */

export type FinishPattern =
  | 'solid' | 'grid' | 'brick' | 'herringbone' | 'plank' | 'hex' | 'checker' | 'terrazzo' | 'marble'
  | 'stripe' | 'floral' | 'geometric' | 'damask' | 'grasscloth' | 'chevron' | 'fan' | 'zellige' | 'slat';

export type FinishKind = 'tile' | 'wood' | 'stone' | 'concrete' | 'carpet' | 'paint' | 'wallpaper' | 'panel';
export type FinishSurface = 'floor' | 'wall';

export interface Finish {
  id: string;
  name: string;
  surface: FinishSurface;
  kind: FinishKind;
  pattern: FinishPattern;
  /** Base colour first, then pattern colours (grout, veins, motif...). */
  colors: string[];
  /** Metres covered by one repeat of the pattern, [width, height]. */
  tile: [number, number];
  roughness: number;
  metalness?: number;
  /** Safe in bathrooms, kitchens and other wet areas. */
  wet?: boolean;
  /** Indicative USD per square metre, supplied and fitted. */
  pricePerSqm: number;
}

const f = (x: Finish): Finish => x;

export const FLOOR_FINISHES: Finish[] = [
  f({ id: 'porcelain_white', name: 'White Porcelain 60x60', surface: 'floor', kind: 'tile', pattern: 'grid', colors: ['#f2f1ee', '#d4d2cc'], tile: [0.6, 0.6], roughness: 0.25, wet: true, pricePerSqm: 55 }),
  f({ id: 'porcelain_grey', name: 'Grey Porcelain 60x60', surface: 'floor', kind: 'tile', pattern: 'grid', colors: ['#9ea3a8', '#7d8288'], tile: [0.6, 0.6], roughness: 0.3, wet: true, pricePerSqm: 55 }),
  f({ id: 'porcelain_large', name: 'Large Format Porcelain 120x60', surface: 'floor', kind: 'tile', pattern: 'grid', colors: ['#d9d6d0', '#c4c0b8'], tile: [1.2, 0.6], roughness: 0.2, wet: true, pricePerSqm: 78 }),
  f({ id: 'marble_white', name: 'Carrara Marble', surface: 'floor', kind: 'stone', pattern: 'marble', colors: ['#f4f4f2', '#a8aab0', '#d8d8d6'], tile: [0.8, 0.8], roughness: 0.12, wet: true, pricePerSqm: 160 }),
  f({ id: 'marble_black', name: 'Nero Marquina Marble', surface: 'floor', kind: 'stone', pattern: 'marble', colors: ['#1a1a1c', '#e8e8e8', '#4a4a50'], tile: [0.8, 0.8], roughness: 0.12, wet: true, pricePerSqm: 190 }),
  f({ id: 'terrazzo', name: 'Terrazzo', surface: 'floor', kind: 'stone', pattern: 'terrazzo', colors: ['#ece8e0', '#c46a4c', '#5b6b7a', '#e0b44c'], tile: [0.6, 0.6], roughness: 0.3, wet: true, pricePerSqm: 120 }),
  f({ id: 'encaustic_hex', name: 'Encaustic Hex Tile', surface: 'floor', kind: 'tile', pattern: 'hex', colors: ['#2f4f4f', '#f1ebdd', '#c9a24a'], tile: [0.3, 0.52], roughness: 0.35, wet: true, pricePerSqm: 95 }),
  f({ id: 'checker_bw', name: 'Black & White Checker', surface: 'floor', kind: 'tile', pattern: 'checker', colors: ['#f5f5f3', '#1f1f22'], tile: [0.6, 0.6], roughness: 0.25, wet: true, pricePerSqm: 70 }),
  f({ id: 'travertine', name: 'Honed Travertine', surface: 'floor', kind: 'stone', pattern: 'grid', colors: ['#e3d6bf', '#c9b895'], tile: [0.6, 0.4], roughness: 0.5, wet: true, pricePerSqm: 110 }),
  f({ id: 'slate', name: 'Natural Slate', surface: 'floor', kind: 'stone', pattern: 'grid', colors: ['#4b5258', '#2f353a'], tile: [0.6, 0.3], roughness: 0.6, wet: true, pricePerSqm: 85 }),
  f({ id: 'oak_plank', name: 'Natural Oak Planks', surface: 'floor', kind: 'wood', pattern: 'plank', colors: ['#c9a273', '#a8814f', '#dcbb90'], tile: [1.2, 0.18], roughness: 0.5, pricePerSqm: 70 }),
  f({ id: 'oak_chevron', name: 'Oak Chevron Parquet', surface: 'floor', kind: 'wood', pattern: 'chevron', colors: ['#c19a6b', '#9a7547', '#d6b484'], tile: [0.6, 0.6], roughness: 0.5, pricePerSqm: 130 }),
  f({ id: 'walnut_plank', name: 'Walnut Planks', surface: 'floor', kind: 'wood', pattern: 'plank', colors: ['#6b4a33', '#4f3425', '#85604a'], tile: [1.2, 0.2], roughness: 0.45, pricePerSqm: 120 }),
  f({ id: 'grey_wood', name: 'Washed Grey Planks', surface: 'floor', kind: 'wood', pattern: 'plank', colors: ['#a9a6a0', '#8d8a84', '#c0bdb6'], tile: [1.2, 0.18], roughness: 0.55, pricePerSqm: 65 }),
  f({ id: 'concrete', name: 'Polished Concrete', surface: 'floor', kind: 'concrete', pattern: 'solid', colors: ['#a6a8a8', '#929494'], tile: [1.5, 1.5], roughness: 0.4, wet: true, pricePerSqm: 60 }),
  f({ id: 'carpet_oat', name: 'Oatmeal Carpet', surface: 'floor', kind: 'carpet', pattern: 'grasscloth', colors: ['#cfc6b6', '#b9ae9a'], tile: [0.5, 0.5], roughness: 0.95, pricePerSqm: 45 }),
];

export const WALL_FINISHES: Finish[] = [
  // Paints
  f({ id: 'paint_white', name: 'Pure White', surface: 'wall', kind: 'paint', pattern: 'solid', colors: ['#f5f5f2'], tile: [1, 1], roughness: 0.9, pricePerSqm: 9 }),
  f({ id: 'paint_warm_white', name: 'Warm White', surface: 'wall', kind: 'paint', pattern: 'solid', colors: ['#f1ebe0'], tile: [1, 1], roughness: 0.9, pricePerSqm: 9 }),
  f({ id: 'paint_greige', name: 'Greige', surface: 'wall', kind: 'paint', pattern: 'solid', colors: ['#d3cbbf'], tile: [1, 1], roughness: 0.9, pricePerSqm: 9 }),
  f({ id: 'paint_sage', name: 'Sage Green', surface: 'wall', kind: 'paint', pattern: 'solid', colors: ['#a9b8a0'], tile: [1, 1], roughness: 0.9, pricePerSqm: 10 }),
  f({ id: 'paint_navy', name: 'Deep Navy', surface: 'wall', kind: 'paint', pattern: 'solid', colors: ['#27384f'], tile: [1, 1], roughness: 0.85, pricePerSqm: 11 }),
  f({ id: 'paint_terracotta', name: 'Terracotta', surface: 'wall', kind: 'paint', pattern: 'solid', colors: ['#c27a5a'], tile: [1, 1], roughness: 0.9, pricePerSqm: 10 }),
  f({ id: 'paint_charcoal', name: 'Charcoal', surface: 'wall', kind: 'paint', pattern: 'solid', colors: ['#3b3e43'], tile: [1, 1], roughness: 0.85, pricePerSqm: 11 }),
  f({ id: 'paint_blush', name: 'Soft Blush', surface: 'wall', kind: 'paint', pattern: 'solid', colors: ['#e6cbc4'], tile: [1, 1], roughness: 0.9, pricePerSqm: 10 }),
  f({ id: 'paint_mustard', name: 'Mustard', surface: 'wall', kind: 'paint', pattern: 'solid', colors: ['#cf9f3a'], tile: [1, 1], roughness: 0.9, pricePerSqm: 10 }),
  f({ id: 'paint_sky', name: 'Sea Mist Blue', surface: 'wall', kind: 'paint', pattern: 'solid', colors: ['#bfd3dc'], tile: [1, 1], roughness: 0.9, pricePerSqm: 10 }),
  // Wall tiles (wet areas and splashbacks)
  f({ id: 'tile_subway_white', name: 'White Subway Tile', surface: 'wall', kind: 'tile', pattern: 'brick', colors: ['#f4f4f2', '#d0d0cc'], tile: [0.15, 0.15], roughness: 0.15, wet: true, pricePerSqm: 48 }),
  f({ id: 'tile_zellige_green', name: 'Green Zellige Tile', surface: 'wall', kind: 'tile', pattern: 'zellige', colors: ['#3f7d6b', '#2d5e50', '#5a9a86'], tile: [0.2, 0.2], roughness: 0.1, wet: true, pricePerSqm: 130 }),
  f({ id: 'tile_marble_wall', name: 'Marble Slab Wall', surface: 'wall', kind: 'stone', pattern: 'marble', colors: ['#f2f2f0', '#9a9ca2', '#d5d5d3'], tile: [1.2, 0.6], roughness: 0.12, wet: true, pricePerSqm: 170 }),
  f({ id: 'tile_grey_large', name: 'Large Grey Wall Tile', surface: 'wall', kind: 'tile', pattern: 'grid', colors: ['#b8bbbe', '#9fa3a6'], tile: [0.6, 0.3], roughness: 0.2, wet: true, pricePerSqm: 58 }),
  f({ id: 'tile_terracotta', name: 'Terracotta Brick Tile', surface: 'wall', kind: 'tile', pattern: 'brick', colors: ['#b5603f', '#7a3f29'], tile: [0.22, 0.22], roughness: 0.6, wet: true, pricePerSqm: 62 }),
  // Wallpapers
  f({ id: 'wp_stripe_navy', name: 'Navy Pinstripe Wallpaper', surface: 'wall', kind: 'wallpaper', pattern: 'stripe', colors: ['#f1ece2', '#2d4263'], tile: [0.2, 0.2], roughness: 0.8, pricePerSqm: 28 }),
  f({ id: 'wp_stripe_sage', name: 'Sage Stripe Wallpaper', surface: 'wall', kind: 'wallpaper', pattern: 'stripe', colors: ['#e8ece1', '#9db08d'], tile: [0.25, 0.25], roughness: 0.8, pricePerSqm: 28 }),
  f({ id: 'wp_floral_botanical', name: 'Botanical Floral Wallpaper', surface: 'wall', kind: 'wallpaper', pattern: 'floral', colors: ['#e9efe6', '#5f8a6a', '#d98a8a'], tile: [0.6, 0.6], roughness: 0.8, pricePerSqm: 42 }),
  f({ id: 'wp_floral_blush', name: 'Blush Bloom Wallpaper', surface: 'wall', kind: 'wallpaper', pattern: 'floral', colors: ['#f3e3df', '#c98a8e', '#7d9a7a'], tile: [0.6, 0.6], roughness: 0.8, pricePerSqm: 42 }),
  f({ id: 'wp_geometric_gold', name: 'Gold Geometric Wallpaper', surface: 'wall', kind: 'wallpaper', pattern: 'geometric', colors: ['#1f2a3a', '#c9a24a'], tile: [0.3, 0.3], roughness: 0.5, metalness: 0.3, pricePerSqm: 55 }),
  f({ id: 'wp_geometric_grey', name: 'Grey Geometric Wallpaper', surface: 'wall', kind: 'wallpaper', pattern: 'geometric', colors: ['#e6e6e4', '#a8abb0'], tile: [0.3, 0.3], roughness: 0.8, pricePerSqm: 32 }),
  f({ id: 'wp_damask_grey', name: 'Grey Damask Wallpaper', surface: 'wall', kind: 'wallpaper', pattern: 'damask', colors: ['#d9d8d4', '#b0aea8'], tile: [0.5, 0.5], roughness: 0.7, pricePerSqm: 46 }),
  f({ id: 'wp_damask_teal', name: 'Teal Damask Wallpaper', surface: 'wall', kind: 'wallpaper', pattern: 'damask', colors: ['#2c5a5e', '#4f8286'], tile: [0.5, 0.5], roughness: 0.7, pricePerSqm: 48 }),
  f({ id: 'wp_grasscloth', name: 'Natural Grasscloth', surface: 'wall', kind: 'wallpaper', pattern: 'grasscloth', colors: ['#cdbf9f', '#b3a37e'], tile: [0.4, 0.4], roughness: 0.95, pricePerSqm: 60 }),
  f({ id: 'wp_chevron_teal', name: 'Teal Chevron Wallpaper', surface: 'wall', kind: 'wallpaper', pattern: 'chevron', colors: ['#f0efe9', '#3c7f86'], tile: [0.3, 0.3], roughness: 0.8, pricePerSqm: 34 }),
  f({ id: 'wp_deco_fan', name: 'Art Deco Fan Wallpaper', surface: 'wall', kind: 'wallpaper', pattern: 'fan', colors: ['#14323a', '#d4b062'], tile: [0.4, 0.4], roughness: 0.5, metalness: 0.3, pricePerSqm: 62 }),
  f({ id: 'wp_slat_oak', name: 'Oak Slat Panelling', surface: 'wall', kind: 'panel', pattern: 'slat', colors: ['#c9a273', '#8f6a42'], tile: [0.24, 0.24], roughness: 0.55, pricePerSqm: 95 }),
];

export const ALL_FINISHES: Finish[] = [...FLOOR_FINISHES, ...WALL_FINISHES];

const BY_ID = new Map(ALL_FINISHES.map((x) => [x.id, x]));

export const getFinish = (id: string | undefined): Finish | undefined => (id ? BY_ID.get(id) : undefined);

/** Colour used for a finish in flat previews (floor plans, swatches). */
export const finishSwatch = (id: string | undefined, fallback = '#e5e7eb'): string =>
  getFinish(id)?.colors[0] ?? fallback;
