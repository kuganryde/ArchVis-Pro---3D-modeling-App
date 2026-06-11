import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PlacedAsset, RoomDefinition } from '../types';

interface ThreeCanvasProps {
  rooms: RoomDefinition[];
  assets: PlacedAsset[];
  selectedAssetId: string | null;
  onSelectAsset: (id: string | null) => void;
  onUpdateAssetPosition: (id: string, x: number, z: number) => void;
  viewMode: '2D' | '3D';
  activeCategoryFilter: 'all' | 'furniture' | 'infrastructure';
  activeAssetTypeFilter: string | 'all';
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
  const [projectedRooms, setProjectedRooms] = useState<Array<{ id: string; name: string; area: number; x: number; y: number; textColor: string }>>([]);

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
        const list = rooms.map((r) => {
          tempV.set(r.x, 0, r.z);
          tempV.project(camera);
          const x = (tempV.x * .5 + .5) * rect.width;
          const y = (-(tempV.y) * .5 + .5) * rect.height;
          return {
            id: r.id,
            name: r.name,
            area: r.areaSqFt,
            x,
            y,
            textColor: r.textColor || '#000000',
            inScope: tempV.z <= 1, // behind camera filter
          };
        }).filter(item => item.inScope);
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

  // Re-generate Room Boxes and extruded walls when Rooms state or ViewMode updates
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const existingRoomPlan = scene.getObjectByName('ROOM_PLAN_GROUP');
    if (existingRoomPlan) scene.remove(existingRoomPlan);

    const roomPlanGroup = new THREE.Group();
    roomPlanGroup.name = 'ROOM_PLAN_GROUP';

    rooms.forEach((room) => {
      const group = new THREE.Group();
      group.name = `room_${room.id}`;

      // Floor plane tile
      const floorGeo = new THREE.BoxGeometry(room.width, 0.06, room.depth);
      const floorMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(room.color),
        roughness: 0.9,
        metalness: 0.05,
        transparent: true,
        opacity: 0.65,
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
  }, [rooms, viewMode]);

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
    const existingAssetsGroup = scene.getObjectByName('PLACED_ASSETS_GROUP');
    if (existingAssetsGroup) scene.remove(existingAssetsGroup);

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

      // Handle selection ring visual queues
      if (asset.id === selectedAssetId) {
        // High-contrast glowing cyan selection ring
        const ringGeo = new THREE.RingGeometry(0.7, 0.8, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: '#06b6d4',
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
          color: '#06b6d4',
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
    });

    scene.add(assetsGroup);
    assetMeshesRef.current = meshMap;
  }, [assets, selectedAssetId, activeCategoryFilter, activeAssetTypeFilter, viewMode]);

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

        // Translucent viewing angles cone in 3D mode
        if (viewMode === '3D') {
          const coneGeo = new THREE.ConeGeometry(3.5, 5, 16, 1, true);
          const coneMat = new THREE.MeshBasicMaterial({
            color: '#f59e0b',
            transparent: true,
            opacity: 0.07,
            side: THREE.DoubleSide
          });
          const cone = new THREE.Mesh(coneGeo, coneMat);
          cone.rotation.x = Math.PI + Math.PI / 4;
          cone.position.set(0, -1.8, 1.8);
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

        // Prep the raycasting drag plane
        isDraggingRef.current = true;
        draggedAssetIdRef.current = matchedId;
        controlsRef.current!.enabled = false; // suspend camera orientation changes during drags

        const intersectionPoint = intersects[0].point;
        dragPlaneRef.current.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), intersectionPoint);
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
        {projectedRooms.map((room) => (
          <div
            key={room.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center text-center transition-all duration-150"
            style={{ left: room.x, top: room.y }}
          >
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/90 shadow-xs border border-slate-200/50 select-none pointer-events-none"
              style={{ color: room.textColor }}
            >
              {room.name}
            </span>
            <span className="text-[10px] font-mono text-slate-500 bg-white/70 px-1 py-0.2 rounded-sm mt-0.5 select-none pointer-events-none">
              {room.area} SQFT
            </span>
          </div>
        ))}
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
            </div>
          ) : hoveredRoom ? (
            <div className="font-sans">
              <h4 className="text-sm font-bold text-slate-800 mb-0.5 flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm border border-slate-300" style={{ backgroundColor: hoveredRoom.color }} />
                {hoveredRoom.name}
              </h4>
              <p className="text-xs text-slate-500 font-mono mb-2">Area: {hoveredRoom.areaSqFt} SQFT (~{(hoveredRoom.areaSqFt * 0.0929).toFixed(1)} m²)</p>
              <div className="space-y-1 border-t border-slate-100 pt-2 text-[11px] text-slate-600 flex flex-col gap-0.5">
                <div className="flex justify-between">
                  <span>Room Width:</span>
                  <span className="font-semibold text-slate-850">{hoveredRoom.width.toFixed(1)}m</span>
                </div>
                <div className="flex justify-between">
                  <span>Room Depth:</span>
                  <span className="font-semibold text-slate-850">{hoveredRoom.depth.toFixed(1)}m</span>
                </div>
                <div className="flex justify-between border-t border-slate-50 pt-1 mt-1 font-semibold text-blue-600">
                  <span>Allocated Items:</span>
                  <span>{assets.filter(a => a.assignedRoomId === hoveredRoom.id).length} items</span>
                </div>
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
      </div>
    </div>
  );
}
