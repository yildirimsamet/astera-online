# Honor v4 görünür açılış provası

16 Ekim: daha önce onaylanan kapalı deploy → gözlem → temiz yarış açılışı işinin
v4 politikasıyla birleştirilmesi. Bu belge canlı deploy, gerçek sezon açılışı veya
oynanabilir yerel sezonda değişiklik yapıldığı anlamına gelmez. Gerçek servis
provaları yalnız ayrılmış test veritabanında çalıştırılıyor.

## Sürüm sözleşmesi

- Yeni açık operator `honor-shadow` işlemi, henüz Honor konfigürasyonu olmayan
  ana sezonda v4 hazırlar. Önizleme yazmaz; `--yes` görünmez gözlemi başlatır.
- Mevcut v1/v3 veya v2 SHADOW yapılandırması kendiliğinden v4'e yükseltilmez.
  Katalog, başlangıç gözlemi ve eski sezon puanları değişmez.
- En az 24 saat gözlem ve açık operator `honor-open --yes` gerekir. Beklemek,
  migration veya deploy yarış açmaz. Görünür başlangıçta puan/çift/tekrar/karşılık
  bütçeleri temizlenir; deneme kanıtı ve askerî referans geçmişi korunur.
- v2 halen yalnız SHADOW adayıdır. v4'ün özel silah envanteri ve eşzamanlı
  muhasebesi, yayına uygunluk kontrolünden bağımsız `honorAdvancedPolicy`
  özelliğiyle seçilir. Sürümü açarken hesaplama yanlışlıkla v3'e dönmez.
- Doğrudan `prepareHonorSeason` varsayılanı v3 kalır. Bu, eski sezon/fixture
  sözleşmesini değiştirmez; açık yeni operasyon v4 seçer. İlan edilmiş v4 programı
  gerçek sonraki ana sezonlara v4 olarak taşınır; deneme kendiliğinden taşınmaz.
- Ekonomik yararlar ayrı açık `honor-benefits --yes` işlemidir. Yarış açmak bu
  programı otomatik açmaz; açılmış program sonraki sezonlara taşınır.

## Prova matrisi

| Alan | Kontrol |
|---|---|
| Gerçek 1v1 | Açılıştan önce, aynı ms ve 1 ms önce gönderilen saldırı fiziksel olarak tamamlanır fakat yarışa yazılmaz. Aynı ms içinde açılıştan sonra gönderilen gerçek saldırı puanlanır; rapor defterle aynı kalır. |
| Deneme geçmişi | Tamamlanmış SHADOW savaş raporu açılış sonrası görünür puana dönüşmez. Önizleme yazmaz; kataloglar değişmez. Retry eksik yeni commitment'ı eski uçuş istisnası haline getiremez. |
| Ortak saldırı | Önce gönderilen ortak saldırı dışarıda kalır; önceden hazırlanan havuz açılıştan sonra gönderilirse normal fiziksel savaş olur, ortak pozitif Honor yasağı korunur. |
| Anıt | Eski HOLD yeni saldırıya savunabilir; önce/sonra gönderim sınırı ve retry gerçek anıt çözümleyicisinde kontrol edilir. |
| EMP / interceptor | Aynı ms açılıştan önceki uçuş dışarıda; sonraki gerçekten etkili uçuş ranked taktik kayıt üretir. Önleme eski uçuşta fiziksel olarak tamamlanır fakat puan yazmaz; yeni uçuşta gerçek silah kaybı ve başarılı savunma yazılır. Retry tek kayıt ve tek harcanmış interceptor bırakır. |
| Radyasyon | OUTBOUND ve HIT kaynaklar açılışta eski kaynak olarak dondurulur. Fiziksel hasar sürer fakat görünür puan üretmez. Yeni bomba gerçek yeni hasarla puanlanır. |
| Eşzamanlı muhasebe | SHADOW ve ACTIVE v4 aynı eşit sonuçları 50/50 paylaşır; ters teslim sırası sonuçları değiştirmez. v3 eski sıralı sonucu, v2 aday koruması korunur. |
| Atomiklik | Açılış rollback, eşzamanlı operator, retry, geç replay, eksik geçmiş, WAITING/kapalı/geçersiz zaman sınırları v3 ve v4 üzerinde kontrol edilir. |
| Kapanış / devir | Gerçek ranked v4 savaş sonucu dondurulur, ödül bir kez oluşur; rollover v4 ve açık ekonomik programı taşır. Yeni oyuncu tatilsiz ve puansız başlar; eski Honor toplamları/season_results audit için korunur. |

## Gerçek açılış için işlem sırası

Bu komutlar uygulanacak sezonun doğrulanmış UUID'siyle, normal dağıtım
kontrolleri tamamlandıktan sonra kullanılır. Bu geliştirmede çalıştırılmadılar.

1. Mevcut sezon konfigürasyonu salt okunur incelenir. Mevcut ACTIVE v1/v3
   yükseltilmez; mevcut v2 SHADOW ranked açılmaz. Yeni v4 hazırlığı olmayan
   Honor konfigürasyonunu oluşturur, olanı dönüştürmez.
2. Additive migration, sunucu/worker/istemci aynı doğrulanmış sürüme dağıtılır.
   Bütün yazıcılar yeni kayıt ve phase sözleşmesini desteklemeden SHADOW
   başlatılmaz. Deploy kendi başına Honor veya ekonomik etkileri açmaz.
3. `pnpm --filter @astera/server season honor-shadow --season UUID` ile salt
   okunur önizleme alınır; yeni konfigürasyon için sürüm 4 görülmelidir.
   Açık işlemde aynı komuta `--yes` eklenir. Görünür skor/ödül başlamaz.
4. Tercihen 2–3 gün gözlem yapılır; kod en az 24 saati zorunlu tutar.
   Etkisiz/gerçek özel silah, tekrarlar, ortak taraf ve rapor kayıtları kontrol
   edilir. Geçmiş deneme toplamı yarış başlangıç puanı olarak kullanılmaz.
5. Duyurulan başlangıçta `pnpm --filter @astera/server season honor-open --season UUID`
   ile önizleme, ardından `--yes` ile temiz görünür yarış
   açılır. Önce gönderilen uçuşlar puanlanmaz; eski askerî referanslar korunur.
6. Ekonomik etkiler açılacaksa ayrıca `pnpm --filter @astera/server season honor-benefits --season UUID`
   önizlemesi ve `--yes` işlemi gerekir.
   Onaylı sabit eşikler ve oranlar kontrol edilir; eski sipariş/uçuşlar korunur.
7. Leaderboard başlangıcı, özel silah açıklaması, yeni gerçek rapor ve fiyat
   teklifleri doğrulanır. Geri dönüş yapılacak kod da ranked phase, uçuş sınırı
   ve ekonomik snapshot sözleşmesini korumalıdır; eski bir yazıcıya körlemesine
   dönmek güvenli rollback sayılmaz.

## TDD ve sonuç kaydı

`v4-opening-red.log`: yeni v4 1v1/devir ve yeni operator sürüm beklentileri
eski korumalar altında **8 FAIL / 25 PASS**. Taktik açılışın beş senaryosu da
ayrıca eski açılış korumasında RED verdi. Sürüm uygunluğu ile muhasebe/katalog
özelliği ayrıldı; yeni operator v4 seçiyor.

İlk 9 dosyalık tekrar **88 PASS / 1 FAIL** verdi. Son hata ürün hatası değil,
yeni sezon testi eski audit toplamlarının tamamen silineceğini varsayıyordu.
Şema bunları bilinçli korur; kontrol eski sezonun değişmez kalması ve yeni
sezonun boş olması olarak düzeltildi. Ardından sorgunun garanti edilmemiş satır
sırası testi yanıltınca snapshot okumaları oyuncu kimliğiyle sıralandı.
Bu iki fixture hatası oyun davranışı değiştirilerek çözülmedi.

Son geniş Honor sunucu koşusu **48 dosya / 440 PASS / 24 FAIL / 2 SKIP**.
Bu 24 hata yeni iki sürümlü test fixture'ındaydı: v3 grubunun `afterAll`
işlemi ortak bağlantıyı kapatınca v4 grubunun tamamı `CONNECTION_ENDED`
ile duruyordu. Kapanış dosya sonuna taşındı; ürün kodu değiştirilmedi.
Diğer **47 dosya** geçti; gerçek v4 raid/önizleme/ödül/devir dosyasının
**7 testi** de bu geniş koşuda geçti.

`release-opening-final.log`: v3 ve v4 açılış matrisi **48 PASS**; eski/yeni
EMP, gerçek interceptor ve radyasyon kaynakları **7 PASS**, toplam
**2 dosya / 55 PASS**. Kurallar/Honor/klan/ekonomi son kontrolü
**11 dosya / 176 PASS** (`release-rules.log`).

Arayüz tekrarı **22 dosya / 342 PASS / 6 FAIL** verdi. Honor dosyalarının
tamamı geçti; altı hata dört genel UI test dosyasındaki eski beklentilerdi.
Silah stok sayısı yeni `Ready: 1 · Building: 1` yazımına, Aegis yardımı
geminin ayrı koruma katmanına, menü izin listesi yeni kalıcı tatil kontrolüne,
destek bildirimi ortak kısmi-sonuç sözleşmesine uyarlandı. Japonca sözlüğün
tatil ücreti formülündeki “çift sayı” sözcüğü doğru matematik anlamıyla
kullanılıyor; yanlış oyun-terimi yasağından yalnız bu yaprak ayrıldı,
diğer sözlükte yasak korundu. **4 dosya / 113 PASS** hedefli tekrar bunların
tamamını doğruladı. Hiçbir oyun mekaniği veya genel UI bu beklentiler için
değiştirilmedi.

Son statik kontroller: rules, server, web ve sim **typecheck PASS**;
server/rules, web, tools/sim kapsamlı üç ardışık **lint PASS**.
Değişen izlenen dosyalarda `git diff --check`, yeni release dosyalarında
ayrıca whitespace kontrolü geçti. Görsel kod bu release adımında değişmedi;
CR'nin önceki **204 gerçek React görünümü** kanıtı geçerli kapsam olarak kaldı.

Bu provada doğrulanmamış bir v4 açılış engeli kalmadı. Bu, tek yeniden
çalıştırılmış tamamen yeşil `pnpm verify` sonucu veya canlıya dağıtım
iddiası değildir: genel koşudaki başarısız dosyalar nedenleri doğrulanıp
hedefli tekrarlarla kapandı; örtüşen test sayıları benzersiz toplam gibi
sunulmuyor. Gerçek dağıtım hâlâ seçilen kesin SHA, güncel veritabanı restore/
migration uyumluluğu ve bütün yazıcıların aynı protokolde olması gibi
normal deployment kontrollerini gerektirir.
