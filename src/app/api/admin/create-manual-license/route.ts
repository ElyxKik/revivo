import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, requireAdmin } from "@/lib/supabaseServer";
import { encryptAesGcmBase64, generateLicenseKey, sha256Base64 } from "@/lib/crypto";
import { sendLicenseEmail } from "@/lib/email";

function getEncryptionKeyBase64(): string {
  const k = process.env.LICENSE_ENCRYPTION_KEY_BASE64;
  if (!k) throw new Error("Missing LICENSE_ENCRYPTION_KEY_BASE64");
  return k;
}

export async function POST(req: NextRequest) {
  let decoded: any;
  try {
    decoded = await requireAdmin(req.headers.get("Authorization"));
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim();
  const seats: 1 | 3 = Number(body.seats) === 3 ? 3 : 1;

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  try {
    const supabase = supabaseServer();
    const encryptionKey = getEncryptionKeyBase64();
    const keys: string[] = [];
    const validUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    const { data: purchase, error: purchaseError } = await supabase
      .from("purchases")
      .insert({
        provider: "stripe",
        mode: "test",
        status: "paid",
        email,
        seats,
        product_type: "annual",
        amount: seats === 3 ? 120 : 69,
        currency: "usd",
      })
      .select()
      .single();

    if (purchaseError || !purchase) throw new Error(`Failed to create purchase: ${purchaseError?.message}`);

    const licenseRows: any[] = [];
    for (let i = 1; i <= seats; i++) {
      const plainKey = generateLicenseKey();
      const keyEncrypted = encryptAesGcmBase64(plainKey, encryptionKey);
      const keyHash = sha256Base64(plainKey);

      licenseRows.push({
        email,
        purchase_id: purchase.id,
        type: "manual",
        seat_index: i,
        is_active: true,
        valid_until: validUntil,
        key_encrypted: keyEncrypted,
        key_hash: keyHash,
        created_by_type: "admin",
        created_by_uid: decoded.id,
      });

      keys.push(plainKey);
    }

    const { error: licensesError } = await supabase.from("licenses").insert(licenseRows);
    if (licensesError) throw new Error(`Failed to create licenses: ${licensesError.message}`);

    await sendLicenseEmail({ to: email, keys, seats, amount: seats === 3 ? 120 : 69, currency: "usd" });

    return NextResponse.json({ ok: true, purchaseId: purchase.id, licenseCount: seats });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
  }
}
