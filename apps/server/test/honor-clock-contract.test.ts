import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';

// An unclocked writer works in legacy seasons but aborts once Honor is enabled.
// Catch forgotten paths before activation, including infrequent recovery/CLI paths.
it('every production wealth refresh supplies its inventory observation time', () => {
  const root = fileURLToPath(new URL('../src/', import.meta.url));
  const missing: string[] = [];
  const scan = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) { scan(path); continue; }
      if (!entry.name.endsWith('.ts')) continue;
      const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
      const visit = (node: ts.Node): void => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)
          && ['recomputeWealth', 'recomputePlayerWealth'].includes(node.expression.text)
          && node.arguments.length < 3) {
          missing.push(`${relative(root, path)}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`);
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
  };
  scan(root);
  expect(missing).toEqual([]);
});
