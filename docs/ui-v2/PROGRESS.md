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
| F0 | H1 (`lib/directives.ts` kalkanlıyken tehdit), H2 (`shell/StatusBar.tsx` depo dolu kırmızısı) — `ui-v2`'ye commit, sahip master'a cherry-pick eder | Sırada |
| F1 | v2 token, yazı tipi, ikon, kit (B5–B9, B12, v2 Sheet, kaynak ölçeri) | Bekliyor |
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
**F0 · H1** — şartname: `grep -n "^| H1" docs/ui-v2/gozlemevi.md`. Kod: `apps/web/src/lib/directives.ts`
("zemin savunması yok" kuralı kalkanı kontrol etmiyor). Test önce: kalkanlı, yer savunmasız gezegende
hiçbir yönerge `threat` değil; kalkan bitince `threat`. Ayrı küçük commit (master ana ağaçta açık olduğu için
buradan master'a commit atılamaz; hash sahibe verilir, o cherry-pick eder).

## Biten işler
- Adım 0 (2026-09-23): worktree `ui-v2` @ a64b230; şartname kopyası; fleet escape (a64b230) şartnameye
  işlendi (kural 16/16b, B5, B15, E5); karar defteri "onaylandı"; 16 gezegen `.glb` dala eklendi.
  Sonra sahip kararıyla şartname yalnız Markdown'a geçti; HTML, betikler ve artifact bırakıldı; ikonlar `icons.svg`'ye,
  token listesi şartnameye taşındı.

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
- (yok)

## Bilinen kırmızı testler (2026-09-23 @ a64b230, worktree)
typecheck 0 hata · lint 0 hata.
- rules (4): `academy.test.ts` "makes the Academy exit whole…"; `economy-profile.test.ts` "links the other purchases…";
  `intergalactic-convoy.test.ts` "uses combat-only firepower…"; `transport-ladder.test.ts` "carries more than it cost…".
- sim (1): `season.test.ts` "TAX holds its band".
- web (14): `api-bodies.test.ts` disbandClan; `build-sheet.test.tsx` strategic hardware ×4; `chronicle-screen.test.tsx`
  capital strike; `locked-rows.test.tsx` research gate; `predict.test.ts` ×2; `recovery-boost.test.tsx` ×2;
  `research-gains.test.ts` ×2; `surface-vocabulary.test.ts` "names no colour, size or radius the theme does not publish".
- server: ölçülmedi (paylaşılan veritabanı; F3'te sunucuya dokunmadan önce ölçülecek).
