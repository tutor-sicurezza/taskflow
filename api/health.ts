export const runtime = 'edge';

export function fetch() {
  return Response.json({
    ok: true,
    service: 'spark-template-backend',
    timestamp: new Date().toISOString(),
  });
}
