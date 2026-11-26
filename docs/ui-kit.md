# Oyun arayüzü kiti — kullanım rehberi

Oyuncunun gördüğü her yüzey bu kitle kurulur. Kit `apps/web/src/game-ui/` altındadır (`gk-` öneki). Bu belge bir haritadır; parçaların gerçek davranışı kodda ve `apps/web/test/game-ui/` testlerindedir. İkisi ayrışırsa kod esastır, bu belge düzeltilir.

## 1. Kural (owner, 2026-11-26)

1. **Kit zorunludur.** Yeni veya güncellenen bir yüzeyde kitte karşılığı olan bir şey (buton, sekme, sayaç, çubuk, kart, rozet, sheet) elle çizilmez; kitin parçası kullanılır.
2. **Karşılık yoksa önce kite eklenir.** Yeni parça `game-ui`'ye yazılır, `index.ts`'ten dışa açılır, galeride gösterilir ve testiyle birlikte gelir; ekran onu sonra kullanır (aşama 4.0, kural 2).
3. **Önemli an kendine özgü olabilir, kitin dışında olamaz.** Ödül, ilk açılış veya sıçrama gibi anlar `apps/web/CLAUDE.md` §6 gereği kendi sunumunu alır. Bu sunum da kitin renk rolleri, yazı ölçeği, boşlukları, hareket süreleri ve malzemeleriyle kurulur. Ham renk ve ölçek dışı boyut kullanılmaz.
4. **Eski v2 parçası yeni kullanım almaz.** `src/v2/kit` altındaki bir parçanın kitte karşılığı varsa dokunduğun ekranda kit parçasına geç. Tabloda karşılığı olmayan v2 parçası (`ForceRuler`, `SignalBars` gibi) kalır. İstisna `Sheet`'tir: sürükleme ve kademe davranışı onda, görünümü kitten gelir (bkz. §4).

| Eski v2 parçası | Kitteki karşılığı |
| --- | --- |
| `HoldButton` | `GameHold` |
| `ClassEmblem` | `Emblem` |
| `Cost` | `CostLine` |
| `StoreBar` | `StoreGauge` |
| `RoomBar` | `RoomGauge` |
| `QueueLane` | `QueueSlot` |
| `Segmented` | `GameTabs` veya `Choices` |

## 2. Nerede

- **Parçalar:** `apps/web/src/game-ui/index.ts` tek giriştir; ekranlar oradan içe aktarır.
- **Renk ve ölçüler:** `game-ui/tokens.css`. Kitte ham renk yazabilen tek dosyadır.
- **Malzeme ve parça stilleri:** `game-ui/game-ui.css`.
- **Ekran düzeyi birleşikler:** `apps/web/src/ui/`. Birden çok ekranın paylaştığı ve kit parçalarından kurulan birleşikler buradadır (ör. `HonorTargetCard`, `CapsuleRow`).
- **Katalog:** `v2-gallery.html?view=ui-kit&lng=tr`. Ayrıntı görünümleri: `ui-kit-base`, `ui-kit-hud`, `ui-kit-launch`, `ui-kit-list`, `ui-kit-report`, `ui-kit-standard`.

## 3. Token'lar

Değerlerin kaynağı `tokens.css`'tir. Aşağıdaki özet 2026-11-26 tarihlidir; değer değişirse dosya kazanır.

| Konu | Token ve değer | Kural |
| --- | --- | --- |
| Renk rolleri | `action` amber, `self` turkuaz, `hostile` kırmızı, `good` yeşil, `warn` sarı, `info` mavi | `action` ekranın tek birincil hamlesidir. `self` sen, seçimin ve seçtiğin sayılardır. `warn` hâlâ kaçınılabilir bir risktir ve hep ikonla gelir. Paneller lacivert metaldir. |
| Rengin üç kuralı | — | 1) Renk hiç yalnız gelmez; yanında ikon, işaret veya yazı olur. 2) Küçük kırmızı, bakır ve soluk yazı yalnız koyu zemine konur. 3) Resim veya 3D üstündeki okunacak bilgi bir plakada durur. |
| Kaynaklar | kendi renkleri (alaşım bakır) | Bir kaynak hiçbir yerde ikonsuz görünmez. |
| Yazı | tek aile Saira. `--gk-t-tag` 10, `floor` 11, `small` 12, `body` 13, `lead` 14, `title` 17, `head` 22, `number` 16, `hero` 27 px | Karar için okunan her şeyin tabanı 11 px'tir. 10 px yalnız büyük harfli, aralıklı etikettir. Japonca bir piksel yukarıdadır. |
| Boşluk | `--gk-s1`…`s6` = 4 / 7 / 11 / 14 / 18 / 22 px; ekran kenarı `--gk-gutter` 11 px | Her boşluğun bir amacı olur. |
| Şekil | `--gk-r-sm/md/lg` 3 / 4 / 6, kesik köşe `--gk-cut` 8, dokunma `--gk-hit` 44 px | Görünen yüz küçük olabilir; dokunma alanı 44 px'ten küçük olamaz. |
| Hareket | `--gk-press` 80, `--gk-quick` 160, `--gk-settle` 280, panel açılışı `--gk-panel` 160 ms; `--gk-ease`, `--gk-pop` | Basış anlık olur, cevap oturur, açılış çok az taşar. |
| Basılı tutma | `GameHold weight`: `reversible` 0,6 s, `spends` 1 s, `final` 1,5 s | Ağırlık eylemin bedelini taşır: klandan çıkmak bir filo gönderimi gibi hissettirmez. |
| Sayı | `lib/format.ts` `compact` | K/M biçimi (240,1K · 1,4M); ondalık ayracı dile göre değişir. |

## 4. Hangi iş için hangi parça

**Basmak**

| İş | Parça |
| --- | --- |
| Ekranın hamlesi | `GameButton`. Tonlar: `action` tek birincil hamle, `steel` sıradan, `self`, `danger` bir şey harcar veya kaybettirir, `ghost`. Bedel `cost`, bekleme `pending` ile verilir. Kilitli düğme gizlenmez; `disabledReason` nedenini söyler. |
| Kapat, geri, yardım | `RoundButton` (36 px yüz, 44 px hedef) |
| MAX, filtre | `Chip` |
| Geri alınamayan veya harcayan taahhüt | `GameHold` (`weight` ile) |
| Menünün kapısı | `Medallion` |

**Seçmek ve ayarlamak**

| İş | Parça |
| --- | --- |
| Açık / kapalı | `Toggle` |
| Birkaç konumlu şalter | `Lever` |
| Sayı veya adet | `Slider` |
| Bir ayarın birkaç seçeneği | `Choices` |
| Sekmeler | `GameTabs`. Kilitli sekme ne gerektiğini söyler; sekmelerin genişliği eşittir. |
| Uzun listeden seçim | `Picker` |
| Metin girişi | `TextField` |
| Dil seçimi | `LanguagePicker` |
| Başka sayfaya açılan satır | `SettingLink`, `DoorRow` |
| Gemi seçimi | `UnitCard`, `UnitBay` |

**Göstermek**

| İş | Parça |
| --- | --- |
| Tek değer | `StatPlaque` |
| Bedel | `CostLine` (karşılanamayan kalem uyarı renginde ve noktalı alt çizgiyle) |
| İlerleme | `ProgressBar` |
| Harcanan stok | `SpendBar` |
| Taşınan yük | `CargoBar` |
| Benim gücüm ve onunki | `RangeBars`. Kesin kısım dolu, olası kısım çizgili, keşfedilmemiş taraf "?" taşır. Hüküm vermez. |
| Depo | `StoreGauge` |
| Yer | `RoomGauge` |
| Üst kaynak çubuğu | `ResourceHud` |
| Etki | `StatusChip` |
| Zaman | `Timer`, `TimerPlate`, `TimerRow` |
| İş kuyruğu | `QueueSlot`, `SlotRing`, `FreeSlot` |
| Seçilen sayı | `CountBadge` |
| Sınıf karşılaşması | `MultiplierBadge` |
| Savaş sınıfı | `Emblem` |
| Seviye, kilit, durum | `LevelBadge`, `LockBadge`, `Dot` |
| Sıralı liste satırı | `ListRow` |

**Yüzeyler**

| İş | Parça |
| --- | --- |
| Metal plaka, cam yuva, kesik köşeli plaka | `Plate`, `Well`, `CutPlate` |
| Bölüm adı | `SectionTag` |
| Sheet | Davranış için v2 `Sheet` (sürükleme ve kademe), görünüm `SheetFrame`'den gelir |
| Pencere | `Dialog` |
| Risk satırı ve toast | `Banner` |
| Boş durum | `EmptyState` (orada olacak şeyin resmi ve onu getiren adım) |
| Yönlendirme | `CoachMark` |
| Galaksinin altındaki kart | `ContextCard`, katlanmış hâli `ContextStrip` |
| Nadiren okunan veya bir kez ayarlanan | `Fold` |
| Silah akordiyonu | `StrikeFold` |

**Açıklamak:** Paragraf yerine `InfoPeek` kullanılır. Satır olguyu söyler, "?" kuralı yerinde açar. Uzun kural metni `InfoPeek` ya da `Fold` arkasına gider.

**Listeler**

| İş | Parça |
| --- | --- |
| Dışarıdaki şeylerin sayısı ve listesi | `Tally`, `DropPanel`, `DropGroup`, `PickRow` |
| Haberler | `NewsList`, `NewsRow` |
| Menü karoları | `TileGrid`, `MenuTile` |

**Kimlik ve ödül**

| İş | Parça |
| --- | --- |
| Onur rozeti | `HonorBadge` |
| Klan amblemi ve seviyesi | `ClanEmblem`, `ClanLevelBadge` |
| Ödül | `RewardPod`. Ödül açılan bir şeydir. |

**Görsel:** 40 px ve üstündeki boyalı ikon `ArtIcon`'dur. 40 px altındaki işaret `Glyph`'tir; boyalı ikon küçükte çamura döner.

## 5. Yerleşim kuralları

Kaynaklar: owner incelemesi 2026-11-16 (`docs/ui-sadelestirme-plani-2026-11-16.md`), aşama 4.0.1 ve owner'ın "hep kompakt" kararı (2026-09-04).

- **Kompakt:** büyük yazı ve büyük düğme yoktur. Gerekli bilgi kısa ve net verilir; tasarım kendini anlatır.
- **Başlık:** sheet başlığı en fazla 48 px'tir (ikon 32, tek satır başlık, bir satır üst yazı, kapat/geri 40 px).
- **Kartlar:** kart içinde kart yoktur. Resimli kartta resmin %70–80'i görünür.
- **Tekrar yok:** aynı bilgi bir ekranda iki kez gösterilmez.
- **Metin bütçesi:** ekran başına kelime ortancası ≤ 55, uzun blok ≤ 1. Bilineni yazma; kural "?"in arkasında durur (`docs/ux-writing.md`).
- **Ekran boyutu:** önce 350 px telefona göre tasarlanır. Masaüstünde genişlik sınırlanır, gerekirse sütun eklenir; raster görsel büyütülmez.

## 6. Ses ve dokunuş

- Kit parçaları kendi sesini ve titreşimini taşır: `Toggle` tıklar, `Lever` her çentikte ses verir, `GameHold` kendi taahhüt sesini çalar.
- Kendi sesi olan kontrol `OWN_SOUND` işaretini taşır ve genel tık sesi onda çalmaz. Üstüne ikinci bir ses eklenmez.
- Kitte olmayan özel bir kontrolde ses (`lib/sound`, `playSound`) ve titreşim (`lib/haptics`, `haptic`) birlikte kullanılır (`apps/web/CLAUDE.md` §6).

## 7. Kite yeni şey eklerken

- **Ad çakışması:** yeni bir `gk-*` sınıfından önce adı ara: `grep -rnE "\.gk-<ad>([^a-zA-Z_-]|$)" apps/web/src --include='*.css'`. Yüzey önekli ad kullan (`gk-ship…`, `gk-arena…`). `game-ui.css` büyüktür; sonra gelen kural hiçbir test kırılmadan sessizce kazanır.
- **Parçayla gelenler:** `index.ts` dışa açımı, galeri görünümü ve `test/game-ui/` altında test.
- **Testlerin koruduğu kurallar:**
  - `tokens.test.ts`: ham renk yalnız `tokens.css`'te, tek yazı ailesi, lacivert panel, panel 160 ms, kenar 11 px.
  - `type-scale.test.ts`: her yazı boyutu ölçekten gelir; satır içi boyut yoktur.
  - `kit-sounds.test.tsx` ve `own-sound.test.tsx`: parça sesleri.
  - `no-glow-sprite.test.ts`: yumuşak parlama yasağı.
- **Görsel doğrulama:** 350 px'te `node tools/visual.mjs` ve galeri.

## 8. İlgili belgeler

- `docs/ui-v2/gozlemevi.md`: görsel dil, renklerin anlamı, her ekranın altı kuralı. Kit bu dili çizer. Belgedeki bileşen şartnamesi kitten önce yazıldı; aynı parça için kitteki hâl geçerlidir (Gözlemevi'nin kendi notu: "ekranlar kite geçince bu madde değişir").
- `docs/ui-standart-karar-paketleri-2026-11-12.md`: standartların gerekçesi. Sayılar 2026-11-17'de ×0,9 küçüldü; güncel değerler `tokens.css`'tedir.
- `docs/ui-ux-iyilestirme-plani-2026-11-11.md` aşama 4: ekranların kite geçişi. 4.0.1 tablosundaki yazı ölçeği ve kenar değerleri eskidir.
- `docs/ui-kit-varlik-secimi-2026-11-12.md`: ikon, glif, rütbe ve VFX hangi kaynaktan gelir.
- `docs/ui-sadelestirme-plani-2026-11-16.md`: owner incelemesi ve sadeleştirme.
- `docs/ui-envanter-2026-11-13.md`: ekran envanteri.
- `docs/ux-writing.md`: metin kuralları.
- Karar görselleri `out/ui-kit` ve `out/ui-envanter` altındadır (ana checkout, git dışı).
