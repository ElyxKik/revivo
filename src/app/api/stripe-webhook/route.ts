import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createPurchaseAndLicenses } from "@/lib/license";

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  return new Stripe(key);
}

export async function POST(req: NextRequest) {
  try {
    const stripe = getStripe();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return NextResponse.json({ error: "Missing STRIPE_WEBHOOK_SECRET" }, { status: 500 });
    }

    const sig = req.headers.get("stripe-signature");
    if (!sig) {
      return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
    }

    const rawBody = await req.text();

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err: any) {
      return NextResponse.json({ error: err?.message || "Invalid signature" }, { status: 400 });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const email = session.customer_details?.email;

      if (!email) {
        return NextResponse.json({ error: "Missing customer email" }, { status: 400 });
      }

      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 10 });
      const first = lineItems.data[0];
      const priceMeta = (first?.price as any)?.metadata || {};
      const seatsStr = priceMeta.seats;
      const seats: 1 | 3 = Number(seatsStr) === 3 ? 3 : 1;
      const durationYears = Number(priceMeta.duration_years) || 1;
      const productType = durationYears === 2 ? "biennial" : durationYears === 3 ? "triennial" : "annual";

      const subscriptionId = typeof session.subscription === "string" ? session.subscription : undefined;
      let currentPeriodEnd: Date | undefined;
      if (subscriptionId) {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        const currentPeriodEndSec = (sub as any)?.current_period_end;
        if (typeof currentPeriodEndSec === "number") currentPeriodEnd = new Date(currentPeriodEndSec * 1000);
      }

      const amountTotal = typeof session.amount_total === "number" ? session.amount_total : 0;

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
        } catch {
          // Non-critical
        }
      }

      const result = await createPurchaseAndLicenses({
        email,
        seats,
        mode: event.livemode ? "live" : "test",
        amount: Math.round(amountTotal / 100),
        currency: session.currency || "usd",
        durationYears,
        productType,
        stripeEventId: event.id,
        stripeCustomerId: typeof session.customer === "string" ? session.customer : undefined,
        stripeSessionId: session.id,
        stripeSubscriptionId: subscriptionId,
        stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : undefined,
        currentPeriodEnd,
        customerDetails,
        paymentMethod,
      });

      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ ok: true, ignored: true, type: event.type });
  } catch (err: any) {
    console.error("[stripe-webhook]", err?.message);
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
  }
}
