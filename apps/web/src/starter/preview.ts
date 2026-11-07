interface PreviewEnvironment {
  DEV: boolean;
  VITE_VISUAL_TEST?: string;
}

/** The side-by-side galaxy scene, for looking at on a phone. Never in a player's build. */
export function canOpenStarterPreview(env: PreviewEnvironment, search: string): boolean {
  return (env.DEV || env.VITE_VISUAL_TEST === '1') && new URLSearchParams(search).get('starterPreview') === '1';
}
