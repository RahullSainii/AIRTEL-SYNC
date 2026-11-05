// Deterministic recommendation and eligibility engine. The LLM never decides what is sold or
// at what price: it extracts the profile and explains the result this engine produces.
import { BUSINESS_TYPES } from '../data/generated/business-types.ts';
import { CITIES } from '../data/generated/cities.ts';
import { BASE_LINKS, PRODUCTS, product } from './catalogue.ts';
import type { BundleLine, Exclusion, Need, Product, Profile, Quote, Segment } from './types.ts';

export const SEGMENT_LABEL: Record<Segment, string> = {
  micro: 'Micro retail & services',
  prof: 'Professional office',
  multi: 'Multi-site business',
  mfg: 'Small manufacturer',
};

const SEGMENT_KEYWORDS: [RegExp, Segment][] = [
  [/(chain|outlets|branches|stores across|franchise|hotel group)/i, 'multi'],
  [/(manufactur|factory|unit\b|workshop|moulding|packaging|textile|printing|auto.?parts|food processing|plant)/i, 'mfg'],
  [/(clinic|dental|doctor|physio|diagnostic|lab\b|ca firm|chartered|account|law|legal|advocate|coaching|tuition|architect|insurance|real estate|realty|travel|consult|agency|office)/i, 'prof'],
  [/(kirana|grocery|salon|parlour|pharmacy|chemist|medical store|bakery|sweet|hardware|stationery|boutique|optic|mobile repair|shop|store|restaurant|cafe|dhaba)/i, 'micro'],
];

export function inferSegment(p: Profile): Segment | null {
  if (p.segment) return p.segment;
  const type = p.businessType?.trim();
  if (!type) return null;
  const exact = Object.entries(BUSINESS_TYPES).find(([k]) => k.toLowerCase() === type.toLowerCase());
  if (exact) return exact[1];
  for (const [re, seg] of SEGMENT_KEYWORDS) if (re.test(type)) return seg === 'micro' && (p.sites ?? 1) >= 3 ? 'multi' : seg;
  return null;
}

export function resolveTier(p: Profile): { tier: 1 | 2 | null; estimated: boolean } {
  if (p.city) {
    const hit = Object.entries(CITIES).find(([c]) => c.toLowerCase() === p.city!.trim().toLowerCase());
    if (hit) return { tier: hit[1].tier as 1 | 2, estimated: false };
  }
  if (p.cityTier) return { tier: p.cityTier, estimated: !!p.tierEstimated || !!p.city };
  return { tier: null, estimated: false };
}

export type ProfileField = 'businessType' | 'employees' | 'sites' | 'city' | 'hasGstin';
export function missingFields(p: Profile): ProfileField[] {
  const m: ProfileField[] = [];
  if (!inferSegment(p)) m.push('businessType');
  if (p.employees == null) m.push('employees');
  if (p.sites == null) m.push('sites');
  if (!p.city && !p.cityTier) m.push('city');
  if (p.hasGstin == null) m.push('hasGstin');
  return m;
}

export type Eligibility = { ok: boolean; reasons: string[] };
export function checkEligibility(prod: Product, p: Profile): Eligibility {
  const reasons: string[] = [];
  const { tier } = resolveTier(p);
  if (tier && !prod.tiers.includes(tier)) reasons.push(`${prod.name} is only sold in Tier ${prod.tiers.join(' and ')} cities${p.city ? `, and ${p.city} is Tier ${tier}` : ''}.`);
  if ((p.employees ?? 1) < prod.minEmployees) reasons.push(`${prod.name} needs at least ${prod.minEmployees} employees; you have ${p.employees ?? 1}.`);
  if ((p.sites ?? 1) < prod.minSites) reasons.push(`${prod.name} needs at least ${prod.minSites} sites; you have ${p.sites ?? 1}.`);
  if (prod.requiresGstin && p.hasGstin === false) reasons.push(`${prod.name} needs a valid, active GSTIN.`);
  return { ok: reasons.length === 0, reasons };
}

const ALTERNATIVES: Record<string, string[]> = {
  P03: ['P02'], P05: ['P03', 'P02'], P06: ['P05', 'P03', 'P02'], P10: ['P09'], P21: ['P20'], P15: ['P18'],
  P14: ['P18'], P12: ['P08'], P13: ['P07'], P24: ['P25'], P08: ['P07'], P02: ['P01'],
};

type Ctx = { p: Profile; seg: Segment; sites: number; employees: number };

function pickBaseLink(ctx: Ctx): { id: string; reason: string; exclusions: Exclusion[] } {
  const { p, seg, employees } = ctx;
  const needs = new Set(p.needs ?? []);
  const exclusions: Exclusion[] = [];
  const tryLink = (id: string, reason: string) => {
    const e = checkEligibility(product(id), p);
    if (e.ok) return { id, reason };
    exclusions.push({ productId: id, reason: e.reasons.join(' ') });
    return null;
  };
  const requested = (p.requestedProducts ?? []).find((id) => BASE_LINKS.includes(id));
  if (requested) {
    const r = tryLink(requested, 'You asked for this connection.');
    if (r) return { ...r, exclusions };
  }
  if (needs.has('dedicated') || (seg === 'mfg' && employees >= 10)) {
    const r = employees >= 50 ? tryLink('P06', 'Dedicated 100 Mbps with a 99.9% SLA suits a plant with 50+ people.') : null;
    const r2 = r ?? tryLink('P05', 'A dedicated 1:1 leased line with a 99.5% SLA keeps machines and billing online.');
    if (r2) return { ...r2, exclusions };
  }
  if (p.noFibre) {
    const r = tryLink('P04', 'Your site has no fibre, so 5G AirFiber is plug-and-play and installs in about 2 days.');
    if (r) return { ...r, exclusions };
  }
  if (seg === 'micro') return { id: 'P01', reason: '100 Mbps is plenty for UPI, POS and a few phones, at the lowest price.', exclusions };
  if (seg === 'prof' && employees >= 20) {
    const r = tryLink('P03', `With ${employees} people sharing the line, 1 Gbps with priority support avoids slowdowns.`);
    if (r) return { ...r, exclusions };
  }
  if (seg === 'multi') return { id: 'P02', reason: 'Fibre 300 at every site gives each outlet the same reliable speed under one bill.', exclusions };
  return { id: 'P02', reason: `300 Mbps handles video calls and cloud files for ${employees} people, with a static IP option.`, exclusions };
}

type NeedRule = { need: Need; id: string; qty: (c: Ctx) => number; reason: (c: Ctx, qty: number) => string };
const q = (p: Profile) => p.quantities ?? {};
const NEED_RULES: NeedRule[] = [
  { need: 'mobile', id: 'P07', qty: (c) => q(c.p).mobileLines ?? (c.seg === 'micro' ? 1 : Math.min(Math.max(2, c.sites), 5)), reason: (_, n) => `${n} business mobile line${n > 1 ? 's' : ''} with 50 GB and unlimited calls, on the same bill.` },
  { need: 'cctv', id: 'P23', qty: (c) => q(c.p).cameras ?? 2 * c.sites, reason: (c, n) => `${n} HD camera${n > 1 ? 's' : ''} with 30-day cloud recording you can watch from your phone${c.sites > 1 ? ', across all sites' : ''}.` },
  { need: 'pos', id: 'P19', qty: (c) => q(c.p).posCounters ?? c.sites, reason: () => 'GST-ready billing, inventory and UPI/card acceptance on one tablet.' },
  { need: 'whatsapp', id: 'P15', qty: () => 1, reason: () => 'A verified WhatsApp channel with your catalogue and 1,000 conversations a month.' },
  { need: 'sms', id: 'P14', qty: () => 1, reason: () => '10,000 SMS a month for reminders and offers; we help with DLT registration.' },
  { need: 'email', id: 'P16', qty: (c) => q(c.p).emailUsers ?? Math.min(c.employees, 50), reason: (_, n) => `Email on your own domain plus documents and video meetings for ${n} user${n > 1 ? 's' : ''}.` },
  { need: 'backup', id: 'P17', qty: () => 1, reason: () => 'Automatic 1 TB backup of PCs and phones, so records survive a crash or theft.' },
  { need: 'website', id: 'P18', qty: () => 1, reason: () => 'A 5-page website with domain, hosting and SSL so customers can find you.' },
  { need: 'security', id: 'P20', qty: (c) => q(c.p).devices ?? Math.min(c.employees, 50), reason: (_, n) => `Antivirus and ransomware protection for ${n} device${n > 1 ? 's' : ''}.` },
  { need: 'firewall', id: 'P21', qty: (c) => c.sites, reason: () => 'A next-gen firewall managed by the Accel security team.' },
  { need: 'wifi', id: 'P22', qty: (c) => c.sites, reason: () => 'Separate guest Wi-Fi for customers, so your billing network stays private.' },
  { need: 'failover', id: 'P09', qty: (c) => c.sites, reason: (c) => `Automatic 4G/5G backup keeps ${c.sites > 1 ? 'every site' : 'you'} online if the main line drops.` },
  { need: 'sdwan', id: 'P10', qty: (c) => c.sites, reason: (c) => `Manage all ${c.sites} sites' links centrally with app-priority routing.` },
  { need: 'static_ip', id: 'P11', qty: () => 1, reason: () => 'A fixed IP for remote CCTV viewing, servers or remote access.' },
  { need: 'telephony', id: 'P12', qty: (c) => q(c.p).voiceChannels ?? Math.max(2, Math.ceil(c.employees / 5)), reason: (_, n) => `Cloud phone lines with IVR and call recording (${n} channel${n > 1 ? 's' : ''}).` },
  { need: 'tollfree', id: 'P13', qty: () => 1, reason: () => 'An 1800 number routed to your mobiles or cloud phone lines.' },
  { need: 'iot', id: 'P24', qty: (c) => q(c.p).machines ?? 4, reason: (_, n) => `Sensors on ${n} machine${n > 1 ? 's' : ''} for uptime and energy use.` },
  { need: 'fleet', id: 'P25', qty: (c) => q(c.p).vehicles ?? 1, reason: (_, n) => `Live GPS tracking for ${n} vehicle${n > 1 ? 's' : ''}.` },
];

const STARTER: Record<Segment, Need[]> = {
  micro: ['internet', 'mobile', 'pos'],
  prof: ['internet', 'email', 'security', 'backup'],
  multi: ['internet', 'failover'],
  mfg: ['internet', 'firewall'],
};

export type Recommendation =
  | { status: 'need_info'; missing: ProfileField[] }
  | {
      status: 'ok';
      segment: Segment;
      lines: BundleLine[];
      exclusions: Exclusion[];
      notes: string[];
      partnerLed: boolean;
      quote: Quote;
      tierEstimated: boolean;
    };

export function recommend(input: Profile): Recommendation {
  const missing = missingFields(input);
  if (missing.length) return { status: 'need_info', missing };
  const seg = inferSegment(input)!;
  const { tier, estimated } = resolveTier(input);
  const p: Profile = { ...input, segment: seg, cityTier: tier };
  const ctx: Ctx = { p, seg, sites: Math.max(1, p.sites ?? 1), employees: Math.max(1, p.employees ?? 1) };
  const lines = new Map<string, BundleLine>();
  const exclusions: Exclusion[] = [];
  const notes: string[] = [];
  const declined = new Set(p.declinedProducts ?? []);

  const explicitNeeds = (p.needs ?? []).filter((n) => n !== 'internet');
  const needs = new Set<Need>(explicitNeeds.length ? p.needs : STARTER[seg]);
  if (!explicitNeeds.length) notes.push(`No specific needs given, so this is our ${SEGMENT_LABEL[seg].toLowerCase()} starter bundle.`);
  if (seg === 'mfg' && !explicitNeeds.length && !checkEligibility(product('P21'), p).ok) {
    needs.delete('firewall');
    needs.add('security');
  }

  const tryAdd = (id: string, qty: number, reason: string, depth = 0): boolean => {
    if (declined.has(id) || qty <= 0) return false;
    const prod = product(id);
    const e = checkEligibility(prod, p);
    if (!e.ok) {
      const alt = (ALTERNATIVES[id] ?? []).find((a) => !lines.has(a) && checkEligibility(product(a), p).ok);
      exclusions.push({ productId: id, reason: e.reasons.join(' '), alternative: alt });
      if (alt && depth < 2) tryAdd(alt, alt === 'P20' ? Math.min(ctx.employees, 50) : prod.unit === 'per site' ? ctx.sites : 1, `Offered instead of ${prod.name}: ${product(alt).description}.`, depth + 1);
      return false;
    }
    const existing = lines.get(id);
    lines.set(id, { productId: id, qty: Math.max(existing?.qty ?? 0, qty), reason: existing?.reason ?? reason });
    return true;
  };

  const needsLink = [...needs].some((n) => {
    const rule = NEED_RULES.find((r) => r.need === n);
    return n === 'internet' || n === 'dedicated' || (rule && product(rule.id).requiresOneOf.length > 0);
  }) || (p.requestedProducts ?? []).some((id) => BASE_LINKS.includes(id) || product(id).requiresOneOf.length);
  if (needsLink) {
    const base = pickBaseLink(ctx);
    exclusions.push(...base.exclusions.map((e) => ({ ...e, alternative: base.id })));
    lines.set(base.id, { productId: base.id, qty: ctx.sites, reason: base.reason });
  }

  for (const rule of NEED_RULES) if (needs.has(rule.need)) {
    const n = rule.qty(ctx);
    tryAdd(rule.id, n, rule.reason(ctx, n));
  }
  for (const id of p.requestedProducts ?? []) {
    if (lines.has(id) || BASE_LINKS.includes(id)) continue;
    const prod = product(id);
    tryAdd(id, prod.unit === 'per site' ? ctx.sites : 1, `You asked for ${prod.name}.`);
  }

  // Product dependencies: anything that needs a broadband link gets one.
  for (const line of [...lines.values()]) {
    const deps = product(line.productId).requiresOneOf;
    if (deps.length && !deps.some((d) => lines.has(d))) {
      const base = deps.find((d) => checkEligibility(product(d), p).ok);
      if (base) {
        lines.set(base, { productId: base, qty: ctx.sites, reason: `Added because ${product(line.productId).name} needs a broadband link.`, autoAdded: true });
      } else {
        lines.delete(line.productId);
        exclusions.push({ productId: line.productId, reason: `${product(line.productId).name} needs one of ${deps.map((d) => product(d).name).join(', ')}, and none are available for you.` });
      }
    }
  }

  // De-duplicate exclusions and drop any for products that ended up in the bundle.
  const seen = new Set<string>();
  const finalEx = exclusions.filter((e) => !lines.has(e.productId) && !seen.has(e.productId) && seen.add(e.productId));

  const list = sortLines([...lines.values()]);
  const quote = computeQuote(list);
  const partnerLed = list.some((l) => ['P05', 'P06', 'P10', 'P21'].includes(l.productId)) || ctx.sites >= 3;
  if (partnerLed) notes.push('This bundle needs a site survey, so a certified local partner will visit to install it. You still pay one monthly bill.');
  if (estimated) notes.push(`We have estimated ${p.city ?? 'your city'} as a Tier ${tier} city; availability is confirmed after the address check.`);
  if (p.hasGstin === false) notes.push('Without a GSTIN some business products are not available. Once you register for GST you can add them.');
  return { status: 'ok', segment: seg, lines: list, exclusions: finalEx, notes, partnerLed, quote, tierEstimated: estimated };
}

const CATEGORY_ORDER = ['Connectivity', 'Communication', 'Cloud & Productivity', 'Security', 'IoT & Physical'];
export function sortLines<T extends { productId: string }>(lines: T[]): T[] {
  return [...lines].sort((a, b) => {
    const pa = product(a.productId), pb = product(b.productId);
    const ca = CATEGORY_ORDER.indexOf(pa.category), cb = CATEGORY_ORDER.indexOf(pb.category);
    return ca - cb || pa.id.localeCompare(pb.id);
  });
}

export function computeQuote(lines: BundleLine[]): Quote {
  const rows = lines.map((l) => {
    const prod = product(l.productId);
    return { ...l, product: prod, monthly: prod.priceMin * l.qty, setup: prod.setupFee * l.qty };
  });
  return {
    lines: rows,
    monthly: rows.reduce((s, r) => s + r.monthly, 0),
    setup: rows.reduce((s, r) => s + r.setup, 0),
    contractMonths: rows.length ? Math.max(...rows.map((r) => r.product.minContractMonths)) : 0,
    maxInstallDays: rows.length ? Math.max(...rows.map((r) => r.product.installDays)) : 0,
  };
}

export type ToggleResult = { lines: BundleLine[]; messages: string[]; blocked?: string };

/** Turns an add-on on or off while enforcing eligibility and product dependencies. */
export function toggleProduct(lines: BundleLine[], id: string, on: boolean, profile: Profile, qty?: number): ToggleResult {
  const map = new Map(lines.map((l) => [l.productId, { ...l }]));
  const messages: string[] = [];
  const prod = product(id);
  const sites = Math.max(1, profile.sites ?? 1);
  if (on) {
    const e = checkEligibility(prod, profile);
    if (!e.ok) return { lines, messages: [], blocked: e.reasons.join(' ') };
    const defaultQty = prod.unit === 'per site' ? sites : prod.unit === 'per user' || prod.unit === 'per device' ? Math.min(profile.employees ?? 1, 50) : 1;
    map.set(id, { productId: id, qty: qty ?? map.get(id)?.qty ?? defaultQty, reason: map.get(id)?.reason ?? `Added by you: ${prod.description}.` });
    if (prod.requiresOneOf.length && !prod.requiresOneOf.some((d) => map.has(d))) {
      const base = prod.requiresOneOf.find((d) => checkEligibility(product(d), profile).ok);
      if (!base) return { lines, messages: [], blocked: `${prod.name} needs a broadband link that is not available for you.` };
      map.set(base, { productId: base, qty: sites, reason: `Added because ${prod.name} needs a broadband link.`, autoAdded: true });
      messages.push(`${product(base).name} was added because ${prod.name} needs it.`);
    }
  } else {
    map.delete(id);
    for (const l of [...map.values()]) {
      const deps = product(l.productId).requiresOneOf;
      if (deps.length && !deps.some((d) => map.has(d))) {
        map.delete(l.productId);
        messages.push(`${product(l.productId).name} was removed because it needs ${prod.name} or another broadband link.`);
      }
    }
  }
  return { lines: sortLines([...map.values()]), messages };
}

export function setQuantity(lines: BundleLine[], id: string, qty: number): BundleLine[] {
  return lines.map((l) => (l.productId === id ? { ...l, qty: Math.max(1, Math.min(qty, 200)) } : l));
}

export function addOnCandidates(profile: Profile) {
  const seg = inferSegment(profile);
  return PRODUCTS.map((prod) => ({ product: prod, eligibility: checkEligibility(prod, profile), targeted: !!seg && prod.segments.includes(seg) }));
}
