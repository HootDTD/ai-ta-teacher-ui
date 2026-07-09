export const runtime = 'nodejs';

function backendBase(): string {
  const raw = process.env.AI_TA_API_BASE_URL;
  return raw ? raw.replace(/\/+$/, '') : '';
}

type Params = { params: Promise<{ concept_id: string }> };

// PATCH — edit a concept's display_name/description.
export async function PATCH(req: Request, { params }: Params) {
  const backend = backendBase();
  if (!backend) {
    return new Response('AI_TA_API_BASE_URL missing', { status: 500 });
  }

  const { concept_id } = await params;
  const authHeader = req.headers.get('authorization');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authHeader) headers.Authorization = authHeader;
  const resp = await fetch(
    `${backend}/apollo/teacher/concepts/${encodeURIComponent(concept_id)}`,
    { method: 'PATCH', headers, body: await req.text(), cache: 'no-store' },
  );
  const body = await resp.text();

  return new Response(body, {
    status: resp.status,
    headers: {
      'Content-Type': resp.headers.get('content-type') ?? 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

// DELETE — remove a concept (409s server-side once provisioned content exists).
export async function DELETE(req: Request, { params }: Params) {
  const backend = backendBase();
  if (!backend) {
    return new Response('AI_TA_API_BASE_URL missing', { status: 500 });
  }

  const { concept_id } = await params;
  const authHeader = req.headers.get('authorization');
  const headers: Record<string, string> = {};
  if (authHeader) headers.Authorization = authHeader;
  const resp = await fetch(
    `${backend}/apollo/teacher/concepts/${encodeURIComponent(concept_id)}`,
    { method: 'DELETE', headers, cache: 'no-store' },
  );
  const body = await resp.text();

  return new Response(body, {
    status: resp.status,
    headers: {
      'Content-Type': resp.headers.get('content-type') ?? 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
