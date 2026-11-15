import type { ReactNode } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import type { GalaxyPlanet, HpRadiationSourceView, PublicMonument } from '../src/api/schemas.js';
import { MonumentFocus, PlanetFocus } from '../src/galaxy/FocusPanel.js';
import { ToastProvider } from '../src/ui/Toast.js';
import type * as Queries from '../src/api/queries.js';
import { planetView } from './fixtures.js';

/**
 * G4-a (2026-11-15): THE FOCUS FRAME ON THE GAME KIT. "What did I touch, shall I open it?"
 * Every focus card — a world, a rock, a wreck, a pirate, a flight — goes through one frame.
 * Closed it is the context card's language: a cut plate, the thing's mark (its portrait, or
 * a ring with its glyph), a 12 px eyebrow, the name, one line, and two kit presses: open it,
 * clear it. Open, the same head over the file, and the actions on a kit strip at its foot.
 */

const galaxy = vi.hoisted(() => ({ hpRadiation: [] as HpRadiationSourceView[] }));
vi.mock('../src/api/queries.js', async (importOriginal) => ({
  ...await importOriginal<typeof Queries>(),
  useGalaxy: () => ({ data: galaxy }),
}));

const V2_LOOK = /(^|\s)(text|bg|border|font)-v2-|rounded-control|(^|\s)text-(micro|body|caption)(\s|$)/;
const oldPaint = (root: Element): string[] =>
  [root, ...root.querySelectorAll('[class]')].map((el) => el.getAttribute('class') ?? '').filter((name) => V2_LOOK.test(name));

const harness = () => {
  const api = new Api({ fetch: () => new Promise<Response>(() => undefined) });
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queries}>
      <ApiProvider api={api}><ToastProvider>{children}</ToastProvider></ApiProvider>
    </QueryClientProvider>
  );
};

const world = (over: Partial<GalaxyPlanet> = {}): GalaxyPlanet => ({
  id: 'p2', name: 'Grimhold', owner: 'Sable', position: { x: 200, y: 0, z: 0 }, coreTier: 2, coreLevel: 6,
  intel: 'RESOLVED', state: { kind: 'NORMAL' }, satellites: [], shielded: false, isSelf: false, ...over,
});

const planet = ({ open, ...over }: { open: boolean } & Partial<GalaxyPlanet>, calls = { onClose: vi.fn(), onToggle: vi.fn() }) => {
  const Wrapper = harness();
  render(
    <Wrapper>
      <PlanetFocus target={world(over)} planet={planetView({ fleet: { DART: 6 } })} intel={undefined} reports={[]} now={0}
        onAttack={vi.fn()} onTransfer={vi.fn()} onInstallTelescope={vi.fn()} onLaunched={vi.fn()} open={open} {...calls} />
    </Wrapper>,
  );
  return calls;
};

const rail = () => document.querySelector<HTMLElement>('[data-focus-rail]')!;

const monument: PublicMonument = { id: 'monument-1', ordinal: 1, difficulty: 'LEGACY', position: { x: 0, y: 7000, z: 0 },
  controller: { kind: 'NEUTRAL' }, capacity: 7270, used: 120, productionPerMinute: 60, radiationHpPerMinute: 4, emptySince: null, respawnAt: null };

describe('the focus frame on the kit', () => {
  it('closed, is a kit cut plate whose head carries none of the old look', () => {
    planet({ open: false });
    expect(rail()).toHaveClass('gk');
    expect(rail()).toHaveAttribute('data-open', 'false');
    expect(rail().querySelector('.gk-focus__plate')).toHaveClass('gk-cut');
    const head = rail().querySelector('.gk-focus__head')!;
    expect(oldPaint(head)).toEqual([]);
    expect(head.querySelector('.gk-label.gk-focus__eyebrow')).toBeInTheDocument();
    // a commander's world is named by its commander; the world's own name rides the eyebrow
    expect(head.querySelector('.gk-focus__title')).toHaveTextContent('Sable');
  });

  it('opens on the head with the kit’s own press, and clears on a kit round press', () => {
    const calls = planet({ open: false });
    const open = within(rail()).getByRole('button', { expanded: false });
    expect(open).toHaveAttribute('data-own-sound');
    fireEvent.click(open);
    expect(calls.onToggle).toHaveBeenCalledOnce();
    const clear = within(rail()).getByRole('button', { name: 'Clear selection' });
    expect(clear).toHaveClass('gk-round');
    // the tutorial's free door and pointer find the clear by this mark
    expect(clear.closest('[data-focus-close]')).not.toBeNull();
    fireEvent.click(clear);
    expect(calls.onClose).toHaveBeenCalledOnce();
  });

  it('open, holds the file in its body and the actions on a kit strip at the foot', () => {
    planet({ open: true });
    expect(rail()).toHaveAttribute('data-open', 'true');
    expect(within(rail()).getByRole('button', { expanded: true })).toBeInTheDocument();
    expect(rail().querySelector('.gk-focus__body')).toBeInTheDocument();
    const acts = rail().querySelector('.gk-focus__acts')!;
    // the strip is the frame's; each card's own presses move onto the kit in its own unit (G4-b…i)
    expect(acts.getAttribute('class')).not.toMatch(V2_LOOK);
  });

  it('wears the colour of whose it is: a world of mine is mine, a rival’s is not', () => {
    planet({ open: false, isOwned: true, kind: 'COLONY', owner: 'Me' });
    expect(rail()).toHaveAttribute('data-tone', 'self');
    expect(rail().querySelector('.gk-focus__plate')).toHaveClass('gk-cut--self');
  });

  it('marks a thing with no portrait with its glyph in a ring', () => {
    render(<MonumentFocus monument={monument} onInspect={vi.fn()} onClose={vi.fn()} />);
    expect(rail().querySelector('.gk-focus__coin svg')).toBeInTheDocument();
    expect(screen.getByText('Abandoned Space Wreckage')).toBeInTheDocument();
  });
});
