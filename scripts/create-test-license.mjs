import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });

// Simple crypto functions (copied from crypto.ts)
function generateLicenseKey() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const parts = [];
  for (let i = 0; i < 4; i++) {
    let part = "";
    for (let j = 0; j < 4; j++) {
      part += chars[Math.floor(Math.random() * chars.length)];
    }
    parts.push(part);
  }
  return parts.join("-");
}

function sha256Base64(input) {
  return crypto.createHash("sha256").update(input).digest("base64");
}

function encryptAesGcmBase64(plaintext, keyBase64) {
  const key = Buffer.from(keyBase64, "base64");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString("base64");
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const email = "test@zecleaner.com";
const licenseKey = generateLicenseKey();
const keyHash = sha256Base64(licenseKey);
const keyEncrypted = encryptAesGcmBase64(licenseKey, process.env.LICENSE_ENCRYPTION_KEY_BASE64);

const validUntil = new Date();
validUntil.setFullYear(validUntil.getFullYear() + 1);

const { data, error } = await supabase.from("licenses").insert({
  email,
  type: "manual",
  seat_index: 1,
  is_active: true,
  valid_until: validUntil.toISOString(),
  key_encrypted: keyEncrypted,
  key_hash: keyHash,
  created_by_type: "admin",
  created_by_uid: "test",
}).select();

if (error) {
  console.error("❌ Error:", error);
  process.exit(1);
}

console.log("✅ License created!");
console.log("   ID:", data[0].id);
console.log("   Key:", licenseKey);
console.log("   Valid until:", validUntil.toISOString());
