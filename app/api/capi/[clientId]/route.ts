import { NextRequest } from "next/server";
import { getCapiClient } from "@/lib/supabase";
import { sendCapiEvent, hash, hashPhone, hashZip, type CapiEvent } from "@/lib/capi";

// Node runtime required for the `crypto` hashing.
export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/capi/{clientId}
 * Receives a conversion event (from a GoHighLevel workflow webhook or the browser),
 * hashes the PII, and forwards it to that client's Meta pixel via the Conversions API.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params;

  if (!UUID_RE.test(clientId)) {
    return Response.json({ error: "invalid client id" }, { status: 400 });
  }

  const client = await getCapiClient(clientId);
  if (!client) {
    return Response.json({ error: "unknown client" }, { status: 404 });
  }

  let p: Record<string, any>;
  try {
    p = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  // GHL usually splits "Full Name" into first/last on the contact. If only a
  // combined name arrives, split it ourselves so we can still send fn + ln.
  let firstName = p.first_name;
  let lastName = p.last_name;
  if (!firstName && !lastName && p.full_name) {
    const parts = String(p.full_name).trim().split(/\s+/);
    firstName = parts.shift();
    lastName = parts.join(" ") || undefined;
  }

  const hasValue = p.value !== undefined && p.value !== null && p.value !== "";

  const event: CapiEvent = {
    event_name: p.event_name || "Lead",
    event_time: p.event_time || Math.floor(Date.now() / 1000),
    action_source: p.action_source || "website",
    event_id: p.event_id || undefined,
    event_source_url: p.page_url || p.event_source_url || undefined,
    user_data: {
      em: hash(p.email),
      ph: hashPhone(p.phone),
      fn: hash(firstName),
      ln: hash(lastName),
      fbc: p.fbc || undefined,
      fbp: p.fbp || undefined,
      zp: hashZip(p.zip || p.zip_code || p.postal_code),
      // IP + user agent must be the END USER's, captured on the landing page and
      // passed through — NOT the webhook sender's. Omit if not provided.
      client_ip_address: p.ip || undefined,
      client_user_agent: p.user_agent || undefined,
    },
    custom_data: hasValue
      ? { value: Number(p.value), currency: p.currency || client.default_currency }
      : undefined,
  };

  const result = await sendCapiEvent({
    pixelId: client.pixel_id,
    accessToken: client.access_token,
    testEventCode: client.test_event_code,
    event,
  });

  return Response.json(result, { status: result.ok ? 200 : 502 });
}
