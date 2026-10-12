/**
 * Dev tool: renders isolated assets as true-isometric PNG icons (orthographic camera,
 * 45° azimuth, 35.264° elevation) using the SAME models the editor uses. Driven by
 * scripts/render-iso.mjs through window.__iso; not part of the production bundle.
 */
import * as THREE from 'three';
import type { AssetType, PlacedAsset } from '../../src/types';
import { buildProceduralAssetMesh } from '../../src/three/proceduralAssets';
import { MODEL_SPECS, hasModel, instantiateModel, loadModelTemplate, preloadModels } from '../../src/three/modelLibrary';
import { isInfrastructureType } from '../../src/utils/geometry';

const canvas = document.getElementById('iso-canvas') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setClearColor(0x000000, 0);

/** Default scale per type, matching how the app places them (desk clusters / tables are scaled). */
const SAMPLE_SCALE: Partial<Record<AssetType, { x: number; y: number; z: number }>> = {
  desk_cluster_4: { x: 1.8, y: 0.75, z: 1.4 },
  desk_cluster_6: { x: 2.2, y: 0.75, z: 1.4 },
  conference_table: { x: 3.2, y: 0.75, z: 1.4 },
};

const sampleAsset = (type: AssetType): PlacedAsset => ({
  id: `iso_${type}`,
  type,
  category: isInfrastructureType(type) ? 'infrastructure' : 'furniture',
  name: type,
  position: { x: 0, y: 0, z: 0 },
  rotationY: 0,
  scale: SAMPLE_SCALE[type] ?? { x: 1, y: 1, z: 1 },
});

/** The object an icon shows for a type: its library model if loaded, else the procedural one. */
function objectFor(type: AssetType, source: 'auto' | 'procedural' = 'auto'): { object: THREE.Object3D; source: string } {
  const asset = sampleAsset(type);
  if (source === 'auto' && hasModel(type)) {
    const m = instantiateModel(asset);
    if (m) return { object: m, source: 'KayKit Furniture Bits · CC0' };
  }
  const g = new THREE.Group();
  buildProceduralAssetMesh(asset, g, { isSelected: false, viewMode: '3D', showCoverage: false });
  return { object: g, source: 'built for this project' };
}

/** Render an object isometrically, auto-framed, and return a PNG data URL. */
function renderIso(object: THREE.Object3D, size = 320): string {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0xaab6c4, 1.05));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(-4, 7, 5);
  scene.add(sun);
  scene.add(object);

  const box = new THREE.Box3().setFromObject(object);
  const centre = box.getCenter(new THREE.Vector3());
  const dim = box.getSize(new THREE.Vector3());

  // Soft contact shadow so the object reads as standing on a surface.
  const shadowR = Math.max(dim.x, dim.z) * 0.62;
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(shadowR, 40),
    new THREE.MeshBasicMaterial({ color: 0x0f172a, transparent: true, opacity: 0.16, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(centre.x, Math.max(box.min.y, 0) + 0.001, centre.z);
  shadow.scale.set(1, (dim.z + 0.01) / (dim.x + 0.01) > 0 ? Math.min(1.2, Math.max(0.55, dim.z / Math.max(dim.x, 1e-3))) : 1, 1);
  scene.add(shadow);

  // True isometric: camera along (1,1,1), orthographic.
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 1000);
  camera.position.copy(centre).add(new THREE.Vector3(1, 1, 1).normalize().multiplyScalar(50));
  camera.lookAt(centre);
  camera.updateMatrixWorld(true);

  // Fit the projected bounding box (all 8 corners) with a margin.
  const inv = camera.matrixWorldInverse;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const p = new THREE.Vector3(x, y, z).applyMatrix4(inv);
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const half = (Math.max(maxX - minX, maxY - minY) / 2) * 1.14;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  camera.left = cx - half; camera.right = cx + half; camera.top = cy + half; camera.bottom = cy - half;
  camera.updateProjectionMatrix();

  renderer.setSize(size, size, false);
  renderer.render(scene, camera);
  const url = canvas.toDataURL('image/png');
  scene.remove(object);
  return url;
}

(window as any).__iso = {
  ready: preloadModels(),
  specs: MODEL_SPECS,
  /** Icon for an asset type (library model when registered, else procedural). */
  render(type: AssetType, source: 'auto' | 'procedural' = 'auto') {
    const { object, source: used } = objectFor(type, source);
    return { png: renderIso(object), source: used };
  },
  /**
   * QA: the procedural stand-in and the library model side by side at the same
   * rotation, to check that orientation, scale and floor contact agree.
   */
  compare(type: AssetType) {
    const row = new THREE.Group();
    const proc = new THREE.Group();
    buildProceduralAssetMesh(sampleAsset(type), proc, { isSelected: false, viewMode: '3D', showCoverage: false });
    proc.position.x = -1.1;
    const lib = instantiateModel(sampleAsset(type));
    if (lib) lib.position.x = 1.1;
    row.add(proc);
    if (lib) row.add(lib);
    // axis marker: a thin red bar along +X so the "front" direction is visible
    const axis = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.01, 0.02), new THREE.MeshBasicMaterial({ color: 0xdc2626 }));
    axis.position.set(0, 0.005, 1.1);
    row.add(axis);
    return { png: renderIso(row, 480), hasLibrary: Boolean(lib) };
  },
  /** Render a raw library file as-is (for choosing which model to use). */
  async renderFile(file: string) {
    const tpl = await loadModelTemplate(file);
    return { png: renderIso(tpl.object.clone(true)), size: tpl.size.toArray().map((n) => +n.toFixed(2)) };
  },
};
