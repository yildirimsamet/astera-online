# İlk sürüm · mantık işleri ve kapsam kararı

24 Ekim 2026 · sahibin son talimatı önceki öneri ve kabul tablolarının üstündedir.

## İlk sürümde yapılacaklar

1. Takım ortak kalkışta aynı giriş ağzından doğar. Araya solo veya başka takım girmesi
   takımı ayıramaz. Eşleşme kimliği yalnız sunucunun doğruladığı kalkıştan gelir.
2. Amiral: komutan gemisi filo görevlerine eşlik eder; sınıf bonusu, görev XP'si,
   görev/Yarık karşılıklı kilidi ve dönüş durumu. Plan §13'ün yeni sezon ruleset kapısı
   korunur; devam eden sezonun savaş kuralı sessizce değiştirilmez.
3. Gemi tamir/bakım sonrası hazır olduğunda bildirim; kendi başkentinin yanında park görünümü.

## İlk sürümden çıkarılanlar

- Geçici çıkış yarıkları ve acil sıçrama: **şimdilik kaldırıldı**; ilk sürüm kabulü değildir.
  Mevcut v6 haritanın dört sabit çıkışı ve 3 saniye hasarsız durma/iniş kuralı korunur.
- Kalp olayı: **ertelendi**, ilk sürüm kabulünden çıkarıldı.
- Yarık Özü: üretim/taşıma/saçılma/takım paylaşımı/harcama **ertelendi**, ilk sürüm kabulü
  değildir. Yüksek seviyeye Öz bedeli eklenmez. Önceki sahip kararıyla yetenek rütbe tavanı
  etkin 3 kalır; 4–5 ilk sürümde açılmaz.
- Skin/kostüm, boya/motor/amblem seçimi ve modüler görsel kademe çalışması **ertelendi**.
  Y8 ekleri uygulama yolundan çıkarılır. Mevcut ana oyunun kozmetik mağazası korunur.
  Prototip yerel `.dev/arena/2026-10-24-logic/skins-backup/` içinde saklanır; bu snapshot
  yeni özellikleri yeniden etkinleştirme yetkisi değildir.

## İnceleme artıkları (2026-10-25)

| İş | Durum |
|---|---|
| Yetenek sayacı "1/5" | ✓ `rütbe/3` (`MAX_POINT_RANK`); tavanda Öz notu kalır (`hangar-panel` testi) |
| Girişte "şu an N pilot" + tahmini uçuş | ✓ `/arena/hangar` `live.pilots` (botlar sayılmaz, `sortie` testi); düğme üstünde "Yarık'ta şu an N pilot · tam gazla ~X dk uçuş" (sınıf+seviye deposu, tam gaz = en kısa uçuş) |
| Pay almadan önce taşma uyarısı | ✓ günlük sınırın dışında kalacak kısım + sıfırlanma saati (`team-panel` testi) |
| Sonuç ekranında "Ne oldu?" + kendi pay | ✓ uçuşun bittiği an okunur: vuranın adı, sınıfı, mesafesi (görüş dışındaysa mesafe yazılmaz) / yakıt bitti / bağlantı koptu / sunucu durdurdu; takım uçuşunda havuza katılan yük; geri çağrılan ambar "düştü" sayılmaz (`debrief`, `hangar` testleri) |
| Takım payı hazır bildirimi | ✓ `arena_team_share`: son uçuş bitince payı boş olmayan her üyeye bir kez, hangara götürür; sezon kapanışı payları kendisi yatırdığı için bildirim yok (`arena-teams`, `ready-news`, 6 dil) |
| S22 FPS, TTK, 100 pilot kabulü | bekliyor (cihaz gerekir) |

## Test sırası

- Skin iptali: katalog artık COMMANDER/arena-* sunmaz; hangar seviye, puan, tamir ve gerçek
  uçuş işlerini tutarken görünüm seçimi çıkar. Önce kırmızı görüldü; kurallar ve 63 ilgili
  istemci testi yeşile döndü.
- Ortak giriş: geciken takım arkadaşı, araya giren solo/başka eşleşme, sahte istemci takım
  kimliği, bağlantı tekrarı ve bağlantı penceresinin sınırı testlenir. Önce FAIL; 18 oda ve
  giriş testi uygulama sonrası geçti. Genel regresyon/tip/lint kabulü ayrıca yapılacak.
- Amiral ve bildirim/park davranışı ayrı saf kural, işlem/API, eşzamanlılık, olay tekrarı,
  eski/yeni sezon kapısı, istemci ve gerçek tarayıcı testleriyle tamamlanacak.

## Amiral dönüş kuralı — KARAR

Sahip öneriyi onayladı: eşlik ettiği filo tamamen kaybedilirse **60 dk tamir**; diğer
dönüşlerde **10 dk bakım**. Komutan gemisi kalıcı olarak yok olmaz. Önceki açık soru kapandı.

## Amiral kuralları — KARAR (sahip, 2026-10-25)

- **Savunma:** amiral yalnız gönderilen filoya eşlik eder: baskın, korsan, anıt ve klan savunma
  destek dalgası. Başkentte park eden gemi kendi gezegenini savunmaz, bonus vermez.
- **Görev XP'si:** savaşın büyüklüğüne göre: iki tarafın kaybettiği gemi değeriyle orantılı,
  görev başına tavanlı. Savaşsız görev küçük sabit XP verir. Saatlik getiri Yarık'tan düşük kalır.
  (Yukarıdaki taslaktaki "15 + 15, savaşsız 5" bunun yerine geçer.)
- **Görünürlük:** rakip amirali görür: savaş raporu ve gelen filo radar uyarısı sınıfı ve
  seviyeyi yazar ("Amiral: Akıncı Sv 7"). Bu yeni bir istihbarattır.
- **Muhafız:** dayanıklılık bonusu gövdeyi **ve** gemi kalkanını büyütür (kodun mevcut hâli).

## Amiral savaşmaz — KARAR (sahip, 2026-10-25, yukarıdaki dönüş kuralını günceller)

Sahibin sözü: "savaşa filo ile gitsin ama ateş etmesin, hasar yemesin, sadece buff versin ...
tamir logic'i bir nevi ceza gibi."
- Amiral savaş birimi **değildir**: ateş etmez, hedef olmaz, hasar almaz, kayıp listesine
  girmez. Yalnız sınıf bonusunu filoya uygular. Savaş kodunda ayrı amiral mantığı yoktur.
- **Saldırı:** filo savaşı kaybederse amiral eve döner ve **tamire** girer. Diğer dönüşlerde
  10 dk bakım. (Yorumum: "kaybetmek" = saldıranın yenilgisi; sahip aksini söylerse değişir.)
- **Savunma (klan destek dalgası):** buff verir, saldırmaz, hasar almaz. **Kesin yenilgide**
  dönünce tamire girer.
- **Anıt:** savaşa eşlik eder. Kazanılırsa filo anıta girer, **amiral eve döner** (tutma
  kapasitesinde yer kaplamaz). Kaybedilirse zaten döner (tamir).
- **Bütün filo yok olursa** amiral tek başına eve döner (tamir).
- Galakside amiral **filonun en arkasından** gelir.
- Tamir süresi: 60 dk (önceki KARAR).


## Devam için uygulama taslağı (henüz kod sayılmaz)

- Amiral, gerçek filo çıkışında isteğe bağlı seçilir; yeni sezon ruleset kapısı 19 önerisi
  mevcut 18'i değiştirmeden yeni sezon varsayılanına eklenir. Eski sezonda seçimsiz eski
  davranış aynen kalır. Sınıf bonusu plan §13: Akıncı %2→5 hasar, Muhafız %2→5 gövde,
  Kılavuz %3→6 süre / %5→10 yakıt indirimi; XP savaş 15 + kazanırsa 15, savaşsız 5.
- Pure bonuslar rules'ta olacak; araştırma TechLevels'e sokulmaz (araştırma %25 tavanıyla
  karışmamalı). CombatSide hullMult eklenebilir; mevcut damageMult bileşimi korunur.
- Tek `arena_admirals` görev kaydı + native uçuşlara işaret eden `arena_admiral_legs`
  düşünüldü; böylece bütün görev tablolarına birbirinden bağımsız güç kopyaları yazılmaz.
  Sınıf/seviye çıkışta dondurulur. Native dönüş/çatallanma bacakları aynı görevi taşır.
- Amiralin gemi kilidi filo tarafında gezegen kilidinden sonra alınacaksa NOWAIT/SKIP LOCKED
  ile beklememeli; arena'nın sezon→gemi→başkent sırasıyla deadlock oluşturmamalı.
- Destek/ortak savaş/monument parçalanan dönüşler, korsan/maden/ticaret/konvoy/sinyal ve
  oyuncu baskını/transfer/koloni yolları unutulmamalı. Probe/stratejik mühimmat normal
  filo değildir. Yardımcılar false seçimde eski yola ek sorgu/güç uygulamamalı.
- Gemi hazır bildirimi: DB'de generation UUID + deadline, idempotent worker olayı.
  Ödemeli tamir eski olayı geçersiz kılar; tekrar, yeni sortie, sezon kapanışı ve geç
  worker koşusu yanlış/çift bildirim üretmemeli. Bildirim yalnız haber; gerçek hazır
  durumu worker'a bağlı kalmadan sunucu saatiyle hesaplanmaya devam etmeli.
- Park görünümü: yalnız kendi başkentinde, görevde/Yarık'ta değilken. Tek gerçek gemi
  durumu backend'den gelmeli; istemci saat/yer bilgisiyle yeni bir güç/konum uydurmamalı.
- Yerel sunucular (eski Y8 belleği henüz yenilenmedi): web5199 PID236072, API390293,
  arena390301. Test DB şu anda yok. Yeniden kurarken disk volume, 512MiB/1CPU, port5544;
  tmpfs kullanma (önceki geniş testte WAL OOM yaptı). Oyun DB5433/astera-pg korunur.
- Geri alma snapshot'ı `.dev/arena/2026-10-24-logic/skins-backup` ve uygulanan geri alma
  betiği `defer-skins.py`. Yeni ortak giriş kaynağı `arena/entrances.ts`, testler
  `test/arena/entrances.test.ts` + `sortie.test.ts` (18 geçti). Genel tip/lint henüz koşulmadı.
