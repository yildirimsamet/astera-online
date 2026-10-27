import { commanderShipSchema } from './commanderShipSchemas.js';
import { communityPolicyConsentSchema, communityPolicyStatusSchema, type CommunityPolicyConsent } from './communityPolicySchemas.js';
import { buildHeader, reportUpdateRequired } from '../platform/updateGate.js';
import { accountSecuritySchema, securityChallengeSchema, securityCompleteSchema, accountDeletionStatusSchema, accountDeletionSubmittedSchema } from './schemas.js';
import { contentReportReceiptSchema, contentReportQueueSchema, contentReportDecisionSchema, communityBlocksSchema, communityBlockResultSchema, type ReportTarget, type ReportReason } from './contentReportSchemas.js';
import { unknownSignalsSchema, unknownSignalDetailsSchema, unknownSignalLaunchSchema, unknownSignalRecallSchema } from './schemas.js';
import { COSMETIC_IDS, type CosmeticCategory, type CosmeticId, type MobileHullId } from '@astera/rules';
import { cosmeticEquipSchema } from './schemas.js';
import { vacationSchema } from './schemas.js';
import { honorTargetSchema } from './schemas.js';
import { returnStatusSchema } from './schemas.js';
import { z } from 'zod';
import type {
  Fleet,
  BuildingId,
  HullId,
  InstrumentId,
  ResearchProjectId,
  Resources,
  HpDamageLots,
  HonorBenefitTier,
  SatelliteId,
  PlanetSkinId,
  ChatLanguage,
  ReactionEmoji,
  ChatMedia,
  CountryCode,
  MissionPace,
  TransferReturnPlan,
} from '@astera/rules';
import { noteServerTime } from '../lib/clock.js';
import { capabilities } from '../platform/runtime.js';
import { createNativeAuthTransport, isSessionPath, type AuthTransport } from '../platform/authTransport.js';
import { CHAT_MEDIA } from '@astera/rules';
import { adminArenaPilotSchema, adminArenaPilotsSchema, adminChatScopesSchema, adminPlayersSchema, adminMuteSchema, adminMaskSchema, type AdminMuteInput, type AdminMaskInput } from './adminSchemas.js';
import { adminDeletionQueueSchema, adminDeletionCompletedSchema, adminDeletionMediaSchema } from './adminSchemas.js';
import {
  tradeRecallSchema,
  adminFeedbackPageSchema,
  skinGrantedSchema,
  supporterStatusSchema,
  activeGalaxyEventsSchema,
  announcementPublishedSchema,
  announcementsPageSchema,
  claimSchema,
  colonyAbandonmentSchema,
  colonyAbandonedSchema,
  type ClaimIntent,
  clanAidLaunchSchema,
  clanAidPolicySchema,
  clanAidQuoteSchema,
  clanAidSchema,
  clanSupportQuoteSchema,
  clanSupportSendSchema,
  clanSupportWaveAnswerSchema,
  clanWarSchema,
  clanWarQuoteSchema,
  defencePostureResultSchema,
  mySupportSchema,
  clanWarTargetResultSchema,
  clanWarStartResultSchema,
  clanWarRecallResultSchema,
  clanWarContributionResultSchema,
  clanTreasuryResultSchema,
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
  publicClanSchema,
  clanLeaveSchema,
  clanRequestAcceptedSchema,
  clanRequestClosedSchema,
  clanRequestCreatedSchema,
  clanSeenSchema,
  clanSettingsSchema,
  clanStrengthSchema,
  collectSchema,
  countryUpdatedSchema,
  galaxySchema,
  monumentsSchema,
  monumentQuoteSchema,
  monumentSendSchema,
  monumentProbeLaunchSchema,
  monumentRecallQuoteSchema,
  monumentRecallSchema,
  skinCollectionSchema,
  skinShopSchema,
  skinPricingSchema,
  skinPurchaseSchema,
  polarShopSchema,
  polarPricingSchema,
  polarPurchaseSchema,
  shopierShopSchema,
  shopierCodeSchema,
  shopierQueueSchema,
  shopierOrderActionSchema,
  shopierSyncSchema,
  skinEquipSchema,
  intelSchema,
  miningLaunchSchema,
  miningRecallSchema,
  miningFieldSchema,
  piratesSchema,
  pirateRaidSchema,
  pirateRecallSchema,
  tradeLaunchSchema,
  miningSchema,
  miningStatusSchema,
  launchSchema,
  leaderboardSchema,
  seasonArchiveSchema,
  seasonArchiveLeaderboardSchema,
  seasonCommanderProfileSchema,
  chatPageSchema,
  chatPostSchema,
  messageReactionResultSchema,
  chatMediaUploadSchema,
  messageReactionDetailsSchema,
  chatReadSchema,
  chatUnreadSchema,
  dmContactsSchema,
  dmConversationsSchema,
  dmPageSchema,
  dmPostSchema,
  dmReadSchema,
  dmBlockSchema,
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
  radiationBombBuildSchema,
  radiationBombLaunchSchema,
  interceptorBuildSchema,
  faultRepairSchema,
  deathStarLaunchSchema,
  previewSchema,
  probeSchema,
  reportsSchema,
  researchCompleteSchema,
  rewardClaimSchema,
  brandRecallSchema,
  brandRecallAnswerSchema,
  rewardsSchema,
  returnSchema,
  returnSeenSchema,
  instrumentRaiseSchema,
  intergalacticConvoyLaunchSchema,
  satelliteInstallSchema,
  seasonSchema,
  rivalSetSchema,
  serverListSchema,
  sessionSchema,
  trafficSchema,
  buildSchema,
  repairStartSchema,
  maintenanceSchema,
  buildCancelSchema,
  markedSchema,
  unlocksSchema,
  upgradeSchema,
  watchSchema,
  feedbackSubmittedSchema,
  perfSessionSavedSchema,
} from './schemas.js';
import type { FeedbackKind } from './schemas.js';
import type { PerfPayload } from '../lib/perfSession.js';
import { gatedRead } from './gatedRead.js';

/** The least time between two reads of the whole galaxy or the whole ladder. */
const BIG_READ_GAP_MS = 5_000;

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
  authTransport?: AuthTransport | null;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  signal?: AbortSignal;
  headers?: Readonly<Record<string, string>>;
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
export const createIdempotencyKey = (): string => {
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

export type MaintenanceSelection = { source: 'HOME'; groups: HpDamageLots }
  | { source: 'DOCK'; lots: { id: string; count: number; damageBp?: number; remainderBp?: number }[] };
export type MaintenanceAction = 'DOCK' | 'RETURN' | 'SCRAP';
export type RepairRequest = ({ lotIds: string[] } | { all: true }
  | { lots: { id: string; count: number; damageBp: number; remainderBp: number }[] }) & { expectedHonorTier?: HonorBenefitTier };

export interface MonumentSendInput {
  originPlanetId: string;
  fleet: Fleet;
  purpose: 'ATTACK' | 'REINFORCE';
  acknowledgeShieldLoss?: boolean;
  acknowledgeRadiationLoss?: boolean;
  /** The commander ship escorts the wave out (Y9). */
  admiral?: boolean;
}
export interface MonumentRecallSelection { lotId: string; count: number }
export type FlightRecallInput =
  | { missionId: string; pirate?: boolean; monument?: never; trade?: never; unknownSignal?: never }
  | { missionId: string; pirate?: never; monument: true; trade?: never; unknownSignal?: never }
  | { missionId: string; pirate?: never; monument?: never; trade: true; unknownSignal?: never }
  | { missionId: string; pirate?: never; monument?: never; trade?: never; unknownSignal: true };

export interface IntergalacticConvoyLaunchInput {
  originPlanetId: string;
  occurrenceId: string;
  fleet: Fleet;
  quotedAt: Date;
  quotedFlightSeconds: number;
  quotedArriveAt: Date;
  acknowledgeRadiationLoss?: boolean;
  expectedHonorTier?: HonorBenefitTier;
}

/**
 * Everything the client knows how to ask for.
 *
 * Access tokens live in memory. Web refresh uses an HttpOnly cookie; bundled apps
 * use the narrow native transport and encrypted native storage. Neither exposes
 * a durable refresh credential to JavaScript. Short access still requires XSS defences.
 */
export class Api {
  private readonly http: typeof globalThis.fetch;
  private readonly baseUrl: string;
  private readonly auth: AuthTransport | null;
  private token: string | null = null;
  private sessionAccountId: string | null = null;
  private emailForLogin: string | undefined;
  private sessionGeneration = 0;
  private readonly mediaCleanups = new Set<() => void>();
  private readonly sessionListeners = new Set<(reason: 'email' | 'password' | 'expired', loginEmail?: string) => void>();

  onSessionEnded(listener: (reason: 'email' | 'password' | 'expired', loginEmail?: string) => void): () => void {
    this.sessionListeners.add(listener);
    return () => { this.sessionListeners.delete(listener); };
  }

  endSession(reason: 'email' | 'password' | 'expired', loginEmail?: string): void {
    const hint = z.string().trim().toLowerCase().email().safeParse(loginEmail);
    this.sessionGeneration++;
    this.clearMedia();
    this.token = null;
    this.sessionAccountId = null;
    this.emailForLogin = undefined;
    this.placement = null;
    this.clearNativeAuth();
    for (const listener of this.sessionListeners) {
      if (hint.success) listener(reason, hint.data);
      else listener(reason);
    }
  }
  private placement: string | null = null;
  /** Deduped: five queries expiring at once must produce one refresh, not five. */
  private refreshing: Promise<boolean> | null = null;

  constructor(deps: ApiDeps = {}) {
    this.http = deps.fetch ?? globalThis.fetch.bind(globalThis);
    this.auth = deps.authTransport === undefined ? createNativeAuthTransport() : deps.authTransport;
    this.baseUrl = deps.baseUrl ?? (this.auth ? import.meta.env.VITE_ASTERA_API_URL ?? '' : '');
  }

  private clearNativeAuth(): void {
    if (this.auth) void this.auth.clear().catch(() => { console.warn('Native session cleanup failed'); });
  }

  private clearMedia(): void {
    for (const release of this.mediaCleanups) release();
  }

  get mediaNeedsBearer(): boolean { return this.auth !== null; }

  get accessToken(): string | null {
    return this.token;
  }

  get verifiedEmail(): string | undefined {
    return this.emailForLogin;
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
    opts.signal?.throwIfAborted();
    // Defence against an old mounted screen or accidental direct hook/API use.
    // This is a client distribution rule, never proof of platform to the server.
    if (!capabilities().webCheckout && /^\/api\/skins\/(?:shop|pricing|purchase|polar-shop|polar-pricing|polar-purchase|shopier-shop|shopier-code)$/.test(path)) {
      throw new ApiError('CHECKOUT_UNAVAILABLE', 'Web checkout is unavailable in this app', 403);
    }
    /**
     * EVERY ANSWER CARRIES THE SERVER'S CLOCK, so the offset costs no request. D52.
     *
     * The disc is drawn by comparing server timestamps against "now", and "now" used
     * to be the DEVICE's clock — so a phone with a drifted clock drew every fleet at
     * the wrong point of its leg and every countdown at the wrong number. See
     * `lib/clock.ts`. Measured around the call rather than after it, because half
     * the round trip is what has to come back off the sample.
     */
    const sentPlacement = this.placement;
    const generation = this.sessionGeneration;
    const sentAt = Date.now();
    const res = this.auth && isSessionPath(path) ? await this.auth.request(path, opts.body) : await this.http(`${this.baseUrl}${path}`, {
      method: opts.method ?? 'GET',
      headers: {
        ...opts.headers,
        ...(opts.body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
        ...(sentPlacement ? { 'x-placement': sentPlacement } : {}),
        ...(opts.idempotencyKey ? { 'idempotency-key': opts.idempotencyKey } : {}),
        ...buildHeader(),
      },
      ...(opts.body === undefined ? {} : { body: JSON.stringify(opts.body) }),
      // Sends the refresh cookie. Same-origin in dev via the Vite proxy.
      credentials: this.auth ? 'omit' : 'same-origin',
      ...(opts.signal === undefined ? {} : { signal: opts.signal }),
    });
    noteServerTime(res.headers.get('x-server-time'), res.headers.get('date'), sentAt, Date.now());

    const body: unknown = await res.json().catch(() => {
      opts.signal?.throwIfAborted();
      return null;
    });
    opts.signal?.throwIfAborted();
    if (res.status === 426 && errorShape(body).error === 'UPDATE_REQUIRED') reportUpdateRequired();
    if (generation !== this.sessionGeneration) throw new ApiError('SESSION_CHANGED', 'Session changed', 409);
    // A rejected password is an answered credential check, not an expired token.
    if (res.status === 401 && (opts.retryOnExpiry ?? true) && errorShape(body).error !== 'BAD_CREDENTIALS') {
      const restored = await this.restore();
      if (generation !== this.sessionGeneration) throw new ApiError('SESSION_CHANGED', 'Session changed', 409);
      if (restored) return this.send(path, schema, { ...opts, retryOnExpiry: false });
    }
    const receivedPlacement = res.headers.get('x-placement');
    if (path === '/api/auth/me' && res.ok) {
      if (sentPlacement !== this.placement && receivedPlacement !== this.placement) {
        window.dispatchEvent(new Event('astera:placement-changed'));
        throw new ApiError('PLACEMENT_CHANGED', 'Your galaxy changed; refresh and try again', 409);
      }
      this.placement = receivedPlacement;
    }
    else if (res.ok && receivedPlacement) {
      if (this.placement !== null && receivedPlacement !== this.placement) {
        window.dispatchEvent(new Event('astera:placement-changed'));
        throw new ApiError('PLACEMENT_CHANGED', 'Your galaxy changed; refresh and try again', 409);
      }
      this.placement = receivedPlacement;
    }
    if (res.status === 409 && typeof body === 'object' && body !== null && 'error' in body && body.error === 'PLACEMENT_CHANGED') {
      window.dispatchEvent(new Event('astera:placement-changed'));
    }

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

  private adoptSession(session: { accountId: string; accessToken: string; loginEmail?: string | undefined }, generation: number): void {
    if (generation !== this.sessionGeneration) throw new ApiError('SESSION_CHANGED', 'Session changed', 409);
    if (this.sessionAccountId !== session.accountId) this.placement = null;
    this.sessionAccountId = session.accountId;
    this.emailForLogin = session.loginEmail;
    this.token = session.accessToken;
  }

  /** Exchange the refresh cookie for a live token. Only a rejected session returns false. */
  async restore(): Promise<boolean> {
    const generation = this.sessionGeneration;
    this.refreshing ??= (async () => {
      try {
        const session = await this.send('/api/auth/refresh', sessionSchema, {
          method: 'POST',
          retryOnExpiry: false,
        });
        if (generation !== this.sessionGeneration) return false;
        // Another tab may have replaced the shared refresh cookie. Never replay
        // this tab's pending action with that other account's credentials.
        if (this.sessionAccountId !== null && this.sessionAccountId !== session.accountId) {
          this.endSession('expired');
          return false;
        }
        this.adoptSession(session, generation);
        return true;
      } catch (error) {
        if (generation !== this.sessionGeneration) return false;
        // A rate limit or outage says nothing about the cookie's validity. Keep
        // the current identity and let the caller report the retryable failure.
        if (!(error instanceof ApiError) || error.status !== 401) throw error;
        // A first visitor with no refresh cookie never had a session to expire.
        if (this.token !== null || this.placement !== null) this.endSession('expired');
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
  async register(username: string, password: string, countryCode?: CountryCode, policy?: CommunityPolicyConsent) {
    const proof = communityPolicyConsentSchema.safeParse(policy);
    if (!proof.success) throw new ApiError('COMMUNITY_POLICY_REQUIRED', 'Explicit agreement is required', 403);
    const generation = ++this.sessionGeneration;
    this.clearMedia();
    this.emailForLogin = undefined;
    const session = await this.send('/api/auth/register', sessionSchema, {
      method: 'POST',
      body: { username, password, communityPolicyVersion: proof.data.version, communityPolicyLocale: proof.data.locale, ...(countryCode === undefined ? {} : { countryCode }) },
      retryOnExpiry: false,
    });
    this.adoptSession(session, generation);
    return session;
  }

  async login(username: string, password: string) {
    const generation = ++this.sessionGeneration;
    this.clearMedia();
    this.emailForLogin = undefined;
    const session = await this.send('/api/auth/login', sessionSchema, {
      method: 'POST',
      body: { username, password },
      retryOnExpiry: false,
    });
    this.adoptSession(session, generation);
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
    this.sessionGeneration++;
    this.clearMedia();
    this.token = null;
    this.sessionAccountId = null;
    this.emailForLogin = undefined;
    this.placement = null;
    try {
      await this.send('/api/auth/logout', okSchema, { method: 'POST', retryOnExpiry: false });
    } catch {
      // The cookie may survive. Nothing in this tab can use it, and the next
      // `restore()` is the server's chance to disagree.
    }
  }

  returnStatus = () => this.send('/api/return-applications', returnStatusSchema);
  applyToReturn = (placementVersion: number) => this.send('/api/return-applications', returnStatusSchema, {
    method: 'POST', body: { placementVersion },
  });

  security = () => this.send('/api/auth/security', accountSecuritySchema);
  accountDeletion = () => this.send('/api/auth/account-deletion', accountDeletionStatusSchema);
  communityPolicy = () => this.send('/api/community/policy', communityPolicyStatusSchema);
  commanderShip = () => this.send('/api/commander-ship', commanderShipSchema);
  acceptCommunityPolicy = (consent: CommunityPolicyConsent) => this.send('/api/community/policy', communityPolicyStatusSchema, { method: 'POST', body: consent });
  communityBlocks = () => this.send('/api/community/blocks', communityBlocksSchema);
  blockCommunityPlayer = (targetPlayerId: string) => this.send('/api/community/blocks', communityBlockResultSchema, { method: 'POST', body: { targetPlayerId } });
  unblockCommunityAccount = (accountId: string) => this.send(`/api/community/blocks/${encodeURIComponent(accountId)}`, communityBlockResultSchema, { method: 'DELETE' });
  reportContent = (target: ReportTarget, reason: ReportReason, details: string) => this.send('/api/community/reports', contentReportReceiptSchema, { method: 'POST', body: { ...target, reason, details } });
  adminContentReports = () => this.send('/api/admin/content-reports', contentReportQueueSchema);
  adminResolveContentReport = (id: string, action: 'MASK' | 'DISMISS') => this.send(`/api/admin/content-reports/${encodeURIComponent(id)}/resolve`, contentReportDecisionSchema, { method: 'POST', body: { action, confirm: true } });
  requestAccountDeletion = (currentPassword: string, locale: string) => this.send('/api/auth/account-deletion', accountDeletionSubmittedSchema,
    { method: 'POST', body: { currentPassword, locale }, retryOnExpiry: false });
  securityRequest = (email: string, currentPassword: string, locale: string, change = false) => this.send(
    change ? '/api/auth/email/change/request' : '/api/auth/email/request', securityChallengeSchema,
    { method: 'POST', body: { ...(change ? { newEmail: email } : { email }), currentPassword, locale } });
  securityVerify = (challengeId: string, code: string, purpose: 'bind' | 'change_old' | 'change_new') => this.send(
    purpose === 'bind' ? '/api/auth/email/verify' : purpose === 'change_old' ? '/api/auth/email/change/confirm-old' : '/api/auth/email/change/confirm-new',
    securityCompleteSchema, { method: 'POST', body: { challengeId, code } });
  securityResend = (operationId: string) => this.send('/api/auth/email/resend', securityChallengeSchema,
    { method: 'POST', body: { operationId } });
  securityCancel = (operationId: string) => this.send('/api/auth/email/cancel', okSchema,
    { method: 'POST', body: { operationId } });
  resetRequest = (email: string, locale: string) => this.send('/api/auth/password/reset/request', securityChallengeSchema,
    { method: 'POST', body: { email, locale }, retryOnExpiry: false });
  resetComplete = (challengeId: string, code: string, newPassword: string) => this.send('/api/auth/password/reset/complete', securityCompleteSchema,
    { method: 'POST', body: { challengeId, code, newPassword }, retryOnExpiry: false });

  me = () => this.send('/api/auth/me', meSchema);

  updateCountry = (country: CountryCode) => this.send(
    '/api/auth/me/country',
    countryUpdatedSchema,
    { method: 'PUT', body: { country } },
  );

  /* ── announcements and feedback ─────────────────────────── */

  announcements = () => this.send('/api/announcements', announcementsPageSchema);
  markAnnouncementsRead = (ids: string[]) =>
    this.send('/api/announcements/read', markedSchema, { method: 'POST', body: { ids } });
  sendFeedback = (kind: FeedbackKind, message: string) =>
    this.send('/api/feedback', feedbackSubmittedSchema, { method: 'POST', body: { kind, message } });
  adminFeedback = () => this.send('/api/admin/feedback', adminFeedbackPageSchema);
  adminDeletionQueue = () => this.send('/api/admin/account-deletion', adminDeletionQueueSchema);
  adminRecordSupportDeletion = (username: string, locale: string) => this.send('/api/admin/account-deletion', accountDeletionSubmittedSchema,
    { method: 'POST', body: { username, locale, confirm: true } });
  adminApproveDeletion = (requestId: string) => this.send(`/api/admin/account-deletion/${encodeURIComponent(requestId)}/approve`, accountDeletionSubmittedSchema,
    { method: 'POST', body: { confirm: true } });
  adminCompleteDeletion = (requestId: string) => this.send(`/api/admin/account-deletion/${encodeURIComponent(requestId)}/complete`, adminDeletionCompletedSchema,
    { method: 'POST', body: { confirm: true } });
  adminRetryDeletionMedia = (requestId: string) => this.send(`/api/admin/account-deletion/${encodeURIComponent(requestId)}/media-cleanup`, adminDeletionMediaSchema,
    { method: 'POST', body: { confirm: true } });
  adminPlayers = (before?: string) => this.send(`/api/admin/players${before ? `?before=${encodeURIComponent(before)}` : ''}`, adminPlayersSchema);
  adminChatScopes = () => this.send('/api/admin/clans', adminChatScopesSchema);
  adminMute = (input: AdminMuteInput) => this.send('/api/admin/chat/mute', adminMuteSchema, { method: 'POST', body: { ...input } });
  adminMask = (input: AdminMaskInput) => this.send('/api/admin/chat/mask', adminMaskSchema, { method: 'POST', body: { ...input } });
  adminArenaPilots = () => this.send('/api/admin/arena-pilots', adminArenaPilotsSchema);
  adminSetArenaPilot = (username: string, pilot: boolean) =>
    this.send('/api/admin/arena-pilots', adminArenaPilotSchema, { method: 'POST', body: { username, pilot } });
  adminClanChat = (clanId: string, before?: string) => this.send(`/api/admin/clans/${encodeURIComponent(clanId)}/chat${before ? `?before=${encodeURIComponent(before)}` : ''}`, clanChatPageSchema);
  adminPostClanChat = (clanId: string, content: string, replyToMessageId?: string, media?: ChatMedia) =>
    this.send(`/api/admin/clans/${encodeURIComponent(clanId)}/chat`, clanChatPostSchema, { method: 'POST', body: { content, ...(replyToMessageId ? { replyToMessageId } : {}), ...(media ? { media } : {}) } });
  postPerfSession = (session: PerfPayload) =>
    this.send('/api/admin/perf', perfSessionSavedSchema, { method: 'POST', body: { ...session } });
  /** Records a look paid for elsewhere; the same order again is a harmless replay. */
  grantSkin = (username: string, skinId: PlanetSkinId, orderRef: string) =>
    this.send('/api/admin/skins/grant', skinGrantedSchema, {
      method: 'POST',
      body: { username, skinId, orderRef },
    });
  setSupporter = (username: string, supporter: boolean) =>
    this.send('/api/admin/supporters', supporterStatusSchema, { method: 'POST', body: { username, supporter } });
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
  async claim(
    username: string,
    password: string,
    progress: readonly ClaimIntent[] | number,
    countryCode?: CountryCode,
    policy?: CommunityPolicyConsent,
  ) {
    const proof = communityPolicyConsentSchema.safeParse(policy);
    if (!proof.success) throw new ApiError('COMMUNITY_POLICY_REQUIRED', 'Explicit agreement is required', 403);
    const generation = ++this.sessionGeneration;
    this.clearMedia();
    this.emailForLogin = undefined;
    const claimed = await this.send('/api/onboarding/claim', claimSchema, {
      method: 'POST',
      // D172: the server authors the checkpoint; no local resources/fleet travel.
      // Arrays remain readable for the previous rehearsal during migration.
      body: {
        username,
        password,
        communityPolicyVersion: proof.data.version,
        communityPolicyLocale: proof.data.locale,
        ...(countryCode === undefined ? {} : { countryCode }),
        ...(typeof progress === 'number' ? { step: progress } : { intents: progress }),
      },
      retryOnExpiry: false,
    });
    this.adoptSession(claimed, generation);
    return claimed;
  }

  /** Drops the token without telling the server. For a 401 we already know about. */
  forget(): void {
    this.sessionGeneration++;
    this.clearMedia();
    this.token = null;
    this.sessionAccountId = null;
    this.emailForLogin = undefined;
    this.placement = null;
    this.clearNativeAuth();
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
  galaxyEvents = () => this.send('/api/galaxy/events', activeGalaxyEventsSchema);
  setRival = (planetId: string | null) =>
    this.send('/api/rival', rivalSetSchema, { method: 'POST', body: { planetId } });
  planets = (options?: Pick<RequestOptions, 'signal'>) => this.send('/api/planets', planetsSchema, options);
  colonyAbandonment = (planetId: string) =>
    this.send(`/api/planets/${encodeURIComponent(planetId)}/abandon`, colonyAbandonmentSchema);
  abandonColony = (planetId: string) =>
    this.send(`/api/planets/${encodeURIComponent(planetId)}/abandon`, colonyAbandonedSchema, {
      method: 'POST', body: { confirm: true },
    });
  planet = (planetId?: string, options?: Pick<RequestOptions, 'signal'>) => this.send(
    planetId ? `/api/planets/${encodeURIComponent(planetId)}` : '/api/planet',
    planetSchema,
    options,
  );
  /**
   * The whole galaxy and the whole ladder, each read at most once every five
   * seconds whoever asks (`gatedRead.ts`, the owner's phone recording 2026-09-19).
   */
  galaxy = gatedRead(() => this.send('/api/galaxy', galaxySchema), BIG_READ_GAP_MS);
  equipCosmetic = (category: CosmeticCategory, cosmeticId: CosmeticId | null, hull?: MobileHullId) =>
    this.send('/api/cosmetics/equip', cosmeticEquipSchema, { method: 'POST', body: { category, cosmeticId, ...(hull ? { hull } : {}) } });
  skins = () => this.send('/api/skins', skinCollectionSchema, {
    headers: { 'x-astera-cosmetics': COSMETIC_IDS.join(',') },
  });
  skinShop = () => this.send('/api/skins/shop', skinShopSchema);
  skinPricing = () => this.send('/api/skins/pricing', skinPricingSchema);
  purchaseSkin = (itemId: PlanetSkinId | 'bundle') =>
    this.send('/api/skins/purchase', skinPurchaseSchema, { method: 'POST', body: { itemId } });
  polarShop = () => this.send('/api/skins/polar-shop', polarShopSchema);
  polarPricing = () => this.send('/api/skins/polar-pricing', polarPricingSchema);
  purchasePolarSkin = (itemId: CosmeticId | 'bundle') =>
    this.send('/api/skins/polar-purchase', polarPurchaseSchema, { method: 'POST', body: { itemId } });
  shopierShop = () => this.send('/api/skins/shopier-shop', shopierShopSchema);
  /** The open purchase code for this item; asking again returns the same one. */
  shopierCode = (itemId: CosmeticId | 'bundle') =>
    this.send('/api/skins/shopier-code', shopierCodeSchema, { method: 'POST', body: { itemId } });
  shopierQueue = () => this.send('/api/admin/shopier/orders', shopierQueueSchema);
  shopierGrant = (orderId: string, username: string) =>
    this.send(`/api/admin/shopier/orders/${encodeURIComponent(orderId)}/grant`, shopierOrderActionSchema, { method: 'POST', body: { username } });
  shopierDismiss = (orderId: string) =>
    this.send(`/api/admin/shopier/orders/${encodeURIComponent(orderId)}/dismiss`, shopierOrderActionSchema, { method: 'POST', body: {} });
  shopierRevoke = (orderId: string) =>
    this.send(`/api/admin/shopier/orders/${encodeURIComponent(orderId)}/revoke`, shopierOrderActionSchema, { method: 'POST', body: {} });
  shopierSync = () => this.send('/api/admin/shopier/sync', shopierSyncSchema, { method: 'POST', body: {} });
  equipSkin = (planetId: string, skinId: PlanetSkinId | null) =>
    this.send(`/api/skins/planets/${encodeURIComponent(planetId)}`, skinEquipSchema, {
      method: 'POST', body: { skinId },
    });
  traffic = (options?: Pick<RequestOptions, 'signal'>) => this.send('/api/galaxy/traffic', trafficSchema, options);
  monuments = (options?: Pick<RequestOptions, 'signal'>) => this.send('/api/monuments', monumentsSchema, options);

  unknownSignals = (options?: Pick<RequestOptions, 'signal'>) => this.send('/api/unknown-signals', unknownSignalsSchema, options);
  unknownSignal = (id: string, options?: Pick<RequestOptions, 'signal'>) => this.send(`/api/unknown-signals/${encodeURIComponent(id)}`, unknownSignalDetailsSchema, options);
  dispatchUnknownSignal = (id: string, originPlanetId: string, fleet: Fleet, key = createIdempotencyKey()) =>
    this.send(`/api/unknown-signals/${encodeURIComponent(id)}/dispatch`, unknownSignalLaunchSchema,
      { method: 'POST', body: { originPlanetId, fleet }, idempotencyKey: key });
  recallUnknownSignal = (id: string, key = createIdempotencyKey()) =>
    this.send(`/api/unknown-signals/${encodeURIComponent(id)}/recall`, unknownSignalRecallSchema,
      { method: 'POST', body: {}, idempotencyKey: key });
  quoteMonument = (monumentId: string, input: MonumentSendInput) =>
    this.send(`/api/monuments/${encodeURIComponent(monumentId)}/quote`, monumentQuoteSchema, { method: 'POST', body: { ...input } });
  sendMonument = (monumentId: string, input: MonumentSendInput, key: string) =>
    this.send(`/api/monuments/${encodeURIComponent(monumentId)}/send`, monumentSendSchema, { method: 'POST', body: { ...input }, idempotencyKey: key });
  probeMonument = (monumentId: string, originPlanetId: string, key: string) =>
    this.send(`/api/monuments/${encodeURIComponent(monumentId)}/probe`, monumentProbeLaunchSchema, { method: 'POST', body: { originPlanetId }, idempotencyKey: key });
  quoteMonumentRecall = (waveId: string, selections: readonly MonumentRecallSelection[]) =>
    this.send(`/api/monuments/waves/${encodeURIComponent(waveId)}/recall/quote`, monumentRecallQuoteSchema, { method: 'POST', body: { selections } });
  recallMonument = (waveId: string, selections: readonly MonumentRecallSelection[], key: string) =>
    this.send(`/api/monuments/waves/${encodeURIComponent(waveId)}/recall`, monumentRecallSchema, { method: 'POST', body: { selections }, idempotencyKey: key });
  /** A wave can turn home in full once; its identity survives renders, retries and remounts. */
  recallMonumentFlight = (waveId: string) =>
    this.send(`/api/monuments/waves/${encodeURIComponent(waveId)}/recall`, monumentRecallSchema,
      { method: 'POST', body: { all: true }, idempotencyKey: `monument-flight-recall:${waveId}` });
  leaderboard = gatedRead(() => this.send('/api/leaderboard', leaderboardSchema), BIG_READ_GAP_MS);
  honorLeaderboard = gatedRead(() => this.send('/api/leaderboard?ranking=HONOR', leaderboardSchema), BIG_READ_GAP_MS);
  honorTarget = (planetId: string) => this.send(`/api/honor/targets/${encodeURIComponent(planetId)}`, honorTargetSchema);
  seasonArchive = (cursor?: number) => this.send(
    `/api/season-archive?limit=12${cursor === undefined ? '' : `&cursor=${String(cursor)}`}`,
    seasonArchiveSchema,
  );
  archivedLeaderboard = (seasonId: string) => this.send(
    `/api/season-archive/${encodeURIComponent(seasonId)}/leaderboard`,
    seasonArchiveLeaderboardSchema,
  );
  seasonCommanderProfile = (resultId: string) => this.send(
    `/api/season-archive/results/${encodeURIComponent(resultId)}`,
    seasonCommanderProfileSchema,
  );

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

  /** One clan's public profile, roster included. D183. */
  clan = (clanId: string) =>
    this.send(`/api/clans/${encodeURIComponent(clanId)}`, publicClanSchema);
  clanEvents = (before?: string) => this.send(
    `/api/clan/events?limit=30${before ? `&before=${encodeURIComponent(before)}` : ''}`,
    clanEventsPageSchema,
  );
  clanDepot = () => this.send('/api/clan/depot', clanDepotSchema);
  clanAid = () => this.send('/api/clan/aid', clanAidSchema);
  clanWar = () => this.send('/api/clan/war', clanWarSchema);
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
      idempotencyKey: createIdempotencyKey(),
    });
  }

  quoteClanAid = (input: ClanAidInput) =>
    this.send('/api/clan/aid/quote', clanAidQuoteSchema, { method: 'POST', body: { ...input } });
  quoteClanWar = (input: { originPlanetId: string; fleet: Fleet }) =>
    this.send('/api/clan/war/contributions/quote', clanWarQuoteSchema,
      { method: 'POST', body: { ...input } });
  markClanWarTarget = (targetPlanetId: string) =>
    this.clanMutation('/api/clan/war/target', clanWarTargetResultSchema, { targetPlanetId });
  markClanWarMonumentTarget = (targetMonumentId: string) =>
    this.clanMutation('/api/clan/war/target', clanWarTargetResultSchema, { targetMonumentId });
  cancelClanWar = () => this.clanMutation('/api/clan/war/cancel', clanWarTargetResultSchema);
  startClanWar = (acknowledgeShieldLoss: boolean, pace: MissionPace = 1, acknowledgeRadiationLoss?: boolean) =>
    this.clanMutation('/api/clan/war/start', clanWarStartResultSchema, { acknowledgeShieldLoss, pace,
      ...(acknowledgeRadiationLoss ? { acknowledgeRadiationLoss: true } : {}) });
  contributeClanWar = (input: { originPlanetId: string; fleet: Fleet; acknowledgeShieldLoss: boolean;
    acknowledgeRadiationLoss?: boolean }) =>
    this.clanMutation('/api/clan/war/contributions', clanWarContributionResultSchema, input);
  recallClanWar = (contributionId: string) =>
    this.clanMutation(`/api/clan/war/contributions/${encodeURIComponent(contributionId)}/recall`,
      clanWarRecallResultSchema);
  /* Klan Savunma Desteği. */
  mySupport = () => this.send('/api/clan/support', mySupportSchema);
  quoteClanSupport = (input: { originPlanetId: string; hostPlanetId: string; fleet: Fleet; admiral?: boolean }) =>
    this.send('/api/clan/support/quote', clanSupportQuoteSchema, { method: 'POST', body: { ...input } });
  sendClanSupport = (input: { originPlanetId: string; hostPlanetId: string; fleet: Fleet; admiral?: boolean }) =>
    this.clanMutation('/api/clan/support', clanSupportSendSchema, input);
  recallClanSupport = (waveId: string) =>
    this.clanMutation(`/api/clan/support/${encodeURIComponent(waveId)}/recall`, clanSupportWaveAnswerSchema);
  sendBackClanSupport = (waveId: string) =>
    this.clanMutation(`/api/clan/support/${encodeURIComponent(waveId)}/send-back`, clanSupportWaveAnswerSchema);
  donateClanTreasury = (input: { planetId: string; resources: Resources }) =>
    this.clanMutation('/api/clan/treasury/donate', clanTreasuryResultSchema, input);
  upgradeClanLevel = (expectedLevel: number) =>
    this.clanMutation('/api/clan/level/upgrade', clanTreasuryResultSchema, { expectedLevel });
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
  disbandClan = (acknowledgeTreasuryBurn = false) => this.clanMutation(
    '/api/clan/disband', clanDisbandSchema, { acknowledgeTreasuryBurn },
  );
  claimClanDepot = () => this.clanMutation('/api/clan/depot/claim', clanDepotClaimSchema);
  launchClanAid = (input: ClanAidInput) =>
    this.clanMutation('/api/clan/aid/launch', clanAidLaunchSchema, { ...input });
  postClanChat = (content: string, replyToMessageId?: string, media?: ChatMedia) =>
    this.clanMutation('/api/clan/chat/messages', clanChatPostSchema, { content, ...(replyToMessageId ? { replyToMessageId } : {}), ...(media ? { media } : {}) });
  markClanChatRead = (messageId: string) =>
    this.clanMutation('/api/clan/chat/read', clanChatReadSchema, { messageId });
  markClanSeen = () => this.clanMutation('/api/clan/read', clanSeenSchema);

  chatMessages = (language: ChatLanguage, before?: string) =>
    this.send(`/api/chat/messages?language=${language}&limit=50${before ? `&before=${encodeURIComponent(before)}` : ''}`, chatPageSchema);
  postChat = (language: ChatLanguage, content: string, replyToMessageId?: string, media?: ChatMedia) =>
    this.send('/api/chat/messages', chatPostSchema, { method: 'POST', body: { content, language, ...(replyToMessageId ? { replyToMessageId } : {}), ...(media ? { media } : {}) } });
  chatMediaUrl = (assetId: string, channel?: 'general' | 'clan' | 'dm', messageId?: string) =>
    `${this.baseUrl}/api/chat/media/${encodeURIComponent(assetId)}${channel && messageId ? `?channel=${channel}&messageId=${encodeURIComponent(messageId)}` : ''}`;

  /** HTML media cannot attach a bearer header. Native owns a bounded, account-scoped object URL. */
  async chatMediaSource(media: Exclude<ChatMedia, { kind: 'youtube' }>, channel: 'general' | 'clan' | 'dm' | undefined,
    messageId: string | undefined, signal: AbortSignal): Promise<{ url: string; release: () => void }> {
    return this.privateMediaSource(this.chatMediaUrl(media.assetId, channel, messageId), media, signal);
  }

  async adminReportMediaSource(reportId: string, media: Exclude<ChatMedia, { kind: 'youtube' }>, signal: AbortSignal): Promise<{ url: string; release: () => void }> {
    const id = z.string().uuid().parse(reportId);
    return this.privateMediaSource(`${this.baseUrl}/api/admin/content-reports/${encodeURIComponent(id)}/media`, media, signal);
  }

  /** One account/session boundary for chat and operator review; routes authorize distinct scopes. */
  private async privateMediaSource(path: string, media: Exclude<ChatMedia, { kind: 'youtube' }>, signal: AbortSignal): Promise<{ url: string; release: () => void }> {
    signal.throwIfAborted();
    if (!this.auth) return { url: path, release: () => undefined };
    const generation = this.sessionGeneration;
    const controller = new AbortController();
    let objectUrl: string | null = null;
    const release = () => {
      controller.abort();
      signal.removeEventListener('abort', release);
      this.mediaCleanups.delete(release);
      if (objectUrl !== null) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
    };
    signal.addEventListener('abort', release, { once: true });
    this.mediaCleanups.add(release);
    const current = () => {
      controller.signal.throwIfAborted();
      if (generation !== this.sessionGeneration) throw new ApiError('SESSION_CHANGED', 'Session changed', 409);
    };
    const request = () => this.http(path, { headers: { ...(this.token ? { authorization: `Bearer ${this.token}` } : {}) },
      credentials: 'omit', cache: 'no-store', redirect: 'error', signal: controller.signal });
    try {
      let response = await request(); current();
      if (response.status === 401) {
        await response.body?.cancel();
        if (await this.restore()) { current(); response = await request(); current(); }
      }
      const mime = response.headers.get('content-type')?.split(';')[0]?.trim();
      const limit = media.kind === 'image' ? CHAT_MEDIA.imageMaxBytes : CHAT_MEDIA.videoMaxBytes;
      if (!response.ok || !response.body || mime !== media.mimeType || !CHAT_MEDIA.mimeTypes.some(type => type === mime)
        || Number(response.headers.get('content-length')) > limit) {
        await response.body?.cancel();
        throw new ApiError('CHAT_MEDIA_NOT_FOUND', 'Media unavailable', response.ok ? 502 : response.status);
      }
      const reader = response.body.getReader();
      const chunks: ArrayBuffer[] = []; let size = 0;
      try {
        for (;;) {
          const chunk = await reader.read(); current();
          if (chunk.done) break;
          size += chunk.value.byteLength;
          if (size > limit) throw new ApiError('CHAT_MEDIA_TOO_LARGE', 'Media is too large', 413);
          chunks.push(new Uint8Array(chunk.value).buffer);
        }
      } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
      current();
      objectUrl = URL.createObjectURL(new Blob(chunks, { type: mime }));
      return { url: objectUrl, release };
    } catch (error) { release(); throw error; }
  }

  async uploadChatMedia(file: File, signal: AbortSignal, onProgress: (percent: number) => void) {
    const generation = this.sessionGeneration;
    const attempt = async (retry: boolean): Promise<z.infer<typeof chatMediaUploadSchema>> => {
      signal.throwIfAborted();
      try {
        return await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          const abort = () => { xhr.abort(); reject(new DOMException('Upload canceled', 'AbortError')); };
          xhr.open('POST', `${this.baseUrl}/api/admin/chat/media`);
          xhr.withCredentials = this.auth === null;
          xhr.timeout = 120_000;
          xhr.ontimeout = () => { reject(new ApiError('UNREACHABLE', 'Upload timed out; try again', 0)); };
          xhr.setRequestHeader('content-type', 'application/octet-stream');
          xhr.setRequestHeader('x-media-type', file.type);
          if (this.token) xhr.setRequestHeader('authorization', `Bearer ${this.token}`);
          if (this.placement) xhr.setRequestHeader('x-placement', this.placement);
          xhr.upload.onprogress = event => { if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100)); };
          xhr.onloadend = () => { signal.removeEventListener('abort', abort); };
          xhr.onerror = () => { reject(new ApiError('UNREACHABLE', 'Upload failed; try again', 0)); };
          xhr.onabort = () => { reject(new DOMException('Upload canceled', 'AbortError')); };
          xhr.onload = () => {
            if (generation !== this.sessionGeneration) { reject(new ApiError('SESSION_CHANGED', 'Session changed', 409)); return; }
            let body: unknown;
            try { body = JSON.parse(xhr.responseText) as unknown; } catch { reject(new ApiError('UNREACHABLE', 'Upload failed; try again', xhr.status)); return; }
            if (xhr.status < 200 || xhr.status >= 300) { const error = errorShape(body); if (xhr.status === 409 && error.error === 'PLACEMENT_CHANGED') window.dispatchEvent(new Event('astera:placement-changed')); reject(new ApiError(error.error, error.message, xhr.status, error.params)); return; }
            const result = chatMediaUploadSchema.safeParse(body);
            if (result.success) resolve(result.data); else reject(result.error);
          };
          signal.addEventListener('abort', abort, { once: true });
          xhr.send(file);
        });
      } catch (error) {
        if (retry && error instanceof ApiError && error.status === 401 && await this.restore()) return attempt(false);
        throw error;
      }
    };
    return attempt(true);
  }

  messageReactionDetails = (channel: 'general' | 'clan' | 'dm', messageId: string) =>
    this.send(`/api/chat/reactions?channel=${channel}&messageId=${encodeURIComponent(messageId)}`, messageReactionDetailsSchema);
  reactToMessage = (channel: 'general' | 'clan' | 'dm', messageId: string, emoji: ReactionEmoji | null) =>
    this.send('/api/chat/reactions', messageReactionResultSchema, { method: 'POST', body: { channel, messageId, emoji } });
  chatUnread = (language: ChatLanguage) => this.send(`/api/chat/unread?language=${language}`, chatUnreadSchema);
  markChatRead = (language: ChatLanguage, messageId: string) =>
    this.send('/api/chat/read', chatReadSchema, { method: 'POST', body: { messageId, language } });
  dmContacts = (query: string) => this.send(`/api/dm/contacts?q=${encodeURIComponent(query)}`, dmContactsSchema);
  dmConversations = () => this.send('/api/dm/conversations', dmConversationsSchema);
  dmUnread = () => this.send('/api/dm/unread', chatUnreadSchema);
  dmMessages = (conversationId: string, before?: string) => this.send(
    `/api/dm/conversations/${encodeURIComponent(conversationId)}/messages?limit=50${before ? `&before=${encodeURIComponent(before)}` : ''}`,
    dmPageSchema,
  );
  postDm = (recipientPlayerId: string, content: string, replyToMessageId?: string, media?: ChatMedia) => this.send('/api/dm/messages', dmPostSchema, {
    method: 'POST', body: { recipientPlayerId, content, ...(replyToMessageId ? { replyToMessageId } : {}), ...(media ? { media } : {}) },
  });
  markDmRead = (conversationId: string, messageId: string) => this.send(
    `/api/dm/conversations/${encodeURIComponent(conversationId)}/read`, dmReadSchema,
    { method: 'POST', body: { messageId } },
  );
  blockDm = (targetPlayerId: string) => this.send('/api/dm/blocks', dmBlockSchema, {
    method: 'POST', body: { targetPlayerId },
  });
  unblockDm = (targetPlayerId: string) => this.send(
    `/api/dm/blocks/${encodeURIComponent(targetPlayerId)}`, dmBlockSchema, { method: 'DELETE' },
  );
  chronicle = (before?: string) =>
    this.send(`/api/chronicle?limit=30${before ? `&before=${encodeURIComponent(before)}` : ''}`, chroniclePageSchema);
  intel = () => this.send('/api/intel', intelSchema);
  /** The closing link of the loop: what a fight actually taught you. */
  reports = () => this.send('/api/reports?limit=50', reportsSchema);

  upgrade = (planetIdOrType: string, explicitType?: BuildingId, confirmedLevel?: number) => {
    const type = explicitType ?? planetIdOrType as BuildingId;
    const path = explicitType
      ? `/api/planets/${encodeURIComponent(planetIdOrType)}/upgrade`
      : '/api/planet/upgrade';
    return this.send(path, upgradeSchema, { method: 'POST', body: { type, ...(confirmedLevel === undefined ? {} : { confirmedLevel }) } });
  };

  vacation = (days = 1) => this.send(`/api/vacation?days=${String(days)}`, vacationSchema);
  startVacation = (input: { days: number; fingerprint: string; requestId: string }) =>
    this.send('/api/vacation', vacationSchema, { method: 'POST', body: input });
  endVacation = (vacationId: string) =>
    this.send('/api/vacation/end', vacationSchema, { method: 'POST', body: { vacationId } });

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

  /**
   * START A REPAIR STATION JOB at a named world, on the lots named or on everything waiting.
   * Cancelling is the yard's own door (`cancelBuildOrder`); the order is a queue row there.
   */
  startRepair = (planetId: string, request: RepairRequest, key = createIdempotencyKey()) =>
    this.send(`/api/planets/${encodeURIComponent(planetId)}/repairs`, repairStartSchema, {
      method: 'POST', body: request, idempotencyKey: key,
    });

  maintenance = (planetId: string, action: MaintenanceAction, selection: MaintenanceSelection, key = createIdempotencyKey()) =>
    this.send(`/api/planets/${encodeURIComponent(planetId)}/maintenance`, maintenanceSchema, {
      method: 'POST', body: { action, selection }, idempotencyKey: key,
    });

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

  /**
   * A raid may be turned once while it flies: `recallFlight` (K8).
   *
   * `acknowledgeShieldLoss` is the commander saying they have read what this costs
   * THEM. D183 — a raid launched under the first-day shield spends it, and the
   * server refuses once with `SHIELD_WOULD_DROP` rather than spending it silently.
   */
  launch = (
    originOrTargetPlanetId: string,
    targetOrFleet: string | Fleet,
    explicitFleet?: Fleet,
    acknowledgeShieldLoss?: boolean,
    /** How fast to fly it. Omitted is full speed, which is what every launch flew before D-pace. */
    pace?: MissionPace,
    /** The commander has read what radiation on this route would take (plan D10). */
    acknowledgeRadiation?: boolean,
    /** The commander ship escorts this raid (Y9). */
    admiral?: boolean,
  ) =>
    this.send('/api/fleet/launch', launchSchema, {
      method: 'POST',
      body: {
        ...(explicitFleet
          ? { originPlanetId: originOrTargetPlanetId, targetPlanetId: targetOrFleet, fleet: explicitFleet }
          : { targetPlanetId: originOrTargetPlanetId, fleet: targetOrFleet }),
        ...(acknowledgeShieldLoss ? { acknowledgeShieldLoss: true } : {}),
        ...(pace !== undefined && pace !== 1 ? { pace } : {}),
        ...(acknowledgeRadiation ? { acknowledgeRadiation: true } : {}),
        ...(admiral ? { admiral: true } : {}),
      },
    });

  /** Turn a transfer or a raid around (K8). The server decides whether this flight may be recalled at all. */
  recallFlight = (missionId: string) =>
    this.send(
      `/api/fleet/${encodeURIComponent(missionId)}/recall`,
      movementLaunchSchema.pick({ missionId: true, arriveAt: true }),
      { method: 'POST', body: {} },
    );

  /** Turn a pirate raid home before its engagement — the same one turn as a fleet's (owner, 2026-10-08). */
  recallPirateRaid = (raidId: string) =>
    this.send(
      `/api/pirates/raids/${encodeURIComponent(raidId)}/recall`,
      pirateRecallSchema,
      { method: 'POST', body: {} },
    );

  recallTrade = (runId: string) => this.send(`/api/trade/runs/${encodeURIComponent(runId)}/recall`,
    tradeRecallSchema, { method: 'POST', body: {} });

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

  transfer = (originPlanetId: string, targetPlanetId: string, fleet: Fleet, cargo: { alloy: number; crystal: number; deuterium: number }, pace?: MissionPace, returnPlan?: TransferReturnPlan, acknowledgeRadiation?: boolean) =>
    this.send('/api/fleet/transfer', movementLaunchSchema, {
      method: 'POST',
      body: {
        originPlanetId, targetPlanetId, fleet, cargo,
        ...(returnPlan ? { returnPlan } : {}),
        ...(pace !== undefined && pace !== 1 ? { pace } : {}),
        ...(acknowledgeRadiation ? { acknowledgeRadiation: true } : {}),
      },
    });

  settle = (originPlanetId: string, targetPlanetId: string) =>
    this.send('/api/fleet/settle', movementLaunchSchema, {
      method: 'POST', body: { originPlanetId, targetPlanetId },
    });

  buildDeathStar = (planetId: string) =>
    this.send(`/api/planets/${encodeURIComponent(planetId)}/death-star/build`, deathStarBuildSchema, {
      method: 'POST', body: {},
    });

  buildRadiationBomb = (planetId: string, level: 1 | 2 | 3) =>
    this.send(`/api/planets/${encodeURIComponent(planetId)}/radiation-bombs/build`, radiationBombBuildSchema, {
      method: 'POST', body: { level },
    });

  launchRadiationBomb = (originPlanetId: string, level: 1 | 2 | 3,
    target: { kind: 'PLANET' | 'MONUMENT'; id: string }, key: string, acknowledgeShieldLoss = false) =>
    this.send('/api/radiation-bombs/launch', radiationBombLaunchSchema, {
      method: 'POST', body: { originPlanetId, level, target, acknowledgeShieldLoss }, idempotencyKey: key,
    });

  /** Save a world's two defence toggles (Klan Savunma Desteği, K4). Idempotent by nature. */
  setDefencePosture = (planetId: string, toggles: { escape: boolean; support: boolean }) =>
    this.send(`/api/planets/${encodeURIComponent(planetId)}/defence-posture`, defencePostureResultSchema, {
      method: 'POST',
      body: toggles,
    });
  buildInterceptor = (planetId: string) =>
    this.send(`/api/planets/${encodeURIComponent(planetId)}/interceptor/build`, interceptorBuildSchema, {
      method: 'POST', body: {},
    });

  /**
   * PUT ONE FAULT RIGHT. There is no matching `cancelFaultRepair`, deliberately: the
   * server has no such route and the sheet says so before the button is pressed.
   */
  repairFault = (planetId: string, faultId: string) =>
    this.send(
      `/api/planets/${encodeURIComponent(planetId)}/faults/${encodeURIComponent(faultId)}/repair`,
      faultRepairSchema,
      { method: 'POST', body: {} },
    );

  launchDeathStar = (originPlanetId: string, targetPlanetId: string) =>
    this.send('/api/death-star/launch', deathStarLaunchSchema, {
      method: 'POST', body: { originPlanetId, targetPlanetId },
    });

  rewards = () => this.send('/api/rewards', rewardsSchema);

  /**
   * `send()` serialises. A second `JSON.stringify` here would be a compile error,
   * which is the point of the rule.
   */
  brandRecallStatus = () => this.send('/api/session/brand-recall', brandRecallSchema);

  answerBrandRecall = (answer: string | null) => this.send('/api/session/brand-recall', brandRecallAnswerSchema, { method: 'POST', body: { answer } });

  claimReward = (id: string) =>
    this.send('/api/rewards/claim', rewardClaimSchema, { method: 'POST', body: { id } });

  mining = (planetId?: string) => this.send(
    `/api/mining${planetId ? `?planetId=${encodeURIComponent(planetId)}` : ''}`,
    miningSchema,
  );

  miningField = (options?: Pick<RequestOptions, 'signal'>) => this.send('/api/mining/field', miningFieldSchema, options);

  miningStatus = (planetId?: string, options?: Pick<RequestOptions, 'signal'>) => this.send(
    `/api/mining/status${planetId ? `?planetId=${encodeURIComponent(planetId)}` : ''}`,
    miningStatusSchema,
    options,
  );

  mine = (asteroidId: string, craft: number, originPlanetId?: string) =>
    this.send('/api/mining/launch', miningLaunchSchema, {
      method: 'POST',
      body: { asteroidId, craft, ...(originPlanetId ? { originPlanetId } : {}) },
    });

  recallMining = (runId: string) =>
    this.send(
      `/api/mining/runs/${encodeURIComponent(runId)}/recall`,
      miningRecallSchema,
      { method: 'POST', body: {} },
    );

  /**
   * The pirates on this commander's sensors, and what it would take to reach one.
   *
   * `originPlanetId` is what `reachMinutes` is measured FROM, so it travels with
   * the request rather than being applied afterwards: a rendezvous solved from the
   * wrong world is a number that does not describe any launch the player can make.
   */
  pirates = (originPlanetId?: string, options?: Pick<RequestOptions, 'signal'>) => this.send(
    `/api/pirates${originPlanetId ? `?originPlanetId=${encodeURIComponent(originPlanetId)}` : ''}`,
    piratesSchema,
    options,
  );

  /** IRREVERSIBLE, like every launch. The server has no recall. P3. */
  /**
   * `quotedMinutes` is the flight time the player was LOOKING AT. D183.
   *
   * The rendezvous table is an instantaneous solve and a stale one can name a
   * different lap of the orbit entirely — 5.1 minutes to 56.3 in the worst measured
   * case. A pirate raid cannot be recalled, so the launch carries the quote and the server
   * refuses rather than flying the fleet at an answer nobody read.
   */
  raidPirate = (
    pirateId: string,
    fleet: Fleet,
    originPlanetId?: string,
    quotedMinutes?: number,
    acknowledgeRadiationLoss?: boolean,
    admiral?: boolean,
  ) =>
    this.send('/api/pirates/raid', pirateRaidSchema, {
      method: 'POST',
      body: {
        pirateId,
        fleet,
        ...(originPlanetId ? { originPlanetId } : {}),
        ...(quotedMinutes !== undefined ? { quotedMinutes } : {}),
        ...(acknowledgeRadiationLoss ? { acknowledgeRadiationLoss: true } : {}),
        ...(admiral ? { admiral: true } : {}),
      },
    });

  /**
   * SEND A CONVOY TO THE MERCHANT. D156.
   *
   * Outbound convoys can be recalled before reaching the merchant. No `GET` is needed here:
   * the merchant already reaches the client on `/api/galaxy/events`, orbit and all,
   * so the rendezvous is solved on both sides from the same published elements with
   * the same `interceptOrbit`. A second read here would be a second answer to a
   * question that already has one.
   */
  trade = (
    occurrenceId: string,
    fleet: Fleet,
    give: { alloy: number; crystal: number; deuterium: number },
    want: { alloy: number; crystal: number; deuterium: number },
    originPlanetId?: string,
    acknowledgeRadiationLoss?: boolean,
    expectedHonorTier?: HonorBenefitTier,
  ) =>
    this.send('/api/trade/launch', tradeLaunchSchema, {
      method: 'POST',
      body: { occurrenceId, fleet, give, want, ...(originPlanetId ? { originPlanetId } : {}),
        ...(acknowledgeRadiationLoss ? { acknowledgeRadiationLoss: true } : {}),
        ...(expectedHonorTier !== undefined ? { expectedHonorTier } : {}) },
    });

  /** Commit the exact moving-target quote the confirmation surface displayed. */
  launchIntergalacticConvoy = (
    input: IntergalacticConvoyLaunchInput,
    idempotencyKey: string,
  ) => this.send('/api/intergalactic-convoy/launch', intergalacticConvoyLaunchSchema, {
    method: 'POST',
    idempotencyKey,
    body: {
      ...input,
      quotedAt: input.quotedAt.toISOString(),
      quotedArriveAt: input.quotedArriveAt.toISOString(),
    },
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

  /** The return story (E10 · S3). Reading it changes nothing on the server. */
  returnPayload = () => this.send('/api/session/return', returnSchema);
  /** The player dismissed the story, or is here now: close the window up to `asOf`. */
  acknowledgeReturn = (asOf: Date) =>
    this.send('/api/session/return/seen', returnSeenSchema, { method: 'POST', body: { asOf: asOf.toISOString() } });
  /** Safe to poll — unlike `returnPayload`, reading this changes nothing. */
  pending = (options?: Pick<RequestOptions, 'signal'>) => this.send('/api/session/pending', pendingSchema, options);
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
    const generation = this.sessionGeneration;
    const open = async (): Promise<Response> => {
      if (generation !== this.sessionGeneration) throw new ApiError('SESSION_CHANGED', 'Session changed', 409);
      const response = await this.http(`${this.baseUrl}/api/stream`, {
        headers: { ...(this.token ? { authorization: `Bearer ${this.token}` } : {}), ...buildHeader() },
        credentials: this.auth ? 'omit' : 'same-origin',
        signal,
      });
      if (generation !== this.sessionGeneration) {
        await response.body?.cancel();
        throw new ApiError('SESSION_CHANGED', 'Session changed', 409);
      }
      return response;
    };

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
    if (res.status === 426) reportUpdateRequired();
    if (!res.ok || !res.body) throw new ApiError('STREAM_FAILED', 'Stream unavailable', res.status);

    // Headers are in and the body is open: from here the client hears everything.
    onOpen?.();

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (!signal.aborted) {
      const { done, value } = await reader.read();
      if (done) return;
      signal.throwIfAborted();
      if (generation !== this.sessionGeneration) {
        await reader.cancel();
        return;
      }
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
