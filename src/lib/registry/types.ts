import type { GstinRecord, UdyamRecord } from '../types.ts';

/**
 * Every registry check goes through this interface. The prototype ships a mock adapter backed
 * by the hackathon CSVs; a production adapter would call a licensed GST Suvidha Provider (GSP)
 * for GSTIN and the Udyam/DigiLocker APIs, behind the same consent check.
 */
export interface RegistryAdapter {
  readonly id: string;
  readonly label: string;
  lookupGstin(gstin: string): Promise<GstinRecord | null>;
  lookupUdyam(udyamNumber: string): Promise<UdyamRecord | null>;
  gstinExists(gstin: string): boolean;
  findUdyamByName?(name: string, state?: string): Promise<UdyamRecord[]>;
  /** Near matches help explain a mismatch; they are never used to approve silently. */
  nearestGstin?(gstin: string): Promise<GstinRecord | null>;
}

export class RegistryUnavailableError extends Error {
  constructor(source: string) {
    super(`${source} is not responding`);
  }
}
