# Gözlemevi arayüzü — ilerleme defteri

**Bağlam sıkıştırıldıysa ya da yeni oturumsan önce bunu oku.** Okuma sırası:
1. Bu dosya (özellikle "Sıradaki iş").
2. `docs/ui-v2/gozlemevi.md` (şartname, ~1.000 satır) içinde sıradaki işin kimliğiyle geçen bölüm;
   tamamını okuma: `grep -n "B9 ·\|E3 ·\|^| K8" docs/ui-v2/gozlemevi.md` ile bul, o aralığı oku.
3. İlgili kod. Şartname ile kod çelişirse **kod kazanır**; çelişki buraya ve şartnameye yazılır.

- **Şartname:** `docs/ui-v2/gozlemevi.md` — tek kaynak, doğrudan düzenlenir (sahip kararı 2026-09-23: HTML ve
  artifact bırakıldı). İkonlar `docs/ui-v2/icons.svg`; mockup HTML'i yalnız geçmişte (commit 08bf3f6,
  `docs/ui-v2/gozlemevi.html`).
- Onaylı plan: `~/.claude/plans/bu-g-revi-sen-yapacaks-n-fluttering-sketch.md`.
- Dal / worktree: `ui-v2` @ `.claude/worktrees/ui-v2` (ana ağaca dokunma, `git stash` yok). Master her faz başında birleştirilir.
- Yayın: bayrak yok; önümüzdeki sezonla. K1–K11 sahip tarafından 2026-09-23'te tamamen onaylandı.

## Çalışma kuralları (CLAUDE.md, zorunlu)
- TDD: test → FAIL → kod → PASS → review. Yalnız stil/CSS istisna.
- `pnpm verify` sıfır tip ve lint hatası; kırmızı test seti aşağıdaki listeden büyümez.
- Sunucu testleri bu worktree'de özel `astera_uiv2_test` veritabanında koşar (adı `_test` ile bitmeli;
  `DATABASE_URL=postgres://astera:astera@localhost:5433/astera_uiv2_test npx vitest run <dosyalar>`, apps/server),
  paylaşılan `astera_test`'e dokunma. **Sahip talimatı (2026-09-23):** tam sunucu paketi ~40 dk; iş sırasında yalnız
  dokunulan kodun test dosyaları, tam paket yalnız teslimde bir kez. Web paketi hızlı, commit öncesi koşar.
- Her yeni metin 5 dilde (tr, en, de, fr, es); testler İngilizce çalışır.
- **Görmeden tasarım yok (sahip talimatı 2026-09-23: "Gözü kapalı yapmamalısın").** Her v2 bileşeni
  `apps/web/v2-gallery.html` galerisine (`src/v2/gallery/Gallery.tsx`, örnek veriyle) eklenir ve commit'ten önce
  fotoğraflanıp okunur: sunucu `pnpm --filter @astera/web exec vite --port 5199 --strictPort --host 127.0.0.1`,
  kamera `node tools/v2-gallery.mjs <çıktı> en tr de` (350 px DPR 2 bölüm bölüm + 1280 px + sayfa görünümleri;
  hesap açmaz, kayıt limitine takılmaz). Uzun dillerde (tr, de, fr) taşma bakılır. Gerçek oyun kabuğa bağlandıktan
  sonra `node tools/visual.mjs` ile (kayıt limiti: ~5 koşu / 30 dk).
- **Gerçek oyunda kamera (F2'den beri):** özel veritabanı `astera_ui_v2` (@5433; `astera` ve test veritabanlarına
  dokunma), API `DATABASE_URL=postgres://astera:astera@localhost:5433/astera_ui_v2 PORT=3199 npx tsx src/index.ts`
  (apps/server), web `ASTERA_API=http://localhost:3199 npx vite --port 5199 --strictPort --host 127.0.0.1` (apps/web).
  `COMMANDER=shell83807481 node tools/v2-shell.mjs <çıktı> [en|tr]` kayıt açmadan girer (şifre `correct-horse-battery`);
  diğer diller için girişten sonra `localStorage['astera.language']` değiştirilip sayfa yenilenir. Saatlerce
  sürecek durumlar bu veritabanında sahnelenir (ör. `players.newcomer_shield_until`, `planets.buffer_*`).
  Akademi: `WEB=http://127.0.0.1:5199 node tools/visual.mjs <çıktı> --academy` (39 ders baştan sona).
- Boyutlar sıkı: gövde 12 px (sahibin "büyük yazı yok" talimatı).

## Durum
| Faz | İçerik | Durum |
|---|---|---|
| Adım 0 | Worktree, başlangıç ölçümü, şartname kopyası + fleet escape güncellemesi, gezegen modelleri | Tamam |
| F0 | H1 (`lib/directives.ts` kalkanlıyken tehdit), H2 (`shell/StatusBar.tsx` depo dolu kırmızısı) — `ui-v2`'ye commit, sahip master'a cherry-pick eder | Tamam (074f338, a7b8348) |
| F1 | v2 token, yazı tipi, ikon, kit (B5–B9, B12, v2 Sheet, kaynak ölçeri) | Tamam |
| F2 | v2 HUD (B1–B4), kabuk, IA | Tamam |
| F3 | E2 Dosya, E3/B14 Fırlatma, E4 Filo, S1, S2 | Sırada |
| F4 | E6 Rapor, S4 | Bekliyor |
| F5 | E5 Üs + Araştırma (K6, K9) | Bekliyor |
| F6 | E7 İstihbarat, E9 Klan, Komutan sayfası | Bekliyor |
| F7 | E10 Sen yokken + S3 | Bekliyor |
| F8 | E11 Masaüstü | Bekliyor |
| F9 | 3D gezegenler (16 `.glb`, Draco → meshopt, LOD) | Bekliyor |
| F10 | Temizlik | Bekliyor |

## Sıradaki iş
**F3 · Hedef dosyası, Fırlatma, Filo; S1, S2.** Şartname: B10, B11, B14, E2, E3, E4, K8 ve sunucu tablosu S1/S2
(`grep -n "^#### B10 ·\|^#### B11 ·\|^#### B14 ·\|^#### E2 ·\|^#### E3 ·\|^#### E4 ·\|^| K8\|^| S1\|^| S2" docs/ui-v2/gozlemevi.md`).
Kod: `screens/LaunchSheet.tsx` (bugünkü fırlatma, ~1.300 satır; mantığı yeniden kullanılır), `shell/PendingStrip.tsx`
(`FlightList`, `useAirborne`; F2'de Filo sayfası bunu çiziyor), `v2/hud/FleetSheet.tsx` (ara sayfa), galaksinin odak
kartları (`screens/GalaxyView.tsx` odak rayı), sunucu `services/movement.ts` (`recallTransfer`), `services/session.ts`
(`recallable`, pending projeksiyonu), `routes/planet.ts` (saldırı rotası "IRREVERSIBLE"), `api/client.ts`.
Master F3 başında kontrol edildi: branch noktasından (a64b230) beri değişmemiş.
- ~~F3.0~~ Taban çizgisi yeniden ölçülmedi (sahip: "bilinen hatalar", yeniden ölçme); ilgili dosyalarda görülen
  kırmızılar HEAD'de de kırmızı olduğu doğrulanarak aşağıya yazıldı.
- ~~F3.1 S1~~ `1b5bd95`: kendi uçuşlarında `pace` (`missions.pace`); dönüş bacağı 1; gelen saldırıda yok. Web şeması
  okur (0 < pace ≤ 1).
- ~~F3.2 S2 (K8)~~ `c29a1c2`: `recallFlight` (eski `recallTransfer`) saldırıyı da çevirir; geri çağrılan baskın dönüş
  bacağı gibi iner (rapor, ganimet yok), `attack_commitments` satırı silinir; `isHostileMission` çevrilmiş baskını
  düşmanca saymaz (gelen uyarı, radar bildirimi, trafik inbound); RAID ödülü, toparlanma kalkanı, klan üyelik
  kontrolü, Teleskop "dışarıda" saati uyar. Fırlatma sayfası dünya baskınında "Launch" + kural notu, korsan baskınında
  "no recall", Akademi'de not yok; dönüş bildirimi "called back before it struck". Gerçek oyunda görüldü (onay, Filo
  sayfasında düğme, çevrildikten sonra "home from …"). Yeni sunucu testi `attack-recall.test.ts` (16).
- ~~F3.3 E4 Filo sayfası~~ `bb725cf`: `v2/hud/FleetPage.tsx` (sunum) + `v2/shell/FleetHost.tsx` (veri) + `lib/fleetPage.ts`
  (`legProgress`, `recallPreview`, `paceShown`, `garrisonOf`, `roomOf`). Başlıkta aktif dünyanın uçuş yuvası ve Hangar'ı;
  Havada = `useAirborne` satırları (geri sayım, bacak dolgusu — dönüşte sağdan —, hız, varış saati, geri çağırma
  sütununda "back in X"); Evde = dünya başına garnizon (sınıf şekilli çipler, dışarıdaki sayısı); Hangar = dünya başına
  Hangar ve zemin, doluysa sarı, üstte tek cümlelik kural. `FleetSheet` ve testi silindi. Galeride `?view=fleet`,
  `fleet-home`, `fleet-room`. Gerçek oyunda baskın + geri çağırma ile görüldü.
- **F3.4 B14/E3 fırlatma bileşeni:** tek anatomi; önce saldırı, korsan (hız yok), sonda; sonra transfer, yerleşim,
  ticaret, konvoy baskını, klan dalgası (teklif otomatik), Ölüm Yıldızı. B10 hız seçici, bilgi ızgarası, uyarı satırı
  ("Başkent X süre zayıf kalır" + geri çağırma notu), B9 basılı tut. Akademi dersleri (`data-academy-launch`, Max
  eli) kırılmamalı: `tools/visual.mjs --academy` ile doğrulanır.
- **F3.5 E2 hedef dosyası:** odak kartı → dosya (v2 Sheet peek/half/full); sıra, yasaklar ve ret nedenleri şartnamedeki gibi.
- **F3.6** faz sonu review + gerçek oyunda görsel tur (350 ve 1280 px, 5 dil).

## Biten işler
- Adım 0 (2026-09-23): worktree `ui-v2` @ a64b230; şartname kopyası; fleet escape (a64b230) şartnameye
  işlendi (kural 16/16b, B5, B15, E5); karar defteri "onaylandı"; 16 gezegen `.glb` dala eklendi.
  Sonra sahip kararıyla şartname yalnız Markdown'a geçti; HTML, betikler ve artifact bırakıldı; ikonlar `icons.svg`'ye,
  token listesi şartnameye taşındı.
- F0 (2026-09-23): **H1** `074f338` — kalkan varken "yer savunması yok", "açıktaki stok" ve "tarama" yönergeleri
  `growth`; yer savunması kartı kalkanın bitişini söyler; `inbound` tehdit kalır (`Situation.shieldUntil/now`,
  `SituationGuide` saati geçirir, `GalaxyView` `season.data.shieldUntil` verir; 5 dilde `undefendedShieldedTitle`).
  **H2** `a7b8348` — "Depo dolu" etiketi `text-threat` yerine `text-alloy`. İkisi de canlı sezon için master'a
  cherry-pick edilebilir (sahibe hash'ler verildi). Web: bilinen 14 kırmızı aynen, +7 yeni test yeşil.
- F1.1 (2026-09-23): `apps/web/src/v2/tokens.css` — `@theme` içinde `v2-` önekli renkler (şartname değerleri),
  5 rakip slotu, `font-v2-ui` / `font-v2-mono`, `ease-v2`; `styles.css` içe aktarıyor. Kullanım: Tailwind
  sınıfları (`bg-v2-panel`, `text-v2-ink-2`, `bg-v2-self/15`); CSS'te `var(--color-v2-*)` + `color-mix()`.
  Kanal (`--ch-*`) deseni v2'de yok: opaklık Tailwind değiştiricisiyle. Koruyucu: `test/v2/tokens.test.ts`
  (değerler, çakışmasızlık, kontrast, `src/v2` altında ham renk yasağı). `surface-vocabulary.test.ts` artık
  v2 token'larını da okuyor. Tailwind kullanılmayan tema değişkenlerini derlemeye koymuyor; bileşenler
  kullanınca çıkar (F1.4'te kontrol et).
- F1.2 (2026-09-23): `@fontsource-variable/archivo` eklendi (`standard.css`: wght 100–900 + wdth 62–125,
  latin-ext dahil); IBM Plex Mono 400/500 artık gerçekten içe aktarılıyor (bugünkü tema adı kullanıyordu ama
  hiç yüklemiyordu → sistem yazı tipine düşüyordu). Genişlik: Tailwind `font-stretch-75%` / `font-stretch-125%`.
  Koruyucu: `test/v2/fonts.test.ts` (içe aktarım + aile adı paketin tanımladığıyla aynı).
- F1.3 (2026-09-23): `apps/web/src/v2/icons.tsx` — tek `Icon` bileşeni, `id` ile seçilir (`i-*` çizgi 1.75,
  `c-*` dolgu amblem, `m-*`/`sel` işaret 1.6); `isIconId` tip koruyucusu. 40 şekil `docs/ui-v2/icons.svg` ile
  birebir (test şekil şekil karşılaştırıyor: `test/v2/icons.test.tsx`). Başlıksız ikon `aria-hidden`.
- F1.4 · B9 (2026-09-23): `apps/web/src/v2/kit/HoldButton.tsx` — `HOLD_MS = 600`; basma butonun kendi
  `pointerdown`'ında başlar (orta/sağ tuş hariç; jsdom'da `button` tanımsız geldiği için `=== 0` değil),
  bırakınca/dışarı kayınca/blur'da iptal; Space basılı tutulur; Enter satır içi iki adımlı onay (4 sn);
  onay tıklaması `useOwnPress` ile; `disabledReason` varsa etiket yerine sebep, silahsız. `tone`: `self` | `hostile`.
  Metinler yeni ad alanı `hold` (`locales/*/v2.ts`, dizinlere kayıtlı) — v2 kit metinleri bu dosyalara eklenir.
  Tailwind v2 sınıflarını derliyor (build'de `--color-v2-self` ve `bg-v2-self/10` görüldü).
- F1.4 · B8 `d6c7894`: `apps/web/src/v2/kit/ClassEmblem.tsx` — SKIRMISHER `c-sk` ▲, BULWARK `c-bw` ⬢, LANCE `c-ln` ◆,
  SUPPORT `c-sp` ●; `classEmblemId(cls)`; başlık `combatClassLabel` (i18n/names.ts); `decorative` yazılı adın
  yanında sessiz. Renk yok: rengi kimin gemisi olduğu verir.
- F1.4 · B7: `apps/web/src/lib/clarity.ts` — `CLARITY_BARS` (FULL 5 … BLIND 1), `CLARITY_WORD` (i18n anahtarları),
  `ageTier(dk)` → `fresh` <60 · `aging` <360 · `stale` <1440 · `old` (K11). Eski `ui/Clarity.tsx` artık bunları içe
  aktarıyor (F10'da eski silinince v2 kırılmasın). `apps/web/src/v2/kit/Freshness.tsx` — `ClarityMark` (5 çubuk +
  kelime, tek `role="img"`), `AgeStamp` (`staleness()`, `data-age`), `AgedThumb` (yuvarlak resim; netlik →
  `brightness-*`, yaş → `.v2-grain` + `old`'da soluk; BLIND → kesikli çerçeve + "?", resim yok, `alt` etiket olur).
  Gren `src/v2/surfaces.css` (styles.css içe aktarıyor; SVG gürültü, `data-age` ile şiddet). **F10 notu:** yanan
  çubuklar eski `bg-clarity-*` token'larını kullanıyor (parlaklık rampası); F10 bunları silmemeli, v2'ye taşımalı.
- F1.4 · B12 halkaları: `lib/orders.ts` `orderProgress(order, now)` (yalnız baş koşar; başlamamış/zamansız 0, biten 1).
  `apps/web/src/v2/kit/QueueLane.tsx` — `BUILD.queueDepth` (3) hücre: sipariş = konik halka (`data-ring`,
  `data-progress`) + içinde render + ad + `×N` (yalnız >1) + bitişe kalan (`countdown`); zamansız sipariş
  `planet.queue.committing` / `staged`; boş yer "+ Boş hat" (`lane.free`, 5 dil). Hücre `onOpen` çağırır; iptal
  işareti yok (yarısı yanar, kuyruk sayfasında). Not: sunucu bina/alet/uydu siparişinde `count: 1` yazar; `count`
  yalnız gövdede anlamlı (`lib/orders.ts` yorumu "seviye taşır" diyor, eskimiş).
- F1.4 · kaynak ölçeri (B1): `lib/format.ts` `stock(v)` — 99.999'a kadar `full`, üstü `compact` (şartname; eski
  `Stock` hep `full` yazıyordu, 3 ölçer 350 px'e sığsın diye). `apps/web/src/v2/kit/ResourceMeter.tsx` — 16 px ikon +
  değer + 2 px çizgi (kaynak rengi, `data-fill`), dolu/taşmışta ucunda `bg-v2-warn` çentik (`data-full`), kırmızı yok;
  `onOpen` varsa buton, yoksa `role="img"`; ad `meter.reading` / `meter.full` (5 dil), kaynak adı `statusBar.*Label`.
  Vault güvenli dilimi (`vaultProtected`) üst çubukta yok; şartnameye göre E5 üretim satırında.
- F1.4 · B5 güç cetveli: `lib/ruler.ts` — `ForceReading`/`ForceLines` tipleri buraya taşındı (eski `ForceCompare`
  yeniden dışa aktarıyor, `LaunchSheet` değişmedi) ve `rulerTop(...)` = en büyük × 1,15, iki anlamlı basamağa yukarı.
  `apps/web/src/v2/kit/ForceRuler.tsx` — eski `ForceCompare` ile aynı proplar (+ `onProbe`): kanat şeridi (`bg-v2-self`),
  savunma şeridi (tabana kadar dolu `bg-v2-ink-3`, bant `.v2-hatch`), şeritte `clears` (turkuaz kenar) / `breaks`
  (açık kenar) aralık işaretleri ve `escape-line` (sarı kesikli); açıklama listesi mevcut `counter.escapeAt`,
  `linesClears`, `linesBreaks`; hüküm `counter.escape{Run,Stand,Unsure}`; kayıp, notlar, "Bu ne?" kuralı (+ kaçış
  kuralı). Bakılmamışsa şerit yok: `ruler.unknown` + `ruler.probe` butonu (5 dil). `.v2-hatch` `surfaces.css`'te.
  **Sapma (şartnameye uygun):** eski bileşen, okuma varken çizgileri eksene katmayıp kırpıyordu; şartname
  `breaks` üstünü eksene katıyor, v2 öyle yapıyor. `children` B6 satırı için.
- F1.4 · B6 karşı sınıf satırı: `lib/matchup.ts` `matchupHint(m)` → BRING cls / SINGLE / PROBE / null (LaunchSheet'teki
  mantık buraya taşındı, `LaunchSheet` artık bunu çağırıyor). `apps/web/src/v2/kit/MatchupLine.tsx` — props
  `wing`, `reading` (`ClassReading`); `matchupsAgainst` içeride. Satır 1 (`data-matchup-wall`): MAJORITY "◆ Mostly
  Lance — more than half", SPLIT "Read split · ◆ Lance 60% · …" (sıfır pay yok), MIXED "Mixed defence…"; sonra ipucu
  (Bring = `text-v2-self` amblemli, Single/Probe = `text-v2-warn`), sonra kalan okunmadı. UNREAD: `counter.noteShapeUnread`
  · `dossier.shapeUnreadNote`. NONE / okuma yok: hiçbir şey. Satır 2 (`data-matchup-wing`): kanadın her sınıfı için
  `matchupExposure`. Yeni metin yok, hepsi mevcut anahtarlar.
- F1.4 · v2 Sheet: `lib/sheet.ts` — `Detent` = `peek` | `half` | `full`, `nextDetent(detents, cur, 'up'|'down')` (yukarı
  tepede durur, en alttan aşağı `null` = kapan), `dragStep(dy)` (±40 px eşik). `apps/web/src/v2/kit/Sheet.tsx` —
  `detents` (varsayılan half+full; bağlam kartı `['peek','half','full']`), yükseklik peek `max-h-[140px]` / half
  `55dvh` / full `92dvh`; tutamaç butonu (`handle.expand` / tepede `handle.collapse`, 5 dil) dokununca bir basamak;
  baş bölgesinden sürükleme (bırakma `window`'da dinlenir, sürüklemeden sonraki tıklama yutulur); peek'te perde yok
  ve `aria-modal=false` (galaksi canlı), half/full'de `data-scrim` (`useOwnPress`); Escape, X, `onBack`; `children`
  fonksiyon olabilir (detent'i alır: kart → dosya). `bottom: var(--v2-dock-h, 0px)` — F2'de kabuk dock yüksekliğini
  bu değişkene yazacak. Masaüstünde `max-w-xl` ortalı. Build'de yeni sınıfların hepsi derlendi (kontrol edildi).
- F1.4 · B12 kuyruk sayfası: `apps/web/src/v2/kit/QueueSheet.tsx` — v2 Sheet içinde iki hat (İnşaat, Tersane),
  her siparişte halka + ad + kalan + "İptal"; hat başında "ends HH:MM"; boş hat `planet.queue.idle`. İptal →
  `CancelConfirm` (artık `ui/QueueStrip.tsx`'ten dışa aktarılıyor; eski `Confirm`/eski `Sheet` üstünde — **F10:**
  v2 Confirm gerekince buradan taşınır). Confirm açıkken Escape yalnız Confirm'ü kapatır. Zamansız siparişte iptal
  yok; bir iptal uçuştayken hepsi kilitli. `QueueLane.tsx` artık `OrderRing`, `OrderName`, `orderLeft` dışa aktarıyor.
- **F1 bitti (2026-09-23).** Workspace `typecheck` + `lint` temiz; web: bilinen 14 kırmızı aynen, v2 testleri yeşil.
- **F1 faz sonu review'u (2026-09-23)** — eski koda dokunulan yerler temiz (`directives()`'in tek çağıranı
  `SituationGuide`; `LaunchSheet` ipucu birebir; Plex Mono eski arayüzde yalnız duyuru kod bloklarında). Bulunan ve
  testle düzeltilen: (1) B6 — eşit en büyük paylı SHARES okuması "karışık" diye bölüşümü düşürüyordu (artık tür
  karar veriyor); (2) Sheet — başlıktan sürüklemeden sonra tutamaç dokunuşu yutuluyordu (her hareket temiz başlar)
  ve klavye Enter'ı da yutulabiliyordu (`detail 0` asla yutulmaz); (3) `AgeStamp` dil değişimine abone değildi;
  (4) kuyruk sayfası uçuştaki iptalin satırında "Cancelling…" yazıyor.

- **F2 · v2 HUD, kabuk, bilgi mimarisi (2026-09-23).** Saf mantık `98a09fa` (`lib/{nowLine,collect,dock,contextSlot,
  bell,flights,shellRoute,useRequest}.ts`); sunum `73b9d6c`, `8012378`, `1efb94d`, `bc84a4c`, `7c23d3d` (`v2/hud/{Dock,NowLine,
  TopBar,CollectBubble,BellSheet,FleetSheet,ViewSheet,ContextSlot}.tsx`, `v2/kit/Segmented.tsx`, galeri); kabuk `4383861`,
  `2bc2867`, `a94ee0d` (`v2/shell/{GameShell,HudTop,HudDock,BellHost,CollectHost}.tsx`; `App` bunu çiziyor); bağlam yuvası
  ve toplama balonu `d4f45fd`, `ee732ac`. GalaxyView'den `DiscControls`, `SensorToggles`, `DiscReadout`, sohbet/kronik
  başlatıcıları, `SituationGuide`, `DirectiveCard`, `ActiveGalaxyEvent` testleriyle silindi; davranışları v2
  testlerinde. Toplama balonu drei `<Html>` içinde değil: sahne bir çapa öğesi verir, galaksi `createPortal` ile
  çizer (`<Html>` kendi React köküdür, sağlayıcıları kaybeder).
- **F2.5–F2.6 düzeltmeleri:** Akademi Teleskop dersi Görünüm çipinden ulaşılır `a227cc0`; dock'ta Galaksi'ye tekrar
  basmak disk Home'u gibi (odağı temizler, aktif dünyayı odaklar, bir dokunuş yönetimi açar; D163) `2480843`; Akademi
  baskın dersi "iki Dart" diyordu, ders ve Max dört gönderiyor — metin sayı söylemiyor, `tools/academy-visual.mjs` Max'e
  basıyor `b4f5ea8` (**canlı sezon için master'a cherry-pick adayı**); `tools/visual.mjs` dock ve yuvaya göre
  `a1a561b`, `ec91890`. **F2.6 kararı:** Akademi kendi kabuğunda kalır (şartname: "Onboarding bu işin kapsamı dışında;
  yalnız token'ları alır", E1 "Lesson modu: bugünkü kısıtlar korunur"); `Rehearsal.tsx` fiilen ölü → F10.
- **F2 faz sonu review'u (2026-09-23)** `b2b3f7a`, `d776697`, `ce77854`, `660d1cb` — bulunan ve testle düzeltilen:
  (1) bağlam yuvası kapatılan kartları kendi tutuyordu ama her sayfa açılışında sökülüyor → Üs'e gidip gelince hepsi
  geri geliyordu; kayıt artık GalaxyView'de; (2) olay kartı olay kümesiyle hatırlanıyordu → biri bitince kapatılmış
  diğeri geri geliyordu; artık olay başına; (3) Now hattının zamanlayıcı sayfası kendi durumuydu, sayfalarla aynı
  katmanda: dock'a basınca Üs üstüne açılıyor, Üs kapanınca altta kalan sayfa beliriyordu; kabuk tutuyor, her
  gezintide kapatıyor; (4) üst çubuk `h-12` + çentik dolgusu çentikli telefonda satırı ~1 px bırakıyordu
  (`viewport-fit=cover`); (5) Almanca "Galaxy-Ereignis", "Galaxy Chronicle" (Sie ile) ve de/es sayım ayırıcılarında
  eksik boşluk ("134 Welten· 1 Pirat"). Gerçek oyunda 350 px'te 5 dil ve 1280 px görüldü. Tam web paketi: bilinen 14
  kırmızı aynen.

## Şartnameden sapmalar ve eklemeler
- **Fleet escape (a64b230, şartnameden sonra geldi):** güç cetvelinde üçüncü "kaçar" çizgisi
  (`escapeLine`), `escapeVerdict` hükmü, Savunma sekmesinde `EscapeReadout`, raporda kaçış metinleri.
- **Saldırı geri çağırma (S2):** kodda yok (`routes/planet.ts` "IRREVERSIBLE", `session.ts` `recallable`
  yalnız transfer). K8 kuralı: yoldayken bir kez, dönüş uçulan süre, yakıt iadesi yok, iniş sığar,
  son dakika kilidi yok, tekrar saldırı sınırına sayılmaz.
- **Gezegen modelleri:** Draco sıkıştırmalı, ~10.400 üçgen, 3 × 1024 WebP. Yükleyici meshopt ve Draco kapalı;
  modeller `tools/models.mjs` ile meshopt'a çevrilecek, düşük LOD üretilecek.
- **K3:** yazı tipi değişir, boyutlar değişmez (gövde 12 px).

## F10'a devredilenler (temizlikte silinmemeli / taşınmalı)
- v2'nin kullandığı eski ad alanlarındaki metin anahtarları: `statusBar.{alloy,crystal,deuterium}Label`,
  `planet.queue.*`, `counter.*` (compare/lines/escape/matchup/loss), `dossier.shapeUnreadNote`, `clarity.*`,
  `sheet.back/close`, `units.*`. Eski bileşen silinince anahtar kalır (ya da v2 ad alanına taşınır).
- `bg-clarity-*` token'ları (`ClarityMark` parlaklık rampası).
- `CancelConfirm` + eski `Confirm`/`Sheet` (kuyruk sayfası iptali bunlarla açılıyor) → v2 Confirm'e taşınır.
- `onboarding/Rehearsal.tsx` fiilen ölü (yalnız `onboarding-skip` testi çiziyor) → testiyle silinir.
- `GalaxyView` `goHome` (Akademi'nin uçuşu, D56) ve `homeRequest` (dock, D163) ikisi de yaşıyor; Akademi v2'ye geçerse biri kalkar.

## Açık sorunlar
- **Akademi eski HUD'u öğretiyor** (StatusBar, PendingStrip); mezun olan oyuncu galakside v2'yi görüyor. Şartname
  gereği kapsam dışı; sahibe soruldu mu: hayır — F10 öncesi sahibe sorulacak.
- **Masaüstü (1280):** üst çubuk ölçerleri, Now hattı ve dock tüm genişliğe yayılıyor (ölçer ~390 px, Now hattının
  sayacı en sağda) → F8 (E11). Sayfalar zaten `max-w-xl` ortalı.
- GalaxyView'in kendi sayfaları (Görünüm, Dünyalar, odak rayı) dock'tan açılan bir sayfanın altında kalır, o kapanınca
  geri görünür (eski düzen, bilerek korundu). Kabuğun kendi sayfaları (zil, Filo, Now) her gezintide kapanır.
- Eski `LaunchSheet`: yapışkan "Sending / Standing there" kutusu 350 px'te ilk gemi satırının üstünü örtüyor → F3 (E3).
- Üs: "Build defence" Savunma sekmesini açıyor ama içerik ekranın altında (depo ve kuyruklar önce) → F5.
- `tools/visual.mjs`: hibe harcama döngüsünün `dismiss()`'i Üs sayfasını da kapatıyor, "affordable in" sekme turu hiçbir
  şey ölçmüyor (önceden var) → F5'te Üs ile.
- `clanWar.noTarget` 5 dilde var olmayan "Galaxy Focus" denetimini anıyor → F6.
- de/es/fr `notifications.fleetHome*` çevirileri kötü ("Flottenheimat", "Accueil de la flotte", "Inicio de la flota")
  — önceden var; bildirimler F7'de (E10) ele alınırken düzeltilmeli.
- Akademi turu (`tools/visual.mjs --academy`) S2 sonrası yeniden koşulmadı; araç Türkçe düğmeyi artık `^Gönder` ile
  arıyor. F3.4'te fırlatma bileşeniyle birlikte koşulacak.
- **İki v2 Sheet üst üste açılırsa Escape ikisini birden kapatır** (her biri `window`'u dinliyor). F2'de zil sayfası
  ile bağlam kartı üst üste gelebilirse en üstteki kapanacak şekilde çöz.
- `QueueLane` hücresi 350 px'te ~55 px metin alanı bırakıyor; uzun İngilizce/Almanca adlar kesilir (render yanında
  durduğu için kabul). F5'te görsel kontrol.
- **Ölü sınıflar (başlangıçtan, sahibin son işlerinden):** `ui/PaceRow.tsx` `bg-accent/20`, `text-bright`;
  `screens/PlanetScreen.tsx` `bg-cyan-400/10`, `border-cyan-400/40`, `text-cyan-100` — temada yoklar, hiçbir şey
  çizmiyorlar (`surface-vocabulary.test.ts` kırmızısının sebebi). PaceRow B10 ile, PlanetScreen F5 ile değişecek;
  canlı sezonda düzeltilmesi istenirse sahibe söylendi.

## Bilinen kırmızı testler (2026-09-23 @ a64b230, worktree)
typecheck 0 hata · lint 0 hata.
- rules (4): `academy.test.ts` "makes the Academy exit whole…"; `economy-profile.test.ts` "links the other purchases…";
  `intergalactic-convoy.test.ts` "uses combat-only firepower…"; `transport-ladder.test.ts` "carries more than it cost…".
- sim (1): `season.test.ts` "TAX holds its band".
- web (14): `api-bodies.test.ts` disbandClan; `build-sheet.test.tsx` strategic hardware ×4; `chronicle-screen.test.tsx`
  capital strike; `locked-rows.test.tsx` research gate; `predict.test.ts` ×2; `recovery-boost.test.tsx` ×2;
  `research-gains.test.ts` ×2; `surface-vocabulary.test.ts` "names no colour, size or radius the theme does not publish".
- server (tam paket ölçülmedi; ilgili dosyalarda görülen, HEAD'de de kırmızı): `contract.test.ts` ×4 ("GET /api/planet
  parses" hangar/ground şekli; devre dışı Ölüm Yıldızı/önleyici rotaları 404 yerine 200); `intel-states.test.ts` ×3
  (klan sensör küresi, teleskop erişimi).
