import { NextRequest, NextResponse } from "next/server";
import { createPurchaseAndLicenses } from "@/lib/license";

export async function POST(req: NextRequest) {
  const providedSecret = req.headers.get("X-Test-Secret");
  const expectedSecret = process.env.TEST_WEBHOOK_SECRET;
  if (!providedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const email = body?.customer_details?.email;
  const seats: 1 | 3 = Number(body?.line_items?.[0]?.seats) === 3 ? 3 : 1;
  const amount = Number(body?.line_items?.[0]?.amount_eur) || (seats === 3 ? 120 : 69);
  const currency = String(body?.currency || "eur");

  if (!email) {
    return NextResponse.json({ error: "Missing customer_details.email" }, { status: 400 });
  }

  try {
    const result = await createPurchaseAndLicenses({
      email,
      seats,
      mode: "test",
      amount,
      currency,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
  }
}
