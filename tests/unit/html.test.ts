import { describe, it, expect } from 'vitest';
import { escapeHtml } from '../../src/utils/html';

describe('escapeHtml', () => {
  it('neutralises markup and attribute breakouts', () => {
    expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe('&lt;img src=x onerror=alert(1)&gt;');
    expect(escapeHtml('" onmouseover="x')).toBe('&quot; onmouseover=&quot;x');
    expect(escapeHtml("it's & <b>")).toBe('it&#39;s &amp; &lt;b&gt;');
  });
  it('handles null, undefined and numbers', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml(42)).toBe('42');
  });
});
