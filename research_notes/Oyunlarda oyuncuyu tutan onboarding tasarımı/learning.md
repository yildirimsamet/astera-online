# Oyun onboardinginde öğrenme ve oyuncu özerkliği

## Ne öğretilmeli ve hangi sırayla öğretilmeli?

### Takeaway
Kaynakların ortak tasarım yönü: Oyuncuya ilk anlamlı kararını verebilmesi için gereken bilgiyi, kararın bağlamında öğret; yan sistemleri ihtiyacı doğana bırak. Ana oyuna geçişte desteği azaltırken amacı görünür tut.

### Cited Findings
- **Celia Hodent, GDC 2016, uzman anlatımı:** Onboarding; keşif sırasında engellerin giderilmesi, temel mekaniklerin öğrenilmesi, anlaşılır hedefler ve ilerleme yolu ile oyuncunun oyuna bağlanmasını kapsar. Bunlar gerçekte doğrusal aşamalar değildir. Tutorial ile ana oyun arasındaki geçiş sıklıkla anlam eksikliği yüzünden zayıflar. Dikkat ve çalışma belleği sınırlıdır; eşzamanlı talimat, hikâye ve eylem öğrenmeyi zorlaştırabilir. Fortnite UX testindeki örnekte, oyuncu eğlenceli çatışmaya odaklanırken ekranın üstündeki kritik savunma mesajını fark etmez. Bu bir tasarım örneğidir, kontrollü onboarding deneyi değildir. — [Hodent'in kendi sunum açıklaması](https://celiahodent.com/gamers-brain-ux-onboarding/)
- **Roblox resmî tasarım rehberi, uygulama tavsiyesi:** Bağlamsal öğretim, yeni özellik/öğe ile doğal karşılaşma sırasında tetiklenir. İlk oturum için zorunlu olmayan bilgiler ertelenir. Görsel yönlendirme ve yapılan eyleme anlaşılır geri bildirim önerilir. Yardımın zamanlaması gözlem ve deneyle belirlenmelidir: fazla erken ipucu keşfi böler, fazla geç ipucu hayal kırıklığına yol açar. Sayfadaki 10 saniyede düğmeyi bulma, 11. saniyede ipucu örneği **varsayımsal örnektir**, evrensel eşik veya deney sonucu değildir. — [Onboarding techniques](https://create.roblox.com/docs/production/game-design/onboarding-techniques)
- **Microsoft Xbox XAG109, güncel kılavuz (4 Mart 2026):** Oyuncu mevcut amaç ve ilerlemeyi istediği zaman görebilmeli; açıklamalar açık ve kısa olmalı. İlerlemede takılınca açılabilen yönlendirmeler, hedef dışı bildirimleri erteleme/kapatma, temel mekaniklere dair tekrar erişilebilir etkileşimli öğretimler veya gösterim videoları önerilir. Sadece kontrol şeması gösteren statik ekran tutorial sayılmaz. Sesli öğretimin altyazısı bulunmalı. Bu erişilebilirlik rehberidir; belirli retention artışı kanıtlamaz. — [Xbox Accessibility Guideline 109](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/109)

### Inferences
- **Önerilen öğretim sırası, sentez:** “Neyi başarmak istiyorum?” → bunu yapacak tek temel eylem → eylemin görünür sonucu → sonucu değiştiren basit bir seçim → aynı becerinin yardımsız tekrarı → yeni bir yakın hedef. Bu sıra kaynaklardan çıkarılan tasarım önerisidir, standart veya kanıtlanmış tek sıra değildir.
- Bir anda tek yeni kavrama odaklanmak iyi bir başlangıçtır; bunun her türde “ekranda tam bir mekanik” şeklinde değişmez kuralı yoktur.
- İpucu doğrudan düğmeye işaret ediyorsa oyuncu tıklamayı yapabilir; “neden bu eylemi yaptığını” ve ikinci kez yardımsız yapabildiğini ayrıca kontrol etmek gerekir.
- Yardımı azaltma modeli: göster → birlikte yaptır → küçük değişiklikle yardımsız yaptır. “Tutorial tamamlandı” yerine davranışsal yeterlik hedeflenmeli.

### Gaps
- Bu kaynaklar evrensel ilk dakika veya bütün oyunlar için zorunlu öğretim sırası vermez. Özellikle uzun süreli, asenkron PvP strateji oyununa aktarım test gerektirir.
- Başlangıçtaki sesli hikâye her durumda kötüdür sonucu çıkarılamaz; sorun, dikkat isteyen öğretimle çakışmasıdır.

## Açık talimatlar ve oyuncu özgürlüğünü kısıtlama ne zaman yararlı veya zararlı?

### Takeaway
Tutorialın yararı oyunun öğrenilme biçimine bağlıdır. Karmaşık ve alışılmadık sistemlerde bağlamsal açıklamalar faydalı olabilir; kolayca deneyerek öğrenilen oyunlarda fazladan öğretim işe yaramayabilir. Özgürlüğü sürekli kapatmanın üstünlüğü gösterilmiş değildir.

### Cited Findings
- **Andersen ve diğerleri, CHI 2012, özgün randomize saha deneyi:** 45.000'den fazla yeni oyuncu, üç oyunda sekiz öğretim koşuluna atandı. En karmaşık oyun Foldit'te bağlamsal tutorial ile tutorialsız koşula göre oynama süresi yaklaşık %29, geçilen bölüm sayısı %75 arttı. Bağlamsal öğretim, başta verilen kılavuza göre süreyi %16 ve ilerlemeyi %40 artırdı. Daha basit Refraction ve Hello Worlds'te benzer yarar görülmedi. Başka eylemleri engelleyen öğretimin genel üstünlüğüne kanıt bulunmadı. **Foldit geri dönüş oranı anlamlı artmadı:** bağlamsal tutorial %19,16, tutorialsız %20,50, p=0,408. Süre/ilerleme sonuçları retention kazanımı diye sunulmamalı. Deney üç eski oyunla sınırlı; karmaşıklık ile indirme/kurulum ve oyuncu motivasyonu ayrıştırılmamış; duygular doğrudan ölçülmemiş; geri dönüş ölçüsü standart D1/D7 değildir. — [Orijinal makale](https://grail.cs.washington.edu/projects/game-abtesting/chi2012/chi2012.pdf), [yazarların proje sayfası](https://grail.cs.washington.edu/projects/game-abtesting/chi2012/)
- **Ryan, Rigby ve Przybylski, 2006, dört özgün çalışma:** Algılanan özerklik ve yeterlik oyun keyfi ve tercihlerle ilişkili. Çok oyunculu topluluk anketinde özerklik, yeterlik ve sosyal bağ ihtiyacı tatmini keyfi ve gelecekte oynamayı bağımsız olarak yorduyor. Sonuç özellikle “oyuncu kendisi karar verebildiğini ve başarabildiğini hissetsin” yaklaşımını destekler; tek başına onboarding tasarımı veya belirli süre için nedensel kanıt sağlamaz. Yayıncı sayfasında özet doğrulandı; tam metin abonelikli. — [The Motivational Pull of Video Games](https://link.springer.com/article/10.1007/s11031-006-9051-8)

### Inferences
- Deneyerek öğrenilemeyen maliyet, karşıtlık, hedef koşulu, geri alınamaz karar gibi kuralları kısa ve karar öncesi açıklamak gerekir. Keşfi mümkün olan basit etkileşime her seferinde modal eklemek gereksiz olabilir.
- İlk kez gerekli beceri için kısa bir zorunlu adım gerekebilir. Ancak bütün akışı tek açık düğme zincirine çevirmek yerine, yardım seviyesi oyuncunun davranışına göre azalmalı/artmalı.
- “Gerçek seçim” iki seçeneği okumak değil, oyuncunun anlayabildiği bir sonuç farkı yaratmasıdır. Başarı da yalnız büyük ödül değil, kendi eylemiyle neden-sonuç bağlantısını görmesidir.
- Özerklik her özelliği ilk ekranda açmak demek değildir. Az sayıda anlaşılır seçenekle seçim yaptırmak, karmaşık bir menüde kaybolmaktan daha iyi tasarım hipotezidir.

### Gaps
- “Tutorialı tamamen kaldırırsak retention artar” veya “zorunlu tutoriallar her zaman zararlıdır” sonuçları bu veriden çıkarılamaz.
- Özgürlük ile öğrenmeyi değerlendirmek için anlamlı görev başarısı ve sonrasındaki yardımsız tekrar gözlemlenmeli; yalnız tıklama oranı yeterli değildir.

## Hangi oyun örneklerinin geliştirici tarafından belgelenmiş dersleri var?

### Takeaway
Plants vs. Zombies öğretimi oyuna yayma ve anlaşılır görsellik için, Portal ise zor bir fikri küçük problemlere ayırma ve yeni oyuncuyla sürekli test etme için güçlü birinci el örneklerdir. Bunlar ürün deneyimleridir; A/B test edilmiş retention yüzdeleri sunmazlar.

### Cited Findings
- **George Fan, PopCap, GDC 2012, orijinal 204 sayfalık sunum:** Öğretimi oyun içine yedirme, okumaktan çok uygulama, güvenli deneme, mekanikleri zaman içine yayma, oyuncunun mevcut araçlarla oynayabilmesine fırsat verme, kısa ve akışı kesmeyen mesajlar, davranışa uyarlanan yardım, görselle öğretme ve tanıdık anlamlardan yararlanma öneriliyor. Kürek ilk bölüm yerine 1-5'te, para gece bölümlerinde, mağaza havuz bölümlerine gelince tanıtılıyor. Sunumdaki “bir anda sekiz kelime” Fan'ın kendi yaklaşımıdır; tüm oyunlara aktarılacak bilimsel sınır değildir. Kritik ders, ekonomiyi doğru anlatamayan uzun açıklamayı artırmak yerine öğretimi ve deneyimlenen sistemi birlikte düzeltmesidir. — [George Fan'ın GDC slaytları](https://media.gdcvault.com/gdc2012/slides/Design%20Track/Fan_George_How%20I%20Got.pdf)
- **Kim Swift, Portal geliştiricisi, 2008 postmortem:** Ekip ilk haftadaki çok kaba ilk odadan itibaren oyunu test etti; her hafta veya kayda değer yeni içerikte oyunu bilmeyen biri baştan sona oynadı ve ekip gözlemledi. Oyuncular enerji topunu iki kez portal üzerinden yönlendiren bulmacada takılınca önce birer yönlendirme öğreten iki bölüm eklendi. Sonraki oyuncular birleşik problemi daha hızlı kavradı. Bu, anlatım eklemek yerine kavramı bölümlere ayırmanın belgelenmiş örneği. Makale ekip anlatımıdır; örneklem/istatistik verilmez. — [Thinking With Portals: Creating Valve's New IP](https://www.gamedeveloper.com/design/thinking-with-portals-creating-valve-s-new-ip)

### Inferences
- Kendi oyunumuz için uygulanabilir yaklaşım: Yeni oyuncunun ilk ana döngüsünü sessizce gözlemle; aynı yerde birden fazla kişi takılıyorsa önce görsel açıklık, geri bildirim ve adımın karmaşıklığını düzelt. Her sorunu ek bir metin kutusuyla çözmeye çalışma.
- Öğretim bitince bütün görevleri kaldırmak ani boşluk yaratabilir. Büyük ana hedefi ve bir sonraki yapılabilir küçük hedefi görünür tutarken emir veren işaretleri azaltmak uygun bir hipotezdir.
- Astera gibi bilgi ve risk üzerinden karar verilen oyunda, ilk başarı yalnız kaynak toplama veya bina yükseltme olursa ana oyunun çekiciliği henüz öğretilmemiş olabilir. İlk deneyim içinde bilgi edinme → fırsatı değerlendirme → anlaşılır riskle karar → görünür sonuç bağlantısı hissettirilmeli. Bu Astera'ya dair çıkarımdır, araştırma bulgusu değildir ve mevcut implementasyonu incelenmemiştir.

### Gaps
- GDC Vault video sayfası şu an bakım sayfasına yönlendi. Fan'ın orijinal slayt PDF'i erişilebilir ve metni okundu; video izlenmedi. Görsel ayrıntılara veya aktarılmayan sözlü anlatıma dair iddia yapılmamalı.
- Hiçbir kaynak bu örneklerin tek başına tutorial tasarımı sayesinde ticari başarıya ulaştığını kanıtlamaz.
