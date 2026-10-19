# Android veri güvenliği çalışma kaydı — 19 Ekim 2026

Durum: kaynak envanteri ve Console taslağı; form gönderilmedi. Son aday AAB henüz üretilmedi. Web, Android ve gelecekteki iOS aynı API'yi kullanır; Android formu Android'den gerçekten erişilen veri akışına göre doldurulur. Önceki AAB'nin kaynak fingerprint'i yeni silme/UGC değişikliklerini kapsamaz.

## Resmi sınır

[Google Data safety açıklaması](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en) 19 Ekim yeniden okundu: geliştiricinin denetlediği WebView ve SDK akışları kapsamdadır. Yalnız cihazda kalan veri ayrı değerlendirilir; takma kimlik anonimlik sağlamaz. Geçici işleme ve isteğe bağlılık ayrı sorulardır. Hizmet sağlayıcıya aktarım için paylaşım istisnası otomatik varsayılmaz; amaç ve sözleşme doğrulanır. Internal-only form muafiyeti closed/production sürüme taşınmaz. Bu metin Google'ın uygulamayı onayladığı anlamına gelmez.

## Kodda görülen akışlar

| Veri / Console eşlemesi adayı | Android'de gerçek kaynak ve amaç | Gerekli / isteğe bağlı ve doğrulama |
|---|---|---|
| Kullanıcı adı, komutan adı ve hesap UUID — Name / User IDs | `services/account.ts`, ortak auth/API; giriş, sahiplik, oyun ve güvenlik | Hesapla oyun için gerekli. Gerçek isim istenmiyor; takma ad da envanterde kalır. |
| Kurtarma e-postası — Email address | `accountSecurity`/mail; doğrulama, kurtarma, değişiklik güvenliği; Resend'e teslimat | İsteğe bağlı; adres olmadan hesap/oyun destekleniyor. Resend hizmet sağlayıcı rolü ve gerçek ayarlar son kontrolde doğrulanır. |
| Genel/klan/DM — Other in-app messages | `chat.ts`, `clanChat.ts`, `dm.ts`; mesajlaşma ve moderasyon | Mesaj gönderme isteğe bağlı. Sunucu düz metni işler; TLS, uçtan uca şifreleme anlamına gelmez. |
| Kalıcı sosyal engel ilişkisi — sosyal ilişki/Contacts değerlendirmesi | `community_blocks`, account UUID çiftleri; sohbet güvenliği ve cihaz/sezon kalıcılığı | İsteğe bağlı engel eylemi; ilişki kaldırılana veya hesaplardan biri silinene kadar tutulur. Telefon adres defteri okunmaz. Google formunda uygulama içi ilişki verisinin doğru kategorisi ayrıca doğrulanmalı. |
| Geri bildirim ve şikâyet açıklaması — Other user-generated content | `feedbackEntries`, yeni `contentReports`; destek ve kötüye kullanım inceleme | Kullanıcının isteğiyle. Özel şikâyet kanıtı sunucudan alınır; diğer oyunculara yayımlanmaz. |
| Oyun emirleri, ilerleme, reaksiyon ve zamanlar — Other actions / gerekirse App interactions | Ortak API ve oyun tabloları; oyun işlevi ve güvenlik | Oyun için gerekli durumlar ile isteğe bağlı etkileşimler ayrılır; tek satıra bütün veriler isteğe bağlı yazılmaz. |
| Arama metni — In-app search history değerlendirmesi | DM kişi araması ve benzeri API query parametreleri | Arama kullanımı isteğe bağlı. Kalıcı tablo bulunmaması tek başına ephemeral kanıtı değildir: Nginx/API log query kaydı son aday trafikte kontrol edilmeli. |
| Teknik örnekler — Diagnostics | `lib/perfSession.ts`, `perfSessions`; user-agent, görüntü boyutu, DPR, bellek ipucu, FPS/çizim ölçümleri | Mevcut kayıt adminin elle başlatıp gönderdiği tanı oturumudur; bütün kullanıcılarda arka planda otomatik kayıt var denmez. Sürüm kapsamı ve erişim doğrulanmalı. |
| Bağlantı IP/HTTP izleri | HTTPS proxy/API güvenlik ve işletim kayıtları | Log alanı, rotasyon ve IP'den konum türetilip türetilmediği gerçek dağıtımda incelenmeli. IP görülüyor diye GPS var denmez; konum türetimi varsa ilgili konum türü ayrıca değerlendirilir. |
| Satın alınmış kozmetik/haklar — Purchase history değerlendirmesi | Ortak hesap hakları Android'de görülebilir; web ödeme kayıtları backend'de mevcut | Native checkout/storeBilling kapalı olması bütün satın alma verisi akışını yok saydırmaz. Son APK yanıtları ve hakların görünümü denetlenmeli. Kart alanı/Play Billing SDK bu adayda yok; kanıtsız kart verisi topluyoruz yazılmaz. |
| Medya | Upload/claim sunucuda admin-only; oyuncular admin resim/video/YouTube içeriğini görebiliyor | Normal oyuncuya fotoğraf/video yükleme özelliği varmış gibi beyan yapılmaz. Admin hesaplarının da dağıtılan uygulama kapsamı ve görülen üçüncü taraflar ayrıca değerlendirilir. |

## Native ve üçüncü taraf sınırı

`platform/runtime.ts`: Android için webAnalytics, webAds, webCheckout kapalı; storeBilling, nativeRewardedAds, nativePush, localNotifications de kapalı. `analytics.ts` çalışma anında bu kapıyı kontrol eder. Önceki kabul edilen manifest AD_ID/BILLING/kamera/konum/geniş medya izni içermiyordu; yeni AAB'de yeniden doğrulanacak. Sadece izin listesine bakarak “veri toplanmıyor” seçilmez.

19 Ekim aday kaynakta `thirdPartyEmbeds` capability'si yalnız gerçek web hedefinde açıktır. Android/iOS/diğer native ortamlarda sohbet YouTube iframe'i ve RichContent üçüncü taraf görsel/YouTube içeriği açık dış bağlantıya çevrilir; uzak thumbnail otomatik yüklenmez. Native CSP `frame-src 'none'` uygular. Web embed davranışı korunur. İlgili 217 modül testi ve altı dil/iki genişlik/üç platformdan oluşan 36 browser durumu geçti; yeni AAB ve gerçek cihaz ağ kabulü henüz yapılmadı. [Uygulama ve resmî araştırma](mobile-third-party-media-2026-10-19.md). Native AdMob SDK olmaması tek başına “reklam yok/veri yok” cevabını belirlemez; final paket ve uygulama içinden erişilen akışlar doğrulanmalıdır.

Native refresh kimliği Java güvenli depoda tutulur; JS'ye uzun ömürlü refresh verilmez (`platform/authTransport.ts`, Android session modülü). Bu kayıt tek başına Google'ın Device IDs kategorisi değildir; cihaz tanımlama amacı ve dışarı gönderilen alanlar incelenmelidir. Dil/ses/grafik tercihleri cihazda tutulur; API/SDK'ye gönderilen bir kopyası varsa ayrıca kapsama girer.

## Silme ve güvenlik cevaplarının kabulü

- “Veri aktarımı şifreli” ancak production HTTPS/WSS, media, embed ve yeni paket ağ kabulüyle doğrulanır. Private storage at-rest güvencesi ile ağ TLS'i farklıdır.
- “Silme talebi sunuluyor” yeni uygulama içi akış ve `https://asteraonline.space/account-deletion.html` (TR: `/hesap-silme.html`) canlıda yeni sürümle çalıştıktan sonra işaretlenir. Şu an kaynak dosyalarının varlığı production kabulü değildir.
- Başkasının şikâyetiyle saklanan özel kanıt en fazla30gün; raporun hesap bağlantısı kaldırılır. Kendi şikâyetleri hesapla silinir. Rutin yedeklerin ayrı30gün süresi, ortak tarihçe ve asgari ödeme kaydı istisnaları silme sayfasında açıklanır. Worker/cron kesintisi süreyi uzatabilir; gözlem ve alarm gerekir.
- MASA/bağımsız güvenlik incelemesi veya Families uyumluluğu için dış onay alınmadı; kendi testlerimizi bu rozetlere denk sayma.

## Son adayda kapanacak işler

Bu belge yalnız taslaktır. Yeni kaynak fingerprint'i, sürüm kodu, manifest/SDK dökümü ve gerçek ağ kabulü eklenecek. Üçüncü taraf YouTube/reklam kararı, log envanteri, veri türü başına amaç/isteğe bağlılık/paylaşım yanıtları ve canlı silme/policy URL'leri doğrulanacak. Sonra Console formu aynı adayla doldurulacak; native reklam/IAP/push eklenen her sürümde envanter tekrar açılır. Gizli anahtar, parolalar ve inceleme hesabı parolası bu belgeye yazılmaz.

Topluluk kuralları kabul kaydı: account UUID, güncel kural sürümü, arayüz dili ve kabul zamanı; uygulama işlevi/güvenlik amacı, hesap silmeyle cascade. Reklam/çerez onayı değildir; diğer oyunculara paylaşılmaz. Console veri türü ve amaç eşlemesi son paketle birlikte doğrulanacak.


19 Ekim ek resmî araştırma: [YouTube embed/privacy-enhanced](https://support.google.com/youtube/answer/171780?hl=en), [embedded video reklamları](https://support.google.com/youtube/answer/132596?hl=en), [Play inceleme/ads beyanı](https://support.google.com/googleplay/android-developer/answer/9859455?hl=en). YouTube'un privacy-enhanced/nocookie oynatıcısı reklamları garanti olarak kaldırmaz; reklam sunulursa kişiselleştirilmemiş olabilir. Yeni aday native kaynakta otomatik embed kapalıdır; normal web sohbeti embed'i korur. Admin şikâyet incelemesindeki YouTube yolu tüm hedeflerde açık dış bağlantıdır. Kaynak/browser kabulü canlıya dağıtım veya yeni paket ağ kabulü değildir.
