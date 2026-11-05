'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, Flame, Phone, RefreshCw, Search } from 'lucide-react';
import type { ANALYTICS } from '@/data/generated/analytics';
import { product } from '@/lib/catalogue';
import { SEGMENT_LABEL } from '@/lib/engine';
import { inr, pct } from '@/lib/format';
import { languageLabel } from '@/lib/languages';
import type { Order } from '@/lib/orders';
import { scoreBand } from '@/lib/propensity';
import type { Language, Segment } from '@/lib/types';

type Analytics = typeof ANALYTICS;
type Model = { testAuc: number; topQuintileRate: number; baseRate: number; trainSize: number; testSize: number };
type Handoff = { id: string; at: string; status: 'new' | 'accepted' | 'won' | 'lost'; reason: string; business: string; lines: { productId: string; qty: number }[]; monthly: number; language: Language; score: number; partner: string; city: string | null; transcript: string[]; profile: { businessType?: string; employees?: number; sites?: number; hasGstin?: boolean } };
type Lead = { id: string; business: string; type: string; segment: Segment; city: string; tier: number; language: string; employees: number; sites: number; gstin: boolean; gstinMasked: string; source: string; stage: string; dropReason: string; interest: string; contact: string; role: string; spend: number; score: number; module: string | null };

const TABS = ['Handoff queue', 'Call list', 'Funnel insights', 'Orders', 'Consent & audit'] as const;
type Tab = (typeof TABS)[number];

export function PartnerDesk({ analytics, model }: { analytics: Analytics; model: Model }) {
  const [tab, setTab] = useState<Tab>('Handoff queue');
  return (
    <main className="mx-auto max-w-7xl px-5 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Back office · field sales and channel partners</p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">Partner desk</h1>
          <p className="mt-2 max-w-2xl text-muted">The digital journey feeds the field force instead of competing with it: leads the advisor could not close, bundles that need a site survey, and a ranked call list built from last quarter’s leads.</p>
        </div>
      </div>
      <div className="mt-8 flex gap-1 overflow-x-auto border-b border-line" role="tablist">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${tab === t ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink'}`}>{t}</button>
        ))}
      </div>
      <div className="pt-6">
        {tab === 'Handoff queue' && <HandoffQueue />}
        {tab === 'Call list' && <CallList model={model} />}
        {tab === 'Funnel insights' && <Funnel a={analytics} />}
        {tab === 'Orders' && <Orders />}
        {tab === 'Consent & audit' && <Audit />}
      </div>
    </main>
  );
}

function ScorePill({ score }: { score: number }) {
  const b = scoreBand(score);
  const cls = b.tone === 'high' ? 'bg-brand text-white' : b.tone === 'mid' ? 'bg-flag-soft text-flag' : 'bg-paper-2 text-ink-2';
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold num ${cls}`}>{b.tone === 'high' && <Flame className="size-3" />}{b.label} · {pct(score)}</span>;
}

function useJson<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const load = useCallback(() => { fetch(url).then((r) => r.json()).then(setData).catch(() => setData(null)); }, [url]);
  useEffect(() => { load(); }, [load]);
  return { data, reload: load };
}

function HandoffQueue() {
  const { data, reload } = useJson<Handoff[]>('/api/handoffs');
  const [open, setOpen] = useState<string | null>(null);
  async function setStatus(id: string, status: Handoff['status']) {
    await fetch('/api/handoffs', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
    reload();
  }
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted">Owners who asked for a person in the advisor chat, sorted by call priority. Each arrives with the transcript and draft quote.</p>
        <button type="button" onClick={reload} className="btn btn-ghost btn-sm"><RefreshCw className="size-3.5" />Refresh</button>
      </div>
      {!data?.length ? (
        <div className="card px-6 py-12 text-center">
          <p className="font-medium">No handoffs yet</p>
          <p className="mt-1 text-sm text-muted">Open the owner journey and tap “Talk to a person”. The lead appears here instantly.</p>
        </div>
      ) : (
        <ul className="card divide-y divide-line">
          {data.map((h) => (
            <li key={h.id}>
              <button type="button" onClick={() => setOpen(open === h.id ? null : h.id)} className="flex w-full flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4 text-left hover:bg-paper/60">
                <div className="min-w-0 flex-1 basis-56">
                  <p className="font-medium">{h.business}</p>
                  <p className="text-xs text-muted">{h.city ?? 'City unknown'} · {languageLabel(h.language)} · {h.reason}</p>
                </div>
                <ScorePill score={h.score} />
                <span className="text-sm num">{h.monthly ? `${inr(h.monthly)}/mo draft` : 'No quote yet'}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${h.status === 'new' ? 'bg-review-soft text-review' : h.status === 'won' ? 'bg-pass-soft text-pass' : h.status === 'lost' ? 'bg-block-soft text-block' : 'bg-paper-2 text-ink-2'}`}>{h.status}</span>
                <ChevronDown className={`size-4 text-muted transition-transform ${open === h.id ? 'rotate-180' : ''}`} />
              </button>
              {open === h.id && (
                <div className="grid gap-6 border-t border-line bg-paper/40 px-5 py-4 md:grid-cols-2">
                  <div className="text-sm">
                    <p className="eyebrow">Assigned partner</p>
                    <p className="mt-1">{h.partner}</p>
                    <p className="eyebrow mt-4">Draft bundle</p>
                    <ul className="mt-1 space-y-0.5">{h.lines.length ? h.lines.map((l) => <li key={l.productId}>{l.qty} × {product(l.productId).name}</li>) : <li className="text-muted">Advisor had not reached a bundle.</li>}</ul>
                    <div className="mt-4 flex gap-2">
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => setStatus(h.id, 'accepted')}><Phone className="size-3.5" />Accept and call</button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStatus(h.id, 'won')}>Mark won</button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStatus(h.id, 'lost')}>Mark lost</button>
                    </div>
                  </div>
                  <div>
                    <p className="eyebrow">Transcript</p>
                    <div className="mt-1 max-h-56 space-y-1 overflow-y-auto rounded-xl bg-white p-3 text-[13px]">{h.transcript.length ? h.transcript.map((t, i) => <p key={i} className={t.startsWith('Owner') ? 'text-ink' : 'text-muted'}>{t}</p>) : <p className="text-muted">No messages.</p>}</div>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CallList({ model }: { model: Model }) {
  const [segment, setSegment] = useState('');
  const [module, setModule] = useState('addressable');
  const [gstin, setGstin] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const params = new URLSearchParams({ page: String(page), size: '20', ...(segment && { segment }), ...(module && { module }), ...(gstin && { gstin }), ...(q && { q }) });
  const { data } = useJson<{ total: number; rows: Lead[] }>(`/api/leads?${params}`);
  return (
    <section className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card p-5"><p className="text-sm text-muted">Model hold-out AUC</p><p className="mt-1 font-display text-3xl font-semibold num">{model.testAuc}</p><p className="text-xs text-muted">Logistic regression on lead-time features only; {model.trainSize.toLocaleString('en-IN')} train / {model.testSize.toLocaleString('en-IN')} test.</p></div>
        <div className="card p-5"><p className="text-sm text-muted">Top 20% by score activate at</p><p className="mt-1 font-display text-3xl font-semibold num">{pct(model.topQuintileRate)}</p><p className="text-xs text-muted">vs {pct(model.baseRate)} for all leads: {(model.topQuintileRate / model.baseRate).toFixed(1)}× lift. Call these first.</p></div>
        <div className="card p-5"><p className="text-sm text-muted">What the model learned</p><p className="mt-1 text-sm leading-relaxed">Up: GSTIN on file, referrals, professional offices, Tier 1 cities. Down: website-form and WhatsApp-campaign leads, which activate at only 4.3% and 2.8% today. Those are the leads a self-serve journey is built to rescue.</p></div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex-1 min-w-[220px]"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" /><input className="input pl-9" placeholder="Search business, type or city" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} /></label>
        <select className="input w-auto" value={segment} onChange={(e) => { setSegment(e.target.value); setPage(0); }} aria-label="Segment"><option value="">All segments</option>{Object.entries(SEGMENT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select className="input w-auto" value={module} onChange={(e) => { setModule(e.target.value); setPage(0); }} aria-label="Drop reason"><option value="addressable">Lost to fixable causes</option><option value="">All dropped leads</option><option>Field-visit scheduling</option><option>Complex or slow quotes</option><option>Paperwork delays</option><option>Install delays</option></select>
        <select className="input w-auto" value={gstin} onChange={(e) => { setGstin(e.target.value); setPage(0); }} aria-label="GSTIN"><option value="">Any GSTIN</option><option value="Y">Has GSTIN</option></select>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead><tr className="border-b border-line text-left text-xs text-muted"><th className="px-5 py-3 font-medium">Business</th><th className="px-3 py-3 font-medium">Segment</th><th className="px-3 py-3 font-medium">Language</th><th className="px-3 py-3 font-medium">Dropped at</th><th className="px-3 py-3 font-medium">Why</th><th className="px-3 py-3 font-medium">GSTIN</th><th className="px-5 py-3 font-medium text-right">Priority</th></tr></thead>
          <tbody className="divide-y divide-line">
            {data?.rows.map((l) => (
              <tr key={l.id}>
                <td className="px-5 py-3"><p className="font-medium">{l.business}</p><p className="text-xs text-muted">{l.type} · {l.city} · {l.employees} staff{l.sites > 1 ? ` · ${l.sites} sites` : ''}</p></td>
                <td className="px-3 py-3 text-ink-2">{SEGMENT_LABEL[l.segment]}</td>
                <td className="px-3 py-3 text-ink-2">{l.language}</td>
                <td className="px-3 py-3 text-ink-2">{l.stage}</td>
                <td className="px-3 py-3 text-ink-2">{l.dropReason}{l.module && <span className="mt-0.5 block text-[11px] text-pass">Fixed by: {l.module}</span>}</td>
                <td className="px-3 py-3 font-mono text-xs text-ink-2">{l.gstin ? l.gstinMasked : '—'}</td>
                <td className="px-5 py-3 text-right"><ScorePill score={l.score} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-line px-5 py-3 text-sm">
          <span className="text-muted">{data ? `${data.total.toLocaleString('en-IN')} leads` : 'Loading…'} · contact details masked</span>
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost btn-sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={!data || (page + 1) * 20 >= data.total} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Funnel({ a }: { a: Analytics }) {
  const max = a.funnel[0].count;
  const maxDrop = Math.max(...a.dropReasons.filter((d) => d.reason).map((d) => d.count));
  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <div className="card p-6">
        <h2 className="font-semibold">Acquisition funnel, Apr–Jun 2026</h2>
        <p className="text-sm text-muted">Steepest drop: needs assessed to quote accepted.</p>
        <ul className="mt-5 space-y-3">
          {a.funnel.map((f, i) => (
            <li key={f.stage}>
              <div className="flex justify-between text-sm"><span>{f.stage}</span><span className="num text-muted">{f.count.toLocaleString('en-IN')}{i > 0 && ` · ${pct(f.count / a.funnel[i - 1].count, 0)}`}</span></div>
              <div className="mt-1 h-2.5 rounded-full bg-paper-2"><div className={`h-full rounded-full ${i === 3 ? 'bg-brand' : 'bg-ink'}`} style={{ width: `${(f.count / max) * 100}%` }} /></div>
            </li>
          ))}
        </ul>
      </div>
      <div className="card p-6">
        <h2 className="font-semibold">Why leads dropped</h2>
        <p className="text-sm text-muted"><span className="inline-block size-2 rounded-full bg-brand align-middle" /> removed by the digital journey</p>
        <ul className="mt-5 space-y-2">
          {a.dropReasons.filter((d) => d.reason).slice(0, 12).map((d) => (
            <li key={d.reason} className="grid grid-cols-[1fr_auto] items-center gap-x-3 text-sm">
              <span className="truncate">{d.reason}</span><span className="num text-muted">{d.count}</span>
              <div className="col-span-2 mt-0.5 h-1.5 rounded-full bg-paper-2"><div className={`h-full rounded-full ${d.module ? 'bg-brand' : 'bg-line-2'}`} style={{ width: `${(d.count / maxDrop) * 100}%` }} /></div>
            </li>
          ))}
        </ul>
      </div>
      <div className="card p-6 lg:col-span-2 overflow-x-auto">
        <h2 className="font-semibold">Segments: where to play first</h2>
        <table className="mt-4 w-full min-w-[640px] text-sm">
          <thead><tr className="text-left text-xs text-muted"><th className="py-2 font-medium">Segment</th><th className="py-2 font-medium text-right">Leads</th><th className="py-2 font-medium text-right">Activation</th><th className="py-2 font-medium text-right">Avg bundle</th><th className="py-2 font-medium text-right">6-mo churn</th><th className="py-2 font-medium text-right">NPS</th><th className="py-2 font-medium text-right">Cost / activation</th></tr></thead>
          <tbody className="divide-y divide-line">
            {a.bySegment.map((s) => (
              <tr key={s.key}><td className="py-2.5">{s.key}</td><td className="py-2.5 text-right num">{s.leads.toLocaleString('en-IN')}</td><td className="py-2.5 text-right num font-medium">{pct(s.rate)}</td><td className="py-2.5 text-right num">{inr(s.avgBundle)}</td><td className="py-2.5 text-right num">{pct(s.churn)}</td><td className="py-2.5 text-right num">{s.nps}</td><td className="py-2.5 text-right num">{s.cacPerActivation ? inr(s.cacPerActivation) : '—'}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {a.byGstin.map((g) => <div key={g.key} className="rounded-xl bg-paper p-4"><p className="text-xs text-muted">{g.key === 'Y' ? 'With GSTIN' : 'Without GSTIN'}</p><p className="font-display text-2xl font-semibold num">{pct(g.rate)}</p><p className="text-xs text-muted">activate · {g.leads.toLocaleString('en-IN')} leads</p></div>)}
          <div className="rounded-xl bg-paper p-4"><p className="text-xs text-muted">Most leads speak</p><p className="font-display text-2xl font-semibold">{a.byLanguage[0].key}</p><p className="text-xs text-muted">{pct(a.byLanguage[0].leads / a.totalLeads, 0)} of leads; English {pct((a.byLanguage.find((l) => l.key === 'English')?.leads ?? 0) / a.totalLeads, 0)}</p></div>
        </div>
      </div>
    </section>
  );
}

function Orders() {
  const { data, reload } = useJson<Order[]>('/api/orders');
  return (
    <section>
      <div className="mb-4 flex justify-end"><button type="button" onClick={reload} className="btn btn-ghost btn-sm"><RefreshCw className="size-3.5" />Refresh</button></div>
      {!data?.length ? <div className="card px-6 py-12 text-center text-sm text-muted">No digital orders yet in this session.</div> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead><tr className="border-b border-line text-left text-xs text-muted"><th className="px-5 py-3 font-medium">Order</th><th className="px-3 py-3 font-medium">Business</th><th className="px-3 py-3 font-medium text-right">Monthly</th><th className="px-3 py-3 font-medium">KYC</th><th className="px-3 py-3 font-medium">Stage</th><th className="px-5 py-3 font-medium text-right">Onboarding time</th></tr></thead>
            <tbody className="divide-y divide-line">
              {data.map((o) => (
                <tr key={o.id}>
                  <td className="px-5 py-3 font-mono text-xs"><a className="underline underline-offset-4" href={`/track/${o.id}`}>{o.id}</a></td>
                  <td className="px-3 py-3">{o.business}<span className="block text-xs text-muted">{o.partner ?? 'Self-install'}</span></td>
                  <td className="px-3 py-3 text-right num">{inr(o.monthly)}</td>
                  <td className="px-3 py-3"><span className={o.kycStatus === 'verified' ? 'text-pass' : 'text-review'}>{o.kycStatus}</span></td>
                  <td className="px-3 py-3">{o.stages[Math.min(o.progress, o.stages.length - 1)].label}</td>
                  <td className="px-5 py-3 text-right font-mono">{o.onboardingSeconds != null ? `${Math.floor(o.onboardingSeconds / 60)}m ${o.onboardingSeconds % 60}s` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Audit() {
  const { data, reload } = useJson<{ at: string; event: string; detail: string }[]>('/api/audit');
  const { data: consents } = useJson<{ id: string; at: string; version: string; purposes: string[]; withdrawnAt?: string | null }[]>('/api/consent');
  return (
    <section className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
      <div className="card p-5">
        <h2 className="font-semibold">Consent records</h2>
        <p className="text-sm text-muted">Every registry lookup and KYC check must reference an active consent.</p>
        <ul className="mt-4 divide-y divide-line text-sm">
          {consents?.length ? consents.map((c) => (
            <li key={c.id} className="py-2.5">
              <div className="flex justify-between"><span className="font-mono text-xs">{c.id}</span><span className={c.withdrawnAt ? 'text-block text-xs' : 'text-pass text-xs'}>{c.withdrawnAt ? 'withdrawn' : 'active'}</span></div>
              <p className="text-xs text-muted">{new Date(c.at).toLocaleString('en-IN')} · {c.version} · {c.purposes.join(', ')}</p>
            </li>
          )) : <li className="py-4 text-muted">No consents recorded yet.</li>}
        </ul>
      </div>
      <div className="card p-5">
        <div className="flex items-center justify-between"><h2 className="font-semibold">Audit log</h2><button type="button" onClick={reload} className="btn btn-ghost btn-sm"><RefreshCw className="size-3.5" />Refresh</button></div>
        <p className="text-sm text-muted">Identifiers are masked before they are written.</p>
        <ul className="mt-4 max-h-[480px] space-y-1 overflow-y-auto font-mono text-[12px]">
          {data?.length ? data.map((e, i) => <li key={i} className="grid grid-cols-[auto_auto_1fr] gap-3"><span className="text-muted">{new Date(e.at).toLocaleTimeString('en-IN')}</span><span className="text-brand-ink">{e.event}</span><span className="text-ink-2 break-all">{e.detail}</span></li>) : <li className="text-muted">Nothing logged yet.</li>}
        </ul>
      </div>
    </section>
  );
}
