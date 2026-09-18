import { createClient } from "@supabase/supabase-js";

export function supabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

export async function requireAdmin(authHeader: string | null) {
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Missing Authorization header");
  const token = authHeader.slice("Bearer ".length);

  const supabase = supabaseServer();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error("Invalid token");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", data.user.id)
    .single();

  if (!profile?.is_admin) throw new Error("Forbidden");
  return data.user;
}
