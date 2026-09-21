# Klan Ortak Savaşı — Local Manuel Test Planı

Tarih: 2026-09-21  
Ortam: local PostgreSQL + gerçek API/worker + web istemcisi  
Durum: tamamlandı

Bu çalışma otomatik testlerin yerine geçmez. Yeni bir ruleset 10 sezonunda, gerçek HTTP
oturumları ve worker olayları üzerinden uçtan uca davranışı gözlemlemek için yapılır. Test
hazırlığında yalnız süreyi kısaltmak için üyelik zamanı, başlangıç kaynakları/gemileri,
keşif ve scheduled-event zamanı doğrudan local veritabanında hazırlanabilir. Oyun kararları
ve mutasyonları normal API uçlarından geçmelidir.

## Kurulum

- Local sezonları `season wipe --yes` ile kapatıp yeni sezon aç.
- Bot roster'ından birkaç botu yeni sezona worker ile oturt.
- Dört gerçek test hesabı aç:
  - lider;
  - katkı veren üye;
  - klan dışı saldırı hedefi;
  - klan dışı gözlemci.
- Lider üzerinden klan kur; üye başvurusunu normal clan API akışıyla kabul et.
- Joint-war katılımını test edebilmek için lider ve üye membership zamanını 12 saatten eskiye al.
- Lider/üye dünyalarına yeterli kaynak, yakıt ve mobil filo ver; hedef korumasını happy path'ten
  hemen önce kaldır; hedefi lider için keşfedilmiş hale getir.

## Happy path

1. Yeni sezonun joint-war özelliğini açtığını ve yeni klanın seviye 1, boş hazine ve doğru
   ortak Hangar kapasitesiyle başladığını doğrula.
2. Üyenin kısmi hazine bağışı yapabildiğini, liderin kalan tutarı tamamlayıp klanı bir seviye
   yükseltebildiğini doğrula.
3. Liderin keşfedilmiş yabancı oyuncu başkentini hedef işaretlediğini; staging dünyasının
   lider başkenti olarak sabitlendiğini doğrula.
4. Üye filosu için quote al; üç yakıt bacağını, kişisel Hangar bilgisini, ortak Hangar son
   durumunu ve tahmini dönüş zamanını kontrol et.
5. Üye katkısını gönder; yakıtın ve gemilerin bir kez ayrıldığını, katkının `OUTBOUND`
   olduğunu ve traffic/pending görünümünde klan filosu hareketinin yer aldığını doğrula.
6. Support arrival olayını worker ile işlet; katkının `STAGED` olduğunu ve ortak Hangarda
   reserved yerine used sayıldığını doğrula.
7. Lider başkentinden anlık bir combat dalgası ekle; uçuş yuvası ve staging bacağı
   kullanılmadığını doğrula.
8. Lider saldırıyı başlat; tek combined mission, distinct katılımcı sayısı ve kilitli havuz
   durumunu doğrula.
9. Savaş olayını worker ile işlet; aggregate sonuç ile participant casualty/loot/Dominion
   toplamlarının eşitliğini ve saldırgan takım ile savunmacı Dominion'un sıfır toplamını kontrol et.
10. Lider, üye ve savunmacının rapora eriştiğini; klan dışı gözlemcinin erişemediğini doğrula.
11. Dönüş olaylarını worker ile işlet; hayatta kalan gemilerin kendi sahiplerinin dünyalarına,
    kendi loot/salvage paylarıyla döndüğünü ve son dönüşten sonra operasyonun tamamlandığını doğrula.

## Kritik senaryolar

1. Klan dışı hesabın private war ekranına erişimi reddedilir.
2. Olgunlaşmamış üyenin katkı quote/dispatch isteği reddedilir; üyelik zamanı ilerletilince
   aynı filonun quote'u kabul edilir.
3. Üye hedef işaretleyemez ve combined saldırıyı başlatamaz.
4. Koruma altındaki hedef işaretlenemez; koruma kaldırıldıktan sonra işaretlenebilir.
5. Aynı target idempotency key ile tekrar gönderildiğinde ikinci operasyon oluşmaz.
6. Henüz `OUTBOUND` katkı varken start `CLAN_WAR_SUPPORT_INBOUND` ile reddedilir.
7. Aynı contribution idempotency key ile tekrar gönderildiğinde ikinci dalga, ikinci yakıt
   tahsilatı veya ikinci uçuş yuvası oluşmaz.
8. Başka oyuncu katkıyı recall edemez. Katkı sahibi recall edebilir; rezervasyon hemen bırakılır
   ve worker dönüşü sonunda filo sahibine iner.
9. Tarihsel katkısı bulunan üye operasyon karara bağlanmadan klandan ayrılamaz.
10. Start sonrasında yeni katkı ve recall `CLAN_WAR_POOL_LOCKED` ile reddedilir.
11. Report ve traffic payload'ları klan filosunun owner listesi veya kargosunu yetkisiz
    gözlemciye sızdırmaz.
12. Mutation response içindeki `war` ve `traffic` state'i web cache'ine hemen yazılır; War
    sekmesi 350 px genişlikte yatay taşmadan hedef, dalga, quote ve disabled-reason metinlerini gösterir.

## Kayıt biçimi

Her adım için `PASS`, `FAIL` veya `BLOCKED`; kullanılan gerçek response/status; gerekirse DB
invariant sorgusu ve ekran görüntüsü kaydedilir. Bir failure görülürse önce tekrar üretilir ve
ürün kuralına göre gerçek bug olduğu doğrulanır; sonra test-first düzeltme yapılır.

## Yürütme kaydı

Local `season wipe --yes --count 2 --cap 1000 --seed 20260921` ile iki yeni galaksi açıldı.
EU-1'e worker üzerinden 8 bot oturdu. `cwlead921`, `cwwing921`, `cwfoe921`, `cweye921`
hesapları normal onboarding API'siyle açıldı; ilk iki hesap normal başvuru/kabul akışıyla
`Manual Horizon` (`MH21`) klanına katıldı. Fixture hazırlığı yalnız başlangıç kaynakları,
filolar, keşif, koruma ve süreleri etkiledi. Klan kararları gerçek HTTP API'sinden, uçuş/savaş
ve dönüş olayları gerçek worker handler'larından geçti.

| Senaryo | Sonuç | Gözlem |
|---|---|---|
| Yeni sezon, klan ve hazine | PASS | Ruleset 10; seviye 1, hazine 0, Hangar 160. İki oyuncunun kısmi bağışı sonrası seviye 2 ve Hangar 360. |
| Hedef ve yetki | PASS | Üyenin hedef isteği `403 CLAN_WAR_LEADER_ONLY`; korunan hedef `409 NEWCOMER_SHIELDED`; lider hedefi işaretledi. Aynı idempotency key aynı operasyonu döndürdü. |
| Üyelik olgunluğu | PASS | 12 saatten genç üyenin quote'unda `CLAN_WAR_MEMBER_IMMATURE`, dispatch'inde 409; fixture zamanı ilerletilince üç bacaklı quote ve shield uyarısı geldi. |
| Katkı ve tekrar | PASS | Üye katkısı `OUTBOUND`, cevapta güncel `war` ve `traffic` vardı; aynı key ikinci filo/yakıt/slot üretmedi. Varışta `STAGED`; lider başkent katkısı staging uçuşu olmadan `STAGED`. |
| Start öncesi engeller | PASS | Üye start isteği 403; outbound katkıyla start `409 CLAN_WAR_SUPPORT_INBOUND`. Başkasının recall isteği 403; tarihsel katkısı olan üyenin ayrılması `409 CLAN_WAR_MEMBERSHIP_LOCKED`. |
| Recall ve kapasite | PASS | Sahip outbound dalgayı çağırdı; ortak rezervasyon hemen düştü, worker dönüşte filoyu sahibine indirdi. |
| Ortak saldırı | PASS | İki katkıyla tek combined mission başladı; iki distinct katılımcı. Üye yoldayken ve lider hazırken Hangar used 48, reserved 42; dönüşlerden sonra ikisi de 0. Start sonrası yeni katkı `409 CLAN_WAR_NOT_ASSEMBLING`, recall `409 CLAN_WAR_POOL_LOCKED`. |
| Savaş ve dönüş | PASS | Operasyon `COMPLETED/BATTLE`; üç katkı `HOME`. Aggregate DART 18, PIKE 9, COURIER 3; kayıp DART 3; kalan DART 15, PIKE 9, COURIER 3. Lider ve üye kendi sağ kalan gemilerini ve ganimetlerini aldı. |
| Ganimet ve Dominion | PASS | Kişisel loot 480/480/480 ve 789/790/790. Saldıran puanı `1559 + 2003 = 3562`; savunmacı `-3562`; base exchange 7124, katılımcı oranı sonrası 3562. |
| Rapor ve sis | PASS | İki katılımcı ve savunmacı aynı rapora erişti; klan dışı gözlemcinin rapor listesi boş. Savunmacı contact label'ı `[MH21] Klan Filosu`; owner listesi ve cargo yok. |
| Mobil War yüzeyi | PASS | Gerçek hesapla 350 px Chrome'da giriş, Clan/War ve Türkçe/İngilizce durumlar açıldı. Türkçe quote'da iki yakıt bacağı, maliyet, kapasite, dönüş süresi ve disabled reason görüldü. Yatay taşma yok (`scrollWidth = innerWidth = 350`). Ekranlar `out/clan-joint-war/05-war-en.png`, `06-war-active-en.png`, `07-war-active-tr.png`, `09-war-quote-tr-fixed.png`, `10-clan-tabs-tr.png` ve `10-clan-tabs-es.png`. |

Radar L5 bildirimi, fixture radar seviyesi uyarı zamanından sonra yükseltildiği için canlı
oturumda gözlenemedi; zaman ve gizlilik davranışı hedefli entegrasyon testinde doğrulandı.

Canlı dönüş bildirimlerinde `fleet_returned` için `trip: recalled` görülmesi gerçek bir ürün
hatasıydı: savaş gazileri geri çağrılmış gibi gösteriliyordu. Aynı sonucu API notification
payload'ında tekrar doğruladım; ardından `clan-war-battle.test.ts` içinde önce başarısız olan
regresyon testini yazıp battle return payload'ını `trip: raid`, doğru hedef ve kişisel loot/salvage
alanlarıyla düzelttim. Support recall semantiği aynı kaldı.

Mobil quote sırasında iki arayüz kusuru daha doğrulandı: yakıt bacakları ham
`STAGING_TO_TARGET`/`TARGET_TO_STAGING` kodlarıyla görünüyordu ve beş sekme Türkçe 350 px
genişlikte birbirine taşıyordu. Beş dilde oyuncunun anlayacağı rota adları ve kısa mobil
sekme etiketleri eklendi; ekran okuyucu adları tam tutuldu. Son tarayıcı ölçümünde beş dilin
her birinde tüm sekmeler aynı anda 350 px içine sığdı, sekme metinleri taşmadı ve sayfa
yatay kaymadı. Görsel test için açılan ikinci boş hedef operasyonu daha sonra normal
cancel API'siyle `COMPLETED/LEADER_CANCEL` durumuna getirildi.
