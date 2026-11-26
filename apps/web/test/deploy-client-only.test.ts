// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/**
 * 2026-11-26: a web-only change went live through a hand-written script, because deploy.sh always
 * stops and migrates every server role; the script skipped the app update, so app players stayed
 * on older code than the browser. `deploy.sh --client-only` is the sanctioned web-only path: web
 * and OTA together, server roles untouched. deploy.sh runs here for real, with stub commands.
 */
const real = resolve(__dirname, '../../../deploy/deploy.sh');
let site: string;
let log: string;

function stub(bin: string, name: string, body: string): void {
  writeFileSync(join(bin, name), `#!/usr/bin/env bash\necho "${name} $*" >> "$STUB_LOG"\n${body}\n`);
  chmodSync(join(bin, name), 0o755);
}
const git = (...args: string[]) => spawnSync('git', args, { cwd: site, encoding: 'utf8' }).stdout.trim();
function commit(path: string, text: string): string {
  mkdirSync(join(site, path, '..'), { recursive: true });
  writeFileSync(join(site, path), text);
  git('add', '-A'); git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', path);
  return git('rev-parse', 'HEAD');
}

beforeEach(() => {
  site = mkdtempSync(join(tmpdir(), 'astera-deploy-'));
  log = join(site, 'stub.log');
  const bin = join(site, 'bin'); mkdirSync(bin);
  mkdirSync(join(site, 'deploy/nginx'), { recursive: true });
  copyFileSync(real, join(site, 'deploy/deploy.sh'));
  writeFileSync(join(site, 'deploy/host-capacity-preflight.sh'), '#!/usr/bin/env bash\n'); chmodSync(join(site, 'deploy/host-capacity-preflight.sh'), 0o755);
  writeFileSync(join(site, 'deploy/nginx/astera.conf'), '# vhost\n');
  writeFileSync(join(site, '.env'), 'VITE_GA_ID=\n');
  writeFileSync(join(site, '.gitignore'), 'bin/\nstub.log\n.deploy-*\n');
  spawnSync('git', ['init', '-q', '-b', 'master'], { cwd: site });
  // docker: a build writes its output; `image inspect` names the commit the running image was built from.
  stub(bin, 'docker', `if [[ "$1" == inspect ]]; then echo healthy; exit 0; fi
if [[ "$1 $2" == "image inspect" ]]; then echo "$RUNNING"; exit 0; fi
for arg in "$@"; do if [[ "$arg" == type=local,dest=* ]]; then dest=\${arg#type=local,dest=}; mkdir -p "$dest"; touch "$dest/index.html" "$dest/latest.json"; fi; done`);
  // The web publish is stubbed; it records which release the staged web names.
  stub(bin, 'sudo', 'if [[ "$2" == deploy/publish-web.sh ]]; then echo "web names $(cat "$3/release.txt" 2>/dev/null)" >> "$STUB_LOG"; fi');
  stub(bin, 'nginx', 'echo "configure arguments: --with-http_sub_module" >&2');
  stub(bin, 'python3', '');
  stub(bin, 'curl', `prev=""; for arg in "$@"; do if [[ "$prev" == -D ]]; then printf 'content-security-policy: script-src nonce-%s\\n' "$(printf 'a%.0s' {1..32})" > "$arg"; fi; prev=$arg; done
if [[ "$*" == *health* ]]; then echo '{"ok":true}'; else printf '<script nonce="%s"></script>' "$(printf 'a%.0s' {1..32})"; fi`);
});
afterEach(() => { rmSync(site, { recursive: true, force: true }); });

function deploy(running: string, ...flags: string[]) {
  const result = spawnSync('bash', [join(site, 'deploy/deploy.sh'), '--local', ...flags], { encoding: 'utf8',
    env: { ...process.env, PATH: `${join(site, 'bin')}:${process.env.PATH ?? ''}`, STUB_LOG: log, RUNNING: running } });
  const calls = (() => { try { return readFileSync(log, 'utf8'); } catch { return ''; } })();
  return { code: result.status, out: result.stdout + result.stderr, calls };
}

describe('deploy.sh --client-only', () => {
  it('publishes the web and the app update, checks them like a phone, and leaves every server role alone', () => {
    const running = commit('apps/server/src/app.ts', 'server');
    commit('apps/web/src/push.ts', 'web change');
    commit('docs/deployment.md', 'docs');
    const { code, out, calls } = deploy(running, '--client-only');
    expect(code, out).toBe(0);
    expect(calls).toContain('sudo bash deploy/publish-web.sh');
    // verify-ota.py compares the web's release.txt with latest.json (first live run, 2026-11-26: 404).
    expect(calls).toContain(`web names ${git('rev-parse', 'HEAD')}`);
    expect(calls).toContain('sudo bash deploy/publish-ota.sh');
    expect(calls).toContain('python3 deploy/verify-ota.py');
    expect(calls).not.toMatch(/docker compose .* (build|stop|run|up) /);
  });

  it('refuses before building anything when the server side changed since the running image', () => {
    const running = commit('apps/web/src/push.ts', 'web');
    commit('packages/rules/src/economy.ts', 'rules change');
    const { code, out, calls } = deploy(running, '--client-only');
    expect(code).toBe(1);
    expect(out).toContain('packages/rules/src/economy.ts');
    expect(calls).not.toContain('docker build');
    expect(calls).not.toContain('publish-web.sh');
  });

  it('refuses when the running image names no commit', () => {
    commit('apps/web/src/push.ts', 'web');
    const { code, calls } = deploy('', '--client-only');
    expect(code).toBe(1);
    expect(calls).not.toContain('publish-web.sh');
  });

  it('rejects an unknown option instead of running a full deploy', () => {
    commit('apps/web/src/push.ts', 'web');
    const { code, calls } = deploy('x', '--web-only');
    expect(code).toBe(1);
    expect(calls).toBe('');
  });
});

describe('a full deploy', () => {
  it('still stops and migrates the roles, and ends with the same phone-like check', () => {
    const running = commit('apps/server/src/app.ts', 'server');
    commit('apps/server/src/app.ts', 'server change');
    const { code, out, calls } = deploy(running);
    expect(code, out).toBe(0);
    expect(calls).toMatch(/docker compose .* stop api1 api2 api3 worker/);
    expect(calls.indexOf('python3 deploy/verify-ota.py')).toBeGreaterThan(calls.indexOf('sudo systemctl reload nginx'));
  });
});
