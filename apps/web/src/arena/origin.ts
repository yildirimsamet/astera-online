interface ArenaOriginEnvironment {
  VITE_ASTERA_PLATFORM?: string;
  VITE_ASTERA_API_URL?: string;
}

/** A bundled app's page is https://localhost; its arena lives beside the API, not the page. */
export function bundledApp(env: ArenaOriginEnvironment = import.meta.env): boolean {
  return (env.VITE_ASTERA_PLATFORM ?? 'web') !== 'web';
}

export function arenaUrl(path: string, env: ArenaOriginEnvironment = import.meta.env): string {
  return bundledApp(env) ? `${env.VITE_ASTERA_API_URL ?? ''}${path}` : path;
}

export function arenaSocketUrl(env: ArenaOriginEnvironment = import.meta.env,
  page: Pick<Location, 'protocol' | 'host'> = location): string {
  const host = bundledApp(env) ? new URL(env.VITE_ASTERA_API_URL ?? '') : page;
  return `${host.protocol === 'https:' ? 'wss:' : 'ws:'}//${host.host}/arena/ws`;
}
