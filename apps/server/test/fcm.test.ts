import { exportPKCS8, exportSPKI, generateKeyPair, importSPKI, jwtVerify } from 'jose';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { fcmTransport, parseServiceAccount, type ServiceAccount } from '../src/services/fcm.js';
import type { PushMessage } from '../src/services/notificationCenter.js';

/** Bildirim Merkezi push (owner 2026-10-31): FCM HTTP v1 with the project's service account. */
let account: ServiceAccount;
let publicKey: string;
beforeAll(async () => {
  const pair = await generateKeyPair('RS256', { extractable: true });
  account = { projectId: 'astera-test', clientEmail: 'push@astera-test.iam.gserviceaccount.com', privateKey: await exportPKCS8(pair.privateKey) };
  publicKey = await exportSPKI(pair.publicKey);
});

const message: PushMessage = { kind: 'incoming_attack', title: 'Saldırı geliyor', body: 'Vega dünyana bir filo yaklaşıyor. Varış: 5 dk.', data: { kind: 'incoming_attack', refId: 'm-1', planetId: 'p-1' } };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SEND_URL = 'https://fcm.googleapis.com/v1/projects/astera-test/messages:send';

function fakeGoogle(send: (token: string) => Response = () => json(200, { name: 'projects/astera-test/messages/1' })) {
  let issued = 0;
  const calls: { url: string; init: RequestInit; body: string }[] = [];
  const fetch = vi.fn((input: string | URL | Request, init: RequestInit = {}) => {
    const url = input instanceof Request ? input.url : input.toString();
    const text = typeof init.body === 'string' ? init.body : '';
    calls.push({ url, init, body: text });
    if (url === TOKEN_URL) return Promise.resolve(json(200, { access_token: `access-${++issued}`, expires_in: 3600, token_type: 'Bearer' }));
    const body = JSON.parse(text) as { message: { token: string } };
    return Promise.resolve(send(body.message.token));
  });
  return { fetch, calls, sends: () => calls.filter(call => call.url === SEND_URL) };
}

describe('the service account', () => {
  it('reads the JSON Firebase hands out, from the base64 the server env carries', () => {
    const file = { type: 'service_account', project_id: 'p', client_email: 'e@p.iam.gserviceaccount.com', private_key: '-----BEGIN PRIVATE KEY-----\nx\n-----END PRIVATE KEY-----\n', private_key_id: 'k' };
    expect(parseServiceAccount(Buffer.from(JSON.stringify(file)).toString('base64')))
      .toEqual({ projectId: 'p', clientEmail: 'e@p.iam.gserviceaccount.com', privateKey: file.private_key });
  });

  it('refuses anything that is not a service account', () => {
    expect(() => parseServiceAccount(Buffer.from(JSON.stringify({ type: 'authorized_user' })).toString('base64'))).toThrow();
    expect(() => parseServiceAccount('not base64 json')).toThrow();
  });
});

describe('the FCM transport', () => {
  it('signs in as the service account for the messaging scope, then sends one message per phone', async () => {
    const google = fakeGoogle();
    const transport = fcmTransport(account, { fetch: google.fetch });
    await expect(transport.send(['phone-a', 'phone-b'], message)).resolves.toEqual({ invalid: [] });

    const grant = new URLSearchParams(google.calls[0]!.body);
    expect(google.calls[0]!.url).toBe(TOKEN_URL);
    expect(grant.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer');
    const { payload } = await jwtVerify(grant.get('assertion')!, await importSPKI(publicKey, 'RS256'), { audience: TOKEN_URL, issuer: account.clientEmail });
    expect(payload.scope).toBe('https://www.googleapis.com/auth/firebase.messaging');

    expect(google.sends()).toHaveLength(2);
    const sent = google.sends()[0]!;
    expect(new Headers(sent.init.headers).get('authorization')).toBe('Bearer access-1');
    expect(JSON.parse(sent.body)).toEqual({ message: {
      token: 'phone-a',
      notification: { title: message.title, body: message.body },
      data: message.data,
      android: { priority: 'HIGH', notification: { channelId: 'alerts', tag: 'm-1' } },
    } });
  });

  it('keeps the access token until it is about to expire', async () => {
    let now = 0;
    const google = fakeGoogle();
    const transport = fcmTransport(account, { fetch: google.fetch, now: () => now });
    await transport.send(['phone-a'], message);
    now = 3_000_000;
    await transport.send(['phone-a'], message);
    expect(google.calls.filter(call => call.url === TOKEN_URL)).toHaveLength(1);
    now = 3_560_000;
    await transport.send(['phone-a'], message);
    expect(google.calls.filter(call => call.url === TOKEN_URL)).toHaveLength(2);
    expect(new Headers(google.sends()[2]!.init.headers).get('authorization')).toBe('Bearer access-2');
  });

  it('names the phones FCM no longer knows, so the server can forget them', async () => {
    const google = fakeGoogle(token => token === 'gone'
      ? json(404, { error: { code: 404, status: 'NOT_FOUND', details: [{ '@type': 'type.googleapis.com/google.firebase.fcm.v1.FcmError', errorCode: 'UNREGISTERED' }] } })
      : json(200, {}));
    const transport = fcmTransport(account, { fetch: google.fetch });
    await expect(transport.send(['live', 'gone'], message)).resolves.toEqual({ invalid: ['gone'] });
  });

  it('forgets a phone whose token FCM calls invalid, but not one refused for any other bad argument', async () => {
    const google = fakeGoogle(token => token === 'malformed'
      ? json(400, { error: { code: 400, message: 'The registration token is not a valid FCM registration token', status: 'INVALID_ARGUMENT', details: [{ '@type': 'type.googleapis.com/google.firebase.fcm.v1.FcmError', errorCode: 'INVALID_ARGUMENT' }] } })
      : json(400, { error: { code: 400, message: 'Message is too big', status: 'INVALID_ARGUMENT', details: [{ '@type': 'type.googleapis.com/google.firebase.fcm.v1.FcmError', errorCode: 'INVALID_ARGUMENT' }] } }));
    const errors = vi.fn();
    const transport = fcmTransport(account, { fetch: google.fetch, onError: errors });
    await expect(transport.send(['malformed', 'fine'], message)).resolves.toEqual({ invalid: ['malformed'] });
    expect(errors).toHaveBeenCalledTimes(1);
  });

  it('signs in again once when a send is refused as unauthenticated', async () => {
    let refused = false;
    const google = fakeGoogle(() => {
      if (refused) return json(200, {});
      refused = true;
      return json(401, { error: { code: 401, status: 'UNAUTHENTICATED' } });
    });
    const transport = fcmTransport(account, { fetch: google.fetch });
    await expect(transport.send(['phone-a'], message)).resolves.toEqual({ invalid: [] });
    expect(google.sends()).toHaveLength(2);
    expect(new Headers(google.sends()[1]!.init.headers).get('authorization')).toBe('Bearer access-2');
  });

  it('never throws: an outage is reported and the phone is kept', async () => {
    const onError = vi.fn();
    const failing = vi.fn((_input: string | URL | Request, _init?: RequestInit): Promise<Response> => Promise.reject(new Error('network down')));
    await expect(fcmTransport(account, { fetch: failing, onError }).send(['phone-a'], message)).resolves.toEqual({ invalid: [] });
    expect(onError).toHaveBeenCalled();

    const google = fakeGoogle(() => json(500, { error: { code: 500, status: 'INTERNAL' } }));
    const errors = vi.fn();
    await expect(fcmTransport(account, { fetch: google.fetch, onError: errors }).send(['phone-a'], message)).resolves.toEqual({ invalid: [] });
    expect(errors).toHaveBeenCalled();
  });
});
