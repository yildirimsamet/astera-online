import { describe, expect, it } from 'vitest';
import { ApiError } from '../src/api/client.js';
import { createQueryClient } from '../src/api/queryClient.js';

/**
 * ONE LAYER REPEATS A BUSY ANSWER. The API client has already tried a `503 RETRYABLE`
 * three times (scaling plan F1.9); a query repeating that made six requests of a server
 * that said it was overloaded.
 */
describe('a failed read', () => {
  const retry = createQueryClient().getDefaultOptions().queries?.retry;
  const again = (count: number, error: Error): boolean => {
    if (typeof retry !== 'function') throw new Error('the query retry must look at the error');
    return retry(count, error);
  };

  it('gets one more try', () => {
    expect(again(0, new Error('network'))).toBe(true);
    expect(again(1, new Error('network'))).toBe(false);
  });

  it('gets none when the client already repeated it', () => {
    expect(again(0, new ApiError('RETRYABLE', 'busy', 503))).toBe(false);
  });
});
