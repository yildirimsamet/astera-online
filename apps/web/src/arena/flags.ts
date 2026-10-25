interface ArenaEnvironment {
  DEV: boolean;
  VITE_ARENA?: string;
  VITE_VISUAL_TEST?: string;
  VITE_ASTERA_PLATFORM?: string;
}

/** `allowed` is the arena process's own answer for this account (ARENA_PILOTS). */
export function canEnterArena(env: ArenaEnvironment, allowed = false): boolean {
  return env.DEV || (env.VITE_ARENA === '1' && (env.VITE_ASTERA_PLATFORM ?? 'web') === 'web' && allowed);
}

export function canOpenArenaSandbox(env: ArenaEnvironment, search: string): boolean {
  return (env.DEV || env.VITE_VISUAL_TEST === '1') && new URLSearchParams(search).get('arena') === 'sandbox';
}
