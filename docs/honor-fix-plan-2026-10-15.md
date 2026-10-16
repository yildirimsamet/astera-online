# Honor düzeltme planı — 15 Ekim 2026

**16 Ekim güncellemesi:** aşağıdaki plan ve aday-yayın notları tarihsel kayıttır.
Uygulanan düzeltmelerin güncel kanıtı [CR kaydında](honor-cr-2026-10-16.md),
v4 operasyonel açılış/özel silah/ödül/devir provası
[release kaydında](honor-v4-release-rehearsal-2026-10-16.md). Canlıda açılış yapılmadı.

Durum: **inceleme ve öneri; bu belge düzeltmelerin uygulandığı veya testlerinin geçtiği anlamına gelmez.** Mevcut kod, önceki gerçek servis hata kayıtları ve aday hesaplar karşılaştırıldı. Bu tur uygulama kodu/DB değiştirilmedi, test çalıştırılmadı. Önceki 633 başarılı kontrol, açık hata senaryolarının kapandığına kanıt değildir.

Amaç: denk/üst rakibe anlamlı, verimli başarıyı öne çıkarmak; zayıfa baskıyı ve anlaşmalı puan üretimini sınırlamak; mağdur oyuncunun Honor'unu saldırıya uğradığı için azaltmamak. Hakimiyet mevcut hesabıyla devam eder. Mutlak abuse engeli veya bütün olası durumların ispatlandığı iddia edilmez.

**Son owner kararı:** aşağıdaki iki karar netleşti. Tek savunan gerçek başarıdan pozitif Honor kazanabilir, savunmada Honor kaybetmez; destekli savunma 0 kalır. Denk/üst hedefe gerçekten etkili EMP ve radyasyon bombası küçük pozitif Honor kazanabilir. Kullanıcının gerekçesi, füze sonucunun rakibin savunma hazırlığına bağlı belirsizliği ve bu başarıya küçük karşılık verilmesi. Aşağıdaki alternatif savunma-0 dalı artık seçili değildir. Kesin taktik katsayılar henüz kalibre edilmedi; bu onay sonuçsuz her fırlatışa sabit puan verilmesi anlamına gelmez.

Kod kontrolü: mevcut interception yolu hazır INTERCEPTOR mühimmatı ve zaman/tespit koşullarıyla çalışıyor; rastgele isabet zarı olarak modellenmiyor. Oyuncunun bilmediği savunma hazırlığı belirsizlik yaratıyor. Honor bu belirsizlik için ayrıca şans çarpanı eklemeyecek. Engellenen füze saldırana pozitif taktik başarı üretmez; gerçek silah kaybı ve savunanın imha başarısı kendi kurallarıyla ayrıca değerlendirilir. Radyasyon uçuşunun `HIT` olması alan kaynağı oluşturur, tek başına gerçek oyuncu zararı kanıtı değildir; boş hedefe kaynak bırakıp tekrar puan üretme yolu açılmayacak. Kayda geçen gerçek yeni taktik etki için küçük ödül tasarlanacak; aynı etkiyi periyodik işlemlerde yeniden ödüllendirmek yok.

## 1. Önce sözleşme: ne hata, ne ürün kararı?

- Onaylanmış ortak taraf politikası: ortak saldırgan pozitif kazanmaz; saldırgan kalıcı kayıp/zayıf hedef yaptırımları devam eder. Destekli savunma tarafı 0 alır. Aynı sahibin birden çok filosu ortak sayılmaz. Son vuruş hesabı yoktur.
- **Savunanın hiç puan almaması henüz karar değildir.** Mevcut kod tek savunana gerçek askerî başarısıyla pozitif verir, negatif vermez. Son kullanıcı mesajı bu konuda beklenti farkını ortaya koydu.
- Önerim: tek savunanın gerçek başarısına pozitif karşılığı korumak. Ortak saldırıya tek başına karşı koymak ve zamanında gemi üretip savunmak da anlamlı askerî başarıdır. Dezavantaj: Honor yalnız saldırı tercihini ölçmez; kimlerin saldırıya uğradığından da etkilenir. İlişki ve çift sınırı bu teşviki sınırlar, tamamen yok etmez.
- Kullanıcı bütün savunanlar için 0 isterse bu ayrı yeni sürüm politikası olur. Savunma pozitifleri ve çift tüketimleri kaldırılır; gerçek savunma kayıplarından doğan karşılık hakkı korunur. Reaktif savunma pozitif düzeltmesi bu dalda gereksizleşir; yine askerî envanter ve saldırganın hesabı doğrulanır. Ödül dağılımı ayrıca karşılaştırılır.
- Aynı rakipte azalan karşılık ve son 7 gün klan/yardım filtresi mevcut anti-abuse politikalarıdır. Bunları kaldırmak veya C=200'ü değiştirmek bug fix değildir. İlk düzeltme paketi katsayı değiştirmez; bedellerini oyuncuya açıklar.

## 2. P1 — Silent Space dönüşünde eksik referans

**Kanıt / neden:** `commanderTransfer.ts` gerçek yerleşimi değiştiriyor fakat hedefte Honor başlangıç gözlemi yazmıyor. `worldHonorCommitment`/`monumentHonorCommitment` eksik geçmiş için sadece yeni hesap `joinedAt` kontrolü yapıyor. Eski oyuncunun yeni yerleşimi bu koşula uymuyor. Gerçek destekli savaşın rollback'i, hedef rehberi hatası ve açılışın engellenmesi önceki incelemede yeniden üretildi. SHADOW da etkileniyor.

**Yapılacak:**

1. Transfer tamamlanırken, aynı transaction içinde hedef sezon destekliyorsa gerçek mevcut envanter gözlemi yaz. Honor kilit/oyun kilidi sırasını koru; transfer retry'ı çift gözlem veya çift işlem üretmesin.
2. `commanderTransfers` içindeki immutable yerleşim zinciri ve sıra bilgisinden gerçek giriş zamanını belirle. Yalnız `joinedAt`, bugünkü `mainEnteredAt` veya duvar saati eşitliğiyle karar verme. Aynı milisaniyede kalkış ve dönüşün gerçek işlem sırası da ayrılmalı.
3. Kalkıştan sonra gerçekten gelen katılımcı için delili açıkça “geç katılım” olarak kaydet. Önerilen referans: desteğin/katılımın kendi gönderim anında dondurulan ilk geçerli gerçek referans; normal saldırının eski kalkışına geriye yazılmaz. Aynı zamanlı kayıtları ayıracak mevcut sıralama delili yetersizse küçük bir placement/reference-order alanı eklenir. Bu zaman istisnası yeni sürüm sözleşmesinde açıkça belirtilir.
4. Seçilmiş ev sahibinin eski hedef sınıfı ve saldırganın kalıcı kayıp hesabı korunur. Gönüllü zayıf destek yüzünden yeni zorbalık cezası yaratılmaz. **Geç destek bütün savaşı `eligible=false` yaparak ev sahibine verilen zayıf hedef cezasını silemez.** Bu, mevcut yeni-hesap geç-katılım istisnasında da kontrol edilecek.
5. Dönüş öncesindeki gerçek ana-sezon gözlemlerini ve puan/çift/tekrar kayıtlarını silme. Gidip gelme sezon Core tepesini, henüz dolmamış 24 saatlik askerî tepeyi veya rakip bütçelerini yenilemesin. Silent Space'te gözlenmemiş geçmiş için tepe değeri uydurma; bu sınır ayrı görünür kanıt eksikliği olarak kaydedilsin.
6. Daha önce dönmüş mevcut oyuncular için önce salt okunur eksik kayıt listesi çıkar. Onarım yalnız gerçek mevcut zamana gözlem koyabilir. Eski puanları veya eski kalkışları bugünkü envanterle dolduramaz. Eski uçuşlar için kanıtlı geç-katılım yolu, belgesiz bozuk kayıt için açık inceleme gerekir.

**Neden doğru:** eksik olan puan değil yerleşim/güç delili. Düzeltme gerçek olayı kaydeder, geçmiş icat etmez ve destek ekleyerek ceza sildirmeyi önler. Sadece dönüşe snapshot eklemek eski kalkıştaki eksikliği çözmez; iki sınır birlikte ele alınır.

**Kabul testleri:** SHADOW/ACTIVE; dönüş kalkıştan önce/sonra/aynı ms; yeni hesap ve geri dönen eski hesap; dünya/ortak saldırı/anıt; hiç eski gözlemi olmayan ve eski gözlemi bulunan dönüş; tekrar gidip gelme; desteğin gerçek ulaşması/geri dönmesi; tek gemilik geç destek; zayıf ev sahibi yaptırımının korunması; history corruption'ın geç katılım sanılmaması; transfer rollback/retry; hedef GET'inin yazmaması; açılış önizlemesi. Gerçek savaş raporu ve gerçek kayıplar oluşmalı, puan tam bir kez yazılmalı.

## 3. P1 — 1v1 ilişki geçmişinin galaksi değişiminde kaybolması

**Neden:** `honorRelations.ts` klan üyeliğini ve teslim edilmiş yardımı yalnız savaş sezonu kimliğinde arıyor. Aynı oyuncuların Silent Space üyeliği başka sezon satırında duruyor.

**Yapılacak:** mevcut savaş aktörlerinin doğru sezonda bulunma şartını koru. İlişki geçmişini aynı oyuncu kimliklerinin aynı döngü içindeki gerçek yerleşimlerine genişlet; mevcut tablo ve transfer/cycle kayıtlarını kullan. Son 7 günlük pencere, üyelik zaman aralıklarının gerçekten örtüşmesi ve yardımın gerçekten teslim edilmesi değişmesin. Eski döngü/yeni karakter geçmişi veya sırf aynı klan adı ilişki yaratmasın. Normal çiftte ilişki gönderimde dondurulur; geç katılımcının ilişki zamanı 2. maddedeki gerçek katılım deliliyle tanımlanır.

**Neden doğru:** gidip gelmek anlaşmalı kişileri ilişkisiz yapmaz. Yalnız sezon filtresini tamamen kaldırmak ise ilgisiz geçmişi taşıyabilir; kapsam kimlik + döngü + gerçek zamanla sınırlanır. Negatif saldırı sonuçları ilişki yüzünden silinmez.

**Kabul testleri:** gerçek OUT/RETURN + klan kur/join/leave; 7 günün hemen içi/tam sınırı/dışı; örtüşmeyen üyelik; aynı isimli farklı klan; yardım gönderilmiş/teslim edilmiş/iptal edilmiş; farklı döngü; gerçek ilişkisiz rakip; ilişkili 1v1 iki yönde pozitif 0, uygun negatifler korunmuş. Ortak v3 pozitif yasağı devam etmeli.

## 4. P1 — Eşzamanlı sonuçlarda kayıt sırasından doğan adaletsizlik

**Neden:** v3 bir çiftin azalan karşılığını sırayla tüketiyor. Aynı etkili zamandaki eşdeğer olaylar kimlik sırasına göre 66,67/33,33 alabiliyor. Aday v2 düzeltmesi v3'e dahil değil.

**Yapılacak:** yeni lansman sürümünde aynı etkili milisaniyedeki uygun olayların yalnız ortak muhasebesini birlikte yap. Her savaşın kendi K/L verimliliği ve v3 ortak-pozitif yasağı ayrı hesaplanır. Pozitif çift artışı ham hak ediş oranıyla paylaşılır. Daha eski karşılık bütçesi bir kez, gerçek zarar oranıyla tüketilir; aynı anda doğan zarar önceki provokasyon olmaz. Adaydaki tekrar katsayısı ortalaması, küçük/boş olayla büyük yaptırım azaltılmadığı test edilerek alınır. Gerçekten farklı zamanlı savaşların sırası korunur.

`advanceSimultaneousHonor` bugün doğrudan v2 kullanıyor; yalnız çağrı koşuluna v3 eklemek ortak pozitifleri yeniden açar. Hesap, immutable sürüm politikasını tek yerde seçmeli; büyüyen bir bayrak sistemi yerine açık birkaç sürüm davranışı yeterli. `settleHonor` aynı-at rebuild koşulu da birlikte güncellenmeli.

**Neden doğru:** avantajı UUID'den gerçek başarı payına taşır. Ayrı savaşları tek savaşa veya son-vuruş hesabına dönüştürmez. Aynı ms grubunun sonradan gelen üyesi rapor payını değiştirebilir; geçmiş journal sonucu ve toplam birlikte yeniden hesaplanmalı, ilgili ekranlar yenilenmelidir.

**Kabul testleri:** iki callback sırası/ters UUID; 100+100→50/50; asimetrik hak ediş; iki farklı rakip; ortak ve solo karışımı; zarar 0/tiny/büyük; olay bölme; düşük hedef tekrarları; tek karşılık bütçesinin iki kez harcanmaması; geç olay/retry/rollback/sezon kapanışı. Kimlik farkı en fazla bölünmez bir mikro-Honor artığını etkileyebilmeli.

## 5. Savunan kazanacaksa — uçuş sırasında gerçek savunma üretimi

**Kanıt:** eski kalkış referansı 0 olan savunan, gerçek yeni üretimiyle askerî kayıp verdirdiğinde v1/v3 0 alıyor. v2 yalnız `navy===0` için `weight` kullanıyor.

**Adayı doğrudan almak neden yeterli değil:** `weight` kalkan katkısı içerebilir ve yalnız savaştaki katılımı temsil eder. Ayrıca 0→çok küçük pozitif navy geçişi özel yolu kapatır; küçük bir eski geminin sonucu iyileştirmesi/kötüleştirmesi ayrıca incelenmeli. Bu tur bu sınır için yeni çalıştırılmış test yok; statik risk olarak kaydedildi.

**Önerilen düzeltme:** sadece savunanın kendi pozitif hesabında, `max(kalkıştaki referans N, savaş öncesi gerçekten sahip olduğu askerî N)` kullan. Savaş öncesi N merkezi askerî envanter tanımından, kalıcı kayıplar uygulanmadan alınır; yalnız savaşa sokulan filo veya kalkan ağırlığı değildir. Böylece sıfıra özel istisna yerine aynı kural bütün savunanlara uygulanır. Tier ve saldırganın taahhüt ettiği hedef sınıfı geriye dönük değişmez. Uçuşta savunma güçlendirmek saldırganı sonradan zorba yapmaz.

**Uyum / bedel:** gerçek savunma başarısını tanır; sonradan çok büyüyen savunmanın kolay başarı bonusunu da sınırlayabilir. Yeni politika olduğundan tek savunanın kazanması kararıyla birlikte onaylanmalı. Savunma 0 seçilirse bu pozitif hesap eklenmez.

**Kabul testleri:** başlangıç N=0/çok küçük/büyük; aynı geminin kalkıştan önce veya sonra üretimi; başka gezegende/dokta/uçuşta kendi filo; kalkan-only; support sahipliği; ilişkili transfer; tüm güç bantları; gerçek sıfır imha; ücretsiz rebuild; v3 destekli savunma 0; saldırgan hedef sınıfı ve cezaları değişmemiş.

## 6. P1 — Özel silahlar ve diğer PvP sonuçlarının kapsamı

**Kanıt:** taktik aday fonksiyon var ama gerçek stratejik sonuç defterine bağlı değil. Stratejik stoklar yalnız v2 askerî referansına dahil. Radyasyon bombası ayrı yeni mekanik; eski EMP katsayısını ona kopyalamak doğru değil.

**Yapılacak:**

- Önce gerçek oyuncu-oyuncu zarar yollarını listele: normal/ortak/destek/anıt; EMP/Death Star; interception; radyasyon bombası impact ve sonraki zararları. İsimden PvP varsayma: mevcut intergalactic convoy servisi başka bir oyuncu savunmacısı göstermiyor; NPC/PvE ise Honor dışında kalması doğrudur. Kesin kapsam gerçek sahiplik/resolver üzerinden doğrulanacak.
- READY ve gerçek LAUNCHED stratejik varlıkların sabit katalog değerini, tek gerçek sahibine bir kez say. Tamamlanmamış üretim, yok olmuş stok veya başkasının ele geçirdiği stok sayılmaz. Target preview ve gerçek commitment aynı envanter yardımcısını kullanmalı; önizleme sadece normal gemileri okuyamaz.
- Gönderimde hedef/ilişki/sürüm dondur; impact'te gerçek yeni etkiyi kaydet. Tek füze interception veya impact üretir; ikisi birden ödüllendirilmez. Başarılı tüketim otomatik askerî imha kaybı sayılmaz; düşman tarafından gerçekten yok edilen silah ayrı kayıptır.
- Önerilen EMP yönü: denk/üst hedefte gerçek yeni taktik etkiye sınırlı pozitif; etkisiz vuruş 0; zayıfta gerçek baskıya negatif. Çalışmayan ground'u tekrar kapatmak yeni pozitif vermez. Kaba etki bantları gizli kesin savunmayı puandan sızdırmamalı. Mevcut 9 ham katkı / 11,25 üst sınır adayı **onaylanmış sonuç değildir**; gerçek etki ve ödül sınırlarıyla karar verilecek.
- Interceptor'ın gerçek imhası, savunan kazanımı korunursa normal verimlilik/ilişki/çift sınırından geçer. Savunan daima 0 seçilirse otomatik interceptor ödülü eklemek bu kararla çelişir; ayrıca açık bir istisna kararı gerektirir.
- Radyasyon için fırlatmayı başarı sayma. Uzayan alan etkisinde gerçek zarar sahibini, olay kimliğini ve zamanını taşı; aynı kaybı impact, periyodik işlem ve sonraki savaşta tekrar yazma. Çevresel radyasyonun PvP sayılmaması, yolda sonradan giren filo/destek, kontrol değişimi ve sezon sınırı ayrıca test edilir. Atıf kurulmadan genel silah kuralı hazır ilan edilmez.
- Yeni kaynaklar `pendingHonorLegacySources`, açılış uçuş sınırı, rapor, kapanış flush ve retry listelerine de girer. Sadece score writer eklemek yeterli değildir. Açılıştan önce bırakılmış kalıcı silah etkisi sonradan gizlice yeni yarış puanı üretmemeli.

**Neden doğru:** zayıfa baskı silah türü değiştirerek yaptırımdan kaçamaz; üst hedefte imha dışı gerçek başarı da değerlendirilebilir. Yeni katsayılar ve radyasyon etki tanımı ürün kararıdır; teknik adapter kapsamı bu kararların yerine geçmez.

**Kabul testleri:** gerçek etkili/etkisiz/repeated/related/weak/upper impact; Core outage/stored charge; eski blackout/yeni süre; interceptor kazanır/kaybeder; sahiplik ve hedef değişimi; takip raid'inde çift sayım yok; farklı kaynakların aynı rakip sınırını paylaşması; yeni kaynakların SHADOW/açılış/retry/kapanışı. Silah kaynak ödülünün ucuz anlaşmalı çevrim yaratmaması ayrıca küçük sayısal örneklerle ölçülür.

## 7. P1 — Sezon devrinde ana Honor yarışının devamı

**Yapılacak:** ilan edilmiş onaylı Honor programını yeni MAIN sezonun yaratılmasıyla aynı transaction'da hazırla. Program sürümü/mode/reward sözleşmesi açık olmalı; her bootstrap'ta çalışan kodun son sabitine göre değişmemeli. Yeni sezonun ilk oyuncusunun oluşturulması, ilk üretimi ve ilk saldırısı geçerli gözlemlere sahip olmalı. WAITING/Silent Space otomatik ranked olmaz. Yeni shard, manuel sezon ve rollover aynı temel yolu kullanmalı.

Aktif sezona ilk geçiş ayrı kalır: açık operatör işlemiyle SHADOW, sonra ilan edilen sıfır puanlı açılış. Sırf deploy yeni canlı sezonda Honor'u sessizce açamaz. İlk onaylı yayından önce yeni sezonlara ACTIVE zorlamak da doğru değildir.

**Neden doğru:** yarışın sürdürülebilirliğini sağlar, sezon ortasında sürpriz puan/ödül programı yaratmaz.

**Kabul testleri:** gerçek force-end + rollover; iki galaksi/yeni galaksi/WAITING; ilk join ve ilk savaş; çift callback; bootstrap rollback; eski Honor ve Hakimiyet ödülünün tek teslimi; yeni sezonda sayaçların temizliği; mevcut aktif sezonun değişmemesi.

## 8. P2 — Honor değişiminin sıralamaya yayınlanması

**Yapılacak:** ledger'da işlem öncesi/sonrası görünür toplamları karşılaştır. ACTIVE yarışta gerçek değişim varsa mevcut transaction/outbox üzerinden `score` yayınla. Retry aynı puanı tekrar yayınlamaz; SHADOW yayınlamaz; rollback bildirim bırakmaz. Rebuild yalnız son olayın oyuncularını değil değişen eski toplamları da kapsar. Toplam değişmeden eski rapor payları değişebiliyorsa rapor sorgularına da mevcut uygun invalidation olayı ulaşmalı.

**Neden doğru:** puanın yazılması ve oyuncunun gördüğünün değişmesi aynı işlem sonucudur. Periyodik polling veya yeni bildirim altyapısı gerekmez. Hakimiyet de değiştiğinde mevcut yayınla gereksiz çift yenileme mümkünse aynı işlemde birleştirilir.

**Kabul testleri:** gerçek Honor-only savaş; üçüncü oyuncunun açık leaderboard/kürsüsü; negatif-only; eşit toplamda değişen rapor; SHADOW; retry; rollback; geç rebuild. 60 saniyelik `staleTime` canlı yayın yerine kullanılmaz.

## 9. P2 — Prestij ve oyuncu açıklamalarının tutarlılığı

**Yapılacak:** kalıcı anıt isimlerini önceki sezonun dondurulmuş ana yarışına bağla: Honor aktiftiyse Honor sırası; Honor yoktuysa tarihsel Hakimiyet sırası. Eski sezonların isimleri geriye dönük güncel hesapla üretilmez. Honor aktif ama pozitif hak eden yoksa otomatik Hakimiyet kazananını “Honor şampiyonu” yapma; isimsiz kalması önerilir.

Eşit Honor aynı sırayı korur. Aynı sırada birden çok adın kalıcı yüzeye nasıl sığacağı ayrıca çözülmeli; UUID ile birini seçip diğerini yok saymak kabul edilmez. Mevcut anıt başına tek ad kısıtıyla çatışma varsa küçük bir ortak onurlandırma gösterimi veya görünür eşitlik açıklaması seçilmeli; gizli tie-break eklenmez.

Gönderim/rapor metinleri: “savunmada azalmaz” ile “savunmada değişmez” ayrımı; “ortak saldırıda kazanç yok, yaptırım olabilir”; 7 günlük ilişki nedeni; aynı rakipten azalan karşılık; boş yağma/etkisiz silah açıklaması. Sonucu tahmin ederken kesin gizli filo ve kesin gelecekteki puan vaat edilmez. Altı dil ve 350 px gerçek ekranlar kontrol edilir.

## 10. 1v1 rakip sınırı — şu an katsayı değişikliği önermiyorum

**Korunacak:** sezonluk yönsüz çift; C=200; pozitif azalan karşılık; negatifler bütçeyi yenilemez; 24 saatlik zayıf tekrar ve dar karşılık ayrı kalır. Bu sınır aynı rakibe savaş iznini veya ganimetini engellemez.

**Bedeli açık:** meşru uzun rekabet de daha az puan getirir. İki tarafın pozitif savunma/saldırı hakları aynı bütçeyi paylaşır. Bu yanlış hesap değil mevcut tercihtir; savunan 0 seçilirse dağılım zaten değişecektir. Aynı anda katsayıyı da değiştirmek neden-sonucu belirsizleştirir.

**Doğrulama:** sabit toplam ham hak edişi parçalara bölmek, karşılıklı yön değiştirmek, koloni/klan/operasyon değiştirmek bütçeyi artırmasın; farklı rakip ayrı olsun; ilişkili 0 kazanç taze pozitif hak tüketmesin; ceza bütçeyi geri doldurmasın; minik miktar yuvarlama döngüsü oluşturmasın. Bir meşru uzun rekabet ile çoklu anlaşmalı rakip örneği yan yana raporlanır. Gerçek prod geçmişinde eksik tarihsel güç/ilişki varsa tarihsel Honor sıralaması uydurulmaz.

## 11. Birleşik sürüm, uygulama sırası ve tamamlanma koşulu

1. Savunanın pozitif hakkını netleştir; o karardan bağımsız transfer/ilişki/publish hata düzeltmelerinin testlerini yaz.
2. Kanıtlı kırmızı transfer ve ilişki senaryolarını kalıcı testlere taşı; düzelt, yeşile dönmesini göster. Geç destekle ceza silme ve dönüşle geçmiş temizleme risklerini ayrıca üret.
3. Aynı zaman muhasebesi + seçilen savunma politikası + ortak pozitif yasağını tek yeni **aday lansman sürümünde** birleştir. Örneğin v4; nihai sürüm numarasından çok eski sürümlerin değişmezliği önemlidir. v1/v2/v3 eski delillerini aynı sonuçla tekrar üretmeli. Sadece sürüm numarası büyütmek release hazır demek değildir.
4. Özel silah politikalarını netleştirip gerçek adapter/önizleme/açılış sınırlarını tamamla. Gerekli delil alanları için küçük migration; genel bir yeni olay sistemi kurma.
5. Sezon hazırlığı, yayın ve kalıcı prestiji tamamla. Açılış CLI'sı yalnız doğrulanmış lansman sürümüne izin versin; eksik aday salt destekleniyor diye açılmasın.
6. Kısa gerçek servis provası: yeni sezon ve mevcut sezonda kapalı deploy → SHADOW → temiz ranked açılış → öncesi/sonrası uçuşlar → normal/özel savaş → retry/geç sonuç → sezon kapanış → ödül → rollover. Eski SHADOW sürümünü sessizce yükseltme; gerekiyorsa açık, deneme kayıtlarını koruyan yeniden hazırlık planı ve yeterli yeni gözlem süresi gerekir. Mevcut ACTIVE sezondaki kazanılmış puanlar geriye dönük değiştirilmez.

**Tamamlanma ölçütü:** her kanıtlı bug önce RED sonra GREEN; yeni politika sınırları ve gerçek resolver entegrasyonları yeşil; Hakimiyet ve donmuş eski Honor davranışları korunmuş; API/worker aynı sürüm; SHADOW'da gerçek savaş durmuyor; bütün PvP kaynakları listelenmiş ve her birinin puan gerekçesi belli; UI sonucu doğru açıklıyor; ödül tek kez teslim; yeni sezon Honor ile başlıyor. Yeni veri eksikliği veya testte başarısızlık varsa açıkça raporlanır.

Kontroller owner PC kısıtlarına uygun tek workspace/tek worker, `nice -n 10`, en çok 4 GiB Node heap ile sıralı yapılır. DB testleri yalnız ayrılmış silinebilir test DB'de; oynanabilir local sezon ve production değiştirilmez. Uzun ekonomi/ajan sezon simülasyonu bu planın otomatik parçası değildir. Bu rapor deploy veya aktif sezon değişikliği yapmaz.

## Netleşen owner kararları

1. **Onaylandı:** tek savunanın gerçek başarısı pozitif Honor getirebilir, kayıp hiçbir zaman negatif olmaz; destekli savunma 0 kalır. Reaktif savunma ve interceptor testleri bu sözleşmeye göre hazırlanacak.
2. **Onaylandı:** gerçekten etkili denk/üst EMP ve radyasyon bombası küçük pozitif Honor getirebilir. Etkisiz veya aynı çalışmayan sistemi tekrar kapatan vuruşa pozitif yok. Kesin katsayı ve radyasyon atfı küçük gerçek senaryo sonuçlarıyla somutlaştırılmadan kilitlenmeyecek.

Bu iki tercih için yeniden onay istenmeyecek. Kanıtlı teknik hataların düzeltilmesi için yeniden oyun tasarımı veya kapsamlı katsayı kalibrasyonu gerekmiyor.

## Uygulama doğrulaması — devam eden kontrol, 15 Ekim

Transfer/geç katılım, ilişki kapsamı, eşzamanlı muhasebe, gerçek savunma envanteri, özel silah adapterleri, sezon devamlılığı, yayın ve Honor anıt onurlandırması yeni v4 politikası için uygulandı. v1/v2/v3 sezon sözleşmeleri korunuyor; v4 henüz SHADOW adayıdır, ranked açılış koruması kaldırılmadı. Mevcut aktif sezona veya oynanabilir local veritabanına müdahale edilmedi.

Ek incelemede bulunan ve RED → GREEN doğrulanan sorunlar:

- Radyasyon aralıklarının ayrı işlenmesi, aynı anda başlayan bombaların tekrar katsayısını düşürebiliyordu. İlk ortak katsayı kesir olarak korunuyor; aynı zarar tek veya çok aralıkta aynı yaptırımı üretiyor.
- Honor finalizer'ı radyasyon envanter finalizer'ından önce kayıt olmuşsa muhasebe kilidi erken alınabiliyordu. Fiziksel işlemler daima muhasebeden önce tamamlanıyor; hata birlikte rollback oluyor.
- Özel silah önizlemesi normal gemileri sayarken gerçek kalkış stratejik stokları sayıyordu. İkisi aynı owned-inventory yardımcısını kullanıyor; v4 solo politikası API'de de doğru bildiriliyor.
- Önceden oluşturulmuş boş gelecek döngü, ilan edilmiş Honor programını kesebiliyordu. Henüz MAIN sezonu olmayan döngü, programın iptali sayılmıyor.
- Taktik savunanın katkı yüzdesi, özel askerî referans oranını açığa çıkarabiliyordu. Taktik savunma raporunda bu döküm sunulmuyor.
- Anıta kalkıştan sonra gelip gerçek isabete tanık olan oyuncu, kendi isabet raporuna erişemiyordu. Gerçek sonuç bildiriminin alıcısı raporu okuyabiliyor. Sonradan gezegeni almak eski raporları açmıyor.

Doğrulama kayıtları `.dev/honor-fixes-20261015/` içinde: `server-honor-regression-final.log` 44 dosya / 306 PASS; 2 koşullu eski-ruleset senaryosu atlandı (aynı kaçış/geri çağırma senaryoları güncel ruleset'te geçti). `web-honor-regression.log` 107 PASS. `radiation-monument-green.log` 9 PASS. `server-types-4.log` sunucu tip kontrolü temiz. `visual-tactical/measurements.json` altı dil × iki genişlik × üç gerçek React görünümü, 36 görünüm taşma/çeviri hatası olmadan geçti; görseller ayrıca gözle incelendi.

Henüz bu kayda eklenmeyen kontroller: tüm workspace tip/lint ve geniş ordinary regresyonların son koşusu; v4'ün ranked olarak yayınlanması için ayrı operasyonel sürüm/açılış provası. Yukarıdaki sonuçlar bu eksik kontrollerin yerine geçmez. Canlı deploy yapılmadı.

### Temel oyuncu akışının ek incelemesi

Owner'ın happy-path incelemesi isteğiyle üç görünür bağlantı hatası daha RED testlerle doğrulandı:

1. `radiation_bomb_result` rapora yönlenmiyordu. Interception bildirimi de bombanın UUID'sini normal mission sanıyordu; rapor anahtarı `bomb:<UUID>`. İki bildirim doğru raporu açıyor; anıt bildirimi haritaya öncelik verip raporu atlamıyor.
2. İlk Honor sonucu, başka gameplay bildirimi olmadan oluştuğunda açık rapora yenileme gitmiyordu. İlk kayıt iki katılımcıyı özel `honor` olayıyla yeniliyor; tekrar işlem yayın/puan üretmiyor. Client bu olayda yalnız raporları yeniliyor, tüm oyun sorgularını tekrarlamıyor.
3. Komutan Silent Space'e taşınınca eski puan defterde durduğu halde rapor sorgusundaki mevcut-sezon join'i sonucu gizliyordu. Geçmiş sonucun okuma yetkisi gerçek katılımcı kimliğine bağlı; mevcut yerleşime bağlı değil. Normal/taktik rapor ve radyasyon raporu bu kuralla aynı. Yeni galaksinin yarışına eski puan eklenmedi; eski konum bağlantıları güncelmiş gibi açılmıyor.

`happy-path-ui-red.log` 5 hatayı, `happy-path-server-red.log` ilk-sonuç yenileme hatasını gösteriyor. Düzeltmelerden sonra `happy-path-ui-green.log` 61 PASS; `happy-path-server-green.log` 20 PASS. `happy-core-paths.log` yeni v4 gerçek 1v1, boş yağma, zayıf hedef, sivrisinek saldırı, kaçış/geri çağırma, ortak saldırı ve anıt yollarının geçtiğini gösteriyor; aynı koşuda eklenen geçmiş-rapor testinin fixture kapanış sırası düzeltildi. Gerçek kaybolan sonuç `receipt-transfer-red.log` ve `tactical-receipt-transfer-red.log` ile ayrıca yeniden üretildi. Nihai birleşik rapor testleri ve son statik/regresyon kapıları devam ediyor.
