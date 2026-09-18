import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, requireAdmin } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const setupSecret = req.headers.get("X-Setup-Secret");
  const adminSetupSecret = process.env.ADMIN_SETUP_SECRET;

  let isAuthorized = false;

  if (authHeader) {
    try {
      await requireAdmin(authHeader);
      isAuthorized = true;
    } catch {
      // Not admin, check setup secret
    }
  }

  if (!isAuthorized && setupSecret && adminSetupSecret) {
    if (setupSecret === adminSetupSecret) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized: Missing valid Authorization or Setup Secret" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim();

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  try {
    const supabase = supabaseServer();

    // Find user by email in auth.users
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();
    if (userError) throw new Error(`Failed to list users: ${userError.message}`);

    const user = users.users.find((u) => u.email === email);
    if (!user) throw new Error("User not found. They must register first.");

    // Set is_admin = true in profiles
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ is_admin: true, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    if (profileError) throw new Error(`Failed to update profile: ${profileError.message}`);

    return NextResponse.json({ ok: true, uid: user.id, email });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to setup admin" }, { status: 400 });
  }
}
