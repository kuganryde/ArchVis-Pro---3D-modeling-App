import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PlacedAsset, RoomDefinition, getAssetHeightLayer } from '../types';

function getOccupancyColor(assetCount: number, width: number, depth: number): string {
  const areaSqFt = width * depth * 10.7639;
  const capacity = Math.max(1, Math.floor(areaSqFt / 80));
  const ratio = Math.min(1.5, assetCount / capacity);
  
  if (assetCount === 0) {
    return '#10b981'; // Cozy emerald green for empty/light space
  }
  
  // Interpolate between Emerald Green (16, 185, 129) -> Amber (245, 158, 11) -> Warning Red (239, 68, 68)
  if (ratio <= 0.6) {
    const t = ratio / 0.6;
    const r = Math.round(16 + (245 - 16) * t);
    const g = Math.round(185 + (158 - 185) * t);
    const b = Math.round(129 + (11 - 129) * t);
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    const t = Math.min(1.0, (ratio - 0.6) / 0.9);
    const r = Math.round(245 + (239 - 245) * t);
    const g = Math.round(158 + (68 - 158) * t);
    const b = Math.round(11 + (68 - 11) * t);
    return `rgb(${r}, ${g}, ${b})`;
  }
}

function getAssetSize(asset: PlacedAsset): { width: number; depth: number } {
  const scaleX = asset.scale?.x || 1.0;
  const scaleZ = asset.scale?.z || 1.0;

  switch (asset.type) {
    case 'ap':
      return { width: 0.8, depth: 0.8 };
    case 'dp':
    case 'tp':
    case 'hdmi_port':
    case 'projector_port':
    case 'door_access':
    case 'intercom':
      return { width: 0.4, depth: 0.4 };
    case 'power_outlet':
      return { width: 0.6, depth: 0.6 };
    case 'cctv':
      return { width: 0.5, depth: 0.5 };
    case 'desk_single':
      return { width: 1.2, depth: 0.7 };
    case 'desk_cluster_4':
    case 'desk_cluster_6':
      return { width: scaleX, depth: scaleZ };
    case 'conference_table':
      return { width: scaleX, depth: scaleZ };
    case 'chair_office':
    case 'chair_lounge':
      return { width: 0.6, depth: 0.6 };
    case 'reception_desk':
      return { width: 2.4, depth: 1.2 };
    case 'whiteboard':
      return { width: 0.2, depth: 1.2 };
    case 'cabinet':
      return { width: 1.0, depth: 0.5 };
    case 'plant_pot':
      return { width: 0.6, depth: 0.6 };
    default:
      return { width: 0.8, depth: 0.8 };
  }
}

function isOverlapping(assetA: PlacedAsset, assetB: PlacedAsset): boolean {
  // Only check collision if they are on the same height layer!
  if (getAssetHeightLayer(assetA.type) !== getAssetHeightLayer(assetB.type)) {
    return false;
  }

  const sizeA = getAssetSize(assetA);
  const sizeB = getAssetSize(assetB);
  
  // Use circle collision approximation for natural layout spacing tolerance
  const rA = Math.max(sizeA.width, sizeA.depth) * 0.42;
  const rB = Math.max(sizeB.width, sizeB.depth) * 0.42;
  
  const dx = assetA.position.x - assetB.position.x;
  const dz = assetA.position.z - assetB.position.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  
  return dist < (rA + rB);
}

function isAssetOutsideRooms(asset: PlacedAsset, rooms: RoomDefinition[]): boolean {
  if (rooms.length === 0) return false;
  
  const size = getAssetSize(asset);
  const halfW = size.width / 2;
  const halfD = size.depth / 2;
  
  return !rooms.some((room) => {
    const roomMinX = room.x - room.width / 2;
    const roomMaxX = room.x + room.width / 2;
    const roomMinZ = room.z - room.depth / 2;
    const roomMaxZ = room.z + room.depth / 2;
    
    const assetMinX = asset.position.x - halfW;
    const assetMaxX = asset.position.x + halfW;
    const assetMinZ = asset.position.z - halfD;
    const assetMaxZ = asset.position.z + halfD;
    
    // Allow a small nesting tolerance
    return (
      assetMinX >= roomMinX - 0.08 &&
      assetMaxX <= roomMaxX + 0.08 &&
      assetMinZ >= roomMinZ - 0.08 &&
      assetMaxZ <= roomMaxZ + 0.08
    );
  });
}

function applyConflictMaterials(group: THREE.Group) {
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material = child.material.map((mat) => {
            const cloned = mat.clone();
            if ('color' in cloned) {
              cloned.color.set('#f43f5e');
            }
            if ('emissive' in cloned) {
              cloned.emissive.set('#9f1239'); // vivid warning red glow
            }
            return cloned;
          });
        } else {
          const cloned = child.material.clone();
          if ('color' in cloned) {
            cloned.color.set('#f43f5e');
          }
          if ('emissive' in cloned) {
            cloned.emissive.set('#9f1239'); // vivid warning red glow
          }
          child.material = cloned;
        }
      }
    }
  });
}

interface ThreeCanvasProps {
  rooms: RoomDefinition[];
  assets: PlacedAsset[];
  selectedAssetId: string | null;
  onSelectAsset: (id: string | null) => void;
  onUpdateAssetPosition: (id: string, x: number, z: number) => void;
  viewMode: '2D' | '3D';
  activeCategoryFilter: 'all' | 'furniture' | 'infrastructure';
  activeAssetTypeFilter: string | 'all';
  showOccupancyHeatmap?: boolean;
  showWifiHeatmap?: boolean;
  showCablingPaths?: boolean;
  blueprintImage?: string | null;
  blueprintOpacity?: number;
  blueprintScale?: number;
  blueprintAspect?: number;
  blueprintOffsetX?: number;
  blueprintOffsetZ?: number;
  blueprintVisible?: boolean;
}

export default function ThreeCanvas({
  rooms,
  assets,
  selectedAssetId,
  onSelectAsset,
  onUpdateAssetPosition,
  viewMode,
  activeCategoryFilter,
  activeAssetTypeFilter,
  showOccupancyHeatmap = false,
  showWifiHeatmap = false,
  showCablingPaths = false,
  blueprintImage = null,
  blueprintOpacity = 0.5,
  blueprintScale = 30,
  blueprintAspect = 1.33,
  blueprintOffsetX = 0,
  blueprintOffsetZ = 0,
  blueprintVisible = true,
}: ThreeCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredRoom, setHoveredRoom] = useState<RoomDefinition | null>(null);
  const [hoveredAsset, setHoveredAsset] = useState<PlacedAsset | null>(null);

  // References for three.js objects updated in the animation loop
  const requestRef = useRef<number | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const assetMeshesRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());

  // Dragging state
  const isDraggingRef = useRef<boolean>(false);
  const draggedAssetIdRef = useRef<string | null>(null);
  const dragPlaneRef = useRef<THREE.Plane>(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());

  // Room overlay projections
  const [projectedRooms, setProjectedRooms] = useState<Array<{ id: string; name: string; area: number; assetCount: number; loadPercentage: number; x: number; y: number; textColor: string }>>([]);

  const roomsRef = useRef(rooms);
  const assetsRef = useRef(assets);
  const showOccupancyHeatmapRef = useRef(showOccupancyHeatmap);

  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);

  useEffect(() => {
    assetsRef.current = assets;
  }, [assets]);

  useEffect(() => {
    showOccupancyHeatmapRef.current = showOccupancyHeatmap;
  }, [showOccupancyHeatmap]);

  // Initialize ThreeJS Scene
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    // Create scene with soft architectural grey background
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#fafafa');
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      45,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    // Set nice viewing angle by default
    camera.position.set(0, 20, 24);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2 - 0.05; // Don't crash into floor
    controls.minDistance = 3;
    controls.maxDistance = 60;
    controlsRef.current = controls;

    // Lights
    const ambientLight = new THREE.AmbientLight('#ffffff', 0.65);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight('#ffffff', 0.8);
    dirLight.position.set(15, 30, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);

    // Decorative floor grid (CAD design layout style)
    const gridMajor = new THREE.GridHelper(60, 60, '#94a3b8', '#cbd5e1');
    gridMajor.position.y = -0.01;
    scene.add(gridMajor);

    // Coordinate Axes representation (Sleek corner RGB indicator helper)
    const axesHelper = new THREE.AxesHelper(3);
    axesHelper.position.set(-28, 0.1, -18);
    scene.add(axesHelper);

    // Handle container resizing
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0 || !containerRef.current) return;
      const { width, height } = containerRef.current.getBoundingClientRect();
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    });
    resizeObserver.observe(containerRef.current);

    // Start rendering frame loop
    const renderLoop = () => {
      // Damping update for smooth momentum panning/zooming
      controls.update();

      // Project room names onto 2D viewport overlay
      if (sceneRef.current && cameraRef.current && rendererRef.current) {
        const tempV = new THREE.Vector3();
        const rect = renderer.domElement.getBoundingClientRect();
        const list = roomsRef.current.map((r) => {
          tempV.set(r.x, 0, r.z);
          tempV.project(camera);
          const x = (tempV.x * .5 + .5) * rect.width;
          const y = (-(tempV.y) * .5 + .5) * rect.height;
          
          // Calculate dynamic occupancy counts and load percentage
          const roomAssets = assetsRef.current.filter((a) => a.assignedRoomId === r.id);
          const assetCount = roomAssets.length;
          const areaSqFt = r.width * r.depth * 10.7639;
          const capacity = Math.max(1, Math.floor(areaSqFt / 80));
          const loadPercentage = Math.round((assetCount / capacity) * 100);

          return {
            id: r.id,
            name: r.name,
            area: Math.round(r.width * r.depth * 10.7639),
            assetCount,
            loadPercentage,
            x,
            y,
            textColor: r.textColor || '#000000',
            inScope: tempV.z <= 1, // behind camera filter
          };
        }).filter(item => 
          item.inScope && 
          typeof item.x === 'number' && 
          typeof item.y === 'number' && 
          !isNaN(item.x) && 
          !isNaN(item.y) && 
          isFinite(item.x) && 
          isFinite(item.y)
        );
        setProjectedRooms(list);
      }

      renderer.render(scene, camera);
      requestRef.current = requestAnimationFrame(renderLoop);
    };

    renderLoop();

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
    };
  }, [rooms]);

  // Handle camera changes based on ViewMode (2D vs 3D)
  useEffect(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    if (viewMode === '2D') {
      // Smoothly animate to purely top-down blueprint view
      controls.enableRotate = false;
      controls.minPolarAngle = 0;
      controls.maxPolarAngle = 0;
      controls.target.set(0, 0, 0);

      // Animate camera position
      controls.reset();
      camera.position.set(0, 30, 0.001); // offset slightly from 0 on Z to maintain up vectors
      camera.lookAt(0, 0, 0);
    } else {
      // Reactivate 3D free orbiting orthography
      controls.enableRotate = true;
      controls.minPolarAngle = 0.1;
      controls.maxPolarAngle = Math.PI / 2 - 0.05;
      camera.position.set(0, 20, 24);
      controls.target.set(0, 0, 0);
    }
  }, [viewMode]);

  // Handle Blueprint underlay plane rendering and texture loading
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Clean up existing underlay
    const existing = scene.getObjectByName('BLUEPRINT_UNDERLAY');
    if (existing) {
      scene.remove(existing);
    }

    if (!blueprintImage || !blueprintVisible) return;

    // Load texture
    const loader = new THREE.TextureLoader();
    loader.load(
      blueprintImage,
      (texture) => {
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;

        // Calculate aspect ratios
        const bWidth = blueprintScale * blueprintAspect;
        const bHeight = blueprintScale;

        const geometry = new THREE.PlaneGeometry(bWidth, bHeight);
        const material = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          opacity: blueprintOpacity,
          side: THREE.DoubleSide,
          depthWrite: false, // Prevents Z-fighting with grid and rooms
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = 'BLUEPRINT_UNDERLAY';
        mesh.rotation.x = -Math.PI / 2;
        // Position slightly above ground plate, below room boxes
        mesh.position.set(blueprintOffsetX, -0.012, blueprintOffsetZ);

        scene.add(mesh);
      },
      (err) => {
        console.error('Error loading custom blueprint asset texture:', err);
      }
    );
  }, [blueprintImage, blueprintVisible, blueprintOpacity, blueprintScale, blueprintAspect, blueprintOffsetX, blueprintOffsetZ]);

  // Re-generate Room Boxes and extruded walls when Rooms state or ViewMode updates
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Use traverse for more robust cleanup
    const toRemove: THREE.Object3D[] = [];
    scene.traverse((obj) => {
      if (obj.name === 'ROOM_PLAN_GROUP') toRemove.push(obj);
    });
    toRemove.forEach(obj => scene.remove(obj));

    const roomPlanGroup = new THREE.Group();
    roomPlanGroup.name = 'ROOM_PLAN_GROUP';

    rooms.forEach((room) => {
      const group = new THREE.Group();
      group.name = `room_${room.id}`;

      // Floor plane tile
      const floorGeo = new THREE.BoxGeometry(room.width, 0.06, room.depth);
      
      let floorColor = room.color;
      if (showOccupancyHeatmap) {
        const roomAssets = assets.filter((a) => a.assignedRoomId === room.id);
        floorColor = getOccupancyColor(roomAssets.length, room.width, room.depth);
      } else if (showWifiHeatmap) {
        const apAssets = assets.filter((a) => a.type === 'ap');
        if (apAssets.length === 0) {
          floorColor = '#94a3b8'; // Slate grey indicating no Wi-Fi coverage whatsoever
        } else {
          // Compute distance from room center to the nearest AP
          let minDistance = Infinity;
          apAssets.forEach((ap) => {
            const dx = ap.position.x - room.x;
            const dz = ap.position.z - room.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < minDistance) minDistance = dist;
          });

          if (minDistance < 6.5) {
            floorColor = '#a7f3d0'; // Excellent (Mint / Emerald)
          } else if (minDistance < 11.5) {
            floorColor = '#fef08a'; // Fair / Moderate (Soft Yellow)
          } else {
            floorColor = '#fca5a5'; // Dead Zone under standard threshold (Soft Rose)
          }
        }
      }

      const floorMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(floorColor),
        roughness: 0.9,
        metalness: 0.05,
        transparent: true,
        opacity: (showOccupancyHeatmap || showWifiHeatmap) ? 0.75 : 0.65,
      });
      const floorMesh = new THREE.Mesh(floorGeo, floorMat);
      floorMesh.position.set(room.x, 0.03, room.z);
      floorMesh.receiveShadow = true;
      group.add(floorMesh);

      // Add a nice sleek outer outline for CAD style
      const outlineGeo = new THREE.EdgesGeometry(floorGeo);
      const outlineMat = new THREE.LineBasicMaterial({ color: '#cbd5e1', linewidth: 2 });
      const outline = new THREE.LineSegments(outlineGeo, outlineMat);
      outline.position.set(room.x, 0.03, room.z);
      group.add(outline);

      // Walls - Only render and extrude standard walls or glass panels in 3D mode!
      if (viewMode === '3D') {
        const wallHeight = 2.4;
        const wallThickness = 0.12;

        // Draw outer room partitions
        // 1. Top wall
        createWallMesh(room.width, wallHeight, wallThickness, room.x, wallHeight / 2, room.z - room.depth / 2, 0, group, room.id === 'long_meeting' ? 'concrete' : 'glass');
        // 2. Bottom wall
        createWallMesh(room.width, wallHeight, wallThickness, room.x, wallHeight / 2, room.z + room.depth / 2, 0, group, room.id === 'long_meeting' ? 'concrete' : 'glass');
        // 3. Left wall
        createWallMesh(room.depth, wallHeight, wallThickness, room.x - room.width / 2, wallHeight / 2, room.z, Math.PI / 2, group, 'concrete');
        // 4. Right wall
        createWallMesh(room.depth, wallHeight, wallThickness, room.x + room.width / 2, wallHeight / 2, room.z, Math.PI / 2, group, room.id === 'server_room' ? 'concrete' : 'glass');
      }

      roomPlanGroup.add(group);
    });

    scene.add(roomPlanGroup);
  }, [rooms, viewMode, assets, showOccupancyHeatmap, showWifiHeatmap]);

  // Helper to construct architectural walls
  function createWallMesh(
    length: number,
    height: number,
    thickness: number,
    x: number,
    y: number,
    z: number,
    rotationY: number,
    group: THREE.Group,
    type: 'concrete' | 'glass'
  ) {
    // Incorporate doors by dividing walls, or use elegant translucent glass / architectural solid partitions
    const wallGeo = new THREE.BoxGeometry(length, height, thickness);
    let wallMat;

    if (type === 'glass') {
      wallMat = new THREE.MeshStandardMaterial({
        color: '#e0f2fe',
        transparent: true,
        opacity: 0.22,
        roughness: 0.1,
        metalness: 0.9,
        side: THREE.DoubleSide
      });
    } else {
      wallMat = new THREE.MeshStandardMaterial({
        color: '#f8fafc', // high-end matte plaster wall
        roughness: 0.8,
        metalness: 0.1,
      });
    }

    const wallMesh = new THREE.Mesh(wallGeo, wallMat);
    wallMesh.position.set(x, y, z);
    wallMesh.rotation.y = rotationY;
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;
    group.add(wallMesh);

    // Floor skirtboard or glass border profiles
    const profileGeo = new THREE.BoxGeometry(length, 0.08, thickness + 0.02);
    const profileMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.4 });
    const profile = new THREE.Mesh(profileGeo, profileMat);
    profile.position.set(x, 0.04, z);
    profile.rotation.y = rotationY;
    group.add(profile);
  }

  // Update or build placed element 3D meshes based on the active lists and filters
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Remove existing assets group
    const toRemove: THREE.Object3D[] = [];
    scene.traverse((obj) => {
      if (obj.name === 'PLACED_ASSETS_GROUP') toRemove.push(obj);
    });
    toRemove.forEach(obj => scene.remove(obj));

    const assetsGroup = new THREE.Group();
    assetsGroup.name = 'PLACED_ASSETS_GROUP';

    const meshMap = new Map<string, THREE.Object3D>();

    assets.forEach((asset) => {
      // 1. Dynamic filtering by Category & Device Types
      if (activeCategoryFilter !== 'all' && asset.category !== activeCategoryFilter) return;
      if (activeAssetTypeFilter !== 'all' && asset.type !== activeAssetTypeFilter) return;

      const group = new THREE.Group();
      group.name = `asset_${asset.id}`;
      // Attach metadata for raycasting intersection lookup
      group.userData = { assetId: asset.id };

      // Generate distinctive aesthetic shapes based on specific item types
      buildProceduralAssetMesh(asset, group);

      // Set transform coordinates based on standard positions loaded
      group.position.set(asset.position.x, asset.position.y, asset.position.z);
      group.rotation.y = asset.rotationY;

      // Handle collision checking (overlap with another asset or outside defined room boundaries)
      const isOutside = isAssetOutsideRooms(asset, rooms);
      const isOverlappingOther = assets.some((other) => other.id !== asset.id && isOverlapping(asset, other));
      const hasConflict = isOutside || isOverlappingOther;

      if (hasConflict) {
        applyConflictMaterials(group);

        // Vivid red glowing danger outline/ring
        const conflictRingGeo = new THREE.RingGeometry(0.75, 0.85, 32);
        const conflictRingMat = new THREE.MeshBasicMaterial({
          color: '#f43f5e',
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.9,
        });
        const conflictRing = new THREE.Mesh(conflictRingGeo, conflictRingMat);
        conflictRing.rotation.x = Math.PI / 2;
        conflictRing.position.y = 0.09;
        group.add(conflictRing);

        // Translucent danger alert beacon cone/cylinder
        const alertGeo = new THREE.CylinderGeometry(0.02, 0.65, 1.4, 16, 1, true);
        const alertMat = new THREE.MeshBasicMaterial({
          color: '#f43f5e',
          transparent: true,
          opacity: 0.3,
          side: THREE.DoubleSide,
        });
        const alertBeacon = new THREE.Mesh(alertGeo, alertMat);
        alertBeacon.position.y = 0.7;
        group.add(alertBeacon);
      }

      // Handle selection ring visual queues
      if (asset.id === selectedAssetId) {
        // High-contrast glowing cyan selection ring
        const ringGeo = new THREE.RingGeometry(0.7, 0.8, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: hasConflict ? '#f43f5e' : '#06b6d4',
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.8,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.08;
        group.add(ring);

        // Selection beacon pulsing animation
        const beaconGeo = new THREE.CylinderGeometry(0.02, 0.5, 1.2, 16, 1, true);
        const beaconMat = new THREE.MeshBasicMaterial({
          color: hasConflict ? '#f43f5e' : '#06b6d4',
          transparent: true,
          opacity: 0.25,
          side: THREE.DoubleSide
        });
        const beacon = new THREE.Mesh(beaconGeo, beaconMat);
        beacon.position.y = 0.6;
        group.add(beacon);
      }

      assetsGroup.add(group);
      meshMap.set(asset.id, group);

      // Render flat concentric radio waves on the floor under Access Points
      if (showWifiHeatmap && asset.type === 'ap') {
        const ring1Geo = new THREE.RingGeometry(0, 2.5, 30, 1);
        const ring1Mat = new THREE.MeshBasicMaterial({
          color: '#10b981',
          transparent: true,
          opacity: 0.1,
          side: THREE.DoubleSide
        });
        const ring1 = new THREE.Mesh(ring1Geo, ring1Mat);
        ring1.rotation.x = -Math.PI / 2;
        ring1.position.y = -group.position.y + 0.05;
        group.add(ring1);

        const ring2Geo = new THREE.RingGeometry(2.5, 6.0, 30, 1);
        const ring2Mat = new THREE.MeshBasicMaterial({
          color: '#eab308',
          transparent: true,
          opacity: 0.05,
          side: THREE.DoubleSide
        });
        const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
        ring2.rotation.x = -Math.PI / 2;
        ring2.position.y = -group.position.y + 0.05;
        group.add(ring2);

        const ring3Geo = new THREE.RingGeometry(5.95, 6.05, 30, 1);
        const ring3Mat = new THREE.MeshBasicMaterial({
          color: '#f87171',
          transparent: true,
          opacity: 0.25,
          side: THREE.DoubleSide
        });
        const ring3 = new THREE.Mesh(ring3Geo, ring3Mat);
        ring3.rotation.x = -Math.PI / 2;
        ring3.position.y = -group.position.y + 0.05;
        group.add(ring3);
      }
    });

    // Clear and build the Cabling paths overlay group
    const existingCabling = scene.getObjectByName('CABLING_PATHS_GROUP');
    if (existingCabling) scene.remove(existingCabling);

    if (showCablingPaths) {
      const cablingGroup = new THREE.Group();
      cablingGroup.name = 'CABLING_PATHS_GROUP';

      assets.forEach((asset) => {
        if (asset.category !== 'infrastructure') return;

        // Skip if active filters currently exclude this element
        if (activeCategoryFilter !== 'all' && activeCategoryFilter !== 'infrastructure') return;
        if (activeAssetTypeFilter !== 'all' && asset.type !== activeAssetTypeFilter) return;

        const xA = asset.position.x;
        const yA = asset.position.y;
        const zA = asset.position.z;

        const ceilingY = (viewMode === '3D') ? 3.2 : 0.1;
        const rackY = (viewMode === '3D') ? 1.2 : 0.1;

        // MDF/IDF Network Rack Center in Server Room
        const rackX = 6.0;
        const rackZ = 6.8;

        const points = [
          new THREE.Vector3(xA, yA, zA),
          new THREE.Vector3(xA, ceilingY, zA),
          new THREE.Vector3(rackX, ceilingY, rackZ),
          new THREE.Vector3(rackX, rackY, rackZ),
        ];

        const pathGeo = new THREE.BufferGeometry().setFromPoints(points);

        let cableColor = '#a855f7'; // Purple/multimedia default
        if (asset.type === 'ap') {
          cableColor = '#10b981'; // Green: Cat7 PoE+ High-Speed WLAN
        } else if (asset.type === 'dp') {
          cableColor = '#3b82f6'; // Blue: Cat6a LAN Gigabit Link
        } else if (asset.type === 'tp') {
          cableColor = '#f97316'; // Orange: Analog Fax/VoIP Voice line
        } else if (asset.type === 'cctv') {
          cableColor = '#f59e0b'; // Amber: Cat6 PoE Dome/Bullet Security
        }

        const pathMat = new THREE.LineDashedMaterial({
          color: cableColor,
          dashSize: 0.2,
          gapSize: 0.1,
          linewidth: 1.5,
        });

        const cableLine = new THREE.Line(pathGeo, pathMat);
        cableLine.computeLineDistances();
        cablingGroup.add(cableLine);
      });

      scene.add(cablingGroup);
    }

    scene.add(assetsGroup);
    assetMeshesRef.current = meshMap;
  }, [assets, rooms, selectedAssetId, activeCategoryFilter, activeAssetTypeFilter, viewMode, showWifiHeatmap, showCablingPaths]);

  // Generates procedurally crafted Three.js geometric items for outstanding interior and low-current fidelity
  function buildProceduralAssetMesh(asset: PlacedAsset, group: THREE.Group) {
    const isSelected = asset.id === selectedAssetId;

    switch (asset.type) {
      // -----------------------------------------
      // LOW CURRENT DEVICES (Infrastructure)
      // -----------------------------------------
      case 'ap': { // Access Point WiFi
        // Draw a flat cream saucer representation
        const baseGeo = new THREE.CylinderGeometry(0.4, 0.45, 0.15, 24);
        const baseMat = new THREE.MeshStandardMaterial({
          color: '#ffffff',
          roughness: 0.2,
          metalness: 0.3,
        });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.castShadow = true;
        group.add(base);

        // Pulsing red/orange floating logo indicator
        const wifiGeo = new THREE.TorusGeometry(0.2, 0.04, 8, 16, Math.PI);
        const wifiMat = new THREE.MeshBasicMaterial({
          color: '#ef4444',
          side: THREE.DoubleSide
        });
        const wifi = new THREE.Mesh(wifiGeo, wifiMat);
        wifi.position.y = 0.3;
        wifi.rotation.x = -Math.PI / 6;
        group.add(wifi);

        const wifiSphereGeo = new THREE.SphereGeometry(0.06, 8, 8);
        const wifiSphere = new THREE.Mesh(wifiSphereGeo, wifiMat);
        wifiSphere.position.y = 0.15;
        group.add(wifiSphere);
        break;
      }

      case 'dp': { // Data Point Ethernet socket
        // Draw a neat high-contrast slate socket base with indigo blue inset
        const plateGeo = new THREE.BoxGeometry(0.35, 0.35, 0.1);
        const plateMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.5 });
        const plate = new THREE.Mesh(plateGeo, plateMat);
        plate.position.y = 0.175;
        group.add(plate);

        const coreGeo = new THREE.BoxGeometry(0.2, 0.2, 0.12);
        const coreMat = new THREE.MeshStandardMaterial({ color: '#3b82f6', emissive: '#1d4ed8' });
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.position.set(0, 0.175, 0.01);
        group.add(core);
        break;
      }

      case 'tp': { // Telephone point
        // Dual-tone green and charcoal casing with mini telephone shape
        const baseGeo = new THREE.BoxGeometry(0.3, 0.25, 0.2);
        const baseMat = new THREE.MeshStandardMaterial({ color: '#0f766e', roughness: 0.6 });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.y = 0.1;
        group.add(base);

        const handsetGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.28, 8);
        const handsetMat = new THREE.MeshStandardMaterial({ color: '#111827' });
        const handset = new THREE.Mesh(handsetGeo, handsetMat);
        handset.position.set(-0.06, 0.17, 0);
        handset.rotation.z = Math.PI / 4;
        group.add(handset);
        break;
      }

      case 'hdmi_port': { // HDMI Port
        // Deep purple wallplate with gold connector core
        const plateGeo = new THREE.BoxGeometry(0.35, 0.35, 0.1);
        const plateMat = new THREE.MeshStandardMaterial({ color: '#7c3aed', roughness: 0.4 });
        const plate = new THREE.Mesh(plateGeo, plateMat);
        plate.position.y = 0.175;
        group.add(plate);

        // Gold plated core
        const coreGeo = new THREE.BoxGeometry(0.22, 0.14, 0.12);
        const coreMat = new THREE.MeshStandardMaterial({ 
          color: '#fbbf24', 
          metalness: 0.9, 
          roughness: 0.1,
          emissive: '#b45309',
          emissiveIntensity: 0.15 
        });
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.position.set(0, 0.175, 0.01);
        group.add(core);

        // Dark central connector pin hole
        const pinGeo = new THREE.BoxGeometry(0.14, 0.06, 0.13);
        const pinMat = new THREE.MeshStandardMaterial({ color: '#171717', roughness: 0.9 });
        const pin = new THREE.Mesh(pinGeo, pinMat);
        pin.position.set(0, 0.175, 0.015);
        group.add(pin);
        break;
      }

      case 'projector_port': { // Projector interface port (VGA or Serial control)
        // Dark slate plate with double orange / teal outputs representing multi-connection points
        const plateGeo = new THREE.BoxGeometry(0.4, 0.3, 0.1);
        const plateMat = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.6 });
        const plate = new THREE.Mesh(plateGeo, plateMat);
        plate.position.y = 0.15;
        group.add(plate);

        // Port 1 (Corporate Orange)
        const port1Geo = new THREE.CylinderGeometry(0.06, 0.06, 0.12, 12);
        const port1Mat = new THREE.MeshStandardMaterial({ color: '#ea580c', roughness: 0.3 });
        const port1 = new THREE.Mesh(port1Geo, port1Mat);
        port1.rotation.x = Math.PI / 2;
        port1.position.set(-0.1, 0.15, 0.01);
        group.add(port1);

        // Port 2 (Vibrant Cyan)
        const port2Geo = new THREE.CylinderGeometry(0.06, 0.06, 0.12, 12);
        const port2Mat = new THREE.MeshStandardMaterial({ color: '#06b6d4', roughness: 0.3 });
        const port2 = new THREE.Mesh(port2Geo, port2Mat);
        port2.rotation.x = Math.PI / 2;
        port2.position.set(0.1, 0.15, 0.01);
        group.add(port2);
        break;
      }

      case 'cctv': { // Security Camera CCTV
        // Detailed dome or hanging camera
        const bracketGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8);
        const bracketMat = new THREE.MeshStandardMaterial({ color: '#64748b', metalness: 0.8 });
        const bracket = new THREE.Mesh(bracketGeo, bracketMat);
        bracket.rotation.x = Math.PI / 2;
        bracket.position.set(0, 0.5, -0.2);
        group.add(bracket);

        const cameraGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.4, 16);
        const cameraMat = new THREE.MeshStandardMaterial({ color: '#f1f5f9', roughness: 0.4 });
        const cameraObj = new THREE.Mesh(cameraGeo, cameraMat);
        cameraObj.position.set(0, 0.3, 0);
        cameraObj.rotation.x = Math.PI / 4;
        group.add(cameraObj);

        const lensGeo = new THREE.SphereGeometry(0.12, 12, 12);
        const lensMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.05, metalness: 0.9 });
        const lens = new THREE.Mesh(lensGeo, lensMat);
        lens.position.set(0, 0.16, 0.14);
        group.add(lens);

        // Calculate lens properties dynamically from specifications
        const lensStr = asset.specs?.Lens || asset.specs?.lens || '4.0mm';
        let actFov = 80 * (Math.PI / 180); // Default 4.0mm lens FOV (80 degrees)
        let actRadius = 9.0;               // Default coverage range (9 meters)

        if (lensStr.includes('2.8mm')) {
          actFov = 100 * (Math.PI / 180); // Wide-angle dome lens (100 degrees)
          actRadius = 6.5;                // Shorter high-detail reach (6.5 meters)
        } else if (lensStr.includes('6.0mm')) {
          actFov = 50 * (Math.PI / 180);  // Narrow telephoto lens (50 degrees)
          actRadius = 14.0;               // Long-distance reach (14.0 meters)
        }

        // 1. Precise 2D/3D ground coverage area sector wedge (Always visible on floor)
        // Since group is at height y: 3.2, local y: -3.18 aligns perfectly with the floor (slightly above to avoid z-fighting)
        const sectorGeo = new THREE.RingGeometry(0, actRadius, 32, 1, -Math.PI / 2 - actFov / 2, actFov);
        const sectorMat = new THREE.MeshBasicMaterial({
          color: '#f59e0b', // Warm security amber color scheme
          transparent: true,
          opacity: 0.09,    // Soft non-intrusive alpha
          side: THREE.DoubleSide
        });
        const sector = new THREE.Mesh(sectorGeo, sectorMat);
        sector.rotation.x = -Math.PI / 2;
        sector.position.y = -3.18;
        group.add(sector);

        // Add a clean, dashed or high-contrast border on the sector edges to act as an authentic CAD marker
        const outlineMat = new THREE.MeshBasicMaterial({
          color: '#fbbf24', // Brighter warning gold
          transparent: true,
          opacity: 0.28,
          side: THREE.DoubleSide,
          wireframe: true,
        });
        const sectorOutline = new THREE.Mesh(sectorGeo, outlineMat);
        sectorOutline.rotation.x = -Math.PI / 2;
        sectorOutline.position.y = -3.17;
        group.add(sectorOutline);

        // 2. Translucent volumetric viewing angle/projection cone in 3D mode
        if (viewMode === '3D') {
          const slantHeight = 3.2 / Math.cos(Math.PI / 4); // Slant distance from 3.2m height camera to ground
          const coneRadius = slantHeight * Math.tan(actFov / 2);
          const coneGeo = new THREE.ConeGeometry(coneRadius, slantHeight, 16, 1, true);
          
          // Translate geometric center to reposition the cone's apex directly at (0, 0, 0)
          coneGeo.translate(0, -slantHeight / 2, 0);
          
          const coneMat = new THREE.MeshBasicMaterial({
            color: '#f59e0b',
            transparent: true,
            opacity: 0.045, // Exceedingly soft volumetric visual queues
            side: THREE.DoubleSide
          });
          const cone = new THREE.Mesh(coneGeo, coneMat);
          
          // Mount the cone apex exactly on the camera lens
          cone.position.set(0, 0.16, 0.14);
          cone.rotation.x = Math.PI / 4; // Align tilt angle downward with the camera body orientation
          
          group.add(cone);
        }
        break;
      }

      case 'door_access': { // Card Access system
        const casingGeo = new THREE.BoxGeometry(0.12, 0.35, 0.06);
        const casingMat = new THREE.MeshStandardMaterial({ color: '#171717', roughness: 0.4 });
        const casing = new THREE.Mesh(casingGeo, casingMat);
        casing.position.y = 0.175;
        group.add(casing);

        // Status light
        const lightGeo = new THREE.BoxGeometry(0.08, 0.03, 0.07);
        const lightMat = new THREE.MeshBasicMaterial({ color: '#22c55e' }); // glowing green
        const light = new THREE.Mesh(lightGeo, lightMat);
        light.position.set(0, 0.28, 0.01);
        group.add(light);
        break;
      }

      case 'intercom': { // Intercom terminal
        const faceGeo = new THREE.BoxGeometry(0.2, 0.3, 0.06);
        const faceMat = new THREE.MeshStandardMaterial({ color: '#451a03', roughness: 0.5 });
        const face = new THREE.Mesh(faceGeo, faceMat);
        face.position.y = 0.15;
        group.add(face);

        const screenGeo = new THREE.BoxGeometry(0.14, 0.1, 0.07);
        const screenMat = new THREE.MeshStandardMaterial({ color: '#06b6d4', emissive: '#0891b2' });
        const screen = new THREE.Mesh(screenGeo, screenMat);
        screen.position.set(0, 0.21, 0.012);
        group.add(screen);
        break;
      }

      case 'power_outlet': { // New Blue outlet marking
        // Draw flat clean blue rectangle flush with floor
        const borderGeo = new THREE.BoxGeometry(0.6, 0.05, 0.6);
        const borderMat = new THREE.MeshStandardMaterial({
          color: '#4f46e5',
          emissive: '#1d4ed8',
          transparent: true,
          opacity: 0.9
        });
        const border = new THREE.Mesh(borderGeo, borderMat);
        border.position.y = 0.025;
        group.add(border);

        const socketCapGeo = new THREE.BoxGeometry(0.4, 0.06, 0.4);
        const socketCapMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 });
        const socketCap = new THREE.Mesh(socketCapGeo, socketCapMat);
        socketCap.position.y = 0.035;
        group.add(socketCap);
        break;
      }

      // -----------------------------------------
      // INTERIOR WORKSPACE (Furniture)
      // -----------------------------------------
      case 'desk_single': {
        // Table top wood panel
        const topGeo = new THREE.BoxGeometry(1.2, 0.05, 0.7);
        const topMat = new THREE.MeshStandardMaterial({ color: '#ea580c', roughness: 0.5 }); // warm cedar
        const top = new THREE.Mesh(topGeo, topMat);
        top.position.y = 0.725;
        top.castShadow = true;
        top.receiveShadow = true;
        group.add(top);

        // Thin metallic legs representation
        const legGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.7, 8);
        const legMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.9, roughness: 0.15 });

        const offsets = [
          { x: -0.55, z: -0.3 },
          { x: 0.55, z: -0.3 },
          { x: -0.55, z: 0.3 },
          { x: 0.55, z: 0.3 },
        ];

        offsets.forEach((offset) => {
          const leg = new THREE.Mesh(legGeo, legMat);
          leg.position.set(offset.x, 0.35, offset.z);
          leg.castShadow = true;
          group.add(leg);
        });
        break;
      }

      case 'desk_cluster_4':
      case 'desk_cluster_6': {
        const clusterScaleX = asset.scale?.x || 2.2;
        const clusterScaleZ = asset.scale?.z || 1.4;

        const mainTopGeo = new THREE.BoxGeometry(clusterScaleX, 0.06, clusterScaleZ);
        const mainTopMat = new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.3 }); // cool white office finish
        const top = new THREE.Mesh(mainTopGeo, mainTopMat);
        top.position.y = 0.725;
        top.castShadow = true;
        top.receiveShadow = true;
        group.add(top);

        // Frosted glass privacy screens dividing desks
        if (viewMode === '3D') {
          const divGeo = new THREE.BoxGeometry(clusterScaleX - 0.2, 0.3, 0.03);
          const divMat = new THREE.MeshStandardMaterial({ color: '#99f6e4', transparent: true, opacity: 0.4, roughness: 0.1 });
          const divider = new THREE.Mesh(divGeo, divMat);
          divider.position.set(0, 0.9, 0);
          group.add(divider);
        }

        // Star pillars base
        const legGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.7, 12);
        const legMat = new THREE.MeshStandardMaterial({ color: '#475569', metalness: 0.7 });
        const l1 = new THREE.Mesh(legGeo, legMat);
        const l2 = new THREE.Mesh(legGeo, legMat);
        l1.position.set(-clusterScaleX / 3, 0.35, 0);
        l2.position.set(clusterScaleX / 3, 0.35, 0);
        group.add(l1, l2);
        break;
      }

      case 'conference_table': {
        const topGeo = new THREE.BoxGeometry(asset.scale.x, 0.08, asset.scale.z);
        const topMat = new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.3, metalness: 0.1 }); // mahogany
        const top = new THREE.Mesh(topGeo, topMat);
        top.position.y = 0.74;
        top.castShadow = true;
        top.receiveShadow = true;
        group.add(top);

        // Premium block support bases
        const baseGeo = new THREE.BoxGeometry(asset.scale.x * 0.6, 0.7, asset.scale.z * 0.4);
        const baseMat = new THREE.MeshStandardMaterial({ color: '#1e293b' });
        const baseMesh = new THREE.Mesh(baseGeo, baseMat);
        baseMesh.position.y = 0.35;
        baseMesh.castShadow = true;
        group.add(baseMesh);
        break;
      }

      case 'chair_office': {
        // Office swiveller
        const baseGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.08, 16);
        const seatColor = isSelected ? '#0891b2' : '#334155';
        const baseMat = new THREE.MeshStandardMaterial({ color: seatColor, roughness: 0.6 });
        const seat = new THREE.Mesh(baseGeo, baseMat);
        seat.position.y = 0.45;
        seat.castShadow = true;
        group.add(seat);

        // Curved back support
        if (viewMode === '3D') {
          const backGeo = new THREE.BoxGeometry(0.06, 0.4, 0.3);
          const back = new THREE.Mesh(backGeo, baseMat);
          back.position.set(-0.13, 0.68, 0);
          back.rotation.z = -0.15;
          group.add(back);

          // Support bar
          const metalGeo = new THREE.BoxGeometry(0.04, 0.3, 0.04);
          const metalMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.9 });
          const bar = new THREE.Mesh(metalGeo, metalMat);
          bar.position.set(-0.1, 0.48, 0);
          group.add(bar);
        }

        // Stand shaft and legs
        const standGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.4, 8);
        const standMat = new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.7 });
        const stand = new THREE.Mesh(standGeo, standMat);
        stand.position.y = 0.2;
        group.add(stand);
        break;
      }

      case 'chair_lounge': {
        const primaryColor = '#ea580c'; // Soft premium orange fabric
        const sofaMat = new THREE.MeshStandardMaterial({ color: primaryColor, roughness: 0.8 });

        // Base box
        const baseGeo = new THREE.BoxGeometry(1.0, 0.35, 0.9);
        const base = new THREE.Mesh(baseGeo, sofaMat);
        base.position.y = 0.175;
        base.castShadow = true;
        group.add(base);

        if (viewMode === '3D') {
          // Soft backrest cushion
          const backGeo = new THREE.BoxGeometry(0.2, 0.6, 0.9);
          const back = new THREE.Mesh(backGeo, sofaMat);
          back.position.set(-0.4, 0.45, 0);
          group.add(back);

          // Armrests
          const armGeo = new THREE.BoxGeometry(0.8, 0.25, 0.15);
          const armLeft = new THREE.Mesh(armGeo, sofaMat);
          armLeft.position.set(0.1, 0.38, 0.375);
          const armRight = new THREE.Mesh(armGeo, sofaMat);
          armRight.position.set(0.1, 0.38, -0.375);
          group.add(armLeft, armRight);
        }
        break;
      }

      case 'reception_desk': {
        // Curve shape
        const curveGeo = new THREE.CylinderGeometry(1.2, 1.2, 1.0, 32, 1, false, 0, Math.PI);
        const curveMat = new THREE.MeshStandardMaterial({ color: '#1e3a8a', roughness: 0.4, metalness: 0.2 }); // royal clean blue casing
        const front = new THREE.Mesh(curveGeo, curveMat);
        front.position.y = 0.5;
        front.castShadow = true;
        front.receiveShadow = true;
        group.add(front);

        // Counter top slab
        const slabGeo = new THREE.BoxGeometry(2.4, 0.08, 0.5);
        const slabMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.1, metalness: 0.8 }); // white quartz top
        const counterSlab = new THREE.Mesh(slabGeo, slabMat);
        counterSlab.position.set(0, 1.0, 0);
        group.add(counterSlab);
        break;
      }

      case 'whiteboard': {
        // Wooden stand + board
        const standGeo = new THREE.BoxGeometry(0.1, 1.6, 1.2);
        const borderMat = new THREE.MeshStandardMaterial({ color: '#4b5563' });
        const stand = new THREE.Mesh(standGeo, borderMat);
        stand.position.y = 0.8;
        group.add(stand);

        const screenGeo = new THREE.BoxGeometry(0.04, 1.0, 1.15);
        const whiteMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.2 });
        const screen = new THREE.Mesh(screenGeo, whiteMat);
        screen.position.set(0.04, 0.9, 0);
        group.add(screen);
        break;
      }

      default: {
        // Fallback cube box
        const geo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
        const mat = new THREE.MeshStandardMaterial({ color: '#94a3b8' });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.y = 0.4;
        group.add(mesh);
        break;
      }
    }
  }

  // Mouse interactivity triggers (Hovering, clicking, and dragging)
  const handlePointerDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!rendererRef.current || !cameraRef.current || !sceneRef.current) return;

    // Calculate normalized mouse location
    const rect = rendererRef.current.domElement.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    mouseRef.current.set(x, y);

    // Casting rays to search for device models or furniture selections
    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);

    const placedAssetsGroup = sceneRef.current.getObjectByName('PLACED_ASSETS_GROUP');
    if (!placedAssetsGroup) return;

    // Filter mesh intersects
    const intersects = raycasterRef.current.intersectObjects(placedAssetsGroup.children, true);

    if (intersects.length > 0) {
      // Ascend parents to find the root group carrying the loaded asset identifier
      let currentObj: THREE.Object3D | null = intersects[0].object;
      let matchedId: string | null = null;

      while (currentObj && currentObj !== sceneRef.current) {
        if (currentObj.userData && currentObj.userData.assetId) {
          matchedId = currentObj.userData.assetId;
          break;
        }
        currentObj = currentObj.parent;
      }

      if (matchedId) {
        // Selected!
        onSelectAsset(matchedId);

        if (viewMode === '2D') {
          // Prep the raycasting drag plane
          isDraggingRef.current = true;
          draggedAssetIdRef.current = matchedId;
          controlsRef.current!.enabled = false; // suspend camera orientation changes during drags

          const intersectionPoint = intersects[0].point;
          dragPlaneRef.current.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), intersectionPoint);
        }
        return;
      }
    }

    // Checking if click landed outside any entities - deselect
    onSelectAsset(null);
  };

  const handlePointerMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!rendererRef.current || !cameraRef.current || !sceneRef.current) return;

    const rect = rendererRef.current.domElement.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    mouseRef.current.set(x, y);

    // 1. Process active Raycast drags
    if (isDraggingRef.current && draggedAssetIdRef.current) {
      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      const intersectionPoint = new THREE.Vector3();

      if (raycasterRef.current.ray.intersectPlane(dragPlaneRef.current, intersectionPoint)) {
        // Enforce boundary safeties: Keep within grid boundary
        const boundedX = Math.max(-28, Math.min(28, intersectionPoint.x));
        const boundedZ = Math.max(-18, Math.min(18, intersectionPoint.z));

        // Direct mesh local position update for flawless lag-free responsiveness
        const visualMesh = assetMeshesRef.current.get(draggedAssetIdRef.current);
        if (visualMesh) {
          visualMesh.position.x = boundedX;
          visualMesh.position.z = boundedZ;
        }

        // Notify parent React component state managers for reporting synchronization
        onUpdateAssetPosition(draggedAssetIdRef.current, boundedX, boundedZ);
      }
      return;
    }

    // 2. Hover highlights tooltips
    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);

    // A. Check for asset hovering
    const assetsGroup = sceneRef.current.getObjectByName('PLACED_ASSETS_GROUP');
    let assetFound = false;

    if (assetsGroup) {
      const intersects = raycasterRef.current.intersectObjects(assetsGroup.children, true);
      if (intersects.length > 0) {
        let currentObj: THREE.Object3D | null = intersects[0].object;
        let matchedId: string | null = null;
        while (currentObj && currentObj !== sceneRef.current) {
          if (currentObj.userData && currentObj.userData.assetId) {
            matchedId = currentObj.userData.assetId;
            break;
          }
          currentObj = currentObj.parent;
        }
        if (matchedId) {
          const hoveredObj = assets.find((a) => a.id === matchedId);
          if (hoveredObj) {
            setHoveredAsset(hoveredObj);
            setHoveredRoom(null); // priorities device details
            assetFound = true;
          }
        }
      }
    }

    // B. Check for room surface hovering if no assets hovered
    if (!assetFound) {
      setHoveredAsset(null);
      const roomGroup = sceneRef.current.getObjectByName('ROOM_PLAN_GROUP');
      if (roomGroup) {
        const floorPlanes = roomGroup.children.map(g => g.children[0]).filter(Boolean);
        const intersects = raycasterRef.current.intersectObjects(floorPlanes, true);
        if (intersects.length > 0) {
          const clickedFloor = intersects[0].object;
          const parentRoomGroup = clickedFloor.parent;
          if (parentRoomGroup) {
            const roomId = parentRoomGroup.name.replace('room_', '');
            const hoveredRm = rooms.find((r) => r.id === roomId);
            if (hoveredRm) {
              setHoveredRoom(hoveredRm);
              return;
            }
          }
        }
      }
      setHoveredRoom(null);
    }
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
    draggedAssetIdRef.current = null;
    if (controlsRef.current) controlsRef.current.enabled = true; // resume rotations
  };

  return (
    <div className="relative w-full h-full select-none" ref={containerRef} id="cad-viewport-container">
      {/* Three canvas rendering frame */}
      <canvas
        className="w-full h-full cursor-grab active:cursor-grabbing block focus:outline-none"
        ref={canvasRef}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        id="cad-three-canvas"
      />

      {/* 2D HTML Room Labels Projections HUD Overlay */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" id="room-labels-canvas-overlay">
        {projectedRooms.map((room) => {
          let badgeColor = 'text-emerald-700 bg-emerald-50 border-emerald-200/60';
          let statusText = 'Cozy';
          if (room.loadPercentage > 120) {
            badgeColor = 'text-rose-700 bg-rose-50 border-rose-200/60 animate-pulse';
            statusText = 'Overloaded';
          } else if (room.loadPercentage > 60) {
            badgeColor = 'text-amber-700 bg-amber-50 border-amber-200/60';
            statusText = 'Busy';
          }

          return (
            <div
              key={room.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center text-center transition-all duration-150"
              style={{ left: `${room.x}px`, top: `${room.y}px` }}
            >
              <span
                className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-white/95 text-slate-800 shadow-xs border border-slate-200 select-none pointer-events-none mb-1 inline-block"
                style={{ borderLeftColor: room.textColor, borderLeftWidth: '3.5px' }}
              >
                {room.name}
              </span>
              <div className="flex items-center gap-1.5 flex-nowrap shrink-0">
                <span className="text-[9.5px] font-mono font-bold text-slate-550 bg-white/80 border border-slate-200/50 px-1.5 py-0.5 rounded-md select-none pointer-events-none shadow-3xs">
                  {room.area} SQFT
                </span>
                {showOccupancyHeatmap && (
                  <span className={`text-[9.5px] font-mono font-extrabold px-1.5 py-0.5 border rounded-md shadow-3xs select-none pointer-events-none ${badgeColor}`}>
                    {room.assetCount} Nodes | {room.loadPercentage}% ({statusText})
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Real-time floating inspector HUD */}
      {(hoveredAsset || hoveredRoom) && (
        <div
          className="absolute bottom-5 left-5 pointer-events-none max-w-sm rounded-2xl p-4 bg-white/95 backdrop-blur-md shadow-lg border border-slate-200/80 animate-in fade-in slide-in-from-bottom-2 duration-200"
          id="hover-hud-inspector"
        >
          {hoveredAsset ? (
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${hoveredAsset.category === 'infrastructure' ? 'bg-blue-600' : 'bg-orange-500'}`} />
                <h4 className="text-sm font-bold text-slate-800 font-sans">{hoveredAsset.name}</h4>
              </div>
              <p className="text-[10px] text-slate-500 mb-2 font-mono uppercase tracking-wider font-semibold">{hoveredAsset.type.replace('_', ' ')}</p>
              
              {hoveredAsset.specs && Object.keys(hoveredAsset.specs).length > 0 && (
                <div className="space-y-1 border-t border-slate-100 pt-2 font-mono text-[10px] text-slate-600">
                  {Object.entries(hoveredAsset.specs).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4">
                      <span className="text-slate-400 font-bold">{k}:</span>
                      <span className="text-slate-800 font-medium break-all">{v}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="text-[10px] mt-2 text-slate-400 font-mono">Position: X {hoveredAsset.position.x.toFixed(1)}m, Z {hoveredAsset.position.z.toFixed(1)}m</div>
              
              {(() => {
                const isOutside = isAssetOutsideRooms(hoveredAsset, rooms);
                const isColliding = assets.some((other) => other.id !== hoveredAsset.id && isOverlapping(hoveredAsset, other));
                if (isOutside || isColliding) {
                  return (
                    <div className="mt-2.5 p-2.5 bg-rose-50 border border-rose-200/60 rounded-xl text-rose-700 text-[10px] font-medium flex flex-col gap-1">
                      <div className="font-bold flex items-center gap-1 font-mono uppercase tracking-wider text-[9px] text-rose-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse inline-block" />
                        Placement Alert
                      </div>
                      {isOutside && <div className="leading-tight">• Positioning is outside defined room boundaries</div>}
                      {isColliding && <div className="leading-tight">• Position overlaps with another physical asset</div>}
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          ) : hoveredRoom ? (
            <div className="font-sans">
              <h4 className="text-sm font-bold text-slate-800 mb-0.5 flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm border border-slate-300" style={{ backgroundColor: hoveredRoom.color }} />
                {hoveredRoom.name}
              </h4>
              <p className="text-xs text-slate-500 font-mono mb-2">Area: {Math.round(hoveredRoom.width * hoveredRoom.depth * 10.7639)} SQFT (~{(hoveredRoom.width * hoveredRoom.depth).toFixed(1)} m²)</p>
              <div className="space-y-1 border-t border-slate-100 pt-2 text-[11px] text-slate-600 flex flex-col gap-0.5">
                <div className="flex justify-between">
                  <span>Room Width:</span>
                  <span className="font-semibold text-slate-850">{hoveredRoom.width.toFixed(1)}m</span>
                </div>
                <div className="flex justify-between">
                  <span>Room Depth:</span>
                  <span className="font-semibold text-slate-850">{hoveredRoom.depth.toFixed(1)}m</span>
                </div>
                
                {/* Real-time Occupancy Load Section */}
                {(() => {
                  const roomAssets = assets.filter(a => a.assignedRoomId === hoveredRoom.id);
                  const count = roomAssets.length;
                  const areaSqFt = hoveredRoom.width * hoveredRoom.depth * 10.7639;
                  const capacity = Math.max(1, Math.floor(areaSqFt / 80));
                  const percentage = Math.round((count / capacity) * 100);
                  
                  let colorClass = 'text-emerald-600';
                  let status = 'Comfortable / Low Load';
                  if (count > 0) {
                    if (percentage > 120) {
                      colorClass = 'text-rose-600 font-bold';
                      status = 'Highly Congested / Overloaded';
                    } else if (percentage > 60) {
                      colorClass = 'text-amber-600 font-semibold';
                      status = 'Optimal Working Load';
                    } else {
                      colorClass = 'text-emerald-600';
                      status = 'Comfortable / Low Load';
                    }
                  } else {
                    status = 'Fully Vacant';
                  }

                  return (
                    <>
                      <div className="flex justify-between border-t border-slate-50 pt-1 mt-1 font-semibold text-slate-700">
                        <span>Allocated Devices:</span>
                        <span>{count} items</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Max Nodes Capacity:</span>
                        <span className="font-mono text-slate-500">{capacity} units</span>
                      </div>
                      <div className="flex justify-between items-center border-t border-slate-100 pt-1.5 mt-1.5">
                        <span className="text-[10px] font-bold text-slate-400 font-mono block uppercase">Load Index:</span>
                        <span className={`text-xs font-bold ${colorClass}`}>{percentage}%</span>
                      </div>
                      <div className="text-[10px] italic text-slate-450 mt-1 leading-tight">
                        Status: <span className={colorClass}>{status}</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Guide indicators */}
      <div className="absolute top-4 left-4 pointer-events-none flex flex-col gap-1.5" id="cad-viewer-shortcuts">
        <div className="px-3 py-1.5 rounded-xl bg-slate-900/90 text-white backdrop-blur-xs text-[11px] font-bold shadow-md flex items-center gap-2 select-none border border-slate-700/30">
          <span className="inline-block w-2 h-2 relative flex">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          {viewMode === '3D' ? '3D Orbit Navigation Enabled' : '2D Architectural Blueprint locked'}
        </div>
        <div className="hidden sm:flex text-[10px] text-slate-500 bg-white/90 border border-slate-200/80 px-3 py-1.5 rounded-xl pointer-events-auto shadow-xs flex-col gap-1 font-mono">
          <div><b className="text-slate-805">Orbit/Pan:</b> Drag Left Click (3D) or Right Click</div>
          <div><b className="text-slate-805">Zoom:</b> Scroll Mouse Wheel / Slide Touchpad</div>
          <div><b className="text-slate-805">Drag:</b> Left-Click hold on any item to move</div>
        </div>
        {showOccupancyHeatmap && (
          <div className="px-3.5 py-2.5 rounded-xl bg-white/95 border border-slate-200 shadow-md text-[10.5px] pointer-events-auto flex flex-col gap-1.5 max-w-[240px] transition-all select-none font-sans">
            <div className="font-bold text-slate-850 flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-mono">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Occupancy Heatmap</span>
            </div>
            <div className="h-2 w-full rounded bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500 border border-slate-200/50" />
            <div className="flex justify-between text-[9px] font-bold text-slate-400 font-mono">
              <span>Cozy (0%)</span>
              <span>Optimal (50%)</span>
              <span>Busy (100%+)</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
