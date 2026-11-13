/**
 * THE REAL CLIENT ON A LOCAL GAME (`stack.ts`): SEEDED COMMANDERS, REAL SERVER, REAL DATA.
 *
 * cap0001 is a mid-season commander with one colony, cap0002 one at the three-colony cap
 * (`uiAuditStage`). Where the first minutes are the surface, each visit registers a commander
 * of its own. The cadet is registered when the run starts, so the game clock has sent it its
 * first unknown signal by the time its visit comes; a battle report waits for the seeded raids
 * to land. Those two visits go last.
 *
 * States a local game cannot reach within a run are patched into the server's own answer,
 * one field each where it can be: the season frozen with this commander's result (the recap),
 * the placement moved to the waiting room (Sessiz Uzay), and on a starter game a crate ready to
 * open, a full tank (the jump) and a landing behind the ship (the arrival).
 *
 * On a game with the starter galaxy on, a new commander takes a colony ship (`enlisted`); the
 * seeded commanders, who hold worlds and no ship, are the ones a landing is shown to.
 */

import { randomBytes } from 'node:crypto';
import type { Browser, Page } from 'playwright';
import type { Reach, Surface } from '../inventory.js';
import type { Visit } from '../run.js';
import { settle } from './gallery.js';
import { phrase } from './phrase.js';

export interface ClientWorld {
  base: string;
  password: string;
  cadet: string;
  /** The server runs the starter galaxy (STARTER_GALAXY_ENABLED): its own ways, and the handbook. */
  starter: boolean;
}

type Who = 'cap0001' | 'cap0002' | 'cadet' | 'unjoined' | 'newcomer' | 'enlisted';
interface Session { accountId: string; accessToken: string }
type Patch = (body: Record<string, unknown>, session: Session) => Record<string, unknown>;

interface Way {
  who: Who;
  /** `found` is what `until` waited for, when it names one thing among several. */
  steps?: (page: Page, lang: string, found?: number) => Promise<void>;
  /** Server answers to change before the client reads them, by path. */
  patch?: Record<string, Patch>;
  /** Hold the visit until the game has produced what it shows. */
  until?: (page: Page, world: ClientWorld, session: Session, lang: string) => Promise<number | undefined>;
  profiles?: readonly ('phone' | 'desktop' | 'narrow')[];
  /** Only on a game with the starter galaxy on. */
  starter?: boolean;
  /** sessionStorage the visit starts with: what this tab has already played. */
  played?: Record<string, string>;
}

export const fresh = (): string => `uia${randomBytes(6).toString('hex')}`;

const record = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : {};

const text = (value: unknown, what: string): string => {
  if (typeof value !== 'string') throw new Error(`expected ${what}`);
  return value;
};

async function policyVersion(): Promise<string> {
  const module: unknown = await import(new URL('../../../rules/src/communityPolicy.ts', import.meta.url).href);
  return text(record(module).COMMUNITY_POLICY_VERSION, 'the community policy version');
}

async function call(page: Page, world: ClientWorld, path: string, { body, token }: { body?: unknown; token?: string } = {}): Promise<Record<string, unknown>> {
  const response = await page.request.fetch(`${world.base}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : {},
    ...(body === undefined ? {} : { data: body }),
  });
  if (!response.ok()) throw new Error(`${path} answered ${String(response.status())}: ${(await response.text()).slice(0, 160)}`);
  return record(await response.json());
}

const session = (answer: Record<string, unknown>): Session => ({
  accountId: text(answer.accountId, 'an account id'),
  accessToken: text(answer.accessToken, 'an access token'),
});

/** The open galaxy a new commander joins. */
async function openGalaxy(page: Page, world: ClientWorld): Promise<{ code: string; name: string }> {
  const servers = (await call(page, world, '/api/servers')).servers;
  const open = (Array.isArray(servers) ? servers : []).map(record).find((s) => s.status === 'open');
  if (!open) throw new Error('no open galaxy on the local game');
  return { code: text(open.code, 'a galaxy code'), name: text(open.name, 'a galaxy name') };
}

/** Registers a commander through the client's own door; joins the open galaxy when asked. */
export async function enlist(page: Page, world: ClientWorld, username: string, join: boolean): Promise<Session> {
  const signed = session(await call(page, world, '/api/auth/register', {
    body: { username, password: world.password, communityPolicyVersion: await policyVersion(), communityPolicyLocale: 'tr' },
  }));
  if (join) await call(page, world, `/api/servers/${encodeURIComponent((await openGalaxy(page, world)).code)}/join`, { body: {}, token: signed.accessToken });
  return signed;
}

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

/** The driver registers commanders, joins a galaxy and posts chat: it plays only on this machine. */
export function localOnly(base: string): void {
  if (!LOCAL_HOSTS.has(new URL(base).hostname)) throw new Error(`the client driver plays only on a local game, not ${base}`);
}

/**
 * The run's shared world: the stack's address and password, and the cadet registered now. A
 * starter game has no cadet: no starter way needs one, and a new commander cannot join there.
 */
export async function clientWorld(browser: Browser, base: string, password: string, starter: boolean): Promise<ClientWorld> {
  localOnly(base);
  if (starter) return { base, password, cadet: '', starter };
  const context = await browser.newContext();
  try {
    const world = { base, password, cadet: fresh(), starter };
    await enlist(await context.newPage(), world, world.cadet, true);
    return world;
  } finally {
    await context.close();
  }
}

async function signIn(page: Page, world: ClientWorld, who: Who): Promise<Session> {
  if (who === 'enlisted') {
    const signed = await enlist(page, world, fresh(), false);
    await call(page, world, '/api/starter/enlist', { body: {}, token: signed.accessToken });
    return signed;
  }
  if (who === 'unjoined' || who === 'newcomer') return enlist(page, world, fresh(), who === 'newcomer');
  const username = who === 'cadet' ? world.cadet : who;
  return session(await call(page, world, '/api/auth/login', { body: { username, password: world.password } }));
}

const CURTAIN = '[data-loading-screen]';

async function enter(page: Page, world: ClientWorld, lang: string, way: Way): Promise<number | undefined> {
  const signed = await signIn(page, world, way.who);
  const found = await way.until?.(page, world, signed, lang);
  await page.addInitScript((played) => {
    localStorage.setItem('astera.commander', '1');
    localStorage.setItem('astera.training-entry.dismissed', '1');
    for (const [key, value] of Object.entries(played)) sessionStorage.setItem(key, value);
  }, way.played ?? {});
  for (const [path, edit] of Object.entries(way.patch ?? {})) {
    await page.route((url) => url.pathname === path, async (route) => {
      const response = await route.fetch();
      await route.fulfill({ response, json: edit(record(await response.json()), signed) });
    });
  }
  // The galaxy asks for won pieces once nothing holds the screen. The seeded commanders have some
  // (their staged colonies), and the answer can come after the galaxy is drawn.
  const veteran = way.who === 'cap0001' || way.who === 'cap0002';
  const reveals = veteran
    ? page.waitForResponse((r) => new URL(r.url()).pathname === '/api/legacy/me/reveals' && r.request().method() === 'GET', { timeout: 30_000 })
      .then(async (r) => list(record(await r.json()), 'awards').length, () => 0)
    : Promise.resolve(0);
  await page.goto(`${world.base}/${lang}/`, { waitUntil: 'domcontentloaded' });
  const ready = way.who === 'unjoined'
    ? page.getByText((await openGalaxy(page, world)).name, { exact: true })
    : page.locator('[data-guide="dock-galaxy"]');
  await ready.first().waitFor({ state: 'visible', timeout: 60_000 });
  await page.waitForFunction((curtain) => !document.querySelector(`${curtain}:not([data-departing="true"])`), CURTAIN, { timeout: 60_000 });
  // A commander away past the threshold is told what happened first; the story has its own gallery views.
  if (await page.getByTestId('away-hero').isVisible().catch(() => false)) {
    await press(page, await phrase(lang, 'v2', 'away.done'));
  }
  // Pieces earned since the last visit are then revealed over everything; the reveal has its own gallery views.
  const reveal = page.getByTestId('legacy-reveal');
  if (await reveals > 0) await reveal.waitFor({ state: 'visible', timeout: 30_000 });
  for (let shown = 0; shown < 8; shown += 1) {
    if (!(await reveal.isVisible().catch(() => false))) break;
    await reveal.getByRole('button').last().click();
    await page.waitForTimeout(600);
  }
  await settle(page, 'body');
  return found;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** The text before a placeholder: "{{count}} anıt" → "anıt" is matched as a whole label pattern. */
const label = (s: string) => new RegExp(`^${s.split(/\{\{\w+\}\}/).map(escape).join('[^]*?')}$`);

async function press(page: Page, name: RegExp | string): Promise<void> {
  await page.getByRole('button', { name, exact: typeof name === 'string' }).first().click();
  await settle(page, 'body');
}
const pressAt = async (page: Page, selector: string) => {
  await page.locator(selector).first().click();
  await settle(page, 'body');
};
/** A menu tile is named "Label. Hint". */
const tile = async (page: Page, lang: string, file: string, key: string) => press(page, new RegExp(`^${escape(await phrase(lang, file, key))}\\.`));
const menu = async (page: Page, category?: string) => {
  await pressAt(page, '[data-menu-button]');
  if (category) await pressAt(page, `[data-menu-category="${category}"]`);
};

/** A few lines in the visit's language channel from other commanders; the viewer has agreed to the rules. */
const CHATTER: Record<string, readonly string[]> = {
  tr: ['Kuzeydeki enkaz alanı kimde?', "Bellwether'e saldırı 20 dk sonra iniyor, destek lazım.", 'Anıt 03 boşaldı, ilk gelen alır 🚀'],
  en: ['Who holds the wreck field up north?', 'Raid on Bellwether lands in 20 min, need support.', 'Monument 03 is empty, first come first served 🚀'],
  fr: ['Qui tient le champ de débris au nord ?', 'Le raid sur Bellwether arrive dans 20 min, besoin de soutien.', 'Le monument 03 est vide, premier arrivé premier servi 🚀'],
  de: ['Wer hält das Trümmerfeld im Norden?', 'Der Angriff auf Bellwether landet in 20 Min., brauche Unterstützung.', 'Monument 03 ist leer, wer zuerst kommt 🚀'],
  es: ['¿Quién tiene el campo de restos del norte?', 'El ataque a Bellwether llega en 20 min, necesito apoyo.', 'El monumento 03 está vacío, el primero que llegue 🚀'],
  ja: ['北の残骸フィールドは誰が持ってる？', 'Bellwetherへの攻撃は20分後に着弾、支援求む。', 'モニュメント03が空いた、早い者勝ち 🚀'],
};

async function agree(page: Page, world: ClientWorld, token: string, lang: string): Promise<void> {
  await call(page, world, '/api/community/policy', { body: { version: await policyVersion(), locale: lang }, token });
}

async function talk(page: Page, world: ClientWorld, viewer: Session, lang: string): Promise<void> {
  await agree(page, world, viewer.accessToken, lang);
  const lines = CHATTER[lang] ?? CHATTER.en ?? [];
  for (const [index, content] of lines.entries()) {
    const speaker = session(await call(page, world, '/api/auth/login', { body: { username: `cap000${String(index + 2)}`, password: world.password } }));
    await agree(page, world, speaker.accessToken, lang);
    await call(page, world, '/api/chat/messages', { body: { content, language: lang }, token: speaker.accessToken });
  }
  // The speakers' logins replaced the viewer's refresh cookie; the page signs in as the viewer again.
  await call(page, world, '/api/auth/login', { body: { username: 'cap0001', password: world.password } });
}

/** The corner button is "Chat", or "Chat · 3 unread" once someone has spoken. */
async function openChat(page: Page, lang: string): Promise<void> {
  await press(page, new RegExp(`^${escape(await phrase(lang, 'v2', 'bell.chat'))}( · |$)`));
}

/** The finder lists monuments by number; the first one is the same world in every language. */
async function firstMonument(page: Page): Promise<void> {
  await page.locator('li > button').filter({ hasText: /^\s*01/ }).first().click();
  await settle(page, 'body');
}

/** Asks every 15 s until `ready` names what it waited for (an index, or 0 for "it is there"). */
async function poll(what: string, minutes: number, ready: () => Promise<number | null>): Promise<number> {
  const until = Date.now() + minutes * 60_000;
  for (let found = await ready(); ; found = await ready()) {
    if (found !== null) return found;
    if (Date.now() > until) throw new Error(`the local game produced no ${what} in ${String(minutes)} min`);
    await new Promise((resolve) => setTimeout(resolve, 15_000));
  }
}

const list = (answer: Record<string, unknown>, key: string): unknown[] => {
  const value: unknown = answer[key];
  return Array.isArray(value) ? value.map((item: unknown) => item) : [];
};

const WAYS: Partial<Record<Reach, Way>> = {
  'client:galaxy-new': { who: 'newcomer' },
  'client:galaxy-mid': { who: 'cap0001' },
  'client:galaxy-late': { who: 'cap0002' },
  'client:servers': { who: 'unjoined' },
  'client:outline': { who: 'cap0002', profiles: ['desktop'] },
  'client:menu': { who: 'cap0001', steps: (page) => menu(page) },
  'client:profile': { who: 'cap0001', steps: async (page) => { await menu(page); await pressAt(page, '[data-menu-identity]'); } },
  'client:rewards': { who: 'cap0001', steps: (page) => menu(page, 'rewards') },
  'client:announcements': { who: 'cap0001', steps: async (page, lang) => { await menu(page, 'community'); await tile(page, lang, 'community', 'community.announcements.title'); } },
  'client:feedback': { who: 'cap0001', steps: async (page, lang) => { await menu(page, 'community'); await tile(page, lang, 'community', 'community.feedback.title'); } },
  'client:simulator': { who: 'cap0001', steps: async (page, lang) => { await menu(page, 'academy'); await tile(page, lang, 'simulator', 'simulator.title'); } },
  'client:school-replay': { who: 'cap0001', steps: async (page, lang) => {
    await menu(page, 'academy');
    await tile(page, lang, 'academy', 'academy.replay');
    await page.locator('[data-school-scene]').waitFor({ state: 'visible', timeout: 60_000 });
    await page.waitForFunction((curtain) => !document.querySelector(`${curtain}:not([data-departing="true"])`), CURTAIN, { timeout: 60_000 });
    // The instructor types the line out; measure the whole of it.
    await page.locator('.school-reveal').waitFor({ state: 'hidden', timeout: 30_000 });
    await settle(page, 'body');
  } },
  'training:handbook': { who: 'cap0001', starter: true, steps: async (page, lang) => {
    await menu(page, 'academy');
    await tile(page, lang, 'academy', 'academy.replay');
    // On a starter game the menu's replay opens the handbook; its own button replays the prologue.
    await page.getByTestId('handbook').waitFor({ state: 'visible', timeout: 60_000 });
    await settle(page, 'body');
  } },
  'client:chronicle': { who: 'cap0001', steps: async (page, lang) => {
    await press(page, await phrase(lang, 'v2', 'bell.signals'));
    await page.getByRole('tab', { name: await phrase(lang, 'v2', 'bell.chronicle'), exact: true }).click();
    await settle(page, 'body');
  } },
  'client:events-guide': { who: 'cap0001', steps: async (page, lang) => { await pressAt(page, '[data-view-chip]'); await press(page, await phrase(lang, 'v2', 'view.events')); } },
  'client:worlds': { who: 'cap0001', steps: async (page, lang) => { await press(page, label(await phrase(lang, 'shell', 'statusBar.capitalWorld'))); } },
  'client:planet-colony': { who: 'cap0001', steps: async (page, lang) => {
    await press(page, label(await phrase(lang, 'shell', 'statusBar.capitalWorld')));
    // The capital is listed first; its one colony second.
    await page.getByRole('list', { name: await phrase(lang, 'world', 'worlds.list'), exact: true }).locator(':scope > li').nth(1).getByRole('button').first().click();
    await settle(page, 'body');
    await pressAt(page, '[data-guide="dock-base"]');
  } },
  'client:focus': { who: 'cap0001', steps: async (page, lang) => {
    await press(page, label(await phrase(lang, 'monument', 'monument.finder')));
    await firstMonument(page);
  } },
  'client:monument': { who: 'cap0001', steps: async (page, lang) => {
    await press(page, label(await phrase(lang, 'monument', 'monument.finder')));
    await firstMonument(page);
    // The focus panel's header opens the monument's sheet.
    await pressAt(page, 'button[aria-expanded]:has(+ [data-focus-close])');
  } },
  'client:chat': { who: 'cap0001', until: async (page, world, viewer, lang) => { await talk(page, world, viewer, lang); return undefined; }, steps: openChat },
  'client:chat-rules': { who: 'newcomer', steps: openChat },
  'client:return': { who: 'cap0001', patch: {
    '/api/return-applications': (body) => ({ ...body, placement: { ...record(body.placement), playerId: 'ui-audit', version: 1, role: 'WAITING' }, canApply: true, application: null }),
  } },
  'client:recap': { who: 'cap0001', patch: {
    '/api/season': (body, signed) => ({ ...body, status: 'frozen', result: {
      seasonId: body.seasonId, accountId: signed.accountId, finalRank: 4, dominion: 18_240, honorScore: 9_120, honorRank: 6,
      damageDealt: 412_000, damageTaken: 188_000, rivalName: 'Capacity 12', biggestRaid: 96_000, title: 'Commander',
      recap: { commanderName: 'Capacity 1', planetName: 'Thistle-131', battles: 37, attacks: 24, defences: 13,
        rival: { commanderName: 'Capacity 12', battles: 6 }, biggestRaid: { value: 96_000, opponentName: 'Capacity 12' }, support: { stood: 4, held: 3 }, clan: null },
      createdAt: new Date().toISOString(),
    } }),
  } },
  'client:unknown-signal': {
    who: 'cadet',
    until: (page, world, signed) => poll('unknown signal', 20, async () => (list(await call(page, world, '/api/unknown-signals', { token: signed.accessToken }), 'signals').length > 0 ? 0 : null)),
    steps: (page) => pressAt(page, '[data-unknown-signal-chip]'),
  },
  'client:battle-replay': {
    who: 'cap0001',
    // The staged raid on a neutral world (`uiAuditStage`): the seed's own raids are too small to be watched.
    until: (page, world, signed) => poll('watchable battle report', 90, async () => {
      const index = list(await call(page, world, '/api/reports?limit=50', { token: signed.accessToken }), 'reports').findIndex((r) => record(r).replayStatus === 'AVAILABLE');
      return index < 0 ? null : index;
    }),
    steps: async (page, lang, found = 0) => {
      await pressAt(page, '[data-guide="dock-intel"]');
      await page.getByRole('tab', { name: await phrase(lang, 'intel', 'intel.shelf.reports'), exact: true }).click();
      await page.getByRole('tab', { name: await phrase(lang, 'intel', 'reports.heading'), exact: true }).click();
      await settle(page, 'body');
      await page.locator('[data-report-row]').nth(found).click();
      await settle(page, 'body');
      await press(page, await phrase(lang, 'simulator', 'simulator.watchBattle'));
    },
  },
};

/** The officer's guide and the first unlock card are set aside, as a commander who knows the way does. */
async function skipGuide(page: Page, lang: string): Promise<void> {
  const later = page.locator('[data-guide="unlock-dismiss"]');
  if (await later.isVisible().catch(() => false)) await later.click();
  await press(page, await phrase(lang, 'starter', 'starter.tutorial.skip.link'));
  await press(page, await phrase(lang, 'starter', 'starter.tutorial.skip.close'));
  await settle(page, 'body');
}

const toShip = async (page: Page, lang: string) => {
  await skipGuide(page, lang);
  await pressAt(page, '[data-guide="dock-base"]');
};

/** The tank at the jump's mark (`STARTER.fuelForJump`), with the drive's answer to match. */
const FULL_TANK = 90;
const fullTank: Record<string, Patch> = {
  '/api/starter/vessel': (body) => ({ ...body, vessel: { ...record(body.vessel), fuel: FULL_TANK } }),
  '/api/starter/migration': (body) => ({ ...body, block: null, fuel: { ...record(body.fuel), loaded: FULL_TANK, needed: FULL_TANK, canLoad: false } }),
};

const STARTER_WAYS: Partial<Record<Reach, Way>> = {
  // The first screen a colony ship's commander sees: the officer, and the refinery's unlock card.
  'starter:tutorial': { who: 'enlisted', starter: true },
  'starter:vessel': { who: 'enlisted', starter: true, steps: toShip },
  'starter:repair': { who: 'enlisted', starter: true, steps: async (page, lang) => {
    await toShip(page, lang);
    await pressAt(page, '[data-guide="repair-order"]');
  } },
  // The first crate, sealed until its repair is done, opened by a held lid.
  'starter:crate': { who: 'enlisted', starter: true, steps: toShip, patch: {
    '/api/starter/vessel': (body) => {
      const vessel = record(body.vessel);
      const crates = Array.isArray(vessel.crates) ? vessel.crates.map(record) : [];
      return { ...body, vessel: { ...vessel, crates: crates.map((crate, i) => (i === 0 ? { ...crate, state: 'ready' } : crate)) } };
    },
  } },
  // The call on the map once the tank is full, then the drive it opens.
  'starter:jump': { who: 'enlisted', starter: true, steps: skipGuide, patch: fullTank },
  'starter:drive': { who: 'enlisted', starter: true, patch: fullTank, steps: async (page, lang) => {
    await skipGuide(page, lang);
    await pressAt(page, '[data-jump-call]');
    await pressAt(page, '[data-guide="system-DRIVE"]');
  } },
  // The landing card after the jump; the flight itself is filmed on its own (`flash`, jump).
  'starter:arrival': { who: 'cap0001', starter: true, played: { 'astera:jump-scene-played': '1' }, patch: {
    '/api/starter/arrival': () => ({
      arrival: { shardName: 'Vantage', cargo: { alloy: 1_003, crystal: 300, deuterium: 120, fleet: { DART: 6, COURIER: 2 } }, planetId: null, hull: 'SPINE', ordinal: 1, berth: null },
      landedAt: null,
    }),
  } },
};

/** Waiting ways go last, so the other visits run while the game clock produces their subject. */
const LAST: readonly Reach[] = ['client:unknown-signal', 'client:battle-replay'];

export function clientVisits(world: ClientWorld, surfaces: readonly Surface[]): Visit[] {
  const visits = surfaces.flatMap((surface) => surface.reach.flatMap((reach): Visit[] => {
    const way = WAYS[reach] ?? STARTER_WAYS[reach];
    if (!way || (way.starter ?? false) !== world.starter) return [];
    return [{
      surface: surface.id,
      reach,
      open: async (page, lang) => { const found = await enter(page, world, lang, way); await way.steps?.(page, lang, found); },
      ...(way.profiles ? { profiles: way.profiles } : {}),
    }];
  }));
  return [...visits.filter((v) => !LAST.includes(v.reach)), ...visits.filter((v) => LAST.includes(v.reach))];
}
