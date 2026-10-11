import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const script = readFileSync(new URL('../../../tools/dev-up.sh', import.meta.url), 'utf8');
const statusWriter = `
console.log('  #  shard      name          planets   online  status');
console.log('  1  EU-1       Vantage          0/1000       0  open');
console.log('  2  EU-2       Kestrel          0/1000       0  locked');
if (process.env.DEV_EXISTING === '1' || process.env.DEV_CREATED === '1') {
  console.log('678649  MONUMENT-LOCALMonument Local   0/60       0  open');
}
if (process.env.DEV_LARGE === '1') {
  for (let i = 0; i < 10000; i++) console.log('status detail ' + i + ' '.repeat(128));
  console.log('status output complete');
}
`;

function start(options: { existing?: boolean; large?: boolean; statusFailure?: boolean; nodeEnv?: string } = {}) {
  const root = mkdtempSync(resolve(tmpdir(), 'astera-dev-up-test-'));
  try {
    const bin = resolve(root, 'bin');
    mkdirSync(bin);
    mkdirSync(resolve(root, 'tools'));
    mkdirSync(resolve(root, 'node_modules'));
    writeFileSync(resolve(root, 'tools/dev-up.sh'), script);
    writeFileSync(resolve(root, '.env'), '');
    writeFileSync(resolve(root, 'pnpm-lock.yaml'), '');
    writeFileSync(resolve(root, 'node_modules/.modules.yaml'), '');
    writeFileSync(resolve(root, 'status.cjs'), statusWriter);
    for (const name of ['awk', 'cat', 'dirname', 'grep', 'mkdir', 'sed', 'seq', 'sleep', 'tail', 'touch']) {
      symlinkSync(`/usr/bin/${name}`, resolve(bin, name));
    }
    symlinkSync(process.execPath, resolve(bin, 'node'));
    const command = (name: string, body: string) => {
      writeFileSync(resolve(bin, name), `#!/bin/bash\nset -eu\n${body}\n`, { mode: 0o755 });
    };
    command('docker', 'case "$1" in inspect) echo healthy ;; version) echo 28.0.0 ;; esac');
    command('ss', 'exit 0');
    command('hostname', 'exit 0');
    command('curl', 'echo \'{"ok":true}\'');
    command('pnpm', `
printf '%s\\n' "$*" >> "$DEV_CALLS"
case "$*" in
  --version) echo 9.15.4 ;;
  'install --frozen-lockfile') exit 0 ;;
  '-s --filter @astera/server season migrate') echo 'migrations applied' ;;
  '-s --filter @astera/server season local-bootstrap')
    if [[ "$NODE_ENV" != development ]]; then echo 'local-bootstrap requires development mode and a loopback database' >&2; exit 1; fi
    [[ "$DEV_EXISTING" == 1 ]] || touch "$DEV_CREATED_FILE"
    echo 'already up EU-1, EU-2; prepared MONUMENT-LOCAL'
    ;;
  '-s --filter @astera/server season status')
    if [[ "$DEV_STATUS_FAILURE" == 1 ]]; then echo 'status database unavailable' >&2; exit 42; fi
    DEV_CREATED=0
    [[ ! -f "$DEV_CREATED_FILE" ]] || DEV_CREATED=1
    export DEV_CREATED
    exec node "$DEV_STATUS_WRITER"
    ;;
  '--filter @astera/server dev'|'--filter @astera/web dev --host 0.0.0.0 --strictPort --port 5173') exec sleep 0.5 ;;
  *) echo "unexpected command: $*" >&2; exit 99 ;;
esac`);
    const result = spawnSync('/bin/bash', ['tools/dev-up.sh', '--skip-build'], {
      cwd: root,
      encoding: 'utf8',
      timeout: 10_000,
      maxBuffer: 8 * 1024 * 1024,
      env: {
        ...process.env,
        PATH: bin,
        NODE_ENV: options.nodeEnv ?? 'development',
        DEV_CALLS: resolve(root, 'calls.log'),
        DEV_CREATED_FILE: resolve(root, 'created'),
        DEV_STATUS_WRITER: resolve(root, 'status.cjs'),
        DEV_EXISTING: options.existing ? '1' : '0',
        DEV_LARGE: options.large ? '1' : '0',
        DEV_STATUS_FAILURE: options.statusFailure ? '1' : '0',
      },
    });
    if (result.error) throw result.error;
    return { ...result, calls: readFileSync(resolve(root, 'calls.log'), 'utf8').trim().split('\n') };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const statusCommand = '-s --filter @astera/server season status';
const bootstrapCommand = '-s --filter @astera/server season local-bootstrap';

describe('pnpm start galaxy preparation without ripgrep', () => {
  it('keeps an already-live monument season and reaches the playable banner', () => {
    const result = start({ existing: true });
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.calls.filter(call => call === bootstrapCommand)).toHaveLength(1);
    expect(result.stdout).toContain('ASTERA IS UP');
    expect(result.calls.filter(call => call === statusCommand)).toHaveLength(1);
  });

  it('creates a missing rehearsal once and prints the updated status', () => {
    const result = start();
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.calls.filter(call => call === bootstrapCommand)).toHaveLength(1);
    expect(result.calls.filter(call => call === statusCommand)).toHaveLength(1);
    expect(result.stdout).toContain('MONUMENT-LOCAL');
    expect(result.stdout).toContain('ASTERA IS UP');
  });

  it('stops before starting processes when the prepared world status fails', () => {
    const result = start({ statusFailure: true });
    expect(result.status).toBe(42);
    expect(result.stderr).toContain('status database unavailable');
    expect(result.calls.filter(call => call === bootstrapCommand)).toHaveLength(1);
    expect(result.calls.some(call => call.includes(' dev'))).toBe(false);
  });

  it('fully consumes long CLI output without causing EPIPE', () => {
    const result = start({ existing: true, large: true });
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('status output complete');
    expect(result.calls.filter(call => call === bootstrapCommand)).toHaveLength(1);
  });

  it.each(['production', 'test'])('rejects local bring-up in %s before starting processes', nodeEnv => {
    const result = start({ nodeEnv });
    expect(result.stderr).toContain('local-bootstrap requires development mode');
    expect(result.status).toBe(1);
    expect(result.calls).not.toContain(statusCommand);
    expect(result.calls.some(call => call.includes(' dev'))).toBe(false);
  });
});
