import type { z } from 'zod';
import type {
  Fleet,
  BuildingId,
  HullId,
  InstrumentId,
  ResearchProjectId,
  Resources,
  SatelliteId,
} from '@astera/rules';
import { noteServerTime } from '../lib/clock.js';
import {
  adminFeedbackPageSchema,
  announcementPublishedSchema,
  announcementsPageSchema,
  claimSchema,
  type ClaimIntent,
  clanAidLaunchSchema,
  clanAidPolicySchema,
  clanAidQuoteSchema,
  clanAidSchema,
  clanBadgeSchema,
  clanChatPageSchema,
  clanChatPostSchema,
  clanChatReadSchema,
  clanCreatedSchema,
  clanDepotClaimSchema,
  clanDepotSchema,
  clanDirectorySchema,
  clanDisbandSchema,
  clanEventsPageSchema,
  clanHomeSchema,
  clanKickSchema,
  clanLeadershipSchema,
  clanLeaderboardSchema,
  clanLeaveSchema,
  clanRequestAcceptedSchema,
  clanRequestClosedSchema,
  clanRequestCreatedSchema,
  clanSeenSchema,
  clanSettingsSchema,
  clanStrengthSchema,
  collectSchema,
  galaxySchema,
  intelSchema,
  miningLaunchSchema,
  miningFieldSchema,
  miningSchema,
  miningStatusSchema,
  launchSchema,
  leaderboardSchema,
  chatPageSchema,
  chatPostSchema,
  chatReadSchema,
  chatUnreadSchema,
  chroniclePageSchema,
  meSchema,
  notificationsSchema,
  okSchema,
  pendingSchema,
  placementSchema,
  planetSchema,
  planetsSchema,
  movementLaunchSchema,
  deathStarBuildSchema,
  interceptorBuildSchema,
  deathStarLaunchSchema,
  previewSchema,
  probeSchema,
  reportsSchema,
  researchCompleteSchema,
  rewardClaimSchema,
  rewardsSchema,
  returnSchema,
  instrumentRaiseSchema,
  satelliteInstallSchema,
  seasonSchema,
  rivalSetSchema,
  serverListSchema,
  sessionSchema,
  trafficSchema,
  buildSchema,
  buildCancelSchema,
  markedSchema,
  unlocksSchema,
  upgradeSchema,
  watchSchema,
  feedbackSubmittedSchema,
} from './schemas.js';
import type { FeedbackKind } from './schemas.js';

/** The figures a refusal was built from, as the server sent them. */
export type ErrorParams = Record<string, string | number>;

/**
 * The API's single error shape, preserved so the UI can act on the code.
 *
 * `params` is what makes a refusal translatable. `message` arrives with its
 * numbers already interpolated into English and can only be shown as-is; the code
 * plus its params is the same fact in a form `i18n/errors.ts` can say again in
 * another language. Absent on the refusals that have no figures in them, and on
 * anything an older server sends.
 */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly params?: ErrorParams,
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
  /** One logical write keeps this key across an automatic token refresh retry. */
  idempotencyKey?: string;
  /** Refresh tokens are only ever exchanged by `restore()`; never recurse into it. */
  retryOnExpiry?: boolean;
}

/**
 * Browser-native when possible; the fallback is still unique enough for one tab.
 *
 * `randomUUID` EXISTS ONLY IN A SECURE CONTEXT, and the DOM types do not say so —
 * they declare `crypto` and `randomUUID` as always present. A phone opening the dev
 * server over plain http on the LAN has `crypto` without `randomUUID`, and some
 * embedded webviews have neither. The widened type is what makes the guard honest
 * rather than something the linter is entitled to delete.
 */
const newIdempotencyKey = (): string => {
  // Read through the weaker shape rather than the ambient DOM declaration: this is
  // not a cast to silence the compiler, it is the narrower truth about the runtime.
  const { crypto } = globalThis as { crypto?: { randomUUID?: () => string } };
  return crypto?.randomUUID?.()
    ?? `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};

export interface ClanAidInput {
  originPlanetId: string;
  recipientPlayerId: string;
  targetPlanetId: string;
  fleet: Fleet;
  cargo: Resources;
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

  /**
   * `T` IS WHAT THE SCHEMA PRODUCES, NEVER WHAT IT ACCEPTS.
   *
   * `z.ZodType<T>` is `ZodType<T, ZodTypeDef, T>` — it demands that a schema's
   * input and output be the same type. The moment a field carries `.default()`
   * they stop being: the input has it optional and the output guarantees it. TS
   * cannot satisfy both positions, so it settled on the INPUT, and every caller
   * was handed `boolean | undefined` for a field `parse` had already filled in.
   *
   * It shipped: `capturable` on a Death Star chronicle entry has been optional at
   * the call site since D98 while zod has been defaulting it to `true` all along.
   * Widening the input slot to `unknown` binds `T` to the output, which is the
   * only side a caller of `parse` ever sees.
   */
  private async send<T>(
    path: string,
    schema: z.ZodType<T, z.ZodTypeDef, unknown>,
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
        ...(opts.idempotencyKey ? { 'idempotency-key': opts.idempotencyKey } : {}),
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
      throw new ApiError(parsed.error, parsed.message, res.status, parsed.params);
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

  /* ── announcements and feedback ─────────────────────────── */

  announcements = () => this.send('/api/announcements', announcementsPageSchema);
  markAnnouncementsRead = (ids: string[]) =>
    this.send('/api/announcements/read', markedSchema, { method: 'POST', body: { ids } });
  sendFeedback = (kind: FeedbackKind, message: string) =>
    this.send('/api/feedback', feedbackSubmittedSchema, { method: 'POST', body: { kind, message } });
  adminFeedback = () => this.send('/api/admin/feedback', adminFeedbackPageSchema);
  publishAnnouncement = (title: string, bodyHtml: string) =>
    this.send('/api/admin/announcements', announcementPublishedSchema, {
      method: 'POST',
      body: { title, bodyHtml },
    });

  /* ── the rehearsal, and claiming it ───────────────────────── */

  /**
   * The frontier galaxy, before there is anybody to ask on behalf of. D56.
   *
   * Public, so no token and nothing to refresh. This is the whole of what the
   * rehearsal stands on: one payload, and a clock — every leg on the disc is drawn
   * by interpolating between instants the contacts already carry, so the galaxy
   * keeps moving for as long as a visitor watches it with no stream and no poll.
   */
  preview = () => this.send('/api/preview', previewSchema, { retryOnExpiry: false });

  /**
   * Turn the rehearsal into a season: an account, a seat, and every decision
   * replayed by the server that will hold them.
   *
   * `intents` is what the visitor DID, never what the rehearsal computed. The
   * client's copy of the outcome was a prediction made with the same
   * `@astera/rules` the server validates against; this call is where it becomes
   * true, or is refused and says which step and why.
   */
  async claim(username: string, password: string, intents: readonly ClaimIntent[]) {
    const claimed = await this.send('/api/onboarding/claim', claimSchema, {
      method: 'POST',
      body: { username, password, intents },
      retryOnExpiry: false,
    });
    this.token = claimed.accessToken;
    return claimed;
  }

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
  setRival = (planetId: string | null) =>
    this.send('/api/rival', rivalSetSchema, { method: 'POST', body: { planetId } });
  planets = () => this.send('/api/planets', planetsSchema);
  planet = (planetId?: string) => this.send(
    planetId ? `/api/planets/${encodeURIComponent(planetId)}` : '/api/planet',
    planetSchema,
  );
  galaxy = () => this.send('/api/galaxy', galaxySchema);
  traffic = () => this.send('/api/galaxy/traffic', trafficSchema);
  leaderboard = () => this.send('/api/leaderboard', leaderboardSchema);

  /* ── clans ───────────────────────────────────────────────── */

  clanBadge = () => this.send('/api/clan/badge', clanBadgeSchema);
  clanHome = () => this.send('/api/clan/me', clanHomeSchema);
  clanStrength = () => this.send('/api/clan/strength', clanStrengthSchema);
  clans = (search = '', offset = 0, limit = 30) => {
    const query = new URLSearchParams({ offset: String(offset), limit: String(limit) });
    if (search.trim()) query.set('search', search.trim());
    return this.send(`/api/clans?${query.toString()}`, clanDirectorySchema);
  };
  clanLeaderboard = () => this.send('/api/clans/leaderboard', clanLeaderboardSchema);
  clanEvents = (before?: string) => this.send(
    `/api/clan/events?limit=30${before ? `&before=${encodeURIComponent(before)}` : ''}`,
    clanEventsPageSchema,
  );
  clanDepot = () => this.send('/api/clan/depot', clanDepotSchema);
  clanAid = () => this.send('/api/clan/aid', clanAidSchema);
  clanChat = (before?: string) => this.send(
    `/api/clan/chat?limit=50${before ? `&before=${encodeURIComponent(before)}` : ''}`,
    clanChatPageSchema,
  );

  private clanMutation<T>(
    path: string,
    schema: z.ZodType<T, z.ZodTypeDef, unknown>,
    body: Record<string, unknown> = {},
  ): Promise<T> {
    return this.send(path, schema, {
      method: 'POST',
      body,
      idempotencyKey: newIdempotencyKey(),
    });
  }

  quoteClanAid = (input: ClanAidInput) =>
    this.send('/api/clan/aid/quote', clanAidQuoteSchema, { method: 'POST', body: { ...input } });
  createClan = (input: { name: string; tag: string; description: string; recruiting: boolean }) =>
    this.clanMutation('/api/clan/create', clanCreatedSchema, input);
  applyToClan = (clanId: string) =>
    this.clanMutation(`/api/clans/${encodeURIComponent(clanId)}/apply`, clanRequestCreatedSchema);
  inviteToClan = (playerId: string) =>
    this.clanMutation('/api/clan/invite', clanRequestCreatedSchema, { playerId });
  acceptClanRequest = (requestId: string, acknowledgeHostile = false) =>
    this.clanMutation(
      `/api/clan/requests/${encodeURIComponent(requestId)}/accept`,
      clanRequestAcceptedSchema,
      { acknowledgeHostile },
    );
  rejectClanRequest = (requestId: string) =>
    this.clanMutation(
      `/api/clan/requests/${encodeURIComponent(requestId)}/reject`,
      clanRequestClosedSchema,
    );
  withdrawClanRequest = (requestId: string) =>
    this.clanMutation(
      `/api/clan/requests/${encodeURIComponent(requestId)}/withdraw`,
      clanRequestClosedSchema,
    );
  leaveClan = () => this.clanMutation('/api/clan/leave', clanLeaveSchema);
  kickClanMember = (playerId: string) =>
    this.clanMutation('/api/clan/kick', clanKickSchema, { playerId });
  transferClanLeadership = (playerId: string) =>
    this.clanMutation('/api/clan/leadership', clanLeadershipSchema, { playerId });
  updateClanSettings = (description: string, recruiting: boolean) =>
    this.clanMutation('/api/clan/settings', clanSettingsSchema, { description, recruiting });
  setClanAidPolicy = (enabled: boolean) =>
    this.clanMutation('/api/clan/aid-policy', clanAidPolicySchema, { enabled });
  disbandClan = () => this.clanMutation('/api/clan/disband', clanDisbandSchema);
  claimClanDepot = () => this.clanMutation('/api/clan/depot/claim', clanDepotClaimSchema);
  launchClanAid = (input: ClanAidInput) =>
    this.clanMutation('/api/clan/aid/launch', clanAidLaunchSchema, { ...input });
  postClanChat = (content: string) =>
    this.clanMutation('/api/clan/chat/messages', clanChatPostSchema, { content });
  markClanChatRead = (messageId: string) =>
    this.clanMutation('/api/clan/chat/read', clanChatReadSchema, { messageId });
  markClanSeen = () => this.clanMutation('/api/clan/read', clanSeenSchema);

  chatMessages = (before?: string) =>
    this.send(`/api/chat/messages?limit=50${before ? `&before=${encodeURIComponent(before)}` : ''}`, chatPageSchema);
  postChat = (content: string) =>
    this.send('/api/chat/messages', chatPostSchema, { method: 'POST', body: { content } });
  chatUnread = () => this.send('/api/chat/unread', chatUnreadSchema);
  markChatRead = (messageId: string) =>
    this.send('/api/chat/read', chatReadSchema, { method: 'POST', body: { messageId } });
  chronicle = (before?: string) =>
    this.send(`/api/chronicle?limit=30${before ? `&before=${encodeURIComponent(before)}` : ''}`, chroniclePageSchema);
  intel = () => this.send('/api/intel', intelSchema);
  /** The closing link of the loop: what a fight actually taught you. */
  reports = () => this.send('/api/reports?limit=50', reportsSchema);

  upgrade = (planetIdOrType: string, explicitType?: BuildingId) => {
    const type = explicitType ?? planetIdOrType as BuildingId;
    const path = explicitType
      ? `/api/planets/${encodeURIComponent(planetIdOrType)}/upgrade`
      : '/api/planet/upgrade';
    return this.send(path, upgradeSchema, { method: 'POST', body: { type } });
  };

  build = (planetIdOrHull: string, explicitHullOrCount: HullId | number, explicitCount?: number) => {
    const hull = (explicitCount === undefined ? planetIdOrHull : explicitHullOrCount) as HullId;
    const count = explicitCount ?? explicitHullOrCount as number;
    const path = explicitCount === undefined
      ? '/api/planet/build'
      : `/api/planets/${encodeURIComponent(planetIdOrHull)}/build`;
    return this.send(path, buildSchema, { method: 'POST', body: { hull, count } });
  };

  cancelBuildOrder = (planetIdOrOrderId: string, explicitOrderId?: string) => {
    const orderId = explicitOrderId ?? planetIdOrOrderId;
    const path = explicitOrderId
      ? `/api/planets/${encodeURIComponent(planetIdOrOrderId)}/build-orders/${encodeURIComponent(orderId)}/cancel`
      : `/api/planet/build-orders/${encodeURIComponent(orderId)}/cancel`;
    return this.send(path, buildCancelSchema, { method: 'POST' });
  };

  completeResearch = (planetIdOrProject: string, explicitProject?: ResearchProjectId) =>
    this.send(explicitProject
      ? `/api/planets/${encodeURIComponent(planetIdOrProject)}/research`
      : '/api/planet/research', researchCompleteSchema, {
      method: 'POST',
      body: { projectId: explicitProject ?? planetIdOrProject as ResearchProjectId },
    });

  /** Raise one of the four on the ground. D25. */
  raiseInstrument = (planetIdOrType: string, explicitType?: InstrumentId) =>
    this.send(explicitType
      ? `/api/planets/${encodeURIComponent(planetIdOrType)}/instrument`
      : '/api/planet/instrument', instrumentRaiseSchema, {
      method: 'POST', body: { type: explicitType ?? planetIdOrType as InstrumentId },
    });

  /** Put one of the four in orbit. Bought once — there is no second call. D25. */
  installSatellite = (planetIdOrType: string, explicitType?: SatelliteId) =>
    this.send(explicitType
      ? `/api/planets/${encodeURIComponent(planetIdOrType)}/satellite`
      : '/api/planet/satellite', satelliteInstallSchema, {
      method: 'POST', body: { type: explicitType ?? planetIdOrType as SatelliteId },
    });

  /** IRREVERSIBLE. There is no recall endpoint, by design. */
  launch = (originOrTargetPlanetId: string, targetOrFleet: string | Fleet, explicitFleet?: Fleet) =>
    this.send('/api/fleet/launch', launchSchema, {
      method: 'POST',
      body: explicitFleet
        ? { originPlanetId: originOrTargetPlanetId, targetPlanetId: targetOrFleet, fleet: explicitFleet }
        : { targetPlanetId: originOrTargetPlanetId, fleet: targetOrFleet },
    });

  watch = (targetPlanetId: string, slot: number, observerPlanetId?: string) =>
    this.send('/api/intel/watch', watchSchema, {
      method: 'POST',
      body: { targetPlanetId, slot, ...(observerPlanetId ? { observerPlanetId } : {}) },
    });

  /** Empty the works into storage. D16 — the one manual step in the economy. */
  collect = (planetId?: string) => this.send(
    planetId ? `/api/planets/${encodeURIComponent(planetId)}/collect` : '/api/planet/collect',
    collectSchema,
    { method: 'POST' },
  );

  transfer = (originPlanetId: string, targetPlanetId: string, fleet: Fleet, cargo: { alloy: number; crystal: number; deuterium: number }) =>
    this.send('/api/fleet/transfer', movementLaunchSchema, {
      method: 'POST', body: { originPlanetId, targetPlanetId, fleet, cargo },
    });

  settle = (originPlanetId: string, targetPlanetId: string) =>
    this.send('/api/fleet/settle', movementLaunchSchema, {
      method: 'POST', body: { originPlanetId, targetPlanetId },
    });

  buildDeathStar = (planetId: string) =>
    this.send(`/api/planets/${encodeURIComponent(planetId)}/death-star/build`, deathStarBuildSchema, {
      method: 'POST', body: {},
    });

  buildInterceptor = (planetId: string) =>
    this.send(`/api/planets/${encodeURIComponent(planetId)}/interceptor/build`, interceptorBuildSchema, {
      method: 'POST', body: {},
    });

  launchDeathStar = (originPlanetId: string, targetPlanetId: string) =>
    this.send('/api/death-star/launch', deathStarLaunchSchema, {
      method: 'POST', body: { originPlanetId, targetPlanetId },
    });

  rewards = () => this.send('/api/rewards', rewardsSchema);

  /**
   * `send()` serialises. A second `JSON.stringify` here would be a compile error,
   * which is the point of the rule.
   */
  claimReward = (id: string) =>
    this.send('/api/rewards/claim', rewardClaimSchema, { method: 'POST', body: { id } });

  mining = (planetId?: string) => this.send(
    `/api/mining${planetId ? `?planetId=${encodeURIComponent(planetId)}` : ''}`,
    miningSchema,
  );

  miningField = () => this.send('/api/mining/field', miningFieldSchema);

  miningStatus = (planetId?: string) => this.send(
    `/api/mining/status${planetId ? `?planetId=${encodeURIComponent(planetId)}` : ''}`,
    miningStatusSchema,
  );

  mine = (asteroidId: string, craft: number, originPlanetId?: string) =>
    this.send('/api/mining/launch', miningLaunchSchema, {
      method: 'POST',
      body: { asteroidId, craft, ...(originPlanetId ? { originPlanetId } : {}) },
    });

  /** Send craft to a wreck field. D32 — the same craft, a different errand. */
  harvest = (fieldId: string, craft: number, originPlanetId?: string) =>
    this.send('/api/mining/harvest', miningLaunchSchema, {
      method: 'POST',
      body: { fieldId, craft, ...(originPlanetId ? { originPlanetId } : {}) },
    });

  probe = (targetPlanetId: string, originPlanetId?: string) =>
    this.send('/api/intel/probe', probeSchema, {
      method: 'POST', body: { targetPlanetId, ...(originPlanetId ? { originPlanetId } : {}) },
    });

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
   *
   * `onOpen` FIRES WHEN THE SOCKET IS ACTUALLY UP, which is a different fact from
   * "this function was called". Everything on this channel is fire-and-forget —
   * there is no replay, no cursor and no backlog — so events that happened while
   * the connection was down are simply GONE. The caller needs to know the instant
   * it can start trusting the channel again, because that is the instant it has to
   * go and re-read the world it stopped hearing about. See `useEventStream`.
   */
  async stream(
    onEvent: (kind: string) => void,
    signal: AbortSignal,
    onOpen?: () => void,
  ): Promise<void> {
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

    // Headers are in and the body is open: from here the client hears everything.
    onOpen?.();

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

function errorShape(body: unknown): { error: string; message: string; params?: ErrorParams } {
  if (body && typeof body === 'object') {
    const record: Record<string, unknown> = { ...body };
    const error = typeof record.error === 'string' ? record.error : 'UNKNOWN';
    const message =
      typeof record.message === 'string' ? record.message : 'Something went wrong';
    const params = readParams(record.params);
    return { error, message, ...(params === undefined ? {} : { params }) };
  }
  return { error: 'UNKNOWN', message: 'Something went wrong' };
}

/**
 * Untrusted, so every entry is checked rather than cast.
 *
 * These land in `i18n.t(...)` as interpolation VALUES and never as a key, so the
 * worst a hostile server could do is print a string — but a nested object or an
 * array reaching the formatter would render as `[object Object]` in the middle of
 * a sentence, and that is a real thing a mismatched deploy can produce. Anything
 * that is not a string or a finite number is dropped.
 */
function readParams(value: unknown): ErrorParams | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const out: ErrorParams = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === 'string') out[key] = entry;
    else if (typeof entry === 'number' && Number.isFinite(entry)) out[key] = entry;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
