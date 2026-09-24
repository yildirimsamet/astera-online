import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * THE BASE'S WALLET COLLECTS (owner, 2026-09-24). A wiring fact no component test
 * sees, so it reads the screen's source, as `context-slot-host.test` does.
 */
const source = readFileSync('src/screens/PlanetScreen.tsx', 'utf8');
const wallet = source.slice(source.indexOf('function Wallet('), source.indexOf('/** Two independent commitments'));

describe('the works on the base', () => {
  it('are a collect button on the wallet, not a caption', () => {
    expect(wallet).toMatch(/<CollectHost place="base"/);
    expect(wallet).not.toMatch(/planet\.wallet\.inTheWorks/);
  });

  /** A full store opens the tab that holds the Vault. */
  it('send a full store to Production, where the Vault is raised', () => {
    expect(source).toMatch(/<Wallet held=\{held\} onStore=\{\(\) => \{ onSelect\('grow'\); \}\}/);
  });

  /** The rehearsal cannot collect: its fetch refuses every write. */
  it('stay out of the Academy', () => {
    expect(wallet).toMatch(/lesson \? null : <CollectHost/);
  });
});
