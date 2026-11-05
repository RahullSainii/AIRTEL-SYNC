'use client';

import { useContext, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, Camera, CheckCircle2, CircleDashed, FileCheck2, Loader2, RefreshCw, Search, ShieldAlert, UserRoundSearch, X } from 'lucide-react';
import { gstinChecksum, isValidGstin, isValidGstinFormat } from '@/lib/gstin';
import { extractDocument, fileToDataUrl } from '@/lib/kyc/ocr-client';
import { maskId } from '@/lib/format';
import type { DocType, GstinRecord, KycCheck, KycVerdict, UdyamRecord } from '@/lib/types';
import { ConsentScreen } from './consent';
import { JourneyContextOptional, useJourney, type DocSlot } from './store';

export const DOCS: { type: DocType; label: string; hint: string }[] = [
  { type: 'gst_certificate', label: 'GST certificate', hint: 'REG-06 from the GST portal' },
  { type: 'udyam_certificate', label: 'Udyam certificate', hint: 'From udyamregistration.gov.in' },
  { type: 'signatory_id', label: 'Signatory ID', hint: 'ID of the person signing' },
  { type: 'address_proof', label: 'Address proof', hint: 'Utility bill, last 90 days' },
];

export const FIELD_LABEL: Record<string, string> = {
  gstin: 'GSTIN', legalName: 'Legal name', tradeName: 'Trade name', constitution: 'Constitution', address: 'Address', pincode: 'Pincode', dateOfLiability: 'Liable from',
  udyamNumber: 'Udyam number', enterpriseName: 'Enterprise', majorActivity: 'Activity', city: 'City', state: 'State', registrationDate: 'Registered',
  name: 'Name', designation: 'Designation', business: 'For business', idNumber: 'ID number', validTill: 'Valid till',
  consumerNumber: 'Consumer no.', billedTo: 'Billed to', billDate: 'Bill date', amountDue: 'Amount due',
};
const MASKED = new Set(['gstin', 'udyamNumber', 'idNumber', 'consumerNumber']);
export const displayField = (k: string, v: string | null) => (v == null ? '—' : !MASKED.has(k) ? v : k === 'gstin' ? maskId(v.toUpperCase()) : maskId(v.toUpperCase(), k === 'udyamNumber' ? 9 : 4, 3));

export const SPECIMENS = Array.from({ length: 12 }, (_, i) => `K${String(i + 1).padStart(2, '0')}`);
export const SPECIMEN_HAS_UDYAM = (k: string) => k !== 'K05';

export function KycStep() {
  const { state, dispatch } = useJourney();
  const partnerNeeded = state.rec?.status === 'ok' && state.rec.partnerLed;

  if (!state.consent) {
    return (
      <div className="space-y-4">
        <BackToQuote />
        <ConsentScreen language={state.language} partnerNeeded={!!partnerNeeded} onAgree={async (purposes) => {
          const res = await fetch('/api/consent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ purposes, language: state.language }) });
          if (res.ok) dispatch({ type: 'patch', patch: { consent: await res.json() } });
        }} />
      </div>
    );
  }
  return <KycWorkspace />;
}

function BackToQuote() {
  const { dispatch } = useJourney();
  return <button type="button" onClick={() => dispatch({ type: 'go', step: 'quote' })} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" />Back to quote</button>;
}

function KycWorkspace() {
  const { state, dispatch } = useJourney();
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [specimen, setSpecimen] = useState('K07');
  const reading = Object.values(state.docs).some((d) => d?.status === 'reading');
  const docCount = Object.values(state.docs).filter((d) => d?.status === 'done').length;

  async function readInto(type: DocType, src: string, name: string, spec?: string) {
    dispatch({ type: 'setDoc', doc: type, slot: { name, src, status: 'reading', specimen: spec } });
    try {
      const extracted = await extractDocument(src, type);
      dispatch({ type: 'setDoc', doc: type, slot: { name, src, status: 'done', extracted, specimen: spec } });
    } catch (e) {
      dispatch({ type: 'setDoc', doc: type, slot: { name, src, status: 'error', error: (e as Error).message, specimen: spec } });
    }
  }

  async function loadSpecimen(k: string) {
    for (const d of DOCS) dispatch({ type: 'setDoc', doc: d.type, slot: null });
    dispatch({ type: 'patch', patch: { gstinInput: '', gstRecord: null, udyamInput: '', udyamRecord: null } });
    await Promise.all(DOCS.filter((d) => d.type !== 'udyam_certificate' || SPECIMEN_HAS_UDYAM(k)).map((d) => readInto(d.type, `/specimens/${k}_${d.type}.png`, `${k} ${d.label}`, k)));
  }

  async function verify() {
    setVerifying(true);
    setError(null);
    try {
      const docs = Object.fromEntries(Object.entries(state.docs).filter(([, d]) => d?.status === 'done').map(([k, d]) => [k, d!.extracted]));
      const res = await fetch('/api/kyc/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consentId: state.consent!.id, enteredGstin: state.gstRecord ? state.gstinInput : undefined, enteredUdyam: state.udyamRecord ? state.udyamInput : undefined, docs }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Verification failed');
      dispatch({ type: 'patch', patch: { verdict: await res.json() } });
      setTimeout(() => document.getElementById('verdict')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="space-y-6 animate-rise">
      <div>
        <BackToQuote />
        <p className="eyebrow mt-3">Smart KYC · consent {state.consent!.id}</p>
        <h1 className="mt-1 font-display text-3xl sm:text-4xl font-semibold tracking-tight">Verify your business in seconds</h1>
        <p className="mt-2 max-w-2xl text-muted">Enter your GSTIN for an instant registry check, then photograph four documents. They are read on this device and compared with the GST and Udyam registries. Anything that does not match is explained, never silently approved or rejected.</p>
      </div>

      <IdentityLookup />

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <div>
            <h2 className="font-semibold">Documents</h2>
            <p className="text-xs text-muted">Photos are read on this device. Images are not uploaded.</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-dashed border-line-2 bg-paper/70 py-1 pl-3 pr-1 text-sm">
            <span className="text-xs text-muted">Demo: specimen applicant</span>
            <select value={specimen} onChange={(e) => setSpecimen(e.target.value)} className="bg-transparent font-mono text-sm focus:outline-none" aria-label="Specimen applicant">
              {SPECIMENS.map((k) => <option key={k}>{k}</option>)}
            </select>
            <button type="button" className="btn btn-primary btn-sm" disabled={reading} onClick={() => loadSpecimen(specimen)}>Load</button>
          </div>
        </div>
        <div className="grid gap-px bg-line sm:grid-cols-2">
          {DOCS.map((d) => <DocSlotCard key={d.type} type={d.type} label={d.label} hint={d.hint} slot={state.docs[d.type]} onFile={async (f) => readInto(d.type, await fileToDataUrl(f), f.name)} onClear={() => dispatch({ type: 'setDoc', doc: d.type, slot: null })} />)}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4">
          <p className="text-sm text-muted">{reading ? 'Reading documents…' : `${docCount} of 4 documents read`}</p>
          <button type="button" className="btn btn-brand" disabled={reading || verifying || (docCount === 0 && !state.gstRecord)} onClick={verify}>
            {verifying ? <Loader2 className="size-4 animate-spin" /> : <FileCheck2 className="size-4" />}Check against registries
          </button>
        </div>
        {error && <p className="mx-5 mb-4 rounded-xl bg-block-soft px-3 py-2 text-sm text-block">{error}</p>}
      </section>

      {state.verdict && <VerdictPanel verdict={state.verdict} />}
    </div>
  );
}

function IdentityLookup() {
  const { state, dispatch } = useJourney();
  const [busy, setBusy] = useState<'gst' | 'udyam' | null>(null);
  const [msg, setMsg] = useState<{ gst?: string; udyam?: string }>({});
  const g = state.gstinInput.toUpperCase().replace(/\s/g, '');
  const status = g.length < 15 ? 'typing' : !isValidGstinFormat(g) ? 'format' : !isValidGstin(g) ? 'checksum' : 'ok';

  async function lookup(kind: 'gst' | 'udyam') {
    setBusy(kind);
    setMsg((m) => ({ ...m, [kind]: undefined }));
    const res = await fetch(`/api/registry/${kind === 'gst' ? 'gstin' : 'udyam'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(kind === 'gst' ? { gstin: g, consentId: state.consent!.id } : { udyam: state.udyamInput, consentId: state.consent!.id }) });
    const data = await res.json();
    setBusy(null);
    if (data.ok) dispatch({ type: 'patch', patch: kind === 'gst' ? { gstRecord: data.record, verdict: null } : { udyamRecord: data.record, verdict: null } });
    else setMsg((m) => ({ ...m, [kind]: data.reason ?? data.error }));
  }

  return (
    <section className="card grid gap-px overflow-hidden bg-line md:grid-cols-2">
      <div className="bg-white p-5">
        <label htmlFor="gstin" className="text-sm font-semibold">GSTIN</label>
        <p className="text-xs text-muted">15 characters. We check the format and checksum as you type.</p>
        <div className="mt-2 flex gap-2">
          <div className="relative flex-1">
            <input id="gstin" className="input font-mono uppercase tracking-wider pr-9" maxLength={15} placeholder="e.g. 07CPCXN0398P1ZT" value={state.gstinInput}
              onChange={(e) => dispatch({ type: 'patch', patch: { gstinInput: e.target.value.toUpperCase(), gstRecord: null } })} />
            <span className="absolute right-3 top-1/2 -translate-y-1/2">{status === 'ok' ? <CheckCircle2 className="size-4 text-pass" /> : status === 'typing' ? null : <AlertTriangle className="size-4 text-flag" />}</span>
          </div>
          <button type="button" className="btn btn-primary" disabled={status !== 'ok' || busy === 'gst'} onClick={() => lookup('gst')}>{busy === 'gst' ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}Look up</button>
        </div>
        {status === 'format' && <p className="mt-2 text-xs text-flag">That does not follow the GSTIN pattern (state code, PAN, entity number, Z, check digit).</p>}
        {status === 'checksum' && <p className="mt-2 text-xs text-flag">One character looks wrong: the last character should be “{gstinChecksum(g.slice(0, 14))}” for this GSTIN. Please check for a typo.</p>}
        {msg.gst && <p className="mt-2 text-xs text-flag">{msg.gst}</p>}
        {state.gstRecord && <GstCard r={state.gstRecord} />}
      </div>
      <div className="bg-white p-5">
        <label htmlFor="udyam" className="text-sm font-semibold">Udyam number <span className="font-normal text-muted">(optional)</span></label>
        <p className="text-xs text-muted">Use this if you do not have the certificate handy.</p>
        <div className="mt-2 flex gap-2">
          <input id="udyam" className="input font-mono uppercase" placeholder="UDYAM-DL-00-9565547" value={state.udyamInput} onChange={(e) => dispatch({ type: 'patch', patch: { udyamInput: e.target.value.toUpperCase(), udyamRecord: null } })} />
          <button type="button" className="btn btn-primary" disabled={state.udyamInput.length < 12 || busy === 'udyam'} onClick={() => lookup('udyam')}>{busy === 'udyam' ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}Look up</button>
        </div>
        {msg.udyam && <p className="mt-2 text-xs text-flag">{msg.udyam}</p>}
        {state.udyamRecord && <UdyamCard r={state.udyamRecord} />}
      </div>
    </section>
  );
}

function GstCard({ r }: { r: GstinRecord }) {
  const active = r.status === 'Active';
  return (
    <div className={`mt-3 rounded-xl border p-3 text-sm animate-rise ${active ? 'border-pass/30 bg-pass-soft/50' : 'border-block/30 bg-block-soft/60'}`}>
      <div className="flex items-center justify-between"><span className="font-medium">{r.tradeName}</span><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${active ? 'bg-pass text-white' : 'bg-block text-white'}`}>{r.status}</span></div>
      <p className="mt-1 text-[13px] text-ink-2">{r.legalName} · {r.constitution}</p>
      <p className="text-[13px] text-muted">{r.address}</p>
      {!active && <p className="mt-2 text-[13px] text-block">This GSTIN is {r.status.toLowerCase()}. Products that need a GSTIN cannot be activated on it.</p>}
    </div>
  );
}

function UdyamCard({ r }: { r: UdyamRecord }) {
  return (
    <div className="mt-3 rounded-xl border border-pass/30 bg-pass-soft/50 p-3 text-sm animate-rise">
      <div className="flex items-center justify-between"><span className="font-medium">{r.enterpriseName}</span><span className="rounded-full bg-pass px-2 py-0.5 text-[11px] font-semibold text-white">{r.enterpriseType}</span></div>
      <p className="mt-1 text-[13px] text-muted">{r.nicDescription} · {r.city}, {r.state}</p>
    </div>
  );
}

function DocSlotCard({ type, label, hint, slot, onFile, onClear }: { type: DocType; label: string; hint: string; slot?: DocSlot; onFile: (f: File) => void; onClear: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const fields = slot?.extracted ? Object.entries(slot.extracted.fields) : [];
  const lowQuality = slot?.extracted && slot.extracted.ocrConfidence < 60;
  return (
    <div className="bg-white p-4 min-h-[188px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-medium">{label}</h3>
          <p className="text-xs text-muted">{hint}</p>
        </div>
        {slot && <button type="button" onClick={onClear} className="grid size-7 place-items-center rounded-full text-muted hover:bg-paper-2" aria-label={`Remove ${label}`}><X className="size-4" /></button>}
      </div>
      {!slot && (
        <button type="button" onClick={() => inputRef.current?.click()} className="mt-3 flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-line-2 bg-paper/50 py-7 text-sm text-ink-2 hover:border-ink hover:bg-paper">
          <Camera className="size-5" />Take photo or upload
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} data-doc={type} />
      {slot && (
        <div className="mt-3 flex gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={slot.src} alt={`${label} preview`} className="h-28 w-20 shrink-0 rounded-lg border border-line object-cover object-top bg-paper" />
          <div className="min-w-0 flex-1 text-[13px]">
            {slot.status === 'reading' && <p className="flex items-center gap-2 text-muted"><Loader2 className="size-4 animate-spin" />Reading on device…</p>}
            {slot.status === 'error' && <p className="text-block">Could not read this image. {slot.error}</p>}
            {slot.status === 'done' && (
              <>
                <p className={`mb-1.5 flex items-center gap-1.5 text-xs font-medium ${lowQuality ? 'text-flag' : 'text-pass'}`}>
                  {lowQuality ? <AlertTriangle className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
                  {lowQuality ? 'Too blurred to read reliably' : 'Read'} · {slot.extracted!.ocrConfidence}% confidence · {((slot.extracted!.ms ?? 0) / 1000).toFixed(1)}s
                </p>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                  {fields.slice(0, 5).map(([k, f]) => (
                    <div key={k} className="contents">
                      <dt className="text-muted">{FIELD_LABEL[k] ?? k}</dt>
                      <dd className={`truncate ${f.value ? 'text-ink' : 'text-flag'} ${MASKED.has(k) ? 'font-mono text-[12px]' : ''}`} title={f.value ?? f.note ?? 'Not found'}>{f.value ? displayField(k, f.value) : f.note ?? 'Not found'}</dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
            {slot.status !== 'reading' && <button type="button" onClick={() => inputRef.current?.click()} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-ink-2 hover:text-ink"><RefreshCw className="size-3" />Retake</button>}
          </div>
        </div>
      )}
    </div>
  );
}

const RESULT_STYLE: Record<KycCheck['result'], { label: string; cls: string }> = {
  pass: { label: 'Pass', cls: 'bg-pass-soft text-pass' },
  flag: { label: 'Flag', cls: 'bg-flag-soft text-flag' },
  review: { label: 'Review', cls: 'bg-review-soft text-review' },
  missing: { label: 'Missing', cls: 'bg-block-soft text-block' },
  info: { label: 'Info', cls: 'bg-paper-2 text-ink-2' },
};

export function VerdictPanel({ verdict, compact = false }: { verdict: KycVerdict; compact?: boolean }) {
  const { state, dispatch } = useJourneyOptional();
  const issues = verdict.checks.filter((c) => c.result !== 'pass' && c.result !== 'info');
  const tone = verdict.status === 'verified' ? { bg: 'bg-pass', icon: <CheckCircle2 className="size-6" />, title: 'Business verified' }
    : verdict.status === 'review' ? { bg: 'bg-review', icon: <UserRoundSearch className="size-6" />, title: 'With a KYC agent' }
      : { bg: 'bg-flag', icon: <ShieldAlert className="size-6" />, title: 'Flagged for review' };
  const passed = verdict.checks.filter((c) => c.result === 'pass').length;
  const ordered = useMemo(() => [...issues, ...verdict.checks.filter((c) => c.result === 'pass' || c.result === 'info')], [verdict, issues]);
  return (
    <section id="verdict" className="card overflow-hidden animate-rise scroll-mt-20" aria-live="polite">
      <div className={`flex flex-wrap items-center justify-between gap-4 px-5 py-4 text-white ${tone.bg}`}>
        <div className="flex items-center gap-3">{tone.icon}<div><h2 className="font-display text-xl font-semibold">{tone.title}</h2><p className="text-sm text-white/85">{verdict.summary}</p></div></div>
        <div className="text-right text-xs text-white/80 font-mono"><div>{passed}/{verdict.checks.length} checks passed</div><div>{verdict.ms} ms · {verdict.registry.adapter}</div></div>
      </div>
      {issues.length > 0 && (
        <div className="space-y-3 border-b border-line bg-paper/50 p-5">
          {issues.map((c) => (
            <div key={c.id} className="rounded-xl border border-line bg-white p-4">
              <div className="flex items-center gap-2"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${RESULT_STYLE[c.result].cls}`}>{RESULT_STYLE[c.result].label}</span><span className="font-medium">{c.label}</span></div>
              <p className="mt-2 text-sm"><span className="font-semibold">Why: </span>{c.why}</p>
              <p className="mt-1 text-sm"><span className="font-semibold">Fix: </span>{c.fix}</p>
            </div>
          ))}
          <p className="text-xs text-muted">Nothing is approved or rejected silently. Fix the item and check again, or a KYC agent will contact you.</p>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-muted"><th className="px-5 py-2.5 font-medium">Check</th><th className="px-3 py-2.5 font-medium">Read from document</th><th className="px-3 py-2.5 font-medium">Registry / rule</th><th className="px-5 py-2.5 font-medium text-right">Result</th></tr></thead>
          <tbody className="divide-y divide-line">
            {ordered.map((c) => (
              <tr key={c.id} className="align-top">
                <td className="px-5 py-2.5">{c.label}{c.result === 'pass' && c.why && <p className="text-xs text-muted mt-0.5">{c.why}</p>}</td>
                <td className="px-3 py-2.5 text-ink-2 max-w-[220px] break-words">{c.read ?? '—'}</td>
                <td className="px-3 py-2.5 text-ink-2 max-w-[220px] break-words">{c.expected ?? '—'}</td>
                <td className="px-5 py-2.5 text-right"><span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${RESULT_STYLE[c.result].cls}`}>{c.result === 'pass' ? <CheckCircle2 className="mr-1 size-3" /> : <CircleDashed className="mr-1 size-3" />}{RESULT_STYLE[c.result].label}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!compact && state && dispatch && (
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line px-5 py-4">
          {verdict.status === 'flagged' && <p className="mr-auto text-sm text-muted">Fix the flagged items above and check again.</p>}
          {verdict.status === 'review' && <p className="mr-auto text-sm text-muted">You can place the order now. Activation starts once the agent confirms (within 2 working hours).</p>}
          <button type="button" className="btn btn-brand" disabled={verdict.status === 'flagged'} onClick={() => dispatch({ type: 'go', step: 'checkout' })}>Continue to checkout<ArrowRight className="size-4" /></button>
        </div>
      )}
    </section>
  );
}

// The verdict panel is reused on the evidence page, outside the journey provider.
function useJourneyOptional() {
  return useContext(JourneyContextOptional) ?? { state: null, dispatch: null };
}
