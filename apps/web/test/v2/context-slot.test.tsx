import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ActiveGalaxyEvent, Contact, PendingThread } from '../../src/api/schemas.js';
import type { Directive } from '../../src/lib/directives.js';
import { activeEvents, slotKey, threatKeyOf } from '../../src/lib/contextSlot.js';
import { ContextSlot, type ContextSlotProps } from '../../src/v2/hud/ContextSlot.js';

/**
 * THE CONTEXT SLOT, DRAWN. Spec B3 (docs/ui-v2/gozlemevi.md).
 *
 * One card at the foot of the galaxy: a threat, else the galaxy event, else a
 * suggestion — never two. What the player selected keeps the screen (its own
 * panel draws it); a threat then waits as a pill instead of tearing it away.
 */

const NOW = Date.parse('2026-09-23T12:00:00Z');

const attack = (minutes: number, planet = 'home'): PendingThread => ({
  kind: 'incoming',
  targetName: 'Kestrel',
  targetPlanetId: planet,
  minutesRemaining: minutes,
  arriveAt: new Date(NOW + minutes * 60_000),
});

const shower: ActiveGalaxyEvent = {
  id: '00000000-0000-4000-8000-000000000001',
  kind: 'ASTEROID_SHOWER',
  startsAt: new Date(NOW - 3_600_000),
  endsAt: new Date(NOW + 1_800_000),
  asteroidSpawnMultiplier: 2,
};

const trade: ActiveGalaxyEvent = {
  id: '00000000-0000-4000-8000-000000000002',
  kind: 'TRADE_SHIP',
  startsAt: new Date(NOW - 600_000),
  endsAt: new Date(NOW + 1_200_000),
  rate: { alloy: 1, crystal: 2, deuterium: 4 },
  appearsAtMinute: 0,
  expiresAtMinute: 30,
  orbit: { radius: 100, period: 60, phase: 0, inclination: 0, ascendingNode: 0, speed: 1 },
};

const growth: Directive = {
  id: 'undefended',
  kind: 'growth',
  title: 'Your shield ends in 3h 00m: build a ground defence',
  detail: '456 is exposed to raids.',
  action: { label: 'Build defence', screen: 'planet', group: 'defend' },
  weight: 820,
};

const props = (over: Partial<ContextSlotProps> = {}): ContextSlotProps => ({
  now: NOW,
  selected: false,
  threats: [],
  contacts: [],
  events: [],
  suggestion: null,
  onPrepare: vi.fn(),
  onLook: vi.fn(),
  onShowEvent: vi.fn(),
  onAct: vi.fn(),
  onClearSelection: vi.fn(),
  dismissed: new Set(),
  onDismiss: vi.fn(),
  ...over,
});

/** The host's memory of closed cards, as the galaxy keeps it: outside the slot. */
function Hosted(over: Partial<ContextSlotProps>) {
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  return (
    <ContextSlot
      {...props(over)}
      dismissed={dismissed}
      onDismiss={(keys) => { setDismissed((current) => new Set([...current, ...keys])); }}
    />
  );
}

const convoy: ActiveGalaxyEvent = {
  id: '00000000-0000-4000-8000-000000000003',
  kind: 'INTERGALACTIC_CONVOY',
  startsAt: new Date(NOW - 600_000),
  endsAt: new Date(NOW + 1_200_000),
  appearsAtMinute: 0,
  expiresAtMinute: 30,
  route: { from: { x: 0, y: 0, z: 0 }, to: { x: 1, y: 0, z: 0 }, velocity: { x: 1, y: 0, z: 0 }, speed: 1 },
  visual: { formationVersion: 1 },
  rewardPolicy: {
    resourceCapHours: 4,
    fullRewardForceRatio: 1,
    shipDropFullFirepower: 1,
    shipDropChanceAtFullQuality: 0.5,
    maxAwardedShips: 3,
  },
};

describe('which events are running', () => {
  it('holds an event from its start up to, not including, its end', () => {
    expect(activeEvents([shower], shower.startsAt.getTime() - 1)).toEqual([]);
    expect(activeEvents([shower], shower.startsAt.getTime())).toEqual([shower]);
    expect(activeEvents([shower], shower.endsAt.getTime() - 1)).toEqual([shower]);
    expect(activeEvents([shower], shower.endsAt.getTime())).toEqual([]);
  });
});

describe('the threat key', () => {
  it('names an attack by where and when it lands, not by its place in a list', () => {
    expect(threatKeyOf(attack(9))).toBe(threatKeyOf({ ...attack(9) }));
    expect(threatKeyOf(attack(9))).not.toBe(threatKeyOf(attack(12)));
    expect(threatKeyOf(attack(9, 'home'))).not.toBe(threatKeyOf(attack(9, 'colony')));
  });
});

describe('the context slot', () => {
  it('draws nothing when there is nothing to say', () => {
    const { container } = render(<ContextSlot {...props()} />);
    expect(container.innerHTML).toBe('');
  });

  it('leads with the nearest attack, in red, with its clock and a way to prepare', async () => {
    const onPrepare = vi.fn();
    render(<ContextSlot {...props({ threats: [attack(30), attack(9)], events: [shower], suggestion: growth, onPrepare })} />);
    const card = screen.getByRole('region', { name: 'Incoming attack' });
    expect(card).toHaveAttribute('data-tone', 'hostile');
    expect(within(card).getByText('lands in 9m 00s')).toBeInTheDocument();
    expect(screen.getAllByRole('region')).toHaveLength(1);
    await userEvent.click(within(card).getByRole('button', { name: 'Prepare defence' }));
    expect(onPrepare).toHaveBeenCalledTimes(1);
  });

  it('offers a look only at an attack the player can see', async () => {
    const onLook = vi.fn();
    const seen: Contact = {
      id: 'c-1',
      kind: 'unknown',
      from: { x: 0, y: 0, z: 0 },
      to: { x: 1, y: 0, z: 1 },
      startAt: new Date(NOW - 60_000),
      endAt: new Date(NOW + 540_000),
      inbound: true,
    };
    const inSight = { ...attack(9), contactId: 'c-1' };
    const { rerender } = render(<ContextSlot {...props({ threats: [inSight] })} />);
    expect(screen.queryByRole('button', { name: 'Look at it' })).toBeNull();
    rerender(<ContextSlot {...props({ threats: [inSight], contacts: [seen], onLook })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Look at it' }));
    expect(onLook).toHaveBeenCalledWith('c-1');
  });

  it('falls to the event, then the suggestion, as each is dismissed', async () => {
    render(<Hosted threats={[attack(9)]} events={[shower]} suggestion={growth} />);
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.getByRole('region', { name: 'Galaxy event' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.getByRole('region', { name: 'Weakness' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('shows the merchant and frames it on request, and leaves a shower without a button', async () => {
    const onShowEvent = vi.fn();
    const { rerender } = render(<ContextSlot {...props({ events: [trade], onShowEvent })} />);
    // The rate is drawn, not written: three goods against Deuterium, each with its own picture.
    expect(screen.getAllByRole('img').map((img) => img.getAttribute('alt'))).toHaveLength(3);
    await userEvent.click(screen.getByRole('button', { name: 'Show me' }));
    expect(onShowEvent).toHaveBeenCalledWith(trade);
    rerender(<ContextSlot {...props({ events: [shower], onShowEvent })} />);
    expect(screen.getByText('Spawn ×2 · 30m 00s left')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show me' })).toBeNull();
  });

  /** The old chip drew every running event; one card now lists them, each framable on its own. */
  it('lists overlapping events on one card, each framable on its own', async () => {
    const onShowEvent = vi.fn();
    render(<ContextSlot {...props({ events: [trade, convoy], onShowEvent })} />);
    expect(screen.getAllByRole('region')).toHaveLength(1);
    const shows = screen.getAllByRole('button', { name: 'Show me' });
    expect(shows).toHaveLength(2);
    await userEvent.click(shows[1]!);
    expect(onShowEvent).toHaveBeenCalledWith(convoy);
  });

  it('carries a suggestion in the colour of what it is, never red for a gap', async () => {
    const onAct = vi.fn();
    render(<ContextSlot {...props({ suggestion: growth, onAct })} />);
    const card = screen.getByRole('region', { name: 'Weakness' });
    expect(card).toHaveAttribute('data-tone', 'warn');
    await userEvent.click(within(card).getByRole('button', { name: 'Build defence' }));
    expect(onAct).toHaveBeenCalledWith(growth);
  });

  /**
   * HOW BIG. *"kullanıcı sürekli ekranda kocaman bunu görmek istemez."* The advice
   * folds to one line and stays folded on this device — the same preference the old
   * guide kept — and folding it acts on nothing.
   */
  it('folds a suggestion to one line and remembers it, without acting on the press', async () => {
    localStorage.clear();
    const onAct = vi.fn();
    const first = render(<ContextSlot {...props({ suggestion: growth, onAct })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Hide' }));
    expect(onAct).not.toHaveBeenCalled();
    expect(screen.queryByText('456 is exposed to raids.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Show' })).toHaveTextContent(growth.title);
    first.unmount();
    render(<ContextSlot {...props({ suggestion: growth, onAct })} />);
    expect(screen.queryByText('456 is exposed to raids.')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Show' }));
    expect(screen.getByText('456 is exposed to raids.')).toBeInTheDocument();
    localStorage.clear();
  });

  /**
   * THE FOOT-RIGHT CORNER (owner, 2026-09-24): chat lives low on the right where a thumb
   * reaches it. It stands right above the card, never under it, and alone above the dock
   * when there is no card; while a selection keeps the screen, its panel has the foot (H5).
   */
  describe('its corner', () => {
    const corner = <button type="button">chat</button>;

    it('stands alone at the foot when there is no card', () => {
      render(<ContextSlot {...props({ corner })} />);
      expect(screen.getByRole('button', { name: 'chat' })).toBeInTheDocument();
    });

    it('stands right above the card, in the same column, never under it', () => {
      render(<ContextSlot {...props({ corner, threats: [attack(9)] })} />);
      const button = screen.getByRole('button', { name: 'chat' });
      const card = screen.getByRole('region', { name: 'Incoming attack' });
      expect(button.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(button.closest('[data-slot-foot]')).toBe(card.closest('[data-slot-foot]'));
    });

    it('gives way while a selection keeps the screen', () => {
      render(<ContextSlot {...props({ corner, selected: true })} />);
      expect(screen.queryByRole('button', { name: 'chat' })).toBeNull();
    });
  });

  it('leaves a selection its screen, with the attack as a pill that takes the player to it', async () => {
    const onClearSelection = vi.fn();
    render(<ContextSlot {...props({ selected: true, threats: [attack(9), attack(20)], onClearSelection })} />);
    expect(screen.queryByRole('region')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Incoming attacks: 2' }));
    expect(onClearSelection).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('region', { name: 'Incoming attack' })).toBeInTheDocument();
  });

  it('brings a new attack back after an old one was dismissed', async () => {
    const { rerender } = render(<Hosted threats={[attack(9)]} />);
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('region')).toBeNull();
    rerender(<Hosted threats={[attack(9), attack(4, 'colony')]} />);
    expect(screen.getByRole('region', { name: 'Incoming attack' })).toBeInTheDocument();
  });

  /**
   * AN EVENT IS CLOSED ON ITS OWN, NOT AS PART OF A SET. Found in review: the card
   * was remembered by the joined ids of every event on it, so when the merchant left
   * the convoy the player had already closed came straight back as a "new" card.
   */
  it('keeps a closed event closed when an event it shared the card with ends', async () => {
    const { rerender } = render(<Hosted events={[trade, convoy]} />);
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    rerender(<Hosted events={[convoy]} />);
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('brings a new event back alone, without the ones already closed', async () => {
    const { rerender } = render(<Hosted events={[trade]} />);
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    rerender(<Hosted events={[trade, convoy]} />);
    const card = screen.getByRole('region', { name: 'Galaxy event' });
    expect(within(card).getAllByRole('button', { name: 'Show me' })).toHaveLength(1);
    expect(within(card).getByText('Intergalactic Convoy')).toBeInTheDocument();
  });

  /**
   * THE MEMORY LIVES IN THE HOST. Found in review: the slot is drawn only while no
   * page is open, so a memory it kept itself was wiped by every visit to the base
   * and every closed card came back. The galaxy, which never unmounts, keeps it.
   */
  it('leaves the memory of closed cards to its host', async () => {
    const onDismiss = vi.fn();
    const { rerender } = render(<ContextSlot {...props({ threats: [attack(9)], onDismiss })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledWith([slotKey('threat', threatKeyOf(attack(9)))]);
    rerender(<ContextSlot {...props({ threats: [attack(9)], dismissed: new Set([slotKey('threat', threatKeyOf(attack(9)))]) })} />);
    expect(screen.queryByRole('region')).toBeNull();
  });
});
