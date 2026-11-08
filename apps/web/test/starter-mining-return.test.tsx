import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotificationView, ReturnPayload } from '../src/api/schemas.js';
import i18n from '../src/i18n/index.js';
import { describeNotification } from '../src/lib/notifications.js';
import { AwaySheet } from '../src/v2/hud/AwaySheet.js';

/**
 * THE PROSPECTOR COMES HOME (plan F5, N5). What it brought, what went into the works and what found no
 * room are three numbers, and the player is told all three: in the signal when it lands, and in the
 * away card when it landed while they were gone.
 */
const at = new Date('2026-11-08T12:00:00Z');
const home = (payload: object): NotificationView => ({
  id: 'n', kind: 'FLEET_HOME', seen: false, at,
  payload: { kind: 'MINE', cargo: { alloy: 120, crystal: 80, deuterium: 0 }, part: false, ships: 1, wasted: { alloy: 0, crystal: 0, deuterium: 0 }, ...payload },
});
const said = (payload: object) => describeNotification(home(payload), at.getTime());

beforeEach(async () => { await i18n.changeLanguage('en'); });
afterEach(() => { cleanup(); });

describe('the Prospector\'s signal, aboard', () => {
  it('says what it brought and that all of it went in', () => {
    expect(said({})).toBe('Your Prospector is back with 200: all of it is in the works.');
  });

  it('says what went in and what was lost, apart', () => {
    expect(said({ wasted: { alloy: 40, crystal: 10, deuterium: 0 } })).toBe('Your Prospector is back with 200: 150 went into the works, 50 found no room and was lost.');
  });

  it('counts the craft', () => {
    expect(said({ ships: 2 })).toBe('Your 2 Prospectors are back with 200: all of it is in the works.');
  });

  it('says so when it came back empty', () => {
    expect(said({ cargo: { alloy: 0, crystal: 0, deuterium: 0 } })).toBe('Your Prospector is back empty: there was nothing left to take.');
  });

  it('adds the thrust part it found', () => {
    expect(said({ part: true })).toBe('Your Prospector is back with 200: all of it is in the works. It found a thrust part too.');
  });

  it('reads a war fleet as before', () => {
    expect(said({ kind: 'ATTACK', cargo: { alloy: 60, crystal: 0, deuterium: 0 } })).toBe(i18n.t('starter.news.fleetHome'));
  });

  it('reads an older signal with no loss on it', () => {
    const { wasted: _, ...old } = home({}).payload as Record<string, unknown>;
    expect(describeNotification({ ...home({}), payload: old }, at.getTime())).toBe('Your Prospector is back with 200: all of it is in the works.');
  });
});

describe('the Prospector home, on the away card', () => {
  const story = (params: object): ReturnPayload => ({
    awayMinutes: 90, asOf: at, pending: [], newUnlocks: [],
    entries: [{ kind: 'fleet_returned', params: { resources: 150, ships: 1, alloy: 100, crystal: 50, deuterium: 0, ...params }, at }],
  });

  it('names what went in, and what found no room', () => {
    render(<AwaySheet aboard story={story({ lost: 50 })} onDoor={vi.fn()} onAll={vi.fn()} onDismiss={vi.fn()} />);
    const row = screen.getByTestId('away-hero');
    expect(row.textContent).toMatch(/\+100 alloy/);
    expect(row.textContent).toMatch(/\+50 crystal/);
    expect(row.textContent).toMatch(/50 found no room/);
  });

  it('says nothing of a loss there was not', () => {
    render(<AwaySheet aboard story={story({})} onDoor={vi.fn()} onAll={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.queryByText(/found no room/)).toBeNull();
  });
});

/** F5: a crate's opening is in the ship's log, saying what it paid. */
describe('a crate opened, in the ship log', () => {
  const opened = (crates: string[]): NotificationView => ({ id: 'c', kind: 'CRATE_OPENED', seen: true, at, payload: { crates, alloy: 450, crystal: 200 } });

  it('names the victory crate', () => {
    expect(describeNotification(opened(['FIRST_OUTPOST_VICTORY']), at.getTime())).toBe('Victory crate opened: +450 alloy, +200 crystal.');
  });

  it('counts salvage crates', () => {
    expect(describeNotification(opened(['REFINERY:2']), at.getTime())).toBe('Salvage crate opened: +450 alloy, +200 crystal.');
    expect(describeNotification(opened(['REFINERY:2', 'SURVEY:1']), at.getTime())).toBe('2 salvage crates opened: +450 alloy, +200 crystal.');
  });
});
