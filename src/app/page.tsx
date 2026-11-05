import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, BadgeCheck, FileSearch, MessagesSquare, PackageCheck, ReceiptIndianRupee } from 'lucide-react';
import { SiteFooter, SiteHeader } from '@/components/site-header';
import { ANALYTICS } from '@/data/generated/analytics';
import { PROPENSITY_MODEL } from '@/data/generated/model';
import { inr, pct } from '@/lib/format';

const loss = (m: string) => ANALYTICS.addressable.find((a) => a.module === m)?.count ?? 0;

const MODULES = [
  { n: '01', icon: MessagesSquare, title: 'AI business advisor', body: 'Chat or speak in Hindi and 9 other languages. The advisor asks about type, size, sites and GSTIN, and recommends an eligible bundle in plain words.', loss: loss('Field-visit scheduling'), lossLabel: 'leads lost waiting for a field visit' },
  { n: '02', icon: ReceiptIndianRupee, title: 'Quote and checkout', body: 'One monthly price, setup fee and term on one screen. Toggle add-ons; dependency and eligibility rules apply instantly. E-sign and pay by UPI.', loss: loss('Complex or slow quotes'), lossLabel: 'leads lost to complex or slow quotes' },
  { n: '03', icon: FileSearch, title: 'Smart KYC', body: 'Consent first. Documents are read on the phone, GSTIN checksum is validated, then GST and Udyam registries are matched. Every flag says why and how to fix it.', loss: loss('Paperwork delays'), lossLabel: 'leads lost to paperwork' },
  { n: '04', icon: PackageCheck, title: 'Order tracker', body: 'Live stages with dates from catalogue install times and WhatsApp updates in the owner’s language, so nobody has to call to chase.', loss: loss('Install delays'), lossLabel: 'leads lost to install delays, 3 chase calls each' },
];

export default function Home() {
  const totalLoss = ANALYTICS.addressable.reduce((s, a) => s + a.count, 0);
  const dropped = ANALYTICS.totalLeads - ANALYTICS.activated;
  return (
    <>
      <SiteHeader />
      <main>
        <section className="mx-auto grid max-w-7xl gap-10 px-5 pt-12 pb-16 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:pt-20">
          <div className="animate-rise">
            <p className="eyebrow">Accel YTL Hackathon 2026 · Enterprise Track A · Team Techuminati</p>
            <h1 className="mt-4 font-display text-[44px] leading-[1.02] sm:text-6xl lg:text-[76px] font-semibold tracking-[-0.03em]">
              From days<br />to <span className="text-brand">seconds.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-2">
              A small business owner describes their shop on a phone, in their own language, and leaves with the right bundle, verified KYC and a live installation date. No visit, no PDF quote, no chasing.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/onboard" className="btn btn-brand text-base px-6 py-3.5">Start as a business owner<ArrowRight className="size-4" /></Link>
              <Link href="/partner" className="btn btn-ghost text-base px-6 py-3.5">Open the partner desk</Link>
            </div>
            <p className="mt-6 text-sm text-muted">Prototype on synthetic data: mock registries and specimen documents.</p>
          </div>
          <div className="relative">
            <div className="relative aspect-[4/3.2] overflow-hidden rounded-[28px] shadow-[var(--shadow-lift)]">
              <Image src="/hero-kirana.jpg" alt="A shop owner smiling behind the counter of a busy neighbourhood kirana store" fill priority unoptimized sizes="(min-width: 1024px) 600px, 100vw" className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-night/70 via-night/0 to-transparent" />
              <p className="absolute bottom-3 right-4 text-[10px] text-white/70">Photo: Wietse Jongsma / Unsplash</p>
            </div>
            <div className="absolute -bottom-8 left-4 right-4 sm:left-auto sm:-left-8 sm:right-auto sm:w-[340px] card p-4 animate-rise" style={{ animationDelay: '0.15s' }}>
              <div className="rounded-2xl rounded-br-md bg-ink px-3.5 py-2.5 text-sm text-white ml-8">Meri Indore mein kirana dukaan hai, 2 log, UPI aur billing chahiye</div>
              <div className="mt-2 rounded-2xl rounded-tl-md bg-paper-2/80 px-3.5 py-2.5 text-sm">Aapka bundle taiyaar hai: Biz Fibre 100, 1 business SIM aur Cloud POS.</div>
              <div className="mt-2 flex items-center justify-between rounded-xl bg-night px-3.5 py-2.5 text-white">
                <span className="font-display text-xl font-semibold num">₹1,897<span className="text-xs font-normal text-white/60">/month</span></span>
                <span className="flex items-center gap-1 text-xs text-white/80"><BadgeCheck className="size-3.5 text-pass" />GSTIN verified</span>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 pt-12">
          <div className="grid gap-px overflow-hidden rounded-[24px] border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {[
              { k: 'Leads reaching activation', now: pct(ANALYTICS.activationRate), target: '9.6%' },
              { k: 'Lead to activation', now: `${ANALYTICS.avgDaysToActivate} days`, target: '≤ 8 days' },
              { k: 'Status chases per customer', now: `${ANALYTICS.avgChaseCalls}`, target: '≤ 1' },
              { k: 'Cost per activated SMB', now: inr(ANALYTICS.cacPerActivation), target: '₹11.5k' },
            ].map((s) => (
              <div key={s.k} className="bg-surface p-6">
                <p className="text-sm text-muted">{s.k}</p>
                <p className="mt-2 font-display text-4xl font-semibold num">{s.now}</p>
                <p className="mt-1 text-sm"><span className="text-muted">today · </span><span className="font-medium text-pass">target {s.target}</span></p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">Source: smb_leads.csv (synthetic), {ANALYTICS.totalLeads.toLocaleString('en-IN')} leads, Apr–Jun 2026. Targets are projected, to be proven in an 8-week pilot.</p>
        </section>

        <section className="mx-auto max-w-7xl px-5 pt-24">
          <div className="max-w-2xl">
            <p className="eyebrow">One journey, four modules</p>
            <h2 className="mt-3 font-display text-4xl sm:text-5xl font-semibold tracking-tight">Each module removes a reason leads drop out.</h2>
            <p className="mt-4 text-lg text-ink-2">{totalLoss.toLocaleString('en-IN')} of {dropped.toLocaleString('en-IN')} dropped leads ({pct(totalLoss / dropped, 0)}) were lost to visits, quotes, paperwork and install delays: exactly what this journey replaces.</p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {MODULES.map((m) => (
              <article key={m.n} className="card flex flex-col p-6">
                <div className="flex items-center justify-between"><m.icon className="size-6 text-brand" /><span className="font-mono text-xs text-muted">{m.n}</span></div>
                <h3 className="mt-6 font-display text-xl font-semibold">{m.title}</h3>
                <p className="mt-2 flex-1 text-[15px] leading-relaxed text-ink-2">{m.body}</p>
                <p className="mt-6 border-t border-line pt-4 text-sm"><span className="font-display text-2xl font-semibold num">{m.loss.toLocaleString('en-IN')}</span> <span className="text-muted">{m.lossLabel}</span></p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 pt-24">
          <div className="overflow-hidden rounded-[28px] bg-night text-white">
            <div className="grid gap-10 p-8 sm:p-12 lg:grid-cols-[1fr_1.4fr]">
              <div>
                <p className="font-mono text-xs uppercase tracking-wider text-white/50">Measured, not claimed</p>
                <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight">Evidence you can rerun in the browser.</h2>
                <p className="mt-4 text-white/70">Every number below comes from the evidence page: the KYC test bench on all 12 specimen applicants, the advisor scenario suite and the propensity model hold-out test.</p>
                <Link href="/evidence" className="btn mt-8 bg-white text-ink hover:bg-paper">Open the evidence page<ArrowRight className="size-4" /></Link>
              </div>
              <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/10">
                {[
                  ['12 / 12', 'specimen applicants given the right KYC verdict, incl. K02 and K10 OCR misreads recovered by checksum'],
                  ['~3 s', 'median upload-to-verdict for four documents, read in the browser on the device'],
                  ['15 / 15', 'advisor eligibility scenarios: tier, staff, sites, GSTIN and product dependencies'],
                  [`${PROPENSITY_MODEL.testAuc}`, `hold-out AUC of the call-priority model; top 20% activate at ${pct(PROPENSITY_MODEL.topQuintileRate)} vs ${pct(PROPENSITY_MODEL.baseRate)}`],
                ].map(([v, l]) => (
                  <div key={l} className="bg-night-2 p-6">
                    <dt className="font-display text-4xl font-semibold num">{v}</dt>
                    <dd className="mt-2 text-sm text-white/65 leading-relaxed">{l}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 pt-24">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { t: 'Explained verdicts with a consent log', b: 'Each flag shows what was read, what the registry says, why it matters and how to fix it. Every lookup is tied to a recorded consent and logged with masked IDs.' },
              { t: 'Regional languages, voice included', b: 'The owner speaks or types in Hindi, Marathi, Tamil and 7 more. Prices and eligibility never depend on the language model.' },
              { t: 'Partners stay in the sale', b: 'Leads the advisor cannot close, and every bundle that needs a site survey, go to the local partner with the transcript, quote and a call-priority score.' },
            ].map((x) => (
              <div key={x.t} className="rounded-[20px] border border-line p-6">
                <h3 className="font-display text-lg font-semibold">{x.t}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{x.b}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm text-muted max-w-3xl">Why it is hard to copy: a chat window is easy to clone; explained KYC verdicts with a consent trail, regional-language advice, the partner handoff and the lead-data loop that improves every recommendation take much longer.</p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
