# Yarık — Komutan Gemisi büyük planı

> **Durum:** v1 (2026-10-21). Sahiple soru–cevapla netleştirildi.
> Her madde üç durumdan birindedir:
> - **KARAR:** sahip onayladı.
> - **ÖNERİ:** agent önerdi; oyun testi ve ölçümle değişebilir. Sahip itiraz etmedikçe uygulanır.
> - **AÇIK:** henüz karar yok.
>
> Bütün sayılar ekonomi etüdü ve oyun testinden önce **hipotezdir**.
> **İlişki:** Bu dosya 01–13'ün üstüne gelir. Çelişkide burada KARAR olan geçerlidir. Uygulama
> başlayınca KARAR'lar 02'ye KG-K olarak taşınır, değerler 04 §13'e yazılır.

---

## 0. Bir cümlede Yarık

**Yarık**, galaksinin yanındaki tehlikeli ve zengin bir bölgedir. Komutan, Komuta Merkezi 9'da
seçtiği gemiyi döteryumla doldurup buraya gönderir. Kaynak toplar, avlar ya da avlanır. Yükü
bir çıkıştan ana gezegenine ulaştırabilirse kazanır.

Döngü: **HAZIRLAN (yakıt/mühimmat) → GİR → TOPLA / AVLA / SAKLAN → RİSKİ OKU → ÇIKIŞA KOŞ →
KAZAN ya da KAYBET → İKMAL / TAMİR → GEMİYİ GELİŞTİR → YENİDEN GİR.**

Galaksi döngüsünü besler, onun yerine geçmez (KG-K1, 01 §20). Sahip: *"Arada girip
oynasınlar ama tüm oyun buraya kaymamalı."*

### 0.1 Kalite çizgisi — KARAR: en önemli konu

Sahip (2026-10-21): *"En önem verdiğim konular: premium görüntü kalitesi ve performanslı, akıcı,
smooth ve bug-free oyun deneyimi!"*

Bu yüzden hiçbir faz yalnız "çalışıyor" diye kapanmaz. Her faz aşağıdaki üç kapıdan geçer. Sayılar
ÖNERİ'dir; ilk fazda ölçülüp sabitlenir.

**Görüntü (premium)**
- Her yeni varlık ve ekran, birleşmeden önce gerçek tarayıcıda fotoğraflanır
  (`node tools/visual.mjs`, galeri kamerası). Masaüstü ve 350 px telefon görünümü ayrı bakılır.
- LOD geçişi göz önünde "pat" diye olmaz (dither ile geçiş). Z-çakışması, titreyen gölge, dikiş
  yeri, patlak doku yok.
- Işık, motor izi, mermi, patlama ve kalkan efektleri "canlı NASA fotoğrafı" hissini taşır.
  Düşman ateşi her zaman okunur kalır.
- Lite pakette de görüntü premium kalır: çözünürlük düşer, sanat yönü düşmez.

**Akıcılık (performans)**
- Hedef 60 fps. Sahibin S22'sinde kare süresi p95 ≤ 16,7 ms. iPhone 12 mini'de çökme yok, p95
  ≤ 25 ms.
- 50 ms'yi aşan takılma yok: sıcak döngüde bellek ayırma yok, shader'lar yüklemede ısıtılır,
  varlıklar uçuşta değil girişte yüklenir.
- Diğer gemiler zıplamaz: ara değerleme pürüzsüz, düzeltme fark edilmeden yapılır. Kendi gemin
  girdine anında cevap verir (tahmin + uzlaştırma).
- Sunucu tick p95 < 5 ms (32 pilot).

**Hatasızlık (bug-free)**
- TDD (CLAUDE.md). Bulunan her hata önce onu yakalayan bir testle düzeltilir.
- Determinizm testi: aynı girdiyle sunucu ve istemci simülasyonu aynı sonucu verir.
- VPS'te botlarla uzun koşu (soak): saatlerce bellek sızıntısı, kopma ve sapma yok. Bot yalnız
  testte kullanılır; Yarık'ta bot yok.
- Faz kapanmadan önce sahibin telefonlarında (S22 + iPhone 12 mini) oynanır.

**Görsel üretimi:** konsept çizimleri, sınıf siluetleri, HUD maketleri, kostüm önizlemeleri ve doku
taslakları için **Codex** kullanılabilir (sahip izni, 2026-10-21). Üretilen görseller tasarım
kararını hızlandırır; oyundaki asıl varlıklar §14 hattından geçer.

---

## 0.2 İlk sürüm kapsam düzeltmesi — KARAR (24 Ekim 2026)

Sahip: “1. Yap. 2. Boşver, bu fikri şuanlık kaldıralım 3.4. Ertelenecek, sonra yapılacak.
İlk sürümde olmayacak. (kabul kriterlerinden çıkart) 5. yap 6. yap”. Numaralar kalan iş
listesidir: ortak giriş yapılacak; geçici çıkış/acil sıçrama kaldırıldı; Kalp olayı ve Öz
ertelendi; Amiral ve hazır bildirim/başkentte park yapılacak. Ayrıca skinler ertelendi.

Aşağıdaki eski öneriler bu ilk sürüm kapsamını genişletmez. Güncel iş ve kabul kaydı:
[22](22-ilk-surum-mantigi.md). Etkin yetenek rütbe tavanı 3 kalır; ilk sürümde Öz maliyeti yoktur.

---

## 1. Kararlar özeti

| # | Konu | Karar | § |
|---|---|---|---|
| 1 | Edinim | Komuta Merkezi 9'da gemi seçilir | 3 |
| 2 | Sınıflar | **Akıncı** (Saldırı) · **Muhafız** (Savunma) · **Kılavuz** (Destek) | 3 |
| 3 | Sınıf değişimi | Sezonluk kilit; seçimden sonraki ilk 24 saatte bir kez ücretsiz değişim | 3 |
| 4 | Simülatör | Core 9'dan önce tek kişilik deneme; ganimet ve XP yok; botlar yalnız burada | 3 |
| 5 | Yetenekler | Turbo herkeste + A yuvası sınıf imzası + B yuvası taktik seçimi | 4 |
| 6 | İllüzyon | Kopya geminin içinde doğar; girdinin tam tersi (sağ-sol **ve** yukarı-aşağı); hız, turbo ve fren aynı | 4 |
| 7 | Radar | Kayaya inip saklananları da gösterir; taranan uyarı alır | 4 |
| 8 | Gelişim | XP + kaynak ödemesi ile seviye atlanır | 5 |
| 9 | XP kaynağı | Yarık + filoya amiral eşliği | 5, 13 |
| 10 | Seviye tavanı | `min(20, Komuta Merkezi seviyesi)`; tavanda XP **durur** | 5 |
| 11 | Ölümde XP | Ölünce sortie XP'sinin %40'ı, çıkınca %100'ü yazılır | 5 |
| 12 | Yarık Özü | Var; yalnız gemiye harcanır, galaksiye taşınmaz | 7.3 |
| 13 | Tamir | 60 dk bedava, ya da kaynakla kısalır ama **anında olmaz** | 7.1 |
| 14 | Tempo | Her sortie sonrası **ikmal süresi** (başarılı çıkışta da) | 7.1 |
| 15 | Harita | Yatay alan ×4 (yarıçap 5200 m), dikey ×2 (±1300 m) | 9 |
| 16 | Oda | Tek ortak Yarık (tüm galaksiler), **bot yok** | 9 |
| 17 | Çıkışlar | Sabit 3 + geçici 2 + acil sıçrama | 10 |
| 18 | Takım boyu | Klan kapasitesine eşit (bugün 5) | 12 |
| 19 | Takım ganimeti | Çıkarılan her şey havuza girer; maç bitince oynayan üye sayısına eşit bölünür | 12 |
| 20 | Ölen takım üyesi | Takımı izler, aynı maça dönemez, payını alır | 12 |
| 21 | Kargo aktarımı | Yok (şimdilik) | 12 |
| 22 | Yalnız oyuncu | Ek denge kuralı yok | 12 |
| 23 | Amiral | Filo görevlerinin **hepsine** eşlik eder. Akıncı +hasar · Muhafız +dayanıklılık · Kılavuz +hız/−yakıt | 13 |
| 24 | Öncelik | Premium görüntü + akıcı performans + hatasız deneyim, her fazın kapısı | 0.1 |
| 25 | Sayılar v1 | İhtiyatlı: tam ambar 0,2–0,6 başkent saati; günlük aktarım tavanı 2 saat; testten sonra yalnız yukarı açılır | 7.4 |

---

## 2. Mevcut durum — ölçülen gerçekler (2026-10-21)

| Konu | Gerçek | Kaynak |
|---|---|---|
| Sezon | 30 gün | prod `seasons` |
| Komuta Merkezi 9'a varış | en erken ~3,9 gün; o seviyedekilerin medyanı ~9 gün | prod, 7 günde aktif 180 oyuncu |
| Core ≥ 9 oyuncu | 64 / 180 (%36) | prod |
| Core 9+ oyuncunun döteryumu | medyan 1033; Döteryum Tesisi medyan L9 | prod |
| Döteryum üretimi | L9 ≈ 31/saat · L12 ≈ 44/saat · L15 ≈ 68/saat | `deuteriumRate` |
| Eşzamanlı oyuncu | saatte ~5–20 farklı oyuncu görülüyor | prod `last_seen_at` |
| Bugünkü alan | yarıçap 2600 m, ±650 m, tam gazda çaprazlama ~43 sn | `tuning.ts` |
| Bugünkü oda | 8 insan + 3 bot | `server.ts` |

**Sonuç:**
- Gemi sezonun ~20–26 gününde aktiftir.
- Eşzamanlı pilot sayısı düşük olacak (tek haneli–onlu). Boş oda en büyük risktir (§18).

---

## 3. Gemi edinimi ve sınıflar

- **KARAR:** Komuta Merkezi **9**'da komutan bir gemi seçer.
  - Core 9 aynı zamanda ilk koloni eşiği (`colonyCoreThresholds`).
  - Gemi seviye 1 doğar; tavanı o an 9'dur (§5).
- **KARAR — sınıflar:**

| Sınıf | Sahibin tanımı | Rol (ÖNERİ) |
|---|---|---|
| **Akıncı** | seri, kıvrak, yüksek hasar | **avcı:** küçük ambar, kazancı vurmaktan |
| **Muhafız** | hantal, yüksek savunma | **kasa ve kalkan:** büyük ambar, takımın taşıyıcısı |
| **Kılavuz** | ortalama | **göz ve sağlık:** radar, onarım |

  - Her biri tek başına oynanabilir. Akıncı avlanır, Muhafız inatla toplar, Kılavuz görünmeden
    toplar.
  - Takımda birbirine ihtiyaç duyarlar. Takım ganimeti eşit bölündüğü için (§12) Muhafız'ın
    ambarı takımın kasası olur, Akıncı'nın avı herkesin olur.
- **KARAR — sınıf değişimi:**
  - Sınıf sezon boyunca kilitlidir. Seçimden sonraki ilk 24 saatte bir kez ücretsiz değiştirilir.
  - Yeni sezonda yeniden seçilir.
  - ÖNERİ: değişimde seviye ve XP korunur, yetenek puanları iade edilir.
- **KARAR — Simülatör:** Core 9'dan önce tek kişilik deneme uçuşu.
  - Hedef dronlara ve botlara karşı uçulur. Ganimet ve XP yoktur; üç sınıf da denenebilir.
  - Neden: merak ve hedef (AMBITION). Seçim bilerek yapılır.
  - Bugünkü sandbox bunun temelidir.

### 3.1 Ortak özellikler — KARAR (seviye 1, sahip 2026-10-23, [KG-X27](02-kararlar.md#kg-x27))

Sahibin listesi: **isabet, hız, yakıt deposu, ambar, defans, hasar.**
- **Atış hızı** sınıfın sabit silah kimliğidir; yükseltilmez. Ekran sade kalır. Mermi hızı ve
  menzil (1200 m/s, 900 m) herkeste aynı.
- **Dönüş hızı** sınıf kimliğidir; "kıvrak" bununla hissedilir.
- Planın v1 oranları bugünkü gemiye ölçeklendi: bugünkü gemi = Kılavuz, en hızlı Akıncı KG-X25
  tavanında (80 / 160 m/s). Değerler `packages/rules/src/arena/classes.ts` içinde.

| | Akıncı | Kılavuz | Muhafız |
|---|---|---|---|
| Hız / turbo (m/s) | 80 / 160 | 72 / 144 | 60 / 120 |
| Dönüş (°/sn) | 82 | 72 | 58 |
| Defans (gövde) | 510 | 600 | 900 (sahip 2026-10-27: +%50; 340/400/600 idi) |
| Hasar × atış/sn | 13 × 9 (117/sn) | 10 × 8 (80/sn) | 18 × 5,5 (99/sn) |
| İsabet (saçılma) | 1,3° | 1,5° | 1,8° |
| Yakıt deposu | 220 | 250 | 280 |
| Ambar | 70 | 100 | 160 |
| Şarjör (60 sn ateş) | 540 | 480 | 330 |

**TTK kontrolü:** %60 isabet, eşit seviye (test: `classes.test.ts`).

| Saldıran → hedef | Akıncı | Kılavuz | Muhafız |
|---|---|---|---|
| Akıncı | 4,8 sn | 5,7 sn | 8,5 sn |
| Kılavuz | 7,1 sn | 8,3 sn | 12,5 sn |
| Muhafız | 5,7 sn | 6,7 sn | 10,1 sn |

- Akıncı aynası bilinçli olarak hızlı: cam top.
- Oyun testinde sert gelirse Akıncı gövdesi 380'e çıkar (ayna 5,4 sn).

### 3.2 Seviyeyle büyüme — ÖNERİ

Her özellik sınıfa göre farklı oranda büyür (sahibin isteği):

| Özellik | Akıncı | Kılavuz | Muhafız |
|---|---|---|---|
| Hasar | **yüksek** (+2,5%/sv) | orta (+1,5%) | orta (+1,5%) |
| İsabet (koni daralması) | **yüksek** | orta | düşük |
| Hız | **yüksek** (+1%/sv) | orta (+0,7%) | düşük (+0,4%) |
| Defans | düşük (+1,5%) | orta (+2%) | **yüksek** (+3%) |
| Yakıt deposu | orta | **yüksek** | orta |
| Ambar | düşük | orta | **yüksek** |

- Seviye 20'de birincil özellik **+%50–60**, ikincil **+%30–40**, üçüncül **+%15–20**.
- **Güç farkı sınırı** (08 §3): en üst seviye Akıncı, başlangıç Muhafızını %60 isabetle
  3,5 sn'den kısa sürede öldüremez.
  - Hesap: 600 / (108 × 1,5 × 0,6) ≈ 6,2 sn ✓

---

## 4. Yetenekler — KARAR: imza + taktik düzeni; değerler ÖNERİ

Sağ başparmak bugünkü gibi 4 düğme taşır: **ATEŞ + Turbo + A + B.**

| Yuva | İçerik | Seçim |
|---|---|---|
| Turbo | herkes | sabit (uçuşun çekirdeği) |
| A — Sınıf imzası | Akıncı: **Güdümlü füze** · Muhafız: **Soğurucu kalkan** · Kılavuz: **Onarım** | sınıfa sabit |
| B — Taktik | **Duman · Görünmezlik · İllüzyon · Radar tarama** | hangarda, sortie öncesi |

- Neden: aynı sınıfın farklı oyun tarzları olur (görünmez Akıncı ≠ illüzyoncu Akıncı). Yeni
  sistem eklemeden derinlik gelir.
- **Dost (KG-X29):** hedefleme mekaniği hazır. Klanlar gelene dek (§12) arenada dost yoktur; kalkan ve
  onarım yalnız kendine gider.
- **Sınıf yakınlığı:** sınıfına yakın B yeteneği +1 rütbeyle başlar. **Y6c ile uygulandı** (KG-X34): rütbeler
  seviye ve ayrı yetenek puanlarıyla tanımlanır (sahip, 2026-10-24).
  - Akıncı → İllüzyon
  - Muhafız → Duman
  - Kılavuz → Radar

| Yetenek | Kural (rütbe 1) | Karşı oyun |
|---|---|---|
| **Güdümlü füze** | Hedef **nişan çemberinde** (§11) 1,0 sn kalınca kilit. Füze 260 m/s, dönüş 60°/sn, hasar 80. Bekleme 14 sn. | Kurban "KİLİT" uyarısı ve yön alır. Duman veya görünmezlik kilidi kırar. Kaya füzeyi keser. Turbo + sert dönüş kaçırır. |
| **Soğurucu kalkan** | **KARAR (sahip, 2026-10-23):** hedefli. A'ya bas, sonra dosta dokun; A'ya çift dokunuş kendine. 80 hasar emer, 20 sn sürer. Kalkanı kıran vuruşun artanı gövdeye geçmez. Bekleme 22 sn. | Kalkan görünür ve süresi bellidir. Odak ateşi kırar. |
| **Onarım** | **KARAR (sahip, 2026-10-23):** kalkan gibi hedefli. 4 sn'de 120 gövde, kendine de 120. Bekleme 20 sn. | Hasar alırken %50 etkili; savaşlar sonsuz uzamaz. |
| **Duman** | Bugünkü kural (04 §5). | — |
| **Görünmezlik** | Bugünkü kural: 4 sn, ateşte bozulur, hasar alır (KG-K4). | — |
| **İllüzyon** | **KARAR:** kopya geminin **tam içinde** doğar. Pilotun yön girdisinin **tam tersini aynı oranda** yapar: sağ↔sol **ve** yukarı↔aşağı. Hız birebir aynıdır: turbo ve fren de kopyalanır. İkisi aynı yerden iki farklı yöne ayrılır. ÖNERİ: 6 sn sürer, bekleme 20 sn. | Kopya hasar vermez. Radar gerçeği gösterir. |
| **Radar tarama** | Tüm haritaya sinyal. Düşmanlar 3 sn boyunca haritada ve dünyada işaretlenir. Görünmezler hariç, **kayaya inip saklananlar dahil** (KARAR). Bekleme 30 sn. | Taranan "TARANDIN" uyarısı ve yön alır; saklanan yer değiştirir. Tarama, tarayanın yerini de ele verir. |

**İllüzyon ayrıntısı (ÖNERİ):**
- Kopya kendi fiziğiyle uçmaz (sahip 2026-10-24): her tick pilotun, atıldığı andaki doğrultuya göre
  tam aynasına konur. Kayaya ya da alan sınırına giren kopya hologram gibi dağılır.
- Ateş edersen kopya da kendi burnu yönünde sahte iz atar.
- Düşman ekranında birebir aynıdır: isim, kostüm, motor izi, ses.
- Mermi ona da çarpar ve normal kıvılcım görünür. Sahte gövdesi gerçek gövdenin %25'idir; bitince
  hologram kırılmasıyla söner.
- Güdümlü füze kopyaya kilitlenebilir: boşa giden füze.
- Dostlar kopyayı soluk bir "kopya" işaretiyle görür; kendi takımını şaşırtmaz.

**Rütbeler (1–5):** süre, güç ve beklemede küçük adımlar. Puanlar seviyelerden gelir (§5).

**Bilgi oyunu:** radar, illüzyon, duman ve görünmezlik, Astera'nın "bilgi oyunun kendisidir"
ilkesinin Yarık'taki karşılığıdır. Görmek bir karardır, görünmek bir risktir.

---

## 5. Seviye ve gelişim

- **Seviye 1–20, sezonluk** (KG-K3).
- **KARAR — tavan:** `min(20, Komuta Merkezi seviyesi)`.
  - Clash of Clans kahraman modeli: gezegenini geliştirmeyenin gemisi de büyümez.
  - Tavandaki gemi **XP kazanmaz** (sahip: "şimdilik; sonra değişebilir").
  - Arayüz bunu açıkça söyler: "Tavan: CM 12 — XP durdu. Komuta Merkezi'ni 13 yap, gemin
    büyümeye devam etsin."
- **KARAR — XP kaynakları:** Yarık ve amiral eşliği (§13).
  - Yarık XP'si (ÖNERİ):
    - **çıkarılan** yükün değeri (ana kaynak)
    - öldürme ve asist
    - verilen onarım, emilen hasar
    - "senin taramanla bulunan düşmanın öldürülmesi"
  - Amiral XP'sinin saatlik getirisi Yarık'tan düşük tutulur.
- **KARAR — XP de çıkarılır:**
  - Sortie XP'si gemide taşınır.
  - Ölürsen **%40**'ı yazılır, çıkarsan **%100**'ü.
  - Neden: extraction türünün kalbi. Risk ilerlemede de var, ama ölüm sıfır değil.
- **KARAR — seviye atlama:** XP + kaynak.
  - XP çubuğu dolunca "Yükselt" açılır.
  - Ödeme alaşım + kristal. Seviye 10'dan sonra Yarık Özü de istenir (§7.3).
  - Bekleme süresi yok.
  - Neden: XP şartı, galaksi servetinin doğrudan gemi gücüne çevrilmesini engeller. Kaynak şartı
    iki oyunu bağlar.
- **Seviye başına (ÖNERİ):** özellik büyümesi (§3.2) + **1 yetenek puanı**.
  - İmza, Turbo ve dört taktik ayrı gelişir (sahip, 2026-10-24, KG-X34).
  - Her satın alma bir puan; 19 puan bütün yetenekleri tavana taşımaz. Sınıf yakınlığı bedavadır.
- **Hedef hız:** günde 2–3 sortie oynayan biri sezonda ~12–15'e çıkar, çok oynayan 20'ye.
  v1 eğrisi ve kontrol hesabı §7.4'te (`50·sv` XP).

---

## 6. Modülerlik, görsel değişim, kostüm (sahibin 2–4. soruları)

**Modüler parçalar — ÖNERİ:**
- **Görselde evet:** gövde, kanat, motor ve silah yuvaları ayrı parçalardır.
- **Oynanışta hayır:** ganimetle takılan stat parçası yok. Neden:
  - mobilde envanter ve karşılaştırma ekranı demek; etkileşim maliyeti yüksek
  - denge ve kartopu riski
  - parça × sınıf × seviye kadar varlık maliyeti
  - oynanış seçimi zaten B yuvası ve yetenek puanlarında

**Seviyeyle görsel değişim — ÖNERİ:** 5 kademe.

| Kademe | Seviye | Değişen |
|---|---|---|
| 1 | 1 | taban |
| 2 | 5 | kanat ucu ve zırh plakaları |
| 3 | 10 | namlu uzar; motor sayısı ve alev |
| 4 | 15 | ek gövde parçası, ışık şeritleri |
| 5 | 20 | tam "amiral" silueti, imza parıltısı |

- Neden — **sahiplik ve hatıra:** "gemim büyüdü".
- Neden — **bilgi:** düşman siluetten seviyeyi okur (galaksideki D123 ile aynı ilke). Yüksek
  kademe gemiyi görmek bir karar anıdır: kaç mı, savaş mı?
- Kademe, siluet **boyutunu ve vuruş gövdesini değiştirmez**.

**Kostüm satışı — ÖNERİ:** yalnız kozmetik, güç asla.

| Kategori | Örnek | Not |
|---|---|---|
| Gövde boyası / desen | karbon, altın, nebula, klan renkleri | en büyük satış |
| Amblem / çıkartma | klan arması kanatta | klan kimliği |
| Motor alevi ve iz rengi | mor, beyaz-sıcak, alev çifti | ucuz üretim, çok görünür |
| Mermi izi rengi | | düşman ateşi **okunur** kalmalı; palet sınırlı |
| Patlama / ölüm efekti | | |
| Giriş ve çıkış (sıçrama) efekti | | |
| Kill banner, isim plakası çerçevesi | | |
| Hangar sahnesi ve poz | | |
| Sezon kademe kostümü | sezon ödülü | |

**Yasaklar:**
- siluet büyüten veya küçülten kostüm
- görünürlüğü düşüren kostüm (siyah "gizlilik" boyası parayla avantaj olur)
- dumanın opaklığını değiştiren kostüm

Var olan `cosmeticCatalog` ve ödeme hattı (Polar/Shopier) kullanılır.

---

## 7. Ekonomi

### 7.1 Yakıt, mühimmat, tamir, ikmal

- ~~KARAR (KG-K11): tek ortak döteryum deposu.~~ **KARAR (KG-K29, 2026-10-21):** yakıt ve mühimmat
  ayrı; şarjör uçuşa dolu girer (v1 480), uçuşta dolmaz. Şarjör kapasitesi de sınıf/seviye
  özelliği olacak (§3, değerler ÖNERİ bekliyor).
- **ÖNERİ — doldurma:** sortie öncesi hangarda depo, başkentin döteryumuyla doldurulur.
  - Kullanılmayan yakıt gemide kalır (S34).
  - Döteryum galakside de değerlidir (değer ağırlığı 32). Her giriş gerçek bir bedel; "girmeye
    değer mi?" kararı doğar.
- **Fiyat — Y6a (KG-X31):** tam depo 30/40/50 D, tam şarjör 15/22/30 D; yalnız eksik ödenir. Aşağıdaki v1 fiyatı tarihçedir.
- **Kalkış planı (2026-10-27):** depo çeyrek adımlarla, şarjör boştan; kalkış plana kadar tamamlar (bkz. 02-kararlar.md).
- ~~**Fiyat v1 (§7.4):** 1 depo birimi = **0,05 döteryum**.~~ Eski öneri (0,5 D) bir sortie'yi
  çoğu ambardan pahalı yapıyordu: döteryum galakside 32 değer, alaşım 1.

| Sınıf | Tam depo | Döteryum | Tesis L6'da (medyan) üretim karşılığı |
|---|---|---|---|
| Akıncı | 90 birim | 4,5 D | ~14 dk |
| Kılavuz | 110 birim | 5,5 D | ~17 dk |
| Muhafız | 120 birim | 6 D | ~19 dk |

  - Yakıt küçük, sürekli bir giderdir. Girişin asıl bedeli kargo, tamir süresi ve XP kaybıdır.
- **KARAR — tamir** (KG-A9'un cevabı):
  - Yok edilen gemi **60 dk'da bedava** onarılır.
  - Ya da alaşım+kristal ödenir; onarım kısalır ama **anında olmaz**.
  - Ödemeli onarımın süresi ve bedeli §7.4'te.
- **KARAR — ikmal:** her sortie sonunda gemi bir süre bakımda kalır. Başarılı çıkışta da geçerlidir.
  - v1: **10 dk**. Yok edilmede ayrıca eklenmez, tamirin içindedir.
- **Tempo:** tamir ve ikmal sahibin amacının araçlarıdır ("sabah akşam Yarık'ta olmasın").
  - Arada galaksiye dönme sebebi olurlar.
  - Birkaç yenilgi oyuncuyu günlerce kilitlemez (S59).
  - Sayaç hangarda ve galaksi kabuğunda görünür: "Gemin 7 dk sonra hazır". Hazır olunca
    bildirim gelir (RE-ENGAGEMENT).

### 7.2 Farmlar (sahibin 7. sorusu) — ÖNERİ

**İlke: derine indikçe zenginlik ve tehlike artar.** Extraction türünün en okunur kuralıdır.

| Bölge | Ne var | Yenilenme | Değer |
|---|---|---|---|
| Dış Kuşak | tek parça ve küçük kümeler | 60–90 sn, başka yerde | ×1 |
| Orta Halka | kazılabilir damarlı kayalar (alaşım/kristal/döteryum), yoğun kuşaklar | damar 3–5 dk | ×2 |
| Yarık Kalbi | zengin kristal oluşumları, nadir Öz damarları, **Kalp olayı** | olay 10 dk'da bir, 60 sn önce duyurulur | ×4 |
| Enkaz | ölen geminin ambarının tamamı (S34) | 300 sn kalır | — |

- **Miktar:** 24 pilotluk oda için ~40 küme, ~30 damar, 1 Kalp. Odadaki pilot sayısıyla
  ölçeklenir. Boş odada da Dış Kuşak dolu kalır; tek oyuncu da farm yapabilir.
- **Kalp olayı:** Kalp'te kısa süreli zengin bir patlama. Oyuncuları aynı yere toplar; botsuz
  odada çatışmanın ana kaynağıdır.
- **Galaksiye oran** (08 §6 kuralı): başarılı bir tam ambar, medyan başkentin **~0,2–0,6
  saatlik** üretimi kadardır (§7.4). Eski öneri 1–1,5 saatti; sahip "fazla olmasın" dedi.
  - Ölümde kargo düşer (yakıt korunur, S34). Beklenen getiri galaksiden yüksek değildir; cazibe
    heyecan, XP ve Yarık Özü'dür.

### 7.4 Sayılar v1 — ihtiyatlı (2026-10-21)

> **Y6a ile değişti (2026-10-23, KG-X31):** ambar birimi ve değer hesabı kalktı; ambar ham
> kaynaktır, 1:1 başkente gider (Akıncı 300 · Kılavuz 400 · Muhafız 500, karışım serbest). Tam
> depo 30/40/50 D, tam şarjör 15/22/30 D; yalnız eksik ödenir. Günlük tavan her kaynaktan
> başkentin 4 saatlik üretimidir. Aşağıdaki birim, değer ve 0,05 D fiyatı satırları tarihçedir.

Sahibin ölçütü: "Çok fazla kaynak dağıtmasın, çok az da dağıtmasın; gerekirse az olsun ama fazla
olmasın." Sayılar oyun testinden sonra ancak **yukarı** açılır; aşağı çekmek oyuncudan bir şey
geri almak olur.

**Çapa — prod ölçümü (2026-10-21, Core 9+ başkent, n=109):** medyan Core 13, Rafineri 12,
Çıkarıcı 12, Döteryum Tesisi 6. Saatte 1 416 alaşım, 708 kristal, 19 D. Değer ağırlığıyla
(1 / 2 / 32) **≈ 3 440 değer/saat**. Aşağıda "saat" bu başkentin bir saatlik üretimidir.

| Konu | v1 | Medyan başkente göre |
|---|---|---|
| **Ambar birimi** | 1 birim = 10 değer. Çıkışta: alaşım parçası → 10 A, kristal → 5 C, döteryum → 0,3 D. Bölge çarpanı (×1/×2/×4) parçadaki **birim sayısıdır**; birimin değeri her yerde aynı. Ambar çubuğu böylece dürüst okunur. | — |
| **Tam ambar** | Sv1: Akıncı 600 · Kılavuz 900 · Muhafız 1 500 değer. Sv20 Muhafız ~2 300. | 0,17 · 0,26 · 0,44 saat; tavan ~0,67 |
| **Yakıt** | 0,05 D / birim; tam depo 4,5–6 D | sortie başına ~0,05 saat |
| **Günlük aktarım tavanı** | Yarık'tan başkente günde en çok **kendi başkentinin 2 saatlik üretimi**. Tavanı aşan kargo yatırılmaz. XP ve Öz etkilenmez. Hangar gösterir: "Bugün aktarılabilir: 4 200 / 6 900". | günlük gelire en çok **+%8** |
| **İkmal** | 10 dk | — |
| **Bedava tamir** | 60 dk (KARAR) | — |
| **Ödemeli tamir** | Süre `15 + round(15·(sv−1)/19)` dk: sv1 15 dk, sv20 30 dk. Bedel alaşım `150 + 25·sv`, kristal `50 + 10·sv` (sv10: 400 A + 150 C). | sv10 ≈ 0,2 saat; sv20 ≈ 0,33 saat |
| **Seviye atlama bedeli** | sv → sv+1: alaşım `150·sv`, kristal `75·sv`. sv10'dan sonra Öz da (§7.3). | sv10→11 ≈ 0,9 saat; 1→20 toplam ≈ 16,5 saat |
| **XP eğrisi** | sv → sv+1: **`50·sv` XP**. 1→13: 3 900 XP; 1→20: 9 500 XP. | — |
| **Yarık XP'si** | çıkarılan birim başına 1 · Öz birimi başına 10 · öldürme 40 · asist 15 · her sortie 10. Ölümde toplamın %40'ı. | — |
| **Amiral XP'si** | savaşlı görev 15, kazanılırsa +15; savaşsız görev 5 | Yarık'ın saatlik getirisinin altında |

**Kontrol hesapları:**
- **Ortalama oyuncu** (%50 çıkış, ambar %70 dolu, Kılavuz): sortie başına net **≈ +170 değer
  (~0,05 saat)**. Günde 2–3 sortie: günlük gelire **+%0,5**.
- **İyi oyuncu** (%70 çıkış, %85 dolu, Muhafız): sortie başına **≈ +0,2 saat**.
- **En kötü durum** (sv20 Muhafız, günde 20 sortie): tavana çarpar. Galaksi gelirine **+%8**'den
  fazla eklenemez. Tavan, saha sayıları ne çıkarsa çıksın taşkını sınırlar.
- **Seviye hızı:** ortalama oyuncu sortie başına ~57 XP alır; günde 2,5 sortie ve amiral eşliğiyle
  ~170 XP. Core 9'a ~7. günde varan biri sezon sonunda **sv13** olur. Günde 8 sortie oynayan
  ~19 günde **sv20**. Hedefle (§5) uyumlu.
- **Para akışı:** ortalama oyuncu için Yarık galaksiden **net çeker**. sv13'e kadar seviye bedeli
  ≈ 6,8 saat, Yarık net getirisi ≈ 3 saat. "İki oyunu bağlar" kararıyla uyumlu. İyi oyuncu kendi
  gelişimini öder ve biraz artırır.

**Oyun testinde ölçülecek; yalnız bunlar gerekirse yukarı açılır:** ortalama sortie süresi ve
yakıtı, çıkış oranı, ortalama ambar doluluğu, tavana çarpan oyuncu oranı. Hedef bantlar: net
sortie getirisi 0,03–0,25 saat; tavana çarpan oyuncu ≤ %5. Uzun ekonomi koşuları yalnız sahip
isteyince yapılır (CLAUDE.md).

### 7.3 Yarık Özü — ERTELENDİ, ilk sürüm kabulünden çıkarıldı (24 Ekim)

- Yalnız Yarık'ta bulunan küçük bir kaynak: Kalp olayları ve Kalp'teki nadir damarlar.
- Seviye 10+ yükseltmede ve yetenek rütbe 4–5'te harcanır.
- Neden: galaksinin kaybedilebilir servetini kaybedilemez gemi gücüne emmez (08 §2, ARR). Derine
  inmek için benzersiz bir sebep olur.
- Galaksiye **taşınmaz**, takas edilmez.
- Gemide taşınırken diğer kargo gibi risk altındadır: ölünce saçılır. Takım havuzunda da eşit
  bölünür.

---

## 8. Çarpışma ve vuruş gövdeleri

**Teşhis (kod):**
- Kaya ve yapı çarpıştırıcıları **küre** ve yalnız dikeyde dönen **kutu**dur
  (`collision.ts`, `layout.ts`).
  - Gerçek kaya düzensizdir. Kürenin taştığı yerde gemi **boşlukta çarpar** ("ben vurmadım ki").
  - Kayanın küreden taştığı yerde gemi **modelin içine girer** (saklanma hatası).
- Gemi, 15 m'lik model için **6 m'lik tek küre**dir (`shipHitRadius`). Kanatlar kayaya girer,
  mermi kanattan geçer.

**Çözüm — ÖNERİ:**
1. **Çarpışma gövdesi:** her kaya ve yapı için modelden üretilen sadeleştirilmiş gövde (100–500
   üçgen; içbükey yapılar dışbükey parçalara bölünür).
   - Sunucu ve istemci aynı veriyi kullanır.
   - Küre–üçgen testi yalnız `+ − × ÷ sqrt` ister; tarayıcılar arası determinizm korunur (KG-T11).
   - Geniş faz: mevcut ızgara + parça başına sınır kutusu.
2. **Gemi kapsülü:** sınıf modeline oturan kapsül (Akıncı ~14×3 m, Muhafız ~20×5 m). Mermi de
   aynı kapsüle çarpar.
3. **Tolerans testi (hat kapısı):** görsel yüzey ile çarpışma yüzeyi arasındaki en büyük fark
   ≤ 0,5 m. Fazlası build'de hata verir.
4. **Dev görünümü:** çarpıştırıcı tel kafes anahtarı.
5. **Sıyırma:** hafif açılı temas kayarak geçer, durdurmaz (KG-T35 sekme kuralı sürer).

**Uygulandı (Y2, 2026-10-21) — ayrıntı [KG-T48](02-kararlar.md#kg-t48):**
- Kaya ve kristal: çizilen model ile çarpıştırıcı aynı köşelerden yazılır (11 şekil, fark ≤ 1e-6 m).
  Konum, dönüş ve ölçek ikisinde aynıdır. Tel kafes görüntüsü örtüşmeyi gösterir.
- Gemi: gövde kapsülü + kanat kapsülü. İnen gemi yüzeye kapsülüyle oturur; çizilen gövde en çok
  0,1 m gömülür (ölçüldü).
- Pusula, iniş hedefi, damarlar, kazı ve sıyırma kıvılcımı gerçek yüzeyi kullanır.
- **Gemi kapsülü modele tam oturmuyor (ölçüldü):** oyuncu gemisinde yan gövdeler kapsülden en çok
  1,48 m taşar (köşelerin %7,7'si 0,5 m'den fazla). İki kapsülle 0,7 m altına inilemiyor.
  Gövde + iki yan kapsül 0,46 m'ye indirir. Rakip modeller daha geniştir: yarım kanat açıklığı
  6,6 m'ye, yarım yükseklik 3,7 m'ye çıkar. Tek sınıflı bir kapsül hepsine oturamaz, bu yüzden
  kapsül Y4'te sınıf modeline oturtulur (§17).
- **Y4b ✅ (2026-10-23):** her sınıfın 5 kapsülü kendi modeline oturdu: en çok taşma Akıncı 0,456,
  Muhafız 0,451, Kılavuz 0,457 m (`tools/arena-hulls.mjs check`, yüzey örneklemesi). Kılavuz'un
  kanatları 8,9 m'ye uzanır (KG-X28).
- Bilinçli kalanlar: çizilen gemi dönüşte 54°'ye kadar yatar, kapsül yatmaz. Alaska kayalıkları
  Y3'te gelir (yeniden ağ + bake). Yapılar Y5'e kadar kutu çarpıştırıcıda kalır.

---

## 9. Harita

**KARAR — ölçü:** yatay alan **4 kat**, dikey **2 kat**.
- Yarıçap 2600 → **5200 m**. Yükseklik ±650 → **±1300 m**. Hacim 8 kat.
- Tam gazda (120 m/s) çaprazlama ~87 sn.
- Başlangıç deposu tam gazda ~6 dk. Bir çaprazlama + dönüş + farm sığar; uzak bölgeye gitmek
  yakıt kararıdır.

**KARAR — oda:** tek ortak Yarık (tüm galaksiler), **bot yok**.
- ÖNERİ: tavan 32 pilot; dolarsa ikinci oda açılır (KG-A6).
- Galaksiler arası rekabet: isim etiketinde galaksi kısaltması (EU-1, EU-2…).
- Bugünkü canlı odanın 3 botu Yarık'a geçişte kalkar, Simülatör'e taşınır.

**Yerleşim — ÖNERİ:**

```
                 [K] Kuzey kapısı (tekerlek istasyon)
           Dış Kuşak · seyrek kaya · küçük cevher
        ┌──────────── Orta Halka ────────────┐
   [G]  │ Enkaz Mezarlığı   │ Kristal Kuşağı │  [G]
        │ (halkalı ana gemi,│ (yoğun kaya,   │
        │  dar siper, pusu) │  kazı, kaybol) │
        │        ╲  YARIK KALBİ  ╱           │
        │         (merkez istasyon,          │
        │          zengin, olaylar)          │
        │   Sis Bulutu (görüş 400 m'ye düşer,│
        │   radar ve gizlilik bölgesi)       │
        └────────────────────────────────────┘
   [G] = 6 giriş ağzı dış kenarda · çıkışlar §10
```

- **Rota seçimi = risk kararı:** sektörler arası açık koridorlar hızlı ama açıktadır; kuşak
  rotaları yavaş ve görece güvenlidir.
- **Yön bulma:** her sektörde uzaktan görünen tek bir yer işareti (istasyon, halkalı gemi, dev
  kaya). Oyuncu yine de kuşak içinde kaybolabilir (KG-K23).
- **Dikey katman:** Kalp ve enkaz farklı katlardadır. Kuşaklar dikeyde de yayılır; "yukarıdan
  pusu" ve "alttan sızma" rotaları olur.
- **Performans:** AOI 1600 m sürer. Uzak sektörler yalnız yer işareti LOD'uyla çizilir. Kayalar
  örnek başına kırpılır (KG-T37).

---

## 10. Giriş ve çıkış — ilk sürümde v6 sabit çıkışları; geçici çıkış/acil sıçrama kaldırıldı

**Giriş (ÖNERİ):**
- Dış kenarda **6 giriş ağzı**.
- Rastgele seçilir. Son 60 sn'de kullanılan ve düşman yakın olan ağız elenir.
- Takım birlikte aynı ağızdan girer.
- Doğuş kalkanı 60 sn (S29, KG-K9).

**Çıkış:**

| Tür | Adet | Kural | Neden |
|---|---|---|---|
| Sabit çıkış istasyonu | 3; Orta Halka'nın dışında, girişlerden uzak | tam dur + 3 sn hasarsız (S31) | öngörülebilir; ama bilinir, kamp riski |
| Geçici yarık | 2; rastgele yerde, 3 dk açık, haritada duyurulur | aynı | buluşma ve çatışma anı (Alive, OPPORTUNITY) |
| Acil sıçrama | her yerde | ÖNERİ: 10 sn hareketsiz kanallama; hasar keser; +15 D yakıt | gizli oyuncunun kaçışı, pahalı |

- **Kamp önlemi** (KG-A22): çıkışlar siper içindedir. Çıkış alanı geniştir (120 m) ve içinde
  birden çok durma noktası vardır.

---

## 11. Nişan yardımı

**Teşhis (kod, 2026-10-21):**
1. **Ana neden — gecikme hesaba katılmıyor.**
   - Önleme işareti ve mıknatıs, düşmanın ekranda çizilen konumundan hesaplanıyor
     (`client.ts` `selectFocus`, `assistSteer`, lead HUD).
   - Bu konum `interpDelay` (133 ms) geride. Atışın sunucuya varması da RTT/2 + 100 ms girdi
     tamponu sürüyor.
   - Sonuç: yardım, düşmanın ~0,25–0,3 sn önceki yerine nişan aldırıyor. 120 m/s'de ~30–36 m,
     turboda ~55–65 m geride. Gemi vuruş yarıçapı 6 m → **ıska**.
   - KG-T16 bu ufku tanımlamıştı (`H = interpDelay + RTT + inputBuffer − headStart`) ama kodda
     uygulanmamış.
2. **Yardım yanlış noktaya bakıyor.**
   - Mıknatıs yalnız önleme noktası burnun 9° içindeyse çalışıyor; sunucudaki namlu bükümü ise
     3,5° içindeyse.
   - Oyuncu doğal olarak **gemiye** nişan alır. 300 m'de yandan geçen hedefin önleme noktası
     gemiden ~10° ötededir; yardım hiç devreye girmez.
3. **Turbo + ateş.**
   - Turboda dönüş ×0,6 olur. Mıknatıs dönüş hızının %32'siyle sınırlı olduğu için ~14°/sn'ye
     düşer.
   - Aynı anda gecikme hatası iki katına çıkar. Sahibin gözlemi doğru.

**Yeni tasarım — KARAR (KG-K28, uygulandı 2026-10-21, Y1):**
Sahip: *"Aim assist aktifken geminin yönü düşmanı takip etmeyecek; ortadaki alanın sınırına kadar
crosshair hedefi takip edecek; yönü kullanıcı ayarlamalı, hedefi o alan içinde kullanıcı tutmaya
çalışmalı."*
- **Nişan çemberi:** burnun çevresinde iki yay; Subdivision gibi ama ondan küçük.
  - Yarı açı **8,5°** (ilk 7°, sahip 2026-10-21) → dikey telefonda yarıçap ~68 px. Görünen alan =
    yardım alanı: kural kameranın gözünden çizili çembere bakar, yakında da ([KG-T47](02-kararlar.md#kg-t47)).
  - Renk: boşta soluk · hedef içeride sıcak · ateş basılıyken camgöbeği.
- **Kural:**
  1. Hedefin **gövdesi ya da ◇ önleme işareti** çemberdeyken nişangâh ◇'ye kayar; mermiler de
     oraya gider (sunucu namluyu oraya çevirir, dağılım yine uygulanır).
  2. ◇ çemberin dışındaysa nişangâh **kenarda durur**: "daha önden al" demektir.
  3. İkisi de çıkınca nişangâh merkeze döner. Gemiyi çeviren mıknatıs ve çubuk sürtünmesi yok.
  4. Botlar eski dar namlu (3,5°) ve mıknatısla kalır; sertlikleri değişmedi.
- **Gecikme düzeltmesi:** diğer gemiler `aimHorizon` kadar geriden çizilir (tick farkından ölçülür,
  en çok 0,6 sn). ◇, kayan nişangâh ve kendi mermi izimiz hedefi bu kadar ileri taşır.
- **Ölçüm** (sunucu kuralı + 0,3 sn gecikmeli görüş, ◇'yi çemberde tutan pilot):

| Hedef | 200 m | 300 m | 450 m | 650 m |
|---|---|---|---|---|
| Eski mıknatıs, düz geçen | %0 | %5 | %5 | — |
| Çember, düz geçen | %85 | %75 | %45 | %20 |
| Çember, hafif zikzak | %85 | %65 | %40 | %25 |
| Çember, sert zikzak (0,45 sn) | %55 | %40 | %35 | %10 |
| Çember, sert uzun dönüş | %45 | %25 | %15 | %0 |

  Turboda (520 m'den yaklaşırken) %55. Kaçmayan vurulur, iyi kaçan yaşar. TTK (bugünkü tek sınıf,
  400 gövde, 80 hasar/sn): kaçmayana ~6–7 sn, sert kaçana ~12 sn.
- **Ek düzeltme:** ◇ işareti CSS'teki `rotate` yüzünden hep yanlış yere, çoğu zaman ekran dışına
  çiziliyordu; düzeldi.
- **Güdümlü füze kilidi** de aynı çemberi kullanır: tek kural, tek görsel.
- **Gemi kapsülü** (§8) vuruşu modelle eşler: kanada isabet eden mermi sayılır.

---

## 12. Klan ile birlikte giriş

- **Uygulandı — lobi (Y7, KG-X36):** klan sayfasında **"Takım kur"**.
  - Lider açar, üyeler katılır. **Uçuşa hazırlan** oyunu yükler; ardından herkes **Hazırım**
    der, lider **Birlikte kalk**'a basar. Hazır olma yükleme bitmeden açılamaz.
  - Lobide her üyenin sınıfı, seviyesi, yakıtı ve "gemi hazır mı" durumu görünür. İkmalde veya
    tamirde olan üye Hazır diyemez; kalan süresi yazar.
- **KARAR — takım boyu = klan kapasitesi.**
  - Bugün 5. Kapasite 10 olursa takım 10, 3 olursa takım 3.
  - Kod sabit bir sayı yazmaz; klan kapasitesini okur.
- **Uygulandı — dostluk** (KG-A7'nin cevabı, Y7):
  - Klan üyeleri dosttur; dost ateşi kapalıdır (füze ve çarpışma dahil).
  - Dostlar ekranda (isim + gövde çubuğu) ve haritada görünür.
  - Onarım ve kalkan yalnız dosta işler.
  - Takımla girmeyen ama aynı odada olan klan üyesi de dosttur.
- **KARAR — kargo aktarımı yok** ("şimdilik bu işe girmeyelim").
- **KARAR — takım ganimeti eşit bölünür:**
  - Takım üyelerinin **çıkışla kaçırdığı** her şey ortak havuza girer (Yarık Özü dahil).
  - Takımın **bütün üyelerinin** sortie'si bitince maç biter: çıkış, yok edilme, yakıt bitmesi
    veya kopma.
  - Havuz, o maçta Yarık'a giren üye sayısına **eşit** bölünür; ölen üye de payını alır.
  - Her üye kendi payını talep eder (claim); pay başkentine yatırılır.
  - Ölen üyenin taşıdığı yük havuza girmez; Yarık'a saçılmıştır (S34).
  - **KARAR (sahip, 2026-10-24):** bölünemeyen artık en yüksek değerli ganimeti çıkaran
    üyeye gider. Eşitlikte sabit oyuncu kimliği sırası kullanılır. XP kişiseldir, bölünmez.
- **KARAR — ölen üye:** takım arkadaşlarının kamerasından izler (seyirci). Aynı maça yeniden
  giremez, maç bitince payını alır.
- **KARAR — yalnız oyuncuya ek kural yok.** Ölen düşmanın ambarı zaten herkese düşer.

---

## 13. Komutan gemisi galakside — amiral

**Sahibin amacı:** oyuncu Yarık'a gömülüp ana gezegenini boşlamamalı; iki oyun arasında bağ
olmalı.

**KARAR:**
- Gemi XP'yi **hem Yarık'tan hem filoya amiral olarak eşlik ederek** kazanır.
- Amiral **bütün filo görevlerine** eşlik edebilir: oyuncu baskını ve savunması, korsan,
  monument.
- Bonus sınıfa göredir:

| Sınıf | Filoya katkı (v1, ihtiyatlı; sv1 → sv20 doğrusal) |
|---|---|
| Akıncı | +filo hasarı: +%2 → +%5 |
| Muhafız | +filo dayanıklılığı, daha az kayıp: +%2 → +%5 |
| Kılavuz | yol süresi −%3 → −%6, yakıt −%5 → −%10 |

  - Neden düşük: sayaç döngüsünün çarpanları bunun katlarıdır. Amiral bir savaşı kaydırır, kararı
    vermez. Önceki öneri (+%4 → +%8, −%8 yol) testten sonra açılabilecek tavandır.

  - Kılavuz için yalnız istihbarat sahibe dezavantajlı geldi. Hız ise savunanın radar uyarı
    süresini kısaltır; sürpriz baskını ve uzak hedefi ödüllendirir.

**ÖNERİ — kurallar:**
- **Görevdeki gemi Yarık'a giremez.** Uçuş süresince kilitlidir. "Gemimi baskına mı
  götüreyim, Yarık'a mı saklayayım?" kararı doğar.
- **Hasar alır, yok olmaz.** Savaş sonucuna göre gövde hasarı alır. Ağır hasarlı gemi tamir
  edilmeden Yarık'a giremez (§7.1).
- **XP:** savaşın büyüklüğü ve sonucuna göre; saatlik getirisi Yarık'tan düşük tutulur.
- Galaksi savaş kuralı değiştiği için **yeni sezonun ruleset kapısıyla** gelir (emsal
  `shipDamageRulesetVersion`: "sezonla gelir, sezon içinde asla"). Bonus oranları sayaç
  döngüsünü ezmeyecek ölçüde kural testleriyle sınanır.

**Diğer bağlar:**
- yakıt döteryumdan
- yükseltme alaşım ve kristalle
- seviye tavanı Komuta Merkezi'nde
- gemi galaksi sahnesinde başkentin yanında park hâlinde görünür (KG-A20)

---

## 14. Varlıklar (`~/Downloads/commander-ship-assets`, 715 MB)

Önizlemeler üç açıdan yazılımla render edildi:
`/tmp/claude-1000/-home-yildirim-Desktop-Coding-MyProjects-blindspace/be288c64-18da-405d-83f4-360e7f1eb85a/scratchpad/assets/out/`
(geçici).

| Dosya | Ne | Üçgen / doku | Lisans | Kullanım (ÖNERİ) |
|---|---|---|---|---|
| `space_fighter.glb` | ince, ok başlı kırmızı-siyah avcı | 17,7 bin · 7×1K | CC-BY-4.0 (Comrade1280) | **Akıncı** ✅ (KG-T49) |
| `spaceship_concept.glb` | koyu, iki tank motorlu ağır gövde | 208 bin · doku yok | CC-BY-4.0 (marum3s) | **Muhafız** ✅ 24 bine indirildi, detay haritalara pişirildi (KG-T49) |
| `decepticon_fighter.glb` | ağır, çok taretli savaş gemisi | 49 bin · 1K | CC-BY-4.0, **Transformers hayran işi** | **Muhafız** siluet referansı. Marka riski; yayına girmez. |
| `SpaceFighter.fbx` | delta kanatlı askerî avcı, beyaz-gri, pas izli | 18,5 bin · 4K PBR | belirsiz | **Kılavuz** adayı. FBX→GLB, 4K→1K. |
| `starix.glb` | koyu, jet biçimli, camgöbeği ışıklı | 100 bin | Fab, belirsiz | Kılavuz alternatifi; ~20 bine düşür. |
| `spaceship23` (rar, 8K) | mavi-gri, mavi ışıklı detaylı gövde | ? · 6×8K | belirsiz | Kaliteli. RAR5 açılamadı (`unrar` yok); 8K→2K. |
| `spaceship.glb` | turuncu kanatlı, açık gri destek gemisi (2026-10-21 indirmesi; eski halkalı gemi dosyası bunun altında kaldı) | 22,6 bin · 4 doku | CC-BY-4.0 (JazOone) | **Kılavuz** ✅ (KG-T49) |
| `sci_fi_space_station.glb` | ISS benzeri, dev halka + güneş panelleri | 2,1 M · 49 malzeme · 20×2K | Fab | **Yarık Kalbi** merkez istasyonu; birleştir, ≤ 100 bin, atlas. |
| `sci-fi-space-station-2` (FBX) | "2001" tarzı tekerlek istasyon + kule | 179 bin | belirsiz | **Kuzey kapısı** / çıkış istasyonu. |
| `aditya_l1.fbx` | gerçek ISRO güneş uydusu | 1,7 M | belirsiz | Sis Bulutu'nda röle uydusu süsü; ≤ 15 bin. |
| `spaceengine.glb` | tek roket motoru + zemin düzlemi | 115 bin | CGTrader | İstasyon iticisi süsü; düşük öncelik. |
| `military_trenches_*`, `nordic_beach_rock_*` | fotogrametri kayalar (Megascans) | 1,2–2,9 bin · 1–2K | Fab Standart | **Asteroit tabanı — çok iyi.** Uzay tonuna boyanmalı. |
| `alaskan_cliff_rock_1/4` | dev, yüksek detay kaya taraması | 2 M · 2K/4K | Fab Standart | **Dev kaya yer işareti**; 5–8 bine düşür, detayı normal haritaya pişir. |

**Notlar:**
- `..._mid` uzantısız dosya ve `... (1).glb` birer **kopya**.
- **Lisans:**
  - CC-BY modeller ticari kullanılabilir ama isim + kaynak bağlantısı ister: oyun içi "Emeği
    geçenler" + `CREDITS.md`.
  - Fab Standart Lisans, edinilen içeriği motor fark etmeksizin kullanmaya izin veriyor. Her
    öğenin Fab sayfası ayrıca kontrol edilir.
  - Kaynağı "belirsiz" olan herkese açık yayına girmez.
- **Hepsi geçici** (KG-K6). Asıl yatırım hattın kendisi: kod mantıksal kimliğe bağlıdır
  (KG-T26); model değişince oyun değişmez.

### 14.1 Optimizasyon hattı — ÖNERİ

1. FBX → GLB.
2. `gltf-transform`: dedup, weld, prune; aynı malzemeli parçaları birleştir (istasyon: 424 parça
   → birkaç).
3. meshoptimizer ile LOD0/LOD1/LOD2.
4. **Dokular KTX2'ye (Basis):** albedo ETC1S, normal UASTC.
   - **En önemli adım.** KTX2 dokular GPU'da sıkıştırılmış kalır.
   - Bugün webp dokular GPU'da açılıp tam RGBA oluyor; iPhone çökmesinin kökü bu. KTX2 ile doku
     belleği ~4–6 kat düşer.
5. Geometri sıkıştırma: `EXT_meshopt_compression`. Three.js'te `MeshoptDecoder` ve `KTX2Loader`
   hazır.
6. Çarpışma gövdesi LOD2'den üretilir (§8).
7. Kaya renklendirme shader'da: desatüre + koyulaştır + ton; cevher damarları kendinden ışıklı.

**Telefon bütçeleri:**

| Varlık | LOD0 | LOD1 | LOD2 | Doku |
|---|---|---|---|---|
| Oyuncu gemisi | ≤ 25 bin | 8 bin | 2 bin | 1K KTX2 (masaüstü 2K) |
| Yer işareti / istasyon | ≤ 100 bin | 30 bin | 8 bin | atlas 2K |
| Kaya | ≤ 3 bin | 1 bin | 300 | aile başına 1K set |

- iOS'ta toplam GPU doku belleği ≤ 120 MB.

---

## 15. Ekranlar — dört soru (CLAUDE.md)

Her yüzey, oyuncuya kararını verdirecek bilgiyi **kullanıldığı yerde** gösterir. Kural bir dokunuş
derinde durur.

| Ekran | Göstermesi gereken | Karar |
|---|---|---|
| **Sınıf seçimi** (CM 9) | üç sınıfın silueti; 6 özellik çubuğu; imza yeteneği; tek cümle rol ("avcı / kasa / göz"); "24 saat içinde bir kez değiştirebilirsin" | hangi oyun tarzı |
| **Hangar** | seviye + tavan (CM); XP çubuğu ve tavanda "XP durdu — CM'yi yükselt"; her özellikte mevcut → sonraki değer + maliyet; B yuvası seçimi ve her seçeneğin karşı oyunu; depo doldurma (D bedeli + kaç dk uçuş); tamir/ikmal sayacı | geliştir mi, gir mi, hangi taktik |
| **Giriş** | "Yarık'ta şu an N pilot"; yakıt; tahmini uçuş süresi | girmeye değer mi |
| **Yarık HUD** | nişan çemberi; kilit / "KİLİT" / "TARANDIN" uyarıları ve yönleri; dost işaretleri; ambar doluluğu; en yakın çıkış ve geçici yarıklar; Kalp olayı sayacı | savaş, kaç, saklan, çık |
| **Takım lobisi** | üyelerin sınıfı, seviyesi, yakıtı, hazır/ikmal durumu | kiminle, ne zaman |
| **Sonuç** | çıkarılan yük; takım havuzu ve senin payın; XP (%40 / %100 ve nedeni); tavan uyarısı; tamir/ikmal süresi; "Ne oldu?" özeti (kim vurdu, nereden) | sonraki sortie |
| **Simülatör** | aynı HUD + kısa ipuçları; "CM 9'da bu gemi senin" | hangi sınıf |

Tasarım dili ui-v2 ve "compact premium": küçük, sıkı, okunur. Bilgi önem sırasına göre dizilir
(S57); durumlar yalnız renkle anlatılmaz. HUD maketleri önce Codex ile çizilip sahibe gösterilir.

---

## 16. Uç durumlar (uygulamadan önce test listesine dönüşür)

Aşağıdaki cevaplar, ayrıca KARAR yazmıyorsa ÖNERİ'dir.

**Takım ganimeti**
- Üye maç ortasında koparsa: KG-K5 kuralı (30 sn); dönmezse sortie'si biter, payını yine alır.
- Üye maç sürerken klandan ayrılır veya atılırsa: o maçın üyesi olarak kalır, payı korunur.
  Yeni maçlara giremez.
- Maç bitmeden sezon biterse: KG-A16 akışı. Havuzda çıkarılmış ama dağıtılmamış pay sezon
  donmadan önce yatırılır; dağıtım beklenmez.
- Deploy/çökme sırasında maç: KG-A15 kuralı. Çıkarılmış havuz kalıcıdır (DB), dağıtım sunucu
  dönünce tamamlanır.
- Pay talep edilmezse: **KARAR (sahip, 2026-10-24)**, 7 gün sonra otomatik yatırılır.
- Tek kişilik "takım": yalnız oyuncu gibi davranır.
- Havuz bölünürken başkent deposu doluysa: galaksinin mevcut depo kuralı neyse o uygulanır;
  taşan miktar varsa raporda gösterilir.

**Seviye ve XP**
- Sortie ortasında tavana varılırsa: tavanı aşan XP yazılmaz. Sonuç ekranı bunu açıkça söyler.
- Sınıf değişimi (24 saat içinde): seviye ve XP korunur, yetenek puanları iade edilir.
- CM yükselince gemi kendiliğinden yükselmez; tavan açılır, XP yeniden akar.

**Yetenekler**
- İllüzyon kopyası alan sınırına veya kayaya çarparsa, gerçek gemi gibi sekme ve sınır kuralı.
- Görünmezken İllüzyon: kopya görünür doğar (görünmezlik yalnız gerçek gemidedir).
- Radar taraması görünmezi göstermez; görünmezlik bitince işaret de yoktur.
- Füze hedefi duman/görünmezlikle kaybolursa, son yöne düz uçar ve ömrü bitince söner.
- Dost ateşi kapalı: dost füze, dost mermi, dost çarpışma hasar vermez.

**Tamir ve ikmal**
- Amiral görevindeki gemi Yarık'a giremez; Yarık'taki gemi filoya eşlik edemez.
- Tamir ve ikmal için yalnız bitiş anı saklanır; durum sunucu saatiyle okunurken hesaplanır.
  Zamanlanmış iş gerekmez, sunucu yeniden başlasa da süre kaymaz.

---

## 17. Uygulama sırası ve kabul ölçütleri

Her faz TDD ile yapılır (CLAUDE.md). §0.1'in üç kapısından (görüntü, akıcılık, hatasızlık) geçer
ve sahibin oynayıp onayıyla kapanır. Tablodaki ölçütler bu kapılara eklenir; sayılar ÖNERİ'dir.

| Faz | İş | Kabul ölçütü |
|---|---|---|
| **Y1** ✅ | Nişan düzeltmesi + nişan çemberi (§11) | Ölçüldü: 300 m'de düz %75, sert zikzak %40, turbo %55; çember dışında yardım 0; yön oyuncuda. Sahip oynayıp onaylayacak. |
| **Y2** ✅ | Çarpışma gövdeleri + gemi kapsülü (§8) | Kaya ve kristalde çizilen = çarpılan (≤ 1e-6 m, katalog testi). Yüzeye 1 m kala çarpma yok, temas durdurur (test). Tick ort. ~0,2 ms, p99 1–2 ms (VPS, 654 mesh kaya). Gemi kapsülü uyumu Y4'e kaldı (§8). Sahip oynayıp onaylayacak. |
| **Y3** | Varlık hattı: KTX2, LOD, meshopt (§14.1) | iPhone 12 mini'de çökme yok; iOS'ta GPU doku belleği ≤ 120 MB. **Ölçüldü:** lite paket 161 → 51,5 MB (KG-T49). Sahibin iPhone'unda deneme bekliyor. **Kaya LOD'u ✅ (2026-10-22):** uzakta iki hafif seviye (%35, %12 köşe; dikiş açmadan), gemi birkaç saniyede varabileceği her kayayı tam collider olarak görür; 5,2 km Yarık'ta kenardan bakışta ~650 bin → ~150 bin üçgen/kare (masaüstü ölçüm). Kalan: Alaska kayası. |
| **Y4** (kod ✅; TTK yalnız hesapla doğrulandı, bot ölçümü yapılmadı) | Sınıflar + özellikler + yetenek yuvaları (§3–4); önce Simülatör | Üç sınıf, 8 yetenek; TTK tablosu bot ölçümüyle ±1 sn. Her sınıfın modeli kapsülünden en çok 0,5 m taşar (araçla ölçülür). **Y4a ✅ (2026-10-23):** üç sınıfın değerleri kurallarda, sunucuda ve istemcide (§3.1, KG-X27); uçuş öncesi sınıf seçimi; botlar rolünün gemisinde (avcı Akıncı, madenci Muhafız, devriye Kılavuz). **Y4b ✅:** sınıf kapsülleri modele oturdu, en çok 0,46 m taşma (§8, KG-X28). **Y4c ✅:** A yuvası imzaları (güdümlü füze, soğurucu kalkan, onarım) ve hangarda B yuvası seçimi (Duman · Gizlen); kilit işareti, tehdit uyarısı ve yönü, füze, kalkan balonu (KG-X29, protokol 9). **Y4d ✅:** İllüzyon (ayna kopya, hologram kırılması, radar gerçeği gösterir) ve Tarama (alan çapında işaret, taranana uyarı) (KG-X30, protokol 10). Sınıf yakınlığı rütbesi, sahibin kararıyla (2026-10-23) rütbe sistemiyle birlikte Y6'ya ertelendi. |
| **Y5** (v6 harita kodu var; kabul eksikleri 19'da) | Yeni harita (§9–10, [15](15-yarik-haritasi.md)) + tek ortak oda | Ölçü kararı; 32 pilotta sunucu tick p95 < 5 ms; telefonda 60 fps hedefi. **Ölçüldü 2026-10-22 (v5 harita, Kovuk + Liman collider'ı, VPS):** 32 gemi (31 bot yapay zekâsıyla) uçarken simülasyon tick p50 0,73 · p95 2,07 · p99 2,92 ms. |
| **Y6** (Y6a–d ve hangar kodu var; Öz gelene kadar rütbe tavanı 3; son cihaz/oynanış kabulü açık) | Kalıcılık (F8): gemi seçimi, seviye, XP, yetenek rütbeleri ve sınıf yakınlığı (§4), yakıt doldurma, tamir/ikmal, gerçek yük → başkent | Sezonluk veri, idempotent yatırım, TEST kargo asla yatırılmaz; günlük aktarım tavanı (§7.4) aşılamaz. **Y6a ✅ (2026-10-23, KG-X31):** Core 9'da gemi seçimi, başkent döteryumuyla doldurma, ham kargo 1:1 başkente, kaynak başına 4 saatlik günlük tavan, 60 dk tamir / 10 dk bakım, deploy'da geri çağırma (protokol 11). **Y6b ✅ (2026-10-23, KG-X32):** seviye 1–20 (tavan Çekirdek), XP (10 kaynak = 1, öldürme 40, yardım 15, uçuş 10, kayıpta %40), dolu çubukta Yükselt (alaşım+kristal), sınıf büyümesi (hız en çok 120 m/s), botlar XP vermez (protokol 12). **Hangar ✅ (2026-10-23, KG-X33):** gemi işleri ana menüdeki Komutan gemisi sekmesinde, 3B hangarda; Yarık ön ekranında taktik ve alan kaldı. **Y6c kodu (2026-10-24, KG-X34):** ayrı taktik rütbeleri, puanlar, sınıf yakınlığı, protokol 13. **Sahip kararı:** Öz gelene kadar etkin rütbe tavanı 3; 4–5 sunucuda ve hangarda kilitli; [19](19-devralma-2026-10-24.md). **Y6d ✅ (KG-X35):** süreyi sıfırlamayan, çift ödeme almayan ödemeli tamir. Doğrulama: [19](19-devralma-2026-10-24.md). |
| **Y7** (kod + otomatik doğrulama ✅; cihaz/oynanış kabulü açık) | Klan takımı lobisi + eşit ganimet (§12) | Kalıcı havuz/pay, ortak kalkış, klan dostluğu/destek ve seyirci; ayrılan/ölen üyeye pay, 7 gün otomatik yatırım, artık paylaşımı, deploy/sezon kapanışı ve idempotent ödeme testli. Protokol 14 / migration 0200. Kanıt ve sınırlar: [20](20-y7-takim.md). |
| **Y8** — ERTELENDİ | Skin/kostüm ve modüler görünüm | İlk sürüm kabulü değil; önceki prototip yerel yedekte. [22](22-ilk-surum-mantigi.md). |
| **Y9** | Amiral rolü (§13), yeni sezonun ruleset kapısıyla | Sayaç döngüsü ölçümleri bozulmaz; bonus sınırları kural testinde. |

**Yeşil tanımı:** sıfır tip hatası, sıfır lint hatası, ilgili testler yeşil. Testler VPS'te ya da
sahibin PC kurallarıyla koşulur.

### 17.1 Sahibin oyun testi listesi (2026-10-22)

Sıra: önce hızlı düzeltmeler, sonra bugünkü haritadaki hata yerleri, en son Y5 harita tasarımı.

| # | Sahibin notu | Nereye | Durum |
|---|---|---|---|
| 1 | Her geminin motor alevi kendi nozulundan çıkmalı | Y3 | ✅ Nozullar modelde ölçüldü, arkadan, yandan ve üstten görüntüyle doğrulandı (KG-T50). |
| 2 | Turbo ile Ateş arasındaki ikisine birden basan gizli alan görünmeli; iki tuşa bağlı, onlarla bütün tasarlanmalı | hızlı | ✅ İki tuşu birleştiren köprü; çizilen alan = basılan alan (`chordLink`, test). Basılınca yanar. Ek hata: şarjör boşken Turbo da basılmıyordu, düzeldi. |
| 3 | Uçarken beyaz hız çizgileri: daha soluk, daha kısa, daha seyrek | hızlı | ✅ 840 → 420 zerre, en uzun 14 m (turboda ~42 m idi), ~%40 daha soluk (`render/dust.ts`, test). |
| 6 | Havadaki toplanabilir kaynak ve öldürme düşüşleri yakından geçince mıknatısla çekilir; ilk çeken alır, iki oyuncuya bölünmez | hızlı (sunucu kuralı) | ✅ KG-K30. Çevrimiçi akıcılık (15 Hz snapshot) oyun testinde bakılacak. |
| 4 | Düz, duvar gibi kutu yapılar atmosfere uymuyor: değişmeli ya da kalkmalı | Y5 ([15 §3](15-yarik-haritasi.md#3-yapı-kuralları--öneri)) | planlandı |
| 7 | İçine girilip saklanılan yapılar (enkaz gemi): hata gibi saklanma yeri olamaz | Y5 ([15 §3.1](15-yarik-haritasi.md#31-çizilen--çarpılan-madde-7)) | planlandı. Kök neden: yapılar kutu çarpıştırıcıda (§8); modeller kutularla örtüşmüyor, bazılarının hiç çarpıştırıcısı yok. |
| 5 | Çıkış noktası: nereden geçilecek, nerede durulacak, nerede beklenecek belli değil | Y5 ([15 §5](15-yarik-haritasi.md#5-çıkış-iskelesi-madde-5--öneri)) | planlandı |
| 8 | Harita rastgele değil, akıllıca planlanmalı. Kayalardan mağara benzeri, içinde birden çok yol olan yapılar; gemi içine girip izini kaybettirebilmeli. İçine girilen, içinde farklı yollar olan terk edilmiş uzay binaları. Harita bugünkünün 2 katı | Y5 (§9) | tasarım belgesi: [15-yarik-haritasi.md](15-yarik-haritasi.md), sahip onayı bekliyor. Ölçü §9 kararıyla aynı: yarıçap 2600 → 5200 m, yükseklik ±650 → ±1300 m. |
| 9 | Dokununca açılan harita: neredeyim, kaba yapılar (kaya bölgeleri, terk edilmiş istasyon…), giriş ve çıkışlar | Y5 ([15 §7](15-yarik-haritasi.md#7-harita-ekranı-madde-9--öneri)) | ✅ ilk sürüm (bölge adları Y5c'de gelir) |

### 17.2 Sahibin hangar ve uçuş notları (2026-10-23/24)

**Devralma, 2026-10-24:** Hangar ve son hasar/isabet/nişangâh kodu güncel worktree'de bulundu.
Y6c ve Y6d devamı, doğrulama ve kalan açıklar [19](19-devralma-2026-10-24.md)'da.

| # | Sahibin notu | Durum |
|---|---|---|
| 1 | Gemiler hangar zemininin içine giriyor | ✅ Modeller merkezlidir; gövdenin en alt noktası ölçülür, gemi zeminin üstünde süzülür (`restHeight`, test). |
| 2 | "Neon = Premium mu?" Alt bölüm ui-v2 diliyle yeniden | ✅ `hangar/ShipDesk.tsx`: v2 kit (SectionHead, Segmented, Button, Cost). Parlama yok; hata notu kırmızı değil. |
| 3 | "Sadelikten gözlerim kapandı": ikon ve renk | ✅ Sınıf rengi = uçuştaki A tuşunun rengi (Akıncı amber, Muhafız buz mavisi, Kılavuz nane). Sekmelerde, yetenek kartında ve değer çubuklarında. Değerlerde ve bölüm başlıklarında ikon. Kaynak miktarları kendi renginde. |
| 4 | Masaüstünde gemiyi çevirince hangar da oynuyor | ✅ Fareyle dikey sürükleme kamerayı eğiyordu. Kaldırıldı; sürükleme her cihazda yalnız gemiyi döndürür (test). |
| 5 | Telefonda FPS (S22) | bekliyor |
| 6 | Hasar miktarı ve isabet oranı gemi değerlerinde görünmeli, seviyeyle azar azar büyümeli | Büyüme kuralda zaten var (§3.2, `progression.ts` GROWTH: Akıncı hasar +%47,5, koni −%28,5 …). Ekranda da var; sınıf/seviye karşılaştırması ve sonraki seviye kazancı gösterilir. |
| 7 | İsabet şimdikinden biraz kötü başlamalı | ✅ Başlangıç konileri %15 geniş; isabet yüzdesi aynı dağılımdan hesaplanır. |
| 8 | Nişangâh + değil, ortası noktalı yuvarlak; boyu merminin dağılımı kadar, seviyeyle hafifçe küçülür | ✅ 500 m dağılımını çizer; seviye büyüdükçe daralır. |
| 9 | Halka 500 m'de doğru olsun, yazısı da ona göre | ✅ Halka 500 m'deki dağılım çemberidir; hangarda "500 m'de X m'ye dağılır" yazar. |
| 10 | İllüzyon kopyası pilotun tam aynası değil; sahibine gecikmeli görünüyor | ✅ Kopya artık kendi fiziğiyle uçmaz. Her tick, atıldığı andaki doğrultuya göre pilotun tam aynasına konur (sağ↔sol, yukarı↔aşağı; hız, turbo, ateş birebir). Kayaya ya da alan sınırına giren kopya hologram gibi dağılır. Sahibi kendi kopyasını kendi geminden çizer: gecikme yok. (`mirrorPose`, `stepDecoy`; roster `mirror` satırı; testler) |
| 11 | Basılı tutup ping hep ~400 m'yi işaretliyor | ✅ Parmağın çizgisinde 4 km içinde kaya/yapı varsa onu, yoksa 4 km ileriyi işaretler. |
| 12 | CR 2026-10-25: sunucu tip kontrolü kırık (`arena_ship_ready` devir kuralı yok), 2 lint hatası | ✅ Kural PERSONAL (Death Star hazır olayı gibi); lint düzeldi. |
| 13 | Lobiden kalkış öncesi ayrılan üyenin satırı 7 günlük otomatik aktarımı kilitliyordu | ✅ Otomatik aktarım yalnız payı olan satırları seçer; test eklendi. |
| 14 | Hazır diyen ama ekranda olmayan üye kalkışta 30 sn içinde bağlanamayıp uçuşu kaybediyordu | ✅ Hazır işareti, oyuncu masadan ayrılınca (panel kapanır, telefon kilitlenir) kalkar; hazırken "Kalkışa kadar bu ekranda kal" yazar. |
| 15 | Park görünümü (KG-A20) API'de vardı, ekranda yoktu | ✅ Gemi kendi başkentinin yanında döner (1,7 yarıçap); tamir/bakımda durur ve sayaç gösterir; dokununca Komutan gemisi sekmesi açılır. Yarık'ta/amiralde çizilmez. |

---

## 18. Riskler

| Risk | Ne yapıyoruz |
|---|---|
| **Boş oda** (bot yok, az eşzamanlı oyuncu, büyük harita) | Tek ortak oda; Kalp olayı ve geçici yarıklar oyuncuları toplar; girişte "Yarık'ta şu an N pilot"; ikmal bitince bildirim. Pilot başına karşılaşma sıklığı ölçülür; düşükse sahibe yeniden sunulur. |
| **Akıncı baskınlığı** | TTK tablosu + bot ölçümü; gerekirse gövde 380. |
| **Büyük klan takımı odayı ezer** (takım = klan kapasitesi) | Sahip ek kural istemedi. Takım/yalnız karşılaşma sonuçları ölçülür. |
| **Ekonomi** (galaksiden daha iyi gelir) | 08 §6 sınırı; ekonomi etüdü sahip onayıyla. |
| **Telefon performansı** (8 kat hacim, 32 pilot) | KTX2/LOD/kırpma; AOI; çözünürlük regülatörü (KG-T46). |
| **Lisans** | "Belirsiz" varlıklar yayına girmez; CC-BY için emeği geçenler ekranı. |

---

## 19. Kalan açık konular

1. **Sayılar:** v1 ihtiyatlı değerler §7.4'te yazıldı (2026-10-21). Oyun testi ölçümleriyle
   yalnız yukarı açılır. Uzun ekonomi koşuları yalnız sahip isteyince.
2. **Varlık kaynakları:** "belirsiz" lisanslı dosyaların kaynak sayfaları (sahip).
3. **`spaceship23` rar:** sahip `unrar` kurarsa ya da zip olarak verirse incelenir.
