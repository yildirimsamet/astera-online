# Anıt değişikliği: kod incelemesi ve model entegrasyonu

Tarih: 2026-10-10. Kapsam: onaylanan Easy/Hard kuralları, kişisel filo döngüsü,
ortak klan saldırısı, mevcut sezonun güvenli geçişi, API/arayüz ve üç yeni model.

## Doğrulanan ve düzeltilen bulgular

### 1. Canlı geçişte radyasyon başlangıcının geriye kayması

`monumentAdoption.ts`, sezon kilidini beklemeye başlamadan önce aldığı saati
kullanıyordu. Kilit beklerken başka uçuşlar işlenirse, yeni bulutlar ve eski
bulutların bitişi daha önce işlenmiş zamana yazılabiliyordu.

Önce regresyon testi eklendi: sezon kilidi tutuldu, geçiş başlatıldı, oyun
saati beş dakika ilerletildi, kilit bırakıldı. Test eski kodda başarısız oldu.
Düzeltmeyle saat, özel sezon kilidi alındıktan sonra okunuyor. Eski bulutun
bitişi ve yeni sekiz bulutun başlangıcı gerçek geçiş anını kullanıyor.

Kanıt: `/tmp/astera-monument-cr-cutover-red.log`,
`/tmp/astera-monument-cr-first-green.log`.

### 2. Ortak saldırıda bitmiş kişisel seferin hâlâ aktif sayılması

Klan hazırlığı, anıt varışlarını ve HOLD'u ilerletiyordu; oyuncunun süresi
dolmuş dönüşünü veya yolda radyasyondan tamamen yok olmuş filosunu her zaman
uzlaştırmıyordu. İşçi gecikirse, aslında yeniden gönderme hakkı açılmış kişi
`MONUMENT_FLEET_ACTIVE` hatası alabiliyordu.

İki regresyon testi eski kodda başarısız oldu: işçi çalışmadan eve ulaşmış
son dönüş ve varış saatinden önce tamamı yok olmuş son filo. Hazırlık artık
önceden kilitlediği gezegenlerle bu iki durumu da uzlaştırıyor. Devam eden
gerçek seferin takviye yasağı korunuyor.

Kanıt: `/tmp/astera-monument-cr-joint-red.log`,
`/tmp/astera-monument-cr-first-green.log`.

### 3. Canlı model değişiminde devam eden shader hazırlığının bozulması

Gerçek tarayıcıda beş eski anıttan sekize geçerken Three.js `compileAsync`,
artık kaldırılmış bir materyalin GPU programını kontrol etmeye devam edip
`isReady` hatası veriyordu. Hata gerçek sayfa istisnasıyla doğrulandı.
Başlangıç hazırlığı artık kendi materyal kopyalarıyla çalışıyor; modellerin
geometri ve dokuları kopyalanmıyor. İş bitmeden bu kopyalar kaldırılmıyor.
Hazır programlar gerçek materyallere bağlandıktan sonra kopyalar bırakılıyor;
böylece ilk çizimde aynı shader tekrar derlenmiyor.

Kaldırılan materyal, hazırlık sürerken unmount, başarısız hazırlık, veri
bekleme, ortak materyal/doku ve GPU programının sahipliği için altı test var.
Eski davranışta regresyonlar başarısız oldu; düzeltilmiş davranışta geçti.
İlk gerçek oyun kontrolündeki yedi adım da tarayıcı hatası olmadan geçti.

Kanıt: `/tmp/astera-monument-warmup-red.log`,
`/tmp/astera-monument-warmup-cache-red.log`,
`/tmp/astera-monument-presentation-green.log`,
`/tmp/astera-monument-cr-manual.log`.

### 4. Ortak saldırıdan sonra kişisel gönderim izninin ekranda gecikmesi

Ortak saldırı gerçek anıt filolarını oluşturuyordu, fakat katılımcılara
`private:monument` olayı göndermiyordu. Klan hazırlığı güncellenirken kişisel
gönderim izni eski kalıyor; açık ekranda savaş gemileri bir sonraki sorguya
kadar seçilebiliyordu. Sunucu bu takviyeyi zaten reddediyordu.

İki gerçek PostgreSQL olay testi önce başarısız oldu: gemi gönderen lider ve
üyenin ikisinin de yenilenmesi; gemisiz lider koordinasyonunda yalnız gerçek
katılımcının yenilenmesi. Hata gerçek tarayıcıda da doğrulandı: sunucunun
`cargoOnly` cevabına rağmen açık ekrandaki savaş gemisi seçimi kilitlenmedi.

Başarılı ortak kalkış artık her farklı filo sahibine aynı işlemde kişisel anıt
olayı gönderiyor. Gemisiz koordinatör için kişisel döngü açılmıyor. Regresyonlar
ve gerçek tarayıcı kontrolü geçti: sayfa yenilemeden ve periyodik sorguyu
beklemeden savaş gemileri kilitlendi, kargo gönderimi açık kaldı.

Kanıt: `/tmp/astera-monument-joint-stream-red.log`,
`/tmp/astera-monument-joint-stream-manual-red.log`,
`/tmp/astera-monument-joint-stream-green.log`,
`/tmp/astera-monument-cr-manual-final.log`.

### 5. Önceki sezon adları sonradan gelince anıt listesinin eski kalması

Galaksi ekranının arama listesi anıt adlarını önbelleğe alırken sezonun
onurlandırılan oyuncularını bağımlılıklarına katmıyordu. Pozisyonlar aynı
kalıp sezon cevabı sonradan gelirse liste eski adlarla kalıyordu.

Gerçek `GalaxyView`, API istemcisi ve Zod sözleşmesiyle yazılan regresyon
eski kodda başarısız oldu. Liste artık sezonun ilk sekiz adı değişince de
hesaplanıyor. İki test hem adların sonradan gelmesini hem başka sezona
geçerken adların kaldırılmasını kapsıyor; galaksi verisi değişmeden geçti.

Gerçek tarayıcıda da izole veritabanına önceki sezonun sekiz kapanış kaydı
eklenip gerçek sezon olayı yayınlandı. API veya istemci önbelleği değiştirilmedi.
Açık liste, odak kartı ve anıt detayı sekiz doğru adı sayfa yenilemeden gösterdi.

Kanıt: `/tmp/astera-monument-finder-refresh-red.log`,
`/tmp/astera-monument-finder-refresh-final.log`,
`/tmp/astera-monument-cr-manual-final.log`.

### 6. Yayın sonrasında eşzamanlı gezegen güncellemesiyle anıt okumasının 500 dönmesi

Production loglarında 19:43:58 ve 19:45:16 UTC'de iki gerçek anıt listesi
isteği başarısız oldu. PostgreSQL `40001`, tutarlı görünümün gezegen
kilidini almadan önce başka bir işlemin o gezegeni güncellediğini gösterdi.
Hata zaten tanınıyordu; aralıksız üç yeniden deneme çakışmayı tüketemedi.
Başarısız işlemler geri alındı; filo veya kaynak çoğalması gözlenmedi.

Gerçek PostgreSQL üzerinde her görünüm snapshot'ından sonra ayrı bir
gezegen güncellemesi commit eden regresyonlar önce aynı 500'ü üretti.
Liste ve detay okuması artık en çok beş kez deneniyor; yalnız `40001`
sonrasında 10/20/40/80 ms bekleyip yeni bir işlem açılıyor. Tutarlı
snapshot, kilit sırası ve aynı oyun saati korunuyor. Gönderim ve geri
çekme kuralları değişmiyor.

Üç/dört ardışık çakışmada okumanın tamamlanması, fiziksel radyasyon
kaybının yalnız bir kez işlenmesi, beş çakışmada sınırda durup bütün
filoyu koruması ve ilgisiz hatanın tekrar denenmemesi kontrol ediliyor.
Kanıt: `/tmp/astera-monument-concurrent-read-red.log`,
`/tmp/astera-monument-concurrent-read-green.log`.

## Kapsamı genişletilen testler

| Konu | Kontrol |
| --- | --- |
| Eşzamanlılık | Aynı kişinin farklı gezegenlerinden iki ilk gönderim; yalnız biri kabul edilir |
| Tekrar gönderilen istek | Aynı idempotency anahtarına aynı cevap; yeni anahtarla ek savaş filosu reddedilir |
| İlk kargo seferi | Kişisel döngüyü başlatır; karışık savaş takviyesi yakıt/gemi taşımadan reddedilir |
| Geri çağırma | İlk seferin tamamını geri çevirmek, eve varmadan yeni savaş filosu hakkı açmaz |
| Dolu anıt | Saldırıda boş hangar aranmaz; bütün saldıranlar savaşır, zafer sonrası fazlalık döner |
| Tier yükselişi | Mevcut Easy filosu kalır; yeni kargo reddedilir; geri çekme çalışır |
| Gerçek API sözleşmesi | Sekiz hedef, özel gönderim izinleri ve galaksi cevabı gerçek istemci Zod şemalarından geçer |
| Gizlilik | Kişisel `sendAccess` genel galaksi cevabına sızmaz |
| Eski sezon | Geçiş yapılmamış LEGACY hedefler mevcut davranışı sürdürür |
| Geçiş geçmişi | Kapanmış/anıt dışı bulutlar korunur; geçmiş doz değişmez; yeni doz doğru sınırdan başlar |
| Olay kuyruğu | Önceden alınmış eski garnizon dönüşü geçersizleşir; ilgisiz sezon olayı korunur |
| Hatalı yerleşim | Yarım uygulanmış karışık düzen hiçbir kayıt değiştirmeden reddedilir |
| Gerçek arayüz işlemi | Yalnız kargo izninde gönderilen içerik kargodan oluşur; tier sınırında geri çekme çalışır |
| Ortak kalkış olayı | Her gerçek katılımcının kişisel gönderim izni yenilenir; gemisiz koordinatöre kişisel döngü açılmaz |
| Sonradan gelen sezon verisi | Anıt konumları değişmeden ilk sekiz ad listede güncellenir; kaldırıldığında eski adlar kalmaz |

Önceden mevcut ortak saldırı testleri ayrıca ilk ortak katkıları, katılımcı
bazında tier ve sefer denetimini, gemisiz lider koordinasyonunu ve hazırlık
sırasında tier değişmesini kapsıyor. Gemi kaybı, kaynak paylaşımı, kapasite,
klan üyeliği ve sezon kapanışı regresyonları da tam normal testlere dahildir.

Sınıf adları son kullanıcı talimatıyla oyunun altı dilinde çevriliyor:
Türkçe Kolay/Zor, İngilizce Easy/Hard, Almanca Leicht/Schwer,
İspanyolca Fácil/Difícil, Fransızca Facile/Difficile ve Japonca イージー/ハード.
Türkçe erişim/hata mesajları ve Wiki karşılaştırması aynı adları kullanıyor.
İki sınıf adı çeviri istisna listesinden çıkarıldı. Açık anıt listesinde dil
değişimi ve değişmeyen anıt kimliği/sırası ayrıca regresyonla kontrol ediliyor.
Önceki başarısızlık `out/asteroid-density-20261010/web-green.log` içinde
kayıtlıdır; dosyanın adına rağmen o koşu başarılı değildir.

## Tam normal doğrulama

Son `pnpm verify` koşusu 18:48 UTC'de sıfır çıkış koduyla tamamlandı.
Typecheck dört çalışma alanında, root lint bütün kapsamda geçti. Testler
`nice -n 10`, tek çalışma alanı ve tek Vitest işçisiyle sırayla çalıştı:

| Çalışma alanı | Başarılı dosya | Başarılı test | Atlanan test |
| --- | ---: | ---: | ---: |
| Rules | 114 | 2.046 | 0 |
| Server | 216 | 3.230 | 1 |
| Web | 419 | 5.768 | 29 |
| Toplam | 749 | 11.044 | 30 |

Otuz atlama, `STRATEGIC_CRAFTING_ENABLED=true` olduğu için uygulanmayan
eski silah-kapalı beklentileridir: bir intel testi ve `strategic-offline`
dosyası. Açık silah davranışlarının testleri çalıştı. Anıt veya asteroid
testi atlanmadı. Uzun ekonomi/sezon simülasyonları ve snowball audit,
kullanıcının açık talimatı olmadan çalıştırılmadı.

Kanıt: `/tmp/astera-monument-cr-full-verify.log`. İlk yarıda durdurulan
eski koşu tam doğrulama sayılmadı; yukarıdaki sonuç tek tamamlanmış koşudur.

## Yeni modeller

Yeni kaynaklar içerikleri korunarak `assets/source/models/monuments/` altına
taşındı. Oyuna yalnız `apps/web/public/assets/models/monuments/` altındaki
optimize kopyalar gönderiliyor. İlk beş model ve anıt kimliği değişmedi.

| Anıt | Kaynak üçgen | Oyundaki üçgen | Doku | Sıkıştırma |
| --- | ---: | ---: | --- | --- |
| Parçalanmış Dyson Küresi | 9.557 | 4.999 | 1 × 1280 px | WebP + Meshopt |
| Uyuyan Muhafız | 9.350 | 7.462 | 3 × 1280 px | WebP + Meshopt |
| Kadim Savaş Mezarlığı | 195.710 | 4.774 | 3 × 1280 px | WebP + Meshopt |

Mevcut modellerin sınırı da 5.000 üçgen; üç dokulu modelleri 1280 px,
tek dokulu iki eski model 2048 px. Yeni kaynakların 512 px dokuları,
sadeleştirilen yüzeyin yeni atlasına yeniden örneklendi. Atlas boyutu kaynakta
olmayan ayrıntı üretmez; UV birleşimlerinde doku esnemesini önler. Bu nedenle
çıktı dosyasının her kaynak dosyadan küçük olması beklenmez.

Yeni kaynakların Draco sıkıştırması çevrimdışı çözülüyor; tarayıcıya Draco
yükleyicisi eklenmedi. Kaynak değişmeden çözme işleminin regresyon testi,
eksik decoder ile önce başarısız oldu, decoder eklendikten sonra geçti.
Mezarlığın hata sınırı 5.000 üçgene ulaşacak şekilde ayrı ayarlandı.
Kullanıcının ilk görsel incelemesinden sonra Muhafız'ın sınırı tek modele
özel 7.500 oldu: 4.802 yerine 7.462 üçgenle daha fazla zırh ayrıntısı korunuyor.
1280 px doku bütçesi değişmedi; diğer yedi anıtın sınırı 5.000 olarak kaldı.
Muhafız'ın dosyası yaklaşık 1,03 MiB; bütün modellerin aktarım ve materyal
kontrolleri geçiyor.

| Sınıf | Anıtlar |
| --- | --- |
| Hard, 1–4 | Terk Edilmiş Uzay Enkazı; Terk Edilmiş İstasyon; Kadim Gözlemevi; Kadim Yıldız Geçidi |
| Easy, 5–8 | Parçalanmış Dünya Gemisi; Parçalanmış Dyson Küresi; Uyuyan Muhafız; Kadim Savaş Mezarlığı |

Yeni üç ad altı dilde güncellendi. Harita, anıt bulucu, bildirimler ve savaş
raporları aynı kimlikten model ve adı alıyor.

## Kullanıcının sonraki görsel talepleri

| Konu | Easy | Hard |
| --- | --- | --- |
| Model boyutu / tüccar gemisi | 3× | 5× |
| Model çevre çizgisi | Yeşil | Kırmızı |
| Radyasyon seviyesi ve hasarı | 1; 2 HP/gemi/dk | 2; 5 HP/gemi/dk |
| Bulut görünümü | Sarı; önceki kendi opaklığının %55'i | Mevcut yeşil ve opaklık |
| Anıt listesindeki grup | Altta | Üstte |
| Önceki sezonun onurlandırılan sıraları | 5–8 | 1–4 |

Bulut seviyeleri anıta bağlı gerçek 2/5 HP profillerinden yayınlanıyor;
operatör bölgeleri, sığınaklar ve eski 4 HP bulutları yeniden etiketlenmiyor.
Bu görsel fark hasar hesabına, süreye veya radyasyon alanının çapına etki etmiyor.
Önceki sezonun adları aynı galaksinin kapanmış sezon kaydından geliyor;
eksik sıra için oyuncu adı uydurulmuyor. Adlar altı dilde aynı kalıcı kimliğe
ekleniyor. Mobil ve masaüstü odak kartında uzun ad ve özet artık ayrı
satırlarda; ad, kontrol sahibi ve özet gerektiğinde satır sarıyor.

Son boyut talebiyle Easy 4× yerine 3×, Hard 7× yerine 5× oldu. Önce yeni
ölçüyü bekleyen iki test eski ölçüde başarısız oldu; model, odak mesafesi,
seçim alanı ve gezinme sınırı aynı ölçek hesabını kullandığından yeni ölçü
hepsine birlikte uygulandı. Model ve harita dosyalarının 26 testi geçti.
Kanıt: `/tmp/astera-monument-size-3-5-red.log`,
`/tmp/astera-monument-size-3-5-green.log`.

## Tarayıcı kontrolleri

Sekiz modelin tamamı, orijinal ve optimize olarak hem 350 px mobil hem
masaüstünde gerçek WebGL ile yüklendi: son ölçülerle 32 kontrol geçti.
Easy tüccar gemisinin 3 katı, Hard 5 katı. Muhafız 7.462 üçgen; diğer yedi
optimize gövde 5.000 üçgen veya altında. Muhafız'ın kaynak/optimize
görüntüleri ayrıca iki ekranda gözle incelendi; silüet ve zırh ayrıntıları
korunuyor. Yüzey ayrıntıları doğal olarak sadeleşiyor.

Görüntüler ve ölçümler: `out/monument-models-2026-10-10/`.
Kanıt: `/tmp/astera-monument-model-visual-final.log`.

Yeni yerel sezonun gerçek API'siyle mobil ve masaüstünde sekiz modelin
sahnedeki ölçüsü, çevre çizgisi shader rengi ve sekiz bulutun seviyesi,
rengi ve opaklığı da ölçüldü. Hard üstte/Easy altta sıralaması ve kartın
metin/sayfa taşmaması geçti. Masaüstü ad alanı 198 px, mobil 228 px;
iki ekranda da metnin kaydırma genişliği kendi alanını aşmıyor.
Görüntüler: `out/monument-cr-2026-10-10/local-visual/`.
Kanıt: `/tmp/astera-monument-local-visual.log`.

İzole `astera_monuments_review_test` veritabanıyla gerçek tarayıcıda,
API yanıtlarını değiştirmeden aşağıdaki dokuz oyun kontrolü de geçti:

| Gerçek oyun kontrolü | Sonuç |
| --- | --- |
| Açık istemcide 5 eski anıttan 8 yeni anıta geçiş | Sayfa yenilenmeden liste ve modeller güncellendi |
| Ortak saldırı kalkışı sırasında açık katılımcı ekranı | Sayfa yenilemeden savaş gemileri kilitlendi; kargo kullanılabilir kaldı |
| Arayüzden Hard'ı fethetme | Savaş gemisi takviyesi kapalı, kargo açık |
| Savaş gemileri eve dönerken kişisel kargo anıtta kalır | Yeni savaş gemisi sunucuda reddedildi |
| Kilitli kişisel döngüde arayüzden kargo gönderme | Gerçek gönderim yalnız kargodan oluştu |
| Son kişisel kargonun dönüş sınırı | Varıştan önce kilitli; varıştan sonra açıldı; klan üyesi HOLD'a devam etti |
| Easy HOLD sırasında tier 4'e yükselme | Eski filo kaldı; yeni kargo reddedildi; arayüzden geri çekme kabul edildi |
| Aynı galaksinin önceki sezonundan ilk sekiz adın sonradan gelmesi | Açık liste, odak kartı ve detay yenilendi; galaksi verisi değişmedi |
| 350 px mobil ve masaüstü | Sayfa/panel taşması ve tarayıcı istisnası yok |

Kanıt: `/tmp/astera-monument-cr-manual-final.log`,
`out/monument-cr-2026-10-10/manual-results.json`.

## Yerel inceleme sezonu

Yerel web `http://localhost:5173`, API ve işçi 3100 portunda çalışıyor.
Sezon, normal geliştirme verisinden ayrı `astera_monuments_local`
veritabanında, EU-1 ve ruleset 16 ile açıldı; gerçek saati kullanıyor.
Galaksi sekiz yeni anıtı ve doğru 4+4 ayarlarını yayınlıyor. Model galerisi
`http://localhost:5173/v2-gallery.html?view=monument-models` adresinde;
oyunda kullanılan gerçek gövdeleri tüccar gemisiyle yan yana gösteriyor.

Bu yeni veritabanında önceki sezon kaydı yok; bu nedenle yerelde anıtların
özgün adları gösterilir. Gerçek sezon arşivinden ilk sekiz adı okuma,
diğer galaksinin sıralamasını karıştırmama, eksik sıralar ve gerçek
`/api/season` istemci sözleşmesi sunucu testlerinde doğrulandı.
Yerel oynanabilir sezon, tarayıcı oynanış kontrolü ve otomatik testler
üç ayrı veritabanını kullanıyor.

## Kabul edilen davranışlar

Klanın ilk kez katılan üyesi kendi başlangıç filosunu gönderebilir. Kişinin
son kargosu da gerçekten eve dönerse, klanı hâlâ tutuyor olsa bile yeniden
başlayabilir. Easy'de tier yükselten mevcut filo kalabilir. Bunlar onaylanan
kurallardır; ek bekleme süresi, klan çapında yasak veya saldırı boyutu sınırı
getirilmedi. Küresel dağılım herkese tam eşit mesafe garantisi vermez.

Uzun ekonomi/sezon simülasyonları kapsam dışında; bu inceleme sezon boyunca
kazanç dengesinin veya fiziksel telefon GPU performansının ölçümü değildir.
