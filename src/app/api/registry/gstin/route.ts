import { maskId } from '@/lib/format';
import { readGstin } from '@/lib/gstin';
import { getRegistry } from '@/lib/registry';
import { activeConsent, audit } from '@/lib/server/store';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { gstin?: string; consentId?: string };
  if (!activeConsent(body.consentId)) return Response.json({ error: 'Consent is required before a registry lookup.' }, { status: 403 });
  const registry = getRegistry();
  const parsed = readGstin(body.gstin ?? '');
  if (parsed.status === 'invalid') return Response.json({ ok: false, reason: parsed.reason, read: parsed.read });
  const record = await registry.lookupGstin(parsed.gstin);
  audit('registry.gstin', `${maskId(parsed.gstin)} -> ${record ? record.status : 'not found'} (consent ${body.consentId})`);
  if (!record) {
    const near = registry.nearestGstin ? await registry.nearestGstin(parsed.gstin) : null;
    return Response.json({ ok: false, reason: 'This GSTIN passes the checksum but is not in the GST registry.', near: near ? maskId(near.gstin) : null });
  }
  return Response.json({ ok: true, record, adapter: registry.id });
}
