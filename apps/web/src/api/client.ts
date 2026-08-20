import type { z } from 'zod';
import type { Fleet, BuildingId, HullId, InstrumentId, SatelliteId } from '@astera/rules';
import { noteServerTime } from '../lib/clock.js';
import {
  collectSchema,
  galaxySchema,
  intelSchema,
  miningLaunchSchema,
  miningSchema,
  launchSchema,
  leaderboardSchema,
  meSchema,
  notificationsSchema,
  okSchema,
  pendingSchema,
  placementSchema,
  planetSchema,
  probeSchema,
  reportsSchema,
  returnSchema,
  instrumentRaiseSchema,
  satelliteInstallSchema,
  seasonSchema,
  serverListSchema,
  sessionSchema,
  trafficSchema,
  buildSchema,
  markedSchema,
  unlocksSchema,
  upgradeSchema,
  watchSchema,
} from './schemas.js';

/** The API's single error shape, preserved so the UI can act on the code. */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiDeps {
  fetch?: typeof globalThis.fetch;
  baseUrl?: string;
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  /**
   * The payload as an OBJECT. `send` serialises it — do not pre-encode.
   *
   * This was `unknown`, and two call sites passed `JSON.stringify(...)` as well.
   * The result was a body double-encoded to a JSON string literal, so the server's
   * `z.object(...).parse(req.body)` saw a string and every launch failed with
   * "expected object, received string". Typed as a record, that mistake is a
   * compile error rather than a runtime one a player finds.
   */
  body?: Record<string, unknown>;
  /** Refresh tokens are only ever exchanged by `restore()`; never recurse into it. */
  retryOnExpiry?: boolean;
}

/**
 * Everything the client knows how to ask for.
 *
 * The access token lives here, in memory only. The refresh token is an httpOnly
 * cookie the page cannot read — which is the point: XSS cannot steal a thirty-day
 * credential from a variable it can reach, because the credential is not there.
 */
export class Api {
  private readonly http: typeof globalThis.fetch;
  private readonly baseUrl: string;
  private token: string | null = null;
  /** Deduped: five queries expiring at once must produce one refresh, not five. */
  private refreshing: Promise<boolean> | null = null;

  constructor(deps: ApiDeps = {}) {
    this.http = deps.fetch ?? globalThis.fetch.bind(globalThis);
    this.baseUrl = deps.baseUrl ?? '';
  }

  get accessToken(): string | null {
    return this.token;
  }

  private async send<T>(
    path: string,
    schema: z.ZodType<T>,
    opts: RequestOptions = {},
  ): Promise<T> {
    /**
     * EVERY ANSWER CARRIES THE SERVER'S CLOCK, so the offset costs no request. D52.
     *
     * The disc is drawn by comparing server timestamps against "now", and "now" used
     * to be the DEVICE's clock — so a phone with a drifted clock drew every fleet at
     * the wrong point of its leg and every countdown at the wrong number. See
     * `lib/clock.ts`. Measured around the call rather than after it, because half
     * the round trip is what has to come back off the sample.
     */
    const sentAt = Date.now();
    const res = await this.http(`${this.baseUrl}${path}`, {
      method: opts.method ?? 'GET',
      headers: {
        ...(opts.body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
      },
      ...(opts.body === undefined ? {} : { body: JSON.stringify(opts.body) }),
      // Sends the refresh cookie. Same-origin in dev via the Vite proxy.
      credentials: 'same-origin',
    });
    noteServerTime(res.headers.get('x-server-time'), res.headers.get('date'), sentAt, Date.now());

    if (res.status === 401 && (opts.retryOnExpiry ?? true)) {
      if (await this.restore()) {
        return this.send(path, schema, { ...opts, retryOnExpiry: false });
      }
    }

    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      /**
       * A failure with NO BODY is not a game rule refusing you.
       *
       * It is the API being unreachable — restarting, redeploying, or behind a
       * proxy that answered for it. Every game error carries a code and a sentence
       * saying what the player did wrong; a bare status carries neither, and
       * reporting it as "Something went wrong" told the player their action was
       * rejected when in fact it never arrived. Those want different responses:
       * one means change what you are doing, the other means try again.
       */
      if (body === null) {
        throw new ApiError(
          'UNREACHABLE',
          'Lost contact with the server. Try again in a moment.',
          res.status,
        );
      }
      const parsed = errorShape(body);
      throw new ApiError(parsed.error, parsed.message, res.status);
    }
    return schema.parse(body);
  }

  /* ── identity ─────────────────────────────────────────────── */

  /** Exchange the refresh cookie for a live token. False means "no session". */
  async restore(): Promise<boolean> {
    this.refreshing ??= (async () => {
      try {
        const session = await this.send('/api/auth/refresh', sessionSchema, {
          method: 'POST',
          retryOnExpiry: false,
        });
        this.token = session.accessToken;
        return true;
      } catch {
        this.token = null;
        return false;
      } finally {
        this.refreshing = null;
      }
    })();
    return this.refreshing;
  }

  /**
   * Create a commander. D21.
   *
   * `retryOnExpiry: false` on all three of these: there is no session to refresh
   * yet, and a 401 from a login is the answer, not a stale token.
   */
  async register(username: string, password: string) {
    const session = await this.send('/api/auth/register', sessionSchema, {
      method: 'POST',
      body: { username, password },
      retryOnExpiry: false,
    });
    this.token = session.accessToken;
    return session;
  }

  async login(username: string, password: string) {
    const session = await this.send('/api/auth/login', sessionSchema, {
      method: 'POST',
      body: { username, password },
      retryOnExpiry: false,
    });
    this.token = session.accessToken;
    return session;
  }

  /**
   * Sign out.
   *
   * The in-memory token is dropped FIRST and unconditionally. If the request fails
   * — offline, server restarting — the player must still end up signed out of this
   * tab; a logout that silently leaves you logged in because the network hiccuped
   * is the worst possible failure mode for a shared computer.
   */
  async logout(): Promise<void> {
    this.token = null;
    try {
      await this.send('/api/auth/logout', okSchema, { method: 'POST', retryOnExpiry: false });
    } catch {
      // The cookie may survive. Nothing in this tab can use it, and the next
      // `restore()` is the server's chance to disagree.
    }
  }

  me = () => this.send('/api/auth/me', meSchema);

  /** Drops the token without telling the server. For a 401 we already know about. */
  forget(): void {
    this.token = null;
  }

  /* ── choosing a galaxy ────────────────────────────────────── */

  /** Public. A player may read the state of the world before making an account. */
  servers = () => this.send('/api/servers', serverListSchema);

  joinServer = (code: string) =>
    this.send(`/api/servers/${encodeURIComponent(code)}/join`, placementSchema, {
      method: 'POST',
    });

  /* ── world ────────────────────────────────────────────────── */

  season = () => this.send('/api/season', seasonSchema);
  planet = () => this.send('/api/planet', planetSchema);
  galaxy = () => this.send('/api/galaxy', galaxySchema);
  traffic = () => this.send('/api/galaxy/traffic', trafficSchema);
  leaderboard = () => this.send('/api/leaderboard', leaderboardSchema);
  intel = () => this.send('/api/intel', intelSchema);
  /** The closing link of the loop: what a fight actually taught you. */
  reports = () => this.send('/api/reports?limit=20', reportsSchema);

  upgrade = (type: BuildingId) =>
    this.send('/api/planet/upgrade', upgradeSchema, { method: 'POST', body: { type } });

  build = (hull: HullId, count: number) =>
    this.send('/api/planet/build', buildSchema, { method: 'POST', body: { hull, count } });

  /** Raise one of the four on the ground. D25. */
  raiseInstrument = (type: InstrumentId) =>
    this.send('/api/planet/instrument', instrumentRaiseSchema, { method: 'POST', body: { type } });

  /** Put one of the four in orbit. Bought once — there is no second call. D25. */
  installSatellite = (type: SatelliteId) =>
    this.send('/api/planet/satellite', satelliteInstallSchema, { method: 'POST', body: { type } });

  /** IRREVERSIBLE. There is no recall endpoint, by design. */
  launch = (targetPlanetId: string, fleet: Fleet) =>
    this.send('/api/fleet/launch', launchSchema, {
      method: 'POST',
      body: { targetPlanetId, fleet },
    });

  watch = (targetPlanetId: string, slot: number) =>
    this.send('/api/intel/watch', watchSchema, {
      method: 'POST',
      body: { targetPlanetId, slot },
    });

  /** Empty the works into storage. D16 — the one manual step in the economy. */
  collect = () => this.send('/api/planet/collect', collectSchema, { method: 'POST' });

  mining = () => this.send('/api/mining', miningSchema);

  mine = (asteroidIndex: number, craft: number) =>
    this.send('/api/mining/launch', miningLaunchSchema, {
      method: 'POST',
      body: { asteroidIndex, craft },
    });

  /** Send craft to a wreck field. D32 — the same craft, a different errand. */
  harvest = (fieldId: string, craft: number) =>
    this.send('/api/mining/harvest', miningLaunchSchema, {
      method: 'POST',
      body: { fieldId, craft },
    });

  probe = (targetPlanetId: string) =>
    this.send('/api/intel/probe', probeSchema, { method: 'POST', body: { targetPlanetId } });

  /* ── session ──────────────────────────────────────────────── */

  /** Reading this advances `lastSeenAt` server-side. Call it once per session. */
  returnPayload = () => this.send('/api/session/return', returnSchema);
  /** Safe to poll — unlike `returnPayload`, reading this changes nothing. */
  pending = () => this.send('/api/session/pending', pendingSchema);
  unlocks = () => this.send('/api/session/unlocks', unlocksSchema);
  notifications = () => this.send('/api/notifications?limit=30', notificationsSchema);

  markSeen = (ids?: string[]) =>
    this.send('/api/notifications/seen', markedSchema, {
      method: 'POST',
      body: ids ? { ids } : {},
    });

  /**
   * The event stream.
   *
   * Not `EventSource`: that cannot send an Authorization header, and the only
   * alternative would be putting the access token in a query string, where it
   * lands in every proxy log on the way.
   */
  async stream(onEvent: (kind: string) => void, signal: AbortSignal): Promise<void> {
    const open = (): Promise<Response> =>
      this.http(`${this.baseUrl}/api/stream`, {
        headers: this.token ? { authorization: `Bearer ${this.token}` } : {},
        credentials: 'same-origin',
        signal,
      });

    /**
     * THE STREAM REFRESHES ITS OWN CREDENTIAL. D45.
     *
     * `send()` has always retried a 401 through `restore()`; this did not, and an
     * access token lives fifteen minutes. So any reconnect after the token expired
     * — a phone waking up, a proxy dropping an idle socket, a server restart —
     * failed, and the backoff loop then retried with the SAME dead token. Live
     * updates came back only when some unrelated query happened to refresh, which
     * is a recovery path nobody designed and nobody can see.
     */
    let res = await open();
    if (res.status === 401 && (await this.restore())) res = await open();
    if (!res.ok || !res.body) throw new ApiError('STREAM_FAILED', 'Stream unavailable', res.status);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (!signal.aborted) {
      const { done, value } = await reader.read();
      if (done) return;
      buffer += decoder.decode(value, { stream: true });

      // SSE frames are separated by a blank line; a partial frame stays buffered.
      let split = buffer.indexOf('\n\n');
      while (split !== -1) {
        const frame = buffer.slice(0, split);
        buffer = buffer.slice(split + 2);
        const kind = frame
          .split('\n')
          .find((line) => line.startsWith('event:'))
          ?.slice(6)
          .trim();
        if (kind) onEvent(kind);
        split = buffer.indexOf('\n\n');
      }
    }
  }
}

function errorShape(body: unknown): { error: string; message: string } {
  if (body && typeof body === 'object') {
    const record: Record<string, unknown> = { ...body };
    const error = typeof record.error === 'string' ? record.error : 'UNKNOWN';
    const message =
      typeof record.message === 'string' ? record.message : 'Something went wrong';
    return { error, message };
  }
  return { error: 'UNKNOWN', message: 'Something went wrong' };
}
