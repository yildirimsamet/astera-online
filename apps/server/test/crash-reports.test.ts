import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import * as Sentry from '@sentry/node';
import type { ErrorEvent } from '@sentry/node';
import Fastify from 'fastify';
import { afterAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { SERVER_DSN, scrubServerEvent, serverCrashOptions } from '../src/crashReports.js';

/**
 * CRASH REPORTS FROM THE SERVER (plan 2026-11-13, owner §10.7-1, S-4). An API, worker or arena error
 * reaches the team with its stack and nothing about the player: no account, token, cookie, header,
 * body or query. Off unless the process is given a DSN; a client's own 4xx is not a crash.
 */
const on = { SENTRY_DSN: SERVER_DSN, SENTRY_ENVIRONMENT: 'production' as const, ROLE: 'api' as const, ASTERA_GIT_COMMIT: 'b'.repeat(40) };

describe('where a server crash report goes', () => {
  it('goes nowhere without a DSN', () => {
    expect(serverCrashOptions({ ...on, SENTRY_DSN: '' })).toBeNull();
  });

  it('goes to the api project, tagged by environment and commit, errors only', () => {
    const options = serverCrashOptions(on);
    expect(options?.dsn).toMatch(/\/4512426037739600$/u);
    expect(options?.environment).toBe('production');
    expect(options?.release).toBe('b'.repeat(40));
    expect(serverCrashOptions({ ...on, SENTRY_ENVIRONMENT: 'stage' })?.environment).toBe('stage');
    expect(options?.tracesSampleRate).toBeUndefined();
    // The process is named by its role, never by the machine it runs on.
    expect(options?.serverName).toBe('api');
    expect(serverCrashOptions({ ...on, ROLE: 'worker' })?.serverName).toBe('worker');
    expect(options?.integrations).toEqual([expect.objectContaining({ name: 'Fastify' })]);
    expect(options?.dataCollection).toEqual({ userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false });
    expect(options?.beforeSend).toBe(scrubServerEvent);
  });

  it('names no release when the image does not know its commit', () => {
    expect(serverCrashOptions({ ...on, ASTERA_GIT_COMMIT: 'unknown' })?.release).toBeUndefined();
    expect(serverCrashOptions({ ...on, ASTERA_GIT_COMMIT: undefined })?.release).toBeUndefined();
  });
});

describe('what a server crash report keeps', () => {
  it('drops the player, the token, the cookies, the body and the query, and keeps the route', () => {
    const event: ErrorEvent = {
      type: undefined,
      user: { id: 'account-1', ip_address: '203.0.113.9' },
      request: { method: 'POST', url: 'https://asteraonline.space/api/fleets?token=x', headers: { authorization: 'Bearer jwt', cookie: 'rt=1' }, cookies: { rt: '1' }, data: { password: 'x' }, query_string: 'token=x' },
      exception: { values: [{ type: 'Error', value: 'boom' }] },
    };
    const kept = scrubServerEvent(event);
    expect(kept.user).toBeUndefined();
    expect(kept.request).toEqual({ method: 'POST', url: 'https://asteraonline.space/api/fleets' });
    expect(kept.exception?.values?.[0]?.value).toBe('boom');
  });
});

describe('a crash inside a request', () => {
  const seen: ErrorEvent[] = [];
  afterAll(async () => { await Sentry.close(0); });

  it('is reported once, without the player, and a refused request is not', async () => {
    const options = serverCrashOptions(on);
    if (!options) throw new Error('reports should be on');
    // The real options, with the network replaced by a list: whatever would have left is kept here.
    Sentry.init({ ...options, beforeSend: (event, hint) => { const kept = scrubServerEvent(event, hint); seen.push(kept); return null; } });
    const app = Fastify();
    app.get('/boom', () => { throw new Error('the tick fell over'); });
    app.get('/refused', async (_request, reply) => reply.code(409).send({ code: 'CONFLICT' }));
    // A route that throws an error carrying a client status is a refusal, not a crash.
    app.get('/bad', () => { throw Object.assign(new Error('bad request'), { statusCode: 400 }); });
    await app.ready();
    expect((await app.inject({ url: '/boom?token=secret', headers: { authorization: 'Bearer jwt', cookie: 'rt=1' } })).statusCode).toBe(500);
    expect((await app.inject({ url: '/refused' })).statusCode).toBe(409);
    expect((await app.inject({ url: '/bad' })).statusCode).toBe(400);
    await Sentry.flush(2000);
    await app.close();
    expect(seen).toHaveLength(1);
    expect(seen[0]?.exception?.values?.[0]?.value).toBe('the tick fell over');
    // The stack carries source lines (this file's own code); everything else must hold nothing sent.
    const { exception: _stack, ...rest } = seen[0] ?? {};
    expect(JSON.stringify(rest)).not.toMatch(/Bearer jwt|rt=1|token=secret/u);
    expect(seen[0]?.request?.url ?? '').not.toContain('?');
  });
});

/** Compose gives every server process the api project's DSN; stage says it is stage; capacity says nothing. */
const root = resolve(import.meta.dirname, '../../..');
const service = z.object({ environment: z.record(z.string()).default({}) });
const compose = (files: string[]) => {
  const result = spawnSync('docker', ['compose', '--env-file', '/dev/null', ...files.flatMap(file => ['-f', file]), 'config', '--format', 'json'], {
    cwd: root, encoding: 'utf8', env: { ...process.env, COMPOSE_PROJECT_NAME: '',
      POSTGRES_USER: 'astera', POSTGRES_DB: 'astera', POSTGRES_PASSWORD: 'review-fixture-only', JWT_SECRET: 'review-fixture-secret-at-least-sixteen',
      POSTGRES_PORT: '5546', API_PORT_1: '3300', API_PORT_2: '3301', API_PORT_3: '3302', WORKER_PORT: '3310',
      ASTERA_GIT_COMMIT: '1'.repeat(40), ASTERA_STAGE_IMAGE: `astera-server:${'1'.repeat(40)}` },
  });
  expect(result.status, result.stderr).toBe(0);
  return z.object({ services: z.record(service) }).parse(JSON.parse(result.stdout)).services;
};

describe('the compose files', () => {
  it('report production from every server process', () => {
    const services = compose(['docker-compose.prod.yml']);
    for (const name of ['api1', 'api2', 'api3', 'worker', 'arena']) {
      expect(services[name]?.environment.SENTRY_DSN, name).toBe(SERVER_DSN);
      expect(services[name]?.environment.SENTRY_ENVIRONMENT, name).toBe('production');
    }
  });

  it('report stage from stage', () => {
    const services = compose(['docker-compose.prod.yml', 'docker-compose.stage.yml']);
    for (const name of ['api1', 'worker']) expect(services[name]?.environment.SENTRY_ENVIRONMENT, name).toBe('stage');
  });
});
