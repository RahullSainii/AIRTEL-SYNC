// Rule-based extraction used when the LLM is unavailable (offline demo, outage or blocked
// network), so the journey never stalls. It reads English, Hindi and Hinglish.
import { BUSINESS_TYPES } from '../../data/generated/business-types.ts';
import { CITIES } from '../../data/generated/cities.ts';
import type { ProfileField } from '../engine.ts';
import type { Need } from '../types.ts';

const NEED_WORDS: [RegExp, Need][] = [
  [/(internet|wi-?fi|broadband|fib(re|er)|इंटरनेट|net connection)/i, 'internet'],
  [/(cctv|camera|कैमरा|surveillance)/i, 'cctv'],
  [/(\bpos\b|billing|bill machine|upi|card machine|बिलिंग)/i, 'pos'],
  [/(whatsapp|व्हाट्सएप|वॉट्सऐप)/i, 'whatsapp'],
  [/\bsms\b/i, 'sms'],
  [/(e-?mail|mail id|ईमेल)/i, 'email'],
  [/(cloud backup|data backup|\bbackup\b(?! line))/i, 'backup'],
  [/(website|web site|वेबसाइट)/i, 'website'],
  [/(antivirus|virus|ransomware|cyber ?security)/i, 'security'],
  [/(firewall)/i, 'firewall'],
  [/(guest wi-?fi|customer wi-?fi|wifi for customers)/i, 'wifi'],
  [/(backup line|failover|always online|never (go )?down|uptime)/i, 'failover'],
  [/(sd-?wan|central(ly)? manage)/i, 'sdwan'],
  [/(static ip)/i, 'static_ip'],
  [/(\bivr\b|call recording|phone lines|telephony|landline)/i, 'telephony'],
  [/(toll.?free|1800)/i, 'tollfree'],
  [/(machines?|iot|sensors?)\b/i, 'iot'],
  [/(vehicles?|vans?|trucks?|fleet|gps)\b/i, 'fleet'],
  [/(leased line|dedicated)/i, 'dedicated'],
  [/(\bsims?\b|mobile (line|connection|plan)|postpaid|सिम)/i, 'mobile'],
];

const HINDI_TYPES: [RegExp, string][] = [
  [/(किराना|kirana|grocery)/i, 'Kirana store'], [/(फ़ार्मेसी|फार्मेसी|दवा|medical store|chemist|pharmacy)/i, 'Pharmacy'],
  [/(डेंटल|dental)/i, 'Dental clinic'], [/(क्लिनिक|clinic)/i, 'Clinic'], [/(बेकरी|bakery)/i, 'Bakery'], [/(सैलून|पार्लर|salon|parlou?r)/i, 'Salon'],
  [/(रेस्टोरेंट|restaurant|dhaba|cafe)/i, 'Restaurant'], [/(कोचिंग|coaching|tuition)/i, 'Coaching centre'], [/(\bca\b|chartered accountant)/i, 'CA firm'],
  [/(कपड़े|boutique|garment)/i, 'Boutique'], [/(factory|फ़ैक्टरी|फैक्ट्री|manufactur)/i, 'Manufacturing unit'], [/(दुकान|dukaan|dukan|shop|store)/i, 'Shop'],
];
const NUM_WORDS: Record<string, number> = { one: 1, ek: 1, एक: 1, two: 2, do: 2, दो: 2, three: 3, teen: 3, तीन: 3, four: 4, char: 4, चार: 4, five: 5, paanch: 5, पांच: 5, पाँच: 5, six: 6, chhe: 6, छह: 6, ten: 10, das: 10, दस: 10 };
const OTHER_CITIES = ['Noida', 'Gurugram', 'Gurgaon', 'Thane', 'Navi Mumbai', 'Chandigarh', 'Kanpur', 'Agra', 'Varanasi', 'Ranchi', 'Raipur', 'Bhubaneswar', 'Guwahati', 'Dehradun', 'Amritsar', 'Jodhpur', 'Udaipur', 'Madurai', 'Mangaluru', 'Thiruvananthapuram', 'Vijayawada', 'Rajkot', 'Aurangabad', 'Meerut', 'Ghaziabad'];
const DEVA_CITIES: Record<string, string> = { दिल्ली: 'Delhi', मुंबई: 'Mumbai', पुणे: 'Pune', जयपुर: 'Jaipur', लखनऊ: 'Lucknow', इंदौर: 'Indore', भोपाल: 'Bhopal', पटना: 'Patna', नागपुर: 'Nagpur', कोलकाता: 'Kolkata', अहमदाबाद: 'Ahmedabad', सूरत: 'Surat' };

export function detectLanguage(text: string): string {
  if (/[\u0900-\u097F]/.test(text)) return /(आहे|आणि|माझे|माझी)/.test(text) ? 'mr' : 'hi';
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta';
  if (/[\u0C00-\u0C7F]/.test(text)) return 'te';
  if (/[\u0C80-\u0CFF]/.test(text)) return 'kn';
  if (/[\u0A80-\u0AFF]/.test(text)) return 'gu';
  if (/[\u0980-\u09FF]/.test(text)) return 'bn';
  if (/[\u0A00-\u0A7F]/.test(text)) return 'pa';
  if (/[\u0D00-\u0D7F]/.test(text)) return 'ml';
  if (/\b(hai|hain|mein|mera|meri|chahiye|dukaan|dukan|log|nahi|haan|kitne|aur)\b/i.test(text)) return 'hi';
  return 'en';
}

const toNum = (s: string) => (/^\d+$/.test(s) ? Number(s) : NUM_WORDS[s.toLowerCase()]);

/**
 * @param text the owner's latest message
 * @param expect the field the advisor just asked for, used to read bare answers like "5" or "Pune"
 */
export function heuristicExtract(text: string, expect?: ProfileField | null): Record<string, unknown> {
  const out: Record<string, unknown> = { language: detectLanguage(text), script: /[^\x00-\x7F₹–—’]/.test(text.replace(/[₹–—’]/g, '')) ? 'native' : 'latin' };
  const t = text.toLowerCase().trim();
  const W = '(\\d+|one|two|three|four|five|six|ten|ek|do|teen|char|paanch|chhe|das|एक|दो|तीन|चार|पांच|पाँच|छह|दस)';

  const type = Object.keys(BUSINESS_TYPES).sort((a, b) => b.length - a.length).find((k) => t.includes(k.toLowerCase()))
    ?? HINDI_TYPES.find(([re]) => re.test(text))?.[1];
  if (type) out.business_type = type;

  const sites = t.match(new RegExp(`${W}\\s*(sites|branches|branch|outlets|stores|locations|shops|restaurants|clinics|centres|centers|offices|शाखा|ब्रांच|दुकानें)`));
  if (sites) out.sites = toNum(sites[1]);
  else if (/(one shop|single (shop|location|site)|1 location|one location|ek dukaan|एक दुकान|^1 location)/.test(t)) out.sites = 1;
  else if (/(3 or more|3 या ज़्यादा)/.test(t)) out.sites = 3;
  if ((out.sites as number) >= 2 && /(restaurants|shops|stores|outlets|branches)/.test(t)) out.segment = 'multi';

  const emp = t.match(new RegExp(`${W}\\s*(staff|employees|people|log|workers|कर्मचारी|लोग|members|persons|karmchari)`));
  if (emp) out.employees = toNum(emp[1]);
  else if (/(just me|only me|सिर्फ़ मैं|sirf main|akela)/.test(t)) out.employees = 1;

  const city = Object.keys(CITIES).find((c) => t.includes(c.toLowerCase())) ?? Object.entries(DEVA_CITIES).find(([d]) => text.includes(d))?.[1];
  const other = OTHER_CITIES.find((c) => t.includes(c.toLowerCase()));
  if (city) out.city = city;
  else if (other) { out.city = other; out.city_tier = 2; }

  if (/(no gst|without gst|not registered|gst nahi|gst nahin|जीएसटी नहीं|gst नहीं|don'?t have (a )?gst|no gstin|अभी gst नहीं)/i.test(t)) out.has_gstin = false;
  else if (/(gst|gstin|जीएसटी)/i.test(t)) out.has_gstin = true;

  const needs = NEED_WORDS.filter(([re]) => re.test(text)).map(([, n]) => n);
  if (needs.length) out.needs = needs;
  const q: Record<string, number> = {};
  const cams = t.match(/(\d+)\s*(cctv )?cameras?/); if (cams) q.cameras = Number(cams[1]);
  const sims = t.match(/(\d+)\s*(sims?|mobile lines?|phone lines?)/); if (sims) q.mobileLines = Number(sims[1]);
  const veh = t.match(/(\d+)\s*(vehicles?|vans?|trucks?)/); if (veh) q.vehicles = Number(veh[1]);
  if (Object.keys(q).length) out.quantities = q;
  if (/(no fib(re|er)|fib(re|er) (is )?not available)/.test(t)) out.no_fibre = true;
  if (/(talk to (a )?(person|human|agent|someone)|call me|call back|किसी से बात|visit karo)/i.test(t)) out.wants_handoff = true;

  // Bare answers to the question just asked.
  if (expect === 'employees' && out.employees == null) {
    const range = t.match(/(\d+)\s*[–-]\s*(\d+)/);
    const plus = t.match(/(\d+)\s*\+/);
    const bare = t.match(/^\D*(\d+)\D*$/);
    out.employees = range ? Math.round((Number(range[1]) + Number(range[2])) / 2) : plus ? Number(plus[1]) + 5 : bare ? Number(bare[1]) : toNum(t.split(/\s/)[0]);
  }
  if (expect === 'sites' && out.sites == null) { const n = t.match(/(\d+)/); if (n) out.sites = Number(n[1]); }
  if (expect === 'city' && !out.city && t.length < 30 && /^[a-z .]+$/i.test(t)) { out.city = text.trim().replace(/\b\w/g, (c) => c.toUpperCase()); out.city_tier = 2; }
  if (expect === 'hasGstin' && out.has_gstin == null) {
    if (/^(no|nahi|nahin|नहीं|not yet)/.test(t)) out.has_gstin = false;
    else if (/^(yes|haan|ha|हाँ|हां|ji)/.test(t)) out.has_gstin = true;
  }
  if (expect === 'businessType' && !out.business_type && t.length < 40) out.business_type = text.trim();
  return out;
}
