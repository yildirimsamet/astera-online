import { expect, it } from 'vitest';
import { loadEnv } from '../src/env.js';

const first = '11111111-1111-4111-8111-111111111111';
const second = '22222222-2222-4222-8222-222222222222';
const base = { DATABASE_URL: 'postgres://fixture' };

it('leaves normal Silent Space eligibility unchanged by default', () => {
  expect(loadEnv(base).SILENT_SPACE_EXEMPT_ACCOUNT_IDS).toEqual([]);
});
it('accepts only explicit UUID account identities and normalizes whitespace and duplicates', () => {
  expect(loadEnv({ ...base, SILENT_SPACE_EXEMPT_ACCOUNT_IDS: ` ${first}, ${second},${first} ` }).SILENT_SPACE_EXEMPT_ACCOUNT_IDS).toEqual([first, second]);
});
it.each(['testaccount', 'null', `${first},bad-id`])('rejects a malformed exemption list: %s', value => {
  expect(() => loadEnv({ ...base, SILENT_SPACE_EXEMPT_ACCOUNT_IDS: value })).toThrow(/SILENT_SPACE_EXEMPT_ACCOUNT_IDS/);
});
it('bounds the operator exemption list', () => {
  const ids = Array.from({ length: 21 }, (_, i) => `00000000-0000-4000-8000-${(i + 1).toString(16).padStart(12, '0')}`);
  expect(() => loadEnv({ ...base, SILENT_SPACE_EXEMPT_ACCOUNT_IDS: ids.join(',') })).toThrow(/SILENT_SPACE_EXEMPT_ACCOUNT_IDS/);
});
