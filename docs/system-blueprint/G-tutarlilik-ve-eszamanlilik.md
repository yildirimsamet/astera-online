# G. Tutarlılık ve Eşzamanlılık (FAZ 4)

- **Dayanak:** ADR-05, 06, 07, 08.
- **İlke:** Kritik işlemlerde güçlü tutarlılık feda edilmez (brief, kural 5). Gevşetilen yerler aşağıda tek tek yazılıdır.

## 1. Tutarlılık sınıfları

| Sınıf | İşlemler | Garanti |
| --- | --- | --- |
| **Güçlü** | Harcama, inşa, araştırma, filo gönderme ve geri çağırma, savaş, yağma, madencilik teslimi, ödül, ödeme, kozmetik, sezon geçişi, koltuk geri alma | Tek transaction; satır kilitleri; DB kısıtları; defter (E §3) |
| **Okuyanın anlık görüntüsü** | Kendi ekranların (`planets`, `planet`, `rewards`…) | Tek sorgu veya `REPEATABLE READ`; yerleşim kontrolü aynı anlık görüntüde |
| **Kısa gecikmeli (≤ 3 sn)** | Başkasının görünür hareketi, saha, korsanlar | Yayın merkezi deltaları (F); kayıpta tam okuma |
| **Gevşek (≤ 30 sn)** | Sıralama, sezon özeti, analitik | Periyodik hesap; önbellek |

Önbellekten dönen okumalar (ADR-03) "okuyanın anlık görüntüsü" sınıfını korur. Önbellek girdisi bir sürümle tutulur. Sürüm NOTIFY ile değiştiğinde girdi geçersiz olur. Geçersiz kılma bir NOTIFY gecikmesi kadar geride kalabilir (milisaniyeler). Bu yüzden önbellekten dönen veri **hiçbir yazmanın karar girdisi değildir**: yazmalar her zaman kilitli satırı yeniden okur.

## 2. Komut zarfı ve kilit sırası

Her oyuncu yazması ve her olay işleyicisi aynı sırayı izler. Bu sıra deadlock sınıfını kapatır.

1. **Idempotency.** `request_log`'da `(player_id, operation, key)` varsa kayıtlı yanıt döner (yalnız oyuncu komutları).
2. **Sezon.** `seasons` `FOR SHARE`. Dondurma ve geçiş bu satırı `FOR UPDATE` ile alır; böylece bütün yazmaları bekler (bugünkü anlam korunur).
3. **Oyuncular.** İşlemin dokunduğu bütün `players` satırları **id sırasıyla** `FOR NO KEY UPDATE` ile kilitlenir. Komut sahibinde `placement_version` da kontrol edilir.
   - **İnceleme düzeltmesi:** Önceki taslak, komut sahibi için `FOR SHARE` diyordu. Ama aynı transaction sonra wealth için aynı satırı güncelliyor. Aynı oyuncunun iki eşzamanlı isteği ikisi de `SHARE` tutar, sonra ikisi de güncellemeye yükselmeye çalışır: kilit yükseltme deadlock'u.
   - `FOR NO KEY UPDATE` aynı oyuncunun yazmalarını sıraya koyar. Taşınmanın `UPDATE`'i ile çakışır. FK kontrollerinin `KEY SHARE` kilidiyle çakışmaz.
4. **Gezegenler.** `planets` `FOR UPDATE`, id sırasıyla (bugünkü `loadLocked` gibi). Sahibi kilitten önce okunan gezegende sahip, kilitten sonra yeniden doğrulanır. Değiştiyse transaction baştan denenir.
5. **Diğer satırlar.** Görev, birim, sipariş.
6. **Yazımlar.** Sonuç, defter, olay, `request_log`, NOTIFY.

**Kural:** Bir gezegen kilidinden sonra yeni oyuncu kilidi alınmaz.

Bugünkü deadlock (O10) tam olarak bu kuralın ihlali. `recomputePlayerWealth` (`planet.ts:998,1142`) gezegenler kilitlendikten sonra `players` satırını güncelliyor. Başka yollar ise önce `players ... for update`, sonra gezegen kilidi alıyor.

İki düzeltme seçeneği var:

| Seçenek | Ne yapar | Değerlendirme |
| --- | --- | --- |
| a. Kilit sırası | Wealth hesabı, oyuncunun 3. adımda kilitlenmiş olmasını şart koşar | Küçük değişiklik. Yazma başına maliyet aynı kalır. |
| **b. Kullanıldığı anda hesap** | `players.wealth` yazmalarda tutulmaz. Rank floor kontrolünde iki oyuncu için, ekranda bir oyuncu için, sezon sonu ve geri almada kayıt için hesaplanır. | Deadlock'un kökü ve yazma başına maliyet birlikte gider. Ön koşul: hesap maliyeti ölçülür. |

b neden daha iyi (2026-11-06 doğrulaması):
- **Hiçbir oyun kararı wealth'i okumuyor.**
  - Koruma bandı D49 ile kademeye geçti (`packages/rules/src/loot.ts:591`). Sıralama Dominion'a dayanıyor.
  - Şemadaki "rank floor için" açıklaması (`schema.ts:836`) eskimiş.
- **İstemci wealth'i göstermiyor.** `score.wealth` şemada var (`apps/web/src/api/schemas.ts:1181`), ama hiçbir ekranda kullanılmıyor.
- **Kalıcı kayıttaki `bestWealth`** yalnız yazılıyor (`servers.ts:570`, `reclaim.ts:434`); okuyan yok.
- **Maliyeti büyük.** 36 dosyada 90 çağrıyla her yazmada yeniden hesaplanıyor. Fonksiyonda 17 sorgu noktası var; buna Honor gözleminin ~7 sorgusu ekleniyor.

Öneri: Wealth yazmalarda hesaplanmaz. İstatistik için değerli olduğundan sezon sonunda ve koltuk geri almada oyuncu başına bir kez hesaplanıp kayda geçer.

Honor gözlemi (`observeHonorOwner`) bugün bu hesabın içinden çağrılıyor ve kendi oyuncu kilidini gezegenlerden sonra alıyor. Gözlem aynı olaylarda, ama G §2 sırasıyla, ayrı çağrılır. Gözlemin sonucu değişmez; bunu bir test korur.

**Owner kararı (2026-11-06):** Wealth tamamen kaldırılır. Sezon sonu kaydı da tutulmaz (K, A2.4). Benzer başka yapılar A0.4 envanterinde listelenir; owner onayı olmadan silinmez.

Her iki seçenekte de önce bu deadlock'u yeniden üreten test yazılır.

**Yerleşim (ADR-05 ön koşulu).**
- Taşınma, tatil ve transfer `UPDATE players SET placement_version = placement_version + 1` yapar. Bu güncelleme, 3. adımdaki `FOR SHARE` ile çakışır.
- Böylece eski yerleşimle başlamış bir yazma ya taşınmadan önce biter ya da sürüm uyuşmazlığıyla `409` alır.
- Kira havuzu ve paylaşımlı advisory kilit kalkar.
- Worker işleyicileri oyuncu adına değil, olay adına çalışır. Taşınma, uçuştaki olaylarla ilgili bugünkü kuralını korur.

**Doğrulama testleri (önce yazılır):**
- Taşınma ile eşzamanlı filo gönderme.
- Aynı anahtarla çift gönderme.
- O10'daki deadlock.
- Savaş ile eşzamanlı inşa.

## 3. Worker semantiği

- **Teslim:** En az bir kez. Bugünkü gibi, işleyiciler durum iddiası ve tekil index'lerle idempotent (`claimMission`, `dedupe_key`).
- **Zaman:** İşleyici, oyun durumunu **`event.resolveAt` anına** ilerletir ve sonucu o ana göre hesaplar (owner kararı, Y8).
  - `loadLocked(tx, target, clock)` çağrıları olayın zamanını alır.
  - Dönüş uçuşu `resolveAt`'tan başlar.
  - Geç işlenen bir varış, zamanında işlenseydi alacağı sonucu alır.
  - İstisna: Olayın zamanından sonra commit edilmiş bir yazma aynı gezegeni zaten ileri bir ana taşıdıysa geriye gidilmez. Bu durumda olay o anki durumdan çözülür ve metrik sayılır. Tembel ekonomi geriye işletilemez.
  - Bu kural testle sabitlenir.
- **Tek örnek:** Advisory oturum kilidi alınır; açılışta `processing` satırlar `pending`'e döner (E §5).
- **Zaman aşımları:** Worker rolünde `statement_timeout` ve `lock_timeout` (E §8). Zaman aşımına düşen olay yeniden dener. 5 denemeden sonra bugünkü `abandon` kuralı geçerli.
- **Dış çağrılar:** Yalnız outbox'tan, transaction dışında, zaman aşımıyla.
- **Paralel işleme (gelirse):**
  - Anahtar galaksidir. Galaksi içi sıra korunur, galaksiler arası sıra garantisi gerekmez.
  - Galaksiler arası olaylar (transfer) §6'daki iki adımlı yapıyla birbirinden bağımsızdır.

## 4. Kaynak ve gemi değişmezleri

| Değişmez | Nasıl korunur |
| --- | --- |
| Hiçbir stok < 0 | `CHECK` (E §2); clamp yok |
| Stok = başlangıç + Σ defter | Aynı transaction'da defter satırı; günlük denetim |
| Gemi sayısı = Σ gemi defteri | Aynı |
| Bir filo aynı anda tek yerde | `units.location` ve görev durumu aynı transaction'da; mevcut testler |
| Çift harcama yok | Satır kilidi ve idempotency |
| Geçmiş verisi kalıcı silinmez | `archiveThenDelete` (E §4); katalog testi, geçmiş sınıfındaki tabloları silen her yolun arşivden geçtiğini doğrular |

## 5. Sezon geçişi

1. Sezon satırı `FOR UPDATE`. Bütün yazmalar biter, yenileri bekler.
2. Sonuçlar global kayda katlanır.
3. Geçmiş sınıfındaki dünya tabloları arşive kopyalanır.
4. Bugünkü `DELETE` sırası çalışır (`TRUNCATE` değil; E §4).
5. Yeni sezonlar açılır.

Hepsi tek transaction. Sonrasında, oyun açıkken `REINDEX CONCURRENTLY` çalışır. Çökme, hiçbir şeyin yarım kalmaması demek. Süre ölçülür (L). Uzarsa 3. adım, sezon dondurulduktan sonra ayrı ve tekrarlanabilir transaction'lara bölünür; dondurulmuş sezon zaten yazma almaz.

## 6. Galaksiler arası işlemler (başlangıç → ana galaksi)

Bugün tek transaction (`commander_transfers`). Yapı, ileride iki sunucuya bölünebilecek biçimde kurulur:

1. **Rezervasyon (global):** `commander_transfers` satırı `pending`, hedef koltuk ayrılır. Transfer kimliği idempotency anahtarıdır.
2. **Hedefte kurulum (galaxy):** Komutan transfer kimliğiyle oluşturulur. Aynı kimlikle ikinci deneme etkisizdir.
3. **Kaynakta kapanış (starter):** Gemi `landed` olur, transfer `done` olur.

Bugün üç adım aynı transaction'da çalışır. Ayrıldıklarında her adım tekrarlanabilir olduğu için yarım kalan transfer bakım döngüsünde tamamlanır.

## 7. Önbellek tutarlılığı

| Önbellek | Anahtar | Geçersiz kılma | Yazmada kullanılır mı? |
| --- | --- | --- | --- |
| Oturum (`accounts.auth_version`) | Hesap | `auth_version` değişince NOTIFY | Hayır; yazma kendi sorgusunda doğrular |
| Komutan ve yerleşim | Oyuncu | `placement_version` değişince NOTIFY | Hayır; G §2'de kilitli okuma |
| Asteroit sahası, korsanlar | Galaksi | İlgili olay NOTIFY'ı | Hayır |
| Projeksiyonlar (bugünkü) | Galaksi | Bugünkü gibi | Hayır |

LISTEN koparsa önbellekler atlanır (bugünkü davranış). Yeniden bağlanınca boşaltılır.
