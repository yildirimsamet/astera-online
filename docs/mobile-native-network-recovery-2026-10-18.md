# Native ağ dönüşü — cihaz bulgusu ve düzeltme

## Uygulama / TDD ara kaydı

Resmi SDK8.0.1 kurulum/fixture hazırlığı sonrası mevcut hook testinde DOM online olayı olmadan native bağlantı dönüşü, stale navigator değerleri ve SSE için **4 gerçek FAIL/15PASS** gözlendi. Küçük ortak `platform/network.ts` adaptörü ve session/SSE tüketicileri sonrası4 dosya106PASS. Ardından callback çalışmadan ağ/background durumunun değişmesi ve kısa background sırasında gelen bağlantının kaybolmaması için **3 gerçek FAIL/19PASS** kaydedildi. SSE callback'i çalıştığı anda activity/network'ü yeniden kontrol eder; background bağlantı dönüşü foreground için bir pending bitinde saklanır. Son odak **4 dosya109/109PASS**.

Native bağlantı bool'u biliniyorsa navigator değerinden önceliklidir. Browser-only fallback online event semantiğini korur. Tek shared native listener+getStatus, event revision ve3s ilk-read sınırı, Zod sınırı ve sadece kendi handle cleanup'ı var. Already-online initial snapshot dönüş diye yayınlanmaz. Background/kalıcı auth hatası/kimlik revision fence davranışı korunur. Query onlineManager/global fetch davranışı değiştirilmedi; bu iş için gerekmeyen global retry politikası kurulmadı. Web typecheck/lint/tam test/build kapanışı ve yeni APK gerçek cihaz kabulü tamamlanmadan PASS denmez.

## Gerçek bulgu

18 Ekim lifecycle cihaz kabulünde kurulu `241de81…` /APK SHA `5e914ccd…` paketinde: Wi-Fi1/mobil veri0 başlangıcından ikisi de geçici kapatıldı, app force-stop ve cold-start yapıldı. Bundled hata/“Tekrar dene” yüzeyi doğru açıldı; fakat **navigator.onLine=true** kaldı. Wi-Fi geri açılınca **window.online olayı gelmedi** ve60s içinde hiçbir auth/me isteği/otomatik UI geçişi olmadı. Ağ ayarları finally ile başlangıca döndürüldü. Home'da gerçek inactive süresi bırakılıp yeniden foreground yapıldığında otomatik oturum/oyun döndü; retry/login basılmadı. İlk çok hızlı Home→resume örneği lifecycle transition beklemediği için kabul kanıtı değildir.

Bu cihazda DOM online olayı tek başına ağ dönüş kaynağı olamaz. Önceki browser fixture/test sonuçları geçerlidir ama Android foreground ağ dönüşünü kanıtlamaz. Bu gerçek cihaz RED'idir; yeni düzeltmenin testleri ve APK kabulü ayrıca kapanacak.

## Gereksinim ve etki

Ortak web/Android/iOS frontend ve aynı API korunacak. Native'de resmi Network plugin'in bağlantı bilgisi ve networkStatusChange sinyali, web'de mevcut browser online davranışı kullanılacak. Subscriber yokken native çağrı yapılmayacak; tek paylaşılan listener, kendi handle cleanup, late callback/initial read yarışı ve bozuk sınır değerleri kontrol edilecek. Global removeAllListeners yok. Başlangıç online=true snapshot'ı normalde ikinci auth denemesi sayılmayacak; offline→online dönüşü recovery tetikleyecek. Ağ bilinen offline/arka plandayken auth denemesi yok; online/resume/manual retry fırtınası aynı restore promise'ini paylaşacak.401/403/429 veya kimlik revision değişikliği otomatik login yapmayacak. API polling/timer retry döngüsü veya yeni backend yok.

Happy/edge: Android/iOS gerçek plugin, web/missing/unsupported fallback; offline→online ve duplicate connected callback; stale initial snapshot; pending registration/dispose; reject/bozuk/hung plugin; native offline + navigator true; connection type Wi-Fi↔cellular; background dönüşü; ilk hatayla yarışan online event; logout/unmount; browser regresyonları. Değişecek yerler: küçük platform ağ adaptörü, useSession cold recovery, useEventStream network-return sinyali; gerekirse query onlineManager mevcut browser varsayımı. Ekonomiye/gameplay'e dokunulmaz. Önce gerçek hook üzerinde online DOM olayı olmadan RED; sonra minimal implementasyon ve geniş regresyonlar.

## Kaynaklar ve sürüm

[Capacitor8 Network API](https://capacitorjs.com/docs/apis/network): `getStatus()`, **networkStatusChange** ve subscriber'a ait `remove()` resmi sözleşme. Eski sürümlerdeki event adlarını kopyalama.18 Ekim registry sorgusunda **@capacitor/network8.0.1**, peer core>=8.0.0; kurulu core8.5.3 ile peer uyumlu. Aynı SDK Android ve gelecekteki iOS için kullanılabilir; iOS projesi hâlâ Android yayını sonrasında. Plugin gerçek internet sunucusunun sağlıklı olduğunu garanti etmez; yalnız bağlantı sinyalidir.

Sahibin Play Console paket adı sorusuna mevcut **space.asteraonline.app**, görünen ad **Astera Online** önerildi. Yeni paket adı oluşturulmadı. [Android application ID rehberi](https://developer.android.com/build/configure-app-module#set-application-id), yayın sonrası değişimin farklı uygulama sayıldığını doğruluyor. Bu aşama Console erişimi/yayın işlemi yapmadı.

## SDK kaynak incelemesi / sonraki cihaz turu

Kurulu resmi8.0.1 Android kaynağında `Network.getNetworkStatus()` yalnız `NET_CAPABILITY_VALIDATED` ve `NET_CAPABILITY_INTERNET` birlikteyse connected=true döndürüyor. `onCapabilitiesChanged` üzerinden değişim yayınlanıyor; plugin resume'da monitoring'i yeniden başlatıyor. Bu, yalnız Wi-Fi association'ını internet geri geldi sanmamak için önemlidir; gerçek Astera API sağlığını yine garanti etmez. SDK manifest'i normal `ACCESS_NETWORK_STATE` iznini getiriyor; yeni merged manifest/APK içinde doğrulanacak.

Yeni bağımlılık nedeniyle `cap sync android` generated Gradle dosyalarını değiştirebilir. Fingerprint kontrollü final APK build'inden **önce**, yalnız native-production/API=https://asteraonline.space ortamıyla bir sync yapılmalı; live-reload script'i yanlışlıkla çalıştırılmamalı. Web kaynakları tam test sırasında donduruldu. Son ADB envanterinde telefon yok; yeni APK cihaz kabulü tekrar bağlantı gerektiriyor.

## Geniş web kapanışı

109 odaklı test, web typecheck ve web lint PASS. Tam web: **533 dosya PASS/1skip;6.974 test PASS/29skip**,7003 toplam;764.01s, tek worker. Web production build PASS10.37s; mevcut chunk-size/Three uyarıları hata değildir. Loglar `/tmp/astera-native-network-{final-target,typecheck,lint,web-all,web-build}.log`. Yeni native APK ve gerçek cihaz ağ dönüşü henüz açık.

## Yeni APK — kaynak/paket kabulü

Native-production sync, Android App8.1.2 ve Network8.0.1 pluginlerini kaydetti. Generated Gradle dosyaları final fingerprint öncesi eşitlendi. Son6 dosya75 paket/config/Network testi PASS; üç lint grubunun tamamı PASS; JDK21 clean + Android JVM19/19 PASS. Final bundled build PASS18s (Vite süresi ayrıca logda).

Export `out/mobile-artifacts/native-production/astera-native-production.apk`; arşiv `out/mobile-artifacts/network-built-20261018/`. SourceHash **d5538745b695d5f53960c6e12df90ff112adc105007e9efa26cdf79aa5057731**; APK SHA256 **c6100a08319f98ada9f5ef0274609015cfb1e6e93e34f0b53fa07fa8bac9be75**; **79.722.140 byte**. Git base f9378f1c + yerel değişiklikler. DEBUG/storeReady=false, release variant halen kapalı. min24/target36, HTTPS gerçek API, server.url yok, SystemBars hidden/modern bridge, Network plugin registration + ACCESS_NETWORK_STATE izni ve APK imzası doğrulandı. Embedded ELF0; staging0, kaynak43 staging dosyası korunuyor;575 runtime dosyası72.968.771 byte bire bir eşleşti.

**Bu ara kayıt anında telefona kurulmamıştı; aşağıdaki final fiziksel kabul bu durumu kapatır.** O andaki ADB envanteri boş; sahibine tekrar bağlantı için async soru iletildi. Telefonda son doğrulanan241de81… APK'nın foreground ağ dönüşü FAIL sonucu bu yeni pakete aktarılmaz. Yeni offline cold-start→foreground Wi-Fi/cellular dönüşü, native API/SSE, process restart ve app-scope crash/ANR kabulü açık. Log/inspection/validation `out/mobile-network-2026-10-18/` altında; bu sonuç Play signing/AAB veya mağaza kabulü değildir.

## 18 Ekim final fiziksel ağ kabulü PASS

Yeni d5538745…/c6100a08… DEBUG APK18 Ekim21:30 Istanbul SamsungSM-S901E'ye mevcut oturum korunarak kuruldu. Kaynak release-signing değişikliklerinden önceki qualified artifact'tır; imzalı AAB diye gösterilmez. Aynı process/screen foreground'da offline coldstart→Wi-Fi otomatik oyun/canvas13.619ms; ayrı coldstart→**cellular**13.003ms, plugin connected=true/connectionType=cellular. Retry/refresh/login/Home veya focus müdahalesi yok. Her iki tekrar mevcut Keystore hesabını yeniden açtı; bu turda gerçek DOM online event de geldi, eski failure turunda gelmemişti. Bu yüzden cihaz bu tur tek başına native-event-only nedenselliğini ispatlamaz; o sınır109 hook/adapter testinde ayrıca doğrulanmıştır.

Her iki ağ sonrası native refresh200, auth/me200/sameAccount, gerçek SSE200/connected/no-buffer, clock/date/placement exposed PASS; JS'e refresh secret sızması yok/document cookie yok. Native refresh probe yalnız otomatik UI toparlanması kanıtından **sonra** çalıştırıldı. WiFi1/mobile0 başlangıca döndü, rotation/stay-awake değiştirilmedi,9223forward kaldırıldı, app açık bırakıldı. Process exit kaydı yalnız kontrollü FORCE STOP/isolated cleanup; bu turun crash buffer'ı boş, app ANR/crash gözlenmedi. Uzun soak kabulü yerine geçmez.

Kanıt `out/mobile-network-2026-10-18/device-20261018T1835Z` ve `device-cellular-20261018T1835Z`. İlk CDP screenshot'ta eksik WebGL ve sıkışmış dialog görüldü; hemen sonraki gerçek Android screencap'te3D galaksi/diyalog/fullscreen normaldi ve gözle kontrol edildi. Animasyon/compositing farkı olabilir; kesin neden bu tur belirlenmedi. Tek ara screenshot'a dayanarak yeni renderer bug ilan edilmedi. Eski network FAIL dosyaları korunur. Bu kaynak için network cihaz kapısı kapanır; signing/AAB/policy/iOS kapıları açık.
