import { NextResponse } from "next/server";
import { getAllUsersWithSubscriptions } from "@/lib/db";

export async function GET() {
  try {
    const users = await getAllUsersWithSubscriptions();
    return NextResponse.json({ users });
  } catch (err) {
    console.error("Admin users error:", err);
    return NextResponse.json({ error: "Kullanicilar alinamadi" }, { status: 500 });
  }
}
