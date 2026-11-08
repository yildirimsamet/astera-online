import { incomingCopy } from '../src/starter/shipCopy.js';
import { describe, expect, it } from 'vitest';
import { describeNotification } from '../src/lib/notifications.js';

const at = '2026-11-05T12:00:00.000Z';
const say = (kind: string, payload: unknown) => describeNotification({ id: 'n', kind, refId: 'r', payload, seen: false, at: new Date(at) }, new Date(at).getTime());

describe('what the ship tells its commander', () => {
  it('counts down a raid in minutes', () => {
    expect(say('RADAR_WARNING', { arriveAt: '2026-11-05T12:06:00.000Z' })).toBe('Radar: a fleet arrives in 6m.');
  });

  it('gives the outcome of a battle from either side', () => {
    expect(say('BATTLE_REPORT', { grade: 'DECISIVE', attacking: true, opponent: 'Vex', loot: {} })).toBe('Your raid on Vex is over. Read the report.');
    expect(say('BATTLE_REPORT', { grade: 'DECISIVE', attacking: false, opponent: 'Vex', loot: {} })).toBe('Vex attacked your ship. Read the report.');
  });

  it('says what came home and whether it carried a part', () => {
    expect(say('FLEET_HOME', { kind: 'ATTACK', cargo: { alloy: 40, crystal: 0, deuterium: 0 }, part: false })).toBe('Your fleet is back.');
    expect(say('FLEET_HOME', { kind: 'ATTACK', cargo: { alloy: 0, crystal: 0, deuterium: 0 }, part: true })).toBe('Your fleet is back with a thrust part.');
  });

  it('says a target was gone', () => {
    expect(say('FLEET_TURNED_BACK', {})).toBe('The target was out of reach. Your fleet is turning back.');
  });

  it('names what the yard, the lab and the station finished', () => {
    expect(say('YARD_DONE', { subject: 'DART', count: 3, stage: 1 })).toBe('Shipyard: 3 Dart ready.');
    expect(say('RESEARCH_DONE', { subject: 'SHIP_POWER', count: 1, stage: 2 })).toContain('level 2');
    expect(say('DOCK_DONE', { subject: 'DOCK', count: 1, stage: 1 })).toBe('The Repair Station has finished. Your ships are sound.');
  });

  it('warns before the shield drops', () => {
    expect(say('SHIELD_WARNING', { until: '2026-11-05T13:00:00.000Z' })).toBe('Your shield drops in 1h 00m.');
  });

  it('puts a warning whose moment has passed in the past tense, never "in 0m"', () => {
    expect(say('RADAR_WARNING', { arriveAt: '2026-11-05T11:00:00.000Z' })).toBe('Radar: a fleet arrived.');
    expect(say('SHIELD_WARNING', { until: '2026-11-05T11:00:00.000Z' })).toBe('Your shield dropped.');
  });

  it('says a new season is open, and a ship can leave', () => {
    expect(say('SEASON_OPEN', { shardName: 'Vantage' })).toBe('A new season is open in Vantage. Your ship can jump.');
  });

  it('stays silent on a malformed row rather than saying something false', () => {
    expect(say('RADAR_WARNING', {})).toBeNull();
    expect(say('YARD_DONE', { subject: 'SUN', count: 3 })).toBeNull();
  });
});

describe('what an incoming contact is called aboard', () => {
  it('calls a scout a scout and asks for no defence', () => {
    const copy = incomingCopy({ raider: 'SCOUT' });
    expect(copy?.eyebrow).toBe('Scout ship');
    expect(copy?.detail).toMatch(/look/);
    expect(copy?.prepare).toBe(false);
  });

  it('calls a raid a raid and asks for one', () => {
    const copy = incomingCopy({ raider: 'PIRATE' });
    expect(copy?.eyebrow).toBe('Pirate raid');
    expect(copy?.prepare).toBe(true);
  });

  it('has nothing to add for a contact the Telescope has not read', () => {
    expect(incomingCopy({})).toBeNull();
  });
});
