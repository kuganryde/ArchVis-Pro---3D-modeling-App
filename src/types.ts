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

export interface ZohoCreatorConfig {
  formId: string;
  appName: string;
  ownerName: string;
  fieldMappings: {
    deviceId: string;
    deviceName: string;
    deviceType: string;
    roomName: string;
    coordinates: string;
  };
}
