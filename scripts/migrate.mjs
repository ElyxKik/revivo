import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });

// ── Init Firebase Admin ───────────────────────────────────────────────────────
const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credPath) {
  console.error("❌ GOOGLE_APPLICATION_CREDENTIALS not set");
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(credPath, "utf8"));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ── Init Supabase ─────────────────────────────────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function toDate(val) {
  if (!val) return null;
  if (val?.toDate) return val.toDate().toISOString();
  if (val instanceof Date) return val.toISOString();
  return null;
}

// ── Migrate purchases ─────────────────────────────────────────────────────────
async function migratePurchases() {
  console.log("\n📦 Migrating purchases...");
  const idMap = new Map();

  const snapshot = await db.collection("purchases").get();
  console.log(`   Found ${snapshot.size} purchases in Firestore`);

  let success = 0, skipped = 0;

  for (const doc of snapshot.docs) {
    const d = doc.data();
    const row = {
      provider: d.provider ?? "stripe",
      mode: d.mode ?? "live",
      status: d.status ?? "paid",
      email: d.email,
      uid: d.uid ?? null,
      seats: d.seats ?? 1,
      product_type: d.productType ?? "annual",
      amount: d.amount ?? 0,
      currency: d.currency ?? "eur",
      stripe_event_id: d.stripeEventId ?? null,
      stripe_customer_id: d.stripeCustomerId ?? null,
      stripe_session_id: d.stripeSessionId ?? null,
      stripe_subscription_id: d.stripeSubscriptionId ?? null,
      stripe_payment_intent_id: d.stripePaymentIntentId ?? null,
      current_period_end: toDate(d.currentPeriodEnd),
      customer_details: d.customerDetails ?? null,
      payment_method: d.paymentMethod ?? null,
      created_at: toDate(d.createdAt) ?? new Date().toISOString(),
    };

    const { data, error } = await supabase.from("purchases").insert(row).select("id").single();
    if (error) {
      console.error(`   ❌ Purchase ${doc.id}: ${error.message}`);
      skipped++;
    } else {
      idMap.set(doc.id, data.id);
      success++;
    }
  }

  console.log(`   ✅ Purchases: ${success} migrated, ${skipped} failed`);
  return idMap;
}

// ── Migrate licenses ──────────────────────────────────────────────────────────
async function migrateLicenses(purchaseIdMap) {
  console.log("\n🔑 Migrating licenses...");

  const snapshot = await db.collection("licenses").get();
  console.log(`   Found ${snapshot.size} licenses in Firestore`);

  let success = 0, skipped = 0;

  for (const doc of snapshot.docs) {
    const d = doc.data();
    const supabasePurchaseId = d.purchaseId ? purchaseIdMap.get(d.purchaseId) ?? null : null;

    const row = {
      uid: d.uid ?? null,
      email: d.email,
      purchase_id: supabasePurchaseId,
      type: d.type ?? "annual",
      seat_index: d.seatIndex ?? 1,
      subscription_id: d.subscriptionId ?? null,
      is_active: d.isActive ?? true,
      valid_until: toDate(d.validUntil),
      key_encrypted: d.keyEncrypted,
      key_hash: d.keyHash,
      created_at: toDate(d.createdAt) ?? new Date().toISOString(),
      created_by_type: d.createdBy?.type ?? "stripe",
      created_by_uid: d.createdBy?.uid ?? null,
    };

    if (!row.key_encrypted || !row.key_hash) {
      console.warn(`   ⚠️  License ${doc.id} missing keys, skipping`);
      skipped++;
      continue;
    }

    const { error } = await supabase.from("licenses").insert(row);
    if (error) {
      console.error(`   ❌ License ${doc.id}: ${error.message}`);
      skipped++;
    } else {
      success++;
    }
  }

  console.log(`   ✅ Licenses: ${success} migrated, ${skipped} failed`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log("🚀 Starting Firestore → Supabase migration");

const purchaseIdMap = await migratePurchases();
await migrateLicenses(purchaseIdMap);

console.log("\n🎉 Migration complete!");
process.exit(0);
