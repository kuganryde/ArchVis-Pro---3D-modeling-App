import React, { useState } from 'react';
import {
  Cpu,
  Settings2,
  Layout,
  FileSpreadsheet,
  Database,
  Plus,
  Trash2,
  RotateCw,
  Search,
  SlidersHorizontal,
  Wifi,
  Workflow,
  Hammer,
  Sparkles,
  Layers,
  FileImage,
  Upload,
  Settings,
  MessageSquare
} from 'lucide-react';
import { PlacedAsset, RoomDefinition } from '../types';
import { isOverlapping, isAssetOutsideRooms } from '../utils/geometry';
import { showToast } from '../utils/toast';
import BomPanel from './BomPanel';

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
  activeTab: 'library' | 'rooms' | 'reports';
  onSetActiveTab: (tab: 'library' | 'rooms' | 'reports') => void;
  showWifiHeatmap: boolean;
  onSetShowWifiHeatmap: (v: boolean) => void;
  showCablingPaths: boolean;
  onSetShowCablingPaths: (v: boolean) => void;
  onApplyRoomSetupTemplate: (roomId: string, templateType: string) => void;
  onResetCanvas: () => void;
  onImportJSON: (json: any) => void;
  onRebuildFromPrompt: (prompt: string) => Promise<void>;
  
  // Custom Blueprint Underlay/Uploader interface
  blueprintImage: string | null;
  onBlueprintLoaded: (image: string | null, aspect: number) => void;
  blueprintOpacity: number;
  onSetBlueprintOpacity: (opacity: number) => void;
  blueprintScale: number;
  onSetBlueprintScale: (scale: number) => void;
  blueprintOffsetX: number;
  onSetBlueprintOffsetX: (x: number) => void;
  blueprintOffsetZ: number;
  onSetBlueprintOffsetZ: (z: number) => void;
  blueprintVisible: boolean;
  onSetBlueprintVisible: (v: boolean) => void;
  onDigitizeBlueprint: (base64Data: string, mimeType: string) => Promise<void>;
  isDigitizing: boolean;
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
  onSetActiveTab,
  showWifiHeatmap,
  onSetShowWifiHeatmap,
  showCablingPaths,
  onSetShowCablingPaths,
  onApplyRoomSetupTemplate,
  onResetCanvas,
  onImportJSON,
  onRebuildFromPrompt,
  
  blueprintImage,
  onBlueprintLoaded,
  blueprintOpacity,
  onSetBlueprintOpacity,
  blueprintScale,
  onSetBlueprintScale,
  blueprintOffsetX,
  onSetBlueprintOffsetX,
  blueprintOffsetZ,
  onSetBlueprintOffsetZ,
  blueprintVisible,
  onSetBlueprintVisible,
  onDigitizeBlueprint,
  isDigitizing
}: CADSidebarProps) {
  
  // Custom Room creation local states
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomWidth, setNewRoomWidth] = useState(4.0);
  const [newRoomDepth, setNewRoomDepth] = useState(4.0);
  const [newRoomColor, setNewRoomColor] = useState('#f0f9ff');

  // Blueprint file uploader local states
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  // Dynamic uploader for JPEG, PNG, PDF formats
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    setFileError(null);

    const fileName = file.name.toLowerCase();
    
    try {
      if (fileName.endsWith('.pdf')) {
        // Dynamic loading function for PDF.js CDN
        const loadPDFJS = (): Promise<any> => {
          return new Promise((resolve, reject) => {
            const win = window as any;
            if (win.pdfjsLib) {
              resolve(win.pdfjsLib);
              return;
            }
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
            script.onload = () => {
              win.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
              resolve(win.pdfjsLib);
            };
            script.onerror = () => reject(new Error('Failed to load PDF processing engine.'));
            document.head.appendChild(script);
          });
        };

        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const typedarray = new Uint8Array(event.target?.result as ArrayBuffer);
            const pdfjs = await loadPDFJS();
            const pdf = await pdfjs.getDocument({ data: typedarray }).promise;
            
            if (pdf.numPages === 0) {
              throw new Error('This PDF has no readable pages.');
            }
            
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 2.0 }); // higher scale for crisp high-density texture!
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            
            if (!context) throw new Error('Could not instantiate drawing context.');
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            const renderContext = {
              canvasContext: context,
              viewport: viewport
            };
            
            await page.render(renderContext).promise;
            const dataUrl = canvas.toDataURL('image/png');
            const aspect = viewport.width / viewport.height;
            
            onBlueprintLoaded(dataUrl, aspect);
            setIsProcessingFile(false);
            showToast('Rendered PDF blueprint (page 1) onto the canvas floor.', 'info');
          } catch (err: any) {
            console.error(err);
            setFileError(err.message || 'Failed parsing PDF document.');
            setIsProcessingFile(false);
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        // Generic photo formats like JPEG, JPG, PNG, WEBP, SVG
        const reader = new FileReader();
        reader.onload = (event) => {
          const dataUrl = event.target?.result as string;
          const img = new Image();
          img.onload = () => {
            const aspect = img.width / img.height;
            onBlueprintLoaded(dataUrl, aspect);
            setIsProcessingFile(false);
            showToast('Uploaded blueprint image onto the canvas floor.', 'info');
          };
          img.onerror = () => {
            setFileError('Invalid image format uploaded.');
            setIsProcessingFile(false);
          };
          img.src = dataUrl;
        };
        reader.readAsDataURL(file);
      }
    } catch (err: any) {
      console.error(err);
      setFileError(err.message || 'Error loading file.');
      setIsProcessingFile(false);
    }
  };

  // Search state inside Reporting module
  const [assetSearchQuery, setAssetSearchQuery] = useState('');
  const [filterTypeSelector, setFilterTypeSelector] = useState('all');
  const [customParamName, setCustomParamName] = useState('');

  // Library Items catalog
  const libraryCatalog = [
    { type: 'ap', category: 'infrastructure', label: 'Access Point (AP)', count: 12, desc: 'Dual-band transmitter AP-535 router ceiling nodes.' },
    { type: 'dp', category: 'infrastructure', label: 'LAN / Data Port (DP)', count: 23, desc: 'Wall/floor RJ45 network cable connection socket.' },
    { type: 'tp', category: 'infrastructure', label: 'Phone Line Port (TP)', count: 8, desc: 'Analog/VoIP communications system telephone port.' },
    { type: 'power_outlet', category: 'infrastructure', label: 'Power Point / Outlet', count: 7, desc: 'UPS-backed high voltage blue power socket.' },
    { type: 'hdmi_port', category: 'infrastructure', label: 'HDMI Interface Port', count: 4, desc: 'High-speed multimedia gold-plated display wallplate/table connection.' },
    { type: 'projector_port', category: 'infrastructure', label: 'Projector Port (VGA/Ctrl)', count: 2, desc: 'Control signal and audio-video projector interface connector.' },
    { type: 'cctv', category: 'infrastructure', label: 'CCTV Camera', count: 6, desc: 'High Definition dome with transparent active feed view.' },
    { type: 'door_access', category: 'infrastructure', label: 'Door Access System', count: 3, desc: 'RFID biometrics scan controller secure key.' },
    { type: 'intercom', category: 'infrastructure', label: 'Intercom Station', count: 1, desc: 'Lobby VoIP intercom with display and call capability.' },
    
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
    hdmi: assets.filter(a => a.type === 'hdmi_port').length,
    projector: assets.filter(a => a.type === 'projector_port').length,
    furniture: assets.filter(a => a.category === 'furniture').length,
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
        areaSqFt: Math.round(r.width * r.depth * 10.7639),
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
      areaSqFt: Math.round(Number(newRoomWidth) * Number(newRoomDepth) * 10.7639),
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
              activeTab === 'library' ? 'bg-white shadow-xs text-violet-600 font-bold border border-slate-200/40' : ''
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Library</span>
          </button>
          <button
            type="button"
            onClick={() => onSetActiveTab('rooms')}
            className={`flex-1 py-2 text-center rounded-lg flex items-center justify-center gap-1.5 transition-all text-slate-505 hover:text-slate-900 cursor-pointer ${
              activeTab === 'rooms' ? 'bg-white shadow-xs text-violet-600 font-bold border border-slate-200/40' : ''
            }`}
          >
            <Layout className="w-3.5 h-3.5" />
            <span>Rooms</span>
          </button>
          <button
            type="button"
            onClick={() => onSetActiveTab('reports')}
            className={`flex-1 py-2 text-center rounded-lg flex items-center justify-center gap-1.5 transition-all text-slate-505 hover:text-slate-900 cursor-pointer ${
              activeTab === 'reports' ? 'bg-white shadow-xs text-violet-600 font-bold border border-slate-200/40' : ''
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Inventory</span>
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
                        ? 'bg-violet-600 text-white shadow-sm' 
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

              {/* Intelligent Low-Current Network Optimization Panel */}
              <div className="p-3.5 rounded-xl border border-violet-100 bg-gradient-to-br from-violet-50/50 to-violet-50/20 space-y-3 shadow-3xs" id="network-telemetry-panel">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Wifi className="w-4 h-4 text-violet-600 animate-pulse" />
                    <span className="text-xs font-bold text-slate-800 tracking-tight font-sans">Network Infrastructure Overlays</span>
                  </div>
                  <span className="text-[9.5px] font-mono font-bold bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-md">MDU v1.5</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onSetShowWifiHeatmap(!showWifiHeatmap)}
                    className={`py-1.5 px-2 text-[11px] rounded-lg border font-semibold flex items-center justify-center gap-1 cursor-pointer transition-all ${
                      showWifiHeatmap 
                        ? 'bg-violet-600 border-violet-600 text-white font-bold shadow-xs' 
                        : 'bg-white border-slate-200 text-slate-650 hover:bg-slate-50'
                    }`}
                  >
                    <Wifi className="w-3.5 h-3.5" />
                    2D Wi-Fi Range
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetShowCablingPaths(!showCablingPaths)}
                    className={`py-1.5 px-2 text-[11px] rounded-lg border font-semibold flex items-center justify-center gap-1 cursor-pointer transition-all ${
                      showCablingPaths 
                        ? 'bg-violet-600 border-violet-600 text-white font-bold shadow-xs' 
                        : 'bg-white border-slate-200 text-slate-650 hover:bg-slate-50'
                    }`}
                  >
                    <Workflow className="w-3.5 h-3.5" />
                    Cable Pathways
                  </button>
                </div>

                {/* AI Optimal AP Placement Recommendation Engine */}
                <div className="bg-white/80 border border-slate-200/60 rounded-lg p-2 flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-[10px] text-slate-500 font-medium">
                    <span className="font-mono flex items-center gap-1"><Cpu className="w-3 h-3 text-violet-500" /> Optimal AP Planner</span>
                    <span className="text-emerald-600 font-bold">Auto-Placement Ready</span>
                  </div>
                  <p className="text-[10px] text-slate-550 leading-tight">
                    Scans spatial plans, computes coverage boundaries, and suggests layouts to eliminate dead zones automatically.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      // Execute intelligent AP dead-zone auto-position placement!
                      const suggestedRooms = ['open_workspace', 'long_meeting', 'lounge_reception'];
                      const existingAPs = assets.filter(a => a.type === 'ap');
                      
                      let placedCount = 0;
                      suggestedRooms.forEach(roomId => {
                        const hasAP = existingAPs.some(ap => ap.assignedRoomId === roomId);
                        if (!hasAP) {
                          onAddAsset('ap');
                          placedCount++;
                        }
                      });

                      const toast = document.createElement('div');
                      toast.className = "fixed bottom-14 right-5 bg-violet-600 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl border border-violet-400 z-50 flex items-center gap-2 animate-in slide-in-from-bottom-4 duration-300";
                      if (placedCount > 0) {
                        toast.innerHTML = `<span class="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping"></span><span>Auto-Optimizer placed ${placedCount} high-density Access Points to eliminate dead-zones!</span>`;
                      } else {
                        toast.innerHTML = `<span class="w-1.5 h-1.5 bg-cyan-400 rounded-full"></span><span>Coverage is fully optimized. 100% signal boundary achieved!</span>`;
                      }
                      document.body.appendChild(toast);
                      setTimeout(() => toast.remove(), 4000);
                    }}
                    className="w-full mt-0.5 bg-slate-900 text-white text-[10.5px] font-bold py-1 px-2.5 rounded-md hover:bg-slate-800 transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    Auto-Optimize AP Distribution
                  </button>
                </div>
              </div>

              {/* Quick device selector dropdown */}
              <div className="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-xl border border-slate-200/60">
                <span className="text-xs text-slate-500 font-mono font-medium">Device filter:</span>
                <select
                  value={activeAssetTypeFilter}
                  onChange={(e) => onSetAssetTypeFilter(e.target.value)}
                  className="bg-white border border-slate-220 rounded-lg px-2 py-0.5 text-xs text-slate-700 font-medium focus:outline-none focus:border-violet-500 cursor-pointer"
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
                                ? 'bg-violet-50 text-violet-600 group-hover:bg-violet-100' 
                                : 'bg-orange-50 text-orange-650 group-hover:bg-orange-100'
                            } transition-all`}>
                              {item.category === 'infrastructure' ? <Cpu className="w-4 h-4" /> : <Layout className="w-4 h-4" />}
                            </div>
                            <div className="max-w-[180px] md:max-w-xs font-sans">
                              <span className="text-xs font-bold text-slate-800 group-hover:text-violet-700 block">{item.label}</span>
                              <span className="text-[10.5px] text-slate-500 block leading-tight mt-0.5">{item.desc}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {item.count !== undefined && (
                              <span className="text-[9.5px] font-bold bg-slate-100 border border-slate-200 text-slate-500 px-1.5 py-0.5 rounded font-mono">
                                {currentPlacedCount}/{item.count}
                              </span>
                            )}
                            <div className="p-1.5 rounded-lg bg-violet-50 text-violet-600 group-hover:bg-violet-600 group-hover:text-white transition-all shadow-xs">
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
              
              {/* quick actions */}
              <div className="p-4 rounded-xl border border-violet-100 bg-violet-50/30 space-y-3">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <Settings2 className="w-3.5 h-3.5 text-violet-600" />
                  Quick Canvas Actions
                </h3>
                
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={onResetCanvas} className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white border border-slate-200 hover:border-red-300 hover:bg-red-50 text-slate-600 hover:text-red-700 text-xs font-bold transition-all shadow-xs">
                    <Trash2 className="w-3.5 h-3.5"/> Blank Canvas
                  </button>
                  <label className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white border border-slate-200 hover:border-violet-300 hover:bg-violet-50 text-slate-600 hover:text-violet-700 text-xs font-bold transition-all shadow-xs cursor-pointer">
                    <Database className="w-3.5 h-3.5"/> Import JSON
                    <input type="file" accept=".json" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        try {
                          const json = JSON.parse(ev.target?.result as string);
                          onImportJSON(json);
                        } catch (err) { alert('Invalid JSON file'); }
                      };
                      reader.readAsText(file);
                    }} hidden />
                  </label>
                </div>

                <div className="space-y-2 pt-1">
                  <div className="relative">
                    <input 
                      type="text" 
                      placeholder="Prompt AI to rebuild layout..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          onRebuildFromPrompt((e.target as HTMLInputElement).value);
                          (e.target as HTMLInputElement).value = '';
                        }
                      }}
                      className="w-full text-xs py-2 pl-8 pr-3 rounded-lg border border-slate-200 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all font-sans"                
                    />
                    <MessageSquare className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  </div>
                </div>
              </div>

              {/* FLOOR PLAN BLUEPRINT UPLOADER & TRACING CONTROLS */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-4">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between border-b border-slate-100 pb-2 mb-1 font-mono">
                  <span className="flex items-center gap-1.5">
                    <FileImage className="w-3.5 h-3.5 text-violet-600" />
                    Blueprint Uploader
                  </span>
                  {blueprintImage && (
                    <span className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded-full border border-green-200 font-bold font-sans animate-pulse">
                      Active Guide
                    </span>
                  )}
                </h3>

                {/* FILE DRAG ZONE */}
                <div className="relative">
                  <label 
                    className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                      blueprintImage 
                        ? 'border-violet-300 bg-violet-50/20 hover:bg-violet-50/40' 
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                    }`}
                  >
                    <input 
                      type="file" 
                      accept=".pdf, image/png, image/jpeg, image/jpg, image/webp, image/svg+xml" 
                      onChange={handleFileChange} 
                      className="hidden" 
                    />
                    <Upload className={`w-6 h-6 mb-2 ${blueprintImage ? 'text-violet-500 animate-bounce' : 'text-slate-400'}`} />
                    <span className="text-xs font-bold text-slate-700 block">
                      {blueprintImage ? 'Replace active blueprints' : 'Upload floor plan blueprint'}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-1 leading-normal">
                      Supports PDF documents, JPEGs, and PNGs
                    </span>
                  </label>

                  {isProcessingFile && (
                    <div className="absolute inset-0 bg-white/85 flex flex-col items-center justify-center rounded-xl space-y-2">
                      <div className="w-5 h-5 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
                      <span className="text-[10px] text-violet-700 font-bold font-mono">Rendering PDF layout to canvas...</span>
                    </div>
                  )}
                </div>

                {fileError && (
                  <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-[10px] font-sans leading-relaxed">
                    <strong>Upload Error:</strong> {fileError}
                  </div>
                )}

                {/* TRACING POSITIONING MECHANICS (Shows only when blueprint loaded) */}
                {blueprintImage && (
                  <div className="space-y-3 pt-2 bg-slate-50/30 p-3 rounded-lg border border-slate-100">
                    <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                      <span className="text-[10px] font-bold text-slate-800 uppercase tracking-wide font-mono flex items-center gap-1">
                        <Settings className="w-3 h-3 text-slate-550" /> Trace Calibration
                      </span>
                      <button
                        type="button"
                        onClick={() => onBlueprintLoaded(null, 1.33)}
                        className="text-[10px] text-red-500 hover:text-red-700 hover:underline font-bold bg-transparent border-none cursor-pointer animate-in fade-in"
                      >
                        Clear Underlay
                      </button>
                    </div>

                    {/* Visiblity Toggle */}
                    <div className="flex items-center justify-between">
                      <span className="text-[10.5px] text-slate-600 font-medium">Overlay blueprint guide underlay</span>
                      <input 
                        type="checkbox"
                        checked={blueprintVisible}
                        onChange={(e) => onSetBlueprintVisible(e.target.checked)}
                        className="w-4 h-4 rounded text-violet-600 accent-violet-600 cursor-pointer"
                      />
                    </div>

                    {/* Scale Sizer Slider */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10.5px]">
                        <span className="text-slate-600 font-medium">Layout Target Width (Meters)</span>
                        <span className="text-violet-700 font-mono font-bold">{blueprintScale}m</span>
                      </div>
                      <input 
                        type="range"
                        min="10"
                        max="100"
                        step="1"
                        value={blueprintScale}
                        onChange={(e) => onSetBlueprintScale(Number(e.target.value))}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-violet-600"
                      />
                    </div>

                    {/* Opacity slider */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10.5px]">
                        <span className="text-slate-600 font-medium">Guide Map Opacity</span>
                        <span className="text-violet-700 font-mono font-bold">{Math.round(blueprintOpacity * 100)}%</span>
                      </div>
                      <input 
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={blueprintOpacity}
                        onChange={(e) => onSetBlueprintOpacity(Number(e.target.value))}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-violet-600"
                      />
                    </div>

                    {/* Offset coordinates */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-500 block font-mono">Offset X: {blueprintOffsetX}m</span>
                        <input 
                          type="range"
                          min="-30"
                          max="30"
                          step="0.5"
                          value={blueprintOffsetX}
                          onChange={(e) => onSetBlueprintOffsetX(Number(e.target.value))}
                          className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-650"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-500 block font-mono">Offset Z: {blueprintOffsetZ}m</span>
                        <input 
                          type="range"
                          min="-30"
                          max="30"
                          step="0.5"
                          value={blueprintOffsetZ}
                          onChange={(e) => onSetBlueprintOffsetZ(Number(e.target.value))}
                          className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-650"
                        />
                      </div>
                    </div>

                    {/* AI OCR SCANNER BUTTON! */}
                    <div className="border-t border-slate-200/50 pt-2.5 mt-1">
                      <button
                        type="button"
                        disabled={isDigitizing}
                        onClick={() => {
                          const mime = blueprintImage.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
                          const cleanBase64 = blueprintImage.replace(/^data:image\/[a-z]+;base64,/, '');
                          onDigitizeBlueprint(cleanBase64, mime);
                        }}
                        className="w-full bg-gradient-to-r from-violet-600 to-violet-600 hover:from-violet-700 hover:to-violet-700 text-white font-bold py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-sm hover:shadow-md transition-all cursor-pointer border border-violet-500/30 disabled:opacity-80"
                      >
                        {isDigitizing ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>AI Digitizing Layout...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" />
                            <span>Run AI Digitizer on Blueprint</span>
                          </>
                        )}
                      </button>
                      <p className="text-[9px] text-slate-400 mt-1.5 leading-normal text-center">
                        Generates high-precision room spaces and suggested networking hardware automatically in 3D using server-side Gemini Vision OCR models.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Create dynamic Room Placer form */}
              <form onSubmit={triggerAddRoom} className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 space-y-3">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-2 mb-1 font-mono">
                  <Plus className="w-3.5 h-3.5 text-violet-600" /> Instantiate Custom Modular Space
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
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-violet-500 placeholder-slate-400 font-sans"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 block font-mono">Design Area (SQFT) [Auto]</label>
                    <input
                      type="text"
                      readOnly
                      value={`${Math.round(Number(newRoomWidth) * Number(newRoomDepth) * 10.7639)} SQFT`}
                      className="w-full bg-slate-100 border border-slate-200/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-505 font-mono font-bold select-none cursor-not-allowed opacity-90"
                      title="Automatically calculated from Room Width and Depth dimensions"
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
                          className={`w-4 h-4 rounded-full border border-slate-300 cursor-pointer ${newRoomColor === color ? 'ring-2 ring-violet-500 scale-110 shadow-sm' : 'opacity-80'}`}
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
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-violet-500 font-mono"
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
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-violet-500 font-mono"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-violet-600 hover:bg-violet-700 text-xs text-white py-2 rounded-lg font-bold shadow-xs transition-all mt-2 cursor-pointer flex items-center justify-center gap-1.5"
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
                            <span className="text-[10.5px] text-slate-550 font-mono block mt-0.5">{Math.round(room.width * room.depth * 10.7639)} SQFT | {room.width}m x {room.depth}m | {occupantsCount} nodes</span>
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

              {/* Intelligent Room Setup Assembler */}
              <div className="p-3.5 bg-gradient-to-br from-violet-50/40 via-slate-50 to-slate-100 rounded-xl border border-slate-200/80 space-y-3 shadow-3xs mt-2 text-sans" id="parametric-templates-panel">
                <div className="flex items-center gap-1.5 font-sans">
                  <Layers className="w-4 h-4 text-violet-600" />
                  <span className="text-xs font-bold text-slate-800 tracking-tight font-sans">Deploy Parametric Setups / Fittings</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Instantly fits out an architectural zone with pre-designed, specs-loaded furniture arrangements and specialized A/V setups.
                </p>

                <div className="space-y-2 font-sans">
                  <div className="space-y-0.5">
                    <label className="text-[9px] font-bold text-slate-400 block font-mono">Select Target Room</label>
                    <select
                      id="template-target-room"
                      defaultValue={rooms[0]?.id || ''}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-850 focus:outline-none focus:border-violet-500 font-sans cursor-pointer font-semibold font-sans"
                    >
                      {rooms.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-0.5 font-sans">
                    <label className="text-[9px] font-bold text-slate-400 block font-mono">Select Functional Setup Blueprint</label>
                    <select
                      id="template-type-select"
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-850 focus:outline-none focus:border-violet-500 font-sans cursor-pointer font-semibold font-sans"
                    >
                      <option value="boardroom_8">8-Person Boardroom (Specs-loaded Table & A/V)</option>
                      <option value="workstations_4">4-Pax Agile Workspace Group (Bench, Chairs, Data Port)</option>
                      <option value="exec_suite">Executive Office arrangements (Sofa, Desk, Tel Outlets)</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const roomEl = document.getElementById('template-target-room') as HTMLSelectElement;
                      const tempEl = document.getElementById('template-type-select') as HTMLSelectElement;
                      if (roomEl && tempEl) {
                        onApplyRoomSetupTemplate(roomEl.value, tempEl.value);
                      }
                    }}
                    className="w-full bg-violet-600 hover:bg-violet-700 text-white text-[10.5px] font-bold py-1.5 rounded-lg shadow-sm font-sans transition-all flex items-center justify-center gap-1 cursor-pointer mt-1 font-sans"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Apply Arrangement Fitting</span>
                  </button>
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
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-9 py-2.5 text-xs text-slate-700 placeholder-slate-405 focus:outline-none focus:border-violet-500 font-mono"
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
                          ? 'bg-violet-600 text-white border-violet-600 font-bold' 
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
                  <p className="text-lg font-bold font-mono text-violet-600 flex items-baseline gap-1">
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

              {/* Bill of Materials */}
              <BomPanel assets={assets} />

              {/* Dynamic Inventory Table */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Device Log</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleExportCSV}
                      className="text-[10px] font-bold text-violet-600 hover:text-violet-755 flex items-center gap-1 cursor-pointer font-sans"
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
        </div>
      </div>

      {/* CARD B: SELECTED ELEMENT INSPECTOR */}
      <div className="border border-slate-200 p-4 rounded-2xl bg-white shadow-xs shrink-0" id="cad-sidebar-footer">
        {selectedAsset ? (
          <div className="space-y-3 animate-in slide-in-from-bottom duration-150 font-sans" id="active-asset-inspector-panel">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs uppercase font-mono">
                <Settings2 className="w-4 h-4 text-violet-600 animate-spin" style={{ animationDuration: '8s' }} />
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-violet-500 font-sans font-medium hover:border-slate-300 transition-all font-sans"
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:border-violet-500 font-sans text-xs font-semibold cursor-pointer"
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
                  <span className="text-[10px] text-violet-600 font-mono font-bold">{(selectedAsset.rotationY * (180 / Math.PI)).toFixed(0)}°</span>
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
                    className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-violet-600"
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
                    <div className="flex justify-between items-center">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block font-mono">{key}</label>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = { ...(selectedAsset.specs || {}) };
                          delete updated[key];
                          onUpdateAssetSpecs(selectedAsset.id, updated, selectedAsset.name, selectedAsset.rotationY, selectedAsset.assignedRoomId);
                        }}
                        className="text-slate-300 hover:text-[red] transition-all p-0.5 cursor-pointer"
                        title={`Delete ${key} attribute`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={val}
                      onChange={(e) => {
                        const updated = { ...(selectedAsset.specs || {}) };
                        updated[key] = e.target.value;
                        onUpdateAssetSpecs(selectedAsset.id, updated, selectedAsset.name, selectedAsset.rotationY, selectedAsset.assignedRoomId);
                      }}
                      className="w-full bg-slate-55 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-850 focus:outline-none focus:border-violet-500 font-mono"
                    />
                  </div>
                );
              })}

              {/* Intelligent BIM Parametric Manager Suite */}
              <div className="mt-3 bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono flex items-center gap-1">
                    <Hammer className="w-3.5 h-3.5 text-violet-600" /> Parametric BIM Actions
                  </span>
                </div>

                <div className="flex gap-1.5 justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      const updated = { ...(selectedAsset.specs || {}) };
                      // Inject typical advanced BIM specs based on item category
                      updated['Manufacturer'] = selectedAsset.category === 'furniture' ? 'Steelcase Inc.' : 'Axis Communications';
                      updated['Cost'] = selectedAsset.category === 'furniture' ? '$450.00' : '$850.00';
                      updated['Weight'] = selectedAsset.category === 'furniture' ? '12.5 kg' : '1.2 kg';
                      updated['Power Needs'] = selectedAsset.category === 'furniture' ? 'None' : 'PoE+ (15.4W)';
                      updated['Install Date'] = '11-June-2026';
                      updated['Asset Tag'] = `BIM-F-${selectedAsset.id.toUpperCase()}`;

                      onUpdateAssetSpecs(selectedAsset.id, updated, selectedAsset.name, selectedAsset.rotationY, selectedAsset.assignedRoomId);

                      const toast = document.createElement('div');
                      toast.className = "fixed bottom-14 right-5 bg-violet-600 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl z-50 flex items-center gap-1.5 animate-in slide-in-from-bottom-4 duration-300";
                      toast.innerHTML = `<span>Populated parametric spec values matching Steelcase/Aruba standard benchmarks!</span>`;
                      document.body.appendChild(toast);
                      setTimeout(() => toast.remove(), 3500);
                    }}
                    className="w-full bg-violet-600 hover:bg-violet-700 text-white text-[10.5px] font-bold py-1 px-2.5 rounded-lg transition-all text-center cursor-pointer shadow-3xs"
                  >
                    Load Standard BIM Specs
                  </button>
                </div>

                {/* Append custom spec parameters */}
                <div className="flex gap-1 items-center border-t border-slate-200/60 pt-2">
                  <input
                    type="text"
                    placeholder="e.g. Weight or FireRating"
                    value={customParamName}
                    onChange={(e) => setCustomParamName(e.target.value)}
                    className="flex-1 bg-white border border-slate-200 rounded-md px-2 py-1 text-[10.5px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-violet-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!customParamName.trim()) return;
                      const validKey = customParamName.trim().replace(/[^a-zA-Z0-9_\s]/g, '');
                      if (!validKey) return;
                      const updated = { ...(selectedAsset.specs || {}) };
                      updated[validKey] = '';
                      onUpdateAssetSpecs(selectedAsset.id, updated, selectedAsset.name, selectedAsset.rotationY, selectedAsset.assignedRoomId);
                      setCustomParamName('');
                    }}
                    className="bg-slate-900 border border-slate-900 text-white text-[10px] font-extrabold px-2.5 py-1 rounded-md hover:bg-slate-800 cursor-pointer transition-all shrink-0"
                  >
                    + Add Field
                  </button>
                </div>
              </div>
            </div>
            
            <div className="text-[9px] text-slate-400 font-mono border-t border-slate-100 pt-2 flex justify-between pr-1">
              <span>COORDINATE MAP:</span>
              <span className="font-bold text-slate-500">X: {selectedAsset.position.x.toFixed(2)}m, Z: {selectedAsset.position.z.toFixed(2)}m</span>
            </div>

            {(() => {
              const isOutside = isAssetOutsideRooms(selectedAsset, rooms);
              const isColliding = assets.some((other) => other.id !== selectedAsset.id && isOverlapping(selectedAsset, other));
              if (isOutside || isColliding) {
                return (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-[10px] font-medium flex flex-col gap-1 mt-1">
                    <div className="font-bold flex items-center gap-1.5 font-mono uppercase tracking-wider text-[9px] text-rose-600">
                      <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse inline-block" />
                      Placement Conflict Alert
                    </div>
                    {isOutside && <div className="leading-tight">• Selected asset is placed outside defined room boundaries</div>}
                    {isColliding && <div className="leading-tight">• Selected asset overlaps with another physical entity</div>}
                  </div>
                );
              }
              return null;
            })()}
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
