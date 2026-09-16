import { useTranslation } from 'react-i18next';
import { full } from '../lib/format.js';

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
 * LABELLED COUNTS ARE PRIMARY. The bar reinforces the three visible facts;
 * neither colour nor an unlabelled zero should carry the meaning alone.
 */
export function SurvivorBar({
  sent,
  lost,
  rebuilt = 0,
  compactRow = false,
  showFigures = true,
  side = 'yours',
  sentLabel,
  leftLabel,
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
  /**
   * WHOSE FORCE THIS IS, which decides only the colours. D164.
   *
   * The bar measures the same thing either way — what went in, what died — and
   * the reader's stake in the answer inverts with the side. On your own force,
   * surviving is the good half; on the force that came at you, the survivors are
   * a squadron flying home with your ore and the dead are your defence working.
   * Painting both the same way would have the sheet cheering at your losses.
   */
  side?: 'yours' | 'theirs';
  sentLabel?: string;
  leftLabel?: string;
}) {
  const { t } = useTranslation();
  const total = Math.max(1, sent);
  const died = Math.max(0, Math.min(sent, lost));
  const alive = Math.max(0, sent - died);
  const back = Math.max(0, Math.min(died, rebuilt));
  /*
    THE BAR IS THE FORCE THAT WENT IN, and salvage is drawn on top of it rather
    than inside it — those guns are extra, not survivors, and squeezing them into
    the same hundred percent would make an untouched battery look damaged.
  */
  const alivePart = (alive / total) * 100;
  const diedPart = (died / total) * 100;
  const backPart = (back / total) * 100;
  const lostTone = side === 'theirs'
    ? died > 0 ? 'text-opportunity' : 'text-dim'
    : died > 0 ? 'text-threat-ink' : 'text-dim';
  const leftTone = side === 'theirs'
    ? alive + back > 0 ? 'text-threat-ink' : 'text-opportunity'
    : alive + back === 0 ? 'text-threat-ink' : 'text-bone';

  return (
    <span
      className={`flex min-w-0 flex-col gap-2 ${compactRow ? '' : 'w-full'}`}
      role="img"
      aria-label={t('reports.force.reading', {
        sent: full(sent),
        lost: full(died),
        left: full(alive + back),
      })}
    >
      {showFigures ? (
        <span className="grid w-full grid-cols-3 gap-2 text-left">
          <span>
            <span className="block text-label text-dim">{sentLabel ?? t('reports.force.start')}</span>
            <span data-sent className="num block text-title text-bone">{full(sent)}</span>
          </span>
          <span>
            <span className="block text-label text-dim">{t('reports.force.lost')}</span>
            <span data-lost className={`num block text-title ${lostTone}`}>
              {full(died)}
            </span>
          </span>
          <span>
            <span className="block text-label text-dim">{leftLabel ?? t('reports.force.left')}</span>
            <span data-alive className={`num block text-title ${leftTone}`}>
              {full(alive + back)}
            </span>
          </span>
        </span>
      ) : null}
      <span aria-hidden className="socket relative flex h-2 w-full min-w-0 overflow-hidden rounded-full">
        <span
          data-part="alive"
          className={`h-full ${side === 'theirs' ? 'bg-threat/70' : 'bg-bone/70'}`}
          style={{ width: `${String(alivePart)}%` }}
        />
        <span
          data-part="lost"
          className={`h-full ${side === 'theirs' ? 'bg-opportunity/70' : 'bg-threat/80'}`}
          style={{ width: `${String(diedPart)}%`, backgroundImage: 'repeating-linear-gradient(135deg, transparent 0 4px, rgb(255 255 255 / 20%) 4px 6px)' }}
        />
        <span
          data-part="rebuilt"
          className="absolute right-0 h-full bg-opportunity/90"
          style={{ width: `${String(backPart)}%` }}
        />
      </span>
      {back > 0 && showFigures ? (
        <span data-rebuilt className="w-full text-label leading-relaxed text-opportunity">
          {t('reports.force.rebuiltNote', { count: full(back) })}
        </span>
      ) : null}
    </span>
  );
}
