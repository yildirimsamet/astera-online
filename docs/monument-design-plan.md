# Monument — ürün kararları ve geliştirme taslağı

Tarih: 2026-10-04. Güncel durum: A–F kapsamındaki native filo, sezon, API, UI, model ve harita bağlantıları uygulanmıştır; ikinci bağımsız incelemenin düzeltmeleri ve hedefli regresyonları tamamlanmıştır. Son görsel kontrol ve genel test kapısı kapanış kaydına eklenecektir. `MULTI_WORLD.rulesetVersion = 16`: yeni sezonlar beş anıt ve beş HP radyasyon bulutuyla açılır; mevcut 14–15 sezonları geriye dönük değiştirilmez. Canlı `MONUMENT-LOCAL` sezonda özellik test edilebilir. Sahibin son talimatıyla sezon ekonomisi simülatörü, snowball audit ve kalibrasyon bu işin kapanış kapsamından çıkarılmıştır; doğrulama komutu `pnpm verify --exclude-sims` olacaktır. Radyasyon görseli ve son %25 şeffaflık değişikliği sahibi tarafından onaylanmıştır.

## 1. Amaç ve kapsam

- Galaksinin dışına eklenen alanda 3–5 adet, 3D modelle gösterilen, sabit monument bulunur.
- Mevcut galaksi büyüklüğü, gezegen konumları ve mevcut yörüngeler korunur. Kodda mevcut galaksi yarıçapı 4.500 birimdir.
- Monument, T3–T4 filolarla mücadele, HOLD, takviye ve fiziksel kaynak taşıma hedefidir. T1–T2 için doğrudan tier yasağı konmaz; yol hasarı, garnizon ve oyuncuların savunması erişimi zorlaştırır.
- Yaklaşık 3–4 saatte bir lojistik kararı hedeflenir; bu bütün gemiler için zorunlu kalış süresi değildir. Sahibin son kararı: dayanıklı T4 gemiler 8–10 saate kadar dayanabilir.
- Özellik bir sonraki sezonla açılır. Mevcut sezonların kuralları geriye dönük değiştirilmez.
- İlk sürümde monument'ların üretim ve radiation değerleri aynıdır. Her monument'ın değerleri ilerisi için ayrı ayarlanabilir.
- Monument konumu ve kontrol eden oyuncu/klan herkese açıktır. Kesin düşman filo bilgisi başarılı probe raporundan öğrenilir.
- Gelen saldırı uyarısı saldırı filosu yola çıkar çıkmaz monument'ta HOLD eden bütün oyunculara gider; katılmayan klan üyeleri bu uyarının alıcısı değildir. Uyarı radiation alanına girişi veya varışı beklemez.

## 2. Onaylanan ürün kararları

### Kontrol ve filo sahipliği

- Klansız oyuncunun tuttuğu monument oyuncunun; klan üyesinin tuttuğu monument klanın kontrolündedir.
- Gemiler ve taşıdıkları yük her oyuncunun kendisine aittir.
- Yalnız yük gemileri de kontrolü sürdürebilir. Son savaş gemisinin ayrılması kontrolü otomatik bitirmez ve kalan yük gemilerini eve göndermez.
- Kontrol, tutan tarafa ait hiçbir gemi kalmadığında sona erer.
- Klandan ayrılan veya atılan oyuncunun monument filoları kendi yükleriyle geri döner. Kalan üyeler monument'ı tutmaya devam edebilir.
- İlk ele geçirme için nötr garnizonla savaşılır. Oyuncu kontrolündeyken savunmayı oyuncular yapar.
- Monument boşaldıktan 24 saat sonra nötr garnizon geri gelir. Tekrar tutulması boşluk dönemini bitirir; önceki boşluk döneminin event'i yeni kontrolü bozmaz.

### Kapasite ve varış

- Bir monument'ın başlangıç kapasitesi level 10 gezegen hangarı kadardır: mevcut kodda 7.270 bulk/hacim. Gemi adedi değildir.
- Dost filolara gönderim sırasında kapasite rezervasyonu yapılır. Yolda olan rezervasyonlar ve HOLD'daki gemiler aynı kapasite bütçesini kullanır.
- Aynı oyuncu veya klan arkadaşları ayrı filolar gönderebilir.
- Saldırı filosu kapasiteyi aşabilir. Savaş normal büyüklüğüyle çözülür; zaferden sonra kapasite sınırı HOLD'a geçişte uygulanır.
- Zaferde en yüksek tier'deki hayatta kalan gemiler öncelikle HOLD'a alınır; sığmayan gemiler kendi sahiplerinin eve dönüş yoluna çıkar.
- Aynı tier'deki gemiler birlikte sığmıyorsa oyunculara ayrılacak kapasite ortak filodaki savaş güçleri oranında belirlenir. Hacim oranı veya oyuncu başına eşit pay kullanılmaz; yüksek tier önceliği korunur. Bölünemeyen gemiler, artan hacim ve eşitlikler için deterministik seçim uygulanır.
- Yüksek tier savaş gemileri bütün kapasiteyi doldurursa daha düşük tier yük gemileri geri dönebilir ve üretim alınamayabilir. Bu durum gönderim önizlemesinde açıklanır; gizli yük gemisi kotası yüksek tier önceliğini bozmaz.

### Savaş

- Mevcut klan ortak saldırısının hazırlık akışı monument hedefini destekler.
- Birbirinden bağımsız gönderilen filolar varış sırasıyla savaşır; sırf aynı klandalar diye otomatik birleşmez.
- Her oyuncunun araştırması ve taşınan hasarı savaşta kullanılır. Varış, savaş sonu ve HOLD'a geçiş ücretsiz tamir değildir.
- Onaylanan ele geçirme koşulu: bütün savunma temizlenir ve saldıran tarafta en az bir canlı savaş gemisi kalır. Ele geçirdikten sonra yalnız yük gemileriyle kontrol devam edebilir.
- Kısmi sonuçta savunan taraf kontrolü korur; saldıranın sağ kalanları döner. İki taraf da tükenirse monument boşalır.
- Monument savaşına gezegenler arasındaki tier sınırı veya monument filosunu koruyan oyuncu kalkanı uygulanmaz.
- Monument'a PvP saldırısı göndermek saldıranın evindeki gezegen kalkanını normal PvP gibi düşürür.
- Normal PvP Dominion hesabıyla kazanma/kaybetme vardır. Nötr garnizon ve radiation ölümü PvP zaferi değildir.
- Çok oyunculu monument savaşı mevcut klan ortak saldırısı ve klan destek filosu savaş altyapısıyla kurulur; her oyuncunun gemileri, araştırmaları, hasarı ve savaş sonucu ayrı izlenir.
- Kişisel Dominion kazancı/kaybı, savaşa katılan oyuncuların kendi taraflarının ortak filosundaki savaş güçleri oranında paylaştırılır. Toplam puan normal savaş kurallarına göre hesaplanır ve kişisel payların toplamı tarafın sonucuna eşittir. Savaş başındaki katılım gücü kullanılır; gemilerinin savaşta yok olması oyuncunun puan payını silmez. Gezegen destek savaşlarının mevcut puan davranışı değiştirilmez.
- Ek karar (uygulama sırasında kullanıcı yanıtı): bir tarafın toplam savaş gücü sıfırsa yalnız bu durumda kişisel Dominion payı savaş başındaki yük gemilerinin ve Collector'ın yapım değerlerine göre dağıtılır. Pozitif savaş gücü bulunan tarafta bu fallback kullanılmaz.

### Döteryum üretimi ve taşıma

- Monument sabit toplam hızla döteryum üretir. Oyuncu sayısı toplam üretimi artırmaz.
- Payın ağırlığı oyuncunun o monument'taki canlı savaş gemilerinin toplam gücüdür. Aynı oyuncunun bütün HOLD filoları birleştirilerek pay hesaplanır.
- Evdeki ve başka görevdeki gemiler ağırlığa katılmaz. Yük gemileri savaş gücü eklemez.
- Döteryum oyuncunun kendi yük gemilerine aktarılır; kaynağın eve varması için fiziksel dönüş gerekir.
- Bir oyuncunun döteryum payı kendi canlı yük gemilerine kargo kapasitelerine göre benzer doluluk oranıyla dağıtılır. Oyuncular arasındaki pay savaş gücüne, aynı oyuncunun yük gemileri arasındaki dolum kargo kapasitesine dayanır. Yük gemileri sırayla tamamen doldurulmaz.
- Üretimden pay almak için oyuncunun pozitif savaş gücü ve kendi boş yük kapasitesi bulunmalıdır.
- Yükü dolanın veya yük gemisi bulunmayanın alamadığı pay, boş kargosu ve pozitif savaş gücü bulunan diğer oyunculara yeniden dağıtılır.
- Kimse yük alamıyorsa üretim monument deposunda birikmez. Yalnız yük gemileriyle kontrol mümkündür ama üretim payı sıfırdır.
- Monument üretiminden otomatik klan payı kesilmez. Herkes kendi gelirini alır.
- Oyuncu kendi filosunun istediği kısmını, yüküyle birlikte manuel geri çağırabilir. Kısmi dönüş filo, hasar ve yükü bölerek taşır.
- Radiation ile yok olan yük gemisinin taşıdığı döteryum kaybolur.
- PvP'de yok edilen düşman yük gemilerinin döteryumu, kazananın hayatta kalan yük gemilerinin boş kapasitesi kadar yağmalanabilir.

### Radiation ve tamir

- Yeni kural gemi başına sabit HP hasarı/dakikadır; maksimum HP'nin yüzdesi veya ek tier direnci değildir.
- Hasar yalnız bulut içinde geçen süre için işler. Gidiş, HOLD ve dönüş birlikte hesaba katılır.
- Her gemi ayrı ayrı aynı çevresel HP hasarını alır. Gemi sayısı hasarı bölmez; eskort başka gemiyi radiation'dan korumaz.
- Probe ve drill/Prospector gibi madencilik araçları normal radiation hasarından muaftır. İstisna listesini mevcut gerçek araç kimlikleriyle sınırlandırmak gerekir.
- Diğer filo gemileri, hangi görevde bulutu geçerlerse geçsinler hasar alır. Pirate, trade, convoy ve diğer uçuş yolları kapsamdan sessizce düşürülemez.
- HOLD süresi dolduğunda veya kargo dolduğunda otomatik dönüş yoktur. Oyuncu geri çağırır; kayıp eşiklerine ulaşıldığında gemiler yok olur.
- Mevcut iniş kuralı: hasar %20 veya altındaysa ücretsiz onarım; üzerindeyse Repair Station. Dock'taki gemi onarılmadan yeniden fırlatılamaz.
- Şiddet, bulut yarıçapı, dış katman mesafesi, üretim ve garnizon rakamları uygulama sırasında gerçek filo/ekonomi verileriyle önerilecek ve kullanıcıyla kararlaştırılacaktır. Şimdi yeniden sayısal seçim istenmez. Daha önce konuşulan örnek HP/dakika değerleri onaylanmış denge değerleri değildir.

### Monument probe'u

- Probe normal radiation hasarı almaz; monument'a ulaştığında ayrı bir kayıp kuralı çalışır.
- Varışta %90 yok olur, %10 hayatta kalıp geri döner.
- Gelen rapor mevcut gemi türlerini ve adetlerini %100 doğrulukla gösterir. Gezegen probe'undaki belirsizlik/accuracy bantları uygulanmaz.
- Yalnız hayatta kalıp eve dönen probe rapor getirir. Ölen probe rapor veya kesin filo verisi iletmez. Snapshot monument'a varışta alınır; rapor eve dönüşte teslim edilir.
- Rapor bir gözlem anını anlatır; ilerideki takviye, kayıp veya geri çağırmayı otomatik takip eden canlı bilgi değildir.

### Sezon kapanışı

- Sahibin açık kararı: sezon sonunda HOLD'daki, monument'a giden ve monument'tan dönen bütün monument filolarının hayatta kalan gemileri ve mevcut yükleri doğrudan eve aktarılır; normal dönüş uçuşu başlatılmaz veya devam ettirilmez.
- Aktarımdan önce her filonun gerçek uçuş/HOLD durumuna göre radiation sezon bitiş anına kadar hesaplanır. Üretim yalnız fiilen HOLD edilen süre için hesaplanır. Daha önce yok olmuş gemi veya kargo geri verilmez.
- Aktarım bitiş anından sonra kaynak üretmez, dönüş yakıtı tüketmez ve hayali dönüş radiation hasarı uygulamaz.
- Eve aktarılan gemilerin mevcut hasarı korunur; normal iniş/dock kuralı uygulanır. Köken gezegeni artık oyuncunun değilse mevcut güvenli eve dönüş/fallback kuralı kullanılır.
- Normal oyun sırasında dönüşler manuel kalır. Bu kapanış aktarımı yalnız sezon sonu kuralıdır.
- Kapanış aktarımı ve ilgili görev/event'lerin sonlandırılması birlikte yapılır. Sonradan teslim edilen varış, savaş veya dönüş event'i ikinci kez gemi, yük veya puan yaratamaz; monument filoları sezon kapanışını bekletemez.

## 3. Koda karşı doğrulanan noktalar

| Alan | Gerçek durum ve etkisi |
| --- | --- |
| Radiation | packages/rules/src/radiation.ts aynı yüzde dozunu bütün gemilere uygular. HP modeli için gemi ve oyuncu araştırması bazında hesap gerekir. |
| Hasar saklama | packages/rules/src/damage.ts hasarı basis point lotları olarak taşır. HP modelini uygulamak hasar depolama biçimini mutlaka değiştirmek demek değildir; dönüşüm ve kesir koruması gerekir. |
| Çok oyunculu savaş | resolveBattle destekçilerin hasarını taşır; ilk savunmacı stack'i hasarsız gezegen ev sahibi olmak zorundadır. Monument'ta bütün savunmacılar hasarlı olabilir; tek savunmacı yolu da uyarlanmalıdır. |
| Filo gücü | combatValue yaşayan ve ateş eden gövdelerin değerini sayar; yük gemileri hariçtir. Pay hesaplaması için mevcut oyundaki güç ölçüsünü kullanmak planlayıcı önerisidir. |
| Görev hedefleri | missions ve clan_wars mevcut hedefi gezegen FK'sı olarak saklar. Monument hedefi ve fiziksel rota için açık model gerekir. |
| Klan operasyon kilidi | Mevcut ortak savaş bütün filolar dönene kadar operasyonu kilitler. HOLD'a devredilen filolar operasyonu sonsuza kadar açık bırakamaz. |
| Gezegen probe'u | Mevcut probe raporu varışta snapshot alınarak dönüşte teslim edilir. Monument kayıp ve kesinlik kuralı ayrı uygulanır. |
| Dominion | Normal hesap loot + savunma kaybı - saldırı kaybıdır ve sıfır toplamlıdır. Mevcut ortak saldırıda kişisel sonuç ağırlıkları, gezegen desteğinde ev sahibine yazılan savunma puanı vardır. Monument'ta onaylanan savaş gücü oranlı kişisel paylaşım için bu altyapı uyarlanır; mevcut gezegen davranışı korunur. |
| Sezon kapanışı | freezeSeason uçuşların ve desteklerin tamamlanmasını bekler. Açık uçlu HOLD kapanış için açık biçimde çözülmezse sezon donar. |
| Harita | GALAXY.radius yerleşimi ve DISC_RADIUS kamera sınırlarını etkiler. Dış katmanın kamera/gezinti sınırı ayrı genişletilir. |

## 4. Planlayıcı önerileri — henüz ürün onayı yerine geçmez

- HOLD normal filo gövdeleriyle çalışır; probe ve drill/Prospector kendi görev türlerinde kalır. Bunlar için yeniden radiation veya görev türü onayı istenmez.
- Başlangıç prototipi için beş monument; galaksi seed'iyle tekrar üretilebilen dengeli dış yerleşim. Kesin sayı ve mesafeler denge çalışmasında gösterilir.
- Gemiler gönderenin kişisel hangarında sayılmaya devam eder. Her gönderim normal bir uçuş yuvasını bütün gemileri HOME/LOST olana kadar kullanır; kısmi dönüş ek yuva talep etmez.
- Gidiş ve normal dönüş yakıtı gönderimde ödenir. Döteryum yükü ile dönüş yakıtı ayrı tutulur. Anlık teleporta veya yükten örtük yakıt kesmeye gerek yoktur.
- Yük gemisi gruplarının taşıdığı döteryum fiziksel olarak izlenir. Kısmi çağırmada seçilen gemilerin yükü beraber döner; çağırma kaynağı çoğaltamaz veya hasarı sıfırlayamaz.
- Onaylı en yüksek tier önceliği ve oyuncular arası savaş gücü oranı içinde, bir oyuncunun eşdeğer gemilerinde düşük hasarlı olanları önce tutma. Eşitliklerde sabit kimlik sırası. Cargo/combat oranı için gizli bir kota eklenmez; olası seçim gönderim ekranında açıklanır.
- Kalkışta verilen onaylı saldırı uyarısında ETA gösterilir; probe olmadan kesin düşman gövde/adet/hasar bilgisi verilmez. Ortak saldırı için hazırlık daveti değil, gerçek filo kalkışı uyarıyı tetikler.
- Nötr garnizon çevresel radiation hasarıyla oyuncu gelmeden yok olmaz; mevcut NPC kalıcı hasar politikasına uyum sağlanır.
- Onaylı savaş gücü oranlı kişisel Dominion dağıtımında mevcut klan ortak/destek savaş kuralları ve journal altyapısı kullanılır; klanın kişisel puan hareketlerini toplama kuralı korunur. Tam sayı paylar taraf toplamını değiştirmeden dağıtılır.
- Radiation kaybı normal PvP Dominion'a eklenmez. Gerçek gemi kayıpları sezon istatistiklerinde nedenleri ayrılarak sayılır.
- Sabit üretim hassas kesirlerle biriktirilir; bütün sayıya yuvarlama, sık okuma/filo bölme veya oyuncu sayısıyla yeni kaynak yaratmaz.

## 5. Uygulama yaklaşımı

- Monument ayrı kayıt ve hedef kimliğidir. Görünürlük, filo uçuşu, savaş raporu ve klan ortak saldırısına bağlanır.
- Monuments, player-owned fleet waves, kapasite rezervasyonları, fiziksel kargo ve sonuç/puan journal'ları açık biçimde modellenir. Bir geminin yalnız bir fiziksel konumu ve sahibi vardır.
- Sürekli üretim ve hasar lazy settlement ile hesaplanır. Global tick veya her gemiye dakika başına DB yazımı yoktur.
- Settlement, takviye/varış, recall, savaş, üyelik değişimi, kaynak değişimi ve eşik event'leriyle ilerler.
- Yakın gemi ölümü, kargo dolması ve 24 saatlik garnizon geri dönüşü için gerekli event'ler planlanır. HP modelinde farklı gövdeler farklı anlarda ölür; yalnız bütün filonun ölümüne event kurmak yeterli değildir.
- Bütün değişimler tutarlı lock sırasıyla ve transaction içinde gerçekleşir. Yeniden teslim edilmiş event'ler ikinci savaş, kaynak veya gemi yaratmaz.
- Saldırı kalkışı başarılı olarak kaydedildikten sonra mevcut bütün HOLD katılımcılarına hemen uyarı iletilir. Başarısız gönderim veya ortak saldırı hazırlığı uyarı üretmez. PvP gönderimi saldıranın evdeki kalkanını düşüren mevcut akışla bütünleştirilir.
- Sunucu, istemci tahmini ve simülatör aynı saf HP/radiation ve üretim fonksiyonlarını kullanır.
- Radiation ayarı değişikliği geçmiş dozu yeniden fiyatlamaz. Araştırmalar mevcut filo görevlerindeki snapshot davranışıyla taşınır; geçmiş dozu yeni araştırmayla yeniden hesaplamak ve ücretsiz tamir vermek yasaktır. Yeni bir araştırma politikası için tekrar onay istenmez.
- Eski sezonun yüzde modeli ve yeni sezonun HP modeli kendi ruleset sınırlarıyla okunur. Yeni kapı bütün özellik tamamlandıktan sonra etkinleştirilir.
- Wipe, hesap silme, reclaim, koloni kaybı, klan dağılması, köken gezegeninin kaybı ve arşiv/FK temizliği bütün yeni kayıtları kapsar.

## 6. Oyuncunun göreceği yüzeyler

- Galakside dış katman, monument modelleri ve gerçek hasar alanıyla hizalı radiation bulutu.
- Monument detayında kapasite/kullanım, üretim, HP/dakika, kontrol, kendi filoları ve fiziksel kargo.
- Kendi filolarında gövde bazında kalan sağlık, yük dolma zamanı, dönüş yolunun hasarı ve öngörülen eve varış sağlığı.
- Gönderim ekranında kapasite rezervasyonu, yakıt, yol riski ve savaş sonrası yüksek tier önceliği; savaş sonucu kesinmiş gibi sunulmaz.
- Manuel ve kısmi geri çağırma; seçilen gemiler, beraber dönecek yük ve ETA aynı karar ekranında gösterilir.
- Probe gönderiminde %90 kayıp riski; raporda gözlem zamanı ve %100 doğru adetler. Yalnız hayatta kalıp eve dönen probe rapor getirir. Doğruluk ve teslim kararı yeniden sorulmaz.
- Filo panosu, battle report, bildirimler, klan ortak saldırısı ve mobil odak/gezinti bu hedefi destekler.
- HOLD eden oyuncu saldırı kalkışını hemen bildirimlerinde ve monument/filo ekranında görür; kendi gezegen kalkanının düşmesi saldırı gönderimindeki mevcut PvP açıklamasıyla gösterilir.
- Arayüz CLAUDE.md'deki açıklık, tahmin edilebilirlik, karar desteği ve etkileşim maliyeti kurallarına göre hazırlanır; görsel doğrulama geliştirme kapısıdır.

## 7. TDD ile geliştirme sırası

1. Onaylanan kuralları happy path, adversarial input, zaman ve race beklentilerine dönüştür. Sayısal denge değerleri, kullanıcının talimatıyla ilgili uygulama aşamasında somut öneri olarak sunulur.
2. Rules testleri FAIL: HP dozu, ölüm eşikleri, üretim paylaşımı, kargo ve tier seçim algoritması. Saf kuralları uygula; PASS.
3. Hasarlı tek/çok savunmacı savaş, ele geçirme, yağma ve Dominion testleri FAIL; mevcut gezegen savaşının parity'sini koruyarak saf savaş kurallarını uygula; PASS.
4. Şema ve yeni hedef/rota modeli testleri FAIL; migrasyon, idempotency ve cleanup yollarını uygula; PASS.
5. Gönderim, kapasite, HOLD, kısmi recall, üyelik değişimi ve garnizon event'leri testleri FAIL; servis/worker akışını uygula; PASS.
6. Ortak saldırıdan HOLD'a devir, bütün normal radiation'a tabi uçuş türlerinde hasar, dönüş, cargo loss, tahmin ve sezon kapanışı testleri FAIL; görev/worker entegrasyonlarını uygula; PASS.
7. Probe, sunucu görünürlük sözleşmesi, frontend tahminler ve kullanıcı işlemleri testleri FAIL; arayüzleri ve 3D sahneyi uygula; PASS. 350 px mobil ve masaüstünde görsel/oynanış doğrulaması.
8. Sayısal denge ve filo sirkülasyonu ölçümü; uygulama sırasında sunulan önerileri kullanıcıyla kesinleştir ve gerekli düzeltmeleri TDD ile yap. Son code review ve pnpm verify. Yeni sezon kapısını en sonda aç.

## 8. Gerekli senaryolar

- Solo ve birden çok klan üyesi aynı monument'ta HOLD; çok dalga göndermek payı artırmaz.
- Yalnız yük gemileriyle kontrol devamı ve sıfır üretim payı; son geminin ayrılması/ölümü.
- Gücü olup kargosu olmayan, kargosu olup gücü olmayan, tamamen dolu ve kısmen dolu oyuncular.
- Son alıcının dolması; dönen/yeni gelen geminin payı yalnız gerçek katılım süresinde değişir.
- Hiçbir savaş gücü olmayan fakat yük gemileriyle kontrolü sürdüren taraf; dolu kargo ile sıfır yeni üretim.
- Yolda, HOLD'da ve dönüşte ölüm; farklı HP'li gemiler, mevcut hasar ve araştırmalar.
- Radiation'da kaybolan geminin fiziksel yükü başka gemiye kendiliğinden geçmez.
- Aynı oyuncunun farklı kapasiteli yük gemilerine benzer doluluk oranıyla üretim aktarılması; takviye, kısmi dönüş ve gemi kaybının fiziksel yükü çoğaltmaması veya mevcut yükü başka gemiye kendiliğinden taşımaması.
- Saldırı ve savunmadaki her stack'in ön hasarı; normal gezegen savaşına gerileme olmaması.
- Tam zafer, kısmi sonuç, iki tarafın tükenmesi, yalnız yük gemisinin hayatta kalması ve ele geçirme koşulu.
- Zaferde kapasite taşması, en yüksek tier seçimi, aynı tier eşitliği, bir gövdenin kalan hacme sığmaması, daha küçük alt tier gövdenin boşluğu doldurması.
- Aynı tier'de kapasite paylarının savaş gücü oranına uyması; filo hacmi oranı veya gönderim sırası yüzünden farklı paylaşım oluşmaması.
- Büyük saldırı kapasiteyi aşabilir; dost takviye rezervasyonu aşamaz. Aynı son boşluğu isteyen iki gönderim.
- Muaf probe/drill araçlarının normal HOLD seçicisine veya kapasite/üretim/owner kayıtlarına sızmaması.
- Recall/savaş/varış/ölüm/üyelik değişiminin aynı anda gelmesi; stale event ve worker restart.
- Garnizonun tam 24 saatte gelmesi; yeniden tutulmuş monument'a eski respawn event'inin uygulanmaması.
- Başlangıç nötr garnizonu, oyuncu savunması ve NPC puanı ayrımı.
- Probe kayıp ve başarılı dönüşün deterministik sınırları; fail'den istihbarat sızıntısı olmaması, tekrar teslimde yeniden zar atılmaması.
- Private filo/kargo/araştırma verisinin API ve SSE üzerinden yetkisiz kullanıcıya sızmaması.
- Çok oyunculu Dominion'un her iki taraf için katılımcı savaş gücü oranıyla paylaşılması; savaşta tamamen yok olmuş oyuncunun puan payı, tam sayı yuvarlama, klan journal'ı ve sezon freeze audit'inin tutarlılığı.
- PvP saldırı kalkışında saldıranın evdeki kalkanının düşmesi ve bütün mevcut HOLD katılımcılarına hemen uyarı; başarısız gönderim ve ortak saldırı hazırlığının uyarı üretmemesi.
- Sezon bitişinde gidiş/HOLD/dönüşteki bütün monument filolarının mevcut hasar ve yükle eve aktarılması; yalnız gerçek HOLD süresinin üretimi, bitiş sonrası event'lerin etkisiz olması ve kapanış tekrarının gemi/yük çoğaltmaması.
- Köken gezegeni kaybı, oyuncu/klan silinmesi, sezon kapanışı ve wipe; hiçbir orphan, çoğalan veya kaybolan gemi olmaması.

## 9. Sayısal denge çalışması

2026-10-04 uygulama sırasında kullanıcı şu ölçülmüş ilk sezon değerlerini açıkça onayladı: **5 monument; merkezden 6.000 birim mesafe; her hedefte 1.000 birim bulut yarıçapı, gemibaşı 4 HP/dakika ve toplam 10 döteryum/dakika; araştırmasız 10 Leviathan garnizonu.** Kapasite onaylı 7.270 bulk'tur. Mevcut sezonlarda backfill veya canlı yeni sezon açılışı yapılmaz.

Sağlıklı Citadel 2.158 / 4 / 60 = yaklaşık 8,99 saat; Argosy 1.350 / 4 / 60 = 5,625 saat toplam bulut maruziyetine dayanır. Bu HOLD garantisi değildir: yol ve savaş hasarı aynı bütçeden düşer. Beş hedef toplam 3.000 döteryum/saat üretir. İlk kaba 60/dakika fixture değeri denge varsayılanı olarak reddedildi; 10/dakika esas alınır. Önceki yakın/orta/uzak rotasyon hesapları tarihsel ölçümdür; sahibin son talimatıyla ekonomi simülasyonları ve kalibrasyon kapanış kapısından çıkarılmıştır.

Birlikte ayarlanacak değerler: monument sayısı, dış katman mesafesi, bulut yarıçapı, HP/dakika, üretim/dakika, garnizon kompozisyonu ve araştırması.

Yukarıdaki kesin değerler kullanıcı tarafından onaylandı; yeniden denge onayı beklenmez. Aşağıdaki ölçüm listesi ilk taslak kapsamıdır; yeni ekonomi simülasyonu çalıştırma veya kalibre etme talimatı değildir.

- Gerçek koddan T1–T4 HP, hız, kargo, hacim ve tamir maliyeti alınır; katalog literal'ları yerine hesaplanan HULLS kullanılır.
- Yakın/orta/uzak gezegenler, en hızlı/en yavaş gemiler ve farklı araştırmalar değerlendirilir.
- Gidiş, garnizon savaşı, HOLD, dönüş, tamir ve ikinci filoyla rotasyon birlikte ölçülür.
- Net kazanç, eve ulaşan döteryumdan yakıt, tamir ve kalıcı gemi kaybı maliyetini çıkararak değerlendirilir; kaynakların oyundaki değerleri dikkate alınır.
- Dayanıklı T4 için 8–10 saat kabul edilir. T3/T4 yük ve savaş gemilerinin aynı sürede ölmesi beklenmez.
- Klanın bütün monument'ları tutmasının toplam üretim etkisi ve raid/asteroid/planet ekonomisini gölgeleme riski ölçülür.

### İncelemede doğrulanan HP ilişkisi

HULLS runtime değerleriyle, tam canlı ve aynı SHIP_ARMOR seviyesindeki gemiler için aşağıdaki ilişki sabittir. Örnek süreler Citadel'in toplam radiation maruziyetinin 8–10 saate kalibre edildiği varsayımına aittir; onaylı HP/dakika değeri veya savaş sonrası HOLD garantisi değildir.

| Gemi | Tier | Temel HP | Citadel 8–10 saat dayanırken radiation ömrü |
| --- | --- | --- | --- |
| Atlas | T3 yük | 540 | Yaklaşık 2–2,5 saat |
| Leviathan | T3 savaş | 801 | Yaklaşık 3–3,7 saat |
| Argosy | T4 yük | 1.350 | Yaklaşık 5–6,3 saat |
| Citadel | T4 savaş | 2.158 | 8–10 saat |

Gidiş ve dönüşte bulut içinde geçen süre aynı HP bütçesinden düşer. Araştırmaların HP çarpanı aynı seviyede bu oranları değiştirmez. Bunlar onaylı sabit HP modelinin ölçümleridir; her gemiye aynı kalış süresi garantisi veya yeni gemi HP değişikliği onayı gerektirmez.

## 10. Karar durumu ve sonraki adım

Son yanıtlarla 1–6. maddeler kapandı. 4. madde için kullanıcı kargo kapasitelerine göre benzer doluluk oranıyla dağıtımı seçti; bütün ürün kararları bölüm 2'ye işlendi. Şu anda yanıt bekleyen ürün kararı yoktur.

7. maddenin kesin sayısal değerleri bölüm 9'daki kullanıcı yanıtıyla onaylandı ve sezon seed'ine uygulandı. Sezon ekonomisi simülasyonu/snowball audit sahibin son kararıyla kapsam dışıdır.

Daha önce geri çekilen 46 soruluk liste açık karar listesi değildir; onaylı kararlar tekrar sorulmaz. Bölüm 4'teki teknik öneriler kullanıcı onayı gibi gösterilmez. Güncel uygulama kapsamı ve ilerleme aşağıdadır.

## 11. Kod incelemesi ve uygulanacak iş sırası

### İnceleme sonucu

Ürün kararlarını yeniden açmayı gerektiren bir çelişki bulunmadı. Kodda doğrulanan entegrasyon sınırları:

- `RadiationSource.intensityPctPerMinute`, `segmentsDoseBp`, `applyDose` ve sunucudaki `settleFlightRadiation` mevcut yüzde modelidir. Yeni HP kaynağı ayrı tip ve fonksiyonlarla okunacak; mevcut kaynağın alanı yeniden anlamlandırılmayacak. `MULTI_WORLD.rulesetVersion` ilk dilimde yükseltilmeyecek.
- `DamageLot.damageBp` tam sayıdır; her settlement'ta HP dozunu tam sayıya indirgemek sık okuyan veya filosunu bölen oyuncuya ücretsiz sağlık verir. HP yolunda her hasar lotunun tam basis point değeri yanında kesri taşınacak. Aynı gövdenin farklı hasar durumları birleştirilmeyecek. Mevcut hasarlı gemiler ilk HP hesabına aynı hasarla girecek.
- `hullTech` savaşta kullanılan HP çarpanını zaten hesaplıyor. Radiation aynı `HULLS[hull].hp × hullTech(snapshot, hull).hp` değerini kullanacak; ikinci bir zırh veya tier direnci formülü yazılmayacak. `missions.tech` ve `clan_war_contributions.tech` mevcut snapshot sınırlarıdır.
- Probe katalogdaki bir `HullId` değildir; Prospector'ın gerçek kimliği `PROSPECTOR`'dır. Muafiyet, bütün `SUPPORT` sınıfını muaf tutarak uygulanamaz: yük gemileri ve `GARBAGE_COLLECTOR` hasar almaya devam eder.
- `resolveBattle` ilk savunmacıda hasarı reddediyor; tek savunmacı yolu da savunmacının hasarını taşımıyor. Monument için bütün savunmacıları hasarlı kabul eden savaş yolu, HOLD varış servisine bağlanmadan önce tamamlanacak. Mevcut gezegen savaşının parity testleri korunacak.
- Mevcut radiation entegrasyonu pirate, trade ve convoy yollarını kapsamıyor. HP motorunun yazılması bu uçuşların tamamlandığı anlamına gelmez; her uçuş ailesi için servis, dönüş, yük kaybı ve önizleme ayrı entegrasyon testiyle kapanacak.
- Üretim ve hasar tek bir uzun aralığın sonunda bağımsız hesaplanamaz. Arada bir savaş gemisi ölürse ağırlık, bir yük gemisi ölürse fiziksel yük ve boş kapasite o anda değişir. Settlement aralığı ölüm/kargo dolma/varış/recall sınırlarında kronolojik bölünecek; geç çalışan worker doğru geçmişi hesaplayacak.

### Teslim dilimleri ve kabul koşulları

| Dilim | Somut çıktı | Kabul koşulu |
| --- | --- | --- |
| A — HP radiation temeli | Saf HP maruziyeti, kesir koruyan hasar lotları ve ilk gemi kaybı zamanı | Testler önce FAIL sonra PASS; eski yüzde radiation ve iniş testleri yeşil; onaylanmamış denge sabiti eklenmez. |
| B — üretim ve fiziksel kargo | Oyuncu bazında güç toplama, doyan payı yeniden dağıtma, kapasiteye göre benzer doluluk; tier öncelikli HOLD seçimi | Kaynak/gemi korunumu, filo bölme ve giriş sırası bağımsızlığı, dolma/ölüm sınırları; tüm bölüm 8 saf kural senaryoları. |
| C — savaş temeli | Hasarlı tek/çok savunmacı, ele geçirme sonucu, yağma ve savaş başı güçle tam sayı Dominion payları | Normal gezegen savaşının parity'si; her oyuncunun teknoloji/hasar/puanı ayrı; taraf payları toplamı tam korunur. |
| D — kalıcılık ve yaşam döngüsü | Monument hedefi/rota, owned waves, rezervasyon, kargo, olay sürümü ve journal migrasyonları; gönderim/HOLD/kısmi recall | Gerçek Postgres üzerinde kapasite yarışı, idempotency, rollback, üyelik/köken kaybı ve cleanup; tek geminin tek fiziksel konumu. |
| E — görev ve sezon entegrasyonu | Ortak saldırıdan HOLD'a devir, kalkış uyarısı, bütün uçuşlarda HP hasarı, probe ve sezon bitiş aktarımı | Geç/stale event etkisiz; HOLD operasyon kilidini tutmaz; kapanış radiation/üretimi tam bitiş anında keser ve hiçbir monument uçuşunu beklemez. |
| F — oyuncu yüzeyleri | Dış harita, monument detayı, gönderim/recall, filo panosu, rapor/bildirim ve klan hedefi | Yetkisiz kesin filo/kargo/araştırma sızmaz; dört tasarım sorusu; gerçek API ile 350 px ve masaüstü görsel/oynanış doğrulaması. |
| G — denge ve açılış | Gerçek HULLS/ekonomiyle rotasyon ölçümü ve somut sayısal öneriler | Kullanıcıyla denge değerleri kesinleşir; `pnpm verify` yeşil; yeni sezon kapısı tüm entegrasyonlar tamamlandıktan sonra açılır. |

### A dilimi: requirement ve test notları

- Normal yol: bulut içinde geçen dakika × HP/dakika her gemiye ayrı uygulanır; miktar gemi adediyle bölünmez. Gidiş/HOLD/dönüş aynı hasar bütçesini kullanır.
- Geometri/zaman: teğet ve bulut dışı sıfır; durağan HOLD, örtüşen kaynaklar, shelter ve kaynakların aktif zaman pencereleri mevcut geometriyi paylaşır. Kaynak hızı değişirse geçmiş pencere eski hızla hesaplanır. Sıfır süre sıfır hasar; ters/örtüşen rota zamanları reddedilir.
- Hasar: sağlıklı/önceden hasarlı ve farklı HP/araştırmalı gövdeler; tam ölüm eşiği; ilk hasarlı gövdenin ölümü bütün filonun yok olmasıyla karıştırılmaz. Yeniden uygulama idempotency'si servis/event katmanında, verilen dozun doğru uygulanması saf kural katmanında test edilir.
- Kesir: çok küçük doz, sık settlement, bölünmüş rota ve aynı hasar lotunun bölünmesi toplam hasarı değiştirmez. Bu kesir savaş/recall/kalıcılık adaptörlerinde de korunmadan entegrasyon tamamlanmış sayılmaz. HP yolunun iniş/dock ve önizleme adaptörleri de toplam hasarı okuyacak: `2000 bp + pozitif kesir`, %20'nin üzerindedir; eski tam sayı alanına bakarak ücretsiz tamir uygulanamaz.
- Muafiyet: `PROSPECTOR` HP dozundan etkilenmez; yük gemisi ve Collector etkilenir. Probe ayrı görev nesnesidir ve normal HOLD seçicisine eklenmez.
- Kötü girdi: negatif/kesirli gemi adedi, taşınamayacak hasar lotu, geçersiz hasar/kesir, NaN/Infinity doz veya kaynak, geçersiz koordinat ve ters uçuş zamanı reddedilir.
- Dokunulan yerler: `packages/rules/src/radiation.ts` yalnız ortak maruziyet geometrisinin kullanımı için; yeni HP modülü, paket export'u ve yeni test dosyası. Mevcut `applyDose`, iniş/dock, savaş, sunucu görevleri, DB ve frontend davranışı bu dilimin entegrasyon kapsamı değildir.
- Kırılma riski: ortak geometride yüzde dozu veya shelter davranışı değişebilir. Eski radiation testleri ve tüm workspace testleri bu riski kontrol eder. UI bu dilimde eklenmez; F diliminin tasarım ve görsel kabul kapıları zorunludur.

İlerleme: A–C saf kuralları, D gönderim/varış/savaş/HOLD/recall/üyelik ve cleanup servisleri, E'nin gerçek cutoff ile sezon kapanışı uygulandı. Beş monument modelinin optimizasyonu, dokuların yeni atlaslara aktarımı ve ticaret gemisi referansının 3× sahne ölçeği mobil/masaüstünde doğrulandı. Diğer uçuş ailelerinin HP entegrasyonu, ortak saldırı/probe adaptörleri, ürün API'si/arayüzü ve denge/açılış hâlâ sıradadır. E–G tamamlanmış değildir; full suite kullanıcının talimatıyla bütün task'ın sonuna bırakılır.

### B dilimi: requirement, temsil ve test notları

- Fiziksel durum: aynı sahip, dalga, gemi türü, teknoloji, hasar ve gemi başına yükü paylaşan gemiler bir lot olur. Lot kimliği kararlıdır; yük lotun toplamıdır ve lot içindeki gemilere eşit dağılmıştır. Farklı doluluklar/hasarlar ayrı lot kalır. Böylece kısmi recall sayı oranında kendi hasarını ve yükünü taşır; yeni lot kimliği açıkça verilir. Sahiplik doğrulaması kuralda, gezegen/dalga erişimi sunucu sınırında yapılır.
- Üretim: aynı oyuncunun canlı HOLD savaş gemileri `combatValue` ile birleştirilir. Dedicated CARGO gemileri ve onların dalga araştırması kapasiteyi belirler; savaş gemilerinin normal raid kargosu ve Collector üretim deposu değildir. Sabit toplam üretim, pozitif güç ve boş kişisel kargosu olan oyunculara güç oranında akar; dolanların payı tekrar dağıtılır.
- Kişisel dolum: mevcut yük başka gemiye taşınmaz. Düşük doluluk oranı önce yükseltilir; eşitlenen oranlar kapasite oranında birlikte artar. Tam sayıya settlement başına yuvarlama yapılmaz; mevcut kaynak ekonomisi gibi sonlu kesirli miktarlar korunur. Testler toplam korunumunu ve sık/tek settlement eşdeğerliğini kayan nokta hassasiyetinde kontrol eder.
- Zaman: sabit HOLD aralığı her ilk gemi ölümünde bölünür. Ölümden önce üretilen yük ölen geminin üstündeyse kaybolur; ardından kalan güç/kapasite ile paylaşım yeniden başlar. Doluluk için kapasiteli ağırlıklı dağıtım aynı aralıktaki dolma ve yeniden dağıtımı kapalı biçimde hesaplar. Varış, recall ve üyelik değişimi sunucuda ayrıca aralık sınırı olacaktır; uçuşta üretim yoktur.
- Happy path/kenarlar: bir/çok sahip, aynı oyuncunun çok dalgası, teknolojiyle büyüyen kargo, eşitsiz mevcut doluluk, sıfır üretim/güç/kargo, tüm kargoların dolması, cargo-only kontrol, hasarlı savaş/kargo ölümü, eşzamanlı ölümler, shelter/aktif kaynak penceresi, uzun yokluk, kısmi/tam recall ve salt kendi gemisini seçme. Negatif/kesirli sayım, taşan yük, geçersiz hasar/zaman ve yinelenen lot/seçim/çıktı kimlikleri reddedilir.
- HOLD seçimi: tier önceliği, aynı tier'de ortak hayatta kalan filodaki oyuncu savaş gücü, bölünemeyen bulk, deterministik artan alan ve eşitlikler ayrıca testlenecek. Önce oyuncunun o tier'deki talebiyle sınırlı oransal bulk kotası; sonra sığan gemiler arasında kotasından en fazla eksik kalmış oyuncu. Eşitlik oyuncu kimliğiyle çözülür. Aynı oyuncu/tier içinde katalog gövde sırası, eşdeğer gövdede düşük hasar ve lot kimliği sırası teknik seçimdir. Üst tier'den hiçbir kalan gemi sığmıyorsa alt tier kalan küçük alanı kullanabilir. Çıktı, kaynak lot başına HOLD/dönüş sayısıdır; gerçek kısmi bölmede recall kuralı yeni kimlik ve fiziksel yükü üretir. Dost rezervasyon ve saldırı sonrası seçim aynı şey değildir.
- Dokunulacak yerler: yeni saf `packages/rules/src/monument.ts`, public export ve yeni kural testleri; gerekiyorsa kapasite seçimi ayrı modül. Mevcut gezegen üretimi/yağma, klan paylaşımı, sezon kapısı ve veritabanı bu dilimde değişmez. Ana riskler: dalga bölerek pay artırma, eski yükü başka gemiye aktarma, ölü gemiye üretim yazma ve sık okumayla kaynak/sağlık kaybı.

### C dilimi: requirement ve test notları

- Savaş: ayrı monument giriş noktası mevcut çok sahipli resolver'ı kullanır. Tek savunmacı dahil her iki tarafın taşınan hasarı ve alt-basis-point kesri korunur; kendi dalgasının teknoloji snapshot'ı okunur. Shield daima sıfırdır; ground/Prospector bu hedefte filo değildir. Boş savunma da ele geçirme koşuluna tabidir.
- Kontrol: savunmadan herhangi bir gemi kaldıysa savunmacı korur; savunma bitti ve saldırandan savaş gemisi kaldıysa ele geçirilir; diğer durumlarda boş kalır ve saldıran kargo eve döner. PARTIAL etiketi tek başına sahipliği değiştirmez. Karşılıklı yok oluş ve cargo-only saldırı özellikle testlenecek.
- Hasar hassasiyeti yalnız yeni monument savaş yolunda açılır; normal gezegenin tek savunmacı fast path'i, evde hasar yasağı, salvo ve eski yuvarlama çıktıları bire bir korunur. Aynı kaynak lotundaki gemilerin sağ kalanları ve yok olan kargo miktarı kaynaktan oranlı ayrılır; battle/HOLD geçişi sağlık veya yük yaratamaz.
- Dominion: normal taraf toplamı mevcut kuralla hesaplanır; kişisel paylara savaştan önceki oyuncu toplam savaş gücü ile tam sayı largest-remainder dağıtımı uygulanır. Yok olan oyuncu katkısı silinmez; yinelenen dalga/okuma sırası sonucu değiştirmez. Nötr/radiation skor yazmaz. Sıfır güç paydası için kullanıcı yük gemilerinin yapım değerini seçti ve Collector'ın değerinin de bu toplamda sayılmasını onayladı. Pozitif güç varsa bu istisna uygulanmaz.
- Yağma: yalnız PvP'de yok olan düşman cargo lotlarının taşıdığı kaynak adaydır; kazananın yaşayan dedicated cargo boşluğu kadar fiziksel olarak yüklenir. Canlı düşman yükü, radiation kaybı ve dolu gemilerden kapasite devri yoktur.
- Dokunulacak yerler/risk: `combat.ts` ortak resolver ve hasar yardımcıları, yeni monument savaş/sonuç kuralları ve testleri. Mevcut savaş davranışını kırma riski yüksek; combat digest, klan saldırısı/destek ve kalıcı hasar parity testleri zorunlu. `damage.ts` eski normalize/landing davranışı bu dilimde değiştirilmez; yeni mod HP normalizasyonunu kullanır.

### D dilimi ilk adım: kalıcı model ve migrasyon notları

- Monument ayrı hedef tablosudur; gezegenmiş gibi sahte satır üretilmez. Koordinat, toplam üretim, kapasite, kontrol, son settlement, boşluk başlangıcı ve olay generation değeri açık saklanır. Denge değerleri oluşturma girdisidir; onaysız üretim/radiation varsayılanı yoktur.
- HP kaynakları ayrı tarihsel tabloda tutulur; yüzde kaynağı veya mevcut sezon satırları dönüştürülmez. Kaynak kapanışı geçmiş pencereyi korur, anchor kimliği tarihsel snapshot olduğundan hedef silinince kaynak sessizce kaybolmaz.
- Oyuncuya ait dalga origin gezegen, `units.location`, teknoloji, gönderilen filo snapshot'ı, fiziksel rota, OUTBOUND/HOLD/RETURNING/HOME/LOST durumu, rezervasyon ve zamanları tutar. Partial recall aynı kökenin uçuş yuvasını kullanır; yeni parça ana dalga kimliğini taşır. Origin kaybında cleanup kodu önce güvenli kökene aktarır; FK bu adım unutulduysa sessiz kayıp yerine silmeyi reddeder.
- Gemi lotu dalgaya bağlı hasar/yük manifestidir; adet doğruluğu yine park edilmiş `units` satırlarıyla transaction içinde doğrulanır. Lotların toplamı filo adetlerinin ikinci bağımsız kaynağı değildir. Sağlık kesri ve döteryum PostgreSQL `double precision` ile korunur. Aynı wave'in sahibi/araştırması lotta tekrar kopyalanmaz.
- Testler gerçek, ayrı `_test` veritabanında yeni hedefin gezegenden bağımsızlığını, kesir saklamayı, FK/unique/check sınırlarını, terminal durumları, rollback, tekrar migrasyonu ve cascade temizliğini doğrular. Sonraki D servis adımı kapasite/recall yarışları ve unit–manifest korunumunu aynı transaction'da testleyecek.
- Dokunulacak yerler: `apps/server/src/db/schema.ts`, yeni Drizzle migrasyonu/snapshot ve persistence testleri. Yeni satır üretimi mevcut sezon akışına henüz bağlanmaz. Şema eklemek D–G tamamlandı veya canlı kullanıma hazır demek değildir; wipe/hesap/koloni/klan cleanup entegrasyonu ayrıca gerekir.

### D transaction adımı: HOLD settlement gereksinimleri

- Kilit sırası season → varsa bütün origin/capital gezegenleri artan kimlik → monument → dalgalar artan kimlik → klan → oyuncular. Yalnız HOLD settlement gezegen satırı kilitlemez ve mevcut wave konumundaki unit adetlerini yalnız azaltır; hedef kilidinden sonra gezegen kilidi veya yeni unit/FK ekleme yapılmaz. Gönderim/iniş/recall dünya kilitlerini hedef kilidinden önce alır. Böylece yeni origin keşfetmek için ters kilit sırası veya bütün sezonu serialize eden özel kilit gerekmez.
- Servis yalnız Tx kabul eder. Hedefin kilit altında tekrar okunan settlement cursor'ından gerçek sezon bitişine kadar saf HOLD kuralını çalıştırır. Aynı an veya eski event yeniden çalışınca üretim/hasar tekrarlanmaz. Canlı olmayan sezonda normal işlem reddedilir; kapanış yolu açık seçenekle aynı cutoff'a settle edebilir.
- Dalga manifesti ile `units` gövde/adet/sahip/konum toplamları işlemden önce bire bir doğrulanır. Eksik/fazla gemi, yanlış sahip, taşan yük ve HOLD cursor/varış tutarsızlığı kaynak veya gemi üretmeden reddedilir. JSON araştırma snapshot'ı Zod ile doğrulanır.
- Daha eski çözümlenmemiş OUTBOUND varışı varsa cursor onun zamanını geçemez; varış önce kronolojik çözülür. Varış anına kadar settlement geçerlidir. Böylece geç worker, önce eski kadroyla bütün aralığı üretip sonra gelen gemiyi geçmişe ekleyemez.
- Fiziksel cargo oyuncunun Wealth'ine dahildir; HOLD üretimi, gemi/yük kaybı ve gönderimde ödenen yakıt Wealth'i aynı commit'te yeniler. Hedefteki bütün aktif dalga sahipleri ve ek gönderen için klan → oyuncu kilitleri settlement'tan önce alınır; Wealth yenilemesi ardından ters sırayla klan kilidi istemez.
- Sağlık kesri, yük, ölü gemilerin unit kaybı ve terminal dalga aynı transaction içinde kaydedilir. Son gemi ölünce kontrol gerçek son ölüm anında biter; `emptySince` geç worker saatine yazılmaz. Generation yalnız kontrol/boşluk dönemi değişince artar. Cargo-only HOLD kontrolü korur, üretim almaz.
- Happy path ve kenarlar: çok oyunculu/çok dalgalı paylaşım; teknoloji ve kesir round-trip; eski tarihsel kaynak; radiation ölümünde fiziksel yük kaybı; OUTBOUND/RETURNING manifestine dokunmama; sezon cutoff'u; sık/tek settlement; rollback; gerçek paralel PostgreSQL transaction'larının aynı kaynağı çift üretmemesi. Sonraki adımlar dispatch/kapasite rezervasyonu, recall, savaş, üyelik ve worker event'lerini aynı hedef kilidine bağlar.
- Dokunulacak yerler: yeni `apps/server/src/services/monument.ts` ve entegrasyon testleri. Mevcut yüzde radiation, gezegen ekonomisi ve eski worker davranışı bu adımda değişmez. Riskler: units ikinci sayacı, cursor geriletme, kilit tersliği, sezon sonrası üretim ve son geminin kaybında yanlış respawn başlangıcı.

### D gönderim adımı: requirements ve riskler

- Aynı Tx gatherer quote ve dispatch için sahipliği, gerçek home gemilerini, standart uçuş yuvasını, origin fault/recovery durumunu, snapshot araştırmasını, normal `missionFuel(..., 2)` yakıtını ve `fleetTravelExact` süresini hesaplar. Dost takviye mevcut HOLD bulk + dost OUTBOUND rezervasyonuyla kapasiteyi paylaşır; saldırı rezervasyon almaz ve hedef kapasitesinden büyük olabilir. Cargo-only dost takviye mümkündür. Ground/Prospector, boş/kesirli/negatif/bilinmeyen gemi girdisi reddedilir.
- Sezon ve gönderenin bütün kontrollü gezegenleri artan kimlikle, ardından monument/dalgalar ve ilgili klan/oyuncular kilitlenir. Normal PvP saldırısı gönderenin korumasını mevcut kabul mekanizmasıyla kaldırır; monument'taki gemileri gezegen/newcomer kalkanı korumaz. Quote kalkan kaldırmaz. Üyelik/ownership kilit altında tekrar kontrol edilir; kaymış dünya listesi işlemi güvenli retry için reddeder.
- Home → wave units aktarımı, manifest, iki yön yakıtı, native monument event'i ve bildirimler tek commit'tir. Saldırı kalkışında yalnız gerçek HOLD oyuncuları uyarılır; OUTBOUND katılımcılar veya klanın geri kalanı alıcı değildir. ETA/hedef kimliği verilir, gemi gövde/adet/hasar/tech/yükü bildirim veya SSE'ye konmaz. SSE PostgreSQL NOTIFY ile yalnız commit'te çıkar.
- Testler: normal gönderim/snapshot/yakıt/rota/kişisel hangar; hostile kapasite aşımı; cargo-only takviye; aynı son boşluk için paralel gönderim; aynı home gemisi için yarış; quote/dispatch eşdeğerliği; shield kabulü ve hedef shield'inin etkisizliği; yetkisiz origin, klan dost ateşi, yakıt/yuva/season reddi; rollback'te event/bildirim/gemi/yakıtın tamamının geri alınması.
- Dokunulacak yerler: monument servisi, ortak kendi-kalkanı kaldırma yardımcısı, flight bay sayacı, append-only event/bildirim enum migrasyonu. Eski saldırı koruma ve bütün flight bay kullanan yolların regresyonları gerekir. Özellik seed/API/ruleset açılışına henüz bağlanmaz.

### D/E dönüş ve dock adaptörü: requirements

- HOLD veya gerçek outbound konumundan recall, yalnız oyuncunun seçtiği canlı lot sayısını taşır. Önce bulunduğu aralık settle edilir; geçmiş yük/hasar korunur. Kısmi parça ana gönderimin uçuş yuvasını paylaşır; son gemi geri çağrılırsa kontrol o anda biter. Standart dönüş mevcut güvenli origin/capital fallback'ine gider; ikinci yakıt ödenmez. Native event generation eski gidiş/dönüş event'ini etkisiz kılar.
- Uçuşta üretim yoktur. Tarihsel HP kaynaklarının gerçek rota ve settlement cursor penceresiyle doz hesabı yapılır; zaman aralığını keserken geometrik rota yeniden ölçeklenmez. Ölen fiziksel cargo kendi yükünü götürür, kalan yük diğer gemilere taşınmaz. Dost rezervasyon canlı outbound bulk'a indirilir.
- İniş eşik karşılaştırması hasarın iki parçasını okur: `2000 bp + herhangi bir pozitif kesir` dock gerektirir; kayan noktanın toplamada kesri yutması ücretsiz tamir veremez. Tam %20 ve altı normal oto tamirdir. Ground savunma lotları HP hasar normalizasyonunda geçerlidir; radyasyondaki uçan-filo doğrulaması onları yine reddeder.
- Dock kesri DB'de korunur, farklı hasar kesirleri birleştirilmez. Tamir fiyatı her kaynakta tam sayıya yukarı yuvarlanır; bütün basis point fiyatı tam sayıya denk geliyorsa pozitif kesir ek birimi saklayamaz. Tamir süresi taşınan gerçek hasarı kullanır. Eski kesirsiz fiyat ve iniş sonuçları aynı kalır.
- İncelemede gezegenin döteryum deposu/buffer'ının `real` (32 bit) olduğu doğrulandı. İki gerçek DB testi, 100.000 birimlik depoya gelen 0,000125 birimin tamamen kaybolduğunu FAIL ile gösterdi. Fiziksel cargo kesri eve varınca da korunacağı için yalnız bu iki kolon `double precision` olur; mevcut değerler dönüştürülür, üretim/fiyat/formüller veya sezon ayarları değiştirilmez.
- Testler önce FAIL: %20 ± kesir ve subnormal kesir, karma sağlıklı/hasarlı filo, ground ve geçersiz hasar/count, tamir ücret/süre/lot ayrımı; DB round-trip ve normal tamir bitişi; kısmi/tam recall korunum/izin/yariş, uçuşta kaynak geçmişi, ölüm/son kontrol, stale event, fallback ve sezon cutoff'u.
- Dokunulacak yerler: yeni saf HP damage/dock adaptörü, `shipDamage` sunucu adaptörü ve dock kesir migrasyonu, monument movement/worker akışı. Eski yüzde radiation ve kesirsiz dock davranışı regresyon testleriyle korunur; yeni HP yolu kapalıdır.

### D dönüş review gereksinimleri

- Aynı RETURNING generation için eşzamanlı worker işlemleri bir teslimat ve bir no-op üretmeli; ilk teslimat sonrasında kilit bekleyen işlem kullanıcı recall hatası vermemeli. Manuel recall terminal dalgada hata vermeye devam eder.
- Cargo-only HOLD son savaş gemisi recall edildikten sonraki gerçek settlement aralığında gelir almamalı. Teslimat testi gezegen ekonomisini aynı ETA'ya önceden settle edip yalnız fiziksel kargo farkını ölçmeli.
- Dokunulan yerler: hareket servisi ve hareket entegrasyon testleri. Dünya → monument kilit sırası, manifest/units ve event generation korunur; legacy görev dönüşleri değişmez.
- Recall saati zaten ödenmiş HOLD/flight cursor'ından eskiyse dönüş başlatılamaz; geçmiş konumdan yeniden ışınlanma ve tekrar HP ödeme engellenir. Kalıcı route ve canlı/template garnizon, teknoloji ve hasar JSON'u hedef sınırında doğrulanır. Nötr hasar tekrar saldırılarda korunur; worker outage sırasında sonraki saldırıdan önce süresi gelen template geri kurulur.

### D varış/savaş ve worker requirements

- Hedefe gecikmiş bir event geldiğinde daha eski bütün OUTBOUND varışları `(ETA, id)` sırasıyla, kendi gerçek saatlerinde çözülür; ortak hazırlık dışında aynı klanın dalgaları kendiliğinden birleşmez. HOLD üretimi her kadro değişiminden önce o sınıra settle edilir.
- Origin ve olası güvenli dönüş dünyaları hedef kilidinden önce topluca kilitlenir. Hedef yeniden okunduğunda yeni bir dalganın dünyası bu listede yoksa işlem güvenli retry ister. Savaş önce bütün saldırı filosuyla yapılır; kazananın HOLD seçimi bundan sonra saf kapasite kuralıyla yapılır. REINFORCE kontrol artık dost değilse saldırıya dönüşmeden geri döner.
- Savaş stack'i fiziksel lot'tur: kendi araştırması, ön hasarı ve taşıdığı yük korunur. Yağma yalnız PvP'de zafer tarafının hayattaki kendi cargo boşluğuna, öldürülen düşman gemisinin yükünden aktarılır. Yenilen/taşan canlı gemiler gerçek dönüş başlatır; yok olan dalga gerçek varışta terminal olur.
- Normal toplam PvP Dominion girdileri aynı `battleDominion` kuralına girer; kesirli gerçekleşmiş cargo loot değeri toplamda bir kez en yakın tam sayıya çevrilir. Oyuncu payları savaş başlangıcı güç oranıyla (yalnız sıfır toplam güçte cargo+Collector yapım değeri) dağıtılır; NPC ve radiation puan vermez. Operatör muafiyeti korunur. Kişisel/clan ledger ve immutable kişisel journal aynı commit'te yazılır; oyuncu veya origin temizliği audit'i silmez.
- Monument savaş raporları ayrı gerçek hedef modelinde saklanır; gezegen/pirate rapor binder'ı veya fog sorgusu zorlanmaz. Ürün API'si katılımcıya yalnız kendi roster/hasar/kargo/payını verecek, karşı exact filo başarılı dönmüş probe dışında açılmayacak.
- Nötr başlangıç filosu/araştırması ve respawn template'i açık seed girdileridir; yeni denge varsayılanı yoktur. Garnizon hasarı yenilen saldırılar arasında korunur, template yalnız gerçek 24 saatlik boşluk bitiminde yeniden kurulur.
- Edge/risk testleri: gecikmiş ve eşzamanlı event; stale generation; gerçek ETA öncesi işlem; cargo-only ele geçirememe; cargoyla savunma; çok sahipli puan/yağma; kapasite taşması; değişmiş dostluk; HP ölümü; rollback; audit'in oyuncu silinmesinden sonra yaşaması. Yeni schema, varış servisi, native worker adaptörü ve freeze audit sorgusuna dokunulur; legacy normal gezegen desteği paylaşım kuralı değişmez.
- Reclaim/account delete ve Silent Space transferi aktif OUTBOUND/HOLD/RETURNING kişisel gemileri korur; terminal wave FK ve native wave event'leri origin silinmeden kaldırılır. Monument hedefi, tarihsel kaynakları ve immutable kişisel puan journal'ı başka oyuncunun kişisel temizliğiyle silinmez. `demolish` guard'ı atlayıp aktif dalgayı yok etmeye çalışan çağrıyı da reddeder.
- Üyelik: ayrılma/kick yalnız ilgili oyuncunun OUTBOUND/HOLD dalgalarını gerçek konum ve yükle döndürür; disband bütün üyeleri döndürür. Önce eski roster'ın geliri ödenir. Katılım/klan kuruluşunda solo tutan oyuncunun kontrol kimliği klana geçer, ships/cargo şahsi kalır. Birden çok monument ve mevcut gezegen support'u için bütün dünyalar topluca artan kimlikte kilitlenir; bütün hedef/wave'ler klan/oyuncu kilitlerinden önce hazırlanır. Gecikmiş varışlar önce kendi ETA'larında çözülür. Başarısız yönetim işlemi bütün hazırlığı rollback eder.
- Üyelik hazırlığı gecikmiş PvP varışı çözebilir; çağrı configured operatör kullanıcılarını normal worker gibi taşımalı. Ayrılma/katılma/kuruluş/kick/disband yolu muaf oyuncuya Dominion yaratmamalı. Gerçek gecikmiş saldırı + ayrılma regresyonu önce FAIL ile bu sınırı doğrular; routes → clan service → monument arrival boyunca aynı konfigürasyon geçirilir.
- Aynı konfigürasyon Silent Space'in manuel ve maintenance transferlerinden sistem klan dağıtımına da taşınır. Kendi aktif monument filosu bulunan commander zaten transfer edilemez; quiet leader'ın eski klanı kapanırken başka üyelerin hedeflerindeki gecikmiş operator PvP varışı sıfır Dominion'la çözülmelidir. Manuel ve sweep girişlerinin gerçek DB testleri önce FAIL; mevcut transfer/manual/worker dosyaları ilgili regresyon kapsamıdır.
- Kullanıcının 3 Ekim test talimatı: task bitene kadar yalnız değişen ve ilgili regresyon dosyaları çalıştırılır. Full rules/server/web/sim suite ve `pnpm verify` bütün task'ın sonunda bir kez çalıştırılır.
- Sistem klan dağıtımı: idle leader reclaim edilirken aktif halef yoksa diğer üyelerin monument filoları da kişisel yük/hasarla döner; aktif halef varsa HOLD korunur. Reclaim hazırlığı kaynak oyuncu kilidinden önce yapılmalı; aynı hedef/klan/oyuncu sırası korunur, sonradan gelen üyelik/filo değişimi retry ister. Wipe bütün yeni child kayıtlarını player/clan/world FK'lerinden önce temizlemeli; frozen sezona ait hedef ve tarihsel HP kaynağı yeni sezona sızmamalı. Gerçek reclaim ve wipe testleri önce FAIL; mevcut reclaim/destek/transfer regresyonları ilgili kapsamdır.
- Köken koloni kaybı/secession: aktif OUTBOUND/HOLD/RETURNING dalga ve `units` anchor'ı aynı oyuncunun capital'ine taşınır; yeni controller kişisel filo veya bay almaz. Lot hasarı/yükü, gerçek rota, paid cursor, yakıt ve monument kontrolü değişmez. Devam eden dönüş gerçek önceden ödenmiş rota dozuyla mevcut safe-home iniş kuralına uyar. Bütün ilgili capital/world'ler hedef/wave ve oyuncu kilitlerinden önce toplanır; ordinary arrival/secession girişleri aynı hazırlığı yapar. Stale controller bütün transaction'ı rollback eder; recall/secession race korunum ve deadlock testleri gerekir. Yalnız anchor değişikliği HOLD üretim kadrosunu değiştirmediğinden geçmişi yeniden settle etmez.

### E sezon kapanışı adaptörü: requirements ve riskler

- Lifecycle season UPDATE kilidi altında bütün monument'lar ortak dünya → hedef/wave → klan/oyuncu sırasıyla hazırlanır. Geç OUTBOUND varışları kendi ETA'larında çözülür; yalnız gerçek HOLD aralıkları gelir üretir. Daha önce ev ETA'sına ulaşmış RETURNING için uçuş yalnız o ETA'ya kadar doz alır; hâlâ uçan için yalnız gerçek cutoff prefix'i hesaplanır.
- Sonra hayattaki fiziksel lotlar ve taşınan kişisel cargo doğrudan güvenli eve aktarılır; yeni dönüş rotası/fuel/doz yaratılmaz. Hasar normal HP iniş/dock eşiğiyle korunur. Ölmüş gemi/yük geri verilmez. Wave/manifest/units/event sonlandırması, Wealth, kişisel journal audit ve season snapshot aynı transaction'dadır; stale event ve iki paralel close ikinci teslimat yapamaz.
- Native season end gerçek `endsAt`, forced close `min(now, endsAt)` kullanır. HOLD hiçbir kapanış bekleme sayacına eklenmez. Bozuk yol/manifest bütün kapanışı rollback eder; hedefler generation ile eski event'lerden ayrılır. Başlıca riskler: offline ETA'yı late worker saatiyle değiştirme, return'un home sonrası doz alması, fake suffix, dock kesri, post-cutoff üretim ve season audit'in teslimattan önce çalışması.
- Dokunulacak yerler: yeni Tx kapanış servisi ve freeze girişindeki sınır adaptörü; mevcut normal season/support/joint audit regresyonları hedefli çalıştırılır. Bütün task bitmeden full suite çalıştırılmaz.
- Sezon istatistiği gerçek PvP monument katılımını da saymalı: bir owner'ın çok dalgası aynı savaşı çoğaltmaz; her oyuncunun kendi kayıp gemisi ve gerçekleşmiş kendi loot'u yazılır. Kişisel battle-start güç payı (yalnız sıfır güçte onaylı cargo/Collector değeri) verilen hasarın payıdır; NPC/radiation PvP battle sayacına girmez. Gecikmiş PvP varışı + kapanış testi istatistik eksikliğini önce FAIL ile doğrular.

### F model hazırlığı: kullanıcı gereksinimleri ve riskler

- Kullanıcının `assets/source/models/monuments/` altında sağladığı beş GLB master korunur; yalnız `apps/web/public/assets/models/monuments/` altındaki oyun kopyaları üretilir. Mevcut offline `tools/models.mjs --only=monuments/` hattı kullanılır; diğer onaylı modeller yeniden kodlanmaz.
- Her model yaklaşık 5.000 üçgen, ortalama yaklaşık 1 MB aktarım hedefler. Geometri meshopt, dokular WebP olarak taşınır. Tek dokulu master'ların 4K plate'i küçültülür; üç dokulu master'ların 16× UV tekrarı, normal ve metallic/roughness haritaları korunur. Siluet ve açık kafesler görsel olarak kontrol edilir; dosya hedefi için materyal kaldırılmaz.
- Oyun ölçeği ticaret gemisinin tam **3 katıdır**. Kaynak modeller farklı node ölçeklerinde geldiği için ölçü, node transform'ları korunarak normalize edilen görünür bounds üzerinden uygulanır; ham accessor boyutu referans olamaz. Harita bileşeni bu ortak ölçeği kullanmadan oyun içi entegrasyon tamamlandı sayılmaz. Siluet kenarı, filolardaki tek back-side additive shader rim'iyle düşük maliyetli neon olarak çizilir; post-processing bloom veya per-frame geometry üretimi yoktur.
- Önce runtime GLB varlığı, 4–5 bin üçgen, doku/materyal/UV korunumu, doku boyutu ve dosya bütçesi testleri FAIL; yalnız yeni modeller optimize edildikten sonra PASS. İlgili gemi varlık testleri regresyon kapsamıdır. Master SHA256 değerleri işlem öncesi/sonrası karşılaştırılır. Masaüstü ve 350 px mobil gerçek GLTF yüklemesi görsel kabul koşuludur.
- İlk sayısal PASS görsel review'de reddedildi: çok sayıda UV seam içeren mesh'lerde permissive simplification eski atlas koordinatlarını yeni yüzlere uzatıyordu. Geometri sadeleştirildikten sonra yeni atlas üretilecek; her texel özgün yüksek çözünürlüklü yüzeye projekte edilerek renk/metallic-roughness/normal dokuları yeniden aktarılacak. Normal map yeni tangent frame'e dönüştürülür. Kaynak 16× texture transform örneklemede ve yeni UV'nin ters dönüşümünde korunur. Repeat/clamp/mirror, glTF V yönü, bilinear örnekleme ve normal frame testleri önce FAIL; fiziksel kaynak dosyaları değişmez.

### E normal uçuş HP adaptörü: requirements ve riskler

- Bir sonraki teknik sınır sürüm 16'dır; global yeni sezon varsayılanı bu dilimde 15 kalır. Sürüm 16+ yalnız tarihsel HP kaynağını, 14–15 yalnız yüzde kaynağını okur. Kaynak alanları yeniden anlamlandırılmaz; eski sezonlar backfill edilmez.
- Her canlı gemi kendi kalkış/katkı araştırmasıyla aynı mutlak HP dozunu alır. Prospector muaf kalır; normal cargo/Collector muaftır denemez. Aktif kaynak pencereleri ve recall dönüş geometrisi ortak saf motorla hesaplanır.
- Mission/klan dalgasının ödenmiş zaman cursor'ı tekrar okumada dozu iki kez yazmayı önler; gerçek ETA sonrası süre bu uçuşa yüklenmez. Fraksiyonel BP JSON hasarında, tek/ortak gezegen savaşında, transferin kalan/dönen gövde ayrımında ve Repair Station kararında korunur. Gezegen shield, ground savunma, escape, loot ve mevcut destek Dominion kuralları değişmez.
- İlk happy path/kenar testleri: aynı HP farklı gövde/armor; çok küçük doz; eski/yeni kaynak ayrımı; kapanmış ve kısmi kaynak penceresi; Prospector ve seçici ölüm; tekrar settlement; savaş→dönüş→dock kesir koruması; tam %20 ve üzerindeki kesir; teknolojiye göre lethal gönderim önizlemesi. Worker gecikmesi/idempotency ve mevcut yüzde görev, hasar, combat digest ve transfer/support/joint regresyonları hedefli kapsamdır.
- Dokunulacak yerler: ortak sunucu radiation adaptörü, JSON hasar tipleri/cursor migrasyonu, ortak saf combat/raid hassasiyet seçimi, iniş ve gövdeye göre transfer bölümü. Pirate/trade/convoy kendi fiziksel uçuş adaptörleriyle daha sonra ayrı testlenecek; bu ilk dilimin yeşil olması bütün E'nin tamamlandığı anlamına gelmez.

### E pirate/trade/convoy uçuş requirements

- Sürüm 16+ uçuşlarında kalkış/varış/gerçek dönüş başlangıcı snapshot'ları kullanılır. Worker gecikmesi dozu uzatmaz; gemiler çevre hasarından öldüyse servis bir sonraki aşamada launch snapshot'ından tekrar gemi yaratamaz. Yeni JSON hasar/cursor ve trade armor snapshot migrasyonu gerekir; eski sezonlar değişmez.
- Pirate gidiş dozu PvE savaşından önce uygulanır; radyasyonda tükenen avcılar savaş, ödül veya capture roll yaratmaz. Dönüşte canlı avcı/tow gemisi gerçek HP ile iner; kaybolan taşıma kapasitesinin loot/salvage'ı teslim edilmez. Towed/awarded gemiler ödül kazanıldığı andan itibaren dönüş radiation'ına tabidir; uçuş öncesi maruziyet onlara yüklenmez.
- Trade teslim edilmiş offer kadar snapshotted oranla want öder; kalan offer kaybı ücretsiz satın alma değildir. Dock bekleme aralığı fiziksel intercept konumunda HP alır. Cargo ölümü return haul'ını azaltır, toplam ölüm teslim/gezegene gelir yaratmaz. Prospector eşlik edebilir fakat cargo yerine geçmez. Gelen ölüm, kısmi/total dönüş ölümü, dok, gecikmiş worker, tekrar event ve kapalı kaynak penceresi gerçek DB testleriyle kapanır.
- Convoy ödül hesabı engagement'a ulaşan canlı filoyu okur. Dönüşte orijinal yaşayan filo + ödül gemileri physical units içinde taşınır; yok olmuş launch gemileri tekrar verilmez. Cargo kapasitesi/ödülün mevcut convoy taşıma kuralı korunur; radyasyonda bütün uçuş tükenirse kaynak ve gemi ödülü teslim edilmez. Recovery yolları da gerçek ödenmiş HP/filodan devam eder, snapshot'tan diriltmez.

### E monument probe adaptörü: requirements ve riskler

- Probe gerçek monument FK'sı, kendi rota/saatleri ve ayrı geçici snapshot kaydıyla saklanır; gezegen mission FK'sına sahte target yazılmaz. Mevcut probe fiyatı, hızı ve hedef başına beş saniyelik cooldown korunur; ek hangar, yakıt veya filo yuvası kuralı konmaz.
- Varış sonucu sunucunun sezon anahtarı ve görev kimliğiyle deterministiktir: %90 LOST, %10 RETURNING. LOST rapor, roster veya araştırma üretmez. RETURNING yalnız o varış anındaki HOLD/NPC gövde/adet snapshot'ını taşır; eve varana kadar intel API'sinden okunamaz.
- Geç worker veya daha yeni bir monument okuması geçmiş snapshot'ı yeniden yaratamaz: bütün due wave/probe varışları tek kronolojik çizelgede çözülür. Radiation HOLD kayıpları ve garnizon respawn'ı gözlem saatinden önce settle edilir; probe çevresel HP hasarından muaftır.
- Tests: olasılık sınırları, ücret/rollback, cooldown yarışı, başka sezon/köken yetkisi, LOST gizliliği, gerçek ETA snapshot'ı, teslim öncesi gizlilik, tekrar event/teslim, köken kaybı ve sezon kapanışı. Reclaim/wipe/FK temizliği, native event, pending/traffic ve UI birlikte kapanmalıdır.

### E klan ortak monument hedefi: requirements ve riskler

- Aynı klan operasyonu/hazırlık havuzu ve üyeye ait staging katkısı kullanılır. Hedef PLANET/MONUMENT ayrımı gerçek FK'larla yapılır; monument kimliği gezegen alanına veya sahte gezegen kaydına yazılmaz. Aynı klanın iki farklı hedef türünde eşzamanlı açık operasyonu olamaz.
- Monument'ta hazırlık tier bandı veya hedef gezegen kalkanı istemez. Üyelik/maturity, clan hangar, kişisel gemi/hangar, staging uçuşu ve ödenen staging→hedef→ev yakıtı korunur. Başarısız mark/start/send bütün mutasyonu geri alır; hazırlık HOLD sahiplerine saldırı uyarısı göndermez.
- Gerçek start, staged katkıları kendi teknoloji ve hassas hasarlarıyla native monument waves'e devreder. Tek açık joint grup kimliği ve ortak ETA yalnız bu hazırlıktan çıkan dalgaları bir savaşta birleştirir. Bağımsız aynı klan dalgaları birleşmez. Fiziksel gemi kopyalanmaz, ikinci yakıt veya yuva kesilmez; liderin staging'de hiç yuva tutmayan katkısı gerçek monument kalkışında normal kendi yuvasını kullanır.
- PvP kalkanı gerçek kalkışta her katılımcının kendi onayıyla düşer; hazırlıkta verilmiş onay saklanır. Nötr hazırlıkta verilmemiş bir onay, hedef sonradan oyuncu kontrolüne geçti diye lider tarafından üretilemez. Uyarı yalnız mevcut HOLD katılımcılarına tek birleşik kalkış için gider; karşı tam roster paylaşılmaz.
- Grup savaşı önce bütün canlı saldırı filosuyla çözülür; kapasite ve kişisel güç payları sonra uygulanır. HOLD/geri dönüş/kayıp sahipliği native sisteme geçtiğinde klan operasyonu serbest kalır; HOLD'u veya native recall fragment'ını beklemez. Tam uçuş radiation kaybı da operasyonu kilitleyemez. Native grubun stale event'i ikinci savaş/devir yaratmaz.
- Regresyon kapıları: mevcut gezegen target/contribution/start/battle/recall, typed SQL target check'leri, ortak karma teknoloji/hasar/puan, baskın öncesi kalkan/onay, bay/hangar/yakıt korunumu, kapasite taşması ve ortak uçuş kaybı. F klan hedef schema/UI, pending, reports ve cleanup/arşiv bütün yeni hedef alanlarını okuyacak.

### F sunucu görünürlük ve oyuncu işlemleri: requirements ve riskler

- Sürüm 16 öncesinde gerçek monument/HP kayıtları olsa bile genel API bunları açmaz. Oyuncu ve sezon auth oturumundan çözülür; body/query başka bir oyuncu adına işlem yapamaz. Yanlış sezon/hedef/origin, yabancı wave/lot, ground/Prospector, boş/negatif/kesirli filo ve beklenmeyen alanlar strict boundary'de veya servis kilidinde reddedilir.
- Herkese açık projection yalnız konum/model ordinal, kontrol kimliği, toplam kapasite/kullanım, üretim ve tarihli HP bulutudur. Düşman wave/lot/teknoloji/hasar/kargo kompozisyonu veya gelecekteki uçuş rotası bu payload'a girmez. Başarılı, eve teslim edilmiş probe snapshot'ı yalnız gönderenine verilir; gözlem ve teslim saatleri belirtilir.
- Kendi wave'leri gerçek fiziksel manifest, taşınan araştırma, hasar/HP, cargo, phase/ETA ve rota ile okunur. HOLD gelir/kayıp hesabı ve önceki ETA'daki wave/probe varışları GET/quote/send/recall öncesinde aynı kronolojik çizelgeyi kullanır. Hiçbir okuma gecikmiş varışı atlayarak target cursor'ını ilerletmez. Operator/admin hariç puan kararı bütün yeni girişlerde aynı configured listeden gelir.
- Mutasyonlar mevcut idempotency anahtarıyla aynı Tx içinde kaydedilir; retry ikinci gemi, yakıt, yuva, probe bedeli veya uyarı yaratmaz. Kısmi recall quote'u seçilen geminin kendi cargo/hasarını, dönüş ETA'sını ve kendi araştırmasıyla hesaplanan dönüş sağlığını gösterir; commit seçim/stale ownership kontrolünü yeniden yapar.
- API sonuçları gerçek query/mutation cache ve SSE invalidation'a bağlanır. Harita, monument sheet, filo panosu, bell/report/probe ve klan target aynı gerçek hedefi odaklar. 350 px ve masaüstü oynanış gerçek backend ile doğrulanır; galeri/model screenshot'ı tek başına oyuncu işlemi doğrulaması değildir.
- HP kaynakları eski yüzde bulutlarından açıkça ayrılır; normal attack/transfer/pirate/trade/convoy/klan uçuş quote'ları kendi armor snapshot'ıyla gövde bazında tahmin verir. Kayıp acknowledgement alanı gerçek HTTP boundary ve client mutation'a kadar taşınır. Bütün wing'in zamanlı silinmesi muaf Prospector ve yeni capture/award hull'larını dikkate alır; tek gövde kaybı bütün kanadı silmez.

## 12. Uygulama ve doğrulama kaydı

### F harita ve panel uygulama notları

- Public monument/HP geometrisi galaxy boundary'de ayrılır; kameranın gezinme yarıçapı monument konumlarını ve bulut hacmini içerir, GALAXY.radius/yerleşim ekonomisi değişmez. Modeller ticaret gemisinin üç katı normalize ölçekte gerçek haritaya yerleştirilir ve filolardaki hafif neon rim'i paylaşır. İlk tap LOOK/rail, ikinci tap gerçek API'ye bağlı detaydır; aynı hedefteki query yenilenmesi kamerayı yeniden hareket ettirmez.
- Panel kendi physical wave/lot sağlığını, üretim payını, dolma/ölüm saatini ve dönüş kargosunu gösterir. Değişen seçimin eski quote'u commit'e açılmaz; shield ve lethal radiation açık ayrı onaydır. Kısmi recall lot/count seçimiyle sunucu quote'u alır, kargoyu hull toplamından yeniden icat etmez; RETURNING salt okunur. Probe'un bedeli/%90 kaybı eylemden önce, successful snapshot iki tarih ile verilir. Ağ cevabı kaybında aynı body/idempotency anahtarı korunur.
- Harita/public finder, SSE private transition ve bağlantı yenilenmesi gerçek monument cache'ini yeniler. Klan hedefindeki nullable planet yerine açık MONUMENT discriminator kullanılır. Yabancı kontrol/membership, sıfır kargo/güç, kök bay, yetersiz fuel, quote hatası, seçim–quote yarışı ve sezon kapanışında kontrol reddi review kapsamındadır.
- Yeni contract önce 4 FAIL → 4 PASS; actual controller-name/probe-route regresyonu önce FAIL → PASS. Panel bulunmazken yeni UI testi FAIL; panel/cache/consent/physical recall uygulaması sonrası 6 UI testi PASS. İlk 7 dosyalı frontend gate 139 PASS, çeviri karşılaştırmasında 1 FAIL (iki eş metin); bu metinler Türkçeleştirildi. Full suite bu aşamada çalıştırılmadı.

### F sonuç, bildirim ve native filo review gereksinimleri

- Native kendi uçuşu ilk gövde ölümünü ve bütün kanadın gerçek ölüm anını kendi snapshot zırhı/sağlık/rota/kaynak pencerelerinden tahmin eder. Tek Argosy ölümü sağ kalan Citadel'i haritadan kaldırmaz. Harita fade, refetch ve filo manifesti aynı native dalgaya bağlanır; uçuş rail'inden anıtın kendi HP/kargo/recall paneline erişilir.

- NPC ve oyuncu savaşları, yalnız kendi katılımcı satırıyla mevcut rapor listesinde/deep link'inde görünür. Monument kimliği/ordinal/koordinat immutable savaş snapshot'ında kalır; temizlenmiş bir dalga/oyuncu veya hedef raporu sahte gezegene çeviremez. Karşı tarafın kesin başlangıç/survivor/yaraları açıklanmaz; yalnız doğrulanan kayıpları görünür.
- Her katılımcıya tek sonuç bildirimi, eve gerçek inişte dönüş bildirimi; probe kayıp/başarılı teslimi ve mevcut HOLD sahiplerine kalkış uyarısı anlaşılır monument adıyla gelir. Aynı hedef odaklanır, probe raporu yalnız teslimden sonra açılır. Payload'lar eski planet/pirate bildirimlerini bozmaz.
- Risks: rapor okuyucusunun boş planet history nedeniyle erken dönmesi, birleşik limit/sıralama, tekrar event'te çift bildirim, journal snapshot kaybı, frontend union guard'larının monument'ı planet kabul etmesi. Testler önce FAIL; gerçek API ve 350 px/masaüstü kontrolü kapanış kapısıdır.
- Legacy filo yüzeylerine native view eklenince 31 test yeni hook'ların mocksız bağlamından, typecheck bir eski callback helper tipinden kırıldı. Yardımcılar yeni sözleşmeye uyarlandı; aynı yüzeyler ve native projection **63 PASS / 5 dosya**.

### Güncel A–F çıktısı ve açık işler

- A HP radyasyon temeli; B fiziksel üretim/kargo, kayıp anlarına göre lazy settlement ve tier/güç oranlı HOLD seçimi; C hasarlı çok sahipli monument savaşı, ele geçirme, fiziksel yağma ve tam sayı Dominion payları uygulandı. Collector sıfır güç istisnası ayrıca önce FAIL, ardından PASS testle eklendi.
- D: 0127 hedef/kaynak/dalga/manifest, 0128 native event/uyarı, 0129 precise HP dock kesri, 0130 fiziksel döteryum deposunda double precision, 0131 kalıcı NPC yarası/template ve immutable savaş/puan raporu migrasyonları test ve yerel geliştirme veritabanında uygulandı. Bu madde yazıldığı andaki tarihsel snapshot'tır; güncel `MONUMENT-LOCAL` ruleset 16 sezonu 5 monument ve 5 HP kaynağı ile ayrıca seed edilmiştir. EU-1/EU-2 gibi ruleset 14 sezonlar geriye dönük değiştirilmez.
- Tx servisleri: kilit sırasına uyan HOLD settlement; ortak quote/dispatch; dost kapasite rezervasyonu; cargo-only takviye; kişisel hangar/tek kök uçuş yuvası; bağımsız gerçek ETA'da savaş→HOLD; kapasite taşması ve kısmi recall için gerçek dönüş; precise dock/kargo teslimatı; native kayıp/respawn ve stale event koruması. Yalnız HOLD katılımcılarına kompozisyonsuz kalkış uyarısı gönderilir.
- Üyelik: ayrılma/kick/disband kendi filolarını gerçek yük/hasarla döndürür; katılım/kuruluş solo kontrolü klana geçirir. Idle leader reclaim dağıtımı, aktif halef korunumu ve wipe cleanup testleri geçti. Koloni controller değişimi/secession terminal root dâhil kişisel anchor'ı güvenli capital'e taşır; recall yarışı korunumla sonuçlanır. Silent Space manuel/worker dağıtımında configured operatör bilgisi gecikmiş monument savaşına kadar taşınır; ilgili transfer/manual/worker/safety regresyonlarıyla **52 PASS**.
- E kapanış: geç varışlar gerçek ETA'da, HOLD geliri ve uçuş HP dozu gerçek native/forced cutoff'a kadar çözülür. Canlı lotlar yeni rota/fuel yaratılmadan güvenli eve precise dock ile aktarılır; native event'ler kapanır, tekrar teslim edilmez. Sezon audit ve kişisel PvP istatistiği gerçek monument katılımını içerir.
- Hedefli doğrulamalar: ilk native D entegrasyonları **90 PASS**; üyelik/sistem cleanup ve mevcut reclaim/support **46 PASS**; köken kaybı ve mevcut colony/support **40 PASS**; kapanış/support **20 PASS**; ayrıca mevcut season archive/lifecycle **31 PASS**. Kesirli dock, döteryum teslimatı, shield/fuel ve transfer politikası ilgili regresyonları ayrı çalıştırıldı. Full suite kullanıcının talimatından sonra yeniden çalıştırılmadı.
- F model ve harita entegrasyonu: beş runtime model **4.880–5.000 üçgen**, **651–1.318 KB**, ortalama **1.032 KB** (yaklaşık 1 MB). Tek map'ler 2.048 px, üç map'ler 1.280 px WebP; meshopt ve kaynak 16× texture transform korunur. Yeni atlaslara renk/metallic-roughness/normal aktarımı eski UV seam uzamasını giderdi. Master SHA256'ları değişmedi. Güncel normalize edilmiş görünür yapı **ticaret gemisinin 3 katıdır**; `Hull` ile filolardaki tek hafif neon silhouette rim'i kullanılır. `MonumentModel` ve `Monuments` gerçek galaxy koordinatlarına bağlandı; finder/readout bütün public anıtları listeler. Model/bütçe ve ilgili gemi regresyonları hedefli çalıştırıldı; atlas örnekleme/normal dönüşümü **8 PASS**. Gerçek browser çıktılarında 350 px mobil/masaüstü, beş kaynak/beş optimize model toplam **20 PASS**; görüntüler ayrıca görsel incelendi (`out/monument-models-rebaked/`). Önceki “henüz entegrasyon değildir” cümlesi tarihsel snapshot olarak geçersizdir.
- Bu bölümün “Sıradaki iş” listesi yazıldığı andaki ara durumdur. Güncel kodda diğer uçuşların HP/kayıp onayı, ortak savaş/probe adaptörleri, API/fog/rapor/harita/send/recall/filo yüzeyleri ve sezon kapanışı uygulanmış; hedefli testlerle doğrulanmıştır. Global kuralların varsayılanı hâlâ sürüm 15'tir, fakat açık ruleset 16 sezonu ve yerel test sezonu mevcuttur. Genel doğrulama kapısı tüm iş bittikten sonra bir kez çalıştırılacaktır.

### A diliminin ilk doğrulama kaydı

### Uygulanan kapsam

- `packages/rules/src/radiationHp.ts`: ayrı `HpRadiationSource`, kesir taşıyan `HpDamageLot`, `segmentsExposureHp`, `applyHpDose`, `hpLethalAtMs` ve `firstHpLossAtMs`.
- `radiation.ts`: yüzde ve HP modellerinin birlikte kullandığı zaman/geometri profili; mevcut yüzde dozu ve `applyDose` kendi API'leriyle çalışmaya devam ediyor.
- HP hesabı gerçek `HULLS` ve verilen araştırma snapshot'ını okur; hasarlı/sağlıklı gemiler ayrı lotlarda kalır. Küçük dozun kesri kaybolmaz; Prospector muaf, yük gemileri ve Collector hasara tabidir.
- Ölüm eşiği ilk gemi kaybını hesaplar. Code review'da bulunan, kesri ölüm sınırına çok yakın geminin sıfır doz anında ölü gösterilmesi hatası ayrıca FAIL testle doğrulanıp düzeltildi.
- A diliminin bu ilk kaydında DB, görev servisleri, savaş, üretim/kargo, UI veya sezon açılışı henüz eklenmemişti. Aşağıdaki ilk tam verify sonucu bu aşamaya aittir; güncel A–D kapsamı yukarıdadır. Denge varsayılanı tanımlanmadı; `MULTI_WORLD.rulesetVersion` 15 olarak kaldı.

### TDD ve proje kontrolleri

Yeni API'ler yokken 25 test FAIL oldu. Uygulamadan sonra incelemede eklenen ölüm anı regresyonu da önce FAIL, düzeltmeden sonra PASS oldu. Son hedefli çalışma: 26 yeni HP testi + 26 mevcut radiation testi + 35 mevcut gemi hasarı/iniş testi = **87 PASS**. Dört property testi sabit seed ile sık settlement, rota/cohort bölme ve tahmin–settlement tutarlılığını kontrol ediyor.

Tüm workspace tip kontrolü ve lint geçti. `pnpm verify` tüm paketleri çalıştırdı ve sunucu testlerinde exit 1 ile bitti:

| Paket | Sonuç |
| --- | --- |
| rules | 100 dosya, 1.876 PASS |
| web | 356 dosya PASS, 1 dosya SKIP; 4.918 PASS, 29 SKIP |
| sim | 17 dosya PASS; 175 PASS, 11 SKIP |
| server | 158 dosya PASS, 15 dosya FAIL; 2.569 PASS, 52 FAIL, 1 SKIP |

İlgili sunucu regresyonları yeşil: radiation flights (16), service (10), API (4), CLI (4), hasar saklama (9), raid damage (3), clan-war damage (6) ve landing damage (5). Bu kayıt yeni HP modelinin sunucuya entegre edildiği anlamına gelmez; mevcut modelin kontrolüdür.

### Genel kapıyı kıran mevcut testler

Karşılaştırma, değişmemiş `HEAD` **`a2f99e8`** kaynaklarından ayrı bir geçici kopya ve ayrı `_test` veritabanı ile yapıldı; mevcut çalışma ağacı ve onun test veritabanı karşılaştırma sırasında değiştirilmedi. Aşağıdaki 42 başarısızlık aynı başlık ve sonuçlarla `HEAD` üzerinde de doğrulandı. Ekonomi auditindeki kalan 10 uzun ölçüm yeniden çalıştırılmadı; bu senaryolar radiation kaynağı oluşturmuyor ve yeni HP API'lerini çağırmıyor.

| Sunucu dosyası | verify FAIL | HEAD'de aynı FAIL |
| --- | --- | --- |
| snowball-audit.test.ts | 13 | 3 |
| sensor-horizon.test.ts | 13 | 13 |
| notifications.test.ts | 2 | 2 |
| onboarding.test.ts | 2 | 2 |
| garbage-collector.test.ts | 1 | 1 |
| concurrency.test.ts | 1 | 1 |
| fault-attack.test.ts | 1 | 1 |
| neutral-colony-d209.test.ts | 1 | 1 |
| world-memory.test.ts | 2 | 2 |
| pirate-field.test.ts | 1 | 1 |
| polar-sales.test.ts | 6 | 6 |
| fleet-escape.test.ts | 1 | 1 |
| fleet-ceiling.test.ts | 6 | 6 |
| construction-speed.test.ts | 1 | 1 |
| thousand-seats-migration.test.ts | 1 | 1 |
| **Toplam** | **52** | **42** |

Başlıca nedenler eski sensör yarıçapı/migrasyon beklentileri, değişmiş fiyat/kapasite/ilerleme beklentileri, kapalı skin mağazası ve ekonomi benchmark'ının süre/arama sınırlarıdır. Testler PASS elde etmek için değiştirilmedi; mevcut oyun dengesi veya ürün kuralları bu iş kapsamında değiştirilmedi. Bu yüzden **genel doğrulama geçti denemez**. Yeni sezon açılışı, bu kapı yeşil olmadan ve B–G tamamlanmadan yapılmaz.

## 13. 2026-10-04 kapanış karşılaştırması

Bu ek, planın önceki ara durumlarını silmeden güncel kodu planla karşılaştırır. Bölüm 1–3'teki public konum/kimlik ve kontrol kuralları, bölüm 4–6'daki HP/üretim/savaş kararları, bölüm 7–10'daki sezon/operasyon kararları ve bölüm 11–12'deki uygulama gereksinimleri kodda karşılanmıştır. Onaylanan sayılar `packages/rules/src/monument.ts` içindeki tek kaynaktan kullanılır; üretim 10 D/dk, gemi başına 4 HP/dk, 5 anıt, 6.000 uzaklık, 1.000 bulut yarıçapı, 10 Leviathan ve 7.270 bulk kapasite değerleri dağınık sabitlere kopyalanmaz.

Visibility sonucu: ruleset 16 public galaxy projection'ı konum, ordinal/model, kontrol, kapasite/üretim ve tarihli HP cloud bilgisini bütün authenticated oyunculara verir. Düşman filo/lot/teknoloji/kargo verilmez. `Monuments` gerçek galaksi koordinatında beş GLB'yi çizer; üst sağ finder beşini de listeler ve kamerayı odaklar. Geliştirme ortamında `MONUMENT-LOCAL` normal server listesinde açık test kapısı olarak görünür. Beş optimize GLB public asset olarak HTTP 200 döner, yaklaşık 1,03 MB ortalamaya ve yaklaşık 5.000 üçgen bütçesine uyar; görünür ölçü ticaret gemisinin 3 katıdır ve gemilerdeki hafif neon rim'i kullanır. Ruleset 14 EU-1/EU-2 sezonlarının boş kalması bilinçli geriye dönük uyumluluktur; feature'ı görmek için ruleset 16 sezonuna bağlanmak gerekir.

Kod review bulgularının güncel kararı `docs/monument-review-2026-10-04.md` ekinde M-01–M-23 tablosuyla tutulur. M-09, M-13 ve M-21 ürün/kapsam tercihi; M-22 deploy notudur. Diğer uygulanabilir bulgular düzeltildi. `M-23` için ruleset 15/öncesi sorgu açılmadığını doğrulayan `monument-api.test.ts` **20/20**, stale inbound uyarısını doğrulayan web testi **9/9**, model/map/assets/news hedefli çalışma **31/31** geçti. Workspace/server/web typecheck geçti; migration journal kodla **140/140** eşleşir. 5173 Vite ve 3100 API yerel smoke kontrolleri başarılıdır.

Görsel/manual kapanışta beş optimize modelin 350 px mobil ve masaüstü çıktıları incelendi. Headless Three GPU beklemesi nedeniyle bağımsız browser ekran görüntüsü kapısı çevresel olarak sınırlı kaldı; mevcut 20 çıktı ve gerçek asset HTTP smoke doğrulama olarak kaydedildi. Bu sınırlama modelin public asset veya harita bağlantısının eksik olduğu anlamına gelmez.

Bu bölüm ilk kapanış girişiminin tarihsel kaydıdır. İkinci bağımsız inceleme bazı yolların eksik olduğunu gösterdi; güncel sonuç bölüm 15 ve `monument-code-review.md` içindedir. Kullanıcı talimatı gereği genel test kapısı tüm geliştirme ve manuel incelemeden sonra, ekonomi simülasyonları hariç çalıştırılır. Kapıda bulunan hatalar düzeltilir ve gerekli kontroller tekrarlanır; başarısız bir kapı tamamlandı diye raporlanmaz.

## 14. 2026-10-04 local sürüm ve focus'suz görünürlük düzeltmesi

- Local scratch shard yeniden doğrulandı: `MONUMENT-LOCAL` canlı, `ruleset_version = 16`, 5 monument ve 5 HP cloud mevcut. Reset sırasında eski scratch sezonu arşivlenip yeni sezon `973ec8eb-f7e4-41ab-bb7e-ecb0765811a5` (`seed 16005`) açıldı; EU-1/EU-2'nin eski ruleset sürümleri değiştirilmedi. `tools/dev-up.sh` artık production/test dışı taze veritabanında bu shard'ı açıkça `--ruleset 16 --seed 16005 --cap 60` ile idempotent biçimde oluşturur; böylece yeni bir `pnpm start` sonrası özellik görünmez bir varsayılan 15 sezonuna bağlı kalmaz.
- `t43tgf34g34` hesabı EU-1/ruleset 14'teydi ve anıt görmemesi beklenen davranıştı. Hesapta uçuş/birlik/klan aktivitesi olmadığı doğrulandı; oyuncu ve başkent kaydı korunarak yeni `MONUMENT-LOCAL` sezonundaki boş başkent slotuna taşındı. Mevcut tarayıcı token'ı placement değişimini görebileceği için çıkış-giriş veya tam yenileme gerekir.
- Focus olmadan gezegen etrafında zoom-out incelemesinde anıt koordinatları doğru ve frustum içindeydi; uzak kamera mesafesinde sahne sisi (`near 55`, `far 210`) model gövdesini söndürüyordu. Monument `Hull` gövdesi ve rim'i public landmark için sis dışı çizilecek şekilde ayrıldı; model ölçeği ve gemi başına geometri bütçesi değişmedi. `MONUMENT_FOG = false` sözleşmesi ve gerçek browser ekran görüntüsüyle doğrulandı.
- Eski/cache'lenmiş monument battle report payload'ında `opponents` alanı bulunmadığında UI çökmesi de düzeltildi; current schema default'u korunurken ekran boundary'de boş liste fallback'i kullanır.
- Bu turdaki hedefli web çalışması model/map/news için **27/27 PASS**, web typecheck ve ilgili ESLint temizdir. Local HTTP kontrolleri: API health 200, login/me 200, ruleset 16 galaxy payload 5 monument + 5 HP cloud.

## 15. İkinci review sonrası güncel karşılaştırma

- N-01/02/03/05/06/07/08/09/10/12/14/15/16/18'in uygulanabilir kısımları düzeltildi; N-11 eski test sözleşmesiydi. N-17 final lint ile ölçülür. Madde bazında davranış, test ve kalan bilinçli tercihler `monument-code-review.md` son bölümündedir.
- M-08, M-14 ve M-19 için önceki genel kapanış ifadesi eksikti; sürüm reddi, hostile quote redaction ve Türkçe hacim ayrı testlerle tamamlandı.
- Yeni sezon varsayılanı artık 16'dır. Yeni sezon seed'i ve otomatik devam sezonu beş hedef/bulut oluşturur; mevcut 14–15 sezonlarına backfill yapılmaz.
- N-13 kullanıcı talimatıyla kapsam dışıdır. Data-only simülatör bağlantısı çalışır monument simülasyonu diye sunulmaz; `packages/sim` ve snowball audit çalıştırılmaz.
- M-09 bash sınırı yok; M-13 ayrı monument olgunluk şartı yok; M-21 radiation ölümüne ayrı PvP/puan olayı yok: onaylı ürün tercihleri korunur. Saldırı HOLD tahmini verilmez; gerçek savaş sonrası sağlık bilinmez. Uygulanmış migration adları değiştirilmez.
- 1280×900 EN ve 350×812 EN/TR finder/sheet ile 350×812 TR boş hedef gerçek browser'da doğrulandı. İsimler kesilmiyor, yatay taşma yok, send footer erişilebilir; boş etiket ve garnizon dönüşü görünür. Kanıt: `out/monument-review-final`, dört akış PASS. Boş hedef kontrolü yalnız browser fixture'ı kullanır.
- Migration journal ve local DB 141/141; `/health` 200; local live/ruleset 16 sezon 5 monument/5 HP cloud. Production deployment yapılmadı. Kritik oyun yollarında açık monument bug bulunmadı; 0130 DDL lock/rewrite etkisi ve worker/enum geçişi deploy sırasında yönetilmelidir (`deployment.md` monument bölümü).
- Bütün kod/inceleme ve manuel kontrollerden sonra son kapı `pnpm verify --exclude-sims` çalıştırılır; güncel sonuç review dosyasına yazılır.
