import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

/**
 * THE V2 TYPEFACES ARE LOADED, AND THE NAMES POINT AT WHAT WAS LOADED. Spec K3.
 *
 * A font-family name that matches nothing fails in silence: the browser falls back
 * to the system face and every screen still renders. That is exactly how the
 * current theme has shipped "IBM Plex Mono" without ever importing it. So the
 * claim here is the pair: the stylesheet imports the face, and the token names the
 * family that import actually declares.
 */

const require = createRequire(import.meta.url);
const styles = readFileSync('src/styles.css', 'utf8');
const tokens = readFileSync('src/v2/tokens.css', 'utf8');

const familyIn = (cssPath: string): string => {
  const css = readFileSync(require.resolve(cssPath), 'utf8');
  const found = /font-family:\s*'([^']+)'/.exec(css);
  if (!found?.[1]) throw new Error(`${cssPath} declares no family`);
  return found[1];
};

const firstFamily = (token: string): string => {
  const found = new RegExp(`--font-${token}:\\s*'([^']+)'`).exec(tokens);
  if (!found?.[1]) throw new Error(`--font-${token} is not declared`);
  return found[1];
};

describe('the v2 typefaces', () => {
  it.each([
    ['v2-ui', '@fontsource-variable/archivo/standard.css'],
    ['v2-mono', '@fontsource/ibm-plex-mono/400.css'],
  ])('imports the face %s names', (token, cssPath) => {
    expect(styles).toContain(`@import '${cssPath}';`);
    expect(firstFamily(token)).toBe(familyIn(cssPath));
  });

  /** Mono carries figures at two weights: a reading and its label. */
  it('loads the mono face at the weight figures are set in', () => {
    expect(styles).toContain("@import '@fontsource/ibm-plex-mono/500.css';");
  });

  /** The width axis is what K3 buys: condensed labels, expanded display. */
  it('loads the Archivo build that carries the width axis', () => {
    const css = readFileSync(require.resolve('@fontsource-variable/archivo/standard.css'), 'utf8');
    expect(css).toMatch(/font-stretch:\s*62% 125%/);
  });
});
