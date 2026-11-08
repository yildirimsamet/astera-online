import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/keys.js';
import { vesselSchema } from '../src/api/starterSchemas.js';
import { DebrisFocus } from '../src/galaxy/FocusPanel.js';
import { GalaxyReadout } from '../src/v2/hud/GalaxyCorners.js';
import { partMarks, partsSeen } from '../src/starter/partMarks.js';
import { MigrationPanel } from '../src/starter/MigrationPanel.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { wireVessel } from './starterVesselFixture.js';

afterEach(cleanup);

const at = (x: number) => ({ x, y: 0, z: 0 });

describe('where a part is marked', () => {
  const worlds = [{ position: at(1), hasPart: true }, { position: at(2) }, { position: at(3), hasPart: false }];
  const fields = [{ at: at(4), hasPart: true }, { at: at(5) }];

  it('takes only the places this ship can see one in', () => {
    expect(partMarks(worlds, fields)).toEqual([at(1), at(4)]);
    expect(partsSeen(worlds, fields)).toBe(2);
  });

  it('is empty before any data has come', () => {
    expect(partMarks(undefined, undefined)).toEqual([]);
  });
});

describe('the Drive panel while hunting', () => {
  // The drive hull can be ordered, so the parts are on the map (`partsVisible`).
  // The drive opens once the radar is up (owner 2026-11-08): no battle is asked of it.
  const HUNTING = { modules: { REFINERY: 4, EXTRACTOR: 3, SURVEY: 2, HANGAR: 2, TELESCOPE: 1, RADAR: 1 }, facts: [], parts: 1, fuel: 0 };
  function panel(seen: { galaxy?: object; mining?: object }) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    if (seen.galaxy) client.setQueryData(keys.galaxy, seen.galaxy);
    const fetch: typeof globalThis.fetch = () => Promise.resolve(new Response('{}', { status: 404 }));
    render(<QueryClientProvider client={client}><ApiProvider api={new Api({ fetch, authTransport: null })}><ToastProvider>
      <MigrationPanel vessel={vesselSchema.parse(wireVessel({ progress: HUNTING }))} onJump={vi.fn()} />
    </ToastProvider></ApiProvider></QueryClientProvider>);
  }

  it('says how many it has found, and that the map marks them', () => {
    panel({ galaxy: { planets: [{ id: 'a', position: at(1), hasPart: true }] } });
    expect(screen.getByTestId('parts-seen').textContent).toMatch(/1/);
  });

  it('says how to find one when none is in sight', () => {
    panel({ galaxy: { planets: [] } });
    expect(screen.getByTestId('parts-seen').textContent).toMatch(/probe/i);
  });
});

describe('a wreck field holding a part', () => {
  const field = (hasPart?: boolean) => ({ id: 'f', planetId: null, at: at(1), alloy: 100, crystal: 50, deuterium: 0, minutesLeft: 900, ...(hasPart ? { hasPart } : {}) });
  const show = (over: ReturnType<typeof field>) => render(<DebrisFocus field={over} planetName={undefined} craftAvailable={1} craftHold={200} reachMinutes={5} atHome={() => ({ room: 9999, lost: { alloy: 0, crystal: 0, deuterium: 0 } })}
    run={undefined} craftReadyAt={null} onSend={vi.fn()} onClose={vi.fn()} busy={false} open onToggle={vi.fn()} />);

  it('says so on the card', () => {
    show(field(true));
    expect(screen.getByTestId('part-here')).toBeTruthy();
  });

  it('says nothing otherwise', () => {
    show(field());
    expect(screen.queryByTestId('part-here')).toBeNull();
  });
});

describe('the map list aboard', () => {
  const counts = { worlds: 0, ships: 4, outposts: 2, fleetsAway: 0, rocks: 0, pirates: 0, wrecks: 0 };
  const targets = [{ kind: 'planet' as const, id: 'post-1', label: 'OP-3A1F', detail: 'Guarded' }];

  it('counts ships, not worlds, and names the outposts', () => {
    render(<GalaxyReadout counts={counts} targets={targets} onFocusTarget={vi.fn()} />);
    const caption = screen.getByTestId('view-caption').textContent;
    expect(caption).toMatch(/4 ships/);
    expect(caption).toMatch(/2 outposts/);
    expect(caption).not.toMatch(/world/);
  });

  it('flies to an outpost from the list', () => {
    const onFocus = vi.fn();
    render(<GalaxyReadout counts={counts} targets={targets} onFocusTarget={onFocus} />);
    fireEvent.click(screen.getByRole('button', { name: /2 outposts/ }));
    fireEvent.click(screen.getByRole('button', { name: /OP-3A1F/ }));
    expect(onFocus).toHaveBeenCalledWith({ kind: 'planet', id: 'post-1' });
  });

  it('leaves the main game\'s readout as it was', () => {
    render(<GalaxyReadout counts={{ worlds: 3, fleetsAway: 0, rocks: 0, pirates: 0, wrecks: 0 }} />);
    expect(screen.getByTestId('view-caption').textContent).toMatch(/3 worlds/);
  });
});
