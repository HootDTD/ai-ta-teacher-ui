export const runtime = 'nodejs';

type Params = { params: Promise<{ problem_id: string }> };

// PATCH — edit a concept problem's question and reference-solution content.
export async function PATCH(req: Request, { params }: Params) {
  const rawBackend = process.env.AI_TA_API_BASE_URL;
  const backend = rawBackend ? rawBackend.replace(/\/+$/, '') : '';
  if (!backend) {
    return new Response('AI_TA_API_BASE_URL missing', { status: 500 });
  }

  const authHeader = req.headers.get('authorization');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authHeader) headers.Authorization = authHeader;
  const { problem_id } = await params;
  const resp = await fetch(
    `${backend}/apollo/authored-sets/problems/${encodeURIComponent(problem_id)}`,
    {
      method: 'PATCH',
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
