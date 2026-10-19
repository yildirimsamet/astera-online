> **19 Ekim güncel durum:** Android yeni yayın adayı hazırlanıyor; Console’a yükleme yapılmadı. Hesap silme (uygulama/admin/dış URL/restore journal),30gün yedek politikası ve yeni şikâyet/moderasyon akışı yerelde uygulandı. Şikâyet60 ve hesap silme52 gerçekbrowser görünümü geçti; UGCkalıcıengelleme/kuralkabulü ve son yayın kabulü açık. Önceki AAB yeni kaynakları içermez. Güncel kapılar: [19Ekim yayın durumu](mobile-play-readiness-2026-10-19.md), [silme](mobile-account-deletion-2026-10-19.md), [UGC](mobile-ugc-2026-10-19.md). Alt kayıtlar tarihlerindeki durumu anlatır.

> **18 Ekim son kontrol:** testaccount+adminlesh Silent Space koruması962439cc… ile canlıda doğrulandı;4511 server testi PASS. d5538745… Network DEBUG APK telefona kuruldu; Wi-Fi+cellular otomatik recovery ve native API/SSE PASS. İmzalı AAB77,8MB/bundletool/signature/debuggable=false kabulü ve83 odaklı test PASS; son geniş frontend kontrolü sürüyor. [Güncel durum](mobile-play-upload-status-2026-10-18.md). Alt kayıtlar kronolojiktir.

# Astera Online — web, Android ve iOS ayrımı ve mağazaya çıkış planı

> **Önceki 18 Ekim ara kontrolü (güncel durum üstte):** Kurulu241de81… APK'da fullscreen/IME Back,30s ses/render pause ve uzun kilit dönüşü geçti. Foreground offline cold-start→Wi-Fi otomatik toparlanması **FAIL** bulundu; yeni native Network kodu109 odaklı ve6.974 tam web testini geçti, yeni79,7MB DEBUG APK d5538745… üretildi,75 paket ve19 JVM testi geçti; **telefona kurulmadı**, cihaz kabulü bekliyor. Review hesabı Silent Space muafiyeti yerelde15 yeni+231 regresyon testini geçti, **production'a henüz uygulanmadı**. [Güncel yükleme/yayın eksikleri](mobile-play-upload-status-2026-10-18.md), [ağ](mobile-native-network-recovery-2026-10-18.md), [review hesabı](mobile-store-review-account-2026-10-18.md), [cihaz](mobile-lifecycle-device-acceptance-2026-10-18.md). Signing/AAB/store kabulü açık; iOS Android yayını sonrasında. Alt kayıtlar kronolojiktir.

Tarih: **16 Ekim 2026**. Durum: **uygulama başladı; mağaza kabulü tamamlanmadı**. Gerçek uygulama/test/cihaz ilerlemesi [17 Ekim geliştirme günlüğünde](mobile-implementation-log-2026-10-17.md) tutulur. Kaynak kod ve testler mevcut durumun asıl kanıtıdır; mağaza kuralları gönderim gününde tekrar kontrol edilir.

**Review revizyonu: 16 Ekim 2026.** Bölüm 10, incelemede bulunan yanlış/eksik varsayımları ve düzeltme kanıtlarını kaydeder. “Doğrulandı” kaynak/politika veya kod incelemesini anlatır; cihazda henüz uygulanmamış entegrasyon için başarı iddiası değildir. Aşağıdaki mimari seçimler proje önerisidir; mağazanın zorunlu tuttuğu teknoloji tercihleri değildir.

## 18 Ekim — canlı API hazırlığı tamamlandı, cihaz/mağaza kabulü açık

Production backend/web **`f9378f1c405590942de3c0d7e85c3f7c9d016033`** sürümünde: üç API + worker sağlıklı, journal186, native auth açık. Aynı SHA'dan gerçek API adresli bundled production **DEBUG** APK Samsung SM-S901E'ye kuruldu; API `https://asteraonline.space`. Sahibi mevcut hesabıyla giriş yaptı: USB reverse olmadan gerçek Java HTTPS refresh200, ortak API200, SSE200/connected, otomatik kill/relaunch ve offline kill→Wi-Fi dönüşü geçti. IME ilk geriyle doğru kapanıyor; ikinci geri panel yerine uygulamayı arka plana attığından navigation düzeltmesi yeni yerel APK'da uygulandı; yeni paketin cihaz kabulü açık. Yerel `.local` cihaz oturum/Keystore/offline kabulü geçti; production fiziksel kablosuz/mobil veri matrisi açık. **M1 ve Google Play yayını tamamlanmadı.** Back/lifecycle/IME/safe-area/link ve medya cihaz matrisi, signing/AAB, privacy/UGC/silme, Console ve closed test kapıları açık; iOS yayını Android'den sonra. Ayrıntı [yayın kaydında](mobile-backend-rollout-2026-10-17.md) ve [cihaz komutlarında](android-local-test.md).

**18 Ekim review:** Ortak temel ve henüz cihazda denenmeyen yerel navigation/queue/link/eğitim izolasyonu ve eski renderer başlangıç koruması düzeltmeleri [code review kaydındadır](mobile-code-review-2026-10-18.md). Android release önceliği ve sonrasında iOS sırası korunur.

## 17 Ekim 2026 — güncel durum ve sahibin yayın sırası

Bu bölümün tablosu **geliştirme başlamadan önceki başlangıç incelemesidir**; güncel uygulama durumu için [geliştirme günlüğüne](mobile-implementation-log-2026-10-17.md) bak. İncelenen kaynak: `b035faaf9c333b693185d549320c156fa01b18f8`; inceleme başlangıcında çalışma ağacı temizdi. Platform kapıları, native oturum altyapısı ve ilk bundled local APK sonradan eklendi; bunlar HTTPS/M1 veya mağaza kabulünün tamamlandığını göstermez.

**Sahibin netleştirdiği hedef:** Web, Android app ve iOS app aynı backend'i, Astera hesabını ve oyun dünyasını kullanacak. Ortak React/Three.js istemcisi korunacak; platform adaptörleri oturum, lifecycle, gezinme, ödeme, bildirim ve reklam sınırlarında olacak. **Önce Android yayını tamamlanacak, sonra iOS uygulama/yayın aşamasına geçilecek.** iOS sözleşmeleri baştan tasarlanacak; Android yayını iOS cihaz kabulünü beklemeyecek. Google Play Console hesabı mevcut. **17 Ekim sahibin yanıtı:** kişisel hesap, yaklaşık bir yıl önce açılmış; kesin açılış tarihi ve bu uygulamanın Console production erişim durumu henüz görülmedi.

**Takvim bağımlılığı:** Bu yanıta göre hesap 13 Kasım 2023 sonrasına denk geliyor. Güncel resmî kural, uygulama için en az **12 testçinin kesintisiz 14 gün opt-in olduğu closed test**, ardından production erişim başvurusu gerektiriyor. Hesabın bir yıllık olması test süresi yerine geçmez; internal track bu şartı karşılamaz. 14 günün bitmesi otomatik yayın onayı değildir; Console'daki uygulama durumu ve inceleme ayrıca doğrulanır. Test sürümü kararlı ve closed test kurulum şartları tamam olduğunda süreyi başlat; gerçek kullanım/geri bildirim ve yapılan düzeltmeleri kaydet. Kullanıcı/testçi daveti kendiliğinden gönderilmez. [17 Ekim tekrar doğrulanan Google kaynağı](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en).

| Alan | 17 Ekim kod/yerel kontrol sonucu | İlk yapılacak |
| --- | --- | --- |
| Android | Capacitor 8.5.3 mevcut; yalnız `.debug`, `server.url=http://localhost:5173`, `webDir=mobile-dev`; Gradle release variant kapalı | Mevcut yerel denemeyi koruyup ayrı bundled build ekle |
| Platform ayrımı | `src/platform/` yok; uygulama kaynaklarında native runtime kapısı yok | 02 + 05: web/PWA/Android/iOS capability testleri ve native yüzey ayrımı |
| Web servisleri | `main.tsx` web analytics/H5 başlangıcını ve InstallProvider'ı kullanıyor; Vite her build'e AdSense ekliyor; SkinsScreen web satış hook'larını çağırıyor | Native'de CTA ile birlikte hook/SDK/tag başlangıcını kapat; envanter/equip'i koru |
| Paket ağı | `new Api()` boş base URL kullanıyor; auth/SSE same-origin; native CORS/session bridge henüz yok | 03–04: HTTPS API, sınırlı CORS, native güvenli oturum ve Bearer SSE |
| Hesap kurtarma | `routes/accountSecurity.ts`, email reset/bind/change ve UI eklenmiş | Yeniden geliştirme; native mail-app dönüşü ve gerçek queued mail/webhook kabulünü tamamla |
| Oturum iptali | `authVersion`, DB'den token sürüm doğrulaması, açık SSE'de event/heartbeat iptali mevcut | Mevcut güvenlik sözleşmesini native session rotation/revocation ile bütünleştir; normal logout hâlâ yalnız web cookie'sini temizliyor |
| Hesap silme / UGC | Silme operatör servisi; self-service silme talebi yok. DM block var; incelenen chat/DM/community/clan route'larında oyuncu şikâyet akışı bulunmadı | 14–15 yayın engelleri olarak açık |
| IAP / yerel bildirim / native reklam | İlgili plugin ve backend entegrasyonları yok | M1 sonrası store ödeme + 13A; rewarded ads aşağıdaki ayrı kapsam |
| Paket boyutu | `du -sh`: public 139 MiB, mevcut dist 153 MiB, debug APK 4,2 MiB | Bunlar taze bundled/AAB indirme ölçümü değil; 03/18'de gerçek artifact'i ölç |
| Cihaz | Bu incelemede `adb devices -l` boş | Önceki Samsung denemesi tarihsel kanıt; yeni native cihaz testi yapılmadı |
| Backend yayını | Runbook'un tarihsel canlı kontrolü 0152 / o günkü yerel 0180; güncel yerel journal artık 0184'e kadar. Bu incelemede canlı sunucu yeniden sorgulanmadı | Ortak backend'in mobil/API ve migration uyumluluğunu dağıtım adımında doğrula; yereldeki özellikleri canlıda hazır varsayma |

**İlk geliştirme paketi:** 02 platform sözleşmesi + 05 native PWA/fullscreen/web checkout kapıları + 09 web reklam/analytics başlangıç kapıları. Önce FAIL testleri; sonra uygulama, web/PWA regresyonları ve görsel kontrol. Web, Android ve iOS aynı sınırın test matrisinde yer alacak. Henüz kullanılmayan IAP/ads/push plugin'lerini ilk pakete ekleme.

**İlk cihaz teslimatı (M1):** 03–04 ile dosyaları içinde taşıyan APK, mevcut backend koduna HTTPS üzerinden API/SSE erişimi ve kill/relaunch sonrasında güvenli oturum. Ardından 06–08'in geri/klavye/safe-area/lifecycle/link kabulü. USB/Vite kapalıyken Wi-Fi ve mobil veriyle oynanabilmeli. Ayrı test ortamı kullanılırsa aynı backend kodunun izole verili dağıtımıdır; platform başına ayrı backend veya hesap sistemi değildir.

**17 Ekim uygulama ilerlemesi:** Ortak platform/web servis kapıları ve dosyaları taşıyan ayrı `.local` APK eklendi. Yerel aynı backend'de Android Academy claim, Bearer API/SSE, Keystore kalıcılığı, process kill/relaunch, offline refresh/çıkış ve bağlantı dönünce server revocation gerçek cihazda kanıtlandı. Modern bridge/iframe ve vault instrumentation 3/3 PASS. **M1 henüz tamamlanmadı:** uzak HTTPS backend dağıtımı ve proxy kabulü, USB'siz Wi-Fi/mobil veri, native yaşam döngüsü/geri/klavye/safe-area/link matrisi ve medya cihaz kabulü açık. 02/05/09'un web kapıları uygulanmış olması 09'un tüm privacy/store beyanlarını tamamlamaz. Signing/IAP/bildirim/hesap silme/UGC/yayın test aşamaları açık; iOS projesi henüz oluşturulmadı. Kanıtlar ve kontrol sonuçları [geliştirme günlüğünde](mobile-implementation-log-2026-10-17.md).

**Rewarded ads için güncel araştırma:** Capacitor bunu engellemiyor. Topluluk tarafından sağlanan `@capacitor-community/admob` Android/iOS rewarded reklam ve SSV seçeneklerini belgeliyor; 17 Ekim registry sorgusunda sürüm `8.2.1`, proje README'sinde Capacitor 8.5+ desteği görülüyor. Bu araştırma plugin'in bu repoda build/cihaz testini geçtiği anlamına gelmez. Ortak platform sınırına gerektiğinde `ads` adaptörü ve native rewarded capability eklenebilir; ilk bağımsız APK reklamsız kalır. Sonraki entegrasyon: test reklamları, UMP/consent, reklam açılırken ses/render yönetimi, kapanınca güvenilir dönüş, backend'de doğrulanan SSV ve transaction başına tek ödül. Reklam gösterilememe/erken kapatma/hesap değişimi/gecikmiş callback testleri gerekir. Ödül türü ve miktarı ayrıca owner'ın oyun dengesi kararıdır; mevcut web H5 konfigürasyonu native AdMob entegrasyonu sayılmaz. [Plugin kaynağı](https://github.com/capacitor-community/admob), [Google rewarded](https://developers.google.com/admob/android/rewarded), [SSV](https://developers.google.com/admob/android/ssv), [UMP](https://developers.google.com/admob/android/privacy), [ödül kuralları](https://support.google.com/admob/answer/7313578?hl=en).

**17 Ekim resmî kaynak kontrolü:** Yeni Android gönderimleri API 36+ hedefliyor; projedeki target 36 uygun başlangıç. Billing entegrasyonunda normal gönderim için desteklenen 8+ sürüm seçilecek; 7 uzatmasına dayanılmayacak. Yeni kişisel hesaplarda 12 kişinin kesintisiz 14 gün closed test katılımı ve sonrasında production erişim başvurusu şartı sürüyor; mevcut hesabın kapsamını Console'dan doğrula. SystemBars #8530 hâlâ açık; paketlenmiş build'de tekrar üretmeden çözülmüş sayma. Capacitor 8.5 iOS UIScene lifecycle kullanıyor; iOS aşamasında eski AppDelegate varsayımlarını kopyalama. Local Notifications güncel dokümanı 8.3+ için `schedule()` çağrısında otomatik izin istemeyi ve varsayılan exact alarm davranışını açıklıyor: 13A'da seçilen exact plugin sürümünü denetle, yalnız kullanıcı opt-in'i sonrasında zamanla ve destekleniyorsa `isExactNotification: false` seç; istemsiz sistem izin/ayar ekranı açılmasın. [Target API](https://developer.android.com/google/play/requirements/target-sdk), [Billing takvimi](https://developer.android.com/google/play/billing/deprecation-faq), [kişisel hesap testi](https://support.google.com/googleplay/android-developer/answer/14151465), [SystemBars kaydı](https://github.com/ionic-team/capacitor/issues/8530), [Capacitor 8.5](https://capacitorjs.com/docs/updating/8-5), [yerel bildirim API](https://capacitorjs.com/docs/apis/local-notifications).

Doğrulama: Mevcut mobil wrapper testleri yeniden çalıştırıldı: **2 dosya / 19 test PASS**. İstemci oturum/API/SSE/hesap güvenliği regresyonları: **4 dosya / 127 test PASS**. Sunucu auth/email-recovery/account-security/stream-frames: temiz, izole ve koşu sonunda kaldırılan test DB'sinde **4 dosya / 78 test PASS**. Kontroller sırayla, nice=10, tek Vitest worker ve en fazla 4 GiB Node heap ile yapıldı. Bu inceleme ürün kodu değiştirmedi; taze APK/AAB, yeni cihaz testi veya tam `pnpm verify` sonucu sunmaz.

Ek yerel ortam bulgusu: İlk sunucu koşusu mevcut `astera_test` üzerinde migration hazırlığında **67 FAIL / 11 PASS** verdi; auth davranışı değerlendirilmeden `0183` zaten var olan kolonu tekrar eklemeye çalıştı. DB journal'ındaki son iki SQL hash'i güncel `0183`/`0184` dosyalarıyla eşleşiyor, fakat kayıtlı timestamp'ler güncel `_journal.json` ile farklı; migrator uygulanan SQL'i yeniden bekleyen sanıyor. Ortak test DB'sinin verisi/schema/journal'ı elle değiştirilmedi. Temiz DB koşusu migration zinciri ve seçili sunucu testlerinin geçtiğini ayırıyor; mevcut ortak test ortamının metadata uyumsuzluğu ayrıca giderilmeli. Production için aynı durum olduğu iddia edilmiyor.

## 1. Görev, kapsam ve başlangıç noktası

Astera Online, mevcut React/Vite/Three.js istemcisi ve Fastify/PostgreSQL backend'i olan çevrimiçi, kalıcı multiplayer uzay oyunudur. Kullanıcı aynı oyunu web, Google Play ve App Store üzerinden sunmak istiyor. Unity, Flutter veya React Native ile oyun yeniden yazılmayacak. Web istemcisi Capacitor ile paketlenecek; yalnız işletim sistemi, dağıtım ve ödeme sınırlarında adaptör kullanılacak.

Kullanıcının önceliği **bug, hata, tıklama, klavye ve güvenilir çalışma**. Web'de de görülen FPS dalgalanmaları ayrı optimizasyon işi; uygulamaya özgü donma, çökme, WebGL kaybı veya arka planda aşırı kaynak tüketimi yine bu planın kapsamındadır. Mevcut yerel, commit edilmemiş değişiklikler dahil edilecek; eski commit'ten temiz bir kopya üretip kullanıcının değişikliklerini atlamak yasak.

Yeni agent önce şunları okusun:

1. [CLAUDE.md](../CLAUDE.md): TDD, çalışma disiplini ve ürün sınırları.
2. Bu dosya: mağazaya çıkış için ana yürütme sırası.
3. [Yerel Android denemesi](android-local-test.md) ve [denemenin kanıtları](mobile-debug-implementation-2026-10-16.md).
4. [İlk mimari araştırma](mobile-wrapper-plan-2026-10-16.md): tarihsel başlangıç planı; oradaki “Capacitor yok / SDK kurulmalı” ifadeleri ilk denemeden öncedir.
5. Dokunacağı konuya göre [mimari](architecture.md), [deploy](deployment.md), [mühendislik](engineering-standards.md), [arayüz](interface.md), [UX yazımı](ux-writing.md). CLAUDE.md'nin andığı `docs/decisions.md` bu çalışma ağacında bulunamadı; karar geçmişi için ilgili konu belgesi, kod/test ve git geçmişini kullan, olmayan dosyadan karar varsayma.

**Bu görev yalnız plan belgesi üretir.** Aşağıdaki geliştirmeleri, ücretli servis kayıtlarını, mağaza ürünlerini veya yayını kendiliğinden tamamlanmış sayma. Kimlik, PvP, sezon, sahiplik ve progression değişiklikleri CLAUDE.md'deki ürün karar sınırlarına tabidir.

### Bugün gerçekten var olanlar

| Alan | Koddan/önceki cihaz denemesinden doğrulanan durum | Sonuç |
| --- | --- | --- |
| Android kabuğu | Capacitor core/CLI/Android 8.5.3; `apps/web/android` var | Yeniden proje oluşturma |
| Şimdiki APK | `space.asteraonline.app.debug`, görünen ad `Astera Local`; yaklaşık 4,2 MB | Bu boyut oyunun paketlenmiş boyutu değildir |
| İçerik kaynağı | `server.url=http://localhost:5173`, `webDir=mobile-dev`; USB reverse üzerinden Vite | Bilgisayardan bağımsız release değildir; kaynak değişiklikleri canlı gelir |
| Release koruması | `ASTERA_MOBILE_DEBUG=1` zorunlu; Gradle release variant kapalı | Koruma yeni release pipeline doğrulanmadan kaldırılmaz |
| Android SDK | minSdk 24, compile/target 36; JDK 21 ile debug build alındı | SDK kurulumu tamam; store kabulü ayrıca doğrulanacak |
| Cihaz | Samsung SM-S901E, Android 16; açılış/giriş alanı/klavye/geri ile klavye kapatma denendi | Diğer cihazlar ve iOS için kanıt sayılmaz |
| Bilinen hata | Başlangıçta safe-area CSS yazımı sırasında Capacitor hatası görüldü; sonra inset'ler oluştu | Release öncesi yeniden üret, sürüm/fix doğrula; “önemsiz” diyerek kapatma |
| Test kanıtı | Wrapper'a özel 19 test PASS; önceki notta geniş lint/test kapanışı henüz tamamlanmamış | Tüm repo yeşil diye raporlama |
| iOS | Bu çalışmada iOS native proje/build/cihaz testi yapılmadı | macOS/Xcode ve iPhone aşaması açık |
| Push / store IAP | Üretim entegrasyonu bu wrapper çalışmasında eklenmedi | Firebase veya IAP hazır varsayma |
| Paket boyutu | Mevcut `public` yaklaşık 139 MB, mevcut `dist` yaklaşık 142 MB | Eski dist olabilir; AAB indirme boyutu değildir, yeni build ölçülecek |

## 2. Hedef mimari ve değişmeyecek sınırlar

```text
Ortak React / Three.js ekranları + ortak oyun kuralları
                         |
                Platform adaptörleri
             /            |             \
       Web / PWA     Android Capacitor   iOS Capacitor
       web ödeme      Google Play IAP    Apple StoreKit IAP
                         |
             Aynı HTTPS API + Bearer SSE
                         |
       Aynı Astera hesabı, galaksi ve kozmetik sahipliği
```

- Backend, veritabanı ve worker telefona taşınmaz. Oyun internet ister. İnternetsiz açılış anlaşılır bir bağlantı ekranı gösterir; eski dünya görüntüsünü canlıymış gibi sunmaz.
- Paketlenmiş uygulama HTML/JS/CSS ve gerekli başlangıç varlıklarını kendi içinde taşır. Release'te `server.url` ile canlı web sitesini yüklemek bu planın dağıtım modeli değildir. Capacitor bu alanı geliştirme/live reload için belgeliyor. [Capacitor yapılandırması](https://capacitorjs.com/docs/config)
- Web deploy'u ile mağaza binary'si ayrı sürümlenir. Backend eski mobil sürümlere de hizmet eder; web ve app'in aynı gün güncellenmesi beklenmez.
- Tek hesap ve tek entitlement kaynağı backend'dir. Web'de alınan kozmetik ile mağazada alınan aynı kozmetik farklı oyun eşyaları olmaz. Mağaza SKU'su ile oyun item ID'si ayrı kavramlardır.
- CSS breakpoint, user-agent, `display-mode: standalone` veya ekran genişliği native platform tespiti değildir. PWA, ödeme açısından web olarak kalır.
- UI'daki platform koşulu güvenlik sınırı değildir. Sunucu kimliği, sahipliği ve satın alımı ayrıca doğrular; `X-Platform: ios` gibi bir header tek başına güvenilir olmaz.

### Önerilen kod sınırları — henüz oluşturulmadı

`apps/web/src/platform/` altında küçük adaptörler oluştur: `runtime`, `capabilities`, `authTransport`, `lifecycle`, `navigation`, `billing`, `localNotifications`, `push`, `externalLinks`. Başlangıçta tek ihtiyaç için geniş framework kurma; ortak oyun ekranlarını üç kopyaya ayırma.

Runtime kimliği `Capacitor.isNativePlatform()` ve `Capacitor.getPlatform()` ile belirlenir. Build hedefi ayrıca doğrulanır: `web`, `native-local`, `native-staging`, `native-production`. Native build'in yanlışlıkla normal tarayıcıda açılması store satışını etkinleştirmemeli. Her adaptörün browser-safe karşılığı ve testte enjekte edilebilir arayüzü olmalı; modül import edilir edilmez izin penceresi veya native çağrı başlamamalı.

Mevcut live-reload APK bir istisnadır: normal Vite kaynağı native runtime içinde çalışır. Bu durumda runtime native ise PWA/fullscreen/web checkout her zaman kapalıdır; web build etiketi bunları yeniden açamaz. Store billing ancak hem native runtime hem açıkça izinli build/ortam hem de hazır store servisi varsa açılır. “Build ve runtime uyuşmuyor” durumunda tüm uygulamayı bozmak yerine bu hassas yetenekleri kapat; debug uyarısını geliştirici loguna yaz.

Capability tablosunda en az şu ayrımlar tanımlanır: PWA kurulum önerisi, browser fullscreen, native lifecycle, store billing, native push, web ads, dış bağlantı açıcı. Platforma ilişkin koşullar ekranların içine dağılmak yerine bu sözleşmeden türetilir. Native plugin'in bulunmaması, uyumsuz sürüm veya store servisinin kullanılamaması ayrı durum olarak ele alınır.

## 3. Web / PWA / Android / iOS davranış matrisi

Bu tablo uygulama ve test sözleşmesidir. “Gizle” yalnız CSS ile görünmez yapmak değildir: ilgili CTA render edilmez, gereksiz dinleyici/istek/SDK başlatılmaz.

| Yüzey | Web tarayıcı | Kurulmuş PWA | Android app | iOS app |
| --- | --- | --- | --- | --- |
| Ana ekrana ekle / kurulum rehberi | Mevcut destek/kurulum durumuna göre | Kurulu olduğu için önerme | **Hiç gösterme** | **Hiç gösterme** |
| Tam ekran ikonu | Tarayıcı API desteğine göre mevcut davranış | Mevcut app-mode davranışını koru | **Hiç gösterme**; ekranı native kabuk yönetir | **Hiç gösterme**; ekranı native kabuk yönetir |
| Safari/Chrome menüsünden kurulum açıklaması | İlgili tarayıcıda | Gerekmiyor | Yok | Yok |
| Web mağaza CTA'sı | Etkin mevcut Shopier/Polar akışı | Web ile aynı | Store ürünleri ve Google satın alma ekranı | Store ürünleri ve Apple satın alma ekranı |
| Shopier kodu/kopyala/ödeme sayfası | Mevcut kurallar | Web ile aynı | Yok | Yok |
| Web fiyatları / “web'den satın al” metni | Mevcut kurallar | Web ile aynı | İlk global sürümde yok | İlk global sürümde yok |
| Kozmetik envanter/equip/deneme | Ortak backend sahipliği | Aynı | Aynı; desteklenen katalog | Aynı; desteklenen katalog |
| Satın alımları geri yükle | Backend hesabı üzerinden sahiplik | Aynı | Store restore + backend doğrulama | Store restore + backend doğrulama |
| Reklam scriptleri | Mevcut web politikasına göre | Web ile aynı | İlk sürümde kapalı | İlk sürümde kapalı |
| Bildirim izinleri | Ayrı web push işi varsa tarayıcı izni | Ayrı web push işi | İlk aşama OS izni + yerel zamanlama; sonraki push aşamasında FCM | İlk aşama OS izni + yerel zamanlama; sonraki push aşamasında APNs |
| Üretim hatırlatması | Native zamanlama uygulanmaz | Native zamanlama uygulanmaz | `@capacitor/local-notifications` | `@capacitor/local-notifications` |
| Oyun içi Signals/bildirim kutusu | Ortak | Ortak | Ortak; push bunun yerine geçmez | Ortak |
| Geri davranışı | Mevcut ekran/history davranışı | Aynı | Klavye → üst overlay → panel → OS | Ekran içi geri/kapat; OS gesture ile uyum |
| Dış link | Güvenli web linki | Güvenli web linki | Sistem tarayıcısı veya Browser adaptörü | Sistem tarayıcısı veya Browser adaptörü |
| Hukuki/destek sayfaları | Web sayfaları | Aynı | Mobil uyumlu, ödeme yönlendirmesi içermeyen sayfalar | Aynı |
| Hesap silme | Ortak self-service talep akışı eklenecek | Aynı | Ayarlardan erişilir | Ayarlardan erişilir |
| Hata/bağlantı durumu | Mevcut + ortak iyileştirme | Aynı | Native ağ/lifecycle ile tamamlanır | Aynı |
| Sürüm bilgisi | Web build kimliği | Web build kimliği | App sürümü + build numarası | App sürümü + build numarası |
| Store güncellemesi | Web deploy | PWA cache davranışına göre | Mağaza üzerinden | Mağaza üzerinden |
| Açılış | Mevcut landing/oturum akışı | Mevcut akış | Kısa splash → mevcut oturum veya giriş/eğitim | Aynı |
| Ses/haptics/paylaş/kopyala | Feature detection ile web | Aynı | Gerektiğinde native adaptör | Gerektiğinde native adaptör |

**Ödeme politikası varsayımı:** İlk global sürüm standart Play Billing ve Apple IAP kullanacak. Ülkeye/mağaza bölgesine özgü harici ödeme programları vardır; bunları “her yerde yasak” diye tanımlama, fakat program kaydı ve ayrı uygulama gerektiren istisnaları ilk sürümün içine sokma. Kullanıcının seçtiği bayrak/dil veya IP tek başına mağaza bölgesi değildir. [Google ödeme açıklaması](https://support.google.com/googleplay/android-developer/answer/10281818?hl=en), [Apple 3.1](https://developer.apple.com/app-store/review/guidelines/#in-app-purchase)

## 4. Kod haritası: nerelere bakılacak?

Tüm yollar repo köküne göredir. “Yeni” olarak belirtilenlerin dışında aşağıdaki dosyalar bu incelemede görüldü.

| İş | Mevcut kaynaklar | Beklenen müdahale |
| --- | --- | --- |
| Build ayrımı | `apps/web/capacitor.config.ts`, `apps/web/vite.config.ts`, kök ve web `package.json`, `apps/web/android/` | Debug/staging/release hedefleri; bundled çıktı; güvenlik doğrulaması |
| Başlangıç | `apps/web/src/main.tsx`, `App.tsx` | Runtime kurulumu, native adaptörlerin tek sefer başlatılması |
| PWA kurulum | `src/brand/Install.tsx`, `installedPwa.ts`, `installProfile.ts`, `RecallHost.tsx` | Native için kurulum UI ve rehberini tamamen dışarıda bırak |
| Fullscreen | `src/brand/FullscreenButton.tsx`, `Identity.tsx` | Native render ve event listener kapısı |
| Menü/mağaza girişleri | `src/shell/MenuPanel.tsx`, `ShopShowcase.tsx`, `src/screens/SkinsScreen.tsx` | Ortak envanter ile platform satış sağlayıcısını ayır |
| Web checkout | `src/screens/ShopierCheckout.tsx`, `src/lib/polarCheckout.ts`, `src/api/queries.ts` | Native'de hook/endpoint/checkout çalışmamalı |
| Backend ticaret | `apps/server/src/routes/{paddle,polar,shopier,cosmetics}.ts`, `services/{paddleLive,polar,polarSales,shopier,shopierSales,cosmetics}.ts`, `db/schema.ts` | Web sağlayıcılarını koru; ortak grant kaynağı migration'ı ve store ledger adaptörü ekle |
| API/auth | `apps/web/src/api/client.ts`, `apps/server/src/routes/auth.ts`, `auth/tokens.ts`, `routes/onboarding.ts`, `app.ts` | Base URL, auth transport, CORS, refresh ve logout |
| Canlı veri | `apps/web/src/session/useEventStream.ts`, `src/api/refreshQueries.ts`, backend `stream/` | SSE + native resume/iptal/yeni snapshot |
| Ekran yönlendirme | `src/lib/shellRoute.ts`, `src/shell/panelRoute.ts`, `src/screens/GalaxyView.tsx` | Geri yığını ve deep-link intent eşlemesi |
| Klavye/insets | `src/lib/viewport.ts`, `src/styles.css`, native manifest/theme | Resize, safe area, sistem barları |
| Push çıkış noktası | `apps/server/src/services/notifications.ts`, `worker/handlers.ts`, `db/schema.ts` | Transactional outbox + cihaz/token kaydı; mevcut notify korunur |
| Bildirim UI | `apps/web/src/lib/notifications.ts`, mevcut Signals ekranı | Push tıklaması ile aynı hedef çözümleme |
| Hesap silme | `apps/server/src/services/accountDeletion.ts`, `cli/season.ts` | Operatör akışını self-service talep/işleme ile tamamla |
| UGC | `apps/server/src/routes/{chat,dm,clan,community}.ts`, `services/chatModeration.ts`, chat/DM ekranları | Şikâyet, engelleme kapsamı ve moderasyon iş akışı |
| Reklam/ölçüm | `src/lib/{adsense,h5,analytics,consent}.ts`, `src/shell/ConsentNotice.tsx`, `main.tsx` | Native build'de web tag enjeksiyonu ve başlatıcılarını kapat |
| Hukuki sayfalar | `src/lib/publisherPages.ts`, `apps/web/public/*.html` | Native URL/menü uyarlaması, silme sayfası, veri açıklamaları |
| CSP/deploy | `apps/web/vite.config.ts`, `deploy/nginx/astera.conf` | Nginx'siz paket CSP'si, HTTPS, CORS ve SSE proxy |

Mevcut regresyon başlangıçları: web `brand-install*.test.*`, `brand-installed-pwa.test.ts`, `fullscreen.test.tsx`, `skins-*.test.tsx`, `shopier-store.test.tsx`, `event-stream.test.tsx`, `notification-routes.test.tsx`, `public-site-readiness.test.tsx`, `consent*.test.*`, `mobile-*.test.ts`; server `auth.test.ts`, `account-deletion.test.ts`, `cosmetics.test.ts`, `notifications.test.ts`, `stream*.test.ts`, `dm.test.ts` ve ödeme sağlayıcı testleri. İlgili dosyaları `rg --files` ile bul; yalnız isimlerinden kapsamın tamam olduğu sonucunu çıkarma.

## 5. Tam uygulama sırası

Sıra bağımlılık sırasıdır. Her adımın kabul koşulu sağlanmadan ona bağlı adım tamamlandı sayılmaz. Store hesap başvuruları ve Mac temini uzun sürebileceği için 01'de başlatılır. Teknik uygulama Android'de başlar, iOS aynı sözleşmeyi daha sonra gerçek cihazda doğrular.

**Platform başına kapanış:** 02–16'nın ortak sunucu/test kısmı ve Android kısmı M1/M2/M3 için tamamlanabilir; iOS cihaz kabulü 17'de aynı adımlara geri dönülerek tamamlanır. 04, 11 ve 13'teki iOS koşulları Android aşamasını bekletmez. 03'ün paketlenmesi, 04'ün ağ erişimi ve 05/09'un platform kapıları birlikte M1'i oluşturur. 11 istemci ödeme akışı, 12 sunucu doğrulaması olmadan tamamlanmış sayılmaz; tek test ürünü bu ikisiyle birlikte yürütülür. M2 için gereken signing/internal-track hazırlığı 18'den öne alınır; 18 final artifact denetimidir.

### 01 — Kaynak anını ve dış girdileri sabitle

**İş:** `git status`, commit kimliği, lockfile ve dahil edilen yerel farkları kaydet. Temiz çalışma ağacı dayatıp dosya silme/stash etme. Tekrarlanabilir aday için kullanıcı değişiklikleri dahil kaynak snapshot'ı/hash manifest'i çıkar; build sırasında değişen dosyaları tespit et. Güncel kod ile eski dist'i karıştırma.

**Dış girdiler:** Play Console ve Apple Developer hesabının sahibi/üyelik türü, şirket/kişi bilgileri, yayın ülkeleri, production package/bundle ID, staging HTTPS adresi, Mac veya macOS CI, gerçek iPhone, destek adresi. Aday production ID `space.asteraonline.app`; ilk mağaza kaydından önce sahip tarafından kesinleştirilecek. Debug `.debug` olarak kalır; staging ayrı `.staging` olabilir.

**Kabul:** Build kaydı kaynak anını ve hedef ortamı gösterir. Eksik erişimler bölüm 8'de sahip ve durumla kaydedilir. Eksik store hesabı platform UI çalışmalarını durdurmaz; imzalama/yükleme adımını durdurur.

### 02 — Platform sözleşmesini TDD ile ekle

**İş:** Bölüm 2'deki runtime/capability sınırını oluştur. Önce web, PWA, native Android, native iOS ve plugin bulunmayan ortam testlerini yaz. Build hedefi ile runtime uyuşmazlığında mağaza ödemesi kapalı olsun. PWA native kabul edilmesin.

**Kabul:** Aynı UI testinde dört platformun capability sonucu kanıtlanır; web sayfasında native plugin exception oluşmaz. Native kontrolleri için bileşen bazlı user-agent regex'leri eklenmez.

### 03 — Telefonda bağımsız çalışacak paket build'ini oluştur

**İş:** Mevcut USB debug yolunu koruyarak ayrı bundled staging hedefi ekle. Native `webDir` gerçek Vite çıktı klasörü olur. Web build, native build'den ayrı dizine çıksın; son çalıştırılan komutun diğer hedefin dosyalarını yanlışlıkla paketlemesi engellensin. `VITE_ASTERA_PLATFORM` / `VITE_ASTERA_API_URL` benzeri hedef değişkenleri Zod ile doğrulansın; bu adlar öneridir, henüz mevcut script değildir.

Native staging/release'te: uzak HTTPS API zorunlu, `server.url` yok, `cleartext` yok, live reload yok, reference-art/visual-test köprüleri yok, hata ayıklama köprüleri yok. Debug HTTP izni yalnız debug manifest/config'de kalır. Release Gradle koruması ancak yeni hedeflerin negatif testleri yazıldıktan sonra hedef bazında açılır. Genel `pnpm build`in native varsayımları değiştirmesine izin verme.

Vite şu an Nginx'in değiştirdiği `__CSP_NONCE__` üretir. Yerel paket Nginx'ten geçmez: native için ayrı uygulanabilir CSP üret; `connect-src` API/SSE ve gereken kaynaklarla sınırlandırılır. HTML'de CSP placeholder bırakma; `*` veya genel `unsafe-eval` ile sorunu geçiştirme. Three.js decoder/worker/WASM/font/texture/audio yollarını ve MIME tiplerini paket origin'inde test et.

Web/PWA cache ve varsa service worker kaydını native bundle'dan ayır. Native shell içinde web service worker'ının eski HTML/JS sürümünü geri getirmesine izin verme; native asset cache anahtarı build/asset sürümüne bağlı olsun. App güncellemesi sonrası stale chunk, eski katalog ve bozuk cache senaryolarını dene. Native başlangıç ekranı mevcut hesabı galaksiye taşır; kullanıcıya her açılışta web tanıtım/kurulum turu yaptırılmaz.

**OS minimumu ile gerçek web motoru minimumu farklıdır.** Mevcut Tailwind v4, Safari 16.4+/Chrome 111+ tabanını ister; Vite çıktısı `es2022`, kullanılan Three.js sürümü WebGL2 gerektirir. Capacitor'ın iOS 15 / Android API 24 tabanı oyunun bu cihazlarda çalıştığını kanıtlamaz. İlk native iOS hedefi en az 16.4 olarak planlanır; daha yeni kullanılan API/CSS gerektiriyorsa sınır testle yükseltilir. Android'de WebView 111 altı desteklenmiş sayılmaz; `minWebViewVersion`, eski WebView hata ekranı ve güncelleme yolu yapılandırılır. WebGL2/GPU yetersizliği ayrı anlaşılır hata gösterir. Kontrol ekranı modern bundle parse edilmeden çalışabilmeli; yalnız uygulama içindeki JS kontrolüne güvenme. Minimum sürüme yakın gerçek cihaz testi olmadan “Android 7+ / iOS 15+ destekli” ilanı yapılmaz. [Tailwind tarayıcı tabanı](https://tailwindcss.com/docs/compatibility)

**Kabul:** APK oyun kabuğunu USB ve Vite olmadan açar. İnternetsiz açılışta beyaz/siyah sayfa yerine bağlantı durumu görünür. Derlenmiş HTML/config/manifest üzerinde debug URL, web checkout/reklam başlatıcısı ve secret taraması otomatik çalışır. API iletişimi için 04 de tamamlanmış olmalıdır.

### 04 — Paket origin'i ile giriş, API ve SSE'yi çöz

**Mevcut sorun:** API varsayılan `baseUrl=''`, normal istekler ve stream `credentials:'same-origin'`. Refresh `HttpOnly`, `SameSite=Lax` cookie; access token bellekte. Vite proxy bunu çalıştırıyor. Pakette Android `https://localhost`, iOS `capacitor://localhost` origin'i uzak backend ile aynı origin değildir. Yalnız API adresini değiştirmek kalıcı oturumu çözmez.

**Review ile değişen karar:** Genel `CapacitorHttp` + cookie jar yolunu güvenli varsayılan olarak kullanma. Kurulu 8.5.3 Android kodunda `HttpRequestHandler.buildResponse()` response header'larını JS çıktısına ekliyor; `buildResponseHeaders()` bütün header alanlarını filtrelemeden dolaşıyor. Bu nedenle “HttpOnly cookie native HTTP ile de JS'den gizli kalır” garantisi verilmez. Bu inceleme gerçek token sızması deneyi değildir; güvenlik varsayımının desteklenmediğinin kod kanıtıdır. Kaynak: `apps/web/node_modules/@capacitor/android/capacitor/src/main/java/com/getcapacitor/plugin/util/HttpRequestHandler.java` ve `CapacitorHttpUrlConnection.java`. [Native HTTP sözleşmesi](https://capacitorjs.com/docs/apis/http)

**Uygulanacak yön:** Web cookie akışını koru; native için ayrı oturum uçları ve Keystore destekli şifreli Android saklama / iOS Keychain kullanan dar bir native oturum adaptörü ekle. Login/register/onboarding claim/refresh/logout bütün olarak kapsansın. Uzun refresh credential native katmanda saklanıp oradan yenilenir; JS'ye yalnız kısa access token ve oturum sonucu döner. Genel amaçlı “refresh secret oku” metodu sunma; header ve native loglardan da sızdırma. Access token JS belleğindedir: bu tasarım XSS'yi zararsız yapmaz; CSP ve içerik temizliği yine gereklidir. Plugin seçimi veya küçük yerel bridge kararı 04'ün başında kod/backup/Keychain erişim davranışıyla incelenip ADR'ye kaydedilir. Seçilmemiş bir plugin'in güvenli olduğu varsayılmaz; localStorage/Preferences alternatif değildir.

Sunucu ayrı native session kayıtlarıyla refresh rotation/revocation, tekrar kullanım ve aynı anda refresh yarışını yönetir; logout/delete iptali ve restore akışı tanımlanır. Uygulama güncellemesinde credential korunması, yeniden kurulum/cihaz aktarımı/Keychain'de kalan kayıt ile yanlış hesaba giriş olmaması test edilir. Web'deki mevcut cookie bayrakları zayıflatılmaz; native rotalar ayrı şema/rate limit/session türü kullanır. Bu karar ilk mimari araştırmadaki cookie-deneyi önceliğinin yerini alır.

Normal API ve **fetch + ReadableStream tabanlı Bearer SSE** WebView fetch ile devam eder; global fetch/XHR patch açılmaz. Native istekler tarayıcı cookie'sine dayanmaz. CORS allowlist gerçek uygulama origin'lerini kapsar; `Origin:null` veya wildcard eklenmez. Native ve browser fetch farklı CORS davranışlarına sahip olduğundan biri çalıştı diye diğerini geçmiş sayma. İsteklerde kullanılan Authorization, Content-Type, `x-placement`, `idempotency-key` başlıkları ve OPTIONS doğrulanır; response `x-server-time`, `x-placement` ve kullanılan zaman başlıkları expose edilir. Refresh tek uçuşta çalışır; süresi dolmuş oturum tüm istekleri sonsuz 401/retry döngüsüne sokmaz. Server/proxy `Vary: Origin`, CDN cache ve SSE buffering/timeout ayarları da doğrulanır.

Önce Android'de login, kill/relaunch, expiry, claim, logout ve hesap değişimi kanıtlanır. Aynı kabul seti 17'de iOS'ta tekrarlanır; Android sonucuyla iOS kalıcılığı ilan edilmez.

**Kabul:** Login/register/claim/refresh/logout, SSE chunk'larının gecikmeden ulaşması, stream abort/reconnect, ağ değişimi, ters sırada dönen cevaplar ve iki hesaba ait cache'in karışmaması test edilir. HTTP patch ile SSE'yi buffer'layan çözüm kabul edilmez.

Ek ağ kapısı: gerçek **IPv6-only / DNS64-NAT64** ağında login, API, SSE, asset/CDN, billing ve destek sayfalarını test et. Domain kullan; IPv4 literal adresi veya manuel IPv6 string birleştirme ile bağlantı kurma. Bu test backend'e mutlaka native IPv6 adresi atanması demek değildir; DNS64/NAT64 üzerinden uçtan uca çalışması gerekir. TLS sertifika zinciri/yenileme, captive portal ve DNS hatası da görünür bağlantı hatasına dönüşmeli. [Apple IPv6 desteği](https://developer.apple.com/support/ipv6/)

### 05 — Web'e özgü düğmeleri ve yönlendirmeleri ayır

**İş:** Native'de InstallProvider'ın PWA event dinleyicileri/kurulum rehberi çalışmasın; InstallButton, RecallHost içindeki kurulum CTA'sı ve FullscreenButton hiçbir giriş noktasında görünmesin. BrandMasthead ve Menü yerleşiminde boşluk/ayraç bırakma. Browser fullscreen API'sinin native'de “destekleniyor” görünmesine güvenme.

Shopier/Polar hook'ları native mağaza mount'unda bile çağrılmasın; yalnız satın al düğmesini saklamak yeterli değildir. Menüdeki fiyatlar, destekçi satın alma linkleri, duyurular, publisher footer ve yardım sayfalarındaki satışa yönlendiren yolları da denetle. Hesapların gerçekten sahip olduğu envanteri görünmez yapma.

**Kabul:** Native açılış, login, eğitim, galaksi, menü, mağaza ve recall ekranlarında PWA/fullscreen/web ödeme CTA'sı yok. Ağ kayıtlarında web checkout/client-config/pricing istekleri yok. Web ve PWA kurulum/fullscreen/ödeme testleri yeşil.

### 06 — Sistem barları, klavye, dokunma ve geri davranışı

**18 Ekim owner kararı:** Saat/status ve navigation bar gizlensin istendi. [SystemBars immersive uygulaması](mobile-fullscreen-2026-10-18.md) telefona kuruldu; kenar swipe ile geçici erişim korunur. Aşağıdaki “gizlemek şart değil” ilk planı bu sonraki kullanıcı tercihini geçersiz kılmaz. Kapsamlı fullscreen IME/cutout/resume kabulü açık.

**İş:** Native edge-to-edge düzen, koyu arka plan ve okunur sistem ikonları kullan. İlk sürümde tarayıcı fullscreen düğmesi kaldırılır; status bar'ı gizleme/immersive zorlaması şart değildir. Navigation gesture/çentik alanı OS ile uyumlu kalır. Safe-area padding'in hem CSS hem native tarafından iki kez eklenmesini önle. Android 16 başlangıç safe-area hatasını release build'de tekrar ölç; upstream düzeltme/uyumlu sürüm veya gerekçeli minimal fix uygula. [Önceki hata kaydı](https://github.com/ionic-team/capacitor/issues/8530)

Klavye: login, kayıt, chat, DM, sayısal miktar alanları, alt sheet ve satın alma formu dahil test et. `adjustResize` mevcut; iOS resize/accessory/autofill ayrı davranır. `@capacitor/keyboard` yalnız gereken seçenekler için eklenir. [Keyboard API](https://capacitorjs.com/docs/apis/keyboard)

Geri önceliği: OS önce açık IME'yi kapatır; sonraki eylem en üst geçici sheet/dialog'u kapatır; sonra panelden galaksiye döner; root'ta Android sistem geri/minimize davranışına izin verilir. Aynı basış hem klavye hem paneli kapatmamalı. Form değişiklikleri ve satın alma sırasında yanlışlıkla ikinci işlem başlatılmamalı. iOS'ta yapay “uygulamadan çık” düğmesi ekleme.

Portrait ana tasarımdır; landscape/tablet/foldable/çoklu pencere geldiğinde kontroller kaybolmamalı. Sadece portrait kilidine güvenerek bozuk layout'u saklama. Touch hedefleri, uzun basış/metin seçimi, pinch/pan, drag sheet, scroll, TalkBack/VoiceOver etiketleri ve büyük yazı boyutları kontrol edilir. Mevcut viewport zoom kararını gelişigüzel değiştirme.

**Kabul:** Samsung'a ek en az bir farklı Android düzeninde, gesture ve üç tuş navigasyonda; iOS aşamasında çentikli iPhone'da klavye/geri/safe-area senaryoları geçer. 320–430 CSS px telefon genişliklerinde kritik CTA'lar erişilir.

### 07 — Arka plan, ağ kopması ve geri dönüşü güvenilir yap

**18 Ekim uygulaması:** [Ortak activity + cold-start toparlanması](mobile-lifecycle-2026-10-18.md) kod/test/browser ve yeni APK export aşamasında doğrulandı; yeni kaynaklar henüz telefona kurulmadı. Cihaz matrisini test sonucu olmadan kapatma.

**İş:** `@capacitor/app` lifecycle olaylarını mevcut `useEventStream` visibility/pageshow/online akışıyla birleştir. İki dinleyici aynı anda çift reconnect/refetch üretmesin. Arka planda gereksiz WebGL render, ses ve polling durur; oyun worker'ı sunucuda çalışmaya devam eder. Geri gelince saat/oturum ve güncel dünya snapshot'ı doğrulanır, stream tek bağlantıyla kurulur. [App API](https://capacitorjs.com/docs/apis/app)

Ağ koptuğunda “Bağlantı yeniden kuruluyor” göster; komutun başarılı olduğunu uydurma. Filo gönderme, satın alma veya kaynak harcama gibi mutation'ları körlemesine offline kuyruğa alma. Sonucu belirsiz isteği aynı idempotency key ve sunucu durumu üzerinden uzlaştır. UI yeniden mount olduğu için yeni key ile tekrar gönderme.

Ses ve WebGL context kaybı için resume/recovery; process kill sonrası cache/route geri yükleme; session/galaxy değişince eski hedefleri temizleme gerekir. OS'nin background'da JavaScript timer/SSE çalıştıracağını varsayma.

**Kabul:** 30 saniye, 5 dakika ve daha uzun arka plan; ekran kilidi; Wi-Fi ↔ mobil veri; uçak modu; server deploy; process kill; WebGL context loss denemeleri. İkinci filo, ikinci ödeme, durmuş sayaç veya sınırsız spinner oluşmaz.

### 08 — Linkler, deep link ve oturum sonrası hedefleme

**İş:** İç oyun hedefleri ile dış web URL'lerini tek adaptörde ayır. Hukuki/destek linklerinin göreli yolları native localhost'a yanlış bağlanmasın. `publisherPages.ts` şu an göreli URL döndürür. Dış sayfa native bridge olan WebView'e yüklenmesin; izin verilen HTTPS linkleri Browser/sistem tarayıcısında açılsın. `javascript:`, keyfi `intent:`, kullanıcı kontrollü callback host'u reddedilsin.

Paylaş/kopyala, `mailto:` destek, indirme ve varsa dosya açma ihtiyaçlarını bu aşamada say. Native API yalnız browser karşılığı gerçek cihazda yetersizse eklenir; iptal/hata görünür ele alınır. Sırf paylaşmak için depolama, kişi veya başka geniş izin isteme. Sistem tarayıcısının cookie oturumu ile uygulama oturumunun ayrı olabileceğini hesaba kat; dış sayfaya auth token ekleyerek bunu çözme.

Rich content sınırı da burada denetlenir: `apps/web/src/ui/RichContent.tsx` ve backend `services/announcementHtml.ts` HTML/link/YouTube iframe işliyor. Sadece React `<a>` bileşenlerini değiştirmek bunları kapsamaz. Server + client sanitization, iframe origin/sandbox, `target=_blank`, popup ve bridge'e ulaşan navigation yolları native'de test edilir. Menüde açılan mevcut `privacy.html`/`contact.html` footer'larında `/pricing.html` linki bulunduğu doğrulandı; native hukuki sayfa yolu bu satış zincirini taşımamalı. Global satış yasağı iddiası değil, bölüm 3'te seçilen ilk-sürüm dağıtım politikasının uygulanmasıdır.

Android App Links için domaine `/.well-known/assetlinks.json` ve **Play App Signing sertifikasının** SHA-256 parmak izi; iOS Universal Links için apple-app-site-association ve Associated Domains yapılandırılır. Debug/upload sertifikasını production app signing ile karıştırma. [Capacitor deep links](https://capacitorjs.com/docs/guides/deep-links)

Bildirim/link hedefi serbest URL yerine doğrulanan intent olsun: rapor ID, bildirim ID, gezegen ID gibi. Cold start veya login gerekiyorsa intent bir kez bekletilir; doğru hesap/sezon/yerleşim yüklendikten sonra yetki kontrolüyle açılır. Silinmiş/eski sezondaki hedef için açıklama ve bildirim kutusuna dönüş göster. URL/push payload içinde token taşınmaz.

**Kabul:** Kapalı/açık/arka plandaki app, oturumsuz kullanıcı, farklı hesap, süresi geçmiş hedef, yinelenmiş intent, app yüklü olmayan web fallback senaryoları geçer.

### 09 — Native reklam ve ölçüm sınırlarını temizle

**İş:** `adsensePlugin()` şu an her Vite build'inde web reklam tag'leri ekler. Native hedefte build-time enjeksiyonu, `configureH5Ads()` ve web GA başlangıcını kapat. Yalnız reklam alanını gizlemek script çalışmasını engellemez. Public hukuki HTML'lerin kendi script/footer'ları da incelenir. İlk native sürüm reklamsızdır; bu web reklam kararını değiştirmez.

Native crash/error takibi ayrıca eklenebilir: JS exception/unhandled rejection, native crash/ANR, build ID, WebView/OS, session refresh ve stream hataları ölçülsün. Token, şifre, purchase token, mesaj içeriği veya bildirim metni loglanmasın. JS source map ve Android mapping/iOS symbol dosyaları erişimi sınırlı artifact olarak saklansın.

İleride native reklam istenirse ayrı AdMob/uyumlu SDK, consent/UMP ve gerekiyorsa ATT işi açılır. Firebase push eklemek otomatik Analytics/Ads izni veya Firestore'a geçiş gerektirmez. İlk sürümde hangi telemetry SDK'sının ekleneceği veri envanteriyle kaydedilir; hiçbir SDK “zaten gerekli” diye sessizce açılmaz.

**Kabul:** Release ağ kaydında AdSense/H5/web checkout ve seçilmemiş analytics trafiği yok; kasıtlı staging JS/native hata doğru build'e bağlanıyor; kayıtlar hassas içerik taşımıyor.

### 10 — Mağaza kataloğunu ve ortak sahiplik modelini hazırla

**İş:** Gerçekte satılan `CosmeticId`/bundle kataloğunu mevcut rules, `cosmetics` servisi, Shopier/Polar kodu ve testlerden çıkar. Eski Paddle helper'ındaki sabit fiyatı veya dört ürün varsayımını yeni katalog sanma. Her ürün için oyun ID'si, Play product ID, Apple product ID, tür, bundle içeriği, bölgesel satış durumu, aktif sürüm ve server eşlemesini tabloya yaz.

Kalıcı kozmetik normalde non-consumable / tek seferlik kalıcı ürün olarak modellenir; tüketilir oyun parası gibi işaretlenmez. Bundle aynı backend haklarına açılır. Bir bundle ve tekil ürün aynı kozmetiği veriyorsa iki grant kaynağı izlenir. Bir satın alım iade edildiğinde başka geçerli grant'i olan kozmetik silinmez. Kullanıcının zaten sahip olduğu şey için tekrar satın alma önerilmez; farklı cihazda eşzamanlı alışveriş yine backend'de uzlaştırılır.

**Mevcut şema bu çoklu kaynak davranışını sağlamıyor:** `cosmetic_entitlements_account_cosmetic_idx`, `(accountId, cosmeticId)` için yalnız bir aktif satıra izin veriyor. Sağlayıcıların `onConflictDoNothing()` kullanması ikinci ödeme kaynağının kanıtını kaybettirebilir. Store eklemeden önce kaynak başına grant ledger'ı oluştur; mevcut entitlement'ı bunlardan türeyen tek aktif sahiplik görünümü/projection olarak koru. Eski MANUAL/PADDLE/POLAR/SHOPIER kayıtlarının grant kaynağını migrate et ve bütün grant/revoke yazarlarını aynı uzlaştırma yoluna al. Sadece store kodunu değiştirmek yeterli değildir. Geçmişte yok sayılmış ikinci kaydı kanıtsız yeniden üretme; varsa provider order/event kayıtlarından doğrula.

Store fiyatı mağaza SDK'sının yerelleştirilmiş fiyatıdır. `countryCode`, UI dili veya mevcut TRY/EUR sabitleriyle native tutar hesaplanmaz. Mağaza komisyonu/vergi sonrası net gelir, fiyat noktaları ve yayın ülkeleri sahibi tarafından kararlaştırılır; agent web fiyatlarını otomatik değiştirmez.

Apple'ın multiplatform kuralı nedeniyle web'den edinilen dijital içeriğin app'te kullanımı, karşılık gelen IAP erişimiyle birlikte değerlendirilmelidir. “Shop'u gizlersek iOS'ta bütün satın alınmış içerik otomatik uygundur” varsayımıyla submit etme. [Apple 3.1.3(b)](https://developer.apple.com/app-store/review/guidelines/#other-purchase-methods)

**Kabul:** Aktif native ürünlerin birebir eşleme tablosu ve bundle/refund testleri var. Başka platformdan sahiplik login sonrası görünür; mağaza SKU'su bilinmiyorsa satış kapalı, envanter kaybolmuyor.

### 11 — Android ve iOS satın alma adaptörünü ekle

**Planın başlangıç tercihi:** Capacitor için `@revenuecat/purchases-capacitor` ile Google Play Billing ve StoreKit erişimi; backend'deki kozmetik ledger'ı hakların asıl kaynağı kalır. RevenueCat harici web checkout değildir. Review sırasında npm registry `13.7.4` sürümü için `@capacitor/core >=8.0.0` peer bağımlılığını doğruladı (`pnpm view @revenuecat/purchases-capacitor version peerDependencies --json`). Bu metadata uyumu, native build/testin geçtiği anlamına gelmez. Entegrasyonda exact sürümü sabitle, transitif Play Billing/Android/iOS SDK sürümlerini lockfile ve native dependency çıktısından kaydet. Webhook erişimi ve servis ücret koşulları hesap planıyla doğrulanır; dış kayıt yapılmadan ticari kabul gerekir. [SDK kurulumu](https://www.revenuecat.com/docs/getting-started/installation/capacitor), [SDK kaynağı](https://github.com/RevenueCat/purchases-capacitor)

Review tarihinde RevenueCat fiyat sayfası aylık izlenen gelir için $2.500 eşiğine kadar ücretsiz, eşik sonrasında %1 modeli yayımlıyor. Bu mağaza komisyonuna ek servis maliyetidir; entegrasyon günündeki sözleşme/hesap koşulları esas alınır. Bu plan ücret kabulü veya hesap açma işlemi yapmaz. [Güncel RevenueCat fiyatı](https://www.revenuecat.com/pricing)

**Android'de somut değişiklik:** Mevcut manifest `android:launchMode="singleTask"` kullanıyor. RevenueCat kurulum belgesi, banka uygulamasına geçişin satın alımı iptal etmemesi için `standard` veya `singleTop` istiyor. İlk tercih `singleTop`; yalnız manifest değiştirip geçme: ödeme→banka→oyuna dönüş, App Link, bildirim tıklaması ve birden fazla Activity oluşması birlikte test edilsin. [Android ek kurulum](https://www.revenuecat.com/docs/getting-started/installation/capacitor#additional-android-setup)

Sahip bu servisi istemezse veya uyum testi başarısızsa alternatif doğrudan StoreKit/Play Billing adaptörüdür; aynı istemci sözleşmesi korunur, doğrulama ve store server bildirimleri backend'de uygulanır. Bu seçim 10–11 başlangıcında kısa ADR'ye yazılır; agent ödeme ekranını iki entegrasyonla birden geliştirmez. Mağaza ödeme altyapısı her iki yolda da zorunlu iş olarak kalır.

**İstemci sözleşmesi:** Ürünleri listele, satın al, restore et, doğrulama durumunu yenile. Durumlar: yükleniyor, hazır, satın alma ekranı açık, kullanıcı iptal etti, ödeme bekliyor, doğrulanıyor, teslim edildi, hata. İptal crash değildir; bekleyen ödeme hak vermez; ödeme başarılı fakat backend geçici kapalıysa yeniden ödeme başlatmak yerine teslimatı bekle/yenile göster.

Oturumun backend `accountId`'si satın alma kimliğine bağlanır; username, cihaz ID'si veya sezonluk player ID kullanılmaz. RevenueCat kullanılıyorsa login/logout ve restore transfer politikası açıkça ayarlanır; bir mağaza hesabı üzerinden iki Astera hesabına hakkın sessiz taşınması engellenir. Farklı hesapta restore, eski hesaba giriş/destek yolu göstermeli. [Müşteri kimliği](https://www.revenuecat.com/docs/customers/identifying-customers), [restore politikası](https://www.revenuecat.com/docs/projects/restore-behavior)

Seçilen politika: satın alma öncesi Astera hesabı zorunlu, RevenueCat `Keep with original App User ID`; varsayılan transfer politikası kullanılmaz. “Aktif abonelik yoksa transfer” kalıcı kozmetikleri korumaz. Aynı Apple hesabında farklı Astera hesabıyla **yeni** satın alımı da etkileyebildiği için bu durum ayrıca test edilir. Kimlik eşlemesi authenticated backend'den gelir; client'ın ilettiği account/provider ID bir yetki kanıtı sayılmaz. Restore ve webhook yalnız sunucu eşlemesine hak verir. Anonim satın alma/alias/hesap birleştirme ilk kapsamda kapalıdır.

Bu seçimin önkoşulu **çalışan hesap kurtarma/destek süreci**dir. 17 Ekim kodunda isteğe bağlı doğrulanmış e-posta, parola sıfırlama ve hesap güvenliği UI/API'si mevcut; ilk incelemedeki “self-service parola sıfırlama yok” bulgusu artık geçerli değil. [Hesap kurtarma incelemesi](account-email-recovery-review-2026-10-16.md) ve [deployment runbook](deployment.md) gerçek queued mail/webhook ve yayın kabulünde kalanları açıklar. Bu mevcut sistemi yeniden yazma; native oturumla ve mail uygulamasına gidip dönmeyle bütünleştir. Mağaza satışından önce kurtarma uçtan uca doğrulanmış ve destek sorumlusu belli olmalı. Silinmiş hesapta eski store purchase'ın nasıl ele alınacağı açıkça bildirilir; receipt yeniden getirildi diye silinmiş oyun hesabı/ilerlemesi otomatik diriltilmez. Store Family Sharing ve hesaplar arası aktarım kendiliğinden etkinleştirilmez; ürün davranışı ayrıca kararlaştırılır.

**Kabul:** Önce tek test ürünü Android internal track'te uçtan uca geçer; sonra tam katalog, sonra iOS sandbox/TestFlight. Yalnız USB ile yüklenen APK'da satın al düğmesinin açılması mağaza faturalandırma kanıtı değildir. Satın alımları geri yükle görünür ve erişilebilir olur.

### 12 — Ödeme doğrulama, teslimat ve iade backend'ini tamamla

**İş:** Client “başarılı” dedi diye hak verme. Store/RevenueCat üzerinden sunucudan doğrulanmış transaction, uygulama kimliği, environment, ürün, ödeme durumu ve bağlı hesap denetlensin. Webhook kimliği/imzası ilgili sağlayıcının yöntemine göre doğrulansın. Sandbox olay production hak vermesin.

RevenueCat yolunda webhook için yapılandırılmış Authorization secret zorunlu tut; güncel dokümanda bulunan HMAC seçeneği kullanılıyorsa imzayı **raw body**, teslimat timestamp'i ve sabit zamanlı karşılaştırmayla doğrula. İn-memory queue'ya alıp 200 dönme: doğrulanmış olayı önce durable inbox'a commit et, ardından hızlı 200 dön; grant/reconciliation worker'ı sonradan işlesin. Duplicate event tekrar 200 alır. Sağlayıcı retry'ı sonsuz olmadığı için kaçan olaylar için reconcile işi ve alarm gerekir. [RevenueCat webhook sözleşmesi](https://www.revenuecat.com/docs/integrations/webhooks)

**Ortam ayrımı dört farklı eksendir:** uygulama package/bundle ID'si, Astera backend/world ortamı, satın alım `SANDBOX/PRODUCTION` ortamı ve APNs `development/production` ortamı. Birini diğerinden türetme. TestFlight IAP sandbox'tır; test track'e katılan her Android hesabını otomatik ücretsiz tester sanma, Play license tester olarak da yapılandır. Review/TestFlight sandbox receipt'lerini reddederek satın alma akışını kullanılamaz yapma: doğrulanmış sandbox haklarını yalnız server'ın belirlediği test hesap/galaksi ve ayrı ledger namespace'inde teslim et. Production oyuncusunun prod envanterine sandbox hakkı geçmez; bu sınır client header'ı veya keyfi boolean ile seçilemez. Reviewer'a aynı işlevleri sunan, açıkça test amaçlı hesabı/alanı review notunda anlat. [TestFlight IAP ortamı](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testing-subscriptions-and-in-app-purchases-in-testflight/)

| Dağıtım | Backend/hak alanı | IAP ortamı | APNs ortamı |
| --- | --- | --- | --- |
| Android local debug | Yerel test; satış kapalı | Yok | Uygulanmaz; FCM ayrı proje/uygulama kaydı |
| Android internal test, license tester | Test hesabı/galaksi | Doğrulanmış test satın alımı | Uygulanmaz; FCM |
| iOS development imzalı test | Staging/test | StoreKit sandbox veya ayrı local test | Development entitlement |
| iOS TestFlight | Test hesabı/galaksi | Sandbox | Distribution imzasındaki production entitlement |
| Mağaza production | Production hesap/galaksi | Production; review sandbox yolu ayrı test alanına | Production entitlement |

APNs ortamını derleme adı veya receipt'ten tahmin etme; imzalanmış artifact'in `aps-environment` değeriyle doğrula. [Apple push ortamı ve imza](https://developer.apple.com/library/archive/technotes/tn2265/_index.html)

Yeni store ledger en az provider + environment + transaction/purchase kimliği benzersizliği, accountId, productId → itemId eşlemesi, durum, grant kaynağı ve audit zamanlarını tutar. Hassas purchase token yalnız gerektiği yerde korunur, loglanmaz. Provider event ID tekilleştirmesi yanında aynı satın alımın farklı event'lerle gelmesi de tek teslimata dönüşür.

Grant ve kayıt transaction içinde tutarlı olur; webhook commit sonrası cevaplanır; provider timeout, duplicate, ters sıra ve worker restart için retry/reconciliation bulunur. Doğrudan Play entegrasyonunda doğrulanan satın alımın acknowledgement/consume sorumluluğu açıkça uygulanır; non-consumable tüketilmez. RevenueCat kullanılıyorsa SDK'nın bu sorumluluğu ne zaman üstlendiği testle doğrulanır, backend ayrıca ikinci işlem yapmaz. [Google satın alma akışı](https://developer.android.com/google/play/billing/integrate), [sunucu doğrulama/güvenlik](https://developer.android.com/google/play/billing/security)

Production Play satın alımlarında acknowledgement penceresi satın alımın `PURCHASED` durumuna geçmesinden sonra üç gündür; pending durumdayken hak/ack verilmez. Test ortamındaki sürelerin kısalabileceğini test planına yaz. RevenueCat Android SDK 7.11.0+ non-consumable desteğine sahiptir; eski sürümlerde tüketme davranışı farklıdır. Seçilen Capacitor plugin'in transitif native sürümünü denetle. Tek seferlik satın alımların refund'ları için store server notifications bağlantısı RevenueCat tarafında da kurulmalı; yalnız mobil callback yetmez. [Google teslimat akışı](https://developer.android.com/google/play/billing/integrate), [RevenueCat non-subscription davranışı](https://www.revenuecat.com/docs/platform-resources/non-subscriptions)

Refund/revoke olayları sahipliği günceller; ilgili store'un server bildirimleri veya sağlayıcının eşdeğeri kurulur. Refund satın alım kaynağını geri alır; bağımsız web grant'i korunur. Kullanılan kozmetik hakkı tamamen kalktıysa güvenli varsayılan kozmetiğe dönülür. [Apple server notifications](https://developer.apple.com/documentation/appstoreservernotifications)

**Kabul:** Çift dokunma, iki cihaz, callback+webhook yarışı, ödeme sonrası process kill, pending→paid, paid→refund, refund→gecikmiş paid, sahte receipt, başka hesaba receipt taşıma, unknown SKU, provider erişilemezliği ve restore testleri geçer. Finansal destek işlemi için transaction üzerinden iz sürülebilir.

### 13 — Önce yerel üretim hatırlatmaları, sonra sunucudan push

#### 13A — İlk aşama: cihazda zamanlanan üretim hatırlatmaları

**Kullanıcıyla kararlaştırılan başlangıç (16 Ekim 2026):** Bina, gemi üretimi ve araştırma için resmî `@capacitor/local-notifications` eklentisini kullan. Firebase, APNs sunucu bağlantısı, push token kaydı veya bildirim anında API sorgusu gerekmez. Bildirim başına servis ücreti/ek bildirim sunucusu yoktur; mevcut oyun backend'i çalışmaya devam eder. Bu bölüm plan kararıdır; plugin henüz uygulanmış veya cihazda doğrulanmış sayılmaz. [Capacitor Local Notifications](https://capacitorjs.com/docs/apis/local-notifications)

**Veri kaynağı ve sınır:** Üretimi başlatan mevcut API isteği sunucuda kabul edilir; istemci onaylanan işin `finishesAt` değerini kullanarak işletim sistemine bildirim kaydeder. `apps/web/src/api/schemas.ts` içindeki construction/yard/research order şemalarında bu zaman ve isteğe bağlı `pausedAt` mevcut. Staged prova işleri sunucu zamanı taşımaz; onlar için zamanlama yapma. `apps/server/src/services/buildQueue.ts` iptal ve kuyruk zamanlarının yeniden düzenlenmesini yönetir. Süreyi istemcide oyun formülleriyle tekrar hesaplama; mevcut server-clock yaklaşımını inceleyip cihaz saati farkını hesaba kat.

Bildirim zamanı geldiğinde internet veya çalışan WebView gerekmez; zamanlamayı native işletim sistemi yapar. JS `setTimeout`, sürekli polling, arka planda açık socket veya foreground service üzerinden bildirim sistemi kurma. Bildirim yalnız hatırlatmadır: kaynak/ödül teslim etmez, işi tamamlamaz, sunucudaki oyun durumunu değiştirmez.

**Doğruluk sınırı:** Başka cihazdan/web'den iptal, duraklatma, kuyruk değişikliği veya dünya sahipliği değişimi kapalı/offline uygulamaya ulaşmayabilir. Yerel bildirim bu nedenle tamamlanmış sonucun kanıtı değildir. İlk metin örneği: “Üretim zamanını kontrol et”; açıklama: “Planlanan tamamlanma zamanı geldi. Güncel durumu görmek için oyunu aç.” Sunucudan doğrulanmadan kesin “filon hazır” sonucu vaat etme. Sonucun mutlaka doğrulanmış olması istenirse o olay 13B kapsamındaki push'a taşınır. Uygulama kapalıyken web'de başlatılan yeni bir iş de telefona kendiliğinden zamanlanmaz; sonraki uygulama senkronizasyonunda öğrenilir.

**Uygulama sırası ve davranış sözleşmesi:**

1. Platform capability'sine `localNotifications` ekle; yalnız native ortamda desteklenen, core ile uyumlu sabit plugin sürümünü kullan. Web/PWA bu adaptörü çalıştırmaz. Önce zamanlama/iptal/eşitleme testlerini FAIL durumunda yaz.
2. Bildirim tercihlerinde inşaat, tersane ve araştırmayı ayrı yönet. Kullanıcı özelliği açarken Android/iOS OS iznini iste; reddi oyun girişini engellemesin, her açılışta tekrar sorma. Android kanalları ile uygulama içi tercihleri birlikte kontrol et.
3. İlk başarılı hesap/dünya yüklemesinde, uygulama ön plana döndüğünde ve ilgili mutation/SSE güncellemesinde sunucunun güncel iş listesi ile bekleyen yerel bildirimleri eşitle. Duraklamış, iptal edilmiş, bitmiş, geçmiş tarihli veya artık erişilemeyen işleri planlama; süresi değişeni yeniden zamanla. Eksik/başarısız API cevabını boş iş listesi sanıp bütün bildirimleri silme.
4. Kalıcı eşlemeyi ortam + hesap + sezon/yerleşim + iş ID ile tut; plugin'in sayısal bildirim ID'si için çakışmaları önle. Yeniden açılış/senkronizasyon aynı işi çoğaltmasın. Her gemiye ayrı bildirim yerine üretim siparişi başına tek bildirim kullan; toplu tercihler kapalıysa ilgili bekleyenleri kaldır. OS'nin bekleyen bildirim sınırını seçilen sürümde doğrula; sınırı aşan kuyruğu sessizce kaybetme, en yakın işleri önceliklendirip sonraki açılışta yenile.
5. Logout, hesap silme veya hesap/ortam değişiminde önceki bağlama ait bekleyen ve gösterilmiş yerel bildirimleri temizle. Payload'a token veya hassas oyun bilgisi koyma. Tıklamada bölüm 08'deki doğrulanan intent akışını kullan; doğru hesap ve güncel API verisi geldikten sonra gezegen/kuyruk ekranını aç. Offline ise tamamlanmış gibi göstermeden bağlantı durumunu açıkla.
6. İlk aşamada bu olaylara ayrıca push gönderme. İleride push'a geçişte olay türü/cihaz için tek teslimat yöntemi seç; ilgili eski yerel planları iptal et. Eski uygulama sürümlerinde kalan planları da hesaba kat; yalnız ortak event ID eklemek OS tarafından gösterilmiş iki bildirimi önlemez.

**Zamanlama garantisi:** İlk sürümde özel exact-alarm izinlerine dayanma; `USE_EXACT_ALARM` ekleme. Seçilen plugin sürümünün izinsiz/inexact zamanlama davranışını doğrula. Android bazı inexact alarm yöntemlerinde normal koşullarda dahi bir saate kadar teslim penceresi tanımlar; Doze/pil kısıtlamaları daha fazla geciktirebilir. “Tam saniyesinde” veya “en fazla birkaç dakika” garantisi verme. Normal uygulama kapanışı, Android ayarlarından force-stop, cihazın kapatılması ve yeniden başlatılması ayrı durumlardır. Yeniden başlatmada plugin'in kalıcı planları geri kurma davranışını cihazda doğrula; eksikse kalıcı kayıt + desteklenen native yeniden kurma yolu uygula. Bildirim izni, kanal, Focus/sessiz mod ve OS kısıtlamaları görünürlüğü etkiler. [Android alarm davranışları](https://developer.android.com/develop/background-work/services/alarms)

**Kabul:** Önce bir Android cihazda kısa süreli gerçek üretimle dene; sonra iOS'ta ayrı doğrula. Ön plan, ekran kilidi, normal process kapanışı, internet/USB yokluğu, Doze, izin/kanal reddi, yeniden başlatma, saat değişimi, iptal/duraklatma/yeniden zamanlama, başka cihazdan değişiklik, iki hesap ve cold-start tıklama senaryolarını kaydet. Force-stop veya stale offline plan için garanti verilmeyen davranışı raporla. Yinelenen senkronizasyonda tek bekleyen kayıt bulunmalı; ön planda gereksiz OS + oyun içi çift uyarı olmamalı. Yerel bildirim ile sunucunun gerçek tamamlanma durumu testte ayrı kontrol edilmeli.

#### 13B — Sonraki aşama: sunucudan doğrulanmış olaylar için push

**Kapsam:** Önceden bilinmeyen, mevcut oyun kurallarınca oyuncuya görünür olaylar ve kesin sonuç doğrulaması istenen bildirimler. 13A'yı denemek için bu altyapıyı kurmak gerekmez; push ilk yerel bildirim sürümünün önkoşulu değildir. Aşağıdaki işler push aşaması açıldığında uygulanır.

**Varsayılan:** Android FCM; iOS APNs. `@capacitor/push-notifications` Android'de FCM token, iOS'ta APNs token verir. Bunları aynı token türü sanma. Bu planın en az ek SDK yolu backend'de Android FCM + iOS APNs adaptörüdür. İleride iOS'u da FCM üzerinden göndermek seçilirse Firebase Messaging iOS entegrasyonu ve APNs anahtar bağlantısı ayrıca yapılır. [Capacitor Push](https://capacitorjs.com/docs/apis/push-notifications), [Firebase iOS kurulumu](https://firebase.google.com/docs/cloud-messaging/ios/get-started)

**Sıra:** Firebase projesi/Android uygulama kayıtları → staging tek cihaz gönderimi → auth'lu token kaydı → bildirim tercihleri → transactional outbox → gerçek oyun olayı → deep link → iOS APNs testi. Debug/staging/production kimlikleri ve token ortamları karışmasın. `google-services.json` istemci proje ayarıdır; service account private key/APNs `.p8`/server yetkileri APK veya Git'e girmez.

Cihaz kaydı: kurulum ID'si, hesap, platform, provider, environment, token, son görülme, uygulama sürümü ve izin durumu. Token yenilenmesi, çoklu cihaz, logout, yeniden kurulum, hesabın silinmesi ve geçersiz token temizliği kapsansın. Token kaydında başka accountId seçilemesin; hesap authenticated session'dan gelsin. İzin reddi oyun girişini engellemesin; her açılışta izin isteme. Android 13+ ve iOS izin akışları gerçek cihazda denensin.

Kapalı uygulamaya görünür bildirim için Android'de `notification` + gerekli küçük `data` alanları, iOS'ta APNs alert payload kullan. Bu plugin iOS silent push desteklemiyor; Android data-only mesajda uygulama öldüyse JS callback çalışacağı varsayılamaz. Background worker/JS uyandırma üzerine teslimat sistemi kurma. Listener'ları register çağrısından önce ekle; Android 8+ notification channel'larını oluştur; genel OS izni ile kanal kapatma durumunu ayır. iOS AppDelegate forwarding/entitlement, APNs topic, token environment ve sertifika/anahtar kapsamını yapılandır. [Plugin sınırları](https://capacitorjs.com/docs/apis/push-notifications), [FCM background davranışı](https://firebase.google.com/docs/cloud-messaging/android/receive-messages)

`services/notifications.ts::notify()` transaction içinde bildirim yazar ve commit'e bağlı yayın yapar. Aynı transaction'da outbox kaydı üret; FCM/APNs ağ isteğini oyun transaction'ının içinde çalıştırma. Outbox retry/backoff, event+device tekilleştirme, TTL ve ölü token temizliği yapsın. Retry aynı bildirimi tekrar gönderebilir; teslimat ise hiç gerçekleşmeyebilir. Mutlak “tam bir push” garantisi verme; payload/event ID ve collapse stratejisi tekrarları azaltır.

Push kapsamı: mevcut, oyuncunun görmeye yetkili olduğu mesaj/sonuç/geri dönüş olayları; araştırma ve üretim ancak yerel hatırlatmadan push'a açıkça geçirildiyse dahil edilir. Saldırı/erken uyarı bildirimi yeni istihbarat veya PvP avantajı üretmemeli; mevcut görünürlük/uyarı zamanını aşan içerik eklemek ürün kararıdır. Kanal, sessiz saatler ve içerik gizliliği ayarlanabilir olsun; pazarlama bildirimi ayrı tercih gerektirir. Push gecikebilir veya hiç gelmeyebilir; oyun sonucu ve zamanlayıcıları ona bağlanmaz.

**Logout yarışının sınırı:** FCM/APNs'ye önceden verilmiş alert'i cihazdan geri çağırma garantisi yoktur; bu nedenle “logout sonrası hiçbir eski bildirim görünmez” sözü verilemez. İlk sürümde kilit ekranı metni genel olur (“Yeni oyun bildirimin var”), özel mesaj/koordinat/saldırgan/filo bilgisi taşımaz. Ayrıntı yalnız app açıldığında mevcut oturumla API'den çekilir. Logout/hesap değişiminde token bağını ve bekleyen outbox işlerini iptal et, gönderim öncesi binding sürümünü tekrar kontrol et, gösterilmiş bildirimleri temizle; offline logout'u kalıcı yerel detach işiyle ağ geldiğinde tamamla. Yolda kalmış bildirim farklı hesaba özel veri açamaz. Push verisi account/environment hedefiyle eşleşmezse intent işlenmez.

**Kabul:** Ön planda oyun içi bildirim ile OS bildirimi gereksiz çift gösterilmez; arka plan/kapalı uygulamada görünür; tıklama doğru rapora gider. Logout sonrası önceki hesaba ait özel içerik gelmez. OS force-stop/izin reddi durumunda teslimat garanti edilmediği test notunda belirtilir. Web push ayrı proje kalır; normal SSE push sanılmaz.

### 14 — Hesap silme ve oturum güvenliğini mağazaya uygun tamamla

**Somut mevcut eksik:** `services/accountDeletion.ts` var, fakat dosya açıklaması bunun UI'sız operatör komutu olduğunu söylüyor; `season delete-account` üzerinden çalışıyor. Bu, uygulama içinden hesap silme başlatma akışının hazır olduğu anlamına gelmez. Yorumun varlığı yeni bir onay şartı değildir: kullanıcının mağazaya hazırlık talebi bu gerekli teknik/UI işi kapsar. Yorum uygulamayla birlikte güncellenir; yalnız aktif dünya/PvP/kimlik kararları gerçekten değişecekse somut ürün kararı istenir.

**İş:** Ayarlar/Hesap → Hesabımı sil akışı, yeniden kimlik doğrulama, neyin silineceği ve saklanacak kayıtların açıklaması, açık onay ve talep sonucu ekle. Google Play için uygulamayı tekrar yüklemeden talep başlatılabilen public web sayfası da gerekir. Mevcut service'in aktif filo, koloniler, klan, Silent Space geçmişi, ödüller ve foreign-key engellerini incele; HTTP route'tan CLI komutunu körlemesine çağırma. [Apple silme gereksinimi](https://developer.apple.com/support/offering-account-deletion-in-your-app/), [Google silme gereksinimi](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en)

Operasyon hemen tamamlanamıyorsa kalıcı/idempotent talep, takip edilebilir durum, bildirilen makul işlem süresi ve gerçekten çalışan tamamlama işi gerekir. “Hesabı dondur” silme değildir. PvP'den kaçış veya sahiplik kurallarını değiştirecek silme zamanlaması owner kararıyla netleştirilir; belirsiz süreyle reddedilmez.

Astera düzenlemeye tabi özel bir sektör uygulaması değildir: iOS'ta kullanıcıyı silmeyi başlatmak/tamamlamak için destek e-postası/telefon/chat görüşmesine mecbur bırakma. Doğrulanmış uygulama/web talebinin operatör tarafından arkada tamamlanması mümkündür; süre ve bitiş sonucu kullanıcıya gösterilir. Talep formu “bize yazın” bağlantısından farklıdır. [Apple'ın destek akışı ve manuel işlem ayrımı](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion)

Push kayıtları, session'lar, kişisel mesaj/kimlik ilişkileri ve saklama gerektiren ticari kayıtlar açık politikayla ele alınır. Silme sonrası gecikmiş webhook hesabı yeniden oluşturmaz. 17 Ekim kodunda `accounts.authVersion` ve token sürüm kontrolü mevcut; account-wide iptali yeniden tasarlama. Normal web logout hâlâ cookie temizliyor, tek cihaz sunucu oturum iptali sağlamıyor; 04'teki native session kayıtları/rotation/revocation ile bu ayrımı tamamla. Mevcut username veya doğrulanmış email ile giriş politikasını koru; bu iş sosyal login ekleme yetkisi değildir.

Yalnız refresh'i iptal etmek yeterli değildir. 17 Ekim kodunda `TokenService.identity()` DB'den hesap/sürüm doğrulaması yapıyor; `requireAuth`/`optionalAuth` bunu kullanıyor, SSE event ve idle heartbeat akışları da sürüm iptalini denetliyor. Hesap silme ve native session eklendiğinde bu davranışı koru; silme/oturum iptali sonrası access token ve açık stream kapanışını, cache/replica gecikmesini ayrıca test et. Politika açıkça saklama istisnası gerektirmedikçe UGC metnini sadece yazar ID'sini null yaparak “silindi” sayma. Backup'tan dönüşte silinen kişiyi geri getirmemek için silme kayıtlarının restore/reconciliation süreci tanımlansın.

**Kabul:** Silinen hesap tekrar refresh olamaz; satın alma/push olayı hesabı diriltmez; komşu oyuncuların filo/dünya bütünlüğü bozulmaz; uygulama ve web silme yolları gerçek test hesabıyla uçtan uca tamamlanır.

### 15 — Sohbet ve kullanıcı içeriklerini denetle

**İş:** Global chat, klan chat, DM, kullanıcı/gezegen/klan adları ve diğer görünür UGC yüzeylerini çıkar. DM block uçları ve admin moderation var; bunların bütün mağaza şartlarını karşıladığını varsayma. Kullanıcı/mesaj şikâyeti, kötüye kullanım engelleme, kabul edilen topluluk kuralları, moderatör kuyruğu ve destek iletişimi uçtan uca çalışmalı. Engellenen kullanıcı bildirim/DM üzerinden rahatsız etmeye devam etmemeli. [Google UGC politikası](https://support.google.com/googleplay/android-developer/answer/9876937?hl=en)

Kapsam iletişim güvenliğidir; “engelle” otomatik PvP dokunulmazlığı sağlamaz. Böyle bir oyun kuralı değişikliği yapma. Şikâyet kanıtı, yetki, rate limit, yanlış bildirim ve moderasyon audit kayıtlarını test et.

**Kabul:** Oyuncu uygulama içinden içeriği bildirebilir, iletişimi engelleyebilir; yetkili moderatör gerçek kayıt üzerinden işlem yapabilir; tüm dillerde sonuç anlaşılırdır. Salt admin CLI bulunması yeterli kabul edilmez.

### 16 — Gizlilik, izinler, mağaza beyanları ve yayıncı kimliği

**İş:** Gerçek veri akışı envanteri çıkar: hesap kimliği, IP, chat/DM, satın alma geçmişi, push token, diagnostics, seçilmiş analytics SDK'ları. Saklama/silme ve üçüncü taraflar mevcut privacy/KVKK/terms/community/refund sayfalarıyla tutarlı olsun. Play Data safety ve Apple App Privacy cevapları aynı envanterden doldurulsun; “Firebase var → tüm veriler toplanıyor” veya “reklam yok → hiç veri yok” varsayımı yapma. [Apple App Privacy](https://developer.apple.com/app-store/app-privacy-details/)

iOS uygulaması ve bağımlılıkları için privacy manifest/required-reason API beyanlarını gerçek kullanımdan çıkar. ATT yalnız ilgili tracking yapılıyorsa gerekir; push izni ATT yerine geçmez. Android manifest ve iOS usage description'larında yalnız kullanılan izinler bulunsun. [Capacitor privacy manifest](https://capacitorjs.com/docs/ios/privacy-manifest)

Yaş derecelendirmesinde multiplayer iletişim ve satın alımları doğru belirt. Çocuk hedeflemesi, yayın ülkeleri, yayıncı/tacir kimliği, destek iletişimi, ödeme/vergi sözleşmeleri owner girdisidir. Hesap zaten kullanıcı adı/parola ile çalışıyor; Google/Facebook login eklenmediği için sırf iOS'a çıkılıyor diye yeni sosyal kimlik sistemi kurma. Sonradan üçüncü taraf login gelirse Apple login kuralları ayrıca incelenir.

Ek teslimatlar: kullanılan font/müzik/3D model/görsel ve native SDK lisans/attribution envanteri; mağaza ekran görüntülerinde kullanım hakkı; Terms/EULA bağlantısı; Apple export-compliance/encryption anketi. Sadece HTTPS kullanıldığı için anketi boş bırakma veya `ITSAppUsesNonExemptEncryption` değerini körlemesine kopyalama; gerçek kriptografi kullanımına göre yanıtı ve varsa muafiyet gerekçesini kaydet. AB'de dağıtım varsa tacir statüsü ve gerekli iletişim doğrulaması konsolda tamamlanır. [Apple export compliance](https://developer.apple.com/help/app-store-connect/manage-app-information/overview-of-export-compliance)

**Kabul:** Public privacy/support/deletion URL'leri oturumsuz açılır; store formu, APK/IPA izinleri ve ağ trafiği birbiriyle uyumludur. Hukuki metinler için gerekli işletme onayı alınmış, değişen veri akışı kaydedilmiştir.

### 17 — iOS projesini oluştur ve gerçek cihazda doğrula

**İş:** Ortak platform/build/auth sözleşmeleri oturduktan sonra uyumlu `@capacitor/ios` ile `apps/web/ios` oluştur. Mac veya macOS CI, Xcode, bundle ID, takım, signing/provisioning, Associated Domains ve Push capability yapılandırılır. Mevcut Linux bilgisayar tek başına iOS archive üretmez.

Capacitor 8 yeni iOS projelerini varsayılan Swift Package Manager ile oluşturur. Seçilen IAP/push/oturum plugin'lerinin SPM desteğini doğrula; desteklenmiyorsa proje oluştururken tek bir CocoaPods yolunu seçip kilit dosyalarını sakla. Hem Pod hem SPM üzerinden aynı SDK'yı iki kez ekleme. Core/CLI/Android/iOS sürümleri uyumlu sabit seride tutulur; dokümandaki `latest` komutunu çalıştırıp fark etmeden majör sürüm değiştirme. [Capacitor 8 geçiş notları](https://capacitorjs.com/docs/updating/8-0)

16 Ekim 2026 kontrolünde Apple'ın 28 Nisan 2026'dan itibaren iOS/iPadOS 26 SDK veya üstüyle build şartı var; upload gününde Xcode/SDK matrisi tekrar doğrulanır. Bu, uygulamanın minimum kullanıcı iOS sürümünün 26 olması demek değildir. [Apple SDK gereksinimi](https://developer.apple.com/news/?id=ueeok6yw)

WKWebView/WebGL shader/texture/WASM/audio, cookie veya secure storage, klavye, safe-area, process kill, bellek baskısı, deep link, APNs ve IAP Android sonucundan çıkarılamaz. iPhone desteği ilan ediliyorsa gerçek iPhone'da; iPad de desteklenecekse iPad'de ayrıca test yapılır.

**Kabul:** Development install ve ardından TestFlight üzerinden aynı senaryo seti geçer; satın alma restore ve push production/sandbox ortamları karışmaz. Yalnız simulator sonucu App Store cihaz kabulü değildir.

### 18 — İkon, splash, boyut ve release artifact'lerini bitir

**İş:** Android adaptive/themed ikon, bildirim küçük ikonu, iOS AppIcon ve splash/launch görünümü uygun asset kataloglarında üretilir. Mevcut debug ikonu başlangıçtır; tüm mağaza boyutları hazır sayılmaz. Android küçük bildirim ikonu için launcher görselini olduğu gibi kullanma. İlk frame, splash ve WebGL yükleme arasında beyaz flash/sonsuz splash olmasın.

Native paket içeriğini ölç: başlangıç varlıkları, 3D modeller, font/audio/texture, gereksiz publisher/demo/preview dosyaları. Gerekirse sürümlü HTTPS CDN'den yalnız veri/asset indir; hash/cache invalidation/fallback ve indirme hatası uygula. İlk sürümde uzaktan JS hot update sistemi kurma. Store boyut limitini güncel konsoldan doğrula; klasör boyutunu indirme boyutu diye raporlama.

Android için imzalı **AAB** mağaza çıktısı; APK cihaz/sideload testi içindir. Upload key ile Play App Signing key farklı rollerdedir. Keystore/sertifika parolaları secret store'da, yedek ve erişim sahibi belli olmalı. Release debuggable/WebView inspection kapalı; network security config, backup, exported component ve intent filtreleri incelenir. VersionCode/build numarası her yüklemede artar.

Yeni Android app için kontrol edilen güncel hedef **API 36**; mevcut proje zaten 36 hedefliyor. Native bağımlılıklar eklendikten sonra 64-bit ve **16 KB page-size** uyumunu final AAB'nin kütüphaneleri üzerinde kontrol et. “Web oyunu olduğu için native lib yoktur” varsayımı yapma. [Target API](https://developer.android.com/google/play/requirements/target-sdk), [16 KB desteği](https://developer.android.com/guide/practices/page-sizes)

Target SDK ile Billing Library sürümünü ayrı denetle: 31 Ağustos 2026 sonrası standart yeni gönderimde Play Billing **8 veya daha yeni destekli sürüm** gerekir; v7 için uzatma ilk release'in varsayımı değildir. RevenueCat'in Gradle'a getirdiği gerçek sürüm ve merged manifest'teki billing version metadata'sı kontrol edilir. [Billing sürüm takvimi](https://developer.android.com/google/play/billing/deprecation-faq)

**Kabul:** Final paket kimliği, imzası, sürümü, kaynak hash'i, indirilen/kurulan boyutu ve debug tarama sonucu kayıtlı. Yeni kurulum ve önceki test sürümünden yükseltme oturum/ayar/sahiplik kaybetmeden geçer. Debug APK ile mağaza imzası farklı olduğundan debug→production yerinde güncelleme beklenmez.

### 19 — Android internal/closed test ve iOS TestFlight kabulünü tamamla

**İş:** Aşağıdaki bölüm 6 matrisini imzalı gerçek dağıtım adayında çalıştır. Android internal track'i IAP test kullanıcılarıyla doğrula; gerekli hesaplarda closed test sürecini tamamla. 13 Kasım 2023 sonrası açılan kişisel Play hesapları için şu an en az **12 test kullanıcısının kesintisiz 14 gün katılımı** ve ardından production erişim başvurusu gerekiyor; bunu her hesap için otomatik şart sanma, hesap türünü doğrula. [Google test koşulları](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en-GB)

İlk testte kullanıcıya özellikle bug/error akışlarını ver; yalnız FPS videosu isteme. Her hata için build, cihaz/OS/WebView, hesap ortamı, tekrar adımları, beklenen/gerçek sonuç ve maskelenmiş request ID kaydedilsin. Debug-only konsol erişiminin bulunmadığı release'te de sorun teşhis edilebilmeli.

**Kabul:** Kritik/yüksek öncelikli açık hata yok; diğer bulgular sahipli ve kayıtlı. Gerçek store sandbox satın alma/restore/refund ile push/deep-link testi geçti. Oturum/ağ değişimi ve uzun kullanım kanıtı var.

### 20 — Mağaza sayfaları ve review paketini hazırla

**18 Ekim owner girdisi / açık yayın engeli:** Production'da `testaccount` açıldı ve Console'a inceleme hesabı olarak verildi. Bu kesin hesabın otomatik Silent Space'e alınmaması için dar istisna uygulanıp production'da doğrulanmalı. Ayrıntı ve açık iş [inceleme hesabı kaydında](mobile-store-review-account-2026-10-18.md); parolayı repo belgelerine yazma. Henüz uygulandı sayılmaz.

**İş:** Gerçek app'ten ekran görüntüleri; ad, kısa/uzun açıklama, kategori, yaş derecesi, diller, IAP açıklamaları, support/privacy/deletion URL'leri hazırlanır. Web sayfası ekran görüntüsünü app kanıtı gibi sunma. İkon ve görseller mağaza yönergelerine göre kontrol edilir.

İlk IAP/ilgili ürün türü Apple'a app sürümüyle birlikte review'a eklenir; yalnız binary göndermek yetmez. Ürün localization, fiyat/availability, review screenshot ve gerekli ticari/banka/vergi sözleşmeleri tamamlanır. Sandbox'ta ürünün görünmesi onaylandığı anlamına gelmez. [Apple IAP gönderimi](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-in-app-purchase)

Review hesabı ve adım adım erişim notu hazırla: giriş → galaksi → geliştirme/filo → chat/report/block → mağaza/restore → hesap silme. Reviewer'a admin hesabı verme. Backend erişilebilir, hesap kilitsiz, sezon geçişi/sunucu doluluğu yüzünden oyun kapısı kapalı olmamalı; review hesabının kullanabileceği akış açıklanmalı. İnceleyiciye ayrı sahte uygulama davranışı sunma.

Apple minimum functionality değerlendirmesinde oyunun gerçek etkileşimi ve uygulama deneyimi önemlidir; Capacitor kullanmak tek başına ret gerekçesi veya kabul garantisi değildir. Çalışan oyun, güvenilir lifecycle ve native entegrasyonlar gösterilir. [Apple review guidelines, 2.1 ve 4.2](https://developer.apple.com/app-store/review/guidelines/)

**Kabul:** Release artifact, store formu, ekran görüntüleri, IAP ürünleri ve review notları birbirini anlatıyor. Owner'ın onaylayacağı somut yayın paketi hazır; eksik/boş alan yok. Yayına basma kararı için bu paket sunulur.

### 21 — Kademeli yayın ve sonrasını işlet

**İş:** Önce backend'in geriye uyumlu migration/API değişiklikleri; sonra yeni client dağıtımı. Üretimde otomatik DB reset veya destructive migration yok. Min supported version ve update-required ekranı ancak gerçekten uyumsuz API varsa çalışır; sırf her web deploy'unda app'i engelleme. Uyumsuz istemci mutation yapmadan anlaşılır güncelleme ekranı ve doğru store linki görmeli.

Satış/push kapatma anahtarları işletim içindir; review sırasında saklanan yasak ödeme yolunu sonradan açmak için kullanılmaz. Mobil binary mağaza onayı gerektirdiğinden web rollback'i APK'yı geri almaz. Rollout durdurma, backend compatibility, provider arızası ve hotfix build için sorumlu/runbook hazır olsun.

**Kabul:** İlk cohort'ta crash/ANR, JS hata, auth refresh hatası, stream kopması, IAP teslimat gecikmesi, refund/push başarısızlığı izlenir. Alarm eşikleri ve ilk gün takip sahibi release kaydında yazılıdır. Her platformun build/source map/symbol ve test kanıtı arşivlenir.

## 6. Test matrisi ve bitiş tanımı

Her davranış değişikliğinde önce happy path + edge case listesi → test FAIL → uygulama → PASS → review. Bu belge değişikliği için oyun testleri çalıştırmak gerekmez; ileride kod uygulanırken repo disiplininin tamamı geçerlidir. Kontroller sırayla, tek workspace/worker, `nice -n 10`, Node heap en fazla 4096 MB. Kullanıcı ayrıca istemeden ekonomi/sezon/snowball uzun simülasyonlarını çalıştırma.

| Grup | Asgari senaryolar | Geçiş kanıtı |
| --- | --- | --- |
| Platform UI | Browser, PWA, Android, iOS; kurulum/fullscreen/ödeme/reklam ayrımı | Unit/UI testleri + gerçek native ekranlar |
| Paket | Taze kaynak build'i, boş cache, USB yok, internet yok, eski sürümden yükseltme | Artifact taraması + cihaz kaydı |
| Auth | Kayıt, claim, login, yanlış parola, refresh yarışı, expiry, logout, hesap değişimi, backup/reinstall/kurtarma | API testleri + kill/relaunch cihaz denemesi; credential JS/log'da yok |
| Ağ/SSE | OPTIONS/CORS, stream chunk, abort, Wi-Fi/mobil veri, IPv6-only/NAT64, uçak modu, sunucu restart | En az bir gerçek olayın zamanında gelişi; retry sınırları |
| Dokunma/klavye | Tüm giriş alanları, IME composition, Türkçe karakter/emoji, sayısal alan, autofill, geri | Samsung + farklı Android + iPhone |
| Lifecycle | Home, ekran kilidi, 5+ dakika background, process kill, bellek/context kaybı | Dönüşte güncel dünya, tek stream, çift mutation yok |
| Ödeme | Başarılı, iptal, pending, banka uygulamasından dönüş, çift olay, yanlış hesap, restore, refund, bundle+tekil+web grant çakışması | Sandbox transaction + kaynak ledger'ı; imza/ortam ayrımı |
| Push | İzin/kanal kabul-ret, token rotation, çoklu cihaz, offline logout, yoldaki bildirim, expired event, cold/warm tap | FCM/APNs ve doğru ekran; hesap değişince özel veri sızıntısı yok |
| Yerel bildirim | Normal kapanış, offline, Doze, reboot, saat değişimi, izin/kanal reddi, iptal/pause, web'den değişim, hesap değişimi, tekrar sync, cold/warm tap | 13A cihaz kaydı; tek bekleyen iş, doğru hedef, gecikme ve eski plan sınırları açık |
| UGC/silme | Report/block/moderasyon, silme, access token+SSE iptali, saklama/backup restore, gecikmiş webhook | Yetki/DB regresyonu + UI tamamlanma kanıtı |
| Eski cihaz/motor | Minimum OS/WebView, WebGL2 yokluğu, CSS/JS uyumu, uygulama parse olmadan fallback | Destek matrisi; yanlış minimum sürüm ilanı yok |
| Görsel/erişilebilirlik | Çentik, alt gesture bar, küçük ekran, font ölçeği, screen reader, landscape | `node tools/visual.mjs` + native screenshot/oynama |
| Uzun kullanım | En az 30 dakika karma oyun, ekran geçişleri, bildirim/ödeme dönüşü | Crash/leak/ANR/ısı ve yeni hata değerlendirmesi |
| Web regresyon | Mevcut auth/PWA/fullscreen/Shopier/Polar/chat/sahiplik | Mevcut testler + browser smoke |

Native cihaz doğrulaması olmadan yalnız jsdom/Playwright sonucuyla klavye, cookie kalıcılığı, push veya IAP tamamlandı sayılmaz. iOS kabulü olmadan “iki mağazaya hazır” denmez.

Önerilen yeni test dosyaları: web `platform-runtime.test.ts`, `native-capabilities.test.tsx`, `native-auth-transport.test.ts`, `native-lifecycle.test.ts`, `native-navigation.test.ts`, `native-billing.test.tsx`, `native-build.test.ts`; server `store-purchases.test.ts`, `store-webhooks.test.ts`, `push-outbox.test.ts`, `push-devices.test.ts`, `account-deletion-api.test.ts`. Bunlar **gelecekte eklenecek** isimlerdir; şimdi var oldukları varsayılmasın. Mevcut test uygun sınırı zaten kapsıyorsa onu genişlet.

Her adımın kapanışına şunları yaz: değişen dosyalar, test komutu ve sonucu, cihaz/build bilgisi, kanıt yolu, kalan risk. Tüm testler çalışmadıysa bunu açıkça belirt; geçici API 401 veya framework hatasını kanıtsız “çözüldü” sayma.

## 7. Kilometre taşları ve release engelleri

| Kilometre taşı | Zorunlu adımlar | Kullanıcının elde ettiği |
| --- | --- | --- |
| M0 — mevcut | Yerel wrapper denemesi | USB + Vite ile güncel local kodu oynama; mağaza sürümü değil |
| M1 — bağımsız Android test | 01–09'un ortak/Android kısmı | USB'siz, staging sunuculu, dosyaları paketlenmiş APK; native satış/reklam kapalı |
| M2 — satın alma/bildirim test | M1 + 10–12 ve 13A'nın ortak/Android kısmı + 18'den internal-track signing hazırlığı; 13B sonraki push aşaması | Play internal track'te doğrulanmış IAP/restore/refund ve yerel üretim hatırlatması |
| M3 — Google Play adayı | M2 + 14–16, 18–20 ve Android testleri | İmzalı AAB + tamamlanmış console/review paketi |
| M4 — App Store adayı | Sahibin 17 Ekim sırasıyla Android yayını sonrası; ortak işler + 17'de 02–16'nın iOS kanıtı + 18–20'nin iOS kısmı | TestFlight'ta doğrulanmış iOS archive ve review paketi; ortak mimari Android geliştirmesinden itibaren iOS'u kapsar |
| M5 — işletilen yayın | 21 | Kademeli rollout ve izlenen prod sürümleri |

**Store release engelleri:** dev URL/HTTP/debug açık; auth veya SSE paket origin'inde bozuk; native içinde kontrolsüz web satış CTA'sı; doğrulanmadan verilen satın alma; restore/refund eksikliği; yanlış hesaba push/hak aktarımı; in-app hesap silme talebi yok; UGC güvenlik akışı eksik; privacy/izin beyanı yanlış; imzalama/SDK/16 KB gereksinimi karşılanmıyor; tekrarlanabilir crash/ANR/siyah ekran; reviewer oyuna erişemiyor.

İlk private cihaz testinde satışın kapalı olması uygundur. Bunu mağaza yayını için otomatik muafiyet sayma. Push iki mağazanın her oyun için zorunlu tuttuğu özellik değildir; güncel başlangıç kararı 13A yerel üretim hatırlatmalarıdır. 13B sonraki aşamadır: belgedeki push token/outbox/APNs testi ve Push capability şartları yalnız push etkinleştirilen sürüm için uygulanır; ilk sürümde yerel bildirimlerin Android/iOS kabulü gerekir. Web push, reklam monetizasyonu, sosyal login, abonelik, tablet için ayrı tasarım ve agresif FPS optimizasyonu ayrı sonraki işlerdir; ilk yayın için gerekmedikçe kapsam büyütülmez.

## 8. Sahip/hesap girdileri ve karar kayıtları

Bu tablo eksik bilgi nedeniyle işin nerede bekleyeceğini belirler; agent'ın her satır için baştan izin istemesi anlamına gelmez. Teknik/reversible işler mevcut yetkiyle ilerler. Gerçek dış hesap, mali koşul veya ürün kuralı gerektiğinde somut sonuç/öneriyle karar alınır.

| Girdi/karar | Varsayılan plan | Kimden / hangi adımdan önce |
| --- | --- | --- |
| Production app/bundle kimliği | `space.asteraonline.app` adayı | Sahip; ilk store kayıt ve signing öncesi |
| Store hesapları ve yayın ülkeleri | Play Console mevcut; hesap türü/production erişimi, Apple üyeliği ve ülkeler doğrulanacak | Sahip; 10/18'den önce hazır |
| Staging / production API | Gerçek erişilebilir HTTPS; mevcut backend | Altyapı sahibi; 03–04 cihaz testinden önce |
| Mac / iPhone | Gerçek iOS testi; macOS CI mümkün | Sahip; 17'den önce |
| Native auth seçimi | Ayrı native session + native güvenli saklama/refresh bridge; web cookie korunur | Teknik ADR ve cihaz kanıtı; 04 kapanmadan |
| Billing sağlayıcısı | RevenueCat Capacitor öncelikli; doğrudan store alternatifi | Teknik uyum + sahibin servis/ticari kabulü; 11 öncesi |
| Katalog / fiyat / bundle | Mevcut kozmetik hakkı korunur; store SKU eşlenir | Sahip fiyatları; 10 kapanmadan |
| Firebase / APNs | Android FCM; iOS doğrudan APNs; ilk yerel bildirim sürümü için gerekli değil | Proje/anahtar sahibi; 13B öncesi |
| Push içerikleri | Mevcut görünür sonuç olayları; yeni intel yok | PvP/erken uyarı kapsamı değişirse sahip; 13 |
| Hesap silme UI ve dünya etkisi | Self-service talep + güvenli tamamlanma | UI teknik kapsamda; aktif dünya/PvP/kimlik kararı değişirse sahip; 14 |
| Hesap kurtarma | Satın alımı asıl hesaba bağlayan, kötüye kullanıma dayanıklı destek/kurtarma | Kimlik yöntemi değişirse sahip; IAP açılmadan |
| Privacy, yaş ve şirket bilgisi | Gerçek veri akışı/ürün hedefi | Sahip; 16/20 |
| Yayına çıkış | Test edilmiş artifact ve review paketi hazırlandıktan sonra | Sahip; 20→21 |

## 9. Sonraki agent'ın ilk yapacağı somut iş

1. Mevcut değişiklikleri ve bu belgenin mevcut kodla farkını kontrol et; yapılan işleri yeniden yapma.
2. **02 platform sözleşmesi + 05 PWA/fullscreen/web checkout ayrımı** için testleri önce yaz. 03 build ayrımı bu kapılara dayanır; ilk küçük uygulama paketi bunları birlikte taşıyabilir.
3. **03–04 bundled Android + native oturum/API/SSE doğrulaması** ile USB'siz APK kilometre taşına ulaş. Bu kapıyı geçmeden IAP/push ekranlarına yoğunlaşma. Eski nottaki genel native HTTP-cookie önerisini geri getirme; 04'teki review kararı geçerlidir.
4. Sonra sıradaki tamamlanmamış adımı uygula; her kapanışta bu belgedeki durum/kanıt bilgisini güncelle.

Belgenin teknik önerileri Astera kod incelemesine dayanır. Mağaza/platform kuralları ilgili paragraflarda resmî kaynaklara bağlanmıştır; gönderim tarihinde özellikle ödeme bölgeleri, test koşulları, target API, Apple SDK ve privacy gereksinimlerini yeniden doğrula.

## 10. Review bulguları ve kesinlik kaydı — 16 Ekim 2026

Bu tablo **belgedeki** eksikleri kapatır. İlgili uygulama değişiklikleri henüz yapılmadı; aşağıdaki bulguların oyun kodunda düzeltildiği anlamına gelmez.

| Öncelik | Bulgu / önceki eksik | Kanıt ve düzeltme |
| --- | --- | --- |
| P1 | Native HTTP-cookie yolunda HttpOnly güvenliği garanti kabul ediliyordu | Kurulu Capacitor 8.5.3 header köprüsü incelendi; 04 native session ve dar native credential adaptörü yönünde yeniden yazıldı |
| P1 | “Çoklu satın alma kaynağı korunur” mevcut DB ile mümkün değildi | `db/schema.ts::cosmeticEntitlements` aktif account+cosmetic unique index'i; 10'a kaynak ledger'ı ve tüm sağlayıcılarda migration eklendi |
| P1 | Banka uygulamasına geçişte satın alma iptali riski atlanmıştı | Manifest `singleTask` + RevenueCat Android kuralı; 11'e launchMode ve ödeme/deep-link regresyonu eklendi |
| P1 | Minimum Capacitor OS'si oyun desteğiyle karıştırılabilirdi | Tailwind v4 Safari 16.4/Chrome 111 tabanı, Vite es2022, kurulu Three WebGL2 kaynağı; 03'e gerçek motor/donanım kapısı eklendi |
| P1 | Android ilerlemesi, henüz kurulmamış iOS kabulüne bağlı görünüyordu | 5 ve 7'de platform başına kapanış; 11+12 birlikte test, 18'den erken internal-track signing ayrıldı |
| P1 | Store sandbox, backend ortamı ve push ortamı tek eksen gibi kalmıştı | TestFlight IAP kaynağı + APNs signing kuralı; 12'ye ortam matrisi ve ayrı test entitlement alanı eklendi |
| P1 | Restore kilidi hesap kurtarma olmadan kullanıcıyı satın alımından mahrum bırakabilir | Auth route'larında reset akışı bulunmadı; 11'e recovery önkoşulu ve açık RevenueCat restore politikası eklendi |
| P1 | Logout'tan sonra yoldaki push'ın hiç görünmeyeceği garanti edilemez | FCM background alert davranışı; 13 genel kilit ekranı metni, binding iptali ve auth'lu ayrıntı çözümüyle netleştirildi |
| P1 | Silmede yalnız refresh iptaline odaklanılmıştı | `routes/auth.ts::requireAuth/optionalAuth` kontrol edildi; 14'e access token, açık SSE, UGC ve backup geri dönüşü eklendi |
| P2 | Eski “UI olmamalı” kod yorumu gereksiz onay kapısına dönüştürülmüştü | 14 ve 8 düzeltildi; mağaza hazırlığının gerekli UI işi ilerler, gerçek ürün kuralı değişikliği ayrı ele alınır |
| P2 | Webhook işleme, non-consumable/ack ve SDK uyumu fazla geneldi | Npm peer metadata + RevenueCat/Google belgeleri; 11–12'de doğrulanmış sürüm bilgisi, durable inbox, ack süresi ve refund bağlantısı açıklandı |
| P2 | Native dış link kontrolü rich HTML/publisher footer'ını tam tanımlamıyordu | `RichContent.tsx`, `announcementHtml.ts`, public privacy/contact footer'ları incelendi; 08 genişletildi |
| P2 | IPv6, Billing Library takvimi, SPM, ilk IAP submit ve encryption formu yoktu | Resmî kaynaklar 04, 16–18 ve 20'ye eklendi; test matrisi güncellendi |

### Doğrulanmış bilgi / proje tercihi / bekleyen kanıt ayrımı

- **Doğrulanmış:** Mevcut kod yapısı ve yukarıdaki hatalı varsayımların nedenleri; 16 Ekim kontrolünde API 36 gereksinimi, Billing 8+ standart gönderim tabanı, Apple iOS 26 SDK şartı, koşullu Play 12 kişi/14 gün testi, app içi silme gereksinimi, Capacitor push token/silent push sınırları ve RevenueCat peer uyumu. Bunların kaynakları ilgili adımlardadır.
- **Proje tercihi:** RevenueCat önceliği, native credential bridge mimarisi, ilk sürümde reklam kapatma, ilk push metninin genel olması, iOS için en az 16.4 başlangıç hedefi, test süresi ve release kapıları. Bunlar mağaza tarafından dayatılmış tek çözüm diye okunmamalı.
- **Uygulama sırasında kanıtlanacak:** Seçilecek credential bridge'in gerçek Android/iOS kalıcılığı ve erişim sınırı; RevenueCat'in bu repo ile gerçek native build/IAP sonucu; minimum desteklenen cihaz/GPU listesi; safe-area düzeltmesinin release sonucu; gerçek TestFlight/APNs/store transaction'ları. Araştırma bu cihaz sonuçlarının yerine geçmez.
- **Dış hesaba bağlı:** App kimliği müsaitliği/sahipliği, geliştirici hesap türü ve doğrulanması, gerçek fiyat/komisyon/sözleşme, yayın ülkeleri ve test kullanıcıları. Konsol erişimi olmadan bunlar kesinleşmiş sayılmaz. İlgili sahibi ve son tarih 8'de doldurulur.

Review doğrulaması: yalnız bu Markdown değiştirildi; yerel bağlantılar, 21 adımın sırası, kod yolları ve Markdown yapısı kontrol edildi. Bu belge review'i için native build, IAP/push veya yeni cihaz testi çalıştırılmadı.
