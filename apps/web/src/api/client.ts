import type { z } from 'zod';
import type { Fleet, BuildingId, HullId, SatelliteId } from '@blindspace/rules';
import {
  galaxySchema,
  intelSchema,
  launchSchema,
  leaderboardSchema,
  notificationsSchema,
  pendingSchema,
  placementSchema,
  planetSchema,
  probeSchema,
  reportsSchema,
  returnSchema,
  satelliteInstallSchema,
  seasonSchema,
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
  body?: unknown;
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

    if (res.status === 401 && (opts.retryOnExpiry ?? true)) {
      if (await this.restore()) {
        return this.send(path, schema, { ...opts, retryOnExpiry: false });
      }
    }

    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) {
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

  async signInAsGuest(displayName?: string) {
    const session = await this.send('/api/auth/guest', sessionSchema, {
      method: 'POST',
      body: displayName ? { displayName } : {},
      retryOnExpiry: false,
    });
    this.token = session.accessToken;
    return session;
  }

  /* ── world ────────────────────────────────────────────────── */

  join = () => this.send('/api/season/join', placementSchema, { method: 'POST' });
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
    const res = await this.http(`${this.baseUrl}/api/stream`, {
      headers: this.token ? { authorization: `Bearer ${this.token}` } : {},
      credentials: 'same-origin',
      signal,
    });
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
