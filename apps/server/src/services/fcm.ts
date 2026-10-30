import { SignJWT, importPKCS8 } from 'jose';
import { z } from 'zod';
import type { PushMessage, PushTransport } from './notificationCenter.js';

/**
 * FCM HTTP v1, THE BILDIRIM MERKEZI'S WAY OUT. Owner 2026-10-31.
 *
 * Signs in as the Firebase service account with the OAuth2 JWT-bearer grant (RS256, at most an
 * hour, scope firebase.messaging), keeps the access token until shortly before it expires and
 * sends one message per phone. It never throws: by the time it runs the alert is already paid
 * for and committed (`settlePaidAlert`), so an outage is reported, not retried into a double send.
 * Phones FCM no longer knows (404 UNREGISTERED, or 400 naming the registration token) are
 * returned so the caller forgets them; any other refusal keeps the phone.
 */
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
/** The Android channel the app creates for raid alerts; it must exist before a message names it. */
export const ALERT_CHANNEL = 'alerts';

export interface ServiceAccount { projectId: string; clientEmail: string; privateKey: string }

const accountSchema = z.object({
  type: z.literal('service_account'),
  project_id: z.string().min(1),
  client_email: z.string().email(),
  private_key: z.string().includes('PRIVATE KEY'),
}).transform(file => ({ projectId: file.project_id, clientEmail: file.client_email, privateKey: file.private_key }));

/** The key file Firebase hands out, carried base64-encoded in the server env. */
export function parseServiceAccount(base64: string): ServiceAccount {
  return accountSchema.parse(JSON.parse(Buffer.from(base64, 'base64').toString('utf8')));
}

const tokenSchema = z.object({ access_token: z.string().min(1), expires_in: z.number().positive() });
const errorSchema = z.object({ error: z.object({
  status: z.string().optional(),
  message: z.string().optional(),
  details: z.array(z.object({ errorCode: z.string().optional() }).passthrough()).optional(),
}) });

export function fcmTransport(account: ServiceAccount, options: {
  fetch?: typeof fetch;
  now?: () => number;
  onError?: (error: unknown) => void;
} = {}): PushTransport {
  const send = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  const report = options.onError ?? (() => undefined);
  let cached: { token: string; until: number } | null = null;

  async function accessToken(): Promise<string> {
    if (cached && now() < cached.until) return cached.token;
    const issued = Math.floor(now() / 1000);
    const assertion = await new SignJWT({ scope: SCOPE })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuer(account.clientEmail).setAudience(TOKEN_URL)
      .setIssuedAt(issued).setExpirationTime(issued + 3600)
      .sign(await importPKCS8(account.privateKey, 'RS256'));
    const response = await send(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }).toString(),
    });
    if (!response.ok) throw new Error(`FCM sign-in refused: ${response.status}`);
    const granted = tokenSchema.parse(await response.json());
    // A minute early, so a token never expires between this check and Google reading it.
    cached = { token: granted.access_token, until: now() + (granted.expires_in - 60) * 1000 };
    return cached.token;
  }

  async function deliver(token: string, message: PushMessage, retried = false): Promise<'sent' | 'invalid' | 'failed'> {
    const response = await send(`https://fcm.googleapis.com/v1/projects/${account.projectId}/messages:send`, {
      method: 'POST',
      headers: { authorization: `Bearer ${await accessToken()}`, 'content-type': 'application/json' },
      body: JSON.stringify({ message: {
        token,
        notification: { title: message.title, body: message.body },
        data: message.data,
        // HIGH wakes a dozing phone; the tag lets a later alert about the same raid replace this one.
        android: { priority: 'HIGH', notification: { channelId: ALERT_CHANNEL, ...(message.data.refId ? { tag: message.data.refId } : {}) } },
      } }),
    });
    if (response.ok) return 'sent';
    if (response.status === 401 && !retried) {
      cached = null;
      return deliver(token, message, true);
    }
    const body = errorSchema.safeParse(await response.json().catch(() => null));
    const error = body.success ? body.data.error : undefined;
    const code = error?.details?.find(detail => detail.errorCode)?.errorCode ?? error?.status;
    if (response.status === 404 || code === 'UNREGISTERED') return 'invalid';
    if (code === 'INVALID_ARGUMENT' && /registration token/i.test(error?.message ?? '')) return 'invalid';
    report(new Error(`FCM send failed: ${response.status} ${code ?? ''}`.trim()));
    return 'failed';
  }

  return {
    async send(tokens, message) {
      const invalid: string[] = [];
      for (const token of tokens) {
        try {
          if (await deliver(token, message) === 'invalid') invalid.push(token);
        } catch (error) {
          report(error);
        }
      }
      return { invalid };
    },
  };
}
