import { describe, expect, it } from 'vitest';
import { canEnterArena, canOpenArenaSandbox } from '../../src/arena/flags.js';

describe('arena entry flags', () => {
  it('opens the prototype in development', () => {
    expect(canEnterArena({ DEV: true })).toBe(true);
  });

  it('keeps production closed unless the build flag is on and the server admits this account', () => {
    expect(canEnterArena({ DEV: false }, true)).toBe(false);
    expect(canEnterArena({ DEV: false, VITE_ARENA: '0' }, true)).toBe(false);
    expect(canEnterArena({ DEV: false, VITE_ARENA: 'true' }, true)).toBe(false);
    expect(canEnterArena({ DEV: false, VITE_ARENA: '1' }, false)).toBe(false);
    expect(canEnterArena({ DEV: false, VITE_ARENA: '1' }, true)).toBe(true);
  });

  it('keeps the door shut in a bundled app, whose socket has no arena host', () => {
    expect(canEnterArena({ DEV: false, VITE_ARENA: '1', VITE_ASTERA_PLATFORM: 'android' }, true)).toBe(false);
    expect(canEnterArena({ DEV: false, VITE_ARENA: '1', VITE_ASTERA_PLATFORM: 'web' }, true)).toBe(true);
  });

  it('opens an unauthenticated sandbox only in development or an explicit visual-test build', () => {
    expect(canOpenArenaSandbox({ DEV: true }, '?arena=sandbox')).toBe(true);
    expect(canOpenArenaSandbox({ DEV: true }, '?arena=resume')).toBe(false);
    expect(canOpenArenaSandbox({ DEV: false, VITE_ARENA: '1' }, '?arena=sandbox')).toBe(false);
    expect(canOpenArenaSandbox({ DEV: false, VITE_VISUAL_TEST: '1' }, '?arena=sandbox')).toBe(true);
    expect(canOpenArenaSandbox({ DEV: false, VITE_VISUAL_TEST: 'true' }, '?arena=sandbox')).toBe(false);
  });
});
