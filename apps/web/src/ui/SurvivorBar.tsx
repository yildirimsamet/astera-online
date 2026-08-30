import { useTranslation } from 'react-i18next';
import { compact } from '../lib/format.js';

/**
 * WHAT WENT IN AND WHAT CAME BACK, AS ONE SHAPE. Owner instruction.
 *
 * The battle report answered this with a four-column table — sent, lost, left —
 * repeated once per hull. Every figure was correct and the one question a player
 * opens a report holding, *did I get away with it*, had to be assembled out of
 * three of them and then compared against the row above.
 *
 * The bar is that question already answered. What survived is solid and what died
 * is the threat colour, in the proportion they actually happened, so a raid that
 * cost half the fleet LOOKS like half the fleet.
 *
 * THE THIRD SEGMENT IS THE ONE NOBODY EXPECTS. Ground defence salvages back (D27),
 * so a defender is told they lost seven Bastions while four are still standing.
 * Rebuilt is its own colour on the same bar, because "these came back" is a
 * different fact from "these never died" and the report has to say which is which.
 *
 * NUMBERS SURVIVE, SMALL AND BESIDE THE SHAPE. A figure is what you check when the
 * picture has already told you the answer, and no figure here is load-bearing.
 */
export function SurvivorBar({
  sent,
  lost,
  rebuilt = 0,
  compactRow = false,
  showFigures = true,
}: {
  /** What stood or was sent in. The width of the whole bar. */
  sent: number;
  /** What died. */
  lost: number;
  /** Ground guns that salvaged back — never counted as never-lost. */
  rebuilt?: number;
  /** Row form: shorter, no caption, for one hull inside a list. */
  compactRow?: boolean;
  /** The surrounding summary may already print these figures at display size. */
  showFigures?: boolean;
}) {
  const { t } = useTranslation();
  const total = Math.max(1, sent);
  const died = Math.max(0, Math.min(sent, lost));
  const alive = Math.max(0, sent - died);
  const back = Math.max(0, rebuilt);
  /*
    THE BAR IS THE FORCE THAT WENT IN, and salvage is drawn on top of it rather
    than inside it — those guns are extra, not survivors, and squeezing them into
    the same hundred percent would make an untouched battery look damaged.
  */
  const alivePart = (alive / total) * 100;
  const diedPart = (died / total) * 100;
  const backPart = (back / total) * 100;

  return (
    <span
      className={`flex min-w-0 items-center gap-2 ${compactRow ? '' : 'w-full'}`}
      role="img"
      aria-label={t('reports.force.reading', {
        sent: compact(sent),
        lost: compact(died),
        left: compact(alive + back),
      })}
    >
      <span className="socket flex h-2.5 min-w-0 flex-1 overflow-hidden rounded-full">
        <span data-part="alive" className="h-full bg-bone/70" style={{ width: `${String(alivePart)}%` }} />
        <span data-part="lost" className="h-full bg-threat/80" style={{ width: `${String(diedPart)}%` }} />
        <span
          data-part="rebuilt"
          className="h-full bg-opportunity/70"
          style={{ width: `${String(backPart)}%` }}
        />
      </span>
      {/*
        TWO FIGURES AND NOT FOUR: what is left, and what it cost. "Sent" is the
        whole bar and needs no numeral; "rebuilt" is the green sliver.
      */}
      {showFigures ? (
        <span className="num shrink-0 text-caption text-bone" data-alive>
          {compact(alive + back)}
        </span>
      ) : null}
      {showFigures && died > 0 ? (
        <span className="num shrink-0 text-caption text-threat-ink" data-lost>−{compact(died)}</span>
      ) : null}
    </span>
  );
}
