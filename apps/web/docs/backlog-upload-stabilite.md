# Backlog: Upload Stabilite

## Analiz Tarihi
2026-05-02

## Özet
Master-deploy sonrası 88 dosyadan 87'si başarıyla yüklendi, 1 dosya (`a6f3eef6-5623-4f63-80c1-a061b2da63d3.md`) "Network" hatası verdi. Bu kayıt, mevcut upload sisteminin derinlemesine analizini, olası nedenleri, çözüm önerileri ve test planını içerir. Kod değişikliği yapılmamıştır.

---

## İncelenen Dosyalar

| Dosya | Görev | Kritik Satırlar |
|-------|-------|-----------------|
| `src/app/page.tsx` | Upload UI, ZIP extraction, batch logic | 148–249 |
| `src/app/api/upload/route.ts` | API endpoint, dosya parse & DB yazma | 5–95 |
| `src/lib/db.ts` | Database layer (pg pool + SQLite) | 1–202 |

---

## Mevcut Mimari Özeti

### Client (`page.tsx`)
1. **ZIP extraction**: `JSZip.loadAsync()` ile tamamen client-side. ZIP içindeki tüm dosyalar `Promise.all` ile paralel extract edilir.
2. **100K truncation**: Client-side `mdText.length > 100_000` kontrolü ile kesme uygulanır. Ardından attachment listesi eklenir.
3. **Batch logic**: `batchSize = 5`. Sequential batch loop: her batch'te 5 dosya `Promise.all` ile **paralel** fetch edilir.
4. **Retry**: Yok. Herhangi bir `catch` (Network, 500, timeout) direkt `failedFiles` listesine atılır.
5. **Fetch**: Standart `fetch()`, `AbortController` yok, `keepalive` yok, timeout yok.
6. **State**: `uploadDone` her dosya tamamlandığında functional update ile artırılır.

### API (`route.ts`)
1. **Request parsing**: `req.formData()`, `files = formData.getAll("files")`.
2. **Sequential processing**: Gelen dosyalar `for (const file of files)` ile sırayla işlenir.
3. **Double truncation**: Client zaten truncate etmiş olsa da, server-side da ikinci bir 100K truncation var (`MAX_CONTENT = 100_000`).
4. **DB write**: Her dosya (ve JSON'daki her conversation) için `await createConversation(...)` çağrılır.
5. **Hata yakalama**: File-level `try/catch` var, ama fatal hatalar (örn. request body parse) üst catch'e düşer.

### Database (`db.ts`)
1. **pg pool**: Singleton pattern. `max: 2`, `idleTimeoutMillis: 30000`, `connectionTimeoutMillis: 5000`.
2. **SSL**: Supabase için `rejectUnauthorized: false`.
3. **Connection lifecycle**: `pool.query()` implicit client alır → sorgu çalıştırır → client'ı pool'a iade eder.
4. **Queue davranışı**: 5 paralel request geldiğinde, pool sadece 2'sine hemen connection verir. Kalan 3'ü queue'da bekler. `connectionTimeoutMillis` (5s) içinde connection alamazlarsa hata fırlatır.

---

## Bulgular

### 1. Pool-Request Uyumsuzluğu (Yüksek Risk)
- **Client**: Her batch'te 5 paralel `fetch` gönderir.
- **Server**: Her request en az 1 DB write yapar.
- **Pool**: `max: 2`. Aynı anda sadece 2 connection.
- **Sonuç**: 3 request queue'da bekler. Eğer önceki 2 request uzun sürerse (büyük dosya, yavaş network, cold start), kalanlar **connection timeout** (5s) hatası alabilir.

### 2. Vercel Hobby Timeout (Yüksek Risk)
- Vercel Hobby plan function timeout: **~10 saniye**.
- 88 dosya × ayrı request = ~18 batch.
- Her request'te: formData parse → `file.text()` → frontmatter parse → DB write.
- Büyük bir dosya veya pool queue gecikmesi, toplam süreyi 10s'i aşırabilir.
- Vercel connection'ı kestiğinde client **"Network"** hatası görür (response body olmadan).

### 3. Çift Truncation (Orta Risk)
- Client-side 100K truncation var (satır 195–196).
- Server-side da 100K truncation var (satır 58–61).
- Zararsız ama redundant. Büyük dosyalarda client zaten kesmiş olmasına rağmen server tekrar işliyor.

### 4. Retry Mekanizması Eksikliği (Yüksek Risk)
- Geçici sorunlar (network glitch, Vercel cold start, pool queue, DNS hiccup) direkt fail oluyor.
- Tek bir başarısız dosya, tüm batch'i durdurmuyor ama kullanıcıya alert olarak yansıyor.
- Kullanıcı manuel retry yapmak zorunda.

### 5. Dosya Boyutu Görünürlüğü Eksik (Orta Risk)
- `a6f3eef6-5623-4f63-80c1-a061b2da63d3.md` dosyasının truncation önceki orijinal boyutu bilinmiyor.
- ZIP extraction sonrası `new File([mdText + attachLines], ...)` oluşturuluyor.
- Eğer bu dosyanın attachment'ları çok fazlaysa (`_files/` altında çok sayıda dosya), `attachLines` kısmı truncation sonrası bile büyük olabilir.

### 6. fetch() Konfigürasyon Eksikliği (Düşük Risk)
- `fetch()` çağrısında `keepalive`, `signal` (AbortController), `cache` politikası yok.
- Tarayıcı tab unload veya network değişimi durumunda request kesilebilir.
- Büyük payload'larda Vercel edge'in istemci bağlantısını kesmesi daha olası.

### 7. ZIP Extraction Performansı (Düşük Risk)
- `JSZip.loadAsync(await zipFile.arrayBuffer())` tüm ZIP'i memory'e yükler.
- 88 dosya için sorun olmayabilir ama 100MB+ ZIP'lerde tarayıcı donabilir.
- Extract edilen dosyalar `application/octet-stream` tipiyle `File` oluşturuluyor; MIME type yanlış ama formData'da etkisi muhtemelen yok.

### 8. O(n²) Attachment Eşleştirme (Düşük Risk)
- Her MD dosyası için `otherFiles.filter((f) => f.name.includes(uuid + "_files/"))` çağrılır.
- 88 dosya için sorun değil ama büyük setlerde performans düşer.

---

## Olası Nedenler (88'den 1 Fail)

### Neden 1: Vercel Function Timeout
- **Senaryo**: Belirli bir batch'teki 5 paralel request'ten biri (muhtemelen en büyük dosya veya pool queue'da en geride kalan), Vercel'in 10s timeout limitini aşıyor.
- **Neden sadece 1**: Diğer 87 dosya hızlı işlendi, bu spesifik dosya ya daha büyük ya da pool queue'da kötü pozisyona düştü.
- **Client görünümü**: "Network" hatası (Vercel connection'ı kestiği için response gelmez).

### Neden 2: pg Pool Connection Timeout
- **Senaryo**: 5 paralel request'te, 2'si hemen connection alır. Kalan 3'ü bekler. `connectionTimeoutMillis: 5000` içinde connection alamazsa DB tarafında hata oluşur.
- **Neden sadece 1**: Race condition — genellikle 5 request'in 4'ü 5s içinde connection bulur, 1'i (en son gelen veya en büyük payload'lı) timeout'a takılır.
- **Client görünümü**: Server'da file-level catch yakalar ve `500` döner, ama eğer Vercel timeout'a takılırsa yine "Network" hatası olur.

### Neden 3: Dosya Boyutu / Payload Limit
- **Senaryo**: `a6f3eef6-5623-4f63-80c1-a061b2da63d3.md` dosyası truncation öncesi çok büyük olabilir. Veya `_files/` attachment'ları çok fazladır ve `attachLines` kısmı truncation sonrası bile büyük kalır.
- **Vercel Hobby payload limit**: ~4.5MB. Tek bir dosya bu limiti zorlayabilir.
- **Client görünümü**: Vercel 413 Payload Too Large veya connection drop → "Network" hatası.

### Neden 4: ZIP İçindeki Dosya Bozulması / Extract Hatası
- **Senaryo**: ZIP extract edilirken dosya bozuldu veya `File` objesi düzgün oluşturulmadı.
- **Olasılık**: Düşük. Eğer extract hatası olsaydı client-side `catch` bloğuna düşerdi (alert: "ZIP acilamadi"). Burada dosya extract edilmiş ama upload sırasında fail olmuş.

### Neden 5: Geçici Network / DNS / Edge Hatası
- **Senaryo**: Vercel edge network'ünde geçici bir glitch, DNS timeout veya region switch.
- **Olasılık**: Tekrarlanabilir değilse geçicidir. Retry mekanizması olsa çözülürdü.

### Neden 6: Dosya İçeriğinde Frontmatter Parse Sorunu
- **Senaryo**: Dosya `---` ile başlıyor ama kapanış `---` yok veya malformed frontmatter. Server'da `content.slice(3, end)` sonsuz döngüye giremez ama unexpected behavior olabilir.
- **Olasılık**: Düşük. File-level catch bu hatayı yakalar ve client'a `error` mesajı döner, "Network" olmazdı.

---

## Çözüm Önerileri

### Kısa Vade (Hızlı Kazanım, Düşük Risk)

| # | Öneri | Etki | Karmaşıklık |
|---|-------|------|-------------|
| 1 | **Client-side retry**: Her dosya için 3 deneme, exponential backoff (1s, 2s, 4s). "Network" ve `5xx` hatalarında otomatik retry. | Yüksek | Düşük |
| 2 | **Batch size 5 → 2**: `batchSize` pool max (2) ile eşleşsin. Sequential batch kalsın ama paralellik pool kapasitesini aşmasın. | Yüksek | Düşük |
| 3 | **fetch keepalive + signal**: `keepalive: true` ve `AbortController` ile 15s client timeout ekle. | Orta | Düşük |
| 4 | **Dosya boyutu loglama**: Client-side her dosyanın truncation sonrası boyutunu `console.log`la. Büyük dosyaları önceden tespit et. | Orta | Düşük |
| 5 | **Server-side redundant truncation kaldır**: Client zaten truncate ediyor, server'daki ikinci truncation gereksiz. Büyük dosyaların gerçek boyutunu görmek için kaldır veya logla. | Düşük | Düşük |

### Orta Vade (Mimari İyileştirme)

| # | Öneri | Etki | Karmaşıklık |
|---|-------|------|-------------|
| 6 | **Server-side batch insert**: Tüm dosyaları tek bir request'te gönder. Server transaction içinde `INSERT ... VALUES (...), (...), (...)` ile bulk insert yap. | Yüksek | Orta |
| 7 | **pg pool tuning**: `connectionTimeoutMillis: 5000 → 10000`, `idleTimeoutMillis: 30000 → 60000`. `max: 2` kalabilir ama queue davranışı iyileşir. | Orta | Düşük |
| 8 | **Async queue / worker pattern**: Client-side 5 paralel yerine, concurrency limiti 2 olan bir queue kullan (örn. `p-limit` benzeri). | Orta | Orta |
| 9 | **Progressive upload log**: Her başarısız dosyanın hata detayını (status code, response body, timestamp) UI'da göster, sadece alert değil. | Orta | Düşük |

### Uzun Vade (Altyapı)

| # | Öneri | Etki | Karmaşıklık |
|---|-------|------|-------------|
| 10 | **Vercel Pro / Edge Config**: Function timeout 10s → 60s, payload limit artırımı. | Yüksek | Orta |
| 11 | **pg pool max artırma**: `max: 2 → 5` (Vercel Pro ile anlamlı olur). | Orta | Düşük |
| 12 | **Background job / queue**: Dosyaları kabul et, Redis / Upstash Queue ile arka planda işle. Vercel'de background execution sınırlıdır; alternatif: Resend / Inngest. | Yüksek | Yüksek |

### Önerilen Öncelik Sırası
```
1. Batch size 5 → 2 (hemen)
2. Client-side retry 3x (hemen)
3. fetch keepalive + AbortController (hemen)
4. Server-side batch insert (bir sonraki sprint)
5. pg pool tuning (bir sonraki sprint)
6. Vercel Pro değerlendirmesi (milestone)
```

---

## Test Planı

### Reproduce

#### Senaryo A: Pool Exhaustion
1. **Hazırlık**: 10 adet 90K+ boyutunda `.md` dosyası oluştur.
2. **Adım**: Sistemi upload et. `batchSize = 5` ile gönder.
3. **Gözlem**: Browser Network tab'ında son batch'teki 1–2 request'in 5s+ sürdüğünü veya fail olduğunu gör.
4. **Doğrulama**: Server loglarında `connectionTimeoutMillis` veya pool queue hatası aranır.

#### Senaryo B: Timeout Reproduce
1. **Hazırlık**: 1 adet 200K+ `.md` dosyası + 4 adet küçük dosya oluştur.
2. **Adım**: Throttle network (Slow 3G) ile upload et.
3. **Gözlem**: Büyük dosyanın request'inin 10s+ sürdüğünü ve Vercel tarafından kesildiğini gör.
4. **Doğrulama**: Vercel Functions log'unda `TASK_TIMEOUT` hatası.

#### Senaryo C: Retry Etkinlik Testi
1. **Hazırlık**: API endpoint'ine geçici `Math.random() > 0.8` ile `500` dönen bir mock ekle.
2. **Adım**: 20 dosya upload et.
3. **Gözlem**: Retry mekanizması olmadan ~4 dosya fail olmalı. Retry ile 0 fail olmalı.

#### Senaryo D: Batch Size Karşılaştırması
1. **Hazırlık**: 50 dosyalık bir set.
2. **A**: `batchSize = 5` ile upload et, süre ve fail sayısını kaydet.
3. **B**: `batchSize = 2` ile upload et, süre ve fail sayısını kaydet.
4. **Karşılaştırma**: B seçeneğinde fail sayısının azaldığını, toplam sürenin ise batch sayısı arttığı için hafif arttığını doğrula.

### Verify

| Kriter | Metod | Başarı Tanımı |
|--------|-------|---------------|
| Retry çalışıyor | Network tab'ında fail olan request'in 2–3 saniye sonra tekrar denendiğini gör | Aynı dosya için 2. istek gönderilir |
| Batch size uyumlu | `pool.max` ile `batchSize` eşit veya küçük | `batchSize <= pool.max` |
| Timeout azaldı | 100 dosyalık sette 0 fail | 100/100 başarı |
| Payload limit güvenli | En büyük dosya 3MB altında | Vercel 4.5MB limit altında margin |

---

## Log / Debug Notları

- **Hata alan dosya**: `a6f3eef6-5623-4f63-80c1-a061b2da63d3.md`
- **Hata tipi**: Client-side `catch` bloğuna düşmüş → `failedFiles.push(... + ": Network")`
- **Yorum**: Bu, `fetch`'in response alamadan exception fırlattığını gösterir. Muhtemelen Vercel connection drop veya tarayıcı-level network hatası.
- **Bilinmeyen**: Dosyanın truncation öncesi orijinal boyutu, ZIP içindeki konumu, kaç attachment'ı olduğu.

---

## Kararlar

- [ ] **Batch size 5 → 2** düşürülecek (pool max: 2 ile uyumlu olsun)
- [ ] **Client-side retry (3x, exponential backoff)** eklenecek
- [ ] **fetch keepalive + AbortController (15s timeout)** eklenecek
- [ ] **Server-side batch insert** teknik analizi yapılacak (tüm dosyalar tek request)
- [ ] **pg pool tuning** (`connectionTimeoutMillis: 10000`) değerlendirilecek
- [ ] **Vercel Pro plan** maliyet/fayda analizi yapılacak
- [ ] **Loglama iyileştirmesi** — her fail olan dosyanın boyutu, süresi, hata kodu loglanacak
