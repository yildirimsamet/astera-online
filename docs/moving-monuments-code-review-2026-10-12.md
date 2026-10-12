# Hareketli anıtlar — ayrıntılı code review

12 Ekim 2026. Kapsam: dış anıtların ortak 8/16 saat dönüşü, canlı sezonda geçiş, filo/klan/probe, hedefe bağlı radyasyon, yakıt ve tekrar destek. Ana sözleşme: [uygulama ve geçiş planı](moving-monuments-two-axis-plan-2026-10-12.md). İnceleme ve yerel doğrulama tamamlandı; aşağıdaki bulgular giderildi. Kullanıcının talimatıyla deploy yapılmadı; gerçek sezonda aktivasyon çalıştırılmadı.

## İncelemede bulunan ve düzeltilen sorunlar

| Öncelik | Sorun ve tetikleyici | Düzeltme ve kanıt |
| --- | --- | --- |
| P1 | Bugünkü hedefe gidiş/dönüşü ikiyle fiyatlamak, anıtta saatlerce bekledikten sonraki gerçek dönüşü karşılamıyor. | Gerçek gidiş + azami dönüş rezervi. Kısmi recall, kayıpta payın yanması ve HOME'da tek ödeme: `monument-fuel.test.ts`, saf fuel testleri. |
| P1 | Aktif sezona yalnız ruleset yükselterek açmak, sezonun ilgisiz kurallarını değiştirir veya başlangıçtan bu yana dönmüş gibi konum sıçratır. | Ayrı `monument_motion_starts_at`; o anki başlangıç koordinatları korunur. `monument-motion-adoption.test.ts`. |
| P1 | Boş görünen anıta yaklaşan filo/sonda veya açık klan hazırlığı varken açmak eski statik sözleşmeyi bozar. | OUTBOUND/HOLD/RETURNING, sonda ve anıt ortak operasyonu kontrolü. Exclusive season kilidiyle dispatch yarışı ve çift aktivasyon testleri. |
| P1 | Klan katkısının anıta uçuş mesafesi, katkı gönderimiyle birleşik kalkış arasında değişiyor. | Gelecekteki anıt bacağı için ayrıca rezerv; gerçek ortak kalkışta fiyat ve oyuncunun kendi kohortlarına pay aktarımı. İptal ve fiziksel dönüş testleri. |
| P1 | Hasarlı klan manifesti 10 grubu aşınca kimliğe göre sıralanan fiyat sonucu dizinin indeksine göre yanlış gruba bağlanıyor. | İade gerçek kohort kimliğiyle eşleştirilir. 13 gruplu karma filo testi önce yanlış payı doğruladı; düzeltme sonrası geçti. |
| P1 | Canlı geçiş yalnız `world` bildirirse açık anıt sheet'i ve traffic projeksiyonu eski rezerv/radyasyon bilgisiyle kalır. Genel harita yenilenmesi özel anıt sorgusunu yenilemez. | Anıt, galaxy ve traffic’i birlikte uyandıran `control` kanalı kullanılır. Regresyon önce eski `world` olayını doğruladı; düzeltme sonrası 9 aktivasyon testi geçti. |
| P2 | Mevcut ev yasal diskin dışındaysa OUTBOUND recall, anıt yarıçapından daha uzakta başlayabilir. Yalnız `R + evYarıçapı` bütün dış-fixture dönüşlerini karşılamaz. | Dış yarıçap 8000 için 16000 mesafe rezervi testi önce başarısız oldu, `max(R,H)+H` düzeltmesinden sonra geçti. Normal 4500 sınırındaki davranış etkilenmez. |
| P2 | Başka klan üyesinin toplanma gezegeni diskin dışındaysa, üyenin kendi ev sınırı birleşik uçuşun OUTBOUND geri çağrısını kapsamaz. | Anıt ve toplanma yarıçapının büyüğü dönüş rezervine girer. 8000 toplanma / −4500 ev testinde eski rezerv 164, gereken 194 çıktı. Düzeltme sonrası gerçek ani geri çağırma ve 38 testlik klan dosyası geçti; yasal haritada bedel değişmedi. |
| P2 | Rezervden gerçek yakıt harcanırken önbellekteki servet aynı işlemde azaltılmayabilir. | Native recall testi düzeltmeden sonra geçti. Klan kalkışı ve fiziksel katkı geri çağırması için aynı işlemde servet yenilemesi eklendi; son klan tekrarı 38/38 geçti. |
| P1 | Hareketli alan kesişimi teğet/eşmerkezli sınırda hassasiyet bütçesi sorunu çıkarabiliyor; bakım maliyeti yüksek. | Kullanıcının kararıyla bu mekanizma kaldırıldı. Uçuşta alan hasarı yok; anıt kimliği + bekleme süresi var. Eski statik geçmiş korunuyor. Rules/server entity radiation testleri. |
| P2 | Sürekli çözüm sezon bitişinden hemen önceyken milisaniyeye yukarı yuvarlama varışı tam bitişe taşır. | Yuvarlanmış timestamp tekrar denetlenir. `monument-motion-boundaries.test.ts`. |
| P2 | Yavaş filolarda tek ikili arama birden fazla erişim veya izole teğetin ilkini kaçırabilir. | Güvenli hız sınırıyla tek-kök hızlı yolu, aksi halde soldan aralık araması. İzole teğet ve bir saniyeden dar ilk erişim testi. |
| P2 | Kadro değişmeyince HOLD recall teklifi eski mesafe/ETA'da kalır. OUTBOUND konumu da zamanla değişir. | Seçili recall 5 saniyede yenilenir; arka plan yenilemesi eski geçerli veriyi gizlemez. Commit sunucuda tekrar hesaplar. Web quote yenileme testleri. |
| P2 | Kamera sabitken label örtüşme önbelleği hareket eden anıtı güncellemez. | Hareket halinde 250 ms revision, sabit haritada mevcut cache. `monument-visibility.test.ts`. |
| P2 | Her pace için tam hız ETA'sını bölmek hareketli hedefte farklı buluşmayı kaçırır. | Klan her pace için ortak çözücüye gider. Bütün katılımcıların aynı uç nokta/ETA testi. |
| P2 | Eve dönüş bildirimi iade tutarını ve onarım sonucunu göstermiyor; bütün filo ile seçili kısmi dönüş tahmini yeterince ayrışmıyor. | Ayrı iade makbuzu, bütün/seçili dönüş başlıkları, seçili varış HP’si ve onarım bildirimi eklendi. Klan iptali ve sezon doğrudan teslimi de iade bildirir. UI testleri önce 7 eksik davranışı doğruladı; düzeltme sonrası sheet ve wiki tekrarındaki 41 test ile genel koşudaki 18 anıt bildirim testi geçti. |
| P2 | Kayıp bildirimi kargoyu söylüyor, yok olan geminin yanan yakıt payını söylemiyor. | Radyasyon ve savaş için yalnız sahibinin kayıp payını bildiren sunucu testleri düzeltmeden sonra geçti. Bildirimde kargo ile yakıt ayrı yazılır. |

## İncelenen bütünlük sınırları

- **Kargo ve yakıt ayrıdır.** Rezerv kargo kapasitesine veya yağmaya girmez. Servette taşınan mülk olarak kalır. Geminin kaybı yalnız kendi payını yakar.
- **Kohortlar korunur.** Kısmi geri çağırma, savaş sonrası sağ kalanların ayrılması, RETURNING ve HOME yazımları hasar/kargo/rezerv/iade alanlarını taşır. Alan değerleri sonlu ve negatif olamaz.
- **İşlem tekrarları:** wave status, generation, dedupe ve aynı transaction'da kaynak kredisi korunur. Tekrar gelen eve-varış event'i ikinci ödeme yapmaz.
- **Alternatif ev:** dönüş başlangıcında mevcut güvenli ev kuralı uygulanır. Rezerv tüm yasal gelecekteki ev diskini, mevcut dış evleri ve başka üyeye ait dış toplanma noktasını kapsar. Varıştan sonra ev değişimi mevcut yeniden yerleştirme politikasını kullanır.
- **Gecikmiş worker:** varış, savaş ve probe planlanan tarihlerinde çözülür; bekleme hasarı o sınırdan sonra akar. Sezon kapanışı mevcut doğrudan teslimi korur.
- **Klan sınırları:** toplanma gezegenler arasında statik; son saldırı ortak hareketli buluşma. Araştırma/kalkan onayı oyuncuya aittir. RECALL_ORDERED semantiği korunur. Native filo devrinde katkı rezervi temizlenir; servette çift sayılmaz.
- **Görüş ve mahremiyet:** hareket tanımı kamuya açık anıt konumudur. Rakip özel filo/kargo/HP açığa çıkarılmaz. Gezegen sensor merkezleri sabit; transit rotaları mevcut filtrelerden geçer.
- **Radyasyon tarihçesi:** geçiş öncesi uzaysal pencere ile sonrası hedef penceresi aynı kaynağın farklı dönemleridir. İlgisiz normal uçuşların geçmiş dozu silinmez. Anıtın HOLD üretim/ölüm sırası değişmez.
- **Tekrar destek:** ilk anıt commit'i `d0d4ef5` ile karşılaştırılarak sonradan eklenen yalnız-kargo ek dalga kısıtı kaldırıldı. Tier, kapasite rezervasyonu, uçuş yuvası, fiziksel birimler ve idempotence kontrolleri korundu.
- **İstemci:** model/hitbox/label/aura/focus ortak sunucu saati; seçim veya gönderim sheet'i hareketi durdurmaz. React per-frame render/API döngüsü eklenmez. 350 px ve masaüstü görsel kontrol gereklidir.

## Doğrulama kaydı

Sunucu genel koşusu ve hata/düzeltme sonrası tekrarları birleştirildiğinde **233 dosya, 3413 başarılı test, 1 mevcut atlanan test**. Her dosyanın en son sonucu başarılıdır; bu sayı tek kesintisiz koşu iddiası değildir. İlk genel koşu 13 dosyada başarısız oldu; bunlar gerçek CR hataları ve eş zamanlı Aegis/akın bekleme kuralıyla eski fixture uyumsuzluklarıydı. Son tekrarlar bunların tamamını kapattı. Sonradan eklenen `hcaptcha-preview` dosyası da ayrıca çalıştırıldı. Son rezerv sınırı düzeltmesinden sonra klan/aktivasyon/native yakıt dosyaları birlikte **54/54** geçti.

Aktivasyon testindeki spy hata çıktısı transaction nesnesini serileştirirken worker 2 GB sınırına ulaştı. Assertion yalnız yayımlanan season/event çiftini karşılaştıracak şekilde daraltıldı; 9 aktivasyon testi normal olarak tamamlandı. Klan hazinesi timeout’u aynı dosyanın 29 testlik tekrarında toplam 17,4 saniyede geçti; süre sınırı artırılmadı.

İstemci genel koşusu ve iki dosyanın düzeltme sonrası tekrarı birleştirildiğinde **443 dosya, 6032 başarılı test, 29 mevcut atlanan test**. Genel koşudaki iki hata, seçili başlığın bitişik DOM metnini okuyan assertion ve eski destek kısıtını bekleyen wiki testiydi. Tam dosya tekrarları 41/41 geçti; en son sonucu başarısız dosya kalmadı. Son mekanik temizlikten sonra sheet dosyası ayrıca **31/31** geçti. Bu da tek kesintisiz koşu sayısı değildir.

Rules son genel koşusu **120 dosya, 2122/2122 başarılı test**, 98,24 saniye. Üç workspace’in son sonuçları toplamı **11.567 başarılı, 30 mevcut atlanan test**.

Son düzeltmelerden sonra **dört workspace’in genel tip kontrolü yeniden geçti**. Root lint ilk koşuda kullanılmayan import, gereksiz assertion, optional-chain tercihi ve rota önizlemesindeki sabit renk sınıflarını buldu; bunlar temizlendikten sonra genel lint **0 hata, 0 uyarı** ile geçti. Ardından değişen klan servisi/testi ve görsel araç ayrıca lint’ten hatasız geçti. Rota çizgisi ve açıklamaları aynı mevcut tasarım tokenlarını kullanır. `git diff --check` temizdir.

### CPU ölçümü

[Üretim çözücüsü benchmark aracı](../tools/monument-motion-bench.mjs), [ham ölçüm](evidence/monument-motion-bench-2026-10-12.json). Node 24.11.0, düşük süreç önceliği; 3328 ölçülen çağrı, ayrıca hız başına 32 ısınma çağrısı. Her sonuç sonlu buluşma ve uçuş mesafesi/süresi kalıntısı denetiminden geçti.

| Gerçek filo hızı | Örnek | p95 CPU (ms) | p99 CPU (ms) | En yüksek CPU (ms) |
| --- | ---: | ---: | ---: | ---: |
| 113 | 2048 | 0,0175 | 0,0311 | 0,6281 |
| 75 | 256 | 0,0243 | 0,0338 | 0,0659 |
| 56 | 256 | 0,0292 | 0,0441 | 0,2972 |
| 28,25 | 256 | 0,0438 | 0,0671 | 0,2150 |
| 11,3 | 256 | 0,0391 | 0,0476 | 0,2156 |
| 5,6 | 256 | 0,0403 | 0,0607 | 0,0867 |

Bu örneklerde rota matematiği düşük maliyetlidir. Ölçüm veri tabanı, ağ, tarayıcı çizimi veya patolojik izole teğetleri kapsamaz; üretim yük testi değildir. Genel ilk-kök yolunun hassasiyet bütçesi güvenli hatayla işlemi geri alır. Konumlar veritabanına tick başına yazılmaz; istemcide sekiz gövde/aura ortak saatten hesaplanır.

### Gerçek arayüz ve hareket kontrolü

`WEB=http://localhost:5187 nice -n 10 node tools/visual.mjs out/monument-motion --monument-motion` başarılı. Gerçek API + WebGL renderer; yalnız bu işe ayrılmış `astera_motion_visual_test` veri tabanı ve sahte kullanıcı. Gönderim/geri çağırma yapılmadı; okuma ve fiyat teklifiyle doğrulandı.

| Görünüm | 8 anıt hareketi | 8 aura takip | Gönderim paneli açıkken hareket | Yatay taşma | Seçili dönüş görünümü | Tarayıcı hatası |
| --- | --- | --- | --- | --- | --- | --- |
| 1280 × 850 masaüstü | Geçti | Geçti | Geçti | Yok | Sığıyor | Yok |
| 350 × 850 telefon | Geçti | Geçti | Geçti | Yok | Sığıyor | Yok |

Anıt/aura karşılaştırması tek örnekleme anında yapılır; gerçek frame callback'leri milisaniye sınırını ayrı geçebildiğinden testte aynı `Date.now()` örneği kullanılır. Yükleme ekranı ve giriş sonrası kartın kapanması beklenir. Bunlar test aracındaki zamanlama düzeltmeleridir.

Yerel kanıtlar: [sonuçlar](../out/monument-motion/results.json), [masaüstü gönderim](../out/monument-motion/desktop.png), [telefon gönderim](../out/monument-motion/phone.png), [masaüstü kısmi dönüş](../out/monument-motion/desktop-recall.png), [telefon kısmi dönüş](../out/monument-motion/phone-recall.png). Dört görüntü açılarak incelendi. Gidiş/rezerv ayrımı, eve varışta iade/kayıp kuralı, mevcut ve tahmini HP, seçili dönüş bedeli/iadesi okunuyor. Görseller `out/` altında yerel araç çıktılarıdır.

Testler tek workspace ve tek worker ile, düşük süreç önceliğinde çalıştırılır. Son server koşusu, yalnız bu çalışma için yaratılmış boş `astera_monument_final_test` veri tabanında bütün migration zincirinden başlar. Gerçek sezon veri tabanına dokunulmaz. Uzun ekonomi/sezon/snowball simülasyonu çalıştırılmaz.

## Dağıtım ve sınırlar

Migration ek kolonlar ve geçerlilik constraint'i içerir; mevcut hedefleri veya görevleri yeniden yazmaz. Önce tüm API/worker süreçleri güncellenir; ardından shard açıkça belirtilerek kuru önizleme ve boşluk kontrolü yapılır. Etkinleştirme tekrar çalıştırılabilir, faz sıfırlanmaz. Karışık eski/yeni süreçlerle etkinleştirme yapılmaz.

113 hız için tam tur beklememe kanıtı ve 96.000 uçuş / 2.105.344 yön örneği ana plandadır. Örneklemde arkaya düşme bulunmaması bütün gerçek fazlar için analitik yön garantisi değildir. Genel yavaş çözücü patolojik teğetlerde hızlı yoldan pahalıdır; üretim yük testiyle aynı şey değildir.

Gelecekteki radyasyon füzesinin seviyeleri, yığılması, süresi ve gezegendeki filo kapsamı bu çalışmanın tamamlanma iddiasına dahil değildir. Bu iş anıt HOLD hasarını korur ve hedef kimliği altyapısını hazırlar; mevcut olmayan gezegen ana-filo hasar döngüsünü varmış gibi sunmaz.

## Kullanıcıya bilgi verme denetimi

- Gönderim: toplam tahsilat, gerçek gidiş bedeli, dönüş rezervi ve iade/kayıp kuralı.
- Bekleme: gemi grubu başına mevcut HP, üretim ve bilinen ilk kayıp zamanı.
- Geri çağırma: bütün filo tahmini ve seçili gemilerin tahmini ayrı; seçili varış HP’si, dönüş bedeli, eve varışa bağlı iade.
- Eve varış: gerçekten teslim edilen kargo, ödenen yakıt iadesi, ücretsiz toparlanan ve onarıma alınan gemi sayısı.
- Kayıp: radyasyon/savaşla yok olan gemilerin kendi yakıt payı; yaşayanların rezervi kayıp tutarına eklenmez.
- Klan hazırlığı iptali ve sezon kapanışı: mevcut teslim politikasında gerçek iade bildirimi.

Bu yüzeyler istemci/sunucu testleri ve masaüstü/350 px telefon görüntüleriyle doğrulandı. Fiyat/HP teklifleri tahmindir; gönderim ve geri çağırma güncel sunucu saatinde yeniden hesaplanır. Eve-varış bildirimi gerçek ödenen iadeyi ve gerçek onarım sonucunu bildirir.
