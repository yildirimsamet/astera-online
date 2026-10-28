# 28 Ekim 2026 — canlı yayın ve 60 günlük sezon geçişi

**Tamamlandı.** Owner’ın “AAB sonraki iş; web işini hallet, başla” komutuyla web/sunucu yayını ve force reset uygulandı. Web 28 Ekim **18:43 TR** itibarıyla açık. Android mağaza dağıtımı ayrı iş olarak ertelendi.

## Yayınlanan kaynak ve yeni dönem

| Bileşen | Canlı değer |
| --- | --- |
| Üç API, singleton worker ve Arena | `af3516bdb58e32639ba16643107b41ca3bb5dce9` |
| Server image ID | `sha256:3e0118913ec663a8b17aa26e3de881891a128ca47a560145dbfba156f586a2b6` |
| Web `/release.txt` | `84a52a6ae51e03442150abcad565f7e2dfd9b223` |
| Yeni cycle | `3091367b-4319-417a-8465-dc70b974b513` |
| EU-1 | `35b8eb40-294c-4380-9440-dfbc4016fa97` |
| EU-2 | `514ee1a9-50b8-4985-821b-025bc9255cfc` |
| Takvim | 28 Ekim 2026 18:33:03 → 27 Aralık 2026 18:33:03 TR; tam **60 gün** |
| Kurallar | Ruleset19, `season-60-v1`; her MAIN’de 8 anıt |
| Honor | İki MAIN’de ACTIVE v4, benefits v1, misilleme ganimeti %40 |

Web ile server/rules arasındaki ek kaynak farkı yalnız oyuncu metni ve ilgili test/dokümanları içerir. `apps/server`, `packages/rules` ve Dockerfile farkının boş olduğu build sırasında doğrulandı. İki artifact aynı kurallar profilini kullanır.

Rafineri çıkışı ×0,85; sıradan iş süreleri ×1,15; harita araç hızları ×0,90; gezegen ölçekleri ×0,80. Özel silah ve Yarık istisnaları [onaylı tempo planındaki](season-60-tempo-transition-plan.md) gibi kaldı. Honor’un pozitif/negatif puanı ve sıralamasıyla birlikte tamir bedeli, konvoy ödülü ve tüccar komisyonu programı etkinleştirildi.

## Veri ve ödül güvenceleri

- 1.665 hesabın kimlik/giriş alanları ve 45 cosmetic entitlement kaydı korundu; hash karşılaştırmaları geçti.
- 686 eski sezon sonucu aynen kaldı; kapanıştaki 787 public sıralama kaydıyla toplam **1.473 sonuç** korundu. Görünen eski puan ve sıralamalar esas alındı.
- Önceden saptanan üç Dominion sayaç farkı, owner’ın açık kabulüyle yalnız offline kapanış audit’ine verilen kopyalar üzerinde ele alındı. Oyuncu sayaçları ve immutable günlükler değiştirilmedi. Yeni API/worker bu geçici uyarlayıcıyı kullanmaz.
- **9 kaynak ödülü** doğru sıraya/tutara göre üretildi ve yeni cycle’a PENDING olarak bağlandı. Oyuncu yeni sezona katılınca başkentine tek ödeme yapılır.
- 788 kapanan oyuncu kaydının ömür boyu istatistikleri beklenen şekilde hesaba eklendi. Tüm **1.665 hesabın lifetime toplamı**, aynı son yedekten yapılan bağımsız provayla birebir eşleşti.
- Chat/DM arşivleri korundu; kapanış sonrası 22.840 chat ve 2.922 DM arşiv kaydı var. Foreign key doğrulamaları geçti.

## Son yedek ve gerçek veri provası

Bakım açıldıktan sonra Arena, üç API ve worker durduruldu. Açık yazıcı kalmadığı doğrulandı; eski dünyalar için ortak kapanış zamanı **15:18:08.213 UTC** olarak sabitlendi. Aynı saat hem son yedek provasında hem canlı mühürlemede kullanıldı.

Private yedek: `~/backups/season60-20261028/final-20261028T151313Z`.

- Son dump: 55.708.109 byte; SHA256 `96f01c6a8cca355bd4dd4469c367d94daaae9a7d9bb7438273fc2a07edf78c3c`.
- Eski role image/env/Compose dosyaları, Nginx vhost’u, 723.773.440 byte web arşivi ve 16.998.400 byte medya arşivi saklandı.
- Bu dump ayrı `_test` veritabanına restore edildi. Eski image ile kapanış; yeni image ile migration/wipe/Honor ve gerçek HTTP katılım/tekrar ödeme kontrolleri geçti. Prova yaklaşık 235 saniye, canlı kapanış/reset/aktivasyon yaklaşık 245 saniye sürdü; bunlar toplam bakım süresi değildir.
- Prova container’ı ve geçici veritabanı kaldırıldı. Kısa ömürlü tarayıcı kontrol kimlik bilgileri silindi. Private yedek/kanıtlar mevcut 30 günlük saklama politikasına tabidir.

## Canlı kabul ve loglar

- Beş rolün image/SHA, `/health` ve container içi `/metrics` değerleri doğrulandı; bütün roller sağlıklı. Var olan portlar, bellek sınırları ve runtime ayarları korundu.
- Üç API’de mevcut hesapla kimlik doğrulama, lobby ve eski leaderboard arşivi okundu. Güncel istemci çalışıyor; eski profil 426 UPDATE_REQUIRED alıyor.
- Public HTML, CSP nonce dönüşümü, 13 başlangıç asset’i, lobby, TR/EN public metinler ve web release SHA’sı doğrulandı.
- Gerçek production tarayıcısında masaüstü landing ve mobil oturum dönüşü/oyun haritası açıldı. JavaScript hatası ve API 5xx yok. Kontrol yeni gezegen/üretim/saldırı oluşturmadı; geri dönüş bildiriminin görüldü işareti de gönderilmedi.
- İlk gözlemde uygulama hata/uyarı kaydı, restart, OOM ve başarısız kuyruk işi **0**. Nginx runtime hata kaydı yok. Kısa süre processing görülen normal iş sonraki kontrolde tamamlanmıştı.
- Ek fingerprint kontrolündeki composite-key sütun varsayımı ve API2 metrics kontrolünün host/container port ayrımı düzeltildi; kontroller tekrar geçti. Bunlar ek operatör kontrol komutlarıydı; uygulama kodu veya oyuncu verisi değiştirilmedi.
- Nginx syntax testi geçti. Önceden mevcut MIME/diğer domain server-name uyarıları test çıktısında duruyor; yeni runtime hatası saptanmadı.

Standart Nginx vhost’u geri alındı; geçici bakım yapılandırması ve bakım işareti kaldırıldı. Yeni dünya yazımları başladığından eski dump rutin rollback için geri yüklenmez; sorun olursa ileri düzeltme yapılır.

`REQUIRE_CURRENT_RULES=true` bütün rollerde açık. Owner’ın Android’i ertelemesiyle `MIN_NATIVE_BUILD=0` korundu; eski kurallı native istemciler de profil güncellemesine ihtiyaç duyar. Hazır AAB mağazaya yüklenmedi.

İşletim kanıtları: `~/releases/season60-20261028/production-deployed.json`, final backup altındaki `production-reset-acceptance.json`, `five-role-acceptance.json`, `api-read-acceptance.json`, `public-open-acceptance.json`, `production-browser-acceptance.json` ve log incelemeleri. Aktif rol pinleri `production-runtime-final.json` ve `production-compose-args.json` dosyalarındadır. Bu özel dosyalarda env/hesap verileri bulunduğu için repoya eklenmedi.
