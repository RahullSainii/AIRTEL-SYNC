import { advisorTurn } from '@/lib/advisor/advisor';
import type { ChatMessage, Language, Profile } from '@/lib/types';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { messages?: ChatMessage[]; profile?: Profile; language?: Language | null; currentLanguage?: Language | null } | null;
  if (!body || !Array.isArray(body.messages) || !body.messages.length) return Response.json({ error: 'messages required' }, { status: 400 });
  const messages = body.messages.filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string');
  const result = await advisorTurn({ messages, profile: body.profile ?? {}, language: body.language ?? null, currentLanguage: body.currentLanguage ?? null });
  return Response.json(result);
}
