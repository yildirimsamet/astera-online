> **18 Ekim son kontrol:** testaccount+adminlesh Silent Space koruması962439cc… ile canlıda doğrulandı;4511 server testi PASS. d5538745… Network DEBUG APK telefona kuruldu; Wi-Fi+cellular otomatik recovery ve native API/SSE PASS. İmzalı AAB77,8MB/bundletool/signature/debuggable=false kabulü ve83 odaklı test PASS; son geniş frontend kontrolü sürüyor. [Güncel durum](mobile-play-upload-status-2026-10-18.md). Alt kayıtlar kronolojiktir.

# Ortak mobil/web temelinin code review kaydı — 18 Ekim 2026

> **Önceki 18 Ekim ara kontrolü (güncel durum üstte):** Kurulu241de81… APK'da fullscreen/IME Back,30s ses/render pause ve uzun kilit dönüşü geçti. Foreground offline cold-start→Wi-Fi otomatik toparlanması **FAIL** bulundu; yeni native Network kodu109 odaklı ve6.974 tam web testini geçti, yeni79,7MB DEBUG APK d5538745… üretildi,75 paket ve19 JVM testi geçti; **telefona kurulmadı**, cihaz kabulü bekliyor. Review hesabı Silent Space muafiyeti yerelde15 yeni+231 regresyon testini geçti, **production'a henüz uygulanmadı**. [Güncel yükleme/yayın eksikleri](mobile-play-upload-status-2026-10-18.md), [ağ](mobile-native-network-recovery-2026-10-18.md), [review hesabı](mobile-store-review-account-2026-10-18.md), [cihaz](mobile-lifecycle-device-acceptance-2026-10-18.md). Signing/AAB/store kabulü açık; iOS Android yayını sonrasında. Alt kayıtlar kronolojiktir.

Kapsam: `b035faaf..f9378f1c` mobil değişikliğinin 86 dosyası ve bu incelemede eklenen beş düzeltme. İnceleme backend, schema/migration, token/CORS/SSE, Android Keystore/bridge/HTTP, ortak Api/media, web servis kapıları, build/artifact/installer ve rollout sözleşmesini kapsar. Android önce, iOS sonra; tek backend/hesap/dünya korunur. Kullanıcı telefon bağlantısını keseceğini bildirdi; yeni fiziksel cihaz kabulü bu incelemenin kapsamı dışında kalır. Kaynak incelemesi/test, gerçek cihaz ve yayın kanıtı ayrı kaydedilir.


**Kapanış kararı:** Ortak React/Three.js istemcisi + platform adaptörleri + tek backend/hesap/dünya temeli **kod ve API sözleşmesi düzeyinde onaylandı**. Android'e özel oyun/API kopyası oluşturulmadı; iOS aynı sözleşmeye Keychain/URLSession adaptörüyle katılacak. Beş bulgunun kaynak düzeltmesi ve otomatik doğrulaması tamamlandı. Bu karar mağaza yayını veya henüz uygulanmamış iOS app onayı değildir; yeni Android APK'nın fiziksel kabulü aşağıda açık.

## Bulgular ve TDD gereksinimleri

| Kimlik | Öncelik | Bulgu | Düzeltme ve kabul |
| --- | --- | --- | --- |
| R1 | P1 | Academy/Rehearsal özel `Api({fetch:...})` örnekleri native build'de varsayılan global AsteraSession transport'unu devralıyor. İzole egzersizin `restore`/`forget`/401 davranışı gerçek Keystore oturumuna erişebilir. | Her iki özel istemci açık `authTransport:null, baseUrl:''`; gerçek component context'inden alınan istemcinin restore/forget ve yerel okuması global native request/clear çağırmamalı. Global canlı Api'nin native auth'u korunmalı. |
| R2 | P1 | Native public HTML çıktısı bilinçli çıkarıldı ama landing/menu publisher bağlantıları ve landing wiki yolu hâlâ göreli. `https://localhost/privacy.html`/wiki dış siteye gitmez. | Native runtime **veya native build** için canonical HTTPS publisher/wiki URL; web göreli yolları, dil ve mevcut inventory/shop kapıları korunur. Backend staging origin'i legal site origin'i yapılmaz. Harici URL native bridge origin allowlist'ine eklenmez; cihaz browser/dönüş kabulü ayrıca açık. |
| R3 | P2 | Android Back IME sonrasında açık chat panelini kapatmadan uygulamayı arka plana atıyor; yalnız dialog aramak focus/hedef listesini de atlıyor. | Modal → popover → focus → root adapter'i, ayrı Back/Close, nested ve busy form testleri. JS kayıt tamamlanmadan OS handler'ı devralınmaz. Yeni APK cihaz testi açık. |
| R4 | P1 | Native auth işi JS45s timeout'undan sonra kuyruktan çıkıp giriş/hesap oluşturabilir. | Monotonic20s queue sınırı, HTTP öncesi503; pending refresh ve logout fence korunur. JVM19 PASS. |
| R5 | P2 | Eski WebView temel CSS/JS özellikleri eksikken ana oyunu açmaya çalışabilir. | Native bootstrap öncesi ES5 capability kontrolü, bağımsız TR/EN yardım sayfası ve artifact gate; birim/tarayıcı/APK kabulü. Fiziksel eski WebView açık. |

Gereksinim/etki: R1 yalnız özel eğitim sandbox istemcileri, R2 publisher URL çözümü ve landing wiki link'i; server/ekonomi/progression değişmez. Happy path: web göreli, Android/iOS mutlak canonical, TR/EN/fallback dil, native bundle normal browser'da da local publisher yolu üretmez; Academy normal/replay ve legacy Rehearsal yerel state'e kalır. Edge: eksik native plugin, native shell ile web/live-reload build, desteklenmeyen runtime, unutulan logout/restore ve hesap değişikliği; canlı oturum tarafı değişmemeli. Önce davranışsal FAIL sonra minimal uygulama, ilgili regresyonlar ve final geniş web koşusu.

## İnceleme notları

- `@capacitor/app`8.1.2 yayın paketinin Android kaynağı API36/min24/Java21 ve AndroidX OnBackPressedDispatcher kullanıyor; onBack callback önce OS IME dispatch'inin sonrasına gelir. WebView `canGoBack` React panel geçmişi değildir. Root minimize yalnız Android. [App API](https://capacitorjs.com/docs/apis/app).
- Capacitor8.5.3 kurulu `Bridge.launchIntent` dış origin'i ACTION_VIEW ile açıyor; `allowNavigation` boş kalmalı. Native app belgesinin origin'ini uzaktaki web sitesi yapmak güvenlik/bağımsız paket sözleşmesini bozar. [Config](https://capacitorjs.com/docs/config).
- Keystore anahtarı export edilmez; şifreleme anahtarını korumak compromised uygulama sürecinin anahtarı kullanmasını bütünüyle önlemez. CSP/ana-frame bridge, secret olmayan access envelope ve no-backup birlikte değerlendirilir. [Keystore](https://developer.android.com/privacy-and-security/keystore), [application/backup](https://developer.android.com/guide/topics/manifest/application-element).
- İki ara geniş web koşusu interruption/yeni kapsam nedeniyle tamamlanmadı; PASS değildir. Son kaynakla tek worker koşusu tamamlandı:6901 PASS/29skip. Durdurulanlar yalnız bu incelemenin runner'larıydı.

### R4 — sıra gecikmesi sonrasında geç kalan native login (P1)

Android plugin'in tek network executor'ında resume/revocation turu üç adet 20 s HTTP çağrısı yapabiliyor. JS bridge süresi45 s; eski login/register/claim görevi daha sonra kuyruktan çıkıp sunucuda hesap/session açabilir ve Keystore'a yazabilir. Bu login UI'da başarısız görünürken sonraki açılışta beklenmedik oturum oluşturur. HTTP callTimeout tek başına executor kuyruk süresini sınırlamaz.

Gereksinim: login/register/claim/refresh ticket'ı native invocation anından itibaren **en fazla20 s kuyruk bekleyebilir**; daha eski görev HTTP'ye başlamadan503 verir. 20 s queue +20 s HTTP,45 s JS sınırının içinde5 s pay bırakır. Eski refresh aktif credential/pending pair'i kaybetmez; logout/clear anlık generation fence'i korur. Önce mevcut motorla20 s üzeri ertelenen login'in hâlâ HTTP yaptığını gösteren davranışsal test; sonra monotonic saatle uygulama ve deterministik sınır/refresh/identity-race regresyonları. İstemci/backend wire protokolü veya iOS transport arayüzüne ek alan gerekmez; iOS implementasyonu da işlem kuyruğuna aynı süre sınırını uygulamalı.

R1/R2 RED: iki dosyada12 gerçek davranışsal FAIL /2 PASS; wiki gerçek landing link'i ayrıca FAIL. Minimal izolasyon/canonical URL düzeltmesinden sonra8 dosya254 PASS. R3 ek bulgu: App plugin varsayılan handler'ı JS listener yokken ve WebView history boşken geri hareketini tüketiyor. Default handler config'te kapatıldı; yalnız JS listener kaydı başarılıysa açılıyor, cleanup kendi handle'ını kaldırıp OS davranışını geri veriyor. RED3 /45PASS →4dosya59PASS; yeni APK cihaz kabulü açık.

## Mimari değerlendirme

| Sınır | İncelenen gerçek uygulama | Değerlendirme |
| --- | --- | --- |
| Hesap ve dünya | `authenticate/registerAccount`, accounts/players/placement, ortak servisler ve DB; native beş route yalnız oturum taşımasını değiştiriyor | Web/Android/iOS için ayrı hesap veya oyun backend'i yok. Üç API replika + tek worker tek mantıksal backend'dir. |
| Ortak frontend | Aynı React/Three.js, `Api`, Zod cevapları ve rules; runtime/capability kapısı yalnız dağıtım/OS servislerini ayırıyor | Üç ayrı ekran/oyun mantığı kopyası oluşturulmadı. Yeni OS servisleri platform adaptörü arkasına eklenebilir. |
| Kimlik taşıma | Web HttpOnly refresh cookie; Android dar Keystore/HTTP plugin + bellekte kısa Bearer; iOS aynı JS plugin sözleşmesi için Keychain implementasyonu bekliyor | iOS'a Android Keystore yolu dayatılmıyor. iOS için **hazır implementasyon/cihaz onayı yok**; backend ve ortak istemci sözleşmesi uygun. |
| İptal ve yarışlar | Native access farklı JWT purpose/sid, DB current/previous hash, aynı-pair retry, account authVersion, per-device logout, SSE heartbeat/fan-out fence | Native logout başka cihazı/web'i kapatmıyor; parola/email güvenlik iptali hepsini kapsıyor. Plaintext uzun credential DB/JS/log'a konulmuyor. |
| CORS/bridge | Tam origin allowlist; credentials:false; clock/placement/Date; SSE hijack header kopyası; modern ana-frame bridge; global fetch/XHR patch yok | CORS platform kimliği veya yetki kontrolü sayılmıyor. Gerçek authorization ortak server guard'ında. Native requestler cookie fallback yapmıyor. |
| Medya | Native Bearer fetch→sınırlı MIME/boyut blob; generation/abort/revoke; video explicit play; web mevcut URL akışı | Kanal/message scope korunuyor. Gerçek Android codec ve içerik matrisi cihaz kabulü olarak açık. |
| Build | Ayrı web/mobile-dist/hedef artifact; HTTPS pin; bundled server.url yok; CSP/hash; source fingerprint/checksum; release kapalı | Vite veya PC'ye bağlı test paketini mağaza release'i diye sunmuyor. App plugin eklenince `cap update android` ile iki **tracked generated** Gradle dosyası da güncellendi; sadece package.json'a eklemek native kaydı sağlamaz. |
| Migration/rollout | Önceki185 journal kaydı byte/JSON içerik olarak değişmemiş;0185 yalnız native_sessions tablosu/indeks/FK ekliyor | Snapshot karşılaştırmasında eski tabloların hiçbiri değişmiyor. Restore provası/rolling/rollback kanıtı yayın kaydında; yeni oyuncu yazıları eski dump restore edilerek silinmez. |

**Sürdürülebilirlik sözleşmesi:** Ortak oyun API'lerine Android/iOS kopyası ekleme. Native app uzun süre güncellenmeyebileceğinden server cevaplarına alan eklemek uyumlu olabilir, mevcut alanın anlamını/türünü kaldırmak veya değiştirmek sessizce yapılmaz; önce eski istemci sözleşmesiyle test edilir. Web, Android ve ileride iOS build'lerinin aynı Git SHA'da olması zorunlu değildir; aynı API sözleşmesiyle çalışmaları zorunludur. Runtime SHA, client Git tabanı, tam source hash ve debug/store kimliği ayrı tutulur. Büyük ortak contract workspace refaktörü, API version URL'si veya ek servis yalnız somut ihtiyaç ortaya çıktığında eklenir.

R4 davranışsal RED doğrulandı: mevcut engine20.1s bekleyen login'i200 ile işledi (10 testin1'i FAIL). Düzeltme ticket'a monotonic queue timestamp ekler;20s ve üstünde HTTP öncesi503. Deterministik clock testleri login/register/claim, pending refresh korunması, sınırın hemen öncesi ve logout generation önceliğini kapsıyor. JVM **19/19 PASS** (engine12 +HTTP6 +template1); mevcut HTTP testleri gerçekten localhost socket üzerinde no-cookie/pinned-operation/redirect reddini de kontrol ediyor. Yeni APK henüz cihazda denenmedi.

## Bilinçli açık kabul ve sonraki işler

Bunlar yukarıdaki foundation düzeltmelerinin tamamlandığı iddiasıyla karıştırılmaz:

- Yeni Android back/queue/link APK'sının gerçek IME, gesture/üç tuş, nested dialog, browser açılışı ve geri dönüşü. Kullanıcı telefonunu ayırıyor; son cihazda test edilen sürüm f9378f1c'dir. Fiziksel USB çıkarma ve hücresel test de açık.
- Native lifecycle adaptörünün mevcut visibility/SSE/ses/render yönetimiyle çift işlem üretmeden bütünleştirilmesi ve uzun arka plan/ekran kilidi/WebGL context recovery matrisi. Mevcut web visibility/online davranışı yeniden yazılmadı; yeni App bağımlılığı tek başına bu işi tamamlamaz.
- iOS native proje, aynı session plugin'in Keychain/URLSession implementasyonu, macOS/Xcode ve iPhone kabulü; Android yayını sonrasında. iOS capability/API sözleşmesi testlidir, iOS app tamamlanmış değildir.
- Signing/App Signing/AAB, gerçek app icon/splash, SDK/16KB/store boyut kabulü, IAP server doğrulama/iadeler, opt-in bildirimler; rewarded/SSV entegrasyonu. Native satış/reklam/bildirim capability'leri entegrasyon olmadan açılmaz.
- Self-service hesap silme/UGC şikâyet/moderasyon ve mağaza privacy/Data Safety beyanları; kişisel Play hesabının closed-test/production erişim koşulu. Bunlar ayrı yayın kapılarıdır.

## Final doğrulama

Tamamlanan kontroller, tek workspace/worker, `nice -n 10`, Node heap≤4096MiB ile:

| Kontrol | Sonuç | Kanıt |
| --- | --- | --- |
| Bütün workspace typecheck | PASS; R5 sonrası web ayrıca tekrar PASS | `typecheck-all`, `web-typecheck-final` |
| Root lint bütün kaynak grupları | PASS; son web + tools/sim grupları R5 sonrası tekrarlandı | `lint-server`, `lint-web-final`, `lint-tools-final` |
| **Son kaynakla tüm web testleri** | **529 dosya PASS/1skip;6901 test PASS/29skip**,740.14s | `web-all-final` |
| Tüm olağan rules testleri |140 dosya,2493 test PASS | `rules` |
| Taze ortak/native backend kontratları |11 dosya,170 test PASS; gerçek bağımsız PostgreSQL fixture | `server-contracts` |
| Önceki tek worker scheduling fixture regresyonu |6/6 PASS; DB/ağ gerektirmeyen izole birim testi | `worker-final` |
| Android JVM, App plugin sync sonrası |3 suite,19/19 PASS;0fail/error/skip | `native-jvm-final` + JUnit XML |
| Son web build |PASS,10.63s; wiki/publisher Node build yolu dahil | `web-build-final` |
| Bundled production DEBUG APK |PASS; source fingerprint, checksum, aapt, ZIP config/registry/CSP/fallback | `apk-build`, artifact `apk-inspection.json` |
| Canonical chat görselleri |6 viewport/dil senaryosu,30 PNG PASS | `out/mobile-review-2026-10-18/chat-media/` |
| Canonical başlangıç koruması |7 senaryo PASS,6 PNG; üç temsilci PNG gözle incelendi | `out/mobile-review-2026-10-18/startup/` |

Log dosyaları `out/mobile-review-2026-10-18/logs/astera-mobile-review-<kanıt>.log` altında saklandı. Yeni kod için davranışsal RED kayıtları da aynı dizinde korunur. Skipped testler başarılı test sayısına eklenmedi. Mevcut Three.js/TanStack fixture uyarıları ve Vite büyük chunk uyarısı süreç hatası değildir; test/build sonuçlarında gizlenmedi.

Backend/rules ürün kaynağı bu review'de değişmedi. Bu incelemenin taze backend sonucu **170+6**'dır; eski genel server koşusu yeniden tamamen yeşil çalıştırılmış gibi sunulmaz. Önceki genel server **4495 PASS/1 FAIL/3skip**, tek eksik maintenance mock'u fixture düzeltmesi ve ayrı6/6 GREEN kaydı [uygulama günlüğünde](mobile-implementation-log-2026-10-17.md) korunur. Buradaki taze scheduling testi de6/6 geçti. Kesilen ara geniş web koşuları PASS sayılmaz; son tamamlanan koşu yukarıdaki6901/29'dur.

Ekonomi/season/snowball simülasyonu çalıştırılmadı. Bu review'de production'a sentetik yazı, yeni deploy veya migration yapılmadı; canlı backend/web f9378f1c olarak kaldı. Yalnız bu incelemenin geçici PostgreSQL container/volume'u temizlendi; diğer yerel DB/dev süreçlerine dokunulmadı.

İlave araştırma: iOS URLSession default/ephemeral cookie ve background redirect farkları, foreground/ThisDeviceOnly Keychain accessibility sınırı resmî Apple belgelerinden doğrulandı; ayrıntı ve kaynaklar [native oturum sözleşmesine](mobile-native-session-2026-10-17.md) işlendi. Henüz iOS plugin'i yazılmadı. Publisher URL kapısının Vite üretim dönüşümünde de korunduğu, gerçek küçük web/native IIFE bundle'ının bridge olmayan VM'de çalıştırılmasıyla **2/2 PASS**; yalnız jsdom env stub'ına dayanılmıyor.

R3 son kapsam kontrolü: focus rail ve galaksi hedef bulucu role=dialog taşımıyor; yalnız dialog arayan adapter bu yüzeyler açıkken root minimize yapabiliyor. Ek gereksinim: modal → geçici hedef listesi → focus context → root sırası. Açık focus dossier önce daralır, kapalı focus sonraki Back'te seçimi temizler; başka modal kapanırken alttaki focus/list korunur. Yüzeyler küçük semantik data marker ve mevcut native-back hook'u ile kayıt edilir; platform adapter'i oyun verisi/attack/selection state'i bilmez. Önce adapter öncelik ve gerçek Focus/GalaxyReadout testleri FAIL, sonra minimal uygulama. Devam eden genel web koşusu bu son kapsam düzeltmesinden önce durduruldu; final kaynak dondurulduktan sonra tekrar çalıştırılır.

R3 role olmayan yüzey düzeltmesi kapandı: adapter context/popover sırası, gerçek PlanetFocus expanded/collapsed davranışı ve gerçek GalaxyReadout listesi başlangıçta üç davranışsal FAIL verdi; ek MonumentFocus fixture'ında eksik ApiProvider ayrıca düzeltildi (bu fixture hatası ürün RED'i sayılmaz). Semantik `data-native-back-layer` ile modal → popover → context → root sırası uygulandı; oyun state'i platform modülüne taşınmadı. Son altı dosya **121/121 PASS**, hook sırası ve mevcut focus/galaksi köşe regresyonları dahil. Bu düzeltmelerden sonraki genel web koşusu da tamamlandı; final sonuçları yukarıdadır.

### R5 — eski WebView/WKWebView için başlangıç koruması (P2)

Kurulu Capacitor8.5.3 Bridge varsayılan Android WebView tabanını60 kabul ediyor; errorPath yoksa düşük sürümde yalnız log yazıp ana belgeyi yine yüklüyor. Oyun Tailwind4/ES2022 kullanıyor. [Resmî Tailwind browser tabanı](https://tailwindcss.com/docs/compatibility) Chrome111/Safari16.4/Firefox128; SDK minimumu oyunun desteklenen render tabanı değildir. Android API24 tek başına WebView sürümünü kanıtlamaz; Huawei sürüm numarasını Chrome numarası gibi karşılaştırmak da doğru değildir.

Gereksinim: native HTML'e ES5 sözdizimli, UA/platform tespiti yapmayan gerçek CSS/JS capability kontrolü ekle (oklch/color-mix, Object.hasOwn/Array.at). Destek yoksa aynı pakette bağımsız başlangıç yardım sayfasına git. Bu sayfa ortak TR/EN metinle Android ve iPhone/iPad güncelleme seçenekleri + canonical iletişim sunar; native bridge/React/Tailwind/API/oturum olmadan çalışır. Ana belge ve fallback CSP'si hash'li script, genel network kapalı; token/hesap/private bilgi yok. Native asset gate fallback dosyasını zorunlu kılar; web/PWA build ve sandbox değişmez. `server.errorPath` aynı dosyayı başlangıç yükleme hatasında da kullanır. iOS yayımlanmadan önce deployment target/browser tabanı en az Safari16.4 ile ayrıca eşleştirilmeli; iOS app desteği verilmiş sayılmaz.

Mutlu yollar: modern özellikler ana oyuna devam eder; eksik/throw eden CSS API veya eksik ES2022 özelliği fallback'e gider; paket dosyası eksikse export reddedilir; TR/EN sayfa kontrolleri küçük/dikey/yatay görünümde erişilir. Etki yalnız native HTML/build/config, yeni statik fallback; ortak oyun/client/backend business logic değişmez. Önce mevcut nativeHtml/config/artifact davranışlarında RED; sonra uygulama, tüm native build regresyonları, gerçek tarayıcı gezinme/CSP/görseller ve APK denetimi. Genel web koşusu bu ek native build düzeltmesinden önce **528 dosya PASS/1skip;6887 PASS/29skip**; backend ortak/native/auth/stream/ratelimit **11 dosya170 PASS** olarak ayrı kaydedilir.

R5 uygulama/TDD sonucu: ilk üç mevcut HTML/config/artifact davranışı **3 FAIL /29 PASS** verdi; minimal koruma + fallback sonrasında yedi ilgili dosya **67 PASS**, eksik CSS.supports ve Array.at edge testleriyle son odak koşusu üç dosya **27 PASS**. Canonical `node tools/visual.mjs out/mobile-review-2026-10-18/startup --native-startup` gerçek native HTML/CSP/assets üzerinde **7/7 senaryo PASS**: TR/EN ×350×812,350×480,1280×812 fallback, ayrıca modern renderer ana bootstrap. Desteklenmeyen CSS sonucu tarayıcıda kontrollü simüle edilir; eski fiziksel WebView testi değildir. Altı PNG üretildi; 350px TR, kısa EN ve geniş TR gözle incelendi. Güncelleme/iletişim eylemleri kaydırmayla erişilir, logo yüklenir, yatay taşma/JS hatası/API çağrısı/oyun bootstrap yok.

18 Ekim review APK derlemesi başarılı: `out/mobile-artifacts/native-production/astera-native-production.apk`,152050107 byte; sourceHash `86257405d2cc79f4a8f5a8604ae5dab5827349335c6b5b300b8389c9613f8d5c`, APK SHA256 `ac319677641bc9a010d9644ab5057e0834090561448da54b5d9314292cb36dde`. Git tabanı `f9378f1c405590942de3c0d7e85c3f7c9d016033` **+ bu incelemenin commit edilmemiş kaynakları**; temiz f937 paketi değildir. Paket içindeki config/registry/HTML/fallback doğrudan ZIP'ten doğrulandı: appId `space.asteraonline.app`, API `https://asteraonline.space`, server.url yok, App plugin kaydı ve başlangıçta kapalı default Back handler, modern bridge ve recovery dosyası mevcut. aapt min24/target36/versionCode1; DEBUG, storeReady=false. Gömülü ELF .so yokluğu yalnız bu pakete aittir; sonraki reklam/billing SDK'larını ve imzalı AAB 16KB kabulünü kapsamaz.

Telefonda doğrulanmış **eski** paket (150126022 byte, sourceHash fb9ca3a…): `out/mobile-artifacts/production-f937-device-qualified-20261018/` altında metadata/checksum ile korundu. Yeni152050107 byte paket telefonda kurulmadı; eski cihaz kabulü yeni kaynaklara taşınmadı. Derleme sonrası yalnız rapor/docs güncellemeleri, build anının sourceHash'ini geriye dönük değiştirmez.

Başlangıç yardımındaki [Türkçe Apple güncelleme bağlantısı](https://support.apple.com/tr-tr/118575) 18 Ekim tarihinde resmî canlı sayfadan ayrıca doğrulandı (iPhone/iPad Yazılım Güncelleme adımları,24 Eylül2026 yayın tarihi). Bu bir başlangıç yardım kaynağıdır; iOS binary/SDK kabul kanıtı değildir.

Kaynak taraması kapanışı: canlı oyun ağ çağrıları ortak `Api` içinden geçiyor; doğrudan fetch kalanları paket içi asset/ses yüklemeleri. Galeri/preview özel istemcileri ayrı HTML girişleridir ve native artifact içine bu girişler konulmaz. Web origin/cookie, native API base URL/Bearer ve SSE aynı istemci yüzeyinde kalır; Android/iOS için gameplay route kopyaları yok.

Fixture temizliği: yalnız bu inceleme için oluşturulan `astera-mobile-review-pg-20261018` (5439) container'ı ve kendi anonymous volume'u `docker rm --force --volumes` ile kaldırıldı.170 server kontrat testi bu fixture üzerinde tamamlanmıştı; son web/JVM kontrolleri DB gerektirmiyor. Sahibin5173 Vite/3100 API süreçleri, diğer yerel DB'ler, stage ve production bu temizlikte değiştirilmedi.
