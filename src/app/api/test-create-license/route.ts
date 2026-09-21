import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { encryptAesGcmBase64, generateLicenseKey, sha256Base64 } from "@/lib/crypto";
import { sendLicenseEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const providedSecret = req.headers.get("X-Test-Secret");
  const expectedSecret = process.env.TEST_WEBHOOK_SECRET;
  if (!providedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim();
  const seatIndex = Number(body.seatIndex || 0);

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  try {
    const licenseKey = generateLicenseKey();
    const keyHash = sha256Base64(licenseKey);
    const encryptionKey = process.env.LICENSE_ENCRYPTION_KEY_BASE64;
    if (!encryptionKey) throw new Error("Missing LICENSE_ENCRYPTION_KEY_BASE64");
    const keyEncrypted = encryptAesGcmBase64(licenseKey, encryptionKey);

    const validUntil = new Date();
    validUntil.setFullYear(validUntil.getFullYear() + 1);

    const supabase = supabaseServer();
    const { data, error } = await supabase
      .from("licenses")
      .insert({
        email,
        type: "manual",
        seat_index: seatIndex,
        is_active: true,
        valid_until: validUntil.toISOString(),
        key_encrypted: keyEncrypted,
        key_hash: keyHash,
        created_by_type: "admin",
        created_by_uid: null,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create license: ${error.message}`);

    await sendLicenseEmail({ to: email, keys: [licenseKey], seats: 1, amount: 0, currency: "usd" });

    return NextResponse.json({
      ok: true,
      licenseId: data.id,
      email,
      licenseKey,
      validUntil: validUntil.toISOString(),
      message: `License created and email sent to ${email}`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to create license" }, { status: 500 });
  }
}
