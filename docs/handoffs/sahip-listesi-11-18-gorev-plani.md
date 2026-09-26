# Sahip listesi 11–18 · Görev planı (uygulayan ajan için)

Bu dosya, uygulamayı yapacak ajanın **tek başlangıç noktasıdır**. Sahip kararları bağlayıcıdır, yeniden açılmaz.
İş bitince kod incelemesini başka bir ajan (planı yazan) yapar; en alttaki "Teslim" bölümünü eksiksiz doldur.

- Hazırlayan: planlama oturumu, 2026-09-25.
- Onaylı plan kopyası: `~/.claude/plans/pasted-content-id-e161-10-user-sequential-engelbart.md`.
- Satır numaraları ui-v2 dalından (272cffc) alındı. Birleşmeden sonra kayabilir, `grep` ile doğrula.
  **Kod ve testler dokümandan üstündür.**

---

## 1 · Kapsam

> **Uygulama kararı (2026-09-25):** Bu dosyanın ilk taslağındaki 750 hedefi, sahip ile yapılan
> görüşme sonunda **galaksi yarıçapı 4500, minimum dünya mesafesi 450** olarak kesinleşti. Master
> üzerinde uygulanır; yeni sezon/tam sıfırlama ile yayınlanır. Aşağıdaki uygulama notları kod ve
> testlerle birlikte bu son kararı esas alır.

| # | İş | Tür |
|---|---|---|
| 12 | Dolu galakside iki dünya arası en kısa mesafe **450** olsun | Galaksi üreteci — karar kesin |
| 11 | Nötr dünyalar sezon başında hepsi birden değil, **ihtiyaca göre kademeli** açılsın | Sezon sistemi |
| 14 | Tersane'nin erken basamakları pahalansın | Denge |
| 18 | Kazıcının **gidiş** hızı −%25, kayalar da −%25 | Denge |
| 16 | Liderlikte ülke bayrağı; kayıtta ülke sorulur, ayarlardan değişir | Kimlik (DB + API + UI) |
| 15 | Liderlik ve ana menü (Komutan sayfası) v2 tasarıma geçsin | Arayüz |

## 2 · Sahip kararları (bağlayıcı)

- **Dal:** iş master'da yapılır. **Önkoşul:** sahip ui-v2'yi master'a almış olmalı; 15. madde v2 kitine dayanır.
- **Yayın:** yeni sezonla, tam sıfırlamayla. Yalnız DB şeması göç ister; oyun durumu için geçiş kodu yazılmaz.
- **12 · Mesafe:** tüm gerçek adres çiftleri için minimum 450; `GALAXY.radius = 4500`.
- **11 · Nötrler:**
  - Sezon **%20** ile açılır: T1 15 · T2 8 · T3 3. Bugünkü tam sayı 76 / 38 / 16 = 130'dur.
  - **Sayım takvimi:** sezon başı + 3 gün, sonra her 24 saat.
  - **Ölçü ihtiyaçtır, aktiflik değildir.** Sahibin sözleriyle: *"ne kadar kişi koloni yapabilecek seviyede ama
    kolonisi yok. Mesela level 9 ama kolonisi yok. Level 12 ama hiç kolonisi yok veya 1 adet var."*
  - Hâlâ nötr kalan sayı ihtiyacın altındaysa aradaki fark kadar yeni nötr açılır.
  - **Açılan nötr asla silinmez.** Tavan katman başına 76 / 38 / 16.
  - İhtiyaç sayımına botlar girmez.
- **14 · Tersane:** yalnız erken basamaklar pahalanır. 3→4 ve üstü bugünkü fiyatında kalır.
  - 1→2 ≈ 2.293 alaşım / 882 kristal (bugünkü 2→3 fiyatı).
  - 2→3 = 3.500 alaşım / 1.250 kristal (sahibin son kararı).
- **18 · Kazıcı/filo:** Prospector'ın rock/debris gidişi 618,75; boş dönüş 618,75, yüklü dönüş 309,375.
  Üretilen tüm mobil oyuncu gemileri eski hızlarının %75'i, korsan filoları mevcut hızlarının %70'i olur.
  Kayalar da eski hızlarının %75'inde hareket eder; yüklü dönüş yeni gidiş hızının yarısıdır.
- Konvoy ve ticaret gemisi pencereleri 180 dakikadır. Ticaret pencereleri 01–04, 07–10, 15–18, 21–24.
- **16 · Ülke:** mevcut kullanıcılar ve **bütün botlar Türkiye** olur. Kayıtta ülke sorulur, ayarlardan değiştirilebilir.
- **15:** Leaderboard ve Ana menü ui-v2 dilinde yeniden tasarlanır.

**Plan onayında sahibe bildirilen varsayılanlar** (sahip itiraz etmezse geçerli):
1. Enkaza giden Kazıcı da gidişte %25 yavaşlar.
   "Kısa sefer" eşiği mesafe olarak aynı kalır, yani dakika eşiği ×1/0,75 ile ölçeklenir.
2. Tersane 2→3 fiyatı son görüşmede sabitlendi: 3.500 alaşım / 1.250 kristal.
   Kodda `YARD_EARLY_COST` ile tek kaynaktan tutulur.

## 3 · Başlamadan önce

1. `git merge-base --is-ancestor ui-v2 master` sonucu **true** olmalı.
   - False ise dur ve sahibe "ui-v2 henüz master'da değil" de.
   - 2026-09-25 akşamı henüz birleşmemişti.
2. Ana ağacın (`/home/yildirim/Desktop/Coding/MyProjects/blindspace`) durumuna bak.
   - Başkasına ait commit edilmemiş değişiklik varsa ona dokunma. Master'dan ayrı bir worktree dalı aç.
   - **`git stash` kullanma:** stash yığını diğer oturumlarla ortak.
3. Oku:
   - `CLAUDE.md`
   - `docs/ui-v2/PROGRESS.md`: çalışma kuralları, "Bilinen kırmızı testler", "İlk tam sunucu ölçümü".
   - `docs/ui-v2/gozlemevi.md`: yalnız ilgili bölümleri grep'le bul.
4. Göç numarasını birleşmeden sonra belirle. Bugün son dosya `apps/server/drizzle/0112_*.sql`.

## 4 · Çalışma kuralları (sahip talimatı, zorunlu)

- **TDD her kod satırı için:** gereksinim → happy path ve kenar durumlar → nereye dokunulacağı, neyin kırılabileceği →
  **test → FAIL → kod → PASS** → code review.
  - Yalnız stil ve CSS değişiklikleri muaf.
  - Her maddenin kabul kriteri ayrı bir test olur.
- **Kural değişikliğinin aynaları:** bir kural birçok yerde yaşar:
  - sunucu yolları
  - `packages/sim`
  - her `apps/web` ekranı
  - `locales/{tr,en,de,fr,es}`
  - eski davranışı sabitleyen testler

  Değiştirmeden önce eski kuralın bütün okurlarını grep'le listele. Her biri ya test alır ya da "etkilenmez" notu.
- **Her yeni metin 5 dilde yazılır:** tr, en, de, fr, es. Testler İngilizce koşar.
- **Tasarımın dört sorusu** (`CLAUDE.md`) her yüzeyde uygulanır: netlik, öngörülebilirlik, karar desteği, etkileşim
  maliyeti. "Oyuncu API'yi anlamaz, gördüğünü anlar."
- **Boyutlar sıkı:** hedef ekran 350×812, gövde metni 12 px. Büyük yazı ve büyük düğme yok.
  Masaüstü (1100 ve 1280) de çalışmalı.
- **Görmeden tasarım yok.** Her v2 yüzeyi önce galeriye (`apps/web/src/v2/gallery/Gallery.tsx`) örnek veriyle eklenir,
  commit'ten önce fotoğraflanır ve okunur. Komutlar `PROGRESS.md` çalışma kurallarında:
  - Galeri sunucusu: `pnpm --filter @astera/web exec vite --port 5199 --strictPort --host 127.0.0.1`.
  - Kamera: `node tools/v2-gallery.mjs <çıktı> en tr de`. 350 px DPR 2 ve 1280 px fotoğraflar; tr, de ve fr'de taşmaya bak.
  - Gerçek oyun için kendine **özel bir veritabanı** aç, ör. `astera_items`.
    `astera`, `astera_test` ve `astera_ui_v2` veritabanlarına dokunma. `tools/v2-shell.mjs` hesap açmadan girer.
  - `tools/visual.mjs` her koşuda hesap açar; ~5 koşudan sonra kayıt 30 dk kilitlenir.
- **Sunucu testleri seri koşar ve özel bir `_test` DB kullanır.** Örnek:
  `DATABASE_URL=postgres://astera:astera@localhost:5433/astera_items_test npx vitest run <dosyalar>` (`apps/server`).
  - Adı `_test` ile bitmeli. İki vitest koşusu aynı DB'de birbirini siler.
  - **İş sırasında yalnız dokunulan testler** koşar.
  - **Tam sunucu (~40 dk) ve tam web paketi teslimde bir kez** koşar.
- **Temel ölçüm:** HEAD'deki bilinen kırmızılar `PROGRESS.md`'de listeli. Bunları yeniden ölçme; yalnız **yeni kırmızı
  eklenmediğini** göster.
- **Kalite kapısı:** `pnpm verify` sıfır tip ve sıfır lint hatası vermeli.
  - `pnpm lint`'i root script'ten koş (4 GB heap); çıplak `eslint .` koşma.
  - Lint için yapılan her düzeltmeden sonra typecheck'i de koş.
- `any` ve derleyici susturan cast yasak. Güvenilmeyen sınırlar Zod ile ayrıştırılır.
- Kırmızı bir testi değiştirmeden önce kök nedeni bul. Test yeni bir sahip kararıyla eskidiyse commit mesajında bu kararı an.
- **Push ve deploy yok.** Commit'le, sahip birleştirip yayınlar.

## 5 · Sıra

1. **12:** sorular ve karar, sonra uygulama. Galaksi adresleri 11'in temeli olduğu için 11'den önce gelir.
2. **11:** kurallar → göç → sunucu → sim → kronik.
3. **14** ve **18:** önce kurallar, sonra sunucu, sim ve web aynaları.
4. **16:** göç → sunucu → web.
5. **15:** liderlik ve menü v2, 16'nın bayraklarıyla.
6. Dokümanlar: `docs/balance.md` ve `docs/game-design.md`. Bu dosyadaki "Durum" tablosu da güncellenir.

---

## 6 · Madde 12 — En kısa mesafe 450 (karar kesin)

**İstenen:** Dolu bir galakside, nötrler dahil herhangi iki dünya arasındaki en kısa mesafe en az 450 olsun.

**Bugünkü durum:**
- Adresleri `generateGalaxy` üretiyor (`packages/rules/src/galaxy.ts:130-177`, `mulberry32(seed)`). Her bant hacimce
  düzgün rastgele doldurulur. Aday, **herhangi bir banttaki** komşuya `GALAXY.minSeparation = 225`'ten
  (`constants.ts:2334`) yakınsa reddedilir. 96 başarısız denemeden sonra `RangeError` fırlar.
- 1.700 adres var, yarıçap 3.000 (`constants.ts:2355-2364`):

  | Grup | Adet | Bant |
  |---|---|---|
  | Oyuncu koltuğu | 1.000 | 0,65–1,0R |
  | Bot | 100 | 0,58–0,65R |
  | Nötr havuzu | 600 | 0–0,56R |

  Nötr katmanları: T1 0,40–0,56R · T2 hedef 0,28R · T3 hedef 0,10R.
- Ölçülen en kısa mesafe 225,0–225,4, yani taban bağlayıcı. Oyuncunun en yakın komşu medyanı ~290.
- Uçuş süresi: `dakika = mesafe / hız × 1,2` (`travel.ts:27`). 225 birim en hızlı gemiyle (202) 1,34 dk, Argosy ile 3,4 dk.
- **Kısıt:** 750 aralıkla rastgele yerleşimde 3.000 yarıçaplı bir küreye yalnız ~200–300 nokta sığar
  (dışlama küresi r = 375, rastgele sıralı yerleşim yoğunluğu ~0,38). 1.700 noktanın 750 ile sığması için yarıçapın
  ~5.500–6.000 olması gerekir; bu da uçuş süresini ~×1,9 uzatır.

**İlk taslaktaki sorular (kapatıldı):**
1. Minimum mesafe tüm çiftler için geçerli.
2. Adres sayısı korunarak yarıçap 4500'e çıkarıldı.
3. Kenardan kenara uçuş süresi bu yarıçap ve yeni filo hızlarıyla kural testleriyle ölçülüyor.
4. T3 ve nötr havuzu gerçek adres slotlarıyla aynı 450 tabanını kullanıyor.

Seçenekleri sunmadan önce bir scratchpad betiğiyle ölç: aday yarıçaplar ve adres sayıları için 750'nin yerleşip
yerleşmediğini, 60 tohumla. Kararları bu dosyaya yaz.

**Karardan sonra yapılacaklar:**
- Önce testler (FAIL):
  - `packages/rules/test/invariants.test.ts:298-309`: tüm çiftler ≥ yeni taban, 6 tohumda.
  - `galaxy-strata.test.ts`: bantlar (`:72-76`), oktan dengesi, 60 tohumun tam yerleşimi (`:197-209`), nötr sayıları
    (`:183-185`, `:211-215`).
  - `waiting-placement.test.ts:20-37`.
  - `strategic.test.ts:115-124`.
  - `apps/web/test/planet-visuals.test.ts:289-290`: aralık, en büyük çizilen gezegenin iki katını aşmalı.
  - `invariants.test.ts:1598-1612`: sonda süresi mesafeyle büyümeli.
- Sonra sabitler ve üreteç.
  - Gerekirse `pickSpawnSlot` (`galaxy.ts:1168-1190`) ve bekleme galaksisi yerleşimi (`waitingPlacement.ts:16-45`) de.
- **Aynalar:**
  - Kendiliğinden güncellenir: `selectNeutralSlots` (`strategic.ts:179-299`), asteroid/korsan yörünge bandı
    (`constants.ts:2426`, `:3360`), `GALAXY.asteroidBudgetSeats`, sensör merdivenleri (Teleskop/Radar mesafeleri
    yarıçapla ölçeklenmişti; 1000-koltuk işinde ×1,5), `cli/capacity.ts:305-330`, sim.
  - Yarıçap değişirse her birini ayrıca gözden geçir: yakıt mesafeye bağlı, konvoy rotası 2R/180 dk, kamera ve sahne
    ölçeği (`view.ts:56` `toWorld` ÷50, açılış kamerası `follow.ts:222`).
- Web'de dolu galaksiyi fotoğrafla: yakın zoom ve açılış pozu.

## 7 · Madde 11 — Nötrlerin kademeli açılması

**İstenen:** Sezon açılınca 130 nötrün hepsi birden oluşmasın. Önce %20'si oluşsun; kalanı, koloni hakkı boş duran
oyuncu olduğunda açılsın. Açılan nötr silinmez.

**Bugünkü durum:**
- **Sayılar:** `MULTI_WORLD.neutralCounts = {1: 76, 2: 38, 3: 16}` (`constants.ts:3507`).
  Aday adres havuzu indeks 1100–1699 (`neutralSlotPool = 1700`).
- **Seçim:** `selectNeutralSlots` (`strategic.ts:252-299`) Fibonacci hedef noktalarını (`:179-212`) en yakın boş
  adrese oturtur; sıra T3 → T2 → T1.
  **Dikkat:** `strategic.ts:196` `vertical = 1 − 2(index+0,5)/count`, yani 0. indeks +y kutbunda. "İlk K'yı aç"
  derseniz dünyalar kuzey kutbunda kümelenir.
- **Oluşturma:** `createSeasonIn` (`apps/server/src/services/season.ts:118-218`) → `createNeutralWorlds` (`:220-243`,
  sayı 130 değilse hata fırlatır) → `createNeutralWorld` (`:246-335`). Hepsi sezonu kuran transaction içinde.
- **Kayıtlar:**
  - `planets.kind='NEUTRAL'`, `player_id` NULL, adı `Neutral T{tier}-{nn}` (numara seçim sırasından).
  - Ayrıca `buildings`, `satellites` (AEGIS) ve `units` satırları.
  - `neutral_planet_state`: `tier`, `profile_seed`, `claim_until`, `next_reinforcement_at`.
  - T2/T3 için bir `neutral_reinforce` olayı.
- **Koloni hakkı:** `colonyCapacity(capitalCore)` (`strategic.ts:72`). Başkent Çekirdeği 9, 12 ve 15'te birer hak
  (en fazla 3). Sunucuda `colonyStanding` / `assertColonyCapacity` (`services/ownership.ts:~206`) koloni,
  yoldaki yerleşim (`reservations`) ve kapasiteyi sayar.
- **Nötre dönen koloniler:** hesap silme (`accountDeletion.ts:95-107`, `:285-298`), komutan transferi
  (`commanderTransfer.ts:243-253`), sadakatle ayrılma (`loyalty.ts:282-305`, Çekirdeğe göre yeniden katman alır).
  Bunlar seçilmiş slotların dışında ve başka bir katmanda da nötr üretebilir.

**Yapılacaklar — kurallar** (`packages/rules/src/strategic.ts`, saf fonksiyonlar; sunucu, sim ve testler aynısını
çağırır):
- `NEUTRAL_OPENING` sabitleri:
  - `initial = {1: 15, 2: 8, 3: 3}`
  - `perFreeSlot = 1`
  - `firstCensusDays = 3`, `censusEveryHours = 24`
  - Tavan `MULTI_WORLD.neutralCounts`
- `neutralDemand(commanders)`:
  - Girdi: her komutan için `{capitalCore, colonies, reservations}`.
  - Boş haklar: `colonyCapacity(core) − colonies − reservations`, en az 0.
  - **Her boş hak kendi sırasının katmanını ister:** 1. hak (Çekirdek 9) → T1, 2. hak (Çekirdek 12) → T2,
    3. hak (Çekirdek 15) → T3. Boş haklar `colonies + reservations + 1`'inci haktan başlayarak sayılır.
  - Örnekler: Çekirdek 9 · 0 koloni → T1 1. Çekirdek 12 · 0 koloni → T1 1 + T2 1. Çekirdek 12 · 1 koloni → T2 1.
    Çekirdek 15 · 1 koloni → T2 1 + T3 1.
  - Çıktı: katman başına toplam.
- `neutralOpeningOrder(seed, selected)`:
  - Her katmanda, seçilmiş slotları **en-uzak-nokta** sırasına dizer.
  - Başlangıç: deterministik, ör. en küçük `profileSeed`; eşitlikte slot indeksi.
  - `selectNeutralSlots` değişmez, bütün tavanı temsil eder.
- `neutralOpenings({demand, stillNeutral, opened, cap})`:
  - Katman başına `min(max(0, demand × perFreeSlot − stillNeutral), cap − opened)`.
  - `stillNeutral` = o katmanda şu an `kind='NEUTRAL'` olan dünyalar (`neutral_planet_state.tier`); geri dönen
    koloniler dahil.
  - `opened` = o katmanın **seçilmiş slotlarından** satırı olanlar, ele geçirilmiş olsa bile.
- **Kabul testleri:**
  - Çekirdek 9'da kimse yok → 0.
  - 3 kolonisi olan → ihtiyaç yok.
  - Yoldaki yerleşim hakkı doldurur.
  - Tavana ulaşılmış katman → 0.
  - Hâlâ nötr sayısı ihtiyacı karşılıyor → 0.
  - Ele geçirilen nötr `opened` sayısını düşürmez.
  - Açılış sırasının her ön eki (≥ 4) yarım kürelere ve oktanlara dengeli; +y'de kümelenme yok.
  - Aynı tohum aynı sırayı üretir.

**Yapılacaklar — sunucu:**
- `createSeasonIn` yalnız `initial` setini açılış sırasıyla kurar. "130 değilse hata" kontrolü yeni sayıya göre değişir.
- Nötr adları seçim sırası numarasına bağlı kalır: yeniden oluşturma yolları (`accountDeletion`) aynı adı üretmeli.
- Yeni olay türü `neutral_census`:
  - Göç: `ALTER TYPE event_kind ADD VALUE 'neutral_census'`. `event_kind` enumu yalnız sona ekleme kabul eder
    (`db/schema.ts:77-132`).
  - Yeni değeri aynı transaction içinde kullanma (`migrate.ts:16-23`).
  - Güncellenecek enum sıra testi: `clan-war-schema.test.ts:130-133`.
- Kayıt yerleri:
  - `HANDLERS` (`worker/handlers.ts:~2650`)
  - `TRANSFER_EVENT_POLICIES` içinde `'GLOBAL'` olarak (`transferReferences.ts:33`); `transfer-events.test.ts:7` her
    türün listede olmasını şart koşar.
- **Planlama:** `asteroid_hour` zincirini örnek al (`services/asteroidSpawn.ts`: `scheduleAsteroidHour :51-62`,
  `queueNext :275`, boot onarımı `ensureAsteroidHourEvents :291-326`, çağrısı `index.ts:46`).
  - İlk sayım sezon başı + 3 gün.
  - Her koşu sonrakini +24 saate kurar; sezon bittiyse ya da donduysa kurmaz.
  - Dedupe anahtarı: `neutral-census:<seasonId>:<iso>`.
  - Gecikmiş sayım (worker kapalıydı) bir kez koşar, sonra sonrakini kurar.
  - `ensureNeutralCensusEvents` boot'ta eksik zinciri onarır.
- **Eşzamanlılık:**
  - `pg_advisory_xact_lock` ile sezon başına tek sayım.
  - Yedek güvence `planets_season_slot_idx` unique indeksi (`schema.ts:~1212`): aynı slot iki kez açılamaz.
- **İhtiyaç sorgusu:**
  - Sezondaki bot olmayan komutanlar (`isPerson`, `services/people.ts:14-17`) için başkent Çekirdeği, koloni sayısı ve
    yoldaki yerleşimler okunur.
  - `colonyStanding` ile **aynı kaynaktan** beslenir: kural iki yerde yazılmasın.
- **Yayın:**
  - Açılıştan sonra `publishShard(tx, seasonId, 'world')` çağrılır. `publicGalaxy` önbelleği geçersizleşir ve web
    galaksiyi yeniden çeker (`shardEvents.ts:121`).
  - Yeni dünya `createNeutralWorld` ile kurulur; T2/T3 takviye olayı dahil.
- **Bekleme (WAITING) galaksileri** ruleset'i miras alır (`waitingServers.ts:56-60`). Nötr oluşturuyorlarsa aynı
  kural geçerli mi, kontrol et. Emin değilsen sahibe sor.

**Oyuncu görsün (tasarım zorunlu):**
- Galaksi kroniğine `neutral_opened` girdisi eklenir. Örnek metin: *"Galakside 4 yeni nötr dünya belirdi · 3 T1 · 1 T2"*.
- Dokunulacak yerler:
  - `services/chronicle.ts:15-47`
  - `GalaxyEventPayload` tipi (`schema.ts:~985`)
  - web `api/schemas.ts:~1720` (discriminated union; bilinmeyen tür güvenle düşer, `~1805`)
  - `ChronicleScreen.tsx:~112`; bu ekran v2 ziline de hizmet ediyor
  - 5 dilde `chronicle.ts`
- `galaxy_events.kind` metin kolonu: enum göçü gerekmez. Dedupe `(season, kind, refId)`; `refId` = sayım zamanı.

**Aynalar ve kırılacak testler:**
- `cli/capacity.ts:305-323`: 76 / 38 / 16 bekliyor; açılan ≤ tavan kuralına döner.
- Sim `packages/sim/src/season.ts:709-745` 130'un hepsini baştan kuruyor. Başlangıç setiyle kurmalı ve zaman
  döngüsünde (`~:2936`) aynı saf fonksiyonlarla günlük sayım yapmalı.
- Testler:
  - sunucu `multi-world.test.ts:116-119`, `neutral-colony-d209.test.ts:92-94`, `account-deletion.test.ts:318-319`,
    `preview.test.ts:231-234`
  - sim `strategic.test.ts:34-36`
  - Çoğu sunucu testi `seedWorld` ile ruleset 1'de nötrsüz koşuyor (`helpers.ts:251`).
- Yorumlarda eski "65 neutrals" ifadesi var (`accountDeletion.ts:21`, `season.ts:445`); dokunduğun yerde düzelt.

**Doğrulama:** Yerel özel DB'de sezon saatini ileri al (sezon başı + 3 g). Birkaç komutanın Çekirdeğini 9/12'ye
çıkar ve sayımı tetikle. Yeni dünyaların galakside belirdiğini ve kronik girdisini fotoğrafla.

## 8 · Madde 14 — Tersane erken basamakları

**İstenen:** Bugün Tersane 0→1 (143 / 55) ve 1→2 (890 / 343) başlangıç hibesiyle (`PLANET_START` 1.500 / 400 / 50)
ilk dakikalarda alınabiliyor. Oyuncu 2. kademe savaş gemilerine hemen ulaşıyor ve Tersane'nin anlamı kalmıyor.

**Bugünkü durum:**
- `profileBuilding` (`packages/rules/src/economy-profile.ts:254-344`): Tersane "staged".
  - `referenceLevel = min(30, 2×L)` (`:288`).
  - Fiyat = o aşamanın gelir farkı × `0,5 × 1,5^(ref−1) × stretch(ref)` × pay `{alaşım 1,3, kristal 1}`.
  - `YARD_GATE_TOP = 6` (`:187`) üstünde düz rejim var ve 6. basamağın fiyatından türetiliyor (`:329-340`).
- Bugünkü merdiven:

  | Basamak | Fiyat (alaşım / kristal) |
  |---|---|
  | 0→1 | 143 / 55 |
  | 1→2 | 890 / 343 |
  | 2→3 | 2.293 / 882 |
  | 3→4 | 5.662 / 2.178 |
  | 4→5 | 13.676 / 5.260 |
  | 5→6 | 32.587 / 12.534 |

- İnşa süresi binanın kendi seviyesinden gelir (`labor`); bu değişiklikte aynı kalır.
- Kapılar (`hulls.ts` `minShipyard`): Tersane 1 Kurye / Kazıcı / Bastion / Harpoon, 2 tüm T2, 4 tüm T3 (+ araştırma),
  5 Ölüm Yıldızı, 6 tüm T4.

**Yapılacaklar:**
- `referenceLevel = 2L` yerine yazılı bir aşama tablosu: `YARD_PRICE_STAGE = [0, 2, 6, 7, 8, 10, 12]`, indeks satın
  alınan basamak. `HANGAR_PRICE_STAGE` kalıbını ve docblock üslubunu izle.
  - Sonuç: 1→2 = 2.293 / 882, 2→3 = 3.500 / 1.250. 0→1 ve 3→6 değişmez, düz rejim de değişmez.
- **Kabul testleri:**
  - Tersane 0→2 toplamı `PLANET_START`'ı aşar: başlangıç hibesiyle Tersane 2 alınamaz.
  - Merdiven kesin artan.
  - 1→2 ve 2→3 fiyatları sabitlenir.
  - 0→1, 3→4, 5→6 ve 8→9 bugünkü sabitlerinde kalır: `yard-ladder.test.ts:56-61`, `producer-curve.test.ts:186-187`.
  - `yard-ladder.test.ts`'in "her kapı basamağı yerinde" başlığı güncellenir; son sabit 3.500 / 1.250'dir.
- **Aynalar:**
  - `academy.ts:27,125,167` yalnız 1. basamağı kurar; `TUTORIAL_EXIT` değişmemeli, test et.
    Akademi turunu da koş: `WEB=http://127.0.0.1:5199 node tools/visual.mjs <çıktı> --academy`.
  - Ödül zinciri `rewards.ts:214-223` (`SHIPYARD:2/3`) artık fiyatın daha küçük bir payını karşılıyor. Kese üst sınırı
    `economy-profile.test.ts:66-68`. Sahibe bilgi ver.
  - Kendiliğinden güncellenenler: `navy-package.ts:319,354`, sim `season.ts:218,1186`, bot beyni `bots/brain.ts:240`,
    web `nextCosts`, ItemSheet ve Üs kartları. Üs'te Tersane kartını 350 px'te fotoğrafla.
  - `docs/balance.md`: Tersane fiyat notu.

## 9 · Madde 18 — Kazıcı gidişi −%25, kayalar −%25

**İstenen (son karar):** Kazıcı (iç adı `PROSPECTOR`) kayaya/enkaza **giderken** %25 yavaşlasın;
boş dönüş yeni gidiş hızıyla, yüklü dönüş ise yeni gidiş hızının yarısıyla hesaplansın. Kayalar da %25 yavaşlasın.

**İlk durum (uygulama öncesi):**
- `PROSPECTOR.speed = 825` (`constants.ts:1930`).
- `prospectorSpeed(orbit) = PROSPECTOR.speed × Derrick (1,5)` (`galaxy.ts:1082`).
- `prospectorReturnSpeed(orbit, laden) = prospectorSpeed × (yüklü ? 1/2 : 1)` (`galaxy.ts:1096`, `returnSpeedFactor`).
- `GALAXY.asteroidSpeedMin/Max = 350/750` (`constants.ts:2422-2423`); statik, dinamik ve sağanak kayaları aynı bantta.
- Değişmezler (`packages/rules/test/invariants.test.ts`):
  - `:527` Kazıcı en hızlı kayadan hızlı.
  - `:542` Kazıcı `1,2 × asteroidSpeedMax` eşiğinin altında (dairesel çözücü).
  - `:515` gemi kartı `HULLS.PROSPECTOR.speed === PROSPECTOR.speed`.

**Yapılacaklar:**
- `PROSPECTOR.speed = 618,75` nominal gidiş hızıdır; `prospectorOutboundSpeed(orbit)` bunu Derrick ile çarpar.
  `prospectorReturnSpeed` aynı gidiş değerini boş dönüşte, `1/2` oranını da yüklü dönüşte kullanır.
  Böylece yüklü dönüş 309,375 olur; eski 825 tabanı artık yalnızca tarihsel karşılaştırmadır.
- **Gidiş okurları** yeni fonksiyona geçer:
  - sunucu `services/mining.ts:262` (`craftSpeed`; web `GalaxyView.tsx:2276`, `:2395` bunu okur)
  - `:499` (sefer kesişimi)
  - `:1489` (enkaz toplama; varsayılan 1)
  - sim `packages/sim/src/season.ts:2086`
  - web `academyViews.ts:138`, `rehearsalFetch.ts:229`, `PlanetScreen.tsx:2066`
- **Dönüş okurları** aynı kalır: `mining.ts:514,659,750,926,1496`, sim `:2111,2174`.
- `PROSPECTOR.shortTripMinutes` (`galaxy.ts:1121`) ×1/0,75 (varsayılan 1): eşik mesafe olarak aynı kalır.
- `GALAXY.asteroidSpeedMin/Max` → 262,5 / 562,5.
  - Oran korunur: 618,75 > 562,5 ve 618,75 < 675.
  - Kaya ömrü (2,5–5 sa) değişmez.
- **Gemi kartı:** `HULLS.PROSPECTOR.speed` = gidiş hızı (619). Değişmez testi
  `HULLS.PROSPECTOR.speed === prospectorOutboundSpeed([])` olur.
  - Metin 5 dilde "gidiş 619 · boş dönüş 619 · yüklü dönüş 309" olarak güncellendi. Satırlar
    `locales/{tr,fr}/data.ts:~351`, `{en,de,es}/data.ts:~275`.
  - Kartı ve seferi 350 px'te fotoğrafla.
- **Kırılacak testler:**
  - Doğrudan: `invariants.test.ts:515`, `fleet-calibration.test.ts:135`, `fleet-v2-contract.test.ts:256`,
    `ship-speed.test.ts:50`.
  - Yeni gidiş hızına geçecekler:
    - rules sweep'leri `invariants.test.ts:527,542,593,611,665-667,697,764,790`
    - sunucu `mining.test.ts:300,1237,1311`, `traffic.test.ts:1049,1134`, `one-galaxy.test.ts:447`,
      `snowball-audit.test.ts:328`, `debris.test.ts:248`
    - web `flight.test.ts:336`
  - En kötü uçuş sınırları (sweep, `invariants.test.ts:662-690`) 9 / 6 dk'dan ~12 / 8 dk'ya çıkar.
  - `orbit-interception.test.ts:10`'daki sabit 750 yerine `GALAXY.asteroidSpeedMax` kullanılır.
  - Değişmemesi gerekenler (dönüş bacağı): `balance-tempo-2026-09-14.test.ts:67-71`,
    `prospector-turnaround.test.ts:92-98`.
- **Ölçüm:**
  - Kaya ömrü içinde ulaşılabilirlik: örneklenen kayanın ömrünün %90'ında en kötü uçuş ≤ kalan süre olmalı.
  - `tools/asteroid-visibility-study.ts`'i yeniden koş: yavaş kayalar sensör menzilinden daha seyrek geçer.
  - Sonuçları sahibe raporla.
- Galakside kayaların hareketini ve kuyruklarını gözle kontrol et. Kuyruk periyodun kesri, görünüm aynı kalmalı.
- `docs/balance.md:565,651`.

## 10 · Madde 16 — Ülke bayrağı

**İstenen:**
- Liderlikte her komutanın ülke bayrağı görünür.
- Kayıt olurken ülke sorulur.
- Ülke ayarlardan değiştirilebilir.
- Mevcut kullanıcılar (ve botlar) Türkiye olur.

**Bugünkü durum:** Hiçbir yerde ülke, bayrak ya da ülke kütüphanesi yok. Hesaplar oyuncu kayıtlarını silen sıfırlamadan
etkilenmiyor (`accounts`, `schema.ts:226-253`); ülke oraya yazılmalı.

**Yapılacaklar — DB ve kurallar:**
- Göç: `accounts.country_code char(2) NOT NULL DEFAULT 'TR'` ve `CHECK (country_code ~ '^[A-Z]{2}$')`.
  - `schema.ts` → `pnpm --filter @astera/server db:generate`. Snapshot ve journal da gelir; `schema-drift.test.ts` korur.
  - Varsayılan değer şu yolların hepsini TR yapar:
    - `services/account.ts:50` (`registerAccount`)
    - `bots/roster.ts:142`
    - `cli/capacity.ts:160`, `cli/expand-eu1-planets.ts:104`, `cli/season.ts:603`
    - test yardımcıları `helpers.ts:197`
- `packages/rules/src/countries.ts`: ISO 3166-1 alpha-2 kod listesi ve `isCountryCode`. Sunucu Zod'u `z.enum` ile bu
  listeden kurulur.

**Yapılacaklar — API:**
- `registerBody.countryCode` (`auth/credentials.ts:50`).
  - `claimBody` (`routes/onboarding.ts:52`, `.strict()`) miras alır.
  - **API'de opsiyonel**, verilmezse DB varsayılanı TR olur. Böylece `tools/loop-check.mjs:43`, `movement.mjs:85`,
    `capacity.mjs:773` ve mevcut testler kırılmaz.
  - Arayüz her zaman gönderir.
- `/api/auth/me` (`routes/auth.ts:150-172`) ve `publicShape` (`account.ts:17-31`) `country` döner. Web `meSchema`
  (`api/schemas.ts:417`) de güncellenir.
- Yeni `PUT /api/auth/me/country` `{country}`: oturum zorunlu, Zod ile doğrulanır, geçersiz kod 400.
- Canlı liderlik `GET /api/leaderboard` (`routes/galaxy.ts:373-388`, `accounts` zaten join'li): satırlara ve `you`'ya
  `country`. Web `leaderboardSchema` (`schemas.ts:1237-1263`) ve sunucu sözleşme testi (`contract.test.ts:411`).
- Arşiv liderliği (`routes/season.ts:154-196`):
  - Sezon sonunda `SeasonRecap`'e `countryCode` anlık görüntüsü eklenir (`handlers.ts:1885`, `commanderName`'in
    yanında; `schema.ts:464`).
  - Anlık görüntüsü olmayan eski sezonlarda `seasonResults.accountId` → `accounts` join'i kullanılır.
  - `CommanderProfile` (arşiv) de bayrağı gösterir.
- **Kabul testleri (sunucu):**
  - Kayıtta ülke saklanır.
  - Ülke verilmezse TR olur.
  - Geçersiz kod 400 döner.
  - `.strict()` claim yeni alanı kabul eder.
  - `PUT` günceller; oturumsuz istek 401, geçersiz kod 400.
  - `me` ülkeyi döner.
  - Canlı ve arşiv liderliği ülkeyi taşır, arşivde yedek yol da çalışır.
  - Göç öncesi hesaplar TR olur.

**Yapılacaklar — web:**
- `Flag` bileşeni (v2 kit):
  - `flag-icons` paketinin SVG'leri (MIT). Emoji değil: Windows bayrak emojisini iki harf olarak çizer.
  - Vite `import.meta.glob` ile kod→URL haritası kurulur, `?url&no-inline` ile.
  - Bayraklar JS'e base64 gömülmemeli; yalnız ekranda görünen bayrak indirilmeli. `vite build` çıktısında doğrula.
  - CSP `img-src 'self'` izin veriyor (`deploy/nginx/astera.conf:258`).
  - Erişilebilir ad `Intl.DisplayNames([dil], {type: 'region'})`'dan gelir. Görsel yüklenemezse kod yazılır.
- `CountryPicker` (v2 Sheet):
  - Arama alanı v2 hap stilinde. Tarayıcının açılır listesi (`select`) kullanılmaz (`gozlemevi.md:~497`).
  - Arama Türkçe İ/ı'yı doğru katlar.
  - Tahmin edilen ya da şimdiki ülke en üstte, geri kalanı yerel adla alfabetik.
  - Ülke adları `Intl.DisplayNames`'ten gelir; 5 dilde ülke tablosu gerekmez.
- **Kayıt:** Akademi'nin `onboarding/ClaimDialog.tsx`'inde şifre adımına "Ülke" satırı: bayrak, ad ve "Değiştir" →
  `CountryPicker`.
  - Varsayılan `navigator.languages`'ın bölge kısmından tahmin edilir (`de-AT` → AT), bulunamazsa TR.
    `i18n/languages.ts:52` bölgeyi atıyor, doğrudan `navigator.languages` oku.
  - "Gezegeni al" düğmesi aynı kalır: `tools/v2-shell.mjs:89-96`, `visual.mjs:148-151` ve `onboarding.mjs` kırılmaz.
  - `onClaim` zinciri: `Academy.tsx`, `Rehearsal.tsx`, `LandingScreen.tsx`, `useSession.ts:146/259-273`,
    `api/client.ts:434-446`.
- **Ayarlar:** Komutan sayfasının Hesap bölümünde "Ülke" satırı: bayrak, ad → `CountryPicker` → `PUT`.
  - Oturum `useSession`'ın `settle` yolundan güncellenir (react-query değil).
  - Ardından `keys.leaderboard` geçersizleştirilir.
- **Gösterim:**
  - Komutan kartında (`v2/hud/CommanderCard.tsx`) adın yanında bayrak.
  - Liderlik satırlarında addan önce bayrak.
  - `row-name-fit.test.tsx`: bayrak satır genişliği alır, uzun adlar kesilmemeli.
- 5 dilde metinler: "Ülke", "Ülkeni seç", arama ipucu, onay.
- **Web testleri:**
  - `Flag`: doğru URL ve erişilebilir ad; bilinmeyen kodda harfler.
  - `CountryPicker`: arama, İ katlama, seçim.
  - `ClaimDialog`: tahmin edilen ülkeyi gönderir; değiştirilen gönderilir.
  - Liderlik satırı bayrağı gösterir.
  - Komutan sayfasında değiştirme akışı.

## 11 · Madde 15 — Liderlik ve ana menü v2

**İstenen:** Liderlik ekranı ve ana menü (Komutan sayfasındaki menü) ui-v2 tasarımına göre yeniden tasarlansın.
İkisi de hâlâ eski kitte.

**Bugünkü durum:**
- İkisi de zaten bir v2 Sheet içinde açılıyor (`GalaxyView.tsx:1708-1787`). İçerik tamamen eski kit.
  - Eski bileşenler: `ui/kit`'ten `EmptyState`, `Unreachable`, `Waiting`, `ArtWell`, `Section`, `Segmented`, `Stat`,
    `Button`, `Note`.
  - Eski sınıflar: `plate`, `plate-cut`, `plate-sunk`, `socket`, `field`, `legend`, `name`, `num`, `rail-soft`,
    `readout`, `slider`.
  - Eski renk jetonları: `text-crystal`, `text-bone`, `text-faint`, `bg-void`, …
- **Liderlik:**
  - `screens/SeasonArchiveScreen.tsx` (~1.300 satır): sezon çipleri, canlıda `SeasonRewardBoard` ve
    `LeaderboardScreen`; arşivde `ArchivedLeaderboard` ve arama; `CommanderProfile` (sezon/genel `Segmented`).
  - `screens/LeaderboardScreen.tsx` (268 satır): yapışkan `<input type="search" class="field">`, "yakın rakipler"
    şeridi (`NearbyRival`), satırlar (madalya/numara, 40 px `PlanetSigil`, [TAG] ad, dünya · Tier, merkez çizgiden
    çubuk, işaretli skor), kendi satırı `aria-current`.
  - `ui/SeasonRewardBoard.tsx` (226 satır): `plate plate-cut` akordiyon.
  - Veri: `GET /api/leaderboard` → `{ladder, you}`; arşiv `GET /api/season-archive/:id/leaderboard`.
- **Menü:** `shell/MenuPanel.tsx` (974 satır). Üstünde v2 `CommanderHost` / `CommanderCard` var. Bölümler:
  - Acil satırlar: Sessiz Uzay, sezon özeti.
  - Rakip çipleri.
  - Karolar: Sezon (Sıralama, Ödüller) · Astera (Mağaza, Envanter, Duyurular, Geri bildirim, Admin) · Yardım.
  - Cihaz: dil, ses, müzik, kalite, FPS, gizlilik.
  - Hesap: galaksi, sezon saati, bağlantılar, çıkış.
  - Bilinen kusur: Almanca etiket sütunu kesiliyor ("BILDQUALIT…", "DATENSCHU…").
- Şartname: `docs/ui-v2/gozlemevi.md:399` (menü yalnız Komutan'da), `:604`, `:691` ("Menüdeki tüm bölümler aynen"),
  `:709-714`, `:490-499` (yapılmayacaklar). Leaderboard ve menü için ayrı bir maket yok.

**Tasarım yönü:**
- Dil maketlerden türetilir: `docs/ui-v2/design-mocks/image copy 6.png` (İstihbarat satır listesi),
  `image copy 7.png` (Klan, Sen yokken).
  - Satırlar ince çizgiyle ayrılır; sayılar sağda mono; turkuaz "sen" rengi; kartlar ince kenarlı.
- En yakın hazır örnek `ClanStandings` (`screens/ClanScreen.tsx:1144-1233`): `divide-v2-line`, kendi satırın
  `bg-v2-self/10`, `font-v2-mono tabular-nums`.
- v2 kit: `v2/kit/Sheet.tsx`, `Surface.tsx` (`Section`, `SectionHead`, `Plate`, `Button`, `Chip`, `EmptyState`, `Note`,
  `Stat`, `PriceTag`; eskiyle aynı prop'lar), `Segmented.tsx`, `ChoiceChips.tsx`, `Toggle.tsx`, `Freshness.tsx`.
  - Kitte `Waiting` / `Unreachable` ve satır bileşeni yok, gerekirse ekle.
  - İkon setinde (`v2/icons.tsx`, `docs/ui-v2/icons.svg`) kupa, madalya ve bayrak yok, gerekirse ekle.

**Liderlik — yapılacaklar** (dört soruyla):
- **Satır:** sıra (1–3 madalya tonunda, v2 renkleriyle) · bayrak · [klan etiketi] ad · küçük dünya adı · sağda mono
  Hakimiyet · #1'e göre ince çubuk. Yoğun ama okunur, 350 px'te taşmaz.
- **Netlik:** Hakimiyet'in ne olduğu, nasıl kazanıldığı, büyüğün iyi olduğu bir dokunuş derinde ("Nedir?").
- **Kendi yerin:** kendi satırın `self` renginde. Ekranda değilse altta yapışkan "Sen · #34 · 12.480" satırı durur;
  dokununca satırına kayar.
- Yakın rakipler şeridi v2'de; arama v2 hap alanında; sezon seçimi `ChoiceChips` ile.
- **Karar desteği:** ödül tablosunda (`SeasonRewardBoard`) "bu sıradaysan alacağın" ve bir üst ödül eşiğine uzaklık.
- Arşiv (`ArchivedLeaderboard`, `CommanderProfile`) aynı satır dilinde.
- Korunacak davranışlar (mevcut testler): satırlar, `aria-current`, `planetArt` sigil `src`, yakın şerit, arama ve
  Türkçe İ, geri oku (`returnsToMenu`). Dosyalar: `apps/web/test/leaderboard.test.tsx`, `season-archive.test.tsx`.

**Menü — yapılacaklar:**
- `MenuPanel` v2 `Surface` ve `Plate` ile. Bütün bölümler ve kalemler yerinde kalır (şartname `:691`).
- Karolarda ikon, ad ve tek satırlık amaç: oyuncu neden açacağını bilir.
- Cihaz ayarları v2 `Segmented` / `Toggle` ile. Almanca etiket kesilmesi düzelir: etiket doğal genişlikte, sığmayan
  kontrol alta iner (M5'teki Komutan ayarları düzeltmesiyle aynı yöntem).
- Hesap bölümü: galaksi, sezon saati, **ülke** (madde 16), bağlantılar, çıkış.
- Korunacak testler: `menu-structure.test.tsx` (gruplar, `data-menu-tile`, `returnsToMenu`),
  `v2/commander-card.test.tsx:83-90`.
  - Eski kit Sheet'i kullanan geri oku testi v2'ye taşınır.

**Görsel doğrulama:**
- Galeri görünümleri: `leaderboard`, `leaderboard-archive`, `menu`, `country-picker`.
- 350 px DPR 2'de en/tr/de, ayrıca 1280 ve 1100 px. tr, de ve fr'de taşmaya bak.
- Sonra gerçek oyunda `tools/v2-shell.mjs` ile, özel DB'de.

---

## 12 · Teslim (kod incelemesi için doldur)

- [x] 12'de sahibe sorulan sorular ve verilen kararlar (bu dosyaya yazılmış hâliyle).
- [x] Uygulama kapsamı: 12, 11, 14, 18, 16 ve 15 çalışma ağacında tamamlandı; yeni sezon sınırı korunuyor.
- [x] Aynalar tablosu: kural değişiklikleri server / sim / web / 5 dil / test yüzeylerine işlendi; etkilenmeyen
      yüzeyler test notlarında gerekçelendirildi.
- [ ] Her maddenin commit'leri, hash ve tek satır açıklamayla (commit/push istenmediği için çalışma ağacında).
- [ ] Her maddenin kabul testlerinin listesi ve FAIL → PASS kanıtı (son doğrulama turu sürüyor).
- [ ] `pnpm verify` çıktısı: sıfır tip ve sıfır lint.
- [ ] Tam web paketi ve tam sunucu paketi sonuçları (bir kez, seri, özel DB). Kırmızılar `PROGRESS.md`'deki bilinen
      listeyle karşılaştırılmış olmalı; **yeni kırmızı yok**.
- [ ] Sim testleri.
- [ ] Ölçüm raporları:
  - 12: yeni en kısa mesafe ve uçuş süreleri.
  - 18: ulaşılabilirlik ve `asteroid-visibility-study`.
  - 14: Tersane 2'ye ulaşma süresi.
- [x] Fotoğraf yolları: galeri + gerçek oyun, 350 / 1280, en / tr / de (galeri çıktıları `/tmp/blindspace-gallery*`).
- [ ] Sahibe söylenmesi gerekenler: ödül zinciri payı, WAITING galaksi kararı, açık sorular.

### Son doğrulama turu · 2026-09-26

- Rules tam koşusu: **1.703/1.708 test geçti**; kalan beş assertion `PROGRESS.md`'deki bilinen
  Academy, başlangıç ekonomisi, convoy firepower ve transport-ladder kırmızılarıdır. Geometri ve
  hız süpürmeleri (en az 450 ayrım, 1.230 adres, kaya erişimi) geçti.
- Bu koşudan sonra sahibin 2026-09-26 kararıyla dört test dosyasındaki eski beklentiler güncel
  kurallara uyarlandı: START gerçek Dart fiyatı, Academy çıkışı 1.461 kristal, transport
  kargo/değer üst sınırı 1,5 ve konvoyun güncel fiyat temelli ödül hesabı. Render sürerken test
  çalıştırmama talimatı nedeniyle bu değişiklikler henüz yeniden koşturulmadı.
- Server seçili sezon/nötr koşuları: **78/78**, onboarding koşusu: **27/27**; onboarding'de görünen
  Dart kristali **78** olarak doğrulandı. `profileHull` iç reçetesi 60'tır ve ayrı bir testte bu
  nedenle 60 kalır.
- Sim stratejik koşusu geçti. Tam sezon koşusunda mevcut filo yavaşlatmasının ardından TAX bandı
  **LOW** (`0,0213`) ve seed 42'de GRINDER median rank 10 ile TURTLE rank 9 kaldı. Bu, kod
  hatası kanıtı değil; kabul bandını/AI saldırı temposunu değiştiren bir denge kararı gerektiriyor.
- Web typecheck, build ve hedefli lint geçti. Root `pnpm lint` 4 GB heap'te OOM verdi; aynı tam
  ESLint taraması 8 GB heap ile hatasız tamamlandı. `pnpm verify` bu nedenle proje script'inin
  4 GB bellek sınırı açısından yeniden üretilebilir biçimde yeşil değildir.

## Durum

| Madde | Durum | Commit'ler | Not |
|---|---|---|---|
| Önkoşul | Uygulandı (ui-v2 master'da, 2026-09-25) | — | Doğrudan `master` üzerinde |
| 12 | Uygulandı | — | radius 4500, min 450; testler geçti |
| 11 | Uygulandı | — | staged neutral census + chronicle |
| 14 | Uygulandı | — | tersane 2→3 erken maliyetleri işlendi |
| 18 | Uygulandı | — | Prospector, oyuncu/pirate hızları, convoy/trade işlendi |
| 16 | Uygulandı | — | kayıt/ayarlar/liderlik ülke bayrağı |
| 15 | Uygulandı | — | leaderboard/menu v2 + galeri kontrolü |
