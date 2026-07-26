export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export type AssetCategory = 'furniture' | 'infrastructure' | 'architectural';

export type AssetType = 
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
  // Architectural
  | 'wall_straight'
  | 'glass_divider'
  | 'door_single'
  | 'plant_pot';

export function getAssetHeightLayer(type: AssetType): 'ground' | 'ceiling' | 'port' {
  if (type === 'ap' || type === 'cctv') {
    return 'ceiling';
  }
  if (
    type === 'dp' ||
    type === 'tp' ||
    type === 'power_outlet' ||
    type === 'hdmi_port' ||
    type === 'projector_port' ||
    type === 'door_access' ||
    type === 'intercom'
  ) {
    return 'port';
  }
  return 'ground';
}

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
}
