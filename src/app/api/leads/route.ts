import callList from '@/data/generated/call-list.json';

type Lead = (typeof callList)[number];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const segment = url.searchParams.get('segment');
  const module = url.searchParams.get('module');
  const gstin = url.searchParams.get('gstin');
  const q = url.searchParams.get('q')?.toLowerCase();
  const page = Math.max(0, Number(url.searchParams.get('page') ?? 0));
  const size = Math.min(100, Number(url.searchParams.get('size') ?? 25));
  let rows: Lead[] = callList;
  if (segment) rows = rows.filter((r) => r.segment === segment);
  if (module === 'addressable') rows = rows.filter((r) => r.module);
  else if (module) rows = rows.filter((r) => r.module === module);
  if (gstin === 'Y') rows = rows.filter((r) => r.gstin);
  if (q) rows = rows.filter((r) => r.business.toLowerCase().includes(q) || r.city.toLowerCase().includes(q) || r.type.toLowerCase().includes(q));
  return Response.json({ total: rows.length, page, size, rows: rows.slice(page * size, page * size + size) });
}
