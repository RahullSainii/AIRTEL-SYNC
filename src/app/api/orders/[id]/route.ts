import type { Order } from '@/lib/orders';
import { audit, store } from '@/lib/server/store';

export async function GET(_req: Request, ctx: RouteContext<'/api/orders/[id]'>) {
  const { id } = await ctx.params;
  const order = store.orders.get(id);
  return order ? Response.json(order) : Response.json({ error: 'not found' }, { status: 404 });
}

// Demo control: advances the order one stage, as the field team would in production.
export async function PATCH(req: Request, ctx: RouteContext<'/api/orders/[id]'>) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { order?: Order };
  let order = store.orders.get(id) ?? (body.order?.id === id ? body.order : undefined);
  if (!order) return Response.json({ error: 'not found' }, { status: 404 });
  order = structuredClone(order);
  if (order.progress < order.stages.length) {
    const stage = order.stages[order.progress];
    stage.doneAt = stage.eta;
    order.progress += 1;
    order.updates.unshift({ at: new Date().toISOString(), text: `${stage.label}: done. ${stage.detail}` });
  }
  store.orders.set(id, order);
  audit('order.advanced', `${id} -> stage ${order.progress}`);
  return Response.json(order);
}
