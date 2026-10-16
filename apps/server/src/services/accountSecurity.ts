import { normalizeIP } from '@fastify/rate-limit';
import { randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { and, desc, eq, gt, isNull, ne } from 'drizzle-orm';
import type { Db, Tx } from '../db/client.js';
import type { Env } from '../env.js';
import type { Clock } from '../clock.js';
import { accounts, mailOutbox, mailSuppressions, securityAudit, securityOperations } from '../db/schema.js';
import { verifyPassword, hashPassword } from '../auth/password.js';
import { GameError } from './planet.js';
import { securityDigest, takeSecurityCounter, type MailMessage, type MailQueue } from './mail.js';

type Purpose = typeof securityOperations.$inferSelect.purpose;
type Operation = typeof securityOperations.$inferSelect;
const MINUTE = 60_000;
const mailCopy = {
  en: { bind: 'Verify your recovery email', change_old: 'Approve your email change', change_new: 'Verify your new email', reset: 'Reset your password', changed: 'Your account security details changed', code: 'Your code', help: 'This code is valid for up to 10 minutes. Use only your most recently requested code. If you did not request this, do not share the code.', notice: 'Your password or sign-in email changed. All previous sessions have been signed out. If this was not you, contact support@asteraonline.space.' },
  tr: { bind: 'Kurtarma e-postanı doğrula', change_old: 'E-posta değişikliğini onayla', change_new: 'Yeni e-postanı doğrula', reset: 'Parolanı sıfırla', changed: 'Hesap güvenliği bilgilerin değişti', code: 'Doğrulama kodun', help: 'Bu kod en fazla 10 dakika geçerlidir. Yalnız en son istediğin kodu kullan. Bu işlemi sen başlatmadıysan kodu paylaşma.', notice: 'Parolan veya giriş e-postan değişti. Önceki oturumların kapatıldı. Bu işlemi sen yapmadıysan support@asteraonline.space adresine yaz.' },
  de: { bind: 'Bestätige deine Wiederherstellungsadresse', change_old: 'Bestätige die Änderung deiner E-Mail', change_new: 'Bestätige deine neue E-Mail', reset: 'Passwort zurücksetzen', changed: 'Deine Kontosicherheit wurde geändert', code: 'Dein Code', help: 'Dieser Code gilt höchstens 10 Minuten. Verwende nur den zuletzt angeforderten Code. Teile ihn nicht, wenn du dies nicht angefordert hast.', notice: 'Dein Passwort oder deine Anmeldeadresse wurde geändert. Alle bisherigen Sitzungen wurden beendet. Falls du das nicht warst, kontaktiere support@asteraonline.space.' },
  fr: { bind: 'Confirme ton adresse de récupération', change_old: 'Autorise le changement d’adresse', change_new: 'Confirme ta nouvelle adresse', reset: 'Réinitialise ton mot de passe', changed: 'La sécurité de ton compte a changé', code: 'Ton code', help: 'Ce code reste valable au maximum 10 minutes. Utilise uniquement le dernier code demandé. Ne le partage pas si tu n’as pas demandé cette opération.', notice: 'Ton mot de passe ou ton adresse de connexion a changé. Toutes les sessions précédentes ont été fermées. Si ce n’était pas toi, contacte support@asteraonline.space.' },
  es: { bind: 'Verifica tu correo de recuperación', change_old: 'Autoriza el cambio de correo', change_new: 'Verifica tu nuevo correo', reset: 'Restablece tu contraseña', changed: 'La seguridad de tu cuenta ha cambiado', code: 'Tu código', help: 'Este código es válido durante un máximo de 10 minutos. Usa solo el último código solicitado. Si no solicitaste esto, no compartas el código.', notice: 'Tu contraseña o correo de acceso ha cambiado. Se cerraron todas las sesiones anteriores. Si no fuiste tú, escribe a support@asteraonline.space.' },
  ja: { bind: '復旧用メールアドレスの確認', change_old: 'メールアドレス変更の承認', change_new: '新しいメールアドレスの確認', reset: 'パスワードの再設定', changed: 'アカウントのセキュリティ情報が変更されました', code: '確認コード', help: 'コードの有効期限は最大10分です。最後にリクエストしたコードを使ってください。心当たりがない場合はコードを共有しないでください。', notice: 'パスワードまたはログイン用メールアドレスが変更され、以前のセッションは終了しました。心当たりがない場合は support@asteraonline.space に連絡してください。' },
};
export const securityLocales = ['en', 'tr', 'de', 'fr', 'es', 'ja'] as const;
export type SecurityLocale = typeof securityLocales[number];
const copyFor = (locale: string) => mailCopy[securityLocales.find(value => value === locale) ?? 'en'];
const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
function message(to: string, locale: string, purpose: Purpose | 'changed', code?: string): MailMessage {
  const copy = copyFor(locale); const subject = `Astera Online — ${copy[purpose]}`;
  const detail = code ? `${copy.code}: ${code}\n\n${copy.help}` : copy.notice;
  return { to, subject, text: `${subject}\n\n${detail}`, html: `<div style="background:#080d18;color:#e9efff;padding:28px;font-family:Arial,sans-serif;max-width:520px"><p style="color:#8bc8ff;letter-spacing:3px">ASTERA ONLINE</p><h1 style="font-size:22px">${escapeHtml(copy[purpose])}</h1>${code ? `<p style="font-size:36px;letter-spacing:8px;font-weight:bold">${code}</p>` : ''}<p style="line-height:1.6">${escapeHtml(code ? copy.help : copy.notice)}</p></div>` };
}
const invalidCode = () => new GameError('EMAIL_CODE_INVALID', 'Invalid or expired code', 400);
export class AccountSecurity {
  constructor(private readonly db: Db, private readonly env: Env, private readonly clock: Clock, private readonly mail: MailQueue) {}
  capabilities() { return { email: this.env.ACCOUNT_EMAIL_ENABLED, recovery: this.env.PASSWORD_RECOVERY_ENABLED }; }
  enabled(reset = false): void {
    if (!(reset ? this.env.PASSWORD_RECOVERY_ENABLED : this.env.ACCOUNT_EMAIL_ENABLED)) throw new GameError('EMAIL_UNAVAILABLE', 'Account email is unavailable', 503);
  }
  async limitSendIp(ip: string): Promise<void> {
    const key = this.digest(`ip:${normalizeIP(ip)}`); const now = this.clock.now();
    const hourly = await takeSecurityCounter(this.db, `send-ip-hour:${key}`, 20, 60 * MINUTE, now);
    const daily = await takeSecurityCounter(this.db, `send-ip-day:${key}`, 100, 1440 * MINUTE, now);
    if (!hourly || !daily) throw new GameError('RATE_LIMITED', 'Try later', 429, { seconds: 3600 });
  }
  private digest(value: string): string { return securityDigest(this.env.AUTH_CODE_HMAC_SECRET, value); }
  private codeHash(id: string, purpose: Purpose, accountId: string, target: string, code: string): string {
    return this.digest(JSON.stringify([id, purpose, accountId, target, code]));
  }
  private metadata(operation: Operation) {
    return { challengeId: operation.id, purpose: operation.purpose, expiresAt: operation.expiresAt.toISOString(), resendAvailableAt: operation.resendAt.toISOString() };
  }
  async status(accountId: string) {
    const [account] = await this.db.select().from(accounts).where(eq(accounts.id, accountId));
    if (!account) throw new GameError('UNAUTHENTICATED', 'Sign in first', 401);
    const [operation] = await this.db.select().from(securityOperations).where(and(eq(securityOperations.accountId, accountId),
      eq(securityOperations.version, account.authVersion), ne(securityOperations.purpose, 'reset'), isNull(securityOperations.consumedAt), gt(securityOperations.deadline, this.clock.now())))
      .orderBy(desc(securityOperations.createdAt)).limit(1);
    const [delivery] = operation ? await this.db.select({ status: mailOutbox.status }).from(mailOutbox)
      .where(and(eq(mailOutbox.operationId, operation.id), eq(mailOutbox.codeHash, operation.codeHash))).orderBy(desc(mailOutbox.createdAt)).limit(1) : [];
    const maskedEmail = account.email ? account.email.replace(/^(.).*(@.*)$/, '$1•••$2') : null;
    return { enabled: this.env.ACCOUNT_EMAIL_ENABLED, loginMethod: account.emailVerifiedAt ? 'email' : 'username',
      email: account.email, maskedEmail, verifiedAt: account.emailVerifiedAt?.toISOString() ?? null,
      pending: operation ? { ...this.metadata(operation), target: operation.target, deliveryStatus: delivery?.status ?? 'queued' } : null };
  }
  private async allowedSend(accountId: string, target: string): Promise<boolean> {
    const now = this.clock.now();
    const keys: [string, number, number][] = [
      [`cooldown:${accountId}`, 1, MINUTE], [`target-cooldown:${this.digest(target)}`, 1, MINUTE],
      [`send-hour:${accountId}`, 5, 60 * MINUTE], [`send-day:${accountId}`, 10, 1440 * MINUTE],
      [`target-hour:${this.digest(target)}`, 5, 60 * MINUTE], [`target-day:${this.digest(target)}`, 10, 1440 * MINUTE],
    ];
    let allowed = true;
    for (const [key, max, duration] of keys) if (!await takeSecurityCounter(this.db, key, max, duration, now)) allowed = false;
    return allowed;
  }
  private async currentPassword(accountId: string, password: string, version: number) {
    if (!await takeSecurityCounter(this.db, `password-check:${accountId}`, 10, 15 * MINUTE, this.clock.now())) throw new GameError('RATE_LIMITED', 'Try later', 429, { seconds: 900 });
    const [account] = await this.db.select().from(accounts).where(eq(accounts.id, accountId));
    if (account?.authVersion !== version || !await verifyPassword(password, account.passwordHash)) throw new GameError('BAD_CREDENTIALS', 'Credentials do not match', 401);
    return account;
  }
  private async create(tx: Tx, account: typeof accounts.$inferSelect, purpose: Purpose, target: string, locale: string) {
    const now = this.clock.now();
    await tx.update(securityOperations).set({ consumedAt: now }).where(and(eq(securityOperations.accountId, account.id), isNull(securityOperations.consumedAt),
      purpose === 'reset' ? eq(securityOperations.purpose, 'reset') : ne(securityOperations.purpose, 'reset')));
    const id = randomUUID(); const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const [operation] = await tx.insert(securityOperations).values({ id, accountId: account.id, version: account.authVersion, purpose, target,
      locale, codeHash: this.codeHash(id, purpose, account.id, target, code), createdAt: now, expiresAt: new Date(now.getTime() + 10 * MINUTE),
      deadline: new Date(now.getTime() + (purpose === 'reset' ? 10 : 30) * MINUTE), resendAt: new Date(now.getTime() + MINUTE) }).returning();
    if (!operation) throw new Error('Operation insert failed');
    await tx.insert(securityAudit).values({ accountId: account.id, kind: 'email_requested', createdAt: now });
    await this.mail.queue(tx, account.id, account.authVersion, message(purpose === 'change_old' ? account.email! : target, locale, purpose, code), operation);
    return this.metadata(operation);
  }
  async request(accountId: string, version: number, target: string, password: string, locale: string, change = false) {
    this.enabled(); const snapshot = await this.currentPassword(accountId, password, version);
    if (change !== Boolean(snapshot.emailVerifiedAt) || snapshot.email === target) throw new GameError('EMAIL_STATE_INVALID', 'Email state changed', 409);
    if (!await this.allowedSend(accountId, target)) throw new GameError('RATE_LIMITED', 'Try later', 429, { seconds: 60 });
    return this.db.transaction(async tx => {
      const [account] = await tx.select().from(accounts).where(eq(accounts.id, accountId)).for('update');
      if (account?.authVersion !== version || account.passwordHash !== snapshot.passwordHash) throw new GameError('UNAUTHENTICATED', 'Sign in again', 401);
      return this.create(tx, account, change ? 'change_old' : 'bind', target, locale);
    });
  }
  async resetRequest(email: string, locale: string) {
    this.enabled(true); const now = this.clock.now();
    const dummy = { challengeId: randomUUID(), purpose: 'reset' as const, expiresAt: new Date(now.getTime() + 10 * MINUTE).toISOString(), resendAvailableAt: new Date(now.getTime() + MINUTE).toISOString() };
    const [account] = await this.db.select().from(accounts).where(eq(accounts.email, email));
    const allowed = await this.allowedSend(account?.id ?? this.digest(`unknown:${email}`), email);
    const [suppressed] = await this.db.select().from(mailSuppressions).where(eq(mailSuppressions.recipientKey, this.mail.recipientKey(email)));
    if (!account?.emailVerifiedAt || !allowed || suppressed) return dummy;
    return this.db.transaction(async tx => {
      const [current] = await tx.select().from(accounts).where(eq(accounts.id, account.id)).for('update');
      if (current?.authVersion !== account.authVersion || current.email !== email) return dummy;
      return this.create(tx, current, 'reset', email, locale);
    });
  }
  async cancel(accountId: string, id: string): Promise<void> {
    await this.db.update(securityOperations).set({ consumedAt: this.clock.now() }).where(and(eq(securityOperations.id, id), eq(securityOperations.accountId, accountId), ne(securityOperations.purpose, 'reset')));
  }
  async resend(accountId: string, version: number, id: string) {
    this.enabled();
    const [operation] = await this.db.select().from(securityOperations).where(and(eq(securityOperations.id, id), eq(securityOperations.accountId, accountId)));
    const now = this.clock.now();
    if (!operation || operation.purpose === 'reset' || operation.consumedAt || operation.version !== version || operation.deadline <= now || operation.attempts >= 5) throw invalidCode();
    if (operation.resendAt > now || !await this.allowedSend(accountId, operation.target)) throw new GameError('RATE_LIMITED', 'Try later', 429, { seconds: 60 });
    return this.db.transaction(async tx => {
      const [account] = await tx.select().from(accounts).where(eq(accounts.id, accountId)).for('update');
      const [current] = await tx.select().from(securityOperations).where(eq(securityOperations.id, id)).for('update');
      if (account?.authVersion !== version || !current || current.consumedAt || current.codeHash !== operation.codeHash) throw invalidCode();
      return this.rotate(tx, account, current, current.purpose);
    });
  }
  private async rotate(tx: Tx, account: typeof accounts.$inferSelect, operation: Operation, purpose: Purpose) {
    const now = this.clock.now(); const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const [updated] = await tx.update(securityOperations).set({ purpose, codeHash: this.codeHash(operation.id, purpose, account.id, operation.target, code),
      expiresAt: new Date(Math.min(now.getTime() + 10 * MINUTE, operation.deadline.getTime())), resendAt: new Date(now.getTime() + MINUTE) })
      .where(eq(securityOperations.id, operation.id)).returning();
    if (!updated) throw invalidCode();
    await this.mail.queue(tx, account.id, account.authVersion, message(purpose === 'change_old' ? account.email! : operation.target, operation.locale, purpose, code), updated);
    return this.metadata(updated);
  }
  async complete(id: string, code: string, purpose: Purpose, actor?: { accountId: string; version: number }, newPassword?: string) {
    if (purpose === 'reset') this.enabled(true); else this.enabled();
    const [initial] = await this.db.select().from(securityOperations).where(eq(securityOperations.id, id));
    const now = this.clock.now();
    // Dead or unrelated proofs cannot spend the budget of a fresh operation.
    if (!initial || (actor && (initial.accountId !== actor.accountId || initial.version !== actor.version))
      || initial.purpose !== purpose || initial.consumedAt || initial.attempts >= 5 || initial.expiresAt <= now || initial.deadline <= now) throw invalidCode();
    const allowAttempts = await takeSecurityCounter(this.db, `code-attempt:${initial.accountId}`, 10, 15 * MINUTE, now);
    if (!allowAttempts) {
      // A reset challenge must not reveal whether the requested address exists.
      if (purpose === 'reset') throw invalidCode();
      throw new GameError('RATE_LIMITED', 'Try later', 429, { seconds: 900 });
    }
    // Reject bad codes before paying the password hashing cost, then recheck under lock.
    const matches = (op: Operation): boolean => {
      const actual = Buffer.from(this.codeHash(op.id, purpose, op.accountId, op.target, code), 'hex'); const expected = Buffer.from(op.codeHash, 'hex');
      return actual.length === expected.length && timingSafeEqual(actual, expected);
    };
    const passwordHash = purpose === 'reset' && newPassword && matches(initial) ? await hashPassword(newPassword) : undefined;
    const result = await this.db.transaction(async tx => {
      const [account] = await tx.select().from(accounts).where(eq(accounts.id, initial.accountId)).for('update');
      const [operation] = await tx.select().from(securityOperations).where(eq(securityOperations.id, id)).for('update');
      const at = this.clock.now();
      if (!account || !operation || operation.consumedAt || operation.purpose !== purpose || operation.version !== account.authVersion
        || (actor && actor.version !== account.authVersion) || operation.expiresAt <= at || operation.deadline <= at || operation.attempts >= 5) return null;
      if (!matches(operation)) {
        await tx.update(securityOperations).set({ attempts: operation.attempts + 1 }).where(eq(securityOperations.id, id));
        await tx.insert(securityAudit).values({ accountId: account.id, kind: 'code_rejected', createdAt: at }); return null;
      }
      if (purpose === 'change_old') return { ...await this.rotate(tx, account, operation, 'change_new'), reauthenticate: false };
      if (purpose === 'reset' && (!passwordHash || account.email !== operation.target)) return null;
      if (purpose === 'bind' && account.emailVerifiedAt) return null;
      if (purpose === 'change_new' && !account.emailVerifiedAt) return null;
      const [conflict] = purpose === 'reset' ? [] : await tx.select({ id: accounts.id }).from(accounts).where(and(eq(accounts.email, operation.target), ne(accounts.id, account.id)));
      if (conflict) throw new GameError('EMAIL_IN_USE', 'This email cannot be linked to this account', 409);
      await tx.insert(securityAudit).values({ accountId: account.id, kind: purpose === 'reset' ? 'password_reset' : purpose === 'bind' ? 'email_verified' : 'email_changed', createdAt: at });
      const version = account.authVersion + 1;
      await tx.update(accounts).set(purpose === 'reset' ? { passwordHash, authVersion: version }
        : { email: operation.target, emailVerifiedAt: now, authVersion: version }).where(eq(accounts.id, account.id));
      await tx.update(securityOperations).set({ consumedAt: now }).where(and(eq(securityOperations.accountId, account.id), isNull(securityOperations.consumedAt)));
      if (purpose === 'reset' || purpose === 'change_new') {
        const recipients = new Set([account.email!, operation.target]);
        for (const recipient of recipients) await this.mail.queue(tx, account.id, version, message(recipient, operation.locale, 'changed'));
      }
      return { reauthenticate: true };
    }).catch((error: unknown) => {
      // Unique index is the final cross-account race arbiter, never a raw SQL error response.
      const cause = error instanceof Error ? error.cause : undefined;
      if (cause && typeof cause === 'object' && 'code' in cause && cause.code === '23505') throw new GameError('EMAIL_IN_USE', 'This email cannot be linked to this account', 409);
      throw error;
    });
    if (!result) throw invalidCode();
    return result;
  }
}
