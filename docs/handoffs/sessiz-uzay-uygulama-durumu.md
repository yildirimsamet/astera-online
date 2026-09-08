# Sessiz Uzay — uygulama durumu

Yürürlükteki tek sözleşme: [entegrasyon planı](sessiz-uzay-entegrasyon-plani.md).
Önceki alternatifler ve eski açık sorular geçersizdir.

## Tamamlanan uygulama

48 saat API presence inaktivitesi, bütün dünyaların korunması, MAIN koloni adreslerinde
nötr reset, ortak koloni havuzu ve kapasite üstü dönüş tamamlandı. Beş dakikalık worker,
engellenen başvurunun önceliğini korur; tur başına en fazla beş başarılı aktarım yapar.
HTTP/SSE/cache placement kontrolü, TR/EN bildirim modalı, geçmiş intel izolasyonu,
klan ateşkesi, cycle sonuç tekilliği ve cursor/expiry güvenliği uygulandı.
Dönüşte koloni ve nötr placeholder konum değiştirir; iki UUID ve tarihsel referanslar
korunur. Canlı enkaz, devam eden uçuş/toplama ve işlenen olaylar güvenle ertelenir.

## Son doğrulama — 2026-09-08

- Son enkaz regresyonu önce FAIL, düzeltmeden sonra ilgili 58 test PASS; CR tamamlandı.
- Typecheck ve lint PASS. Tam paket: rules 923 PASS, web 2467 PASS,
  sim 82 PASS / kullanıcı onaylı 6 SKIP, server 1386 PASS / 3 bilinen FAIL.
- Üç bots-turn hatası temiz f1fa09d bazındaki aynı ad ve mesajlarla sürüyor; skip edilmedi.
  Tam suite tamamen yeşil olarak sunulamaz. Yeni regresyon yok.
- Düşük paralellik komutundaki min/max worker çakışması nedeniyle başlamayan rules/web/sim
  koşuları minWorkers=1/maxWorkers=2 ile bütünüyle tekrar çalıştırıldı ve yukarıdaki sonucu verdi.
- Mobil TR/EN modal görsel kontrolü ve iki istemcili gerçek oyun döngüsü PASS.
- Güncel üretim yedeği restore edildi; migration kimlik/koordinat/aktiviteyi korudu.
  Gerçek kopya hesabının gidiş–dönüşü dünya kimlikleri, geliştirmeler ve filoları korudu.
  Eski API yeni şemayı okuyabildi; host kapasite kontrolü PASS.

## Canlı kabul kaydı

Dağıtım ve aktivasyonun işlemsel kanıtı VPS üzerinde
`~/.astera-silent-release-dir` dosyasının gösterdiği özel backup klasöründedir:
release-commit, image kimlikleri, restore/migration logları, roundtrip-proof.json,
canlı health/commit kabul çıktıları ve ilk/sonraki bakım turunun audit çıktıları.
Canlı flag için worker ortamı ve silent_space_maintenance tablosu esas alınır.
Dağıtım boyunca flag kapalı tutulur; dört süreç ve web doğrulandıktan sonra açılır.
Wiki değişiklikleri bu release kapsamına alınmadı.
