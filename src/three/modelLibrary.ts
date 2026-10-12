/**
 * Library models: real 3D models from free (CC0) libraries that replace the
 * procedural stand-ins for the asset types that have a good match. Anything
 * without a registered model — or whose file fails to load — transparently keeps
 * its procedural model (see proceduralAssets.ts), so the editor never breaks.
 *
 * Models live in public/models/<library>/ as the library's ORIGINAL files, verified
 * against manifest.json (see scripts/models.mjs) and credited in CREDITS.md.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { AssetType, PlacedAsset } from '../types';
import { getAssetSize } from '../utils/geometry';

export interface ModelSpec {
  /** File name under public/models/kaykit/. */
  file: string;
  /**
   * 'stretch': scale X/Z to the asset's footprint and Y to `height` (tables, counters).
   * 'height': one uniform scale so the model is `height` tall (chairs, plants).
   */
  fit: 'stretch' | 'height';
  /** Real-world height in metres. */
  height: number;
  /** Rotation about Y (radians) turning the model's front to the app's +X convention. */
  yaw?: number;
}

/** Asset type -> library model. Types that are not listed use the procedural model. */
export const MODEL_SPECS: Partial<Record<AssetType, ModelSpec>> = {
  // Both chairs face +Z in the library; the app's convention is +X, hence the +90° yaw.
  chair_office: { file: 'chair_C.gltf', fit: 'height', height: 0.95, yaw: Math.PI / 2 },
  chair_lounge: { file: 'armchair_pillows.gltf', fit: 'height', height: 0.85, yaw: Math.PI / 2 },
  desk_single: { file: 'table_small.gltf', fit: 'stretch', height: 0.75 },
  desk_cluster_4: { file: 'table_medium.gltf', fit: 'stretch', height: 0.75 },
  desk_cluster_6: { file: 'table_medium_long.gltf', fit: 'stretch', height: 0.75 },
  conference_table: { file: 'table_medium_long.gltf', fit: 'stretch', height: 0.75 },
  reception_desk: { file: 'cabinet_medium.gltf', fit: 'stretch', height: 1.1 },
  // These two exist in the type catalogue but used to render as a grey placeholder cube.
  cabinet: { file: 'cabinet_medium.gltf', fit: 'stretch', height: 1.0 },
  plant_pot: { file: 'cactus_medium_A.gltf', fit: 'height', height: 0.8 },
  // Not listed (kept procedural): wall/ceiling devices (AP, CCTV, ports, intercom, door
  // reader) — no accessible free library offers network/AV hardware — and the whiteboard.
};

export const MODEL_BASE_PATH = 'models/kaykit/';

export interface Vec3 { x: number; y: number; z: number }

/**
 * Scale to apply to a model of size `model` so it fits `spec` for an asset with
 * the given footprint. Pure so it can be unit-tested without WebGL.
 */
export function computeModelFit(
  model: Vec3,
  spec: Pick<ModelSpec, 'fit' | 'height'>,
  footprint: { width: number; depth: number }
): Vec3 {
  const safe = (n: number) => (n > 1e-6 ? n : 1);
  const sy = spec.height / safe(model.y);
  if (spec.fit === 'height') return { x: sy, y: sy, z: sy };
  return { x: footprint.width / safe(model.x), y: sy, z: footprint.depth / safe(model.z) };
}

interface Template {
  object: THREE.Object3D; // origin at the model's XZ centre, resting on y = 0
  size: THREE.Vector3;
}

const templates = new Map<string, Template>();
let loading: Promise<void> | null = null;

const uniqueFiles = (): string[] =>
  Array.from(new Set(Object.values(MODEL_SPECS).map((s) => (s as ModelSpec).file)));

/** True once the model for this asset type has loaded and can be instantiated. */
export const hasModel = (type: AssetType): boolean => {
  const spec = MODEL_SPECS[type];
  return Boolean(spec && templates.has(spec.file));
};

/** Re-centre a loaded scene so its footprint is centred on the origin and it rests on y = 0. */
function normalise(scene: THREE.Object3D): Template {
  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  const wrapper = new THREE.Group();
  scene.position.set(-centre.x, -box.min.y, -centre.z);
  wrapper.add(scene);
  wrapper.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return { object: wrapper, size };
}

/** Load a single model file (exposed for the isometric renderer's contact sheets). */
export async function loadModelTemplate(file: string): Promise<Template> {
  const cached = templates.get(file);
  if (cached) return cached;
  const base = (import.meta as any).env?.BASE_URL ?? '/';
  // NOTE: do not enable THREE.Cache here. Textures are decoded as ImageBitmaps that three.js
  // closes after the GPU upload, so a cached bitmap shared by a second model is already dead
  // and the model renders black. The browser's HTTP cache de-duplicates the shared atlas.
  const gltf = await new GLTFLoader().loadAsync(`${base}${MODEL_BASE_PATH}${file}`);
  const tpl = normalise(gltf.scene);
  templates.set(file, tpl);
  return tpl;
}

/**
 * Load every registered model once. Never rejects: a model that fails to load is
 * logged and simply stays procedural.
 */
export function preloadModels(): Promise<void> {
  if (!loading) {
    loading = Promise.all(
      uniqueFiles().map((file) =>
        loadModelTemplate(file).catch((err) => {
          console.warn(`Model ${file} failed to load; using the procedural model instead.`, err);
        })
      )
    ).then(() => undefined);
  }
  return loading;
}

/**
 * A ready-to-add instance of the library model for `asset`, or null when this
 * type has no (loaded) model. The model rests on the floor (world y = 0) even
 * though the asset group sits at `asset.position.y`.
 */
export function instantiateModel(
  asset: PlacedAsset,
  { isSelected = false }: { isSelected?: boolean } = {}
): THREE.Object3D | null {
  const spec = MODEL_SPECS[asset.type];
  const tpl = spec ? templates.get(spec.file) : undefined;
  if (!spec || !tpl) return null;

  const model = tpl.object.clone(true);
  const s = computeModelFit(tpl.size, spec, getAssetSize(asset));
  model.scale.set(s.x, s.y, s.z);

  if (isSelected) {
    // Materials are shared between clones, so give this instance its own before tinting.
    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const tint = (m: THREE.Material) => {
        const c = m.clone() as THREE.MeshStandardMaterial;
        if ('emissive' in c) {
          c.emissive = new THREE.Color('#0891b2');
          c.emissiveIntensity = 0.55;
        }
        return c;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(tint) : tint(mesh.material);
    });
  }

  const root = new THREE.Group();
  root.rotation.y = spec.yaw ?? 0;
  root.add(model);
  const holder = new THREE.Group();
  holder.position.y = -asset.position.y; // rest on the floor, not at the asset's mounting height
  holder.add(root);
  return holder;
}
