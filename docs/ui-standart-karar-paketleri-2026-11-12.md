# UI standardı: karar paketleri (aşama 2.2–2.9)

Tarih: 2026-11-12. **Durum: 2.2–2.9 kararlandı (owner, 2026-11-12).** Hiçbir oyun ekranı değişmedi. Seçilen değerler 3. aşamada token'a ve koruyucu teste, 4. aşamada ekranlara geçer.

Dayanak: [araştırma](mobil-ui-ux-arastirmasi-2026-11-11.md), [plan, aşama 2](ui-ux-iyilestirme-plani-2026-11-11.md), başlangıç ölçümü `reports/ui-audit/baseline-2026-11-11.md`.

## Owner kararları (2026-11-12)

| Karar | Seçim | Not |
|---|---|---|
| 2.2 Yazı ölçeği | **Kitin ölçeği (B)**: taban 12 · etiket 13 · cümle 14 · buton 16 · bölüm başlığı 19 · ekran başlığı 24 · sayı 18 | Önce "Bugün" (9 / 10 / 12 / 12 / 16 / 18) yazıldı. Owner 2026-11-12, kitin fırlatma ekranının şimdi / +1 / +2 px görselinde "Şimdi" sütununu gösterip "bunu demek istemiştim" dedi (`out/ui-kit/fixes/yazi-boyu-karsilastirma.png`). Yani kitin bugünkü boyutları standarttır; büyütme yok. T1 ölçütü geçerli. Bedel (kesilme artışı) 2.3 metin bütçesiyle karşılanır. %115 ayarı 5. aşamada kalır. |
| 2.3 Metin bütçesi | **Bütçeli** | |
| 2.4 Dokunma | **44 px** | |
| 2.5 Renk rolleri | **A**: kitin 6 rolü ve 3 kural | Owner "Normal" dedi; kitteki hâli (A) olarak okundu. |
| 2.6 Süreler | **Panel 160 ms · basılı tutma B** | Basılı tutma B (0,6 / 1 / 1,5 sn) 3.5'te `GameHold` `weight` olarak kuruldu. Hangi eylemin hangi ağırlığı alacağı 4. aşamada ekranla seçilir (owner 2026-11-12). |
| 2.7 Kenar boşluğu | **12 px** | |
| 2.8 Sayı biçimi | **K/M** (240,1K · 1,4M) | |
| 2.9 Görünüm | **Komuta + Grafit**, panel rengi 2026-11-14'te **Gözlemevi laciverti** | Kitin varsayılanı oldu. Başlık, buton ve sayı fontu Russo One yerine Saira dar kalın. Owner yukarıdaki notları onayladı ("tamam"). 2026-11-14: owner grafiti solgun buldu. Dört palet karşılaştırıldı (Grafit, Gözlemevi, Kobalt krom, Gece altını; https://claude.ai/artifact/7kVfj7m7BNSqThE1sJNgaX) ve owner Gözlemevi'ni seçti. Kitin plakaları v2'nin lacivert zeminini aldı (`--gk-deep` = `--color-v2-deep`, `--gk-glass` = `--color-v2-panel`). Şekil ve font kararı değişmedi. |

Seçilenler 3. aşamada token'a ve koruyucu teste çevrilir.

## Nasıl bakılır

- **Telefonda (önerilen):** `v2-gallery.html?view=ui-kit-standard&lng=tr`. Her kararın sekmelerine dokununca aynı parça o seçenekle yeniden çizilir. Basılı tutma ve titreşim yalnız telefonda hissedilir.
- **Görseller (350 px, DPR 2):** `out/ui-kit/standard/`. `k22.png` … `k28.png` her kararın seçeneklerini yan yana gösterir. S22 çekimleri `out/ui-kit/standard/s22/` içinde (`s22-a.png`, `s22-b.png`).

Her paket aynı sırayla gider: bugün ne ölçüldü → rakip ve araştırma ne diyor → seçenekler ve bedelleri → önerim → kararın ölçülebilir karşılığı.

**Bağlı kararlar:** 2.2 ile 2.3 birlikte verilmeli: yazı büyür, metin azalır; yalnız biri yapılırsa ekranlar ya okunmaz ya taşar. 2.4 ile 2.7 de birlikte verilmeli: dokunma alanı büyürse boşluk küçülür.

---

## 2.2 Yazı ölçeği

**Bugün:**
- Telefonda görünen 18.404 metnin %73'ü 11 px'in, %79'u 12 px'in altında. 14 px ve üstü yalnız %7,5.
- Ölçek: micro 9, caption 10, label 11, body 12, title 16, figure 18.
- Filo gönderme ekranında cümle 10 px, buton yazısı 12 px.

**Rakip (S22 ölçümü):**

| Rol | Whiteout | Clash Royale |
|---|---|---|
| Meta (saat, rozet) | 9–10 | 7–10 |
| Okunan cümle | 12–14 | 10–12,6 |
| Buton yazısı | 15–19 | 15–25 |
| Başlık | 16,5–19 | 19–27 |

Fark boyuttan çok **kalınlıkta**: rakiplerin yazısı kalın ve konturlu.

**Araştırma:**
- Okunan cümle 13–14 px'te CPS düzeyine ulaşır (§1.2).
- 45 yaş üstü oyuncu telefonu yaklaştırarak telafi edemez.

**Seçenekler** (görsel `k22.png`: Bugün · A · B · B + %115):

| Rol | Bugün | A · Rakip | **B · Kit (önerim)** |
|---|---|---|---|
| Taban (saat, birim, sayaç) | 9 | 10 | **12** |
| Etiket, kural satırı | 10 | 11 | **13** |
| Okunan cümle | 12 | 13 | **14** |
| Buton yazısı | 12 | 16 | **16** |
| Bölüm başlığı | 16 | 18 | **19** |
| Ekran başlığı | 18 | 20 | **24** |

**Bedeller:**
- **Bugün:** Değişiklik gerekmez, ama ölçüm okunmadığını gösteriyor.
- **A:**
  - Rakiple aynı his.
  - Taban 10 hâlâ okuma eşiğinin altında; yalnız saat ve birim için kullanılabilir.
  - Ayrımı kalınlıkla yapmak gerekir; bizim gövde fontumuz (Saira) rakiplerinki kadar kalın değil.
- **B:**
  - Okunur.
  - Bedeli yer. Ölçümdeki yakın senaryoda (micro 11, caption 12, body 14):
    - kesilen metin 591 → 862;
    - kaydırma gereken ölçüm 650 → 739;
    - toplam ekran +%6.
  - B'nin tabanı 1 px daha büyük; kesilme biraz daha artar.
  - Uzun Türkçe başlık 24 px'te iki satıra iner: "Stratejik savunma bataryası" (görsel).
  - Bu yüzden B, 2.3'ün metin bütçesiyle birlikte gelmeli.
- **Yazı boyutu ayarı %115 (5. aşama):** 60 yaş üstü için. Görselde %115'te "2 sa 40 dk" plakanın kenarına dayanıyor; ayar gelmeden önce değer plakaları esnek yapılmalı.

**Önerim:** B. Buna ek olarak:
- 12 px'te iki kelimeden uzun BÜYÜK HARFLİ metin olmaz.
- Font kararı değişmez: başlık, buton ve sayı Russo One; gövde Saira. *(2.9 ile değişti: başlık, buton ve sayı Saira dar kalın.)*
- Ayar 5. aşamada gelir.

**Ölçülebilir karşılık:**
- T1: 12 px'in altında görünen metin = 0.
- T2: 12 px ve altında, büyük harfli, ikiden fazla kelime = 0.

---

## 2.3 Metin bütçesi

**Bugün:**
- **Ekran başına kelime ortancası 65.** Rakipte: Clash Royale 30, Whiteout 55.
- Kelimelerin %48'i 6 ve daha uzun kelimelik bloklarda.
- Uzun blok sayısı bizde ekran başına 2, rakipte 0–1.
- **En yoğun ekranlar:**
  - klan desteği hangarı: 163–204 kelime;
  - etkinlik rehberi: 172;
  - savaş raporu: 146;
  - bildirim merkezi: 142.

**Galerideki örnek** (klan desteği gönderme, bugünkü Türkçe metin; görsel `k23.png`):

| | Bugün | Bütçeli |
|---|---|---|
| Kelime | 114 | **31** |
| 6+ kelimelik blok | 6 | **1** |
| Yükseklik | 541 px | **371 px** |

Bütçeli hâlde bilgi silinmedi:
- Değerler plakaya geçti.
- Tek cümle kaldı.
- Hâkimiyet ve geri çekilme kuralları "?" ile açılan kutuda duruyor.

**Seçenekler:**
- **A · Bütçe yok:** Yalnız yazım düzeltilir. Bedel: 65 kelime kalır; B ölçeğiyle ekranlar taşar.
- **B · Ekran tipine göre bütçe (önerim):**
  - Kural:
    - kararı değiştiren bilgi satırda olgu olarak durur;
    - "neden" ve "kural" "?" ile açılan kutuya gider;
    - en fazla 2 seviye derine inilir.
  - Bütçe (araştırma §4.3):

    | Ekran tipi | Bütçe |
    |---|---|
    | HUD | 0 cümle |
    | Liste satırı | 1 olgu satırı |
    | Detay | 1–3 cümle |
    | Onay | Başlık + 1 cümle; butonda fiil |
    | Hata | Ne oldu + ne yapmalı |
    | Ödül | 0–1 cümle |
    | Boş durum | 1 cümle + 1 buton |
    | Eğitim adımı | 1 kısa cümle + işaret |
- **C · Sert sınır, ekran başına 30 kelime (Clash Royale):** Bedel: strateji oyununda karar verdiren bilgi de gider; Predictability ilkesi zarar görür.

**Önerim:** B. Hedef: ekran başına kelime ortancası ≤ 55 (Whiteout), ekran başına uzun blok ≤ 1. Uygulama 4. aşamada en yoğun ekranlardan başlar.

**Ölçülebilir karşılık:** W1 raporunda ekran başına kelime ortancası ≤ 55 ve uzun blok ortancası ≤ 1. Her ekranın önce ve sonra sayısı aynı araçla ölçülür.

---

## 2.4 Dokunma ve yerleşim

**Bugün:**
- 5.972 hedefin %77'sinin kısa kenarı 44 px'in, %16'sı 24 px'in altında.
- 336 aralık hatası var.
- Üst ve alt %15'lik bölgede 44 px'ten küçük 2.383 hedef var.

**Rakip:**
- Clash Royale'in birincil butonu 120×62, alt ortada.
- Pencere butonları 40–43 px yüksek.
- Kapat X'in görünen boyutu 22–24 px, ama hep aynı yerde ve kırmızı.
- Diğer butonlar "geniş ve ayrık".

**Araştırma:**
- WCAG AAA: 44 px.
- Material: 48 px.
- NN/g: 1 cm (≈56–65 px).
- Yaşlılarda 9–10 mm'de hata belirgin biçimde düşer.

**Kit bugün:**
- Taban `--gk-hit` 44.
- Büyük buton 56, alt menü 60.
- Yuvarlak butonun yüzü 36, alanı 44.
- Çipin görünen boyu 28, alanı 44.

**Seçenekler** (görsel `k24.png`, kesik çizgi parmağın vurduğu alan):
- **44 px (önerim):** 350 px'te 3 sekme, 3 çip ve 2 yuvarlak buton bir satıra sığar.
- **48 px:** Galerideki örnek 289 → 297 px uzar. Liste satırları zaten 48'in üstünde olduğu için değişmez; sekme, çip ve yuvarlak buton büyür. Sıkı satırlarda (filo kartları, kaynak çubuğu) yer daralır.

**Önerim:** 44 px taban ve şu kurallar:
1. Görünen boyut ile dokunma alanı ayrıdır. Küçük ikon 44 px'lik alanla sarılır (`gk-hit`).
2. Sık, önemli veya geri alınamaz eylem en az 56 px yüksekliktedir ve alt bölgede durur.
3. Kapat her sheet'te sağ üsttedir.
4. Komşu alanlar üst üste binmez.
5. Sürükleme ekran kenarından başlamaz (yanlarda 24 px, altta 32 px; 1.11 #6).

**Ölçülebilir karşılık:**
- K1: dokunulabilir hedeflerin alanı ≥ 44 px: %100.
- K3: aralık hatası = 0.
- K4 (düzeltilmiş tanımla): kenarda başlayan sürüklenen kontrol = 0.

---

## 2.5 Renk rolleri ve kontrast

**Bugün:**
- Metinlerin %22'si (4.049) en kötü zeminde eşiğin altında kalıyor.
- `text-threat` 4,45 kontrast veriyor.
- Döteranopide alaşım ↔ döteryum ΔE 15. Kitteki bakır renkle bu fark 38.

**Kitin rolleri** (`tokens.css`):

| Renk | Anlam |
|---|---|
| Amber | Ekrandaki tek birincil eylem |
| Turkuaz | Sen ve seçimin |
| Kırmızı | Düşman ve zarar |
| Yeşil | Kazanç ve "güçlü" |
| Sarı | Kaçınılabilir risk (hep ikonla) |
| Mavi | Bilgi |

Rakipler aynı mantığı kullanıyor. Clash Royale'de sarı birincil eylem, yeşil ilerleme, mavi panel, kırmızı kapat ve rozet.

**Kontrast (WCAG oranı, küçük yazı için eşik 4,5):**

| Yazı rengi | Koyu cam | Orta plaka | En açık plaka |
|---|---|---|---|
| Mürekkep (ink) | 17,2 | 14,7 | 12,2 |
| Soluk (ink-3) | 5,9 | 5,1 | **4,2** |
| Kırmızı (hostile) | 5,7 | 4,9 | **4,1** |
| Bakır (alloy) | 5,5 | 4,7 | **3,9** |
| Kırmızı açık ton (hostile-hi) | 8,3 | — | 5,9 |
| Bakır açık ton (alloy-hi) | 8,6 | — | 6,1 |
| Amber buton üstünde koyu yazı | — | — | 8,1 (alt kenarda 5,2) |

Diğer roller her zeminde 6'nın üstünde.

**Renk körlüğü** (görsel `k25.png`, tam şiddet simülasyonu):
- Yeşil ve kırmızı körlüğünde SALDIR ile BIRAK, +20% ile −15% ve ×1,5 ile ×0,6 aynı sarıya düşüyor. Ayrımı ikon, işaret (▲▼, +/−) ve yazı taşıyor; kit bunu zaten yapıyor.
- Mavi körlüğünde turkuaz ile yeşil yakınlaşıyor.

**Değişken zemin:** Parlak gezegenin önünde çıplak yazı okunmuyor. Konturlu yazı okunuyor, plakadaki yazı en güvenli olanı.

**Seçenekler:**
- **A · Kitin 6 rolü ve 3 kural (önerim):**
  1. Renk hiç yalnız gelmez; yanında ikon, işaret veya yazı olur.
  2. Küçük kırmızı, bakır ve soluk yazı yalnız koyu zemine konur. En açık plakada `-hi` tonu kullanılır.
  3. Resim veya 3D üstündeki okunacak bilgi plakada durur. Dünyadaki ad etiketleri konturlu olabilir.
- **B · Clash düzeni:** İlerleme eylemleri (Yükselt) yeşil buton olur. Bedel: bizde yeşil "kazanç ve güçlü" demek; eylem rengi olursa iki anlam taşır.
- **C · Renk körlüğü ön ayarı şimdi:** Bedel: ek iş. Kural 1 tutulursa gerek yok; ayar 5. aşamada düşünülür.

**Önerim:** A.

**Ölçülebilir karşılık:**
- C1: en kötü %5'lik zeminde metin ≥ 4,5, büyük metin ≥ 3: 0 ihlal.
- Rengin tek başına bilgi taşıması 4. aşamanın ekran kontrol listesinde denetlenir.

---

## 2.6 Süreler ve geri bildirim

**Bugün:**
- Basılan hedeflerin %96'sında 100 ms içinde görünür tepki yok.
- 300 ms'den uzun 989 geçiş var.
- Basılı tutma süreleri dağınık:
  - arena kalkışı 165 ms;
  - ping 320 ms;
  - v2 `HoldButton` ve başlangıç kargo bölmesi 600 ms;
  - prolog 850 ms.

**Kit:** Basma 80 ms'de göçer, cevap 160 ms, yerleşme 280 ms. Basılı tutma 600 ms. `GameHold` süreyi ağırlıkla alır (`weight`: `reversible` 0,6 / `spends` 1 / `final` 1,5 sn; 3.5).

**Araştırma:**
- Tepki ≤ 100 ms.
- Buton animasyonu 80–160 ms, geçiş 150–300 ms.
- Basılı tutma geri alınabilir eylemde 0,6–1 sn, geri alınamaz eylemde 1,5–2 sn. 2 sn'nin üstü sorunlu (XAG).

**S22 ölçümü:** 0,6 / 1 / 1,5 sn'lik basılı tutmalar 656 / 1035 / 1523 ms'de onaylandı.

**Seçenekler** (telefonda galeride bas ve hisset; görsel `k26.png`):
- **A · Tek süre, 0,6 sn:** Bugünkü kit. Bedel: klandan ayrılmak ile filo göndermek aynı ağırlıkta hissedilir.
- **B · Üç ağırlık (önerim):**
  - geri alınır: 0,6 sn;
  - kaynak harcar: 1 sn;
  - geri alınamaz: 1,5 sn.

  Erken bırakmak iptal eder ve "Basılı tut" der.
- **C · Geri alınamaz eylemde 2 sn:** Bedel: XAG sınırında; sabırsız oyuncu bırakır.

**Diğer süreler:**
- Basma tepkisi 80 ms; tepkisiz buton olmaz (galeride "Bugün" ile "Kit" yan yana).
- Panel açılışı 240 ms (galeride 160 / 240 / 320 denenebilir).

**Titreşim katmanları** (`lib/haptics`):

| Katman | Desen |
|---|---|
| Dokunuş | 10 ms |
| Onay | 14-30-22 |
| Uyarı | 30-40-30 |
| Şalter | 38-28-14 |

Aynı eylem hep aynı titreşimi verir; titreşim ses ve görüntüyle birlikte gelir.

**Önerim:** B, basma 80 ms, panel 240 ms. Basılı tutmanın dokunmayla yapılan alternatifi 5. aşamada ayar olarak gelir.

**Ölçülebilir karşılık:**
- F1: basılan hedeflerde 100 ms içinde tepki: %100.
- F2: 300 ms'den uzun arayüz geçişi = 0. Sahne ve ödül animasyonları ayrı bir listede tutulur.

---

## 2.7 Boşluk

**Bugün:**
- padding, gap ve margin değerlerinin %37,8'i 4'ün katı değil (21.643 / 57.260).
- Ekran kenarı 12 px; bu bilinçli bir sıkılık tercihi.

**Kit:** 4 px adım (`--gk-s1…s6`). Kitin kendi parçalarında yarım adım yalnız buton ve kart içinde (2 px). Galerideki kompozisyonlarda ise plaka içi 10 px ve aralık 6 px gibi yarım adımlar 31 satırda geçiyor; A seçilirse bunlar 4. aşamada 8 veya 12'ye çekilir.

**Araştırma:**
- Taban birim 4 px.
- Telefonda tipik kenar 16 dp.
- Bir kartın iç boşluğu, onu komşularından ayıran boşluktan büyük olmaz.

**Seçenekler** (görsel `k27.png`):
- **A · 12 px kenar ve 4'ün katları (önerim):** 2 px yarım adım yalnız bir kontrolün içinde olur (buton, çip, rozet); bloklar arasında olmaz.
- **B · 16 px kenar:** İçerik genişliği 326 → 318 px'e iner. İki sütunlu plakalar ve uzun sayılar daralır; B yazı ölçeğiyle birlikte kesilme artar.
- **C · Her yerde katı 4 px:** Kit kontrollerinin iç ölçüleri yeniden ayarlanır (10 → 8 veya 12). Bedel: görsel ince ayar kaybolur, okunurluk kazancı yok.

**Önerim:** A.

**Ölçülebilir karşılık:** L2 bloklar arası boşluğu sayar; 4'ün katı olmayan = 0. Kontrol içi ölçüm dışında kalır. ✅ Araç düzeltmesi 3.8'de yapıldı: buton, çip ve rozet gibi kontrollerin kendi iç boşluğu ile kontrolün içindeki her şey sayılmıyor.

---

## 2.8 Sayı biçimi

**Bugün** (`lib/format.ts`):
- 99.999'a kadar sayı tam yazılır.
- Üstü Türkçede "240 B" ve "1,4 Mn", İngilizcede "240k" olur.
- 10 binin üstünde ondalık atılır: 240.100 → "240 B".

**Rakip:**
- Whiteout Türkçe ekranında "240,1K", "1,4M", "1,89M" yazıyor; 6.422 tam kalıyor; yüzde "%24,0".
- Yani Türkçe virgül ve oyun harfi K/M.

**Sorun:**
- "B" İngilizce okuyan için *billion*, yani milyar demek.
- "Mn" alışılmadık bir kısaltma.
- Oyuncu K ve M'yi diğer oyunlardan tanıyor.

**Seçenekler** (görsel `k28.png`):
- **A · Bugün (B/Mn).**
- **B · K/M (önerim):**
  - Türkçe virgül ve bütün dillerde aynı harf.
  - 100.000'e kadar tam yazılır (B1 kuralı kalır).
  - Tek ondalık kullanılır, ",0" atılır.
  - Yuvarlama bir üst birime taşarsa birim değişir: 999.960 → "1M".
- **C · Tam sayı:** HUD'a sığmıyor; görselde 1.400.000 ikonun üstüne taşıyor (bu bilerek gösterildi).

**Mevcut → yeni gösterimi:**
- Adım adım değişen değerde ok: "Sv. 4 → 5".
- Sürekli değerde yeşil fark: "21,5 +0,5". Whiteout da böyle yazıyor.

**Bedel (B):**
- `units.thousands` ve `units.millions` metinleri 6 dilde güncellenir. Türkçe değişir; en, de, fr ve es küçük "k" yerine büyük "K" alır.
- `lib/format` testleri güncellenir.

**Önerim:** B.

**Ölçülebilir karşılık:** `lib/format` testleri ve ui-audit metin taramasında "B" ve "Mn" kısaltması = 0.

---

## Bu turda kitte düzeltilenler

Karar sayfası kurulurken kitte üç yerleşim sorunu bulundu ve düzeltildi. Hepsi oyunda da aynı biçimde görünürdü.

1. **`GameTabs`:** Sütunlar eşit (`1fr`) olduğu için en uzun sekme adı bütün sekmeleri genişletiyor ve sayfa 350 px'ten taşıyordu (ölçüm: 387 px). Artık sekmeler sayfayı genişletemiyor; çok kelimeli ad iki satıra iniyor.
2. **`GameHold`:** Uzun bir yan yazı ("1,5 sn · geri alınamaz") fiilin üstüne biniyordu. Yan yazı artık kendi sütununda (en çok %42) satır kırıyor.
3. **Sekme rozeti:** 1. düzeltmeden sonra "HAKİMİYET" ve yanındaki sayı rozeti sekmeye sığmadı. Rozet, oyunlardaki gibi sekmenin sağ üst köşesine taşındı; ad tüm genişliği kullanıyor.

Ek olarak `GameHold` ve `useHoldPress` bir basılı tutma süresi aldı. 3.5'ten beri `GameHold` bunu ağırlıkla seçer (`weight`, zorunlu).

## 2.9 Görünüm: dil ve panel rengi

**Karar (owner, 2026-11-12): Komuta + Grafit.** *(Panel rengi 2026-11-14'te Gözlemevi lacivertine döndü; bkz. tablo.)* Kitin varsayılanına katlandı: renkler `tokens.css`, şekiller `game-ui.css`. Deneme katmanı (`tone-command.css`, GÖRÜNÜM düğmesi, Lacivert ve Karbon) kaldırıldı. Russo One paketi bağımlılıklardan çıktı. Aşağıdaki metin kararın gerekçesi olarak duruyor.

**Owner (2026-11-12):**
- "Neredeyse her yerde arka planda kullandığımız mavimsi renk hoşuma gitmiyor."
- "Biraz fazla casual'a kaçmışız. Uzay oyunuyuz, biraz da ciddi bir oyun. İkisinin arasında bir dil yakalasak?"

**Neden casual okunuyor:** Altı şey birlikte:
1. Russo One: yuvarlak, ağır başlık fontu her yerde büyük harfle.
2. Büyük köşe yuvarlaklığı ve hap rozetler ("Denk hedef").
3. Butonlarda parlak "şeker" cilası ve kalın alt dudak.
4. Kalın, parlayan turkuaz kart kenarları; yuvarlak sayı rozeti.
5. Mavi-lacivert panel rengi (Whiteout ve Clash'in imzası).
6. Kalın konturlu beyaz yazı.

**Sektör nasıl yapar:** Mobil strateji üç banda ayrılır:
- **Casual:** Clash of Clans, Whiteout Survival. Yuvarlak, parlak, zıplayan.
- **Mid-core bilimkurgu:** Star Trek Fleet Command, Homeworld Mobile, Infinite Lagrange. Kesik köşe, ince çizgi, nötr koyu panel, dar teknik font, tek vurgu rengi.
- **Ciddi:** EVE Echoes.

Mid-core oyunlar ödül anlarını (zafer, kapsül) gösterişli tutar, araçları sakin tutar. Örnek ekranlar için sektörün başvuru arşivleri: [Game UI Database](https://www.gameuidatabase.com), [Interface In Game](https://interfaceingame.com).

**Deneme:** Kit iki eksende yeniden çizildi. Hiçbir oyun ekranı değişmedi.

- **Dil:**
  - **Bugün:** Bugünkü kit.
  - **Komuta (orta yol):**
    - kesik köşeli butonlar, cila yok, basınca içe göçer;
    - cıvata yerine köşe parantezleri;
    - ince kenarlar;
    - kare sayı rozeti;
    - ucu parlayan düz çubuklar;
    - Saira dar kalın başlık fontu;
    - amber butonda koyu yazı (uyarı plakası gibi);
    - daha az zıplama.

    Oyun hissi kalır: her kontrol hareket eder, ses ve titreşim verir, sahne canlı kalır.
- **Renk:**
  - **Lacivert:** Bugünkü panel rengi.
  - **Grafit:** Nötr koyu metal. Resimli ikonların koyu metal + amber diliyle aynı.
  - **Karbon:** Sıcak kömür, askerî/endüstriyel his.

Rol renklerine (amber, turkuaz, kırmızı, yeşil, sarı, mavi) dokunulmadı; bunu bir test koruyor.

**Kontrast (en açık plakada soluk yazı, hedef ≥ 4,5):**

| | Lacivert | Grafit | Karbon |
|---|---|---|---|
| Soluk yazı (ink-3) | 4,2 | **4,9** | **4,9** |
| İkincil yazı (ink-2) | 7,5 | 8,4 | 8,8 |

**Nasıl bakılır:**
- Herhangi bir kit görünümünde sağ üstteki **GÖRÜNÜM** düğmesi Dil ve Renk seçtirir.
- Adres de taşır: `v2-gallery.html?view=ui-kit-launch&lng=tr&tone=command&skin=graphite`.
- Görseller (350 px): `out/ui-kit/look/`.
  - `cmp-launch-command.png`, `cmp-base-command.png`, `cmp-list-command.png`, `cmp-hud-command.png` ve `cmp-report-command.png`: soldan sağa Bugün · Komuta+Lacivert · Komuta+Grafit · Komuta+Karbon.
  - `cmp-launch-game.png` ve `cmp-base-game.png`: yalnız renk değişimi (Bugün dili).
  - Tüm kit kataloğu iki görünümde `catalog-part1..6.png` içinde.
- S22: bu turda telefon bağlı değildi, çekilmedi.

**Seçenekler ve bedeller:**
- **A · Bugün + yeni renk:** En küçük değişiklik. Bedel: casual his kalır, yalnız mavi gider.
- **B · Komuta + Grafit (önerim):**
  - İki şikâyeti birlikte çözer.
  - Nötr panel renkleri ve NASA fotoğrafı gibi gökyüzünü öne çıkarır.
  - Dar font uzun Türkçe sözcüklere sığar: "GERİ ÇAĞIR" iki satırdan bire indi.
  - Bedel: 2026-11-12'deki Russo One kararı yeniden açılır; başlık, buton ve sayı fontu Saira dar kalın olur.
  - Bedel: dar font aynı boyutta daha küçük görünür. Owner 2026-11-12 yan yana görselden sonra büyütmeyi istemedi; 2.2 kitin ölçeği (B) olarak kaldı.
- **C · Komuta + Karbon:** Daha askerî ve sıcak. Bedel: bakır alaşım ve amber ile birlikte ekran kahveye kayar.
- **D · Komuta + Lacivert:** Dil değişir, mavi kalır.

**Komuta seçilirse sonraki adım:** Kütüphanede bu dile uyan hazır parçalar var (`game-assets`): Synty "Interface – Military Combat HUD" ve VSX "Space Combat Kit". İçlerinde köşe parantezleri, kesik köşeli çerçeveler, altıgen ve halka göstergeler bulunuyor. Sayaç halkası, hedef çerçevesi ve rozetler bunlarla zenginleştirilir.

**En kaliteli yol:** Bir oyun UI sanatçısı iki ana ekranın "stil karesini" (style frame) çizer, kit ona göre ayarlanır. Bunun yerine bu deneme kendi token sistemimizle yapıldı. Owner seçtikten sonra ince ayar yine S22'de yapılır.

**Ölçülebilir karşılık:** Seçilen dil ve renk, 3. aşamada varsayılan token olur. Deneme katmanı (`tone-command.css`, `data-gk-skin`) varsayılana katlanır, seçilmeyen kaldırılır.

## Sınıf amblemi: şekil ve renk (owner kararı, 2026-11-12)

Owner: Ok, Kargı, Sur ve Kurye ikonları akılda kalmıyor; her sınıfa bir renk verelim.

- **Şekil, "A · Evrim":** eski ▲ ◆ ⬢ ● adı konabilen bir nesneye büyüdü. Akıncı ok ucu, Mızrak mızrak, Sur burçlu kalkan, Destek halkada artı. Resimli piktogramlar (B ailesi) 10–12 px'te çamura döndüğü için seçilmedi.
- **Renk, "R1b · Rozet rengi":** savaşan sınıf kendi renginde bir plakada, işareti koyu. Akıncı pembe, Mızrak mor, Sur mavi; savaşmayan Destek çelik kalır. Rengi işaretin kendisine vermek (R1) çok soluk kaldı. Kırmızı/yeşil renk vermek (R2) çarpan rozetleriyle çakıştı.
- **Düşmanın sınıfı:** rengini korur, sağ üst köşesinde küçük kırmızı bir etiket taşır. Eskiden plaka kırmızıya dönüyor ve sınıf rengi kayboluyordu. İlk denenen kırmızı çerçeveyi owner çirkin buldu; köşe etiketi, alt şerit, kırmızı nokta ve işaretsiz hâl yan yana denendi. Nokta bildirim rozetiyle, alt şerit ilerleme çubuğuyla karışıyordu (`out/ui-kit/fixes/sheet-emblem.png`).
- **B8 değişti:** v2'de amblem renksizdi ve rengi sahiplik veriyordu. Kitte rengi sınıf verir; düşman olduğunu köşe etiketi söyler.
- **Kod:** kit glifleri `class_*`, tokenlar `--gk-class-*-hi/-lo`, `Emblem` (`readouts.tsx`), test `test/game-ui/emblem.test.tsx`.
- **Canlı oyun:** v2 `ClassEmblem` aşama 4'e kadar dokunulmadan kalır.
- **Aşama 4 notu:** v2'nin rakip pembesi (`#F25CD3`) ve klan mavisi (`#5B8CFF`) kite rol olarak gelirse Akıncı ve Sur renkleri yeniden kıyaslanmalı. Kitte şu an böyle bir rol yok.

## Owner'ın gözüne çarpanlar (2026-11-12)

- **Düşman amblemi:** kırmızı çerçeve kalktı, yerine köşe etiketi geldi (yukarıda). Owner köşe etiketi ile kırmızı nokta arasında kaldı, seçimi bana bıraktı: köşe etiketi kaldı, çünkü nokta kitin bildirim rozetiyle (`Dot`) aynı görünüyor.
- **"Depo dolu" çubuğu:** yazı 10 px'lik ince çubuğa konmuştu, sığmıyordu. Artık yazı taşıyan çubuk her zaman kalın (18 px); ayrı `thick` seçeneği kalktı.
- **Butondaki maliyet:** amber butonun üstündeki koyu kutu rengi kirletiyordu. Maliyet artık butonun kendi yazı renginde, ince bir ayraçtan sonra duruyor. Açık renkli kutu da denendi (`out/ui-kit/fixes/sheet-cost.png`).
- **Kapsül açılış sesi:** 8-bit güç sesi (pod-open B) beğenilmedi. Kütüphaneden katmanlı dört yeni aday hazırlandı (kilit + hava + parıltı): `out/ui-kit/sesler/pod-open-2/index.html`. ✅ Owner B'yi seçti (mandal + hava + yükselen onay tınısı); `unseal-v1.mp3` olarak bağlandı.

## Kit ölçümüyle değişen görünüm (3.8, 2026-11-12)

Kit ölçümü kontrastı temizlerken birkaç parçanın rengi değişti. Görseller: `out/ui-kit/stage3/audit-fix/`.

- **Kırmızı buton (tehlike):** sinyal kırmızısından koyu kırmızıya indi. Beyaz yazı üstte 2,97:1 veriyordu, artık 4,5:1. Kenar ışığı parlak kaldı. Yuvarlak kırmızı buton da aynı.
- **Turkuaz yuvarlak buton:** ikon beyazdan koyu mürekkebe döndü (1,7:1 → 11:1). Aynı tondaki büyük buton zaten koyu yazıyla çiziliyordu.
- **Seviye altıgeni:** açık maviden koyu çelik maviye indi (beyaz rakam 1,95 → 4,8:1). Mavi kimlik korunuyor.
- **Bildirim noktası ve düşman çarpanı (×0,6):** koyu kırmızı zemin. Parıltı rakamın üstünde kalıyor.
- **Çubuk yazısı ve ZAFER şeridi:** parlak dolgunun üstündeki beyaz yazı koyu kontur aldı (2 ve 3 px). Oyunların çubuk yazısı böyle çizilir. WCAG 1.4.3'e göre geniş kontur yazının zemini sayılır; araç da artık böyle ölçüyor.
- **Soluk yazı (`ink-3`):** `#979ca5` → `#a5a9b1`. En açık plakada 4,9 → 5,8:1.
- **Klan amblemi etiketi:** küçük karede 10,8 px'e düşüyordu. Artık 12 px'in altına inmiyor.
- **Metin kutusu:** basınca kenarı yanıyor (eskiden yalnız klavye açılınca yanıyordu).
- **Liste sonu:** sheet gövdesinin alt boşluğu 12 → 24 px. Son satır alt çubuğun 22 px'lik solmasından çıkabiliyor.
- **Galeri başlıkları:** üç kelimeden uzun büyük harfli başlıklar kısa ad + düz yazılı not olarak bölündü ("BASILI TUT · kritik hamle").

**Dar telefonda (320 px) kesilen yazılar** (her dilde 21 kesik → 0; Japonca için alttaki nota bak):
- **Gemi bölmesi:** sabit 78 px yerine satırı dörde bölüyor (350'de 77, 320'de 69 px). 340 px altında sınıf bandı ok ikonunu bırakıyor; ×0,625 / ×1,6 yönü zaten söylüyor.
- **Değer plakası notu** ve **kilit açılan ad** üç noktayla kesilmek yerine ikinci satıra iniyor ("1 / 1" gibi asıl kısım kaybolmuyor; ヴァイパー da sığıyor).
- **Kapsül ipucu:** Ç, Ş çengelleri kırpma kenarına değmesin diye altına 4 px boşluk.
- **Basılı tut:** fiil ("GERİ ÇAĞIR") tek satırda kalıyor, yanındaki bilgi ("DÖNÜŞ 8 DK") önce iki satıra iniyor. Bilgi tek kelimesi bile sığmazsa kesilmek yerine kelimenin içinden kırılıyor (son çare).
- **Bekleme halkası:** uzun buton yazısının yanında elipse eziliyordu; artık hep yuvarlak.
- **Galeri yuvarlak buton satırı** taşmak yerine alt satıra iniyor (katalogu 311 px'e zorluyordu).

**Kalan tek kesik (Japonca, 320 px):** gri "GÖNDERİLİYOR" bekleme butonu. Galerideki örnek yazılar Türkçe; Japonca profilde bu Türkçe kelime Japonca yazı tipinin geniş Latin harfleriyle çiziliyor ve yarım hücreye sığmıyor. Oyunun gerçek Japonca metni "送信中…" rahat sığıyor. Türkçede kelime tam görünüyor, o yüzden butonun yazısına kırılma eklenmedi (Türkçede de "GÖNDERİLİ/YOR" diye bölüyordu).

**Ölçüm aracında düzeltilenler** (her biri kalibrasyon testiyle):
- Ekran okuyucuya özel (sr-only) yazı görünür sayılıyordu.
- Kontrast satır kutusundan ölçülüyordu; rozet kenarı ve gemi resmi harflerin zemini sayılıyordu. Artık harflerin çizildiği bant ölçülüyor.
- Üstü kapalı ya da yarısı sabit çubuğun altında kalan yazı ölçülüyordu. Artık yalnız görünen kısmı ölçülüyor.
- Kayan listedeki yazı, alt çubuğun solmasından geçerken ölçülüyordu. Artık en iyi göründüğü yerde ölçülüyor; sabit yazı ise en kötü anında.
- Etiketle adlandırılmış metin kutusu "adsız alan" sayılıyordu; kutunun yanındaki etiket ayrı (18 px'lik) hedef sayılıyordu (WCAG 2.5.8 "eşdeğer kontrol").
- Ekranın kenarında ince bir şeridi görünürken basılan hedef, tam göründüğünde yeniden basılıyor.
- L2 kontrol içi boşluğu saymıyor (2.7).

## S22 öncesi kod incelemesi (2026-11-12)

Dalın tamamı (`feat/ui-ux-standard`, master'dan bu yana) incelendi. Doğrulanan hatalar testle düzeltildi:

- **Gemi kartı:** eksi basılı tutulup 0'a inince düğme parmağın altından kalkıyordu, tekrar sayacı durmuyordu. Sonra karta dokunulan her gemi bir an sonra geri alınıyordu. Artık sınıra gelen tekrar duruyor.
- **Basılı tut (canlı v2 düğmesi de):** tutarken eylem geçersizleşirse (yakıt bitti, sunucu güncelledi) süre dolunca yine gönderiyordu. Artık iptal.
- **Çarpan rozeti:** kuralın ×0,625'ini ×0,6 yazıyordu; oyuncuya yanlış kural öğretir. Artık oyunun `factor` biçimi: her basamak. Galeri örnekleri de gerçek değere (0,625) geçti.
- **Gemi bölmesi:** ×0,625 sınıf işaretinin yanına 350 px'te de sığmıyordu. Bant artık yalnız çarpanın; sınıf işareti geminin sol üst köşesine, resmin üstüne sabitlendi. Bütün bölmeler aynı boyda.
- **Kısa sayı:** kayıp kazançtan farklı yuvarlanıyordu (4.250 → 4,3K ama −4.250 → −4,2K). Artık simetrik.
- **Kapsül:** "zaten açıldı" bilgisi kapsül çizildikten sonra gelirse kapalı kalıyor, ikinci kez açılabiliyordu. Artık açık görünüyor ve bir şey vermiyor.
- **Vites kolu:** ok tuşu seçimi değiştiriyor ama odak eski konumda kalıyordu (klavye). Artık odak seçimle gidiyor.

Hata sayılmayanlar: tek ondalık yüzünden sayılar biraz uzadı. Bu, 2.8 kararının gereği; üst çubukta en geniş değer zaten "99.999" kadar. Basılı tutmanın başladığı andaki veriyle göndermesi de hata sayılmadı: oyuncu gördüğünü onaylıyor, sunucu yine doğruluyor.

## Sıradaki

- ✅ 3. aşama: kararlar token'a ve koruyucu teste çevrildi. Ölçek kitin ölçeği (B); dar font için büyütme yok (owner 2026-11-12).
- ✅ Kit, ui-audit taramasına ayrı bir "kit" yüzeyi olarak eklendi (owner onayı, 2026-11-12): `pnpm ui:audit run --kit`, sonuç `reports/ui-audit/kit-<tarih>.md`.
- ✅ Elle çizilmiş ince glifler dolgulu stile çevrildi (owner onayı, 2026-11-12): 18 glif paketlerden izlendi, `attack_up` yeni kılıçla kuruldu, hız göstergesinin 16 px'te kaybolan çentikleri atıldı. Koruyucu test: her glif kutusunun en az beşte birini doldurur (sıra çubukları `bay`, `speed_up` hariç). Kasa, hangar, menü, yukarı/aşağı anlamı değişmesin diye çizimde kaldı.
- ✅ Seçilen arayüz sesleri kite bağlandı (41430c6a).
