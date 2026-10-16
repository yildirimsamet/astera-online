# İsteğe bağlı doğrulanmış e-posta, e-posta ile giriş ve parola kurtarma

Tarih: 2026-10-16. Kod inceleme tabanı: `79029382`.
Durum: Uygulama, ayrıntılı CR ve yerel kalite kontrolleri tamamlandı (2026-10-16–17). Backend, arayüz ve testler eklendi; doğrulama ve operasyon notları bu dosyanın sonundadır. [CR bulguları ve kanıtları](account-email-recovery-review-2026-10-16.md). DNS/domain/webhook ve gerçek teslimat kontrolleri bekliyor; canlı gönderim henüz açılmadı.

## 1. Soğuk agent için başlangıç

Önce `CLAUDE.md`, ardından bu dosyayı oku. Mimari için `docs/architecture.md`, uygulama/test kuralları için `docs/engineering-standards.md`, arayüz için `docs/interface.md` ve `docs/ux-writing.md` kullan. Manual'ın referans verdiği `docs/decisions.md` inceleme sırasında çalışma ağacında yoktu; varmış gibi bir karar numarası uydurma. Kod ve testler mevcut davranışın kaynağıdır.

Bu planın amacı onboarding'i değiştirmeden mevcut hesaba isteğe bağlı, doğrulanmış bir e-posta bağlamak; doğrulama sonrasında giriş kimliğini e-postaya geçirmek ve unutulan parolayı kurtarabilmektir. Yeni hesap yaratma, hesap taşıma veya oyuncunun galaksisini yeniden oluşturma yok.

Uygulama TDD ile başlatıldı; mevcut kodu yeniden yazmaya başlama. Devralırken önce Bölüm 13'teki gerçekleşen işler ve doğrulama durumunu oku, kalan işi oradan seç. Bölüm 3–11 başlangıç tasarımını ve kabul koşullarını korur. Provider/DNS hazırlığı tamamlanmadan fake mailer ile geliştirme ve test yapılabilir. DNS ve gerçek teslimat doğrulanmadan production özelliğini açma. Kullanıcı planın ardından uygulamayı başlatmayı yetkilendirdi. Production yayını veya gerçek kullanıcılara test maili bu dosyayla otomatik yetkilendirilmez.

Çalışma ağacında önceden değiştirilmiş `docs/mobile-store-release-checklist-2026-10-16.md` vardı; sahibinin değişikliklerini koru. `.env` sırlarını okuma/yazdırma, commit etme.

## 2. Kullanıcıyla netleşmiş kararlar

| Konu | Karar |
| --- | --- |
| Kayıt | Mevcut onboarding → kullanıcı adı/parola → ana galaksi akışı korunacak. Kayıtta e-posta istenmeyecek. |
| Zorunluluk | E-posta eklemek tamamen isteğe bağlı. Eklemeyen oyuncunun oyun özellikleri kısıtlanmayacak. |
| Hatırlatma | Ana galaksiye geçtikten sonra menüde dikkat çeken kırmızı e-posta/kurtarma satırı gösterilecek. Renk yanında durum metni ve ikon da olacak. |
| İlk doğrulama sonrası giriş | **Yalnız e-posta + mevcut parola. Kullanıcı adıyla giriş kapanacak.** Kullanıcının “sadece e-posta ile” isteği giriş tanımlayıcısına uygulanır; şifresiz/magic-link giriş istenmedi. |
| Geçişin anlatımı | Doğrulamadan önce sonuç açıkça anlatılacak. Tamamlandığında bütün eski oturumlar iptal edilecek, giriş ekranında güçlü ve kalıcı geçiş mesajı gösterilecek. |
| Komutan adı | Aynı kalır; `username`, `displayName`, account/player UUID'leri değiştirilmez. Doğrulanmış hesapta herkese görünen ad artık giriş anahtarı değildir. |
| Benzersizlik | Bir doğrulanmış e-posta yalnız bir hesaba bağlanabilir. Bir hesabın tek etkin doğrulanmış adresi olur. |
| E-posta değişimi | Mevcut parola + eski e-postanın kodu + yeni e-postanın doğrulanması gerekir. |
| E-posta kaldırma | Doğrulanmış adres tamamen kaldırılamaz; başka doğrulanmış adresle değiştirilebilir. Kullanıcı adıyla girişe geri dönüş yok. Hesap/veri silme süreci ayrı kalır. |
| Eski posta kutusu kayıpsa | Otomatik e-posta değiştirme yolu yok. Destek adresine ulaşmak sahiplik kanıtı sayılmaz; otomatik kurtarma garantisi verilmeyecek. |
| Gönderim | Düşük mevcut kullanım ve ücretsiz tercih nedeniyle **Resend Free**. Destek kutusu Hostinger'da kalır. |
| Sır hazırlığı | Kullanıcı `RESEND_API_KEY` değerini yerel `.env` dosyasına ekledi. Değeri gösterilmedi. Uygulama sırasında yapılan salt okunur domain sorgusu anahtarın yalnız gönderim yetkili olduğunu doğruladı; detay Bölüm 13'te. |
| Web ve mobil | Aynı akış Capacitor içinde de kullanılabilmeli. Önerilen ve bu planda esas alınan yöntem **6 haneli e-posta kodu**. |

Ürün kararlarında açık engel kalmadı. DNS erişimi, Resend domain onayı ve production secret aktarımı operasyonel hazırlıktır; Bölüm 12'de listelenmiştir. Kod süresi, limitler, dosya adları ve gönderici alt alan adı aşağıda belirlenen mühendislik varsayımlarıdır; güvenlik sözleşmesini koruyarak uygulamada iyileştirilebilir.

Kapsam dışında: SMS, sosyal giriş, 2FA, her girişte OTP, pazarlama mailleri, komutan adı değiştirme, onboarding yeniden tasarımı, ödeme sağlayıcısının müşteri e-postasını hesaba otomatik bağlamak. E-posta eklememiş hesapların komutan adı hâlâ giriş tanımlayıcısıdır; bütün oyuncuların kimlik görünürlüğü çözüldü diye sunma. Giriş adının gizli olması tek başına bir kimlik doğrulama savunması değildir.

## 3. Mevcut koddan doğrulanan durum ve değişiklik haritası

| Dosya / alan | Mevcut durum ve yapılacak iş |
| --- | --- |
| `apps/server/src/db/schema.ts` → `accounts` | Nullable, kullanılmayan `email` ve `accounts_email_idx` unique index zaten var. `username`, `passwordHash`, `displayName` mevcut. Yeni bir paralel accounts tablosu kurma. |
| `apps/server/src/services/account.ts` | `registerAccount` displayName'i yazılan kullanıcı adından üretir; `authenticate` yalnız normalize username arar. Bilinmeyen isim için decoy scrypt var. E-posta/kullanıcı adı koşullu giriş ve yarış koruması burada. |
| `apps/server/src/auth/credentials.ts` | Username Unicode/NFKC/lowercase; parola 8–200 karakter. E-posta normalizasyonunu username normalizasyonuyla karıştırma. Yeni parola da mevcut passwordSchema/hashPassword kullanır. |
| `apps/server/src/auth/tokens.ts` | HS256 access/refresh JWT; varsayılan 15 dakika/30 gün, hesap bazında iptal yok. Dosyadaki guest-first yorumları güncel kayıt davranışını anlatmıyor; değişen auth yorumlarını güncelle. |
| `apps/server/src/routes/auth.ts` | Register/login/refresh/me/logout, `openSession`, `requireAuth`, `optionalAuth`. Logout yalnız cookie siler. `openSession`, onboarding claim tarafından da kullanılır. |
| `apps/server/src/app.ts` | Rate-limit `keyGenerator`, JWT doğrulayıp **`req.accountId` atıyor**; `requireAuth` bunu görünce erken dönebiliyor. Sadece requireAuth içine version kontrolü koymak bypass bırakır. |
| `apps/server/src/services/rateLimitBackend.ts`, `env.ts` | Valkey ile üç API replikası arasında paylaşılan limit altyapısı var. Güvenlik uçlarında fail-closed; gameplay politikasını değiştirme. |
| `apps/server/src/routes/session.ts` | `/api/stream` girişte auth kontrolü yapar, açık SSE için sonradan auth iptali kontrolü yok. Her event tesliminde placement DB kontrolü mevcut. |
| `apps/server/src/services/placementGate.ts` | Auth istekleri de placement sarmalayıcısına girebiliyor. Yeni hesap güvenliği uçları galaksi taşıması/tatil/placement header yüzünden engellenmemeli; dar ve açık istisna gerekir. |
| `apps/server/src/index.ts`, `app.ts`, `worker/loop.ts` | API/worker rolleri var. Mail gönderimi gameplay event tick'ini bekletmemeli. Kendi küçük outbox döngüsü aynı worker sürecinde çalışabilir. |
| `apps/server/src/routes/polar.ts` | Route scope içinde ham JSON ve imza doğrulama örneği var. Resend webhook'u için aynı izolasyon yaklaşımı; tüm uygulamanın JSON parser'ını değiştirme. |
| `apps/web/src/screens/LandingScreen.tsx` | Login formu bu dosyada. “Kullanıcı adı veya e-posta” alanı, genel geçiş açıklaması, “Parolamı unuttum” girişi burada. |
| `apps/web/src/session/useSession.ts` | Session state machine ve `astera:ready-session` sessionStorage cache'i var. Yeni güvenlik/çıkış akışı burayla uyumlu olmalı. Tam e-postayı mevcut `Me` cache'ine yanlışlıkla yayma. |
| `apps/web/src/api/client.ts`, `schemas.ts`, `keys.ts`, `queries.ts` | Zod response sınırları, refresh/retry ve query invalidation. Hassas endpoint'lerde otomatik replay davranışını açıkça belirle. |
| `apps/web/src/shell/MenuPanel.tsx` | Mevcut Hesap grubu var. E-posta satırı ve detay sheet'ine giriş eklenecek; menü hiyerarşisini bozma. |
| `apps/web/src/screens/GalaxyView.tsx`, `App.tsx`, `shell/panelRoute.ts` | MenuPanel wiring, sheet navigation/back ve oturum geçişi. Geri tuşu menüye döndürmeli. |
| `apps/web/src/onboarding/ClaimDialog.tsx`, `apps/server/src/routes/onboarding.ts` | Kayıt/onboarding bozulmadığını doğrula; e-posta alanı ekleme. |
| `apps/web/src/i18n/locales/{tr,en,de,fr,es,ja}/` | Login/menü/hata/kod akışlarını bütün desteklenen dillere ekle. Locale yapısını incele; yalnız TR/EN bırakma. |
| `apps/web/public/privacy.html`, `kvkk-aydinlatma-metni.html`, `cookies.html` | İsteğe bağlı e-posta, hesap güvenliği amacı, mail sağlayıcısı, saklama ve varsa yeni yerel metadata kayıtlarını gerçek uygulamayla uyumlu güncelle. Hukuki kesinlik uydurma. |
| `.env*.example`, `docker-compose.prod.yml`, `docker-compose.stage.yml`, `docs/deployment.md` | Placeholder config, secret aktarımı, rollere göre env, migration/rollout/rollback runbook. |
| `apps/web/capacitor.config.ts` | Repoda **yalnız yerel debug wrapper** zaten var. Production app hazır değil. `api/client.ts` credentials=`same-origin`; OTP seçimi gelecekteki cross-origin cookie mimarisini kendiliğinden çözmez. |

Mevcut test dayanakları: `apps/server/test/auth.test.ts`, `ratelimit.test.ts`, `stream.test.ts`, `stream-frames.test.ts`, `onboarding.test.ts`, `schema-drift.test.ts`, `helpers.ts`; `apps/web/test/session-machine.test.tsx`, `onboarding.test.tsx`, `academy-session.test.tsx`, `menu-structure.test.tsx`, `menu-guide.test.tsx`, `event-stream.test.tsx`, `mobile-android.test.ts`.

## 4. Gönderim servisi ve alan adı

2026-10-16 tarihinde resmî kaynaklarla kontrol edilen seçenekler:

| Seçenek | Maliyet/kısıt ve değerlendirme |
| --- | --- |
| **Resend Free — seçilen** | 3.000 ileti/ay, en fazla 100/gün. API, imzalı webhook, domain doğrulama. Mevcut küçük kullanım için yeterli başlangıç; 300 oyuncunun aynı gün doğrulama yapmasına yetmez. |
| Resend Pro | Resmî karşılaştırmada 50.000 ileti/ay için 20 USD/ay; günlük ücretsiz paket sınırı kalkar. Bu plan ücretli abonelik veya otomatik yükseltme açmaz. |
| Postmark | Ücretsiz geliştirme paketi 100 ileti/ay; 10.000 ileti için Basic 15 USD/ay. Ücretsiz üretim ihtiyacında Resend daha uygun. |
| Amazon SES | Güncel yeni Essentials tarifesi ilk hacim diliminde 1.000 ileti başına 0,16 USD; ek özellikler ayrıca ücretlenebilir. Eski “her zaman 0,10 USD” bilgisini kopyalama. Sandbox/production erişimi ve AWS operasyonu gerekir; bu proje için ilk tercih değil. |
| Hostinger SMTP | Mevcut kutudan teknik olarak gönderilebilir; mevcut paketinin gönderim limitleri ve otomatik işlem e-postası koşulları ayrıca doğrulanmalı. Kutunun varlığı sınırsız transactional gönderim hakkı değildir. |
| Kendi SMTP sunucumuz | Mümkün; PTR/rDNS, DKIM/SPF/DMARC, IP itibarı, kuyruk, bounce ve şikâyet yönetimi bize kalır. Düşük hacimde maliyet avantajı bakım yükünü karşılamaz; yapılmayacak. |

Kaynaklar: [Resend fiyatlar](https://resend.com/pricing), [Resend resmî hacim/fiyat karşılaştırması](https://resend.com/migrate/sendgrid), [Postmark fiyatlar](https://postmarkapp.com/pricing), [Postmark başlangıç planı](https://postmarkapp.com/why), [SES fiyatlar](https://aws.amazon.com/ses/pricing/), [SES sandbox](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html), [Gmail gönderici gereksinimleri](https://support.google.com/mail/answer/81126?hl=en). Uygulama/canlıya çıkış gününde kota ve fiyatı yeniden kontrol et.

Public DNS sorgusu sonucu: MX `mx1.hostinger.com` / `mx2.hostinger.com`; SPF `include:_spf.mail.hostinger.com`; DMARC `p=none`. Kullanıcı da kutunun Hostinger'da olması gerektiğini belirtti. Bu gözlem Resend domain doğrulaması veya DNS yönetim erişimi bulunduğu anlamına gelmez.

Önerilen gönderici: `Astera Online <security@account.asteraonline.space>`; `Reply-To: support@asteraonline.space`. Alternatif olarak kök domain doğrulanarak support adresinden de gönderilebilir, fakat seçilen tasarım hesap maillerini ayrı alt alanda tutar. Gönderici adresi için Hostinger'da yeni bir mailbox almak gerekmez; domain gönderim yetkisi ve cevapların support'a gitmesi yeterlidir.

1. Resend'de `account.asteraonline.space` sending domain ekle; dashboard'un verdiği gerçek DKIM/SPF/Return-Path kayıtlarını kullan.
2. Kök domain'in Hostinger MX'lerini değiştirme. Aynı DNS adı altında ikinci `v=spf1` kaydı yaratma. Alt alanın DMARC alignment'ını kontrol et; mevcut posta akışını test etmeden kök DMARC politikasını sertleştirme.
3. Transactional mailde open/click tracking kapalı olsun. Minimum yetkili, yalnız gönderime yetkili API anahtarı kullan; API key web bundle'a/`VITE_*` değişkenlerine girmez.
4. Signed webhook için ayrı secret gerekir; `RESEND_API_KEY` bunun yerine geçmez. API key'in yerel `.env` içinde bulunması production container'a geçtiği anlamına gelmez.
5. Kota dashboard/alarm: günlük ve aylık tüketim, gönderim kabulü, bounce, complaint, delivery delay. İlk yayın bütün oyunculara otomatik mail atmayacak; yalnız oyuncunun başlattığı istekler gönderilir.

Kaynak: [Resend domain ve alt alan modeli](https://resend.com/docs/dashboard/domains/introduction). Inbox'a kesin teslim garantisi verme; API kabulü, teslim ve kullanıcı doğrulaması ayrı durumlardır.

## 5. Oyuncu deneyimi ve kod kararı

### 5.1 Neden kod?

6 haneli kod web/PWA/Capacitor'da aynı ekrana girilir; deep-link yönlendirmesi veya farklı tarayıcı cookie'sine bağımlı değildir. Mail başka cihazda da açılabilir. İlk sürümde doğrulama/reset linki ve OTP'yi aynı anda sunma: iki ayrı güvenlik/geri dönüş akışı oluşur. Maile normal yardım/oyun bağlantısı konabilir, fakat bağlantıda doğrulama yetkisi bulunmaz.

Linkle native uygulamaya dönüş için iOS Universal Links, Android App Links, site association dosyaları ve app URL yönlendirmesi gerekir. Bunlar ileride ayrıca yapılabilir; bu özelliğin ön şartı değil. [Capacitor deep-link belgeleri](https://capacitorjs.com/docs/guides/deep-links)

Kod alanı tek gerçek input olsun: `type=text`, `inputMode=numeric`, `autoComplete=one-time-code`, 6 ASCII rakam; baştaki sıfır kaybolmaz. Altı ayrı odaklanan kutu kullanma. Tek paste, klavye Enter ve açık “Doğrula” butonu desteklenir. Otomatik doldurma destekleyen cihazlarda yardımcı olur; e-posta OTP autofill her browser/WebView'da garanti değildir. Clipboard okuma izni veya SMS WebOTP bağımlılığı ekleme. [HTML autocomplete](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/autocomplete)

### 5.2 Menü ve ilk e-posta

- Onboarding/rehearsal sırasında mail uyarısı veya zorunlu modal yok. Gerçek hesaba ve galaksiye geçince menüde Hesap güvenliği satırı görünür. Eski hesaplar da aynı davranışı alır.
- E-posta yok: kırmızı ton + uyarı ikonu + **“Kurtarma e-postası yok”**, eylem **“E-posta ekle”**. Menü düğmesinde küçük uyarı noktası olabilir; yanıp sönen alarm veya sürekli popup yok.
- Metin: **“E-posta eklemek isteğe bağlı. Parolanı unutursan doğrulanmış e-posta olmadan sıfırlayamazsın.”** “E-posta olmadan hiçbir zaman parola değiştiremezsin” deme: mevcut parolasını bilen oyuncunun parola değiştirmesi başka işlemdir.
- Form: e-posta + mevcut parola. Öncesinde görünür sonuç: **“E-postanı doğruladıktan sonra bu adres ve mevcut parolanla giriş yapacaksın. Kullanıcı adınla giriş kapanacak. Komutan adın değişmeyecek.”** Doğrulanmış adresin yalnız değiştirilebildiğini, kaldırılamadığını da burada belirt.
- Kod isteği başarılı şekilde sıraya alınır. Pending durumunda “Doğrulama bekleniyor”; “Onaylı” veya “hesabın kurtarılabilir” denmez. Hatalı adresi düzeltme, tekrar gönderme ve bekleyen işlemi iptal etme vardır.
- Doğru kod sonrası tek transaction e-postayı bağlar, authVersion artırır, ilgili işlemleri iptal eder. Sonrasında cookie temizlenir; bütün eski oturumlar geçersizleşir. Başarı ekranı: **“E-postan doğrulandı. Artık [adres] ve mevcut parolanla giriş yap. Kullanıcı adınla giriş kapatıldı.”** Bu mesaj geçici toast'a indirgenmez.
- Kullanıcı yeniden girişe yönlendirilir, e-posta aynı tab'da yalnız geçici state ile doldurulabilir. Parola yeniden istenir. Yeni access/refresh token otomatik verilmez. Başka hesaba geçişte state temizlenir.
- Doğrulanmış durumda menüde maskelemiş adres + “Doğrulandı” + “E-postayı değiştir”. Adresi tamamen görmek yalnız özel hesap sheet'inde sunulur.
- Sadece galaksi UI'sine güvenme: galaksi seçme ekranına dönen mevcut hesap da hesap güvenliği ayarına ulaşabilmeli. Backend'de email işlemleri player/season varlığı istemez.

### 5.3 Giriş

Tek alan etiketi **“Kullanıcı adı veya e-posta”**, altında genel açıklama **“E-postanı doğruladıysan e-posta adresinle giriş yap.”** İkinci alan parola. Username Unicode/boşluk desteklediğinden alanı `type=email` yapma; `autocomplete=username`, parola `current-password` olabilir. Mevcut frontend `maxLength=64` ve server `loginBody.username.max(64)` e-posta için yeterli değildir: yeni identifier sınırı 254'e çıkarılır, username kolunda mevcut kurallar korunur. Eski payload alanını kabul eden compatibility kolu da 254 karakterlik e-postayı taşıyabilmeli. Login için güncellenmiş input olmadan uzun adresli hesaplar doğrulamaya geçirilmez.

| Hesap durumu | Kullanıcı adı + doğru parola | E-posta + doğru parola |
| --- | --- | --- |
| E-posta yok / yalnız pending | Kabul | Ret |
| Doğrulanmış e-posta | **Ret** | Kabul |
| E-posta değişimi pending | Ret | Eski doğrulanmış adres kabul; yeni adres ret |
| Değişim tamam | Ret | Yeni adres kabul; eski adres ret |

Yanlış parola, olmayan hesap, doğrulanmamış adres ve doğrulanmış hesapta username denemesi aynı `BAD_CREDENTIALS` yanıtını verir. Mevcut decoy scrypt yaklaşımı yeni lookup ve kabul edilmeyen login-mode yollarında da korunur; ucuz erken dönüşle yeni timing oracle oluşturma. Username yazan herkese “bu hesap e-postaya geçti” gibi hesap bazlı bilgi veya maskeli e-posta gösterme. Genel açıklama herkese görünür; yalnız doğrulamayı yapan oyuncu özel geçiş mesajını alır.

### 5.4 Parolamı unuttum

1. Login sheet'inde “Parolamı unuttum” → e-posta alanı. Username istenmez.
2. Her sözdizimsel olarak geçerli adres için aynı genel cevap: **“Bu adrese bağlı doğrulanmış bir hesap varsa sıfırlama kodu göndereceğiz. Spam klasörünü de kontrol et.”** Yok/var/pending/suppressed ayrımı halka açılmaz.
3. Kod + yeni parola + yeni parola tekrarı ekranı. Kod doğrulaması ve yeni parola yazımı tek sunucu tamamlama işlemi olur; ayrı sınırsız reset yetkisi oluşturma. Parola görünürlüğü toggle'ı ve `autocomplete=new-password` kullan.
4. Başarı: parola değişti, tüm eski oturumlar ve diğer reset/email-change işlemleri iptal edildi, kullanıcı normal e-posta/parola girişine döner. Otomatik login yok. Doğrulanmış adrese güvenlik bildirimi gönderilir; bildirim hatası başarılı reset'i geri almaz.
5. E-postası olmayan kullanıcı için “Daha önce e-posta doğrulamadıysan bu yöntemle parolanı sıfırlayamazsın.” Kullanıcı adı, komutan adı, IP, ekran görüntüsü veya oyun bilgisi ile otomatik sahiplik doğrulaması yapılmaz.

### 5.5 E-posta değiştirme

Başlangıç mevcut parola + yeni adres alır; önce **eski adrese** gönderilen kod doğrulanır, sonra **yeni adrese** kod gönderilir. İki ayrı purpose, aynı operation; eski kod yeni adresi doğrulayamaz. Yeni adresi değiştirmek veya işlemi yeniden başlatmak eski onayı da sıfırlar.

Eski adres son adıma kadar giriş/kurtarma adresidir. Yeni adres doğrulandığı transaction'da unique constraint ile swap yapılır, authVersion artar, bütün reset ve diğer e-posta işlemleri iptal edilir. Eski ve yeni adrese değişiklik bildirimi; tüm oturumlar kapanır, yeni adresle giriş mesajı gösterilir. Son anda yeni adres başka hesaba bağlanmışsa işlem kontrollü reddedilir; eski adres korunur. Eski posta kutusuna erişemeyen kullanıcıya doğrulanamayacak bir alternatif yol vaat edilmez.

### 5.6 Mobilde akışı koruma

Mail uygulamasına gidip dönünce kod ekranı sıfırlanmaz. Hesaba bağlı pending işlem durumu sunucudan alınır; code/password saklanmaz. Reset için yalnız opaque challenge ID, amaç, expiry ve ekran adımı gibi yetki vermeyen metadata kısa süreli sessionStorage'da tutulabilir; kalıcı localStorage'a mail/parola/kod yazılmaz. Tam uygulama/process kaybında metadata yoksa e-postayla akış güvenli yeniden başlatılır; hesap veya oyun ilerlemesi kaybolmaz. Sunucu expire zamanını kontrol eder; countdown yalnız gösterimdir.

350 px genişlik, klavye açıkken buton erişimi, Android geri tuşu, sheet → menü geri dönüşü, paste, baştaki sıfır, uygulamadan çık/dön, düşük bağlantı ve eski client sürümü test edilir. Mevcut debug Capacitor wrapper'da gözle kontrol yapılabilir; future production cookie/CORS/Secure/SameSite konfigürasyonu ayrı mobil release doğrulamasıdır.

## 6. Veri modeli ve invariants

### 6.1 Accounts

- `email`: yalnız **etkin ve doğrulanmış**, normalize adres. Pending adres bu alana asla yazılmaz.
- `emailVerifiedAt`: nullable timestamp. `email` ile beraber null veya beraber dolu olmak DB check constraint ile korunur.
- `authVersion`: integer, not-null, default 0, nonnegative. İlk e-posta doğrulaması, adres değişimi ve parola değişimi/sıfırlaması sırasında atomik artar.
- Login modu ayrıca değişebilen boolean olarak saklanmaz; doğrulanmış e-posta varlığından türetilir. Username/displayName durur; `ADMIN_USERNAMES` ve admin yetkileri e-postaya taşınmaz.
- Unique index normalize etkin e-postada olur. Uygulama doğrulamasına ek olarak DB canonical biçim constraint'i veya normalize unique expression kullan; doğrudan yazımla case duplikasyonu oluşmasın.

Normalizasyon sözleşmesi: dış boşluğu trim, domain'i küçük harfe dönüştür; ürün genelinde adresi case-insensitive eşleştirmek için local-part da küçük harfe dönüştürülür. Bu bilinçli ürün politikasıdır; bütün mail sağlayıcılarının local-part kuralları böyleymiş gibi anlatma. `+tag` veya Gmail noktalarını silme; ayrı alias'ların aynı posta kutusuna düşmesini çözmek/multi-account engellemek bu kapsamda değil. İlk sürüm ASCII local-part, ASCII/punycode domain desteklesin; uluslararası adres desteğini sessizce bozma, desteklenmeyen biçime anlaşılır hata ver. Uzunluk en fazla 254, tek adres, header CR/LF injection reddi. Normalizasyon register-email/login/reset/change için aynı fonksiyondan geçer.

Migration öncesi mevcut non-null e-posta sayısı, boş/geçersiz adresler ve normalize çakışma sayısı raporlanır; gerçek adresleri loglama. Hiçbiri kendiliğinden doğrulanmış sayılmaz. İncelenen kod bu alanı kullanmıyor ama production DB okunmadı. Non-null legacy veri varsa ayrı geçici legacy storage'a kayıpsız taşı, etkin email alanını null bırak; sahiplik doğrulanmadan login modunu değiştirme. Çakışma varsa migration durur, sessiz hesap birleştirme yok. Önce nullable/default'lu eklemeler, sonra veri temizliği/constraint; eski migration dosyaları değiştirilmez.

### 6.2 Security operations / challenges

İsimler uygulamada seçilebilir; aşağıdaki bilgiler gereklidir:

- Opaque random operation/challenge ID (en az 128 bit entropy), accountId FK, purpose (`email_bind`, `email_change_old`, `email_change_new`, `password_reset`), normalize hedef, varsa operation group ID.
- Oluşturulurken okunan `authVersion`; değişim için beklenen eski adres. Stage, createdAt, expiresAt, consumedAt/cancelledAt, attempts ve mail dispatch referansı.
- **6 rakam**, kriptografik RNG; 10 dakika geçerli. Maksimum 5 yanlış kod denemesi/challenge. `Math.random` yok. Expiry eşitliği expired sayılır.
- DB'de düz kod veya yalnız `SHA256(code)` yok: kısa kod offline brute-force'a açıktır. Ayrı server secret ile HMAC-SHA256; girdiye challengeId, purpose, accountId, hedef ve code dahil edilir; sabit uzunluk/timing-safe karşılaştırma.
- Eski/yeni adres doğrulamasının toplam operation süresi en fazla 30 dakika; her kodun 10 dakikalık kendi süresi var. Stage geçince eski kod tüketilir. Yeni stage kod süresini ve toplam süreyi aşamaz.
- Hesap başına bir aktif email-bind/change operation; yeni istek önceki operation'ı iptal eder. Reset'te yeni kod eski kodu geçersiz kılar. Resend aggregate deneme/send limitlerini sıfırlamaz.
- Pending adres global unique rezerve edilmez. Aksi halde bir saldırgan başka kişinin adresini hiç doğrulamadan bloke edebilir. Son bağlama DB unique constraint'i kazananı belirler.
- Başkasının challenge'ı, yanlış amaç, eski authVersion, expired/consumed/cancelled ve yanlış code aynı geçersiz-kod ailesinde reddedilir. Kod tek başına yeterli değildir; işlem kimliği ve gereken auth context de zorunludur.

### 6.3 Atomiklik ve yarışlar

Hesap → operation/challenge → outbox sırasıyla kilitle; bütün yollar aynı sırayı kullanır. Kod tüketimi, e-posta/parola yazımı, authVersion artışı ve diğer işlemlerin iptali tek DB transaction'dır. İki eşzamanlı başarılı tamamlamadan yalnız biri kazanır.

Parola doğrulama/hash maliyetli olduğundan ağ veya scrypt sırasında uzun DB kilidi tutma. Başta credential snapshot al, maliyetli işi transaction dışında yap, transaction'da version/hash snapshot'ının hâlâ güncel olduğunu yeniden kontrol et. Reset'te rastgele yanlış kodlar yeni parola scrypt maliyetini tetiklemesin: önce bounded code/rate kontrolü, hash, sonra transaction'da yeniden kontrol + tek tüketim. Yanlış kod denemesi sayaç artışı exception yüzünden rollback olmamalı; hata sonucu commit edildikten sonra HTTP hatasına çevrilir. Rate-limit'ten kaçmak için başarısız işlemleri rollback etme.

Login veya refresh, reset/e-posta doğrulamasıyla yarışırsa eski credential ile **yeni** authVersion token'ı basılamaz. Authenticate/refresh'in kabul ettiği snapshot/version token issuance'a taşınır; sonradan güncel version'ı körlemesine okuyup imzalama. Önceden doğrulanmış eski isteklerin zaten commit olmuş etkilerini geri almayı vaat etme; yeni auth kabullerini ve güvenlik transaction'larını fence et.

## 7. Oturum iptali — yayın için zorunlu

1. Access ve refresh JWT'ye `ver` claim ekle. TokenService imza/typ/sub/ver shape kontrol eder; ortak auth resolver DB'deki account varlığını ve authVersion eşitliğini kontrol eder.
2. `app.ts` rate-limit keyGenerator, `requireAuth`, `optionalAuth`, refresh ve bütün doğrudan `tokens.verify` çağrıları aynı doğrulanmış kimlik sözleşmesine geçirilecek. `req.accountId` set edilmiş olması tek başına yetki değildir. Request içinde verified identity/version bir kez paylaşılabilir; geçersiz JWT public login/reset yolunu account bucket'a taşımamalı.
3. İlk sürümde durable version lookup kullan; replikalar arası TTL auth cache ile geçersiz token'ı birkaç dakika kabul etme. Tek request içinde tekrarlı lookup önlenebilir. Ölçmeden yeni distributed session store kurma.
4. Eski JWT'de `ver` yoksa yalnız current authVersion=0 hesabında legacy version 0 olarak kabul et. Verification/reset version'ı artırınca bütün legacy token'lar da ölür. Yeni doğrulama açılmadan tüm API replikaları bu kuralı desteklemeli.
5. Açık SSE için giriş version'ını tut; mevcut event teslimindeki placement sorgusuna account version kontrolünü ekle. Her özel frame öncesinde stale oturumu kapat. Idle stream'i heartbeat sırasında da kontrol ederek en geç heartbeat aralığında kapat; DB kontrolü başarısızken özel frame gönderme. Sadece “logout” event'i yayınlamak veya client'ın iyi niyetine güvenmek yetmez.
6. Client terminal auth rejection'da memory accessToken, TanStack Query özel cache, `astera:ready-session`, açık stream ve güvenlik form sırlarını temizleyip login'e döner. 401 → refresh → başarısız refresh sonsuz döngüye dönüşmez. Ağ/5xx hatası “session invalid” ile karıştırılmaz.
7. İlk doğrulama, e-posta değişimi ve reset cevabı cookie temizler. Diğer cihazlardaki cookie fiziksel olarak silinemez ama sunucuda geçersiz olur. Mevcut genel logout davranışını tüm cihazlardan çıkışa dönüştürmek ayrı kapsamdır.

**Önemli rollout sınırı:** Email doğrulandıktan sonra eski username kabul eden server sürümüne rollback etmek güvenlik kararını bozar. İleride mail servisini kapatan feature flag, doğrulanmış hesaplarda username login'i veya eski JWT'leri yeniden açamaz.

## 8. API sözleşmesi ve koruma

Aşağıdaki yollar önerilen uygulanacak sözleşmedir; Zod body/response schemas, strict alanlar, sınırlı body boyu ve mevcut `GameError` yapısı kullanılır.

| Endpoint | Kimlik / body | Sonuç |
| --- | --- | --- |
| `POST /api/auth/login` | Public, `{ identifier, password }` | Username/e-posta koşullu auth. Eski `{ username, password }` client payload'ını uyumluluk için kabul edebilirsin; iki alan birlikte gelirse reddet. Eski alan adıyla email-mode hesabına username bypass yok. |
| `GET /api/auth/security` | Auth | `loginMethod`, masked current email, verifiedAt, pending operation'ın güvenli metadata'sı, capability flags. Özel sheet için gereken current/target adres sadece bu private cevaptan; no-store. |
| `POST /api/auth/email/request` | Auth, `{ email, currentPassword, locale }` | İlk bağlama; mevcut doğrulanmış adres varsa change yoluna yönlendir. `{ challengeId, expiresAt, resendAvailableAt, deliveryStatus }`. |
| `POST /api/auth/email/verify` | Auth, `{ challengeId, code }` | İlk doğrulama + zorunlu logout; `{ ok:true, reauthenticate:true, loginMethod:'email' }`. |
| `POST /api/auth/email/change/request` | Auth, `{ newEmail, currentPassword, locale }` | Eski adrese challenge; aynı adrese change kontrollü no-op/validation. |
| `POST /api/auth/email/change/confirm-old` | Auth, `{ challengeId, code }` | Eski proof tüketilir, yeni adrese challenge sıraya alınır; yeni challenge metadata. |
| `POST /api/auth/email/change/confirm-new` | Auth, `{ challengeId, code }` | Atomic swap + zorunlu logout. |
| `POST /api/auth/email/resend` | Auth, `{ operationId }` | Yalnız güncel stage/hedefe yeni kod; önceki code geçersiz. Current authVersion ve send limits korunur. |
| `POST /api/auth/email/cancel` | Auth, `{ operationId }` | Yalnız pending işlemi kapatır; etkin e-postayı asla kaldırmaz. |
| `POST /api/auth/password/reset/request` | Public, `{ email, locale }` | 202 + aynı response shape; gerçek ve olmayan adres için rastgele görünümlü challengeId ve aynı expiry/cooldown biçimi. |
| `POST /api/auth/password/reset/complete` | Public, `{ challengeId, code, newPassword }` | Atomic reset + logout + bildirim. Password confirmation yalnız UX kontrolü. |
| `POST /api/mail/resend/webhook` | Provider signature, raw body | Delivery/bounce/complaint kaydı; hiçbir event emailVerifiedAt yazamaz. |

Reset yeniden gönderimi aynı public request yolunu kullanır. Public reset challenge ID için farklı uzunluk/prefix, account UUID veya email içerme. Olmayan hesapta gereksiz uzun ömürlü dummy kayıt üretmek zorunlu değil; eşdeğer bounded lookup ve response timing stratejisi uygula, provider çağrısı public HTTP yanıtının süresini belirlemesin. Dışarıda email/account varlığına göre response status, body veya Retry-After ayrımı oluşmasın. Genel IP limitinde 429 verilebilir; hedef bazlı bastırma public reset'te aynı 202 cevabı korur.

Yeni özel security endpoint'leri player placement/tatil gerektirmez. `/api/auth/security`, `/api/auth/email/*`, `/api/auth/password/reset/*` için dar placement-gate istisnası ekle; bütün API'yi bypass etme. Public reset handler'ı client kazara Bearer taşısa bile aynı şekilde çalışır, gameplay placement state'ine bağlanmaz.

`/me` ve onboarding claim içinde yalnız minimum durum eklenebilir: `loginMethod`, `recoveryEmailState: missing|pending|verified`. Tam e-posta, pending adres, kod, authVersion veya secret genel account/public DTO'ya eklenmez. Eski server cevabında alan yoksa client bunu `unknown` kabul eder; yanlış kırmızı “e-posta yok” uyarısı üretmez. Feature kapalıysa eski client/server uyumu devam eder.

Auth/password/email request'leri rate limited; Authorization/cookie/password/code/email request body/Resend error payload'ı log, analytics, feedback ve perf capture'a gitmez. Server `index.ts` kendi Pino instance'ını verdiği için redaction'ı yalnız app.ts default logger'a eklemek yetmez. SQL/provider hataları e-posta içerebilir; ham error objelerini de incele. `Cache-Control: no-store`; sırlar URL/querystring'de olmaz. Bearer-only private endpoints'e cookie ile auth fallback ekleme; mevcut refresh cookie'nin Origin/CSRF davranışını gerçek web/native topolojisinde doğrula. Webhook bu kurala imza doğrulamasıyla ayrı girer.

Başlangıç abuse limitleri (config, oyuncuya açıklanacak oyun kuralı değil):

- Gönderim: aynı account/hedef için 60 sn cooldown, account ve normalize hedef başına toplam 5/saat ve 10/gün; purpose değiştirerek aşılmaz. IP için 20/saat ve 100/gün ilk sınır; CGNAT etkisini ölç.
- Kod: 5 yanlış/challenge; challenge yeniden üretimiyle sıfırlanmayan account/hedef başına toplam 10 yanlış/15 dakika. IP için ayrıca doğrulama 40/dakika. Reset kilidi normal login'i kilitlemez.
- Login: mevcut IP bucket korunur; identifier hash'i başına ek rolling throttle düşünülmeli ve e-posta/username alias ile atlanmamalı. Kalıcı hesap kilidi ekleme.
- Çoklu API için Valkey atomic counters; key'lerde raw e-posta değil ayrı HMAC digest. Kod deneme/consumption atomik DB kontrolü ayrıca var. Rate-limit store kesilince güvenlik gönderim/doğrulama işlemleri fail-closed; gameplay devam eder.
- Günlük/aylık Resend kotasına ortak uygulama sayacı ve dashboard takibi; warning eşiği %80. Ücretsiz kotayı aşınca ödeme/upgrade otomatik değil. Gönderim limitleri bildirimleri de hesaba katar; doğrulama davet spam'i reset trafiğini tüketmesin diye reset için kota rezervi uygula (başlangıç günlük 20 ileti). Resend'in sayaç/periyot saatlerini yeniden doğrula.

Güvenlik dayanağı: [OWASP Forgot Password](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html). Bu plandaki sayısal limitler proje kararıdır; OWASP'ın birebir zorunlu sayıları gibi sunulmaz.

## 9. Mail gönderim mimarisi ve hatalar

Küçük bir `TransactionalMailer` arayüzü ve tek gerçek `ResendMailer` adapter yeterli. Testte inject edilen fake kullan. Aynı anda SMTP/SES/Postmark entegrasyonu veya yeni mikroservis kurma. Server'da typed provider client, timeout ve error sınıflaması; mail şablonları server tarafında. `apps/server` → `apps/web` import yasaktır.

**PostgreSQL outbox:** Challenge ve gönderilecek mail kaydı aynı transaction'da oluşur. Worker claim'i kısa `FOR UPDATE SKIP LOCKED`/lease transaction'ı; HTTP send transaction dışında. Worker'da ayrı bounded mail döngüsü, başlangıç concurrency=1, provider request timeout=5 sn. Gameplay `tick()` maili await etmez; shutdown döngüyü ve pending isteği bounded kapatır.

Outbox gerekli alanları: id, accountId/purpose/challengeId, recipient, template/locale, encrypted payload, status, providerMessageId, attempts, nextAttemptAt, claimedAt/lease, expiresAt, createdAt. Event dedupe için provider webhook event ID unique kayıt. İlk auth şemasını değiştirmeyen bağımsız küçük tablolar tercih edilir; gameplay `scheduled_events` enum'una mail ekleme.

Kod yalnız HMAC olarak saklanırsa retry için mail yeniden oluşturulamaz. Bu nedenle outbox'ta kısa ömürlü gönderim payload'ı **ayrı env anahtarıyla AES-GCM gibi authenticated encryption** altında tutulur; plaintext kod, parola veya tam HTML içindeki kod DB/log'a yazılmaz. Anahtar DB'de değil, salt/digest ile aynı secret değil. Payload send kabulü/terminal iptal/expiry sonrası temizlenir. Challenge tablosu doğrulamayı HMAC ile yapmaya devam eder. Key ID/rotation runbook; eski queued payload decrypt edilemiyorsa fail-closed, yeni kod talebi.

- Resend idempotency key = değişmez outbox ID. Aynı retry aynı içerik ve key ile gider; kullanıcı “yeniden gönder” dediğinde yeni challenge + yeni outbox ID oluşur. Provider timeout'unda teslim edilmedi varsayma. Resend idempotency penceresi 24 saat; auth mail retry süresi bunun altında ve kod expiry'siyle sınırlı. [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys)
- Geçici network/429/5xx: jitter'lı backoff, en fazla 5 deneme, Retry-After ve expiry dikkate alınır. Invalid key/domain/kalıcı 4xx: terminal + operasyon alarmı. Gönderici ayarı bozuksa kullanıcıdan sürekli yeni kod isteme.
- Worker dispatch öncesi consumed/cancelled/expired/authVersion kontrolü yapar. İptalle provider kabulünün yarışında eski bir mail yine ulaşabilir; eski kod hiçbir zaman tekrar geçerli olmaz. Maile “Yalnız en son istediğin kodu kullan” açıklaması ekle.
- `queued` = sıraya alındı, `sent` = provider kabul etti, `delivered` = alıcı sunucu teslim kabulü; hiçbiri kullanıcı doğrulaması değildir. Posta kutusuna/spam dışına kesin düştüğünü iddia etme.
- Signed webhook ham body üzerinden verify edilir; timestamp/replay toleransı ve event dedupe; unknown message ID yok sayılır. Webhook out-of-order/repeat/timeout güvenli olmalı. Ham body parser yalnız bu route scope'unda. [Resend webhook doğrulama](https://resend.com/docs/webhooks/verify-webhooks-requests)
- Hard bounce/complaint için gönderimi baskıla ve private UI'de gerçek dispatch durumunu göster. Suppression e-posta sahipliğini kaldırmaz ve username girişini geri açmaz. Public reset cevabı hedefin suppression durumunu açıklamaz. Yanlış/gecikmiş webhook yeni adresi veya başka operation'ı etkilemez.
- Mail şablonları: ilk doğrulama, değişim-eski, değişim-yeni, parola reset, parola değişti, adres değişti. Text + basit responsive HTML, escaped kullanıcı girdisi, amacın açık başlığı, kod ve süre, “Bu işlemi sen başlatmadıysan kodu paylaşma” açıklaması. Parola asla maile girmez. Mail dilini allowlist locale ile seç; varsayılan EN; altı UI diliyle uyumlu şablonlar.

Önerilen config: `ACCOUNT_EMAIL_ENABLED=false`, `PASSWORD_RECOVERY_ENABLED=false`, `MAIL_DELIVERY_ENABLED=false`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `MAIL_FROM`, `MAIL_REPLY_TO`, `AUTH_CODE_HMAC_SECRET`, `MAIL_OUTBOX_ENCRYPTION_KEY`, limit/kota parametreleri. Ayrı flag'ler yeni kayıt bağlamayı kapatırken doğrulanmış e-postayla girişi açık tutar. Production'da özellik açık ama zorunlu sır/domain ayarı eksikse readiness/config validation hata verir. Development/test default fake; yanlışlıkla gerçek kullanıcılara gönderim yok.

Saklama önerisi: aktif verified email hesapta; pending hedefler/iptal veya bitmiş challenge kişisel payload'ı en geç 24 saatte temizle; kod ve encrypted outbox içerikleri kabul/expiry sonrası temizle. İçeriksiz güvenlik audit'i (accountId, olay, zaman, sonuç, requestId) 30 gün; teslimat metadata'sı 30 gün. Suppression için mail yerine HMAC anahtar + sebep; abuse önleme için gereken yaşam süresini ayrıca açıkla. Hesap silme akışında FK/outbox/challenge ve sağlayıcıdaki metadata/suppression ele alınır; yedeklerin mevcut yaşam döngüsü belgelenir. Retention kullanıcıya/politikaya yazılmadan önce gerçek job ve sağlayıcı ayarlarıyla eşleştirilir.

## 10. Uygulama sırası — her davranışta TDD

1. **Sözleşme ve test altyapısı:** Current auth/onboarding testlerini oku; fake mailer, FixedClock, güvenli fixture/challenge test yardımcıları. Repo manual'ındaki FAIL → implementation → PASS sırasını izle. Production kodunu test helper için zayıflatma.
2. **Auth foundation:** Migration, authVersion, ortak resolver, app rate-limit bypass kapanması, login/refresh race, SSE kapanması ve client terminal logout. Feature henüz kapalı. Legacy kullanıcı adı girişinin regresyonlarını geçir.
3. **Mail altyapısı:** Config, provider adapter, şablonlar, encrypted outbox, bağımsız runner, imzalı webhook, suppression/metrics, expiry cleanup. Fake provider ile failure/retry tests.
4. **E-posta bağlama ve login geçişi:** Request/verify, unique/normalizasyon, e-posta-only login, pending/cancel/resend. Bu dilim backend ve client beraber tamamlanır; mevcut kayıt gövdesi değişmez.
5. **Reset ve adres değişimi:** Aynı challenge primitifleri, farklı purpose/state machine. Code tüketimi + password/email/version tek transaction. Lost old mailbox politikasını UI'ye yaz.
6. **Arayüz ve bütün diller:** Menü satırı, security sheet, login/forgot-password, güçlü geçiş ekranı, mobile resume, server-list erişimi. Yeni React kodunda ilgili React best-practice skill'ini ve mevcut ui-v2 kit'ini kullan; yanlışlıkla Unity UI/Sites becerisi çağırma.
7. **İnceleme/doğrulama:** Bölüm 11'in tüm kapsama maddeleri; normal repo check'leri, gerçek tarayıcı/Android debug görsel kontrol. Mail gönderimi bu görev için daha sonra yetkilendirilen test alıcılarıyla yapılır.
8. **Operasyon ve yayın:** Bölüm 12. Uygulama sonrası bu dosyanın durumunu ve gerçek config/teslimat sonuçlarını güncelle. Tamamlanmayan işi “done” işaretleme.

Önerilen yeni dosyalar: `apps/server/src/auth/email.ts`, `services/accountSecurity.ts`, `services/mail/{mailer,resend,outbox,templates}.ts`, `routes/accountSecurity.ts`, `routes/mailWebhook.ts`; `apps/web/src/screens/AccountSecuritySheet.tsx`, `PasswordResetSheet.tsx` ve ortak code input. İsimleri mevcut klasör düzenine uyarlayabilirsin; sırf bu liste var diye gereksiz soyutlama oluşturma.

## 11. Kabul ve test matrisi

| Alan | Kanıtlanacak davranış / hata durumu |
| --- | --- |
| Kayıt/onboarding | E-postasız kayıt, claim, skip, rehearsal → ana galaksi, eski login ve refresh çalışır. Oyun ilerlemesi/galaksi/ülke/ödül/skin/clan aynı kalır. |
| Login geçişi | Pending e-posta login sağlamaz; doğrulama sonrası username + doğru parola bile reddedilir. Eski `{username}` request shape bypass olmaz. Yeni email + aynı parola kabul. Her hata generic. |
| Atomik ilk doğrulama | Yanlış/expired kodda email hâlâ null; doğru kod tam bir kez bind/version bump yapar. Paralel verify/verify, verify/login, verify/refresh testleri. |
| Unique ve normalizasyon | Case/trim varyasyonları aynı; `+tag` ve noktalar keyfi birleştirilmez. İki hesap aynı adresi aynı anda doğrulayınca biri kazanır. Pending ile adres rezerve edilemez. Unicode username normalizasyonu bozulmaz. |
| Yetki | Başka hesabın challenge'ı, purpose swap, değiştirilmiş hedef, eski authVersion, cookie-only private istek, sahte accountId/header reddi. Mevcut parola olmadan ilk bind/change yok. |
| OTP abuse | Leading zero, yanlış biçim, 5. yanlış sonrası doğru kodun reddi, expiry sınırı, resend cooldown, resend sonrası eski kod, aggregate limit reset bypass, restart sonrası counters. Yanlış deneme transaction rollback ile silinmez. |
| Reset | Yalnız verified email; olmayan/pending/suppressed için generic public cevap. Reset kodu ile bind yapılamaz. Doğru kod tek kullanımlık; reset/new-reset, reset/change, eşzamanlı reset yarışları. Password validation/hash mevcut standardı kullanır. |
| Email değişimi | Eski parola + eski kod + yeni kod; yeni hedef değişince eski proof gider. Pending sırasında eski adres geçerli, sonrasında yalnız yeni adres. Son adım conflict/failure eski adresi korur. Email remove endpoint yok. |
| Oturumlar | Reset/bind/change sonrası tüm eski access ve refresh JWT'ler üç API replikasında reddedilir. Legacy `ver` yok token version 0'da çalışır, bump sonrası reddedilir. `app.ts` req.accountId hızlı yolu ve optionalAuth da aynı güvenlikte. |
| Açık SSE | Özel frame öncesi version check, idle stream heartbeat kapanışı, DB failure, reconnect, cleanup/unsubscribe; revoke olmuş stream gameplay event almaya devam edemez. |
| Mail | Provider fail/timeout/429/5xx, DB commit öncesi send olmaması, crash after provider accept, idempotency, expired queue, key rotation, bounded worker, gameplay tick etkilenmemesi. |
| Webhook | Signature wrong/missing, bozuk body, stale/replayed/duplicate/out-of-order event, unknown message, parser scope; “delivered” ile hesabın doğrulanmaması. |
| Limit | Paylaşılan store ile iki API örneğinin ortak sayaçları, IP+target+account, fail-closed auth, CGNAT, kota rezervi, ücretsiz kota bitişi. Public email enumeration oracle oluşturmama. |
| Privacy | Public galaxy/chat/clan/leaderboard/account projections, admin/perf/feedback, log ve analytics'te email/code/password olmaması. `Me` session cache'e tam mail sızmaması. Sahip olunan security GET no-store. |
| UI | Missing/pending/verified/sending/error/expired/rate-limited/feature-unavailable durumları; renk dışında metin; geri, klavye, paste/autofill, diğer dil uzunlukları, hızlı çift tık, kapat/aç. |
| Session UX | Güçlü email-only geçiş mesajı, tüm private cache temizliği, timeout sonrası doğrulama commit olmuşsa güvenli girişe dönüş, 401 refresh loop olmaması, offline/5xx'te sahte logout yok. |
| Mobil | 350 px, Android debug wrapper, mail uygulamasına gidip dönme, ekran/process restart ve güvenli resume/restart. İleride iOS/production app cookie/auth smoke ayrıca. |
| Migration/rollout | Temiz DB ve legacy dolu email, normalize collision, old client/new server, mixed-replica feature kapalı, mail outage sonrası email login'in devamı, güvenli rollback. |

Fake mailer testte üretilen kodu yakalayabilir; production response/test endpoint ile kod ifşa edilmez. Yarış testleri iki bağımsız DB connection/transaction ile yapılır; sadece mock sırayla çağırma gerçek yarışın kanıtı değildir. Enumeration testleri status/body/headers yanında provider çağrısının response timing'inden ayrılmasını inceler; flaky milisaniye eşitliği testi yazma.

Çalıştırma kuralları: tek workspace ve tek Vitest worker; `nice -n 10`, Node heap en fazla 4096 MiB; komutlar sırayla. Server testleri truncate yapar, yalnız `_test` DB kullan. Uygulamadaki dosyalarla hedefli komutlar:

```sh
nice -n 10 pnpm --filter @astera/server exec vitest run test/auth.test.ts test/account-security.test.ts test/email-recovery.test.ts test/mail.test.ts test/stream.test.ts test/traffic.test.ts --maxWorkers=1 --minWorkers=1 --no-file-parallelism
nice -n 10 pnpm --filter @astera/web exec vitest run test/account-security.test.tsx test/api-client.test.ts test/onboarding.test.tsx test/session-machine.test.tsx test/menu-structure.test.tsx --maxWorkers=1 --minWorkers=1 --no-file-parallelism
```

Tam normal doğrulamada `pnpm verify` kalite kapsamı korunur; runner'ın workspace/test paralelliği mevcut durumda owner sınırlarını garanti etmiyorsa eşdeğer kapsamı aşağıdaki gibi sırayla çalıştır ve raporla:

```sh
nice -n 10 pnpm --workspace-concurrency=1 -r typecheck
nice -n 10 pnpm lint
nice -n 10 pnpm --workspace-concurrency=1 --filter '!@astera/sim' -r run test --maxWorkers=1 --minWorkers=1 --no-file-parallelism
node tools/visual.mjs
```

Gerekirse `docs/engineering-standards.md` içindeki üç sıralı lint grubu kullanılır; bütün dosyalar kapsanır. Uzun ekonomi/snowball simülasyonları ayrıca kullanıcı istemedikçe çalıştırılmaz. Plan hazırlanırken üretim kodu değiştirilmedi; takip eden uygulama görevinin doğrulama sonuçları aşağıda tutulur.

## 12. Gerekli hazırlık, yayın ve rollback

### Hazır / eksik

- [x] Resend Free yaklaşımı belirlendi; kullanıcı ücretsiz/düşük hacim istedi.
- [x] Yerel `.env` içinde dolu `RESEND_API_KEY` var; yalnız gönderim yetkisi doğrulandı, değeri gösterilmedi ve mail gönderilmedi.
- [x] Hostinger mevcut MX/SPF bilgisi public DNS'den doğrulandı.
- [ ] DNS panel erişimi ve Resend hesabının/domain'in aynı yönetimde olduğunun operasyonel kontrolü.
- [ ] Resend sending domain DKIM/SPF onayı; `MAIL_FROM`, Reply-To ve DMARC alignment.
- [ ] `support@asteraonline.space` kutusunun gerçekten alınan yanıtlara erişebildiğinin testi.
- [x] Yerel API key yetkisi kontrol edildi; ayrı HMAC secret ve outbox encryption key oluşturuldu.
- [x] Production secret hazırlığı ve yerel Resend webhook secret kurulumu (2026-10-17); üretim için ayrı HMAC/outbox anahtarları, üç flag false, `.env` 0600 ve özel yedek. Çalışan servisler yeniden başlatılmadı.
- [ ] Staging secret aktarımı ve uyumlu yayında Resend imzalı webhook teslimatının doğrulanması.
- [ ] Test alıcıları ve staging domain/allowlist; gerçek kullanıcılara otomatik test maili yok.
- [x] Günlük 100 / aylık 3.000 uygulama tavanı, reset için günlük 20 rezerv, iç metrics kota uyarısı ve gönderim hatası UX'i eklendi.
- [ ] Sağlayıcı panelinde kota/alarm ve gerçek hesap fatura döneminin kontrolü.
- [ ] Gmail/Outlook ve mümkünse iCloud ile gerçek doğrulama/reset teslimatı; SPF/DKIM/DMARC sonucu, spam durumu, gecikme ve reply routing.
- [x] Migration dosyaları/snapshot'ları, health durumu, cleanup döngüsü ve privacy metinleri eklendi; yerel DB güncellendi.
- [ ] Production yedeği/migration, dış alarm bağlantısı ve destek prosedürünün operasyonel kabulü.

### Güvenli yayın sırası

1. Non-null legacy email/collision audit ve yedek; additive migration. Production schema işlemini yerel plan hazırlığıyla karıştırma.
2. Bütün API replikaları ve worker'a authVersion/email-login kurallarını destekleyen sürümü **feature kapalı** dağıt. Eski JWT version 0 uyumluluğu ve mevcut oyuncuların login/refresh'i test edilir.
3. Frontend'i generic identifier login, geçiş mesajı ve güvenlik ekranı desteğiyle dağıt; güncel olmayan client için anlaşılır yenileme yolu. Eski cached frontend'in doğrulanmış oyuncuyu dışarıda bırakmasını test et.
4. Resend/DNS/webhook/secrets hazır; staging veya sınırlandırılmış test hesabında gerçek uçtan uca: onboarding → menu → bind → tüm oturumlar kapandı → email login → reset → change. Test e-postaları için verilen yetki sınırını koru.
5. Recovery'yi ve mail sender'ı hazırla, sonra ilk bind/change özelliğini aç. Kodlar/hata/limit/delivery gecikmesi izlenir. Hiç e-postası olmayan hesaplara toplu mail gönderimi zaten mümkün değil; menüden gönüllü katılım var.
6. İlk 24–48 saatte: send accepted/fail, oldest queued age, expired before send, verified conversion, reset completion, generic auth error oranı, rate-limit ve bounce/complaint; etiketlerde email/accountId gibi yüksek kardinaliteli PII yok.

### Rollback / kesinti

Mail sorununda yeni code-send/bind/change geçici kapatılabilir; giriş/oyun etkilenmemeli. Doğrulanmış hesaplarda email-only login ve authVersion enforcement **daima korunur**. Reset'i geçici durdurmak oyuncunun username ile tekrar giriş yapmasını sağlamaz. Pending kodların tüketimini mevcut güvenli kurallarla sürdür veya kontrollü sona erdir; adresi/şifreyi geri alma.

Migration geri alınarak verified email/authVersion verisi silinmez. Önceki güvensiz auth sürümüne dönmek yasak; son güvenli foundation sürümüne dön veya forward fix uygula. E-posta servisindeki arıza nedeniyle kullanıcı adını yeniden etkinleştiren emergency bypass ekleme.

### Bitti sayılması için

Onboarding ve mevcut e-postasız kullanıcı akışı aynı; menüde isteğe bağlı uyarı var; doğrulama kanıtı olmadan recovery/login açılmıyor; doğrulamadan sonra username login kapanıyor; eski access/refresh ve açık SSE iptal oluyor; reset ve iki adresli değişim çalışıyor; provider hataları oyunu durdurmuyor; hiçbir gizli veri public payload/log'a girmiyor; test/görsel/mobil ve gerçek teslimat sonuçları kaydedilmiş. Yalnız mailin gönderilmiş olması bu işin tamamlanması değildir.


## 13. Uygulama notları (2026-10-16–17)

- `accountSecurity.ts`, `mail.ts` ve `routes/accountSecurity.ts` ile backend; `AccountSecuritySheet.tsx`, `PasswordResetSheet.tsx` ve ortak inputlar ile altı dilde arayüz eklendi.
- Güvenlik sayaçları Valkey yerine **atomik PostgreSQL sayaçları** kullanır. Böylece API replikaları aynı kalıcı limitleri paylaşır; mevcut auth IP sınırlayıcısının Valkey politikası da korunur. Mail için ayrı Redis/queue servisi gerekmez.
- Üretilen additive migration'lar: 0177 hesap/email/version, 0178 proof/outbox/suppression/counter, 0179 proof temizlenirken teslimat metadata'sını koruyan FK, 0180 içeriksiz audit. Pending proof kişisel verisi 24 saat, audit/teslimat metadata'sı 30 gün temizleme döngüsüne tabidir.
- İlk ekleme/değişim operation toplam süresi 30 dakika, her kod en fazla 10 dakika; reset operation 10 dakika. Yeniden gönderim önceki kodu geçersiz kılar, aynı operation deneme sayısını sıfırlamaz.
- Normal giriş + refresh ve özel SSE teslimi durable authVersion kontrolü yapar. Geçici DB arızası terminal oturum hatası olarak ele alınmaz.
- Normal rules: 137 dosya / 2.411 test PASS. Geniş normal server: 340 dosya; 338 dosya ve 4.349 test PASS, 3 skip; eski auth/heartbeat sözleşmeli iki test FAIL. Bu fixture'lar düzeltildi ve ilgili trafik/heartbeat/mail dosyalarındaki 47 test PASS. Son lifecycle/auth/metrics regresyonu ayrıca 24 test PASS; enumeration ve stale-proof bütçe koruması dahil. Tam koşunun hatalı çıkışı gizlenmez; ayrıntı CR kaydındadır.
- Normal web: 505 dosya / 6.601 test PASS, 1 dosya / 29 test skip. Son ek API/session/stream/UI/locale düzeltmelerinden sonra etkilenen altı dosyada 252 test PASS. Ek testler tam koşudan sonra eklendi; bu iki koşu farklı kapsamlarla kaydedilir.
- Son `node tools/visual.mjs out/account-security --account-security`: altı dil × iki genişlik × üç ekran = 36 durum geçti. TR 350 px üç ekran ve EN masaüstü reset görüntüsü son çıktılardan gözle incelendi; yatay taşma/browser hatası yok.
- Dört workspace'in son tip kontrolü 4 GiB heap sınırıyla geçti. Önceki varsayılan 2 GiB web typecheck denemesi heap sınırına ulaştığı için 4 GiB ile tekrarlandı; owner sınırı aşılmadı.
- Son üç sıralı lint grubu tüm dosyaları kapsadı: 0 hata / 0 uyarı. Web build geçti; Rollup büyük chunk uyarısı CR kaydında belirtilmiştir. `git diff --check` temiz. Normal test toplamları ve son ek regresyon koşuları yukarıda ayrı kaydedilmiştir; uzun ekonomi/snowball simülasyonları çalıştırılmadı.
- Yerel API anahtarıyla yalnız domain listesi okuma HTTP 401 / `restricted_api_key` döndü. Yanıtın nedeni **yalnız gönderim yetkisi**; anahtarın geçersiz olduğu sonucu çıkarılmaz ve kapsamını genişletmek gerekmez. DNS/domain onayı panelden netleştirilmeli. Mail gönderilmedi; anahtarın değeri log'a veya dokümana kopyalanmadı.
- Canlı özellik flag'leri varsayılan kapalıdır; `docs/deployment.md` içindeki kurulum sırası tamamlanmadan açılmamalı. Gerçek posta kutularına teslimat henüz doğrulanmadı.
- CR'de public reset attempt-limit yan kanalı kapatıldı: gerçek ve sahte challenge'ların hatalı tamamlamaları aynı yanıtı verir; hesap deneme bütçesi yine uygulanır. Yanıt gecikmesi reset complete'in hata yolunu da kapsar.
- Mail sayaçları `/health` yerine yalnız mevcut iç `/metrics` raporundadır (`.mail`). Production Nginx iki operasyon endpoint'ini de zaten loopback ile sınırlar. Gönderim sorunu oyun readiness'ini bozmaz.
- İstemci CR düzeltmeleri: geçersizleşmiş HTTP/SSE yanıtları için oturum nesli; bekleyen ekran geçişleri için revision; private auth expiry'de tek refresh, yanlış parolayı replay etmeme; yeni ziyaretçiyi expiry/login ekranına sokmama ve eski private cache'i temizleme; açık sheet'te gönderim durumunu yenileme; boşluklu OTP paste; üst reset dialog'unda Escape; cooldown beklemeden yanlış reset adresini düzeltme. Regresyon kanıtı CR dosyasında.
- Son güvenlik incelemesi: tüketilmiş/expired/exhausted reset challenge'ları yeni kodun hesap bütçesini tüketmez. Refresh başka accountId döndürürse hassas işlem o hesaba replay edilmez. Explicit login/register/claim/forget önceki async kimlik işlemlerini geçersiz kılar; SSE çıkıştan sonra buffered frame yayınlamaz. Her yeni hata önce testle yeniden üretildi, sonra düzeltildi.

- Yerel geliştirme DB'sinde 0177–0180 migration'ları uygulandı, pending migration=0 ve `/health` sağlıklı. Production DB'ye dokunulmadı.
- Yerel `.env` içine yalnız eksik olan `AUTH_CODE_HMAC_SECRET` ve `MAIL_OUTBOX_ENCRYPTION_KEY` kriptografik rastgele değerlerle eklendi. Mevcut Resend anahtarı korundu; secret değerleri çıktıya yazılmadı. `.env` git tarafından ignore ediliyor.
- 2026-10-17 mail hazırlığı: DNS DKIM ve CNAME üzerinden SPF/MX yayında; webhook secret yerelde mevcut. Kullanıcının izin verdiği tek test adresine gerçek `ResendMailer` teknik maili gönderdi (HTTP 200), kullanıcı ulaştığını doğruladı. Bu mesaj doğrulama/reset işlemi değildir; Authentication-Results, reply routing ve kuyruk webhook testi hâlâ gerekli. Özel receipt `out/account-mail-readiness` altında, kullanıcı adresi git dokümanlarına taşınmadı.
- Production `.env` mail ayarları eklendi, ayrı production güvenlik anahtarları oluşturuldu, byte düzeyinde mevcut ayarlar ve özel yedek korundu. Bütün flag'ler false; servisler sağlıklı ve eski image çalışıyor. Canlı journal 0152, aday 0180: arada 24 başka migration + 4 email migration var. Mail hazırlığı tam uygulama yayını gibi sunulmaz; [deployment preflight](deployment.md#mail-setup-preflight--17-october-2026) kapsam ve kanıtları içerir.
