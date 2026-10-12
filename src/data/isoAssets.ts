/**
 * Asset types that have an isometric icon (public/iso/<type>.png). Single source of
 * truth for the icon renderer (scripts/render-iso.mjs) and the tests.
 */
import type { AssetType } from '../types';

export const ISO_ASSET_TYPES: AssetType[] = [
  // Low-current / infrastructure
  'ap', 'dp', 'tp', 'power_outlet', 'hdmi_port', 'projector_port', 'cctv', 'door_access', 'intercom',
  // Furniture
  'desk_single', 'desk_cluster_4', 'desk_cluster_6', 'conference_table', 'chair_office', 'chair_lounge',
  'reception_desk', 'whiteboard', 'cabinet', 'plant_pot',
];
