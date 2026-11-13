# Yeni Oyuncu Yolculuğu: İlk Oturum, Sıçrama Kararı ve İlk Hafta

**Tarih:** 13 Kasım 2026 · **Son inceleme:** 13 Kasım 2026, kodla satır satır karşılaştırıldı.
**Durum:** Yön ve S1–S5 owner onaylı. Açık soru yok. Kod yazılmadı.
**Çalışma yeri (owner, 2026-11-13):** Worktree `blindspace-new-player`, branch `feat/new-player-journey`. İş, fazlar bitince master'a alınır.

> **Bağlam sıkıştırmasından sonra önce §10'u (uygulama defteri) oku.** İlerleme tablosu, dosya haritası, doğrulanmış sayılar ve kurallar oradadır. Her adımın sonunda §10.5'i güncelle.

**Yerini aldığı yerler:**

- `docs/baslangic-galaksisi-plani-2026-11-04.md`: K4 ve A17 (3–5 gün), K7 (motor parçası), A11 (bot kalkışı), A9'daki "göçe hazır" koşulu.
- `docs/yeni-oyun-deneyimi-plani-2026-11-08.md`: N4 (motor 4 + 4 saat) ve "Geçiş (hızlı ~20 sa, normal 2–3 gün)" satırı. O planın F9 maddeleri bu planın Faz 4'üne taşındı. N6, N7, N10 ve N12 korunur.
- `packages/rules/test/starter-pacing.test.ts` içindeki 2026-11-09 tempo sözü ("en aktif oyuncu bile ilk gün inmez").
- Codex'in `docs/onboarding-first-session-handoff-2026-11-12.md` belgesindeki hızlı çıkış mekanizması: 30 + 60 sn bağlantılar, mühürlü rezerv, sürüm ataması ve ilk avın ana galaksiye taşınması. Belgenin §11 ölçüm tanımları ve §10.2 göç hata yolları bu planda kullanılır.

## 1. Hedef

> Yeni oyuncu ilk oturumda oyunun asıl döngüsünü yaşar, ana galaksiye ne zaman geçeceğini kendisi seçer ve oyunu kapatırken geri dönmek için kendi nedenini taşır.

Başarıyı tutunma belirler; açılan ekran veya tamamlanan adım sayısı belirlemez.

| Ölçü | Tanım | Neden |
| --- | --- | --- |
| İlk döngü | İlk oturumda eve dönen gerçek bir maden seferi ve teslim edilmiş ilk sonda raporu | Sıçrama penceresinin şartı ve asıl döngünün (bilgi → hedef → sefer → sonuç) ilk örneği |
| R30 | §8'deki owner tanımı | 1. oturumdan 2. oturuma geçiş; D1'in en erken göstergesi |
| D1, D3, D7 | §8'deki eylemli dönüş pencereleri | Sektörün standart tutunma ölçüsü |
| Sıçrama kararı | Pencere açıldıktan sonra üç yol: hemen sıçradı / kaldı ve sonra sıçradı / kaldı ve bıraktı | Kalmanın değeri gerçek bir karar yaratıyor mu? |
| Hatasız ilk oturum | Crash, WebGL kaybı ve rehber kilitlenmesi olmadan tamamlanan ilk döngü | Kararlılık bir D1 işidir (Roblox Retention rehberi) |

Hedef sayılar pilottan önce yazılır (Faz 5). Orta çekirdek strateji için dolaşan "D1 %35–50" değeri tek bir blog kaynağına dayanır; hedef değil, bağlamdır.

## 2. Sektör ne yapıyor, biz neyle karşılıyoruz

Kalıcı ve ortak haritalı PvP strateji oyunları yeni oyuncuyu asıl döngüye hızlı sokar ve katmanlı biçimde korur. Clash of Clans ve Clash Royale bu soruna örnek değildir: oyuncuyu eşleştirmeyle (matchmaking) kendi seviyesindekilerle karşılaştırırlar.

| Sektör uygulaması | Örnekler | Astera'daki karşılığı | Durum |
| --- | --- | --- | --- |
| **Akran grubu:** yeni oyuncu yaşıtlarıyla başlar, ilk günlerde ücretsiz taşınır | Rise of Kingdoms, Lords Mobile, Whiteout Survival, Travian, OGame | Başlangıç galaksisi (30 kişilik akran sunucusu), tek yönlü sıçrama | Var. Çıkış 2–3 günlük zorunlu bir kapıydı; oyuncunun kararına dönüşüyor. |
| **Süreli acemi kalkanı** | RoK 1–3 gün, Lords Mobile 3 gün, Travian 1–7 gün; saldırınca düşer | 72 saatlik ilk oyun kalkanı. Oyuncuya saldırınca düşer, korsana saldırınca düşmez. | Var. İniş kartı yalnız "72 saat sürer" diyor; düşme kuralı söylenmiyor. |
| **Güç bandı:** çok güçlü olan zayıfa saldıramaz | OGame 1:5 / 1:10 puan oranı | Kademe bandı (`ABUSE.tierBand` 1). Komuta Çekirdeği 3 ile inen oyuncuya yalnız Çekirdek 1–6 komutanları akın edebilir. | Var. Kart ve 1. gün notu kuralı genel söylüyor; oyuncu kendi sayısını görmüyor. |
| **Güvenli öğrenme alanı, serbest çıkış** | EVE Exordium (PvP kapalı, ödül %20 düşük), Hades' Star ev sistemi | Starter'da PvP isteğe bağlı: Aegis'i olmayan gemiye oyuncu saldıramaz. Savaş temposu 0,10. | Var. |
| **Asıl döngüye ilk oturumda ulaşma** | Roblox: ilk deneyim ≤5 dk; CoC: savaş ekonomiden önce gelir | N10 onarım yolu → maden → sonda → tersane | Var; kaybı ölçülüp düzeltilecek (Faz 1). |
| **Bağlamsal, kademeli öğretim** | Apple Onboarding for Games; CHI 2012 (karmaşık oyunda ilerlemeyi artırır, dönüşü tek başına artırmaz) | Gemide rehber ve danışman listesi; inişten sonra güne bağlı notlar | Starter'da var; inişten sonra takvime bağlı (Faz 4). |
| **İlk oturum bekleyen bir sonuçla biter** ("randevu") | Sektör geneli | Dönüş hatırlatmaları (`returnReminders`): sonraki onarımın parası yetince haber, yoklukta 1. ve 3. gün özeti | Var. Canlı worker'da FCM kapalı olduğu için oyuncuya ulaşmıyor. |
| **Bildirim izni, değer görüldükten sonra istenir** | Apple | Android uygulamasında izin, rehber bitince veya ilk maden dönüşünden sonra istenir (`StarterAftercare`). | Var. |
| **Pasif oyuncu yönetimi**, acemi korumasıyla çatışmaz | OGame: pasif oyuncu 7. günde "i", 28. günde "I" işareti alır | Sessiz Uzay (D212): 30 saat geliştirme veya savaş emri vermeyen komutan, dünyasıyla birlikte bekleme alanına taşınır. Canlıda açık. | Bugün çatışıyor: kalkanı süren yeni oyuncu da 30. saatte taşınıyor. S5 ile sayaç kalkan bitince başlar (§5.5). |
| **Yeni oyuncu haftası** (seri cezası olmayan hedefler) | CoC Season Challenges'ın TH3'e indirilmesi; 4X oyunlarda 7 günlük yeni oyuncu etkinlikleri | Yeni Komutan 7 Günü (2026-11-06 planı) | Yapılmadı; Faz 4. |
| **Adım adım huni ölçümü** | Roblox funnel events, GameAnalytics | Oyuncu yolculuğu panosu (Codex) | Bu worktree'de; Faz 0. |

**Çıkarım:** Türde oyuncuyu birkaç gün zorla bekletip sonra asıl dünyaya bırakmak yaygın değildir. Yaygın olan şunlardır: akranlarla başlamak, kalkan ve güç bandıyla korunmak, hazır olunca taşınmak. Astera bu katmanların üçüne de sahip. Eksikler üç tane:

- Çıkış oyuncunun kararı değil.
- Koruma oyuncuya sayısıyla anlatılmıyor.
- Pasif oyuncu kuralı, acemi kalkanını delip geçiyor.

## 3. Owner kararları

| No | Karar | Değiştirdiği |
| --- | --- | --- |
| Y1 | Sıçrama oyuncunun kararıdır. Sıçrama penceresi ilk tam döngü bitince açılır ve sezon sonu dışında hep açık kalır. | K4, A17, 2026-11-09 tempo sözü |
| Y2 | Acil sıçrama: motor, yakıt ve parça şartı yoktur. Motor tek bir sıçramaya yetecek kadar çalışır. Gemi sıçramada zaten tüketilir (K13). | K7, N4 |
| Y3 | Başlangıç galaksisi akran sunucusu olarak kalır. Kalmanın değeri sıçrama panelinde sayılarla gösterilir. Yeni hibe eklenmez. | — |
| Y4 | İlk av starter'da kalır. Tersane 1'den sonra ilk öneridir; çıkış şartı değildir. | — |
| Y5 | Bot gemileri starter'dan insanlara benzer bir süre dağılımıyla ayrılır. | A11 |
| Y6 | Önce ölçüm ve ilk 10 dakika (Faz 0–1), sonra kural değişikliği (Faz 2). | — |
| Y7 | Mevcut gemiler de aynı kurala geçer. Sürüm ataması, rezerv veya telafi yoktur. | — |
| S1 | A9'daki "göçe hazır gemi saldıramaz" koşulu kalkar; 14 günlük sınır kalır. | A9 |
| S2 | Ölü kalacak motor, yakıt ve parça kodu Faz 2 yeşile dönünce silinir. | — |
| S3 | Canlıda bildirimler (FCM) Faz 4'te açılır; yalnız oyuncunun kendi bitmiş işleri için. Açmak bir deploy işidir, owner o turda söyler. | 2026-11-10 "şimdilik dursun" |
| S4 | Codex'in panosu bu worktree'ye alınır, master'a değil. | — |
| S5 | Yeni oyuncu kalkanı süren komutan Sessiz Uzay'a çekilmez; 30 saatlik sayaç kalkan bitince başlar. | D212 (2026-10-07); `docs/game-design.md` güncellendi |

**Y7'nin gerekçesi:** Yeni kural kimseye kaynak veya gemi vermez, yalnız bir kapıyı açar. Bu yüzden eski ve yeni kuralı yan yana yaşatmanın adalet gerekçesi kalmaz. Motora yatırım yapmış oyuncu bir hak kaybetmez: süren işler bugünkü gibi tam iade edilir, depodaki yakıt stoğa döner (§6).

**Sezon sonu (A5) korunur.** Owner itiraz etmedi; itiraz ederse handoff'taki K2 varyantı uygulanır. Gerekçeler:

- Sezon 60 gün sürüyor. Son 5 günde inen yeni oyuncu, tek seferlik ilk sezon paketini ve 72 saatlik kalkanını birkaç gün sonra sıfırlanacak bir dünyada harcar.
- Yeni sezonun ilk günü türün en iyi inişidir.
- Sunumu bugün de var:
  - Sıçrama paneli sezonun ne zaman kapandığını önceden söylüyor (`jumpOutlook`).
  - Yeni sezon açılınca gemiye "Gemin kalkabilir" haberi geliyor (`seasonOpen`).

## 4. Oyuncunun yolculuğu

Süreler yaklaşıktır; Faz 1 ve Faz 5'te ölçülür. Sayılar `@astera/rules` koduyla hesaplandı.

### 4.1 Açılış ve sahiplenme (0–2 dk)

Bugünkü hâliyle kalır: prolog, sinyal ve gemiyi sahiplenme. Hikâyeyi atlayan oyuncu aynı haklarla başlar.

Uzun vadeli hedef ilk dakikadan görünür. Gemi ekranındaki onarım ilerlemesi "sıçramaya hazırlık" olarak okunur: altı onarım ve iki olay. Hikâyenin cümlesi şudur: "Bu gemi seni ana galaksiye götürecek."

### 4.2 İlk döngü (2–12 dk)

Bugünkü N10 yolu: Rafineri 2 → Çıkarıcı 1 → Teleskop 1 (Kazıcı verilir) → ilk maden → Radar 1 → Keşif anteni 1 → ilk sonda → Tersane 1 (2 Ok verilir).

- Altı onarımın sayaçları toplam 130 saniyedir. Geri kalan süre maden ve sonda uçuşu, okuma ve dokunmadır.
- Rehberin son adımı (`farewell`) pencerenin açıldığı ana bağlanır.

Faz 1'in düzelteceği bilinen kayıplar:

- İlk onarımdan madenciliğe geçişte %30 kayıp (10–11 Kasım kohortu, 23 hesap).
- Rehber hedefi bulunamıyor (`mark_missing`).
- React ve WebGL hataları.
- **Yalnız oyuncunun ölü ucu:** Görüş alanında başka gemi yoksa rehber sonda adımını atlıyor (`alone`). Sonda raporu pencerenin şartı olunca bu oyuncu takılır. Sonda bir kayaya veya enkaza da gönderilebiliyor ve rapor üretiyor. Bu yüzden rehber, komşu yoksa sondayı en yakın kayaya yönlendirir.
- **Kaybolan hedef:** Sonda varmadan hedef gemi sıçrarsa sonda boş döner ve olay yazılmaz. Erken sıçramalar bunu sıklaştırır. Danışman yeniden sonda göndermeyi önerir.

### 4.3 Sıçrama penceresi açılır (yaklaşık 10–15. dakika)

**Şart (sunucuda):**

- İlk altı onarım tamamlanmış olmalı.
- Hedefinde gerçekten kazı yapmış bir maden seferi eve dönmüş olmalı.
- İlk sonda raporu eve teslim edilmiş olmalı.

Rehber onayı, "okudum" beyanı veya ilk av şart değildir.

**An (geri bildirim katmanı: büyük).** Mevcut açılış anı sistemi (`UnlockMoment`, `migration` özelliği) kullanılır. Sahnesi kendinedir:

- **Işık ve görüntü:** Motor iki kez tekler ve sonra tutar; sıçrama sahnesindeki `jumpThrottle` alevlenme eğrisi kullanılır. Gemi ekranındaki MOTOR satırı yanar.
- **Ses ve titreşim:** Düşük bir uğultu ve kısa bir titreşim (`haptic`) gelir.
- **Kamera:** Gemiye kısa bir yaklaşma yapar.
- **Kart:** "Motor bir sıçramaya yetecek kadar çalışıyor. Ne zaman gideceğini sen seçersin."

Her katman kısa sürer ve dinlenme hâline döner. Dokunmayı engellemez. Ses kapalıyken de anlaşılır: satır yanar ve sıçrama çağrısı (`JumpCall`) belirir. Geri sayım ve baskı yoktur.

Pencere açılınca danışman listesine "Sıçra" eklenir. İlk av yapılmadıysa liste onu önde tutar.

### 4.4 Sıçrama paneli: karar desteği

Bugünkü `MigrationPanel` motor, parça ve yakıt anlatıyor. Bunların yerine **kararın girdilerini** koyar. 350 px'te tek sütundur ve yukarıdan aşağıya şu sırayla gider:

1. **Ambarın.** Her kaynak için doluluk çubuğu: şimdi taşınacak / tavan (2.000 alaşım, 1.000 kristal, 50 döteryum) ve sağlam gemiler x/6.
2. **Burada kalırsan.** Tek satır: "Gemideki üretim ana galaksinin 3 katı." Altında ambarı doldurmanın yolları: ilk av ve zafer kasası, maden seferleri, üretim onarımları.
3. **İnince.** İlk sezon paketi ve ambarın birlikte iner. Koruma satırı: kalkan süresi ve düşme kuralı, kademe bandının oyuncunun kendi sayısı (Çekirdek 1–6) ve Sessiz Uzay kuralı (kalkan bitince 30 saat, S5).
4. **Geride kalanlar.** Mevcut `LeftBehind` satırı. Ek olarak: "Onarımlar ve araştırmalar gemide kalır."
5. **Sezon.** Mevcut `jumpOutlook` satırı.
6. **Eylem.** "Sıçramaya hazırlan" mevcut `LandingChoice`'u açar (§4.6).

Panel cevabı vermez, girdileri verir. Erken giden ana galaksinin fırsatlarına erken başlar ama hafif iner. Kalan, daha dolu bir ambar ve gemiyle iner. İkisi de meşrudur: bu bir **RISK / OPPORTUNITY** kararıdır.

**Sayılar** (§4.2'deki yolu izleyen oyuncu):

| | Alaşım | Kristal | Gemi |
| --- | --- | --- | --- |
| 15. dakikada sıçrayan götürür | ~1.000 | ~330 | 3 |
| Dolu ambar götürür | 2.000 | 1.000 | 6 |
| İlk sezon paketi (herkese) | 1.500 | 1.000 | 6 |

Dolu ambar, başlangıç gücünü yaklaşık iki katına çıkarır. Erken gidenin ambarı paketin üçte ikisi kadardır. Gemideki üretim üç kat olduğu için ambar, ilk günün ikinci veya üçüncü oturumunda dolabilir. Bunu Faz 2'deki pacing testi ölçer; tutmazsa sayı değil, söz owner'a gelir.

### 4.5 Kalan oyuncu: starter bir akran sunucusudur

- İlk av ilk öneridir (bugünkü gibi). Kalan onarımlar artık üretimi büyütüp ambarı doldurmanın yoludur; motor satırı yoktur.
- **Ambar doldu anı (geri bildirim katmanı: orta).** Alaşım ve kristal tavana ulaşınca ambar kapakları kapanır ve kısa bir ses çalar. Kart: "Ambarın dolu. Bundan sonra kazandığını götüremezsin." Danışman sıçramayı öne alır; kalmak serbesttir.
- 48 saat ilerleme yapmayan gemi bugünkü gibi uyur (DORMANT). Oyuncu dönünce gemi uyanır.
- Oyuncular arası savaş, Aegis'li gemiler arasında ilk 14 gün açıktır (S1).

### 4.6 Sıçrama

Bugünkü akış değişmez:

- Sıçrama paneli (`LandingChoice`) üç adres sunar: en boş (güvenli, hedeflere uzak), en kalabalık (zengin, tehlikeli) ve ikisinin arası (A7).
- Götürülecekleri ve geride kalanları gösterir.
- Basılı tutulan tek bir düğmeyle (`HoldButton`) başlar.
- Ardından 19,4 saniyelik uçuş sahnesi oynar.
- Göçün dört adımı ve hata yolları aynı kalır; handoff §10.2 bugünkü kodu doğru anlatır.

Tek ekleme: Açılmaya hazır kurtarma kasaları, ambar sayılmadan önce otomatik açılır. Bugün açılmamış kasa sıçramada kayboluyor. Erken sıçramayla bu daha sık olur.

### 4.7 İniş (ilk saat)

Bugünkü iniş kartı (`ArrivalHost`) kalır: gelen kargo, ilk sezon paketi, toplam ve iki ilk hamle. Değişenler:

- **Koruma bloğu.** Kalkan ve kademe satırları tek blokta, oyuncunun kendi sayısıyla yazılır:
  - "Kalkanın 72 saat sürer. Bir oyuncuya saldırırsan düşer; korsana saldırmak düşürmez."
  - "Sana yalnız Komuta Çekirdeği 1–6 olan komutanlar akın edebilir."
  - "Kalkanın bittikten sonra 30 saat geliştirme ya da savaş emri vermezsen dünyan Sessiz Uzay'a çekilir." (S5)
  - Kalan kalkan süresi sahnede ve profilde görünür. Metinler Faz 3'te koddan yeniden doğrulanır.
- **İlk av yapılmadıysa** "dışarı çık" hamlesi korsan hedefini gösterir. Bu PvE saldırısı kalkanı düşürmez.
- **2026-11-13'te kartın yanlış satırı kaldırıldı:** "3 gün girmezsen gezegenin silinir." O silmeyi yapan kod (`reclaimIdleSeats`) 8 Eylül'den beri hiçbir yerden çağrılmıyor.

### 4.8 İlk hafta

- **Notlar ihtiyaçla açılır.** `landingTips` notları bugün güne göre sıralanıyor. Bunlar ihtiyaç tetikleyicilerine bağlanır: ilk savaş raporu, ilk kayıp, ilk komşu teması, ilk koloni fırsatı. Takvim yalnız yedektir.
- **Yeni Komutan 7 Günü ve Kuruluş haftası parçaları** (2026-11-08 planı, F9) burada yapılır. Hedeflerde seri cezası yoktur; bir gün kaçıran oyuncu hiçbir şey kaybetmez.
- **Dönüş nedeni.** Her oturum, oyuncunun kendi seçtiği ve bitiş zamanı görünen bir işle biter.
  - Dönüş hatırlatmaları (`returnReminders`) bugün de var: inişten sonraki 7 gün, sıradaki bina hedefinin parası yetince haber verir.
  - Bildirimler Faz 4'te açılınca oyuncuya ulaşır.
  - Dönüşte `returnStory` özeti ne olduğunu anlatır.

## 5. Sunucu kuralları

### 5.1 Sıçrama penceresi

**Tek kaynak:** `@astera/rules` içinde `jumpWindowOpen(progress)`. Bugün `isJumpReady`'yi kullanan her yer buna geçer: `departureBlock`, `features.ts` (`migration`), `migrationView`, `commitDeparture`, bot `sweep.ts`, `JumpCall`, `VesselScreen`, `opportunities.ts`, `StarterAftercare`.

**Şart:** `REFINERY 2`, `EXTRACTOR 1`, `TELESCOPE 1`, `RADAR 1`, `SURVEY 1`, `SHIPYARD 1`, `FIRST_MINING_RETURN` ve `FIRST_PROBE_REPORT`.

**`FIRST_MINING_RETURN` yalnız gerçek kazıda yazılır.** Yeni bir olgu açılmaz.

- Bugün her `MINE` dönüşünde yazılıyor; hedefe varmadan geri çağrılan sefer de yazıyor.
- Yeni kural: `resolveMiningLanding` seferi "kazıldı" diye işaretler. Bunun için `vessel_missions`'a tek alan eklenir (migration). İşaretli bir sefer eve inince olay yazılır.
- Kaya başkası tarafından boşaltılmışsa sıfır yükle dönen gerçek kazı da sayılır.
- Bu olguyu kullanan diğer yerler (enkaz toplama, Hangar 2 şartı, rehber, bildirim izni, danışman) aynı anlamı zaten bekliyor. Oyuncu metni de "gönder ve dönmesini bekle" diyor.
- Mevcut gemilerdeki olgu olduğu gibi kalır.

**Engel sırası (`departureBlock`):**

1. Pencere kapalıysa `MIGRATION_NOT_READY`.
2. Dışarıda uçan filo varsa `MIGRATION_FLEET_OUT`.
3. Sezonun son 5 günüyse `MIGRATION_SEASON_WAIT`.

Açık sunucu yoksa `NO_FRONTIER` bugünkü gibi kalır.

**Zorunlu adımlar:**

- `REPAIR_LADDER`'da yalnız ilk altı adım `required` kalır; gerisi seçimlidir.
- `repairProgress` pencere şartlarını sayar. `wholeShipProgress` bütün gemiyi gösterir.
- Beş sistem satırındaki MOTOR, pencere açılınca tamamlanır.

**A9 (S1):** `canAttackVessel` içindeki `isJumpReady` koşulu düşer; `lockAfterDays: 14` kalır. Starter'da PvP isteğe bağlıdır, Aegis'i olmayan gemiye oyuncu saldıramaz. Kuralın amacı zaten bu şekilde karşılanıyor.

### 5.2 Kargo ve kalmanın değeri

- Kargo kuralı değişmez: stok, üretim havuzu ve süren işlerin tam iadesi. Tavanlar 2.000 / 1.000 / 50 ve 6 sağlam gemi.
- `holdForDeparture`, ambarı saymadan önce hazır kasaları açar (§4.6).
- `migrationView`'a iki alan eklenir:
  - Her kaynak için tavana göre doluluk.
  - "Ambar dolu" bayrağı: alaşım ve kristal tavanda.
- Yeni hibe yoktur.

### 5.3 Dönüş hatırlatmaları

`starterTarget` bugün `nextRequiredStep`'i kullanıyor. Zorunlu adım altıya inince pencereden sonra hiçbir randevu kurulmaz. Pencereden sonraki hedef, sıradaki sipariş edilebilir onarımdır (`nextSteps`, seçimli dahil). Ambar doluysa randevu kurulmaz; o oyuncunun hamlesi sıçramaktır.

### 5.4 Botlar (kilitli bot kararı, 2026-10-28)

Botlar da `nextRequiredStep`'e bakıyor (`shipBots.ts`). Değişiklikten sonra altıncı onarımda dururlar ve insanlardan ayırt edilirler. Kurallar:

- Bot gemisi, insanların kalma süresine benzeyen bir dağılımdan kendi kalma süresini çeker. İlk değer bir tasarım varsayımıdır; Faz 5'teki ölçümle güncellenir.
- Bot, kaldığı sürece seçimli onarımları ve ilk avı insan temposunda yapar.
- Süre dolunca: Ana galakside bot koltuğu gerekiyorsa sıçrar. Gerekmiyorsa uyur (DORMANT), oyunu bırakan bir insan gibi.
- Test: Bot ve insan dağılımları kalma süresi, sıçrama/uyuma oranı ve etkinlik bakımından ayırt edilemeyecek sınırlar içinde kalır.

### 5.5 Sessiz Uzay ve yeni oyuncu (S5, owner onayı 2026-11-13)

Bugünkü kural (`silentSpaceDueAt`): Son geliştirme/savaş emri, katılış ve ana galaksiye giriş anlarının en geç olanına 30 saat eklenir; süre dolunca komutan çekilir. Kalkan hesaba katılmaz.

Sonuç: 15. dakikada sıçrayıp ertesi gün 30. saatten sonra dönen yeni oyuncu, 72 saatlik kalkanı sürerken dünyasıyla birlikte bekleme alanında uyanır. Geri dönmek için başvurması gerekir. Bu oyuncu D1'in tam hedefidir; ilk dönüşünde gördüğü "ne oldu acaba" sorusunun cevabı sürgün olur.

**Karar:** Yeni oyuncu kalkanı (`newcomerShieldUntil`) süren komutan Sessiz Uzay'a çekilmez; 30 saatlik sayaç kalkan bitince başlar. `silentSpaceDueAt` hesabına kalkan bitişi girer; sunucudaki seçim sorgusu ve kilitli yeniden kontrol aynı kuralı kullanır.

- İlk oyun kalkanıyla en erken çekilme 102. saat olur.
- Kalkanını bir oyuncuya saldırarak düşüren komutan için normal kural geçerlidir.
- Bedeli: Hiç dönmeyecek yeni oyuncunun koltuğu 30 saat yerine yaklaşık 4 gün dolu kalır.

### 5.6 Ölü kalacak kod (S2: Faz 2 yeşile dönünce silinir)

Pencereyle birlikte şunlar hiçbir şey açmaz:

- `DRIVE_HULL` ve `DRIVE_THRUST` onarım adımları; `features.ts`'deki `drive` özelliği.
- Motor parçası: enkaz ve karakollardaki parça dağıtımı, `PartHere`, `partMarks`, `partsVisible` ve parça yarışı.
- Tank yakıtı: `fuel`, `loadFuel`, `FUEL_LOCKED`, `fuelToLoad`, `canLoadFuel`, `STARTER.fuelForJump`.
- `departurePlan` içindeki motor ve yakıt satırları; `MigrationPanel`'in motor, parça ve tank bölümleri.

Döteryum tesisleri kalır; uçuş yakıtı onlardan gelir.

Ayrıca ilgisiz ölü kod: `reclaimIdleSeats` (`services/reclaim.ts`) 8 Eylül'den beri çağrılmıyor. `busy`, `commanderRows`, `demolish` ve `idleSeatCount` hâlâ kullanılıyor. Silmek owner'ın ayrı onayıyla yapılır.

## 6. Mevcut hesaplar, yayın ve geri alma

- **Mevcut gemiler:** Gemideki herkes yeni kurala geçer. İlk döngüsünü tamamlamış gemide pencere hemen açılır.
- **Motor işleri:** Kuyruktaki `DRIVE_*` işleri tam iadeyle iptal edilir. Tamamlanmış motor onarımlarının karşılığı yoktur; Y7 gereği telafi de yoktur.
- **Yakıt ve parçalar:** Depodaki yakıt (`fuel`) döteryum stoğuna döner. Parçaların değeri yoktur; haritadaki parça işaretleri kalkar.
- **Kalkıştaki gemiler:** `DEPARTING` durumundaki gemiler bugünkü yoldan tamamlanır.
- **Yayın:** Tek seferdir; istemci ve sunucu birlikte gider. Android v9 paketi gemiyi bilmiyor (owner kabul etti), etkilenmez.
- **Geri alma:**
  - Ölü kod silinmeden önce: Pencere kuralı bir sabitle eski kapıya döner. Kimseye bir şey verilmediği için geri alınacak hibe yoktur.
  - Silindikten sonra (S2): Geri alma, commit'i geri almaktır. Yakıt stoğa döndüğü için eski tanklar geri gelmez.

## 7. Fazlar

Her faz `CLAUDE.md`'ye göre ilerler: ölçüt → başarısız test → en küçük uygulama → test → oyunun normal akışında oynama (350 px ve S22) → `node tools/visual.mjs`. Plandaki her ölçüt bir teste dönüşür.

### Faz 0: Zemin

- Codex'in oyuncu yolculuğu panosu bu worktree'de. Gözden geçir, güncel master'a göre düzelt ve testlerini yeşile döndür.
- Canlı veriyi salt okunur oku: 10 Kasım'dan beri gelen gemiler nerede bırakıyor, hangi hatayı görüyor, kaçı Sessiz Uzay'a düştü?

**Bitti sayılır:** Pano çalışıyor ve testleri yeşil; kohort tablosu belgelenmiş.

### Faz 1: İlk 10 dakika (kural değişmez)

- Onarım → madencilik ve madencilik → sonda kayıplarının kök nedenini bul. Hem S22'de hem de oyunu hiç görmemiş birinin elinde oyna (Codex taze oyuncu testi; Wiki yasak).
- `mark_missing`: İşaret bulunamazsa rehber çalışan bir geri dönüş sunar: doğru sheet'i açar, sahneye döner, hedefi yeniden bulur.
- Yalnız oyuncu: komşu yoksa rehber sondayı en yakın kayaya yönlendirir.
- React ve WebGL hatalarını yeniden üret, düzelt ve toparlanmayı ölç.
- Ölçüm eksiklerini kapat. Her adım ayrı görünmeli: açıldı → gösterildi → denendi → sunucu kabul etti → sonuçlandı → sonuç görüldü.

**Bitti sayılır:**

- Yeni hesap yardımsız olarak ilk sonda raporuna ulaşıyor; komşusu olmayan hesap da ulaşıyor.
- Görünmez işaret kilidi yok.
- Bilinen crash'ler testleriyle birlikte düzeltilmiş.
- Huni her adımı ayrı gösteriyor.

### Faz 2: Sıçrama penceresi (kurallar)

§5'in tamamı, §5.5 dahil.

**Aynalar:**

- **Kurallar:** `ladder`, `features`, `departure`, `battle`, `carry` ve `starter-pacing` testinin yeni sözü.
- **Sunucu:** `migration`, `mining`, `fleet`, `repair`, `returnPlanning`, `shipBots`, `bots/sweep`, `silentSpace` (S5) ve migration'lar.
- **Web:** `MigrationPanel`, `JumpCall`, `VesselScreen`, `opportunities`, `StarterAftercare`, rehber (`script.ts`), `UnlockMoment`, `ArrivalHost`, `departurePlan`.
- **Metin:** 6 dildeki metinler: `MIGRATION_NOT_READY` bugün "Önce yakıt deposunu doldur" diyor, `jumpCall`, `plan.*`, `jump.*`. Wiki "Göç" sayfası (`wiki/colony-ship.ts`, `the-jump`) bugün motor, 3 parça ve 90 yakıt anlatıyor. i18n eşitlik testi.
- **Ölçüm:** Pano, pencerenin açıldığı anı görür.

**En az şu testler:**

- İlk döngü bitmeden sıçrama `MIGRATION_NOT_READY` döner; döngü bitince pencere açılır. Motor, yakıt ve parça sorulmaz.
- Geri çağrılan maden seferi pencereyi açmaz; sıfır yüklü gerçek kazı açar.
- Uçan filo, sezon sonu ve dolu galaksi engelleri aynen kalır.
- Penceresi açık gemi, ilk 14 gün içinde Aegis'li bir gemiye saldırabilir; 14. günde kilitlenir.
- Hazır kasa sıçramada açılır ve ambara sayılır.
- Pencereden sonra dönüş hatırlatması seçimli onarıma kurulur; ambar doluysa kurulmaz.
- Mevcut gemilerin dönüşümü tekrar çalıştırıldığında aynı sonucu verir; `DEPARTING` gemilere dokunulmaz.
- Botların kalma ve ayrılma dağılımı; altıncı onarımda durmazlar.
- Kalkanı süren komutan 30 saat emirsiz kalsa da Sessiz Uzay'a çekilmez; kalkan bitince 30 saat sonra çekilir. Kalkanını saldırarak düşüren normal kurala döner.
- Pacing: Yolu izleyen oyuncuda pencere ilk oturumda açılır. Günde üç oturumla ambar ilk gün dolabilir.

**Bitti sayılır:** Hepsi yeşil ve kalite kapısının tamamı geçiyor.

### Faz 3: Sıçrama kararı (sunum)

**Bağımlılık:** UI/UX standardının oyun arayüzü kiti (`apps/web/src/game-ui`) master'a girmeden başlamaz. Bu parçalar şunlardır: depo göstergesi, basılı tutma ağırlıkları (0,6 / 1 / 1,5 sn), yazı ölçeği, 44 px hedef ve ekran başına ≤ 55 kelime. Panel ve kartlar doğrudan bu kitle yapılır; eski v2 parçalarıyla yapılıp sonra yeniden yapılmaz.

Kapsam:

- Pencerenin açıldığı an (büyük katman).
- Karar paneli (§4.4).
- Ambar doldu anı (orta katman).
- Danışman listesi.
- İniş kartının koruma bloğu.

Ses (`lib/sound`), titreşim (`haptic`) ve ışık birlikte gelir. 350 px'te tek sütun. Altı dilde metin taşmaz. `game-feel` ve `game-ui-ux` becerileri kullanılır.

**Bitti sayılır:** Taze bir oyuncu pencereyi fark ediyor, iki yolun farkını kendi sözleriyle anlatabiliyor ve panelden kendisi karar veriyor. Aynı oyuncu iniş kartından korumasını sayısıyla söyleyebiliyor.

### Faz 4: İlk hafta

İçerik:

- İhtiyaçla tetiklenen notlar.
- Yeni Komutan 7 Günü ve Kuruluş haftası parçaları.
- Ana galakside ilk PvE önerisi.
- Dönüş özeti.

Bildirimler (FCM) bu fazda canlıda açılır (S3). Bugün worker'ın ortamında bildirim hesabı yok; açmak owner'ın deploy talimatıyla yapılır.

### Faz 5: Pilot

- 20–30 yeni hesap, sabit sürüm.
- Önceden yazılan eşik (handoff §12): 30 olgun hesapta en az 6 R30 devam sinyalidir; 3 veya altı yeniden çalışma gerektirir; arası belirsizdir.
- D1, D3 ve D7 pencereleri olgunlaştıkça raporlanır.
- Botların kalma dağılımı, ölçülen insan dağılımıyla güncellenir.

## 8. Ölçüm tanımları

Ayrıntı handoff §11'dedir; aşağıdakiler bağlayıcıdır.

- **R30 (owner tanımı):** Aynı insan hesabının iki oyun komutu arasında en az 30 dakika varsa, sonraki komut eylemli dönüş sayılır. Komutlar sunucunun kabul ettiği, tekilleştirilmiş, anlamlı ve elle verilmiş olmalıdır.
  - Uygulamanın kapatıldığına dair kanıt aranmaz.
  - Worker işleri, yoklama istekleri, yalnızca giriş yapmak ve otomatik üretim sayılmaz.
  - Gözlem penceresi ilk `enlisted_at` anından itibaren [0, 48) saattir; [0, 24) kesiti ayrıca raporlanır.
- **D1, D3, D7:** İlk `enlisted_at` anından sonra sırasıyla [24, 48), [72, 96) ve [168, 192) saat aralığında elle verilmiş bir oyun komutu. Penceresi henüz kapanmamış hesap paydaya girmez; bekleyen hesap sayısı ayrıca gösterilir.
- **Sıçrama kararı:** Pencerenin açılmasından ilk sıçrama komutuna kadar geçen süre ve oyuncunun yolu (hemen / kaldı ve sıçradı / kaldı ve bıraktı).
- **Kapsam:**
  - Ana galaksideki elle verilmiş komutlar da sayılır; analiz `DEPARTED` noktasında durmaz.
  - Sessiz Uzay'a düşen yeni oyuncu ayrı sayılır.
  - Crash yaşayan hesaplar sonuçtan çıkarılmaz.
  - Bot, admin ve test hesapları yalnız admin analizinde ayrılır.

## 9. Owner'a açık soru

Yok. S1–S5 kararları §3'te. Yeni bir kilitli karar değişikliği çıkarsa buraya, "Planda şu madde(ler), şu kilitli kararı (belge/tarih) değiştiriyor…" kalıbıyla yazılır.

## 10. Uygulama defteri

Bu bölüm, bağlam sıkıştırmaları arasında işi taşır. Burada yazan, sohbet geçmişinden önce gelir; kod ise ikisinden de önce gelir.

### 10.1 Devam ederken

1. Bu belgeyi oku. §10.5'te sıradaki işi bul.
2. Worktree'de `git status` ve `git log --oneline -5` çalıştır. Commit edilmemiş işin bu tabloyla tutarlı olduğunu doğrula.
3. Master ilerlemiş olabilir. Faz 2'nin migration'larından önce master'ı bu branch'e al ve migration numaralarını yeniden kontrol et.
4. Her adımı bitirince §10.5'i güncelle: yapılanı, kalanı ve öğrenileni yaz. Bir kararı veya ölçümü yalnız sohbette bırakma.

### 10.2 Çalışma kuralları (CLAUDE.md ve owner kuralları)

- **TDD her kod değişikliğinde:** önce test, FAIL'i gör, uygula, PASS'i gör. Yalnız saf stil/CSS istisnadır.
- **Test çalıştırma:**
  - Kısa testler 1 worker.
  - Orta/uzun gruplar 4 worker, worker başına `--max-old-space-size=1024`. Başka oturum test koşuyorsa veya boş bellek 3 GiB altındaysa 3 worker.
  - Veritabanı kullanan her worker kendi `_test` DB'sini açar, migration uygular, sonunda siler.
  - `pnpm test`, `typecheck` ve `lint` `tools/heavy.mjs` kilidinden geçer; aynı anda çalışmazlar.
  - Node heap en fazla 3 GiB.
  - Sunucu testlerinin tamamı 4 parçaya bölünmüş, ayrı DB'li koşuyla yaklaşık 10 dk sürer.
  - Tam test seti yalnız teslimde koşulur.
- **Uzun ekonomi simülasyonları ve snowball denetimi:** owner açıkça istemedikçe yok.
- **Canlı sunucu:** VPS'te deploy, migration veya ortam değişikliği yalnız owner o turda söylerse yapılır. Okuma salt okunurdur: `ssh -T yildirim@hoofywood.com`, `</dev/null`.
- **Git:**
  - Commit yalnız owner isterse yapılır. Stage ve commit tek komutta.
  - `git stash` kullanılmaz.
  - Codex'in `blindspace-player-journey` worktree'sindeki asıllara dokunulmaz.
- **Botlar ayırt edilemez:** Oyuncu metninde, Wiki'de ve yardımda hiçbir dilde bot ifadesi yok. İstemciye bot işareti gönderilmez. Bot davranışı insan dağılımıyla test edilir.
- **Metin:** `docs/ux-writing.md` uygulanır. 6 dil (tr, en, de, es, fr, ja) birlikte değişir; i18n eşitlik testleri geçer. Wiki aynası unutulmaz.
- **Görsel doğrulama:**
  - 350 px ve S22'de oyunun normal akışından oyna; `node tools/visual.mjs` ile kontrol et.
  - Her görsel koşu bir komutan kaydeder. Yaklaşık 5 koşu kaydı 30 dk kilitler.
  - S22 profili: `adb forward` + `connectOverCDP`.
- **Kilitli kararlar:** Değiştirmeden önce owner'a "Planda şu madde(ler), şu kilitli kararı (belge/tarih) değiştiriyor…" kalıbıyla sorulur. Onay gelirse kararı yöneten belge güncellenir. `docs/decisions.md` bilerek silindi; yeniden oluşturulmaz.
- **Kullanılmayan mantığı silmek:** Öğe öğe owner onayı gerekir. Motor, yakıt ve parça için onay var (S2); `reclaimIdleSeats` için yok.

### 10.3 Dosya haritası

| Katman | Dosya | Bu plandaki işi |
| --- | --- | --- |
| Kural | `packages/rules/src/starter/ladder.ts` | `REPAIR_LADDER` `required` bayrakları (ilk altı), `isJumpReady` → `jumpWindowOpen`, `systemProgress`/`repairProgress`, `canLoadFuel`, `VesselProgress.parts/fuel` |
| Kural | `packages/rules/src/starter/features.ts` | `drive` kalkar, `migration` pencereye bağlanır, `partsVisible` |
| Kural | `packages/rules/src/starter/departure.ts` | `departureBlock` sırası, `fuelToLoad` silinir; `landingChoices` aynen kalır |
| Kural | `packages/rules/src/starter/battle.ts` (`canAttackVessel`) | A9: `isJumpReady` koşulu düşer |
| Kural | `packages/rules/src/starter/constants.ts` | `fuelForJump`, `parts` silinir; `deuteriumGrant` kalır (Döteryum tesisi 1) |
| Kural | `packages/rules/src/inactivity.ts` (`silentSpaceDueAt`), `apps/server/src/services/silentSpace.ts` | S5: kalkan bitişi hesaba girer; seçim sorgusu ve kilitli yeniden kontrol aynı kuralı kullanır |
| Sunucu | `apps/server/src/services/starter/migration.ts` | `migrationView` (doluluk, ambar dolu), `commitDeparture`, `holdForDeparture` (kasaları aç), `loadFuel` silinir |
| Sunucu | `.../starter/mining.ts` | `resolveMiningLanding` seferi "kazıldı" diye işaretler |
| Sunucu | `.../starter/fleet.ts` (`landMission`) | `FIRST_MINING_RETURN` yalnız işaretli seferde yazılır |
| Sunucu | `.../starter/repair.ts` (`openCrates`) | Sıçramada kasa açma için yeniden kullanılır |
| Sunucu | `.../starter/sites.ts`, `rocks.ts` | Parça dağıtımı silinir |
| Sunucu | `apps/server/src/services/returnPlanning.ts` (`starterTarget`) | Pencereden sonra seçimli onarıma randevu kurar |
| Sunucu | `.../starter/shipBots.ts`, `apps/server/src/services/bots/sweep.ts` | Bot onarım seçimi, kalma süresi, sıçrama/uyuma |
| Sunucu | `apps/server/src/routes/starter.ts` | Yakıt yükleme route'u silinir |
| Sunucu | `vessel_missions` şeması ve yeni migration | "Kazıldı" alanı; `fuel` → döteryum stoğu, kuyruktaki `DRIVE_*` iadesi |
| Web | `apps/web/src/starter/MigrationPanel.tsx`, `departurePlan.ts` | Karar paneli (§4.4) |
| Web | `.../starter/JumpCall.tsx`, `VesselScreen.tsx`, `UnlockMoment.tsx` | Pencere anı ve çağrı |
| Web | `.../starter/LandingChoice.tsx`, `jump.ts`, `jumpWorld.ts` | Aynen kalır |
| Web | `.../starter/ArrivalHost.tsx`, `landingTips.ts` | Koruma bloğu, ihtiyaç notları |
| Web | `.../starter/opportunities.ts`, `tutorial/script.ts`, `tutorial/useStarterTutorial.ts`, `tutorial/StarterAftercare.tsx` | Danışman, yalnız oyuncunun sondası, `farewell` anı |
| Web | `.../starter/PartHere.tsx`, `partMarks.ts` | Silinir |
| Web | `apps/web/src/wiki/colony-ship.ts` (`the-jump`) | Yeni kural |
| Metin | `apps/web/src/i18n/locales/*/starter.ts`, `errors.ts` | `MIGRATION_NOT_READY`, `FUEL_LOCKED`, `jumpCall`, `plan.*`, `jump.*`, `landing.*` |
| Test | `packages/rules/test/starter-pacing.test.ts`, `starter-ladder`, `starter-first-session`, `starter-victory-crate` | Yeni söz ve zorunlu adımlar |
| Test | `apps/web/test/starter-landing-card.test.tsx` | Koruma bloğu |
| Pano | `apps/server/src/routes/journeyAnalytics.ts`, `apps/web/src/screens/JourneyDashboard.tsx`, `apps/web/src/api/journeyModel.ts` | Faz 0; pencere anı ve Sessiz Uzay sayımı |

### 10.4 Doğrulanmış gerçekler (yeniden hesaplama)

13 Kasım 2026'da `2055f65d` üzerinde doğrulandı:

- **İlk altı onarım:** 1.698 alaşım / 743 kristal, sayaçlar 130 sn.
- **Kasalar:** Hepsi 2.510 / 1.515. İlk altı onarımın kasaları 1.500 / 690.
- **Açılış:** 930 / 300 ve havuzda 60 alaşım.
- **Gemi üretimi (ana oyunun 3 katı):**
  - Alaşım/sa: Rafineri 1–5 için 179, 440, 745, 1.082, 1.446.
  - Kristal/sa: Çıkarıcı 1–4 için 71, 176, 298, 433.
- **Kazı:** Kazıcı ambarı 200. Kaya 800–1.200 cevher: %35 kristal; 1/8 olasılıkla %10'u döteryum.
- **İlk sezon paketi (`FIRST_SEASON_START`):** Çekirdek 3, 1.500 / 1.000 / 50, 6 gemi (3 Ok, 1 Muhafız, 1 Kazıcı, 1 Kurye). Tek seferliktir.
- **Ambar tavanı:** 2.000 / 1.000 / 50, 6 sağlam gemi.
- **Ana galaksi koruması:**
  - İlk oyun kalkanı 72 sa; oyuncuya saldırınca düşer.
  - Kademe `ceil(Çekirdek/3)`, bant ±1. Çekirdek 3 için yalnız Çekirdek 1–6 komutanları akın edebilir.
- **Sessiz Uzay:** 30 sa geliştirme/savaş emri yoksa taşınır; içeride üretim yarıdır. Canlı worker'da `SILENT_SPACE_ENABLED=true` (13 Kasım okuması).
- **Starter bayrağı:** Canlı worker'da `STARTER_GALAXY_ENABLED=false`. Bu bayrak yalnız API'de yeni gemi açılışını kapatır; gemi olaylarını worker işler.
- **FCM:** Worker ortamında bildirim hesabı yok; bildirim gitmiyor.
- **Ölü kod:** `reclaimIdleSeats` hiçbir yerden çağrılmıyor (`b27db1ae`, 8 Eylül).
- **Sondalar:** Kayaya, enkaza ve karakola da sonda gönderilebilir; rapor üretir ve `FIRST_PROBE_REPORT` yazılır.

**Canlı kohort (Faz 0, 13 Kasım 2026, salt okunur okuma):** 10 Kasım'dan beri 26 insan hesabı kaydoldu (bot ve admin hariç). 25'i 10 Kasım akşamı 20:00–24:00 (İstanbul) arasında, 1'i 12 Kasım'da geldi. Sorgular `reports/yeni-oyuncu-kohort-2026-11-13.sql` içinde; dosyanın başındaki salt okunur komutla yeniden okunur.

| Adım | Hesap |
| --- | --- |
| Kayıt → gemiye katılım | 26 → 26 |
| İlk onarım emri | 22 |
| Çıkarıcı + Teleskop | 18 |
| Madencilik (gönderdi ve döndü) | 15 |
| Sonda raporu | 11 |
| Tersane | 10 |
| İlk savaş | 6 |
| Sıçrama | 0 |

- **Ne zaman bıraktılar:** 16/26 hesap kayıttan sonraki 5 dakika içinde son izini bıraktı. 1 saatten sonra iz yalnız 4 hesapta var. Kayıttan 24 saat sonra ilerleme yapan 1 hesap var (43 sa).
- **Duvar yok, her adımda sızıntı var:** Kayıp her adımda ~%15. Oyuncular hızlı: Rafineri emri 16–69. saniyede, Tersane 151–269. saniyede. Rehberi 4–8 dakikada bitiren 4 hesap savaşa girmeden bıraktı. Mekanik bir kilitten çok "neden devam edeyim?" sorusu cevapsız: sıradaki hedef ve dönme nedeni eksik (Faz 2–4'ün işi).
- **İlk dakika:** 8 hesap 0 veya 1 emirden sonra ilk dakikada gitti (son rehber sahnesi `online`, `collect`, `orderRefinery`, `waitFirst`). Açılışın sahiplenme anı (§4.1) bu oyuncuyu tutmuyor.
- **Hatalar:** `react_render` ×2, ilk emirden önce (hesap 36 dk denedi, hiç emir veremedi: crash büyük olasılıkla oyuncuyu kaybettirdi). `webgl_context_lost` ×1. `unhandled_error` ×5 (uzun oynayan bir hesapta). Olaylar yalnız kod taşıyor; bileşen, mesaj veya yığın yok. Faz 1'de yeniden üretmek için hata ayrıntısı (bileşen adı, yığın özeti) eklenmeli.
- **Yükleme:** `game_ready` kayıttan 4–18 sn sonra (bir hesapta 43, birinde 69 sn). Yükleme kaybın ana nedeni görünmüyor.
- **Ölçüm boşlukları:**
  - İstemci olayları bazı uzun oyuncularda erken kesiliyor: 43 saat ilerleyen hesabın son istemci olayı 31. dakikada. Faz 1'de nedeni bulunmalı.
  - `vessels.last_seen_at` ziyaret zamanı değil; onarım ve sessiz ilerleme yazıyor. Pano "son etkinlik"i buna dayandırıyor. Gemi için gerçek bir ziyaret damgası gerekir (Faz 1, ölçüm).
  - Ziyaretçi platform/sürüm bilgisi okumada çoğunlukla `unknown` geldi; sorgu yanlış ziyaretçiyi seçmiş olabilir, Faz 1'de doğrulanacak.
- **Karşılaştırma (küçük örnek, kesin değil):** 14 Ekim–9 Kasım arasında doğrudan ana galaksiye gelen kohortta 245 kayıttan 144'ü (%59) oyuna girdi; 14'ü (%5,7) kayıttan 24 saat sonra, 10'u (%4) 7 gün sonra ilerleme yaptı. Starter kohortunda girişe kadar kayıp yok (26/26), 24 saat sonrası 1/26 (%3,8).
**Yerel oyun testi (Faz 1, 13 Kasım 2026, 350×760, tr, yeni hesap, prologdan vedaya):**

- **Prolog güçlü:** Şalter indirme, basılı tutarak ocağı yakma, toplama, kaynak yapma ve sahiplenme oyun hissi veriyor. Sahiplenme ekranında gemi 350 px'te sola taşıyor (kadraj).
- **Oyuna giriş tekrar ediyor:** Prologda rafineri yakılıp toplandıktan sonra oyunda ilk iş yine "Rafineri modülü çevrimiçi → Dene", "Topla" ve "Rafineriyi onar". Aynı anda iki metin konuşuyor: üstte yavaş yazan subay kartı (ekranın ~%25'i), altta açılış kartı. Kohortta ilk dakikada giden 8 hesabın son sahneleri tam burası (`online`, `collect`, `orderRefinery`, `waitFirst`). Hipotez: sinematik prologdan panoya geçişte tekrar ve metin yükü.
- **Teleskop anı boş:** Teleskop onarılınca görüş alanı karanlık bir alan ve ortada küçük gemi. Yakınlaşmadan bakılacak çarpıcı bir şey yok; merak anı düşük kalıyor. Kohortta 3 hesap teleskop adımlarında gitti.
- **Yakınlaştırma:** Adım, bir kaya ekranda 44 px olunca geçiyor. Fare tekerinde ~13 adım sürdü; telefonda iki parmak. Satır yalnız "iki parmağını aç" diyor.
- **Yalnız oyuncu:** Komşu gemi yokken sonda adımı atlanıyor; yerelde sonda raporu hiç gelmedi (§7 Faz 1 maddesi doğrulandı). Canlıda Keşif'i onaran 11 hesabın hepsi rapor aldı.
- **Vedadaki uçurum (en net bulgu):** Rehberin son satırı "Gemin %37 onarıldı. Ana galaksiye uçmak için onarımı bitirmelisin." O anda oyuncuda 421 alaşım ve **1 kristal** var. Sıradaki onarım (Hangar) 1.000 / 350 ve 30 dk; sıçrama %100 onarım + 90 yakıt istiyor. Yapılabilecek, karşılanabilir bir sonraki hedef görünmüyor. Kohortta rehberi 4–8 dk'da bitiren 4 hesap tam burada gitti. Bu, Faz 2 (pencere) ve Faz 3 (karar paneli) ile çözülecek an: vedada oyuncuya gerçek bir karar düşmeli.
- **Vedadan hemen sonra:** Açılış kartı (Keşif anteni) ve kırmızı "Geliyor → … 1 araç" (gözcü) uyarısı aynı anda geliyor. Canlı ama mesajlar yarışıyor.
- **Yeniden kurulum:** Worktree `.env` = `.env.example` + `DATABASE_URL=…/astera_np_dev`, `PORT=3110`, `STARTER_GALAXY_ENABLED=true`, `ADMIN_USERNAMES=npadmin`, `BOTS_ENABLED=true` (gerçek anahtar yok). `apps/server`: `pnpm -s season migrate && pnpm -s season local-bootstrap && pnpm -s starter bootstrap`, sonra `tsx src/index.ts`. Web: `ASTERA_API=http://localhost:3110 vite --port 5183`. Oyun sürücüsü: scratchpad `driver.mjs` (Playwright, 350 px, dokunmatik, tr); rehberin vurguladığı öğe `.school-highlight`, açılış adımı `[data-starter-next]`.

- **Sessiz Uzay:** Starter kohortundan kimse sıçramadığı için hiçbiri Sessiz Uzay'a düşmedi. Ana galaksi genelinde ise insan komutanların 160'ı bekleme odasında, 23'ü ana galakside. Bekleme odasındakilerin 138'i son 30 günde kaydoldu; 135'inin ana galaksiye girişte yeni oyuncu kalkanı vardı. S5'in neden gerekli olduğu budur: ilk hafta dönen oyuncu bugün bekleme odasında uyanıyor.

### 10.5 İlerleme

| Adım | Durum | Not |
| --- | --- | --- |
| Plan, owner kararları S1–S4 | Bitti | Bu belge |
| Handoff'a "yerini aldı" notu; 11-04 ve 11-08 planlarına işaret notları | Bitti | Bu worktree'de, commit yok |
| Codex panosu bu worktree'ye kopyalandı | Bitti | Faz 0'da gözden geçirildi |
| İniş kartındaki yanlış "3 gün girmezsen silinir" satırı | Bitti | Owner talimatı. Test + `ArrivalHost` + 6 dil, commit yok |
| S5 (Sessiz Uzay ve kalkan) | Karar alındı | Owner onayı 2026-11-13. `docs/game-design.md` D212'ye not düşüldü; kod Faz 2'de |
| Faz 0 | Bitti (13 Kasım) | Pano: web 20/20, sunucu 6/6 (kendi `_test` DB'si), typecheck ve lint temiz, 350/390/1440 px görsel kontrol geçti (taşma ve sayfa hatası yok). Master'a göre değişiklik gerekmedi. Kohort tablosu §10.4'te. Pano notları: aşama listesine Faz 2'de "pencere açıldı" eklenecek; "son etkinlik" ziyaret damgası gelince ona bağlanacak |
| Faz 1 | Bitti (13 Kasım), S22 ve taze oyuncu testi owner'da (§10.7) | Alt adımlar aşağıda (1.1–1.3, 1.2a–f). Kapanış: typecheck ve değişen dosyaların lint'i temiz; her adımın testleri kendi anında yeşil. Geniş web regresyon koşusu Faz 2'nin web aynalarıyla birlikte koşulacak (Faz 1 kapanışında başlatılan koşu kural değişikliğiyle kirlendiği için durduruldu). Commit: yalnız Faz 0/1 dosyaları, `feat/new-player-journey` |
| Faz 1.1 Hata ayrıntısı | Bitti (13 Kasım) | `client_error` artık `subject` = yığının üst satırı (`chunk:satır:sütun`) ve `variant` = hata türü taşıyor; mesaj asla gitmiyor (`lib/playerAnalytics/errorWhere.ts`, `ErrorBoundary`, `runtime.ts`; testler `error-where`, `error-boundary`, `player-analytics-runtime`). Üretim derlemesinde kaynak haritası yok; konumu çözmek için olayın `build` revizyonunu `sourcemap: 'hidden'` ile yeniden derle ve chunk adının eşleştiğini doğrula. Sektör yolu (Sentry vb.) owner'a önerildi, karar bekliyor |
| Faz 1.2 Yerel oyun testi | Bitti (13 Kasım) | Bulgular §10.4'te. Sıradaki Faz 1 işleri, sırayla: (a) yalnız oyuncunun sondası en yakın kayaya, (b) `mark_missing` geri dönüşü, (c) rehber kancalarını koruyan test, (d) giriş tekrarını ve çift metni azaltmak, (e) teleskop anına görülecek bir şey, (f) sahiplenme kadrajı. Vedadaki uçurum Faz 2–3'ün işi |
| Faz 1.2a Yalnız oyuncunun sondası | Bitti (13 Kasım), yeni kod yok | Yalnız oyuncu `FIRST_PROBE_REPORT`'u ilk avın karakoluna sonda atarak alıyor: Tersane 1 onarımı iki `firstHunt` karakolu kuruyor, `opportunities()` avın 'probe' aşamasını ilk sırada sunuyor. Koruyan testler: `apps/server/test/starter-probe.test.ts` ("gives a ship alone in its galaxy its first report from a first-hunt outpost"), `apps/web/test/starter-opportunities.test.ts` ("reaches its first report through the first hunt instead"). Kayaya sonda eklemek gerekmedi |
| Faz 1.2b `mark_missing` | Kök neden düzeltildi (13 Kasım) | Prod 1 Kasım'dan beri 6 olay: online ×2, telescopeLook ×2, probe, openCrate. Olay çevresi (salt okunur) ve yerel yeniden üretim: oyuncu galaksideki kendi gemisine dokununca seçim gemiye geçiyor; `bottomSurface` bunu "alanı tutan seçim" saymıyor (gemi kart çizmiyor) ama başlangıç bloğu her seçimde `hidden` oluyordu. Sistem kartı, "Dene" düğmesi ve hedef satırı kayboluyor, rehber olmayan bir kartı gösteriyordu. Takılma her seferinde galaksiye dönüşten tam 4,5–5 sn sonra düşüyor; 4c95aeca bu anda oyunu bıraktı. 6 olaydan 5'i bu nedene uyuyor (probe'un işareti de aynı bloktaki hedef satırı). Düzeltme: `GalaxyView` başlangıç bloğundaki `hidden` koşulu kaldırıldı (blok zaten yalnız `bottom === 'starter'` iken çiziliyor). Test `apps/web/test/starter-own-ship-tap.test.tsx` (önce FAIL, sonra PASS); 350 px tarayıcıda gemiye dokunuş sonrası kart ve el yerinde. Genel "sahneye dön" geri dönüşü eklenmedi: kalan tek olay (openCrate, oyuncu devam etti) başka bir nedene işaret etmiyor. Deploy sonrası panoda `mark_missing` yeniden okunacak; yeni bir neden görünürse geri dönüş o zaman tasarlanacak |
| Faz 1.2c Rehber kancaları testi | Bitti (13 Kasım) | `apps/web/test/starter-tutorial-hooks.test.ts`: rehberin işaret ettiği 32 kancanın her biri, onu çizen dosyayla birlikte bir tabloda. Tamlık testi `script.ts`, `StarterTutorialCoach.tsx` ve `visualGoal.tsx` içindeki her kancanın tabloda olmasını istiyor. Şablonlu kancalar için dock sekmeleri, `yard` destesi ve `DART` gövdesi de denetleniyor. Bilerek bozulmuş kopyada (satır silme, kanca adı değiştirme) iki test kırmızıya döndü. Faz 2'de yakıt kodu silinince `data-guide="fuel"` satırı da tablodan çıkar |
| Faz 1.2d Giriş tekrarı | Bitti (13 Kasım) | Varıştaki `online` adımı (rafineri çevrimiçi kartı + üstte subay metni + "etrafına bak" sürükleme ipucu; el sürüklemeden ya da 12 sn geçmeden gelmiyordu) prologun yakıp topladığını tekrarlıyordu. "Dene" düğmesi üretim için kartı kapatmaktan başka bir şey yapmıyor. Düzeltme: `enlist.ts` yeni gemiyi `unlocksSeen: ['production']` ile açıyor; rehber doğrudan `collect` ile başlıyor ve bu adımın satırı kartın anlattığını zaten anlatıyor. Tek metin, tek el, tek dokunuş. Sürükleme dersi `telescopeLook`'ta duruyor. Eski gemiler için `online` adımı yerinde (zararsız). Test: `starter-repair.test.ts` "does not announce the refinery the prologue already lit" (önce FAIL, sonra 55/55 PASS); 350 px tarayıcıda yeni hesapla doğrulandı. Diğer sistem kartları (teleskop vb.) owner'ın 2026-11-07 kararıyla aynı kalıyor |
| Faz 1.2e Teleskop anı | Bitti (13 Kasım) | Kamera açılışta bütün halkayı kadrajlıyor; bu ölçekte kayalar birkaç piksel, ilk bakış karanlık bir alan gördü (yerelde fotoğraflandı). Kayaların yumuşak halkası (`RockMark`) eskiden yalnız `zoomRock`/`findRock`'ta vardı; artık `telescopeLook`'ta, kayalar çan sesiyle indiği anda (1,4 sn) da beliriyor ve kısa bir taşmayla "iniyor" (`sight-land`, sonra eski `ember` nefesi). Kural `sightLesson.ts` → `rockMarks()`, test `starter-sight-lesson.test.ts` (önce FAIL, sonra PASS). 350 px tarayıcıda açılışta 3 halka görüldü. `RockReachWatch` yalnız yakınlaştırma ve bulma adımlarında |
| Faz 1.2f Sahiplenme kadrajı | Bitti (13 Kasım) | Kamera sabit bir gövde yarı genişliği (0,37) varsayıyordu; WEDGE gövdesi 350 px'te soldan taşıyordu. Artık model yüklenince gövdenin kendi yüzeyleri (alev, duman ve dış çizgi hariç) köşe köşe ölçülüyor: yatayda dönme eksenine en uzak köşe, dikeyde dönme noktasına en uzak köşe. Kamera ikisini de sığdıran mesafede duruyor (`onboarding/prologue/shipFit.ts` → `fitDistance`, `ShipScene.tsx` → `useHullReach`); `maxDistance` buna göre açılıyor. Test `prologue-ship-fit.test.ts` (önce FAIL, sonra PASS). 350 px tarayıcıda üç gövde beşer açıda çevrildi, hiçbiri kesilmedi; bordadan SEED ve SPINE genişliğin ~%95'ini, WEDGE ~%70'ini dolduruyor |
| Faz 1.3 Ölçüm kesilmesi | İncelendi | Uzun oynayan hesabın tek web oturumu 26. dakikada bitiyor, sonraki 43 saatte istemci olayı yok. Android `runtime()` destekli; büyük olasılıkla başka cihaz/tarayıcı veya ölçümü reddetme. İsteğe bağlı ölçüm için normal. R30 ve D1/D3/D7 zaten sunucu komutlarıyla ölçülüyor (§8); ziyaret damgası gerekmiyor |
| Faz 2 | Sürüyor | §5.5 dahil. Alt adımlar sırayla; her biri önce kırmızı test, sonra kod, sonra ilgili testler yeşil |
| Faz 2.1 Kural: pencere | Bekliyor | `jumpWindowOpen(progress)` (`ladder.ts`); `REPAIR_LADDER` yalnız ilk altı `required`; `repairProgress` pencere şartlarını sayar, `wholeShipProgress` bütün gemi; `features.ts` `migration` pencereye bağlı. Testler `packages/rules/test/starter-*` |
| Faz 2.2 Gerçek kazı | Bekliyor | `vessel_missions`'a "kazıldı" alanı (migration); `resolveMiningLanding` işaretler; `landMission` `FIRST_MINING_RETURN`'ü yalnız işaretli seferde yazar; geri çağrılan sefer açmaz, sıfır yüklü gerçek kazı açar |
| Faz 2.3 Kalkış | Bekliyor | `departureBlock` sırası (pencere → uçan filo → sezon sonu; `NO_FRONTIER` aynı); motor/yakıt/parça sorulmaz; `holdForDeparture` önce hazır kasaları açar; `migrationView` doluluk + ambar dolu bayrağı |
| Faz 2.4 A9 | Bekliyor | `canAttackVessel`'den `isJumpReady` düşer, 14 gün kilidi kalır |
| Faz 2.5 Dönüş randevusu | Bekliyor | `starterTarget`: pencereden sonra sıradaki sipariş edilebilir onarım; ambar doluysa randevu yok |
| Faz 2.6 Botlar | Bekliyor | Kalma süresi dağılımı, seçimli onarımlar, süre dolunca sıçrama ya da DORMANT; altıncı onarımda durmazlar. Kilitli bot kararı (ayırt edilemezlik) korunur |
| Faz 2.7 S5 | Bekliyor | `silentSpaceDueAt` kalkan bitişini sayar; seçim sorgusu ve kilitli yeniden kontrol aynı kural |
| Faz 2.8 Mevcut gemiler | Bekliyor | Migration: yakıt → döteryum, kuyruktaki `DRIVE_*` tam iade + iptal; tekrar çalışınca aynı sonuç; `DEPARTING`'e dokunulmaz |
| Faz 2.9 Web aynaları | Bekliyor | `MigrationPanel`, `JumpCall`, `VesselScreen`, `opportunities`, `StarterAftercare`, `script.ts`, `UnlockMoment`, `ArrivalHost`, `departurePlan`: yalnız kurala uyum (yeni karar paneli Faz 3). 6 dil metni, Wiki `the-jump`, i18n eşitlik testi |
| Faz 2.10 Pano | Bekliyor | Pencerenin açıldığı an aşama listesine |
| Faz 2.11 S2 ölü kod | Bekliyor | Faz 2 yeşilken motor, parça, yakıt kodu silinir (§5.6); `reclaimIdleSeats`'e dokunulmaz |
| Faz 2.12 Kapı | Bekliyor | `pnpm verify` (uzun testler hariç), 350 px oynanış, commit. UI kiti master'da değilse dur ve raporla |
| Faz 3 | Bekliyor | |
| Faz 4 | Bekliyor | Bildirim açmak owner deploy talimatı ister |
| Faz 5 | Bekliyor | |

**Owner yokken çalışma kararları (owner, 13 Kasım 2026, ayrılmadan önce):**

- Her Faz sonunda bu worktree'nin dalına (`feat/new-player-journey`) commit atılır. Push, deploy ve master'a dokunmak yok.
- Varışta "Rafineri çevrimiçi" kartının kalkması (Faz 1.2d) onaylandı.
- S22 ve taze oyuncu testi (Codex) owner dönünce yapılır. O zamana kadar doğrulama yerel 350 px tarayıcıda oynanarak yapılır; Faz 2'ye geçilir.
- Faz 2 bittiğinde UI/UX kiti master'da değilse dur ve raporla: Faz 2 + S2 ölü kod silme + tam test kapısı, sonra owner beklenir. Faz 3'e mevcut bileşenlerle başlanmaz.
- Owner dönünce sorulacaklar burada birikir (§10.7).

### 10.6 Unutulmaması gerekenler

- **Rehber ve olaylar:**
  - Rehberin `farewell` adımı ile pencere anı aynı ana denk gelir; iki kart üst üste binmemeli.
  - Pencere anı, oyuncu başka bir sheet içindeyken gelirse kuyruğa girer (`nextUnlockToAnnounce` bir seferde bir an gösterir).
  - `nextLockedFeature` listede sırayla ilk kilidi gösteriyor (sohbet, araştırma…). İlk döngüde sıradaki kilit olarak sıçramanın görünmesi ayrıca ayarlanmalı.
- **Danışman:** Uçan filo sıçramayı engeller (`MIGRATION_FLEET_OUT`). Danışman bunu "Kazıcın dönünce sıçrayabilirsin" diye söyler.
- **Ambar:**
  - Döteryum tavanı (50), seçimli Döteryum tesisi olmadan dolmayabilir. "Ambar dolu" yalnız alaşım ve kristale bakar.
  - Seçimli onarımlar ambardan harcar ama gemide kalır. Panel bu bedeli "Onarımlar gemide kalır" satırıyla açıkça söyler.
- **Kalkan ve PvP:**
  - Sıçrayan oyuncunun ilk oyun kalkanı hakkı `accounts.firstGameShieldAvailable` ile bir kez verilir.
  - Göç bunu bugün doğru kullanıyor; değişiklikte bozulmamalı.
  - Starter PvP kilidi `enlistedAt`'ten sayılır. A9 değişince 14 gün içindeki gemiler birbirine saldırabilir.
  - Raid sınırları (`bashLimit`, `dailyRaidCap`) aynen kalır.
- **Botlar:**
  - Bot koltuk hesabı (`shipBotTarget`) aktif insan sayısına bağlı. İnsanlar 15. dakikada ayrılınca galaksi hızla boşalabilir. Faz 5'te kalan oyuncunun gördüğü komşu sayısını ölç.
  - Kalan botlar 48 saat ilerleme yapmazsa insanlar gibi uyumalı.
- **Ölçüm:** Pano, sıçramadan sonra ana galaksideki komutları da saymalı. `vesselAnalytics` olay adları değişirse pano da değişir.
- **Mobil uygulama:** Android v9 paketi gemiyi bilmiyor. Yeni bir AAB gerekirse ayrı iştir.
- **Belge güncellemeleri:** Bitince 11-04 ve 11-08 planlarındaki işaret notları kalıcı karar metnine dönüşür. `docs/review-onboarding.md` (onboarding için ilk referans) yeni akışı anlatacak şekilde güncellenir. `docs/game-design.md` bugün göçü anlatmıyor.
- **UI/UX işiyle eşgüdüm (2026-11-13 ölçümü):**
  - UI/UX dalı (`blindspace-uiux`, `feat/ui-ux-standard`) master'ın 58 commit önünde. Sunucuya, kural paketine ve gemi ekranlarına (`apps/web/src/starter`) dokunmuyor.
  - Faz 0–2 bu yüzden paralel yürür.
  - Faz 3–4 kite bağlı (yukarıda).
  - O dal, sıçrama ve iniş kartının kullandığı `v2/kit/HoldButton`, `useHoldPress` ve `Sheet`'i değiştiriyor. Birleştirmede typecheck ile kontrol et.
  - Bugünkü tek ortak dosya `fr/starter.ts` (farklı satırlar). Faz 2 motor ve yakıt metinlerini silerken altı dildeki uzun satırlar (ör. `log` içindeki DRIVE bölümü) o dalın düzeltmeleriyle çakışabilir; elle birleştirilir.
- **Rehber kancaları:** Rehber, gemi dışındaki ekranlardaki kancalara bağlı: `dock-intel`, `dock-base`, `[data-known="probe"]`, `[data-report-open]`, `[data-dossier-loot]`, `[data-commit]`, `yard-hull`/`data-hull`, `works`, `objective`, `unlock-*`, `sight-*`. UI/UX 4.2–4.3 tam bu ekranları (tersane, istihbarat, sonda raporu) yeniden yapıyor. 13 Kasım'da hiçbiri silinmemişti. Silinirse yeni oyuncuda rehber kilitlenir (`mark_missing`). Faz 1'de bu kancaların varlığını koruyan bir test ekle; master'ı her içeri alışta çalıştır.
- **Master'ı içeri alma:** UI/UX ekran ekran master'a giriyor. Bu dal master'ı düzenli içeri alır.
- **Teslim:**
  - `pnpm verify` (sıfır type ve lint hatası, testler yeşil).
  - 350 px ve S22'de oyun içi deneme.
  - Altı dil ve Wiki.
  - Hafıza notu güncellenir.

### 10.7 Owner dönünce sorulacaklar

Owner yokken karar gerektiren her şey buraya yazılır; iş durdurulmaz, varsayılan yol not edilir.

1. Sentry (veya benzeri) çökme raporlama: Faz 1.1 hata ayrıntısı yerine sektör yolu. Öneri ve maliyet sohbette verildi; karar bekliyor.
2. S22 ve taze oyuncu testi (Codex, Wiki yasak): Faz 1'in "Bitti sayılır" maddesi için.
3. Deploy: Faz 1 düzeltmeleri (`mark_missing` kök nedeni, varış kartı, teleskop halkaları, sahiplenme kadrajı, hata ayrıntısı) ancak owner'ın deploy talimatıyla canlıya çıkar. Deploy sonrası panoda `mark_missing` ve ilk dakika kaybı yeniden okunur.

## 11. Kaynaklar

- **Kalıcı dünya ve yeni oyuncu koruması:** [OGame noob protection](https://board.origin.ogame.gameforge.com/index.php/Thread/7816-Tutorial-14-Noob-Protection), [OGame puan sistemi](https://gameforge.com/en-GB/games/ogame-points-system.html), [Travian beginner's protection](https://support.travian.com/support/solutions/articles/7000060689), [Travian Kingdoms](https://support.kingdoms.com/en/articles/4-beginner-s-protection), [Rise of Kingdoms SSS](https://riseofkingdomsguides.com/faq), [RoK başlangıç göçü](https://simplegameguide.co.uk/rise-of-kingdoms-beginner-immigration-guide), [Lords Mobile göç](https://www.touchtapplay.com/how-to-migrate-in-lords-mobile-guide-and-tips/), [Whiteout eyalet transferi](https://www.ldplayer.net/blog/whiteout-survival-state-transfer-guide.html)
- **Başlangıç bölgesi:** [EVE — Introducing Exordium](https://www.eveonline.com/es/news/view/introducing-exordium), [PC Gamer — Exordium](https://www.pcgamer.com/games/mmo/after-23-years-ccp-is-about-to-do-the-unthinkable-add-a-non-pvp-zone-to-eve-online/), [Hades' Star](https://store.steampowered.com/app/755800/Hades_Star?l=polish)
- **İlk deneyim ve tutunma:** [Apple — Onboarding for Games](https://developer.apple.com/app-store/onboarding-for-games/), [Andersen vd., CHI 2012](https://grail.cs.washington.edu/projects/game-abtesting/chi2012/chi2012.pdf), [Roblox — Onboarding](https://create.roblox.com/docs/production/game-design/onboarding), [Roblox — Retention](https://create.roblox.com/docs/production/analytics/retention), [Roblox — Funnel events](https://create.roblox.com/docs/production/analytics/funnel-events), [GameAnalytics — Metrics](https://docs.gameanalytics.com/events-metrics-and-filtering/metrics/), [Play.io — onboarding ve tutunma](https://blog.playio.co/mobile-game-onboarding-retention)
- **Codex araştırması (bu worktree):** `reports/Astera ilk oturum planı.md` ve `research_notes/Astera ilk oturum planı/`.
