import { asteroidActive, asteroidPosition, generateGalaxy } from '../packages/rules/src/galaxy.js';
import { sensorReach } from '../packages/rules/src/intel.js';
import type { AsteroidSpec } from '../packages/rules/src/galaxy.js';

/** Twenty unrelated, repeatable fields: 4,000 world positions in every comparison. */
const SEEDS = Array.from(
  { length: 20 },
  (_, index) => (0x12345678 + Math.imul(index, 0x9e3779b9)) >>> 0,
);
const LEVELS = [0, 2, 3, 4, 5] as const;
const WORLD_COUNT = 200;

interface Candidate {
  name: string;
  exponent: number;
  minimum: number;
  maximum: number;
}

const candidates: Candidate[] = [
  { name: 'linear-r1900', exponent: 1, minimum: 400, maximum: 1900 },
  { name: 'linear-r2000', exponent: 1, minimum: 400, maximum: 2000 },
  { name: 'q1.5-r2000', exponent: 1.5, minimum: 400, maximum: 2000 },
  { name: 'q2-r2000', exponent: 2, minimum: 400, maximum: 2000 },
  { name: 'q2.5-r2000', exponent: 2.5, minimum: 400, maximum: 2000 },
  { name: 'q3-r2000', exponent: 3, minimum: 400, maximum: 2000 },
  { name: 'q3.8-r1950', exponent: 3.8, minimum: 200, maximum: 1950 },
  { name: 'q4-r1950', exponent: 4, minimum: 200, maximum: 1950 },
  { name: 'q4.2-r1950', exponent: 4.2, minimum: 200, maximum: 1950 },
  { name: 'q3.8-r2000', exponent: 3.8, minimum: 200, maximum: 2000 },
  { name: 'q4-r2000', exponent: 4, minimum: 200, maximum: 2000 },
  { name: 'q4-min400-r2000', exponent: 4, minimum: 400, maximum: 2000 },
  { name: 'q4.2-r2000', exponent: 4.2, minimum: 200, maximum: 2000 },
];

const selected: Candidate = {
  name: 'q4-min400-r2000',
  exponent: 4,
  minimum: 400,
  maximum: 2000,
};

function quantile(values: readonly number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * p)] ?? 0;
}

function remap(asteroid: AsteroidSpec, candidate: Candidate): AsteroidSpec {
  // Recover the selected generator's uniform draw so every candidate is compared
  // against the exact same schedule, level, speed, plane and lifetime.
  const roll = (asteroid.radius ** 4 - 400 ** 4) / (2_000 ** 4 - 400 ** 4);
  const radius = Math.pow(
    candidate.minimum ** candidate.exponent
      + roll * (
        candidate.maximum ** candidate.exponent - candidate.minimum ** candidate.exponent
      ),
    1 / candidate.exponent,
  );
  return { ...asteroid, radius, period: (2 * Math.PI * radius) / asteroid.speed };
}

function concise(value: number): string {
  return value.toFixed(2);
}

interface OrbitContact {
  kind: 'none' | 'partial' | 'full';
  /** Minutes spent inside the sensor on each revolution. */
  dwellMinutes: number;
  centerAngle: number;
  halfAngle: number;
}

function orbitContact(
  asteroid: AsteroidSpec,
  world: { x: number; y: number; z: number },
  reach: number,
): OrbitContact {
  const cosNode = Math.cos(asteroid.ascendingNode);
  const sinNode = Math.sin(asteroid.ascendingNode);
  const cosInclination = Math.cos(asteroid.inclination);
  const sinInclination = Math.sin(asteroid.inclination);
  const alongCos = world.x * cosNode + world.z * sinNode;
  const alongSin =
    world.x * -sinNode * cosInclination
    + world.y * sinInclination
    + world.z * cosNode * cosInclination;
  const projection = Math.hypot(alongCos, alongSin);
  const constant =
    world.x ** 2 + world.y ** 2 + world.z ** 2 + asteroid.radius ** 2;
  const amplitude = 2 * asteroid.radius * projection;

  if (amplitude < 1e-9) {
    return constant <= reach ** 2
      ? { kind: 'full', dwellMinutes: asteroid.period, centerAngle: 0, halfAngle: Math.PI }
      : { kind: 'none', dwellMinutes: 0, centerAngle: 0, halfAngle: 0 };
  }

  const threshold = (constant - reach ** 2) / amplitude;
  if (threshold > 1) return { kind: 'none', dwellMinutes: 0, centerAngle: 0, halfAngle: 0 };
  if (threshold <= -1) {
    return { kind: 'full', dwellMinutes: asteroid.period, centerAngle: 0, halfAngle: Math.PI };
  }
  const halfAngle = Math.acos(threshold);
  return {
    kind: 'partial',
    dwellMinutes: (halfAngle / Math.PI) * asteroid.period,
    centerAngle: Math.atan2(alongSin, alongCos),
    halfAngle,
  };
}

function visibleDuring(
  asteroid: AsteroidSpec,
  contact: OrbitContact,
  start: number,
  end: number,
): boolean {
  const clippedStart = Math.max(start, asteroid.appearsAt);
  const clippedEnd = Math.min(end, asteroid.expiresAt);
  if (clippedEnd <= clippedStart || contact.kind === 'none') return false;
  if (contact.kind === 'full') return true;

  const angularSpeed = (2 * Math.PI) / asteroid.period;
  const halfWindow = contact.halfAngle / angularSpeed;
  const baseCenter = (contact.centerAngle - asteroid.phase) / angularSpeed;
  const cycle = Math.ceil((clippedStart - halfWindow - baseCenter) / asteroid.period);
  const center = baseCenter + cycle * asteroid.period;
  return center - halfWindow <= clippedEnd && center + halfWindow >= clippedStart;
}

function detailedStudy(): void {
  const dwell = new Map<number, number[]>(LEVELS.map((level) => [level, []]));
  const entriesPerHour = new Map<number, number[]>(LEVELS.map((level) => [level, []]));
  const opportunities = new Map<number, number[]>(LEVELS.map((level) => [level, []]));
  const richOpportunities = new Map<number, number[]>(LEVELS.map((level) => [level, []]));
  const dailyOpportunities = new Map<number, number[]>(LEVELS.map((level) => [level, []]));
  const dailyRichOpportunities = new Map<number, number[]>(LEVELS.map((level) => [level, []]));
  const studyStart = 2 * 1440;
  const studyEnd = 8 * 1440;
  const studyHours = (studyEnd - studyStart) / 60;

  for (const seed of SEEDS) {
    const galaxy = generateGalaxy(seed, WORLD_COUNT);
    const asteroids = galaxy.asteroids.map((asteroid) => remap(asteroid, selected));
    const inWindow = asteroids.filter(
      (asteroid) => asteroid.expiresAt > studyStart && asteroid.appearsAt < studyEnd,
    );

    for (const world of galaxy.slots) {
      for (const level of LEVELS) {
        const reach = sensorReach(level);
        let entryCount = 0;
        let uniqueCount = 0;
        let uniqueRich = 0;
        const contacts: { asteroid: AsteroidSpec; contact: OrbitContact }[] = [];

        for (const asteroid of inWindow) {
          const contact = orbitContact(asteroid, world, reach);
          if (contact.kind === 'none') continue;
          contacts.push({ asteroid, contact });
          uniqueCount++;
          if (asteroid.isotopeRich) uniqueRich++;

          const activeStart = Math.max(studyStart, asteroid.appearsAt);
          const activeEnd = Math.min(studyEnd, asteroid.expiresAt);
          const activeMinutes = Math.max(0, activeEnd - activeStart);
          if (contact.kind === 'full') {
            entryCount++;
            dwell.get(level)!.push(activeMinutes);
          } else {
            entryCount += activeMinutes / asteroid.period;
            dwell.get(level)!.push(contact.dwellMinutes);
          }
        }

        entriesPerHour.get(level)!.push(entryCount / studyHours);
        opportunities.get(level)!.push(uniqueCount);
        richOpportunities.get(level)!.push(uniqueRich);

        // Six representative 8-hour sessions (09:00-17:00), one on each study day.
        for (let day = 2; day < 8; day++) {
          const sessionStart = day * 1440 + 9 * 60;
          const sessionEnd = sessionStart + 8 * 60;
          let daily = 0;
          let dailyRich = 0;
          for (const { asteroid, contact } of contacts) {
            // A Telescope remembers a contact for the rest of that rock's life.
            // Therefore a rock found before login is still an opportunity if it
            // remains active during the session; it need not cross the sphere again.
            if (asteroid.expiresAt <= sessionStart) continue;
            if (!visibleDuring(asteroid, contact, asteroid.appearsAt, sessionEnd)) continue;
            daily++;
            if (asteroid.isotopeRich) dailyRich++;
          }
          dailyOpportunities.get(level)!.push(daily);
          dailyRichOpportunities.get(level)!.push(dailyRich);
        }
      }
    }
  }

  console.log(`\nselected ${selected.name}: exact orbit intersection over days 2-8`);
  for (const level of LEVELS) {
    const durations = dwell.get(level)!;
    const entryRates = entriesPerHour.get(level)!;
    const unique = opportunities.get(level)!;
    const rich = richOpportunities.get(level)!;
    const daily = dailyOpportunities.get(level)!;
    const dailyRich = dailyRichOpportunities.get(level)!;
    console.log(
      `L${level}: dwell sec p10/50/90 ${concise(quantile(durations, 0.1) * 60)}`
      + `/${concise(quantile(durations, 0.5) * 60)}`
      + `/${concise(quantile(durations, 0.9) * 60)}`
      + `; entries/player-hour ${concise(quantile(entryRates, 0.1))}`
      + `/${concise(quantile(entryRates, 0.5))}`
      + `/${concise(quantile(entryRates, 0.9))}`
      + `; unique rocks ${concise(quantile(unique, 0.1))}`
      + `/${concise(quantile(unique, 0.5))}`
      + `/${concise(quantile(unique, 0.9))}`
      + `; rich ${concise(quantile(rich, 0.1))}`
      + `/${concise(quantile(rich, 0.5))}`
      + `/${concise(quantile(rich, 0.9))}`
      + `; per 8h session ${concise(quantile(daily, 0.1))}`
      + `/${concise(quantile(daily, 0.5))}`
      + `/${concise(quantile(daily, 0.9))}`
      + ` (rich ${concise(quantile(dailyRich, 0.1))}`
      + `/${concise(quantile(dailyRich, 0.5))}`
      + `/${concise(quantile(dailyRich, 0.9))})`,
    );
  }
}

function compareCandidates(): void {
  console.log('candidate fairness (p10 / median / p90, then p90:p10)');
  for (const candidate of candidates) {
    const worldMeans = new Map<number, number[]>(LEVELS.map((level) => [level, []]));

    for (const seed of SEEDS) {
      const galaxy = generateGalaxy(seed, WORLD_COUNT);
      const asteroids = galaxy.asteroids.map((asteroid) => remap(asteroid, candidate));
      const sums = LEVELS.map(() => new Float64Array(WORLD_COUNT));
      let samples = 0;

      for (let minutes = 360; minutes <= 3240; minutes += 30) {
        const positions = asteroids
          .filter((asteroid) => asteroidActive(asteroid, minutes))
          .map((asteroid) => asteroidPosition(asteroid, minutes));
        samples++;

        for (let worldIndex = 0; worldIndex < WORLD_COUNT; worldIndex++) {
          const world = galaxy.slots[worldIndex]!;
          for (const position of positions) {
            const distance = Math.hypot(
              position.x - world.x,
              position.y - world.y,
              position.z - world.z,
            );
            for (let levelIndex = 0; levelIndex < LEVELS.length; levelIndex++) {
              if (distance <= sensorReach(LEVELS[levelIndex]!)) sums[levelIndex]![worldIndex]!++;
            }
          }
        }
      }

      for (let levelIndex = 0; levelIndex < LEVELS.length; levelIndex++) {
        const means = worldMeans.get(LEVELS[levelIndex]!)!;
        for (const sum of sums[levelIndex]!) means.push(sum / samples);
      }
    }

    const summary = LEVELS.map((level) => {
      const values = worldMeans.get(level)!;
      const p10 = quantile(values, 0.1);
      const median = quantile(values, 0.5);
      const p90 = quantile(values, 0.9);
      return `L${level} ${concise(p10)}/${concise(median)}/${concise(p90)} x${concise(p90 / p10)}`;
    });
    console.log(`${candidate.name}: ${summary.join(' | ')}`);
  }
}

compareCandidates();
detailedStudy();
