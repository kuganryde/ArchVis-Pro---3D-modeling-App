/**
 * ArchViz Pro brand mark: a neon cyan hexagon enclosing a green pyramid, on a
 * dark rounded tile (the app icon). Scales to any size; used in the header, the
 * auth screen and loading states.
 */
import React from 'react';

export default function Logo({ size = 36, glow = true }: { size?: number; glow?: boolean }) {
  const id = React.useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="ArchViz Pro"
      style={{ display: 'block' }}
    >
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#111a2e" />
          <stop offset="1" stopColor="#0a0f1d" />
        </linearGradient>
        <filter id={`${id}-glow`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Tile */}
      <rect x="2" y="2" width="96" height="96" rx="24" fill={`url(#${id}-bg)`} stroke="#1e293b" strokeWidth="1.5" />

      {/* Dashed orbit ring */}
      <circle cx="50" cy="50" r="37" stroke="#3b4c8a" strokeWidth="1.2" strokeDasharray="4 4" opacity="0.55" />

      <g filter={glow ? `url(#${id}-glow)` : undefined} strokeLinecap="round" strokeLinejoin="round">
        {/* Cyan hexagon */}
        <polygon
          points="50,20 76,35 76,65 50,80 24,65 24,35"
          stroke="#22d3ee"
          strokeWidth="3.6"
          fill="none"
        />
        {/* Green pyramid */}
        <polygon points="50,33 33,68 67,68" stroke="#34d399" strokeWidth="3" fill="none" />
        {/* Pyramid internals */}
        <line x1="50" y1="33" x2="50" y2="55" stroke="#34d399" strokeWidth="2.4" />
        <line x1="38" y1="55" x2="62" y2="55" stroke="#34d399" strokeWidth="2.4" />
        <line x1="50" y1="55" x2="33" y2="68" stroke="#22d3ee" strokeWidth="1.8" opacity="0.85" />
        <line x1="50" y1="55" x2="67" y2="68" stroke="#22d3ee" strokeWidth="1.8" opacity="0.85" />

        {/* Hexagon nodes */}
        {[
          [50, 20],
          [76, 35],
          [76, 65],
          [50, 80],
          [24, 65],
          [24, 35],
        ].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="3.4" fill="#22d3ee" />
        ))}
        {/* Center node */}
        <circle cx="50" cy="55" r="3.2" fill="#34d399" />
      </g>
    </svg>
  );
}

/** Inline wordmark: ARCHVIZ (foreground) + PRO (cyan) + optional tagline. */
export function Wordmark({
  className = '',
  dark = false,
  tagline = true,
}: {
  className?: string;
  dark?: boolean;
  tagline?: boolean;
}) {
  return (
    <div className={`flex flex-col leading-none ${className}`}>
      <span className={`font-bold tracking-[0.12em] ${dark ? 'text-white' : 'text-slate-900'}`}>
        ARCHVIZ <span className="text-cyan-500">PRO</span>
        <sup className="text-[0.55em] text-cyan-400 ml-0.5">™</sup>
      </span>
      {tagline && (
        <span className="text-[9px] font-semibold tracking-[0.22em] text-emerald-500 mt-1">
          // AI DIGITAL TWIN PLATFORM
        </span>
      )}
    </div>
  );
}
