# Backlog: AUROCH & Auth Entegrasyonu

## Analiz Tarihi
2026-05-02

---

## Mevcut Durum

### Stack Özeti
| Katman | Teknoloji |
|--------|-----------|
| Framework | Next.js 14.2.35 (App Router) |
| Runtime | Node.js 18+ |
| UI | React 18, Tailwind CSS, Client Components ("use client") |
| DB (Prod) | PostgreSQL (`pg` driver, Vercel / Supabase bağlantısı muhtemel*) |
| DB (Dev) | SQLite (`better-sqlite3`) |
| State Mgmt | React `useState` / `useEffect` (global state yok) |
| Auth | **Yok** — tamamen anonim/public erişim |
| Middleware | Yok |
| Session | Yok |

> *`src/lib/db.ts` içinde `url.includes("supabase")` SSL kontrolü mevcut; prod DB muhtemelen Supabase PostgreSQL.

### Mevcut Veri Modeli
Tek tablo: `conversations`
```sql
id          TEXT PRIMARY KEY
title       TEXT NOT NULL
source      TEXT NOT NULL
project     TEXT NOT NULL
content     TEXT NOT NULL
tags        TEXT DEFAULT ''
model       TEXT DEFAULT ''
created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
```

**Eksiklikler:**
- `user_id` / `created_by` alanı yok → "kim upload etti?" bilinemiyor.
- `updated_at` yok.
- `visibility` / `status` yok.
- Soft-delete mekanizması yok.

### Mevcut API & UI Akışı
| Endpoint | Metod | Auth Durumu | Not |
|----------|-------|-------------|-----|
| `/api/conversations` | GET | ❌ Anonim | Tüm kayıtları listele |
| `/api/conversations` | POST | ❌ Anonim | Yeni kayıt oluştur |
| `/api/conversations?q=...` | GET | ❌ Anonim | Arama |
| `/api/conversations?models=...` | GET | ❌ Anonim | Filtreleme (Nostalji) |
| `/api/upload` | POST | ❌ Anonim | Dosya upload & import |
| `/api/conversations/[id]` | GET | ❌ Anonim | Tekil kayıt detayı |
| `/` | — | ❌ Public | Landing + Upload + Search + List |
| `/conversation/[id]` | — | ❌ Public | Detay görüntüleme |
| `/standards` | — | ❌ Public | SnP Doktrini |

**Tespit:**
- `upload/route.ts` içinde `source = "manual"` sabit; aslında `created_by` olmalı.
- `page.tsx` tamamen client component; auth state global bir context ile yönetilmeli.
- `layout.tsx` içinde provider yok.
- `.env.local` mevcut ancak içerik incelenemedi; `DATABASE_URL` ve muhtemelen bir `AUROCH_API_URL` tanımı gerekecek.

---

## Mimari Opsiyonlar

### Option A: AUROCH API + Custom JWT Session (Önerilen)
AUROCH platformu tek kaynaklı doğrulama (IdP) olarak kullanılır. KB kendi veritabanında sadece kullanıcı shadow tablosu ve rolleri tutar; session yönetimi lightweight JWT ile çözülür.

**Akış:**
1. Kullanıcı KB login formuna `email` + `password` girer.
2. KB server → AUROCH `POST /api/auth/login` (veya mevcut login endpoint) çağırır.
3. AUROCH başarılı yanıt verirse → KB `users` tablosunda kayıt bulunur/güncellenir.
4. Server `jose` kütüphanesi ile kısa ömürlü JWT üretir (`httpOnly`, `Secure`, `SameSite=Strict` cookie).
5. `middleware.ts` her istekte cookie'yi verify eder; geçersizse `/login`'e yönlendirir.
6. API route'lar `req` üzerinden `userId` + `role` bilgisine erişir.

**Gerekli Paketler:** `jose` (~20KB, Edge compatible), `cookie` / `cookies-next` (opsiyonel)

**Rol Senkronizasyonu:**
- AUROCH'tan gelen kullanıcı verisi içinde rol varsa doğrudan kullanılır.
- Yoksa KB `users` tablosunda `role` alanı default `viewer` atanır; admin tarafından elle yükseltilebilir.

---

### Option B: NextAuth.js (Auth.js) v5 + AUROCH Credentials Provider
Next.js ekosistemindeki standart auth kütüphanesi (v5 beta) kullanılır. AUROCH için özel `CredentialsProvider` yazılır.

**Akış:**
1. `next-auth` v5 kurulumu (`auth.ts`, `auth.config.ts`).
2. `CredentialsProvider` tanımlanır; `authorize()` içinde AUROCH login API çağrılır.
3. Başarılı yanıt `user` objesi olarak döner; session callback'ine `role` eklenir.
4. `middleware.ts` içinde `auth()` helper ile session kontrolü.
5. Client tarafında `useSession()` hook ile auth state yönetimi.

**Gerekli Paketler:** `next-auth@beta` (v5)

**Rol Senkronizasyonu:**
- `authorize()` sonucunda AUROCH'tan gelen `role` değeri `user` objesine eklenir.
- `jwt` ve `session` callback'leri ile `role` client/server arasında taşınır.

---

### Option C: Supabase Auth + AUROCH User Sync
Mevcut prod DB muhtemelen Supabase olduğundan Supabase Auth (GoTrue) kullanılır. AUROCH'taki kullanıcılar Supabase'e senkronize edilir veya AUROCH login sonrası Supabase session oluşturulur.

**Akış:**
1. Supabase projesinde Auth etkinleştirilir.
2. AUROCH'tan periyodik (veya ilk login'de) kullanıcı listesi çekilir.
3. Her AUROCH kullanıcısı için Supabase Auth'ta `email` + `password` (veya invite) ile hesap oluşturulur.
4. KB'de `public.users` tablosu Supabase `auth.users` ile foreign key ilişkisi kurar.
5. `@supabase/ssr` paketi ile Next.js App Router entegrasyonu; cookie-based session.
6. Row Level Security (RLS) politikaları ile DB seviyesinde yetki kontrolü.

**Gerekli Paketler:** `@supabase/supabase-js`, `@supabase/ssr`

**Rol Senkronizasyonu:**
- Supabase `auth.users` metadata içinde `role` saklanır.
- AUROCH'tan sync sırasında metadata güncellenir.

---

## Karşılaştırma Tablosu

| Kriter | Option A<br>Custom JWT + AUROCH | Option B<br>NextAuth v5 | Option C<br>Supabase Auth |
|--------|--------------------------------|------------------------|---------------------------|
| **Kurulum Karmaşası** | Düşük — 1 paket + cookie | Orta — config + provider dosyaları | Yüksek — Supabase projesi + RLS + sync |
| **AUROCH Entegrasyonu** | Doğrudan API çağrısı | CredentialsProvider içinde API çağrısı | Sync script / adapter yazımı gerekli |
| **App Router Uyumluluğu** | Mükemmel (Edge) | Beta, bazen breaking change | İyi (`@supabase/ssr`) |
| **Session Yönetimi** | Manuel (JWT sign/verify) | Otomatik (JWT/DB) | Otomatik (Supabase GoTrue) |
| **Yetki / Rol Kontrolü** | Middleware + DB query | Callback'ler + Middleware | RLS + Middleware |
| **Bağımlılık Sayısı** | 1 (jose) | 1 (next-auth) | 2+ (supabase-js, ssr) |
| **Password Reset / Email** | AUROCH üzerinden* | AUROCH üzerinden* | Supabase üzerinden |
| **Ölçeklenebilirlik** | İyi (stateless JWT) | İyi | Çok İyi (managed servis) |
| **Bakım Yükü** | Düşük (kendi kodun, anlaşılır) | Orta (v5 değişiklikleri takip) | Orta (sync + RLS yönetimi) |
| **Mevcut DB Etkisi** | Yok — mevcut PG/SQLite kalır | Yok | Var — RLS için Supabase özellikleri |

> *AUROCH master IdP olduğundan şifre sıfırlama, e-posta doğrulama vb. AUROCH'ta kalır.

---

## Önerilen Mimari

**Seçim: Option A — AUROCH API + Custom JWT Session**

### Neden Option A?
1. **Minimal Overhead:** Proje şu an tek tablo + 4 API route'dan oluşuyor. NextAuth v5 veya Supabase Auth bu boyuta göre ağır kalır.
2. **AUROCH Tek Kaynak:** Kullanıcılar "oradan çağrılacak"; çift kaynak (Supabase Auth + AUROCH) senkronizasyonu yönetimsel yük getirir.
3. **Mevcut Stack Uyumu:** `jose` Edge-compatible'dır ve App Router `middleware.ts` ile sorunsuz çalışır. Ekstra adapter/config dosyası yok.
4. **Kontrol:** JWT payload yapısı, cookie ayarları, token ömrü tamamen projeye özgü yönetilir.
5. **Kolay Geri Alma:** Eğer AUROCH entegrasyonu ertelenirse veya değişirse, sadece `lib/auth.ts` içindeki AUROCH client fonksiyonu değişir; geri kalan sistem etkilenmez.

### Ana Bileşenler
```
lib/
  db.ts                 ← mevcut (users tablosu eklenecek)
  auth.ts               ← YENİ: AUROCH client, JWT sign/verify, cookie utils
  auth-context.tsx      ← YENİ: React context + useAuth hook
middleware.ts           ← YENİ: JWT verify + route protection
app/
  login/page.tsx        ← YENİ: Login form (server/client mix)
  page.tsx              ← DEĞİŞİM: AuthContext wrapper, viewer/editor UI farkları
  api/auth/login/route.ts   ← YENİ
  api/auth/logout/route.ts  ← YENİ
  api/auth/me/route.ts      ← YENİ
```

### Cookie & JWT Stratejisi
- **Token:** `JWE` veya signed JWT (`HS256` veya `HS384`), payload: `{ sub, email, role, iat, exp }`
- **Cookie:** `httpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400` (1 gün)
- **Refresh:** Kısa vadede gerek yok; 1 günlük session yeterli. İleride `refresh_token` cookie'si eklenebilir.

---

## Yetki Matrisi

| İşlem | Admin | Editor | Viewer |
|-------|-------|--------|--------|
| **Genel Görüntüleme** | ✅ Tüm kayıtlar | ✅ Tüm kayıtlar | ✅ Tüm kayıtlar |
| **Arama / Filtreleme** | ✅ | ✅ | ✅ |
| **Yeni Sohbet Upload** | ✅ | ✅ | ❌ |
| **Manuel Kayıt Oluşturma** | ✅ | ✅ | ❌ |
| **Kendi Kaydını Düzenleme** | ✅ | ✅ | ❌ |
| **Herhangi Bir Kaydı Düzenleme** | ✅ | ❌ | ❌ |
| **Kayıt Silme (Soft)** | ✅ | ❌ (kendi hariç) | ❌ |
| **Kullanıcı Listesi Görme** | ✅ | ❌ | ❌ |
| **Kullanıcı Rol Atama** | ✅ | ❌ | ❌ |
| **SnP Standartları Görme** | ✅ | ✅ | ✅ |

### Rol Tanımları
- **Admin:** SnP KB yöneticisi. Tüm CRUD işlemleri, kullanıcı yönetimi ve sistem ayarları.
- **Editor:** Proje ekibi üyesi. Sohbet upload edebilir, kendi yüklediklerini düzenleyebilir, tüm arşivi okuyabilir.
- **Viewer:** Diğer AUROCH personeli. Salt okunur erişim; arama ve nostalji yapabilir ancak veri üretemez/değiştiremez.

> **Not:** Mevcutta "update" ve "delete" API endpoint'leri yoktur. Auth entegrasyonu ile birlikte bu endpoint'lerin de eklenmesi gerekir (ya da en azından admin paneli üzerinden soft-delete).

---

## DB Değişiklikleri

### 1. `users` Tablosu (Yeni)
AUROCH'tan çekilen veya ilk login'de oluşturulan kullanıcılar.

```sql
CREATE TABLE users (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid(),  -- KB iç ID
  auroch_id     TEXT UNIQUE,                                 -- AUROCH foreign key
  email         TEXT NOT NULL UNIQUE,
  full_name     TEXT,
  role          TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin','editor','viewer')),
  avatar_url    TEXT,
  last_login_at TIMESTAMP,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SQLite karşılığı
CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  auroch_id     TEXT UNIQUE,
  email         TEXT NOT NULL UNIQUE,
  full_name     TEXT,
  role          TEXT NOT NULL DEFAULT 'viewer',
  avatar_url    TEXT,
  last_login_at DATETIME,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 2. `conversations` Tablosu (Güncelleme)
```sql
-- PostgreSQL
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public','private','restricted'));

-- SQLite
ALTER TABLE conversations ADD COLUMN created_by TEXT;
ALTER TABLE conversations ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE conversations ADD COLUMN visibility TEXT DEFAULT 'public';
```

### 3. `conversation_permissions` Tablosu (Opsiyonel — İleriye Dönük)
Eğer ileride "kayda özel yetki" (örn. sadece X projesinin kayıtlarına erişim) gerekirse:
```sql
CREATE TABLE conversation_permissions (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id          TEXT REFERENCES users(id) ON DELETE CASCADE,
  role_override    TEXT CHECK (role_override IN ('editor','viewer')),
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```
> **V1'de bu tablo gerekli değildir.** Global rol matrisi yeterlidir.

### 4. Indexes
```sql
CREATE INDEX idx_conversations_created_by ON conversations(created_by);
CREATE INDEX idx_conversations_visibility  ON conversations(visibility);
CREATE INDEX idx_users_auroch_id           ON users(auroch_id);
CREATE INDEX idx_users_email               ON users(email);
```

---

## Uygulama Planı

### Faz 0: Hazırlık & Karar (Bekleme Durumunda)
- [ ] AUROCH API dokümantasyonunu / endpoint listesini temin et (`/api/users`, `/api/auth/login`)
- [ ] `.env.local` içine eklenecek değişkenlerin listesi belirlenir:
  - `AUROCH_API_URL=http://localhost:3100`
  - `AUROCH_API_KEY` (varsa)
  - `JWT_SECRET` (en az 32 byte random string)
  - `NEXT_PUBLIC_APP_URL`
- [ ] Kullanıcıdan AUROCH API erişim bilgileri ve örnek yanıt formatı talep edilir.

### Faz 1: Auth Altyapısı (Backend)
- [ ] `users` tablosunu SQLite & PostgreSQL migration'ları uygula.
- [ ] `lib/auth.ts` oluştur: AUROCH HTTP client, JWT sign/verify, cookie parse/serialize.
- [ ] `middleware.ts` oluştur: Cookie verify, public path whitelist (`/login`, `/api/auth/login`), role-based redirect.
- [ ] API route'ları:
  - `POST /api/auth/login` → AUROCH doğrula → JWT cookie set → user upsert
  - `POST /api/auth/logout` → Cookie clear
  - `GET /api/auth/me` → Aktif kullanıcı bilgisi döner
- [ ] Mevcut API route'ları koruma altına al:
  - `POST /api/upload` → `editor+` required
  - `POST /api/conversations` → `editor+` required
  - `GET /api/conversations` → `viewer+` (zaten public ama auth bilgisi ekle)

### Faz 2: Auth Altyapısı (Frontend)
- [ ] `lib/auth-context.tsx` oluştur: `useAuth()` hook, session fetch, login/logout fonksiyonları.
- [ ] `app/layout.tsx` içine `<AuthProvider>` sarmalayıcı ekle.
- [ ] `app/login/page.tsx` oluştur: Basit email/password formu.
- [ ] `app/page.tsx` güncelle:
  - Upload alanı: sadece `editor` ve `admin` görür.
  - Her kayıt kartında "Yükleyen: [İsim]" badge'i göster.
  - Admin için "Kullanıcı Yönetimi" linki.
- [ ] `app/conversation/[id]/page.tsx` güncelle:
  - Admin/owner için "Düzenle" / "Sil" butonları (opsiyonel V1.5).

### Faz 3: DB & Veri Bütünlüğü
- [ ] `conversations` tablosuna `created_by`, `updated_at`, `visibility` kolonlarını ekle.
- [ ] `upload/route.ts` içinde `source = "manual"` yerine `created_by = req.user.id` kullan.
- [ ] `createConversation` fonksiyonuna `created_by` parametresi ekle.
- [ ] Mevcut kayıtlar için `created_by` default değer ataması (örn. ilk admin ID'si veya `NULL`).

### Faz 4: Admin Araçları (Opsiyonel — V1.1)
- [ ] `app/admin/users/page.tsx`: Kullanıcı listesi, rol atama.
- [ ] `app/admin/page.tsx`: Upload istatistikleri (kim ne kadar upload etti).
- [ ] `api/admin/users/route.ts`: Kullanıcı CRUD (admin only).

### Faz 5: AUROCH Sync (Kullanıcı Hazır Olduğunda)
- [ ] AUROCH `GET /api/users` (veya benzeri) endpoint'i entegre et.
- [ ] Periyodik sync script (Vercel Cron veya manuel API): AUROCH'taki yeni kullanıcıları KB `users` tablosuna çek.
- [ ] Alternatif: İlk login anında AUROCH'tan kullanıcı detayı çek ve kaydet (lazy sync).

---

## Kararlar
- [ ] **Kullanıcı onayı bekleniyor:** AUROCH API endpoint'leri ve erişim bilgileri sağlanacak.
- [ ] **Opsiyon onayı:** Option A (Custom JWT) seçimi kullanıcı tarafından onaylanacak.
- [ ] **Rol tanımları:** AUROCH'ta mevcut rol hiyerarşisi varsa paylaşılacak; yoksa yukarıdaki Admin/Editor/Viewer matrisi kullanılacak.
- [ ] **Timeline:** Auth entegrasyonu "master-deploy sonrası" backlog olarak planlandı; öncelik ve sprint ataması yapılacak.
