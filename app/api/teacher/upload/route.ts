export const runtime = 'nodejs';

export async function POST(req: Request) {
  const backend = process.env.AI_TA_API_BASE_URL;
  if (!backend) {
    return new Response('AI_TA_API_BASE_URL missing', { status: 500 });
  }

  const formData = await req.formData();
  const resp = await fetch(`${backend}/teacher/upload`, {
    method: 'POST',
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
