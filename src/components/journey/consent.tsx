'use client';

import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import type { Language } from '@/lib/types';

const COPY = {
  en: {
    title: 'Before we verify your business',
    intro: 'Accel Telecom Ltd. is the Data Fiduciary under the Digital Personal Data Protection Act, 2023. We ask only for what activation legally needs.',
    collect: 'What we use', collectItems: ['GSTIN and Udyam number, checked against the government registries', 'GST and Udyam certificates, signatory ID and one address proof', 'Name and mobile number of the authorised signatory'],
    how: 'How we handle it', howItems: ['Documents are read on your phone. The images are not uploaded or stored; only the fields we check are sent.', 'IDs are masked on screen and in our logs, e.g. 07CPC••••••P1ZT.', 'Verified fields are kept for your contract plus the period the telecom licence requires, then deleted. If you do not buy, they are deleted within 30 days.'],
    purposes: 'I agree to these purposes',
    p: { kyc_verification: ['Verify my business for activation', 'Required'], registry_lookup: ['Look up my GSTIN and Udyam in the registries', 'Required'], partner_contact: ['Share my name, number and address with the installing partner', 'Needed if your bundle needs a site visit'] } as Record<string, [string, string]>,
    rights: 'You can withdraw consent at any time from the order tracker; we then stop processing and erase your KYC data. To access, correct or complain, write to the Grievance Officer at privacy@accel.example.',
    agree: 'I agree, continue', digilocker: 'Share via DigiLocker (coming soon)',
  },
  hi: {
    title: 'आपके बिज़नेस की जाँच से पहले',
    intro: 'डिजिटल पर्सनल डेटा प्रोटेक्शन एक्ट, 2023 के तहत Accel Telecom Ltd. डेटा फ़िड्यूशियरी है। हम सिर्फ़ वही माँगते हैं जो सेवा चालू करने के लिए क़ानूनन ज़रूरी है।',
    collect: 'हम क्या इस्तेमाल करते हैं', collectItems: ['GSTIN और उद्यम नंबर, सरकारी रजिस्ट्री से मिलान के लिए', 'GST और उद्यम सर्टिफ़िकेट, साइन करने वाले की ID और एक पते का प्रमाण', 'साइन करने वाले का नाम और मोबाइल नंबर'],
    how: 'हम इसे कैसे संभालते हैं', howItems: ['दस्तावेज़ आपके फ़ोन पर ही पढ़े जाते हैं। तस्वीरें अपलोड या सेव नहीं होतीं; सिर्फ़ जाँच वाले फ़ील्ड भेजे जाते हैं।', 'स्क्रीन और लॉग में ID छिपाकर दिखाई जाती हैं, जैसे 07CPC••••••P1ZT।', 'जाँचे गए फ़ील्ड अनुबंध और टेलीकॉम लाइसेंस की ज़रूरी अवधि तक रखे जाते हैं, फिर मिटा दिए जाते हैं। ख़रीद न होने पर 30 दिन में मिटा दिए जाते हैं।'],
    purposes: 'मैं इन उद्देश्यों के लिए सहमति देता/देती हूँ',
    p: { kyc_verification: ['सेवा चालू करने के लिए मेरे बिज़नेस की जाँच', 'ज़रूरी'], registry_lookup: ['रजिस्ट्री में मेरा GSTIN और उद्यम नंबर देखना', 'ज़रूरी'], partner_contact: ['इंस्टॉल करने वाले पार्टनर को मेरा नाम, नंबर और पता देना', 'साइट विज़िट वाले बंडल के लिए'] } as Record<string, [string, string]>,
    rights: 'आप ऑर्डर ट्रैकर से कभी भी सहमति वापस ले सकते हैं; तब हम प्रोसेसिंग रोककर आपका KYC डेटा मिटा देंगे। जानकारी, सुधार या शिकायत के लिए privacy@accel.example पर ग्रीवेंस ऑफ़िसर को लिखें।',
    agree: 'सहमत हूँ, आगे बढ़ें', digilocker: 'DigiLocker से शेयर करें (जल्द)',
  },
};

export function ConsentScreen({ language, partnerNeeded, onAgree }: { language: Language; partnerNeeded: boolean; onAgree: (purposes: string[]) => Promise<void> }) {
  const [lang, setLang] = useState<'en' | 'hi'>(language === 'hi' ? 'hi' : 'en');
  const c = COPY[lang];
  const [checked, setChecked] = useState<Record<string, boolean>>({ kyc_verification: false, registry_lookup: false, partner_contact: partnerNeeded });
  const [busy, setBusy] = useState(false);
  const ok = checked.kyc_verification && checked.registry_lookup;
  return (
    <section className="card overflow-hidden animate-rise" aria-labelledby="consent-title">
      <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
        <div className="flex gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-pass-soft text-pass"><ShieldCheck className="size-5" /></span>
          <div>
            <h2 id="consent-title" className="font-display text-2xl font-semibold tracking-tight">{c.title}</h2>
            <p className="mt-1 text-sm text-muted max-w-xl">{c.intro}</p>
          </div>
        </div>
        <div className="flex rounded-full border border-line-2 p-0.5 text-xs font-medium shrink-0">
          {(['en', 'hi'] as const).map((l) => (
            <button key={l} type="button" onClick={() => setLang(l)} className={`rounded-full px-2.5 py-1 ${lang === l ? 'bg-ink text-white' : 'text-muted'}`}>{l === 'en' ? 'English' : 'हिन्दी'}</button>
          ))}
        </div>
      </div>
      <div className="grid gap-6 px-6 py-5 md:grid-cols-2">
        <div>
          <h3 className="eyebrow">{c.collect}</h3>
          <ul className="mt-2 space-y-2 text-sm text-ink-2">{c.collectItems.map((i) => <li key={i} className="flex gap-2"><span className="mt-2 size-1 shrink-0 rounded-full bg-ink" />{i}</li>)}</ul>
        </div>
        <div>
          <h3 className="eyebrow">{c.how}</h3>
          <ul className="mt-2 space-y-2 text-sm text-ink-2">{c.howItems.map((i) => <li key={i} className="flex gap-2"><span className="mt-2 size-1 shrink-0 rounded-full bg-ink" />{i}</li>)}</ul>
        </div>
      </div>
      <fieldset className="mx-6 rounded-2xl border border-line bg-paper/60 p-4">
        <legend className="px-1 text-sm font-semibold">{c.purposes}</legend>
        <div className="space-y-2.5">
          {Object.entries(c.p).map(([key, [label, note]]) => (
            <label key={key} className="flex items-start gap-3 text-sm cursor-pointer">
              <input type="checkbox" className="mt-0.5 size-4 accent-[#15171c]" checked={!!checked[key]} onChange={(e) => setChecked((s) => ({ ...s, [key]: e.target.checked }))} />
              <span><span className="text-ink">{label}</span> <span className="text-muted">· {note}</span></span>
            </label>
          ))}
        </div>
      </fieldset>
      <p className="px-6 pt-4 text-[13px] text-muted leading-relaxed">{c.rights}</p>
      <div className="flex flex-wrap items-center gap-3 px-6 py-5">
        <button type="button" className="btn btn-brand" disabled={!ok || busy} onClick={async () => { setBusy(true); try { await onAgree(Object.keys(checked).filter((k) => checked[k])); } finally { setBusy(false); } }}>{c.agree}</button>
        <button type="button" className="btn btn-ghost" disabled>{c.digilocker}</button>
        <span className="text-[11px] text-muted font-mono">Notice version kyc-consent-v1.2</span>
      </div>
    </section>
  );
}
