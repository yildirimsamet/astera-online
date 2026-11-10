# J. Altyapı ve Operasyon (FAZ 4)

- **Dayanak:** ADR-10, 12.
- **Kısıt (owner):** Contabo Cloud VPS 6 ile devam. Bu belgedeki her VPS işlemi uygulama anında owner onayı ister.

## 1. Bugünkü makine

- 6 paylaşımlı vCPU, 11 GiB RAM, disk %81 dolu.
- Prod, stage, izleme ve 19 Ekim tarihli bir veritabanı kopyası aynı makinede.
- Her dakikanın ilk 6 saniyesinde VM dışından gelen takılma ölçüldü. Paylaşımlı çekirdeğin sonucu; yazılımla kaldırılamaz, ancak etkisi azaltılabilir.

## 2. Kaynak önceliği

| İş | Yöntem |
| --- | --- |
| Stage prod'u yavaşlatmasın | Kullanılmadığında durur (owner, 2026-11-06); o gün durduruldu. Açıkken compose'da düşük `cpu_shares` ve `cpus` tavanı (ör. toplam 1,5). Açma ve kapama komutları K, A0.3'te. |
| Prod PG belleği | `shared_buffers` 1 GB, konteyner limiti 4 GiB; değişmez |
| Disk | Eski imaj ve sürüm klasörü temizliği için yazılı kural; %85'te alarm (bugün %15 boşta alarm var) |

## 3. Yapılandırma repoda

- `postgresql.auto.conf`'taki elle verilmiş ayarlar compose'daki `command: -c ...` satırlarına taşınır. Repodan kurulan bir sunucu aynı ayarlarla açılır.
- Sırlar role göre bölünür (H §2). `.env.production.example` buna göre güncellenir.

## 4. Yedek ve geri dönüş (S3, S12)

| Hedef | Bugün | Plan |
| --- | --- | --- |
| RPO ≤ 1 dk | pgBackRest → R2, `archive_timeout=60` | Aynı. Arşiv hatası alarmı (son hata 4 Kasım). |
| RTO ≤ 30 dk | 28 Ekim'de R2'den PITR kabul testi: 51 sn + 4 sn | Uçtan uca tatbikat betiği; aşağıda |
| Medya | Günlük `tar`; ~24 saat kayıp penceresi | Saatlik R2 eşitleme (`rclone` veya pgBackRest dışı basit betik); hedef ≤ 1 saat |

**Tatbikat 1, aylık otomatik:** Aynı makinede geçici konteyner açılır. R2'den son yedek ve WAL geri yüklenir. Satır sayıları canlıyla karşılaştırılır, süre metrik olarak yazılır, konteyner silinir. Başarısızlık alarm üretir.

**Tatbikat 2, uçtan uca, çeyrekte bir (elle):** Bunun için geçici bir saatlik sunucu gerekir; owner onayı ve küçük bir maliyet.
1. Boş bir sunucu.
2. Repodaki kurulum betiği: Docker, compose, ayarlar.
3. R2'den geri yükleme.
4. Uygulama ayağa kalkar.
5. Cloudflare'de origin değişimi provası.

Süre ölçülür. Hedef ≤ 30 dk. Bu betik, gerçek bir sunucu kaybında izlenecek yolun kendisidir.

## 5. İzleme ve alarm

- **Makine içi:** Prometheus ve Alertmanager kalır.
- **Makine dışı:**
  - Dış uptime kontrolü `/readyz` adresine bakar. Owner `api/servers` için bir dış kontrol kurmayı planlamıştı; durumu doğrulanacak.
  - "Ölü adam" kontrolü: Alertmanager'ın sürekli gönderdiği sinyal dışarıda kesilirse e-posta gelir. Makine tamamen düşerse makine içi alarm çalamaz; bu yüzden gerekli.
- **Yeni alarmlar:**
  - Defter sapması (E §3).
  - Arşiv bölümü açılmadı (E §4).
  - Outbox birikmesi.
  - Worker gecikmesi p95 > 1 sn.
  - `resync` oranı (F §7).
  - Geri yükleme tatbikatı başarısız.
- **Claude ile olay müdahalesi (S4):** En son aşama. O gün seçenekler araştırılıp owner'a sunulur. İlke: önce salt okunur teşhis; her değişiklik owner onayıyla.

## 6. Dağıtım (ADR-12)

1. **Migration'lar expand-contract.** Önce ekle, kod iki yapıyla da çalışsın. Sonra okumayı taşı, en son eskiyi kaldır.
2. **Sırayla yeniden başlatma:** Bir API nginx'ten çekilir, yeniden başlatılır, `/readyz` ile beklenir, havuza geri döner; sonra sıradaki. En son worker yeniden başlar; tek örnek kilidi çift worker'ı önler.
   - Bugün oturumların elle uyguladığı bu yol (`~/review-roll.sh`) `deploy/deploy.sh`'a girer.
3. **Kırıcı dünya şeması** değişiklikleri sezon geçişine bağlanır (S5).
4. **Hedef kesinti:** API başına 0, toplam ≤ 30 sn. Ölçülür.
5. **Geri dönüş:** Önceki imaj ve compose sabitlemesi. Bugünkü `runtime-compose.private.json` deseni korunur.

## 7. Operasyon kuralları

- **Canlıda yazma, dağıtım, migration veya yeniden başlatma** yalnız owner o turda isterse yapılır.
- **Yük testleri** bakım penceresinde, ayrı kapasite yığınında koşar; canlı veriye dokunulmaz (bugünkü uygulama).
- **Eski veritabanı kopyaları:** Owner'ın kararıyla en son kopya tutulur (bugün 19 Ekim). Yeni bir kopya alındığında eskisinin silinmesi owner'a sorulur. Kopyalar kişisel veri içerir.
