export const runtime = 'nodejs';

function backendBase(): string {
  const raw = process.env.AI_TA_API_BASE_URL;
  return raw ? raw.replace(/\/+$/, '') : '';
}

// POST — create an authored problem set (multipart: problem, optional solution,
// search_space_id). Proxies to the apollo router and returns its JSON verbatim.
export async function POST(req: Request) {
  const backend = backendBase();
  if (!backend) {
    return new Response('AI_TA_API_BASE_URL missing', { status: 500 });
  }

  const formData = await req.formData();
  const authHeader = req.headers.get('authorization');
  const headers: Record<string, string> = {};
  if (authHeader) headers.Authorization = authHeader;
  const resp = await fetch(`${backend}/apollo/authored-sets`, {
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

// GET — list authored sets for a course (?search_space_id=...).
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
    `${backend}/apollo/authored-sets?search_space_id=${encodeURIComponent(searchSpaceId)}`,
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
