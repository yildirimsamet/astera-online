# Astera ilk oturumu: öğrenme, erken geri dönüş ve deney kanıtları

Araştırma kesiti: **12 Kasım 2026**. Kod veya oyun dengesi değiştirilmedi. `CLAUDE.md` ve önceki iki yerel rapor okundu; aşağıda kullanılan dış iddialar birincil kaynaklardan tekrar denetlendi. Önceki raporlar bağımsız kanıt sayılmadı. Görevde verilen 23 hesaplık özet, ham olaylar tarafımdan denetlenmeden, açıkça görev girdisi olarak ele alındı.

Kanıt sınıfları: **A:** randomize deney, yalnız çalışmanın oyunları/örneklemi için nedensel; **B:** doğrudan kullanıcı gözlemi, mekanizmayı gösterir fakat retention etkisini kanıtlamaz; **C:** geliştiricinin/resmî platformun tasarım anlatımı, uygulanabilir örnek/tavsiye; **D:** gözlemsel kıyaslama veya önce/sonra öz bildirimi; **H:** Astera için sınanacak tasarım veya ölçüm önerisi. Bir sınıftaki bulgu diğerine çevrilmemelidir.

## 1. Ana galaksi 5–10 dakikada mı, 1–2 günde mi açılmalı?

### Takeaway

Evrensel bir ideal tutorial süresini veya kalıcı mobil stratejide bu iki süreyi doğrudan karşılaştıran güvenilir bir deneyi bulamadım. Astera için tercih önerim, **ilk gerçek strateji döngüsünü ilk oturuma almak, ana dünyaya geçişi isteğe ve hazır oluşa bağlamak, öğrenmeyi günlere yaymak**; sırf eğitim için zorunlu 1–2 günlük takvim kapısı koymamak.

### Cited Findings

- **A, CHI 2012, 5–10 Mayıs 2012:** Andersen ve arkadaşları, üç oyunda 45.000'den fazla yeni oyuncuyu sekiz tutorial koşuluna rastgele atadı. Karmaşık ve alışılmadık Foldit'te bağlamsal tutorial, tutorialsız koşula göre oynama süresini %29, bölüm ilerlemesini %75 artırdı; geri dönüş oranında anlamlı etki bulunmadı. İki daha basit oyunda aynı yararlar görülmedi. Bağlamsal anlatımın dışarıda verilen anlatıma göre Foldit'teki farkı %16 süre ve %40 ilerlemeydi. Bu, dakika optimumu veya mobil strateji D1 sonucu değildir. — [The Impact of Tutorials on Games of Varying Complexity](https://grail.cs.washington.edu/projects/game-abtesting/chi2012/chi2012.pdf)
- **C, tarih belirtilmiyor; erişim 12 Kasım 2026:** Roblox, ana döngüye hızlı erişimi ve FTUE'nin tercihen beş dakika veya daha az sürmesini öneriyor. Bu bir platform tasarım rehberi; önerilen dakikanın randomize karşılaştırmasını sunmuyor. Aynı belge performansı ve çökme izlemeyi de D1 geliştirme işi sayıyor. — [Roblox: Retention](https://create.roblox.com/docs/production/analytics/retention)

### Inferences

- **H — Üç ayrı saat tut:** `ilk gerçek karar`, `ana galaksiye geçiş uygunluğu/gerçek geçiş`, `devam eden öğrenme`. Oyuncunun çok sayıda ekran tanıması, ana döngüyü yaşadığı anlamına gelmez. Ana galaksiye geçmesi de bütün sistemleri bildiği anlamına gelmez.
- **H — Tercih:** Koruma ve ilerleme dengesi tasarlandıktan sonra **5–10 dakikalık ana galaksiye geçiş seçeneğini prototiple**. Yavaş oyuncu güvenli başlangıçta kalabilsin. Bu sayı bilimsel optimum değil, mevcut saatler süren geçiş zincirine karşı ürün hipotezidir. İlk anlamlı intel → tercih → sefer → sonuç döngüsü zaten başlangıçta yaşanıyorsa, yalnız harita adı değişsin diye göçü hızlandırmak öncelik değildir.
- **H — İlk prototip hedefleri, ilk oynanabilir andan itibaren:**

| Hedef | Başlangıç hipotezi | Asıl doğrulama |
| --- | --- | --- |
| Oyuncunun dünyayı etkileyen ilk eylemi | ≤30 saniye | Ne yaptığını ve ne değiştiğini söyleyebilmesi |
| Bilgiye bakarak kendi ilk seferini seçmesi | 2–5 dakika | En az iki anlaşılır seçenek; tek parlayan düğmeye basmaktan fazlası |
| İlk kısa seferin sonucunu anlaması | 5–8 dakika | Sonuç ile önceki karar arasında bağ kurması |
| Yardımsız ikinci karar / erken geçiş seçeneği | Yaklaşık 5–10 dakika | Koç söylemeden hamle; koruma/risk bilgisi anlaşılır |
| İlk gönüllü ara | Genellikle 8–15 dakikadan itibaren mümkün | Bekleyen kendi işi, dönüşte göreceği sonuç, anlamlı kalan seçenek |
| İleri kurallar | Sonraki oturumlar ve ihtiyaç anı | Kuralı kullanmadan hemen önce erişilebilir yardım |

- **H — Raporlama:** Bu süreleri yalnız başarılı oyuncuların medyanı olarak sunma. Her zaman tüm yeni oyuncular içinde 5/10/20 dakikada hedefe ulaşan oranı ve henüz ulaşmayan/ölçülemeyen sayıyı göster. Hız hedefi oyuncuyu zaman dolunca dışarı atma veya istemediği savaşa zorlama kuralına dönüşmemeli.

### Gaps

- Astera gibi gizli gezegen, istihbarat, kayıp ve asenkron filo içeren bir oyunda 5–10 dakika ile 1–2 gün ana dünya kilidinin nedensel retention farkı bilinmiyor.
- Erken göç, kaynak aktarımı, risk ve sahiplik değişiklikleri ürün/dengenin parçasıdır; bu araştırma uygulanmış çözüm veya denge doğrulaması değildir.

## 2. Oyuncu nasıl öğrenmeli: gösteri, yapma, seçim ve yardımın geri çekilmesi?

### Takeaway

En savunulabilir başlangıç, tek somut eylemle öğretmek, sonucunu görünür kılmak ve benzer ikinci durumda desteği azaltmaktır. Kilitli bir tıklama dizisinin tamamlanmasıyla, oyuncunun kendi kararını verebilmesini ayrı ölçmek gerekir.

### Cited Findings

- **A, CHI 2012:** Aynı üç oyun deneyinde hareket serbestisini kısıtlamanın öğrenilebilirliği artırdığına kanıt bulunmadı. Bu, her yönlendirmenin kötü veya kilitsiz tasarımın her oyunda üstün olduğunu göstermez. — [Andersen vd.](https://grail.cs.washington.edu/projects/game-abtesting/chi2012/chi2012.pdf)
- **C, GDC, 9 Mart 2012:** George Fan, Plants vs. Zombies geliştirme anlatımında öğretimi oyuna katmayı, okumak yerine eylem yaptırmayı, mekanikleri zamana yaymayı, güvenli denemeyi, kısa ve bağlama uyarlanan mesajları öneriyor. Slaytlar bir geliştirici deneyimidir; örneklemli retention A/B sonucu değildir. — [How I Got My Mom to Play Through Plants vs. Zombies](https://media.gdcvault.com/gdc2012/slides/Design%20Track/Fan_George_How%20I%20Got.pdf)
- **C, yayın tarihi yok; erişim 12 Kasım 2026:** Apple, kısa ve açık adımları, yeni hedefe geçmeden yeterlik göstermeyi, erken bağımsız oyunu, isteğe bağlı atlamayı, sonradan tekrar açılabilen yardımı ve o an gerekmeyen izin/özellik tanıtımlarını ertelemeyi öneriyor. — [Apple: Onboarding for Games](https://developer.apple.com/app-store/onboarding-for-games/)
- **A, 29 Ağustos 2024; dış geçerliliği sınırlı:** 62 tıp öğrencili randomize, eşleştirilmiş eğitim oyunu çalışmasında uyarlanan ve uyarlanmayan destek grupları arasında test başarısı veya katılım farkı bulunmadı; kontrol desteği senaryoların %64,9'unda tesadüfen ihtiyaca uydu. Keşifsel alt analizleri randomize ana sonuç yerine koymamak gerekir. Ticari mobil oyun retention deneyi değildir. — [Faber vd., Effects of adaptive scaffolding…](https://pmc.ncbi.nlm.nih.gov/articles/PMC11360721/)

### Inferences

- **H — Astera örneği:** Oyuncu ilk sonda raporunda “ne var, ne bilinmiyor?” bilgisini görsün; kısa bir yönlendirmeyle ilk seferini seçsin. İkinci fırsatta aynı raporu ve gönderim aracını kendi bulsun. Başarıyı doğru düğme sırasından değil, seçimin gerekçesinden gözle.
- **H — Seçim gerçek ve küçük olsun:** Yakın/düşük ödül ile uzak/yüksek ödül gibi mevcut kurallardaki iki fırsatı süre, bedel ve bilinen belirsizlik üzerinden karşılaştırabilsin. Her olası karşı mekaniği ilk dakikada öğretme; sonucu belirleyen gerekli kuralı eylemden önce erişilebilir tut.
- **H — Yardım durum izlesin:** Oyuncu gereken işi zaten yaptıysa yeniden yaptırma; ekran değişince yanlış yerde ok bırakma; ara verince kısa durum özeti ver. “Yardımı azalt / tekrar göster” davranışı ekonomik ilerleme kapısından ayrı olsun.
- **H — Yeterliği gözle, sınav kapısı icat etme:** “Bu seferden ne bekliyorsun?”, “Neden bunu seçtin?”, “Şimdi yardım olmadan ne yaparsın?” cevapları araştırma oturumunda değerlendirilsin. Oyuncuya başarı için quiz çözme zorunluluğu eklenmesin.

### Gaps

- Uyarlanan yardımın ek mühendislik maliyetinin Astera retention'ına geri döneceğini gösteren ölçüm yok. Önce basit bağlamsal yardımın gerçek takılmaları çözmesi gerekir.

## 3. Otomatik başlangıç malzemesi mi, hasarlı koloni gemisi hikâyesi mi?

### Takeaway

Bu bir zorunlu ikilik değil: kısa bir kurtarma/sahiplenme anı korunurken, oyuncuya kendi ilk anlamlı kararlarını vermeye yetecek araçlar verilebilir. Malzemeyi otomatik sağlamak ile oyuncunun yerine seçmek, göndermek ve kazanmak farklı tasarım kararlarıdır.

### Cited Findings

- **C, yayın tarihi yok; erişim 12 Kasım 2026:** Roblox, başlangıç ekipmanı/parasının oyuncuya sistemlerin yararını erken yaşatabildiğini, miktarın dengelenmesi ve deneyle sınanması gerektiğini söylüyor. İlk döngünün hem nasıl hem neden yapıldığının anlaşılmasını da onboarding hedefi sayıyor. Açıklanmış evrensel miktar veya etki büyüklüğü yok. — [Roblox: Onboarding](https://create.roblox.com/docs/production/game-design/onboarding)
- **C, CCP Rise, 19 Şubat 2015:** EVE'nin Opportunities tasarımında doğrusal zorunlu sıra yerine açık hedefler, farklı yollarla tamamlanabilen işler ve deney yapma alanı amaçlanıyordu. Görev ödülü uğruna istenmeyen tutorial yaptırmamak için öğretim ile ödül ayrılmak istendi; CCP, başlangıç varlığı/gelirinin zorluğunu ayrıca test etmek gerektiğini açıkça yazdı. Bu, o tarihteki tasarım niyetidir; başarılı sonuç kanıtı değildir. — [Opportunities Abound – The New Player Experience](https://www.eveonline.com/news/view/opportunities-abound-the-new-player-experience)

### Inferences

- **H — Önerilen hibrit:** Bir kısa güç verme/onarım anı → “bu gemi benim” duygusu → çalışır keşif ve ilk sefer araçları. Başlangıç paketi en az iki anlamlı sefer seçimini ve tek makul hatadan toparlanmayı karşılayacak kapsamda hesaplanmalı. Kesin miktar mevcut ekonomi/risk audit'i gerektirir.
- **H — Hikâye yön versin:** Hasarın giderilmesi görsel, işitsel ve durum değişikliğiyle hissedilsin; ana döngüye ulaşmak için sekiz benzer kaynak/onarım kapısı beklenmesin. Oyuncunun temel davranışı “daha çok tamir etmek” değil “dışarıda gördüğüm fırsata müdahale etmek” olmalı.
- **H — Atlamada ekonomik ceza olmasın:** Yardımı kapatan ve yardımla ilerleyen hesapların aynı başlangıç hakları olsun. Yardımı izleyene fazladan malzeme vermek, yardımın isteğe bağlılığını zayıflatabilir. Her girişte tekrarlanan grant yerine hesap başına tanımlı, denetlenebilir başlangıç hakkı tasarlanmalı.
- **H — Catch-up kapsamı:** Mevcut oyuncuların yarım bırakılmış başlangıç durumları için destek, yeni hesap paketinden ayrı analiz edilmeli. “Kaynakları her durumda doldur” yaklaşımı yerine hangi eksik aracın oyuncuyu gerçek eylemden alıkoyduğu incelensin. Bu, sunucu ekonomisi için uygulanmış bir öneri değildir.

### Gaps

- Otomatik starter hibesi ile hasarlı gemi anlatısını aynı kalıcı mobil stratejide karşılaştıran bağımsız/randomize retention deneyi bulunamadı.
- Hikâyenin daha fazla sahiplik hissi yaratacağı ve önerilen hibritin daha çok geri dönüş getireceği Astera hipotezidir.

## 4. İlk gönüllü ara ve dönme nedeni nasıl kurulmalı?

### Takeaway

Oyuncunun dönüş nedeni, kendi verdiği kararın bekleyen sonucu ve o sonucun açacağı yeni soru olabilir. İlk oturumda pasif beklemeyi uzatmak ile oyuncuya çevrimdışı devam eden bir iş bırakmak aynı şey değildir.

### Cited Findings

- **B, CHI PLAY, 15–18 Ekim 2017:** Üç mobil F2P oyunun onboarding'ini oynayan 28 katılımcının 19'u WinterForts savaşında oyunun eylemleri otomatik yürüttüğü birkaç dakikalık zorunlu beklemeyi rahatsız edici buldu. Çalışma görüşme, gözlem ve fizyolojik ölçüm içeriyor; uzun dönem geri dönüş veya farklı bekleme süreleri arasında randomize etki ölçmüyor. — [Petersen vd., Evaluating the Onboarding Phase…](https://findresearcher.sdu.dk/ws/files/195676326/p377_petersen.pdf)
- **C, tarih yok; erişim 12 Kasım 2026:** Roblox, kısa/orta/uzun hedeflerin görünmesini ve ilk bölümün başarı hissi veren bir anla kapanmasını öneriyor. Bunlar gelecekteki oturum için beklenti oluşturan tasarım tavsiyeleri; belirli geri dönüş artışı verilmemiş. — [Roblox: Onboarding](https://create.roblox.com/docs/production/game-design/onboarding)

### Inferences

- **H — İlk döngü kısa olsun:** Oyuncu ilk seferin sonucunu ilk oturumda en az bir kez görsün. Daha sonraki kendi seçtiği sefer daha uzun sürüp gönüllü araya uygun olabilir. “Bu sefer 12 dakikada dönecek; sen yokken de devam eder” bilgisi o anda görünür olsun; sayı mevcut oyun kuralından gelsin.
- **H — Ara kapı değil seçenek:** İlk 8–15 dakikada güvenle bırakılabilir bir durum hedefle. Oyuncuyu durdurma; kalmak isterse keşif veya başka karar bulabilsin. Geri gelmeyi takvim ödülünün üstüne değil, kendi filosunun durumuna bağlamayı önce dene.
- **H — Dönüş anı:** Aradan sonra önce sonuç → neden → değişen fırsat → bir sonraki karar. Uzun ödül/rozet dizisi veya rehberi baştan oynatma, bu bağı örtebilir.
- **H — Ölçüm ayrımı:** İlk oturumun daha uzun olması, daha çok insanın döndüğünü kanıtlamaz. Aktif süre, ilk gönüllü ara, R30 ve D1 ayrı raporlansın; arka planda açık sekme aktif oyun veya geri dönüş sayılmasın.

### Gaps

- “İlk ara kesin şu dakikada olmalı”, “ilk sefer en az 30 dakika sürmeli” veya “iki günlük bekleme alışkanlık kurar” iddialarını destekleyen Astera'ya taşınabilir nedensel kanıt bulunamadı.

## 5. Erken güvenlik ve sosyallik birlikte olabilir mi?

### Takeaway

Güvenli öğrenme, oyuncuyu çok oyunculu dünyadan uzun süre ayırmayı gerektirmiyor. Somut yakın örnek EVE'nin 2026 Exordium tasarımı: güvenlik, yeni oyuncuların bir araya gelmesi ve serbest çıkış birlikte kullanılıyor; yayınlanmış retention kazanımı yok.

### Cited Findings

- **C, CCP, 14 Nisan 2026:** Exordium duyurusu, dağınık başlangıçların arkadaşların buluşmasını zorlaştırmasını ve henüz temelleri öğrenmeden PvP kaygısı yaşamayı ayrı sorunlar olarak tanımlıyor. Yeni oyuncu, mentor ve işe alım etkileşimlerini aynı bölgede kolaylaştırmak amaçlanıyor. — [Introducing Exordium](https://www.eveonline.com/news/view/introducing-exordium)
- **C, destek belgesi güncellemesi 5 Haziran 2026:** Exordium'da PvP oyun kurallarıyla engelleniyor; kıdemli oyuncular mentorluk/işe alım için gelebiliyor; oyuncular karakter yaşından bağımsız serbestçe çıkıp yeniden girebiliyor. Daha düşük getiriler güvenli bölgenin sürekli en iyi çiftlik olmasını engellemeyi amaçlıyor. — [Exordium – Starter Space](https://support.eveonline.com/hc/en-us/articles/27939780240924-Exordium-Starter-Space)
- **C, yama notu 5 Haziran 2026; ilan edilen çıkış 9 Haziran 2026:** Cradle of War notları Exordium içeriğini ve geniş dünyaya kapı üzerinden çıkmayı belgeliyor. “Güvenli başlangıç var” ile “iki gün çıkamazsın” aynı tasarım değil. — [Cradle of War: Expansion Notes](https://www.eveonline.com/news/view/cradle-of-war-expansion-notes)
- **C, 4 Ekim 2023:** Hades' Star geliştiricisi Dark Nebula açıklamasında erken gönderi işlerini isteğe bağlı kılmayı, düşük seviyede de anlamlı modül tercihlerini, savaş gemileri normal çatışmada yok olmadığı için daha rahat denemeyi ve birlikte oynamayı destekleyen araçları anlatıyor. Açıklama denge/geliştirici gerekçesidir; kontrol grubuna karşı retention sonucu değildir. — [Dark Nebula upgrade guide](https://blog.hadesstar.com/2023/10/dark-nebula-upgrade-guide.html)

### Inferences

- **H — Astera'ya taşınabilir ilke:** Ana galaksiyi, başkalarının varlığını ve oyuncunun uzun vadeli yerini erken hissettir; risk bilgisini ve korunmanın kapsamını anlaşılır kıl. Başkalarının dünyada görünmesi veya onlarla tanışmak, ilk dakikada zorunlu saldırı yaptırmak zorunda değil.
- **H — Erken girişin koşulu:** Korunan başkent, güvenli başlangıç varlığı, filo riski, korumanın kalkma koşulu ve kayıptan toparlanma birlikte tasarlansın. Oyuncu “ana dünyaya geç” çağrısının hangi güvenliği değiştirdiğini eylemden önce anlayabilsin.
- **H — Sosyal ölçüm:** “Sohbet ekranı açtı” yerine gerçek cevap aldı mı, biriyle karşılıklı etkileşti mi, yardım aldı mı, kendi yaptığı bir iş başkasında karşılık buldu mu izle. Bunlarla retention arasındaki ilişkiyi nedensel sanma; zaten ilgili oyuncuların sosyal özelliği daha çok kullanması mümkündür.
- **H — Denge sınırı:** Rakiplerin sürelerini veya güvenlik vergilerini doğrudan kopyalama. EVE ve Hades' Star, farklı oynama ve ekonomi yapılarında tasarım örnekleri sunuyor.

### Gaps

- Exordium veya bu Hades' Star değişiklikleri için doğrulanmış D1/D7 A/B artışı bulunamadı.
- EVE'de erken kayıp yaşayanların daha çok kalması hakkındaki eski iddialar burada kanıt olarak kullanılmadı: erişilebilen anlatımlarda seçilim, maruziyet ve sağkalım yanlılığı ayrılmadan “erken PvP kaybı retention artırır” denemez.

## 6. R30, D1, anlamlı aktivasyon ve ana galaksi zamanı nasıl ölçülmeli?

### Takeaway

Oyuna bağlı kalma ile bağlantının açık kalması ayrılmalı. Astera'nın ana geri dönüş sayacı, oyuncunun aradan sonra yaptığı doğrulanmış elle eyleme dayanmalı; standart analitik D1 ile özel eylemli D1 ayrıca isimlendirilmeli.

### Cited Findings

- **C, yayın tarihi yok; erişim 12 Kasım 2026:** Roblox funnel rehberi, davranış/başarı adımlarını tutarlı olaylarla izlemeyi, giriş kohortunu korumayı ve cihaz filtrelerini ilk adım temelinde uygulamayı belgeliyor. Platformun bazı sıralı funnel'ları sonraki adım gelince öncekileri otomatik tamamlar; bu davranış “önceki işi gerçekten yaptı” ile karıştırılmamalı. — [Roblox: Funnel events](https://create.roblox.com/docs/production/analytics/funnel-events)
- **C, tarih yok; erişim 12 Kasım 2026:** GameAnalytics günlük metrikleri UTC takvim günleriyle hesaplıyor; strict Day N, belirli o güne geri gelişi sayıyor. Bu, ilk açılıştan tam 24–48 saatlik eylem penceresiyle aynı tanım değil. — [GameAnalytics: Metrics](https://docs.gameanalytics.com/events-metrics-and-filtering/metrics/)
- **C, tarih yok; erişim 12 Kasım 2026:** GameAnalytics özel başlangıç ve dönüş tetikleyicileriyle, bir eylem sonrası başka eyleme dönüşün de ölçülebileceğini belgeliyor. Araç tanımı, seçilen eylemin oyun açısından anlamlılığını kendi başına doğrulamaz. — [GameAnalytics: Retention](https://docs.gameanalytics.com/products-and-features/analytics-iq/engagement-tools/retention/)

### Inferences

**H — Analitik sözlüğü; uygulanmadan önce isimleri sabitle:**

| Ölçüt | Önerilen operasyonel tanım | Tuzak / gerekli ayırma |
| --- | --- | --- |
| Giriş | İlk oynanabilir oturum; hesap kaydı ve ilk yükleme ayrıca | Yüklemeden çöken kişiyi oynanabilir başlangıç paydasında gizleme; üst hunide tut |
| Elle eylem | Oyuncu girdisiyle oluşan, sunucunun kabul ettiği anlamlı oyun komutu; benzersiz `action_id` | Otomatik kaynak, sayaç, polling, filo varışı, arka plan tic'i ve yalnız socket bağlantısı sayılmaz |
| R30 | Önceki etkin oturumdan sonra ≥30 dakika gerçek ara, ardından yeni oturumda en az bir elle eylem | Sadece ilk eylemden 30 dakika geçti diye hâlâ oynayan kişiye “döndü” denmez |
| R30 gözlem penceresi | Ön kayıtlı ilk 48 saat içinde R30 olayı; ayrıca 24 saatlik kesit | Belirsiz süreli “bir gün mutlaka döndü” ile kohortlar karşılaştırılmaz |
| D1 eylemli | `t0+24h ≤ action_time < t0+48h` penceresinde elle eylem | `D1_24_48_action` diye adlandır; takvim D1 ile karıştırma |
| D1 açılış | Aynı pencerede foreground/oturum açılışı | Eylemli D1'den ayrı; gelen fakat karar veremeyenler görülür |
| Anlamlı aktivasyon | İlk bilgi inceleme → oyuncunun hedef/filo seçimi → kabul edilmiş sefer → sonuç inceleme → yardımsız ikinci karar | Sıra gösterge; oyuncu farklı geçerli yol izleyebilir. Gerekçe/anlama yalnız olaydan çıkarılamaz; gözlemle doğrula |
| Ana galaksiye erişim | `main_eligible` ve `main_entered` ayrı | “Hak kazandı”, “geçişi seçti” ve teknik geçiş hatası farklı olaylar |
| Zaman | Her kilometre taşı için duvar saati ve aktif foreground süresi ayrı | Saatler açık kalan sekme süreyi şişirmesin; medyan yalnız ulaşanları özetliyorsa açık yaz |
| Sabit süreli oranlar | Tüm uygun yeni oyuncular içinde 5/10/20dk, 24/48h erişim/aktivasyon | Sadece tutorial bitirenlerden retention hesaplamak erken ayrılanları görünmez kılar |

- **H — R30 veri şartı:** Foreground/background ve oturum yaşam döngüsü yoksa “≥30 dakika komutsuz aradan sonra yeni komut” yalnız bir vekildir. Algorist örneğindeki eksik client olaylarında gerçek ara kanıtlanamıyorsa `ara_bilinmiyor` etiketiyle raporlanmalı; kesin geri dönüş sınıfına sessizce sokulmamalı.
- **H — Olgunlaşma:** D1 paydasına ancak hesabın 48 saatlik penceresi kapandıktan sonra girsin. R30 için pencere kapanmayan hesaplar `bekliyor` olsun. Yeni hesabı henüz dönmedi diye başarısız sayma.
- **H — Sansür:** Ana galaksiye ulaşmamış hesabı medyandan çıkarıp yalnız göçenleri raporlama. Ölçüm kesiminde hesap yaşı kadar izlenmiştir; daha sonra ulaşabilir. İlk 24/48 saatte ulaşma oranını yalnız o kadar yaşlanmış kohortta ver. Eksik telemetri nedeniyle son görülen olayı otomatik “oyunu bıraktı” kabul etme. Sağkalım modeli kullanılırsa sansür varsayımı ayrıca denetlenmeli; 23 hesap için önce açık sayımlar yeterlidir.
- **H — Zorunlu boyutlar:** İlk giriş build'i ve onboarding sürümü, Android/web/desktop, cihaz/OS, edinim kaynağı ve kampanya, dil/ülke, gerçek yeni/yeniden dönen hesap, staff/test, bilinen crash/yeniden yükleme, sunucu/galaksi, deney ataması. Hesap kimliğiyle cihazlar birleştirilsin; tekrar denenen istekler tek eylem sayılsın.
- **H — Çökme raporu:** Tüm yeni oyuncuların sonucu ana ölçütte kalsın. Yanına crash yaşamayanlar için tanısal kesit koy; crash'li oyuncuları çıkararak genel deneyim olduğundan iyi gösterme. Aynı şekilde farklı kaynak/platform/build karışımlarını tek küçük yüzdeyle karşılaştırma.

### Gaps

- Görev girdisindeki 2/23 sayısının bu kesin R30 tanımıyla yeniden üretilebilirliği burada doğrulanmadı. Ham server komutları ve client yaşam döngüsü uzlaştırılmalıdır.
- R30, D1, ana galaksiye giriş ve aktivasyon farklı sorulardır. Biri diğerinin yerine konamaz.

## 7. Mevcut 23 hesap ne söylüyor, neyi kanıtlamıyor?

### Takeaway

Mevcut özet, ciddi inceleme ve yeni oyuncu gözlemi başlatmak için yeterli bir uyarı; hangi mekanik kaç kişiyi kaçırdı sorusuna cevap veren deney değil. Küçük, rastgele seçilmemiş ve kısmen eksik gözlenen kohorttan hassas retention veya kesin neden çıkarılamaz.

### Cited Findings

- **İç kaynak / görev girdisi; bağımsız doğrulama yapılmadı:** 23 hesap; onarım 20, madencilik 14, sonda 10, tersane 9, üretim 6, savaş 5, zafer 4, ana göç 0. ≥30 dakika aradan sonra eylemli geri dönüş 2; bir oyuncu hâlâ etkin. Üç hesapta crash var. Algorist'in client analitiği bittikten çok sonra elle oynamış olması telemetri boşluğuna işaret ediyor. Bu satır dış benchmark veya yeni ölçüm değildir.
- **İstatistik yöntemi; son güncelleme Aralık 2025:** OHID teknik kılavuzu küçük pay/paydalarda standart normal/Wald aralığının zayıflığını açıklıyor ve Wilson aralığını öneriyor; sıfır olayda da hesaplanabiliyor. — [Public Health Technical Guidance: Proportions and odds](https://fingertips.phe.org.uk/static-reports/public-health-technical-guidance/Basic_statistics/Proportions.html)

### Inferences

- **Hesap, verilen sayılar doğruysa:** `2/23 = %8,7`; Wilson %95 aralığı yaklaşık **%2,4–26,8**. Bu yalnız bağımsız Bernoulli örneklem modeli altındaki aralıktır; edinim seçilimini, farklı build'leri, arkadaş/owner etkisini veya eksik olayları düzeltmez. Görev girdisi rastgele örneklem olmadığı için “evrenin gerçek oranı bu aralıkta” güvencesi verilmemeli.
- **Hesap:** `0/23` için aynı yöntemle üst sınır yaklaşık **%14,3**. Sıfır gözlenen göç, gerçek uzun dönem göç olasılığının sıfır olduğunu kanıtlamaz; özellikle hesapların yaşı ve geçiş önkoşulları bilinmeden.
- **H — Huni yorumu:** “14 madencilik, 10 sonda” farkını “madencilik adımında dört kişi churn etti” diye yazma. Bunlar farklı yollar, farklı yaşlar, henüz tamamlanmamış işler veya eksik olaylar olabilir. Gerçek adım giriş/çıkış olayları, gereken önkoşullar ve aktif süre incelenmeli.
- **H — Öncelik sırası:** (1) Elle komut ile client analitiğini uzlaştır, (2) crash'lerin aynı sürüm/cihaz/eylemde kümelenip kümelenmediğine bak, (3) ilk kararın ve bir sonraki hedefin anlaşılırlığını gözle, (4) süre/ödül hipotezini test et. Bu sıra, hikâyeyi kaldırmanın retention'ı artıracağını varsaymaktan daha az belirsizdir.

### Gaps

- Hesapların tamamı için edinim kaynağı, build, ilk oynanabilir an, hesap yaşı, yardım alma durumu, gerçek ara ve crash sonrası davranış bilinmeden adımlar arası kaybın nedeni belirlenemez.

## 8. Düşük trafikte geçerli ama uygulanabilir deney planı nedir?

### Takeaway

23 hesapla küçük retention farklarına A/B hükmü vermek gerçekçi değil. Önce veri ve anlama sorunlarını küçük gözlem döngüleriyle çözmek, ardından sabit sürümde önceden tanımlı eşiklerle pilot yapmak; trafik yeterli olduğunda tek değişkenli randomize karşılaştırmaya geçmek uygundur.

### Cited Findings

- **Yöntem, KDD, 11–14 Ağustos 2013:** Microsoft deney platformu yazarları rastgele, kalıcı kullanıcı atamasını, önceden belirlenmiş değerlendirme ölçütünü ve yanlış pozitif/etkileşim sorunlarını anlatıyor. Küçük etkileri görmek için çok daha büyük örneklem gerektiğini vurguluyorlar; örneklem eksikliği bir analiz etiketiyle ortadan kalkmıyor. — [Kohavi vd., Online Controlled Experiments at Large Scale](https://exp-platform.com/Documents/2013%20controlledExperimentsAtScale.pdf)
- **Yöntem, yayın tarihi sayfada yok; erişim 12 Kasım 2026:** Penn State, iki oranın örneklem planlamasında baz oran, hedef fark, alfa ve gücün birlikte belirlenmesi gerektiğini formüllerle gösteriyor. — [STAT 507, Power and Sample Size Considerations](https://online.stat.psu.edu/stat507/Lesson10)

### Inferences

- **Hesap örneği, Astera tahmini değil:** Eşit kollu, iki yönlü %5 alfa, %80 güç, normal yaklaşım ve sabit örneklem varsayımıyla `%10 → %20` için yaklaşık **199 kişi/kol**, `%10 → %15` için yaklaşık **686 kişi/kol** gerekir. Küçük örneklemde seçilecek kesin teste göre sayı değişebilir. Hedef farkın ikiye bölünmesi yaklaşık dört kat örneklem ister. 2/23 oranını kesin baz oran kabul ederek tek hassas n üretmek uygun değildir.

| Aşama | Uygulama önerisi | Önceden konacak karar |
| --- | --- | --- |
| 0 — Veri güveni | Birkaç kontrollü test hesabında kayıt → ara → tekrar giriş → manuel komut, crash/yenileme ve cihaz geçişini server/client ile uzlaştır | Kritik kilometre taşı ve elle komut kaydı eşleşmiyorsa retention karşılaştırmasını başlatma |
| 1 — Anlama | Prototipi 6–8 yeni hedef oyuncuya yardımsız izlet; kritik takılmayı düzelt; farklı 6–8 kişiyle tekrarla | Örnek başlangıç eşiği: son 10 yeni gözlemde en az 8'i ilk bağımsız döngüyü tamamlasın; kritik risk/koruma yanlış anlaması veya engelleyici çökme görülürse ilgili sorun düzeltilip tekrar gözlensin |
| 2 — Sabit sürüm pilotu | 20–30 gerçekten yeni oyuncu, aynı sürüm ve benzer edinim kanalı; sonuç pencereleri tamamlansın | R30 için önceden kabul edilmiş ürün eşiği kullan; örneğin 30 olgun hesapta ≥6 eylemli dönüş umut verici devam sinyali, ≤3 ve zayıf aktivasyon yeniden tasarım sinyali; ara değer belirsiz |
| 3 — Tek hipotez | Trafik ve örneklem planı yeterliyse kalıcı hesap bazlı rastgele atama | Ana ölçüt R30 veya D1 eylemli olsun; diğerleri mekanizma/guardrail. Sonucu tüm atanmış yeni oyuncularda değerlendir |

- **H — Bu eşikler garanti değil:** `6/30=%20` için Wilson aralığı yaklaşık **%9,5–37,3**; önceki `2/23` ile büyük belirsizlik örtüşür. Eşik geçmek “retention arttı” anlamına gelmez; sınırlı bütçeyle ilerleme kararıdır. Bu hedefler benchmark'tan türetilmiş standartlar değildir. 30 kişi bulunamıyorsa mevcut n ve ham sayıları raporla; penceresi kapanmamış kişileri başarısız yapma.
- **H — İlk randomize soru örneği:** Aynı ekonomi, güvenlik ve içerikte rehberin yoğun ve azalan sürümünü karşılaştırmak. Aynı anda hikâye, hibe, süre, PvP ve görseli değiştirirsen, tasarım paketini karşılaştırabilirsin ama etkiyi tek bir öğeye bağlayamazsın.
- **H — Başlangıçta sabitle:** Tek ana sonuç, minimum önemli fark, uygun hesap tanımı, pencere, sürüm, örneklem/bitirme kuralı, teknik durdurma şartı. Günlük bakıp ilk olumlu p değerinde durma; sequential/Bayes yöntem kullanılacaksa kuralı ve prior'ı önceden seç. Bayes de düşük trafikte bilgi yaratmaz.
- **H — Ağ etkisi:** Yalnız UI yardımı değişiyorsa hesap bazında atama makul olabilir. Geçiş hızı, başlangıç serveti ve PvP değişirse oyuncular aynı dünyada birbirini etkiler. Bireysel A/B sonucu tüm galaksi politikasının etkisini otomatik vermez; galaksi bazında test de çok az bağımsız galaksiyle güvenilir olmayabilir. Bu durumda pilotu fizibilite/öğrenme çalışması diye adlandır.
- **H — Guardrail:** Ana ölçütün yanında engelleyici crash, ilk eyleme ulaşma, yardımsız karar, kaynak tükenmesi/geri dönülemez hata, kayıptan sonra tekrar eylem, teknik göç hatası ve gönüllü ara sonrası anlama izlensin. Sadece tutorial tamamlama artışı başarı sayılmasın.

### Gaps

- Herhangi bir küçük sayının bütün UX hatalarını bulacağı, 6–8 kişinin retention etkisini ölçeceği veya 20–30 kişinin %10 puan farkı kanıtlayacağı iddia edilemez.
- Kullanılacak gerçek baz oran, hedef kitle ve edinim hızı henüz güvenilir biçimde ölçülmediği için kesin deney takvimi verilemez.

## 9. Benchmark ve geliştirici başarı anlatıları nasıl kullanılmalı?

### Takeaway

Benchmark bağlam verir; tutorial süresinin nedenini veya Astera'nın kazanımını vermez. Geliştiricinin önce/sonra anlatımı hipotez üretir; randomizasyon yoksa kaynak ve zaman farkları etkiden ayrılamaz.

### Cited Findings

- **D, 2025 raporu; incelenen sayfa son güncellemesi 24 Ağustos 2026; analiz dönemi 2024:** GameAnalytics, üst çeyrek oyunlar için yaklaşık %26–28 D1, medyan 5–6 dakikalık oturum gibi dağılımlar raporluyor; tür ve platformların farklı davrandığını da gösteriyor. Örneklem GameAnalytics kullanan oyunlardan oluşuyor. Bu, bütün mobil oyunların rastgele örneklemi veya 5–6 dakikalık tutorial'ın nedensel testi değil; analitik ürünü satan şirketin kendi veri raporu. Günlük oyun süresi, oturum süresi ve tutorial süresi farklıdır. — [2025 Mobile Gaming Benchmarks](https://www.gameanalytics.com/reports/2025-mobile-gaming-benchmarks)
- **D, 2026 tarihli geliştirici öz bildirimi; sayfada kesin gün görünmüyor; erişim 12 Kasım 2026:** Idle Journey geliştiricisi, eski 1.028 oyuncuyla yeni 249 oyunculu farklı haftalardan kohortları karşılaştırarak ikinci oturum oranını %17,9 → %25,9 olarak veriyor. D1'deki yaklaşık %8,8 → %10 değişimin haftalık dalgalanmanın içinde kaldığını ayrıca kabul ediyor. Bu PC tarayıcı idle MMORPG örneği; randomize değil, bağımsız denetim yok ve Astera'ya taşınabilir “%45 uplift” kanıtı değil. — [Geliştiricinin tutorial vaka anlatımı](https://www.reddit.com/r/gamedesign/comments/1vt3u36/success_45_more_players_came_back_for_a_second/)

### Inferences

- **H — Doğru kullanım:** “Bu desen denenmeye değer; Astera'da şu davranış değişirse işleyebilir” de. “Başarılı rakip böyle yaptığı için aynı retention'ı alırız”, “GameAnalytics ortalaması tutorial'ı 5 dakika yap diyor” veya “%45 daha çok dönüş beklenir” deme.
- **H — Kıyas filtresi:** Mobil kalıcı stratejiyi aynı platform, edinim, kohort yaşı ve aynı retention tanımıyla kıyasla. Tarayıcı PC, Android uygulaması, organik meraklı/arkadaşlar ve ücretli reklamla gelen yeni oyuncuların karışımı ayrı görülsün.
- **H — Öncelik tercihi:** En güçlü uygulanabilir ortak yön; hızlı ilk değer, gerçek eylem, kısa bağlamsal öğretim, giderek azalan yardım, görünür sonuç, güvenli ama canlı dünya. Bunların toplamının Astera için en çok geri dönüş üreten paket olduğu henüz ölçülmüş değildir.

### Gaps

- Bu taramada Astera için sayısal retention uplift öngörüsü kurmaya yetecek veri veya kanıt bulunmadı.
- GameAnalytics'in sürekli güncellenen benchmark hub'ında mobil örneklem için ana açıklama 10.000 MAU derken gömülü karşılaştırma metni 3.000 MAU diyor. Bu tutarsızlık nedeniyle oradaki güncel tek sayı karar standardı olarak kullanılmadı; tarihli raporla yetinildi. — [GameAnalytics Benchmarks Hub](https://www.gameanalytics.com/benchmarks)
