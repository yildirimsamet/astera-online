# Hesap e-postası ve kurtarma — kod incelemesi

İnceleme başlangıcı: 2026-10-16. Kapsam: isteğe bağlı e-posta, email-only giriş geçişi, parola sıfırlama, adres değiştirme, mail kuyruğu ve bunların mevcut oturum/oyun akışına etkisi. Ana sözleşme: [uygulama planı](account-email-recovery-plan-2026-10-16.md).

Durum (2026-10-17): Aşağıdaki bulgular testlerle yeniden üretildi ve düzeltildi. Yerel test, tip, lint, build ve görsel kontroller tamamlandı; bu incelemede doğrulanıp açık bırakılan kod bulgusu yok. Production yayını ve gerçek e-posta teslimatı yapılmadı. Aşağıdaki dış ortam kontrolleri hâlâ bekliyor.

## Doğrulanan bulgular ve düzeltmeler

| Öncelik | Bulgu ve etkisi | Düzeltme / kanıt |
| --- | --- | --- |
| P1 | Gerçek reset isteğinde hesap deneme bütçesi dolunca `429`, sahte istek kimliği ise `400` döndürüyordu. Böylece generic request yanıtı aşılabiliyor, adresin kayıtlı olduğu anlaşılabiliyordu. | Public reset bütçesi de aynı `EMAIL_CODE_INVALID` yanıtını döndürür; bütçe yine uygulanır. Reset complete, başarısız ve başarılı yolları kapsayan minimum gecikme/jitter kullanır. `email-recovery.test.ts` üç challenge'a dörder yanlış denemeyle hesap bütçesini doldurur ve sahte isteklerle karşılaştırır. Önce FAIL, sonra PASS. |
| P1 | Tüketilmiş, süresi dolmuş veya beş yanlış denemeyle kapanmış bir reset challenge'ı tekrar gönderilerek yeni kurtarmanın hesap deneme bütçesi tüketilebiliyordu. Eski challenge kimliğini bilen biri doğru yeni kodla kurtarmayı da geçici olarak engelleyebiliyordu. | İşlemin purpose/actor/consumed/attempts/expiry/deadline önkoşulları hesap bütçesinden önce denetlenir; sonuç yine generic olur. Transaction içindeki kilitli tekrar kontrol korunur. Üç durumun her biri önce FAIL, sonra PASS; yeni geçerli kod eskilere yapılan on tekrardan etkilenmez. |
| P1 | Başka sekmede hesap değiştirilirse ortak refresh cookie'si yeni hesabı taşıyabiliyor; eski sekmenin hassas isteği o hesap adına otomatik tekrarlanabiliyordu. | İstemci etkin accountId'yi bellekte tutar. Refresh farklı hesap döndürürse token/placement silinir, oturum kapatılır ve özgün istek tekrarlanmaz. Aynı parolayı kullanan iki hesap senaryosu da `api-client.test.ts` ile önce FAIL, sonra PASS. |
| P2 | E-posta doğrulanıp çıkış yapıldıktan sonra eski HTTP yanıtı refresh başlatabiliyor, placement bilgisini geri yazabiliyor veya geçiş mesajını değiştirebiliyordu. Eski SSE reconnect yanıtı da aynı hatayı taşıyordu. Backend token iptali çalışsa da istemci durumu güvenilir değildi. | HTTP yanıtları ve SSE açılışları başladıkları oturum nesline bağlandı. Eski yanıtlar `SESSION_CHANGED` ile reddedilir; eski refresh yeni kimliği değiştiremez. `api-client.test.ts` geciken 401/200/refresh/SSE yanıtlarını ayrı ayrı sınar. |
| P2 | Bekleyen cold restore, galaksiye katılma ve rollover callback'leri çıkıştan sonra eski sunucu/blocked/ready ekranını geri yazabiliyordu. | `useSession` geçişleri revision kontrolü yapar; çıkıştan önce başlayan işlemler artık ekran durumunu değiştirmez. İptal edilen oturumun query ve ready-session önbelleği temizlenir. `session-machine.test.tsx` gerçek API olayını ve gecikmiş promise sonuçlarını kontrol eder. Manuel çıkış da kapsanır. |
| P2 | Explicit login/register/claim, önceki cold restore'u geçersiz kılmıyordu; geciken refresh token'ı veya eski hook callback'i yeni girişi ezebiliyordu. `forget()` da bekleyen restore'u iptal etmiyordu. Açık SSE'nin bekleyen body okuması çıkıştan sonra bir frame daha yayınlayabiliyordu. | Yeni kimlik işlemleri API neslini ve hook revision'ını artırır; token benimseme tekrar nesil denetler. `forget` nesli artırır. SSE her body okumasından sonra nesil/abort denetler. Bu son turda dokuz test önce FAIL, sonra PASS; parse ile benimseme arasındaki session-end için üç ek test de geçer. |
| P2 | Paylaşılan refresh promise'i başarıyla sonuçlanırken başka callback oturumu kapatırsa, `send` eski isteği yeniden gönderiyordu. İlk nesil kontrolü refresh beklemesinden önce yapıldığı için bu dar aralık korunmuyordu. | Refresh await'inden sonra ve HTTP replay'den önce nesil tekrar kontrol edilir. SSE açılışı da isteği göndermeden önce kontrol yapar. Gerçek paylaşılan refresh promise'ini kullanan regresyon önce FAIL, sonra PASS; kapanıştan sonra ek istek yoktur. |
| P2 | Hiç hesabı olmayan ilk ziyaretçi ile süresi dolan etkin oturum aynı şekilde ele alınabiliyordu. Bu, onboarding yerine otomatik login/expired mesajına yol açabiliyordu. | Token/placement yokken başarısız cold refresh expiry olayı yayınlamaz. Cold restore başarısızsa private cache temizlenir. İlk ziyaretçinin tam olarak `{ phase: 'landing' }` durumuna geldiği, eski cache'in silindiği sınanır. |
| P2 | Hassas e-posta uçlarında refresh tamamen kapalıydı; erişim süresi kod girerken dolarsa akış kesiliyordu. | Private uçlarda gerçek auth süresi dolması bir kez refresh/retry yapar. `BAD_CREDENTIALS` parola hatası otomatik tekrarlanmaz. Public reset uçları otomatik replay yapmaz. Ayrı API testleri her iki yolu doğrular. |
| P2 | Worker sonradan gönderimi başarısız sayarsa açık doğrulama ekranı bunu kendiliğinden göstermiyordu. | Yalnız sheet açık ve non-reset doğrulama bekliyorken private durum 5 saniyede bir yenilenir. Ekran kapalıyken bu polling yoktur. Sanal saatli UI testi gecikmiş `failed` durumunu ve kod alanının korunmasını doğrular. |
| P3 | HTML `maxLength=6`, `012 345` yapıştırıldığında temizleme çalışmadan son haneyi kesiyordu. | Kod alanında uzunluk kontrollü değerde uygulanır: rakam dışı karakterler çıkarılır, ilk altı rakam tutulur. Native form ve API hâlâ tam altı ASCII rakam ister. Gerçek `userEvent.paste` testi baştaki sıfırı da doğrular. |
| P3 | Reset sheet üzerindeki Escape hem kurtarmayı hem alttaki giriş dialog'unu kapatıyordu. | Üstte reset açıkken alt dialog Escape'i işlemez. Onboarding UI regresyonu yalnız kurtarmanın kapandığını doğrular. |
| P3 | Reset adresindeki yazım hatası resend cooldown bitene kadar düzeltilemiyordu. | “Başka e-posta kullan” aksiyonu ağ isteği yapmadan email adımına döner, challenge/kod/parola metadata'sını temizler. Mevcut adres düzeltme için inputta kalır; backend limitleri korunur. Altı dil ve UI testi eklendi. |

## Test sözleşmeleri ve operasyon ayrımı

- Trafik testinde DB'de bulunmayan rastgele account UUID'sine imzalı JWT basılıyordu. Yeni authVersion kontrolü bu token'ı doğru biçimde `401` ile reddeder. “Hesabı var, gezegeni yok → 404” testi artık gerçekten kayıtlı ve yerleşmemiş hesap kullanır.
- Eski heartbeat testi “hiç DB okuması yok” istiyordu. Zorunlu idle-session revocation artık heartbeat'te sürüm kontrolü gerektirir. Asıl kaynak koruması korunur: **plain SELECT; BEGIN, row lock ve frame başına WAL yazımı yok**. SQL'i kaydeden `stream-frames.test.ts` iki frame türünde de bunu doğrular. Yeni idle-revocation testi ayrıca gerçek socket kapanışını sınar.
- Mail sayaçları readiness yanıtından `/metrics` içine taşındı. API `/health` handler'ı auth istemese de production Nginx **zaten hem `/health` hem `/metrics` için loopback dışını reddediyor** (`deploy/nginx/astera.conf`). Bu değişiklik, doğrulanmış dışa açık production sızıntısı değil; hesap kurtarma etkinliği ile readiness bilgisinin ayrılmasıdır. Yeni public/API health yanıtı mail sayacı taşımaz, mevcut iç metrics raporu taşır. Mail arızası oyun readiness'ini bozmaz.
- Resend REST alanları, ham body ile webhook doğrulaması ve suppression event'indeki `email_id` resmî kaynaklarla karşılaştırıldı. Svix'in yayımladığı bağımsız signature örneği de teste eklendi ve geçti; yalnız kendi HMAC kodumuzla oluşturulmuş fixture'a güvenilmedi.

## İncelenen ve testlerle korunan güvenlik kuralları

- İlk ekleme mevcut parola ister. Change, mevcut parola + eski posta kutusu + yeni posta kutusu kanıtı ister. Pending adres login/recovery açmaz; doğrulanmış adres silinemez.
- Canonical email ve unique index tek adresi iki hesaba bağlamayı engeller. İki hesapla gerçek DB transaction yarışı kontrollü tek başarı/tek conflict üretir; pending istek adresi rezerve etmez.
- Kod özeti purpose/id/account/target ile bağlıdır. Altı hane, kısa ömür, toplam operation deadline, beş yanlış deneme, account/IP/target limitleri vardır. Yanlış deneme transaction rollback ile sıfırlanmaz. Resend eski dispatch'i geçersiz kılar; cancel/reset/bind/change sonrası eski proof'lar kullanılamaz.
- Sonuç account lock altında uygulanır. Login/refresh eski authVersion snapshot'ını yeni sürüm gibi imzalayamaz. Token sürümü rate-limit keyGenerator erken yolunda da kontrol edilir. Geçici DB arızası terminal session hatası gibi yorumlanmaz.
- Access, refresh ve açık SSE sürüm iptalini uygular. SSE event ve idle heartbeat sorguları kilit/yazım üretmez. Private cache ve eski async istemci yanıtları yeni giriş durumuna taşınmaz.
- Kuyruk içeriği AES-GCM ile outbox UUID'sine bağlı şifrelenir. API yanıtı ve log'lar kod/parola/mail payload'ı içermez. Sağlayıcı çağrısı DB lock altında beklenmez; timeout/retry/idempotency/lease/expiry uygulanır.
- Başka credential değişiminde eski proof maili gönderilmez; güvenlik değişikliği bildirimleri ise sonraki authVersion artışı yüzünden kaybolmaz. Test, art arda iki credential değişimini kapsar.
- Geçerli webhook teslim/bounce/complaint/suppression kaydeder; hesabı doğrulamaz. İmza, ham byte, timestamp, tekrar event ve sıra dışı late-delivery durumları sınanır. Provider ID henüz kaydedilmeden gelen geçerli event yeniden teslim için `503` alır.
- Cleanup gönderim flag'i kapalıyken de çalışır. Proof silinince outbox metadata FK'sı set-null olur; 30 günlük teslim/audit kayıtları yanlışlıkla cascade silinmez.
- Ücretsiz kota tavanı ve reset rezervi DB'de ortak sayaçlarla uygulanır. Otomatik ücretli yükseltme yoktur. Email/login politikası mail flag'leri kapatılınca username fallback'e dönmez.

## Doğrulama kaydı

- Rules: 137 dosya / 2.411 test geçti.
- Normal server geniş koşusu: 340 dosya; 338 dosya ve 4.349 test geçti, yukarıdaki iki eski test beklentisi başarısız oldu; 3 test skip. Güncellenen trafik/heartbeat ve bağımsız imza testleri tekrar çalıştırıldı: **3 dosya / 47 test PASS**.
- Yeni enumeration, metrics ve stale-proof bütçe düzeltmeleri, bütün email lifecycle ve account auth testleriyle tekrar çalıştırıldı: **3 dosya / 24 test PASS** (`email-recovery`, `account-security`, `runtime-metrics`).
- İlk CR UI/API regresyon koşusunda 14 yeni sınır durumu FAIL ile yeniden üretildi. Düzeltmelerden sonra locale kontrolleriyle **5 dosya / 209 test PASS**. Cold-resume private-cache silinmesi için ek assertion ayrıca FAIL verdi; düzeltmesi son tam web koşusuna dahil edildi.
- Tam normal web: **505 dosya PASS, 1 dosya skip; 6.601 test PASS, 29 skip**. Son oturum yarışı düzeltmeleri sonrasında etkilenen altı dosya tekrar çalıştırıldı: **252 test PASS** (`api-client`, `session-machine`, `event-stream`, `account-security`, `onboarding`, `i18n`). Tam web koşusu bu son ek testlerden önce tamamlandı; son sayı onun yerine sunulmaz.
- Lint: bütün dosyaları kapsayan üç sıralı `pnpm lint` grubu **PASS, 0 hata / 0 uyarı**. Son sunucu sadeleştirmesi ve stream abort kontrolü sonrasında ilgili gruplar tekrar çalıştırıldı. Stream abort sırasında hazır frame'in yayınlanmaması ve native `AbortError` sözleşmesi de ek regresyonla korunur.
- Son tip kontrolü: `pnpm --workspace-concurrency=1 -r typecheck` ile dört workspace **PASS**.
- Web build: `pnpm --filter @astera/web build` **PASS**. Rollup 500 kB üzerindeki chunk uyarısını veriyor (ana index yaklaşık 5,30 MB / gzip 1,59 MB); bu bir build hatası değildir ve bu çalışmada genel bundle mimarisi değiştirilmedi.
- Görsel: `node tools/visual.mjs out/account-security --account-security` **36/36 PASS**; altı dil × 350/1280 px × email/code/reset. Sayfa/dialog yatay taşma ve browser error kontrolleri geçti. TR 350 px üç ekran ve EN 1280 px reset ekranı son çıktılardan gözle incelendi. Bu fixture gerçek component'leri kullanır, mail göndermez. Çıktı: `out/account-security/results.json` ve yanındaki PNG'ler.
- Son `git diff --check` temiz; yerel `/health` sağlıklı. Kontroller tek workspace/tek worker ile sırayla, testler nice=10 ve heap en fazla 4 GiB ile çalıştırıldı. Uzun ekonomi/snowball simülasyonları çalıştırılmadı. Ayrı bir çalışma sürecinin tip kontrolü sırasında bellek/swap baskısı görüldü; bu çalışmanın kontrolleri paralel başlatılmadı, heap sınırı artırılmadı.

## Henüz dış ortamda doğrulanmayanlar

- Resend domain/DNS onayı, webhook secret ve production/staging secret aktarımı.
- Yetkilendirilmiş test alıcılarıyla gerçek Gmail/Outlook/iCloud teslimatı, spam/DMARC/DKIM/SPF ve support Reply-To kontrolü. Hiç gerçek mail gönderilmedi.
- Fiziksel Android cihazında mail uygulamasına geçip dönme / process restart; gelecekteki production Capacitor origin-cookie kabulü. Mobil browser viewport kontrolü native test yerine sunulmaz.
- Production legacy-email audit/yedek/migration ve bütün replikaların güvenli auth sürümüne geçmesi; eski açık/cached frontend'in yenilenmesiyle gerçek rollout provası. Yerel 0177–0180 migration'ları uygulanmış olsa da production DB'ye dokunulmadı.

Canlı flag'ler varsayılan kapalıdır. Dış kontroller tamamlanmadan gerçek gönderimi açma. Bu maddeler tamamlandı diye varsayma; [deployment runbook](deployment.md) ve ana planın yayın sırasını uygula.

17 Ekim sonraki operasyon notu: Yukarıdaki CR kapanışından sonra kullanıcı DNS ve webhook
hazırlığını yaptı. Yetkilendirilmiş test adresine gerçek adapter üzerinden bir teknik mail
gönderildi (Resend HTTP 200); kullanıcı alındığını doğruladı. Production `.env` mail
credential'ları ve ayrı güvenlik anahtarlarıyla, flag'ler kapalı kalacak şekilde hazırlandı.
CR kapanışındaki “hiç mail gönderilmedi / secret aktarımı bekliyor” maddeleri o anın
kaydıdır; güncel hazırlık kanıtı deployment runbook'tadır. Gerçek queued bind/reset,
signed webhook, Authentication-Results, reply routing ve uygulama yayını hâlâ tamamlanmadı.

Kaynaklar: [Resend Send Email](https://resend.com/docs/api-reference/emails/send-email), [Resend webhook doğrulama](https://resend.com/docs/webhooks/verify-webhooks-requests), [Resend suppression event](https://resend.com/changelog/email-suppression-visibility), [Svix manual verification ve bağımsız örnek](https://docs.svix.com/receiving/verifying-payloads/how-manual).
