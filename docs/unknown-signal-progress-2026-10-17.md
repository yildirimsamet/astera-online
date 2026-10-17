# Bilinmeyen Sinyal — uygulama takibi

Kaynak: `unknown-signal-plan-2026-10-17.md`. Owner kararları değiştirilmiyor.

## Uygulama sırası

1. **Tamamlandı:** saf kurallar ve üretim boost'u; önce başarısız testler, sonra uygulama.
2. **Tamamlandı:** additive şema/migration; kişisel spawn/expire, backfill ve worker onarımı.
3. **Tamamlandı:** transaction içinde gönderim, varış, iniş, geri çağırma; kayıt ve prod dışında dev yolu.
4. **Tamamlandı:** API sözleşmesi, web sheet/sonuç/projeksiyon, 6 dil, harita, HUD, bildirim kapıları ve Wiki bağlantıları bağlandı.
5. **Owner sırası:** önce kapsamlı review → testlerle doğrulama → düzeltme; ardından telefon/masaüstü görsel doğrulama ve bütün normal kalite kapıları.

## İlk adımın gereksinimleri ve sınırları

- Sonuçlar seed ile deterministik; kaynak/enerji/gemi/korsan/skin oranları
  %56/%15/%12/%16/%1. Kaynak alt kümeleri eşit olasılıklı; toplam ≤1000,
  döteryum ≤100, seçilen kaynakların minimumları ve yuvarlama kuralları korunmalı.
- Gemi havuzu yalnız T1–T3 OFFENSIVE/DEFENSIVE mobil gemiler; tier dağılımı
  gönderim tier'ına bağlı. Hasar 2000–6000 bp; T4/specialist/cargo çıkamaz.
- Skin yalnız ücretli bayrak, dört element gezegen ve halka. Sahip olunan skin
  tekrar verilmez; kategori tükenirse FLAG → PLANET_ELEMENT → RING; tamamı
  tükenirse aynı seed'in kaynak ödülü.
- Konum gerçek oyun koordinatlarında, galaksinin küresel dağılımıyla uyumlu:
  başkentten ≥400, tüm gezegenlerden ≥250, radar menzili ve galaksi içinde.
  Radar 0 için mevcut `radarContactRange(1)`; en fazla 40 deneme, sonra null.
- Filo tam iki kayıt: dört T1 savaş gemisinden biri ×1 + COURIER ×1.
  Fazla/sıfır/negatif/ondalıklı/NaN/bilinmeyen gemi reddedilmeli.
- Üretimde sinyal +%100, recovery +%50; birlikte ×2.5. Yalnız üretken
  dakikalar ödenir. Süre bitimi, boş/geri zaman aralığı, null/NaN/sonsuz
  deadline test edilir. Collector kapasitesi, shield ve recovery davranışı değişmez.

Dokunulacak ilk alanlar: `packages/rules/src/{unknownSignal,constants,economy,index}.ts`
ve ilgili rule testleri. Ortak üretim fonksiyonu eski çağrılarla uyumlu genişletilecek;
sunucu tick'i ve istemci projeksiyonunun yeni pencereyi taşıması sonraki entegrasyonun
zorunlu parçası. Mevcut şema/API/frontend bu ilk adımda özellik sunmaz.

## Sonraki adımda korunacak entegrasyon ayrıntıları

- Gerçek Kurye ambarı `profileHull` sonrası 1000'dir; `hulls.ts` içindeki eski
  700 literalini esas alma. Kaynak ödülünün tamamı sağ kalan Kurye'ye sığar.
- `capLoadToSurvivors` savaş gemilerinin ambarını da sayar. Kurye kaybolduğunda
  kaynak ödülü tamamen düşürülmeli; yalnız bu helper'ı çağırmak yeterli değildir.
- Radar için tasarım dokümanındaki eski menzil tablosunu kopyalama;
  `radarContactRange` mevcut L1=2700 değerini ve üst seviyeleri zaten verir.

## İlk rules aşamasının geçmiş doğrulaması

- TDD kırmızısı: yeni 68 testin 56'sı beklenen eksik davranışlarla başarısız oldu;
  kalan 12'si mevcut davranışın sınırlarını koruyan testlerdi.
- Uygulamadan sonra yeni kurallar + recovery regresyonu: 81/81 geçti.
- Tam rules paketi: **140 dosya, 2489 test, tamamı geçti** (tek worker, seri).
- Bütün çalışma alanlarının typecheck'i geçti (rules → server → web → sim; seri).
- Proje genelindeki lint, kılavuzdaki üç seri grupta sıfır hatayla geçti.
- İstemci regresyonları: `recovery-boost.test.tsx` ve `session-surface.test.tsx`,
  **2 dosya, 59 test, tamamı geçti** (tek worker, seri).

Bu ilk aşamada özellik henüz oyunda görünmüyordu. Sonraki aşamalarda migration,
servis/API ve web entegrasyonları tamamlandı; güncel durum aşağıdadır.

Uzun ekonomi/sezon simülasyonları çalıştırılmadı. Commit/deploy yapılmadı.
Master üzerinde, tek worker ve ≤4 GiB heap ile ilerleniyor.

## Full review — güncel oturum

### Son durum (17 Ekim)

- Son tamamlanan sinyal + bildirim sunucu koşusu: **84/84**; ek ödül gemisi
  radyasyon regresyonu: **1/1**. Sinyal dosyası 66 test içeriyor. Önceki tam
  API sözleşmesi: **102/102**.
- İlişkili servis regresyonları: 303 testten 302 geçti; reclaim testinin eski
  fixture beklentisi yeni kişisel spawn kayıtlarıyla uyumlu hale getirildi ve
  ilgili test tekrar geçti.
- Web hedefli koşu: **97/97**. Son başlık/çeviri/asset hazırlama regresyonları
  **32/32** geçti. Server ve web typecheck, 4 GiB sınırında geçti;
  son review değişikliklerinden sonra final kontroller tekrar edilecek.
- Kısmi tam web koşusu, başka oturumun tam testleriyle aynı anda çalıştığı
  fark edilince yalnız kendi test sürecimiz durdurularak kesildi. Bu koşuda
  bildirim enum fixture'ındaki eksik yeni tür bulundu; fixture güncellendi.
- T4 kolonisinin sonraki spawn'dan önce kaybedilmesi, gecikmiş spawn'ın geçmiş
  tatil aralığı ve T4 durdurma kilit sırası testle doğrulanıp düzeltildi.
- Altı dil × 350/1280 genişlikte ilk görsel tur: 96 pencere durumu, 120 görüntü;
  taşma ve 48 px işaret merkezi kontrolleri geçti. Patlama gerçek kaynaklarla
  ayrı kontrolde görünür doğrulandı. Başlık düzeltmeleriyle final görüntüler
  yenilenecek. Tam oyun ekranı görüntüsü alındı; native sheet kontrolü sürüyor.
- Diğer oturumun tam test koşusu bitti. Final typecheck → üç lint grubu → tam
  normal testler seri başlatıldı; henüz final yeşil kapı sayılmaz.

Detaylı bulgular ve kanıtlar: `unknown-signal-review-2026-10-17.md`.

### Yerel deneme ortamı

Kullanıcının denemesi için `http://localhost:5173` açıldı; API `3127` portunda.
Yalnız `astera_unknown_signal_visual_test` adlı ayrı veritabanı kullanılır;
mevcut oyun veritabanına migration/reset uygulanmadı. `signaltest` hesabında
T1 savaş gemileri, Kuryeler, yakıt ve açık bir kaynak sinyali hazırlandı.
HTTP giriş, açık sinyal okuma ve `/health` başarılı. Bu kontroller görsel
doğrulama veya final özellik onayı yerine geçmez. Başlatıcı `.dev/unknown-signal-local.mts`,
loglar `.dev/unknown-signal-local-{api,web}.log` dosyalarında.

### Önceki aşama notları

Görsel doğrulamaya henüz geçilmedi. Sunucu 59 sinyal testi ve 4 hedefli API kontrat
testi çalıştırıldı. Son tam sinyal koşusunda iki yeni roster testi beklenen şekilde
kırmızıydı; roster düzeltmesinden sonra bu iki test geçti. Tam paket tekrar koşulacak.

Testle doğrulanan ve düzeltilen bulgular:
- Sinyal servisi oyuncu satırını gezegenden önce kilitliyordu; normal emirlerle
  deadlock mümkündü. Gerçek PostgreSQL bekleme/kilit testiyle doğrulandı;
  sezon → sıralı gezegenler → oyuncu → sinyal sırası uygulandı.
- Koloni ele geçirilince iniş başkente gidiyor, radyasyon eski koloni rotasından
  hesaplanıyordu. Yeni rotada ölüm testiyle doğrulandı ve düzeltildi.
- Koloni varıştan önce tarafsız olursa eski origin'i `loadLocked` ile okumak
  görevi kilitliyordu. Varış dönüş hedefini de `safeHomePlanet` ile seçiyor.
- Recall süresi sağ kalan filo hızını hesaba katmıyordu. Asıl yavaş savaş gemisi
  ölünce Kurye'nin daha hızlı dönüşü artık standart travel formülünden hesaplanıyor.
  İlk test varsayımı (Kurye daha yavaştır) katalogdan doğrulanıp düzeltildi.
- Reclaim/account deletion yeni görevleri ve spawn/expiry eventlerini bilmiyordu.
  Aktif görev artık açık blocker; sessiz komutan temizliğinde eventler de siliniyor.
- Silent Space transferi eski galakside açık sinyal ve eski season cadence bırakıyordu.
  Açık sinyal kapanıyor, yeni galakside schedule kuruluyor; T4 için durmuş zincir korunuyor.
- Gecikmiş arrival öncesi başkent tick edilmişse energy bonusu geçmiş üretken
  aralıkta kayboluyordu. Normal/overlap/disruption/full collector testleriyle
  doğrulandı; yalnız yeni bonus aralığı, cap ve tempo korunarak ödeniyor.
- OUT/HOME radyasyonu sonrası saklanan fleet eski roster'ı gösteriyordu.
  Kayıp ve iniş sonuçları gerçek filo/hasar ile güncelleniyor.
- Özel SSE spawn olayı istemci query'sini yenilemiyordu; kişisel invalidation eklendi.
- Skin adı ham i18n anahtarı basıyordu; gerçek cosmeticCopy adı ve kart önizlemesi bağlandı.
- Recovery içindeki origin'den istemci gönderim teklif ediyordu; ortak fault ve
  recovery/loyalty kalkış kontrolü bağlandı.
- Filo etiketi UNKNOWN_SIGNAL basıyor, recall yanlış standart API'ye gidiyordu;
  yerelleştirilmiş etiket ve native idempotent signal recall yolu bağlandı.

Doğrulanan diğer case'ler: expiry/send ve recall/arrival sınır yarışları, eşzamanlı
skin satın alma unique yarışı, tüm radyasyon kaybında reveal olmaması, Kurye
kaybında tüm resource loot'un düşmesi, prod'da dev route'un gerçekten 404 olması,
anonim/forged/malformed API istekleri ve public galaxy payload'ının değişmemesi.

Web sheet/projeksiyon testleri son tamamlanan koşuda 24/24 yeşildi; yeni query
entegrasyon testi şu anda TDD kırmızı aşamasında. Web typecheck ilk 2 GiB default
heap ile OOM oldu; 4 GiB sınırındaki koşu gerçek tip eksiklerini gösterdi. Skin
anahtarı, blocker tipi ve yeni FlightMark düzeltildi; final typecheck tekrar edilecek.

Başka oturumun honor test/doküman değişiklikleri çalışma ağacında belirdi; korunuyor.
Testler yalnız `astera_unknown_signal_test` veritabanında çalıştırılıyor.
Yerel dev migration henüz uygulanmadı. Commit/deploy yok; uzun simülasyon yok.

### Honor release ile migration sırası (17 Ekim)

Honor release'in sabit prefix'i korunmuştur: `0183_honor_loot_weight`;
Unknown Signals aynı SQL içeriğiyle `0184_unknown_signals` olarak ardına alınmıştır.
`0183_snapshot.json` release ile birebir; `0184_snapshot.json` önceki birleşik
şemayı koruyarak yeni 0183 kimliğine bağlanır. Journal zamanı artandır.
Yerel geliştirme veritabanının son migration'ı kontrol sırasında 0182 idi;
yerel geliştirme verisi değiştirilmedi. Release 0183 şemasının ayrı test kopyasında
0184 geçişi başarıyla uygulandı. Eski numaralandırmayı uygulamış geçici test
veritabanları yeniden kullanılmadan önce journal uyumu kontrol edilmeli;
bu kopyalar üzerinde migration'ı körlemesine tekrarlamayın.

### Final yayın hazırlığı

Güncel review ve kabul kanıtı `unknown-signal-review-2026-10-17.md` içindedir.
Rules 2493/2493; tam sunucu CI 8/8 parça; dört workspace typecheck ve üç lint
grubu başarılı. Altı dilde 96 panel/120 görüntü ve gerçek oyun rota kontrolü
tamamlandı. Canlı yedek restore'u, 0184 migration hash koruması ve eski/yeni
gerçek imajların okuma/yazma provası geçti. Tam web regresyonu ve son canlı
kabul kontrolleri sonuçlanmadan yayın tamamlandı sayılmaz. Owner tüm yerel
değişiklikleri (döteryum tavan düzeltmesi dahil) deploy için yetkilendirdi.
