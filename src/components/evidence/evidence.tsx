'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CircleX, FlaskConical, Loader2, Play, Timer, Trash2 } from 'lucide-react';
import type { AdvisorResponse } from '@/lib/advisor/advisor';
import { formatClock, inr, pct } from '@/lib/format';
import { SCENARIOS, runScenario, type Scenario } from '@/lib/scenarios';
import type { Profile } from '@/lib/types';
import { VerdictPanel } from '@/components/journey/kyc';
import { RUNS_KEY, type TimedRun } from '@/components/journey/store';
import { APPLICANTS, benchConsent, KEY, runApplicant, VARIANTS, type BenchResult, type Variant } from './kyc-bench';

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : 0; };

export function Evidence({ model }: { model: { testAuc: number; topQuintileRate: number; baseRate: number; trainSize: number; testSize: number } }) {
  return (
    <div className="space-y-16">
      <TimedRuns />
      <KycBench />
      <RobustnessLab />
      <AdvisorSuite />
      <section id="model">
        <SectionHead n="05" title="Call-priority model card" sub="Logistic regression trained on smb_leads.csv at build time, using only what is known when a lead is created (no stage, date or outcome leakage)." />
        <div className="grid gap-4 md:grid-cols-4">
          {[[String(model.testAuc), 'hold-out AUC'], [pct(model.topQuintileRate), 'activation in the top-scored 20%'], [pct(model.baseRate), 'activation across all hold-out leads'], [`${model.trainSize.toLocaleString('en-IN')} / ${model.testSize.toLocaleString('en-IN')}`, 'train / test leads, fixed seed']].map(([v, l]) => (
            <div key={l} className="card p-5"><p className="font-display text-3xl font-semibold num">{v}</p><p className="mt-1 text-sm text-muted">{l}</p></div>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted">Features: GSTIN, Udyam, city tier, staff, multi-site, telecom spend, products of interest, segment, lead source, current internet, turnover band, current provider. Rebuild with <code className="font-mono">pnpm data</code>.</p>
      </section>
    </div>
  );
}

function SectionHead({ n, title, sub }: { n: string; title: string; sub: string }) {
  return (
    <div className="mb-5 flex gap-4">
      <span className="font-mono text-xs text-muted pt-2">{n}</span>
      <div><h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">{title}</h2><p className="mt-1 max-w-3xl text-muted">{sub}</p></div>
    </div>
  );
}

function TimedRuns() {
  const [runs, setRuns] = useState<TimedRun[]>([]);
  useEffect(() => { try { setRuns(JSON.parse(localStorage.getItem(RUNS_KEY) ?? '[]')); } catch { /* ignore */ } }, []);
  const secs = runs.map((r) => r.seconds);
  return (
    <section id="timed">
      <SectionHead n="01" title="Timed onboarding runs" sub="The journey timer starts at the owner’s first message and stops when the order is placed. Includes real OCR on the device, registry lookups (mock, with 220 ms simulated latency) and the simulated e-sign and UPI steps." />
      <div className="grid gap-4 md:grid-cols-[280px_1fr]">
        <div className="card p-5 space-y-4">
          <div><p className="text-sm text-muted">Median run</p><p className="font-display text-4xl font-semibold num">{runs.length ? formatClock(median(secs) * 1000) : '—'}</p></div>
          <div><p className="text-sm text-muted">Worst run</p><p className="font-display text-2xl font-semibold num">{runs.length ? formatClock(Math.max(...secs) * 1000) : '—'}</p></div>
          <p className="text-sm text-muted">{runs.length} run{runs.length === 1 ? '' : 's'} on this browser. Today: 17.6 days.</p>
          {runs.length > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { localStorage.removeItem(RUNS_KEY); setRuns([]); }}><Trash2 className="size-3.5" />Clear runs</button>}
        </div>
        <div className="card overflow-x-auto">
          {runs.length === 0 ? (
            <div className="p-6 text-sm text-muted">
              <p className="font-medium text-ink">No runs yet. To produce the slide-7 number:</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>Open the <a href="/onboard" className="underline underline-offset-4">owner journey</a> with screen recording on.</li>
                <li>Type a one-line description, review the quote, load specimen K03 (clean) in KYC, and check out.</li>
                <li>Repeat 5 times in the same browser; report the median and worst run shown here.</li>
              </ol>
            </div>
          ) : (
            <table className="w-full min-w-[560px] text-sm">
              <thead><tr className="border-b border-line text-left text-xs text-muted"><th className="px-5 py-3 font-medium">When</th><th className="px-3 py-3 font-medium">Order</th><th className="px-3 py-3 font-medium text-right">Bundle</th><th className="px-3 py-3 font-medium">KYC</th><th className="px-3 py-3 font-medium">Advisor</th><th className="px-5 py-3 font-medium text-right">First message → order</th></tr></thead>
              <tbody className="divide-y divide-line">
                {runs.map((r) => <tr key={r.at}><td className="px-5 py-2.5 text-muted">{new Date(r.at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</td><td className="px-3 py-2.5 font-mono text-xs">{r.orderId}</td><td className="px-3 py-2.5 text-right num">{inr(r.monthly)}</td><td className="px-3 py-2.5">{r.kyc}</td><td className="px-3 py-2.5">{r.engine}</td><td className="px-5 py-2.5 text-right font-mono">{formatClock(r.seconds * 1000)}</td></tr>)}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}

function useBench() {
  const [results, setResults] = useState<BenchResult[]>([]);
  const [running, setRunning] = useState<string | null>(null);
  async function run(variant: Variant) {
    setResults([]);
    const consent = await benchConsent();
    const out: BenchResult[] = [];
    for (const app of APPLICANTS) {
      setRunning(app);
      out.push(await runApplicant(app, variant, consent));
      setResults([...out]);
    }
    setRunning(null);
    return out;
  }
  return { results, running, run };
}

function summarise(rs: BenchResult[]) {
  const times = rs.map((r) => r.ms);
  const perField: Record<string, [number, number]> = {};
  for (const r of rs) for (const [k, [a, b]] of Object.entries(r.perField)) { perField[k] ??= [0, 0]; perField[k][0] += a; perField[k][1] += b; }
  return {
    correct: rs.filter((r) => r.correct).length, total: rs.length, falseApprovals: rs.filter((r) => r.falseApproval).length,
    review: rs.filter((r) => r.status === 'review').length, fieldsRight: rs.reduce((s, r) => s + r.fieldsRight, 0), fieldsTotal: rs.reduce((s, r) => s + r.fieldsTotal, 0),
    median: median(times), worst: times.length ? Math.max(...times) : 0, perField,
  };
}

function KycBench() {
  const { results, running, run } = useBench();
  const [open, setOpen] = useState<string | null>(null);
  const s = summarise(results);
  return (
    <section id="kyc">
      <SectionHead n="02" title="Smart KYC test bench" sub="Runs the full pipeline on all 12 specimen applicants (47 documents) in this browser: on-device OCR, GSTIN format and checksum, registry match, verdict. Expected verdicts are our own answer key from inspecting the specimens; the judges hold the official one." />
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-5 py-4">
          <div className="flex flex-wrap gap-6 text-sm">
            <Stat label="Right verdict" value={results.length ? `${s.correct}/${s.total}` : '—'} />
            <Stat label="Field accuracy" value={s.fieldsTotal ? pct(s.fieldsRight / s.fieldsTotal) : '—'} />
            <Stat label="Median upload→verdict" value={results.length ? `${(s.median / 1000).toFixed(1)} s` : '—'} />
            <Stat label="Worst" value={results.length ? `${(s.worst / 1000).toFixed(1)} s` : '—'} />
            <Stat label="False approvals" value={results.length ? String(s.falseApprovals) : '—'} tone={s.falseApprovals ? 'bad' : undefined} />
          </div>
          <button type="button" className="btn btn-brand" disabled={!!running} onClick={() => run('clean')}>{running ? <><Loader2 className="size-4 animate-spin" />Running {running}</> : <><Play className="size-4" />Run all 12 applicants</>}</button>
        </div>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-line text-left text-xs text-muted"><th className="px-5 py-2.5 font-medium">Applicant</th><th className="px-3 py-2.5 font-medium">Planted problem</th><th className="px-3 py-2.5 font-medium">Expected</th><th className="px-3 py-2.5 font-medium">Got</th><th className="px-3 py-2.5 font-medium text-right">Time</th><th className="px-5 py-2.5 font-medium text-right">Result</th></tr></thead>
          <tbody className="divide-y divide-line">
            {APPLICANTS.map((a) => {
              const r = results.find((x) => x.applicant === a);
              return (
                <tr key={a} className={r ? 'cursor-pointer hover:bg-paper/60' : ''} onClick={() => r && setOpen(open === a ? null : a)}>
                  <td className="px-5 py-2.5 font-mono">{a}</td>
                  <td className="px-3 py-2.5 text-ink-2">{(r?.problem) ?? KEYPROBLEM(a)}</td>
                  <td className="px-3 py-2.5"><StatusText s={r?.expected ?? KEYSTATUS(a)} /></td>
                  <td className="px-3 py-2.5">{r ? <StatusText s={r.status} /> : running === a ? <Loader2 className="size-4 animate-spin text-muted" /> : <span className="text-muted">—</span>}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs">{r ? `${(r.ms / 1000).toFixed(1)} s` : ''}</td>
                  <td className="px-5 py-2.5 text-right">{r ? (r.correct ? <CheckCircle2 className="ml-auto size-4 text-pass" /> : <CircleX className="ml-auto size-4 text-block" />) : null}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {open && results.find((r) => r.applicant === open) && <div className="mt-4"><p className="mb-2 text-sm text-muted">Verdict for {open} as the owner sees it:</p><VerdictPanel verdict={results.find((r) => r.applicant === open)!.verdict} compact /></div>}
    </section>
  );
}

const KEYSTATUS = (a: string) => KEY[a].expected.status;
const KEYPROBLEM = (a: string) => KEY[a].expected.problem;

function StatusText({ s }: { s: string }) {
  const cls = s === 'verified' ? 'text-pass' : s === 'review' ? 'text-review' : 'text-flag';
  return <span className={`font-medium ${cls}`}>{s === 'flagged' ? 'Flagged' : s === 'review' ? 'Human review' : 'Verified'}</span>;
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'bad' }) {
  return <div><p className="text-xs text-muted">{label}</p><p className={`font-display text-xl font-semibold num ${tone === 'bad' ? 'text-block' : ''}`}>{value}</p></div>;
}

type LabRow = { variant: Variant; s: ReturnType<typeof summarise> };

function RobustnessLab() {
  const { results, running, run } = useBench();
  const [variant, setVariant] = useState<Variant>('rotated');
  const [rows, setRows] = useState<LabRow[]>([]);
  const groups = ['GSTIN', 'Name', 'Udyam no.', 'Pincode', 'Date'];
  return (
    <section id="robustness">
      <SectionHead n="03" title="OCR robustness lab" sub="Twelve clean specimens is a small base, so this roughens the same documents the way phones do: rotation, blur, low light, cropping and heavy compression. It reports accuracy per field and how many go to a person instead of being decided automatically." />
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
          <FlaskConical className="size-4 text-muted" />
          <select className="input w-auto" value={variant} onChange={(e) => setVariant(e.target.value as Variant)} aria-label="Distortion">
            {VARIANTS.map((v) => <option key={v.id} value={v.id}>{v.label} · {v.detail}</option>)}
          </select>
          <button type="button" className="btn btn-primary" disabled={!!running} onClick={async () => { const out = await run(variant); setRows((r) => [{ variant, s: summarise(out) }, ...r.filter((x) => x.variant !== variant)]); }}>
            {running ? <><Loader2 className="size-4 animate-spin" />{running} · {results.length}/12</> : <><Play className="size-4" />Run 12 applicants</>}
          </button>
          <span className="text-xs text-muted">About 30–60 s per variant.</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead><tr className="border-b border-line text-left text-xs text-muted"><th className="px-5 py-2.5 font-medium">Variant</th>{groups.map((g) => <th key={g} className="px-3 py-2.5 font-medium text-right">{g}</th>)}<th className="px-3 py-2.5 font-medium text-right">Sent to a person</th><th className="px-3 py-2.5 font-medium text-right">Right verdict</th><th className="px-5 py-2.5 font-medium text-right">False approvals</th></tr></thead>
            <tbody className="divide-y divide-line">
              {rows.length === 0 && <tr><td colSpan={9} className="px-5 py-6 text-muted">Pick a variant and run it. Results accumulate here so you can compare them.</td></tr>}
              {rows.map(({ variant: v, s }) => (
                <tr key={v}>
                  <td className="px-5 py-2.5 font-medium">{VARIANTS.find((x) => x.id === v)!.label}</td>
                  {groups.map((g) => <td key={g} className="px-3 py-2.5 text-right num">{s.perField[g] ? pct(s.perField[g][0] / s.perField[g][1], 0) : '—'}</td>)}
                  <td className="px-3 py-2.5 text-right num">{s.review}/{s.total}</td>
                  <td className="px-3 py-2.5 text-right num">{s.correct}/{s.total}</td>
                  <td className={`px-5 py-2.5 text-right num font-medium ${s.falseApprovals ? 'text-block' : 'text-pass'}`}>{s.falseApprovals}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-line px-5 py-3 text-xs text-muted">The safety metric is false approvals: a document with a planted problem that was marked verified. Lower accuracy on rough photos should show up as more cases sent to a person, not as silent approvals.</p>
      </div>
    </section>
  );
}

function answerFor(field: string, p: Profile): string {
  switch (field) {
    case 'businessType': return p.businessType ?? 'Shop';
    case 'employees': return `${p.employees} staff`;
    case 'sites': return `${p.sites} location${(p.sites ?? 1) > 1 ? 's' : ''}`;
    case 'city': return p.city ?? 'Pune';
    case 'hasGstin': return p.hasGstin ? 'Yes, I have a GSTIN' : 'No GST yet';
    default: return '';
  }
}

function AdvisorSuite() {
  const engine = useMemo(() => SCENARIOS.map(runScenario), []);
  const [live, setLive] = useState<Record<string, { pass: boolean; turns: number; engine: string; monthly: number | null; ms: number }>>({});
  const [running, setRunning] = useState<string | null>(null);

  async function replay(s: Scenario) {
    const t0 = performance.now();
    let messages = [{ role: 'user' as const, content: s.say }];
    let profile: Profile = {};
    let data: AdvisorResponse | null = null;
    for (let turn = 0; turn < 6; turn++) {
      const r = await fetch('/api/advisor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages, profile }) });
      data = await r.json();
      profile = data!.profile;
      if (data!.recommendation.status === 'ok') break;
      const next = answerFor(data!.recommendation.missing[0], s.profile);
      messages = [...messages, { role: 'assistant' as const, content: data!.reply } as never, { role: 'user' as const, content: next }];
    }
    const rec = data?.recommendation;
    return { pass: !!rec && rec.status === 'ok' && s.check(rec), turns: Math.ceil(messages.length / 2), engine: data?.engine ?? '?', monthly: rec?.status === 'ok' ? rec.quote.monthly : null, ms: Math.round(performance.now() - t0) };
  }

  async function replayAll() {
    for (const s of SCENARIOS) {
      setRunning(s.id);
      const r = await replay(s);
      setLive((l) => ({ ...l, [s.id]: r }));
    }
    setRunning(null);
  }

  const passed = engine.filter((e) => e.pass).length;
  const livePassed = Object.values(live).filter((l) => l.pass).length;
  return (
    <section id="advisor">
      <SectionHead n="04" title="Advisor scenario suite" sub="Fifteen eligibility edge cases: city tier, staff and site minimums, GSTIN-only products, dependencies and mobile-only buyers. The rules engine is checked instantly; “Replay live” sends the owner’s sentence through the real advisor API and answers its follow-up questions like an owner would." />
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-5 py-4">
          <div className="flex gap-6"><Stat label="Rules engine" value={`${passed}/${engine.length}`} /><Stat label="Live advisor" value={Object.keys(live).length ? `${livePassed}/${Object.keys(live).length}` : '—'} /></div>
          <button type="button" className="btn btn-primary" disabled={!!running} onClick={replayAll}>{running ? <><Loader2 className="size-4 animate-spin" />{running}</> : <><Play className="size-4" />Replay live</>}</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead><tr className="border-b border-line text-left text-xs text-muted"><th className="px-5 py-2.5 font-medium">#</th><th className="px-3 py-2.5 font-medium">Owner says</th><th className="px-3 py-2.5 font-medium">Expected</th><th className="px-3 py-2.5 font-medium text-right">Engine</th><th className="px-5 py-2.5 font-medium text-right">Live</th></tr></thead>
            <tbody className="divide-y divide-line">
              {engine.map(({ scenario: s, pass, rec }) => (
                <tr key={s.id} className="align-top">
                  <td className="px-5 py-2.5 font-mono text-xs text-muted">{s.id}</td>
                  <td className="px-3 py-2.5"><p className="font-medium">{s.title}</p><p className="text-xs text-muted">“{s.say}”</p></td>
                  <td className="px-3 py-2.5 text-ink-2">{s.expect}{rec.status === 'ok' && <span className="block text-xs text-muted num">Engine: {inr(rec.quote.monthly)}/mo</span>}</td>
                  <td className="px-3 py-2.5 text-right">{pass ? <CheckCircle2 className="ml-auto size-4 text-pass" /> : <CircleX className="ml-auto size-4 text-block" />}</td>
                  <td className="px-5 py-2.5 text-right">{live[s.id] ? <span className="inline-flex items-center gap-1.5 text-xs text-muted">{live[s.id].engine} · {live[s.id].turns} turn{live[s.id].turns > 1 ? 's' : ''}{live[s.id].pass ? <CheckCircle2 className="size-4 text-pass" /> : <CircleX className="size-4 text-block" />}</span> : running === s.id ? <Loader2 className="ml-auto size-4 animate-spin text-muted" /> : <span className="text-muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted"><Timer className="size-3.5" />Live replays include network time to the LLM provider when it is reachable.</p>
    </section>
  );
}
