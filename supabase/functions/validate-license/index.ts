import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function sha256Base64(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)));
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
  }

  try {
    const body = await request.json();
    const key = typeof body?.key === "string" ? body.key.trim() : "";
    if (!key) {
      return Response.json({ error: "Missing or invalid key" }, { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Supabase service credentials are unavailable");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const keyHash = await sha256Base64(key);
    const { data: license, error } = await supabase
      .from("licenses")
      .select("email, valid_until")
      .eq("key_hash", keyHash)
      .eq("is_active", true)
      .maybeSingle();

    if (error) throw error;
    if (!license) {
      return Response.json({ valid: false, message: "License not found" }, { headers: corsHeaders });
    }

    if (!license.valid_until || new Date(license.valid_until) <= new Date()) {
      return Response.json({ valid: false, message: "License expired" }, { headers: corsHeaders });
    }

    return Response.json({
      valid: true,
      userEmail: license.email,
      expiresAt: license.valid_until,
    }, { headers: corsHeaders });
  } catch (error) {
    console.error("[validate-license]", error);
    return Response.json({ error: "Unable to validate license" }, { status: 500, headers: corsHeaders });
  }
});
