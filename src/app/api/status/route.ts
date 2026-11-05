import { groqConfigured, GROQ_MODEL } from '@/lib/advisor/groq';
import { getRegistry } from '@/lib/registry';

// Live probe of the exact call the advisor makes, so the UI can say honestly which engine runs.
async function probeChat() {
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: GROQ_MODEL, messages: [{ role: 'user', content: 'Reply with {"ok":true}' }], response_format: { type: 'json_object' }, max_tokens: 10 }),
      signal: AbortSignal.timeout(8000),
    });
    const detail = r.ok ? 'connected' : (await r.text()).slice(0, 120).replace(/gsk_[A-Za-z0-9]+/g, '[redacted]');
    return { ok: r.ok, status: r.status, detail };
  } catch (e) {
    return { ok: false, status: 0, detail: (e as Error).message };
  }
}

export async function GET(req: Request) {
  const r = getRegistry();
  const live = new URL(req.url).searchParams.get('check') === '1' && groqConfigured() ? await probeChat() : null;
  return Response.json({ llm: groqConfigured() ? { provider: 'Groq', model: GROQ_MODEL, live } : null, registry: { id: r.id, label: r.label } });
}
