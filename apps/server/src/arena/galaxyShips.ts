import { createHmac, timingSafeEqual } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, realpath, stat } from 'node:fs/promises';
import { join, sep } from 'node:path';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { SHIP_CLASSES, type ShipClass } from '@astera/rules/arena';
import type { Env } from '../env.js';

const COOKIE = 'astera_galaxy_ships';
const PREFIX = '/arena/galaxy-ships';
const HOURS = 6 * 3600;
const descriptor = z.object({ model: z.string().startsWith('/__ref/dist/'),
  engines: z.array(z.tuple([z.number(), z.number(), z.number()])).default([]), nozzle: z.number().positive().default(.03) });
const manifest = z.object({ ships: z.object({ classes: z.record(z.enum(SHIP_CLASSES), descriptor) }) });
interface Model { url: string; engines: [number, number, number][]; nozzle: number; ktx2: false }
interface Prepared { files: Map<ShipClass, { path: string }>; models: Partial<Record<ShipClass, Model>> }

/** Only the three self-contained webp ships; arena admission and the rest of its pack stay private. */
export function registerGalaxyShips(app: FastifyInstance, env: Env,
  identify: (token: string) => Promise<{ accountId: string } | null>): void {
  let prepared: Promise<Prepared | null> | undefined;
  const prepare = (): Promise<Prepared | null> => prepared ??= (async () => {
    if (!env.ARENA_REF_DIR) return null;
    try {
      const root = await realpath(env.ARENA_REF_DIR);
      const parsed = manifest.parse(JSON.parse(await readFile(join(root, 'dist/v2/manifest-lite.json'), 'utf8')));
      const files: Prepared['files'] = new Map(); const models: Prepared['models'] = {};
      for (const ship of SHIP_CLASSES) {
        const d = parsed.ships.classes[ship];
        if (!d) return null;
        const path = await realpath(join(root, d.model.slice('/__ref/'.length)));
        if (!path.startsWith(root + sep) || !path.endsWith('.glb')) return null;
        const info = await stat(path);
        if (!info.isFile()) return null;
        files.set(ship, { path });
        models[ship] = { url: `${PREFIX}/${ship}.glb?v=${String(info.size)}-${String(Math.trunc(info.mtimeMs))}`,
          engines: d.engines, nozzle: d.nozzle, ktx2: false };
      }
      return { files, models };
    } catch { return null; }
  })().then(pack => {
    if (pack === null) prepared = undefined;
    return pack;
  });
  const sign = (body: string) => createHmac('sha256', env.JWT_SECRET).update(`galaxy-ships:${body}`).digest('base64url');
  const valid = (ticket: string | undefined): boolean => {
    const [expires, accountId, mac] = ticket?.split('.') ?? [];
    if (!expires || !accountId || !mac || Number(expires) <= app.clock.now().getTime()) return false;
    const expected = Buffer.from(sign(`${expires}.${accountId}`)), given = Buffer.from(mac);
    return given.length === expected.length && timingSafeEqual(given, expected);
  };
  app.get(PREFIX, async (request, reply) => {
    const header = request.headers.authorization;
    const who = header?.startsWith('Bearer ') ? await identify(header.slice(7)) : null;
    if (!who) return reply.code(401).send({ error: 'AUTH' });
    const pack = await prepare();
    // Do not advertise URLs which would 404 on a deployment with no prepared ship pack.
    if (!pack) return { models: null };
    const body = `${String(app.clock.now().getTime() + HOURS * 1000)}.${who.accountId}`;
    return reply.header('cache-control', 'no-store').setCookie(COOKIE, `${body}.${sign(body)}`, {
      httpOnly: true, sameSite: 'strict', path: PREFIX, maxAge: HOURS, secure: env.NODE_ENV === 'production',
    }).send({ models: pack.models });
  });
  app.get(`${PREFIX}/:ship`, async (request, reply) => {
    const parsed = z.object({ ship: z.enum(['akinci.glb', 'muhafiz.glb', 'kilavuz.glb']) }).safeParse(request.params);
    if (!parsed.success || !valid(request.cookies[COOKIE])) return reply.code(404).send({ error: 'NOT_FOUND' });
    const ship = z.enum(SHIP_CLASSES).parse(parsed.data.ship.slice(0, -4));
    const file = (await prepare())?.files.get(ship);
    if (!file) return reply.code(404).send({ error: 'NOT_FOUND' });
    return reply.header('content-type', 'model/gltf-binary')
      .header('cache-control', 'private, max-age=86400').send(createReadStream(file.path));
  });
}
