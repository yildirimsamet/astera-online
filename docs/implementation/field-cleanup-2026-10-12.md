# Owner-requested live field cleanup — 12 October 2026

The owner requested exactly 22 asteroids and 10 pirates removed from the active
galaxy. EU-1 was identified from the live inventory; EU-2 and WAIT-1 were not altered.
Targets of outbound or returning mining runs/raids were excluded.

At 23:32:17 UTC (02:32:17 Türkiye), the operation removed **22 of 31 active rocks**
and **10 of 14 standing pirates**, leaving **9 rocks and 4 pirates** at that fixed
instant. The initial reported 28 rocks had increased through ordinary scheduled
births by the time of application; the requested removal count was kept at 22.

Rocks are procedural, so removal persists their full ore depletion in
`asteroid_claims`; deleting/reordering a generation lane would change other opaque
targets. Pirates receive `destroyed_at` in `pirate_state`, without a winning player,
combat result, reward or debris. Existing damage remains. Every generated spec,
hour row, index and remaining target is preserved. Transactional shard notifications
invalidate the three API caches and update connected players.

The operator helpers are `cli/removeAsteroids.ts` and `cli/removePirates.ts`.
They default to a write-free preview, require explicit unique target IDs in a live
season, refuse active flights and serialize with the season row lock. A 1.5-second
lock timeout prevents waiting indefinitely on gameplay. Repeating the same batch
does not remove extra targets. They are not called from application startup and
have no HTTP route.

Both were exercised against a fresh consistent production backup restored to a
disposable database. Snapshot table counts matched exactly. The full 22/10 rehearsal
preserved mining runs, raids, asteroid geometry, pirate geometry and stored hours.
Application repeated the target/flight checks on live data before writing. All four
production processes remained healthy; no API or worker restart, migration, calendar
adoption or spawn-rate change was performed.

Focused PostgreSQL tests passed 11 cases, including exact removal, surviving IDs,
boot-planning persistence, damage preservation, concurrent retries, active-flight
refusals and malformed inputs. Missing helper modules were observed red before
implementation; affected tests, server typecheck and targeted lint then passed.

The live hour rows at 23:24 UTC showed one ordinary row per galaxy/hour. EU-1's
23:00 UTC row was created at **23:00:01**, before the previous release's publication
at **23:09:38**. Its frozen lane planned 26 rocks spread through that hour. Newly
visible rocks at 23:16–23:23 belonged to that existing row. This incident's evidence
shows scheduled births across deployment time; it does not show duplicate restart
generation or justify changing the hourly supply rules. The focused removal test
also retained depletion through three repeated boot-planning calls.

Private backup, plan, rehearsal and application evidence are retained on the VPS
under `/home/yildirim/astera-ops/remove-fields-20261012.AvU9KccQ`; credentials and
world dumps are not committed. The operation used the existing production image
`042693c` with the reviewed operator modules mounted into a disposable container.
