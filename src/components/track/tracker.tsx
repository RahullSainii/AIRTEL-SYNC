'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Check, Clock3, FastForward, Headset, MessageCircle, ShieldOff, Wrench } from 'lucide-react';
import { formatDate } from '@/lib/dates';
import { inr } from '@/lib/format';
import { productEtas, type Order } from '@/lib/orders';

const LOCAL = 'udyam.orders.v1';
const readLocal = (id: string): Order | null => { try { return JSON.parse(localStorage.getItem(LOCAL) ?? '{}')[id] ?? null; } catch { return null; } };
const writeLocal = (o: Order) => { try { const all = JSON.parse(localStorage.getItem(LOCAL) ?? '{}'); all[o.id] = o; localStorage.setItem(LOCAL, JSON.stringify(all)); } catch { /* ignore */ } };

export function Tracker({ id }: { id: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'missing'>('loading');
  const [busy, setBusy] = useState(false);
  const [withdrawn, setWithdrawn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/orders/${id}`).then(async (r) => {
      const o: Order | null = r.ok ? await r.json() : readLocal(id);
      if (cancelled) return;
      if (o) { setOrder(o); setState('ok'); writeLocal(o); } else setState('missing');
    }).catch(() => { const o = readLocal(id); setOrder(o); setState(o ? 'ok' : 'missing'); });
    return () => { cancelled = true; };
  }, [id]);

  async function advance() {
    if (!order) return;
    setBusy(true);
    const r = await fetch(`/api/orders/${order.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order }) });
    if (r.ok) { const o = await r.json(); setOrder(o); writeLocal(o); }
    setBusy(false);
  }

  if (state === 'loading') return <main className="mx-auto max-w-5xl px-5 py-16 text-muted">Loading order…</main>;
  if (!order) return (
    <main className="mx-auto max-w-xl px-5 py-16 text-center">
      <h1 className="font-display text-3xl font-semibold">Order not found</h1>
      <p className="mt-2 text-muted">We could not find {id}. Check the reference in your WhatsApp message.</p>
      <Link href="/track" className="btn btn-primary mt-6">Try another reference</Link>
    </main>
  );

  const current = order.stages[order.progress] ?? null;
  const live = order.progress >= order.stages.length;
  const etas = productEtas(order);
  const goLive = order.stages[order.stages.length - 1].eta;

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Order {order.id}</p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">{order.business}</h1>
          <p className="mt-1 text-muted">{order.lines.length} products · {inr(order.monthly)}/month · {order.contractMonths}-month contract{order.city ? ` · ${order.city}` : ''}</p>
        </div>
        <div className={`rounded-2xl px-5 py-3 ${live ? 'bg-pass text-white' : 'bg-night text-white'}`}>
          <p className="text-xs opacity-70">{live ? 'Status' : 'Everything live by'}</p>
          <p className="font-display text-2xl font-semibold">{live ? 'All services live' : formatDate(goLive, { weekday: 'short', day: 'numeric', month: 'short' })}</p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Progress</h2>
            <button type="button" onClick={advance} disabled={busy || live} className="btn btn-ghost btn-sm" title="Demo control: simulates the next field update">
              <FastForward className="size-4" />Simulate next update
            </button>
          </div>
          <ol className="mt-6 space-y-0">
            {order.stages.map((s, i) => {
              const done = i < order.progress;
              const now = i === order.progress;
              return (
                <li key={s.key} className="relative flex gap-4 pb-7 last:pb-0">
                  {i < order.stages.length - 1 && <span className={`absolute left-[15px] top-8 bottom-0 w-0.5 ${done ? 'bg-pass' : 'bg-line'}`} aria-hidden />}
                  <span className={`relative z-10 grid size-8 shrink-0 place-items-center rounded-full border-2 ${done ? 'border-pass bg-pass text-white' : now ? 'border-ink bg-white text-ink' : 'border-line-2 bg-white text-muted'}`}>
                    {done ? <Check className="size-4" strokeWidth={3} /> : now ? <Clock3 className="size-4" /> : <span className="size-1.5 rounded-full bg-current" />}
                  </span>
                  <div className="min-w-0 flex-1 pt-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className={`font-medium ${!done && !now ? 'text-muted' : ''}`}>{s.label}{now && <span className="ml-2 rounded-full bg-ink px-2 py-0.5 text-[11px] font-semibold text-white">In progress</span>}</p>
                      <p className="text-sm text-muted num">{done ? 'Done ' : 'Expected '}{formatDate(s.doneAt ?? s.eta, { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                    </div>
                    <p className="mt-0.5 text-sm text-muted">{s.key === 'survey' && order.partner ? `${order.partner} will visit to confirm the install plan.` : s.detail}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <div className="space-y-6">
          <section className="card overflow-hidden">
            <div className="flex items-center gap-2 border-b border-line bg-[#e7f6ec] px-4 py-3 text-sm font-medium text-[#106b3a]"><MessageCircle className="size-4" />WhatsApp updates</div>
            <ul className="space-y-2 bg-[#efeae2] p-4">
              {order.updates.map((u, i) => (
                <li key={i} className="max-w-[90%] rounded-xl rounded-tl-sm bg-white px-3 py-2 text-[13px] shadow-sm">
                  {u.text}
                  <span className="mt-1 block text-right text-[10px] text-muted">{new Date(u.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card p-5">
            <h2 className="flex items-center gap-2 font-semibold"><Wrench className="size-4" />Each product</h2>
            <ul className="mt-3 divide-y divide-line text-sm">
              {etas.map((e) => (
                <li key={e.productId} className="flex justify-between gap-3 py-2">
                  <span>{e.qty} × {e.name}</span>
                  <span className={`shrink-0 num ${live ? 'text-pass font-medium' : 'text-muted'}`}>{live ? 'Live' : `By ${formatDate(e.eta)}`}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card p-5 text-sm">
            <h2 className="flex items-center gap-2 font-semibold"><Headset className="size-4" />One support number</h2>
            <p className="mt-1 text-muted">1800-ACCEL-BIZ for every product on this order{order.partner ? `. Installation by ${order.partner}.` : '.'}</p>
            {current && <p className="mt-3 rounded-xl bg-paper px-3 py-2 text-ink-2">Next: <span className="font-medium">{current.label}</span>, expected {formatDate(current.eta, { weekday: 'long', day: 'numeric', month: 'short' })}. No need to call; we will message you.</p>}
            <button type="button" disabled={withdrawn || !order.consentId} onClick={async () => {
              if (!confirm('Withdraw consent? We will stop processing your KYC data and erase it, except what the telecom licence requires us to keep for an active contract.')) return;
              const r = await fetch(`/api/consent/${order.consentId}`, { method: 'DELETE' });
              if (r.ok) setWithdrawn(true);
            }} className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted hover:text-block disabled:text-block">
              <ShieldOff className="size-3.5" />{withdrawn ? 'Consent withdrawn. Processing stopped and KYC fields erased; licence-mandated records are kept only as long as the law requires.' : 'Withdraw consent and erase my KYC data'}
            </button>
          </section>
        </div>
      </div>
    </main>
  );
}
