export const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
export const pct = (n: number, digits = 1) => (n * 100).toFixed(digits) + '%';

/** Masks an identifier for display and logs, keeping a short prefix and suffix. */
export function maskId(value: string | null | undefined, keepStart = 5, keepEnd = 4): string {
  if (!value) return '';
  if (value.length <= keepStart + keepEnd) return value;
  return value.slice(0, keepStart) + '•'.repeat(value.length - keepStart - keepEnd) + value.slice(-keepEnd);
}

export function formatClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
