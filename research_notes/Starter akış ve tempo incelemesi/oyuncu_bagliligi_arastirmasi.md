# Yeni oyuncu bağlılığı, tempo ve geri dönüş araştırması

Araştırma tarihi: 7 Kasım 2026. Bu notlar yalnız dış araştırma dilimidir; Astera’nın mevcut kodu veya oyuncu davranışı hakkında gözlem yapılmış gibi okunmamalı. Önceki onboarding raporu arka plan olarak okundu; aşağıdaki kaynaklar internetten yeniden arandı ve birincil yayın/kurum sayfaları üzerinden doğrulandı. Bulgular bir tarayıcı strateji oyununa doğrudan genellenmiş sonuçlar değildir. Doğrudan alıntı kullanılmadı (kaynak başlıkları dışında); her kaynağa dayanan özet ve tasarım çıkarımı kısa tutuldu. Kaynakların belirtilen tarihleri yayın tarihidir; web indeksindeki “yakın zamanda tarandı” tarihi yayın tarihi sayılmadı.

## Oyuncuyu öğrenmeye, karar vermeye ve kendi isteğiyle sürdürmeye ne bağlar?

### Takeaway

Araştırmalar yalnız ödül sıklığına bakmayı desteklemiyor: oyuncunun bir şey öğrendiğini, seçiminin sonucu olduğunu ve kontrolleri kendisinin kullandığını hissetmesi önemli. Eğitim başarısı, tutorial satırlarının tamamlanmasından ayrı ölçülmeli; oyun süresindeki artış da sonraki gün geri dönüşle eş tutulmamalı. [Ryan vd., 2006](https://selfdeterminationtheory.org/SDT/documents/2006_RyanRigbyPrzybylski_MandE.pdf), [Andersen vd., 2012](https://grail.cs.washington.edu/projects/game-abtesting/chi2012/chi2012.pdf)

### Cited Findings

**S1 — Ryan, Rigby ve Przybylski, 2006; The Motivational Pull of Video Games.** Dört çalışma; ilk üçünde laboratuvar oyunları, dördüncüde MMO oyuncuları inceleniyor. Algılanan yetkinlik ve özerklik oyun keyfi ve yeniden oynama niyetiyle ilişkili; MMO çalışmasında aidiyet de gelecekte oynama niyetine bağımsız katkı veriyor. İlk çalışmada devam oyununu gerçekten seçme ile yalnız gelecekte oynama tercihi aynı sonuç değil; davranışsal seçimde yetkinlik daha belirgin. Bunlar Astera için ölçülmüş D1/D7 katsayıları değil. Yazarlar laboratuvarın gönüllü gerçek oyun davranışına genellenmesi ve yeni ölçümlerin sınırlarını açıklıyor. **Kanıt türü:** birincil çok çalışmalı psikoloji araştırması; ihtiyaçlarla sonuç ilişkisi güçlü bir tasarım çerçevesi, özellik→retention için doğrudan nedensel reçete değil. [Yazarların tam metni](https://selfdeterminationtheory.org/SDT/documents/2006_RyanRigbyPrzybylski_MandE.pdf), DOI: 10.1007/s11031-006-9051-8.

**S2 — Andersen vd., CHI 2012; The Impact of Tutorials on Games of Varying Complexity.** Üç oyunda sekiz tutorial tasarımını, toplam 45.000’den fazla oyuncuyla sahada karşılaştırdı. Karmaşık Foldit’te bağlamsal tutorial koşulunda süre yaklaşık %29, geçilen bölüm yaklaşık %75 arttı; aynı karşılaştırmada geri dönüş anlamlı artmadı. Daha basit iki oyunda tutorial’ın yararı aynı değildi. Oyuncu özgürlüğünü kısıtlamanın öğrenmeyi iyileştirdiğine destek bulunmadı. **Kanıt türü:** büyük, oyun içi deney; oyunlar arasında etki heterojen. Örneklem büyüklüğü tutorial’ın her türde işe yaradığını kanıtlamıyor. [Üniversitenin tam metni, özellikle s. 6–8 / Table 1](https://grail.cs.washington.edu/projects/game-abtesting/chi2012/chi2012.pdf), DOI: 10.1145/2207676.2207687.

**S3 — Larche ve Dixon, 2020; skill–challenge balance / complex mobile games.** 60 Candy Crush oyuncusu kendi düzeyine yakın, çok kolay ve çok zor bölümler oynadı. Kolay bölümlerde flow en düşüktü; normal ve zor bölümlerin flow’u birbirine yakındı, zor bölümler daha fazla hayal kırıklığı yaratsa da. Flow ile uyarılma birlikte sürdürme isteğiyle ilişkiliydi. **Kanıt türü:** oyun zorluğunu değiştiren kontrollü çalışma; ölçülen şey oturum içindeki sürdürme isteği, sonraki gün gerçek dönüş değil. “Beceri=zorluk olursa her oyuncu en iyi flow’a girer” şeklinde tek çizgili reçete çıkarılamaz. [Tam metin](https://pmc.ncbi.nlm.nih.gov/articles/PMC8943660/).

**S4 — Deci, Koestner ve Ryan, 1999; dış ödüller meta-analizi.** 128 deneyin meta-analizinde beklenen somut ve işe/bitirmeye/performansa bağlanan ödüller, ödülün olmadığı serbest seçim dönemindeki içsel motivasyonu bazı koşullarda düşürdü; olumlu geri bildirim farklı, destekleyici sonuç verdi. **Kanıt türü:** deneylerin birincil meta-analizi; sonuç ödül türüne ve koşuluna bağlı. İlginç bir etkinlik için dışarıdan verilen ödülle, bir strateji oyunundaki harcanabilir kaynak/araç kazanımı birebir aynı değildir. Bu nedenle “kasaları kaldırmak bilimsel zorunluluk” sonucu çıkmaz. [Yazarların tam metni](https://selfdeterminationtheory.org/wp-content/uploads/2014/04/1999_DeciKoestnerRyan_Meta.pdf), DOI: 10.1037/0033-2909.125.6.627. PDF araçta metne ayrılmadı; yayıncı/yazar makalesinin indekslenmiş özetiyle temel meta-bulgular doğrulandı, alt-grup sayıları kullanılmadı.

**S5 — Apple, Onboarding for Games; tarihsiz, 7 Kasım 2026’da erişildi.** Ana döngüyü öğretmeyi, kısa ve ilgili anda açılan dersleri, öğrenilenin rehbersiz uygulanmasını ve mümkün olan en erken bağımsız oyunu öneriyor. Atlama seçeneği, sonradan yeniden yardım, ikincil tanıtım ve bildirim izinlerini erken hedeften sonraya bırakma tavsiyeleri var. **Kanıt türü:** platform sahibinin birinci el tasarım rehberi ve örnekleri; kontrollü retention deneyi veya belirli iyileşme oranı sunmuyor. Rehberin günlük ödül/streak örnekleri de bu yapıların her oyunda yararlı olduğuna kanıt sayılmaz. [Resmî rehber](https://developer.apple.com/app-store/onboarding-for-games/).

### Inferences

- **Astera için denetim sorusu:** Oyuncu ilk sonda raporundan sonra “hangi hedefi, neden seçerim?” diyebiliyor mu, yoksa yalnız ışıldayan düğmeyi mi buldu? İlk davranış yetkinlik/özerklik hipotezine hizmet eder; ikinci yalnız ekran talimatını bitirmiş olabilir. Sonuç bağlamdan türetildi, Astera’da test edilmedi. [S1](https://selfdeterminationtheory.org/SDT/documents/2006_RyanRigbyPrzybylski_MandE.pdf), [S2](https://grail.cs.washington.edu/projects/game-abtesting/chi2012/chi2012.pdf)
- **Kasa/değer denetimi:** Ödülün oyuncunun bir sonraki anlamlı seçimini nasıl değiştirdiği görünmeli. Yalnız animasyon veya sayı artışı, yeni yetenek/öğrenme ile eşdeğer değil; kaynak ödüllerini sırf dış ödül oldukları için suçlamak da yanlış. [S1](https://selfdeterminationtheory.org/SDT/documents/2006_RyanRigbyPrzybylski_MandE.pdf), [S4](https://selfdeterminationtheory.org/wp-content/uploads/2014/04/1999_DeciKoestnerRyan_Meta.pdf)
- **Kademeli öğretim:** Yeni sistem sayısı kadar oyuncunun o anda çözmek zorunda olduğu karar sayısını sayın. Kamera, maliyet, hedef seçimi, rapor, yeni sekme ve izin istemi bir anda geliyorsa bunları doğal ihtiyaçlarına dağıtmak test edilebilir bir hipotezdir; herkes için sabit “en fazla üç kavram” kuralı bu kaynaklardan çıkmıyor. [S2](https://grail.cs.washington.edu/projects/game-abtesting/chi2012/chi2012.pdf), [S5](https://developer.apple.com/app-store/onboarding-for-games/)

### Gaps

- Astera’ya uygun evrensel bir “ilk oturum tam X dakika”, “her Y saniyede ödül”, “D1 kesin %Z artar” eşiği bulunmadı.
- Bir öğretim kutusunun kapanması, bilginin anlaşıldığını veya rehbersiz kullanılabildiğini göstermez; gerçek yeni oyuncu gözlemi gerekir.
- Güncel Astera kaynak/harcama/kilit davranışları diğer araştırma diliminde inceleniyor; bu notlar onların yerine ürün hakkında hüküm kurmaz.

## Bekleme, birden çok zirve ve oturumdan sonra geri dönme nasıl değerlendirilmeli?

### Takeaway

Bekleme tek başına başarısız tasarım değildir; çevrimdışı sonuç beklemek bazı oyunların vaadidir. Kritik ayrım, oyuncunun bilinçli bir kararının sonucunu beklemesi ile henüz oyunun vaadini yaşamadan ekranda tutulmasıdır. Oturum içi flow, geri dönüş niyeti, gerçek dönüş ve sık kontrol etme ayrı ölçülerdir. [Cutting vd., 2019](https://eprints.whiterose.ac.uk/id/eprint/135461/1/BusyDoingNothingWhatDoPlayersDoInIdleGames.pdf), [Petersen vd., 2017](https://findresearcher.sdu.dk/ws/files/195676326/p377_petersen.pdf)

### Cited Findings

**S6 — Petersen vd., CHI PLAY 2017; Evaluating the Onboarding Phase of Free-to-Play Mobile Games.** Üç mobil oyunda 28 katılımcıyla kayıt, fizyolojik ölçüm, deneyim eğrisi ve sonradan görüntüyle hatırlatma görüşmesi birlikte kullanıldı. WinterForts’ta 19 katılımcı, otomatik yürüyen savaşta birkaç dakika beklemeye kızdığını bildirdi. Yüksek uyarılma bazen rahatsızlık ve düşük özerklikten geldi; tek başına uyarılma “iyi peak” demek değildi. **Kanıt türü:** küçük laboratuvar / karma yöntem; tüm oyuncuların retention’ı hakkında istatistiksel genelleme veya optimum bekleme süresi vermez. [Tam metin, s. 6 ve sınırlılıklar](https://findresearcher.sdu.dk/ws/files/195676326/p377_petersen.pdf), DOI: 10.1145/3116595.3125499.

**S7 — Cutting, Gundry ve Cairns, 2019; Busy doing nothing?** Neko Atsume oyuncularıyla N=1.972 anket, oyundan uzakken ilerleyen deneyimde de bağlılık olduğunu; oyun süresi, doğrudan sosyallik, sosyal medya etkileşimi ve kontrol sıklığının farklı boyutlar olduğunu gösteriyor. Araştırmacılar geleneksel sürekli immersion/flow ölçülerinin bu oyunu iyi açıklamadığını, alışkanlığın ayrıca araştırılmasını öneriyor. **Kanıt türü:** kesitsel, kendibildirimli tek oyun anketi; belirli bir timer’ın bağlılığı yarattığını göstermez. [Üniversite açık tam metni](https://eprints.whiterose.ac.uk/id/eprint/135461/1/BusyDoingNothingWhatDoPlayersDoInIdleGames.pdf), DOI: 10.1016/j.ijhcs.2018.09.006.

**S8 — Kivetz, Urminsky ve Zheng, 2006; The Goal-Gradient Hypothesis Resurrected.** Kafe sadakat programı ve çevrimiçi şarkı değerlendirme ödül programında hedefe yaklaşıldıkça çaba/ziyaretin hızlandığı gözlendi; deneysel ilerleme çerçevesi de incelendi. **Kanıt türü:** saha deneyleri + gözlemsel tüketici verileri; oyun çalışması değil. Hedefe yaklaşmanın görünür ve anlaşılır olması için gerekçe sağlar; Astera’da “%80 gemi onarımı, %80 zamanda bitiş” veya yanıltıcı ilerleme göstermek için kanıt değildir. [Yazarların üniversite tam metni](https://business.columbia.edu/sites/default/files-efs/pubfiles/1200/goalgradient.pdf), DOI: 10.1509/jmkr.43.1.39.

**S9 — Nakamura vd., IMWUT 2025; Ethical Disengagement in Mobile Games.** Flying Gorilla’da bir ay süren, 84 binden fazla oyunculu randomize saha deneyinde yükleme gecikmesi ve gri ekran müdahaleleri kullanım/retention’ı etkiledi; resmî kurum özetinde en büyük etki gri ekran ile 10 saniyelik gecikmenin birleşiminde. **Kanıt türü:** gerçek oyunda deney, fakat amaçlı tekrar-oynama gecikmesi; çok saatlik strateji inşaat timer’ı değil. Birleşik koşulun etkisini yalnız “bekleme”ye yüklememek gerekir. [DOI / yayıncı](https://doi.org/10.1145/3712281), [Üniversitenin araştırma duyurusu](https://www.kyushu-u.ac.jp/en/researches/view/379), [Araştırmacı grubunun açıklaması](https://app.ait.kyushu-u.ac.jp/topics/ethical-disengagement/). Makale Mart 2025; İngilizce basın duyurusu 2026. Yayıncı tam PDF erişimi 403 verdi; sonuçların ayrıntılı alt-grup tabloları kontrol edilmedi. Kurum kaynaklarında örneklem 84.324/84.325 diye bir kişi farklı yazıldığından burada yuvarlandı; birleşik koşuldaki kesin yüzdeler rapora önerilmiyor.

### Inferences

- **Her boşluğu yeni görevle doldurmayın:** İyi bir ayrılma anı, oyuncunun kendi başlattığı uçuşu/onarımı, dönüş zamanını ve döndüğünde ne kararı vereceğini anlaması olabilir. Bir sonraki seçimi değiştirmeyen tekrar toplama görevleri eklemek ayrı bir mikro yönetim maliyetidir. Bu, asenkron strateji için tasarım hipotezidir. [S7](https://eprints.whiterose.ac.uk/id/eprint/135461/1/BusyDoingNothingWhatDoPlayersDoInIdleGames.pdf), [S1](https://selfdeterminationtheory.org/SDT/documents/2006_RyanRigbyPrzybylski_MandE.pdf)
- **“Peak çok” teşhisi yalnız sayıdan konamaz:** Yeni araç kazanma, ilk gerçek keşif ve ana galaksiye sıçrama farklı düzeyde anlam taşıyabilir. Kritik denetim: Oyuncunun eylemine bağlanabilen ödül mü, arka arkaya kontrolünü kesen ekranlar mı? Ses/ekran hareketi/uyarı sayısı duygusal değerle eş tutulmamalı. [S6](https://findresearcher.sdu.dk/ws/files/195676326/p377_petersen.pdf)
- **Son metre görünürlüğü:** Nihai hedefe kalan koşulları göstermek yararlı bir adaydır; ancak gemi yüzdesi yakıt ve kaynak duvarlarını saklıyorsa oyuncunun algıladığı hedef mesafesiyle gerçek mesafe ayrılır. Bu, ilerleme araştırmasının Astera’ya çıkarımıdır; sadakat programı etkisinin oyunda aynen çıkacağı iddia edilmez. [S8](https://business.columbia.edu/sites/default/files-efs/pubfiles/1200/goalgradient.pdf)
- **Beklemeleri sınıflandırın:** Kaçınılabilir yükleme/kamera/UI gecikmesi; oyuncunun seçiminden doğan sonucu bekleme; zorunlu ilerleme kapısı aynı etiket altında toplanmamalı. Gecikme deneyini inşaat süresine doğrudan taşımak hatalı olur. [S9](https://doi.org/10.1145/3712281)

### Gaps

- Astera’da gerçek ara verme sebebi; sıkılma, anlaşılmaz hedef, kaynağı bekleme, sosyal hayat veya bilinçli offline plan arasında bu araştırmayla ayırt edilemez.
- Asenkron uzay stratejisinde ilk gün/saat için güvenilir, evrensel optimum timer uzunluğu bulunmadı. Belirli süre önerileri ürün hipotezi olarak etiketlenmeli.
- Bildirim izni alma veya streak eklemenin Astera’ya nedensel D1/D7 yararı bu kaynaklardan çıkmıyor. İlk dönüşün sonucunu hatırlatmak ile kayıp korkusuyla sık kontrol ettirmek ayrı tasarımlardır.

## Dopamin döngüsü hakkında ne söylenebilir ve Astera’da nasıl ölçülmeli?

### Takeaway

“Dopamin=haz”, “her sandıkta dopamin patlaması” veya “timer uzarsa ödül daha etkili” açıklamaları bu araştırmadan çıkarılamaz. Daha sağlam bir ürün dili; beklenti → anlamlı seçim → anlaşılır sonuç → değişen fırsat → yeni seçimdir. Bu zinciri davranış ve oyuncunun anlattığı deneyimle sınamak gerekir; beyin kimyası ölçülmüş gibi konuşmamak gerekir. [Schultz vd., 1997](https://www.gatsby.ucl.ac.uk/~dayan/papers/sdm97.html), [Berridge ve Robinson, 1998](https://pubmed.ncbi.nlm.nih.gov/9858756/)

### Cited Findings

**S10 — Schultz, Dayan ve Montague, Science 1997; A Neural Substrate of Prediction and Reward.** Primat dopamin nöronlarının etkinliği, beklenen ödülden sapmayı açıklayan öğrenme modelleriyle ilişkilendiriliyor; öğrenildikçe ödülü haber veren işaretin rolü öne çıkıyor. **Kanıt türü:** davranış/nörofizyoloji verisi ve hesaplamalı açıklama; oyun retention deneyi değil. Bu sonuç, sık rastgele ödülün her oyuncuyu memnun ettiği veya “pozitif sürpriz sayısı kadar dopamin” üretildiği anlamına gelmez. [Yazar sayfası ve özet](https://www.gatsby.ucl.ac.uk/~dayan/papers/sdm97.html), [Tam makale üniversite arşivi](https://web.math.princeton.edu/~sswang/fundamental-readings-for-Wang-lab-members/schultz_montague97_science.pdf), DOI: 10.1126/science.275.5306.1593.

**S11 — Berridge ve Robinson, 1998; dopamine / reward.** Araştırmacıların deney ve literatür değerlendirmesi, ödülü isteme/peşinden gitme ile tüketimden alınan hazzı ayırıyor. Dopamin işlevini yalnız haz olarak açıklamak hatalı. **Kanıt türü:** çoğunlukla hayvan deneyleri ve mekanizma sentezi; “insanların oyuna her dönüşü haz verir” demiyor. [Yayın özeti](https://pubmed.ncbi.nlm.nih.gov/9858756/), [Araştırmayı yürüten laboratuvarın açıklaması](https://sites.lsa.umich.edu/berridge-lab/research-overview/neuroscience-of-linking-and-wanting/), DOI: 10.1016/S0165-0173(98)00019-8.

**S12 — Gruber, Gelman ve Ranganath, Neuron 2014; curiosity / memory.** İnsanlarla trivia merakı ve bellek deneyinde merak edilen bilgi ve merak sırasında sunulan ilgisiz malzeme daha iyi hatırlandı; fMRI’da beklenti sırasında orta beyin, nucleus accumbens ve hipokampal bağlantılarla ilişkiler görüldü. **Kanıt türü:** laboratuvar bellek deneyi ve beyin görüntüleme; dopamin düzeyi doğrudan ölçülmedi, oyun geri dönüşü ölçülmedi. [UC Davis yazar tam metni](https://escholarship.org/content/qt2zd605r7/qt2zd605r7.pdf), DOI: 10.1016/j.neuron.2014.08.060. Arşiv ve nihai basımda gün farklı gösterildiğinden burada yalnız 2014 kullanıldı.

### Inferences

- **Merak denetimi:** Sonda göndermeden önce oyuncunun cevap beklediği bir sorusu var mı, rapor o soruyu cevaplayıp hedef kararını değiştiriyor mu? Öğretim sırası bir bilgi açığını açıp sonra kapatacak şekilde denenebilir. Bu öğrenme araştırmasından tasarım çıkarımıdır, ölçülmüş oyun retention etkisi değil. [S12](https://escholarship.org/content/qt2zd605r7/qt2zd605r7.pdf)
- **Her sonucu büyütmeyin:** Beklenti ve sonuç arasında tutarlı bir bağ kurulmalı; başarısızlık/maliyet saklanmamalı. Yeni bir parıltı eklemek kararın anlaşılmamasını onarmaz. Bu çıkarım nörokimyasal ölçüm iddiası içermez. [S10](https://www.gatsby.ucl.ac.uk/~dayan/papers/sdm97.html), [S11](https://pubmed.ncbi.nlm.nih.gov/9858756/)

**Rapor yazarına önerilen ölçüm ve denetim çerçevesi — aşağıdakiler Astera için test edilecek hipotezlerdir:**

| İncelenecek olay | Oyuncuya sorulacak soru / gözlenecek davranış | Ayrı kaydedilecek ölçü |
| --- | --- | --- |
| İlk gerçek eylem | “Bunu neden yaptın; şimdi ne değişti?” | İlk etkileşime kadar yükleme ve aktif süre; öğretim tıklaması ile gerçek karar ayrı |
| İlk rehbersiz benzer eylem | Aynı kontrolü ve gerekli bilgiyi yardımsız bulabiliyor mu? | Yardım açık/kapalı durumu, yanlış ekran dönüşleri, başarısız deneme |
| Zorunlu bekleme başlangıcı | “Şimdi başka ne yapabilirsin; kapatırsan ne olur?” | Kullanılabilir anlamlı seçenek sayısı, hedefsiz ekranda kalma, gerçek offline ayrılma |
| Aynı anda açılan özellik/ödüller | Hangi değişikliği fark etti, hangisini niçin kullanacak? | Eşzamanlı mesaj sayısı; kapatma → gerçek kullanım arasındaki süre |
| İlk dönüş | “Neyi merak ederek döndün?” | Tamamlanan sonuç okundu mu; sonuçtan sonra yeni karar var mı; aktif süre |
| Sıçramaya son koşul | “Ana galaksiye geçmek için tam olarak ne kaldı?” | Algılanan kalan koşullar ile sunucunun gerçek koşullarının farkı |
| D1/D7 | Geri geldi mi; ne yaptı? | Tüm yeni hesaplar/payda, rehber tamamlama koşuluna göre seçilim yapılmadan |

S1/S2/S6’nın yöntem sınırlamaları gereği; tutorial tamamlama, oturum süresi, gerçek geri dönüş, öğrenme, memnuniyet ve baskı hissini tek bir “engagement skoru”na sıkıştırmamak uygundur. Bir aşamada ayrılma oranı varsa o aşamanın nedeni ayrıca gözlemle sınanmalı; korelasyon teşhis için başlangıçtır. [S1](https://selfdeterminationtheory.org/SDT/documents/2006_RyanRigbyPrzybylski_MandE.pdf), [S2](https://grail.cs.washington.edu/projects/game-abtesting/chi2012/chi2012.pdf), [S6](https://findresearcher.sdu.dk/ws/files/195676326/p377_petersen.pdf)

### Gaps

- Astera’da dopamin, nörofizyoloji veya oyuncu memnuniyeti ölçülmedi. Kod/screenshot analizi bunların yerine geçmez.
- “Birden fazla peak kötüdür” ya da “her bekleme kötüdür” şeklinde evrensel bilimsel sonuç yok. Birikmiş dikkat yükü, anlamsız tekrar ve seçim eksikliği somut akış üstünde gösterilmeli.
- Bu dış araştırma yeni oyuncularla gerçek D1/D7 deneyi yapmadı; önerilerin yönü gerekçeli, etki büyüklüğü bilinmiyor.
- Yayıncı erişim engeli olan kaynaklarda yalnız erişilebilen yazar/kurum metni ve özet kadar iddia kuruldu. Sponsorlu pazarlama blogları veya doğrulanmamış sektör retention yüzdeleri kullanılmadı.
