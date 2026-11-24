export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export type AssetCategory = 'furniture' | 'infrastructure' | 'architectural';

/** Furniture, fixtures, lighting and decor used by the house designer (see src/house/assetSpecs.ts). */
export type HouseAssetType =
  // Living
  | 'sofa' | 'coffee_table' | 'side_table' | 'tv_unit' | 'bookshelf' | 'rug'
  // Dining and kitchen
  | 'dining_table' | 'dining_chair' | 'sideboard'
  | 'kitchen_base' | 'kitchen_upper' | 'kitchen_island' | 'fridge' | 'bar_stool'
  // Bedroom
  | 'bed_king' | 'bed_double' | 'bed_single' | 'bedside_table' | 'wardrobe' | 'dresser'
  // Bathroom and laundry
  | 'toilet' | 'vanity' | 'shower' | 'bathtub' | 'washer'
  // Lighting
  | 'ceiling_light' | 'pendant_light' | 'downlight' | 'floor_lamp' | 'wall_sconce'
  // Decor and structure
  | 'wall_art' | 'mirror' | 'curtain' | 'staircase';

export type AssetType = 
  | HouseAssetType
  // Infrastructure / Low-Current
  | 'ap'           // Access Point (AP - 12)
  | 'dp'           // Data Point (DP - 23)
  | 'tp'           // Telephone Point (TP - 8)
  | 'cctv'         // CCTV Camera (CCTV - 6)
  | 'door_access'  // Door Access (Door Access - 3)
  | 'intercom'     // Intercom (Intercom - 1)
  | 'power_outlet' // New Power Outlet Markings (Blue)
  | 'hdmi_port'    // HDMI Port
  | 'projector_port' // Projector Interface Port
  | 'projector'    // Ceiling-mounted projector
  | 'lcd_display'  // Wall-mounted LCD / flat-panel display
  // Furniture
  | 'desk_single'
  | 'desk_cluster_4'
  | 'desk_cluster_6'
  | 'conference_table'
  | 'chair_office'
  | 'chair_lounge'
  | 'reception_desk'
  | 'cabinet'
  | 'whiteboard'
  | 'projector_screen' // Wall / ceiling pull-down projection screen
  // Architectural
  | 'wall_straight'
  | 'glass_divider'
  | 'door_single'
  | 'plant_pot';

/** Room purpose. Drives default finishes, furniture and lighting in the house designer. */
export type RoomKind =
  | 'living' | 'dining' | 'kitchen' | 'foyer' | 'hall' | 'landing' | 'master_bedroom' | 'bedroom'
  | 'ensuite' | 'bathroom' | 'powder' | 'study' | 'laundry' | 'store';

/** A door, archway or window cut into one wall of a room. */
export interface Opening {
  /** Which wall of the room: north is -Z, south +Z, west -X, east +X. */
  wall: 'n' | 's' | 'e' | 'w';
  /** Centre of the opening measured from the start of the wall (west end for n/s, north end for e/w), in metres. */
  offset: number;
  width: number;
  kind: 'door' | 'arch' | 'window' | 'front_door';
}

/**
 * Layer an asset lives on. Only assets on the same layer can collide, and 'flat'
 * (rugs) never collide with anything.
 */
export type HeightLayer = 'ground' | 'ceiling' | 'port' | 'flat';

export function getAssetHeightLayer(type: AssetType): HeightLayer {
  if (type === 'ap' || type === 'cctv' || type === 'projector') {
    return 'ceiling';
  }
  const house = HOUSE_LAYERS[type as HouseAssetType];
  if (house) return house;
  if (
    type === 'dp' ||
    type === 'tp' ||
    type === 'power_outlet' ||
    type === 'hdmi_port' ||
    type === 'projector_port' ||
    type === 'lcd_display' ||
    type === 'projector_screen' ||
    type === 'door_access' ||
    type === 'intercom'
  ) {
    return 'port';
  }
  return 'ground';
}

/** Layer of each house asset type (kept here so getAssetHeightLayer has no import cycle). */
const HOUSE_LAYERS: Partial<Record<HouseAssetType, HeightLayer>> = {
  rug: 'flat',
  kitchen_upper: 'port', wall_art: 'port', mirror: 'port', curtain: 'port', wall_sconce: 'port',
  ceiling_light: 'ceiling', pendant_light: 'ceiling', downlight: 'ceiling',
};

export interface RoomDefinition {
  id: string;
  name: string;
  areaSqFt: number;
  color: string;
  // Box center and dimensions (in meters)
  x: number;
  z: number;
  width: number;
  depth: number;
  textColor?: string;
  // Optional explicit wall finish. When omitted it is derived from the room
  // name (see getRoomWallStyle) so imported / AI layouts still render sensibly.
  wallStyle?: 'glass' | 'concrete';
  /** Floor this room belongs to. Optional so pre-multi-floor designs still load. */
  levelId?: string;
  /** What the room is for (house designer). */
  kind?: RoomKind;
  /** Floor finish id from src/house/finishes.ts (tile, wood, stone...). */
  floorFinishId?: string;
  /** Wall finish id (paint, wallpaper or wall tile). */
  wallFinishId?: string;
  /** The wall furniture is arranged around (behind the bed or sofa). It takes the accent finish. */
  featureWall?: 'n' | 's' | 'e' | 'w';
  /** Optional feature wall: one wall with its own finish, usually a wallpaper. */
  accentWall?: { wall: 'n' | 's' | 'e' | 'w'; finishId: string };
  /** Wall height in metres; defaults to 2.4 for office rooms and 2.7 for house rooms. */
  wallHeight?: number;
  /** Doors, arches and windows. Rooms with openings or finishes are drawn as house rooms. */
  openings?: Opening[];
}

/** One storey of a building. Rooms and assets reference it by `levelId`. */
export interface Level {
  id: string;
  name: string;
  /** Floor-to-floor elevation of this level's slab above ground (metres). */
  elevation: number;
  /** Floor-to-ceiling height (metres). */
  height: number;
}

export interface PlacedAsset {
  id: string;
  type: AssetType;
  category: AssetCategory;
  name: string;
  position: Vector3D;
  rotationY: number; // In radians
  scale: Vector3D;
  color?: string;
  specs?: Record<string, string>;
  // For UI state
  assignedRoomId?: string;
  /** Floor this asset sits on. Optional so pre-multi-floor designs still load. */
  levelId?: string;
}
