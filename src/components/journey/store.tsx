'use client';

import { createContext, useContext, useEffect, useReducer, type Dispatch, type ReactNode } from 'react';
import type { Recommendation } from '@/lib/engine';
import type { BundleLine, ChatMessage, DocType, ExtractedDoc, GstinRecord, KycVerdict, Language, Profile, UdyamRecord } from '@/lib/types';

export type Step = 'advisor' | 'quote' | 'kyc' | 'checkout' | 'done';
export const STEPS: Step[] = ['advisor', 'quote', 'kyc', 'checkout', 'done'];

export type ChatEntry = ChatMessage & { id: string; rec?: Recommendation; quickReplies?: string[]; engine?: 'groq' | 'fallback'; ms?: number; handoff?: boolean };
export type Consent = { id: string; at: string; version: string; purposes: string[] };
export type DocSlot = { name: string; src: string; status: 'reading' | 'done' | 'error'; extracted?: ExtractedDoc; error?: string; specimen?: string };

export type JourneyState = {
  step: Step;
  language: Language;
  languageLocked: boolean;
  messages: ChatEntry[];
  profile: Profile;
  rec: Recommendation | null;
  lines: BundleLine[];
  startedAt: number | null;
  finishedAt: number | null;
  stepTimes: Partial<Record<Step, number>>;
  consent: Consent | null;
  gstinInput: string;
  gstRecord: GstinRecord | null;
  udyamInput: string;
  udyamRecord: UdyamRecord | null;
  docs: Partial<Record<DocType, DocSlot>>;
  verdict: KycVerdict | null;
  orderId: string | null;
  handoffId: string | null;
};

const initial: JourneyState = {
  step: 'advisor', language: 'en', languageLocked: false, messages: [], profile: {}, rec: null, lines: [], startedAt: null, finishedAt: null,
  stepTimes: {}, consent: null, gstinInput: '', gstRecord: null, udyamInput: '', udyamRecord: null, docs: {}, verdict: null, orderId: null, handoffId: null,
};

type Action =
  | { type: 'hydrate'; state: JourneyState }
  | { type: 'patch'; patch: Partial<JourneyState> }
  | { type: 'go'; step: Step }
  | { type: 'addMessage'; message: ChatEntry }
  | { type: 'setDoc'; doc: DocType; slot: DocSlot | null }
  | { type: 'reset' };

function reducer(s: JourneyState, a: Action): JourneyState {
  switch (a.type) {
    case 'hydrate': return a.state;
    case 'patch': return { ...s, ...a.patch };
    case 'go': return { ...s, step: a.step, stepTimes: { ...s.stepTimes, [a.step]: s.stepTimes[a.step] ?? Date.now() } };
    case 'addMessage': return { ...s, messages: [...s.messages, a.message], startedAt: s.startedAt ?? (a.message.role === 'user' ? Date.now() : null) };
    case 'setDoc': {
      const docs = { ...s.docs };
      if (a.slot) docs[a.doc] = a.slot; else delete docs[a.doc];
      return { ...s, docs, verdict: null };
    }
    case 'reset': return { ...initial, language: s.language, languageLocked: s.languageLocked };
  }
}

const Ctx = createContext<{ state: JourneyState; dispatch: Dispatch<Action> } | null>(null);
export const JourneyContextOptional = Ctx;
const KEY = 'udyam.journey.v1';

export function JourneyProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) dispatch({ type: 'hydrate', state: { ...initial, ...JSON.parse(raw), docs: {} } });
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    // Document images are never persisted; only the conversation and choices are.
    const { docs: _docs, ...rest } = state;
    try { sessionStorage.setItem(KEY, JSON.stringify(rest)); } catch { /* ignore */ }
  }, [state]);
  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export function useJourney() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useJourney outside provider');
  return c;
}

export type TimedRun = { at: string; seconds: number; steps: Partial<Record<Step, number>>; orderId: string; monthly: number; kyc: string; engine: string };
export const RUNS_KEY = 'udyam.runs.v1';
export function saveRun(run: TimedRun) {
  try {
    const runs: TimedRun[] = JSON.parse(localStorage.getItem(RUNS_KEY) ?? '[]');
    runs.unshift(run);
    localStorage.setItem(RUNS_KEY, JSON.stringify(runs.slice(0, 50)));
  } catch { /* ignore */ }
}
