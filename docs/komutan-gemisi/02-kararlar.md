# Komutan Gemisi — Karar kaydı

> **Durum:** Canlı belge. Son güncelleme 2026-10-07 (ilk yazım: planlama oturumu).
> **Hedef okuyucu:** Geliştirmeyi yapan agent. Her yeni karar, sahip cevabı ve denenip
> bırakılan yol **buraya** yazılır (kurallar: [README §Belge bakımı](README.md#belge-bakimi)).
> **Önekler:** `KG-K` sahip kararı (yeniden sorulmaz) · `KG-T` teknik karar (agent'ın; gerekçeli,
> geri alınabilir) · `KG-A` açık soru (sahibe sorulacak) · `KG-X` değerlendirildi/denendi, bırakıldı.
> Global `D…` numaralarıyla karışmasın diye hepsi `KG-` önekli.

---

## Sahip kararları (KG-K)

#### KG-K1
**Özellik, ürün vizyonunun bilinçli bir istisnasıdır** (2026-10-07). Gerçek zamanlı, elle
sürülen PvP modu sahibin açık talebidir; galaksi ana oyun olarak kalır. Sınırlar:
[01 §20](01-urun.md#sahip-istisnasi).

#### KG-K2
**[01-urun.md](01-urun.md) maddeleri kesin kurallardır** (2026-10-07). Değiştiren, kaldıran veya
yeni kısıt ekleyen her öneri uygulanmadan önce sahibe sunulur. Boşluk dolduran teknik ayrıntılar
(KG-T) sahibe sorulmaz.

#### KG-K3
**Gelişim sezonluktur** (2026-10-07). Geliştirmeler sezon boyunca kalıcıdır, yeni sezonda
sıfırlanır. Hesap sezonlar arası yalnız kimlik, kozmetik ve rekor taşır (mevcut kural:
`game-design.md` "record and cosmetics only, never power"; `rules/src/rewards.ts` kaybedilemez
kalıcı yükseltmeleri reddeder). Veri modeli: [KG-T21](#kg-t21).

#### KG-K4
**Görünmez gemi hasar alır** (2026-10-07). Görünmezlik yalnız görünmemektir; mermiler fiziksel
olarak çarpar, kör atış isabet edebilir. Hasar almama yalnız doğuş kalkanına özgüdür.

#### KG-K5
**Bağlantı kopması / uygulama arka planda** (2026-10-07): gaz kesilir, gemi yavaşlayıp durur ve
**30 sn** sahada savunmasız kalır. 30 sn içinde dönen oyuncu kaldığı yerden devam eder. Dönmezse
gemi **yakıtı bitmiş gibi** çekilir (yeni hasar yok, kargo o konuma düşer). Amaç: bağlantıyı
koparmak savaştan kaçış yolu olmasın. Ayrıntı: [04 §Bağlantı kopması](04-savas-mekanikleri.md#baglanti-kopmasi).

#### KG-K6
**Referans varlıklar** (2026-10-07): geliştirmeyi yapan agent, sahibin telefonuna ADB ile
bağlanıp Vendetta Online, Space Commander: War and Trade, Subdivision Infinity ve Metalstorm'u
inceler, uygun modelleri/parçaları/sesleri çıkarır. Bunlar **geçicidir**, **depo dışında**
tutulur, yalnız **yerel geliştirmede** kullanılır; yayına ve public depoya **asla** girmez.
Sahip "Tamam, oyun oldu" dediğinde hepsi Astera'nın kendi modelleriyle değiştirilir.
Prosedür: [09](09-varliklar-ve-referans-cikarma.md).

#### KG-K7
**Çalışma biçimi** (2026-10-07): geliştirmeyi, bu özellikten habersiz bir agent sahibin
bilgisayarında yapar. Sahip ona brief'i ayrıca vermez; **bu klasör tek kaynaktır**. Belgeler
geliştirme boyunca güncel tutulur.

---

## Teknik kararlar (KG-T)

Agent'ın kararlarıdır; daha iyisi ölçümle kanıtlanırsa değişir (değişiklik buraya yazılır,
eskisi KG-X'e tek satır olarak taşınır).

#### KG-T1
**Kod adları.** Gemi `commanderShip` (TS) / `commander_ships` (DB), alan `arena`, tek giriş-çıkış
seferi `sortie` / `arena_sorties`, odadaki oyuncu `pilot`. Kodda "commander" zaten **oyuncu**
demektir (`accounts.displayName`, `commanderTransfer`); "commander ship" = oyuncunun gemisi.
Arayüzde "Komutan Gemisi" (sahibin geçici adı, [KG-A21](#kg-a21)) ve "Savaş Alanı".

#### KG-T2
**Belgeler Türkçe**, kod tanımlayıcıları İngilizce (repo'daki son özellik planlarıyla aynı:
`plan.md`, `monument-design-plan.md`). Kod konumu satır numarasıyla değil **sembol adıyla** verilir.

#### KG-T3
**Ayrı süreç: `ROLE=arena`** (dev'de de ayrı). Otoriter oda tek süreçte yaşamalı; API replikaları
sticky'siz `least_conn`. API ile yalnız DB + bus üzerinden konuşur, bellek paylaşmaz. `app.ts` rol
başına açık route listesine geçer (yoksa arena tüm public API'yi açar). Ayrıntı:
[05 §2](05-ag-ve-sunucu.md#surec-ve-rol).

#### KG-T4
**Oda.** Anahtar tek fonksiyonda: `roomKeyFor(pilot)` → varsayılan `seasonId` (galaksi); dev'de
tek ortak oda. Tavan `roomCap` (aşılırsa aynı anahtarla ikinci oda); her oda tick'i kendi
try/catch'inde. Kapsam sahibe açık: [KG-A6](#kg-a6). Ayrıntı: [05 §12](05-ag-ve-sunucu.md#odalar).

#### KG-T5
**Taşıma: WebSocket, uç nokta `/arena/ws`** (`ws` paketi). `/api/` altında değil: nginx
`location /api/` istekleri API replikalarına dağıtır ve `Connection` başlığını siler; soket tek
arena sürecine gitmeli. WebTransport yalnız ölçüm TCP takılmasını kanıtlarsa, taşıma arayüzünün
arkasında denenir. Ayrıntı: [05 §3](05-ag-ve-sunucu.md#uc-nokta).

#### KG-T6
**Kimlik ve oturum.** İlk mesaj `hello` (token URL'de değil — nginx loglar); token yalnız
bağlanırken doğrulanır. **Hesap başına tek pilot:** yeni bağlantı eskisini kapatır, gemiyi
devralır. `resume` kipi asla yeni pilot doğurmaz. F8'de sortie REST'te açılır, soket onu
sahiplenir. Ayrıntı: [05 §3](05-ag-ve-sunucu.md#uc-nokta).

#### KG-T7
**Paylaşılan kod `packages/rules/src/arena/`** + `package.json` `exports`'a `"./arena"` (ithal:
`@astera/rules/arena`). Uçuş, mermi, çarpışma, yetenek, yakıt, çıkış, alan verisi, protokol
tipleri ve saf encode/decode burada; sunucu ve istemci **aynı kodu** koşar. Neden: yeni workspace
paketi Dockerfile, CI ve kurulum katmanında değişiklik ister ([KG-X9](#kg-x9)); ana barrel'a
(`index.ts`) eklenmediği için canlı galaksi kurallarına dokunmaz (dağıtım kuralı 13). ESLint saflık
kuralları `packages/rules/src/**` için zaten geçerli; testler `packages/rules/test/arena/`.

#### KG-T8
**Protokol sürümü** her `hello`da. Uyuşmazsa sunucu `kick {reason:'protocol'}` gönderir, istemci
"Yeni sürüm var — yenile" gösterir (`deployment.md` sürüm el sıkışmasını açık boşluk olarak
listeliyor; arena bunu baştan çözer).

#### KG-T9
**Kodlama.** Başlangıçta JSON; yüksek frekanslı mesajlar (girdi, snapshot) **yuvarlanmış
sayılardan düz diziler** halinde, paylaşılan `encode/decode` arkasında. Sunucu her istemci
mesajını **Zod** ile doğrular, şema `z.ZodType<ArenaClientMsg>` olarak paylaşılan tipe bağlanır
(sapma derleme hatası olur). İstemci düşük frekanslı mesajları Zod ile, snapshot'ı paylaşılan
**katı çözücüyle** (bozuk veride atar) okur — her karede Zod çalıştırmamak için gerekçeli istisna.
Bant genişliği oda testinde ölçülür; ikili biçime yalnız ölçüm isterse geçilir.

#### KG-T10
**Zaman.** Sunucu simülasyonu `tickRate` sabit adımla, tick sayısıyla ilerler; snapshot
`snapshotRate`'te. Döngü monoton saatle sapma düzelten zamanlayıcı, en çok 5 yakalama adımı.
Testler `room.step()` çağırır, gerçek zamanlayıcı kullanmaz. Duvar saati yalnız son tarihlerde
(sezon sonu vb.), enjekte edilen `Clock` (`apps/server/src/clock.ts`) üzerinden.

#### KG-T11
**Tarayıcılar arası determinizm.** Paylaşılan simülasyon yalnız IEEE-754'te **tam tanımlı**
işlemleri kullanır: `+ − × ÷`, `Math.sqrt`, karşılaştırmalar,
`Math.min/max/abs/floor/ceil/trunc/round/sign` ve `Math.imul` (`rng.ts`). **Yasak:**
`Math.sin/cos/tan/asin/acos/atan/atan2/pow/exp/log/hypot/cbrt` ve `**` operatörü (V8 ile
JavaScriptCore farklı sonuç verebilir → tahmin hatası). Durum float64'tür. Açılar
kuaterniyon/vektör aritmetiğiyle, eğriler polinomla, dağılım yönleri **önceden hesaplanmış
tablodan**. Girdi nicemlenir; istemci tahmini de **nicemlenmiş** girdiyle koşar.

#### KG-T12
**Sunucu girdi disiplini.** Sınırlı FIFO; **tick başına en çok bir girdi** (zaman genişletme
hilesi yok). Taşkında en eskiler atılır ama **basış bitleri** sonraki uygulanan girdiye taşınır.
Girdi gelmezse sonuncusu kısa süre tekrar edilir, sonra nötr. Hız sınırı aşan mesajları düşürür,
bağlantıyı kesmez. Ayrıntı: [05 §6](05-ag-ve-sunucu.md#girdi).

#### KG-T13
**Kendi gemi: tahmin + uzlaştırma.** Aynı `flight.step` ile tahmin; snapshot gelince sunucu
durumuna dönülür, onaylanmamış girdiler yeniden oynatılır. Self durumu **tam hassasiyetle** gelir
(sıfır gecikmede düzeltme tam 0 — test). Çizim iki sim adımı arasında interpolasyonla. Ayrıntı:
[05 §7](05-ag-ve-sunucu.md#tahmin).

#### KG-T14
**Diğer gemiler: interpolasyon.** `interpDelay` gerisinden çizilir (en az iki snapshot aralığı,
jitter'a göre uyarlanır); snapshot gecikirse en çok `extrapolationCap` extrapolasyon, sonra
donma. Değerler [04 §13](04-savas-mekanikleri.md#baslangic-degerleri).

#### KG-T15
**Mermi ve isabet: sunucu otoritesi, geri sarma yok.** Mermiler sunucuda simüle edilir; çarpışma
hedefin o tick'teki hareketine **göreli** süpürülmüş segment–küre testidir (tünel yok). Hedefler
geri sarılmaz (kurbanın kaçışı sayılır). Yeni mermiye `headStart` baş mesafesi verilir; mermi gemi
hızını miras alır; kendi izin anında çizilir, `shotNo` ile eşlenir. Geri sarma yalnız ölçüm
isterse ([KG-A23](#kg-a23)). Ayrıntı: [05 §8](05-ag-ve-sunucu.md#isabet).

#### KG-T16
**Önleme işareti ve hedef seçimi.** Nişangâha en yakın, menzilde, **görünür** (duman/görünmezlik
arkasında olmayan) düşman otomatik "izlenen hedef" olur; kilit, mıknatıs, otomatik dönüş yok.
İşaretin ufku tüm gecikmeyi kapsar: `H = interpDelay + RTT + inputBuffer − headStart`
([05 §8](05-ag-ve-sunucu.md#isabet)). Mermiyi yönlendirmez. Varsayılan açık, ayarda
kapatılabilir ([KG-A5](#kg-a5)).

#### KG-T17
**Görünmezlik sunucuda gizlenir:** görünmez gemi diğer pilotların snapshot'ına **hiç girmez**;
yalnız `cloakShimmerDist` içinde bir "titreşim" bayrağı gider. Hileli istemci de göremez.

#### KG-T18
**Duman: tek bir görüş hattı (LOS) fonksiyonu** (`rules/arena`), duman kürelerine karşı. Prototipte
istemci isim etiketi, hedef çerçevesi ve önleme işaretini bununla gizler. **Herkese açık yayından
önce** sunucu da aynı fonksiyonla duman arkasındaki gemiyi snapshot'tan çıkarır (proje kuralı:
sis sorguda uygulanır, UI'da değil). Bu bir F10 kapısıdır.

#### KG-T19
**Çarpışma.** Gemi, asteroit, yapı = küre (büyük yapılar birkaç küre). Asteroit/yapı mermiyi
keser (siper). Gemi–asteroit: dışarı itme + hız kaybı, prototipte hasarsız. **Gemi–gemi çarpışması
yok** (birbirinin içinden geçer): tahmin uyuşmazlığı ve itişme hilesi çıkmaz.

#### KG-T20
**Alan sınırı.** Küre; sınırdan dışa doğru hız bileşeni silinir (gemi sınır boyunca kayar),
`boundaryWarn` kala uyarı. Hasar yok, otomatik dönüş yok.

#### KG-T21
**Kalıcılık F8'de başlar** (F1–F7'de DB yazımı yok; varsayılan istatistikler + test kargosu).
F8: `commander_ships` (`player_id` anahtarlı → `players` satırı sezonluk olduğundan doğal olarak
sezonluk; galaksi taşımasında oyuncuyla gider) + `arena_sorties` (oyuncu başına en çok bir aktif).
`units`, `ship_damage_lots`, Repair Station kullanılmaz ([KG-X8](#kg-x8)). Yerleşim tek işlemde:
koşullu durum güncellemesi + `loadLocked` ile başkente yatırma + bus bildirimi; idempotent.
TEST kargo hiçbir zaman yatırılmaz. Ayrıntı: [05 §14](05-ag-ve-sunucu.md#kalicilik-f8).

#### KG-T22
**Uzun ömürlü oturum kuralları.** `placement_changed` → pilot güvenli döner ve kapanır; arena
bağlı pilot için `Presence.touch` çağırır; sezon sonu ve deploy/çökme: [KG-A15](#kg-a15),
[KG-A16](#kg-a16). Ayrıntı: [05 §11](05-ag-ve-sunucu.md#uzun-omurlu).

#### KG-T23
**İstemci modu.** Arena `App.tsx`'te uygulama düzeyi bir daldır (`arena` durumu): galaksi
(`GameShell` + canvas) **unmount** olur → tek WebGL bağlamı. `academyReplay`'den farkı: SSE
(`useEventStream`) ve `useLiveAlerts` **açık kalır**; galaksi toast'ları uçuşta
`useSilenceToasts` ile susturulur. Arena kodu lazy chunk; kendi ErrorBoundary'si ve bir kez
import yeniden denemesi var (iOS olayı: `docs/incident-ios-lazy-module-2026-09.md`). Ayrıntı:
[06 §3](06-istemci.md#uygulama-dali).

#### KG-T24
**Render sürücüsü.** R3F `Canvas` `frameloop="never"`. Kendi `requestAnimationFrame` sürücümüz sim
adımını atar ve `advance()` çağırır; tek öncelikli `useFrame` **yalnız çizer**: ana sahne → silah
modelleri (derinlik temizlenip ayrı geçiş) → arka görüş (düşük çözünürlüklü render target'a iki
karede bir; her karede ayna çevrilerek kompozit). Kare politikası `strideFor(60, …)` 60 fps'in
altına düşmeyen adımdır, **tavan değildir** (60 Hz→60, 90→90, 120→60, 144→72). Prototipte
post-processing yok. Ayrıntı: [06 §4](06-istemci.md#render). `frameloop="always"`: [KG-X10](#kg-x10).

#### KG-T25
**HUD mimarisi.** Oyun durumu React dışında düz TS modüllerinde, önceden ayrılmış tamponlarla.
HUD bir DOM katmanıdır: ~10 Hz güncellenen dış store (`useSyncExternalStore`); nişangâh, isabet
işareti ve önleme işareti **ref ile doğrudan** her karede.

#### KG-T26
**Varlık kayıt defteri.** Kod modele değil **mantıksal kimliğe** bağlanır (`ship.pilot`,
`gun.left`, `asteroid.m`…). Oyun geometrisi (vuruş yarıçapı, namlu noktası, motor noktası)
`rules/arena` verisidir, modelden okunmaz. Çözüm sırası: (dev'de) referans varlık → kendi
varlığımız → prosedürel yer tutucu. Ayrıntı: [09 §Kayıt defteri](09-varliklar-ve-referans-cikarma.md#kayit-defteri).

#### KG-T27
**Bayraklar.** Sunucu `ARENA_ENABLED` (varsayılan `false`), istemci girişi
`import.meta.env.DEV || import.meta.env.VITE_ARENA === '1'`. Prod'da prototip görünmez. Stage'de
yalnız admin: istemci `session.me.isAdmin`, sunucu `ARENA_ADMIN_ONLY=true` iken `hello`da
`services/admin.ts` `isAdminAccount` ile doğrular.

#### KG-T28
**Ses.** Yeni küçük WebAudio modülü (efektler). Müzik (`lib/music.ts`) arenada geçici susar ama
**kayıtlı tercih değişmez**: `setMusicEnabled` tercihi yazdığı için kullanılmaz, kaydetmeyen bir
bastırma eklenir. Cihaz başına efekt sesi ayarı. Titreşim `lib/haptics.ts` (iOS'ta etkisiz).

#### KG-T29
**Test ve ölçüm yardımcıları.** Sunucu botları (kovalayan, kaçan taşıyıcı, hedef dron, çıkışa
koşan), dev ağ koşullayıcı (gecikme/jitter/kayıp/takılma), dev katmanı (fps, kare ms p95, draw
call, üçgen, RTT, jitter, snapshot yaşı, uzlaştırma hatası, bant), `window.__arena` debug tutamağı
(yalnız DEV / `VITE_VISUAL_TEST`), `tools/arena-visual.mjs`. Kayıt ve ekran görüntüleri
**`.dev/arena/`** altına (gitignore'da). `out/` kullanılmaz: gitignore'da olduğu hâlde 91 izlenen
dosya var.

#### KG-T30
**Kontrol düzeni başlangıcı.** Sol başparmak yalnız yön (yüzen hız-joystick'i); sağ başparmak
ATEŞ + yetenekler; gaz yapışkan kol, iki konumda (A: sol çubuğun yanı, B: sağ kenar) dev
anahtarıyla denenir. Ayrıntı ve ölçütler: [03](03-ucus-ve-kontroller.md).

---

## Açık sorular (KG-A)

Biçim: **Soru** · Öneri · Prototip varsayılanı (sahip cevaplayana kadar) · Ne zaman sorulur.
Sahip cevaplayınca madde KG-K'ye taşınır, buradan silinir.

#### KG-A1
**Doğuş kalkanı ne zaman biter?** Spec: 60 sn veya ateş. Sorun: 60 sn × ~120 m/s her çıkışa
yetiyor → kalkanlı gemi dokunulmaz biçimde çıkabilir; kaynak toplama gelince kalkanlı toplama da
olur (kovalamaca testini de bozar). · **Öneri:** hangisi önce olursa: ateş, çıkış alanına giriş,
kargo toplama, 60 sn. · Varsayılan: öneri. · **F0'da sor** (kilitli kurala ek).

#### KG-A2
**Yakıt bitince çekilme anlık mı?** Anlıksa "ölmek üzereyken yakıtı ateşle tüket, hasarsız
kurtul" kaçışı doğar (ateş de döteryum yakar). · **Öneri:** gemi sürüklenip durur, "Kurtarma
yolda" sayacıyla **10 sn** savunmasız kalır; bu sürede yok edilirse yok edilme sayılır. ·
Varsayılan: öneri. · **F0'da sor.**

#### KG-A3
**Yakıt ve mühimmat döteryumu tek depodan mı?** · **Öneri:** tek depo; HUD "bu hızla kalan
süre"yi gösterir; her atış depodan düşer (atmak = kaçış menzilinden yemek, anlamlı karar). ·
Varsayılan: öneri. · **F0'da sor.**

#### KG-A4
**Son kontrol yerleşimi ve dikey/yatay.** · Öneri: F7'deki ölçümlerle (ölçütler [03](03-ucus-ve-kontroller.md#dikey-mi-yatay-mi)). · Varsayılan: A/B dev anahtarı, dikey. · **F7.**

#### KG-A5
**Önleme işareti oyuncuya varsayılan açık mı?** · Öneri: açık + ayardan kapatılabilir. · F7.

#### KG-A6
**Oda kapsamı ve canlılık.** Canlıda ~288 oyuncu (EU-1, EU-2, WAIT-1); en çok 2 ilan edilen
galaksi × 1000 koltuk. Asıl risk kalabalık değil **boş oda** ("Alive" ilkesi). · Öneri: oda =
galaksi; nüfus az kalırsa galaksileri tek odada birleştirmek (`roomKeyFor` tek satır) ve/veya
alana NPC/bot pilotlar. · Varsayılan: galaksi başına. · F7 sonrası, F8 öncesi.

#### KG-A7
**Klan üyeleri müttefik mi, herkes rakip mi?** · Öneri: MVP'de herkes rakip (FFA), klan etiketi
görünür, dost ateşi açık; müttefik işaretleme sonra. · Varsayılan: FFA. · F8.

#### KG-A8
**Hasarlı (yok edilmemiş) gemi alana girebilir mi?** Referans görsel 04'te %72 gövdede "SAVAŞ
ALANINA GİR" pasif. · Öneri: girebilir (zayıf girmek bir risk kararı); yalnız yok edilip çekilen
gemi tamirsiz giremez. · Varsayılan: kalıcılık yok (F8'e kadar soru doğmaz). · F8.

#### KG-A9
**Tamir modeli.** "Birkaç yenilgi uzun süre oynatmamazlık yaratmasın" (S59). · Öneri: zamanla
ücretsiz tamir (ör. tam onarım 45 dk) + kaynakla anında tamir. · F8.

#### KG-A10
**Yeni kaynağın adı/kaynağı ve kart türleri/kaynakları** (S38–S39, S41). · Öneri: yeni kaynak
yalnız arenada kazanılır (galaksi ekonomisini şişirmez); kartlar sonra monument ödülü. · F8/F9.

#### KG-A11
**Maliyetler, seviye tavanları, azalan getiri** (S39). · Öneri: [08](08-ilerleme-ve-ekonomi.md). · F8.

#### KG-A12
**Kaynak toplama yöntemi** (S44, S48). · Öneri: asteroidi silahla kırınca çıkan kapsülü üstünden
geçerek toplamak (yeni kontrol yok, silah ve uçuş becerisini kullanır). Alternatif: Subdivision
tarzı madencilik ışını (yeni kontrol + yeni durum). · F9.

#### KG-A13
**Arena PvP'si Dominion'u besler mi?** Dominion galaksinin sıfır toplamlı ladder'ı. · Öneri:
hayır (ayrı rekor/istatistik). · F8.

#### KG-A14
**Arena olayları galakside görünür mü?** (bildirim, kısa "sortie raporu"). · Öneri: evet, kısa
rapor ("X seni 230 m'den vurdu, 40 kristal düştü") — "Ne oldu?" duygusu. · F8.

#### KG-A15
**Deploy/çökme/galaksi taşımasında uçan pilotlar.** Her sürüm arena sürecini yeniden başlatır
(dağıtım kuralı 1: tüm konteynerler aynı commit). **Kilitli kuralla çelişki:** S31 "kaynakları
güvenle eve ulaştırmanın **tek yolu** çıkıştır" diyor; "geri çağrıldı, kargo eve gider" ikinci
bir güvenli yol açar ve deploy anlarında istismar edilebilir. · **Öneri:** SIGTERM'de ≤ 30 sn
içinde herkes "geri çağrılır": gemi yeni hasar almadan eve döner, kargo **ambarda kalır**
(yatırılmaz, yanmaz) ve sonraki sortie'de yine risk altındadır. Açılışta açık kalan sortie'ler
aynı şekilde kapatılır. Alternatif: kargo yanar (operatörün deploy'u oyuncuyu cezalandırır). ·
Varsayılan: prototipte kalıcılık yok, kargo kaybolur. · **F8 başında sor** (S31'e dokunur).

#### KG-A16
**Sezon sonu.** `freezeSeason` uçuştakini bekler ama operatörün `forceSeasonEnd`'i beklemez;
donunca `loadLocked` `SEASON_FROZEN` atar (kargo yatırılamaz). · **Öneri:** bitişe 10 dk kala giriş
kapanır ve HUD'da "Sezon bitiyor — çıkışa git" geri sayımı başlar; 2 dk kala kalanlar
[KG-A15](#kg-a15) kuralıyla geri çağrılır (S31 gereği kargo **yatırılmaz**; sezon bittiği için
fiilen kaybolur — 8 dk'lık uyarı çıkış için yeter). Sortie'ler freeze'in bekleme listesine girer.
· **F8 başında, KG-A15 ile birlikte sor.**

#### KG-A17
**F8 ekonomisi (gerçek yakıt/kargo/geliştirme) yeni sezon ruleset kapısıyla mı gelir?** Emsal:
`shipDamageRulesetVersion` "bir sezonla gelir, sezon içinde asla". · Öneri: evet. · F8 başında.

#### KG-A18
**PC ve mobil aynı alanda.** Fare çok daha hassas. · Öneri: fare doğrudan kamerayı değil
**sanal çubuğu** sürer (aynı hız-tabanlı model); geminin dönüş hızı tavanı iki tarafı eşitler;
ölçüp sahibe sunulur. · F10.

#### KG-A19
**Sortie süresi hedefi.** Oyun 4–6 dk aralıklarla oynanıyor. · Öneri: başlangıç deposu tam gazda
~6 dk (sürekli ateşte ~4 dk; hesap [04 §13](04-savas-mekanikleri.md#baslangic-degerleri));
ortalama sortie 4–6 dk. · F7'de doğrula, F8'de kilitle.

#### KG-A20
**Gemi galaksi sahnesinde başkentin yanında görünür mü?** (S5 "ana gezegeni üzerinde yer alacak"). ·
Öneri: evet, küçük park/yörünge modeli; dokununca yönetim sayfası. · F8.

#### KG-A21
**Kalıcı ad.** "Komutan" arayüzde zaten oyuncu (Komutan çipi/sayfası); "Komutan Gemisi" sahibin
geçici adı. · F8 veya sahip istediğinde.

#### KG-A22
**Çıkış kampı önlemleri** (S79). · Öneri sırası (ölçüme göre): çıkışları siper kümelerinin içine
koymak, girişlerden uzak tutmak, çıkış alanı yarıçapını büyütüp birden çok "duraklama noktası",
çıkış yakınında duman/görünmezliği bilinçli taktik bırakmak. · F7 gözlemi sonrası.

#### KG-A23
**Geri sarma (lag compensation).** Varsayılan yok (kurban-dürüst). Saldırgan 150 ms'de haksız
ıskalıyorsa ≤120 ms sınırlı geri sarma: atıcı lehine, kurban "kaçtım ama vuruldum" yaşar. Bu bir
adalet takası → sahibe ölçümle sunulur. · F7.

#### KG-A24
**İlk sürümde kalıcı geliştirme ve tamirin kapsamı** (S48). · Öneri: F8'de önce yalnız Can,
Saldırı, Hız + tamir; kalan özellikler sonra. · F8 başında.

#### KG-A25
**Hasar almak görünmezliği bozar mı?** Spec yalnız "ateş edince bozulur" diyor. · Öneri: hayır
(isabet kıvılcımı konumu zaten anlık ele verir). · Varsayılan: öneri. · F7'de göster.

#### KG-A26
**Çıkış sayacı sürerken ateş, yetenek ve yerinde dönüş serbest mi?** Spec yalnız "tam dur + 3 sn
hasar alma" diyor. · Öneri: evet — sayacı yalnız hasar ve hareket (`s > 0`; turbo dahil)
sıfırlar; yerinde dönmek hareket değildir (tehdidi görmek için). Duman ve görünmezlikle çıkışı
korumak bilinçli taktik. · Varsayılan: öneri. · F7'de göster.

#### KG-A27
**Durum × olay kuralları** ([04 §1](04-savas-mekanikleri.md#durum-olay)): bağlantı kopması ve
yakıt bitmesi sırasında çıkış sayacı, kalkan, girdiler ve iki sayacın çakışması. Spec ve KG-K5
bunları açıkça söylemiyor; bazıları PvP/risk kuralıdır. · Öneri: 04 §1 tablosu (özet: çıkış
sayacı fiziksel kuraldır, bağlantı/yakıt durumundan bağımsız sürer; kalkan kendi süresinde
biter; yakıtı biten gemi hiçbir girdiyi almaz; iki sayaç birlikteyse önce dolan çeker). ·
Varsayılan: öneri. · **F0'da bilgi ver, F5 başlamadan onay al.**

---

## Değerlendirildi / denendi, bırakıldı (KG-X)

Biçim: tek satır — ne, neden olmadı. Önemsizleşenler silinir.

#### KG-X1
Otomatik nişan, hedefe yapışma, kilitlenme (prototipte) — sahip istemedi (S72); Space Commander'da
cömert kilitlenme savaşı "eller serbest" ve sıkıcı yaptı. Metalstorm'un "ateşte hafif hizalama"sı
da bir nişan yardımıdır, prototipte yok.

#### KG-X2
İstemcinin isabeti bildirmesi — sunucu tek otorite (S51, `architecture.md`).

#### KG-X3
Arena durumunu Valkey'de veya Postgres NOTIFY ile taşımak — Valkey oyun verisi tutamaz
(`architecture.md`); NOTIFY yalnız sinyal, 8 KB sınırlı.

#### KG-X4
Simülasyonu API replikalarında koşmak — `least_conn`, sticky yok; tek oda tek sürece ait olmalı.

#### KG-X5
MVP'de WebRTC/UDP (ör. geckos.io) — TURN altyapısı ve karmaşıklık; önce WS ölçülür.

#### KG-X6
Newtonian kayma (Vendetta) — spec: gemi baktığı yöne gider (S14).

#### KG-X7
Varsayılan tilt (jiroskop) yönü — dikey bakış açısında ekran kayar; iOS'ta HTTPS + izin ister
(LAN testinde yok). İleride seçenek olabilir.

#### KG-X8
Komutan gemisi için `units` / `ship_damage_lots` / Repair Station — `units` adsız yığın (dünya
ele geçirilince yeni sahibe geçer, transferler inceler); hasar lotları %20–99,99 arası ve %20 altı
inişte otomatik yamalanır; Repair Station `build_orders` kuyruğu ve sezon dondurmasını bekletir.

#### KG-X9
Protokol için yeni workspace paketi — Dockerfile paket manifestlerini tek tek kopyalıyor; yeni paket
Dockerfile, CI ve kurulum katmanında değişiklik ister. Subpath export aynı işi sıfır altyapı
değişikliğiyle görür.

#### KG-X10
R3F `frameloop="always"` — 120 Hz telefonda saniyede 120 çizim (ısınma) ve kare politikası ile
sim adımı R3F'in döngüsüne dağılır. Kendi sürücümüz ikisini tek yerde tutar.

#### KG-X11
Varsayılan geri sarma — kurban kaçtıktan sonra vurulur; kaç/kovala döngüsünü zayıflatır ([KG-A23](#kg-a23)).

#### KG-X12
Rules köküne düz `arena*.ts` dosyaları — ana barrel'a bağlanır, canlı galaksi kurallarından
yalıtım zayıflar; alt klasör + subpath export seçildi.
