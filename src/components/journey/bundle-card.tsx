'use client';

import { ArrowRight, Ban, Info, Sparkles } from 'lucide-react';
import { product } from '@/lib/catalogue';
import type { Recommendation } from '@/lib/engine';
import { inr } from '@/lib/format';
import { t } from '@/lib/i18n';
import type { Language } from '@/lib/types';

type Ok = Extract<Recommendation, { status: 'ok' }>;

export function BundleCard({ rec, language, onReview }: { rec: Ok; language: Language; onReview?: () => void }) {
  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-white shadow-[var(--shadow-card)] animate-rise">
      <div className="flex items-end justify-between gap-4 bg-night px-4 py-3.5 text-white">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-white/60"><Sparkles className="size-3" />Recommended bundle</div>
          <div className="mt-1 font-display text-2xl font-semibold num">{inr(rec.quote.monthly)}<span className="text-sm font-normal text-white/60">{t('per_month', language)}</span></div>
        </div>
        <div className="text-right text-xs text-white/70 leading-relaxed num">
          <div>{inr(rec.quote.setup)} {t('setup', language)}</div>
          <div>{rec.quote.contractMonths} {t('contract', language)}</div>
        </div>
      </div>
      <ul className="divide-y divide-line">
        {rec.lines.map((l) => {
          const p = product(l.productId);
          return (
            <li key={l.productId} className="flex items-start gap-3 px-4 py-3">
              <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-paper-2 font-mono text-[11px] font-medium text-ink-2">{l.qty}×</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium text-[15px]">{p.name}</span>
                  <span className="shrink-0 text-sm num text-ink-2">{inr(p.priceMin * l.qty)}</span>
                </div>
                <p className="mt-0.5 text-[13px] leading-snug text-muted">{l.reason}</p>
              </div>
            </li>
          );
        })}
      </ul>
      {rec.exclusions.length > 0 && (
        <div className="border-t border-line bg-paper/60 px-4 py-3 space-y-1.5">
          {rec.exclusions.map((e) => (
            <p key={e.productId} className="flex gap-2 text-[13px] text-ink-2"><Ban className="mt-0.5 size-3.5 shrink-0 text-flag" />
              <span><span className="font-medium">Not offered: {product(e.productId).name}.</span> {e.reason}{e.alternative ? ` Offered ${product(e.alternative).name} instead.` : ''}</span></p>
          ))}
        </div>
      )}
      {rec.notes.length > 0 && (
        <div className="border-t border-line px-4 py-3 space-y-1.5">
          {rec.notes.map((n) => <p key={n} className="flex gap-2 text-[13px] text-muted"><Info className="mt-0.5 size-3.5 shrink-0" />{n}</p>)}
        </div>
      )}
      {onReview && (
        <div className="border-t border-line p-3">
          <button type="button" onClick={onReview} className="btn btn-brand w-full">{t('review_quote', language)}<ArrowRight className="size-4" /></button>
        </div>
      )}
    </div>
  );
}
