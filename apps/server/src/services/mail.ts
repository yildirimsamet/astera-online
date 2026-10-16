import { createCipheriv, createDecipheriv, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { and, eq, lte, or, sql, lt } from 'drizzle-orm';
import { z } from 'zod';
import type { FastifyBaseLogger } from 'fastify';
import type { Db, Queryable, Tx } from '../db/client.js';
import type { Env } from '../env.js';
import { GameError } from './planet.js';
import type { Clock } from '../clock.js';
import { accounts, mailOutbox, mailSuppressions, mailWebhookEvents, securityAudit, securityCounters, securityOperations } from '../db/schema.js';

export const mailMessageSchema = z.object({ to: z.string().email(), subject: z.string(), text: z.string(), html: z.string() });
export type MailMessage = z.infer<typeof mailMessageSchema>;
export interface TransactionalMailer { send(message: MailMessage, idempotencyKey: string): Promise<string> }
export class MailSendError extends Error {
  constructor(readonly permanent: boolean, readonly retryAfterMs = 0) { super('Mail provider rejected delivery'); }
}
export class ResendMailer implements TransactionalMailer {
  constructor(private readonly env: Env, private readonly http: typeof fetch = fetch) {}
  async send(message: MailMessage, idempotencyKey: string): Promise<string> {
    const response = await this.http('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(5000),
      headers: { authorization: `Bearer ${this.env.RESEND_API_KEY}`, 'content-type': 'application/json', 'idempotency-key': idempotencyKey },
      body: JSON.stringify({ ...message, from: this.env.MAIL_FROM, reply_to: this.env.MAIL_REPLY_TO }),
    });
    if (!response.ok) {
      const delay = Number(response.headers.get('retry-after') ?? 0) * 1000;
      throw new MailSendError(response.status >= 400 && response.status < 500 && ![408, 409, 429].includes(response.status), Number.isFinite(delay) ? delay : 0);
    }
    return z.object({ id: z.string().min(1) }).parse(await response.json()).id;
  }
}

/** Postgres counters are shared across replicas and fail closed without another store. */
export async function takeSecurityCounter(db: Queryable, key: string, limit: number, windowMs: number, now: Date): Promise<boolean> {
  const [row] = await db.insert(securityCounters).values({ key, count: 1, expiresAt: new Date(now.getTime() + windowMs) })
    .onConflictDoUpdate({ target: securityCounters.key, set: {
      count: sql`case when ${securityCounters.expiresAt} <= ${now.toISOString()}::timestamptz then 1 else ${securityCounters.count} + 1 end`,
      expiresAt: sql`case when ${securityCounters.expiresAt} <= ${now.toISOString()}::timestamptz then ${new Date(now.getTime() + windowMs).toISOString()}::timestamptz else ${securityCounters.expiresAt} end`,
    } }).returning({ count: securityCounters.count });
  return row !== undefined && row.count <= limit;
}
export const securityDigest = (secret: string, value: string): string => createHmac('sha256', secret).update(value).digest('hex');
export function sealMail(message: MailMessage, key: string, id: string): string {
  const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
  cipher.setAAD(Buffer.from(id));
  const data = Buffer.concat([cipher.update(JSON.stringify(message)), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(part => part.toString('base64url')).join('.');
}
export function openMail(payload: string, key: string, id: string): MailMessage {
  const [iv, tag, body] = payload.split('.');
  if (!iv || !tag || !body) throw new Error('Invalid mail payload');
  const cipher = createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), Buffer.from(iv, 'base64url'));
  cipher.setAAD(Buffer.from(id)); cipher.setAuthTag(Buffer.from(tag, 'base64url'));
  const data: unknown = JSON.parse(Buffer.concat([cipher.update(Buffer.from(body, 'base64url')), cipher.final()]).toString());
  return mailMessageSchema.parse(data);
}

export class MailQueue {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running: Promise<void> | null = null;
  private lastCleanup = 0;
  constructor(private readonly db: Db, private readonly env: Env, private readonly clock: Clock,
    private readonly sender: TransactionalMailer, private readonly log: FastifyBaseLogger) {}
  recipientKey(email: string): string { return securityDigest(this.env.AUTH_CODE_HMAC_SECRET, `recipient:${email}`); }
  async queue(tx: Tx, accountId: string, version: number, message: MailMessage, operation?: { id: string; codeHash: string; expiresAt: Date }): Promise<void> {
    const now = this.clock.now(); const id = randomUUID();
    await tx.insert(mailOutbox).values({ id, accountId, version, operationId: operation?.id, codeHash: operation?.codeHash,
      recipientKey: this.recipientKey(message.to), payload: sealMail(message, this.env.MAIL_OUTBOX_ENCRYPTION_KEY, id),
      expiresAt: operation?.expiresAt ?? new Date(now.getTime() + 600_000), nextAttemptAt: now, createdAt: now });
  }
  async status() {
    const [row] = await this.db.select({
      queued: sql<number>`count(*) filter (where ${mailOutbox.status} in ('queued', 'sending'))::int`,
      failed: sql<number>`count(*) filter (where ${mailOutbox.status} = 'failed')::int`,
      oldestQueuedAt: sql<string | null>`min(${mailOutbox.createdAt}) filter (where ${mailOutbox.status} in ('queued', 'sending'))`,
    }).from(mailOutbox);
    const day = this.clock.now().toISOString().slice(0, 10);
    const counters = await this.db.select().from(securityCounters).where(or(eq(securityCounters.key, `mail-day:${day}`), eq(securityCounters.key, `mail-month:${day.slice(0, 7)}`)));
    const daily = counters.find(counter => counter.key.startsWith('mail-day:'))?.count ?? 0;
    const monthly = counters.find(counter => counter.key.startsWith('mail-month:'))?.count ?? 0;
    return { enabled: this.env.MAIL_DELIVERY_ENABLED, queued: row?.queued ?? 0, failed: row?.failed ?? 0,
      oldestQueuedAt: row?.oldestQueuedAt ?? null, daily, monthly, quotaWarning: daily >= 80 || monthly >= 2400 };
  }
  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => { void this.tick().catch(() => { this.log.error('mail queue unavailable'); }); }, 1000);
    this.timer.unref();
  }
  async stop(): Promise<void> { if (this.timer) clearInterval(this.timer); this.timer = null; await this.running; }
  async tick(): Promise<void> {
    this.running ??= this.runOne().finally(() => { this.running = null; });
    await this.running;
  }
  private async runOne(): Promise<void> {
    const now = this.clock.now();
    if (now.getTime() - this.lastCleanup >= 60_000) {
      await this.db.update(mailOutbox).set({ status: 'cancelled', payload: null }).where(and(lte(mailOutbox.expiresAt, now), or(eq(mailOutbox.status, 'queued'), eq(mailOutbox.status, 'sending'))));
      await this.db.delete(securityOperations).where(lt(securityOperations.expiresAt, new Date(now.getTime() - 86_400_000)));
      await this.db.delete(securityCounters).where(lt(securityCounters.expiresAt, now));
      await this.db.delete(mailOutbox).where(lt(mailOutbox.createdAt, new Date(now.getTime() - 30 * 86_400_000)));
      await this.db.delete(securityAudit).where(lt(securityAudit.createdAt, new Date(now.getTime() - 30 * 86_400_000)));
      await this.db.delete(mailWebhookEvents).where(lt(mailWebhookEvents.createdAt, new Date(now.getTime() - 30 * 86_400_000)));
      this.lastCleanup = now.getTime();
    }
    if (!this.env.MAIL_DELIVERY_ENABLED) return;
    const row = await this.db.transaction(async tx => {
      const [candidate] = await tx.select().from(mailOutbox).where(and(lte(mailOutbox.nextAttemptAt, now),
        or(eq(mailOutbox.status, 'queued'), and(eq(mailOutbox.status, 'sending'), lte(mailOutbox.claimedAt, new Date(now.getTime() - 30_000))))))
        .orderBy(mailOutbox.createdAt).limit(1).for('update', { skipLocked: true });
      if (!candidate) return null;
      await tx.update(mailOutbox).set({ status: 'sending', claimedAt: now }).where(eq(mailOutbox.id, candidate.id));
      return candidate;
    });
    if (!row) return;
    const terminal = async (status: 'cancelled' | 'failed'): Promise<void> => {
      await this.db.update(mailOutbox).set({ status, payload: null }).where(eq(mailOutbox.id, row.id));
    };
    const [account] = await this.db.select({ version: accounts.authVersion }).from(accounts).where(eq(accounts.id, row.accountId));
    const [suppressed] = await this.db.select().from(mailSuppressions).where(eq(mailSuppressions.recipientKey, row.recipientKey));
    const [operation] = row.operationId ? await this.db.select().from(securityOperations).where(eq(securityOperations.id, row.operationId)) : [];
    if (!row.payload || row.expiresAt <= now || !account || (row.operationId !== null && account.version !== row.version) || suppressed
      || (row.operationId && (!operation || operation.consumedAt || operation.codeHash !== row.codeHash || operation.expiresAt <= now))) {
      await terminal('cancelled'); return;
    }
    // Fixed UTC day/month counters reserve twenty daily sends for account recovery.
    if (row.attempts === 0) {
      const day = now.toISOString().slice(0, 10); const month = day.slice(0, 7);
      const limits: [string, number, number][] = [[`mail-day:${day}`, 100, 86_400_000], [`mail-month:${month}`, 3000, 32 * 86_400_000]];
      if (operation?.purpose !== 'reset') limits.unshift([`mail-non-reset:${day}`, 80, 86_400_000]);
      for (const [key, limit, duration] of limits) {
        if (!await takeSecurityCounter(this.db, key, limit, duration, now)) {
          this.log.warn('mail quota reached'); await terminal('failed'); return;
        }
      }
    }
    try {
      const message = openMail(row.payload, this.env.MAIL_OUTBOX_ENCRYPTION_KEY, row.id);
      const providerId = await this.sender.send(message, row.id);
      await this.db.update(mailOutbox).set({ status: 'sent', payload: null, providerId, attempts: row.attempts + 1 }).where(eq(mailOutbox.id, row.id));
    } catch (error) {
      const attempts = row.attempts + 1;
      const retry = error instanceof MailSendError ? error.retryAfterMs : 0;
      const delay = Math.max(retry, Math.min(60_000, 2000 * 2 ** attempts) + randomBytes(1)[0]! * 10);
      if (attempts >= 5 || (error instanceof MailSendError && error.permanent) || now.getTime() + delay >= row.expiresAt.getTime()) {
        this.log.error({ mailId: row.id }, 'mail delivery failed'); await terminal('failed');
      } else {
        await this.db.update(mailOutbox).set({ status: 'queued', attempts, nextAttemptAt: new Date(now.getTime() + delay) }).where(eq(mailOutbox.id, row.id));
      }
    }
  }
}

/** Svix signatures authenticate the original bytes, including event ID and timestamp. */
export function verifyMailWebhook(body: string, id: string, timestamp: string, signature: string, secret: string, now: Date): boolean {
  if (!secret.startsWith('whsec_') || !/^\d+$/.test(timestamp) || Math.abs(now.getTime() / 1000 - Number(timestamp)) > 300) return false;
  const expected = createHmac('sha256', Buffer.from(secret.slice(6), 'base64')).update(`${id}.${timestamp}.${body}`).digest();
  return signature.split(' ').some(part => {
    const [version, value] = part.split(',');
    if (version !== 'v1' || !value) return false;
    const actual = Buffer.from(value, 'base64');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  });
}

export async function recordMailWebhook(db: Db, eventId: string, body: unknown, now: Date): Promise<void> {
  const event = z.object({ type: z.string(), data: z.object({ email_id: z.string() }) }).parse(body);
  if (!['email.delivered', 'email.bounced', 'email.complained', 'email.suppressed'].includes(event.type)) return;
  await db.transaction(async tx => {
    const [inserted] = await tx.insert(mailWebhookEvents).values({ id: eventId, createdAt: now }).onConflictDoNothing().returning();
    if (!inserted) return;
    const [mail] = await tx.select().from(mailOutbox).where(eq(mailOutbox.providerId, event.data.email_id)).for('update');
    if (!mail) throw new GameError('MAIL_EVENT_PENDING', 'Retry event delivery later', 503);
    if (['email.bounced', 'email.complained', 'email.suppressed'].includes(event.type)) {
      await tx.insert(mailSuppressions).values({ recipientKey: mail.recipientKey, reason: event.type, createdAt: now }).onConflictDoNothing();
      await tx.update(mailOutbox).set({ status: 'failed', payload: null }).where(eq(mailOutbox.id, mail.id));
    } else if (event.type === 'email.delivered' && mail.status !== 'failed') {
      await tx.update(mailOutbox).set({ status: 'delivered' }).where(eq(mailOutbox.id, mail.id));
    }
  });
}
