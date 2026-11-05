import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Instrument_Sans, JetBrains_Mono, Noto_Sans_Devanagari } from 'next/font/google';
import './globals.css';

const bricolage = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage', display: 'swap' });
const instrument = Instrument_Sans({ subsets: ['latin'], variable: '--font-instrument', display: 'swap' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains', display: 'swap', weight: ['400', '500'] });
const deva = Noto_Sans_Devanagari({ subsets: ['devanagari'], variable: '--font-deva', display: 'swap', weight: ['400', '500', '600', '700'] });

export const metadata: Metadata = {
  title: 'Udyam Digital · Accel Business',
  description: 'From days to seconds: an AI advisor, one-price bundle, consent-first KYC and live order tracking for Indian small businesses.',
};

export const viewport: Viewport = { themeColor: '#f5f2ea', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${instrument.variable} ${jetbrains.variable} ${deva.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
