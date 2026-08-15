#!/usr/bin/env node
/**
 * Inlines rules.mjs + prototype.js into prototype-standalone.html.
 *
 * The served version imports rules.mjs so there is exactly one copy of the
 * maths. This produces a single file you can email to a tester who will not
 * run a web server. Re-run it after any rules change.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const rules = readFileSync('rules.mjs', 'utf8')
  .replace(/^export\s+/gm, '');

const proto = readFileSync('prototype.js', 'utf8')
  .replace(/^import\s*\{[\s\S]*?\}\s*from\s*'\.\/rules\.mjs';\s*$/m, '')
  .replace(/^\/\* Test hook[\s\S]*$/m, '');

const html = readFileSync('prototype.html', 'utf8')
  .replace(
    '<script type="module" src="./prototype.js"></script>',
    `<script type="module">\n/* ---- rules.mjs ---- */\n${rules}\n/* ---- prototype.js ---- */\n${proto}\n</script>`
  )
  .replace('<title>Blindspace — text prototype</title>',
           '<title>Blindspace — text prototype (standalone)</title>');

writeFileSync('prototype-standalone.html', html);
console.log(`prototype-standalone.html  ${(html.length / 1024).toFixed(0)} KB — open it directly, no server needed`);
