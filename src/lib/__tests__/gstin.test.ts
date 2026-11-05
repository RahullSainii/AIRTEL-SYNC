import { describe, expect, test } from "vitest";
import { coerceGstin, computeGstinChecksum, isValidGstin } from "../gstin";

describe("gstin", () => {
  test("coerces look-alike characters", () => {
    const result = coerceGstin("27AAPFUO939F1ZV");
    expect(result.normalized).toBe("27AAPFU0939F1ZV");
    expect(result.recovered).toBe(true);
  });

  test("validates checksum", () => {
    const first14 = "27AAPFU0939F1Z";
    expect(computeGstinChecksum(first14)).toBe("F");
    expect(isValidGstin("27AAPFU0939F1ZF")).toBe(true);
  });

  test("rejects malformed gstin", () => {
    expect(isValidGstin("00INVALIDGSTIN00")).toBe(false);
  });
});
