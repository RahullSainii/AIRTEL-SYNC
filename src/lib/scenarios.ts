// Advisor eligibility scenarios. Run in the unit tests and live on the evidence page.
import { recommend, type Recommendation } from './engine.ts';
import type { Profile } from './types.ts';

type Ok = Extract<Recommendation, { status: 'ok' }>;
export type Scenario = { id: string; title: string; say: string; profile: Profile; expect: string; check: (r: Ok) => boolean };

const has = (r: Ok, id: string, qty?: number) => r.lines.some((l) => l.productId === id && (qty == null || l.qty === qty));
const blocked = (r: Ok, id: string, re?: RegExp) => !has(r, id) && r.exclusions.some((e) => e.productId === id && (!re || re.test(e.reason)));

export const SCENARIOS: Scenario[] = [
  { id: 'S01', title: 'Pharmacy wanting internet and CCTV', say: 'Pharmacy in Jaipur, 5 staff, GST, need internet and CCTV', profile: { businessType: 'Pharmacy', employees: 5, sites: 1, city: 'Jaipur', hasGstin: true, needs: ['internet', 'cctv'] },
    expect: 'Biz Fibre 100 + 2 CCTV cameras, ₹1,397/mo, ₹3,600 setup', check: (r) => has(r, 'P01', 1) && has(r, 'P23', 2) && r.quote.monthly === 1397 && r.quote.setup === 3600 },
  { id: 'S02', title: 'Professional office starter', say: 'CA firm in Pune, 5 people, GST registered', profile: { businessType: 'CA firm', employees: 5, sites: 1, city: 'Pune', hasGstin: true },
    expect: 'Fibre 300, 5 email seats, 5 endpoint licences, 1 TB backup: ₹3,118/mo', check: (r) => r.quote.monthly === 3118 && has(r, 'P16', 5) && has(r, 'P20', 5) },
  { id: 'S03', title: 'Micro retail starter', say: 'Kirana store in Indore, 2 people, GST', profile: { businessType: 'Kirana store', employees: 2, sites: 1, city: 'Indore', hasGstin: true },
    expect: 'Fibre 100, 1 business SIM, Cloud POS: ₹1,897/mo, ₹2,500 setup', check: (r) => r.quote.monthly === 1897 && r.quote.setup === 2500 },
  { id: 'S04', title: 'Three-site restaurant chain', say: '3 restaurants in Mumbai, 30 staff, GST', profile: { businessType: 'Restaurant chain', employees: 30, sites: 3, city: 'Mumbai', hasGstin: true },
    expect: 'Fibre 300 + failover at each site, ₹5,994/mo, partner-led install', check: (r) => has(r, 'P02', 3) && has(r, 'P09', 3) && r.quote.monthly === 5994 && r.partnerLed },
  { id: 'S05', title: 'Small manufacturer', say: 'Auto-parts unit in Pune, 15 workers, GST', profile: { businessType: 'Auto-parts unit', employees: 15, sites: 1, city: 'Pune', hasGstin: true },
    expect: 'Leased Line 20 + Managed Firewall, ₹9,999/mo, 24 months', check: (r) => has(r, 'P05') && has(r, 'P21') && r.quote.monthly === 9999 && r.quote.contractMonths === 24 },
  { id: 'S06', title: 'Fibre 1G asked for in a Tier 2 city', say: 'Dental clinic in Kochi, 8 staff, GST, I want Biz Fibre 1G', profile: { businessType: 'Dental clinic', employees: 8, sites: 1, city: 'Kochi', hasGstin: true, requestedProducts: ['P03'] },
    expect: 'Fibre 1G refused (Tier 1 only), Fibre 300 offered', check: (r) => blocked(r, 'P03', /Tier 1/) && has(r, 'P02') },
  { id: 'S07', title: 'WhatsApp API without a GSTIN', say: 'Salon in Lucknow, 3 staff, no GST, want WhatsApp for customers', profile: { businessType: 'Salon', employees: 3, sites: 1, city: 'Lucknow', hasGstin: false, needs: ['internet', 'whatsapp'] },
    expect: 'WhatsApp API refused (needs GSTIN), website offered instead', check: (r) => blocked(r, 'P15', /GSTIN/) && has(r, 'P18') },
  { id: 'S08', title: 'Leased line for a 6-person unit', say: 'Textile unit in Surat, 6 workers, GST, need a dedicated line', profile: { businessType: 'Textile unit', employees: 6, sites: 1, city: 'Surat', hasGstin: true, needs: ['dedicated'] },
    expect: 'Leased line refused (needs 10+ employees), fibre offered', check: (r) => blocked(r, 'P05', /10 employees/) && r.lines.some((l) => ['P02', 'P03'].includes(l.productId)) },
  { id: 'S09', title: 'SD-WAN for two sites', say: 'Gym chain in Delhi, 2 branches, 12 staff, GST, want SD-WAN', profile: { businessType: 'Gym chain', employees: 12, sites: 2, city: 'Delhi', hasGstin: true, needs: ['internet', 'sdwan'] },
    expect: 'SD-WAN refused (needs 3 sites), backup failover offered', check: (r) => blocked(r, 'P10', /3 sites/) && has(r, 'P09') },
  { id: 'S10', title: 'CCTV with no internet line', say: 'Hardware store in Patna, 2 staff, GST, only want CCTV', profile: { businessType: 'Hardware store', employees: 2, sites: 1, city: 'Patna', hasGstin: true, needs: ['cctv'] },
    expect: 'Broadband link added automatically because CCTV needs it', check: (r) => has(r, 'P23') && has(r, 'P01') },
  { id: 'S11', title: 'Only wants mobile lines', say: 'Boutique in Surat, 2 people, no GST, just 2 business SIMs', profile: { businessType: 'Boutique', employees: 2, sites: 1, city: 'Surat', hasGstin: false, needs: ['mobile'], quantities: { mobileLines: 2 } },
    expect: '2 × Business Postpaid 299 only, monthly contract', check: (r) => r.lines.length === 1 && has(r, 'P07', 2) && r.quote.contractMonths === 1 },
  { id: 'S12', title: 'Cloud telephony without GSTIN', say: 'Coaching centre in Bhopal, 8 staff, no GST, need IVR phone lines', profile: { businessType: 'Coaching centre', employees: 8, sites: 1, city: 'Bhopal', hasGstin: false, needs: ['internet', 'telephony'] },
    expect: 'Cloud telephony refused (GSTIN), Business Postpaid 599 offered', check: (r) => blocked(r, 'P12', /GSTIN/) && has(r, 'P08') },
  { id: 'S13', title: 'No fibre at the site', say: 'Physio clinic in Nashik, 4 staff, GST, fibre not available here', profile: { businessType: 'Physiotherapy clinic', employees: 4, sites: 1, city: 'Nashik', hasGstin: true, noFibre: true, needs: ['internet'] },
    expect: '5G AirFiber instead of fibre, installs in 2 days', check: (r) => has(r, 'P04') && !has(r, 'P02') && r.quote.maxInstallDays === 2 },
  { id: 'S14', title: 'Manufacturer without GSTIN', say: 'Food processing unit in Lucknow, 12 staff, no GST yet', profile: { businessType: 'Food processing unit', employees: 12, sites: 1, city: 'Lucknow', hasGstin: false },
    expect: 'Leased line refused (GSTIN); fibre and endpoint security instead', check: (r) => blocked(r, 'P05', /GSTIN/) && has(r, 'P02') && has(r, 'P20') && !has(r, 'P21') },
  { id: 'S15', title: 'Fleet tracking only', say: 'Packaging unit in Vadodara, 20 staff, GST, track our 4 vans', profile: { businessType: 'Packaging unit', employees: 20, sites: 1, city: 'Vadodara', hasGstin: true, needs: ['fleet'], quantities: { vehicles: 4 } },
    expect: '4 × Fleet Tracker, no broadband forced', check: (r) => has(r, 'P25', 4) && r.lines.length === 1 },
];

export function runScenario(s: Scenario) {
  const r = recommend(s.profile);
  return { scenario: s, rec: r, pass: r.status === 'ok' && s.check(r) };
}
