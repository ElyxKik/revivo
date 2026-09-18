import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { chariowRequest, checkoutCorsHeaders, getChariowPlan } from "@/lib/chariow";

const checkoutSchema = z.object({
  plan: z.enum(["solo-1y", "family-1y", "solo-2y", "family-2y", "solo-3y", "family-3y"]),
  email: z.string().trim().email().max(254),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
});

export function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: checkoutCorsHeaders(req.headers.get("origin")) });
}

export async function POST(req: NextRequest) {
  const headers = checkoutCorsHeaders(req.headers.get("origin"));
  try {
    const input = checkoutSchema.parse(await req.json());
    const plan = getChariowPlan(input.plan);
    const result = await chariowRequest<any>("/checkout", {
      method: "POST",
      body: JSON.stringify({
        product_id: plan.productId,
        email: input.email,
        first_name: input.firstName,
        last_name: input.lastName,
      }),
    });

    const data = result?.data || {};
    const checkoutUrl = data?.payment?.checkout_url || data?.checkout_url;
    if (data.step === "awaiting_payment" && checkoutUrl) {
      return NextResponse.json({ action: "redirect", checkoutUrl }, { headers });
    }
    if (data.step === "completed") {
      return NextResponse.json({ action: "completed", saleId: data?.purchase?.id }, { headers });
    }
    if (data.step === "already_purchased") {
      return NextResponse.json({ action: "already_purchased", message: data.message }, { headers });
    }
    throw new Error("Unexpected Chariow checkout response");
  } catch (error: any) {
    const validationError = error instanceof z.ZodError;
    return NextResponse.json(
      { error: validationError ? "Informations client invalides" : error?.message || "Checkout unavailable" },
      { status: validationError ? 400 : 502, headers },
    );
  }
}
