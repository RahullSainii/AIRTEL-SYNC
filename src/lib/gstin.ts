const BASE36 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const NUMERIC_LOOKALIKE: Record<string, string> = {
  O: "0",
  Q: "0",
  I: "1",
  L: "1",
  Z: "2",
  S: "5",
  B: "8"
};

const ALPHA_LOOKALIKE: Record<string, string> = {
  "0": "O",
  "1": "I",
  "2": "Z",
  "5": "S",
  "8": "B"
};

function base36Index(char: string): number {
  return BASE36.indexOf(char);
}

export function computeGstinChecksum(first14: string): string {
  let factor = 1;
  let sum = 0;

  for (const char of first14) {
    const codePoint = base36Index(char);
    if (codePoint < 0) {
      throw new Error("Invalid GSTIN characters");
    }

    const product = codePoint * factor;
    sum += Math.floor(product / 36) + (product % 36);
    factor = factor === 1 ? 3 : 1;
  }

  const checkCodePoint = (36 - (sum % 36)) % 36;
  return BASE36[checkCodePoint];
}

function normalizeChar(char: string, index: number): string {
  const upper = char.toUpperCase();

  if (index <= 1 || (index >= 7 && index <= 10)) {
    return NUMERIC_LOOKALIKE[upper] ?? upper;
  }

  if ((index >= 2 && index <= 6) || index === 11) {
    return ALPHA_LOOKALIKE[upper] ?? upper;
  }

  if (index === 13) {
    return upper === "2" ? "Z" : upper;
  }

  return upper;
}

export function coerceGstin(input: string): { normalized: string; recovered: boolean } {
  const compact = input.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const limited = compact.slice(0, 15);
  const normalized = limited
    .split("")
    .map((char, index) => normalizeChar(char, index))
    .join("");

  return {
    normalized,
    recovered: normalized !== limited
  };
}

export function isValidGstin(input: string): boolean {
  const { normalized } = coerceGstin(input);

  if (!/^\d{2}[A-Z0-9]{10}[A-Z0-9]Z[A-Z0-9]$/.test(normalized)) {
    return false;
  }

  const expected = computeGstinChecksum(normalized.slice(0, 14));
  return expected === normalized[14];
}
