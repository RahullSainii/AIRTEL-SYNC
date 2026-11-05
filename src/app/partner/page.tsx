import type { Metadata } from 'next';
import { SiteHeader } from '@/components/site-header';
import { PartnerDesk } from '@/components/partner/partner-desk';
import { ANALYTICS } from '@/data/generated/analytics';
import { PROPENSITY_MODEL } from '@/data/generated/model';

export const metadata: Metadata = { title: 'Partner desk · Udyam Digital' };

export default function PartnerPage() {
  return (
    <>
      <SiteHeader active="/partner" />
      <PartnerDesk analytics={ANALYTICS} model={{ testAuc: PROPENSITY_MODEL.testAuc, topQuintileRate: PROPENSITY_MODEL.topQuintileRate, baseRate: PROPENSITY_MODEL.baseRate, trainSize: PROPENSITY_MODEL.trainSize, testSize: PROPENSITY_MODEL.testSize }} />
    </>
  );
}
