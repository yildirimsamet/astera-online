import { fastifyIntegration, type ErrorEvent, type EventHint, type NodeOptions } from '@sentry/node';

/**
 * CRASH REPORTS FROM THE SERVER (plan 2026-11-13, owner §10.7-1, S-4): Sentry, errors only, nothing
 * about the player. A DSN only lets a process send events; compose passes this one to every server
 * process, and an empty `SENTRY_DSN` (local, tests, capacity runs) sends nothing.
 */
export const SERVER_DSN = 'https://1483122da6e0a6177af3b722ae6300e3@o4512426032431104.ingest.de.sentry.io/4512426037739600';

export interface ServerCrashContext {
  SENTRY_DSN: string;
  SENTRY_ENVIRONMENT: 'production' | 'stage';
  /** Names the process on a report, never the machine it runs on. */
  ROLE: 'api' | 'worker' | 'both' | 'arena';
  /** The image's commit; `unknown` when it was built without one. */
  ASTERA_GIT_COMMIT?: string | undefined;
}

export function serverCrashOptions(at: ServerCrashContext): NodeOptions | null {
  if (!at.SENTRY_DSN) return null;
  const release = at.ASTERA_GIT_COMMIT && at.ASTERA_GIT_COMMIT !== 'unknown' ? at.ASTERA_GIT_COMMIT : '';
  return {
    dsn: at.SENTRY_DSN,
    environment: at.SENTRY_ENVIRONMENT,
    ...(release ? { release } : {}),
    serverName: at.ROLE,
    // No tracing (no tracesSampleRate): errors only, nothing added to the request path (capacity mandate).
    // A route's 5xx is a crash; a refused request (4xx) is the player's answer, not ours.
    integrations: [fastifyIntegration({ shouldHandleError: (_error, _request, reply) => reply.statusCode >= 500 })],
    dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
    beforeSend: scrubServerEvent,
  };
}

/** The stack and the route; never who, the token, nor what they sent. */
export function scrubServerEvent(event: ErrorEvent, _hint?: EventHint): ErrorEvent {
  delete event.user;
  if (event.request) {
    const { method, url } = event.request;
    event.request = { ...(method === undefined ? {} : { method }), ...(url === undefined ? {} : { url: url.split(/[?#]/u)[0] ?? '' }) };
  }
  return event;
}
