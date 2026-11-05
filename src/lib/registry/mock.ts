import 'server-only';
import gstData from '../../data/generated/gstin-registry.json';
import udyamData from '../../data/generated/udyam-registry.json';
import { hamming } from '../gstin.ts';
import type { GstinRecord, UdyamRecord } from '../types.ts';
import type { RegistryAdapter } from './types.ts';

const GST = new Map((gstData as GstinRecord[]).map((r) => [r.gstin, r]));
const UDYAM = new Map((udyamData as UdyamRecord[]).map((r) => [r.udyamNumber, r]));
// Simulated network latency so the demo timings stay honest about a real lookup.
const LATENCY_MS = 220;
const wait = () => new Promise((r) => setTimeout(r, LATENCY_MS));

export const mockRegistry: RegistryAdapter = {
  id: 'mock-csv-v1',
  label: 'Mock registry (hackathon CSV)',
  async lookupGstin(gstin) {
    await wait();
    return GST.get(gstin) ?? null;
  },
  async lookupUdyam(n) {
    await wait();
    return UDYAM.get(n) ?? null;
  },
  gstinExists: (g) => GST.has(g),
  async findUdyamByName(name, state) {
    const key = name.toLowerCase().trim();
    return [...UDYAM.values()].filter((r) => r.enterpriseName.toLowerCase() === key && (!state || r.state === state)).slice(0, 3);
  },
  async nearestGstin(gstin) {
    let best: GstinRecord | null = null;
    for (const r of GST.values()) if (r.gstin.slice(0, 2) === gstin.slice(0, 2) && hamming(r.gstin, gstin) === 1) best = r;
    return best;
  },
};
