export const runtime = 'nodejs';

// Fetch a report by ID
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const rawBackend = process.env.AI_TA_API_BASE_URL;
  const backend = rawBackend ? rawBackend.replace(/\/+$/, '') : '';
  if (!backend) return new Response('AI_TA_API_BASE_URL missing', { status: 500 });

  const authHeader = req.headers.get('authorization');
  const headers: Record<string, string> = {};
  if (authHeader) headers.Authorization = authHeader;
  const { id } = await ctx.params;
  const resp = await fetch(`${backend}/reports/ai-use/${encodeURIComponent(id)}`, { headers });
  const body = await resp.text();
  return new Response(body, {
    status: resp.status,
    headers: { 'Content-Type': resp.headers.get('content-type') ?? 'application/json' },
  });
}

// Create a report for a chat (id here is the chat_id)
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const rawBackend = process.env.AI_TA_API_BASE_URL;
  const backend = rawBackend ? rawBackend.replace(/\/+$/, '') : '';
  if (!backend) return new Response('AI_TA_API_BASE_URL missing', { status: 500 });

  const body = await req.text();
  const authHeader = req.headers.get('authorization');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authHeader) headers.Authorization = authHeader;
  const { id } = await ctx.params;
  const resp = await fetch(`${backend}/reports/ai-use/${encodeURIComponent(id)}`, {
    method: 'POST',
    headers,
    body,
  });
  return new Response(resp.body, {
    status: resp.status,
    headers: { 'Content-Type': resp.headers.get('content-type') ?? 'application/json' },
  });
}
