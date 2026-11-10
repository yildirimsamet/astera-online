# L. Doğrulama Kontrol Listesi (FAZ 6)

Her satır ölçülebilir bir kontroldür. "Aşama" sütunu, kontrolün K'deki hangi aşamada ilk kez yeşile dönmesi gerektiğini gösterir. Bir aşama, kendi satırları yeşil olmadan kapanmaz.

## 1. Her aşamada (genel)

| Kontrol | Yöntem | Eşik |
| --- | --- | --- |
| Testler koddan önce yazıldı ve FAIL edildi | Commit sırası, test çıktısı | Her davranış değişikliğinde |
| İlgili testler PASS | Hedefli koşu, tek worker | %100 |
| Teslimde tam kapı | `pnpm verify` (uzun testler hariç) | 0 tip hatası, 0 lint hatası, testler yeşil |
| Kapsam | Diff incelemesi | Her satır aşamanın işine bağlı |
| Geri dönüş yolu | Aşama notunda yazılı ve denenmiş (bayrak veya geri commit) | Var |
| Canlıya çıkış | Owner'ın o turdaki onayı | Var |

## 2. Veri bütünlüğü

| Kontrol | Yöntem | Eşik | Aşama |
| --- | --- | --- | --- |
| Hiçbir stok ve gemi sayısı < 0 | DB kısıtı; canlıda sorgu | 0 satır | A4.1 |
| Kaynaklar `double precision` | Katalog testi | Listelenen bütün sütunlar | A4.1 |
| Defter = bakiye | Günlük denetim işi | Sapma 0, 7 gün | A4.2 |
| Gemi defteri = konumlardaki toplam | Günlük denetim işi | Sapma 0, 7 gün | A4.2 |
| Çift harcama yok | Eşzamanlı istek testleri; aynı anahtarla iki istek | Tek ücret | A2.5, A3.3 |
| Geçmiş verisi kalıcı silinmez | Katalog testi: her tablonun sınıfı var; geçmiş sınıfını silen her yol `archiveThenDelete`'ten geçer. Canlıda silinen geçmiş satırı = arşivlenen | Eşit | A2.1 |
| Sezon geçişi tam | Prova: arşiv satırı = kaynak satırı; geçiş sonrası dünya tabloları boş; `return_applications` duruyor | Eşit | A2.1, A4.3 |
| Kalıcı → dünya FK yok | Katalog testi | 0 | A4.3 |
| Şişme | Geçiş sonrası dünya tablolarında index boyutu / veri | Orantılı | A4.3 |
| Hesap silme arşivde iz bırakmaz | Test | Ad alanı yok | A4.4 |

## 3. Tutarlılık ve eşzamanlılık

| Kontrol | Yöntem | Eşik | Aşama |
| --- | --- | --- | --- |
| Deadlock yok | O10'u yeniden üreten test; canlıda `pg_stat_database.deadlocks` | Test yeşil; 30 günde artış 0 | A2.4 |
| Kilit sırası | Kilit yardımcısı dışında `players ... for update` yok (kod araması testi) | 0 ihlal | A2.4 |
| Kilit yükseltme yok | Aynı oyuncunun iki eşzamanlı yazması testi (`FOR NO KEY UPDATE`) | Deadlock yok | A2.4 |
| Wealth kaldırıldı | Kod araması: `recompute*Wealth` yok; Honor gözlem testi yeşil | 0 çağrı | A2.4 |
| Kullanılmayan yük envanteri | Rapor teslim edildi; her madde için owner kararı yazılı | Var | A0.4 |
| Taşınma ile yazma yarışı | `placement-*` testleri yeni modelde | Yeşil | A3.3 |
| Önbellek yazma kararına girmez | İnceleme ve test: yazma yolu kilitli satırı okur | Yeşil | A3.1 |
| Tek worker | İki örnek testi | Biri iş alır | A2.2 |
| Geç olay doğru çözülür | `resolve_at` testleri; geri sarma yasağı testi | Yeşil | A6.1 |
| Galaksiler arası transfer tekrarlanabilir | Adım adım tekrar testi | Yarım transfer tamamlanır | A6.4 veya ayrılma öncesi |

## 4. Performans (ölçüm kapıları)

Koşullar her kapıda aynıdır: `--scenario real`, ×2 etkinlik, 5 üreteç, 60 sn giriş, 300 sn ölçüm, oyun bakımda.

| Kontrol | Eşik | Kapı |
| --- | --- | --- |
| API ms/istek | ~11 (M1), ≤ 9 (M2) | M1, M2 |
| Ortalama deyim/istek | ≤ 3 (M2), ≤ 2,5 (M3) | M2, M3 |
| `RETRYABLE` 503 | 0 | M2 |
| Olay kaynaklı okuma payı | < %10 | M3 |
| Okuma p95 / p99, 200 test oyuncusunda | ≤ 250 / 500 ms | M3 |
| Yazma p95 | ≤ 400 ms | M3 |
| Analitik işinin PG payı | < %5 (canlı `pg_stat_statements`); olgu sayısı eski yolla aynı, tamamlanan siparişler dahil | A1.2 sonrası |
| Worker yükü ve kayıt dalgası ölçüldü | Rapor var | M1 |
| GET rotaları yalnız okur | Deyim testi; istisna listesi yalnız küçülür | A3.0 |
| Canlı CPU/istek ve rota başına deyim panosu | Prometheus panosu ve alarmı; yük testleri seyrek olduğu için regresyonu canlıda yakalar | A1.3 ile |
| Worker olay ortalaması | ≤ 60 ms (canlı metrik) | A6.2 |
| Worker, T1 olay hızında | Gecikme p95 ≤ 1 sn | M4 |
| Sağlık kontrolü | `/livez` 0 deyim; boşta p95 < 10 ms | A1.3 |

Tek koşunun p95'i oynaktır. p95 kararları için aynı gece en az iki koşu yapılır, CPU/istek ile birlikte okunur.

## 5. Gerçek zamanlı

| Kontrol | Yöntem | Eşik | Aşama |
| --- | --- | --- | --- |
| Delta ile tam okuma aynı | Özellik testi: rastgele olay dizisi | Her tür için yeşil | A5.2–A5.4 |
| Sis sızmaz | Görmemesi gereken izleyiciye çerçeve gitmez (test) | 0 çerçeve | A5.4 |
| Başkasının hareketi | Uçtan uca gecikme metriği | p95 ≤ 3 sn | A5.4 |
| Kendi varış sonucu | Uçtan uca gecikme metriği | ≤ 1 sn | A5.5 |
| Kopma ve iyileşme | LISTEN kopma testi, `Last-Event-ID` testi | `resync` doğru | A5.1 |
| Güvenlik ağı fark oranı | İstemci metriği | Taban çizgisi alınır; artarsa alarm | A5.2+ |

## 6. Güvenlik

| Kontrol | Yöntem | Eşik | Aşama |
| --- | --- | --- | --- |
| Süreçler superuser değil | `pg_stat_activity` + `pg_roles` | Yalnız migration'da superuser | A7.1 |
| Uygulama rolü DDL yapamaz, arşivi silemez | Test | Reddedilir | A7.1 |
| Sır ayrımı | `env.ts` şema testleri | Rol yalnız kendi sırlarını ister | A7.2 |
| Refresh token tekrar kullanımı | Test | Aile iptal | A7.3 |
| Valkey kesintisinde giriş | Test | Çalışır ve sınırlı | A7.5 |
| `sql.raw` yalnız kapalı listeden | Lint kuralı | 0 ihlal | A7.1 |

## 7. Operasyon

| Kontrol | Yöntem | Eşik | Aşama |
| --- | --- | --- | --- |
| RPO | `pg_stat_archiver`: son arşiv yaşı | ≤ 60 sn; hata alarmı | Sürekli |
| RTO, veritabanı | Aylık geri yükleme tatbikatı metriği | Ölçülmüş, satır sayıları eşit | A2.6 |
| RTO, uçtan uca | Çeyreklik elle tatbikat | ≤ 30 dk | A2.6 sonrası, owner onayıyla |
| Medya kayıp penceresi | Eşitleme metriği | ≤ 1 saat | A2.6 |
| Dağıtım kesintisi | Dış yoklama ile hata penceresi | ≤ 30 sn | A0.1 |
| Makine dışı alarm | Ölü adam testi: sinyal kesilince e-posta gelir | Geliyor | A2.6 |
| PG ayarları repoda | `pg_settings.source` | `command line` | A0.2 |
| Stage | Kullanılmadığında kapalı | `docker ps`'te stage yok | A0.3 |
| Disk | Alarm eşiği | %85 | A2.6 |

## 8. Blueprint'in kapanışı

- [ ] A1–A4 tamamlandı. Kontrolleri yeşil.
- [ ] M1, M2, M3 sonuçları owner'a raporlandı.
- [ ] 27 Aralık sezon geçişi yeni yolla yapıldı. Arşiv ve sayımlar doğrulandı.
- [ ] A5 ve A6 tamamlandı veya owner kararıyla ertelendi.
- [ ] A7 tamamlandı.
- [ ] A9 için owner'a sunucu kararı verisi sunuldu.
- [ ] Bu klasördeki belgeler son durumla güncellendi. Kod ve testler esas kaynak olarak kalır.
