import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PIRATE } from '@astera/rules';
import { ContactFocus, PirateFocus, RunFocus, ThreadFocus } from '../src/galaxy/FocusPanel.js';
import type { Contact, MiningRun, PendingThread, PirateContact } from '../src/api/schemas.js';

/**
 * G4-h2 (2026-11-15): THE PIRATE, A CONTACT, A RUN AND A FLIGHT OF MINE ON THE GAME KIT.
 * "Shall I attack it, what is that, shall I call it back?" The crews are kit chips — the
 * hull's mark, its name, the count; the figures stand in a kit well; the facts are kit notes;
 * attacking a pirate is the card's one kit press; calling a flight back is the kit's light
 * hold (0.6 s), since it can be done once and never undone.
 */

const V2_LOOK = /(^|\s)(text|bg|border|font)-v2-|rounded-control|rounded-chip|v2-legend|(^|\s)text-(micro|body|caption|label)(\s|$)/;
const oldPaint = (root: Element): string[] =>
  [root, ...root.querySelectorAll('[class]')].map((el) => el.getAttribute('class') ?? '').filter((name) => V2_LOOK.test(name));
const rail = () => document.querySelector<HTMLElement>('[data-focus-rail]')!;
const shell = { onClose: vi.fn(), open: true, onToggle: vi.fn() };

const pirate: PirateContact = {
  id: 'pirate-9', callsign: 'mJtQ', zone: 'IDENTIFIED', at: { x: 100, y: 0, z: 0 }, expiresInMinutes: 96, reachMinutes: 12,
  reach: [{ hull: 'DART', minutes: 12, distance: 900, at: { x: 900, y: 0, z: 0 } }], level: 3,
  fleet: { TEMPEST: 1, DART: 4 }, damageMult: PIRATE.damageMult[3], mass: 'MEDIUM', remembered: true,
};
const contact = (over: Partial<Contact> = {}): Contact => ({
  id: 'c-1', kind: 'fleet', from: { x: 0, y: 0, z: 0 }, to: { x: 100, y: 0, z: 0 }, startAt: new Date(),
  endAt: new Date(Date.now() + 60_000), fleet: { DART: 8, COURIER: 3 }, ...over,
});
const run = (over: Partial<MiningRun> = {}): MiningRun => ({
  id: 'r1', targetKind: 'asteroid', asteroidId: 'rock', debrisFieldId: null, status: 'outbound', craft: 2,
  departAt: new Date(Date.now() - 60_000), arriveAt: new Date(Date.now() + 600_000), recalledAt: null, homeAt: null,
  intercept: { x: 0, y: 0, z: 0 }, minedAlloy: 0, minedCrystal: 0, minedDeuterium: 0, ...over,
});
const thread: PendingThread = {
  kind: 'fleet', id: 'm-1', targetName: 'Kestrel', minutesRemaining: 10, arriveAt: new Date(Date.now() + 600_000), leg: 'outbound',
  fleet: { DART: 12 }, recallable: true,
};

describe('the pirate card on the kit', () => {
  it('draws no old look, names each crew hull on a kit chip and attacks with the kit’s press', () => {
    const onAttack = vi.fn();
    render(<PirateFocus pirate={pirate} fleetAtHome={{ DART: 6 }} onAttack={onAttack} raiding={false} {...shell} />);
    expect(oldPaint(rail())).toEqual([]);
    const chip = rail().querySelector('[data-crew-hull="DART"]')!;
    expect(chip).toHaveClass('gk-crew__hull');
    expect(chip.querySelector('.gk-num')).toHaveTextContent('4');
    expect(rail().querySelector('.gk-well.gk-figures')).not.toBeNull();
    const attack = screen.getByRole('button', { name: /^attack$/i });
    expect(attack).toHaveClass('gk-btn', 'gk-btn--action');
    fireEvent.click(attack);
    expect(onAttack).toHaveBeenCalledOnce();
  });

  it('says a raid is already out as a kit note', () => {
    render(<PirateFocus pirate={pirate} fleetAtHome={{ DART: 6 }} onAttack={vi.fn()} raiding {...shell} />);
    expect(screen.getByText(/already has a raid/i).closest('.gk-inote')).not.toBeNull();
  });
});

describe('a contact on the kit', () => {
  it('in full sight: kit chips for the fleet, no old look', () => {
    render(<ContactFocus contact={contact()} {...shell} />);
    expect(oldPaint(rail())).toEqual([]);
    expect(rail().querySelectorAll('.gk-crew__hull')).toHaveLength(2);
  });

  it('read by Radar and aimed at me: the warning is a hostile kit note', () => {
    render(<ContactFocus contact={contact({ kind: 'unknown', fleet: undefined, mass: 'HEAVY', inbound: true })} {...shell} />);
    expect(oldPaint(rail())).toEqual([]);
    expect(screen.getByText(/arrival time is delivered separately/i).closest('.gk-inote')).toHaveAttribute('data-tone', 'hostile');
  });
});

describe('calling a flight back on the kit', () => {
  it('my Prospectors: a 0.6 s kit hold, not a tap', () => {
    const onRecall = vi.fn();
    render(<RunFocus run={run()} rock={undefined} wreck={undefined} minutesRemaining={9} onRecall={onRecall} {...shell} />);
    expect(oldPaint(rail())).toEqual([]);
    const hold = within(rail()).getByRole('button', { name: /^recall prospectors/i });
    expect(hold).toHaveAttribute('data-hold');
    expect(hold.style.getPropertyValue('--gk-hold-ms')).toBe('600ms');
    fireEvent.click(hold);
    expect(onRecall).not.toHaveBeenCalled();
  });

  it('my fleet: the same hold, chips for the ships, no old look', () => {
    render(<ThreadFocus thread={thread} minutesRemaining={10} onRecall={vi.fn()} {...shell} />);
    expect(oldPaint(rail())).toEqual([]);
    expect(rail().querySelector('[data-crew-hull="DART"]')).not.toBeNull();
    expect(within(rail()).getByRole('button', { name: /^recall fleet/i })).toHaveAttribute('data-hold');
  });

  it('says what a run home carries as a kit note', () => {
    render(<RunFocus run={run({ status: 'returning', homeAt: new Date(Date.now() + 300_000), arriveAt: new Date(Date.now() - 60_000), minedAlloy: 380, minedCrystal: 160 })}
      rock={undefined} wreck={undefined} minutesRemaining={5} {...shell} />);
    expect(screen.getByText(/380/).closest('.gk-inote')).not.toBeNull();
  });
});
