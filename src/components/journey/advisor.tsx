'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Headset, Mic, MicOff, Volume2 } from 'lucide-react';
import type { AdvisorResponse } from '@/lib/advisor/advisor';
import { EXAMPLES, t } from '@/lib/i18n';
import { LANGUAGES } from '@/lib/languages';
import { BundleCard } from './bundle-card';
import { useJourney, type ChatEntry } from './store';

type SpeechRec = { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };

const uid = () => Math.random().toString(36).slice(2, 10);

export function Advisor() {
  const { state, dispatch } = useJourney();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [canListen, setCanListen] = useState(false);
  const recRef = useRef<SpeechRec | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const lang = state.language;
  const speechLang = LANGUAGES.find((l) => l.code === lang)?.speech ?? 'en-IN';

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    setCanListen(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [state.messages.length, busy]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    setInput('');
    setError(null);
    const userMsg: ChatEntry = { id: uid(), role: 'user', content };
    dispatch({ type: 'addMessage', message: userMsg });
    setBusy(true);
    try {
      const res = await fetch('/api/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...state.messages, userMsg].map(({ role, content }) => ({ role, content })), profile: state.profile, language: state.languageLocked ? state.language : null, currentLanguage: state.messages.length ? state.language : null }),
      });
      if (!res.ok) throw new Error(`Advisor error ${res.status}`);
      const data: AdvisorResponse = await res.json();
      const patch: Partial<typeof state> = { profile: data.profile, rec: data.recommendation };
      if (!state.languageLocked) patch.language = data.language;
      if (data.recommendation.status === 'ok') patch.lines = data.recommendation.lines;
      dispatch({ type: 'patch', patch });
      dispatch({ type: 'addMessage', message: { id: uid(), role: 'assistant', content: data.reply, rec: data.recommendation.status === 'ok' ? data.recommendation : undefined, quickReplies: data.quickReplies, engine: data.engine, ms: data.ms, handoff: data.handoff } });
      if (data.handoff && !state.handoffId) void createHandoff('Owner asked for a call back during the chat', data.profile);
    } catch (e) {
      setError((e as Error).message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function createHandoff(reason: string, profile = state.profile) {
    const res = await fetch('/api/handoffs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile, lines: state.lines, reason, language: state.language, transcript: state.messages.map((m) => `${m.role === 'user' ? 'Owner' : 'Advisor'}: ${m.content}`) }),
    });
    if (!res.ok) return;
    const h = await res.json();
    dispatch({ type: 'patch', patch: { handoffId: h.id } });
    return h as { id: string; partner: string };
  }

  async function talkToPerson() {
    const h = await createHandoff('Owner tapped “Talk to a person”');
    if (!h) return;
    dispatch({ type: 'addMessage', message: { id: uid(), role: 'assistant', content: lang === 'hi'
      ? `ठीक है! ${h.partner} आपको 2 कामकाजी घंटों में कॉल करेंगे। उनके पास हमारी अब तक की बातचीत और आपका कोट है, तो आपको दोबारा कुछ नहीं बताना होगा। (रेफ़रेंस ${h.id})`
      : `Done. ${h.partner} will call you within 2 working hours. They can see this conversation and your quote, so you will not have to repeat yourself. Reference ${h.id}.` } });
  }

  // Some suggested replies are actions rather than messages.
  function onChip(c: string) {
    if (/^(review my quote|कोट देखें|review quote)$/i.test(c.trim()) && state.lines.length) { dispatch({ type: 'go', step: 'quote' }); return; }
    if (/^(talk to a person|किसी से बात करें)$/i.test(c.trim())) { if (!state.handoffId) void talkToPerson(); return; }
    void send(c);
  }

  function toggleMic() {
    if (listening) { recRef.current?.stop(); return; }
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = speechLang;
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = '';
    rec.onresult = (e) => {
      finalText = Array.from(e.results).map((r) => r[0].transcript).join(' ');
      setInput(finalText);
    };
    rec.onend = () => { setListening(false); if (finalText.trim()) void send(finalText); };
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  function speak(text: string) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[•₹]/g, (c) => (c === '₹' ? 'rupees ' : '')));
    u.lang = speechLang;
    window.speechSynthesis.speak(u);
  }

  const last = state.messages[state.messages.length - 1];
  const chips = last?.role === 'assistant' && last.quickReplies?.length ? last.quickReplies : state.messages.length === 0 ? EXAMPLES[lang === 'hi' ? 'hi' : 'en'] : [];

  return (
    <section className="card flex h-[calc(100dvh-8.5rem)] min-h-[520px] flex-col overflow-hidden" aria-label="Business advisor chat">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="relative grid size-9 place-items-center rounded-full bg-brand font-display text-white text-sm font-semibold">U<span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white bg-pass" /></span>
          <div className="leading-tight">
            <div className="font-semibold">Udyam advisor</div>
            <div className="text-xs text-muted">Replies in 10 Indian languages · prices checked against the catalogue</div>
          </div>
        </div>
        <button type="button" onClick={talkToPerson} disabled={!!state.handoffId} className="btn btn-ghost btn-sm">
          <Headset className="size-4" />{state.handoffId ? 'Partner notified' : t('talk_person', lang)}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-4" aria-live="polite">
        <Bubble role="assistant">{t('welcome', lang)}</Bubble>
        {state.messages.map((m) => (
          <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : ''}>
            <Bubble role={m.role} onSpeak={m.role === 'assistant' ? () => speak(m.content) : undefined} meta={m.role === 'assistant' && m.engine ? `${m.engine === 'groq' ? 'Groq LLM' : 'Offline rules'} · ${((m.ms ?? 0) / 1000).toFixed(1)}s` : undefined}>
              {m.content}
            </Bubble>
            {m.rec && m.rec.status === 'ok' && (
              <div className="max-w-xl">
                <BundleCard rec={m.rec} language={lang} onReview={m.id === [...state.messages].reverse().find((x) => x.rec)?.id ? () => dispatch({ type: 'go', step: 'quote' }) : undefined} />
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-sm text-muted">
            <span className="flex gap-1">{[0, 1, 2].map((i) => <span key={i} className="size-1.5 rounded-full bg-ink animate-pulse-dot" style={{ animationDelay: `${i * 0.15}s` }} />)}</span>
            {t('thinking', lang)}
          </div>
        )}
        {error && <p className="rounded-xl bg-block-soft px-3 py-2 text-sm text-block">{error}</p>}
        <div ref={endRef} />
      </div>

      <div className="border-t border-line bg-paper/50 px-4 py-3">
        {chips.length > 0 && (
          <div className="mb-2.5 flex gap-2 overflow-x-auto pb-1">
            {chips.map((c) => <button key={c} type="button" className="chip shrink-0" onClick={() => onChip(c)} disabled={busy}>{c}</button>)}
          </div>
        )}
        <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); void send(input); }}>
          <label className="sr-only" htmlFor="advisor-input">Message</label>
          <textarea id="advisor-input" rows={1} value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(input); } }}
            placeholder={listening ? t('listening', lang) : t('placeholder', lang)} className="input resize-none max-h-32 min-h-[46px]" />
          {canListen && (
            <button type="button" onClick={toggleMic} className={`grid size-[46px] shrink-0 place-items-center rounded-full border transition-colors ${listening ? 'border-brand bg-brand text-white' : 'border-line-2 bg-white text-ink hover:bg-paper-2'}`} aria-label={listening ? 'Stop voice input' : 'Speak your answer'}>
              {listening ? <MicOff className="size-5" /> : <Mic className="size-5" />}
            </button>
          )}
          <button type="submit" disabled={busy || !input.trim()} className="grid size-[46px] shrink-0 place-items-center rounded-full bg-ink text-white disabled:opacity-30" aria-label="Send">
            <ArrowUp className="size-5" />
          </button>
        </form>
      </div>
    </section>
  );
}

function Bubble({ role, children, onSpeak, meta }: { role: 'user' | 'assistant'; children: React.ReactNode; onSpeak?: () => void; meta?: string }) {
  if (role === 'user') return <div className="max-w-[85%] rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-[15px] leading-relaxed text-white whitespace-pre-wrap animate-rise">{children}</div>;
  return (
    <div className="max-w-xl animate-rise">
      <div className="rounded-2xl rounded-tl-md bg-paper-2/70 px-4 py-3 text-[15px] leading-relaxed text-ink whitespace-pre-wrap">{children}</div>
      {(onSpeak || meta) && (
        <div className="mt-1 flex items-center gap-3 pl-1 text-[11px] text-muted">
          {onSpeak && <button type="button" onClick={onSpeak} className="flex items-center gap-1 hover:text-ink"><Volume2 className="size-3.5" />Listen</button>}
          {meta && <span className="font-mono">{meta}</span>}
        </div>
      )}
    </div>
  );
}
