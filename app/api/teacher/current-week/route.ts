export const runtime = 'nodejs';

export async function POST(req: Request) {
  const backend = process.env.AI_TA_API_BASE_URL;
  if (!backend) {
    return new Response('AI_TA_API_BASE_URL missing', { status: 500 });
  }

  const body = await req.text();
  const resp = await fetch(`${backend}/teacher/weeks/current`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
