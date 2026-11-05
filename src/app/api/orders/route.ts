import { computeQuote, recommend } from '@/lib/engine';
import { buildStages, type Order } from '@/lib/orders';
import { activeConsent, audit, newId, partnerFor, store } from '@/lib/server/store';
import type { BundleLine, Language, Profile } from '@/lib/types';
import { DEMO_TODAY } from '@/lib/dates';
import { maskId } from '@/lib/format';
import { checkEligibility } from '@/lib/engine';
import { product } from '@/lib/catalogue';

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { consentId?: string; profile?: Profile; lines?: BundleLine[]; kycStatus?: 'verified' | 'review'; language?: Language; phone?: string; onboardingSeconds?: number };
  if (!activeConsent(b.consentId)) return Response.json({ error: 'Consent is required.' }, { status: 403 });
  if (b.kycStatus !== 'verified' && b.kycStatus !== 'review') return Response.json({ error: 'KYC must be verified or with an agent before checkout.' }, { status: 400 });
  const profile = b.profile ?? {};
  const lines = (b.lines ?? []).filter((l) => { try { return checkEligibility(product(l.productId), profile).ok && l.qty > 0; } catch { return false; } });
  if (!lines.length) return Response.json({ error: 'The bundle is empty.' }, { status: 400 });
  // Re-price on the server so the client cannot change prices.
  const quote = computeQuote(lines);
  const rec = recommend(profile);
  const partnerLed = rec.status === 'ok' ? rec.partnerLed || lines.some((l) => ['P05', 'P06', 'P10', 'P21'].includes(l.productId)) : false;
  const order: Order = {
    id: newId('UD'), createdAt: DEMO_TODAY, business: profile.businessName || profile.businessType || 'Your business', businessType: profile.businessType ?? null,
    segment: profile.segment ?? (rec.status === 'ok' ? rec.segment : null), city: profile.city ?? null, language: b.language ?? 'en', lines,
    monthly: quote.monthly, setup: quote.setup, contractMonths: quote.contractMonths, kycStatus: b.kycStatus, partnerLed,
    partner: partnerLed ? partnerFor(profile.city) : null, contactMasked: b.phone ? maskId(b.phone.replace(/\D/g, ''), 2, 3) : null,
    stages: buildStages(lines, partnerLed, b.kycStatus), progress: b.kycStatus === 'verified' ? 2 : 1,
    updates: [{ at: new Date().toISOString(), text: 'Order confirmed. We will send updates on WhatsApp in your language.' }],
    onboardingSeconds: typeof b.onboardingSeconds === 'number' ? Math.round(b.onboardingSeconds) : null,
    consentId: b.consentId ?? null,
  };
  store.orders.set(order.id, order);
  audit('order.created', `${order.id} ${quote.monthly}/mo kyc=${order.kycStatus}`);
  return Response.json(order);
}

export async function GET() {
  return Response.json([...store.orders.values()].reverse());
}
