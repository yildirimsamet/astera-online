import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const forbidden = new Set(['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2', 'pow', 'exp', 'log', 'hypot', 'cbrt']);

describe('arena prediction is reproducible on different JavaScript engines', () => {
  it('uses no transcendental Math operation or exponent operator in the shared simulation', () => {
    const directory = 'src/arena';
    expect(existsSync(directory), 'the independent arena rules module exists').toBe(true);
    const offenders: string[] = [];
    for (const name of readdirSync(directory)) {
      if (!name.endsWith('.ts')) continue;
      const path = join(directory, name);
      const file = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
      const visit = (node: ts.Node): void => {
        if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.AsteriskAsteriskToken) {
          offenders.push(`${path}: exponent operator`);
        }
        if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)
          && node.expression.text === 'Math' && forbidden.has(node.name.text)) {
          offenders.push(`${path}: Math.${node.name.text}`);
        }
        ts.forEachChild(node, visit);
      };
      visit(file);
    }
    expect(offenders).toEqual([]);
  });
});
