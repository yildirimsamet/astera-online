# İlk 72 saatte kendi rotanı aç

**7 Kasım 2026 · Mevcut durum incelemesi · Seçilmiş tasarım yönü ve prototip planı**

Astera'nın başlangıcında korunmaya değer bir oyun var: oyuncunun çalıştırdığı hasarlı gemi, gerçek üretim, ortak kaynaklar, gerçek uçuşlar, istihbarat ve ana galaksiye somut bir yol. **Asıl sorun, bu sistemlerin yokluğu değil; oyuncunun kendi sorusu, kararı ve sonucu etrafında birleşmemesi.** Rehber, sunucunun sunduğu bazı seçeneklerden daha dar bir yol dayatıyor; görsel ilerleme, gerçekten açılan yetenek ve sonraki hedef zaman zaman farklı şeyler söylüyor. Bu nedenle ilk müdahale daha fazla görev, ödül veya sinematik eklemek olmamalı. Önerim, ilk 30 dakikayı **bilgi edin → gerçek seçenekleri karşılaştır → filonu gönder → sonucunu gör → kendi ikinci kararını ver** döngüsüne dönüştürmek. Sonraki 72 saat bu döngüyü keşif, karşılaşma, toparlanma, komşuluk ve ana galaksiye hazırlanma üzerinden derinleştirmeli. Aşağıdaki tasarım uygulanmadı; araştırma bulguları, koddan doğrulanan davranışlar ve sınanacak öneriler ayrı tutuldu.

## Seçilen yön ve açık denge ayrıntıları

**Ana konsept: Kurtardığın gemiyle kendi rotanı aç.** Onarımlar, komutanın çevresindeki fırsatlara müdahale etmesini sağlayan araçlardır. İlk başarı, sekiz onarımın veya bir eğitim bölümünün bitmesi değil; oyuncunun kendi planının dünyada karşılık bulmasıdır. İlk büyük duygusal tepeyi ilk anlamlı dış seferin sonucu taşımalı. Motorların çalışması ve ana galaksiye geçiş, bunun daha büyük ölçekli devamı olmalı.

Bu belge mevcut sistemi bütünüyle değiştirmeyi önermiyor. Sunucu otoritesi, ayrı gemi modeli, ortak sahalar, savaş kuralları, filo zamanları, korumalar, geçiş güvenliği ve mevcut görsel altyapı güçlü temeller. Rehberin emredici bölümü, bilginin kullanıma bağlanması, rehbersiz bekleme, dönüş sunumu ve anlamlı insan ilişkilerine açılan kapılar geliştirilmelidir.

Aşağıdaki üç tasarım yönü çalışma sırasında owner tarafından seçildi. **Bu seçimler tasarım yönünü netleştirir; henüz oyun kodunu, sayısal dengeyi veya somut geliştirme paketini uygulama izni değildir.**

| Karar | Alternatifler | Öneri ve ödünleşim | Etkilenen alan |
| --- | --- | --- | --- |
| İlk karşılaşmayı kim başlatır? | Oyuncunun seçtiği fırsat; önce görünür tehdit; davranışa bağlı iki yol | **Seçildi: oyuncunun seçtiği fırsat, tehdit daha sonra.** Özerklik güçlenir; saldırı seçeneği erkene alınacaksa mevcut izin kuralları değişir. İlk başarı savaş gerektirmez. | Karakol saldırı izni, ilk savaş raporu bağımlılığı, öğretici tehdit |
| Harcama koruması ne zaman çekilir? | Erken serbestlik; ilk tam döngüye kadar koruma; oyuncunun yardım düzeyi | **Seçildi: erken serbestlik ve kurtarılabilir hatalar.** Açık bedeller/rezerv önerisi, uygulanabilir toparlanma yoluyla birlikte tasarlanır. Yalnız kilidi kaldırmak yeterli değildir. | Rehberin harcama kapısı, hedef seçimi, ekonomi hata senaryoları |
| Ana galaksiye ne zaman geçilir? | Hazırlık tamamlanınca; ağırlıkla 48–72 saat; mevcut tempo | **Seçildi: hazırlığa bağlı esnek geçiş, ilk gün mümkün.** Hızlı oyuncu takvimle tutulmaz; diğerleri aynı anları birkaç güne yayabilir. Yeni bilgi sınavı kapısı önerilmiyor. Somut pilot paket E bölümündedir. | Motor/yakıt temposu, savaş gereksinimi, sezon ve iniş koşulları |

İnsan PvP koruması, sezonun son günlerindeki geçiş, tek seferlik kurtarma hibesi ve ekonomik taşıma gibi büyük konularda mevcut kurallar geçerlidir. İlerideki alternatifler ayrıca karar gerektirir. Kontrollü aktörlerin istemcide ayırt edilmemesine ilişkin kilitli ürün kararı da bu çalışmayla değiştirilmedi.

### Kanıtın sınırı

**K — Kod kanıtı:** Güncel çalışma ağacındaki uygulama, veri modeli ve ilgili test kaynakları incelendi. Bu, testlerin bu oturumda çalıştırıldığı veya deneyimin oyuncularca anlaşıldığı anlamına gelmez. **A — Arşiv gözlemi:** Önceki mobil yürüyüşten iki görüntü yeniden açıldı. **R — Araştırma:** Birincil çalışmalar ve resmî tasarım rehberi. **H — Hipotez:** Astera için önerilen, henüz prototiplenmemiş çözüm.

Bu incelemenin başlangıcında 5177 ve 3199 dinleyicileri görünmüyordu. Sunucular başlatılmadı veya durdurulmadı; yeni hesap açılmadı, DB/süreler değiştirilmedi. Yeni canlı ilk 30 dakika, gerçek iki insan etkileşimi, çok günlük geçiş ve telefon performansı doğrulanmadı. Ürün ve test koduna dokunulmadı; test/typecheck/lint veya uzun ekonomi simülasyonu çalıştırılmadı. Önceki batch4 test sonuçları tarihsel kanıttır, bu audit'in yeni PASS sonucu değildir.

Arşivde yeniden incelenen [sahiplenme eşiği](/home/yildirim/Desktop/Coding/MyProjects/blindspace/out/playtest/codex-batch4/tempo/02-claim-gate.png) ve [ilk starter görünümü](/home/yildirim/Desktop/Coding/MyProjects/blindspace/out/playtest/codex-batch4/tempo/03-starter-first-view.png), girişin görsel bağlamını gösterir. İkinci görüntü yazı animasyonu sırasında çekildiğinden tamamlanmış koç kartı yerleşimini kanıtlamaz. Bu belge gerçek terk yüzdesi, ölçülmüş keyif veya garantili retention artışı iddiasında bulunmaz.

## A — Mevcut sistem, görev zincirinden daha fazla seçenek sunuyor

### Hesaptan ana galaksiye mevcut yol

Yeni ziyaretçi hesapsız prologda güç, ateşleme, toplama, yama ve sinyal takibi yaşar; gemiyi gördükten sonra sahiplenme/kayıt akışına geçer. Bu dünya yereldir: sunucu tarayıcıdaki kaynak miktarını kabul etmez, gerçek başlangıç gemisini kendi kurallarıyla kurar. Gemi hull seçiminin korunabilmesi görsel devamlılık için iyi bir temel. Buna karşı kayıt sonrasında yeniden karşılama ve yeni bölüm sayacı, aynı maceranın devamı yerine ikinci başlangıç hissi yaratabilir. Bu son cümle tasarım çıkarımıdır. ([Prolog dünyası](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/onboarding/prologue/world.ts:3), [claim ve enlist](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/routes/onboarding.ts:55))

Sunucu gemiyi mevcut açık galaksinin boş yerine yerleştirir; gerekirse yeni galaksi açar. Varsayılan kapasite 30 gemi, yarıçap 900 ve minimum ayrım 250'dir; konum seçimi aktif komşulara yaklaşmaya çalışır. Bu, boş dünyaları azaltan iyi bir yerleştirme yaklaşımıdır. Kapasite sayısı gerçek insan yoğunluğu değildir. Başlangıç galaksisinin boyutunu veya kaya sayısını bu tasarımda değiştirmiyorum. ([Yerleştirme](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/services/starter/enlist.ts:45), [sabitler](/home/yildirim/Desktop/Coding/MyProjects/blindspace/packages/rules/src/starter/constants.ts:10))

Gerçek gemide üretim toplama, seri onarım kuyruğu ve kasalarla sistemler açılır. Anten 1 sondayı; Tersane 1 üretim ve madenciliği açar. İlk sonda raporu ve ilk maden dönüşü daha sonraki gelişmeleri besler. Teleskop hareketi, radar tanımlanmamış teması ve uyarıyı getirir. İlk savaş raporu motor hazırlığının da parçasıdır; parçalar, motorlar ve yakıt sonrasında oyuncu iniş bölgesini seçerek ana oyuna geçer. **Bunlar tavsiye edilen sırayla gerçek sunucu önkoşullarının aynı olduğu anlamına gelmez.**

### Hangi özellik gerçekten ne yapıyor?

Aşağıdaki “oyuncu deneyimi” değerlendirmeleri, kaynakların desteklediği tasarım yargılarıdır; yeni insan testi sonucu değildir.

| Sistem | Güncel uygulama ve oyuncunun yapabildiği | Güçlü yön / deneyim açığı / karar |
| --- | --- | --- |
| Başlangıç kapısı | Capabilities yanıtını 2,5 saniye bekler; belirsizlik/hata/gecikmede eski FlightSchool'a düşebilir. | Geriye uyumluluk değerli; zayıf bağlantıda başka başlangıç yolu görme riski var. **İyileştir:** belirsiz yetenek yanıtı ile gerçekten eski akışa uygun hesabı ayır. [TrainingDoor](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/onboarding/TrainingDoor.tsx:11) |
| Fiziksel prolog kontrolleri | Şalterde dokunma/sürükleme, önemli işlemlerde 850 ms basılı tutma; ses, kıvılcım ve titreşim. | Eylem–dünya bağı güçlü. Stratejik seçim değil, kontrol öğrenimi. **Koru/kısalt:** rutin işlemlere aynı törenselliği yayma. [Prologue](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/onboarding/prologue/Prologue.tsx:146) |
| Kimlik ve sahiplenme | Gemiye bakarken hesap oluşturma; sunucuda bir hesap için tek starter hakkı. Mevcut ACTIVE/DORMANT/DEPARTING gemi bayrak kapansa da kullanılabilir. | Sahiplenme ve devam güvenliği iyi. **Koru:** tekrar girişte başlangıcı sıfırlama. [Enlist](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/services/starter/enlist.ts:90) |
| Gemi/gezegen ayrımı | Ayrı vessel, order, unit, mission, report ve site kayıtları; web uyarlayıcısı ortak ekranlara bağlar. | Sahte tutorial gezegeni gerekmiyor. **Koru:** ortak ekran sözleşmelerine gemiye ait olmayan anlamlar sızmasın. [Şema](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/db/schema.ts:5510), [transport](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/starter/transport.ts:102) |
| Rehber ve kilitler | İlk üç bölüm sıkı; sonraki erken bölümlerde dolaşma serbest, önerilmeyen maliyetli eylemler engellenir. | Kaybolmayı/bütçe hatasını önler; gerçek özerkliği daraltır. **Yeniden tasarla:** tek zorunlu sıra yerine oyuncunun niyetine yardım. [Koç](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/starter/tutorial/StarterTutorialCoach.tsx:52) |
| Beklerken kenara çekilme | Uzun beklemede AwayChip; ekran değişimi beklemeyi yönlendirmeye çevirmez; kayıp hedef/zaman aşımında kilit emniyeti var. | Sonsuz kilidi önleyen iyi temel. **Koru:** kenara çekilmek, yapılabilir alternatif sunmanın yerini tutmaz. [Script](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/starter/tutorial/script.ts:168) |
| Rehberi kapatma | Hesap kimliğiyle anahtarlı localStorage; koç kaldırılınca kapı, el, harcama kilidi ve bastırma etkileri temizlenir. | Gerçek atlama var; cihazlar arası hesap tercihi değil. **İyileştir:** sunucu tercihi ve tekrar istenebilir bağlamsal yardım. [Tercih](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/starter/tutorial/guidePreference.ts:5) |
| Onarım/kuyruk | Üç emirlik seri kuyruk; bedel, etki, süre, önkoşul; iptalde yarım iade ve bağımlılık kontrolü. | Gerçek planlama kapasitesi mevcut. **Koru:** kuyrukta olmakla çalışır olmak görsel/hedef hesabında ayrılmalı. [Repair](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/services/starter/repair.ts:45), [kart](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/starter/RepairCard.tsx:62) |
| Üretim ve toplama | Kaynak önce üretim havuzuna, sonra elle depoya; madencilik/enkaz havuza, savaş ganimeti depoya iner. Dönen kargonun havuza sığmayan kısmı kaybolur ve wasted olarak kaydedilir. | Ana ekonomiyle uyumlu; dolu havuz yalnız üretimi durdurmaz, yeni sefer gelirini de azaltabilir. **İyileştir:** taşınan, gerçekten kazanılan, kaybolan ve harcanabilir miktarı ayır. [Ekonomi](/home/yildirim/Desktop/Coding/MyProjects/blindspace/packages/rules/src/starter/economy.ts:54), [dönüş kaydı](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/services/starter/fleet.ts:251) |
| Kasalar | Altı gerçek modül eşiğine bağlı tek seferlik kaynak; toplam 1750 alaşım/1190 kristal. Hazır kasalar tek hareketle açılabilir. | Kısa tatmin ve fonlama sağlar. **Koru/ikincil tut:** maceranın ana amacı olmasın; API reddinde erken başarı sunumu riski doğrulanmalı. [Kasalar](/home/yildirim/Desktop/Coding/MyProjects/blindspace/packages/rules/src/starter/crates.ts:24), [CrateBay](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/starter/CrateBay.tsx:93) |
| Sonda ve rapor | Anten 1; ilkinde de 65 alaşım/40 kristal; üretim envanteri gerektirmez. Varışta veri alınır, eve dönünce teslim edilir. | Gerçek bilgi ekonomisi. **İyileştir:** raporu açmakla kararın değişmesi ayrı; saldırı kapalıyken erken raporun kullanım köprüsü zayıf. [Probe](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/services/starter/probe.ts:31) |
| İlk tersane/filo | Tersane 1 bitince bir Prospector ve iki Dart; Hangar 1 örtük açılır. | İlk dış müdahale için araçlar hazır. **Koru/erken kullan:** ilk maden için Anten 2 veya Hangar 2 beklenmez. [Ladder](/home/yildirim/Desktop/Coding/MyProjects/blindspace/packages/rules/src/starter/ladder.ts:89) |
| Madencilik | Hareketli ortak stok, gerçek kesişme ve uçuş; varışta kilitli pay tahsisi, daha yavaş yüklü dönüş. | İlk anlamlı hedef seçimi için güçlü aday. **Koru:** ilk yakın kaya kişisel garanti değildir; boş dönüş açıklanmalı. [Mining](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/services/starter/mining.ts:193) |
| Enkaz/karakol/parça | Ortak siteler, gerçek stok ve guard bileşimi; parçalar uygun motor hazırlığı aşamasında görünür. | Savaşlı/savaşsız parça tercihi var. **Koru:** parça avı gövde onarımının bitmesini beklemek zorunda değil; toplam yolun savaş raporu kapısı ayrıca sürüyor. [World](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/services/starter/world.ts:74) |
| Teleskop/radar | Gerçek menzil ve görülen uçuş bacağı hafızası; tanımlanmamış radar hareketi “?”; sahte ders teması oluşturulmaz. | Bilgi katmanları değerli. **Koru/iyileştir:** üç “İleri” onayı, kuralı kullanabildiğini kanıtlamaz. [Traffic](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/services/starter/traffic.ts:31), [ders](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/starter/tutorial/sightLesson.ts:11) |
| Araştırma | Hangar 2 sonrası sınırlı ana oyun projeleri; starter araştırması taşınmaz. | Mevcut operasyonu geliştirebilir. **İyileştir:** sırf bekleme dolduran geçici yatırım olarak sunma; anlık fayda ve taşıma kuralı açık olsun. [Orders](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/services/starter/orders.ts:83) |
| Savaş/hasar/onarım | Ana savaş çözücüsü, starter ayarları; kayıp, hasar, retreat ve replay. Saldırı/dock ilk savaş raporundan sonra. | Sayı tablosundan fazlası mevcut. **İyileştir:** ilk riskin kaynağı, kararın etkisi ve toparlanma yüzeyde anlaşılmalı. [Battle](/home/yildirim/Desktop/Coding/MyProjects/blindspace/packages/rules/src/starter/battle.ts:26), [dock](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/services/starter/dock.ts:13) |
| PvP korumaları | Aegis sonrası 12 saat, saldırı rızası, hedef uygunluğu, yenilgi sonrası toparlanma ve saldırı sınırları. | Gerçek insan güvenliği için güçlü temel. **Koru:** erken PvE tasarımı bu veto katmanını atlamamalı. [Koruma kuralları](/home/yildirim/Desktop/Coding/MyProjects/blindspace/packages/rules/src/starter/battle.ts:91) |
| İnsan görünürlüğü/sohbet | Kazanılmış bilgiye bağlı kimlik; sohbet Anten 2 sonrası galaksi+dil odası, block/report/mute. | Moderasyon temeli iyi; aynı harita kalıcı sosyal bağ demek değil. **İyileştir:** gönüllü temasın ve devamlılığın önünü aç. [Public view](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/services/starter/publicView.ts:64), [chat](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/services/starter/chat.ts:34) |
| Gemi görseli | Sheet'te üç hasar halinden 2D görsel; galakside GLB, sistem ışıkları ve hasar sprite'ları. | Mevcut stil/performans temeli korunmalı. **İyileştir:** modül onarımıyla o bölümün hasar tepkisi tutarlı olmalı. [ShipHero](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/starter/ShipHero.tsx:42), [VesselBody](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/galaxy/VesselBody.tsx:28) |
| Hedef ve nabız | ROAD'dan tek gerçek kontrol işareti; genel ObjectiveLine onarım, bekleme, kaynak ve geçiş hedefleri verir. | İkinci görev sistemi yok. **İyileştir:** ilk maden sonrasında aynı görsel tutarlılık sürmüyor; “şimdilik bu kadar” yapılabilir işi gölgeleyebilir. [VisualGoal](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/starter/tutorial/visualGoal.tsx:17), [ObjectiveLine](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/starter/ObjectiveLine.tsx:19) |
| ShipLog ve dönüş | ShipLog sistem ilerleme haritası; olay günlüğü değil. Dönüş özeti en çok beş kayıt; yeni unlock dizisi burada boş. | İki ayrı yararlı yüzey var. **İyileştir:** önceki eylem→sonuç→yeni seçenek bağı eksik; yeni paralel görev panosu kurma. [ShipLog](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/starter/ShipLog.tsx:26), [returnStory](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/services/starter/returnStory.ts:24) |
| Bildirim ve yeniden giriş | Gerçek olay push'ları ve sınırlı hatırlatmalar; starter izin teklifi rehber atlanınca render edilmiyor. | Mevcut altyapı kullanılabilir. **İyileştir:** rehber ve bildirim tercihleri ayrılmalı. Üründe başka bildirim ayarı yok iddiası değildir. [Aftercare](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/starter/tutorial/StarterAftercare.tsx:20), [GameShell](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/v2/shell/GameShell.tsx:318) |
| Uyku ve geri dönüş | 48 saat ilerleme olmaması gemiyi uykuya alır; eylemle uyanır, yer/galaksi değişebilir; ilerleme silinmez. | Dünya kapasitesi korunur. **İyileştir:** sadece toplamak uyanma/ilerleme sayılmadığı için dönüşün ne yapacağı açık olmalı. [Quiet](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/services/starter/quiet.ts:9) |
| Sıçrama ve iniş | Gerçek yakıt, uçuş, sezon ve slot kapıları; güvenli çok aşamalı geçiş; 25 saniyelik ilk sahne atlanamıyor. | Güçlü final ve veri bütünlüğü. **Koru/iyileştir:** koşulları erken göster, sahne kontrolü ve ilk bağımsız gezegen kararı ekle. [Migration](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/services/starter/migration.ts:258), [Sequence](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/galaxy/MigrationSequence.tsx:350) |

### Gerçek açılma kuralları ve zaman hesabı

**Sonda için Anten 1; ilk madencilik için Tersane 1 yeterlidir.** Anten 2 sohbeti, Hangar 2 araştırmayı açar. Mevcut rehberin geniş onarım turu ile ilk dış seferin gerçek önkoşulları karıştırılmamalı. Tavsiye dışı en kısa tersane hattının yalnız onarım süreleri 5 dakika 20 saniyedir; bu bir insanın o sürede madene ulaşacağı veya döneceği vaadi değildir. Kaynak toplama, kasalar, okuma ve hedef uçuşu ayrıca vardır. ([Yetenekler](/home/yildirim/Desktop/Coding/MyProjects/blindspace/packages/rules/src/starter/features.ts:34), [madencilik izni](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/services/starter/mining.ts:141))

İlk sekiz tavsiye onarımı 13 dakika 20 saniye; “required” işaretli 18 satırın seri süre toplamı 23 saat 28 dakika 20 saniye, bedeli 11.648 alaşım/6.084 kristaldir. İki motor bu sürenin 16 saatini, yaklaşık %68'ini taşır. Bu hesaplar **oynanmış oturum süresi veya en erken sıçrama süresi değildir**. “Required” etiketi de her satırı doğrudan sıçrama kapısı yapmaz. Kaynak, gerçek uçuşlar, oyuncu araları ve ortak hedef rekabeti takvimi değiştirir. ([Onarım tablosu](/home/yildirim/Desktop/Coding/MyProjects/blindspace/packages/rules/src/starter/ladder.ts:82))

İlk çatışma daha farklıdır. Saldırı ve karakol saldırısı FIRST_BATTLE_REPORT ister; mevcut dış tetikleyici Radar → Scout → Aegis → Pirate yoludur. Sadece bu erken yetenek hattının timer tabanı bile yaklaşık 2 saat 30 dakikadır, fon ve uçuşlar hariç. Dolayısıyla **ilk 30 dakika madencilik döngüsü mevcut mekaniklerle sınanabilir; ilk 30 dakika savaş, ayrı bir ilerleme ve risk kararıdır**. Motor gövdesi de ilk savaş raporunu ister; “savaş tamamen isteğe bağlı” tasarımı bunu ayrıca değiştirmelidir. ([Saldırı izni](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/services/starter/fleet.ts:114), [tehdit](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/services/starter/npcRaids.ts:39))

**Güncel risk sınırları:** Aegis 1 sonrası 12 saat PvP koruması ve belirleyici savunma yenilgisi sonrası üç saat toparlanma koruması vardır. Saldırgan kendi canlı korumasını onayla bırakabilir. Aynı saldırganın aynı hedefe gönderimleri kayan 12 saatte ikiyle sınırlıdır. Üç başarılı baskın sınırı ise saldırgan başına günlük kota değildir: **aynı hedefin bütün saldırganlardan son 24 saatte aldığı ganimetli baskınları** sayar. Bunlar takvim günü değil kayan pencerelerdir. Hedefin Aegis uygunluğu sunucuda kontrol edilir; çıkış yakıtı hazır veya 14 günü doldurmuş saldırgan da PvP başlatamaz. Bunlar güncel kurallardır. Erken PvE tasarımında ayrıca saldırganın PvP'ye uygunluğu tanımlanmalıdır. ([Koruma hesabı](/home/yildirim/Desktop/Coding/MyProjects/blindspace/packages/rules/src/starter/battle.ts:91), [hedef üzerindeki sayım](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/services/starter/fleet.ts:63))

**Güncel çıkış/taşıma sınırları:** Tank 90 D ister; kendi dışarıdaki/gelen bütün misyonları dönmeli, uygun frontier/slot bulunmalı ve sezonun son beş günü kapısı geçilmelidir. Kaynak taşıma tavanı 2000 alaşım/1000 kristal/50 D, gemi tavanı altı **hasarsız** gemidir; en değerli uygun gemiler otomatik önceliklenir, altılıyı tek tek seçme yoktur. Havuz ve göçte iptal edilen yarım işlerin tam iadeleri de kaynak tavanına tabidir; sınırsız taşıma yaratmaz. Gemi modülleri ve starter araştırması taşınmaz. Normal onarım iptalindeki yarım iade ile göçteki iade farklı kurallardır. ([Çıkış](/home/yildirim/Desktop/Coding/MyProjects/blindspace/packages/rules/src/starter/departure.ts:19), [carry](/home/yildirim/Desktop/Coding/MyProjects/blindspace/packages/rules/src/starter/carry.ts:22), [göç işlemi](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/services/starter/migration.ts:73))

**Ana galakside güncel ilk sezon başlangıcı:** Uygun ilk sezon hakkına sahip insan hesabı yalnız taşıdığı kargoyla başlamaz. Normal katılım ayrıca Çekirdek 3, Rafineri/Kristal Ocağı 2, Depo/Tersane/Hangar 1, D Tesisi 0; Teleskop 3, Radar 2, Aegis 1 ve Uplink verir. Filo üç Dart, bir Warden, bir Prospector ve bir Courier; depo 1500 alaşım/1000 kristal/50 D, başlangıç havuzu 84 alaşım/36 kristaldir. Göç kargosu bu paketin **üstüne** eklenir. İlk oyun koruma hakkı ayrıca mevcutsa ana galaksiye kabulden itibaren 72 saatlik koruma verilir; diğer normal sezon katılımlarında süre 24 saattir. Starter'daki 12 saatle aynı sayaç değildir ve saldırı onayıyla bırakılabilir. Dolayısıyla hızlı çıkış yolunda sensörleri almayan oyuncu ana oyunda hazır sensörlerle karşılaşabilir; öğretimi yeni bir yükseltme olayı beklememelidir. Bunlar onarım modüllerinin transferi değil, bağımsız başlangıç haklarıdır. ([İlk sezon paketi](/home/yildirim/Desktop/Coding/MyProjects/blindspace/packages/rules/src/firstSeason.ts:4), [katılım ve haklar](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/services/player.ts:269), [kargonun eklenmesi](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/services/starter/migration.ts:188))

### On ölçütte deneyimin nitel değerlendirmesi

Buradaki + güçlü temel, ~ kısmi/bağlama bağlı, − açık tasarım riski, ? canlı kanıt yok demektir. Bunlar ölçülmüş puan değildir. “Teknik” sütunundaki K, kodda karşılığının bulunduğunu gösterir. Diğer sütunlar yukarıdaki kanıtlardan yapılan uzman değerlendirmesidir.

| Sistem | Teknik | Anlaşılır | Geri bildirim | Seçim | Sonuç hissi | Çekirdek döngü | Merak/keyif potansiyeli | Doğal oynanış | Geri dönüş nedeni | Karar |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Prolog | K | + | + | − | + | ~ | + | ~ | ~ | Koru/kısalt |
| Gemi sahiplenme | K | + | + | ~ | ~ | + | + | + | + | Koru |
| Sıkı rehber | K | + | ~ | − | ~ | ~ | ~ | − | ~ | Erken hafiflet |
| Onarım/üretim | K | + | ~ | ~ | ~ | ~ | ~ | ~ | + | Sonuca bağla |
| Sonda/rapor | K | ~ | + | ~ | ~ | + | + | ~ | + | Kullanımını güçlendir |
| Maden/filo | K | ~ | + | + | + | + | + | + | + | Bağımsız seçime taşı |
| Kasalar | K | + | + | − | + | ~ | ~ | ~ | ~ | İkincil tut |
| Sensör dersleri | K | ~ | + | − | ~ | + | + | ~ | + | Gerçek olaya bağla |
| Savaş/toparlanma | K | ~ | + | ~ | + | + | + | + | ~ | Neden ve sonraki hamle |
| Sosyal yüzeyler | K | ~ | ~ | ~ | ~ | + | + | + | ~ | Gerçek bağa kapı aç |
| Hedef/dönüş | K | ~ | ~ | − | ~ | ~ | ~ | − | ~ | Tek niyet ve sonuç |
| Ana galaksi geçişi | K | ~ | + | ~ | + | + | + | + | + | Süreklilik ve kontrol |
| Düşük cihaz kullanımı | K | ? | ? | ? | ? | ? | ? | ? | ? | Gerçek cihaz profili |

## B — Robotik his, oyuncunun niyetiyle sistemin otoritesi ayrıştığında oluşuyor

### Öncelikli açıklar ve kök nedenleri

Öncelikler ölçülmüş churn oranına değil; problemin oyunun vaadini engelleme gücüne, karşılaşma olasılığına ve kanıt düzeyine dayanır. P0 burada güvenlik açığı demek değildir: tasarım prototipine güvenmeden önce çözülmesi gereken temel deneyim veya ölçüm sorunudur.

| Öncelik | Kök neden ve kanıt | Oyuncudaki olası etki | Çözüm ilkesi |
| --- | --- | --- | --- |
| P0 | Rehberin ROAD sırası ve SPEND kapısı, sunucunun izin verdiği alternatiflerden dar. K | “Oynamıyorum, işaretli yere basıyorum.” Beklerken gezebilmek gerçek karar yetkisi sağlamıyor. | İlk temel gösterimden sonra maliyetli seçenekleri de serbest bırak; gerçek toparlanmayı ve karar bilgisini birlikte sun. |
| P0 | İlk bilgi, hemen değiştirebileceği bir karardan ayrı öğretiliyor. İlk rapor ganimet gösterirken saldırı kapalı. K→H | Bilgi neden ücretli/değerli anlaşılmıyor; rapor bir sonraki görev kutusu oluyor. | Bilgiyi kullanılabilir fırsata bağla; ilk sondayı sırf erken yapılmış olsun diye zorunlu kılma. |
| P0 | Hedef hesabı kuyruk planını tamamlanmış durumla karıştırabiliyor; stok/havuz ayrımı her hedefte korunmuyor. K | Oyuncu çalışmayan tanka yönlenebilir veya mevcut kaynağı yok sanabilir. | “Sırada / çalışıyor / hazır”, “havuz / depo / tank” ayrı gerçek durumlar olsun. [Hedef hesabı](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/starter/objective.ts:38) |
| P0 | Öğretici nabız ilk akışın ROAD'una bağlı; genel oyun hedefi aynı tutarlılığı devralmıyor. K | Rehber kapanınca daha çok özgürlük yerine daha az anlam bulunuyor. | Tek yetenek/hedef kaynağını koç, kart ve sahne kullansın; oyuncunun seçtiği niyet izlenebilsin. |
| P0 | Deneyim başarısı sahne/istemci kilometre taşlarıyla karışıyor; bazı tempo testleri gerçek kuyruğu/seferi soyutluyor. K | Ekip tamamlanmış görünen fakat öğrenilmeyen veya gerçekte daha uzun süren akışa güvenebilir. | Kabul edilmiş emir, gerçek sonuç, görünür sonuç ve bağımsız yeni karar ayrı doğrulansın. |
| P0, erken çatışma paketinin önkoşulu | Mevcut saldırı ve dock kapısı FIRST_BATTLE_REPORT'a bağlı. Erken karakol savaşı da bu fact'i yazar; PvP kuralı bugün saldırganın Aegis'ini ayrıca istemez. K→H | Yalnız karakol kilidini kaldırmak, Aegis'siz bir geminin başkalarına saldırıp kendisinin hedef olamaması riskini doğurur. Bu, önerinin riski; mevcut normal açılışta yeniden üretilmiş exploit iddiası değildir. | PvE, insan PvP ve hasar onarımı izinlerini ayır; sunucuda doğrudan istek ve varış kontrolleriyle birlikte doğrula. E bölümündeki izin sözleşmesi sağlanmadan erken çatışmayı açma. |
| P1 | İlk tehdit yakın zamanda çevrimiçi olma, scout ve Aegis'e bağlı; oyuncunun ilk saldırısı bir önceki savaşa bağlı. K | Özellikle kısa oturumlarda dünyaya müdahale gecikiyor; gelecek olay belirsiz kalıyor. | Önce gönüllü fırsat; daha sonra algılanabilir ve karşı hamleye açık tehdit. |
| P1 | Çok sayıda küçük onarım/kasa/mesaj hızlı gelir, daha sonra uzun motorlar az gösterge ilerlemesi üretir. K→H | İlk bölümün heyecanı normal oyunla aynı sanılır; ilerleme aniden durmuş hissedilir. | Küçük sonuç, yeni yetenek ve büyük başarı farklı ağırlıkta sunulsun; kalan koşullar dürüst olsun. |
| P1 | ShipHero/global hasar görünümü ile modül bazlı çalışma ışıkları ayrı ölçütlerden gelir. K | Onarılan bölüm hâlâ arızalı görünebilir; eylemin fiziksel karşılığı zayıflar. | Genel hull evrimi korunsun; bölüm hasarı ve çalışma geri bildirimi gerçek modülü izlesin. |
| P1 | Rehbersiz uçuş beklemesi kısa “Waiting”ye düşebilir; bildirim teklifi rehber tercihiyle birleşmiş. K | Ne zaman, ne için döneceği belirsiz; rehberi istememek temel desteği de azaltır. | Gerçek ETA + beklenen sonuç + sonraki karar; danışman, temel HUD ve bildirim tercihleri ayrı. |
| P1 | Sosyal yüzeyler dil/galaksiyle sınırlı; ayrılan komutanla ilişki bağı taşınmıyor. K | Kalabalık var ama “tanıdığım biri” yok. | Gerçek karşılıklı teması ve isteğe bağlı sürekliliği destekle; sahte sohbetle doldurma. |
| P1 | Taşınmayan yatırım, otomatik kargo seçimi ve sezonun son beş günü finalde önem kazanıyor. K | Hazırlık sonrası yeni engel veya sahiplik kaybı sürprizi. | Bedelli yatırım öncesinde taşıma/iniş koşulları; finalde karar özeti, gizli yeni kural değil. |
| P1 | Göç önizlemesi mevcut depo/havuzdan hesaplanır; commit ise aktif işleri tam iade ettikten sonra kargoyu hesaplar. K | Aynı oyun anında bile onayda gösterilen kargo ile gerçek taşıma farklı olabilir; oyuncu yatırım/çıkış kararını eksik tutarla verir. | Aynı snapshot için önizleme, iadelerin carry tavanına etkisini de projekte etmeli; gerçek commit yine kilit altında hesaplanmalı. [Önizleme ve commit](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/services/starter/migration.ts:73) |
| P2 | Fiziksel anten/motor dönüşümü için mevcut varlıkta ayrı hareketli parçalar yok. K | Görsel potansiyel tam kullanılmıyor; fakat tek başına ilk döngüyü bozmaz. | Önce mevcut ışık/hasar/sensör/filo cevabı; yeni asset işi oynanışın önkoşulu olmasın. |

İlk oturum modelinde kuyruk bitişlerinin “şimdi + iş süresi” ile hesaplanması, seri işler için iyimser süre çıkarabilir; ilk maden geliri de gerçek sefer beklenmeden eklenebilir. Ayrı pacing modeli seri kuyruğu daha doğru taşır fakat maden, savaş ve parça olaylarını soyutlar. Bunlar işe yarayan kural araçlarıdır; insanın ilk oturumunu tamamladığının kanıtı değildir. ([İlk oturum modeli](/home/yildirim/Desktop/Coding/MyProjects/blindspace/packages/rules/test/starter-first-session.test.ts:35), [pacing modeli](/home/yildirim/Desktop/Coding/MyProjects/blindspace/packages/rules/test/starter-pacing.test.ts:57))

### Araştırma neyi destekliyor, neyi bizim sınamamız gerekiyor?

**Özerklik, yetkinlik ve aidiyet birbirinin yerine geçmez.** Ryan, Rigby ve Przybylski'nin dört çalışması; laboratuvar oyunları yanında 730 kişilik MMO örneklemini içerir. İhtiyaç doyumu, keyif ve gelecekte oynama niyetiyle ilişkilidir. Bu, Astera'da bir görevi kaldırınca D1'in artacağı anlamına gelmez. Bizim hipotezimiz: uygulanabilir seçenekler, anlaşılır sonuçlar ve gerçek komutanlarla tekrar temas aynı deneyimde birlikte güçlenmelidir. ([SDT çalışması](https://selfdeterminationtheory.org/SDT/documents/2006_RyanRigbyPrzybylski_MandE.pdf))

**Öğretici gerekli olabilir; özgürlük kısıtlamak ayrı bir tercihtir.** Andersen ve arkadaşları üç oyunda sekiz öğretici tasarımını 45.000'den fazla oyuncuyla karşılaştırdı. Karmaşık Foldit'te bazı öğreticiler süre/ilerlemeyi iyileştirirken basit oyunlarda aynı yarar görülmedi; özgürlüğü kısıtlamanın yararı desteklenmedi. Sonuçlar Astera için hazır bir reçete değildir. Resmî Apple rehberi de ana döngüyü öğretme, ihtiyaç anında kısa yardım, atlama ve rehbersiz deneme önerir; bu rehber kontrollü retention deneyi değildir. ([CHI araştırması](https://grail.cs.washington.edu/projects/game-abtesting/chi2012/chi2012.pdf), [Apple](https://developer.apple.com/app-store/onboarding-for-games/))

**Anlamlı seçenekler farklı durumlara götürmelidir.** Cardona-Rivera ve arkadaşlarının 88 kişilik etkileşimli anlatı deneyinde farklı sonuç durumlarına götüren seçimler bazı agency ölçeklerinde daha yüksek değerlendirme aldı. Bu ne ideal seçenek sayısı ne de D1 sonucu verir. Astera'da yakın ve uzak hedefin gerçek zaman/kargo/rekabet farkı olması; iki düğmenin aynı göreve dönmemesi bu ilkenin tasarım karşılığıdır. ([Agency araştırması](https://cdn.aaai.org/ojs/12716/12716-52-16233-1-2-20201228.pdf))

**Flow, sürekli yükselen heyecan değildir.** 60 Candy Crush oyuncusuyla yapılan kontrollü çalışmada kolay koşulda flow daha düşüktü; normal/zor ayrımı basit tek optimum üretmedi. Ayrı 28 kişilik mobil ilk deneyim araştırması, yüksek uyarılmanın rahatsızlıktan da doğabildiğini gösterdi. Dolayısıyla daha çok alarm, daha çok tepe veya daha hızlı kesme başarı ölçüsü değildir. Buradaki hipotez, bir kararın ardından sonucu okuyacak sakin alan bırakmaktır. ([Flow](https://pmc.ncbi.nlm.nih.gov/articles/PMC8943660/), [mobil ilk deneyim](https://findresearcher.sdu.dk/ws/files/195676326/p377_petersen.pdf))

**Merak, cevabı değerli bir soruyla başlar.** Gruber ve arkadaşlarının trivia/fMRI araştırmasında yüksek merak, o bilgiye ve yakınındaki malzemeye ilişkin daha iyi bellekle bağlantılıydı. Oyuna geri dönüş veya doğrudan dopamin düzeyi ölçülmedi. Astera çıkarımı: “sondayı gönder” yerine, oyuncunun gerçekten yanıtını kullanacağı bir belirsizlik kurmak; yeni bilgiyi sonrasında karar verebileceği yerde sunmak. ([Merak ve öğrenme](https://escholarship.org/content/qt2zd605r7/qt2zd605r7.pdf))

**Sahiplenme, sadece ad yazdırmak değildir.** Pierce ve arkadaşlarının psychological ownership çerçevesi kuramsaldır; oyun retention deneyi değildir. Kontrol, emek ve tanıma üzerinden gemiyle ilişki kurmak bizim hipotezimizdir. Makalenin tam metnine bu tur erişilemedi; değerlendirme üniversite kaydı/yazar açıklamasıyla sınırlıdır. Gemi üzerinde kalan onarım izi, kendi öncelikleri ve ana galaksiye taşınan geçmiş, yalnız geçici eğitim aracı duygusuna karşı adaylardır. ([Üniversite kaydı](https://experts.umn.edu/en/publications/toward-a-theory-of-psychological-ownership-in-organizations/))

**Hedefe yaklaşma hissi dürüst olmalıdır.** Goal gradient araştırması oyun dışı sadakat programlarında hedefe yaklaşma ile çabanın artmasını inceledi; sahte ilerleme yüzdesini haklı çıkarmaz. Astera'nın eşit ağırlıklı onarım yüzdesi kalan süreyi anlatmıyorsa bunu “kalan zaman” gibi kullandırmamalıyız. Sistemlerin tamamlanması, gerçek kalan koşullar ve kuyruk süresi farklı bilgiler olarak gösterilmeli. ([Goal gradient](https://business.columbia.edu/sites/default/files-efs/pubfiles/1200/goalgradient.pdf))

**Gerçek bağ, sahnede kalabalık görmekten farklıdır.** EverQuest II'nin 13 haftalık log çalışmasında ortak lonca, benzer düzey ve yakınlık ilişkilerin sürmesiyle bağlantılıydı; örneklem bütün dönem aktif kalan 1.442 oyuncuya dayandığı için seçilim önemlidir. Fairyland Online'ın 51.104 oyunculuk çalışmasında erken ilerleme ve sonraki sosyal özellikler farklı aşamalarda kalıcılığı öngördü; nedensellik kanıtlanmadı. Astera hipotezi zorunlu lonca görevi değil; aynı insanla anlamlı tekrar temasına zemin hazırlamaktır. ([Sosyal bağlar](https://dmitriwilliams.com/wp-content/uploads/2020/06/evolution.pdf), [ilerleme ve arkadaşlık](https://arxiv.org/pdf/1702.08005))

**Kayıp öğretici olabilir; zorunlu yenilgi doğru sonuç değildir.** Kapur'un 309 lise öğrencili fizik öğrenme deneyi, ilk zorluktan sonraki yapılandırılmış öğrenme ve aktarımı inceler; filo kaybedenin oyunda kalacağını göstermez. Prospect theory de varsayımsal para tercihlerinden oyun kaybının optimum şiddetini çıkarmaz. Bizim önerimiz, bedelinin anlaşılabildiği küçük risk, açıklanan sonuç ve gerçekten erişilebilir yeniden denemedir. ([Productive failure](https://arch.kuleuven.be/studeren/tall/artikels/productive-failure-kapur.pdf/@@download/file/Productive%20Failure%20Kapur.pdf), [prospect theory](https://web.mit.edu/curhan/www/docs/Articles/15341_Readings/Behavioral_Decision_Theory/Kahneman_Tversky_1979_Prospect_theory.pdf))

**Ödül, merak ve sonuç bağının yerine geçmemeli.** 128 deneylik dışsal ödül meta-analizi koşula bağlı motivasyon etkileri bulur; “bütün kasaları kaldır” sonucu çıkarmaz. Neko Atsume'daki 1.972 kişilik kesitsel araştırma da çevrimdışı katılımın varlığını destekler, timer koymanın bağlılık yarattığını kanıtlamaz. Kaynak/araç ödülünü koruyabiliriz; esas dönüş nedeni oyuncunun verdiği kararın henüz görmediği sonucu olmalıdır. ([Ödül meta-analizi](https://selfdeterminationtheory.org/wp-content/uploads/2014/04/1999_DeciKoestnerRyan_Meta.pdf), [idle katılım](https://eprints.whiterose.ac.uk/id/eprint/135461/1/BusyDoingNothingWhatDoPlayersDoInIdleGames.pdf))

**Aktör kimliği güveni etkiler; gizlemeyi doğrulayan bilimsel bir izin yoktur.** Ön kayıtlı 539 kişilik Trust Game deneyinde insan/otomatik eş bilgisi davranışı etkiledi. MMO veya sonradan kimlik keşfi incelenmedi. Mevcut ürün kilidi korunurken güven; gerçek kurallar, tutarlı bilgi sınırları, gerçek sonuçlar ve kanıtlanmamış insan faaliyeti iddiasından kaçınma üzerinden gözetilmeli. Sahte kişisel mesaj, dostluk veya insan sayısı bu tasarımın aracı değildir. ([Trust Game](https://www.frontiersin.org/journals/behavioral-economics/articles/10.3389/frbhe.2023.1164259/full))

**Dopamin bir ödül aralığı formülü değildir.** Ödül tahmin hatası araştırması öğrenmeye, isteme/haz ayrımı ise farklı motivasyon süreçlerine işaret eder. Bunlar Astera oyuncularında ölçülmüş nörokimya veya “her 30 saniyede ödül” kuralı değildir. Tasarım dili olarak beklenti, bilgi edinme ve sonuçtan öğrenme yeterlidir; bağımlılık veya nörokimyasal kesinlik iddiasına ihtiyaç yoktur. ([Schultz ve arkadaşları](https://www.gatsby.ucl.ac.uk/~dayan/papers/sdm97.html), [Berridge ve Robinson](https://pubmed.ncbi.nlm.nih.gov/9858756/))

Bu araştırma seti, asenkron mobil 4X'in ilk 72 saatini ve D7'sini birlikte doğrulamaz. **Deneyimsel öğrenme, progressive disclosure ve anlamlı geri dönüş bu belgedeki tasarım hipotezleridir:** kuralı karar öncesinde gerektiği kadar göstermek, sonuçla karşılaştırmak, yardımsız yeni örneğe taşımak. Doğrulanmaları F bölümündeki gözlem ve ölçüm planına bağlıdır.

## C — İlk yarım saatte oyuncu kendi planının sonucunu yaşamalı

### Tek kampanya yerine ortak başlangıç ve farklı rotalar

Bu bölümün tamamı önerilen deneyimdir. Dakikalar, **prototipte sınanacak ritim aralıklarıdır; bekleme kapısı veya bütün oyuncular için süre garantisi değildir**. Aşağıdaki ilk 30 dakika tablosunun ana saati, yeni ziyaretçinin Oyuna Başla eyleminden itibaren geçen duvar saatidir: yükleme, prolog, kayıt, okuma ve doğal beklemeler buna dahildir. Sayaç enlist'te yeniden başlatılarak ilk yarım saat daha başarılı gösterilemez. İkincil görünüm gerçek starter'a girişten başlar; foreground süresi ve anlamlı etkileşim zamanı ayrıca raporlanır. Erken çıkan kişi ayrı devam yolundadır. Beş dakikalık üç mobil oturum aynı anları farklı günlere yayabilir; toplam 15 dakika aktif kullanım, 15 dakikalık kesintisiz ilk oturum diye sunulmaz.

Ortak omurga kısa tutulur: gemiyle bağ kurma, gerçek kaynak/onarım kontrolü, dış dünyada bir fırsat fark etme, gerçek sefer, sonuç ve bağımsız yeni karar. Sonrasında keşif, ekonomik gelişim veya düşük riskli çatışma baskın olabilir. Oyuncu kalıcı bir sınıf seçmez; aynı komutan farklı oturumlarda farklı niyetlere geçebilir.

~~~mermaid
flowchart LR
  A[Ortak kısa başlangıç] --> B[Gerçek uygun fırsatlar]
  B --> C[Oyuncu niyeti: topla / keşfet / hazırla]
  C --> D[Kabul edilmiş gerçek işlem]
  D --> E[Gerçek sonuç]
  E --> F[Sonucu gör ve değerlendir]
  F --> G[Kendi yeni kararın]
  G --> B
  D --> H[İstersen ayrıl]
  H --> I[Dünya ilerler; sonuçla dön]
  I --> E
  G --> J[Hazırsan ana galaksi]
~~~

| Pencere | Yaşanması hedeflenen şey | Başarı kanıtı | Başarısız tasarım işareti |
| --- | --- | --- | --- |
| İlk 30 saniye | Oyuncu dokunur; gemi anlaşılır karşılık verir. | Hangi durumu değiştirdiğini söyler. | Ekran kararılabilir ama işlem/talimat okunmaz. |
| İlk 2–5 dakika | Sahip olduğu gemide gerçek bir kapasiteyi açar; dünyada kullanılacak bir nedeni görür. | Bedeli ve yeni imkânı fark eder. | Onarım emrinin tek gerekçesi NPC'nin söylemesidir. |
| İlk 5–10 dakika | İlk dış sefer için hazırlık ve gerçek hedef farkı. | Uygun iki seçenek varsa tercihini açıklar. | Miner/sonda varmış gibi gösterilir veya iki sahte alternatif sunulur. |
| İlk 10–20 dakika | Gerçek uçuş/sonuç; sonucu okuma ve kaynakla yeni karar. | Kargo/raporun kendi eylemine ait olduğunu bilir. | Başarı sadece “raporu aç” veya kasa animasyonudur. |
| İlk 20–30 dakika | Tek hedefi zorlamayan ortamda kendi ikinci hamlesi; isterse anlamlı ayrılış. | “Döndüğümde şuna bakacağım” veya “şimdi bunu deneyeceğim.” | İleri düğmesi gelmeyince oyuncu oyunun bittiğini sanır. |

### An 1 — Gücü sen verdin

**Durum ve tetikleyici:** Yeni ziyaretçi, okunabilir bir karanlık köprüde yardımcı güç kontrolünü görür. Geminin kurtarılabilir silueti ve tek çalışmayan enerji hattı, paragrafın yerini alır. Mevcut şalter etkileşimi kullanılır; dokunma veya kısa sürükleme yeterlidir.

**Görülen/duyulan karşılık:** Şalter temasıyla enerji hattı ve lambalar açılır; kısa mekanik ses, düşük uğultu ve desteklenen cihazda tek titreşim gelir. Bu küçük ilk tepedir. Ses olmadan da önce/sonra farkı bellidir; kamera bu eylemi anlamak için zorunlu değildir.

**Seçim ve öğrenme:** Burada stratejik karar iddia etmiyoruz. Oyuncu kontrolü dener, çevreye bakar veya başlangıcı atlayabilir. Öğrendiği şey, kendi eyleminin dünyayı değiştirdiğidir. Birden çok sahte yol koyarak ilk teması karmaşıklaştırmıyoruz.

**Bağlantı/toparlanma/teknik:** Sonraki kullanılabilir nesne aynı sahnede belirir. Ses/GPU sorunu resim ve durumla aynı eyleme izin verir; iki kez tetiklemek ekonomik hak yaratmaz. Ayrılan kişi mümkünse son yerel prolog durumuna döner. Sunucu ilerlemesi yine yalnız gerçek enlist sonrası başlar.

### An 2 — Kurtardığın şey artık senin

**Durum ve tetikleyici:** İlk enerji/üretim denemesi ve sinyal, oyuncuyu gerçek gemi gövdesine getirir. Kayıt, gördüğü gemiyi tutmasının doğal devamıdır. İlk hesap formundan önce uzun evren açıklaması veya izin penceresi gelmez.

**Görsel/işitsel dil:** Kısa, kesilebilir yaklaşma; hasarlı bölüm ve çalışan ilk ışıklar. Oyuncu gemiyi döndürebilir. Prologdaki ses motifi gerçek starter'a taşınır. Gemi aynı hull ve çalışan temel durumla görünür; yeni “hoş geldin” töreni prologun etkisini sıfırlamaz.

**Seçim ve sonuç:** Sahiplenmek, mevcut hesaba girmek veya sonra dönmek. Kimlik seçimi sahiplenmeye hizmet eder; sahte bir savaş stratejisi seçimi gibi sunulmaz. Oyuncunun ilk kalıcı nesnesi gerçek gemidir.

**Öğrenme ve toparlanma:** “Bu benim gemim; çalıştırılabilir ve geliştirilebilir.” Kayıt ağ hatasında form ve görsel bağlam korunur; çift kayıt/çift gemi üretilmez. Kamera veya asset yükü kimlik işlemini engellemez. İlk 30 saniye ile gerçek dünyaya geçiş arasındaki sürtünme ayrıca ölçülür.

### An 3 — Bir sistemi aç, kullanabileceğin nedeni gör

**Durum ve tetikleyici:** Gerçek gemide üretim ve ilk onarım kontrolü bir kez öğretilir. Kaynak havuzu/depo ayrımı somut akışla görünür. Temel kontrol gösteriminden sonra harcama kapısı erken çekilir; oyuncu bedeli karşılanan yasal eylemleri seçebilir.

**Görsel/işitsel dil:** Rafineri çalışınca yerel ışık/ısı ve gerçek üretim değişimi; Anten 1 tamamlanınca o bölümde hasar tepkisinin sönmesi, kısa bağlantı efekti ve sonda imkânı. **Anten 1 için radar veya teleskop menzili açılmış gibi gösterilmez.**

**Seçim ve farklı sonuçlar:** Tersaneyi önceliklendirmek ilk kaynak seferini; sonda ücretini ödemek komşunun iç bilgisine erişimi öne alır. Her iki seçenek sunucuda gerçekten uygulanabiliyor ve bütçede karşılığı varsa gösterilir. Rehber seçimi geri çevirip aynı sıraya zorlamaz. Bir seçeneği bilerek ertelemek de geçerlidir.

**Öğrenme ve psikolojik amaç:** Kaynak bir tercih aracıdır; onarım yalnız görev tamamlamak değildir. Oyuncu yeni kapasitenin neyi mümkün kıldığını görerek yetkinlik kazanır.

**Toparlanma ve teknik:** Kötü harcama sonrası üretim/toplama, kullanılabilir filo veya açık iptal bedeliyle toparlanma yolu görünür. İptal tam iade varmış gibi sunulmaz. İlk sonda ücreti gerçek soruya cevap vermiyorsa, sırf bölüm sırası için gönderim zorlanmaz; madencilik önce gelebilir. Anten/rapor öğretimi anlamlı komşu veya karakol kararında tamamlanır.

### An 4 — İlk dış uçuşun yerini sen seç

**Durum ve tetikleyici:** Tersane 1 gerçekten tamamlanır; Prospector hazırdır. Mevcut dar önkoşul hattı kullanılarak bu kapasite tavsiye turunun önüne alınır. İlk pilotta süre/fiyat değiştirmeden bunun fon ve UI açısından erişilebilirliği sınanır.

**Görsel/işitsel dil:** Bay çalışır; kabul edilmiş emirden sonra gerçek craft çıkar, rota oluşur, kısa kalkış sesi gelir. İlk takip kamerası yaklaşık yarım saniyelik bir öneri olabilir; dokunma/pan kontrolü geri alır. Sonraki seferlerde izlemek oyuncunun tercihidir.

**Seçim ve farklı sonuçlar:** Gerçek dünya sunuyorsa yakın fakat az stoklu hedef ile daha uzak fakat daha fazla stoklu hedef karşılaştırılır. Beklenen dönüş zamanı, taşıma kapasitesi ve bilinen stok görünür; gelecekteki rakip varışı kesin bilgi diye verilmez. Oyuncu göndermeyebilir. Farklı kaynak kompozisyonu olmayan iki kayaya farklı kaynak hikâyesi yazılmaz.

**Öğrenme ve psikolojik amaç:** Filoyu göndermek, bir formun başarılı kapanması değil; aracını zamana ve ortak dünyaya bağlamaktır. Yakın küçük dönüş, geç tam kargo veya rakipten sonra azalan pay farklı sonuçlardır.

**Toparlanma ve teknik:** İlk kaya kişiye rezerve değildir. Başkası önce varırsa fiili sonuç açıklanır; bütün öğretici yeniden başlamaz. Tek uygun hedef varsa “iki stratejik seçenek” iddiası kaldırılır; gerçek seçenek yokluğu ölçülür. Çift basım, timeout ve tekrar denemede tek misyon yaratılması zorunludur.

### An 5 — Sonuç senin planına geri döner

**Durum ve tetikleyici:** İlk sefer eve döner; gerçek kargo/havuz kaydı sunucuda oluşur. Oyuncu çevrimdışıysa aynı anlam sonraki girişte kısa sonuçla taşınır; animasyonun kaçırılması ilerleme kaybı değildir.

**Görsel/işitsel dil:** Craft bayına gelir; kaynak akışı doğru havuz/depo yüzeyine bağlanır. “Getirilen”, “toplanabilir” ve “harcanabilir” miktar ayrılır. Yerel kargo sesi/titreşim kullanılır; kasa, NPC ve unlock aynı sonucu üç kere kutlamaz.

**Seçim ve farklı sonuçlar:** Kaynağı kapasiteye, bilgiye veya üretime ayırmak; farklı hedefe ikinci sefer; mevcut planı sıraya koyup çıkmak. Kaynak yalnız bir sonraki bedelin bir kısmını karşılıyorsa tam hedef tamamlanmış gösterilmez.

**Öğrenme ve psikolojik amaç:** İlk belirgin başarı, dünyadan gelen sonucu kendi planında kullanabilmektir. Övgünün dayanağı NPC'nin onayı değil, önceki beklentiyle gerçek sonucun karşılaştırılmasıdır. İkinci hedefte el/nabız cevabı vermez; isteyen yardım çağırabilir.

**Toparlanma ve teknik:** Boş/az kargo, taşınan pozitif kargo ve ekonomiye gerçekten eklenen miktar ayrılır. Dolu havuz yüzünden sığmayan yük kaybolduysa tam gelir kutlanmaz; neden ve tekrarını önleyecek kapasite/toplama kararı gösterilir. Gönderim öncesi bilinen kapasite ve dönüş zamanı bağlamında risk bulunabilir olmalı; dönüşü karşılamak için sürekli çevrimiçi kalma dayatılmaz. Mevcut taşma kuralı değişecekse ayrı ekonomi kararı gerekir. Kaynak geç görünüyorsa önce sunucuyla uzlaştırılır; teknik gecikme oyuncunun hatası gibi anlatılmaz. Gerçek misyon, sonuç ve görünürlük kimlikleri aynı zincirde ölçülür. İlk döngü ancak yeni bir bağımsız karar adayıyla kapanır.

### An 6 — “Sonraki görevin” yerine kendi açık sorun

**Durum ve tetikleyici:** İlk sonuç bir yeni hamleye izin verir. Oyuncunun zihninde küçük bir soru kalır: farklı hedef daha iyi mi, komşunun filosu gerçekten uzakta mı, teleskop hangi hareketi görünür kılacak?

**Görsel/işitsel dil:** Yalnız bir öncelikli olay veya seçilmiş niyet vurgulanır. Mevcut tek alt yüzey kuralı korunur. Kısa bir sonuç, gerçek zaman ve bir dokunuş ileride ayrıntı; uzun veda paragrafı veya bütün sistemlere tur yok.

**Seçim ve farklı sonuçlar:** Ek sefer, onarım planı, raporu inceleme veya ayrılma. Sohbet henüz açılmadıysa bir mesaj seçeneği varmış gibi gösterilmez. Gerçek peer ve uygun oda varsa gönüllü temas yapılabilir; sosyal metrik için otomatik sohbet üretilmez.

**Beklenti ve toparlanma:** “Şu anda çıkabilirim; döndüğümde kendi işimin sonucuna bakarım.” Bildirim teklifi varsa isteğe bağlıdır ve rehber tercihinden bağımsızdır. Açık fırsat kalmadıysa yeni sinematikle boşluk örtülmez; kaynak, hedef arzı, kilit veya kapasite nedeni kaydedilir.

**Teknik:** Oyuncunun seçtiği niyet, genel hedef, gemi düğümü ve bekleme satırını aynı kaynağa bağlar. Niyet seçilmeden en fazla birkaç uygun fırsat sunulur; bu yeni zorunlu görev listesine dönüşmez. Uzun bekleme “oyun bitti” demek değildir.

### Rehber hangi parçaları bırakır, hangilerini korur?

| Mevcut öğretim | Yeni kullanım |
| --- | --- |
| Kamerayı hareket ettirme | Gerektiğinde tek kısa jest ipucu; süre dolduran bölüm kapısı değil. |
| Welcome, online, collect | Prologdan gerçek gemiye geçiş içinde birleştirilir; ilk gerçek toplama korunur. |
| İlk onarım/bedel/kuyruk | Bir kez gösterilir; sonraki seçimlerde bağlamsal yardım çağrılabilir. |
| Her kasa için durak | İlk kullanım öğretilebilir; diğer hazır kasalar ikincil işaretle bulunur. |
| Ekran aç → satır aç → rapor aç | Bir anlamlı sonuç incelemesi; menü yolu ayrı ezber görevi olmaz. |
| Tek zorunlu onarım sırası | Önkoşullar ve bedeller korunarak seçilebilir hazırlık; yanlış seçimin gerçek bedeli ve toparlanması görünür. |
| İlk maden hedefini dayatma | Gerçek alternatifler varsa oyuncu seçer; gönderim kontrolüne yardım isteğe bağlıdır. |
| Uzun bekleme konuşması | Gerçek ETA, beklenen sonuç ve dönüşteki karar. |
| Teleskop/radar üç “İleri” adımı | Gerçek temas varsa kısa göster/incele/izle; temas yoksa sahte kanıt yok, ders uygun ana ertelenir. |
| Veda | Sonucun ardından kontrol devri; sonrasında genel oyun yardımı sürer. |

### Hızlı yol dışındaki davranışlar tasarımın parçasıdır

| Davranış | Beklenen karşılık ve korunan karar |
| --- | --- |
| İkinci dakikada çıkar | Kimlik/prologun uygun son noktası korunur; girişte aynı uzun açılış zorunlu tekrarlanmaz. |
| Onuncu dakikada sefer sürerken çıkar | Misyon gerçek zamanda çözülür; dönüşte tek önemli sonuç ve ilgili hedef sunulur. |
| Rehberi kapatır | Harcama kilidi, el ve NPC kapanır; temel ETA, tehlike, kaynak ve yardım erişimi kalır. Hesap tercihi cihazlar arasında eşlenmelidir. |
| Öneriyi görmezden gelir | Yasal ilerlemesi tanınır; daha önce yaptığı onarımı yeniden öğretmek için bekletilmez. |
| Önce ekonomi/önce maden ister | Açık kapasiteye göre yol değişir; sonraki zorunlu onarım aynı saniyede karşısına çıkıp tercihi anlamsızlaştırmaz. |
| Bütün serbest kaynağı harcar | Gerçek toparlanma seçeneği ve süresi gösterilir; garanti olmayan hibe varmış gibi davranılmaz. |
| Sonda hedefi kalkar veya rapor boş/geç gelir | Gerçek başarısızlık nedeni, varsa yeni hedef; ilk ücreti ikinci kez tahsil eden istemci tekrarı yok. |
| Kaya tükenir, az/boş kargo döner | Rekabetin sonucu dürüstçe gösterilir; sonraki uygun fırsat bulunur. Boş dönüş “kaynak başarısı” sayılmaz. |
| Filo kaybeder | Kalan kapasite, onarım/yeni üretim ve dönüş süresi; yalnız bütün stoğu harcamayı öneren kapalı devre yok. |
| 24 saat sonra döner | Kendi emri ve sonucu önce gelir; bütün açılmalar ardışık modal yapılmaz. |
| 48–72 saat sonra döner | Uyku/yer değişimi varsa anlaşılır; gemi ilerlemesi korunur, gün numarasıyla öğretim kaçmaz. |
| Başka cihazda açar | Aynı sunucu ilerlemesi, yardım tercihi ve görülmüş büyük sonuçlar; yerel depolama ekonomik otorite değildir. |
| Animasyon ortasında yeniler | Sunucu tamamladıysa sonuçtan devam; iki kez ödül/iniş üretmez. |

### Sonraki oturumlar: aynı döngüyü daha zengin bilgi ve riskle büyüt

İlk 24 saatin psikolojik hedefi “gemim çalışıyor, seçtiğim sefer işe yarıyor”; 48 saatin hedefi “çevremi okuyabiliyor ve yaklaşımımı değiştirebiliyorum”; 72 saatin hedefi “burada kendi geçmişim oluştu, büyük dünyada ne deneyeceğimi biliyorum” olmalı. Bunlar takvimle açılan içerikler değildir. İlk gün ana galaksiye geçen kişi, sonraki anların uygun olanlarını ana oyunda yaşar. Geç gelen kişi “ikinci gün dersini kaçırmış” sayılmaz.

**An 7 — Geri döndüğünde önce kendi kararınla karşılaş.** Tetik, önceki oturumdan tamamlanmış gerçek sefer/onarım/rapordur. Tek ana sonuç, geldiği hedef ve beklenenle gerçekleşen farkı gösterilir; kısa ses yalnız yeni sonucu destekler. Oyuncu ayrıntıyı açar, kaynakla planını değiştirir veya sonucu geçer. Öğrendiği şey dünyanın yokluğunda da ilerlediğidir. Dönüşün amacı olay listesi temizlemek değildir. Teknik gereksinim, sunucu tamamlanmasıyla istemci “gördüm” kaydını ayırmak, birden fazla cihazda aynı büyük karşılamayı tekrarlamamaktır. Boş sonuç da korunur; animasyon hiçbir zaman yeni kaynak yaratmaz.

**An 8 — Teleskop açıldığında hareketi okumaya başla.** Gerçek Teleskop 1 tamamlanır; oyun uygunsa gerçek bir hareket görünür alana girer. Kısa halka, tanımlanmış nesne ve bilinen rota birlikte görünür. Oyuncu izler, hedefin dosyasına bakar veya kendi uçuşuna döner. Alan dışına çıkan görülen uçuş bacağının izlenebilmesi, durduğu yerde üç paragrafla değil gerçek hareketle anlaşılır. Temas yoksa sahte hareket oluşturulmaz; ders uygun sonraki anda teklif edilir. Kamera isteğe bağlıdır. Menzil ve bilgi yalnız sunucunun verdiğidir; ilk Anten onarımıyla bu yetenek karıştırılmaz.

**An 9 — Sonda bilgisi bir planı değiştirsin.** Uygun gemi/karakol hakkında belirsizlik ve yasal sonraki eylem vardır. Oyuncu raporun bedelini ve dönüşünü görür; gönderir veya başka fırsatı seçer. Rapor geldiğinde kaynak/filo/savunma aralıkları, kendisindeki ilgili kapasiteyle karşılaştırılabilir olur. Eski raporun zamanı görünür. Farklı sonuçlar; hedefi ertelemek, farklı filo hazırlamak, düşük riskli madeni seçmek olabilir. Sonda saldırı emri değildir. Öğrenme, verinin bedelini ve bayatlamasını kullanabilmektir. Hedef kalkmışsa veya bilgi artık geçerli değilse garanti fırsat vaat edilmez.

**An 10 — İlk risk, seçtiğin fırsat olsun.** Owner'ın seçtiği yöne göre düşük riskli karakol seçeneği, insan PvP'den ayrı prototiplenir. Oyuncu bilinen guard bileşimine ve kendi uygun gemilerine bakar; saldırabilir, önce bilgi toplayabilir veya vazgeçebilir. Sonuç gerçek çözücüden gelir: kazanç, kısmi sonuç, hasar veya kayıp. Kontrolsüz büyük filo gönderme yerine küçük taahhüt mümkündür; kazanma garantisi verilmez. Kısa sahne/replay, kararın etkisini gösterir; kendi misyonuna dönmek serbesttir. Başarısızlıkta kalan filo ve uygulanabilir toparlanma yolu öne çıkar. Bugünkü FIRST_BATTLE_REPORT saldırı kilidi bu deneyime izin vermediğinden, aşağıdaki teknik paket olmadan uygulanmış özellik sayılmaz.

**An 11 — Dünya karşılık verebilir, fakat seni cezalandırmak için kurulmaz.** Gerçek tespit veya savaş bilgisine sahip bir komşu, kendi kapasitesi ve niyetine göre yeni sonda, savunmada kalma veya uygun fırsatta saldırı seçebilir. Oyuncu yalnız kazanılmış sensör bilgisi kadarını görür; her sondayı kaçınılmaz misilleme izlemez. Bu, “herkes aynı ikinci saldırıyı yaşar” sahnesi değildir. Öğretilecek şey eylemlerinin başkalarının karar ortamını değiştirebilmesidir. Yeni saldırı için mevcut korumalar, bütçe, rota ve görüş son veto sahibidir. Offline kişiye yeni öğretici tehdit başlatmak bu planın dönüş taktiği değildir.

**An 12 — Radar uyarısı, tepki verebileceğin bir soru açsın.** Gerçek Radar 1 ve tanımlanmamış temas, “?” ile yön/varsa sana gelişi gösterir; filo içeriği uydurulmaz. Oyuncu daha iyi gözlem, savunma hazırlığı, filosunu evde tutma veya başka işine devam etme arasında karar verir. Her “?” saldırı alarmı değildir; gerçek gelen tehdit ayrı tonda sunulur. Ses kapalıyken rota/varış bilgisi kalır. Sonuçta görülen hareketle gerçek olay karşılaştırılabilir. Bugünkü Scout yalnız gidip dönen olay misyonudur, hedefin içini okuyan sonda değildir; onu “seni taradı, artık seni biliyor” diye anlatmak doğru olmaz.

**An 13 — İlk savunmadan sonra nedenini ve kalan gücünü gör.** Gerçek geliş ve battle sonucunda rapor/replay açılabilir; oyuncu karşılaştığı gemi türünü, kendi bilinen avantaj/dezavantajını ve kaybını ilişkilendirir. Hemen sonraki zorunlu görev “intikam al” değildir: onarım, yeni üretim, güvenli gelir, bekleme veya uygun karşı hamle. Başarısızlık bütün gelişimi sıfırlamaz. Mevcut hasar/retreat/dock korunur; düşük risk tanımı yeni oyuncuyu gizlice kazandırmak yerine taahhüt edebileceği kayıp ve kurtarma erişimiyle kurulur. Replay'nin izlenmesi veya quiz geçmesi ilerleme şartı değildir.

**An 14 — Komşuluğunda tanıdığın biri oluşabilsin.** Ortak sahadaki tekrar karşılaşma, güncel rapor veya gönüllü sohbet gerçek temas nedeni olabilir. Oyuncu konuşur, yalnız gözler, engeller veya hiç ilgilenmez. Aynı gerçek komutanla yeniden temasın ana galaksi sonrasında sürmesi için isteğe bağlı, moderasyon/mahremiyet uyumlu bağlantı değerlendirilmeli. Zorunlu lonca görevi, otomatik dostluk mesajı veya sahte insan talebi yoktur. Az insan varken sosyal deneyim garanti edilmez; bu kıtlık ayrı ölçülür ve oyuncunun ekonomik çıkışını kilitlemez.

**An 15 — Motor ve yakıt, yaptığın planın final hazırlığıdır.** Kapasiteler tamamlandığında oyuncu üretim, parça ve kendi uçuşlarını tek planda görür. D üretimi motor onarımıyla örtüşebilir; parça avı gövdenin bitmesini beklemeyebilir. Filo operasyonu ile çıkış yakıtına ayırdığı kaynağın farkı, mevcut kurallar kadar görünürdür. Oyuncu parçayı savaşla veya uygun enkazla arar, yakıtı yükler, daha fazla starter operasyonunu seçer. Büyük motor çalıştırma sesi/ışığı yalnız gerçekten tamamlanınca gelir. Kuyruktaki iki motor hazır gemi olarak gösterilmez. Geç dönmek, gün numarasıyla ödül/öğrenim kaçırmak değildir.

**An 16 — Sıçrama, kaybettiğini son anda öğrendiğin bir işlem olmasın.** Gerçek hazır gemi, yakıt ve dönüşmüş uçuşlarla birlikte iniş adayları görünür. Seyrek/orta/kalabalık çevre gelecekteki deneyime dair tercihtir; güvenlik veya zenginlik garantisi değildir. Taşınan kaynak ve hasarsız gemiler, taşınmayan araştırma ve fazla kargo onaydan önce anlaşılır. Oyuncu gider veya hazırlık planına döner. Güçlü ama atlanabilir sahne; GPU/context kaybında sade geçiş aynı sunucu sonucuna ulaşır. Sezon/slot engeli varsa gerçek neden ve uygulanabilir seçenek; belirsiz “sonra gel” değil.

Önizleme, aktif işlerin göçte tam iadesini de hesaba katmalıdır. Bugünkü view ve commit hesapları bu noktada farklıdır: örneğin 1000 alaşım tutuluyor ve aktif işten 600 iade gelecekse, carry tavanı dolmadığı sürece önizleme 1000, commit 1600 gösterebilir. Bu koddan çıkarılan örnektir; canlı yeniden üretim yapılmadı. Çözüm, aynı state/kuyruk snapshot'ında iade ve tavan projeksiyonunu ortak hesaplamak; üretim, tamamlanan iş veya slot yarışı yüzünden sonradan değişen koşulları ayrıca güncel sunucu yanıtıyla göstermektir. İade ekonomik olarak iki kere uygulanmaz.

**An 17 — Ana galakside ilk hamleyi sen seç.** İnişte bütün menüleri tekrar öğretmek yerine yeni başkentin sahipliği ve bir gerçek karar gösterilir. Uygun ilk sezon paketiyle sensörler, filo ve kaynak zaten vardır; D üretimi ise sıfırdır. Oyuncu hazır yakıt/filoyla dış operasyon veya üretim/yakıt kapasitesini geliştirme arasında gerçekten uygulanabilir tercih görür. Taşınan kargo, yeni verilen paket ve kullanılabilir toplam ayrılır. Starter'daki 12 saat ile ana oyunun varsa yeni 72 saat koruması karıştırılmaz; saldırı kararında sonuç önceden gösterilir.

Hızlı geçip teleskop/radar deneyimini yaşamamış oyuncuya, ana galaksinin kendi görüş kurallarından gelen ilk uygun gerçek temas üzerinde isteğe bağlı kısa yardım sunulur. Yardımın uygunluğu mevcut kabiliyet + görülmemiş yardım + ilgili gerçek olaydan türetilir; zaten Teleskop 3 ile başlayan kişiye yükseltme yaptırmak veya eski tutorial'ı baştan oynatmak gerekmez. Starter menzilleri ana sahneye kopyalanmaz, ana galaksi mekaniği bu sunum işi için değiştirilmez. Gerçek sensörle gözlem veya ilk dış seferi tamamlayan oyuncu aynı anları yeniden zorunlu görmez. İkinci gün geri dönen hızlı oyuncu başkentindeki önceki emrinin sonucuna ve yeni bir hedefe döner; hâlâ starter'da olan oyuncu aynı psikolojik eşiği gemisinde yaşar. Geçiş başarısı yalnız “indi” değildir: yeni dünyadaki bağımsız ilk döngüye bağlanmalıdır.

### Her oturumun dört sorusu

| Oturum/durum | Şimdi neden devam etsin? | Çıkarken hangi beklenti? | Dönüşte ne bulur? | Kendi isteğiyle sonraki hamle |
| --- | --- | --- | --- | --- |
| İlk temas | Gemiyi çalıştırıp dış fırsata ulaşmak | Kendi seferinin sonucu | Kargo/rapor ve değişen hedef | Sonuçla ikinci rota/harcama |
| İlk geri dönüş | Önceki planın işe yarayıp yaramadığını görmek | Seçtiği kapasite yeni seçenek açacak | Gerçek tamamlanma, uygun tek gösterim | Yeni bilgiyle farklı hedef |
| Keşif/karşılaşma | Rakibin hareketini ve fırsatını okumak | Kendi riskinin veya gözlemin sonucu | Güncel rapor, değişen komşuluk | Hazırlık, geri çekilme veya gönüllü risk |
| Motor hazırlığı | Kendi çıkış planını tamamlamak | Parça/üretim/onarım örtüşmesinin sonucu | Gerçek kalan koşullar | Yakıt, rota ve iniş seçimi |
| Ana galaksi | Kurtarılan maceranın yeni ölçeği | Başkentten başlatılan gerçek iş | Yeni sonuç ve yeni fırsat | İlk kişisel gelişim/hedef planı |

Beklenen sonucun üretim sayacı olması bazen yeterlidir; bütün oturumları bunun üzerine kurmak yeterli değildir. Dönüş isteğinin kaynağı, kişinin kendisinin önem verdiği açık sorudur. Bildirim, bu soruyu destekleyen isteğe bağlı bir kolaylıktır.

### Yaşayan dünya için aynı koşuldan üç farklı hikâye

**Örnek öneri:** Oyuncu B gemisini gözler; B'nin filosunun bir bölümü dışarıdadır. Bilgi gerçek ve bayatlayabilir. Yakında ortak bir kaynak, ileride uygun karakol vardır. B bir insan veya gerçek servislerle karar alan kontrollü gemi olabilir; istemciye aktör işareti gönderilmez.

| Oyuncunun kararı | Dünyanın gerçek cevabı | Sonraki soru |
| --- | --- | --- |
| Bilgiyi kullanıp ortak kayaya erken miner gönderir | Varış ve stok belirler; B başka hedef seçebilir veya daha az pay alabilir. Bedava kayıp/kazanç yazılmaz. | Aynı rota tekrar iyi mi, rakip başka yerde mi? |
| Önce ek sonda ile bilgiyi doğrular | Zaman/kaynak harcar; B tespit ederse kendi niyetinde bu bilgiyi değerlendirebilir, yanıt vermeyebilir. Kaya bu sırada tükenebilir. | Bilgi avantajı beklemenin bedeline değdi mi? |
| Fırsatı bırakıp gemisini güçlendirir | B'nin mevcut operasyonu sürer; oyuncu farklı zamanda daha güçlü kapasiteyle döner. Kaçırılan hedef bütün ilerlemeyi kilitlemez. | Yeni kapasiteyle hangi hedef daha anlamlı? |

Bu akışın olay seçimi duvar saatindeki “yirminci dakika”ya değil; gerçek uygunluk, bilgi, hedef ve bütçeye dayanır. Kontrollü aktörün tepki ağırlığı yalnız bildiği son rapor/tespit ve kendi durumundan türemelidir. Karşılık olarak yeni sonda, savunmada kalma, başka sahaya yönelme veya normal saldırı mümkün; yoktan misilleme filosu yaratmak varsayılan çözüm değildir.

Bir olayın teknik sözleşmesi; uygun kapasite, kazanılmış bilgi, var olan hedef, gerçek kaynak/filo taahhüdü, koruma kontrolü, tekrar aralığı ve tek sonuç kimliğidir. Yoğunluk için kişiye ve galaksiye ait sınırlı bütçe gerekir; her eylem yeni tehdit üretmez. Aynı kıt hedefe herkes yöneliyorsa ekonomi/yerleştirme incelenir; herkese özel garantili ödülle rekabet görünmezce kaldırılmaz.

### Farklı oyuncular aynı dünyada farklı yardım alabilir

| Oyuncu ihtiyacı | Tasarım karşılığı | Korunan sınır |
| --- | --- | --- |
| Deneyimli/hızlı | Atla, serbest erken harcama, kısa tekrarlar, mevcut bilgiyi yeniden öğretmeme | Hazır gemiyi takvimle tutmama; kaynak/koruma hilesi yok |
| Yeni 4X/MMO oyuncusu | İlk kontrol gösterimi, bedel–etki karşılaştırması, geri çağrılabilir yardım | Bağımsızlık zorunlu yalnız bırakma değildir |
| Keşif/gelişim seven | Gerçek sensör/rapor soruları, ekonomik hazırlık ve enkaz yolu | Çatışma zaferi yeterlilik sınavı olmaz; mevcut battle gate uyumu değişmelidir |
| PvP isteyen | Riskli fırsata kısa yol, açık koruma/rıza ve uygun insan hedefi | Erken PvE izni otomatik erken insan PvP izni değildir |
| Kısa mobil oturumlu | Sonuçla başlayan dönüş, gerçek ETA, offline plan ve toplu inceleme | Sürekli kontrol etme veya streak yok; üretim tavanı dürüstçe görünür |
| Kayba hassas | Küçük taahhüt, neden açıklaması, kalan güç ve kurtarma rotası | Zorunlu yenilgi, garanti zafer veya sınırsız tazminat yok |

## D — Görsel ihtişam, gerçek yeteneğin ne işe yaradığını anlatmalı

### Mevcut varlıklarla yapabileceklerimiz ve sanat bağımlılığı

İncelenen dokuz gemi GLB'sinin her biri tek node/mesh; animasyon klibi, skin veya morph hedefi yok. Mevcut renderer ayrı anten pivotu oynatmıyor. Bu, hiçbir teknikle hareket yapılamaz demek değildir; **kaliteli fiziksel anten açılması için ayrı parça/pivot veya uygun rig içeren varlık revizyonu önerilen bağımlılıktır**. Üç hull ve hasar varyantları için üretim/export denemesi gerekir. Bu sanat işi ilk 30 dakika döngüsünü bekletmemeli. Önce mevcut bay ışıkları, emissive materyal, hasar sprite'ları, sensör halkaları ve gerçek uçuşlar kullanılabilir. ([VesselBody](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/galaxy/VesselBody.tsx:137), [varlıklar](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/public/assets/models/vessels))

Sheet'teki ShipHero bir 2D görseldir; onu her durumda ikinci bir 3D sahneye çevirmek gerekli değil. Genel hull evrimi korunurken modül bazlı ışık/hasar gerçek duruma bağlanmalıdır. Bugünkü %35/%80 genel görünüm eşikleri ile modül tamamlanması farklı olduğundan, onarılan antenin bulunduğu bölgede eski hasar efekti sürebilir. Bu koddan çıkarılmış risk, yeni canlı ekran kanıtı değildir. ([Görünüm eşikleri](/home/yildirim/Desktop/Coding/MyProjects/blindspace/packages/rules/src/starter/look.ts:10), [sistem ışıkları](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/galaxy/mainSky.ts:85))

| Deneyim anı | Dünya karşılığı | Kamera/kontrol | Ses/titreşim ve sade alternatif |
| --- | --- | --- | --- |
| İlk güç/rafineri | Gerçek güç ve üretimle ışık/ısı, sonra kaynak akışı | Kontrol yanında yerel vurgu; zorunlu kamera yok | Şalter/ateşleme; sessizde aynı durum değişimi |
| Anten 1 | Bölüm hasarı söner, bağlantı/sonda imkânı belirir | Kısa isteğe bağlı odak; pan keser | Hafif bağlantı sesi; sonda ikonu/gerçek bedel |
| Tersane/ilk uçuş | Kabul edilmiş craft baydan çıkar; gerçek rota | İlk kez kısa takip, sonra “İzle” | Kalkış + kısa dokunma; rota ve ETA kalır |
| Maden dönüşü | Gerçek kargo doğru havuza bağlanır | Oyuncu bakıyorsa yerel; başka ekranı zorla kapatmaz | Kargo/commit sesi; miktar ve hedef kaydı |
| Teleskop | Gerçek görüş alanı, tanınan hareket, görülmüş rota | Uygunsa kısa çevre açılması; kullanıcı kontrolü | Yeni bilgi tonu; halka/kimlik/durum etiketi |
| Radar | Tanımlanmamış gerçek temas ve yön/varış bilgisi | Tehlike bilgisi görünür; oyuncunun kritik işini kesmez | Hareket ve gerçek alarm farklı; “?” ve zaman kalır |
| İlk savaş | Gerçek sonuca bağlı engagement/replay, hasar/retreat | Atlanabilir/sonra izlenebilir; sunucu zamanı durmaz | Ölçülü shield/impact; kalan güç ve neden |
| Motor | Tamamlanan bölüm, kademeli çalışma ışığı, kısa plume testi | İlk çalıştırma kısa gösterim; kuyrukta hazır sunumu yok | Spool motifi; gerçek tamamlanma/eksik koşullar |
| Ana geçiş | Mevcut sahnenin kısaltılabilir/atlanabilir sunumu | İlk izlemede de atla; tekrar izleme seçilebilir | Warp motifi; GPU yoksa sade iniş, aynı sonuç |

Üç yoğunluk düzeyi yeterlidir: rutin seçimde küçük yerel cevap; ilk yetenekte nesne+sahne+tek bilgi; büyük sonuçta kısa güçlü sunum. Her kasa, seviye ve bildirim büyük zirve olursa hiçbirinin ağırlığı kalmaz. Aynı olayın kartı, ışığı ve sesi ayrı ayrı üç kutlama oluşturmaz.

### Görsel olay ve performans sözleşmesi

İstemci dokunmaya hemen tepki verebilir; işlem sürüyor geri bildirimi, başarıdan ayrıdır. Başarı ve ekonomik sonuç sunucu gerçeğine dayanır. Aynı olayın tekrar teslimi büyük efekti/ödülü çoğaltmaz. Offline tamamlanmış beş sistem için sinematik kuyruğu yerine tek ana sonuç ve isteğe bağlı inceleme sunulur.

Öncelik, gerçek acil tehlike → oyuncunun yürüttüğü işlem → yeni sonuç → yeni yetenek → isteğe bağlı yardımdır. Alt kartların mevcut tek sahipliği korunur. Temel bilgi yalnız renk, ses veya titreşimde taşınmaz. Uzun metin gerekirse detay katmanındadır; yeni görsel işaretlerde kısa etiketler/sayılar kullanılır. Metinler en/tr/de/fr/es/ja dillerinde aynı koşulu anlatır. ([Alt yüzey](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/starter/bottomSurface.ts:1), [yazım standardı](/home/yildirim/Desktop/Coding/MyProjects/blindspace/docs/ux-writing.md:92))

Ana galaksi Canvas'ının kalite, demand render, batching/culling ve context restore altyapısı korunur; yeni her sheet için renderer açılmaz. Prolog/final ayrı sahnelerinin de aynı cihaz kalite yaklaşımına uyması gerekir. Mevcut ses tercihi, dedupe ve desteklenmeyen haptic davranışı yeniden yazılmaz. ([GalaxyCanvas](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/galaxy/GalaxyCanvas.tsx:149), [quality](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/lib/quality.ts:73), [sound](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/lib/sound.ts:6), [haptic](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/lib/haptics.ts:24))

Kamera kullanıcı pan'ıyla bırakmalı, sıradan veri yenilenmesi aynı odağı yeniden çekmemelidir. Animasyon atlamak gerçek sonucu atlamaz. Hareket tercihi OS reduced-motion'a bağlanmaz; oyun içi kontrol/atlama ve kalite katmanı kullanılır. Asset beklerken durum kartı doğru kalır; yanlış çalışan gemi görüntüsü üretilmez.

Performans için önce gerçek cihaz baseline'ı çıkarılır: etkileşime hazır olma, P95 kare süresi/stall, draw call, texture/bellek, on dakikalık ısınma ve arka plan dönüşü. Düşük cihazda 30 FPS, ortada 60 FPS gibi bütçeler prototip başlangıç adaylarıdır; şu an karşılandığı veya evrensel standart oldukları iddia edilmez. SwiftShader görsel kabulü gerçek telefon performansı değildir. Mevcut [PerfSession](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/lib/perfSession.ts:12) ölçümü, yeni efektin baseline farkını kaydetmek için kullanılabilir.

## E — Küçük bir ilk oturum paketiyle başla, ekonomiyi ayrı doğrula

### Korunacak, değiştirilecek ve eklenebilecek parçalar

| Karar | Mevcut yer | En az gerekli değişiklik |
| --- | --- | --- |
| Koru | rules/starter, vessel lock, orders/missions, worker, stream | Sunucu saatini, kilit sırasını, gerçek sonuçları ve mevcut ekonomi/koruma otoritesini koru. |
| Refactor | objective, tutorialAction, visualGoal, ObjectiveLine, ShipHero/SystemTabs | Tamamlanan/kuyruktaki/uygun/erişilebilir durumları ayıran tek hedef/niyet seçicisi; yüzeyler aynı kararı tüketir. |
| Yeniden düzenle | tutorial script/coach, erken onarım önerisi | Kısa temel gösterim, erken tersane/gerçek ilk döngü, serbest harcama; zorunlu ekran gezintilerini birleştir. |
| Tamamla | returnStory, Away, raporlar, UnlockMoment | Önceki emir→sonuç→yeni seçenek bağı; bir ana dönüş anı, ayrıntılar isteğe bağlı. |
| Dar yeni veri | Hesap tercihi / gerektiğinde kalıcı görülme kaydı | Rehber tercihini hesapta sakla; büyük ilk-kez sunumları cihazlar arasında tekrarlatmamak için gerçekten gereken kayıt. |
| Koşullu yeni ekonomik kayıt | Yalnız tek seferlik kurtarma hakkı onaylanırsa | Benzersiz hak/ledger, sınırlı miktar ve tekrar/iptal istismarına karşı koşullar. |
| Sadeleştir/kaldır | Yinelenen welcome/okuma durakları, genel zorunlu SPEND sırası | Öğretilmiş kontrolü tekrar kapı yapma; eski hesap/FlightSchool desteğini kanıt olmadan silme. |
| Sonra geliştir | Anten alt parçaları, aktör niyet hafızası, sosyal devamlılık | Önce gerçek ilk döngü; pahalı varlık ve dünya davranışı ayrı ölçülebilir paket. |

Yeni global QuestDirector, ayrı tutorial ekonomisi veya ikinci sonuç otoritesi gerekmiyor. Sunucu fact/yetenekleri ve gerçek misyonlar ne yapılabileceğini belirler. Saf seçici oyuncunun seçtiği niyeti ve uygun fırsatları hesaplar; koç sadece yardımı sunar. Bir sonraki hedefi göstermek için ekonomik başarı uydurulmaz.

### Erken PvE, insan PvP ve onarım için ayrı izin sözleşmesi

Bugün karakol saldırısı da insan saldırısı da ilk savaş raporuna bağlanır; karakol sonucu bu fact'i üretir. İnsan PvP denetimi hedefin Aegis'ini kontrol eder, saldırganınkini ayrıca istemez. Normal ilk savaş yolunda saldırgan zaten Aegis aşamasından geçtiği için görünmeyen bu bağımlılık, erken karakol önerisiyle bozulur. Dolayısıyla yalnız karakolun kapısını açıp geri kalan PvP kodunu aynen bırakmak güvenli bir entegrasyon değildir. Dock da bugün aynı attack kapısını kullanır; onu yanlışlıkla PvP'ye katılma şartına dönüştürmemeliyiz. ([Gönderim](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/services/starter/fleet.ts:114), [PvP koşulları](/home/yildirim/Desktop/Coding/MyProjects/blindspace/packages/rules/src/starter/battle.ts:91), [savaş fact'i](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/services/starter/combat.ts:66), [dock](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/services/starter/dock.ts:15))

Önerilen sözleşme henüz uygulanmadı:

| İşlem | İzin ve oyuncuya etkisi |
| --- | --- |
| Karakola PvE gönderimi | Gerçek Tersane 1, uygun silahlı filo, hedef, bütçe ve boş saldırı alanı. İlk savaş raporu önkoşulu aranmaz. Bu izin insan hedefe kullanılamaz; PvE kendi başına PvP korumasını kaldırmaz. |
| Başka komutanın gemisine saldırı | Gerçek veya sistemin yönettiği komutan için aynı kurallar geçerlidir. Mevcut ilk savaş tecrübesi şartına ek olarak saldırganın da Aegis 1'i ve başlatılmış PvP koruma kaydı olmalı. Hedefin uygunluğu, korumalar, baskın sınırları ve saldırganın çıkış/yaş sınırı korunur. Kendi canlı korumasını bırakacaksa mevcut açık onay gerekir. Kontrol gönderimde ve varışta sunucudadır. |
| Hasar onarımı | Evdeki gerçek hasar, tersane/onarım kapasitesi, bedel ve boş dock kuyruğuna bağlıdır; insan PvP izni veya koruma bırakma onayı gerektirmez. Erken PvE hasarı olan oyuncunun toparlanma yolu açık kalır. |
| Savaş kaydı ve çıkış | Gerçek PvE/PvP sonucu geçmişte tutulur. İlk savaş kaydı tek başına insanlara saldırı yetkisi vermez; motorun savaş zorunluluğunu kaldırma önerisi ayrıca uygulanır. |

İstemci kapalı düğme gösterse bile doğrudan API isteği aynı kurallardan geçmelidir; tasarım varyantı istemcinin gönderdiği bir bayrakla seçilemez. Aegis'siz erken PvE kazananının başka komutanın gemisine saldırısı reddedilmeli; aynı oyuncunun bedeli karşılanan hasar onarımı yapılabilmelidir. Gerçek/kontrollü hesap ayrımı farklı izin, düğme veya hata yanıtı üretmez. Eski hesapların ve uçmuş filoların geçişi ayrıca tanımlanır; yeni kural, ekonomik kazanımı veya tamamlanmış savaşı silmez.

**Düşük riskin somut anlamı:** Mevcut karakollar 2/3/6 gemilik farklı guard sınıflarıdır; iki başlangıç Dart'ı her hedef için güvenli filo değildir. İlk riskte bilinen guard türü, rapor zamanı, gönderilen filonun azami kayıp bedeli ve kalan gelir aracı görülebilmelidir. Ekonomiye dönüş için gerçek bir Prospector veya fonlanabilir yeniden üretim yolu kalması pilot kabulüdür. Zafer garantisi, gizli hasar azaltımı veya herkese aynı zayıf düşman yoktur. Uygun düşük taahhütlü hedef yoksa savaş teklifi ertelenir; madencilik/enkaz/gelişim yolu sürer. Hasar onarımının bedeli ve beklemesi de risk değerlendirmesine dahildir. ([Karakollar](/home/yildirim/Desktop/Coding/MyProjects/blindspace/packages/rules/src/starter/sites.ts:51), [dock hesabı](/home/yildirim/Desktop/Coding/MyProjects/blindspace/packages/rules/src/starter/flight.ts:69))

İlk sistem kaynaklı tehdit için kapasite ve son görülme yeterli koşul sayılmaz: oyuncuya önce gerçekten uygulanabilir gönüllü fırsat sunulmuş ve oyuncu en az bir gerçek dış operasyonu kendisi başlatmış olmalı. Yalnız fırsat kartının gösterilmesi bu seçim sayılmaz; boş dönen gönüllü bir sefer de geçerli tecrübedir. Bu, belirli NPC cümlesini onaylatan yeni görev kapısı değildir; gerçek kabul edilmiş emir ve uygun karşı hamle koşulları kullanılır. Uyarı ile varış arasında oyuncunun seçeneği bulunmalı. Başlamış gerçek uçuş, kişi arka plana geçti diye yok olmaz; çevrimdışıyken yeni öğretici saldırı üretmek ise geri çağırma yöntemi yapılmaz. Normal insan PvP'si kendi koruma kurallarına tabidir.

### İlk gün geçişi için somut pilot önerisi

**Önerilen başlangıç paketi:** İlk madencilik yolunu erkene al; motor gövdesindeki zorunlu FIRST_BATTLE_REPORT koşulunu kaldırmayı prototiple; teleskop/radar/Aegis'i çıkış için isteğe bağlı bilgi/savunma kapasitesi olarak koru; Döteryum Tesisi 1→2 üretimini motorlarla örtüştürecek görünür plan sun; gövde/itkiyi pilotta **4 saat + 4 saat** dene. Bu bölümde tesisler DT1/DT2 olarak kısaltılır; retention D1/D3 ile karıştırılmamalı. Bu süreler optimum iddiası veya uygulanmış denge değildir. Üretim hızını, galaksi boyutunu veya kaya sayısını otomatik artırma. İnsan PvP ve onarım izinleri yukarıdaki ayrı sözleşmeye uyar.

Mevcut savaş fact'i kaldırılması varsayımıyla motor/tank için 14 modüllük minimum küme 9833 alaşım/4817 kristal, bir sondayla 9898/4857 eder. Mevcut sürelerle seri timer tabanı 21 saat 1 dakika 20 saniyedir. Sadece bu matematiği göstermek ilk günü kanıtlamaz: iki sekiz saatlik motorun yetişmesi için gövde en geç sekizinci saatte başlamalıdır. O ana kadar tesisler ve ilk gövde bedeli dahil 8098/3657 gerekir. En iyimser şekilde üst üretim seviyeleri ilk andan çalışıyor ve tüm kasalar açılmış sayılsa bile en az yaklaşık **2472 alaşım/1373 kristal ek dış gelir** gerekir. Normal 130/70 kargo örneğinde yaklaşık yirmi tam sefer miktarıdır; gerçek hedef arzı, uçuşlar, kapasite ve yeni oyuncunun yapabildiği sefer sayısı için kanıt değildir. ([Bedel/önkoşul](/home/yildirim/Desktop/Coding/MyProjects/blindspace/packages/rules/src/starter/ladder.ts:82), [üretim](/home/yildirim/Desktop/Coding/MyProjects/blindspace/packages/rules/src/economy.ts:204), [kaya bileşimi](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/services/starter/rocks.ts:16))

Bu 14 satır: Rafineri 2/3/4, Kristal Ocağı 1/2/3, Anten 1/2, Tersane 1, Hangar 2, D Tesisi 1/2, Motor Gövdesi ve İtki'dir. Anten 2 için gerçek ilk sonda raporu, Hangar 2 için ilk maden dönüşü hâlâ gerekir; Hangar 1 tersaneyle örtük gelir. Bugünkü teleskop/radar/Aegis motor yoluna savaş fact'i yüzünden eklenir; Depo 1 gerçek motor/tank önkoşulu değildir. Bu ayrım tavsiye listesini doğrudan “zorunlu 18 görev” saymayı önler.

**İzin değişikliği kadar hedef ve ilerleme hesabı da pakete dahildir.** Bugünkü required listesi, sonraki öneriyi ve onarım yüzdesini besler. Yalnız motorun savaş önkoşulunu kaldırmak yeterli değildir: pilotta Depo 1 ve ilk teleskop/radar/Aegis onarımları çıkış için isteğe bağlı olunca aynı ayrım required sınıflaması, sonraki hedef, sistem toplamları, parça uygunluğu ve görsel sunuma yansıtılmalıdır. Aksi halde gerçek 14 satırı bitirmiş oyuncu yaklaşık %80'de kalabilir veya hâlâ isteğe bağlı sensöre zorlanır. Çıkışa hazırlık göstergesi ile bütün gemi sistemlerinin onarım durumu ayrı adlandırılır; sensörler yapılmamışken “geminin tamamı onarıldı” denmez. Zorunlu savunma adımı kalmayan grupta 0/0 yüzdesi üretilmemeli; isteğe bağlı sistem olarak gösterilmelidir. Hazırlığın tamamlanması da uçuş/sezon/slot gibi gerçek çıkış engellerinin yok olduğu anlamına gelmez. ([Hedef ve yüzde türetimi](/home/yildirim/Desktop/Coding/MyProjects/blindspace/packages/rules/src/starter/ladder.ts:185), [mevcut hedef tüketicisi](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/starter/objective.ts:38))

DT2 yaklaşık 4,374 D/saat üretir. DT1'deki 20 D hibeden sonra kalan 70 D, yalnız DT2'de yaklaşık 16 saat ister: güvenli basit plan DT2'nin ilk **sekiz saat içinde** çalışmasıdır. DT2 inşa edilirken DT1'in iki saatlik yaklaşık 3,808 D üretimi de korunursa pencere yaklaşık 8,87 saate gevşer; tüketim/kayıp olmaması varsayımıyla. “Dokuz saatte açsan kesin yetişir” denmez. Bunlar üretim miktarı hesabıdır: havuz/depo kapasitesi, toplama ve gerçek tank yükleme koşulları ayrıca sağlanmalıdır; mevcut tank ancak itki ve DT2 tamamlanınca yüklenebilir. D havuzu tavanı da sadece A/K için kullanılan saat hesabından kopyalanamaz. ([D formülü](/home/yildirim/Desktop/Coding/MyProjects/blindspace/packages/rules/src/economy.ts:420), [D havuzu](/home/yildirim/Desktop/Coding/MyProjects/blindspace/packages/rules/src/economy.ts:454), [tank bağlantısı](/home/yildirim/Desktop/Coding/MyProjects/blindspace/packages/rules/src/starter/ladder.ts:206))

Motorları dört+dört saat denemenin amacı yalnız toplam sayacı kısaltmak değildir: gövde için son başlama anını sekizinci saatten on altıncı saate taşır; kaynak ve parça toplamak için alan açar. Bu adayda 14 onarımın salt seri süre toplamı 13 saat 1 dakika 20 saniyeye iner; yakıtın beklemesi bunun üstüne körlemesine eklenmez. Fakat DT2'yi erken fonlamak, motor bedelleri, üç parçanın gerçekten eve dönmesi ve ortak sahalardan gelir hâlâ gerekir. Mevcut fiyatlar ve üretimle gerçek seri kuyruk/rapor/uçuş prototipi bu paketin ilk doğrulamasıdır. Bütün hızlı oyuncuların ilk gün çıkacağı garantisi değildir. Paket halinde yapılan denemede bulunan etki bütün pakete aittir; motor süresinin etkisini ayırmak istenirse diğer koşullar sabit tutularak 8+8 ve 4+4 karşılaştırılır.

Bu pilotta ilk gün hedefi tutmazsa önce sebep ayrılır: DT2 geç mi fonlandı, kristal mi yetmedi, anlamlı hedef mi yoktu, parça mı kaçtı, yoksa oyuncu daha fazla starter oynamayı mı seçti? Yalnız süreyi daha da kısaltmak A/K açığını çözmez. İkinci aday, kritik çıkış modüllerinin bedel dağılımını değiştirmektir; sınırsız kaynak veya her tekrarda gelir hibe etmek değildir. Tek seferlik sınırlı destek ancak gözlenen toparlanma açığı için ayrı ekonomik karar olarak ele alınır.

**Sezon/iniş sınırı:** Mevcut son beş gün ve NO_FRONTIER/slot kapıları duruyorsa “ilk gün hazır olabilme” her tarihte “ilk gün fiilen iniş” değildir. Bunlar daha erken görünür olmalı. Hazır oyuncuyu günlerce tutmamak için uygun açık hedef sezon/yer alternatifi öneriyorum; mevcut sezon kuralını kaldırmış saymıyorum. Uygun hedef yokken kesin çıkış saati vaat edilmez.

### Erken serbestlik, hata sonrası yol gerektirir

İlk pilotta yeni hibe eklemeden kötü harcama, boşa giden sonda, boş maden ve küçük savaş kaybından mevcut üretim/toplama/filo/onarım ile dönülebilen yollar sınanır. “Matematiksel olarak bir gün toparlanabilir” yeterli değildir; ilk anlamlı yeniden denemeye süre ve oyuncunun yolu anlayabilmesi ölçülür. Kaynak rezervi öneri olabilir; bütçe gizlice kilitlenmez.

İlk karar için iki ayrı kaya zorunlu değildir: tek kaya yanında gerçekten uygulanabilir ve farklı bedelli bir sonda veya kapasite yatırımı da seçenek olabilir. Seçenek arzı bütün uygun oyuncularda ölçülür; yalnız iki hedef bulabilmiş başarılı alt grubun verisiyle herkesin özgürce karar verdiği sonucu çıkarılmaz. Dünya iki anlamlı alternatif sunmuyorsa bu da pilot sonucudur; ölçümden çıkarılmaz.

Mevcut yollar yetersizse önerilen sınırlı alternatif, her hata için para dağıtmak yerine tek seferlik küçük bir yeniden devreye alma hakkıdır. Miktarı prototip maliyetine göre ayrıca seçilir; dışarıdaki filoyu, mevcut üretim siparişini veya eldeki aracı yok sayarak kopya üretemez. Sunucuda tekillik, maliyet, toplam gelir ve iptal/döngü istismarı doğrulanmadan bu hak açılmaz. Bu belgenin yazımı sırasında böyle bir hak eklenmedi.

### Geliştirme sırası, kabul ve geri dönüş

| Paket | Bağımlılık / öncelik | Somut kabul | Risk ve geri dönüş |
| --- | --- | --- | --- |
| Gerçek durum ve ölçüm | P0, diğerlerinden önce | Kuyruk/çalışan/tamamlanan, havuz/depo/tank ayrımı; tekil accepted/resolved/viewed zinciri; yanlış erken yakıt CTA'sı yok. | Sunum bayrağı kapanabilir; ekonomik kayıt değişmez. |
| İlk 30 dakika pilotu | P0, temel durum doğruluğu | Aynı gerçek fiyatlarla erken tersane ve sefer; guide açık/kapalı, erken çıkış ve bağımsız ikinci karar; altı dil. | Serbest harcamada toparlanma; eski hesapları geriletmeyen kohort. |
| Modül/dünya geri bildirimi | P1, gerçek sonuç sözleşmesi | Modül tamamlanmasıyla ışık/hasar tutarlı; sessiz/lowGPU anlaşılır; kamera kesilebilir. | Görsel bayrak kapanınca oyun sürer; asset işi ilk döngüyü bekletmez. |
| İsteğe bağlı ilk çatışma | P1, güvenli PvE/PvP/dock sözleşmesi + toparlanma | Aegis'siz PvE oyuncusu insan hedefe saldıramaz; hasarını onarabilir. Gerçek sonuç ve alternatif karar, zorunlu savaş/zafer sınavı yok. | Koruma/ekonomi istismarı; yeni encounter üretimini kapat, uçmuş filoları sürümlü sunucu kuralıyla bitir. |
| İlk gün hazırlık paketi | P1, fon/uçuş prototipi | DT2 ve motor/para/parça kritik yolunun gerçek kayıtları; hızlı ve kısa oturumlu yollar; hazır/istekli/engelli ayrımı. | Yeni süre/bedel siparişe sürümlü bağlanır; verilmiş kazanç geri alınmaz. |
| Dönüş ve geçiş | P1, sonuç/tercih kaydı | 24/48/72 saat dönüş, uyku/yer değişimi, çoklu cihaz; her geçiş aşamasında tek başkent/tek kargo. | Mevcut saga korunur; sunum bozulsa iniş tamamlanabilir. |
| Asgari dünya karşılığı | P1, ilk döngü + görünürlük/izin sözleşmesi | Gerçek gözlemden sonra en az bir aktörün mevcut bütçesiyle farklı uygun niyet seçebilmesi; otomatik misilleme değil. C'deki karşılık anı bu paket olmadan tamamlanmış sayılmaz. | Yeni ekonomik hibe veya gizli bilgi yok; niyet ağırlığını kapat, başlamış gerçek uçuşları koru. |
| İleri aktör ve sosyal derinlik | P2, P1 dünya karşılığı ve insan yoğunluğu ölçümü | Daha zengin niyet hafızası ve gönüllü sosyal devamlılık; gerçek insan ilişki ölçüsü; sahte mesaj yok. | Yoğunluk/moderasyon/ekonomi; genişlemeyi kapat, gerçek dünya sonuçlarını silme. |
| Fiziksel anten/ileri sanat | P2, oynanış kanıtı | Hull/hasar varyantlarında doğru pivot; profil ve sade alternatif; doğru yetenek anlamı. | Varlık/ışık sunumuna geri dönülebilir. |

### Kalıcılık, eşzamanlılık ve kontrollü aktör güvenliği

Yeni tasarım mevcut geminin modülünü, kaynağını, parçasını veya yakıtını sıfırlamaz. Çalışan emirlerin vaat edilmiş bitişi korunur. Sunum sürümü ile ekonomik kural sürümü ayrı düşünülür; yeni süre/bedelin hangi emre uygulandığı açık olur. Verilmiş hibe bir UI bayrağıyla geri alınamaz; benzersiz hak kaydı geri dönüşte de kalmalıdır.

Mevcut kilitli sunucu işlemleri ve worker/SSE düzeni korunur. Çoklu hedef kilitleri aynı sırada alınır; client ETA tahmini sunucu sonucunun yerine geçmez. Yinelenen event/POST veya ikinci cihaz aynı kargoyu/sonucu üretmez. Göçün committed → seated → joined → landed akışı ve recovery'si yeniden yazılmaz. ([Vessel lock](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/services/starter/vessel.ts:170), [worker](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/worker/starterHandlers.ts:21), [migration saga](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/services/starter/migration.ts:258))

Normal kontrollü gemiler gerçek servisleri kullansa da warmstart'ta bazı modüller ve tersane gemileri başlangıçta verilir. Bugünkü ilk sekiz warmstart adımı için fiilen sentetik ilk-sefer fact hibesi var demek doğru değildir. Scout/Pirate ise bütçeli normal hesap gemisiyle aynı değildir: sahnede gerçek misyon/savaş üretir, fakat ücretsiz olay olarak doğar; Scout yalnız geri döner. Pirate'ın evdeki silahlı gemi adedine göre üretilmesi eşit güç veya garanti galibiyet anlamına gelmez. ([ShipBots](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/services/starter/shipBots.ts:27), [NPC olayları](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/services/starter/npcRaids.ts:21), [Scout varışı](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/services/starter/arrival.ts:21))

Önerilen tepki hafızası bu ayrımları örtmez. Normal aktör kendi bilinen raporu, gemi sağlığı, kaynak ve rotasına göre karar verir; saldırı koruması son veto sahibidir. Nüfus insan yerlerini tüketmemeli; mevcut talep/rezerv düzeni korunmalı. Oyuncuya görünen bot ifadesi/istemci flag'i eklenmez; insan sayısı hakkında doğrulanmayan iddia, sahte kişisel sohbet veya arkadaşlık üretilmez. Görsel trafik gerçek sosyal bağın yerine sayılmaz.

Yeni fırsatlar mevcut worker/zamanlayıcı üzerinden, sınırlı aday ve işlem bütçesiyle üretilmeli; her istemci yenilemesinde bütün galaksiyi tarayan ikinci olay döngüsü kurulmaz. Sunum için yeni sunucu tick'i gerekmez. Gerçek insan yoğunluğu, worker gecikmesi, query maliyeti ve SSE yükü ölçülmeden ölçeklenebilirlik başarısı ilan edilmez.

## F — Başarıyı görev tamamlamayla değil, anlama ve gönüllü yeni kararla ölç

### Mevcut ölçüm neyi kanıtlıyor?

İstemci sözlüğünde eğitim, komut denemesi/engeli/sonucu, yüzey/sonuç görünürlüğü ve vessel kilometre taşları var. Bu kayıtlar istemci gözlemidir; isimlerinin “first” veya “migration” içermesi sunucu başarısı oldukları anlamına gelmez. Rehberi atlama bugün **training_exit_requested**, starter tutorial sürümü ve skipped koduyla izlenir; training_skipped adında var olan bir olay varsayılmamalıdır. ([Şema](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/api/analyticsSchemas.ts:6), [skip gözlemi](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/starter/tutorial/StarterTutorialCoach.tsx:307))

Vessel milestone üretimi cihazdaki localStorage snapshot farkına dayanır; ilk okuma, başka cihaz ve storage hataları kapsamı etkiler. Migration started istemci mutation denemesidir; commit kanıtı değildir. Normal oyun kayıtlarından güvenilir analitik üreten recovery sorguları starter'ın bütün özgün tablolarını kapsamıyor. Yeni pipeline her olayı yeniden icat etmek yerine bu boşlukları tamamlamalıdır. ([Vessel analytics](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/starter/vesselAnalytics.ts:15), [migration gözlemi](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/src/starter/queries.ts:61), [server facts recovery](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/services/analyticsFacts.ts:9))

Mevcut starter funnel sahne toplamlarını sıralı karşılaştırır. Serbest dal, rehber atlama ve farklı sırada gelen olaylarda bu fark “burada oyunu bıraktı” demek değildir. Yeni paydalar **uygun → mevcut seçenek → görünür → seçilen → kabul edilmiş → çözülmüş → görülmüş → yeni karar** olarak ayrılmalıdır. ([Starter funnel](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/services/starterFunnel.ts:14))

### Metrik sözleşmesi ve doğrulayacağı karar

Aşağıdaki tamamlamalar öneridir, uygulanmış yeni olaylar değildir. Serbest metinden niyet çıkarmak yerine mevcut kontrollü sözlük genişletilir; sunucu kimlikleriyle tekilleştirilir.

Ekonomik işlem analitiğin başarısına bağlanmaz; commit sonrası güvenilir fact/projeksiyon ve gerektiğinde recovery kullanılır. Aynı emir/sonuç/sürüm tekrar teslimle çoğalmaz; client görünme zamanı sunucu çözülme zamanından ayrıdır. Sıkı Zod allowlist korunur; şifre/token, sohbet metni, serbest oyuncu adı veya gereksiz hassas hedef içeriği analitiğe alınmaz.

| Metrik | Ne ölçer, kim paydada kalır? | Toplama kaynağı | Tasarım kararı |
| --- | --- | --- | --- |
| Prolog → claim → hesap | Hesap öncesi kayıp; prologa girenlerin tümü | Önerilen anonim/izin uyumlu kısa ömürlü ziyaret kimliği ve aşama gözlemi; PII/fingerprint yok | İlk etkileyici an ile kayıt sürtünmesi ayrılır |
| İlk hissedilir başarıya süre | Gerçek sistem değişimini gören ilk an; ulaşamayanlar hariç tutulmaz | Server tamamlanma + client visible; ilk ziyaret/enlist ve foreground ayrı | Eylem–dünya karşılığı anlaşılır mı? |
| İlk keşif | Yeni gerçek bilgi teslimi ve oyuncunun görmesi | Probe teslimi/izinli görüş + dossier/scene görünürlüğü | Keşif kullanılabilir bilgi mi? |
| İlk anlamlı karar adayı | En az iki gerçek uygulanabilir alternatiften taahhüt | Karar anında sınırlı uygunluk/fark kaydı + accepted command | Erken serbestlik gerçekten sunuluyor mu? |
| İlk filo hareketi | Kabul edilmiş emir, rotanın görünmesi, gerçek dönüş | Mission kimliği/zamanları + client visibility; worker gecikmesi ayrı | Gönderim dünyada hissediliyor mu? |
| İlk kaynak başarısı | Gerçekten kazanılan net miktar pozitif ve sonucu görünür; yalnız geminin pozitif yükle dönmesi yeterli değil | Sunucuda kargo eksi wasted; sıfır/yarım kazanç, boş FIRST_MINING_RETURN ve sadece havuzda bekleyen miktar ayrı | Başarı ile yalnız dönüş veya taşma kaybı birbirine karışıyor mu? |
| İlk tam çekirdek döngü | Bilgi/seçenek → emir → sonuç → görülme → yeni karar | İlişkili emir/rapor/sonuç kimlikleri ve sonraki kabul | Oyunun vaadi ilk oturumda yaşanıyor mu? |
| Bağımsız ikinci hamle adayı | Tek hedefi veren el/nabız/zorunlu talimat olmadan yeni seçim | Guidance exposure + accepted command; gözlemle doğrulama | Öğrenme mi, ipucu takibi mi? |
| İlk karşılaşma | Dünyada var, algılanabilir ve gerçekten görülmüş katmanları | Server olay/görüş ve client görünürlük ayrı | Trafik algılanan canlılığa dönüşüyor mu? |
| Gerçek sosyal bağ adayı | İki insan arasında tekrar karşılıklı temas | Yalnız sunucuda aktör sınıfı ve izinli ilişki metadata'sı; mesaj içeriği değil | Gerçek topluluk kuruluyor mu? |
| Oturum çıkış noktası | Son gözlenen yüzey/eylem, pending sonuç ve açık fırsat | Foreground/background + son sunucu durum | Bilinçli ayrılış mı, belirsizlik mi? Sebebi tek başına kanıtlamaz |
| İkinci oturuma dönüş | Sonucu görme ve yeni anlamlı eylem | Oturum modeli, sonuç görünürlüğü, accepted command | Geri dönüş yeni karar üretiyor mu? |
| D1/D3/D7 | Olgunlaşmış yeni hesap ve ilk-ready kohortları ayrı | Aşağıdaki ankraj/pencere sözleşmesi | İlk tasarımın kalıcılıkla ilişkisi |
| Toparlanma | Kayıp sonrası ilk uygulanabilir anlamlı eyleme süre | Battle loss, kalan kapasite ve yeni kabul | Hata öğretici mi, ilerleme kesiliyor mu? |
| Ana galaksiye geçiş | Hazır olma, isteme, deneme, commit, iniş ve ilk bağımsız ana oyun eylemi | Sunucu migration kaydı + client görünürlük | Hazır oyuncu gerçekten devam edebiliyor mu? |
| Algılanan kontrol/merak/baskı | Oyuncunun açıklaması ve isteği | Küçük gönüllü görüşme/gözlem | Daha çok giriş ile sağlıklı bağlılık ayrılır |

Anlamlı kararın iç gerekçesi yalnız logdan bilinemez. Rehber kapalı olsa bile tek yanıp sönen hedef cevabı vermiş olabilir. “Yönlendirmesiz eylem adayı”, özerklik veya yetkinlik kanıtı diye adlandırılmamalı; oyuncunun seçmediği alternatifi, beklediği sonucu ve sonraki planını kısa görüşmeyle açıklayabilmesi gerekir. Bu araştırma yöntemi oyun içi sınav veya geçiş kapısı olmaz.

**Süre ve tamamlanma birlikte raporlanır:** İlk başarıya veya ilk döngüye süreyi yalnız tamamlayanların ortalamasıyla değerlendirmeyiz. Aynı başlangıç kohortunun 5/10/20/30 dakika içinde sonuca ulaşan payı, erken ayrılan payı ve henüz gözlem penceresi dolmamış payı birlikte gösterilir. Erken ayrılanlar paydadan çıkarılmaz; izleme/izin eksikliği ise sessizce başarısızlığa çevrilmez. Tamamlayanların süre dağılımı ek bilgidir; bütün oyuncuların hızını temsil etmez. Ana saat Oyuna Başla'dan, ikincil saat enlist/ilk-ready'den gelir; iki farklı başlangıcın süreleri aynı çizgiye karıştırılmaz.

### D1, D3 ve D7'nin paydasını açık tut

Bugünkü hesap ilk gözlenen **game_ready** zamanına ankrajlanır; ardışık uygun olaylar arasında 30 dakika yeni oturum koşulu vardır. Pencereler D1 için [24,48), D3 için [72,96), D7 için [168,192) saattir. Bu, hiç ready olamayan yeni hesapları içeren kayıt retention'ı değildir. ([analyticsCohorts](/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/server/src/services/analyticsCohorts.ts:9))

Birincil seri account_created kohortunu kullanmalı; girişte takılanlar da paydada kalmalı. İkincil seri ilk gerçek game_ready deneyimine ankrajlanmalı. Hesap öncesi terk ayrıca prolog/claim serisidir; account_created onu yakalayamaz. Kalıcı ilk tarih, analitik saklama geçmişi kısaldı diye eski hesabı yeni göstermemeli.

Rolling saat pencereleri ile takvim günü ayrı etiketlenir. D3 için 96, D7 için 192 saatlik gözlem penceresi tamamlanmalıdır; ilk 72 saatin tasarımı D7 sonucunu hemen vermez. Olgunlaşmayanlar başarısız sayılmaz. Test/personel/kontrollü aktör hesapları sunucu içinde belirlenmiş kuralla dışarıda tutulur; istemciye flag taşınmaz. Veri teslim/izin eksikliği “geri dönmedi” diye sessizce kodlanmaz.

Strateji oyuncusunun düşünerek sahnede kalması 30 saniye hareketsizlik yüzünden churn sayılmaz. Foreground süresi, etkileşim aralıkları ve duvar saati farklıdır; hiçbiri tek başına zihinsel karar süresini ölçmez. Son gözlenen nokta biliniyorsa, gerçekten kapatma nedeni biliniyormuş gibi raporlanmaz.

### Ölçülebilir hipotezler ve yanlışlanma koşulları

| Hipotez | Deneme | Birincil kanıt | Koruyucu ölçü / başarısızlık işareti |
| --- | --- | --- | --- |
| H1: Gerçek dünya karşılığı yetkinliği güçlendirir | Aynı ekonomi, modül/sonuç geri bildirimi | Sonucu doğru açıklama ve yardımsız yeni örnek | FPS/stall, kontrol kaybı; yalnız uzun sahne izleme artıyorsa yetmez |
| H2: Erken serbestlik kendi ikinci kararını artırır | Dar hedef sırası yerine gerçek seçenekler | Tüm uygun kohortta seçenek arzı ve bağımsız ikinci hamle | Bütçe kilidi, yanlışlıkla kayıp, yardım isteği; yalnız başarılı alt grup seçilmez |
| H3: Sonuca bağlı ayrılış gönüllü dönüşü destekler | Gerçek pending iş + sonraki karar görünürlüğü | Dönüşte sonuç→yeni eylem | Push reddi, baskı hissi, sessiz saat; salt giriş artışı yeterli değil |
| H4: Düşük risk ve toparlanma devamı destekler | Risk paketini tüm atanmış kohortta sınama; yalnız toparlanma sunumu deneyi için kayıptan sonra ayrı atama | Ana pakette tüm kohortun devamı + kayıp olasılığı/büyüklüğü; toparlanma deneyinde atanmış kayıp yaşayanların yeniden denemesi | Kaybedenleri sonradan seçme yanlılığı, ekonomi/farming, insan PvP adaleti |
| H5: Esnek çıkış macerayı ana oyuna taşır | İlk gün hazırlık paketi ve açık taşıma | Hazır oyuncunun inişi + bağımsız ana oyun döngüsü | Fon/takvim engeli, taşınmayan yatırım sürprizi, starter'ın anlamsızlaşması |

Önce farklı deneyim ve zaman bütçelerinden yeni oyuncularla küçük nitel tur yapılmalı; örneğin 6–8 kişi ilk sorun bulma turu için bir planlama adayıdır, istatistiksel temsil standardı değildir. İlk 30 dakika, erken çıkış, ertesi gün dönüş ve ilk kayıp ayrıca gözlenir. Araştırmacı cevabı söylemez; “ne bekliyorsun, ne oldu, şimdi ne yapardın?” soruları öğrenmeyi açığa çıkarır.

Sonra gerçek baseline/veri kalitesi, anlamlı en küçük etki, örneklem/power ve durdurma koşulu önceden belirlenir. Keyfî “D1 yüzde X olmalı” hedefi sektör gerçeği diye sunulmaz. Ana analiz intent-to-treat'tir; rehberi atlayan veya ilk raporu görmeyen gruptan çıkarılmaz. Dil/platform, edinim kaynağı, yoğunluk ve sezon evresi göz önüne alınır; küçük alt gruplardan kesin sonuç üretilmez.

Risk veya karşılaşma paketi kimin kaybettiğini değiştirebilir; bu paketlerde sadece kaybeden alt grupları karşılaştırmak nedensel toparlanma etkisi vermez. Bu alt grup tanısal olarak raporlanır. Yalnız toparlanma sunumunun etkisi ölçülecekse oyuncu ilk doğrulanmış kaybından sonra atanır; her iki kolda da o noktada aynı uygunluk kuralı vardır. Paket etkisi, savaş zorluğunun veya motor süresinin tekil etkisi diye adlandırılmaz.

Bir kişinin kaynak/tehdit deneyimi diğerini etkilediğinden dünya, arz ve risk varyantları uygun starter galaksisi/yerleştirme kümeleriyle atanmalıdır. Bağımsız hesap örneklemi varsayımı yanlış olur. Salt yerel sunum testi hesap bazında olabilir; davranışın ortak dünyaya etkisi yine kontrol edilir. İnsan kıtlığını kontrollü trafikle görsel olarak doldurmak sosyal deneyimleri eşitlemez.

### Teknik test ve görsel kabul planı

Uygulama başladığında her davranış değişikliği önce hedefli testte FAIL, en az kodla PASS ve uygun regresyon sırasıyla ilerler. Saf hedef seçimi; queued/working/completed, havuz/depo/tank, guide açık/kapalı ve yanlış hedef durumlarını kapsar. API/worker testleri çift POST, tekrar teslim, hedefin önce tükenmesi, boş/kısmi kargo, sonda teslimi, çağrı iptali, aynı anda iki cihaz, kaynak/slot yarışı ve sezon sınırını kapsar. Kurtarma hakkı varsa tekillik ve iptal/hibe döngüleri ayrıca test edilir.

Erken çatışma için zorunlu regresyonlar: Aegis'siz karakol galibi başka komutan gemisine doğrudan API isteğiyle saldıramaz; gerçek ve kontrollü hedef aynı izin yanıtını alır. PvE hasarı PvP'ye katılmadan onarılabilir; Aegis'li saldırganda koruma bırakma onayı ve hedef koruması korunur; gönderim/varış arasında değişen uygunluk yeniden değerlendirilir. Gönüllü operasyon yapılmadan öğretici tehdit başlatılmaz; rehber atlamak bu kuralı atlatmaz. Dolu havuza pozitif kargo dönüşü tam kaynak başarısı sayılmaz. İlk sezon paketi + carry toplamı, tek seferlik 72 saat koruma hakkı, öğrenilmeden geçilen sensörlerin hazır ana oyun kabiliyetiyle öğretimi ve altı dilde yeni izin açıklamaları ayrıca sınanır. 14 satırlık pilotta atlanan isteğe bağlı sistemler sonraki hedefi veya çıkış hazırlığını bloke etmemeli; sıfır zorunlu adımlı sistem yüzdesi geçerli olmalı ve hazır geminin uçuş/sezon engeli doğru kalmalıdır.

Geçişin her saga aşamasında çökme/yeniden başlama; tek başkent, tek kargo ve devam edebilir işlem kabulüdür. Aktif iş iadesi varken aynı snapshot'ta önizleme ve commit kargosu eşleşmeli; hem carry tavanının altında hem üstünde sınanmalıdır. 24/48/72 saat offline, uyuyan geminin farklı konumda uyanması ve animasyon ortasında yenileme ayrı senaryodur. Test kaynağının varlığı kadar gerçek normal akış önemlidir.

350×812, DPR 2, mobil/dokunmatik Chromium ve belirtilen SwiftShader ayarlarıyla yürüyüş yapılmalı; görüntüler açılıp incelenmelidir. Bir yürüyüş işaretleri takip etmeyi, diğeri rehbersiz gerçek karar vermeyi sınar. El/nabız seçicisine tıklayan otomasyon öğrenme kanıtı değildir. Uzun locale, büyük miktar, sticky footer, tam dokunulabilir kontrol, sessiz/hapticsiz/lowGPU, context kaybı ve arka plan dönüşü kabul kapsamındadır. Gerçek düşük/orta Android cihazda profil ve ses/autoplay/touch ayrıca gerekir.

Test/typecheck/lint ortak heavy kilidinden geçer; kısa hedefli koşu tek worker, orta/tam koşu dört worker ve worker başına 1024 MiB heap ile yapılır. Her DB worker kendine özgü, migration uygulanmış ve temizlenen _test DB kullanır; bellek durumuna göre proje kuralları uygulanır. Uzun ekonomi/sezon simülasyonu veya snowball audit ayrı açık talep olmadan bu planın parçası değildir.

### Doğrulanmamış olanlar ve ilk prototipin karar ölçütü

Bu çalışmada yeni insan öğrenimi, gerçek D1/D3/D7, cihaz performansı, iki insan arasında ilişki, ilk günün tam kaynak/uçuş çizelgesi veya çok günlük canlı iniş ölçülmedi. Fiziksel anten varlığı üretilmedi; VFX ve kamera prototipi yapılmadı. Araştırma tam metni bu tur erişilemeyen ownership kaynağı ve ödül meta-analizi için erişim sınırı korundu; Andersen PDF'i bu tur zaman aşımına uğradığından önceki erişim/üniversite indeksli metinle sınırlı değerlendirme yapıldı. Bilimsel aktarımın Astera'daki etkisi henüz bilinmiyor.

İlk geliştirme prototipi, yeni oyuncunun bir fırsatı fark edip tercihini açıklayabildiği, gerçek filosunun sonucunu doğru okuyabildiği ve tek hedef zorlaması olmadan yeni karar verebildiği anda değer üretmiş olur. Bu olmuyorsa üçüncü güne daha fazla sistem eklemek yerine ilk döngünün nerede koptuğu çözülmelidir. Geri dönüşün nedeni zorunluluk veya ceza korkusu değil, kişinin kendi kararının devamını merak etmesidir.

### Belge review'unda düzeltilen maddi açıklar

| Açık | Düzeltme |
| --- | --- |
| Erken PvE'nin ortak savaş fact'i üzerinden insan PvP'sini istemeden açması | Saldırgan uygunluğu, PvE/PvP/dock ayrımı ve doğrudan API regresyonları eklendi. Bu değişiklik oyun koduna uygulanmadı. |
| Ana galaksi başlangıç paketinin ve yeni koruma saatinin eksikliği | Hazır sensörler, başlangıç filosu/kaynakları, carry'nin eklenmesi ve 72 saat hakkı açıklandı; hızlı oyuncunun öğrenme devamı bağlandı. |
| Pozitif kargonun tamamını kazanç sayma riski | Havuz taşması ve net kazanım ayrıldı; ilk başarı metriği net sonuca bağlandı. |
| İlk 30 dakikanın başlangıç noktasının belirsizliği | Ana saat prolog/kayıt/yükleme dahil Oyuna Başla'dan başlar; tamamlayanlar ve bütün kohort ayrı gösterilir. |
| Risk deneyinde yalnız kaybedenlerin kıyaslanması | Tüm atanmış kohort ve kayıp sonrası başlayan toparlanma deneyi ayrıldı. |
| Karşılık veren dünya anının P2'ye ertelenmesi | Tam 72 saat deneyimi için asgari karşılık P1'e, ileri sosyal/aktör derinliği P2'ye ayrıldı. |
| Baskın kotasının saldırgan başına günlük kota gibi okunabilmesi | Hedef başına kayan 24 saat ve saldırgan–hedef başına 12 saat ayrımı açıklandı. |
| Göç önizlemesi ile commit'te aktif iş iadelerinin farklı hesaplanması | Koddan çıkarılan örnek, ortak projeksiyon gereği ve carry tavanı regresyonları eklendi. Mevcut oyun kodu düzeltilmiş sayılmıyor. |
| 14 adımlık pilotun eski required/hedef/yüzde hesabıyla çelişmesi | İsteğe bağlı sistem sınıflaması, hazırlık/onarım ayrımı ve sıfır zorunlu adımlı grup kabulü aynı pakete bağlandı. |

Review, mevcut kuralları ve kısa süre/bedel aritmetiğini yeniden kontrol etti; ilgili birincil araştırmaların örneklem/çıkarım sınırları da kontrol edildi. Yeni canlı oyun, insan playtesti, paket testi veya ekonomi simülasyonu yapılmadı. Önceki sayısal denge adayları hâlâ doğrulanacak önerilerdir.





