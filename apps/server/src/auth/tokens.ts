import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

/**
 * Guest-first auth.
 *
 * The Return Test requires a player to be looking at their own planet inside 60
 * seconds; a login wall makes that impossible. So an account is created on first
 * contact with no form to fill in, and email is an optional upgrade later that
 * attaches to the same account.
 *
 * Short access token + long refresh cookie, both stateless. No session store.
 */

export interface AccessClaims extends JWTPayload {
  sub: string;
  typ: 'access';
}

export interface RefreshClaims extends JWTPayload {
  sub: string;
  typ: 'refresh';
}

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
  ) {
    this.key = new TextEncoder().encode(secret);
  }

  async issueAccess(accountId: string): Promise<string> {
    return new SignJWT({ typ: 'access' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(accountId)
      .setIssuedAt()
      .setExpirationTime(`${this.accessMinutes}m`)
      .sign(this.key);
  }

  async issueRefresh(accountId: string): Promise<string> {
    return new SignJWT({ typ: 'refresh' })
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
  async verify(token: string, expected: 'access' | 'refresh'): Promise<string> {
    const { payload } = await jwtVerify(token, this.key, {
      algorithms: ['HS256'],
    });
    if (payload.typ !== expected) throw new Error(`expected a ${expected} token`);
    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      throw new Error('token has no subject');
    }
    return payload.sub;
  }
}
