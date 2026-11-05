# Udyam Digital — Accel YTL Hackathon 2026, Enterprise Track A

**From days to seconds.** A small business owner describes their shop on a phone, in their own language, and leaves with the right bundle, verified KYC and a live installation date. Team Techuminati.

All businesses, registries and documents are synthetic hackathon data. Registries are mock; documents are specimens.
<img width="1912" height="822" alt="image" src="https://github.com/user-attachments/assets/909f75d7-c83c-4a75-93fd-9ca4db65e48f" />

<img width="1915" height="932" alt="image" src="https://github.com/user-attachments/assets/62425efc-ea04-4ec0-932d-05a6610b43f0" />


## What is in the prototype

| Route | What it does |
| --- | --- |
| `/onboard` | Owner journey: AI advisor (chat + voice, 10 languages) → one-price quote with add-on toggles → DPDP consent → Smart KYC → e-sign + UPI (simulated) → order. A timer measures first message to order. |
| `/track/[id]` | Order tracker: stages with dates from catalogue install days, per-product ETAs, WhatsApp-style updates, one-tap consent withdrawal. |
| `/partner` | Partner desk: advisor handoffs with transcript and draft quote, propensity-ranked call list (4,632 dropped leads), funnel and segment insights, orders, consent and audit log. |
| `/evidence` | Rerunnable proof: timed runs, KYC bench on all 12 applicants, OCR robustness lab, 15 advisor scenarios (engine + live replay), model card. |
| `/architecture` | Architecture diagram, request flow, path to live registries, 1-page privacy note, pilot pass criteria and risks. |

## Design choices that matter to judges

- **The LLM never decides money or compliance.** Groq (`llama-3.3-70b-versatile`) extracts the business profile and explains the result in the owner's language. A deterministic rules engine (`src/lib/engine.ts`) applies every catalogue rule — city tier, minimum staff and sites, GSTIN-only products, `requires_one_of` dependencies — and prices from the catalogue. If the LLM is unreachable, offline rules take over (English, Hindi, Hinglish).
- **GSTIN checksum straight after OCR** (`src/lib/gstin.ts`). Structural fixes first (a letter O in a digit slot), then checksum-guided recovery of one look-alike character, accepted only if the result exists in the registry. This fixes the K02 false flag and recovers K10, while K06 (a genuinely wrong digit on the certificate) is still flagged.
- **Images never leave the phone.** OCR runs in the browser (self-hosted Tesseract); only extracted fields are sent, with a consent ID that every registry and KYC API requires.
- **Nothing approved or rejected silently.** Every non-pass check returns *Why* and *Fix*. Unreadable scans and registry outages go to a person.
- **Registry adapter** (`src/lib/registry/`): one interface; the mock CSV adapter can be swapped for a licensed GSP (GSTIN) and the Udyam/DigiLocker APIs via `REGISTRY_ADAPTER`, with no caller changes.

## Measured results (rerun them on `/evidence`)

| Metric | Result |
| --- | --- |
| KYC verdicts on 12 specimen applicants | 12/12 correct (5 flagged, 1 human review, 6 verified) |
| Field accuracy (130 fields, clean set) | 96.2% |
| Upload-to-verdict, 4 documents, in browser | ~2.9 s median, ~3.3 s worst |
| Rough photos (rotated 7°) | 7/12 right verdict, 4/12 sent to a person, **0 false approvals** |
| Rough photos (blurred) | 3/12 right verdict, 10/12 sent to a person, **0 false approvals** |
| Advisor eligibility scenarios | 15/15 (rules engine) |
| Deck bundle prices reproduced | ₹3,118 · ₹1,897 · ₹5,994 · ₹9,999 · ₹1,397 |
| Call-priority model | hold-out AUC 0.724; top 20% activate at 12.9% vs 7.0% (1.8×) |

Our KYC answer key (`src/data/kyc-answer-key.json`) comes from inspecting the specimens: K01 cancelled GSTIN + Udyam certificate missing its number; K04 blurred GST certificate; K05 no Udyam certificate; K06 wrong digit in the printed GSTIN; K07 legal name differs from the registry; K11 address proof 257 days old. K02 (rotated scan), K03, K08, K09, K10 and K12 are clean.

Data insight for the business case: website-form and WhatsApp-campaign leads activate at only 4.3% and 2.8% today, versus 14.8% for referrals. Today's digital leads are the worst converters; a self-serve journey targets exactly them.

## Suggested 3-minute demo

1. `/onboard`: type *"I run a pharmacy in Jaipur with 5 staff, GST, need internet and CCTV"* → bundle ₹1,397 with reasons. Show the Hindi/Hinglish example chip and the mic.
2. Quote: toggle CCTV off and on; try a locked product to show the reason.
3. KYC: consent screen, then load specimen **K07** → *Flagged* with Why/Fix. Load **K03** → *Verified*. Say aloud that registries are mock and documents are specimens.
4. Checkout → *Order placed in m:ss* → tracker → *Simulate next update*.
5. `/partner`: the handoff and the ranked call list. `/evidence`: run the KYC bench live.

## Run and test

```bash
pnpm install
pnpm dev            # copies OCR assets + specimens into public/, then starts Next.js
pnpm test           # 51 unit tests: engine, GSTIN, KYC verdicts, advisor, scenarios
pnpm benchmark      # end-to-end KYC benchmark in Node on the 47 specimen documents
pnpm data           # regenerate catalogue, registries, analytics and the model from the CSVs
```

Environment: `GROQ_API_KEY` (server only). Optional `GROQ_MODEL`, `REGISTRY_ADAPTER`.

Prototype boundary: in-memory store (resets on restart), mock registries, specimen documents, simulated e-sign and UPI, demo "today" fixed at 2026-07-15 as the dataset README specifies.
