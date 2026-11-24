---
name: game-dev-handbook
description: "Owner 2026-11-24: consult ~/Desktop/Coding/MyProjects/game-dev-handbook before every game-facing change and apply the principles that fit Astera; CLAUDE.md §4.7"
metadata:
  type: feedback
---

The owner built a game development handbook at `/home/yildirim/Desktop/Coding/MyProjects/game-dev-handbook/` (outside the repo; 15 chapters, 154 principles with permanent IDs such as `GF-03`, `SB-04`, `EN-03`, plus `checklists.md`). Directive (2026-11-24): when developing, if the handbook covers the topic, follow it, as long as it suits Astera and makes the game better.

**Why:** the owner is new to game production ([[user-gamedev-beginner]]) and wants agents to ship more professional, higher-quality work using industry knowledge instead of reinventing it.

**How to apply:**
- Before work: open `README.md`, use the routing table, read the matching chapter. Before delivery: run the matching section of `checklists.md`. Cite the principle IDs used in the plan and the delivery note.
- Fit filter: Astera is mobile-first, persistent and asynchronous (dispatch, wait offline). Action-game principles (coyote time, frame data, hit stop, parry) apply only to real-time surfaces such as Komutan Gemisi / Savaş Alanı.
- CLAUDE.md, docs/ and owner decisions outrank the handbook. Known conflicts: the reduced-motion items (UI-10, AC-03) lose to "game motion ignores the OS preference"; glow, halo and pulse effects (UI-02, UI-07, GF-08) lose to [[no-generic-glow-pulse]]; the text sizes in UI-14 and AC-02 are console/PC values, and the mobile type floor is the owner's call ([[astera-mobile-uiux-research]]); bots stay indistinguishable ([[astera-bots-indistinguishable]]).
- If a handbook principle would improve the game but clashes with a rule, present it as a trade-off and ask ([[locked-means-ask]]).
- Do not present `Elaboration` or `Claimed, unverified` entries as proof. Never implement the ML-05 anti-patterns without the owner's written approval.

Related: [[game-feel-mandate]], [[mentor-best-path]], [[game-assets-library]].
