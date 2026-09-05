import { useTranslation } from 'react-i18next';
import {
  COMBAT,
  COMBAT_CLASSES,
  counterMult,
  counteredBy,
  counters,
  type HullClass,
} from '@astera/rules';
import { combatClassLabel } from '../i18n/names.js';
import { decimal } from '../lib/format.js';
import {
  BulwarkIcon,
  LanceIcon,
  SkirmisherIcon,
  SupportIcon,
} from './icons/index.js';

/**
 * THE COUNTER CYCLE, MADE VISIBLE AT THE MOMENT IT IS BET ON. D124.
 *
 * *"A rule the player cannot see is not a usable rule."* This one could not be
 * seen anywhere: `HullClass` appeared ZERO times in `apps/web/src`, and the
 * multipliers were printed in exactly one place — `CombatFormula`, inside a battle
 * report — so the single most important rule in the game was taught as a
 * post-mortem, after the fleet was already lost.
 *
 * And the interface did worse than stay silent. Hulls are banded by FAMILY
 * (Offensive · Defensive · Special · Cargo), which is where to find a ship in the
 * shipyard and has nothing to do with how it fights: a Pike is Offensive and a
 * Rampart Defensive, and the Rampart beats the Pike. A player reasoning from the
 * only taxonomy on screen reasoned backwards.
 *
 * THE DIVISION OF LABOUR HERE FOLLOWS `docs/interface.md`'s existing grammar:
 *
 *   IDENTITY  → the glyph. Three different kinds of thing — swarm, wall, spear —
 *               so the cycle is inferable from the pictures before a word is read.
 *   JUDGEMENT → the colour. Green and red are this game's words for opportunity
 *               and threat everywhere else, and a matchup is exactly that. Class
 *               identity deliberately takes NO hue, so the two never compete.
 *
 * NOTHING IN THIS FILE HARD-CODES A MULTIPLIER. Every figure comes from `COMBAT`
 * and every relation from `counters`/`counteredBy`, which `packages/rules` tests
 * against `counterMult` over the whole hull table. A balance pass moves the screen
 * with it; it cannot leave a surface teaching last season's rule.
 */

const GLYPH: Record<HullClass, (props: { className?: string }) => React.ReactNode> = {
  SKIRMISHER: SkirmisherIcon,
  BULWARK: BulwarkIcon,
  LANCE: LanceIcon,
  SUPPORT: SupportIcon,
};

/** The class a hull fights as: a shape and a word, and no colour of its own. */
export function ClassChip({
  cls,
  className = '',
}: {
  cls: HullClass;
  className?: string;
}) {
  const Glyph = GLYPH[cls];
  return (
    <span
      data-testid="class-chip"
      data-class={cls}
      className={`inline-flex shrink-0 items-center gap-1 rounded-chip border border-line-soft bg-void/40 px-1.5 py-0.5 text-micro uppercase tracking-label text-dim ${className}`}
    >
      <Glyph className="size-3.5 shrink-0" />
      {combatClassLabel(cls)}
    </span>
  );
}

/* ── one pairing ───────────────────────────────────────────────────────────── */

type Verdict = 'strong' | 'weak' | 'even' | 'none';

/**
 * Which of the four things this pairing is.
 *
 * Read off `counterMult` rather than re-deriving the cycle, so the mark and the
 * resolver cannot disagree even by an oversight. `none` is its own case and not a
 * flavour of `weak`: a support hull does not fire badly, it does not fire.
 */
const verdictOf = (attacker: HullClass, defender: HullClass): Verdict => {
  const mult = counterMult(attacker, defender);
  if (mult === 0) return 'none';
  if (mult === COMBAT.strongMult) return 'strong';
  if (mult === COMBAT.weakMult) return 'weak';
  return 'even';
};

const VERDICT_TONE: Record<Verdict, string> = {
  strong: 'text-opportunity',
  weak: 'text-threat-ink',
  even: 'text-faint',
  none: 'text-faint',
};

/** ▲ · ● · ▼ — the judgement as a shape, so the colour is never doing it alone. */
const VERDICT_ARROW: Record<Verdict, string> = {
  strong: '▲',
  weak: '▼',
  even: '●',
  none: '–',
};

/**
 * HOW ONE HULL CLASS FARES AGAINST A KNOWN ENEMY CLASS.
 *
 * Only ever rendered where the enemy's class is something the commander has
 * EARNED — a battle they fought, a rival record. A probe reports a defence value
 * and a ship count and never a composition (D127), so a matchup drawn from probe
 * data would be the interface inventing the one reading the player did not buy.
 */
export function MatchupMark({
  attacker,
  defender,
}: {
  attacker: HullClass;
  defender: HullClass;
}) {
  const { t } = useTranslation();
  const verdict = verdictOf(attacker, defender);
  const mult = counterMult(attacker, defender);
  const outcome = t(`counter.${verdict}`);

  return (
    <span
      data-testid="matchup"
      data-matchup={verdict}
      className={`num inline-flex shrink-0 items-center gap-1 text-micro ${VERDICT_TONE[verdict]}`}
      aria-label={t('counter.matchupLabel', {
        attacker: combatClassLabel(attacker),
        defender: combatClassLabel(defender),
        outcome,
        mult: decimal(mult, 3),
      })}
    >
      <span aria-hidden>{VERDICT_ARROW[verdict]}</span>
      {verdict === 'none' ? outcome : t('counter.multiplier', { mult: decimal(mult, 3) })}
    </span>
  );
}

/* ── one class's two relations ─────────────────────────────────────────────── */

/**
 * WHAT THIS CLASS BEATS, AND WHAT BEATS IT.
 *
 * Both directions, because only one of them is the danger and a player choosing a
 * hull needs the one that will kill it as much as the one it kills. Support gets
 * its own sentence instead of an invented rung — it sits outside the cycle in both
 * directions and a chip claiming otherwise would teach a rule that does not exist.
 */
export function CounterLine({ cls }: { cls: HullClass }) {
  const { t } = useTranslation();
  const prey = counters(cls);
  const predator = counteredBy(cls);

  if (prey === null || predator === null) {
    return (
      <p data-testid="counter-support" className="text-caption leading-snug text-faint">
        {t('counter.supportNote')}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span
        data-testid="counter-strong"
        className="inline-flex items-center gap-1 text-caption text-opportunity"
      >
        <span aria-hidden>▲</span>
        {t('counter.strongVs', { class: combatClassLabel(prey) })}
      </span>
      <span
        data-testid="counter-weak"
        className="inline-flex items-center gap-1 text-caption text-threat-ink"
      >
        <span aria-hidden>▼</span>
        {t('counter.weakVs', { class: combatClassLabel(predator) })}
      </span>
    </div>
  );
}

/* ── the whole cycle ───────────────────────────────────────────────────────── */

/**
 * THE THREE RUNGS AND THE ARROWS BETWEEN THEM.
 *
 * The full rule, one tap deeper than the row — progressive disclosure rather than
 * a wiki. It belongs on a hull's detail sheet, where a player who has just asked
 * "what is a Lance" gets the answer and the whole relation in the same glance,
 * with their own class lit.
 *
 * Ordered off `COMBAT_CLASSES` and arrowed off `counters`, so it cannot be drawn
 * pointing the wrong way even if the cycle is ever re-cut.
 */
export function CounterCycle({ highlight }: { highlight?: HullClass }) {
  const { t } = useTranslation();
  return (
    <div
      className="flex items-stretch gap-1"
      role="img"
      aria-label={t('counter.cycleLabel')}
    >
      {COMBAT_CLASSES.map((cls, index) => {
        const Glyph = GLYPH[cls];
        const current = cls === highlight;
        return (
          <div key={cls} className="flex min-w-0 flex-1 items-center gap-1">
            <div
              data-rung={cls}
              {...(current ? { 'data-current': 'true' } : {})}
              className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-control border px-1 py-2 transition-colors ${
                current
                  ? 'border-crystal/45 bg-crystal/10 text-bone'
                  : 'border-line-soft bg-void/40 text-dim'
              }`}
            >
              <Glyph className="size-5 shrink-0" />
              <span className="truncate text-micro uppercase tracking-label">
                {combatClassLabel(cls)}
              </span>
            </div>
            {/*
              The arrow points at what this rung BEATS, which is the next entry in
              cycle order — and the last one wraps, which is the whole shape. It is
              drawn between the cards rather than after them so the loop reads
              left to right without a return line nobody would follow.
            */}
            <span aria-hidden className="shrink-0 text-label text-faint">
              {index === COMBAT_CLASSES.length - 1 ? '↺' : '▸'}
            </span>
          </div>
        );
      })}
    </div>
  );
}
