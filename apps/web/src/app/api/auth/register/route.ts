import { NextResponse } from "next/server";
import { hashPassword, createToken } from "@/lib/auth";
import { createUser, getUserByEmail, createSubscription } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { email, password, name } = await req.json();
    if (!email || !password || password.length < 6) {
      return NextResponse.json({ error: "Email ve en az 6 karakterli sifre gerekli" }, { status: 400 });
    }

    const existing = await getUserByEmail(email);
    if (existing) {
      return NextResponse.json({ error: "Bu email zaten kayitli" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const user = await createUser({ email, password_hash: passwordHash, name });
    await createSubscription({ user_id: user.id, plan: "free", status: "active" });

    const token = await createToken({ userId: user.id, email: user.email });

    const response = NextResponse.json({ success: true, user: { id: user.id, email: user.email, name: user.name } });
    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    return response;
  } catch (err) {
    console.error("Register error:", err);
    return NextResponse.json({ error: "Kayit basarisiz" }, { status: 500 });
  }
}
