import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';

const config = readFileSync(resolve(import.meta.dirname, '../../../deploy/nginx/astera.conf'), 'utf8');

it('keeps all Astera virtual host access and error logs in the age-bounded receiver', () => {
  const servers = config.split(/^server \{/m).slice(1);
  expect(servers).toHaveLength(3);
  for (const server of servers) {
    expect(server).toContain('access_log syslog:server=unix:/run/astera-runtime/log.sock,tag=astera_web,severity=info astera_access;');
    expect(server).toContain('error_log syslog:server=unix:/run/astera-runtime/log.sock,tag=astera_web_error error;');
  }
});

it('leaves query strings, headers, credentials and bodies out of ordinary access logs', () => {
  const format = /log_format astera_access\s+'([^']+)'/.exec(config)?.[1];
  expect(format).toBeDefined();
  expect(format).toContain('$uri');
  expect(format).toContain('$status');
  for (const field of ['$request"', '$request_uri', '$args', '$query_string', '$cookie', '$http_', '$request_body']) {
    expect(format).not.toContain(field);
  }
});
