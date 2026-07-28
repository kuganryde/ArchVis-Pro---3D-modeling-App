/**
 * Email + password auth screen shown when SaaS mode is on and no user is
 * signed in. Uses Supabase auth; supports sign-in and sign-up.
 */
import React, { useState } from 'react';
import { Mail, Lock, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Logo from './Logo';

export default function AuthScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (error) throw error;
        setNotice('Account created. If email confirmation is enabled, check your inbox, then sign in.');
        setMode('signin');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // On success, the auth listener swaps the view automatically.
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const field =
    'w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700 text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30 transition-all text-sm';

  return (
    <div
      className="min-h-screen w-screen flex items-center justify-center p-4 font-sans relative overflow-hidden"
      style={{
        background:
          'radial-gradient(1200px 600px at 50% -10%, #10203f 0%, #0a0f1d 55%, #070a14 100%)',
      }}
    >
      {/* Faint blueprint grid backdrop */}
      <div
        className="absolute inset-0 opacity-[0.12] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(#22d3ee 1px, transparent 1px), linear-gradient(90deg, #22d3ee 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          maskImage: 'radial-gradient(circle at 50% 40%, black, transparent 75%)',
        }}
      />

      <div className="w-full max-w-md relative">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="drop-shadow-[0_0_25px_rgba(34,211,238,0.35)] mb-4">
            <Logo size={76} />
          </div>
          <h1 className="text-2xl font-bold tracking-[0.14em] text-white">
            ARCHVIZ <span className="text-cyan-400">PRO</span>
            <sup className="text-xs text-cyan-300 ml-0.5">™</sup>
          </h1>
          <p className="text-[10px] font-semibold tracking-[0.24em] text-emerald-400 mt-1.5">
            // AI DIGITAL TWIN PLATFORM
          </p>
        </div>

        <div className="bg-slate-900/70 backdrop-blur-xl rounded-2xl border border-slate-700/70 shadow-2xl p-7">
          <p className="text-sm font-semibold text-slate-200 text-center mb-5">
            {mode === 'signin' ? 'Sign in to your workspace' : 'Create your workspace account'}
          </p>

          <form onSubmit={submit} className="space-y-3.5">
            {mode === 'signup' && (
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={field}
                  placeholder="Full name"
                  required
                />
              </div>
            )}

            <div className="relative">
              <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={field}
                placeholder="you@company.com"
                required
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={field}
                placeholder="••••••••"
                minLength={6}
                required
              />
            </div>

            {error && (
              <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
                {error}
              </div>
            )}
            {notice && (
              <div className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
                {notice}
              </div>
            )}

            <button type="submit" disabled={busy} className="av-btn av-btn-primary text-sm w-full">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>

            <p className="text-center text-xs text-slate-400 pt-1">
              {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'signin' ? 'signup' : 'signin');
                  setError(null);
                  setNotice(null);
                }}
                className="text-cyan-400 font-semibold hover:underline"
              >
                {mode === 'signin' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
