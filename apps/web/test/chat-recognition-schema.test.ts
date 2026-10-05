import { describe, expect, it } from 'vitest';
import { chatPostSchema, clanChatPostSchema, dmPostSchema } from '../src/api/schemas.js';

const message = {
  id: 'm-1', authorPlayerId: 'p-1', planetId: 'world-1', username: 'Supporter',
  language: 'en', content: 'Hello', createdAt: '2026-10-05T10:00:00Z', self: false,
};

describe.each([
  ['general', chatPostSchema], ['clan', clanChatPostSchema], ['DM', dmPostSchema],
] as const)('%s chat recognition at the API boundary', (_channel, schema) => {
  it('retains the supporter and podium together rather than stripping server decoration', () => {
    const result = schema.parse({ conversationId: 'dm-1', message: { ...message, supporter: true, previousSeasonRank: 3 } });
    expect(result.message).toMatchObject({ supporter: true, previousSeasonRank: 3 });
    expect(result.message.createdAt).toBeInstanceOf(Date);
  });

  it('accepts a legacy response without granting recognition', () => {
    const result = schema.parse({ conversationId: 'dm-1', message });
    expect(result.message.supporter).toBeUndefined();
    expect(result.message.previousSeasonRank).toBeUndefined();
  });

  it('rejects string flags instead of treating any truthy value as a supporter', () => {
    expect(schema.safeParse({ conversationId: 'dm-1', message: { ...message, supporter: 'false' } }).success).toBe(false);
  });
});
