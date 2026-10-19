# Ortak web/native lifecycle ve bağlantı dönüşü — 18 Ekim 2026

> **Sonraki cihaz oturumu:** Aşağıdaki yeni79,7MB APK artık telefona kuruldu ve SHA eşleşti. Fullscreen/IME, kısa background ses/render ve5min lock render pause geçti; güvenli ekran kilidi sahibinin açmasını beklediğinden dönüş ve offline otomatik toparlanma henüz açık. Güncel kanıt [cihaz kabul kaydında](mobile-lifecycle-device-acceptance-2026-10-18.md); aşağıdaki “kurulmadı” ifadeleri build anının tarihsel durumudur.

## Gereksinim ve kapsam

Sahip sıradaki mobil işleri sürdürmemizi istedi. M1'in sonraki işi Android/iOS native activity sinyallerini mevcut görünürlük, oturum/SSE, ses ve sahne davranışlarıyla bütünleştirmek. Web/Android/iOS tek API ve ortak gameplay korunur; yeni push/billing/ads veya progression mekaniği yok. Telefon artık gerekmez; yeni kaynak henüz telefona kurulmuş sayılmaz.

Cihazda gözlenen temel: document.visibilityState Android16 kısa app geçişlerinde çalışıyor; native activity adaptörü henüz yok. Offline cold-start mevcut hata/“Tekrar dene” yüzeyinde kalıyor; kalıcı Keystore/yeniden deneme200 doğru, otomatik UI dönüşü değil. Bu iki durum ayrı aşamalar halinde ele alınır.

## A — Ortak activity kaynağı

- Etkinlik: document görünür **ve** mevcut native App active. Native App bilgisi beklenirken foreground işleri fail-closed; eksik/reject eden plugin DOM fallback ile uygulamayı kilitlemez. Web/PWA native App çağırmaz.
- Aynı olaya ait native ve DOM sinyalleri ikinci resync/medya başlangıcı üretmez. Web'in mevcut visibility event davranışı korunur; browser focus/blur native identity sayılmaz.
- Tek paylaşılan App appStateChange kaydı + getState başlangıç okuması; olay getState sonucundan yeniyse geç eski sonuç uygulanmaz. Son subscriber cleanup ve geç listener handle'ı yalnız kendi kaydını kaldırır; removeAllListeners yok, Android Back kaydı korunur.
- iOS ve Android aynı public App sözleşmesini kullanır. Kaynak token/hesap/oyun verisi taşımaz. App'ten gelen bool Zod sınırında okunur; bozuk/geç callback ile aktif oturum değişmez.
- Mevcut 15s SSE resume eşiği,250ms coalescing ve 5s reconnect jitter korunur. Kısa app switch bütün API'leri yeniden yüklemez; uzun dönüşte mevcut otoriter read set'i tek geçiş yapar.
- Ses, görünür rapor acknowledgements, away/recall timer ve sahne wake consumer'ları aynı foreground bilgisini okur. Browser-only Install/Fullscreen kendi web davranışını korur. TanStack focus durumu aynı kaynağa bağlanır; refetchOnWindowFocus=false kararı değiştirilmez.

Happy/edge: native active/DOM visible kombinasyonları; her iki event sırası; eş olay/aynı state; initial getState gecikmesi/reject; event-before-initial-result; mount/unmount/StrictMode; unsupported platform/eksik plugin; web event davranışı; long/short hide; subscriber temizliği; geç callback; başka native listener'a dokunmama.

Etki: yeni platform activity kaynağı, main query-focus bağlantısı; useEventStream, music/sound, foreground report read, AwayHost/RecallHost ve sahne wake consumer'ları. Gerçek ihtiyaç olmayan gameplay/API refaktörü yapılmaz. Önce mevcut useEventStream native sinyal davranışında gerçek RED; sonra kaynak/consumer adaptasyonu, ilgili regresyonlar ve final geniş web kontrolleri.

## B — Offline cold-start toparlanması (A sonrası)

Yalnız geçici restore/profile bağlantı hatası sonrası online/native foreground dönüşünde güvenli tek restore denemesi; manuel retry korunur. Hesap logout/login değişikliği generation fence'ini geçemez; in-flight restore/online/resume fırtınası paralel restore üretmez. Eğitim/landing veya kalıcı auth hatası kendiliğinden gerçek hesaba geçmez. API'ye gameplay mutation veya sahte çevrimdışı durum gönderilmez. Ayrıntı/RED ayrı not edilecek.

## Araştırma

[Resmî Capacitor8 App](https://capacitorjs.com/docs/apis/app): appStateChange Android onResume/onStop; iOS willResignActive/didBecomeActive; getState mevcut isActive bilgisini verir. pause/resume ayrı olayları aynı anlama gelmez; sadece event sayısını çoğaltmak yerine appStateChange + DOM birleştirilir. App8.1.2 zaten Android Back için kurulu; yeni bağımlılık gerekmez. iOS proje/plugin/cihaz kabulü hâlâ Android yayını sonrasında.

A TDD kayıtları: mevcut useEventStream üzerinde native/DOM sırası **2 gerçek FAIL/2PASS** ile doğrulandı. İlk ortak kaynak +SSE geçişinden sonra3 dosya46PASS. DOM görünür kalırken gerçek music hook'unun pause yapmaması **1FAIL/4PASS**; native background'da gerçek ambient renderer'ın frame istemeye devam etmesi eklenince **2FAIL/4PASS**. Consumer geçişinde native başlangıç bool'u ses efektlerini kullanıcı jesti olmadan açıp indirmeye başlatabildiği için ayrı test **1FAIL/36PASS** verdi; visibility yalnız var olan AudioContext'i resume eder, ilk unlock gerçek jestte kalır. Sekiz ilgili dosya144PASS oldu. Ek shared-source kayıt/aynı callback yaşam döngüsü kenarları2FAIL/14PASS ile gösterildi; kayıt öncesi observer ekleme ve subscriber'a özel callback ile düzeltildi.

Activity bridge ilk state/readiness için3s sınır taşır. Eksik/reject/bozuk veya askıda ilk sonuç DOM fallback'e döner; geç ilk sonuç fallback'i değiştirmez, sonraki geçerli native olaylar yine kullanılabilir. Lifecycle3s sınırı auth HTTP/45s bridge bütçesi değildir. Başka App listener'ı (Android Back) silinmez. Native bool + DOM visibility birlikte kullanılır; cutout/fullscreen ayarı ayrı kalır. Bu kaynaklar henüz yeni APK'da/telefonda denenmedi; telefondaki son paket fullscreen sourceHash eee467… olarak kaldı.

B TDD: mevcut session-machine üzerinde10 yeni vaka ilk koşuda **7 gerçek FAIL/43 PASS** verdi: refresh/me503 sonrası online, foreground, retry single-flight, logout fence, ilk read ile yarışan bağlantı sinyali ve retry-loop sınırı. İlk düzeltme sonrası5 dosya75PASS; offline bilinen ağ durumu, unmount ve StrictMode edge'leriyle11 dosya219PASS. Başlangıçta gerçekten native inactive/DOM hidden olan uygulamanın ilk dönüşü için iki ek test **2FAIL/61PASS** verdi. “Henüz bilinmeyen native state” ile “bilinen inactive” aynı değildir: activity kaynağı readiness bilgisini açar ve ilk geçerli false sonucu da bildirir; ilk true snapshot retry sayılmaz. Son odak5 dosya138PASS.

B uygulaması: cold restore aynı revision'da tek promise paylaşır. Yalnız5xx geçici cold-start hatası otomatik toparlanmaya uygun;401/403/429, logout/login/claim generation değişikliği, eğitim ve diğer kalıcı blocked akışları otomatik auth açmaz. Online/native return sinyalleri mevcut işi join eder; yalnız ilk cold read ile yarışan dönüş için bir taze pass saklanır, tekrar döngüsü kurulmaz. Bilinen offline/arka planda otomatik request yok. Manuel “Tekrar dene” korunur, geç cevap/unmount yeni session state'i kurmaz. Ağ/foreground sinyali yokken sürekli auth polling yok.

Gerçek bootstrap tarayıcı kontrolü: canonical `node tools/visual.mjs out/mobile-lifecycle-2026-10-18/recovery --session-recovery` **8/8 senaryo PASS** (350/1280px ×TR/EN ×429 manuel/503 online-auto).16 PNG üretildi;350px TR hata→server list ve geniş EN429 gözle incelendi. Login/parola istenmedi;503 ağ dönüşünde bir ek refresh,429 için otomatik refresh yok ve mevcut manuel buton çalışıyor. Bu fixture yalnız browser isteklerini yanıtlar; gerçek telefondaki yeni kaynak kabulü değildir. İlk fixture koşusunda mevcut ServersScreen'in auth/security read'i eksikti; test fixture'ına schema ile uyumlu salt okunur cevap eklendi, ürün hatası sayılmadı.

## Final kaynak doğrulaması

Web typecheck, tam web lint grubu, tools/sim lint grubu ve web build **PASS**. Bütün web koşusu **531 dosya PASS /1 dosya skipped;6941 test PASS /29 skipped**,759,99s. Skip'ler çalıştırılmış test sayılmaz. Final activity/consumer/session odak koşusu3 dosya79/79PASS. İlk final lint, async closure/ref değerini await sonrasında değişmez varsayan üç uyarıda durdu; suppress/cast yerine `stillCurrent` ve `initialReadAllowed` getter'larıyla güncel değer yeniden okunur hale getirildi. Ardından odak test, typecheck, lint ve geniş koşu baştan geçti. Son kod incelemesinde ek ürün hatası bulunmadı.

Bu lifecycle kaynak doğrulamasından sonra [native varlık paketlemesi](mobile-asset-packaging-2026-10-18.md) ayrıca ele alındı; geniş6941 koşusu o sonraki paketleme değişikliğini kapsıyor diye sunulmaz. Backend/rules/Java bu lifecycle işinde değişmedi; önceki kontrol kayıtları yeni koşu sayılmaz. Üretime yeni web/backend deploy yapılmadı.

Önceki telefona yüklenmiş fullscreen APK metadata/checksum ile `out/mobile-artifacts/fullscreen-installed-20261018/` altında saklandı. Telefon gerekmez, kullanıcı serbest bıraktı. Sonraki gerçek cihaz kabulü: 30s/5min/uzun background ve lock dönüşü, DOM/native event sırası, müzik/efekt, offline cold-start→mobil veri otomatik dönüşü, SSE tek resync, fullscreen IME/cutout/harici browser dönüşü. Tekrar telefon bağlandığında kurulu hash yeni export ile karşılaştırılarak başlanır. Bu kabul olmadan M1 kapatılmaz; signing/AAB/store kapıları ve Android yayını sonrası iOS ayrı kalır.

## Yeni APK — hazır, henüz telefona kurulmadı

- Dosya: `out/mobile-artifacts/native-production/astera-native-production.apk`; arşiv: `out/mobile-artifacts/lifecycle-built-20261018/`.
- Birleşik lifecycle + varlık temizliği; bundled production **DEBUG**,79.716.619 byte. Gerçek ortak API `https://asteraonline.space`, appId `space.asteraonline.app`, min24/target36. Store-ready değildir.
- SourceHash `241de81b2e54a24d3c4755c70db680415d62a8dc51e0e6d6d1b91938da467bd7`; APK SHA256 `5e914ccda36e7e9dbc0f5b78829a7dd24b51d2cf1d4664c1239060fc0b6b45e8`. Git tabanı f9378f1c + yerel düzeltmeler; kaynak hash'i derleme snapshot'ıdır, sonrasında yalnız sonuç belgeleri güncellendi.
- Temiz Gradle build26s PASS; APK içi metadata/export eşleşmesi, checksum, apksigner verify, modern bridge, App plugin, sabit HTTPS API, server.url yokluğu ve fullscreen SystemBars config PASS. İlk incremental APK'daki boş alan için [paketleme notu](mobile-asset-packaging-2026-10-18.md) okunmalı.
- Korunan575 public runtime dosyası (72.968.771 byte) ZIP'ten açılarak kaynakla byte düzeyinde karşılaştırıldı; ham staging43 dosya kaynakta duruyor, APK'da yok. `.so` sayısı0; ileride eklenecek reklam/billing SDK'sının16KB/ABI kabulü yerine geçmez.
- Web/browser ve native SDK-mock testleri passed; yeni gerçek Android lifecycle/fullscreen matrisi **açık**. Telefonda hâlâ eee467… fullscreen APK bulunur; yeni79,7MB paket kurulmadı. Backend/web deploy yapılmadı.

Makine kaydı ve loglar: `out/mobile-lifecycle-2026-10-18/validation.json` ve `logs/`;8 browser recovery ölçümü/16 PNG `recovery/` altında. Yeni product source değişirse ilgili doğrulamalar yeniden ele alınır; sadece bu raporu hash'e katmak için sonsuz APK rebuild yapılmaz.
