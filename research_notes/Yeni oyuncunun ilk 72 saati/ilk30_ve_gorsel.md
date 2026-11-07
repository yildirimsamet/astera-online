# İlk 30 dakika ve görsel deneyim

## Mevcut başlangıç gerçekten hangi deneyimi sunuyor?

### Takeaway

Mevcut sistem atılacak bir tutorial prototipi değildir. Gerçek gemi, sunucu ilerlemesi, gerçek uçuş, keşfedilen bilgi, mobil galaksi, hasar görünümü ve açılan sistem etkileri vardır. Zayıf bağ; bu yapı taşlarının oyuncunun kendi sorusuna, seçimine ve gözlediği sonuca dönüşmesi yerine çoğu kez sıradaki düğmeye bağlanmasıdır. Bu değerlendirme yeni insan playtesti sonucu değil, aşağıdaki güncel kaynak kanıtlarıyla desteklenen tasarım çıkarımıdır.

### Cited Findings

**Kanıt sözlüğü:** K = bu incelemede koddan doğrulandı; A = eski görsel arşivi bu incelemede yeniden açıldı; H = tasarım hipotezi; U = bu oturumda çalıştırılıp doğrulanamadı. K, PASS veya canlı davranış anlamına gelmez. İncelemede ürün/test kodu, yerel DB, sunucular veya oyun dengesi değiştirilmedi. Yeni hesap açılmadı, test/typecheck/lint ve uzun simülasyon çalıştırılmadı. Koordinatörün `ss` gözleminde 5177/3199 dinlemiyordu; başlatılmadı. [Çalışma kuralları](/home/yildirim/Desktop/Coding/MyProjects/blindspace/CLAUDE.md:35)

| Yüzey/sistem | K: Nasıl çalışıyor / oyuncunun yapabildiği | Deneyim değerlendirmesi ve karar |
|---|---|---|
| Başlangıç kapısı | `TrainingDoor`, capabilities yanıtını 2,5 sn bekler; starter=true ise prolog, false/eksik/hata/gecikme halinde eski FlightSchool. | Düşük bağlantıda başka bir öğretime düşme riski var. Ana akışın korunması ve capabilities belirsizliğinin güvenli toparlanması iyileştirilmeli; eski eğitim hemen silinmemeli. [TrainingDoor](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/onboarding/TrainingDoor.tsx:11) |
| Hesapsız prolog | Güç şalteri, ateşleme, toplama, kaynak, sinyale gitme, gemiyi sahiplenme. Dünya yerel, sabit başlangıç durumuna çıkar; tarayıcı ilerlemesi sunucu ekonomisine yetki vermez. | Bedel ödemeden eylem→dünya değişimi hissi ve sahiplenme güçlü. Tek yoldur; gerçek stratejik karar diye sayılmamalı. Koru, kısalt, gerçek akışa devamlılığını güçlendir. [world](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/onboarding/prologue/world.ts:3) |
| Prolog kontrolleri | Şalter sürüklenebilir ve dokunmayla da çalışır; ateşleme/kaynak/sahiplenme 850 ms hold. Kısa ses, kıvılcım, titreşim var. | Tek tip buton hissini kırıyor. Önemli ilk çalıştırmada koru; aynı jesti rutin toplamanın her tekrarında büyütme. [Breaker](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/onboarding/prologue/Prologue.tsx:146), [HoldControl](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/onboarding/prologue/Prologue.tsx:224) |
| Gemiyi ilk görme | Ayrı R3F Canvas içinde gerçek GLB; 2,8 sn kamera yerleşirken OrbitControls disabled, sonra dönüş açılır. | Güçlü sahiplenme anı. Etkileşime dönene kadar kısa kontrol kaybı var. Yeni plan pan/dokunmayla kesme ve 2D fallback içermeli. [ShipScene](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/onboarding/prologue/ShipScene.tsx:10) |
| Kimlik/claim | Prologun gemi karşısındaki sonu ClaimDialog'a geçer. Eski görselde komutan adı birinci adımda ve gemi arka plandadır. | Hesap oluşturmanın sebebi soyut form değil, gördüğü gemiyi tutmaktır. Koru; geri dönüşte prolog tekrarıyla cezalandırma. [Prologue](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/onboarding/prologue/Prologue.tsx:578), [A: eski claim görüntüsü](/home/yildirim/Desktop/Coding/MyProjects/blindspace/out/playtest/codex-batch4/tempo/02-claim-gate.png) |
| İlk gerçek galaksi | Kendi gemisi ve uzakta ana galaksi; kendi gemi modeli hasar seviyesine göre değişir, sistem ışıkları ayrı hesaplanır; dokunma alanı model yarıya indiğinde korunmuştur. | Güçlü “buradan oraya” hedefi. Arşivde ilk NPC kartı geminin üstündedir; görüntü yazı animasyonunun başında olduğu için kartın son metin yerleşimi doğrulanmış sayılmaz. [OwnVessel](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/galaxy/OwnVessel.tsx:61), [A: eski ilk görünüm](/home/yildirim/Desktop/Coding/MyProjects/blindspace/out/playtest/codex-batch4/tempo/03-starter-first-view.png) |
| NPC yolu | İlk altı bölüm; bakın, üretim, onarım/kasa, ilk sonda/rapor, tersane, ilk maden dönüşü, veda. İki sensör dersi sonradan 7–8. bölümlerdir. | Temel işlemleri kaybetmeyen sağlam iskelet; ancak onarım adımları ve ekrana taşıyan ara adımlar çok baskın. ROAD satırı sayısı zorunlu tıklama sayısı değildir. Kısmen birleştir/deneyim içine taşı. [ROAD](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/starter/tutorial/script.ts:76) |
| Rehber kilidi | Bölüm1–3 sıkı; canvas/kasa/odak kapatma/evren serbest. Bölüm4–6 ve beklerken ekranda dolaşılabilir ama işaret edilmemiş repair/probe/mine/unlock-try maliyetleri SPEND guard ile engellenir. | “Serbestsin” ile karar yetkisi aynı değildir. Eski brifin bilinçli bütçe koruması; yeni vizyon için owner kararı gerekir. Harcama kilidini sessizce kaldırmak tasarım kararı olur. [StarterTutorialCoach](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/starter/tutorial/StarterTutorialCoach.tsx:52) |
| Bekleme ve hata emniyeti | ≤10 sn bekleme tutulabilir; >10 sn dolaşma, ≥60 sn konuşma+Tamam→AwayChip. Hedef4sn yoksa / zaman30sn aşılırsa gate açılır. Wait ekran değiştirince nav üretmez. | Sonsuz kilit önlemleri ve zamanın dürüstlüğü güçlü. Dolaşılacak dünyada gerçek seçenek sunulması ayrıca gerekir. Koru. [waitMode](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/starter/tutorial/script.ts:168), [fail-safe](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/starter/tutorial/StarterTutorialCoach.tsx:109) |
| Rehber istemiyorum | Hesap kimliği anahtarlı localStorage; modal onayıyla koç unmount olur, gate/harcama koruması/unlockHold/toast susturma etkileri temizlenir. | Gerçek opt-out var; yalnız bu cihazda saklanır. Çoklu cihazda “bir daha yol göstermeyecek” beklentisini server tercihi karşılamıyor. Koru, hesap tercihini sunucuya taşıma planla. [guidePreference](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/starter/tutorial/guidePreference.ts:5), [coach unmount](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/starter/tutorial/StarterTutorialCoach.tsx:83) |
| Metin yerine nabız | `tutorialAction` okuma aralarını ayıklayıp aynı ROAD'dan bir eylem türetir. `StarterGoalPulse` görünür/etkin gerçek kontrolde tek nabız; kamera/DOM hareketinde250ms yenilenir. | İkinci bağımsız görev modeli kurmamış olması iyi. İlk maden/veda sonrasında genel ObjectiveLine hedeflerine aynı vurgu bağlanmıyor. Koru+genişlet; yeni quest sistemi kurma. [tutorialAction](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/starter/tutorial/script.ts:159), [pulse](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/starter/tutorial/visualGoal.tsx:17) |
| Sonda raporu | SURVEY1 sonrası intel açılır; NPC sonda→dönüş→İstihbarat listesi→rapor→galakside dossier ganimeti yolunu gösterir. Okuma hedefi scrollIntoView ile görünür alınır. | Raporun varlığı ile bilgiden karar üretmek ayrıdır. Aynı hedefe erken saldırı mümkün değildir; bu aşamada bilginin stratejik kullanım köprüsü zayıftır. Koru, gerçek hedef/eylem alternatifleriyle bağla. [ROAD](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/starter/tutorial/script.ts:89), [read scroll](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/starter/tutorial/StarterTutorialCoach.tsx:156) |
| Onarım kartı | Etki/üretim değişimi, fiyat, gerçek süre, ön koşul, kuyruk doluluğu ve birikim/toplama farkı gösterilir. Aegis riski ödeme öncesi söylenir; kart değişince600ms yanlış ikinci alımı önler. | Karar desteği büyük ölçüde mevcut. Rehber hep aynı kararı emrettiğinde bu iyi veri karşılaştırma yerine talimat takibine hizmet eder. Koru. [RepairCard](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/starter/RepairCard.tsx:62), [risk](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/starter/RepairCard.tsx:95) |
| ShipHero/sistemler | Sheet gemi görseli 2D webp'dir; üç hasar görünümünden biri ve5sistem işareti/çizgisi. Seçilen/ilerlemiş/sıradaki sistem yanar. SistemTab açılabilir kilitte gereksinim okutur. | İyi kompozisyon/mobil maliyet temeli; fiziksel anten/motor animasyonu var diye raporlanamaz. 3D sheet eklemek ilk çözüm olmamalı; dünya sahnesiyle tutarlı sonuç gerek. [ShipHero](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/starter/ShipHero.tsx:42), [SystemTabs](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/starter/SystemTabs.tsx:6) |
| Kasa | Gerçek ready kasaları hold ile açılır; kapak/ışık/kıvılcım/purse ve crate sesi. Tek hareket tüm hazır kasaları açar. | Hoş kısa ritim; birincil ilerleme amacı hâline gelmemeli. Animasyon ve+purse API onayı öncesinde başlıyor; hata halinde başarı görüntüsü riski vardır, yeni test/çalıştırma ile doğrulanmalı. [CrateBay](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/starter/CrateBay.tsx:93) |
| İlk filo | Yard1 ile verilen Prospector ve2Dart. Sonda/maden/kendi outbound uçuşunda starter-only followLaunch ilk yeni craft'a odaklanır; mevcut uçuşla yeniden giriş kamerayı çekmez. | Gerçek zamanda hareketi görme güçlü. Her sonraki uçuşun otomatik kamerayı çekmesi deneyimlinin incelemesini bölebilir; ilk kez göster/sonra isteğe bağlı aday. [followLaunch](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/starter/followLaunch.ts:3), [yard grant](/home/yildirim/Desktop/Coding/MyProjects/blindspace/packages/rules/src/starter/ladder.ts:89) |
| İlk maden tercihi | OreRemaining, crystalShare, hız/kesişme/varış bilgisi gerçek hedeflerden üretilir; varışta pay kilitlenerek alınıp dönüşe geçilir. | Yakın küçük stok / uzak büyük stok, dönüş zamanı ve görülen rekabet gerçek tercih adayları. Her kayanın farklı içerikte olduğu varsayılmamalı. Koru, ilk bağımsız kararı burada kur. [mining wire](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/services/starter/mining.ts:28), [arrival](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/services/starter/mining.ts:193) |
| Genel ObjectiveLine | Sıradaki onarım/toplama/para/bekleme/sonda/maden/fact/parça/yakıt/sıçrama. >15dk kaynak/onarım beklemesinde “şimdilik bu kadar” saat metni. | Yapılabilir başka uçuş varken oturum kapanışı yanlış zamanda gelebilir. “Çıkabilirsin” ile “yapacak hiçbir şey yok” ayrılmalı. İyileştir. [ObjectiveLine](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/starter/ObjectiveLine.tsx:19) |
| Rehbersiz uçuş beklemesi | `tutorial.action` wait ise kısa metin override; probeFlying/mineFlying `repairWait` bulamaz→Waiting. `StarterWaitLine` yalnız repair waits. | Koç kapalıysa neden/ne zaman/neyle dönüş köprüsü zayıf. Her uçuş için gerçek dönüş saati+beklenen bilgi/kargo bağı gösterilmeli. [ObjectiveLine](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/starter/ObjectiveLine.tsx:83), [StarterWaitLine](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/starter/tutorial/StarterWaitLine.tsx:8) |
| Dönüş izni | StarterAftercare native push önerisi veda+destek sonrası; bir uzun işte bir tekrar sınırı var. Ancak guideSkipped olduğunda GameShell bu bileşeni render etmez. | NPC tercihi ile bildirim tercihi ayrılmalı; bu bütün üründe başka bildirim ayarı yok iddiası değildir. [Aftercare](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/starter/tutorial/StarterAftercare.tsx:20), [GameShell](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/v2/shell/GameShell.tsx:318) |
| Teleskop/radar öğretimi | Gerçek sensör geometry ve server-earned contact; temas yoksa halka fallback, sahte contact yok. Dersler read/Next ack'leri. | Hakiki kural iyi; üç Next yetkinlik kanıtı değil. Gerçek hareketi izleyip bir soru/eylem çözme fırsatı olduğunda öğret. [sightLesson](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/starter/tutorial/sightLesson.ts:11), [StarterSightMarks](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/galaxy/StarterSightMarks.tsx:24) |
| Alt ekran disiplini | Açık page>selection>destination>starter>context tek alt yüzey seçer. Sheet başlığı artık gemi adı/header art ile ana V2Sheet yapısında. | Önceki örtüşme sorunları için doğru çözüm. Yeni sunum/keşif kartları bu sahipliği aşmamalı. Koru. [bottomSurface](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/starter/bottomSurface.ts:1), [ship header](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/screens/GalaxyView.tsx:1914) |
| ShipLog | POWER+5sistemi ilerleme haritası yapar; şu anki bölümde tek Git→genel gemi ekranı. Tarih sıralı olay, zaman damgası, unread veya olay-hedef linki yok. | İlerleme haritası olarak doğru; operasyon günlüğü sanmak yanlış. Rapor/Away/bildirim kaynaklarıyla eylem sonucu geçmişi eksikse onları birleştir, yeni paralel quest board yapma. [ShipLog](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/starter/ShipLog.tsx:26) |
| Ana galaksiye giriş | Sonuç sunucuda hazırken25sn beş beat; gerçek geçişte skip yok, replay'de var. İniş sonrası6satırlık açıklama, kargo, devam. | Büyük kapanışa uygun malzeme var;25sn ilk izlemede zorunluluk ve sonrasında yeni bilgi yükü kontrol hedefiyle gerilimli. Skip/fallback+tek ilk bağımsız gezegen kararı öner. [MigrationSequence](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/galaxy/MigrationSequence.tsx:350), [jump beats](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/starter/jump.ts:7), [ArrivalHost](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/starter/ArrivalHost.tsx:62) |

**İlk30 için zaman ayrımı K:** İlk sekiz tavsiye onarım timer toplamı13dk20sn'dir; bu tutorial tıklama/okuma/sonda/maden süresi dahil olmayan seri tabandır. SURVEY1 sondayı açar; SURVEY2 ilk sondayı açan kapı değildir, ilk rapor ondan önce gelir. Mining yalnız Yard1 gerektirir; SURVEY2/HANGAR2 ilk madenin ön koşulu değildir. Yeni plan bu esnekliği kullanabilir. “İlk gerçek savaşı30dkya getir” ise mevcut erken mining ile aynı değişiklik değildir: saldırı kilitleri/fact ve NPC savaş zamanı ayrıca ele alınmalıdır. [ladder](/home/yildirim/Desktop/Coding/MyProjects/blindspace/packages/rules/src/starter/ladder.ts:82), [probe road](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/starter/tutorial/script.ts:93)

**10 eksenli nitel değerlendirme H:** Aşağıdaki `+` iyi temel, `~` kısmi/bağlama bağlı, `–` tasarım açığı, `?` canlı kanıt yok anlamındadır; insan ölçümü veya nesnel puan değildir. Teknik sütun K yalnız uygulama varlığını söyler. T=teknik, A=anlaşılır, G=geri bildirim, S=anlamlı seçim, E=sonucu hissetme, Ç=çekirdek döngü, M=merak/eğlence, O=doğal oynanış/görev için değil, D=dönüş nedeni, K=karar. Dayanak üstteki satırların kodlarıdır.

| Sistem | T | A | G | S | E | Ç | M | O | D | K |
|---|---|---|---|---|---|---|---|---|---|---|
| Prolog | K | + | + | – | + | ~ | + | ~ | ~ | Koru/kısalt |
| Hasarlı gemi/uzak galaksi | K | + | + | ~ | ~ | + | + | + | + | Koru |
| Sıkı rehber | K | + | ~ | – | ~ | ~ | ~ | – | ~ | Erken hafiflet |
| Onarım kartı/üretim | K | + | ~ | ~ | ~ | ~ | ~ | ~ | + | Koru, sonuç bağla |
| Sonda+ilk rapor | K | ~ | + | ~ | ~ | + | + | ~ | + | Kullanım köprüsü |
| İlk maden/filo | K | ~ | + | + | + | + | + | + | + | Erken bağımsızlaştır |
| Kasalar | K | + | + | – | + | ~ | ~ | ~ | ~ | İkincil tut |
| Sensör dersleri | K | ~ | + | – | ~ | + | + | ~ | + | Gerçek olaya taşı |
| Genel sonraki hedef | K | ~ | ~ | – | ~ | ~ | ~ | – | ~ | Olanak göster |
| Dönüş/hatırlatma | K | ~ | ~ | ~ | ~ | + | + | + | + | Rehberden ayır |
| Ana galaksi geçişi | K | ~ | + | ~ | + | + | + | + | + | Kontrol/fallback |
| Düşük cihaz deneyimi | K | ? | ? | ? | ? | ? | ? | ? | ? | Profil şart |

### Inferences

1. **Asıl robotluk kökü seçenek yokluğu değil, mevcut seçeneklerin öğretim otoritesi altında yanlış zamana itilmesi.** Sunucu sıradan queue/facts/flight kullanıyor; istemci ROAD+SPEND koruması bu serbest sistemin üstünde belirli bir harcama yolunu zorluyor. Yeni tasarım için tüm backend'i yıkmak gerekmez. Kısa temel gösterimden sonra “tek emredilen kontrol” yerine “oyuncunun seçtiği niyet için tek yol gösterici” kullanılmalı.
2. **Dünya, sheet ve NPC farklı hikâye anlatabiliyor.** Gemide sistem ışığı açılır, fakat hasar sprite'ı global hasar eşiğine bağlı kaldığı için aynı bölüm kıvılcım verebilir; yetenek açılır, NPC onu bekletebilir; ekonomi eyleme izin verirken SPEND dokunmayı reddedebilir. Tetik, gerçek yetki ve görünür sonuç tek duruma bağlanmalı.
3. **İlk başarının tanımı değiştirilmelidir.** “Sekiz onarım”, “altın kasa”, “bölüm6/8” yerine “bilgiye baktım, iki gerçek alternatif arasında seçim yaptım, filom döndü, bu sonuçla planımı değiştirdim.” Bu, madencilik üzerinden ilk oturumda denenebilir. Savaşın da zorunlu ilk oturum başarısı yapılması ayrı ekonomi/risk kararıdır.
4. **Sondanın ilk kullanımı tam döngüye daha iyi bağlanmalı.** Yakındaki başka gemiye sonda göndermek merak yaratır ama saldırı kapalıyken elde edilen ganimet verisi hemen seçim üretmeyebilir. Çözüm ilk raporu bedelsiz bir ödüle çevirmek değil; bilginin gerçekten değiştirebildiği hedef, kaynak rota veya sonraki hazırlık tercihini yüzeyde göstermek. İlk madencilik kararını sonda olmadan bilinen kaynak/mesafe/kapasite verileriyle de tamamlayabilmek korunmalı.
5. **Gösterişli aktivasyon tek başına problem çözmez.**20–30dk penceresinin tamamını onarım sayacıyla dolduran tasarımı20sn anten sinematiği kurtarmaz. Önce gerçek kullanılabilir eylem/karşılığı; sonra onları okunur yapan hareket/ses.

### Gaps

- Bu araştırmada ilk30 akışı canlı yürütülmedi; arşiv iki görüntü yeniden açıldı, yeni çekim diye sunulamaz. Gerçek ses kalitesi/haptic cihaz tepkisi/ısınma/FPS/350px uzun locale yerleşimi test edilmedi.
- Mevcut unit/component kaynaklarının varlığı öğretimin anlaşıldığını kanıtlamaz. Oyuncu görüşmesi, hata/tıklama zaman çizelgesi ve cihaz profili yok.
- Ekonomi/çok oyunculu yeterli fırsat arzı bu frontend notundan doğrulanamaz; backend notlarıyla birleştirilmeli. Önerilen dakika hedefleri test hipotezidir, mevcut garanti veya sektör standardı değildir.

## İlk30 dakikayı görev sırası yerine nasıl oynanabilir bir deneyime dönüştürelim?

### Takeaway

Önerilen ana fikir **“Kendi rotanı aç”**: ortak ve kısa bir gemiyi hayata döndürme anından sonra oyuncu komşuluğundaki gerçek fırsatlara bakar, ilk dış uçuşunu seçer, sonucunu kullanır ve ayrılırken kendi planını bırakır. Rehber, tıklanacak zinciri okuyan kişi olmaktan çıkar; oyuncu bir şeyi anlamadığında dünyadaki kanıtı işaret eder. Aşağıdaki bütün akış H'dir, uygulanmış veya oynanmış değildir.

### Cited Findings

Bu tasarım şu mevcut altyapı üzerine oturur: gerçek gemi/serili onarım ve faktlar [ladder](/home/yildirim/Desktop/Coding/MyProjects/blindspace/packages/rules/src/starter/ladder.ts:82), görünür tek eylem işareti [visualGoal](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/starter/tutorial/visualGoal.tsx:17), gerçek hedef/sonuçla maden uçuşu [mining](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/services/starter/mining.ts:193), dönüşü bekleyen NPC [AwayChip](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/starter/tutorial/AwayChip.tsx:5) ve tek alt yüzey önceliği [bottomSurface](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/starter/bottomSurface.ts:1). Her yeni seçim sunucunun o an izin verdiği gerçek eylem olmalı; henüz bulunmayan bir kural aşağıda açıkça “ürün kararı” diye belirtilir.

### Inferences

**Hedef ritim / kapı değildir:** İlk30dk, tüm oyuncuları30dk boyunca çevrimiçi tutma zorunluluğu değildir. Hızlı komutan tek oturumda iki karar döngüsü kurabilir;4–6dk mobil oturumlu oyuncu aynı anları üç girişte yaşayabilir. Sayılar profil hipotezidir; beklemeyi otomatik hızlandırma, kaynak hibesi veya garantili zafer diye uygulanamaz. Başlangıç saatini iki ayrı kaydet: sayfa ilk etkileşim + gerçek starter enlist. Hesapsız prolog ve kayıt sürtünmesini gizleyip “coreloop8dk” deme.

**M0 · 0–30 sn: “Bir şeye dokundum; gemi karşılık verdi.”**

- Durum/tetik: Yeni ziyaretçi karanlık köprüye gelir. İnandırıcı ama az metinli bir ihtiyaç: yardımcı güç. İlk etkileşim şalter; görüntü, işaret ve fiil aynı anlamı taşır.
- Görme/duyma: Şalter teması→ışıkların gelmesi→mekânsal düşük motor uğultusu/tek thunk; karanlık tüm ekranı okunamaz yapmaz. Ses kapalıyken lambaların açılması ve ana enerji hattı yeterlidir.
- Kontrol/seçim: Dokunma veya sürükleme; deneyimli mevcut “Atla”yla doğrudan sahiplenmeye gidebilir. Burada stratejik seçim varmış gibi davranma: bu bir kontrol ve sahiplenme anıdır.
- Sonuç/öğrenme: Komutun dünyayı değiştirdiği anlaşılır. İlk animasyon biter bitmez tekrar talimat paragrafı açma; sonraki nesne kendi kullanılabilir durumuyla belirir.
- Başarısızlık: Dokunmadan çıkarsa yerel ilerlemeyi sürdür; ses/GPU başarısızsa resim+durum+aynı eylem. Şalterden sonra callback gecikirse ikinci kez ücret yok; prolog zaten ekonomi otoritesi değildir.
- Teknik: Mevcut Breaker, fire/sound/haptic korunur. First-interaction ve powered-state süreleri ölçülür; asıl başarı süre değil eylem sonucunu yardımsız anlatabilmedir.

**M1 ·30sn–2dk: “Bu gemi benim olabilir.”**

- Durum/tetik: Güç, bir üretim partisi ve sinyal; oyuncu gerçek gemi gövdesini görür. İlgisini gemi oluşturur; ardından kimlik isteriz.
- Görme/duyma: Kısa yakınlaşma, hasarlı bölüm ve çalışan ışık; gemi silueti büyür, oyuncu döndürebilir. Aynı temadaki ses motifi sonraki gerçek gemide sürer.
- Kontrol/seçim: Sahiplen; mevcut hesaba gir; daha sonra dön. Adını seçme sahiplenmedir ama filoya dair sahte strateji etiketi yükleme.
- Sonuç/öğrenme: Sunucu aynı görünümde gemiyi kurar; prolog tamamlandı5/5→yeni welcome1/8 sıfırlanma etkisi yerine dünyaya kesintisiz geçiş yapılır. Bu geçişin akıcı olması ayrı layout/transition işi, sunucunun client-progress kabul etmesi anlamına gelmez.
- Bağlantı: Aynı çalışan rafineri ve hasarlı anten gerçek dünyada bulunur; “yeniden her şeyi başlat” hissi azaltılır. NPC kısa bir cümleyle şu anki dünya durumunu açıklar, oyunu yeniden tanıtmaz.
- Toparlanma/teknik: Kayıt ağ hatasında gemi/isim bağlamını koru; işlem sonucu belirsizse kaydı kontrol et, mükerrer enlist yok. İlk3D reveal alınamazsa claim formu geçilebilir olmalı. Güvenilir server state oluşturma korunur.

**M2 ·2–5dk: “Onarım bir kilit değil, yeni bir göz.”**

- Durum/tetik: Oyuncunun ilk zorunlu20sn temel onarımları ve30sn anteni gerçek queue üzerinden tamamlanır. Bu küçük temel dönem anlaşılır kontrolü öğretir; ekrana gir/çık/başka karta bak gibi ara adımlar bağımsız ders olmaktan çıkarılır.
- Görme/duyma: Anten bayında kıvılcımın sönmesi, ışık/enerji çizgisi ve kısa sinyal kilit sesi. Kaynak yetersizliği veya ağ gecikmesi başarı efekti üretmez.
- Kural doğruluğu: SURVEY1 istihbarat/sonda yeteneğidir. Bu noktada TELESCOPE/RADAR menzili açılmış gibi yeni halkalar veya gizli hareketler göstermeyiz. Komşu gemi konumları zaten görünüyorsa “şimdi hepsini keşfettin” diye sahte perde açmayız. Yeni olan; seçilen hedefin içi okunabilir hâle gelmesidir.
- Seçim: Gerçek iki uygun komşuyu incele; sonda gönder veya üretim/tersane hazırlığına dön. O an tek gerçek hedef varsa bir tane göster; iki farklı sahte fırsat üretme. Kısa karşılaştırma yalnız bilinen bilgi, rapor yaşı/bedel/mesafe.
- Farklı sonuçlar: Sonda harcaması ilk bilgiyi daha erken getirir; tersane hazırlığı ilk maden kapasitesini öne alır. Bu dallar yeniden aynı tek doğru sıraya anında zorlanmamalı. Bedel ve dönüş zamanı açık olmalı.
- Öğrenme: Bilinmeyen iç veri ile görülen konum ayrıdır; bilgiye bedel ödenir. Yetkinlik hissi NPC'nin “iyi yaptın” övgüsünden çok yeni veriyi kullanabilmekten gelir.
- Hata/toparlanma: Hedef kalkar/korunur/rapor gelmezse gerçek server nedeni, güvenli yeniden hedef seçimi. Sonradan dönüşte rapor hazır; yoksa aynı gönderim tekrar ödüllendirilmez.
- Teknik/ürün kararı: Erken SPEND kilidini bırakma owner kararı bekler. Mevcut kaynak/queue kontrolleri korunur; geri dönülemez bütçe softlock'u yaratmayan minimum geri kazanım yolunun kanıtı gerekir. Yeni kaynak hibesi bu taslağın onaylanmış parçası değildir.

**M3 ·5–10dk: “İlk dış uçuş benim seçtiğim yere.”**

- Durum/tetik: Yard1 çalışır, gerçek Prospector çıkar. Mevcut tavsiye yolundan önce veya sonra olabilir; bu pencere resource/order test hipotezidir. YARD'ın ilk maden için SURVEY2/HANGAR2 gerektirmediği kullanılır. Tersane açılmadan miner varmış gibi efekt olmaz.
- Görme/duyma: Kargo bay ışığı ve iskeleden küçük craft ayrılışı; tek launch sesi. Kamera ilk kez kendi gemisinden craft'a0,5–0,8sn takip önerisiyle geçer; oyuncu pan yaparsa bırakır, “izle” ile geri alır.
- Seçim: Birbirinden gerçekten farklı iki maden fırsatı: yakın/az kalan stok ile daha uzak/çok kalan stok; birini seçmek, henüz göndermemek veya ek bilgiye bakmak. Maden kompozisyonu aynıysa farklı kaynak çeşidi seçtiği anlatılmaz. Görülmeyen rakibin gelecekteki gelişini kesin bildirmeyiz.
- Farklı sonuç: Daha erken küçük dönüş veya daha geç tam kargo; ortak stokta başkasının payı azaltabilmesi. Her oyuncuya aynı dakika, aynı varış, aynı ganimet zorunlu değildir.
- Öğrenme: Mesafe, yüklü dönüş süresi, gemi kapasitesi ve ortak dünya. İlk fleet hareketini “filo gönder butonu başarılı” düzeyinden çıkarır.
- Başarısızlık/toparlanma: Kaya biter/kaçar veya kargo az dönerse görevi yeniden başlatma; fiili kargo+hangi koşul değişti+bir sonraki uygun hedef göster. Hataya “ceza” metni ekleme; oyuncunun gecikmesiyle dünya stokunun azalması ayırt edilsin.
- Teknik: Mevcut interception, route, cargo, mission return ve SSR/server authority korunur. İlk gönderimin idempotency/çift basım/ağ timeout doğrulaması kabul şartıdır. Elde sadece bir kullanılabilir hedef varsa maliyet/risk farklılığı uydurmak yerine gerçek tek hedef ve sonraki fırsatla ritim kurulur.

**M4 ·10–20dk: “Planımın sonucunu gördüm; fikrimi değiştirebilirim.”**

- Durum/tetik: İlk Prospector döner. Gerçek kargo ekonomide doğrulanır; oyuncu çevrimdışıysa bu an sonraki girişte kısa sonuç olarak gelir.
- Görme/duyma: Dönüş craft'ı bayına yerleşir; kaynak hareketi gerçek buffer/store akışına gider. “200 taşıdın” ile “200 harcanabilir oldu” birbirine karıştırılmaz. Gemi boyutuyla uygun kısa cargo sesi; büyük kutlama/sinematik yığını yok.
- Seçim: Kaynağı gerçek bir sonraki kapasite/istihbarat onarımına ayır; ikinci uçuşu farklı hedefe gönder; mevcut planı koruyup ayrıl. İlerleme maliyetinin sadece bir bölümünü karşıladıysa bunu dürüstçe göster; ilk kargoyu görünmez şekilde “hedef bitmiş” sayma.
- Farklı sonuç: Üretim veya uçuş temposunu öne alma; hedef değiştirme; raporu daha sonra değerlendirme. Bu ilk bağımsız karar, oyuncu bir talimatı tersine yaptığı için değil, iki gerçek seçeneği anlayıp bir niyet belirlediği için ölçülür.
- Öğrenme: Kaynak dünyadan geldi; kendi seçimi gelecekteki fırsatları etkiler. Bu erken döngü savaş değildir ama gerçek Astera ekonomisi/istihbarat/fleet riskinin küçük örneğidir.
- Hata/toparlanma: Eksik kargo, kapalı hedef, gecikmiş event veya işin bitmiş ama client stale olması; hepsinin ayrı açıklaması. Önce sunucuyla uzlaştır, sonra başarı geri bildirimi. Filo kaybı veya teknik hata onaylanmamışsa yenisini satın al diye yönlendirme.
- Teknik: first-loop-close için gerçek missionID+targetID+launchedAt+resolvedAt+viewedAt ayrımı. Rehberin ilk akışı “ilk80%tamamlandı” gibi sahte doyum değil; gözlenen sonuç ve sonraki tercih üzerinden biter.

**M5 ·20–30dk: “Artık benim merak ettiğim bir şey var.”**

- Durum/tetik: İlk sonuçla bir eylem daha yapılabilir. Oyuncu dünya komşuluğunu, zaman ilişkisini ve gemisini az çok tanır.
- Görme/duyma: Yalnız gerçek yeni olay vurgulanır: güncel rapor, komşu hareketi, uygun kaya veya açılan kapasite. Tek bir önemli ışık/odak; hem NPC hem unlock hem destination hem objective aynı anda bağırmaz.
- Seçim: Ek kısa uçuş; mevcut onarımı sıraya koyup ayrıl; gerçek bir oyuncu mesajına cevap; uygun fırsat yoksa isteğe bağlı dünya incelemesi. Sohbet sırf social-metric doldursun diye boş otomatik mesaj atmaz, hiçbir aktöre sahte gerçek oyuncu doğrulaması verilmez.
- Oturum sonu: “Şu işim dönecek; şu bilgiyi karşılaştırıp karar vereceğim.” Kaynak sayacından öte, kendi başlattığı açık soru. İsteğe bağlı bildirim tercihi NPC tercihinden bağımsızdır.
- Farklı hızlar: Hızlı kişi serbestçe ikinci döngüye geçer; kısa oturumlu kişi bu anı ertesi girişte yaşayabilir; yavaş dönen kişi ödül/öğretim kaybetmez. Dünya ilerleyebilir ama kaçırılan animasyon veya gün numarası öğrenimin kalıcı kapısı olmaz.
- Başarısızlık:20–30dkda hiç kullanılabilir eylem kalmadıysa yeni cutscene eklemek yerine nedenini ölç: kaynak kapısı mı, fırsat arzı mı, gate mi, gerçek hedef yetersizliği mi? Bütçe/risk değişimi gerekenleri owner kararı olarak ayır.
- Teknik: Genel `shipObjective` ile pulse/ShipHero/ObjectiveLine tek seçilmiş niyeti paylaşır. Oyuncu niyet belirlememişse en fazla iki uygun fırsat; seçtiğinde bir aktif vurgu. Yeni görev paneli zorunlu değildir.

**Rehberin tutulacak/birleşecek/doğal oyuna taşınacak parçaları H:**

| Mevcut parça | Öneri | Sebep |
|---|---|---|
| İlk bakış/sahneyi hareket ettir | İsteğe bağlı jest ipucu; tek kısa gösterim | Galaksiyi kullanmayı öğretir,12sn Next beklemesi temel ilerleme şartı olmasın |
| Welcome+online+collect | Prologun gerçek gemiye devri içinde birleştir | Aynı tanışmayı iki kez sunma |
| İlk2 temel onarım | Kısa teknik temel, gerçek fiyat ve tek kuyrukta görünür | Kontrol ve sunucu işlemi öğrenilir; stratejik karar iddia etme |
| Anten/ilk sonda | Dünyada gerçek yeni işlevi göster | Metin yerine bilgi farkı; doğru sensör kuralı |
| OpenIntel/openReport/report | İlk raporun tek anlamlı inceleme anına birleştir; menu yolu sonra isteğe bağlı | Gezinme başarılı oldu ≠ rapor anlaşıldı |
| Her kasa için ayrı emredilen durak | İlk bir tane öğretilir; diğerleri sessiz ikincil ready işareti | Ödül zinciri değil dünya kararı merkeze gelsin |
| Refinery3/Vault/Yard/Extractor3 tek zorunlu sıra | Ön koşul ve bedeller korunarak seçilebilir hazırlık planı | Sunucu zaten daha esnek; resource softlock ayrı kanıtlanır |
| İlk maden hedefi | Gerçek iki alternatif varsa oyuncu seçer; ilk gönderimde yardım | İlk bağımsız kararın sebebi oluşur |
| Uzun wait konuşmaları | Gerçek dönüş zamanı+ne döneceği+o zaman karar; isteyen erken ayrılır | Şimdi oyunu kapatmak başarısızlık değildir |
| Farewell | Sonucun ardından kısa kontrol devri; kalan oyunu bölüm sayısıyla şişirme | İlerleme hissi öğretmenin bitişine bağlanmasın |
| Teleskop/radar üçer Next | Gerçek temas anına bağlanan isteğe bağlı göster/incele/izle | Okuma ile mekanik yetkinlik ayrılır |

**Kısa oturum ve ters davranışlar H:**

| Durum | Beklenen deneyim |
|---|---|
|2dkda çıkar | Geminin kimliği ve gerçek durum korunur; dönüşte prolog tekrar zorunlu değil |
| Sonda gönderip dönmez | Sunucu raporu çözer; dönüşte6olay üst üste modal olmaz, tek önemli sonuç+ilgili dosya |
| Önce mining yapmak ister | Yard açık ve sunucu izinliyse rehberden bağımsız yapılabilir; sonda dersi kaynak/rapor koşulları hazır olunca bekler |
| Tüm bütçeyi harcar | “Yanlış oynadın” geri alışı yok; mevcut üretim/mining/toplama/kuyruk iptali gibi gerçek kurtarma yolu görünür; yeni hibe onaysız eklenmez |
| İlk cargo boş/az döner | Hareket başarıyla dönmüş olabilir; ganimet sonucu gerçek nedenle ayrılır, alternatif hedef gösterilir |
| Rehberi kapatır | Genel hedef, timer, rapor sonucu, bildirim tercihleri ve teknik yardım sürer; NPC kapalı kalır |
| Başka cihazdan girer | Oyun state ve server ilerleme aynı; ilk önerilen değişiklik guide preference'ın da hesaba taşınması |
| Animasyon ortasında yeniler | İşlem zaten committed ise sonuç state'den devam, animasyon yeniden ödül vermez |
| Bilerek kılavuzu izler | Rehber onu suçlamaz; ilk gönderimi gösterir, sonraki seçimde niyet sorar; bağımsızlık tek seferde zorlanmaz |

### Gaps

- İlk5/10/20/30 pencereleri mevcut sırayla ve tüm kullanıcı hızlarında garanti değildir; yeniden tasarlanmış akışın prototipi yok. Özellikle kaynak maliyeti ve fırsat yoğunluğu normal dev akışında ölçülmeli.
- Bu not yeni grant, ücretsiz filo, risk tavanı, starter galaksi boyutu veya kaya sayısı değişikliği önermeyi onaylamaz. Böyle ihtiyaç çıkarsa ekonomi/ürün kararı dosyada görünür olmalı.
- İlk savaşı ilk30dk kabulüne koymak mining kadar ucuz değildir. İlk gerçek saldırı/karşılık seçeneği backend/owner karar notundan eklenmeli; mevcut motor öncesi battle fact kapılarıyla uyum ayrı değerlendirilir.

## 3D, kamera, ses ve mobil geri bildirim nasıl geliştirilir?

### Takeaway

İyi temel, mevcut galaksinin kendisini arayüz olarak kullanmasıdır. Tüm gemi sheet'ini pahalı3D'ye çevirmek veya her onarımı sinematik yapmak gerekmez. Başarı, küçük ama kurala doğru dünya değişimleriyle görünmeli: sistem bayının hasarı düzelir, gerçek menzil görünür, gerçek craft çıkar, gerçek sonuç o yere döner. Fiziksel anten açılması için mevcut assetler yeterli değildir; bu gerçek teknik bağımlılıktır.

### Cited Findings

- Engine kaynakları: React Three Fiber9.7, Drei10.7, Three0.185 serisi paket aralıkları mevcut; sürüm yükseltme bu planın gereği değildir. [package.json](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/package.json:28)
- `ShipHero` üç farklı hasar halindeki2D webp'yi gösterir. Galaksi `VesselBody` GLTF scene clone+emissive materyal+outline ve hasar sprites kullanır; AnimationMixer/clip/skin/morph çalıştırmaz. [ShipHero](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/starter/ShipHero.tsx:59), [VesselBody](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/galaxy/VesselBody.tsx:137)
- Bu incelemede9GLB'nin JSON chunk'ı read-only parse edildi: seed/spine/wedge × patched/renewed/wrecked dosyalarının her biri1node/1mesh;0animations,0skins,0morph targets. Dosyalar418.136–599.460byte. Her anten ayrı pivotlu bir node değildir. Rendered look ham varlık metadata'sı kadar kanıtlıdır; kalite/perf ölçümü değildir. [asset dizini](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/public/assets/models/vessels)
- Görünüm eşikleri global required-progress payında35%PATCHED,80%RENEWED. Sistem ışıkları ayrı `systemProgress.done/total`; hasar sprite'ları ise yalnız WRECKED/PATCHED/RENEWED'den gelir. Bu yüzden erken anten onarımı ışık yaksa da WRECKED'inSURVEY kıvılcımı%35'e kadar kalabilir. [look.ts](/home/yildirim/Desktop/Coding/MyProjects/blindspace/packages/rules/src/starter/look.ts:10), [vesselLights](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/galaxy/mainSky.ts:85), [DAMAGE](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/galaxy/VesselBody.tsx:28)
- Açılan sistemin bayı3,6sn3kez parlar; gerçek nokta VESSEL_BAYS'ten. `UnlockMoment` sound switch+haptic thunk ve0,6sn kart girişi kullanır. “Try” yalnız production/intel'de vardır; her açılma etkileşimli ders değildir. [OwnVessel](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/galaxy/OwnVessel.tsx:12), [UnlockMoment](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/starter/UnlockMoment.tsx:19)
- GalaxyCanvas demand render, quality DPR cap, batching/culling ve GPU context restore vardır. Balanced varsayılan DPRcap1.5, low1; ana sahne fiziksel durumdan bağımsız donanım preference kullanır. Bunların bulunması düşük cihazda yeterli FPS kanıtı değildir. [GalaxyCanvas](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/galaxy/GalaxyCanvas.tsx:149), [context recovery](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/galaxy/GalaxyCanvas.tsx:694), [quality](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/lib/quality.ts:73)
- Prolog ShipScene ayrı Canvas DPR1–2; final MigrationSequence DPR1–1.5 ve ayrı animasyon saati kullanır. Ana kalite policy'si bu iki componentte okunmuyor. Ortak kalite/restore/fallback uyumu ayrıca kabul şartı olmalı. [ShipScene](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/onboarding/prologue/ShipScene.tsx:70), [MigrationSequence](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/galaxy/MigrationSequence.tsx:373)
- Kamera rig'i açık focus kimliğini kaynak veri yenilenmesinden ayırır; kullanıcı jesti sıradan ease'i bitirir. Ancak held universe flight özel tamamlanır. Yeni dramatik odaklar bu kuralın üstünden kontrol çalmamalı. [focus identity](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/galaxy/GalaxyCanvas.tsx:672), [gesture](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/galaxy/GalaxyCanvas.tsx:2077)
- Ses preference/context unlock/foreground ve cue cooldown/key dedupe,6voice sınırı, synth cue'lar var. Ses başarısızlığı oyun eylemini reject etmez. Haptic desteklenmeyen cihazda sessizce atlanır. “Audio yok” gibi eski doküman başlıkları güncel gerçeği temsil etmez. [sound](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/lib/sound.ts:6), [haptic](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/lib/haptics.ts:24)
- EngineJets mevcut craftların motor plume'larını instancing, pooled scratch ve culling ile çizer; yeni bir filo VFX motoru yazmak gerekli değildir. [EngineJets](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/galaxy/EngineJets.tsx:19)
- Mobil tasarım standardı350×812; etiket/temel sonucun yalnız renk/ses veya hover'a bağlı olması yasak. Hata, pending, başarı ve eski bilgi doğru ayrılmalı; tüm ürün metni6dilde aynı koşulu taşımalı. [visual-design](/home/yildirim/Desktop/Coding/MyProjects/blindspace/docs/visual-design.md:144), [ux-writing](/home/yildirim/Desktop/Coding/MyProjects/blindspace/docs/ux-writing.md:92)
- PerfSession gerçek admin kayıt altyapısı sunar: frame stalls, Long Tasks/Resource Timing, draw calls/triangles/texture ve device/quality bilgisi. Yeni performans iddiası buna veya gerçek cihaz profiline dayanmalıdır. [perfSession](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/lib/perfSession.ts:12)

### Inferences

**Görsel olay sözleşmesi H:** Her önemli anın tetikleyicisi sunucu state değişimidir. İstemci feedback etkisi, kaynak kazanımı/hasar/algılama otoritesi olmaz. Aynı committed event yeniden gelirse state değişmez, büyük ilk-kez efekti tekrarlanmaz. Client onayı beklerken düşük yoğunluklu “işlem başladı” feedback'i olabilir; başarı anı ayrı. Birden fazla açılma çevrimdışıyken tamamlandıysa otomatik sinematik kuyruğu yerine bir ana sonuç ve isteğe bağlı ayrıntılar.

| An | Oyuncu amacı | Dünya/asset | Kamera ve süre hipotezi | Ses/haptic | UI + düşük maliyet/sessiz fallback |
|---|---|---|---|---|---|
| İlk güç | Kendi eyleminin gemiyi çalıştırması | Mevcut şalter/ışık/rafineri | Kamera şart değil; tek görsel odak | Mevcut switch/thunk | Güç durumu+aynı tekrar kullanılabilir kontrol |
| Rafineri | Üretim başladığını fark etme | Ocak ısınması/ışık → kaynak akışı | Sheet içine kamera uçuşu gerekmez | ignite+hafif rumble ilkkez | Gerçek üretim artışı, buffer≠store farkı |
| Anten/SURVEY1 | Artık hedefin içini okuyabilme | Bay hasarı söner, kısa enerji hattı, hedefe uplink | İsteğe bağlı0,5sn odak; kullanıcı pan anında keser | weld sonu+signal | Sonda ikonu ve gerçek hedefte bilgi farkı; teleskop halkası yok |
| Fiziksel anten revizyonu | Kurulan mekanizmanın görünmesi | Ayrı submesh/pivot/anten rig gerekir; mevcut1mesh'e sadece rotation uygulamak tüm gövdeyi döndürür | Kısa1–1,5sn bile yeterli, tempo koşulu değil | Hafif mekanik servo | Asset gecikirse bay glow+durumla aynı mekanik anlaşılır |
| Tersane | Dışarıya müdahale kapasitesi | Mevcut cargo bay ışığı + gerçek craft spawn | İlk launch takip önerisi; tekrarlar oyuncu isteğiyle | launch+tap | Gönderim bedeli/ETA/kapasite, gerçek izinli hedef |
| İlk maden dönüşü | Kendi planının ekonomiye girmesi | Craft geri gelir, kaynak hedefli akış | Oyuncu bakıyorsa yerel kısa vurgu; başka ekranı zorla kapatma | cargo+commit | Fiili kargo, ne eksik/neyi karşılıyor, bir sonraki seçim |
| Teleskop | Görülen hareket ile kalıcı rota bilgisi farkı | Gerçek identify sphere, earned known contact |0,5–0,8sn çevreye isteğe bağlı açılma, pan keser | Yumuşak yeni bilgi cue | Halka+bilinen hareket ikonu; temas yoksa öğretim bekler, sahte contact yok |
| Radar | Teleskop dışındaki belirsiz hareketi ayırt etme | Gerçek detect sphere ve? | Contact varsa görünür alana öneri, kritik işlemde zorla kamera çekme yok | Kısa iki vurgu, gerçek alarmdan daha hafif | ? tanınmayan demek; güncel/son görülme zamanı; kesin filo içeriği uydurma yok |
| İlk savunma/çatışma | Risk, neden ve toparlanma | Gerçek fleet route+engagement VFX/rapor; görsel replay authoritative sonuca bağlı | Canlı bakıyorsa kısa odak; isteyen atlar/sonra izler | shield/impact ölçülü; hiçbir time-stop sunucu simini durdurmaz | Kazanılan/kaybedilen varlık+neden için bilinen kural; kesinlik vaat eden kazanma yüzdesi yok |
| Motor onarımı | Çıkışa yaklaşma | Drive bay kademeli ışık, hasar temizlenmesi, hazırda plume testi | Her routine repair'de yakın çekim yok; ilk çalıştırma2sn isteğe bağlı | Düşük spool/warp hazırlık | Onarım halen sürüyorsa ready görünümü verme; fiziksel statü ile kuyruk niyetini ayır |
| Sıçrama | Küçük maceranın kapanışı ve büyük oyunun açılışı | Mevcut25sn sahne yeniden kullanılır | Baştan Atla/Devam seçeneği; ör.8–12sn kısa sürüm deney adayı, süre onaylanmış değil | Var olan warp motifini geliştir | GPU yoksa kısa galaksi→gezegen kartı; sunucudaki iniş sonucu aynen tamamlanır |

**Üç görsel yoğunluk seviyesi H:** Rutin seçim/üretim: küçük ses/haptic+yerel ışık; yeni kabiliyet/ilk uçuş: bay/nesne+tek UI notu; ilk çatışma/ana geçiş: kısa sahne veya replay. Aynı tonda her eylemi peak yapmak öncelikleri siler. Kart/ışık/partikül/ses aynı olayı farklı zamanlarda kutlamamalı. Her başarı sayfayı başka yere götürmemeli; “İzle” oyuncu kontrolünü korur.

**İstemci mimari önerisi H:** Yeni genel hikâye motoru veya ikinci tutorial state machine kurmadan mevcut `openFeatures`, `shipObjective`, gerçek mission/report state ve persisted unlock seen/facts'ı kullan. `tutorialStep` yalnız yardım/okuma tercihini hesaplasın; harcama yetkisini backend kuralları belirlesin. Oyuncunun seçtiği hedef/niyet için gerçek control-selector ve world target aynı kaynaktan türesin. Sıra: gerçek acil alarm > oyuncunun yürüttüğü işlem > yeni sonuç > yeni kabiliyet > isteğe bağlı yardım. `bottomSurface` tek sahibi korunur.

**Mobil/performans kabul taslağı H:**

- Tek ana galaksi Canvas'ı korunur; yeni her sistem veya sheet için ikinci aktif3D renderer kurmak varsayılan çözüm değildir. Prolog/final ayrı sahnelerinin bütçesi de aynı cihaz tercihine uyar. Asset beklerken eski/hasarlı gemiyi “yeni onarılmış” gibi sahte placeholder'a çevirmeyiz; bilgi durumu ve gerçek yetenek UI'de görünür. Hareket OS reduced-motion tercihine bağlanmaz; oyuncunun oyun içi kamera kontrolü/skip tercihi ve kalite katmanı kullanılır.
-350×812 DPR2 touch ve en az bir gerçek düşük/orta Android cihazda aynı görev; alt sekme/close/ana komut baş parmakla tam dokunulabilir, scroll sticky footer altına veri saklamaz.6locale, uzun ad ve yüksek sayı ile okunur. Sadece SwiftShader başarı performans ölçümü değildir.
- Görsel kalite ayarı ayrı prolog ve migration Canvas'ında da uygulanır. İlk görüntü asset indirmesi, shader warmup ve etkileşim hazır zamanı ayrı ölçülür; “3D vardı” başarı ölçütü değil.
- Yeni efekt için mevcut baseline'a göre draw-call/texture/RSS/frametime farkı raporlanır. Hedef örneği düşük cihaz30FPS/33ms, orta60FPS/16,7ms profili olabilir; bunlar prototip bütçesi, şu an karşılanmış veya evrensel minimum değildir. P95stall,10dakikalık ısınma/batarya ve arka plan dönüşü ayrıca değerlendirilir.
- Aynı anda tek ana yönlendirici nabız.20gerçek contact ekranda olsa da20NPC pointer yok; görsel cue, sensörün kazandırmadığı bilgiyi sızdırmaz.
- Sessiz/sıfır titreşim/efekt düşükken oyuncu “ne oldu/ne zaman/ne yapabilirim” sorularını cevaplayabilmeli. Renk ikonu/etiketi destekler, tek bilgi taşıyıcısı değildir.
- Kamera kullanıcı pan'ıyla kesilir, aynı target poll'da tekrar çekilmez; transition yarıda background/context loss/reload alırsa gerçek state'e güvenli döner. Final animasyonu skip veya crash mükerrer ödül/iniş üretmez.
- Tek tek yeni bütün efektler için pahalı full-screen pass yerine mevcut sprite/instancing/emissive altyapısı tercih edilir; gerçekten gerekmedikçe realtime shadow/light veya yeni composer eklenmez. Hangi etki pahalı bilinmiyorsa önce profil, sonra karar.

**P0/P1/P2 entegrasyon katkısı H:** P0 erken eylem yetkisinin netliği, gerçek sonuç/queue/fuel state ve tüm starter boyunca aynı hedef kaynağı; P1 gerçek ilk-loop/pilot akış+modül-bazlı hasar/sonuç+guide/push tercih ayrımı; P2 anten submesh ve premium animasyon revizyonu. Model rig asset işi P0oynanışı bloke etmemeli. Önce davranış regresyonları TDD, sonra prototip/normal350px akış, sonra cihaz profili. Değişim flagsız devasa kesim yerine seçilebilir cohort; geri dönüşte mevcut gemi/fact/mission kayıtları yorumlanabilir kalmalı.

### Gaps

- VFX/kamera/perf önerilerinin hiçbirinin prototipi bu oturumda yapılmadı. Hangi oyun anının oyuncu tarafından gerçekten anlaşıldığı kullanıcı testi gerektirir.
- Fiziksel anten asset revizyonunun sanat maliyeti, üç hull için export/pivot eşlemesi ve tüm hasar varyantları sanat üretim denemesi olmadan tahmin edilemez. Mevcut tek mesh verisi uygulanabilirlik sınırını gösterir; üretim süresi söylemez.
- Global hasar eşiğiyle sistem sparks çelişkisi koddan çıkarımdır; normal yeni hesapta SURVEY1 bitişinin ekran görüntüsü bu oturumda alınmadı. Yeni test→FAIL→kod→PASS ve görsel doğrulama uygulama aşamasına aittir.
- Guide localStorage tercihi ve statik landing tipleri çoklu cihaz/başka hesapta tekrar öğretim riski taşır; bu araştırma mevcut sahici state persistence'ını değiştirmemiştir.
