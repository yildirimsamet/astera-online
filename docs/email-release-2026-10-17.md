# Ortak yayın ve e-posta açılışı — 17 Ekim 2026

Kullanıcı e-posta çalışmasıyla birlikte diğer hazır değişikliklerin de canlıya alınmasını
yetkilendirdi. Yayın ve e-posta açılışı tamamlandı. Kabul zamanı: 17 Ekim 2026 02:13 TRT
(16 Ekim 23:13 UTC). Canlı SHA: `3bde9fe61dcb26b7450875940646fd13ca82acd1`.

## Kapsam ve güncel başlangıç

- Güncellenen canlı kontrol: checkout, üç API ve worker `790293826f9b6b7926b42280f088b8575543efa0`.
  Image `sha256:45d47ee123a3ae28e58b1824befd0d7deab2e0c8d065b8612a0b0c68372957f0`.
- Journal 177 kayıtla 0176'ya kadar uygulanmış. Önceki mail preflight'ında görülen
  `efa8f836` / 0152 tabanı artık canlı değil; önceki geniş oyun yayını tamamlanmış.
- Kalan şema: 0177–0180, dört additive e-posta/güvenlik migration'ı. Mevcut 1.565 hesapta
  non-null legacy email sayısı sıfır. İlk kontrolde son 15 dakikada 14 etkin oyuncu vardı;
  bu sayı kesin açık oturum sayısı değildir. Cutover öncesi yeniden ölçülür.
- Kalan uygulama: isteğe bağlı doğrulanmış email, email/password giriş geçişi, reset,
  eski/yeni posta kanıtlı adres değişimi; shader domain ve finite-scene düzeltmeleri,
  Tempest zoom/formation ışık bütçesi; ilişkili test, görsel araç ve dokümanlar.
- `apps/server/src/cli/zz-grant-once.ts` yerel tek seferlik telafi aracı olarak korunur;
  yayın artefaktına alınmaz ve çalıştırılmaz. Yayın yeni oyun ödülü/season activation içermez.
- Üretim secret'ları ve ayrı HMAC/outbox anahtarları hazır; üç mail flag false. `.env`
  git dışında, mode 0600. Daha önce izinli Gmail alıcısına adapter testi HTTP 200 döndü,
  kullanıcı teslimatı doğruladı. Gerçek queued mail/webhook kabulü bu yayında ayrıca yapılır.
- D99 host kapasite gate'i geçti: 6 CPU, yaklaşık 12 GiB RAM, sıfır swap kullanımı,
  yeterli disk, doğru servis/limit topolojisi; servisler sağlıklı.

## Yayın sırası ve kabul

1. Son değişikliklerin hedefli testleri; önceki tam normal test kapsamı ve son tekrarları
   [CR kaydında](account-email-recovery-review-2026-10-16.md). Yeni görsel dosyalar dahil
   tip/lint/build ve visual kontroller. Uzun ekonomi simülasyonları kapsam dışı.
2. Hazır değişiklikleri tek gözden geçirilebilir commit/SHA ile sabitle ve origin'e gönder.
   Çalışma ağacı sonradan değişirse yayına sessizce katma; yeni diff'i ayrı değerlendir.
3. Eski image, webroot, Nginx, özel `.env` ve tutarlı veritabanı dump'ını koru. Dump checksum
   ve geri yükleme kanıtı; disposable restore üzerinde aynı image ile migration provası.
   Hesaplar/oyuncular/dünyalar/mission/queue ve mevcut auth verileri korunmalı.
4. Server ve web'i kesinti öncesinde üret. E-posta flag'leri false iken dört migration'ı
   bir kez uygula. Eski/new image uyumunu restore üzerinde kontrol et; lock budget uygula.
5. API'leri sırayla, her birinde image/SHA/health doğrulayarak yenile; worker'ı yenile.
   Backend kabulünden sonra hazır web artefaktını eski hashed asset'leri koruyarak yayınla.
6. Gerçek queued doğrulama/reset maili, imzalı webhook, username reddi, email login,
   access/refresh iptali ve eski parolanın reddini sınırlandırılmış test hesabıyla doğrula.
   Test hesabı canlı galaksiye katılmaz; sahip hesabının parolası değiştirilmez.
7. Doğru credential ve sender doğrulamasından sonra mail/recovery/bind flag'lerini aç;
   yalnız worker önce, ardından üç API. Feature açıkken gerçek smoke ve metrics kontrolü.
   Bu bayraklar kullanıcı bazlı değildir; test sırasında genel özellik açılışı da olur.
8. Son SHA/image/release.txt, dört health, pending migration=0, public capability ve mail
   kuyruğunu doğrula. Kontrollü test hesabını ve ona ait credential'ları temizle; audit/
   teslimat metadata'sını saklama politikasıyla uyumlu bırak. Test alıcısını git'e yazma.

## Geri dönüş sınırı

Doğrulanmış hesap oluştuktan sonra eski username-login/authVersion'sız image güvenli
rollback değildir. Mail sorunu olursa üç flag'i kapat, email login ve authVersion kontrolünü
koru; DB geri yükleyerek sonraki oyuncu yazımlarını silme. İlk feature açılışından önce
schema uyumluluğu kanıtlanmış eski image ayrıca elde tutulur.

## Sonuç

- Son aday sunucu: dokuz dosya / **235 test PASS** (auth, account-security,
  email-recovery, mail, stream, stream-frames, traffic, runtime-metrics, contract).
- Son aday web: 19 dosya / **414 test PASS**, e-posta/session ve yeni shader/finite/Tempest
  kodları dahil. Önceki tam normal koşular CR kaydında; bu sayılar yeni tam koşu sayılmaz.
- Eski image korundu; webroot, Nginx, `.env` ve private custom-format dump
  `~/backups/email-release-20261017` altında. Dump checksum geçti ve
  `astera_email_20261017_rehearsal` DB'sine tek transaction ile geri yüklendi.
  Başlangıç: 1.565 account, 684 player, 872 planet, 25.997 mission, 116.918 event,
  journal 177. Mevcut username/password hash özeti migration öncesi/sonrası karşılaştırılır.
- Dört workspace tip kontrolü ve bütün dosyaları kapsayan üç sıralı lint grubu PASS.
  Üretim server ve web artefaktları kesinti öncesinde hazırlandı. Web build büyük chunk
  uyarısını verdi; build başarılı. Nginx syntax testi geçti; mevcut MIME/HoofyWood vhost
  uyarıları bu yayında değiştirilmedi.
- Aynı image ile restore migration provası PASS: pending 4 → 0, journal 177 → 181;
  bütün yukarıdaki sayılar ve auth özeti aynı. Eski ve yeni image, bu şema üzerinde gerçek
  register/login/me/refresh/logout okuma-yazma provasını geçti. Prova hesabının reward FK'sı
  cleanup scriptinde ayrıca temizlenerek restore başlangıç özeti yeniden doğrulandı.
- Görsel: account security 36/36, shader-family/fault-injection GPU 63/63 ve Tempest zoom /
  17 motor ışık bütçesi PASS. Üretim webinde TR 350/1280 px login/reset dialog'ları da
  browser error/overflow olmadan açıldı; 350 px reset screenshot'ı gözle incelendi.
  Çıktılar `out/email-release-*` ve `out/account-mail-readiness/live-web` altında.
- Production migration'ları lock timeout 5 saniye ve statement timeout 60 saniye ile
  uygulandı; pending=0. Üç API sırayla ve worker sağlıklı yeni image ile yenilendi;
  eski hashed asset'ler korunarak arayüz yayınlandı. Aynı git SHA origin/master,
  checkout, dört runtime ve public `release.txt` üzerinde doğrulandı.
- Image: `sha256:4464b6ef865d0deaf8a90ca6fa92bed68c8810f5b73ee688766b5d1830e8849a`.
- Genel feature flag'ler kapalıyken, ayrı API smoke süreci gerçek production DB ve gerçek
  Resend adapteriyle yalnız izinli test alıcısına mail gönderdi. Galaksiye hiç katılmayan
  geçici hesapta bind → username reddi → email login → reset → eski parola reddi → yeni
  parola ile login PASS. Bind access/refresh iptali, reset access iptali ve reset kodunun
  ikinci kullanımının reddi PASS. Üç mailin (bind/reset/security alert) tamamı gerçek
  imzalı Resend webhook'u ile `delivered` oldu. Kodlar test adapterinde yalnız bellekte
  tutuldu; bu operasyon gelen kutusundan elle kod girme testi olarak sunulmaz.
- Smoke hesabı exact ID/username ve sıfır player guard'ıyla temizlendi. Kullanıcının mevcut
  hesabı/parolası değiştirilmedi. Geri yükleme DB'si kaldırıldı; release lock bırakıldı.
- Ardından üç flag true yapıldı; worker önce, üç API sırayla yenilendi. Dört runtime'da
  flag'ler true, doğru image/SHA ve health `.ok=true` doğrulandı. Public capabilities:
  `{"email":true,"recovery":true}`. Son mail sayacı daily=3/monthly=3; queued=0, failed=0,
  quotaWarning=false. Worker unknownEvents=0. Journal 181 / pending=0.
- Özel sunucu kanıtı: `~/backups/email-release-20261017/release-acceptance.json`.
  Yerel kopya: `out/account-mail-readiness/release-acceptance-2026-10-17.json`.
  Raw secret, parola ve doğrulama kodları rapora veya git'e yazılmadı.

Kalan gözlem sınırları: Gmail Authentication-Results/inbox-versus-spam ve support'a gerçek
yanıt routing'i ayrıca kullanıcı kutusundan incelenmedi; ikinci test adresi verilmediği için
adres değiştirme iki gerçek posta kutusuyla tekrarlanmadı (DB/API regresyonları geçti).
Outlook/iCloud ve fiziksel Capacitor akışı bu yayında test edilmedi. Önceki teknik testin
mailbox'a ulaştığını kullanıcı doğruladı; webhook `delivered` tek başına inbox yerleşimi değildir.

Bu kapanış yalnız dokümantasyon güncellemesidir; yayınlanan uygulama artefaktı yukarıdaki
değişmez SHA'dadır. Bu yayın çalışması kaynak kodda kabul sonrasında ek değişiklik yapmadı.
Son yerel durum kontrolünde başka çalışmanın yeni spawn-gate dosyaları ve `0181_spawn_gate`
migration'ı oluşmuştu; bunlar sabitlenen yayın adayından sonra başladı, incelenmiş/test edilmiş
bu pakete dahil değildir. Bu yeni çalışma ve yerel telafi scripti aynen bırakıldı. Canlı
checkout/image hâlâ yukarıdaki SHA ve 0180'a kadar uygulanmış şemadır.
