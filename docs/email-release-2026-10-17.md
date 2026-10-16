# Ortak yayın ve e-posta açılışı — 17 Ekim 2026

Kullanıcı e-posta çalışmasıyla birlikte diğer hazır değişikliklerin de canlıya alınmasını
yetkilendirdi. Bu kayıt yayın boyunca güncellenir; planlanan adımlar tamamlanmış sayılmaz.

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
- Tip/lint/build ve aynı image ile restore migration provası sürüyor.
  Henüz bu aday sürüm deploy edilmedi.
