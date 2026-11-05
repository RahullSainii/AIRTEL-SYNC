import { verifyKyc } from '@/lib/kyc/verify';
import { getRegistry } from '@/lib/registry';
import { RegistryUnavailableError } from '@/lib/registry/types';
import { activeConsent, audit } from '@/lib/server/store';
import type { DocType, ExtractedDoc } from '@/lib/types';

// Only extracted fields arrive here; document images stay on the owner's device.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { consentId?: string; enteredGstin?: string; enteredUdyam?: string; docs?: Partial<Record<DocType, ExtractedDoc>> };
  if (!activeConsent(body.consentId)) return Response.json({ error: 'Consent is required before KYC.' }, { status: 403 });
  const registry = getRegistry();
  try {
    const verdict = await verifyKyc({ enteredGstin: body.enteredGstin, enteredUdyam: body.enteredUdyam, docs: body.docs ?? {} }, registry);
    const raised = verdict.checks.filter((c) => c.result !== 'pass').map((c) => c.id);
    audit('kyc.verdict', `${verdict.gstinUsed ?? 'no GSTIN'} -> ${verdict.status}${raised.length ? ` [${raised.join(', ')}]` : ''} (${verdict.ms} ms)`);
    return Response.json(verdict);
  } catch (err) {
    if (err instanceof RegistryUnavailableError) {
      audit('kyc.queued', 'registry unavailable; application queued for human review');
      return Response.json({ status: 'review', summary: 'The government registry is not responding. Your application is queued and a KYC agent will finish it.', checks: [], registry: { adapter: registry.id }, ms: 0 });
    }
    throw err;
  }
}
