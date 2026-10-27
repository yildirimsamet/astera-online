import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLASS_STATS } from '@astera/rules/arena';
import i18n from '../../src/i18n/index.js';
import { hangarPost } from '../../src/arena/hangar/stageQuality.js';

// The bay as the S22 met it: a draw that throws (EffectComposer on a lost context), or a context the GPU took back.
const stage = vi.hoisted((): { mode: 'throw' | 'lost' } => ({ mode: 'throw' }));
vi.mock('../../src/arena/hangar/HangarStage.js', async () => {
  const { useEffect } = await import('react');
  function Stage({ onLost }: { onLost: () => void }) {
    useEffect(() => { if (stage.mode === 'lost') onLost(); }, [onLost]);
    if (stage.mode === 'throw') throw new TypeError("Cannot read properties of null (reading 'alpha')");
    return <div data-testid="stage" />;
  }
  return { default: Stage };
});
const room = vi.hoisted(() => ({ roomy: true }));
vi.mock('../../src/arena/assets/memory.js', async original => ({ ...await original<object>(), roomyRenderer: () => room.roomy }));
const { HangarPanel } = await import('../../src/arena/hangar/HangarPanel.js');
await import('../../src/arena/TeamPanel.js');

const zero = { alloy: 0, crystal: 0, deuterium: 0 };
const desk = { core: 11, minCore: 9, ship: { class: 'muhafiz', changeUntil: null, fuel: CLASS_STATS.muhafiz.fuelTank, ammo: CLASS_STATS.muhafiz.ammoCapacity,
  hold: [0, 0, 0], readyAt: null, readyReason: null, flying: false, level: 3, xp: 0, xpNext: 150, levelCap: 11, abilities: {}, upgrade: zero },
  refill: { fuel: 0, ammo: 0, total: 0 }, deuterium: 140, alloy: 5000, crystal: 2000, cap: zero, sent: zero,
  resetsAt: '2026-10-24T00:00:00.000Z', entryClosesAt: '2026-11-01T00:00:00.000Z' };
let previous = 'en';
beforeEach(async () => {
  previous = i18n.language; await i18n.changeLanguage('tr');
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(new Response(JSON.stringify(url === '/arena/hangar' ? desk
    : { playerId: '00000000-0000-4000-8000-000000000001', clanId: null, canCreate: false, capacity: 5, claims: [], team: null })))));
});
afterEach(async () => { await i18n.changeLanguage(previous); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

/**
 * B2/B3/F6 (S22, 2026-10-26): the 3D bay is decoration. When it could not draw, the whole game
 * screen fell over ("OYUN ARAYÜZÜ ÇALIŞMAYI DURDURDU"); now the bay steps aside and the desk stays.
 */
describe('a hangar bay that cannot draw', () => {
  for (const mode of ['throw', 'lost'] as const) {
    it(`keeps the desk and shows the ship flat when the bay ${mode === 'throw' ? 'throws' : 'loses its GPU context'}`, async () => {
      stage.mode = mode;
      render(<HangarPanel credential={() => Promise.resolve('tok')} onEnter={vi.fn()} />);
      expect(await screen.findByTestId('hangar-enter')).toBeTruthy();
      await waitFor(() => { expect(document.querySelector('[data-part="stage-fallback"]')?.getAttribute('data-ship')).toBe('muhafiz'); });
    });
  }
});

/**
 * S22, 2026-10-26: a 32-bit Chrome. The galaxy left 64 MB of address space in one block and the
 * 3D bay beside it killed the tab on its second visit. Such a renderer never builds the bay: the
 * ship stands as a still of itself in the bay, and nothing 3D is mounted.
 */
describe('a renderer without room for the bay', () => {
  afterEach(() => { room.roomy = true; });
  it('shows each class as a still in the bay and never mounts the 3D stage', async () => {
    room.roomy = false; stage.mode = 'throw';
    render(<HangarPanel credential={() => Promise.resolve('tok')} onEnter={vi.fn()} />);
    expect(await screen.findByTestId('hangar-enter')).toBeTruthy();
    const flat = document.querySelector('[data-part="stage-fallback"]');
    expect(flat?.getAttribute('data-ship')).toBe('muhafiz');
    expect(flat?.querySelector('img')?.getAttribute('src')).toBe('/assets/arena/hangar/muhafiz.webp');
    expect(screen.queryByTestId('stage')).toBeNull();
    expect(console.error).not.toHaveBeenCalled();
  });
});

describe('the bay\'s post-processing', () => {
  it('blooms on a desktop and at the top quality, never on a phone below it', () => {
    expect(hangarPost('balanced', false)).toBe(true);
    expect(hangarPost('high', true)).toBe(true);
    expect(hangarPost('balanced', true)).toBe(false);
    expect(hangarPost('low', true)).toBe(false);
  });
});
