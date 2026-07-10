import { createClient } from "@supabase/supabase-js";

/** Server-only Supabase client using the SECRET key (bypasses RLS). Never expose to the browser. */
function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export interface CapiClient {
  id: string;
  name: string;
  pixel_id: string;
  access_token: string;
  default_currency: string;
  test_event_code: string | null;
}

/** Look up a client's pixel config by its endpoint id. Returns null if not found. */
export async function getCapiClient(id: string): Promise<CapiClient | null> {
  const { data, error } = await supabaseAdmin()
    .from("capi_clients")
    .select("id, name, pixel_id, access_token, default_currency, test_event_code")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as CapiClient) ?? null;
}
