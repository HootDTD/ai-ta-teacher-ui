export const runtime = 'nodejs';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const rawBackend = process.env.AI_TA_API_BASE_URL;
  const backend = rawBackend ? rawBackend.replace(/\/+$/, '') : '';
  if (!backend) return new Response('AI_TA_API_BASE_URL missing', { status: 500 });

  const authHeader = req.headers.get('authorization');
  const headers: Record<string, string> = {};
  if (authHeader) headers.Authorization = authHeader;
  const { id } = await ctx.params;
  const resp = await fetch(`${backend}/reports/ai-use/${encodeURIComponent(id)}.pdf`, { headers });
  return new Response(resp.body, {
    status: resp.status,
    headers: {
      'Content-Type': resp.headers.get('content-type') ?? 'application/pdf',
      'Content-Disposition': resp.headers.get('content-disposition') ?? `attachment; filename="ai-use-report-${id}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
