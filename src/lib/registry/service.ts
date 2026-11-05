import { HumanFallbackQueue } from "./fallback-queue";
import type { RegistryAdapter, RegistryLookupResult } from "./types";

export interface RegistryLookupRequest {
  gstin: string;
  consentId: string;
}

export async function lookupWithFallback(
  adapter: RegistryAdapter,
  queue: HumanFallbackQueue,
  request: RegistryLookupRequest
): Promise<RegistryLookupResult> {
  const result = await adapter.lookupByGstin(request.gstin);

  if (result.state === "manual_review") {
    queue.enqueue({
      gstin: request.gstin,
      reason: result.reason,
      consentId: request.consentId
    });
  }

  return result;
}
