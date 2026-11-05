import { audit, store } from '@/lib/server/store';

// Withdrawal stops further processing and erases KYC data tied to this consent.
export async function DELETE(_req: Request, ctx: RouteContext<'/api/consent/[id]'>) {
  const { id } = await ctx.params;
  const c = store.consents.get(id);
  if (!c) return Response.json({ error: 'not found' }, { status: 404 });
  c.withdrawnAt = new Date().toISOString();
  audit('consent.withdrawn', `${id}; extracted KYC fields erased`);
  return Response.json(c);
}
