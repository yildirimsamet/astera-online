# Komutan Gemisi — Ağ, sunucu ve senkronizasyon

> **Durum:** Mimari karar + uygulama rehberi (2026-10-07), koda karşı doğrulandı (HEAD `2fa122f`).
> **Hedef okuyucu:** Arena sunucusunu, soket protokolünü ve istemci ağ katmanını yazacak agent.
> **Dayanak:** S49–S52, S60, S68 ([01](01-urun.md)); KG-T3–T22, KG-T27, KG-T29 ([02](02-kararlar.md)).
> **Önce oku:** `docs/architecture.md`, `docs/engineering-standards.md` (bağlayıcı).

---

## 1. Bugün ne var (doğrulandı)

- Sunucu: Fastify 5, Node 22, `tsx` ile koşar. `apps/server/src/env.ts` → `ROLE: api | worker | both`.
- Prod: 3 durumsuz API replikası (`api1–3`, port 3200–3202) nginx `least_conn` arkasında, **sticky
  yok**; 1 `worker` (3210); Postgres 16; Valkey (yalnız rate-limit sayaçları).
- Gerçek zamanlı: yalnız **SSE** `GET /api/stream` (`routes/session.ts`), yüksüz sinyaller; istemci
  REST'i yeniden çeker. Süreçler arası: Postgres LISTEN/NOTIFY (`stream/bus.ts`, `EventBus`).
- **Hiçbir yerde WebSocket yok:** sunucuda `ws` bağımlılığı yok, Vite proxy `ws: false`
  (`apps/web/vite.config.ts`), nginx'te Upgrade başlığı yok.
- Kimlik: `auth/tokens.ts` `TokenService` (HS256, 15 dk access); `routes/auth.ts` `requireAuth`
  (aktifliği de yazar); `services/placementGate.ts` her `/api/*` handler'ını advisory kilitle sarar.
- Atomik kaynak değişimi `services/planet.ts` `loadLocked`; idempotency `services/idempotency.ts`.
- Saat: `apps/server/src/clock.ts` (`Clock`, `FixedClock`); rules saatsizdir.

<a id="surec-ve-rol"></a>
## 2. Süreç ve rol (KG-T3)

- `env.ts`: `ROLE` enum'una `arena`; `ARENA_ENABLED` (varsayılan `false`), `ARENA_DEV` (dev
  araçları; prod'da asla).
- **`app.ts` rol başına açık route listesine geçer.** Bugün yalnız `ROLE==='worker'`da public
  route kaydı atlanıyor; olduğu gibi bırakılırsa `arena` süreci tüm public API'yi açar. Test:
  `api` ve `both` route kümeleri bugünküyle aynı kalır.
- **`buildApp` yeniden kullanılır** (tek imaj, tek giriş `src/index.ts`; aynı DB havuzu, bus,
  `/health` ve `/metrics`). `app.after` içinde `registerHealthRoutes`'tan sonra `ROLE==='arena'`
  ise yalnız arena soketi kaydedilir ve dönülür. `index.ts`'te `arena` rolü `bus.start()` çağırır
  (yerleşim/sezon olayları, §11) ve odaları başlatır; worker başlamaz. `buildApp`'in her rolde
  kurduğu `placementGate` havuzu (2 bağlantı) ve rate-limit eklentisi zararsızdır; Postgres
  bağlantı bütçesine arena süreci eklenir (F10 preflight). SIGTERM'de `close()` önce arenayı
  boşaltır (§11).
- `routes/health.ts` rol tipi genişler; arena sağlık belgesi oda sayısı, pilot sayısı ve tick
  süresi p95'ini içerir.
- **Dev:** `pnpm dev` üç süreç başlatır: `@astera/server` (`both`, :3100), arena (`ROLE=arena`,
  :3101), web. Bugün kök betik `pnpm --parallel --filter @astera/server --filter @astera/web dev`;
  `apps/server/package.json`'a `dev:arena` (ör. `ROLE=arena PORT=3101 tsx watch src/index.ts`)
  eklenip kök `dev` ve `tools/dev-up.sh` onu da başlatır. `dev-up.sh`'te 3101 port denetimine ve
  süreç listesine eklenir, arena `/health`'i beklenir; betiğin "THREE PROCESSES, NOT FOUR … no
  socket service" açıklaması güncellenir. Vite proxy'ye
  `'/arena': { target: 'http://localhost:3101', ws: true }` eklenir; `/api` `ws: false` kalır (SSE
  tamponlanmasın). API ile arena **yalnız DB + bus** üzerinden konuşur; birbirinin modülünü bellek
  içi çağırmaz.
- **Prod (F10):** tek `arena` konteyneri (port `127.0.0.1:3220`), `stop_grace_period: 30s`.

<a id="uc-nokta"></a>
## 3. Uç nokta ve kimlik (KG-T5, KG-T6)

- Fastify HTTP sunucusunun `upgrade` olayında yol `/arena/ws` ise `ws` (`noServer: true`,
  `perMessageDeflate: false`, `maxPayload: 4096`) devralır.
- **Origin denetimi izin listesiyle** (`ARENA_ALLOWED_ORIGINS`): prod'da oyunun alan adı; dev'de
  `http://localhost:5173` ve `pnpm phone`'un LAN adresi. Vite proxy `changeOrigin` yalnız `Host`'u
  değiştirir, `Origin`'i değil → "Origin = Host" karşılaştırması LAN'da başarısız olur.
- **Neden `/api/` değil:** nginx `location /api/` istekleri API replikalarına dağıtır ve
  `Connection` başlığını siler (upgrade geçmez); soket tek arena sürecine gitmeli. (Ayrıca
  `placementGate` Fastify'a kayıtlı her `/api/*` route'unu 2 bağlantılık kilit havuzundan geçirir.)
- Bağlantı açılınca 5 sn içinde `hello` gelmeli. Sunucu: `TokenService.verify(accessToken, 'access')`
  → `accountId`; ardından güncel `players` satırı (sezon, `placementVersion`, ad; yerleşim
  istemciden alınmaz, sonraki değişiklik §11'deki olayla gelir). Sezon `live` değilse, giriş
  kapalıysa (KG-A16), `ARENA_ENABLED=false` ise veya `ARENA_ADMIN_ONLY=true` iken hesap admin
  değilse (`isAdminAccount`) `kick`.
- **`hello.mode`:** `enter` canlı pilot yoksa yeni pilot doğurur. `resume` asla doğurmaz: canlı
  pilot varsa devralır; yoksa son sonucu (`resultKeep` içinde) `result` olarak gönderir, o da
  yoksa `kick{ended}`.
- **Hesap başına tek pilot:** aynı hesabın yeni bağlantısı eskisini `kick{replaced}` ile kapatır,
  aynı pilotu devralır (`linkLost` ve `fuelOut` dahil).
- Token yalnız bağlanırken doğrulanır (15 dk dolması oturumu kesmez). İstemci `api/client.ts`
  `Api`'nin `accessToken`'ını kullanır; `kick{auth}` gelirse `Api.restore()` ile tazeleyip bir kez
  yeniden bağlanır, yine olmazsa giriş ekranına döner.

## 4. Protokol (KG-T7–T9)

**Yer:** tipler `packages/rules/src/arena/protocol.ts`, saf `encode/decode`
`packages/rules/src/arena/codec.ts` (ithal `@astera/rules/arena`). Sunucu Zod şemaları
`apps/server/src/arena/schemas.ts`, `z.ZodType<ArenaClientMsg>` olarak paylaşılan tipe bağlı.
`PROTOCOL_VERSION` her değişiklikte artar.

**İstemci → sunucu**

| Mesaj | İçerik | Not |
|---|---|---|
| `hello` | `{v, accessToken, mode, ship, sortieId?}` | ilk mesaj; `mode`: `enter` · `resume` (§3); `ship`: `akinci` · `muhafiz` · `kilavuz` (protokol 8, sonraki uçuşun sınıfı); `sortieId` F8'den itibaren |
| `in` | `[seq, steerX, steerY, throttle, buttons]` | tick başına; steer ×1000 tamsayı, throttle ×100; `buttons` bit: ateş 1, turbo 2 (basılı durum), duman 4, görünmezlik 8 (basış olayı; §6) |
| `ping` | `{t}` | ~1 Hz |
| `dev` | serbest | yalnız `ARENA_DEV` (bot ekle, ağ koşullayıcı, ışınla) |

**Sunucu → istemci**

| Mesaj | İçerik |
|---|---|
| `welcome` | `{v, pilotId, tick, tickRate, snapshotRate, lifeSeed, layoutVersion, stats, cargo, serverTimeMs, roster}` — `roster`: odadaki pilotlar `[{id, name, clanTag}]` |
| `snap` | `[tick, ackSeq, self…, others…, mid…, far…]` (protokol 7, §9) — `ackSeq`: sunucunun bu tick'e kadar uyguladığı son girdi. self: uçuş durumunun **tamamı tam hassasiyetle** (p, q, s, ω, turbo şarjı ve süreleri, yakıt) + gövde, kargo, bayraklar, kalkan/yetenek sayaçları; others (nicemlenmiş): id, konum (cm), yönelim (×10⁴), hız, gövde oranı (0–100, izlenen hedefin çubuğu için), bayraklar (kalkan, duman, turbo, titreşim) |
| `ev` | olay dizisi: `join{id, name, clanTag}` · `leave{id}` · `shot{id, shooter, shotNo, p, v, tick}` · `hit{shot, target, p, dmg}` · `shotEnd{shot, reason}` · `shield` · `cloak` · `smoke{pilot, puffs}` · `death{pilot, by, p}` · `drop{id, p, v, amount}` · `pickup{id, by, amount}` · `exit{state, t, reason}` · `result{kind, …}` |
| `pong` | `{t, serverTimeMs}` |
| `kick` | `{reason}`: `protocol` · `version` · `auth` · `disabled` · `replaced` · `season` · `placement` · `shutdown` · `flood` · `ended` · `full` |

İstemci düşük frekanslı mesajları Zod ile, `snap`'i paylaşılan katı çözücüyle okur (KG-T9).
Self durumu tam hassasiyetle gelir: nicemlenmiş durumdan yeniden oynatma sunucuyla aynı sonucu
vermez ve her snapshot'ta düzeltme doğurur. Statik dünya (asteroitler, çıkışlar) **gönderilmez**:
iki taraf da `rules/arena/layout.ts`'i bilir.

**Protokol 5 (V6g, 2026-10-23, `rules/arena/feed.ts`):** mermi, duman, çarpma, kargo ve kristaller
her pakette tam durum olarak değil, değişiklik olarak gider: doğanlar, bitenler (`*Gone`), değişen
satırlar. Anahtar kare (`key: 1`) tam durumdur, istemci havuzlarını temizleyip baştan kurar; yalnız
anlık-görüntü ticklerinde gider: girişte, atlanan gönderimden sonra ve pilot başına 10 sn'de bir.
Başka sürümden gelen `hello` → `kick: version`; bu sürümden ama çözülemeyen `hello` (sınıf yok) → `kick: protocol`.
Gerekçe ve ölçüm: `17-paket-kucultme-plani.md`.

**Protokol 8 (Y4, 2026-10-23, `rules/arena/classes.ts`):** kendi satırı sınıfı taşır (faz alanından
hemen önce, 54 sayı); çözücü yakıt, gövde, şarjör ve ambarı o sınıfın sınırıyla denetler. Kadronun
her satırında `ship` var; başka geminin satırı sınıf taşımaz, gövdesi en sağlam sınıfın (600) sınırıyla
denetlenir. Sınıf `hello` ile seçilir ve **bir sonraki uçuşta** geçer; uçuş sürerken değişmez.

**Protokol 9 (Y4c, 2026-10-23, `rules/arena/signatures.ts`, KG-X29):**
- `hello` artık `tactic` da taşır: `smoke` veya `cloak`.
- Girdi 8 sayı olur. 7. düğme biti (64) A yuvasıdır; 8. sayı onun hedefidir (pilot id, yoksa −1).
- Kendi satırı 64 sayıdır. Şarjörden önce şu 10 alan gelir:
  - taktik
  - A beklemesi
  - kilit hedefi ve kilit tiki
  - tehdit (0–3) ve tehdidin kaynağı (x, y, z)
  - kalkan ve onarım tikleri
- Başkalarının bayraklarına iki bit eklenir: 8 kalkan, 16 onarım.
- Her anlık görüntü canlı füzelerin tamamını taşır. Füze 10 sayıdır: yuva, konum, hız, ömür,
  sahip, hedef. İstemci iki görüntü arasında füzeyi düz uçurur.

**Protokol 10 (Y4d, 2026-10-23, `rules/arena/tactics.ts`, KG-X30):**
- `hello` taktiği dört olabilir: `smoke`, `cloak`, `illusion`, `radar`.
- Düğme bitleri: 128 İllüzyon, 256 Tarama (en çok 511).
- Kendi satırı 67 sayıdır. Taktikten önce üç alan gelir: taktik beklemesi, kopyanın id'si
  (yoksa −1), tarama tiki. Tehdit 4 olabilir: tarandın.
- Çarpma türlerine `hologram` eklenir: kopya kırıldı.
- Her anlık görüntü `scan` taşır. Bu, alıcının kendi taramasının işaretlediği gemi id'leridir.
  Bu gemiler görüş ve menzil sınırı olmadan gönderilir; menzil dışındakiler uzak satır olarak.

**Protokol 11 (Y6a, 2026-10-23, `rules/arena/economy.ts`, `services/arenaShips.ts`, KG-X31):**
- Ambar ham kaynaktır: `hold` alaşım, kristal, döteryum miktarıdır; birim ve puan yoktur.
- Hesapla gelen pilotun `hello`'sundaki sınıf yok sayılır. Oda uçuşu hangardan açar (`launch`) ve
  hangarın gemisini, deposunu, şarjörünü ve ambarını uçurur. Konuk `hello`'daki sınıfla uçar.
- Hangar reddederse oda, sebebi koduyla `kick` gönderir (`SHIP_NOT_READY`, `NOT_ENOUGH_DEUTERIUM`,
  `SEASON_CLOSING` …); kimse oturtulmaz.
- Uçuş bitince oda bir kez `sortie` gönderir: sonuç, başkente yatan, günlük tavanın dışarıda
  bıraktığı, gemi hazır olma anı ve sebebi (tamir/bakım).
- Oda kapanırken (`preClose`) havadaki uçuşlar `recalled` olarak kapanır, ambar gemide kalır.
  Çökmeden kalan açık uçuşlar ilk kalkıştan önce bir kez geri çağrılır.
- Roster kopyayı sahibinin adı ve sınıfıyla, `copyOf` (sahibin id'si) alanıyla taşır. Yeni bir
  kopya yarım saniyelik roster birikimini beklemez; anlık görüntüden önce gönderilir. Roster en
  çok `ARENA_MAX_SEATS × 2 + 8` satırdır.

**Protokol 12 (Y6b, 2026-10-23, `rules/arena/progression.ts`, KG-X32):**
- Kendi satırı geminin seviyesini taşır (indeks 38, öldürmelerden sonra; `PILOT_WIDTH` 68).
  Satırın sınırları o seviyenin değerleridir. Uzak gövde sınırı en sağlam 20. seviye gövdedir.
- Roster satırı `level` taşır (1–20). Kopya sahibinin seviyesini gösterir.
- `sortie` mesajı `xp {earned, kept, banked}` taşır: uçuşun kazandığı, geminin tuttuğu, çubuğa
  girebilen.
- `POST /arena/upgrade` bir sonraki seviyeyi başkentin alaşım ve kristaliyle alır. Kilit sırası:
  sezon → gemi satırı → başkent.

**Protokol 13 (Y6c, 2026-10-24, KG-X34):**
- Kendi satırı 71 sayı: üç etkin yetenek rütbesi kargodan sonra, sınıf/fazdan önce.
  Diğer oyuncuların satır genişliği değişmez. Rütbeler 1–5 tam sayı olarak doğrulanır.
- `arena_ships.abilities`: imza, turbo ve dört taktiğin ayrı satın alma sayıları. Etkin rütbe,
  sınıf yakınlığıyla hesaplanır. Kalkış bu kaydı okur; `hello` istemciden rütbe/puan almaz.
- `POST /arena/ability {ability}` yalnız bir kazanılmış puan harcar. Sezon → gemi → başkent
  kilit sırası, uçuş ve rütbe/puan sınırları korunur. Hangar cevabındaki `abilities` web'in
  Zod sınırında doğrulanır; gerçek API/DB cevabı `test/arena/contract.test.ts` ile sınanır.
- `POST /arena/repair {}` aynı oturum/koltuk kapısını kullanır. Bedel ve yeni bitiş sunucudadır
  (KG-X35); kalan süre yeterince kısaysa yeniden ödeme yapılmaz.
- Y6c için migration 0199 önce uygulanır; web ve arena protokol 13'e birlikte geçer.

**Protokol 14 (Y7, 2026-10-24, KG-X36):**
- Kendi satırı 72 sayı; seviye sonrasındaki `mendPower` onarımı gönderenin gücünü korur.
  Uzaktaki gemilerin satır genişliği değişmez. Roster klan/takım kimliğini sunucudan taşır.
- `welcome.teamId` ortak kalkışı tanımlar. Biten takım üyesinin snapshot'ında `watching`
  yaşayan kamera hedefidir; `-1` kalan dost olmadığını bildirir. `watch {pilotId}` yalnız
  aynı kalkışın yaşayan gerçek pilotunu seçebilir; `hello.mode=spectate` yeni sorti açmaz.
- `GET /arena/team`; `POST /arena/team/{create,join,leave,remove,ready,start,claim}`. Oturum,
  Yarık erişimi, klan/lider yetkisi ve bütün kaynak/gemi kararları sunucuda doğrulanır.
  Lobi kalkışından önce başlangıç geri çağırması tamamlanır; hata olursa yeni uçuş açılmaz.
- Migration `0200_arena_teams` önce uygulanır; web ve arena birlikte protokol 14'e geçer.
  Kalıcılık/kilitler ve doğrulama kaydı: [20](20-y7-takim.md).

## 5. Simülasyon döngüsü (KG-T10)

`Room.step()` sırası: girdileri uygula → uçuş (+ itme, sınır) → ateş temposu (ateşle bozulan
kalkan ve görünmezlik **bu adımda** kalkar) → mermiler ve isabetler → yetenek sayaçları → kalkan → çıkış durumları → yakıt → ölümler/çekilmeler →
kapsül düşme/toplama → olay kuyruğu. `snapshotRate` ile (başlangıçta her 2. tick) pilot başına
snapshot (AOI, §9).
Zamanlayıcı: monoton saatle (`performance.now`) sapma düzelten `setTimeout`; geride kalırsa en
çok 5 yakalama adımı, fazlası atlanır ve sayılır. Tick süresi histogramı tutulur. Testler
zamanlayıcıyı değil `room.step()`'i çağırır; son tarihler (sezon) enjekte edilen `Clock` ile.

<a id="girdi"></a>
## 6. Girdi disiplini (KG-T12)

- Pilot başına sınırlı FIFO (`inputQueueMax`). **Oynatma saati** (`playout.ts`, KG-T43): ilk girdi
  `inputBuffer` tick bekler, sonra her tick bir girdi çalınır; kuyruk boşalınca son girdi tekrarlanır,
  `inputRepeatMax` aşılınca nötr ve yeniden tamponlama. Tick başına **en çok bir** girdi uygulanır
  (iki girdi = zaman genişletme hilesi).
- **Taşkın** (TCP patlaması): kuyruk tavanı aşarsa en eski girdiler atılır, ama **basış bitleri**
  (ateş, duman, görünmezlik, turbo) sonraki uygulanan girdiye OR'lanır — kısa dokunuş kaybolmaz.
- **Boşluk:** girdi yoksa sonuncusu en çok `inputRepeatMax` tick tekrar edilir (basış olayları
  tekrar edilmez), sonra nötr; süre `linkLostAfter`'ı aşarsa `linkLost` ([04 §9](04-savas-mekanikleri.md#baglanti-kopmasi)).
- `ackSeq` = uygulanan son girdinin `seq`'i; istemci ondan sonrakileri yeniden oynatır.
- Her alan kırpılır (steer [-1000, 1000], throttle [0, 100]). Bağlantı başına ≤ 60 mesaj/sn: aşan
  mesaj **düşürülür**, bağlantı kesilmez. 4 KB üstü mesaj bağlantıyı kapatır; arka arkaya 10 bozuk
  mesaj → `kick{flood}`.
- **Düzeltme yumuşatma** (`smoothing.ts`, KG-T44): uzlaştırma farkı ekrana tek karede inmez; görsel
  ofset olur ve ~200 ms'de (%95) erir. 30 m / 1 rad üstü ışınlanmadır, anında oturur.
- **Anlık görüntü boyutu** (KG-T46): ortak satırlar (diğer pilotlar 4 hane, mermi/duman/kargo/çarpma
  2 hane) yuvarlanır; kendi pilot tam hassasiyette kalır, tekrar oynatma ondan başlar.
- İstemci: tick aralığından kısa dokunuşları (< 33 ms) bir sonraki girdiye **kilitler**; tahmini
  gönderdiği nicemlenmiş girdiyle koşar. **Konum göndermez**; yalnız niyet.

<a id="tahmin"></a>
## 7. Kendi gemi ve diğerleri (KG-T13, KG-T14)

**İstemci algoritması:**
1. Her sim adımında girdiyi örnekle → `seq` ile gönder → aynı `flight.step` ile kendi gemini
   tahmin et → girdiyi "onaylanmamış" listesine koy.
2. `snap` gelince: kendi durumunu sunucunun durumuna ayarla, `ackSeq` sonrası girdileri yeniden
   oynat. Fark küçükse görsel düzeltmeyi birkaç kareye yay; büyükse (ışınlanma, ölüm) anında.
   **Test:** sıfır gecikme ve kayıpsız ağda düzeltme tam 0 (bit düzeyi).
3. Çizim iki sim adımı arasında interpolasyonla (kamera gemidir; titreme tüm ekranı sarsar).
4. Diğer gemiler: snapshot tamponu `interpDelay` gerisinden çizilir; tampon jitter'a göre
   uyarlanır; snapshot gecikirse en çok `extrapolationCap` ileri tahmin, sonra donma.
5. Kadro: `welcome.roster` + `join`/`leave` olayları; isim ve klan etiketi buradan (snapshot'ta
   yalnız id).
6. Saat: arena kendi `ping/pong` ofsetini ve RTT'sini tutar (REST'teki `lib/clock.ts`'ten ayrı;
   aynı yumuşatma fikri).

Gemi–gemi çarpışması olmadığından (KG-T19) başka gemiyle itişme tahmin edilmez.

<a id="isabet"></a>
## 8. İsabet, baş mesafesi, önleme işareti (KG-T15, KG-T16)

- Sunucu pilotun RTT'sini (`ping/pong`, yumuşatılmış) bilir. Yeni mermi `headStart =
  min(RTT/2, headStartCap)` kadar ileri konumla doğar; bu ilk segmentin çarpışması da hemen
  test edilir (dibinden atış kaçmaz). Hedefler **geri sarılmaz**.
- Çarpışma: mermi segmenti, hedefin o tick'teki hareketine göre göreli süpürülür.
- İstemci kendi izini anında çizer (`shotNo` ile); sunucunun `shot` olayı aynı `shotNo`'yu taşır,
  iz değiştirilmez/çiftlenmez. İsabet işareti **yalnız sunucu `hit`'i gelince** (S69: ateş ≠ isabet).
- **Önleme işareti ufku** `H = interpDelay + RTT + inputBuffer − headStart` (≥ 0). Neden: başka
  gemiler `interpDelay` + RTT/2 geriden çizilir (snapshot yolda RTT/2 yaşlanır); atış girdisi
  sunucuya RTT/2 + `inputBuffer` sonra uygulanır; baş mesafesi farkı kısaltır. 150 ms RTT'de
  `RTT/2` kullanmak işareti ~160 ms geride bırakır: 120 m/s yan geçen hedefte ~19 m ıskalama
  (vuruş yarıçapı 6 m) — üstelik KG-A23 verisini "geri sarma lazım" diye yanıltır. Formülün
  çözümü [03 §9](03-ucus-ve-kontroller.md#nisan).
- Ölçüm: sunucu her atışı `(atıcı RTT kovası, mesafe kovası, isabet mi)` olarak sayar; dev
  katmanında ve F7 raporunda gösterilir. 150 ms kovasında isabet belirgin düşükse KG-A23.

## 9. İlgi alanı (AOI) ve bant genişliği

Protokol 7 (KG-X26): her pilota en yakın **50** gemi (`MAX_REMOTE_PILOTS`), 2,4 km'ye kadar, üç
kademede. Toplam 50'yi, yinelenen id'yi ve kademeler arası tekrarı çözücü reddeder.

| Kademe | Mesafe | Satır | Sıklık |
|---|---|---|---|
| `others` | ≤ 800 m (`REMOTE_NEAR_RANGE`) | tam (nicemlenmiş) | her anlık görüntü (15 Hz) |
| `mid` | 800 m–1,6 km (`REMOTE_FULL_RANGE`) | tam | her `MID_EVERY` = 4 tick (7,5 Hz) |
| `far` | 1,6–2,4 km (`REMOTE_FAR_RANGE`) | uzak: id, konum, yön, hız, bayrak | her `FAR_EVERY` = 6 tick (5 Hz) |

- Kademe değiştiren geminin satırı o tick gider; anahtar karede bütün kademeler gider.
- Her sınırda ±50 m bant (`REMOTE_BAND`): sınırda gidip gelen gemi kademe değiştirmez.
- `MID_EVERY` ≤ `interpDelay` (4 tick): orta kademe gemi hep iki örnek arasında ara değerlenir.
- İstemci gemiyi kendi kademesinin süresi boyunca görmezse siler; yakın gemi ilk eksik pakette gider
  (ölen, gizlenen hemen kaybolur).
- Kilit, nişan, işaret ve ses yalnız tam satırlı gemiye bağlıdır; `shot` olayları da aynı yarıçapla
  süzülür.

Ölçüm (50 pilotluk savaş, 2026-10-23): paket ort. 4,33 KB (protokol 6) → 3,19 KB.
**Eşik: istemci başına ≤ 30 KB/sn indirme** (en kötü sahne). Oda testi bayt/sn'yi ölçer, eşik
aşılırsa başarısız olur. Aşılırsa önce alan/hassasiyet kırpılır, sonra ikili kodlamaya geçilir.

## 10. Gizlilik ve hile sınırları

- **Görünmezlik:** sunucu filtreler (KG-T17). **Duman:** önce istemci, herkese açık yayından önce
  sunucu (KG-T18, F10 kapısı).
- Sunucu tek otoritedir: hareket (yalnız girdiden), ateş temposu ve yakıt, hasar, yetenek
  bekleme/şarjları, çıkış durumu, kargo. İstemci hiçbirini bildiremez.
- Kalan riskler (yazılı, kabul): nişan botları (tam önlenemez; koni ve TTK sınırlar), dağılım
  tohumunu bilen istemci (kazanç koni içi), sunucu duman filtresi gelene kadar HUD'da duman arkası.

<a id="uzun-omurlu"></a>
## 11. Uzun ömürlü oturum tuzakları (KG-T22)

- **Galaksi taşıması:** `services/commanderTransfer.ts` taşınan oyuncu için `placement_changed`
  yayınlar. Arena dinler → pilotu **geri çağırır** (prototipte: `kick{placement}`; F8'de KG-A15
  kuralı: kargo ambarda kalır, yatırılmaz) ve kapatır. F8'de transfer, aktif sortie'yi "meşgul
  iş" sayıp bekler. İstemci aynı olayla `rollover` yapar ([06 §3](06-istemci.md#uygulama-dali)).
- **Aktiflik:** aktiflik yalnız `requireAuth`'ta yazılıyor; arena bağlı her pilot için en çok
  60 sn'de bir `Presence.touch(accountId)` çağırır (dönüş başvurusunu da tazeler). Yoksa pilot
  5 dk sonra pasif görünür; Sessiz Uzay ve klan devri yanlış karar verir.
- **Sezon sonu (KG-A16 önerisi):** bitişe 10 dk kala yeni giriş yok ve HUD geri sayımı; 2 dk kala
  kalanlar geri çağrılır (kargo yatırılmaz — S31). `worker/handlers.ts` `freezeSeason` uçuştakini
  bekler ama `forceSeasonEnd` beklemez; donmuş sezonda `loadLocked` `SEASON_FROZEN` atar → F8'de
  sortie'ler freeze bekleme listesine girer.
- **Deploy/çökme (KG-A15 önerisi):** SIGTERM → yeni bağlantı yok → herkese `kick{shutdown}` ve (F8)
  "geri çağrıldı" yerleşimi 30 sn içinde: yeni hasar yok, kargo **ambarda kalır** (yatırılmaz).
  Açılışta açık kalan sortie'ler aynı şekilde kapatılır. Prototipte kalıcılık yok: kargo kaybolur.

<a id="odalar"></a>
## 12. Odalar ve nüfus (KG-T4, KG-A6)

`roomKeyFor(pilot)` tek fonksiyon (varsayılan `seasonId`). `ARENA_DEV`'de tüm pilotlar **tek ortak
odada** (sahibin telefonu ile ikinci test hesabı farklı galaksilerde olsa da buluşur, [11 §7](11-test-ve-playtest.md#sahiple-oturum)).
Oda tavanı `roomCap`; aşılırsa aynı anahtarla yeni oda. Oda ancak **pilot, kapsül ve bekleyen
sayaç** (kopma, kurtarma) kalmadığında uyur; aksi hâlde kapsül ömrü ve sayaçlar donardı. Her oda
tick'i try/catch içinde; hata sayılır, oda yeniden kurulur, diğer odalar etkilenmez. Canlı nüfus
düşük (~288 oyuncu) → asıl risk boş oda; karar sahibin.

## 13. Botlar ve dev ağ koşullayıcı (KG-T29)

- **Botlar** odanın içinde, **aynı girdi hattından** (her tick girdi üreten davranış fonksiyonu,
  tohumlu RNG): `chaser` (en yakın taşıyıcıyı kovalar; nişan hatası ve tepki gecikmesi
  ayarlanır), `carrier` (tehditten kaçar, turbo/duman kullanır, çıkışa gider), `drone` (rota
  uçar), `camper` (çıkış yakınında bekler), `runner` (çıkışa koşar). Yalnız `ARENA_DEV`'de; prod
  kararı KG-A6.
- **Ağ koşullayıcı** (yalnız `ARENA_DEV`): bağlantı başına gönderme/alma kuyruklarına gecikme,
  jitter, kayıp ve "takılma" (ör. 10 sn'de bir 500 ms — mobil TCP patlamaları). Ön ayarlar:
  0 / 80 / 150 / 250 ms ± 30 ms. Dev panelinden değişir.

<a id="kalicilik-f8"></a>
## 14. Kalıcılık (F8) — taslak

F1–F7'de DB yazımı yok. F8, ilgili sahip soruları (KG-A8, A9, A11, A17, A24; tam liste
[12 F8](12-yol-haritasi.md#f8)) cevaplanınca başlar:

- **`commander_ships`**: `player_id` (PK, FK `players.id` — sezonluk; transferde oyuncuyla gider),
  sekiz özellik + üç yetenek seviyesi (tamsayı), `hp`, `fuel`, `state`
  (`ready | deployed | needs_repair`), `repair_until` (okunurken hesaplanır; olay/kuyruk yok).
- **`arena_sorties`**: `id`, `player_id`, `season_id`, `status`
  (`pending | active | extracted | destroyed | fuel_out | link_lost | recalled | forfeited`),
  başlangıç/bitiş yakıt ve can, kargo, istatistik (vuruş, hasar), zamanlar. Oyuncu başına en çok
  bir `pending|active` (kısmi benzersiz indeks).
- `commander_ships.cargo`: ambarda kalan, yatırılmamış **gerçek** kargo (geri çağrılma, KG-A15);
  sonraki sortie onunla doğar. TEST kargo saklanmaz, her doğuşta yeniden verilir.
- **Akış:** istemci REST `POST /api/arena/sorties` (kapı altında, `request_log` ile idempotent;
  gemi hazır mı, yakıt yükle) → `pending`; soket `hello{sortieId}` ile koşullu update
  `pending → active`. Bitişte **tek işlem:** koşullu `status` güncellemesi (0 satır = zaten
  yerleşmiş, no-op) → yalnız `extracted`'ta **gerçek** kargoyu başkente `loadLocked` ile yatır
  (TEST kargo asla; F9 öncesi yatırılacak gerçek kargo yoktur) → `commander_ships` güncelle → bus
  bildirimi (yeni kind; bus kind'ları **yalnız eklenir**) → commit.
- Migration'lar `apps/server/drizzle/` (drizzle-kit), şema `db/schema.ts`. Sunucu şema gerideyken
  açılmaz (`assertSchemaCurrent`) — dağıtım sırası `docs/deployment.md` kural 5–6.
- Ekonomi etkisi yeni sezon ruleset kapısıyla gelir mi: KG-A17.

## 15. Dağıtım değişiklik listesi (F10)

`env.ts` (ROLE, port) · `app.ts` (rol başına route) · `routes/health.ts` · `docker-compose.prod.yml`
ve `docker-compose.stage.yml` (`arena` servisi, bellek, `127.0.0.1:3220`, 30 sn durma süresi) ·
`deploy/host-capacity-preflight.sh` (beklenen servis/rol/bellek listesini sabit yazıyor) ·
`deploy/nginx/astera.conf`: `location /arena/ws` → `proxy_http_version 1.1`, `Upgrade
$http_upgrade`, `Connection "upgrade"`, `X-Forwarded-For` **değiştir** (ekleme), uzun okuma süresi;
aynı dosyada `location = /index.html` bloğundaki `add_header Content-Security-Policy` satırının
`connect-src`'sine `wss://asteraonline.space` (CSP nginx'te, `index.html`'de değil).
`stage.asteraonline.space`'in nginx'i repoda yok: aynı değişiklik için sahibe sor ·
`docs/deployment.md` (kural 1 ve 8
konteyner sayıları, adım döngüleri, sağlık belgeleri, boşaltma davranışı, sürüm el sıkışması
artık var) · `docs/architecture.md` ("Realtime: SSE only" satırına arena istisnası) ·
Dockerfile değişmez (`packages/rules/src` ve `apps/server/src` bütün kopyalanıyor; doğrula).
