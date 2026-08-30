/**
 * A SMALL COUNT AGAINST A SMALL CEILING, COUNTED FOR THE PLAYER. Owner
 * instruction, and the fourth member of D142's vocabulary.
 *
 * `Rungs` is a LADDER — rungs bought one at a time, where the next one is a
 * decision. This is a RACK: a fixed number of identical places, some occupied.
 * Flight bays, orbit slots, telescope slots, clan seats, queue slots and a
 * world's two Prospector berths are all the same fact, and the game was stating
 * it six different ways — "2 / 4", "2 of 4", "two used", a sentence, and in two
 * places nothing at all.
 *
 * WHY NOT A BAR: these ceilings are three, four, five. The eye counts groups that
 * small without being asked — the reason dice have pips — and a bar at 50% cannot
 * say whether one of two or three of six is gone, which is the entire question
 * when the next launch needs a free bay.
 *
 * `interface.md` I6b: A RACK SHOWS ITS ROOM. Empty places are always drawn, never
 * omitted, because the empty ones are what the player is shopping for.
 */
export function Tally({
  used,
  total,
  label,
  tone = 'crystal',
  size = 'md',
}: {
  used: number;
  total: number;
  /** Said in full for a screen reader, which cannot see four pips. */
  label: string;
  tone?: 'crystal' | 'alloy' | 'threat' | 'bone';
  size?: 'sm' | 'md';
}) {
  if (total <= 0) return null;
  const filled = Math.max(0, Math.min(total, Math.round(used)));
  const shape = size === 'sm' ? 'h-2 w-[4px]' : 'h-2.5 w-[5px]';

  return (
    <span
      data-tally
      data-used={filled}
      data-total={total}
      className="inline-flex shrink-0 items-center gap-[3px]"
      role="img"
      aria-label={label}
    >
      {Array.from({ length: total }, (_unused, index) => (
        <span
          key={index}
          aria-hidden
          data-cell={index < filled ? 'used' : 'free'}
          className={`${shape} rounded-cell ${index < filled ? FILL[tone] : 'bg-line'}`}
        />
      ))}
    </span>
  );
}

const FILL: Record<'crystal' | 'alloy' | 'threat' | 'bone', string> = {
  crystal: 'bg-crystal shadow-[0_0_5px_var(--color-crystal-glow)]',
  alloy: 'bg-alloy shadow-[0_0_5px_var(--color-alloy-glow)]',
  threat: 'bg-threat shadow-[0_0_5px_var(--color-threat-glow)]',
  bone: 'bg-bone/70',
};
