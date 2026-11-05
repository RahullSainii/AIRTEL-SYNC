import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recommend, toggleProduct } from '../src/lib/engine.ts';
import type { Profile } from '../src/lib/types.ts';

const ok = (p: Profile) => {
  const r = recommend(p);
  assert.equal(r.status, 'ok');
  if (r.status !== 'ok') throw new Error('unreachable');
  return r;
};
const ids = (r: ReturnType<typeof ok>) => r.lines.map((l) => `${l.productId}x${l.qty}`).sort();

test('deck slide 3: professional office starter bundle is ₹3,118', () => {
  const r = ok({ businessType: 'CA firm', employees: 5, sites: 1, city: 'Pune', hasGstin: true });
  assert.deepEqual(ids(r), ['P02x1', 'P16x5', 'P17x1', 'P20x5']);
  assert.equal(r.quote.monthly, 3118);
  assert.equal(r.quote.setup, 0);
  assert.equal(r.quote.contractMonths, 12);
});

test('deck slide 3: micro retail starter is ₹1,897 with ₹2,500 setup', () => {
  const r = ok({ businessType: 'Kirana store', employees: 2, sites: 1, city: 'Indore', hasGstin: true });
  assert.equal(r.quote.monthly, 1897);
  assert.equal(r.quote.setup, 2500);
});

test('deck slide 3: 3-site chain is ₹5,994 with ₹4,500 setup and partner-led', () => {
  const r = ok({ businessType: 'Restaurant chain', employees: 30, sites: 3, city: 'Mumbai', hasGstin: true });
  assert.equal(r.quote.monthly, 5994);
  assert.equal(r.quote.setup, 4500);
  assert.ok(r.partnerLed);
});

test('deck slide 3: manufacturer gets leased line + firewall, ₹9,999, 24 months', () => {
  const r = ok({ businessType: 'Auto-parts unit', employees: 15, sites: 1, city: 'Pune', hasGstin: true });
  assert.deepEqual(ids(r), ['P05x1', 'P21x1']);
  assert.equal(r.quote.monthly, 9999);
  assert.equal(r.quote.setup, 14000);
  assert.equal(r.quote.contractMonths, 24);
});

test('deck slide 4: pharmacy with 5 staff wanting internet and CCTV is ₹1,397', () => {
  const r = ok({ businessType: 'Pharmacy', employees: 5, sites: 1, city: 'Jaipur', hasGstin: true, needs: ['internet', 'cctv'] });
  assert.equal(r.quote.monthly, 1397);
  assert.equal(r.quote.setup, 3600);
});

test('Fibre 1G is refused in a Tier 2 city and Fibre 300 offered', () => {
  const r = ok({ businessType: 'Dental clinic', employees: 8, sites: 1, city: 'Kochi', hasGstin: true, requestedProducts: ['P03'] });
  assert.ok(r.exclusions.some((e) => e.productId === 'P03' && /Tier 1/.test(e.reason)));
  assert.ok(r.lines.some((l) => l.productId === 'P02'));
});

test('WhatsApp API is not sold without a GSTIN; website offered instead', () => {
  const r = ok({ businessType: 'Salon', employees: 3, sites: 1, city: 'Lucknow', hasGstin: false, needs: ['internet', 'whatsapp'] });
  assert.ok(!r.lines.some((l) => l.productId === 'P15'));
  assert.ok(r.exclusions.some((e) => e.productId === 'P15' && /GSTIN/.test(e.reason)));
  assert.ok(r.lines.some((l) => l.productId === 'P18'));
});

test('leased line is refused under 10 employees', () => {
  const r = ok({ businessType: 'Textile unit', employees: 6, sites: 1, city: 'Surat', hasGstin: true, needs: ['dedicated'] });
  assert.ok(!r.lines.some((l) => l.productId === 'P05'));
  assert.ok(r.exclusions.some((e) => e.productId === 'P05'));
});

test('SD-WAN needs 3 sites', () => {
  const r = ok({ businessType: 'Gym chain', employees: 12, sites: 2, city: 'Delhi', hasGstin: true, needs: ['internet', 'sdwan'] });
  assert.ok(!r.lines.some((l) => l.productId === 'P10'));
  assert.ok(r.lines.some((l) => l.productId === 'P09'));
});

test('CCTV alone brings its required broadband link', () => {
  const r = ok({ businessType: 'Hardware store', employees: 2, sites: 1, city: 'Patna', hasGstin: true, needs: ['cctv'] });
  assert.ok(r.lines.some((l) => l.productId === 'P01'));
});

test('mobile-only request gets mobile lines without forcing broadband', () => {
  const r = ok({ businessType: 'Boutique', employees: 2, sites: 1, city: 'Surat', hasGstin: false, needs: ['mobile'], quantities: { mobileLines: 2 } });
  assert.deepEqual(ids(r), ['P07x2']);
});

test('missing information is asked for', () => {
  const r = recommend({ businessType: 'Bakery' });
  assert.equal(r.status, 'need_info');
});

test('toggling CCTV on with no link adds one; removing the link removes CCTV', () => {
  const profile: Profile = { businessType: 'Salon', employees: 3, sites: 1, city: 'Pune', hasGstin: true };
  const on = toggleProduct([], 'P23', true, profile);
  assert.ok(on.lines.some((l) => l.productId === 'P23'));
  const base = on.lines.find((l) => l.autoAdded)!;
  const off = toggleProduct(on.lines, base.productId, false, profile);
  assert.equal(off.lines.length, 0);
});

test('toggle refuses an ineligible product with the reason', () => {
  const r = toggleProduct([], 'P10', true, { businessType: 'Salon', employees: 3, sites: 1, city: 'Pune', hasGstin: true });
  assert.ok(r.blocked && /10 employees/.test(r.blocked));
});
