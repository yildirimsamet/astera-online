# Onboarding — güncel FlightSchool ve gerçek başlangıç

Son kod karşılaştırması: 3 Kasım 2026. Bu belge onboarding için ana referanstır.
Mevcut davranışı kod ve testler belirler. İlk sezon paketi yerel kodda uygulanmıştır; bu kayıt canlıya yayın yapıldığı anlamına gelmez.

## Güncel uygulama hangisi?

`apps/web/src/App.tsx`, `Academy` adıyla lazy import ettiği
`onboarding/flightSchool/FlightSchool.tsx` bileşenini açar. Bu yerel değişken adı,
eski `onboarding/Academy.tsx` ekranının kullanıldığı anlamına gelmez.

FlightSchool 11 bölümden oluşur; ayrıntılı sahneler `flightSchool/scenes.ts` içindeki
`SCHOOL_SCENES` listesidir. Kendi gezegenini yönetme, kaynak toplama, inşa, Uplink ve
Telescope, madencilik, sonda, filo üretimi, akın, Radar ve savunma gerçek oyun
arayüzleriyle, ayrı bir eğitim galaksisinde öğretilir. Eğitimdeki 30 Dart ve 2 Courier,
gerçek oyuncunun başlangıç filosu değildir.

Web'de ilk ziyaretin eğitime girişi, oturum geri yükleme ve giriş ekranına çıkma tercihi
[first-visit-startup-2026-11-03.md](first-visit-startup-2026-11-03.md) içindedir.
Bu cihaz tercihi ilk sezon hakkını veya gerçek hesap geçmişini belirlemez.

## Eğitim ödülleri ve ekonomisi

- Eğitim için ayrı, sonlu bir bütçe vardır. Sonraki işlemin kaynak açığı bu bütçeden karşılanır.
- Üretim, toplama, madencilik ve baskın ganimeti yalnız yerel eğitim dünyasını değiştirir.
- Ders ödülü alma adımları yoktur; `schoolFetch`, ödül alma POST isteğini kabul etmez.
- Gemiler, kaynaklar, yükseltmeler, raporlar ve görev geçmişi gerçek hesaba aktarılmaz.
- Eğitim tamamlamak, yarıda bırakmak veya tekrar oynamak gerçek ekonomide ödül üretmez.

Bütçe ve sonuçlar: `flightSchool/world.ts` içindeki `createSchool`, `enterScene`,
`schoolAction`, `tickSchool`. Ağ sınırı: `flightSchool/api.ts` içindeki `schoolFetch`.

## Gerçek oyuna geçiş

Eğitimi erken bitirme ve son sahneden çıkış kayıt diyaloğunu açar. FlightSchool,
`onClaim(username, password, [], country, policy)` çağırır. `Api.claim`, bunu
`/api/onboarding/claim` adresine `intents: []` olarak gönderir; eğitim adımı veya
eğitim dünyasının sonucu gönderilmez. Native claim aynı sunucu route mantığını kullanır.

Sunucuda `routes/onboarding.ts` → `joinSeason` zinciri gerçek dünyayı oluşturur.
`services/player.ts`, ilk başarılı katılımda `FIRST_SEASON_START` paketini verir.
Eğitimi bitiren, atlayan ve doğrudan sunucu seçerek katılan aynı ilk sezon paketini alır.
Sonraki sezonlarda `PLANET_START` ve `START_BUILDINGS` kullanılır.

**Sonraki sezonların standart başlangıcı:**

| İçerik | Değer |
| --- | --- |
| Depodaki kaynak | 1.500 alaşım, 400 kristal, 50 döteryum |
| Core / Refinery / Extractor / Hangar | 1 / 1 / 1 / 1 |
| Vault / Shipyard / Deuterium Plant | 0 / 0 / 0 |
| Telescope / Radar / Aegis / Veil | 0 / 0 / 0 / 0 |
| Uydular, filo ve yer savunması | Yok |
| Başlangıç Havuzu ve inşa kuyruğu | Boş |
| Eğitim kaynaklı görev/üretim geçmişi ve alınmış ödül kayıtları | Yok |

Önceki sezondan hak edilmiş sıralama ödülleri ve yöneticiye özel donatım ayrı sunucu
kurallarıdır; tablo bu ek haklar olmadan sonraki sezon açılışını anlatır.

Yeni hesabın ilk başarılı katılımında, `FIRST_GAME_SHIELD_ENABLED` açıkken verilen
hakla **72 saat** kalkan başlar. Bu hak hesapta atomik tüketilir; tekrar istek veya
sezon sıfırlama hakkı yenilemez. İlk oyun hakkı olmayan katılımın koruması **24 saat**tir.
Saldırıyı onaylamak korumayı tüketir. Kalkan eğitim tamamlamaya bağlı değildir.

## Yenileme ve tekrar oynama

`flightSchool/storage.ts`, `astera.flight-school.v1` anahtarında sürümlü eylem/zaman
geçmişini saklar; yenilemede doğrulanıp yeniden yürütülür. Gerçek oyuna bu kayıt
aktarılmaz; başarılı claim sonrası temizlenir. Depolama kullanılamasa da eğitim oynanabilir.

Tekrar oynama ayrı QueryClient ve kimliksiz yerel Api kullanır. Gerçek hesabın
kaynaklarını, filosunu veya eğitim kaydını değiştirmez; gerçek sezona paket vermez.

## Eski Academy kodu neden hâlâ var?

`packages/rules/src/academy.ts` içindeki `ACADEMY_STEPS`, `academyExitCheckpoint`,
`TUTORIAL_EXIT` ve `PLANET_START_WITH_TUTORIAL`, **eski 40 adımlı Academy sözleşmesidir**.
Bunlar güncel FlightSchool başlangıcı olarak okunmamalıdır.

Eski web `Academy.tsx`, `academyFetch.ts` ve eski checkpoint testleri depoda bulunur.
Sunucu eski istemciler için `step` alanını doğrular fakat insan oyuncuya checkpoint'i
aktarmak için kullanmaz. Eski checkpoint yalnız sunucunun yönettiği koltuklarda
`services/bots/sweep.ts` üzerinden kullanılmaya devam eder.
Bu nedenle kodu kullanılmıyor sanıp silmek veya `TUTORIAL_EXIT` değiştirerek bütün
başlangıç yollarını değiştirmek doğru değildir. Eski `--academy` görsel turu da
FlightSchool kabulünün yerine geçmez.

## İlk sezon paketi — yerel uygulama

3 Kasım 2026 owner talebi uygulandı: oyuncunun ilk sezonunda, eğitimden bağımsız, hesap
başına yalnız bir kez sabit başlangıç paketi verilir. Sonraki sezon ve tekrar eğitim paketi yenilemez.

- Core 3, Telescope 3, Radar 2; Telescope ilk andan etkin seviye 3 çalışır.
- Refinery/Extractor 2; Vault/Shipyard/Hangar 1; Deuterium Plant 0; Aegis 1 ve bir Uplink.
- 3 Dart, 1 Warden, 1 Courier, toplam 1 Kazıcı (Prospector).
- Depoda net 1.500 alaşım, 1.000 kristal, 50 döteryum.
- Önceki mezun paketindeki 84 alaşım / 36 kristal Havuzu başlangıç hediyesine dahildir;
  bu, güncel eğitimden aktarılmış madencilik sonucu değildir.
- Core 3 hazırdır; Core 2→3 kuyruğu ve otomatik Core 4 siparişi yoktur.
- Eski eğitimden tamamlanmış görev, alınmış ders ödülü veya 6 Dart üretim geçmişi eklenmez.

Bu bir eğitim ödülü değildir. `accounts.firstSeasonStartedAt`, ilk başarılı katılımla
aynı transaction içinde yazılır. Başarısız işlem hakkı tüketmez; tekrar istek, sezon
sıfırlama ve koltuğun geri alınması hakkı yenilemez. Mevcut kalkan bayrağı bağımsızdır.
`0227_first_season_start.sql`, mevcut oyuncu, kalıcı katılım, sezon sonuçları ve
`lifetime.seasons` geçmişi bulunan hesapları önceden başlamış olarak işaretler.
Henüz hiç katılmamış mevcut hesaplar hak kazanır; mevcut gezegenlere paket eklenmez.
Eski sunucunun geçiş sırasında yazdığı katılım kayıtları yeni katılımda ayrıca kontrol edilir.

Normal oyun ödülleri bina seviyelerini okuyarak hak edilebilir; hediye gemiler
`builtEver` veya `seasonTelemetry.shipsBuilt` içine üretim olarak yazılmaz.
Eski görev/ödül geçmişi eklenmez. Paketin tam tanımı `packages/rules/src/firstSeason.ts` içindedir.

## Kod ve doğrulama haritası

| Konu | Kaynak / test |
| --- | --- |
| Güncel ekran ve claim | `apps/web/src/App.tsx`, `onboarding/flightSchool/FlightSchool.tsx`; `flight-school-screen.test.tsx` |
| Eğitim kuralları ve yerel API | `flightSchool/world.ts`, `api.ts`; `flight-school-world.test.ts`, `flight-school-api.test.ts`, `flight-school-journey.test.ts` |
| Yerel kayıt / tekrar oynama | `flightSchool/storage.ts`; `flight-school-storage.test.ts`, `academy-replay.test.tsx` |
| Normal katılım ve eski checkpoint sınırı | `apps/server/src/routes/onboarding.ts`, `services/player.ts`; `apps/server/test/onboarding.test.ts` |
| İlk oyun kalkanı | `services/account.ts`, `services/player.ts`; `apps/server/test/first-game-shield.test.ts` |
| Normal başlangıç sayıları | `packages/rules/src/constants.ts`: `PLANET_START`, `START_BUILDINGS` |

Güncel görsel kontrol: `node tools/visual.mjs out/flight-school --flight-school`.
Hızlı gerçek başlangıç turu: aynı komuta `--opening-only --short-phone` ekleyin.
3 Kasım yerel doğrulaması: 470 farklı sunucu testi ve 86 web testi geçti. Sunucu
regresyonları her worker'a ayrı, migration uygulanmış geçici veritabanı verilerek
çalıştırıldı; kullanılan veritabanları silindi. Rules tip kontrolü, değişen sunucu/web
kaynak ve testlerinin hedefli tip kontrolü, değişen dosyaların lint'i, sunucu ve web
üretim derlemeleri geçti. Tam sunucu workspace tip kontrolü 2 GiB heap sınırında OOM
ile durdu; tam `pnpm verify` geçti denmez. Uzun ekonomi testleri çalıştırılmadı.

`out/first-season-opening/journey.json` ve ekran görüntüleri, 350×600 üretim
önizlemesinde eğitimi ilk ekrandan bitirme → gerçek kayıt → normal galaksi akışını
kaydeder. Core 3, etkin Telescope 3/Radar 2, 1.500/1.000/50 kaynak ve
3 Dart + 1 Warden + 1 Courier + 1 Kazıcı doğrulandı; tarayıcı çalışma hatası yoktu.
Bu tur yalnız göreve ait ayrı yerel veritabanında yapıldı; canlı oyuncuya dokunulmadı.
Yayın için `0227_first_season_start.sql` migration'ı ve uyumlu sunucu/web sürümleri gerekir;
bu çalışmada canlıya yayın yapılmadı.
[1–2 Kasım geliştirme/kabul kaydı](onboarding-academy-redesign-2026-11-01.md)
geçmiş doğrulama kanıtıdır; [29 Ekim planı](onboarding-gercek-oyun-plani-2026-10-29.md)
yerine FlightSchool uygulanmıştır.

## İlk sezon uygulaması — son inceleme ve düzeltmeler, 3 Kasım 2026

İlk uygulama, migration, katılım yolları, eğitim tekrarı, eski istemci sözleşmesi ve
oyuncuya görünen açıklamalar yeniden incelendi. Doğrulanan bulgular:

1. **P1 — hesap kilidi beklenirken sezonun bitmesi.** `joinSeason`, saati hesap
   kilidinden önce okuyordu. Kilit beklerken sezon biterse geç katılım kabul
   edilebiliyor; sezon sürüyorsa katılım, kalkan ve ilk sezon kaydı eski saatten
   başlatılıyordu. İki kilit bekleme testi hatayı yeniden üretti. Kilitten sonra saat
   ve sezon sonu tekrar kontrol ediliyor; reddedilen katılım paket/kalkan hakkını
   tüketmiyor. İki test de düzeltmeyle geçti.
2. **P2 — tekrar eğitimde yeni paket vaadi.** Son sahne, mevcut oyuncunun eğitim
   tekrarında da ilk sezon paketini alacağını söylüyordu. Ekran testi hatayı
   doğruladı. Tekrar modunda mevcut ödülsüz tamamlama çevirisi kullanılıyor;
   devam etmek gerçek hesaba dönüyor, claim veya yeni ödül isteği açmıyor.
3. **P2 — Wiki'de eski başlangıç ve eksik kalkan ayrımı.** Hızlı başlangıç hazır
   Antene rağmen Anten kurmayı öneriyor; ilk sezon paketi, eğitimden bağımsızlık ve
   tekrar/sonraki sezon sınırını açıklamıyordu. PvP tablosu yalnız 24 saati
   gösteriyordu. İki test önce başarısız oldu. TR/EN açıklamalar düzeltildi;
   kaynak, bina, donanım ve filo tabloları doğrudan `FIRST_SEASON_START` üzerinden
   üretiliyor. Hak sahibi hesap için bir kerelik 72 saat ile normal 24 saat ayrıldı.
4. **P3 — tarihsel belgelerde kalan durum ifadeleri.** Dört eski plan/inceleme
   başlığındaki "bekleyen/henüz uygulanmayan" ilk sezon paketi ifadeleri mevcut
   yerel uygulamaya göre düzeltildi. Tarihsel tasarım kararları güncel mekanik diye
   sunulmuyor; ana referans bu belge.

Ek regresyonlar, Radar yazımında hata enjekte ederek bütün transaction'ın geri
alındığını; gerçek koltuk geri alımıyla gezegen/oyuncu silindikten sonra paketin
yenilenmediğini; hiç oynamamış bir sunucu koltuğunun eski checkpoint başlangıcını
koruduğunu doğruladı. Yeni test dosyasında 23 senaryo var. Aynı/farklı galakside
eşzamanlı katılım, dolu galaksi, sezon sıfırlama, tekrar istek, eski `step`/intent
istekleri, web/native claim, kalkan bağımsızlığı, sıralama ödülleri ve migration
geçmişi kontrollerinde ek hata bulunmadı.

Bu son inceleme turunda **268 farklı sunucu testi ve 80 web testi geçti**. Bunlar
yukarıdaki ilk uygulama testleriyle örtüşür; toplamlarına eklenmemelidir. Sunucu
testleri dört ayrı, migration uygulanmış geçici veritabanında çalıştırıldı ve bu
veritabanları silindi. Değişen kaynak/testlerin hedefli tip kontrolleri ve lint'i,
sunucu ve web üretim derlemeleri geçti. Tam sunucu workspace tip kontrolünün
yukarıdaki 2 GiB/OOM sınırı geçerlidir; tam `pnpm verify` sonucu iddia edilmez.

`node tools/visual.mjs out/first-season-review-wiki --wiki` turu, yerel Vite
geliştirme sunucusunda 1360×960 masaüstü EN ve 350×812 mobil EN/TR görünümlerinde
geçti. Güncel hızlı başlangıç, kalkan referansı, scriptsiz public Wiki ve oyun içi
Wiki arama/bağlantı/geri gezinmesi kontrol edildi. Yatay taşma veya tarayıcı çalışma
hatası yoktu; ekranlar ve ölçümler `out/first-season-review-wiki/` altında.
Standart üretim derlemesi gallery girişini içermediği için ilk preview denemesi
gallery arama alanında durdu; tam görsel tur gallery'yi sunan geliştirme sunucusunda
tamamlandı. Bu bir oyun hatası olarak raporlanmadı. Canlıya yayın yapılmadı.
