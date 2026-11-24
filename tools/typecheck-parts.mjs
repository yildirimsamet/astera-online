#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * THE WEB TYPECHECK IN PARTS (2026-11-24). Sources and tests together no longer fit one
 * compiler under the 3 GiB heap this PC allows (owner 2026-11-03), so the project is
 * checked as the sources, then the tests in halves. Every file is still checked under the
 * project's own options; each test part carries the ambient declarations and the setup
 * that the whole program would have seen.
 *
 * @param {{ include: string[], tests: string[], testParts: number }} project
 * @returns {Array<{ include: string[], files?: string[] }>}
 */
export function typecheckParts({ include, tests, testParts }) {
  const setup = 'test/setup.ts';
  const checked = tests.filter(file => file !== setup);
  if (checked.length === 0) throw new Error('typecheck-parts: no test files found');
  const size = Math.ceil(checked.length / testParts);
  const parts = [];
  for (let start = 0; start < checked.length; start += size) {
    parts.push({ include: ['src/**/*.d.ts'], files: [setup, ...checked.slice(start, start + size)] });
  }
  return [{ include: include.filter(pattern => !pattern.startsWith('test/')) }, ...parts];
}

function main() {
  const cwd = process.cwd();
  const require = createRequire(resolve(cwd, 'package.json'));
  const ts = require('typescript');
  const tsc = require.resolve('typescript/bin/tsc');
  const { config, error } = ts.readConfigFile(resolve(cwd, 'tsconfig.json'), ts.sys.readFile);
  if (error) throw new Error(ts.flattenDiagnosticMessageText(error.messageText, '\n'));
  const parsed = ts.parseJsonConfigFileContent(config, ts.sys, cwd);
  const tests = parsed.fileNames.map(file => relative(cwd, file)).filter(file => file.startsWith('test/'));
  const parts = typecheckParts({ include: config.include, tests, testParts: 2 });
  let failed = false;
  parts.forEach((part, index) => {
    const file = resolve(cwd, `tsconfig.part-${String(index)}.tmp.json`);
    writeFileSync(file, JSON.stringify({ extends: './tsconfig.json', exclude: config.exclude, ...part }));
    try {
      const run = spawnSync(process.execPath, [tsc, '--noEmit', '-p', file], { stdio: 'inherit' });
      if (run.status !== 0) failed = true;
    } finally {
      rmSync(file, { force: true });
    }
  });
  process.exitCode = failed ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
