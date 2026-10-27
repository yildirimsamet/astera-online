import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ARENA_LAYOUT, createSandboxWorld } from '@astera/rules/arena';
import { ArenaHud, type HudBind } from '../../src/arena/Hud.js';
import { createHudStore } from '../../src/arena/store.js';

/**
 * Owner 2026-10-24: the reticle is a ring with a dot, not a cross. The ring is the spread at 500 m
 * (`spreadAt`, rules), projected through the chase camera each frame (client.ts).
 */
const bind: HudBind = { reticle: null, lead: null, hit: null, kill: null, enemies: () => null, threats: () => null, places: () => null, pings: () => null, exit: null, crystal: null,
  damage: null, landing: null, circle: null, incoming: null, radar: null, mapSelf: null, mapAltitude: null };

describe('the reticle', () => {
  it('is a ring round a dot', () => {
    const store = createHudStore(); store.publish(createSandboxWorld({ bots: 0 }), 'flight', false, false);
    const view = render(<ArenaHud store={store} bind={bind} layout={ARENA_LAYOUT} onMenu={() => undefined} connection={null} />).container;
    const reticle = view.querySelector('.ah-reticle');
    expect(reticle?.querySelectorAll('i')).toHaveLength(1);
    expect(reticle?.querySelectorAll('b')).toHaveLength(1);
  });
});
