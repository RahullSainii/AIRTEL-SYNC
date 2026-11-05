import { NEEDS, type Need, type Profile } from '../types.ts';
import { PRODUCT_BY_ID } from '../catalogue.ts';

const SEGMENTS = ['micro', 'prof', 'multi', 'mfg'];
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : undefined);

/** Merges an untrusted LLM extraction into the profile, keeping only known fields and values. */
export function mergeProfile(base: Profile, raw: unknown): Profile {
  const x = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: Profile = { ...base, needs: [...(base.needs ?? [])], quantities: { ...(base.quantities ?? {}) } };
  const str = (k: string) => (typeof x[k] === 'string' && (x[k] as string).trim() ? (x[k] as string).trim().slice(0, 80) : undefined);
  out.businessName = str('business_name') ?? out.businessName;
  out.businessType = str('business_type') ?? out.businessType;
  if (typeof x.segment === 'string' && SEGMENTS.includes(x.segment)) out.segment = x.segment as Profile['segment'];
  out.employees = num(x.employees) ?? out.employees;
  out.sites = num(x.sites) ?? out.sites;
  out.city = str('city') ?? out.city;
  if (x.city_tier === 1 || x.city_tier === 2) { out.cityTier = x.city_tier; out.tierEstimated = true; }
  if (typeof x.has_gstin === 'boolean') out.hasGstin = x.has_gstin;
  out.currentInternet = str('current_internet') ?? out.currentInternet;
  out.monthlySpend = num(x.monthly_spend) ?? out.monthlySpend;
  if (typeof x.no_fibre === 'boolean') out.noFibre = x.no_fibre;
  const needSet = new Set<Need>(out.needs);
  if (Array.isArray(x.needs)) for (const n of x.needs) if ((NEEDS as readonly string[]).includes(n)) needSet.add(n as Need);
  if (Array.isArray(x.remove_needs)) for (const n of x.remove_needs) needSet.delete(n as Need);
  out.needs = [...needSet];
  const qIn = (x.quantities && typeof x.quantities === 'object' ? x.quantities : {}) as Record<string, unknown>;
  for (const k of ['mobileLines', 'cameras', 'posCounters', 'emailUsers', 'devices', 'vehicles', 'machines', 'voiceChannels'] as const) {
    const v = num(qIn[k]);
    if (v) out.quantities![k] = Math.min(v, 200);
  }
  const ids = (k: string) => (Array.isArray(x[k]) ? (x[k] as unknown[]).filter((v): v is string => typeof v === 'string' && !!PRODUCT_BY_ID[v]) : []);
  out.requestedProducts = [...new Set([...(out.requestedProducts ?? []), ...ids('requested_products')])].filter((id) => !ids('declined_products').includes(id));
  out.declinedProducts = [...new Set([...(out.declinedProducts ?? []), ...ids('declined_products')])].filter((id) => !ids('requested_products').includes(id));
  return out;
}
