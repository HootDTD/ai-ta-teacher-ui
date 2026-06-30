export const runtime = 'nodejs';

// POST — approve a held-for-review problem, promoting the teacher-chosen
// reference (body: {reference: "ocr" | "generated"}).
export async function POST(
  req: Request,
  ctx: { params: Promise<{ set_id: string; problem_id: string }> },
) {
  const rawBackend = process.env.AI_TA_API_BASE_URL;
  const backend = rawBackend ? rawBackend.replace(/\/+$/, '') : '';
  if (!backend) {
    return new Response('AI_TA_API_BASE_URL missing', { status: 500 });
  }

  const bodyText = await req.text();
  const authHeader = req.headers.get('authorization');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authHeader) headers.Authorization = authHeader;
  const { set_id, problem_id } = await ctx.params;
  const resp = await fetch(
    `${backend}/apollo/authored-sets/${encodeURIComponent(set_id)}/problems/${encodeURIComponent(problem_id)}/approve`,
    { method: 'POST', headers, body: bodyText, cache: 'no-store' },
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
