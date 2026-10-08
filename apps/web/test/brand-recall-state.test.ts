import { beforeEach, describe, expect, it, vi } from 'vitest';
import { advanceRecall, readRecall, saveRecall } from '../src/brand/recallState.js';

beforeEach(() => { localStorage.clear(); });

describe('new commander recall progress', () => {
  it('starts empty and isolates accounts', () => {
    expect(readRecall('a')).toEqual({ activeMs: 0, returnShown: false, quizDone: false });
    saveRecall('a', { activeMs: 60_000, returnShown: true, quizDone: false });
    expect(readRecall('a').activeMs).toBe(60_000);
    expect(readRecall('b').activeMs).toBe(0);
  });

  it('rejects corrupt, negative, non-finite and incompatible storage', () => {
    for (const value of ['{', 'null', '{"activeMs":-1}', '{"activeMs":180001,"returnShown":false,"quizDone":false}']) {
      localStorage.setItem('astera:recall:v1:a', value);
      expect(readRecall('a').activeMs).toBe(0);
    }
  });

  it('caps elapsed time at three minutes and ignores backwards/invalid time', () => {
    const state = { activeMs: 179_500, returnShown: false, quizDone: false };
    expect(advanceRecall(state, 1000).activeMs).toBe(180_000);
    for (const delta of [-100, NaN, Infinity]) expect(advanceRecall(state, delta)).toEqual(state);
  });

  it('merges concurrent progress without losing a dismissal or counting two tabs twice', () => {
    saveRecall('a', { activeMs: 100_000, returnShown: true, quizDone: true });
    saveRecall('a', { activeMs: 50_000, returnShown: false, quizDone: false });
    expect(readRecall('a')).toEqual({ activeMs: 100_000, returnShown: true, quizDone: true });
  });

  it('continues working when the browser blocks storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(readRecall('a').activeMs).toBe(0);
    expect(() => saveRecall('a', { activeMs: 5000, returnShown: true, quizDone: false })).not.toThrow();
  });
});
