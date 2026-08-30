import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { compact } from '../lib/format.js';

/**
 * HOW MUCH ROOM IS LEFT, AS A PICTURE RATHER THAN AS A SENTENCE. Owner instruction.
 *
 * The build sheet already held every number this needs and spent them on one line
 * of small grey text — "takes 12 · 40 / 200 used". The owner could not tell what
 * their capacity was, what one ship cost, or how many more they could build: three
 * questions the sentence technically answers and none it answers at a glance.
 *
 * IT DRAWS TWO DIFFERENT CARDS, AND CONFLATING THEM WAS A REAL BUG. Owner report
 * against the Fleet and Defend tabs: *"bu iki bardan alttaki ne işe yarıyor ve
 * ortadaki beyaz çizgi gibi gözüken şey ne?"*
 *
 *   · A ROOM (`fits` omitted) — the Hangar band, the ground battery band, a
 *     transfer's destination. Nobody is choosing a hull here, so the questions are
 *     "how big is this world's deck" and "how much of it is spoken for". It gets
 *     the bar and the two figures at the ends of it. NO SHIP BLOCK: there is no
 *     ship to measure, and one drawn anyway is a second bar with no stated job,
 *     which is exactly how it was reported.
 *   · A PURCHASE (`fits` given) — the craft sheet, where a hull IS being chosen.
 *     It adds the two things only that surface can say: how many more of THIS ONE
 *     fit, and how much of the deck one of them eats.
 *
 * AND THE FIGURE HAD TO MEAN THE SAME THING ON BOTH BANDS. The Hangar card passed
 * `hangarTotal - hangarUsed`, which is SPACE, under the words "more fit" — so a
 * commander with 185 units of deck free read "185 more fit" and reasonably believed
 * they could build a hundred and eighty-five ships. The ground band beside it
 * passed a real Thorn count into the same slot. One label, two units. `fits` is now
 * only ever a count of a named hull, and a room states its space as space.
 *
 * NEARLY NO TEXT, AND NONE OF IT LOAD-BEARING. Every word here is a caption on a
 * shape that has already made the point; a player who reads none of them still
 * knows whether the thing they want fits.
 */
export function CapacityBar({
  total,
  used,
  incoming,
  bulk,
  fits,
  icon,
  label,
}: {
  /** The ceiling: a Hangar's room, or the Core's ground slots. */
  total: number;
  /** Committed already — standing craft plus whatever the yard queue will land. */
  used: number;
  /** What the order currently on screen would add. Zero on a room card. */
  incoming: number;
  /**
   * What ONE of this hull takes, which is what the block under the bar draws.
   * Omitted on a room card, where there is no hull to measure.
   */
  bulk?: number;
  /**
   * How many more of that hull fit — a COUNT OF SHIPS, never a quantity of space.
   * Its presence is what turns this into a purchase card.
   */
  fits?: number;
  /** The hull's own render, so the number is attached to the thing it counts. */
  icon?: ReactNode;
  /** Names the room where the surface does not already: "destination hangar". */
  label?: string;
}) {
  const { t } = useTranslation();
  const room = Math.max(1, total);
  const share = (value: number): number => Math.max(0, Math.min(100, (value / room) * 100));
  const usedShare = share(used);
  // Clamped against what is left rather than against the whole, so a bar can never
  // draw past its own end even while the stepper is mid-press.
  const incomingShare = Math.min(share(incoming), 100 - usedShare);
  const freeShare = Math.max(0, 100 - usedShare - incomingShare);
  /*
    A SINGLE SHIP HAS A FLOOR. One Wasp in a Hangar 10 is 0.06% of the bar — a
    segment with no width is not a smaller explanation, it is no explanation. The
    floor is small enough to stay honest against its neighbours and wide enough to
    be a thing on screen.
  */
  const oneShare = Math.max(0.8, share(bulk ?? 0));
  const shopping = fits !== undefined;
  /*
    A ROOM IS FULL WHEN THE BAR IS; A PURCHASE IS FULL WHEN NONE OF THE CHOSEN HULL
    FITS. Different questions — a Hangar with room for a Wasp but not a Bulwark has
    to answer them differently.
  */
  const full = shopping ? fits <= 0 : used + incoming >= total;
  const free = Math.max(0, total - used - incoming);

  return (
    <div className="plate flex flex-col gap-2.5 p-3">
      <div className="flex items-center gap-3">
        {icon}
        <p className="flex min-w-0 flex-1 items-baseline gap-2">
          {shopping ? (
            /*
              THE ANSWER, AT READOUT SIZE, and it is the question somebody opens the
              sheet holding. Everything else on this card is the working behind it.
            */
            <>
              <span data-fits className="readout text-figure text-bone">{compact(Math.max(0, fits))}</span>
              <span className="text-caption text-faint">{t('capacity.fit')}</span>
            </>
          ) : (
            label !== undefined && <span className="legend truncate">{label}</span>
          )}
        </p>
        {full && (
          <span data-full className="legend text-alloy">{t('capacity.full')}</span>
        )}
      </div>

      {/*
        THE BAR. `socket` is the inset the design system already uses for a well
        something sits inside, which is what a capacity is — and the extra height
        over the original 12px is what lets the three parts read as material in a
        recess rather than as a hairline chart.
      */}
      <div
        className="socket flex h-3.5 w-full justify-items-start overflow-hidden rounded-full"
        role="img"
        aria-label={t('capacity.reading', {
          used: Math.round(used + incoming),
          total: Math.round(total),
        })}
      >
        <span
          data-part="used"
          className="h-full bg-gradient-to-b from-bone/55 to-bone/35"
          style={{ width: `${String(usedShare)}%` }}
        />
        {/*
          The order is the brightest thing on the card because it is the only part
          the player is deciding, and it carries the leading-edge glow `Meter` uses
          for the same reason: energy arriving rather than paint already applied.
          Crystal is this interface's colour for "the thing you are doing now".
        */}
        <span
          data-part="incoming"
          className="h-full bg-crystal shadow-[0_0_8px_var(--color-crystal-glow)] transition-[width] duration-200"
          style={{ width: `${String(incomingShare)}%` }}
        />
        <span data-part="free" className="h-full" style={{ width: `${String(freeShare)}%` }} />
      </div>

      {/*
        THE TWO ENDS OF THE BAR, LABELLED AT THE ENDS THEY DESCRIBE.

        A room card used to carry no figures at all — a bar and a heading — so "how
        much is actually left" was a proportion to estimate off a shape. Left is
        what is spoken for, right is what is free, each under its own part of the
        bar, and FREE is the brighter of the two because it is the one being
        shopped for. It is stated as SPACE, which is the unit a deck is measured in.
      */}
      {!shopping && (
        <div className="flex items-baseline justify-between gap-3">
          <span className="num text-micro text-faint">
            {compact(Math.round(used + incoming))}
            <span className="ml-1">{t('capacity.used')}</span>
          </span>
          <span className={`num text-caption ${full ? 'text-alloy' : 'text-bone'}`}>
            {compact(free)}
            <span className="ml-1 text-faint">{t('capacity.free')}</span>
          </span>
        </div>
      )}

      {/*
        ONE SHIP, AT THE WIDTH IT TAKES — AND IT STARTS WHERE THE BAR ABOVE STARTS.
        Owner report: *"ortadaki beyaz çizgi gibi gözüken şey ne?"*

        `.socket` is `display: grid; place-items: center` (chrome.css) and this well
        carried no display utility to override it, so the block measuring one hull
        was CENTRED in its own track — a floating tick mark under an unexplained
        bar. A measurement that does not share an origin with the thing it is
        measured against is not a measurement.

        The caption leads rather than trails, so the row reads left to right as the
        sentence it is: one takes THIS MUCH of the bar above.
      */}
      {shopping && (
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-micro text-faint">{t('capacity.each')}</span>
          <span className="socket h-2 flex-1 justify-items-start overflow-hidden rounded-full">
            <span
              data-part="one"
              className="block h-full rounded-full bg-crystal/70"
              style={{ width: `${String(oneShare)}%` }}
            />
          </span>
        </div>
      )}
    </div>
  );
}
