# Astera Mimari dosyası envanteri

Kaynak: /home/yildirim/Desktop/Astera-Mimari.html. 345 gömülü kaynak, 341 birebir aynı. Karşılaştırma anı: 27 Ekim 2026; üretim eşitliği iddiası yok.


## Genel topoloji

Çalışan süreçlerin görevleri ve depodaki production bağlantı tanımı. Portlar ve sayılar yapılandırma varsayılanlarıdır.

- **web Web istemcisi**: React 19 + TypeScript | Vite 6 / statik uygulama | DOM arayüz + Three.js sahne; referanslar: [{"file": "apps/web/src/main.tsx", "line": 1}, {"file": "apps/web/src/App.tsx", "line": 1}]
- **mobile Android istemcisi**: Capacitor 8 / aynı React kodu | Oyun trafiği: fetch + Bearer | Oturum: Java / OkHttp; referanslar: [{"file": "apps/web/src/platform/authTransport.ts", "line": 1}, {"file": "apps/web/src/api/client.ts", "line": 396}]
- **proxy Nginx / HTTPS**: least_conn → 3 API | Statik dosyalar: /var/www/astera | /arena/* → 127.0.0.1:3220; referanslar: [{"file": "deploy/nginx/astera.conf", "line": 44}, {"file": "deploy/nginx/astera.conf", "line": 212}]
- **api API × 3**: Host 3200 / 3201 / 3202 | Container portu: 3200 | Fastify / REST / SSE / SQL; referanslar: [{"file": "docker-compose.prod.yml", "line": 186}, {"file": "apps/server/src/app.ts", "line": 156}, {"file": "apps/server/src/index.ts", "line": 62}]
- **worker Worker × 1**: Host / container: 3210 | scheduled_events tüketir | Bot / bakım / MailQueue; referanslar: [{"file": "apps/server/src/index.ts", "line": 36}, {"file": "apps/server/src/worker/loop.ts", "line": 276}, {"file": "docker-compose.prod.yml", "line": 204}]
- **arena Arena × 1**: Host / container: 3220 | ws / /arena/ws | Ayrı gerçek zamanlı oda; referanslar: [{"file": "apps/server/src/arena/server.ts", "line": 65}, {"file": "docker-compose.prod.yml", "line": 249}]
- **valkey Valkey 9.1.1**: Redis protokolü / ioredis | Container içi: 6379 / DB 0 | Ortak rate-limit sayaçları; referanslar: [{"file": "apps/server/src/services/rateLimitBackend.ts", "line": 1}, {"file": "docker-compose.prod.yml", "line": 159}]
- **pg PostgreSQL 16**: Container 5432 / host 5545 | Kalıcı veri + görev kuyruğu | astera_events: LISTEN/NOTIFY; referanslar: [{"file": "apps/server/src/db/client.ts", "line": 13}, {"file": "apps/server/src/stream/bus.ts", "line": 8}, {"file": "docker-compose.prod.yml", "line": 134}]
- **disk Ortak chat medya volume’u**: astera_chat_media | 3 API mount: /data/chat-media | Worker mount eksik → inceleme notu; referanslar: [{"file": "docker-compose.prod.yml", "line": 18}, {"file": "docker-compose.prod.yml", "line": 204}, {"file": "apps/server/src/services/mediaErasure.ts", "line": 1}]

Bağlantılar:

- web → proxy: HTTPS
- mobile → proxy: HTTPS
- proxy → api: REST + SSE
- proxy → arena: WebSocket
- api → valkey: Sayaçlar
- api → pg: SQL + ayrı LISTEN
- worker → pg: SQL + NOTIFY
- arena → pg: Kimlik okuması
- api → disk: Medya dosyaları

Bulgular: ["Nginx host üzerinde çalışır; API, worker, arena, PostgreSQL ve Valkey Compose servisleridir.", "Çift yönlü protokollerde oklar bağlantı/istek başlatan tarafı gösterir. SSE’nin sunucudan istemciye dönüşü ayrı görünümde çizilmiştir.", "Harici ödemeler: Paddle / Polar / Shopier → API ve webhook uçları. E-posta: worker → Resend. Özellik bayraklarına bağlıdır.", "Operasyon uçları /health ve /metrics; Nginx üzerinden yalnız loopback erişimine açık. Arena referansları ayrı salt okunur mount’tur. Canlı sunucu durumu bu dosyadan ölçülmez."]

Tablo: []

## Backend ve worker

HTTP isteğinin sınırları, transaction katmanı ve PostgreSQL görev kuyruğu.

- **req HTTP isteği**: Authorization / x-placement | JSON / idempotency-key | x-astera-build (native); referanslar: [{"file": "apps/web/src/api/client.ts", "line": 393}]
- **fastify Fastify eklentileri**: Cookie / native CORS | Native minimum build kontrolü | Global / route rate limit; referanslar: [{"file": "apps/server/src/app.ts", "line": 266}, {"file": "apps/server/src/app.ts", "line": 318}]
- **auth Kimlik ve yerleşim**: JWT + güncel authVersion | requireAuth + Presence | Placement gate / ayrı pool; referanslar: [{"file": "apps/server/src/routes/auth.ts", "line": 194}, {"file": "apps/server/src/services/placementGate.ts", "line": 60}]
- **routes Route sınırı**: Zod: body / params / query | Sahiplik / izin kontrolü | Domain servislerine çağrı; referanslar: [{"file": "apps/server/src/routes/planet.ts", "line": 455}, {"file": "apps/server/src/routes/galaxy.ts", "line": 385}]
- **read Okuma yolu**: Projections / snapshot | Oyuncuya özel görüş filtresi | JSON görünümü oluşturma; referanslar: [{"file": "apps/server/src/services/projections.ts", "line": 165}, {"file": "apps/server/src/routes/galaxy.ts", "line": 385}]
- **tx Yazma yolu**: db.transaction → domain servisi | Sezon / sıralı dünya kilitleri | Kaynak + gemi + görev güncelleme; referanslar: [{"file": "apps/server/src/db/client.ts", "line": 32}, {"file": "apps/server/src/services/mission.ts", "line": 160}, {"file": "apps/server/src/services/ownership.ts", "line": 98}]
- **pg PostgreSQL**: Kalıcı durum + scheduled_events | Transaction finalizer → COMMIT | Commit sonrası NOTIFY; referanslar: [{"file": "apps/server/src/db/finalizers.ts", "line": 1}, {"file": "apps/server/src/worker/queue.ts", "line": 137}, {"file": "apps/server/src/stream/bus.ts", "line": 592}]
- **answer HTTP cevabı**: Zod şemalı istemci okuması | x-server-time / x-placement | GameError / 400 / 500 biçimi; referanslar: [{"file": "apps/server/src/app.ts", "line": 373}, {"file": "apps/server/src/app.ts", "line": 403}, {"file": "apps/web/src/api/client.ts", "line": 466}]
- **claim Worker claimDue**: Varsayılan poll: 1 saniye | Batch: 100 / SKIP LOCKED | processing + attempts++; referanslar: [{"file": "apps/server/src/worker/queue.ts", "line": 26}, {"file": "apps/server/src/env.ts", "line": 229}]
- **handle HANDLERS → çözüm**: 43 kayıtlı olay işleyicisi | Domain transaction / @astera/rules | Bildirim / dönüş görevi / rapor; referanslar: [{"file": "apps/server/src/worker/handlers.ts", "line": 3109}, {"file": "apps/server/src/worker/loop.ts", "line": 281}]
- **retry Tamamlama ve onarım**: Başarılı → done | Hata → pending / 5 deneme | Stale processing → reap; referanslar: [{"file": "apps/server/src/worker/queue.ts", "line": 85}, {"file": "apps/server/src/worker/queue.ts", "line": 97}, {"file": "apps/server/src/worker/queue.ts", "line": 127}]
- **maint Bakım döngüleri**: Stranded uçuş: 30 s | Spawn gate: 15 s / sinyal: 60 s | Bot / Silent Space / medya temizliği; referanslar: [{"file": "apps/server/src/worker/loop.ts", "line": 211}, {"file": "apps/server/src/worker/loop.ts", "line": 349}]

Bağlantılar:

- req → fastify: İstek
- fastify → auth: Kontrol
- auth → routes: Handler
- routes → read: GET / görünüm
- read → answer: Cevap
- routes → tx: Mutasyon
- tx → pg: SQL
- pg → claim: Due görevler
- claim → handle: Sıralı batch
- handle → retry: Sonuç
- retry → maint: Aynı süreç
- read → pg: Cache miss

Bulgular: ["Placement gate salt okuma listesindeki uçlarda önce/sonra placement_version kontrolü yapar; diğer kimliği doğrulanmış route’larda ayrı bağlantıda galaksi kilidi tutar. SSE’nin kendi kontrol yolu vardır.", "Oyun sonuçları saf @astera/rules fonksiyonlarıyla sunucuda hesaplanır. Kurallar paketinin runtime bağımlılığı yoktur.", "Zamanlanmış iş kuyruğu PostgreSQL scheduled_events tablosudur. Redis tabanlı bir iş kuyruğu bu akışta kullanılmaz.", "Production API başına ana SQL pool tavanı 8, placement pool tavanı 2, EventBus için ayrı bağlantı tavanı 1. Worker ana pool tavanı 12; arena ana pool tavanı 2. Bunlar açık bağlantı sayısı değil, ayarlanabilir üst sınırlardır.", "Geliştirmede ROLE varsayılanı both: API ve worker aynı süreçte başlatılabilir. Production Compose rolleri ayrı servisler olarak tanımlar."]

Tablo: []

## Backend modülleri

API domain sınırları ve kaynak dosyaları. Her grup route kayıtları ve gerçek servis importlarından doğrulandı.

- **identity Hesap ve güvenlik**: auth / nativeAuth / accountSecurity | account / nativeSessions / tokens | Silme / topluluk politikası; referanslar: [{"file": "apps/server/src/routes/auth.ts", "line": 1}, {"file": "apps/server/src/routes/nativeAuth.ts", "line": 1}, {"file": "apps/server/src/services/accountSecurity.ts", "line": 1}, {"file": "apps/server/src/services/accountDeletion.ts", "line": 1}]
- **world Gezegen ve ekonomi**: planet / build / research | ownership / planetView / economy | Onarım / bakım / fault / vacation; referanslar: [{"file": "apps/server/src/routes/planet.ts", "line": 1}, {"file": "apps/server/src/services/planet.ts", "line": 1}, {"file": "apps/server/src/services/build.ts", "line": 1}, {"file": "apps/server/src/services/research.ts", "line": 1}]
- **intel Galaksi ve istihbarat**: galaxy / intel / traffic | publicGalaxy / sensorHistory | projection + oyuncuya özel görüş; referanslar: [{"file": "apps/server/src/routes/galaxy.ts", "line": 1}, {"file": "apps/server/src/services/traffic.ts", "line": 1}, {"file": "apps/server/src/services/intel.ts", "line": 1}]
- **missions Filo ve seferler**: mission / movement / mining | pirateRaid / trade / convoy | pending / session / reports; referanslar: [{"file": "apps/server/src/services/mission.ts", "line": 1}, {"file": "apps/server/src/services/movement.ts", "line": 1}, {"file": "apps/server/src/services/mining.ts", "line": 1}, {"file": "apps/server/src/services/pirateRaid.ts", "line": 1}, {"file": "apps/server/src/routes/session.ts", "line": 1}]
- **clan Klan sistemleri**: clan / clanAid / clanSupport | clanWar / treasury / memberships | Ortak operasyonlar / klan chat; referanslar: [{"file": "apps/server/src/routes/clan.ts", "line": 1}, {"file": "apps/server/src/services/clanWar.ts", "line": 1}, {"file": "apps/server/src/services/clanSupport.ts", "line": 1}, {"file": "apps/server/src/services/clanAid.ts", "line": 1}]
- **events Stratejik ve galaksi olayları**: monument / strategic / radiation | unknownSignal / galaxyEvents | season / spawnGate / honor; referanslar: [{"file": "apps/server/src/services/monument.ts", "line": 1}, {"file": "apps/server/src/services/strategic.ts", "line": 1}, {"file": "apps/server/src/services/radiationBomb.ts", "line": 1}, {"file": "apps/server/src/services/unknownSignal.ts", "line": 1}, {"file": "apps/server/src/services/season.ts", "line": 1}]
- **social Sosyal ve yönetim**: chat / dm / chatMedia | community / contentReports | admin / announcements / feedback; referanslar: [{"file": "apps/server/src/routes/chat.ts", "line": 1}, {"file": "apps/server/src/routes/dm.ts", "line": 1}, {"file": "apps/server/src/routes/chatMedia.ts", "line": 1}, {"file": "apps/server/src/routes/admin.ts", "line": 1}, {"file": "apps/server/src/routes/community.ts", "line": 1}]
- **commerce Kozmetik ve satın alma**: cosmetics / entitlement | Paddle / Polar / Shopier | Webhook dedup / siparişler; referanslar: [{"file": "apps/server/src/routes/cosmetics.ts", "line": 1}, {"file": "apps/server/src/routes/paddle.ts", "line": 1}, {"file": "apps/server/src/routes/polar.ts", "line": 1}, {"file": "apps/server/src/routes/shopier.ts", "line": 1}]
- **shared Paylaşılan altyapı**: DB transaction / @astera/rules | scheduled_events / notifications | Projections / EventBus / Presence; referanslar: [{"file": "apps/server/src/app.ts", "line": 156}, {"file": "apps/server/src/services/projections.ts", "line": 1}, {"file": "apps/server/src/stream/bus.ts", "line": 1}, {"file": "apps/server/src/services/presence.ts", "line": 1}]

Bağlantılar:

- world → shared: SQL / görev / olay
- intel → shared: Projection / SQL
- missions → shared: SQL / görev / olay
- clan → shared: SQL / görev / olay
- events → shared: SQL / görev / olay
- identity → shared: SQL / auth altyapısı
- social → shared: SQL / kişisel olay
- commerce → shared: SQL / hak tanıma

Bulgular: ["Bu görünüm domain bağımlılıklarını gruplar. Servis içindeki çağrı sırası ve transaction sınırı için Backend ve worker / Filo yaşam döngüsü görünümleri kullanılmalıdır.", "Kod envanteri, 196 servis dosyasının export ve schema import listesini içerir. Bir servis kaydına tıklayarak kaynak kodunu görebilirsin.", "Arena bu domain HTTP route’larından ayrı role sahiptir. Sadece arena uçlarını kaydeder ve ayrı bellek içi world döngüsü çalıştırır."]

Tablo: []

## Frontend

React oturumu, query önbelleği, fetch katmanı ve 3D sahnenin veri akışı.

- **boot main.tsx → App**: i18n / ErrorBoundary / LazyMotion | QueryClientProvider / ApiProvider | useSession / lazy ekranlar; referanslar: [{"file": "apps/web/src/main.tsx", "line": 107}, {"file": "apps/web/src/App.tsx", "line": 65}]
- **session Oturum ve dünya seçimi**: restore → /auth/me | starting / landing / servers / ready | WorldProvider → aktif gezegen; referanslar: [{"file": "apps/web/src/session/useSession.ts", "line": 176}, {"file": "apps/web/src/api/world.tsx", "line": 50}]
- **ui GameShell + GalaxyView**: DOM paneller / HUD / sayfalar | useGalaxy / pending / mining | traffic / intel / reports; referanslar: [{"file": "apps/web/src/App.tsx", "line": 224}, {"file": "apps/web/src/screens/GalaxyView.tsx", "line": 392}]
- **queries TanStack Query**: Query / Mutation hook’ları | Date uyumlu structural sharing | refreshQueries: çakışan okuma kuyruğu; referanslar: [{"file": "apps/web/src/api/queryClient.ts", "line": 1}, {"file": "apps/web/src/api/refreshQueries.ts", "line": 1}, {"file": "apps/web/src/api/queries.ts", "line": 2472}]
- **api Api.send / Api.stream**: fetch + Bearer + x-placement | 401 → tek refresh uçuşu → retry | JSON → Zod / SSE → frame parser; referanslar: [{"file": "apps/web/src/api/client.ts", "line": 373}, {"file": "apps/web/src/api/client.ts", "line": 480}, {"file": "apps/web/src/api/client.ts", "line": 1426}]
- **server Backend**: REST /api/* | SSE GET /api/stream | x-server-time ile saat düzeltmesi; referanslar: [{"file": "apps/server/src/routes/session.ts", "line": 183}, {"file": "apps/web/src/lib/clock.ts", "line": 65}]
- **native Native auth köprüsü**: Yalnız login / register / claim | refresh / logout → Java / OkHttp | Refresh token → Android Keystore; referanslar: [{"file": "apps/web/src/platform/authTransport.ts", "line": 5}]
- **live Canlı yenileme tetikleri**: useEventStream / shardEvents | Varış / temas sınırı zamanlayıcıları | Ağ / uygulama dönüşü + polling; referanslar: [{"file": "apps/web/src/session/useEventStream.ts", "line": 128}, {"file": "apps/web/src/session/useArrivals.ts", "line": 49}, {"file": "apps/web/src/api/queries.ts", "line": 1528}]
- **scene GalaxyCanvas / R3F**: Fleets / MiningFlights / katmanlar | Three.js / demand frameloop | Saat + rota → useFrame konumu; referanslar: [{"file": "apps/web/src/galaxy/GalaxyCanvas.tsx", "line": 628}, {"file": "apps/web/src/galaxy/Fleets.tsx", "line": 928}, {"file": "apps/web/src/galaxy/scene.ts", "line": 407}]
- **clock Ortak görsel saat**: serverNow = Date.now + offset | HTTP başlıklarından RTT tahmini | Ayrı konum yayını gerekmez; referanslar: [{"file": "apps/web/src/lib/clock.ts", "line": 65}, {"file": "apps/web/src/lib/clock.ts", "line": 96}]
- **assets Görseller ve ses**: GLB / dokular / efektler | Statik HTTP dosyaları | Ayrı arena istemcisi: network.ts; referanslar: [{"file": "apps/web/src/galaxy/GalaxyCanvas.tsx", "line": 1}, {"file": "apps/web/src/arena/network.ts", "line": 113}]

Bağlantılar:

- boot → session: Mount
- session → ui: ready
- ui → queries: Hook / komut
- queries → api: İstek
- api → server: HTTP
- api → native: Oturum işlemleri
- live → queries: Invalidate / refetch
- queries → scene: Güncel props
- clock → scene: Zaman
- assets → scene: Statik varlıklar
- api → clock: noteServerTime

Bulgular: ["Her gemi hareketi için React state veya HTTP isteği üretilmez. Sahne, verilen leg zamanlarından frame konumunu çıkarır.", "useLaunch cevaptaki planet ve pending verisini cache’e doğrudan yazar; kendi filosu ek bir pending GET beklemeden çizilebilir.", "QueryClient varsayılanı retry: 1, refetchOnReconnect: true, refetchOnWindowFocus: false. SSE lifecycle dönüşleri kendi toplu yenilemesini yapar.", "Web refresh oturumu HttpOnly cookie’dedir; access token Api sınıfının belleğindedir. Native oturum credential’ı Keystore/AES-GCM ile saklanır."]

Tablo: [["Trafik", "5 s", "TRAFFIC.refreshMs; radar alanına dışarıdan giren yeni temasları da keşfeder."], ["Galaksi / pending / mining", "60 s", "SSE ve zamanlayıcılara ek düzenli yenileme."], ["Sunucu listesi / kozmetik", "20 s / 30 s", "Kendi query tanımlarındaki interval."], ["Duyuru", "5 dakika", "Global olay kaybına karşı fallback."], ["Varış takibi", "+400 ms, sonra 900 ms", "useArrivals: son sınır sonrası en çok 12 takip denemesi."]]

## SSE olay akışı

Commit edilen olayın API kopyalarına, açık HTTP stream’lerine ve ilgili query’lere ulaşması.

- **mutation API servisi veya worker**: Oyun değişikliği transaction’da | notify / publishShard / publish | Kişisel veya galaksi olayı; referanslar: [{"file": "apps/server/src/services/notifications.ts", "line": 32}, {"file": "apps/server/src/services/mission.ts", "line": 558}]
- **notify PostgreSQL COMMIT**: pg_notify(astera_events, JSON) | Rollback → olay teslim edilmez | Kalıcı event backlog bulunmaz; referanslar: [{"file": "apps/server/src/stream/bus.ts", "line": 592}, {"file": "apps/server/src/stream/bus.ts", "line": 646}]
- **listener Her API’nin EventBus’ı**: Ayrı reserve bağlantısı / max: 1 | LISTEN astera_events | JSON → Zod → dispatch; referanslar: [{"file": "apps/server/src/stream/bus.ts", "line": 434}, {"file": "apps/server/src/stream/bus.ts", "line": 534}, {"file": "apps/server/src/stream/bus.ts", "line": 253}]
- **cache Önce yerel invalidation**: bus.observe → Projections.onEvent | Olayın etkilediği cache silinir | Sonra stream aboneleri çalışır; referanslar: [{"file": "apps/server/src/stream/bus.ts", "line": 280}, {"file": "apps/server/src/services/projections.ts", "line": 298}]
- **topics Topic abonelikleri**: p:playerId / kişisel | s:seasonId / galaksi | global / tüm hesaplar; referanslar: [{"file": "apps/server/src/stream/bus.ts", "line": 304}, {"file": "apps/server/src/routes/session.ts", "line": 261}]
- **stream GET /api/stream**: requireAuth + yerleşim kontrolü | Her frame öncesi DB doğrulaması | text/event-stream / heartbeat; referanslar: [{"file": "apps/server/src/routes/session.ts", "line": 183}, {"file": "apps/server/src/routes/session.ts", "line": 229}]
- **browser Api.stream → refresh(kind)**: fetch / ReadableStream / Bearer | SSE frame satırları ayrıştırılır | useEventStream olay yönlendirir; referanslar: [{"file": "apps/web/src/api/client.ts", "line": 1426}, {"file": "apps/web/src/session/useEventStream.ts", "line": 231}]
- **coalesce Shard olaylarını birleştirme**: Genel shard penceresi: 250 ms | Traffic: 500–750 ms gecikmeli | world / score / clan: 30 s; referanslar: [{"file": "apps/web/src/session/shardEvents.ts", "line": 300}, {"file": "apps/web/src/session/shardEvents.ts", "line": 324}, {"file": "apps/web/src/session/useEventStream.ts", "line": 202}]
- **reads Query yenileme / REST**: launch → traffic | arrival → traffic + miningField | Özel olay → ilgili query kümesi; referanslar: [{"file": "apps/web/src/session/shardEvents.ts", "line": 59}, {"file": "apps/web/src/api/refreshQueries.ts", "line": 24}]
- **recovery Bağlantı geri geldiğinde**: İlk open → hemen resync | Sonraki open → 0–5 s jitter | Uzun saklanma ≥15 s → resync; referanslar: [{"file": "apps/web/src/session/useEventStream.ts", "line": 25}, {"file": "apps/web/src/session/useEventStream.ts", "line": 37}, {"file": "apps/web/src/session/useEventStream.ts", "line": 330}]
- **health EventBus sağlığı**: Kendi NOTIFY heartbeat’i: 1 s | Son heartbeat >3 s → sağlıksız | Kopma → cache clear + reconnect; referanslar: [{"file": "apps/server/src/stream/bus.ts", "line": 120}, {"file": "apps/server/src/stream/bus.ts", "line": 484}, {"file": "apps/server/src/services/projections.ts", "line": 113}]
- **limits Stream sınırları**: Varsayılan 64 KiB buffer sınırı | 25 s SSE ping / DB kontrolü | Close / error / shutdown → cleanup; referanslar: [{"file": "apps/server/src/env.ts", "line": 244}, {"file": "apps/server/src/routes/session.ts", "line": 220}, {"file": "apps/server/src/services/streamRegistry.ts", "line": 17}]

Bağlantılar:

- mutation → notify: publish(tx)
- notify → listener: Commit yayını
- listener → cache: 1. observer
- cache → topics: 2. subscriber
- topics → stream: İlgili istemci
- stream → browser: Nginx / buffering off
- browser → coalesce: shard:*
- coalesce → reads: refreshQueries
- browser → reads: Kişisel / global: doğrudan
- browser → recovery: Kopma / dönüş
- health → cache: Bypass / reset
- stream → limits: Güvenli kapanış

Bulgular: ["Bu kanal oyun state’i değil, yeniden okuma sinyali taşır. Kişisel içerik ve görünür uçuş bilgisi yetkilendirilmiş REST yanıtlarında hesaplanır.", "Olaylarda replay cursor / Last-Event-ID / backlog uygulanmıyor. Bu yüzden tekrar bağlanma, dünyayı yeniden okumayı tetikler.", "PostgreSQL LISTEN kaybolursa cache’ler bypass edilir; reset olduğunda yerel cache temizlenir. Bu mekanizma Redis’e bağlı değildir."]

Tablo: []

## WebSocket arena

Galaksi SSE akışından bağımsız, bellekte çalışan pilot odası ve tahmin / düzeltme döngüsü.

- **door Arena giriş kapısı**: VITE_ARENA + web hedefi | GET /arena/access | ARENA_ENABLED + kabul edilen pilot; referanslar: [{"file": "apps/web/src/arena/flags.ts", "line": 1}, {"file": "apps/server/src/arena/server.ts", "line": 174}]
- **upgrade WebSocket upgrade**: Nginx → 3220 /arena/ws | Origin allowlist | ws maxPayload: 4096 byte; referanslar: [{"file": "deploy/nginx/astera.conf", "line": 212}, {"file": "apps/server/src/arena/server.ts", "line": 180}]
- **hello hello / kimlik**: İlk mesaj için 5 s süre | Access JWT + accounts / arena_pilots | Aynı hesap → önceki socket kapanır; referanslar: [{"file": "apps/server/src/arena/server.ts", "line": 191}, {"file": "apps/server/src/arena/server.ts", "line": 225}]
- **input İstemci kontrolü**: seq + steering / throttle / butonlar | settings / ping / leave | Yerelde predictPilot + history; referanslar: [{"file": "apps/web/src/arena/network.ts", "line": 189}]
- **buffer Server input kuyruğu**: Zod mesaj doğrulaması | seq / input buffer / playout | 60 mesaj/s üstü işlenmez; referanslar: [{"file": "apps/server/src/arena/server.ts", "line": 193}, {"file": "apps/server/src/arena/playout.ts", "line": 1}, {"file": "apps/server/src/arena/server.ts", "line": 282}]
- **world Yetkili server dünyası**: 30 Hz stepArenaWorld | Pilotlar / botlar / mermiler | Cargo / duman / çarpışmalar; referanslar: [{"file": "apps/server/src/arena/server.ts", "line": 123}, {"file": "apps/server/src/arena/server.ts", "line": 155}, {"file": "packages/rules/src/arena/tuning.ts", "line": 3}]
- **render İstemci düzeltmesi**: self: snapshot + ack | Onaylanmamış input’ları tekrar uygula | Diğer pilotlar: interpolation; referanslar: [{"file": "apps/web/src/arena/network.ts", "line": 96}, {"file": "apps/web/src/arena/network.ts", "line": 150}]
- **snap Snapshot / roster yayını**: 15 Hz kişiye özel snapshot | AOI + pilotVisible filtresi | snap / roster / pong / kick; referanslar: [{"file": "apps/server/src/arena/server.ts", "line": 101}, {"file": "apps/server/src/arena/server.ts", "line": 151}]
- **reconnect Link kaybı / yeniden bağlanma**: Client: 1 s aralık / 15 deneme | resume ile mevcut pilotu arar | Server: nötr input / linkLost; referanslar: [{"file": "apps/web/src/arena/network.ts", "line": 139}, {"file": "apps/server/src/arena/server.ts", "line": 284}]

Bağlantılar:

- door → upgrade: Bağlan
- upgrade → hello: hello token
- input → buffer: in paketi
- buffer → world: playInput
- world → snap: Her 2 tick
- snap → render: snap + ack
- render → input: Reconcile / devam
- hello → world: Pilot kaydı
- render → reconnect: close / lost
- reconnect → upgrade: resume

Bulgular: ["Arena sunucusu aynı server imajından ROLE=arena ile başlatılır; API route’larını kaydetmez.", "Snapshot’taki diğer pilotlar mesafe ve görünürlük filtresinden geçer. Kendi pilotu daha kesin değerlerle gönderilir.", "Arena verisi tek oda içinde bellektedir. PostgreSQL erişimi pilot kimliği / yetkisi içindir; Redis Pub/Sub bu yolun parçası değildir."]

Tablo: []

## PostgreSQL

Çekirdek tabloların gerçek foreign key ilişkileri. Alttaki gezginde 131 tablonun tamamı ve bağlantıları bulunur.

- **accounts accounts**: Kalıcı hesap / authVersion | Parola özeti / hesap tercihleri; referanslar: [{"file": "apps/server/src/db/schema.ts", "line": 291}]
- **seasons seasons**: shards + season_cycles bağlantısı | Galaksi / sezon durumu; referanslar: [{"file": "apps/server/src/db/schema.ts", "line": 567}]
- **players players**: account_id / season_id / shard_id | Hesabın güncel komutanı; referanslar: [{"file": "apps/server/src/db/schema.ts", "line": 802}]
- **planets planets**: controller / founder oyuncuları | Kaynak / dünya durumu; referanslar: [{"file": "apps/server/src/db/schema.ts", "line": 1384}]
- **missions missions**: player / origin / target / season | Gidiş / dönüş / görev zamanları; referanslar: [{"file": "apps/server/src/db/schema.ts", "line": 1771}]
- **units units**: planet_id / owner_player_id | Gövde / adet / location; referanslar: [{"file": "apps/server/src/db/schema.ts", "line": 1748}]
- **battles battle_reports**: Görev / oyuncular / gezegen | Savaş sonucu + battle_replays; referanslar: [{"file": "apps/server/src/db/schema.ts", "line": 2621}, {"file": "apps/server/src/db/schema.ts", "line": 4975}]
- **clans clans**: season_id | Klan kimliği / ortak sistemler; referanslar: [{"file": "apps/server/src/db/schema.ts", "line": 943}]
- **members clan_memberships**: clan_id / player_id / season_id | Sezona bağlı klan üyeliği; referanslar: [{"file": "apps/server/src/db/schema.ts", "line": 1001}]
- **queue scheduled_events**: season_id / kind / ref_id | resolve_at / status / attempts; referanslar: [{"file": "apps/server/src/db/schema.ts", "line": 2597}]
- **mining mining_runs**: season / planet / player | debris_field_id isteğe bağlı; referanslar: [{"file": "apps/server/src/db/schema.ts", "line": 4431}]

Bağlantılar:

- players → accounts: FK → hesap
- players → seasons: FK → sezon
- planets → players: FK → oyuncu
- missions → players: FK → oyuncu
- missions → planets: origin / target FK
- units → planets: FK
- battles → missions: FK
- clans → seasons: FK
- members → players: FK
- members → clans: FK
- queue → seasons: FK
- mining → planets: FK

Bulgular: ["Ok yönü child tablo → parent tablo foreign key’idir. Çizim çekirdek ilişkilerin seçkisidir; tüm referanslar tablo gezgininde kaynak kodundan çıkarılır.", "131 pgTable tanımı ve 290 kolon / composite foreign-key hedef referansı çıkarıldı. Aynı tabloya birden fazla kolon referansı ayrı sayılır.", "JSONB alanları payload / filo / rapor gibi yapılandırılmış verileri taşır. Timestamptz, görevlerin ve sezonun zaman sınırlarını saklar.", "Görev ve e-posta kuyruğu PostgreSQL’de; oyun varışları scheduled_events, e-posta teslimatı mail_outbox üzerinden yürür."]

Tablo: []

## Redis ve önbellek

İstemci cache’i, API belleği, ortak rate-limit store ve PostgreSQL güvenlik sayaçları ayrı sistemlerdir.

- **client İstemci QueryClient**: TanStack Query / tek instance | Query key → Date içeren görünüm | SSE / mutation / timer yeniler; referanslar: [{"file": "apps/web/src/api/queryClient.ts", "line": 1}, {"file": "apps/web/src/api/refreshQueries.ts", "line": 1}]
- **api API route / doğrulama**: Kimlikli: account:<id> | Anonim: ip:<normalizeIP> | Route bazlı limit override; referanslar: [{"file": "apps/server/src/app.ts", "line": 318}]
- **redis Ortak Valkey**: RATE_LIMIT_REDIS_URL → ioredis | 3 API aynı sayaçları paylaşır | 64 MB / allkeys-lru / diske yazmaz; referanslar: [{"file": "apps/server/src/services/rateLimitBackend.ts", "line": 1}, {"file": "docker-compose.prod.yml", "line": 159}]
- **public Her API’nin ortak snapshot’ı**: publicGalaxy: season / 30 s | traffic / mining / pirates: 5 s | Her API’de ayrı AsyncCache; referanslar: [{"file": "apps/server/src/services/projections.ts", "line": 113}, {"file": "apps/server/src/env.ts", "line": 237}]
- **private Her API’nin özel cache’i**: commander: accountId | sensors / remembered: playerId | sensorHistory: player + season; referanslar: [{"file": "apps/server/src/services/projections.ts", "line": 186}]
- **async AsyncCache mekanizması**: Map / sınırlı boyut / LRU benzeri | Aynı key: tek yükleme Promise’i | Invalidation sırasında fill → yeniden yükle; referanslar: [{"file": "apps/server/src/services/asyncCache.ts", "line": 45}, {"file": "apps/server/src/services/asyncCache.ts", "line": 96}]
- **bus PostgreSQL EventBus**: Önce projection invalidation | LISTEN sağlıklı değil → bypass | Reset / reconnect → cache clear; referanslar: [{"file": "apps/server/src/services/projections.ts", "line": 132}, {"file": "apps/server/src/services/projections.ts", "line": 298}, {"file": "apps/server/src/stream/bus.ts", "line": 280}]
- **security PostgreSQL güvenlik sayaçları**: security_counters / upsert | Hesap güvenliği / e-posta limitleri | Native session durumu da DB’de; referanslar: [{"file": "apps/server/src/services/mail.ts", "line": 34}, {"file": "apps/server/src/services/nativeSessions.ts", "line": 1}]
- **fallback Limit store hata politikası**: Genel oyun: skipOnError=true | Auth / signup: skipOnError=false | URL yoksa process-local limit store; referanslar: [{"file": "apps/server/src/app.ts", "line": 252}, {"file": "apps/server/src/app.ts", "line": 322}, {"file": "apps/server/src/index.ts", "line": 62}]

Bağlantılar:

- client → api: REST
- api → redis: Rate-limit
- api → private: Oyuncu context’i
- public → private: Görüşü katmanla
- private → async: Cache.get
- bus → public: Invalidate
- bus → private: Invalidate
- api → security: AccountSecurity
- redis → fallback: Hata / eksik URL

Bulgular: ["Redis istemcisi için kaynakta tek kurulum noktası services/rateLimitBackend.ts. Oyun snapshot cache’i, SSE bus’ı ve görev kuyruğu bu Redis istemcisini kullanmaz.", "Genel limit varsayılanı 300 / dakika; login route’u 40 / 10 dakika; signup / koltuk alma bütçesi 18 / saat. Route override’ları ayrıca vardır.", "Web auth/refresh route’u strict auth bütçesini kullanmaz; global bucket’tadır. Rate-limit plugin kimlik anahtarı için JWT ve güncel hesap durumunu doğrular.", "Valkey’de save kapalı, appendonly=no ve volume yoktur. Kalıcı hesap ve oyun verisi PostgreSQL’dedir."]

Tablo: [["shard:launch", "traffic", "İstemci traffic’i 500–750 ms gecikmeli okur."], ["shard:arrival / mining", "traffic + mining", "Olayın etkilediği snapshot silinir."], ["shard:pirate", "traffic + mining + pirates", "Yeni enkaz ve korsan şeridi birlikte güncellenir."], ["world / control / season / rollover", "Topology / özel cache setleri", "publicGalaxy de temizlenir; olay türüne göre diğer snapshot’lar değişir."], ["probe_report / private:memory", "İlgili remembered girdisi", "Oyuncunun keşif hafızası."], ["private:sensors / build_complete", "İlgili sensors / sensorHistory", "Oyuncunun görüş alanı."], ["LISTEN reset", "Tüm projection cache’leri", "Cache’ler sağlıklı bus olmadan kullanılmaz."]]

## Filo yaşam döngüsü

Bir saldırı komutunun kendi ekranına ve diğer oyuncuların galaksisine nasıl yansıdığı.

- **tap Oyuncu gönderir**: useLaunch mutation | POST /api/fleet/launch | origin / target / fleet / pace; referanslar: [{"file": "apps/web/src/api/queries.ts", "line": 2472}, {"file": "apps/web/src/api/client.ts", "line": 1151}]
- **launch launchAttack transaction**: lockWorlds / loadLocked | Yakıt / gemi / PvP kontrolleri | Görev + birlik konumu yazılır; referanslar: [{"file": "apps/server/src/services/mission.ts", "line": 160}, {"file": "apps/server/src/services/mission.ts", "line": 480}]
- **schedule Planla + yayınla**: mission_arrival / radar_warning | publishShard: launch | COMMIT → NOTIFY; referanslar: [{"file": "apps/server/src/services/mission.ts", "line": 493}, {"file": "apps/server/src/services/mission.ts", "line": 539}, {"file": "apps/server/src/services/mission.ts", "line": 558}]
- **owner Gönderenin ekranı**: HTTP cevap: planet + pending | Cache’e doğrudan setQueryData | Kendi gemisi çizilmeye başlar; referanslar: [{"file": "apps/server/src/services/mission.ts", "line": 569}, {"file": "apps/web/src/api/queries.ts", "line": 2496}]
- **motion Uçuşun çizimi**: serverNow / departAt / arriveAt | from → to arasında interpolation | useFrame → grup konumu; referanslar: [{"file": "apps/web/src/galaxy/Fleets.tsx", "line": 928}, {"file": "apps/web/src/galaxy/scene.ts", "line": 407}]
- **witness Diğer oyuncunun ekranı**: SSE shard:launch → traffic GET | Sensör / görüş / sahiplik filtresi | Görülebilen temas çizilir; referanslar: [{"file": "apps/web/src/session/shardEvents.ts", "line": 59}, {"file": "apps/server/src/routes/galaxy.ts", "line": 385}, {"file": "apps/server/src/services/traffic.ts", "line": 1047}]
- **due Sunucu zamanı geldiğinde**: Worker claimDue | onMissionArrival transaction | Savaş / sonuç / dönüş planı; referanslar: [{"file": "apps/server/src/worker/loop.ts", "line": 276}, {"file": "apps/server/src/worker/handlers.ts", "line": 272}]
- **result Kalıcı sonuç ve olay**: battle_reports / notifications | Yeni return leg / scheduled_event | Kişisel olay + shard olayı; referanslar: [{"file": "apps/server/src/worker/handlers.ts", "line": 296}, {"file": "apps/server/src/services/notifications.ts", "line": 32}]
- **refresh İstemciler tekrar okur**: pending / planet / traffic / rapor | Varış zamanlayıcısı ek destek | Dönüş rotası veya bitiş çizilir; referanslar: [{"file": "apps/web/src/session/useEventStream.ts", "line": 231}, {"file": "apps/web/src/session/useArrivals.ts", "line": 49}]

Bağlantılar:

- tap → launch: REST
- launch → schedule: Atomik yazım
- launch → owner: HTTP sonucu
- owner → motion: pending props
- schedule → witness: SSE → REST
- witness → motion: Contact window
- schedule → due: scheduled_events
- due → result: Çözüm
- result → refresh: SSE / timer
- refresh → motion: Güncel leg

Bulgular: ["Gemi uçarken her frame konum paketi gönderilmez; rota ve sunucu zamanına göre yerelde çizilir.", "Başka birinin kalktığını duymak onun tüm verisini görmek anlamına gelmez. traffic endpointi her istemci için görünürlük uygular.", "Varış zamanı ile worker’ın sonucu commit etmesi ayrı anlardır. İstemci varış sonrası kısa takip okuması yapar; sonucu kendisi kararlaştırmaz.", "Saldırı dışında probe / transfer / mining / pirate / trade / convoy / monument yolları kendi servis ve event handler’larıyla aynı temel kalıcılık modelini kullanır."]

Tablo: []

## HTML review kayıtları

[
  {
    "title": "Production worker için chat medya mount’u eksik",
    "level": "Kod / yapılandırma bulgusu",
    "detail": "API servisleri astera_chat_media volume’unu /data/chat-media altında mount ediyor. Worker aynı CHAT_MEDIA_DIR ayarını miras alıyor ve processMediaDeletionQueue çalıştırıyor; worker servisinde volumes tanımı yok. Temizleyici ENOENT’i başarılı kabul edip kuyruk kaydını siliyor. Sonuç: worker gerçek API medya dosyasını görmediğinde, dosya volume’da kalırken iş tamamlanmış sayılabilir. Kaynak kodu ve Compose üzerinden doğrulandı; canlı container mount’ları incelenmedi. Gerçek processMediaDeletionQueue servisi, iki ayrı geçici dizin ve yalnız DB için test double ile izole olarak çalıştırıldı: removed=1 ve kuyruk kaydı silindi; API volume’unu temsil eden dizindeki dosya yerinde kaldı. Bu deney canlı veritabanı veya oyuncu dosyası kullanmadı.",
    "refs": [
      {
        "file": "docker-compose.prod.yml",
        "line": 18
      },
      {
        "file": "docker-compose.prod.yml",
        "line": 204
      },
      {
        "file": "apps/server/src/worker/loop.ts",
        "line": 369
      },
      {
        "file": "apps/server/src/services/mediaErasure.ts",
        "line": 1
      }
    ]
  },
  {
    "title": "SSE heartbeat yorumu uygulamayla uyuşmuyor",
    "level": "Yorum / uygulama farkı",
    "detail": "env.ts SSE heartbeat yorumunda veritabanı okuması yapılmadığı yazıyor. session.ts ping’i enqueue ile iletiyor; enqueue her frame öncesi hesap ve placement kontrolü için PostgreSQL sorgusu yapıyor. Diyagram gerçek davranışı, yani varsayılan 25 saniyelik ping öncesindeki DB kontrolünü gösterir.",
    "refs": [
      {
        "file": "apps/server/src/env.ts",
        "line": 246
      },
      {
        "file": "apps/server/src/routes/session.ts",
        "line": 229
      },
      {
        "file": "apps/server/src/routes/session.ts",
        "line": 267
      }
    ]
  }
]