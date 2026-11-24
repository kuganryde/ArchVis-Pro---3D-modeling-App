/**
 * Offline request parser: turns "a modern 3 bedroom, 2 bathroom home with a study,
 * marble bathrooms and floral wallpaper in the master" into a HouseBrief. It always
 * works (no key, no network) and the Gemini pass only refines what it finds.
 */
import type { HouseBrief } from './types';
import { DESIGN_STYLES } from './styles';
import { getFinish } from './finishes';

const WORD_NUM: Record<string, number> = { one: 1, a: 1, single: 1, two: 2, double: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 };
const NUM = '(\\d+(?:\\.\\d+)?|one|two|three|four|five|six|seven|eight)';
const toNum = (s: string) => (/^\d/.test(s) ? Number(s) : WORD_NUM[s.toLowerCase()]);

const STYLE_WORDS: Array<[string, RegExp]> = [
  ['scandinavian', /scandi|nordic|hygge/],
  ['japandi', /japandi|japanese|zen\b/],
  ['industrial', /industrial|loft|warehouse|urban/],
  ['mid_century', /mid[\s-]?century|retro|1950s|1960s|\bmcm\b/],
  ['traditional', /traditional|classic|colonial|victorian|georgian|period/],
  ['boho', /boho|bohemian|eclectic/],
  ['luxury', /luxur|art[\s-]?deco|\bdeco\b|glam|opulent|high[\s-]?end|five[\s-]?star/],
  ['coastal', /coastal|beach|hamptons|nautical|seaside|mediterranean/],
  ['minimalist', /minimal/],
  ['modern', /modern|contemporary/],
];

/** Finish phrases, most specific first. The first match for each slot wins. */
const FLOOR_WORDS: Array<[RegExp, string]> = [
  [/chevron|herringbone|parquet/, 'oak_chevron'],
  [/(?:black|nero)\s+marble\s+floor/, 'marble_black'],
  [/marble\s+floor|floors?\s+(?:in|of)\s+marble/, 'marble_white'],
  [/terrazzo/, 'terrazzo'],
  [/walnut|dark\s+(?:wood|timber|oak)/, 'walnut_plank'],
  [/grey\s+(?:wood|timber)|washed\s+(?:wood|oak)/, 'grey_wood'],
  [/(?:oak|timber|wood(?:en)?|hardwood)\s+floor|floors?\s+(?:in|of)\s+(?:oak|timber|wood)/, 'oak_plank'],
  [/polished\s+concrete|concrete\s+floor/, 'concrete'],
  [/checker/, 'checker_bw'],
  [/encaustic|hex(?:agon)?\s+tile|patterned\s+tile|cement\s+tile/, 'encaustic_hex'],
  [/travertine/, 'travertine'],
  [/slate/, 'slate'],
  [/carpet/, 'carpet_oat'],
  [/large[\s-]format|big\s+tile|porcelain/, 'porcelain_large'],
];

const WET_FLOOR_WORDS: Array<[RegExp, string]> = [
  [/(?:black|nero)\s+marble\s+(?:bath|shower|wet)/, 'marble_black'],
  [/marble\s+(?:bath|ensuite|shower|wet)/, 'marble_white'],
  [/(?:encaustic|hex(?:agon)?|patterned)\s+tile[sd]?\s+(?:in\s+)?(?:the\s+)?(?:bath|ensuite)|(?:bath|ensuite)\w*\s+(?:with\s+)?(?:encaustic|hex)/, 'encaustic_hex'],
  [/terrazzo\s+(?:bath|ensuite)/, 'terrazzo'],
  [/slate\s+(?:bath|ensuite)/, 'slate'],
];
const WET_WALL_WORDS: Array<[RegExp, string]> = [
  [/marble\s+(?:bath|ensuite|shower|wet)/, 'tile_marble_wall'],
  [/zellige|green\s+(?:bath|tile)/, 'tile_zellige_green'],
  [/subway|white\s+tile/, 'tile_subway_white'],
  [/terracotta\s+(?:bath|tile)/, 'tile_terracotta'],
];

const ACCENT_WORDS: Array<[RegExp, string]> = [
  [/botanical|floral|flower|bloom/, 'wp_floral_botanical'],
  [/blush\s+(?:floral|bloom)/, 'wp_floral_blush'],
  [/art[\s-]?deco\s+(?:fan|wallpaper)|fan\s+wallpaper/, 'wp_deco_fan'],
  [/gold\s+geometric|geometric\s+gold|gold\s+wallpaper/, 'wp_geometric_gold'],
  [/geometric/, 'wp_geometric_grey'],
  [/teal\s+damask/, 'wp_damask_teal'],
  [/damask/, 'wp_damask_grey'],
  [/grasscloth|grass\s+cloth|natural\s+fibre/, 'wp_grasscloth'],
  [/chevron\s+wallpaper|teal\s+chevron/, 'wp_chevron_teal'],
  [/sage\s+stripe|green\s+stripe/, 'wp_stripe_sage'],
  [/stripe|pinstripe/, 'wp_stripe_navy'],
  [/slat|wood(?:en)?\s+panel|timber\s+panel/, 'wp_slat_oak'],
];

const WALL_PAINT_WORDS: Array<[RegExp, string]> = [
  [/navy\s+walls?|walls?\s+(?:in|of)\s+navy|deep\s+blue\s+walls?/, 'paint_navy'],
  [/sage\s+(?:green\s+)?walls?|walls?\s+(?:in|of)\s+sage/, 'paint_sage'],
  [/terracotta\s+walls?/, 'paint_terracotta'],
  [/charcoal\s+walls?|dark\s+grey\s+walls?/, 'paint_charcoal'],
  [/blush\s+(?:pink\s+)?walls?|pink\s+walls?/, 'paint_blush'],
  [/mustard\s+walls?|yellow\s+walls?/, 'paint_mustard'],
  [/(?:blue|sky|sea[\s-]?mist)\s+walls?/, 'paint_sky'],
  [/greige\s+walls?|beige\s+walls?|taupe\s+walls?/, 'paint_greige'],
  [/warm\s+white\s+walls?|cream\s+walls?/, 'paint_warm_white'],
  [/white\s+walls?/, 'paint_white'],
];

export interface ParsedRequest {
  brief: Partial<HouseBrief>;
  /** Human-readable list of what was understood, for the UI. */
  understood: string[];
}

const first = <T,>(text: string, table: Array<[RegExp, T]>): T | undefined => table.find(([re]) => re.test(text))?.[1];

export function parseBrief(request: string): ParsedRequest {
  const text = ` ${request.toLowerCase().replace(/\s+/g, ' ')} `;
  const brief: Partial<HouseBrief> = { request: request.trim() };
  const said: string[] = [];

  let m = text.match(new RegExp(`${NUM}[\\s-]*(?:bed(?:room)?s?|br\\b|bhk)`));
  if (m) { brief.bedrooms = Math.max(1, Math.min(6, Math.round(toNum(m[1])))); said.push(`${brief.bedrooms} bedroom${brief.bedrooms === 1 ? '' : 's'}`); }
  else if (/\bstudio\b/.test(text)) { brief.bedrooms = 1; said.push('1 bedroom (studio)'); }

  m = text.match(new RegExp(`${NUM}[\\s-]*(?:bath(?:room)?s?|ba\\b|toilets?|en[\\s-]?suites?)`));
  if (m) { brief.bathrooms = Math.max(1, Math.min(5, Math.round(toNum(m[1])))); said.push(`${brief.bathrooms} bathroom${brief.bathrooms === 1 ? '' : 's'}`); }

  m = text.match(new RegExp(`${NUM}[\\s-]*(?:storey|story|floor|level)s?\\b`));
  if (m && toNum(m[1]) >= 2) { brief.floors = 2; said.push('Two storeys'); }
  else if (/double[\s-]?(?:storey|story)|two[\s-]?stor|duplex|townhouse|upstairs|first floor/.test(text)) { brief.floors = 2; said.push('Two storeys'); }
  else if (/single[\s-]?(?:storey|story)|one[\s-]?stor|bungalow|ranch|one floor|single level|single floor/.test(text)) { brief.floors = 1; said.push('Single storey'); }

  m = text.match(/(\d[\d,.]*)\s*(?:sq\.?\s?m(?:etres?|eters?)?|sqm|m2|m²|square\s+met(?:er|re)s?)/);
  const ft = text.match(/(\d[\d,.]*)\s*(?:sq\.?\s?ft|sqft|square\s+f(?:ee|oo)t|ft2|ft²)/);
  if (m) brief.areaSqm = Number(m[1].replace(/,/g, ''));
  else if (ft) brief.areaSqm = Math.round(Number(ft[1].replace(/,/g, '')) / 10.7639);
  if (brief.areaSqm && (brief.areaSqm < 40 || brief.areaSqm > 900)) delete brief.areaSqm;
  if (brief.areaSqm) said.push(`About ${Math.round(brief.areaSqm)} m²`);

  const style = STYLE_WORDS.find(([, re]) => re.test(text))?.[0];
  if (style) { brief.styleId = style; said.push(`${DESIGN_STYLES.find((s) => s.id === style)!.name} style`); }

  if (/\b(?:study|home office|office|workspace)\b/.test(text) && !/no (?:study|office)/.test(text)) { brief.study = true; said.push('Study'); }
  if (/no (?:laundry|utility)|without (?:a )?laundry/.test(text)) brief.laundry = false;
  else if (/laundry|utility room/.test(text)) { brief.laundry = true; said.push('Laundry'); }

  const floor = first(text, FLOOR_WORDS);
  const wetFloor = first(text, WET_FLOOR_WORDS);
  const wetWall = first(text, WET_WALL_WORDS);
  const accent = first(text, ACCENT_WORDS.filter(([re]) => /wallpaper|feature wall|accent|panel|stripe|damask|floral|botanical|geometric|grasscloth|slat/.test(re.source) || true));
  const wallPaint = first(text, WALL_PAINT_WORDS);
  const wantsPaper = /wallpaper|feature wall|accent wall|panell?ing|wall\s*paper/.test(text) || accent === 'wp_slat_oak';
  const prefs: NonNullable<HouseBrief['prefs']> = {};
  if (floor && getFinish(floor)) prefs.floor = floor;
  if (wetFloor) prefs.wetFloor = wetFloor;
  if (wetWall) prefs.wetWall = wetWall;
  if (accent && wantsPaper) prefs.accent = accent;
  if (wallPaint) prefs.wall = wallPaint;
  if (Object.keys(prefs).length) {
    brief.prefs = prefs;
    if (prefs.floor) said.push(`Floors: ${getFinish(prefs.floor)!.name}`);
    if (prefs.wetFloor || prefs.wetWall) said.push(`Bathrooms: ${[prefs.wetFloor, prefs.wetWall].filter(Boolean).map((id) => getFinish(id)!.name).join(' with ')}`);
    if (prefs.accent) said.push(`Feature wall: ${getFinish(prefs.accent)!.name}`);
    if (prefs.wall) said.push(`Walls: ${getFinish(prefs.wall)!.name}`);
  }

  if (/warm(?:\s+white)?\s+light|cosy|cozy|candle|soft light|ambient|moody/.test(text)) { brief.lighting = 'warm'; said.push('Warm lighting'); }
  else if (/cool(?:\s+white)?\s+light|daylight|bright\s+light|crisp light|task light/.test(text)) { brief.lighting = 'cool'; said.push('Cool daylight lighting'); }
  else if (/neutral\s+light|natural\s+light/.test(text)) { brief.lighting = 'neutral'; said.push('Neutral lighting'); }

  return { brief, understood: said };
}
