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
| F1 | v2 token, yazı tipi, ikon, kit (B5–B9, B12, v2 Sheet, kaynak ölçeri) | Sırada |
| F2 | v2 HUD (B1–B4), kabuk, IA | Bekliyor |
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
- **F1.2 Archivo (sıradaki):** `@fontsource-variable/archivo`'nun genişlik eksenini (wdth 62–125) içerip içermediğini kontrol et.
- F1.3 ikonlar: `docs/ui-v2/icons.svg` → `apps/web/src/v2/icons/`.
- F1.4 kit: B9 basılı tut (`ui/kit/useOwnPress.ts` üstüne), B8, B7, B12, kaynak ölçeri, B5 (+ kaçış çizgisi), B6, v2 Sheet.

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
