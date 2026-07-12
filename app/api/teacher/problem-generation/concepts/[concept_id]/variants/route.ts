export const runtime = 'nodejs';

export async function POST(
  req: Request,
  ctx: { params: Promise<{ concept_id: string }> },
) {
  const rawBackend = process.env.AI_TA_API_BASE_URL;
  const backend = rawBackend ? rawBackend.replace(/\/+$/, '') : '';
  if (!backend) {
    return new Response('AI_TA_API_BASE_URL missing', { status: 500 });
  }

  const authHeader = req.headers.get('authorization');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authHeader) headers.Authorization = authHeader;
  const { concept_id } = await ctx.params;
  const resp = await fetch(
    `${backend}/apollo/problem-generation/concepts/${encodeURIComponent(concept_id)}/variants`,
    {
      method: 'POST',
      headers,
      body: await req.text(),
      cache: 'no-store',
    },
  );
  const body = await resp.text();

  return new Response(body, {
    status: resp.status,
    headers: {
      'Content-Type': resp.headers.get('content-type') ?? 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
