import { Fragment, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { matchupsAgainst, type ClassReading, type CombatClass, type Fleet } from '@astera/rules';
import { combatClassLabel } from '../../i18n/names.js';
import { matchupHint } from '../../lib/matchup.js';
import { ClassEmblem } from './ClassEmblem.js';

/**
 * A class named in the line: its emblem, then its words.
 *
 * INLINE, NOT FLEX. An inline-flex span sits its own baseline on the emblem's foot,
 * which dropped every " · " after it to the floor of the line so the separators
 * read as full stops (seen on the gallery). An inline emblem aligned to the middle
 * leaves the text on the line's own baseline.
 */
function Named({ cls, tone, children }: { cls: CombatClass; tone?: 'self' | 'quiet'; children: ReactNode }) {
  return (
    <span data-class={cls} className="gk-mline__class" {...(tone ? { 'data-tone': tone } : {})}>
      <ClassEmblem cls={cls} decorative className="gk-mline__emblem" />
      {children}
    </span>
  );
}

/** Phrases on one line, joined the way every other line in the game is. */
function Joined({ parts, join }: { parts: readonly ReactNode[]; join: string }) {
  return parts.map((part, index) => (
    // The parts are a fixed sequence built fresh each render; position is their identity.
    <Fragment key={index}>{index > 0 && join}{part}</Fragment>
  ));
}

/**
 * THE COUNTER CYCLE, WHERE THE WING IS CHOSEN. Spec B6 (docs/ui-v2/gozlemevi.md).
 *
 * One line with the class emblems on it — "◆ Mostly Lance — more than half ·
 * ⬢ Bring Bulwark · the remainder is unread and may counter you" — and, when the
 * wing carries armed classes, a second one saying what each meets there.
 * `matchupsAgainst` does the reading and `matchupHint` picks the one hint; this
 * only words them, with the launch sheet's own sentences.
 *
 * A MAJORITY IS A FLOOR. A par probe cannot tell a pure wall from a 52% one, so
 * it says "more than half" and states the rest as open, never as a percentage it
 * does not have. A full split names every class it measured and drops none; a
 * combat v3 reading names each class as the range it read (owner 2026-10-25).
 */
export function MatchupLine({ wing, reading }: { wing: Fleet; reading: ClassReading | undefined }) {
  const { t } = useTranslation();
  const matchups = useMemo(() => matchupsAgainst(wing, reading), [wing, reading]);
  const join = t('counter.lineJoin');
  // A whole percent, or a range reading's floor to its top.
  const share = (low: number, high?: number): string => {
    const [a, b] = [Math.round(low * 100), Math.round((high ?? low) * 100)];
    return a === b ? String(a) : `${String(a)}${t('units.rangeJoin')}${String(b)}`;
  };

  if (reading?.kind === 'UNREAD') {
    return (
      <p data-matchup-wall="" className="gk-mline gk-mline__wall">
        <Joined parts={[t('counter.noteShapeUnread'), t('dossier.shapeUnreadNote')]} join={join} />
      </p>
    );
  }
  if (!matchups) return null;

  const parts: ReactNode[] = [];
  // The KIND decides the wording. A full split whose two largest classes tie has no
  // `wall` to name, and it is still a full split: every class it measured is printed.
  if (matchups.kind === 'MAJORITY' && matchups.wall !== null) {
    parts.push(
      <Named cls={matchups.wall}>
        {t('counter.matchupMajority', { class: combatClassLabel(matchups.wall) })}
      </Named>,
    );
  } else if (matchups.kind !== 'SPLIT' && matchups.kind !== 'RANGES') {
    parts.push(t('counter.matchupMixed'));
  } else {
    parts.push(t('counter.matchupSplit'));
    for (const row of matchups.wallShares) {
      parts.push(
        <Named cls={row.cls}>
          {combatClassLabel(row.cls)} {t('units.percent', { value: share(row.share, row.high) })}
        </Named>,
      );
    }
  }

  const hint = matchupHint(matchups);
  if (hint?.kind === 'BRING') {
    parts.push(
      <Named cls={hint.cls} tone="self">
        {t('counter.matchupBring', { class: combatClassLabel(hint.cls) })}
      </Named>,
    );
  } else if (hint) {
    parts.push(<span data-tone="warn">{t(hint.kind === 'SINGLE' ? 'counter.matchupSingle' : 'counter.matchupProbe')}</span>);
  }
  // A range reading states its open part in the ranges themselves; only a majority leaves a remainder unread.
  if (matchups.unknownShare > 0 && matchups.kind === 'MAJORITY') parts.push(t('counter.matchupRemainder'));

  return (
    <div className="gk-mline">
      <p data-matchup-wall="" className="gk-mline__wall">
        <Joined parts={parts} join={join} />
      </p>
      {matchups.rows.length > 0 && (
        <ul data-matchup-wing="" className="gk-mline__wing">
          {matchups.rows.map((row) => (
            <li key={row.cls}>
              <Named cls={row.cls} tone="quiet">
                {t('counter.matchupExposure', {
                  class: combatClassLabel(row.cls),
                  strong: share(row.strongShare, row.strongHigh),
                  weak: share(row.weakShare, row.weakHigh),
                })}
              </Named>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
