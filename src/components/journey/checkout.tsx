'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, FileSignature, Loader2, Smartphone } from 'lucide-react';
import { computeQuote } from '@/lib/engine';
import { inr } from '@/lib/format';
import type { Order } from '@/lib/orders';
import { saveRun, useJourney } from './store';

const DEMO_OTP = '482913';

export function CheckoutStep() {
  const { state, dispatch } = useJourney();
  const quote = useMemo(() => computeQuote(state.lines), [state.lines]);
  const [phone, setPhone] = useState('98765 43210');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [signed, setSigned] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const due = quote.monthly + quote.setup;
  const phoneOk = phone.replace(/\D/g, '').length === 10;

  async function pay() {
    setPaying(true);
    setError(null);
    try {
      await new Promise((r) => setTimeout(r, 900)); // simulated UPI collect
      const seconds = state.startedAt ? (Date.now() - state.startedAt) / 1000 : null;
      const res = await fetch('/api/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consentId: state.consent?.id, profile: state.profile, lines: state.lines, kycStatus: state.verdict?.status, language: state.language, phone, onboardingSeconds: seconds }),
      });
      const order: Order | { error: string } = await res.json();
      if (!res.ok || 'error' in order) throw new Error('error' in order ? order.error : 'Order failed');
      const orders = JSON.parse(localStorage.getItem('udyam.orders.v1') ?? '{}');
      orders[order.id] = order;
      localStorage.setItem('udyam.orders.v1', JSON.stringify(orders));
      const finishedAt = Date.now();
      const steps = Object.fromEntries(Object.entries({ ...state.stepTimes, done: finishedAt }).map(([k, v]) => [k, v]));
      saveRun({ at: new Date().toISOString(), seconds: seconds ?? 0, steps, orderId: order.id, monthly: order.monthly, kyc: order.kycStatus, engine: state.messages.some((m) => m.engine === 'groq') ? 'groq' : 'fallback' });
      dispatch({ type: 'patch', patch: { orderId: order.id, finishedAt } });
      dispatch({ type: 'go', step: 'done' });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] animate-rise">
      <div className="space-y-6">
        <div>
          <button type="button" onClick={() => dispatch({ type: 'go', step: 'kyc' })} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" />Back to KYC</button>
          <p className="eyebrow mt-3">Checkout</p>
          <h1 className="mt-1 font-display text-3xl sm:text-4xl font-semibold tracking-tight">Sign and pay, all on your phone</h1>
        </div>

        <section className="card p-5">
          <h2 className="flex items-center gap-2 font-semibold"><Smartphone className="size-4" />Mobile for updates</h2>
          <p className="mt-1 text-sm text-muted">Order updates come on WhatsApp in your language, so you never need to call to chase.</p>
          <input className="input mt-3 max-w-xs font-mono" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} aria-label="Mobile number" />
        </section>

        <section className="card p-5">
          <h2 className="flex items-center gap-2 font-semibold"><FileSignature className="size-4" />E-sign the contract</h2>
          <p className="mt-1 text-sm text-muted">One agreement covers every product, signed with an Aadhaar OTP (simulated in this prototype).</p>
          {signed ? (
            <p className="mt-3 flex items-center gap-2 text-sm font-medium text-pass"><CheckCircle2 className="size-4" />Signed · {quote.contractMonths}-month agreement</p>
          ) : !otpSent ? (
            <button type="button" className="btn btn-primary mt-3" disabled={!phoneOk} onClick={() => { setOtpSent(true); setOtp(DEMO_OTP); }}>Send OTP</button>
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <input className="input w-36 font-mono tracking-[0.3em]" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} aria-label="OTP" />
              <button type="button" className="btn btn-primary" disabled={otp.length !== 6} onClick={() => setSigned(true)}>Verify and sign</button>
              <span className="text-xs text-muted">Demo OTP {DEMO_OTP} auto-filled</span>
            </div>
          )}
        </section>

        {error && <p className="rounded-xl bg-block-soft px-4 py-3 text-sm text-block">{error}</p>}
      </div>

      <aside className="xl:sticky xl:top-20 h-fit">
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-line">
            <p className="eyebrow">Order summary</p>
            <ul className="mt-3 space-y-1.5 text-sm">
              {quote.lines.map((l) => <li key={l.productId} className="flex justify-between gap-3"><span className="text-ink-2">{l.qty} × {l.product.name}</span><span className="num">{inr(l.monthly)}</span></li>)}
            </ul>
          </div>
          <dl className="px-5 py-4 space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Monthly</dt><dd className="num">{inr(quote.monthly)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">One-time setup</dt><dd className="num">{inr(quote.setup)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">KYC</dt><dd className={state.verdict?.status === 'verified' ? 'text-pass' : 'text-review'}>{state.verdict?.status === 'verified' ? 'Verified' : 'With agent'}</dd></div>
            <div className="flex justify-between border-t border-line pt-2 font-semibold"><dt>Pay now</dt><dd className="num">{inr(due)}</dd></div>
          </dl>
          <div className="p-4 pt-0">
            <button type="button" className="btn btn-brand w-full" disabled={!signed || paying || !phoneOk} onClick={pay}>
              {paying ? <><Loader2 className="size-4 animate-spin" />Waiting for UPI…</> : <>Pay {inr(due)} with UPI</>}
            </button>
            <p className="mt-2 text-center text-[11px] text-muted">Simulated payment. No money moves in this prototype.</p>
          </div>
        </div>
      </aside>
    </div>
  );
}
