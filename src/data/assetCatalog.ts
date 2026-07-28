/**
 * Seed procurement catalogue: default manufacturer / model / unit cost per asset
 * type. Used by the bill-of-materials when a placed asset has no explicit `Cost`
 * in its specs. Values are indicative list prices (USD) — adjust to your vendors.
 */
import { AssetType } from '../types';

export interface CatalogEntry {
  label: string;
  manufacturer: string;
  model: string;
  unitCost: number; // USD
}

export const ASSET_CATALOG: Partial<Record<AssetType, CatalogEntry>> = {
  // Low-current / infrastructure
  ap: { label: 'Wi-Fi Access Point', manufacturer: 'Aruba', model: 'AP-535', unitCost: 450 },
  dp: { label: 'Data / LAN Point', manufacturer: 'Generic', model: 'Cat6 RJ45', unitCost: 35 },
  tp: { label: 'Telephone Point', manufacturer: 'Generic', model: 'VoIP Faceplate', unitCost: 30 },
  cctv: { label: 'CCTV Camera', manufacturer: 'Hikvision', model: 'IP Dome', unitCost: 220 },
  door_access: { label: 'Door Access Reader', manufacturer: 'Suprema', model: 'W2', unitCost: 380 },
  intercom: { label: 'Intercom Station', manufacturer: '2N', model: 'IP Station', unitCost: 550 },
  power_outlet: { label: 'Power Outlet (UPS)', manufacturer: 'Generic', model: '13A Twin', unitCost: 45 },
  hdmi_port: { label: 'HDMI Port', manufacturer: 'Generic', model: 'HDMI 2.1 Plate', unitCost: 60 },
  projector_port: { label: 'Projector Port', manufacturer: 'Generic', model: 'VGA/Serial Plate', unitCost: 90 },

  // Furniture
  desk_single: { label: 'Single Desk', manufacturer: 'Standard BIM', model: 'Oak 1.2m', unitCost: 320 },
  desk_cluster_4: { label: '4-Pax Desk Cluster', manufacturer: 'Standard BIM', model: 'Modular-4', unitCost: 1200 },
  desk_cluster_6: { label: '6-Pax Desk Cluster', manufacturer: 'Standard BIM', model: 'Bench-6', unitCost: 1700 },
  conference_table: { label: 'Conference Table', manufacturer: 'Steelcase', model: 'Boardroom', unitCost: 1800 },
  chair_office: { label: 'Office Chair', manufacturer: 'Standard BIM', model: 'Mesh Swivel', unitCost: 180 },
  chair_lounge: { label: 'Lounge Armchair', manufacturer: 'Standard BIM', model: 'Plush', unitCost: 420 },
  reception_desk: { label: 'Reception Counter', manufacturer: 'Standard BIM', model: 'Marble', unitCost: 2200 },
  cabinet: { label: 'Storage Cabinet', manufacturer: 'Standard BIM', model: 'Steel', unitCost: 260 },
  whiteboard: { label: 'Interactive Whiteboard', manufacturer: 'Standard BIM', model: '86" 4K', unitCost: 900 },

  // Architectural (usually excluded from procurement; priced at 0)
  wall_straight: { label: 'Wall Partition', manufacturer: '—', model: '—', unitCost: 0 },
  glass_divider: { label: 'Glass Divider', manufacturer: '—', model: '—', unitCost: 0 },
  door_single: { label: 'Door', manufacturer: '—', model: '—', unitCost: 0 },
  plant_pot: { label: 'Plant Pot', manufacturer: 'Generic', model: 'Ceramic', unitCost: 40 },
};

/** Catalogue lookup with a safe fallback. */
export function catalogFor(type: AssetType): CatalogEntry {
  return (
    ASSET_CATALOG[type] || {
      label: type.replace(/_/g, ' '),
      manufacturer: '—',
      model: '—',
      unitCost: 0,
    }
  );
}
