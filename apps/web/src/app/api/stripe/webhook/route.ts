import { NextResponse } from "next/server";
import Stripe from "stripe";
import { updateSubscriptionByStripeId, createSubscription, getSubscriptionByUserId } from "@/lib/db";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  return new Stripe(key);
}

export async function POST(req: Request) {
  const payload = await req.text();
  const signature = req.headers.get("stripe-signature") || "";

  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown";
    console.error("Webhook signature error:", msg);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const subscriptionId = session.subscription as string;
        if (userId && subscriptionId) {
          const sub = await getStripe().subscriptions.retrieve(subscriptionId) as any;
          const existing = await getSubscriptionByUserId(userId);
          if (existing) {
            await updateSubscriptionByStripeId(existing.stripe_subscription_id || "", {
              status: sub.status,
              plan: getPlanFromPriceId(sub.items.data[0]?.price.id),
              current_period_end: new Date((sub.current_period_end as number) * 1000).toISOString(),
            });
          } else {
            await createSubscription({
              user_id: userId,
              stripe_subscription_id: subscriptionId,
              stripe_price_id: sub.items.data[0]?.price.id,
              status: sub.status,
              plan: getPlanFromPriceId(sub.items.data[0]?.price.id),
              current_period_end: new Date((sub.current_period_end as number) * 1000).toISOString(),
            });
          }
        }
        break;
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as any;
        const subscriptionId = invoice.subscription as string;
        if (subscriptionId) {
          const sub = await getStripe().subscriptions.retrieve(subscriptionId) as any;
          await updateSubscriptionByStripeId(subscriptionId, {
            status: sub.status,
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          });
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as any;
        await updateSubscriptionByStripeId(sub.id, {
          status: sub.status,
          plan: getPlanFromPriceId(sub.items.data[0]?.price.id),
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        });
        break;
      }
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

function getPlanFromPriceId(priceId: string | undefined): string {
  const PRO_PRICE = process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID;
  const ENT_PRICE = process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID;
  if (priceId === ENT_PRICE) return "enterprise";
  if (priceId === PRO_PRICE) return "pro";
  return "free";
}
