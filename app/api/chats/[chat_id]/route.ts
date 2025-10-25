export const runtime = 'nodejs';

export async function POST(req: Request, ctx: { params: Promise<{ chat_id: string }> }) {
  const backend = process.env.AI_TA_API_BASE_URL;
  if (!backend) return new Response('AI_TA_API_BASE_URL missing', { status: 500 });

  const body = await req.text();
  const { chat_id } = await ctx.params;
  const resp = await fetch(`${backend}/chats/${encodeURIComponent(chat_id)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  return new Response(resp.body, { status: resp.status, headers: { 'Content-Type': 'application/json' } });
}
