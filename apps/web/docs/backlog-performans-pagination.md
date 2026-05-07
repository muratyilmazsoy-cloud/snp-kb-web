# Backlog: Performans & Pagination

## Analiz Tarihi
2026-05-02

## Bulgular

### 1. Tüm Liste Sorguları `SELECT *` Kullanıyor
- **Dosya:** `src/lib/db.ts`
- **Fonksiyonlar:** `getAllConversations`, `searchConversations`, `filterConversations`
- **Sorun:** `content` alanı (markdown metni, bazen 100.000+ karakter) her liste çekiminde JSON payload'a dahil ediliyor.
- **Etki:** 88 kayıt bile olsa büyük içerikli kayıtlar MB seviyesinde response üretebilir. Hızla artan kayıt sayısıyla birlikte Vercel serverless function timeout (10s) ve memory limit (1024MB) riski oluşur.
- **UI Etkisi:** `src/app/page.tsx` içinde `content` alanı **hiç kullanılmıyor**. Sadece `id, title, source, project, tags, model, created_at` render ediliyor. Bu, ağ ve serialization israfıdır.

### 2. Pagination Tamamen Eksik
- **API:** `src/app/api/conversations/route.ts` — `page`, `limit`, `cursor`, `offset` gibi hiçbir parametre kabul etmiyor.
- **UI:** Tüm `conversations` dizisi tek seferde `fetch` edilip state'e atılıyor (`setConversations(data.conversations || [])`).
- **Etki:** 500 kayıtta bile initial page load yavaşlar. 1000+ kayıtta browser tab memory şişmesi ve React render performans düşüşü yaşanır.

### 3. Arama Sorguları Full Table Scan Yapıyor
- **Dosya:** `src/lib/db.ts` (`searchConversations`, `filterConversations`)
- **Sorun:** `ILIKE '%query%'` (PostgreSQL) ve `LIKE '%query%'` (SQLite) kullanılıyor. Hem `title`, hem `content`, hem `tags` alanlarında aranıyor.
- **Etki:** `%` ile başlayan pattern'ler B-tree index kullanamaz. `content` alanı üzerinde `ILIKE` = sequential scan. Supabase free tier'da bu, CPU ve IOPS tüketimine yol açar.

### 4. Connection Pool Darboğaz Riski
- **Dosya:** `src/lib/db.ts`
- **Ayar:** `max: 2` connection limit (Vercel serverless uyumlu)
- **Sorun:** Uzun süren `SELECT *` + `ILIKE` sorguları connection'ı meşgul eder. Eşzamanlı request'lerde 3. istek kuyruğa girer veya timeout'a uğrar.

### 5. Filtre Parametreleri URL'de Taşınıyor Ama Sayfalama Yok
- Nostalji filtreleri (model, date range) ve arama query'si zaten query string ile çalışıyor. Pagination parametreleri (örn. `?page=2&limit=20`) eklenmesi doğal bir uzantı olacaktır.

### 6. SQLite ↔ PostgreSQL Paritesi
- Local dev SQLite, prod Supabase PostgreSQL. Her iki platformda da çalışacak pagination stratejisi seçilmeli.
- SQLite'da `LIMIT ? OFFSET ?` desteklenir. PostgreSQL'de de aynı syntax geçerlidir.

---

## Pagination Stratejisi

### Öneri: İki Aşamalı Yaklaşım

| Aşama | Yöntem | Kayıt Aralığı | Gerekçe |
|-------|--------|---------------|---------|
| **Aşama 1** | Offset-based (`LIMIT / OFFSET`) | 0 – ~1.000 kayıt | Basit implementasyon, sayfa numarasıyla atlama (nostalji aramalarında kritik), mevcut filtrelerle doğal entegrasyon. |
| **Aşama 2** (gelecek) | Cursor-based (`created_at + id`) | 1.000+ kayıt | Deep pagination'da OFFSET performans düşüklüğünü ortadan kaldırır. Veri ekleme/silme sırasında kayma (drift) olmaz. |

### Neden Offset-based ile Başlamalı?
- Kullanıcı "Nostalji" ile belirli tarih/model filtresi uygulayıp **sayfa 5'e gitmek** isteyebilir. Cursor-based'de bu mümkün değildir (sadece next/prev).
- Mevcut kayıt sayısı (~88) düşük. Offset-based'de performans sorunu henüz yok.
- `page` + `limit` query parametreleri mevcut filtre mimarisine (`?q=...&models=...&dateFrom=...`) kolayca eklenir.

### Sayfa Boyutu (Page Size)
- **Öneri:** `limit = 20` (varsayılan), maksimum `limit = 100` (hard cap API'de).
- 20 kayıt, UI kart yüksekliği ile birlikte ~2-3 ekran viewport'u doldurur; kullanıcı scroll eder ama çok fazla beklemez.

### Sayfalama UI Tipi
- **Öneri:** Numbered pagination (sayfa numaralı butonlar).
- Infinite scroll değil. Neden:
  - Footer erişilebilirliği (varsa gelecekte).
  - Belirli sayfaya URL ile gitme (`?page=3`).
  - Erişilebilirlik (screen reader) ve state yönetimi daha kolay.
  - Nostalji aramalarında kullanıcı sonuç kümesinin büyüklüğünü tahmin edebilir (toplam sayfa sayısı).

---

## Search Optimizasyonu

### Sorun: `content` Üzerinde `ILIKE` Arama
`content` alanı çok büyük ve `ILIKE '%query%'` bu alanda index kullanamaz. PostgreSQL'de `Seq Scan` kaçınılmazdır.

### Öneri: Arama Katmanı Ayrımı

#### Katman A — Hızlı Arama (UI Default)
- Sadece `title`, `tags`, `source`, `project` alanlarında ara.
- `SELECT` içinde `content` hariç tutulur.
- Bu katman anlık (sub-100ms) response verir.

#### Katman B — Derin Arama (Gelecek / Ayrı Toggle)
- `content` alanında da aranacaksa **Full Text Search (FTS)** kullanılmalıdır.
- PostgreSQL: `to_tsvector('turkish', title || ' ' || tags || ' ' || content)` + `tsquery` + `GIN` index.
- Supabase Dashboard üzerinden SQL editor ile `tsvector` kolonu ve trigger oluşturulabilir.

### SQLite Local Dev Uyumu
- SQLite'da `FTS5` extension'ı mevcut ancak `better-sqlite3` ile native compilation gerekebilir.
- **Pragmatik yaklaşım:** Local dev'de arama `LIKE` ile devam etsin (kayıt sayısı düşük). Production'da (Supabase) PostgreSQL FTS devreye girsin.
- Alternatif: `title` ve `tags`'e odaklanarak local dev'de de performans kabul edilebilir kalır.

### Sıralama (Ranking)
- FTS aktif olduğunda `ts_rank()` ile eşleşme skoruna göre sıralama yapılabilir.
- Şimdilik `ORDER BY created_at DESC` yeterlidir (kronolojik).

---

## DB Index Önerileri

Aşağıdaki index'ler Supabase PostgreSQL üzerinde oluşturulmalıdır. SQLite local dev için zorunlu değildir (kayıt sayısı düşük).

### 1. Temel Listeleme & Filtreleme
```sql
-- Kronolojik sıralama + pagination
CREATE INDEX idx_conversations_created_at ON conversations(created_at DESC);

-- Model filtresi (Nostalji)
CREATE INDEX idx_conversations_model ON conversations(model);

-- Tarih aralığı filtresi
CREATE INDEX idx_conversations_created_at_range ON conversations(created_at);
```

### 2. Composite Index (Filtre + Sıralama)
```sql
-- Model filtresi sonrası created_at sıralaması için
CREATE INDEX idx_conversations_model_created_at ON conversations(model, created_at DESC);
```

### 3. Full Text Search (Gelecek Aşama)
```sql
-- FTS için tsvector kolonu
ALTER TABLE conversations ADD COLUMN search_vector tsvector;

-- GIN index (hızlı full-text arama)
CREATE INDEX idx_conversations_fts ON conversations USING GIN(search_vector);

-- Trigger: tsvector otomatik güncelleme
CREATE OR REPLACE FUNCTION conversations_search_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('turkish', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('turkish', coalesce(NEW.tags, '')), 'B') ||
    setweight(to_tsvector('turkish', coalesce(NEW.content, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_conversations_search_update
  BEFORE INSERT OR UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION conversations_search_update();

-- Mevcut kayıtları backfill et
UPDATE conversations SET search_vector =
  setweight(to_tsvector('turkish', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('turkish', coalesce(tags, '')), 'B') ||
  setweight(to_tsvector('turkish', coalesce(content, '')), 'C');
```

> **Not:** `turkish` text search config Supabase'de varsayılan olarak yüklüdür. Alternatif `simple` kullanılabilir (case-insensitive, stemming olmadan).

### 4. Cursor-based Pagination İçin (Gelecek Aşama)
```sql
-- Cursor pagination: created_at + id composite
CREATE INDEX idx_conversations_cursor ON conversations(created_at DESC, id DESC);
```

---

## Lazy Loading / Infinite Scroll vs Sayfalı Liste

| Kriter | Infinite Scroll | Sayfalı Liste (Numbered) |
|--------|-----------------|--------------------------|
| **UX — Keşif** | ✅ Sürekli akış | ⚠️ Sayfa atlamaları gerekir |
| **UX — Hedefli Erişim** | ❌ Belirli kayda gitmek zor | ✅ Sayfa numarası bilinirse anında atlama |
| **State / URL** | ❌ Sayfa state'i URL'de yansımaz, paylaşılamaz | ✅ `?page=3` doğrudan paylaşılabilir |
| **Accessibility** | ❌ Screen reader, focus yönetimi zor | ✅ Standart navigasyon |
| **Implementation** | ⚠️ IntersectionObserver, virtual scroll gerekir | ✅ Basit skip/limit + butonlar |
| **SEO** | ⚠️ SSR'de karmaşık | ✅ SSR + sayfalama linkleri mümkün |
| **Memory** | ⚠️ Birikmiş DOM node'ları | ✅ Her sayfada sabit kart sayısı |

### Karar
**Sayfalı liste (numbered pagination)** uygulanacak. Sebep:
- KB (Knowledge Base) kullanım modeli "keşif" değil, "arama + bulma"dır. Kullanıcı belirli bir konuyu arar ve sonuçlarda gezinir.
- Nostalji filtreleri ile daraltılmış sonuç kümesinde sayfa atlama kritik.
- Mevcut UI kodunda React state yönetimi zaten karmaşıklaşıyor; infinite scroll eklemek teknik borcu artırır.

---

## Uygulama Planı

### Phase 0: Acil Payload Optimizasyonu (Zero-risk)
- `getAllConversations`, `searchConversations`, `filterConversations` fonksiyonlarındaki `SELECT *` yerine aşağıdaki kolonları seç:
  ```sql
  SELECT id, title, source, project, tags, model, created_at
  ```
- `content`'i sadece `getConversation(id)` bırak.
- **Tahmini etki:** Response boyutunda %80-95 azalma (içerik boyutuna bağlı).

### Phase 1: Offset Pagination
1. **API (`route.ts`):**
   - Query param'ları ekle: `page` (default 1), `limit` (default 20, max 100).
   - `page` ve `limit`'i `db.ts` fonksiyonlarına ilet.
   - Response şekli güncelle:
     ```json
     {
       "conversations": [...],
       "pagination": {
         "page": 1,
         "limit": 20,
         "total": 88,
         "totalPages": 5
       }
     }
     ```
   - `total` için `SELECT COUNT(*)` sorgusu (filtreli veya filtresiz) ekle.

2. **DB (`db.ts`):**
   - `getAllConversations`, `searchConversations`, `filterConversations` fonksiyonlarına `page`, `limit` parametreleri ekle.
   - SQL sonuna `LIMIT $n OFFSET $m` (PostgreSQL) / `LIMIT ? OFFSET ?` (SQLite) ekle.
   - Yeni bir `countConversations(params)` helper'ı ekle (toplam sayfa sayısı için).

3. **UI (`page.tsx`):**
   - `conversations` state'inin yanına `pagination` state'i ekle.
   - Alt kısma numbered pagination component'i ekle (`1 2 3 ... 5` gibi).
   - Sayfa değişiminde `fetchData()` / `fetchNostalji()`'ye `page` ekle.
   - URL query string'i senkronize tut (`?page=2&q=foo`).

### Phase 2: PostgreSQL Full Text Search (Production Only)
1. Supabase SQL Editor'de yukarıdaki FTS index ve trigger'ları oluştur.
2. `db.ts`'te PostgreSQL branch'ine `search_vector` kullanan yeni sorgu ekle:
   ```sql
   SELECT id, title, source, project, tags, model, created_at
   FROM conversations
   WHERE search_vector @@ plainto_tsquery('turkish', $1)
   ORDER BY ts_rank(search_vector, plainto_tsquery('turkish', $1)) DESC, created_at DESC
   LIMIT $2 OFFSET $3
   ```
3. SQLite branch'inde mevcut `LIKE` mantığı devam etsin (kayıt sayısı düşük).

### Phase 3: Cursor-based Pagination (Opsiyonel — 1.000+ Kayıt Sonrası)
- Derin sayfalarda (`page > 50`) offset performansı düşer.
- Bu noktada `created_at DESC, id DESC` cursor'ına geçiş planlanır.
- API response'una `nextCursor`, `prevCursor` eklenir.
- UI'da "Daha Fazla Yükle" butonu ile cursor-based lazy load hibrit yapılabilir.

---

## Kararlar
- [ ] **Phase 0** uygulanacak: `SELECT *` → `SELECT id, title, source, project, tags, model, created_at`
- [ ] **Phase 1** uygulanacak: Offset-based pagination (`page`, `limit`), API + UI
- [ ] **Phase 2** planlanacak: PostgreSQL FTS (`search_vector`, GIN index, trigger)
- [ ] **Phase 3** ertelenecek: Cursor-based pagination, kayıt sayısı 1.000+ olduğunda değerlendirilir
- [ ] Supabase PostgreSQL index'leri (`idx_conversations_created_at`, `idx_conversations_model`) oluşturulacak
- [ ] Infinite scroll **tercih edilmeyecek**; numbered pagination kullanılacak
- [ ] `content` alanı araması Phase 2'ye kadar kaldırılabilir veya ayrı "Derin Ara" toggle'ına bağlanabilir
