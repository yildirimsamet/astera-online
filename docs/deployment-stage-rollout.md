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
