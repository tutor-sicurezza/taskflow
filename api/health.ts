export const runtime = 'edge';

export function fetch() {
  return Response.json({
    ok: true,
    service: 'taskflow-backend',
    timestamp: new Date().toISOString(),
  });
}
