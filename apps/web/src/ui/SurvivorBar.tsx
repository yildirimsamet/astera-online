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
  // The tone is stated (`data-tone`), and the kit paints it: the same figure is good news on one side and a threat on the other.
  const lostTone = died === 0 ? 'quiet' : side === 'theirs' ? 'good' : 'threat';
  const leftTone = side === 'theirs'
    ? alive + back > 0 ? 'threat' : 'good'
    : alive + back === 0 ? 'threat' : 'plain';

  return (
    <span
      className="gk-survivor"
      data-side={side}
      {...(compactRow ? { 'data-compact': '' } : {})}
      role="img"
      aria-label={t('reports.force.reading', {
        sent: full(sent),
        lost: full(died),
        left: full(alive + back),
      })}
    >
      {showFigures ? (
        <span className="gk-survivor__figures">
          <span className="gk-survivor__fig">
            <span className="gk-survivor__label">{sentLabel ?? t('reports.force.start')}</span>
            <span data-sent className="gk-survivor__value gk-num">{full(sent)}</span>
          </span>
          <span className="gk-survivor__fig">
            <span className="gk-survivor__label">{t('reports.force.lost')}</span>
            <span data-lost data-tone={lostTone} className="gk-survivor__value gk-num">
              {full(died)}
            </span>
          </span>
          <span className="gk-survivor__fig">
            <span className="gk-survivor__label">{leftLabel ?? t('reports.force.left')}</span>
            <span data-alive data-tone={leftTone} className="gk-survivor__value gk-num">
              {full(alive + back)}
            </span>
          </span>
        </span>
      ) : null}
      <span aria-hidden className="gk-survivor__bar">
        <span data-part="alive" className="gk-survivor__part" style={{ width: `${String(alivePart)}%` }} />
        <span data-part="lost" className="gk-survivor__part" style={{ width: `${String(diedPart)}%` }} />
        <span data-part="rebuilt" className="gk-survivor__part gk-survivor__over" style={{ width: `${String(backPart)}%` }} />
      </span>
      {back > 0 && showFigures ? (
        <span data-rebuilt className="gk-survivor__note">
          {t('reports.force.rebuiltNote', { count: full(back) })}
        </span>
      ) : null}
    </span>
  );
}
