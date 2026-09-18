const DEFAULT_API_URL = "https://api.chariow.com/v1";

export type ChariowPlan = {
  slug: string;
  productId: string;
  seats: 1 | 3;
  durationYears: 1 | 2 | 3;
  productType: "annual" | "biennial" | "triennial";
};

const planDefinitions = {
  "solo-1y": { env: "CHARIOW_PRODUCT_SOLO_1Y", seats: 1, durationYears: 1, productType: "annual" },
  "family-1y": { env: "CHARIOW_PRODUCT_FAMILY_1Y", seats: 3, durationYears: 1, productType: "annual" },
  "solo-2y": { env: "CHARIOW_PRODUCT_SOLO_2Y", seats: 1, durationYears: 2, productType: "biennial" },
  "family-2y": { env: "CHARIOW_PRODUCT_FAMILY_2Y", seats: 3, durationYears: 2, productType: "biennial" },
  "solo-3y": { env: "CHARIOW_PRODUCT_SOLO_3Y", seats: 1, durationYears: 3, productType: "triennial" },
  "family-3y": { env: "CHARIOW_PRODUCT_FAMILY_3Y", seats: 3, durationYears: 3, productType: "triennial" },
} as const;

function readRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

export function getChariowPlan(slug: string): ChariowPlan {
  const definition = planDefinitions[slug as keyof typeof planDefinitions];
  if (!definition) throw new Error("Unknown Chariow plan");

  return {
    slug,
    productId: readRequiredEnv(definition.env),
    seats: definition.seats,
    durationYears: definition.durationYears,
    productType: definition.productType,
  };
}

export function getChariowPlanByProductId(productId: string): ChariowPlan {
  for (const slug of Object.keys(planDefinitions)) {
    const plan = getChariowPlan(slug);
    if (plan.productId === productId) return plan;
  }
  throw new Error("Unknown Chariow product");
}

export async function chariowRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const apiKey = readRequiredEnv("CHARIOW_API_KEY");
  const apiUrl = (process.env.CHARIOW_API_URL || DEFAULT_API_URL).replace(/\/$/, "");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch(`${apiUrl}${path}`, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message = payload?.message || payload?.error || `Chariow API error (${response.status})`;
      throw new Error(message);
    }
    return payload as T;
  } finally {
    clearTimeout(timeout);
  }
}

export function checkoutCorsHeaders(origin: string | null) {
  const configuredOrigins = (process.env.CHECKOUT_ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim().replace(/\/$/, ""))
    .filter(Boolean);
  const allowed = new Set([
    "https://revivo-cleaner.online",
    "https://www.revivo-cleaner.online",
    "http://localhost:8000",
    ...configuredOrigins,
  ]);
  const normalizedOrigin = origin?.replace(/\/$/, "") || "";
  const allowOrigin = allowed.has(normalizedOrigin) ? normalizedOrigin : "";

  return {
    ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin } : {}),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}
