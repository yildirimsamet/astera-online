import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { canEnterArena, canOpenArenaSandbox } from '../../src/arena/flags.js';

describe('arena entry flags', () => {
  it('opens the prototype in development', () => {
    expect(canEnterArena({ DEV: true })).toBe(true);
  });

  // Owner 2026-11-26: "VITE_ARENA değişkenine gerek var mı ki?" No: the Yarık is open to all, and a web build
  // that forgot the flag hid it from everyone (live 2026-11-25). The arena process's own answer is the door.
  it('lets the arena process decide in production: its yes opens the door, with no build flag', () => {
    expect(canEnterArena({ DEV: false }, true)).toBe(true);
    expect(canEnterArena({ DEV: false }, false)).toBe(false);
    expect(canEnterArena({ DEV: false })).toBe(false);
  });

  it('opens the door in a bundled app too, whose socket reaches the arena beside its API', () => {
    const app = { DEV: false, VITE_ASTERA_PLATFORM: 'native-production' };
    expect(canEnterArena(app, true)).toBe(true);
    expect(canEnterArena(app, false)).toBe(false);
  });

  it('has no build flag left for a release to forget', () => {
    for (const file of ['src/App.tsx', 'src/arena/flags.ts', 'src/vite-env.d.ts', 'mobileBuildCli.ts', '../../Dockerfile', '../../deploy/deploy.sh']) {
      expect(readFileSync(file, 'utf8'), file).not.toContain('VITE_ARENA');
    }
  });

  it('opens an unauthenticated sandbox only in development or an explicit visual-test build', () => {
    expect(canOpenArenaSandbox({ DEV: true }, '?arena=sandbox')).toBe(true);
    expect(canOpenArenaSandbox({ DEV: true }, '?arena=resume')).toBe(false);
    expect(canOpenArenaSandbox({ DEV: false }, '?arena=sandbox')).toBe(false);
    expect(canOpenArenaSandbox({ DEV: false, VITE_VISUAL_TEST: '1' }, '?arena=sandbox')).toBe(true);
    expect(canOpenArenaSandbox({ DEV: false, VITE_VISUAL_TEST: 'true' }, '?arena=sandbox')).toBe(false);
  });
});
