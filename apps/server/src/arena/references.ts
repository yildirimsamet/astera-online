import { createHmac, timingSafeEqual } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { extname, join, sep } from 'node:path';
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { Env } from '../env.js';

const COOKIE = 'astera_arena_ref';
const LIFETIME_S = 6 * 3600;
const PATH = /^\/__ref\/((?:dist|audio)\/[a-zA-Z0-9_./-]+)$/;
const TYPES: Record<string, string> = {
  '.glb': 'model/gltf-binary', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ktx2': 'image/ktx2', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
};

/**
 * THE PRIVATE PLAYTEST'S REFERENCE PACK (owner 2026-10-20: friends only, owned art before
 * any public launch). The pack lives on the server beside the arena, never in git or the
 * web build; a seated pilot trades an access token for a six-hour signed cookie that
 * only `/__ref/` reads. Every refusal is a 404, so the door is not advertised.
 */
export function registerArenaReferences(app: FastifyInstance, env: Env, seated: (token: string) => Promise<{ accountId: string } | 'auth' | 'denied'>): void {
  const root = env.ARENA_REF_DIR;
  const sign = (body: string): string => createHmac('sha256', env.JWT_SECRET).update(`arena-ref:${body}`).digest('base64url');
  const valid = (ticket: string | undefined): boolean => {
    const [expires, accountId, mac] = ticket?.split('.') ?? [];
    if (!expires || !accountId || !mac) return false;
    const expected = Buffer.from(sign(`${expires}.${accountId}`)), given = Buffer.from(mac);
    return given.length === expected.length && timingSafeEqual(given, expected) && Number(expires) > app.clock.now().getTime();
  };
  const missing = (reply: FastifyReply) => reply.code(404).send({ error: 'NOT_FOUND' });

  app.post('/arena/ref-session', async (request, reply) => {
    if (!root) return missing(reply);
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) return reply.code(401).send({ error: 'AUTH' });
    const result = await seated(header.slice(7));
    if (result === 'auth') return reply.code(401).send({ error: 'AUTH' });
    if (result === 'denied') return reply.code(403).send({ error: 'DENIED' });
    const body = `${String(app.clock.now().getTime() + LIFETIME_S * 1000)}.${result.accountId}`;
    return reply.setCookie(COOKIE, `${body}.${sign(body)}`, { httpOnly: true, sameSite: 'strict', path: '/__ref',
      maxAge: LIFETIME_S, secure: env.NODE_ENV === 'production' }).code(204).send();
  });

  app.get('/__ref/*', async (request, reply) => {
    const match = PATH.exec(request.url.split('?')[0] ?? '');
    if (!root || !match?.[1] || !valid(request.cookies[COOKIE])) return missing(reply);
    const relative = match[1];
    if (relative.split('/').some(part => part === '' || part === '.' || part === '..')) return missing(reply);
    try {
      const base = await realpath(root);
      const file = await realpath(join(base, relative));
      if (!file.startsWith(base + sep)) return await missing(reply);
      const info = await stat(file);
      if (!info.isFile()) return await missing(reply);
      return await reply.header('content-type', TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream')
        .header('content-length', String(info.size)).header('cache-control', 'private, max-age=86400')
        .send(createReadStream(file));
    } catch { return missing(reply); }
  });
}
