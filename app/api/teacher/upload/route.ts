export const runtime = 'nodejs';

export async function POST(req: Request) {
  const rawBackend = process.env.AI_TA_API_BASE_URL;
  const backend = rawBackend ? rawBackend.replace(/\/+$/, '') : '';
  if (!backend) {
    return new Response('AI_TA_API_BASE_URL missing', { status: 500 });
  }

  const formData = await req.formData();
  const authHeader = req.headers.get('authorization');
  const headers: Record<string, string> = {};
  if (authHeader) headers.Authorization = authHeader;
  const resp = await fetch(`${backend}/teacher/upload`, {
    method: 'POST',
    headers,
    body: formData,
    cache: 'no-store',
  });
  const body = await resp.text();

  return new Response(body, {
    status: resp.status,
    headers: {
      'Content-Type': resp.headers.get('content-type') ?? 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
