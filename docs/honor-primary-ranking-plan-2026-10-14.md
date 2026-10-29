# Honor ana sıralaması — Hakimiyet'in yanında yeni sezon hedefi

**15 Ekim kural değişikliği:** kullanıcı ortak tarafta pozitif Honor'u kaldırmayı
onayladı. Yeni sürüm 3'te ortak saldırganlar ve destekli savunma tarafı pozitif
Honor kazanmaz; saldırgan yaptırımları ve tek başına savaşan karşı tarafın hakkı
korunur. Aşağıdaki eski ortak pozitif havuz bölümü donmuş v1/v2 geçmişinin
açıklamasıdır. [Yeni sürüm sözleşmesi ve test kapsamı](honor-solo-credit-2026-10-15.md).

Durum: **ana yapı kabul edildi; normal/destekli/ortak/anıt Honor entegrasyonu ve ana UI yerelde uygulanıyor, canlıya alınmadı.** Özel silah puanı ve eşzamanlı bağımsız savaşların ortak muhasebesi henüz aday; açılış şartı tamamlanmadı. Kullanıcının 14 Ekim yönlendirmesi esas: Hakimiyet'in mevcut hesabı korunur; ana kürsü, rekabet ve daha değerli sezon ödülü Honor'a geçer. Savunmacının puan kaybetmemesi ve boş yağmanın tek başına Honor üretmemesi kabul edildi. Önceki G + askerî başarı ile Hakimiyet'i değiştirme araştırması geri alındı. [Uygulama ve doğrulama kaydı](honor-implementation-2026-10-14.md).

Honor, rakibin seviyesini gözeterek elde edilen askerî başarının ve saldırı tercihlerinin kaydıdır. Genel ekonomik gelişim veya saf beceri rating'i değildir. Büyük filoyla iyi hedef yakalamak değerlidir; büyük filo sahibi olmak, saldırı sayısı ve yalnız yüksek tier'a yönelmek puan üretmez.

## 1. Önerilen davranış sözleşmesi

| Durum | Honor |
| --- | --- |
| Denk rakibe anlamlı ve verimli darbe | Pozitif. |
| Daha yüksek tier ve en az senin kadar askerî varlık taşıyan rakibe aynı darbe | En fazla %25 daha fazla ham karşılık. |
| Güçlü rakibe ciddi kayıp verdirip kendi filosunu kaybetme | Sonuca göre küçük pozitif olabilir; yenilgi adı otomatik sıfır değildir. |
| Birkaç gemiyi sonuç almadan intihara gönderme | Saldıranın kaybından küçük negatif; katılım bonusu yok. |
| Zayıf tier'a zarar verme veya yağma | Negatif; aynı hedefi 24 saat içinde tekrar zorlama daha ağır. |
| Saldırıya uğrayanın yenilmesi | Honor düşmez. Verdiği anlamlı askerî kayıp varsa kazanabilir. |
| Boş depoyu yağmalama, kaçmış filonun boş bıraktığı gezegen | Hakimiyet mevcut kuralla çalışır; tek başına pozitif Honor yok. |
| Yalnız kargo/collector yok etme | Pozitif askerî Honor yok. Zayıf hedefe zarar verildiyse ceza hesabına girer. |
| Probe, geri çağırma, savaş öncesi radyasyon kaybı | Savaş hak edişi değildir; sırf komut veya uçuş için Honor yok. |
| Aynı çatışmada ortak filo/destek | Ortak taraf hesabı, sonra katılım payı; son vuruş sahipliği yok. |

**Savunmada puan kaybetmeme bilinçli tercih:** saldırıya uğramak kişinin seçimi değildir. Savunma yenilgisine negatif verirsek rakip hem filosunu hem Honor'unu farm edebilir. Saldırganın kötü risk almasının ise küçük puan sonucu vardır.

**Honor sıfırda silinmez:** negatif saldırı sonuçları kaydedilir. Aksi hâlde oyuncu sıfırdayken zayıfları yağmalar, ilk iyi savaşla bütün geçmiş cezayı atlar. Negatifler başkasına transfer edilmez; zero-sum değildir. Uygulama oyuncuyu kırmızı bir “haydut” etiketiyle damgalamamalı. Kazanılmış Honor sadece kendi yeni saldırı kararlarının negatif sonucu ile azalır; savunma, bekleme veya takvim puanı eritmez.

## 2. Tier tek başına neden yeterli değil?

Mevcut kural `coreTier = ceil(peakCore / 3)`; gezegen saldırılarında mevcut ±1 tier erişimi korunur. Honor yeni bir saldırı izni vermez. `hangarCeiling` Core'dan bağımsız olduğundan düşük Core'da filocu kalmak oyunun izin verdiği bir tercihtir. Sadece Core'a bakmak bu filocuyu sürekli “küçük oyuncu”, gelişmiş fakat filosuz ekonomisti sürekli “büyük ödül” yapabilir.

Bu yüzden iki mevcut oyun gerçeği kullanılır:

- **T:** komutanın sezon içinde ulaştığı en yüksek Core tier'ı. Tüm sahip olunan gezegenler; küçük koloni seçerek veya yüksek koloniyi bırakarak geçmiş seviye silinmez. Bu Honor sınıflaması, saldırı iznindeki güncel tier'ın yerine geçmez.
- **N:** oyuncuya ait silahlı gemi ve ground varlıklarının sabit sezon kataloğundaki toplam değeri; son 24 saatin en yüksek değeri. Ev, görev, destek istasyonu, anıt ve tamir/dok dahil; başka yerde olması sahibini değiştirmez. Aynı birim bir kez sayılır. Sivil taşıyıcılar dahil değildir. Bu gerçek anlık savaş gücü veya mevcut sağlıklı filo sayısı diye sunulmaz.

N'nin geçmiş tepe değeri, filo hediye edip hemen küçük görünmeyi zorlaştırır. 24 saat ilk sürüm tercihidir; ölçülmüş optimum değildir. Gerçek yenilgiden sonra eski büyük referansın 24 saat kalması toparlanan oyuncunun küçük hedeflerden kazanımını azaltabilir. Sezon boyu filo tepesini tutmak daha ağır olurdu; seçilmedi. Geçici filo transferiyle 24 saat bekleyen anlaşmayı kesin engellediği ileri sürülmez.

Saldıran/hedef sınıfları:

1. Hedefin T'si daha düşük ve N'si saldırandan küçükse **zayıf hedef**. İki tarafın askerî varlığı da sıfırken düşük tier'a sivil yağma da bu sınıftır.
2. Hedefin T'si daha yüksek ve N'si en az saldıranınki kadarsa **üst hedef**; üst bonusu ×1,25.
3. Diğerleri **aynı bonus düzeyi**; ×1. Önemli istisna: düşük Core'da büyük filo kurmuş rakip, N'si saldırandan küçük değilse dokunulmaz “acemi” sayılmaz.

Pozitif kazanç ayrıca kaba askerî karşılaştırma bandından geçer:

| Hedef N / kendi N | Pozitif kazanç çarpanı |
| --- | ---: |
| 0,5'in altında | 0 |
| 0,5 dahil, 0,75'in altında | 0,5 |
| 0,75 ve üzerinde | 1 |

Kendi N=0 ise pozitif askerî kazanç yok. Bu çarpan aşağı-tier cezayı azaltmaz. Daha güvenli filo gönderdiğin için kesinti yapılmaz; karşılaştırma **gönderdiğin parçayı değil komutanın referansını** okur.

Sürekli oranı doğrudan puana koyan ilk aday elendi: görünen puandan gizli rakip toplamını ters hesaplamak mümkün oluyordu. Kaba bant da sınırlı askerî bilgi açar; bu, hedef ekranındaki açık oyun kuralıdır. Tam filo miktarı/konumu gösterilmez. Bantların sınırında kesinti değişimi vardır; saklanmamalı. Navy bandı yeni bir sıralama veya oyuncunun yükseltmesi gereken ayrı bir puan değildir.

**Zaman:** niyet bildirimi/gönderim anında T, N ve Honor hedef sınıfı dondurulur; hedef uçuş sırasında tier değiştirerek sonradan negatif sürpriz yaratamaz. Gerçek savaşın sahibi ilk hedeften değişmişse eski sahibin sınıfıyla yeni kişiye ceza yazılmaz; saldırı akışındaki mevcut sahiplik kontrolü ve yeni Honor uygunluk kontrolü birlikte uygulanır. Ortak operasyonda gerçek katılım listesi netleşmeden kesin Honor sonucu vaat edilmez.

**Savunma desteği istisnası — kullanıcı onayı:** gönderimde seçilen hedefler
kayıtlıdır. Seçilmeyen, gönüllü katılan zayıf destekçinin kaybı pozitif askerî
Honor üretmez; saldırgana zorbalık cezası da yazmaz. Seçilen zayıf dünya sahibi
ve ilk seçilen anıt savunmacıları için ceza korunur. Güçlü destekçi ekleyerek
seçilen zayıf hedefin cezası silinmez. Saldırganın kalıcı kaybı ve ortak taraf
verimliliği/paylaşımı aynı kalır. Tarihsel makbuzlar bu değişiklikle yeniden
etiketlenmez; yeni seçilmiş-hedef delili yalnız yeni savaşlarda kullanılır.

## 3. 1v1 sayısal başlangıç kuralı

Ortak değer birimi A+2C+32D, sabit sezon kataloğu. Kaynak/gemi fiyatı değişirse eski hak ediş güncel katalogla tekrar fiyatlanmaz.

```
K = düşmanın kalıcı silahlı gemi + ground kaybı
L = kendi bütün kalıcı birim kaybın (kargo dahil)
Q = gerçekten alınan yağma; enkazın varlığı, kapasite veya vaat edilen yağma değil

K = 0 ise başarı tabanı = 0
K > 0 ise başarı tabanı = K × [0,5 + 0,5 × K / (K + L)]

Yağma katkısı = 0,1 × min(Q, K)
Pozitif karşılık = (başarı tabanı + yağma katkısı) × hedef bonusu × askerî bant

Saldıran ham Honor = (pozitif karşılık − 0,1 × L) / 1.000
Savunan ham Honor = pozitif karşılık / 1.000
```

Savunan normal baskında yağma almaz. Ücretsiz ground yeniden kurulumu K ve L'den çıkarılır. Savaş öncesi yara kayıp diye tekrar yazılmaz; gerçekten yok olan gövde sayılır. Kazan/kaybet etiketi, `DECISIVE`, `PARTIAL`, `REPELLED` doğrudan puan girdisi değildir.

Zayıf hedefe saldırıda pozitif formül uygulanmaz:

```
D = hedefin bütün kalıcı kaybı; siviller de dahil
Saldıran ham Honor = −[(0,25 × D + 0,05 × Q) × tekrar katsayısı + 0,1 × L] / 1.000
```

Tekrar katsayısı: son 24 saatte aynı komutana yapılan zarar/yağma içeren zayıf saldırılardan önce **1**, bir önceki varsa **1,5**, iki veya daha fazlaysa **2**. Gezegen değişimi, kaynak türü veya klan değişimi sayaç sıfırlamaz. Sadece kalkış/recall ve hiç sonuç üretmeyen boş olay sayaç doldurmaz. Negatifler rakip bütçesiyle indirilmez.

**Dar karşı saldırı istisnası:** düşük tier'lı rakip önce gerçek zarar verdiyse, son 24 saatteki karşılıksız zarar kadar zayıf-hedef cezası nötrleşebilir; pozitif bonus üretmez. Bütçe `kalıcı kayıp + yağma/5`, kaynak olayına bağlı ve tüketilirdir. Tek gemilik provokasyon bütün hesabı yağmalama izni vermez. Karşılık verilen miktar yeni karşılık bütçesi üretmez; bütçe başka oyuncuya devredilmez. Gerçek olaylardan doğma/tüketim/sona erme aynı işlemde uygulanır. Aynı effective-ms'de oluşmuş zarar bu olayın geçmiş provokasyonu sayılmaz.

Yakıt/tamir bu katsayıda yok. Bu **kalıcı birim kaybı verimliliği**; operasyonun gerçek net kârını Hakimiyet diye yeniden hesaplama girişimi değil. Üst rakibe kötü bir intiharın geçmiş kahramanlık puanı kazandıracağı sabit ödül yok.

## 4. Aynı rakiple puan üretmeyi sınırlama

Sezon + iki komutan kimliğinden oluşan **yönsüz** çift kaydı tutulur. Karşılıklı saldırıya geçmek yeni rakip sayılmaz. İki tarafa birden verilen pozitif ham Honor, aynı ortak birikime girer.

```
P = bu oyuncu çiftinden sezon boyunca oluşan toplam pozitif ham Honor
C = 200 Honor
Çiftin bugüne kadar verebileceği toplam = C × P / (C + P)
Yeni hak ediş = yeni toplam − eski toplam
```

İki taraf aynı olayda pozitifse artışı ham karşılıklarına oranla paylaşırlar. Negatif ham sonuçlar bütçeyi yenilemez veya büyütmez, aynen yazılır. Aynı sabit ham sonucu 100 parçaya bölmek toplam hak edişi artırmaz. Ancak savaş başına verimlilik değişebildiği için bütün savaş stratejileri aynı sayıya zorlanmış değildir.

C=200, bir çiftten kazanılabilecek toplamın yaklaşılabilen üst sınırıdır; başta tamamı alınmaz. Örneğin çiftin ilk 100 ham Honor'u 66,67; ikinci 100'ü ek 33,33 getirir. Daha önce biriktirdiklerin azalmaz. Bu sadece puan tekrarıdır; saldırı izni ve ekonomik ganimet ayrı kalır.

**Ödünleşim:** uzun süren gerçek rekabet de azalan karşılık alır. C=100/200/500 duyarlılık kontrolü yapıldı. Aynı eski insan savaşlarını hep denk varsayan koşuda toplam pozitif 2.326 / 2.933 / 3.690 Honor oldu. C=200, tekrar avlamayı anlamlı azaltan başlangıç tercihi; kusursuz optimum iddiası yok. Ekran bu azalmayı gizlememeli. Çift başına küçük bir sabit “ilk galibiyet bonusu” eklenmedi.

**Üç farklı rakip şartı yok:** geçmiş kesitte savaşmış 153 insanın 83'ü yalnız bir, 28'i iki farklı insanla karşılaşmış. Sırf bu nedenle ödül dışı bırakmak uygun değil. Bunlar tarihsel katılımcılar; aynı anda aktif 153 oyuncu iddiası değildir.

## 5. Anlaşma, hesap ilişkisi ve sınırlar

- Bot, NPC, pirate, neutral, kendi hesap kimliği: rekabetçi Honor kaynağı değil. Normal Hakimiyet uygunluğu ayrıca mevcut kuralını korur. *(2026-10-29'dan beri geçersiz: içinde en az bir insan olan bot savaşı Honor sayar, bot sıralamada ve ödül sırasında yerini tutar; yalnız botlardan oluşan savaş sayılmaz. Bkz. `docs/decisions.md` 2026-10-29.)*
- Aynı klan, son 7 günde aynı klanda bulunma veya son 7 günde doğrudan gönüllü filo/kaynak desteği: o çift pozitif Honor üretmez. Çatışma ganimeti “gönüllü destek” diye işaretlenmez. Negatif saldırı sonuçları silinmez. Klandan çıkıp aynı gün düello puanı basmak açılmaz.
- Sadece aynı IP'ye göre otomatik suç/ceza yok. Ayrı ve ilişkisiz görünen yan hesapları puan formülü kesin teşhis edemez. Ödül sırası, özellikle tekrarlı tek yönlü gemi besleme ve ilişkili kaynak akışı açısından delille incelenebilir; flag otomatik suç kararı değildir.
- Mikro-Honor ile muhasebe: 1 Honor = 1.000.000 iç birim. Bir kaybın küçük olduğu için her saldırıda sıfıra yuvarlanıp bedava denemeye dönüşmesi engellenir. UI ayrıntıda küsuratı göstermeli; 0,0546 kaybı gizlice 0 yazmamalı.
- Kaynak raporu, sezon, gerçek aktörler ve kural sürümü değişmiş mükerrer teslim kabul edilmez. Eski sezonun olayları yeni sezona yazılmaz. Kapanış ve geciken worker sırası çözümlenmeden ödüller kesinleşmez.

**Mutlak “abuse yapılamaz” sözü verilmiyor.** Sonuç almayan saldırı spam'i, kaynak dolaştırma, aynı çiftte yön değiştirme, clan'dan çık-gir ve kaynak ödülünü ucuz fedayla büyütme gibi somut yollar hedeflendi. Kaynak harcamayı göze alan bağımsız görünüşlü çoklu hesaplar hâlâ sıralamayı manipüle etmeye çalışabilir; bunun hesabın kimliği ve ilişki kanıtı tarafı vardır.

## 6. Ortak saldırı, destek ve anıt

**Kimin son vuruşu yaptığı kullanılmaz.** Bir tarafın toplam K/L'si ve verimliliği bir kez hesaplanır. Katılım ağırlığı gerçek başlangıç aktif silahlı filo değeridir; aynı komutanın dalgaları önce birleşir. Gerçek normal hasar soğuran kalkanın sınırlı katkısı da bağlandı ve test edildi. Sıfır ateşli lojistik filo pozitif askerî pay satın almaz. Yalnız sivil saldırı varsa negatif yaptırımı paylaştırmak için gerçek sivil katılım değeri kullanılır; sıfır combat değeri ceza muafiyeti değildir.

Karışık tier için en yüksek oyuncunun tier'ını bütün takıma kopyalamıyoruz:

- Ortak başarı tabanı, düşmanın **hangi sahibinin ne kadar kalıcı askerî kaybı olduğu** oranında değerlendirilir. Bu son vuruş atfı değildir; kaybedilen varlığın sahibidir.
- Bu kısım için taraf üyelerinin hedef katsayıları katılım ağırlıklarıyla ortalanır. Düşük tier'dan tek gemi eklemek büyük takımın tamamını küçük yapamaz; savunmaya bir yüksek-tier gemi koymak düşük-tier kayıpların tamamını üst-tier başarıya çeviremez.
- Zayıf hedefin sivil kaybı ve yağması da doğru sahibinin ilişkisiyle ortak ceza hesabına girer. Kişisel kayıp/verimlilik yeniden hesaplanmaz.
- Ortak pozitif/negatif ham sonuç oluşur. Hak edilmiş nihai ortak tutar başlangıç katılım ağırlıklarıyla paylaşılır. Tank görevi gören kişinin gemileri öldü diye payı silinmez.
- Rakip tekrar sınırı komutan çiftlerine aittir; operation id/klan/filo adı değişimi bunu yenileyemez. Ortak pozitif havuzun çiftlere düşen maruziyeti, yukarıdaki katılım ve hedef-kayıp ağırlıklarıyla rezerve edilir. İki tarafın rezervasyonları aynı çiftte birleşir. Bütün rezervasyonlar aynı transaction'da yapıldıktan sonra çıkan taraf toplamı üyelere dağıtılır; kişilerin puanı ayrıca ikinci kez çifte eklenmez.

**Karışık takımın ham havuzu/paylaşımı, çok oyunculu çift rezervasyonlarının atomik entegrasyonu, ortak olayın tekrar/karşılık tüketimi ve kalkan girdisi bağlandı/test edildi.** Bağımsız iki savaşın aynı milisaniyede sonuçlanmasında kanonik source-id hâlâ ortak çift karşılığını veya zayıf tekrar sırasını değiştirebiliyor. Bunun birlikte muhasebe adayı ayrı prototipte; normal savaşların verimlilik havuzları birleştirilmiyor. Bu açık giderilmeden “tamamlandı” denmiyor.

Savaşsız boş anıt ele geçirme doğrudan Honor basmaz. Anıt tutmanın ekonomi/kontrol getirisi mevcut oyunda kalır. Ayrı zamanlardaki bağımsız savaşlar otomatik ortak operasyon sayılmaz; önce yaralayıp sonraki ayrı saldırıda bitiren katkısını bu sürüm geriye dönük bölüşmez. HP hasarını tamir edip tekrar Honor üretme yolu açılmadı.

**Özel saldırılar:** Death Star, yüzey hasarı ve konvoy baskını gibi normal resolver dışı PvP kaynakları lansman envanterine dahil edilmelidir. Sırf normal raid tablosuna bakıp zayıf hedef cezasını bu yollardan kaçırmak kabul edilmez. Kaynak başına pozitif askerî uygunluk ve gerçek geri döndürülemez zarar delili ayrı adaptörde doğrulanır. Böyle bir kaynak için delil tanımı eksikse bütün Honor sistemi “hazır” sayılmaz; sessizce muaf kaynak olarak çıkarılmaz. Bu tur bu kaynakların Honor hesabı kodlanmış/test edilmiş değildir.

## 7. Honor'un ana hedef olması: ekran ve ödül

**Gösterim kararı:**

- Sıralama varsayılanı **Honor**. Hakimiyet yan sekmede mevcut hesabıyla erişilebilir.
- Profilde ana rütbe ve sezon rozeti Honor'a bağlı; Hakimiyet ayrıca açık adıyla görünür.
- Sezon ana kürsüsü ve kalıcı şampiyon unvanı Honor'da. Hakimiyet'in kendi başarısı görünür kalır.
- Negatif oyuncuları utandıran ayrı bir haydut listesi yok. Kendi sıran, sonraki sırayla fark ve toparlanma yolu görünür.
- Hedef ekranı: “Denk hedef”, “Üst hedef”, “Askerî karşılık sınırlı”, “Zayıf hedef: Honor kaybı” gibi neden belirten etiketler. Yalnız renkle anlatılmaz.
- Gönderim ekranı kesin zafer/puan vaat etmez. Donmuş hedef sınıfını, zayıf hedef yaptırımını, aynı rakipten kalan karşılığın azaldığını ve yenilgide kayıp kuralını açıklar.
- Ortak operasyon ekranı gerçek üyelerle ortak sınıfı ve tahmini payları gösterir; katılım değişince yeniden hesaplar.
- Rapor: **Honor değişimi / Hakimiyet değişimi** ayrı satırlar. Bir dokunuşta askerî sonuç, verimlilik, hedef katsayısı, yağma katkısı, tekrar etkisi ve varsa ceza. Ortak raporda önce taraf havuzu, sonra senin payın.
- Büyük bir rakibin filosu dışarıdayken kaynak almak ekonomik başarıdır; “Honor 0: bu baskında askerî imha olmadı” diye açıkça anlatılır. Bu ayrımı saklayıp oyuncuya bug hissi verilmez.

**Somut ödül önerisi:** aynı sıra için Honor nominal kaynak paketi, mevcut Hakimiyet paketinin **2 katı**. Mevcut kodun birincilik paketi 2.000 A / 1.500 C / 300 D; Honor nominal paket 4.000 A / 3.000 C / 600 D. Bu gelecekteki yeni ödül programıdır; başlamış sezonun sözleşmesi değiştirilmez.

Ancak tek göstermelik savaşla yüksek sıraya çıkılan seyrek sezonda bu paketi açmak feed'i kârlı yapabilir. Bu nedenle gerçek ödeme:

```
Honor kaynak ödemesi = nominal paketin,
                      toplam değeri en fazla 200 × pozitif sezon Honor'u olacak kısmı
```

Kaynak bileşenleri aynı oranda küçültülür, aşağı yuvarlanır. Birincilik paketi toplam 29.200 ortak değer; **146 Honor** tam paketi açar. 1 Honor bütün birincilik paketini açmaz, en çok 200 değer açar. Ödül ekranı “Tam paket için 146 Honor” ve mevcut hak edişi gösterir; gizli kesinti değildir. Diğer sıraların tam paket eşiği kendi nominal paket değeridir. Negatif/sıfır Honor'un rekabet ödülü yoktur.

Bir kişi iki listede de ödül kazanırsa iki kaynak paketi toplanmaz; ortak değerle büyük olan paket bir kez verilir. Hakimiyet'in mevcut hak edişi korunur. Unvan/başarı kayıtları iki listede de gösterilebilir. Eşit Honor aynı sırayı paylaşır; bağlı grubun kapladığı ödül basamaklarının toplamı eşit bölünür, sonrasında bireysel Honor ödeme sınırı uygulanır. Kayıt zamanı veya UUID gizli kazanan seçmez.

**Kaynak fedası sınırı:** tüm pozitif ham Honor, yok olan kalıcı askerî değerin en fazla 1,375/1.000'i. Bu, 1,25 üst bonus ve 0,1K yağma katkısının birlikte üst sınırıdır; çift indirimi bunu büyütmez. Kaynak ödülü en çok 200/H olduğundan toplam yeni Honor kaynak ödemesi en çok imha değerinin **%27,5'i**. %30 ideal enkaz geri kazanımı varsayımındaki %70 net tüketimin altında kalır. Bu kaynak muhasebesi sınırıdır; bedava/ele geçirilmiş gemi fırsatları, unvan değeri, zaman ve mevcut Hakimiyet ödüllerinin bütün teşviklerini çözdüğü söylenmez. Kaynak kataloğu/enkaz kuralları değişirse sınır tekrar test edilir.

## 8. Gerçek sayı örnekleri

Aşağıdaki ilk-karşılaşma değerlerinde rakibin aynı olaydan pozitif ham Honor almadığı varsayılmıştır. İki taraf da pozitifse ortak çift bütçesi birlikte uygulanır; doğrudan bu örnek tablosundan iki ayrı tam pay verilmez.

| Kurgu | K | L | Ham Honor | Yeni çiftte yazılan |
| --- | ---: | ---: | ---: | ---: |
| Denk, verimli galibiyet | 50.000 | 10.000 | +44,83 | +36,62 |
| Üst tier ve gerçekten güçlü hedef, aynı sonuç | 50.000 | 10.000 | +56,29 | +43,93 |
| Üst rakibe ciddi zarar, ağır yenilgi | 20.000 | 100.000 | +4,58 | +4,48 |
| Üst rakibe sivrisinek saldırısı | 100 | 10.000 | −0,94 | −0,94 |
| Sonuçsuz tek DART fedası | 0 | 546 | −0,0546 | −0,0546 |
| Denk hedefe sonuçsuz saldırı | 0 | 10.000 | −1 | −1 |
| Zayıf hedef, 20.000 yağma, kayıpsız | 50.000 | 0 | −13,5 | −13,5 |
| Aynı zayıf hedefe ikinci / üçüncü eşdeğer zarar | 50.000 | 0 | −20,25 / −27 | Aynı |
| Üst hedefin boş deposundan 100.000 yağma | 0 | 0 | 0 | 0 |
| Üst hedef, 100.000 yağma ve gerçek çatışma | 20.000 | 1.000 | +26,80 | +23,64 |
| Savunmacı hiçbir zarar veremeden yenildi | 0 | 100.000 | 0 | 0 |

Güncel gerçek motorun sekiz küçük sentetik girdisi de denendi: normal denk savaş, kaçış, kaçış sonrası yerde kalan ground, kalkan, yaralı giriş, boş hedef, sivil hedef, karşılıklı imha. Bunlar geçmişte gerçekten yaşanmış savaşlar diye sunulmaz.

## 9. Production verisinin neyi söylediği

Eski değişmez kesitte 547 uygun 1v1 olay, bunun 488'i insan-insan. Honor çalışması normal bot PvP'lerini de pozitif rekabet kaynağı dışına aldığı için karşılaştırmalar **488 insan olayında** yapıldı. Gerçek kayıp/ücretsiz rebuild ve mevcutsa yağma kullanıldı; kargo imhası pozitif K'den çıkarıldı.

Geçmiş savaş anındaki sezon-Core-tepesi, oyuncuya ait bütün askerî varlığın 24 saatlik tepesi ve klan/yardım ilişki geçmişi yerel kesitte yok. Bu nedenle **gerçek tarihsel Honor sıralaması çıkarılamıyor**. Güncel tier'ı geçmişe uygulayıp bir lider tablosu uydurulmadı.

C=200 için, bütün olaylara sırayla uygulanan açık karşı-olgusal sınıflamalar:

| Varsayım | Toplam pozitif Honor | Toplam negatif Honor | Pozitif / negatif / sıfır saldırı |
| --- | ---: | ---: | --- |
| Bütün rakipler denk kabul edilirse | 2.932,72 | −32,51 | 195 / 60 / 233 |
| Bütün saldıranlar gerçekten üst rakibe vuruyorsa | 3.030,00 | −31,73 | 197 / 58 / 233 |
| Bütün saldıranlar zayıf hedefe vuruyorsa | 1.247,53 | −2.012,58 | 0 / 483 / 5 |

Son satırdaki pozitif, savunanların hak edişidir; zayıfa saldırganın pozitif kazancı yok. Bunlar aynı gerçek kayıplara farklı varsayım uygulanan duyarlılık koşuları, gözlenmiş oyuncu davranışları veya tutunma sonuçları değildir. Katsayılar tasarım başlangıcıdır; bu eksik delille “istatistiksel olarak optimum” denmiyor.

## 10. Ne kodlandı, nasıl uygulanacak?

Yerel `.dev/honor-20261014/`:

- `honor.mjs`: tek taraf ham hesap, hedef sınıfları, zayıf-hedef yaptırımı, sınırlandırılmış karşılık, yönsüz çift birikimi, mükerrer teslim ve kronolojik olay kontrolü.
- `team.mjs`: karma tier takımının ortak ham sonucu ve paylaştırılması. Dalga bölme, yüksek-tier kukla hedef, düşük-tier kukla müttefik, kişisel kaybı takıma dağıtma ve sivil saldırı muafiyeti denetlendi.
- `rewards.mjs`: iki kat nominal ödül ve Honor'a bağlı kaynak ödeme sınırı.
- `study.mjs`: isim içermeyen senaryo sonuçları, sekiz motor başlangıcı, üç C değeri × üç varsayım ile 488 insan olayının karşılaştırılması.
- Önce başarısız test, sonra uygulama; incelemede saf sivil saldırının yaptırımdan kaçması ve ilişkili oyuncuda solo/takım debit farkı bulunup düzeltildi.

Üretim uygulama sırası:

1. **Sözleşme ve kaynak envanteri:** Honor kuralları/ödül programı sürümü yeni sezona bağlanır. Normal, ortak, destek, anıt ve özel PvP kaynaklarının uygunluk ve zarar tanımları eksiksiz listelenir. Mevcut Hakimiyet writer'ları korunur.
2. **Donmuş niyet ve geçmiş:** sezon Core tepe değeri, askerî varlık değişimleri ve 24 saatlik tepe, klan/yardım ilişkileri. Bunlar client girdisi olamaz. Gönderimde Honor koşulları kaynak olayına kaydedilir. Filo hareketi aynı varlığı iki yere yazmaz; sahiplik değişimi iki taraf için atomiktir.
3. **Tek hak ediş defteri:** kaynak türü + sezon + olay + taraf/aktör tekil anahtarı, kanıt hash'i, ham/net tutar, neden, kural sürümü. Çift bütçeleri sabit kimlik sırasıyla kilitlenir. Çoklu taraf rezervasyonları ve kişisel hak ediş bir transaction'dır. Yardımcı bellekteki ledger, gerçek DB testinin yerine geçmez.
4. **Tekrar/karşılık:** 24 saatlik zayıf saldırı geçmişi ve tüketilebilir karşılık bütçesi gerçek kaynaklara bağlanır. Çift rezervasyonları ve karşılık tüketimi retry ile tekrarlanamaz. Geç kalan olay için muhasebe etkili zaman sırasıyla yeniden kurulabilir; sonucun kullanıcıya sessizce farklı yazılması kabul edilmez.
5. **API ve ekranlar:** hedef sınıfı/gerekçesi, Honor sırası, rapor dökümü, ortak pay, ödül hak edişi uygulandı ve altı dilde görsel doğrulandı. Ortak operasyonda gönderim-öncesi kişi bazlı rehber ve özel silah açıklaması kalan kapsamdadır.
6. **Sezon ödülü:** mevcut entitlement şemasındaki tek kaynak-sezon/sıra varsayımları iki sıralamanın sonuç arşivi ve tek büyük ödeme kuralıyla güncellenir. Eşit sıra, ban/itiraz, geç settlement, successor sezon, tekrar claim/çift ödeme ve ödül süresi testleri.
7. **İlan edilmiş açılış:** geçmiş eksik bilgiden Honor üretilmez. Yeni sezon başından açılış desteklenir. Owner'ın 15 Ekim talebiyle mevcut sezonda 2–3 günlük SHADOW incelemesinden sonra herkesin 0 Honor ile başlayacağı ayrı açılış da hazırlanıp test edildi. Deneme puanları ve yarış bütçeleri taşınmaz; askerî gözlemler ve mevcut Hakimiyet hakları korunur.

**Aktif sezonda deploy:** kod mevcut sezon sürerken dağıtılabilir; SHADOW
açılıştan sonraki savaşları görünmeden ölçer. Mevcut sıralama/ödül Hakimiyet
olarak kalır. Önceden yola çıkmış normal/ortak/anıt saldırıları gerçek source
listesiyle puan dışı tutulur, savaşları sonuçlanır. Genel `prepareHonorSeason`
guard'ı mevcut sezon ortasında ACTIVE yaratmayı hâlâ engeller. İlan edilmiş
SHADOW→ACTIVE geçişi yalnız ayrı `honor-open` işlemiyle desteklenir; puanlar
temiz başlar, uçuş sınırı kaynak kimlikleriyle korunur. Yeni sezon doğrudan
ilan edilen immutable Honor programıyla başlayabilir. Ayrıntılar ve kanıtlar:
[15 Ekim açılış uygulaması](honor-ranked-opening-2026-10-15.md).
Canlıya henüz deploy edilmedi; aday2/silah kuralları ve release rehearsal'ı
tamamlanmadan bütün Honor release'i hazır sayılmaz.

**Lansman şartları:** ortak çift rezervasyonu, özel PvP yaptırım kapsamı, ilişki/askerî tepe geçmişi, gerçek transaction retry testleri ve puan açıklaması tamamlanmadan “Honor hazır” denmez. Tasarımın bu parçaları tariflidir; kod tamamlanmış gibi gösterilmez.

## 11. Son karar önerisi

Ana yapı seçilebilir: **Hakimiyet korunur; Honor ana rekabet olur.** Honor'da saldırı tercihi önemlidir, pasif mağduriyet puan kaybettirmez. Denk/üst hedefte anlamlı askerî sonuç ödüllenir; sonuçsuz intihar, zayıf hedefe zarar ve anlaşmalı tekrar için somut sınırlar vardır. Ekonomik baskınların her biri Honor üretmez; bunu yapmak kaynak dolaştırma açığını büyütür.

Kullanıcı **savunmacının Honor kaybetmemesini** ve **boş depo yağmasının tek başına Honor vermemesini** kabul etti. C=200, %25 üst bonus, %10 saldırı kayıp payı, 24 saat askerî tepe ve 7 gün ilişki süresi ilk sürüm parametreleridir; test edilmiş ama mutlak optimum değildir.

[Toplu kanıt ve test ölçümü](evidence/honor-primary-ranking-2026-10-14.json). Production verisine bu tur yeni yazma, şema değişikliği veya deploy yapılmadı. Önceki 218 araştırma testi bu yeni Honor modeli için geçerliymiş gibi tekrar sayılmadı.

İlk Honor prototip koşusu **53/53**, 1,51 saniye; ölçülen tepe RSS **305.960 KiB (~299 MiB)**. Node heap 512 MiB, tek test worker, `nice -n 10`. Son uygulama kontrolleri [güncel kayıtta](honor-implementation-2026-10-14.md); bu ilk sayı bugünkü toplam gibi kullanılmaz. Uzun sezon ajan simülasyonu çalıştırılmadı.
