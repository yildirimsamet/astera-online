# CLAUDE.md — Astera Online | Bu dosyadaki kuralları unutma. Bir geliştirme yaparken, iş uzadıgında bu dosyadaki kuralları unutup sapma!
**Development discipline, Tasarım/Design discipline, Mindset'in nasıl olmalı,Bağlam ve dosya okuma stratejisi senin için unutulacak konular değil!**

Cold-agent operating manual. Read first each session. **Keep this file small:** only cross-cutting rules needed to avoid wrong implementation belong here. Rationale/history/measurements live in `docs/`; local traps live in file docblocks.

## Product

Astera Online is a **mobile-first persistent multiplayer space game** for up to 300-1000 real players per galaxy. One commander owns one protected capital and may capture up to three colonies. Holdings are private until discovered.

> **The fleet is the bet. The information is the game. The planet is the stake.**

Design: **simple to play, deep through interactions—not more systems.**
Feel: **fun, utopian, epic; a live NASA photograph you can fly through.**

Every feature should strengthen at least one of: `OWNERSHIP · CURIOSITY · COMPETITION · AMBITION · RISK · OPPORTUNITY · RE-ENGAGEMENT · MEMORABILITY · FUN`.

The game must feel:

- **Alive:** player fleets, mining, battles, and public moments visibly happen.
- **Now:** server-timed moments appear on time; predict/reconcile instead of waiting on avoidable round trips.
- **Beautiful:** when gameplay cost is zero, favor scale, depth, light, and spectacle.

## Core loop

```text
DEVELOP → ACCUMULATE → GATHER INTEL → SPOT OPPORTUNITY → CHOOSE TARGET
→ TAKE RISK → DISPATCH → WAIT OFFLINE → OUTCOME → GAIN / LOSS → NEW DECISION
```

Battle reports create new intel. Economy/buildings support this loop; they are not the loop.


## How to work

> **IMPLEMENT → TEST → PLAY → EVALUATE → FIX → CONTINUE**

Decide architecture, libraries, queries, caching, components, internal APIs, tests, and small reversible UX details yourself.

Ask only before changing **core loop, risk/reward, PvP, ownership, seasons, progression, identity, or locked constraints**.

Do not reopen settled questions, polish docs indefinitely, wait for certainty, or redesign working systems speculatively.

If context is lost: `CLAUDE.md → docs/decisions.md → docs/balance.md → code → git log`. Never guess.

### Development discipline

**Tüm geliştirme veya güncellemeleri Test Driven Development methodu ile yapmak zorunlu, şart! (tasarım/still/className/css/design gibi konular hariç)**
**Tek kelime bir kod dahi yazılıyorsa bu method'u uygulamak ZORUNLU, ŞART!**
**ANAYASA ALLAHIN EMRİ ŞART**

1. Requirement'ı analiz et
2. Tüm happy path ve tüm edge case'leri çıkart. Eksik, yanlış, çelişkili veya ucu açık sorular varsa owner'a sor. Tüm bu çıktıyı not al.
3. Bu task'ı yaparken; nerelere dokunulacak? Çalışan bir logic'i kıracakmıyız veya kırabilir miyiz detaylıca incele not'una ekle.
3. Önce testleri yaz/güncelle/ekle
4. Gerekli testleri çalıştır → FAIL (bu aşamada tüm testleri çalıştırmana gerek yok)
5. **Implementation yaz (Her zaman şunu düşünmelisin: şuan bu yaptığım işi en temiz, en basit, en stabil, en az bug çıkartacak şekilde ve istenilen ile tamamen uyumlu bir şekilde nasıl yaparım. Over engineering yapmaya gerek yok. Kod yazmadan veya kod silerek veya bazı ufak tefek güncellemeler ile çözülebiliyor mu incelemelisin.)**
6. Gerekli testleri çalıştır → PASS
7. Son bir code review yap: eksik, yanlış, hatalı, unutulan bir yer var mı kontrol et. Bir yeri kırdık mı kontrol et.
7. Tüm testleri çalıştır. (eğer bir çok yere dokunulduysa tüm testleri çalıştırmalısın, eğer sadece belirli yerlere az bir kısıma dokunduysan tüm testleri çalıştırmana gerek yok. Yani bu aşamada ya tüm testler çalıştırılacak yada tekrar dokunulan yerler veya yaptıgın geliştirme testleri ile birlikte bağlantılı olabilecegini düşündügün yerlerin testleri çalıştırılacak (sen karar vereceksin sorumluluk sende!))

### Tasarım/Design discipline

**frontend'de yeni veya güncellenecek bir component, sayfa, section, element, tasarım, design vs her hangi bir şey yaparken, bu 4 kuralı takip etmen ŞART! ZORUNLU!**

#### The four questions every surface must answer

Owner instruction, and they outrank aesthetics on every screen in this game. A surface that
fails one of these is unfinished however finished it looks — and the failure is usually
invisible to whoever built it, because the builder already knows what the number means.

##### 1 · Clarity — does the player understand this?

Putting a value on screen is not the same as making it understood. Beside every figure a
player is meant to act on, they need to be able to answer:

- What does this represent?
- Is a big one good?
- How does it compare to MY equivalent?
- What else is it related to?
- Which decision am I supposed to use it for?

##### 2 · Predictability — can the player anticipate the outcome?

They do not need certainty. This game is *built* on not having it, and a screen that answered
"will I win" would end the bet the core loop is made of. But an outcome nobody can estimate
is indistinguishable from a random one, and it makes the whole intel layer worthless: nobody
pays for a reading that does not narrow anything.

The line: **the player must be able to form an expectation and be wrong about it.** Give the
inputs and the rule; withhold the answer.

##### 3 · Decision support — do they hold what they need to choose?

Rules must be discoverable *where they are used*, in the amount needed *at that moment*. The
two failure modes are equally bad:

- **Too much** — a twenty-page wiki, or every rule on every card.
- **Too little** — dropping the player into a system with no explanation at all.

Progressive disclosure is the answer: the row states the fact, the sheet one tap deeper
states the rule. *The worked example:* the counter cycle decides every fight in the game and
its multipliers appeared in exactly one place — the battle report, after the fleet was
already lost. A rule taught as a post-mortem is not decision support (D124).

And the adjacent case: **a player must be able to sense why a feature exists.** If a mechanic
leaves them asking "why am I doing this", the answer to *what does it get me* and *when
should I use it* is missing from the surface, not from the player.

##### 4 · Interaction cost — how much work is this to use?

Scroll is a cost. So is a tap, and so is a screen change. Ten items a player wants to
COMPARE, at one screen each, is a different product from the same ten at two screens.

On a 350-wide phone, density and screen economy outrank decorative whitespace — but not
blindly: **space must carry a purpose.** The 74px art socket earns its height (a render at
40px reads as a favicon); a paragraph under a collapsed band does not.

##### 5 · Premium Design — we are a visually oriented game.

Hiç bir tasarımı baştan savma yapamazsın! Biz; premium AAA kalite bir oyun olma yolunda ilerliyoruz.
Görsellik, tasarım, design çok önemli.
**Her zaman**: ui-v2 ilkeleri ile uyumlu kaliteli, premium, bakanın hayran kalacagı tasarımlar yapmalısın.
Oyunumuzda insanları etkileyen en önemli başlıca faktörlerden birisi tasarım görsellik kalite premium hissiyat.
(Oyun hareketleri OS hareket tercihinden bağımsızdır. Owner’ın 18 Ekim 2026 tarihli açık erişilebilirlik talebiyle yalnız public landing CSS’i istisnadır; bkz. docs/landing-premium-redesign-2026-10-18.md.)

#### The question behind all four

**Does this interface SHOW, or does it HELP?** An interface can present every fact a player
needs and still leave them unable to decide, and that is the state this project's screens
were found in. Showing more is not helping more.

Yaptıgın/Güncellediğin/Fixledigin herhangi bir işte tasarım/design ile ilgili yapılması gerekenler varsa asla atlanmamalı!
**Her zaman şunu düşünmelisin: "Oyuncu API'yi anlamaz. Oyuncu gördüğünü anlar, gösterileni bilir!"**
**Sana her hangi bir şey yap dedigimde, bu işin tasarım/design kısmını sakın atlama. Çok önemli bak bu konu.**

## Quality bar

> **CODE WITHOUT TESTS IS UNFINISHED WORK.**

```bash
pnpm verify
```

Required: zero type errors, zero lint errors, expected tests green.

**Owner rule, 2026-10-09:** Economy/season simulations, snowball audits and similarly
long economy studies/calibration run **only when the user explicitly requests those
long tests**. A request to run “all tests”, finish a task or verify a change does not
authorize them. This overrides older plans and test instructions. Ordinary rules,
resource transaction, API and UI regressions remain required. `pnpm test` and
`pnpm verify` exclude the simulation workspace and snowball audit by default;
`--exclude-sims` remains compatible. Only after the explicit request use
`pnpm verify --include-long-tests` or `pnpm test:long`.
Direct `packages/sim` and server audit discovery is also disabled unless
`ASTERA_INCLUDE_LONG_TESTS=1` is set by an explicitly authorized run.

**Owner rule, 2026-10-09 (local PC):** Run checks sequentially, one workspace and one Vitest
worker at a time (`--workspace-concurrency=1`, `--maxWorkers=1 --minWorkers=1
--no-file-parallelism`). Use `nice -n 10` for tests. Avoid simultaneous test/typecheck/lint
runs; keep the owner's PC responsive.

**Owner rule, 2026-10-13 (local PC):** Node heap must never exceed 4 GiB
(`--max-old-space-size=4096` maximum). Do not use 6 GiB or raise the ceiling to make
a check pass. Heap is not total process memory; monitor RSS and keep the PC responsive.
Run memory-heavy lint coverage in sequential groups through `pnpm lint` if needed;
all files must still be checked. See `docs/engineering-standards.md` for commands.
This owner rule overrides any older 6 GiB guidance still present in local docs.

- Ban `any`/compiler-silencing casts; parse untrusted boundaries with Zod.
- Diagnose root cause before changing code/tests.
- Test adversarial input, concurrency, failure, and time.
- No silent placeholders in core gameplay.
- Visually verify frontend changes with `node tools/visual.mjs`.

A new system must create a meaningful decision and strengthen interaction/risk/opportunity/curiosity/return reason without unnecessary micromanagement. If uncertain: **PROTOTYPE → PLAY → OBSERVE → DECIDE**.

Regression signals: loop becomes `BUILD → WAIT → COLLECT → UPGRADE`; resources replace players as the fun; intel→decision→action weakens; micromanagement grows; result is technically impressive but emotionally empty.

## Docs map

Dökümanlar güncel ve kesin bilgiyi içermiyor olabilir. **Kod'un kendisi ve Testler = Kesin Bilgi**

**UI/UX writing:** Yeni veya güncellenen UI, gameplay açıklaması, yardım ve Wiki metinlerinde
[`docs/ux-writing.md`](docs/ux-writing.md) uygulanır. Lore kapsam dışıdır; içindeki işlevsel
talimatlar kapsam içindedir. Bu standart yazım kuralıdır; mekanikleri kod ve testlerden doğrula.

| File                            | Read before                          |
| ------------------------------- | ------------------------------------ |
| `docs/product-vision.md`        | Judging product purpose              |
| `docs/game-design.md`           | Changing system behavior             |
| `docs/balance.md`               | Changing numbers / simulator tuning (Sakın tüm dosyayı okuma, tüm dosya çok uzun. Gerekli kelime ve konuları keserek oku!)  |
| `docs/architecture.md`          | Server architecture                  |
| `docs/deployment.md`            | Shipping / operations                |
| `docs/engineering-standards.md` | Writing code                         |
| `docs/interface.md`             | Screens / interaction                |
| `docs/ux-writing.md`            | UI copy, gameplay explanations, onboarding, help, Wiki |
| `docs/visual-design.md`         | Art / 3D                             |
| `docs/playtest-log.md`          | Playtesting                          |
| `docs/review-sight.md`          | Touching Telescope/Radar/probe sight |
| `docs/review-onboarding.md`     | Onboarding / new-player experience   |
| `docs/glossary.md`              | Terms                                |
| `docs/komutan-gemisi/README.md` | Touching Komutan Gemisi / Savaş Alanı (real-time pilot arena) |
for others check docs folder.

## Mindset'in nasıl olmalı:

1. Think Before Coding
Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:

State your assumptions explicitly. If uncertain, ask.
If multiple interpretations exist, present them - don't pick silently.
If a simpler approach exists, say so. Push back when warranted.
If something is unclear, stop. Name what's confusing. Ask.
2. Simplicity First
Minimum code that solves the problem. Nothing speculative.

No features beyond what was asked.
No abstractions for single-use code.
No "flexibility" or "configurability" that wasn't requested.
No error handling for impossible scenarios.
If you write 200 lines and it could be 50, rewrite it.
Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

3. Surgical Changes
Touch only what you must. Clean up only your own mess.

When editing existing code:

Don't "improve" adjacent code, comments, or formatting.
Don't refactor things that aren't broken.
Match existing style, even if you'd do it differently.
If you notice unrelated dead code, mention it - don't delete it.
When your changes create orphans:

Remove imports/variables/functions that YOUR changes made unused.
Don't remove pre-existing dead code unless asked.
The test: Every changed line should trace directly to the user's request.

4. Goal-Driven Execution
Define success criteria. Loop until verified.

Transform tasks into verifiable goals:

"Add validation" → "Write tests for invalid inputs, then make them pass"
"Fix the bug" → "Write a test that reproduces it, then make it pass"
"Refactor X" → "Ensure tests pass before and after"
For multi-step tasks, state a brief plan:

1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

These guidelines are working if: fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.


**Bağlam ve dosya okuma stratejisi:**
Gereksiz, tekrarlı ve amaçsız dosya okumalarından kaçın. Önce hedefli aramalarla ilgili dosyaları, bağımlılıkları ve çağrı zincirlerini belirle. Ardından değişikliğin doğruluğunu ve mevcut sistemlerle uyumluluğunu sağlamak için gereken tüm kodu incele.

Token tasarrufu uğruna gerekli incelemelerden, bağımlılık analizinden veya testlerden ödün verme. Büyük dosyalarda önce ilgili bölümleri oku; ihtiyaç duyarsan kapsamı genişlet. Daha önce okuduğun ve değişmediğini bildiğin içerikleri gereksiz yere tekrar okuma.

En önemlisi: bana gereksiz çıktı verme, gereksiz uzunlukta çıktı verme, çıktı vermen gerekiyorsa: kısa, net ve benim anlayabilecegim şekilde yaz.

**Öncelik her zaman doğruluk ve güvenilirliktir; verimlilik ikinci sıradadır.**

## One thing to remember

> **Build a multiplayer game that leaves players wondering, “What happened?” after they close it. AAA+ Premium Visual Quality Optimized browser and app game**
