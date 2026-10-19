# Native uygulamada üçüncü taraf medya — 19 Ekim 2026

## Gereksinim ve araştırma

İlk Android sürümünde AdMob, web reklamı ve web analitiği kapalıdır. Buna rağmen sohbetin YouTube iframe'i ve duyuruların zengin HTML'i üçüncü taraf ağ isteği başlatabiliyor. `RichContent` herhangi bir HTTPS görseline izin veriyor; bu kaynak envanterde ayrıca ele alınmalı. Kullanıcı bir dış bağlantıyı seçmeden native uygulama bu sağlayıcılarla bağlantı kurmamalı.

Resmî kaynaklar: [YouTube embed ve privacy-enhanced mode](https://support.google.com/youtube/answer/171780?hl=en), [embedded video reklamları](https://support.google.com/youtube/answer/132596?hl=en), [Play reklam beyanı](https://support.google.com/googleplay/android-developer/answer/9859455?hl=en), [Android WebViewClient](https://developer.android.com/reference/android/webkit/WebViewClient).

`youtube-nocookie.com` reklamların yokluğu anlamına gelmez. Android belgesi `shouldOverrideUrlLoading` çağrısının alt çerçevelerde de oluşabileceğini açıklar. Kurulu Capacitor8.5.3 Android kaynaklarında BridgeWebViewClient bu çağrıyı doğrudan Bridge.launchIntent'e geçiriyor; app/allowNavigation dışı URL ACTION_VIEW ile dışarı açılabiliyor. Bu, kendiliğinden iframe başlatmayı native ortamda özellikle uygunsuz kılar. Gerçek telefonda bu yeni davranış henüz doğrulanmadı; kaynak incelemesi cihaz kabulü değildir.

## Uygulama ve etki sınırı

- Ortak platform capability'si üçüncü taraf embed'lerini yalnız gerçek web + web build durumunda açacak. Android, gelecekteki iOS, bilinmeyen native runtime ve native bundle/browser uyuşmazlığında kapalı kalacak.
- Native YouTube sohbet eki iframe veya uzaktaki thumbnail oluşturmayacak. Açıkça YouTube'a yönlendiren erişilebilir bağlantı ve dış hizmet/reklam/veri açıklaması gösterilecek.
- Duyuru HTML'inin native gösteriminde onaylı YouTube iframe'leri ve harici görseller güvenli dış bağlantı olacak. Yerel ve güvenilir birinci taraf görsellerin yolu korunacak. Script/olay/javascript URL/unsafe frame temizleme kuralları gevşetilmeyecek.
- Native CSP üçüncü taraf frame'i açmayacak. Eski duyurular için boş alan yerine okunabilir bağlantı sunulacak. Üçüncü taraf medyayı yerel sunucuya kopyalama/proxy yapma yok.
- Web'in mevcut embed/sanitize davranışı ve birinci taraf özel sohbet medyasının bearer/byte sınırı/cleanup davranışı korunacak. Web çerez/üçüncü taraf tercihleri ayrı kapsamda değerlendirilir; bu değişiklik web için genel bir uyumluluk onayı değildir.
- Backend veri/mülkiyet/savaş kuralları, native reklam SDK'sı ve dijital satın alma kapsamı değişmez.

Önce gerçek RED: Android/iOS/runtime-build uyuşmazlığı, native sohbet/duyuru, uzak görsel, güvenli fallback, web geriye uyumluluk, native CSP. Ardından uygulama, ilgili medya/platform/bundle/duyuru regresyonu, altı dil 350px/desktop gerçek browser ve yeni APK'de dış bağlantı/geri dönüş kabulü. Son paket ağı görülmeden Console'da “reklam yok/paylaşım yok” otomatik işaretlenmez.

İlk gerçekRED6FAIL →7dosya216PASS (sohbet89, i18n102, nativemediaattachment5, yeninativeexternal6, platform9, richcontent2, bundlehtml3). Sonuç önceki6vakaya aittir. İncelemede tersbölü çizgili `/\\evil.example/...` URL’sinin yerelpathsanılması ek gerçekRED ile yakalandı; pathguard tersbölüyü reddedecek biçimde düzeltildi, ek vaka dahilGREENhenüztekrarlanmadı. Loglar `/tmp/astera-native-external-media-red.log`, `/tmp/astera-native-external-media-green.log`, `/tmp/astera-native-external-image-path-red.log`.
