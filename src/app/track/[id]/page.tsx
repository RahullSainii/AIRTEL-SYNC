import type { Metadata } from 'next';
import { SiteHeader } from '@/components/site-header';
import { Tracker } from '@/components/track/tracker';

export const metadata: Metadata = { title: 'Order status · Udyam Digital' };

export default async function OrderPage({ params }: PageProps<'/track/[id]'>) {
  const { id } = await params;
  return (
    <>
      <SiteHeader active="/track" />
      <Tracker id={id} />
    </>
  );
}
