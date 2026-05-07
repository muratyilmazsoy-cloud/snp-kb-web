import { NextResponse } from "next/server";
import Stripe from "stripe";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { getUserWithSubscription } from "@/lib/db";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  return new Stripe(key);
}

export async function POST() {
  try {
    const token = cookies().get("token")?.value;
    if (!token) return NextResponse.json({ error: "Oturum acilmamis" }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: "Gecersiz token" }, { status: 401 });

    const user = await getUserWithSubscription(payload.userId);
    if (!user?.stripe_customer_id) {
      return NextResponse.json({ error: "Musteri bulunamadi" }, { status: 404 });
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/account`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Portal error:", err);
    return NextResponse.json({ error: "Portal basarisiz" }, { status: 500 });
  }
}
