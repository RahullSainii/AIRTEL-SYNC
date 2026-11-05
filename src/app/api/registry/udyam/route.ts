import { maskId } from '@/lib/format';
import { normaliseUdyam, UDYAM_FORMAT } from '@/lib/gstin';
import { getRegistry } from '@/lib/registry';
import { activeConsent, audit } from '@/lib/server/store';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { udyam?: string; consentId?: string };
  if (!activeConsent(body.consentId)) return Response.json({ error: 'Consent is required before a registry lookup.' }, { status: 403 });
  const n = normaliseUdyam(body.udyam ?? '');
  if (!UDYAM_FORMAT.test(n)) return Response.json({ ok: false, reason: 'Udyam numbers look like UDYAM-MH-00-1234567.' });
  const record = await getRegistry().lookupUdyam(n);
  audit('registry.udyam', `${maskId(n, 9, 3)} -> ${record ? 'found' : 'not found'}`);
  return record ? Response.json({ ok: true, record }) : Response.json({ ok: false, reason: 'This Udyam number is not in the Udyam registry.' });
}
