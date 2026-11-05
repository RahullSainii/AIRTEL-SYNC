import { audit, newId, store } from '@/lib/server/store';
import type { Language } from '@/lib/types';

const CONSENT_VERSION = 'kyc-consent-v1.2';
const ALLOWED = ['kyc_verification', 'registry_lookup', 'service_activation', 'partner_contact'];

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { purposes?: string[]; language?: Language };
  const purposes = (body.purposes ?? []).filter((p) => ALLOWED.includes(p));
  if (!purposes.includes('kyc_verification') || !purposes.includes('registry_lookup')) {
    return Response.json({ error: 'KYC verification and registry lookup consent are required to continue.' }, { status: 400 });
  }
  const consent = { id: newId('CNS'), at: new Date().toISOString(), version: CONSENT_VERSION, purposes, language: body.language ?? 'en', withdrawnAt: null };
  store.consents.set(consent.id, consent);
  audit('consent.granted', `${consent.id} ${consent.version} purposes=${purposes.join(',')}`);
  return Response.json(consent);
}

export async function GET() {
  return Response.json([...store.consents.values()].sort((a, b) => b.at.localeCompare(a.at)));
}
