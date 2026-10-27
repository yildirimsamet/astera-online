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
15 saniyeden (sahip 2026-10-22; önce 60) **ilk gerçekleşen** kalkanı kaldırır. Sahip KG-A1 önerisini onayladı.

#### KG-K10
**Yakıt bitince kurtarma** (2026-10-08): gemi yavaşlayıp durur; **10 saniye savunmasız**
kurtarma bekler. Bu sürede yok edilirse yok edilme kuralları uygulanır. Sahip KG-A2 önerisini onayladı.

#### KG-K11
~~**Tek ortak döteryum deposu** (2026-10-08): uçuş ve mühimmat aynı depodan tüketilir;
her atış kaçış için kalan yakıtı da azaltır. Sahip KG-A3 önerisini onayladı.~~
**Yerine [KG-K29](#kg-k29)** (2026-10-21): yakıt ve mühimmat ayrı.

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

#### KG-K28
**Nişan çemberi; yön oyuncunun** (2026-10-21). Sahip: *"Aim assist aktifken geminin yönü düşmanı
takip etmeyecek; ortadaki alanın sınırına kadar crosshair hedefi takip edecek; yönü kullanıcı
ayarlamalı, hedefi o alan içinde kullanıcı tutmaya çalışmalı."* Subdivision benzeri, ondan küçük
bir çember (8,5°; ilk hâli 7°, sahip 2026-10-21: "birazcık daha büyüsün"). Hedefin gövdesi ya da ◇ önleme işareti çemberdeyken nişangâh ve mermiler önleme
noktasına kayar, çemberin kenarında durur; ikisi de çıkınca nişangâh merkeze döner. Gemiyi
çeviren mıknatıs ve çubuk sürtünmesi oyuncu için kalktı; botlar eskisi gibi. [KG-K20](#kg-k20)'yi
değiştirir. Uygulama: [KG-T47](#kg-t47).

#### KG-K29
**Can, kalkan, yakıt, mühimmat: dört ayrı şey** (2026-10-21). Sahip: *"can ayrı olmalı, kalkan ayrı
olmalı (skill ile gelen shield), yakıt ayrı olmalı, mühimmat ayrı olmalı."* [KG-K11](#kg-k11)'i
değiştirir.
- **Mühimmat:** uçuşa dolu şarjörle girilir (`ammoCapacity`, v1 480 mermi = 60 sn kesintisiz ateş),
  uçuşta dolmaz. Atış artık yakıt yemez; şarjör boşken ATEŞ kilitlenir. Botların deposu ve
  şarjörü hep dolu (yönetmezler).
- **Kalkan katmanı:** `shieldHp` / `shieldMax`, yetenekten gelir; hasar önce kalkandan düşer,
  artanı cana geçer; uçuşta kendiliğinden dolmaz. Kalkandaki hasar da hasardır (çıkış sayacını
  bozar). Doğuş kalkanı ayrı kuraldır (süre boyunca hiçbir şey geçmez). Kaynağı Y4 yetenekleri;
  bugün kimsede yok.
- **HUD:** can göstergesi altıgen + artı ikonu (kalkan ikonu artık yalnız kalkanın); kalkan,
  can göstergesinde kendi mavi çizgisi ve sayısıyla, yalnız varken görünür. Şarjör, harcandığı
  yerde: ATEŞ tuşunun halkası boşalır, altında kalan mermi; boşken "Boş" + bağlam notu.
- Protokol 4 (pilot 53 sayı: `ammo`, `shieldHp`, `shieldMax`; sınırlar doğrulanır).
- **Açık:** can, yakıt deposu ve şarjör kapasitesi sınıfa ve seviyeye bağlanacak (Y4,
  [14 §3](14-yarik-plani.md)); bugün herkes için sabit.

#### KG-K30
**Kargo mıknatısı** (2026-10-22). Sahip: *"tam olarak içinden geçmeden de biraz yakınından geçerken
de magnet gibi çekip toplanabilmeli (yanlışlıkla iki kişiye birden gitmesin, kim önce çekerse)."*
- Serbest parça, `magnetRadius` (50 m) içine giren ve parçayı **bütün** taşıyabilecek ilk uçan
  gemiye kilitlenir. Aynı tick'te iki gemi: yakın olan. Kilitli parçayı başkası alamaz.
- Parça çekene doğru uçar (geminin hızı + `magnetPull` 90 m/sn; turbodaki gemiye de yetişir) ve
  gövdeye değince ambara girer. Yoldaki parçalar ambardan düşülür; ambar asla taşmaz.
- Ambara bütün sığmayan parça çekilmez, yerinde bütün kalır. Eski "sığanı al, kalanı bırak"
  kalktı: kalanı başkası alırsa parça bölünmüş olurdu.
- Çeken uçmayı bırakırsa (ölüm, çıkış), çok uzaklaşırsa ya da ambarı başka yoldan dolarsa parça
  olduğu yerde durur ve yeniden serbest kalır.
- Kümeden geçen gemi kümenin tamamını çeker (`clusterRadius` 30 m < 50 m).
- Gizlenmiş gemi de çeker; uçan parça onu ele verebilir.

#### KG-K31
**Kaya ve yapı görüşü keser** (2026-10-22, sahip onayı: "Evet, kesilsin"; [15 §6](15-yarik-haritasi.md)).
- Kaya ya da yapı iki gemi arasındaki çizgiyi kesince hedef işareti, mesafe etiketi, kilit,
  silah yönlendirmesi (gimbal) ve radar noktası düşer; bot da o gemiyi hedef seçmez
  (`pilotInSight` = `pilotVisible` + `segmentObstacles`).
- Sunucu konumu göndermeye devam eder (`pilotVisible`): gemi çıkınca hemen çizilir.
- **Son görülen yer:** görüş kesilince köşeli işaret ve radar noktası geminin girdiği yerde
  kesik çizgili, soluk kalır ve `LAST_SEEN` (2 sn) içinde söner; can çubuğu gizlenir.
  Takipçi nereye girdiğini bilir, şimdi nerede olduğunu bilmez.
- Duman ve görünmezlik eskisi gibi anında gizler (son görülen yer bırakmaz).

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
sıfırlar. Daha hızlı temas **sekmedir** (sahip, 2026-10-08; açı ve hız kuralı 2026-10-21):
- Hızın yüzeye giren kısmı esneklik katsayısıyla geri seker. Katsayı çarpma hızıyla `bounceMin`'den
  `bounceMax`'a yükselir (`bounceHalf` m/s'de yarı yol). Yavaş temas hafif, sert çarpma güçlü seker;
  tavan aşılmaz.
- Yüzey boyunca kayan kısım sürtünmeyle yavaşlar (`scrapeFriction` × dik itki); hiçbir zaman ters dönmez.
- Gemi burnu dönmez: yeni hızın burun yönündeki kısmı ileri hız kalır, kalanı geri itmedir ve
  `knockDecay` ile söner.
- Sonuç: sıyırma kayarak geçer, 45° çarpma hızın yaklaşık yarısını alır, kafa kafaya çarpma ileri hızı
  sıfırlar. Kafa kafaya geri itme: 30 m/s → ~4 m, 120 m/s → ~23 m, turbo → ~45 m.
- Hasar yoktur (KG-T19 sürer).

Kristale inen gemi `mineRate` hızında kazar; kazı kalkanı kaldırır (kargo toplama sayılır, KG-K9). Gemi yavaşken
`slowTurnBonus` kadar daha dar döner. Testler: `packages/rules/test/arena/`.

#### KG-T36
**3. şahıs kamera ve gemi sunumu.** `render/camera.ts`: kol, geminin **gecikmeli** yönelimiyle arkada
asılır; kamera geminin **gerçek** burnunun önündeki noktaya bakar; hız ve turbo kolu yavaşça uzatır,
FOV açılır; sarsıntı "trauma" modelidir (hasar, sürtünme, öldürme); kol kayaya girmez. Gemi gövdesi
dönüşe yatar (yalnız görsel). Motor alevi kameraya yüzünü dönen bir şerittir: Subdivision'ın iz dokusu
geriye kayar ve dalgalı gürültüyle bükülür; beyaz-sıcak çekirdek, seyirde mavi, turboda kehribar-turuncu,
şok elmasları ve geriye savrulan kıvılcımlar. Gaza göre uzar. *(Alev 2026-10-22'de stüdyonun hacim
alevine geçti: KG-T50.)*
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

#### KG-T47
**Nişan çemberi kuralı** ([KG-K28](#kg-k28)). `circleAim`: hedefin gövdesi ya da önleme noktası
çemberin içinde, geminin önünde ve `aimRange` (900 m) içindeyse namlu önleme noktasına döner; önleme
noktası kenarın dışındaysa namlu kenarda durur (trigonometrisiz, KG-T11).
- **Çember ekranda görüldüğü gibidir** (sahip 2026-10-21: "yakın kapışmada assist yakalamıyor").
  Çember burnun `convergeDist` (350 m) önüne `aimCircleCos` (8,5°) ile çizilir, oyuncu onu arkadaki
  kameradan görür. Burundan çıkan bir koni yakın hedefte bu çizimle örtüşmüyordu: 60 m'de çemberin
  üst yarısındaki hedef koninin dışında kalıyordu. Kural artık kameranın gözünden (`aimEyeBack`
  34 m geri, `aimEyeUp` 7,2 m yukarı; `aimCone`) çizili çemberden geçen konidir. Ekranda içerideyse
  kuralda da içeridedir (40–700 m arası testli). Göz, kamera kolunun seyir hâlindeki yeridir; web
  testi ikisini birlikte tutar.
- **Mermi 2 kat hızlı** (sahip 2026-10-21: "◇ hedefin çok önünde kalıyor"): `muzzleSpeed` 600 → 1200
  m/s, `projectileLife` 1,5 → 0,75 sn; menzil 900 m'de kaldı. ◇ gövdeye yarı yarıya yaklaştı. Sunucu oyuncunun mermisini
böyle yönlendirir; botlar `gimbalCos` (3,5°) ve mıknatısla kalır. Diğer gemiler `aimHorizon` kadar
geriden çizilir (`interpDelay` + RTT + girdi tamponu, tick farkından ölçülür, en çok 0,6 sn;
KG-T16): ◇, HUD nişangâhı ve istemcinin kendi mermi izi hedefi bu kadar ileri taşıyarak hesaplar.
Ölçüm (300 m, 0,3 sn gecikme): eski mıknatıs düz geçen hedefe %0–5; çember düz %75, sert zikzak %40,
turbo %55 ([14 §11](14-yarik-plani.md)). 1200 m/s ile: düz %85, zikzak %65, turbo %55. Mermi havada
yarı süre kaldığı için zikzak artık daha az kurtarır; 600 m'de düz %40, zikzak %35.

#### KG-T48
**Çarpışma gövdeleri: görünen kaya, çarpılan kayadır** (Y2, [14 §8](14-yarik-plani.md)).
- **Katalog:** `tools/arena-colliders.mjs` her kaynağı sadeleştirir, ortalar, sınır yarıçapı 1'e
  ölçekler ve int16'ya nicemler. Çarpıştırıcı kataloğu (`catalog.generated.ts`, 11 şekil) ile
  çizilen GLB aynı köşelerden yazılır. Araç GLB'yi geri okur, 1e-6 m'den büyük farkta durur.
  Kristal; kaya ile altıgen kristallerin tek kapalı yüzeye birleşimidir (manifold-3d). Kristal
  üçgenleri `glowFrom`'dan başlar ve parlar.
- **Yerleşim v4:** alan kayası, dev kaya ve kristal = katalog şekli + konum + dönüş + ölçek.
  `obstacleSize` ortalama yarıçaptır. `radius` yalnız geniş faz için sınırlayıcı küredir. Dev
  kayalardaki kristal damarları gerçek yüzeye oturur, parıltısı dışa bakar.
- **Gemi:** gövde kapsülü (15 m, r 2,2) + kanat kapsülü (9 m, r 1). Kaya, yapı ve mermi bunlara
  çarpar; mermide `hitPad` 1,5 m. Model uyumu Y4'e kaldı (14 §8'de ölçüm).
- **İstemci:** her kaya kendi katalog modeliyle, çarpıştırıcının matrisiyle çizilir. Paket yoksa
  çarpıştırıcının kendisi çizilir. Manifest'te `colliders` + `unit` (yeniden ölçeklenmez). İnen gemi
  kapsülüyle oturur, çizimde ek kaydırma yoktur. Pusula, iniş hedefi, damarlar, kazı ve sıyırma
  kıvılcımı gerçek yüzeyi kullanır (`surfaceGap`, `closestSurface`).
- **Dev görünümü:** geliştirmede **C** tuşu çarpıştırıcıları tel kafes çizer. Kaya pembe, yapı
  sarı, gemi kapsülü yeşildir.
- **Ölçüm:** sunucu tick ortalaması ~0,2 ms, p99 1–2 ms (VPS, 8–31 bot). Masaüstünde kuşak
  görünümü ~600 bin üçgen; LOD Y3'te.

#### KG-T49
**Varlık hattı: sınıf gemileri, LOD, KTX2** (Y3, [14 §14.1](14-yarik-plani.md)).
- **Sınıf gemileri** (`tools/arena-ships.mjs`): Akıncı = Space Fighter (Comrade1280), Muhafız =
  Spaceship Concept (marum3s), Kılavuz = SpaceShip (JazOone); üçü de CC BY 4.0 (`CREDITS.md`,
  arena menüsünde "Emeği geçenler"). Burun +Z, boy 1, üç LOD düğümü (`lod0..2`), meshopt +
  nicemleme. Muhafız'ın dokusu yok: 24 bin üçgene indirilip xatlas ile açıldı, detayı tam modelden
  normal/AO/renk/ışıma haritalarına pişirildi. LOD sınırları 8 ve 25 gemi boyu, %10 tutma payı;
  geçiş 0,35 sn titreşimli çözülme (`render/detail.ts`). Eski hero/rival seti, sınıflar varken
  yüklenmez. Hangar seçene kadar pilot Akıncı uçar; botlar rollerine göre (avcı Akıncı, madenci
  Muhafız, devriye Kılavuz).
- **KTX2** (`tools/arena-ktx2.mjs`): renk haritaları ETC1S, normal/veri haritaları UASTC, gökyüzü
  tek UASTC küp (ETC1S soluk yıldızları siliyor, gezegen kenarını basamaklıyor). Efektler webp kalır.
  Webp manifestlerine dokunulmaz; istemci önce `manifest(-lite)-ktx2.json`'ı dener. Araç
  arena-ships ve arena-colliders'tan sonra koşar.
- **Ölçüm (GPU doku belleği, masaüstü tarayıcı, 2026-10-22):** lite paket 161 → 51,5 MB (iOS kapısı
  ≤ 120 MB); tam paket 621 → 183 MB. Masaüstü ETC1S'i BC7'ye (8 bit/piksel) açar; iPhone ETC2'ye
  (opak 4 bit/piksel), yani iOS'taki değer bundan düşüktür. İndirilen dönüştürülmüş dosyalar: lite
  7,5 → 16,2 MB, tam 20,8 → 53,1 MB (webp'ten büyük: KTX2 mip'leri ve blok verisini taşır).

#### KG-T50
**Motor alevi: stüdyonun hacim alevi** (sahip 2026-10-21: "solar ve cryo'yu kullanabilirsin").
`src/vfx/engineFlames.ts` (Codex/Blender reçeteleri) gemi başına tek `EngineFlameBatch` çizimiyle
kullanılır (`render/flames.ts`). Her nozulda seyir için Cryo (mavi-beyaz), turbo için Solar
(beyaz-sarı boğaz, turuncu kuyruk) vardır; turbo yanıp sönerken ikisi çapraz geçer, böylece
"turbo yakıyor" rengi korunur. Turbo alevi seyirdekinin iki katı uzar. Telefonda 8, masaüstünde 12
adım. KG-T36'daki şerit alev ve nozul çekirdek sprite'ları kaldırıldı.
Nozul yerleri ve çapları modelde ölçülür (`tools/arena-ships.mjs`: arkadan +Z yönünde ışın atılır,
üç dik görünümde işaretlenir) ve manifeste `engines` + `nozzle` olarak yazılır; alev o çapta çıkar.
Akıncı'nın alevleri kuyruk ucundan değil, yan gövdelerdeki yuvarlak nozullardan çıkar (sahip 2026-10-22).

#### KG-T51 — ERTELENDİ (24 Ekim, sahibin sonraki talimatı)

Aşağıdaki prototip uygulamadan geri alındı; [22](22-ilk-surum-mantigi.md) güncel kapsamdır.

**Y8: mevcut gövde üzerinde kademe/boya yüzeyi ve hesap kozmetiği** (2026-10-24).
1/5/10/15/20 kapıları ilerlemeden okunur; ayrı stat veya satın alınan seviye yoktur.
Birleşik sınıf modellerinin geometri/namlu/kapsülünü değiştirmeyen shader; uzakta tek
`aLook` instanced özniteliği, amblem için tek 1024×512 atlas. `COMMANDER` hesap yuvası
Standart/Helios/Nebula boyalarını; mevcut `ENGINE` yuvası alev/parıltı/iz seçimini taşır.
Klan liderinin doğrulanmış bayrağı kalkış yüküne dondurulur. Takım hazır denetimi boyayı
kapsar ve doğruladığı görünümü kalkışa aktarır. Sayısal paket/protokol 14 değişmez;
eski yükler standart görünür. Ayrı kanat/namlu/ek motor ve amiral silueti sanat önerisi
mevcut modellerde gerçekleştirilmiş sayılmaz. Kanıt ve sınırlar: [21](21-y8-gorunum.md).

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

#### KG-X23
Arka görüş penceresi (sahip, 2026-10-23) — sahneyi ikinci kamerayla yeniden çiziyordu: 320×120 ve
iki karede bir olmasına rağmen savaşta üçgenlerin %41'i (228k → 134k), çizim çağrılarının %27'si
(161 → 117). Ucuz ayna (yalnız gemiler + gökyüzü, en hafif LOD, 15 Hz) maliyeti tahminen ~%90
düşürür ama kayasız, yapısız bir ayna sahte durur; takipçiyi tehdit işaretleri ve hasar yönü
zaten gösteriyor. Kapalı kalır; dönerse 3D ayna değil, takipçi göstergesi olarak düşünülür.

#### KG-X24
Oda 100 pilot (sahip, 2026-10-23; "100'ü pek sık bulmayız ama buffer verdim") — `ARENA_SEATS`,
varsayılan 100, en çok `ARENA_MAX_SEATS` (120). 8 pilot sınırı kalktı. Gerektirdikleri:
istemci kadroyu 120 + bot satır kabul eder; kadro yarım saniyede bir birleşik gider; paylaşılan
satırlar (mermi, duman, çarpma, kargo, kristal) protokol 5 ile değişiklik olarak gider
(`17-paket-kucultme-plani.md`). Haritanın ölçüsü hâlâ 48 pilot (16-yarik-v6-plani.md).

#### KG-X25
Hız en çok 80 m/s, turbo 160 m/s (sahip, 2026-10-23: "gemiler fazla hızlı, vurmak çok zor; nişan
kutusu gemilerin çok önünde"). Önce 120 / 216. Üç sınıf gelince en hızlısı bu; yavaşlar altında
kalır. Gerektirdikleri: gaz çubuğunun iniş durağı 0,2 → 0,3 (iniş hızı 24 m/s kalır); Kalk'ın
0,33'ü durağa yapışmaz (iniş durağında inen gemi kalkamıyordu). Yakma hızları aynı: Kenar → Kalp →
çıkış yolculuğu deponun ~%20'si yerine ~%30'u. Zikzak artık az korur (zikzak atan gemiye isabet
%65 → %80, düz gidene %85); sahip bunu bilerek 80/160'ı seçti. Botlar zikzakçıyı 22,6 sn'de
öldürüyordu: nişan takibi `botTurnGain` 2,7 → 1,8 (düz 16,9 sn, zikzak 28,1 sn; önce 30 sn'de 240
hasar). 1,2 eski hâli birebir veriyordu ama botlar arası ateşi üçte birine düşürüyordu; tepki
süresi (hedefin hızını gecikmeli okumak) zikzak sonucunu değiştirmedi: sapma fiziksel, ~8 m → ~5 m.

#### KG-X26
Kademeli görünürlük ve toplu çizim (sahip, 2026-10-23: "800 m, 1,6 km, 2,4 km üçe ayıralım; en az
30, yapabilirsen 50 gemi"). Protokol 7: her pilota en yakın **50** gemi, 2,4 km'ye kadar, üç
dizide. `others` ≤ 800 m her anlık görüntüde (15 Hz); `mid` 800 m–1,6 km tam satır, her
`MID_EVERY` = 4 tickte (7,5 Hz); `far` 1,6–2,4 km uzak satır (konum, yön, hız, bayrak), her
`FAR_EVERY` = 6 tickte (5 Hz). Kademe değiştiren geminin satırı o tick gider; anahtar karede hepsi.
Sınırlarda ±50 m bant: sınırda gidip gelen gemi kademe değiştirmez. `interpDelay` 4 tick: orta
kademe gemisi hep iki örnek arasında ara değerlenir. İstemci gemiyi kendi kademesinin süresi kadar
görmezse siler. 50 pilotluk savaşta paket ort. 4,33 KB (protokol 6) → 3,19 KB.

Çizim (`ShipCrowd`): 800 m (±40 m bant) ötesindeki gövdeler en ucuz LOD'dan modele göre tek
instanced çizim; bütün motor parıltıları ve seyir ışıkları tek `Points`; bütün izler tek şerit;
bütün alevler tek `EngineFlameBatch` (toplamalı, sırası önemsiz). Seyir ışığı 700 m'ye, alev ve
iz 1,2 km'ye kadar; ekran dışındaki iz ne çizilir ne yüklenir, geçmişi akmaya devam eder. İsabetle
parlayan, kalkanlı veya gizlenen gemi kendi görselinde kalır: oyuncunun okuduğu şey mesafeyle
değişmez. S22, 30–39 gemi: kare 26,6 → 21,9 ms (~46 fps), çizim çağrısı ~220 → 92; 40–49 gemi
21,0 ms. Gövdeler neredeyse bedavaydı; maliyet efektlerdeydi (iz, alev, sprite). Web ve arena
**birlikte** deploy edilir (6 → 7).

#### KG-X27
Üç sınıfın seviye 1 değerleri (Y4a, sahip 2026-10-23: "bu tablo"). Planın (14 §3.1) oranları
bugünkü gemiye ölçeklendi: bugünkü gemi Kılavuz, Akıncı KG-X25 tavanında. Akıncı 80/160 m/s, 82°/sn,
gövde 340, 13 × 9/sn, 1,3°, yakıt 220, ambar 70, şarjör 540 · Kılavuz 72/144, 72°/sn, 400, 10 × 8,
1,5°, 250, 100, 480 · Muhafız 60/120, 58°/sn, 600, 18 × 5,5, 1,8°, 280, 160, 330. %60 isabette ayna
TTK: 4,8 / 8,3 / 10,1 sn. Mermi hızı ve menzil herkeste aynı (1200 m/s, 900 m). Hasar mermiye ateşte
yazılır: ateş eden ölse ya da çıksa da mermi kendi hasarıyla vurur. Sınıf `hello` ile seçilir, bir
sonraki uçuşta geçer (protokol 8). Sezonluk kilit ve 24 saatlik değişim hakkı kalıcılıkla gelir (Y6);
deneme uçuşunda her girişte seçilir. Botlar rolünün gemisinde: avcı Akıncı, madenci Muhafız, devriye
Kılavuz. Avcının vuruşu 80/sn'den 117/sn'ye çıktı: düz uçan Kılavuz 16,9 → 12,3 sn'de, zikzakçı
28,1 → 18,8 sn'de düşüyor (aynı takip, kısalan süre hasardan). Yakıt saniye başına aynı yanar; Muhafız
daha yavaş ama deposu büyük: Kenar → Kalp → çıkış tam gazda depo payı Akıncı %35, Kılavuz %34,
Muhafız %36.

#### KG-X28
Her sınıf kendi modeline oturan kapsüllerle çarpışır ve vurulur (Y4b, 2026-10-23). Bir gövde
kapsülü + iki ayna çift; model 15 m'de LOD0 yüzeyinden her 0,15 m'de örneklenir, hiçbir nokta
kapsüllerin 0,5 m'den fazla dışında kalmaz (`tools/arena-hulls.mjs check`: Akıncı 0,456, Muhafız
0,451, Kılavuz 0,457 m). Kaya, yapı, mermi ve sıyırma kıvılcımı aynı kapsülleri kullanır. Sonuç:
Kılavuz'un ileri açılı kanatları 8,9 m'ye uzanır, en geniş hedef odur; Akıncı en dar (4,2 m),
Muhafız arkada geniş motor bloğuyla 4,8 m. Genel kapsül (`ARENA_TUNING`) yalnız sınıfsız testlerde
kalır. Her mermi önce geminin tüm kapsüllerini saran tek küreyle elenir.

#### KG-X29
A ve B yuvaları (Y4c, sahip, 2026-10-23). Sağ başparmakta dört düğme: ATEŞ, TURBO, A, B.
- **A, sınıfa sabit imza.** Akıncı: güdümlü füze. Kilit kendiliğinden kurulur: düşman nişan
  çemberinde ve görüşte 1 sn kalır. Kilit tutunca A füzeyi atar (260 m/s, 60°/sn dönüş, 80 hasar,
  bekleme 14 sn). Muhafız: kalkan. 80 hasar emer, 20 sn sürer; kıran vuruşun artanı gövdeye
  geçmez (bekleme 22 sn). Kılavuz: 4 sn'de 120 gövde onarım, kendine de 120; ateş altında yarı
  hızda (bekleme 20 sn). Kalkan ve onarım hedeflidir: A'ya bas ve dosta dokun; kendine atmak için
  A'ya çift dokun (300 ms). Hedef bekleme 3 sn sürer. Arenada klanlar gelene dek dost yoktur;
  mekanik hazırdır, şimdilik yalnız kendine gider. Bekleme yalnız yetenek gerçekten çıkınca başlar.
- **B, hangarda seçilen tek taktik:** Duman veya Gizlen. Uçuşta yalnız seçilen düğme görünür.
  İllüzyon ve Radar Y4d'de gelir.
- **Bilgi:** kilitlenen pilot uyarılır: "Kilit alınıyor" → "Kilitlendin" → "Füze geliyor".
  Uyarının yanında ne yapacağı yazar. Ekranda kaynağı gösteren bir halka, ekran dışındaysa
  kenarda bir rozet çıkar. Kilitleyen, hedefin çevresinde kapanan bir elmas görür; kilit
  tutunca elmas kırmızı yanar. Füze; dumana giren, gizlenen veya ölen hedefi kaybeder ve
  dümdüz uçar. Kaya füzeyi durdurur.
- **Görünüm:** başkasının kalkanı, geminin çevresinde altıgen örgülü bir balondur. Kendi kalkanın
  gövdeyi saran kaplamadır: takip kamerasında balon ekranın alt yarısını kaplıyordu. Kalkana
  gelen mermi kalkan kıvılcımı çıkarır. Onarım gövdeyi yeşil kaplar, gövdeden yeşil zerreler
  saçılır.

#### KG-X30
B yuvasının son iki taktiği (Y4d, 2026-10-23; plan §4 önerisi uygulandı). Hangarda artık dört
seçenek var: Duman, Gizlen, İllüzyon, Tarama. Klavyede Q ve E, uçuşun taktiğine basar.
- **İllüzyon (6 sn, bekleme 20 sn):** kopya geminin tam içinde doğar. Pilotun yön girdisinin tam
  tersini yapar (sağ↔sol ve yukarı↔aşağı); gaz, turbo ve tetik aynıdır. Gemi döndükçe ikisi
  ayrılır. 2026-10-24: kopya kendi fiziğiyle uçmaz; her tick pilotun, atıldığı doğrultuya göre
  tam aynasına konur, böylece hiç sapmaz. Pilot ateş ettikçe ateş eder. Kayaya ya da alan sınırına
  giren kopya hologram gibi kırılır. Sahibi kopyayı kendi geminden çizer. Kopyanın mermileri boştur. Kopya çeyrek gövde hasar alınca, süresi bitince, pilotu
  ölünce ya da yeniden uçunca hologram gibi kırılır: enkaz, ganimet, öldürme sayılmaz.
  Düşman kopyayı kilitleyebilir; pilotu kilitleyemez. Kopya kazmaz, kargo çekmez, çıkış yapmaz.
- **Görünüm:** düşman kopyayı sıradan bir gemi olarak görür. Aynı ad ve sınıfla görünür; uzaktan
  çizilen satırı da gerçek bir geminin satırıyla aynıdır. Kopyanın sahibi onu camgöbeği bir
  hologram olarak görür, kendi düşman işaretlerinde göremez. **Radar gerçeği gösterir:** kopya
  radar ekranına nokta düşmez. Sıralamada yer almaz, pilot sayısına katılmaz.
- **Tarama (3 sn, bekleme 30 sn):** alandaki her düşman işaretlenir: menzil dışındakiler, kaya
  arkasındakiler, tozun içindekiler de. Görünmezler ve kopyalar işaretlenmez. Sunucu taranan
  gemileri görüş ve menzil sınırı olmadan gönderir. İşaret düşmanın çevresinde camgöbeği bir
  sonar halkasıdır; ekran dışındaysa kenar oku camgöbeği olur. Radar ekranında nokta kenarda,
  halkalı durur. Taranan pilot "Tarandın" uyarısını alır, taramanın geldiği yönü görür.
  Tarama uyarısı en düşük önceliktir: kilit ve füze uyarısı onu her zaman bastırır.

#### KG-X31
Y6a: gerçek gemi ve gerçek kargo (2026-10-23, sahibin kararları). Seviye, XP ve rütbeler Y6b'de.
- **Giriş:** Komuta Çekirdeği 9. Bu sezon, koltuklu pilotlarla (KG-A17). Altında Solo uçuş açık.
- **Gemi:** komutan sezon için bir sınıf seçer. Seçimden sonraki 24 saatte bir kez ücretsiz
  değiştirebilir; gemi havadayken ya da ambarında kargo varken değişmez.
- **Ambar:** ham kaynaktır, 1:1 başkente gider. Tek ortak toplam, istenen karışım (yalnız döteryum
  da olur): Akıncı 300 · Kılavuz 400 · Muhafız 500.
- **Doldurma:** her kalkışta depo ve şarjör başkentin döteryumuyla tamamlanır; yalnız eksik
  ödenir. Tam depo 30/40/50 D, tam şarjör 15/22/30 D (Akıncı/Kılavuz/Muhafız). Bilerek pahalı:
  "sabahtan akşama yalnız bu mod oynanmasın; ölmenin cezası olsun".
- **Herkese açılış (sahip 2026-10-27):** Yarık her komutana açık (`ARENA_PILOTS='*'`), amiral eskortu canlı
  sezonlarda `season activate-admiral` ile açık. Gerçek uçuş odasında ev botu yok ("botları kapat";
  `ARENA_BOTS`, varsayılan 0, en çok 3). Antrenmanda 20 bot uçar, roller sırayla (`ARENA_TUNING.practiceBots`).
- **Gövde +%50 (sahip 2026-10-27, "gemiler biraz çabuk ölüyor"):** Akıncı 510, Kılavuz 600, Muhafız 900
  (340/400/600 idi); seviye büyümesi aynı oranla üstüne biner. Protokol 15: eski sayfa yenilenir.
- **Masaüstü (sahip 2026-10-27):** fare yön verir (pointer lock: gökyüzüne tık alır, Esc bırakır), sol tık
  ateş, Q yetenek (A), E taktik (B), Shift turbo, M harita, Tab basılıyken sıralama ve tuşlar. V kalktı.
  Masaüstünde joystick gizli, her tuş kendi tuşunu yazar. İkinci tur (aynı gün): fare kalkış tıklamasıyla
  kendiliğinden alınır (menüden dönüşte de); fare yerinde kalan bir joysticktir — durunca dönüş sürer,
  ortadaki %6'lık bölgeye dönünce düzleşir (`MOUSE_RADIUS` 240 px, `MOUSE_DEADZONE`). Ping çarkı masaüstünde
  yalnız orta tuşla açılır: basılı tut, yöne it, bırak.
- **Kalkan/onarım hedefi (sahip 2026-10-27, "basıyorum çalışmıyor diyorlar"):** odada dost yoksa basınca
  doğrudan pilota gider. Dost varsa tuşun yanında "Kalkan kime?" tepsisi açılır: önce Sen, sonra en yakın
  dostlar gövde çubuklarıyla; dokunarak ya da masaüstünde 1–5 ile seçilir, 6 sn bekler. Hızlı çift dokunuş
  kendine olarak kalır.
- **Ambar sayıları (sahip 2026-10-27):** ambar göstergesinin altında her kaynağın kendi renginde sayısı.
- **Kalkış planı (sahip 2026-10-27, "kısmi dolum ekle"):** oyuncu hangarın Kalkış sekmesinde depoyu
  %25/50/75/100, şarjörü %0/25/50/75/100 seçer; kalkış her parçayı yalnız o seviyeye tamamlar ve
  yalnız o eksiği öder. Planın üstünde gemide kalan yakıt/mermi kalır, geri satılmaz. %0 cephane:
  ateş edilemez, yalnız maden. Plan gemide saklanır (`arena_ships.fuel_plan/ammo_plan`, varsayılan
  100/100); `POST /arena/loadout` yalnız bu adımları kabul eder (`LOADOUT`, `loadoutPlan`).
- **Günlük tavan:** her kaynaktan günde en çok başkentin kendi 4 saatlik üretimi (UTC günü).
  Tavanı aşan kısım yatmaz; sonuç ekranı bunu ayrıca söyler.
- **Ölüm:** ambar enkaza düşer, 60 dk bedava tamir. Her uçuştan sonra 10 dk bakım.
- **Kapanış/çökme (KG-A15):** kargo ambarda kalır, tamir ya da bakım işlemez.
- **Sezon sonu (KG-A16):** bitişe 10 dk kala giriş kapanır. Dondurmadan sonra gelen kargo kaybolur.
- **Saha karışımı:** döteryum daha seyrek ve derinde kalır; mevcut karışım korunur.
- **Ekran:** hangar kartı durumu (hazır/tamirde/bakımda), bugün başkente gidebilecek miktarı ve
  yenilenme saatini gösterir. Kurallar bir dokunuş derindedir. Doldurma bedeli ve başkentteki
  döteryum, bedeli ödeyen düğmenin üstündedir. Uçuşta ambar göstergesi toplam/kapasitedir;
  çubuğun renkleri kaynaklara böler.
- **Bilinen sınır:** sunucu sert çökerse o uçuşta toplanan kargo kaybolur; ambar kalkıştaki
  hâline döner.

#### KG-X32
Y6b: geminin seviyesi (2026-10-23, sahibin kararları). Rütbe, puan ve sınıf yakınlığı Y6c'de;
ödemeli tamir Y6d'de.
- **Seviye:** 1–20, sezonluk. Tavan min(20, Komuta Çekirdeği). Tavandaki gemi XP almaz;
  Çekirdek büyüyünce gemi yeniden büyür.
- **XP:** başkente çıkan 10 kaynak (hangi tür olursa) = 1 XP. Düşürülen pilot 40, son 10 sn'de
  vuruşla yardım 15, her uçuş 10. Ölen ya da çekilen uçuş %40'ını tutar. Geri çağrılan uçuş
  dövüşlerini tutar; ambarda kalan kargo, çıkarıldığı uçuşta XP olur. Deneme uçuşu XP vermez.
  Botlar XP vermez (canlıda kapanacaklar).
- **Dolu çubuk:** XP birikmez. Seviye "Yükselt" ile alınır: alaşım 150·sv + kristal 75·sv
  (Yarık Özü gelene dek yalnız bunlar). Gemi havadayken yükseltilmez.
- **Büyüme:** §3.2 oranları seviye 20'de, arada doğrusal. Hız yavaş büyür: en hızlı gemi
  (Akıncı) 20'de 120 m/s. Dönüş, ateş temposu ve şarjör sınıfın kendisi kalır. Sınıf değişince
  seviye ve XP korunur.

#### KG-X33
Hangar (2026-10-23, sahibin kararı): gemiyle ilgili bütün işler ana menüdeki **Komutan gemisi**
sekmesinde yapılır.
- Sekme, sahibin verdiği hangar modelinde (`assets/source/models/hangar/`) duran gemiyi gösterir.
  Yatay sürükleme gemiyi pistte 360° çevirir, bırakınca ataletle yavaşlar. Boşta kendiliğinden
  yavaşça döner. İki parmak yakınlaştırır. Dikey dokunuş sayfayı kaydırır. Kamera hangar
  kapısının önünde kalır, duvara girmez.
- Hangarda: ilk sınıf seçimi (seçmeden önce üç sınıf da hangarda görünür), 24 saatlik ücretsiz
  değişiklik, seviye ve Yükselt, tamir/bakım sayacı, bugünkü başkent tavanı.
- Sayfanın ayağındaki düğme o anın tek işidir: gemi yoksa "seç", varsa "Yarık'a gir". Uçamayan
  gemi Yarık'ı antrenman için açık tutar ve nedenini söyler.
- Görünüm Gözlemevi dilindedir (sahip: "Neon = Premium mu?"). Parlama yok; turkuaz yalnız seviye
  çubuğu ve tek birincil düğmede. Bölümler ince çizgili başlıklarla ayrılır: Seviye, Bugün
  başkente gidebilir, Sınıf, Değerler, Kurallar (bir dokunuşla açılır). Sınıf sekmeleri yalnız ilk
  seçimde ve ücretsiz değişim süresince görünür. Gemi durumu sahnenin köşesindedir (Hazır ya da
  Tamirde · süre). Hatalar kırmızı değil, düz notla söylenir.
- Yarık'ın kendi ön ekranında yalnız taktik, solo/ortak alan ve kalkış kalır. Gerçek uçuştan
  sonra "Hangara dön" bu sekmeye döner.
- Maliyet: hangar 115 bin üçgen ve 1024 webp dokuyla tek çizim (ana kaynak 956 bin). Boşta
  30 fps, el üstündeyken 60 fps. Işık şeritleri kendi renginden parlar; gölge ve motor ışıkları
  sprite'tır.

#### KG-X34
Y6c (2026-10-24). Sahip: **"Radar kendi seviyesinde başlasın; her yetenek ayrı gelişsin."**
- İmza, turbo ve dört taktik ayrı puan kaydı tutar. Bir taktiğe harcanan puan diğerine geçmez.
- Seviye 1'de sıfır puan; sonraki her seviyede bir puan. Bir puan bir rütbe alır, üst sınır 5.
  Sınıf yakınlığı (Akıncı–İllüzyon, Muhafız–Duman, Kılavuz–Radar) ücretsiz +1 rütbedir;
  sınırı aşmaz, puan tüketmez. İlk 24 saatteki sınıf değişimi tüm harcanmış puanları iade eder.
- Küçük adımların ilk uygulama ayarı (plan §4 önerisi): her ek rütbe imza gücünü %10,
  taktik süresini %10 büyütür; beklemeyi %5 kısaltır. Turbo süresi %10 büyür, dolum süresi %5
  kısalır; **hız artmaz**. İmzanın süresi, füze kilidi/hızı ve dumanın görüş kuralı değişmez.
- Hangar her yeteneğin mevcut → sonraki etki ve süresini, rütbesini, kalan puanı gösterir.
  Puan ve rütbe sunucuda kilitli işlemle yazılır; uçarken değiştirilmez.
- Etkin üç rütbe kalkışta sabitlenir ve yalnız pilotun kendi satırında taşınır (protokol 13).
  İstemci tahmini ve HUD sayaçları aynı değerleri okur. DB göçü: `0199_arena_ability_points`.
- **Sahip kararı (24 Ekim, “Tamam olur”):** Öz şartı korunur. Öz sistemi gelene kadar
  puanla en çok etkin rütbe 3 alınır; ücretsiz sınıf yakınlığı da bu sınıra dahildir.
  Rütbe 4–5 kapalıdır. Sunucu fazladan puan harcatmaz, hangar kilidi ve nedenini gösterir.
  Birikmiş puanlar diğer yeteneklere ayrılabilir veya saklanır.

#### KG-X35
Y6d (2026-10-24), 14 §7.4'teki ödemeli tamir uygulandı. Bedava 60 dakika korunur.
- Bedel: alaşım `150 + 25·sv`, kristal `50 + 10·sv`. Ödemeden sonra bekleme:
  `15 + round(15·(sv−1)/19)` dakika. Tamir anında bitmez; ayrıca bakım eklenmez.
- Yalnız aktif tamir kısaltılır. Yeni bekleme kalan süreden kısa değilse ücret alınmaz.
  Eşzamanlı ve tekrarlı ödeme aynı kilitli sayaçla reddedilir.
- Hangar ücretsiz kalan süreyi, ödemeden sonraki beklemeyi ve bedeli birlikte gösterir.
  `POST /arena/repair` süre/bedel kabul etmez; onları sunucu hesaplar. Yeni DB alanı yoktur.

#### KG-X36
Y7 (2026-10-24): klan takım lobisi, tek işlemde toplu kalkış, kalıcı ortak ganimet,
klan dostluğu ve yaşayan takım arkadaşının kamerasından izleme uygulandı.
- Sahip iki açık ayrıntıyı birlikte onayladı: bölünemeyen kaynaklar en yüksek değerli
  ganimeti çıkarana; alınmayan pay 7 gün sonra otomatik başkente. Eşitlikte sabit oyuncu
  kimliği sırası kullanılır. Günlük Yarık aktarım tavanı ve kişisel XP korunur.
- Klan sayfası hazırlığa götürür; hazır olma/kalkış, oyun yüklendikten sonra açılır.
  Liderin de kalkış kadrosunda bulunması gerekir. Kalkıştan sonra kadro ve taktik sabittir.
- DB `0200_arena_teams`, protokol 14. Ayrılan/atılan üyenin başlamış maçtaki payı korunur.
  Tek kişilik takım solo gibi işler. Ayrıntılar ve son kontroller: [20](20-y7-takim.md).
