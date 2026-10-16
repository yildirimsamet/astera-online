import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

/** Signed credentials carry the durable account version; legacy tokens use version zero. */

export interface AccessClaims extends JWTPayload {
  sub: string;
  typ: 'access';
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
    private readonly isCurrent?: (accountId: string, version: number) => Promise<boolean>,
  ) {
    this.key = new TextEncoder().encode(secret);
  }

  async issueAccess(accountId: string, version = 0): Promise<string> {
    return new SignJWT({ typ: 'access', ver: version })
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
  async identity(token: string, expected: 'access' | 'refresh'): Promise<{ accountId: string; version: number }> {
    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(token, this.key, { algorithms: ['HS256'] }));
    } catch { throw new InvalidSessionError('Invalid signature or expiry'); }
    if (payload.typ !== expected) throw new InvalidSessionError(`expected a ${expected} token`);
    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      throw new InvalidSessionError('token has no subject');
    }
    const version = payload.ver === undefined ? 0 : payload.ver;
    if (typeof version !== 'number' || !Number.isSafeInteger(version) || version < 0) throw new InvalidSessionError('invalid token version');
    if (this.isCurrent && !await this.isCurrent(payload.sub, version)) throw new InvalidSessionError('revoked session');
    return { accountId: payload.sub, version };
  }

  async verify(token: string, expected: 'access' | 'refresh'): Promise<string> {
    return (await this.identity(token, expected)).accountId;
  }
}
