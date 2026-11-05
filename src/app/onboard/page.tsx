import type { Metadata } from 'next';
import { Journey } from '@/components/journey/journey';

export const metadata: Metadata = { title: 'Get your business online · Udyam Digital' };

export default function OnboardPage() {
  return <Journey />;
}
