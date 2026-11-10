# M. Plan İncelemesi (2026-11-06)

- **İstek (owner):** Planı baştan sona incele; eksik, yanlış ve tahmine dayalı noktaları, daha iyi kararları ve sırayı kontrol et.
- **Yöntem:** Kritik iddialar koda ve canlı kataloğa karşı yeniden doğrulandı. Canlıya erişim salt okunurdu.
- **Sonuç:** Düzeltmeler ilgili belgelere işlendi. Bu dosya ne değiştiğinin kaydıdır.

## 1. Yanlış olan ve düzeltilenler

| # | Hata | Kanıt | Düzeltme | Belge |
| --- | --- | --- | --- | --- |
| 1 | Kod tabanının durumu planda yoktu | Canlı `62a3f65b`. Yerel master origin'i içermiyor (1/2 ayrık). 732 değişmiş dosya. | A0.0: önce başlangıç galaksisi commit'i, birleştirme, temiz taban | K |
| 2 | `TRUNCATE`'in kalıcı veriye dokunmayacağı varsayımı | `return_applications` (sezon dışı, 73 satır) `players`'a `SET NULL` FK ile bağlı; `TRUNCATE` onu da boşaltırdı. Kapanış 73 tablo. | Bugünkü `DELETE` + arşiv + `REINDEX CONCURRENTLY`; kalıcı → dünya FK yasağı | C, E, G, H, K, L |
| 3 | "Veriyi yok eden dört yol" | 75 dosyada 299 silme noktası | "Geçmiş" ve "geçici durum" sınıfları; yalnız geçmiş arşive; envanter A2.1'in ilk işi | D, E, G, K, L |
| 4 | Analitik imleci sonuçları kaçırırdı | İşin ikinci yarısı `status='COMPLETED'` siparişleri arıyor; tamamlanma saatler sonra | Sonuç olguları için ayrı imleç veya tamamlanmayı yazan worker transaction'ı | C, E, K, L |
| 5 | Komut zarfında kilit yükseltme deadlock'u | Önerilen `FOR SHARE`, aynı transaction'da wealth `UPDATE`'ine yükseliyordu | `FOR NO KEY UPDATE`; kilitten sonra sahip yeniden doğrulanır | D, G, L |
| 6 | A4'e yanlış son tarih | 27 Aralık için yalnız "sezon silmesinden önce arşiv" gerekiyor (A2.1) | Son tarih A2.1'de; A4 sıkıştırılmaz | K |
| 7 | A4.2 (defter) küçük gösterilmişti | 32 dosyada 52 gezegen güncellemesi, gemi değiştiren 31 dosya | "Planın en büyük refactor'ü" olarak işaretlendi | E, K |

## 2. Eksik olan ve eklenenler

1. **Okurken yazan GET rotaları.** 118 GET'in yalnız 34'ü kira dışı listede. Envanter yoktu; A3.0 eklendi.
2. **Worker yük testi çok geçti** (A6). Worker T1–T2 arasında doyabilir; M1'e alındı.
3. **Kayıt dalgası testi K'de yoktu.** Reklamdan önce zorunlu; M1'e eklendi.
4. **`PLACEMENT_POOL_MAX` 2 → 4 hiç denenmedi.** Tek satır; M1'de denenir.
5. **Canlıda sürekli CPU/istek ve deyim panosu.** Yük testleri seyrek, regresyon canlıda yakalanmalı; L'ye eklendi.
6. **Arşiv RTO'yu büyütür.** Dışa alma eşiği (geri yükleme > 10 dk veya arşiv > 2 GB) eklendi (E §4).
7. **`pg_stat_statements` 58 kayıt tahliye etmiş.** Canlı ölçümdeki çağrı sayıları alt sınırdır (E §7).

## 3. Daha iyi olabilecek kararlar

| Konu | Önceki | Daha iyi aday | Durum |
| --- | --- | --- | --- |
| Wealth deadlock'u | Kilit sırasıyla yamamak | Wealth'i yazmalarda tutmamak, kullanıldığı anda hesaplamak (90 çağrı, her yazmada çok tablo okuması) | Owner kararı: tamamen silinir (K A2.4) |
| Olay okumaları | Hemen delta yayını (A5) | Önce galaksi başına hazır yanıt (A5.0); istemci değişmez. Delta yalnız gerekirse. | K'ye işlendi; M2'ye bağlı |
| Kira havuzu | 179 yazma rotasında komut zarfı (A3.3) | Önce ölç: CPU düşünce kira süresi de düşer | K'ye işlendi; M2'ye bağlı |
| Şişme | `TRUNCATE` | `REINDEX CONCURRENTLY` | İşlendi |
| Valkey düşerse giriş | Süreç içi yedek sınırlayıcı (H §4) | Bugünkü kapalı kalma bilinçli bir tercihti; değiştirmek güvenlik ve UX ödünleşimi | Owner kararı: yedek sınırlayıcı (A7.5) |

## 4. Emin olmadığım ve tahmine dayanan noktalar

| Nokta | Neden belirsiz | Ne zaman ve nasıl doğrulanır |
| --- | --- | --- |
| Kapasite kazançları (~450–510 test oyuncusu) | Raporun bütçe hesabı | M1–M3 |
| T1/T2 çekirdek hesabı | Oyuncu başına 0,8–0,9 istek/sn varsayımı; canlıdaki 0,327 küçük galaksiden | Yeni istemci canlıya çıkınca canlı karışım yeniden ölçülür |
| Worker tavanı ve olay hızı | Bot olayları dahil, doğrusal büyüme varsayımı | M1 worker testi |
| Node 24 kazancı | Node 22'de bayrakla ölçüldü | M1 |
| Gruplu gönderimin bizim katmanda nasıl yapılacağı | `postgres.js` dizi dönüşü / `Promise.all`; Drizzle desteği belirsiz | A3.2 prototipi |
| Sisli deltanın okuma ucuyla aynı fonksiyonla yazılabilmesi | F'nin en zor parçası | A5.4 öncesi prototip |
| PITR testi 51 + 4 sn | Başka oturumun kaydı; ben doğrulamadım | A2.6 ilk tatbikat |
| `pending_leak_*` ve tamponlarda `>= 0` | Kural anlamı koddan doğrulanmadı | A4.1 testleri |
| Rol değişikliğinde `ALTER DEFAULT PRIVILEGES` ve Drizzle migration'ları | Uygulamada denenmedi | Stage provası |
| `REINDEX CONCURRENTLY` süresi ve disk ihtiyacı | Ölçülmedi | A4.3 provası |

## 5. Owner'a açık sorular

1. **Wealth:** Owner sordu: "aktif kullanılıyor mu?" Yanıt (kodla doğrulandı): hayır.
   - Koruma bandı D49'da kademeye geçti.
   - İstemci göstermiyor.
   - `bestWealth` kaydını okuyan yok.

   **Karar:** Wealth tamamen silinir (K A2.4). Benzer kullanılmayan yükler A0.4 envanterinde listelenir; her madde owner onayıyla silinir. **Kapandı.**
2. **Geçmiş verisi listesi:** Owner sordu: "Üretimler dahil mi?" Yanıt: evet.
   - Gemi, bina ve araştırma siparişleri bugün sezon boyunca duruyor, sezon sonunda ve koltuk geri almada siliniyor; arşive girecek.
   - Kaynak ve gemi üretimi bugün **yalnız toplam olarak** tutuluyor:
     - gezegende `season_telemetry`: üretilen kaynak, üretim süresi, gövdeye göre inşa edilen gemi (`schema.ts:1506`)
     - sezon sonuçlarında ekonomi ve savaş istatistikleri (`schema.ts:685-700`)
   - Ne zaman, neden ve hangi olayla üretildiği tutulmuyor. Defter (A4.2) bunu olay bazında ekler: tick başına üretim satırı, gemi defterinde inşa ve kayıp.

   **Liste onaylandı. Kapandı.**
3. **Valkey:** Owner kapatmayı sakıncalı buldu. Karar: yedek sınırlayıcı (H §4). **Kapandı.**
4. **Taban:** Başlangıç galaksisi oturumu, iş bitip dağıtım zamanı gelince commit eder. Uyarı o oturuma iletildi. **Kapandı.**
