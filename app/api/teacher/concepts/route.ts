export const runtime = 'nodejs';

function backendBase(): string {
  const raw = process.env.AI_TA_API_BASE_URL;
  return raw ? raw.replace(/\/+$/, '') : '';
}

// GET — list the course's authored/registered concepts (?search_space_id=...).
export async function GET(req: Request) {
  const backend = backendBase();
  if (!backend) {
    return new Response('AI_TA_API_BASE_URL missing', { status: 500 });
  }

  const searchSpaceId = new URL(req.url).searchParams.get('search_space_id') ?? '';
  const authHeader = req.headers.get('authorization');
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (authHeader) headers.Authorization = authHeader;
  const resp = await fetch(
    `${backend}/apollo/teacher/concepts?search_space_id=${encodeURIComponent(searchSpaceId)}`,
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

// POST — create a concept ({search_space_id, display_name, description}).
export async function POST(req: Request) {
  const backend = backendBase();
  if (!backend) {
    return new Response('AI_TA_API_BASE_URL missing', { status: 500 });
  }

  const authHeader = req.headers.get('authorization');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authHeader) headers.Authorization = authHeader;
  const resp = await fetch(`${backend}/apollo/teacher/concepts`, {
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
