import { describe, it, expect } from 'vitest';
import { csvCell, csvRow } from '../../src/utils/csv';
import { bomToCsv, computeBom } from '../../src/utils/bom';
import type { PlacedAsset } from '../../src/types';

describe('csvCell', () => {
  it('quotes and escapes embedded quotes', () => {
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
  });
  it.each(['=1+1', '+SUM(A1)', '-2+3', '@cmd', '\tx'])('defuses formula prefix %j', (v) => {
    expect(csvCell(v)).toBe(`"'${v}"`);
  });
  it('leaves normal text and numbers untouched apart from quoting', () => {
    expect(csvCell('Aruba AP-535')).toBe('"Aruba AP-535"');
    expect(csvCell(12)).toBe('"12"');
    expect(csvCell(null)).toBe('""');
  });
  it('joins rows with commas', () => {
    expect(csvRow(['a', 'b,c'])).toBe('"a","b,c"');
  });
});

describe('bomToCsv', () => {
  it('neutralises formulas coming from asset specs', () => {
    const asset = {
      id: 'a1', type: 'ap', category: 'infrastructure', name: 'AP',
      position: { x: 0, y: 0, z: 0 }, rotationY: 0, scale: { x: 1, y: 1, z: 1 },
      specs: { Manufacturer: '=HYPERLINK("http://evil.example","x")', Cost: '$100' },
    } as PlacedAsset;
    const csv = bomToCsv(computeBom([asset]));
    expect(csv).toContain(`"'=HYPERLINK(""http://evil.example"",""x"")"`);
    expect(csv).not.toMatch(/(^|,)"=HYPERLINK/m);
  });
});
