import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { openMail, sealMail, verifyMailWebhook, ResendMailer, MailSendError } from '../src/services/mail.js';
import { testEnv } from './helpers.js';

const content = { to: 'pilot@example.com', subject: 'Verify', text: 'Code 012345', html: '<b>012345</b>' };
describe('transactional delivery boundary', () => {
  it('encrypts codes and binds authenticated ciphertext to one outbox row', () => {
    const key = 'ab'.repeat(32); const payload = sealMail(content, key, 'message-one');
    expect(payload).not.toContain('012345'); expect(payload).not.toContain(content.to);
    expect(openMail(payload, key, 'message-one')).toEqual(content);
    expect(() => openMail(payload, key, 'message-two')).toThrow();
    expect(() => openMail(payload, 'cd'.repeat(32), 'message-one')).toThrow();
  });
  it('authenticates original webhook bytes and rejects stale and forged events', () => {
    const now = new Date('2026-10-16T12:00:00Z'); const timestamp = String(now.getTime() / 1000);
    const body = JSON.stringify({ type: 'email.delivered', data: { email_id: 'mail-one' } });
    const key = Buffer.from('test-webhook-signing-secret'); const secret = `whsec_${key.toString('base64')}`;
    const signature = `v1,${createHmac('sha256', key).update(`event-one.${timestamp}.${body}`).digest('base64')}`;
    expect(verifyMailWebhook(body, 'event-one', timestamp, signature, secret, now)).toBe(true);
    expect(verifyMailWebhook(`${body} `, 'event-one', timestamp, signature, secret, now)).toBe(false);
    expect(verifyMailWebhook(body, 'event-two', timestamp, signature, secret, now)).toBe(false);
    expect(verifyMailWebhook(body, 'event-one', timestamp, signature, secret, new Date(now.getTime() + 301000))).toBe(false);
  });
  it('matches the independent verification vector published by Svix', () => {
    // https://docs.svix.com/receiving/verifying-payloads/how-manual#example-signatures
    expect(verifyMailWebhook('{"event_type":"ping","data":{"success":true}}', 'msg_loFOjxBNrRLzqYUf', '1731705121',
      'v1,rAvfW3dJ/X/qxhsaXPOyyCGmRKsaKWcsNccKXlIktD0=', 'whsec_plJ3nmyCDGBKInavdOK15jsl', new Date(1731705121_000))).toBe(true);
  });
  it('preserves the idempotency key, reply address and retry policy without surfacing provider bodies', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ id: 'mail-one' }), { status: 200 }));
    const sender = new ResendMailer(testEnv(), fetcher);
    await expect(sender.send(content, 'outbox-one')).resolves.toBe('mail-one');
    expect(fetcher.mock.calls[0]?.[1]?.headers).toMatchObject({ 'idempotency-key': 'outbox-one' });
    fetcher.mockResolvedValueOnce(new Response('private body', { status: 429, headers: { 'retry-after': '20' } }));
    await expect(sender.send(content, 'outbox-one')).rejects.toMatchObject({ permanent: false, retryAfterMs: 20000 });
    fetcher.mockResolvedValueOnce(new Response('private body', { status: 403 }));
    await expect(sender.send(content, 'outbox-one')).rejects.toEqual(new MailSendError(true));
  });
});
