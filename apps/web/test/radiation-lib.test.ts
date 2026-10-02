import { describe, expect, it } from 'vitest';
import { pendingSchema } from '../src/api/schemas.js';
import { drawnClouds, hazeAlpha, radiationAt, routeRadiation, toRadiationSources } from '../src/lib/radiation.js';

/**
 * RADIATION ON THE CLIENT: THE SAME DOSE THE SERVER SETTLES. `plan.md` F10.
 *
 * The launch sheet quotes a route's dose before the commitment and a world's focus sheet
 * states the cloud it stands in — with the rules package's dose functions, fed the
 * galaxy's clouds, so the quote is the settlement.
 */

const MIN = 60_000;
const at = (x: number) => ({ x, y: 0, z: 0 });
const cloud = (over: Partial<{ intensityPctPerMinute: number; activeUntil: Date | null; mode: 'EMIT' | 'SHELTER' }> = {}) => ({
  id: 'c1', mode: 'EMIT' as const, center: at(0), radius: 1_000, intensityPctPerMinute: 1,
  activeFrom: new Date(0), activeUntil: null, ...over,
});

describe('the clouds from the galaxy', () => {
  it('read as the rules package\'s sources', () => {
    expect(toRadiationSources([cloud({ activeUntil: new Date(5 * MIN) })])).toEqual([{
      id: 'c1', mode: 'EMIT', center: at(0), radius: 1_000, intensityPctPerMinute: 1,
      activeFromMs: 0, activeUntilMs: 5 * MIN,
    }]);
  });
});

describe('a route\'s dose, quoted before the launch', () => {
  const route = { from: at(-50), to: at(50), departMs: 0, arriveMs: 30 * MIN };

  it('is nothing where no cloud stands', () => {
    expect(routeRadiation({ ...route, fleet: { DART: 3 } }, [])).toBeNull();
    expect(routeRadiation({ ...route, fleet: { DART: 3 } }, toRadiationSources([cloud({ intensityPctPerMinute: 0 })])))
      .toBeNull();
  });

  it('is the share of a full hull each ship takes, and whether it will need the dock', () => {
    // Thirty minutes at 1%/min: 30%, over the Repair Station's line.
    expect(routeRadiation({ ...route, fleet: { DART: 3 } }, toRadiationSources([cloud()])))
      .toEqual({ doseBp: 3000, pct: 30, docks: true, destroyed: 0 });
    expect(routeRadiation({ ...route, fleet: { DART: 3 } }, toRadiationSources([cloud({ intensityPctPerMinute: 0.5 })])))
      .toEqual({ doseBp: 1500, pct: 15, docks: false, destroyed: 0 });
  });

  /**
   * ON THE RIGHT SIDE OF BOTH LINES (`damagePct`). A dose a hair over 20% docks the ships,
   * so it must not read "20%" — the figure the patched case reads; a dose a hair under a
   * full hull leaves them alive, so it must not read "100%" — the figure of the lethal case.
   */
  it('never reads a docking dose at the free line, nor a survivable one as lethal', () => {
    const over = routeRadiation({ ...route, fleet: { DART: 3 } }, toRadiationSources([cloud({ intensityPctPerMinute: 0.667 })]));
    expect(over).toMatchObject({ docks: true, destroyed: 0 });
    expect(over!.doseBp).toBeLessThan(2050);
    expect(over!.pct).toBe(21);
    const near = routeRadiation({ ...route, fleet: { DART: 3 } }, toRadiationSources([cloud({ intensityPctPerMinute: 3.3317 })]));
    expect(near).toMatchObject({ docks: true, destroyed: 0 });
    expect(near!.doseBp).toBeGreaterThanOrEqual(9950);
    expect(near!.pct).toBe(99);
  });

  it('names how many ships it would finish', () => {
    expect(routeRadiation({ ...route, fleet: { DART: 3, COURIER: 2 } }, toRadiationSources([cloud({ intensityPctPerMinute: 5 })])))
      .toMatchObject({ destroyed: 5 });
  });
});

describe('the cloud a world stands in', () => {
  const now = 10 * MIN;

  it('is nothing outside every cloud, or where a cloud is not lit', () => {
    expect(radiationAt(at(5_000), toRadiationSources([cloud()]), now)).toBeNull();
    expect(radiationAt(at(0), toRadiationSources([cloud({ activeUntil: new Date(5 * MIN) })]), now)).toBeNull();
  });

  it('is every cloud over it added, in a share of a hull per minute', () => {
    expect(radiationAt(at(0), toRadiationSources([cloud(), { ...cloud({ intensityPctPerMinute: 0.5 }), id: 'c2' }]), now))
      .toEqual({ pctPerMinute: 1.5, sheltered: false });
  });

  it('is sheltered under a shelter, and a shelter alone is nothing to say', () => {
    const shelter = { ...cloud({ mode: 'SHELTER', intensityPctPerMinute: 0 }), id: 's1', radius: 10 };
    expect(radiationAt(at(0), toRadiationSources([cloud(), shelter]), now)).toEqual({ pctPerMinute: 1, sheltered: true });
    expect(radiationAt(at(0), toRadiationSources([shelter]), now)).toBeNull();
  });
});

describe('the moment the server says a cloud finishes the commander\'s own wing (D15)', () => {
  it('rides the flight, and is absent on one that lands', () => {
    const flight = {
      kind: 'fleet', targetName: 'Kestrel', minutesRemaining: 30, arriveAt: '2026-09-30T12:30:00.000Z',
    };
    const [doomed, safe] = pendingSchema.parse({
      pending: [{ ...flight, fadeAt: '2026-09-30T12:20:00.000Z' }, flight],
    }).pending;
    expect(doomed?.fadeAt).toEqual(new Date('2026-09-30T12:20:00.000Z'));
    expect(safe?.fadeAt).toBeUndefined();
  });
});

describe('the haze on the disc', () => {
  it('grows with the dose a minute, and never hides the worlds behind it', () => {
    const alphas = [0, 0.1, 0.5, 1, 3, 10, 100].map(hazeAlpha);
    for (let i = 1; i < alphas.length; i++) expect(alphas[i]).toBeGreaterThanOrEqual(alphas[i - 1]!);
    expect(Math.min(...alphas)).toBeGreaterThan(0);
    expect(Math.max(...alphas)).toBeLessThanOrEqual(0.22);
  });

  it('draws only clouds lit now; a shelter is not a cloud', () => {
    const now = 10 * MIN;
    const views = [
      cloud(),
      { ...cloud({ activeUntil: new Date(5 * MIN) }), id: 'ended' },
      { ...cloud(), id: 'later', activeFrom: new Date(20 * MIN) },
      { ...cloud({ mode: 'SHELTER', intensityPctPerMinute: 0 }), id: 'haven' },
    ];
    expect(drawnClouds(views, now).map((view) => view.id)).toEqual(['c1']);
  });
});
