import type { Metadata } from 'next';
import { SiteFooter, SiteHeader } from '@/components/site-header';
import { TrackLookup } from '@/components/track/track-lookup';

export const metadata: Metadata = { title: 'Track your order · Udyam Digital' };

export default function TrackPage() {
  return (
    <>
      <SiteHeader active="/track" />
      <main className="mx-auto max-w-3xl px-5 py-14">
        <p className="eyebrow">Order tracker</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">Where is my connection?</h1>
        <p className="mt-2 text-muted">Check status any time instead of calling support. Enter the order reference from your WhatsApp message.</p>
        <TrackLookup />
      </main>
      <SiteFooter />
    </>
  );
}
