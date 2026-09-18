import crypto from "crypto";

export function sha256Base64(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("base64");
}

export function generateLicenseKey(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(20);
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]);
  const raw = chars.join("");
  const groups = [raw.slice(0, 4), raw.slice(4, 8), raw.slice(8, 12), raw.slice(12, 16), raw.slice(16, 20)];
  return `ZC-${groups.join("-")}`;
}

export function encryptAesGcmBase64(plaintext: string, keyBase64: string): string {
  const key = Buffer.from(keyBase64, "base64");
  if (key.length !== 32) throw new Error("LICENSE_ENCRYPTION_KEY_BASE64 must be 32 bytes base64 (AES-256)");

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

export function decryptAesGcmBase64(payloadBase64: string, keyBase64: string): string {
  const key = Buffer.from(keyBase64, "base64");
  const buf = Buffer.from(payloadBase64, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}
