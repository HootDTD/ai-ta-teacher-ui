export const runtime = 'nodejs';

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const rawBackend = process.env.AI_TA_API_BASE_URL;
  const backend = rawBackend ? rawBackend.replace(/\/+$/, '') : '';
  if (!backend) {
    return new Response('AI_TA_API_BASE_URL missing', { status: 500 });
  }

  const authHeader = req.headers.get('authorization');
  const headers: Record<string, string> = {};
  if (authHeader) headers.Authorization = authHeader;

  const { code } = await ctx.params;
  let resp: Response;
  try {
    resp = await fetch(`${backend}/invite-links/redeem/${encodeURIComponent(code)}`, {
      method: 'POST',
      headers,
      cache: 'no-store',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown backend error';
    return new Response(msg, { status: 502 });
  }

  return new Response(resp.body, {
    status: resp.status,
    headers: {
      'Content-Type': resp.headers.get('content-type') ?? 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
