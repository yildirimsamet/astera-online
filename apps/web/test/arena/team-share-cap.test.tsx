import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ArenaWorld } from '@astera/rules/arena';
import i18n from '../../src/i18n/index.js';

const flight = vi.hoisted(() => ({ world: null as ArenaWorld | null }));
vi.mock('../../src/arena/assets/load.js', () => ({ loadArenaAssets: () => Promise.resolve({ colliders: new Map(), rivals: [], classes: new Map(), fx: new Map(), sounds: new Map(), music: new Map() }) }));
vi.mock('../../src/arena/assets/memory.js', () => ({ assetTextureBytes: () => 0, releaseKtx2: () => undefined }));
vi.mock('../../src/arena/client.js', () => ({ createArenaClient: (args: { world: ArenaWorld }) => {
  flight.world = args.world;
  return { warm: () => Promise.resolve(), start: vi.fn(), setHud: vi.fn(), setPhase: vi.fn(), dispose: vi.fn(), setSpectator: vi.fn(), reset: vi.fn(), friendAt: vi.fn(), metrics: { fps: 60 } };
} }));
const { default: Sandbox } = await import('../../src/arena/Sandbox.js');

const zero = { alloy: 0, crystal: 0, deuterium: 0 };
const full = { alloy: 1000, crystal: 1000, deuterium: 1000 };
let language: string;
beforeEach(async () => {
  language = i18n.language; await i18n.changeLanguage('tr'); flight.world = null;
  vi.stubGlobal('screen', { orientation: {} });
  // Today's transfer is used up; a team share of 300 alloy waits to be taken.
  vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(new Response(JSON.stringify(url === '/arena/hangar' ? {
    core: 9, minCore: 9, ship: { class: 'akinci', level: 2, fuel: 223, ammo: 100, hold: [0, 0, 0], readyAt: null,
      readyReason: null, flying: false, changeUntil: null, xp: 0, xpNext: 150, levelCap: 9, abilities: {}, upgrade: zero },
    refill: { fuel: 0, ammo: 0, total: 0 }, deuterium: 500, alloy: 500, crystal: 500, cap: full, sent: full,
    resetsAt: '2026-10-25T00:00:00Z', entryClosesAt: '2026-11-25T00:00:00Z',
  } : { playerId: '00000000-0000-4000-8000-000000000001', clanId: null, canCreate: false, capacity: 5, team: null,
    claims: [{ teamId: '00000000-0000-4000-8000-000000000002', share: { alloy: 300, crystal: 0, deuterium: 0 }, finishedAt: '2026-10-24T12:00:00Z', autoAt: '2026-10-31T12:00:00Z' }] }), { status: 200 }))));
});
afterEach(async () => { vi.unstubAllGlobals(); await i18n.changeLanguage(language); });

/** CR6: the Yarık's own team box let a share be taken past the day's cap with no word of what would be lost. */
describe('a team share taken before a flight', () => {
  it('says what today\'s full cap would leave behind', async () => {
    const view = render(<Sandbox credential={() => Promise.resolve('tok')} onLeave={vi.fn()} />);
    await screen.findByText('Akıncı');
    await waitFor(() => { expect(view.container.querySelector('.ap-team [data-claim-overflow]')).not.toBeNull(); });
  });
});
