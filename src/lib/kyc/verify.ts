// Compares OCR-extracted fields with registry records. Every non-pass result carries a plain
// "why" and "fix", and nothing is approved or rejected silently.
import { daysBetween, DEMO_TODAY } from '../dates.ts';
import { maskId } from '../format.ts';
import { normaliseUdyam, readGstin, UDYAM_FORMAT } from '../gstin.ts';
import type { DocType, ExtractedDoc, GstinRecord, KycCheck, KycVerdict, UdyamRecord } from '../types.ts';
import { compareNames, proprietorOf } from './match.ts';
import { pincodeOf } from './parse.ts';

export const OCR_REVIEW_THRESHOLD = 60;
export const ADDRESS_PROOF_MAX_DAYS = 90;

export type VerifyRegistry = {
  id: string;
  gstinExists: (g: string) => boolean;
  lookupGstin: (g: string) => Promise<GstinRecord | null>;
  lookupUdyam: (n: string) => Promise<UdyamRecord | null>;
  nearestGstin?: (g: string) => Promise<GstinRecord | null>;
  findUdyamByName?: (name: string, state?: string) => Promise<UdyamRecord[]>;
};

export type VerifyInput = {
  enteredGstin?: string | null;
  enteredUdyam?: string | null;
  docs: Partial<Record<DocType, ExtractedDoc>>;
};

const DOC_LABEL: Record<DocType, string> = {
  gst_certificate: 'GST certificate',
  udyam_certificate: 'Udyam certificate',
  signatory_id: 'Signatory ID',
  address_proof: 'Address proof',
};

export async function verifyKyc(input: VerifyInput, registry: VerifyRegistry): Promise<KycVerdict> {
  const t0 = Date.now();
  const checks: KycCheck[] = [];
  const { docs } = input;
  const gstDoc = docs.gst_certificate;
  const add = (c: KycCheck) => checks.push(c);

  // 1. Image quality gate: unreadable scans go to a person instead of producing false flags.
  for (const [type, doc] of Object.entries(docs) as [DocType, ExtractedDoc][]) {
    if (doc.ocrConfidence < OCR_REVIEW_THRESHOLD) {
      add({ id: `${type}.quality`, label: `${DOC_LABEL[type]} is readable`, doc: type, result: 'review', read: `${doc.ocrConfidence}% OCR confidence`, expected: `${OCR_REVIEW_THRESHOLD}%+`,
        why: `The ${DOC_LABEL[type].toLowerCase()} is too blurred or dark to read reliably.`, fix: 'Retake the photo in good light, or a KYC agent will check it within 2 working hours.' });
    }
  }
  const readable = (t: DocType) => !!docs[t] && docs[t]!.ocrConfidence >= OCR_REVIEW_THRESHOLD;

  // 2. GSTIN: format and checksum straight after OCR, then the registry.
  let gstin: string | null = null;
  const rawRead = readable('gst_certificate') ? gstDoc?.fields.gstin?.value ?? null : null;
  if (rawRead) {
    const r = readGstin(rawRead, registry.gstinExists);
    if (r.status === 'valid') {
      gstin = r.gstin;
      add({ id: 'gst.checksum', label: 'GSTIN format and checksum', doc: 'gst_certificate', result: 'pass', read: maskId(r.gstin), why: r.corrected ? r.note : undefined });
    } else if (r.status === 'recovered') {
      gstin = r.gstin;
      add({ id: 'gst.checksum', label: 'GSTIN format and checksum', doc: 'gst_certificate', result: 'pass', read: maskId(r.gstin), why: r.note });
    } else {
      const near = registry.nearestGstin ? await registry.nearestGstin(r.read) : null;
      const lowConf = (gstDoc?.fields.gstin?.confidence ?? 0) < 75;
      add({ id: 'gst.checksum', label: 'GSTIN format and checksum', doc: 'gst_certificate', result: lowConf ? 'review' : 'flag', read: maskId(r.read), expected: near ? maskId(near.gstin) : null,
        why: lowConf ? `We could not read the GSTIN clearly. ${r.reason}` : `The GSTIN printed on the certificate is not a valid GSTIN. ${r.reason}${near ? ` A registered GSTIN for ${near.tradeName} differs by one character.` : ''}`,
        fix: lowConf ? 'Upload a clearer photo of the certificate.' : 'Download the latest certificate from the GST portal and upload it, or confirm the correct GSTIN.' });
    }
  }
  const entered = input.enteredGstin ? readGstin(input.enteredGstin, registry.gstinExists) : null;
  if (entered && entered.status !== 'invalid') {
    if (gstin && gstin !== entered.gstin) {
      add({ id: 'gst.entered', label: 'GSTIN you entered matches the certificate', doc: 'gst_certificate', result: 'flag', read: maskId(gstin), expected: maskId(entered.gstin),
        why: 'The GSTIN on the certificate is different from the one you entered.', fix: 'Check which GSTIN belongs to this business and upload its certificate.' });
    }
    gstin ??= entered.gstin;
  }

  let gstRec: GstinRecord | null = null;
  if (gstin) {
    gstRec = await registry.lookupGstin(gstin);
    if (!gstRec) {
      add({ id: 'registry.gstin', label: 'GSTIN found in registry', doc: 'registry', result: 'flag', read: maskId(gstin), why: 'This GSTIN is valid in format but is not in the GST registry.', fix: 'Confirm the GSTIN on the GST portal or upload the latest certificate.' });
    } else {
      add({ id: 'registry.gstin', label: 'GSTIN found in registry', doc: 'registry', result: 'pass', read: maskId(gstin), expected: gstRec.tradeName });
      add(gstRec.status === 'Active'
        ? { id: 'registry.status', label: 'GST registration is active', doc: 'registry', result: 'pass', read: gstRec.status }
        : { id: 'registry.status', label: 'GST registration is active', doc: 'registry', result: 'flag', read: gstRec.status, expected: 'Active',
            why: `The GST registry shows this GSTIN as ${gstRec.status.toLowerCase()}. Products that need a GSTIN cannot be activated on it.`,
            fix: gstRec.status === 'Suspended' ? 'Resolve the suspension on the GST portal, then retry. You can still buy products that do not need a GSTIN.' : 'Use an active GSTIN for this business, or continue with products that do not need one.' });
    }
  } else if (!gstDoc && !input.enteredGstin) {
    add({ id: 'gst.missing', label: 'GST certificate provided', doc: 'gst_certificate', result: 'missing', why: 'No GST certificate or GSTIN was provided.', fix: 'Enter your GSTIN for an instant lookup, or upload the certificate.' });
  }

  // 3. Certificate fields against the registry.
  if (gstRec && readable('gst_certificate')) {
    const fields = gstDoc!.fields;
    const legal = compareNames(fields.legalName?.value, gstRec.legalName);
    add(legal.match === 'different'
      ? { id: 'gst.legalName', label: 'Legal name matches registry', doc: 'gst_certificate', result: 'flag', read: fields.legalName?.value, expected: gstRec.legalName,
          why: `The certificate says “${fields.legalName?.value}”, the registry says “${gstRec.legalName}”${legal.differing.length ? ` (different words: ${legal.differing.join(', ')})` : ''}.`,
          fix: 'Confirm the registered name, or upload the latest GST certificate.' }
      : { id: 'gst.legalName', label: 'Legal name matches registry', doc: 'gst_certificate', result: 'pass', read: fields.legalName?.value, expected: gstRec.legalName });
    const trade = compareNames(fields.tradeName?.value, gstRec.tradeName);
    add(trade.match === 'different'
      ? { id: 'gst.tradeName', label: 'Trade name matches registry', doc: 'gst_certificate', result: 'flag', read: fields.tradeName?.value, expected: gstRec.tradeName,
          why: `The certificate shows trade name “${fields.tradeName?.value}”, the registry has “${gstRec.tradeName}”.`, fix: 'Upload the latest GST certificate.' }
      : { id: 'gst.tradeName', label: 'Trade name matches registry', doc: 'gst_certificate', result: 'pass', read: fields.tradeName?.value, expected: gstRec.tradeName });
    const pin = fields.pincode?.value, regPin = pincodeOf(gstRec.address);
    add(pin && pin === regPin
      ? { id: 'gst.pincode', label: 'Business pincode matches registry', doc: 'gst_certificate', result: 'pass', read: pin, expected: regPin }
      : { id: 'gst.pincode', label: 'Business pincode matches registry', doc: 'gst_certificate', result: pin ? 'flag' : 'review', read: pin, expected: regPin,
          why: pin ? 'The pincode on the certificate does not match the registered address.' : 'We could not read the pincode.', fix: 'Upload the latest certificate, or confirm the registered address.' });
  }

  // 4. Udyam certificate.
  const udyamDoc = docs.udyam_certificate;
  const businessName = gstRec?.tradeName ?? gstDoc?.fields.tradeName?.value ?? null;
  if (!udyamDoc && !input.enteredUdyam) {
    const suggestion = businessName && registry.findUdyamByName ? (await registry.findUdyamByName(businessName, gstRec?.state))[0] : undefined;
    add({ id: 'udyam.missing', label: 'Udyam certificate provided', doc: 'udyam_certificate', result: 'missing',
      why: 'The Udyam registration certificate was not uploaded.',
      fix: suggestion ? `Enter your Udyam number for an instant lookup. We found a registration for ${suggestion.enterpriseName} in ${suggestion.city} ending ${suggestion.udyamNumber.slice(-4)}; confirm it is yours.` : 'Upload the Udyam certificate or enter your Udyam number for an instant lookup.' });
  } else if (udyamDoc && !readable('udyam_certificate')) {
    // Quality check above already raised a review.
  } else {
    const raw = udyamDoc?.fields.udyamNumber?.value ?? input.enteredUdyam ?? null;
    const num = raw ? normaliseUdyam(raw) : null;
    if (!num) {
      add({ id: 'udyam.number', label: 'Udyam number present', doc: 'udyam_certificate', result: 'flag', read: null,
        why: 'The Udyam certificate does not show a registration number.', fix: 'Download the full certificate from the Udyam portal, or type your Udyam number for a lookup.' });
    } else if (!UDYAM_FORMAT.test(num)) {
      add({ id: 'udyam.number', label: 'Udyam number format', doc: 'udyam_certificate', result: 'review', read: maskId(num, 9, 3), why: 'The Udyam number does not follow the UDYAM-XX-00-0000000 format.', fix: 'Type the Udyam number to confirm it.' });
    } else {
      const rec = await registry.lookupUdyam(num);
      if (!rec) {
        add({ id: 'udyam.registry', label: 'Udyam number found in registry', doc: 'registry', result: 'flag', read: maskId(num, 9, 3), why: 'This Udyam number is not in the Udyam registry.', fix: 'Check the number on the Udyam portal.' });
      } else {
        add({ id: 'udyam.registry', label: 'Udyam number found in registry', doc: 'registry', result: 'pass', read: maskId(num, 9, 3), expected: rec.enterpriseName });
        const nameOnCert = udyamDoc?.fields.enterpriseName?.value ?? rec.enterpriseName;
        const m = compareNames(nameOnCert, rec.enterpriseName);
        const m2 = businessName ? compareNames(rec.enterpriseName, businessName) : { match: 'exact' as const, differing: [] };
        add(m.match !== 'different' && m2.match !== 'different'
          ? { id: 'udyam.name', label: 'Enterprise name matches GST and Udyam', doc: 'udyam_certificate', result: 'pass', read: nameOnCert, expected: rec.enterpriseName }
          : { id: 'udyam.name', label: 'Enterprise name matches GST and Udyam', doc: 'udyam_certificate', result: 'flag', read: nameOnCert, expected: businessName ?? rec.enterpriseName,
              why: `The Udyam record is for “${rec.enterpriseName}”, which does not match ${m.match === 'different' ? `the certificate (“${nameOnCert}”)` : `the GST trade name (“${businessName}”)`}.`, fix: 'Upload the Udyam certificate for this business.' });
        if (gstRec && rec.state !== gstRec.state) {
          add({ id: 'udyam.state', label: 'Udyam state matches GST state', doc: 'udyam_certificate', result: 'flag', read: rec.state, expected: gstRec.state, why: 'The Udyam registration is in a different state from the GSTIN.', fix: 'Upload the Udyam certificate for this location.' });
        }
      }
    }
  }

  // 5. Authorised signatory.
  const sig = docs.signatory_id;
  if (!sig) {
    add({ id: 'sig.missing', label: 'Signatory ID provided', doc: 'signatory_id', result: 'missing', why: 'The authorised signatory ID was not uploaded.', fix: 'Upload the signatory ID, or sign in with DigiLocker to share it.' });
  } else if (readable('signatory_id')) {
    const name = sig.fields.name?.value;
    const prop = gstRec ? proprietorOf(gstRec.legalName) : null;
    if (prop) {
      const m = compareNames(name, prop);
      add(m.match !== 'different'
        ? { id: 'sig.name', label: 'Signatory is the registered proprietor', doc: 'signatory_id', result: 'pass', read: name, expected: prop }
        : { id: 'sig.name', label: 'Signatory is the registered proprietor', doc: 'signatory_id', result: 'flag', read: name, expected: prop,
            why: `The ID belongs to ${name}, but the GST registry lists ${prop} as proprietor.`, fix: 'The proprietor should sign, or upload an authorisation letter from them.' });
    } else if (gstRec) {
      add({ id: 'sig.name', label: 'Signatory authority', doc: 'signatory_id', result: 'pass', read: `${name} (${sig.fields.designation?.value ?? 'role not shown'})`,
        why: `${gstRec.constitution}: authority is confirmed by the e-sign step with a board or partner resolution.` });
    }
    if (businessName) {
      const b = compareNames(sig.fields.business?.value, businessName);
      if (b.match === 'different') add({ id: 'sig.business', label: 'Signatory ID is for this business', doc: 'signatory_id', result: 'flag', read: sig.fields.business?.value, expected: businessName, why: 'The signatory ID is issued for a different business.', fix: 'Upload the signatory ID issued for this business.' });
    }
    const valid = sig.fields.validTill?.value;
    add(valid && valid >= DEMO_TODAY
      ? { id: 'sig.valid', label: 'Signatory ID is in date', doc: 'signatory_id', result: 'pass', read: valid }
      : { id: 'sig.valid', label: 'Signatory ID is in date', doc: 'signatory_id', result: valid ? 'flag' : 'review', read: valid,
          why: valid ? `The ID expired on ${valid}.` : 'We could not read the expiry date.', fix: 'Upload a current ID.' });
  }

  // 6. Address proof.
  const ap = docs.address_proof;
  if (!ap) {
    add({ id: 'addr.missing', label: 'Address proof provided', doc: 'address_proof', result: 'missing', why: 'No address proof was uploaded.', fix: 'Upload an electricity, water or phone bill from the last 90 days.' });
  } else if (readable('address_proof')) {
    const date = ap.fields.billDate?.value;
    const age = date ? daysBetween(date, DEMO_TODAY) : null;
    add(age != null && age >= 0 && age <= ADDRESS_PROOF_MAX_DAYS
      ? { id: 'addr.age', label: `Address proof is under ${ADDRESS_PROOF_MAX_DAYS} days old`, doc: 'address_proof', result: 'pass', read: `${age} days old`, expected: `${ADDRESS_PROOF_MAX_DAYS} days or less` }
      : { id: 'addr.age', label: `Address proof is under ${ADDRESS_PROOF_MAX_DAYS} days old`, doc: 'address_proof', result: age == null ? 'review' : 'flag', read: age == null ? null : `${age} days old (${date})`, expected: `${ADDRESS_PROOF_MAX_DAYS} days or less`,
          why: age == null ? 'We could not read the bill date.' : age < 0 ? 'The bill is dated in the future.' : `The bill is ${age} days old; we accept bills from the last ${ADDRESS_PROOF_MAX_DAYS} days.`,
          fix: 'Upload your latest electricity, water or phone bill.' });
    if (businessName) {
      const b = compareNames(ap.fields.billedTo?.value, businessName);
      const b2 = gstRec ? compareNames(ap.fields.billedTo?.value, gstRec.legalName) : b;
      add(b.match !== 'different' || b2.match !== 'different'
        ? { id: 'addr.name', label: 'Bill is in the business name', doc: 'address_proof', result: 'pass', read: ap.fields.billedTo?.value, expected: businessName }
        : { id: 'addr.name', label: 'Bill is in the business name', doc: 'address_proof', result: 'flag', read: ap.fields.billedTo?.value, expected: businessName, why: 'The bill is in a different name from the business.', fix: 'Upload a bill in the business name, or a rent agreement.' });
    }
    if (gstRec) {
      const pin = ap.fields.pincode?.value, regPin = pincodeOf(gstRec.address);
      add(pin === regPin
        ? { id: 'addr.pincode', label: 'Bill pincode matches GST address', doc: 'address_proof', result: 'pass', read: pin, expected: regPin }
        : { id: 'addr.pincode', label: 'Bill pincode matches GST address', doc: 'address_proof', result: 'flag', read: pin, expected: regPin, why: 'The bill address is not the registered place of business.', fix: 'Upload a bill for the registered address, or add this site as an additional place of business.' });
    }
  }

  const anyFlag = checks.some((c) => c.result === 'flag' || c.result === 'missing');
  const anyReview = checks.some((c) => c.result === 'review');
  const status: KycVerdict['status'] = anyFlag ? 'flagged' : anyReview ? 'review' : 'verified';
  const n = checks.filter((c) => c.result !== 'pass' && c.result !== 'info').length;
  const summary = status === 'verified'
    ? `All ${checks.length} checks passed.`
    : status === 'review'
      ? `${n} item${n > 1 ? 's need' : ' needs'} a person to look. Everything else passed.`
      : `${n} item${n > 1 ? 's need' : ' needs'} your attention before activation.`;
  return { status, checks, summary, registry: { gstin: gstRec, adapter: registry.id }, gstinUsed: gstin ? maskId(gstin) : null, ms: Date.now() - t0 };
}
