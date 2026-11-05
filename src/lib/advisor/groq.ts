import 'server-only';

const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
export const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

export function groqConfigured(): boolean {
  return !!process.env.GROQ_API_KEY;
}

type Msg = { role: 'system' | 'user' | 'assistant'; content: string };

export async function groqJson<T = unknown>(messages: Msg[], opts: { temperature?: number; maxTokens?: number; timeoutMs?: number } = {}): Promise<T> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY is not configured');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 12_000);
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature: opts.temperature ?? 0.2,
        max_tokens: opts.maxTokens ?? 700,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Groq ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    const content: string = data.choices?.[0]?.message?.content ?? '{}';
    return JSON.parse(content) as T;
  } finally {
    clearTimeout(timer);
  }
}
