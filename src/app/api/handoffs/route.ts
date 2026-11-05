import { computeQuote } from '@/lib/engine';
import { scoreProfile } from '@/lib/propensity';
import { audit, newId, partnerFor, store, type Handoff } from '@/lib/server/store';
import type { BundleLine, Language, Profile } from '@/lib/types';

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { profile?: Profile; lines?: BundleLine[]; reason?: string; language?: Language; transcript?: string[] };
  const profile = b.profile ?? {};
  const lines = b.lines ?? [];
  const h: Handoff = {
    id: newId('HO'), at: new Date().toISOString(), status: 'new', reason: (b.reason ?? 'Owner asked to talk to a person').slice(0, 200),
    business: profile.businessName || profile.businessType || 'Unnamed business', profile, lines, monthly: lines.length ? computeQuote(lines).monthly : 0,
    language: b.language ?? 'en', score: scoreProfile(profile, 'Website form'), partner: partnerFor(profile.city), city: profile.city ?? null,
    transcript: (b.transcript ?? []).slice(-12).map((t) => t.slice(0, 400)),
  };
  store.handoffs.set(h.id, h);
  audit('handoff.created', `${h.id} ${h.city ?? ''} score=${h.score.toFixed(3)}`);
  return Response.json(h);
}

export async function GET() {
  return Response.json([...store.handoffs.values()].sort((a, b) => b.score - a.score));
}

export async function PATCH(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { id?: string; status?: Handoff['status'] };
  const h = b.id ? store.handoffs.get(b.id) : undefined;
  if (!h || !b.status || !['new', 'accepted', 'won', 'lost'].includes(b.status)) return Response.json({ error: 'bad request' }, { status: 400 });
  h.status = b.status;
  audit('handoff.updated', `${h.id} -> ${h.status}`);
  return Response.json(h);
}
