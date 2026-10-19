# Lifecycle/fullscreen gerçek Android kabulü — 18 Ekim 2026

## Kapsam ve başlangıç

**Güncel sonuç:** Sahip ekran kilidini açtı; aynı process mevcut oturumla galaksiye, tek müzik/context'e döndü. Harici gizlilik bağlantısı Brave'de açıldı ve OS Back uygulamaya döndü. Landscape ölçümü780×360/canvas hazır. Ancak foreground offline cold-start → Wi-Fi dönüşünde gerçek bir ağ toparlanma hatası bulundu; aşağıdaki yeni kabul kaydı önceki bekleyen-unlock notlarının yerini alır. Mağaza kabulü hâlâ açık.

Sahip telefonu yeniden bağlayıp kontrolleri yetkilendirdi. Samsung SM-S901E üzerinde sourceHash `241de81b2e54a24d3c4755c70db680415d62a8dc51e0e6d6d1b91938da467bd7`, APK SHA256 `5e914ccda36e7e9dbc0f5b78829a7dd24b51d2cf1d4664c1239060fc0b6b45e8`,79.716.619 byte bundled production DEBUG kuruldu. Telefonda base.apk SHA export ile eşleşti; mevcut oturum parola istemeden oyun açtı. Bu kayıt önceki eee467 fullscreen ve862574 mobil veri kabulünden ayrıdır.

Başlangıçta Wi-Fi1/mobil veri0, ADB reverse ve forward listesi boş, ekran awake/unlocked. Gözlem için yalnız kendi CDP9223 forward'ı açılır. Auth token/parola/mesaj içeriği kaydedilmez. Gameplay, satın alma, sohbet gönderimi veya hesap değişikliği yapılmaz. Geçici ağ/ses/rotation ayarları başlangıç değerine döndürülür.

## Senaryolar ve beklenen davranış

- Mevcut oturum, ortak gerçek API/SSE; bundled localhost origin ve doğru kurulu APK kimliği.
- Fullscreen compositor/sistem inset durumu; chat IME açılması, ilk Back yalnız klavyeyi kapatır, ikinci Back paneli kapatır. Harici güvenli browser açılışı ve uygulamaya dönüş.
- Native foreground/DOM state ile ses ve render kontrolü: kısa app switch,30s arka plan, en az5min ekran kilidi. Foreground dönüşünde dünya hazır, oturum korunur; read/reconnect fırtınası veya çift ses olmaz. Canlı CDP ağ gözlemi yalnız URL path/status/sayı kaydeder, payload/Authorization taşımaz.
- Ağ bağlantısı geçici kapalıyken process kill/cold-start; bağlantı geri geldiğinde manuel retry/giriş olmadan oyun açılmalı. Son ağ ayarları restore edilir.
- Son process kill/relaunch ve gerçek galaksi compositor kontrolü; crash/ANR yalnız uygulama scope'unda incelenir. Test sonucu/sınır ölçülmeden PASS verilmez.

Kanıt dizini `out/mobile-lifecycle-2026-10-18/device/`. Kontroller sürüyor. Signing/AAB/store ve iOS kabulü bu oturumla tamamlanmaz.

## İlk ölçümler

Kurulum/hash eşleşmesi ve mevcut oturumla gerçek galaksi açılışı geçti. Compositor `initial-fullscreen.png` gözle incelendi: oyun hazır, saat/status ikonları ve alttaki sistem gesture barı yok. Sohbet açılıp composer gerçek touch ile odaklandı; mesaj yazılmadı/gönderilmedi. Viewport780→407, textarea bottom323; ilk OS Back780'e döndürdü ve sohbet kaldı, ikinci Back sohbeti kapattı ve oyun kaldı. Bu değişiklikten önceki fullscreen IME kabulü böylece yeni paket üzerinde tekrarlandı.

En az30s Home/background: native inactive ve DOM hidden; draw sayacı123246→123246, müzik currentTime1.115368→1.115368/paused, tek AudioContext suspended. Foreground'da canvas/oyun hazır, müzik ilerlemeye ve aynı context running'e döndü. Native+DOM event sırası dönüşte native true→DOM visible oldu; çift sinyal çalışmayı kilitlemedi. Bağımsız SDK observer'ımız yalnız kendi handle'ını kaldırır.

Ekran kilidinde başlangıç draw149923;280s ve **341s** sonraki senkron DOM örneklerinde hâlâ149923 ve hidden. En az5min lock render pause **PASS**. Kilit süresi5min'i geçti, Samsung keyguard secure=true olduğundan dönüşü tamamlamak için sahibinden cihazı normal PIN/biometri ile açması istendi; parola istenmedi. **Kilit dönüşü henüz PASS değil.**

Ölçüm aracı sınırı: WebView uzun süre arka plandayken native `App.getState()` cevabı ve CDP heap/`Runtime.queryObjects` örneklemesi foreground'a kadar bekleyebiliyor. Bu yüzden geç tamamlanacak async “lock midpoint/end” dosyaları gerçek arka plan anı sayılmaz. Senkron DOM/draw örneği ayrı tutulur; OS kilidinin bittiği gerçek native/DOM event zamanı ile yeni foreground örneği kullanılacak. Bu gözlem ürün restore hatası kanıtı değildir; diagnostic kodu foreground sinyali üretmedi ve auth çağırmadı.

Sahipten unlock yanıtı gelmeyince yalnız kendi bekleyen diagnostic runner'ları durduruldu ve CDP9223 forward kaldırıldı; ADB reverse eklenmedi. Wi-Fi1/mobil veri0 başlangıç ayarları korunuyor, offline testi henüz başlamadı. Diagnostic observer/GL wrapper cleanup talebi gönderildi; kilitliyken tamamlanması doğrulanamadı. Sonraki oturumda önce unlock/foreground örneği ve cleanup doğrulaması; sonra process restart ile bütün geçici gözlemci durumu temizlenerek offline testi yapılmalı. Bu ara durumu yeni APK/code hatası diye sınıflandırma.

Araştırma ayrımı: [Android WebView API](https://developer.android.com/reference/android/webkit/WebView#onPause()) `onPause()` ile global `pauseTimers()` davranışını ayırır; gözlenen her gecikmeyi global timer pause olarak yorumlama. Kurulu Capacitor8.5.3 BridgeActivity native activity true/false sinyallerini onResume/onStop üzerinden üretir; mevcut adaptör bu sinyal ile DOM visibility'yi birlikte kullanır. Bu notun kendisi cihaz dönüşünün geçtiği anlamına gelmez.

## Unlock sonrasında gerçek kabul ve ağ bulgusu

`unlocked-resume.json/png`: aynı PID32152, nativeActive=true, DOM visible, canvas/galaksi hazır, loading=false; manuel retry/giriş olmadan tek müzik ve running AudioContext. Uzun kilit341s'yi aştı; dönüş event tarihçesi daha uzun kilitleri de içerir. Uzun kilit boyunca ses pozisyonu ayrıca ölçülmedi; kesintisiz ses pozisyonu kanıtı30s testine aittir.

`browser-focus-final.json` Brave/default browser'ın foreground'a geldiğini doğrular; `browser-return-final.json` Back sonrasında https localhost origin, görünür canvas ve menüyü doğrular. Önceki erken focus örnekleri harness zamanlama/scroll hatalarıdır. `rotation-landscape.json/png`780×360 ve beş alt navigasyon hedefinin ekran içinde kaldığını ölçer; landscape ve unlock compositor PNG'leri gözle incelendi: galaksi/navigasyon görünür ve sistem barları yok. Bu kontrol bütün landscape panellerinin kabulü değildir.

**Ürün hatası:** Ağlar kapalı force-stop/cold-start doğru retry ekranını gösterdi, fakat navigator.onLine=true kaldı. Wi-Fi geri açılınca browser online eventi ve auth/me isteği gelmedi;60s içinde otomatik toparlanma olmadı (`offline-cold-start.json`, `offline-traffic.json`, `offline-check-error.json`). Gerçek Home/background→resume otomatik toparladı (`offline-longer-resume.json`). Bu sonuç önceki farklı APK/ağ senaryolarının PASS kanıtını geçersiz kılmaz, bu senaryoyu açık tutar. Çözüm/test kaydı [native ağ adaptörü](mobile-native-network-recovery-2026-10-18.md); yeni SDK'lı APK henüz kurulmadı.

Diagnostic observer/GL wrapper temizliği doğrulandı; offline force-stop ayrıca process'i sıfırladı. Wi-Fi1/mobil veri0, rotation0/0 ve plugged-in awake15 geri yüklendi; uygulama launcher'a küçültüldü ve kendi CDP9223 forward'ı kaldırıldı. Sonraki cihaz turunda yeni APK üzerinde foreground ağ dönüşü, process kill, API/SSE ve app-scope crash/ANR kabulü yapılmalı.

Son ADB envanterinde cihaz bağlı görünmüyor. Yeni ağ APK kabulü için tekrar bağlantı gerekir; mevcut241… APK sonuçları yeni kaynaklara aktarılmaz.

## 18 Ekim final fiziksel ağ kabulü PASS

Yeni d5538745…/c6100a08… DEBUG APK18 Ekim21:30 Istanbul SamsungSM-S901E'ye mevcut oturum korunarak kuruldu. Kaynak release-signing değişikliklerinden önceki qualified artifact'tır; imzalı AAB diye gösterilmez. Aynı process/screen foreground'da offline coldstart→Wi-Fi otomatik oyun/canvas13.619ms; ayrı coldstart→**cellular**13.003ms, plugin connected=true/connectionType=cellular. Retry/refresh/login/Home veya focus müdahalesi yok. Her iki tekrar mevcut Keystore hesabını yeniden açtı; bu turda gerçek DOM online event de geldi, eski failure turunda gelmemişti. Bu yüzden cihaz bu tur tek başına native-event-only nedenselliğini ispatlamaz; o sınır109 hook/adapter testinde ayrıca doğrulanmıştır.

Her iki ağ sonrası native refresh200, auth/me200/sameAccount, gerçek SSE200/connected/no-buffer, clock/date/placement exposed PASS; JS'e refresh secret sızması yok/document cookie yok. Native refresh probe yalnız otomatik UI toparlanması kanıtından **sonra** çalıştırıldı. WiFi1/mobile0 başlangıca döndü, rotation/stay-awake değiştirilmedi,9223forward kaldırıldı, app açık bırakıldı. Process exit kaydı yalnız kontrollü FORCE STOP/isolated cleanup; bu turun crash buffer'ı boş, app ANR/crash gözlenmedi. Uzun soak kabulü yerine geçmez.

Kanıt `out/mobile-network-2026-10-18/device-20261018T1835Z` ve `device-cellular-20261018T1835Z`. İlk CDP screenshot'ta eksik WebGL ve sıkışmış dialog görüldü; hemen sonraki gerçek Android screencap'te3D galaksi/diyalog/fullscreen normaldi ve gözle kontrol edildi. Animasyon/compositing farkı olabilir; kesin neden bu tur belirlenmedi. Tek ara screenshot'a dayanarak yeni renderer bug ilan edilmedi. Eski network FAIL dosyaları korunur. Bu kaynak için network cihaz kapısı kapanır; signing/AAB/policy/iOS kapıları açık.
