export const runtime = 'nodejs';

export async function GET(
  req: Request,
  ctx: { params: Promise<{ run_id: string }> },
) {
  const rawBackend = process.env.AI_TA_API_BASE_URL;
  const backend = rawBackend ? rawBackend.replace(/\/+$/, '') : '';
  if (!backend) {
    return new Response('AI_TA_API_BASE_URL missing', { status: 500 });
  }

  const authHeader = req.headers.get('authorization');
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (authHeader) headers.Authorization = authHeader;
  const { run_id } = await ctx.params;
  const fullText = new URL(req.url).searchParams.get('full_text');
  const fullTextQuery =
    fullText == null ? '' : `?full_text=${encodeURIComponent(fullText)}`;
  const resp = await fetch(
    `${backend}/apollo/problem-generation/runs/${encodeURIComponent(run_id)}${fullTextQuery}`,
    { headers, cache: 'no-store' },
  );

  return new Response(resp.body, {
    status: resp.status,
    headers: {
      'Content-Type': resp.headers.get('content-type') ?? 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
