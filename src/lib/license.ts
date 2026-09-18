import { supabaseServer } from "./supabaseServer";
import { encryptAesGcmBase64, generateLicenseKey, sha256Base64 } from "./crypto";
import { sendLicenseEmail } from "./email";

function getEncryptionKeyBase64(): string {
  const k = process.env.LICENSE_ENCRYPTION_KEY_BASE64;
  if (!k) throw new Error("Missing LICENSE_ENCRYPTION_KEY_BASE64");
  return k;
}

export async function createPurchaseAndLicenses(params: {
  provider?: "stripe" | "chariow" | "manual";
  email: string;
  seats: 1 | 3;
  mode: "test" | "live";
  amount: number;
  currency: string;
  durationYears?: number;
  productType?: string;
  stripeEventId?: string;
  stripeCustomerId?: string;
  stripeSessionId?: string;
  stripeSubscriptionId?: string;
  stripePaymentIntentId?: string;
  currentPeriodEnd?: Date;
  customerDetails?: any;
  paymentMethod?: any;
  providerEventId?: string;
  chariowSaleId?: string;
  chariowProductId?: string;
}) {
  const supabase = supabaseServer();
  const encryptionKey = getEncryptionKeyBase64();
  const keys: string[] = [];

  const durationYears = params.durationYears || 1;
  const validUntil = params.currentPeriodEnd
    ? params.currentPeriodEnd.toISOString()
    : new Date(Date.now() + durationYears * 365 * 24 * 60 * 60 * 1000).toISOString();

  // Create purchase
  const { data: purchase, error: purchaseError } = await supabase
    .from("purchases")
    .insert({
      provider: params.provider || "stripe",
      mode: params.mode,
      status: "paid",
      email: params.email,
      seats: params.seats,
      product_type: params.productType || "annual",
      amount: params.amount,
      currency: params.currency,
      stripe_event_id: params.stripeEventId,
      stripe_customer_id: params.stripeCustomerId,
      stripe_session_id: params.stripeSessionId,
      stripe_subscription_id: params.stripeSubscriptionId,
      stripe_payment_intent_id: params.stripePaymentIntentId,
      current_period_end: params.currentPeriodEnd?.toISOString() || null,
      customer_details: params.customerDetails || null,
      payment_method: params.paymentMethod || null,
      provider_event_id: params.providerEventId || null,
      chariow_sale_id: params.chariowSaleId || null,
      chariow_product_id: params.chariowProductId || null,
    })
    .select()
    .single();

  if (purchaseError || !purchase) throw new Error(`Failed to create purchase: ${purchaseError?.message}`);

  // Create licenses
  const licenseRows: any[] = [];
  for (let i = 1; i <= params.seats; i++) {
    const plainKey = generateLicenseKey();
    const keyEncrypted = encryptAesGcmBase64(plainKey, encryptionKey);
    const keyHash = sha256Base64(plainKey);

    licenseRows.push({
      email: params.email,
      purchase_id: purchase.id,
      type: params.productType || "annual",
      seat_index: i,
      subscription_id: params.stripeSubscriptionId || null,
      is_active: true,
      valid_until: validUntil,
      key_encrypted: keyEncrypted,
      key_hash: keyHash,
      created_by_type: params.provider || "stripe",
    });

    keys.push(plainKey);
  }

  const { error: licensesError } = await supabase.from("licenses").insert(licenseRows);
  if (licensesError) throw new Error(`Failed to create licenses: ${licensesError.message}`);

  await sendLicenseEmail({
    to: params.email,
    keys,
    seats: params.seats,
    amountEur: params.currency.toLowerCase() === "eur" ? params.amount : undefined,
  });

  return {
    purchaseId: purchase.id,
    licenseCount: keys.length,
  };
}
