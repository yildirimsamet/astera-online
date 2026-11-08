import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReturnPayload } from '../src/api/schemas.js';
import i18n from '../src/i18n/index.js';
import { AwaySheet } from '../src/v2/hud/AwaySheet.js';

/**
 * THE RETURN, ABOARD (plan F5, C An 7). The player comes back to what they themselves sent out: that
 * result is the one big moment, with what it brought against what it cost. What else happened waits
 * one tap away, and what came back online is named last, as the next thing to try.
 */
const at = new Date('2026-11-08T12:00:00Z');
const earlier = new Date(at.getTime() - 600_000);
const story = (entries: ReturnPayload['entries'], newUnlocks: ReturnPayload['newUnlocks'] = []): ReturnPayload => ({ awayMinutes: 95, asOf: at, pending: [], newUnlocks, entries });
const show = (payload: ReturnPayload, aboard = true) => render(<AwaySheet aboard={aboard} story={payload} onDoor={vi.fn()} onAll={vi.fn()} onDismiss={vi.fn()} />);

beforeEach(async () => { await i18n.changeLanguage('en'); });
afterEach(() => { cleanup(); });

describe('the return, aboard', () => {
  const mixed = story([
    { kind: 'raided', params: { grade: 'REPELLED', loot: 0, lost: 0 }, at },
    { kind: 'accrued', params: { alloy: 300, crystal: 90 }, at },
    { kind: 'fleet_returned', params: { resources: 150, ships: 1, alloy: 100, crystal: 50, deuterium: 0, lost: 50 }, at: earlier },
  ]);

  it('opens on the order the player sent, whatever else happened', () => {
    show(mixed);
    const hero = screen.getByTestId('away-hero');
    expect(hero.textContent).toMatch(/Fleet home/);
    expect(hero.textContent).toMatch(/\+100 alloy/);
    expect(hero.textContent).toMatch(/50 found no room/);
  });

  it('keeps the rest one tap away', () => {
    show(mixed);
    expect(screen.queryByText(/\+300 alloy/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /details \(2\)/i }));
    expect(screen.getByText(/\+300 alloy/)).toBeTruthy();
  });

  // A battle is the moment a haul is not; the first victory is the biggest of them.
  it('puts a raid\'s result before a haul, and the first victory before any other raid', () => {
    show(story([
      { kind: 'fleet_returned', params: { resources: 150, ships: 1, alloy: 150, crystal: 0, deuterium: 0 }, at },
      { kind: 'raid_result', params: { grade: 'REPELLED', loot: 0, lost: 2, opponent: 'Eldeth' }, at },
      { kind: 'raid_result', params: { grade: 'DECISIVE', loot: 60, lost: 0, opponent: 'Tevis', firstVictory: true }, at: earlier },
    ]));
    expect(screen.getByTestId('away-hero').textContent).toMatch(/Tevis has fallen/);
    fireEvent.click(screen.getByRole('button', { name: /details/i }));
    expect(screen.getAllByRole('listitem').map((row) => row.textContent)).toEqual([expect.stringMatching(/repelled/i), expect.stringMatching(/Fleet home/)]);
  });

  // A raid that was thrown back is the player's loss, not a gain, and not a threat either (red is K2's).
  it('tells a repelled raid in the colour of a loss', () => {
    show(story([{ kind: 'raid_result', params: { grade: 'REPELLED', loot: 0, lost: 2, opponent: 'Eldeth' }, at }]));
    expect(screen.getByTestId('away-hero').getAttribute('data-tone')).toBe('loss');
  });

  it('leads with a threat only when no order of theirs came back', () => {
    show(story([
      { kind: 'accrued', params: { alloy: 300, crystal: 90 }, at },
      { kind: 'raided', params: { grade: 'PARTIAL', loot: 120, lost: 2 }, at },
    ]));
    expect(screen.getByTestId('away-hero').getAttribute('data-tone')).toBe('alarm');
  });

  it('tells a first victory as the crate it opened', () => {
    show(story([{ kind: 'raid_result', params: { grade: 'DECISIVE', loot: 60, lost: 0, opponent: 'Tevis', firstVictory: true }, at }]));
    const hero = screen.getByTestId('away-hero');
    expect(hero.textContent).toMatch(/Tevis has fallen/);
    expect(hero.textContent).toMatch(/victory crate is ready/i);
  });

  it('says who got there first', () => {
    show(story([{ kind: 'raid_result', params: { grade: 'DECISIVE', loot: 40, lost: 0, opponent: 'Eldeth', beatenBy: 'Early' }, at }]));
    expect(screen.getByTestId('away-hero').textContent).toMatch(/Early reached Eldeth first/);
  });

  it('names what came back online, once per system', () => {
    show(story([{ kind: 'accrued', params: { alloy: 300, crystal: 0 }, at }], ['fleet', 'salvage', 'chat']));
    const online = screen.getByTestId('away-online');
    expect(online.textContent).toBe('Back online while you were away: Cargo and hangar · Survey antenna');
  });

  it('has no details to open when there is only the one', () => {
    show(story([{ kind: 'fleet_returned', params: { resources: 150, ships: 1, alloy: 150, crystal: 0, deuterium: 0 }, at }]));
    expect(screen.queryByRole('button', { name: /details/i })).toBeNull();
  });
});

describe('the return, in the main galaxy', () => {
  it('keeps its own list of three', () => {
    show(story([
      { kind: 'raided', params: { grade: 'PARTIAL', loot: 120, lost: 2 }, at },
      { kind: 'accrued', params: { alloy: 300, crystal: 90 }, at },
    ]), false);
    expect(screen.queryByTestId('away-hero')).toBeNull();
    expect(within(document.body).getAllByRole('listitem').length).toBe(2);
  });
});
