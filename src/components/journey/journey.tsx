'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Check, Languages, RotateCcw, Timer } from 'lucide-react';
import { Logo } from '@/components/site-header';
import { LANGUAGES } from '@/lib/languages';
import { t } from '@/lib/i18n';
import { formatClock } from '@/lib/format';
import type { Language } from '@/lib/types';
import { JourneyProvider, STEPS, useJourney, type Step } from './store';
import { Advisor } from './advisor';
import { QuoteStep } from './quote';
import { KycStep } from './kyc';
import { CheckoutStep } from './checkout';
import { DoneStep } from './done';
import { InsightPanel } from './insight-panel';

export function Journey() {
  return (
    <JourneyProvider>
      <JourneyShell />
    </JourneyProvider>
  );
}

const STEP_KEY = { advisor: 'steps_advisor', quote: 'steps_quote', kyc: 'steps_kyc', checkout: 'steps_checkout', done: 'steps_track' } as const;


function Clock() {
  const { state } = useJourney();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!state.startedAt || state.finishedAt) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [state.startedAt, state.finishedAt]);
  const elapsed = state.startedAt ? (state.finishedAt ?? now) - state.startedAt : 0;
  return (
    <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium num ${state.finishedAt ? 'bg-pass-soft text-pass' : state.startedAt ? 'bg-ink text-white' : 'bg-paper-2 text-muted'}`}
      title="Onboarding timer: first message to placed order">
      <Timer className="size-3.5" aria-hidden />
      <span className="font-mono">{formatClock(elapsed)}</span>
    </div>
  );
}

function Stepper() {
  const { state, dispatch } = useJourney();
  const idx = STEPS.indexOf(state.step);
  const reachable = (s: Step) => {
    if (state.orderId) return s === 'done';
    if (s === 'advisor') return true;
    if (s === 'quote') return state.lines.length > 0;
    if (s === 'kyc') return state.lines.length > 0 && !!state.stepTimes.kyc;
    if (s === 'checkout') return !!state.verdict && state.verdict.status !== 'flagged';
    return false;
  };
  return (
    <ol className="flex items-center gap-1 overflow-x-auto no-scrollbar" aria-label="Progress">
      {STEPS.map((s, i) => {
        const done = i < idx || (s === 'done' && !!state.orderId);
        const current = s === state.step;
        return (
          <li key={s} className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              disabled={!reachable(s) || current}
              onClick={() => dispatch({ type: 'go', step: s })}
              aria-current={current ? 'step' : undefined}
              className={`flex items-center gap-1.5 rounded-full py-1.5 pl-1.5 pr-3 text-[13px] font-medium transition-colors ${current ? 'bg-ink text-white' : done ? 'text-ink hover:bg-paper-2' : 'text-muted'} disabled:cursor-default`}
            >
              <span className={`grid size-5 place-items-center rounded-full text-[11px] ${current ? 'bg-white text-ink' : done ? 'bg-pass text-white' : 'bg-paper-2 text-muted'}`}>
                {done && !current ? <Check className="size-3" strokeWidth={3} /> : i + 1}
              </span>
              {t(STEP_KEY[s], state.language)}
            </button>
            {i < STEPS.length - 1 && <span className="h-px w-3 bg-line-2" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

function LanguagePicker() {
  const { state, dispatch } = useJourney();
  return (
    <label className="relative flex items-center gap-1.5 rounded-full border border-line-2 bg-white pl-2.5 pr-1 py-1 text-xs font-medium">
      <Languages className="size-3.5 text-muted" aria-hidden />
      <span className="sr-only">Language</span>
      <select
        value={state.languageLocked ? state.language : 'auto'}
        onChange={(e) => {
          const v = e.target.value;
          dispatch({ type: 'patch', patch: v === 'auto' ? { languageLocked: false } : { language: v as Language, languageLocked: true } });
        }}
        className="appearance-none bg-transparent pr-1 focus:outline-none"
      >
        <option value="auto">Auto ({LANGUAGES.find((l) => l.code === state.language)?.native})</option>
        {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.native} · {l.label}</option>)}
      </select>
    </label>
  );
}

function JourneyShell() {
  const { state, dispatch } = useJourney();
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 h-14">
          <Logo compact />
          <div className="flex-1 min-w-0"><Stepper /></div>
          <div className="hidden sm:block"><LanguagePicker /></div>
          <Clock />
          <button type="button" className="hidden sm:grid size-8 place-items-center rounded-full text-muted hover:bg-paper-2 hover:text-ink" title="Start over"
            onClick={() => { if (confirm('Start a new journey? Your current progress will be cleared.')) dispatch({ type: 'reset' }); }}>
            <RotateCcw className="size-4" />
            <span className="sr-only">Start over</span>
          </button>
        </div>
        <div className="sm:hidden px-4 pb-2 flex justify-between items-center"><LanguagePicker /><Link href="/" className="text-xs text-muted">Exit</Link></div>
      </header>
      <div className={`mx-auto w-full max-w-7xl flex-1 grid gap-6 px-4 py-6 ${state.step === 'advisor' ? 'lg:grid-cols-[minmax(0,1fr)_340px]' : ''}`}>
        <main className="min-w-0">
          {state.step === 'advisor' && <Advisor />}
          {state.step === 'quote' && <QuoteStep />}
          {state.step === 'kyc' && <KycStep />}
          {state.step === 'checkout' && <CheckoutStep />}
          {state.step === 'done' && <DoneStep />}
        </main>
        {state.step === 'advisor' && <aside className="hidden lg:block"><InsightPanel /></aside>}
      </div>
    </div>
  );
}
