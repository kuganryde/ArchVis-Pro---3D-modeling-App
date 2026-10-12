/**
 * Isometric preview of an asset type for the Library list. The PNGs in public/iso/
 * are rendered from the same models the 3D view uses (`npm run assets:iso`); if one
 * is missing the card falls back to the generic category icon.
 */
import React, { useState } from 'react';
import { Cpu, Layout } from 'lucide-react';

export default function IsoThumb({ type, category }: { type: string; category: 'infrastructure' | 'furniture' }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`p-2 rounded-lg transition-all ${
          category === 'infrastructure'
            ? 'bg-cyan-50 text-cyan-600 group-hover:bg-cyan-100'
            : 'bg-orange-50 text-orange-650 group-hover:bg-orange-100'
        }`}
      >
        {category === 'infrastructure' ? <Cpu className="w-4 h-4" /> : <Layout className="w-4 h-4" />}
      </div>
    );
  }

  return (
    <img
      src={`${(import.meta as any).env?.BASE_URL ?? '/'}iso/${type}.png`}
      alt="" // decorative: the card's label already names the asset
      width={44}
      height={44}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      data-testid={`iso-thumb-${type}`}
      className="w-11 h-11 shrink-0 object-contain rounded-lg bg-white border border-slate-100 group-hover:border-cyan-200 transition-all"
    />
  );
}
