import React, { useState } from 'react';
import { 
  Building2, 
  Cpu, 
  Settings2, 
  Layout, 
  FileSpreadsheet, 
  Database, 
  Share2, 
  Plus, 
  Trash2, 
  RotateCw, 
  Search, 
  SlidersHorizontal,
  Info
} from 'lucide-react';
import { PlacedAsset, RoomDefinition, ZohoCreatorConfig } from '../types';

interface CADSidebarProps {
  rooms: RoomDefinition[];
  assets: PlacedAsset[];
  selectedAsset: PlacedAsset | null;
  onAddAsset: (type: string) => void;
  onUpdateAssetSpecs: (id: string, specs: Record<string, string>, name: string, rotate: number, roomId?: string) => void;
  onDeleteAsset: (id: string) => void;
  onAddRoom: (room: Omit<RoomDefinition, 'id'>) => void;
  onDeleteRoom: (id: string) => void;
  activeCategoryFilter: 'all' | 'furniture' | 'infrastructure';
  onSetCategoryFilter: (cat: 'all' | 'furniture' | 'infrastructure') => void;
  activeAssetTypeFilter: string | 'all';
  onSetAssetTypeFilter: (type: string | 'all') => void;
  viewMode: '2D' | '3D';
  onSetViewMode: (mode: '2D' | '3D') => void;
  activeTab: 'library' | 'rooms' | 'reports' | 'zoho';
  onSetActiveTab: (tab: 'library' | 'rooms' | 'reports' | 'zoho') => void;
}

export default function CADSidebar({
  rooms,
  assets,
  selectedAsset,
  onAddAsset,
  onUpdateAssetSpecs,
  onDeleteAsset,
  onAddRoom,
  onDeleteRoom,
  activeCategoryFilter,
  onSetCategoryFilter,
  activeAssetTypeFilter,
  onSetAssetTypeFilter,
  viewMode,
  onSetViewMode,
  activeTab,
  onSetActiveTab
}: CADSidebarProps) {
  
  // Custom Room creation local states
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomArea, setNewRoomArea] = useState(150);
  const [newRoomWidth, setNewRoomWidth] = useState(4.0);
  const [newRoomDepth, setNewRoomDepth] = useState(4.0);
  const [newRoomColor, setNewRoomColor] = useState('#f0f9ff');

  // Search state inside Reporting module
  const [assetSearchQuery, setAssetSearchQuery] = useState('');
  const [filterTypeSelector, setFilterTypeSelector] = useState('all');

  // Zoho details state
  const [copiedText, setCopiedText] = useState(false);
  const [copiedDeluge, setCopiedDeluge] = useState(false);
  const [zohoConfig, setZohoConfig] = useState<ZohoCreatorConfig>({
    formId: 'Device_Audit_Form',
    appName: 'Office_IT_Suite',
    ownerName: 'rydetech_admin',
    fieldMappings: {
      deviceId: 'Device_ID_Field',
      deviceName: 'Device_Name_Field',
      deviceType: 'Category_Field',
      roomName: 'Location_Room_Field',
      coordinates: 'XY_Coordinates',
    }
  });

  // Library Items catalog
  const libraryCatalog = [
    { type: 'ap', category: 'infrastructure', label: 'Access Point (AP)', count: 12, desc: 'Dual-band transmitter AP-535 router ceiling nodes.' },
    { type: 'dp', category: 'infrastructure', label: 'Data Point (DP)', count: 23, desc: 'Wall/floor RJ45 network cable connection socket.' },
    { type: 'tp', category: 'infrastructure', label: 'Tel Point (TP)', count: 8, desc: 'Analog/VoIP communications system telephone port.' },
    { type: 'cctv', category: 'infrastructure', label: 'CCTV Camera', count: 6, desc: 'High Definition dome with transparent active feed view.' },
    { type: 'door_access', category: 'infrastructure', label: 'Door Access System', count: 3, desc: 'RFID biometrics scan controller secure key.' },
    { type: 'intercom', category: 'infrastructure', label: 'Intercom Station', count: 1, desc: 'Lobby VoIP intercom with display and call capability.' },
    { type: 'power_outlet', category: 'infrastructure', label: 'Power Outlet Block', count: 7, desc: 'UPS-backed high voltage blue power socket.' },
    
    { type: 'desk_single', category: 'furniture', label: 'Single Desk', desc: 'Wooden office desk node with solid metal legs.' },
    { type: 'desk_cluster_4', category: 'furniture', label: '4-Pax Desk Cluster', desc: 'Symmetric workspace core with layout partition frames.' },
    { type: 'desk_cluster_6', category: 'furniture', label: '6-Pax Desk Cluster', desc: 'Linear bench workstation block for dynamic groups.' },
    { type: 'conference_table', category: 'furniture', label: 'Conference Table', desc: 'Sleek executive boardroom mahogany tabletop.' },
    { type: 'chair_office', category: 'furniture', label: 'Mesh Swivel Chair', desc: 'Ergonomic task mesh chair with seat orientation.' },
    { type: 'chair_lounge', category: 'furniture', label: 'Orange Lounge Armchair', desc: 'Lounge reception armchair in soft textured orange.' },
    { type: 'reception_desk', category: 'furniture', label: 'Reception Counter', desc: 'Circular design blue front marble countertop.' },
    { type: 'whiteboard', category: 'furniture', label: 'Whiteboard Stand', desc: 'Dual stand physical marker writing board.' },
  ];

  // Calculations for dashboard
  const lowCurrentMetrics = {
    ap: assets.filter(a => a.type === 'ap').length,
    dp: assets.filter(a => a.type === 'dp').length,
    tp: assets.filter(a => a.type === 'tp').length,
    cctv: assets.filter(a => a.type === 'cctv').length,
    door_access: assets.filter(a => a.type === 'door_access').length,
    intercom: assets.filter(a => a.type === 'intercom').length,
    power: assets.filter(a => a.type === 'power_outlet').length,
    furniture: assets.filter(a => a.category === 'furniture').length,
  };

  const handleCopyIFrameCode = () => {
    const iframeSnippet = `<iframe 
  src="${window.location.origin}/?viewMode=${viewMode}&activeCategory=${activeCategoryFilter}&embed=true" 
  width="100%" 
  height="680px" 
  style="border: 2px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);"
  allow="camera; microphone; geolocation"
></iframe>`;
    navigator.clipboard.writeText(iframeSnippet);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2500);
  };

  const handleCopyDelugeCode = () => {
    const delugeSnippet = `// Zoho Deluge Script to synchronize Office 3D Floor planner device inventories with Zoho CRM/Creator
void syncDeviceCoordinates_FromFloorPlanner(map deviceDataMap) {
    deviceId = deviceDataMap.get("id");
    deviceName = deviceDataMap.get("name");
    deviceType = deviceDataMap.get("type");
    coords_x = deviceDataMap.get("position_x");
    coords_z = deviceDataMap.get("position_z");
    assignedRoom = deviceDataMap.get("roomName");
    
    // Queries existing Creator records or updates them
    existingRecord = Zoho_Creator_Forms_Report[${zohoConfig.fieldMappings.deviceId} == deviceId];
    if(existingRecord.count() > 0) {
        updateRecord = existingRecord.first();
        updateRecord.${zohoConfig.fieldMappings.deviceName} = deviceName;
        updateRecord.${zohoConfig.fieldMappings.deviceType} = deviceType;
        updateRecord.${zohoConfig.fieldMappings.roomName} = assignedRoom;
        updateRecord.${zohoConfig.fieldMappings.coordinates} = coords_x.toString() + "," + coords_z.toString();
        info "Device updated successfully in Zoho Creator ID: " + deviceId;
    } else {
        insertRecord = insert into ${zohoConfig.formId} [
            ${zohoConfig.fieldMappings.deviceId} : deviceId,
            ${zohoConfig.fieldMappings.deviceName} : deviceName,
            ${zohoConfig.fieldMappings.deviceType} : deviceType,
            ${zohoConfig.fieldMappings.roomName} : assignedRoom,
            ${zohoConfig.fieldMappings.coordinates} : coords_x.toString() + "," + coords_z.toString()
        ];
        info "New Device added to Zoho Creator Database.";
    }
}`;
    navigator.clipboard.writeText(delugeSnippet);
    setCopiedDeluge(true);
    setTimeout(() => setCopiedDeluge(false), 2500);
  };

  // Export CAD structures in JSON format compatible with webhooks/reporting databases
  const handleExportJSON = () => {
    const dataToExport = {
      exportedAt: new Date().toISOString(),
      roomsCount: rooms.length,
      assetsCount: assets.length,
      rooms: rooms.map(r => ({
        id: r.id,
        name: r.name,
        areaSqFt: r.areaSqFt,
        dimensions: { width: r.width, depth: r.depth },
        coordinates: { x: r.x, z: r.z },
        itemAllocations: assets.filter(a => a.assignedRoomId === r.id).map(a => ({ id: a.id, name: a.name, type: a.type }))
      })),
      assets: assets.map(a => ({
        id: a.id,
        type: a.type,
        category: a.category,
        name: a.name,
        position: a.position,
        rotationY: a.rotationY,
        roomName: rooms.find(r => r.id === a.assignedRoomId)?.name || 'Unassigned',
        specs: a.specs
      }))
    };

    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Office_LowCurrent_Audit_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Export report structure as CSV table
  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Asset ID,Asset Name,Type,Category,Location Room,Coordinate X,Coordinate Z,Specifications\r\n';
    
    assets.forEach(a => {
      const roomName = rooms.find(r => r.id === a.assignedRoomId)?.name || 'Unassigned';
      const specString = a.specs ? Object.entries(a.specs).map(([k,v]) => `${k}:${v}`).join('; ') : 'N/A';
      csvContent += `"${a.id}","${a.name}","${a.type}","${a.category}","${roomName}","${a.position.x.toFixed(2)}","${a.position.z.toFixed(2)}","${specString}"\r\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.href = encodedUri;
    link.download = `Office_LowCurrent_Inventory_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Handle local dynamic additions
  const triggerAddRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName) return;
    
    onAddRoom({
      name: newRoomName,
      areaSqFt: newRoomArea,
      width: Number(newRoomWidth),
      depth: Number(newRoomDepth),
      color: newRoomColor,
      x: 0,
      z: 0,
    });
    
    setNewRoomName('');
    onSetActiveTab('rooms');
  };

  // List of filtered assets for Reports tab search
  const filteredAssetsReport = assets.filter(a => {
    const matchesSearch = a.name.toLowerCase().includes(assetSearchQuery.toLowerCase()) || 
                          a.type.toLowerCase().includes(assetSearchQuery.toLowerCase()) ||
                          (a.specs && Object.values(a.specs).some(val => val.toLowerCase().includes(assetSearchQuery.toLowerCase())));
    const matchesType = filterTypeSelector === 'all' || a.type === filterTypeSelector;
    return matchesSearch && matchesType;
  });

  return (
    <div className="flex flex-col h-full bg-transparent text-slate-800 overflow-hidden w-full gap-4" id="cad-sidebar-root">
      
      {/* CARD A: DYNAMIC TAB CONTENT PANEL */}
      <div className="flex-1 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col overflow-hidden p-4">
        
        {/* Compact Tab Header in light Bento mode */}
        <div className="flex border border-slate-200/50 bg-slate-50 p-1 rounded-xl text-xs font-semibold select-none mb-4" id="cad-navigation-scroller">
          <button
            type="button"
            onClick={() => onSetActiveTab('library')}
            className={`flex-1 py-2 text-center rounded-lg flex items-center justify-center gap-1.5 transition-all text-slate-505 hover:text-slate-900 cursor-pointer ${
              activeTab === 'library' ? 'bg-white shadow-xs text-blue-600 font-bold border border-slate-200/40' : ''
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Library</span>
          </button>
          <button
            type="button"
            onClick={() => onSetActiveTab('rooms')}
            className={`flex-1 py-2 text-center rounded-lg flex items-center justify-center gap-1.5 transition-all text-slate-505 hover:text-slate-900 cursor-pointer ${
              activeTab === 'rooms' ? 'bg-white shadow-xs text-blue-600 font-bold border border-slate-200/40' : ''
            }`}
          >
            <Layout className="w-3.5 h-3.5" />
            <span>Rooms</span>
          </button>
          <button
            type="button"
            onClick={() => onSetActiveTab('reports')}
            className={`flex-1 py-2 text-center rounded-lg flex items-center justify-center gap-1.5 transition-all text-slate-505 hover:text-slate-900 cursor-pointer ${
              activeTab === 'reports' ? 'bg-white shadow-xs text-blue-600 font-bold border border-slate-200/40' : ''
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Inventory</span>
          </button>
          <button
            type="button"
            onClick={() => onSetActiveTab('zoho')}
            className={`flex-1 py-2 text-center rounded-lg flex items-center justify-center gap-1.5 transition-all text-slate-505 hover:text-slate-900 cursor-pointer ${
              activeTab === 'zoho' ? 'bg-white shadow-xs text-blue-600 font-bold border border-slate-200/40' : ''
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Zoho</span>
          </button>
        </div>

        {/* Tab Content Wrapper */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4 font-sans" id="cad-active-panel-wrapper">
          
          {/* ==================== LIBRARY TAB ==================== */}
          {activeTab === 'library' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              
              {/* Quick Filter Categories */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono">Layer Filters</label>
                <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-50 p-1 border border-slate-200/60">
                  <button
                    type="button"
                    onClick={() => onSetCategoryFilter('all')}
                    className={`py-1 text-[11px] text-center rounded-lg transition-all font-semibold cursor-pointer ${
                      activeCategoryFilter === 'all' 
                        ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' 
                        : 'text-slate-505 hover:text-slate-900'
                    }`}
                  >
                    All Elements
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetCategoryFilter('infrastructure')}
                    className={`py-1 text-[11px] text-center rounded-lg transition-all font-semibold flex items-center justify-center gap-1 cursor-pointer ${
                      activeCategoryFilter === 'infrastructure' 
                        ? 'bg-blue-600 text-white shadow-sm' 
                        : 'text-slate-505 hover:text-slate-900'
                    }`}
                  >
                    <Cpu className="w-3 h-3" />
                    Low-Current
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetCategoryFilter('furniture')}
                    className={`py-1 text-[11px] text-center rounded-lg transition-all font-semibold flex items-center justify-center gap-1 cursor-pointer ${
                      activeCategoryFilter === 'furniture' 
                        ? 'bg-orange-600 text-white shadow-sm' 
                        : 'text-slate-550 hover:text-slate-900'
                    }`}
                  >
                    <Layout className="w-3 h-3" />
                    Furniture
                  </button>
                </div>
              </div>

              {/* Quick device selector dropdown */}
              <div className="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-xl border border-slate-200/60">
                <span className="text-xs text-slate-500 font-mono font-medium">Device filter:</span>
                <select
                  value={activeAssetTypeFilter}
                  onChange={(e) => onSetAssetTypeFilter(e.target.value)}
                  className="bg-white border border-slate-220 rounded-lg px-2 py-0.5 text-xs text-slate-700 font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="all">Display All Devices</option>
                  <option value="ap">Access Points (AP)</option>
                  <option value="dp">Data Ports (DP)</option>
                  <option value="tp">Tel Ports (TP)</option>
                  <option value="cctv">CCTV Cameras</option>
                  <option value="door_access">Door Access Readers</option>
                  <option value="intercom">Intercom Terminals</option>
                  <option value="power_outlet">New Power Outlets</option>
                </select>
              </div>

              {/* Instant Instantiate library catalog list */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Procedural CAD Library</label>
                  <span className="text-[10px] text-slate-400 font-mono">Click to insert on grid</span>
                </div>
                
                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1 select-none">
                  {libraryCatalog
                    .filter(item => activeCategoryFilter === 'all' || item.category === activeCategoryFilter)
                    .map((item) => {
                      const currentPlacedCount = assets.filter(a => a.type === item.type).length;
                      return (
                        <div
                          key={item.type}
                          onClick={() => onAddAsset(item.type)}
                          className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50 hover:bg-slate-100/80 transition-all cursor-pointer shadow-xs group"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={`p-2 rounded-lg ${
                              item.category === 'infrastructure' 
                                ? 'bg-blue-50 text-blue-600 group-hover:bg-blue-100' 
                                : 'bg-orange-50 text-orange-650 group-hover:bg-orange-100'
                            } transition-all`}>
                              {item.category === 'infrastructure' ? <Cpu className="w-4 h-4" /> : <Layout className="w-4 h-4" />}
                            </div>
                            <div className="max-w-[180px] md:max-w-xs font-sans">
                              <span className="text-xs font-bold text-slate-800 group-hover:text-blue-700 block">{item.label}</span>
                              <span className="text-[10.5px] text-slate-500 block leading-tight mt-0.5">{item.desc}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {item.count !== undefined && (
                              <span className="text-[9.5px] font-bold bg-slate-100 border border-slate-200 text-slate-500 px-1.5 py-0.5 rounded font-mono">
                                {currentPlacedCount}/{item.count}
                              </span>
                            )}
                            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-xs">
                              <Plus className="w-3.5 h-3.5" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}

          {/* ==================== ROOMS TAB ==================== */}
          {activeTab === 'rooms' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Create dynamic Room Placer form */}
              <form onSubmit={triggerAddRoom} className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 space-y-3">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-2 mb-1 font-mono">
                  <Plus className="w-3.5 h-3.5 text-blue-600" /> Instantiate Custom Modular Space
                </h3>
                
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1 col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 block font-mono">Room Label / Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Training Zone Beta"
                      value={newRoomName}
                      onChange={(e) => setNewRoomName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 placeholder-slate-400 font-sans"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 block font-mono">Design Area (SQFT)</label>
                    <input
                      type="number"
                      min="10"
                      max="10000"
                      value={newRoomArea}
                      onChange={(e) => setNewRoomArea(Number(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 block font-mono">Blueprint Color</label>
                    <div className="flex gap-1.5 mt-1.5">
                      {['#f0fdf4', '#f0f9ff', '#fffbeb', '#faf5ff', '#fef2f2', '#f5f5f4'].map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setNewRoomColor(color)}
                          className={`w-4 h-4 rounded-full border border-slate-300 cursor-pointer ${newRoomColor === color ? 'ring-2 ring-blue-500 scale-110 shadow-sm' : 'opacity-80'}`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 block font-mono">Room Width (meters)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      max="30"
                      value={newRoomWidth}
                      onChange={(e) => setNewRoomWidth(Number(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 block font-mono">Room Depth (meters)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      max="30"
                      value={newRoomDepth}
                      onChange={(e) => setNewRoomDepth(Number(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-xs text-white py-2 rounded-lg font-bold shadow-xs transition-all mt-2 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Instantiate Room on Grid</span>
                </button>
              </form>

              {/* List of active spaces */}
              <div className="space-y-2 font-sans">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono">Active Spaces</label>
                <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                  {rooms.map((room) => {
                    const occupantsCount = assets.filter((a) => a.assignedRoomId === room.id).length;
                    return (
                      <div
                        key={room.id}
                        className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200/50 bg-slate-50 hover:bg-white hover:border-slate-300 transition-all text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full border border-slate-300 block shrink-0 animate-pulse"
                            style={{ backgroundColor: room.color }}
                          />
                          <div>
                            <span className="font-bold text-slate-800 block leading-tight">{room.name}</span>
                            <span className="text-[10.5px] text-slate-550 font-mono block mt-0.5">{room.areaSqFt} SQFT | {room.width}m x {room.depth}m | {occupantsCount} nodes</span>
                          </div>
                        </div>
                        
                        {/* Non-destructive defaults filter */}
                        {room.id !== 'open_workspace' && room.id !== 'long_meeting' ? (
                          <button
                            type="button"
                            onClick={() => onDeleteRoom(room.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-650 hover:bg-slate-100 transition-all cursor-pointer"
                            title="Remove Room"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span className="text-[9px] font-bold text-slate-450 bg-slate-100/50 border border-slate-200/50 px-1.5 py-0.5 rounded-md font-mono uppercase">Default</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ==================== INVENTORY & REPORTING TAB ==================== */}
          {activeTab === 'reports' && (
            <div className="space-y-4 animate-in fade-in duration-200 font-sans">
              {/* Search engine bar */}
              <div className="space-y-2">
                <div className="relative font-mono">
                  <Search className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search MAC, ports, names, Ext..."
                    value={assetSearchQuery}
                    onChange={(e) => setAssetSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-9 py-2.5 text-xs text-slate-700 placeholder-slate-405 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                {/* Categorization chips */}
                <div className="flex gap-1 overflow-x-auto scrollbar-none pb-1" id="report-chips-scroller">
                  {['all', 'ap', 'dp', 'tp', 'cctv', 'door_access', 'power_outlet'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFilterTypeSelector(type)}
                      className={`px-2.5 py-1.5 rounded-full text-[9.5px] border font-bold uppercase tracking-wider shrink-0 transition-all cursor-pointer ${
                        filterTypeSelector === type 
                          ? 'bg-blue-600 text-white border-blue-600 font-bold' 
                          : 'bg-slate-55 text-slate-500 border-slate-200 hover:text-slate-800 hover:bg-slate-100'
                      }`}
                    >
                      {type === 'all' ? 'All Units' : type.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Overall totals widget */}
              <div className="grid grid-cols-2 gap-2 bg-slate-55 p-3 rounded-xl border border-slate-200" id="cad-blueprint-analytics-stats">
                <div className="space-y-0.5">
                  <span className="text-[9px] uppercase font-mono text-slate-400 tracking-wider font-bold">WiFi Access Points</span>
                  <p className="text-lg font-bold font-mono text-slate-800 flex items-baseline gap-1">
                    {lowCurrentMetrics.ap} <span className="text-[10px] font-normal text-slate-400">placed</span>
                  </p>
                </div>
                <div className="space-y-0.5 border-l border-slate-200 pl-3">
                  <span className="text-[9px] uppercase font-mono text-slate-400 tracking-wider font-bold">Active Data Ports</span>
                  <p className="text-lg font-bold font-mono text-blue-600 flex items-baseline gap-1">
                    {lowCurrentMetrics.dp} <span className="text-[10px] font-normal text-slate-400">patched</span>
                  </p>
                </div>
                <div className="space-y-0.5 border-t border-slate-200 pt-2 mt-1">
                  <span className="text-[9px] uppercase font-mono text-slate-400 tracking-wider font-bold">CCTV Systems</span>
                  <p className="text-lg font-bold font-mono text-amber-600 flex items-baseline gap-1">
                    {lowCurrentMetrics.cctv} <span className="text-[10px] font-normal text-slate-400">online</span>
                  </p>
                </div>
                <div className="space-y-0.5 border-t border-l border-slate-200 pt-2 mt-1 pl-3">
                  <span className="text-[9px] uppercase font-mono text-slate-400 tracking-wider font-bold">Total Assets</span>
                  <p className="text-lg font-bold font-mono text-slate-800">
                    {assets.length} <span className="text-[10px] font-normal text-slate-400 font-sans">objects</span>
                  </p>
                </div>
              </div>

              {/* Dynamic Inventory Table */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Device Log</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleExportCSV}
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-755 flex items-center gap-1 cursor-pointer font-sans"
                    >
                      <FileSpreadsheet className="w-3 h-3" />
                      <span>Export CSV</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleExportJSON}
                      className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer font-sans"
                    >
                      <Database className="w-3 h-3" />
                      <span>Schema JSON</span>
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden text-xs">
                  <div className="grid grid-cols-12 gap-1 py-2 px-3 bg-slate-50 font-bold font-mono text-slate-500 text-[9px] uppercase tracking-wider border-b border-slate-200">
                    <div className="col-span-12 items-baseline flex justify-between pr-2">
                      <span>Device Name / Type</span>
                      <span>Config parameters</span>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-100 max-h-[180px] overflow-y-auto">
                    {filteredAssetsReport.length > 0 ? (
                      filteredAssetsReport.map((asset) => {
                        const roomName = rooms.find(r => r.id === asset.assignedRoomId)?.name || 'Unassigned';
                        const isInfrastructure = asset.category === 'infrastructure';

                        return (
                          <div
                            key={asset.id}
                            className="flex justify-between py-2 px-3 hover:bg-slate-50/50 transition-all items-center text-[10.5px] border-b border-slate-100 font-sans"
                          >
                            <div className="pr-1 max-w-[190px] truncate">
                              <span className="font-bold text-slate-800 block truncate">{asset.name}</span>
                              <span className="text-[9px] text-slate-400 block truncate font-mono">{roomName}</span>
                            </div>
                            
                            <div className="flex items-center gap-1.5 shrink-0 font-mono">
                              <span className="font-mono text-[9.5px] text-slate-500 bg-slate-100 px-1 py-0.5 rounded border border-slate-200">
                                {asset.specs && asset.specs.Mac ? `MAC: ${asset.specs.Mac}` :
                                 asset.specs && asset.specs.Port ? `Port: ${asset.specs.Port}` :
                                 asset.specs && asset.specs.LineNumber ? `${asset.specs.LineNumber}` :
                                 asset.specs && asset.specs.model ? `${asset.specs.model}` : `X: ${asset.position.x.toFixed(1)}`}
                              </span>
                              
                              {isInfrastructure ? (
                                <span className={`inline-block px-1 py-0.5 rounded text-[8.5px] font-bold tracking-wider uppercase ${
                                  asset.specs && asset.specs.Status === 'Inactive' 
                                    ? 'bg-rose-50 text-rose-600 border border-rose-100' 
                                    : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                }`}>
                                  {asset.specs && asset.specs.Status ? asset.specs.Status : 'ONLINE'}
                                </span>
                              ) : (
                                <span className="text-[9.5px] text-slate-420 font-medium">Placed</span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-4 text-center text-slate-400 text-xs italic font-mono">
                        No devices match the query.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== ZOHO CREATOR TAB ==================== */}
          {activeTab === 'zoho' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-blue-50 p-3.5 rounded-xl border border-blue-100 flex flex-col gap-2 font-sans">
                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 rounded-lg bg-blue-105 text-blue-700 mt-0.5 shrink-0">
                    <Info className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Zoho Creator Platform Integration</h4>
                    <p className="text-[11px] text-slate-500 leading-normal mt-1 font-medium">
                      Configure your cloud-hosted database fields to synchronize physical equipment locations in real-time. Code bindings are updated instantly.
                    </p>
                  </div>
                </div>
              </div>

              {/* Zoho Creator config form mappings */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/40 space-y-3 font-sans">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest font-mono">Creator API Field Mappings</h3>
                
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-404 block font-mono">Zoho Form ID</label>
                    <input
                      type="text"
                      value={zohoConfig.formId}
                      onChange={(e) => setZohoConfig({ ...zohoConfig, formId: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono text-slate-700 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-404 block font-mono">Device ID Field</label>
                    <input
                      type="text"
                      value={zohoConfig.fieldMappings.deviceId}
                      onChange={(e) => setZohoConfig({
                        ...zohoConfig,
                        fieldMappings: { ...zohoConfig.fieldMappings, deviceId: e.target.value }
                      })}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono text-slate-700 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-404 block font-mono">Device Name Field</label>
                    <input
                      type="text"
                      value={zohoConfig.fieldMappings.deviceName}
                      onChange={(e) => setZohoConfig({
                        ...zohoConfig,
                        fieldMappings: { ...zohoConfig.fieldMappings, deviceName: e.target.value }
                      })}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono text-slate-700 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-404 block font-mono">Room Location Field</label>
                    <input
                      type="text"
                      value={zohoConfig.fieldMappings.roomName}
                      onChange={(e) => setZohoConfig({
                        ...zohoConfig,
                        fieldMappings: { ...zohoConfig.fieldMappings, roomName: e.target.value }
                      })}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono text-slate-700 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Embedded IFrame Copy block */}
              <div className="space-y-2 font-sans">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">1. CRM Embed IFrame</label>
                  <span className="text-[9px] text-slate-400 font-mono">HTML Integration</span>
                </div>

                <div className="p-3 border border-slate-200 bg-slate-50 rounded-xl text-[10.5px] font-mono text-slate-605 relative group overflow-x-auto select-all max-h-[110px]">
                  {`<iframe src="${window.location.origin}/?embed=true" width="100%" height="600" style="border:none;"></iframe>`}
                  <button
                    type="button"
                    onClick={handleCopyIFrameCode}
                    className="absolute right-2 top-2 px-2.5 py-1 rounded-md bg-white border border-slate-200 hover:bg-slate-50 shadow-xs text-[9px] font-bold text-slate-700 cursor-pointer transition-all"
                  >
                    {copiedText ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Deluge automation script */}
              <div className="space-y-2 font-sans">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">2. Zoho Deluge Sync Script</label>
                  <span className="text-[9px] text-slate-400 font-mono">API Automation</span>
                </div>

                <div className="p-3 border border-slate-200 bg-slate-50 rounded-xl text-[10px] font-mono text-blue-600 relative group overflow-y-auto max-h-[140px] feedback-scrollable">
                  <pre className="text-left select-all whitespace-pre text-slate-605 leading-tight">
                    {`// Sync CAD layout node coordinate points
void syncOfficeLayout(map data) {
  id = data.get("id");
  x = data.get("x");
  z = data.get("z");
  r = data.get("room");
  input.${zohoConfig.fieldMappings.roomName} = r;
  input.${zohoConfig.fieldMappings.coordinates} = x + "," + z;
}`}
                  </pre>
                  <button
                    type="button"
                    onClick={handleCopyDelugeCode}
                    className="absolute right-2 top-2 px-2.5 py-1 rounded-md bg-white border border-slate-200 hover:bg-slate-50 shadow-xs text-[9px] font-bold text-slate-700 cursor-pointer transition-all"
                  >
                    {copiedDeluge ? 'Copied!' : 'Copy Script'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CARD B: SELECTED ELEMENT INSPECTOR */}
      <div className="border border-slate-200 p-4 rounded-2xl bg-white shadow-xs shrink-0" id="cad-sidebar-footer">
        {selectedAsset ? (
          <div className="space-y-3 animate-in slide-in-from-bottom duration-150 font-sans" id="active-asset-inspector-panel">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs uppercase font-mono">
                <Settings2 className="w-4 h-4 text-blue-600 animate-spin" style={{ animationDuration: '8s' }} />
                <span>Entity Inspector</span>
              </div>
              <button
                type="button"
                onClick={() => onDeleteAsset(selectedAsset.id)}
                className="text-[10px] font-bold text-rose-600 hover:text-rose-705 hover:bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-100 flex items-center gap-1 transition-all cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>Delete Node</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="space-y-1 col-span-2">
                <label className="text-[9px] font-bold text-slate-400 block font-mono">Custom Label / Tag</label>
                <input
                  type="text"
                  value={selectedAsset.name}
                  onChange={(e) => onUpdateAssetSpecs(
                    selectedAsset.id,
                    selectedAsset.specs || {},
                    e.target.value,
                    selectedAsset.rotationY,
                    selectedAsset.assignedRoomId
                  )}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-blue-500 font-sans font-medium hover:border-slate-300 transition-all font-sans"
                />
              </div>

              {/* Dynamic Room Assignment overrides */}
              <div className="space-y-1 col-span-2">
                <label className="text-[9px] font-bold text-slate-400 block font-mono">Assign Parents (Enclosure Room)</label>
                <select
                  value={selectedAsset.assignedRoomId || 'unassigned'}
                  onChange={(e) => onUpdateAssetSpecs(
                    selectedAsset.id,
                    selectedAsset.specs || {},
                    selectedAsset.name,
                    selectedAsset.rotationY,
                    e.target.value === 'unassigned' ? undefined : e.target.value
                  )}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:border-blue-500 font-sans text-xs font-semibold cursor-pointer"
                >
                  <option value="unassigned font-bold font-mono">Unassigned (Free Flowing)</option>
                  {rooms.map((rm) => (
                    <option key={rm.id} value={rm.id} className="font-semibold">{rm.name}</option>
                  ))}
                </select>
              </div>

              {/* Fine rotation sliders */}
              <div className="space-y-1 col-span-2 flex flex-col gap-0.5">
                <div className="flex justify-between items-center">
                  <label className="text-[9px] font-bold text-slate-400 font-mono">Orient Angle (Rotation)</label>
                  <span className="text-[10px] text-blue-600 font-mono font-bold">{(selectedAsset.rotationY * (180 / Math.PI)).toFixed(0)}°</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="6.28"
                    step="0.08"
                    value={selectedAsset.rotationY || 0}
                    onChange={(e) => onUpdateAssetSpecs(
                      selectedAsset.id,
                      selectedAsset.specs || {},
                      selectedAsset.name,
                      Number(e.target.value),
                      selectedAsset.assignedRoomId
                    )}
                    className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const snap = (selectedAsset.rotationY + Math.PI / 4) % (Math.PI * 2);
                      onUpdateAssetSpecs(selectedAsset.id, selectedAsset.specs || {}, selectedAsset.name, snap, selectedAsset.assignedRoomId);
                    }}
                    className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-700 shadow-xs transition-all cursor-pointer"
                    title="Rotate 45° snaps"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Specifications form keys like MAC, Port, IP, Status */}
              {selectedAsset.specs && Object.keys(selectedAsset.specs).map((key) => {
                const val = selectedAsset.specs ? selectedAsset.specs[key] : '';
                return (
                  <div key={key} className="space-y-0.5 font-sans text-[11px]">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block font-mono">{key}</label>
                    <input
                      type="text"
                      value={val}
                      onChange={(e) => {
                        const updated = { ...(selectedAsset.specs || {}) };
                        updated[key] = e.target.value;
                        onUpdateAssetSpecs(selectedAsset.id, updated, selectedAsset.name, selectedAsset.rotationY, selectedAsset.assignedRoomId);
                      }}
                      className="w-full bg-slate-55 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-850 focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                );
              })}
            </div>
            
            <div className="text-[9px] text-slate-400 font-mono border-t border-slate-100 pt-2 flex justify-between pr-1">
              <span>COORDINATE MAP:</span>
              <span className="font-bold text-slate-500">X: {selectedAsset.position.x.toFixed(2)}m, Z: {selectedAsset.position.z.toFixed(2)}m</span>
            </div>
          </div>
        ) : (
          <div className="py-4 text-center text-slate-400 text-xs italic font-sans flex flex-col items-center justify-center gap-1.5" id="inspector-placeholder">
            <SlidersHorizontal className="w-5 h-5 text-slate-350 animate-pulse" />
            <span className="max-w-[260px] leading-relaxed">Select an Access Point, CCTV camera, or office equipment inside the 3D grid layout to inspector-edit serial nodes.</span>
          </div>
        )}
      </div>
    </div>
  );
}
