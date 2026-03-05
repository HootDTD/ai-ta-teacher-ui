export const runtime = 'nodejs';

export async function POST(req: Request) {
  const rawBackend = process.env.AI_TA_API_BASE_URL;
  const backend = rawBackend ? rawBackend.replace(/\/+$/, '') : '';
  if (!backend) {
    return new Response('AI_TA_API_BASE_URL missing', { status: 500 });
  }

  const body = await req.text();
  const authHeader = req.headers.get('authorization');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authHeader) headers.Authorization = authHeader;
  const resp = await fetch(`${backend}/teacher/weeks/current`, {
    method: 'POST',
    headers,
    body,
    cache: 'no-store',
  });
  const text = await resp.text();

  return new Response(text, {
    status: resp.status,
    headers: {
      'Content-Type': resp.headers.get('content-type') ?? 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
