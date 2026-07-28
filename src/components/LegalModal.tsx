/**
 * Legal Center: a tabbed modal for Terms, Privacy, Acceptable Use, Refunds &
 * Billing, and Cookies. Content lives in src/data/legal.ts.
 */
import React, { useState } from 'react';
import { Scale, X } from 'lucide-react';
import { POLICIES, LEGAL } from '../data/legal';

export default function LegalModal({
  initialTab = 'terms',
  onClose,
}: {
  initialTab?: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState(initialTab);
  const policy = POLICIES.find((p) => p.id === tab) || POLICIES[0];

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[130] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white max-w-3xl w-full rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[88vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-2xl shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-100 text-cyan-600 flex items-center justify-center shadow-inner">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Legal Center</h2>
              <p className="text-xs text-slate-500 font-medium">
                {LEGAL.product} · Effective {LEGAL.effectiveDate}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-3 overflow-x-auto scrollbar-none shrink-0 border-b border-slate-100">
          {POLICIES.map((p) => (
            <button
              key={p.id}
              onClick={() => setTab(p.id)}
              className={`px-3 py-2 text-xs font-semibold rounded-t-lg whitespace-nowrap transition-all ${
                tab === p.id
                  ? 'text-cyan-700 border-b-2 border-cyan-500 bg-cyan-50/40'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {p.title}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          <h3 className="text-base font-bold text-slate-900 mb-1">{policy.title}</h3>
          {policy.intro && <p className="text-xs text-slate-600 leading-relaxed mb-4">{policy.intro}</p>}

          <div className="space-y-4">
            {policy.sections.map((s, i) => (
              <section key={i}>
                <h4 className="text-[13px] font-bold text-slate-800 mb-1">{s.heading}</h4>
                {s.body && <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">{s.body}</p>}
                {s.bullets && (
                  <ul className="mt-1 space-y-1">
                    {s.bullets.map((b, j) => (
                      <li key={j} className="text-xs text-slate-600 leading-relaxed flex gap-2">
                        <span className="text-cyan-500 mt-0.5">•</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>

          <p className="mt-6 text-[10px] text-slate-400 leading-relaxed border-t border-slate-100 pt-3">
            {LEGAL.company} · Questions: {LEGAL.contact}
          </p>
        </div>
      </div>
    </div>
  );
}
