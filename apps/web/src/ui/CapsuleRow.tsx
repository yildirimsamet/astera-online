import { useTranslation } from 'react-i18next';
import { SYNTHESIS, type CapsuleMissionKind, type Fleet } from '@astera/rules';
import type { CapsuleIdView } from '../api/schemas.js';
import { Toggle } from '../game-ui/index.js';
import { full } from '../lib/format.js';
import { CAPSULE_ART, capsuleChoices, capsuleWords, type CapsuleChoice } from '../lib/synthesis.js';

/** Past this many a row of vials stops being countable at a glance; the words carry it alone. */
const MOST_PIPS = 10;

/**
 * SENTEZ KAPSÜLLERİ ON A LAUNCH (plan 2026-11-24 §3.5). The rule and this fleet's size once (why it costs what it
 * costs), then one switch per capsule this flight may wear: what it does, what this fleet needs against what is
 * held, and whether that is enough — in words and in a row of vials, one per capsule needed, lit for each one held.
 * A short stock locks the switch and says where more is made. Silent when the commander holds no capsule at all:
 * the laboratory is where they are discovered, not every launch.
 */
export function CapsuleRow({ kind, fleet, held, chosen, onChange }: {
  kind: CapsuleMissionKind; fleet: Fleet; held: Record<CapsuleIdView, number> | null;
  chosen: readonly CapsuleIdView[]; onChange: (next: CapsuleIdView[]) => void;
}) {
  const { t } = useTranslation();
  if (!held || held.OPTIC_VEIL + held.SILENT_THRUST === 0) return null;
  const choices = capsuleChoices(kind, fleet, held);
  const first = choices[0];
  if (!first) return null;
  return <div className="gk-capsules" data-launch-capsules role="group" aria-label={t('synthesis.launch.heading')}>
    <p className="gk-sub gk-num gk-capsules__rule">{t('synthesis.launch.rule', { per: full(SYNTHESIS.bulkPerCapsule), bulk: full(first.bulk) })}</p>
    {choices.map((choice) => {
      const on = choice.enough && chosen.includes(choice.id);
      return <Toggle key={choice.id}
        checked={on}
        locked={!choice.enough}
        art={CAPSULE_ART[choice.id]}
        label={t(`synthesis.capsule.${choice.id}.name`)}
        sub={<>
          {/* What it does is read before the press (decision support), its price under it. */}
          <span>{capsuleWords(t, choice.id, kind === 'attack' || kind === 'clan_war')}</span><br />
          <Stock choice={choice} />
          {!choice.enough && <><br /><span>{t('synthesis.launch.short')}</span></>}
        </>}
        onChange={(next) => { onChange(next ? [...chosen.filter((id) => id !== choice.id), choice.id] : chosen.filter((id) => id !== choice.id)); }} />;
    })}
  </div>;
}

/** Needed against held: the vials, then the sentence that says whether it is enough. */
function Stock({ choice }: { choice: CapsuleChoice }) {
  const { t } = useTranslation();
  return <span className="gk-capsules__stock" data-tone={choice.enough ? 'self' : 'warn'}>
    {choice.need <= MOST_PIPS && <span className="gk-capsules__pips" data-capsule-pips={choice.id} aria-hidden>
      {Array.from({ length: choice.need }, (_, index) => <i key={index} {...(index < choice.held ? { 'data-full': '' } : {})} />)}
    </span>}
    <span className="gk-num" data-capsule-need={choice.id}>{choice.enough
      ? t('synthesis.launch.enough', { need: choice.need, held: choice.held, left: choice.held - choice.need })
      : t('synthesis.launch.missing', { need: choice.need, held: choice.held, missing: choice.need - choice.held })}</span>
  </span>;
}
