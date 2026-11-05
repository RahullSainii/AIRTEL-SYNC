const norm = (s: string) => s.toLowerCase().replace(/\(prop\.?/g, ' ').replace(/[^a-z0-9& ]+/g, ' ').replace(/\s+/g, ' ').trim();

function lev(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
const ratio = (a: string, b: string) => 1 - lev(a, b) / Math.max(a.length, b.length, 1);

export type NameMatch = { match: 'exact' | 'close' | 'different'; differing: string[] };

/**
 * Word-level comparison: a one-letter OCR slip inside a word still matches, but a different
 * word (e.g. "Shri" vs "Neelgiri") is reported so the owner sees exactly what differs.
 */
export function compareNames(read: string | null | undefined, expected: string | null | undefined): NameMatch {
  if (!read || !expected) return { match: 'different', differing: [] };
  const a = norm(read), b = norm(expected);
  if (a === b) return { match: 'exact', differing: [] };
  const ta = a.split(' '), tb = b.split(' ');
  const differing: string[] = [];
  const close = (t: string, pool: string[]) => pool.some((u) => u === t || (t.length >= 4 && ratio(t, u) >= 0.8));
  for (const t of ta) if (!close(t, tb)) differing.push(t);
  for (const t of tb) if (!close(t, ta)) differing.push(t);
  return differing.length ? { match: 'different', differing } : { match: 'close', differing: [] };
}

/** "Neha Kaur (Prop. Vindhya Tours & Travels)" -> "Neha Kaur" */
export function proprietorOf(legalName: string): string | null {
  const m = legalName.match(/^(.*?)\s*\(Prop\.?/i);
  return m ? m[1].trim() : null;
}
