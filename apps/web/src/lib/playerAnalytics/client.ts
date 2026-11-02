import { z } from 'zod';
import { analyticsEventSchema, analyticsGrantSchema, ANALYTICS_BATCH_BYTES,
  type AnalyticsEvent, type AnalyticsName, type AnalyticsProperties, type AnalyticsVisitor } from '../../api/analyticsSchemas.js';
import { shouldStartSession } from '../../api/analyticsModel.js';

const KEY = 'astera.player-analytics.v1';
const DAY = 86_400_000;
const savedSchema = z.object({ grant: analyticsGrantSchema, contextId: z.string().uuid(), sessionId: z.string().uuid(),
  sequence: z.number().int().nonnegative(), lastObserved: z.number(), accountId: z.string().nullable(),
  events: z.array(analyticsEventSchema).max(256) }).strict();
type Grant = z.infer<typeof analyticsGrantSchema>;
interface Options { fetch: typeof globalThis.fetch; now: () => number; storage?: Storage; baseUrl?: string; monotonic?: () => number; resume?: boolean; onReady?: (owner: PlayerAnalytics) => void }

/** No imports of Api or gameplay state: observation delivery cannot recurse through game/auth mutations. */
export class PlayerAnalytics {
  private grant: Grant | null = null;
  private contextId = '';
  private sessionId = '';
  private sequence = 0;
  private events: AnalyticsEvent[] = [];
  private accountId: string | null = null;
  private token: string | null = null;
  private generation = 0;
  private flight: Promise<void> | null = null;
  private retryAt = 0;
  private enabled: Promise<void> | null = null;
  private permitted = false;
  private requests = new Set<AbortController>();
  private lastObserved = 0;
  private baseline = 0;
  private lastForeground: number | null = null;
  private interactionIntervals: { start: number; end: number }[] = [];
  private mode: AnalyticsEvent['mode'] = 'live';
  private metadata: Omit<AnalyticsVisitor, 'contextId' | 'scope' | 'policyVersion'> | null = null;
  dropped = 0;
  constructor(private readonly io: Options) {}
  get pending(): number { return this.events.length; }
  get recording(): boolean { return this.grant !== null && Date.parse(this.grant.expiresAt) > this.io.now(); }
  headers(): Record<string, string> { return this.recording && this.grant ? { 'x-analytics-visitor': this.grant.credential } : {}; }
  private clock(): number { return this.io.monotonic?.() ?? this.io.now(); }
  private async request<T>(url: string, init: RequestInit, consume: (response: Response) => Promise<T>): Promise<T> {
    const controller = new AbortController();
    this.requests.add(controller);
    const timer = setTimeout(() => { controller.abort(); }, 10_000);
    try { return await consume(await this.io.fetch(url, { ...init, signal: controller.signal })); }
    finally { clearTimeout(timer); this.requests.delete(controller); }
  }

  async enable(metadata: Omit<AnalyticsVisitor, 'contextId' | 'scope' | 'policyVersion'>): Promise<void> {
    this.permitted = true;
    if (this.grant && !this.recording) {
      this.grant = null; this.events = []; this.lastForeground = null; this.interactionIntervals = [];
      try { this.io.storage?.removeItem(KEY); } catch { /* Optional storage. */ }
    }
    if (this.grant || this.enabled) return this.enabled ?? Promise.resolve();
    this.metadata = metadata;
    const epoch = this.generation;
    this.enabled = this.open(metadata, epoch).catch(() => undefined).finally(() => { if (epoch === this.generation) this.enabled = null; });
    return this.enabled;
  }
  private async open(metadata: Omit<AnalyticsVisitor, 'contextId' | 'scope' | 'policyVersion'>, epoch: number) {
    try {
      const raw = this.io.storage?.getItem(KEY);
      if (this.io.resume !== false && raw && raw.length <= 256 * 1024) {
        const saved = savedSchema.parse(JSON.parse(raw));
        if (Date.parse(saved.grant.expiresAt) > this.io.now() && (!this.accountId || saved.accountId === this.accountId)) {
          this.grant = saved.grant; this.contextId = saved.contextId; this.sessionId = saved.sessionId;
          this.sequence = saved.sequence; this.events = saved.events; this.lastObserved = saved.lastObserved;
          this.accountId = saved.accountId; this.baseline = this.clock(); this.io.onReady?.(this); return;
        }
      }
    } catch { /* Storage is optional; malformed histories never become identities. */ }
    const contextId = crypto.randomUUID();
    const grant = await this.request(`${this.io.baseUrl ?? ''}/api/analytics/visitors`, { method: 'POST',
      headers: { 'content-type': 'application/json', ...(this.accountId && this.token ? { authorization: `Bearer ${this.token}` } : {}) },
      body: JSON.stringify({ ...metadata, contextId, scope: this.accountId ? 'player' : 'anonymous', policyVersion: 1 }) },
    async response => response.ok ? analyticsGrantSchema.parse(await response.json()) : null);
    if (!grant) return;
    if (epoch !== this.generation) { await this.revoke(grant); return; }
    this.grant = grant; this.contextId = contextId; this.sessionId = crypto.randomUUID();
    this.sequence = 0; this.baseline = this.clock(); this.lastObserved = this.io.now();
    this.record('visit_started', {}, this.mode);
    this.io.onReady?.(this);
  }
  identity(accountId: string | null, token: string | null): void {
    if (this.accountId !== accountId && (this.grant || this.enabled)) {
      const metadata = this.metadata;
      const nextGeneration = this.generation + 1;
      void this.disable(false).then(() => {
        if (this.generation === nextGeneration && metadata && this.permitted) return this.enable(metadata);
      });
    }
    this.accountId = accountId; this.token = token;
    this.persist();
  }
  record(name: AnalyticsName, properties: AnalyticsProperties, mode = this.mode): void {
    if (!this.grant) return;
    if (name === 'load_phase') this.mode = mode;
    const now = this.io.now();
    if (now >= Date.parse(this.grant.expiresAt)) { this.events = []; this.persist(); return; }
    const parsed = analyticsEventSchema.safeParse({ id: crypto.randomUUID(), version: 1, name, source: 'client_observation', mode,
      contextId: this.contextId, sessionId: this.sessionId, sequence: this.sequence++, occurredAt: now,
      elapsedMs: Math.max(0, Math.min(DAY, this.clock() - this.baseline)), properties });
    if (!parsed.success) return;
    this.events.push(parsed.data);
    while (this.events.length > 256 || new TextEncoder().encode(JSON.stringify(this.events)).length > 240 * 1024) {
      this.events.shift(); this.dropped++;
    }
    this.lastObserved = now; this.persist();
  }
  foreground(active: boolean): void {
    if (!this.grant) return;
    const now = this.io.now(), at = this.clock();
    if (active) {
      if (this.lastForeground !== null) return;
      if (shouldStartSession(this.lastObserved || null, now)) this.sessionId = crypto.randomUUID();
      this.lastForeground = at;
      this.record('foreground_started', { offsetMinutes: -new Date(now).getTimezoneOffset() });
    } else if (this.lastForeground !== null) {
      this.heartbeat(); this.lastForeground = null; this.interactionIntervals = [];
      this.record('foreground_ended', { code: 'background' });
      void this.flush(true);
    }
  }
  interact(): void {
    if (this.lastForeground === null) return;
    const now = this.clock(), last = this.interactionIntervals.at(-1);
    if (last && now <= last.end) last.end = now + 60_000;
    else this.interactionIntervals.push({ start: now, end: now + 60_000 });
    if (this.interactionIntervals.length > 2) this.interactionIntervals.shift();
  }
  heartbeat(): void {
    if (this.lastForeground === null) return;
    const now = this.clock(), elapsed = Math.max(0, now - this.lastForeground);
    const foregroundMs = elapsed <= 120_000 ? elapsed : 0;
    const start = this.lastForeground;
    const interactionSlices = foregroundMs === 0 ? [] : this.interactionIntervals
      .map(interval => ({ startMs: Math.max(start, interval.start) - start, endMs: Math.min(now, interval.end) - start }))
      .filter(interval => interval.endMs > interval.startMs);
    const interactionMs = interactionSlices.reduce((sum, slice) => sum + slice.endMs - slice.startMs, 0);
    this.record('interaction', { foregroundMs, interactionMs, interactionSlices });
    this.interactionIntervals = this.interactionIntervals.filter(interval => interval.end > now);
    this.lastForeground = now;
  }
  async flush(keepalive = false): Promise<void> {
    if (this.flight) return this.flight;
    if (this.io.now() < this.retryAt) return;
    const grant = this.grant;
    if (!grant) return;
    if (Date.parse(grant.expiresAt) <= this.io.now()) { this.events = []; this.persist(); return; }
    const batch: AnalyticsEvent[] = [];
    for (const event of this.events) {
      if (batch.length === 32 || new TextEncoder().encode(JSON.stringify({ events: [...batch, event] })).length > ANALYTICS_BATCH_BYTES) break;
      batch.push(event);
    }
    if (!batch.length) return;
    const epoch = this.generation;
    this.flight = (async () => {
      try {
        const response = await this.request(`${this.io.baseUrl ?? ''}/api/analytics/events`, { method: 'POST', keepalive,
          headers: { 'content-type': 'application/json', 'x-analytics-visitor': grant.credential,
            ...(this.token ? { authorization: `Bearer ${this.token}` } : {}) }, body: JSON.stringify({ events: batch }) },
        async response => { await response.body?.cancel(); return response; });
        if (epoch !== this.generation) return;
        if (response.status === 429 || response.status === 503) {
          const after = response.headers.get('retry-after');
          const seconds = after === null ? NaN : Number(after);
          const deadline = Number.isFinite(seconds) ? this.io.now() + Math.max(0, seconds) * 1000 : Date.parse(after ?? '');
          this.retryAt = Math.max(this.io.now() + 1000, Math.min(this.io.now() + DAY, Number.isFinite(deadline) ? deadline : this.io.now() + 60_000));
        }
        if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 429 && response.status !== 401)) {
          const ids = new Set(batch.map(e => e.id)); this.events = this.events.filter(e => !ids.has(e.id)); this.persist();
        }
      } catch { /* Retry is bounded by the grant lifetime and queue limits. */ }
    })().finally(() => { if (epoch === this.generation) this.flight = null; });
    return this.flight;
  }
  async disable(revoke = true): Promise<void> {
    if (revoke) this.permitted = false;
    const grant = this.grant;
    this.generation++; this.grant = null; this.events = []; this.enabled = null; this.flight = null;
    for (const request of this.requests) request.abort();
    this.requests.clear();
    this.retryAt = 0;
    this.lastForeground = null; this.interactionIntervals = [];
    try { this.io.storage?.removeItem(KEY); } catch { /* Optional storage. */ }
    if (grant && revoke) await this.revoke(grant);
  }
  private async revoke(grant: Grant) {
    try { await this.request(`${this.io.baseUrl ?? ''}/api/analytics/visitors`, { method: 'DELETE', keepalive: true,
      headers: { 'x-analytics-visitor': grant.credential } }, async response => { await response.body?.cancel(); }); } catch { /* Server retention still bounds a disconnected grant. */ }
  }
  private persist(): void {
    if (!this.grant) return;
    try { this.io.storage?.setItem(KEY, JSON.stringify({ grant: this.grant, contextId: this.contextId,
      sessionId: this.sessionId, sequence: this.sequence, lastObserved: this.lastObserved, accountId: this.accountId, events: this.events })); }
    catch { /* Observation must never break the game when storage is unavailable. */ }
  }
}
