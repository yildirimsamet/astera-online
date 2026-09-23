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
- Sunucu testleri paylaşılan `astera_test` veritabanını kullanır (localhost:5433); yalnız sunucuya dokunulunca ve seri çalıştır.
- Her yeni metin 5 dilde (tr, en, de, fr, es); testler İngilizce çalışır.
- Görsel doğrulama (`node tools/visual.mjs`) yalnız sahip isterse ya da faz sonunda tek oturumda.
- Boyutlar sıkı: gövde 12 px (sahibin "büyük yazı yok" talimatı).

## Durum
| Faz | İçerik | Durum |
|---|---|---|
| Adım 0 | Worktree, başlangıç ölçümü, şartname kopyası + fleet escape güncellemesi, gezegen modelleri | Tamam |
| F0 | H1 (`lib/directives.ts` kalkanlıyken tehdit), H2 (`shell/StatusBar.tsx` depo dolu kırmızısı) — `ui-v2`'ye commit, sahip master'a cherry-pick eder | Tamam (074f338, a7b8348) |
| F1 | v2 token, yazı tipi, ikon, kit (B5–B9, B12, v2 Sheet, kaynak ölçeri) | Tamam |
| F2 | v2 HUD (B1–B4), kabuk, IA | Sırada |
| F3 | E2 Dosya, E3/B14 Fırlatma, E4 Filo, S1, S2 | Bekliyor |
| F4 | E6 Rapor, S4 | Bekliyor |
| F5 | E5 Üs + Araştırma (K6, K9) | Bekliyor |
| F6 | E7 İstihbarat, E9 Klan, Komutan sayfası | Bekliyor |
| F7 | E10 Sen yokken + S3 | Bekliyor |
| F8 | E11 Masaüstü | Bekliyor |
| F9 | 3D gezegenler (16 `.glb`, Draco → meshopt, LOD) | Bekliyor |
| F10 | Temizlik | Bekliyor |

## Sıradaki iş
**F1 · v2 temeli.** Sıra: (1) token'lar, (2) yazı tipi, (3) ikonlar, (4) kit bileşenleri.
- ~~F1.1 token'lar~~ bitti (bkz. Biten işler).
- ~~F1.2 yazı tipleri~~ bitti.
- ~~F1.3 ikonlar~~ bitti.
- **F1.4 kit (sıradaki), bu sırayla:** ~~B9~~, ~~B8~~, ~~B7~~, ~~B12 halkaları~~, ~~kaynak ölçeri~~,
  ~~B5~~, ~~B6~~, ~~v2 Sheet~~, **sonra B12'nin kuyruk sayfası** (iptal → `Confirm`; `ui/QueueStrip.tsx`
  içindeki `CancelConfirm` dışa aktarılıp yeniden kullanılır — "iptal Confirm açar" testi orada).

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

## Şartnameden sapmalar ve eklemeler
- **Fleet escape (a64b230, şartnameden sonra geldi):** güç cetvelinde üçüncü "kaçar" çizgisi
  (`escapeLine`), `escapeVerdict` hükmü, Savunma sekmesinde `EscapeReadout`, raporda kaçış metinleri.
- **Saldırı geri çağırma (S2):** kodda yok (`routes/planet.ts` "IRREVERSIBLE", `session.ts` `recallable`
  yalnız transfer). K8 kuralı: yoldayken bir kez, dönüş uçulan süre, yakıt iadesi yok, iniş sığar,
  son dakika kilidi yok, tekrar saldırı sınırına sayılmaz.
- **Gezegen modelleri:** Draco sıkıştırmalı, ~10.400 üçgen, 3 × 1024 WebP. Yükleyici meshopt ve Draco kapalı;
  modeller `tools/models.mjs` ile meshopt'a çevrilecek, düşük LOD üretilecek.
- **K3:** yazı tipi değişir, boyutlar değişmez (gövde 12 px).

## Açık sorunlar
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
- server: ölçülmedi (paylaşılan veritabanı; F3'te sunucuya dokunmadan önce ölçülecek).
