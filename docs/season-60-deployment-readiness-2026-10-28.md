# 28 Ekim 2026 — 60 günlük sezon yayın hazırlığı

**Canlı geçiş komutu henüz verilmedi.** Bu çalışma hazırlık, paket üretimi ve ayrı stage provasıdır. Canlıya deploy/reset uygulanmaz; owner akşam “başla” dediğinde aşağıdaki son veri kontrolleri ve kesim yapılır.

## Sabit aday ve mevcut durum

- Sunucu/rules adayı: `af3516bdb58e32639ba16643107b41ca3bb5dce9`, `codex/season-60-tempo` dalına push edildi.
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
- Native-production v7 / 1.0.6 imzalı AAB üretildi, imza ve bundletool validate geçti. Yerel dosya: `out/mobile-artifacts/native-production-release/astera-native-production-v7.aab`. SHA256 `c59a73412cafd9a6c30767be3f32fd2d41f61e1695ff7924e8a401e20e761af9`.
- Aynı AAB’den universal APK da üretildi; v2/v3 imza ve package/version bilgileri doğrulandı. Cihaza kurulum ve gerçek cihaz kabulü henüz yapılmadı.
- Native paket, metin düzeltmeleri dahil `84a52a6a` kaynağından yeniden üretildi; önceki v7 hazırlık dosyası güncel paketle değiştirildi.
- Native build metadata source SHA'sını, API origin'ini ve upload sertifikasını tutar. Play Console'da sürüm kodu/dağıtım erişimi ve cihaz kabulü ayrı kapıdır. Private signing anahtarı VPS'ye gönderilmedi.
- Eski stage DB/web/medya ve production hazırlık dump'ı korundu. Dump checksum'ları private dizinde. Stage runtime kendi DB/JWT'sini kullanır; mail ve checkout çıkışları kapalıdır.
- Production için bakım vhost adayı üretildi ve izole `nginx -t` kontrolü geçti; mevcut canlı vhost henüz değiştirilmedi. Bakım yalnız Astera vhost'unu etkilemeli, Nginx tümden durdurulmaz.

## Dominion kararı ve tamamlanan stage provası

Owner 28 Ekim’de **“leaderboard’da ne gözüküyorsa onları kabul ederiz”** dedi. Üç eski sayaç farkı nedeniyle oyuncu puanlarını geri çekme önerisi iptal edildi. Canlı puanları, savaş raporları ve işlem günlükleri değiştirilmez.

Eski image yalnız offline mühürleme sırasında, tam üç kimliğe bağlı +61 kazanılan / +61 kazanılan / +182 kaybedilen tarihsel fark için bir uyarlayıcı kullanır. Uyarlayıcı sadece audit'e verilen sayaç kopyalarından bu farkları çıkarır; eski tam audit bütün işlem denklemlerini doğrulamaya devam eder. Sonuç/sıralama/ödül hesapları özgün sayaçları kullanır. Ek/bilinmeyen fark, başka ruleset, değişen kimlik veya mükerrer uygulama kapanışı durdurur. Bu uyarlayıcı yeni sezon API/worker’ına bağlanmaz.

İşletim dosyaları private VPS hazırlık dizinindedir: `dominion-owner-acceptance.json`, `validate-dominion-acceptance.sql`, `dominion-original-old.ts`, `dominion-accepted-old.ts`, `seal-old.ts`. Ön kontrol ROLLBACK ile biter ve sayaç/günlük yazmaz. Orijinal dosya SHA256 `46f17baca082f6a6f9ceb35c57b19074c47373b651708c12048cf7fcaabf4a94`; uyarlanan dosya SHA256 `9ec08e8ac68a2c8cb2f9594bc7a315199ae34bc7dcc6559337609ec7802562b6`. Eski cache düzeltme SQL'i çalıştırılmamalıdır; dosya hata vererek duran bir korumayla değiştirildi.

Uyarlayıcı önce iki beklenen testte başarısız oldu; uygulamadan sonra 8/8 geçti. Onay işareti yokluğu, fazladan 1 puan farkı, bilinmeyen oyuncu, başka ruleset, daha önce düzeltilmiş sayaçlar, bozuk işlem denklemi ve özgün roster'ın değişmemesi kapsandı. Ayrı kapanış betiği testi de tam dünya kimlikleri ve hata sonrası bağlantı temizliğini doğruladı.

**Gerçek canlı kopyasıyla stage kapanışı/reset tamamlandı:**

- Üç eski dünya eski image/kurallarla mühürlendi. Kabul edilen sayaçlarla 787 public sıralama kaydı ve 9 kaynak ödülü doğrulandı. Her ödülün sırası/tutarı public sıralamayla eşleşti; WAITING ve botlara ödül üretilmedi.
- 1.665 hesap kimliği ve 45 cosmetic kaydı aynı kaldı. Sonuç sayısı kapanışta 686→1.473 oldu ve wipe bu kayıtları korudu; chat/DM arşivleri korundu/arttı.
- Yeni tek dönemde iki MAIN, ruleset19, tam 60 gün ve 8'er anıt açıldı. Wipe yeni dünyaları oluşturana kadar ölçülen süre yaklaşık 138,5 saniyeydi; tüm bakım süresi bu sayıdan uzundur.
- Honor ACTIVE4 ile açıldı; **trafik öncesinde** iki MAIN için benefits1 ve misilleme ganimeti %40 doğrulandı.
- Güncel web `https://stage.asteraonline.space` üzerinde yayınlandı: web SHA `84a52a6a`, sunucu/rules SHA `af3516bd`.
- Gerçek stage HTTP kabulünde birinci sıra ödülü 2.000 alloy / 1.500 crystal / 300 deuterium olarak başkente eklendi. Tekrar join aynı makbuzu döndürdü ve kaynakları yeniden eklemedi. Eski profile sahip istemci 426 ile reddedildi.

### Kaynak ödüllerinin aktarılması

Mevcut MAIN sezonunun **kapanış anındaki Dominion sıralaması** esas alınır. İlk 10 sıra, en az 1 Dominion ve gerçek/uygun hesap koşulu vardır; botun yeri boş kalır, alt sıra yukarı taşınmaz. Sıfır/negatif puana ve WAITING'e ödül yoktur. Force reset ödül hakkını da oluşturur; yeni cycle'a bağlanan ödül, oyuncunun yeni sezona katılmasında başkentine **yalnız bir kez** eklenir. Yeni döneme hiç katılmadan o dönem kapanırsa hak sona erer. Bu kapanışta mevcut gizli Honor sıralaması ödül kaynağına dönüştürülmez.

Stage restore için önemli işletim notu: eski dump'ta bulunmayan yeni tablo bağımlılıkları `pg_restore --clean` işlemini engelleyebilir. Bu provada **yalnız ayrı stage DB** boş oluşturulup `--exit-on-error` ile restore edildi. Üretim DB'sini silme/yeniden oluşturma bu prosedürün kapsamında değildir.

## Oyuncuya görünen metinler — owner düzeltmesi

Owner, bot sınıflandırmasının oyuncuya açıklanmamasını istedi. İstemci kaynağı `84a52a6ae51e03442150abcad565f7e2dfd9b223`: altı dilde sezon ödülü açıklaması ve uygun olmama mesajı, Yarık TR/EN XP yardımı ve TR/EN herkese açık topluluk kurallarındaki ilgili ifadeler temizlendi. Topluluk kuralı otomatik araçları yasaklamaya devam eder. Sıralama/ödül uygunluğu ve sunucu mekanikleri aynı kaldı.

Önce kırmızı, sonra yeşil testler alındı; 205 ilgili web testi geçti. Web typecheck ve değişen TS dosyalarının lint kontrolü geçti. Mevcut görsel harness’in Dominion ödülü senaryosu altı dil × 350/1280 px olmak üzere 12 kontrolde geçti; TR mobil ekranı ayrıca incelendi. Android v7 AAB/APK bu kaynaktan yeniden üretildi, imza ve bundletool doğrulandı. Play Console kod/dağıtım kararı ve cihaz kabulü hâlâ ayrı kapıdır.

Sunucu/rules dosyaları `af3516bd` ile birebir aynı olduğu için mevcut onaylı server image ve gerçek veri reset kanıtı korunur. Web için **`web-stage-privacy` / `web-production-privacy`** paketleri kullanılacak; önceki `web-production` artık yayın adayı değildir. Web release SHA’sı `84a52a6a`, sunucu image SHA’sı `af3516bd` olacaktır. Her ikisi de aynı `season-60-v1` profilini kullanır. Stage’de yeni web release ve 13 başlangıç asset’i, TR/EN public metinler ve beş servis sağlığı doğrulandı; production henüz değiştirilmedi.

## Akşam `başla` sonrası kalacak işler

1. Taze canlı envanterini, player aktivitesini, writer/config/image değişimlerini ve kuyrukları yeniden kontrol et. Gündüz snapshot'ı akşamın son yedeği değildir.
2. Native yeni kurallı paketin oyunculara erişilebilirliğini doğrula. `REQUIRE_CURRENT_RULES=true` eski web/native bundle'ları reddeder; yalnız web yayınlamak kurulu Android'i güncellemez.
3. Onaylı bakım vhost'unu kur/test et; bakım işaretini aç. **Arena + üç API + singleton worker** durdurulur; PostgreSQL/Valkey çalışır. Son transaction'lar bitmeden kapanışa geçilmez.
4. Son tutarlı dump + checksum + aynı gerçek veriyle izole restore/prova; eski web/env/nginx/role image'larını sakla. Doğrulama ve hesap silme/retention güvenceleri [ana runbook](deployment.md) ile aynıdır.
5. Kabul edilen üç Dominion farkı için taze salt ön kontrolü ve owner karar kaydını sakla; sayaçlara/günlüklere düzeltme yazma. Bilinmeyen sapmada dur. Kapanış container’ına yalnız eski audit uyarlayıcısını, doğrulanmış hash ve `SEASON60_ACCEPTED_DOMINION=leaderboard-20261028` ile bağla.
6. Eski image/kurallarla bütün ilgili MAIN/WAITING dünyalarını `forceSeasonEnd` üzerinden mühürle. `SEASON60_EXPECTED_LIVE_IDS` kimlik listesi akşam envanterinden sağlanır; betik birebir eşleşme ister. Wipe öncesinde dondurulan sıralama ve kaynak ödüllerini özgün sayaçlarla karşılaştır.
7. Yeni image'la migration; frozen dünyaları `wipe --yes --days 60 --ruleset 19 --seed <kayıtlı>` ile yenile. Yeni sezonda Honor ACTIVE4 ve benefits1 trafik öncesinde zorunludur.
8. İki yeni MAIN / tek cycle / 60 gün / 8'er anıt / kalibre radyasyon / spawn gate / takvim / tek lifecycle olayları, kalıcı hesap/cosmetic/sonuç/lifetime/ödül ve foreign key kontrollerini geçir.
9. Worker, API'ler, Arena; image/SHA/health/schema/queue/SSE/istemci kontrolleri. Hazır `web-production-privacy` paketini eski hashed asset'leri koruyarak yayınla. Dış kabulden sonra bakım işaretini kaldır.

Yeni dünya yazımları başladıktan sonra eski dump geri yüklenmez; ileri düzeltme yapılır. Bu belge şimdi canlı müdahale yetkisi değildir; owner'ın beklenen başlangıç komutu korunur.
