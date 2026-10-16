# Tier 4 geçiş onayı ve tatil modu — uygulama planı

Tarih: 2026-10-15. Durum: Master üzerinde uygulama ve code review tamamlandı. İlgili testler, tip ve görsel kontroller geçti; genel lint'teki diğer ticaret çalışmasına ait bulgular aşağıda kayıtlıdır.
Ayrı worktree açılmadı. Migration: `0170_vacation_mode.sql`.

## Uygulama ve code review kaydı

- Tier 4 onayı istemci ve sunucuda hedef seviye 10 için uygulanır; yansıtılmış kuyruk seviyesi, vazgeçme ve eski onay kontrol edilir.
- Tatil API'si, bütün gezegenleri kapsayan atomik ödeme/dondurma, iki yönlü sefer ve destek engelleri, erken dönüş, saldırı/sonda koruması, kuyruk ve Silent Space entegrasyonu uygulandı. Menü, fiyat dökümü, altı dil ve Wiki eklendi.
- Otomatik bitiş için ayrı bir worker olayı kullanılmıyor. Kişisel saatler satın alma sırasında bitişe taşınıyor; koruma ve duraklama doğrudan kayıtlı bitiş anına göre sona eriyor. Böylece worker veya oyuncu çevrimdışı olsa da üretim doğru anda devam ediyor. Erken dönüş kullanılmayan süreyi saatlerden geri alıyor; ödeme iade edilmiyor.
- Code review'da işlem içi saat kayması, worker/season kilit sırası, kalkan yenileme gecikmesi, erken dönüşte bütün kolonilerin radyasyon takvimini eşitleme ve aynı modalda tekrar satın alımın yeni istek kimliği alması düzeltildi.
- İzole test PostgreSQL'inde tatil, Core onayı, geliştirme kuyruğu, koloni arızaları, Silent Space gidiş/dönüş ve radyasyon regresyonları: **7 dosya, 90 test geçti**. Arayüzde tatil, Core modalı, kuyruk ve yerelleştirme: **4 dosya, 185 test geçti**. Saf tatil kuralları: **9 test geçti**.
- `node tools/visual.mjs out/vacation --vacation`: altı dil × 350/1280 px × fiyat dökümü/erken dönüş/Core onayı = **36 görünüm geçti**. Yatay taşma, footer kırpılması, tarayıcı hataları ve onay öncesi POST yapılmaması denetlendi. Görseller ve ölçümler `out/vacation/` altında; Türkçe dar ekranlar ayrıca gözle incelendi.
- Tüm workspace tip kontrolleri geçti. Genel lint tek süreçte 4 GiB sınırında belleği tükettiği için gerekli üç grup ardışık çalıştırıldı. Bu göreve ait lint bulguları temizlendi; tools/sim grubu geçti. Genel sunucu grubu `test/trade-resolve.test.ts` içindeki çözülmeyen `recallTrade` tipinden kaynaklanan 26 bulgu, web grubu `test/trade-recall.test.tsx:18` içindeki `require-await` bulgusu nedeniyle temiz değil. Bunlar diğer ticaret çalışmasının dosyalarıdır. Bu kayıt bütün repository testlerinin geçtiği iddiası değildir; çalışma ağacında diğer görevlerin de değişiklikleri bulunuyor.


## Doğrulanan mevcut davranış

- `packages/rules/src/loot.ts`: Komutan tier'ı üç Komuta Çekirdeği seviyesinde bir yükselir. 9 → 10, tier 3 → 4 sınırıdır. PvP erişimi komutanın bütün gezegenleri arasındaki en yüksek çekirdeğe göre ±1 tier'dır; yalnız seçili gezegene göre değildir.
- `apps/web/src/screens/PlanetScreen.tsx`: `useBuildingAction`, yükseltme hedefini mevcut geliştirme kuyruğunun yansıtılmış seviyesinden hesaplar.
- `apps/server/src/services/build.ts` ve `buildQueue.ts`: Yükseltme emri ödeme karşılığında kuyruğa girer; seviye ve tier etkileri tamamlanınca uygulanır. Kod içindeki eski “instant” yorumları mevcut davranışı açıklamıyor.
- `apps/web/src/api/queries.ts`: Yükseltme iyimser güncelleme kullanır; onay öncesinde bu mutasyon çağrılmamalı.
- `packages/rules/src/economy.ts`: Saatlik temel döteryum üretiminin ortak kaynağı `deuteriumRate(level)`.
- `packages/rules/src/inactivity.ts`: Silent Space, son geliştirme/savaş emrinden 30 saat sonra gündeme gelir; giriş yapmak bu süreyi yenilemez.
- `services/planet.ts`: Ekonomi, sadakat ve radyasyonun ayrı zaman hesapları var. Üretim hızını sıfırlamak bütün durumu dondurmaz.
- `services/silentSpace.ts` aday seçimini, `services/commanderTransfer.ts` taşınmanın işlem içindeki son kontrolünü yapar. Tatil her ikisinde korunmalı.
- Worker olayları veritabanından talep edilip daha sonra işlenebilir. Daha önce alınmış bir olay, tatil başladıktan sonra da çalışabilir; yalnız bekleyen olayları değiştirmek yeterli değildir.

## 1. Komuta Çekirdeği 10. seviye onayı

### Oyuncu akışı

1. Hedefi 10 olan Komuta Çekirdeği yükseltme düğmesine basılınca mevcut premium Sheet/Confirm düzeninde bir onay açılır.
2. Önerilen başlık: **“Bir üst mücadeleye hazır mısın?”**
3. Önerilen gövde: **“Komuta Çekirdeği 10. seviyeye ulaştığında daha güçlü komutanların mücadele aralığına gireceksin. Filonu, savunmanı ve geliştirmelerini hazırladıysan devam edebilirsin.”**
4. Eylemler: **“Şimdilik bekle”** ve **“10. seviyeye yükselt”**. Emir kuyrukta bekleyecekse eylem etiketi bunu açıkça söyler.
5. Kapatma, geri dönme veya vazgeçme kaynak harcamaz ve emir oluşturmaz. Onay, mevcut yükseltme akışını bir kez çalıştırır.
6. Tier değişiminin butona basınca değil yükseltme tamamlanınca olacağı anlaşılır. Abartılı tehlike dili, kırmızı alarm veya zorunlu hazırlık listesi kullanılmaz.

### Uygulama ve dikkat noktaları

- Görünür bina satırı ve öğe ayrıntı yüzeyi aynı onay akışına ulaşmalı.
- Tetikleyici yansıtılmış hedef seviyedir: çekirdek 8 iken 9 kuyruğa alınmışsa sonraki 10 emri de onay ister.
- Sunucu aynı hedefi işlem içinde tekrar hesaplar; 10. seviye emrine açık onay alanı ister. Eski sekme, eşzamanlı işlem veya doğrudan API çağrısı onaysız emir oluşturamaz.
- Onay gezegen ve hedef seviyeye bağlıdır. Modal açıkken gezegen/hedef değişirse eski onay başka emre uygulanmaz.
- Başka bir gezegen komutanı zaten tier 4 veya üstüne taşımışsa metin yanlış bir “ilk tier geçişi” iddiası kurmamalı. Kullanıcının açık tetikleyicisi olan 9 → 10 için onay korunur; metin mevcut komutan durumuna göre uyarlanır.
- İptal edilen 10. seviye emrinin yeniden verilmesi yeniden onay ister. Diğer yükseltmeler ek onayla yavaşlatılmaz.
- Mevcut savaş kuralları değiştirilmez; metin mevcut erişim ve saldırı sıklığı kurallarıyla tutarlı gözden geçirilir.

### Kabul testleri

- 9 → 10 ve kuyruk üzerinden hedef 10; diğer seviyelerde mevcut davranış.
- Vazgeçme/kapatma: sıfır mutasyon ve sıfır harcama.
- Onay ve çift tıklama: yalnız tek emir/tek ödeme.
- Onay sırasında dünya veya kuyruk değişimi; yetersiz kaynak ve sunucu hatası.
- Başkent/koloni ve komutanın zaten tier 4+ olması.
- Mobilde odak, Escape/geri, katman sırası ve desteklenen diller.

## 2. Tatil modu

### Kullanıcının belirlediği kurallar

- 1, 2, 3, 4, 5, 6 veya 7 günlük alınır; her gün tam 24 saattir.
- Ana gezegen ve bütün koloniler birlikte tatil moduna geçer. Gezegen seçimi, bir koloniyi dışarıda bırakma veya kısmi ödeme yoktur. Toplam ücret karşılanmıyorsa hiçbir gezegen tatil moduna geçmez.
- Bütün gezegenler saldırı, sonda, ele geçirme ve diğer zarar verici eylemlere karşı korunur.
- Üretim durur. Yeni geliştirme, sonda, kazı, savaş, filo/kaynak aktarımı ve diğer oyun durumunu değiştiren eylemler kapalıdır.
- Koloni arızası oluşumu, mevcut arıza süreçleri ve sadakat düşüşü durur. Kişisel onarım, kalkan, radyasyon ve diğer gelişim/hasar süreçleri de dondurma kapsamındadır; tatilde bedelsiz ilerleme veya biriken hasar oluşmaz.
- Geliştirme, araştırma ve üretim kuyrukları silinmeden, kalan süreleri korunarak duraklatılır.
- Oyuncunun hiçbir aktif seferi olamaz. Kazı, ticaret, transfer, stratejik uçuş ve dönüş yolundaki filolar da buna dahildir. Ortak klan filosunda veya arkadaşında destek olarak gemisi bulunamaz.
- Oyuncuya gelen saldırı/sonda/yardım dahil seferler ve oyuncunun gezegenindeki misafir destek filoları da girişe engeldir. Seferler sonuçlanmalı, destek filoları sahiplerine dönmüş olmalıdır.
- Tatil sürerken Silent Space'e taşınmaz; giriş yapmak tatili bozmaz. Sohbet ve mevcut raporları okumak açıktır.
- Bedel yalnız ana gezegenin döteryumundan alınır; depo ve üretim havuzu birlikte kullanılabilir. Koloniler ücret hesabına girer, fakat kolonilerden otomatik ödeme alınmaz.
- Ana gezegen her gün için 12, her koloni 6 saatlik referans üretim bedeli ekler.
- Oyuncu istediği an erken dönebilir; kalan süre için geri ödeme yapılmaz. Süre dolunca da tatil otomatik biter.
- Erken veya otomatik dönüşte bütün gezegenler birlikte açılır: üretim ve eylemler serbest kalır, kuyruklar kaldığı yerden sürer, koloni arıza ve sadakat mantığı tekrar çalışır.
- Her dönüşte Silent Space için yeni 30 saat başlar; tatil öncesindeki kalan süre devralınmaz.
- Sezonun son 24 saatinde tatil olamaz. Her satın alımın bitişi en geç `sezonBitişi − 24 saat` olmalıdır. Son 24 saatte yeni tatil alınamaz.
- Menüde “Tatil modu” düğmesi bir modal açar. Gün seçimi, her gezegenin ücreti, toplam döteryum ve hesaplama açıklaması burada gösterilir.

### Ücret formülü ve tahsilat

Her gezegen için `L = 2 × Math.ceil(mevcutKomutaÇekirdeğiSeviyesi / 2)`.
`R(L)`, ortak kurallardaki o seviyenin temel saatlik döteryum üretimidir.
`d`, seçilen tam gün sayısıdır.

`toplam = d × (12 × R(L_ana) + 6 × Σ R(L_koloni))`

- Referans gerçek rafineri seviyesi değil, o gezegenin çekirdek seviyesinden üretilen seviyedir.
- 12 seviye ana gezegen, 1 gün: `12 × R(12)`.
- 17 seviye ana gezegen, 12 ve 15 seviye koloniler, 2 gün: `24 × R(18) + 12 × R(12) + 12 × R(16)`.
- Kullanıcı bonus ayrıntısına bir koşul koymadı. Hesap için bonus, araştırma, arıza, üretim kesintisi ve Silent Space hızından bağımsız ortak temel üretim kullanılır. Global denge çarpanları ortak üretim fonksiyonuyla aynı kalır.
- Kesirli döteryum varsa parçalar ayrı ayrı değil, toplam en son yukarı yuvarlanır. Bu miktar teklif, ekrandaki onay ve ödeme arasında aynıdır. Dökümdeki gösterim yuvarlaması toplamla çelişmemeli; gerekiyorsa son yuvarlama ayrıca belirtilir.
- En yüksek tek çekirdek seviyesinin sonraki çift seviyesi gerçek bina tavanını aşsa da referans hesabı kırpılmamalı; bu bir bina inşa emri değildir.
- Ana gezegenin deposundan başlanır; eksik tutar ana gezegenin üretim havuzundan düşülür. Havuzdaki kaynak depoya toplanmadan doğrudan ödemeye kullanılabilir; depo kapasitesi buna engel değildir.
- Yeterlilik koşulu `anaDepoDöteryumu + anaHavuzDöteryumu >= toplam` olur. İki bakiye de negatif olamaz; tam yeterli bakiye kabul edilir.
- Ödeme, kaynak projeksiyonu ve Wealth güncellemesi aynı transaction'da yapılır. Tatil ücretini ödemek sadakat/üretim gibi başka bir kazanç oluşturmaz.

### Sezon sınırı ve dönüş kuralları

- `sonTatilBitişi = sezonBitişi − 24 saat`.
- `takvimÜstSınırı = min(7, floor((sonTatilBitişi − sunucuŞimdi) / 24 saat))`. Sıfır veya negatifse alınabilecek gün yoktur. UI ile sunucu aynı gerçek zaman sınırını kullanır.
- Tam 48 saat kalmışsa en fazla 1 gün; tam 72 saat kalmışsa en fazla 2 gün alınabilir. 48 saatten az kalmışsa tam 1 günlük yeni tatil sığmaz. Sınır yuvarlanarak aşılamaz.
- Tatilin bitişinin son 24 saat başlangıcına eşit olması geçerlidir; o anda tatil sona erer. Yeni koruma süresi eklenmez.
- Mevcut sezon kapanışı tamamlanmamış kuyrukları bekliyor. Tatille kaydırılan kuyrukların yeni tamamlanma tarihleri de sezon içinde kalmalı; sezon kapanışı uzatılamaz. Uygunluk teklifi bu koşulu denetler, sezonu aşacak süreyi sunmaz ve nedenini belirtir. Emirler otomatik iptal edilmez veya hızlandırılmaz.
- Erken bitiş ayrı bir sunucu işlemiyle, tüm dünyalar için tek transaction'da uygulanır. Koruma o anda kalkar; iade sıfırdır. UI bunu eylem öncesinde açıkça anlatır.
- Dondurulan süre, satın alınan toplam süre değil, gerçek başlangıç ile erken/otomatik bitiş arasında geçen süredir. Erken dönüşte kalan ücret veya süre başka bir tatile devredilmez.
- Aktif tatilin üzerine ikinci tatil satın alınamaz veya süre eklenemez. Tatil bittikten sonra normal giriş, ücret ve sezon koşulları yeniden değerlendirilerek yeni tatil alınabilir; ek bir bekleme süresi veya kullanım kotası eklenmez.
- Tatil komutan/sezon kapsamındadır; Silent Space içinden satın alma kapalıdır. Genel sezon ve galaksi etkinlik takvimi devam eder; tatil bunları kaydırmaz.
- İstihbaratın ölçüm yaşı, sosyal üyelik süreleri ve PvP bekleme süreleri gerçek takvimde ilerler; tatil bunları yenilemez. Kişisel üretim/hasar/donanım süreçleriyle karıştırılmaz.

### Backend uygulaması

1. Ortak kurallara saf ücret hesaplayıcısı ve 1–7 tam gün doğrulaması eklenir. UI ikinci bir fiyat formülü yazmaz.
2. Komutan/sezon kapsamlı kalıcı tatil kaydı oluşturulur: başlangıç, planlanan bitiş, gerçek bitiş, erken/otomatik bitiş sebebi, gün, ödenen bedel, depo/havuz ödeme ayrımı, gezegen bazlı fiyat dökümü ve tamamlanma durumu. Aynı komutan için çakışan tatiller veritabanı ve işlem kontrolüyle engellenir.
3. Yetkili oyuncuya fiyat/uygunluk teklifi, satın alma ve erken dönüş uçları sağlanır. Aktif seçili dünya koloni olsa da ödeme ana gezegenin depo ve havuzundan yapılır. Teklif alınabilecek günleri, her engelin açıklamasını ve sezon sınırını taşır.
4. Satın alma tek transaction'dır: mevcut kilit sırasına uyarak komutan ve sahip olunan dünyalar sabitlenir; sahiplik, süre, sezon, aktif görevler ve fiyat tekrar doğrulanır. Giriş anına kadarki normal üretim/hasar/olaylar yerleşir; ödeme ve dondurma birlikte kaydedilir.
5. Onaydan sonra fiyat veya kapsam değişmişse daha yüksek fiyat sessizce alınmaz; yeni teklif gösterilir. Başarısız satın alma para veya kısmi donma bırakmaz.
6. Satın alma ile sefer başlatma, dış saldırı, bina tamamlama, koloni ele geçirme ve Silent Space taşıması aynı anda olduğunda tutarlı bir sıra oluşması sağlanır. Tek başına frontend veya kilitsiz tatil kontrolü yeterli değildir.
7. Ortak tatil politikası eylem servislerinde uygulanır: geliştirme/araştırma/üretim/onarım, tüm sefer türleri, toplama, transfer, klan yardımı/bağışı/pay alma, stratejik silahlar ve sahipliği değiştiren işlemler. Bot ve worker yolları da taranır. Okuma uçları erişilebilir kalır.
8. Tam koruma hedef kontrollerinde ordinary raid dışında sonda, stratejik saldırı, radyasyon bombası, ortak klan savaşı ve diğer zarar yollarını da kapsar. Bütün gelen/giden seferler ve iki yöndeki klan destekleri girişte engeldir. Gizli seferler için uygunluk yanıtı saldırgan adı, filo, rota veya oyuncunun bilmediği varış zamanı vermez.
9. Ekonomi, sadakat, hasar ve UI projeksiyonları gerçek zaman aralığını tatil öncesi/tatil/tatil sonrası diye ayırır. Tatilde geçen zaman kazanç, iyileşme veya hasar olarak dönüşte topluca yazılmaz. Üretimi durdurmak mevcut depo ve havuz kapasitelerini küçültmez.
10. Dondurulan kişisel olaylar ve kuyruklar kalan sürelerini korur. Daha önce worker tarafından alınan olaylar da handler içindeki tatil kontrolüne uyar; eski tamamlanma olayları tekrar işlem yapamaz. İptal/yeniden zamanlama mevcut dedupe mekanizmasıyla yapılır.
11. Tatil sonu mevcut kalıcı event mekanizması ve gecikmiş olayları uzlaştırma ile işlenir. Worker yeniden başlasa veya oyuncu çevrimdışı olsa da bitiş tam kayıtlı anda geçerlidir; geç çalışan worker bitişi uzatmaz veya üretimi kaybettirmez. Erken bitiş ve otomatik bitiş ortak, tekrar çalıştırılabilir bir sonlandırma yolunu kullanır. Olaylar tatil kaydı kimliğine bağlıdır: erken bitmiş eski tatilin olayı, daha sonra alınan tatili bitiremez.
12. Silent Space aday sorgusu ve nihai taşıma kontrolü tatili dikkate alır. Erken/otomatik gerçek dönüş zamanı yeni 30 saatin başlangıcıdır; sunucu, countdown ve taşınma aynı kaynaktan okur. `lastProgressAt` sahte emirle güncellenmez. Gecikmiş worker yeni 30 saati kendi çalışma anından başlatmaz.
13. Genel sezon/etkinlik takvimi kaydırılmaz. Sezon sınırı her teklifte, satın almada ve kuyrukların yeniden zamanlanmasında korunur. Sezon sonu mevcut bütün oyuncular için normal anda kapanabilmelidir.
14. Tatil geçişleri transaction sonrası mevcut yayın/cache düzenine bağlanır; bütün sekmeler ve gezegenler aynı durumu görür. Ödeme kaydı denetlenebilir ve yeniden denemede çift tahsilat oluşturmaz.

### UI/UX

- Menüde “Tatil modu” düğmesi; mevcut v2 bileşenleriyle mobil modal/Sheet. Gezegen seçimi sunulmaz, tüm gezegenlerin dahil olduğu açıkça yazılır.
- 1–7 gün seçimi; sezon sınırına sığmayan günler seçilemez ve sebebi görünür. Başlangıç/bitiş zamanı ile son 24 saat kuralı sunucu saatine göre gösterilir.
- Ana gezegen ve her koloni için ad, çekirdek seviyesi, hesapta kullanılan çift seviye, o sürenin ücret saati ve döteryum tutarı; altında toplam ücret gösterilir.
- Ana gezegenin depo döteryumu, havuz döteryumu, toplam kullanılabilir bakiye ve varsa eksik miktar gösterilir. Koloni açıkken de ödemenin ana gezegenden yapılacağı anlaşılır.
- “Ücret nasıl hesaplanır?” açıklaması: çekirdek seviyesini sonraki çift seviyeye yuvarlama; bu seviyenin döteryum rafinerisi temel üretimi; günlük ana gezegen için 12, koloniler için 6 saat. 17 → 18 gibi kısa örnek ve gerçek gezegen dökümü birlikte sunulur.
- Satın alma öncesi kısa koruma/donma özeti, kesin bedel ve “İstediğin zaman dönebilirsin. Erken dönüşte ücret iade edilmez.” açıklaması. Eylem: “{{gün}} günlük tatili başlat”. İşlemi zaten açıkça onaylatan bu yüzeyin üzerine gereksiz ikinci bir onay eklenmez.
- Uygun değilse sebep ve çözüm gösterilir: örneğin “Kazıcı seferin dönene kadar tatil başlatılamaz” ve ilgili sefer/bitiş bilgisi.
- Tatilde kalıcı durum ve bitiş zamanı görünür. Ekonomi sıfır üretim, kuyruklar “Duraklatıldı”, kapalı eylemler tatil sebebini gösterir. Saatin geçmesi tek başına sunucu onayı gibi sunulmaz; tekrar eşitleme yapılır.
- Aktif tatil modalında “Tatili bitir” eylemi bulunur. Onay, bütün gezegenlerin açılacağını, korumanın hemen kalkacağını ve iade yapılmayacağını açıklar. Başarılı dönüşte üretim, kuyruklar ve 30 saatlik Silent Space sayacı güncellenir.
- Rakip “Tatilde” etiketini yalnız normalde görebildiği dünyada görür; yeni gezegen konumu, kaynak veya gelişmişlik açığa çıkmaz. Kesin bitiş zamanı varsayılan olarak yalnız sahibine görünür.
- Desteklenen bütün diller, Wiki ve oyun içi açıklamalar aynı kuralları taşır. 350 px telefon ve masaüstünde görsel doğrulama yapılır.

### Test matrisi

- Fiyat: 1–7 gün, geçersiz/kesirli gün, tek/çift çekirdek, kolonisiz/azami kolonili durum, farklı koloni seviyeleri, verilen iki örnek, üst sınır, toplam yuvarlama ve bonus bağımsızlığı.
- Ödeme: yalnız depo, yalnız havuz, ikisinin toplamı, tam yeterli/yetersiz bakiye, depo kapasitesinden bağımsız havuzdan ödeme, koloni seçiliyken satın alma, kolonilerde yeterli ama ana gezegende yetersiz kaynak, değiştirilmiş istemci fiyatı, değişen sahiplik/seviye ve rollback. Yetersiz toplamda hiçbir gezegen dondurulamaz.
- Başlangıç: bütün aktif sefer türleri, gelen sefer, klan staging/destek, mevcut radyasyon etkisi, bitmek üzere olan kuyruk ve sezon sınırı.
- Donma: bütün dünyalar, kaynak havuzu/depo, üretim, sadakat, arıza/sızıntı, hasar/onarım, kalkan ve kişisel süreler; doğrudan API ile yasak eylem denemeleri.
- Eşzamanlılık: çift satın alma, ağ yanıtı kaybı/tekrar, aynı anda gönderim/saldırı, worker tarafından alınmış olay, koloni el değiştirmesi ve Silent Space sweep.
- Zaman: başlangıç/bitişin tam anı, çoklu okuma/yazma, çevrimdışı bitiş, geciken worker, restart, istemci saati farkı ve tekrar tatil. Tatil günleri yerel takvim günleri değil tam 24 saat olmalı. Sezon sonuna tam 72/48/24 saat ve sınırın hemen öncesi/sonrası, son 24 saate eşit bitiş, kaydırılan uzun kuyruk ve sezon kapanış regresyonları kapsanır.
- Dönüş: erken ve otomatik bitiş, sıfır iade, tüm gezegenlerin birlikte açılması, gerçek donma süresine göre kalan kuyrukların devamı, arıza/sadakat kurallarının yeniden başlaması, geçmiş tatil süresinin üretim veya hasara dönüşmemesi ve bitiş sonrası zamanın yalnız bir kez işlenmesi. Silent Space dönüşten tam 30 saat sonra değerlendirilir.
- Eski olay güvenliği: erken dönüş → yeni tatil → eski tatilin bitiş olayının gelmesi; birden fazla sonlandırma isteği; eski kuyruk tamamlama olayları ve eşzamanlı yeni saldırı. Tatil iki kez bitmez, yeni tatil bozulmaz, bedel iki kez alınmaz.
- Regresyon: tatilde olmayan oyuncu ekonomisi, savaş/sonda, koloniler, klanlar, sezon kapanışı, Silent Space gidiş/dönüş ve API sözleşmeleri.
- UI: süre seçimi, fiyat dökümü, onay, engel açıklamaları, tatil durumu, çoklu sekme, sunucu hatası ve yerelleştirme.

## Uygulama sırası ve bitiş ölçütü

1. Bu plandaki kesin kuralları ve kabul senaryolarını esas al; ürün kararlarını yeniden açma.
2. Tier 4 davranış testleri → FAIL → uygulama → PASS; modalı görsel doğrula.
3. Tatil ücret ve zaman kuralları testleri → FAIL → ortak hesaplayıcı → PASS.
4. Migration, satın alma/transaction ve yarış testleri → FAIL → backend → PASS.
5. Donma/koruma, event ve Silent Space entegrasyon testleri → FAIL → uygulama → PASS.
6. UI/API sözleşmesi testleri → FAIL → v2 ekranlar, çeviriler ve Wiki → PASS.
7. Değişen alanlarda kod incelemesi; `node tools/visual.mjs` ile gerçek arayüz kontrolü; ardından `pnpm verify`.

Kontroller yerel PC kurallarına göre ardışık, tek workspace/tek Vitest worker ve `nice -n 10` ile yürütülür; Node heap en fazla 4 GiB olur. Uzun ekonomi/sezon simülasyonları bu işin otomatik doğrulamasına dahil değildir.

Mevcut çalışma ağacında çok sayıda kullanıcı değişikliği bulunuyor. Uygulama mevcut diff'i korumalı; migration numarası uygulama anındaki son migration'a göre seçilmeli. Plan dışı değişiklikler geri alınmaz.
