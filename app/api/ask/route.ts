export const runtime = 'nodejs';

export async function POST(req: Request) {
  const backend = process.env.AI_TA_API_BASE_URL;
  if (!backend) {
    return new Response('AI_TA_API_BASE_URL missing', { status: 500 });
  }

  // Forward raw body to preserve streaming compatibility
  const body = await req.text();
  const resp = await fetch(`${backend}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  // Stream response through to the client
  return new Response(resp.body, {
    status: resp.status,
    headers: {
      'Content-Type': resp.headers.get('content-type') ?? 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

