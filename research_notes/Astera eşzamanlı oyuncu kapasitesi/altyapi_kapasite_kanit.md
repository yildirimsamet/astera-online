# Astera altyapısı ve eşzamanlı kapasite kanıtları

İnceleme: 27 Ekim 2026. Bu çalışma salt kaynak/eldeki kanıt incelemesidir; üretime bağlanılmadı, Docker veya yük testi çalıştırılmadı, ürün kodu değiştirilmedi. HTML envanteri kardeş araştırmada üretildi; güncel çalışma ağacı mimarinin güncelliğini belirler. Dosya referanslarının kökü `/home/yildirim/Desktop/Coding/MyProjects/blindspace`.

## Bugünkü altyapı gerçekte neyi sınırlar?

### Takeaway

Kaynak, üç API, tek worker, tek PostgreSQL ve geçici Valkey'i aynı makinede topluyor. Bu topoloji 1.000 bağlantıyı kategorik olarak yasaklamıyor; fakat 1.000 yoğun oyuncu için CPU/SQL/kilit/bildirim kapasitesi veya 5.000 için ayrı bir altyapı yeterliliği kanıtlanmış değil.

### Cited Findings

- API başına 1 GiB bellek sınırı, ana DB havuzu 8, placement havuzu 2; üç API tanımlı. PostgreSQL 4 GiB, worker 768 MiB/12 DB bağlantısı, Valkey 128 MiB container ve 64 MiB anahtar bütçesi kullanıyor. API/worker için CPU sınırı görünmüyor; hepsi aynı CPU kaynaklarına yarışabilir. Bunlar dosyanın varsayılanlarıdır, canlı `.env` değerleri değildir. [Compose](/home/yildirim/Desktop/Coding/MyProjects/blindspace/docker-compose.prod.yml:20), [DB](/home/yildirim/Desktop/Coding/MyProjects/blindspace/docker-compose.prod.yml:134), [worker](/home/yildirim/Desktop/Coding/MyProjects/blindspace/docker-compose.prod.yml:204)
- Her API ayrı, tam bir adet LISTEN bağlantısına sahip; worker bus'ı başlatmıyor. Böylece klasik üç API/worker için azami yapılandırılmış bütçe **3×(8+2+1)+12=45 PostgreSQL bağlantısıdır**. Bu anlık açık bağlantı ölçümü değil. Arena açıksa ana havuzuna en fazla2 daha eklenir; bu rol bus/placement route'u kullanmadığı için placement1 ve LISTEN'i otomatik eklememek gerekir. Seed/migration/admin/backup/monitoring ve geçici rolling-release süreçleri ayrıca bütçelenir. [LISTEN max1](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/stream/bus.ts:533), [API-only start](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/index.ts:61), [arena](/home/yildirim/Desktop/Coding/MyProjects/blindspace/docker-compose.prod.yml:249)
- Sürücü havuzları tembel açılır; NativeSessions `isCurrent` aynı ana DB handle'ını kullanır, ayrı DB havuzu açmaz. Native oturum doğrulaması bağlantı sayısına yeni havuz eklemez ama mevcut havuzdaki sorgu süresini/iş sayısını artırır. [DB oluşturma](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/db/client.ts:13), [native doğrulama](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/services/nativeSessions.ts:67)
- Placement whitelist'ine alınmış sıcak GET'ler önce/sonra yerleşim SELECT'i kullanır. Diğer authenticated handler'lar, yazmaların tamamı ve `/api/galaxy`, `/api/intel`, `/api/monuments` gibi yazı yapabilen GET'ler iki bağlantılı placement transaction'ını handler boyunca tutar. Dolayısıyla bu sınıftaki en fazla **2/API, toplam6** handler aynı anda lease alabilir; yalnız bağlantı limitinden çıkan sınırdır, tüm GET'ler için geçerli değildir. [Whitelist ve gerekçe](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/services/placementGate.ts:9), [lease boyunca handler](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/services/placementGate.ts:102)
- Nginx aynı `least_conn` upstream'ini SSE ve sıradan API için kullanıyor,64 idle keepalive saklıyor. HTTP/2 istemci tarafında açık; API upstream'i HTTP/1.1 keepalive, `Connection ''`, SSE buffering kapalı. Bu iyi başlangıçtır; her fetch yeni TCP/TLS açıyor demek yanlış olur. [upstream](/home/yildirim/Desktop/Coding/MyProjects/blindspace/deploy/nginx/astera.conf:44), [SSE](/home/yildirim/Desktop/Coding/MyProjects/blindspace/deploy/nginx/astera.conf:235), [API](/home/yildirim/Desktop/Coding/MyProjects/blindspace/deploy/nginx/astera.conf:269)
- `least_conn` aktif bağlantıyı dengeler, CPU/SQL maliyetini değil. `keepalive64` toplam aktif bağlantı tavanı değildir; worker başına idle önbellek miktarıdır. Uzun yaşayan SSE'lerin kısa HTTP seçimlerini etkileyebilmesi ölçülecek bir olasılıktır; dengesizlik bu incelemede yeniden üretilmedi. [Nginx resmi açıklama](https://nginx.org/en/docs/http/ngx_http_upstream_module.html#least_conn), [keepalive](https://nginx.org/en/docs/http/ngx_http_upstream_module.html#keepalive)
- Container nofile65.535 var; host preflight Nginx systemd nofile65.535 ve worker_connections≥8.192, host≥6CPU/10GiB, PGmax_connections100 bekliyor. Bugünkü hostta bunları çalıştırmadım. Script şu an Compose servis listesini eski tam6servisle eşitliyor; yeni arena7.servis olduğundan bu kabul kapısı ayrıca güncellenmeli. [Preflight](/home/yildirim/Desktop/Coding/MyProjects/blindspace/deploy/host-capacity-preflight.sh:19), [eski exact servis listesi](/home/yildirim/Desktop/Coding/MyProjects/blindspace/deploy/host-capacity-preflight.sh:62)
- Son tarihli tarihsel host kaydı17Ekim'de6CPU, yaklaşık11,7GiB RAM,8,9GiB available ve105,7GiB boş disk diyor. Bu bugünkü host ölçümü veya aktifoyuncu testi değil. [Tarihsel kayıt](/home/yildirim/Desktop/Coding/MyProjects/blindspace/docs/mobile-backend-rollout-2026-10-17.md:17)

### Inferences

- En yakın fiziksel risk yalnız bağlantı sayısı değil;3Node eventloop'unun görünürlük/serialization CPU'su,1worker'ın CPU ve kilit beklemeleri, PG/OS cache ve disk I/O aynı hostu paylaşır. Birlikte yükselen bir savaş dalgası bu kaynakları aynı anda tüketebilir. Container sınırları arıza yayılımını azaltır ama ilave throughput üretmez. Dayanak yukarıdaki Compose topolojisi.
- Placement beklemesinin kapasite modeli: bu sınıftaki ortalama handler süreleri `T` saniye olursa teorik servis kapasitesi yaklaşık `6/T` request/s'dir; gerçek kapasite kilit bekleme ve diğer havuzlarla daha düşebilir. Örneğin100ms süre varsayımı60/s eder; **ölçüm değildir**,300ms olursa20/s. Bu yüzden rastgele pool büyütmeden önce placement start/lock/handler süreleri ayrı ölçülmeli. Dayanak handler boyunca tutulan lease.
- Nginx TCP/FD sınırı 1.000/5.000 bağlantıya tek başına engel diye gösterilemez. RAM, sendqueue, TLS, olay fan-out ve gateway CPU'su ayrıca ölçülür;5.000 istemcide FD sayısı yalnız5.000 değildir (istemci/upstream, kısa HTTP, log dosyaları da var).

### Gaps

- Canlı makinenin güncelCPU/RSS/IOPS/bandwidth/PGparametreleri, arena etkinliği, gerçekenv ve upstream dağılımı ölçülmedi. Deployment.md ve manuel kaynakların tarihsel host kayıtları güncel runtime kanıtı değildir.
- 1.000oyuncuda yalnız replika sayısını artırmanın kaç kat katkı yapacağı bilinmiyor. Tek ağırgalaksi, binlerce görüntüleyen, readmodel/mutation türleri ve hedef yoğunlaşması sonucu belirler.

## Mevcut kapasite kanıtı 1.000 veya 5.000 oyuncuyu doğruluyor mu?

### Takeaway

Hayır, eldeki raw sonuçlar bu iddiayı doğrulamıyor; bu, sistem kesin çalışmaz demek değildir. Yerel artefaktlar24Ağustos2026'ya ait300hesaplık kısa testler; bugünkü load harness de300koltuk varsayımları taşıyor.

### Cited Findings

- `artifacts/capacity/*.json` dosyalarının tamamı incelendi ve sadece rapor için özetlendi. Sunucu testlerinin tamamındaki commit `3ba8d722e83ca7ea61e96bd3dc18e0998e527d5c`, timestamp24Ağustos2026. Ham veriden üretilen toplu envanter: [Artefakt özeti](</home/yildirim/Desktop/Coding/MyProjects/blindspace/research_notes/Astera eşzamanlı oyuncu kapasitesi/kapasite_artefakt_ozeti.json>).
- En anlamlı eski test:300hesap/300SSE,90snquiet,10sn içinde100 saldırı. GET p95 **110,42ms**, POST p95 **137,88ms**,100mutation;30.000SSEevent,0streamfail. `passed:true`, ama `worktreeDirty:true`. Yalnız7eski gate (`no5xx`,network,rate-limit,readLatency,mutationLatency,eventFreshness,stableSse) kontrol edilmiş. Bugünkü kaynak/OCIeşliği, DBreconciliation, CPURSS, semantikcommittedstate ve worker lateness gate'leri bu dosyada yok. [Ham rapor](/home/yildirim/Desktop/Coding/MyProjects/blindspace/artifacts/capacity/smoke-300-100-launch-metric.json)
- Aynı testte worker finalmetriği77işlenmişevent gösteriyor;0handlerfailure ve21,59ms p95tick var ama eventlateness histogramı yok. Bunlardan yüz saldırının sonuçlanma doğruluğu, stratejik/radyasyon/jointbattle bütünlüğü veya yoğunoluşan olayların zamanında çözülmesi çıkmaz. [Aynı raw rapor](/home/yildirim/Desktop/Coding/MyProjects/blindspace/artifacts/capacity/smoke-300-100-launch-metric.json)
- Eski375connection testleri300hesap/375SSE'dir.15snquietoverflow testipassed, fakat375reconnect varyantında GETp95 **3.865,77ms** olupreadLatencyFAIL. Sonraki300reconnectjitter20sn testipassed/GETp95220,40ms. Bunlar gelişmekte olan eski sürümün karşılaştırmaları; bugünkü sistem375'tebozulur sonucuna kullanılamaz. [375reconnect](/home/yildirim/Desktop/Coding/MyProjects/blindspace/artifacts/capacity/smoke-375-reconnect.json), [375overflow](/home/yildirim/Desktop/Coding/MyProjects/blindspace/artifacts/capacity/smoke-375-overflow.json), [300jitter](/home/yildirim/Desktop/Coding/MyProjects/blindspace/artifacts/capacity/smoke-300-reconnect-jitter.json)
- `client-351-hardware-reset`30sn,351world,headeddesktopIntelUHDmobilviewport: frameintervalp9517,1ms/p9918,8ms,max39,4ms,passed. Açıkproof `desktop-mobile-emulation; real Android acceptance still required`.351world1000client değildir ve bugünkü1000+worldtelefon performansını kanıtlamaz. Aynı seride earlier `client-351-hardware`noLongFreezeFAIL vardır. [Raw istemci kanıtı](/home/yildirim/Desktop/Coding/MyProjects/blindspace/artifacts/capacity/client-351-hardware-reset.json), [probe sınırı](/home/yildirim/Desktop/Coding/MyProjects/blindspace/tools/capacity-client.mjs:1)
- Deployment.md300/300normal3600sn,600/600normal3600sn+100wave+1200snreconnect,600/750quiet600sn profillerini anıyor. Yerel artefaktlarda600/750ham sonuç bulunmadı. Belgenin kendisi bunların bugünkü1000seatayarını sertifikalandırmadığını belirtiyor. Bu kayıtları tamamlanmış ve geçmiştest diye sunmamak gerekir. [Profil ve sınır](/home/yildirim/Desktop/Coding/MyProjects/blindspace/docs/deployment.md:866)
- Bugünkü runner `--users≤600`, `--connections≤750`; normalortalama600sn/eylem, busy240sn/eylem. Eylemler ağırlıkla tekDARTsaldırı, collect, tekDARTbuild veya chat. Koordine stratejikbomba/ortakfilo/kaçış/kaynaktransferi senaryosu yok. SafetyNet5GET/60sn, actualclienttraffic5sn ile aynı örüntü değil. [Arg/senaryo](/home/yildirim/Desktop/Coding/MyProjects/blindspace/tools/capacity.mjs:99), [safetyNet](/home/yildirim/Desktop/Coding/MyProjects/blindspace/tools/capacity.mjs:619), [mutations](/home/yildirim/Desktop/Coding/MyProjects/blindspace/tools/capacity.mjs:633)
- **Kesin harness drift:** reconciliation2galaksiye, herbirinde `capacity===300` ve user dağıtımında300'e sabitlenmiş; waveinterleave `%300`. Currentrules2galaksi×1000, seedCLI currentSERVERSdeğerlerini kullanıyor. Runner tavanını değiştirmek tek başına yeterli değil: currentseed iledbreconcilegate300bekleyerekfailolabilir. [300reconciliation](/home/yildirim/Desktop/Coding/MyProjects/blindspace/tools/capacity.mjs:1170), [wave](/home/yildirim/Desktop/Coding/MyProjects/blindspace/tools/capacity.mjs:685), [currentrules](/home/yildirim/Desktop/Coding/MyProjects/blindspace/packages/rules/src/constants.ts:3182), [seed](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/cli/capacity.ts:81)
- Seed baştan temizler, kullanıcı başına tekcapital, seviyeler8, aynıwealth/azsayıgemi türü ve varsayılan90mission/45miner oluşturur. Geçmişrapor/sensör/klan/koloni/strategicstate birikimini temsil etmez. Bu tekrarlanabilirlik için doğru ama sezonyüklüfixture değildir. [Seed sıfırlama](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/cli/capacity.ts:102), [gemi/building](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/cli/capacity.ts:188)

### Inferences

- En dürüst sınıflama: **1.000aktif üretimuygunluğu henüzkanıtlanmamış;5.000içinhemtesthemölçeklemehazırlığıeksik**. Kullanıcıya1000kesinkaldırır veya1000kesinkaldıramaz denmemeli.
-5.000 toplamı planlarken mevcut varsayılan 2 MAIN galaksi × 1.000 yerleşim tasarımı da ele alınır. Bu, global hard 2.000 oyuncu sınırı kanıtı değildir; admin ve dinamik provisioning yolları bu alt araştırmada ayrıca incelenmedi. 5 × 1.000 galaksi pratik bir teknik bölümleme önerisidir; wait/return ve kapasite politikaları hesaba katılmalıdır. 5.000 tek galaksi ayrı görünürlük/fan-out/etkileşim maliyetine sahiptir.

### Gaps

- Güncelsürümde1000SSE+gerçekperiyodikread+doğrulanmışkomutpatlaması ölçümü yok. Birgalakside1000 ile5galakside1000'er kişiyi kıyaslayan hamveri yok.
- Eski rawçalışmaların fullsource/fixture runtimeeşliği araştırmada yeniden oluşturulmadı;24Ağustossüresive7gatebugünün kriterlerine taşınamaz.

## Kesin maliyetler ve muhtemel ek darboğazlar neler?

### Takeaway

Bağlantı adedinden önce bildirim/GET/SQL çoğalmasını, placement admission süresini, cache alanını ve aynı makinedeki kaynak yarışını ölçmek gerekir. Ortak NAT ve eski load fixture yanıltıcı bir kapasite tablosu verebilir.

### Cited Findings

- AuthenticatedBeareristeklerindeki globalrate-limitkeyhesapbazlı,300/dk; login ve signup normalleştirilmişIPbazlı ve default40/18sayılıdır. Oyunbucket'ı Valkeyhatasında failopen, auth/seatlimitleri failclosed. Beareridentity yaparken gerçek DBsessionkontrolü çağrılıyor; requireAuth daha önce ayarlanmışidentity'yi kullanıp doğrulamayı tekrar etmiyor, presence touchyapıyor. [Global limiter](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/app.ts:319), [route limits](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/app.ts:249), [identity](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/auth/tokens.ts:61), [requireAuth](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/routes/auth.ts:194)
- Loadrunner logini proxy yerine direktloopbackreplicalardan yapmayı destekliyor; yapayXFF defaulttrue. Bunun amacı aynıIP'den yüzlerceloginin bruteforce sayılması sorununu ayırmak. Ancak bu ölçüm gerçekpaylaşılanNAT/mobilcarrier loginpatlaması kabulü değildir. Üretimproxy XFF'yi client'tan kabul etmeyip overwriteeder; bu güvenlik korunmalı. [Runner gerekçesi](/home/yildirim/Desktop/Coding/MyProjects/blindspace/tools/capacity.mjs:11), [XFF](/home/yildirim/Desktop/Coding/MyProjects/blindspace/deploy/nginx/astera.conf:239)
- ProjectioncacheAPIbaşınamaxAccounts1024/maxSeasons16; capacitycomposemaxSeasons4. LRUcapacityaşıncaeneskianahatarıevicteder, doğrulukbypassdeğil yenidenyüklememaliyetidir.5.000hesap rasgelerouteediliyorsa herreplicada1024privateentry churnriski var; kesinminhit oranı çıkarılamaz. [Prod defaults](/home/yildirim/Desktop/Coding/MyProjects/blindspace/docker-compose.prod.yml:89), [LRU](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/services/asyncCache.ts:133)
- MevcutValkeydiskkaydıyok ve allkeys-lru; ramdoluncaanahtarsilebilir. Bu, yenidenüretilebilircache/rate-limitmodeli için tasarlanmış; authoritativegamestate/outbox'unaynıevictionpolitikasınakonması doğrulukriskioluşturur. [Config](/home/yildirim/Desktop/Coding/MyProjects/blindspace/docker-compose.prod.yml:157), [Redis eviction mekanizması](https://redis.io/docs/latest/develop/reference/eviction/)
- Currentmetricsroute/processCPURSS,eventloopGC,poolprobe,placementtransactionstart,bus/cache/stream/workeristatistikleri içeriyor. Bunlar temel olarak var; eksik iş correlation/SQLfingerprint/routeiçisüreayrımı ve gerçekyükaltındaharitalamak. [Runtime metrics](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/services/runtimeMetrics.ts:48), [metrics route](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/routes/health.ts:227)

### Inferences

- **Açık varsayımlı maliyetmodeli:** kullanıcıbaşınasadece5sntrafficGET kalırsa `GET/s=N/5`:1000oyuncuda200/s,5000'de1000/s. Bu sayılara diğer GETler ve komutlar dahil değil. NativeSSEheartbeat25s kalırsa `N/25`frame/s ve route'taki kontrolyolu nedeniyle ek DBişi var; küçükmesajınDByükü mesajbyte'ındanbağımsızdır. Bu formüller throughputölçümü değil.
- Galaksibaşınaolayoranı `e`, abone `n`, refreshbaşınaendpoint `k` olursa birleştirmeöncesi kabaGETüretimi `e×n×k`; yenidenbirleştirmeoranı ve etkinquerysayısı bunu değiştirir. Bu yüzden socket header tasarrufu tek başına asılSQL/CPUçarpanını kaldırmaz. Codeayrıntılarını okuma/canlıaraştırması sağlıyor.
- BüyükortakNAT'de authenticatedoyunbucket'larıhesapbazlıolduğu için herkesiIPbucket'ına koyuyor demek yanlış. Asılsınır login/register/refresh gibiIPbazlı kapılar ve Valkeykesintisinde authkapısının kapanması; güvenlikpolitikasınıkaldırmadan ayrı kabulsenaryosu gerekiyor.
- Tarihsel351worldpayload/framekanıtından1000/5000entitytelefonFPS'içıkmaz. Sunucupushdeltaları networkCPU'yuhafifletse bile istemciyerelgörünürlük/React/Threeçizimmaliyeti ayrıca ölçülür.

### Gaps

- Rate-limitwindow'ınprodcevabı ve ortakkatmanNATdağılımı canlıölçülmedi;4xxolayıgamebugveyaDBsaturasyongibi sınıflandırılmamalı. Gatebüyütmelerikörlemesineönerilmez.
- Cacheeviction/hit/slowclose veplacementstartyükaltındasayısaltrend yok;5000'dekesinbyteRAMgereksinimihesaplanamaz.

## 1.000 ve 5.000 için en sade, dayanıklı topoloji nasıl olmalı?

### Takeaway

İlk aşama monoliti yenidenyazmak değil; yinelenen işi düşürmek, sağlamreadmodel/canlısözleşmekurmak ve kaynakları ayırmaktır.5.000toplamda doğalgalaksisınırı ile workloadbölmek, önceDB'yişardetmekten daha azoperasyoneltuzaktaşır.

### Cited Findings

- ŞimdikiDByedeği günlükpg_dump+medyatar,varsayılanhost`$HOME/backups`,14tutulum. Repojob'unda offhostkopya/WALarşivi/replika/failoverkurulumu görünmüyor; başkaoperatorhizmetiyok demiyorum. Aynıhostdiskfelaketinekarşı buscripttekbaşına yeterliayrıarızaalanıdeğil. [Backup](/home/yildirim/Desktop/Coding/MyProjects/blindspace/deploy/backup.sh:23), [günlük cron](/home/yildirim/Desktop/Coding/MyProjects/blindspace/docs/deployment.md:858)
- PostgreSQLbasebackup+WALarşivibelliandan geri dönüşü destekler. Streamingreplicationdefaultasync; primarycommitile standbygörünürlüğü arasında gecikmevefailover'dakaybolabileceksonişlemler olabilir. Synccommitkalıcılığıgüçlendirirken RTT/kilitbeklemeekler; bu bir performans/erişilebilirlikseçimidir. [PITR](https://www.postgresql.org/docs/16/continuous-archiving.html), [replikasyon](https://www.postgresql.org/docs/16/warm-standby.html)
- PgBouncertransactionpoolingLISTENdesteklemez;sessionpoolingdestekler. NOTIFYtransactionpoolingileuyumludur. Bu projede dedicatedLISTENsocket'in aynıtransactionpoolendpoint'ine taşınması uygun değil; doğrudanPGveyaayrısessionpoolURLgerekir. [Resmi özellik matrisi](https://www.pgbouncer.org/features.html)

### Inferences

- **Aşama1/1.000aktif:**3API+1workerrollerinikoruyarak öncegereksizGET/queryzincirlerini veperdeliveryDBkontrolçarpanınıazalt; snapshot+yetkilisürümlüdeltalar, darabonelik, yenidenbağlanmasenkronizasyonukurgula. DBcommit+aynıtransactionoutboxileRedisreadmodeli/bildirimigüncelle. PostgreSQLauthoritativekalsın; cacheyenidenkurulabilirolsun. GüçlüyerelLRU'yu tamamenRedisroundtrip'inedönüştürmekyerine pahalıortakgörünümlerdeL1/L2ilişkisini ölç. Yetki/yerleşim/banfence'lerikorumadan cacheyapma. Kaynakdayanağıcurrenttopology+LISTEN/placementfence; detayişlemgüvenliğinidiğeraraştırmaveriyor.
- **1.000içinaltyapı:**ölçümdetıkanıklıkCPU/DBIOisesıcakDB'yiayrıhostaayırmak,API/workerCPUyarışınıazaltmakvePG'yeayrıRAM/IOPSvermekmakulilkizolasyondur. Failoverveuygunlukgerekiyorsaenaz2applicationfailurealanı,ayrıDBprimary/standby,offhostyedek+PITRönerilir. Bunlar donanımtaahhüdü değil, ölçülecektopolojiseçenekleri. EnazikiAPIhostolması kullanıcılargirerken tekAPIhostbakımınıtolereeder; tekNginx/DBkalırsa bütünüHAolmaz.
- **Aşama2/5.000toplam:**ürünpolitikasıizinveriyorsa5veya dahaçokgalaksiyedağıtılmışoyuncular;APIpool'larıyataybüyür,galaksibaşınadüzenliworkerownership/lease/fencing, housekeeping'inteksahibi,ayrırealtimegatewaypool'larıkurulur. Önemliöneri:arbitrarysayodaworkerbaşlatmakyerine işbölümünügarantiyealmak. TekPGprimaryiylebaşlayıpDBCPU/IO/lockbeklemegerçeklimitolduğundagalaksiDBsharding'inedeğerlendirmekdahasadeyol. Hesap/klan/crossgalaxytransferinDBsınırınıgeçmesini ayrıca tasarlamakgerekir.
- **5.000tekgalaksi:**5×1000'denaynıkapasitebeklenemez. Birortakolayın5000abonesi,tümgörünürlükhesapları,anıt/hedefyoğunlaşmasıveküreselsıralama birgalaksinin sıcakalanındabirikiyor. SadeceSERVERScapacity5000yapmakkabuldeğildir; görünürlük/abonelikalanları,spatialindex/LOD,aynıstateüzerindekiişlemsırasıvenetworkbütçesiyenidenölçülmeli. Buaynızamandaproduct/galaxydesignkararıdır.
- **Poolbütçesi:**yeniAPIbaşınaençok11DBbağlantısını(8gameplay+2placement+1LISTEN)planlamakkabaüstmodel;10API110+workerbağlantıtoplamı100sınırınıaşabilir. İstekbaşıdahaazsorgu+boundedinflight+ayrıkhavuzbudgeti+gerekiyorsaPgBouncerkullanmadan saltPGmax_connectionsartışınıperformansçözümügörme. Standbyread'ihemenkomutsonrasıread'yönlendirmekstaleekranıyenidenyaratabilir; gameplayread-your-writesrevision/LSNfenceveyaprimaryroutinggerektirir. Replicaöncegeçmiş/analitikokumalardaanlamlıdır.
- RPO/RTOve`başarılı`cevabınınkalıcılıkseviyesi ayrıca belirlenmeli. Tekhostgünlükdump,hatasızkalıcıackvelimitlidevamlılıkhedeflerininhepsiniaynıandasağlamaz. Redis'easenkronDBwrite-behind,crashpenceresiniyoketmez;dayanıklılog/yenidenişlemetasarımlarınınmaliyetibütçelenmelidir.

### Gaps

- İstek/oyuncu-dk,galaksibaşınabildirim/s,komuttürdağılımı,readmodelbyte,DBcommitlatencyveworkerCPUbilinmedenCPU/RAMsatınalmaölçüsüverilmez. Kesin5000donanımveya`Redis10kat`iddiası yok.
- Mevcutoperatörortamındarepo-dışıoffsiteyedek/replikasyon/alertingkuruluolupolmadığıdoğrulanmadı.

## Hangi dosyalar hangi sırada değişmeli ve başarı nasıl ölçülmeli?

### Takeaway

P0 kapasitekanıtınıgeçerlihalegetirmek;P1 canlıakışın işçoğaltmasınıkaldırmakveişlemsınırınıgüvenceyealmak;P2ölçülmüşdarboğazagöre node/DB/gatewayayırmak. ÖnerilentestlergerçekoynanişakışlarıylaAPIyüküdür,ekonomi/seasonbalanceuzunsimülasyonudeğildir.

### Cited Findings

- Mevcutharnesskapıları reads p95≤250/p99≤500ms,mutationp95≤400/p99≤800ms,commit→gözlenebilirlikp95≤1000/p99≤2000ms,workerlatencyp95≤1000/p99≤2000ms kullanıyor. Hostp95CPU≤70/max≤85%,eventloopp95≤50/p99≤100ms,poolacquirep95≤25ms ve0acquireerror,0unexpectedssefailure,0slowstreamclose,DBreconcilegibi genişkapılarvar. Bunlar bugünküoyununbunusağladığınındelilideğil,runner'ınhedefleridir. [Latencykapıları](/home/yildirim/Desktop/Coding/MyProjects/blindspace/tools/capacity.mjs:1395), [headroom/worker](/home/yildirim/Desktop/Coding/MyProjects/blindspace/tools/capacity.mjs:1464)
- `host-capacity-preflight.sh` veharness`processTopology`/`releaseIdentity`dağıtımıtam3API+1workerve4image'ıkabuleder.2APIhostvegateway/workershardekleneceğizamangate'lerbilinçliyenidenmodellenmelidir;eskinumerikassert'lerisilerekgeçermekabuldeğildir. [Topologygate](/home/yildirim/Desktop/Coding/MyProjects/blindspace/tools/capacity.mjs:1459), [identitygate](/home/yildirim/Desktop/Coding/MyProjects/blindspace/tools/capacity.mjs:1495)

### Inferences

- **P0/yüksek:**`tools/capacity.mjs`, `tools/capacity-client.mjs`, `apps/server/src/cli/capacity.ts`, `docker-compose.capacity.yml`, `deploy/capacity.sh`, `deploy/host-capacity-preflight.sh`:300/600/750hardcodes,fixturetopolojisi,routerefreshparitesi,semantikgözlemveölçümçıktısınıgüncelle;aynıHEAD/imaj/env/fixtureeşliğiylekontrollükademeyükü. Önce100/300/600/1000, sonra5kçokgalaksi. Loadgeneratörayrımakinede;gerçekNginxTLS/HTTP2vehedefağgecikmesideölçülür.
- **P1/yüksek:**`routes/session.ts`, `stream/bus.ts`, `services/projections.ts`, `session/useEventStream.ts`, `session/shardEvents.ts`, `api/refreshQueries.ts`, `api/planetCache.ts`:tekönsnapshot+yetkilidelta+revision/cursor+gapresync,boundedqueue,revocation/placementfence'iherevent×clientSQLyapmadantaşımatasarımı. Galaksilerarasıcacheclear/audiencescopedebilmedenişbölmekizolasyonusağlamaz. Bu exactyolaraokumaaraştırmasıdahafazlakanıtsağlıyor.
- **P1/yüksek:**`services/placementGate.ts`, `app.ts`, `services/nativeSessions.ts`, `routes/auth.ts`:doğrulama/leasezamanınıayrıölçveinatçıbaşlangıçkuyruğunuazalt. Leaseyasaklarınıkaldırmayadayetkiyi30snTTL'yebırakmayadeğil,sürümvewriterfenceilekorunanminimumkontrollereodaklan. TekkişininyüksekGETsiklusu300/dklimitineçarpıyorsailkontrolnedenfetchüretildiğidir.
- **P1/yüksek:**`services/planetView.ts`, `services/planet.ts`, `routes/planet.ts`, `intel.ts`, `researchState.ts`, `sensorHistory.ts`, `traffic.ts`:ortakcontext/batchveprivategörünümreadmodeli,maliyetlifonksiyonprofili. `worker/loop.ts`, `worker/queue.ts`,handler'larişbölümü/sırakorumaarayüzleri;işlemaraştırmasıdetaylandırıyor.
- **P2/orta:**`docker-compose.prod.yml`, `deploy/nginx/astera.conf`, `apps/server/src/db/client.ts`,busURLconfig,healthmetrics:gameplay/realtimeupstream'leriniayırmayıölç,DBhavuzlarınırollergerçeğinegörebütçele,PgBouncerileLISTEN'iyayır,CPU/RSS/FD/queue/poolalert'lerinioperasyonelhalegetir.
- **P2/orta:**`deploy/backup.sh`,backupretention,deploymentconfig:offhostbackup+PITRvegeri yükleme/failoverprovasi;aynıfailurealanınıpaylaşanAPIkopyalarınıgerçeknodeizolasyonunataşı. Tarihselrapor/bildirim/eventtablolarındaretention,index/vacuumplanı;yetkilieskiitfaiyegörevsüzarkaplanarşivlemeöncetestle.
- **P3/düşük/koşullu:**DBsharding,Kubernetes,RedisCluster,küreselbiractorframework. Ölçülmüşbirlimitgerektirmedenbunlar1000kişiiçinönkoşuldeğil. 5000toplamgalaksiyiölçeklemektasarımlasınırlandığındaöncebasitnodeayrımıvepartitionedworkerşeklindebüyüyebilir.
- **Kabulönerisi:**Mevcutlatency/headroomkapılarıbaşlangıçSLOadayıolarakkorunabilir;resmioyunzamanı/önceliklerini değiştirmez. Ayrıölçümler:komutkabul→commit,planlananETA→gerçekresolve,commit→yetkiliistemcigörünümü,ekrandaframeinterval. MevcutharnessintopluGETp95'iyavaşplanetsroute'unugizlememesi içinkritikroutebaşına örnekvep95/p99gerektir.
- **Temsilcifixture:**kullanıcıbaşına1ve4dünya,çeşitliaraştırma/klan/anıt/sensörgeçmişi,radyasyon+hasarlıkohortlar,uzunbildirim/savaşraporu,eventhistoryvekarışıkaktifgörevler. Fixtureminimum/maksimumlarıgerçekoyunverisindenkişisiztüretilmeli;yalnıztemiz8.seviyeDARTtarlasıylasertifikaolmamalı.
- **Burstkabulü:**50/100/200saldırganaynızamandabirkaçhedefe saldırırkenhedeflerkaçış/transfer/repairvb,yandaölümyıldızı/radbomba/ortakfilolar;aynıhedefveyayılmışhedefayrıyükler. TekDARTlaunchsayısınınartışınınaksinegerçekcombatresolutionveçatışanstateişlemlerininsonuçlarıdoğrulanmalı.
- **Hata/kopuşkabulü:**%10,%50,%100SSEyenidenbağlanma,tokenexpiry/refresh,ortakNAT,placementtransfer,authrevocation;APIrestart,workerclaim/handler/commitarasındakill;Redisgeçicikesinti;DBulaşılamamasıveiyileşme;uzunbekleyenkuyrukdrenajı. Hepsindeizin/visibilitygizliliği,negatifbakiyeyok,çiftgemi/loot/notificationyok,kayıpgörevyok,eskiowner'aeventyok,aynıkomutretry'sindeteksonuçinvariant'ı.
- **Süre:**kısafonksiyonelyükçalışmasıylabaşla;ardındansabitHEAD'de1saatve/veyadaha uzunsoak RAM/queue/PGtablobüyümesinideölçer. Bunlarbuincelemedeyapılmadı;repoownerkuralınauygunolarakuzuntestayrıcaaçıkistekleçalıştırılır. Ekonomi/seasonbalancesimülasyonuyürütülmez.

### Gaps

- BugünbuöneriSLO'larınhiçbirine1000/5000eşzamanlıaktifoyuncualtındayeniölçümalınmadı. Buaraştırmakapasitesertifikasıdeğil,hangiiddialarıhangideneylesınayacağımızınkanıtlıtaslağıdır.
