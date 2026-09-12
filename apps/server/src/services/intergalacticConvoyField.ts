import { createHmac } from 'node:crypto';
import {
  intergalacticConvoyPosition,
  intergalacticConvoySpec,
  type IntergalacticConvoySpec,
  type PlannedGalaxyEvent,
} from '@astera/rules';

type PlannedConvoy = Extract<PlannedGalaxyEvent, { kind: 'INTERGALACTIC_CONVOY' }>;

/** V1 consumes two uint32 draws from this one frozen, domain-separated digest. */
function routeRng(key: string, occurrence: PlannedConvoy): () => number {
  const digest = createHmac('sha256', key)
    .update(`intergalactic-convoy:route:v1:${String(occurrence.sequence)}`)
    .digest();
  let draw = 0;
  return () => {
    if (draw >= digest.length / 4) {
      throw new RangeError('convoy route v1 exhausted its frozen random digest');
    }
    const value = digest.readUInt32BE(draw * 4) / 0x1_0000_0000;
    draw += 1;
    return value;
  };
}

const specCache = new Map<string, IntergalacticConvoySpec>();
const CACHE_MAX = 64;

function trim(): void {
  while (specCache.size > CACHE_MAX) {
    const oldest = specCache.keys().next().value;
    if (oldest === undefined) return;
    specCache.delete(oldest);
  }
}

/** Secret plus the complete immutable occurrence snapshot; never logged or serialised. */
const cacheKeyOf = (key: string, occurrence: PlannedConvoy): string => [
  key,
  occurrence.sequence,
  occurrence.startsAtMinute,
  occurrence.endsAtMinute,
  occurrence.definitionVersion,
  occurrence.effect.routeVersion,
].join(':');

/** The route one persisted occurrence describes, memoised LRU-64. */
export function intergalacticConvoyOf(
  key: string,
  occurrence: PlannedConvoy,
): IntergalacticConvoySpec {
  const cacheKey = cacheKeyOf(key, occurrence);
  const cached = specCache.get(cacheKey);
  if (cached !== undefined) {
    specCache.delete(cacheKey);
    specCache.set(cacheKey, cached);
    return cached;
  }
  const spec = intergalacticConvoySpec(occurrence, routeRng(key, occurrence));
  specCache.set(cacheKey, spec);
  trim();
  return spec;
}

/** Half-open active lookup. Future routes are never derived by this surface. */
export function activeIntergalacticConvoy(
  key: string,
  occurrences: readonly PlannedGalaxyEvent[],
  minute: number,
): IntergalacticConvoySpec | null {
  for (const occurrence of occurrences) {
    if (occurrence.kind !== 'INTERGALACTIC_CONVOY') continue;
    if (minute < occurrence.startsAtMinute || minute >= occurrence.endsAtMinute) continue;
    return intergalacticConvoyOf(key, occurrence);
  }
  return null;
}

export { intergalacticConvoyPosition };
