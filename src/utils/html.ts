/**
 * Escape text for interpolation into HTML. Room / asset names come from users,
 * imported JSON files and AI output, and the PDF report writes them into a new
 * same-origin window with document.write — unescaped, that is stored XSS.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;'
  );
}
