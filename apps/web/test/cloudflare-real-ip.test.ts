import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';

const source = readFileSync(resolve(import.meta.dirname, '../../../deploy/nginx/astera.conf'), 'utf8');
const game = source.slice(source.indexOf('# ── the game'));
const directives = game.split('\n').filter(line => /^\s*(set_real_ip_from|real_ip_header|real_ip_recursive)\s/u.test(line));

it('scopes visitor-IP trust to Cloudflare IPv4/IPv6 ranges and preserves safe forwarded headers', () => {
  expect(directives).toContain('    real_ip_header CF-Connecting-IP;');
  expect(directives.filter(line => line.includes('set_real_ip_from'))).toHaveLength(22);
  expect(directives.join('\n')).toContain('173.245.48.0/20;');
  expect(directives.join('\n')).toContain('2a06:98c0::/29;');
  expect(directives.join('\n')).not.toMatch(/(?:0\.0\.0\.0\/0|::\/0|127\.0\.0\.1|X-Forwarded-For)/u);
  expect(source.slice(0, source.indexOf('# ── the game'))).not.toContain('set_real_ip_from');
});

it('forwards the visitor from a trusted edge and ignores a forged CF header from a direct client', () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'astera-real-ip-'));
  const name = `astera-real-ip-${process.pid}`;
  const run = (...args: string[]): string => {
    const result = spawnSync('docker', args, { encoding: 'utf8', timeout: 10_000 });
    if (result.error || result.status !== 0) throw new Error(`${args[0]}: ${result.error?.message ?? result.stderr}`);
    return result.stdout.trim();
  };
  const api = /location \/api\/ \{(?<body>[\s\S]*?)\n\s*\}/u.exec(game)?.groups?.body ?? '';
  const forwarded = api.split('\n').filter(line => /proxy_set_header X-(?:Real-IP|Forwarded-For)\s/u.test(line));
  writeFileSync(resolve(directory, 'nginx.conf'), `events {}
http {
  access_log off;
  server { listen 127.0.0.1:8080;
    ${directives.join('\n')}
    location /api/ { proxy_pass http://127.0.0.1:8081; ${forwarded.join('\n')} }
  }
  server { listen 127.0.0.1:8081; location / { return 200 "$http_x_real_ip|$http_x_forwarded_for"; } }
}`);
  try {
    run('run', '-d', '--name', name, '--network', 'none', '--cap-add', 'NET_ADMIN',
      '-v', `${directory}/nginx.conf:/etc/nginx/nginx.conf:ro`, 'nginx:1.28-alpine');
    run('exec', name, 'ip', 'addr', 'add', '173.245.48.2/32', 'dev', 'lo');
    const request = (edge: boolean): string => run('exec', name, 'curl', '-fsS', '--retry', '5', '--retry-connrefused',
      '--retry-delay', '0', ...(edge ? ['--interface', '173.245.48.2'] : []),
      '-H', 'CF-Connecting-IP: 203.0.113.9', '-H', 'X-Forwarded-For: 198.51.100.99', 'http://127.0.0.1:8080/api/check');
    expect(request(true)).toBe('203.0.113.9|203.0.113.9');
    expect(request(false)).toBe('127.0.0.1|127.0.0.1');
  } finally {
    spawnSync('docker', ['rm', '-f', name], { encoding: 'utf8' });
    rmSync(directory, { recursive: true });
  }
}, 20_000);
