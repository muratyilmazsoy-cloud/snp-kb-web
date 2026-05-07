import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

export async function GET() {
  try {
    const pool = getPool();
    if (!pool) {
      return NextResponse.json({ error: "DB not available" }, { status: 500 });
    }

    // Fast: count models + sample content for keyword analysis
    const countRes = await pool.query(`SELECT model, COUNT(*) as c FROM conversations GROUP BY model`);
    const modelCounts: Record<string, number> = {};
    for (const row of countRes.rows) {
      modelCounts[row.model || "Bilinmiyor"] = parseInt(row.c, 10);
    }

    // Sample first 500 chars of content for keyword analysis (performance)
    const contentRes = await pool.query(`SELECT title, SUBSTRING(content, 1, 500) as snippet, model FROM conversations`);
    const conversations = contentRes.rows;

    const categoryScores = { para: 0, mutluluk: 0, basari: 0, huzur: 0, bilgi: 0, ilham: 0 };
    const patterns = {
      para: /para|finans|bütçe|maliyet|gelir|satış|fiyat|dolar|euro|tl|kazanç|yatırım|kar|ciro|müşteri|pazar|rekabet/i,
      mutluluk: /mutlu|sevinç|keyif|hobi|aile|sağlık|gülümse|neşe|sevgi|arkadaş|doğum|kutlama|yılbaşı|bayram/i,
      basari: /başarı|hedef|proje|tamamla|zafer|galibiyet|rekor|ödül|takdir|terfi|kariyer|büyüme|gelişim|mükemmel/i,
      huzur: /huzur|sakin|meditasyon|stres|dinlenme|tatil|rahat|Peace|yoga|doğa|deniz|orman|manzara/i,
      bilgi: /öğren|bilgi|araştırma|kitap|okul|eğitim|ders|üniversite|tez|makale|rapor|analiz|veri/i,
      ilham: /fikir|ilham|yaratıcı|tasarım|sanat|müzik|yazı|şiir|roman|film|oyun|inovasyon|startup/i,
    };

    for (const c of conversations) {
      const text = ((c.title || "") + " " + (c.snippet || "")).toLowerCase();
      for (const [cat, regex] of Object.entries(patterns)) {
        const matches = text.match(regex);
        if (matches) {
          categoryScores[cat as keyof typeof categoryScores] += matches.length;
        }
      }
    }

    return NextResponse.json({
      modelCounts,
      categoryScores,
      total: conversations.length,
    });
  } catch (err) {
    console.error("GET /api/distilasyon error:", err);
    return NextResponse.json({ error: "Analiz hatasi" }, { status: 500 });
  }
}
