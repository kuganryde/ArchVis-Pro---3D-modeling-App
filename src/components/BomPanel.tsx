/**
 * Bill-of-materials panel for the Inventory tab: a costed, grouped summary of
 * every placed asset, with a CSV export.
 */
import React, { useMemo } from 'react';
import { Download, Receipt } from 'lucide-react';
import { PlacedAsset } from '../types';
import { computeBom, formatMoney, bomToCsv } from '../utils/bom';
import { showToast } from '../utils/toast';

export default function BomPanel({ assets }: { assets: PlacedAsset[] }) {
  const bom = useMemo(() => computeBom(assets), [assets]);

  const exportCsv = () => {
    const blob = new Blob([bomToCsv(bom)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Bill_of_Materials_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Bill of materials exported (CSV).');
  };

  return (
    <div className="rounded-xl border border-slate-200/70 bg-white shadow-3xs overflow-hidden">
      <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
        <div className="flex items-center gap-1.5">
          <Receipt className="w-4 h-4 text-violet-600" />
          <span className="text-xs font-bold text-slate-800">Bill of Materials</span>
        </div>
        <button
          onClick={exportCsv}
          disabled={bom.lines.length === 0}
          className="text-[10px] font-bold text-violet-600 hover:text-violet-700 disabled:text-slate-300 flex items-center gap-1"
        >
          <Download className="w-3 h-3" /> CSV
        </button>
      </div>

      {bom.lines.length === 0 ? (
        <div className="p-4 text-center text-[11px] text-slate-400">
          Place assets to build a costed bill of materials.
        </div>
      ) : (
        <>
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-white">
                <tr className="text-slate-400 font-mono text-[9.5px] uppercase tracking-wider border-b border-slate-100">
                  <th className="text-left font-bold px-3 py-1.5">Item</th>
                  <th className="text-right font-bold px-1 py-1.5">Qty</th>
                  <th className="text-right font-bold px-1 py-1.5">Unit</th>
                  <th className="text-right font-bold px-3 py-1.5">Total</th>
                </tr>
              </thead>
              <tbody>
                {bom.lines.map((l, i) => (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/60">
                    <td className="px-3 py-1.5">
                      <div className="font-semibold text-slate-700 leading-tight">{l.item}</div>
                      <div className="text-[9.5px] text-slate-400">
                        {l.manufacturer}
                        {l.estimated && <span className="ml-1 text-amber-500">· est.</span>}
                      </div>
                    </td>
                    <td className="text-right px-1 py-1.5 font-mono text-slate-600">{l.quantity}</td>
                    <td className="text-right px-1 py-1.5 font-mono text-slate-500">{formatMoney(l.unitCost)}</td>
                    <td className="text-right px-3 py-1.5 font-mono font-semibold text-slate-800">
                      {formatMoney(l.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-3 py-2.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="text-[10px] text-slate-500 font-medium">
              {bom.itemCount} items
              {bom.estimatedCount > 0 && (
                <span className="text-amber-600"> · {bom.estimatedCount} est. priced</span>
              )}
            </span>
            <div className="text-right">
              <div className="text-[9px] text-slate-400 font-mono uppercase tracking-wider">Grand Total</div>
              <div className="text-sm font-extrabold text-slate-900">{formatMoney(bom.grandTotal)}</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
