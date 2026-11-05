import 'server-only';
import { product } from '../catalogue.ts';
import { checkEligibility, inferSegment, recommend, resolveTier, SEGMENT_LABEL, type ProfileField, type Recommendation } from '../engine.ts';
import { inr } from '../format.ts';
import { languageLabel } from '../languages.ts';
import type { ChatMessage, Language, Profile } from '../types.ts';
import { heuristicExtract } from './fallback.ts';
import { groqConfigured, groqJson, GROQ_MODEL } from './groq.ts';
import { mergeProfile } from './merge.ts';
import { EXTRACT_SYSTEM, REPLY_SYSTEM } from './prompts.ts';

export type AdvisorResponse = {
  reply: string;
  quickReplies: string[];
  profile: Profile;
  language: Language;
  recommendation: Recommendation;
  handoff: boolean;
  engine: 'groq' | 'fallback';
  model: string | null;
  ms: number;
};

const LANG_CODES: Language[] = ['en', 'hi', 'mr', 'kn', 'gu', 'te', 'ta', 'bn', 'pa', 'ml'];

export async function advisorTurn(input: { messages: ChatMessage[]; profile: Profile; language?: Language | null; currentLanguage?: Language | null }): Promise<AdvisorResponse> {
  const t0 = Date.now();
  const messages = input.messages.slice(-14).map((m) => ({ role: m.role, content: String(m.content).slice(0, 1500) }));
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  let engine: 'groq' | 'fallback' = groqConfigured() ? 'groq' : 'fallback';
  let extracted: Record<string, unknown>;
  try {
    if (engine !== 'groq') throw new Error('no key');
    extracted = await groqJson<Record<string, unknown>>([
      { role: 'system', content: EXTRACT_SYSTEM },
      { role: 'user', content: `Profile so far: ${JSON.stringify(input.profile)}\n\nConversation:\n${messages.map((m) => `${m.role === 'user' ? 'OWNER' : 'ADVISOR'}: ${m.content}`).join('\n')}` },
    ], { temperature: 0, maxTokens: 500 });
  } catch (err) {
    if (engine === 'groq') console.error('[advisor] extraction failed, using fallback:', (err as Error).message);
    engine = 'fallback';
    // Read only the latest message, in the context of the question the advisor last asked.
    const prev = recommend(input.profile);
    extracted = heuristicExtract(lastUser, prev.status === 'need_info' ? prev.missing[0] : null);
  }

  const profile = mergeProfile(input.profile, extracted);
  const detected = LANG_CODES.includes(extracted.language as Language) ? (extracted.language as Language) : null;
  // A bare answer such as "5" or "Pune" says nothing about language, so keep the current one.
  const informative = (lastUser.match(/\p{L}/gu)?.length ?? 0) >= 8;
  const language: Language = input.language ?? (informative ? detected : null) ?? input.currentLanguage ?? detected ?? 'en';
  const script = extracted.script === 'latin' && language !== 'en' ? 'Latin letters (romanised, like Hinglish)' : 'native script';
  const handoff = extracted.wants_handoff === true;
  const recommendation = recommend(profile);
  const engineResult = summariseForLlm(recommendation, profile);

  let reply = '';
  let quickReplies: string[] = [];
  if (engine === 'groq') {
    try {
      const out = await groqJson<{ reply?: string; quick_replies?: string[] }>([
        { role: 'system', content: REPLY_SYSTEM },
        { role: 'user', content: `LANGUAGE: ${languageLabel(language)} in ${script}\nHANDOFF: ${handoff}\nOWNER_LAST_MESSAGE: ${lastUser}\nENGINE_RESULT: ${JSON.stringify(engineResult)}` },
      ], { temperature: 0.4, maxTokens: 650 });
      reply = (out.reply ?? '').trim();
      quickReplies = Array.isArray(out.quick_replies) ? out.quick_replies.filter((q) => typeof q === 'string').slice(0, 4) : [];
    } catch (err) {
      console.error('[advisor] reply failed, using template:', (err as Error).message);
      engine = 'fallback';
    }
  }
  if (!reply) ({ reply, quickReplies } = templateReply(recommendation, profile, language, handoff));
  return { reply, quickReplies, profile, language, recommendation, handoff, engine, model: engine === 'groq' ? GROQ_MODEL : null, ms: Date.now() - t0 };
}

const FIELD_QUESTION: Record<ProfileField, { en: string; hi: string; enChips: string[]; hiChips: string[] }> = {
  businessType: { en: 'What kind of business do you run?', hi: 'आपका किस तरह का बिज़नेस है?', enChips: ['Pharmacy', 'Clinic', 'Kirana store', 'Restaurant chain'], hiChips: ['फ़ार्मेसी', 'क्लिनिक', 'किराना दुकान'] },
  employees: { en: 'How many people work there, including you?', hi: 'आपके यहाँ कितने लोग काम करते हैं?', enChips: ['Just me', '2–5', '6–20', '20+'], hiChips: ['सिर्फ़ मैं', '2–5', '6–20'] },
  sites: { en: 'How many locations or branches do you have?', hi: 'आपकी कितनी दुकानें या ब्रांच हैं?', enChips: ['1 location', '2 locations', '3 or more'], hiChips: ['1', '2', '3 या ज़्यादा'] },
  city: { en: 'Which city are you in?', hi: 'आप किस शहर में हैं?', enChips: ['Pune', 'Delhi', 'Jaipur', 'Kochi'], hiChips: ['दिल्ली', 'लखनऊ', 'जयपुर'] },
  hasGstin: { en: 'Is your business registered for GST?', hi: 'क्या आपका बिज़नेस GST में रजिस्टर्ड है?', enChips: ['Yes, I have a GSTIN', 'No GST yet'], hiChips: ['हाँ, GST है', 'अभी GST नहीं है'] },
};

function templateReply(rec: Recommendation, p: Profile, lang: Language, handoff: boolean) {
  const hi = lang === 'hi';
  const prefix = handoff ? (hi ? 'ठीक है, हमारे लोकल पार्टनर 2 घंटे में आपको कॉल करेंगे। तब तक यहाँ भी जारी रख सकते हैं।\n\n' : 'Sure. A local Accel partner will call you within 2 working hours. You can keep going here meanwhile.\n\n') : '';
  if (rec.status === 'need_info') {
    const qs = rec.missing.slice(0, 2).map((f) => FIELD_QUESTION[f]);
    const seg = inferSegment(p);
    const ack = seg ? (hi ? `बढ़िया, ${p.businessType ?? SEGMENT_LABEL[seg]}। ` : `Great, a ${(p.businessType ?? SEGMENT_LABEL[seg]).toLowerCase()}. `) : (hi ? 'नमस्ते! ' : 'Hello! ');
    return { reply: prefix + ack + qs.map((q) => (hi ? q.hi : q.en)).join(' '), quickReplies: hi ? qs[0].hiChips : qs[0].enChips };
  }
  const total = `${inr(rec.quote.monthly)}/month, ${inr(rec.quote.setup)} one-time setup, ${rec.quote.contractMonths}-month contract`;
  const names = rec.lines.map((l) => `${l.qty > 1 ? `${l.qty} × ` : ''}${product(l.productId).name}`).join(', ');
  const ex = rec.exclusions.map((e) => `${product(e.productId).name}: ${e.reason}${e.alternative ? (hi ? ` इसकी जगह ${product(e.alternative).name} दिया है।` : ` I have offered ${product(e.alternative).name} instead.`) : ''}`).join('\n');
  const reply = hi
    ? `${prefix}आपका बंडल तैयार है: ${names}।\nकुल ${total}। हर चीज़ क्यों चुनी गई, नीचे कार्ड में लिखा है।${ex ? `\n\nजो नहीं मिल सकता:\n${ex}` : ''}`
    : `${prefix}Your bundle is ready: ${names}.\nThat is ${total}. The card below says why each item suits you.${ex ? `\n\nNot included:\n${ex}` : ''}`;
  return { reply, quickReplies: hi ? ['कोट देखें', ...suggestAddOn(rec, p, true), 'किसी से बात करें'] : ['Review my quote', ...suggestAddOn(rec, p, false), 'Talk to a person'] };
}

const ADD_ON_HINTS: [string, string, string][] = [
  ['P23', 'Add CCTV', 'CCTV जोड़ें'], ['P15', 'Add WhatsApp for customers', 'WhatsApp जोड़ें'], ['P09', 'Add a backup line', 'बैकअप लाइन जोड़ें'],
  ['P19', 'Add billing (POS)', 'बिलिंग मशीन जोड़ें'], ['P16', 'Add business email', 'ईमेल जोड़ें'], ['P07', 'Add a business SIM', 'बिज़नेस सिम जोड़ें'],
];
function suggestAddOn(rec: Extract<Recommendation, { status: 'ok' }>, p: Profile, hi: boolean): string[] {
  const seg = inferSegment(p);
  const hint = ADD_ON_HINTS.find(([id]) => !rec.lines.some((l) => l.productId === id) && !rec.exclusions.some((e) => e.productId === id) && (!seg || product(id).segments.includes(seg)) && checkEligibility(product(id), p).ok);
  return hint ? [hi ? hint[2] : hint[1]] : [];
}

function summariseForLlm(rec: Recommendation, p: Profile) {
  const { tier } = resolveTier(p);
  const profile = { business: p.businessType, segment: inferSegment(p), employees: p.employees, sites: p.sites, city: p.city, tier, has_gstin: p.hasGstin };
  if (rec.status === 'need_info') return { status: 'need_info', known: profile, ask_next: rec.missing.slice(0, 2).map((f) => FIELD_QUESTION[f].en) };
  return {
    status: 'ok',
    profile,
    bundle: rec.lines.map((l) => ({ product: product(l.productId).name, qty: l.qty, monthly: inr(product(l.productId).priceMin * l.qty), why: l.reason, auto_added: !!l.autoAdded })),
    total_monthly: inr(rec.quote.monthly),
    setup_fee: inr(rec.quote.setup),
    contract_months: rec.quote.contractMonths,
    ready_in_days: rec.quote.maxInstallDays,
    exclusions: rec.exclusions.map((e) => ({ product: product(e.productId).name, reason: e.reason, alternative: e.alternative ? product(e.alternative).name : null })),
    notes: rec.notes,
    current_spend: p.monthlySpend ? inr(p.monthlySpend) : null,
  };
}
