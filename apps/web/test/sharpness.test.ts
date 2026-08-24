import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * SHARPNESS IS A PRODUCT INVARIANT.
 *
 * A blur introduced on one modal or one transition still softens the galaxy, so
 * checking a handful of components is not enough. This scans the shipped source
 * and turns every common full-screen/UI blur mechanism into a regression.
 * Selective bloom remains legal because it is light, not a focus effect.
 */
const SOURCE = resolve(process.cwd(), 'src');
const TEXT_EXTENSIONS = new Set(['.css', '.ts', '.tsx']);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return TEXT_EXTENSIONS.has(extname(entry.name)) ? [path] : [];
  });
}

const FORBIDDEN = [
  /backdrop-filter\s*:/i,
  /backdrop-blur(?:-|\b)/i,
  /filter\s*:\s*[^;]*\bblur\s*\(/i,
  /\b(?:DepthOfField|MotionBlur)\b/,
];

describe('the sharp image contract', () => {
  it('contains no source-level focus or backdrop blur', () => {
    const violations = sourceFiles(SOURCE).flatMap((path) => {
      const source = readFileSync(path, 'utf8');
      return FORBIDDEN.some((pattern) => pattern.test(source))
        ? [relative(SOURCE, path)]
        : [];
    });

    expect(violations).toEqual([]);
  });
});
