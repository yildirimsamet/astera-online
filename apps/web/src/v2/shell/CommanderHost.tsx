import { colonyCapacity } from '@astera/rules';
import { useLeaderboard, useSeason } from '../../api/queries.js';
import { useWorld } from '../../api/world.js';
import { useNow } from '../../lib/time.js';
import { CommanderCard, seasonDay } from '../hud/CommanderCard.js';
import type { CountryCode } from '@astera/rules';

/** A capital and every colony the game allows (D209). */
const MOST_WORLDS = 1 + colonyCapacity(Infinity);

/**
 * THE COMMANDER CARD, WIRED: the ladder's own "you" row for the place and the clan
 * (the leaderboard page reads the same row, so the two never disagree), the season
 * for the galaxy, the day and the shield, and the worlds this commander holds.
 */
export function CommanderHost({ name, country }: { name: string; country?: CountryCode }) {
  const now = useNow(60_000);
  const season = useSeason().data;
  const you = useLeaderboard().data?.you ?? null;
  const { worlds } = useWorld();

  return (
    <CommanderCard
      name={name}
      country={country ?? you?.country}
      clan={you?.clan ?? null}
      galaxy={season?.shardName ?? null}
      seasonDay={season?.status === 'live' ? seasonDay(season.startsAt.getTime(), now) : null}
      rank={you === null ? null : { place: you.rank, of: Math.max(you.rank, season?.players ?? 0) }}
      worlds={{ held: Math.max(1, worlds.length), max: MOST_WORLDS }}
      shield={season?.shieldUntil ? { until: season.shieldUntil.getTime(), kind: season.shieldKind ?? 'NEWCOMER' } : null}
      now={now}
    />
  );
}
