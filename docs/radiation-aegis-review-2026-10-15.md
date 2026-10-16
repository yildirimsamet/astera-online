# Aegis / radyasyon CR — 15 Ekim 2026

Kapsam yalnız bu taskın 30 dakika radyasyon, Aegis koruması, koruma göstergeleri ve kalkan dolum beklemesi değişiklikleridir. Master’daki Honor, tatil ve trade çalışmalarının bağımsız davranışları yeniden tasarlanmadı. Ortak migration’da yalnız Aegis DDL tekrarını gideren entegrasyon düzeltmesi yapıldı.

## Doğrulanmış bulgular

| Önem | Bulgu | Kanıt / düzeltme |
| --- | --- | --- |
| Yüksek | Geç filo dönüşü, dolmuş Aegis’in tarihsel etkinleşmesini son economy tick’ine kaydırabiliyordu. Gemi geçmiş aralık için fazla doz yiyebilirdi. | `radiation-aegis-history.test.ts`: 15:01.784 etkinleşmesi 20:00’a kaydı; RED. Sync artık tarihsel arrival ile gözlenmiş economy saatini ayırır, gerçekleşmiş etkinleşmeyi korur. Aynı lotun geç iniş dozu değişmez; ilk düzeltme GREEN. |
| Orta | Toparlanma sürerken yeni radyasyon koruması sayacı yalnız normal cooldown’u dikkate alıyor, korumanın 15 dk erken döneceğini söylüyordu. | Aynı dosyada `recoveryUntil=30dk`, `shieldRegenAt=15dk`; RED. API dönüş anına toparlanma/tatil sınırı eklendi; 12 ilgili testle GREEN doğrulandı. |
| Yüksek | Gecikmiş Core/Aegis işi eski koruma ile geleceğin dozunu kapatabiliyor; yeni epoch worker saatine göre başlıyordu. | `radiation-aegis.test.ts`: beklenen 15 HP yerine 26 HP RED. İlgili iş tamamlanmadan kalıcı settlement durur; donanım gerçek readyAt’te uygulanır. GREEN. |
| Orta | Kendi gezegeninin harita kadranı Aegis’i kullanmıyor, L1’de 0 yerine araştırma sonrası 6,12 gösteriyordu. | `target-radiation-protection.test.tsx` RED; o hedefe ait mevcut WorldProvider verisi kullanıldı. Yeni ağ sorgusu yok; GREEN. |
| Yüksek | Yeni trade migration’ı snapshot eksikliği yüzünden Aegis tablosunu tekrar yaratıyordu. | Gerçek migration testi `relation planet_aegis_epochs already exists` RED. 0171 snapshot’ı tamamlandı, 0172’de trade sütunları korundu ve Aegis DDL tekrarı çıkarıldı. 159 sunucu regresyonu GREEN. Önceki dosyalar `/tmp/astera-aegis-migration-backup-20261015-1930` altında. |
| Düşük | Her mutating planet load’da binalar, cihazlar ve arızalar ikinci kez okunuyordu. | `aegis-query-cost.test.ts`: beklenen 1 bina SELECT’i yerine 2 RED. Kilitli yüklemenin mevcut donanım verisi sync’e geçirilir; üç tekrar sorgusu kalktı. GREEN. |

## Kontrol edilen etkileşimler

- Kaynakların toplamı önce 50 ile sınırlanır; Aegis bir kez çıkarılır; sonra her geminin sahibi/taşınan araştırması uygulanır. Honor ve ölüm tahmini aynı korunmuş dozu kullanır.
- 0 HP korumaz, ilk tam 1 HP’de koruma döner; 15 dk dolum beklemesi ve daha uzun EMP korunur. Zaten boş kalkanı tekrar vurmak beklemeyi uzatmaz.
- Ham kaynak, yeşil duman, seviye, ayrı süreler ve tehlike rengi net doz 0’da da kalır. 10 Aegis + L1 = 0; + ikinci L1 = 8 HP/dk; araştırma varsa 8 daha da azalır.
- Tamamen engellenen ilk L1’de ücretli onarım sürer. İkinci L1 hasar geçirince REPAIR tam invoice iadesiyle bir kere iptal edilir; gemi yarası korunur. RETURN/tahliye açık kalır.
- Klan savunma desteği ve STAGED saldırı havuzu, ev sahibi Aegis’ini ve kendi komutanının araştırmasını kullanır. Kazıcı/kara savunması kapsamı değişmez.
- Read-only gösterim fiziksel envanteri/epoch’u yazmaz; geç landing, NPC ve kuyruk teslimi aynı zaman sınırlarını korur. Araştırma/Core/Aegis tamamlanması geçmişe uygulanmaz.

## Kanıt durumu

- İlk paket: 66 sunucu, 137 web, 17 rules testi PASS.
- Genişletilmiş regresyon: 10 sunucu dosyası / 159 test PASS; normal ve klan savaşı, destek, arıza, üretim kuyruğu, NPC ve view sorgu kontrolleri dahil.
- Query/adoption/Aegis tekrarları: 15 sunucu testi PASS. Kadran/hook/i18n/Wiki: 139 web testi PASS. Üç workspace typecheck PASS (son CR düzeltmeleri öncesi).
- Türkçe 350px/1280px görsel kontrol PASS; koruma bilgisi açılması, taşma, 0 hasarda gerçek WebGL dumanı, 18 ham / 8 net stack, 3D uçuş/egzoz/çarpma ve sarı-turuncu-kırmızı geçişler ölçüldü. `/tmp/astera-aegis-visual-tr/checks.json`.
- Son CR sonrası GREEN, güncel lint/tip, diğer beş dilin görsel kontrolü ve temiz DB migration provası kapanışta eklenecek. Bu belge tamamlanmamış kontrolü başarılı saymaz.

## Sonraki owner düzenlemesi

Core 13 (kademe 5) hem Ölüm Yıldızı hem üç radyasyon bombasının **yeni üretim** şartı olacak. Mevcut stok/uçuş iptal edilmeyecek. Anti-battery başlangıç kapasitesi 2; Önleme Ağı L1=4, L2=6, L3 yok. Araştırma hazır mühimmat vermez; her şarj ayrı üretilir. Mevcut L1 oyuncu 4’te kalır ve L2’yi satın alabilir. İkinci seviyenin fiyat/süre formülü mevcut araştırma hesabını kullanır. API, üretim arayüzü, araştırma kazançları, altı dil ve Wiki birlikte doğrulanacak.

Son CR tekrarı: `radiation-aegis-history`, `radiation-aegis`, `aegis-query-cost` toplam 12 test PASS (`/tmp/astera-aegis-cr-green.log`). Yeni ikinci Önleme Ağı seviyesi düz fiyatlı tek-seviye profile dayanıyordu; mevcut “her rung daha pahalı” kural testi RED verdi. L1 fiyatı/süresi korunup yeni L2 mevcut 1,8 araştırma büyümesine bağlandı.

Kapanış kontrol noktası (20:12):
- Geniş paket: 23 sunucu dosyası / 212 senaryo içinde 209 PASS. Kalan üç eski beklenti 30 dk NPC doğum sınırı (2) ve takviyenin kurduğu Aegis koruması (1) idi; runtime davranışı yeni karara uygundu. Doğum senaryosu etkin yarım saatin içine taşındı, tam 30. dk doğum/bağışıklık ayrıca eklendi; NPC’nin eski ve yeni cohort’ları için Aegis sonrası doz ayrı doğrulandı.
- Yeni, ayrı `astera_aegis_clean_20261015_test` DB’sinde 173 migration sıfırdan kuruldu. Tekrar migration çağrıları da sorunsuz. API contract, iki yeni stratejik denge testi dosyası, history ve NPC düzeltmeleri dahil 5 dosya / 116 senaryo PASS.
- Yeni stratejik kapı/kapasite çekirdek paketi: 136 rules + 14 sunucu + 117 web senaryosu PASS. Batarya UI’da L0/L1/L2 için 2/4/6 Tally ve Core 12’de reddetme/Core 13’te üretme ayrıca doğrulandı.
- İkinci Önleme Ağı seviyesi ve 2→4→6 açıklaması nedeniyle eski çeviri regex’i güncellendi; 102 çeviri testi PASS. Diğer son web kontrolleri PASS.
- Üç ardışık root lint grubu PASS: `out/trade-recall/final-results.json` (20:08). Paylaşılan workspace’in gerçek dosyalarını kontrol eder; başka taskların değişiklikleri bu CR’nin sahipliği sayılmaz.
- Son üç-workspace typecheck, tam ordinary rules ve yeni kapasite/diğer diller görsel sonuçları işlem bitiminde eklenecek.

Ek UI bulgusu: yeni iki-seviyeli Önleme Ağı’na geçerken dolu L1 bataryanın “daha fazla kapasite” yönlendirmesi eski `gridLevel < 1` koşulunda kalmıştı. Dolu 4 şarjda L2/6 şarj bağlantısı yoktu; `interceptor-control` yeni testi RED verdi. Koşul gerçek araştırma tavanından okunacak, sonraki kapasite bir sonraki seviyeden hesaplanacak şekilde düzeltildi. L2/6 doluyken bağlantı kalkar. Batarya kapasitesi artık yuvaların yanında sayıyla da görünür; açıklaması hem Ölüm Yıldızı hem radyasyon bombası ve hedef gezegen bataryasının şarj tüketimini anlatır.

Normal rules taraması: 134 dosya / 2360 senaryoda 2358 PASS. İki eski sabit beklenti (toplam araştırma rung sayısı 57→58, en fazla önleyici şarj 4→6) yeni owner kararına uyarlandı; iki dosya / 35 senaryonun tekrarı PASS. Runtime kaynakları bu tekrar için değiştirilmedi.

Son zaman sınırı bulgusu: geçmiş `readyAt` ile çalışan Aegis tamamlanması, daha yeni bir tick’i olan gezegende normal ekonomi tarafından zaten korunuyordu; fakat toparlanma/tatil kısa yolu aynı monoton saat korumasına sahip değildi. `radiation-aegis-history` testinde toparlanma açıkken `lastTickAt` 02:00’dan 01:00’a geriledi (RED); toparlanmasız kontrol PASS. Kısa yol `max(previous.lastTickMinutes, nowMinutes)` kullanacak şekilde düzeltildi. Donanımın gerçek readyAt sınırı korunur, birikmiş kaynaklar tekrar üretilmez. Economy/build queue/Aegis regressions GREEN kontrolü çalıştırılıyor.

Son arayüz tekrarı: `interceptor-control` 30 + `i18n` 102 = 132 PASS. Son batarya görselleri 350/1280px, TR/EN, 2/4/6 kapasite ve dolu L1→L2/6 yönlendirmesi dahil PASS (`/tmp/astera-strategic-capacity-visual-final/checks.json`). Radyasyon TR/EN/DE ve FR/ES/JA görselleri PASS; kalan dillerde kontrol aracının yerel PV birimini tanıması düzeltildi. Gerçek WebGL dumanı, raw 9 / net 0 ve raw 18 / net 8 bütün dillerde kontrol edildi.

Kapanış doğrulamaları:
- Monoton saat düzeltmesinden sonra `economy`, `build-queue`, `radiation-aegis`, `radiation-aegis-history`: 4 dosya / 79 test PASS (`/tmp/astera-aegis-late-economy-green.log`).
- Son değişen 19 kaynak/test/locale/tool dosyası `pnpm lint` ile ayrıca sınırlandırılarak kontrol edildi; çıktıdaki dosya listesi de sayılarak doğrulandı: 19/19, sıfır hata (`/tmp/astera-final-scoped-lint.log`).
- Bu sırada başka yerel task’ın daha yeni genel lintinde `fault-attack.test.ts` ve `fault-development-protection.test.ts` dosyalarında 8 gereksiz type-assertion hatası görüldü. Bu dosyalar bu taskın CR/fix kapsamında değildir. Önceki üç grup PASS sonucu kendi zamanının kontrol noktasıdır; bütün kirli workspace için güncel yeşil iddiası değildir.
- Radyasyon bütün altı dilde 350/1280px PASS: `/tmp/astera-aegis-visual-tr/checks.json`, `/tmp/astera-aegis-visual-en/checks.json`, `/tmp/astera-aegis-visual-de/checks.json`, `/tmp/astera-aegis-visual-remaining/checks.json`.
- Son batarya 12 durum ve ek dolu-L1 senaryoları PASS: `/tmp/astera-strategic-capacity-visual-final/checks.json`. Kapasite 0/2, 0/4, 0/6 sayıyla görünür; L1 dolu 4/4 → L2/6 yönlendirmesi vardır.

Kapanış: Son runtime/UI düzeltmelerinden sonra rules, server ve web typecheck tekrarları PASS (`/tmp/astera-final-types.log`). Core 13 üretim şartı ve 2→4→6 kapasite düzenlemeleri tamamlandı. Yukarıdaki ara kontrol notlarının bekleyen adımları sonuçlandı; güncel sonuçlar kapanış kayıtlarıdır. Çalışma master üzerinde yereldir; commit, push, canlı migration veya deploy yapılmadı.
