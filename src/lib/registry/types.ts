export interface RegistryRecord {
  gstin: string;
  legalName: string;
  status: "active" | "inactive";
}

export type RegistryLookupResult =
  | { state: "match"; record: RegistryRecord }
  | { state: "not_found" }
  | { state: "manual_review"; reason: string };

export interface RegistryAdapter {
  lookupByGstin(gstin: string): Promise<RegistryLookupResult>;
}
