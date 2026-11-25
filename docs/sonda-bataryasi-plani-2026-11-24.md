# Sonda savunma bataryası — plan (2026-11-24)

> Bağlam sıkışırsa veya yeni oturumda önce **§9 Uygulama defteri**ni oku.
> Durum: plan onaylandı, uygulama başlamadı.

## 1. Tek cümlelik kural

> **Şarjı olan sonda bataryası sondayı daha kolay yakalar ve yakaladığını düşürür; şarj bitince dünya bataryasız gibidir.**

Yeni bir zar yok. Bugünkü yakalanma zarı (Radar − Tersane yarışı) kullanılır. Hazır şarj varken
batarya o zarın tabanını yükseltir ve "yakalandı" sonucunu "düşürüldü"ye çevirir.

## 2. Owner kararları (2026-11-24)

| # | Karar | Seçilen |
|---|---|---|
| K1 | Şarj modeli | Kendiliğinden dolar: batarya bir kez ücretle kurulur, şarjlar bedava dolar. Bataryayı boşaltmanın bedelini yalnız saldırgan öder (kaynak tacizi yok). |
| K2 | Atış modeli | **Yakalanan düşer, taban %50.** Ayrı isabet zarı, Radar çemberi, Teleskop tetiklemesi ve "ıska" durumu yok. |
| K3 | Sayılar | 3 şarj, 10 dk'da 1 dolar. Kurulum 4.000 alaşım / 2.500 kristal / 200 döteryum, 30 dk. |
| K4 | Kilit | Efektif Radar 3 + Anten (stratejik batarya ile aynı). |
| K5 | Botlar | Oyuncu gibi kurar ve kullanır (kilitli kural 2026-10-28). |
| K6 | Açılış | Canlı sezonlarda da açılır, duyuru gerekir. |
| K7 | Bildirim | Toplu bildirim: aynı dünyada 10 dakika içindeki düşüşler tek bildirimde sayılır. |
| K8 | Boş şarj | Şarj bitince dünya bataryasız gibidir: bugünkü %15 tabanlı zar geçerli olur. Radar'ın yakalama basamakları değerini korur. |

Owner'ın 2026-11-24 sadeleştirme talebi, ilk taslaktaki çember + ayrı isabet zarı + "ıskalanan
sonda kesin yakalanır" modelinin yerini aldı. O model reddedildi; geri önerme.

## 3. Mekanik

### 3.1 Yakalanma

```
Bataryasız, şarjı boş veya devre dışı:  clamp(0.15 + 0.13 × (Radar − Tersane), 0.05, 0.80)   (bugün)
Şarjlı batarya:                          clamp(0.50 + 0.13 × (Radar − Tersane), 0.05, 0.90)
```

- Radar: hedef dünyanın efektif Radar'ı. Tersane: sondayı gönderen dünyanın Tersanesi (bugünkü sonda gizliliği).
- "Şarjlı batarya" = kurulumu bitmiş, **çalışır** (§3.4) ve sondanın varış anında en az 1 hazır şarjı olan batarya.

| Radar / Tersane | Bugün | Şarjlı batarya |
|---|---|---|
| 4 / 4 | %15 | %50 |
| 6 / 3 | %54 | %89 |
| 3 / 6 | %5 | %11 |
| 8 / 3 | %80 | %90 |

### 3.2 Sonuçlar (zar, sonda yörüngeye vardığında atılır)

| Durum | Sonuç | Sonda | Savunan | Saldırgan | Şarj |
|---|---|---|---|---|---|
| Şarjlı batarya | Yakalanmadı | Raporu alır, döner | Bilmez | Rapor | — |
| Şarjlı batarya | Yakalandı | **Yörüngede düşer**, rapor yok, dönüş yok | Bilir | "Sonda düşürüldü" | −1 |
| Batarya yok, boş veya devre dışı | Bugünkü gibi | Bugünkü gibi | Bugünkü gibi | Bugünkü gibi | — |

- Her sonda tek zarla karşılaşır. Dönüş yolunda sonda vurulmaz.
- Rastgelelik bugünkü gibi `seededFrom(missionId)` ile belirlenir. `rng()` çağrı sırası korunur; rapor bantları ve zarın kendisi değişmez, yalnız eşik değişir.
- Şarj sayısı sondanın **varış anına** (`arriveAt`) göre hesaplanır; işçi gecikmesi sonucu değiştirmez. Aynı anda varan sondalar dünya kilidi altında sırayla işlenir: şarjı biten sonraki sonda bugünkü zara tabidir.

### 3.3 Şarjlar

- Kapasite 3. Kurulum bittiğinde 3 şarjla dolu başlar.
- Eksik şarj varken 10 dakikada bir şarj dolar. Doluyken saat işlemez; dolum ilerlemesi şarj harcanınca korunur.
- Hesap tembeldir (zamanlanmış olay yok): `şarj(t) = min(3, kayıtlı + floor((t − şarjAnı) / 10 dk))`.

### 3.4 Batarya ne zaman çalışmaz

Şu durumlarda dünya **bataryasız** sayılır (bugünkü formül geçerlidir, atış yapılmaz):

- efektif Radar 3'ün altına düştüyse (ör. Anten kaybı),
- EMP etkisi sürüyorsa (yer savunmaları gibi),
- toparlanma (recovery) sürüyorsa.

Bu durumda şarjlar yerinde kalır. Kart "Devre dışı" uyarısı ve nedenini gösterir.

### 3.5 Kim ne öğrenir

- **Savunan:** düşen her sonda Radar günlüğüne "Sonda düşürüldü" satırı olarak yazılır. Yön Radar 2'den, köken Radar 5'ten görünür (bugünkü kural).
  - Uygulama içi bildirim toplu gelir (K7): `refId` = dünya + 10 dakikalık zaman dilimi, aynı dilimdeki her düşüş sayıyı artırır. Düşen sonda için bugünkü `scan_detected` bildirimi **gitmez**; aynı olay için iki bildirim olmaz.
  - Ücretli uyarı bugünkü `probe_detected` uyarısıdır (düşürülen sonda yakalanmış sayılır). Bu uyarıda oyuncu başına 30 dakikalık bekleme zaten var (`PROBE_ALERT_COOLDOWN_MINUTES`); sonda yağdırmak Bildirim Merkezi bakiyesini eritemez.
- **Saldırgan:** "Sonda düşürüldü · {dünya} · {saat}" bildirimi gelir. İstihbarat merkezinde de rapor yerine kayıp satırı görünür. Bundan hedefte çalışır ve şarjı olan bir batarya bulunduğunu öğrenir.
- **Başarılı rapor:** `Sonda bataryası: {hazır}/{kapasite}` satırını tam sayı olarak gösterir (stratejik şarj sayısı gibi). Batarya yoksa "yok" der. Bataryanın varlığı başka hiçbir yerde görünmez.
- **Galaksi:** atış ve düşüş, iki tarafa ve çarpışma noktasını Teleskopuyla tanımlayan tanıklara gösterilir (`publishInterceptionSight` ile aynı kitle).

### 3.6 Kapsam dışı

- Ay Gözcü taramaları (uzayda uçan bir araç değiller), anıt sondaları, başlangıç galaksisi gemi sondaları.
- Klan üyeleri birbirine sonda atamaz, bu yüzden "dost sonda" durumu oluşmaz.
- Onur puanı yok: sonda savaş kanıtı değildir.
- Stratejik bataryanın şarjları ve kapasitesi ile ilişkisi yok; iki ayrı yuva var (SB-12).

## 4. Oyuncu deneyimi

**Savunan:** "Biri beni tartıyor." Savun sekmesinde, stratejik bataryanın altında yeni bir kart bulunur.

- Kilitli: eksik olan (Anten, Radar 3) ve düzeltme yolu gösterilir.
- Kurulabilir: maliyet satırı ve **basılı tutarak kur** (`GameHold`, weight `spends`).
- Kuruluyor: ilerleme çubuğu.
- Hazır: 3 şarj göstergesi, sıradaki şarj için dolum halkası ("Sonraki şarj 6 dk") ve "Son 10 dk: 2 sonda düşürüldü" satırı.
- Devre dışı: uyarı tonu ve nedeni.
- ⓘ içinde kural cümlesi, "Kendi Tersanen kadar Tersanesi olan sondayı %50 ile yakalar" örneği ve "Şarj bitince dünyan bataryasız gibidir" uyarısı.

Batarya boşalınca toplu bildirim hikâyeyi anlatır: "3 sonda düşürüldü · batarya boş, 10 dk'da 1 dolar."

**Saldırgan:** "Orayı görmek pahalı." Kayıp kartı nedenini tek satırda söyler (DI-02). Son raporda batarya varsa, sonda gönderme kontrolü atmadan önce "Son raporda sonda bataryası: 2/3" satırını gösterir. Hedefin Radar'ı bilinmediği için kesin şans gösterilmez; kural ⓘ içinde durur.

**VFX briefi**

1. Dünyada olan: sonda yörüngeye girer. Yüzeydeki batarya kısa bir mermi/enerji atımı dizisi ateşler. Sonda birkaç parçaya ayrılır, kıvılcım saçar ve motor ışığı söner.
2. Kütüphane adayları (son seçim önizlemeye bakılarak yapılacak):
   - `game-assets/library/vfx/textures/space-combat-kit/universalvehiclecombat--demoassets--effects--projectile-energy--spark.png` (atım başı)
   - `game-assets/library/vfx/trails/unique-projectiles-v1/textures--trails--laserbeam02.png` (iz)
   - `game-assets/library/vfx/burst/00gamedevs-vfx/starblade-explosion.js` (parçalanma)
   - Parçalar için mevcut sonda `Hull` modeli kullanılır.
3. Neden bu olay: kural yörüngede işler ve sahne tam orada, o dünyanın toplarının o aracı öldürdüğünü gösterir. Parça saçılması (parlama değil) "yok edildi" der.

Ses: `lib/sound` ile kısa atım ve çatırtı; savunan izliyorsa hafif `haptic`. Saldırgan için kayıp sesi.

## 5. El kitabı ilkeleri

- **DF-12:** bataryalı dünyayı keşfetmek gerçek bir ödünleşimdir: sondayı kaybetme ve savunanı uyarma riski karşısında kör saldırı.
- **DI-02:** kayıp kartı ve rapor satırı nedeni söyler; oyuncu bataryayı ikinci denemeden önce bilir.
- **DI-07:** shuffle bag düşünüldü, uygulanmadı. PvP'de sayan oyuncu tarafından istismar edilir; tohumlu zar kalır.
- **SB-09:** %90 tavan ve 3 şarj; geçiş yolu her zaman vardır (Tersane veya hacim).
- **SB-12:** stratejik bataryadan ayrı yuva.
- **UI-08:** basılı tutarak kurma ve onay.
- **UI-15:** sonuç dünyanın üstünde, sahnede gösterilir.

Teslimden önce `checklists.md` içinde şu bölümler geçirilecek: "A new mechanic or feature proposal", "A player action", "A HUD element", "An online backend before real players arrive", "Audio".

## 6. Değişen eski kurallar (owner bugün onayladı)

- `docs/game-design.md` "Explorer" bölümü ve bilgi katmanı tablosu: bataryalı dünyada yakalanma tabanı ve düşürme eklenecek.
- `PROBE` yorumundaki "IT NO LONGER RATIONS SCOUTING": bataryalı dünyalarda keşif artık pahalanır.
- D124 (varışta görünmez kural yok): atış varışta olur ama sahnede görünür ve kart üstünde yazılıdır.
- "Stratejik bataryaya benzer": geometri benzemiyor (çember yok). Owner'ın sadeleştirme kararı.

## 7. Benim varsayılanlarım (itiraz edilirse değişir)

- Ad "Sonda savunma bataryası".
- EMP veya toparlanma sırasında devre dışı.
- Raporda şarj sayısı tam sayı olarak gösterilir.
- 10 dakikalık toplama dilimi.
- Kurulum bitince dolu başlar.
- Onur yok.
- Yalnız gidiş yolunda atış.
- Kurulum 30 gerçek dakika (tempo çarpanı yok) ve inşaat kuyruğunu kullanmaz.
- **Bot geri çekilmesi:** bir bot, bir hedefte sonda kaybedince o hedefe en çok "son bilinen şarj + 1" sonda atar, sonra 30 dakika o hedefe sonda atmaz. Bugünkü bot döngüsü (`brain.ts:1056`) eski raporlu hedefe her turda yeniden sonda atıyor; düzeltilmezse bot bataryalı dünyaya sonsuza kadar sonda yakar ve davranışı ayırt edilir.
- Radar 3 kilidi artık teknik bir zorunluluk değil, tasarım tercihi (orta oyun). Ölçüm gösterirse düşürülebilir.

## 7.1 Ölçüm (denge bir varsayım, kanıt değil)

Açılıştan sonra, karar vermeden önce şunlar ölçülecek:
- Bataryayı kuran aktif komutan oranı.
- Günde düşen sonda sayısı.
- Bataryalı dünyada bir rapor için ortalama kaç sonda gerektiği.
- Bataryalı ve bataryasız dünyalara saldırı oranı.

Sayaçlar mevcut analytics olgularına eklenir. %50 taban, 3 şarj ve 10 dakika bu ölçümle yeniden değerlendirilir.

## 8. Testler (her ölçüt bir test, koddan önce)

**Rules (`packages/rules`)**

- R1: `probeCatchChance` bataryasız, şarjı boş veya devre dışıyken `detectChance` ile aynı; şarjlıyken 4/4=0.50, 6/3=0.89, 3/6=0.11, taban 0.05, tavan 0.90.
- R2: tembel dolum. Dolu dolu kalır; 0'dan 10 dk → 1, 25 dk → 2; tavan 3; harcamada kısmi ilerleme korunur.
- R3: sabitler (maliyet, süre, kapasite, dolum) sabitlenir.

**Server**

- S1: kurulum şu durumlarda reddedilir: Anten yok, efektif Radar < 3, kaynak yetersiz, zaten kurulu, sezon bitmeden bitmiyor, dünya çalışmıyor. Maliyet düşülür; 30 dk sonra 3 şarjla hazır olur.
- S2: şarjlı + yakalandı → `probe_reports` satırı yok, `scan_events` (detected + shot_down) var, şarj −1, dönüş yok, görev `resolved`, iki taraf bildirim alır, `scan_detected` gitmez.
- S3: şarj boş → bugünkü formül ve bugünkü yol (aynı tohumla bataryasız dünyayla birebir aynı sonuç).
- S4: şarjlı + yakalanmadı → rapor, sessiz, şarj değişmez.
- S4b: işçi gecikmesi → şarj varış anına göre hesaplanır (varıştan sonra dolan şarj o sondayı vurmaz).
- S5: bataryasız dünyada bantlar ve tespit önceki tohumlarla birebir aynı (regresyon).
- S6: tek şarj varken aynı anda varan iki sonda → yalnız biri düşer (`FOR UPDATE`).
- S7: §3.4'teki devre dışı durumları → bugünkü formül, atış yok.
- S8: başarılı rapor `probeBattery {ready, capacity}` taşır; batarya yoksa "yok".
- S9: aynı 10 dakikalık dilimde 3 düşüş → savunana tek bildirim, sayı 3; sonraki dilim yeni bildirim açar. Ücretli uyarı 30 dakikalık beklemeye uyar.
- S10: günlük görev ve ödül sayaçları düşürülen sondaları sayar.
- S11: Radar günlüğü yön ve köken kapılarını korur; kapı altında veri client'a çıkmaz.
- S12: sahiplik değişimi, devir, terk, hesap silme ve sezon sonu davranışı (adım 0'daki karara göre).
- S13: contract testi ve query budget testi.
- S14: bot, persona koşulunda bataryayı kurar; payload'da bot işareti yok.
- S15: bot geri çekilmesi → kayıptan sonra en çok "son bilinen şarj + 1" sonda, sonra 30 dakika o hedefe sonda yok.
- S16: analytics sayaçları (§7.1) yazılır.

**Web**

- W1: kart durumları ve basılı tutma mutasyonu.
- W2: dosya satırı, kayıp satırı ve gönderme ipucu.
- W3: 6 dilde metin anahtarları (mevcut eşlik testi).
- W4: atış sahnesinin poz fonksiyonu.

Görsel kontrol: `node tools/visual.mjs` ile 350 px, galeri kamerası.

## 9. Uygulama defteri

### 9.1 Adımlar (adım → doğrulama)

| # | Adım | Doğrulama | Durum |
|---|---|---|---|
| 0 | Mevcut davranışları oku: stratejik şarjın EMP, recovery, sahiplik değişimi, devir ve hesap silmedeki akışı; `instrumentLevels` efektif mi; `assertClanHostilityAllowed` sondaya uygulanıyor mu; `packages/sim` sonda modeli | Notlar §9.3'e | ✅ |
| 1 | Rules: sabitler, `probeCatchChance`, tembel dolum (R1–R3) | rules testleri FAIL → PASS | ✅ |
| 2 | Şema + migration: `probe_batteries` tablosu, `scan_events.shot_down`, kayıp kaydı | migration temiz DB'de | ✅ |
| 3 | Kurulum servisi + route + tamamlanma olayı (S1) | server testleri | ✅ |
| 4 | Varış: yakalanma eşiği, düşürme dalı, rapor alanı, bildirimler (S2–S11) | server testleri | ✅ |
| 5 | Sahiplik ve yaşam döngüsü aynaları (S12), contract ve bütçe (S13) | server testleri | 🟡 |
| 6 | Botlar (S14), sim aynası veya "etkilenmez" notu | testler | ✅ |
| 7 | Web: şema, client, query, kart, dosya, kayıp satırı, ipucu, Radar günlüğü (W1–W3) | web testleri | ✅ |
| 8 | Galaksi sahnesi, VFX, ses, haptik (W4) | görsel kontrol 350 px | 🟡 |
| 9 | Metinler (6 dil), Wiki, `game-design.md`, `review-sight.md` | eşlik testi | ✅ |
| 10 | Son code review, `pnpm verify` (uzun simülasyonlar hariç), oyuncu gibi akış denemesi | yeşil | 🟡 |

### 9.2 Dosya haritası

- Rules: `packages/rules/src/constants.ts` (`PROBE` yanına yeni sabit), `packages/rules/src/intel.ts` (`detectChance` yanına).
- Server:
  - `apps/server/src/services/intel.ts`: `resolveProbe`, ~satır 1204'teki zar.
  - `apps/server/src/worker/handlers.ts`: sonda varış dalı, ~satır 690–770.
  - Yeni servis: kurulum (desen `buildInterceptor`, `apps/server/src/services/strategic.ts:153`).
  - `apps/server/src/db/schema.ts` ve `drizzle/`.
  - `publishInterceptionSight` (`strategicInterception.ts`).
  - Bildirimler, `readRadarLog`, `readProbeReports`, `planetView.ts`.
- Bot: `apps/server/src/services/bots/brain.ts` (sonda ~satır 745 ve 1059).
- Web:
  - `apps/web/src/screens/PlanetScreen.tsx` (`InterceptorBattery` deseni, ~satır 1710).
  - `apps/web/src/api/{schemas,client,queries,keys}.ts`.
  - `apps/web/src/lib/dossier.ts`, `apps/web/src/galaxy/` (desen `StrategicInterception.tsx`).
  - `apps/web/src/wiki/{fleet-and-intel,facts,guides}.ts`.
  - `apps/web/src/i18n/locales/{tr,en,de,es,fr,ja}/`.
- Docs: `docs/game-design.md`, `docs/review-sight.md`.

### 9.3 Doğrulanmış gerçekler (2026-11-24, koddan)

- 5 sn aralığı komutan + hedef başınadır ve komutanın tüm dünyaları için ortaktır (`launchProbe`, filtre `ownerPlayerId` + `targetPlanetId`). Koloniden atmak hızı artırmaz.
- Sonda 65 alaşım + 40 kristal. Hız 2369,25, `distanceFactor` 1,2. Uçuş 450 birimde 13,7 sn, 2.000 birimde 61 sn, 12.000 birimde 365 sn.
- Zar `resolveProbe` içinde, fuzz çekimlerinden sonra çekilir: `rng() < detectChance(radar, shipyard)`. Raporun Radar günlüğü satırı her zaman yazılır.
- `readRadarLog` yalnız `detected = true` satırlarını gösterir.
- Sonda raporu hedefin Radar seviyesini içermez (`silhouetteOf`).
- Gelir: Rafineri 10'da saatte 950 alaşım, 475 kristal. Radar 3→4 yükseltmesi 3.841 alaşım / 2.881 kristal.
- Botlar sonda atar (`brain.ts`), stratejik şarj hiç kurmaz.
- Onur donanma değeri açık bir tür listesi okur (`honorNavy.ts`); ayrı tablo oraya sızmaz.
- Ödül sayacı `kind = 'probe'` ve `status <> 'cancelled'` görevleri sayar (`rewards.ts`). Günlük görev de çıkan sondaları sayar. Düşürülen görev `resolved` kalmalıdır.
- Klan üyeleri birbirini hedefleyemez (`CLAN_FRIENDLY_FIRE`).
- Ücretli sonda uyarısında oyuncu başına 30 dakikalık bekleme var (`armPaidAlert`, `PROBE_ALERT_COOLDOWN_MINUTES = 30`).
- `notify` yalnız `onConflictDoNothing` ile çift yazmayı engeller; sayı birleştirme yok. Toplu bildirim için zaman dilimli `refId` + sayaç gerekir.
- Bot sonda döngüsü (`brain.ts:1056`): okuma `readingFreshMinutes`'tan eskiyse ve hedefe uçan sonda yoksa her turda yeniden sonda atar.
- Çalışma ağacında başka oturumların commit edilmemiş işi var (günlük görevler, migration 0265). Yeni migration numarası uygulama anında kontrol edilecek.

### 9.4 Çalışma kuralları

- TDD zorunlu: önce test, FAIL, sonra kod, PASS.
- Uzun simülasyonlar çalıştırılmaz.
- Başkalarının hunk'larına dokunulmaz; dosya yolları tek tek stage edilir.
- Deploy yalnız istenirse yapılır.
- Bot ifadesi hiçbir metne ve payload'a girmez.

### 9.5 İlerleme notları

- 2026-11-24: plan yazıldı, owner kararları K1–K7 alındı.
- 2026-11-24: öz denetim. K8 (şarj bitince bataryasız gibi) alındı. Bot geri çekilmesi, bildirim toplama yöntemi ve ölçüm planı eklendi.
- 2026-11-24: uygulama. Rules, şema + migration 0266, kurulum servisi + route, varış dalı, bildirimler, botlar, web (kart, bildirim, dosya satırı, kayıp satırı, gönderme ipucu, Radar günlüğü), galaksi efekti, Wiki ve dokümanlar yapıldı. Plandan sapmalar:
  - Zar `rng()` sırasından çıkarıldı, kendi tohumlu akışına taşındı (`probeCatchRoll(missionId)`). Rapor bantları değişmez; aynı görev aynı zarı atar.
  - Toplu bildirim `refId` dilimi yerine açık bildirimi güncelleyerek yapılıyor: 10 dk içinde aynı dünyada açık `scan_detected` (`shotDown`) satırı varsa sayısı artar, yeniden okunmamış olur.
  - İşleyicideki `publishInterceptionSight` kaldırıldı: her atışta sezonun bütün gezegenlerini tarıyordu, istemcide de sonda atışını okuyan veri yoktu. İki taraf bildirimle zaten yenileniyor.
  - Galaksi efekti iki tarafa kendi istihbaratından (`probeLosses`, Radar günlüğü `shotDown`), Teleskop tanıklarına trafik okumasından (`probeShots`, `projectProbeShots`) gelir. Tanık dünyayı tanıyan bir Teleskopla görür, tarafların adını görmez; pencere `PROBE_DEFENCE.witnessMinutes` (10 dk). Sezon başına önbellekli tek sorgu, indeks `probe_shots_season_idx` (migration 0268).
  - Kart görseli `probe-battery-v1.webp`: Antigravity (`agy`, `generate_image`) ile mevcut savunma/radar kart görselleri referans verilerek üretildi; üç adaydan (yakın taret, geniş plan, alçak açı) alçak açı seçildi. Codex görsel üretimi bu hesapta çalışmadı.
  - §7.1 ölçümleri ayrı sayaç olarak eklenmedi; ham veri tablolarda duruyor (`probe_batteries.started_at`, `probe_shots.shot_at`, `probe_reports.silhouette->'probeBattery'`). Kurulum komutu analytics'e `build` olarak düşüyor.
  - S12 (sahiplik/devir/terk/silme) için ayrı kod yazılmadı: batarya dünyaya bağlı (`planet_id` cascade), dünya el değiştirince yeni sahibe geçer. Ayrı test yazılmadı.
- 2026-11-24: owner playtest + seviye isteği. Değişenler:
  - Atış varışta değil, yaklaşırken: `probe_defence` olayı `probeShotMoment` anında (çizilen yolda hedef merkezinden 5 yarıçap, uçuşun en erken yarısı). Varış artık düşürmez, yalnız silahsız zarı atar. Atış noktası `probe_shots.x/y/z`'ye yazılır; efekt gönderen ve savunanda bu noktada oynar; tanığa nokta gitmez (sondanın geldiği yönü verirdi, D53), tanıkta efekt dünyanın bir yanında aynı uzaklıkta oynar (eski efekt dünyanın rastgele bir yanında, 2,3 yarıçapta oynuyordu ve gezegenin arkasında kalabiliyordu).
  - Savunanın efekti Radar günlüğünden değil `probeShotsFired`'dan gelir. "Görüldü" kaydı komutan başına ayrı anahtarda (aynı tarayıcıda iki hesap birbirini sıfırlamasın).
  - Patlama büyütüldü: 120 kıvılcım, 11 panel, daha büyük duman, en küçük ekran boyu 64 px.
  - Seviyeler (owner): 5/10/15/20 şarj, tam dolum her seviyede ~30 dk, ucuz başlangıç + yavaş artış, seviye başına Radar +1, yakalama +%3 (tavan %90). Benim kararlarım: seviyenin Radar'ı yalnız siparişi kilitler, çalışma eşiği Radar 3 kalır; yükseltme sürerken eski seviye çalışır, bitince ek şarjlar hazır gelir; tek komut kurar ya da bir seviye yükseltir (`PROBE_BATTERY_BUSY`, `PROBE_BATTERY_MAX`; `PROBE_BATTERY_INSTALLED` kalktı). Migration 0270 (`probe_defence` olayı, seviye/yükseltme kolonları, atış noktası).
  - 2026-11-25 owner playtest 2 ("ateş başlar başlamaz sonda yok oluyor"): sunucu ateşi isabetten `fireLeadSeconds` (2,4 sn) önce açar (`probe_defence` olayı ateş anında; batarya ve zar o an okunur). `probe_shots` ateş anını ve sondanın o anki yerini de tutar (`fired_at`, `from_x/y/z`, migration 0271). Efekt sunucu saatine bağlı: sonda, uçuşunun çizdiği modelle (`PROBE_ROUTE`) kaldığı yerden noktaya uçmaya devam eder; her mermi sondanın ineceği yere nişan alır, son mermi noktada vurur. Geç duyan ekran son 1,1 sn'yi oynar; tanık baştan oynar. El kitabı: GF-02 (yol evresi), GF-03 (temas noktasından saçılma), MP-07 (gecikme ateşin içinde saklanır).
  - Bilinen sınır: atış noktası gezegenle kamera arasında değilse (kamera hedefin öbür yanındaysa) dünya önünü kapatır; dünyalar opaktır kuralı korundu.

