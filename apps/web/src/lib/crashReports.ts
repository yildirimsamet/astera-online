import type { Breadcrumb, BrowserOptions, ErrorEvent } from '@sentry/react';

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

/** The stack and where it happened; never who, nor what they sent. */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  delete event.user;
  if (event.request) event.request = event.request.url === undefined ? {} : { url: withoutQuery(event.request.url) };
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
