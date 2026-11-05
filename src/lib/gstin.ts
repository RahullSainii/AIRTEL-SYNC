// GSTIN structure: 2-digit state code, 10-char PAN (5 letters, 4 digits, 1 letter),
// entity number (1-9/A-Z), the literal "Z", and a mod-36 checksum character.
const CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGIT_SLOTS = [0, 1, 7, 8, 9, 10];
const LETTER_SLOTS = [2, 3, 4, 5, 6, 11];
// Dataset note: the 4th PAN character is always "X", which we accept.
const FORMAT = /^[0-3][0-9][A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const TO_DIGIT: Record<string, string> = { O: '0', D: '0', Q: '0', I: '1', L: '1', Z: '2', S: '5', B: '8', G: '6', T: '7' };
const TO_LETTER: Record<string, string> = { '0': 'O', '1': 'I', '2': 'Z', '5': 'S', '8': 'B', '6': 'G', '7': 'T', '4': 'A' };
// Pairs OCR commonly confuses in monospace fonts. Used only for checksum-guided recovery.
const CONFUSABLE: Record<string, string[]> = {
  I: ['J', 'L', '1', 'T'], J: ['I'], L: ['I', '1'], '1': ['I', 'L', '7'], O: ['0', 'D', 'Q'], '0': ['O', 'D'],
  D: ['0', 'O'], Q: ['O', '0'], S: ['5'], '5': ['S'], B: ['8'], '8': ['B'], Z: ['2', '7'], '2': ['Z'], '7': ['Z', '1', 'T'],
  G: ['6', 'C'], '6': ['G'], C: ['G'], U: ['V'], V: ['U', 'Y'], Y: ['V'], M: ['N'], N: ['M'], E: ['F'], F: ['E'], P: ['R'], R: ['P'],
};

export function gstinChecksum(first14: string): string {
  let total = 0;
  for (let i = 0; i < 14; i++) {
    const v = CHARSET.indexOf(first14[i]) * (i % 2 === 0 ? 1 : 2);
    total += Math.floor(v / 36) + (v % 36);
  }
  return CHARSET[(36 - (total % 36)) % 36];
}

export function isValidGstinFormat(g: string): boolean {
  return FORMAT.test(g);
}

export function isValidGstin(g: string): boolean {
  return isValidGstinFormat(g) && gstinChecksum(g.slice(0, 14)) === g[14];
}

/** Fixes characters that the GSTIN structure makes unambiguous, e.g. a letter "O" in a digit slot. */
export function coerceGstin(raw: string): string {
  const s = raw.toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (s.length !== 15) return s;
  const c = s.split('');
  for (const i of DIGIT_SLOTS) if (!/[0-9]/.test(c[i]) && TO_DIGIT[c[i]]) c[i] = TO_DIGIT[c[i]];
  for (const i of LETTER_SLOTS) if (!/[A-Z]/.test(c[i]) && TO_LETTER[c[i]]) c[i] = TO_LETTER[c[i]];
  if (c[13] !== 'Z' && ['2', '7'].includes(c[13])) c[13] = 'Z';
  return c.join('');
}

export type GstinReadResult =
  | { status: 'valid'; gstin: string; corrected: boolean; note?: string }
  | { status: 'recovered'; gstin: string; candidates: string[]; note: string }
  | { status: 'invalid'; read: string; reason: string };

/**
 * Validates a GSTIN read by OCR. Structural fixes are applied first; if the checksum still
 * fails, single-character swaps between visually confusable glyphs are tried. A swap is only
 * accepted when exactly one candidate passes the checksum and, when a registry is supplied, exists there.
 */
export function readGstin(raw: string, existsInRegistry?: (g: string) => boolean): GstinReadResult {
  const cleaned = raw.toUpperCase().replace(/[^0-9A-Z]/g, '');
  const coerced = coerceGstin(cleaned);
  if (coerced.length !== 15) return { status: 'invalid', read: cleaned, reason: `GSTIN must be 15 characters; read ${coerced.length}.` };
  if (isValidGstin(coerced)) {
    return coerced === cleaned
      ? { status: 'valid', gstin: coerced, corrected: false }
      : { status: 'valid', gstin: coerced, corrected: true, note: `Fixed ${diffChars(cleaned, coerced)} using the GSTIN format.` };
  }
  const candidates = new Set<string>();
  for (let i = 0; i < 15; i++) {
    for (const alt of CONFUSABLE[coerced[i]] ?? []) {
      const c = coerced.slice(0, i) + alt + coerced.slice(i + 1);
      if (isValidGstin(c)) candidates.add(c);
    }
  }
  // A random swap passes the mod-36 checksum about 1 time in 36, so when a registry is
  // available a recovered value must also exist there.
  let list = [...candidates];
  if (existsInRegistry) list = list.filter(existsInRegistry);
  if (list.length === 1) {
    return { status: 'recovered', gstin: list[0], candidates: [...candidates], note: `Checksum failed on the OCR read; one look-alike character (${diffChars(coerced, list[0])}) gives a valid GSTIN.` };
  }
  const reason = !isValidGstinFormat(coerced)
    ? 'The characters do not follow the GSTIN pattern.'
    : `The checksum character should be "${gstinChecksum(coerced.slice(0, 14))}" but reads "${coerced[14]}".`;
  return { status: 'invalid', read: coerced, reason };
}

function diffChars(a: string, b: string): string {
  const out: string[] = [];
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) out.push(`${a[i]}→${b[i]} at position ${i + 1}`);
  return out.join(', ');
}

export function hamming(a: string, b: string): number {
  if (a.length !== b.length) return Infinity;
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
}

export const UDYAM_FORMAT = /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/;
export function normaliseUdyam(raw: string): string {
  const s = raw.toUpperCase().replace(/[^0-9A-Z]/g, '');
  const m = s.match(/^UDYAM([A-Z]{2})(\d{2})(\d{7})$/);
  return m ? `UDYAM-${m[1]}-${m[2]}-${m[3]}` : raw.toUpperCase().trim();
}
