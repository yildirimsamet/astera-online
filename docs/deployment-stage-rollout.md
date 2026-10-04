# Stage provası ve production geçişi

Hazırlık incelemesi: 2026-10-04. Ana işletim kılavuzu: [deployment.md](deployment.md).
Hazırlık planını ve aşağıdaki tarihli uygulama kayıtlarını birlikte içerir.

## Sahibin talimatı ve başlangıç sınırı

- Önce son local değişiklikler dahil temiz, push edilmiş commit hazırlanacak.
- Sahip “hazırız, pushladım” dediğinde stage kurulumu ve prova başlayacak.
- `https://stage.asteraonline.space` gerçek production DB'sinin ayrı kopyasıyla çalışacak.
- Sahip stage'de test ettikten sonra aynı release production'a taşınacak.
- Aktif sezon erken kapatılıp force wipe yapılacak; hesaplar, kayıtlı istatistikler,
  geçmiş sezon sonuçları ve hak edilmiş ödüller korunacak.
- Kullanıcıya özel geçici mining/pirate kısıtlamaları ve bunların testleri kaldırılacak.
- Ekonomi simülasyonları, ekonomi study/calibration komutları ve snowball audit çalıştırılmayacak.
  Release kontrol komutu `pnpm verify --exclude-sims` olacak. Normal kaynak işlemi ve
  ekonomi birim testleri bu seçenekle çalışmaya devam eder.

## Okuma ile doğrulanan mevcut durum

| Alan | 4 Ekim incelemesindeki durum |
| --- | --- |
| Production commit / dört uygulama container'ı | `b5e969e96c26fdf49f531f922fb142abf9fe60f5`, aynı image ID |
| Local HEAD | `a2f99e8`; ayrıca devam eden tracked/untracked değişiklikler var |
| Git ayrışması | Local 183 commit ileride, origin'deki 2 kısıtlama commit'i local'de yok |
| Migration journal | Production 97 (`0096` dahil), local HEAD 127, çalışma ağacı 141 |
| Bekleyen migration | Bugünkü çalışma ağacına göre `0097`–`0140`: 44 adet |
| Mevcut sezonlar | EU-1, EU-2 ve WAIT-1; aynı cycle, ruleset 8 |
| Mevcut bitiş | 11 Ekim 2026 11:52 TRT |
| Kalıcı/seasonal kayıt sayıları | 941 hesap, 288 oyuncu, 484 gezegen, 400 geçmiş sonuç, 95 kalıcı sosyal ödül |
| Sezon ödülü programı | Aktif cycle `reward_program_version=1`; henüz entitlement yok |
| İstatistik sürümü | Aktif cycle `stats_version=0` |
| Health / kuyruk | Üç API ve worker `.ok=true`; failed/processing event yok |
| Sezon kapanışı veri kontrolü | 288 oyuncu ve 5 klanın kayıtlı Dominion bakiyesi işlem geçmişiyle eşleşiyor |
| Worker ayarları | `BOTS_ENABLED=true`, `SILENT_SPACE_ENABLED=true`; batch 5, max shards 16 |
| DB / sunucu bütçesi | DB yaklaşık 244 MB; disk yaklaşık 40 GB boş, RAM yaklaşık 9.9 GiB available |
| Stage DNS / HTTPS | DNS `158.220.99.184`; mevcut sertifikada stage adı yok |
| Stage portları | 3300/3301/3302/3310/5546 inceleme sırasında boş |

Journal'ın production'daki ilk 97 girdisi ve SQL dosyaları local'de değişmemiş.
Journal indeksleri ve zamanları sıralı; eksik SQL dosyası yok. Migration'ın gerçek veri
üzerindeki başarısı henüz ölçülmedi; stage restore provası bunu doğrulayacak.

`0130`, gezegen deuterium sütunlarının tipini değiştirir; dolu tabloda lock/rewrite süresi
stage kopyasında ölçülecek. Ruleset 16 yeni worker event türleri üretir; geçiş eski ve yeni
worker/API süreçleri karışıkken yapılmayacak.

**Tespit edilen wipe engeli:** `planet_faults.planet_id` FK'si `NO ACTION`; production'da
40 fault kaydı mevcut. Wipe listesinin bunları gezegenlerden önce temizlememesi gerçek
`delete from planets` / `23503` hatasıyla ayrı local DB'de yeniden üretildi. Düzeltme yalnız
bu seasonal child kayıtlarının silme sırasını tamamlar; sezon/ödül kuralını veya şemayı
değiştirmez. Aktif ve tamiri süren fault için iki regresyon, kalıcı sonuç ve ödül hakkının
wipe sonrası korunduğunu da doğrular. Stage'de mevcut gerçek fault verisiyle tekrar ölçülür.

Production'daki iki ek commit yalnız IMG mining/harvest ve pirate raid engellerini ekliyor
(`f13946c`, `b5e969e`). Bugünkü local kaynakta bu engeller ve özel testleri zaten yok.
Git geçmişi birleştirilirken tekrar gelmemeleri kontrol edilecek; normal mining/pirate
yetki, fog ve input testleri korunacak. Çalışma ağacı stash/reset edilmedi.

## Release kapsamında incelenen başlıca değişiklikler

- Gözlemevi v2 arayüzü, Base/Fleet/Academy, yeni 3D gezegenler ve asset/lazy-load düzeni.
- 1000 koltuklu galaksiler, harita/sensör değişiklikleri, nötr dünya census'u ve bot davranışı.
- Klan ortak savaşları, savunma desteği, taktik kaçış, kalıcı gemi hasarı ve tamir.
- Çok dilli chat, DM, reply/reaction ve wipe öncesi sohbet arşivleme.
- Polar/Paddle ödeme yolları, satın alınan skin hakları ve yeni nginx CSP izinleri.
- Devam eden local anıtlar, HP radyasyonu, fiziksel uçuş/kargo ve sezon kapanışı çalışması.

**Ruleset kapısı:** devam eden local çalışmada varsayılan yeni sezon ruleset'i 16'ya
yükseltildi; anıtlar ve HP radyasyonu bu sürümde açılıyor. Son push yeniden okunacak ve
stage ile production için aynı hedef ruleset açıkça kaydedilecek (`--ruleset 16`). Yeni kapasite
koddaki 1000'dir; ana deployment belgesindeki eski 300/350 bilgisi bu release için kabul
kriteri olarak kopyalanmayacak. Anıt incelemesinin açık bulguları final commit'te yeniden
değerlendirilecek.

## Stage: production geçişinin provası

1. Hazır sinyali sonrası son commit SHA'sını sabitle. Sonradan push edilen başka kodu
   otomatik olarak bu release'e karıştırma. Test, server image etiketi ve web release
   işareti aynı SHA'yı göstermeli. `pnpm verify --exclude-sims` ve build'i tamamla.
2. Production topolojisini ayrı stage Compose projesinde kullan: üç API, tek worker,
   PostgreSQL 16 ve ayrı Valkey. Sabit production container adlarını, host portlarını,
   network/volume ve image etiketini stage için ayır. Sadece `-p` değiştirmek yetmez.
   Önerilen boş portlar: API 3300/3301/3302, worker 3310, DB 5546; önce doluluklarını kontrol et.
3. Stage'e ayrı DB parolası ve JWT anahtarı ver. Hesap/parola kayıtları DB kopyasından gelir,
   mevcut production oturum token'ları stage'de geçerli olmaz. Canlı ödeme anahtarlarını
   kopyalama; checkout kapalı veya ayrı sandbox olmalı. Admin/oyun ayarlarını kaydet.
4. Production çalışırken tutarlı `pg_dump` al; checksum ve restore'u doğrula. Ayrı stage
   PostgreSQL'e restore et. Migration öncesi hesap, oyuncu, dünya, geçmiş sonuç ve kalıcı
   hakların sayısını/kimliklerini karşılaştır. Production DB'ye write yapma.
5. Stage API/worker kapalıyken release image ile migration'ları bir kez uygula; journal ve
   backfill/constraint sonuçlarını doğrula. Kaynak dump'ı sabit bir release klasöründe tut.
6. Aynı offline geçişle `season wipe --yes` provasını çalıştır. Kod önce MAIN ve WAITING
   sezonlarını mühürlemeli; sonuçlar ve haklar yazılmadan world temizliği yapılmamalı.
   Account/lifetime, önceki sonuçlar, sosyal ödüller, skin hakları ve sohbet arşivlerini karşılaştır.
7. İki yeni MAIN sezonunun aynı cycle ve hedef ruleset ile açıldığını; yeni event takvimini,
   foreign key temizliğini ve ödüllerin successor cycle'a bağlanmasını doğrula.
   Her MAIN'de beş anıt ve beş sabit HP bulutu bulunmalı; development lobisi açılmamalı.
8. Worker ve üç API'yi başlat; dört health ve runtime commit kontrolü yap. Stage SSL/vhost
   kur; hazırlanan client'ı yayınla. HTTPS login, refresh, yeni sezona katılım, ödül teslimi,
   filo/rapor, klan, chat ve SSE akışını tarayıcıdan kontrol et.
9. Stage adresini sahibin manuel testine aç. Test bulguları varsa düzeltip ilgili kanıtı
   yenile; SHA değişirse stage tekrar o SHA üzerinde doğrulanır.

Stage'de test edilen veri production'a geri yazılmaz. Stage ödül teslimleri yalnız kopyada
kalır; production geçişi kendi güncel verisi ve kendi cutoff snapshot'ıyla yapılır.

### Hazır stage dosyaları ve komutlar

`docker-compose.stage.yml`, production Compose dosyasına eklenir. Ayrı checkout'ta
`.env.stage.example` üzerinden `.env` hazırlanır: yeni güçlü DB/JWT anahtarları, tam release
SHA'sı ve `ASTERA_STAGE_IMAGE=astera-server:<tam-SHA>` doldurulur. Oyun/worker ayarları
production envanterinden eşleştirilir. Live ödeme anahtarları overlay tarafından temizlenir.
Compose çıktısı secret içerdiği için `config` çıktısı log'a yazılmaz.

```bash
# ~/astera-stage içinde; .env hazırlandıktan sonra, yalnız stage projesini seçer.
stage_compose=(docker compose --env-file .env -f docker-compose.prod.yml -f docker-compose.stage.yml)
"${stage_compose[@]}" config -q
"${stage_compose[@]}" build api1
"${stage_compose[@]}" up -d postgres valkey

# Önce tutarlı production dump'ı stage DB'ye restore et ve sayılarını karşılaştır.
# Bu sırada stage API/worker henüz başlatılmaz.
"${stage_compose[@]}" run -T --rm --no-deps api1 \
  apps/server/node_modules/.bin/tsx apps/server/src/cli/season.ts migrate </dev/null
"${stage_compose[@]}" run -T --rm --no-deps api1 \
  apps/server/node_modules/.bin/tsx apps/server/src/cli/season.ts wipe --yes --ruleset 16 </dev/null

# Kalıcı kayıt/ödül kabulü ve image revision kontrolünden sonra:
"${stage_compose[@]}" up -d --no-build api1 api2 api3 worker
node tools/stage-nginx.mjs > /tmp/astera-stage-nginx.conf
```

Nginx renderer yalnız aday dosya üretir. Stage için önce HTTP ACME vhost'u ve ayrı
sertifika hazırlanır; ardından `/var/www/astera-stage` client'ı ve üretilen HTTPS vhost'u
kurulup `nginx -t` geçtikten sonra reload yapılır. Üretim sertifikası değiştirilmez.

Stage client `VITE_GA_ID` boşken build edilir. Production client aynı kabul edilen SHA'dan,
production'ın mevcut `VITE_GA_ID` değeriyle bakım öncesinde build edilir; stage'in boş
analytics ayarlı web dosyaları production'a kopyalanmaz. Server image iki ortamda aynıdır.

## Snapshot ve ödül kabulü

Kalıcı kaynaklar zaten `season_results`, `seasons.galaxy_record` ve
`season_reward_entitlements` tablolarıdır. `wipe` bunları saklar; `accounts.lifetime`
kümülatif değerlerini günceller ve sohbeti silmeden `chat_archive`/`dm_archive` içine kopyalar.

Release'e özel, erişimi kısıtlı backup klasöründe sonuç/ödül JSON veya CSV dökümü de tutulacak:
hesap kimliği, cutoff'taki ad, kaynak sezon/cycle, final sıra, ödül sırası, kaynak tutarları,
hedef cycle, `PENDING/DELIVERED/EXPIRED`, teslim sezonu ve teslim zamanı. Dosya checksum'ları
ve release SHA'sı birlikte kaydedilecek; gerçek kullanıcı verileri Git'e konmayacak.

Cutoff'ta kaydedilen `source_cycle` için aşağıdaki read-only sorgu wipe sonrasında CSV'ye
alınır; join testlerinden sonra aynı sorgu tekrar alınarak teslim durumu karşılaştırılır.
`source_cycle` psql değişkenidir; her ortam kendi kapanan cycle'ını kullanır. Kullanıcının
cutoff'taki adı kalıcı `recap` içinden okunur. Ödül almayan katılımcılar da sonuç dökümünde
kalır; onların entitlement sütunları boştur.

```sql
SELECT r.account_id, r.cycle_id AS source_cycle_id, r.season_id AS source_season_id,
       sh.code AS source_shard, s.closed_at, s.end_reason,
       r.recap->>'commanderName' AS commander_at_cutoff,
       r.final_rank, r.dominion, e.id AS entitlement_id, e.reward_place,
       e.alloy, e.crystal, e.deuterium, e.target_cycle_id, e.status,
       e.delivered_season_id, e.delivered_at, e.expired_at
FROM season_results r
JOIN seasons s ON s.id = r.season_id
JOIN shards sh ON sh.id = s.shard_id
LEFT JOIN season_reward_entitlements e
  ON e.source_season_id = r.season_id AND e.account_id = r.account_id
WHERE r.cycle_id = :'source_cycle'::uuid
ORDER BY sh.code, r.final_rank, r.account_id;
```

- Mevcut sıralama kuralında botun yeri boş kalabilir; aşağıdaki oyuncu onun ödülüne terfi
  ettirilmez. WAITING sezonu rank ödülü üretmez; sıfır Dominion uygun değildir.
- Hak, yalnız hemen sonraki cycle'a bağlanır. Oyuncu yeni sezona girince capital'e otomatik
  yatırılır. Aynı anda/retry ile join ikinci ödeme üretmemeli.
- Teslim edilen hakta `delivered_at` ve `delivered_season_id` bulunmalı; teslim edilmeyenin
  tutarı ve sahibi değişmeden `PENDING` kalmalı. Sonraki cycle bitene kadar girmeyeninki
  mevcut kurala göre expire olur.
- Legacy `stats_version=0` sezonunun mevcut veriden çıkarılabilen kayıtları korunur.
  Eskiden toplanmamış ayrıntılı üretim telemetry'si geriye dönük tam veri gibi sunulmaz.

## Production: aynı release, kısa bakım penceresi

Sahibin stage testi tamamlandıktan sonra kabul edilmiş server image ve aynı SHA'dan
production ayarlarıyla hazırlanmış web artifact'ını kullan.
Build ve uzun testleri bakım penceresinden önce bitir. Önce eski image ID, webroot ve nginx
vhost'u kaydet; production `.env` ve mevcut `.env.bak.*` dosyalarını koru.
Bu force wipe geçişinde `deploy/deploy.sh` kullanılmaz; gereken dump/restore provası,
kalıcı kayıt karşılaştırması ve trafik açmadan zorunlu health kabulünü sağlamıyor.

Force wipe, üç API ile worker'ın birlikte kapatılmasını gerektirir. Bakım sayfasını yalnız
production vhost'unda etkinleştir; nginx servisini tümden durdurma. Aktif gerçek oyuncu
sayısını ve geçiş başlangıcını kaydet. Tüm writer'lar durduktan sonra alınan yeni dump,
bu release'in geri dönüş sınırıdır; günlük backup retention'ından ayrı saklanır.

Son dump restore'unu doğrula ve gerçek son veriyle migration/wipe provasını disposable DB'de
tamamla. Ardından production'a aynı image ile migration, mühürleme ve wipe uygula. Hesap/kalıcı
kayıt farkları, ödül snapshot'ı ve yeni cycle kabulü geçmeden public trafik açılmaz.
Worker, API'ler, nginx/client ve dört health kontrolü tamamlandığında bakım sayfasını kaldır.

Yeni sezonda oyuncu write'ları başladıktan sonra eski dump'a dönülmez; bu onların yeni verisini
kaybettirir. Bu noktada çözüm forward fix'tir. Trafik açılmadan önceki hata ise doğrulanmış
dump ve önceki image/web/vhost ile geri alınabilir.

## Nginx ve tarayıcı kabulü

Stage client/API aynı `stage.asteraonline.space` origin'inde, production client/API aynı apex
origin'inde kalır. API adresi `api.` subdomain'ine taşınmaz; bu kurulum CORS gerektirmez.
Refresh cookie host'a özeldir, `Secure`, `HttpOnly`, `SameSite=Lax` kullanır. Stage için ayrı
upstream/server name/webroot/certificate tanımlanır; mevcut global nginx tanımları çoğaltılmaz.

`nginx -t`, HTTPS redirect ve certificate, CSP nonce substitution, statik asset/GLB/texture
erişimi, `x-server-time`, cookie refresh, SSE buffering/reconnect, proxy IP/rate limiter ve
eski açık sekmelerin lazy chunk erişimi stage'de kontrol edilir; production'da kısa smoke
tekrarlanır. Mevcut nginx testinde görülen HoofyWood server-name uyarıları bu release'e ait
değildir; başka sitelerin vhost'ları bu deploy kapsamında değiştirilmez.

## Stage uygulama kaydı — 4 Ekim 2026

- İlk prova release'i `e77fd31aedad230d09b4f4cacbb8c6026e51f3c1`; ayrı
  `/home/yildirim/astera-stage` checkout'u ve `astera-stage` Compose projesi kullanıldı.
- Tutarlı production dump'ı checksum ve restore envanteriyle doğrulandı. Kaynak dump,
  kalıcı kayıt karşılaştırmaları, kapanış sonuçları ve ödül JSON'ları sunucudaki erişimi
  kısıtlı `/home/yildirim/backups/astera-stage-20261004` klasöründedir.
- 44 migration yaklaşık 14 saniyede uygulandı; journal 141/141 oldu. Ruleset 16 ile
  force wipe yaklaşık 189 saniyede tamamlandı. Eski üç sezon mühürlendi; iki MAIN
  yeni ortak cycle, 1000 kapasite, beşer anıt ve beşer HP bulutuyla açıldı.
- 941 hesabın kimliği/parolası, 400 eski sezon sonucu ve 95 kalıcı sosyal ödül aynen
  korundu. 287 yeni (admin dışı) kapanış sonucu eklendi. 288 oyuncunun lifetime
  birikimi doğrulandı; 10.759 chat kaydı arşivlendi. Eski fault/world kayıtları temizlendi.
- Kapanışta altı ödül hakkı oluştu. Stage'deki gerçek bir hak sahibi yeni sezona
  katıldığında başlangıç stokuna tam ödül eklendi; tekrar join aynı gezegen ve stokla
  döndü. Provada beş `PENDING`, bir `DELIVERED` receipt ve teslim zamanı kaydedildi.
- Stage'e özel geçerli TLS sertifikası ve aynı origin API/SSE nginx yayını açıldı.
  Üç API ve worker health, cookie refresh, authenticated SSE, 150 statik asset ve
  350 px tarayıcıda Galaxy/Base/Fleet/Intel/Clan akışı geçti. Canlı ödeme kapalıdır.
- Sahip stage'i test edip production geçişini onayladı; son local değişikliklerin de
  push edilip release'e alınmasını istedi. Production geçişinin kendi son dump'ı ve
  kendi kapanış snapshot'ı kullanılacak; stage verisi production'a geri yazılmayacak.

### Release doğrulama sonucu

Workspace typecheck ve lint geçti. Ekonomi simülasyonları/snowball hariç rules
107 dosya / 1.976 test, web 368 dosya / 5.035 test PASS (bir dosya / 29 test SKIP).
Sunucu tam koşusu ve düzeltilen beklentilerin hedefli tekrarları birlikte güncel
196 test dosyasını kapsar: 2.855 PASS, bir SKIP. Tam koşu başlarken toplanıp daha
sonra sahibin isteğiyle silinen geçici pirate restriction test'i release dosyası
değildir. Eski sensör mesafeleriyle başarısız olmuş dosya yeni fixture'larla 34/34;
eski wipe beklentisi, eski sezon nesnelerinin temizliğini ve yeni sezonun beş anıt /
beş HP bulutunu ayrı doğrulayarak 5/5 geçti. Fault cleanup ile birlikte son wipe
regresyonu 7/7 PASS. Geçmiş recap'in canlı successor için açılış sayacı göstermesi
testle yeniden üretildi; düzeltme ve afterglow regresyonu 18/18 geçti.

Dosya bazında birleşik sunucu kanıtı `/tmp/astera-final-server-coverage-20261004.json`;
release SHA'sıyla sunucudaki backup klasörüne de alınır. VPS'teki ek disposable CI
koşusu performans nedeniyle durduruldu ve PASS olarak sayılmadı. Production/stage
DB'si test veritabanı olarak kullanılmadı.

## Production uygulama kaydı — 4 Ekim 2026

- Sunucu ve ilk web release'i `856cbf66189fc8515a89a38bbe0ae8669b1b2338`;
  dört sunucu container'ının image ID'si
  `sha256:31cead1947ac08b85e31ac6a1aa1615a3bdd732810388273e3c63442291ebbf5`.
- Production bakım penceresi 18:48:39–18:56:50 UTC (21:48:39–21:56:50 TRT),
  yaklaşık sekiz dakika. Stage yayını bakım sırasında erişilebilir kaldı.
- Dört production writer durduktan sonra alınan son dump checksum ile doğrulandı;
  aynı release'le ayrı disposable DB'de restore, 44 migration ve force wipe
  provası geçti. Sonra production'a aynı migration ve wipe uygulandı; journal 141/141.
- 941 hesap, kimlik/parola kayıtları, 400 eski sezon sonucu ve 95 kalıcı sosyal
  ödül korundu. 288 lifetime fold doğrulandı; 287 admin dışı kapanış sonucu
  eklendi. 10.761 sohbet kaydı arşivlendi. Eski üç sezon `FORCED_WIPE` ile mühürlendi.
- Yeni production cycle: `11578e87-07c4-42db-9da3-afc93ed265cf`. EU-1 ve EU-2
  ruleset 16, 1000 kapasite, beşer anıt ve beşer HP bulutuyla açıldı. Başlangıç
  4 Ekim 18:56:16 UTC; mevcut doğal bitiş 3 Kasım 18:56:16 UTC.
- Kapanışta altı ödül hakkı successor cycle'a `PENDING` olarak bağlandı. Trafik
  açıldıktan sonraki kontrolde iki gerçek oyuncunun hakkı `DELIVERED` oldu;
  dört hak bekliyor. İki receipt'in teslim zamanı ve yeni cycle'daki sezonu doğrulandı.
  Bu sayılar 4 Ekim 19:00 UTC civarındaki gözlemdir; güncel durum DB'den okunur.
- Son dump, eski env/image/web/nginx, kalıcı kayıt karşılaştırmaları ve kapanış
  snapshot'ları izinleri kısıtlı `/home/yildirim/backups/astera-production-20261004`
  klasöründe saklandı. `snapshots/season-results-cutoff.csv` 287 katılımcının
  kapanış kaydını, `snapshots/season-reward-delivery.csv` altı hak sahibini,
  miktarları ve gözlem anındaki teslim durumunu içerir. Dosyalar checksum'landı;
  yerel kopyalar git dışındaki `out/deployment-20261004` altındadır.
- Production `.env` aynen korundu. Üç API ve worker health, event kuyruğu/SSE,
  HTTPS sertifikası, nginx syntax, CSP nonce, static release ve public API geçti.
  350 px gerçek tarayıcıda ilk ekran, 43 asset ve public server listesi geçti;
  page error veya başarısız same-origin istek yoktu. Üçüncü taraf reklam/analytics
  istekleri bu tarayıcı smoke'unda engellendi. Post-deploy failed/stale processing
  event ve log error sayısı sıfırdı.
- Son prova için oluşturulan disposable PostgreSQL container/network/volume
  başarılı geçişten sonra kaldırıldı; dump ve karşılaştırma kanıtları saklandı.
  Ekonomi simülasyonları ve snowball audit çalıştırılmadı.

### Chat dili takibi

Production sonrası sahibi, genel chat dilinin pencere kapatılınca uygulama diline
döndüğünü bildirdi. Gereksinim: seçilen chat dili aynı tarayıcıda kapanış/açılış ve
yenileme boyunca hatırlanmalı; uygulama dili bağımsız kalmalı. İlk seçim yoksa
uygulama dili kullanılır, geçersiz/eski değer yok sayılır, storage hatası chat'i
kapatmaz. Mesaj/query/draft ayrımı ve clan/DM kanal seçimi aynı kalır.

Kapat/aç, uygulama dili değişimi ve kayıtlı tercihle fresh mount senaryoları mevcut
kodda üç ayrı FAIL olarak üretildi. Tercihi lazy initializer'da okumak ve yalnız
dil seçiminde saklamak düzeltmeyi sağlar; ilgili chat/host/language/type-scale
regresyonları 44/44 PASS. Bu arayüz takibi yeni season wipe gerektirmez.

Sahibin sonraki isteğiyle Klan odası yeşil, DM mor zemin aldı; Genel'in zemini
korundu. 10 px chat composer ve DM arama kontrolleri iOS odak zoom'u için 16 px
yapıldı; textarea'nın satır/padding'i mevcut 40 px yüksekliğe sığdırıldı. 350 px
gerçek Chromium render'ında üç oda, 16 px computed font, taşma olmaması ve dilin
kapat/aç/yenilemede korunması doğrulandı. Bu render sahte API verisiyle yapılan
yerel UI provasıdır; fiziksel iPhone klavyesi denenmedi. İlgili son 68 test ve
typecheck/lint geçti; dil fix'inden sonraki tüm web koşusu 5.040 PASS / 29 SKIP.

Bu chat düzeltmeleri `5e5c0c3d94b80d4b673d8a98b1d7934df9246c93` web
artifact'ıyla stage'e 19:30:30 UTC, production'a 19:32:39 UTC'de yayınlandı.
Server/rules/dependency farkı olmadığı doğrulandı; sunucu image'i `856cbf6`
olarak kaldı. İki ortamda HTTPS, CSP nonce ve public API; stage'de 41,
production'da 43 asset'lik tarayıcı smoke'u hatasız geçti. Sekiz uygulama
container'ı sağlıklı, production journal 141, failed/stale event ve yanlış
cycle'a ödül teslimi sıfır. Production env korundu; migration/wipe tekrarlanmadı.
Yayın kanıtı özel backup'taki `astera-chat-20261004/chat-publication-summary.json`.
Son ödül gözleminde altı hakkın üçü teslim edilmiş, üçü bekliyordu; tarihli
snapshot kopyaları saklandı, yerel CSV'ler bu gözleme güncellendi.

## Doğal sezon kapanışı incelemesi — 4 Ekim 2026

Production'ın iki canlı MAIN sezonunda `season_end` 3 Kasım 18:56:16 UTC,
`season_rollover` 19:01:16 UTC olarak birer kez `pending` durumda kayıtlıdır.
İlk işlem sezonu dondurup snapshot alır; ikinci işlem tüm sezonlar frozen ise
beş dakika afterglow ardından world cleanup, lifetime fold ve successor açılışını
tek transaction'da yapar. Eski handler docblock'undaki “15 dakika” güncel sabit
değildir; `SEASON.afterglowMinutes=5` ve gerçek event zamanı esas alınır.

Yeni uçuş, mining, pirate, trade, convoy, destek ve grup savaş işlerinde dönüşü
deadline'a sığdıran admission kontrolleri vardır. Anıt OUTBOUND/HOLD/RETURNING
filoları bitiş anına kadar hesaplanıp doğrudan evlerine teslim edilir; kapanış
bunların uçuşta kalmasını beklemez. Normal son-sezon trafiği sonsuz yeni uçuş
üreterek bitişi uzatamaz.

**Bulgu:** diğer devam eden işler için `freezeSeason` bir saniyelik retry yapar;
üst bekleme sınırı yoktur. Flight/mining/build/research/strategic/pirate/trade/
convoy/clan-war/support kayıtlarından biri kalıcı olarak tamamlanmazsa freeze ve
rollover ertelenmeye devam eder. Kuyruk recovery mekanizmaları bu riski azaltır;
bitişe bağlı zorunlu bir sonlandırma sınırı sağlamaz.

Güncel ruleset 16 ile ayrı local test DB'de doğal kapanış ve +5 dakika rollover
tamamlandı: iki successor, toplam on anıt, korunmuş lifetime. Kalıcı orphan flight
ve eski PAUSED strategic row senaryolarında +5 dakika, +1 saat ve +24 saat
kontrolünde status hâlâ live ve her iki retry +1 saniyeydi. Bu son iki prova yalnız
handler'ın kalıcı blocker karşısındaki politikasını ölçer; worker abandonment
recovery'si çağrılmadı. Kanıt git dışındaki
`out/deployment-20261004/automatic-wipe-audit.json`; sadece prova DB'si kaldırıldı.

Önerilen takip: bitiş anına kadar deterministik reconciliation ve sınırlı grace
penceresi, ardından idempotent snapshot/cleanup; geç kalan veya bozuk state'in
istatistik/ödül kaybı üretmeden kapanması testlenmeli. Sezon/PvP kuralı bu incelemede
değiştirilmedi; `CLAUDE.md` core season değişikliklerini sahibin kararına bağlar.
