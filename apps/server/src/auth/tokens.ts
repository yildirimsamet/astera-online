import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { z } from 'zod';

/** Signed credentials carry the durable account version; legacy tokens use version zero. */

export interface AccessClaims extends JWTPayload {
  sub: string;
  typ: 'access' | 'native-access';
}

export interface RefreshClaims extends JWTPayload {
  sub: string;
  typ: 'refresh';
}

export class InvalidSessionError extends Error {}

export class TokenService {
  private readonly key: Uint8Array;

  constructor(
    secret: string,
    private readonly accessMinutes: number,
    /**
     * Public because the refresh COOKIE's lifetime has to match the refresh
     * TOKEN's. Two independent settings for one duration eventually disagree, and
     * the failure is a cookie that outlives its token — a browser that believes it
     * is signed in and an API that does not.
     */
    readonly refreshDays: number,
    /** `read`: a read may be answered from the identity cache; a command never is (F1.8 C1). */
    private readonly isCurrent?: (accountId: string, version: number, nativeSessionId: string | undefined, read: boolean) => Promise<boolean>,
  ) {
    this.key = new TextEncoder().encode(secret);
  }

  async issueAccess(accountId: string, version = 0, nativeSessionId?: string): Promise<string> {
    // Older replicas reject the new purpose instead of silently ignoring per-device revocation.
    return new SignJWT({ typ: nativeSessionId ? 'native-access' : 'access', ver: version, ...(nativeSessionId ? { sid: nativeSessionId } : {}) })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(accountId)
      .setIssuedAt()
      .setExpirationTime(`${this.accessMinutes}m`)
      .sign(this.key);
  }

  async issueRefresh(accountId: string, version = 0): Promise<string> {
    return new SignJWT({ typ: 'refresh', ver: version })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(accountId)
      .setIssuedAt()
      .setExpirationTime(`${this.refreshDays}d`)
      .sign(this.key);
  }

  /**
   * Verify and require the expected token type.
   *
   * The `typ` check matters: without it a refresh token — which lives in a cookie
   * for thirty days — would be accepted as an access token.
   */
  async identity(token: string, expected: 'access' | 'refresh', read = false): Promise<{ accountId: string; version: number; nativeSessionId?: string }> {
    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(token, this.key, { algorithms: ['HS256'] }));
    } catch { throw new InvalidSessionError('Invalid signature or expiry'); }
    const native = payload.typ === 'native-access' && expected === 'access';
    if (payload.typ !== expected && !native) throw new InvalidSessionError(`expected a ${expected} token`);
    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      throw new InvalidSessionError('token has no subject');
    }
    const version = payload.ver === undefined ? 0 : payload.ver;
    if (typeof version !== 'number' || !Number.isSafeInteger(version) || version < 0) throw new InvalidSessionError('invalid token version');
    const sessionId = native ? z.string().uuid().safeParse(payload.sid) : null;
    if (native && !sessionId?.success) throw new InvalidSessionError('invalid native session');
    if (!native && payload.sid !== undefined) throw new InvalidSessionError('unexpected native session');
    const nativeSessionId = sessionId?.success ? sessionId.data : undefined;
    if (this.isCurrent && !await this.isCurrent(payload.sub, version, nativeSessionId, read && expected === 'access')) {
      throw new InvalidSessionError('revoked session');
    }
    return { accountId: payload.sub, version, ...(nativeSessionId ? { nativeSessionId } : {}) };
  }

  async verify(token: string, expected: 'access' | 'refresh'): Promise<string> {
    return (await this.identity(token, expected)).accountId;
  }
}
