/**
 * Floor switcher overlaid on the viewport: one tab per level, plus add /
 * rename / duplicate / delete and a building-wide summary. Purely presentational;
 * all state changes go through callbacks so they land in the undo history.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Building2, Copy, Layers, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { LevelSummary, MAX_LEVELS, MAX_LEVEL_NAME } from '../utils/levels';
import { formatMoney } from '../utils/bom';

export interface LevelBarProps {
  summaries: LevelSummary[];
  /** Estimated value per level id (from the bill of materials). */
  costByLevel: Record<string, number>;
  activeLevelId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  /** Stacked 3D building view. */
  stacked: boolean;
  canStack: boolean;
  /** Why stacking is unavailable (shown as a tooltip when disabled). */
  stackHint: string;
  onToggleStacked: () => void;
  cutAbove: boolean;
  onToggleCutAbove: () => void;
}

export default function LevelBar({
  summaries, costByLevel, activeLevelId, onSelect, onAdd, onRename, onDuplicate, onDelete,
  stacked, canStack, stackHint, onToggleStacked, cutAbove, onToggleCutAbove,
}: LevelBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState('');
  const [showSummary, setShowSummary] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const active = summaries.find((s) => s.level.id === activeLevelId) ?? summaries[0];
  const atMax = summaries.length >= MAX_LEVELS;
  const total = Object.values(costByLevel).reduce((a, b) => a + b, 0);

  // Close popovers on outside click / Escape.
  useEffect(() => {
    if (!menuOpen && !showSummary) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setShowSummary(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setMenuOpen(false); setShowSummary(false); }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen, showSummary]);

  const startRename = () => {
    setDraft(active.level.name);
    setRenaming(true);
    setMenuOpen(false);
  };
  const commitRename = () => {
    if (draft.trim()) onRename(active.level.id, draft);
    setRenaming(false);
  };

  // Left/Right arrows move between floors (WAI-ARIA tabs pattern).
  const onTabKey = (e: React.KeyboardEvent, index: number) => {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = summaries[(index + delta + summaries.length) % summaries.length];
    onSelect(next.level.id);
  };

  const menuItem =
    'w-full flex items-center gap-2 px-3 py-2 text-xs text-left text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div ref={rootRef} className="absolute left-4 bottom-4 z-20 flex flex-col items-start gap-2" id="level-bar">
      {showSummary && (
        <div
          role="dialog"
          aria-label="Building summary"
          className="bg-white/95 backdrop-blur border border-slate-200 rounded-xl shadow-lg p-3 min-w-[300px]"
        >
          <div className="text-[11px] font-bold text-slate-800 mb-2 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-cyan-600" aria-hidden="true" /> Building summary
          </div>
          <table className="w-full text-[11px] text-slate-600">
            <thead>
              <tr className="text-slate-400 text-left">
                <th className="font-medium pb-1">Floor</th>
                <th className="font-medium pb-1 text-right">Rooms</th>
                <th className="font-medium pb-1 text-right">Assets</th>
                <th className="font-medium pb-1 text-right">Area</th>
                <th className="font-medium pb-1 text-right">Est. value</th>
              </tr>
            </thead>
            <tbody>
              {[...summaries].reverse().map((s) => (
                <tr key={s.level.id} className={s.level.id === activeLevelId ? 'font-semibold text-slate-900' : ''}>
                  <td className="py-0.5">{s.level.name}</td>
                  <td className="py-0.5 text-right">{s.roomCount}</td>
                  <td className="py-0.5 text-right">{s.assetCount}</td>
                  <td className="py-0.5 text-right">{s.areaSqFt.toLocaleString()} sqft</td>
                  <td className="py-0.5 text-right">{formatMoney(costByLevel[s.level.id] ?? 0)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 font-bold text-slate-900">
                <td className="pt-1">Total</td>
                <td className="pt-1 text-right">{summaries.reduce((a, s) => a + s.roomCount, 0)}</td>
                <td className="pt-1 text-right">{summaries.reduce((a, s) => a + s.assetCount, 0)}</td>
                <td className="pt-1 text-right">{summaries.reduce((a, s) => a + s.areaSqFt, 0).toLocaleString()} sqft</td>
                <td className="pt-1 text-right">{formatMoney(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {menuOpen && (
        <div role="menu" aria-label={`${active.level.name} actions`} className="bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden w-44">
          <button role="menuitem" type="button" className={menuItem} onClick={startRename}>
            <Pencil className="w-3.5 h-3.5" aria-hidden="true" /> Rename floor
          </button>
          <button
            role="menuitem" type="button" className={menuItem} disabled={atMax}
            onClick={() => { onDuplicate(active.level.id); setMenuOpen(false); }}
          >
            <Copy className="w-3.5 h-3.5" aria-hidden="true" /> Duplicate floor
          </button>
          <button
            role="menuitem" type="button" className={`${menuItem} !text-rose-600`} disabled={summaries.length <= 1}
            onClick={() => { onDelete(active.level.id); setMenuOpen(false); }}
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> Delete floor
          </button>
        </div>
      )}

      <div className="flex items-center gap-1 bg-white/95 backdrop-blur border border-slate-200 rounded-xl shadow-md p-1">
        <Layers className="w-4 h-4 text-slate-400 mx-1.5" aria-hidden="true" />
        <div role="tablist" aria-label="Building floors" className="flex items-center gap-1 max-w-[46vw] overflow-x-auto">
          {summaries.map((s, i) => {
            const isActive = s.level.id === activeLevelId;
            return renaming && isActive ? (
              <input
                key={s.level.id}
                autoFocus
                aria-label="Floor name"
                value={draft}
                maxLength={MAX_LEVEL_NAME}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') setRenaming(false);
                }}
                className="px-2 py-1 text-xs rounded-lg border border-cyan-400 focus:outline-none w-28"
              />
            ) : (
              <button
                key={s.level.id}
                role="tab"
                type="button"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                title={`${s.level.name} · elevation ${s.level.elevation.toFixed(1)} m · ${s.assetCount} assets`}
                onClick={() => onSelect(s.level.id)}
                onDoubleClick={() => isActive && startRename()}
                onKeyDown={(e) => onTabKey(e, i)}
                className={`px-3 py-1.5 text-xs rounded-lg whitespace-nowrap transition-all ${
                  isActive ? 'bg-cyan-600 text-white font-bold shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {s.level.name}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onAdd}
          disabled={atMax}
          aria-label="Add floor"
          title="Add floor above"
          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => { setMenuOpen((o) => !o); setShowSummary(false); }}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={`Actions for ${active.level.name}`}
          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
        <div className="w-px h-5 bg-slate-200 mx-0.5" />
        <button
          type="button"
          onClick={onToggleStacked}
          disabled={!canStack}
          aria-pressed={stacked}
          title={canStack ? 'Show every floor stacked as a 3D building' : stackHint}
          className={`px-2 py-1.5 text-xs rounded-lg flex items-center gap-1 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
            stacked ? 'bg-cyan-50 text-cyan-700 font-bold border border-cyan-200' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-3.5 h-3.5" aria-hidden="true" /> Stack
        </button>
        {stacked && (
          <button
            type="button"
            onClick={onToggleCutAbove}
            aria-pressed={cutAbove}
            title="Hide the floors above the active one so you can look down into it"
            className={`px-2 py-1.5 text-xs rounded-lg transition-all ${
              cutAbove ? 'bg-cyan-50 text-cyan-700 font-bold border border-cyan-200' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Cut above
          </button>
        )}
        <button
          type="button"
          onClick={() => { setShowSummary((o) => !o); setMenuOpen(false); }}
          aria-expanded={showSummary}
          className="px-2 py-1.5 text-xs rounded-lg text-slate-600 hover:bg-slate-100 flex items-center gap-1"
        >
          <Building2 className="w-3.5 h-3.5" aria-hidden="true" /> Building
        </button>
      </div>
    </div>
  );
}
