# İlk 72 saatin davranış ve ölçüm tasarımı

Araştırma tarihi: 7 Kasım 2026. Bu notlar ürün değişikliği veya tamamlanmış kullanıcı araştırması değildir. Dış kaynaklardaki sonuçlar, güncel koddan doğrulanan ölçüm davranışları ve Astera için önerilen tasarım hipotezleri aşağıda ayrı tutulur. Kanıtlar web araması ve erişilebilen birincil metinlerden doğrulandı; önceki `tempo-rapor.md` araştırması güncellenerek kullanıldı. Doğrudan alıntı yoktur. Rapor yazarına: aşağıdaki kaynak özetlerinin her birini nihai raporda toplam 200 kelimenin altında tut; Astera tasarım önerilerini araştırmacıların bulgusu gibi sunma.

## Hangi psikoloji bulguları bu oyuna aktarılabilir?

### Takeaway

Astera'nın vaat ettiği his, “ödülü toplayan oyuncu”dan çok “bilgiye bakıp kararının sonucunu bekleyen komutan”dır. Araştırma; özerklik, yetkinlik, anlamlı farklı seçenekler ve gerçek sosyal bağları incelemek için iyi dayanaklar sunar. Buna karşılık ilk savaşın kaçıncı dakikada olması, ideal onarım süresi veya garantili retention artışı için bu kaynaklardan evrensel bir sayı çıkmaz. [Ryan vd.](https://selfdeterminationtheory.org/SDT/documents/2006_RyanRigbyPrzybylski_MandE.pdf), [Cardona-Rivera vd.](https://cdn.aaai.org/ojs/12716/12716-52-16233-1-2-20201228.pdf), [Park vd.](https://arxiv.org/pdf/1702.08005)

### Cited Findings

**R1 — SDT, Ryan, Rigby ve Przybylski, 2006.** Dört çalışma, laboratuvar oyunları ve çevrimiçi topluluğu kapsar. MMO çalışması 730 kişidir; ihtiyaç doyumu, keyif ve gelecekte oynama niyetiyle ilişkilidir. Özerklik, yetkinlik ve aidiyet birbirinin yerine geçmez. Laboratuvarda oyuna devam etmeyi gerçekten seçmek ile ankette gelecek oyun niyeti aynı ölçü değildir. **Kanıt:** çok çalışmalı birincil araştırma; ilişkiler ve bazı kontrollü karşılaştırmalar. **Sınır:** Astera'da bir görevi kaldırınca D1'in artacağını kanıtlamaz; MMO örneklemi büyük ölçüde erkektir. [Tam metin](https://selfdeterminationtheory.org/SDT/documents/2006_RyanRigbyPrzybylski_MandE.pdf), DOI 10.1007/s11031-006-9051-8.

**R2 — Tutorial tasarımı, Andersen vd., CHI 2012.** Üç oyunda sekiz tutorial tasarımı, 45.000'den fazla oyuncuyla karşılaştırıldı. Karmaşık Foldit'te tutorial bazı karşılaştırmalarda süreyi %29, ilerlemeyi %75 artırdı; daha basit oyunlarda aynı yarar yoktu. Oyuncu özgürlüğünü kısıtlamanın öğrenmeyi iyileştirdiğine destek bulunmadı. **Kanıt:** büyük saha deneyi; oyunlar arasında farklı sonuç. **Sınır:** süre/ilerleme artışı otomatik retention artışı değildir. Bu tur doğrudan PDF açılışı zaman aşımına uğradı; üniversitenin indekslenen tam metni ve önceki araştırmadaki erişim kullanıldı. [Üniversite metni](https://grail.cs.washington.edu/projects/game-abtesting/chi2012/chi2012.pdf), [resmî CHI programı](https://chi2012.acm.org/program/mobile/program.html).

**R3 — Flow, Larche ve Dixon, 2020.** 60 Candy Crush oyuncusu kolay, kendi düzeyine yakın ve zor bölümler oynadı. Kolay koşulda flow daha düşüktü; normal ile zor koşullar arasında basit bir tek tepe ilişkisi çıkmadı. Flow ve uyarılma sürdürme isteğiyle ilişkiliydi. **Kanıt:** kontrollü oturum çalışması. **Sınır:** gerçek D1/D7 ölçümü değil; “daha zor yaparsak daha iyi bağlanır” sonucu çıkmaz. [Tam metin](https://pmc.ncbi.nlm.nih.gov/articles/PMC8943660/), DOI 10.1556/jba-9-606.

**R4 — Merak ve bellek, Gruber, Gelman ve Ranganath, 2014.** Trivia soruları ve fMRI ile merak edilen bilgi ve o sırada görülen ilgisiz malzemenin belleği incelendi. Yüksek merak koşulunda hemen ve bir gün sonra bellek daha iyiydi; beklenti sırasında bazı ödül/bellek bölgelerinde ilişkiler görüldü. **Kanıt:** insan laboratuvar öğrenme deneyi. **Sınır:** dopamin miktarı doğrudan ölçülmedi; oyuncuların tekrar giriş yapması incelenmedi. [Yazar tam metni](https://escholarship.org/content/qt2zd605r7/qt2zd605r7.pdf), DOI 10.1016/j.neuron.2014.08.060.

**R5 — Goal gradient, Kivetz, Urminsky ve Zheng, 2006.** Kafe sadakat ve çevrimiçi ödül programlarında hedefe yaklaşma ile çaba/ziyaret hızlanması incelendi; deneysel ilerleme çerçevesi de kullanıldı. **Kanıt:** saha gözlemleri ve deneyler. **Sınır:** oyun çalışması değildir; geminin %80'ini onarmanın sürenin veya masrafın %80'i olduğu anlamına gelmez. Yanıltıcı ilerleme göstergesi tasarlamak için gerekçe sunmaz. [Yazarların tam metni](https://business.columbia.edu/sites/default/files-efs/pubfiles/1200/goalgradient.pdf), DOI 10.1509/jmkr.43.1.39.

**R6 — Psychological ownership, Pierce, Kostova ve Dirks, 2001.** Yazarlar yasal mülkiyetten ayrı, bir hedefi “benim” hissetme durumunu tanımlayan kuramsal çerçeve geliştirir. **Kanıt:** kuramsal makale; yeni oyun deneyi veya retention testi değil. **Sınır/erişim:** yayıncı ve üniversite taslak PDF'i bu tur 403 verdi; üniversitenin makale özeti ile yazarın açıklaması erişilebilir biçimde indekslendi. Kontrol, emek ve tanıma üzerinden gemi sahiplenmesini tasarlamak bir Astera hipotezidir. [Yazarın üniversite kaydı](https://experts.umn.edu/en/publications/toward-a-theory-of-psychological-ownership-in-organizations/), DOI 10.5465/amr.2001.4378028; [yazarın üniversite yayını](https://lsbe.d.umn.edu/sites/lsbe.d.umn.edu/files/2023-05/margins1209.pdf).

**R7 — Gerçek sosyal bağların sürekliliği, Shen, Monge ve Williams, 2014.** EverQuest II'nin bir PvE sunucusunda 13 haftalık davranış kayıtları incelendi. Analiz, tüm dönem boyunca aktif kalan 1.442 oyuncuya dayanır; 19.384 ilişki incelenmiştir. Ortak lonca, benzer düzey ve coğrafi yakınlık bağların sürmesiyle ilişkiliydi. **Kanıt:** boylamsal log analizi. **Sınır:** bütün dönem aktif kalma koşulu önemli seçilimdir; “loncaya sokmak retention'ı artırır” deneysel sonucu değildir. Tek karşılaşmanın sosyal bağ olduğu da varsayılamaz. [Yazar tam metni](https://dmitriwilliams.com/wp-content/uploads/2020/06/evolution.pdf), DOI 10.1002/asi.23129.

**R8 — İlerleme ve arkadaşlık, Park vd., WWW Companion 2017.** Fairyland Online'da 51.104 kişinin logları üzerinden farklı oyuncu düzeylerinde kalıcılık göstergeleri karşılaştırıldı. Başarı/ilerleme erken ve orta aşamalarda önemliydi; en üst düzeyde sosyal özellikler daha güçlü öngördürücülerdi. **Kanıt:** gözlemsel davranış verisi ve modelleme. **Sınır:** yazarların “natural experiment” ifadesi rastgele özellik ataması değildir; arkadaşlık devam etmeye neden olmuş olabilir, devam edenler arkadaş edinmiş de olabilir. [Tam metin](https://arxiv.org/pdf/1702.08005), DOI 10.1145/3041021.3054176.

**R9 — Anlamlı seçim, Cardona-Rivera vd., AIIDE 2014.** 88 kişi kısa etkileşimli anlatı oynadı. Farklı durumlara götüren seçimler bazı agency ölçeklerinde daha yüksek özbildirim aldı. Tüm ölçeklerde aynı doğrulama çıkmadı; değerlendirmeler seçimlerden sonra geriye dönüktü. **Kanıt:** tekrarlı ölçüm deney; önceden öngörülen sonuç farkına ilişkin destek. **Sınır:** strateji ekonomisi, savaş ve D1 incelenmedi; belirli seçenek sayısı için kural sunmaz. [Yayıncı PDF](https://cdn.aaai.org/ojs/12716/12716-52-16233-1-2-20201228.pdf), DOI 10.1609/aiide.v10i1.12716.

**R10 — Deneyerek öğrenme ve başarısızlık, Kapur, 2008.** 309 lise öğrencisi 103 üçlü gruba ayrılıp fizik problemlerini farklı yapılandırma koşullarında çözdü. İlk aşamada daha çok zorlanan gruplar sonraki bireysel yakın/uzak transfer ölçülerinde daha iyi performans gösterdi. **Kanıt:** eğitim alanında rastgele deney. **Sınır:** fizik öğrenimi, belirli okul/kültür bağlamı; gemisini kaybeden mobil oyuncunun kalacağını göstermez. Oyuncuyu bilerek kaybettirme zorunluluğu çıkarılamaz. [Üniversite tam metni](https://arch.kuleuven.be/studeren/tall/artikels/productive-failure-kapur.pdf/@@download/file/Productive%20Failure%20Kapur.pdf), DOI 10.1080/07370000802212669.

**R11 — Kayıp ve risk, Kahneman ve Tversky, 1979.** Kazanç/kayıp çerçevesindeki tercihler ve olasılık ağırlıkları üzerinden prospect theory geliştirildi. Dayanaklar arasında öğrenciler ve öğretim üyelerine verilen varsayımsal para tercihi problemleri vardır; örneklem problemden probleme değişir. **Kanıt:** tercihler ve açıklayıcı model. **Sınır:** kaybın oyuncuyu mutlaka daha çok bağlayacağı, kayıpların “tam iki kat” etkili olduğu veya bir onarım beklemesinin optimum uzunluğu sonucu çıkmaz. [MIT'deki tam metin](https://web.mit.edu/curhan/www/docs/Articles/15341_Readings/Behavioral_Decision_Theory/Kahneman_Tversky_1979_Prospect_theory.pdf), DOI 10.2307/1914185.

**R12 — Sistem aktörleri ve güven, Upadhyaya ve Galizzi, 2023.** Ön kayıtlı çevrimiçi deneyde N=539 kişi tek seferlik ikili Trust Game oynadı. İnsan eş olduğu söylenen koşulda karşılık verme %58, otomatik eş koşulunda %42 idi. Deneyde aldatma yoktu. **Kanıt:** karşı taraf kimliğinin davranışı etkilediği deney. **Sınır:** MMO, uzun ilişki veya gizli aktörün sonradan keşfi çalışılmadı; otomasyonu saklamanın güveni koruduğu sonucu çıkarılamaz. [Yayıncı tam metni](https://www.frontiersin.org/journals/behavioral-economics/articles/10.3389/frbhe.2023.1164259/full).

**R13 — Progressive disclosure ve geri çağrılabilir yardım, Apple.** Resmî tasarım rehberi; ana döngüyü öğretmeyi, ihtiyaç anında kısa dersleri, rehbersiz denemeyi ve atlama seçeneğini önerir. İkincil izin/puanlama isteklerini ilk hedeften sonraya bırakır; sonradan yardım tekrarına yer verir. **Kanıt:** platform tasarım rehberi. **Sınır:** kontrollü retention araştırması veya Astera'ya ait oran değil. Aynı sayfadaki günlük ödül tavsiyeleri kullanıcının FOMO karşıtı vizyonunu geçersiz kılmaz. [Resmî rehber](https://developer.apple.com/app-store/onboarding-for-games/).

**R14 — İlk deneyimde uyarılma her zaman keyif değildir, Petersen vd., 2017.** 28 katılımcı, üç mobil oyun; video, fizyoloji ve görüşme birleştirildi. Otomatik savaşta bekleme bazı oyuncularda sıkıntı yarattı; yüksek uyarılmanın rahatsızlık kaynaklı olabildiği görüldü. **Kanıt:** küçük karma yöntemli çalışma. **Sınır:** kalp atışı/peak sayısı eğlence veya D1 yerine geçmez. [Tam metin](https://findresearcher.sdu.dk/ws/files/195676326/p377_petersen.pdf), DOI 10.1145/3116595.3125499.

**R15 — Çevrimdışı katılım, Cutting, Gundry ve Cairns, 2019.** Neko Atsume'da 1.972 kişilik kesitsel ankette idle oyuna bağlılık ve farklı katılım biçimleri incelendi. **Kanıt:** özbildirimli anket, tek oyun. **Sınır:** timer koymanın bağlılık yarattığı deneysel olarak gösterilmez; sürekli immersion/ekran süresi asenkron deneyimi tek başına açıklamaz. [Tam metin](https://eprints.whiterose.ac.uk/id/eprint/135461/1/BusyDoingNothingWhatDoPlayersDoInIdleGames.pdf), DOI 10.1016/j.ijhcs.2018.09.006.

**R16 — İçsel/dışsal motivasyon, Deci, Koestner ve Ryan, 1999.** 128 deneylik meta-analiz bazı beklenen somut ve tamamlamaya bağlanan ödüllerin sonraki serbest seçim motivasyonunu azaltabildiğini, olumlu geri bildirimin farklı sonuç verdiğini gösterir. **Kanıt:** meta-analiz; koşula duyarlı sonuç. **Sınır:** harcanabilir kaynak/araç kazanmakla zaten ilginç faaliyete dışarıdan ödül vermek aynı işlem değildir; “kasaları kaldır” sonucu yoktur. PDF bu tur metne ayrılmadı; önceki araştırmanın doğrulanmış temel özetiyle sınırlı kalındı, alt grup istatistiği kullanılmamalı. [Yazar PDF'i](https://selfdeterminationtheory.org/wp-content/uploads/2014/04/1999_DeciKoestnerRyan_Meta.pdf), DOI 10.1037/0033-2909.125.6.627.

**R17/R18 — Dopaminin sınırları.** Schultz, Dayan ve Montague'nin 1997 çalışması ödül tahmin hatası/öğrenme mekanizmasını; Berridge ve Robinson'un 1998 sentezi isteme ile haz ayrımını tartışır. Bunlar Astera oyuncularında ölçülmüş nörokimya veya ödül sıklığı formülü değildir. [Schultz vd. yazar sayfası](https://www.gatsby.ucl.ac.uk/~dayan/papers/sdm97.html), [Berridge ve Robinson özeti](https://pubmed.ncbi.nlm.nih.gov/9858756/).

### Inferences

**Bütün maddeler aşağıda Astera tasarım hipotezidir; bilimsel makalelerin Astera sonucu değildir.**

| Kavram | Tasarımda karşılığı | Kaçınılacak yanlış aktarım | Nasıl sınanır? |
| --- | --- | --- | --- |
| Özerklik | Gerekli bilgiden sonra en az iki uygulanabilir hedef; öneriyi reddetme ve yardım isteme | İki düğmenin aynı sonuca çıkmasını seçim saymak | Oyuncu seçmediği yolun farkını anlatabilir mi? |
| Yetkinlik | Uçuştan önce beklenen maliyeti kurmak, sonuçta beklentiyle karşılaştırmak | Garanti zafer, ücretsiz otomatik tamamlama | Benzer ikinci kararı işaretsiz verebilir mi? |
| Aidiyet | Aynı gerçek komutanla yeniden karşılaşma ve isteğe bağlı karşılıklı iletişim | Kalabalık sahneyi arkadaşlık sanmak | Tekrar iki taraflı insan etkileşimi; moderasyon yükü |
| Flow | Anlık kararların anlaşılır zorluğu, yeni kuralı ihtiyaç anında verme | Tüm beklemeyi aksiyonla doldurmak | Sıkılma ve anlaşılmama ayrı görüşülür |
| Merak | Sondadan önce gerçek soru: burada ne var, hangi rota daha iyi? | Cevabı açmak için anlamsız tıklama | Rapordaki bilgi sonraki seçimi değiştirdi mi? |
| Beklenti | Kendi gönderdiği uçuş, dönüş zamanı ve dönüşte seçilecek yeni hamle | Dönmezse kaybetme tehdidiyle çağırmak | Dönüş nedenini kendisi söyleyebiliyor mu? |
| Goal gradient | Tamamlanan sistemler ve kalan gerçek koşullar | %95 onarımın son dakika engellerini saklaması | Algılanan kalan koşulla gerçek koşul karşılaştırılır |
| Sahiplenme | Görünür onarım izi, kendi gemi adı/öncelikleri, kalıcı seyir kaydı | Sadece isim yazdırmak; sonra hepsini sessizce silmek | “Ben neyi değiştirdim?” serbest anlatımı |
| Sosyal kimlik | Gerçek kişiyle ortak geçmiş; taşınabilir komutan kimliği | Zorunlu lonca görevi ve sahte sosyal talep | Sıra görevi olmadan yeniden temas |
| Kayıp/toparlanma | Tahmin edilebilir küçük risk; anlaşılır rapor; erişilebilir yeniden deneme | Öğretmek için zorunlu yenilgi; sınırsız tazminat | Kayıptan sonraki anlamlı eylem ve süre |
| Progressive disclosure | İki bilgi katmanı: karar yüzeyi ve isteğe bağlı kural detayı | Her alanı sırayla kilitleyip açmayı disclosure saymak | Yeni kavramın ilk karar öncesi bulunabilirliği |
| Deneyerek öğrenme | Tahmin→taahhüt→gerçek sonuç→kendi ikinci hamlesi | Sadece ışıklı yere dokunmayı öğrenme saymak | Yeni örnekte yardım almadan aktarım |
| İçsel motivasyon | Yeni araç, daha iyi istihbarat ve seçilen hedefin sonucu | Her davranışa kasa, her dakikaya konfeti | Ödül kutusu olmadan ikinci döngü isteği |

**Geri dönüşün sağlıklı birimi:** “Bir iş bitiyor”dan daha güçlü öneri, “Verdiğim kararın sonucunu göreceğim ve değişen bilgiyle yeni karar vereceğim.” İlk 30 dakikada savaş şart değildir. Hareket/sonda bilgisini kullanıp iki uygun maden hedefini karşılaştırmak, gerçek bir aracı göndermek, sonucu görmek ve ikinci hedefi bağımsız seçmek aynı omurgayı taşıyabilir. Yalnız görev için belirlenmiş tek kayayı seçmek ise seçenek yokluğunu gizler.

**Kontrollü aktörler için tasarım sınırı:** Mevcut ürün kilidi korunur: istemciye otomasyon işareti ve oyuncuya görünen bot ifadesi eklenmez. Araştırma bu kilidi onaylayan bir aldatma reçetesi sunmuyor. Güveni, aktörlerin ortak kurallara uyması, kaynak/filo/savaş sonuçlarının gerçek olması, aşırı doğaüstü tepkilerin olmaması ve insan ilişkilerinin simülasyonla ikame edilmemesi üzerinden korumayı öneriyorum. Sahte kişisel sohbet, sahte dostluk talebi, gerçek kişi sayısı hakkında yanlış beyan ve satın alma baskısı üreten rakip davranışı bu tasarımın araçları değildir. Görsel trafik, insan aidiyeti metriği sayılmamalı.

### Gaps

- Asenkron mobil 4X için bütün kavramları, ilk 72 saati ve D7'yi birlikte test eden tek güçlü deney bulunmadı. Kaynakları “bilim bu akışı kanıtladı” diye birleştirmek doğru değil.
- Astera'da öğrenme, sıkılma, kayıp korkusu veya geri dönüş nedeni yeni oyuncularla bu çalışmada ölçülmedi.
- Optimum ilk savaş dakikası, ideal aktör yoğunluğu ve sıçrama yaşı bilinmiyor. Bunlar ürün prototipi ve saha ölçümüyle seçilmeli.
- Psychological ownership makalesinin tam metni ve meta-analizin alt grup tabloları bu tur okunamadı; sonuçların kapsamı yukarıdaki sınırları aşmamalı.

## İlk 30 dakika ve sonraki oturumlar nasıl bir deneyim oluşturmalı?

### Takeaway

Önerilen konsept: **“Kurtardığın gemiyle çevreni okumayı öğren; kendi fırsatını seç; değişen dünyaya geri dön.”** Onarım, bağımsız bir görev merdiveni yerine bu maceranın kapasite açan kolu olur. İlk keşif, ilk kaynak kararı, ilk risk ve ilk sosyal karşılaşma aynı önem düzeyinde sunulmamalı. Aşağıdaki saatler mevcut oyunda doğrulanmış gerçekleşme süreleri değil, prototipte sınanacak ritim aralıklarıdır.

### Cited Findings

- Güncel ürün vizyonu bilgi→fırsat→risk→uçuş→sonuç döngüsünü savunuyor. Aynı dokümanda eski altı dakikalık ilk taahhüt beklentisi ve starter'a özgü 20–25 dakika ilk oturum hedefi birlikte bulunuyor; yeni owner talimatının ilk 30 dakikayı önceliklendirmesi bu çelişkiyi tasarımda açıkça çözmeyi gerektiriyor. [product-vision.md](/home/yildirim/Desktop/Coding/MyProjects/blindspace/docs/product-vision.md:122), [CLAUDE.md](/home/yildirim/Desktop/Coding/MyProjects/blindspace/CLAUDE.md:20)
- İlk probe/mine döngüsünün ilk 30 dakikaya sığma olasılığıyla ilk saldırının mevcut savaş raporu kapısı ayrı tutulmalı; hardgate ayrıntılarının birincil kanıtı sistem araştırması notlarıdır. İlk30 savaş burada mevcut özellik gibi iddia edilmez. [sistemler_72saat.md](/home/yildirim/Desktop/Coding/MyProjects/blindspace/research_notes/Yeni%20oyuncunun%20ilk%2072%20saati/sistemler_72saat.md)
- Kısa rehberlik sonrası bağımsız uygulama önerisi resmî tasarım rehberinde var; bunun sabit 30 saniye/dakika eşiği yok. [Apple](https://developer.apple.com/app-store/onboarding-for-games/)

### Inferences

**Aşağıdaki tasarımın ürün kararı gerektiren parçaları onay bekleyen adaylardır.** İlk soru, altyapının izin verdiği bir eylemi oyuncunun kendi amacı hâline getirmek. İlk 30 dakikada üretilen değer, kaç sekme tanıtıldığı değil, oyuncunun ilk bağımsız ikinci döngüsüdür.

| Ritim | Oyuncunun zihnindeki soru | Deneyim ve seçenek | Sonuç / öğrenme | Erken çıkışta devam |
| --- | --- | --- | --- | --- |
| 0–30 sn | Burada ne var, buna dokunursam ne olur? | Mevcut prologda anlamlı tek fiziksel eylem; çevre cevabı, geminin kurtarılabilir silueti | Eylem→dünya değişimi; sahiplenme tohumu | Yeni girişte son gerçek duruma dön; tüm prologu yeniden zorunlu oynatma |
| 30 sn–2 dk | Bu benim gemim mi? | Gerçek hasar ve çalışan ilk sistem; uzun hedefin basit gemi→yakıt→ana galaksi izi | Sahiplenme; ilerlemenin görsel ölçütü | İlk güvenli eylem saklanır; kimlik/claim hatasında kayıp hissi doğmaz |
| 2–5 dk | Hangi fırsata hazırlanıyorum? | İşe yarayan ilk onarım; oyuncu incelemek istediği görünür nesneyi seçebilir, yardımı açabilir/kapatabilir | Kapasite açılması ile amacının bağı | Onarım bitişi ve dönüşteki fırsat adı görünür; büyük sahne yokluğunda durum anlaşılır |
| 5–10 dk | Bilmeden mi göndereceğim? | Kontrolleri öğrendikten sonra ilk küçük bağımsız karar; hazır iki uygun hedefin maliyet/mesafe/bilgi farkı | Görev okuma yerine öngörü kurma | Emir yoksa fırsat saklanır; emir varsa sunucu saati işler |
| 10–20 dk | Bilgiye göre neyi seçtim, araçlarım nereye gidiyor? | Gerçek sonda/maden uçuşunu izleme veya serbest inceleme; ikinci hedefe bakma; beklerken oyundan çıkma da geçerli | Uçuşun maliyeti, zamanı, gözlenebilirliği | Sadece kaldığı rehber satırı değil pending uçuş ve gerçek rapor geri yüklenir |
| 20–30 dk | Seçimim işe yaradı mı; şimdi ne yapardım? | Gerçek rapor/haul, beklentiyle karşılaştırma, işaretsiz ikinci hedef seçimi; isterse ilk riskli fırsatı inceleme | İlk tam döngü ve yetkinlik; ilk küçük başarı | Dönüşte önce sonucu göster, sonra seçenek; modal zinciri kurma |

Bu aralıkları tutturmak adına normal oyuncunun durumunu geri sarmak, sahte sonuç göstermek veya uçuşu erken tamamlamak tasarımın parçası değildir. Minimum kapasite açılışı mevcut hardgate'lerden çıkarılıp örnek gerçek akışla prototiplenmeli. Sonda ile madenin sırası farklılaşabilir. Oyuncu zaten iyi karar veriyorsa yardım daha erken çekilir; “üç kutuyu onaylamadın” diye ilerleme kesilmez.

**Her önemli an için kullanılacak deneyim sözleşmesi:**

1. Oyuncunun gördüğü değişiklik gerçek bir durum farkını temsil eder.
2. Sonraki eylem, önceki seçimden doğan fırsat veya soru taşır.
3. Oyuncunun yapmayabileceği eylem vardır; reddetmek akışı bozmamalı.
4. En az bir sonuç sonraki kararı değiştirir: zaman, kaynak bileşimi, filo mevcudu, bilgi tazeliği veya rakibin görünür davranışı.
5. Hata durumunda kayıp/masraf bilinir; erişilebilir toparlanma yolu bulunur.
6. Görsel anlatım atlandığında veya uygulama arka plandayken durum ve sonuç aynı kalır.

**İlk gönüllü risk:** İlk saldırıyı ana döngünün zorunlu sınavı yapmıyorum. Önce bilgiye dayalı maden seçimi bu omurgayı göstermeli. Sonra mevcut savaş kapısı yeniden düzenlenecekse, oyuncunun isteyerek değerlendirdiği düşük riskli bir fırsat açılabilir. Beklenen maliyet; evde kalan savunma, gidiş/dönüş ve bilinen rakip bileşimi üzerinden açıklanır. Kesin kazanma yüzdesi veya garantili başarı verilmez. Pas geçmek meşru stratejidir. Riskin azlığı, sonucun sahte olması anlamına gelmez.

**İlk tehdit:** Algılama ve en az bir tepki seçeneği henüz yokken oyuncuyu kayba uğratmak yerine, önce hareketi fark ettirecek fırsat sunulur. Bir savunma, bekletme veya başka hedefe yönelme kararı gerçekten sonucu değiştirmeli. Gerçek oyuncunun uçuşu bu hazır olma çerçevesine uymazsa sunucu koruması hüküm sürer; sunum gizlice saldırıyı durdurmaz. “Rakip karşılık verdi” ifadesi ancak önceki oyuncu eylemine gerçekten bağlı olay için kullanılır.

**Oturumlar arasındaki psikolojik yay:**

| Pencere | Oynama nedeni | Kapatırken beklenti | Dönüşte görülecek | Kendi sonraki hamlesi |
| --- | --- | --- | --- | --- |
| İlk oturum | Benim kurtardığım gemiyle bir fırsatı çözüyorum | Seçtiğim gerçek uçuş/onarım ve cevaplanacak soru | Sonuç, nereden geldiği ve açtığı kapasite | Yeni hedefi kendim seçmek |
| İlk dönüş / birkaç saat | Önceki tahminimle gerçek sonucu karşılaştıracağım | Takip ettiğim komutanın hareketi veya seçtiğim hazırlık | En fazla bir öncelikli sonuç; kalanlar seyir kaydında | Bilgiyi güncellemek, yeni kapasiteyi kullanmak |
| ~24 saat | Bölgeyi tanıyorum, planım var | Motor hazırlığına katkı sağlayan kendi rota/filo planım | Kaynakların nereden geldiği, anlamlı dünya değişimi, uygun fırsat | Bütçeye göre onarım, keşif veya risk |
| ~48 saat | Burada yalnız değilim, ilk tercihlerimin izi var | Bir komutanla tekrar temas veya seçilmiş keşif | Gerçek karşılaşmanın sonucu; tepki seçeneği | İlgilendiğim hedefe odaklanma veya sıçrama hazırlığı |
| ~72 saat | Ana galakside ne yapmak istediğimi biliyorum | Kendi amaçladığım sonraki adım | Hazırsa sıçrama; hazır değilse açık kalan koşul | Sıçrama / hazırlığı sürdürme; zorunlu takvim cezası yok |

Yukarıdaki günler kilit değildir. Oyuncu 24 saatte hazırsa 72 saate kadar tutulmaz; 72 saatte geri dönen oyuncu öğretim cezası veya birikmiş saldırı duvarı yaşamaz. Öğrenmeyi ölçmek, bilgi sınavıyla göçü engellemekten ayrıdır. Göçün yetki koşulları gerçek gemi/yakıt/filo/sezon koşulları olarak kalmalı; “şu üç düğmeye bağımsız bastığını kanıtla” yeni kapısına dönmemeli.

**Farklı hızlar için aynı dünyanın farklı desteği:**

| Oyuncu | Erken gösterilecek fayda | Yardım ve tempo | Dikkat edilecek başarısızlık |
| --- | --- | --- | --- |
| Deneyimli hızlı | Hedefin maliyet/mesafe/bilgi kıyası | Yardımı kapat; bildiği kontrolleri tekrar onaylatma | Sırf tutorial harcama rezervi için bütün ekonomiyi kilitleme |
| İlk 4X deneyimi | Tek anlamlı karşılaştırma, geri çağrılabilir kural | İsteğe bağlı el/öneri; yeni nesnede bir kısa hatırlatma | Boş “serbestsin” ekranı, açıklanmayan geri dönülmez emir |
| Keşif/gelişim | Çevre bilgisi onarım tercihini değiştirir | Savaşsız anlamlı ilk döngü | Saldırı tamamlamadan büyüyememe |
| PvP meraklısı | Görünür rakip ve gerçek risk bilgisi | İlk düşük riskten sonra daha erken bağımsız hedefleme adayı | Acemi hedefleri ezme veya korumayı exploit etme |
| Kısa mobil oturum | Bir sonraki kararı hazırlayan 1–2 hamle | Uçuş sürerken ayrılma; dönüşte net sonuç | 15 dakika kesintisiz ekranda kalmayı yeterlilik saymak |
| Kayıptan kolay vazgeçen | Sonucun sebebi, kalan kapasite ve yeniden deneme | Opsiyonel güvenli maden/onarım yolu | Tüm filoyu kaybedince yalnız saatlerce üretim bekleme |

**Sahiplik ve ana galaksiye devam:** Kurtarılan geminin tamamen geçici eğitim oyuncağı gibi hissetmesini önlemek için ekonomik taşıma limitleri dürüstçe gösterilmeli. Taşınan komutan adı, gemi geçmişi ve ilk keşif/karar izi gibi ekonomi bozmayan süreklilik adayları değerlendirilmeli. Bunlar yeni kalıcı kozmetik ödül sistemi açmak zorunda değildir; mevcut seyir kaydı ve kimlik yüzeylerinden başlanabilir. Taşınmayan araştırmanın starter içinde ne işe yaradığı o karar sırasında anlaşılmalıdır.

**Owner'a üç karar; teknik ayrıntı değil deneyimin yönü:**

| Soru | Adaylar | Önerim ve gerekçe |
| --- | --- | --- |
| İlk çatışmanın başlangıcı | Oyuncunun seçtiği fırsat / önce görünür tehdit / iki koşula göre karma | Önce gönüllü fırsat, tehdit algılama ve tepki kapasitesinden sonra. İlk riskin kendi kararı olması öğrenmeyi açıklamayı kolaylaştırır; savaşsız ilk döngüyü geçersiz kılmaz. |
| Harcama koruması ne zaman çekilsin? | İlk kontrol öğretisi sonrası / ilk tam döngü sonrası / oyuncunun yardım tercihi | İlk temel harcama gösteriminden sonra önerilen rezerv + açık maliyet bilgisi; zorunlu korumayı dar tut. Yanlış harcamada toparlanma tasarımı gerekiyor; korumayı erken kaldırmak tek başına çözüm değil. |
| Sıçrama neyi temsil etsin? | Hazır olur olmaz ilk gün mümkün / 48–72 saat hedefli uzun hazırlık / mevcut süreler | Gerçek hazırlık koşullarını karşılayınca mümkün; 24–72 saat başlangıç test penceresi. Geçişin öğrenmeyi kutlaması güzel, takvim veya sınavla yeterliliği ispat ettirmesi gereksiz. İlk veri gelmeden evrensel saat yok. |

### Gaps

- İlk30 akışında hangi minimum onarımların zorunlu olduğu, iki uygun hedefin her coğrafyada bulunup bulunmadığı ve shared supply rekabetinde ne sıklıkla hedefin kaçtığı canlı telemetriyle ölçülmedi. Sistem notları kod koşullarını verir; insandaki anlaşılabilirliği vermez.
- Oyuncu tipleri sabit kimlik veya otomatik etiket değildir. Kişi aynı gün keşif ve PvP isteyebilir; davranışa göre yardım azaltmak risk/ödülünü gizlice değiştirmek anlamına gelmemeli.
- Düşük yoğunlukta aynı gerçek oyuncuyla tekrar karşılaşmayı garanti edemeyiz. Sistem aktörünün doğal davranışı bunu telafi edebilir ama gerçek ilişki yerine sayılamaz.

## Başarı, öğrenme ve gönüllü dönüş nasıl ölçülmeli?

### Takeaway

Mevcut analytics altyapısı niyet, sunucu gerçeği ve görülen sonuç ayrımının bir bölümünü zaten destekliyor; yeniden icat edilmemeli. Ancak mevcut starter funnel sahne görünümlerini topluyor ve mevcut retention ilk gözlenen `game_ready`ye ankrajlanıyor. Yeni tasarımın bağımsız karar, dal fırsatı, gerçek sonuç ve tüm yeni hesap dönüşü soruları için metrik sözleşmesi tamamlanmalı. [analyticsSchemas.ts](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/api/analyticsSchemas.ts:3), [starterFunnel.ts](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/services/starterFunnel.ts:24), [analyticsCohorts.ts](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/services/analyticsCohorts.ts:9)

### Cited Findings

- Client allowlist'inde `training_*`, `command_attempted/blocked/result`, `surface_visible`, `outcome_visible`, `network_recovered`, `performance_summary` ve `vessel_first_probe_sent/received`, `vessel_first_mine`, `vessel_first_battle/pvp`, migration olayları bulunuyor. Bunların şeması `client_observation`; isim tek başına sunucu tarafından doğrulanmış başarı demek değil. Property sözlüğü strict Zod, sınırlı kod alanları var; serbest form/sohbet metni taşımaz. [analyticsSchemas.ts](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/api/analyticsSchemas.ts:6)
- Rehberi atlama mevcut `training_exit_requested`, `trainingVersion: starter-tutorial.v1`, `code: skipped` ile kaydediliyor. `training_skipped` adlı yeni bir olay mevcutmuş gibi rapor yazılmamalı. [StarterTutorialCoach.tsx](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/starter/tutorial/StarterTutorialCoach.tsx:307)
- Genel sunucu analitiği `account_created`, `authenticated_existing`, `placement_completed/failed`, `command_accepted` olgularını yalnız işlem sonrasında kuyruğa koyuyor. Otomatik aktör hesaplarını içerde ayırıp hariç tutuyor; istemciye işaret taşımıyor. [analyticsServerFacts.ts](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/services/analyticsServerFacts.ts:10), [aynı dosya](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/services/analyticsServerFacts.ts:85)
- Değişmez normal oyun emirlerinden geri kazanılan analitik ve idempotent kimlikler var. `ready_at` tek başına tamamlanma kanıtı sayılmıyor; inbox kaydı sonucu gördüğünün kanıtı sayılmıyor. Sorgu normal `build_orders`, `research_orders`, `mining_runs`, `missions` vb. tabloları kapsar; starter'ın özgün tablolarıyla hangi olguların kapsandığı ayrıca kontrol edilmelidir. [analyticsFacts.ts](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/services/analyticsFacts.ts:9), [tamamlanma](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/services/analyticsFacts.ts:46), [inbox](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/services/analyticsFacts.ts:81)
- Mevcut D1/D3/D7, saklanan geçmişteki ilk `game_ready` ankrajından sonra `[24,48)`, `[72,96)`, `[168,192)` saat pencereleriyle ve daha sonraki oturum koşuluyla hesaplanıyor. Oturum numarası için ardışık uygun olaylar arasında en az 30 dakika aranıyor. Dolayısıyla hiç `game_ready` görmeyen yeni hesaplar bu retention paydasında yok; bu ölçü “tüm yeni hesap D1” diye adlandırılmamalı. [analyticsCohorts.ts](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/services/analyticsCohorts.ts:9)
- Starter funnel'da `STARTER_TUTORIAL_STEPS` sırasındaki sahne görünürlüklerinin toplam hesap sayıları karşılaştırılıp `dropoff=max(0,previous-current)` üretiliyor. Dallanmalı serbest yol, rehber atlama ve farklı sırada gelen sahnelerde bu bir nedensel terk oranı değildir. İkinci oturuma dönmüş olma da burada `foreground_started` görülen distinct session sayısından türetiliyor; D1 ile aynı şey değil. [starterFunnel.ts](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/services/starterFunnel.ts:14)
- Foreground süresi ile son etkileşimlerin kapsadığı süre ayrı tutuluyor. Süre ölçümü bir anda gelen dev heartbeat'e sınırsız süre yazmıyor; son etkileşim için 60 saniyelik aralık genişletiliyor. Bu yüzden “interactionMs=gerçek düşünme süresi” iddiası kurulamaz. [client.ts](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/lib/playerAnalytics/client.ts:111)
- Backend araştırmasının çapraz kontrolü: starter route'undaki `queueServerAnalytics`, göçte `placement_completed` yazıyor; genel analytics recovery sorguları `vessel_orders`/starter mission/notification tablolarını kapsamıyor. Client `vesselMilestones` yerel depolama farklarından kilometre taşı çıkarıyor; cihazlar arası tekillik kanıtı değil. `migration_started` mutation denemesiyle tetiklenebilir; göç olgusunu canonical migration kaydıyla ölçmek gerekir. Ayrıca boş maden dönüşü de `FIRST_MINING_RETURN` fact'ini yazabilir; bunu pozitif kaynaklı ilk haul sanmamalı. Kaynak satırları ve kesin akış [sistem araştırması notlarında](/home/yildirim/Desktop/Coding/MyProjects/blindspace/research_notes/Yeni%20oyuncunun%20ilk%2072%20saati/sistemler_72saat.md) doğrulanmıştır; nihai rapor yazarı o notlardaki dosya bağlantılarını kullanmalı.

### Inferences

**Önerilen metrik sözleşmesi; aşağıdaki yeni kayıtlar henüz uygulanmadı.** Mevcut isimleri gereksiz çoğaltmadan durum/sonuç kimliklerini ilişkilendir. Şema sözlüğü ve server fact üreticisi tek PR'da uyumlu güncellenmeli. Tasarım sürümü ayrı alan veya kontrollü `variant` ile tutulmalı; olayları metin içeriğinden yorumlama.

| Metrik | Tanım / payda | Olay ve zaman kaynağı | Doğruladığı karar |
| --- | --- | --- | --- |
| İlk anlamlı başarıya süre | Önce tanımlanmış gerçek etki: sistem devreye girdi + oyuncu sonucunu gördü; tüm yeni başlayanlar, ulaşamayanlar ayrı | Server completion + client visible; kayıt→sonuç duvar saati ve foreground ayrı | Prolog/onarım eylemi karşılığını hissettiriyor mu? |
| İlk bilgi edinimi | Hedef/rotaya ilişkin yeni gerçek bilgi edinilen ve gösterilen ilk an | Gerçek probe/visibility state + dossier/scene view | Keşif bir metin kutusu mu, kullanılabilir bilgi mi? |
| İlk anlamlı karar | Aynı anda iki uygulanabilir alternatif vardı; oyuncu birini taahhüt etti | Karar anındaki sunucu uygulanabilirlik snapshot'ı + kabul edilmiş emir; yardım durumu gözlemi | Robotik seçim kaldırıldı mı? |
| İlk tam core loop | Yeni bilgi→karşılaştırılabilir seçenek→gerçek uçuş→kayıtlı sonuç→görülen sonuç→yeni bağımsız karar | Uçuş/rapor id zinciri, visible olayı, sonraki kabul edilmiş emir | Oyun vaadi gerçekten yaşandı mı? |
| İlk bağımsız ikinci hamle | Önceki dersten sonra tek zorunlu işaret olmadan yeni hedef/filo/miktar seçimi | Guidance exposure + accepted command; mini görüşmeyle gerekçe | İpuçlarını izleme ile öğrenme ayrımı |
| İlk filo | Kabul zamanı→scene'de rota ve craft görülme; ilk sonucun görülmesi ayrıca | Sunucu emir/flight id + görünür client observation | Eylem fiziksel karşılık buluyor mu? |
| İlk karşılaşma | İlk motion/contact/probe/attack olayları ayrı; dünyada var, algılanabilir, gerçekten görüldü katmanları ayrı | Server encounter/visibility + client rendered/visible | Trafik yoğunluğu algılanan canlılığa dönüşüyor mu? |
| İlk gerçek sosyal bağ adayı | İki insan arasında tekrar iki taraflı etkileşim; salt aynı haritada olmak hariç | İç server aktör sınıfı + moderasyon izni olan metadata; sohbet metni analitiğe taşınmaz | Gerçek insan topluluğu kuruluyor mu? |
| Oturum bitiş noktası | Son kabul edilmiş eylem, açık fırsat, pending sonucu ve son yüzey; sebepten ayrı | Server son durum + foreground/background + izinli kısa görüşme | Ayrılış bilinçli plan mı, karışıklık mı? |
| İkinci oturum | 30 dakika session kuralıyla ölçülen dönüş; aynı tab açılışı tek başına değil | Mevcut session modeli; restart/arka plan farklı etiket | İlk sonuç dönüşte yeni karar yaratıyor mu? |
| D1/D3/D7 | Aşağıdaki iki açık ankraj, yalnız olgunlaşmış kohort | Server signup/ready zamanları + güvenilen sonraki ziyaret/kabul edilmiş emir | Erken değişikliklerin kalıcılık etkisi |
| Ana galaksi geçişi | Yeni hesaplardan migration-start/land oranı; hazır olup geçmeyenler ayrı | Server idempotent migration outcome | Oyuncu hazır ve istekli mi, kapıda takılıyor mu? |
| Yenilgiden toparlanma | İlk kayıptan sonra yeni anlamlı eylem ve uçuşa süre; tüm kayıp yaşayanlar | Combat loss + kabul edilmiş repair/mine/flight | Risk öğretici mi, ilerlemeyi kesiyor mu? |
| Baskı ve memnuniyet | Bağımsızlık/anlama/merak/baskı kısa görüşmesi, zorunlu değil | Küçük örneklem anketi + gözlem | Daha çok kontrol etmeyi sağlıklı bağlılıkla karıştırmamak |

İlk core loop için şart “probe AND attack” değildir. Teleskopta gözlenen hareket de bilgi olabilir; ilk kaynak hedefini seçmek de stratejik tercih olabilir. Buna karşılık sırf maden komutu atıp otomatik haul görmek, bilgi ve alternatifleri hiç kullanmadıysa tanımlanan döngünün tamamı sayılmamalı. İki alternatifin varlığını her frame yazmak gereksiz; karşılaştırma/taahhüt anında sınırlı kategorik snapshot yeterli olabilir. Sonucun anlaşılması yalnız telemetry'den çıkarılamaz; ilk tur gözlemi/görüşmesi gerekir.

“Bağımsız karar” için NPC'nin ekranda olmaması veya rehberin kapalı olması yeterli değildir. Tek hedefi gösteren nabız, el veya zorunlu todo da cevabı oyuncuya vermiş olabilir. Analytics bunu “yönlendirmesiz eylem adayı” diye işaretleyebilir; algılanan özerklik ve oyuncunun nedeni anladığı, gözlem ve kısa geri çağırma sorusuyla doğrulanmalı. Bu ölçüm yeni bir quiz veya göç kapısı değildir.

**D1/D3/D7 ve seçilim sözleşmesi:**

- Birincil yeni hesap retention'ı `account_created` kohortunu kullanır; `game_ready`ye ulaşamayanlar da paydada kalır. Dönüş için aynı hesabın sonraki güvenilen ziyaret/oyun eylemi gerekir. Bot/test/personel hesapları içerde belirlenmiş kuralla dışarıda tutulur.
- İkincil deneyim retention'ı ilk `game_ready`den başlar ve mevcut metriğin adı/ankrajı korunur. Teknik giriş başarısızlığı ile ilk oynanışın kalıcılığını ayrı gösterir.
- `D1=[24,48)`, `D3=[72,96)`, `D7=[168,192)` saat şeklindeki rolling pencereler açıkça etiketlenir. Kullanılırsa takvim günü ayrı seri olur; bunlar aynı rakam diye karşılaştırılmaz.
- D3 için en az 96 saat, D7 için en az 192 saat gözlem gerekir. İlk72 saat audit'i D7 sonucunu hemen üretmez. Henüz penceresi kapanmayanlar başarısız sayılmaz; `pending/mature` ayrımı korunur.
- Güncel kod saklanan geçmişin ilk ready'sini seçiyor. Deney için gerçek yeni hesap yaratılma zamanı ve kalıcı ilk-ready ankrajı ayrı tutulmalı; analitik saklama süresi doldu diye eski kullanıcı “yeni” görünmemeli.
- Otomasyon ve yeni başlayan insan ayrımı server içindedir; istemciye kimlik işareti gönderilmez. Analitik reddi, veri eksikliği ve delivery kaybı “oyuncu geri gelmedi” diye sessizce kodlanmaz; kapsam/oran ayrıca raporlanır.

**Oturum ve süre:** Beklerken sahnede düşünmek, 30 saniye etkileşimsizlik nedeniyle yeni oturum ya da churn sayılmaz. Mevcut 30 dakika session kuralıyla karşılaştırma korunur; uygulama kapatma→tekrar açma ayrıca kısa “ziyaret” olarak incelenebilir. Foreground açık kalması aktif karar zamanı değildir; etkileşim aralıkları da zihinsel düşünmeyi tam ölçmez. İlk5/10/20/30 dakika panosunda duvar saati, foreground ve nitel gözlem birlikte bulunmalı.

**Olay otoritesi ve tekilleştirme:**

- `command_attempted` niyettir; server reject sonrasında dispatch sayılmaz. UI'da rota çizilmiş olması gerçek filo yaratılması değildir.
- Transaction tamamlandıktan sonra server fact/outbox projeksiyonu; gameplay transaction'ını analytics başarısına bağımlı yapma.
- Aynı flight/report/repair/migration kimliği ve milestone version ile idempotency; retry, worker yeniden çalışma ve ikinci cihaz aynı başarıyı çoğaltmamalı.
- Server timestamp; client visible gecikmesi ayrı. Ekran dışında biten onarım, animasyon izlenmedi diye tamamlanmamış sayılmaz.
- `eligible → available → exposed → accepted → resolved → viewed → next action` zincirinde her payda ayrı. Lineer tutorial dropoff'u dallanmış özgür oyuna taşımama.
- Free-form isim, mesaj, ekran metni, hassas koordinat veya token kaydetme. Analitiği gözetleme sistemine dönüştürmeden kategorik seçenek farkları ve teknik hata kodu yeterli.

**Ölçülebilir hipotezler; etki büyüklüğü uydurulmadı:**

| Hipotez | Karşılaştırma | Birincil ölçü | Koruyucu ölçü / yanlışlama |
| --- | --- | --- | --- |
| H1: İlk gerçek sonucu görünür kılmak, oyuncunun kontrolsüz görev hissini azaltır | Aynı ekonomiyle onarım→sahne sonucu bağını güçlendirme | Sonucu doğru açıklama ve bağımsız ikinci eylem | FPS, kontrolün devralınması, hata oranı; sadece uzun animasyon izlenirse başarısız |
| H2: Erken iki anlamlı seçenek, ilk bağımsız döngüyü artırır | Aynı bütçe ve kapasiteyle tek zorunlu hedef vs iki uygulanabilir hedef | Yardımsız ikinci karar / ilk döngü | Yanlışlıkla kaynak kilidi, erken kayıp, anlaşılmama; yalnız hedef çeşitliliği başarı sayılmaz |
| H3: Sonuca bağlı geri dönüş çerçevesi, gönüllü ikinci oturumu artırır | Gerçek pending eylem+sonraki karar görünürlüğü vs genel geri gel mesajı | İkinci oturumda sonuç→yeni karar | Push kapatma, baskı hissi, sessiz saat ihlali; login sayısı tek başına yetmez |
| H4: Düşük risk ve açık toparlanma ilk kayıptan sonra devamı destekler | Yetki verildikten sonra küçük encounter kurguları | Kayıp yaşayanlarda anlamlı toparlanma | Exploit/farming, toplam ekonomi, insan PvP adaleti, kayıp büyüklüğü |
| H5: Göçte kimlik ve geçmiş sürekliliği, yeni hedef kurmayı destekler | Aynı carry ile açık kayıp/taşınan değer sunumu | Göç sonrası ilk bağımsız gerçek döngü | Ücretsiz ekonomi avantajı, göçten kaçınma, kayıp sürprizi |

Önce küçük nitel prototip turu: farklı deneyim ve zaman bütçesindeki yeni oyuncularla ilk30 dakika, erken çıkış ve ertesi gün dönüş. Örneğin 6–8 kişi bir ilk hata bulma turu için üretim planlama adayıdır; istatistiksel temsil veya sektör standardı değildir. Her turda kritik sorunlar düzeltilip yeni katılımcı kullanılır. Oyuncuya cevap söyleyen think-aloud yönlendirmeleri yerine “ne bekliyorsun, ne oldu, şimdi ne yapardın?” soruları kullanılır; ilk bağımsız karar testinde araştırmacı yardım etmez, yardım isteği kaydedilir.

Sonra saha deneyi: önce mevcut baz oranlar ve veri kalitesi çıkarılır; minimum anlamlı etki, örneklem/power, ölçüm süresi ve durdurma koşulu önceden belirlenir. “D1 %40 olmalı” gibi kaynaksız eşik konmaz. Intent-to-treat ana analiz; rehberi kapatan veya ilk raporu hiç açmayanlar gruptan çıkarılmaz. İlerleme/giriş teknik sorunları, edinim kaynağı, dil, platform ve ilk oturum saati ayrı değerlendirilir; küçük alt gruplardan kesin hikâyeler çıkarılmaz.

Çok oyunculu deneyde bir oyuncunun erken filosu başkasının kaynak/tehdit deneyimini değiştirir. Dünya olayları, arz veya risk etkileyen testte aynı starter galaksisi/uygun yerleştirme kümesi aynı varyanta atanmalı; bağımsız hesap örneklemi varsayılmamalı. Yoğunluk ve sezon evresi eşlenmeli, küme etkisi/power hesaba katılmalı. Salt yerel sunum denemesi hesap bazında atanabilir fakat olaylara etkisi ayrıca kontrol edilir. Deneyde insan talebini azaltıp yapay trafikle aynı görüntüyü üretmek, gerçek sosyal deneyimi eşitlemez.

### Gaps

- Bu çalışmada analytics veritabanından gerçek D1/D3/D7/baseline çekilmedi; panodaki mevcut sonuçlar ölçülmedi. Sunulanlar sorgu ve sözleşme incelemesidir.
- Starter'ın bütün server fact kapsamı backend notlarıyla birleştirilmeli; allowlist'teki milestone adı sunucu kanıtı olarak yeterli değildir.
- Kaynaklara dayalı “garantili retention artışı” yoktur. Ölçülen davranışlar ve görüşmeler yönü sınar; ürün sezgisi etki büyüklüğünün yerine geçmez.
- Yeni gözlem/kullanıcı oturumu yürütülmedi. Kod/test çalıştırılmadı, DB/server değişmedi, hesap yaratılmadı.
