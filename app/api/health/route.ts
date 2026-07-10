export const runtime = "nodejs";

/** Simple liveness check: GET /api/health */
export async function GET() {
  return Response.json({ ok: true, service: "capi-gateway" });
}
