export const runtime = 'nodejs';

// GET — poll one authored set's status + result_summary (per-problem outcomes).
export async function GET(req: Request, ctx: { params: Promise<{ set_id: string }> }) {
  const rawBackend = process.env.AI_TA_API_BASE_URL;
  const backend = rawBackend ? rawBackend.replace(/\/+$/, '') : '';
  if (!backend) {
    return new Response('AI_TA_API_BASE_URL missing', { status: 500 });
  }

  const authHeader = req.headers.get('authorization');
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (authHeader) headers.Authorization = authHeader;
  const { set_id } = await ctx.params;
  const resp = await fetch(`${backend}/apollo/authored-sets/${encodeURIComponent(set_id)}`, {
    headers,
    cache: 'no-store',
  });

  return new Response(resp.body, {
    status: resp.status,
    headers: {
      'Content-Type': resp.headers.get('content-type') ?? 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

// DELETE — remove an authored set (and the problems + reference docs it produced).
// Used to clear failed/stuck runs off the teacher console.
export async function DELETE(req: Request, ctx: { params: Promise<{ set_id: string }> }) {
  const rawBackend = process.env.AI_TA_API_BASE_URL;
  const backend = rawBackend ? rawBackend.replace(/\/+$/, '') : '';
  if (!backend) {
    return new Response('AI_TA_API_BASE_URL missing', { status: 500 });
  }

  const authHeader = req.headers.get('authorization');
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (authHeader) headers.Authorization = authHeader;
  const { set_id } = await ctx.params;
  const resp = await fetch(`${backend}/apollo/authored-sets/${encodeURIComponent(set_id)}`, {
    method: 'DELETE',
    headers,
    cache: 'no-store',
  });

  return new Response(resp.body, {
    status: resp.status,
    headers: {
      'Content-Type': resp.headers.get('content-type') ?? 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
