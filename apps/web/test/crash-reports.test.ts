import type { Breadcrumb, ErrorEvent } from '@sentry/react';
import { describe, expect, it } from 'vitest';
import { vi } from 'vitest';
import { crashReportOptions, crashRootHooks, droppedRowWarning, scrubBreadcrumb, scrubEvent, startCrashReports } from '../src/lib/crashReports.js';

/**
 * CRASH REPORTS (plan 2026-11-13, owner §10.7-1). A crash on a player's device reaches the team with its
 * stack and nothing about the player: no account, address, cookie, header, body or query. Nothing leaves
 * a development build or a host that is not the game's own.
 */
const live = { native: false, host: 'asteraonline.space', production: true, release: 'abc123' };

describe('where a crash report goes', () => {
  it('goes nowhere from a development build, a local server or a host that is not the game', () => {
    expect(crashReportOptions({ ...live, production: false })).toBeNull();
    expect(crashReportOptions({ ...live, host: 'localhost:4173' })).toBeNull();
    expect(crashReportOptions({ ...live, host: 'preview.example.com' })).toBeNull();
  });

  it('goes to the web project from the game, tagged by which game it is', () => {
    const web = crashReportOptions(live);
    expect(web?.dsn).toMatch(/\/4512426037608528$/u);
    expect(web?.environment).toBe('production');
    expect(web?.release).toBe('abc123');
    expect(crashReportOptions({ ...live, host: 'www.asteraonline.space' })?.environment).toBe('production');
    expect(crashReportOptions({ ...live, host: 'stage.asteraonline.space' })?.environment).toBe('stage');
  });

  it('goes to the app project from the Android app, whose page is served from localhost', () => {
    const app = crashReportOptions({ ...live, native: true, host: 'localhost' });
    expect(app?.dsn).toMatch(/\/4512426037674064$/u);
    expect(app?.environment).toBe('production');
  });

  it('carries errors only: no tracing, no replay, nothing collected about the player', () => {
    const web = crashReportOptions(live);
    expect(web?.tracesSampleRate).toBeUndefined();
    expect(web?.tracesSampler).toBeUndefined();
    expect(web?.integrations).toBeUndefined();
    expect(web?.dataCollection).toEqual({ userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false });
    expect(web?.beforeSend).toBe(scrubEvent);
    expect(web?.beforeBreadcrumb).toBe(scrubBreadcrumb);
  });

  it('names no release when the build does not know its own', () => {
    expect(crashReportOptions({ ...live, release: '' })?.release).toBeUndefined();
  });
});

describe('what a crash report keeps', () => {
  it('drops the player, the cookies, the headers, the body and the query, and keeps where it happened', () => {
    const event: ErrorEvent = {
      type: undefined,
      user: { id: 'account-1', email: 'pilot@example.com', ip_address: '203.0.113.9' },
      request: {
        url: 'https://asteraonline.space/reset?token=secret#again',
        headers: { Authorization: 'Bearer jwt', Cookie: 'sid=1' },
        cookies: { sid: '1' }, data: { password: 'x' }, query_string: 'token=secret',
      },
      exception: { values: [{ type: 'TypeError', value: 'x is undefined' }] },
    };
    const kept = scrubEvent(event);
    expect(kept.user).toBeUndefined();
    expect(kept.request).toEqual({ url: 'https://asteraonline.space/reset', headers: { 'User-Agent': navigator.userAgent } });
    expect(kept.exception?.values?.[0]?.value).toBe('x is undefined');
  });

  it('keeps the browser and device line, which names no player, so a crash says which phone it hit (WEB-2/3/4 had none)', () => {
    const kept = scrubEvent({ type: undefined, request: { url: 'https://asteraonline.space/', headers: { Cookie: 'sid=1' } } });
    expect(kept.request?.headers).toEqual({ 'User-Agent': navigator.userAgent });
    expect(navigator.userAgent).not.toBe('');
  });

  it('keeps the trail of what the player did, without queries in its addresses or console lines', () => {
    expect(scrubBreadcrumb({ category: 'fetch', data: { url: '/api/players?name=x', method: 'GET', status_code: 500 } }))
      .toEqual({ category: 'fetch', data: { url: '/api/players', method: 'GET', status_code: 500 } });
    expect(scrubBreadcrumb({ category: 'navigation', data: { from: '/a?x=1', to: '/b#y' } }))
      .toEqual({ category: 'navigation', data: { from: '/a', to: '/b' } });
    const click: Breadcrumb = { category: 'ui.click', message: 'button.repair' };
    expect(scrubBreadcrumb(click)).toEqual(click);
    expect(scrubBreadcrumb({ category: 'console', message: 'signed in as pilot@example.com' })).toBeNull();
  });
});

describe('starting crash reports', () => {
  it('starts Sentry once with the options for this place, and nothing elsewhere', () => {
    const init = vi.fn();
    expect(startCrashReports(live, init)).toBe(true);
    expect(init).toHaveBeenCalledOnce();
    expect(init.mock.calls[0]?.[0]).toMatchObject({ environment: 'production', release: 'abc123' });
    const quiet = vi.fn();
    expect(startCrashReports({ ...live, production: false }, quiet)).toBe(false);
    expect(startCrashReports({ ...live, host: 'localhost:5183' }, quiet)).toBe(false);
    expect(quiet).not.toHaveBeenCalled();
  });

  // React 19 hands a root its errors; while reports are off the root keeps React's own console logging.
  it('hands the React root the error hooks only while reports are on', () => {
    expect(crashRootHooks(false)).toEqual({});
    const hooks = crashRootHooks(true);
    expect(typeof hooks.onUncaughtError).toBe('function');
    expect(typeof hooks.onCaughtError).toBe('function');
    expect(typeof hooks.onRecoverableError).toBe('function');
  });
});

/** OTA F4 (§5.3): a list row the client left out is a warning, with the list and the field only. */
describe('a dropped list row', () => {
  it('is sent as one warning naming the list and the field', () => {
    const capture = vi.fn();
    droppedRowWarning(capture)('intel.probeReports', 'moon.fleetSize');
    expect(capture).toHaveBeenCalledWith('List row dropped: intel.probeReports · moon.fleetSize', 'warning');
  });
});
