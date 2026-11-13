# Astera Online — İlk oturum ve ana galaksiye geçiş handoff'u

> **Yerini aldı (owner, 2026-11-13):** Bu belgenin hızlı çıkış mekanizması (30 + 60 sn bağlantılar, mühürlü rezerv, sürüm ataması, ilk avın ana galaksiye taşınması) uygulanmayacak. Geçerli plan: worktree `blindspace-new-player` (branch `feat/new-player-journey`) içinde `docs/yeni-oyuncu-yolculugu-plani-2026-11-13.md`. Bu belgenin §11 ölçüm tanımları ve §10.2 göç hata yolları o planda kullanılır.

**Tarih:** 12 Kasım 2026

**Son inceleme:** 13 Kasım 2026. Kod, ölçüm tanımları ve hata/geçiş yolları yeniden karşılaştırıldı; düzeltmeler Bölüm 19.1'de özetlendi.

**Durum:** Uygulama için ayrıntılı tasarım ve devir belgesi. Bu dosyanın yazılması oyun kurallarını değiştirmedi; yeni akış henüz uygulanmadı veya yayınlanmadı.

**Hedef okuyucu:** Önceki konuşmayı okumamış, kodu devralacak agent veya geliştirici.

**Ürün sahibi:** Kullanıcı / owner.

**Ana araştırma:** [Astera ilk oturum planı](<../reports/Astera ilk oturum planı.md>).

## 1. Devralan agent'ın ilk bilmesi gerekenler

Astera Online, mobil öncelikli, web ve Android istemcisi olan kalıcı çok oyunculu uzay strateji oyunudur. Oyunun vaadi, yalnızca bina geliştirip sayaç beklemek değildir:

> Dünyaya bak → bilgi topla → fırsat gör → hedef seç → filonu riske at → gönder → sonucu gör → yeni karar ver.

Bugünkü başlangıç, hasarlı bir koloni gemisini onarmaya dayanır. Bu sahiplenme hikâyesini korumak istiyoruz. Ancak ana galaksiye giriş, normal kod yolunda yaklaşık 13 saatlik saf onarım zincirinin arkasındadır; kaynak bulma ve oyuncunun ara vermesi buna dahil değildir. İlk birkaç dakika kısa olsa da başlangıç galaksisinden çıkış kısa değildir.

**Yapmak istediğimiz:** Hasarlı gemi hikâyesi içinde küçük ama gerçek bir oynanış döngüsü yaşatmak; ilk ana galaksi girişini aynı oturumda mümkün kılmak; ileri öğretimi ana galakside ihtiyaç anlarına dağıtmak.

- Normal rehberli yolda, ilk oynanabilir açılıştan itibaren **10–15 dakika içinde ana galaksiye giriş** hedeflenir.
- İşlemleri örtüştüren, hızlı ilerleyen oyuncu için **5–10 dakika** mümkün olmalıdır. Bu, her cihaz ve oyuncu için garanti değildir.
- Oyuncunun starter'da zorunlu **1–2 gün** kalması hedeflenmez. Öğrenme, ana galakside yaklaşık **24–48 saate** yayılır; dersler saate göre zorla açılmaz.
- Starter'da ilk gerçek maden dönüşü ve ilk gerçek sonda raporu görülür; oyuncuya bağımsız ikinci karar için alan bırakılır.
- İlk savaşın rehberli öğretimi ve gemi üretim dersi ana galaksiye taşınır. Starter'da isteyen bunları mevcut gerçek kurallarla yapabilir.
- Motorun uzun önkoşul zinciri yerine **30 saniye + 60 saniyelik, tek kullanımlık kalkış bağlantıları** önerilir. Bunlar ileri motor seviyelerini ücretsiz tamamlamaz.
- Eksik en çok **3 parça ve 90 tank yakıtı**, yalnız kalkışta kullanılabilen mühürlü gemi rezerviyle karşılanır. Genel kaynak veya savaş filosu hibesi eklenmez.
- Sunucu ilerlemesi, kaynak hakları, gerçek sonuçlar ve istemcide görülen rehber birbirinden ayrılır. Rehber atlamak ekonomik haktan mahrum bırakmaz; rehber onaylamak oyun ilerlemesi yaratmaz.

Bu dakika hedefleri Astera için sınanacak tasarım hipotezidir. Sektörün kanıtlanmış tek doğru süresi veya retention artışı vaadi olarak kullanılmamalıdır.

## 2. Yetki, çalışma alanı ve kaynakların doğruluğu

### 2.1 Bu teslimin kapsamı

Bu görevde istenen çıktı bu Markdown handoff'udur. Kullanıcı henüz bu dosyadaki bütün ilerleme, ekonomi ve sezon değişikliklerini uygulayıp canlıya alma talimatı vermemiştir. Gelecekte uygulama istendiğinde, oturumda verilmiş ürün onaylarını dikkate al; daha önce onaylanan aynı kararı yeniden sorma.

`CLAUDE.md`, temel döngü, risk/ödül, PvP, sahiplik, sezonlar, ilerleme ve kilitli kurallar değiştirilmeden önce owner kararı ister. Bu belgedeki somut paket bu kararın verilebilmesini sağlar. Kod haritalama, teşhis, test tasarımı ve rutin teknik seçimler için ayrıca ürün onayı gerekmez. Bölüm 17, ürün kararı gerektiren konuları sınırlar; her component için onay akışı üretme.

### 2.2 Çalışma alanı

Kullanıcı ayrı worktree istedi. Bu belge aşağıdaki mevcut worktree'ye yazıldı:

```text
Ana repo:     /home/yildirim/Desktop/Coding/MyProjects/blindspace
Worktree:     /home/yildirim/Desktop/Coding/MyProjects/blindspace-player-journey
Dal:          codex/player-journey-dashboard
Worktree HEAD: 19a3cdf0
Kod denetimi: 2055f65d4059de2c02752d5863261d2ebf2a199c
```

Araştırılan ana repo ile dashboard worktree'sinin HEAD'i farklıdır. Kod denetimindeki commit'in üretimde veya eski oyuncu kohortunun oynadığı anda çalıştığı doğrulanmadı. Uygulamaya başlamadan güncel branch, commit ve diff'leri karşılaştır. Eski worktree HEAD'ini güncel ürün davranışı sanma.

Worktree'de önceki görevlerden **commit edilmemiş dashboard kodu** bulunur. Bunlar bu handoff'un uygulanması değildir. `git reset`, `git clean`, toplu dosya silme veya bütün değişiklikleri içeren kör bir commit yapma. Ana repo `CLAUDE.md` değişikliği de başka çalışmanın parçası olabilir; üzerine yazma.

İlk komutlar:

```bash
pwd
git status --short
git rev-parse HEAD
git worktree list
```

Sonra güncel `AGENTS.md` yönlendirmesiyle `CLAUDE.md` oku. Mimari ve test talimatlarını mevcut repo sürümünden doğrula. Yeni uygulama worktree'si gerekiyorsa güncel, incelenmiş tabandan aç; dashboard değişikliklerini otomatik olarak yeni onboarding dalına taşıma.

### 2.3 Okuma sırası ve doğruluk hiyerarşisi

1. Güncel `CLAUDE.md` ve bu belge.
2. Bölüm 13'teki kurallar, sunucu servisleri, istemci ve ilgili testler.
3. [Mimari](architecture.md), [mühendislik standardı](engineering-standards.md), [onboarding ayrımları](review-onboarding.md), [UX yazım standardı](ux-writing.md).
4. [Araştırma raporu](<../reports/Astera ilk oturum planı.md>) ve [kod denetimi](<../research_notes/Astera ilk oturum planı/astera_code.md>).
5. Eski tasarım dokümanları, yalnız tarihsel niyeti anlamak için.

**Mevcut davranışta kod ve testler otoritedir.** Yeni davranışta bu belgedeki hedef, kaydedilmiş owner kararlarıyla birlikte uygulanır. Çelişkiyi sessizce geçme: mevcut davranışı ve önerilen değişikliği ayrı yaz. Eski planlardaki süreyi veya hibe miktarını güncel sabit sanma.

## 3. Neden değişiklik öneriyoruz?

### 3.1 Oyuncu gözlemi

Önceki analizde izlenen 23 insan hesabı, 10 Kasım 2026 18:26:26–11 Kasım 2026 00:00:08 Türkiye saati kayıt kohortuydu. 12 Kasım 2026 21:15 civarındaki önceki sorgunun özeti:

| Gözlenen kilometre taşı | Hesap | 23 hesap içindeki pay |
| --- | ---: | ---: |
| İlk rafineri onarımı tamamlandı | 20 | %87,0 |
| Madencilik gönderildi | 14 | %60,9 |
| Sonda gönderildi | 10 | %43,5 |
| Tersane açıldı | 9 | %39,1 |
| Yeni gemi üretimi tamamlandı | 6 | %26,1 |
| Savaşa girildi | 5 | %21,7 |
| İlk karakol zaferi alındı | 4 | %17,4 |
| Ana galaksiye göç edildi | 0 | %0 |

Özellikle incelenecek geçiş farkları:

- İlk onarım → madencilik: `(20−14)/20 = %30`.
- Madencilik → sonda: `(14−10)/14 = %28,6`.
- Tersane → gemi üretimi tamamlandı: `(9−6)/9 = %33,3`.

Bu sayılar farklı kilometre taşlarına ulaşanların farkıdır. Her adım zorunlu ve aynı sırada değildir; farkların tamamı kesin terk, tasarım hatası veya aynı nedenden kayıp olarak yorumlanamaz. Özellikle yeni gemi üretimi bugünkü göç şartı değildir. Çevrimdışı tamamlanmış iş, oyuncunun sonucunu gördüğü anlamına gelmez.

Önceki analizde en az 30 dakika aradan sonra yeni manuel oyun eylemi görülen **2/23 hesap** vardı. Bu **D1 değildir**; Bölüm 11.4'teki sabit pencere, veri kapsamı ve olgunlaşmış payda ile tekrar uzlaştırılmalıdır. Bazı kişiler yalnız yeniden açmış, bazı kişilerde istemci telemetrisi kesilmesine rağmen sunucuya yeni manuel emir gelmeye devam etmişti. Bilinmeyen oynama süresini sıfır veya ilk-son olay farkı olarak dolduramayız.

İstemci hata örnekleri de görüldü: React hatası, WebGL context kaybı ve bağlamı eksik genel hata kayıtları. Bunlar hangi hatanın hangi oyuncuyu bıraktırdığını tek başına kanıtlamaz. Yeni akışın yanında hata görünürlüğü ve toparlanma da gereklidir. Bu belge için canlı kohort yeniden sorgulanmadı; yukarıdakiler tarihlenmiş önceki gözlemdir.

### 3.2 Araştırmadan alınan tasarım ilkeleri

Clash of Clans, Clash Royale, Whiteout Survival, EVE Online ve Hades' Star karşılaştırmasından aktardığımız fikir, bütün sistemler açılmadan önce oyuncunun anlamlı bir oyun döngüsü yaşayabilmesidir. Bu oyunların güncel ilk oturumları aynı yöntemle kronometreyle ölçülmedi; dakika veya retention sıralaması yapmıyoruz.

Apple'ın rehberi kısa ve bağlamsal öğretimi, erken bağımsız oyunu, atlanabilir ve yeniden açılabilir yardımı destekliyor. CHI 2012'deki 45.000'den fazla oyunculu çalışma, bağlamsal öğretimin karmaşık bir oyunda ilerleme ve oynama süresini iyileştirebildiğini; geri dönüşte otomatik bir artış göstermediğini bildiriyor. Sonuç: **Daha kısa giriş + gerçek karar + doğru anda yardım** sınanacak; yalnız sayacı kısaltmak başarı sayılmayacak.

Kaynaklar ve araştırma sınırları Bölüm 18'de, ayrıntılar araştırma raporundadır.

## 4. Kodda bugün gerçekte ne var?

Bu bölüm, `2055f65d4059de2c02752d5863261d2ebf2a199c` denetiminin özetidir. Satır numarası yerine dosya ve sembol verilmiştir; uygulama sırasında yeniden doğrula.

### 4.1 Açılış ve sahiplenme

- `apps/web/src/onboarding/TrainingDoor.tsx`, sunucu capability'si starter'ı açıyorsa `Prologue` seçer. Yanıt gelmez/gecikirse **2,5 saniye** sonunda `FlightSchool` seçebilir.
- `apps/web/src/onboarding/prologue/`, sinyal → hasarlı gemiyi bulma → sahiplenme kurgusunu içerir. Yerel prolog kaynakları gerçek hesaba ekonomik ilerleme olarak aktarılmaz.
- `apps/server/src/routes/onboarding.ts` ve `services/starter/enlist.ts`, gerçek hesabı ve starter durumunu sunucuda oluşturur.
- Hikâye ile gerçek başlangıç arasındaki süre ve hangi giriş yolunun görüldüğü ayrı ölçülmelidir. Bütün oyuncuların aynı akışı gördüğü varsayılmamalıdır.

### 4.2 İlk bütçe ve kısa onarımlar

Başlangıç: **930 alaşım, 300 kristal, 0 döteryum; üretim havuzunda toplanabilir 60 alaşım; Rafineri 1.** Başlangıç filosu, parça ve tank yakıtı sıfırdır.

| Onarım | Süre | Alaşım / kristal | Sunucudaki önemli sonuç |
| --- | ---: | ---: | --- |
| Rafineri 2 | 5 sn | 154 / 20 | İlk onarım; kasa açılabilir |
| Extractor 1 | 5 sn | 44 / 33 | Kristal üretimi |
| Teleskop 1 | 15 sn | 250 / 150 | **1 Prospector** verilir; yakındaki kayalar görünür |
| Radar 1 | 15 sn | 200 / 120 | Öncesinde `FIRST_MINING_SENT` gerekir |
| Survey 1 | 30 sn | 250 / 120 | Sonda/istihbarat aracı |
| Tersane 1 | 60 sn | 800 / 300 | **2 Dart** verilir |
| **Toplam** | **130 sn** | **1.698 / 743** | Kuyruk seri çalışır |

İlk beş onarım kasası toplam **1.500 alaşım / 690 kristal** verir. Mevcut teslim yolu kasayı ayrıca açtırır. Kasalar sınırlı ve tek seferliktir. Ödülleri yeniden eklemek gerekmiyor; keşfedilmesi zor teslimi düzeltmek gerekiyor.

### 4.3 Uzun çıkış zinciri

`packages/rules/src/starter/ladder.ts` içindeki 17 `required` onarımın seri toplamı **13 saat 1 dakika 40 saniye**, toplam bedeli **10.583 alaşım / 5.237 kristaldir**. Üç inşa kuyruk yeri, üç paralel onarım değildir.

Gerçek çıkış kontrolü, bütün `required` satırlarını doğrudan saymaz:

- `isJumpReady(progress)` yalnız `fuel >= 90` kontrol eder.
- `canLoadFuel(progress)`, `DRIVE_THRUST >= 1` ve `DEUTERIUM_PLANT >= 2` ister.
- İtiş onarımı için motor gövdesi ve 3 parça gerekir. Gövdenin de ileri rafineri, extractor, survey ve hangar önkoşulları vardır.
- Motor gövdesi **240 dk**, motor itişi **240 dk**; yakıt tesisleri **60 + 120 dk** sürer. Survey 2 **20 dk**, Hangar 2 **30 dk**, Rafineri 4 **60 dk** gibi işler de zincirdedir.
- Depo 1'i atlayabilen gerçek önkoşul yolunun iyimser saf onarım toplamı **12 saat 59 dakika 40 saniyedir**. Bu bir gerçek oyuncu bitirme süresi değildir.
- Yakıt üretimi motor onarımıyla örtüşebilir. Beklemeleri körlemesine toplayıp ayrıca saatler ekleme.
- Parçalar ortak hurda/karakollarda bulunabilir; küresel alt sınır yakın ve boş parça garantisi değildir. **Zafer zorunlu değildir.**
- **Yeni gemi üretimi de mevcut göç şartı değildir.** Yeni tasarım bunu çıkış şartı yapmamalıdır.

`departureBlock` ayrıca dışarıdaki kendi uçuşlarını ve sezonun **son 5 günü** kısıtını kontrol eder. Uygun ana dünya/frontier ve boş adres bulunması ayrıca gerekir.

### 4.4 Uçuşlar ve üretim

Gerçek uygulamada `economy-profile.ts` ile türetilen değerleri kullan; yalnız statik hull kataloğuna bakma.

- Dart üretimi Tersane 1'de yaklaşık **2 dk 30 sn**; mevcut iki Dart hibesi için üretim beklenmez.
- İlk karakolların örnek mesafesi 300–450 birimdir. Güncel Dart ile tek yön yaklaşık **3:18–4:57**, gidiş-dönüş **6:36–9:53**.
- Sonda aynı mesafede yaklaşık **54–82 sn gidiş-dönüş** sürer. Rapor hedefe varışta oluşabilse de okunabilir bilgi **sonda dönünce** teslim edilir.
- İlk maden için durağan hedef hesabı yaklaşık **54–108 sn** toplamdır. Kaya hareketlidir; gerçek hedefleme ve sunucu ETA'sı esas alınır.

Bu tasarım hull hızlarını, maden uçuş formülünü, karakol mesafelerini veya ana ekonominin genel çarpanlarını değiştirmez.

### 4.5 Ana galaksiye girişte zaten verilenler

`joinSeason` ilk gerçek sezon hakkını uygular. Uygun yeni hesap için mevcut `FIRST_SEASON_START`:

| Alan | Mevcut paket |
| --- | --- |
| Binalar | Core 3; Rafineri 2; Extractor 2; Depo 1; Tersane 1; Hangar 1; Döteryum Tesisi 0 |
| Donanım | Teleskop 3, Radar 2, Aegis 1, Uplink |
| Filo | 3 Dart, 1 Warden, 1 Prospector, 1 Courier |
| Kaynak | 1.500 alaşım, 1.000 kristal, 50 döteryum |
| Üretim havuzu | 84 alaşım, 36 kristal |

Göç kargosu bu paketin **üstüne** eklenir. Kargo sınırı **2.000 alaşım / 1.000 kristal / 50 döteryum / en çok 6 hasarsız gemi**; `migrationCargo` hasarlı lotları dışlar, uygun gemiler arasında değeri yüksek olanı önce seçer. Kargonun önizlemesi gerçek seçimle aynı olmalıdır.

Koşullu ilk oyun koruması başarılı ana katılımdan itibaren **72 saat**; diğer katılımlarda olağan **24 saat**tir. Hak hesap makbuzuyla korunur; tekrar giriş ve sezon temizliği yeni ilk oyun hakkı üretmez. Saldırıyla koruma bırakma kuralları geçerlidir. Korunan başkent, her dış filo ve koloninin aynı koşullarda dokunulmaz olduğu anlamına gelmez.

### 4.6 Sonuç kaydının gerçek anlamı

- `fleet.ts::landMission`, madencilik yükünü **üretim havuzuna** bırakır; `collectAtVessel` bunu depodaki harcanabilir stoğa taşır. Havuz tavanını aşan miktar kaybolabilir; `landHaulInWorks` bunu `wasted` olarak döndürür. “Yük geldi”, “toplanabilir” ve “harcanabilir” aynı an değildir.
- Mevcut `FIRST_MINING_RETURN`, eve dönen her `MINE` görevinde yazılır. Erken geri çağrılmış boş sefer de bunu üretebilir. Bu fact tek başına asteroidin gerçekten kazıldığını veya oyuncunun yükü topladığını kanıtlamaz.
- `probe.ts::landVesselProbe`, mevcut rapora `deliveredAt` yazabildiğinde `FIRST_PROBE_REPORT` verir. Bu kullanılabilir rapor kanıtıdır; istemcide okundu kanıtı değildir. Hedef kaybolmuşsa boş dönen sonda bu fact'i almaz.
- Göç kargosu hesaplanırken **stok + henüz toplanmamış üretim havuzu + aktif işlerin mevcut tam iadesi** dikkate alınır, sonra kargo tavanı uygulanır. Tank yakıtı ve mühürlü rezerv bu kargoya dahil değildir.

Bu ayrımlar yeni hazırlık koşullarında ve dashboard'da korunmalıdır; aynı adlı mevcut fact'e yeni, daha güçlü bir anlam yükleme.

## 5. Hedef tasarımın bağlayıcı kapsamı

Aşağıdaki kararlar uygulama paketinin tarifidir; Bölüm 17'deki onay durumu uygulanmadan önce kontrol edilir.

| ID | Hedef karar | Uygulama sonucu |
| --- | --- | --- |
| D01 | İlk ana giriş aynı oturumda | Hızlı yol 5–10, normal yol 10–15 dk hedefi |
| D02 | Hasarlı koloni gemisi hikâyesi korunur | Kısa, atlanabilir sahiplenme; ardından gerçek gemi |
| D03 | İlk altı kısa onarım korunur | Yukarıdaki maliyet/süreler ve mevcut filo hibeleri aynı |
| D04 | İlk beş kasa otomatik teslim edilir | Miktar değişmez; ayrı açma hareketi zorunlu olmaz |
| D05 | İlk gerçek maden dönüşü ve sonda sonucu starter'da | Uydurma sonuç, otomatik hedef seçimi veya göstermelik komut yok |
| D06 | Bağımsız ikinci seçim teşvik edilir | Aktivasyon ölçütüdür; yeni bir zorunlu göç kapısı değildir |
| D07 | Uzun çıkış zinciri kısa bağlantılarla ayrılır | 30 + 60 sn, sıfır ek A/C maliyeti, ileri modül seviyesi vermez |
| D08 | Kalkış rezervi sınırlı ve tek kullanımlık | Eksik 3 parça / 90 tank yakıtını tamamlar; normal stok olmaz |
| D09 | Üretim ve savaş dersi ana galaksiye taşınır | Üretim bitişi, savaş veya zafer giriş şartı olmaz |
| D10 | Ana dünya paketi ve kargo sınırı korunur | İkinci başlangıç paketi, ek savaş gemisi veya genel kaynak hibesi yok |
| D11 | Rehber sunucu ilerlemesinden ayrılır | Atla/duraklat/yeniden aç; cihaz değişince ekonomik ilerleme korunur |
| D12 | Yeni hesap için ilk kabul takvimden ayrılır | Son 5 gün kuralı yeni girişi günlerce kilitlememeli; sezon kararı gerekir |
| D13 | Sonraki 24–48 saat bağlamsal öğretim | İlk rapor, yeni hedef, üretim, kayıp, sosyal/savunma ihtiyacı |
| D14 | Ölçüm ve kararlılık ilk teslimin parçasıdır | Sunucu eylemi, görülen sonuç, aktif süre, hata ve dönüş ayrı ölçülür |

**Bu işin içine eklenmeyecekler:** Yeni savaş sistemi, yeni araştırma ağacı, bütün ana oyun ekonomisinin yeniden dengelenmesi, otomatik kazanılan eğitim savaşları, sınırsız telafi kaynakları, yeni sezon/galaksi açma otomasyonu veya yeni genel görev motoru. Var olan mekanikleri kullan; yalnız tarif edilen ilerleme kapısını ve sunuşu değiştir.

Oyuncuya görünen hiçbir dilde bot etiketi veya ayırt edici bot flag'i eklenmez. Admin analizi gerçek oyuncuları ve sunucu kontrollü hesapları ayırabilir; oyuncu arayüzü ve API'si bu ayrımı ifşa etmez.

## 6. Oyuncunun yaşayacağı yeni akış

### 6.1 Zamanın başlangıcı

Zamanları birbirine karıştırma:

- `entry_ready_at`: Oyuncunun açılışta ilk anlamlı etkileşimi yapabildiği an. Prolog varsa prologun oynanabilir anı. İstemci gözlemidir.
- `enlisted_at`: Claim sonrasında gerçek starter gemisinin sunucuda oluşturulduğu an.
- `starter_ready_at`: Gerçek starter snapshot'ının sahnede kullanılıp komut verilebilir olduğu an. İstemci gözlemidir.
- `launch_ready_at`: Sunucunun, uçuş ve kabul engellerinden bağımsız gemi hazırlığını ilk kez doğruladığı an.
- `main_entered_at`: Başarılı gerçek ana dünya kabulü; animasyonun bitişi değildir.

10–15 dakika hedefinin başlangıcı `entry_ready_at`tır. Gerçek starter'dan ana girişe süre de ayrıca raporlanır. Yükleme ve hesap oluşturma süreleri ayrı görünür; kullanıcının gördüğü toplam ilk açılış → ana giriş süresinden çıkarılıp gizlenmez. Kayıt öncesi yol, mevcut ölçüm tercihi izin verdiğinde hesaba bağlanır; eksik bağlantıya süre uydurulmaz.

### 6.2 Normal yolun zaman çizelgesi

Zaman aralıkları örtüşür; her satır önceki bittikten sonra başlayan ayrı sayaç değildir.

| Yaklaşık zaman | Oyuncu ne yapar? | Neyi öğrenir? | Gerçek doğrulama |
| --- | --- | --- | --- |
| 0:00–1:00 | Gücü bağlar, sinyali izler, gördüğü gemiyi sahiplenir | Bu benim gemim; buradan çıkacağım | Claim/enlist başarılı |
| 1:00–2:30 | İlk üretimi toplar; Rafineri 2, Extractor 1, Teleskop 1 | Üretim araçları açar; sensör fırsatı gösterir | Sunucu onarımları ve Prospector teslimi |
| 2:00–4:00 | Yakın kayayı seçer, kapasite/ETA'yı görür, madenci gönderir; dönen yükü üretim havuzunda görüp toplar | Seferin sonucu ile harcanabilir stok arasındaki bağ | Manuel dispatch + gerçek hedef sonucu/dönüş + gerçek toplama |
| 3:30–5:30 | Radar/Survey sonrası hedefe sonda gönderir; tersane paralelde onarılır | Görmek, hedefi bilmek değildir | Dönmüş gerçek sonda raporu; 2 Dart teslimi |
| 5:00–8:00 | Kendi filosuyla raporu kıyaslar; ikinci maden, ek sonda veya uygun başka hamle seçer | Bilgi seçimi değiştirir; belirsizlik sürer | Yeni manuel komut; rehber oyuncu yerine seçmez |
| 7:00–10:00 | 30 sn ve 60 sn bağlantıları yapar; kalkış rezervini bağlar; kendi uçuşlarını bekler | Gemi artık sıçrayabilir | Sunucu bağlantı kayıtları, rezerv hakkı, uçuşlar |
| 10:00–15:00 | Var olan iniş adaylarını kıyaslar; yükünü görür; ana dünyaya geçer | Konum bir tercihtir; macera devam eder | Tek sefer ana kabul + tek sefer kargo |

İlk sefer sürerken uygulamayı kapatmak her zaman mümkündür. Bu, uçuş sürerken ana dünyaya göç etmeye izin verileceği anlamına gelmez. Oyuncu isteyerek uzak hedef veya starter savaşı seçerse süre uzayabilir; gerçek ETA gösterilir. Hız hedefi için filoyu ışınlama veya seferi gizlice bitirme yapılmaz.

### 6.3 Sahne, rehber ve geri bildirim ayrıntıları

**Sahiplenme:** Anlatı 20–60 saniyelik anlaşılır bir sahneye sığmalıdır; tek tek bütün sistemleri tanıtmaz. Geminin silueti, arızalı bölgeleri ve açılan ışıkları görünür. Hikâyeyi atlayan oyuncu aynı gerçek starter haklarını alır. Hesap/claim başarısızsa başarılı sahiplik sahnesi oynatılıp oyuncu kaybolmaz; tekrar deneme ve mevcut hesaba giriş açık olur.

**Onarım → madencilik:** Teleskop tamamlandığında yeni kaya, kamera kadrajında okunabilir biçimde görünür. Oyuncuya ilk önce birkaç ekran dolaştırıp sonra “kayayı bul” denmez. Bir kez yakınlaşma ipucu ve her zaman erişilebilir odaklama kontrolü sunulur. Hedefe oyuncu dokunur; odaklama kendi başına emir göndermez. Kayada kaynak türü, kendi yük kapasitesi ve gerçek dönüş zamanı anlaşılır.

**Uçuş sırasında ve dönüşte:** Sahne gerçek filonun çıktığını gösterir. Kısa onarımlar yapılabilir; rehber uçuşu izlemenin tek doğru seçenek olduğunu dayatmaz. Maden dönüşünde gerçek yük üretim havuzuna gelir; mevcut toplama eylemini görünür biçimde öner ve harcanabilir stoğun bu eylemle arttığını göster. Gelen, havuza sığan, taşan ve depoya gerçekten taşınan miktarları karıştırma. İlk toplama zaten yapılmışsa aynı işlemi tekrar dayatma; ikinci bir ödül/claim ekleme. Havuz doluysa gerçek kaybı göster, sahte gelir yazma. Göç, mevcut kurala göre toplanmamış havuzu da taşıdığı için toplama açıklamasına basmak yeni bir ekonomik çıkış kapısı olmaz.

**Madencilik → sonda:** Kısa açıklama, “Nesneyi görmek savunmasını bilmek değil” fikrini taşır. Sonda için gerçek hedef ve bedel gösterilir. İlk karşılaştırma için mümkünse Tersane 1 ile sunulan gerçek ortak karakollardan uygun biri önerilir; oyuncu başka meşru hedefi de seçebilir. Boş bir asteroid raporunu savaş kararını öğreten savunma bilgisiyle eşdeğer sayma. Karakol henüz görünmüyorsa tersanenin gerçek tamamlanmasını veya mevcut başka uygun hedefi kullan; özel sahte hedef yaratma. Rapor, güncel kurala göre dönüşte kullanılabilir olur. Rakibin kesin durumunu istemciye erkenden sızdırma. Rapor, oyuncunun kendi filosuyla aynı ölçekte kıyaslanır; bilinen değer, aralık ve bilinmeyen açıkça ayrılır.

**İkinci karar:** Rehber “şuna bas” zincirinden geri çekilir. En az iki meşru seçenek anlaşılır: örneğin yeni maden veya başka hedefe sonda. Bir seçimin diğerinden niçin farklı olduğu görülebilir. “Kesin kazanırsın” hesabı veya otomatik hedef seçimi yoktur. Oyuncunun seçim yapmaması uygulamayı kilitlemez; ikinci karar bir analiz/öğrenme hedefidir.

**Kalkış:** Bağlantılar basit form doldurma hissi vermez. Güç bağlama için mevcut varlıklarla uygun şalter/bağlantı hareketi tasarla; sunucu kabulünden sonra ilgili bölüm aydınlansın. Her işlemde bekleyen, kabul edilen, tamamlanan ve hata durumu ayırt edilir. Sayacın kaynağı sunucudur. Sıçrama animasyonu başarılı ekonomik geçişin görselleştirmesidir; geçişi yapan otorite değildir.

**Öncelik:** Aynı anda yalnız bir ana rehber hedefi. Kasa, rapor ve sensör duyuruları hedefi sürekli kesen modal sırasına dönüşmez. Oyuncu bir hedef incelerken otomatik kamera başka yere kaçmaz. Bekleyen sonuçlar küçük, tekrar açılabilir bir iz bırakır.

**Mobil:** 350 px genişlikte gerçek dokunma akışı çalışır. Kritik eylem alt sheet'in dışında kalmaz, rehber başka eylemi örtmez, başparmak erişimi korunur. Ses, titreşim ve animasyon sonucu güçlendirir; temel durum ses kapalıyken de anlaşılır. Mevcut `ui-v2`, sound ve haptic düzenini kullan. Yeni arayüz uygulamasında güncel `CLAUDE.md` ve ilgili oyun/UI skill'leri uygulanır.

### 6.4 Ara verme, atlama ve geri gelme

Üç ayrı davranış sun:

| Tercih | Sonuç |
| --- | --- |
| Yardımı şimdi duraklat | Oyun sürer; yardım tekrar açılabilir; bu tercih “oyunu bıraktı” sayılmaz |
| Rehberi kapat / atla | Zorunlu anlatı engeli kalkar; kaynak hakkı kaybolmaz; gerçek sunucu şartları sürer |
| Yardımı yeniden aç | Mevcut gerçek ilerlemeden uygun adım bulunur; baştan onarım yaptırılmaz |

Üçüncü dakikada çıkıp geri gelen oyuncuya “Madencin döndü → gelen yük → şimdi yapabileceklerin” özeti göster. Henüz dönmemişse gerçek ETA ve yapılabilir başka iş göster. Sayfa yenileme, uygulamanın arka plana alınması ve başka cihazdan giriş sıralamayı bozmaz. Bildirim izni ancak oyuncu gerçek bir değer gördükten sonra, isteğe bağlı sunulur; kabul etmeyen aynı oyunu oynar.

## 7. Sunucu durumu ve yeni çıkış kuralı

### 7.1 İki farklı ilerleme türü

**Oyun ilerlemesi:** Onarımlar, gerçek seferler, raporlar, bağlantılar, ekonomik haklar ve göç; sunucuda kalıcıdır.

**Rehber sunumu:** Görülen açıklama, basılan “devam”, kamera ipucu, duraklatma; oyun sonucunun yerine geçmez. Bir açıklamayı gördüm isteği gemi, kaynak veya çıkış hakkı üretmez. Sunucu olgusu, oyuncunun ekranı gördüğünü de kanıtlamaz.

Önkoşullar tek bir sıralı ders zinciri değildir. İlişkiler:

```text
Claim → Rafineri 2 → Extractor 1 → Teleskop 1 → gerçek maden gönderimi
                                              ├→ hedefte gerçek sonuç → eve dönüş
                                              └→ Radar 1 → Survey 1
                                                            ├→ sonda → raporun eve teslimi
                                                            └→ Tersane 1 → A (30 sn) → B (60 sn)

İlk altı onarım + gerçek maden sonucu/dönüşü + kullanılabilir sonda raporu
  + A/B tamamlanması + geçerli kalkış bütçesi → GEMİ HAZIR

GEMİ HAZIR + kendi uçuşları yok + geçerli kabul/adres
  → DEPARTING → ana kabul → kargo teslimi → DEPARTED
```

Survey için madenin **gönderilmiş** olması dolaylı olarak gerekir; önce madenin dönmesi gerekmez. Sonda, tersane ve bağlantılar mümkün olduğunda diğer uçuşlarla örtüşür. Oyuncuya destek için önerilen sıra, sunucuda gereksiz yeni bekleme şartına dönüştürülmez.

Bu bir genel görev motoru kurma talebi değildir. Mevcut modül/fact/mission/migration verisini kullan; yalnız yeni bağlantı ve kalıcı hak için gereken az durumu ekle. Şema ve sembol adlarını repo stiline göre seç.

### 7.2 Yeni sürümün hazırlık koşulları

Yeni kısa yol için **sunucuda ortak bir hazırlık değerlendirmesi** olmalıdır. İstemci gösterimi, capability/unlock, göç önizlemesi ve gerçek göç komutu aynı kuralı kullanmalıdır.

Gemi hazırlığı için birlikte gerekenler:

1. Hesap, bu yeni akış sürümüne sunucuda atanmış olmalı; geçerli starter gemisi bulunmalı.
2. İlk altı kısa modül onarımı tamamlanmış olmalı. Kuyrukta olmak, tamamlanmış sayılmaz.
3. Gerçek bir asteroid madenciliği hedefte sonuçlanıp eve dönmüş olmalı. `FIRST_MINING_SENT`/`FIRST_MINING_RETURN` tek başına yeterli değildir: geri çağrılan veya worker kurtarmasıyla hedefe hiç ulaşmadan eve bırakılan görev gerçek maden sonucu sayılmaz. Mevcut kalıcı görev kanıtını kullan; ayırt edemiyorsa yeni kısa yol için küçük bir kalıcı sonuç makbuzu ekle, eski fact'in anlamını tüm oyun için değiştirme. Hedefte gerçekten çözülmüş ama başka oyuncu önce kazdığı için yükü 0 olan sonuç geçerlidir; “kaya boşaldı” gösterilir, yeni maden önerilir, pozitif ganimet zorunluluğu eklenmez.
4. Gerçek, dönmüş ve kullanılabilir ilk sonda sonucu bulunmalı. Mevcut `FIRST_PROBE_REPORT`, `deliveredAt` yazılan raporla oluşur. Yeni uygulama ve eski kayıt dönüşümünde bu anlamı koru; istemcinin okudum beyanını kullanma.
5. Kısa bağlantı A ve B sunucu saatine göre bitmiş olmalı.
6. Gereken 3 parça/90 tank yakıtı mevcut yatırımla veya henüz tüketilmemiş bir defalık kalkış rezervi katkısıyla karşılanabilmeli. Başlamış aynı göçe ayrılmış rezerv, o göçün devamı için geçerlidir; tüketilmiş hak ikinci başarılı kalkış yaratamaz.
7. Hesap/gemi başka bir göçü zaten tamamlamış veya çatışan bir sahiplik durumunda olmamalı. Başlamış aynı göçe tekrar istek yeni göç yaratmadan devam etmeli.

**Gemi hazır olsa bile çıkışı engelleyebilenler:** Dışarıda kendi uçuşu, uygun ana galaksi/adres yokluğu, süresi bitmiş sezon, yeniden seçilmesi gereken iniş adresi veya gerçek hizmet hatası. Bunlar “gemin tamir edilmedi” diye gösterilmez.

**Gerekli olmayanlar:** Yeni gemi üretim emri/bitişi; savaş/zafer/yenilgi; ileri onarımların hepsi; ikinci bağımsız komut; istemcinin rapor okudum/rehberi bitirdim beyanı; bildirim izni; belirli aktif dakika doldurmak.

Raporun görülmesi ve bağımsız ikinci karar, ana aktivasyon değerlendirmesinde aranır; ekonomik göç yetkisi değildir. Yardımı atlayan oyuncu gerçek maden ve sonda şartlarını yine oynar, fakat bütün açıklamalara basmak zorunda kalmaz.

### 7.3 Eski ve yeni sürüm

Yeni akışın önerilen atama anahtarı **`starter-fast-entry-v1`** olsun; henüz kodda mevcut bir sabit değildir. Mevcut rehber telemetrisinde `starter-tutorial.v2` zaten kullanılıyor. Bu sunum sürümünü yeni ekonomi/ilerleme ataması olarak yeniden kullanma. Atama, hesap ilk kez bu akışa alınırken sunucuda kalıcı yazılır; deney varyantı ve istemci rehber sürümü ayrı alanlardır. Yenileme, cihaz değişimi, dil veya capability yanıt sırası atamayı değiştiremez. Bu incelemeden önceki metindeki “ilk oturum v2” aynı önerilen hızlı yolu adlandırıyordu.

Eski normal çıkış yolunu kullanacak hesapların mevcut kuralı korunur. Yeni sürüm yalnız `fuel >= 90` ile çıkamaz. Global `isJumpReady` fonksiyonuna bütün hesapları etkileyen kestirme eklemek yerine sürümü ve gerçek yeni olguları hesaba katan ortak değerlendirmeyi bağla. `features.ts` içindeki `drive` ve `migration`, onarım yüzdeleri, `nextRequiredStep`, hedef satırı ve göç ekranı birlikte ele alınmalı; oyuncuya hâlâ 4 saatlik motoru “zorunlu sıradaki adım” diye gösterme.

Yüzdeler iki kavramı ayırmalıdır: **kalkış hazırlığı** ve **geminin bütün isteğe bağlı sistemleri**. Kısa bağlantılar tüm gemi %100 onarıldı veya ileri teknoloji kazanıldı anlamına gelmez.

### 7.4 Kısa motor bağlantılarının kesin sınırı

- A: 30 sn; B: A'dan sonra 60 sn. Her biri oyuncunun sunucuya gönderdiği gerçek başlatma komutuyla başlar.
- A, ilk altı kısa onarım tamamlanınca başlatılabilir. Maden veya sonda hâlâ dönüşteyse onlarla örtüşebilir. B için A'nın tamamlanması gerekir; 7.2'deki bütün şartlar yalnız son gemi hazırlığında birleştirilir. Yedinci dakika gibi duvar saati şartı eklenmez.
- Ek alaşım/kristal bedeli **0**. Hesap başına bir defalık kalkış hazırlığıdır.
- `startedAt`, `readyAt` ve tamamlanma sunucu saatine dayanır; istemci kapanınca süre sürer. B, A bitmeden başlatılamaz; iki cihaz süreyi atlayamaz.
- Bunları 240 dakikalık `DRIVE_HULL`/`DRIVE_THRUST` seviyelerinin ücretsiz bitişi olarak kaydetme. İleri seviyeler ve normal maliyetleri ayrı kalır.
- Yeni bağlantılar, kuyruğa alınmış isteğe bağlı 30 dakika/4 saatlik işin arkasında bekletilmez. Mevcut kuyruğu küresel olarak paralelleştirmek yerine küçük, ayrı kalkış checkpoint'i kullanmak tercih edilir. Başka çözüm seçilirse aynı süre/tek sefer/ekonomi değişmezleri test edilmelidir.
- Worker ve lazy settlement aynı tamamlanmayı iki kez uygulayamaz. UI sunucu snapshot'ından sayacı sürdürür.
- Eski hesapta tamamlanmış eşdeğer motor işi varsa ilgili bağlantı tekrar yaptırılmaz. Tamamlanmamış pahalı işin bulunması yeni kısa yola erişimi saatlerce kilitlemez; göçte mevcut iade akışı kullanılır.

### 7.5 Hedef yokluğu ve yarışlar

İlk araçların bulunması, hedefin hâlâ uygun olduğunu garanti etmez. Mevcut `ensureFirstRocks` ve ilk karakol tedarikini incele. Kayası tükenen, hedefi başka oyuncu tarafından alınan veya sondası sonuç üretemeyen oyuncu için yeni geçerli hedef göster. Gerçek bir maden/sonda sonucu olmadan fact uydurma.

Rehber hedef işareti bulunamadığında aynı görünmez butonu beklemesin. `mark_missing` yalnız log değil, çalışabilir geri dönüş gerektirir: sheet'i doğru yere aç, uygun sahneye dön, hedefi yeniden bul veya anlaşılır tekrar deneme sun. İlk kullanılabilir sonda hedefi için uzun tamir zinciri veya ilk zafer beklenmemelidir. Paylaşılan hedeflerin gerçek durumunu koru; çözüm olarak oyuncuya özel sahte savaş icat etme.

## 8. Kaynak bütçesi, kasalar ve kalkış rezervi

### 8.1 Erken yol için yeni genel kaynak gerekmiyor

| Kalem | Alaşım | Kristal |
| --- | ---: | ---: |
| Açılış stok | 930 | 300 |
| İlk toplanabilir üretim | 60 | 0 |
| İlk beş mevcut kasa | 1.500 | 690 |
| **Erişilebilir toplam** | **2.490** | **990** |
| İlk altı onarım | −1.698 | −743 |
| İlk sonda | −65 | −40 |
| **Teorik kalan** | **727** | **207** |
| İsteğe bağlı ikinci sonda sonrası | **662** | **167** |

Bu hesap pasif üretim, madencilik geliri ve isteğe bağlı harcamaları içermez; bütün oyun ekonomisi simülasyonu değildir. Sonuç, erken yol için daha fazla hibe değil, mevcut bütçenin doğru teslimi ve korunması gerektiğidir.

### 8.2 İlk beş kasanın teslimi

Yeni sürümde aşağıdaki mevcut haklar ilgili onarım tamamlanınca otomatik teslim edilir:

| Kasa ID | Alaşım / kristal |
| --- | ---: |
| `REFINERY:2` | 150 / 40 |
| `TELESCOPE:1` | 650 / 200 |
| `RADAR:1` | 150 / 100 |
| `SURVEY:1` | 300 / 150 |
| `SHIPYARD:1` | 250 / 200 |

Tamamlanma ile kaynak teslimi aynı kilit/transaction güvencesinde olmalıdır. Kasa makbuzu mevcut claim yolu ile ortak olmalı; eski “aç” isteği ikinci kez ödeme yapamamalı. Önceden açılmış kasa tekrar verilmez. Yeni sürüme geçen eski hesapta hazır ama açılmamış kasa bir kez teslim edilir. Diğer kasaların miktarı ve şartları kendiliğinden değişmez.

Oyuncu ne aldığını görür; ayrı bir basılı tutma veya modal onayı bütçeyi kilitlemez. Aynı anda birkaç kasa açıldıysa bildirimler oynanışı bloke etmeden özetlenebilir.

### 8.3 Erken zorunlu bütçeyi koruma

Onarım sırası ve mevcut sunucu kilitleri mümkün olduğunca kullanılmalıdır. Yeni ve genel bir cüzdan sistemi kurmak hedef değildir. Korunacak değişmez:

> Geçerli kısa yolu izleyen ve mevcut haklarını alan oyuncu, erken isteğe bağlı harcamalar yüzünden temel araçlarını açamaz veya ilk gerekli sondayı gönderemez duruma düşmemelidir.

İlk araçlar tamamlanana kadar ilgisiz harcamayı gerçekten sunucuda kısıtla; yalnız butonu gizleme. Ardından ilk kullanılabilir sonda raporu teslim edilene kadar, isteğe bağlı harcama sonraki gerekli sondanın **65 alaşım / 40 kristal** bütçesini tüketmemeli. İlk sonda komutunun kabulü, raporun geleceğini garanti etmediği için korumayı tek başına kaldırmaz. Korunan tutar meşru sonda komutunda harcanabilir; amaç bu eylemi kilitlemek değildir. Harcanabilir bakiye ve korunan miktar anlaşılır görünür. Mevcut erken sıra bunu sağlıyorsa yeni cüzdan/rezerv tablosu ekleme; eksik kalan yazma yollarını kapat.

Bu koruma sonsuz yeniden deneme bütçesi veya her kötü seçimden sonra otomatik para basma değildir. Hedef yarışı, sunucu kaynaklı iptal, zorunlu aracın kaybı gibi tekrar gereken durumları ayrı test et; mevcut iade/toparlanma yolu yetersizse ekonomi politikasını açıkça belirlemeden sınırsız refill ekleme.

### 8.4 Mühürlü kalkış rezervi

Rezerv normal kaynak değildir. Gereken tamamlamanın hesabı:

```text
eksik_parça = max(0, 3 - mevcut_geçerli_parça)
eksik_tank  = max(0, 90 - zaten_yüklenmiş_geçerli_tank_yakıtı)
```

Bu değerler en çok 3 ve 90'dır. Genel stoktaki döteryum, tanktaki yakıtla aynı alan değildir. Varsa mevcut yüklenmiş yakıtı dikkate al; harcanabilir döteryumu otomatik boşaltma.

- Hızlı giriş hakkı olan hesap için rezerv bir kez başarılı kalkışta kullanılabilir. Hak, rehber veya atama sürümü değişince yenilenmez.
- Önizleme yalnız eksik katkıyı gösterir. Gerçek katkı, kalkışın ekonomik olarak sabitlendiği transaction'da son durumdan hesaplanır ve makbuza yazılır.
- Katkı, normal `alloy/crystal/deuterium`, ticaret stoku, sefer yakıtı veya transfer edilebilir parça olarak eklenmez. Kalkış ihtiyacı için tüketilmiş kabul edilir; kargo hesabına girmez.
- 3 parçası ve 90 yüklü yakıtı olan hesap fazladan 3/90 kazanmaz. 1 parça/30 tank yakıtı olan hesap yalnız 2/60 katkı alır.
- Sayfa yenileme, tekrar giriş, iki cihaz, retry, yeniden kurulum, sezon temizliği ve yeni onboarding sürümü ikinci hak üretmez.
- Başarısız transaction hakkı yemez. Aynı `DEPARTING` denemesinin devamında aynı rezerv ve kargo kullanılır. Ana kabul gerçekleşmeden geminin geri verildiği `FAILED` yolu farklıdır: yeniden kullanılabilir hak ile yeni deneme davranışı Bölüm 10.2'de tanımlıdır.
- Var olan parçalar, tank, kaynaklar, gemiler ve kasa kayıtları yeni sürüme geçişte sıfırlanmaz.

Önerilen ek hibe sınırı: **savaş gemisi 0, genel alaşım 0, genel kristal 0, yalnız eksik kalkış parçası ≤3, yalnız eksik tank katkısı ≤90**. Mühürlü rezervi “her eksiği otomatik karşılayan yardım” sistemine dönüştürme.

### 8.5 İleri onarımlar ve yenilgi

Uzun modüller starter'da daha uzun kalmak isteyen için normal maliyet/süreyle kalabilir; kısa yol bunları zorunlu “sonraki iş” yapmaz. İleri seviye, araştırma ve harcamalar ana dünyaya yeni hak olarak aktarılmaz. Onların mevcut ekonomik/kargo anlamı önizlemede açık olmalıdır.

Mevcut ilk yenilgi kasası **310 alaşım / 125 kristal**dir. Bu belge, aynısını ana dünyada ikinci kez verme kararı değildir. İlk ana dünya yenilgisi için yeni bir toparlanma hakkı istenirse Bölüm 17 kapsamında ayrıca sonlu, tek seferlik politika belirlenir. Bu ilk uygulamanın varsayılanı yeni yenilgi hibesi eklememektir. Zafer garanti edilmez; yeniden savaşmak rehber şartı olmaz.

## 9. Ana galakside ilk 24–48 saatin devamı

### 9.1 Varış anı

`ArrivalHost` ve mevcut iniş ipuçlarından yararlan. Yeni, bütün ekranları sırayla açan ikinci bir tutorial yazma. Oyuncuya şu üç bilgi kısa ve somut görünmelidir:

1. **Burası benim yeni üssüm:** Seçilen konum ve sahip olunan gezegen sahnede anlaşılır.
2. **Neyim var:** Mevcut ilk sezon paketi ile gerçekten taşınan kargo ayrı gösterilir. Aynı gemi iki kez kazanılmış gibi sunulmaz.
3. **Şimdi ne yapabilirim:** Yakındaki gerçek fırsata maden/keşif, uygun bir hedefe istihbarat veya anlamlı bir üretim tercihi.

İlk varışta bütün klan, koloni, sıralama, anıt, araştırma ve savaş sistemlerini tanıtmak gerekmez. Mevcut yetenekler kaybolmaz; rehber dikkatini oyuncunun o anki kararına verir.

### 9.2 Öğretim sırası: zaman değil ihtiyaç tetikler

| Dönem | Tetikleyici | Verilecek yardım | Oyuncunun kararı |
| --- | --- | --- | --- |
| Varış / ilk oturum | Gerçek ana sahne hazır | Konum, koruma kapsamı, mevcut filo, ilk fırsat | İlk ana dünya hedefini seçmek |
| İlk uygun karşılaşma | Kullanılabilir istihbarat ve gerçek filo | Kendi güç/kompozisyonu ile hedefin bilinen-belirsiz durumunu karşılaştırma | Savaşmak, daha fazla bilgi toplamak veya vazgeçmek |
| İlk üretim ihtiyacı | Oyuncunun seçtiği hedefte kapasite/filo açığı | Yeni geminin neyi değiştireceği, bedeli, tamamlanma zamanı | Savaş gücü mü, taşıma mı, mevcut araçlarla devam mı? |
| İlk rapor dönüşü | Gerçek sonuç oluştu | Giden, dönen, kaybedilen/kazanılan ve yeni bilgi | Aynı hedef, farklı hedef veya hazırlık |
| İlk kayıp | Gerçek yenilgi / hasar | Kaybın anlaşılır açıklaması ve mevcut toparlanma seçenekleri | Yeniden kurmak, farklı yaklaşmak veya başka iş yapmak |
| 0–24 saat | Devam eden gerçek görev/iş | Kalan süre, sonuç özeti, bir sonraki karar | Ne zaman ve ne için geri geleceğini seçmek |
| 24–48 saat ve sonrası | Komşuluk, risk veya ortak hedef ihtiyacı | Uygun anda klan, savunma, koloni gibi mevcut sistemler | Sosyal/stratejik yön seçmek |

Ana harita rastgele mesafeler içerir. “İlk savaş 20. dakikada kesin sonuçlanacak” gibi bir kabul koşulu yoktur. Yakında uygun karşılaşma yoksa gerçek keşif/madencilikle devam edilir. İlk gerçek sonuç starter'daki maden dönüşünden zaten görülmüş olmalıdır.

### 9.3 İlk gönüllü ara

Oyuncu ne başlattığını, ne zaman sonuçlanacağını ve döndüğünde neyi değerlendireceğini bilerek çıkabilmelidir. Bir gerçek sefer veya seçilmiş üretim bu nedeni oluşturabilir. Oyunu zorla kapattıran bekleme, bildirim izni duvarı veya sahte geri sayım yapılmaz.

Geri geldiğinde önemli sonuç kısa özetlenir, ilgili rapora gidilebilir ve yeni karar görünür. Her otomatik üretim tikini yeni kazanım ekranına dönüştürme. Kullanıcı bildirimleri reddederse kayıp hak veya eksik öğretim oluşmaz.

### 9.4 Güvenlik ve PvP

Mevcut 72 saatlik ilk oyun hakkının gerçek başlangıcı, kapsamı ve kalan süresi gösterilir; uygun olmayan hesap için varmış gibi anlatılmaz. Koruma bırakmaya neden olacak eylemde mevcut açık rıza akışı korunur. Öğretim, başka oyuncuya saldırmayı veya korumayı bırakmayı şart koşmaz.

Başkent sahipliğinin korunması, kaynak yağması, dışarıdaki filonun riski ve koloni sahipliği aynı kural değildir. İlk riskli karar öncesinde yalnız o kararı anlamaya yetecek açıklama ver; bütün Wiki'yi okutma. Starter'da erken Aegis vererek PvP/pirate tetiklerini istemeden değiştirme.

## 10. Sezon, eski hesaplar, uyumluluk ve geri alma

### 10.1 Son beş gün ve boş yer

Mevcut `departureBlock`, sezon bitimine 5 günden az kalınca göçü engeller. Bu kural aynen yeni hesaplara uygulanırsa 10–15 dakikalık ana giriş hedefi yılın/season'ın belirli bölümünde mümkün değildir.

**Önerilen ürün kuralı:** Gerçekten ilk kez ana dünyaya girecek hesap için ilk kabul uygun açık ana galaksiye yönlendirilir; yalnız starter göçünün son 5 gün kısıtı nedeniyle günlerce bekletilmez. Bu istisna mevcut oyuncuların stratejik sezon/galaksi göçlerine yayılmaz.

“İlk giriş” uygunluğu yalnız `firstSeasonStartedAt === null` veya yeni bir istemci flag'iyle belirlenmez; mevcut eski katılım/oyun makbuzları da kontrol edilir. İlk oyun koruma hakkı ile ilk kabul uygunluğu ayrı haklardır.

Uygulama, `openFrontier`, `resolveJoinTarget`, adres ayırma ve sezon sınırı kontrolüyle birlikte değerlendirilmelidir. Süresi bitmiş sezona kabul, dolu yere yerleştirme, başka oyuncunun dönüş için tutulan adresini alma veya kendiliğinden yeni galaksi açma yapılmaz. Uygun hedef yoksa bu gerçek bir **kabul engeli**dir; anlaşılır durum ve tekrar deneme verilir, ayrı ölçülür. Hazır oyuncuya tekrar motor tamiri önerilmez.

**Reset sınırı çözülmeden yalnız son 5 gün kontrolünü silmek yeterli değildir.** `servers.ts::bootstrapServersIn`, birlikte açılan ana galaksileri aynı başlangıç/dönemle kurar; başka galaksinin mutlaka daha genç olduğunu varsayma. Birkaç dakika sonra sıfırlanacak dünyaya giren hesabın ilk sezon paketi ve ilk koruma hakkı sonraki katılımda otomatik yenilenmez. Hızlı giriş yapmış görünürken oyuncunun ilk öğrenme dünyasını hemen kaybetmesi yeni bir kırılma yaratır.

Bu nedenle K2, hem ilk kabul istisnasını hem reset öncesi kabulün sonuçlarını kapsar. Kalıcı ilk hakları yeniden dağıtma veya yeni sezon açma politikası bu belgeyle icat edilmez. K2 kesinleşene kadar normal tempo pilotunu, hedef sezonunda en az 48 saat kalan durumlarla sınırla; bütün takvim için 15 dakika vaadi yayınlama. Bu sınır önerilen pilot koşuludur, sessizce kalıcı yeni kabul kuralı ekleme yetkisi değildir. Gemi hazırlığı ve gerçek kabul süresi ayrı raporlanır; dolu galaksi/takvim beklemesi gizlenmez.

### 10.2 Göç denemesi, hata ve yarım göç

Mevcut göç tek transaction değildir. `commitDeparture → carryOut` içinde dört tekrar çalıştırılabilir adım vardır:

1. Gemiyi kilitle; ilerlemeyi güncelle; şartları yeniden doğrula; aktif işleri mevcut kurala göre iade et; **stok + üretim havuzu + iade** üzerinden gerçek kargoyu tavanla sabitle; `DEPARTING` yaz.
2. Ana dünyada geçerli bir yer al; ilk sezon ve koruma haklarını mevcut `joinSeason` makbuzları üzerinden uygula.
3. Kargoyu gezegen kilidi ve `cargoLanded` güvencesiyle bir kez teslim et.
4. Starter kaydını terminal duruma getir; istemcileri yeni gerçek duruma yönlendir.

İki hata yolunu ayrı uygula:

| Durum | Mevcut kod | Yeni rezerv/kargo davranışı |
| --- | --- | --- |
| Süreç kesildi veya geçici teknik hata | Gemi/deneme `DEPARTING` kalabilir; istek veya sweep devam eder | Aynı denemenin sabit kargosu ve rezervi kullanılır; yeni ödeme yok |
| Kabul reddedildi, gerçek ana yerleşim yok | `handBack`, denemeyi `FAILED`, gemiyi `ACTIVE` veya `DORMANT` yapabilir | Oyuncu gemisini kullanabilmeli; kullanılmamış kalkış hakkı kaybolmamalı. Yeni denemede güncel durumdan kargo yeniden hesaplanır |
| Eşzamanlı başka çalıştırma zaten yerleşti | `handBack` mevcut yerleşimi döndürür; göç sürer | Gerçek yerleşim korunur; hakkı serbest bırakıp ikinci teslim üretme |
| Eski çalıştırmanın yerleşimi gemi geri verildikten sonra geldi | `keepHold` gemiyi yeniden kilitleyip o andaki varlığı tekrar sabitleyebilir | Eski kargo ile artık harcanmış güncel varlığı birlikte teslim etme; aynı hesapta tek geçerli kalkış ve teslim kalmalı |

Bu yüzden “her retry'da kargo aynı kalır” veya “her hatada gemi hep donmuş kalır” kuralı yanlıştır. **Aynı devam eden denemede** sabit kargo; **gerçekten geri verilmiş gemiden başlayan yeni denemede** yeni sabitleme vardır. Mevcut `vesselMigrations` satırı gemi başına güncellenebilir; satır kimliğini her yeni denemeye ait değişmez kimlik sanma.

Yeni rezerv için asgari anlamlar:

```text
AVAILABLE → RESERVED(deneme kimliği) → CONSUMED(başarılı kalkış)
                         └→ gemi gerçekten geri verildiyse AVAILABLE
```

Bu bir önerilen durum sözleşmesidir; yeni genel muhasebe/saga altyapısı istemiyoruz. Rezerv, 1. adımda aynı ekonomik sabitlemeyle o denemeye ayrılır. Başarılı terminal kalkışta tüketilmiş kalıcı hak olur. Yerleşimden önce crash olursa ayrılmış hak aynı denemeye aittir; `FAILED` ile gemi geri verildiğinde başarı hakkını tüketmiş sayılmaz. Bir önceki çalıştırmanın geciken hata yanıtı, yeni denemeye ait rezervi serbest bırakamaz; sunucu tarafından üretilen deneme kimliği ve kilit altında durum kontrolü gerekir. Geçerli ana yerleşim/kargo varsa hak geri açılmaz. `keepHold`, `handBack`, sweep ve yeni istek yarışlarını aynı makbuzla birlikte test et.

Forced wipe, kabul ile teslim arasına girerse mevcut `WIPED` yolunu koru; kaybolan yerleşim ile geçerli yerleşimi ayır. Mevcut ilk sezon/koruma makbuzlarının wipe sonrası yeni hak üretmemesi değişmez. Başarısız bir kalkış denemesi, rezervin kalıcı kaybıyla hesabı çıkamaz durumda bırakmamalıdır.

İniş önizlemesi yalnız mevcut, gerçekten sunulan `landingChoices` adaylarını kullanır. Kod zaten komşuluk yoğunluğu farklı adaylar sunuyor; yeni bir üç seçenek sistemi icat etmek gerekmiyor. Seçilen adres arada dolduysa `LANDING_GONE` veya eşdeğer durumla yeni seçim yaptır; sessizce başka adrese bırakma. Sezon/adres kabul anında yeniden doğrulanır; ilk sezon ve koruma hakları başarılı kabule, kalkış rezervinin kesin tüketimi yukarıdaki başarılı kalkış durumuna bağlıdır.

Aday sayısı boş adres durumuna göre üçten az olabilir. Komşu sayısı, risksizlik veya kesin zafer vaadi değildir. Genel HTTP yolu oyuncudan yalnız izinli iniş seçimini alır; servis içindeki `force`/`season` gibi operasyon seçeneklerini veya yeni hak/atama alanlarını client kontrolüne açma.

### 10.3 Mevcut starter hesapları

Sürüm geçişi için küçük ve test edilebilir bir dönüştürme kuralı yaz:

- Mevcut hesap, gemi, modüller, tamamlanmış gerçek olgular, filo/hasar, kaynaklar, tank, parçalar, açılmış kasalar ve görevler korunur.
- `DEPARTING` geminin kuralları ve denemesi ortasında değiştirilmez; mevcut yolundan tamamlanır. Eski kuralla zaten çıkışa hazır hesabın kazanılmış çıkışını yeni kanıt/rehber şartıyla geri alma; bu hesap eski çıkış yolunda kalabilir. `DEPARTED` hesap yeni starter akışına dönüştürülmez.
- Yeni akışa alınan hesap tamamladığı temel işleri tekrar yapmaz. Yalnız yeni kısa bağlantının eksik kalan anlamlı kısmını ve eksik kalkış hakkını alır.
- Tamamlanmış eski motor gövdesi A'yı, tamamlanmış itiş B'yi karşılar. Bu eşleme ekonomik seviye veya ek hibe üretmez.
- Devam eden pahalı onarımlar erken göçü 4 saat bekletmez. Göçte mevcut `cancelAllOrders` tam iade kuralı kullanılır; kargo tavanı uygulanır.
- Normal oyuncu iptalindeki yarım iade ile göçteki tam iade birbirine karıştırılmaz.
- Tamamlanmış pahalı yatırımlar için bugün varsayılan yeni telafi **yoktur**. Buna farklı karar verilecekse tutar, uygunluk ve makbuz netleşmeden ödeme eklenmez. Bölüm 17'deki geçiş kararı alınır.
- Zaten ana dünyaya geçmiş hesabın ilk sezon paketi veya 72 saatlik hakkı yeniden verilmez.
- Eski hesabı yeni hesap retention kohortuna dahil etme; ayrı geçiş kohortu tut.

Bu bölüm, silinen/boşalan starter yerlerinden yararlanıp tekrar hesap başlatmaya sınırsız hak tanımaz. Hak yaşam döngüsü gemi satırına veya cihaz belleğine tek başına bağlı olmamalıdır.

### 10.4 Eski istemci, capability ve yayın sırası

`TrainingDoor` timeout'u nedeniyle yanlış giriş yoluna düşme ayrıca çözülmelidir. İlk açılışta capability gelmeden yanlış öğretimi başlatıp sonra akışı değiştirme. Retry/güncelleme/güvenli fallback politikası açık olsun; hangi yolun seçildiği ölçülsün.

Sıra:

1. Geriye uyumlu, eklemeli şema değişikliği ve sunucu okuma/yazma desteği.
2. Yeni sürüm atanmış hesabın kurallarını destekleyen sunucu; eski hesaplarda eski yol.
3. Capability ve snapshot sürümünü anlayan web/Android istemcisi.
4. Doğrulanmış istemciler için sınırlı yeni hesap ataması.

Kimliği olmayan açılış capability'si **sunucunun desteklediği yolu** söyler; hesaba kalıcı atama yapmaz. Gerçek atama enlist/hesabın yeni akışa alınması sırasında sunucuda tek sefer yazılır ve authenticated snapshot'ta geri verilir. Claim başarılı olup yanıt kaybolursa tekrar claim/giriş aynı atama ve ekonomik durumdan devam eder. İstemci destek sürümünü bildirebilir; kendi ekonomik varyantını, hibesini veya geçmişini seçemez.

Uyumsuz eski istemciye hızlı giriş hesabı atayıp onu eski `fuel>=90`/uzun motor ekranında bırakma. Hızlı girişe zaten atanmış hesap eski istemciyle giriş yaparsa haklarını eski biçime geri çevirme; desteklenen istemciye güncelleme veya güvenli devam yüzeyi sun. Aynı hesapta iki akışın ödüllerini birleştiren fallback yapılmaz. Tam uyumluluk davranışı koddan ve native yayın biçiminden doğrulanır.

### 10.5 Geri alma

Yeni sürüm atamasını kapatan sunucu kontrolü bulunmalı. Geri alma:

- Yeni hesapların hızlı giriş sürümüne alınmasını durdurur.
- Atanmış hesapların verilmiş haklarını silmez, kaynak geri çekmez, onları uzun zincire zorla geri atmaz.
- Başlamış göçleri, verilmiş rezerv makbuzlarını ve kargo teslimini okuyup tamamlayabilen sunucu desteğini korur.
- Sorunlu yüzeyi düzeltir veya güvenli devam ettirir; canlı DB'yi eski snapshot'a döndürüp sonraki yazmaları kaybetmez.
- İptal edilen yayını ve etkilenen hesapları ölçümde ayrı sürüm olarak görünür bırakır.

## 11. Ne loglanacak, nasıl analiz edilecek?

### 11.1 İlke ve veri kaynağı

Oyun hakkı için gereken kayıt her zaman sunucudadır. İsteğe bağlı analiz, oyun komutunu başarısız kılmamalı; telemetri tercihini geçersiz kılmamalıdır. İstemci ölçümü olmayan hesaplarda mevcut sunucu emir/sefer/göç kayıtları üzerinden yalnız gerçekten bilinen ilerleme raporlanır.

Her önemli yetenek için şu zincirin eksik halkası anlaşılabilsin:

```text
Açıldı → gerçekten gösterildi → oyuncu denedi → sunucu kabul etti
→ gerçek sonuç oluştu → oyuncu sonucu gördü → yeni karar verdi
```

“Modül bitti” ile “ders görüldü”, “sonuç oluştu” ile “rapor okundu”, “oyun açıldı” ile “manuel oyun eylemi yapıldı” farklı olaylardır. Sonraki adım var diye önceki adımların hepsi gerçekleşmiş sayılmaz.

### 11.2 Olay sözleşmesi

Aşağıdaki adlar **mantıksal olay sınıflarıdır**; mevcut event adlarını kontrol et, eşdeğeri varsa onu genişlet. Aynı anlama gelen ikinci paralel event ailesi üretme.

| Olay sınıfı | Yetkili kaynak | Asgari anlamı |
| --- | --- | --- |
| Giriş yolu seçildi | İstemci + sunucu ataması | Prolog/FlightSchool, capability sonucu, bekleme/timeout, sürüm |
| Sahne hazır | İstemci | Açılış veya gerçek starter/main sahnesi komut alabilir |
| Rehber adımı görüldü / kapatıldı | İstemci | Görünen adım, yüzey, sürüm; yalnız render çağrısı yeterli değil |
| Eylem denendi | İstemci | Eylem türü, hedef türü, attempt kimliği; kabul demek değil |
| Eylem kabul edildi | Sunucu iş kaydı | Manuel köken, komut/iş/sefer kimliği, zaman |
| Eylem reddedildi | Sunucu sonucu + izinli istemci gözlemi | Hata kodu, eksik önkoşul/tutar; hassas metin yok |
| Sonuç oluştu | Sunucu | Onarım/üretim/sonda/maden/savaş gerçek sonucu |
| Sonuç görüldü | İstemci | İlgili rapor/sonucun gerçekten açılıp görünmesi |
| Kalkış bağlantısı başladı/bitti | Sunucu | A/B, başlangıç/bitiş, hesap hakkı |
| Gemi kalkışa hazır / kabul engeli | Sunucu | İlk hazır zamanı, engel kodu ve değişimi |
| Göç başladı / ana kabul / kargo indi | Sunucu | Aynı göç kimliğiyle aşamalar; retry ayrı başarı değil |
| Ön plan / arka plan / tekrar açılış | İstemci | Oturum ve aktif süre kanıtı; otomatik sonuç eylem sayılmaz |
| Hata / toparlanma | İstemci | Hata sınıfı, build, yüzey, fingerprint, toparlandı mı? |

Ortak bağlam, mevcut tercihler ve API sözleşmesi izin verdiği ölçüde: hesap/ziyaret/oturum bağlantısı, sunucu ve olay zamanı, event/attempt/komut kimlikleri, onboarding ataması, build/commit, platform, dil, ekran, hedef türü, rehber modu ve ana kabul durumu. Edinim kaynağı varsa kaynağını koru; bilinmiyorsa bilinmiyor göster.

Komut kimliği veya idempotency anahtarı üzerinden deduplicate et. Aynı retry yeni komut, yeni sefer veya ikinci geri dönüş sayılmaz. Worker sonuçlarına `manual` köken yazılmaz. Önemli ekonomik olgu ile isteğe bağlı analitik yazımını aynı başarısızlık kaderine bağlama.

Mevcut `apps/web/src/api/analyticsSchemas.ts`, olay adlarını ve property'leri katı Zod allowlist'iyle sınırlar. Yeni alanı yalnız `emit` çağrısına eklemek yeterli değildir: istemci sözleşmesi, sunucu ingest/recorder, gerektiğinde admin şeması ve rapor modeli birlikte güncellenir. Yeni hata bağlamı da aynı temizleme/boyut sınırlarından geçmelidir. `starter-tutorial.v2` rehber sürümü, `starter-fast-entry-v1` akış ataması ve deney varyantı birbirine karıştırılmaz.

**Manuel eylem kanıtı:** `orderedAt` zaman damgasının bulunması tek başına insanın komut verdiğini kanıtlamaz; internal/admin emirlerini mevcut köken alanlarıyla ayır. Starter kayıtlarının yeterli köken ayrımı yoksa yeni komutlarda küçük bir güvenilir köken/makbuz kaydı ekle. Eski belirsiz kaydı geriye dönük kesin manuel diye etiketleme. `players.lastActiveAt` ve `vessels.lastSeenAt`, çevrimiçi olma sinyalidir; tek başına R30/D1 eylemi değildir.

**Ana galaksi sonrası kapsam:** Dashboard şu an büyük ölçüde starter emir/seferleri ve isteğe bağlı analitiğe dayanır. Yeni analizi `DEPARTED` noktasında durdurma. Ana dünyada manuel `buildOrders`, `researchOrders`, `missions`, `miningRuns` ve diğer kapsanan gerçek komut kayıtlarını da mevcut provenance ile takip et; `analyticsFacts.ts` kaynak haritasını incele. Yalnız son aktif zamanını okuyarak “geri döndü ve oynadı” sonucu çıkarma. Hangi eylem türlerinin tam, kısmi veya hiç izlenmediği raporda belirtilir.

### 11.3 Süreler

| Ölçüm | Tanım | Bilinmeyen durumda |
| --- | --- | --- |
| Toplam ilk giriş süresi | İlk açılış → gerçek ana kabul | Eksik başlangıç varsa eksik |
| Oynanabilir açılıştan süre | `entry_ready_at` → ana kabul | İstemci ölçümü yoksa bilinmiyor |
| Gerçek starter'dan süre | `starter_ready_at` → ana kabul | Enlist zamanını sessizce yerine koyma |
| Sunucu hazırlık süresi | `enlisted_at` → ilk hazırlık doğrulaması | İlgili sunucu olgularıyla hesaplanır |
| Gözlenen ön plan süresi | Hazır oyun sahnesinde görünen uygulamanın ölçülmüş aralıkları; çakışmalar birleştirilir | Yoksa bilinmiyor; kısmi ise kısmi |
| Gözlenen etkileşim süresi | Mevcut input sonrası etkinlik pencereleri/`interactionSlices`; örtüşmeler birleştirilir | Yoksa bilinmiyor; yalnız ön plan süresinden türetilmez |
| Son manuel eylem | Son tekil, sunucuca kabul edilmiş anlamlı oyun komutu | İşin otomatik bitişi kullanılmaz |
| Engel süresi | Oyuncu aktifken görülen engelde geçen süre | Eksik görünürlük toplam engel süresi değildir |

İlk-son olay farkı aktif oynama süresi değildir. Ön planda açık uygulama ile etkileşim de aynı ölçüm değildir. Mevcut istemci input'tan sonra yaklaşık 60 saniyelik etkinlik aralığı açar; `interactionMs` fiziksel olarak 60 saniye dokunulduğu anlamına gelmez. Okuma/düşünme süresinin tamamını da kanıtlayamaz. Bu yüzden iki gözlenen süreyi adlarıyla ayrı göster; birini koşulsuz “kesin oynama dakikası” yapma. Aynı hesaptaki örtüşen cihaz/sekme örneklerini iki kez toplama. Telemetri kesilip yeni sunucu eylemi gelirse ilgili süreyi kısmi işaretle; 0 dakika yazma.

Ana giriş süresi dağılımında yalnız giriş yapanlar bulunur; girmeyenlerin sürelerini 0 yapma veya onları görünmez bırakma. Medyan/P90 yanında bütün atanmış kohortun **10/15/30 dakika içinde hazır olma ve gerçekten girme oranını**, henüz gözlem süresi dolmayanları, hiç girmeyenleri ve veri kapsamını göster. Böylece yalnız hızlı tamamlayanlara bakarak akışın iyileştiği sanılmaz. Gönüllü uzun yol ve kabul engeli ayrı kırılımdır; ana kohort sonucundan sessizce çıkarılmaz.

“Nerede bıraktı?” yerine veri güvenine göre şu ayrı alanları göster: son manuel eylem, son görülmüş rehber/sonuç, ulaşılan en ileri sunucu aşaması ve son aktivite anında devam eden işler. Bunlar bırakma nedenini kesinleştirmez.

### 11.4 Aktivasyon, R30 ve günlük geri dönüş

**Davranışsal aktivasyon:** Gerçek ilk maden sonucunun ve gerçek sonda raporunun görülmesi; ardından doğrudan aynı hedefe basmayı dayatan rehber olmadan yeni, sunucuca kabul edilmiş anlamlı bir karar/komut. Bunun bilişsel öğrenmeyi kesin kanıtlamadığını açık tut. Kullanılabilirlik gözleminde oyuncunun neye göre seçtiğini açıklayabilmesi ayrıca incelenir; oyuna sınav ekranı eklemek gerekmez. Görülme telemetrisi eksikse aktivasyon **bilinmiyor** olabilir; bunu oyunda ilerlemedi veya başarısız oldu diye kodlama.

**Ana R30 tanımı, kullanıcının istediği operasyonel tanımdır:** Aynı insan hesabının ardışık, tekilleştirilmiş ve sunucuca doğrulanmış anlamlı manuel oyun komutları arasında **en az 30 dakika** bulunursa sonraki komut eylemli dönüş sayılır. Uygulamanın kapatıldığını kanıtlama veya yeni `sessionId` şartı aranmaz. “Anlamlı”, gerçek oyun durumunu değiştiren meşru emir/eylemdir; worker, polling, sırf giriş yapma, sıfır etkili tekrar istek veya arka plan otomasyonu değildir.

```text
hesabın manuel komutlarını sunucu zamanına göre sırala ve retry'ları birleştir
q1, q2, ... için: qi.zaman - qi-1.zaman >= 30 dakika → qi bir dönüş başlangıcı
```

İlk komut, enlist'ten 30 dakika sonra geldi diye tek başına dönüş sayılmaz; önceki gerçek komut gerekir. Aynı hesap iki cihazdan oynuyorsa komutlar hesap düzeyinde birlikte sıralanır. Bu metrik **“R30 — en az 30 dk işlem arası”** adıyla gösterilir; kişinin kesin çıkış yaptığı iddiası değildir. Belgenin önceki sürümündeki ve araştırma notlarındaki daha katı oturum şartı ana R30 için kullanılmaz.

**Yardımcı ölçüm:** Yeterli ön plan/arka plan ve oturum kanıtı varsa en az 30 dakika gerçek yokluk sonrasında yeni manuel eylemi ayrıca “doğrulanmış oturum dönüşü” olarak göster. Lifecycle kaydı yokluğu logout kanıtı değildir; bu yardımcı ölçümün eksik olması ana R30 hesabını engellemez.

R30'un gözlem penceresi, sunucudaki **ilk `enlisted_at` anından itibaren `[0,48)` saat** olsun. 24 saatlik `[0,24)` kesiti ayrıca verilsin. Sonraki komutun zamanı bu pencere içinde olmalıdır. Aynı hesap üç kez dönerse dönen hesap sayısı 1, dönüş başlangıcı sayısı 3'tür; bu sayı otomatik olarak üç ayrı uygulama oturumu demek değildir. Dönüş öncesi son manuel aşama, dönüşteki ilk eylem ve dönüş sonrasında ulaşılan aşama ayrı gösterilir.

Günlük eylemli dönüşler aynı ilk `enlisted_at` çapasıyla:

| Metrik | Manuel eylem aranacak geçen zaman aralığı |
| --- | --- |
| D1 | `[24, 48)` saat |
| D3 | `[72, 96)` saat |
| D7 | `[168, 192)` saat |

Bu metrikler için ara verme kanıtı aranmaz; ilgili pencerede manuel eylem aranır. R30 ve D pencerelerinde ilgili pencere kapanmadan hesap nihai paydada değerlendirilmez; bekleyen hesap sayısı gösterilir. Eski starter dönüşümü ve FlightSchool'dan doğrudan giriş gibi farklı çapası olan yollar ayrı raporlanır; eksik `enlisted_at` yerine hesap oluşturma zamanını sessizce kullanma. UTC takvim gününe göre hesaplanan harici D1 ile bu kayan pencere D1'i aynı seri olarak sunma.

Atanmış hesapları crash, düşük ilerleme veya ölçüm tercihi nedeniyle kohorttan çıkarma. Komut kaynakları gerçekten tam kapsanıyorsa istemci telemetrisi olmasa da eylemli dönüş hesaplanabilir. Kaynak kaybı/saklama limiti nedeniyle eylem kapsamı bilinmiyorsa **bilinmiyor** sayısını ayrıca göster. `N` olgun hesapta `C` kanıtlanmış dönüş ve `U` belirsiz hesap varsa `C/N` gözlenen alt sınır olarak sunulur; eksikliği yok sayıp kesin retention oranı veya pilot başarısızlığı ilan etme.

### 11.5 Dashboard'un genişlemesi

Bu worktree'de daha önce hazırlanan [Oyuncu yolculuğu dashboard'u](player-journey-dashboard.md), yeni işin başlangıç yüzeyidir; canlıya alınmış olduğu varsayılmamalıdır. Mevcut kaynak `/api/admin/analytics/journey`, arayüz Admin → Oyuncu yolculuğu. Mevcut 30 dk/1 saat/24 saat **şu an hareketsiz olma** filtresi, geçmişteki iki manuel komut arasını ölçen R30 hesabı değildir.

Genişleme şu sorulara cevap vermelidir:

1. Hangi kayıt/atama kohortundan kaç gerçek yeni oyuncu geldi? Kaçı prolog, gerçek starter, ana sahne gördü?
2. Her yetenek açıldı mı, gösterildi mi, denendi mi, kabul edildi mi, sonucu görüldü mü?
3. Geçişlerin kaç kişilik paydası var; kaç kişi hâlâ bekliyor; eksik ölçüm kaç kişi?
4. İlk sefer, ilk rapor, hazırlık ve gerçek ana giriş sürelerinin medyanı, üst yüzdelikleri ve dağılımı ne?
5. Hangi engeller kaç kişiyi, kaç aktif dakika etkiledi? Hata ve sürüm farkı var mı?
6. Kaç kişi yalnız açtı, kaç kişi eylemli döndü? Dönenler nereden nereye ilerledi?
7. Oyuncu ayrıldığında ne bekliyordu? Dönünce hangi sonucu gördü veya görmedi?

Bağımsız kilometre taşı grafiği ile gerçekten sıralı funnel ayrı görünür. Sıralı funnel'da hesap başına ilk geçerli zaman ve adımların gerçek sırası kullanılır. Dışarıda bırakılan, ölçümsüz, penceresi olgunlaşmamış ve kesilmiş veri görünürdür. Kayıt aralığı ile olay gözlem sonu ayrı belirtilir; bütün zamanlar veride UTC, arayüzde belirtilen saat dilimiyle gösterilir.

Bot/admin/test hesapları yetkili admin analizi seviyesinde ayrılır; istemciye oyuncuların gizli bot kimliği dağıtılmaz. Yeni hesap, eski starter geçişi ve geri gelen eski ana dünya hesabı farklı kohortlardır. Crash yaşayan yeni hesaplar sonuçlardan çıkarılmaz. Kaynak/platform/build/dil filtreleri ana karşılaştırmanın bağlamını korur.

Mevcut dashboard'un **500 hesap / her kaynaktan 20.000 kayıt** sınırı ve kısmi veri uyarısı vardır. Yeni analizi bu limitte sessizce eksiltme. Gerekirse uygun sorgu veya özet kullan; sorguyu sınırsız büyütme. Ham olayların mevcut saklama süresine uy, geçmişte hiç ölçülmeyen aktif süreyi üretme.

### 11.6 İstemci hataları

React boundary, yakalanmamış hata/promise, WebGL context kaybı/toparlanması ve eylem reddini ayrı sınıflandır. Sunucunun olağan `INSUFFICIENT_RESOURCES` yanıtı crash değildir. İlk oyuncuyu sahneye sokamayan hata ve rehberde yanlış hedefe takılma öncelikli incelenir.

En az hata sınıfı, temizlenmiş mesaj, fingerprint, build/commit, ekran, mevcut rehber adımı, platform ve gerekli render bağlamı olsun. Mevcut suppression/rate limit korunur; tekrar sayısı, benzersiz hata ve etkilenen hesap sayısı ayrı gösterilir. Her tekrarın yeni crash olduğu varsayılmaz.

Mümkünse özel, build ile eşleşen source map üzerinden okunabilir stack üret. Parola, token, e-posta, sohbet, tüm HTTP gövdesi veya hassas URL/query kaydetme. Raw kişisel kohort dökümlerini repo'ya ekleme. Analytics kapalı olduğunda yeni sistem bunun çevresinden dolaşarak istemci takibi açmaz.

## 12. Pilot ve değerlendirme

### 12.1 Önce kullanılabilirlik

İki tur önerilir: **6–8 gerçekten yeni oyuncu**, gözlenen sorunların düzeltilmesi, ardından farklı **6–8 oyuncu**. Aynı oyuncunun ikinci turdaki ezberlenmiş hızını yeni oyuncu başarısı sayma. Mümkünse gerçek Android ve düşük/orta cihaz, zayıf bağlantı, küçük ekran ve ses kapalı koşulları da gözle.

Pilot öncesi kabul hipotezleri:

- Son 10 gözlemden en az 8'i ilk bağımsız döngüyü tamamlayabilsin.
- Rehberli normal yoldaki son 10 kişiden en az 8'i 15 dakikada gemi olarak geçişe hazır olabilsin; gerçek kabul zamanı ayrıca izlensin.
- Kritik crash, geri dönülemez sıkışma, çifte hak veya tehlikeli koruma yanlış anlaması bulunmasın.
- İlk üç öğrenme amacı oyuncunun davranışından ve açıklamasından anlaşılabilsin: fırsat bulmak, bilgiyle seçmek, sonuçtan yeni karar vermek.

Bu eşikler yayın kararı için önceden belirlenmiş ürün hipotezidir; sektör standardı değildir. Başarısızlıkta oyuncuya daha hızlı okuma öğretme. Süreyi yükleme, giriş, gezinme, gerçek uçuş, kısa onarım ve engel olarak ayır; tıkanan geçişi düzelt.

### 12.2 Küçük trafikle öğrenme pilotu

Sabit sürüm, benzer edinim kaynağı ve **20–30 yeni hesap** ile ilerle. İlk 48 saat olgunlaşmadan dönüş başarısı ilan etme. İlk pilotu çok sayıda küçük A/B koluna bölme.

Önceden kayda alınabilecek örnek karar: 30 olgun hesapta en az 6 R30 ve yeterli bağımsız karar gözlemi devam sinyali; 3 veya altı ve zayıf öğrenme yeniden çalışma sinyali; arası belirsiz. Ana R30, Bölüm 11.4'teki işlem arası tanımıdır; uygulamanın kapanma kanıtı pilot şartı yapılmaz. Bu eşikler ancak komut kapsamı yeterli ve veri kaybı açıklanmışsa uygulanır; belirsiz hesapları başarısız sayarak karar verme. Bu istatistiksel üstünlük kanıtı değildir. 6/30 bile yaklaşık %9,5–37,3 Wilson %95 aralığı taşır. Eski 2/23 ile doğrudan nedensel “artış” sonucu çıkarma; kaynak, pencere ve gözlem koşulları farklı olabilir.

D1/D3/D7 pencereleri olgunlaştıkça raporla. Yeterli trafik oluşursa tek hipotez, kalıcı hesap ataması ve önceden örneklem hesabıyla kontrollü karşılaştırma yap. Olumsuz sonuç veya crash nedeniyle atanan hesabı ana sonuçtan silme. Tamamlanan eğitime göre değil, atamaya göre ana sonuç değerlendirilsin.

## 13. Kod haritası: nereler değişecek?

Bu tablo çalışma haritasıdır; bütün dosyaları değiştirmek zorunlu değildir. İlgili sembollerin çağıranlarını `rg` ile izle; aynı kuralın UI kopyalarını bırakma. Yolun mevcut olduğu, yazım sırasında kontrol edildi; gelecekte yeniden doğrula.

| Alan | Dosya / dizin | Beklenen iş |
| --- | --- | --- |
| Sayılar ve ilk haklar | `packages/rules/src/starter/constants.ts` | Yeni kalkış süreleri/sınırlarının tek kaynağı; global hız ve stokları gereksiz değiştirme |
| Eski onarım/olgular | `packages/rules/src/starter/ladder.ts` | İlk yol, eski çıkış, yeni hazırlık ayrımı; önerilen sıra/yüzdeler |
| Yeteneğin gerçekten açılması | `packages/rules/src/starter/features.ts` | Yeni sürümde drive/migration; diğer istemeden açılan kapılar |
| Kalkış engelleri/adresler | `packages/rules/src/starter/departure.ts` | Hazırlık, uçuş, ilk kabul takvimi; mevcut `landingChoices` |
| Kasa hakları | `packages/rules/src/starter/crates.ts` | Miktarı koru; otomatik teslim edilecek mevcut ilk beş hak |
| Kargo | `packages/rules/src/starter/carry.ts` | Mevcut sınır ve hasarsız gemi seçimini koru/test et |
| Enlist ve gemi durumu | `apps/server/src/services/starter/enlist.ts`, `vessel.ts` | Kalıcı sürüm ataması, snapshot, kilitler, settlement, gerekli minimal yeni durum |
| Onarım/claim | `apps/server/src/services/starter/repair.ts`, `orders.ts` | Kasa teslimi, erken bütçe koruması, tekrar istek uyumu |
| Uçuş ve gerçek olgular | `apps/server/src/services/starter/mining.ts`, `fleet.ts`, `probe.ts`, `arrival.ts` | Gerçek kabul/dönüş/rapor, eksik hedef ve tekrar çözümleme |
| Maden yükü ve toplama | `packages/rules/src/starter/economy.ts`, `apps/server/src/services/starter/repair.ts` | Havuz, gerçek toplama ve taşma; normal kaynak kuralını koruma |
| Paylaşılan hedefler | `apps/server/src/services/starter/rocks.ts`, `sites.ts`, `outposts.ts` | İlk ulaşılabilir hedef; yarışta doğru toparlanma |
| Göç | `apps/server/src/services/starter/migration.ts` | Yeni hazırlık/rezerv, sabit kargo, kaldığı yerden devam, takvim/adres |
| Kabul ve sezon dönemi | `apps/server/src/services/servers.ts` | Frontier, ilk kabul, ortak dönem ve reset sınırı; yalnız UI'da takvim engeli kaldırma yok |
| Ana kabul/haklar | `apps/server/src/services/player.ts`, `packages/rules/src/firstSeason.ts` | Mevcut paketi tekrar vermeme; başarılı kabul ve koruma makbuzları |
| HTTP ve güven sınırı | `apps/server/src/routes/starter.ts`, `onboarding.ts` | Version/capability, yeni komutlar, Zod, yetki ve idempotency |
| Kalıcılık/worker | `apps/server/src/db/schema.ts`, `apps/server/src/worker/starterQueue.ts` | Gereken eklemeli migration, yeni zamanlı iş gerekiyorsa mevcut kuyruk |
| Açılış seçimi | `apps/web/src/onboarding/TrainingDoor.tsx`, `onboarding/prologue/` | Kısa sahiplenme, claim devamı, timeout/yanlış fallback |
| Rehber motoru | `apps/web/src/starter/tutorial/script.ts`, `useStarterTutorial.ts`, `StarterTutorialCoach.tsx` | Kısa yol; pause/skip/resume; görünmez işarette kurtarma |
| Kamera ve hedef | `apps/web/src/starter/tutorial/visualGoal.tsx`, `rockReach.ts`, `sightLesson.ts` | Okunur ilk hedef, odaklama, tek sefer hareket ipucu |
| Hedef ve gemi yüzeyi | `apps/web/src/starter/ObjectiveLine.tsx`, `VesselScreen.tsx`, `RepairCard.tsx`, `CrateBay.tsx` | Kısa hazırlık, otomatik kasa sonucu, ileri işlerin doğru sunumu |
| Kalkış yüzeyi | `apps/web/src/starter/MigrationPanel.tsx`, `DepartureBoard.tsx`, `LandingChoice.tsx`, `JumpCall.tsx` | Gerçek engeller, kargo, iniş karşılaştırması, sunucuya bağlı animasyon |
| Varış/sonraki dersler | `apps/web/src/starter/ArrivalHost.tsx`, `landingTips.ts`, `tutorial/StarterAftercare.tsx` | Kısa varış; ihtiyaca göre ana öğretim; gönüllü bildirim |
| API sözleşmeleri | `apps/web/src/api/starterSchemas.ts`, `starterTutorialSteps.ts`, `analyticsSchemas.ts`, `client.ts` | Sunucu snapshot, yeni komut ve event allowlist'leriyle aynı sınır; eski istemci uyumu |
| İstemci telemetrisi | `apps/web/src/lib/playerAnalytics/`, `apps/web/src/starter/vesselAnalytics.ts` | Görülen adım/sonuç, süre/lifecycle, hata bağlamı, mevcut tercih |
| Sunucu telemetrisi | `apps/server/src/services/commandOrigin.ts`, `analyticsFacts.ts`, `analyticsServerFacts.ts`, `routes/playerAnalytics.ts` | Manuel köken, tekil emir/sonuç, tercihe uygun toplama |
| Dashboard sunucu | `apps/server/src/routes/journeyAnalytics.ts`, `analyticsAdmin.ts` | Atama kohortu, starter + ana dünya manuel eylemleri, doğru funnel/geri dönüş/eksiklik; bu worktree'de hazır taban var |
| Dashboard istemci | `apps/web/src/screens/JourneyDashboard.tsx`, `api/journeyModel.ts`, `api/journeySchemas.ts` | Zaman/engel/geri dönüş/ilerleme görünümleri, eksik veri |
| Dil/metin | `apps/web/src/i18n/`, prolog/starter copy ve ilgili yardım | TR/EN/FR/DE/ES/JA; yeni mekanikle tutarlı kısa açıklamalar |

Bu tablodaki bazı dashboard dosyaları henüz commit edilmemiştir; yeni onboarding uygulamasıyla otomatik olarak aynı teslim sayılmaz. API'nin ilerleme, dönüş ve hata kapsamını okuyup gerçekten eksik olanı ekle.

## 14. İş paketleri ve uygulama sırası

Uygulama talimatı geldiğinde aşağıdaki sırayla çalış. Her paket, kök neden/sözleşme → başarısız test → en küçük uygulama → ilgili test → normal oyun akışı doğrulaması şeklindedir. Ürün paketinin onayı varsa rutin ayrıntı için tekrar bekleme.

| Paket | Yapılacak iş | Tamamlanma kanıtı |
| --- | --- | --- |
| P0 — Durum ve sözleşme | Güncel commit/farklar, eski-yeni akış, ürün kararları ve mevcut analytics tercihlerini doğrula | Kısa uygulama notu, onaylanan kurallar, temas haritası |
| P1 — Ölçüm ve engelleyici hatalar | Açılış yolu, gerçek olay kökeni, süre eksikliği, crash/mark_missing teşhisi | Yeni veriyle açıldı/görüldü/eylem/sonuç ayrılabiliyor; kritik giriş hatası yeniden üretilip düzeltilmiş |
| P2 — Sunucu kısa yol | Kalıcı atama, 30/60 sn bağlantı, gerçek sonuç kanıtı, ortak readiness, sonlu rezerv, eklemeli kalıcılık | Zaman/ekonomi/retry/iki cihaz; `DEPARTING` devamı ile `FAILED`/geç yerleşim yarışları yeşil |
| P3 — Mevcut hakların teslimi | İlk beş kasa otomatik; erken zorunlu bütçe ve kullanılabilir ilk rapora kadar sonda bütçesi | Mevcut toplamlar değişmiyor; başka write yolu bütçeyi veya makbuzu aşamıyor |
| P4 — Starter sunuşu | Prolog, hedef kamera, gerçek maden/havuz/toplama, sonda karşılaştırması, seçim, kısa kalkış | 350 px gerçek akışta oyuncu yardımsız hedefe ulaşıyor; görünmez işaret kilidi yok |
| P5 — Ana devam ve geçiş | İniş, paket/kargo, koruma, ilk gerçek ana seçim; eski hesap/istemci/season uyumu | Yarım göç devam ediyor; ilk hak/kargo yalnız bir kez; sonraki dersler bağlamsal |
| P6 — Analiz ve yerelleştirme | Dashboard sözleşmeleri, R30/D pencereleri, 6 dil, veri kalite göstergeleri | Bot/test ayrımı ve missing/partial doğru; funnel ile milestone farklı; dil parity ve mobil görünüm |
| P7 — Gözlem ve pilot hazırlığı | İki kullanılabilirlik turu, süre ayrıştırma, sabit sürümlü 20–30 hesap pilot planı | Teknik kabul, gözlem notu, ölçüm sorguları, geri alma planı; canlıya alma ayrıca yetkilendirilmiş |

P1 ölçümü hazırlamak, bütün P2–P6 işlerini ölçüm bekleyerek durdurmak anlamına gelmez. Ancak yeni akışın etkisi, en azından atama/komut/sonuç/ana kabul ölçülmeden değerlendirilmez. Yeni genel analytics platformu veya görev editörü bu işin önkoşulu değildir.

## 15. Test ve doğrulama planı

### 15.1 Proje disiplini

Güncel `CLAUDE.md` geçerlidir: Kod davranışı değişikliği için TDD zorunludur; önce ilgili başarısızlığı göster. Hatalı beklentiyi yeni çıktıya uydurup testi yeşile çevirme. Eski sürümün testlerini yok etmek yerine uygun fixture/sürümle eski ve yeni davranışın ikisini koru.

Kısa hedefli testlerde 1 worker. Orta gruplarda güncel kurala göre 4 worker; başka oturum koşuyorsa veya boş bellek 3 GiB altındaysa 3. Worker heap'i normalde 1024 MiB, kesin üst sınırı 1536 MiB; diğer Node işlemlerinde en çok 3072 MiB. Test/typecheck/lint'i aynı anda çalıştırma; `tools/heavy.mjs` kilidini kullan.

DB testleri çalıştırmaya/worker'a özgü, `_test` ile biten geçici DB kullanmalı; önce migration, sonra test, her sonuçta cleanup. Mevcut test config'i paralel dosyaları kapatıyorsa DB izolasyonu kurmadan bunu açma. Canlı veya paylaşılan oyun DB'sinde test/truncation yapılmaz.

Uzun ekonomi/sezon simülasyonu ve snowball audit'i bu handoff'la yetkilendirilmez. Normal ekonomi işlemi, API, güvenlik ve UI regresyon testleri yine gereklidir.

### 15.2 Davranış matrisi

| Senaryo | Beklenen sonuç |
| --- | --- |
| Normal yeni hesap | İlk araçlar, gerçek maden ve sonda, 30/60 sn bağlantı, tek ana giriş |
| Hikâyeyi/rehberi atlayan | Aynı ekonomik haklar; gerçek sunucu şartları sürer; anlatı onayı şart değil |
| Tüm onarım + yalnız `fuel=90` | Yeni sürümde gerekli gerçek olgular/bağlantı yoksa çıkamaz |
| İstemci “raporu okudum” taklidi | Rapor veya kaynak hakkı oluşmaz; çıkış yetkisi değişmez |
| İkinci bağımsız karar yok | Aktivasyon tamamlanmış sayılmaz; buna rağmen gemi şartları tamamsa göç kilitlenmez |
| A bitmeden B; saat ileri alma | B reddedilir; istemci saati sunucu süresini atlayamaz |
| Yenileme / arka plan / worker gecikmesi | Sayaç ve sonuç aynı gerçek zamandan sürer; iki kez ödül yok |
| İki cihaz aynı kasa/bağlantı/rezerv | Tek makbuz, tek etki; negatif kaynak veya ek hibe yok |
| Eski manuel kasa isteği | Otomatik teslim edilmiş ödül tekrar ödenmez |
| Erken isteğe bağlı pahalı harcama | Zorunlu araç/ilk sonda bütçesi koruma kuralını aşamaz |
| İlk maden hedefi tükenmiş/hareketli | Gerçek hata/yeniden hedefleme; sahte dönüş fact'i yok |
| İlk maden hedefte sonuçlanmadan geri çağrıldı/kurtarıldı | Eski `FIRST_MINING_RETURN` yazılsa bile yeni gerçek sonuç şartı sağlanmaz; meşru maden yolu açık |
| Maden hedefte gerçek çözüldü ama yük 0 | Gerçek boş sonuç gösterilir; yeni maden önerilir; pozitif ganimet şartı eklenmez |
| Maden yükü geldi / havuz dolu / toplama | Yük önce havuza, sonra gerçek toplamayla stoğa; taşan miktar doğru; göçte kalan havuz hesaba katılır |
| Sonda hedefi yok olmuş veya sonuçsuz | Kullanılabilir olmayan rapor başarı sayılmaz; geçerli tekrar yolu |
| İlk sonda kabul edildi ama rapor oluşmadı | Kullanılabilir ilk rapora kadar sonraki sonda bütçesi isteğe bağlı harcamaya kapalı; ücretsiz sınırsız retry yok |
| Oyuncu üçüncü dakikada çıkar | İş sunucuda sürer; geri gelince doğru sonuç/ETA ve uygun rehber |
| Uzun isteğe bağlı iş kuyrukta | Kısa kalkış checkpoint'i saatlerce beklemez; göçte iade/kargo doğru |
| Kendi uçuşu dışarıda | Göç engeli ve gerçek ETA; ışınlama/kargo kopyası yok |
| Parça/tank 0/0, 1/30, 3/90 | Rezerv katkısı sırasıyla 3/90, 2/60, 0/0; normal stok/kargoya girmez |
| Aynı hesap yeni onboarding sürümü | Yeni rezerv hakkı veya ilk sezon paketi oluşmaz |
| İniş adresi eşzamanlı doldu | Yeni seçim; sessiz adres değişimi veya çifte yerleşim yok |
| Sezon son beş günü / tam sınır | Onaylanan ilk kabul politikası uygulanır; süresi bitmiş sezona giriş yok |
| Tüm uygun galaksiler reset sınırına yakın | Daha genç hedef varmış gibi davranılmaz; K2/pilot kapsamı uygulanır; ilk haklar yeniden dağıtılmaz |
| Frontier yok / kapasite dolu | Teknik kabul engeli; gemi hazır kalır; hak/kargo kaybolmaz |
| Göçün dört adımında ayrı crash | Aynı göç devam eder; paket, rezerv ve kargo toplam bir kez |
| Kabul reddiyle `FAILED`, sonra yeni deneme | Gemi oynanabilir geri gelir; kullanılmamış rezerv kaybolmaz; yeni kargo güncel varlıkla sabitlenir |
| Eski hata yanıtı / `keepHold` ile geciken yerleşim | Yeni rezerv yanlışlıkla serbest bırakılmaz; harcanmış eski kargo yeniden teslim edilmez; tek geçerli yerleşim |
| Wipe, kabul ile bitiş arasına girdi | Kaybolan yerleşim için mevcut geri verme/yeniden deneme yolu; ilk paket/koruma hakkı otomatik yenilenmez |
| Daha önce ana dünyaya girmiş hesap | İkinci ilk sezon paketi/72 saat hakkı yok |
| Koruma bırakacak saldırı | Mevcut rıza ve risk açıklaması; tutorial bunu mecbur bırakmaz |
| Eski istemci / capability timeout | Yanlış ödül yolu yok; sürüm sabit; anlaşılır devam/güncelleme |
| Analytics kapalı veya akış kayıp | Oyun çalışır; aktif süre bilinmiyor/kısmi; komut kapsamı yeterliyse ana R30 hesaplanır; tercih aşılmaz |
| İki manuel komut arası 30 dk, kapanma kanıtı yok | Ana R30 sayılır; doğrulanmış oturum dönüşü bilinmiyor olabilir |
| İlk manuel komut enlist'ten 40 dk sonra | Önceki oyun komutu olmadığı için R30 sayılmaz |
| Ana galakside 30 dk aradan sonra yeni emir | Ana dünya manuel kaydıyla R30/D penceresine dahil; yalnız `lastActiveAt` yeterli değil |
| Worker/poll otomatik olayları | Manuel eylem veya geri dönüş sayılmaz |
| Tam 30 dk ve günlük pencere sınırı | R30 `>=30 dk`; D pencereleri başlangıç dahil/bitiş hariç |
| Birden çok dönüş / örtüşen sekme | Hesap tek; dönüş başlangıcı ile uygulama oturumu ayrı; aktif zaman çift sayılmaz |
| Hızlı tamamlayan azınlık, çok sayıda girmeyen | Süre medyanı yanında tüm kohortun zaman eşikli giriş oranı ve bekleyen/bilinmeyen sayısı görünür |
| Rehber işareti DOM'da yok | Görünmez hedefi sonsuza dek beklemez; kurtarma çalışır |
| 350 px / 6 dil / ses kapalı | Hedef, eylem, bedel, ETA ve sonuç anlaşılır; kontroller erişilebilir |

Bu matris, sıra sayısını test eden uygulama kopyası testler istemez. Sunucu/API üzerinden yetki, zaman, ekonomi ve dışarıdan görülen sonucu doğrula; istemci testlerinde gerçek etkileşim ve görülen durum üzerinden ilerle.

### 15.3 Mevcut regresyon kümeleri

İlk arama için mevcut testler:

- Rules: `packages/rules/test/starter-first-road.test.ts`, `starter-first-session.test.ts`, `starter-ladder.test.ts`, `starter-pacing.test.ts`, `starter-departure.test.ts`, `starter-features.test.ts`, `starter-crates.test.ts`, `starter-carry.test.ts`, `starter-land-haul.test.ts`.
- Server: `apps/server/test/prologue-claim.test.ts`, `starter-enlist.test.ts`, `starter-repair.test.ts`, `starter-crates.test.ts`, `starter-first-road.test.ts`, `starter-mining.test.ts`, `starter-probe.test.ts`, `starter-part-race.test.ts`, `starter-no-softlock.test.ts`, `starter-security.test.ts`.
- Göç/hak: `apps/server/test/starter-migration.test.ts`, `starter-migration-crash.test.ts`, `starter-migration-season.test.ts`, `first-season-start.test.ts`, `first-game-shield.test.ts`.
- Web: `apps/web/test/prologue.test.tsx`, `early-training-entry.test.ts`, `starter-capabilities.test.tsx`, `starter-tutorial-script.test.ts`, `starter-tutorial-coach.test.tsx`, `starter-tutorial-memory.test.tsx`, `starter-guide-scenarios.test.tsx`, `starter-migration-panel.test.tsx`, `starter-i18n-parity.test.ts`.
- Analiz: `apps/server/test/starter-analytics.test.ts`, `journey-analytics.test.ts`; `apps/web/test/journey-api.test.ts`, `journey-model.test.ts`, `journey-dashboard.test.tsx`.

Dosya listesi sabit bir “hepsini her seferinde koş” talimatı değildir. Gerçek diff'in çağrı zincirinden gerekli kapsamı seç; geniş değişiklikte normal regresyonu genişlet. Yeni bağlantı/rezerv ve R30 davranışı için anlamlı yeni test gerekir.

Komut biçimi örnekleri; repo kökünden, ilgili DB fixture'ı hazırlanmışken:

```bash
# Kısa saf rules kontrolü; geliştirmede ilgili dosyaları seç.
node tools/heavy.mjs --heap 1024 pnpm --dir packages/rules exec vitest run --minWorkers=1 --maxWorkers=1 test/starter-departure.test.ts test/starter-first-road.test.ts

# Kısa web regresyonu.
node tools/heavy.mjs --heap 1024 pnpm --dir apps/web exec vitest run --minWorkers=1 --maxWorkers=1 test/starter-tutorial-script.test.ts test/starter-tutorial-coach.test.tsx

# Gerekli scope testleri tamamlandıktan sonra sırayla type/lint.
node tools/heavy.mjs --heap 3072 pnpm -r --workspace-concurrency=1 typecheck
node tools/heavy.mjs --heap 3072 pnpm lint
```

Güncel `pnpm verify` normal doğrulama kapısıdır; kendi sürümündeki wrapper/config'i kontrol et. `--include-long-tests`, `test:long` veya `ASTERA_INCLUDE_LONG_TESTS=1` bu planın parçası değildir. Bu dokümanı yazmak için runtime testleri yeniden çalıştırmak gerekmez; uygulama geldiğinde ilgili testler zorunludur.

### 15.4 Gerçek oynama ve görsel kontrol

Mock snapshot ile tek ekran görüntüsü yeterli değildir. Yerel/test ortamında yeni hesapla normal girişten başlayıp sahiplenme, onarım, gerçek maden, sonda, rapor, seçim ve ana kabulü oyna. En az bir ara verme/dönüş ve bir başarısız eylem/toparlanma dene. Üretimde test hesabı oluşturma veya oyuncu durumunu değiştirme yetkisi bu handoff'ta verilmemiştir.

350 px ve 390 px mobil, bir masaüstü görünüm ve mümkünse gerçek Android cihazı kontrol et. Mevcut `node tools/visual.mjs` aracını kullan; senaryo/flag'lerini güncel araçtan doğrula. Başarılı geçiş, kaynak/ETA bilgisi, rehber işaretinin örtüşmesi, hata, dönüş ve kargo önizlemesi görüntülensin. Sonuçları mevcut playtest düzeninde, çalıştırılan build ve ölçülen sürelerle kaydet.

## 16. Tamamlanma ölçütleri ve teslim içeriği

Uygulama tamamlandı demek için aşağıdaki teknik koşullar sağlanmalıdır; oyuncu tutunması için ayrıca olgun pilot verisi gerekir.

- [ ] Güncel kod ve onaylanmış hedef arasındaki farklar anlaşılmış; eski/yeni sürüm sözleşmesi kaydedilmiş.
- [ ] Yeni akışta uzun motor/tesis/parça avı giriş kapısı olmaktan çıkmış; kısa bağlantılar gerçekten 30/60 sn.
- [ ] İlk altı onarımın ve ilk beş kasanın toplamları korunmuş; zorunlu bütçe ve ilk sonda yolu çalışıyor.
- [ ] Maden ve sonda sonuçları gerçek; üretim, savaş, zafer veya client ack çıkış şartı değil.
- [ ] Geri çağrılmış maden, gerçek hedef sonucu sanılmıyor; maden yükü/havuz/toplama/taşma mevcut kurala uyuyor.
- [ ] Hazırlık, engeller, feature unlock ve gerçek migration aynı sunucu kuralını kullanıyor.
- [ ] Rezerv yalnız kalkış ihtiyacına gidiyor; retry/iki cihaz/sürüm değişimiyle çoğalmıyor.
- [ ] Ana paket, koruma hakkı ve kargo yalnız bir kez; mevcut taşıma sınırları doğru.
- [ ] Eski hesap dönüşümü ve yarım göç devamı veri kaybetmeden doğrulanmış.
- [ ] Kabul reddiyle geminin geri verilmesi, rezervin yeniden kullanılabilmesi ve geciken yerleşim yarışları doğrulanmış.
- [ ] Son beş gün/kapasite/adres yarışı ve eski istemci için açık, test edilmiş davranış var.
- [ ] Pause/skip/resume ve hedef bulunamaması çalışıyor; yeni cihazda ilerleme sıfırlanmıyor.
- [ ] Ana dünyada ilk yeni karar ve sonraki rapor/öğretim zinciri çalışıyor.
- [ ] Açıldı/görüldü/denendi/kabul/sonuç/görüldü ayrımı; R30/D1 tanımı ve eksik süre göstergeleri doğru.
- [ ] Ana R30, 30 dk manuel işlem arasıyla ve ana dünya sonrası eylemlerle hesaplanıyor; gerçek oturum dönüşü ayrı; veri kaybı 0'a çevrilmiyor.
- [ ] TR/EN/FR/DE/ES/JA, küçük ekran, ses kapalı kullanım ve normal oyun akışı doğrulanmış.
- [ ] Gerekli hedefli ve normal regresyon testleri, typecheck, lint ve görsel kontrol başarılı; çalıştırılmayan kapsam açıkça yazılmış.
- [ ] Atama kapatma ve yarım göçleri koruyarak geri alma planı hazır.
- [ ] Canlıya alma yapılacaksa o adım için mevcut kullanıcı yetkisi ve güncel operasyon talimatları kontrol edilmiş.

Son teslim açıklaması şunları içersin: değişen oyuncu davranışı, ürün kararları, gerçek dosya/commit bilgisi, test ve playtest kanıtı, bilinen sınırlar, migration/rollback ve pilotun ne zaman nasıl değerlendirileceği. “15 dakikaya indi” iddiası yalnız gerçek akış ölçüldüyse, hangi başlangıç ve hangi cihazla olduğu belirtilerek yazılsın. “D1 arttı” iddiası yeterli karşılaştırmalı veri olmadan yazılmasın.

## 17. Uygulamadan önce kaydedilecek ürün kararları

Bu bölüm yapılacak her iş için tekrar izin isteme listesi değildir. `CLAUDE.md` kapsamındaki ürün kararlarını, belirli somut seçeneklerle bir kez kaydetme yeridir. Mevcut oturumda verilmiş onaylar geçerlidir. Bu dokümanı oluşturma talebi tek başına bütün bu oyun kurallarının yayın onayı olarak yorumlanmamalıdır.

| Karar | Önerilen varsayılan | Karar neden gerekli? | Karara kadar yapılabilecek |
| --- | --- | --- | --- |
| K1 — Kısa ilk oturum paketi | D01–D11 ve D13–D14 birlikte: kısa yol, sonlu rezerv, otomatik mevcut kasalar, üretim/savaş dersinin taşınması | Owner'ın kilitli kararlarını değiştiriyor; soru ve bedeli Bölüm 17.1'de | Kod inceleme, sözleşme/test planı, mevcut kritik hata teşhisi; ilerleme kuralını canlıya taşıma yok |
| K2 — İlk girişin sezon sonu kabulü | Gerçek ilk ana kabulü son 5 gün starter kısıtından ayır; geçerli açık hedef kullan; ortak reset öncesi ilk hak/öğrenme devamını açık kararla çöz | Sezon politikası; sadece cutoff'u silmek 24–48 saatlik öğrenme dünyasını korumaz; daha genç hedef garantisi yok | Kabul servisi/yarış haritalaması; görünür engel ve ölçüm; karar kesinleşene kadar en az 48 saat kalan sezonla pilot hazırlığı |
| K3 — Mevcut starter hesaplarının geçişi | İlerlemesi korunsun; eksik kısa yol hakkı bir kez verilsin; bitmemiş işler mevcut göç iadesine tabi; tamamlanmış yatırım için otomatik yeni telafi olmasın | Daha önce zaman/kaynak harcayanların adaleti ve sonlu ekonomi | Etkilenen durumları salt okunur saymak; idempotent dönüşüm test tasarımı |
| K4 — Yeni ana dünya yenilgi desteği | İlk teslimde yeni hibe ekleme; mevcut toparlanma yollarını anlat | Ek hibe ve çift ödeme riski; ana hedefin önkoşulu değil | Bu ek özelliği kapsam dışında tutarak ilerlemek |

### 17.1 K1 — owner'a sorulacak soru

Kural (`CLAUDE.md` §2, owner 2026-11-13): Kilitli karar "asla değişmez" demek değildir, "owner'a sormadan değiştirilmez" demektir. Daha iyisi varsa aşağıdaki biçimde sorulur; onay gelmeden kilitli davranış kodda değişmez, onay gelirse kararı yöneten belge güncellenir.

> **Planda D01, D07, D08, D09 ve D13 maddeleri, owner'ın şu kilitli kararlarını değiştiriyor:**
>
> | Kilitli karar | Kaynak | Plan ne yapıyor? |
> | --- | --- | --- |
> | **K4:** "Süreç, 3–5 gün süren gerçek oyundur. Kısa bir onboarding değildir." **A17:** 3–5 gün hedefi | `docs/baslangic-galaksisi-plani-2026-11-04.md` §2.1–2.2, owner 2026-11-04 | Yeni hesap ana galaksiye 10–15 dakikada girer (D01). Starter'da kalmak isteğe bağlı olur. |
> | **K7:** Motorun özel parçaları tarafsız enkazlardan toplanır | Aynı belge, 2026-11-04 | Eksik 3 parça ve 90 yakıt mühürlü rezervden gelir (D08). Parça avı çıkış şartı olmaz. |
> | **K8:** Sistemler kademe kademe açılır, oyuncu ısıtılır | Aynı belge, 2026-11-04 | Isınma ana galakside 24–48 saate yayılır (D13). Ana galakside bütün sistemler zaten açıktır. |
> | **N4:** Motor 4 + 4 saat; asıl darboğaz yakıttır | `docs/yeni-oyun-deneyimi-plani-2026-11-08.md` §1, owner 2026-11-08 | Motor yerine 30 + 60 saniyelik kalkış bağlantıları gelir (D07). |
> | **N6, N7, N12:** "İlk av" Tersane 1'den hemen sonra başlar ve öneri listesinin ilk önerisidir | Aynı belge, 2026-11-08 | Rehberli ilk savaş ana galaksiye taşınır. Starter'da isteğe bağlı kalır (D09). |
> | **Tempo:** En aktif oyuncu bile ilk gün inmez; günde dört oturumla en az 1,5 gün | `packages/rules/test/starter-pacing.test.ts`, owner 2026-11-09 | Yeni sürümde iniş aynı oturumda olur. Bu testler yalnız eski sürüm hesaplarında geçerli kalır. |
>
> Ayrıca D04 (kasaların otomatik teslimi), `docs/ilk-deneyim-elde-tutma-plani-2026-11-06.md` §6.2'deki "kasa, ödül panelini gemide öğretir" kararını değiştirir. Bu karar owner'ın yetki devriyle alınmıştır. Sezon sonu kuralı (A5) K2'de ayrıca sorulur.
>
> **Önerilme nedeni (beklenen fayda):**
>
> - Oyuncu oyunun vaadine (bilgi → hedef → filo riski → sonuç) ilk oturumda, gerçek ana galakside ulaşır.
> - Bugünkü çıkış kapısı 17 zorunlu onarımdır: seri 13 saat, gerçek tempoda 1,7–6,8 gün. Bu, `CLAUDE.md`'nin gerileme işareti saydığı `BUILD → WAIT → COLLECT → UPGRADE` kalıbına benzer.
> - Öğretim, ihtiyacın doğduğu anda verilir. Yeni genel kaynak veya savaş gemisi hibesi eklenmez.
>
> **Kanıt durumu:** Fayda henüz ölçülmedi. 10–11 Kasım kohortundaki 0/23 göç, mevcut tempoda beklenen sonuçtur; hesaplar sorgu anında 45–51 saatlikti. Gözlenen kayıp ilk 10 dakikadadır: ilk onarım → madencilik geçişinde %30 düşüş ve 2/23 R30. Çıkış süresinin bu kayba neden olduğu gösterilmedi.
>
> **Bedeli:**
>
> - Başlangıç galaksisinin çok oyunculu içeriği (karakollar, ilk av, düşük tempolu PvP, ortak kayalar) çoğu oyuncu için kullanılmaz olur.
> - Yeni oyuncu, 72 saatlik ilk oyun kalkanıyla veteranların galaksisine 15. dakikada iner.
> - İnsanlar 15 dakikada ayrılırken bot gemileri A11 gereği yalnız ana galakside bot koltuğu açılınca ayrılır. Bu da starter'ı bot ağırlıklı yapar ve botları ayırt edilebilir kılma riski taşır (kilitli bot kararı, 2026-10-28). Plana bot kalkış politikası eklenmelidir.
>
> **Değiştirelim mi?**

K1–K3 için owner farklı seçim yaparsa yukarıdaki ilgili bölümler ve test beklentileri uygulamadan önce birlikte güncellenir. K4 yeni hibe eklenmeyecekse işi engellemez. Rutin API adı, component yerleşimi, ışık/animasyon ayrıntısı veya küçük geri alınabilir teknik çözüm için yeni ürün onayı üretme.

## 18. Araştırma ve kaynak eki

Bu belge yeni bir sektör optimumu iddia etmiyor; 12 Kasım 2026 tarihli araştırmayı uygulanabilir tasarıma çeviriyor. Gelecekte “güncel rakip davranışı” iddiası yazılacaksa kaynak tarihini yeniden doğrula.

- [Araştırma raporu](<../reports/Astera ilk oturum planı.md>): Rakip karşılaştırması, öneri ve kanıt sınırları.
- [Astera kod denetimi](<../research_notes/Astera ilk oturum planı/astera_code.md>): Gerçek çağrı zincirleri, süre/maliyet hesabı, migration ve güvenlik.
- [Öğrenme ve ölçüm kanıtları](<../research_notes/Astera ilk oturum planı/evidence.md>): R30/D1, küçük örneklem ve pilot yöntemi.
- [Rakip notları](<../research_notes/Astera ilk oturum planı/competitors.md>): Oyun bazlı kaynaklar, tarih ve güncellik sınırları.
- [Apple — Onboarding for games](https://developer.apple.com/app-store/onboarding-for-games/): Kısa, bağlamsal ve atlanabilir öğretim için tasarım rehberi.
- [Andersen vd., CHI 2012](https://grail.cs.washington.edu/projects/game-abtesting/chi2012/chi2012.pdf): Eğitim koşullarını karşılaştıran çalışma; retention garantisi değildir.
- [Roblox — Onboarding](https://create.roblox.com/docs/production/game-design/onboarding) ve [funnel olayları](https://create.roblox.com/docs/production/analytics/funnel-events): Davranış ve aşama ölçümü.
- [GameAnalytics — Metrics](https://docs.gameanalytics.com/events-metrics-and-filtering/metrics/): Takvim günü retention ile bu belgedeki kayan pencere ayrımı.
- [Clash of Clans — Ranked güncellemesi, 2025](https://supercell.com/en/games/clashofclans/blog/release-notes/get-ready-for-ranked-update/): İlk çok oyunculu erişim ile ileri rekabetin ayrılması.
- [Clash Royale — Mart 2026](https://supercell.com/en/games/clashroyale/blog/release-notes/march-update-2026/): İleri içeriklerin ayrı erişim eşikleri.
- [Whiteout Survival — Furnace](https://www.whiteoutsurvival.wiki/buildings/furnace/): Yerel şehir ilerlemesi; temel süreler toplam onboarding süresi değildir.
- [EVE — Exordium starter space](https://support.eveonline.com/hc/en-us/articles/27939780240924-Exordium-Starter-Space): Güvenli öğrenme alanı ve serbest çıkış örneği.
- [Hades' Star — Dark Nebula rehberi](https://blog.hadesstar.com/2023/10/dark-nebula-upgrade-guide.html): Erken iş yükü ve anlamlı tercih konusunda geliştirici niyeti; ölçülmüş tutunma artışı değildir.

## 19. Devralan agent'a doğrudan görev özeti

Bu belgeyi ve güncel `CLAUDE.md`yi okuyarak Astera'nın ilk oturumunu devral. Önce mevcut kodu doğrula; aynı oturumda ana galaksiye ulaşılabilen, gerçek maden/istihbarat/karar döngüsü taşıyan kısa yolu uygula. Hasarlı gemi hikâyesini ve oyunun gerçek risk/sonuçlarını koru. Uzun onarım kapısını kaldırmak için genel ekonomiyi hızlandırma, bütün teknolojileri hediye etme veya client onayına ekonomik yetki verme.

Kullanıcının uygulama talimatı ve K1–K3 kararları mevcutsa işi yeni onay döngülerine sokmadan TDD ile tamamla. Yoksa eksik ürün kararını açık adı ve bu belgedeki somut seçenekle belirt; belge yazımını uygulama/yayın izni sayma. Ayrı worktree'de, diğer çalışmaların değişikliklerini koruyarak ilerle. Yeni akışı, eski hesap geçişini, gerçek ölçümü, 6 dili ve mobil oynanışı birlikte teslim et. Canlı etkiyi, henüz ölçülmüş gibi anlatma.

### 19.1 İnceleme kaydı — 13 Kasım 2026

Bu incelemede oyun kodu değiştirilmedi; handoff düzeltildi. Başlıca bulgular ve karşılıkları:

| Bulgu | Düzeltme / kanıt |
| --- | --- |
| Maden yükünün toplanması koşullu ve belirsiz anlatılmıştı | Bölüm 4.6/6.3: `landMission → landHaulInWorks → collectAtVessel`; havuz, stok ve taşma ayrıldı |
| `FIRST_MINING_RETURN`, gerçek kazı sonucu sanılabilirdi | Bölüm 7.2: geri çağrılmış/kurtarılmış boş dönüş ayrıldı; gerçek 0 yüklü sonuç meşru tutuldu |
| Akış şeması örtüşen işleri gereksiz sıralı kilitleyebilirdi | Bölüm 7.1/7.4: Radar/Survey, uçuşlar ve bağlantıların gerçek önkoşulları ayrıldı |
| İlk sonda kabulünde bütçe koruması erken bitiyordu | Bölüm 8.3: kullanılabilir ilk rapora kadar koruma; hedefsiz dönüş senaryosu |
| Göç her hatada aynı kayıttan sürüyormuş gibi anlatılmıştı | Bölüm 10.2: `handBack`, `FAILED`, `keepHold`, rezerv ayırma/tüketme ve yeni deneme ayrıldı |
| Son 5 gün kontrolünü kaldırmak tek başına yeterli görünüyordu | Bölüm 10.1/K2: ortak sezon dönemi ve reset öncesi öğrenme/ilk hak sorunu görünür yapıldı |
| Yeni akış sürümü, mevcut rehberin v2 adıyla karışabilirdi | Bölüm 7.3/10.4: ayrı `starter-fast-entry-v1` ataması ve claim sonrası kalıcılık |
| R30, kullanıcının talebinden daha katı oturum kanıtına bağlanmıştı | Bölüm 11.4: ana metrik en az 30 dk manuel işlem arası; gerçek oturum dönüşü ayrı |
| Ana dünyada oyun, yalnız son aktif zamanından çıkarılabilirdi | Bölüm 11.2: gerçek ana dünya komut kaynakları ve köken doğrulaması eklendi |
| Hızlı tamamlayanlar ve eksik ölçüm analizi yanıltabilirdi | Bölüm 11.3/11.4: tüm kohortta zaman eşikleri, olgun payda ve bilinmeyen veri ayrıldı |
| Ön plan süresi, kesin aktif oynama gibi okunabilirdi | Bölüm 11.3: gözlenen ön plan ile input sonrası etkileşim penceresi ayrıldı |
| Event üretmek tek başına yeterli sanılabilirdi | Bölüm 11.2/13: katı analytics allowlist'i ve API/model bağımlılıkları eklendi |

Süre, kaynak, kasa ve ilk sezon paketi sayıları mevcut kaynaklarla yeniden karşılaştırıldı. Doküman bağlantıları/dosya yolları ve biçimi ayrıca doğrulandı; runtime akışı uygulanmadığı için yeni onboarding testlerinin geçtiği iddia edilmez.
