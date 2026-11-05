import { PROPENSITY_MODEL } from '../data/generated/model.ts';
import { resolveTier, inferSegment } from './engine.ts';
import type { Profile } from './types.ts';

const SEG_NAME = { micro: 'Micro retail & services', prof: 'Professional offices', multi: 'Small multi-site businesses', mfg: 'Small manufacturers' } as const;

/** Scores an in-app lead with the logistic model trained on smb_leads.csv. */
export function scoreProfile(p: Profile, source = 'Website form'): number {
  const m = PROPENSITY_MODEL;
  const seg = inferSegment(p);
  const values: Record<string, number> = {
    bias: 1, has_gstin: p.hasGstin ? 1 : 0, has_udyam: 0, tier1: resolveTier(p).tier === 1 ? 1 : 0,
    log_employees: Math.log1p(p.employees ?? 1) / 4, multi_site: (p.sites ?? 1) > 1 ? 1 : 0,
    log_spend: Math.log1p(p.monthlySpend ?? 0) / 10, n_products: (p.needs?.length ?? 0) / 5,
  };
  if (seg) values[`segment=${SEG_NAME[seg]}`] = 1;
  values[`lead_source=${source}`] = 1;
  const z = m.featureNames.reduce((s, f, i) => s + (values[f] ?? 0) * m.weights[i], 0);
  return 1 / (1 + Math.exp(-z));
}

export function scoreBand(score: number): { label: string; tone: 'high' | 'mid' | 'low' } {
  if (score >= 0.12) return { label: 'Hot', tone: 'high' };
  if (score >= 0.07) return { label: 'Warm', tone: 'mid' };
  return { label: 'Cool', tone: 'low' };
}
