/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import ThreeCanvas from './components/ThreeCanvas';
import CADSidebar from './components/CADSidebar';
import { DEFAULT_ROOMS, DEFAULT_ASSETS } from './data/defaultFloorPlan';
import { PlacedAsset, RoomDefinition } from './types';
import { findContainingRoom, getDefaultHeight, isInfrastructureType, makeId } from './utils/geometry';
import { mapApiLayout } from './utils/layout';
import { saveDesign, loadDesign, clearDesign } from './utils/persistence';
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
  Share2,
  Key,
  ShieldAlert,
  Save,
  Code2,
  Image as ImageIcon,
  FileText,
  Copy,
  Download
} from 'lucide-react';

// Restore a previously autosaved design, falling back to the default layout.
const persisted = typeof window !== 'undefined' ? loadDesign() : null;

// Google Analytics measurement ID, configured via the VITE_GA_MEASUREMENT_ID
// env var. When unset, analytics stays completely disabled.
const GA_MEASUREMENT_ID = (import.meta as any).env?.VITE_GA_MEASUREMENT_ID as string | undefined;

export default function App() {
  const [rooms, setRooms] = useState<RoomDefinition[]>(persisted?.rooms ?? DEFAULT_ROOMS);
  const [assets, setAssets] = useState<PlacedAsset[]>(persisted?.assets ?? DEFAULT_ASSETS);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  // Snapshot function registered by ThreeCanvas for PNG exports.
  const captureRef = useRef<(() => string | null) | null>(null);

  // Gemini BYOK (Bring Your Own Key) State
  const [geminiApiKey, setGeminiApiKey] = useState<string>('');
  const [showApiKeyModal, setShowApiKeyModal] = useState<boolean>(false);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [pendingAiAction, setPendingAiAction] = useState<(() => void) | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('gemini_api_key');
    if (stored) setGeminiApiKey(stored);
  }, []);

  // Initialise Google Analytics once, only when a measurement ID is configured.
  useEffect(() => {
    if (!GA_MEASUREMENT_ID || typeof window === 'undefined') return;
    const w = window as any;
    if (w.gtag) return; // already initialised

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    document.head.appendChild(script);

    w.dataLayer = w.dataLayer || [];
    w.gtag = function gtag() {
      w.dataLayer.push(arguments);
    };
    w.gtag('js', new Date());
    w.gtag('config', GA_MEASUREMENT_ID);
  }, []);

  const saveApiKey = (key: string) => {
    const cleaned = key.trim();
    if (!cleaned) return;
    setGeminiApiKey(cleaned);
    sessionStorage.setItem('gemini_api_key', cleaned);
    setShowApiKeyModal(false);
    if (pendingAiAction) {
      pendingAiAction();
      setPendingAiAction(null);
    }
  };
  
  // HUD Filters state
  const [viewMode, setViewMode] = useState<'2D' | '3D'>('3D');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<'all' | 'furniture' | 'infrastructure'>('all');
  const [activeAssetTypeFilter, setActiveAssetTypeFilter] = useState<string | 'all'>('all');
  const [showOccupancyHeatmap, setShowOccupancyHeatmap] = useState(false);
  const [showWifiHeatmap, setShowWifiHeatmap] = useState(false);
  const [showCablingPaths, setShowCablingPaths] = useState(false);

  // Interactive help tour state
  const [showTutorial, setShowTutorial] = useState(true);

  // Tab state synced with high-contrast vertical bento rail
  const [activeTab, setActiveTab] = useState<'library' | 'rooms' | 'reports'>('library');

  // Track page views when user switches between important active tabs or view modes
  useEffect(() => {
    if (GA_MEASUREMENT_ID && typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('config', GA_MEASUREMENT_ID, {
        page_title: `ArchViz Pro - ${activeTab.toUpperCase()} Section (${viewMode})`,
        page_path: `/${activeTab}/${viewMode.toLowerCase()}`
      });
    }
  }, [activeTab, viewMode]);

  // Asset counts generator for quick lookup
  const nextAssetIdNumberRef = React.useRef(99);

  // Instantiate assets dynamically at standard focus points
  const handleAddAsset = (type: string) => {
    nextAssetIdNumberRef.current += 1;
    const uid = makeId(type);

    const category: 'infrastructure' | 'furniture' = isInfrastructureType(type)
      ? 'infrastructure'
      : 'furniture';
    const height = getDefaultHeight(type);
    let label = '';
    let defaultSpecs: Record<string, string> = {};

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
      case 'hdmi_port':
        label = `HDMI Port-${nextAssetIdNumberRef.current - 90}`;
        defaultSpecs = {
          ID: `HDMI-PORT-${nextAssetIdNumberRef.current - 90}`,
          Version: 'HDMI 2.1 UHD',
          Location: 'Wall / Table Grommet',
          Shielding: 'Gold-Plated Triple'
        };
        break;
      case 'projector_port':
        label = `Projector Port-${nextAssetIdNumberRef.current - 90}`;
        defaultSpecs = {
          ID: `PROJ-PORT-${nextAssetIdNumberRef.current - 90}`,
          Connection: 'VGA / HDMI Loop',
          Control: 'RS-232 Serial',
          Location: 'Wall Faceplate'
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
    // Find if the coordinates fall within any room boundaries dynamically
    const containingRoom = findContainingRoom(x, z, rooms);

    setAssets((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              position: { ...a.position, x, z },
              assignedRoomId: containingRoom ? containingRoom.id : undefined,
            }
          : a
      )
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

  // Blueprint trace ground underlay states
  const [blueprintImage, setBlueprintImage] = useState<string | null>(persisted?.blueprintImage ?? null);
  const [blueprintAspect, setBlueprintAspect] = useState<number>(1.33); // standard widescreen
  const [blueprintOpacity, setBlueprintOpacity] = useState<number>(0.5);
  const [blueprintScale, setBlueprintScale] = useState<number>(40); // default meter workspace width
  const [blueprintOffsetX, setBlueprintOffsetX] = useState<number>(0);
  const [blueprintOffsetZ, setBlueprintOffsetZ] = useState<number>(0);
  const [blueprintVisible, setBlueprintVisible] = useState<boolean>(true);
  const [isDigitizing, setIsDigitizing] = useState<boolean>(false);

  // Autosave the working design (debounced) so a refresh no longer wipes it.
  useEffect(() => {
    const handle = setTimeout(() => saveDesign(rooms, assets, blueprintImage), 600);
    return () => clearTimeout(handle);
  }, [rooms, assets, blueprintImage]);

  const handleBlueprintLoaded = (image: string | null, aspect: number) => {
    setBlueprintImage(image);
    setBlueprintAspect(aspect);
    setBlueprintOffsetX(0);
    setBlueprintOffsetZ(0);
  };

  const handleDigitizeBlueprint = async (base64Data: string, mimeType: string) => {
    if (!geminiApiKey) {
      setPendingAiAction(() => () => handleDigitizeBlueprint(base64Data, mimeType));
      setShowApiKeyModal(true);
      return;
    }

    setIsDigitizing(true);
    try {
      const response = await fetch('/api/digitize-blueprint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-api-key': geminiApiKey,
        },
        body: JSON.stringify({ base64Data, mimeType }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const err = new Error(errorData.error || 'Failed scanning the uploaded blueprint file.');
        (err as any).status = response.status;
        throw err;
      }

      const data = await response.json();

      // Normalise the loosely-typed AI payload into strongly-typed state.
      const { rooms: mappedRooms, assets: mappedAssets } = mapApiLayout(data);

      // Update states
      setRooms(mappedRooms);
      setAssets(mappedAssets);

      // Create browser notice toast
      const toast = document.createElement('div');
      toast.className = "fixed bottom-14 right-5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl border border-emerald-400 z-50 flex items-center gap-1.5 animate-in slide-in-from-bottom-4 duration-300";
      toast.innerHTML = `<span>✨ Digital Twin layout of ${mappedRooms.length} rooms and ${mappedAssets.length} nodes synthesized successfully!</span>`;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 4500);

    } catch (error: any) {
      console.error('Error digitizing blueprint:', error);

      // If the key was rejected, reopen the key modal so the user can fix it.
      if (error.status === 401 || error.status === 403) {
        setShowApiKeyModal(true);
      }

      // Render beautiful floating custom error toast rather than blocking iframe alerts
      const toast = document.createElement('div');
      toast.className = "fixed bottom-14 right-5 bg-gradient-to-r from-rose-600 to-red-600 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl border border-red-400 z-50 flex flex-col gap-1 max-w-sm animate-in slide-in-from-bottom-4 duration-300";
      toast.innerHTML = `
        <div class="font-bold flex items-center gap-1.5 text-rose-100">
          <span>⚠️ AI Digitizer Issue</span>
        </div>
        <p class="text-[11px] font-medium leading-relaxed">${error.message || 'Gemini is currently experiencing high demand. Retrying or trying again in a few moments usually resolves this.'}</p>
      `;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 6000);
    } finally {
      setIsDigitizing(false);
    }
  };

  const handleApplyRoomSetupTemplate = (roomId: string, templateType: string) => {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;

    const cx = room.x;
    const cz = room.z;

    const itemsToAdd: Array<{ type: string; x: number; z: number; rotation?: number; scale?: { x: number; y: number; z: number }; specs?: Record<string, string> }> = [];

    if (templateType === 'boardroom_8') {
      itemsToAdd.push({
        type: 'conference_table', 
        x: cx, 
        z: cz, 
        scale: { x: 3.2, y: 0.75, z: 1.4 },
        specs: { Manufacturer: 'Steelcase', Cost: '$2,400.00', Weight: '240 kg', 'Power Needs': 'Dual AC Core' }
      });
      // 8 Chairs surrounding elegantly
      itemsToAdd.push({ type: 'chair_office', x: cx - 1.2, z: cz - 0.7, rotation: Math.PI });
      itemsToAdd.push({ type: 'chair_office', x: cx - 0.4, z: cz - 0.7, rotation: Math.PI });
      itemsToAdd.push({ type: 'chair_office', x: cx + 0.4, z: cz - 0.7, rotation: Math.PI });
      itemsToAdd.push({ type: 'chair_office', x: cx + 1.2, z: cz - 0.7, rotation: Math.PI });
      itemsToAdd.push({ type: 'chair_office', x: cx - 1.2, z: cz + 0.7 });
      itemsToAdd.push({ type: 'chair_office', x: cx - 0.4, z: cz + 0.7 });
      itemsToAdd.push({ type: 'chair_office', x: cx + 0.4, z: cz + 0.7 });
      itemsToAdd.push({ type: 'chair_office', x: cx + 1.2, z: cz + 0.7 });

      // Interactive Whiteboard and Low-Current elements
      itemsToAdd.push({ type: 'whiteboard', x: cx - room.width / 2 + 0.25, z: cz, rotation: Math.PI / 2, specs: { Size: '86-inch 4K', Mounting: 'Wall Fixed' } });
      itemsToAdd.push({ type: 'ap', x: cx, z: cz, specs: { model: 'Aruba AP-535 Dual', Mac: '55:1A:2B:3C:FE:91', Frequency: 'Dual 5GHz / 2.4GHz' } });
      itemsToAdd.push({ type: 'hdmi_port', x: cx, z: cz - 0.1, specs: { PortName: 'Table-HDMI-Grid' } });
      itemsToAdd.push({ type: 'projector_port', x: cx - 1.2, z: cz, specs: { LinkName: 'Ceiling Dropped Line' } });
    } else if (templateType === 'workstations_4') {
      itemsToAdd.push({ type: 'desk_cluster_4', x: cx, z: cz, scale: { x: 1.8, y: 0.75, z: 1.4 } });
      itemsToAdd.push({ type: 'chair_office', x: cx - 0.6, z: cz - 0.6, rotation: Math.PI });
      itemsToAdd.push({ type: 'chair_office', x: cx + 0.6, z: cz - 0.6, rotation: Math.PI });
      itemsToAdd.push({ type: 'chair_office', x: cx - 0.6, z: cz + 0.6 });
      itemsToAdd.push({ type: 'chair_office', x: cx + 0.6, z: cz + 0.6 });

      itemsToAdd.push({ type: 'dp', x: cx - room.width / 2 + 0.15, z: cz, specs: { ID: 'WRK-DP-AG', Port: 'W-03', Status: 'Active' } });
    } else if (templateType === 'exec_suite') {
      itemsToAdd.push({ type: 'desk_single', x: cx, z: cz - 0.5 });
      itemsToAdd.push({ type: 'chair_office', x: cx, z: cz - 1.1 });
      itemsToAdd.push({ type: 'chair_lounge', x: cx, z: cz + 0.8, scale: { x: 1.5, y: 1.0, z: 1.0 }, rotation: Math.PI });

      itemsToAdd.push({ type: 'whiteboard', x: cx - room.width / 2 + 0.25, z: cz, rotation: Math.PI / 2 });
      itemsToAdd.push({ type: 'tp', x: cx + room.width / 2 - 0.15, z: cz, specs: { ID: 'TP-EXEC-OW', LineNumber: 'Ext 102' } });
      itemsToAdd.push({ type: 'cctv', x: cx, z: cz, specs: { model: 'AXIS 360 Mini', Lens: '2.8mm Wide-Angle' } });
    }

    const newAssetsToAppend: PlacedAsset[] = itemsToAdd.map((item, idx) => {
      const uid = `${item.type}_${Date.now().toString().slice(-4)}_${Math.floor(Math.random() * 1000 + idx)}`;
      let category: 'infrastructure' | 'furniture' = 'furniture';
      const isInfra = ['ap', 'dp', 'tp', 'cctv', 'door_access', 'intercom', 'power_outlet', 'hdmi_port', 'projector_port'].includes(item.type);
      let height = (item.type === 'ap' || item.type === 'cctv') ? 3.2 : (isInfra ? 0.8 : 0.4);

      if (isInfra) {
        category = 'infrastructure';
      }

      return {
        id: uid,
        type: item.type as any,
        category,
        name: `${item.type.toUpperCase().replace('_', ' ')} (Parametric Group)`,
        position: { x: item.x, y: height, z: item.z },
        rotationY: item.rotation || 0,
        scale: item.scale || { x: 1, y: 1, z: 1 },
        assignedRoomId: roomId,
        specs: item.specs || { Manufacturer: 'Standard BIM Family', Cost: '$150.00', Weight: '6 kg' }
      };
    });

    setAssets((prev) => [...prev, ...newAssetsToAppend]);

    // Fast feedback notification toast
    const toast = document.createElement('div');
    toast.className = "fixed bottom-14 right-5 bg-emerald-600 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl border border-emerald-400 z-50 flex items-center gap-1.5 animate-in slide-in-from-bottom-4 duration-300";
    toast.innerHTML = `<span>Applied functional setup blueprint! Nested ${newAssetsToAppend.length} specs-loaded nodes into ${room.name}!</span>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  };

  // Reset CAD workspace to default image specifications
  const handleResetCanvas = () => {
    if (confirm('Are you sure you want to completely clear the canvas?')) {
      setRooms([]);
      setAssets([]);
      setBlueprintImage(null);
      setSelectedAssetId(null);
      clearDesign();
    }
  };

  const handleImportJSON = (json: any) => {
    if (confirm('Importing will overwrite current design. Proceed?')) {
      if (json.rooms) setRooms(json.rooms);
      if (json.assets) setAssets(json.assets);
      if (json.blueprintImage) setBlueprintImage(json.blueprintImage);
      alert('Design imported successfully.');
    }
  };

  const handleRebuildFromPrompt = async (prompt: string) => {
    if (!geminiApiKey) {
      setPendingAiAction(() => () => handleRebuildFromPrompt(prompt));
      setShowApiKeyModal(true);
      return;
    }

    setIsDigitizing(true);
    try {
      const response = await fetch('/api/rebuild-from-prompt', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-gemini-api-key': geminiApiKey,
        },
        body: JSON.stringify({ prompt }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const err = new Error(errorData.error || 'Failed to rebuild from prompt.');
        (err as any).status = response.status;
        throw err;
      }

      const data = await response.json();

      // Use the same normalisation pipeline as the digitizer so assets are
      // correctly typed, positioned and auto-bound to their rooms.
      const { rooms: mappedRooms, assets: mappedAssets } = mapApiLayout(data);

      if (mappedRooms.length === 0 && mappedAssets.length === 0) {
        throw new Error('The AI returned an empty layout. Try a more descriptive prompt.');
      }

      setRooms(mappedRooms);
      setAssets(mappedAssets);
      showToast(`Generated ${mappedRooms.length} rooms and ${mappedAssets.length} assets from your prompt.`);
    } catch (err: any) {
      // If the key was rejected, reopen the key modal so the user can fix it.
      if (err.status === 401 || err.status === 403) {
        setShowApiKeyModal(true);
      }
      showToast(err.message || 'Error processing prompt.', 'error');
    } finally {
      setIsDigitizing(false);
    }
  };

  // Active highlighted item lookup for sidebar coordination
  const selectedAsset = assets.find((a) => a.id === selectedAssetId) || null;

  // ---- Lightweight toast helper (replaces repeated inline DOM building) ----
  const showToast = (message: string, tone: 'success' | 'error' = 'success') => {
    const toast = document.createElement('div');
    const palette =
      tone === 'error'
        ? 'from-rose-600 to-red-600 border-red-400'
        : 'from-emerald-600 to-teal-600 border-emerald-400';
    toast.className = `fixed bottom-14 right-5 bg-gradient-to-r ${palette} text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl border z-[120] flex items-center gap-1.5 animate-in slide-in-from-bottom-4 duration-300 max-w-sm`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4500);
  };

  // ---- Real export actions used by the Share & Export modal ----

  // PNG snapshot of the live 3D canvas.
  const handleExportImage = () => {
    const dataUrl = captureRef.current?.();
    if (!dataUrl) {
      showToast('Canvas is not ready for capture yet. Try again in a moment.', 'error');
      return;
    }
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `archviz_snapshot_${new Date().toISOString().split('T')[0]}.png`;
    link.click();
    showToast('Snapshot PNG downloaded.');
  };

  // Full JSON schematic backup.
  const handleExportJSON = () => {
    const payload = { exportedAt: new Date().toISOString(), rooms, assets, blueprintImage };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'office_digital_twin.json';
    link.click();
    URL.revokeObjectURL(url);
    showToast('Design JSON exported.');
  };

  // Copy the design payload to the clipboard for pasting into other tools.
  const handleCopyJSON = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify({ rooms, assets }, null, 2));
      showToast('Design JSON copied to clipboard.');
    } catch {
      showToast('Clipboard access was blocked by the browser.', 'error');
    }
  };

  // Printable PDF report (via the browser print dialog) including a snapshot,
  // room summary and full asset inventory.
  const handleExportPDF = () => {
    const snapshot = captureRef.current?.();
    const totalArea = rooms.reduce((sum, r) => sum + r.width * r.depth * 10.7639, 0);
    const roomRows = rooms
      .map((r) => {
        const count = assets.filter((a) => a.assignedRoomId === r.id).length;
        return `<tr><td>${r.name}</td><td>${Math.round(r.width * r.depth * 10.7639)} sqft</td><td>${count}</td></tr>`;
      })
      .join('');
    const assetRows = assets
      .map((a) => {
        const room = rooms.find((r) => r.id === a.assignedRoomId)?.name || 'Unassigned';
        return `<tr><td>${a.name}</td><td>${a.type}</td><td>${a.category}</td><td>${room}</td><td>${a.position.x.toFixed(1)}, ${a.position.z.toFixed(1)}</td></tr>`;
      })
      .join('');

    const win = window.open('', '_blank');
    if (!win) {
      showToast('Pop-up blocked. Allow pop-ups to export the PDF report.', 'error');
      return;
    }
    win.document.write(`<!doctype html><html><head><title>ArchViz Pro Report</title>
      <style>
        body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;margin:32px;}
        h1{font-size:20px;margin:0 0 4px;} .sub{color:#64748b;font-size:12px;margin-bottom:20px;}
        img{max-width:100%;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:20px;}
        table{width:100%;border-collapse:collapse;margin-bottom:24px;font-size:12px;}
        th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left;}
        th{background:#f8fafc;} h2{font-size:14px;margin:16px 0 8px;}
        .stats{display:flex;gap:24px;margin-bottom:20px;font-size:13px;}
        .stats b{display:block;font-size:20px;}
      </style></head><body>
      <h1>Office Digital Twin — Audit Report</h1>
      <div class="sub">Generated ${new Date().toLocaleString()}</div>
      <div class="stats">
        <div><b>${rooms.length}</b>Rooms</div>
        <div><b>${assets.length}</b>Assets</div>
        <div><b>${Math.round(totalArea)}</b>Total sqft</div>
      </div>
      ${snapshot ? `<img src="${snapshot}" alt="Floor plan snapshot" />` : ''}
      <h2>Room Summary</h2>
      <table><thead><tr><th>Room</th><th>Area</th><th>Assets</th></tr></thead><tbody>${roomRows}</tbody></table>
      <h2>Asset Inventory</h2>
      <table><thead><tr><th>Name</th><th>Type</th><th>Category</th><th>Room</th><th>X, Z (m)</th></tr></thead><tbody>${assetRows}</tbody></table>
      </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
    showToast('Opening printable report…');
  };

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
            onClick={() => {
              const nextState = !showOccupancyHeatmap;
              setShowOccupancyHeatmap(nextState);
              if (nextState && viewMode !== '2D') {
                setViewMode('2D');
              }
            }}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all border flex items-center gap-1.5 cursor-pointer focus:outline-none ${
              showOccupancyHeatmap
                ? 'bg-emerald-600 border-emerald-600 text-white font-bold hover:bg-emerald-700 shadow-sm'
                : 'bg-white/95 border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50 shadow-sm'
            }`}
            title="Toggle colorized room occupancy load heat map overlay"
          >
            <Sparkles className={`w-3.5 h-3.5 ${showOccupancyHeatmap ? 'animate-spin' : ''}`} style={{ animationDuration: '4s' }} />
            <span>Heatmap Overlay</span>
          </button>

          <button
            type="button"
            onClick={handleResetCanvas}
            className="px-3 py-1.5 rounded-lg bg-white/95 text-[11px] font-semibold text-rose-600 hover:text-rose-700 shadow-sm border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer hover:bg-slate-50 focus:outline-none"
            title="Reset Workspace"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Reset Workspace</span>
          </button>

          <button
            type="button"
            onClick={() => setShowApiKeyModal(true)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all border flex items-center gap-1.5 cursor-pointer focus:outline-none ${
              geminiApiKey 
              ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 shadow-sm' 
              : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 shadow-sm animate-pulse'
            }`}
            title="Configure Gemini API Key"
          >
            <Key className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">{geminiApiKey ? 'API Key Active' : 'Set API Key'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowShareModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-md hover:shadow-lg hover:shadow-blue-200 transition-all flex items-center gap-2 cursor-pointer focus:outline-none"
          >
            <Share2 className="w-4 h-4" />
            <span>Share & Export</span>
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
            showOccupancyHeatmap={showOccupancyHeatmap}
            showWifiHeatmap={showWifiHeatmap}
            showCablingPaths={showCablingPaths}
            blueprintImage={blueprintImage}
            blueprintOpacity={blueprintOpacity}
            blueprintScale={blueprintScale}
            blueprintAspect={blueprintAspect}
            blueprintOffsetX={blueprintOffsetX}
            blueprintOffsetZ={blueprintOffsetZ}
            blueprintVisible={blueprintVisible}
            captureRef={captureRef}
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
            showWifiHeatmap={showWifiHeatmap}
            onSetShowWifiHeatmap={setShowWifiHeatmap}
            showCablingPaths={showCablingPaths}
            onSetShowCablingPaths={setShowCablingPaths}
            onApplyRoomSetupTemplate={handleApplyRoomSetupTemplate}
            onResetCanvas={handleResetCanvas}
            onImportJSON={handleImportJSON}
            onRebuildFromPrompt={handleRebuildFromPrompt}
            blueprintImage={blueprintImage}
            onBlueprintLoaded={handleBlueprintLoaded}
            blueprintOpacity={blueprintOpacity}
            onSetBlueprintOpacity={setBlueprintOpacity}
            blueprintScale={blueprintScale}
            onSetBlueprintScale={setBlueprintScale}
            blueprintOffsetX={blueprintOffsetX}
            onSetBlueprintOffsetX={setBlueprintOffsetX}
            blueprintOffsetZ={blueprintOffsetZ}
            onSetBlueprintOffsetZ={setBlueprintOffsetZ}
            blueprintVisible={blueprintVisible}
            onSetBlueprintVisible={setBlueprintVisible}
            onDigitizeBlueprint={handleDigitizeBlueprint}
            isDigitizing={isDigitizing}
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
                  <p><b>Share & Export integration:</b> Export your schematic to PDF/Image formats, save as local JSON, or copy the direct HTML embed snippets to plug into your own site securely.</p>
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

      {/* BYOK API Key Modal Component */}
      {showApiKeyModal && (
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white max-w-lg w-full rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-inner">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">Bring Your Own Key Configuration</h2>
                <p className="text-xs text-slate-500 font-medium">Require Google Gemini API Key for A.I capabilities</p>
              </div>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 text-amber-800">
                <ShieldAlert className="w-5 h-5 shrink-0 text-amber-600" />
                <div className="text-xs leading-relaxed space-y-2">
                  <p className="font-bold text-sm">Terms and Conditions for Local API Key Usage</p>
                  <p>By entering your Gemini API key, you understand and agree to the following conditions:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li><strong>Temporary Session Storage:</strong> Your key is securely stored in your browser's temporary <code className="bg-amber-100 px-1 py-0.5 rounded">sessionStorage</code>. It will be <strong>automatically and permanently deleted</strong> the moment you close this browser tab or window.</li>
                    <li><strong>No Server Persistence:</strong> Your key is NEVER stored in any database or file system on the server. We only proxy it directly to Google's API during your active session.</li>
                    <li><strong>Key Billing:</strong> All usage is billed directly to your own Google Cloud / Google AI Studio account limits and quotas.</li>
                    <li><strong>Key Handling:</strong> Never share a generic account key. Always generate a dedicated key constrained to Gemini features, and revoke it when you are done if preferred.</li>
                  </ul>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 ml-1">Gemini AI Studio API Key</label>
                <div className="relative">
                  <input
                    type="password"
                    id="gemini-key-input"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-sm font-mono shadow-sm"
                    placeholder="AIzaSy..."
                    defaultValue={geminiApiKey}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = (e.target as HTMLInputElement).value.trim();
                        if (val) saveApiKey(val);
                      }
                    }}
                  />
                  <Key className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                </div>
                <p className="text-[11px] text-slate-500 ml-1">Get your free key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">Google AI Studio</a>.</p>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button 
                onClick={() => {
                  setShowApiKeyModal(false);
                  setPendingAiAction(null);
                }}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  const val = (document.getElementById('gemini-key-input') as HTMLInputElement).value.trim();
                  if (val) saveApiKey(val);
                }}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg transition-all flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Accept Terms & Save Session Key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share / Export Modal Component */}
      {showShareModal && (
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white max-w-2xl w-full rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-inner">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Share & Export</h2>
                  <p className="text-xs text-slate-500 font-medium">Export your 3D digital twin to various formats or copy integration code.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowShareModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-all"
              >
                ✕
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 bg-white">
              {/* SHARE / DATA Options */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Share Data</h3>

                <button
                  onClick={handleCopyJSON}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-100 text-slate-600 rounded-lg group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                      <Code2 className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-semibold text-slate-700 group-hover:text-blue-700">Copy Design JSON</div>
                      <div className="text-[10px] text-slate-500">Copy full layout to clipboard</div>
                    </div>
                  </div>
                  <Copy className="w-4 h-4 text-slate-400 group-hover:text-blue-500" />
                </button>

                <button
                  onClick={handleExportJSON}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-100 text-slate-600 rounded-lg group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                      <Download className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-semibold text-slate-700 group-hover:text-blue-700">Download JSON</div>
                      <div className="text-[10px] text-slate-500">Reimportable schematic backup</div>
                    </div>
                  </div>
                  <Download className="w-4 h-4 text-slate-400 group-hover:text-blue-500" />
                </button>

                <div className="text-[10px] text-slate-400 leading-relaxed p-3 rounded-xl bg-slate-50 border border-slate-100">
                  Your design is autosaved to this browser. Export JSON to move it between devices, or re-import it from the Inventory tab.
                </div>
              </div>

              {/* MEDIA Export Options */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Export Media</h3>

                <button
                  onClick={handleExportPDF}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-green-400 hover:bg-green-50 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-100 text-slate-600 rounded-lg group-hover:bg-green-100 group-hover:text-green-600 transition-colors">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-semibold text-slate-700 group-hover:text-green-700">Export as PDF</div>
                      <div className="text-[10px] text-slate-500">Snapshot + room & asset report</div>
                    </div>
                  </div>
                  <Download className="w-4 h-4 text-slate-400 group-hover:text-green-500" />
                </button>

                <button
                  onClick={handleExportImage}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-green-400 hover:bg-green-50 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-100 text-slate-600 rounded-lg group-hover:bg-green-100 group-hover:text-green-600 transition-colors">
                      <ImageIcon className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-semibold text-slate-700 group-hover:text-green-700">Export as Image</div>
                      <div className="text-[10px] text-slate-500">PNG snapshot of the 3D grid</div>
                    </div>
                  </div>
                  <Download className="w-4 h-4 text-slate-400 group-hover:text-green-500" />
                </button>
              </div>
            </div>
            
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => setShowShareModal(false)}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition-all shadow-sm"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Sleek Architectural Footer */}
      <footer className="h-10 bg-white border-t border-slate-200 px-6 flex items-center justify-between text-[10px] text-slate-400 font-medium shrink-0">
        <div>RENDER ENGINE: <strong>WEBGL CORE v2.4</strong></div>
        <div className="flex items-center gap-4">
          <span>SCALE: 1:50</span>
          <span>GRID_SNAP: 25cm</span>
        </div>
      </footer>
    </div>
  );
}

