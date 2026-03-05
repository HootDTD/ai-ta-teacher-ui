export const runtime = 'nodejs';

export async function POST(req: Request, ctx: { params: Promise<{ chat_id: string }> }) {
  const rawBackend = process.env.AI_TA_API_BASE_URL;
  const backend = rawBackend ? rawBackend.replace(/\/+$/, '') : '';
  if (!backend) return new Response('AI_TA_API_BASE_URL missing', { status: 500 });

  const body = await req.text();
  const authHeader = req.headers.get('authorization');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authHeader) headers.Authorization = authHeader;
  const { chat_id } = await ctx.params;
  const resp = await fetch(`${backend}/chats/${encodeURIComponent(chat_id)}`, {
    method: 'POST',
    headers,
    body,
  });
  return new Response(resp.body, { status: resp.status, headers: { 'Content-Type': 'application/json' } });
}
