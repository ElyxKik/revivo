/**
 * Migration script: Firestore → Supabase
 * 
 * Usage:
 *   npx ts-node --esm scripts/migrate-firestore-to-supabase.ts
 * 
 * Required env vars (add to .env.local or pass inline):
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *   NEXT_PUBLIC_SUPABASE_URL=...
 */

import * as admin from "firebase-admin";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// ── Init Firebase Admin ───────────────────────────────────────────────────────
const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credPath || !fs.existsSync(credPath)) {
  console.error("❌ GOOGLE_APPLICATION_CREDENTIALS not set or file not found.");
  console.error("   Download from Firebase Console → Project Settings → Service Accounts → Generate new private key");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(credPath),
});
const db = admin.firestore();

// ── Init Supabase ─────────────────────────────────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function toDate(val: any): string | null {
  if (!val) return null;
  if (val?.toDate) return val.toDate().toISOString();
  if (val instanceof Date) return val.toISOString();
  return null;
}

function camelToSnake(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`);
    result[snakeKey] = value;
  }
  return result;
}

// ── Migrate purchases ─────────────────────────────────────────────────────────
async function migratePurchases(): Promise<Map<string, string>> {
  console.log("\n📦 Migrating purchases...");
  const idMap = new Map<string, string>(); // firestore id → supabase id

  const snapshot = await db.collection("purchases").get();
  console.log(`   Found ${snapshot.size} purchases in Firestore`);

  let success = 0;
  let skipped = 0;

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

    const { data, error } = await supabase
      .from("purchases")
      .insert(row)
      .select("id")
      .single();

    if (error) {
      console.error(`   ❌ Purchase ${doc.id}: ${error.message}`);
      skipped++;
    } else {
      idMap.set(doc.id, data.id);
      success++;
      if (success % 10 === 0) console.log(`   ✓ ${success} purchases migrated...`);
    }
  }

  console.log(`   ✅ Purchases: ${success} migrated, ${skipped} failed`);
  return idMap;
}

// ── Migrate licenses ──────────────────────────────────────────────────────────
async function migrateLicenses(purchaseIdMap: Map<string, string>): Promise<void> {
  console.log("\n🔑 Migrating licenses...");

  const snapshot = await db.collection("licenses").get();
  console.log(`   Found ${snapshot.size} licenses in Firestore`);

  let success = 0;
  let skipped = 0;

  for (const doc of snapshot.docs) {
    const d = doc.data();

    // Map old Firestore purchase ID to new Supabase UUID
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
      console.warn(`   ⚠️  License ${doc.id} missing key_encrypted or key_hash, skipping`);
      skipped++;
      continue;
    }

    const { error } = await supabase.from("licenses").insert(row);

    if (error) {
      console.error(`   ❌ License ${doc.id}: ${error.message}`);
      skipped++;
    } else {
      success++;
      if (success % 10 === 0) console.log(`   ✓ ${success} licenses migrated...`);
    }
  }

  console.log(`   ✅ Licenses: ${success} migrated, ${skipped} failed`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🚀 Starting Firestore → Supabase migration");
  console.log(`   Supabase: ${supabaseUrl}`);
  console.log(`   Firebase credentials: ${credPath}`);

  try {
    const purchaseIdMap = await migratePurchases();
    await migrateLicenses(purchaseIdMap);
    console.log("\n🎉 Migration complete!");
  } catch (err) {
    console.error("\n❌ Migration failed:", err);
    process.exit(1);
  }

  process.exit(0);
}

main();
