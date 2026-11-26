interface ArenaEnvironment {
  DEV: boolean;
  VITE_VISUAL_TEST?: string;
}

/**
 * `allowed` is the arena process's own answer: it is up, and this is a signed-in account. It is the only
 * door; a build flag on top of it once hid the Yarık from everyone when a release forgot it (2026-11-26).
 */
export function canEnterArena(env: ArenaEnvironment, allowed = false): boolean {
  return env.DEV || allowed;
}

export function canOpenArenaSandbox(env: ArenaEnvironment, search: string): boolean {
  return (env.DEV || env.VITE_VISUAL_TEST === '1') && new URLSearchParams(search).get('arena') === 'sandbox';
}
