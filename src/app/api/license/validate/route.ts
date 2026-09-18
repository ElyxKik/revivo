import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { sha256Base64 } from "@/lib/crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const key = body.key;

    if (!key || typeof key !== "string") {
      return NextResponse.json({ error: "Missing or invalid key" }, { status: 400 });
    }

    const keyHash = sha256Base64(key);
    const supabase = supabaseServer();

    const { data: license, error } = await supabase
      .from("licenses")
      .select("email, valid_until, is_active")
      .eq("key_hash", keyHash)
      .eq("is_active", true)
      .single();

    if (error || !license) {
      return NextResponse.json({ valid: false, message: "License not found" }, { status: 200 });
    }

    const validUntil = new Date(license.valid_until);
    const now = new Date();

    if (validUntil < now) {
      return NextResponse.json({ valid: false, message: "License expired" }, { status: 200 });
    }

    return NextResponse.json({
      valid: true,
      userEmail: license.email,
      expiresAt: license.valid_until,
    });
  } catch (err: any) {
    console.error("[license/validate]", err);
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
  }
}
