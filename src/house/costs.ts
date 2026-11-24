import { HOUSE_ASSET_SPECS } from './assetSpecs';

/** Indicative unit cost of every asset type the house designer places (USD). */
export const ASSET_COSTS: Record<string, number> = {
  ...Object.fromEntries(Object.entries(HOUSE_ASSET_SPECS).map(([k, v]) => [k, v.cost])),
  desk_single: 320, chair_office: 180, chair_lounge: 420, plant_pot: 40, lcd_display: 1200, cabinet: 260,
};
