import { describe, expect, it } from 'vitest';
import { typecheckParts } from './typecheck-parts.mjs';

const include = ['src/**/*.ts', 'src/**/*.tsx', 'test/**/*.ts', 'test/**/*.tsx', 'public/a.js', '*.ts'];
const tests = ['test/a.test.ts', 'test/b.test.tsx', 'test/setup.ts', 'test/v2/c.test.ts', 'test/d.test.ts'];

describe('the web typecheck in parts (2026-11-24: one program no longer fits the 3 GiB heap)', () => {
  it('checks the sources apart from the tests, with everything else the project includes', () => {
    const [source] = typecheckParts({ include, tests, testParts: 2 });
    expect(source).toEqual({ include: ['src/**/*.ts', 'src/**/*.tsx', 'public/a.js', '*.ts'] });
  });

  it('puts every test file in exactly one part, each carrying the ambient types and the setup', () => {
    const [, ...parts] = typecheckParts({ include, tests, testParts: 2 });
    expect(parts).toHaveLength(2);
    for (const part of parts) {
      expect(part.include).toEqual(['src/**/*.d.ts']);
      expect(part.files).toContain('test/setup.ts');
    }
    const checked = parts.flatMap(part => part.files.filter(file => file !== 'test/setup.ts'));
    expect(checked.toSorted()).toEqual(tests.filter(file => file !== 'test/setup.ts').toSorted());
  });

  it('refuses a project with no tests rather than checking nothing', () => {
    expect(() => typecheckParts({ include, tests: [], testParts: 2 })).toThrow(/no test files/);
  });
});
