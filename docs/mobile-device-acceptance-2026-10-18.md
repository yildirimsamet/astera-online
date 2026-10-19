# Android mobil veri ve gezinme cihaz kabulü — 18 Ekim 2026

## Test edilen paket

Samsung SM-S901E, Android16/API36, WebView155.0.8059.43. Bundled production **DEBUG**, appId `space.asteraonline.app`, API `https://asteraonline.space`; backend/web hâlâ f9378f1c. Git tabanı f9378f1c + beş review düzeltmesi. SourceHash `86257405d2cc79f4a8f5a8604ae5dab5827349335c6b5b300b8389c9613f8d5c`, APK SHA256 `ac319677641bc9a010d9644ab5057e0834090561448da54b5d9314292cb36dde`,152050107 byte. **Telefondaki base.apk SHA256 export ile eşleşti.**

Bu kabul tam ekran isteğinden **önceki** pakete aittir. Paket `out/mobile-artifacts/review-cellular-qualified-20261018/` altında metadata/checksum ile saklandı. Sonraki fullscreen APK ayrı kabul gerektirir; önceki sonuçlar değişen viewport/IME davranışına otomatik taşınmaz.

## Sonuçlar

| Senaryo | Gözlenen sonuç |
| --- | --- |
| Mobil veri | Wi-Fi0, mobile_data1, Internet varsayılanı cellular; ADB reverse boş. PC/Vite/API reverse bağlantısı kullanılmadı. |
| Mevcut oturum | Yeni APK `install -r` sonrası parola istenmeden oyun açıldı. Java HTTPS refresh200, ortak me200, edge SSE200/text-event-stream/connected. Clock/Date/placement header'ları okunur. Refresh sırları JS cevabında yok; document.cookie boş. |
| Tam process kill | Yeni PID ile açılışta oturum ve oyun geri geldi; yeniden native refresh/API/SSE200. |
| IME + panel Back | Genel sohbet composer odaklandı, metin yazılmadı/gönderilmedi. Viewport780→407; textarea bottom323, dialog bottom343 (407 içinde). İlk Back780'e döndürür, sohbet açık. İkinci Back sohbeti kapatır; oyun görünür kalır. |
| Kenar geri hareketi | Gesture navigation mode2; gerçek OS'e ADB kenar swipe verilince sohbet kapandı, oyun açık kaldı. Fiziksel parmakla geniş gesture matrisi değildir. |
| Hedef listesi | Açık popover Back ile kapandı; oyun görünür kaldı. |
| Odak paneli | Asteroit seçimi yalnız okuma/UI. Geniş açık→ilk Back dar→ikinci Back seçim temiz; app görünür. |
| Nested ülke seçici | Menü üzerinde ikinci dialog açıldı; Back yalnız ülke seçiciyi kapattı, menü kaldı. Ülke seçilmedi/değiştirilmedi. |
| Kök Back | Modal yokken Back app'i arka plana attı; yeniden açılışta oyun geri geldi. Logout yapılmadı. |
| Publisher link | Canonical HTTPS gizlilik link'i varsayılan **Brave** sistem browser'ında açıldı; app origin'i https://localhost kaldı. Back app'e ve menüye döndü. |
| Offline/cold start | Mobil veri geçici kapatılınca native refresh503; bundled belge internetsiz process restart ile açıldı. `finally` içinde mobil veri yeniden açıldı. Kalıcı oturum kaybolmadı; native refresh/me/SSE200 geri geldi. |
| Offline UI dönüşü | İnternetsiz cold-start ekranı **kendiliğinden** galaksiye geçmedi; mevcut “Tekrar dene” butonuyla oturum/oyun geri geldi. Otomatik cold-start ağ toparlanması geçti diye raporlanmaz. |
| Son görüntü | Oyun kontrolleri hazır olduktan sonra Android compositor PNG'sinde gerçek nebula/gezegen/3D galaksi görüldü. Canvas varlığı veya loading ekranı tek başına başarı sayılmadı. Tek FPS örneği performans benchmark'ı değildir. |

İlk IME ölçümü OS animasyonundan önce örneklendi; ilk kill probe'u yeni PID hazır olmadan çalıştı. Bunlar ürün hatası/başarı kanıtı sayılmadı. İlgili ölçümler görünürlük/viewport/PID readiness beklenerek tekrarlandı; son JSON'lar bu başarılı kontrollü koşulardır.

Kanıtlar: `out/mobile-review-2026-10-18/device/` altında sanitized JSON, acceptance.json ve compositor PNG. Parola/refresh token/access token kaydedilmedi. DM/klan içeriği açılmadı; mesaj/filo/satın alma/ülke değişikliği yapılmadı. Son ağ ayarı mobil veri1/Wi-Fi0; yalnız kendi CDP9223 forward'ı kaldırıldı. Backend deploy/migration yapılmadı.

## Açık kalanlar

Fiziksel kablo çıkarıldıktan sonraki kullanım sahibinden doğrulanmadı. Uzun ekran kilidi/arka plan ve WebGL context recovery, gerçek native fotoğraf/video codec matrisi, signing/AAB/mağaza ve iOS kabulü açık; M1/release tamamlandı sayılmaz. Tam ekran değişikliği yeni APK ile özellikle IME, safe area/çentik ve sistem çubuğu dönüşü bakımından yeniden kontrol edilir.
