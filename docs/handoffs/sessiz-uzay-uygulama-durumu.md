# Sessiz Uzay — uygulama başlangıcı

8 Eylül 2026, checkout `f1fa09d`. Ana plan: [entegrasyon planı](sessiz-uzay-entegrasyon-plani.md).

## Karar bekleyen ürün sınırı

Kullanıcı uygun sonraki oyuncunun dönmesini, geçemeyenin unutulmamasını istedi.
Uygun başvurular arasında FIFO uygulanır; geçici engelli başvurunun sequence ve
requestedAt değerleri değişmez, başvuru kapanmaz ve her tur yeniden sınanır.
Home shard, tüm koloniler, 48 saat expiry ve sezon sıfırlaması için önceki soru
henüz yanıtlanmadı; bu karar onların onayı sayılmaz.

## İlk kod incelemesinde doğrulanan bağımlılıklar

Bu liste başlangıç envanteridir; tüm FK/JSON okuyucularının denetimi tamamlanmadı.

| Sınır | Gerçek çağrı noktası / bulgu | Gerekli doğrulama |
|---|---|---|
| Season/world kilidi | `services/ownership.ts:lockWorlds` önce season ön okuması, sonra SHARE season, sonra sıralı UPDATE world alıyor; final season yeniden sınanmıyor. | Ön okumadan sonra transfer yarışında harcama öncesi reddetme. |
| Yeni kayıt | `services/player.ts:joinSeason` audience membership SHARE kilidi kullanıyor. | Return/join/bot ortak admission; hiç kullanılmamış slot açık kalmalı. |
| Lifecycle | `services/servers.ts` global işlemde advisory `83202488` kullanıyor. | Provisioning ile aynı koordinasyon, season kilidinden geriye dönüş yok. |
| Klan | `services/clan.ts:reconcileClanPlayerReclaim` clan, sonra üyelerin player kilitlerini alıyor. | Transfer önce player kilitleyip helper çağıramaz. |
| Aktivite | `services/presence.ts:Presence.touch` yazmadan önce throttle koyuyor; DB hatasında throttle silip false dönüyor. | Başarılı presence/transfer sıralaması, expiry yenileme ve görünür DB hatası. |
| Event claim | `worker/queue.ts:claimDue` UPDATE/SKIP LOCKED ile claim ediyor; `complete` ve `fail` yalnız event ID kullanıyor. | Eski claimant yeni denemeyi kapatamamalı; transfer event kilidini yeniden okumalı. |
| Sensör okuma | `services/sensorHistory.ts:sensorHistoryForPlayer` yalnız playerId filtreliyor. | Current season sorgu filtresi zorunlu. |
| Sensör epoch | `refreshSensorEpoch` unchanged karşılaştırmasında seasonId yok. | Aynı koordinatla season değişimi ve sıfır süreli epoch testi. |
| Sensör tüketicileri | `routes/pirates.ts`, `routes/mining.ts`, `routes/galaxy.ts`, `services/pirateRaid.ts`, `services/traffic.ts`, `services/bots/brain.ts`, `services/mining.ts` (iki çağrı). | İmza değişiminde sekiz çağrı birlikte güncellenmeli. |
| Korsan ödülü | `services/rewards.ts:pirateVictories` | Distinct kimlik season+pirateIndex olmalı; cycle geçmişi korunmalı. |
| Yerleşim üretimi | `packages/rules/src/galaxy.ts:generateGalaxy` seeded rejection, slot başına 96 deneme ve minimum mesafe, başarısızlıkta RangeError. | WAIT havuzu ayrı RNG ile gerçek mevcut dünyaları engel almalı; MAIN üretimini değiştirmemeli. |

## Teslim sırası ve geçiş kapıları

1. Referans/lock envanterini tamamla; 48 saat, uyumluluk, FIFO testlerini önce FAIL olarak çalıştır. MAIN vacancy ve WAIT allocator deneyini ölç.
2. Additive şema, deterministik backfill, kapasite/provisioning ve test cleanup.
3. Busy/event/history/fog/klan adaptörleriyle iki yönlü atomik transfer; otomatik worker henüz kapalı.
4. Kalıcı dönüş kuyruğu, expiry, admission ve bounded worker; destructive reclaim yolu kaldırılır.
5. API contract, placement version, sunucu tarafı stream yetkisi, client reconciliation ve TR/EN dönüş arayüzü.
6. Lifecycle/bot/recap, regresyon, görsel kontrol, migration ve operasyon runbook'u.

Her kod paketi TEST FAIL → implementation → PASS → ilgili regresyon akışını izler.
Son kapı `pnpm verify`; mevcut VFR sorunu yeniden ölçülmeden baseline kabul edilmez.
PostgreSQL test helper bütün tabloları truncate eder; yalnız `_test` DB kullanılır.

## Bu başlangıçta yapılanlar

Manuel, entegrasyon dokümanı ve engineering standards okundu; yukarıdaki çağrı
noktaları mevcut kodda doğrulandı. Checkout planın incelediği commit ile aynı.
Başlangıç çalışma ağacında yalnız untracked `docs/handoffs/` vardı.

`packages/rules/src/returnQueue.ts` uygun en eski başvuruyu seçen saf kuralı
sağlıyor. Dört test önce FAIL (fonksiyon henüz yok), implementation sonrası PASS:
engelli A yerine B; A uygun olunca C önceliğini geri alma; engelli başvuruları
koruma; restart/sıra boşlukları ve JS güvenli tamsayı sınırının üstünde bigint sıra;
boş kuyruk. Henüz server admission tarafından çağrılmıyor.
Migration veya DB değiştirilmedi; yoğunluk/görsel doğrulama yapılmadı.
Bu kayıt Paket A'nın veya entegrasyonun tamamlandığı anlamına gelmez.

### Doğrulama sonucu

- Hedefli test: 4 FAIL → 4 PASS.
- `pnpm verify`: bütün workspace typecheck ve lint geçti; rules 40 dosya / 901 test geçti.
- Verify simülatörde 6 hatayla durdu: `season.test.ts` beş seed'de ARR LOW;
  `fleet-v2-balance.test.ts` araştırma zamanlaması (day4 SHIP_POWER) beklentisi.
- Değişiklik içermeyen `git archive HEAD` kopyasında simülatörün tamamı ayrıca
  çalıştırıldı: aynı 6 hata, 82 PASS. Manueldeki VFR listesi mevcut baseline'ı
  anlatmıyor. Denge sabitlerine/bantlarına müdahale edilmedi.
- Genel komutun erken durması nedeniyle server/web tam test sonucu bu çalışmada
  doğrulanmış sayılmaz. Yeni saf seçim kuralı DB yarışlarını kanıtlamaz; bu testler
  kalıcı admission paketiyle tamamlanmalı.

## Devam — güvenli köprü ve ilk izolasyon düzeltmeleri

- Kullanıcı altı baseline simülatör hatasının skip edilmesini açıkça istedi.
  Yalnız bu altı vaka skip edildi: simülatör 82 PASS / 6 SKIP. Gerekçe
  `docs/balance.md` ve manuelde kayıtlı; assertion ve bantlar korunuyor.
- Worker'ın destructive reclaim import/call/cadence yolu kaldırıldı. Gerçek DB
  testi önce `reclaimed=1` ile FAIL, sonra PASS; worker/reclaim/bridge 44 test PASS.
  Eski `reclaim.ts` servisi ve eski silme beklentili testleri henüz duruyor;
  production worker çağırmıyor. Bunlar tamamlanmış transfer davranışı sayılmaz.
- Saf 48 saat kuralı: 5 FAIL → 5 PASS; lastActiveAt/joinedAt/mainEnteredAt
  alt sınırları ve lastSeenAt bağımsızlığı doğrulandı.
- WAIT koloni allocator: 8 FAIL → 8 PASS. Seed 1/7/42/99/4242/1337 üzerinde
  300 ayrılmış başkent + 51 authored neutral + 900 göç kolonisi minimum 225
  mesafe ve 2000 radius korunarak sığıyor. Her seed'de aynı sonuç ve ters sıradaki
  obstacle girdisinde aynı adresler. İndeksler 750'den başlıyor, dolular atlanıyor.
  Bu geometri kanıtıdır; 375×812 yoğun sahne performansı hâlâ ölçülmedi.
- Sensor history için üç kırmızı PostgreSQL testi eklendi: iki season'da aynı
  koordinatlar, sıfır süreli epoch ve kaynak epoch'un hedef sorguya sızması.
  Sorguya zorunlu seasonId filtresi, epoch unchanged karşılaştırmasına seasonId
  eklendi; sekiz üretim çağrısı güncellendi. Hedefli regresyon çalışıyor.

### Paket B başlangıcı

`0060_amusing_mad_thinker.sql` ekleyici migration: MAIN/WAITING rolü,
season_cycles ve cycleId, homeShardId/mainEnteredAt/placementVersion. Legacy
season'lar tam tarih çiftiyle gruplanır, cycle UUID aynı grubun en küçük mevcut
season UUID'sidir; tarih veya aktivite değişmez. Önce nullable kolon/backfill,
sonra season cycle NOT NULL/FK uygulanır. Normal join home alanlarını yazar;
legacy/manual player insertleri için home alanları şimdilik nullable (transfer
kapısı bunları doğrulamadan açılmamalı).

Şema testleri 2 FAIL → 2 PASS. Ayrı `astera_sessiz_test` DB'sindeki mevcut
legacy satırlar üzerine migration uygulandı. servers/lifecycle/schema toplam
57 PASS; tüm workspace typecheck PASS. Üretim/dev DB migrate edilmedi.

Önceki genel verify yeni şema çalışmasına geçerken durduruldu: o turda web
2443 PASS, rules 914 PASS, sim 82 PASS/6 SKIP; server tamamlanmamıştı. Son
verify şema ve admission değişiklikleri tamamlandıktan sonra yeniden çalışmalı.

### Kalıcı başvuru ve presence

- `0061_gifted_thundra.sql`: return_applications ve return_queue_counters.
  Partial unique queued player, target/cycle/sequence unique, terminal closedAt
  CHECK. Player FK SET NULL ve immutable player snapshot; global wipe queued
  başvuruları SEASON_ENDED kapatıp geçmişini korur. Sayaç SQL default kullanır:
  drizzle-kit 0.30 JS bigint default'u JSON snapshot'a yazamıyor.
- Schema testleri 3 FAIL → 3 PASS; bot testleriyle toplam 22 PASS.
- `returnQueue.ts`: admission advisory → sorted season SHARE → player UPDATE →
  application protokolüyle idempotent enqueue/cancel, bigint sequence, tam deadline
  ve expected placement version kontrolleri. Beş servis testi FAIL → PASS.
- Presence player kilidi altında başvuruyu önce expire/extend eder, sonra activity
  yazar. Yeni dört test FAIL → PASS; auth/presence/queue toplam 60 PASS.
  Başarısız write loglanır ve throttle sıfırlanır; explicit queue işlemi throttle'sız.
- MAIN dışı join reddi ve server listesi filtresi 2 FAIL → 2 PASS. Bot quota
  WAITING'i hiç ziyaret etmez; roster warning de üretmez.
- Bot backlog testinde yeni yakalanan ölçüm hatası düzeltildi: tur alıp yeniden
  due olmuş bot starvation değildir. Kesintisiz uyanık kalanların başlangıç
  backlog'unun ilerlemesi sınanır; skip eklenmedi, 19 bot testi PASS.
- `loadLocked` ve `lockWorlds` için gerçek pg_blocking_pids ile source season
  bekleyen iki yarış testi önce yanlış bağlamda devam ederek FAIL oldu. Kilitli
  final world season'ı yeniden kontrol edilir; PLACEMENT_CHANGED ile harcamadan
  reddedilir. Hedefli regresyon çalışıyor.

Eksikler devam ediyor: WAIT provisioning, vacancy/audit/outbox şeması, tam transfer
motoru ve blocker envanteri, queue admission worker, HTTP/stream version çiti,
UI, cycle recap ve son lifecycle/yoğunluk/visual kontrolleri. Otomatik taşıma ve
başvuru endpoint'i açılmadı. Bu hizmetler tamamlanmış entegrasyon sayılmaz.

### WAIT provisioning ve son doğrulama turu

`waitingServers.ts` artık var: lifecycle lock altında matching cycle/ruleset,
komutan/koloni kapasitesi, dormant WAIT yeniden kullanımı, 16 shard operasyonel
varsayılanı ve bitiş sınırı. `createSeasonIn` tam endsAt ve initializedAt alır;
past event/act kayıtları DONE bırakılır. Restart repair testi önce eski olayları
pending olarak geri getirerek FAIL oldu; kalıcı DONE/dedupe kayıtlarıyla PASS.
Waiting + galaxy-event regresyonları 16 PASS.

World lock race 2 PASS; research regresyonunda rastgele probe bandının üst ucu
3006'ya çıkınca mevcut `<3000` testi FAIL oldu. Bu test yağmalanabilir tabanı
ölçüyor, rastgele bulanıklığı değil: SHIPYARD 4 ile accuracy=1 açıkça doğrulanarak
aynı tank-altı assertion korundu. Research + lock toplam 54 PASS; skip eklenmedi.

Ürün/architecture/deployment notları ve D174 uygulama durumunu açıkça ayırıyor.
D174 otomatik taşımanın tamamlandığını söylemez. Lint'teki iki optional-chain
uyarısı düzeltildi; son `pnpm verify` yeniden çalışıyor. Nihai sonuç aşağıya eklenmeli.

Hâlâ yapılacak: live-season uniqueness ve legacy anomaly raporu; zorunlu home
alanlarının manual insert uyumu; main vacancy/transfer-world/audit/outbox şeması;
ortak join/admission kapasite kilidi; tüm ref/lock envanteri; atomik bütün-world
transfer, event claim-generation, history/klan/reward adaptörleri; return admission
ve inactivity worker; API/SSE placement fencing ve UI; final cycle recap/rollover;
375×812 yoğun sahne ölçümü, staging geçiş/geri alma denemesi. Yeni queue/provisioning
servisleri henüz public API veya otomatik worker tarafından çağrılmıyor.


## CR düzeltmeleri — 2026-09-08

- Wipe player → application kilit sırasını presence ile ortaklaştırdı; gerçek wipe yarış testi eklendi.
- Bootstrap bütün yeni MAIN sezonlarında tek dönem zamanı kullanıyor; ilerleyen saatle cycle parçalanması önlendi.
- Aktivite/expiry zamanı player ve application kilitlerinden sonra okunuyor; kilit beklerken sezonu biten başvuru rollback oluyor.
- Beş regresyon senaryosu önce FAIL, sonra PASS; queue/presence/servers/season-lifecycle ile birlikte 71 PASS.
- İncelemede bulunan üç `bots-turn.test.ts` hatası değişiklik öncesi `f1fa09d` arşivinde de doğrulandı. Bunlar skip edilmedi.


## Aktarım bildirimi ve dönüş başvurusu — 2026-09-08

Kullanıcı aktarılmış komutana açıklama/yönlendirme modalı istedi. WAITING rolü ve placementVersion
sunucudan doğrulanıyor; modal 48 saat inaktiviteyi ve gezegenler/ilerlemenin korunduğunu TR/EN
anlatıyor. Başvuru düğmesi çalışan authenticated API'ye bağlı; mevcut başvuru için sıra gösteriliyor.
Kapatılan bildirim aynı cihazda player/version bazında hatırlanıyor, Menü → Sessiz Uzay yeniden açıyor.
GET/POST `/api/return-applications` artık bağlı; otomatik aktarım/admission worker hâlâ kapalı.

API/kontrat testleri 12 PASS; modal/menü/i18n testleri ilk çalışmada 49 PASS; web tam testleri
2451 PASS (son eklenen menü yönlendirme testi öncesi). Görsel harness:
`node tools/visual.mjs out/silent-space --silent-space`; TR/EN 375×812 bildirim, hata, sıra,
kapatma ve tekrar açma doğrulandı. Görsel fixture gerçek dünyaları taşımaz.

CR düzeltmeleri sonrası tam verify: typecheck/lint PASS, rules 919 PASS, web 2443 PASS,
sim 82 PASS/6 SKIP, server 1325 PASS/aynı eski 3 bot FAIL. Modal sonrası doğrulama ayrıca kaydedilir.

### Son doğrulama — modal ve CR düzeltmeleri birlikte

`pnpm verify` son çalışması: typecheck PASS, lint PASS, rules 919 PASS,
web 2452 PASS, sim 82 PASS / kullanıcı onaylı 6 SKIP; server 1328 PASS / 3 FAIL.
Başarısız olanlar değişiklik öncesi de doğrulanan `bots-turn.test.ts` içindeki Core ceiling,
warship olmayan dünya ve boş pad beklentileri; yeni skip eklenmedi. Beş kilit/zaman regresyonu,
üç return API kontrat testi ve bütün yeni modal testleri geçti. Tam verify bu üç eski hata
nedeniyle exit 1; yeşil olarak raporlanmıyor.

Kanıt: `/tmp/sessiz-modal-verify-final.log`, `/tmp/sessiz-modal-visual-final.log`.
Görseller: `out/silent-space/{tr,en}-{notice,error,queued}.png`.
Üretim/development veritabanına migration veya gerçek oyuncu aktarımı uygulanmadı.

### 8 Eylül — beş dakikalık motor ve açık oturum geçişi (devam ediyor)

0062 migration, atomik gidiş/dönüş servisi, kalıcı bakım kaydı/outbox ve worker bağlantısı
eklendi. Bakım fleet tick'inden bağımsız, 5 dakikada bir ve varsayılan 5 aktarım bütçesiyle
çalışır. `SILENT_SPACE_ENABLED` varsayılan false; canlı migration/deploy/aktivasyon yapılmadı.
Dönüş başvuruları tur bütçesinde önce değerlendirilir; yeni inaktif adaylar onları aç bırakamaz.

SSE her frame ve heartbeat öncesinde player SHARE kilidi altında season/version doğrular;
eski placement için sadece `placement_changed` bildirip bağlantıyı kapatır. Bekleyen frame
kuyruğu da socket buffer bütçesiyle sınırlıdır. Web bu bildirimi session reconciliation'a
bağlar: cache temizlenir, `/me` yeni yerleşimi yükler ve WAIT modalı normal açılışta görünür.

Son hedefli doğrulama: stream + transfer + worker 17 PASS; web event-stream 19 PASS;
server typecheck PASS. Yeni SSE ve dönüş bütçesi testlerinin RED → GREEN sonucu görüldü.
Bunlar tam özellik kabulü değildir. Açık işler: yeni join ile ortak admission/vacancy rezervi,
HTTP placement çiti, tarihsel koordinat/fog ve cycle sonuç izolasyonu, event/klan kapsamının
adversarial testleri, bakım turunda tüm kilit/bütçe sınırları ve geniş regresyon. Önceki
bölümlerdeki “motor henüz yok” ifadesi artık bu bölümdeki kısmi uygulama durumuyla değişmiştir.

### 8 Eylül — wiki'den ayrılmış deploy hazırlığı

Release ayrı worktree'de hazırlandı; wiki dosyaları ve ortak dil dosyalarındaki wiki
import/export'ları dahil edilmedi. İlk kod commit'i `b27db1a` origin/master'a pushlandı.
Qualification: typecheck/lint/build PASS; rules 919 PASS, web 2453 PASS, sim 82 PASS +
kullanıcının izin verdiği 6 skip; server 1339 PASS + baseline ile aynı isim/mesajlarda
3 bots-turn hatası. `loop-check` ve `movement` izole `_test` DB üzerinde ALL GREEN.
TR/EN modal 375×812 PASS. Genel visual harness D163'ten eski `worlds` seçicisinde
RED oldu; mevcut `home` seçicisiyle kamera/odak/ekonomi kontrolleri PASS. Sabit test
build'i `VITE_VISUAL_TEST=1` ile üretildi; normal production build bu bayrağı taşımaz.
Genel visual çalışmasında izole asteroid odak örneği bulunmadığından yalnız bu ölçüm
SKIP; runtime hatası yok. Canlı smoke için hesap veya dünya oluşturulmadı.

Production release otomatik aktarımı KAPALI tutar (`SILENT_SPACE_ENABLED=false`).
0060'daki zorunlu `cycle_id` eski sezon INSERT'iyle uyumsuzdur. `docs/deployment.md`
rule 12 uyarınca artifact/restore provası bittikten sonra kesinti onayı gereklidir;
normal “deploy et/devam et” talimatı bu açık kesinti kararının yerine geçmez.
