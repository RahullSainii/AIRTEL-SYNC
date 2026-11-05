import type { Metadata } from 'next';
import { ArrowDown, ArrowRight } from 'lucide-react';
import { SiteFooter, SiteHeader } from '@/components/site-header';

export const metadata: Metadata = { title: 'Architecture & privacy · Udyam Digital' };

const LANES = [
  { n: '1', title: 'Capture', where: 'Owner’s phone (Next.js web app)', items: ['Chat and voice advisor, 10 languages', 'Quote with add-on toggles', 'DPDP consent screen (EN/HI)', 'Camera capture + on-device OCR (Tesseract, self-hosted)', 'GSTIN format + checksum as you type'] },
  { n: '2', title: 'Process', where: 'Backend API (route handlers)', items: ['Advisor orchestrator', 'Consent service: versioned, logged, withdrawable', 'KYC verifier: receives fields, never images', 'Order and tracker service', 'Audit log with masked IDs'] },
  { n: '3', title: 'Extract and check', where: 'Behind adapters', items: ['Groq LLM: profile extraction + plain-language reply only', 'Registry adapter: mock CSV today, licensed GSP / Udyam API next', 'Fallback rules when the LLM is unreachable', 'Queue + human review when a registry is down'] },
  { n: '4', title: 'Decide', where: 'Deterministic engines', items: ['Catalogue rules engine: eligibility, dependencies, price', 'KYC decision engine: pass / flag / review with Why + Fix', 'Propensity model: call priority for partners'] },
  { n: '5', title: 'Deliver', where: 'Owner and partner surfaces', items: ['One-price quote, e-sign, UPI', 'Order tracker + WhatsApp updates', 'Partner desk: handoffs, call list, funnel, audit'] },
];

const FLOW = [
  'The owner describes the business. The orchestrator asks the LLM to turn the conversation into a structured profile (type, staff, sites, city, GSTIN, needs).',
  'The rules engine checks every product against city tier, staff and site minimums, GSTIN and dependencies, and prices the bundle from the catalogue. The LLM only explains that result in the owner’s language.',
  'The owner consents. Documents are read on the phone; only the extracted fields are sent with the consent ID.',
  'The KYC verifier validates the GSTIN checksum, looks up GST and Udyam through the registry adapter and compares names, pincode, dates and signatory. Each mismatch returns a reason and a fix.',
  'Checkout re-prices on the server, creates the order with stage dates from catalogue install days, and assigns a partner when a site survey is needed.',
  'Leads the advisor cannot close go to the partner desk with the transcript, draft quote and a propensity score.',
];

const RETENTION = [
  ['Document images', 'Never leave the device; discarded when the tab closes', 'Not stored'],
  ['Extracted KYC fields', 'Verification and activation', 'Contract life + licence-mandated period; 30 days if no purchase'],
  ['Consent record', 'Proof of consent (DPDP s.6)', 'As long as data is processed + limitation period'],
  ['Chat transcript', 'Advice and partner handoff', '90 days, then aggregated'],
  ['Audit log', 'Security and accountability', '1 year, IDs masked at write'],
];

export default function ArchitecturePage() {
  return (
    <>
      <SiteHeader active="/architecture" />
      <main className="mx-auto max-w-7xl px-5 py-12">
        <p className="eyebrow">Solution architecture</p>
        <h1 className="mt-2 font-display text-4xl sm:text-5xl font-semibold tracking-tight">How it works</h1>
        <p className="mt-3 max-w-3xl text-lg text-ink-2">The language model understands and explains. Everything that decides money or compliance (eligibility, price, KYC verdicts) is deterministic, testable code behind clear adapters.</p>

        <div className="mt-10 grid gap-3 lg:grid-cols-5">
          {LANES.map((l, i) => (
            <div key={l.n} className="relative">
              <div className={`h-full rounded-[20px] border p-5 ${l.n === '4' ? 'border-ink bg-night text-white' : 'border-line bg-white'}`}>
                <p className={`font-mono text-xs ${l.n === '4' ? 'text-white/50' : 'text-muted'}`}>{l.n}</p>
                <h2 className="mt-1 font-display text-xl font-semibold">{l.title}</h2>
                <p className={`text-xs ${l.n === '4' ? 'text-white/60' : 'text-muted'}`}>{l.where}</p>
                <ul className="mt-4 space-y-2 text-[13px] leading-snug">
                  {l.items.map((it) => <li key={it} className={`rounded-lg px-2.5 py-2 ${l.n === '4' ? 'bg-white/10' : 'bg-paper'}`}>{it}</li>)}
                </ul>
              </div>
              {i < LANES.length - 1 && (
                <span className="absolute z-10 grid size-7 place-items-center rounded-full border border-line bg-paper text-muted lg:-right-[18px] lg:top-1/2 lg:-translate-y-1/2 left-1/2 -bottom-5 -translate-x-1/2 lg:left-auto lg:bottom-auto lg:translate-x-0">
                  <ArrowRight className="hidden size-3.5 lg:block" /><ArrowDown className="size-3.5 lg:hidden" />
                </span>
              )}
            </div>
          ))}
        </div>

        <section className="mt-14 grid gap-8 lg:grid-cols-[1fr_1fr]">
          <div>
            <h2 className="font-display text-2xl font-semibold">Request flow</h2>
            <ol className="mt-4 space-y-3">
              {FLOW.map((f, i) => <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-ink-2"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-ink font-mono text-xs text-white">{i + 1}</span>{f}</li>)}
            </ol>
          </div>
          <div>
            <h2 className="font-display text-2xl font-semibold">Path to live registry checks</h2>
            <div className="mt-4 card divide-y divide-line text-sm">
              {[
                ['GSTIN', 'Licensed GST Suvidha Provider (GSP) taxpayer search API', 'Same RegistryAdapter interface; swap via REGISTRY_ADAPTER'],
                ['Udyam', 'Udyam verification through the MSME API or a DigiLocker-issued certificate', 'Removes OCR for this document when DigiLocker is used'],
                ['Signatory and e-sign', 'Aadhaar e-sign through a licensed e-Sign Service Provider', 'Replaces the simulated OTP'],
                ['Source down', 'Application queued, owner told, KYC agent completes it', 'Implemented: the verifier returns “review”, never a guess'],
              ].map(([k, a, b]) => <div key={k} className="grid grid-cols-[110px_1fr] gap-3 px-5 py-3"><span className="font-medium">{k}</span><span className="text-ink-2">{a}<span className="block text-xs text-muted">{b}</span></span></div>)}
            </div>
            <p className="mt-3 text-sm text-muted">Consent covers the lookup: every registry call requires an active consent ID with the “registry lookup” purpose, and is written to the audit log with the identifier masked.</p>
          </div>
        </section>

        <section id="privacy" className="mt-16 card overflow-hidden">
          <div className="border-b border-line bg-night px-6 py-6 text-white sm:px-10">
            <p className="font-mono text-xs uppercase tracking-wider text-white/50">One-page note</p>
            <h2 className="mt-1 font-display text-3xl font-semibold">Data privacy and security choices</h2>
            <p className="mt-2 max-w-3xl text-white/70">Designed to the Digital Personal Data Protection Act, 2023, treating the synthetic data as if it were real customer data.</p>
          </div>
          <div className="grid gap-8 px-6 py-8 sm:px-10 md:grid-cols-2">
            {[
              ['Notice and consent (s.5, s.6)', 'A plain notice in English or Hindi before any KYC step names the Data Fiduciary, what we use, why, and for how long. Consent is per purpose, opt-in, versioned (kyc-consent-v1.2), timestamped and stored. Optional purposes (partner contact) are separate checkboxes.'],
              ['Purpose limitation', 'The registry and KYC APIs refuse any request without an active consent ID for that purpose. Withdrawal stops processing and erases extracted KYC fields, from the order tracker in one tap.'],
              ['Data minimisation', 'Document images are read on the phone and never uploaded or stored; only the fields we check are sent. The advisor chat never receives KYC identifiers, and the LLM is used only to read business needs and explain the bundle.'],
              ['Masking', 'GSTIN, Udyam, ID and consumer numbers are masked on screen, in the partner desk and before anything is written to the audit log (e.g. 07CPC••••••P1ZT). Contact numbers in the call list are masked.'],
              ['Integrity of decisions', 'Prices and eligibility are recalculated on the server at checkout, so a tampered client cannot change them. KYC never approves on a guess: unreadable scans and registry outages go to a person.'],
              ['Security', 'The LLM key lives only on the server. Third-party calls go through adapters with timeouts. Production adds encryption at rest, role-based access for partners (they see only assigned leads), rate limiting and an India-region LLM endpoint to keep personal data in country.'],
            ].map(([h, b]) => <div key={h}><h3 className="font-semibold">{h}</h3><p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">{b}</p></div>)}
          </div>
          <div className="border-t border-line px-6 py-6 sm:px-10">
            <h3 className="font-semibold">Retention</h3>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead><tr className="text-left text-xs text-muted"><th className="py-2 font-medium">Data</th><th className="py-2 font-medium">Purpose</th><th className="py-2 font-medium">Kept for</th></tr></thead>
                <tbody className="divide-y divide-line">{RETENTION.map(([a, b, c]) => <tr key={a}><td className="py-2.5 font-medium">{a}</td><td className="py-2.5 text-ink-2">{b}</td><td className="py-2.5 text-ink-2">{c}</td></tr>)}</tbody>
              </table>
            </div>
            <p className="mt-4 text-sm text-muted">Rights: access, correction, erasure and grievance via privacy@accel.example (Grievance Officer), with a 7-day response target. Prototype boundary: in-memory store, mock registries, specimen documents, simulated e-sign and UPI.</p>
          </div>
        </section>

        <section className="mt-16 grid gap-6 lg:grid-cols-2">
          <div className="card p-6">
            <h2 className="font-display text-2xl font-semibold">Pilot pass criteria</h2>
            <p className="mt-1 text-sm text-muted">8-week pilot, digital journey vs field sales, professional offices and GSTIN micro retail in 2 Tier 1 cities.</p>
            <table className="mt-4 w-full text-sm">
              <tbody className="divide-y divide-line">
                {[['Lead-to-activation', '7.4%', '≥ 9.6% in the digital arm'], ['Time to activate', '17.6 days', '≤ 8 days'], ['Cost per activation', '₹15,000', '≤ ₹11,500'], ['Status chase calls', '3', '≤ 1'], ['6-month churn', '—', '≤ 15%'], ['KYC false approvals', '—', '0 in audit sample']].map(([m, a, b]) => <tr key={m}><td className="py-2.5">{m}</td><td className="py-2.5 text-right text-muted num">{a}</td><td className="py-2.5 text-right font-medium text-pass">{b}</td></tr>)}
              </tbody>
            </table>
          </div>
          <div className="card p-6">
            <h2 className="font-display text-2xl font-semibold">What would make it fail</h2>
            <ul className="mt-4 space-y-3 text-[15px] text-ink-2">
              <li><span className="font-medium text-ink">OCR misreads on real photos.</span> Mitigation: confidence gate and checksum recovery; rough photos go to a person (see the robustness lab).</li>
              <li><span className="font-medium text-ink">Partner conflict.</span> Mitigation: partners own every survey-led install and every handoff, with credit for digital orders in their area.</li>
              <li><span className="font-medium text-ink">Owners do not trust a bot with money.</span> Mitigation: one-tap human handoff in their language; quote is one clear number.</li>
              <li><span className="font-medium text-ink">Smaller uplift than modelled.</span> Mitigation: the pilot split measures it before any scale-up; the 10/20/30% range is labelled projected.</li>
            </ul>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
