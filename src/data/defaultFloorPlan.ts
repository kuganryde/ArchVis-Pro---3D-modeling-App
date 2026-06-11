import { RoomDefinition, PlacedAsset } from '../types';

export const DEFAULT_ROOMS: RoomDefinition[] = [
  {
    id: 'long_meeting',
    name: 'Long Meeting Room (60 Pax)',
    areaSqFt: 1100,
    color: '#ecfdf5', // Soft teal-green
    x: -12.5,
    z: 0.0,
    width: 6.2,
    depth: 16.5,
    textColor: '#065f46'
  },
  {
    id: 'reception',
    name: 'Reception & Waiting Area',
    areaSqFt: 160,
    color: '#fffbeb', // Warm amber-cream
    x: -7.5,
    z: 6.0,
    width: 3.8,
    depth: 3.8,
    textColor: '#92400e'
  },
  {
    id: 'discussion_5',
    name: 'Discussion Pod 5',
    areaSqFt: 85,
    color: '#f0fdf4',
    x: -6.5,
    z: -6.6,
    width: 3.0,
    depth: 2.2,
    textColor: '#166534'
  },
  {
    id: 'discussion_4',
    name: 'Discussion Pod 4',
    areaSqFt: 85,
    color: '#f0fdf4',
    x: -6.2,
    z: -4.0,
    width: 3.0,
    depth: 2.2,
    textColor: '#166534'
  },
  {
    id: 'discussion_3',
    name: 'Discussion Pod 3',
    areaSqFt: 85,
    color: '#f0fdf4',
    x: -6.0,
    z: -1.5,
    width: 3.0,
    depth: 2.2,
    textColor: '#166534'
  },
  {
    id: 'discussion_2',
    name: 'Discussion 2 (Meeting Room)',
    areaSqFt: 110,
    color: '#f0fdf4',
    x: -6.0,
    z: 1.0,
    width: 3.0,
    depth: 2.4,
    textColor: '#166534'
  },
  {
    id: 'discussion_1',
    name: 'Discussion 1 & Store',
    areaSqFt: 120,
    color: '#f4f4f5',
    x: -6.5,
    z: 3.6,
    width: 3.0,
    depth: 2.4,
    textColor: '#52525b'
  },
  {
    id: 'open_workspace',
    name: 'Open Working Area (1455 SQFT)',
    areaSqFt: 1455,
    color: '#f0f9ff', // Soft azure-blue
    x: 1.0,
    z: 0.2,
    width: 10.5,
    depth: 14.8,
    textColor: '#075985'
  },
  {
    id: 'finance_hr',
    name: 'Finance & HR (10 PAX, 510 SQFT)',
    areaSqFt: 510,
    color: '#faf5ff', // Soft violetes
    x: 8.5,
    z: -4.2,
    width: 4.8,
    depth: 5.6,
    textColor: '#6b21a8'
  },
  {
    id: 'admins_room',
    name: 'Admin\'s Room (123 SQFT)',
    areaSqFt: 123,
    color: '#fdf2f8', // Soft pinkish
    x: 12.6,
    z: -6.1,
    width: 3.4,
    depth: 3.4,
    textColor: '#9d174d'
  },
  {
    id: 'gm_room',
    name: 'G.M.\'s Room (220 SQFT)',
    areaSqFt: 220,
    color: '#eff6ff',
    x: 16.0,
    z: -5.0,
    width: 3.4,
    depth: 5.4,
    textColor: '#1e40af'
  },
  {
    id: 'store_120',
    name: 'Store Room (120 SQFT)',
    areaSqFt: 120,
    color: '#f5f5f4',
    x: 12.6,
    z: 2.5,
    width: 3.4,
    depth: 3.8,
    textColor: '#44403c'
  },
  {
    id: 'packing_discussion',
    name: 'Packing & Discussion Area (192 SQFT)',
    areaSqFt: 192,
    color: '#fdf4ff',
    x: 16.0,
    z: 2.5,
    width: 3.4,
    depth: 3.8,
    textColor: '#86198f'
  },
  {
    id: 'server_room',
    name: 'Server Room',
    areaSqFt: 110,
    color: '#fef2f2', // Soft red
    x: 6.0,
    z: 6.8,
    width: 3.2,
    depth: 2.4,
    textColor: '#991b1b'
  },
  {
    id: 'prayer_room',
    name: 'Prayer Room (Ladies)',
    areaSqFt: 100,
    color: '#ecfdf5',
    x: 9.2,
    z: 6.8,
    width: 3.2,
    depth: 2.4,
    textColor: '#065f46'
  },
  {
    id: 'large_store_bottom',
    name: 'Main Store Room',
    areaSqFt: 350,
    color: '#fafaf9',
    x: 15.0,
    z: 6.8,
    width: 8.0,
    depth: 2.4,
    textColor: '#44403c'
  }
];

export const DEFAULT_ASSETS: PlacedAsset[] = [
  // ==========================================
  // ACCESS POINTS (AP - 12)
  // ==========================================
  {
    id: 'ap_1',
    type: 'ap',
    category: 'infrastructure',
    name: 'Access Point AP-01',
    position: { x: -12.5, y: 3.2, z: -5.5 },
    rotationY: 0,
    scale: { x: 0.6, y: 0.15, z: 0.6 },
    assignedRoomId: 'long_meeting',
    specs: { model: 'Aruba AP-535', Mac: '00:1A:2B:3C:D4:01', Frequency: '2.4 / 5 GHz Dual', Power: 'PoE+ 802.3at' }
  },
  {
    id: 'ap_2',
    type: 'ap',
    category: 'infrastructure',
    name: 'Access Point AP-02',
    position: { x: -12.5, y: 3.2, z: 5.5 },
    rotationY: 0,
    scale: { x: 0.6, y: 0.15, z: 0.6 },
    assignedRoomId: 'long_meeting',
    specs: { model: 'Aruba AP-535', Mac: '00:1A:2B:3C:D4:02', Frequency: '2.4 / 5 GHz Dual', Power: 'PoE+ 802.3at' }
  },
  {
    id: 'ap_3',
    type: 'ap',
    category: 'infrastructure',
    name: 'Access Point AP-03',
    position: { x: -7.5, y: 3.2, z: 5.5 },
    rotationY: 0,
    scale: { x: 0.6, y: 0.15, z: 0.6 },
    assignedRoomId: 'reception',
    specs: { model: 'Aruba AP-535', Mac: '00:1A:2B:3C:D4:03', Frequency: '2.4 / 5 GHz Dual', Power: 'PoE' }
  },
  {
    id: 'ap_4',
    type: 'ap',
    category: 'infrastructure',
    name: 'Access Point AP-04',
    position: { x: -6.5, y: 3.2, z: -6.6 },
    rotationY: 0,
    scale: { x: 0.6, y: 0.15, z: 0.6 },
    assignedRoomId: 'discussion_5',
    specs: { model: 'Aruba AP-515', Mac: '00:1A:2B:3C:D4:04', Frequency: '2.4 / 5 GHz', Power: 'PoE' }
  },
  {
    id: 'ap_5',
    type: 'ap',
    category: 'infrastructure',
    name: 'Access Point AP-05',
    position: { x: -6.0, y: 3.2, z: -1.5 },
    rotationY: 0,
    scale: { x: 0.6, y: 0.15, z: 0.6 },
    assignedRoomId: 'discussion_3',
    specs: { model: 'Aruba AP-515', Mac: '00:1A:2B:3C:D4:05', Frequency: '2.4 / 5 GHz', Power: 'PoE' }
  },
  {
    id: 'ap_6',
    type: 'ap',
    category: 'infrastructure',
    name: 'Access Point AP-06',
    position: { x: -2.0, y: 3.2, z: -4.0 },
    rotationY: 0,
    scale: { x: 0.6, y: 0.15, z: 0.6 },
    assignedRoomId: 'open_workspace',
    specs: { model: 'Aruba AP-535', Mac: '00:1A:2B:3C:D4:06', Frequency: '2.4 / 5 GHz', Power: 'PoE+' }
  },
  {
    id: 'ap_7',
    type: 'ap',
    category: 'infrastructure',
    name: 'Access Point AP-07',
    position: { x: 1.0, y: 3.2, z: 1.5 },
    rotationY: 0,
    scale: { x: 0.6, y: 0.15, z: 0.6 },
    assignedRoomId: 'open_workspace',
    specs: { model: 'Aruba AP-535', Mac: '00:1A:2B:3C:D4:07', Frequency: '2.4 / 5 GHz', Power: 'PoE+' }
  },
  {
    id: 'ap_8',
    type: 'ap',
    category: 'infrastructure',
    name: 'Access Point AP-08',
    position: { x: 4.0, y: 3.2, z: -3.0 },
    rotationY: 0,
    scale: { x: 0.6, y: 0.15, z: 0.6 },
    assignedRoomId: 'open_workspace',
    specs: { model: 'Aruba AP-535', Mac: '00:1A:2B:3C:D4:08', Frequency: '2.4 / 5 GHz', Power: 'PoE+' }
  },
  {
    id: 'ap_9',
    type: 'ap',
    category: 'infrastructure',
    name: 'Access Point AP-09',
    position: { x: 8.5, y: 3.2, z: -4.2 },
    rotationY: 0,
    scale: { x: 0.6, y: 0.15, z: 0.6 },
    assignedRoomId: 'finance_hr',
    specs: { model: 'Aruba AP-535', Mac: '00:1A:2B:3C:D4:09', Frequency: '2.4 / 5 GHz', Power: 'PoE+' }
  },
  {
    id: 'ap_10',
    type: 'ap',
    category: 'infrastructure',
    name: 'Access Point AP-10',
    position: { x: 16.0, y: 3.2, z: -5.0 },
    rotationY: 0,
    scale: { x: 0.6, y: 0.15, z: 0.6 },
    assignedRoomId: 'gm_room',
    specs: { model: 'Aruba AP-515', Mac: '00:1A:2B:3C:D4:10', Frequency: '2.4 / 5 GHz', Power: 'PoE' }
  },
  {
    id: 'ap_11',
    type: 'ap',
    category: 'infrastructure',
    name: 'Access Point AP-11',
    position: { x: 6.0, y: 3.2, z: 6.8 },
    rotationY: 0,
    scale: { x: 0.6, y: 0.15, z: 0.6 },
    assignedRoomId: 'server_room',
    specs: { model: 'Aruba AP-535', Mac: '00:1A:2B:3C:D4:11', Frequency: '2.4 / 5 GHz', Power: 'PoE+' }
  },
  {
    id: 'ap_12',
    type: 'ap',
    category: 'infrastructure',
    name: 'Access Point AP-12',
    position: { x: 16.0, y: 3.2, z: 2.5 },
    rotationY: 0,
    scale: { x: 0.6, y: 0.15, z: 0.6 },
    assignedRoomId: 'packing_discussion',
    specs: { model: 'Aruba AP-515', Mac: '00:1A:2B:3C:D4:12', Frequency: '2.4 / 5 GHz', Power: 'PoE' }
  },

  // ==========================================
  // DATA POINTS (DP - 23)
  // ==========================================
  {
    id: 'dp_1', type: 'dp', category: 'infrastructure', name: 'Data Point DP-01',
    position: { x: -15.0, y: 0.8, z: -7.5 }, rotationY: 0, scale: { x: 0.2, y: 0.2, z: 0.2 },
    assignedRoomId: 'long_meeting', specs: { ID: 'LM-DP-01', Port: 'A-01', Status: 'Active', Category: 'Cat6' }
  },
  {
    id: 'dp_2', type: 'dp', category: 'infrastructure', name: 'Data Point DP-02',
    position: { x: -15.0, y: 0.8, z: 0.0 }, rotationY: 0, scale: { x: 0.2, y: 0.2, z: 0.2 },
    assignedRoomId: 'long_meeting', specs: { ID: 'LM-DP-02', Port: 'A-02', Status: 'Active', Category: 'Cat6' }
  },
  {
    id: 'dp_3', type: 'dp', category: 'infrastructure', name: 'Data Point DP-03',
    position: { x: -15.0, y: 0.8, z: 7.5 }, rotationY: 0, scale: { x: 0.2, y: 0.2, z: 0.2 },
    assignedRoomId: 'long_meeting', specs: { ID: 'LM-DP-03', Port: 'A-03', Status: 'Inactive', Category: 'Cat6' }
  },
  {
    id: 'dp_4', type: 'dp', category: 'infrastructure', name: 'Data Point DP-04',
    position: { x: -7.5, y: 0.8, z: -6.6 }, rotationY: 0, scale: { x: 0.2, y: 0.2, z: 0.2 },
    assignedRoomId: 'discussion_5', specs: { ID: 'DSC-DP-01', Port: 'B-01', Status: 'Active', Category: 'Cat6a' }
  },
  {
    id: 'dp_5', type: 'dp', category: 'infrastructure', name: 'Data Point DP-05',
    position: { x: -7.2, y: 0.8, z: -4.0 }, rotationY: 0, scale: { x: 0.2, y: 0.2, z: 0.2 },
    assignedRoomId: 'discussion_4', specs: { ID: 'DSC-DP-02', Port: 'B-02', Status: 'Active', Category: 'Cat6a' }
  },
  {
    id: 'dp_6', type: 'dp', category: 'infrastructure', name: 'Data Point DP-06',
    position: { x: -7.0, y: 0.8, z: -1.5 }, rotationY: 0, scale: { x: 0.2, y: 0.2, z: 0.2 },
    assignedRoomId: 'discussion_3', specs: { ID: 'DSC-DP-03', Port: 'B-03', Status: 'Active', Category: 'Cat6a' }
  },
  {
    id: 'dp_7', type: 'dp', category: 'infrastructure', name: 'Data Point DP-07',
    position: { x: -7.0, y: 0.8, z: 1.0 }, rotationY: 0, scale: { x: 0.2, y: 0.2, z: 0.2 },
    assignedRoomId: 'discussion_2', specs: { ID: 'DSC-DP-04', Port: 'B-04', Status: 'Active', Category: 'Cat6a' }
  },
  {
    id: 'dp_8', type: 'dp', category: 'infrastructure', name: 'Data Point DP-08',
    position: { x: -7.5, y: 0.8, z: 3.6 }, rotationY: 0, scale: { x: 0.2, y: 0.2, z: 0.2 },
    assignedRoomId: 'discussion_1', specs: { ID: 'DSC-DP-05', Port: 'B-05', Status: 'Active', Category: 'Cat6' }
  },
  {
    id: 'dp_9', type: 'dp', category: 'infrastructure', name: 'Data Point DP-09',
    position: { x: -8.5, y: 0.8, z: 6.5 }, rotationY: 0, scale: { x: 0.2, y: 0.2, z: 0.2 },
    assignedRoomId: 'reception', specs: { ID: 'REC-DP-01', Port: 'C-01', Status: 'Active', Category: 'Cat6' }
  },
  {
    id: 'dp_10', type: 'dp', category: 'infrastructure', name: 'Data Point DP-10',
    position: { x: -2.0, y: 0.8, z: -3.5 }, rotationY: 0, scale: { x: 0.2, y: 0.2, z: 0.2 },
    assignedRoomId: 'open_workspace', specs: { ID: 'OW-DP-01', Port: 'D-01', Status: 'Active', Category: 'Cat6' }
  },
  {
    id: 'dp_11', type: 'dp', category: 'infrastructure', name: 'Data Point DP-11',
    position: { x: -2.0, y: 0.8, z: -1.5 }, rotationY: 0, scale: { x: 0.2, y: 0.2, z: 0.2 },
    assignedRoomId: 'open_workspace', specs: { ID: 'OW-DP-02', Port: 'D-02', Status: 'Active', Category: 'Cat6' }
  },
  {
    id: 'dp_12', type: 'dp', category: 'infrastructure', name: 'Data Point DP-12',
    position: { x: 1.0, y: 0.8, z: -3.5 }, rotationY: 0, scale: { x: 0.2, y: 0.2, z: 0.2 },
    assignedRoomId: 'open_workspace', specs: { ID: 'OW-DP-03', Port: 'D-03', Status: 'Active', Category: 'Cat6' }
  },
  {
    id: 'dp_13', type: 'dp', category: 'infrastructure', name: 'Data Point DP-13',
    position: { x: 1.0, y: 0.8, z: -1.5 }, rotationY: 0, scale: { x: 0.2, y: 0.2, z: 0.2 },
    assignedRoomId: 'open_workspace', specs: { ID: 'OW-DP-04', Port: 'D-04', Status: 'Active', Category: 'Cat6' }
  },
  {
    id: 'dp_14', type: 'dp', category: 'infrastructure', name: 'Data Point DP-14',
    position: { x: 4.0, y: 0.8, z: -3.5 }, rotationY: 0, scale: { x: 0.2, y: 0.2, z: 0.2 },
    assignedRoomId: 'open_workspace', specs: { ID: 'OW-DP-05', Port: 'D-05', Status: 'Active', Category: 'Cat6' }
  },
  {
    id: 'dp_15', type: 'dp', category: 'infrastructure', name: 'Data Point DP-15',
    position: { x: 4.0, y: 0.8, z: -1.5 }, rotationY: 0, scale: { x: 0.2, y: 0.2, z: 0.2 },
    assignedRoomId: 'open_workspace', specs: { ID: 'OW-DP-06', Port: 'D-06', Status: 'Inactive', Category: 'Cat6' }
  },
  {
    id: 'dp_16', type: 'dp', category: 'infrastructure', name: 'Data Point DP-16',
    position: { x: 1.0, y: 0.8, z: 4.0 }, rotationY: 0, scale: { x: 0.2, y: 0.2, z: 0.2 },
    assignedRoomId: 'open_workspace', specs: { ID: 'OW-DP-07', Port: 'D-07', Status: 'Active', Category: 'Cat6' }
  },
  {
    id: 'dp_17', type: 'dp', category: 'infrastructure', name: 'Data Point DP-17',
    position: { x: 4.0, y: 0.8, z: 4.0 }, rotationY: 0, scale: { x: 0.2, y: 0.2, z: 0.2 },
    assignedRoomId: 'open_workspace', specs: { ID: 'OW-DP-08', Port: 'D-08', Status: 'Active', Category: 'Cat6' }
  },
  {
    id: 'dp_18', type: 'dp', category: 'infrastructure', name: 'Data Point DP-18',
    position: { x: 7.5, y: 0.8, z: -4.5 }, rotationY: 0, scale: { x: 0.2, y: 0.2, z: 0.2 },
    assignedRoomId: 'finance_hr', specs: { ID: 'FIN-DP-01', Port: 'E-01', Status: 'Active', Category: 'Cat6a' }
  },
  {
    id: 'dp_19', type: 'dp', category: 'infrastructure', name: 'Data Point DP-19',
    position: { x: 9.5, y: 0.8, z: -4.5 }, rotationY: 0, scale: { x: 0.2, y: 0.2, z: 0.2 },
    assignedRoomId: 'finance_hr', specs: { ID: 'FIN-DP-02', Port: 'E-02', Status: 'Active', Category: 'Cat6a' }
  },
  {
    id: 'dp_20', type: 'dp', category: 'infrastructure', name: 'Data Point DP-20',
    position: { x: 12.6, y: 0.8, z: -6.1 }, rotationY: 0, scale: { x: 0.2, y: 0.2, z: 0.2 },
    assignedRoomId: 'admins_room', specs: { ID: 'ADM-DP-01', Port: 'F-01', Status: 'Active', Category: 'Cat6' }
  },
  {
    id: 'dp_21', type: 'dp', category: 'infrastructure', name: 'Data Point DP-21',
    position: { x: 16.0, y: 0.8, z: -5.5 }, rotationY: 0, scale: { x: 0.2, y: 0.2, z: 0.2 },
    assignedRoomId: 'gm_room', specs: { ID: 'GMR-DP-01', Port: 'G-01', Status: 'Active', Category: 'Cat6a' }
  },
  {
    id: 'dp_22', type: 'dp', category: 'infrastructure', name: 'Data Point DP-22',
    position: { x: 6.0, y: 0.8, z: 6.8 }, rotationY: 0, scale: { x: 0.2, y: 0.2, z: 0.2 },
    assignedRoomId: 'server_room', specs: { ID: 'SRV-DP-01', Port: 'S-01', Status: 'Active', Category: 'Cat7a' }
  },
  {
    id: 'dp_23', type: 'dp', category: 'infrastructure', name: 'Data Point DP-23',
    position: { x: 16.0, y: 0.8, z: 2.5 }, rotationY: 0, scale: { x: 0.2, y: 0.2, z: 0.2 },
    assignedRoomId: 'packing_discussion', specs: { ID: 'PAK-DP-01', Port: 'H-01', Status: 'Active', Category: 'Cat6' }
  },

  // ==========================================
  // TELEPHONE POINTS (TP - 8)
  // ==========================================
  {
    id: 'tp_1', type: 'tp', category: 'infrastructure', name: 'Telephone Point TP-01',
    position: { x: -8.0, y: 0.8, z: 5.5 }, rotationY: 0, scale: { x: 0.2, y: 0.2, z: 0.2 },
    assignedRoomId: 'reception', specs: { ID: 'TP-REC-01', LineNumber: 'Ext 101', Type: 'VoIP' }
  },
  {
    id: 'tp_2', type: 'tp', category: 'infrastructure', name: 'Telephone Point TP-02',
    position: { x: -2.0, y: 0.8, z: -2.5 }, rotationY: 0, scale: { x: 0.2, y: 0.2, z: 0.2 },
    assignedRoomId: 'open_workspace', specs: { ID: 'TP-OW-01', LineNumber: 'Ext 124', Type: 'VoIP' }
  },
  {
    id: 'tp_3', type: 'tp', category: 'infrastructure', name: 'Telephone Point TP-03',
    position: { x: 1.0, y: 0.8, z: -2.5 }, rotationY: 0, scale: { x: 0.2, y: 0.2, z: 0.2 },
    assignedRoomId: 'open_workspace', specs: { ID: 'TP-OW-02', LineNumber: 'Ext 125', Type: 'VoIP' }
  },
  {
    id: 'tp_4', type: 'tp', category: 'infrastructure', name: 'Telephone Point TP-04',
    position: { x: 8.5, y: 0.8, z: -3.5 }, rotationY: 0, scale: { x: 0.2, y: 0.2, z: 0.2 },
    assignedRoomId: 'finance_hr', specs: { ID: 'TP-FIN-01', LineNumber: 'Ext 110', Type: 'VoIP' }
  },
  {
    id: 'tp_5', type: 'tp', category: 'infrastructure', name: 'Telephone Point TP-05',
    position: { x: 12.6, y: 0.8, z: -5.5 }, rotationY: 0, scale: { x: 0.2, y: 0.2, z: 0.2 },
    assignedRoomId: 'admins_room', specs: { ID: 'TP-ADM-01', LineNumber: 'Ext 105', Type: 'VoIP' }
  },
  {
    id: 'tp_6', type: 'tp', category: 'infrastructure', name: 'Telephone Point TP-06',
    position: { x: 16.0, y: 0.8, z: -4.5 }, rotationY: 0, scale: { x: 0.2, y: 0.2, z: 0.2 },
    assignedRoomId: 'gm_room', specs: { ID: 'TP-GMR-01', LineNumber: 'Ext 100', Type: 'Digital Ded.' }
  },
  {
    id: 'tp_7', type: 'tp', category: 'infrastructure', name: 'Telephone Point TP-07',
    position: { x: 5.5, y: 0.8, z: 6.8 }, rotationY: 0, scale: { x: 0.2, y: 0.2, z: 0.2 },
    assignedRoomId: 'server_room', specs: { ID: 'TP-SRV-01', LineNumber: 'Fax line 4402', Type: 'Analog Gate' }
  },
  {
    id: 'tp_8', type: 'tp', category: 'infrastructure', name: 'Telephone Point TP-08',
    position: { x: 16.0, y: 0.8, z: 2.0 }, rotationY: 0, scale: { x: 0.2, y: 0.2, z: 0.2 },
    assignedRoomId: 'packing_discussion', specs: { ID: 'TP-PAK-01', LineNumber: 'Ext 115', Type: 'VoIP' }
  },

  // ==========================================
  // CCTV (CCTV - 6)
  // ==========================================
  {
    id: 'cctv_1',
    type: 'cctv',
    category: 'infrastructure',
    name: 'CCTV Camera 01 (Entrance)',
    position: { x: -8.5, y: 3.2, z: 4.2 },
    rotationY: 0.78, // 45 degrees
    scale: { x: 0.3, y: 0.3, z: 0.4 },
    assignedRoomId: 'reception',
    specs: { model: 'Hikvision Dome', Lens: '2.8mm @ F1.6', Resolution: '4K UHD', Type: 'IP dome' }
  },
  {
    id: 'cctv_2',
    type: 'cctv',
    category: 'infrastructure',
    name: 'CCTV Camera 02 (Training Rm)',
    position: { x: -15.0, y: 3.2, z: -7.5 },
    rotationY: -0.78,
    scale: { x: 0.3, y: 0.3, z: 0.4 },
    assignedRoomId: 'long_meeting',
    specs: { model: 'Hikvision Dome', Lens: '4.0mm', Resolution: '1080p', Type: 'IP dome' }
  },
  {
    id: 'cctv_3',
    type: 'cctv',
    category: 'infrastructure',
    name: 'CCTV Camera 03 (Core Area)',
    position: { x: 1.0, y: 3.2, z: -6.0 },
    rotationY: 3.14,
    scale: { x: 0.3, y: 0.3, z: 0.4 },
    assignedRoomId: 'open_workspace',
    specs: { model: 'Hikvision Dome', Lens: '4.0mm', Resolution: '4K UHD', Type: 'IP dome PTZ' }
  },
  {
    id: 'cctv_4',
    type: 'cctv',
    category: 'infrastructure',
    name: 'CCTV Camera 04 (Server Corridor)',
    position: { x: 5.0, y: 3.2, z: 5.0 },
    rotationY: 1.57,
    scale: { x: 0.3, y: 0.3, z: 0.4 },
    assignedRoomId: 'open_workspace',
    specs: { model: 'Hikvision Bullet', Lens: '4.0mm', Resolution: '4K UHD', Type: 'Thermal/IP' }
  },
  {
    id: 'cctv_5',
    type: 'cctv',
    category: 'infrastructure',
    name: 'CCTV Camera 05 (Rear Lobby)',
    position: { x: 11.5, y: 3.2, z: 6.8 },
    rotationY: 1.57,
    scale: { x: 0.3, y: 0.3, z: 0.4 },
    assignedRoomId: 'large_store_bottom',
    specs: { model: 'Hikvision Dome', Lens: '2.8mm', Resolution: '1080p', Type: 'IP dome' }
  },
  {
    id: 'cctv_6',
    type: 'cctv',
    category: 'infrastructure',
    name: 'CCTV Camera 06 (Reception Office)',
    position: { x: -4.0, y: 3.2, z: 5.5 },
    rotationY: -1.57,
    scale: { x: 0.3, y: 0.3, z: 0.4 },
    assignedRoomId: 'reception',
    specs: { model: 'Hikvision Dome', Lens: '2.8mm', Resolution: '4K UHD', Type: 'IP dome' }
  },

  // ==========================================
  // DOOR ACCESS (Door Access - 3)
  // ==========================================
  {
    id: 'door_acc_1',
    type: 'door_access',
    category: 'infrastructure',
    name: 'Main Door Access Reader',
    position: { x: -8.8, y: 1.2, z: 4.2 },
    rotationY: 0,
    scale: { x: 0.15, y: 0.3, z: 0.15 },
    assignedRoomId: 'reception',
    specs: { model: 'Suprema BioEntry W2', RFID: 'Mifare / NFC', Biometric: 'Fingerprint', Connection: 'IP PoE' }
  },
  {
    id: 'door_acc_2',
    type: 'door_access',
    category: 'infrastructure',
    name: 'Server Room Secure Controller',
    position: { x: 4.4, y: 1.2, z: 6.8 },
    rotationY: 1.57,
    scale: { x: 0.15, y: 0.3, z: 0.15 },
    assignedRoomId: 'server_room',
    specs: { model: 'Suprema FaceLite', RFID: 'Mifare DESFire', Biometric: 'Facial Match', Connection: 'IP PoE' }
  },
  {
    id: 'door_acc_3',
    type: 'door_access',
    category: 'infrastructure',
    name: 'Executive Office Corridor Gate',
    position: { x: 6.0, y: 1.2, z: -1.3 },
    rotationY: 1.57,
    scale: { x: 0.15, y: 0.3, z: 0.15 },
    assignedRoomId: 'open_workspace',
    specs: { model: 'Suprema BioEntry W2', RFID: 'PIN / NFC', Biometric: 'None', Connection: 'RS-485' }
  },

  // ==========================================
  // INTERCOM (Intercom - 1)
  // ==========================================
  {
    id: 'intercom_1',
    type: 'intercom',
    category: 'infrastructure',
    name: 'Lobby Video Intercom Station',
    position: { x: -8.8, y: 1.3, z: 4.5 },
    rotationY: 0,
    scale: { x: 0.2, y: 0.3, z: 0.1 },
    assignedRoomId: 'reception',
    specs: { model: '2N IP Verso', Relay: 'Lock strike controller', CallRecipients: 'Reception / Guard Desk', Display: 'Touch LCD' }
  },

  // ==========================================
  // NEW POWER OUTLEST MARKINGS (6 Placements)
  // ==========================================
  {
    id: 'pwr_1', type: 'power_outlet', category: 'infrastructure', name: 'Power Outlet P-01',
    position: { x: -14.8, y: 0.3, z: 0.0 }, rotationY: 0, scale: { x: 0.25, y: 0.1, z: 0.25 },
    assignedRoomId: 'long_meeting', specs: { Voltage: '230V @ 50Hz', LoadCap: '13A Duplex', ColorCode: 'Blue (UPS Clean)' }
  },
  {
    id: 'pwr_2', type: 'power_outlet', category: 'infrastructure', name: 'Power Outlet P-02',
    position: { x: -5.0, y: 0.3, z: -3.5 }, rotationY: 0, scale: { x: 0.25, y: 0.1, z: 0.25 },
    assignedRoomId: 'discussion_4', specs: { Voltage: '230V @ 50Hz', LoadCap: '13A Duplex', ColorCode: 'Blue (UPS Clean)' }
  },
  {
    id: 'pwr_3', type: 'power_outlet', category: 'infrastructure', name: 'Power Outlet P-03',
    position: { x: -5.0, y: 0.3, z: 1.0 }, rotationY: 0, scale: { x: 0.25, y: 0.1, z: 0.25 },
    assignedRoomId: 'discussion_2', specs: { Voltage: '230V @ 50Hz', LoadCap: '13A Duplex', ColorCode: 'Blue (Double Out)' }
  },
  {
    id: 'pwr_4', type: 'power_outlet', category: 'infrastructure', name: 'Power Outlet P-04',
    position: { x: 5.5, y: 0.3, z: -1.3 }, rotationY: 0, scale: { x: 0.25, y: 0.1, z: 0.25 },
    assignedRoomId: 'open_workspace', specs: { Voltage: '230V', LoadCap: '15A Dedicated', ColorCode: 'Blue (UPS)' }
  },
  {
    id: 'pwr_5', type: 'power_outlet', category: 'infrastructure', name: 'Power Outlet P-05',
    position: { x: 12.0, y: 0.3, z: -6.0 }, rotationY: 0, scale: { x: 0.25, y: 0.1, z: 0.25 },
    assignedRoomId: 'admins_room', specs: { Voltage: '230V', LoadCap: '13A Twin', ColorCode: 'Blue (Clean)' }
  },
  {
    id: 'pwr_6', type: 'power_outlet', category: 'infrastructure', name: 'Power Outlet P-06',
    position: { x: 15.0, y: 0.3, z: -5.0 }, rotationY: 0, scale: { x: 0.25, y: 0.1, z: 0.25 },
    assignedRoomId: 'gm_room', specs: { Voltage: '230V', LoadCap: '13A Twin Executive', ColorCode: 'Blue (Clean)' }
  },

  // ==========================================
  // PHYSICAL FURNITURE ENTRIES (Creating 3D details)
  // ==========================================
  // Long Meeting Room Rows of Chairs + Desk rows representing training setting
  {
    id: 'lm_desk_row_1', type: 'desk_cluster_6', category: 'furniture', name: 'Training Table Row A',
    position: { x: -12.5, y: 0.4, z: -4.0 }, rotationY: 1.57, scale: { x: 1.0, y: 0.8, z: 3.5 },
    assignedRoomId: 'long_meeting'
  },
  {
    id: 'lm_desk_row_2', type: 'desk_cluster_6', category: 'furniture', name: 'Training Table Row B',
    position: { x: -12.5, y: 0.4, z: 0.0 }, rotationY: 1.57, scale: { x: 1.0, y: 0.8, z: 3.5 },
    assignedRoomId: 'long_meeting'
  },
  {
    id: 'lm_desk_row_3', type: 'desk_cluster_6', category: 'furniture', name: 'Training Table Row C',
    position: { x: -12.5, y: 0.4, z: 4.0 }, rotationY: 1.57, scale: { x: 1.0, y: 0.8, z: 3.5 },
    assignedRoomId: 'long_meeting'
  },
  // Training Chairs
  { id: 'lm_chair_a1', type: 'chair_office', category: 'furniture', name: 'Chair A1', position: { x: -13.5, y: 0.4, z: -4.5 }, rotationY: 1.57, scale: { x: 0.6, y: 0.8, z: 0.6 } },
  { id: 'lm_chair_a2', type: 'chair_office', category: 'furniture', name: 'Chair A2', position: { x: -13.5, y: 0.4, z: -3.5 }, rotationY: 1.57, scale: { x: 0.6, y: 0.8, z: 0.6 } },
  { id: 'lm_chair_a3', type: 'chair_office', category: 'furniture', name: 'Chair A3', position: { x: -11.5, y: 0.4, z: -4.5 }, rotationY: -1.57, scale: { x: 0.6, y: 0.8, z: 0.6 } },
  { id: 'lm_chair_a4', type: 'chair_office', category: 'furniture', name: 'Chair A4', position: { x: -11.5, y: 0.4, z: -3.5 }, rotationY: -1.57, scale: { x: 0.6, y: 0.8, z: 0.6 } },

  { id: 'lm_chair_b1', type: 'chair_office', category: 'furniture', name: 'Chair B1', position: { x: -13.5, y: 0.4, z: -0.5 }, rotationY: 1.57, scale: { x: 0.6, y: 0.8, z: 0.6 } },
  { id: 'lm_chair_b2', type: 'chair_office', category: 'furniture', name: 'Chair B2', position: { x: -13.5, y: 0.4, z: 0.5 }, rotationY: 1.57, scale: { x: 0.6, y: 0.8, z: 0.6 } },
  { id: 'lm_chair_b3', type: 'chair_office', category: 'furniture', name: 'Chair B3', position: { x: -11.5, y: 0.4, z: -0.5 }, rotationY: -1.57, scale: { x: 0.6, y: 0.8, z: 0.6 } },
  { id: 'lm_chair_b4', type: 'chair_office', category: 'furniture', name: 'Chair B4', position: { x: -11.5, y: 0.4, z: 0.5 }, rotationY: -1.57, scale: { x: 0.6, y: 0.8, z: 0.6 } },

  // Open Workspace clusters (Modular Desks with dividers)
  {
    id: 'ow_cluster_1', type: 'desk_cluster_6', category: 'furniture', name: 'IT & Eng Cluster 1',
    position: { x: -1.5, y: 0.4, z: -2.5 }, rotationY: 0, scale: { x: 2.2, y: 0.75, z: 1.4 },
    assignedRoomId: 'open_workspace'
  },
  {
    id: 'ow_cluster_2', type: 'desk_cluster_6', category: 'furniture', name: 'Finance Cluster 2',
    position: { x: 1.5, y: 0.4, z: -2.5 }, rotationY: 0, scale: { x: 2.2, y: 0.75, z: 1.4 },
    assignedRoomId: 'open_workspace'
  },
  {
    id: 'ow_cluster_3', type: 'desk_cluster_6', category: 'furniture', name: 'Operations Cluster 3',
    position: { x: -1.5, y: 0.4, z: 2.5 }, rotationY: 0, scale: { x: 2.2, y: 0.75, z: 1.4 },
    assignedRoomId: 'open_workspace'
  },
  {
    id: 'ow_cluster_4', type: 'desk_cluster_6', category: 'furniture', name: 'Sales Cluster 4',
    position: { x: 1.5, y: 0.4, z: 2.5 }, rotationY: 0, scale: { x: 2.2, y: 0.75, z: 1.4 },
    assignedRoomId: 'open_workspace'
  },

  // Chairs in open workspace
  { id: 'ow_chair_1', type: 'chair_office', category: 'furniture', name: 'Staff Chair 1', position: { x: -2.2, y: 0.4, z: -3.0 }, rotationY: 0, scale: { x: 0.6, y: 0.8, z: 0.6 } },
  { id: 'ow_chair_2', type: 'chair_office', category: 'furniture', name: 'Staff Chair 2', position: { x: -1.5, y: 0.4, z: -3.0 }, rotationY: 0, scale: { x: 0.6, y: 0.8, z: 0.6 } },
  { id: 'ow_chair_3', type: 'chair_office', category: 'furniture', name: 'Staff Chair 3', position: { x: -0.8, y: 0.4, z: -3.0 }, rotationY: 0, scale: { x: 0.6, y: 0.8, z: 0.6 } },
  { id: 'ow_chair_4', type: 'chair_office', category: 'furniture', name: 'Staff Chair 4', position: { x: 0.8, y: 0.4, z: -3.0 }, rotationY: 0, scale: { x: 0.6, y: 0.8, z: 0.6 } },
  { id: 'ow_chair_5', type: 'chair_office', category: 'furniture', name: 'Staff Chair 5', position: { x: 1.5, y: 0.4, z: -3.0 }, rotationY: 0, scale: { x: 0.6, y: 0.8, z: 0.6 } },

  // Reception Counter
  {
    id: 'reception_counter', type: 'reception_desk', category: 'furniture', name: 'Semicircle Reception Desk',
    position: { x: -7.5, y: 0.5, z: 5.5 }, rotationY: -0.78, scale: { x: 2.0, y: 1.0, z: 1.2 },
    assignedRoomId: 'reception'
  },
  {
    id: 'reception_chair', type: 'chair_office', category: 'furniture', name: 'Receptionist Chair',
    position: { x: -8.0, y: 0.4, z: 6.0 }, rotationY: 0.78, scale: { x: 0.6, y: 0.8, z: 0.6 },
    assignedRoomId: 'reception'
  },
  {
    id: 'lounge_sofa_1', type: 'chair_lounge', category: 'furniture', name: 'Premium Guest Armchair',
    position: { x: -6.5, y: 0.3, z: 7.0 }, rotationY: -1.57, scale: { x: 1.0, y: 0.6, z: 0.9 },
    assignedRoomId: 'reception'
  },

  // GM Office Table
  {
    id: 'gm_desk', type: 'conference_table', category: 'furniture', name: 'Executive Walnut Desk',
    position: { x: 16.0, y: 0.4, z: -5.5 }, rotationY: 0, scale: { x: 1.8, y: 0.75, z: 1.0 },
    assignedRoomId: 'gm_room'
  },
  {
    id: 'gm_chair', type: 'chair_office', category: 'furniture', name: 'CEO Leather Chair',
    position: { x: 16.0, y: 0.4, z: -6.2 }, rotationY: 0, scale: { x: 0.7, y: 0.9, z: 0.7 },
    assignedRoomId: 'gm_room'
  },

  // Whiteboard in Store Room / Discussion
  {
    id: 'store_whiteboard', type: 'whiteboard', category: 'furniture', name: 'Interactive Whiteboard Hub',
    position: { x: 12.0, y: 1.2, z: 1.0 }, rotationY: 1.57, scale: { x: 1.5, y: 1.5, z: 0.1 },
    assignedRoomId: 'store_120'
  }
];
