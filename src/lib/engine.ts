export type CityTier = "metro" | "tier1" | "tier2" | "tier3";

export type ProductCode = "broadband-basic" | "broadband-pro" | "voice-pack" | "static-ip";

export interface QuoteRequest {
  cityTier: CityTier;
  products: ProductCode[];
}

interface ProductRule {
  priceInr: number;
  requires?: ProductCode[];
}

const CITY_TIER_MULTIPLIER: Record<CityTier, number> = {
  metro: 1,
  tier1: 0.95,
  tier2: 0.9,
  tier3: 0.85
};

const CATALOGUE: Record<ProductCode, ProductRule> = {
  "broadband-basic": { priceInr: 1499 },
  "broadband-pro": { priceInr: 2499 },
  "voice-pack": { priceInr: 399, requires: ["broadband-basic"] },
  "static-ip": { priceInr: 999, requires: ["broadband-pro"] }
};

export interface QuoteResult {
  baseAmountInr: number;
  tierAdjustedAmountInr: number;
  multiplier: number;
  approved: true;
}

function assertDeterministicConstraints(products: ProductCode[]): void {
  const selected = new Set(products);
  for (const product of selected) {
    for (const dependency of CATALOGUE[product].requires ?? []) {
      if (!selected.has(dependency)) {
        throw new Error(`Dependency violation: ${product} requires ${dependency}`);
      }
    }
  }
}

export function calculateQuote(request: QuoteRequest): QuoteResult {
  assertDeterministicConstraints(request.products);

  const baseAmountInr = request.products.reduce((total, product) => total + CATALOGUE[product].priceInr, 0);
  const multiplier = CITY_TIER_MULTIPLIER[request.cityTier];
  const tierAdjustedAmountInr = Math.round(baseAmountInr * multiplier);

  return {
    baseAmountInr,
    tierAdjustedAmountInr,
    multiplier,
    approved: true
  };
}
