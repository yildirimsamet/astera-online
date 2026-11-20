# İniş Sonrası İlk Saat: Kuruluş Saati, Korsan Senaryosu, Ekran Sırası

Tarih: 2026-11-20. Durum: **plan, uygulama başlamadı.** Yayın tek seferde, yalnız owner "deploy" dediğinde.
Bu belge iniş anından sonraki ilk saati yönetir. İniş öncesi yolculuk için [yeni oyuncu yolculuğu planı](yeni-oyuncu-yolculugu-plani-2026-11-13.md) geçerlidir; §4.7 "İniş (ilk saat)" bu belgeyle güncellenir.

## 1. Neden

B dalgası (19 Kasım, yeni yol, 15 insan hesabı, 13'ü Instagram'dan; salt okunur üretim okuması 20 Kasım):

- Ana galaksiye geçiş %5'ten %53'e çıktı. Rehberli yolda ilk emirden tersaneye kadar kayıp yok.
- Sıçrayan 8 hesaptan inişten sonra 4+ komut verenler 72–629 dk kaldı. 0–1 komut verenlerin 4'ü de ilk 45 dk'da gitti. Küçük örnek, korelasyon.
- Sıçrama kararı medyan 27 sn'de veriliyor; soruyu görenlerin hepsi sıçradı.
- İnişten sonraki ilk 1–3 dakikada, oyuncu tek komut vermeden: iniş kartı, 1–2 "galaksi etkinliği başladı" bildirimi, iniş ödülleri penceresi, marka testi, kurulum kartı, ilk hafta notu. Merkezi bir sıra yok; her yüzey kendi zamanlamasını yapıyor.
- İniş kartı, iniş ödülleri, marka testi ve ilk hafta notu telemetri yazmıyor. `landing_visible` olayı genel giriş sayfasınındır, iniş kartının değil.

Hedef: İnişten sonraki ilk saat oyuncunun kaçırmak istemeyeceği, tek bir çerçeve içinde akan, eylemle dolu bir saat olsun.

## 2. Owner kararları (2026-11-20)

| Konu | Karar |
| --- | --- |
| Senaryodaki rakip | Korsan. Komutan değil: bot kararı (2026-10-28) ve "oyuncuya saldırınca kalkan düşer" kuralı korunur. |
| Senaryoda kayıp | Gerçek kayıp yok. Oyuncu senaryo savaşlarında gemi, kaynak veya bina kaybetmez. |
| İnişte kayalar | Yanına 2 asteroid. **Kişisel**: yalnız o oyuncu görür ve kazar. |
| Yeni oyuncu ayrıcalığı | İlk 1 saat: üretim artışı ve her üretim süresi %50 kısa. Oranlar değişebilir, yeni ayrıcalık eklenebilir. Oyuncuya FOMO yaratacak şekilde ama dürüstçe sunulur. |
| Saat | Gerçek hayatta geçen süre (duvar saati). Oyundan çıkınca da işler. |
| Üretim artışı oranı | ×5 (+%400), alaşım ve kristal. Bkz. §5.1. |
| Sinyal | Bilinmeyen sinyale gidiş ve dönüş herkes için 4× hızlı. |
| Convoy | `codex/convoy-outbound-2x` (d6b7f46d) bu işin kapsamına girer, en son yapılır. |
| Sıra | 1) İniş akışı, 2) sinyal hızı, 3) convoy. Hepsi tek yayında. |
| Ekran yığılması | İnişten sonraki 10 dakikada çıkan her şey incelenir; hiçbiri üst üste binmez. |

Kilitli karar kontrolü: Bu plan bot kararına dokunmaz (kişisel nesneler ve ayrıcalık yalnız sahibine görünür, istemciye bot bayrağı gitmez). Yeni oyuncuya hız ve üretim ayrıcalığı, owner'ın bu tarihteki açık isteğidir.

## 3. Doğrulanmış gerçekler (2026-11-20, master 2c75c138)

- **İnişteki dünya:** `FIRST_SEASON_START` = Çekirdek 3, Rafineri 2, Çıkarıcı 2, Kasa 1, Tersane 1; 1.500 / 1.000 / 50; 6 gemi (3 Ok, 1 Muhafız, 1 Kazıcı, 1 Kurye).
- **Üretim:** Alaşım 147/sa, kristal 59/sa. Üretim haznesi ~14,7 saatlik üretimi tutar; 1 saatlik artış hazneyi taşırmaz. Kasa 1 depo sınırı: 4.524 alaşım / 1.810 kristal.
- **İnşaat süreleri:** Rafineri 3: 5,2 dk; Rafineri 4: 7,1 dk; Çekirdek 4: 7,1 dk; Rafineri 6: 13,0 dk; Döteryum Santrali 1: 2,8 dk.
- **Mevcut artış pencereleri:** `productionHours` (`packages/rules/src/economy.ts`) iyileşme +%50 ve sinyalin ENERGY sonucu +%100 pencerelerini destekler; çakışan pencereler toplanır. Sunucu hesabı ve istemci projeksiyonu aynı fonksiyondan geçer.
- **Süre fonksiyonları:** `buildingMinutes` (9 çağrı), `researchMinutes` (6), `satelliteMinutes` (3), `shipMinutes` (2), `defenceMinutes` (1). `tech` parametresi bilerek zorunludur.
- **Yeni oyuncu olguları:** `players.main_entered_at` her katılımda yazılır. `players.newcomer_shield_until` oyuncuya saldırınca silinir, tatilde uzar; ayrıcalık ölçütü olamaz. `accounts.first_game_shield_available` katılımda tüketilir (`apps/server/src/services/player.ts`).
- **Bilinmeyen sinyal:** Oyuncuya özel (`unknown_signal_state`). İlk oyunda ilk sinyal katılımdan 2–10 dk sonra gelir, korsan çıkmaz. Ömür 60 dk, başkente en az 400 birim. Uçuş süresi `fleetTravelExact` ile üç sunucu yerinde (gönderim, dönüş, geri çağırma; `apps/server/src/services/unknownSignal.ts`) ve istemci tahmininde (`apps/web/src/lib/unknownSignal.ts`) hesaplanır. Yakıt mesafeye bağlıdır. PIRATES sonucu filoyu kaybettirir, savaş yoktur.
- **Korsanlar:** Ana galakside korsan yalnız hedeftir, gezegene saldırmaz. Korsan şeridi sezon genelidir ve paylaşılır (`pirate_state.losses` herkesten toplanır).
- **Asteroitler:** Ana galaksi kayaları sezon anahtarından türeyen ortak bir alandır. Sybil kapısı vardır (`apps/server/src/services/asteroidSpawn.ts`). Madencilik hedefi HMAC kimliğiyle alan dizinine çözülür (`asteroidIndexFromId`, `mining_runs.asteroid_index`). Kişisel kaya bu alana sığmaz.
- **Ekran yüzeyleri:** `ArrivalHost` kart → `LandingRewards` → ilk hafta notunu kendisi sıralar. `RecallHost` marka testini 3 dk toplam aktif oyundan sonra (başlangıç galaksisi dahil, yani inişte zaten dolmuş) ve kurulum kartını 60 sn'den sonra açar; açık pencere var mı diye DOM'a bakar. `LegacyRevealHost` kendi `ready` bayrağını kullanır. Galaksi etkinliği bildirimleri hiçbir şeyi beklemez. Başlangıç galaksisinin sahne yöneticisi (`apps/web/src/starter/director/`) kamera çekimleri içindir, UI kuyruğu değildir.
- **Convoy dalı:** master'ın 466 commit gerisinde; 6 dosyada çakışma (FocusPanel, GalaxyView, IntergalacticConvoySheet, Gallery, wiki-publication testi, game-design.md). Çekirdek değişiklik kurallarda 2 satır; plan belgesi dalda: `docs/intergalactic-convoy-outbound-speed-plan-2026-11-04.md`.

Hesaplama ve okuma betikleri: `reports/` altına taşınacak (Faz 0).

## 4. Akış: inişten sonraki ilk 10 dakika

Her an tek bir şey ister. Senaryo sürerken ekran sırası başka engelleyici yüzey açmaz. Oyuncu senaryoyu her adımda bırakabilir; oyun normal devam eder.

| An | Süre | Dünyada ne olur | Oyuncunun eylemi | Karşılık |
| --- | --- | --- | --- | --- |
| 0. İniş | 0–20 sn | Uçuş sahnesi; gemi gezegene iner | — | Mevcut sahne |
| 1. Kuruluş Saati açılır | ~20 sn | Rafinerinin ocağı aşırı yükte yanar; üst çubukta 60:00 geri sayım | Kartta tek dokunuş | Ses, titreşim, ocak efekti. Kart: getirdiğin kargo tek satır ve saatin iki ayrıcalığı |
| 2. Çevreni tanı | 0,5–2 dk | Kamera iki kişisel kayaya döner | Kazıcıyı kayaya gönder (başlangıç galaksisinde öğrenilmiş eylem) | Kazı yolda; kaya yanında "senin" işareti |
| 3. Sinyal | 1–3 dk | Yakında bir korsan sinyali belirir | Sonda gönder | Rapor: korsan yuvası, gemi sayısı, ganimet |
| 4. Gemi | 2–4 dk | Tersane çalışır | Gemi üret | Fişte "Kuruluş Saati: X dk → X/2 dk" |
| 5. Saldırı | 4–6 dk | Filo 4× hızla uçar | Filoyu seç, gönder | Zafer, ganimet, ilk komutan kutusu açılır. Oyuncu gemi kaybetmez |
| 6. Misilleme | 6–9 dk | Korsanlar karşılık verir; geri sayımlı uyarı | Savunma kur (yarı sürede) | Dalga savunmaya çarpar ve kırılır. Kayıp yok |
| 7. Kapanış | ~10 dk | Saatin kalan 50 dakikası | Sıradaki hedef: rafineriyi yükselt | Özet şeridi. Bekleyen yüzeyler (marka testi, kurulum kartı, etkinlikler) sıradan tek tek gelir |
| Saat sonu | 60 dk | Ocak normale döner | — | "Kuruluş Saatinde: +X alaşım, N inşa, M dk kazandın" ve yarının kutusu |

Son 10 dakikada saat kehribar rengine döner, oyun içinde ve Android'de bir uyarı gider ("sıradaki inşayı şimdi başlat").

Kesin süreler Faz 4'teki oyun testinde ayarlanır. Ekran sırası yalnız bir düşman saldırısı uyarısının araya girmesine izin verir.

## 5. Kurallar

### 5.1 Kuruluş Saati

- `packages/rules` içinde tek tablo: `NEWCOMER_HOUR = { minutes: 60, productionBonus, timeFactor: 0.5 }`. Yeni ayrıcalık bu tabloya bir anahtar ve uygulandığı tek yer olarak eklenir.
- `players.first_game` (boolean, değişmez): katılımda `accounts.first_game_shield_available` tüketildiğinde `true` yazılır. Sonraki sezonlarda `false`.
- `newcomerHour(player, now)`: `first_game` ve `main_entered_at`'ten açık mı, `endsAt`, oranlar. Arka plan işi veya kapatılacak bayrak yoktur.
- Üretim: `productionHours` üçüncü pencereyi alır. Çakışma mevcut kuralla toplanır (ör. ilk sinyalden ENERGY gelirse kısa süre ek artış).
- Süre: bina, araştırma, uydu, gemi ve savunma süresi emir anında `timeFactor` ile çarpılır ve kaydedilir. Saat içinde başlayan iş saat dolduktan sonra bitse de yarı sürelidir. Faktör zorunlu parametredir; derleyici her çağrı yerini gösterir.
- İstemci oranı göndermez; sunucu kabul etmez.

**Üretim artışı oranı: ×5 (owner onayı 2026-11-20).** Simülasyon: paket ilk 15 dakikada harcanır, sonrasında kuyruğu süre değil kaynak tıkar. Süre indirimi ancak kaynak varsa işe yarar.

| Üretim | İlk saatte inşa (kargo yok) | Kaynak bekleme | Fazladan alaşım / kristal |
| --- | --- | --- | --- |
| Normal, tam süre | 5 | 24 dk | — |
| ×4 (+%300), yarı süre | 6 | 37 dk | +988 / +380 |
| **×5 (+%400), yarı süre** | **7** | 35 dk | **+1.318 / +507** |
| ×6 (+%500), yarı süre | 8 | 31 dk | +1.720 / +633 |
| ×10 (+%900), yarı süre | 9 | 20 dk | +3.450 / +1.280 |

Öneri ×5: "5 kat" net bir mesajdır; saatte 2 inşa fazlası ve Çekirdek 5 getirir; fazladan kaynak bir ilk sezon paketinin altındadır, sahte hesapla kasma değeri sınırlı kalır. Gerçek oyuncu araştırma ve gemiye de harcadığı için bu sayılar üst sınırdır.

### 5.2 Kişisel kayalar

- Yeni tablo `personal_rocks` (oyuncu, sezon, konum, cevher, oluşma, bitiş, kazılma). İlk oyunun inişinde 2 kaya, başkente kısa kazı mesafesinde.
- Cevher başlangıç galaksisi kayası boyunda (800–1.200, %35 kristal). Ömür birkaç saat (Faz 3'te kesinleşir). Hesap başına bir kez.
- API yalnız sahibine gösterir. Madencilik emri kişisel kaya hedefini kabul eder; başkasının kimliğiyle gelen istek "bulunamadı" alır.
- Sezon alanına ve Sybil kapısına dokunulmaz.

### 5.3 Korsan senaryosu

- Oyuncu başına durum: `newcomer_scenario` (adım, zamanlar, yuva konumu, misilleme zamanı). Sunucu adımı doğrular; istemci yalnız gösterir.
- Korsan yuvası kişisel bir hedeftir. Sinyalin uçuş ve HUD altyapısını yeniden kullanmak Faz 4 tasarımında denenir; PIRATES sonucu (filo kaybı) bu senaryoda kullanılmaz.
- Senaryo savaşı gerçek savaş motoruyla çözülür; oyuncu tarafına kayıp uygulanmaz. Misilleme bir worker işiyle zamanlanır; savunma yoksa da kayıp yoktur, ama sahne savunmanın farkını gösterir.
- Ödüller sabit ve hesap başına bir kez. Senaryo Honor, sıralama ve kalkanı etkilemez.
- Rehberi kapatan oyuncu senaryoyu da kapatır; yeniden yüklemede kaldığı adımdan devam eder.
- İlk oyunun düzenli ilk sinyali bugün katılımdan 2–10 dk sonra gelir (`ensureUnknownSignalSchedule`, `firstGame`). Senaryonun korsan sinyaliyle aynı anda düşmemesi için senaryo sürerken ertelenir; senaryo bitince ya da bırakılınca kısa bir aralıkla gelir. Testle doğrulanır.

### 5.4 Sinyal 4×

- `UNKNOWN_SIGNAL.speedMultiplier = 4` ve tek kural fonksiyonu; dört çağrı yeri bunu kullanır.
- Gidiş, dönüş ve geri çağırma dönüşü 4× hızlıdır. Yakıt değişmez. Uçuştaki sinyaller kayıtlı saatleriyle biter. İstemciden hız alınmaz. Botlar aynı kuraldan yararlanır.

### 5.5 Ekran sırası

- `apps/web/src/shell/attention/`: kendiliğinden açılan her yüzey kayıt olur (kimlik, öncelik, engelleyici mi, en erken an, koşul).
- Aynı anda tek engelleyici pencere. İki pencere arasında oyuncunun bir eylemi. Senaryo veya ders sürerken yalnız onun anları; diğerleri bekler, düşman saldırısı uyarısı hariç.
- Yüzeyler zamana değil ana bağlanır: iniş ödül kutusu korsan zaferinin ödülü olur; kurulum kartı ilk zaferden sonra; marka testi senaryo bitince; galaksi etkinliği bildirimleri senaryo bitince toplu ve tek kez.
- Taşınacak yüzeyler: iniş kartı, `LandingRewards`, `RecallHost` (marka testi ve kurulum kartı), ilk hafta notu, `LegacyRevealHost`, galaksi etkinliği bildirimleri. DOM'a bakarak bekleme kaldırılır.

## 6. Fazlar

Her faz: testler önce, KIRMIZI doğrulanır, uygulama, YEŞİL, kod incelemesi, ilgili regresyon. Uzun ekonomi simülasyonları owner açıkça istemedikçe çalıştırılmaz.

### Faz 0: Ölçüm

- Olay şemasına `surface_closed` (kod: `act:<seçim>` ya da `dismiss`).
- Ölçüm sorguları: `reports/inis-sonrasi-olcum-2026-11-20.sql` (huni, inişten sonraki 5 dakikada komut, 12 saat kuralı, ilk 10 dakikanın yüzeyleri).
- Karar (2026-11-20): Yüzey telemetrisi tek tek yüzeylere eklenmez. Ekran sırası (Faz 1) her kayıtlı yüzey için `surface_visible` ve `surface_closed` olaylarını merkezi olarak yazar. Yayın tek seferde olduğu için eski yüzeyleri ayrıca ölçmek yeni bilgi vermez.
- **Bitti:** Şema testi (`apps/web/test/starter-analytics-schema.test.ts`) ve sunucu sözleşme testi yeşil; sorgu üretimde salt okunur çalıştı.

### Faz 1: Ekran sırası

- Kuyruk modülü ve §5.5 kuralları; yüzeylerin taşınması; her yüzey için merkezi görünme ve kapanma olayı.
- **Bitti:** Testler: kuyruk her yüzeyin görünme ve kapanma olayını bir kez yazar; aynı anda iki engelleyici pencere açılamaz; senaryo kilidinde bildirim bekler, saldırı uyarısı geçer; oyuncu eylemi olmadan ikinci pencere açılmaz; yeniden yüklemede kuyruk kaybolmaz ve tekrar etmez. 350 px'te inişten 10 dakika oynanır, ekran görüntüleri alınır.

### Faz 2: Kuruluş Saati

- Migration: `players.first_game`. Kurallar, sunucu, istemci projeksiyonu, HUD saati, fiş satırı, son 10 dakika uyarısı, bitiş özeti, ocak efekti (VFX briefi ve kütüphane yolu teslimde).
- **Bitti:** Testler: pencere sınırları (0, 59:59, 60:00); ilk oyun olmayan katılım; tatil ve kalkan silinmesi pencereyi değiştirmez; çevrimdışı birikim pencere içinde; 59. dakikada verilen emir yarı süreli kalır; 60:00'dan sonraki tam süre; sinyal artışıyla çakışma; istemcinin gönderdiği oran reddedilir; sunucu ve istemci aynı rakamı gösterir.

### Faz 3: Kişisel kayalar

- **Bitti:** Testler: inişte tam 2 kaya, hesap başına bir kez; başka oyuncu göremez ve kazamaz (sahte kimlik, başkasının kimliği); aynı kayaya eşzamanlı iki emir; süre dolunca kaybolur; sezon alanı ve Sybil sayımı değişmez.

### Faz 4: Korsan senaryosu

- §4 akışı ve §5.3 kuralları. Başlangıç galaksisinin sahne yöneticisi kamera çekimleri için yeniden kullanılır.
- **Bitti:** Testler: adımlar sırayla, atlanamadan ilerler; oyuncu hiçbir adımda kayıp yaşamaz; ödül bir kez; yeniden yükleme ve rehberi kapatma; misilleme zamanında gelir. Oyun testi: taze hesapla 350 px'te prologdan inişin 10. dakikasına kadar.

### Faz 5: Sinyal 4×

- **Bitti:** Testler: gönderim, dönüş ve geri çağırma süreleri normalin dörtte biri (bağımsız sayısal referansla); yakıt aynı; uçuştaki sinyal eski saatiyle biter; istemci tahmini sunucuyla aynı; istemciden hız alanı reddedilir. Wiki ve 6 dil metinleri.

### Faz 6: Convoy gidiş 2×

- d6b7f46d birleştirilmez. Kural çekirdeği ve sunucu testleri master'a yeniden uygulanır; istemci parçaları güncel arayüzde yeniden yapılır. Şartname: dalın plan belgesi §1–§3.
- **Bitti:** Dalın testleri master'da yeşil; konvoy erişimi gönderilebilir filoyla hesaplanır.

### Faz 7: Tam kapı ve yayın

- `pnpm verify` (uzun testler hariç), mobil oyun testi, yayın provası. Yayın yalnız owner'ın sözüyle; migration'lar ekleyici.

## 7. Aynalar (her kural değişikliği için)

Sunucu, istemci projeksiyonu, `packages/sim` (yalnız derlenir, uzun koşu izinle), Wiki (`apps/web/src/wiki/`), 6 dil (`tr`, `en`, `de`, `fr`, `es`, `ja`), `docs/game-design.md`, `docs/glossary.md`, bu belge. Metinler `docs/ux-writing.md`'ye uyar.

## 8. Ürün ölçütleri (yayından sonra)

- İnişten sonraki ilk 5 dakikada en az 3 komut veren oran (B dalgası: 8'de 4).
- İnişten sonra 1 saat boyunca etkinliği süren oran.
- D1 (ertesi gün elle verilmiş komut).
- İlk 10 dakikada aynı anda açık engelleyici yüzey sayısı: en fazla 1.

## 9. Owner'a açık sorular

Yok. Üretim artışı ×5 (+%400), owner onayı 2026-11-20.

## 10. Defter

Çalışma yeri (owner, 2026-11-20): worktree `../blindspace-landing-hour`, dal `feat/landing-first-hour`, master 2c75c138'den.

### 10.1 Yapılacaklar

- [x] Faz 0 ölçüm
- [ ] Faz 1 ekran sırası
- [ ] Faz 2 Kuruluş Saati
- [ ] Faz 3 kişisel kayalar
- [ ] Faz 4 korsan senaryosu
- [ ] Faz 5 sinyal 4×
- [ ] Faz 6 convoy 2×
- [ ] Faz 7 kapı ve yayın

### 10.2 Dosya haritası

| Alan | Dosya |
| --- | --- |
| İlk sezon paketi | `packages/rules/src/firstSeason.ts` |
| Üretim pencereleri, süreler | `packages/rules/src/economy.ts` (`productionHours`, `buildingMinutes`, `shipMinutes`, `defenceMinutes`, `researchMinutes`) |
| Sinyal kuralları | `packages/rules/src/unknownSignal.ts`, `UNKNOWN_SIGNAL` (`constants.ts`) |
| Sinyal servisi | `apps/server/src/services/unknownSignal.ts`, `unknownSignalSchedule.ts` |
| Katılım | `apps/server/src/services/player.ts` |
| Asteroit alanı, madencilik | `apps/server/src/services/asteroidField.ts`, `asteroidSpawn.ts`, `mining.ts` |
| Korsan | `apps/server/src/services/pirateField.ts`, `pirateRaid.ts`, `packages/rules/src/pirates.ts` |
| İniş yüzeyleri | `apps/web/src/starter/ArrivalHost.tsx`, `LandingRewards.tsx`, `landingTips.ts` |
| Marka testi, kurulum | `apps/web/src/brand/RecallHost.tsx`, `brand/Install.tsx` |
| Kabuk | `apps/web/src/v2/shell/GameShell.tsx`, `apps/web/src/screens/GalaxyView.tsx`, `apps/web/src/App.tsx` |
| Sahne yöneticisi | `apps/web/src/starter/director/` |
| Bildirim sonucu olayı | `apps/web/src/session/outcomeVisible.ts` |
| Convoy | `packages/rules/src/intergalacticConvoy.ts`, `apps/server/src/services/intergalacticConvoyRaid.ts`, dal `codex/convoy-outbound-2x` |

### 10.3 İlerleme

| Faz | Durum | Not |
| --- | --- | --- |
| Plan | Yazıldı 2026-11-20 | Açık soru yok |
| Faz 0 | Bitti 2026-11-20 | `surface_closed`; taban çizgisi (17 kayıt, 8 iniş): inişten sonraki 5 dk'da ≥3 komut 4/8, hiç komut 2/8 |
