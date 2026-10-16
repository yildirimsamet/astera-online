# Çıkış sonrası giriş e-postası — uygulama ve CR

Kullanıcı: çıkış sonrası giriş alanında e-posta hazır gelsin; oyuncu yeni giriş yöntemini
anlasın. Normal logout, ilk email bind ve email change sonrası zorunlu logout kapsamda.
Parola boş, adres düzenlenebilir; adres doluysa odak parola alanında.

## Davranış ve veri sınırı

- Doğrulanmış adres yalnız başarılı login/refresh session yanıtına opsiyonel `loginEmail`
  olarak eklenir. Kaynak DB'deki canonical doğrulanmış adres; username'den veya kullanıcının
  başarısız denemesinden türetilmez. Eski sunucu yanıtı alanı taşımıyorsa boş alan korunur.
- API bu adresi mevcut kimliğe bağlı bellekte tutar; localStorage/sessionStorage'a eklemez.
  `me`/public commander/leaderboard/ready-session şemalarına yeni email alanı eklenmez.
- Normal logout başlamadan adres alınır; token temizlense veya istek offline başarısız
  olsa da yeni landing state'e aktarılır. Kod, pending logout eski kimliğe aitse revision
  kontrolüyle yeni ekranı değiştiremez. Logout fazladan API isteğini beklemez.
- Başarılı bind/change sonunda formun doğrulanmış hedefi session-ended event'ine aktarılır.
  Pending change devam ettirildiğinde hedef `status.pending.target` ile açılır. İlk/ikinci
  aşama tamamlanmadan adres hint olarak kabul edilmez. Event adresi normalize/validate eder.
- Yeni login/register/claim başlarken önceki hint silinir; `forget`, terminal expiry ve logout
  da API'deki adresi temizler. Başarısız login ve başka hesaba refresh eski adresi taşımaz.
  Özel forced-exit event'i adres vermiyorsa rastgele eski bir hesaptan hint üretilmez.
- Landing yalnız başlangıç değeri alır; oyuncu adresi değiştirebilir. Parola doldurulmaz.
  Yeni sayfa yüklemesinde bu özellik adresi kalıcı olarak geri getirmez; password manager'ın
  kendi autofill davranışı ayrı tarayıcı özelliğidir.

## İnceleme ve kanıt

Başlangıçta server bir testte login email hint'inin olmadığını FAIL ile gösterdi;
web'de sekiz yeni senaryo FAIL verdi. Uygulama sonrası aşağıdaki koşular PASS:

- Server `account-security`, `auth`, `contract`: 3 dosya / **157 test PASS**.
- Web `api-client`, `session-machine`, `onboarding`, `account-security`, `event-stream`:
  5 dosya / **160 test PASS**.
- Kanıtlanan ek sınırlar: cookie restore sonrası normal/offline logout, adresi düzenleyip
  giriş gönderme, boş parola ve odağı, pending yeni email change'i sürdürme, başarısız
  girişte eski adresin silinmesi, geciken refresh'in yeni hesabın adresini ezmemesi,
  malformed hint'in reddi, mevcut session/revocation/SSE yarışlarının korunması.
- Runtime Zod kullanımı için type-only import kalmıştı; hedefli web koşusu bunu yakaladı,
  value import olarak düzeltildi ve bütün beş dosya tekrar PASS oldu.
- Son eklenen `no-store`, `/me` yanıtında email bulunmaması ve doğrulama tamamlanmadan
  hint yayılmaması kontrollerinden sonra server `account-security` **5/5**, web'in beş
  dosyası yeniden **160/160 PASS**. Bu tekrarlar yukarıdaki 317 teste ayrıca eklenmez.
- Rules/server/sim tip kontrolleri PASS. Web testindeki geçersiz `getByRole` seçeneği
  düzeltildikten sonra web tip kontrolü de PASS. Simülasyon çalıştırılmadı.
- Root lint, `docs/engineering-standards.md` içindeki üç sıralı grupta **PASS**, uyarı yok.
- Üretim web build'i **PASS** (12.39 sn). Önceden mevcut büyük bundle uyarısı devam ediyor
  (ana JS 5,305.09 kB, gzip 1,591.50 kB); bu değişikliğin CR kapsamı dışında.
- Ön doldurma görsel kontrolü: altı dil × 350/1280 px = **12/12 PASS**. Her durumda adres
  dolu, parola boş, odak parolada; yatay taşma ve runtime page error yok. Türkçe mobil ve
  İngilizce masaüstü ekran görüntüleri ayrıca gözle incelendi.
- Kullanıcı ek kapsamlı testlere gerek olmadığını belirtti. Başlatılmış ek 36 durumluk
  mevcut güvenlik ekranları görsel regresyonu durduruldu; tamamlanmış/PASS sayılmaz.
  Tüm test paketi yeniden çalıştırılmadı. Mevcut hedefli testler ve 12 ön doldurma
  görsel kontrolü bu değişiklik için yukarıdaki kanıttır.

## Dağıtım ve sınırlar

Yeni migration veya environment değişkeni yok. Sunucu önce, web sonra dağıtılabilir;
opsiyonel alan sayesinde eski sunucu yanıtı da okunur, yalnız ön doldurma yapılamaz.
Bellek henüz başarılı bir session yanıtı almamışsa (örneğin açılıştaki cookie restore
bitmeden çıkış), adres bilinmediği için boş bırakılır. Adresi öğrenmek için çıkışa ek
bir ağ isteği eklenmez. Fiziksel Capacitor/iOS/Android klavye davranışı bu web CR'sinde
test edilmedi.

CR ve bu değişikliğin kontrolleri tamamlandı; açık bir engelleyici bulgu kalmadı.
Önceki sürümün tam normal testleri bu CR'nin tam koşusu gibi sunulmaz.
Bu değişiklik henüz canlıya dağıtılmadı. Çalışma ağacındaki
spawn-gate/galaxy guide değişiklikleri farklı görevdir; bu CR onları değiştirmez/deploy etmez.

## Yerel kanıtlar

- `/tmp/astera-email-prefill-server-green.log` (157), `server-final.log` aynı prefix ile (5).
- `/tmp/astera-email-prefill-web-final.log` (160).
- `/tmp/astera-email-prefill-types.log` (ilk koşu; web test seçicisi hatası),
  `/tmp/astera-email-prefill-types-web.log` (düzeltme sonrası PASS).
- `/tmp/astera-email-prefill-lint-{1,2,3}.log`, `/tmp/astera-email-prefill-build.log`.
- `out/email-prefill/results.json`, `out/email-prefill/<dil>-<genişlik>.png`.
  Görsel fixture yalnız sahte API kullanır; mail göndermez veya oyuncu verisine dokunmaz.
  `out/` ve `/tmp/` geçici, repoya dahil edilmez.
