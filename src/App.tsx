/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import ThreeCanvas from './components/ThreeCanvas';
import CADSidebar from './components/CADSidebar';
import { DEFAULT_ROOMS, DEFAULT_ASSETS } from './data/defaultFloorPlan';
import { PlacedAsset, RoomDefinition } from './types';
import { 
  Building2, 
  RefreshCw, 
  HelpCircle, 
  CheckCircle2, 
  Moon, 
  Sun, 
  Layers, 
  MapPin, 
  Sparkles,
  BookmarkCheck,
  ChevronRight,
  Cpu,
  Layout,
  FileSpreadsheet,
  Share2
} from 'lucide-react';

export default function App() {
  const [rooms, setRooms] = useState<RoomDefinition[]>(DEFAULT_ROOMS);
  const [assets, setAssets] = useState<PlacedAsset[]>(DEFAULT_ASSETS);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  
  // HUD Filters state
  const [viewMode, setViewMode] = useState<'2D' | '3D'>('3D');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<'all' | 'furniture' | 'infrastructure'>('all');
  const [activeAssetTypeFilter, setActiveAssetTypeFilter] = useState<string | 'all'>('all');

  // Interactive help tour state
  const [showTutorial, setShowTutorial] = useState(true);

  // Tab state synced with high-contrast vertical bento rail
  const [activeTab, setActiveTab] = useState<'library' | 'rooms' | 'reports' | 'zoho'>('library');

  // Asset counts generator for quick lookup
  const nextAssetIdNumberRef = React.useRef(99);

  // Instantiate assets dynamically at standard focus points
  const handleAddAsset = (type: string) => {
    nextAssetIdNumberRef.current += 1;
    const uid = `${type}_${Date.now().toString().slice(-4)}_${nextAssetIdNumberRef.current}`;
    
    let category: 'infrastructure' | 'furniture' = 'furniture';
    let label = '';
    let height = 0.4;
    let defaultSpecs: Record<string, string> = {};

    if (['ap', 'dp', 'tp', 'cctv', 'door_access', 'intercom', 'power_outlet'].includes(type)) {
      category = 'infrastructure';
      height = type === 'ap' || type === 'cctv' ? 3.2 : 0.8; // height parameters
    }

    // Build smart specifications depending on types
    switch (type) {
      case 'ap':
        label = `New Access Point AP-${nextAssetIdNumberRef.current - 90}`;
        defaultSpecs = {
          model: 'Aruba AP-535 Dual',
          Mac: `00:1A:2B:3C:D4:${nextAssetIdNumberRef.current.toString(16).toUpperCase()}`,
          Frequency: '2.4 / 5 GHz',
          Power: 'PoE+'
        };
        break;
      case 'dp':
        label = `New Data Port DP-${nextAssetIdNumberRef.current - 90}`;
        defaultSpecs = {
          ID: `OW-DP-${nextAssetIdNumberRef.current - 90}`,
          Port: `X-${nextAssetIdNumberRef.current - 90}`,
          Status: 'Active',
          Category: 'Cat6'
        };
        break;
      case 'tp':
        label = `New Tel Port TP-${nextAssetIdNumberRef.current - 90}`;
        defaultSpecs = {
          ID: `TP-OW-${nextAssetIdNumberRef.current - 90}`,
          LineNumber: `Ext ${200 + nextAssetIdNumberRef.current - 90}`,
          Type: 'VoIP'
        };
        break;
      case 'cctv':
        label = `New CCTV Camera ${nextAssetIdNumberRef.current - 90}`;
        defaultSpecs = {
          model: 'Hikvision Dome',
          Lens: '2.8mm @ F1.6',
          Resolution: '4K UHD',
          Type: 'IP Dome'
        };
        break;
      case 'door_access':
        label = `Card Reader Entry Lock`;
        defaultSpecs = {
          model: 'Suprema W2',
          RFID: 'Mifare / NFC',
          Biometric: 'None',
          Connection: 'PoE'
        };
        break;
      case 'intercom':
        label = `Intercom Terminal`;
        defaultSpecs = {
          model: '2N IP Station',
          Display: 'Touch screen',
          CallRecipients: 'Reception Desk'
        };
        break;
      case 'power_outlet':
        label = `Indigo Power Mark`;
        defaultSpecs = {
          Voltage: '230V',
          LoadCap: '13A Twin',
          ColorCode: 'Blue (UPS Clean)'
        };
        break;
      case 'desk_single':
        label = `Single Oak Workspace`;
        break;
      case 'desk_cluster_4':
        label = `Modular 4-Pax Cluster Desk`;
        break;
      case 'desk_cluster_6':
        label = `Staff 6-Pax cluster Bench`;
        break;
      case 'conference_table':
        label = `Boardroom Mahogany Table`;
        break;
      case 'chair_office':
        label = `Standard swiveller Chair`;
        break;
      case 'chair_lounge':
        label = `Reception plush Lounge Sofa`;
        break;
      case 'reception_desk':
        label = `Modular marble Reception counter`;
        break;
      case 'whiteboard':
        label = `Interactive Dry-Erase Whiteboard`;
        break;
      default:
        label = `Generic Workspace Item`;
    }

    const newAsset: PlacedAsset = {
      id: uid,
      type: type as any,
      category,
      name: label,
      position: { x: 0, y: height, z: 0 }, // Instantiate at floor center
      rotationY: 0,
      scale: type === 'desk_cluster_6' ? { x: 2.2, y: 0.75, z: 1.4 } : { x: 1, y: 1, z: 1 },
      specs: defaultSpecs
    };

    setAssets((prev) => [...prev, newAsset]);
    setSelectedAssetId(uid); // Focus instantly for spec customization
  };

  // Fine update handler for coordinates and parameters
  const handleUpdateAssetSpecs = (
    id: string,
    specs: Record<string, string>,
    name: string,
    rotationY: number,
    roomId?: string
  ) => {
    setAssets((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, specs, name, rotationY, assignedRoomId: roomId } : a
      )
    );
  };

  // Dragging event coordinate update
  const handleUpdateAssetPosition = (id: string, x: number, z: number) => {
    setAssets((prev) =>
      prev.map((a) => (a.id === id ? { ...a, position: { ...a.position, x, z } } : a))
    );
  };

  const handleDeleteAsset = (id: string) => {
    setAssets((prev) => prev.filter((a) => a.id !== id));
    if (selectedAssetId === id) setSelectedAssetId(null);
  };

  const handleAddRoom = (newRoom: Omit<RoomDefinition, 'id'>) => {
    const rId = `custom_room_${Date.now().toString().slice(-4)}`;
    // Position room offset cleanly so it does not stack directly
    const offsetZ = rooms.length * 1.5 - 10;
    
    const room: RoomDefinition = {
      ...newRoom,
      id: rId,
      x: 0,
      z: Math.max(-12, Math.min(12, offsetZ)),
    };
    setRooms((prev) => [...prev, room]);
  };

  const handleDeleteRoom = (id: string) => {
    setRooms((prev) => prev.filter((r) => r.id !== id));
    // Re-assign assets previously bound to this space to unassigned
    setAssets((prev) =>
      prev.map((a) => (a.assignedRoomId === id ? { ...a, assignedRoomId: undefined } : a))
    );
  };

  // Reset CAD workspace to default image specifications
  const handleResetToDefault = () => {
    if (confirm('Are you sure you want to revert all changes? This will restore the exact Digital Twin matching the floor plan blueprint image.')) {
      setRooms(DEFAULT_ROOMS);
      setAssets(DEFAULT_ASSETS);
      setSelectedAssetId(null);
    }
  };

  // Active highlighted item lookup for sidebar coordination
  const selectedAsset = assets.find((a) => a.id === selectedAssetId) || null;

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-50 text-slate-800 font-sans overflow-hidden" id="main-applet-root">
      
      {/* 1. Bento Header Navigation */}
      <nav className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-md">
            <div className="w-4 h-4 border-2 border-white transform rotate-45"></div>
          </div>
          <span className="font-bold text-xl tracking-tight text-slate-900">
            ArchViz <span className="text-blue-600 underline decoration-2 underline-offset-4">Pro</span>
          </span>
          <div className="h-6 w-px bg-slate-200 mx-4"></div>
          <span className="text-sm text-slate-500 font-medium hidden sm:inline">Project: HQ West Wing - Level 4</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick 2D/3D View Selector */}
          <div className="flex bg-slate-100 p-1 rounded-lg mr-2" id="header-viewMode-selector">
            <button
              type="button"
              onClick={() => setViewMode('3D')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${
                viewMode === '3D' ? 'bg-white shadow-sm text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              3D View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('2D')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${
                viewMode === '2D' ? 'bg-white shadow-sm text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              2D Plan
            </button>
          </div>

          <button
            type="button"
            onClick={handleResetToDefault}
            className="px-3 py-1.5 rounded-lg bg-white/95 text-[11px] font-semibold text-rose-600 hover:text-rose-700 shadow-sm border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer hover:bg-slate-50 focus:outline-none"
            title="Revert blueprints matching loaded image specifications"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Reset to Blueprint</span>
          </button>

          <button
            type="button"
            onClick={() => {
              // Procedurally trigger standard Zoho Sync response notice
              const toast = document.createElement('div');
              toast.className = "fixed bottom-14 right-5 bg-blue-600 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl border border-blue-400 z-50 flex items-center gap-2 animate-in slide-in-from-bottom-4 duration-300";
              toast.innerHTML = `<span class="w-1.5 h-1.5 bg-green-400 rounded-full animate-ping"></span><span>Synchronization triggered! Sent ${assets.length} items to Zoho Dev.</span>`;
              document.body.appendChild(toast);
              setTimeout(() => toast.remove(), 3500);
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-md hover:shadow-lg hover:shadow-blue-200 transition-all flex items-center gap-2 cursor-pointer focus:outline-none"
          >
            <Share2 className="w-4 h-4" />
            <span>Push to Zoho Creator</span>
          </button>
        </div>
      </nav>

      {/* 2. Main Content Grid of Bento Containers */}
      <main className="flex-1 flex p-4 gap-4 overflow-hidden bg-slate-50">
        
        {/* LEFT COLUMN: Slim, minimalist Bento tab selector rail */}
        <div className="w-14 flex flex-col gap-4 py-3 bg-white border border-slate-200 rounded-2xl items-center shadow-xs shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('library')}
            className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${
              activeTab === 'library' 
                ? 'bg-blue-50 text-blue-600 border border-blue-100 font-bold' 
                : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'
            }`}
            title="Procurement Library"
          >
            <Cpu className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rooms')}
            className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${
              activeTab === 'rooms' 
                ? 'bg-blue-50 text-blue-600 border border-blue-100 font-bold' 
                : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'
            }`}
            title="Modular Rooms"
          >
            <Layout className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('reports')}
            className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${
              activeTab === 'reports' 
                ? 'bg-blue-50 text-blue-600 border border-blue-100 font-bold' 
                : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'
            }`}
            title="Dynamic Inventory"
          >
            <FileSpreadsheet className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('zoho')}
            className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${
              activeTab === 'zoho' 
                ? 'bg-blue-50 text-blue-600 border border-blue-100 font-bold' 
                : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'
            }`}
            title="Zoho Integration"
          >
            <Share2 className="w-5 h-5" />
          </button>

          <div className="flex-1" />

          {/* Guide launcher */}
          <button
            type="button"
            onClick={() => setShowTutorial(true)}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 mb-2 transition-all"
            title="User Onboarding Guide"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
        </div>

        {/* MIDDLE COLUMN: Large, core 3D Canvas nestled inside a high-end Bento compartment */}
        <div className="flex-1 bg-slate-200 rounded-3xl relative overflow-hidden border border-slate-300 shadow-inner flex flex-col">
          <ThreeCanvas
            rooms={rooms}
            assets={assets}
            selectedAssetId={selectedAssetId}
            onSelectAsset={setSelectedAssetId}
            onUpdateAssetPosition={handleUpdateAssetPosition}
            viewMode={viewMode}
            activeCategoryFilter={activeCategoryFilter}
            activeAssetTypeFilter={activeAssetTypeFilter}
          />
        </div>

        {/* RIGHT COLUMN: Interactive panels styled into gorgeous Bento compartment tiles */}
        <div className="w-80 md:w-96 xl:w-[410px] shrink-0 flex flex-col gap-4 overflow-hidden" id="bento-sidebar-wrapper">
          <CADSidebar
            rooms={rooms}
            assets={assets}
            selectedAsset={selectedAsset}
            onAddAsset={handleAddAsset}
            onUpdateAssetSpecs={handleUpdateAssetSpecs}
            onDeleteAsset={handleDeleteAsset}
            onAddRoom={handleAddRoom}
            onDeleteRoom={handleDeleteRoom}
            activeCategoryFilter={activeCategoryFilter}
            onSetCategoryFilter={setActiveCategoryFilter}
            activeAssetTypeFilter={activeAssetTypeFilter}
            onSetAssetTypeFilter={setActiveAssetTypeFilter}
            viewMode={viewMode}
            onSetViewMode={setViewMode}
            activeTab={activeTab}
            onSetActiveTab={setActiveTab}
          />
        </div>

        {/* Interactive instructional tutorial walkthrough overlay */}
        {showTutorial && (
          <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in" id="tutorial-overlay-backplane">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden p-6 flex flex-col gap-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <Sparkles className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800">Office 3D Digital Twin Planner</h2>
                  <p className="text-xs text-slate-500 font-mono">Bento Grid Architectural Hub</p>
                </div>
              </div>

              <div className="space-y-3 text-xs text-slate-600 leading-normal border-y border-slate-100 py-4">
                <div className="flex gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                  <p><b>Bright, Immersive Navigation:</b> Zoom, pan, and rotate using the mouse. Toggle <b>2D</b> blueprint view or <b>3D</b> extruded architectural layers using the navigation controls.</p>
                </div>
                <div className="flex gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                  <p><b>Mouse Drag Operations:</b> Select any equipment node (APs, CCTV cones, network outlets) by clicking directly. Left-click & drag any item to shift coordinates in space.</p>
                </div>
                <div className="flex gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                  <p><b>Real-time reporting & Zoho Integration:</b> Sync locations into Zoho Creator via the code and Deluge sync block builders in the Zoho tab.</p>
                </div>
              </div>

              <div className="flex justify-between items-center pt-1">
                <span className="text-[10px] text-slate-400 font-mono">Matched to source blueprint image</span>
                <button
                  type="button"
                  onClick={() => setShowTutorial(false)}
                  className="bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white px-5 py-2 rounded-lg shadow-md cursor-pointer transition-all flex items-center gap-1 focus:outline-none"
                >
                  <span>Launch CAD Workspace</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 3. Sleek Architectural Footer */}
      <footer className="h-10 bg-white border-t border-slate-200 px-6 flex items-center justify-between text-[10px] text-slate-400 font-medium shrink-0">
        <div>RENDER ENGINE: <strong>WEBGL CORE v2.4</strong></div>
        <div className="flex items-center gap-4">
          <span>SCALE: 1:50</span>
          <span>GRID_SNAP: 25cm</span>
          <span className="flex items-center gap-1 text-emerald-600 font-bold">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span> 
            SYNCED TO ZOHO REPORTING
          </span>
        </div>
      </footer>
    </div>
  );
}

