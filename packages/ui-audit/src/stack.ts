/**
 * A LOCAL GAME FOR THE CLIENT DRIVER: DATABASE, SEEDED COMMANDERS, API, VITE.
 *
 * The database is new for every run, named for it, seeded by the guarded capacity command
 * (which refuses any name that does not end in _capacity), given the colonies the seed
 * cannot make (`uiAuditStage`), and dropped when the run ends,
 * whether it finished or failed. The local Postgres is the `astera-pg` container.
 */

import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const PG = process.env.UI_AUDIT_PG ?? 'postgres://astera:astera@localhost:5433';

interface Command { command: string; args: string[]; env: Record<string, string> }

/** `starter` turns the starter galaxy on (STARTER_GALAXY_ENABLED), as the starter driver's game needs. */
export function stackPlan({ run, password, apiPort, webPort, users, starter = false }: { run: string; password: string; apiPort: number; webPort: number; users: number; starter?: boolean }) {
  if (!/^[a-z0-9]+$/.test(run)) throw new Error(`run id must be lowercase letters and digits: ${run}`);
  const database = `astera_uiaudit_${run}_capacity`;
  const url = `${PG}/${database}`;
  const seed: Command = {
    command: 'pnpm',
    args: ['--filter', '@astera/server', 'capacity:seed', '--', '--yes', '--users', String(users), '--online', '0', '--seed', '99300'],
    env: { DATABASE_URL: url, CAPACITY_SEED_CONFIRM: 'ASTERA_STAGING_ONLY', CAPACITY_PASSWORD: password },
  };
  const stage: Command = {
    command: 'pnpm',
    args: ['--filter', '@astera/server', 'exec', 'tsx', 'src/cli/uiAuditStage.ts', '--yes'],
    env: { DATABASE_URL: url, CAPACITY_SEED_CONFIRM: 'ASTERA_STAGING_ONLY' },
  };
  const api: Command = {
    command: 'npx',
    args: ['tsx', 'src/index.ts'],
    env: { DATABASE_URL: url, PORT: String(apiPort), ROLE: 'both', NODE_ENV: 'development', RATE_LIMIT_MAX: '100000', RATE_LIMIT_AUTH_MAX: '10000', RATE_LIMIT_SIGNUP_MAX: '10000', STARTER_GALAXY_ENABLED: String(starter) },
  };
  const web: Command = {
    command: 'pnpm',
    args: ['--filter', '@astera/web', 'exec', 'vite', '--configLoader', 'runner', '--port', String(webPort), '--strictPort', '--host', '127.0.0.1'],
    env: { ASTERA_API: `http://localhost:${String(apiPort)}` },
  };
  return { database, seed, stage, api, web, url: `http://127.0.0.1:${String(webPort)}`, health: `http://127.0.0.1:${String(apiPort)}/health` };
}

const psql = (sql: string) => exec('docker', ['exec', 'astera-pg', 'psql', '-U', 'astera', '-d', 'astera', '-v', 'ON_ERROR_STOP=1', '-c', sql]);

/**
 * Ready when OUR child answers: an old API or Vite left on the port answers too, while the new child
 * dies of "address in use", so a child that has exited fails the wait at once.
 */
export async function ready(url: string, ms: number, child: { exitCode: number | null }): Promise<void> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (child.exitCode !== null) throw new Error(`exited (${String(child.exitCode)}) before ${url} was ready; is the port already taken?`);
    const ok = await fetch(url).then((r) => r.ok, () => false);
    if (ok) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`not ready in ${String(ms / 1000)} s: ${url}`);
}

export interface Stack { url: string; password: string; database: string; stop: () => Promise<void> }

/** Brings the stack up; on any failure takes down what it started and drops the database. */
export async function startStack({ root, logs, run, password, apiPort = 3231, webPort = 5232, users = 150, starter = false }: { root: string; logs: string; run: string; password: string; apiPort?: number; webPort?: number; users?: number; starter?: boolean }): Promise<Stack> {
  const plan = stackPlan({ run, password, apiPort, webPort, users, starter });
  const children: ChildProcess[] = [];
  const launch = (c: Command, cwd: string, log: string) => {
    const child = spawn(c.command, c.args, { cwd, env: { ...process.env, ...c.env }, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const file = createWriteStream(join(logs, log));
    child.stdout.pipe(file);
    child.stderr.pipe(file);
    children.push(child);
    return child;
  };
  // Ctrl-C or a kill takes the stack and its database down too, not only a finished run.
  const interrupted = (signal: NodeJS.Signals) => { void stop().finally(() => process.exit(signal === 'SIGINT' ? 130 : 143)); };
  process.once('SIGINT', interrupted);
  process.once('SIGTERM', interrupted);
  const stop = async () => {
    process.off('SIGINT', interrupted);
    process.off('SIGTERM', interrupted);
    for (const child of children) if (child.pid) try { process.kill(-child.pid, 'SIGTERM'); } catch { /* already gone */ }
    await new Promise((resolve) => setTimeout(resolve, 2000));
    for (const child of children) if (child.pid && child.exitCode === null) try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already gone */ }
    await psql(`drop database if exists ${plan.database} with (force)`).catch(() => undefined);
  };
  try {
    await psql(`create database ${plan.database}`);
    for (const [step, log] of [[plan.seed, 'seed.log'], [plan.stage, 'stage.log']] as const) {
      const child = launch(step, root, log);
      const code = await new Promise<number | null>((resolve) => child.on('exit', resolve));
      if (code !== 0) throw new Error(`${log.replace('.log', '')} failed (${String(code)}); see ${join(logs, log)}`);
    }
    await ready(plan.health, 90_000, launch(plan.api, join(root, 'apps/server'), 'api.log'));
    await ready(`${plan.url}/`, 90_000, launch(plan.web, root, 'web.log'));
    return { url: plan.url, password, database: plan.database, stop };
  } catch (error) {
    await stop();
    throw error;
  }
}
