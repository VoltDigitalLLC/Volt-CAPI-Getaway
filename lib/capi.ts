import crypto from "crypto";

const API_VERSION = "v21.0";

/** SHA-256 after normalizing (trim + lowercase). Meta requires this for all PII. */
export function hash(value?: string | null): string | undefined {
  if (!value) return undefined;
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

/** Phone: strip to digits only (keep country code), then SHA-256. */
export function hashPhone(value?: string | null): string | undefined {
  if (!value) return undefined;
  const digits = value.replace(/[^0-9]/g, "");
  if (!digits) return undefined;
  return crypto.createHash("sha256").update(digits).digest("hex");
}

export interface CapiUserData {
  em?: string;
  ph?: string;
  fn?: string;
  ln?: string;
  fbc?: string;
  fbp?: string;
  client_ip_address?: string;
  client_user_agent?: string;
}

export interface CapiEvent {
  event_name: string;
  event_time: number;
  action_source: string;
  event_id?: string;
  event_source_url?: string;
  user_data: CapiUserData;
  custom_data?: Record<string, unknown>;
}

/** POST a single event to Meta's Conversions API. Returns Meta's raw response. */
export async function sendCapiEvent(opts: {
  pixelId: string;
  accessToken: string;
  testEventCode?: string | null;
  event: CapiEvent;
}) {
  const { pixelId, accessToken, testEventCode, event } = opts;
  const res = await fetch(
    `https://graph.facebook.com/${API_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(
      accessToken
    )}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [event],
        ...(testEventCode ? { test_event_code: testEventCode } : {}),
      }),
    }
  );
  const body = await res.json();
  return { ok: res.ok, status: res.status, body };
}
