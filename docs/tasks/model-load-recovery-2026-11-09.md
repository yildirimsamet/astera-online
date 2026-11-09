# Model yükleme hataları ve model erişim çerezleri — 2026-11-09

## Kapsam ve teşhis

Çalışma tabanı: `origin/master`, `a0701a9f`. Ana yerel checkout bu tabandan 14 commit
gerideydi. Güncel tabanda galaksi komutan gemilerinin erişimi zaten özel arena paketinden
ayrılmış; yenilenen bir model kataloğu ve yerel hata koruması mevcut.

404 tek başına bütün ekranı durdurmaz. Fiber/Drei model yükleyicisi başarısız isteği
render sırasında fırlatır. Yakınında hata sınırı yoksa uygulamanın genel hata sınırı
tüm ağacı kurtarma ekranıyla değiştirir. Genel ekranın yakalama davranışı doğru;
opsiyonel model hatasının oraya kadar ulaşması yanlış.

`Hull` yalnız yükleme bekleyişini karşılıyordu. Formasyonun kozmetik/asıl modeli için
hata sınırı vardı, fakat onun yedek modeli için yoktu. Yedek de başarısız olduğunda
galaksi kapanabiliyordu. Artık bu hatalar yerel olarak karşılanır ve yalnız ilgili
model çizilmez. Komutan gemilerinde bekleme/hata sırasında çizilen geometrik yedek
şekil kaldırıldı. Etiketler, seçim ve oyun durumu korunur.

PNG üretimi kullanıcı tarafından iptal edildi.

## Hâlen kullanılan iki model çerezi

| Çerez | Kullanım | Geçerlilik |
| --- | --- | --- |
| `astera_arena_ref` | `/__ref/` altındaki özel test paketinin model, doku ve ses dosyaları; pilot izni gerekir | 6 saat |
| `astera_galaxy_ships` | `/arena/galaxy-ships/` altındaki yalnız üç komutan gemisi modeli; giriş yapan hesaplara açılır | 6 saat |

İkisi de oyun giriş çerezinden ayrıdır. Galaksi kataloğu geçerli hesap tokenıyla
okunur; yanıt dar yollu çerezi yeniler. İstemci başarılı kataloğu beş saatte yeniler.
Android bu üç modeli paketinden okur ve bu erişim çerezlerine ihtiyaç duymaz.

Kaynaklar: `apps/server/src/arena/references.ts`, `galaxyShips.ts`;
`apps/web/src/arena/access.ts`, `hangar/shipModels.ts`.

## Çerezi kaldırma yolu

Galaksideki üç gömülü dokulu WebP modelini normal sürümlü `/assets/models/` varlıklarına
taşımak, galaksi kataloğunu bu sabit dosyalara yönlendirmek ve
`astera_galaxy_ships` üretimini/kontrolünü kaldırmak en basit yol. Böylece gemi görünümü
oturum süresine, arena sürecine veya `ARENA_REF_DIR` mount'una bağlı kalmaz. Yayın ve
Android paketleme kontrolleri aynı üç dosyanın varlığını doğrulamalıdır.

Tam arena paketi ayrı bir karardır: KG-T45 onu özel test erişimine bağlı tutuyor.
Galaksi çerezini kaldırmak için tüm `/__ref/` paketini herkese açmak gerekmez.
Modellerin giriş gerektirmeye devam etmesi isteniyorsa alternatif, mevcut hesap
tokenını dosya isteğinin Authorization başlığına eklemek ve model endpoint'ini buna
göre değiştirmektir; token yenileme ve tekrar yükleme de ortak istemci üzerinden
yönetilmelidir. Bu, normal statik dosya sunumundan daha çok kod gerektirir.

Bu görevde çerezin kaldırılması **incelendi**; sunucu erişim politikası değiştirilmedi.

## Doğrulama

- `ship-model-failure.test.tsx`: 404, bağlantı ve decode hataları; asıl/yedek modelin
  birlikte kaybı; kozmetik modelden asıl modele dönüş; farklı URL ile toparlanma.
- İlgili genel hata ekranı testleri gerçek render hatalarının hâlâ raporlandığını doğrular.
- `node tools/visual.mjs out/model-load-recovery --model-load-recovery`: 350/1280 px'te
  gerçek GameShell, GalaxyView ve WebGL çizimi; yalnız sunucu verisi fixture ile verilir.
  Dart ve Muhafız HTTP isteklerine 404 döndürülür. Sağlam Pike, çizim, kamera ve menü
  kullanılabilir kalır. Geliştirme React'i yakalanmış hataları konsola/pageerror'a da
  raporlar; bu kayıtlar genel kurtarma ekranının açıldığı anlamına gelmez.

## Code review ve doğrulanan düzeltmeler

1. İlk düzeltmede kullanılan kalıcı hata sınırı, aynı URL'deki geçici filo model
   hatasını bağlantı döndüğünde yeniden denemiyordu. Üç yeni test (tek gövde,
   formasyonun asıl modeli ve düşük detay modeli) önce başarısız oldu. Komutan
   gemilerinin mevcut, sınırlı yeniden deneme davranışı ortak `ShipAssetBoundary`
   dosyasına taşındı ve filo yüklemelerinde de kullanıldı. Başarısız GLTF önbelleği
   temizlenir; `online`/odak dönüşü modelleri sayfa yenilenmeden geri getirir.
   Kalıcı hatada otomatik deneme sınırlıdır.
2. Eski `commander-sight-visual.mjs` toparlanmayı geometrik yedek şeklin yokluğundan
   anlıyordu. İki boş eskort ve yalnız görünmez seçim hacimleriyle eski kontrolün
   hatalı biçimde geçtiği doğrulandı. Ortak kontrol artık her eskortta seçim hacmi
   dışında gerçek model mesh'i arar. Dört test, boş/eksik/tamamlanmış model
   durumlarını ve Playwright'ın kullandığı fonksiyon serileştirmesini doğrular.

Görsel regresyon testine bağlantı dönüşü eklendi: 404 verilen aynı URL'ler yeniden
erişilebilir olduğunda Dart ve komutan modeli yüklenir; açık menü ve seçim korunur.
Bu test özel model paketine bağımlı değildir; toparlanan komutan model isteğine
depodaki geçerli bir GLB test varlığı verilir. Filo seçiminde de herhangi bir focus
panelinin açılması yeterli sayılmaz; doğru filonun hedefi ve eskort ayrıntısı aranır.

Review sonrası sonuç: 13 dosyada 100 ilgili test, web tip kontrolü ve değişen kodun
lint kontrolü geçti. 350 ve 1280 px görsel denemelerinde modellerin bağlantı dönüşünde
geri gelmesi, menü kapatılınca her iki filo gövdesinin tekrar çizilmesi ve aynı filonun
seçili kalması doğrulandı. İncelenen değişikliklerde açık doğrulanmış bulgu kalmadı.
