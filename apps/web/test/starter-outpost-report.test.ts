import { HULLS } from '@astera/rules';
import { beforeEach, describe, expect, it } from 'vitest';
import { vesselSchema } from '../src/api/starterSchemas.js';
import i18n from '../src/i18n/index.js';
import { orderMinutes } from '../src/lib/orderTime.js';
import { durationPrecise } from '../src/lib/time.js';
import { vesselToPlanetView } from '../src/starter/adapter.js';
import { outpostReportLines, type OutpostReportFacts } from '../src/starter/outpostReport.js';
import { wireVessel } from './starterVesselFixture.js';

/**
 * WHAT A RAID ON AN OUTPOST TAUGHT (plan §5.6 and its outcome branches, F4f). The report says why the
 * fight went as it did in the counter cycle's words, what the lost ships cost to build again, that the
 * first win's crate is waiting, and who took the guard when another ship got there first.
 */
const view = vesselToPlanetView(vesselSchema.parse(wireVessel({ modules: { REFINERY: 3, EXTRACTOR: 2, SURVEY: 1, VAULT: 1, SHIPYARD: 1 } })));
const raid = (over: Partial<OutpostReportFacts> = {}): OutpostReportFacts => ({
  attacking: true, opponentKind: 'OUTPOST', yourFleet: { DART: 2 }, theirFleet: { WARDEN: 2 }, yourLosses: {}, ...over,
});
const lines = (facts: OutpostReportFacts) => outpostReportLines(facts, i18n.t, view);
const text = (facts: OutpostReportFacts, key: string) => lines(facts).find(line => line.key === key)?.text;

beforeEach(async () => { await i18n.changeLanguage('en'); });

describe('why the raid went as it did', () => {
  it('names the ships that had the edge, and by how much', () => {
    expect(text(raid({ yourFleet: { PIKE: 2 }, theirFleet: { DART: 2 } }), 'why')).toBe('Your Pike outclassed the Skirmisher guard (×1.6).');
  });

  it('names a bad matchup, and the ship that answers that guard', () => {
    expect(text(raid({ yourFleet: { DART: 2 }, theirFleet: { PIKE: 3 } }), 'why')).toBe('Your Dart were outclassed by the Lance guard (×0.625). Against it, send Warden.');
  });

  it('says an even matchup was settled by numbers and strength', () => {
    expect(text(raid({ theirFleet: { DART: 3 } }), 'why')).toBe('Your Dart and the Skirmisher guard were even (×1): numbers and strength decided it. Pike has the edge on it.');
  });

  // A mixed wing is judged by its biggest part; between equal parts, by the one that had the edge.
  it('reads a mixed wing by its biggest part, and a tie by the part with the edge', () => {
    expect(text(raid({ yourFleet: { DART: 3, PIKE: 1 }, theirFleet: { DART: 2 } }), 'why')).toMatch(/^Your Dart and/);
    expect(text(raid({ yourFleet: { DART: 2, PIKE: 2 }, theirFleet: { DART: 2 } }), 'why')).toMatch(/^Your Pike outclassed/);
  });

  it('says nothing when there was no guard to fight, or the wing had no guns', () => {
    expect(text(raid({ theirFleet: {} }), 'why')).toBeUndefined();
    expect(text(raid({ yourFleet: { COURIER: 2 } }), 'why')).toBeUndefined();
  });
});

describe('what the loss costs', () => {
  it('prices the lost ships at the yard, with the time, and says the progress stands', () => {
    const line = text(raid({ yourLosses: { DART: 2 } }), 'rebuild');
    const time = durationPrecise(orderMinutes('HULL', HULLS.DART, view, 2, { hull: 'DART' }));
    expect(line).toBe(`Lost 2 Dart: building them again costs ${String(HULLS.DART.alloy * 2)} alloy, ${String(HULLS.DART.crystal * 2)} crystal and ${time}. Your progress stands.`);
  });

  it('says nothing of a rebuild when nothing was lost', () => {
    expect(text(raid(), 'rebuild')).toBeUndefined();
  });
});

describe('the outcome branches', () => {
  it('tells the first win that its crate is waiting at the yard', () => {
    expect(text(raid({ firstVictory: true }), 'victoryCrate')).toMatch(/crate/i);
    expect(text(raid(), 'victoryCrate')).toBeUndefined();
  });

  it('names the ship that took the guard first', () => {
    expect(text(raid({ theirFleet: {}, beatenBy: 'Early' }), 'beaten')).toMatch(/Early/);
  });

  it('puts who got there first ahead of everything, since it explains the rest', () => {
    expect(lines(raid({ theirFleet: {}, beatenBy: 'Early', yourLosses: { DART: 1 } }))[0]?.key).toBe('beaten');
  });

  it('is said only to the side that came', () => {
    expect(lines(raid({ attacking: false, yourLosses: { DART: 2 } }))).toEqual([]);
  });
});
