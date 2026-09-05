import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * CHAT READS TWO POINTS LARGER THAN THE REST OF THE GAME. D170, owner request.
 *
 * Every other surface in Astera states a FACT — a price, a level, a countdown —
 * and the compact scale is what lets a 375px screen hold enough of them to make a
 * decision with. Chat states SENTENCES, written by people, read in a row, and 12px
 * of running prose on a phone is the one place the compact rule costs more than it
 * buys.
 *
 * IT IS A SCOPE, NOT A NEW SIZE. `.chat-type` re-points the two type tokens the
 * chat surface actually uses, so nothing outside the sheet moves and there is no
 * second scale to keep in step with the first. Raising `--text-body` globally
 * would have grown every row in the game by two points.
 */

const CSS = readFileSync(resolve(__dirname, '../src/styles/chrome.css'), 'utf8');

describe('the chat type scale', () => {
  it('defines a scoped two-point lift rather than a second scale', () => {
    const block = /\.chat-type\s*\{([^}]*)\}/.exec(CSS)?.[1] ?? '';
    expect(block, '.chat-type is missing from chrome.css').not.toBe('');
    expect(block).toMatch(/--text-body:\s*14px/);
    expect(block).toMatch(/--text-micro:\s*11px/);
  });

  it('leaves the global scale where it was', () => {
    const styles = readFileSync(resolve(__dirname, '../src/styles.css'), 'utf8');
    expect(styles).toMatch(/--text-body:\s*12px/);
    expect(styles).toMatch(/--text-micro:\s*9px/);
  });

  it('is worn by the chat screen itself', () => {
    const screen = readFileSync(resolve(__dirname, '../src/screens/ChatScreen.tsx'), 'utf8');
    expect(screen).toMatch(/chat-type/);
  });
});
