import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { accounts, announcements, feedbackEntries } from '../src/db/schema.js';
import { sanitizeAnnouncementHtml } from '../src/services/announcementHtml.js';
import { seedWorld, testDb, testEnv, type Fixture } from './helpers.js';

const silent = pino({ level: 'silent' });

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

describe('announcement HTML allow-list', () => {
  it('keeps authored formatting and hardens links, images and YouTube embeds', () => {
    const result = sanitizeAnnouncementHtml(`
      <h2>Update</h2>
      <p><strong>Ready</strong> <a href="https://astera.example/news">read</a></p>
      <img src="https://cdn.example/shot.png" alt="Galaxy">
      <div data-youtube-video><iframe src="https://www.youtube-nocookie.com/embed/abc"></iframe></div>
    `);
    expect(result.rejected).toEqual([]);
    expect(result.html).toContain('<h2>Update</h2>');
    expect(result.html).toContain('rel="noopener noreferrer nofollow"');
    expect(result.html).toContain('referrerpolicy="no-referrer"');
    expect(result.html).toContain('sandbox="allow-scripts allow-same-origin allow-presentation"');
  });

  it.each([
    '<script>alert(1)</script><p>hello</p>',
    '<img src="https://cdn.example/x.png" onerror="alert(1)">',
    '<a href="javascript:alert(1)">run</a>',
    '<a href="jav&#x61;script:alert(1)">encoded run</a>',
    '<img src="data:image/svg+xml,<svg onload=alert(1)>">',
    '<iframe src="https://evil.example/embed/1"></iframe>',
    '<iframe src="https://youtube.com.evil.example/embed/1"></iframe>',
    '<p style="background:url(https://evil.example/track)">tracked</p>',
    '<svg><a href="https://example.com">not allowed</a></svg>',
  ])('flags active content instead of silently publishing it: %s', (payload) => {
    expect(sanitizeAnnouncementHtml(payload).rejected.length).toBeGreaterThan(0);
  });
});

describe('announcements, feedback and admin authority', () => {
  let fixture: Fixture;
  let app: FastifyInstance;
  let close: () => Promise<void>;
  let adminAuth: { authorization: string };
  let playerAuth: { authorization: string };

  beforeEach(async () => {
    fixture = await seedWorld(2);
    const [adminAccount] = await fixture.db
      .select({ username: accounts.username })
      .from(accounts)
      .where(eq(accounts.id, fixture.accountIds[0]!));
    const built = buildApp({
      env: testEnv({ ADMIN_USERNAMES: adminAccount!.username }),
      logger: silent,
      db: fixture.db,
      clock: fixture.clock,
    });
    app = built.app;
    close = built.close;
    await app.ready();
    const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
    adminAuth = { authorization: `Bearer ${await tokens.issueAccess(fixture.accountIds[0]!)}` };
    playerAuth = { authorization: `Bearer ${await tokens.issueAccess(fixture.accountIds[1]!)}` };
  });

  afterEach(async () => { await close(); });

  it('exposes admin status from the out-of-band allow-list and protects both admin routes', async () => {
    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: adminAuth });
    expect(me.json<{ isAdmin: boolean }>().isAdmin).toBe(true);
    const player = await app.inject({ method: 'GET', url: '/api/auth/me', headers: playerAuth });
    expect(player.json<{ isAdmin: boolean }>().isAdmin).toBe(false);

    const deniedPublish = await app.inject({
      method: 'POST',
      url: '/api/admin/announcements',
      headers: playerAuth,
      payload: { title: 'Forged', bodyHtml: '<p>No</p>' },
    });
    expect(deniedPublish.statusCode).toBe(403);
    expect(deniedPublish.json()).toMatchObject({ error: 'ADMIN_FORBIDDEN' });
    expect((await app.inject({
      method: 'GET', url: '/api/admin/feedback', headers: playerAuth,
    })).statusCode).toBe(403);
  });

  it('publishes only sanitized HTML and rejects a script without writing a row', async () => {
    const published = await app.inject({
      method: 'POST',
      url: '/api/admin/announcements',
      headers: adminAuth,
      payload: {
        title: 'Version 1.2',
        bodyHtml: '<h2>New orbit</h2><p><a href="https://example.com">Details</a></p>',
      },
    });
    expect(published.statusCode).toBe(200);
    expect(published.json<{ announcement: { bodyHtml: string } }>().announcement.bodyHtml)
      .toContain('rel="noopener noreferrer nofollow"');

    const rejected = await app.inject({
      method: 'POST',
      url: '/api/admin/announcements',
      headers: adminAuth,
      payload: { title: 'Attack', bodyHtml: '<script>alert(document.cookie)</script>' },
    });
    expect(rejected.statusCode).toBe(400);
    expect(rejected.json()).toMatchObject({ error: 'UNSAFE_HTML' });
    expect(await fixture.db.select().from(announcements)).toHaveLength(1);
  });

  it('broadcasts a committed announcement once to every live account', async () => {
    await app.bus.start();
    const arrived = new Promise<{ kind: string }>((resolve) => {
      const off = app.bus.subscribeGlobal((event) => {
        off();
        resolve(event);
      });
    });

    const published = await app.inject({
      method: 'POST',
      url: '/api/admin/announcements',
      headers: adminAuth,
      payload: { title: 'Live update', bodyHtml: '<p>Now available</p>' },
    });

    expect(published.statusCode).toBe(200);
    await expect(arrived).resolves.toMatchObject({ kind: 'global:announcement' });
  });

  it('hides an admin commander and planet from every other galaxy response', async () => {
    const playerGalaxy = await app.inject({
      method: 'GET', url: '/api/galaxy', headers: playerAuth,
    });
    expect(playerGalaxy.statusCode).toBe(200);
    expect(playerGalaxy.json<{ planets: { id: string }[] }>().planets)
      .not.toContainEqual(expect.objectContaining({ id: fixture.planetIds[0] }));
    expect(playerGalaxy.body).not.toContain(fixture.playerIds[0]!);

    const playerLadder = await app.inject({
      method: 'GET', url: '/api/leaderboard', headers: playerAuth,
    });
    expect(playerLadder.statusCode).toBe(200);
    expect(playerLadder.json<{ ladder: { playerId: string }[] }>().ladder)
      .not.toContainEqual(expect.objectContaining({ playerId: fixture.playerIds[0] }));

    const adminGalaxy = await app.inject({
      method: 'GET', url: '/api/galaxy', headers: adminAuth,
    });
    expect(adminGalaxy.json<{ planets: { id: string }[] }>().planets)
      .toContainEqual(expect.objectContaining({ id: fixture.planetIds[0] }));
  });

  it('keeps read state isolated per account', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/admin/announcements',
      headers: adminAuth,
      payload: { title: 'Hello', bodyHtml: '<p>Commanders</p>' },
    });
    const id = created.json<{ announcement: { id: string } }>().announcement.id;
    const read = await app.inject({
      method: 'POST',
      url: '/api/announcements/read',
      headers: adminAuth,
      payload: { ids: [id] },
    });
    expect(read.json()).toEqual({ marked: 1 });

    const adminPage = await app.inject({ method: 'GET', url: '/api/announcements', headers: adminAuth });
    const playerPage = await app.inject({ method: 'GET', url: '/api/announcements', headers: playerAuth });
    expect(adminPage.json<{ announcements: { seen: boolean }[] }>().announcements[0]?.seen).toBe(true);
    expect(playerPage.json<{ announcements: { seen: boolean }[] }>().announcements[0]?.seen).toBe(false);
  });

  it('stores feedback as plain text and a SQL-shaped message cannot change the schema', async () => {
    const message = "Robert'); DROP TABLE announcements;-- <script>alert(1)</script>";
    const sent = await app.inject({
      method: 'POST',
      url: '/api/feedback',
      headers: playerAuth,
      payload: { kind: 'BUG', message },
    });
    expect(sent.statusCode).toBe(200);
    expect(await fixture.db.select().from(announcements)).toEqual([]);
    expect((await fixture.db.select().from(feedbackEntries))[0]?.message).toBe(message);

    const inbox = await app.inject({ method: 'GET', url: '/api/admin/feedback', headers: adminAuth });
    expect(inbox.statusCode).toBe(200);
    expect(inbox.json<{ feedback: { message: string; displayName: string }[] }>().feedback[0])
      .toMatchObject({ message, displayName: 'Tester1' });
  });
});
