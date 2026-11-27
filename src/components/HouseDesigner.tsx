/**
 * House Designer: describe a home (or set the controls), pick a style, compare
 * generated variations as floor plans, check the finish schedule, then apply the
 * chosen design to the workspace.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Home, Loader2, RefreshCw, Sparkles, X } from 'lucide-react';
import { DESIGN_STYLES } from '../house/styles';
import { FLOOR_FINISHES, WALL_FINISHES, getFinish } from '../house/finishes';
import { parseBrief } from '../house/parseBrief';
import { generateVariations } from '../house/generate';
import { DEFAULT_BRIEF, type GeneratedHouse, type HouseBrief } from '../house/types';
import { swatchDataUrl } from '../three/finishTextures';

interface Props {
  onClose: () => void;
  onApply: (house: GeneratedHouse) => void;
  /** True when the workspace already holds a design that applying will replace. */
  replacesDesign: boolean;
  ai: { available: boolean; read: (text: string) => Promise<{ brief: Partial<HouseBrief>; summary?: string } | null> };
}

const EXAMPLES = [
  'Modern 3 bedroom, 2 bathroom home with a study, large-format tiles and warm lighting',
  'Scandinavian two storey, 4 bedrooms, 3 bathrooms, oak floors and a blush floral wallpaper feature wall',
  'Art deco luxury villa, marble floors and bathrooms, gold geometric wallpaper in the living room',
  'Japandi single storey 2 bedroom with slatted timber walls and sage green paint',
];

const swatchCache = new Map<string, string>();
const swatch = (id: string | undefined, px = 28): string => {
  const f = getFinish(id);
  if (!f) return '';
  const key = `${id}:${px}`;
  let s = swatchCache.get(key);
  if (s === undefined) { s = swatchDataUrl(f, px); swatchCache.set(key, s); }
  return s;
};

function Swatch({ id, size = 28 }: { id?: string; size?: number }) {
  const f = getFinish(id);
  const url = swatch(id, size);
  return (
    <span
      className="inline-block rounded-md border border-slate-300 shrink-0"
      style={{ width: size, height: size, backgroundColor: f?.colors[0] ?? '#e5e7eb', backgroundImage: url ? `url(${url})` : 'none', backgroundSize: 'cover' }}
      aria-hidden="true"
    />
  );
}

/** Top-down plan of one floor: rooms in their floor colour, doors, windows and a label. */
function PlanPreview({ house, level }: { house: GeneratedHouse; level: number }) {
  const { design } = house;
  const levelId = design.levels[level]?.id;
  const rooms = design.rooms.filter((r) => r.levelId === levelId);
  const pad = 0.4;
  const w = house.meta.width + pad * 2, d = house.meta.depth + pad * 2;
  const x0 = -house.meta.width / 2 - pad, z0 = -house.meta.depth / 2 - pad;
  const sw = 0.12;
  return (
    <svg viewBox={`${x0} ${z0} ${w} ${d}`} className="w-full h-auto bg-slate-50 rounded-lg" role="img" aria-label={`Floor plan, ${design.levels[level]?.name}`}>
      {rooms.map((r) => {
        const rx = r.x - r.width / 2, rz = r.z - r.depth / 2;
        const finish = getFinish(r.floorFinishId);
        return (
          <g key={r.id}>
            <rect x={rx} y={rz} width={r.width} height={r.depth} fill={finish?.colors[0] ?? r.color} stroke="#334155" strokeWidth={sw} />
            {r.accentWall && (() => {
              const a = r.accentWall.wall, f = getFinish(r.accentWall.finishId);
              const common = { fill: f?.colors[1] ?? f?.colors[0] ?? '#94a3b8', opacity: 0.95 } as const;
              const t = 0.22;
              return a === 'n' ? <rect x={rx} y={rz} width={r.width} height={t} {...common} />
                : a === 's' ? <rect x={rx} y={rz + r.depth - t} width={r.width} height={t} {...common} />
                : a === 'w' ? <rect x={rx} y={rz} width={t} height={r.depth} {...common} />
                : <rect x={rx + r.width - t} y={rz} width={t} height={r.depth} {...common} />;
            })()}
            {(r.openings ?? []).map((o, i) => {
              const len = o.width;
              const horizontal = o.wall === 'n' || o.wall === 's';
              const cx = horizontal ? rx + o.offset : o.wall === 'w' ? rx : rx + r.width;
              const cz = horizontal ? (o.wall === 'n' ? rz : rz + r.depth) : rz + o.offset;
              const colour = o.kind === 'window' ? '#38bdf8' : o.kind === 'front_door' ? '#b45309' : '#f8fafc';
              return horizontal
                ? <rect key={i} x={cx - len / 2} y={cz - 0.1} width={len} height={0.2} fill={colour} />
                : <rect key={i} x={cx - 0.1} y={cz - len / 2} width={0.2} height={len} fill={colour} />;
            })}
            <text x={r.x} y={r.z} fontSize={Math.min(0.5, Math.min(r.width, r.depth) / 6.5)} textAnchor="middle" dominantBaseline="middle" fill="#0f172a" fontWeight={600} style={{ paintOrder: 'stroke', stroke: 'rgba(255,255,255,0.85)', strokeWidth: 0.12 }}>
              {Math.min(r.width, r.depth) < 2.2 ? r.name.replace(/ (Room|Bedroom)$/, '').replace('Entrance Hall', 'Entry').replace('Stair Landing', 'Landing') : r.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

const money = (n: number) => `$${n.toLocaleString('en-US')}`;

export default function HouseDesigner({ onClose, onApply, replacesDesign, ai }: Props) {
  const [request, setRequest] = useState(EXAMPLES[0]);
  const [bedrooms, setBedrooms] = useState(DEFAULT_BRIEF.bedrooms);
  const [bathrooms, setBathrooms] = useState(DEFAULT_BRIEF.bathrooms);
  const [floors, setFloors] = useState<1 | 2>(1);
  const [area, setArea] = useState('');
  const [study, setStudy] = useState(false);
  const [laundry, setLaundry] = useState(true);
  const [styleId, setStyleId] = useState('modern');
  const [lighting, setLighting] = useState<'style' | 'warm' | 'neutral' | 'cool'>('style');
  const [prefs, setPrefs] = useState<NonNullable<HouseBrief['prefs']>>({});
  const [round, setRound] = useState(0);
  const [selected, setSelected] = useState(0);
  const [floorTab, setFloorTab] = useState(0);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const uid = useRef(`h${Date.now().toString(36)}`).current;
  const dialogRef = useRef<HTMLDivElement>(null);

  const parsed = useMemo(() => parseBrief(request), [request]);

  // What the request says fills in the controls; the controls can then be adjusted by hand.
  const applyBrief = (b: Partial<HouseBrief>) => {
    if (b.bedrooms) setBedrooms(b.bedrooms);
    if (b.bathrooms) setBathrooms(b.bathrooms);
    if (b.floors) setFloors(b.floors);
    if (b.areaSqm !== undefined) setArea(String(Math.round(b.areaSqm)));
    if (b.study !== undefined) setStudy(b.study);
    if (b.laundry !== undefined) setLaundry(b.laundry);
    if (b.styleId) setStyleId(b.styleId);
    if (b.lighting) setLighting(b.lighting);
    if (b.prefs) setPrefs((p) => ({ ...p, ...b.prefs }));
    setRound(0); setSelected(0);
  };
  useEffect(() => { applyBrief(parsed.brief); setPrefs(parsed.brief.prefs ?? {}); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [parsed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    dialogRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const brief: Partial<HouseBrief> = useMemo(() => ({
    bedrooms, bathrooms: Math.min(bathrooms, 5), floors, styleId, study, laundry,
    areaSqm: Number(area) >= 40 && Number(area) <= 900 ? Number(area) : undefined,
    lighting: lighting === 'style' ? undefined : lighting,
    prefs: Object.keys(prefs).length ? prefs : undefined,
    variation: round * 3, request,
  }), [bedrooms, bathrooms, floors, styleId, study, laundry, area, lighting, prefs, round, request]);

  const variants = useMemo(() => generateVariations(brief, 3, uid), [brief, uid]);
  const house = variants[Math.min(selected, variants.length - 1)];
  useEffect(() => { setFloorTab(0); }, [selected, floors]);

  const readWithAi = async () => {
    setAiBusy(true); setAiNote(null);
    try {
      const out = await ai.read(request);
      if (out) { applyBrief(out.brief); setAiNote(out.summary ?? 'Read your request with AI.'); }
    } catch (e: any) {
      setAiNote(e?.message || 'AI could not read the request.');
    } finally { setAiBusy(false); }
  };

  const setPref = (key: keyof NonNullable<HouseBrief['prefs']>, value: string) =>
    setPrefs((p) => { const n = { ...p }; if (value) n[key] = value; else delete n[key]; return n; });

  const floorOptions = FLOOR_FINISHES, wallPaints = WALL_FINISHES.filter((f) => f.kind === 'paint'),
    papers = WALL_FINISHES.filter((f) => f.kind === 'wallpaper' || f.kind === 'panel' || f.kind === 'stone' || f.id === 'tile_zellige_green'),
    wetFloors = FLOOR_FINISHES.filter((f) => f.wet), wetWalls = WALL_FINISHES.filter((f) => f.wet);

  const Select = ({ id, label, value, options, onChange }: { id: string; label: string; value: string; options: typeof FLOOR_FINISHES; onChange: (v: string) => void }) => (
    <label htmlFor={id} className="flex items-center gap-2 text-xs text-slate-600">
      <Swatch id={value || undefined} size={26} />
      <span className="flex-1 min-w-0">
        <span className="block font-semibold text-slate-700">{label}</span>
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs">
          <option value="">Style default</option>
          {options.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </span>
    </label>
  );

  const Stepper = ({ id, label, value, min, max, onChange }: { id: string; label: string; value: number; min: number; max: number; onChange: (n: number) => void }) => (
    <div className="flex items-center justify-between gap-2">
      <label htmlFor={id} className="text-xs font-semibold text-slate-700">{label}</label>
      <div className="flex items-center gap-1">
        <button type="button" aria-label={`Fewer ${label.toLowerCase()}`} onClick={() => onChange(Math.max(min, value - 1))} className="w-7 h-7 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40" disabled={value <= min}>−</button>
        <output id={id} className="w-6 text-center text-sm font-bold tabular-nums">{value}</output>
        <button type="button" aria-label={`More ${label.toLowerCase()}`} onClick={() => onChange(Math.min(max, value + 1))} className="w-7 h-7 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40" disabled={value >= max}>+</button>
      </div>
    </div>
  );

  return (
    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-3 sm:p-4" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="house-designer-title" className="bg-white w-full max-w-6xl max-h-full rounded-2xl  border border-slate-200 flex flex-col overflow-hidden outline-none">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center"><Home className="w-5 h-5" /></div>
            <div>
              <h2 id="house-designer-title" className="text-base font-bold text-slate-900">House Designer</h2>
              <p className="text-xs text-slate-500">Describe the home. Get layouts, finishes, lighting and furniture.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close House Designer" className="p-2 rounded-lg hover:bg-slate-200 text-slate-500"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto grid lg:grid-cols-[360px_1fr] gap-0">
          {/* Brief */}
          <div className="p-5 space-y-4 border-b lg:border-b-0 lg:border-r border-slate-100">
            <div>
              <label htmlFor="house-request" className="text-xs font-semibold text-slate-700">Your request</label>
              <textarea id="house-request" value={request} onChange={(e) => setRequest(e.target.value)} rows={4} maxLength={1000} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 outline-none" placeholder="e.g. Modern 3 bedroom home with a study and marble bathrooms" />
              <div className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Examples">
                {EXAMPLES.map((ex, i) => (
                  <button key={i} type="button" onClick={() => setRequest(ex)} className="text-[11px] px-2 py-1 rounded-full border border-slate-200 bg-slate-50 text-slate-600 hover:bg-cyan-50 hover:border-cyan-200 text-left">
                    {ex.split(',')[0]}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5" aria-live="polite">
                {parsed.understood.map((u) => <span key={u} className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-100">{u}</span>)}
              </div>
              <button type="button" onClick={readWithAi} disabled={!ai.available || aiBusy || request.trim().length < 5} title={ai.available ? 'Let Gemini read the request for finishes and details the quick reader missed' : 'Set a Gemini key or sign in to use AI'} className="mt-2 av-btn av-btn-secondary av-btn-sm disabled:opacity-50 disabled:cursor-not-allowed">
                {aiBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>Read with AI</span>
              </button>
              {aiNote && <p className="mt-1.5 text-xs text-slate-600" role="status">{aiNote}</p>}
            </div>

            <div className="space-y-2.5 rounded-xl border border-slate-200 p-3">
              <Stepper id="hd-bed" label="Bedrooms" value={bedrooms} min={1} max={6} onChange={(n) => { setBedrooms(n); setSelected(0); }} />
              <Stepper id="hd-bath" label="Bathrooms" value={bathrooms} min={1} max={5} onChange={(n) => { setBathrooms(n); setSelected(0); }} />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-700" id="hd-storeys">Storeys</span>
                <div className="flex bg-slate-100 p-0.5 rounded-lg" role="group" aria-labelledby="hd-storeys">
                  {([1, 2] as const).map((n) => (
                    <button key={n} type="button" aria-pressed={floors === n} onClick={() => { setFloors(n); setSelected(0); }} className={`px-3 py-1 text-xs rounded-md font-semibold ${floors === n ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>{n === 1 ? 'Single' : 'Two'}</button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="hd-area" className="text-xs font-semibold text-slate-700">Total area (m²)</label>
                <input id="hd-area" inputMode="numeric" value={area} onChange={(e) => setArea(e.target.value.replace(/[^\d]/g, '').slice(0, 3))} placeholder="Auto" className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm text-right tabular-nums" />
              </div>
              <div className="flex gap-4 text-xs text-slate-700">
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={study} onChange={(e) => setStudy(e.target.checked)} /> Study</label>
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={laundry} onChange={(e) => setLaundry(e.target.checked)} /> Laundry</label>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-slate-700 mb-1.5">Style</h3>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Design style">
                {DESIGN_STYLES.map((s) => (
                  <button key={s.id} type="button" role="radio" aria-checked={styleId === s.id} onClick={() => { setStyleId(s.id); setSelected(0); }} title={s.blurb} className={`text-left rounded-lg border p-2 transition-colors ${styleId === s.id ? 'border-cyan-500 bg-cyan-50 ring-1 ring-cyan-300' : 'border-slate-200 hover:border-slate-300 bg-white'}`}>
                    <span className="flex gap-0.5 mb-1">{s.palette.swatches.map((c) => <span key={c} className="h-3 flex-1 first:rounded-l last:rounded-r" style={{ background: c }} />)}</span>
                    <span className="block text-xs font-bold text-slate-800">{s.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="hd-light" className="text-xs font-semibold text-slate-700">Light colour</label>
              <select id="hd-light" value={lighting} onChange={(e) => setLighting(e.target.value as typeof lighting)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs">
                <option value="style">Style default</option>
                <option value="warm">Warm (2700 K)</option>
                <option value="neutral">Neutral (3500 K)</option>
                <option value="cool">Cool daylight (4500 K)</option>
              </select>
            </div>

            <details className="rounded-xl border border-slate-200 p-3" open={Object.keys(prefs).length > 0}>
              <summary className="text-xs font-semibold text-slate-700 cursor-pointer">Tiles, floors and wallpaper</summary>
              <div className="mt-3 space-y-3">
                <Select id="pf-floor" label="Floors" value={prefs.floor ?? ''} options={floorOptions} onChange={(v) => setPref('floor', v)} />
                <Select id="pf-wall" label="Wall paint" value={prefs.wall ?? ''} options={wallPaints} onChange={(v) => setPref('wall', v)} />
                <Select id="pf-accent" label="Feature wall (wallpaper or panel)" value={prefs.accent ?? ''} options={papers} onChange={(v) => setPref('accent', v)} />
                <Select id="pf-wetfloor" label="Bathroom floor tile" value={prefs.wetFloor ?? ''} options={wetFloors} onChange={(v) => setPref('wetFloor', v)} />
                <Select id="pf-wetwall" label="Bathroom wall tile" value={prefs.wetWall ?? ''} options={wetWalls} onChange={(v) => setPref('wetWall', v)} />
              </div>
            </details>
          </div>

          {/* Variations and schedule */}
          <div className="p-5 space-y-4 min-w-0">
            {!house ? (
              <p className="text-sm text-slate-600">No layout fits these settings. Try fewer rooms or a larger area.</p>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-900">Variations</h3>
                  <button type="button" onClick={() => { setRound((r) => r + 1); setSelected(0); }} className="av-btn av-btn-secondary av-btn-sm"><RefreshCw className="w-3.5 h-3.5" /><span>Show more options</span></button>
                </div>
                <div className="grid sm:grid-cols-3 gap-3" role="radiogroup" aria-label="Design variations">
                  {variants.map((v, i) => (
                    <button key={`${round}-${i}`} type="button" role="radio" aria-checked={i === selected} onClick={() => setSelected(i)} className={`text-left rounded-xl border p-2 transition-colors ${i === selected ? 'border-cyan-500 ring-2 ring-cyan-200 bg-cyan-50/40' : 'border-slate-200 hover:border-slate-300'}`}>
                      <PlanPreview house={v} level={0} />
                      <span className="mt-1.5 flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800">Option {round * 3 + i + 1}</span>
                        <span className="text-slate-500 tabular-nums">{v.meta.totalAreaSqm} m² · {v.meta.width.toFixed(1)} × {v.meta.depth.toFixed(1)} m</span>
                      </span>
                      <span className="mt-1 flex gap-0.5">{(Array.from(new Set(v.design.rooms.map((r) => r.floorFinishId))) as Array<string | undefined>).slice(0, 5).map((id, k) => <span key={`${id}${k}`}><Swatch id={id} size={18} /></span>)}</span>
                    </button>
                  ))}
                </div>

                {house.meta.floors === 2 && (
                  <div className="flex gap-1" role="tablist" aria-label="Floor plans">
                    {house.design.levels.map((l, i) => (
                      <button key={l.id} type="button" role="tab" aria-selected={floorTab === i} onClick={() => setFloorTab(i)} className={`px-3 py-1 text-xs font-semibold rounded-md border ${floorTab === i ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}>{l.name}</button>
                    ))}
                  </div>
                )}
                <div className="grid md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-4 items-start">
                  <div>
                    <PlanPreview house={house} level={floorTab} />
                    <p className="mt-1.5 text-[11px] text-slate-500">Blue = windows, brown = front door, white gaps = doors and archways, coloured edge = feature wall.</p>
                  </div>
                  <div className="space-y-2">
                    <dl className="grid grid-cols-2 gap-2 text-xs">
                      {[['Style', house.meta.styleName], ['Area', `${house.meta.totalAreaSqm} m²`], ['Bedrooms', String(house.meta.bedrooms)], ['Bathrooms', String(house.meta.bathrooms)], ['Light', `${house.meta.lighting.kelvin} K · ${house.meta.lighting.fixtures}`], ['Fixtures', `${house.meta.lightCount} lights`]].map(([k, v]) => (
                        <div key={k} className="rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-1.5"><dt className="text-slate-500">{k}</dt><dd className="font-bold text-slate-800 capitalize">{v}</dd></div>
                      ))}
                    </dl>
                    <div className="rounded-lg border border-slate-200 px-3 py-2 text-xs">
                      <div className="flex justify-between"><span className="text-slate-600">Finishes (supplied and fitted)</span><b className="tabular-nums">{money(house.meta.cost.finishes)}</b></div>
                      <div className="flex justify-between"><span className="text-slate-600">Furniture, fixtures and decor</span><b className="tabular-nums">{money(house.meta.cost.furnishings)}</b></div>
                      <div className="flex justify-between border-t border-slate-100 mt-1 pt-1"><span className="font-semibold text-slate-800">Indicative total</span><b className="tabular-nums">{money(house.meta.cost.total)}</b></div>
                      <p className="mt-1 text-[11px] text-slate-500">List-price estimates. Confirm with your suppliers.</p>
                    </div>
                    {house.meta.notes.map((n) => <p key={n} className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5" role="status">{n}</p>)}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-3 py-2 bg-slate-50 text-xs font-bold text-slate-700">Finish schedule</div>
                  <div className="max-h-56 overflow-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-white text-slate-500 text-left"><tr><th className="px-3 py-1.5 font-semibold">Room</th><th className="px-2 py-1.5 font-semibold">Floor</th><th className="px-2 py-1.5 font-semibold">Walls</th><th className="px-2 py-1.5 font-semibold">Feature wall</th></tr></thead>
                      <tbody>
                        {house.meta.schedule.map((row) => (
                          <tr key={row.roomId} className="border-t border-slate-100 align-middle">
                            <td className="px-3 py-1.5"><b className="text-slate-800">{row.room}</b><span className="block text-slate-500">{row.levelName} · {row.areaSqm} m²</span></td>
                            <td className="px-2 py-1.5"><span className="flex items-center gap-1.5"><Swatch id={row.floor.id} size={22} />{row.floor.name}</span></td>
                            <td className="px-2 py-1.5"><span className="flex items-center gap-1.5"><Swatch id={row.wall.id} size={22} />{row.wall.name}</span></td>
                            <td className="px-2 py-1.5">{row.accent ? <span className="flex items-center gap-1.5"><Swatch id={row.accent.id} size={22} />{row.accent.name}</span> : <span className="text-slate-500">None</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
          <p className="text-xs text-slate-500">{replacesDesign ? 'Applying replaces the current design. You can undo it.' : 'Furniture, lights and decor are placed for you and stay editable.'}</p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="av-btn av-btn-secondary av-btn-sm">Cancel</button>
            {confirming ? (
              <>
                <button type="button" onClick={() => setConfirming(false)} className="av-btn av-btn-secondary av-btn-sm">Keep current design</button>
                <button type="button" onClick={() => house && onApply(house)} className="av-btn av-btn-danger av-btn-sm"><Check className="w-3.5 h-3.5" /><span>Replace design</span></button>
              </>
            ) : (
              <button type="button" disabled={!house} onClick={() => (replacesDesign ? setConfirming(true) : house && onApply(house))} className="av-btn av-btn-primary av-btn-sm disabled:opacity-50"><Check className="w-3.5 h-3.5" /><span>Apply to workspace</span></button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
