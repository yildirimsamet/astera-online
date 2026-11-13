import { REPAIR_LADDER, STARTER, moduleStage, type VesselProgress } from '@astera/rules';
import { useTranslation } from 'react-i18next';
import type { MigrationView, VesselView } from '../api/starterSchemas.js';
import { full } from '../lib/format.js';
import { useNow } from '../lib/time.js';
import { RESOURCE_ART } from '../ui/assets.js';
import { Icon } from '../v2/icons.js';
import { LeftBehind } from './LandingChoice.js';
import { useMigration } from './queries.js';
import { jumpOutlook, type JumpOutlook } from './departurePlan.js';
import './jumpCall.css';

/** One line of the hold: what goes down now against what a jump carries. */
function HoldRow({ id, icon, label, have, cap, share }: { id: string; icon: React.ReactNode; label: string; have: number; cap: number; share: number }) {
  const topped = share >= 1;
  return (
    <li data-testid={`hold-${id}`} className="flex flex-col gap-0.5">
      <span className="flex items-center gap-2 text-caption">
        {icon}
        <span className="min-w-0 flex-1 truncate text-v2-ink-2 first-letter:uppercase">{label}</span>
        <span className={`font-v2-mono tabular-nums ${topped ? 'text-v2-self' : 'text-v2-ink'}`}>{full(have)}/{full(cap)}</span>
      </span>
      <span className="block h-1.5 overflow-hidden rounded-full border border-v2-line-hi bg-v2-void">
        <span className={`block h-full rounded-full transition-[width] duration-500 ${topped ? 'bg-v2-self shadow-[0_0_6px_var(--color-v2-self)]' : 'bg-v2-ink-2'}`}
          style={{ width: `${String(Math.round(Math.min(1, share) * 100))}%` }} />
      </span>
    </li>
  );
}

/** The season and the frontier, said while there is still time to plan around them. */
function Outlook({ outlook }: { outlook: JumpOutlook }) {
  const { t } = useTranslation();
  const said = outlook.kind === 'noFrontier' ? t('starter.outlook.noFrontier') : t('starter.outlook.seasonClosed', { days: outlook.daysLeft });
  return (
    <p data-testid="jump-outlook" className="flex items-start gap-1.5 rounded-control border border-v2-warn/40 bg-v2-warn/10 px-2 py-1 text-micro leading-snug text-v2-warn">
      <Icon id="i-clock" className="mt-px size-3 shrink-0" />{said}
    </p>
  );
}

const art = (src: string) => <img src={src} alt="" className="size-3.5 shrink-0 object-contain" />;

/**
 * WHERE THE JUMP IS DECIDED (plan 2026-11-13 §4.4): the hold against what a jump carries, what stays
 * behind, and what the season says. It gives the inputs, not the answer: leaving early and staying to
 * fill the hold are both fair. Faz 3 builds the full decision panel on the game UI kit.
 */
export function MigrationPanel({ vessel, onJump }: { vessel: VesselView; onJump: (view: MigrationView) => void }) {
  const { t } = useTranslation();
  const { data: view } = useMigration();
  const now = useNow(30_000);
  const progress: VesselProgress = { modules: vessel.modules, facts: vessel.facts };
  const outlook = view ? jumpOutlook(view.target, now) : null;
  // The outlook already says a full frontier or a closed season; the block line says the rest.
  const block = view?.block && !(outlook && (view.block.code === 'NO_FRONTIER' || view.block.code === 'MIGRATION_SEASON_WAIT')) ? view.block : null;
  const optional = REPAIR_LADDER.filter(step => !step.required && moduleStage(progress, step.module) < step.stage).length;
  const ships = view ? Object.values(view.cargo.fleet).reduce((sum, count) => sum + count, 0) : 0;
  return (
    <section data-testid="migration-panel" aria-label={t('starter.jump.panel')}
      className="mx-3 flex flex-col gap-2 rounded-plate border border-v2-line-hi bg-gradient-to-b from-v2-panel to-v2-void/80 p-2.5">
      <h3 className="v2-legend text-v2-ink-2">{t('starter.jump.holdTitle')}</h3>
      {view && (
        <ul className="-mt-1 flex flex-col gap-1.5">
          <HoldRow id="alloy" icon={art(RESOURCE_ART.alloy)} label={t('vocabulary.resource.alloy')} have={view.cargo.alloy} cap={STARTER.carry.alloy} share={view.fill.alloy} />
          <HoldRow id="crystal" icon={art(RESOURCE_ART.crystal)} label={t('vocabulary.resource.crystal')} have={view.cargo.crystal} cap={STARTER.carry.crystal} share={view.fill.crystal} />
          <HoldRow id="deuterium" icon={art(RESOURCE_ART.deuterium)} label={t('vocabulary.resource.deuterium')} have={view.cargo.deuterium} cap={STARTER.carry.deuterium} share={view.fill.deuterium} />
          <HoldRow id="ships" icon={<Icon id="i-fleet" className="size-3.5 shrink-0 text-v2-ink-2" />} label={t('starter.jump.holdShips')} have={ships} cap={STARTER.carry.ships} share={view.fill.ships} />
        </ul>
      )}
      {view?.full && <p data-testid="hold-full" className="text-micro font-semibold leading-snug text-v2-self">{t('starter.jump.holdFull')}</p>}

      {/* The loss is said while it can still be spent or flown home (player test, 2026-11-05). */}
      {view && <LeftBehind left={view.left} />}
      <p data-testid="jump-stays" className="text-micro leading-snug text-v2-ink-3">
        {t('starter.jump.staysAboard')}{optional > 0 && <> {t('starter.plan.optional', { count: optional })}</>}
      </p>
      {outlook && <Outlook outlook={outlook} />}
      {block && <p data-testid="jump-block" className="text-micro leading-snug text-v2-warn">{block.code === 'MIGRATION_SEASON_WAIT' ? t('errors.MIGRATION_SEASON_WAIT', { daysLeft: block.daysLeft }) : t(`errors.${block.code}`)}</p>}
      {view && !view.block && (
        <button type="button" onClick={() => { onJump(view); }}
          className="jump-call relative min-h-11 overflow-hidden rounded-control border border-v2-self bg-gradient-to-b from-v2-self to-v2-self/55 text-body font-bold uppercase tracking-wide text-v2-void shadow-[0_0_18px_-2px_var(--color-v2-self)]">
          {t('starter.jump.go')}
        </button>
      )}
    </section>
  );
}
