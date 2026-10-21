# Komutan Gemisi — Karar kaydı

> **Durum:** Canlı belge. Son güncelleme 2026-10-08, 3. şahıs v2 (ilk yazım: planlama oturumu).
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
inceler, uygun modelleri/parçaları/sesleri çıkarır. Bunlar **geçicidir**, yalnız **yerel
geliştirmede** kullanılır; yayına ve public depoya **asla** girmez. Depolama konumu için
sonraki sahip talimatı KG-K17 geçerlidir.
Sahip "Tamam, oyun oldu" dediğinde hepsi Astera'nın kendi modelleriyle değiştirilir.
Prosedür: [09](09-varliklar-ve-referans-cikarma.md).

#### KG-K7
**Çalışma biçimi** (2026-10-07): geliştirmeyi, bu özellikten habersiz bir agent sahibin
bilgisayarında yapar. Sahip ona brief'i ayrıca vermez; **bu klasör tek kaynaktır**. Belgeler
geliştirme boyunca güncel tutulur.

#### KG-K8
**Özellik ayrı worktree'de geliştirilir** (2026-10-08). Sahibin açık talimatı;
ana çalışma alanı `master` üzerinde kalır. Güncel çalışma alanı ve dal:
[13 §Çalışma alanı](13-gelistirme-notlari.md#çalışma-alanı).

#### KG-K9
**Doğuş kalkanının bitişi** (2026-10-08): ateş, çıkış alanına giriş, kargo toplama veya
60 saniyeden **ilk gerçekleşen** kalkanı kaldırır. Sahip KG-A1 önerisini onayladı.

#### KG-K10
**Yakıt bitince kurtarma** (2026-10-08): gemi yavaşlayıp durur; **10 saniye savunmasız**
kurtarma bekler. Bu sürede yok edilirse yok edilme kuralları uygulanır. Sahip KG-A2 önerisini onayladı.

#### KG-K11
**Tek ortak döteryum deposu** (2026-10-08): uçuş ve mühimmat aynı depodan tüketilir;
her atış kaçış için kalan yakıtı da azaltır. Sahip KG-A3 önerisini onayladı.

#### KG-K12
**PR düzeni** (2026-10-08): özelliğin tamamı **tek PR** olarak sunulur. Fazlar bu dalda
ilerler; faz başına ayrı PR açılmaz.

#### KG-K13
**Sorudan önce doküman incelemesi** (2026-10-08): plan boyunca sahibe sorulacak her
konu önce plan dokümanları ve karar kayıtlarında araştırılır. Yanıt varsa uygulanır;
yalnız yanıt bulunamazsa soru sorulur. Önceden cevaplanan kararlar yeniden açılmaz.

#### KG-K14
**Önce oynanabilir, plana uygun MVP** (2026-10-08). Sahip bu aşamada dil/TDD çalışmalarını
erteledi; öncelik prototipin tasarımı, kontrolü, savaşı ve hissidir. Bu çalışma diliminde
yeni birim testleri veya dil yayılımı açılmaz; tip/build, gerçek tarayıcı ve oynanış doğrulaması
yapılır. Daha önce yazılmış testler korunur. F7 kapısı ve gerçek ekonomi sınırı değişmez.

#### KG-K15
**Eklenen görseller kabaca referanstır** (2026-10-08). `~/astera-ref-assets/Pasted image*.png`
dosyaları incelendi. Yerleşimler ve oranlar kullanılabilirlik kontrolünden geçirilir;
görsellerin birebir kopyalanması istenmedi.

#### KG-K16
**Kalite hedefi: premium AAA+ hissi** (2026-10-08). Sahip tasarım, modeller, kontroller,
butonlar, efektler, ses ve vuruş hissinde mümkün olan en iyi işi istedi. Kalite iddiası
oynanabilir sonuç ve görsel incelemeyle desteklenir; yalnız derlenen prototip yeterli değildir.

#### KG-K17
**Tam referans arşivi ve önce arşive bakma kuralı** (2026-10-08). APK'lardaki kullanılabilir
ve ileride kullanılabilecek bütün içerik projedeki `astera-refs/` altında düzenli çıkarılır.
Yeni bir model/doku/efekt/ses ihtiyacında önce bu arşive bakılır; kendi varlık üretimimiz
minimum tutulur. Prototip geçicidir; sahip son görüntünün yakın, tamamen Astera'ya ait
karşılıklarını yaptıracaktır. Proje içindeki klasör **Git dışında** ve yalnız dev servisidir;
KG-K6'nın yayına/public depoya dâhil etmeme kuralı sürer. Özel biçimlerde çözülemeyen içerik
ham hâliyle ve açık dönüşüm notlarıyla saklanır; dönüştürülmüş diye sunulmaz.

#### KG-K18
**Referans oyunları doğrudan incele** (2026-10-08). Belgedeki oyunlar APK veya internet
üzerinden incelenir; iyi yaptıkları şeyler ve Astera'ya uygulanma gerekçesi kaydedilir.
2026-10-08 inceleme ve uygulama kaydı: [10 §7](10-referans-oyunlar.md#7-2026-10-08-inceleme-ve-mvpye-uygulama).

#### KG-K19
**Oynanış 3. şahıs** (2026-10-08). Sahip MVP'yi inceledi ve kararı değiştirdi: gemi **arkadan
görülür**. S9–S10'daki birinci şahıs ve kokpitten görünen namlular geçersiz. Kamera Subdivision
örneğindeki gibi **gecikmeli takip kamerasıdır**: dönüşte gemi ekranda dönüşün dışına kayıp yatar,
yukarı çekince kamera alttan yetişir, düz uçuşta gemi ortada sabittir. Arka görüş penceresi (S11)
korunur. Uygulama: [03 §8](03-ucus-ve-kontroller.md), KG-T36.

#### KG-K20
**Hafif nişan yardımı istenir** (2026-10-08). Kontrol ve nişan için Metalstorm örnek alınır: hedefin
**çok yakınına** ateş edilirken gemi hafifçe hedefe döner ("hafif mıknatıs"). S72 ve eski KG-X1
bu kararla değişti. Dikey ekranda iki başparmak için yön, manevra, hızlanma/yavaşlama ve yetenekler
en kolay kullanılacak biçimde yerleştirilir (yerleşim F7'de doğrulanır, KG-A4).
Uygulama: KG-T34.

#### KG-K21
**İniş: kaz, saklan, mola ver** (2026-10-08; KG-A12'nin cevabı). Kayalara inilip **kazı** yapılır;
bazı yapıların yanına, üstüne ve içine inilebilir. İniş hem farm, hem saklanma, hem de kısa mola
için kullanılır. Prototip yorumu: yavaş temas iniştir; kristal kayaya inen gemi kazar ve kazı ışını
uzaktan görünür (usul usul farm atan da avlanabilir); uzaktaki inmiş ve kazmayan gemi işaret ve
radarda görünmez; çıkış kapıları da birer iniş pistidir. Kurallar: [04 §13](04-savas-mekanikleri.md#baslangic-degerleri), KG-T35.

#### KG-K22
**Varlıklarda öncelik Subdivision** (2026-10-08). Model, efekt, gökyüzü, kaya, atmosfer ve seslerde
büyük çoğunlukla Subdivision kullanılır; boşluklar diğer referans oyunlardan doldurulur. Sahip, oyun
"tamam" olduğunda hepsinin benzerini kendisi yaptıracak (KG-K6, KG-K17 sürer). Paket: [09](09-varliklar-ve-referans-cikarma.md).

#### KG-K23
**Alan ölçüsü ve dokusu** (2026-10-08). Alan ne sürekli çatışma çıkacak kadar küçük ne de birini
bulmak 10 dakika sürecek kadar büyük olur. Sakin farm da deli gibi av da mümkündür, ama farm
güvenlik garantisi değildir. Alanda binalar ve yapılar, sık ve seyrek kaya kuşakları bulunur; oyuncu
bazen yönünü kaybedebilmelidir. Hız kontrolü, yavaşlama ve iniş iyi oturmalıdır. Uygulama: KG-T33.

#### KG-K24
**Görüntü kalitesi önce gelir; yükleme uzayabilir** (2026-10-08). Kenarlar tırtıklı, gökyüzü
bulanık olamaz. Gerekirse yükleme ekranı uzun tutulur ve bütün varlıklar uçuştan önce yüklenir.
Uygulama: KG-T37.

#### KG-K25
**Bu görevde TDD ertelendi** (2026-10-08). Sahip: "Önce istediğim şekilde yap, testleri MVP'den
sonra yazarız." Kurallar paketi için yazılan testler korunur ve yeşil kalır; istemci testleri MVP
onayından sonra yeniden yazılır. KG-K14 ile aynı kapsam sınırı geçerlidir.

#### KG-K26
**Turbo: daha hızlı, iki kat uzun, dolum aynı** (2026-10-09). Sahip: "Turbo biraz daha hızlı olmalı,
2 kat daha uzun sürmeli ama dolum süresi aynı kalmalı; ileri ivme hissini alamıyorum." Uygulama:
turbo artık gaz seviyesinden bağımsız olarak tam turbo hızına çıkar (eskiden %50 gazda turbo yalnız
96 m/s veriyordu, hissin kaybolma nedeni buydu), ivmesi sertleşti, şarj 6 sn, boştan dolum yine
7,5 sn. İstemcide his: kamera geride kalıp yetişir, görüş açılır, kenarlar hızla akar, toz çizgileri
uzar, alev turuncuya döner. Değerler [04 §13](04-savas-mekanikleri.md#baslangic-degerleri).
İkinci tur (sahip: "ivmelenme hissi yok"): ivme iki katına çıktı (60 → 216 ≈ 0,65 sn); kamera kolu ivmeye
bağlı bir yaydır, hızlanırken gemi kameradan kopar, hız oturunca kamera yetişir; turboda kameranın
hemen etrafında ikinci bir yoğun toz katmanı açılır.

#### KG-K27
**Özel deneme uçuşu ve his ayarları** (2026-10-20). Sahip:
- Canlıda yalnız arkadaşlarla özel deneme; herkese açılmaz. Admin paneline yazılan komutanlar
  menüde *Katıl* görür ([KG-T45](#kg-t45)).
- Denemede referans paketindeki model/doku/sesler kullanılabilir; yayından önce benzerleri
  sahip adına yaptırılır, değişen yalnız modeller olur.
- Döngü: tarlada toplanabilir cevher (tek/çoklu parça) ve kazılabilir yataklar (alaşım, kristal,
  döteryum); vurulan geminin ambarı saçılır; çıkış ambarı puana çevirir, pilot alana döner.
- Hızlı dönüşte titreme olmamalı; tampon "CS:GO gibi değil" diye gevşetilebilir, düzeltme ~200 ms'de
  erir ([KG-T43](#kg-t43), [KG-T44](#kg-t44)). Oda başına 8 pilot şimdilik yeterli.

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
MVP'nin güncel görsel hattı KG-T32'de. Ayrıntı: [06 §4](06-istemci.md#render). `frameloop="always"`: [KG-X10](#kg-x10).

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

#### KG-T31
**Yerel ortak MVP odası.** `ROLE=arena` ayrı süreç, `ARENA_DEV` guest oturumu, en çok 8 insan
ve 3 test botu. 30 Hz paylaşılan kurallar, 15 Hz snapshot; input buffer/sequence, tahmin ve
uzlaştırma, diğer pilotlarda gecikmeli aradeğerleme. İstemci isabet, kargo veya sonucu bildirmez.
Üretim hesabı/galaksi kimliği ve oda orkestrasyonu henüz bağlanmadı; prod dev araçları reddedilir.
Boş alana girişte test yükü yenilenir; gerçek ekonomi/ödül yazımı yoktur (F8–F9 kapsamı değil).

#### KG-T32
**APK görsel hattı ve render sunumu.** Seçilen native GLB/dokular; ayrı yüksek çözünürlüklü
gökyüzü ve küçük yansıma küpü; native atlaslarla GPU sprite instancing; ACES ve ölçülü bloom.
Tek canvas; açılışta 3B gemi; uçuşta ayrı namlu geçişi, yarı hızda arka kamera. Sesler kullanıcı
başlatma dokunuşunda decode edilir; native örnekler motor/ambiyans/olay katmanlarında, karşı
atışlar uzaklık/yöne göre çalınır. F7'de gerçek cihaz performans/his incelemesi gerekir.

#### KG-T33
**Alan v2: tohumlu düz disk.** `buildArenaLayout(ARENA_SEED)` (rules/arena/layout.ts) yalnız aritmetikle
her eşte aynı alanı üretir (KG-T11): merkez istasyon (sekizgen disk + kule), 4 çıkış kapısı (pist +
iki pilon), içi uçulabilir bölmeli 2 maden üssü, ikiye kırılmış ve altından geçilebilen enkaz, 3 röle;
3 sık kuşak (~125 kaya + 5 kristal), 5 dev kaya (her birinde iki kristal), ~245 seyrek kaya ve
açıkta 4 kristal. Girişler ve çıkış bölgeleri her zaman açıktır. Çarpıştırıcılar küre ve yalnız
dikey eksende dönen kutulardır; görsel model yapıyı giydirir, kutunun kendisi de çizilir ki pist
göründüğü yerde olsun. Geniş faz: `queryObstacles` sabit ızgara (100 m, CSR, tahsis yok).

#### KG-T34
**Nişan yardımı iki katmanlı.** (1) *Direksiyon mıknatısı:* istemci, ateş basılıyken önleme
noktası `assistCos` konisi ve `assistRange` içindeyse gemiyi ~0,25 sn'de hedefe çevirecek bir dönüş
komutu üretir; oyuncunun kendi çubuğu güçlendikçe zayıflar. Bu komut girdinin ayrı kanalıdır
(`assistX/Y`), ağda gider ve sunucu `assistMax`'a kırpar; tahmin aynı girdiyle aynı sonucu verir.
Hedef üzerindeyken çubuk %68'e yavaşlar (nişangâh sürtünmesi). (2) *Namlu gimbal'ı (sunucu):* görünür
(gizlenmemiş, duman arkasında olmayan) bir geminin önleme noktası burundan `gimbalCos` içinde ve
`gimbalRange` yakınında ise mermi oraya yönelir; dağılım yine uygulanır (isabet özelliği anlamını
korur). Sayılar [04 §13](04-savas-mekanikleri.md#baslangic-degerleri).

#### KG-T35
**İniş, sekme, kazı ve yavaş dönüş kuralları.** Toplam hız ≤ `landSpeed` iken maden yatağına temas iniştir;
kaya ve yapılara yalnız İN yaklaşmasıyla (girdi `land` biti) inilir (sahip 2026-10-21).
İnen gemi durur, gövdesini yüzey normaline hizalar, yalnız normal etrafında döner, ateş ve yetenek
kullanabilir. Gaz, inişten beri görülen en düşük değerin üstüne çıkınca kalkar; istemci inişte kolu
sıfırlar. Daha hızlı temas **sekmedir** (sahip, 2026-10-08): yüzeye dik yaklaşma hızı × `bounce` kadar
normal boyunca geri itme hızı eklenir ve `knockDecay` ile söner; ileri hız kafa kafaya çarpmada
`bounceLoss` oranında düşer, sıyırmada neredeyse korunur. Hasar yoktur (KG-T19 sürer). Kristale inen gemi
`mineRate` hızında kazar; kazı kalkanı kaldırır (kargo toplama sayılır, KG-K9). Gemi yavaşken
`slowTurnBonus` kadar daha dar döner. Testler: `packages/rules/test/arena/`.

#### KG-T36
**3. şahıs kamera ve gemi sunumu.** `render/camera.ts`: kol, geminin **gecikmeli** yönelimiyle arkada
asılır; kamera geminin **gerçek** burnunun önündeki noktaya bakar; hız ve turbo kolu yavaşça uzatır,
FOV açılır; sarsıntı "trauma" modelidir (hasar, sürtünme, öldürme); kol kayaya girmez. Gemi gövdesi
dönüşe yatar (yalnız görsel). Motor alevi kameraya yüzünü dönen bir şerittir: Subdivision'ın iz dokusu
geriye kayar ve dalgalı gürültüyle bükülür; beyaz-sıcak çekirdek, seyirde mavi, turboda kehribar-turuncu,
şok elmasları ve geriye savrulan kıvılcımlar. Gaza göre uzar.
Kendi gemide motor izi çizilmez (KG-X17); başka gemilerde iz zamana bağlı yaşlanıp söner. İnen
geminin görseli kayanın gerçek yüzeyine ışın atılarak oturtulur.

#### KG-T37
**Render hattı.** R3F yerine düz Three.js `WebGLRenderer` + kendi sabit adımlı sürücümüz (KG-T24 sürer).
Post: pmndrs `postprocessing`, **çok örnekli (MSAA) half-float** hedef, mipmap bloom, AgX ton eşleme,
vinyet, hasarda kromatik vuruş; galakside kullanılan sonlu değer koruması bloom girişini korur.
Piksel oranı en düşük kalite ayarı dışında 2'ye kadar. Kayalar model başına tek örneklenmiş çizim;
her karede CPU'da görüş konisi + mesafe kırpması yapılır (1,16 M → 50–310 bin üçgen). Gökyüzü 2048²
küp (Subdivision set 4), ışık için ayrı küçük küpten PMREM. Bütün shader'larda `pow` tabanları
kıstırılır: MSAA kenar örnekleri UV'yi aralık dışına taşır ve NaN siyah çizgi olarak görünür.

#### KG-T38
**Yükleme ve tanı.** Bütün varlıklar uçuştan önce gerçek ilerleme çubuğuyla yüklenir; ardından
`renderer.compileAsync` ile shader'lar derlenir (ilk atışta takılma olmaz). Dev'de ekranda tanı
paneli (`&diag` ya da sol alttaki "tanı"): hatalar, GPU/WebGL yetenekleri, yükleme süreleri, FPS,
çizim çağrısı ve üçgen sayısı.

#### KG-T39
**Protokol v2.** `ARENA_PROTOCOL = 2`; pilot `PILOT_WIDTH` = 47 sayı (iniş, normal, kalkış, temas,
sekme hızı `kx/ky/kz` ve kazı alanları eklendi; faz en sonda); anlık görüntüde kristal rezervleri ve
kuru bayrakları (`dry`: kristal yarıya dolana kadar kuru kalır, istemci bunu tahmin etmez); anlık görüntüde kristal rezervleri; girdi 7 sayı (nişan kanalı). Oyuncu
listesi botların rolünü taşır. Kendi atışların anında görünmesi için istemci tahmini mermi izleri
çizer (`ghosts`); bunlar hasar vermez, sunucunun kendi mermileri çizilmez.

#### KG-T40
**Botlar.** Üç rol: *avcı* (görünür insan pilotu önleme noktasıyla kovalar, aralıklı ateş eder, çok
hasar alınca dumanla kaçar), *madenci* (kristale yavaşça iner, kazar, saldırıya uğrayınca kaçar,
dolunca çıkışa gider; oyuncunun avı), *devriye* (kuşaklar arasında dolaşır, yakına gelene saldırır).
Hepsi ileriye bakıp kayadan kaçınır; görünmez/duman arkasındaki pilotu hedeflemez.

#### KG-T41
**İniş yardımı ve kontrol güvenlikleri.** *İn* tek dokunuştur. Nişangâha en yakın yüzey seçilir;
menzil 260 m ve canlı kristal önceliklidir. Seçilen yüzeyde iniş noktası halkası çizilir ve gemi
oraya yönelip mesafeye göre gazı düşürerek konar. Bu yalnız girdi üretir (`landing.ts`), dolayısıyla
sunucu ve tahmin aynı kalır. Çubuğun belirgin oynatılması (> 0,4) yardımı iptal eder. *Kalk* 0,165 sn
basılı tutma ister; gaz itmek de kalkıştır. Joystick tabanı dokunulan yerde açılır, ama sol alttaki
sabit bir bölgeye kıstırılır ve parmağı izlemez.

#### KG-T42
**Kontrol ve HUD güvenlikleri (2026-10-09 inceleme).**
- Turbo inişteyken kalkıştır (`world.ts`, `flight.ts`; test: `world.test.ts`).
- `controls.clear()` yalnız basılı olanı bırakır, gaz kolu yerinde kalır: menü, odak kaybı ve bağlantı
  kopması gemiyi durdurmaz.
- Sonuç ekranı yalnız canlıdan bitişe gerçek geçişte açılır.
- Uzaktaki pilotlar sıra ile değil id ile eşlenir (`network.ts`).
- Kilit sesi kilit kurulduğunda bir kez çalar; düşük yakıt uyarısı eşikte bir kez, sonra 20 sn'de bir.
- HUD notlarında öncelik: ambar dolu ve doğuş kalkanı "İnebilirsin"in önünde.
- Ekran dışı işaretler kendi geminin üstünde biter; bağlantı etiketi arka görüş çerçevesinde durur.
- Takip kamerası kutu yapıların duvarına girmez.
- Ekran uzayındaki her şey (nişangâh, önleme işareti, radar) kameranın izlediği **ara değerlenmiş**
  pozdan hesaplanır, 30 Hz simülasyon durumundan değil. Aksi hâlde dönüşte nişangâh tick karesi ile ara
  kare arasında ~23 px gidip gelir ve göz iki nişangâh görür (ölçüldü: 90 karede 84 yön değişimi → 0).
#### KG-T43
**Girdi oynatma saati.** Eski kuyruk her girdiyi kendi `due` tick'ine bağlıyordu; Wi-Fi'de >100 ms
takılmada kuyruk boşalıp nötre düşüyor, gemi dönüşün ortasında bir an düzleşiyordu. Şimdi ilk girdi
tampon kadar bekler, sonra saat gibi tick başına bir girdi çalınır (`playout.ts`); boşlukta son girdi
`inputRepeatMax` (9 tick = 300 ms) tekrar edilir. Ölçüm (300 ms takılma, 80 ms jitter): 6 düzeltme /
85°/s en büyük sıçrama → 1–2 / ~20°/s. 450 ms takılmalar hâlâ hissedilir (aşırı ağ).

#### KG-T44
**Düzeltme yumuşatma.** Uzlaştırma sonrası çizilen poz yerinde kalır: fark konum + kuaterniyon ofseti
olur ve üstel söner (τ = 67 ms, %95 ≈ 200 ms). Ara değer başlangıcı (`previous`) da aynı farkla
kaydırılır ki kare içi süreklilik bozulmasın. Simülasyon her zaman doğru durumdadır; yalnız görüntü
yumuşar. Test: `smoothing.test.ts`.

#### KG-T45
**Özel deneme erişimi ve referans paketi.**
- `arena_pilots` tablosu (migration 0196); admin `GET/POST /api/admin/arena-pilots`. Arena kimliği
  `pilot` bayrağını döner; `ARENA_PILOTS` (`*` veya ad listesi) geliştirme içindir.
- Paket depoda değil: üretimde `ARENA_REF_DIR` altındaki `dist/` ve `audio/`, yalnız oturmuş pilota
  `POST /arena/ref-session` ile verilen 6 saatlik HMAC çerezle (`/__ref`, HttpOnly, SameSite=Strict)
  servis edilir; her ret 404'tür, yol kaçışı realpath ile engellenir (`references.ts`).

#### KG-T46
**Telefon dostu sunum.**
- Cevher: türün renginde, koyu doygun, metalik yansımalı kristal kümesi + kenar parıltısı (AgX açık
  renkleri kâğıda çevirir). Kazılabilir kayalarda 6 damar; rezerv azaldıkça küçülür, kuruyken yok.
  Tür başına tek instanced çizim (`render/ore.ts`).
- Doğuş kalkanı gövdeyi kaplayan jöle değil, ince kenar ışığı + tarama çizgisidir.
- Çözünürlük regülatörü (`resolution.ts`): 2 sn ortalaması 48 fps altındaysa piksel oranı 0,25'lik
  adımlarla 1'e kadar iner; tutabilen cihaza dokunulmaz, geri çıkmaz (salınım olmasın).
- Anlık görüntü yuvarlama: 4 pilotlu dev odada 2744 → 1279 B (%53). Sıkıştırma (`perMessageDeflate`)
  bilinçli kapalı kalır.

---

## Açık sorular (KG-A)

Biçim: **Soru** · Öneri · Prototip varsayılanı (sahip cevaplayana kadar) · Ne zaman sorulur.
Sahip cevaplayınca madde KG-K'ye taşınır, buradan silinir.

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
Otomatik nişansız prototip (S72) — sahip MVP'den sonra hafif mıknatıs istedi (KG-K20). Space Commander'daki
cömert kilit ise hâlâ istenmez: yardım yalnız ateş ederken ve hedefe çok yakınken çalışır.

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

#### KG-X13
Three.js `Lensflare` — çerçeve tamponunu kopyalıyor; MSAA hedefinde GL hatası verip kareyi karartıyordu.
Yerine gökyüzünün ışık kaynağına uzak bir hale sprite'ı + bloom.

#### KG-X14
Doğuş kalkanı için gemiyi saran küre — 3. şahıs kamerada ekranın yarısını kaplıyordu. Yerine gövdeyi
saran fresnel enerji kabuğu.

#### KG-X15
Kayalarda tek parça örneklenmiş çizim ve GPU'nun kendi kırpması — örnekli ağ bütün kopyaları çizer;
kare başına 1,16 M üçgen. Yerine örnek başına CPU kırpması (KG-T37).

#### KG-X16
İnişi gaz seviyesine bağlamak (yalnız gaz ≤ %20 iken iniş) — %50 gazla yüzeye yavaş değen gemi inmeden
sürtünüp "dırr" sesiyle yüzeyi kazıyordu (sahip bildirdi). Yerine hız kuralı + sekme (KG-T35).

#### KG-X17
Kendi gemide motor izi — 3. şahıs kamerada iz kameraya doğru akıp ekranın altında projektör huzmesi
gibi görünüyordu. Kendi gemide yalnız alev; iz başka gemilerde.

#### KG-X18
Yalnız gaz seviyesi ayarlayan *İn* düğmesi — oyuncu dokunduktan sonra ne olacağını göremiyor, üst üste
basıp yanlışlıkla *Kalk*'a basıyordu. Yerine hedefli iniş yardımı ve basılı tutarak kalkış (KG-T41).

#### KG-X19
Hasarı gemi üstünde büyük, yanıp sönen tek kıvılcım sprite'ıyla göstermek — gövde düşükken burnun
önünde sürekli turuncu bir patlama gibi kaldı (sahip bildirdi). Yerine gövdeden ara ara kısa kıvılcım
çizikleri ve kritik gövdede ince duman izi (`ShipVisual.damage`).

#### KG-X20
Kuşak pusunu kameranın etrafında üst üste binen büyük bulut sprite'larıyla vermek — kuşağın içinde
her biri tam ekran dolum demekti, telefonda FPS düşüyordu (sahip bildirdi). Bulutlar kamera girmeden
söner; içerideki pus tek katmanlık bir küre ve post-process perdesidir. Sis rengini kuşak tonuna
kaydırmak da denendi: uzak kayalar karanlık gökyüzü önünde düz açık mavi siluetler oldu.

#### KG-X22
Motor alevini açık bir koniyle çizmek — keskin geometrik kenarı ve düz renk geçişiyle "basit, çocuksu"
göründü (sahip). Turbo ateşlemesinde motorların etrafında genişleyen halka da denendi, çizgi film gibi
durdu. Yerine dokulu alev şeridi ve yalnız bir ateşleme parlaması (KG-T36).

#### KG-X21
Kayaya çarpma için Metalstorm `snd-damaged` ve hasarda `self-damage` sesleri — ikisi de 7–9 sn'lik
bip dizileriydi ("dit dit dit", sahip bildirdi). Yerine 0,74 sn'lik Subdivision darbe sesi, kritik
gövdede tek uyarı; her tek seferlik ses bir süre tavanıyla kesilir (`audio.ts` `cut`).
