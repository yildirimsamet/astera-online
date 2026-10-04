# Monument — bağımsız kod incelemesi

- **2. tur:** 2026-10-04, 17:15–18:20. Önceki bulgular yeniden doğrulandı, bütün feature baştan incelendi.
- **1. tur:** 2026-10-04, 15:35–16:20. Ek A'da, değiştirilmeden.
- **Codex'in bu dosyaya eklediği "kapanış" bölümü:** Ek B'de, değiştirilmeden.

Bu rapor kod değiştirmez. Manuel doğrulamalar scratchpad'deki geçici test dosyalarıyla, ayrı (sonradan silinen) `_test` veritabanlarında, gerçek Postgres ve gerçek HTTP route'larıyla yapıldı. HEAD karşılaştırması için HEAD, `git archive` ile ayrı bir klasöre çıkarıldı. Repo'ya test dosyası eklenmedi.

**Kanıt etiketleri:**
- **[Test]** — Manuel test ya da test koşusunda gözlendi.
- **[Kod]** — İlgili kod satırı okunarak kesinleşti, çalıştırılmadı.
- **[Doğrulanmadı]** — Olası risk; kanıt yok.

> **Önemli:** Codex oturumu 2. tur boyunca da dosya değiştirdi. 17:15–17:50 arasında 17 dosya değişti; aralarında `monument.ts`, `monumentView.ts`, `routes/galaxy.ts`, `servers.ts`, `MonumentSheet.tsx`, `notifications.ts`, `packages/sim/src/season.ts` var. Aşağıdaki maddeler 17:50'deki dosya hâline göre yazıldı; testler o hâl üzerinde koştu. Codex'in sonraki değişiklikleri kapsam dışında.

## 2. tur özeti

- **Önceki 23 madde:**
  - 14'ü düzelmiş.
  - 6'sı kısmen düzelmiş ya da bilinçli olarak bekliyor.
  - 3'ü sahip kararıyla kapandı.
- **Codex'in "M-02–M-08 ve M-14–M-20 düzeltildi" kaydı tam doğru değil [Test]:** M-08 ve M-14 hâlâ kısmen açık; M-19'da bir eksik kaldı.
- **Bu turda testle doğrulanan yeni orta önemli bulgular:**
  - Saldırı quote'u savunanın yoldaki takviye hacmini döndürüyor (N-01).
  - Herkese açık HP/dk değeri bitmiş kaynakları da topluyor; 6 yerine 10 gösteriyor (N-02).
  - Takviye önizlemesi HOLD'daki ilk kaybı 33 dk geç gösteriyor (N-03).
- **Kalite kapısı:**
  - Typecheck yeşil.
  - Lint kırmızı (75 hata).
  - Monument değişikliği daha önce yeşil olan iki testi kırdı: server'da `clan-support-schema.test.ts` (HEAD'de yeşil olduğu doğrulandı) ve web'de `intergalactic-convoy-visual.test.ts`.

## 1. Önceki bulguların güncel durumu

| ID | Durum | 2. tur kanıtı |
| --- | --- | --- |
| M-01 | **Kısmen — açılış bekliyor** | [Kod] Onaylı değerler (`packages/rules/src/monument.ts:20`, `MONUMENT_SEASON_DEFAULTS`) planın §9 onayıyla birebir aynı: 5 anıt, merkezden 6.000, bulut 1.000, gemi başına 4 HP/dk, toplam 10 D/dk, araştırmasız 10 Leviathan, kapasite 7.270. Ruleset ≥ 16 sezonda seed çalışıyor (`apps/server/src/services/season.ts:255`): 5 anıt ve 5 HP bulutu. Operatörün HP bulutu için CLI'si var. **Kalan [Kod]:** Global varsayılan hâlâ 15; monument'lı sezon yalnız `--ruleset 16` ile açılıyor (N-14). Simülatör monument'ları yalnız veri olarak taşıyor (N-13). |
| M-02 | **Düzeldi** | [Test] Donmuş sezonda `/api/galaxy` 200, `/api/monuments` 200. |
| M-03 | **Büyük ölçüde düzeldi** | [Test] `/api/galaxy` artık kilitsiz, yazmasız public okuma. Bozuk manifest varken ilgisiz oyuncu galaxy ve monuments'te 200 alıyor. Eşzamanlı gönderim yarışında galaxy 200 (68 ms). HOLD eden oyuncunun gezegeni kilitliyken galaxy 51 ms (1. turda 2.822 ms). **Kalan:** Katılımcı okumaları hâlâ kilitli ve yazan işlem (N-10). Bozuk manifest durumunda yalnız katılımcı 409 alıyor. |
| M-04 | **Düzeldi (karar A)** | [Test] Kurulum: 7.000 bulk HOLD + 170 bulk takviye rezervasyonu. Rezervasyonsuz geç dost saldırının yalnız 5 Citadel'i (85 bulk) HOLD'a girdi, 5'i `CAPACITY` ile döndü. Mevcut tutucu yerinde kaldı; rezervasyonlu takviye tam sığdı. **Kalan:** Geri gönderilen oyuncuya bildirim yok (N-05). |
| M-05 | **Düzeldi** | [Test] Tarafsız monument'a kalkanlı gönderim: onaysız 409 `SHIELD_WOULD_DROP`; onaylı 200 ve kalkan kaldırıldı. [Kod] Ortak saldırı başlatılırken her katılımcının onayı aranıyor. **Kalan:** N-08. |
| M-06 | **Düzeldi (ele geçirme yolu)** | [Test] Ele geçiren yeni tutucuya 1 uyarı gitti. **Kalan:** N-07. |
| M-07 | **Düzeldi** | [Test] Sezon bittikten sonra varacak gönderim → 409 `SEASON_ENDS_BEFORE_RETURN`. |
| M-08 | **Kısmen** | [Kod] HP bulutu ekle/bitir/listele CLI'si eklendi. **Kalan [Test]:** Yüzde bulutu ruleset 16 sezonuna hâlâ kabul ediliyor ve etkisiz kalıyor (N-06). |
| M-09 | Karar gereği kapandı | — |
| M-10 | **Düzeldi** | [Kod] Rapor ve bildirimde `opponents` var. 0138 ad/klan snapshot'ını saklıyor. NEUTRAL istemcide yerelleştiriliyor. |
| M-11 | **Büyük ölçüde düzeldi** | [Kod] Eklenenler: HP/dk, `emptySince`, ETA'sı geçmemiş inbound uyarısı, seçilen hacim, saldırı sonucu açıklaması, takviye HOLD tahmini, dönüş nedeni. **Kalan:** N-02, N-03, N-16. |
| M-12 | **Düzeldi** | [Kod] `username` boş. Panelde ve sheet'te yerelleştirilmiş başlık kullanılıyor. DB'de `targetPlanetName` hâlâ "Monument N", ama arayüz kullanmıyor. |
| M-13 | Karar gereği kapandı | — |
| M-14 | **Kısmen** | [Test] Public liste artık yalnız okuyanın kendi rezervasyonunu gösteriyor. **Kalan [Test]:** Saldırı quote'u savunanın rezervasyonunu döndürüyor (N-01). |
| M-15 | **Düzeldi** | [Kod] `adminUsernames` probe yoluna geçiriliyor. |
| M-16 | **Düzeldi** | [Kod] `threads` memo'su artık `now`'a bağlı değil. |
| M-17 | **Düzeldi** | [Kod] `hpHazeAlpha` saydamlığı yoğunluğa göre ayarlıyor. |
| M-18 | **Düzeldi** | [Kod] Neden artık `CONTROL_CHANGED` (migrasyon 0139). |
| M-19 | **Kısmen** | [Kod] "Anıt" ve FleetPage düzeldi. **Kalan:** Türkçede "bulk" çevrilmemiş (N-12). |
| M-20 | **Düzeldi** | [Kod] Sayısı 0 olan satırlar settlement'ta ve savaşta siliniyor. |
| M-21 | Değişmedi | Planın önerisiydi, onaylı kural değildi; codex "kapsam dışı" olarak işaretledi. |
| M-22 | Değişmedi (deploy notu) | — |
| M-23 | **Düzeldi** | [Kod] Ruleset 15'te `/api/galaxy` yalnız tek bir sezon sorgusu ekliyor. |

### İnceleme sırasında kapanan
- **Arayüzdeki "düşman geliyor" uyarısı:** 17:2x'te okuduğum `MonumentSheet`, herhangi bir eski `monument_inbound` bildiriminden uyarı üretiyordu. 17:27'de codex `activeMonumentInbound` ile ETA'sı geçmiş uyarıları eledi [Kod]. Bu yüzden N-04 numarası boş.

## 2. Yeni bulgular (2. tur)

### N-01 · Orta · Saldırı quote'u savunanın yoldaki takviyesini sızdırıyor — [Test]
- `gatherMonumentSend`, `room.reserved` alanını kontrol eden tarafın OUTBOUND REINFORCE rezervasyonlarından hesaplıyor ve saldıran oyuncuya da döndürüyor (`apps/server/src/services/monument.ts:406`, `:445`).
- **Gözlem:** Düşman oyuncunun `/api/monuments` cevabında `reserved: 0`. Aynı oyuncunun saldırı quote'unda `room: { used: 100, reserved: 85, total: 7270, after: 185 }` — 5 Citadel'lik takviye görünüyor.
- M-14'teki gizleme quote üzerinden boşa çıkıyor.

### N-02 · Orta · Herkese açık HP/dk değeri yanlış topluyor — [Test]
- `publicMonumentFacts`, monument'a bağlı bütün EMIT kaynaklarının yoğunluğunu zaman penceresine bakmadan topluyor (`apps/server/src/services/monumentView.ts:84-88`). [Kod] Monument'ı kapsayan ZONE/SHELTER kaynakları da hesaba katılmıyor.
- **Gözlem:** 4 HP/dk'lık kaynak bitirilip yerine 6 HP/dk'lık yenisi eklendi. Gösterilen `radiationHpPerMinute` **10** (doğrusu 6).
- Bu sayı `MonumentSheet` ve `MonumentFocus`'ta gösteriliyor. Haritadaki bulut çizimi (`drawnHpClouds`) zaman penceresini doğru filtreliyor.

### N-03 · Orta · Takviye önizlemesi HOLD'daki ilk kaybı geç gösteriyor — [Test]
- `friendlyHoldForecast` önizleme lotlarını hasarsız ve tam sayıda varmış gibi kuruyor (`apps/server/src/services/monument.ts:335`). Aynı quote'taki `outboundForecast`, gidiş hasarını zaten hesaplıyor.
- **Gözlem:** Gidişte gemi başına 131,9 HP doz alındı. Quote'taki "sonraki gemi kaybı" 03:53:13. Varıştan sonra okunan gerçek değer **03:20:15** (yaklaşık 33 dk önce).

### N-05 · Düşük-Orta · CAPACITY ile geri gönderilen oyuncuya bildirim yok — [Test]
- Sahip kararları tablosunda "eve dönen kısmın sahibine nedeniyle birlikte bildirim gider" yazıyor.
- **Gözlem:** Geri gönderilen oyuncunun bildirim listesi boş.
- [Kod] `beginMonumentReturn` bildirim göndermiyor. İnişteki `fleet_returned` bildiriminde neden alanı yok. Neden yalnız monument sheet'teki filo kartında, dönüş sürerken görünüyor.

### N-06 · Düşük · Yüzde bulutu ruleset 16'da hâlâ kabul ediliyor — [Test]
- **Gözlem:** `addRadiationSource` ruleset 16 sezonuna yüzde bulutunu kabul etti ("accepted").
- [Kod] Fonksiyon yalnız `shipDamageApplies` kontrolü yapıyor (`apps/server/src/services/radiation.ts:435`).
- [Test, 1. tur] Böyle bir bulut ne hasar veriyor ne de çiziliyor.

### N-07 · Düşük · Takviye ile HOLD'a giren oyuncu, önceden kalkmış saldırıdan habersiz — [Test]
- [Kod] Yeni tutuculara uyarı yalnız ele geçirmede gidiyor (`apps/server/src/services/monumentArrival.ts:269-282`).
- **Gözlem:** Klanın tuttuğu monument'a saldırı kalktı. Mevcut tutucu 1 uyarı aldı. Ardından takviyesiyle HOLD'a giren klan arkadaşı **0** uyarı aldı; saldırı hâlâ yoldaydı.

### N-08 · Düşük · Ortak saldırı katkısında kalkan onayı sunucuda zorunlu değil — [Kod, testle denenmedi]
- Katkı gönderiminde sunucu kalkan onayını yalnız PLANET hedefi için zorunlu tutuyor: `operation.targetKind === 'PLANET' && shieldWouldDrop && !acknowledgeShieldLoss` (`apps/server/src/services/clanWar.ts:1468`). Arayüz (`ClanWaveSheet`) her iki hedef türünde de onay istiyor.
- Başlatma ise her katılımcının saklı onayını arıyor (`assertOwnShieldLoss`).
- Sonuç: API üzerinden onaysız katkı gönderen kalkanlı bir üye, liderin başlatmasını en sonda kilitler.

### N-10 · Düşük / performans · Katılımcı okumaları ve quote'lar hâlâ ağır
- [Kod] Şunların hepsi monument'ı ve bütün uç nokta gezegenlerini kilitleyip settlement yazıyor; debounce yok:
  - Katılımcının `/api/monuments` okuması.
  - Gönderim ekranında her adet değişikliğinde tetiklenen quote.
  - Geri çağırma ekranında her değişiklikte tetiklenen recall quote'u.
- [Test] 3 monument'a dağılmış 3 katılımcının 6'şar eşzamanlı okuması 40 tur boyunca ölçüldü: test toplam ~61 sn sürdü (kurulum dahil), yani tur başına ~1,5 sn. Hepsi 200 döndü.

### N-11 · Düşük · Mevcut bir web testi kırmızı — [Test]
- `apps/web/test/intergalactic-convoy-visual.test.ts` ("uses the length-derived exact range…") kırmızı.
- Test, `GalaxyCanvas.tsx` kaynağında `exactApproach={coachTap !== null || focus?.kind === 'intergalacticConvoy'}` metnini bire bir arıyor. [Kod] Bu satır HEAD'de aynen var; monument değişikliği sonuna `|| focus?.kind === 'monument'` ekledi (`:904`).
- Davranış doğru; test güncellenmemiş.

### N-12 · Düşük · Türkçede "bulk" — [Kod]
`capacityShort` ve `selectedBulk` metinlerinde "bulk" kullanılıyor; diğer Türkçe metinlerde "hacim".

### N-13 · Düşük · Simülatör monument'ı simüle etmiyor — [Kod]
- `packages/sim/src/season.ts` monument'ları yalnız veri olarak taşıyor; kendi yorumunda "does not run monument dispatches yet" yazıyor.
- Planın §5'i "sunucu, istemci tahmini ve simülatör aynı fonksiyonları kullanır" diyor. Rotasyon ve denge ölçümleri simülatörle yapılamıyor.

### N-14 · Bilgi · Açılış adımı — [Kod]
- Global varsayılan ruleset 15 (`packages/rules/src/constants.ts:3448`). Monument'lı sezon yalnız CLI `--ruleset 16` ile açılıyor; otomatik sezon geçişi monument'sız açar.
- Planda "canlı yeni sezon açılışı yapılmaz" yazıyor, yani bu bilinçli. Açılış için ya varsayılan değiştirilmeli ya da sezon bu bayrakla açılmalı.

### N-15 · Düşük · Operatör HP bulutu araçlarında iki risk — [Test]
- **Geriye tarihleme:** `activeFrom` geçmiş bir tarih olabiliyor.
  - **Gözlem:** Bulut 02:00'de, `activeFrom` 00:00 olarak eklendi. Bir sonraki okumada HOLD'daki Leviathan'a, bulut yokken geçen 2 saat için **480 HP** hasar yazıldı (120 dk × 4 HP).
  - Plan "geçmiş doz yeniden fiyatlanmaz" diyor.
- **Yeniden planlama yok:** Bulut eklemek zamanlanmış kayıp olaylarını güncellemiyor.
  - **Gözlem:** 77 HP'lik bir Dart'ın bulunduğu HOLD'a 100 HP/dk bulut eklendi. Planlanan `monument_loss` olayı sayısı **0**.
  - [Kod] Ölüm ve kontrol kaybı ancak bir sonraki okuma ya da başka bir olayla işleniyor.
- Yer: `apps/server/src/services/radiation.ts`, `addHpRadiationSource` / `endHpRadiationSource`.

### N-16 · Düşük · Arayüzde kalan küçük eksikler — [Kod]
- Garnizonu ölmüş, boş monument'ta etiket hâlâ "Tarafsız garnizon" (`Monuments.tsx`, `MonumentSheet`, `MonumentFocus`; hepsi NEUTRAL için `monument.neutral` kullanıyor).
- `emptySince` "X süredir boş" diyor ama garnizonun ne zaman döneceğini (24 saat) göstermiyor.
- Saldıran tarafa quote'ta HOLD tahmini verilmiyor (`holdForecast` yalnız dost gönderimde).
- Kapasite satırındaki "rezerve" artık yalnız oyuncunun kendi rezervasyonu; klan arkadaşlarınınki yalnız quote'ta görünüyor.

### N-17 · Düşük · Lint kırmızı — [Test]
Değişen ve yeni dosyalarda 75 hata / 21 dosya. Kaynak dosyalardakiler (9 hata):
- `monument.ts`: kullanılmayan `monumentCargoCapacity` importu, gereksiz optional chain
- `monumentView.ts`: gereksiz koşul (zararsız; hiçbir zaman `null` olmayan bir değer `null` ile karşılaştırılıyor)
- `clanWar.ts`, `flightProjection.ts`, `IntergalacticConvoySheet.tsx`, `MonumentReportSheet.tsx` (2), `packages/sim/src/season.ts`

Kalanlar test dosyalarında. İncelediğim kaynak hatalarının hiçbiri davranış hatası değil, ama `pnpm lint` kapısını kırıyor.

### N-18 · Çok düşük — [Kod]
- Migrasyon adları `0138_ancient_black_cat`, `0139_rapid_cerise` rastgele; diğer monument migrasyonları açıklayıcı adlı.
- İstemci HP önizlemesi dock eşiğini toplam üzerinden hesaplıyor (`apps/web/src/lib/radiation.ts`); sunucu bileşen bazında (`needsHpDock`). Fark yalnız subnormal kesirlerde oluşur.

## 3. Doğrulanamayan risk

### N-09 · Kilit sırası — [Doğrulanmadı]
- [Kod] `readMonuments`, katılımcının her monument'ı için `reconcileMonumentViews`'u ayrı ayrı çağırıyor. İkinci monument'ın gezegen kilitleri, birincinin oyuncu ve klan kilitlerinden **sonra** alınıyor. Bu, kodda yazılı "dünyalar → hedef → klan → oyuncu" sırasının dışında.
- Bunun deadlock'a yol açıp açmadığını gösteremedim: 240 eşzamanlı okumalı denemede deadlock olmadı. O düzende bütün gezegenler her monument'ın uç noktasıydı, yani ikinci kilit grubunda yeni gezegen yoktu.

## 4. Doğru çalıştığını teyit ettiklerim (2. tur)
- **[Kod] Kural paketi:** İlk turdan sonra yalnız onaylı varsayılan değerler eklenmiş. 1. turdaki kural testlerim (repair parity, savaş → bölme fuzz'ı, settlement yol bağımsızlığı) bu değişiklikten etkilenmiyor.
- **[Kod] Seed:** Yalnız ruleset ≥ 16'da çalışıyor; 5 anıt + 5 bulut; sayı tutmazsa hata fırlatıp transaction'ı geri alıyor.
- **[Kod] Geometri:** Bulutlar merkezden 5.000–7.000 arasında.
  - Gezegenler arası uçuşlar 4.500'lük kürenin içinde kalıyor.
  - Konvoy rotası −4.500 → +4.500 çapında ilerliyor.
  - Komşu anıtlar arası mesafe ~7.053 (> 2 × 1.000), bulutlar birbirine değmiyor.
- **[Test] M-04/A kuralı:** Ele geçirmede ve dost varışta rezervasyonlar korunuyor; mevcut tutucular yerinde kalıyor.
- **[Kod] Dev lobisi:** `MONUMENT-LOCAL` lobi kapısı `NODE_ENV` production değilken açılıyor. Dockerfile ve `docker-compose.prod.yml` `NODE_ENV=production` ayarlıyor.
- **[Kod] `lockWorlds`:** Yeni `requireLive` seçeneğinin varsayılanı eski davranışı koruyor.

## 5. Test durumu (2. tur)
| Kontrol | Sonuç |
| --- | --- |
| Typecheck (rules, server, web, sim) | Geçti |
| Lint (değişen dosyalar) | **Kırmızı: 75 hata / 21 dosya** (N-17) |
| Rules: bütün suite | 1.976/1.976 |
| Sim: monument testi | 2/2 |
| Web: monument ve ilgili dosyalar | 143/143 |
| Web: klan savaşı / transfer / launch / radyasyon regresyonları | 365/366 (N-11) |
| Server: monument + ilgili 64 dosya | **1.003/1.007**, 3 dosyada 4 kırmızı test (ayrıntı aşağıda) |

**Server'daki kırmızılar, HEAD ile karşılaştırılarak:**
- **`clan-support-schema.test.ts` › "appends every enum value…":** HEAD'de **yeşil**, şimdi kırmızı. Monument'ın getirdiği regresyon: test `event_kind` enum'ının son 3 değerini bekliyor, şimdi sonda `monument_loss`, `monument_respawn`, `monument_probe` var.
- **`fault-attack.test.ts` › "Death Star ilk vuruşu koloniye iki arıza bırakır":** HEAD'de de aynı hatayla kırmızı. Monument'tan bağımsız.
- **`notifications.test.ts` (2 test):** HEAD'de de kırmızı. Ancak "kinds of news…" testinde fark HEAD'de 25'e 23'tü, şimdi 27'ye 23: monument iki yeni türü (`monument_inbound`, `monument_probe_lost`) istemci listesine eklemeden bu farka kattı.

Tam server suite de denendi; 5. dosyadan sonra süreç SIGTERM ile sonlandı. Nedenini bilmiyorum; sonuç yok.

## 6. Doğrulanamayanlar
- 350 px ve masaüstünde monument ekranlarının görsel ve oynanış kontrolü. Codex modelleri incelediğini yazıyor (Ek B); ben ayrıca doğrulamadım.
- N-09 deadlock senaryosu.
- N-08'in HTTP üzerinden uçtan uca denenmesi (yalnız kod okundu).
- Tam server suite ve `pnpm verify`.
- Migrasyonların prod büyüklüğündeki veride süresi.
- Codex'in 17:50'den sonraki değişiklikleri.

## 7. Sahip kararları (2026-10-04)
| Madde | Karar |
| --- | --- |
| M-04 | **A — Önce gelen kalır.** HOLD'daki gemiler, sonradan gelen dost bir filo yüzünden asla eve gönderilmez. Yeni gelen filonun kapasiteye sığmayan kısmı kendi sahibinin evine döner. Dost takviye rezervasyonu, rezervasyonsuz bir dost varışla da aşılamaz. Zafer sonrası yüksek tier öncelikli seçim yalnız ele geçirmeyi yapan saldırı filosuna uygulanır. Eve dönen kısmın sahibine nedeniyle birlikte (CAPACITY) bildirim gider. |
| M-05 | Kalkanı açık oyuncu monument'a gönderim yaparsa kalkanı kaldırılır. Yorum: saldırı, takviye ve ortak saldırı katkısı dahil her filo gönderimi kalkanı düşürür; monument o an tarafsız olsa bile. Oyuncu gönderim ekranında bunu onaylar. Probe bunun dışındadır (filo değil). |
| M-13 | En temiz, en basit ve en az hata çıkaracak çözüm: monument için ayrı bir olgunluk (`matureAt`) kuralı eklenmez. Gerekçe: üretim klana değil oyuncunun kendisine gider; klana katılmak liderin onayıyla olur; plan, tek başına monument tutan oyuncu klana girince kontrolün hemen klana geçmesini zaten onaylamış. Yalnız takviyeye olgunluk şartı koymak yarım bir kural olur (aynı oyuncu yoldaki saldırı filosuyla zaten HOLD'a girebilir) ve yeni kenar durumlar yaratır. M-04/A uygulandığında yeni üyenin filosu mevcut tutucuları da eve gönderemez. |
| M-09 | Monument PvP'de bash sınırı olmayacak. M-09 bulgu olmaktan çıktı. |
| M-10 | Monument savaş raporunda ve `raid_result` bildiriminde karşı tarafın oyuncu ve klan kimliği gösterilecek. |
| M-01 | Sahibe göre denge değerleri belirlenmişti. **2. turda kontrol edildi:** değerler ve seed kodlanmış; açılış (ruleset 16) ve simülatör desteği bekliyor (N-13, N-14). |

Bu inceleme kod değiştirmez; kararların uygulanması ve testleri feature'ı geliştiren tarafa aittir.

---

## Ek A — 1. tur raporu (15:35–16:20, değiştirilmeden)

Bu ekteki durum ve satır numaraları 1. tur anına aittir; güncel durum yukarıdaki tablodadır.

### Özet

| ID | Bulgu | Önem | Nasıl doğrulandı | Karar |
| --- | --- | --- | --- | --- |
| M-01 | Feature hiçbir sezonda açılamıyor (seed, denge, ruleset yok) | Kritik | grep / kod | Değerler belirlendi; kodlanıp kodlanmadığı kontrol edilmeli |
| M-02 | Donmuş ruleset-16 sezonunda `/api/galaxy` ve `/api/monuments` 409 | Yüksek | Manuel DB+HTTP | — |
| M-03 | Her galaksi okuması global kilitli bir yazma işlemi; tek hata herkesin galaksisini düşürüyor | Yüksek | Manuel DB+HTTP (3 senaryo) | — |
| M-04 | Sonradan gelen dost dalga, HOLD'daki oyuncuları sessizce eve yolluyor | Yüksek | Manuel DB | Karar verildi: A — önce gelen kalır |
| M-05 | Kalkanı açık oyuncu, kalkanı düşmeden PvP Dominion kazanabiliyor | Yüksek | Manuel DB+HTTP | Karar verildi: gönderim kalkanı kaldırır |
| M-06 | Ele geçirdikten sonra, önceden yola çıkmış saldırı için uyarı gelmiyor | Orta | Manuel DB+HTTP | — |
| M-07 | Sezon bittikten sonra varacak gönderim kabul ediliyor, yakıt boşa gidiyor | Orta | Manuel DB+HTTP | — |
| M-08 | Operatör CLI'si ruleset 16'ya etkisiz yüzde bulutu ekliyor; HP bulutu eklemenin yolu yok | Orta | Manuel DB+HTTP | — |
| M-09 | Monument PvP'de bash / anti-farming sınırı yok (alt hesapla Dominion farming) | Kapandı | Kod | Karar verildi: sınır olmayacak |
| M-10 | Savaş raporu ve bildirimlerinde rakibin kimliği yok | Orta | Kod | Karar verildi: gösterilecek |
| M-11 | Planın ve CLAUDE.md'nin istediği karar bilgileri arayüzde eksik | Orta | Kod | — |
| M-12 | Klan savaş panelinde monument hedefinin yanında "Former commander" yazıyor; hedef adı İngilizce | Orta | Manuel DB | — |
| M-13 | Klan desteğindeki olgunluk (`matureAt`) kuralı monument'ta yok | Kapandı | Kod | Karar verildi: ayrı kural eklenmez |
| M-14 | Dost takviyelerin toplam hacmi (`reserved`) düşmana açık | Düşük | Manuel DB+HTTP | — |
| M-15 | `launchMonumentProbe` admin muafiyet listesini geçmiyor | Düşük | Kod | — |
| M-16 | GalaxyView her 5 sn'de diske yeni `pending` dizisi veriyor (D53) | Düşük | Kod + ölçüm | — |
| M-17 | HP bulutları yoğunluktan bağımsız olarak hep aynı saydamlıkta | Düşük | Kod | — |
| M-18 | Kontrol kaybında geri dönen takviyenin nedeni `MEMBERSHIP` yazılıyor | Düşük | Kod | — |
| M-19 | Metin tutarsızlıkları ("Monument/Anıt", FleetPage'de sabit "HOLD") | Düşük | Kod | — |
| M-20 | Ölen HOLD gemileri için `count = 0` `units` satırları kalıyor | Düşük | Kod | — |
| M-21 | Radyasyon kayıpları sezon istatistiğinde yok (planın önerisi) | Düşük | Kod | — |
| M-22 | Migrasyon 0130 canlı sezonların ekonomisine dokunuyor | Düşük / deploy notu | Kod | — |
| M-23 | Ruleset 15'te de her `/api/galaxy` isteğine fazladan bir transaction eklendi | Düşük | Kod | — |

### Bulgular

#### M-01 · Kritik · Feature hiçbir sezonda açılamıyor
- `apps/server/src` içinde `monuments` veya `hp_radiation_sources` tablosuna satır ekleyen üretim kodu yok; bu satırları yalnız testler ekliyor. Operatör için bir CLI da yok.
- Denge değerleri tanımlı değil: üretim/dk, HP/dk, bulut yarıçapı, beş konum, garnizon şablonu ve araştırması.
- `MULTI_WORLD.rulesetVersion` hâlâ 15 (`packages/rules/src/constants.ts:3448`). Yeni sezonlar ruleset 15 ile açıldığı için monument'lar hiçbir sezonda görünmez.
- `packages/sim` hiç değişmemiş. Plan, sunucu, istemci ve simülatörün aynı saf fonksiyonları kullanmasını istiyor.
- Planın kendi §12 bölümü de E–G dilimlerinin bitmediğini yazıyor. "Feature yapıldı" şu an doğru değil.
- **Sahip notu:** Denge değerleri belirlendi ama henüz kodlanmadı. Yukarıdakilerin yapılıp yapılmadığı kontrol edilmeli (bkz. "Sahip kararları").

#### M-02 · Yüksek · Donmuş sezonda galaksi ekranı kırılıyor
- **Senaryo:** Ruleset 16 sezonu `frozen` olduktan sonra herhangi bir oyuncu galaksiyi açıyor.
- **Sonuç (manuel test):** `GET /api/galaxy` → **409 SEASON_FROZEN**. `GET /api/monuments` → 409. Aynı sezon `live` iken 200.
- **Neden:** `reconcileMonumentViews` (`apps/server/src/services/monumentView.ts:45`) donmuş sezonu açıkça ele alıyor (`requireLive` false). Ama `lockWorlds` (`monumentView.ts:52`) → `lockSeason` varsayılan olarak `requireLive = true`. `/api/galaxy` bu fonksiyonu her istekte çağırıyor (`apps/server/src/routes/galaxy.ts:59`).
- **Etki:** Sezon sonu özet ve galaksi ekranı (GalaxyView donmuş sezonda da render ediliyor) veri alamıyor.
- **Test boşluğu:** Web'deki "keeps the frozen monument readable" testi geçiyor, çünkü `fetch`'i mock'luyor (`apps/web/test/monument-sheet.test.tsx:35`). Sunucu bu sözleşmeye uymuyor.

#### M-03 · Yüksek · Okumalar global bir kilit noktasına dönüşmüş
`/api/galaxy` ve `/api/monuments` her istekte, ruleset 16'da şunları yapıyor:
- Bütün monument'ları, aktif dalgaları ve park edilmiş gemileri, bütün katılımcıların köken ve ev gezegenlerini, okuyanın gezegenlerini, katılımcıların klan ve oyuncu satırlarını `FOR UPDATE` ile kilitliyor.
- Settlement yazıyor: lot, dalga ve monument satırları.
- Üretim alan her tutucunun wealth'ini yeniden hesaplıyor (`monument.ts:261`).
- Kendi her HOLD dalgası için ~31 adımlık `fillsAt` ikili araması yapıyor (`monumentView.ts:127`).
- Arada sırada gelen savaşları bile çözüyor.

Bu okuma 60 sn'lik polling'le, `control` SSE yayınında herkes için, yeniden bağlanmada ve pencere odağında tetikleniyor. `readClanWar` da MONUMENT hedeflerinde aynı hazırlığı yapıyor.

Manuel testler:
1. Monument'la ilgisi olmayan oyuncunun galaksi okuması, HOLD eden başka bir oyuncunun gezegeni 3 sn kilitliyken **2.822 ms** bekledi. Kilit yokken aynı okuma 24 ms sürdü.
2. Bir monument'taki tek bir manifest tutarsızlığı (park edilmiş gemi sayısı manifestten farklı), ilgisiz bir oyuncunun **`/api/galaxy` çağrısını 409 MONUMENT_MANIFEST_MISMATCH** ile düşürdü.
3. Aynı anda yapılan bir gönderim (başka bir oyuncunun yeni dalgası), ilgisiz bir oyuncunun galaksi okumasını **409 PLACEMENT_CHANGED** ile düşürdü. Okuma uç noktaları kilitlemeden önce keşfediyor; yeni dalganın kökeni bu listede olmadığı için hata veriyor.

**Etki:** En sık çağrılan uç nokta galaksi genelinde tek sıraya giriyor. Katılımcıların gezegen işlemleri başkalarının okumalarını bekletiyor, okumalar da onları. Herhangi bir monument'taki tek bir sorun ya da sıradan bir eşzamanlılık herkesin ana ekranını düşürüyor.

#### M-04 · Yüksek · Sonradan gelen dost dalga, HOLD'dakileri sessizce eve yolluyor *(karar: A — önce gelen kalır)*
- **Neden:** `chooseHold` (`apps/server/src/services/monumentArrival.ts:92-112`, çağrıldığı yer `:309`), dost bir varışta zafer sonrası tier seçimini (`selectMonumentHold`) o an HOLD'daki **bütün** lotlara yeniden uyguluyor.
- **Manuel test:** P1'in 727 Leviathan'ı monument'ı tamamen dolduruyor (7.270/7.270). Klan arkadaşı P0'ın ele geçirmeden önce gönderdiği 10 Citadel'lik ATTACK dalgası varıyor. Sonuç: P1'in **17 Leviathan'ı `CAPACITY` nedeniyle eve dönüyor** ve P1'e **hiç bildirim gitmiyor** (bildirim sayısı önce 0, sonra 0).
- Aynı mekanizma, rezervasyonsuz bir dost ATTACK varışının OUTBOUND REINFORCE için ayrılmış yeri doldurmasına da izin veriyor. O takviye geldiğinde de biri dışarı atılıyor.
- Klana sonradan katılan bir oyuncunun yoldaki saldırı dalgası da aynı şekilde mevcut tutucuları atabilir.
- **Plan ile çelişki:** §11 B "Dost rezervasyon ve saldırı sonrası seçim aynı şey değildir"; §8 "dost takviye rezervasyonu aşamaz".
- **Karar (A):** HOLD'dakiler asla eve gönderilmez; yeni gelenin sığmayan kısmı döner ve sahibine CAPACITY bildirimi gider. Yüksek tier önceliği yalnız ele geçirmeyi yapan saldırı filosuna uygulanır.

#### M-05 · Yüksek · Kalkanı açık oyuncu, kalkanı düşmeden PvP Dominion kazanıyor *(karar: gönderim kalkanı kaldırır)*
- **Neden:** PvP olup olmadığına gönderim anında karar veriliyor: `pvp = ATTACK && holdIds.size > 0` (`apps/server/src/services/monument.ts:391`). Monument o an nötrse kalkan onayı istenmiyor. Varışta oyuncular tutuyorsa savaş tam PvP Dominion'la çözülüyor.
- **Manuel test:** Newcomer kalkanı açık P0, nötr monument'a onaysız saldırı gönderiyor (200). Yolda P1 monument'ı ele geçiriyor. P0 varıyor: savaş `eligible = true`, **transfer = 6.913 Dominion**, `control = ATTACKER`. **P0'ın kalkanı hâlâ açık.**
- Mevcut klan desteği kalkanlı göndereni zaten reddediyor (`SHIELDED_SENDER`, `apps/server/src/services/clanSupport.ts:249`). Monument'ta kalkanlı oyuncu nötr monument'a saldırabiliyor, onu tutabiliyor ve evi korunurken savaşabiliyor.
- **Plan:** "Monument'a PvP saldırısı göndermek saldıranın evindeki kalkanını normal PvP gibi düşürür."
- **Karar:** Kalkanlı oyuncunun monument'a yaptığı her filo gönderimi (saldırı, takviye, ortak saldırı katkısı) kalkanı kaldırır; monument tarafsız olsa bile. Oyuncu bunu gönderim ekranında onaylar. Probe hariç.

#### M-06 · Orta · Ele geçirdikten sonra, önceden yola çıkmış saldırı için uyarı gelmiyor
- `monument_inbound` bildirimi yalnız gönderim anındaki HOLD sahiplerine gidiyor (`monument.ts:454`).
- **Manuel test:** P0 nötr monument'a saldırı gönderiyor. P1 ondan önce varıp monument'ı ele geçiriyor. P1'e gelen inbound uyarısı: **0**.
- Monument galaksinin dışında olduğu için sensörler de çoğu zaman bu saldırıyı göstermiyor. Yeni tutucu hiç uyarı almadan vuruluyor.

#### M-07 · Orta · Sezon bittikten sonra varacak gönderim kabul ediliyor
- `gatherMonumentSend` yalnız `now >= endsAt` durumunu reddediyor (`monument.ts:359`). Varış zamanını sezon sonuyla karşılaştırmıyor; quote'ta da uyarı yok.
- Gezegen görevleri bu durumda `SEASON_ENDS_BEFORE_RETURN` döndürüyor, probe da `assertSeasonOpenThrough` ile reddediyor.
- **Manuel test:** Sezonun bitmesine 5 dk varken varışı 33 dk sonra olan bir gönderim → 200, 48 döteryum yakıt harcandı. Kapanışta dalga `HOME/FREEZE` oldu, **yakıt iade edilmedi**.

#### M-08 · Orta · Ruleset 16'da operatör bulutu sessizce etkisiz
- `addRadiationSource` (`apps/server/src/services/radiation.ts:420`, CLI: `apps/server/src/cli/radiation.ts`) yalnız `shipDamageApplies` (≥14) kontrolü yapıyor. Ruleset 16 sezonuna da yüzde tabanlı bulut ekliyor.
- **Manuel test:** Monument'ın üzerine %50/dk'lık bir bulut eklendi. Gönderim quote'unda `doseHp = 0`; galakside `radiation` 0, `hpRadiation` 0. Bulut ne hasar veriyor ne çiziliyor.
- HP bulutu (`hp_radiation_sources`) eklemek için ne CLI ne servis var (M-01 ile bağlantılı).

#### M-09 · Kapandı · Monument PvP'de bash / anti-farming sınırı yok *(karar: sınır olmayacak)*
- Gezegen saldırıları `attackCommitments` ve `canAttack` ile aynı hedefe tekrar tekrar saldırıyı sınırlıyor (`apps/server/src/services/mission.ts:317-335`). Monument yolunda bu kayıt ve kontrol hiç yok (`monument.ts` ve `monumentArrival.ts` içinde 0 kullanım).
- Plan tier sınırını bilerek kaldırıyor ama bash sınırından hiç söz etmiyor.
- **Risk:** Ana hesap, alt hesabın tuttuğu ucuz bir HOLD'a sınırsız saldırıp, sıfır toplamlı transferle alt hesaptan ana hesaba Dominion taşıyabilir.

#### M-10 · Orta · Rapor ve bildirimde rakibin kimliği yok *(karar: gösterilecek)*
- `MonumentReportView` (`apps/server/src/services/monumentReports.ts:6-23`) ve `raid_result` bildirimi karşı tarafın oyuncu ya da klan adını taşımıyor.
- Ele geçirilmeyen bir saldırıda savunan taraf kimin saldırdığını hiç öğrenmiyor.
- Gezegen raporlarında saldıranın adı görünüyor. Burada intel → misilleme döngüsü ("What happened?") zayıflıyor.
- Sunucu bu kimlik bilgisini zaten biliyor; sezon istatistiğindeki `rival` alanı bu verilerden hesaplanıyor.

#### M-11 · Orta · Arayüzde planın istediği karar bilgileri eksik (dört tasarım sorusu)
`apps/web/src/screens/MonumentSheet.tsx`, `apps/web/src/galaxy/FocusPanel.tsx:144-146`, `apps/web/src/galaxy/Monuments.tsx:23`.
- **Tahmin edilebilirlik:** Saldırı önizlemesi filonun hacmini kapasiteyle karşılaştırmıyor. Zaferde yüksek tier önceliği, alt tier yük gemilerinin dönebileceği ve üretimin sıfır kalabileceği anlatılmıyor. Plan §2 bunu açıkça istiyor: "Bu durum gönderim önizlemesinde açıklanır". Monument'ın toplam kapasitesi üstte görünüyor; eksik olan, seçilen filo için ne olacağı.
- **Karar desteği:** Gönderimden önce HOLD'da ne kadar dayanılacağı gösterilmiyor; `nextLossAt` yalnız varıştan sonra görünüyor. Plandaki "3–4 saatlik lojistik kararı" tam bu sayıya dayanıyor. Takviyede beklenen kişisel üretim payı da gösterilmiyor.
- **Açıklık:** Monument detayında HP/dk yok (plan §6).
- **Alive/Now:** HOLD eden oyuncu gelen saldırıyı yalnız sinyal ve bildirimde görüyor; monument veya filo ekranında görmüyor (plan §6).
- **Fırsat gizleniyor:** `emptySince` veride var ama hiç gösterilmiyor. Garnizon ölüp monument boşaldığında bile etiket "Tarafsız garnizon" diyor. Savaşsız ele geçirme fırsatı ve garnizonun döneceği saat oyuncudan saklanıyor.
- **"Neden?" boşluğu:** Dönüş nedeni (CAPACITY / DEFEAT / MEMBERSHIP) istemciye hiç gönderilmiyor.
- **Açıklık:** `MonumentFocus` "used / capacity" sayısını birimsiz gösteriyor; üretim `decimal(…, 0)` ile 0'a yuvarlanabiliyor.
- 350 px ve masaüstünde görsel doğrulama yapılmadı (bkz. "Doğrulanamayanlar").

#### M-12 · Orta · Klan savaş panelinde "Former commander"
- `projectOperation` hedef oyuncusu yokken `username: … ?? 'Former commander'` üretiyor (`apps/server/src/services/clanWar.ts:538`). `ClanWarPanel` dolu `username` gördüğü için rakip etiketi çiziyor.
- **Manuel test:** MONUMENT hedefli operasyonun görünümü `username: "Former commander"` döndü.
- Hedef adı sabit İngilizce kaydediliyor: `` `Monument ${ordinal}` `` (`clanWar.ts:1039`). Türkçe arayüzde "Anıt 1" yerine "Monument 1" görünüyor.

#### M-13 · Kapandı · Klan desteği ile olgunluk kuralı tutarsız *(karar: monument'a ayrı olgunluk kuralı eklenmez; gerekçe "Sahip kararları" tablosunda)*
- Klan desteği, olgunlaşmamış üyeyi `CLAN_SUPPORT_MEMBER_IMMATURE` ile reddediyor (`clanSupport.ts:244`). Ortak savaş da `matureAt` kontrol ediyor.
- Monument REINFORCE'ta bu kontrol yok. Klana yeni katılan biri hemen klanın monument'ına takviye gönderebiliyor (M-04 ile birleşince mevcut tutucuları da atabiliyor).
- Kalkanlı gönderen boyutu M-05'te.

#### M-14 · Düşük · `reserved` herkese açık
- Manuel test: Düşman oyuncu `GET /api/monuments` ile tutucunun yoldaki takviyesinin hacmini (`reserved: 85`, yani 5 Citadel) görebiliyor (`monumentView.ts:83`).
- Plan herkese açık alanları "kapasite/kullanım" olarak sayıyor; gelecekteki takviye hacmi buna dahil değil.

#### M-15 · Düşük · Probe yolunda admin muafiyeti geçirilmiyor
`launchMonumentProbe` içindeki `advanceMonument` çağrısı `adminUsernames` olmadan yapılıyor (`apps/server/src/services/monumentProbe.ts:29`). Bugün zararsız, çünkü route ondan önce aynı ana kadar reconcile ediyor. Ama bu sıralamaya bağımlı ve kırılgan.

#### M-16 · Düşük · `pending` her 5 sn'de yeni dizi
- `GalaxyView.tsx:818`'deki `threads` memo'su `now`'a (5 sn) bağlı ve her seferinde yeni dizi üretiyor. Ruleset 15'te, monument yokken de oluyor.
- D53 kuralına ("disk'e giden her prop stabil") aykırı.
- Ölçtüğüm etki küçük: GPU buffer'ları stabil (`Fleets.tsx` bunu çözmüş); yalnız `rendezvous`, `subject` ve `DeathStarImpacts` memo'ları her 5 sn'de yeniden hesaplanıyor.

#### M-17 · Düşük · HP bulut yoğunluğu çizimde görünmüyor
HP bulutları sabit alfa 0.12 ile çiziliyor (`apps/web/src/galaxy/RadiationHaze.tsx:75`). 1 HP/dk ile 1.000 HP/dk aynı görünüyor.

#### M-18 · Düşük · Yanlış dönüş nedeni
Kontrol el değiştirdiği için geri dönen takviyeye `'MEMBERSHIP'` nedeni yazılıyor (`monumentArrival.ts:317`). Neden ileride arayüzde gösterilirse yanıltıcı olur.

#### M-19 · Düşük · Metin tutarsızlıkları
- Türkçe `loading` ve `missing` metinlerinde "Monument", diğerlerinde "Anıt" kullanılmış.
- FleetPage başlığında sabit `· HOLD` var (`apps/web/src/v2/hud/FleetPage.tsx:405`).

#### M-20 · Düşük · Sayısı 0 olan `units` satırları
HOLD settlement ve savaş, ölen gemiler için `units.count`'u 0'a çekiyor ama satırı silmiyor. LOST dalgaların satırları kalıcı olarak birikiyor. Şu an zararsız.

#### M-21 · Düşük · Radyasyon kayıpları sezon istatistiğinde yok
Planın §4 önerisi ("kayıplar nedenleriyle sayılır") uygulanmamış. Sezon istatistiği yalnız PvP katılımını sayıyor. Radyasyonun ağır olduğu bu özellikte monument kayıpları hiçbir istatistikte görünmüyor. (Gezegen radyasyonunda da durum aynı; onaylı kural değil.)

#### M-22 · Düşük / deploy notu · 0130 canlı ekonomiye dokunuyor
- `planets.deuterium` ve `buffer_deuterium` sütunlarını `real`'den `double precision`'a çeviriyor (tablo yeniden yazılır). Bu, ruleset kapısı olmadan bütün canlı sezonları etkileyen tek değişiklik.
- Dönüşümden sonra döteryum farklı hassasiyette, alaşım ve kristal `real` olarak kalıyor.
- Rolling deploy sırasında kısa bir tablo kilidi ve küçük yuvarlama farkları beklenmeli.

#### M-23 · Düşük · Ruleset 15'te fazladan maliyet
Her `/api/galaxy` isteği artık fazladan bir transaction (sezon `FOR SHARE`), bir HP bulut sorgusu ve bir sezon sorgusu açıyor (`apps/server/src/routes/galaxy.ts:58-64`).

### İnceleme sırasında kapanan maddeler
- **Ortak klan saldırısında radyasyon riski:** İlk incelemede `startMonumentClanWar` HP tahmini ve ölümcül kayıp onayı yapmıyordu. Codex 16:11'de `requireWaveRadiation`, `radiationByPace` ve migrasyon `0137_clan_war_radiation_consent.sql` ekledi. `monument-joint-war.test.ts` **18/18 geçti** (onaysız 409, onaylı 200). Panel tarafındaki gösterim kontrol edilmedi.
- **HP uçuş testleri:** `radiation-hp-flights` ve `radiation-hp-special-flights` dosyalarındaki 3 test (ölü gövdelerin trafikte yeniden görünmesi) ilk koşuda kırmızıydı. Codex düzeltti; ikinci koşuda **40/40 geçti**.

### Doğru çalıştığını teyit ettiklerim
- **Repair maliyeti:** HP formülü, kesir 0 iken eski formülle bire bir aynı (4.000 rastgele lot, 0 fark; maliyet ve süre).
- **Savaş → fiziksel bölme:** Hasarlı, çok sahipli 600 rastgele monument savaşında `splitMonumentBattleSurvivors` bir kez bile "iyileştirme" hatası vermedi.
- **HOLD settlement:** Bir aralığı tek seferde ya da çok parçada settle etmek aynı sonucu veriyor (üretim, yük, hasar; en büyük sapma 1,8e-12).
- **Ele geçirme koşulu:** Bütün yük hull'larının (Courier, Wayfarer, Atlas, Argosy) ve Collector'ın saldırısı 0; yük gemisiyle ele geçirme mümkün değil.
- **Yağma paylaşımı:** Mevcut, sahip onaylı ortak saldırı kuralıyla ("max-min fair", `packages/rules/src/clanWar.ts:328`) tutarlı.
- **Ateşkes:** Varışta yeniden kontrol edilmemesi gezegen saldırılarıyla aynı davranış; monument'a özgü bir tutarsızlık değil.
- Wipe silme sırası, köken gezegeni kaybında yeniden bağlama, sezon kapanışında doğrudan eve teslim, probe'un %90 kaybı ve gizliliği, dock kesri: kod incelendi, sorun bulunmadı.

### Test durumu (16:20)
| Paket | Sonuç |
| --- | --- |
| Workspace typecheck | Geçti (15:56) |
| Rules: monument, HP, radyasyon | 126/126 |
| Web: monument ve ilgili dosyalar | 141/141 |
| Server: monument ve HP dosyaları | İlk koşu 217/220 (3 kırmızı HP uçuş testi, sonra düzeldi); tekrar koşulan dosyalar 40/40 ve 18/18 |

Lint, tam suite'ler ve `pnpm verify` çalıştırılmadı.

### Doğrulanamayanlar
- 350 px ve masaüstünde görsel / oynanış kontrolü: seed olmadığı için gerçek bir sezonda monument açılamıyor (M-01).
- Migrasyonların prod büyüklüğündeki veride süresi ve kilit etkisi.
- Codex'in 16:20'den sonra yapacağı değişiklikler.

### Sahip kararları (2026-10-04)
| Madde | Karar |
| --- | --- |
| M-04 | **A — Önce gelen kalır.** HOLD'daki gemiler, sonradan gelen dost bir filo yüzünden asla eve gönderilmez. Yeni gelen filonun kapasiteye sığmayan kısmı kendi sahibinin evine döner. Dost takviye rezervasyonu, rezervasyonsuz bir dost varışla da aşılamaz. Zafer sonrası yüksek tier öncelikli seçim yalnız ele geçirmeyi yapan saldırı filosuna uygulanır. Eve dönen kısmın sahibine nedeniyle birlikte (CAPACITY) bildirim gider. |
| M-05 | Kalkanı açık oyuncu monument'a gönderim yaparsa kalkanı kaldırılır. Yorum: saldırı, takviye ve ortak saldırı katkısı dahil her filo gönderimi kalkanı düşürür; monument o an tarafsız olsa bile. Oyuncu gönderim ekranında bunu onaylar. Probe bunun dışındadır (filo değil). |
| M-13 | En temiz, en basit ve en az hata çıkaracak çözüm: monument için ayrı bir olgunluk (`matureAt`) kuralı eklenmez. Gerekçe: üretim klana değil oyuncunun kendisine gider; klana katılmak liderin onayıyla olur; plan, tek başına monument tutan oyuncu klana girince kontrolün hemen klana geçmesini zaten onaylamış. Yalnız takviyeye olgunluk şartı koymak yarım bir kural olur (aynı oyuncu yoldaki saldırı filosuyla zaten HOLD'a girebilir) ve yeni kenar durumlar yaratır. M-04/A uygulandığında yeni üyenin filosu mevcut tutucuları da eve gönderemez. |
| M-09 | Monument PvP'de bash sınırı olmayacak. M-09 bulgu olmaktan çıktı. |
| M-10 | Monument savaş raporunda ve `raid_result` bildiriminde karşı tarafın oyuncu ve klan kimliği gösterilecek. |
| M-01 | Sahibe göre denge değerleri belirlendi ama henüz kodlanmadı. **Kontrol edilmeli:** 5 monument ve HP radyasyon bulutlarını oluşturan sezon başlangıcı (seed) kodu, belirlenen sayıların koda girip girmediği (üretim/dk, HP/dk, bulut yarıçapı, 5 konum, garnizon şablonu ve araştırması), yeni sezonun ruleset 16 ile açılması (`MULTI_WORLD.rulesetVersion`), operatörün HP bulutu ekleyip bitirebileceği bir CLI/servis yolu (M-08) ve simülatörün (`packages/sim`) aynı kuralları kullanması. Bu inceleme anında hiçbiri kodda yoktu. |

Bu inceleme kod değiştirmez; yukarıdaki kararların uygulanması ve testleri feature'ı geliştiren tarafa aittir.

---

## Ek B — Codex'in bu dosyaya eklediği bölüm (değiştirilmeden)

Aşağıdaki "Düzeltildi" kayıtları codex'e aittir; doğrulanmış güncel durum yukarıdaki "Önceki bulguların güncel durumu" tablosundadır (M-08, M-14 ve M-19 kısmen açık).

Güncellik notu: Yukarıdaki bağımsız 2. tur ve aşağıdaki Ek B–D kendi inceleme anlarının kaydıdır. Sonraki düzeltmelerin güncel kararı `monument-code-review.md` içindeki **Son inceleme ve teslim kararı** bölümündedir. M-08/N-06, M-14/N-01 ve M-19/N-12 artık ayrı regresyonlarla düzeltildi; önceki genel kapanış ifadesi eksik olduğu için düzeltilmiş kabul kaydı orada tutulur. Yeni sezon varsayılanı 16'ya alındı (N-14); N-13, sahibin son talimatıyla ekonomi simülatörü/snowball audit kapsamı dışına çıkarıldı. İlk/ikinci tur metni ve kanıtları değiştirilmedi.

### Codex karşılaştırması ve kapanış (2026-10-04, sonraki uygulama)

Bu ek, ilk inceleme snapshot'ından sonra gerçek çalışma ağacındaki kod, migrasyonlar, hedefli testler ve yerel canlı sezon karşılaştırılarak yazıldı. İlk rapordaki “henüz yapılmadı” ifadeleri tarihsel bulgu olarak korunur; aşağıdaki kararlar güncel durumdur.

| Madde | Karar | Güncel kanıt |
| --- | --- | --- |
| M-01 | **Düzeltildi; sürüm kapısı bilinçli.** | `monument.ts` onaylı 5 anıt, 6.000 merkez uzaklığı, 1.000 bulut yarıçapı, 4 HP/dk, 10 D/dk, 10 Leviathan ve 7.270 bulk kapasiteyi taşır. Ruleset 16 seed'i 5 anıt + 5 HP kaynağı oluşturur; `MONUMENT-LOCAL` canlıdır. Global varsayılan 15 mevcut sezonları geriye dönük açmamak için kalır. |
| M-02–M-08 | **Düzeltildi.** | Frozen public/private okuma, public projection, HOLD kapasite, shield/consent, ETA cutoff ve HP source servis/CLI uygulandı ve hedefli test edildi. |
| M-09 | **Bilinçli tercih.** | Monument PvP'de bash sınırı eklenmez. |
| M-10–M-12 | **Düzeltildi.** | Kimlik snapshot'ları rapor/bildirim/news/UI'ya taşınır; klan hedefi açık MONUMENT türü ve ordinal ile taşınır. |
| M-13 | **Bilinçli tercih.** | Monument için ayrıca maturity kuralı eklenmez; sahip kararındaki gerekçe geçerlidir. |
| M-14–M-20 | **Düzeltildi.** | Reserved redaction, admin probe aktarımı, stabil memo, HP haze yoğunluğu, `CONTROL_CHANGED`, metinler ve sıfır units temizliği tamamlandı. Geçmiş ETA'lı inbound uyarısı ayrıca pasifleştirildi. |
| M-21 | **Kapsam dışı bilinçli.** | Onaylı ayrı monument istatistik şeması yok; mevcut PvP katılım istatistiği korunur. |
| M-22 | **Deploy notu.** | 0130 gerçek → double precision dönüşümü kod hatası değildir; migrasyon/rolling deploy etkisi olarak belgelenmiştir. |
| M-23 | **Düzeltildi.** | Ruleset 15 ve öncesinde `/api/galaxy` monument/HP sorgusu açmaz; ruleset 16'da public projection çalışır. `monument-api.test.ts` 20/20 geçti. |

#### Görünürlük ve model entegrasyonu

- `apps/web/public/assets/models/monuments/` altında beş optimize GLB public asset olarak servis edilir: 666.568, 1.329.628, 1.181.660, 758.208 ve 1.349.368 byte; ortalama yaklaşık 1,03 MB.
- `MonumentModel.tsx` ordinal'i dosyalara bağlar; `Monuments.tsx` her public satırı gerçek `toWorld` koordinatına yerleştirir. Güncel görünür ölçü ticaret gemisinin tam 3 katıdır. Model, filoların kullandığı tek hafif back-side additive shader silhouette rim'ini neon cyan ile paylaşır; post-processing bloom veya sürekli geometri üretimi yoktur. `GalaxyCanvas`/`GalaxyView` bunları finder/readout'a bağlar. Üst sağdaki `5 monuments/5 anıt` seçicisi tüm anıtları listeler ve kamerayı seçilen konuma taşır.
- Ruleset 16 public `/api/galaxy` cevabı 5 monument ve 5 HP cloud döndürür; düşman filo/lot/teknoloji/kargo sızdırılmaz. Aynı ruleset 16 sezonundaki authenticated bütün oyuncular bunları görebilir. Geliştirme ortamında `MONUMENT-LOCAL` artık normal `/api/servers` listesinde `open` olarak görünür; böylece doğrudan gizli shard kodu gerekmez. EU-1/EU-2 ruleset 14 olduğu için anıt göstermemesi bilinçli geriye dönük uyumluluk davranışıdır.

#### Doğrulama

- Server `monument-api.test.ts`: **20/20**; web `monument-news.test.tsx`: **9/9**; model/map/assets/news birleşik hedefli çalışma: **31/31**.
- Rules/sim/model, settlement, ownership, arrival, joint war, probe, season close ve native flight testleri hedefli çalıştırıldı; server/web/workspace typecheck geçti.
- Optimize modeller 350 px mobil/desktop çıktılarında görsel olarak incelendi; yaklaşık 4.880–5.000 üçgen ve yaklaşık 1 MB/model hedefi tutturuldu. Headless Three ekran görüntüsü GPU beklemesine takıldığı için tekrar tekrar zorlanmadı; mevcut 20 çıktı ve gerçek asset HTTP smoke kullanıldı.
- 5173 Vite ve 3100 API health 200; login/me 200; migration journal **140/140**; beş model URL'si HTTP 200 döner.

Bu ek itibarıyla model dosyalarının galaksiye eklenmemiş olması veya public görünürlük için eksik bir kod bağlantısı bulunmamaktadır. Kalan genel kapı, tüm doküman/kod değişiklikleri tamamlandıktan sonra bir kez çalıştırılacak `pnpm verify` ve sonucunun raporlanmasıdır.

### Ek C — local sürüm ve focus'suz zoom-out incelemesi (2026-10-04)

- `MONUMENT-LOCAL` yeniden doğrulandı/kurulum akışı sabitlendi: live ruleset 16, 5 monument, 5 HP cloud. `tools/dev-up.sh` production/test dışı temiz local veritabanında bu shard'ı açıkça ruleset 16 ile idempotent açar. Global `MULTI_WORLD.rulesetVersion = 15` ve mevcut EU-1/EU-2 sezonları bilinçli olarak değişmez.
- Focus olmadan aktif gezegen üzerinden zoom-out browser smoke'unda beş public monument scene graph'ta doğru `toWorld` konumunda ve frustum içindeydi. Kök görsel hata, 55–210 sis aralığının 400+ birim uzaktaki landmark gövdelerini karartmasıydı; Monument `Hull` için sis kapatıldı, gemi rim'i korunarak model okunurluğu sağlandı. `out/debug-focusless-maxzoom-fogoff.png` bu kontrolün görsel kanıtıdır.
- Eski/partial battle report payload'ı için `opponents` boş liste fallback'i eklendi; targeted web model/map/news **27/27 PASS**, web typecheck ve ilgili lint geçti.

### Ek D — local reset ve hesap placement düzeltmesi

- Eski scratch sezonu `MONUMENT-LOCAL-ARCHIVE` olarak arşivlendi; yeni `MONUMENT-LOCAL` canlı ruleset 16 sezonu `seed 16005`, 5 monument ve 5 HP cloud ile açıldı. EU-1/EU-2 sezonları değiştirilmedi.
- `t43tgf34g34` hesabı kontrol edildiğinde EU-1/Vantage ruleset 14'teydi; bu yüzden `/api/galaxy` anıt ve HP bulutu döndürmüyordu. Hesabın uçuş/birlik/klan aktivitesi olmadığı doğrulandı ve seasonal player/planet kaydı korunarak MONUMENT-LOCAL'daki boş slota taşındı. Placement cache'i olan tarayıcı oturumu çıkış-giriş veya tam yenileme yapmalıdır.
- Yeni sezon HTTP doğrulaması: `/api/servers` local kapısını `open` gösteriyor; ruleset 16 authenticated `/api/galaxy` cevabı 5 monument ve 5 HP cloud içeriyor. Gerçek browser smoke'unda aktif gezegen açıkken 60 wheel zoom-out sonrası beş `monument-model-*` nesnesi görünür frustum içinde kaldı; `/tmp/local-focusless-live.png` görsel kanıtı incelendi.
