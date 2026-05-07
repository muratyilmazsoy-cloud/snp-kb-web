import { NextRequest, NextResponse } from "next/server";
import { getAllConversations, createConversation, filterConversations, filterConversationsPage } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  const models = searchParams.get("models");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const page = searchParams.get("page");
  const limit = searchParams.get("limit");

  try {
    const hasFilters = !!(q || models || dateFrom || dateTo);
    const hasPagination = !!(page || limit);

    if (hasPagination) {
      const result = await filterConversationsPage({
        query: q || undefined,
        models: models ? models.split(",") : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
      });
      return NextResponse.json({ conversations: result.items, total: result.total });
    }

    if (hasFilters) {
      const conversations = await filterConversations({
        query: q || undefined,
        models: models ? models.split(",") : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      return NextResponse.json({ conversations });
    }

    const conversations = await getAllConversations();
    return NextResponse.json({ conversations });
  } catch (err) {
    console.error("GET /api/conversations error:", err);
    return NextResponse.json({ error: "Veritabani hatasi" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, source, project, content, tags, model } = body;

    if (!title || !source || !content) {
      return NextResponse.json({ error: "title, source ve content zorunlu" }, { status: 400 });
    }

    const id = await createConversation({
      title,
      source: source || "manual",
      project: project || "Genel",
      content,
      tags: tags || "",
      model: model || "",
    });

    return NextResponse.json({ id, success: true });
  } catch (err) {
    console.error("POST /api/conversations error:", err);
    return NextResponse.json({ error: "Kayit hatasi" }, { status: 500 });
  }
}
