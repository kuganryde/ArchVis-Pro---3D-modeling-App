import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PlacedAsset, RoomDefinition } from '../types';
import type { StackView } from '../utils/levels';
import { buildProceduralAssetMesh } from '../three/proceduralAssets';
import { instantiateModel, preloadModels } from '../three/modelLibrary';
import {
  getAssetSize,
  isOverlapping,
  isAssetOutsideRooms,
  getOccupancyColor,
  getRoomWallStyle,
} from '../utils/geometry';

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
  /** Fired once when a drag gesture ends, so the parent can close its undo group. */
  onDragEnd?: () => void;
  /**
   * Stacked building view: when set, the other floors are drawn as translucent
   * "ghost" floors at their real elevations and the active floor is lifted to its
   * own. Clicking a ghost floor calls onSelectLevel. Null/undefined = single floor.
   */
  stack?: StackView | null;
  onSelectLevel?: (levelId: string) => void;
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
  // When provided, the canvas registers a snapshot function here so the parent
  // can capture a PNG of the current 3D view for exports.
  captureRef?: React.MutableRefObject<(() => string | null) | null>;
}

export default function ThreeCanvas({
  rooms,
  assets,
  selectedAssetId,
  onSelectAsset,
  onUpdateAssetPosition,
  onDragEnd,
  stack = null,
  onSelectLevel,
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
  captureRef,
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

  // Library models load asynchronously; bump this when they are ready so the assets
  // are rebuilt with them (until then, and for any model that fails, the procedural
  // model is shown).
  const [modelsVersion, setModelsVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    preloadModels().then(() => alive && setModelsVersion((v) => v + 1));
    return () => {
      alive = false;
    };
  }, []);

  // Stacked-view bookkeeping
  const [projectedLevels, setProjectedLevels] = useState<Array<{ id: string; name: string; x: number; y: number }>>([]);
  const stackOffset = stack ? stack.levels.find((l) => l.id === stack.activeLevelId)?.baseElevation ?? 0 : 0;
  const stackOffsetRef = useRef(stackOffset);
  const ghostAnchorsRef = useRef<Array<{ id: string; name: string; pos: THREE.Vector3 }>>([]);
  const ghostPickRef = useRef<THREE.Object3D[]>([]);
  const ghostPressRef = useRef<{ levelId: string; x: number; y: number } | null>(null);
  const hadLevelLabelsRef = useRef(false);

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

  useEffect(() => {
    stackOffsetRef.current = stackOffset;
  }, [stackOffset]);

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
      preserveDrawingBuffer: true, // required so the canvas can be captured to PNG
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    // PCFSoftShadowMap is deprecated in recent three.js (auto-downgraded to
    // PCFShadowMap with a console warning); use PCFShadowMap directly.
    renderer.shadowMap.type = THREE.PCFShadowMap;
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
          tempV.set(r.x, stackOffsetRef.current, r.z);
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

        // Ghost-floor name tags (stacked view only; cleared once when it turns off).
        const anchors = ghostAnchorsRef.current;
        if (anchors.length > 0 || hadLevelLabelsRef.current) {
          const labels = anchors
            .map((a) => {
              tempV.copy(a.pos).project(camera);
              return {
                id: a.id,
                name: a.name,
                // Keep the tag inside the viewport (≈120px wide) instead of clipping at the edge.
                x: Math.max(8, Math.min((tempV.x * 0.5 + 0.5) * rect.width, rect.width - 130)),
                y: (-tempV.y * 0.5 + 0.5) * rect.height,
                ok: tempV.z <= 1 && Number.isFinite(tempV.x) && Number.isFinite(tempV.y),
              };
            })
            .filter((l) => l.ok);
          setProjectedLevels(labels);
          hadLevelLabelsRef.current = anchors.length > 0;
        }
      }

      renderer.render(scene, camera);
      requestRef.current = requestAnimationFrame(renderLoop);
    };

    renderLoop();

    // Expose a snapshot function so the parent can export a PNG of the view.
    if (captureRef) {
      captureRef.current = () => {
        try {
          renderer.render(scene, camera);
          return renderer.domElement.toDataURL('image/png');
        } catch (err) {
          console.error('Snapshot capture failed:', err);
          return null;
        }
      };
    }

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      if (captureRef) captureRef.current = null;
    };
    // Build the renderer ONCE. It used to depend on [rooms], tearing down and
    // recreating the WebGL renderer, camera and scene on every room change. The
    // render loop reads live data through roomsRef / assetsRef instead.
  }, []);

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
        mesh.position.set(blueprintOffsetX, -0.012 + stackOffset, blueprintOffsetZ);

        scene.add(mesh);
      },
      (err) => {
        console.error('Error loading custom blueprint asset texture:', err);
      }
    );
  }, [blueprintImage, blueprintVisible, blueprintOpacity, blueprintScale, blueprintAspect, blueprintOffsetX, blueprintOffsetZ, stackOffset]);

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
    roomPlanGroup.position.y = stackOffset; // lifted to this floor's elevation in the stacked view

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

        // Derive the wall finish from the room (explicit wallStyle or name-based
        // heuristic) so imported / AI-generated rooms render sensibly too.
        const wallStyle = getRoomWallStyle(room);

        // Draw outer room partitions
        createWallMesh(room.width, wallHeight, wallThickness, room.x, wallHeight / 2, room.z - room.depth / 2, 0, group, wallStyle);
        createWallMesh(room.width, wallHeight, wallThickness, room.x, wallHeight / 2, room.z + room.depth / 2, 0, group, wallStyle);
        createWallMesh(room.depth, wallHeight, wallThickness, room.x - room.width / 2, wallHeight / 2, room.z, Math.PI / 2, group, wallStyle);
        createWallMesh(room.depth, wallHeight, wallThickness, room.x + room.width / 2, wallHeight / 2, room.z, Math.PI / 2, group, wallStyle);
      }

      roomPlanGroup.add(group);
    });

    scene.add(roomPlanGroup);
  }, [rooms, viewMode, assets, showOccupancyHeatmap, showWifiHeatmap, stackOffset]);

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
    assetsGroup.position.y = stackOffset;

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
      const isSelected = asset.id === selectedAssetId;
      const libraryModel = instantiateModel(asset, { isSelected });
      if (libraryModel) group.add(libraryModel);
      else buildProceduralAssetMesh(asset, group, { isSelected, viewMode });

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
      cablingGroup.position.y = stackOffset;

      // Locate the network rack (MDF/IDF). Prefer a room that looks like a
      // server/comms room; otherwise fall back to the grid origin so cabling
      // still renders for imported / AI layouts that have no server room.
      const serverRoom = rooms.find((r) =>
        /(server|comms|mdf|idf|network|rack)/i.test(`${r.id} ${r.name}`)
      );
      const rackX = serverRoom ? serverRoom.x : 0;
      const rackZ = serverRoom ? serverRoom.z : 0;

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
  }, [assets, rooms, selectedAssetId, activeCategoryFilter, activeAssetTypeFilter, viewMode, showWifiHeatmap, showCablingPaths, stackOffset, modelsVersion]);

  // Cheap content signature of the OTHER floors: the ghost meshes rebuild only when
  // something visible on them changes, not on every edit to the active floor.
  const ghostKey = stack
    ? stack.levels
        .filter((l) => l.id !== stack.activeLevelId && !(stack.cutAbove && l.baseElevation > stackOffset))
        .map(
          (l) =>
            `${l.id}|${l.name}|${l.baseElevation}|` +
            l.rooms.map((r) => `${r.id},${r.x},${r.z},${r.width},${r.depth},${r.color}`).join(';') +
            '|' +
            l.assets.map((a) => `${a.id},${a.position.x},${a.position.y},${a.position.z},${a.category}`).join(';')
        )
        .join('#')
    : '';

  // Stacked building view: draw every other floor as a light, translucent ghost.
  useEffect(() => {
    const scene = sceneRef.current;
    ghostAnchorsRef.current = [];
    ghostPickRef.current = [];
    if (!scene || !stack || viewMode !== '3D') return;

    const group = new THREE.Group();
    group.name = 'GHOST_FLOORS_GROUP';
    const disposables: Array<{ dispose: () => void }> = [];
    const pickables: THREE.Object3D[] = [];
    const anchors: Array<{ id: string; name: string; pos: THREE.Vector3 }> = [];
    const infraColor = new THREE.Color('#06b6d4');
    const furnColor = new THREE.Color('#94a3b8');
    const dummy = new THREE.Object3D();

    stack.levels.forEach((level) => {
      if (level.id === stack.activeLevelId) return;
      if (stack.cutAbove && level.baseElevation > stackOffset) return;

      const floor = new THREE.Group();
      floor.position.y = level.baseElevation;
      floor.userData.levelId = level.id;

      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      level.rooms.forEach((room) => {
        const slabGeo = new THREE.BoxGeometry(room.width, 0.1, room.depth);
        const slabMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(room.color),
          transparent: true,
          opacity: 0.38,
          roughness: 0.9,
          depthWrite: false,
        });
        const slab = new THREE.Mesh(slabGeo, slabMat);
        slab.position.set(room.x, 0.05, room.z);
        slab.userData.levelId = level.id;
        floor.add(slab);
        pickables.push(slab);

        // Wireframe walls: legible massing without hiding the floors behind.
        const wallGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(room.width, 2.4, room.depth));
        const wallMat = new THREE.LineBasicMaterial({ color: '#94a3b8', transparent: true, opacity: 0.55 });
        const walls = new THREE.LineSegments(wallGeo, wallMat);
        walls.position.set(room.x, 1.2, room.z);
        floor.add(walls);
        disposables.push(slabGeo, slabMat, wallGeo, wallMat);

        minX = Math.min(minX, room.x - room.width / 2);
        maxX = Math.max(maxX, room.x + room.width / 2);
        minZ = Math.min(minZ, room.z - room.depth / 2);
        maxZ = Math.max(maxZ, room.z + room.depth / 2);
      });

      // One instanced mesh per floor for all asset markers (cheap even for 1000s).
      if (level.assets.length > 0) {
        const markerGeo = new THREE.BoxGeometry(0.32, 0.32, 0.32);
        const markerMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 });
        const markers = new THREE.InstancedMesh(markerGeo, markerMat, level.assets.length);
        level.assets.forEach((a, i) => {
          dummy.position.set(a.position.x, Math.min(a.position.y, level.height - 0.2), a.position.z);
          dummy.updateMatrix();
          markers.setMatrixAt(i, dummy.matrix);
          markers.setColorAt(i, a.category === 'infrastructure' ? infraColor : furnColor);
        });
        markers.instanceMatrix.needsUpdate = true;
        if (markers.instanceColor) markers.instanceColor.needsUpdate = true;
        markers.raycast = () => {}; // markers are decoration; only slabs are clickable
        floor.add(markers);
        disposables.push(markerGeo, markerMat, markers);
      }

      group.add(floor);
      const hasRooms = Number.isFinite(minX);
      anchors.push({
        id: level.id,
        name: level.name,
        pos: new THREE.Vector3(hasRooms ? maxX + 1.2 : 0, level.baseElevation + 0.6, hasRooms ? (minZ + maxZ) / 2 : 0),
      });
    });

    scene.add(group);
    ghostAnchorsRef.current = anchors;
    ghostPickRef.current = pickables;
    return () => {
      scene.remove(group);
      disposables.forEach((d) => d.dispose());
      ghostAnchorsRef.current = [];
      ghostPickRef.current = [];
    };
  }, [ghostKey, viewMode, !!stack]);

  // Frame the whole building when the stack turns on / its height changes, and go
  // back to the normal camera when it turns off.
  const stackHeight = stack ? Math.round(stack.totalHeight * 10) : 0;
  useEffect(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls || viewMode !== '3D') return;
    if (stack) {
      const h = stack.totalHeight;
      controls.maxDistance = 160;
      controls.target.set(0, h / 2, 0);
      camera.position.set(0, h / 2 + 18 + h * 0.7, 26 + h * 1.2);
    } else {
      controls.maxDistance = 60;
      controls.target.set(0, 0, 0);
      camera.position.set(0, 20, 24);
    }
    controls.update();
  }, [!!stack, stackHeight, viewMode]);

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

    ghostPressRef.current = null;
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

        // Prep the raycasting drag plane
        isDraggingRef.current = true;
        draggedAssetIdRef.current = matchedId;
        controlsRef.current!.enabled = false; // suspend camera orientation changes during drags

        const intersectionPoint = intersects[0].point;
        dragPlaneRef.current.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), intersectionPoint);
        return;
      }
    }

    // A press on a ghost floor may become a floor switch on mouse-up — but only if
    // the pointer did not move (otherwise it was an orbit gesture, not a click).
    if (ghostPickRef.current.length > 0) {
      const hit = raycasterRef.current.intersectObjects(ghostPickRef.current, false)[0];
      if (hit?.object.userData.levelId) {
        ghostPressRef.current = { levelId: hit.object.userData.levelId, x: e.clientX, y: e.clientY };
      }
    }

    // Checking if click landed outside any entities - deselect
    onSelectAsset(null);
  };

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const press = ghostPressRef.current;
    ghostPressRef.current = null;
    handlePointerUp();
    if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) < 5) onSelectLevel?.(press.levelId);
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

    // Pointer cursor over a clickable ghost floor.
    if (canvasRef.current) {
      const overGhost = ghostPickRef.current.length > 0 && raycasterRef.current.intersectObjects(ghostPickRef.current, false).length > 0;
      canvasRef.current.style.cursor = overGhost ? 'pointer' : '';
    }

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
    if (isDraggingRef.current) onDragEnd?.();
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
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={() => { ghostPressRef.current = null; handlePointerUp(); }}
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

      {/* Stacked view: floor name tags beside each ghost floor */}
      {projectedLevels.length > 0 && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden" id="level-labels-canvas-overlay" aria-hidden="true">
          {projectedLevels.map((l) => (
            <span
              key={l.id}
              className="absolute -translate-y-1/2 text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-white/90 text-slate-600 border border-slate-200 shadow-xs select-none whitespace-nowrap"
              style={{ left: `${l.x}px`, top: `${l.y}px` }}
            >
              {l.name}
            </span>
          ))}
        </div>
      )}

      {/* Real-time floating inspector HUD */}
      {(hoveredAsset || hoveredRoom) && (
        <div
          className="absolute bottom-4 right-4 pointer-events-none w-72 max-w-[40%] rounded-2xl p-4 bg-white/95 backdrop-blur-md shadow-lg border border-slate-200/80 animate-in fade-in slide-in-from-bottom-2 duration-200"
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
