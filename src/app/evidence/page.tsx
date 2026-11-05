import type { Metadata } from 'next';
import { SiteFooter, SiteHeader } from '@/components/site-header';
import { Evidence } from '@/components/evidence/evidence';
import { PROPENSITY_MODEL } from '@/data/generated/model';

export const metadata: Metadata = { title: 'Evidence · Udyam Digital' };

export default function EvidencePage() {
  const m = PROPENSITY_MODEL;
  return (
    <>
      <SiteHeader active="/evidence" />
      <main className="mx-auto max-w-7xl px-5 py-12">
        <p className="eyebrow">Proof, not claims</p>
        <h1 className="mt-2 font-display text-4xl sm:text-5xl font-semibold tracking-tight">Evidence you can rerun</h1>
        <p className="mt-3 max-w-3xl text-lg text-ink-2">Every number on our slides is produced here, in the browser, on the hackathon data. Registries are mock and documents are specimens; the method is what we are proving.</p>
        <nav className="mt-6 flex flex-wrap gap-2 text-sm">
          {[['#timed', 'Timed runs'], ['#kyc', 'KYC bench'], ['#robustness', 'Robustness lab'], ['#advisor', 'Advisor suite'], ['#model', 'Model card']].map(([h, l]) => <a key={h} href={h} className="chip">{l}</a>)}
        </nav>
        <div className="mt-12"><Evidence model={{ testAuc: m.testAuc, topQuintileRate: m.topQuintileRate, baseRate: m.baseRate, trainSize: m.trainSize, testSize: m.testSize }} /></div>
      </main>
      <SiteFooter />
    </>
  );
}
