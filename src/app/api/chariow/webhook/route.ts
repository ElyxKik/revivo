import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { chariowRequest, getChariowPlanByProductId } from "@/lib/chariow";
import { createPurchaseAndLicenses } from "@/lib/license";
import { supabaseServer } from "@/lib/supabaseServer";

function validSignature(rawBody: string, received: string | null) {
  const secret = process.env.CHARIOW_WEBHOOK_SECRET;
  if (!secret || !received) return false;
  const normalized = received.replace(/^sha256=/, "");
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const left = Buffer.from(normalized);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function valueAt(source: any, paths: string[][]) {
  for (const path of paths) {
    let value = source;
    for (const key of path) value = value?.[key];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  if (!validSignature(rawBody, req.headers.get("x-chariow-signature"))) {
    return NextResponse.json({ error: "Invalid Chariow signature" }, { status: 401 });
  }

  try {
    const pulse = JSON.parse(rawBody);
    const event = pulse.event || pulse.trigger || pulse.type;
    if (!['successful_sale', 'sale.completed'].includes(event)) {
      return NextResponse.json({ ok: true, ignored: true, event });
    }

    const saleId = valueAt(pulse, [["data", "id"], ["data", "sale", "id"], ["sale", "id"]]);
    if (!saleId || typeof saleId !== "string") {
      return NextResponse.json({ error: "Missing Chariow sale ID" }, { status: 400 });
    }

    const supabase = supabaseServer();
    const { data: existing } = await supabase
      .from("purchases")
      .select("id")
      .eq("chariow_sale_id", saleId)
      .maybeSingle();
    if (existing) return NextResponse.json({ ok: true, duplicate: true, purchaseId: existing.id });

    const response = await chariowRequest<any>(`/sales/${encodeURIComponent(saleId)}`);
    const sale = response?.data;
    if (!sale || sale.status !== "completed" || sale.payment?.status !== "success") {
      return NextResponse.json({ error: "Chariow sale is not paid" }, { status: 409 });
    }

    const productId = valueAt(sale, [["product", "id"], ["product_id"], ["items", "0", "product", "id"]]);
    const email = valueAt(sale, [["customer", "email"], ["email"]]);
    if (typeof productId !== "string" || typeof email !== "string") {
      return NextResponse.json({ error: "Incomplete Chariow sale" }, { status: 422 });
    }
    const plan = getChariowPlanByProductId(productId);
    const amount = Math.round(Number(valueAt(sale, [["amount", "value"], ["payment", "amount", "value"]]) || 0));
    const currency = String(valueAt(sale, [["amount", "currency"], ["payment", "amount", "currency"]]) || "eur");

    const result = await createPurchaseAndLicenses({
      provider: "chariow",
      email,
      seats: plan.seats,
      mode: process.env.NODE_ENV === "production" ? "live" : "test",
      amount,
      currency,
      durationYears: plan.durationYears,
      productType: plan.productType,
      providerEventId: String(pulse.id || pulse.event_id || "") || undefined,
      chariowSaleId: saleId,
      chariowProductId: productId,
      customerDetails: sale.customer || { email },
      paymentMethod: sale.payment || null,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error: any) {
    console.error("[chariow-webhook]", error?.message);
    return NextResponse.json({ error: error?.message || "Webhook processing failed" }, { status: 500 });
  }
}
