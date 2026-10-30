import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/env.js';

const base = { DATABASE_URL: 'postgres://test', JWT_SECRET: 'test-secret-that-is-long-enough' };
const file = { type: 'service_account', project_id: 'astera', client_email: 'push@astera.iam.gserviceaccount.com', private_key: '-----BEGIN PRIVATE KEY-----\nx\n-----END PRIVATE KEY-----\n' };
const encoded = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64');

describe('FCM environment', () => {
  it('leaves push off when no service account is given', () => {
    expect(loadEnv(base).FCM_SERVICE_ACCOUNT).toBeNull();
    expect(loadEnv({ ...base, FCM_SERVICE_ACCOUNT: ' ' }).FCM_SERVICE_ACCOUNT).toBeNull();
  });

  it('reads the base64 service account into what the transport needs', () => {
    expect(loadEnv({ ...base, FCM_SERVICE_ACCOUNT: encoded(file) }).FCM_SERVICE_ACCOUNT)
      .toEqual({ projectId: 'astera', clientEmail: file.client_email, privateKey: file.private_key });
  });

  it('refuses to start on a value that is not a service account, rather than silently not sending', () => {
    expect(() => loadEnv({ ...base, FCM_SERVICE_ACCOUNT: encoded({ ...file, type: 'authorized_user' }) })).toThrow();
    expect(() => loadEnv({ ...base, FCM_SERVICE_ACCOUNT: 'garbage' })).toThrow();
  });
});
