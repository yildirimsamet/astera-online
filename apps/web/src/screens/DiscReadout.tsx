import { useTranslation } from 'react-i18next';

/**
 * THE CAPTION ON THE MAP, CUT BACK TO WHAT IT IS FOR. Owner instruction.
 *
 * It used to open with the word "disc" and then name the galaxy twice —
 * "The disc · Vantage (EU-1)". None of that is read more than once a session: the
 * player knows they are looking at a disc because they are looking at it, and the
 * galaxy's poetic name is decoration next to the code that actually identifies it.
 * Three words gone, and the room they were taking is spent on a figure that
 * changes.
 *
 * THE ROOM BUYS A SECOND POPULATION READING. `online` is who is at the controls
 * right now, over `SERVERS.onlineWindowMinutes`; `onlineToday` is how many
 * distinct commanders have been in this galaxy since a day ago. The live figure
 * alone is honest and small — five people on a screen at 4am reads as a dead
 * galaxy — and the day figure is the one that says whether the place is inhabited.
 * Both are already public on `/api/servers`, so neither leaks anything.
 *
 * OPTIONAL, NOT ZEROED, for both: they are optional on the payload so a client one
 * deploy ahead of its server still parses, and printing "0" for an absent figure
 * is a lie about a galaxy the reader is personally standing in.
 */
export function DiscReadout({
  shard,
  online,
  onlineToday,
  children,
}: {
  shard: string;
  online?: number;
  /** Distinct commanders seen in this galaxy over the last day. */
  onlineToday?: number;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <div className="pointer-events-auto plate plate-inset max-w-[calc(100vw-1.5rem)] px-2 py-1">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <p className="legend min-w-0 truncate text-micro tracking-label">{shard}</p>
        {online !== undefined ? (
          <p
            data-population
            className="flex shrink-0 items-center gap-1.5 text-micro leading-none text-dim"
          >
            <span className="size-1 rounded-full bg-opportunity" aria-hidden="true" />
            <span>{t('galaxy.online', { count: online })}</span>
            {onlineToday !== undefined && (
              <span className="text-faint">{t('galaxy.onlineToday', { count: onlineToday })}</span>
            )}
          </p>
        ) : null}
      </div>
      <p className="num mt-1 truncate text-micro leading-tight text-bone">{children}</p>
    </div>
  );
}
