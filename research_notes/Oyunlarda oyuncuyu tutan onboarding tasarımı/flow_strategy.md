# İlk karşılaşmadan bağımsız oyuna geçiş

## Akışta ne olmalı ve oyuncu nasıl sıkılmadan ilerlemeli?

### Takeaway
Onboarding, arayüzü gezdirmek yerine oyuncuya oyunun değerini yaşatan küçük bir gerçek oyun döngüsü olmalı. Hedef; oyuncunun nereye dokunacağını ezberlemesi değil, neden bir eylem seçtiğini ve sonucunun ne anlama geldiğini anlayarak aynı tür kararı yardımsız tekrar verebilmesidir.

### Cited Findings
- Apple, temel oyun döngüsünü öğretmeyi, adımları basitten karmaşığa kurmayı, kısa ve açık yönergeler kullanmayı ve ileri hedeflere geçmeden yeterlilik göstermeyi öneriyor. Clash Royale'ı birbirine eklenen kısa derslere örnek veriyor. Ayrıca mümkün olduğunca erken bağımsız oyun, atlama ve sonradan tekrar yardım olanağı öneriyor. İlk hedeflere hizmet etmeyen puanlama, bildirim izni ve yan sistem tanıtımlarını ertelemeyi tavsiye ediyor. Bu bir platform tasarım rehberidir; yayımlanmış karşılaştırmalı etki ölçümü değildir. — [Apple: Onboarding for Games](https://developer.apple.com/app-store/onboarding-for-games/)
- Microsoft'un XAG 109 rehberi, oyuncunun mevcut hedefi ve ilerlemeyi istediği an gözden geçirebilmesini; gerektiğinde ipucu ve yönlendirme alabilmesini; eğitimleri tekrar açabilmesini öneriyor. Yalnız kontrol şeması gösteren statik ekranları yeterli eğitim saymıyor. Sesli anlatıma altyazı eklenmesini istiyor. Bu öneriler yeni, gündelik ve bilişsel güçlük yaşayan oyunculara da yardımcı olmayı hedefliyor. — [Xbox Accessibility Guideline 109: Objective clarity](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/109)
- Roblox'un geliştirici rehberi, kontrol bilgisinin yanında ana döngünün hem ne hem neden sorularını öğretmesini; eğlenceli değerin erken gösterilmesini; sosyal oyunlarda ilk eşleşme/gruplamanın deneylerle değerlendirilmesini öneriyor. Bunlar Roblox'un tasarım önerileri; her oyun türü için nedensel sonuç iddiası olarak aktarılmamalı. Rehberin D1 ile funnel'ı bir arada anlatan ifadesi karışık olduğundan D1 tanımı için kullanılmamalı. — [Roblox: Onboarding](https://create.roblox.com/docs/production/game-design/onboarding)

### Inferences
Aşağıdaki çerçeve kaynaklardan hareketle hazırlanmış tasarım sentezidir; araştırmayla kanıtlanmış tek doğru sıra değildir:

1. **Vaat:** Oyuncu ilk ekranda nasıl bir deneyime girdiğini görür. Uzay stratejisinde canlı bir galaksi, sahip olduğu bir yer ve dikkat çeken bir olay, özellik listesinden daha somut bir başlangıçtır. Pazarlama vaadiyle ilk oynanış aynı deneyimi işaret etmelidir.
2. **Yakın amaç:** İlk hedef soyut bir gelecek vaadi değil, şimdi anlaşılabilecek bir ihtiyaçtır. Oyuncu "Bunu neden yapıyorum?" sorusunu cevaplayabilmelidir.
3. **En küçük eylem:** Yalnız o hedef için gerekli kontrol öğretilir. Her balon aynı anda bir amacı taşır. Eylemin gerektiği yüzeyde kısa açıklama verilir; öğrenme sırasında görüşü kapatan çoklu pencerelerden kaçınılır.
4. **Görünür sonuç:** Yapılan işlem dünyada değişim üretir. Ödül ekranından önce eylem ile sonuç ilişkisi anlaşılır: ne oldu, neden oldu, benim durumum nasıl değişti?
5. **Anlamlı seçim:** Oyuncuya iki anlaşılabilir seçenek verilir. İkisine de basması zorunlu bir kontrol listesi, karar sayılmaz. Gerekli bilgi sunulur; en iyi strateji oyuncu adına seçilmez.
6. **Yardımı azalt:** İlkinde göster; ikincide kısa hatırlat; sonraki benzer durumda oyuncuya alan aç. Takılırsa yardım erişilebilir olsun. Zorlanan oyuncuya daha çok metin yığmak yerine yanlış anlaşılan kavram bulunur.
7. **Bağımsız tekrar:** Yönlendirme olmadan benzer ama tamamen aynı olmayan bir hedefte döngü tekrar edilir. Bu, eğitim düğmelerini tamamlamaktan daha anlamlı bir bitiş ölçütüdür.
8. **Devam edecek konu:** Oyuncu ayrılmadan bir sonraki kararını ve geri geldiğinde hangi sonuca bakacağını bilir. Devam motivasyonu oyunun kendi vaadinden gelmelidir.

### Gaps
- "İlk aksiyon X saniyede olursa retention kesin artar" veya bu sıranın tüm oyunlarda en iyi olduğu yönünde deneysel veri bu kaynaklarda yoktur.
- Birinci ekranda kayıt gerekip gerekmediği hesap sürekliliği, güvenlik ve platform bağlamına bağlıdır. Aşağıdaki kayıt önerisi ürün kimliğini veya mevcut uygulamayı değiştirme talimatı değildir.

## Güvenli öğrenme, gerçek beklenti, sosyal oyun ve giriş sürtünmesi nasıl dengelenmeli?

### Takeaway
Öğrenirken yapılan bir hatanın bedelini sınırlamak ile gerçek oyunun kurallarını saklamak farklı kararlardır. Oyuncu temel kontrol ve risk dilini güvenle öğrenmeli; sonrasında koruma sınırlarını ve gerçek oyuna geçişte ne değiştiğini anlayabilmelidir.

### Cited Findings
- CCP'nin 14 Nisan 2026 Exordium tasarım açıklaması, PvP tehdidiyle aynı anda temel sistemleri öğrenmenin kaygı yaratabildiğini söylüyor. Yeni başlangıç bölgesinde PvP engelleniyor; içerik, ödül ve ekonomik fırsatlar bu sınırlı öğrenme alanına göre düzenleniyor. Yeni başlayanların birbirlerini bulması ve deneyimli oyunculardan mentorluk alması da tasarım amacı. Bunlar açıklanmış tasarım gerekçeleri; yazı retention kazancı raporlamıyor. — [CCP: Introducing Exordium](https://www.eveonline.com/news/view/introducing-exordium)
- CCP, Ocak–Eylül 2025 Rookie Help görüşmelerinde 5,8 milyon mesaj ve 706 bin gerçek soru incelediğini bildiriyor. Soruların bağlama göre değiştiğini ve teknik olarak doğru bir açıklamanın bilinmeyen kavramlar ekleyerek kafa karışıklığını büyütebildiğini söylüyor. Yeni yardım sisteminin istemci içinden ilgili arayüzü işaretleyebilmesini vurguluyor. Bu analiz kamusal ham veri veya bağımsız doğrulama içermiyor; sistemin retention etkisi yazıda henüz bilinmiyor ve randomize A/B testiyle sınanıyor. — [CCP: EVE Evolved — Aura Guidance](https://www.eveonline.com/news/view/eve-evolved-aura-guidance)
- PlayFab'ın giriş rehberi, oyuncudan veri girişi istemeyen anonim başlangıcı düşük sürtünme için öneriyor; sonrasında hesabı kurtarılabilir bir girişe bağlama ve faydasını açıklama gereğini belirtiyor. Kaybolan cihaz veya kimlik belirteciyle bağlantısız hesabın geri alınamayabileceğini açıklıyor. Bu, düşük sürtünme ile ilerlemeyi korumanın birlikte düşünülmesine dayanak sağlar; anonim kimliğin Astera için otomatik doğru mimari olduğunu kanıtlamaz. — [Microsoft PlayFab: Login basics and best practices](https://learn.microsoft.com/en-us/xbox/playfab/identity/player-identity/login/login-basics-best-practices)

### Inferences
- İlk ekranı hesap formu, isim seçimi, sunucu listesi, bildirim izni ve mağaza turuyla doldurmak yerine o an gerçekten gerekenler belirlenmeli. Mümkün olan ürünlerde önce küçük bir oynanabilir deneyim, sonra "ilerlemeni koru" gerekçesiyle hesap bağlantısı düşünülebilir. Gerçek hesap gerektiren ürünlerde giriş kısa tutulur, tekrar girişler otomatikleştirilir.
- Oyuncuya kontrollü alanda verilen sonuçlar, ana oyunun risk dilini yanlış öğretmemeli. "Her savaşı kazanıyorum" ve "filo hiçbir zaman kaybolmuyor" beklentisi kurulup bir anda gerçek bedellere geçilmemeli. İlk gerçek geri döndürülemez karardan önce ilgili risk ve kural görünür olmalı.
- Erken başarısızlık kendi başına tasarım hatası değildir. Belirsiz sebep, anlaşılmayan bedel ve ne yapacağını bilmemek daha temel sorunlardır. Kayıp olduğunda neyin etkilediği, neyin korunduğu ve hangi sonraki kararın mümkün olduğu anlaşılır olmalı. Zorunlu mağlubiyet veya sürekli bedelsiz zaferin iyi olduğuna dair genel iddia kurulmamalı.
- Sosyal deneyimin kendisi ürünün değeriyse ilk oturumda dünyanın canlı olduğu görülebilir; ancak sohbet yazmak, klan bulmak veya PvP ustalığı göstermek zorunlu giriş sınavı olmamalı. Astera'da olmayan ittifak gibi sistemler araştırma önerisi diye eklenmemeli.
- Kısa görev metni; eylem, gerekçe ve beklenen sonucu bağlamalı. Açıklama bilinmeyen iki terim daha gerektiriyorsa o anda daha yalın bir dil veya görünür örnek gerekir. İpuçları oyuncuyu kararın yerine değil karar için gerekli bilgiye götürmeli.
- Atlayan oyuncu "her şeyi biliyor" sayılmamalı. Sonradan yardım, mevcut hedef ve temel kural açıklaması açık kalmalı. Atlamak oyuna başlamak için gereken başlangıç durumunu bozmamalı.

### Gaps
- Kaygıyı azaltan korumalı başlangıç alanının her PvP oyunu için üstün olduğu söylenemez. Böyle bir alanın kapsamı ve ekonomisi, Astera'da çekirdek tasarım/denge onayı gerektirebilir; burada yeni mekanik önerilmemektedir.
- PlayFab rehberindeki eski teknik örnekler ürünün güncel güvenlik kurallarından ayrı değerlendirilmelidir. Rapora SDK/API uygulama tavsiyesi alınmamalı.

## Astera için ilk döngü ve geri dönüş nasıl örneklenebilir?

### Takeaway
Astera için öğretilecek deneyim yalnız bina yapmak veya ödül toplamak değil; bilgiye bakıp fırsatı değerlendirmek, bir seçim yapmak, filo göndermek ve sonucun yeni bilgi yaratmasını görmektir. Aşağıdaki akış araştırma sentezinden üretilmiş bir taslak; mevcut kodun denetimi, kabul edilmiş yeni spec veya uygulanmış davranış değildir.

### Cited Findings
- Projenin işletim kılavuzu ana döngüyü geliştirme → biriktirme → istihbarat → fırsat → hedef seçimi → risk → gönderim → çevrimdışı bekleme → sonuç → yeni karar olarak tanımlıyor. Ekonomi bunun desteğidir. Bu yerel ürün bağlamıdır, dış araştırma kanıtı değildir. — [Yerel işletim kılavuzu](/home/yildirim/Desktop/Coding/MyProjects/blindspace/CLAUDE.md)
- Yerel onboarding incelemesi ayrı bir Akademi deneyimi ve ilerlemenin gerçek galaksiye taşınması tasarımını anlatıyor. Belge tarihsel ve güncel uygulama notlarını birlikte taşıyor; bu çalışma kod doğrulamadığından bugünkü deneyim hakkında kesin çıkarım yapılmadı. — [Yerel onboarding incelemesi](/home/yildirim/Desktop/Coding/MyProjects/blindspace/docs/review-onboarding.md)

### Inferences
Örnek akış, sıfırdan yeni mekanik ekleme önerisi değildir; mevcut yüzeylere uygulanabilecek öğretim sırasını tarif eder:

| Aşama | Oyuncunun yaşadığı | Öğrendiği | Rehberin görevi |
|---|---|---|---|
| Sahiplik ve sahne | Kendi gezegenini ve hareketli uzayı görür. | "Burası benim; dünyada bir şeyler oluyor." | Tek bir yakın amaç sunmak. |
| Merak | Yakında anlaşılabilir bir sinyal/fırsat görür. | "Ne bildiğim ve neyi bilmediğim önemli." | İlgili bilgi aracına götürmek. |
| İlk istihbarat | Karara yarayan birkaç bilgiyi inceler. | Bilginin neyi gösterdiği ve hangi belirsizliğin kaldığı. | Karar için gerekli kuralı eylemden önce açıklamak. |
| İlk seçim | Örneğin iki hedefi veya gönderilecek filo miktarını karşılaştırır. | Daha iyi ödülün/avantajın ne tür bedeli olduğu. | Kendi değerleriyle karşılaştırma desteği; sonucu garantilememek. |
| Taahhüt | Tercihini yapıp filosunu gönderir. | Kararının dünya üzerinde gerçek karşılığı olduğu. | Geri döndürülemezlik gibi önemli kuralı gönderimden önce görünür kılmak. |
| Bekleme | Filonun ne zaman sonuç üreteceğini görür. | Ekran başında kalmasının gerekip gerekmediği. | Anlamlı başka karar varsa göstermek; yoksa ayrılmayı doğal kılmak. |
| İlk sonuç | Rapor/ganimet/kayıp ve bunun gerekçesini görür. | Bilgi → seçim → sonuç bağlantısı. | Etkileri açıklamak ve sonraki seçeneği görünür kılmak. |
| Yardımsız tekrar | Benzer yeni fırsatta kendi hedefini seçer. | Öğrenileni başka duruma taşıyabilmek. | Talep edildiğinde yardım; sürekli zorunlu el tutmamak. |
| İlk dönüş | Önceki olayın sonucu ve yeni durum özetiyle karşılaşır. | Dünya devam etti; şimdi yeni bir karar var. | Uzun yokluk sonrası hedefi ve değişimi hatırlatmak. |

Asenkron oyun için özel öneriler:

- **Beklemeyi boşluk olmaktan çıkar:** Oyuncu neyin beklediğini, ne zaman değişeceğini ve çevrimdışıyken ne olacağını anlamalı. Ekrana baktırmak veya anlamsız tıklama üretmek öğretim sayılmaz.
- **İlk oturumda vaat kanıtı ver:** Asıl sonucun zamanlaması oyunun doğası gereği geçse bile oyuncu bilgi ile seçimi ve gönderim eylemini erken yaşamalı. İlk sonucun erken görünmesi isteniyorsa bunu rastgele denge sayıları önererek değil mevcut uygun olay/zamanlama içinde test et.
- **Dönüş gerekçesi somut olsun:** "Yarın ödül var" yerine ürünün ana vaadine bağlı "Gönderdiğim filoya ne oldu; bu bilgi şimdi hangi fırsatı açtı?" sorusu düşünülebilir. Bu, Astera bağlamında tasarım önerisidir; her oyunda günlük ödülden daha iyi olduğuna dair deneysel iddia değildir.
- **Dönüşte yeniden oryantasyon:** Ne oldu, benim durumum nasıl değişti, şimdi ne seçebilirim? Üçünü anlaşılır sun. Geri dönen oyuncuya eğitimi baştan zorunlu oynatmak yerine gerekli hatırlatmayı göster.
- **Sahte uzunluk azaltımından kaçın:** 40 tıklamayı 20 tıklamaya indirmek yararlı olabilir; ama oyuncu hâlâ neden yaptığını bilmiyorsa asıl sorun sürer. Buna karşı uzunluğu azaltırken karar öncesi risk açıklamasını kesmek de öğrenmeyi bozabilir.

### Gaps
- Önerilen Astera akışının herhangi bir retention etkisi ölçülmedi. Mevcut Akademi'nin gerçek süreleri, yardımsız karar başarısı ve ilk dönüş kayıpları kod/oynama/analitik denetimi yapılmadan bilinmiyor.
- Bu çalışma denge, PvP koruması, başlangıç kaynakları, tutorial ödülleri veya çekirdek sistem değişikliği için onay oluşturmaz.
