import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

function getBackendBaseUrl(): string | null {
  const rawBackend = process.env.AI_TA_API_BASE_URL;
  return rawBackend ? rawBackend.replace(/\/+$/, '') : null;
}

export async function GET(req: NextRequest) {
  const backend = getBackendBaseUrl();
  if (!backend) {
    return new Response('AI_TA_API_BASE_URL missing', { status: 500 });
  }

  const params = req.nextUrl.searchParams.toString();
  const url = `${backend}/teacher/retrieval-weights${params ? `?${params}` : ''}`;
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

export async function POST(req: Request) {
  const backend = getBackendBaseUrl();
  if (!backend) {
    return new Response('AI_TA_API_BASE_URL missing', { status: 500 });
  }

  const body = await req.text();
  const authHeader = req.headers.get('authorization');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authHeader) headers.Authorization = authHeader;
  const resp = await fetch(`${backend}/teacher/retrieval-weights`, {
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
