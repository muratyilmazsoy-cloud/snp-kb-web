import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { getUserWithSubscription } from "@/lib/db";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const token = cookies().get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Oturum acilmamis" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Gecersiz token" }, { status: 401 });
    }

    const user = await getUserWithSubscription(payload.userId);
    if (!user) {
      return NextResponse.json({ error: "Kullanici bulunamadi" }, { status: 404 });
    }

    return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, stripe_customer_id: user.stripe_customer_id, created_at: user.created_at, subscription: user.subscription } });
  } catch (err) {
    console.error("Me error:", err);
    return NextResponse.json({ error: "Bir hata olustu" }, { status: 500 });
  }
}
