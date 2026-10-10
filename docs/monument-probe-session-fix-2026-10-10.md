# Monument probe bursts and session recovery — 2026-10-10

## Requirement and diagnosis

Repeated monument probes must not turn a temporary API rate limit into a sign-out.
Keep the existing account request ceiling and five-second per-target probe guard.

`Api.restore()` currently returns `false` and clears the access token and placement
for every refresh failure, including HTTP 429, server failures and network errors.
`useSession.coldStart()` then deletes the remembered galaxy and shows the landing
screen. Its profile-read error path also discards the remembered galaxy for a 429.
These are confirmed code paths; the reported live incident has no captured trace.

A launch invalidates several reads through both its response and its private SSE
event. Probe losses additionally publish a notification that currently falls
through to a full resync. These can increase request volume; changing event
routing is not required to correct session loss and is outside this patch.

## Required cases

- Successful refresh restores the credential and retries an expired request once.
- A refresh HTTP 401 means the session is gone: clear credentials and placement,
  remove the remembered galaxy and show the sign-in entry.
- Refresh HTTP 429, server failure, malformed success or network failure must
  reject with the failure, preserving existing credentials and placement.
- Concurrent requests share one refresh attempt, including when that attempt fails.
- An expired monument write whose refresh is rate limited reports the 429, sends
  no extra write, and can later be retried with the same confirmation key.
- A rate-limited write with a live credential does not attempt refresh or sign out.
- Cold-start refresh/profile failures preserve a remembered galaxy and its cache;
  a page with no remembered galaxy shows the localized error with its retry button.
- Retrying after the limit clears restores the normal session.
- Actual missing/expired sessions still remove stale remembered state.

## Touch points and risks

- `apps/web/src/api/client.ts`: distinguish rejected credentials from temporary
  refresh failures. All REST requests and SSE reconnects share this path.
- `apps/web/src/session/useSession.ts`: preserve resumed sessions on temporary
  cold-start failures and use the existing error/retry screen for cold visitors.
- API and session tests: cover identity, placement, concurrency, refusal and recovery.
- Existing UI text and components provide localized errors and retry; no new copy,
  gameplay rules, rate-limit values or server/database changes are needed.

The working tree already contains unrelated changes, including API client edits.
Keep them intact and make only targeted edits. Run red tests before implementation,
then targeted regressions, visual checks and ordinary workspace checks sequentially
with one Vitest worker under `nice -n 10`. Long economy simulations are excluded.

## Verification

- The new API/session regressions first produced ten expected failures against
  the old implementation. After the fix, 179 tests passed across the API client,
  session machine, event stream, monument contract/sheet and resource state.
- `node tools/visual.mjs out/session-recovery --session-recovery` passed in
  Chromium at 350px and 1280px, in Turkish and English. A refresh HTTP 429 shows
  the localized limit and retry action; retrying after the refusal clears restores
  the session using its cookie, with no sign-in request or browser errors.
  Screenshots were inspected. These checks use browser-only fixtures, with no
  production account, gameplay write or rate-limit configuration change.
