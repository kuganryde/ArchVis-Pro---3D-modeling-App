import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync('src/index.css', 'utf8');
const token = (name: string): string => {
  const m = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`missing token ${name}`);
  return m[1];
};

const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('design tokens', () => {
  it('keeps body and small text readable (WCAG AA 4.5:1) on white and the canvas', () => {
    for (const bg of ['#ffffff', token('slate-50'), token('slate-100')]) {
      expect(contrast(token('slate-500'), bg), `slate-500 on ${bg}`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(token('slate-700'), bg), `slate-700 on ${bg}`).toBeGreaterThanOrEqual(7);
      expect(contrast(token('cyan-600'), bg), `cyan-600 on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('keeps white text on the accent buttons readable', () => {
    expect(contrast('#ffffff', token('cyan-600'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#ffffff', token('cyan-700'))).toBeGreaterThanOrEqual(7);
  });
  it('orders each ramp from light to dark', () => {
    for (const ramp of ['slate', 'cyan']) {
      const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((n) => lum(token(`${ramp}-${n}`)));
      for (let i = 1; i < steps.length; i++) expect(steps[i], `${ramp} step ${i}`).toBeLessThan(steps[i - 1]);
    }
  });
  it('loads fonts from this app, not a third party', () => {
    expect(css).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/);
    expect(css).toMatch(/--font-display:\s*"Bricolage Grotesque Variable"/);
    expect(css).toMatch(/--font-sans:\s*"IBM Plex Sans"/);
    expect(css).toMatch(/--font-mono:\s*"IBM Plex Mono"/);
  });
  it('respects reduced motion and shows keyboard focus', () => {
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
    expect(css).toMatch(/:focus-visible\s*\{[^}]*outline/);
  });
});
