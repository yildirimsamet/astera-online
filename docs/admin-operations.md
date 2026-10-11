# Admin operations — requirements and validation

Owner request, 2026-10-11. Authority remains the out-of-band `ADMIN_USERNAMES`
allowlist, resolved from the authenticated account's canonical login. Client flags,
display names, clan membership and request bodies cannot grant authority.

- Online commanders: existing five-minute activity window, across galaxies; exclude
  bots, paginate bounded reads, show galaxy and last activity. Resource totals cover
  currently controlled worlds. Show spendable storage and uncollected production
  separately, using the existing read-only lazy economy including faults, recovery,
  season end and Silent Space pace. Never tick other players from an admin read.
- Last 24 hours: valid launches in `[now - 24h, now]`, including completed/recalled
  missions. Asteroids only (exclude debris harvesting); show dispatches and miners.
  Pirate launches show dispatches and ships. Attribute to launch owner, not current
  planet controller. Batch by the current page; no per-player database queries.
- Mute: independent General, Clan and DM checkboxes (owner clarification). Durations
  5/15 minutes, 1/4 hours, 1 day, permanent, plus explicit removal. Account scoped,
  survives season changes, server clock and database authority on every send.
  Serialize send/moderation so a committed mute cannot be bypassed by another API
  process; no timers or process-local enforcement. Keep an operator audit trail.
- Mask: last X messages by one commander in the chosen general language or chosen
  clan only (owner clarification). Bounded positive X, exact `**` replacement,
  deterministic timestamp/id ordering, no DM access. Preserve original content in
  the private audit trail, update reply previews, notify after commit.
- Clan chat: admin-only clan dropdown in the chat's Clan tab, history and posting
  without joining or changing clan membership. Scope pagination/replies to the
  selected clan; selected-clan polling only while visible, never load all histories.
  Normal members retain joined-at visibility and existing writes/permissions.
- Admin capital: idempotently provision the existing/new capital at galaxy centre,
  maximum Telescope with required Core/Uplink. The normal maximum Telescope's
  9,900 DU identification range covers the 9,000 DU galaxy diameter from centre;
  no global sight/cache override affects ordinary players. The existing omission
  of admin worlds from public galaxy/preview remains intact. General/clan chat
  also omits an admin author's planet link when another player reads it.

Affected systems: schema/migration, account deletion, general/clan/DM send paths,
admin routes, read projections and join/provisioning, React admin/chat UI, API
schemas, six locale trees and errors. Placement locks, economy mutations, ordinary
progression, clan membership, capacity and combat rules must remain unchanged.

Required tests before implementation: unauthenticated/non-admin denial for every
new endpoint; forged identity and invalid/bounded payloads; each mute channel,
expiry boundary, permanent and removal; no partial actions on invalid targets;
mask channel/author isolation, identical timestamps, replies, retained originals;
cross-clan admin read/write and ordinary-player denial; resource/activity totals,
owner attribution and 24h boundary; centred/max admin provisioning, hidden worlds
and no cache leakage. UI tests cover checkbox payloads, scope switching, pending,
failure and success, plus mobile/desktop browser verification. Run sequential
typecheck, lint and all ordinary tests; no long simulations.

Implementation validation: 203 targeted server regressions pass (admin, general/
clan/DM chat, community, galaxy, servers and onboarding); 14 admin UI/harness tests
pass. Browser verification at 350px and 1280px in Turkish/English checks overflow,
checkbox payloads and selected clan switching. Artifacts: `out/admin-operations`.
Migrations 0148/0149 were applied only to the isolated test database. The combined
workspace's ordinary quality gates run after the two owner-requested follow-ups.
