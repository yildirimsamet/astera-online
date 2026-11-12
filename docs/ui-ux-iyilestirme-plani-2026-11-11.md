# UI/UX iyileştirme planı

Başlangıç: 2026-11-11. Dayanak: [`mobil-ui-ux-arastirmasi-2026-11-11.md`](mobil-ui-ux-arastirmasi-2026-11-11.md).

## Çalışma kuralları (owner, 2026-11-11)

1. **Araştırma eski belgelerden önce gelir.** Eski belgelerimizle çelişse bile raporun araştırma verisine dayanan bilgisi esas alınır.
2. **Süre önemli değil, eksiksizlik önemli.** Hiçbir konu atlanmaz. Bir şey yapılamıyorsa nedeni yazılır ve hangi aşamaya taşındığı belirtilir. Sessizce düşürülmez.
3. **Yararlı her öneri owner'a sunulur.** Bir kuralın "kilitli" olması öneriyi engellemez; kararı owner verir.
4. **Her aşama başlamadan önce birlikte detaylı planlanır.** Uygulamayı Claude yapar, owner kontrol eder. Bir sonraki aşama ancak ondan sonra planlanır.

## Çalışma yeri

- **Worktree:** `../blindspace-uiux`, branch `feat/ui-ux-standard`, `origin/master` 19a3cdf0 üzerinden açıldı (owner, 2026-11-11).
- **Klan işi:** `../blindspace-clan-escape` worktree'sindeki commit edilmemiş klan işinin (F1 kaçış + F2 perkler) 2026-11-10 22:10 UTC tarihli kopyası buraya alındı. Kopya 128 değişmiş ve 41 yeni dosyadan oluşuyor, birebir aynı. Tek çakışma `GalaxyCanvas.tsx` importlarındaydı ve çözüldü.
- **Klan oturumu:** Bilgilendirildi. Klan işi kendi worktree'sinde sürüyor. Birleştirmede klan worktree'si esas alınır.

## Aşamalar

| # | Aşama | Durum |
|---|---|---|
| 0 | Araştırma raporu ve review'ı | ✅ Bitti |
| 1 | Ölçüm aracı, başlangıç ölçümü ve flaş güvenliği | 🔍 Uygulandı ve review edildi (1.14); owner kontrolü ve iki karar bekliyor. Tam yeniden ölçüm en sona kaldı (1.9) |
| 2 | Standart kararları (owner ile): **oyun arayüzü dili (sanat yönü)**, yazı ölçeği, dokunma alanı, renk, metin bütçesi, süreler | ✅ 2.1 yön B. 2.2–2.9 kararlandı (2026-11-12); 2.9 görünüm Komuta + Grafit, başlık fontu Russo One yerine Saira dar kalın: [karar paketleri](ui-standart-karar-paketleri-2026-11-12.md) |
| 3 | Altyapı: token'lar, dokunma alanı yardımcısı, koruyucu testler, **oyun arayüzü kiti** (font, buton ve panel malzemeleri, ikon seti, basma animasyonu, ses ve titreşim eşlemesi; galeride hazır parça olarak; owner onayı 2026-11-11) | ✅ 3.1–3.8 bitti, S22 öncesi kod incelemesi düzeltildi (cd4fc12f). 3.9 S22 turu en sona kaldı (owner, 2026-11-12) |
| 4 | Ekran ekran uygulama (ilk deneyim akışından başlayarak) | ⏳ |
| 5 | Erişilebilirlik ayarları: yazı boyutu, haptik, basılı tutma alternatifi, flaş azaltma | ⏳ |
| 6 | Ek araştırmalar: risk iletişimi, ses, Türkiye verisi, rakip ekranları (paralel yürüyebilir) | ⏳ |
| 7 | Yaş gruplarıyla anlaşılırlık testi | ⏳ |

## Öncelikli konu: oyun arayüzü dili (owner, 2026-11-11)

**Owner'ın tespiti:** Clash of Clans ve Whiteout Survival'da tasarım, çizim ve hava gerçekten bir oyun gibi. Bizde menüler, butonlar, ikonlar ve yazılar bir web formu gibi duruyor. Owner bu konuya **çok önem veriyor**.

**Neden (motor değil).** Unity'nin arayüzü de dikdörtgen, görsel ve yazıdan oluşur; aynı yapı taşları HTML/CSS'te var. Fark sanat yönünden ve arayüzün neyle üretildiğinden geliyor:

1. **Buton:** Onlarda çizilmiş bir nesne; bombe, parlama, gölge ve kalın kenar var. Whiteout'taki "Yükselt" 83×38 dp'dir ve ikonla maliyet butonun içindedir. Bizde ince kenarlı, düz, yarı saydam dikdörtgen.
2. **Yazı:** Onlarda kalın, yuvarlak hatlı oyun fontu, koyu kontur ve gölge var. Bizde 9–10 px, ince, aralıklı büyük harfli pano etiketleri var. Whiteout'un gövde metni de yaklaşık 12 dp, Clash Royale'inki 10–12,6 dp; yani boyut bizimkine yakın. Farkı kalınlık, kontur ve harf yapısı yaratıyor; ayrıca onlarda cümle az, buton ve başlık büyük (1.13 ölçümü; araştırma §7.2).
3. **İkon:** Onlarda her ikon küçük bir resim. Bizde tek renk çizgi ikon.
4. **Basınca tepki:** Onlarda buton göçer, zıplar, ses ve parçacık çıkar. Bizim ölçümümüz basılan hedeflerin %96'sında görsel basma tepkisi bulmadı.
5. **Form düzeni:** Filo gönderme ekranımız satır satır "− 0 +" sayaçlarından oluşuyor. Onlarda aynı iş resimli kart ızgarası ve tek büyük eylem butonuyla yapılıyor.
6. **Renk rolleri:** Onlarda yeşil "yap", mavi panel, kırmızı rozet, altın ödül. Bizde lacivert zemin, turkuaz ve düşük kontrastlı gri.
7. **Kendi kurallarımız:** "Kompakt premium: büyük yazı ve buton yok" yönergesi ve ince "Gözlemevi" estetiği bu görünümü bilerek üretti. Çalışma kuralı 1 ve 3 gereği bu yönergeler bu kararda yeniden değerlendirilir.

**Plan:**

- 2. aşamanın ilk kararı UI sanat yönüdür; diğer standartlar (yazı ölçeği, renk, dokunma alanı) bu karara göre verilir.
- **Yöntem:** Bir ekranımız (filo gönderme) iki yönde örnek olarak çizilir:
  - mevcut dil;
  - oyun dili: malzemeli panel, kalın ve konturlu oyun fontu, resimli ikon, dokununca göçen ve ses/titreşim veren buton, net renk rolleri.

  Owner ikisini yan yana görüp seçer.
- **Kimlik korunur:** Bilim kurgu ve "canlı NASA fotoğrafı" hissi kalır. Whiteout'un karikatür kar dünyası kopyalanmaz; ondan oyun arayüzü dilinin kuralları alınır.
- **Veri:** Rakip ölçümü (1.13) bu kararın verisidir. Ağırlık Whiteout'tadır çünkü bizim gibi dikey (owner). Clash Royale de dikey; ikinci dikey referans olarak ölçüldü (araştırma §7.2). Star Trek, bilim kurgu ara kıyası olarak kullanılır.

---

## Aşama 1: Ölçüm aracı, başlangıç ölçümü ve flaş güvenliği

### Amaç

Oyuncunun gördüğü her yüzeyi, çalışan arayüzde ve raporun eşiklerine göre ölçmek. Kaynak kod sayımı yanıltıcı çıktı; neyin dokunulabilir olduğunu, gerçek arka planı ve ekranda ne göründüğünü yalnızca çalışan arayüz gösterir. Bu ölçüm, sonraki aşamaların doğrulanabilir hedefi olur:

- **2. aşama** kararları sayıya dayanarak verilir. Örnek soru: "Tabanı 12 px yaparsak kaç etiket taşar?"
- **3. ve 4. aşamalar** "ölçüm temiz" çıktısıyla kapanır.

**Bu aşamada arayüzde hiçbir şey değişmez.** Yalnızca ölçüm araçları ve raporlar yazılır.

### 1.1 Yüzey envanteri: nelerin ölçüleceği

Oyuncuya görünen her yüzeyin listesi çıkarılır. Kaynaklar:

| Kaynak | Klasör/dosya |
|---|---|
| Ekranlar | `screens/` (72 dosya) |
| HUD ve kabuk | `v2/hud`, `v2/shell`, `shell/` |
| İlk deneyim | `starter/`, `onboarding/` (Academy, prologue) |
| Arena | `arena/` (Komutan Gemisi) |
| Diğer | `landing/` (public), `wiki/`, `battle-simulator/`, `legacy/` |
| Sheet, dialog ve toast'lar | Sheet, dialog ve toast'lar |

**Kapsam dışı (owner):** Admin panelleri (`Admin*`, `AnalyticsAdminPanel`). Oyuncu görmez.

Her yüzey için şunlar yazılır:

- **Erişim yolu:** galeri görünümü, Academy fixture'ı, gerçek istemci veya arena sandbox'ı.
- **Ölçülecek durumlar:** boş, tipik, yoğun (geç oyun), kilitli, bekliyor, hata.
- **Ölçüm durumu:** ölçüldü, ölçülemedi (neden) veya kapsam dışı (owner kararı).

**Unutulmayı önleyen test (öneri):** Yeni bir ekran dosyası eklenip envantere yazılmazsa kırmızıya dönen bir test. Böylece envanter zamanla eskimez.

### 1.2 Ölçütler

Eşikler raporun ilgili bölümünden gelir. 1. aşama standart koymaz. Her aday eşik için ihlal sayısını gösterir; kararı 2. aşamada veririz.

| Kod | Ölçüt | Nasıl ölçülür | Raporlanan eşikler |
|---|---|---|---|
| **T1** | Görünen her metnin boyutu | Görünür metin düğümlerinin hesaplanmış `font-size` değeri | <11 / <12 / <13 / <14 px dağılımı |
| T2 | Küçük ve büyük harfli metin | ≤12 px, `uppercase` ve 2 kelimeden uzun | Sayı ve liste |
| T3 | Satır aralığı | Çok satırlı metinde `line-height / font-size` | <1,3 |
| T4 | Satır uzunluğu | Paragraf satırı başına karakter | >50 (mobil), >80 (XAG) |
| T5 | Hiyerarşi seviyesi | Yüzey başına farklı boyut sayısı | >5 |
| T6 | İnce ağırlık | 16 px altında 400'den ince ağırlık | Sayı |
| **T7** | Taşma ve kesilme | Üç nokta, `scrollWidth > clientWidth`, kırpılmış metin | Her örnek |
| **C1** | Gerçek kontrast | İki ekran görüntüsü alınır: metin görünür ve metin şeffaf. Metnin altındaki zemin piksellerinden en kötü ve medyan WCAG oranı ile APCA Lc hesaplanır. Metin opaklığı da hesaba katılır | <4,5 (metin), <3 (büyük metin) |
| C2 | Hareketli zemin | Galaksi canlı olduğu için C1 birkaç karede tekrarlanır, en kötüsü alınır. Uygulanan: 3 kare, 400 ms arayla (plandaki örnek 2 sn'de 5 kareydi; gökyüzü 19 dk'da döndüğü için kısa aralık yetiyor, hızlı efektler flaş filminde ölçülüyor) | Aynı |
| C3 | İkon ve kontrol kontrastı | Yalnızca ikonlu butonlarda ikonun zemine karşı kontrastı | <3 |
| **K1** | Dokunulabilir öğeler | Rol veya etiket (`button`, `a`, `input`, `role=*`), `tabindex` ve `cursor:pointer` taranır | Liste |
| **K2** | Gerçek dokunma alanı | Ekran 2 px'lik ızgarada `elementFromPoint` ile örneklenir. Her hedefin gerçekte yakaladığı alan, etkin boyutu ve çakışmaları çıkar | <24 (WCAG AA), <44, <48 |
| K3 | Hedef aralığı | Komşu hedefler arası mesafe ve WCAG'in 24 px daire testi | <8 px |
| K4 | Kenar ve hareket alanı | Ekran kenarına ve hareket alanına (gesture inset) yakın hedefler | Kenarda hedefin büyük olması gerekir |
| K5 | Etiketsiz ikon butonu | Görünür metni olmayan hedefler ve erişilebilir adları | Liste |
| **F1** | Basma tepkisi | Her butona `pointerdown` gönderilir, ilk 100 ms içinde görsel değişim aranır, sonra iptal edilir. Bu yöntem eylemi tetiklemez | Tepkisiz buton |
| F2 | Hareket süreleri | Hesaplanmış `transition` ve `animation` süreleri | >300 ms (arayüz geçişi) |
| W1 | Metin miktarı | Yüzey başına görünen kelime ve cümle sayısı, en uzun cümle, Türkçe açıklamalar için Ateşman puanı. 2026-11-11 eki (owner'ın "yazıya boğuyor muyuz?" sorusu): ekran başına kelime (kelime ÷ kaydırma parçası) ve 6+ kelimelik blok sayısı; raporda "Metin yükü (W1)" bölümü | Dağılım; rakip referansı araştırma §7.3 |
| R1 | Renk sayısı | Yüzey başına nötr olmayan ton sayısı | >3 (anlam taşıyan renkler ayrı sayılır) |
| R2 | Renk körlüğü görüntüleri | Her ekran görüntüsünün deuteranopi, protanopi ve tritanopi simülasyonu | Görsel inceleme |
| L1 | Yatay taşma | Sayfa genişliğinin ekran genişliğini aşması | Her örnek |
| L2 | Boşluk ızgarası | 4'ün katı olmayan margin, padding ve gap değerleri | Dağılım |

### 1.3 "Ya böyle yaparsak" ölçümü (öneri)

T1 ve T7 bir de yazı ölçeği yükseltilmiş hâlde çalıştırılır. Yükseltme, araca enjekte edilen geçici bir CSS ile yapılır:

- Seçenek A: 9→11, 10→12, 12→14.
- Seçenek B: 9→11, 10→12, gövde 12'de kalır.

Sonuç olarak her seçenek için kaç metnin taştığı, kaç satırın kırıldığı ve kaç yüzeyin kaydırma gerektirdiği görülür. 2. aşamada yazı ölçeği kararını bu bedeli bilerek veririz. Ürün koduna dokunulmaz.

### 1.4 Statik taramalar (çalışan arayüzün ulaşamadığı yerler)

- **Yazı boyutları:** CSS ve TSX'teki bütün yazı boyutu bildirimleri, satır numarasıyla. Kapsam: sabit px değerleri (CSS'te 7–8 px dahil), Tailwind sınıfları, inline stiller, 3D ve canvas metinleri.
- **Yanıp sönen animasyonlar:** Periyodu 333 ms'den kısa olan ve opaklık veya parlaklık değiştiren keyframe'ler.
- **Basılı tutma süreleri:** `HoldButton` 600 ms, `CrateBay` 600 ms, `Prologue` 850 ms, arena `PingWheel` 320 ms ve `Controls` 165 ms. Taramada başkaları da aranır.
- **Ses ve haptik kapsamı:** Hangi eylem bileşeninin `lib/sound` ve `haptic` çağırdığı. Kaba bir liste çıkar; ayrıntılı inceleme 4. aşamanın kontrol listesine gider.
- **Bildirim metinleri:** Push ve bildirim merkezi metinlerinin uzunluğu ve ana mesajın ilk 40 karaktere sığıp sığmadığı. Ekran dışında kaldıkları için çalışan arayüz bunları ölçemez.

### 1.5 Flaş güvenliği (hafif kapsam, owner onayladı 2026-11-11)

**Neden var:** Işığa duyarlı epilepsi kabaca her 4000 kişiden birinde görülür ve en sık 7–19 yaş arasında başlar. Bu, "7'den 70'e" hedefimizin genç ucudur. Sonuç hafif bir rahatsızlık değil, nöbettir. Ayrıca oyun hareketleri bilerek işletim sisteminin "hareketi azalt" ayarına uymuyor (CLAUDE.md §4.5), yani oyuncunun sistem düzeyinde bir korunma yolu yok.

**Neden hafif tutuluyor:** CSS tarafındaki ön tarama zararsız görünüyor:

| Efekt | Gözlem |
|---|---|
| `prologue-whiteout`, `prologue-flash`, `legacy-reveal-flash` | Tek seferlik |
| `prologue-flicker` | 1,9 sn döngülü ve opaklık yalnızca 0,8–1 arasında değişiyor |
| `school-blink` | 1 sn döngülü ve yalnızca 4 px'lik bir nokta |
| `animate-pulse` | 2 sn döngülü |

Bilinmeyen kısım 3D'deki patlama ve isabetler.

**Kapsam:**

1. **Statik tarama** (1.4'teki gibi): periyodu 333 ms'den kısa, opaklık veya parlaklık değiştiren keyframe'ler.
2. **Kayıt:** Yalnızca büyük ve parlak efektler kaydedilir. Liste: savaş tekrarındaki patlama, radyasyon bombası, arena isabeti ve gemi ölümü, prologue flaşları, legacy reveal ve kod taramasında çıkacak tam ekran parlamalar.
   - Playwright'ın saat kontrolüyle zaman kare kare ilerletilir (60 fps).
   - Arena için gerçek GPU'lu Chromium kullanılır.
3. **Analiz:** Küçük bir analizör yazılır ve TDD ile test edilir. WCAG 2.3.1 genel flaş ve kırmızı flaş eşiklerini uygular: saniyede 3'ten fazla flaş ve 10°'lik görüş alanının %25'ini aşan alan.
   - Telefon için 33 cm mesafe ve 0,17 mm/px varsayılır. Bu varsayım raporda yazılır.
   - Sonuç efekt başına verilir: geçti veya kaldı.
4. **S22'de göz kontrolü:** Aşamanın sonundaki cihaz turunda yapılır.

**Uygulama (2026-11-11):**

- Komut: `pnpm ui:audit flash` (`--moment <id>` ile tek an). Çıktı: `reports/ui-audit/flash-<tarih>.md` ve JSON. Yarım saniyede bir alınan kareler `out/ui-audit/<tarih>/flash/<an>.png` şeridine yazılır, böylece filme neyin girdiği gözle görülür.
- Kayıt: sayfa saati Playwright saatine bağlanır. CSS ve Web Animations DevTools zaman çizelgesinde dondurulur ve elle ilerletilir. Her kare, ekran görüntüsü ne kadar sürerse sürsün, bir öncekinden tam 1/60 sn sonradır.
- Ekran 14×32 hücreye bölünür (yaklaşık 25 px). Parlaklık doğrusal ışıkta ortalanır.
- Kaydedilen anlar: simülatördeki savaş tekrarı, arena çatışması, radyasyon bombası ve sıçrama (geliştirici önizlemeleri; sayfa yüklenirken saat tutulur), prologue dalışı ve kaynak torcu, miras açılışı.
- Galaksi saldırıları (2026-11-11, S22 turunda eklendi): Ölüm Yıldızı isabeti (`DeathStarImpact`, `StrategicBlast`), gezegen savaşı (`Bombardment`) ve Tempest motorunun flaşları (`tempestFlash`). Başta "yalnız canlı oyunda başlıyor" diye dışarıda kalmıştı. 3D sanat galerisi (`v2-gallery.html?view=premium-space&scene=strategic|battle|fleet&engine=engine-tempest`) bunları vurulan dünyaya yakın açıyor ve "Tekrar oynat" ile baştan başlatıyor. Böylece film listesine girdiler; kaydedilmeyen an kalmadı.
- Yarış: film, sayfa saatini "şimdi + 10 ms"de durduruyor. Makine yüklüyken o an komut ulaşmadan geçebiliyor ("Cannot fast-forward to the past"). `pauseSoon` bu durumda saati yeniden okuyup tekrar deniyor (testli).

**Çıkarılan:** EA IRIS ile çapraz doğrulama yapılmaz. C++ ve OpenCV derlemesi gerektiriyor ve bu kapsam için maliyeti gereğinden yüksek. Analizör bir efekti sınırda bulursa yeniden değerlendirilir.

### 1.6 Durum, dil ve ekran kapsamı

| Boyut | Kapsam |
|---|---|
| Ekran | 350×812 DPR 2 (ana); 1280×900 masaüstü (ikincil); 320×740 yalnızca T7 ve L1 (taşma) için (owner) |
| Dil | Bütün ölçütler tr ve en ile çalışır. T7 ve L1 (taşma) altı dilde de çalışır: tr, en, de, es, fr, ja |
| Veri yoğunluğu | Yeni oyuncu (Academy/starter), orta oyun ve yoğun geç oyun. Yerel DB'de seed edilmiş hesaplar kullanılır; prod'a dokunulmaz |
| Erişim yolu | Galeri fixture'ı varsa önce o, sonra gerçek istemci. Galeri deterministik ve hesap açmaz |
| Bilerek ölçülmeyenler | Wiki (dizin ve makale), oyun rehberi ve yasal sayfa yalnız tr ve en yayımlanıyor; diğer dört dilde ölçülmez. Üs ve filo özeti katmanı (`client:outline`) yalnız masaüstünde var. Bu ayrımlar sürücüde yazılı (`langs`, `profiles`) |

### 1.7 Araç yapısı

- **`tools/ui-audit/`**
  - **Saf ölçüm fonksiyonları:** kontrast (WCAG ve APCA), dokunma alanı gruplama, 24 px daire testi, flaş tespiti, Ateşman puanı, ton kümeleme, renk körlüğü matrisleri. TDD ile yazılır, testleri vitest'te.
  - **Toplayıcı:** sayfaya enjekte edilen ve ham eleman verisini döndüren kod.
  - **Sürücüler:**
    - Galeri (30 görünüm ve bölümler).
    - Academy ve starter.
    - Gerçek istemci.
    - Arena.
    - Landing, Wiki ve savaş simülatörü.
  - **Rapor üreteci:** JSON'dan yüzey ve ölçüt karnesi üretir; bir önceki ölçümle farkı gösterir.
- **Çıktılar:**
  - Ham veri ve ekran görüntüleri: `out/ui-audit/<tarih>/` (git'e girmez).
  - Karne: `reports/ui-audit/baseline-<tarih>.md` (git'e girer).
  - Özet JSON: `out/ui-audit/<tarih>/summary.json` (git'e girmez; owner, 2026-11-11: ~6 MB). Bir sonraki ölçüm farkı buradan okur. Bu yüzden `out/` silinirse önceki ölçümle karşılaştırma kaybolur.
- **Komut:** `pnpm ui:audit`. Ağır olduğu için `pnpm verify`'a eklenmez. Bellek kurallarına (`tools/heavy.mjs`, heap sınırları) uyar.

**Kurulduğu hâli (2026-11-11):**

- Yer `tools/ui-audit/` değil, `packages/ui-audit/` oldu: kendi testleri, tür denetimi ve lint'iyle bir workspace paketi.
- **Ekran ölçümü kaydırarak yapılır.** Ekranın altına taşan liste kaydırılır, her parça ayrı ölçülür (`<yüzey>.p1.png`, …). Sabit başlık ve alt çubuk bir kez sayılır.
  - Parça sınırı 40'tır. İlk koşuda sınır 8'di ve 87 ölçüm sona varamadı. En çok etkilenen ülke seçiciydi: 252 satırın yalnız bir kısmı ölçülmüştü.
  - Sınır 40'a çıkarıldı (testi: 150 satırlık sayfa sonuna kadar ölçülür). Sınıra takılan ölçümler ana koşuda, A'da ve B'de yeniden ölçüldü.
  - Sonuç: 4596 ölçümün hiçbiri sınıra takılmadı. En uzun sayfa masaüstünde Miras açılışı (29 parça), ülke seçici (telefonda 22, dar ekranda 24 parça).
- **Çizim:** varsayılan, makinenin GPU'su (Vulkan'lı Chromium). 3D sayfalar zamanında çizilir. `--renderer swiftshader` yazılımla çizer, yavaştır.
- **Sürücüler:**
  - `gallery`: galeri görünümleri.
  - `public`: hesap gerektirmeyenler (giriş kapısı, eğitim, arena, simülatör, hata ekranları, Wiki). Sunucunun vereceği cevaplar sürücüde verilir.
  - `client`: gerçek istemci, gerçek sunucu. Her koşu kendi yerel oyununu kurar (`stack.ts`):
    - Adı `_capacity` ile biten kendine ait bir veritabanı açılır, kapasite seed'i 150 komutanla yüklenir.
    - `uiAuditStage` iki komutana koloni verir: cap0001'e 1, cap0002'ye 3 (sınır). cap0001 ayrıca tarafsız bir dünyaya, savaş tekrarı izlenebilecek büyüklükte bir akın gönderir. Seed'in kendi akınları tekrar için fazla küçük.
    - API yükseltilmiş sınırlarla çalışır. Koşu bitince ya da iptal edilince süreçler kapanır ve veritabanı silinir.
  - `starter`: aynı yığın, başlangıç galaksisi açık (`STARTER_GALAXY_ENABLED`). Bu anahtar istemci yollarını da değiştirdiği için `client` ile birlikte değil, ayrı koşulur.
- **Yamalanan durumlar:** yerel oyunun bir koşuda ulaşamadığı durumlar sunucunun kendi cevabına, mümkünse tek alan olarak yazılır:
  - Sezon özeti: sezon donmuş ve komutanın sonucu var.
  - Sessiz Uzay: yerleşim bekleme odasında.
  - Başlangıç: hazır bir kasa, dolu yakıt deposu (sıçrama çağrısı ve motor paneli), geminin arkasında bir iniş (varış kartı).
- **Bekleyen yollar sona kalır:** bilinmeyen sinyal (oyun saatinin ilk sinyali) ve savaş tekrarı (akının inişi, yaklaşık 45 dk). Diğer ölçümler bu sürede yapılır.
- **Diğer komutlar:** `flash` (1.5), `static` (kaynak taraması), `competitor` (1.13), `vision` (renk körlüğü sayfaları), `report`.
- **Kırpılma kuralı (2026-11-11, S22 karşılaştırmasında bulundu):** "Kırpılan metin", metnin `overflow: hidden` bir kabın dışına taşmasıdır. İlk kural iki şeyi yanlışlıkla kırpık sayıyordu:
  1. **Kaydırma kenarı:** Yuvarlak köşeli bir panelin kaydırma alanının kenarına yarım denk gelen satır. Oyuncu kaydırınca bu satırı tam görür. Kaydırmalı ölçümde her parçanın alt kenarında bu oluyordu. Kural: bir kaydırma kabını geçince o yöndeki taşma kırpılma sayılmaz.
  2. **Satır kutusu:** Metin dikdörtgeni yazı tipinin tüm yüksekliğidir (ascent+descent). Sıkı satır aralıklı bir kapta bu kutu taşar, ama harfler taşmaz. Kural: dikey taşma, harflerin boyandığı alanla (canvas `measureText`, `actualBoundingBox`) ölçülür.
  - Kalibrasyon sayfasında dört yeni durum var: kenar satırı, kaydırıcı içindeki gerçek kırpılma, sıkı satır aralığı ve harfleri kesen kutu.
  - Etki: 10 yüzeylik örnekte 42 işaret önce 28'e, sonra 8'e indi. Kalanlar ekran kenarında kesilen uzun satırlar.
  - **Owner kararı (2026-11-11):** Tam yeniden ölçüm (~8 saat) şimdi değil, en sonda yapılır.
    - 1. aşama hiçbir oyun ekranını değiştirmedi. Bu yüzden "önce" hâli `fb70004a` commit'idir.
    - En sonda bu commit geçici bir worktree'de ve son hâl aynı, düzeltilmiş araçla ölçülür. O worktree'ye son hâlin `packages/ui-audit`'i ve `apps/server/src/cli/uiAuditStage.ts`'i konur; oyun kodu `fb70004a`'da kalır. Böylece her ölçütte temiz bir önce/sonra karşılaştırması çıkar.
  - **O zamana kadar:** `baseline-2026-11-11.md`'deki "kırpılan metin" sayıları ve A/B'deki "yeni bozulan metin" listeleri şişkin; 10 yüzeylik örnekte kırpılma işaretlerinin %80'i (42'den 34'ü) yanlıştı.
    - Kesilen (üç nokta) metin, satır kırılması, kaydırma ve diğer bütün ölçütler bu hatadan etkilenmedi.
    - Tek istisna "En kötü 20 yüzey" tablosu: oradaki "Kesilen" sütunu kırpılanı da sayıyor ve puana giriyor. Kırpılma çıkarılınca listenin 19'u aynı kalıyor (`client:battle-replay` çıkıyor, `gallery:rewards-complete` giriyor); kırpılmanın ilk 20'nin puanındaki payı %9,5 (aşama 1 review'u).
    - 2. aşamadaki yazı ölçeği kararı bu etkilenmeyen sayılara dayanır.
  - **Dikkat:** Durdurulan zincir `out/ui-audit/2026-11-11/raw` altında 27 gallery ölçümünü yeni kuralla yeniden yazdı (`logs/remeasure/gallery.log`). Ham klasör artık karışık. Rapor tam yeniden ölçümden önce bu klasörden yeniden üretilmemeli; mevcut rapor ve `summary.json` eski, tutarlı veriden.
- **Dile bağlı olmayan ölçütler:** Basma tepkisi yalnız tr/telefon koşusunda basılır; diğer dillerde ve masaüstünde raporda "—" ve "basılmadı" yazar, puana girmez. Ateşman yalnız Türkçe metne uygulanır.
- **Göz kontrolü (1.8/4, 2026-11-11):** Tohum 20261111 ile tr/telefondan 5 yüzey seçildi: etkinlik rehberi, kostüm mağazası, radyasyon fırlatma, üs üretimi, Ölüm Yıldızı raporu. Kesilen metinler, düşük kontrastlı yazılar ve en küçük boyutlar ekran görüntüsüyle karşılaştırıldı; hepsi tuttu. Tek şüpheli değer, 1 px'lik "Uyuyan Muhafız" yazısı, ölçüm hatası çıkmadı: harita uzaktaki muhafızın bilgi kartını gerçekten ~1 px'lik bir leke olarak çiziyor (telefonda 48 metin, galaksi, kronik, dünyalar, varış ve dönüş ekranlarında). Bulgu olarak 1.9'a yazıldı (4. aşama): kart okunamayacak kadar küçülünce gizlenmeli.
- **Denenmeyen yol:** `enter()` içindeki "yokken" kartını kapatma adımı yeniden koşuda çalışmadı; yeni komutanlar yokken sayılmıyor. Kart çıkarsa kapatılır; çıkmazsa adım atlanır.

### 1.8 Doğrulama: aşama ne zaman biter

1. **Birim testleri:** Bilinen girdilerle her ölçüm fonksiyonu test edilir. Örnekler:
   - Bilinen renk çiftlerinin kontrastı.
   - 4 px aralıklı 40 px'lik iki buton daire testinden kalır.
   - 4 Hz flaş yakalanır, 2 Hz geçer.
2. **Kalibrasyon sayfası:** İçine bilerek ihlal konmuş sentetik bir HTML sayfası. İçeriği:
   - 9 px metin ve 30 px buton.
   - Gradyan üstünde düşük kontrast.
   - Kesilmiş etiket.
   - Yanıp sönen kutu.
   - Tepkisiz buton.

   Araç her ihlali tam olarak bulmalı ve yanlış alarm vermemeli. Bu bir entegrasyon testidir.
3. **Kapsama:** Envanterdeki her yüzeyin en az bir ölçülmüş durumu veya yazılı bir "ölçülemedi" gerekçesi olur.
4. **Göz kontrolü:** Rastgele seçilen yüzeylerde sayılar ekran görüntüsüyle karşılaştırılır.
5. **Teslim:** Karne raporu. İçeriği:
   - En kötü 20 yüzey.
   - Ölçüt başına dağılım.
   - "Ya böyle yaparsak" sonuçları.
   - Flaş sonuçları.
6. **Kapı:** Teslimden önce ilgili testler ve tam `pnpm verify`.

### 1.9 Bu aşamada yapılmayanlar (unutulmuyor, taşınıyor)

| Konu | Neden | Taşındığı aşama |
|---|---|---|
| Ekran başına bilgi grubu sayısı | Otomatik ölçülemez, göz ve muhakeme ister | 4: yüzey kontrol listesi |
| Bilginin yalnızca renkle verilmesi | Kısmen otomatik (R2 görüntüleri); karar gözle verilir | 4 |
| İç ve dış boşluk ilişkisi | L2 dağılımı veri verir; yargı gözle | 2 ve 4 |
| Ses ve haptiğin her eylemde olup olmadığı | 1.4 kaba listeyi verir; ayrıntı ekran ekran | 4 |
| 3D seçim hedefleri (gezegen, filo işaretçisi) | DOM dışında. 1'de koddan bakıldı: gezegenin dokunma alanı uzakta en az 24 px çap (`galaxy/planetPick.ts`, 12 px yarıçap), 44 px önerisinin altında. Asteroit (`asteroidHitRadius`) ve filo (`UNKNOWN_PICK_BOUNDS`) dünya biriminde sabit; ekrandaki boyutu yakınlaştırmaya bağlı. Ölçmek için kameradan izdüşüm yapan bir geliştirici köprüsü gerekir (`starter/tutorial/rockReach.ts` aynı hesabı asteroitler için zaten yapıyor) | 4 |
| Kullanılmayan kod: `onboarding/Academy.tsx`, `Rehearsal.tsx`, `BeatCard.tsx` ve yalnız onlardan çağrılan `shell/StatusBar.tsx` (1820 satır; oyunda hiçbir yer içe aktarmıyor, 10 test dosyası bağlı) | Owner 2026-11-11: "Şimdilik dursunlar." Ölçüme girmiyorlar (envanterde yoklar) | Owner yeniden sorarsa |
| Kırpılma kuralı düzeltmesiyle tam yeniden ölçüm (~8 saat; 1.7) | Owner 2026-11-11: sonraki işler beklemesin, en sonda koşulsun. "Önce" hâli `fb70004a`'dan ölçülür. **Ek (2026-11-12, a79d5ce6):** kaydırılarak ölçülen sayfalarda 2. parçadan sonraki hedeflerin CSS basma tepkisi yanlış öğede deneniyordu. Baseline'daki "tepki yok" sayısı uzun sayfalarda bu yüzden fazla; yeniden ölçüm bunu da düzeltir. Tek parçalı ekranlar etkilenmedi | Son aşamanın sonu |
| Haritada ~1 px'lik bilgi kartı (göz kontrolünde bulundu, 1.7) | Uzaktaki muhafızın kartı ölçekle küçülüp okunamaz bir lekeye dönüşüyor; gizleme eşiği bir ekran kararı | 4 |
| Gerçek cihazda (S22) okunabilirlik ve flaş | Owner onayladı | 1. aşamanın sonu (1.12) |
| Metin bütçesi: hangi metin silinir, kısalır, dokununca açılan sheet'e taşınır | 1. aşama yalnız ölçer (W1, araştırma §7.3). Bütçe bir standart kararı | Karar 2, uygulama 4 (en yoğun ekranlardan başlayarak) |
| Rakiplerde metin/ikon oranı ve ekran başına ton sayısı (1.13) | Metin miktarı ekran başına kelimeyle ölçüldü (§7.3). İkon sayımı ve ton sayımı illüstrasyonlu ekranda otomatik yapılamıyor; renk rolleri gözle yazıldı | 2: sanat yönü kararında gerekirse elle sayılır |
| Rise of Kingdoms ekranları (1.13) | Owner üç oyun seçti, sonra Clash Royale'i ekledi. RoK çekilmedi | Gerekirse 6 (ek araştırmalar) |

### 1.10 Riskler

| Risk | Önlem |
|---|---|
| React olay dinleyicileri DOM'da görünmez, bu yüzden dokunulabilirlik tam bilinemez | Rol, `cursor` ve dokunma ızgarası birlikte kullanılır. Kaçan hedefler göz kontrolünde aranır |
| SwiftShader yavaş, animasyon zamanlaması gerçek dışı | Flaşta saat kontrolü kullanılır; arenada GPU'lu Chromium |
| Yarı saydam plakaların arkasındaki galaksi hareket ediyor | C2'de birden çok kare örneklenir |
| Kayıt oranı sınırı | Yerelde `RATE_LIMIT_SIGNUP_MAX` yükseltilir. Mümkün olan her yerde galeri ve Academy kullanılır |
| Süre ve bellek | Dil × yüzey × durum sayısı büyük. Sürücüler parça parça ve tek tarayıcıyla çalışır |

### 1.11 Owner kararları (2026-11-11)

| # | Konu | Karar |
|---|---|---|
| 1 | Admin panelleri | Kapsam dışı |
| 2 | 320 px kontrolü | Yalnızca taşma ölçütlerinde (T7, L1) |
| 3 | S22 gerçek cihaz turu | 1. aşamanın sonunda yapılır (1.12) |
| 4 | Rakip ölçümü | Yapılır. Ekran görüntülerini owner alır, Claude adb ile çeker (1.13). 2. aşamadan önce bitmeli |
| 5 | Flaş | Hafif kapsam onaylandı ("Okey"), IRIS yok (1.5) |
| 6 | K4 ölçütü (1.14) | "Şuanlık pass geçelim." Araç değişmez. Rapordaki K4 sayısı kusur sayısı değil, kenara yakın dokunma hedefi sayısı olarak okunur. Sürükleme kuralı 2. aşamanın dokunma kararına girer |
| 7 | Ekran durumu listesi (1.14) | "Olur." 4. aşamada her ekran değişmeden önce durumları çıkarılır, eksik durum ölçülür |

### 1.12 S22 cihaz turu (aşama sonu)

- **Bağlantı:** Owner telefonu USB ile bağlar. Claude adb ve `connectOverCDP` ile bağlanır (bkz. bellek: phone profiling).
- **Ölçüm:** Aynı ölçüm aracı telefondaki gerçek Chrome'da birkaç ana yüzeyde çalıştırılır. Masaüstü emülasyonuyla fark var mı bakılır.
- **Okunabilirlik:** Ekran görüntüleri gerçek DPI ile alınır ve en küçük metinler mm cinsinden ölçülür.
- **Flaş:** Kayıt listesindeki efektler telefonda gözle izlenir.

**Yapıldı (2026-11-11):** Galaxy S22 (SM-S901E), Chrome 155. Görünüm 360×682 CSS px, DPR 3; oyunun yazı tipleri yüklü (Archivo, Saira, IBM Plex). Çıktılar: `out/ui-audit/2026-11-11-s22/`.

- **Ölçüm, telefon ve emülasyon:** 10 ana yüzey (fırlatma, üs filosu, istihbarat, rapor, klan yardımı, ödüller, menü, bildirim merkezi, arena hangarı, galaksi HUD'u) iki yerde ölçüldü: telefondaki Chrome ve aynı görünümdeki (360×682, DPR 3) masaüstü Chromium.
  - Yazı boyutları, satır kırılmaları ve üç noktayla kesilen metinler birebir aynı.
  - Kontrast hatası 240/238, 44 px altı hedef 238/242.
  - Sonuç: emülasyon telefonun yerine geçebilir; baseline'ın telefon sayıları geçerli.
  - Tek fark "kırpılan metin"de çıktı ve bir araç hatasını ortaya çıkardı (1.7, kırpılma kuralı).
- **Okunabilirlik:** En küçük 71 metin telefonun kendi ekran görüntüsünde mürekkebiyle ölçüldü (`competitor.ts` yöntemi). 70'i ölçülebildi. Telefon yazıyı CSS boyutunda çiziyor (sapma medyanı +%3; büyütme yok).
  - 9 px: em 1,62 mm, x-yüksekliği 0,83 mm, 33 cm'de 0,145°.
  - 10 px: 1,79 / 0,93 mm, 0,161°.
  - 12 px: 2,15 / 1,11 mm, 0,193°.
  - Araştırmadaki tahminle (0,12–0,15°) aynı; rahat okuma eşiği (~0,2°) 12–13 px'te başlıyor.
- **Flaş:** Telefonun kendi ekran kaydıyla (`screenrecord`, DevTools ayrıkken) Ölüm Yıldızı isabeti, gezegen savaşı, Tempest motoru, radyasyon bombası ve sıçrama kaydedildi. Kayıtlar ffmpeg ile 60 kare/sn'ye çevrildi ve aynı analizörle okundu (S22 için 0,179 mm/CSS px).
  - Beşi de geçti (0 genel, 0 kırmızı flaş/sn).
  - Şeritler gözle kontrol edildi: nişan, patlama ve sönme kayıtta görünüyor.
- **Sorun ve çözüm:** 3D galaksi sayfasında DevTools ekran görüntüsü bir kez takıldı ve Chrome'un ekran yakalaması tamamen kilitlendi (about:blank'te bile). Chrome yeniden başlatılınca düzeldi; ikinci denemede galaksi sorunsuz ölçüldü. Kural: telefonda 3D sayfa en sona konur.
- **Telefon geri verildi:** `min_refresh_rate` silindi, adb yönlendirmeleri kaldırıldı.

### 1.13 Rakip ölçümü (owner'ın yapacakları)

**Ne zaman:** 1. aşama sürerken, istediğin zaman. 2. aşamada standart kararları verilmeden önce bitmiş olmalı.

**Oyunlar:** Hepsi tür olarak bize yakın ve en çok kazanan oyunlar arasında:

- Clash of Clans
- Clash Royale
- Rise of Kingdoms
- Star Trek Fleet Command
- Whiteout Survival

**Ayarlar:**

- Telefonun yazı boyutu ve ekran yakınlaştırması varsayılan değerde kalmalı. Claude bunları adb ile okuyup kaydeder.
- Oyun Türkçe destekliyorsa Türkçe oynanmalı.

**Her oyun için alınacak ekranlar.** Telefonun normal ekran görüntüsü kullanılır; görüntü kırpılmaz ve düzenlenmez.

1. İlk açılış eğitiminin ilk 2–3 ekranı (zaten yeni kurulum yapılacak).
2. Ana ekran veya HUD (kaynak sayaçları görünürken).
3. Bina veya birim yükseltme ekranı (maliyet ve süre görünürken).
4. Saldırı öncesi hedef veya keşif ekranı.
5. Savaş sonucu veya raporu.
6. Harita (oyunda varsa).
7. Sohbet veya klan ekranı.
8. Mağaza.
9. Bir onay penceresi (örneğin elmasla hızlandırma).
10. Ayarlar.

Oyunun ileri seviyesine gitmek gerekmez; erken oyun ekranları yeterli.

**Teslim:** Telefonu USB ile bağlarsın. Claude dosyaları `adb pull` ile alır. Böylece görüntüler sıkıştırılmadan gelir ve ekran yoğunluğu (`wm size`, `wm density`) aynı oturumda okunur.

**Alınanlar (2026-11-11 01:28–02:29):**

- 116 görüntü, `out/competitors/2026-11-11/` (git dışında).
  - Whiteout Survival: 55, Türkçe, dikey.
  - Clash of Clans: 36, Türkçe, yatay. İlk açılış eğitimi dahil.
  - Star Trek Fleet Command: 24, İngilizce, yatay.
  - Bir sistem izin ekranı: inceleme dışı.
- **Cihaz:** `wm size` 1080×2340, `wm density` 480 (1 dp = 3 px), 428,6 × 424,5 dpi, `font_scale` 1,0, zorlanmış yoğunluk yok (`device.txt`).
- **Seçilen oyunlar:** Owner üç oyun seçti. Ağırlık Whiteout'ta, çünkü bizim gibi dikey. Rise of Kingdoms çekilmedi.
- **Clash Royale (2026-11-11 15:44–15:53, owner önerimi kabul etti):** 33 görüntü, Türkçe, dikey, yeni hesap. `out/competitors/2026-11-11/clash-royale/`. 10 ekran ölçüldü (103 ölçüm); sonuçlar araştırma §7.2'de.

**Ölçüm yöntemi:** `packages/ui-audit/src/competitor.ts`.

- **Metin:** Kırpılan satırın mürekkep yüksekliği ölçülür.
- **Font boyutu:** Yazının biçimine göre tahmin edilir:
  - büyük harf ve rakam: yaklaşık 0,72 em;
  - kuyruklu harfli satır: 0,95 em;
  - üst işaretli büyük harf: 0,88 em;
  - yalnız küçük harf: 0,52 em.
- **Doğruluk:** Tahmin yaklaşık %10 doğrudur. Kontur ve gölge mürekkebe sayılır, bu yüzden konturlu oyun yazısı biraz büyük çıkar.
- **Buton:** İçinden bir noktadan dolgu yapılarak ölçülür.
- **Bizim ekranlar:** Aynı yöntemle ölçülür. S22'de 1 CSS px = 1 dp.
- **Ton sayısı:** Rakiplerde otomatik sayılmaz. İllüstrasyonlu ekranda geçişler bütün tonları birbirine bağlıyor; renk rolleri gözle not edilir.

**Claude'un yapacağı:** Her ekranda en küçük metni, gövde metnini, başlığı, buton ve dokunma hedeflerini piksel, dp ve mm olarak ölçer. Ekrandaki ton sayısını ve metin/ikon oranını çıkarır. Sonuçlar araştırma raporuna §7.x olarak eklenir.

**Yapıldı:** Whiteout, Clash of Clans ve Star Trek araştırma §7.1'de; Clash Royale §7.2'de; ekran başına kelime (Whiteout ve Clash Royale, elle sayıldı) §7.3'te. Elle sayılan kelimeler spec dosyalarında `words` alanında. Ton sayısı ve metin/ikon oranı yapılmadı; nedeni 1.9'da.

### 1.14 Aşama 1 review'u (2026-11-11)

Plan maddesi maddesi ölçülenle, kod da ölçüm hatası arayarak okundu.

**Tutan:** 1.2'deki bütün ölçütler raporda var. 144 giriş yolunun hepsi ölçüldü. Kalibrasyon sayfası plandaki her ihlali içeriyor. Flaşta 10 an kaydedildi, hepsi geçti. S22 turu ve rakip ölçümü bitti.

**Düzeltilenler (testli):**

| Bulgu | Etki | Düzeltme |
|---|---|---|
| Rakip ölçümünde "/" kuyruklu harf sayılıyordu | Clash Royale sayaçları %25 küçük çıktı (9,1 → 12) | Spec satırı biçimi söyleyebiliyor (`shape`) |
| Harften ayrık "İ" ve "Ö" noktaları atılıyordu | İki Whiteout satırı küçük çıktı (9,1 → 11,7; 12,1 → 15,2) | Üst işaretli satırda işaret satıra dahil |
| Renk geçişli Clash Royale butonlarında dolgu yalnız parlak bandı buldu | 9 buton küçük ölçüldü | Dolgu noktası butonun alt gövdesine kondu |
| Owner'ın metin yükü sorusunun ölçütü yoktu | — | Raporda "Metin yükü (W1)" bölümü: ekran başına kelime ve uzun blok |

**Belgede düzeltilenler:**

- "Hedeflerin %100'ünde basma tepkisi yok" → %96.
- Araştırmadaki hareket alanı kuralı: dokunma hareket alanında da çalışır, sorun yalnız sürüklemede (Android belgesi).
- En kötü 20 tablosu kırpılma hatasından az etkileniyor (19/20 aynı).
- Bilerek ölçülmeyen dil ve ekranlar 1.6'ya yazıldı.
- C2 kare sayısı, uygulandığı hâliyle yazıldı.

**Owner kararı gereken iki konu (cevaplandı, 1.11 #6 ve #7):**

1. **K4 ölçütü yanlış şeyi sayıyor.** Kenara yakın 3.553 hedefin neredeyse hepsi dokunmalı kontrol; 12 px yan boşluk yüzünden tam genişlikli her satır sayılıyor. Öneri: K4 yalnız sürüklenen kontrolleri (kaydırıcı, yatay kaydırılan şerit, sürüklenen öğe) saysın; en sondaki tam yeniden ölçümden önce araç düzeltilsin. Ayrı bir ürün sorusu: galakside kamera sürükleme ekran kenarından başlayınca telefonun geri jestiyle çakışıyor olabilir (4. aşama).
2. **1.1'deki durum listesi yapılmadı.** Plan her yüzey için boş, tipik, yoğun, kilitli, bekliyor ve hata durumlarının yazılmasını istiyordu. Envanter giriş yollarını (144) listeliyor ama hangi yolun hangi durum olduğunu ve hangi durumun eksik olduğunu söylemiyor. Öneri: 4. aşamada her ekranın kontrol listesine konsun; her ekran değişmeden önce durumları çıkarılsın ve eksik durum ölçülsün. 2. aşamanın kararları için bugünkü kapsam yeterli.

**Kapı:** Review sonrası `packages/ui-audit` yeşil: 214 test geçti, tür denetimi ve lint 0 hata (çıkış kodlarıyla doğrulandı). Tam `pnpm verify` bugün daha önce koşuldu; bilinen tek kırmızı web'deki `intel-render` (klan kopyasının eskimiş snapshot'ı). O zamandan beri yalnız `packages/ui-audit` ve belgeler değişti.


---

## Aşama 2: Standart kararları (taslak, 2026-11-11)

Bu bölüm bir taslaktır. Çalışma kuralı 4 gereği aşama başlamadan önce owner ile birlikte detaylandırılır.

**Amaç:** Oyunun arayüz standardını owner ile birlikte, sayıya dayanarak karara bağlamak. Bu aşamada oyun ekranları değişmez. Çıktı yazılı bir standarttır: değerler, kurallar ve gerekçe. 3. aşama bunu token'lara ve koruyucu testlere çevirir, 4. aşama ekran ekran uygular.

**Yöntem:** Her karar için aynı paket hazırlanır:

- ölçülen bugünkü durum (1. aşama);
- rakip ve araştırma verisi;
- 2–3 seçenek ve her birinin bedeli;
- benim önerim.

Owner seçer; karar standarda yazılır.

| # | Karar | Dayandığı veri | Karar sorusu |
|---|---|---|---|
| 2.1 | **Oyun arayüzü dili (sanat yönü)**, ilk karar | Owner tespiti; rakip ölçümü (§7.1–7.2) | Filo gönderme ekranı iki yönde çizilir: mevcut dil ve oyun dili (malzemeli panel, kalın konturlu oyun fontu, resimli ikon, basınca göçen ve ses/titreşim veren buton, net renk rolleri). İkisi S22'de yan yana görülür ve owner seçer. Font ailesi ve ağırlığı da burada seçilir. Diğer kararlar buna göre verilir |
| 2.2 | Yazı ölçeği | Telefonda metnin %73'ü 11 px'in altında. A ve B senaryolarının bedeli (A: kesilen metin 591→862, kaydırma +%6). Rakipte cümle 10–14 dp, buton 15–25, başlık 19–27 | Taban boyut, ağırlık ve hiyerarşi oranı birlikte: micro, caption ve body tabanı; buton yazısı; başlık; küçük büyük harf kuralı. Seçenekler araştırma §8.1 (a), (b) ve (c) |
| 2.3 | Metin bütçesi | Bizde ekran başına kelime ortancası 65; Clash Royale 30, Whiteout 55. Kelimelerin yarısı uzun bloklarda | Ekran tipine göre kelime ve cümle sınırı (§4.3 taslak). Silme, kısaltma ve dokununca açılan sheet'e taşıma kuralı |
| 2.4 | Dokunma ve yerleşim | Hedeflerin %77'si 44 px altı. Rakipte tek büyük birincil eylem, diğerleri "geniş ve ayrık" | En küçük dokunma alanı (44/48); görünen boyut ile dokunma alanının ayrılması (`hit-44`); aralık; birincil eylemin boyutu ve yeri; kapat butonunun sabit yeri; sürükleme kuralı (1.11 #6) |
| 2.5 | Renk rolleri ve kontrast | Metinlerin %22'si kontrastta kalıyor; `text-threat` 4,45; renk körlüğünde alaşım ↔ döteryum ΔE 15 | Eylem, ilerleme, tehlike ve nötr renkleri; `text-threat` → `text-threat-ink`; değişken zeminde plaka veya perde kuralı; ikon ve şekil eşliği |
| 2.6 | Süreler ve geri bildirim | Basılan hedeflerin %96'sında tepki yok; 989 geçiş 300 ms'den uzun; basılı tutma 165–850 ms arasında dağınık | Basma tepkisi ≤100 ms; buton animasyonu 80–160 ms; geçişler 150–300 ms; eylemin ağırlığına göre basılı tutma süresi ve dokunma alternatifi; ses ve titreşim katmanları |
| 2.7 | Boşluk | Değerlerin %38'i 4 px ızgarasının dışında (L2) | Izgara ve iç/dış boşluk ilişkisi |
| 2.8 | Sayı biçimi (öneri) | Araştırma §9.6: `Intl` "1,2 B" veriyor, oyunlarda yaygın olan "1.2K" | Kısa sayı biçimi ve "mevcut → yeni" gösterimi |

**Karar paketleri (2026-11-12):** 2.2–2.9'un her biri [ui-standart-karar-paketleri-2026-11-12.md](ui-standart-karar-paketleri-2026-11-12.md) içinde. Hepsi kararlandı. 2.9 görünüm (owner: "mavimsi panel" ve "fazla casual") Komuta + Grafit oldu ve kitin varsayılanına katlandı. Hiçbir oyun ekranı değişmedi.

**Sanat üretimi: ne zaman, kim, nasıl (owner onayı 2026-11-11):**

- **Ne zaman:**
  - 2.1: yalnız filo gönderme ekranına yetecek örnek varlıklar (birkaç ikon, bir buton, bir panel, font adayları).
  - 3. aşama: seçilen yönün tam oyun arayüzü kiti.
  - 4. aşama: bir ekrana özel görseller, o ekranla birlikte.
- **Kim:**
  - Claude: sanat yönü belgesi (renk, ışık yönü, kontur, malzeme ve ikon kuralları), her görselin tarifi, kodla yapılabilen parçalar (buton, panel, çerçeve, parlama, basma animasyonu), entegrasyon, ses, titreşim ve ölçüm.
  - Codex: resim gerektiren parçalar (resimli ikon, illüstrasyon, panel dokusu, konsept). Çıktıyı Claude denetler; yöne uymayanı yeniden ürettirir, uyanı temizleyip boyutlandırır.
  - Oyunun 3D modelleri: gemi, gezegen ve kaynak ikonları mevcut modellerden render edilir (öneri).
  - Owner: yön seçimi ve onay; gerekirse 3D model.
- **Nasıl:** Konsept görsel yönü hızlı görmek içindir. Karar ise gerçek kodla, galeride, gerçek font ve metinle 350 px'te verilir; owner S22'de dokunup basarak seçer. Her parça ekran görüntüsüyle ve S22'de kontrol edilir, ölçüm aracı yazı, kontrast ve dokunma sayılarını verir.

**Sıra:** Önce 2.1, çünkü font, buton ve renk kararlarını belirliyor. 2.2–2.7 ondan sonra gelir ve birbirine bağlı olduğu için birlikte değerlendirilir. 2.8 küçük bir ektir.

**Bu aşamaya girmeyenler:**

- Erişilebilirlik ayarları (yazı boyutu, renk körlüğü ön ayarı, flaş azaltma): 5. aşama.
- Risk ve olasılık iletişimi, ses UX'i, Türkiye verisi: 6. aşama (araştırma §9).
- Ekran durumu listesi: 4. aşama (1.11 #7).

**Bitiş ölçütü:** Her kararın standart belgesinde değeri, gerekçesi ve ölçülebilir karşılığı var (ör. "okunan metin ≥ X px": T1 sayısı). Böylece 3. ve 4. aşama "ölçüm temiz" ile kapanabilir.

### 2.1 Oyun arayüzü dili: ayrıntılı plan (taslak, 2026-11-11)

**Owner kararları (2026-11-11):**

1. **Yön B, oyun dili, doğrudan seçildi.** A yönüyle karşılaştırma yapılmaz. Hedef: Whiteout Survival, Clash of Clans ve Clash Royale gibi bir mobil oyun görünümü, ama uzay oyunu tarzı korunarak. Owner: "Şuanda bir çok tasarımımız bir web form oyunu hissi yaratıyor."
2. **Önce konsept görseller.** Claude Codex konseptlerini kendi ölçütlerinden geçirir ve owner'a yalnız geçenleri gösterir.
3. **Font Claude'a bırakıldı.** Claude 2–3 fontu oyun içinde göstererek önerir.

Aşağıdaki "iki yön" ve 6. adımdaki karşılaştırma bu kararla güncellendi. A yönü çizilmez. Mock yalnız B'dir; S22'de font seçeneği ve önce/sonra (bugünkü ekran) görülür.

**Amaç:** Owner iki yönü aynı ekranda, kendi telefonunda dokunarak karşılaştırır ve birini seçer.

**Çıktılar:**

- Seçilen yön.
- Kısa sanat yönü belgesi: biçim, değer, renk rolleri, kenar, malzeme, ışık, ayrıntı ve hareket.
- 3. aşamadaki oyun arayüzü kitinin listesi.

**Ekran:** Filo gönderme (`LaunchSheet`, `gallery:launch` hâli: Tharsis'e saldırı, dört gemi tipi). Seçilme nedenleri:

- Temel döngünün eylem anıdır (DISPATCH).
- En çok sayı ve karar taşıyan ekrandır.
- "− 0 +" form düzeni en belirgin burada.

**Bulgu (2026-11-11):** Oyunda zaten resimli, tutarlı tarzda 300–450 px gemi, kaynak, bina ve klan render'ları var (`public/assets/images/`). Filo ekranı gemileri ~24 px'te gösteriyor. `visual-design.md` bunu zaten yasaklıyor: "Sanat kahramandır; 40 px'te kullanılan render favicon gibi görünür." Oyun dili için gereken resimlerin çoğu bu yüzden hazır. Codex'e kalan iş daha çok arayüz malzemesi ve küçük durum ikonları.

**İki yön:** Aynı veri, aynı kurallar; mekanik değişmez.

- **A: bugünkü dilin düzeltilmiş hâli (Command Deck).** Aynı ince estetik, ama ölçümün bulduğu açıklar kapatılmış: yazı tabanı, kontrast, dokunma alanı ve basma tepkisi. Böylece karşılaştırma "kusurlu mevcut ↔ oyun dili" değil, "mevcudun en iyisi ↔ oyun dili" olur.
- **B: oyun dili.**
  - **Gemi seçimi:** Resimli gemi kartları; mevcut render kartta büyük ve üstünde sayı rozeti. Dokununca +1, basılı tutunca hızla artar. "Maks" kartın içinde.
  - **Yazı:** Kalın ve konturlu oyun fontu. Adaylar:
    - Saira'nın kalın ağırlıkları (zaten yüklü);
    - Russo One;
    - Oxanium ExtraBold.

    Hepsi OFL lisanslı. Türkçe harfler mock'ta denetlenir. Mock'ta font değiştirici olur.
  - **Birincil buton:** Malzemeli birincil buton; bombe, üst parlama, koyu alt kenar ve kalın kontur. Büyük ve alt ortada. Basınca göçer, ses ve titreşim (`lib/sound`, `haptic('commit')`) verir.
  - **Panel:** Metal plaka çerçeve. Command Deck'in "plaka, levha, yuva" fikri kalın ve resimli hâlde.
  - **Renk rolleri:** sarı-turuncu birincil eylem, yeşil ilerleme, kırmızı tehlike ve kapat, mavi panel ve normal eylem.
  - **İkonlar:** Kaynak ikonları mevcut resimli PNG'ler. Yakıt, kargo, süre ve yuva için 3–5 küçük resimli ikon Codex ile üretilir.
  - **Metin:** Aynı bilgi daha az kelimeyle. Açıklama "Bu nedir?" sheet'ine taşınır (metin bütçesi 2.3'ün ilk denemesi).

**Adımlar:**

| # | Adım | Doğrulama |
|---|---|---|
| 1 | Codex'e B yönü için 2–3 konsept görsel çizdirilir (filo gönderme, 350×812 dikey) | Owner yorumu: "bu yön mü, ne değişsin?" |
| 2 | B için kısa sanat yönü belgesi taslağı | Owner okur |
| 3 | Galeride iki görünüm, aynı veri: `?view=launch-direction&dir=a\|b`, yön ve font değiştirici | Ekran görüntüsü, 350 px'te taşma yok |
| 4 | B'nin varlıkları: buton ve panel CSS ile; 3–5 ikon Codex ile; gemiler mevcut render'lardan | Kontak sayfası; ikonların telefonda okunduğu ekran görüntüsü |
| 5 | İki yön ui-audit'ten geçer (T1, C1, K2, F1, W1). S22'de kare süresi ölçülür | Yan yana sayı tablosu |
| 6 | Owner S22'de iki yönü dener ve seçer | Karar standarda ve plana yazılır; 3. aşama kit listesi çıkar |

**Karar ölçütleri:**

1. Oyun hissi (owner).
2. Okunabilirlik sayıları.
3. 350 px'te sığma.
4. S22'de performans.
5. Üretim maliyeti: kaç Codex görseli gerekiyor.

**Kurallar:**

- Oyun ekranlarına dokunulmaz; iki yön yalnız galeride.
- Yeni galeri görünümü envanter testine eklenir; mantık içeren kısım (yön ve font değiştirici) testle yazılır.
- Mock'ta "kompakt premium", çizgi ikon kuralı (`visual-design.md`) ve −2 px yazı ölçeği B için askıya alınır. Bunlar bu kararın konusudur (çalışma kuralı 1 ve 3).

## Aşama 3 öncesi: oyun arayüzü kiti, ilk sürüm (2026-11-11)

Owner isteği: "Komple full bir ui-kit oluştur. Birbirleriyle uyumlu olsun; bunlar birleşince tüm UI oluşacak." Oyun ekranlarına dokunulmadı; kit yalnız galeride.

**Yer:** `apps/web/src/game-ui/` (önek `gk-`). Renkler yalnız `tokens.css`'te; test ham rengi başka dosyada yakalar.

**Parçalar:** malzemeli buton (eylem/çelik/sen/tehlike/hayalet, maliyet ve kilit sebebiyle), yuvarlak buton, çip, basılı tutma (`useHoldPress`, v2 `HoldButton` ile aynı kural), plaka/cam yuva/kesik köşe/bölüm etiketi, sayı/çarpan/seviye/kilit rozetleri, sınıf amblemi, ilerleme/güç aralığı/harcama/kargo çubukları, değer plakası, kaynak HUD'u, zaman halkası, sıra satırı, sheet çerçevesi, diyalog (şerit ve ışın), şerit/blok/toast bildirim, boş durum, rehber el, şalter, kol (hız), slider, sekmeler, alt menü, bilgi açılımı, metin alanı, gemi kartı (dokun +1, basılı tut hızlanır, kaydırma saymaz) ve gemi bölmesi.

**Galeri:** `?view=ui-kit` (katalog), `ui-kit-launch` (`&layout=bay`), `ui-kit-base`, `ui-kit-hud`, `ui-kit-list`, `ui-kit-report`. Ekran görüntüleri `out/ui-kit/` (son tur `r4`).

**Doğrulama:** 51 kit testi + bağlı v2 testleri yeşil (190); typecheck ve lint temiz; 350×812 DPR 2 fotoğraf turu (r1→r3) ve tarayıcıda oynanış (kart → güç/yakıt/sayı, basılı tut → toast, yükselt → kuyruk, ganimet al).

**Kararlar (owner, 2026-11-12):**

1. ~~Başlık fontu **Russo One**~~ → 2.9 kararıyla (Komuta + Grafit, 2026-11-12) başlık fontu **Saira Variable 700, %84 genişlik** oldu; Russo One paketi kaldırıldı. Bkz. `ui-standart-karar-paketleri-2026-11-12.md`.
2. ✅ Alaşım bakıra kaydı: `--gk-alloy` #f2a14a → #c27a55 (+ `-hi` / `-lo`). Eylem amberinden ΔE 14 → 42; döteryumla döteranopide ΔE 11 → 38; koyu zeminde kontrast 5,7. Oyunun bugünkü ekranları (`--color-v2-alloy`) 4. aşamada kite geçerken değişir.

3. ✅ Kit, ölçüm aracına ayrı bir "kit" yüzeyi olarak eklendi (`KIT_SURFACES`). `pnpm ui:audit run --kit` ve `report --kit` kendi klasörüne (`out/ui-audit/kit-<tarih>`) ve raporuna (`reports/ui-audit/kit-<tarih>.md`) yazar; oyunun baseline'ına ve toplamlarına hiç girmez. Koruyucu test: her kit görünümü ölçülür ya da gerekçeyle dışarıda kalır (`ui-kit-standard`: owner karar sayfası).

**Kalan (Codex ve sonraki tur):** resimli ikon seti, 9-slice malzeme dokuları, VFX ve ödül animasyonları, UI ses seti, S22 turu.

**Hazır varlık seçimi (2026-11-12):** `ui-kit-varlik-secimi-2026-11-12.md`. Panolar `out/ui-kit/assets/` altında.

- **Yapılanlar:**
  - Kontroller CSS'te kalır.
  - Resimli ikonlarda ev tarzı seçildi: koyu metal, kehribar ışık. Codex stil tohumuyla belirlendi. Layer Lab'den yalnız metal ve altın nesneler alınır (madalya, kupa, taç).
  - Şeref −2…+2 rozetleri Synty katmanlarından birleştirilir.
  - Klan kimliği mevcut bayrak skinleridir; küçük boyda amblem karosu kullanılır. Klan seviyesi 1–10 Synty rütbe şeritleriyle gösterilir.
  - Glifler Layer Lab Picto ve Synty'den SVG'ye çevrilir.
  - VFX three.js'te kurulur; doku Unity paketlerinden gelir.
- **9-slice dokular alınmadı;** gerekçesi belgede.
- **Codex işleri bitti:** 25 ikon ev tarzında çizildi ve 160/64/48/32 px'te denetlendi (kapsül, kargo, yuva, kilit, hediye, reklam ödülü, Ölüm Yıldızı, 4 alt menü, 7 menü, 7 kozmetik). Sıralama ikonu ikinci sürümüyle alındı. Toplu görünüm: `out/ui-kit/assets/codex/codex-ikonlar.png`. Henüz kite girmedi.
- **Ses:** Owner 6 Kenney ses paketi indirdi (CC0): arayüz, UI, dijital, bilim kurgu, çarpma, nesne. Kütüphanede 498 ses var (Space Combat Kit'in 33'ü dahil). Eşleme kitin entegrasyon turunda yapılır.

**Durum güncellemesi (2026-11-12):** Resimli ikonlar (32) ve seçilen 8 arayüz sesi kitte. 18 eski ince glif paketlerden yeniden çizildi. Kit kendi ölçüm yüzeyine kavuştu. Kalanlar: VFX ve S22 turu.

## Aşama 3: Altyapı (owner ile planlandı 2026-11-12, uygulanıyor)

Owner sorulara cevap verdi ve sırayı onayladı ("Şimdi neye başlayacaksın?" → plan).

**Amaç:** 2.2–2.9 kararlarını kitte tek bir yere, token'a bağlamak ve koruyucu testle kilitlemek. Böylece kit 4. aşamada ekranlara hazır hâle gelir. Oyun ekranları bu aşamada da değişmez.

| # | İş | Çıktı | Bitiş ölçütü |
|---|---|---|---|
| 3.1 ✅ | Yazı ölçeği: kitin ölçeği (B) | Kitin bugünkü `--gk-t-*` token'ları kilitlendi: 12 / 13 / 14 / 16 / 19 / 24, sayı 18. Ölçek dışı üç metin ölçeğe oturdu: SALDIR 26 → 24, bölme sayısı 22 → 24, seviye rozeti 15 → 16 | `test/game-ui/type-scale.test.ts`: kitte token dışında yazı boyutu yok (glif kutuları gerekçeyle listede); hiçbir adım 12 px altında değil |
| 3.2 ✅ | Metin bütçesi "Bütçeli" | W1 raporu bütçeyi tartar: ekran başına kelime ortancası ≤ 55, uzun blok ortancası ≤ 1; aşan ekranları adıyla listeler | `packages/ui-audit/test/report.test.ts` |
| 3.3 ✅ | Dokunma 44 px | `gk-hit` yardımcısı zaten vardı. Ölçümde gerçek eksik yalnız hız kolu duraklarıydı (34–36 px); 44 px oldu. Kalan küçükler ölçüm parçasının kenarında yarım kalan hedefler | Kit ölçümü (3.8) |
| 3.4 | Renk rolleri A | Token'lar ve kural testleri hazır | Hazır |
| 3.5 ✅ | Süreler | `--gk-panel: 160ms`; diyalog 280 ms yerine onunla açılıyor. `GameHold` serbest `holdMs` yerine ağırlık alıyor: `reversible` 0,6 / `spends` 1 / `final` 1,5 sn (hangi eylemin hangisi olacağı 4. aşamada) | `tokens.test.ts`, `buttons.test.tsx` |
| 3.6 ✅ | Kenar boşluğu 12 px | `--gk-gutter: 12px`; sheet başlığı, gövdesi, alt şeridi, katalog ve HUD 10/8 px'ten 12 px'e geçti | `tokens.test.ts` |
| 3.7 ✅ | Sayı biçimi K/M | Oyunun tek kısa biçimlendiricisi `lib/format.compact` değişti: altı dilde K/M, her boyutta tek ondalık, ",0" atılır, 999.960 → 1M. Eşikler aynı kaldı (B1: depo 99.999'a kadar tam). Bu dalda oyun ekranlarındaki kısa sayılar da K/M'ye geçti | `i18n.test.ts` + ekran testlerindeki yansımalar |
| 3.8 ✅ | Kit ölçümü | `reports/ui-audit/kit-2026-11-12.md` (84 ölçüm, 6 dil, 3 boyut): 12 px altı yazı 0, kontrast 0, ikon kontrastı 0, 44 px altı hedef 0, 2.5.8 aralık 0, tepkisiz hedef 0. Kesilme 1: Japonca 320 px'te galerinin Türkçe örnek kelimesi "Gönderiliyor" (gerçek Japonca metin sığıyor). Değişen görünüm ve araç düzeltmeleri: `docs/ui-standart-karar-paketleri-2026-11-12.md` "Kit ölçümüyle değişen görünüm". L2 (%46,6 ızgara dışı boşluk) 4. aşamanın ekran düzeni işi | Raporda küçük yazı ("Bugün" tabanına göre), kontrast, 44 px, basma tepkisi ve kesilme temiz |
| 3.9 ⏸ | S22 turu | Kit ekranları telefonda; owner 2026-11-12: "S22 işini sonlara bırakalım" | Owner dokunarak onaylar |

**Owner'a sorular:**

1. **Başlık ve buton yazısı:** Saira dar yüz, aynı piksel boyutunda Russo One'dan küçük görünüyor. Bu iki rolü ölçerek 1–2 px büyütelim mi?
   - ✅ Owner 2026-11-12, yan yana görselden sonra (`out/ui-kit/fixes/yazi-boyu-karsilastirma.png`): "Şu anki gayet iyi duruyor, gereksiz büyütmeyelim." Büyütme yok.
   - ✅ Netleşti (owner 2026-11-12, aynı görseli gönderip): "Bugün" derken görseldeki "Şimdi" sütununu, yani kitin bugünkü boyutlarını kastetmiş. 2.2 kitin ölçeği (B) olarak düzeltildi; 3.1 onu kilitler.
2. **%115 yazı boyutu ayarı:** "Bugün" ölçeğinin güvenlik supabı olarak 5. aşamadan bu aşamaya alalım mı?
   - ✅ Owner 2026-11-12: aciliyeti yok, 5. aşamada kalır.
3. **Basılı tutma ağırlıkları:** 3. aşama üç seviyeyi kurar. Hangi eylemin hangi ağırlığı alacağı 4. aşamada ekranla birlikte mi kararlaştırılsın?
   - ✅ Owner 2026-11-12: evet, 4. aşamada.

## Aşama 4: Ekran ekran uygulama (owner ile planlandı 2026-11-12, uygulanıyor)

**Owner kararları (2026-11-12):**

1. **Sıra:** yeni oyuncunun ilk oturumdaki yolu. (1) Üs: inşa ve üretim, (2) tersane ve filo, (3) istihbarat: teleskop, radar, sonda raporu, (4) filo gönderme, (5) savaş raporu ve tekrar, (6) ödüller. Sonra kalan ekranlar, en kötü ölçüm puanından başlayarak.
2. **Yayın:** her ekran hazır olunca çıkar ("her ekran hazır olunca çıkıcaz"). Yayın komutu yine owner'dan gelir; hazır ekran master'a alınır, owner "çıkar" deyince canlıya gider.

**Her ekranda aynı adımlar:**

1. Ekranın durumları çıkarılır: boş, tipik, yoğun, kilitli, bekliyor, hata (1.11 #7). Eksik durum galeriye eklenir ve ölçülür.
2. Kit parçaları takılır. Eksik parça önce kite eklenir (galeri + test), sonra ekrana.
3. Basılı tutma ağırlığı seçilir (geri alınabilir 0,6 / harcayan 1 / kesin 1,5 sn) ve owner'a gösterilir.
4. Kelime bütçesi (≤ 55 kelime/ekran, ≤ 1 uzun blok) ve yalnız renkle anlatılan bilgi denetlenir.
5. Ölçüm temiz (T1, kontrast, 44 px, aralık, basma tepkisi, kesilme) ve testler yeşil.
6. Owner görsele bakar; bakmadan sonraki ekrana geçilmez.

**Ekranlara gelince bakılacaklar:** galakside kenardan başlayan kamera sürüklemesi ile telefonun geri hareketi (1.14 #1); v2 rakip pembesi ve klan mavisi kite gelirse sınıf renkleriyle kıyas; K4 ölçütü yalnız sürüklenen kontrolleri sayacak şekilde düzeltilir (en sondaki tam ölçümden önce).

### 4.1 Üs: inşa ve üretim

**Kapsam:** gezegen sayfasının çerçevesi ve Üretim sekmesi (`screens/PlanetScreen.tsx`: başlık, gezegen kartı, depo çubukları, radyasyon satırı, kuyruklar, sekmeler, `Grow`), bina yükseltme sayfası (`ui/ItemSheet.tsx`; araştırma ve uydu da aynı sayfayı kullanır, onlar da kit görünümüne geçer) ve kuyruklar (`v2/shell/BaseQueues.tsx`). Gemi üretim sayfası (`BuildSheet`) 2. ekranla gelir. Filo, savunma ve taktik sekmeleri sıradaki ekranlarla gelir. Üst HUD ayrı bir adım (bütün ekranlarda görünür).

**Hedef görünüm:** kit galerisindeki `ui-kit-base` (owner gördü).

| Parça | Bugün | Kitte |
|---|---|---|
| Sayfa başlığı | v2 başlık | `gk-sheet__head` |
| Gezegen kartı | yörünge yuvaları, ad, kademe | aynı içerik, kit yazısı ve rozetleri |
| Depo çubukları | korunan dilimli çubuk | kitte yok: önce kite eklenir |
| Kuyruk yuvaları | boş / süren / sırada | `TimerRing` + kit yuvası |
| Sekmeler | v2 sekme | `GameTabs` |
| Bina kartı | resim, seviye, etki, bedel, süre, bekleme | kit plakası + bedel çipi + kilit |
| Yükseltme sayfası | v2 sayfa (`ItemSheet`) | `ui-kit-base` kompozisyonu |

**Durumlar (kod ve galeriden çıkarıldı, 2026-11-12):**

| Yer | Durumlar |
|---|---|
| Bina kartı ve yükseltme sayfası | alınabilir · kaynak eksik ("bu hızla N dk sonra") · yakıt eksik (süre söylenemez) · şartlı kilit (Çekirdek seviyesi / araştırma basamağı, çözüme götürür) · kuyruk dolu · sırada (N) · gönderiliyor · en üst seviye · hiç yapılmamış (Sv. 0) · arızalı · eğitimde vurgulu · yeni sıraya girdi (parlama) · hata (sunucu reddi, bildirim) |
| Çekirdek 9 → 10 | ayrı onay (tatil kilidi açıklaması) |
| Kuyruk | boş yuva · süren (halka + kalan süre) · sırada · dolu · iptal ediliyor (yarısı yanar, onaylı) |
| Depo çubuğu | normal · korunan dilim · dolu (üretim durur) · boş |
| Gezegen kartı | ana gezegen · koloni · yörünge yuvası kilitli / boş / dolu |
| Sayfa | yükleniyor · veri yok / bağlantı hatası |

**Basılı tutma önerisi (owner'a gösterilecek):** Yükselt sık yapılan bir eylem ve sayfanın kendisi zaten ikinci adım (kart → sayfa → Yükselt); iptal mümkün (yarısı yanar). Öneri: tek basış (`GameButton`), sesi ve titreşimi ağır. Çekirdek 10 (geri dönüşü olmayan tatil kilidi) bugünkü onay penceresi yerine `final` (1,5 sn) basılı tutma.

**Alt adımlar:** (a) kite eksik parçalar: depo çubuğu, kuyruk yuvası, bina kartı (test + galeri); (b) yükseltme sayfası; (c) Üretim sekmesi kartları; (d) sayfa çerçevesi, gezegen kartı, depo, kuyruk, sekmeler; (e) bütün durumlar galeride, ölçüm temiz, owner'a görsel.
