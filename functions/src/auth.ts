import admin from "firebase-admin";

export async function requireAdminFromAuthHeader(authHeader: string | null) {
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Missing Authorization header");
  const idToken = authHeader.slice("Bearer ".length);
  const decoded = await admin.auth().verifyIdToken(idToken);
  if (!(decoded as any).admin) throw new Error("Forbidden");
  return decoded;
}
