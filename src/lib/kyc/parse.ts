// Turns OCR lines into labelled fields for each specimen document type.
import type { DocType, ExtractedDoc, ExtractedField } from '../types.ts';

export type OcrLine = { text: string; confidence: number };

const NOISE = /(SYNTHETIC|SPECIMEN - NOT|NOT A VAL|Accel YTL|Fictional business|Format for hackathon|Fictional utility)/i;

export function detectDocType(text: string): DocType | null {
  if (/GST\s*Registration/i.test(text)) return 'gst_certificate';
  if (/Udyam\s*Registration/i.test(text)) return 'udyam_certificate';
  if (/Signatory/i.test(text)) return 'signatory_id';
  if (/(Electricity|Utility|Bill date|Consumer no)/i.test(text)) return 'address_proof';
  return null;
}

const f = (value: string | null | undefined, confidence: number, note?: string): ExtractedField => ({
  value: value?.trim() ? value.trim().replace(/\s{2,}/g, ' ') : null,
  confidence: Math.round(confidence),
  ...(note ? { note } : {}),
});

/** Joins an address that the specimen layout wraps mid-word across two lines. */
export function joinWrapped(a: string, b: string): string {
  if (!b) return a;
  const tail = a.trimEnd(), head = b.trimStart();
  if (/[a-z]$/i.test(tail) && /^[a-z]/.test(head)) return tail + head;
  if (/\d$/.test(tail) && /^\d/.test(head)) return tail + head;
  return `${tail} ${head}`;
}

export const pincodeOf = (address: string | null | undefined): string | null => address?.match(/(\d{6})(?!.*\d{6})/)?.[1] ?? null;
const dateIn = (s: string | undefined) => s?.match(/\d{4}[-./]\d{2}[-./]\d{2}/)?.[0].replace(/[./]/g, '-') ?? null;

function sameLine(lines: OcrLine[], label: RegExp): { value: string; conf: number; index: number } | null {
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].text.match(label);
    if (m) return { value: lines[i].text.slice((m.index ?? 0) + m[0].length).replace(/^[\s:;,.|-]+/, ''), conf: lines[i].confidence, index: i };
  }
  return null;
}

/** For card layouts where the label sits on its own line and the value on the next. */
function nextLine(lines: OcrLine[], label: RegExp): { value: string; conf: number } | null {
  for (let i = 0; i < lines.length; i++) {
    if (label.test(lines[i].text)) {
      const rest = lines[i].text.replace(label, '').replace(/^[\s:;,.|-]+/, '');
      if (rest.length > 1) return { value: rest, conf: lines[i].confidence };
      const n = lines[i + 1];
      return n ? { value: n.text, conf: n.confidence } : null;
    }
  }
  return null;
}

export function parseDocument(rawLines: OcrLine[], hint?: DocType, ocrConfidence = 0): ExtractedDoc {
  const lines = rawLines.map((l) => ({ ...l, text: l.text.trim() })).filter((l) => l.text && !NOISE.test(l.text));
  const text = rawLines.map((l) => l.text).join('\n');
  const type = detectDocType(text) ?? hint ?? 'gst_certificate';
  const fields: Record<string, ExtractedField> = {};

  if (type === 'gst_certificate') {
    const g = sameLine(lines, /^GSTIN\b/i);
    let gst = g?.value.match(/[0-9A-Z]{13,16}/i)?.[0] ?? null;
    let conf = g?.conf ?? 0;
    if (!gst) {
      const any = lines.find((l) => /\b[0-3][0-9][A-Z0-9]{13}\b/.test(l.text));
      gst = any?.text.match(/\b[0-3][0-9][A-Z0-9]{13}\b/)?.[0] ?? null;
      conf = any?.confidence ?? 0;
    }
    fields.gstin = f(gst, conf);
    const legal = sameLine(lines, /^Lega\S*\s+\S*ame/i);
    fields.legalName = f(legal?.value, legal?.conf ?? 0);
    const trade = sameLine(lines, /^Trade\s+\S*ame/i);
    fields.tradeName = f(trade?.value, trade?.conf ?? 0);
    const cons = sameLine(lines, /^Constitution/i);
    fields.constitution = f(cons?.value.replace(/[,.;]+$/, ''), cons?.conf ?? 0);
    const a1 = sameLine(lines, /^Address of princi\S*/i);
    const a2 = sameLine(lines, /^place of busi\S*/i);
    const address = a1 ? joinWrapped(a1.value, a2?.value ?? '') : null;
    fields.address = f(address, Math.min(a1?.conf ?? 0, a2?.conf ?? 100));
    fields.pincode = f(pincodeOf(address), Math.min(a1?.conf ?? 0, a2?.conf ?? 100));
    const d = sameLine(lines, /^Date of liab\S*/i);
    fields.dateOfLiability = f(dateIn(d?.value), d?.conf ?? 0);
  } else if (type === 'udyam_certificate') {
    const n = sameLine(lines, /^Udyam\s+reg\S*\s+number/i);
    const num = n?.value.match(/UDYAM[-\s]*[A-Z]{2}[-\s]*\d{2}[-\s]*\d{7}/i)?.[0] ?? null;
    fields.udyamNumber = f(num, n?.conf ?? 0, n && !num ? 'Label present but no number printed' : undefined);
    const e = sameLine(lines, /^Enterprise\s+name/i);
    fields.enterpriseName = f(e?.value, e?.conf ?? 0);
    const act = sameLine(lines, /^Major\s+activity/i);
    fields.majorActivity = f(act?.value, act?.conf ?? 0);
    const c = sameLine(lines, /^City\b/i);
    fields.city = f(c?.value, c?.conf ?? 0);
    const s = sameLine(lines, /^State\b/i);
    fields.state = f(s?.value, s?.conf ?? 0);
    const d = sameLine(lines, /^Date of reg\S*/i);
    fields.registrationDate = f(dateIn(d?.value), d?.conf ?? 0);
  } else if (type === 'signatory_id') {
    const name = nextLine(lines, /^Name$/i) ?? nextLine(lines, /^Name\b/i);
    fields.name = f(name?.value, name?.conf ?? 0);
    const des = nextLine(lines, /^Designation/i);
    fields.designation = f(des?.value, des?.conf ?? 0);
    const biz = nextLine(lines, /^For business/i);
    fields.business = f(biz?.value, biz?.conf ?? 0);
    const id = nextLine(lines, /^ID no\.?/i);
    fields.idNumber = f(id?.value, id?.conf ?? 0);
    const v = nextLine(lines, /^Valid till/i);
    fields.validTill = f(dateIn(v?.value), v?.conf ?? 0);
  } else {
    const c = sameLine(lines, /^Consumer no\.?/i);
    fields.consumerNumber = f(c?.value, c?.conf ?? 0);
    const b = sameLine(lines, /^Billed to/i);
    fields.billedTo = f(b?.value, b?.conf ?? 0);
    const a = sameLine(lines, /^Supply address/i);
    let address: string | null = a?.value ?? null;
    let conf = a?.conf ?? 0;
    if (a) {
      const next = lines[a.index + 1];
      if (next && !/^(Bill date|Units|Amount)/i.test(next.text)) {
        address = joinWrapped(a.value, next.text);
        conf = Math.min(conf, next.confidence);
      }
    }
    fields.address = f(address, conf);
    fields.pincode = f(pincodeOf(address), conf);
    const d = sameLine(lines, /^Bill date/i);
    fields.billDate = f(dateIn(d?.value), d?.conf ?? 0);
    const amt = sameLine(lines, /^Amount due/i);
    fields.amountDue = f(amt?.value.replace(/^\(INR\)\s*/i, ''), amt?.conf ?? 0);
  }
  return { type, ocrConfidence: Math.round(ocrConfidence), fields };
}
