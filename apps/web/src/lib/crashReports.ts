import { reactErrorHandler, type Breadcrumb, type BrowserOptions, type ErrorEvent } from '@sentry/react';
import type { RootOptions } from 'react-dom/client';
import { CRASH_INGEST } from './crashIngest.js';

export { CRASH_INGEST };

/**
 * CRASH REPORTS (plan 2026-11-13, owner §10.7-1): Sentry, errors only, nothing about the player.
 * A DSN only lets a client send events, and the bundle shows it anyway, so it lives here.
 */
const DSN = {
  web: 'https://cc923c9e2d76caf1b2f486a6a7e6142e@o4512426032431104.ingest.de.sentry.io/4512426037608528',
  app: 'https://bf24ed0892e01d345c93e53734fb2c80@o4512426032431104.ingest.de.sentry.io/4512426037674064',
} as const;

/** The game's own hosts, by environment. A local server or a preview reports nothing. */
const HOSTS: Readonly<Record<string, string>> = {
  'asteraonline.space': 'production',
  'www.asteraonline.space': 'production',
  'stage.asteraonline.space': 'stage',
};

export interface CrashContext {
  /** Inside the Android app, whose page is served from localhost. */
  native: boolean;
  host: string;
  /** A production build; a development server never reports. */
  production: boolean;
  /** The commit the build came from, or '' when it does not know. */
  release: string;
}

/** Starts Sentry (`init`) where reports are on; says whether it did. */
export function startCrashReports(at: CrashContext, init: (options: BrowserOptions) => unknown): boolean {
  const options = crashReportOptions(at);
  if (!options) return false;
  init(options);
  return true;
}

type RootHooks = Pick<RootOptions, 'onUncaughtError' | 'onCaughtError' | 'onRecoverableError'>;

/**
 * React 19 hands a root its errors, those the error boundary caught among them. The hooks replace
 * React's own console logging, so they are given only while reports are on (a production build).
 */
export function crashRootHooks(on: boolean): RootHooks {
  if (!on) return {};
  return { onUncaughtError: reactErrorHandler(), onCaughtError: reactErrorHandler(), onRecoverableError: reactErrorHandler() };
}

export function crashReportOptions(at: CrashContext): BrowserOptions | null {
  if (!at.production) return null;
  const environment = at.native ? 'production' : HOSTS[at.host];
  if (environment === undefined) return null;
  return {
    dsn: at.native ? DSN.app : DSN.web,
    environment,
    ...(at.release ? { release: at.release } : {}),
    dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  };
}

const withoutQuery = (url: string): string => url.split(/[?#]/u)[0] ?? '';

/**
 * The stack, where it happened and on which browser/phone; never who, nor what they sent. The SDK
 * drops every header under `httpHeaders: false`, User-Agent with them, so the browser's own line is
 * put back: without it a crash cannot say which device or browser it hit (WEB-2/3/4, 2026-11-19).
 */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  delete event.user;
  const agent = navigator.userAgent;
  const headers = agent ? { headers: { 'User-Agent': agent } } : {};
  if (event.request) event.request = event.request.url === undefined ? { ...headers } : { url: withoutQuery(event.request.url), ...headers };
  return event;
}

/** The trail of what the player did, without queries; console lines may name the player, so they stay home. */
export function scrubBreadcrumb(crumb: Breadcrumb): Breadcrumb | null {
  if (crumb.category === 'console') return null;
  if (!crumb.data) return crumb;
  const data: Record<string, unknown> = { ...crumb.data };
  for (const key of ['url', 'from', 'to']) {
    const value = data[key];
    if (typeof value === 'string') data[key] = withoutQuery(value);
  }
  return { ...crumb, data };
}

/**
 * A list row this build could not read and left out (api/tolerantList.ts, OTA F4): one warning per
 * list and field, naming only those, so a server that reshaped a row shows up before players say so.
 */
export function droppedRowWarning(capture: (message: string, level: 'warning') => unknown) {
  return (list: string, path: string): void => { capture(`List row dropped: ${list} · ${path}`, 'warning'); };
}
