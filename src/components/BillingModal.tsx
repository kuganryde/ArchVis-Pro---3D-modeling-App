/**
 * Pricing / billing modal. Shows plan cards, highlights the current plan, and
 * drives Stripe Checkout (upgrade) or the billing portal (manage).
 */
import React, { useEffect, useState } from 'react';
import { Check, Loader2, Sparkles, X } from 'lucide-react';
import { PlanId } from '../shared/plans';
import {
  BillingConfig,
  fetchBillingConfig,
  startCheckout,
  openBillingPortal,
} from '../lib/billing';
import { showToast } from '../utils/toast';

interface BillingModalProps {
  workspaceId: string;
  currentPlan: PlanId;
  onClose: () => void;
}

export default function BillingModal({ workspaceId, currentPlan, onClose }: BillingModalProps) {
  const [config, setConfig] = useState<BillingConfig | null>(null);
  const [busy, setBusy] = useState<PlanId | 'portal' | null>(null);

  useEffect(() => {
    fetchBillingConfig().then(setConfig);
  }, []);

  const upgrade = async (plan: PlanId) => {
    setBusy(plan);
    try {
      await startCheckout(workspaceId, plan);
    } catch (e: any) {
      showToast(e?.message || 'Could not start checkout.', 'error');
      setBusy(null);
    }
  };

  const manage = async () => {
    setBusy('portal');
    try {
      await openBillingPortal(workspaceId);
    } catch (e: any) {
      showToast(e?.message || 'Could not open billing portal.', 'error');
      setBusy(null);
    }
  };

  return (
    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white max-w-3xl w-full rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-inner">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Plans & Billing</h2>
              <p className="text-xs text-slate-500 font-medium">
                You're on the <span className="font-bold capitalize">{currentPlan}</span> plan.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6">
          {!config ? (
            <div className="flex items-center justify-center gap-2 text-slate-500 text-sm py-10">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading plans…
            </div>
          ) : !config.enabled ? (
            <div className="text-center py-8 text-sm text-slate-500">
              Billing isn't configured on this deployment yet. Set the Stripe env vars on the
              server to enable upgrades.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {config.plans.map((p) => {
                const isCurrent = p.id === currentPlan;
                return (
                  <div
                    key={p.id}
                    className={`rounded-2xl border p-5 flex flex-col ${
                      isCurrent ? 'border-blue-400 ring-2 ring-blue-100 bg-blue-50/30' : 'border-slate-200'
                    }`}
                  >
                    <div className="mb-3">
                      <div className="text-sm font-bold text-slate-800">{p.name}</div>
                      <div className="mt-1">
                        <span className="text-2xl font-extrabold text-slate-900">{p.priceLabel}</span>
                        {p.id !== 'free' && <span className="text-xs text-slate-500 font-medium">/mo</span>}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 leading-snug">{p.blurb}</p>
                    </div>

                    <ul className="space-y-1.5 mb-5 flex-1">
                      {p.features.map((f) => (
                        <li key={f} className="flex items-start gap-1.5 text-[11px] text-slate-600">
                          <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>

                    {isCurrent ? (
                      p.id === 'free' ? (
                        <div className="text-center text-[11px] font-semibold text-slate-400 py-2">
                          Current plan
                        </div>
                      ) : (
                        <button
                          onClick={manage}
                          disabled={busy !== null}
                          className="w-full py-2 rounded-xl text-xs font-bold border border-slate-300 text-slate-700 hover:bg-slate-100 transition-all flex items-center justify-center gap-2"
                        >
                          {busy === 'portal' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          Manage billing
                        </button>
                      )
                    ) : p.purchasable ? (
                      <button
                        onClick={() => upgrade(p.id)}
                        disabled={busy !== null}
                        className="w-full py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all flex items-center justify-center gap-2"
                      >
                        {busy === p.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Upgrade to {p.name}
                      </button>
                    ) : (
                      <div className="text-center text-[11px] font-semibold text-slate-400 py-2">
                        {p.id === 'free' ? '—' : 'Not available'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
