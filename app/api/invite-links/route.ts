import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const rawBackend = process.env.AI_TA_API_BASE_URL;
  const backend = rawBackend ? rawBackend.replace(/\/+$/, '') : '';
  if (!backend) {
    return new Response('AI_TA_API_BASE_URL missing', { status: 500 });
  }

  const params = req.nextUrl.searchParams.toString();
  const url = `${backend}/invite-links${params ? `?${params}` : ''}`;
  const authHeader = req.headers.get('authorization');
  const headers: Record<string, string> = {};
  if (authHeader) headers.Authorization = authHeader;
  const resp = await fetch(url, { headers, cache: 'no-store' });
  const body = await resp.text();

  return new Response(body, {
    status: resp.status,
    headers: {
      'Content-Type': resp.headers.get('content-type') ?? 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

export async function POST(req: NextRequest) {
  const rawBackend = process.env.AI_TA_API_BASE_URL;
  const backend = rawBackend ? rawBackend.replace(/\/+$/, '') : '';
  if (!backend) {
    return new Response('AI_TA_API_BASE_URL missing', { status: 500 });
  }

  const authHeader = req.headers.get('authorization');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authHeader) headers.Authorization = authHeader;

  const resp = await fetch(`${backend}/invite-links`, {
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
