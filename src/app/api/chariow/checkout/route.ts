import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { chariowRequest, checkoutCorsHeaders, getChariowPlan } from "@/lib/chariow";
import { supabaseServer } from "@/lib/supabaseServer";

const checkoutSchema = z.object({
  plan: z.enum(["solo-1y", "family-1y", "solo-2y", "family-2y", "solo-3y", "family-3y"]),
  email: z.string().trim().email().max(254),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(6).max(25),
  countryCode: z.string().trim().length(2).transform((value) => value.toUpperCase()),
  addressLine1: z.string().trim().min(2).max(150),
  addressLine2: z.string().trim().max(150).optional().default(""),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().max(100).optional().default(""),
  postalCode: z.string().trim().min(2).max(20),
});

export function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: checkoutCorsHeaders(req.headers.get("origin")) });
}

export async function POST(req: NextRequest) {
  const headers = checkoutCorsHeaders(req.headers.get("origin"));
  try {
    const input = checkoutSchema.parse(await req.json());
    const plan = getChariowPlan(input.plan);
    const placeholderEmail = `revivo.${randomUUID()}@example.com`;
    const result = await chariowRequest<any>("/checkout", {
      method: "POST",
      body: JSON.stringify({
        product_id: plan.productId,
        email: placeholderEmail,
        first_name: "Client",
        last_name: "Revivo",
        phone: {
          number: "612345678",
          country_code: "FR",
        },
      }),
    });

    const data = result?.data || {};
    const checkoutUrl = data?.payment?.checkout_url || data?.checkout_url;
    const saleId = data?.purchase?.id;
    if (saleId) {
      const amount = Math.round(Number(data?.purchase?.amount?.value || 0));
      const currency = String(data?.purchase?.amount?.currency || "eur").toLowerCase();
      const { error: purchaseError } = await supabaseServer().from("purchases").upsert({
        provider: "chariow",
        mode: process.env.NODE_ENV === "production" ? "live" : "test",
        status: "pending",
        email: input.email,
        seats: plan.seats,
        product_type: plan.productType,
        amount,
        currency,
        chariow_sale_id: saleId,
        chariow_product_id: plan.productId,
        product_name: data?.purchase?.product?.name || null,
        invoice_url: data?.purchase?.invoice_download_url || null,
        email_status: "pending",
        customer_details: {
          name: `${input.firstName} ${input.lastName}`.trim(),
          first_name: input.firstName,
          last_name: input.lastName,
          email: input.email,
          phone: input.phone,
          address: {
            line1: input.addressLine1,
            line2: input.addressLine2 || null,
            city: input.city,
            state: input.state || null,
            postal_code: input.postalCode,
            country: input.countryCode,
          },
        },
      }, { onConflict: "chariow_sale_id" });
      if (purchaseError) throw new Error(`Unable to save checkout: ${purchaseError.message}`);
    }
    if (["payment", "awaiting_payment"].includes(data.step) && checkoutUrl) {
      return NextResponse.json({ action: "redirect", checkoutUrl }, { headers });
    }
    if (data.step === "completed") {
      return NextResponse.json({ action: "completed", saleId }, { headers });
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
