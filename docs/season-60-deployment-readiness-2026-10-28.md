# 28 Ekim 2026 — 60 günlük sezon yayın hazırlığı

**Canlı geçiş komutu henüz verilmedi.** Bu çalışma hazırlık, paket üretimi ve ayrı stage provasıdır. Canlıya deploy/reset uygulanmaz; owner akşam “başla” dediğinde aşağıdaki son veri kontrolleri ve kesim yapılır.

## Sabit aday ve mevcut durum

- Aday kaynak: `af3516bdb58e32639ba16643107b41ca3bb5dce9`, `codex/season-60-tempo` dalına push edildi.
- Worktree: `../blindspace-season-60-tempo`; güncel master `460e8508` birleşti. Yarık radar düzeltmesi ve 3/3 dakika servis/tamir değişikliği korunuyor; Amiral 10/60 dakika ayrı kalıyor.
- Server image: `astera-server:af3516bdb58e32639ba16643107b41ca3bb5dce9`; ID `sha256:3e0118913ec663a8b17aa26e3de881891a128ca47a560145dbfba156f586a2b6`.
- VPS hazırlık dizini: `~/releases/season60-20261028`; gizli yedekler `~/backups/season60-20261028`. Gerçek hesap/sonuç dökümleri ve runtime env yalnız private dizinlerde tutulur.
- Canlı API1/2/3/worker `35ba732b`; Arena ve public web `460e8508`. Mevcut çalışan config/image'lar role göre saklandı; tek eski image varsayılmadı.
- Canlı üç dünya: EU-1 / EU-2 / WAIT-1, ruleset16, bitiş 3 Kasım 2026 18:56:16 UTC. Hazırlık snapshot'ı 1.665 hesap içeriyordu; bu sayı akşam yeniden ölçülür.

## Yeni sezonda ne açılacak?

| Mekanik | Mevcut canlı | Yeni dönem |
| --- | --- | --- |
| Takvim ve tempo | 30 gün; eski tempo | Tam 60 gün; rafineriler ×0,85; sıradan iş süreleri ×1,15; harita araç hızları ×0,90; gezegen yarıçapları ×0,80. Özel silah istisnaları önceki planla aynı. |
| Honor v4 | MAIN'lerde SHADOW, successorAnnounced=true | İki MAIN'de başlangıçtan ACTIVE; yeni sıralama ve pozitif/negatif puan. WAITING'de yarış yok. |
| Honor ekonomik programı | benefits_version=NULL | **Owner 28 Ekim açıkça tamamını onayladı:** benefits_version1; tamir bedeli, konvoy ödülü, tüccar komisyonu. Yeni MAIN'lerde trafik açılmadan ayrıca etkinleştirilip doğrulanacak. |
| Honor misilleme ganimeti | %40 zaten açık | %40 devam. |
| Anıt hareketi / entity radyasyonu | Ayrı epoch ile zaten açık | Ruleset19'da başlangıçtan açık; yeni mekanik diye sunulmaz. |
| Radyasyon bombaları / kalibrasyon / kalkan | Ayrı epoch ile zaten açık | Başlangıçtan güncel kurallar. |
| Amiral | 27 Ekim epoch'u ile zaten açık | Ruleset19'da başlangıçtan açık. |
| Spawn gate / dinamik hedefler | Zaten açık | Başlangıçtan açık; 31–60. gün üretimi önceki testlerde kapsandı. |
| Sezon ödülleri | Program1 | Aynı program; eski kazanılmış haklar bir sonraki cycle'a bağlanır. |
| Yarık skinleri / Kalp / Öz | Ertelenmiş kapsam | Reset bunları otomatik açmıyor; ayrı geliştirme/onay gerektiriyor. |

Kod ve canlı epoch/env/konfigürasyonu birlikte incelendi. Yeni sürüm numarası tek başına eski sezonda kapalı özellik kanıtı sayılmadı.

Honor ekonomik oranları: pozitif kademede tamir −%5/−%10, konvoy +%15/+%30; negatif kademede tamir +%5/+%10, konvoy −%15/−%30 ve tüccar komisyonu %7/%14. Fiyat/süre farklıdır: Honor burada tamir kaynak bedelini değiştirir.

## Hazır artefaktlar ve kontroller

- Server image ile stage/prod için ayrı web-dist paketleri VPS'de hazır. İkisinde `VITE_ARENA=1`; stage analytics boş, prod mevcut analytics girdisini koruyor.
- Son master birleşimi için 63 rules + 86 server + 82 web hedefli test; bütün workspace typecheck ve değişen dosyaların lint kontrolü çalıştırıldı. Önceki geniş doğrulama [tempo planında](season-60-tempo-transition-plan.md#8-yerel-uygulama-kaydı).
- Native-production v7 / 1.0.6 imzalı AAB üretildi, imza ve bundletool validate geçti. Yerel dosya: `out/mobile-artifacts/native-production-release/astera-native-production-v7.aab`. SHA256 `05e1ed758d1a33d372e0e17fae765ce82e5c7752119ffc30f2b4af293850459b`.
- Aynı AAB’den universal APK da üretildi; v2/v3 imza ve package/version bilgileri doğrulandı. Cihaza kurulum ve gerçek cihaz kabulü henüz yapılmadı.
- Native build metadata source SHA'sını, API origin'ini ve upload sertifikasını tutar. Play Console'da sürüm kodu/dağıtım erişimi ve cihaz kabulü ayrı kapıdır. Private signing anahtarı VPS'ye gönderilmedi.
- Eski stage DB/web/medya ve production hazırlık dump'ı korundu. Dump checksum'ları private dizinde. Stage runtime kendi DB/JWT'sini kullanır; mail ve checkout çıkışları kapalıdır.
- Production için bakım vhost adayı üretildi ve izole `nginx -t` kontrolü geçti; mevcut canlı vhost henüz değiştirilmedi. Bakım yalnız Astera vhost'unu etkilemeli, Nginx tümden durdurulmaz.

## Stage provasında yakalanan kapanış engeli

28 Ekim canlı kopyası eski `35ba732b` image'ıyla mühürlenirken EU-1'in Dominion audit'i durdu. Aynı salt-okunur karşılaştırma canlıda da üç eski cache farkını doğruladı:

- İki hesapta `dominion_taken`, işlem günlüğü toplamından 61 fazla.
- Bir hesapta `dominion_lost`, işlem günlüğü toplamından 182 fazla.
- Dünya savaş raporları ile `dominion_events.transfer` arasında fark bulunmadı.
- Klan bakiyeleri için ayrı günlük karşılaştırması da geçti; fark yok. Farkın eski oluşum nedeni kesinleşmiş diye sunulmaz; bu yeni tempo değişikliğinin yazdığı veri değildir.

Kapanış kontrolü kaldırılmadı. Yalnız bu üç kimliği ve tam farkları kabul eden, farklı/ek sapmada duran, tekrar çalışınca değişiklik üretmeyen SQL hazırlandı. İşlem günlüğünü veya savaş kayıtlarını değiştirmez. Stage uygulaması ve akşamki canlı düzeltme için owner kararı istendi; karar gelmeden uygulanmaz. Bu engel çözülmeden “stage reset geçti / canlı hazır” denmez.

Onay beklenirken stage eski DB yedeğine ve beş eski app container’ına döndürüldü. Restore sırasında eski dump’ta bulunmayan yeni bir tablonun bağımlılıkları `pg_restore --clean` işlemini engelledi. Yalnız ayrı stage veritabanı boş oluşturulup `--exit-on-error` ile restore edildi; beş stage rolünün `/health` yanıtı `ok=true`, public site HTTP200. Prod’un beş rolü de `ok=true`; prod’a yazım/deploy yapılmadı. Sonraki stage provası da temiz stage DB ile başlamalıdır. Üretimde veritabanı silme/yeniden oluşturma bu adımın kapsamında değildir.

Kapanış betiğinin tam kimlik koruması için önce başarısız test, sonra başarılı kontrol alındı: eksik/bozuk/tekrar eden envanter, aynı sayıda farklı dünya ve hata sonrası bağlantı kapanışı kapsandı. Betik `SEASON60_EXPECTED_LIVE_IDS` olmadan mühürlemeye başlamaz; akşam bu değişken taze envanterden oluşturulur.

## Akşam `başla` sonrası kalacak işler

1. Taze canlı envanterini, player aktivitesini, writer/config/image değişimlerini ve kuyrukları yeniden kontrol et. Gündüz snapshot'ı akşamın son yedeği değildir.
2. Native yeni kurallı paketin oyunculara erişilebilirliğini doğrula. `REQUIRE_CURRENT_RULES=true` eski web/native bundle'ları reddeder; yalnız web yayınlamak kurulu Android'i güncellemez.
3. Onaylı bakım vhost'unu kur/test et; bakım işaretini aç. **Arena + üç API + singleton worker** durdurulur; PostgreSQL/Valkey çalışır. Son transaction'lar bitmeden kapanışa geçilmez.
4. Son tutarlı dump + checksum + aynı gerçek veriyle izole restore/prova; eski web/env/nginx/role image'larını sakla. Doğrulama ve hesap silme/retention güvenceleri [ana runbook](deployment.md) ile aynıdır.
5. Dominion düzeltmesi onaylandıysa taze preview'yi kaydet ve korumalı düzeltmeyi uygula. Bilinmeyen sapmada dur.
6. Eski image/kurallarla bütün ilgili MAIN/WAITING dünyalarını `forceSeasonEnd` üzerinden mühürle. `SEASON60_EXPECTED_LIVE_IDS` kimlik listesi akşam envanterinden sağlanır; betik birebir eşleşme ister.
7. Yeni image'la migration; frozen dünyaları `wipe --yes --days 60 --ruleset 19 --seed <kayıtlı>` ile yenile. Yeni sezonda Honor ACTIVE4 ve benefits1 trafik öncesinde zorunludur.
8. İki yeni MAIN / tek cycle / 60 gün / 8'er anıt / kalibre radyasyon / spawn gate / takvim / tek lifecycle olayları, kalıcı hesap/cosmetic/sonuç/lifetime/ödül ve foreign key kontrollerini geçir.
9. Worker, API'ler, Arena; image/SHA/health/schema/queue/SSE/istemci kontrolleri. Hazır production web paketini eski hashed asset'leri koruyarak yayınla. Dış kabulden sonra bakım işaretini kaldır.

Yeni dünya yazımları başladıktan sonra eski dump geri yüklenmez; ileri düzeltme yapılır. Bu belge şimdi canlı müdahale yetkisi değildir; owner'ın beklenen başlangıç komutu korunur.
