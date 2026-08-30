import { useTranslation } from 'react-i18next';

/**
 * WHERE A FLIGHT HAS GOT TO, AS A JOURNEY. Owner instruction.
 *
 * The flight roster was a title, a small grey line and a countdown, three times
 * over — and the two facts a commander wants from that list were nowhere on it:
 * which way a craft is pointing, and how far through the trip it is. "12m" is the
 * same string whether a fleet is two minutes from a target or two minutes from
 * home with the loot, and those are opposite situations.
 *
 * SO THE LEG IS DRAWN. A line between two ends, a marker on it, and the marker
 * points the way it is going. Home is the SOLID end and the far world is the ring:
 * an outbound craft leaves the solid end, a returning one runs back toward it, and
 * a player never has to read the word "return" to know which they are looking at.
 *
 * AN INBOUND ATTACK GETS A DIFFERENT PICTURE, AND THAT DIFFERENCE IS THE FOG
 * ITSELF (D123, D124). The server does not send a departure time for somebody
 * else's fleet — deliberately, since its origin is what Radar L5 sells — so there
 * is no honest position to draw. Rather than invent one, the track goes dashed
 * and the marker sits at the far end with no travelled portion behind it: the
 * shape says *something is coming and I cannot see where it is*, which is exactly
 * what the commander owns. A solid bar with a made-up marker would be the
 * interface claiming a reading the player has not bought.
 */
export function FlightBar({
  progress,
  direction,
  tone = 'crystal',
}: {
  /**
   * How far along, 0 to 1 — or null where the position is not knowable, which is
   * every craft that is not yours.
   */
  progress: number | null;
  /** `out` leaves home, `back` returns to it, `incoming` is aimed at you. */
  direction: 'out' | 'back' | 'incoming';
  tone?: 'crystal' | 'threat' | 'alloy';
}) {
  const { t } = useTranslation();
  const known = progress !== null;
  const along = known ? Math.max(0, Math.min(1, progress)) : 1;
  /*
    THE MARKER'S POSITION IS ALWAYS MEASURED FROM HOME, and only the arrow turns.
    A returning craft at 30% travelled is 70% of the way back to the solid end, so
    the head moves right to left; drawing it left to right would put a fleet
    carrying loot further from home the closer it got.
  */
  const at = direction === 'back' ? (1 - along) * 100 : along * 100;
  const colour = TONE[tone];

  return (
    <div
      data-flight-bar
      data-direction={direction}
      data-known={known ? 'true' : 'false'}
      className="relative flex h-4 w-full items-center"
      role="img"
      aria-label={t(
        direction === 'incoming'
          ? 'flightBar.incoming'
          : direction === 'back'
            ? 'flightBar.back'
            : 'flightBar.out',
      )}
    >
      {/* HOME. Filled, and always on the left, on every row in the list. */}
      <span className={`size-1.5 shrink-0 rounded-full ${colour.home}`} />

      <span className="relative mx-1 h-px flex-1">
        <span
          className={`absolute inset-0 ${known ? 'bg-line' : `border-t border-dashed ${colour.dashed}`}`}
        />
        {/*
          THE TRAVELLED PART, behind the marker, on the side it came from. It is
          what turns a dot on a line into a direction of travel while the row is
          standing still.
        */}
        {known && (
          <span
            className={`absolute inset-y-0 ${colour.track}`}
            style={
              direction === 'back'
                ? { left: `${String(at)}%`, right: '0%' }
                : { left: '0%', width: `${String(at)}%` }
            }
          />
        )}
        <span
          data-flight-mark
          aria-hidden
          className={`absolute top-1/2 size-0 -translate-y-1/2 border-y-[4px] border-y-transparent ${
            direction === 'back'
              ? `border-r-[6px] -translate-x-1/2 ${colour.markBack}`
              : `border-l-[6px] -translate-x-1/2 ${colour.mark}`
          }`}
          style={{ left: `${String(at)}%` }}
        />
      </span>

      {/* THE FAR WORLD. A ring, because it is somewhere you are not. */}
      <span className={`size-1.5 shrink-0 rounded-full border ${colour.far}`} />
    </div>
  );
}

const TONE = {
  crystal: {
    home: 'bg-crystal',
    far: 'border-crystal/50',
    track: 'bg-crystal/60',
    dashed: 'border-crystal/35',
    mark: 'border-l-crystal',
    markBack: 'border-r-crystal',
  },
  threat: {
    home: 'bg-threat',
    far: 'border-threat/50',
    track: 'bg-threat/60',
    dashed: 'border-threat/45',
    mark: 'border-l-threat',
    markBack: 'border-r-threat',
  },
  alloy: {
    home: 'bg-alloy',
    far: 'border-alloy/50',
    track: 'bg-alloy/60',
    dashed: 'border-alloy/35',
    mark: 'border-l-alloy',
    markBack: 'border-r-alloy',
  },
} as const;
