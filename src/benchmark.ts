import { performance } from "node:perf_hooks";
import { calculateQuote } from "./lib/engine";
import { isValidGstin } from "./lib/gstin";

const sampleGstin = "27AAPFU0939F1ZF";
const start = performance.now();

for (let i = 0; i < 5000; i += 1) {
  calculateQuote({ cityTier: "tier1", products: ["broadband-pro", "static-ip"] });
  isValidGstin(sampleGstin);
}

const end = performance.now();
console.log(`Benchmark: ${(end - start).toFixed(2)}ms for 5k deterministic quote+GSTIN checks`);
