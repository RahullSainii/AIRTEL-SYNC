import { describe, expect, test } from "vitest";
import { calculateQuote, type QuoteRequest } from "../engine";

describe("calculateQuote", () => {
  test("keeps decisions deterministic for same input", () => {
    const input: QuoteRequest = { cityTier: "metro", products: ["broadband-basic", "voice-pack"] };
    expect(calculateQuote(input)).toEqual(calculateQuote(input));
  });

  test("applies city tier multiplier", () => {
    const quote = calculateQuote({ cityTier: "tier2", products: ["broadband-pro"] });
    expect(quote.baseAmountInr).toBe(2499);
    expect(quote.tierAdjustedAmountInr).toBe(2249);
  });

  test("enforces dependency constraints", () => {
    expect(() => calculateQuote({ cityTier: "metro", products: ["static-ip"] })).toThrow(
      "Dependency violation"
    );
  });
});
