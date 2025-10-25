import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const backend = process.env.AI_TA_API_BASE_URL;
  if (!backend) {
    return new Response('AI_TA_API_BASE_URL missing', { status: 500 });
  }

  const params = req.nextUrl.searchParams.toString();
  const url = `${backend}/teacher/weeks${params ? `?${params}` : ''}`;
  const resp = await fetch(url, { cache: 'no-store' });
  const body = await resp.text();

  return new Response(body, {
    status: resp.status,
    headers: {
      'Content-Type': resp.headers.get('content-type') ?? 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
