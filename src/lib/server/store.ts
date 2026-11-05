import 'server-only';
import type { Order } from '../orders.ts';
import type { BundleLine, Language, Profile } from '../types.ts';

// In-memory store for the prototype. It survives hot reloads via globalThis but not restarts;
// production would use a database with encryption at rest and the retention schedule below.
export type Consent = { id: string; at: string; version: string; purposes: string[]; language: Language; withdrawnAt?: string | null };
export type Handoff = {
  id: string; at: string; status: 'new' | 'accepted' | 'won' | 'lost'; reason: string; business: string; profile: Profile;
  lines: BundleLine[]; monthly: number; language: Language; score: number; partner: string; city: string | null; transcript: string[];
};
export type AuditEvent = { at: string; event: string; detail: string };

type Store = { consents: Map<string, Consent>; orders: Map<string, Order>; handoffs: Map<string, Handoff>; audit: AuditEvent[] };
const g = globalThis as unknown as { __udyamStore?: Store };
export const store: Store = (g.__udyamStore ??= { consents: new Map(), orders: new Map(), handoffs: new Map(), audit: [] });

export function audit(event: string, detail: string) {
  store.audit.unshift({ at: new Date().toISOString(), event, detail });
  if (store.audit.length > 500) store.audit.length = 500;
}

export function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase().slice(-5)}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}

export function activeConsent(id: unknown): Consent | null {
  if (typeof id !== 'string') return null;
  const c = store.consents.get(id);
  return c && !c.withdrawnAt ? c : null;
}

const PARTNERS: Record<string, string> = {
  Mumbai: 'Shree Sai Telecom, Andheri', Pune: 'Deccan Connect, Shivajinagar', Delhi: 'Capital Netlink, Karol Bagh', Bengaluru: 'Namma Broadband, Jayanagar',
  Chennai: 'Marina Telecom, T. Nagar', Hyderabad: 'Charminar Digital, Ameerpet', Kolkata: 'Bengal Biz Links, Salt Lake', Ahmedabad: 'Sabarmati Connect, Navrangpura',
  Jaipur: 'Pink City Telecom, MI Road', Lucknow: 'Awadh Netcom, Hazratganj', Kochi: 'Kerala Biz Links, Edappally', Indore: 'Malwa Telecom, Vijay Nagar',
};
export const partnerFor = (city?: string | null) => (city && PARTNERS[city]) || `Accel certified partner${city ? `, ${city}` : ''}`;
