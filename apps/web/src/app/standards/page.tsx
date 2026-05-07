"use client";

import { useState } from "react";

const SECTIONS = [
  {
    id: "doktrin",
    title: "SnP Yazılım İnşa Doktrini",
    subtitle: "Yedi Halka, Eş Anlı İnşa — SnP-YID-001 v1.0",
    content: `ÖNSÖZ

Geleneksel yazılım geliştirme akışı doğrusaldır ve bu doğrusallık bir tercih değil, bir alışkanlıktır: önce kod yazılır, sonra dokümante edilir, sonra reklam çekilir, sonra satışa çıkılır, sonra destek kurulur. Bu adımların birbirinden ayrı düşünülmesi, yazılımın "iş" olarak değil "ürün" olarak tasavvur edilmesinden gelir. SnP bu tasavvuru bırakmıştır.

SnP'nin ürettiği şey bir uygulama değil, bir döngüdür: piyasanın ya da kurumun ihtiyacını sezdiğimiz andan, o ihtiyacı nakde ya da iç değere çevirdiğimiz ana kadar uzanan, sıfır insan müdahalesiyle dönen yedi halkalı bir spiral. Halkalar sırayla değil, eş zamanlı çalışır; tek bir Launch komutuna bağlanır. İnsanın rolü operatörlük değil, orkestra şefliğidir — neyin çalınacağını söyler, enstrümanları kendisi çalmaz.

Madde 1 — Kapsam ve Yürürlük
Bu doktrin, SnP bünyesinde bundan sonra geliştirilecek tüm yazılımlar için yürürlüktedir; satışa konu ürün, müvekkil platformu, iç araç, otomasyon, modül, portal — istisnasız. Tek bir proje değil, kalıcı bir üretim disiplini tanımlar.

Madde 2 — Proje Kabulü ve İki Soru
Yeni bir yazılım talebi geldiğinde ekip işe başlamadan önce iki soruyu sorar:
1. Bu yazılımın native mobil uygulaması olacak mı?
2. Bu yazılım satışa konu bir ürün müdür, yoksa iç işlerimizde mi kullanılacaktır?
Bu iki cevap, doktrinin uygulanış şeklini değil, kapsam ve hedef kitlesini belirler.

Madde 3 — Temel İlke
Her yazılım, yedi halkanın eş anlı inşasıyla kurulur. Bir halkanın çıktısı henüz son haliyle üretilemiyorsa, o çıktının üretilmesi için gerekli ön doküman, şablon, veri yapısı ve karar kaydı eş zamanlı oluşturulacaktır.

Madde 4 — Sezgi
İhtiyacı ve boşluğu okuyacak sinyal motorunu kurun. Dış mod projelerde sinyal kaynağı piyasadır; iç mod projelerde sinyal kaynağı kurum içidir. Bu halkayla birlikte sinyal kaynakları envanteri, skorlama metodolojisi ve örnek bir Sezgi çıktı raporu eş zamanlı teslim edilir.

Madde 5 — İnşa
Yazılımı kurun. Bu halkayla birlikte ürün spec dokümanı, ortak domain ve veri modeli, mimari karar kayıtları (ADR), API kontratları, test stratejisi ve CI/CD yapılandırması eş zamanlı sunulur.

Madde 6 — Pedagoji
Aktif ve sesli rehberi çalıştırın. Kullanıcı yolculuğu senaryoları, ses karakteri profili, sesli rehber script şablonları, persona dokümanı, hata mesajı sözlüğü ve SSS taslakları eş zamanlı hazırlanır.

Madde 7 — İletişim
Ürünün dilini üreten katmanı kurun. Dış modda reklam metni, video promptu, e-posta sekansı; iç modda duyuru metni, değişim yönetimi mesajı, eğitim çağrısı. Her iki modda da iletişim dili kılavuzu ve şablon kütüphanesi eş zamanlı üretilir.

Madde 8 — Dağıtım
Doğru insanı bulan halkayı kurun. Dış modda hedef kitle haritası, kanal envanteri ve maliyet tablosu; iç modda departman/kademe haritası, rollout dalgası planı. Her iki modda eş zamanlı doküman teslimi şarttır.

Madde 9 — Dönüşüm
Onboarding akışını ve nihai dönüşümü yönetecek halkayı kurun. Ekran-ekran onboarding akışı, itiraz ve engel cevap dokümanı ve chatbot bilgi tabanı kaynak listesi eş zamanlı sunulur.

Madde 10 — Bağlılık
Tutmayı yöneten halkayı kurun. Sağlık skoru formülü, terk sinyali tanımları, müdahale playbook'u ve geri kazanım kampanya şablonları eş zamanlı hazırlanır.

Madde 11 — Launch Primitifi
Yedi halka tek bir Launch komutuna bağlanır. Bu komut, halkaları sıralı değil eş zamanlı tetikler. Hiçbir halka, Launch çağrısı dışında bir akışla devreye giremez.

Madde 12 — Platform Paraleli
Soru 1 cevabı "Evet" ise; omurga web, iOS native (Swift/SwiftUI) ve Android native (Kotlin/Jetpack Compose) olarak eş anlı kurulur. Cross-platform çözümlere (React Native, Flutter, MAUI) geçilmez. Cevap "Hayır" ise web tek platformtur.

Madde 13 — Repo Düzeni
Geliştirme Claude Code üzerinden yürütülür. Repo; apps/ ve rings/ dizinlerini barındırır. rings/ altında her halka kendi modülü olarak ayrı durur: sezgi/, insa/, pedagoji/, iletisim/, dagitim/, donusum/, baglilik/.

Madde 14 — Sahiplik
Her halkanın bir sorumlusu olur. Sorumlu, halkanın hem kodundan hem yan çıktılarından birinci derecede hesap verir.

Madde 15 — Teslim Şartı
Bir sprintte halka "teslim edildi" sayılması için üç koşul birlikte sağlanır:
1. Kod, talep edilen her platformda çalışır durumdadır.
2. Madde 4–10'da sayılan yan çıktılar repo'ya güncel olarak işlenmiştir.
3. Halka mevcut Launch primitifi tarafından çağrılabilirdir.

Madde 16 — Yürürlük
Bu doktrin, ekibe iletildiği tarihten itibaren yürürlüktedir; istisnalar yalnız SnP imzasıyla tanınır.`,
  },
  {
    id: "kabul",
    title: "Proje Kabul Formu",
    subtitle: "SnP Yazılım İnşa Doktrini'ne göre yeni proje girişi",
    content: `1. PROJE BİLGİLERİ

• Proje Adı: _________________________________
• Talep Eden (müvekkil / iç birim): _________________________________
• Proje Sorumlusu: _________________________________
• Tarih: _________________________________

2. DOKTRİN MADDE 2 — PROJE KAPSAM SORULARI

Soru 1: Bu yazılımın native mobil uygulaması olacak mı?
☐ Evet (web + iOS + Android)
☐ Hayır (yalnız web)

Soru 2: Bu yazılım satışa konu bir ürün müdür, yoksa iç işlerimizde mi kullanılacaktır?
☐ Satışa konu ürün (dış mod)
☐ İç işlerimizde kullanılacak (iç mod)

3. YEDİ HALKA SORUMLULUKLARI

#  Halka       Kısa Tanım                                    Sorumlu
1  Sezgi       Boşluğu okur, sinyali yakalar                ________________
2  İnşa        Yazılımı ve sistemi kurar                    ________________
3  Pedagoji    Aktif, sesli rehberle öğretir                ________________
4  İletişim    Reklam içeriği ve metin üretir              ________________
5  Dağıtım     Hedef kitleyi bulur, ulaştırır               ________________
6  Dönüşüm     Müşteriye, müşteriyi nakde çevirir          ________________
7  Bağlılık    Sağlık skorunu izler, müdahale eder          ________________

KABUL BEYANI

Aşağıda imzası bulunan yazılım ekip lideri ve halka sorumluları, SnP Yazılım İnşa Doktrini'ni (SnP-YID-001) okumuş, anlamış ve bu projeye eksiksiz uygulanacağını taahhüt etmiştir. Yedi halka, ilk sprintten itibaren eş anlı inşa edilecek; teslim şartları doktrin Madde 15'e göre değerlendirilecektir.

Yazılım Ekip Lideri      Halka Sorumluları (Temsilen)      SnP Yetkilisi
İmza • Tarih              İmza • Tarih                      İmza • Tarih`,
  },
];

export default function StandardsPage() {
  const [open, setOpen] = useState<string>("doktrin");

  return (
    <main className="min-h-screen bg-[#030b18] text-[#f0f4ff]">
      <header className="border-b border-[#1a2332] px-6 py-4 flex justify-between items-center">
        <div>
          <a href="/" className="text-[#4ab8ff] text-sm hover:underline">← Ana Sayfa</a>
          <h1 className="text-2xl font-bold mt-1">SnP Standartları</h1>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-4">
        {SECTIONS.map((section) => (
          <div
            key={section.id}
            className="bg-[#0a1120] border border-[#1a2332] rounded-2xl overflow-hidden"
          >
            <button
              onClick={() => setOpen(open === section.id ? "" : section.id)}
              className="w-full flex items-center justify-between p-5 text-left hover:bg-[#0f1720] transition-colors"
            >
              <div>
                <h2 className="text-xl font-semibold">{section.title}</h2>
                <p className="text-sm opacity-60 mt-0.5">{section.subtitle}</p>
              </div>
              <span className="text-2xl text-[#4ab8ff]">
                {open === section.id ? "−" : "+"}
              </span>
            </button>

            {open === section.id && (
              <div className="px-5 pb-6 border-t border-[#1a2332]">
                <pre className="whitespace-pre-wrap text-sm leading-relaxed opacity-90 font-sans mt-4">
                  {section.content}
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
