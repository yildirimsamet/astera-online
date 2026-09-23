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
function Named({ cls, tone, children }: { cls: CombatClass; tone: string; children: ReactNode }) {
  return (
    <span data-class={cls} className={`whitespace-nowrap ${tone}`}>
      <ClassEmblem cls={cls} decorative className="mr-1 inline-block size-3 align-middle" />
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
 * does not have. A full split names every class it measured and drops none.
 */
export function MatchupLine({ wing, reading }: { wing: Fleet; reading: ClassReading | undefined }) {
  const { t } = useTranslation();
  const matchups = useMemo(() => matchupsAgainst(wing, reading), [wing, reading]);
  const join = t('counter.lineJoin');

  if (reading?.kind === 'UNREAD') {
    return (
      <p data-matchup-wall="" className="font-v2-ui text-caption leading-snug text-v2-ink-2">
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
      <Named cls={matchups.wall} tone="text-v2-ink">
        {t('counter.matchupMajority', { class: combatClassLabel(matchups.wall) })}
      </Named>,
    );
  } else if (matchups.kind !== 'SPLIT') {
    parts.push(t('counter.matchupMixed'));
  } else {
    parts.push(t('counter.matchupSplit'));
    for (const row of matchups.wallShares) {
      parts.push(
        <Named cls={row.cls} tone="text-v2-ink">
          {combatClassLabel(row.cls)} {t('units.percent', { value: String(Math.round(row.share * 100)) })}
        </Named>,
      );
    }
  }

  const hint = matchupHint(matchups);
  if (hint?.kind === 'BRING') {
    parts.push(
      <Named cls={hint.cls} tone="text-v2-self">
        {t('counter.matchupBring', { class: combatClassLabel(hint.cls) })}
      </Named>,
    );
  } else if (hint) {
    parts.push(<span className="text-v2-warn">{t(hint.kind === 'SINGLE' ? 'counter.matchupSingle' : 'counter.matchupProbe')}</span>);
  }
  if (matchups.unknownShare > 0 && matchups.kind !== 'MIXED') parts.push(t('counter.matchupRemainder'));

  return (
    <div className="flex flex-col gap-0.5 font-v2-ui text-caption leading-snug">
      <p data-matchup-wall="" className="text-v2-ink-2">
        <Joined parts={parts} join={join} />
      </p>
      {matchups.rows.length > 0 && (
        <p data-matchup-wing="" className="font-v2-mono text-micro text-v2-ink-3">
          <Joined
            join={join}
            parts={matchups.rows.map((row) => (
              <Named cls={row.cls} tone="text-v2-ink-2">
                {combatClassLabel(row.cls)}{' '}
                {t('counter.matchupExposure', {
                  strong: Math.round(row.strongShare * 100),
                  weak: Math.round(row.weakShare * 100),
                })}
              </Named>
            ))}
          />
        </p>
      )}
    </div>
  );
}
