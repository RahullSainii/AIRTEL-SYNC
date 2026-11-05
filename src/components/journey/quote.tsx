'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarClock, ChevronDown, Lock, Minus, Plus, ReceiptText, Wallet } from 'lucide-react';
import { product } from '@/lib/catalogue';
import { addOnCandidates, computeQuote, SEGMENT_LABEL, setQuantity, toggleProduct } from '@/lib/engine';
import { addDays, DEMO_TODAY, formatDate } from '@/lib/dates';
import { inr } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useJourney } from './store';

const CATEGORIES = ['Connectivity', 'Communication', 'Cloud & Productivity', 'Security', 'IoT & Physical'];

export function QuoteStep() {
  const { state, dispatch } = useJourney();
  const { profile, lines, language } = state;
  const [notice, setNotice] = useState<{ tone: 'info' | 'block'; text: string } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const quote = useMemo(() => computeQuote(lines), [lines]);
  const candidates = useMemo(() => addOnCandidates(profile), [profile]);
  const selected = new Set(lines.map((l) => l.productId));
  const seg = state.rec?.status === 'ok' ? state.rec.segment : null;

  function toggle(id: string, on: boolean) {
    const r = toggleProduct(lines, id, on, profile);
    if (r.blocked) { setNotice({ tone: 'block', text: r.blocked }); return; }
    dispatch({ type: 'patch', patch: { lines: r.lines } });
    setNotice(r.messages.length ? { tone: 'info', text: r.messages.join(' ') } : null);
  }

  const visible = candidates.filter((c) => !selected.has(c.product.id) && (showAll || (c.targeted && c.eligibility.ok)));
  const hiddenCount = candidates.filter((c) => !selected.has(c.product.id)).length - visible.length;
  const savings = profile.monthlySpend ? profile.monthlySpend - quote.monthly : null;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] animate-rise">
      <div className="space-y-6 min-w-0">
        <div>
          <button type="button" onClick={() => dispatch({ type: 'go', step: 'advisor' })} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" />Back to advisor</button>
          <p className="eyebrow">{seg ? SEGMENT_LABEL[seg] : 'Your bundle'}{profile.city ? ` · ${profile.city}` : ''}</p>
          <h1 className="mt-1 font-display text-3xl sm:text-4xl font-semibold tracking-tight">One bill. One price. No product codes.</h1>
          <p className="mt-2 text-muted max-w-xl">Switch add-ons on or off and the price updates instantly. Products you are not eligible for are locked, with the reason.</p>
        </div>

        {notice && (
          <div role="status" className={`rounded-xl px-4 py-3 text-sm ${notice.tone === 'block' ? 'bg-flag-soft text-flag' : 'bg-review-soft text-review'}`}>{notice.text}</div>
        )}

        <section className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-line">
            <h2 className="font-semibold">In your bundle</h2>
            <span className="text-xs text-muted">{lines.length} product{lines.length === 1 ? '' : 's'}</span>
          </div>
          {lines.length === 0 && <p className="px-5 py-8 text-center text-muted">Your bundle is empty. Add something below.</p>}
          <ul className="divide-y divide-line">
            {quote.lines.map((l) => (
              <li key={l.productId} className="flex flex-wrap sm:flex-nowrap items-center gap-x-4 gap-y-2 px-5 py-4">
                <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{l.product.name}</span>
                    {l.autoAdded && <span className="rounded-full bg-review-soft px-2 py-0.5 text-[11px] font-medium text-review">Needed by another product</span>}
                  </div>
                  <p className="mt-0.5 text-[13px] text-muted leading-snug">{l.reason}</p>
                  <p className="mt-1 text-[12px] text-muted num">{inr(l.product.priceMin)} {l.product.unit}{l.product.setupFee ? ` · ${inr(l.product.setupFee)} setup each` : ''} · ready in {l.product.installDays} day{l.product.installDays > 1 ? 's' : ''}</p>
                </div>
                <div className="flex items-center gap-1 rounded-full border border-line-2 bg-white p-0.5">
                  <button type="button" aria-label={`Fewer ${l.product.name}`} className="grid size-7 place-items-center rounded-full hover:bg-paper-2 disabled:opacity-30" disabled={l.qty <= 1}
                    onClick={() => dispatch({ type: 'patch', patch: { lines: setQuantity(lines, l.productId, l.qty - 1) } })}><Minus className="size-3.5" /></button>
                  <span className="w-7 text-center text-sm font-medium num">{l.qty}</span>
                  <button type="button" aria-label={`More ${l.product.name}`} className="grid size-7 place-items-center rounded-full hover:bg-paper-2"
                    onClick={() => dispatch({ type: 'patch', patch: { lines: setQuantity(lines, l.productId, l.qty + 1) } })}><Plus className="size-3.5" /></button>
                </div>
                <div className="w-24 text-right font-medium num">{inr(l.monthly)}</div>
                <Switch checked onChange={() => toggle(l.productId, false)} label={`Remove ${l.product.name}`} />
              </li>
            ))}
          </ul>
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-line">
            <h2 className="font-semibold">Add-ons</h2>
            <span className="text-xs text-muted">{showAll ? 'Full catalogue' : 'Suggested for you'}</span>
          </div>
          {CATEGORIES.map((cat) => {
            const items = visible.filter((c) => c.product.category === cat);
            if (!items.length) return null;
            return (
              <div key={cat} className="border-b border-line last:border-0">
                <div className="px-5 pt-3 eyebrow">{cat}</div>
                <ul>
                  {items.map(({ product: p, eligibility }) => (
                    <li key={p.id} className={`flex items-center gap-4 px-5 py-3 ${eligibility.ok ? '' : 'opacity-70'}`}>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 font-medium text-[15px]">{!eligibility.ok && <Lock className="size-3.5 text-muted" />}{p.name}</div>
                        <p className="text-[13px] text-muted leading-snug">{eligibility.ok ? p.description : eligibility.reasons.join(' ')}</p>
                      </div>
                      <div className="text-right text-sm num text-ink-2 shrink-0">{inr(p.priceMin)}<span className="block text-[11px] text-muted">{p.unit}</span></div>
                      <Switch checked={false} disabled={!eligibility.ok} onChange={() => toggle(p.id, true)} label={`Add ${p.name}`} />
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          <button type="button" onClick={() => setShowAll((v) => !v)} className="flex w-full items-center justify-center gap-1.5 py-3 text-sm font-medium text-ink-2 hover:bg-paper">
            {showAll ? 'Show suggestions only' : `Show all products (${hiddenCount} more, including locked)`}<ChevronDown className={`size-4 transition-transform ${showAll ? 'rotate-180' : ''}`} />
          </button>
        </section>
      </div>

      <aside className="xl:sticky xl:top-20 h-fit space-y-4">
        <div className="card overflow-hidden">
          <div className="bg-night px-5 py-5 text-white">
            <p className="text-xs text-white/60">Your monthly price</p>
            <p className="mt-1 font-display text-4xl font-semibold num">{inr(quote.monthly)}<span className="text-base font-normal text-white/60">{t('per_month', language)}</span></p>
            <p className="mt-1 text-xs text-white/60">Inclusive of all products below. GST extra as applicable.</p>
          </div>
          <dl className="divide-y divide-line text-sm">
            <Row icon={<Wallet className="size-4" />} label="One-time setup" value={inr(quote.setup)} />
            <Row icon={<ReceiptText className="size-4" />} label="Contract" value={quote.contractMonths ? `${quote.contractMonths} months` : '—'} />
            <Row icon={<CalendarClock className="size-4" />} label="Everything live by" value={quote.maxInstallDays ? formatDate(addDays(DEMO_TODAY, quote.maxInstallDays), { day: 'numeric', month: 'short', year: 'numeric' }) : '—'} />
            <Row label="Due today" value={inr(quote.monthly + quote.setup)} strong />
          </dl>
          {savings != null && (
            <p className={`mx-4 mb-4 rounded-xl px-3 py-2 text-[13px] ${savings >= 0 ? 'bg-pass-soft text-pass' : 'bg-paper-2 text-ink-2'}`}>
              {savings >= 0 ? `About ${inr(savings)} a month less than the ${inr(profile.monthlySpend!)} you spend today, with one bill and one support number.` : `${inr(-savings)} a month more than today, for more services on one bill and one support number.`}
            </p>
          )}
          <div className="p-4 pt-0">
            <button type="button" disabled={!lines.length} onClick={() => dispatch({ type: 'go', step: 'kyc' })} className="btn btn-brand w-full">{t('continue_kyc', language)}<ArrowRight className="size-4" /></button>
            <p className="mt-2 text-center text-[11px] text-muted">Prices are list prices from the Accel Business catalogue.</p>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Row({ icon, label, value, strong }: { icon?: React.ReactNode; label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between px-5 py-3">
      <dt className="flex items-center gap-2 text-muted">{icon}{label}</dt>
      <dd className={`num ${strong ? 'font-semibold text-ink' : 'text-ink-2'}`}>{value}</dd>
    </div>
  );
}

export function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange: () => void; disabled?: boolean; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={onChange}
      className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${checked ? 'bg-ink' : 'bg-line-2'} disabled:opacity-40`}>
      <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
    </button>
  );
}
