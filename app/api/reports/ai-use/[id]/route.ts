export const runtime = 'nodejs';

// Fetch a report by ID
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const backend = process.env.AI_TA_API_BASE_URL;
  if (!backend) return new Response('AI_TA_API_BASE_URL missing', { status: 500 });

  const { id } = await ctx.params;
  const resp = await fetch(`${backend}/reports/ai-use/${encodeURIComponent(id)}`);
  const body = await resp.text();
  return new Response(body, {
    status: resp.status,
    headers: { 'Content-Type': resp.headers.get('content-type') ?? 'application/json' },
  });
}

// Create a report for a chat (id here is the chat_id)
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const backend = process.env.AI_TA_API_BASE_URL;
  if (!backend) return new Response('AI_TA_API_BASE_URL missing', { status: 500 });

  const body = await req.text();
  const { id } = await ctx.params;
  const resp = await fetch(`${backend}/reports/ai-use/${encodeURIComponent(id)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  return new Response(resp.body, {
    status: resp.status,
    headers: { 'Content-Type': resp.headers.get('content-type') ?? 'application/json' },
  });
}
