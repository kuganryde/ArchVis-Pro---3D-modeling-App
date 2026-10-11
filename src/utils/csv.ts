/**
 * CSV helpers. Asset names and specs are user- or AI-controlled, so a cell like
 * `=HYPERLINK("http://evil",...)` would execute as a formula when the export is
 * opened in Excel / Sheets (CSV injection, OWASP). We neutralise formula
 * prefixes and escape embedded quotes per RFC 4180.
 */

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/** Escape one cell: defuse formulas, double quotes, and always quote the field. */
export function csvCell(value: unknown): string {
  let s = value == null ? '' : String(value);
  if (FORMULA_PREFIX.test(s)) s = `'${s}`; // leading apostrophe forces text in spreadsheets
  return `"${s.replace(/"/g, '""')}"`;
}

/** Join cells into a CSV row. */
export const csvRow = (cells: unknown[]): string => cells.map(csvCell).join(',');
