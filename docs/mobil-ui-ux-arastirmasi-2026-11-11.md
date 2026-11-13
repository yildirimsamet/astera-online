# Mobil oyun UI/UX araştırması: yazı, boşluk, dokunma, ikon, renk ve 7'den 70'e anlaşılırlık

2026-11-11. Yedi araştırma agent'ı ayrı konularda veri topladı: tipografi, boşluk ve layout, dokunma hedefleri ve geri bildirim, ikon ve metin, renk, anlaşılırlık, oyun benchmark'ları. Bu belge o verilerin sentezi ve Astera'nın mevcut koduyla karşılaştırmasıdır.

**Güven seviyesi.** Her bulgunun yanında kaynak tipi var:

- **R**: resmi kılavuz (Apple HIG, Material 3, WCAG 2.2, Xbox Accessibility Guidelines/XAG, Game Accessibility Guidelines/GAG).
- **A**: araştırma (NN/g, akademik çalışmalar, Hoober).
- **E**: endüstri (geliştiricinin kendi açıklaması, GDC, Game Developer).
- **U**: uygulayıcı bloğu.
- **H**: benim hesabım.

Apple HIG ve Material 3 sayfalarının bir kısmı JavaScript ile çizildiği için okunamadı. Bu sayfalardaki birkaç değer ikincil kaynaktan geliyor ve öyle işaretlendi. Bu belge mekanik tanımlamaz. Mevcut kurallar `interface.md`, `visual-design.md` ve `ux-writing.md` belgelerinde kalır.

**Review (aynı gün).** Rapor agent çıktılarıyla karşılaştırıldı.

- Hesap hataları, yanlış atıflar ve kaynağı zayıf olduğu halde kural gibi yazılmış ifadeler düzeltildi.
- Okunabilirlik eşiğinin birimi (x-yüksekliği) Legge & Bigelow 2011'den doğrulandı.
- Koddaki ölçüm `.css` dosyalarını da kapsayacak şekilde genişletildi.
- Araştırılmamış önemli konular §9'a eklendi.

**H** etiketli ifadeler kaynak değil, öneri veya hesaptır.

---

## 0. Özet: araştırmanın söylediği 13 kural

1. **Okunacak metin 11 px'in altına inmez.**
   - Apple'ın minimumu 11 pt, Material 3'ün en küçük stili 11 sp.
   - Rahat okunan gövde metni 14–17 px.
   - Gazete gövde metniyle aynı görüş açısını telefonda yaklaşık 14 px verir (§1.2).
   - Bizde en sık kullanılan boyut sınıfları 9 ve 10 px. CSS'te 7 ve 8 px de var (§8).
2. **Hiyerarşiyi boyut kadar ağırlık ve renk kurar.**
   - Kaynaklar seviye sayısı vermiyor. M3 15 stilin hepsinin gerekmediğini söyleyip 5 boyutlu bir örnek veriyor. Bir ekranda 3–5 boyut önerisi buradan çıkıyor (H).
   - Yoğun arayüzde ölçek oranı 1.125–1.2 olur (U).
   - Küçük metinde ince ağırlık kullanılmaz (Apple).
3. **Görsel boyut küçük olabilir, dokunma alanı küçük olamaz.**
   - Taban 44×44 px (WCAG AAA; Apple'ın değeri bu oturumda doğrulanmadı) veya 48 px (Material).
   - İki hedef arası en az 8 px.
   - Sık ve önemli eylemlerde 10 mm, yaklaşık 56–65 px (NN/g).
4. **Kenar ve köşe ortadan daha zor vurulur.**
   - Ortada hedef merkezleri arasında 7 mm yeter, üst ve alt kenarda 10–12 mm gerekir (Hoober).
   - Alt kenar da zor bölgedir. Benchmark oyunları ana eylemi yine de alta koyuyor (CoC, Clash Royale), çünkü başparmak oraya ulaşıyor.
   - Uzlaşı (H): ana eylem alt bölgede durur ve büyük olur. Sürükleme gerektiren kontrol alttaki hareket alanında (gesture inset) başlamaz; basit dokunma orada da çalışır (§2, düzeltme). Salt okunur bilgi üstte durur.
5. **Her dokunuş 100 ms içinde görünür bir tepki verir; 1 sn'yi aşan işlemde ilerleme gösterilir** (Nielsen, RAIL).
   - Buton basma animasyonu 80–160 ms sürer (U).
   - Arayüz geçişleri yaklaşık 150–300 ms olur (U/H).
6. **Basılı tutma bağlama göre ayarlanır.**
   - Uygulayıcı önerisi: kolay geri alınan eylemde 0,6–1 sn, geri alınamaz eylemde 1,5–2 sn.
   - XAG 2–3 sn ve üstünü sorunlu sayıyor. Bu yüzden 2 sn'yi tavan öneriyorum (H).
   - Erken bırakmak eylemi iptal eder.
   - XAG 107, basılı tutmanın yerine dokunarak yapılan bir alternatif de istiyor.
7. **Yalnızca üç ikon herkesçe tanınır: ev, arama ve yazıcı (NN/g).**
   - Kalan ikonlar etiket ister.
   - Sürekli görülen ve sayıyla eşleşen ikonlar (kaynak, süre) etiketsiz kalabilir. Bunu doğrudan ölçen çalışma yok (H).
   - Durum göstergesi taramasında yalnız metin, renk ve ikonun birlikte kullanıldığı gösterimden %57 daha yavaş. Görev süreleri 22 sn ve 14 sn.
8. **İnsanlar metnin azını okur.**
   - Web kullanıcısı metnin en fazla %28'ini okur (NN/g, 2005).
   - Göz izleme çalışmasında oyuncular tutorial metninin çoğunu görmedi.
   - Kural karar anında ve kademeli verilir: satır olguyu gösterir, bir dokunuş kuralı açar, en fazla 2 seviye derine inilir.
9. **Renk dağılımı 60-30-10'dur, bir ekranda 3 ana renk tonu olur.** Vurgu rengi yalnızca birincil eylemde kullanılır. Anlamı olan bir renk her yerde aynı anlamı taşır.
10. **Renk hiçbir zaman tek başına bilgi taşımaz.** Erkeklerin yaklaşık %8'inde kırmızı-yeşil renk körlüğü var. Durum renkle birlikte şekil, ikon veya metinle de gösterilir.
11. **Değişken bir arka plan üzerindeki metnin kontrastı en kötü bölgeye göre ölçülür (XAG).** Metin 4,5:1, büyük metin ve UI bileşeni 3:1 kontrast ister. Değişken zeminde metin bir plaka, gölge perdesi (scrim) veya kontur ile korunur.
12. **7'den 70'e anlaşılırlık:**
    - Bir karar ekranında aynı anda 3–5 bilgi grubu bulunur (Cowan).
    - Dil yaklaşık 9–12 yaş okuma seviyesinde olur (H). Kaynakların verdiği hedefler: GOV.UK 9 yaş, NHS 9–11, XAG ortaokul.
    - Oyuncu riski olmayan bir alanda deneyerek öğrenir.
    - Sonuç oyuncuyu suçlamaz ve mümkünse geri alınabilir.
    - Her yaş grubuyla 3–4 kişilik test yapılır.
13. **Flaş güvenliği:** Saniyede 3'ten fazla flaş olmaz (WCAG 2.3.1, GAG Basic). Bu konu henüz araştırılmadı (§9).

---

## 1. Yazı hiyerarşisi

### 1.1 Platform tabanları

| Kaynak | En küçük | Gövde metni | Not |
|---|---|---|---|
| Apple HIG (R) | 11 pt | 17 pt (Body), 15 (Subhead), 13 (Footnote), 12 (Caption 1) | İnce ağırlıklardan (Light, Thin) kaçınılır. Metin %200'e kadar büyüyebilmelidir. |
| Material 3 (R) | 11 sp (labelSmall) | 14 sp (bodyMedium), 16 (bodyLarge), 12 (bodySmall) | 15 stil tanımlı, ama ürünlerin çoğu 5 stille yetinir. |
| NN/g, 65 yaş üstü (A) | — | en az 12 pt | Yaşlı kullanıcılar için. |
| Mobil oyun erişilebilirlik heuristiği (E) | — | ≥18 px (kalın metinde 14 px) | %200 ölçeklenebilir olmalı. |
| XAG 101, mobil (R) | — | gövde yüksekliği ≥18 px @100 DPI (≈4,6 mm fiziksel) | Konsoldan türetilmiş, çok yüksek bir değer. Telefonda yaklaşık 22–26 px font boyutuna denk gelir (H). Erişilebilirlik modu için bir hedef olarak okunmalı. |

CSS px dönüşümü (H): Modern bir telefonda 1 CSS px yaklaşık 0,15–0,18 mm'dir. iPhone mini'de 0,154 mm, Galaxy S22'de (360 px genişlik) 0,180 mm.

### 1.2 Fiziksel okunabilirlik eşiği

**Kaynak (Legge & Bigelow 2011, J Vis; A; bu review'da doğrudan okundu):**

- Baskı boyutu **x-yüksekliğinin** göze yaptığı açıyla ölçülür.
- Normal görüş için kritik baskı boyutu (CPS) yaklaşık 0,2°'dir. Bireysel aralık 0,15°–0,3°'dir. Bu boyutun altında okuma hızı düşer.
- En yüksek okuma hızı 0,2° ile 2° arasında elde edilir ("akıcı aralık").
- Gazete gövde metninin ortalaması 0,23°'dir (aralık 0,20°–0,26°). Kitaplar 0,24° civarındadır. Hepsi 40 cm mesafede ölçüldü.
- Yazıcılar metni CPS'nin hemen üstünde tutar.

Hou vd. 2022, CPS'nin yaşla nasıl değiştiğine dair bir sayı vermiyor. Elimizdeki kanıt şunlar:

- Yaşlılar düşük ışıkta, parlamada ve düşük kontrastta daha savunmasız (Legge & Bigelow).
- Düşük görmede CPS çok daha büyük.
- Yeh 2015'te gençler 12 pt'yi doğru okudu, yaşlılar 14 pt'de bile zorlandı. Kısa süreli gösterimde doğruluk yaşlılarda %39,9, gençlerde %87,7 oldu (A).

**Telefona çevirme (H).** Varsayımlar: 33 cm mesafe (telefon gözden 40 cm'den yakın tutulur), x-yüksekliği 0,516 em (IBM Plex Sans), 0,154–0,180 mm/px. Fontların x-yüksekliği oranı 0,36–0,55 arasında değiştiği için sonuç fonta bağlıdır.

| Font boyutu | x-yüksekliğinin açısı | CPS (0,2°) ve gazete (0,23°) ile kıyas |
|---|---|---|
| 9 px | 0,12°–0,15° | CPS'nin açıkça altında; bireysel aralığın da alt sınırında |
| 10 px | 0,14°–0,16° | CPS altında |
| 11 px | 0,15°–0,18° | CPS altında |
| 12 px | 0,17°–0,19° | CPS'nin hemen altında |
| 13 px | 0,18°–0,21° | CPS düzeyinde |
| 14 px | 0,19°–0,23° | CPS ile gazete arasında |
| 16 px | 0,22°–0,26° | Gazete düzeyi |

**Sonuç:**

- 9–10 px, normal gören genç bir göz için bile okuma hızının düştüğü bölgede kalır.
- 12 px sınırdadır.
- Gazete rahatlığı yaklaşık 14–16 px'te başlar.
- Oyuncu telefonu yaklaştırarak bunu telafi edebilir. Ancak presbiyopisi olan oyuncu (yaklaşık 45 yaş ve üstü) telefonu yaklaştıramaz.
- 11 px'lik platform tabanı tek başına rahat okuma sağlamaz. Yalnızca kısa etiketler için uygundur. Okunan cümle 13–14 px ister.

### 1.3 Hiyerarşi kuralları

- **Seviye sayısı:** Bir ekranda kaç boyut olacağına dair kaynaklı bir sayı yok. M3 15 stilin hepsinin gerekmediğini söyleyip 5 boyutlu bir set örnekliyor. Bir ekranda 3–5 boyut önerisi buradan çıkıyor (H).
- **Ölçek oranı:** Yoğun arayüz için 1.125–1.2, standart arayüz için 1.25 (U).
- **Ağırlık ve renk hiyerarşiyi kurar.** Apple'da Footnote ile Body arasında 4 pt fark var; ayrımı Semibold ve Regular farkı yapar. M3 aynı boyutta Regular (gövde) ile Medium (etiket) kullanır ve vurguyu renk rolleriyle (on-surface ve on-surface-variant) verir (R).
- **Satır aralığı:** Gövde metninde 1,3–1,5 (Apple 1,29, M3 1,43–1,5). XAG ve GAG iki satırdan uzun metinde ≥1,5 ister.
- **Satır uzunluğu:** Mobilde 30–50 karakter. XAG üst sınırı 80 karakter.
- **ALL CAPS:**
  - Uzun metni harf harf okutup yavaşlatır. 1–2 kelimelik etiketlerde kullanılabilir.
  - Büyük harf, font yüksekliğinin yaklaşık %10'u kadar pozitif tracking ister (U).
  - Apple'ın SF Pro tablosu küçük boyutta yalnızca hafif pozitif tracking veriyor: 10 pt'de +1,2 %, 11 pt'de +0,6 %.
  - XAG, uzun metin için ALL CAPS yerine cümle düzeni seçeneği istiyor.
- **Sayılar:** Tabular rakam kullanılır (`font-variant-numeric: tabular-nums`). Canlı bir sayaç değiştikçe yanındaki öğeleri kaydırmamalı. Bizim kuralımız da aynı: "Sayılar ekranın en yüksek sesidir."
- **3D veya değişken zemin üzerinde metin:** Önce düz bir plaka kullanılır. Plaka mümkün değilse belirgin kontur ve gölge eklenir. Kontrast zeminin en kötü bölgesine göre ölçülür (XAG 102, GAG). Çift kontur (içte koyu, dışta açık) her zeminde çalışır (For Honor örneği).
- **Stilize font:** Başlık için kullanılabilir. Canlı bilgi ve gövde metni sade bir fontla yazılır. Düşük x-yüksekliğine sahip bir font aynı px değerinde daha küçük görünür.
- **Yerelleştirme:**
  - Metin uzaması (U, W3C/IBM'e atıf yapan ikincil kaynaklar):

    | Dil | Uzama |
    |---|---|
    | Almanca, Felemenkçe | ~%30 |
    | Fince, Macarca | ~%50 |
    | 10 karakterden kısa diziler (her dilde) | %100–200 |
    | Rusça | Veri bulunamadı |

  - Bizim dillerimiz: de, en, es, fr, ja, tr.
  - Japoncada XAG satır uzunluğu sınırı 40 karakterdir.
  - Türkçede büyük harf dönüşümü `lang="tr"` ister. `i18n/document.ts` `documentElement.lang` değerini zaten ayarlıyor.

---

## 2. Boşluk hiyerarşisi ve layout

- **Taban birim 4 px.** Ölçek 4, 8, 12, 16, 24, 32, 48. Bu ölçek yaygın bir pratik, ama birincil kaynakta doğrulanmadı (U/H). Telefonda kenar boşluğu tipik olarak 16 dp (U, M3 sayfası doğrulanamadı). Biz 350 px ekranda 12 px kullanıyoruz (`px-3`). Bu, bilinçli bir sıkı tercih.
- **Yakınlık ilişkiyi kurar (NN/g, A).** Bir başlık, önceki bölümden çok kendi bölümüne yakın durur. Uzun bir liste anlamlı gruplara bölünür; 12 öğe yerine 4+4+4.
- **İç boşluk dış boşluktan büyük olmaz (U).** Bir kartın iç padding'i onu komşularından ayıran boşluktan küçük veya ona eşittir. Önerilen oranlar (1:2:3, 8/16/32) yalnızca uygulayıcı sezgisi; araştırma kaynağı yok.
- **Liste satırı yüksekliği (M3, ikincil kaynak):**

  | Satır tipi | Varsayılan | Kompakt |
  |---|---|---|
  | Tek satır | 56 dp | 48 dp |
  | İki satır | 72 dp | 64 dp |
  | Üç satır | 88 dp | 80 dp |

  Material'in yoğunluk ayarı görsel bileşeni küçültür, dokunma hedefini küçültmez.
- **Ekran kenarı (Android 15 ve sonrası, R):** Uygulama kenardan kenara çizilir. Sistem çubuklarının (durum çubuğu, 3 butonlu gezinme çubuğu) altına dokunma veya sürükleme hedefi konmaz. Arka plan kenara kadar uzanabilir; metin ve buton içeride kalır.
  - **Düzeltme (aşama 1 review'u, 2026-11-11):** Hareket alanı (system gesture insets) ayrı bir şeydir. Android belgesine göre basit dokunma bu alanda da uygulamaya ulaşır; alanda öncelik sistemin kaydırma jestlerindedir. Bu yüzden kural dokunma için değil sürükleme içindir: ekran kenarından başlayan sürükleme (kaydırıcı, yatay kaydırılan şerit, kamera sürükleme) geri ve ana ekran jestiyle çakışır. Önceki metin bu ikisini karıştırıyordu.
- **Telefonu tutuş (Hoober 2013, 1.333 gözlem, A):** %49 tek elle, %36 bir elde tutup diğer elle, %15 iki elle. Tutuş birkaç saniyede bir değişir ve kullanıcı her yere uzanır. Bu yüzden zor erişilen bölgeye düşük öncelikli veya tehlikeli işlev koymak koruma sağlamaz.
- **Hedef aralığı (Hoober 2013-11, A):** Ekran ortasında hedef merkezleri 7 mm aralıkla yerleşebilir; üst ve alt kenarda 10–12 mm gerekir. Üst ve alt kenarlar yan kenarlardan daha zordur. Yerleşim önerileri:
  - Üst bölgede az sayıda ve büyük öğe olur.
  - Orta bölgede tam genişlikte satırlar olur.
  - Alt bar en fazla 4 öğe taşır (Hoober). Clash Royale 5 sekme kullanıyor.
  - Alt kenar, üst kenar kadar zor vurulur. Alttaki hedefler bu yüzden büyük olur.
  - Son satırın altında boşluk bırakılır, böylece oyuncu onu ekranın ortasına kaydırabilir.
- **Büyük telefonlar (U):** Başparmağın rahat eriştiği alan ekranla birlikte büyümez. Büyüyen, ulaşılmaz kalan alandır.
- **Etkileşim maliyeti (NN/g, A):** Okuma, kaydırma, dokunma, bekleme ve ekranlar arasında bilgi taşıma oyuncunun maliyetidir. Karşılaştırılacak öğeler aynı ekranda durmalıdır.
- **HUD'ın kapladığı alan:** Yüzde olarak bir standart bulunamadı. Kanıtlanan kalıp, HUD'ın bağlama göre büyüyüp küçülmesidir. RuneScape Mobile'da savaş, beceri ve sosyal modların her biri kendi HUD'ını kullanır ve 150 ms'den uzun geçişler savaşta ağır hissettirmiştir (U).

---

## 3. Dokunma hedefleri, butonlar, durumlar ve geri bildirim

### 3.1 Boyutlar

| Kaynak | Değer | CSS px karşılığı (H, 0,154–0,18 mm/px) |
|---|---|---|
| WCAG 2.5.8 AA (R) | 24×24 px; daha küçükse çevresinde 24 px çaplı boş daire | 24 |
| WCAG 2.5.5 AAA (R); Apple (bu oturumda doğrulanmadı) | 44×44 | 44 ≈ 6,8–7,9 mm |
| Material (R) | 48×48 dp, hedefler arası ≥8 dp | 48 ≈ 7,4–8,6 mm |
| Parhi 2006, başparmak (A) | 9,2–9,6 mm | ≈ 51–62 |
| NN/g (A) | ≥1×1 cm; birincil eylemde ~2 cm; hedefler arası ~2 mm | ≈ 56–65 |
| XAG 107, mobil oyun dokunmatik kontrolleri (R) | telefonda 15×15 mm, tablette 24×24 mm | ≈ 83–97. XAG bunu oyun kontrolleri için söylüyor; menü arayüzüne uygulanmaz. Bu ayrım benim yorumum (H) |
| Yaşlılar (A, küçük örneklem) | 4,9 mm hedefte hata oranı %62 (gençlerde %25); 9–10 mm'de anlamlı düşüş | ≈ 56 |
| Küçük çocuklar (NN/g, A) | 2×2 cm (3–5 yaş); 6–8 yaşta ince motor beceri hâlâ sınırlı | — |

**Kural:** Görsel boyut ile dokunma alanı ayrı şeylerdir. 24 px'lik bir ikon, çevresindeki padding ile 48 px'lik bir hedef olabilir. Sık kullanılan, geri alınması zor veya erişimi zor kontroller tabandan büyük olur (WCAG 2.5.5, Microsoft).

### 3.2 Hiyerarşi ve durumlar

- Bir ekranda tek bir birincil eylem olur. Öncelik renk, boyut, kontrast ve ışıkla ayrılır.
- Onay butonunda "Evet/Hayır" yazmaz, sonucun adı yazar ("Filoyu gönder" / "Vazgeç"). Varsayılan seçenek tehlikeli olan olmaz (NN/g, A).
- **Devre dışı buton nedenini söyler.** Tepki vermeyen gri bir buton kafa karıştırır (NN/g). Seçenekler iki tanedir:
  - Buton görünür ve dokunulabilir kalır, basınca neden açıklanır.
  - Buton devre dışıdır ve neden yanında yazar.

  Bizim kuralımız: "eksik koşul → mevcut/gerekli → sonraki adım" (`ux-writing.md` §7).
- **Eylem parmak kalkınca tetiklenir** (XAG 107). Yanlış yere basan oyuncu parmağını kaydırarak eylemi iptal edebilmelidir.
- Bekleme, geri sayım, kilitli, başarılı ve hata durumları birbirinden ayrı görünür. Bu konuda resmi bir standart bulunamadı, ama `ux-writing.md` §7 bu durumları zaten ayırıyor.

### 3.3 Zamanlama

| Olay | Süre | Kaynak |
|---|---|---|
| Anında tepki hissi | ≤100 ms | Nielsen, Google RAIL (R/A) |
| Akış bozulmaz | ≤1 sn; aşarsa ilerleme veya meşgul göstergesi | Nielsen (A) |
| Dikkat kaybı | 10 sn; yüzde ilerleme ve iptal yolu | Nielsen (A) |
| Buton basma animasyonu | ölçek 0,95–0,97, 80–160 ms, ease-out; bırakınca 1,02–1,03 aşıp 1'e döner | U |
| Arayüz geçişi | 150–300 ms (Material token'ları 50 ms ile 1000 ms arası; RuneScape'te savaşta 150 ms üstü ağır hissettirdi) | U/H |
| Uzun basma | 500 ms (Android varsayılanı) | R |
| Sürükleme eşiği | 8 dp | R |
| Basılı tutarak onay | Geri alınabilir eylemde 0,6–1 sn, geri alınamazda 1,5–2 sn. İlerleme dolumu gösterilir. Erken bırakmak iptal eder. XAG 2–3 sn ve üstünü sorunlu sayar ve dokunmayla yapılan bir alternatif ister. 2 sn tavanı benim önerim (H) | U + XAG 107 |
| Haptik tık | 10–20 ms, net ve kesik; titreyen uzun haptik hiç haptik kullanmamaktan kötüdür | Android (R) |

- **Haptik kuralları (R):** Şiddet olayın önemiyle orantılıdır. Aynı etkileşim her seferinde aynı titreşimi verir. Haptik ses ve görüntüyle aynı anda gelir. Fazla titreşim oyuncuya "aktüatör bozuk" hissi verir ve haptiği kapatmasına yol açar.
- **Hata önleme (NN/g, Baymard; A):**

  | Eylem tipi | Yaklaşım |
  |---|---|
  | Sık ve düşük riskli | Kesintisiz uygula, geri alma sun |
  | Nadir ve geri alınamaz | Niyeti kanıtlayan ikinci adım: basılı tutma, kaydırma veya yazarak onay |
  | Rutin | Onay sorulmaz; sürekli onay "kurt geldi" etkisi yaratır ve oyuncu okumadan geçer |

- **Jest erişilebilirliği (WCAG 2.5.7, GAG):** Sürükleme gerektiren her işlem dokunarak da yapılabilmelidir. Basılı tutma yerine dokun-aç/dokun-kapa seçeneği büyük fark yaratır.

---

## 4. İkon mu metin mi

### 4.1 Araştırma

- **Evrensel ikon sayısı:** Yalnızca ev, büyüteç ve yazıcı herkesçe tanınır. Hamburger menü hâlâ evrensel değil. Kalp ve yıldız sık karıştırılır (NN/g, A).
- **Beş saniye testi:** Bir ikonun anlamını düşünmek 5 saniyeden uzun sürüyorsa ikon anlam taşımıyordur (NN/g, A).
- **NN/g mobil çalışması (96 kişi; A).** Görev, listede duruma göre öğe bulmaktı. Buton etiketleri test edilmedi.

  | Gösterim | Görev süresi | Doğruluk |
  |---|---|---|
  | Yalnız metin | 22 sn | %76 |
  | Renk ve ikon birlikte | 14 sn | %85 |

  - Yalnız metin %57 daha yavaş. Renk ve ikon süreyi %36 kısaltıyor.
  - Yalnız ikon, yalnız renkten biraz daha hızlıydı.
- **Buton bağlamında ters sonuç (A, ikincil):** Bir LMS çalışmasında en kötü sonucu yalnız ikon verdi. İkon + metin ile yalnız metin arasında fark yoktu.
- **Ders:** Durumu tarayarak bulmak için renk ve ikon iyidir. Eylem butonu için metin, ya da ikon + metin gerekir.
- **Öğrenme hızlandırır:** Tanıdık ikonları bulma süresi ikinci turda yarıya iner (U, 6 kişi). Kaynak ikonları gibi sürekli görülen ve sayıyla eşleşen ikonlar etiketsiz kalabilir, ama bunu doğrudan ölçen bir çalışma yok (H).
- **Etiket hover'a bağlanamaz:** Dokunmatik ekranda hover yoktur. Etiket görünür olmalıdır (NN/g).
- **Kritik bilgi gizlenmez:** Kararı değiştiren bilgi bir ⓘ arkasına saklanmaz. ⓘ kural ayrıntısı içindir (NN/g).
- **Kademeli açıklama en fazla 2 seviye derine iner (NN/g, A).** Üçüncü seviyede oyuncu kaybolur.
- **Etkili tutorial:**
  - Kural, uygulanabildiği anda öğretilirse etkilidir (Kao 2021, CHI PLAY; A).
  - Tutorial'ın etkisi oyunun karmaşıklığına bağlıdır. En karmaşık oyunda oynama süresini %29, ilerlemeyi %75 artırdı. İki basit oyunda etkisi ihmal edilebilir kaldı. Biz karmaşık bir strateji oyunuyuz, bu yüzden tutorial bizim için önemlidir.
  - Metne eklenen uzamsal ipucu (ok, vurgu) yalnız metinden daha iyi öğretir.
  - Göz izleme çalışmasında oyuncular, takip etmeleri istense bile rehber bilgisinin çoğunu kaçırdı (E).
- **Okuma oranı:** Kullanıcı metnin en fazla %28'ini, genellikle %20'sini okur. Her 100 ek kelime 4,4 sn ek okuma süresi demektir (NN/g, A). Veri 2005 tarihli, web sayfalarından ve okuryazarlığı yüksek 25 katılımcıdan geliyor. Oyuncuya genellemek bir varsayımdır.

### 4.2 Hangi durumda hangisi

| Durum | Tercih |
|---|---|
| Sık görülen, öğrenilmiş, sayıyla eşleşen (kaynak, süre, güç) | Etiketsiz ikon + sayı |
| Gezinme, ilk karşılaşma, soyut kavram | İkon + her zaman görünür kısa etiket |
| Eylem fiili, kritik karar, geri alınamaz işlem | Metin (fiil + nesne). İkon yalnızca destekler |
| Durum (tehdit, fırsat, kilit) | Renk + şekil/ikon. Ayrıntı satırda metin olarak |
| Kural ve koşul | Satırda olgu + dokununca açılan sheet'te kural |

### 4.3 Ekran tipine göre metin miktarı

Bu tablo kaynaklardan türetildi. Sayılar çoğunlukla uygulayıcı kaynaklıdır.

| Ekran | İkon/metin | Metin miktarı |
|---|---|---|
| HUD | İkon + sayı | 0 cümle |
| Alt gezinme | İkon + 1 kelime etiket | 4–5 sekme |
| Liste satırı | Görsel + ad + 1–2 değer | 1 olgu satırı. Ayrıntı dokununca açılır |
| Detay sheet'i | Etiketli değerler + kısa kural satırı | Blok başına 1–3 cümle; paragraf en fazla 2–4 cümle (`ux-writing.md` §4) |
| Bilgi ipucu | Metin | 1–2 cümle (≈50–100 karakter) |
| Tutorial adımı | Eylem + ok/vurgu | 1 kısa cümle. Öğretme metinle değil eylemle olur |
| Onay | Metin | Başlık + 1 cümle (bedel ve geri alınabilirlik). Butonda fiil |
| Hata veya engel | İkon + metin | Ne oldu + ne yapmalı. 1–2 cümle |
| Ödül ekranı | Görsel + sayı | 0–1 cümle |
| Push bildirimi | Metin | Ana mesaj ilk 40 karakterde |
| Savaş raporu | Sayı özeti + açılır ayrıntı | Üstte 1 özet satırı, ayrıntı katmanda |
| Boş durum | Küçük görsel + metin + eylem | 1 cümle + 1 buton (NN/g) |

### 4.4 Rozetler

- Rozet yalnızca oyuncunun bir şey yapması gerekiyorsa görünür. Ziyaret edilince kalkar.
- Sayının önemli olmadığı yerde nokta kullanılır. Sayı 99'u geçince "99+" yazılır.
- Clash of Clans yeniden tasarımında kırmızı nokta yalnızca gerçek bir neden olduğunda çıkıyor. Hatalı bir "FREE" rozeti oyuncu güvenini bozdu ve Supercell özür diledi (E).

---

## 5. Renk

### 5.1 Oran ve sayı

- **60-30-10 (NN/g, A):**

  | Pay | Rol |
  |---|---|
  | %60 | Baskın, nötr zemin |
  | %30 | İkincil: paneller ve metin |
  | %10 | Vurgu: yalnızca öne çıkması gereken şey |

- **Ton sayısı:** Palet üç ana renk tonuyla sınırlanır (NN/g). Daha fazla çeşitlilik açık-koyu tonlarla sağlanır, yeni bir ton eklenmez. NN/g anlam taşıyan renkleri (tehdit, başarı) bu sayıma katıp katmadığını belirtmiyor. Biz onları saymıyoruz, ama onlar da az kullanılmalı (H).
- **Anlamı olan renk her yerde aynı anlamı taşır (NN/g).** Clash Royale'de sarı birincil eylem ve ödül, yeşil ikincil eylem, kırmızı bildirim, mavi zemin anlamına gelir. Ücretsiz sandığın sarı yapılması "sarı = en önemli eylem" kuralını bozdu ve eleştirildi (E/U).
- **Fazla vurgu hiyerarşiyi siler.** Elite Dangerous oyuncuları tek bir neon turuncunun ekranı kaplamasından şikayet etti ve renk modları yaptı (U).

### 5.2 Kontrast

| Kural | Değer |
|---|---|
| Metin (WCAG 1.4.3 AA, XAG 102) | 4,5:1 |
| Büyük metin (≥24 px veya ≥18,5 px kalın) | 3:1 |
| UI bileşeni ve anlam taşıyan grafik (1.4.11) | 3:1 |
| Devre dışı metin | WCAG muaf tutar; XAG 3:1 ister |
| Yüksek kontrast modu (XAG) | 7:1 |
| APCA (WCAG 3 adayı) | Gövde Lc 75–90. Siyaha yakın zeminde WCAG 2 kontrastı olduğundan iyi gösterir |

- **Değişken zemin:** Görsel üzerindeki metinde kontrast, metnin arkasındaki gerçek zemine göre ölçülür (F83). XAG'e göre ölçüm zeminin en kötü bölgesinde yapılır.
- **Koyu tema (Material, R):**
  - Saf beyaz koyu zeminde "titrer". Metin opaklıkları: vurgulu %87, orta %60, devre dışı %38.
  - Doygun renkler koyu zeminde titrer. Daha açık ve daha az doygun tonlar (Material'in 200 tonları) kullanılır.
  - En alt zemin #121212 seviyesidir. Yükselti, yüzeyin açıklığı artırılarak gösterilir.

### 5.3 Renk körlüğü

- **Yaygınlık:** Erkeklerin ~%8'i, kadınların ~%0,5'i. En yaygın tip deuteranomali (erkeklerde ~%5). Tritanopi ~1/10.000'dir (A).
- **WCAG 1.4.1 ve XAG 103 (R):** Renk tek başına bilgi taşımaz. Şekil, ikon, desen veya metin eklenir. Örnekler:
  - Sea of Thieves kilit ikonu kullanır.
  - Grounded kırmızı üçgen + "Eksik malzeme" yazısı + kırmızı sayıyı birlikte gösterir.
- **GAG (R):**
  - İki takım veya iki durum için turuncu-mavi ve açık-koyu farkı kullanılır.
  - Tasarım hafif değil, %100 şiddetteki renk körlüğüne göre test edilir.
- **Oyun örnekleri:** EVE Online, Forza ve Battlefield renk körlüğü ön ayarı ve özel renk seçimi sunar. EVE yalnızca arayüz vurgularını dönüştürür, 3D sahneye dokunmaz (E).

### 5.4 Uzay ve bilimkurgu arayüzüne özel

- **Sık yapılan hatalar (U):**
  - İnce çizgiler koyu panelde kaybolur.
  - Düşük opaklıklı holografik paneller metni bulanıklaştırır (Dead Space Remake eleştirisi).
  - Neon vurgu düşük kontrast verir.
  - Dekoratif HUD kalabalığı oluşur.
- **İyi örnekler (E):**
  - Half-Life 2 tek renkli kehribar paleti bir kimliğe dönüştürdü.
  - HUD tasarımında değer renk yerine parlaklıkla kodlanır, öğe komşularından ayrılır.
- **EVE Echoes (E):** Yavaş savaş temposu dokunmaya uygun bulundu. Eleştiriler: küçük ikonlar, çok sayıda menü, arayüz ölçekleme veya taşıma yok. PC'nin bilgi yoğunluğunu mobile taşımanın bedelini ödedi.

---

## 6. 7'den 70'e anlaşılırlık

### 6.1 Bilişsel temel

- **Çalışma belleği yaklaşık 4 bilgi grubudur (aralık 3–5).** Miller'ın 7±2 değeri kaba bir tahmindi (Cowan 2001, A). Bir karar ekranı aynı anda 3–5 bilgi grubu ister.
- **Okuma seviyesi:**
  - GOV.UK 9 yaşı hedefler, çünkü en düşük okuryazarlığa ulaşmak ister. Uzman kullanıcılar da sade dili tercih eder.
  - XAG'e göre kritik arayüz metni ortaokul seviyesini aşmaz.
  - Cümle ortalaması yaklaşık 20 kelime olur (plainlanguage.gov; Oregon 14–20). Bizim kuralımız da bunu söylüyor (`ux-writing.md` §4).
- **Türkçe ölçüm:** Ateşman okunabilirlik puanı = 198,825 − 40,175 × (kelime başına hece) − 2,610 × (cümle başına kelime).
  - 70–89 "kolay", 90–100 "çok kolay" sayılır.
  - Arayüz metni için ≥70 hedefi bir öneridir, kaynağı yok (H).
  - Formül paragraflar için tasarlandı. Bir ile üç kelimelik etiketlerde anlamsızdır. Yalnızca açıklama metinlerinde kullanılır.
  - Bezirci–Yılmaz ölçeği ters yönde çalışır; iki ölçeğin eşikleri birbirinin yerine kullanılamaz.
- **Hodent'in UX modeli:** Kullanılabilirlik ile katılım birlikte ele alınır. Katılım motivasyon, duygu ve akıştan oluşur. Kullanılabilirlik sütunlarından "işaretler ve geri bildirim" doğrulandı (U).

### 6.2 Yaş gruplarına göre gereksinimler

| | 7–12 | 13–59 | 60+ |
|---|---|---|---|
| **Metin** | Okumaya yeni başlar. Bilgi ikon, ses ve animasyonla taşınır | Sade dil, ≤20 kelime | Aynı sade dil. Metodik okur, ifade tutarlı olmalı |
| **Yazı boyutu** | Büyük x-yüksekliği ve büyük punto yardımcı olur | Gövde 14+ px | ≥12 pt (NN/g), ölçekleme ayarı |
| **Dokunma** | 6–8 yaşta ince motor beceri sınırlı; büyük hedef | 44–48 px | 9–10 mm; küçük hedefte hata oranı 2,5 kat |
| **Bellek** | 3–4 grup; ikon destekli | 4±1 grup | Hafıza yeteneği %49 (kontrol grubunda %63); hatırlatma ve özet gerekli |
| **Hata** | Risksiz pratik alanı | Geri alma | Net hata mesajı; %90'ı hatayı kendine yükler |
| **Yeni şey denemek** | Meraklı | Orta | %45'i çekinir; ~30 sn daha erken bırakır; risksiz deneme alanı şart |

65 yaş üstü kullanıcılarda görev başarısı %55 (kontrol grubunda %75), süre 7:49 (5:28) ve hata sayısı 2,4 (1,1) oldu (NN/g 2013, A). Çalışma web üzerinde yapıldı, oyun üzerinde değil.

Oyuncu yaşı: ABD'de ortalama oyuncu 37 yaşında, oyuncuların %29'u 50 yaş üstü. Mobil oynama oranı 2012'de %33'tü, 2024'te %78'e çıktı (U, ESA haberi).

### 6.3 Mekaniği anlatmak

- **Into the Breach (E):** Düşman saldırıları tur başında açıkça gösterilir, oyuncunun seçeneklerinde zar yoktur. Kayıp oyuncuya "benim hatamdı" diye hissettirir.
- **XCOM (E):** Oyuncu gösterilen yüzdeleri duygusal okur. Jake Solomon: "%85'i görenler %15 kaçırma şansı görmüyor." Kolay modda gerçek şans gizlice yükseltildi.
- **Bizim için ders:** "Girdileri ve kuralı ver, cevabı verme" ilkesi bu iki kutbun arasında durur. Kesin yüzde yerine karşılaştırmalı girdiler gösterilir ("sen ↔ hedef") ve sonuç bir aralık veya etiketle verilir ("üstünlük", "belirsiz"). Bu yaklaşım ayrıca araştırılmadı; tasarım önerisidir (H).
- **Clash of Clans (E):** Kilitli öğeye dokunan oyuncuyu kamera kilidi açan binaya götürür ve ne gerektiğini söyler. Kural tam kullanıldığı anda öğretilir.
- **Marvel Snap (E):**
  - Önce tek lokasyon gösterilir. Enerji ilk galibiyetten, "Snap" birkaç saat sonra açılır.
  - Kural kartların açılma sırasıyla öğretilir.
  - Yeni oyuncunun ilk turda oynayacak kartı kalmasın diye açılış eline hep aynı kart konur.
- **Whiteout Survival (E):** Harita ilk ~90 dakikada kapalıdır, ama Dünya butonu görünür ve "yakında" ipucu verir.
- **Clash Royale:**
  - 5 kısa tutorial vardır (E).
  - Aşağıdaki gözlemler tek bir uygulayıcı yazısından gelir (U):
    - PvP 7 galibiyetten sonra açılır.
    - Popup'lar tam ekran olmaz ve arka plana dokunmak onları kapatır.
    - Menüler bir seviyeden derine inmez.
    - Bir oturumda en fazla bir popup çıkar.
- **Rise of Kingdoms (E):** Whiteout Survival'ın tersini yapar. İlk deneyimin ikinci eylemi haritada bir kampa birlik göndermektir, yani harita oyunu hemen başlar. İki oyun da başarılı, bu yüzden haritayı erken veya geç açmak bir tasarım tercihidir. Bizim "ilk akına giden yol" planımız RoK'a yakındır.
- **Royal Match (E):** A/B/C testlerinde hafif meta, en yüksek tutma ve etkileşimi verdi.
- **Genshin (E):** Bütün sistemler açıldıktan sonra yeni bir sistem gelmedikçe tutorial çıkmaz. Savaş HUD'ının özelleştirilememesi eleştiriliyor.
- **Nintendo'nun 4 adımı (U, analist yorumu):** Tanıt → geliştir → beklenmedik bir dönüş ekle → sonuçlandır. Super Mario 1-1 metin kullanmadan öğretir.
- **GAG bilişsel maddeleri (R):**
  - Basic seviye:
    - Etkileşimli tutorial.
    - Metin oyuncunun hızında ilerler.
    - Sade dil.
    - Titreşen görüntü ve tekrarlı desenden kaçınılır.
  - Intermediate seviye:
    - Kritik bilgi yalnızca metinle verilmez.
    - Etkileşimli öğenin etkileşimli olduğu belli olur.
    - Bağlamsal yardım.
    - Hatasız pratik alanı.
    - Kontrol ve hedef hatırlatması.
    - Arka plan hareketini kapatma seçeneği.

### 6.4 Test

- **NN/g (A):**
  - İlk 5 kullanıcı sorunların yaklaşık %85'ini bulur.
  - 15 kişilik tek tur yerine 5 kişilik 3 tur daha verimlidir.
  - Ayrı kullanıcı grupları varsa her gruptan 3–4 kişi alınır.
- **Bize uygulanışı:** 7–12, 13–59 ve 60+ gruplarından 3–4'er kişi. Wiki yasak (owner kuralı).

### 6.5 Bir yazı, buton, eleman veya mekanik için anlaşılırlık kontrolü

1. 5 saniyede ne olduğu anlaşılıyor mu? (İkon testi)
2. Dokunmadan, dokunulabilir olduğu belli mi?
3. Metin en az 11 px mi (okunan cümle 13–14 px)? En kötü zeminde 4,5:1 kontrastı tutuyor mu?
4. Renk dışında ikinci bir kanal var mı (şekil, ikon, metin)?
5. Kural karar anında ve en fazla bir dokunuş uzaklıkta mı?
6. Ekranda aynı anda 5'ten fazla bilgi grubu var mı?
7. Cümle 20 kelimenin altında mı, jargonsuz mu? 9–12 yaş okuyabilir mi?
8. Oyuncu sonucu tahmin edebiliyor ama kesin bilemiyor mu? (Predictability)
9. Yanlış dokunuş geri alınabiliyor veya iptal edilebiliyor mu? Geri alınamaz eylem ikinci bir adım istiyor mu?
10. Tepki 100 ms içinde geliyor mu? Ses kapalıyken sonuç görülüyor mu?

---

## 7. Benchmark'tan çıkan dersler

| Oyun | Ders |
|---|---|
| Clash of Clans 2024 (E) | "Daha az buton değil, doğru buton doğru yerde." Savaş ve İnşa butonları alt köşelere simetrik yerleşir. Her İnşa sekmesi yalnızca orada harcanabilen kaynağı gösterir. Kırmızı nokta yalnızca gerçek bir nedenle çıkar. Oyuncu şikayetleri: fazladan dokunuş, kalıcı olmayan filtre, arayüz ölçekleme isteği. |
| Clash Royale (E/U; S22 ölçümü §7.2) | Kritik kontroller ekranın alt yarısında. Kalıcı 5 sekme. Popup bir seviye derinlikte ve arkası görünür. Oturum başına bir popup. Renk dili tutarlı. |
| Marvel Snap (E) | Kurallar kademeli açılır, açılış sırası öğretir. Kartlar canlı: telefonun eğimine göre paralaks ve haptik. Eleştiri: çok sayıda para birimi ve karmaşık koleksiyon sistemi. |
| Whiteout Survival / Last War (E) | Harita kilitli ama görünür. Eleştiri: sayısız popup, yoğun etkinlik takvimi, sayaç baskısı. |
| EVE Echoes (E) | Uzay oyununda bilgi yoğunluğunun bedeli: küçük ikon, çok menü, ölçekleme yok. |
| Ortak kalıp | Koyu veya mavi zemin üzerinde parlak sıcak eylem rengi, kalıcı alt eylem bölgesi, sığ menüler, kademeli açılış, her dokunuşa canlı tepki. |

### 7.1 Rakip ölçümü: S22 ekran görüntüleri (2026-11-11)

**Kaynak ve kapsam:** Owner'ın S22'sinden 116 görüntü alındı (plan §1.13).

- **Oyunlar:** Whiteout Survival 55 (dikey, Türkçe), Clash of Clans 36 (yatay, Türkçe), Star Trek Fleet Command 24 (yatay, İngilizce).
- **Ölçülen ekranlar:**
  - Whiteout: 10 ekran (ana ekran, yükseltme, onay, ayarlar, posta, ittifak, eğitim, görevler, mağaza, savaş sonucu).
  - Clash of Clans ve Star Trek: ikişer ekran.
  - Bizim filo gönderme ekranımız, aynı yöntemle.

**Cihaz:**

- 1080×2340, yoğunluk 480 (1 dp = 3 px), 428,6 × 424,5 dpi.
- Yazı ölçeği 1,0.
- S22'deki Chrome'da 1 CSS px = 1 dp. Bu yüzden aşağıdaki dp değerleri bizim px değerlerimizle doğrudan kıyaslanabilir.

**Yöntem:** Kırpılan satırın mürekkep yüksekliği ölçülür ve yazının biçimine göre font boyutuna çevrilir (`packages/ui-audit/src/competitor.ts`).

- **Tekrar:** `pnpm ui:audit competitor --spec reports/ui-audit/competitors-2026-11-11.spec.json`.
- **Girdi ve sonuç:** Kutular `*.spec.json` içinde, 109 ölçüm `competitors-2026-11-11.json` içinde.
- **Göz kontrolü:** Kırpıntılar `out/competitors/check-*.png` içinde.

- **Kalibrasyon:** Yöntem bizim Archivo yazımızda gerçek CSS boyutundan en çok %7 sapıyor (9 px → 9,0; 10 px → 10,0; 18 px → 18,8).
- **Kontur:** Rakiplerin konturlu ve gölgeli yazısı tahmini biraz büyütür.
- **Butonlar:** Renk geçişli butonlarda dolgu yöntemi yalnız üst yarıyı buldu. Bu butonların ölçüsü cetvelli görüntüden okundu (±3 dp, "görsel" diye işaretli).

**Font boyutu tahmini (dp = bizim px'imiz):**

| Rol | Whiteout (dikey) | Clash of Clans | Star Trek | Astera (filo gönderme) |
|---|---|---|---|---|
| En küçük (meta: tarih, rozet, sıkıştırılmış sekme) | 9–10 (posta tarihi 9,3; "Kahramanlar" sekmesi sığdırmak için küçültülmüş 8,8; seviye rozeti 9,7). "Ödülleri al" önce 9,1 ölçülmüştü; Ö noktaları dahil edilince 11,7 (aşama 1 review düzeltmesi) | — | 9,5–10,6 (sohbet 9,5; "MISSION OBJECTIVE" 9,7; ikon etiketi 10,6) | **9** (üst satır, notlar, "Varış") |
| Etiket ve kısa değer | 10–12 (sayaç 10,2; seçenek 10,6–11,1; "60sn" 11,1; "Tüm diller" 12,5) | 13–14 (sayaç 13,0; kaynak 13,9) | 13–15 | **10** (gemi adı, "Maks") |
| Okunan cümle | **12–14** (görev 11,6; açıklama 11,9; onay metni 12,3; ayar açıklaması 13,3; posta başlığı 14,0; görev satırı 14,0) | 12,3 (onay metni); konuşma balonu 11,6 | 14,7 (ipucu) | **10** ("Bu hedefe karşı tartmak için gemi seç.") |
| Eğitim/diyalog | **17,2** (diyalog satırı); konuşan adı 21,8 | 11,6 (balon, kalın) | — | — (uçuş okulu ayrıca ölçülecek) |
| Pencere/ekran başlığı | 16,5–19 | 19,6 | 14,8–18,5 | 18 ("Tharsis") |
| Buton yazısı | **14,8–19,3** (Yükselt 14,8; Başvur 15,4; Topla 16,1; Onayla 19,3) | ~25 (Yükle) | 22,7 (SCAN) | **12** ("Filonu seç") |
| Önemli sayı | 12,5–14,4 (HUD); maliyet butonda 21,3; fiyat 17,1 | 13,9 | 15,7 (güç) | 16,7 (sayaç değeri) |

**Buton ve satır ölçüleri (dp):**

- **Whiteout:**
  - Butonlar: "Yükselt" 83×38 (ikon ve maliyet içinde), "Onayla" 129×36, "Başvur" 84×30, "Ayarlama" 77×29, "Topla" ~77×33 (görsel), posta ikonu 46×35.
  - Alt menü: 50 yüksek.
  - Liste ve kartlar: posta satırı ~65 (72 aralıkla), mağaza kartı ~96×123 (görsel).
- **Clash of Clans:** "Yükle" ~122×53 (görsel).
- **Star Trek:** "SCAN" ~140×30 (görsel).
- **Astera:** "Filonu seç" 322×42, yalnız çerçeve, dolgu yok.

**Renk rolleri (gözle):**

- **Whiteout:**
  - Mavi panel, krem kart.
  - Yeşil: topla ve katıl.
  - Mavi: normal eylem.
  - Kırmızı: rozet, indirim ve kilit notu.
  - Altın ve turuncu: başlık ve ödül.
- **Clash of Clans:** Yeşil onay, turuncu-kırmızı iptal, krem panel ve kahve kenar.
- **Star Trek:** Koyu uzay zemin; mavi tara, yeşil saldır, turuncu premium.
  - Bize en yakın olanı bu. Yine de etiketleri bizimkinden kalın ve büyük.

**Çıkarımlar:**

1. **Fark en küçük yazıda değil, cümlede ve butonda.** Whiteout da tarih ve rozet gibi meta bilgide 9–10 dp kullanıyor. Ama okunan cümleleri 12–14 dp, bizimkiler 10 px. Buton yazıları 15–19 dp, bizimki 12 px. Bu sonuç §8.1'deki (c) önerisini destekliyor:
   - meta 9–10 kalabilir;
   - karar verdiren etiket en az 11 olur;
   - cümle 13–14 olur;
   - birincil buton yazısı 15 ve üstü olur.
2. **Boyut kadar ağırlık.** Rakiplerin hemen bütün yazısı kalın; resmin üstünde konturlu ve gölgeli. Aynı boyuttaki yazı bu yüzden onlarda daha büyük ve "oyun gibi" okunuyor. Yazı tipi ve ağırlık kararı, boyut kararıyla birlikte verilmeli (plan: "oyun arayüzü dili").
3. **Eğitim metni büyük.** Whiteout'un rehber diyaloğu 17 dp; ilk deneyimde metin okutmanın bedelini boyutla ödüyor.
4. **Butonlar 44 dp'nin altında olabiliyor ama yalnız duruyor.** Whiteout'ta ikincil butonlar 29–38 dp yüksek; aralarında geniş boşluk var ve kendileri geniş (77–129 dp). Kural "küçük ve sık" değil, "geniş ve ayrık".
5. **Birincil eylemin içinde bilgi var.** "Yükselt" butonu maliyeti, "Topla" ödülün yanında duruyor. Karar ve eylem aynı yerde.

**Eksikler:**

- Rise of Kingdoms çekilmedi. Clash Royale aynı gün çekildi (§7.2).
- Clash of Clans ve Star Trek yatay oyunlar; yerleşim dersleri sınırlı, yazı ve buton dersleri geçerli.
- Rakiplerde ekran başına ton sayısı otomatik sayılmadı. İllüstrasyonda renk geçişleri tonları birbirine bağlıyor; bu yüzden renk rolleri gözle not edildi.

### 7.2 Clash Royale ölçümü (dikey, Türkçe, 2026-11-11)

**Kaynak:** Owner'ın S22'sinden 33 görüntü, 15:44–15:53. Yeni hesap, eğitim süreci açık.

- Görüntüler `out/competitors/2026-11-11/clash-royale/` içinde (git dışı).
- **Ölçülen 10 ekran:** ana ekran, kart yükseltme sonucu, kart penceresi, mağaza, eğitim penceresi, ayarlar, sıralama, klan, klan sohbeti, menü.
- **Tekrar:** `pnpm ui:audit competitor --spec reports/ui-audit/competitors-clash-royale-2026-11-11.spec.json`. 103 ölçüm `competitors-clash-royale-2026-11-11.json` içinde.
- **Yöntem:** §7.1 ile aynı.
  - Renk geçişli butonlarda dolgu noktası parlak bandın dışına, butonun alt gövdesine kondu. Böylece bütün butonlar ölçümle bulundu, gözle okunan yok.
  - Her ölçüm göz kontrol sayfasında (`out/competitors/check-competitors-clash-royale-2026-11-11.png`) cetvelli kırpıntıyla karşılaştırıldı.
- **Font:** Clash Royale'in yazısı çok kalın ve konturlu. Kontur mürekkebe dahil olduğu için tahmin gerçek font boyutundan biraz büyük çıkar. Gözün gördüğü boyut ise budur.
- **Yöntem düzeltmeleri (aşama 1 review'u, testli):**
  - **Eğik çizgi:** Araç "/" içeren satırı kuyruklu harf gibi (0,95 em) sayıyordu. Bizim Archivo'muzda bu doğru, ama Supercell'in yazısında "/" büyük harf boyunda kalıyor. Bu yüzden "1/3" gibi sayaçlar %25 küçük çıkıyordu (9,1 → 12). Biçimi yazıya göre değişen satırlarda spec artık biçimi kırpıntıya bakılarak söylüyor (`shape`).
  - **Ayrık işaret:** "İ" noktası ve "Ö" noktaları harften ayrık durunca araç onları ayrı satır sayıp atıyordu. Üst işaretli satırlarda artık işaret satıra dahil. Yalnız iki Whiteout satırı değişti: "Ödülleri al" 9,1 → 11,7; "İttifaka Katıl" 12,1 → 15,2.
  - **Kesik kutu:** "discord.gg/hog" kutusu harf kuyruklarını kesiyordu (8,4 → 10,5); düzeltildi.

**Font boyutu tahmini (dp = bizim px'imiz):**

| Rol | Clash Royale | Whiteout (§7.1) | Astera (filo gönderme) |
|---|---|---|---|
| En küçük (rozet, alt satır) | **7–10** ("ENDERLİK" 7,2; süre 9,5; "Klan yok" 9,8; bağlantı 10,5) | 9–10 | 9 |
| Etiket ve kısa değer | 11–14 ("Ses" 11,1; üye rolü 11,6; sayaç "1/3", "3/4" 12, "2/2" 13; istatistik etiketi 13–18,5; menü öğesi 13,9–14,0) | 10–12 | 10 |
| Okunan cümle | **10–12,6** (ana ekran alt cümlesi 10,2; ayar açıklaması 11,2; ipucu 11,2–11,6; eğitim açıklaması 12,6; sohbet mesajı 12,6) | 12–14 | 10 |
| Eğitim balonu | 15,1 | 17,2 | — |
| Pencere/ekran başlığı | 18,9–26,7 (Ayarlar 18,9; En İyi Asiller 19,6; Şövalye 21,8; Royale Taktikleri! 26,7; ödül ekranında 33,7) | 16,5–19 | 18 |
| Buton yazısı | **15–25** (BAĞLAN 15,2; Bağış Yap 15,4; Katıl 19,9; TAMAM 22,2; Savaş 23,9; Kullan 24,5). Ayar butonları 12,6 | 14,8–19,3 | 12 |
| Önemli sayı | 16–27 (kaynak 16,7–21,3; puan 16,7; artış "+7" 25; istatistik değeri 26,9) | 12,5–21,3 | 16,7 |

**Buton ve satır ölçüleri (dp, görünen gövde):**

| Öğe | Ölçü | Yer |
|---|---|---|
| Birincil "Savaş" | **120×62** | Alt orta, alt menünün hemen üstü |
| Pencere butonları ("Kullan", "Yükselt", "BAĞLAN") | 73–102 × 40–43 | Pencerenin altı |
| Alt butonlar ("Kart İste", "Dostluk Savaşı", "TAMAM") | 84–87 × 34–36 | Sohbetin altı |
| Menü öğesi | 145×34–35 | Açılır menü |
| Sekme ("Küresel") | 99×32 | Sıralama penceresi |
| Klan "Katıl" | 78×31 | Klan penceresi |
| Satır butonu "Bağış Yap" | 73×24 | Sohbet kartı |
| Ayar butonları ("Ses", "Hizmet Koşulları", "API") | **140–142 × 23–24** | Ayarlar |
| Kapat (X) | **22–24 × 22–24** | Pencerenin sağ üst köşesi |
| Profil ve menü butonu | 37×37 | Ana ekran üstü |
| Liste satırı (sıralama, üye) | 319×46 | Tam genişlik |

Görüntüden yalnız görünen gövde ölçülür. Oyunun dokunma alanını görünenden büyük tutup tutmadığı bilinemez.

**Kelime sayısı:** Görünen ekrandaki kelimeler elle sayıldı. Sayma kuralı aracınkiyle aynı: harf veya rakam içeren her parça bir kelime. Sayılar spec'te `words` alanında.

| Ekran | Kelime |
|---|---|
| Kart penceresi | 12 |
| Kart yükseltme sonucu | 13 |
| Menü | 16 |
| Ana ekran | 23 |
| Mağaza | 26 |
| Sıralama | 34 |
| Klan | 45 |
| Eğitim penceresi | 48 |
| Ayarlar | 49 |
| Klan sohbeti | 53 |
| **Ortanca** | **30** |

**Renk rolleri (gözle):**

- Sarı-turuncu: birincil eylem ("Savaş", "Kullan").
- Yeşil: ilerleme ve gelişme ("Yükselt" maliyetle birlikte, "Katıl", ilerleme çubukları, klan olay satırları).
- Mavi: normal eylem ve panel.
- Mor: özel içerik (eğitim penceresi, kart isteği, "Dostluk Savaşı").
- Gri: ikinci derece veya o an yapılamayan eylem ("Ad Değiştir", "API Belirteci", yapılamayan "Bağış Yap").
- Kırmızı: yalnız kapat ve rozet.

**Çıkarımlar:**

1. **Clash Royale'in cümleleri bizimkinden büyük değil; 10–12,6 dp.** Fark şu üç şeyde:
   - Bütün yazı çok kalın ve konturlu. Aynı boyutta daha kalın çizgi daha kolay okunur.
   - Cümle az. Çoğu ekranda 0–1 cümle var; uzun açıklama yalnız eğitim penceresinde ve ayarlarda.
   - Hiyerarşi kontrastı büyük. "Savaş" buton yazısı 23,9 dp, yanındaki cümle 10,2 dp: 2,3 kat. Bizim filo ekranında buton 12, cümle 10: 1,2 kat.
2. **§8.1'deki (c) önerisine etkisi:** Whiteout cümlede 12–14 dp, Clash Royale 10–12,6 dp kullanıyor. İkisinin ortak yanı cümlenin boyutu değil, ağırlığı ve azlığı. Aşama 2 yazı kararı bu yüzden üç parçayı birlikte vermeli: taban boyut, yazı ağırlığı ve ekran başına cümle sınırı (§7.3). Buton ve başlıkta ise iki oyun da açıkça büyük: buton yazısı 15–25 dp, başlık 19–27 dp.
3. **Tek büyük birincil eylem, gerisi geniş ve kısa.** "Savaş" 120×62 dp ve alt ortada. Diğer butonlar 23–43 dp yüksekliğinde ama 73–145 dp genişliğinde ve aralarında boşluk var. §7.1'deki "geniş ve ayrık" kuralı Clash Royale'de de geçerli.
4. **Kapat butonu küçük ama tek ve hep aynı yerde.** 22–24 dp kırmızı X her pencerede sağ üst köşede. Oyuncu onu boyutundan değil yerinden ve renginden buluyor. Bizdeki kapat butonları için ölçülecek şey yer ve renk tutarlılığı; boyut kararı §8.2'deki dokunma alanı genişletmesiyle birlikte verilmeli.
5. **Alt menüde etiket yalnız seçili sekmede.** Seçili olmayan sekmeler yalnız ikon. Seçili sekme genişliyor ve adını gösteriyor ("Savaş", "Dükkan"). Etiket kelimesi ve yer tasarrufu sağlıyor, oyuncu yine de nerede olduğunu okuyabiliyor.
6. **Eğitim metinle değil işaretle.** Ana ekranda ve kart penceresinde, dokunulacak yeri hareketli bir el gösteriyor; yanında tek bir kısa balon cümlesi var. En uzun metin (48 kelime) ayrı bir "nasıl oynanır" penceresinde ve resimli örnekle birlikte.
7. **Maliyet butonun içinde.** "Yükselt" butonu maliyeti (5 altın) içinde taşıyor. Bu, Whiteout'taki örnekle aynı (§7.1 çıkarım 5).

### 7.3 Metin yükü: ekran başına kelime (2026-11-11)

Owner'ın sorusu: "Oyuncuyu yazıya ve bilgiye boğuyor muyuz?"

**Rakip ölçümü (görünen ekranda, elle sayıldı):**

| Oyun | Ekran başına kelime | Ortanca | Not |
|---|---|---|---|
| Clash Royale | 12–53 | **30** | §7.2 |
| Whiteout Survival | 13–130 | **55** | Yüksek değerler sayı ve etiketten geliyor: ana ekranda harita üstü bina adları 85; mağazada 10 kez aynı kilit notu ("Açmak için VIP Sv. 2 düzeyine ulaş") 130. Cümle çoğunlukla ayarlar (73) ve onay (27) ekranında. Diğer ekranlar: posta 83, ittifak 56, görevler 54, yükseltme 38, sonuç 17, eğitim 13. |

**Bizim ölçümümüz (aşama 1 başlangıç ölçümü, telefon, Türkçe):**

- 143 ölçüm; her biri bir yüzeyin bir giriş yolu (durumu).
- Kaydırılan sayfanın tamamında ölçüm başına kelime ortancası 103.
- **Ekran başına kelime:** ölçümün kelimesi ÷ kaydırma parçası sayısı. Ortanca **65**. 143 ölçümden 95'i 50'nin, 46'sı 80'in üstünde.
- **En yoğun ekranlar:**
  - üs hangarındaki klan desteği görünümleri (`gallery:support-hangar*`): 163–204;
  - etkinlik rehberi 172,5;
  - savaş raporu 146;
  - yeni bildirim merkezi 142;
  - arena ve Sessiz Uzay dönüşü 137;
  - klan destek sancağı 133;
  - uçuş el kitabı 132.
- **Uzun blok:** 6 veya daha çok kelimelik metin bloğu.
  - Bizde ekran başına ortanca 2, üst çeyrek 3,3. Hangar görünümlerinde tek ekranda 10–13.
  - Rakiplerde çoğu ekranda 0–1. Clash Royale'de eğitim penceresinde 4. Whiteout'ta ayarlarda 4; mağazada 10, ama hepsi aynı kilit notu.
- **Araçta:** Rapor bu sayıları "Metin yükü (W1)" bölümünde veriyor: ekran başına kelime, parça sayısı ve uzun blok (`report.ts`, testli). Bu bölüm ilk kez en sondaki tam yeniden ölçümde çıkacak. Yukarıdaki sayılar aynı tanımla bugünkü ham veriden hesaplandı; kelime sayımı kırpılma hatasından etkilenmiyor.

**Ölçüm sınırları:**

- Bir kaydırma parçası her zaman tam ekran değil; bir sheet'in kaydırma adımı olabilir. Ekran dolusu başına kelime bu yüzden yaklaşık bir değer.
- Sheet'in arkasında görünen HUD metni de sayılır. Rakiplerde de görünen her şey sayıldı, bulanık arka plan sayılmadı.
- Rakip sayıları tek bir anlık görüntüden; bizimki galeri ve istemci durumlarından. Oyun içindeki gerçek oturumda sayılar değişebilir.

**Sonuç:** Ekran başına kelimede Clash Royale'in yaklaşık 2,2 katı (65 / 30), Whiteout'un yaklaşık 1,2 katıyız (65 / 55). Asıl fark kelime sayısından çok cümle sayısında. Rakiplerin kelimeleri çoğunlukla ad, sayı ve etiket; uzun blok çoğu ekranda 0–1. Bizde kelimelerin yaklaşık yarısı (%48; ölçüm başına ortanca %39) 6 veya daha çok kelimelik bloklarda.

**Karar takvimi:**

- **Aşama 1 (bu aşama):** Ölçüm burada. Hangi ekranın ne kadar yüklü olduğu, rakip referansı ve cümle satırı sayısı.
- **Aşama 2 (metin bütçesi kararı):**
  - ekran tipine göre kelime ve cümle bütçesi (§4.3 tablosu bunun taslağı);
  - silinecek, kısaltılacak, kademeli açıklamaya (dokununca açılan sheet) taşınacak metin için kural.
- **Aşama 4 (uygulama):** Ekran ekran uygulama. Sıra en yoğun yüzeylerden başlar. Her ekranın önce ve sonra kelime sayısı aynı araçla ölçülür.

---

## 8. Astera'nın şu anki durumu: ölçülen farklar

Bu sayılar kaynak koddaki sınıf ve kural sayımıdır (2026-11-11), ekranda görülen metnin payı değildir. Bir sınıf koşullu bir dalda kalabilir veya karar vermeyen bir süs etiketinde kullanılıyor olabilir.

**Çalışan arayüzde ölçüm (aşama 1, `reports/ui-audit/baseline-2026-11-11.md`, telefon 350×812, tr ve en):** Aşağıdaki tablo kod sayımıdır; ekranda gerçekte görünenler şöyle:

- **Yazı:** 18.404 görünen metnin %73'ü 11 px'in, %79'u 12 px'in altında. 14 px ve üstü yalnız %7,5.
- **Kontrast:** Metinlerin %22'si (4.049) arka planın en kötü %5'lik diliminde WCAG eşiğini geçemiyor.
- **Dokunma:** 5.972 hedefin %77'sinin kısa kenarı 44 px'ten küçük; %16'sı 24 px'ten de küçük.
- **Basma tepkisi:** Basılan hedeflerin %96'sında 100 ms içinde görünür bir değişim yok.
- **Metin yükü:** Ekran başına kelime ortancası 65 (§7.3).

| Konu | Bizde | Araştırma | Durum |
|---|---|---|---|
| Yazı ölçeği | hero 46, readout 27, figure 18, title 16, label 11, **body 12, caption 10, micro 9** | Taban 11; okunan cümle 13–14+ | ❌ Ölçek küçük |
| Varsayılan | Sınıfı olmayan metin `body` boyutunda, yani 12 px (`styles.css`) | Gövde 14–17 | ⚠️ Sınırda |
| Sınıf kullanımı (TSX) | `text-micro` (9 px) **979**, `text-caption` (10 px) **937**, `text-label` (11 px) 145, `text-body` 150 | Okunacak metin ≥11 | ❌ En sık kullanılan iki sınıf taban altında |
| CSS'te sabit px boyutları | 11 px ×79, 12 px ×68, 10 px ×66, 13 px ×30, 9 px ×17, **8 px ×6, 7 px ×4**; 3D etikette `fontSize 9` ×2 | Taban 11 | ❌ 7–10 px'lik kurallar var |
| En zor kombinasyon | `text-micro` 70 yerde `uppercase`, 61 yerde `tracking-wide` ile birlikte | Küçük boyut + büyük harf okumayı en çok yavaşlatan ikilidir | ❌ |
| Kontrol boyutu sınıfları | Yükseklik sınıfları:<br>• 44 px: `min-h-11` 70, `h-11` 12<br>• 40 px: 40 + 17<br>• 36 px: 36 + 10<br>• 32 px: 31 + 4<br>• 28 px: `h-7` 9<br>Kare boyut sınıfları:<br>• 32 px: `size-8` 53<br>• 28 px: `size-7` 26<br>• 24 px: `size-6` 28 | Dokunma alanı ≥44, aralık ≥8 | ❓ Bunların hangisinin dokunulabilir olduğu ve gerçek dokunma alanı sayımla bilinemez. Çalışan arayüzde ölçülmeli |
| Metin kontrastı (plate #0c1321 üzerinde) | bone 17,3; dim 7,0; faint 4,7 (plate-hi'de 4,0); `text-threat` #e2412c **4,45** (plate-hi'de 3,8) | Metinde 4,5:1 | ⚠️ `text-threat` 41 yerde küçük metinde AA sınırının altında; `threat-ink` (10,6) zaten var. `faint` açık plakada sınırın altında |
| Clarity rampası | DEGRADED 3,1, BLIND 1,8 | — | ✅ Kasıtlı (`visual-design.md`); belirsizliği görünmezlikle anlatır |
| Renk körlüğü (Machado simülasyonu, tam şiddet, ΔE76; H) | Deuteranopi:<br>• threat↔opportunity ΔE 43 ✅<br>• **alloy↔deuterium ΔE 15**<br>• **threat↔alloy ΔE 16**<br>Tritanopi:<br>• crystal↔opportunity ΔE 7 | Renk tek başına bilgi taşımaz | ⚠️ Deuteranopide kaynak renkleri ve tehdit/alaşım ayrımı zayıf. Notlar:<br>• Simülasyon tam şiddet (dikromat) varsayar. En yaygın grup olan anomal trikromatlarda etki daha hafiftir.<br>• ΔE 15 iki renk yan yana dururken ayırt edilir, tek başına duran küçük bir ikonda karışır.<br>• İkon veya şekil eşliğinin her yerde olup olmadığı doğrulanmadı. |
| Zemin ve mürekkep | Zemin `void` #04060c, Material'in #121212'sinden koyu. Mürekkep `bone` #f3f7ff neredeyse saf beyaz (17:1) | Material: saf beyaz yerine ~%87 beyaz; WCAG 2 siyaha yakın zeminde kontrastı olduğundan iyi gösterir (APCA) | ℹ️ Uzay için koyu zemin tematik. Uzun metinde parlama riski düşük öncelikli |
| Opaklıklı metin | `text-bone/60–80`, `text-crystal/60–85` vb. ~22 kullanım | Opaklık kontrastı düşürür | ℹ️ Az; ölçümde dahil edilmeli |
| Yarı saydam plakalar | Plaka gövdesinde alfa var (I5) | Kontrast zeminin en kötü bölgesine göre ölçülür | ⚠️ Parlak gezegen veya nebula arkasındaki plakada kontrast ölçülmedi |
| Yan kenar boşluğu | 12 px (`px-3`) | Tipik 16 dp | ✅ Bilinçli yoğunluk kararı |
| Renk rolleri | Ton kategoriyi, parlaklık kesinliği taşır; parlama bir durum belirtir; commit stili ayrılmış | 60-30-10, vurgu yalnızca birincil eylemde | ✅ Araştırmayla uyumlu |
| Sayılar | Display font, tabular rakam, "ekranın en yüksek sesi" | Tabular rakam, büyük sayı | ✅ |
| Kural öğretimi | Satırda olgu, dokununca sheet; Wiki'ye güvenilmez | En fazla 2 seviye, karar anında | ✅ |
| Geri alınamaz eylem | İkinci adım (I3a) | Niyet kanıtı, basılı tutma ≤2 sn | ✅ (süreler ayrıca ölçülmeli) |

### 8.1 Owner kararı gerekenler

1. **Yazı ölçeğinin tabanı.** Bugünkü ölçek owner talimatıyla küçültüldü ve kompakt tasarım direktifine dayanıyor. Araştırmanın vardığı nokta şu: kompaktlık metin ve boşluk azaltılarak elde edilir, okunan metin 11 px'in altına inemez. Üç seçenek var:
   - (a) Taban yükseltilir: micro 9→11 (veya karar verdiren hiçbir metinde kullanılmaz), caption 10→12, body 12→14. Sonuç: 350 px'te satır taşmaları yeniden ölçülmeli.
   - (b) Varsayılan aynı kalır, Ayarlar'a "Yazı boyutu" eklenir: %100, %115, %130. XAG ve GAG ölçeklenebilir metin ister; bu, 60+ grubuna ucuz bir çözüm olur.
   - (c) **Önerim:** (a)'nın hafifi + (b). Okunacak hiçbir metin 11 px'in altında olmaz, açıklama cümleleri 13–14 px olur, ayar 60+ grubu için kalır.
2. **Renk körlüğü modu:** Şimdilik gerekmez, çünkü ikon ve şekil eşliği kural olarak yeterli. Bir ayar (deuteranopi ön ayarı) ileride düşünülebilir.

### 8.2 Benim karar verebileceğim küçük işler (onay bekliyor, uygulanmadı)

- **`text-threat` → `text-threat-ink`:** Küçük metinde 41 kullanım değişir. Kontrast 4,45'ten 10,6'ya çıkar. Yalnızca CSS sınıfı değişir.
- **Dokunma alanı genişletme:** 32–40 px kontrollerin görsel boyutu korunur, dokunma alanı ≥44 px'e genişletilir. Ortak bir `hit-44` yardımcı sınıfı kullanılır (negatif inset veya `::before`). Görsel değişmez.
- **En kötü zemin kontrolü:** `tools/visual.mjs` ile parlak bir gezegenin önündeki plakanın ekran görüntüsü alınır ve metin kontrastı ölçülür.

---

## 9. Araştırılmamış önemli konular (review'da bulundu)

Önem sırasına göre:

1. **Flaş ve ışığa duyarlılık (güvenlik).**
   - WCAG 2.3.1: saniyede 3'ten fazla flaş olmaz. Genel ve kırmızı flaş eşikleri var.
   - GAG Basic: titreşen görüntü ve tekrarlı desenden kaçınılır.
   - Bizde savaş patlamaları, alarm yanıp sönmeleri ve büyük silah efektleri var. Bunlar hiç ölçülmedi.
   - Owner kararı oyun hareketlerini işletim sisteminin hareket tercihinden bağımsız tutuyor. Flaş eşiği ayrı bir güvenlik konusudur.
2. **Belirsizlik ve risk iletişimi.** Oyunun kalbi istihbarat ve tahmin. 7–70 yaş aralığı olasılığı nasıl okur?
   - Doğal frekans ("5'te 1"), ikon dizileri ve aralık gösterimi.
   - "Muhtemel" gibi sözel olasılık etiketlerinin kişiden kişiye farklı yorumlanması.
   - XCOM tek veri noktamız. Bu konu, Predictability ilkesini uygulamak için en önemli eksik.
3. **Ses UX.** Ses hiyerarşisi, arayüz sesinin yoğunluğu ve sıklığı, ses kapalıyken eşdeğer görsel. CLAUDE.md her eyleme ses istiyor.
4. **Hareket ile dikkat çatışması.** "Durağan görsel yok" ilkesi, önemli bir uyarının fark edilmesini zorlaştırabilir. Hareketin bir sinyal olarak kullanılması araştırılmadı.
5. **Yükleme ve algılanan performans.** 3D sahnenin yüklenmesi, iskelet ekran ve optimistic UI. CLAUDE.md'deki "anlık" ilkesi.
6. **Karşılaştırma ve sayı gösterimi.**
   - "Mevcut → yeni", "sen ↔ hedef", bar ve gösterge için kaynak bulunamadı.
   - Türkçe kısa sayı biçimi belirsiz: `Intl` 'tr' kompakt biçimi "1,2 B" verir, yaygın oyun dili "1.2K".
7. **Türkiye'ye özgü veri.** Oyuncu yaşı, cihaz dağılımı (düşük ve orta segment Android payı) ve ekran genişlikleri. ESA verisi ABD'ye ait.
8. **İkon ölçüleri.** En küçük ikon boyutu ve stil tutarlılığı doğrulanmadı.
9. **Erişilebilirlik ayarları paketi.** XAG ve GAG'in istediği ayarlar tek bölümde toplanabilir:
   - Yazı boyutu ölçeği.
   - Renk körlüğü ön ayarı.
   - Haptik kapatma.
   - Basılı tutma yerine dokunma alternatifi.
   - Flaş azaltma.
   - Arka plan hareketini kapatma.
   - Arayüz ölçekleme. CoC, EVE Echoes ve Genshin oyuncuları bunu istiyor.
10. **Rakip ekranlarının doğrudan incelenmesi.** STFC, RoK ve Whiteout Survival'ın savaş raporu, keşif ve yükseltme ekranları için webde kaynak yok. Ekran görüntüsü veya Game UI Database gerekiyor.

---

## 10. Çelişkiler ve açık kalanlar

- **Minimum yazı boyutu için kaynaklar farklı ölçü birimleri kullanıyor:**
  - Apple ve M3 font boyutu kullanıyor.
  - XAG gövde yüksekliği kullanıyor.
  - Akademik kaynaklar x-yüksekliğinin görüş açısını kullanıyor.
- **XAG'in mobil değeri tutarsız.** XAG 101 sabit 4,6 mm gövde yüksekliği istiyor. Bu telefonda yaklaşık 22–27 px font boyutu demek. Xbox'un el konsolu rehberi ise 720p'de en az 9 px, önerilen 12 px yükseklik diyor. XAG 101 değeri bir erişilebilirlik modu hedefi olarak okunmalı.
- **İkon mu metin mi:** NN/g çalışması "yalnız metin en yavaş" diyor, bir LMS çalışması "yalnız ikon en kötü" diyor. Görevler farklı (durum tarama ve eylem butonu), bu yüzden ikisi birlikte doğru olabilir.
- **Thumb zone:** Josh Clark'ın başparmak haritası ile Hoober'ın "insanlar tutuşu değiştirir, merkez kolaydır" bulgusu çelişiyor. Uzlaşı: sık eylem alt-ortada, salt okunur bilgi üstte.
- **dp ile mm dönüşümü:** Material 48 dp'yi ≈9 mm sayıyor, 1/160 inç hesabı ise 7,6 mm veriyor. Cihaza göre değişir.
- **Basılı tutma süresi:** Bir standart yok. Uygulayıcılar 0,6–3 sn önerir, XAG 2 sn üstünü sorunlu sayar.
- **Devre dışı buton:** Ya gri olup nedenini söyler, ya aktif görünüp basınca açıklar. NN/g ve Nielsen ikisini de kabul ediyor.
- **Bulunamayanlar:**
  - Supercell'in arayüz ölçüleri (px, hex).
  - Star Trek Fleet Command, Rise of Kingdoms ve Whiteout Survival'ın ekran düzenleri.
  - Savaş raporu ve keşif (scout) ekranlarına dair oyun bazlı kaynak.
  - Android cihaz genişliklerinin dağılımı.
  - HUD'ın kapladığı alan için bir yüzde.
  - Hodent'in 7 sütununun tam listesi.

  Bunlar için ilgili oyunların ekran görüntüleri doğrudan incelenmeli.

---

## 11. Ana kaynaklar

**Okunabilirlik eşiği (review'da doğrudan okundu)**
- Legge & Bigelow 2011, "Does print size matter for reading?": https://pmc.ncbi.nlm.nih.gov/articles/PMC3428264/

**Resmi**
- Apple HIG Typography: https://developer.apple.com/design/human-interface-guidelines/typography
- Material 3 type scale (Compose): https://developer.android.com/develop/ui/compose/designsystems/material3
- Material renk rolleri: https://github.com/material-components/material-components-android/blob/master/docs/theming/Color.md
- Android edge-to-edge: https://developer.android.com/design/ui/mobile/guides/layout-and-content/edge-to-edge
- Android haptics: https://developer.android.com/develop/ui/views/haptics/haptics-principles
- Android 48 dp: https://support.google.com/accessibility/android/answer/7101858
- WCAG 2.2:
  - Hedef boyutu: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
  - Kontrast: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
  - Renk kullanımı: https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html
  - Sürükleme: https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html
- Xbox Accessibility Guidelines:
  - XAG 101: https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/101
  - XAG 102, 103 ve 107: aynı adres, sonu `/102`, `/103`, `/107`
- Game Accessibility Guidelines: https://gameaccessibilityguidelines.com/full-list/
- Google RAIL: https://web.dev/articles/rail

**Araştırma**
- NN/g:
  - İkonlar: https://www.nngroup.com/articles/icon-usability/
  - Görsel göstergeler: https://www.nngroup.com/articles/visual-indicators-differentiators/
  - Okuma oranı: https://www.nngroup.com/articles/how-little-do-users-read/
  - Kademeli açıklama: https://www.nngroup.com/articles/progressive-disclosure/
  - Dokunma hedefi: https://www.nngroup.com/articles/touch-target-size/
  - Tepki süreleri: https://www.nngroup.com/articles/response-times-3-important-limits/
  - Onay diyaloğu: https://www.nngroup.com/articles/confirmation-dialog/
  - Renk: https://www.nngroup.com/articles/color-enhance-design/
  - Yaşlı kullanıcılar: https://www.nngroup.com/articles/usability-seniors-improvements/
  - Çocukların fiziksel gelişimi: https://www.nngroup.com/articles/children-ux-physical-development/
  - Beş kullanıcı: https://www.nngroup.com/articles/why-you-only-need-to-test-with-5-users/
  - Yakınlık: https://www.nngroup.com/articles/gestalt-proximity/
- Hoober:
  - Telefonu tutuş: https://www.uxmatters.com/mt/archives/2013/02/how-do-users-really-hold-mobile-devices.php
  - Parmak ve başparmak: https://www.uxmatters.com/mt/archives/2013/11/design-for-fingers-and-thumbs-instead-of-touch.php
- Hou vd. 2022, yaşlılarda yazı boyutu: https://pmc.ncbi.nlm.nih.gov/articles/PMC9376262/
- Cowan 2001, çalışma belleği: https://www.cambridge.org/core/journals/behavioral-and-brain-sciences/article/magical-number-4-in-shortterm-memory-a-reconsideration-of-mental-storage-capacity/44023F1147D4A1D44BDC0AD226838496
- Kao 2021, tutorial etkisi (CHI PLAY): https://people.csail.mit.edu/dkao/pdf/kao2021chiplay2.pdf

**Endüstri**
- Clash of Clans arayüz yenilemesi: https://supercell.com/en/games/clashofclans/blog/news/weve-revamped-the-clash-of-clans-user-interface/
- Marvel Snap onboarding: https://mobilegamer.biz/second-dinner-reveals-the-secrets-of-marvel-snaps-onboarding-and-card-design/
- Marvel Snap analizi: https://www.deconstructoroffun.com/blog/2023/5/23/marvel-snap-the-definitive-deconstruction
- XCOM 2 ve rastgelelik: https://www.gamedeveloper.com/design/jake-solomon-explains-the-careful-use-of-randomness-in-i-xcom-2-i-
- Okunabilir font sorunu: https://gamedeveloper.com/design/legible-font-still-one-of-the-biggest-accessibility-issues-in-games
- Mobil oyun erişilebilirlik heuristikleri: https://gamedeveloper.com/blogs/accessibility-heuristics-and-evaluation-criteria-for-mobile-games
- Strateji oyunu UI: https://www.gamedeveloper.com/design/ui-strategy-game-design-dos-and-don-ts
- Çevresel görüş için HUD: https://gamedeveloper.com/design/perceiving-without-looking-designing-huds-for-peripheral-vision
- 4X türünün evrimi (Naavik): https://naavik.co/deep-dives/four-x-evolution-2/
- EVE renk körlüğü desteği: https://eveonline.com/article/color-blindness-support-is-coming-to-eve-online
- Clash Royale UX incelemesi (U): https://www.therookies.co/blog/game-design-ux-best-practices-detailed-breakdown-of-clash-royale/
