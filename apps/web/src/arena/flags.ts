interface ArenaEnvironment {
  DEV: boolean;
  VITE_ARENA?: string;
  VITE_VISUAL_TEST?: string;
}

/** `allowed` is the arena process's own answer for this account (ARENA_PILOTS). */
export function canEnterArena(env: ArenaEnvironment, allowed = false): boolean {
  return env.DEV || (env.VITE_ARENA === '1' && allowed);
}

export function canOpenArenaSandbox(env: ArenaEnvironment, search: string): boolean {
  return (env.DEV || env.VITE_VISUAL_TEST === '1') && new URLSearchParams(search).get('arena') === 'sandbox';
}
