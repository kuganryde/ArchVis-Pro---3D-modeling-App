/**
 * Hand-built models for wall / floor low-current devices. No accessible free 3D
 * library offers network or AV hardware, so these are original, low-poly models
 * made for this project (licensed with the repo, no third-party attribution).
 *
 * Conventions (unchanged from the earlier stand-ins so layouts look the same):
 *  - local origin at the bottom-centre of the device, front face toward +Z;
 *  - colour identifies the system (blue data, teal voice, purple HDMI, …) and matches
 *    the cabling-overlay legend;
 *  - footprints match getAssetSize().
 *
 * Geometry and materials are cached and shared: the editor rebuilds every asset on
 * each edit, so allocating fresh buffers per device per rebuild would be wasteful.
 * (Conflict highlighting clones materials before changing them, so sharing is safe.)
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { PlacedAsset } from '../types';

const geometries = new Map<string, THREE.BufferGeometry>();
const materials = new Map<string, THREE.Material>();

const geo = (key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry => {
  let g = geometries.get(key);
  if (!g) {
    g = make();
    geometries.set(key, g);
  }
  return g;
};

interface MatOpts {
  roughness?: number;
  metalness?: number;
  emissive?: string;
  emissiveIntensity?: number;
}
const mat = (color: string, o: MatOpts = {}): THREE.MeshStandardMaterial => {
  const key = `${color}|${o.roughness ?? 0.5}|${o.metalness ?? 0.05}|${o.emissive ?? ''}|${o.emissiveIntensity ?? 1}`;
  let m = materials.get(key) as THREE.MeshStandardMaterial | undefined;
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: o.roughness ?? 0.5,
      metalness: o.metalness ?? 0.05,
      ...(o.emissive ? { emissive: new THREE.Color(o.emissive), emissiveIntensity: o.emissiveIntensity ?? 1 } : {}),
    });
    materials.set(key, m);
  }
  return m;
};

const GOLD = () => mat('#fbbf24', { metalness: 0.85, roughness: 0.25 });
const INK = () => mat('#0b1220', { roughness: 0.7 });

/** Add a (rounded) box centred at (x, y, z). */
function box(
  group: THREE.Group,
  size: [number, number, number],
  pos: [number, number, number],
  material: THREE.Material,
  radius = 0
): THREE.Mesh {
  const [w, h, d] = size;
  const g = geo(`box|${w}|${h}|${d}|${radius}`, () =>
    radius > 0 ? new RoundedBoxGeometry(w, h, d, 3, radius) : new THREE.BoxGeometry(w, h, d)
  );
  const m = new THREE.Mesh(g, material);
  m.position.set(...pos);
  m.castShadow = true;
  group.add(m);
  return m;
}

/** Extruded flat shape (for connector outlines), front face at z = zFront. */
function shape(
  group: THREE.Group,
  key: string,
  pts: Array<[number, number]>,
  depth: number,
  pos: [number, number, number],
  material: THREE.Material
): THREE.Mesh {
  const g = geo(`shape|${key}|${depth}`, () => {
    const s = new THREE.Shape();
    pts.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
    s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  });
  const m = new THREE.Mesh(g, material);
  m.position.set(...pos);
  group.add(m);
  return m;
}

/** Device types handled here. */
export const DEVICE_TYPES = ['dp', 'tp', 'hdmi_port', 'projector_port', 'door_access', 'intercom', 'power_outlet'] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];
export const isDeviceModelType = (t: string): t is DeviceType => (DEVICE_TYPES as readonly string[]).includes(t);

/** Build the model for a wall/floor device into `group`. */
export function buildDeviceModel(asset: PlacedAsset, group: THREE.Group): void {
  switch (asset.type as DeviceType) {
    case 'dp': {
      // Data point: slate faceplate, RJ45 jack with gold contacts, blue system-colour bar.
      box(group, [0.36, 0.36, 0.06], [0, 0.18, 0], mat('#1e293b'), 0.035);
      box(group, [0.22, 0.026, 0.066], [0, 0.305, 0.002], mat('#3b82f6', { emissive: '#1d4ed8', emissiveIntensity: 0.9 }), 0.01);
      box(group, [0.2, 0.17, 0.07], [0, 0.155, 0.012], INK(), 0.012);
      box(group, [0.15, 0.11, 0.074], [0, 0.158, 0.014], mat('#020617', { roughness: 0.9 }));
      box(group, [0.11, 0.014, 0.078], [0, 0.118, 0.016], GOLD());
      break;
    }

    case 'tp': {
      // Telephone point: teal faceplate, RJ11 jack, white handset glyph.
      box(group, [0.34, 0.34, 0.06], [0, 0.17, 0], mat('#0f766e'), 0.035);
      box(group, [0.13, 0.12, 0.07], [0, 0.12, 0.012], INK(), 0.01);
      box(group, [0.09, 0.075, 0.074], [0, 0.122, 0.014], mat('#020617', { roughness: 0.9 }));
      box(group, [0.06, 0.012, 0.078], [0, 0.095, 0.016], GOLD());
      // handset: bar with two earpiece caps
      const white = mat('#f8fafc', { roughness: 0.35 });
      box(group, [0.16, 0.034, 0.024], [0, 0.265, 0.036], white, 0.012);
      for (const x of [-0.085, 0.085]) {
        const cap = new THREE.Mesh(geo('tp-cap', () => new THREE.SphereGeometry(0.036, 12, 10)), white);
        cap.position.set(x, 0.265, 0.036);
        cap.scale.set(1, 1, 0.7);
        group.add(cap);
      }
      break;
    }

    case 'hdmi_port': {
      // HDMI: violet faceplate, black type-A port (chamfered underside) with gold contacts.
      box(group, [0.36, 0.36, 0.06], [0, 0.18, 0], mat('#7c3aed', { roughness: 0.4 }), 0.035);
      const w = 0.1, h = 0.04, c = 0.016;
      const outline: Array<[number, number]> = [
        [-w, h], [w, h], [w, -h + c], [w - c * 1.4, -h], [-w + c * 1.4, -h], [-w, -h + c],
      ];
      shape(group, 'hdmi', outline, 0.03, [0, 0.18, 0.03], mat('#0b0b0f', { roughness: 0.8 }));
      box(group, [0.14, 0.014, 0.034], [0, 0.18, 0.046], GOLD());
      break;
    }

    case 'projector_port': {
      // Projector plate: cyan VGA (D-sub) with pin rows, orange round control jack.
      box(group, [0.42, 0.3, 0.06], [0, 0.15, 0], mat('#334155', { roughness: 0.6 }), 0.03);
      const dsub: Array<[number, number]> = [[-0.085, 0.04], [0.085, 0.04], [0.065, -0.04], [-0.065, -0.04]];
      shape(group, 'dsub', dsub, 0.03, [0.07, 0.15, 0.03], mat('#06b6d4', { roughness: 0.3, metalness: 0.4 }));
      const inner: Array<[number, number]> = [[-0.07, 0.027], [0.07, 0.027], [0.054, -0.027], [-0.054, -0.027]];
      shape(group, 'dsub-in', inner, 0.032, [0.07, 0.15, 0.03], INK());
      for (let i = 0; i < 5; i++) box(group, [0.01, 0.01, 0.034], [0.07 - 0.052 + i * 0.026, 0.162, 0.03], GOLD());
      for (let i = 0; i < 5; i++) box(group, [0.01, 0.01, 0.034], [0.07 - 0.052 + i * 0.026, 0.138, 0.03], GOLD());
      const jackRing = new THREE.Mesh(geo('proj-ring', () => new THREE.CylinderGeometry(0.052, 0.052, 0.034, 20)), mat('#ea580c', { roughness: 0.3 }));
      jackRing.rotation.x = Math.PI / 2;
      jackRing.position.set(-0.13, 0.15, 0.04);
      group.add(jackRing);
      const jackHole = new THREE.Mesh(geo('proj-hole', () => new THREE.CylinderGeometry(0.025, 0.025, 0.04, 16)), INK());
      jackHole.rotation.x = Math.PI / 2;
      jackHole.position.set(-0.13, 0.15, 0.042);
      group.add(jackHole);
      break;
    }

    case 'door_access': {
      // Card reader: black casing, green status bar, card-wave arcs, keypad.
      box(group, [0.13, 0.36, 0.06], [0, 0.18, 0], mat('#171717', { roughness: 0.4 }), 0.02);
      box(group, [0.09, 0.022, 0.066], [0, 0.325, 0.002], mat('#22c55e', { emissive: '#16a34a', emissiveIntensity: 1 }), 0.008);
      for (const r of [0.022, 0.038]) {
        const arc = new THREE.Mesh(
          geo(`door-arc-${r}`, () => new THREE.TorusGeometry(r, 0.0045, 6, 14, Math.PI)),
          mat('#e2e8f0', { roughness: 0.3 })
        );
        arc.position.set(0, 0.255, 0.032);
        group.add(arc);
      }
      const key = mat('#64748b', { roughness: 0.5 });
      for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
        box(group, [0.026, 0.026, 0.012], [(col - 1) * 0.034, 0.12 - row * 0.034 + 0.034, 0.034], key, 0.006);
      }
      break;
    }

    case 'intercom': {
      // Intercom: brown face, cyan screen, speaker grille, call button.
      box(group, [0.22, 0.32, 0.06], [0, 0.16, 0], mat('#451a03', { roughness: 0.5 }), 0.025);
      box(group, [0.16, 0.11, 0.066], [0, 0.23, 0.004], mat('#06b6d4', { emissive: '#0891b2', emissiveIntensity: 0.9 }), 0.012);
      for (let i = 0; i < 4; i++) box(group, [0.12, 0.008, 0.066], [0, 0.15 - i * 0.02, 0.004], mat('#1c1917', { roughness: 0.8 }));
      const btn = new THREE.Mesh(geo('intercom-btn', () => new THREE.CylinderGeometry(0.03, 0.03, 0.02, 20)), mat('#22c55e', { emissive: '#16a34a', emissiveIntensity: 0.8 }));
      btn.rotation.x = Math.PI / 2;
      btn.position.set(0, 0.05, 0.04);
      group.add(btn);
      break;
    }

    case 'power_outlet': {
      // Floor power box: blue marker frame, white lid, twin sockets with earth + live/neutral slots.
      box(group, [0.6, 0.05, 0.6], [0, 0.025, 0], mat('#4f46e5', { emissive: '#1d4ed8', emissiveIntensity: 0.6 }), 0.02);
      box(group, [0.44, 0.04, 0.44], [0, 0.065, 0], mat('#f8fafc', { roughness: 0.6 }), 0.03);
      for (const x of [-0.1, 0.1]) {
        box(group, [0.14, 0.012, 0.14], [x, 0.088, 0], mat('#0f172a', { roughness: 0.8 }), 0.02);
        box(group, [0.012, 0.014, 0.04], [x, 0.092, -0.025], GOLD());
        box(group, [0.04, 0.014, 0.012], [x - 0.03, 0.092, 0.03], GOLD());
        box(group, [0.04, 0.014, 0.012], [x + 0.03, 0.092, 0.03], GOLD());
      }
      break;
    }
  }
}

/**
 * Mobile whiteboard: framed board with a marker tray (and markers), two posts and
 * wheeled feet. The board is thin along X and wide along Z, as before; 1.6 m tall.
 */
export function buildWhiteboardModel(group: THREE.Group): void {
  const frame = mat('#475569', { roughness: 0.5, metalness: 0.3 });
  box(group, [0.05, 1.0, 1.24], [0, 1.1, 0], frame, 0.012);
  box(group, [0.022, 0.9, 1.12], [0.02, 1.1, 0], mat('#f8fafc', { roughness: 0.15 }), 0.006);
  // marker tray + markers
  box(group, [0.1, 0.03, 0.9], [0.05, 0.585, 0], frame, 0.01);
  [['#2563eb', -0.2], ['#dc2626', 0], ['#16a34a', 0.2]].forEach(([c, z]) => {
    const marker = new THREE.Mesh(geo('wb-marker', () => new THREE.CylinderGeometry(0.014, 0.014, 0.12, 8)), mat(c as string, { roughness: 0.4 }));
    marker.rotation.x = Math.PI / 2;
    marker.position.set(0.06, 0.612, z as number);
    group.add(marker);
  });
  // posts and wheeled T-feet
  for (const z of [-0.5, 0.5]) {
    box(group, [0.05, 0.62, 0.05], [0, 0.31 + 0.06, z], frame, 0.01);
    box(group, [0.5, 0.04, 0.06], [0, 0.07, z], frame, 0.012);
    for (const x of [-0.2, 0.2]) {
      const wheel = new THREE.Mesh(geo('wb-wheel', () => new THREE.SphereGeometry(0.032, 10, 8)), mat('#0f172a', { roughness: 0.7 }));
      wheel.position.set(x, 0.032, z);
      group.add(wheel);
    }
  }
}
