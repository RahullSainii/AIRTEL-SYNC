import type { Language } from './types.ts';

// Interface chrome ships in English and Hindi. The advisor itself replies in all ten languages.
const STRINGS = {
  steps_advisor: { en: 'Advisor', hi: 'सलाहकार' },
  steps_quote: { en: 'Quote', hi: 'कोटेशन' },
  steps_kyc: { en: 'KYC', hi: 'KYC' },
  steps_checkout: { en: 'Checkout', hi: 'भुगतान' },
  steps_track: { en: 'Track', hi: 'ट्रैक' },
  welcome: {
    en: 'Namaste! I am Udyam, your Accel Business advisor. Tell me about your business in your own words, and I will put together the right internet, phone and digital tools at one clear monthly price.',
    hi: 'नमस्ते! मैं उद्यम हूँ, आपका Accel Business सलाहकार। अपने बिज़नेस के बारे में अपने शब्दों में बताइए, मैं आपके लिए सही इंटरनेट, फ़ोन और डिजिटल टूल एक साफ़ मासिक कीमत में चुनूँगा।',
  },
  placeholder: { en: 'Describe your business, e.g. “Pharmacy in Jaipur, 5 staff, need CCTV”', hi: 'अपने बिज़नेस के बारे में लिखें, जैसे “जयपुर में फ़ार्मेसी, 5 लोग, CCTV चाहिए”' },
  talk_person: { en: 'Talk to a person', hi: 'किसी व्यक्ति से बात करें' },
  review_quote: { en: 'Review quote', hi: 'कोटेशन देखें' },
  per_month: { en: '/month', hi: '/महीना' },
  setup: { en: 'one-time setup', hi: 'एक बार सेटअप' },
  contract: { en: 'month contract', hi: 'महीने का अनुबंध' },
  ready_in: { en: 'Ready in', hi: 'तैयार' },
  days: { en: 'days', hi: 'दिन' },
  continue_kyc: { en: 'Continue to KYC', hi: 'KYC पर जाएँ' },
  thinking: { en: 'Thinking', hi: 'सोच रहा हूँ' },
  listening: { en: 'Listening…', hi: 'सुन रहा हूँ…' },
} as const;

export type StringKey = keyof typeof STRINGS;
export function t(key: StringKey, lang: Language): string {
  const entry = STRINGS[key] as Record<string, string>;
  return entry[lang] ?? entry.en;
}

export const EXAMPLES: Record<'en' | 'hi', string[]> = {
  en: [
    'I run a pharmacy in Jaipur with 5 staff. I need internet and CCTV.',
    'CA firm in Pune, 8 people, we have GST. Need email and fast internet.',
    'We have 3 restaurants in Mumbai, 30 staff, GST registered.',
    'Textile unit in Surat, 40 workers, need a dedicated line',
  ],
  hi: [
    'मेरी लखनऊ में किराना दुकान है, 2 लोग काम करते हैं, GST नहीं है',
    'Delhi mein dental clinic hai, 6 log, GST hai, internet aur WhatsApp chahiye',
    'इंदौर में बेकरी है, 3 लोग, बिलिंग मशीन और इंटरनेट चाहिए',
  ],
};
