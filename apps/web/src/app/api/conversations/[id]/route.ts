import { NextRequest, NextResponse } from "next/server";
import { getConversation, updateConversation, deleteConversation } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const conv = await getConversation(params.id);
    if (!conv) {
      return NextResponse.json({ error: "Bulunamadi" }, { status: 404 });
    }
    return NextResponse.json({ conversation: conv });
  } catch (err) {
    console.error("GET /api/conversations/[id] error:", err);
    return NextResponse.json({ error: "Veritabani hatasi" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    await updateConversation(params.id, body);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PUT /api/conversations/[id] error:", err);
    return NextResponse.json({ error: "Guncelleme hatasi" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await deleteConversation(params.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/conversations/[id] error:", err);
    return NextResponse.json({ error: "Silme hatasi" }, { status: 500 });
  }
}
