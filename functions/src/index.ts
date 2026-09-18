import "dotenv/config";
import admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";
import Stripe from "stripe";
import { Resend } from "resend";
import { encryptAesGcmBase64, generateLicenseKey, sha256Base64 } from "./crypto";
import { requireAdminFromAuthHeader } from "./auth";

admin.initializeApp();

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

type PurchaseDoc = {
  provider: "stripe";
  mode: "test" | "live";
  status: "paid" | "failed" | "pending" | "refunded";
  email: string;
  uid?: string;
  seats: 1 | 3;
  productType: "annual";
  amount: number;
  currency: string;
  stripeEventId?: string;
  stripeCustomerId?: string;
  stripeSessionId?: string;
  stripeSubscriptionId?: string;
  stripePaymentIntentId?: string;
  currentPeriodEnd?: admin.firestore.Timestamp;
  // Customer details from Stripe
  customerDetails?: {
    name?: string;
    email?: string;
    phone?: string;
    address?: {
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postal_code?: string;
      country?: string;
    };
  };
  // Payment method details
  paymentMethod?: {
    type?: string;
    card?: {
      brand?: string;
      last4?: string;
      exp_month?: number;
      exp_year?: number;
    };
  };
  createdAt: admin.firestore.Timestamp;
};

type LicenseDoc = {
  uid?: string;
  email: string;
  purchaseId?: string;
  type: "annual" | "manual";
  seatIndex: number;
  subscriptionId?: string;
  isActive: boolean;
  validUntil: admin.firestore.Timestamp | null;
  keyEncrypted: string;
  keyHash: string;
  createdAt: admin.firestore.Timestamp;
  createdBy: { type: "stripe" | "admin"; uid?: string };
};

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  return new Stripe(key);
}

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Missing RESEND_API_KEY");
  return new Resend(key);
}

function getEncryptionKeyBase64(): string {
  const k = process.env.LICENSE_ENCRYPTION_KEY_BASE64;
  if (!k) throw new Error("Missing LICENSE_ENCRYPTION_KEY_BASE64");
  return k;
}

function getTestWebhookSecret(): string {
  const s = process.env.TEST_WEBHOOK_SECRET;
  if (!s) throw new Error("Missing TEST_WEBHOOK_SECRET");
  return s;
}

function setCorsHeaders(res: any): void {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Setup-Secret, X-Test-Secret");
  res.set("Access-Control-Max-Age", "3600");
}

async function sendLicenseEmail(args: { to: string; keys: string[]; seats: number; amountEur?: number }) {
  const resend = getResend();
  const from = process.env.RESEND_FROM || "Zecleaner <no-reply@zecleaner.com>";

  const subject = args.seats === 1 ? "Votre clé Zecleaner" : "Vos clés Zecleaner";
  const keysBlock = args.keys.map((k, idx) => `${idx + 1}. ${k}`).join("\n");

  const text =
    `Merci pour votre achat.\n\n` +
    `Nombre de clés: ${args.seats}\n` +
    (typeof args.amountEur === "number" ? `Montant: ${args.amountEur} EUR\n` : "") +
    `\nClé(s):\n${keysBlock}\n`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
    .logo { height: 60px; margin-bottom: 15px; }
    .header h1 { margin: 0; font-size: 28px; }
    .header p { margin: 10px 0 0 0; font-size: 16px; opacity: 0.9; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .section { margin-bottom: 25px; }
    .section-title { font-size: 16px; font-weight: 600; color: #667eea; margin-bottom: 10px; }
    .keys-box { background: white; border: 2px solid #667eea; border-radius: 6px; padding: 20px; margin-top: 10px; }
    .key-item { background: #f0f4ff; padding: 12px; margin-bottom: 10px; border-radius: 4px; font-family: 'Courier New', monospace; font-size: 13px; word-break: break-all; }
    .key-item:last-child { margin-bottom: 0; }
    .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
    .info-row:last-child { border-bottom: none; }
    .label { font-weight: 600; color: #667eea; }
    .value { color: #333; }
    .footer { text-align: center; padding-top: 20px; font-size: 12px; color: #999; }
    .cta-button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 15px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <svg class="logo" viewBox="0 0 200 60" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#ffffff;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#f0f4ff;stop-opacity:1" />
          </linearGradient>
        </defs>
        <text x="10" y="45" font-size="40" font-weight="bold" fill="url(#logoGradient)">Zecleaner</text>
      </svg>
      <p>Vos clés de licence</p>
    </div>
    <div class="content">
      <p>Merci pour votre achat! Voici vos clés de licence Zecleaner.</p>
      
      <div class="section">
        <div class="section-title">📋 Détails de votre commande</div>
        <div class="info-row">
          <span class="label">Nombre de clés:</span>
          <span class="value">${args.seats}</span>
        </div>
        ${typeof args.amountEur === "number" ? `
        <div class="info-row">
          <span class="label">Montant:</span>
          <span class="value">${args.amountEur} EUR</span>
        </div>
        ` : ""}
      </div>

      <div class="section">
        <div class="section-title">🔑 Vos clés de licence</div>
        <div class="keys-box">
          ${args.keys.map((k, idx) => `<div class="key-item"><strong>Clé ${idx + 1}:</strong> ${k}</div>`).join("")}
        </div>
      </div>

      <div class="section">
        <p style="font-size: 14px; color: #666;">
          <strong>Comment utiliser vos clés?</strong><br>
          Utilisez ces clés pour activer Zecleaner sur vos appareils. Chaque clé peut être utilisée sur un appareil à la fois.
        </p>
      </div>

      <div style="text-align: center;">
        <a href="https://zecleaner.com" class="cta-button">Accéder à Zecleaner</a>
      </div>

      <div class="footer">
        <p>Si vous avez des questions, contactez-nous à contact@zecleaner.com</p>
        <p>&copy; 2026 Zecleaner. Tous droits réservés.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;

  console.log(`[sendLicenseEmail] Sending email to ${args.to} from ${from}`);
  console.log(`[sendLicenseEmail] Using Resend API key: ${process.env.RESEND_API_KEY?.substring(0, 10)}...`);
  
  const result = await resend.emails.send({
    from,
    to: args.to,
    subject,
    html,
    text,
  });
  
  console.log(`[sendLicenseEmail] Result:`, result);
  
  if (result.error) {
    throw new Error(`Resend error: ${JSON.stringify(result.error)}`);
  }
}

function assertPost(req: any, res: any): boolean {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return false;
  }
  return true;
}

async function createPurchaseAndLicenses(params: {
  email: string;
  seats: 1 | 3;
  mode: "test" | "live";
  amount: number;
  currency: string;
  stripeEventId?: string;
  stripeCustomerId?: string;
  stripeSessionId?: string;
  stripeSubscriptionId?: string;
  stripePaymentIntentId?: string;
  currentPeriodEnd?: Date;
  customerDetails?: any;
  paymentMethod?: any;
}) {
  const nowTs = admin.firestore.Timestamp.now();
  const purchaseRef = db.collection("purchases").doc();

  const purchase: PurchaseDoc = {
    provider: "stripe",
    mode: params.mode,
    status: "paid",
    email: params.email,
    seats: params.seats,
    productType: "annual",
    amount: params.amount,
    currency: params.currency,
    stripeEventId: params.stripeEventId,
    stripeCustomerId: params.stripeCustomerId,
    stripeSessionId: params.stripeSessionId,
    stripeSubscriptionId: params.stripeSubscriptionId,
    stripePaymentIntentId: params.stripePaymentIntentId,
    currentPeriodEnd: params.currentPeriodEnd ? admin.firestore.Timestamp.fromDate(params.currentPeriodEnd) : undefined,
    customerDetails: params.customerDetails,
    paymentMethod: params.paymentMethod,
    createdAt: nowTs,
  };

  const encryptionKey = getEncryptionKeyBase64();
  const keys: string[] = [];

  const validUntil = params.currentPeriodEnd
    ? admin.firestore.Timestamp.fromDate(params.currentPeriodEnd)
    : admin.firestore.Timestamp.fromDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000));

  const licenses: Array<{ ref: admin.firestore.DocumentReference; doc: LicenseDoc; plainKey: string }> = [];

  for (let i = 1; i <= params.seats; i++) {
    const plainKey = generateLicenseKey();
    const keyEncrypted = encryptAesGcmBase64(plainKey, encryptionKey);
    const keyHash = sha256Base64(plainKey);

    const licenseRef = db.collection("licenses").doc();
    const doc: LicenseDoc = {
      email: params.email,
      purchaseId: purchaseRef.id,
      type: "annual",
      seatIndex: i,
      subscriptionId: params.stripeSubscriptionId,
      isActive: true,
      validUntil,
      keyEncrypted,
      keyHash,
      createdAt: nowTs,
      createdBy: { type: "stripe" },
    };

    keys.push(plainKey);
    licenses.push({ ref: licenseRef, doc, plainKey });
  }

  await db.runTransaction(async (tx) => {
    tx.set(purchaseRef, purchase);
    for (const l of licenses) tx.set(l.ref, l.doc);
  });

  await sendLicenseEmail({
    to: params.email,
    keys,
    seats: params.seats,
    amountEur: params.currency.toLowerCase() === "eur" ? params.amount : undefined,
  });

  return {
    purchaseId: purchaseRef.id,
    licenseCount: keys.length,
  };
}

async function seatsFromStripeSession(stripe: Stripe, sessionId: string): Promise<1 | 3> {
  const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, { limit: 10 });
  const first = lineItems.data[0];

  const seatsStr = (first?.price as any)?.metadata?.seats;
  const seatsNum = Number(seatsStr);

  if (seatsNum === 3) return 3;
  return 1;
}

export const stripeWebhook = onRequest({ region: process.env.FUNCTIONS_REGION || "us-central1" }, async (req: any, res: any) => {
  if (!assertPost(req, res)) return;

  console.log("[stripeWebhook] Received webhook request");

  const stripe = getStripe();
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[stripeWebhook] Missing STRIPE_WEBHOOK_SECRET");
    res.status(500).json({ error: "Missing STRIPE_WEBHOOK_SECRET" });
    return;
  }

  if (!sig || typeof sig !== "string") {
    console.error("[stripeWebhook] Missing stripe-signature header");
    res.status(400).json({ error: "Missing stripe-signature" });
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
    console.log("[stripeWebhook] Event verified:", event.type, "ID:", event.id);
  } catch (err: any) {
    console.error("[stripeWebhook] Signature verification failed:", err?.message);
    res.status(400).json({ error: err?.message || "Invalid signature" });
    return;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const email = session.customer_details?.email;
    
    console.log("[stripeWebhook] checkout.session.completed event");
    console.log("[stripeWebhook] Customer email:", email);
    console.log("[stripeWebhook] Session ID:", session.id);
    console.log("[stripeWebhook] Amount total:", session.amount_total);
    console.log("[stripeWebhook] Currency:", session.currency);
    
    if (!email) {
      console.error("[stripeWebhook] Missing customer email in session");
      res.status(400).json({ error: "Missing customer email" });
      return;
    }

    const seats = await seatsFromStripeSession(stripe, session.id);
    console.log("[stripeWebhook] Seats extracted:", seats);

    const subscriptionId = typeof session.subscription === "string" ? session.subscription : undefined;
    let currentPeriodEnd: Date | undefined;
    if (subscriptionId) {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      const currentPeriodEndSec = (sub as any)?.current_period_end;
      if (typeof currentPeriodEndSec === "number") currentPeriodEnd = new Date(currentPeriodEndSec * 1000);
      console.log("[stripeWebhook] Subscription ID:", subscriptionId, "Period end:", currentPeriodEnd);
    }

    const amountTotal = typeof session.amount_total === "number" ? session.amount_total : 0;

    // Extract all available customer details
    const customerDetails = {
      name: session.customer_details?.name,
      email: session.customer_details?.email,
      phone: session.customer_details?.phone,
      address: session.customer_details?.address ? {
        line1: session.customer_details.address.line1,
        line2: session.customer_details.address.line2,
        city: session.customer_details.address.city,
        state: session.customer_details.address.state,
        postal_code: session.customer_details.address.postal_code,
        country: session.customer_details.address.country,
      } : undefined,
    };

    // Extract payment method details if available
    let paymentMethod: any = undefined;
    if (typeof session.payment_intent === "string") {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent, {
          expand: ["charges.data.payment_method_details"],
        });
        const charge = (paymentIntent as any).charges?.data?.[0];
        if (charge?.payment_method_details) {
          const pmDetails = charge.payment_method_details;
          paymentMethod = {
            type: pmDetails.type,
            card: pmDetails.card ? {
              brand: pmDetails.card.brand,
              last4: pmDetails.card.last4,
              exp_month: pmDetails.card.exp_month,
              exp_year: pmDetails.card.exp_year,
            } : undefined,
          };
        }
      } catch (err) {
        console.warn("[stripeWebhook] Failed to retrieve payment intent details");
      }
    }

    console.log("[stripeWebhook] Creating purchase and licenses for:", email);
    const result = await createPurchaseAndLicenses({
      email,
      seats,
      mode: event.livemode ? "live" : "test",
      amount: Math.round(amountTotal / 100),
      currency: session.currency || "eur",
      stripeEventId: event.id,
      stripeCustomerId: typeof session.customer === "string" ? session.customer : undefined,
      stripeSessionId: session.id,
      stripeSubscriptionId: subscriptionId,
      stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : undefined,
      currentPeriodEnd,
      customerDetails,
      paymentMethod,
    });

    console.log("[stripeWebhook] Purchase created successfully:", result);
    res.status(200).json({ ok: true, ...result });
    return;
  }

  console.log("[stripeWebhook] Ignoring event type:", event.type);
  res.status(200).json({ ok: true, ignored: true, type: event.type });
});

export const testWebhookCheckoutSessionCompleted = onRequest(
  { region: process.env.FUNCTIONS_REGION || "us-central1" },
  async (req: any, res: any) => {
    if (!assertPost(req, res)) return;

    const providedSecret = req.header("X-Test-Secret");
    if (!providedSecret || providedSecret !== getTestWebhookSecret()) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const body = (req.body || {}) as any;
    const email = body?.customer_details?.email;
    const seats = Number(body?.line_items?.[0]?.seats) === 3 ? 3 : 1;
    const amount = Number(body?.line_items?.[0]?.amount_eur) || (seats === 3 ? 120 : 69);
    const currency = String(body?.currency || "eur");

    if (!email) {
      res.status(400).json({ error: "Missing customer_details.email" });
      return;
    }

    const result = await createPurchaseAndLicenses({
      email,
      seats,
      mode: "test",
      amount,
      currency,
    });

    res.status(200).json({ ok: true, ...result });
  },
);

export const adminListPurchases = onRequest({ region: process.env.FUNCTIONS_REGION || "us-central1" }, async (req: any, res: any) => {
  setCorsHeaders(res);
  
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  try {
    await requireAdminFromAuthHeader(req.header("Authorization"));
  } catch (err: any) {
    console.error("[adminListPurchases] Auth error:", err?.message);
    res.status(401).json({ error: err?.message || "Unauthorized" });
    return;
  }

  try {
    const limit = Math.min(Number(req.query.limit || 50), 200);
    console.log("[adminListPurchases] Fetching purchases with limit:", limit);
    
    const snap = await db.collection("purchases").orderBy("createdAt", "desc").limit(limit).get();
    console.log("[adminListPurchases] Found", snap.docs.length, "purchases");
    
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    console.log("[adminListPurchases] Returning items:", items.length);
    
    res.status(200).json({ items });
  } catch (err: any) {
    console.error("[adminListPurchases] Error:", err?.message);
    res.status(500).json({ error: err?.message || "Failed to list purchases" });
  }
});

export const adminListLicenses = onRequest({ region: process.env.FUNCTIONS_REGION || "us-central1" }, async (req: any, res: any) => {
  setCorsHeaders(res);
  
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  try {
    await requireAdminFromAuthHeader(req.header("Authorization"));
  } catch (err: any) {
    res.status(401).json({ error: err?.message || "Unauthorized" });
    return;
  }

  const limit = Math.min(Number(req.query.limit || 50), 200);
  const snap = await db.collection("licenses").orderBy("createdAt", "desc").limit(limit).get();
  res.status(200).json({
    items: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
  });
});

export const adminCreateManualLicense = onRequest({ region: process.env.FUNCTIONS_REGION || "us-central1" }, async (req: any, res: any) => {
  setCorsHeaders(res);
  
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (!assertPost(req, res)) return;

  let decoded: any;
  try {
    decoded = await requireAdminFromAuthHeader(req.header("Authorization"));
  } catch (err: any) {
    res.status(401).json({ error: err?.message || "Unauthorized" });
    return;
  }

  const body = (req.body || {}) as any;
  const email = String(body.email || "").trim();
  const seats = Number(body.seats) === 3 ? 3 : 1;

  if (!email || !email.includes("@")) {
    res.status(400).json({ error: "Invalid email" });
    return;
  }

  const nowTs = admin.firestore.Timestamp.now();
  const purchaseRef = db.collection("purchases").doc();

  const purchase: PurchaseDoc = {
    provider: "stripe",
    mode: "test",
    status: "paid",
    email,
    seats,
    productType: "annual",
    amount: seats === 3 ? 120 : 69,
    currency: "eur",
    createdAt: nowTs,
  };

  const encryptionKey = getEncryptionKeyBase64();
  const keys: string[] = [];
  const validUntil = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000));

  const licenses: Array<{ ref: admin.firestore.DocumentReference; doc: LicenseDoc }> = [];

  for (let i = 1; i <= seats; i++) {
    const plainKey = generateLicenseKey();
    const keyEncrypted = encryptAesGcmBase64(plainKey, encryptionKey);
    const keyHash = sha256Base64(plainKey);

    const licenseRef = db.collection("licenses").doc();
    const doc: LicenseDoc = {
      email,
      purchaseId: purchaseRef.id,
      type: "manual",
      seatIndex: i,
      isActive: true,
      validUntil,
      keyEncrypted,
      keyHash,
      createdAt: nowTs,
      createdBy: { type: "admin", uid: decoded.uid },
    };

    keys.push(plainKey);
    licenses.push({ ref: licenseRef, doc });
  }

  await db.runTransaction(async (tx) => {
    tx.set(purchaseRef, purchase);
    for (const l of licenses) tx.set(l.ref, l.doc);
  });

  await sendLicenseEmail({ to: email, keys, seats, amountEur: seats === 3 ? 120 : 69 });

  res.status(200).json({ ok: true, purchaseId: purchaseRef.id, licenseCount: seats });
});

export const setupAdminClaim = onRequest({ region: process.env.FUNCTIONS_REGION || "us-central1" }, async (req: any, res: any) => {
  setCorsHeaders(res);
  
  console.log("[setupAdminClaim] Request received");

  if (req.method === "OPTIONS") {
    res.status(200).send("");
    return;
  }

  if (!assertPost(req, res)) return;

  // Verify either Admin Authorization OR Setup Secret
  const authHeader = req.header("Authorization");
  const setupSecret = req.header("X-Setup-Secret");
  const adminSetupSecret = process.env.ADMIN_SETUP_SECRET;

  console.log("[setupAdminClaim] Auth header:", authHeader ? "present" : "missing");
  console.log("[setupAdminClaim] Setup secret:", setupSecret ? "present" : "missing");
  console.log("[setupAdminClaim] Admin setup secret env:", adminSetupSecret ? "present" : "missing");

  let isAuthorized = false;

  // Check if user is already admin
  if (authHeader) {
    try {
      await requireAdminFromAuthHeader(authHeader);
      console.log("[setupAdminClaim] User is already admin");
      isAuthorized = true;
    } catch (err) {
      console.log("[setupAdminClaim] User is not admin, checking setup secret");
    }
  }

  // Check if setup secret is valid
  if (!isAuthorized && setupSecret && adminSetupSecret) {
    console.log("[setupAdminClaim] Comparing secrets:", setupSecret === adminSetupSecret);
    if (setupSecret === adminSetupSecret) {
      console.log("[setupAdminClaim] Setup secret is valid");
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    console.error("[setupAdminClaim] Unauthorized");
    res.status(401).json({ error: "Unauthorized: Missing valid Authorization or Setup Secret" });
    return;
  }

  const email = String((req.body || {})?.email || "").trim();
  console.log("[setupAdminClaim] Email:", email);

  if (!email || !email.includes("@")) {
    console.error("[setupAdminClaim] Invalid email");
    res.status(400).json({ error: "Invalid email" });
    return;
  }

  try {
    // Get the user (should already exist from Firebase Auth)
    const user = await admin.auth().getUserByEmail(email);
    console.log("[setupAdminClaim] User found:", user.uid);

    // Set admin claim
    await admin.auth().setCustomUserClaims(user.uid, { admin: true });
    console.log("[setupAdminClaim] Admin claim set");

    // Create user document in Firestore
    const nowTs = admin.firestore.Timestamp.now();
    await db.collection("users").doc(user.uid).set({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || null,
      photoURL: user.photoURL || null,
      admin: true,
      createdAt: nowTs,
      updatedAt: nowTs,
    }, { merge: true });
    console.log("[setupAdminClaim] User document created in Firestore");

    console.log("[setupAdminClaim] Admin claim set for:", email);
    res.status(200).json({ ok: true, uid: user.uid, email });
  } catch (err: any) {
    console.error("[setupAdminClaim] Error:", err?.message);
    res.status(400).json({ error: err?.message || "Failed to setup admin" });
  }
});

export const adminGetTransaction = onRequest({ region: process.env.FUNCTIONS_REGION || "us-central1" }, async (req: any, res: any) => {
  setCorsHeaders(res);
  
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  try {
    await requireAdminFromAuthHeader(req.header("Authorization"));
  } catch (err: any) {
    res.status(401).json({ error: err?.message || "Unauthorized" });
    return;
  }

  const transactionId = req.query.id as string;
  if (!transactionId) {
    res.status(400).json({ error: "Missing transaction ID" });
    return;
  }

  const doc = await db.collection("purchases").doc(transactionId).get();
  if (!doc.exists) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }

  res.status(200).json({
    id: doc.id,
    ...doc.data(),
  });
});

export const testSendEmail = onRequest({ region: process.env.FUNCTIONS_REGION || "us-central1" }, async (req: any, res: any) => {
  setCorsHeaders(res);
  
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (!assertPost(req, res)) return;

  const providedSecret = req.header("X-Test-Secret");
  if (!providedSecret || providedSecret !== getTestWebhookSecret()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const body = (req.body || {}) as any;
  const email = String(body.email || "").trim();
  const keys = Array.isArray(body.keys) ? body.keys : ["TEST-KEY-001", "TEST-KEY-002"];
  const seats = Number(body.seats) || keys.length;

  if (!email || !email.includes("@")) {
    res.status(400).json({ error: "Invalid email" });
    return;
  }

  try {
    await sendLicenseEmail({
      to: email,
      keys,
      seats,
      amountEur: body.amountEur,
    });
    res.status(200).json({ ok: true, message: `Email sent to ${email}` });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to send email" });
  }
});

export const testCreateLicense = onRequest({ region: process.env.FUNCTIONS_REGION || "us-central1" }, async (req: any, res: any) => {
  setCorsHeaders(res);
  
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (!assertPost(req, res)) return;

  const providedSecret = req.header("X-Test-Secret");
  if (!providedSecret || providedSecret !== getTestWebhookSecret()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const body = (req.body || {}) as any;
  const email = String(body.email || "").trim();
  const seatIndex = Number(body.seatIndex || 0);

  if (!email || !email.includes("@")) {
    res.status(400).json({ error: "Invalid email" });
    return;
  }

  try {
    // Generate license key
    const licenseKey = generateLicenseKey();
    const keyHash = sha256Base64(licenseKey);
    const encryptionKey = getEncryptionKeyBase64();
    const keyEncrypted = encryptAesGcmBase64(licenseKey, encryptionKey);

    // Create license document in Firestore
    const nowTs = admin.firestore.Timestamp.now();
    const validUntil = new Date();
    validUntil.setFullYear(validUntil.getFullYear() + 1);
    const validUntilTs = admin.firestore.Timestamp.fromDate(validUntil);

    const licenseRef = await db.collection("licenses").add({
      email,
      type: "manual",
      seatIndex,
      isActive: true,
      validUntil: validUntilTs,
      keyEncrypted,
      keyHash,
      createdAt: nowTs,
      createdBy: { type: "admin", uid: "test" },
    } as LicenseDoc);

    console.log("[testCreateLicense] License created:", licenseRef.id);

    // Send email with license key
    await sendLicenseEmail({
      to: email,
      keys: [licenseKey],
      seats: 1,
      amountEur: 0,
    });

    res.status(200).json({
      ok: true,
      licenseId: licenseRef.id,
      email,
      licenseKey,
      validUntil: validUntilTs.toDate().toISOString(),
      message: `License created and email sent to ${email}`,
    });
  } catch (err: any) {
    console.error("[testCreateLicense] Error:", err?.message);
    res.status(500).json({ error: err?.message || "Failed to create license" });
  }
});
