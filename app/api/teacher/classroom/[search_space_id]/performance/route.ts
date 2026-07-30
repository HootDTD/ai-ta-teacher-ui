export const runtime = 'nodejs';

export async function GET(
  req: Request,
  ctx: { params: Promise<{ search_space_id: string }> },
) {
  const rawBackend = process.env.AI_TA_API_BASE_URL;
  const backend = rawBackend ? rawBackend.replace(/\/+$/, '') : '';
  if (!backend) {
    return new Response('AI_TA_API_BASE_URL missing', { status: 500 });
  }

  const authHeader = req.headers.get('authorization');
  const headers: Record<string, string> = {};
  if (authHeader) headers.Authorization = authHeader;
  const { search_space_id } = await ctx.params;
  const resp = await fetch(
    `${backend}/apollo/teacher/classroom/${encodeURIComponent(search_space_id)}/performance`,
    {
      method: 'GET',
      headers,
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
