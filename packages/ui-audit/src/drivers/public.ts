/**
 * THE WAYS IN THAT NEED NO ACCOUNT: FRONT DOOR, TRAINING, ARENA, SIMULATOR, FAULTS, WIKI.
 *
 * The real app on the dev server with no game server behind it. Whatever a state needs from
 * the server is answered here, the way the server would: the capabilities that open the
 * prologue, the 503 that raises the maintenance screen, the 426 that asks for an update. A
 * request nothing here answers is refused, as when the network is down.
 */

import type { Page } from 'playwright';
import type { Reach, Surface } from '../inventory.js';
import type { Visit } from '../run.js';
import { settle } from './gallery.js';
import { phrase } from './phrase.js';

/** Measured by another driver, with the reason. */
export const PUBLIC_ELSEWHERE: Partial<Record<Reach, string>> = {
  'training:handbook': 'client driver: the prologue replayed from the menu by a signed-in commander',
};

const PUBLISHED = ['tr', 'en'] as const;

type Answer = { status: number; body: unknown } | 'hang';

interface Setup {
  /** localStorage before the first script runs. */
  storage?: Record<string, string>;
  /** The answer to an API path; null refuses the request. */
  api?: (path: string) => Answer | null;
  /** Window flags before the first script runs. */
  consent?: boolean;
  /** Record React roots so a test can raise the crash screen. */
  crashable?: boolean;
}

const SEEN_TRAINING = { 'astera.training-entry.dismissed': '1' };
const KNOWN_COMMANDER = { 'astera.commander': '1' };
const UNAUTHENTICATED: Answer = { status: 401, body: { error: 'UNAUTHENTICATED' } };

/** A first visit: no session, one open galaxy. */
function firstVisit(path: string): Answer | null {
  if (path === '/api/auth/refresh') return UNAUTHENTICATED;
  if (path === '/api/servers') {
    const endsAt = new Date(Date.now() + 18 * 86_400_000).toISOString();
    return { status: 200, body: { servers: [{ code: 'vantage', name: 'Vantage', ordinal: 1, planets: 640, capacity: 1000, online: 87, status: 'open', endsAt, yours: false }], placement: null } };
  }
  return null;
}

async function prepare(page: Page, { storage = {}, api = firstVisit, consent = false, crashable = false }: Setup): Promise<void> {
  await page.addInitScript(({ items, consent, crashable }) => {
    for (const [key, value] of Object.entries(items)) localStorage.setItem(key, value);
    if (consent) window.__asteraConsentDefaults = true;
    if (crashable && !window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
      const roots = new Set<{ current: AuditFiber }>();
      window.__uiAuditRoots = roots;
      const renderers = new Map<number, unknown>();
      window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
        renderers, supportsFiber: true, isDisabled: false,
        inject: (renderer: unknown) => { renderers.set(renderers.size + 1, renderer); return renderers.size; },
        onCommitFiberRoot: (_id: number, root: { current: AuditFiber }) => { roots.add(root); },
        onCommitFiberUnmount: () => undefined,
        onPostCommitFiberRoot: () => undefined,
        checkDCE: () => undefined,
      };
    }
  }, { items: storage, consent, crashable });
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const answer = api(new URL(route.request().url()).pathname);
    if (answer === 'hang') return;
    if (answer === null) await route.abort('connectionrefused');
    else await route.fulfill({ status: answer.status, contentType: 'application/json', body: JSON.stringify(answer.body) });
  });
}

/** The outermost error boundary takes the state it would take from a real render error. */
async function crash(page: Page): Promise<void> {
  const raised = await page.evaluate(() => {
    for (const root of window.__uiAuditRoots ?? []) {
      const stack: AuditFiber[] = [root.current];
      while (stack.length > 0) {
        const fiber = stack.shift();
        if (!fiber) break;
        const type = fiber.type;
        if (typeof type === 'function' && 'getDerivedStateFromError' in type && typeof type.getDerivedStateFromError === 'function' && fiber.stateNode && typeof fiber.stateNode.setState === 'function') {
          const crashed: unknown = Reflect.apply(type.getDerivedStateFromError, type, [new Error('ui-audit: the crash screen, raised on purpose')]);
          fiber.stateNode.setState(crashed);
          return true;
        }
        for (let child = fiber.child; child; child = child.sibling) stack.push(child);
      }
    }
    return false;
  });
  if (!raised) throw new Error('no error boundary found');
}

const LOADING = '[data-loading-screen]';

const app = (base: string, lang: string, query = '') => `${base}/${lang}/${query}`;

async function openApp(page: Page, url: string, setup: Setup, ready: string): Promise<void> {
  await prepare(page, setup);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator(ready).first().waitFor({ state: 'visible', timeout: 30_000 });
  // The loading curtain stays over a 3D scene until it has drawn; it leaves marked departing.
  if (ready !== LOADING) await page.waitForFunction((curtain) => !document.querySelector(`${curtain}:not([data-departing="true"])`), LOADING, { timeout: 40_000 });
  // body, not #root: the loading screen and the sheets are portals.
  await settle(page, 'body');
}

async function openPublished(page: Page, url: string): Promise<void> {
  await prepare(page, {});
  await page.goto(url, { waitUntil: 'load' });
  await settle(page, 'body');
}

const WIKI_ROOT = { tr: '/wiki/tr', en: '/wiki' } as const;
const PUBLISHED_PAGES = {
  guide: { tr: '/hizli-baslangic-rehberi.html', en: '/quick-start-guide.html' },
  legal: { tr: '/gizlilik-politikasi.html', en: '/privacy.html' },
} as const;
const isPublished = (lang: string): lang is (typeof PUBLISHED)[number] => lang === 'tr' || lang === 'en';
const published = (lang: string): (typeof PUBLISHED)[number] => {
  if (!isPublished(lang)) throw new Error(`not published in ${lang}`);
  return lang;
};

const OPEN: Partial<Record<Reach, { open: (base: string) => (page: Page, lang: string) => Promise<void>; langs?: readonly string[] }>> = {
  'landing:front': { open: (base) => (page, lang) => openApp(page, app(base, lang), { storage: SEEN_TRAINING }, 'main') },
  'landing:sign-in': {
    open: (base) => async (page, lang) => {
      await openApp(page, app(base, lang), { storage: SEEN_TRAINING }, 'main');
      await page.getByRole('button', { name: await phrase(lang, 'entry', 'landing.signIn'), exact: true }).first().click();
      await page.getByRole('dialog').first().waitFor();
      await page.waitForTimeout(800);
    },
  },
  'landing:password-reset': {
    open: (base) => async (page, lang) => {
      await openApp(page, app(base, lang), { storage: SEEN_TRAINING }, 'main');
      await page.getByRole('button', { name: await phrase(lang, 'entry', 'landing.signIn'), exact: true }).first().click();
      await page.getByRole('button', { name: await phrase(lang, 'accountSecurity', 'accountSecurity.forgot'), exact: true }).click();
      await page.waitForTimeout(800);
    },
  },
  'landing:consent': { open: (base) => (page, lang) => openApp(page, app(base, lang), { storage: SEEN_TRAINING, consent: true }, '[data-consent-notice]') },
  'landing:guide': { open: (base) => (page, lang) => openPublished(page, `${base}${PUBLISHED_PAGES.guide[published(lang)]}`), langs: PUBLISHED },
  'landing:legal': { open: (base) => (page, lang) => openPublished(page, `${base}${PUBLISHED_PAGES.legal[published(lang)]}`), langs: PUBLISHED },
  /** A known commander whose session the server has not answered yet. */
  'landing:loading': { open: (base) => (page, lang) => openApp(page, app(base, lang), { storage: KNOWN_COMMANDER, api: () => 'hang' }, LOADING) },
  'training:prologue': {
    open: (base) => (page, lang) => openApp(page, app(base, lang), { api: (path) => (path === '/api/auth/capabilities' ? { status: 200, body: { starterGalaxy: true } } : firstVisit(path)) }, 'main button'),
  },
  'training:flight-school': {
    open: (base) => async (page, lang) => {
      await openApp(page, app(base, lang), {}, '[data-school-scene]');
      // The instructor types the line out; measure the whole of it.
      await page.locator('.school-reveal').waitFor({ state: 'hidden', timeout: 30_000 });
    },
  },
  'training:claim': {
    open: (base) => async (page, lang) => {
      await openApp(page, app(base, lang), {}, '[data-school-scene]');
      await page.locator('.school-exit').click();
      await page.getByRole('dialog').first().waitFor();
      await page.waitForTimeout(800);
    },
  },
  'arena:sandbox': { open: (base) => (page, lang) => openApp(page, app(base, lang, '?arena=sandbox'), {}, '.ap-launch') },
  'arena:match': {
    open: (base) => async (page, lang) => {
      await openApp(page, app(base, lang, '?arena=sandbox'), {}, '.ap-launch');
      await page.locator('.ap-launch').click();
      await page.waitForTimeout(4000);
    },
  },
  simulator: { open: (base) => (page, lang) => openApp(page, app(base, lang, '?simulator=1'), {}, 'main') },
  'special:maintenance-flag': {
    open: (base) => (page, lang) => openApp(page, app(base, lang), { storage: KNOWN_COMMANDER, api: () => ({ status: 503, body: { error: 'MAINTENANCE', params: { endsAt: new Date(Date.now() + 42 * 60_000).toISOString() } } }) }, 'main'),
  },
  'special:update-required': { open: (base) => (page, lang) => openApp(page, app(base, lang), { storage: KNOWN_COMMANDER, api: () => ({ status: 426, body: { error: 'UPDATE_REQUIRED' } }) }, 'main') },
  'special:render-error': {
    open: (base) => async (page, lang) => {
      await openApp(page, app(base, lang), { storage: SEEN_TRAINING, crashable: true }, 'main');
      await crash(page);
      await page.waitForTimeout(800);
    },
  },
  'wiki:index': { open: (base) => (page, lang) => openPublished(page, `${base}${WIKI_ROOT[published(lang)]}`), langs: PUBLISHED },
  'wiki:article': { open: (base) => (page, lang) => openPublished(page, `${base}${WIKI_ROOT[published(lang)]}/guides/how-to-play`), langs: PUBLISHED },
};

export function publicVisits(base: string, surfaces: readonly Surface[]): Visit[] {
  return surfaces.flatMap((surface) =>
    surface.reach.flatMap((reach) => {
      const way = OPEN[reach];
      return way ? [{ surface: surface.id, reach, open: way.open(base), ...(way.langs ? { langs: way.langs } : {}) }] : [];
    }),
  );
}

interface AuditFiber {
  child: AuditFiber | null;
  sibling: AuditFiber | null;
  type: unknown;
  stateNode: { setState?: (state: unknown) => void } | null;
}

declare global {
  interface Window {
    __asteraConsentDefaults?: boolean;
    __uiAuditRoots?: Set<{ current: AuditFiber }>;
    __REACT_DEVTOOLS_GLOBAL_HOOK__?: unknown;
  }
}
