'use client';

import { useEffect, useState } from 'react';
import { Bot, Building2, Check, Lock, MapPin, Receipt, Users } from 'lucide-react';
import { product } from '@/lib/catalogue';
import { inferSegment, missingFields, resolveTier, SEGMENT_LABEL } from '@/lib/engine';
import { inr } from '@/lib/format';
import { computeQuote } from '@/lib/engine';
import { useJourney } from './store';

type Status = { llm: { provider: string; model: string; live: { ok: boolean; status: number } | null } | null; registry: { id: string; label: string } };

export function InsightPanel() {
  const { state } = useJourney();
  const [status, setStatus] = useState<Status | null>(null);
  useEffect(() => { fetch('/api/status?check=1').then((r) => r.json()).then(setStatus).catch(() => undefined); }, []);
  const p = state.profile;
  const seg = inferSegment(p);
  const { tier, estimated } = resolveTier(p);
  const missing = new Set(missingFields(p));
  const lastAssistant = [...state.messages].reverse().find((m) => m.role === 'assistant' && m.engine);
  const quote = computeQuote(state.lines);
  const exclusions = state.rec?.status === 'ok' ? state.rec.exclusions : [];

  const rows: { icon: React.ReactNode; label: string; value: string | null; done: boolean }[] = [
    { icon: <Building2 className="size-3.5" />, label: 'Business', value: p.businessType ? `${p.businessType}${seg ? ` · ${SEGMENT_LABEL[seg]}` : ''}` : null, done: !missing.has('businessType') },
    { icon: <Users className="size-3.5" />, label: 'People', value: p.employees != null ? String(p.employees) : null, done: !missing.has('employees') },
    { icon: <MapPin className="size-3.5" />, label: 'Sites', value: p.sites != null ? String(p.sites) : null, done: !missing.has('sites') },
    { icon: <MapPin className="size-3.5" />, label: 'City', value: p.city ? `${p.city}${tier ? ` · Tier ${tier}${estimated ? ' (est.)' : ''}` : ''}` : null, done: !missing.has('city') },
    { icon: <Receipt className="size-3.5" />, label: 'GSTIN', value: p.hasGstin == null ? null : p.hasGstin ? 'Registered' : 'Not registered', done: !missing.has('hasGstin') },
  ];

  return (
    <div className="sticky top-20 space-y-4">
      <section className="card p-4">
        <h2 className="eyebrow">What the advisor understood</h2>
        <ul className="mt-3 space-y-2">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center gap-2.5 text-sm">
              <span className={`grid size-5 place-items-center rounded-full ${r.done ? 'bg-pass text-white' : 'bg-paper-2 text-muted'}`}>{r.done ? <Check className="size-3" strokeWidth={3} /> : r.icon}</span>
              <span className="w-16 text-muted">{r.label}</span>
              <span className={`min-w-0 flex-1 truncate ${r.value ? 'text-ink' : 'text-muted/70 italic'}`}>{r.value ?? 'asking…'}</span>
            </li>
          ))}
        </ul>
        {!!p.needs?.length && <div className="mt-3 flex flex-wrap gap-1.5">{p.needs.map((n) => <span key={n} className="rounded-full bg-paper-2 px-2 py-0.5 text-[11px] text-ink-2">{n.replace('_', ' ')}</span>)}</div>}
      </section>

      <section className="card p-4">
        <h2 className="eyebrow">Decision engine</h2>
        <div className="mt-3 flex items-start gap-2.5 text-sm">
          <Bot className="mt-0.5 size-4 text-muted" />
          <div>
            <p>{!status ? 'Checking…' : status.llm?.live?.ok ? `${status.llm.provider} · ${status.llm.model}` : status.llm ? `Offline rules (${status.llm.provider} unreachable from this network)` : 'Offline rules (no LLM key)'}</p>
            <p className="text-xs text-muted">The LLM understands and explains. Eligibility and prices come from the catalogue rules engine, so the advisor cannot invent a price.</p>
            {lastAssistant && <p className="mt-1 font-mono text-[11px] text-muted">Last turn: {lastAssistant.engine} · {((lastAssistant.ms ?? 0) / 1000).toFixed(2)}s</p>}
          </div>
        </div>
        {state.lines.length > 0 && (
          <div className="mt-3 rounded-xl bg-paper px-3 py-2 text-sm flex justify-between"><span className="text-muted">Bundle</span><span className="num font-medium">{inr(quote.monthly)}/mo · {state.lines.length} items</span></div>
        )}
        {exclusions.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {exclusions.map((e) => <li key={e.productId} className="flex gap-2 text-[12px] text-ink-2"><Lock className="mt-0.5 size-3 shrink-0 text-flag" /><span><span className="font-medium">{product(e.productId).name}</span> blocked by rule</span></li>)}
          </ul>
        )}
      </section>

      <section className="card p-4">
        <h2 className="eyebrow">Privacy</h2>
        <ul className="mt-3 space-y-1.5 text-[13px] text-ink-2">
          <li className="flex gap-2"><Check className="mt-0.5 size-3.5 text-pass" />{state.consent ? `Consent ${state.consent.id} recorded` : 'No personal data collected yet'}</li>
          <li className="flex gap-2"><Check className="mt-0.5 size-3.5 text-pass" />Document images stay on this device</li>
          <li className="flex gap-2"><Check className="mt-0.5 size-3.5 text-pass" />IDs masked on screen and in logs</li>
          <li className="flex gap-2"><Check className="mt-0.5 size-3.5 text-pass" />{status?.registry.label ?? 'Registry'} via adapter</li>
        </ul>
      </section>
    </div>
  );
}
