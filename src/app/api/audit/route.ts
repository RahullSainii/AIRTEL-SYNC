import { store } from '@/lib/server/store';

export async function GET() {
  return Response.json(store.audit.slice(0, 200));
}
