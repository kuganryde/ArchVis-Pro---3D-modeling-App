/**
 * Procedural 3D models for every placeable asset type (low-current devices and
 * furniture). These are the fallback when no library model is registered or loaded
 * (see modelLibrary.ts), and the only models for devices that no free library offers
 * (access points, CCTV, wall ports…). Pure Three.js: no React, no DOM.
 */
import * as THREE from 'three';
import { PlacedAsset } from '../types';
import { buildDeviceModel, buildWhiteboardModel } from './deviceModels';

export interface ProceduralOptions {
  /** Highlight colours for the selected asset. */
  isSelected: boolean;
  /** 2D plan view hides some vertical detail (e.g. chair backs). */
  viewMode: '2D' | '3D';
  /**
   * Draw the CCTV ground-coverage sector and view cone. On in the editor; the icon
   * renderer turns it off so the camera itself is visible.
   */
  showCoverage?: boolean;
}

/** Add the procedural meshes for `asset` to `group` (group origin = asset origin). */
export function buildProceduralAssetMesh(
  asset: PlacedAsset,
  group: THREE.Group,
  { isSelected, viewMode, showCoverage = true }: ProceduralOptions
): void {

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

      // Floating red Wi-Fi symbol (three arcs and a dot) marks the AP in plan and 3D.
      const wifiMat = new THREE.MeshBasicMaterial({
        color: '#ef4444',
        side: THREE.DoubleSide
      });
      const glyph = new THREE.Group();
      for (const r of [0.1, 0.18, 0.26]) {
        const arc = new THREE.Mesh(new THREE.TorusGeometry(r, 0.022, 6, 20, Math.PI / 2), wifiMat);
        arc.rotation.z = Math.PI / 4; // centre the quarter-arc on +Y so it opens upward
        glyph.add(arc);
      }
      const wifiSphere = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10), wifiMat);
      glyph.add(wifiSphere);
      glyph.position.y = 0.16;
      glyph.rotation.x = -Math.PI / 6;
      group.add(glyph);
      break;
    }

    // Wall / floor devices: hand-built models in deviceModels.ts.
    case 'dp':
    case 'tp':
    case 'hdmi_port':
    case 'projector_port':
    case 'door_access':
    case 'intercom':
    case 'power_outlet':
      buildDeviceModel(asset, group);
      break;

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

      if (showCoverage) {
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
      }
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

    case 'whiteboard':
      buildWhiteboardModel(group);
      break;

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
