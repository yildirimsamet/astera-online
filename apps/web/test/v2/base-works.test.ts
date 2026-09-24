import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * THE BASE'S WORKS ARE A POOL UNDER THE STORE (owner, 2026-09-24). The first cut put a
 * collect pill on the wallet; it would not fit beside 100k figures and did not say the
 * works fill. A wiring fact no component test sees, so it reads the screen's source,
 * as `context-slot-host.test` does; the pool itself is `works-pool.test.tsx`.
 */
const source = readFileSync('src/screens/PlanetScreen.tsx', 'utf8');
const wallet = source.slice(source.indexOf('function Wallet('), source.indexOf('/** Two independent commitments'));
const hero = source.slice(source.indexOf('<PlanetHero planet={data} />'));

describe('the works on the base', () => {
  it('are their own row under the store, and the wallet is the store alone', () => {
    expect(hero.slice(0, 300)).toMatch(/<CollectHost place="base"/);
    expect(wallet).not.toMatch(/CollectHost/);
    expect(wallet).not.toMatch(/planet\.wallet\.inTheWorks/);
  });

  /** A full store opens the tab that holds the Vault. */
  it('send a full store to Production, where the Vault is raised', () => {
    expect(hero.slice(0, 300)).toMatch(/<CollectHost place="base" onOpenBase=\{\(\) => \{ setTab\('grow'\); \}\} \/>/);
  });

  /** The rehearsal cannot collect: its fetch refuses every write — and the hero is not drawn there. */
  it('stay out of the Academy', () => {
    expect(source).toMatch(/\{!lesson && <div className="flex flex-col gap-2 px-2 pt-2">\s*<PlanetHero planet=\{data\} \/>/);
  });
});
