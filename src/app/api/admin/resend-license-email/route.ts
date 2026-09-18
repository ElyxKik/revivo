import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabaseServer";
import { resendPurchaseLicenseEmail } from "@/lib/license";

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req.headers.get("Authorization"));
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const purchaseId = String(body?.purchaseId || "").trim();
    if (!purchaseId) return NextResponse.json({ error: "Missing purchase ID" }, { status: 400 });
    const result = await resendPurchaseLicenseEmail(purchaseId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Email resend failed" }, { status: 500 });
  }
}
