'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { inr } from '@/lib/format';
import type { Order } from '@/lib/orders';

export function TrackLookup() {
  const router = useRouter();
  const [id, setId] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  useEffect(() => {
    try { setOrders(Object.values(JSON.parse(localStorage.getItem('udyam.orders.v1') ?? '{}') as Record<string, Order>).reverse()); } catch { /* ignore */ }
  }, []);
  return (
    <div className="mt-8 space-y-8">
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (id.trim()) router.push(`/track/${id.trim().toUpperCase()}`); }}>
        <input className="input font-mono uppercase" placeholder="UD-XXXXXXXX" value={id} onChange={(e) => setId(e.target.value)} aria-label="Order reference" />
        <button className="btn btn-primary" type="submit">Track</button>
      </form>
      {orders.length > 0 && (
        <section>
          <h2 className="eyebrow">Orders on this device</h2>
          <ul className="mt-3 card divide-y divide-line">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={`/track/${o.id}`} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-paper/60">
                  <div><p className="font-medium">{o.business}</p><p className="font-mono text-xs text-muted">{o.id} · {o.lines.length} products</p></div>
                  <div className="flex items-center gap-3 text-sm num">{inr(o.monthly)}/mo<ArrowRight className="size-4 text-muted" /></div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {orders.length === 0 && <p className="text-sm text-muted">No orders on this device yet. <Link href="/onboard" className="font-medium text-ink underline underline-offset-4">Start the owner journey</Link> to place one.</p>}
    </div>
  );
}
