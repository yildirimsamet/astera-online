import { describe, expect, it } from 'vitest';
import { campaignId, classify, parseRecipients, runCampaign, sendDm, validateText } from './x-dm.mjs';

const response = (status, body) => ({ status, json: async () => body });

describe('parseRecipients', () => {
  it('reads one handle per line, drops @, comments, blanks and case-insensitive duplicates', () => {
    const { usernames, invalid } = parseRecipients('@Alice\n# yorum\n\n bob_1 \nalice\nBOB_1\ncarol # not\n');
    expect(usernames).toEqual(['Alice', 'bob_1']);
    expect(invalid).toEqual([{ line: 7, value: 'carol # not' }]);
  });

  it('rejects handles X cannot have', () => {
    const { usernames, invalid } = parseRecipients('ok_name\nhas-dash\nwaytoolonghandle16\n@\nüğ');
    expect(usernames).toEqual(['ok_name']);
    expect(invalid.map(entry => entry.line)).toEqual([2, 3, 4, 5]);
  });

  it('handles CRLF files', () => {
    expect(parseRecipients('a\r\nb\r\n').usernames).toEqual(['a', 'b']);
  });
});

describe('validateText', () => {
  it('accepts a normal message and trims it', () => {
    expect(validateText('  Akşam 19:00 reset geliyor \n')).toBe('Akşam 19:00 reset geliyor');
  });

  it('rejects empty and over-long messages', () => {
    expect(() => validateText('   ')).toThrow(/boş/);
    expect(() => validateText('x'.repeat(10_001))).toThrow(/10000/);
    expect(validateText('x'.repeat(10_000))).toHaveLength(10_000);
  });
});

describe('campaignId', () => {
  it('is stable for the same text on the same day and changes with either', () => {
    const day = new Date(2026, 9, 28, 18, 0);
    expect(campaignId('Yeni sezon', day)).toBe(campaignId('Yeni sezon', new Date(2026, 9, 28, 9, 0)));
    expect(campaignId('Yeni sezon', day)).not.toBe(campaignId('Yeni sezon!', day));
    expect(campaignId('Yeni sezon', day)).not.toBe(campaignId('Yeni sezon', new Date(2026, 9, 29, 9, 0)));
    expect(campaignId('Yeni sezon', day)).toMatch(/^2026-10-28:[0-9a-f]{12}$/);
  });

  it('covers every variant, so a resumed run keeps one campaign whatever text each handle got', () => {
    const day = new Date(2026, 9, 28, 18, 0);
    expect(campaignId(['Yeni sezon'], day)).toBe(campaignId('Yeni sezon', day));
    expect(campaignId(['A', 'B'], day)).not.toBe(campaignId(['A'], day));
    expect(campaignId(['A', 'B'], day)).not.toBe(campaignId(['AB'], day));
  });
});

describe('classify', () => {
  it.each([
    [200, { status: 'success', data: { id: '1' } }, 'sent'],
    [400, { error: 'Missing required field' }, 'abort'],
    [401, { error: 'Invalid auth_token' }, 'abort'],
    [403, { error: 'no DMs', twitter_error_code: 349 }, 'skip'],
    [403, { error: 'cannot send requests', twitter_error_code: 476 }, 'skip'],
    [404, { error: 'not found' }, 'skip'],
    [410, { error: 'suspended' }, 'abort'],
    [423, { error: 'locked' }, 'abort'],
    [429, { error: 'Daily DM limit', twitter_error_code: 502 }, 'abort'],
    [429, { error: 'Please try again shortly.' }, 'retry'],
    [500, {}, 'retry'],
    [502, {}, 'retry'],
    [503, {}, 'retry'],
    [503, { twitter_error_code: 226 }, 'abort'],
  ])('%i %j → %s', (status, body, expected) => {
    expect(classify(status, body)).toBe(expected);
  });
});

describe('sendDm', () => {
  it('posts the documented body with the bearer key', async () => {
    const calls = [];
    const fetchImpl = async (url, init) => { calls.push({ url, init }); return response(200, { status: 'success', data: { id: '9' } }); };
    const result = await sendDm({ fetchImpl, apiKey: 'K', authToken: 'T', username: 'alice', text: 'Selam' });
    expect(result).toEqual({ outcome: 'sent', status: 200, body: { status: 'success', data: { id: '9' } } });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.getxapi.com/twitter/dm/send');
    expect(calls[0].init.method).toBe('POST');
    expect(calls[0].init.headers).toEqual({ Authorization: 'Bearer K', 'Content-Type': 'application/json' });
    expect(JSON.parse(calls[0].init.body)).toEqual({ auth_token: 'T', recipient_username: 'alice', text: 'Selam' });
  });

  it('sends ct0 and twid only as a pair', async () => {
    const bodies = [];
    const fetchImpl = async (_url, init) => { bodies.push(JSON.parse(init.body)); return response(200, { status: 'success' }); };
    await sendDm({ fetchImpl, apiKey: 'K', authToken: 'T', ct0: 'c', twid: 'u=1', username: 'a', text: 'x' });
    await sendDm({ fetchImpl, apiKey: 'K', authToken: 'T', ct0: 'c', username: 'a', text: 'x' });
    expect(bodies[0]).toMatchObject({ ct0: 'c', twid: 'u=1' });
    expect(bodies[1]).not.toHaveProperty('ct0');
    expect(bodies[1]).not.toHaveProperty('twid');
  });

  it('turns a network failure or a non-JSON body into a retry', async () => {
    const thrown = await sendDm({ fetchImpl: async () => { throw new Error('ECONNRESET'); }, apiKey: 'K', authToken: 'T', username: 'a', text: 'x' });
    expect(thrown).toMatchObject({ outcome: 'retry', status: 0, body: { error: 'ECONNRESET' } });
    const html = await sendDm({ fetchImpl: async () => ({ status: 502, json: async () => { throw new SyntaxError('bad'); } }), apiKey: 'K', authToken: 'T', username: 'a', text: 'x' });
    expect(html).toMatchObject({ outcome: 'retry', status: 502 });
  });
});

describe('runCampaign', () => {
  const quiet = () => undefined;
  const setup = (script, extra = {}) => {
    const sleeps = [], logged = [], sentTo = [], texts = [];
    const send = async (username, text) => {
      sentTo.push(username);
      texts.push(text);
      const next = script[username]?.shift() ?? { outcome: 'sent', status: 200, body: { status: 'success', data: { id: `id-${username}` } } };
      return next;
    };
    return { sleeps, logged, sentTo, texts, options: {
      send, texts: ['T'], sleep: async ms => { sleeps.push(ms); }, record: entry => logged.push(entry), report: quiet,
      gapMs: 1000, jitterMs: 0, random: () => 0, campaign: 'c1', now: () => new Date('2026-10-28T16:00:00Z'), ...extra,
    } };
  };

  it('sends to everyone in order, pausing between sends but not after the last', async () => {
    const { sleeps, logged, sentTo, options } = setup({});
    const summary = await runCampaign({ ...options, usernames: ['a', 'b', 'c'] });
    expect(sentTo).toEqual(['a', 'b', 'c']);
    expect(sleeps).toEqual([1000, 1000]);
    expect(summary).toEqual({ sent: 3, failed: 0, skippedAlreadySent: 0, aborted: null });
    expect(logged.map(entry => [entry.username, entry.status, entry.campaign, entry.messageId])).toEqual([
      ['a', 'sent', 'c1', 'id-a'], ['b', 'sent', 'c1', 'id-b'], ['c', 'sent', 'c1', 'id-c'],
    ]);
  });

  it('skips handles already sent in this campaign, case-insensitively', async () => {
    const { sentTo, options } = setup({});
    const summary = await runCampaign({ ...options, usernames: ['Alice', 'bob'], alreadySent: new Set(['alice']) });
    expect(sentTo).toEqual(['bob']);
    expect(summary.skippedAlreadySent).toBe(1);
  });

  it('retries with backoff, honours retry_after, then gives up after three attempts', async () => {
    const retry = body => ({ outcome: 'retry', status: 429, body });
    const { sleeps, logged, sentTo, options } = setup({
      a: [retry({ retry_after: 7 }), { outcome: 'sent', status: 200, body: { status: 'success', data: { id: 'x' } } }],
      b: [retry({}), retry({}), retry({ error: 'busy' })],
    });
    const summary = await runCampaign({ ...options, usernames: ['a', 'b'] });
    expect(sentTo).toEqual(['a', 'a', 'b', 'b', 'b']);
    expect(sleeps).toEqual([7000, 1000, 5000, 15000]);
    expect(summary).toMatchObject({ sent: 1, failed: 1, aborted: null });
    expect(logged[1]).toMatchObject({ username: 'b', status: 'failed', httpStatus: 429, error: 'busy' });
  });

  it('records a per-recipient refusal and moves on', async () => {
    const { logged, sentTo, options } = setup({ a: [{ outcome: 'skip', status: 403, body: { error: 'closed', twitter_error_code: 349 } }] });
    const summary = await runCampaign({ ...options, usernames: ['a', 'b'] });
    expect(sentTo).toEqual(['a', 'b']);
    expect(summary).toMatchObject({ sent: 1, failed: 1 });
    expect(logged[0]).toMatchObject({ username: 'a', status: 'failed', httpStatus: 403, twitterErrorCode: 349 });
  });

  it('stops the whole run on an account-level failure without logging the recipient as sent', async () => {
    const { logged, sentTo, options } = setup({ b: [{ outcome: 'abort', status: 429, body: { error: 'Daily DM limit', twitter_error_code: 502 } }] });
    const summary = await runCampaign({ ...options, usernames: ['a', 'b', 'c'] });
    expect(sentTo).toEqual(['a', 'b']);
    expect(summary).toEqual({ sent: 1, failed: 0, skippedAlreadySent: 0, aborted: { username: 'b', status: 429, error: 'Daily DM limit', twitterErrorCode: 502 } });
    expect(logged.map(entry => entry.username)).toEqual(['a']);
  });

  it('deals the variants round-robin over the pending handles and logs which one each got', async () => {
    const { texts, logged, options } = setup({});
    await runCampaign({ ...options, texts: ['A', 'B', 'C'], usernames: ['done', 'u1', 'u2', 'u3', 'u4'], alreadySent: new Set(['done']) });
    expect(texts).toEqual(['A', 'B', 'C', 'A']);
    expect(logged.map(entry => entry.variant)).toEqual([0, 1, 2, 0]);
  });

  it('retries a handle with the same variant it started on', async () => {
    const { texts, options } = setup({ u1: [{ outcome: 'retry', status: 500, body: {} }] });
    await runCampaign({ ...options, texts: ['A', 'B'], usernames: ['u1', 'u2'] });
    expect(texts).toEqual(['A', 'A', 'B']);
  });

  it('adds random jitter to the gap', async () => {
    const { sleeps, options } = setup({}, { jitterMs: 4000, random: () => 0.5 });
    await runCampaign({ ...options, usernames: ['a', 'b'] });
    expect(sleeps).toEqual([3000]);
  });
});
