import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';

/**
 * THE MAINTENANCE FLAG. Scaling plan F0.9.
 *
 * `deploy/maintenance.sh on` writes one file; while it exists nginx answers every API
 * door with 503 and that file's JSON, so the client shows the maintenance screen
 * instead of an error. The game's own pages keep loading, or there is no screen.
 */
const source = readFileSync(resolve(import.meta.dirname, '../../../deploy/nginx/astera.conf'), 'utf8');
const game = source.slice(source.indexOf('# ── the game'));
const block = (opening: string): string => {
  const start = game.indexOf(`${opening} {`);
  const end = /\n {4}\}/u.exec(game.slice(start));
  if (start === -1 || !end) throw new Error(`no ${opening} block`);
  return game.slice(start, start + end.index + 6).replaceAll('http://astera_api', 'http://127.0.0.1:8081');
};

it('answers the API with the flag file as a 503 while it exists, and leaves the pages alone', () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'astera-maintenance-'));
  const flag = resolve(directory, 'flag');
  mkdirSync(flag);
  chmodSync(flag, 0o777);
  const name = `astera-maintenance-${String(process.pid)}`;
  const run = (...args: string[]): string => {
    const result = spawnSync('docker', args, { encoding: 'utf8', timeout: 10_000 });
    if (result.error || result.status !== 0) throw new Error(`${args[0] ?? ''}: ${result.error?.message ?? result.stderr}`);
    return result.stdout.trim();
  };
  writeFileSync(resolve(directory, 'nginx.conf'), `events {}
http {
  access_log off;
  server { listen 127.0.0.1:8080;
    root /usr/share/nginx/html;
    ${block('location @maintenance')}
    ${block('location = /api/stream')}
    ${block('location = /api/admin/chat/media')}
    ${block('location /api/')}
  }
  server { listen 127.0.0.1:8081; location / { return 200 "api"; } }
}`);
  const body = '{"error":"MAINTENANCE","message":"Astera is under maintenance","params":{"endsAt":"2026-11-02T01:15:00.000Z"}}';
  // No `--retry`: curl counts a 503 as transient and would back off on the answer under test.
  const request = (path: string): string => run('exec', name, 'curl', '-sS',
    '-o', '/dev/stdout', '-w', '|%{http_code}|%{content_type}', '-D', '/tmp/headers', `http://127.0.0.1:8080${path}`);
  try {
    run('run', '-d', '--name', name, '--network', 'none', '-v', `${directory}/nginx.conf:/etc/nginx/nginx.conf:ro`,
      '-v', `${flag}:/var/www/astera-maintenance`, 'nginx:1.28-alpine');
    run('exec', name, 'sh', '-c', 'for i in $(seq 50); do nc -z 127.0.0.1 8080 && exit 0; sleep 0.1; done; exit 1');
    expect(request('/api/session')).toBe('api|200|text/plain');
    run('exec', name, 'sh', '-c', `printf '%s' '${body}' > /var/www/astera-maintenance/maintenance.json`);
    for (const path of ['/api/session', '/api/maintenance', '/api/stream', '/api/admin/chat/media']) {
      expect(request(path)).toBe(`${body}|503|application/json`);
    }
    expect(run('exec', name, 'cat', '/tmp/headers')).toMatch(/cache-control: no-store/iu);
    expect(request('/index.html')).toMatch(/\|200\|text\/html$/u);
    run('exec', name, 'rm', '/var/www/astera-maintenance/maintenance.json');
    expect(request('/api/session')).toBe('api|200|text/plain');
  } finally {
    spawnSync('docker', ['rm', '-f', name], { encoding: 'utf8' });
    rmSync(directory, { recursive: true, force: true });
  }
}, 30_000);
