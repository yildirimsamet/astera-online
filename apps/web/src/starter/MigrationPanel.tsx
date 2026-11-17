import { FIRST_SEASON_START, REPAIR_LADDER, STARTER, moduleStage, type VesselProgress } from '@astera/rules';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { MigrationView, VesselView } from '../api/starterSchemas.js';
import { ArtIcon, Banner, GameButton, ProgressBar, SectionTag, StoreGauge } from '../game-ui/index.js';
import { full } from '../lib/format.js';
import { useNow } from '../lib/time.js';
import { LeftBehind } from './LandingChoice.js';
import { useMigration } from './queries.js';
import { jumpOutlook, type JumpOutlook } from './departurePlan.js';
import { ProtectionLines } from './ProtectionLines.js';
import './jumpCall.css';

/** What the ship makes each hour: how fast the hold fills while it stays. */
export interface HoldIncome { alloy: number; crystal: number; deuterium: number }

const STORES = ['alloy', 'crystal', 'deuterium'] as const;
const PACK = FIRST_SEASON_START.resources;
const PACK_SHIPS = Object.values(FIRST_SEASON_START.fleet).reduce((sum, count) => sum + count, 0);

/** One block of the decision, under its tag. */
function Part({ id, tag, children }: { id: string; tag: string; children: ReactNode }) {
  return <div data-testid={id} className="flex flex-col gap-1"><SectionTag>{tag}</SectionTag>{children}</div>;
}

/** The season and the frontier, said while there is still time to plan around them. */
function Outlook({ outlook }: { outlook: JumpOutlook }) {
  const { t } = useTranslation();
  const said = outlook.kind === 'noFrontier' ? t('starter.outlook.noFrontier') : t('starter.outlook.seasonClosed', { days: outlook.daysLeft });
  return <div data-testid="jump-outlook"><Banner tone="warn" variant="strip" glyph="clock" title={said} /></div>;
}

/**
 * WHERE THE JUMP IS DECIDED (plan 2026-11-13 §4.4). Top to bottom: what the hold takes against what a
 * jump carries and how fast it fills, what staying is worth, what landing brings and how the new world
 * is kept, what stays behind, the season, the action. It gives the inputs, not the answer: leaving early
 * and staying to fill the hold are both fair.
 */
export function MigrationPanel({ vessel, income, onJump }: { vessel: VesselView; income: HoldIncome; onJump: (view: MigrationView) => void }) {
  const { t } = useTranslation();
  const { data: view } = useMigration();
  const now = useNow(30_000);
  const progress: VesselProgress = { modules: vessel.modules, facts: vessel.facts };
  const outlook = view ? jumpOutlook(view.target, now) : null;
  // The outlook already says a full frontier or a closed season; the block line says the rest.
  const block = view?.block && !(outlook && (view.block.code === 'NO_FRONTIER' || view.block.code === 'MIGRATION_SEASON_WAIT')) ? view.block : null;
  const optional = REPAIR_LADDER.filter(step => !step.required && moduleStage(progress, step.module) < step.stage).length;
  const ships = view ? Object.values(view.cargo.fleet).reduce((sum, count) => sum + count, 0) : 0;
  const line = 'text-caption leading-snug text-v2-ink-2';
  return (
    <section data-testid="migration-panel" aria-label={t('starter.jump.panel')} className="gk mx-3 flex flex-col gap-3">
      <Part id="jump-hold" tag={t('starter.jump.holdTitle')}>
        {view && (
          <ul className="flex flex-col gap-1">
            {STORES.map(resource => (
              <li key={resource} data-testid={`hold-${resource}`}>
                <StoreGauge resource={resource} held={view.cargo[resource]} cap={STARTER.carry[resource]} safe={0}
                  rate={income[resource]} label={t(`vocabulary.resource.${resource}`)} />
              </li>
            ))}
            {/* The ships on the stores' own grid: what it is, how many, the bar. */}
            <li data-testid="hold-ships" className="gk-store">
              <ArtIcon id="nav-fleet" size={40} className="size-4" />
              <span className="gk-store__held gk-num">{ships}<span className="gk-store__cap">/{STARTER.carry.ships}</span></span>
              <span className="gk-store__track">
                <ProgressBar value={ships} max={STARTER.carry.ships} segments={STARTER.carry.ships} label={t('starter.jump.holdShips')} />
              </span>
            </li>
          </ul>
        )}
        {view?.full && <p data-testid="hold-full" className="text-caption font-semibold leading-snug text-v2-warn">{t('starter.jump.holdFull')}</p>}
      </Part>

      <Part id="jump-stay" tag={t('starter.jump.stayTitle')}>
        <p className={line}>{t('starter.jump.stayLine', { mult: STARTER.outputMult })}</p>
      </Part>

      <Part id="jump-land" tag={t('starter.jump.landTitle')}>
        <p className={line}>{t('starter.jump.landPack', { alloy: full(PACK.alloy), crystal: full(PACK.crystal), ships: PACK_SHIPS })}</p>
        <ProtectionLines className={`flex list-disc flex-col gap-0.5 pl-4 ${line}`} />
      </Part>

      {/* The loss is said while it can still be spent or flown home (player test, 2026-11-05). */}
      <Part id="jump-behind" tag={t('starter.jump.behindTitle')}>
        {view && <LeftBehind left={view.left} />}
        <p data-testid="jump-stays" className={line}>
          {t('starter.jump.staysAboard')}{optional > 0 && <> {t('starter.plan.optional', { count: optional })}</>}
        </p>
      </Part>

      {outlook && <Outlook outlook={outlook} />}
      {block && <p data-testid="jump-block" className="text-caption leading-snug text-v2-warn">{block.code === 'MIGRATION_SEASON_WAIT' ? t('errors.MIGRATION_SEASON_WAIT', { daysLeft: block.daysLeft }) : t(`errors.${block.code}`)}</p>}
      {view && !view.block && (
        <GameButton wide tone="self" glyph="rocket" className="jump-call" onPress={() => { onJump(view); }}>{t('starter.jump.go')}</GameButton>
      )}
    </section>
  );
}
