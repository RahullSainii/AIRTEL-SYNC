import { product } from './catalogue.ts';
import { addDays, DEMO_TODAY } from './dates.ts';
import type { BundleLine, Language, Segment } from './types.ts';

export type OrderStage = { key: string; label: string; detail: string; eta: string; doneAt?: string | null };
export type Order = {
  id: string;
  createdAt: string;
  business: string;
  businessType: string | null;
  segment: Segment | null;
  city: string | null;
  language: Language;
  lines: BundleLine[];
  monthly: number;
  setup: number;
  contractMonths: number;
  kycStatus: 'verified' | 'review';
  partnerLed: boolean;
  partner: string | null;
  contactMasked: string | null;
  stages: OrderStage[];
  progress: number;
  updates: { at: string; text: string }[];
  onboardingSeconds: number | null;
  consentId: string | null;
};

export function buildStages(lines: BundleLine[], partnerLed: boolean, kycStatus: Order['kycStatus'], start = DEMO_TODAY): OrderStage[] {
  const maxInstall = Math.max(...lines.map((l) => product(l.productId).installDays));
  const stages: OrderStage[] = [
    { key: 'placed', label: 'Order placed', detail: 'Payment received and contract e-signed.', eta: start, doneAt: start },
    { key: 'kyc', label: 'KYC verified', detail: kycStatus === 'verified' ? 'Documents matched the GST and Udyam registries.' : 'A KYC agent is checking one document (within 2 working hours).', eta: start, doneAt: kycStatus === 'verified' ? start : null },
  ];
  if (partnerLed) stages.push({ key: 'survey', label: 'Site survey', detail: 'A certified local partner checks the site and confirms the install plan.', eta: addDays(start, 2) });
  stages.push({ key: 'dispatch', label: 'Equipment dispatched', detail: 'Router, SIMs and devices are on the way.', eta: addDays(start, Math.min(2, maxInstall)) });
  stages.push({ key: 'install', label: 'Installation', detail: 'Technician visit to set everything up.', eta: addDays(start, maxInstall) });
  stages.push({ key: 'live', label: 'All services live', detail: 'One bill, one support number: 1800-ACCEL-BIZ.', eta: addDays(start, maxInstall) });
  return stages;
}

export function productEtas(order: Pick<Order, 'lines' | 'createdAt'>) {
  return order.lines.map((l) => {
    const p = product(l.productId);
    return { productId: l.productId, name: p.name, qty: l.qty, installDays: p.installDays, eta: addDays(order.createdAt, p.installDays) };
  });
}
