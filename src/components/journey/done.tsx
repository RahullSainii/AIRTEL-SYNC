'use client';

import Link from 'next/link';
import { ArrowRight, PartyPopper } from 'lucide-react';
import { formatClock } from '@/lib/format';
import { useJourney } from './store';

export function DoneStep() {
  const { state, dispatch } = useJourney();
  const ms = state.startedAt && state.finishedAt ? state.finishedAt - state.startedAt : 0;
  const steps = [['advisor', 'Advisor'], ['quote', 'Quote'], ['kyc', 'KYC'], ['checkout', 'Checkout']] as const;
  const times = state.stepTimes;
  const bounds = [state.startedAt ?? times.advisor ?? 0, times.quote, times.kyc, times.checkout, state.finishedAt];
  return (
    <div className="mx-auto max-w-2xl animate-rise">
      <div className="card overflow-hidden text-center">
        <div className="bg-night px-6 py-10 text-white">
          <PartyPopper className="mx-auto size-10 text-brand" />
          <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight">Order placed</h1>
          <p className="mt-2 text-white/70">From first message to a verified, paid order in</p>
          <p className="mt-2 font-display text-6xl font-semibold num">{formatClock(ms)}</p>
          <p className="mt-1 text-xs text-white/50">Today this takes 17.6 days on average.</p>
        </div>
        <div className="grid grid-cols-4 divide-x divide-line border-b border-line">
          {steps.map(([k, label], i) => {
            const a = bounds[i], b = bounds[i + 1];
            return <div key={k} className="px-2 py-4"><div className="eyebrow">{label}</div><div className="mt-1 font-mono text-sm">{a && b ? formatClock(b - a) : '—'}</div></div>;
          })}
        </div>
        <div className="px-6 py-6">
          <p className="text-sm text-muted">Order reference</p>
          <p className="font-mono text-lg">{state.orderId}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link href={`/track/${state.orderId}`} className="btn btn-brand">Track your order<ArrowRight className="size-4" /></Link>
            <button type="button" className="btn btn-ghost" onClick={() => dispatch({ type: 'reset' })}>Start another business</button>
          </div>
        </div>
      </div>
    </div>
  );
}
