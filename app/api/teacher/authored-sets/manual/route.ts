export const runtime = 'nodejs';

function backendBase(): string {
  const raw = process.env.AI_TA_API_BASE_URL;
  return raw ? raw.replace(/\/+$/, '') : '';
}

// POST — create an authored problem set from typed question/answer JSON.
export async function POST(req: Request) {
  const backend = backendBase();
  if (!backend) {
    return new Response('AI_TA_API_BASE_URL missing', { status: 500 });
  }

  const authHeader = req.headers.get('authorization');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authHeader) headers.Authorization = authHeader;
  const resp = await fetch(`${backend}/apollo/authored-sets/manual`, {
    method: 'POST',
    headers,
    body: await req.text(),
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
