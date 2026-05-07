import { NextResponse } from "next/server";
import Stripe from "stripe";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { getUserWithSubscription, updateUserStripeCustomerId } from "@/lib/db";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  return new Stripe(key);
}

export async function POST(req: Request) {
  try {
    const token = cookies().get("token")?.value;
    if (!token) return NextResponse.json({ error: "Oturum acilmamis" }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: "Gecersiz token" }, { status: 401 });

    const { priceId } = await req.json();
    if (!priceId) return NextResponse.json({ error: "Price ID gerekli" }, { status: 400 });

    const user = await getUserWithSubscription(payload.userId);
    if (!user) return NextResponse.json({ error: "Kullanici bulunamadi" }, { status: 404 });

    const stripe = getStripe();
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email, name: user.name || undefined });
      customerId = customer.id;
      await updateUserStripeCustomerId(user.id, customerId);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/account?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/pricing?canceled=true`,
      metadata: { userId: user.id },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Checkout error:", err);
    return NextResponse.json({ error: "Checkout basarisiz" }, { status: 500 });
  }
}
