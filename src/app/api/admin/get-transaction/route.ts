import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, requireAdmin } from "@/lib/supabaseServer";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req.headers.get("Authorization"));
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Unauthorized" }, { status: 401 });
  }

  const transactionId = req.nextUrl.searchParams.get("id");
  if (!transactionId) {
    return NextResponse.json({ error: "Missing transaction ID" }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("purchases")
    .select("*")
    .eq("id", transactionId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...data,
    createdAt: data.created_at,
    currentPeriodEnd: data.current_period_end,
    customerDetails: data.customer_details,
    paymentMethod: data.payment_method,
    stripeEventId: data.stripe_event_id,
    stripeCustomerId: data.stripe_customer_id,
    stripeSessionId: data.stripe_session_id,
    stripeSubscriptionId: data.stripe_subscription_id,
    stripePaymentIntentId: data.stripe_payment_intent_id,
    providerEventId: data.provider_event_id,
    chariowSaleId: data.chariow_sale_id,
    chariowProductId: data.chariow_product_id,
  });
}
