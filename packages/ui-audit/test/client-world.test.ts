import { createServer, type Server } from 'node:http';
import { chromium, type Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { clientWorld } from '../src/drivers/client.js';

/**
 * THE RUN'S SHARED WORLD AGAINST A SERVER THAT ONLY WRITES DOWN WHAT IT IS ASKED.
 *
 * The cadet waits for its first unknown signal on a game without the starter galaxy. On a game
 * with it, a new commander cannot join a galaxy at all (STARTER_REQUIRED), and no starter way
 * needs a cadet.
 */
let browser: Browser;
let server: Server;
let base = '';
const asked: string[] = [];

beforeAll(async () => {
  browser = await chromium.launch();
  server = createServer((req, res) => {
    asked.push(`${req.method ?? ''} ${req.url ?? ''}`);
    const answer = req.url === '/api/auth/register' ? { accountId: 'a1', accessToken: 't1' }
      : req.url === '/api/servers' ? { servers: [{ code: 'EU-1', name: 'Vantage', status: 'open' }] }
        : {};
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(answer));
  });
  await new Promise<void>((resolve) => { server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('no port');
  base = `http://127.0.0.1:${String(address.port)}`;
});
afterAll(async () => {
  await browser.close();
  await new Promise<void>((resolve) => { server.close(() => { resolve(); }); });
});

describe('the run\'s shared world', () => {
  it('registers the cadet and joins it to the open galaxy on a game without the starter galaxy', async () => {
    asked.length = 0;
    const world = await clientWorld(browser, base, 'pw-123456', false);
    expect(world.cadet).toMatch(/^uia/);
    expect(asked).toEqual(['POST /api/auth/register', 'GET /api/servers', 'POST /api/servers/EU-1/join']);
  }, 60_000);

  it('asks the server nothing on a starter game, where no way needs a cadet and none could join', async () => {
    asked.length = 0;
    const world = await clientWorld(browser, base, 'pw-123456', true);
    expect(world.starter).toBe(true);
    expect(asked).toEqual([]);
  }, 60_000);
});
