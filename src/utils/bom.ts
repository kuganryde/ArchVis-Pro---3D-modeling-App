/**
 * Bill-of-materials: aggregate placed assets into costed procurement line items.
 * Unit cost comes from an asset's explicit `specs.Cost` when present, otherwise
 * from the seed catalogue (marked as "estimated").
 */
import { PlacedAsset } from '../types';
import { catalogFor } from '../data/assetCatalog';

export interface BomLine {
  type: string;
  item: string;
  manufacturer: string;
  category: string;
  quantity: number;
  unitCost: number;
  lineTotal: number;
  estimated: boolean; // unit cost came from the catalogue, not the asset specs
}

export interface Bom {
  lines: BomLine[];
  grandTotal: number;
  itemCount: number; // total units
  estimatedCount: number; // units priced from the catalogue
  currency: string;
}

/** Parse a cost string like "$2,400.00" → 2400. Returns null when not parseable. */
export function parseCost(raw: unknown): number | null {
  if (raw == null) return null;
  const n = Number(String(raw).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

const specVal = (specs: Record<string, string> | undefined, ...keys: string[]): string | undefined => {
  if (!specs) return undefined;
  for (const k of keys) if (specs[k]) return specs[k];
  return undefined;
};

/** Build the bill of materials for a set of placed assets. */
export function computeBom(assets: PlacedAsset[], currency = 'USD'): Bom {
  const groups = new Map<string, BomLine>();
  let grandTotal = 0;
  let itemCount = 0;
  let estimatedCount = 0;

  for (const asset of assets) {
    const cat = catalogFor(asset.type);
    const explicit = parseCost(asset.specs?.Cost ?? asset.specs?.cost);
    const estimated = explicit == null;
    const unitCost = explicit ?? cat.unitCost;

    const manufacturer = specVal(asset.specs, 'Manufacturer', 'manufacturer') || cat.manufacturer;
    const model = specVal(asset.specs, 'Model', 'model') || cat.model;
    const item = model && model !== '—' ? `${cat.label} (${model})` : cat.label;

    const key = `${asset.type}|${item}|${manufacturer}|${unitCost}`;
    const existing = groups.get(key);
    if (existing) {
      existing.quantity += 1;
      existing.lineTotal += unitCost;
    } else {
      groups.set(key, {
        type: asset.type,
        item,
        manufacturer,
        category: asset.category,
        quantity: 1,
        unitCost,
        lineTotal: unitCost,
        estimated,
      });
    }

    grandTotal += unitCost;
    itemCount += 1;
    if (estimated) estimatedCount += 1;
  }

  const lines = Array.from(groups.values()).sort(
    (a, b) => a.category.localeCompare(b.category) || a.item.localeCompare(b.item)
  );

  return { lines, grandTotal, itemCount, estimatedCount, currency };
}

/** Format a number as a currency string. */
export function formatMoney(n: number, currency = 'USD'): string {
  try {
    return n.toLocaleString('en-US', { style: 'currency', currency });
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

/** Serialize a BOM to CSV text. */
export function bomToCsv(bom: Bom): string {
  const rows: string[] = [];
  rows.push('Item,Manufacturer,Category,Quantity,Unit Cost,Line Total,Priced From');
  for (const l of bom.lines) {
    rows.push(
      [
        `"${l.item}"`,
        `"${l.manufacturer}"`,
        l.category,
        l.quantity,
        l.unitCost.toFixed(2),
        l.lineTotal.toFixed(2),
        l.estimated ? 'Catalogue (est.)' : 'Asset spec',
      ].join(',')
    );
  }
  rows.push(`"GRAND TOTAL",,,${bom.itemCount},,${bom.grandTotal.toFixed(2)},`);
  return rows.join('\r\n');
}
