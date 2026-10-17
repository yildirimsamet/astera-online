# Admin chat media and reaction details

Scope: General, Clan (including the admin clan browser), and DM. Only configured admin accounts may upload or send media. Existing message visibility, moderation, rate limits, replies, unread cursors and season retention remain authoritative.

Reaction counters open a read-only list of every reacting commander's display name and emoji. The list viewport is exactly three rows high and scrolls internally. Only the existing emoji picker may add, replace or remove the viewer's sole reaction. Selecting the current emoji removes it. Counters remain readable when sending is disabled. Details must never disclose another clan's history or another pair's DMs.

Media: one image, uploaded video or YouTube attachment per message, optional caption, preview/removal before sending, upload progress/cancel/retry and preserved drafts on failure. Images: JPEG, PNG, WebP, GIF up to 10 MiB. Videos: MP4, WebM up to 50 MiB. No autoplay. Verify file signatures and limits on the server; normalize YouTube IDs from approved URLs. Media-only messages are valid. Raw HTML and arbitrary embeds are invalid.

Storage must survive API restarts and season wipes and be shared by the three production APIs. File reads enforce the containing message's channel permissions. Uploaded assets are owned by permanent accounts, claimed atomically when sending, and cannot be attached by someone else. Unsent uploads expire; archived attachments persist. Masking hides attachments as well as text. Video seeking requires HTTP Range support. Browser media requests need an authenticated path compatible with their native loading behavior.

Affected areas: server routes/services and DB migrations (live messages, assets, archives); client schemas/API/cache and shared ChatScreen; all six locale files; proxy/upload configuration, production storage/backup; interaction/API/contract/archive tests and browser visual verification.

TDD checkpoints: reaction detail authorization and non-mutating chips; picker add/replace/remove; admin-only sends and uploads, malformed content/URLs/files/oversize, ownership and concurrent claiming, channel visibility and seeking, moderation and archive survival; media rendering, composer failure/cancel and history scrolling. Run focused tests red before implementation, then green, followed by sequential type/lint/ordinary tests and visual checks. No long economy simulations.


Implementation: `CHAT_MEDIA_DIR` points to `.data/chat-media` locally and `/data/chat-media` in production. The `astera_chat_media` named volume is mounted by all APIs; the image initializes its ownership for the unprivileged node user. PostgreSQL stores metadata and the atomic one-message claim. Uploads without a claim expire after 24 hours; the next admin upload collects expired rows/files and older orphan files. Claimed files remain through wipes and are copied to both chat archives. Masking removes their live reference and immediately denies subsequent file reads.

Native image/video reads authenticate through the existing HttpOnly refresh cookie (or bearer for API clients), verify the durable auth version and the containing message's permissions on every request, and return private/no-store responses. No credentials appear in URLs. Native reads reconcile the current placement under the same placement lease because media elements cannot set an X-Placement header. Ordinary JSON writes retain their existing placement fencing.

Deployment: apply migration 0182, rebuild APIs with their shared media volume, and install the exact `/api/admin/chat/media` Nginx upload location. Ordinary requests retain the 256-KB proxy ceiling. Existing game CSP already allows same-origin media and the privacy-enhanced YouTube frame. `deploy/backup.sh` now publishes a database dump only after the matching `.media.tar.gz` succeeds. Restore the SQL dump and extract that matching media archive into the API media volume (uid/gid of node); preserve file permissions. The initial implementation checkpoint did not deploy production; the subsequent authorized release is recorded below.

Clipboard addition: an admin may paste an image/screenshot directly into the message textarea (Ctrl+V or the native paste action). It uses the same validated upload, preview, cancellation and explicit Send flow; normal text paste remains native. Only one image is taken from a multi-file paste, and pasting cannot replace an in-flight upload or submit while a message is pending.

YouTube refinement: show the native YouTube iframe immediately in both preview and history, with lazy loading and no autoplay. The intermediate application Play screen was removed at the owner’s request.

## Review and fixes

The follow-up review covered authorization, file ownership and signatures, session revocation, channel boundaries, concurrent claims, moderation/archives, deployment/backups, upload failures and composer/layout behavior. Seven findings were reproduced before their fixes:

1. Closed clan history denied the ordinary chat request but still exposed attachment reads and reaction details. Both now use the canonical clan season gate and active membership, including the membership join timestamp. Explicit admin clan browsing remains available.
2. A successful pending send cleared a newer draft typed while waiting. Completion now clears only the submitted draft, reply and attachment when they are still current.
3. Upload retry remained clickable during a pending message send. Both the action and retry control now enforce the disabled/in-flight state.
4. An upload could wait indefinitely. XHR now times out after 120 seconds and exposes the existing retry flow.
5. Upload placement conflicts did not trigger the normal session reconciliation event. `PLACEMENT_CHANGED` now follows the ordinary API behavior.
6. At 350×480 an attachment preview pushed Send below the viewport. Composer previews now have viewport-aware dimensions; history retains its larger bounded media view.
7. Pending-upload cleanup queried the database once per retained file. It now resolves file IDs in batches of 256 and limits expired-row collection per pass, preserving claimed files.

Regression evidence: the focused API/security suite passed 16 tests; the focused UI, upload, URL parsing and locale suite passed 206 tests. Browser checks passed in Turkish and English at 350×480, 350×812 and 1280×812, including decoded images, playable video metadata, clipboard upload, explicit sending, read-only reaction chips, three-row internal scrolling and composer bounds. Final workspace checks and the rebuilt local preview are recorded after completion.

## Authorized release preparation

The owner subsequently requested deployment. Read-only production preflight found a clean checkout at `9b3d4cfeddc7fbd9c2112d8ce1763c43d981ea13`, matching this task's base, with 182 applied migrations (through 0181), healthy API/worker services, and a passing D99 capacity gate. The fifteen-minute activity proxy was 18 commanders. Only 0182 is pending; no season adoption or other feature activation belongs to this release.

Use an immutable reviewed commit, preserve the current image/webroot/vhost/private environment and a fresh private database dump, restore and rehearse 0182 with lock/statement timeouts, then roll the APIs individually and the worker. The migration adds nullable media columns and an asset table and relaxes the existing clan/DM content checks; existing text-only writes remain compatible. Publish the matching web after backend acceptance, retain prior hashed assets, install the upload-specific Nginx location, and verify public release identity and authorization boundaries. Production media starts empty and uses the shared named volume. Do not restore the database over subsequent player writes as routine rollback.

## Release result

Deployed application: `3400e84f976d24e4194e7de7e9099b7812e6295b`. Final acceptance: 17 October 2026 11:23 TRT. The matching checkout, all three APIs, worker image/runtime identities and public `release.txt` were verified. Migration 0182 is applied (183 journal entries). Every API mounts the same writable `astera_astera_chat_media` volume. Existing mail flags remain true on all four roles. No season adoption/reset was performed.

Validation: all workspace typechecks and all three sequential lint groups passed. Ordinary rules: 2,421 passed. Ordinary server coverage across the completed and resumed sequential runs: 4,381 passed / 3 skipped. Web: 6,684 passed / 29 skipped, with one pre-existing failed suite: `galaxy-postprocessing.test.tsx` cannot collect because its postprocessing mock lacks `wrapEffect`. A clean detached worktree at the actual live baseline `9b3d4cfe` reproduced the identical error; that test and its production modules have no diff in this release. This is recorded under the deployment runbook's baseline-failure policy, not reported as an all-green web suite. The immutable release candidate's 206 focused UI/upload/parser/locale tests and its local production build passed again in a separate worktree. Unrelated concurrent workspace changes (including 0183) were excluded.

A fresh private dump passed checksum and was restored into a disposable database. Migration rehearsal preserved all sampled account/player/world/mission/event/chat counts and the username/password/auth-version digest. Old/new images passed real text-message reads/writes on that restore; the new image also passed admin upload/send, non-admin denial, authenticated native range reads and reaction-detail reads. The rehearsal database and probe containers were removed. Rollback image, webroot, Nginx, environment, dump and logs remain private under `~/backups/chat-release-20261017-3400e84f976d`.

After the rolling API/worker update and web publication, public unauthenticated media/detail reads and a 300-KiB upload were denied with 401; the upload reached authentication rather than the ordinary 256-KiB proxy ceiling. Orphan-neutral and overdue-flight acceptance counts were zero. A subsequent health sample returned one transient 503; follow-up checks showed zero failed/stranded work, zero worker tick/handler/unknown-event errors and three consecutive successful four-service acceptance samples. Acceptance JSON is retained privately and copied to ignored `out/chat-release-2026-10-17/acceptance.json`. Public mobile/desktop entry screens loaded without page errors or horizontal overflow; chat visual checks are the isolated TR/EN six-viewport checks described above. Local preview at `http://localhost:5199` now serves the isolated release build.

YouTube uses the privacy-enhanced iframe, with `strict-origin-when-cross-origin`; live CSP allows the provider. Uploaded files remain same-origin. Per-video embedding restrictions are controlled by YouTube. This closing documentation update does not change the deployed application artifact.
