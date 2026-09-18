import crypto from "crypto";

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

const email = "test@zecleaner.com";
const licenseKey = generateLicenseKey();
const keyHash = sha256Base64(licenseKey);
const keyEncrypted = encryptAesGcmBase64(licenseKey, "plH+6o2R8ERQqlYuwyCSI4b8BiJB0oNaxqu9Pbiw8eM=");

const createdAt = new Date();
const validUntil = new Date();
validUntil.setFullYear(validUntil.getFullYear() + 1);

console.log("License Key (plain):", licenseKey);
console.log();
console.log("createdAt");
console.log(createdAt.toLocaleString("fr-FR", { timeZone: "Europe/Paris" }));
console.log("(timestamp)");
console.log();
console.log("createdBy");
console.log("(map)");
console.log();
console.log("type");
console.log('"admin"');
console.log("(string)");
console.log();
console.log("email");
console.log(`"${email}"`);
console.log("(string)");
console.log();
console.log("isActive");
console.log("true");
console.log("(boolean)");
console.log();
console.log("keyEncrypted");
console.log(`"${keyEncrypted}"`);
console.log("(string)");
console.log();
console.log("keyHash");
console.log(`"${keyHash}"`);
console.log("(string)");
console.log();
console.log("purchaseId");
console.log("null");
console.log("(string)");
console.log();
console.log("seatIndex");
console.log("1");
console.log("(int64)");
console.log();
console.log("subscriptionId");
console.log("null");
console.log("(string)");
console.log();
console.log("type");
console.log('"manual"');
console.log("(string)");
console.log();
console.log("validUntil");
console.log(validUntil.toLocaleString("fr-FR", { timeZone: "Europe/Paris" }));
console.log("(timestamp)");
