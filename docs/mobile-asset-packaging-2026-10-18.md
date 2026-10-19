# Mobil paket varlıkları — 18 Ekim 2026

## Gereksinim, kanıt ve etki

M1 lifecycle doğrulaması sırasında salt okunur APK envanteri, `assets/public/assets/new_test_ship_modals/` altında43 dosya buldu: ham70.764.291 byte, ZIP içinde70.410.403 byte. Ölçülen paket telefona kurulmuş fullscreen DEBUG sürümü: SHA256 `0d7c4f85cdd191a576361d42097c0d419f7f6fea76e30ca8cc81036e9abe76ee`, toplam152.050.107 byte. Bu boyut AAB/Play indirme boyutu değildir.

`tools/fleet-v2-assets.mjs` bu klasörü sahibin değiştirilmeyen kaynak/staging teslimatı olarak tanımlar; runtime map'te kullanılmadığını açıklar. Repo kaynak aramasında klasörün tek kod kullanıcısı bu offline üretim aracıdır. Oyunun `galaxy/engineAnchors.ts`, model haritası ve gemi kartları işlenmiş `assets/models/ships/` ile `assets/images/ships/` yollarını kullanır. Kaynak dosyalar silinmeyecek/yeniden işlenmeyecek; web public build davranışı değişmeyecek.

Gereksinim: ortak native-local/staging/production build'leri yalnız bu kesin staging klasörünü kopyalamamalı. Diğer model/görsel/ses/ikonlar ve Vite'ın ürettiği JS korunmalı; benzer isimli gerçek varlık klasörleri genel bir `test`/isim regex'iyle atılmamalı. Aynı native Vite plugin'i gelecekte iOS için de kullanılır; Android'e özel ayrı varlık ağacı kurulmaz.

Etki: yalnız `nativeBundlePlugin` public asset kopyalaması ve gerçek Vite build entegrasyon testi. Auth/API/oyun kuralları/varlık üretim kaynakları değişmez. Önce geçici fixture üzerinde gerçek üç native build'inde gereksiz dosyanın halen kopyalandığını gösteren RED; ardından minimal filtre ve GREEN. Kaynak klasörün korunduğu, işlenmiş runtime varlıklarının byte olarak aynı kaldığı ve publisher dosyalarının dışarıda kaldığı da doğrulanacak. Gerçek yeni APK boyutu final export'tan ölçülmeden kazanım tamamlandı sayılmaz.

## Durum

Lifecycle'ın6941 testlik geniş koşusu ve web build'i tamamlandıktan sonra gerçek Vite build fixture'ı üç native hedefte **3 gerçek FAIL** verdi: staging klasörü çıktıdaydı. Kopyalama filtresi yalnız kesin `public/assets/new_test_ship_modals` yolunu dışarıda bırakacak şekilde değiştirildi. Kaynağı silme, model/görsel dönüştürme veya web build davranışını değiştirme yok.

Yeni build fixture'ı üç hedefte GREEN; kaynak dosyaların değişmediği, işlenmiş model/kart/ses/ikon ve benzer adlı başka asset klasörünün byte'ları ile Vite entry JS'in korunduğu doğrulandı. Artifact/CSP/build/config/publisher regresyonlarıyla birlikte **6 dosya43/43PASS**. Son web typecheck ve tam web lint grubu da **PASS**. Signing/AAB/store kabulü bu değişiklikle tamamlanmaz.

## Gerçek APK ölçümü ve incremental paketleme tuzağı

İlk incremental APK'da staging klasörü gerçekten yoktu ve575 korunan runtime dosyası kaynakla eşleşti; buna rağmen dosya150.121.215 byte kaldı. ZIP central directory'deki sıkıştırılmış girişlerin toplamı79.506.447 byte idi. Bu fark veri hâlâ paketlenmiş anlamına gelmiyor. [Android araçlarının Zipflinger tasarım notu](https://android.googlesource.com/platform/tools/base/+/51ca010d6bdf93fd29226aa0ecf161af25fc13bc/zipflinger/README.md), incremental silmelerin central directory'ye girmeyen sanal local header'larla doldurulabildiğini açıklar. Ölçülen fark bu davranışla uyumlu; gerçek boyut karşılaştırması temiz paketle yapıldı.

Yalnız bu workspace'in Gradle build çıktıları `clean` ile kaldırıldı; source/model/varlıklar ve kurulmuş telefon uygulaması etkilenmedi. Aynı sourceHash ile `pnpm android:bundle native-production` tekrar çalıştı: temiz build26s PASS. Son dosya **79.716.619 byte**; önceki fullscreen152.050.107 byte'a göre **72.333.488 byte /yaklaşık%47,6 küçüldü**. APK'nin `.so` sayısı0; bu değer sonraki native SDK'lar eklendiğinde yeniden ölçülmeli.

Final ZIP'te staging0 dosya; kaynakta43 dosya duruyor.575 public runtime dosyasının72.968.771 byte içeriği bire bir doğrulandı; metadata/checksum/modern bridge/API/SystemBars/min24/target36 ve debug imzası geçti. İlk manuel ZIP kontrolündeki kök allowlist'i, Cap sync'in eklediği `cordova.js`/`cordova_plugins.js` dosyalarını hesaba katmadığı için durdu; kontrol öncesi Vite çıktısı ile son APK ayrımı düzeltilip bütün kontrol yeniden geçti. Bu iki platform dosyası publisher dosyası değildir.

**Tekrar üretim:** Büyük varlıklar paketten çıkarıldığında gerçek disk boyutunu değerlendirmek için önce Android klasöründe JDK21, tek worker ve mevcut JVM sınırıyla `./gradlew clean` çalıştır; sonra repo kökünde `VITE_ASTERA_API_URL=https://asteraonline.space pnpm android:bundle native-production`. APK'yi elle zip'leyip yeniden yazma; imzayı bozma. Normal hızlı geliştirme build'leri incremental kalabilir; release/AAB boyutu ayrıca temiz adaydan ölçülür.

Final source/APK SHA ve cihaz sınırları [lifecycle kaydında](mobile-lifecycle-2026-10-18.md). Yeni paket henüz telefona kurulmadı; önceki fullscreen paket arşivi korunur. Production web/backend değişmedi.
