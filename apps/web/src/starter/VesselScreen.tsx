import {
  REPAIR_LADDER, STARTER, afterQueue, nextRequiredStep, vesselHull, vesselLook,
  type RepairStep, type VesselProgress, type VesselSystem,
} from '@astera/rules';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { REPAIR_STATION_ITEM } from '../lib/repairStation.js';
import { ResearchPanel } from '../screens/ResearchPanel.js';
import { Icon } from '../v2/icons.js';
import { Segmented } from '../v2/kit/Segmented.js';
import type { MigrationView, VesselView } from '../api/starterSchemas.js';
import { useProjected } from '../lib/projection.js';
import { duration, useNow } from '../lib/time.js';
import { describe, useToast } from '../ui/Toast.js';
import { vesselToPlanetView } from './adapter.js';
import { startJump } from './jump.js';
import { LandingChoice } from './LandingChoice.js';
import { MigrationPanel } from './MigrationPanel.js';
import { CrateBay } from './CrateBay.js';
import { useMainSky, useOpenCrates, useRepairVessel } from './queries.js';
import { RepairCard, canOrder, type RepairContext } from './RepairCard.js';
import { RepairSlots } from './RepairSlots.js';
import { ShipHero } from './ShipHero.js';
import { moduleName } from './shipCopy.js';
import { cardStep, heroArt, systemSteps } from './shipScreen.js';
import { SystemTabs } from './SystemTabs.js';
import { UnlockMoment } from './UnlockMoment.js';
import { StarterWaitLine } from './tutorial/StarterWaitLine.js';
import { useStarterLesson } from './tutorial/visualGoal.js';
import { YardDeck } from './YardDeck.js';

const progressOf = (vessel: VesselView): VesselProgress => ({ modules: vessel.modules, facts: vessel.facts, parts: vessel.parts, fuel: vessel.fuel });

const repairs = (vessel: VesselView): VesselView['queue'] => vessel.queue.filter(order => order.queue === 'CONSTRUCTION');

const queuedSteps = (vessel: VesselView): RepairStep[] =>
  repairs(vessel).flatMap(order => REPAIR_LADDER.find(s => s.module === order.subject && s.stage === order.stage) ?? []);

/** The main game warns for the last 12 hours too. */
const QUIET_WARNING_MS = 12 * 60 * 60 * 1000;

/** The rule is told before it bites, and once it has, with the way back in the same line. */
function QuietNotice({ vessel }: { vessel: VesselView }) {
  const { t } = useTranslation();
  const now = useNow();
  const left = vessel.quietAt.getTime() - now;
  if (vessel.status !== 'DORMANT' && left > QUIET_WARNING_MS) return null;
  return (
    <p data-testid="ship-quiet" className="mx-3 rounded-control border border-v2-warn/40 bg-v2-warn/10 px-2 py-1 text-micro leading-snug text-v2-warn">
      {vessel.status === 'DORMANT'
        ? t('starter.quiet.asleep', { hours: STARTER.idleMs / 3_600_000 })
        : t('starter.quiet.warn', { time: duration(Math.max(0, left) / 60_000) })}
    </p>
  );
}

type ShipDeck = 'repairs' | 'yard' | 'research';

/** One deck until the Shipyard works: there is nothing to switch between before that. */
function DeckSwitch({ vessel, value, onChange }: { vessel: VesselView; value: ShipDeck; onChange: (deck: ShipDeck) => void }) {
  const { t } = useTranslation();
  if (!vessel.features.includes('fleet')) return null;
  return (
    <div data-testid="ship-decks" className="relative z-20 px-3 pt-1.5">
      <Segmented
        label={t('starter.deck.label')}
        options={[
          { id: 'repairs', label: t('starter.deck.repairs'), icon: <Icon id="i-base" className="size-4 shrink-0 text-v2-alloy" /> },
          { id: 'yard', label: t('starter.deck.yard'), icon: <Icon id="i-fleet" className="size-4 shrink-0 text-v2-self" /> },
          ...(vessel.features.includes('research') ? [{ id: 'research' as const, label: t('starter.deck.research'), icon: <Icon id="i-spark" className="size-4 shrink-0 text-v2-crystal" /> }] : []),
        ]}
        value={value}
        onChange={onChange}
        tabId={deck => `ship-deck-${deck}`}
      />
    </div>
  );
}

/**
 * THE SHIP, WHERE A PLANET HAS ITS BASE. Plan §3.7, redrawn from the owner's mocks of 2026-11-04.
 *
 * The ship, how far it is from the jump, its five systems, one repair at a time. A screen to fall for
 * the ship on, not a list to work through. Nothing says "level": the stage feeds the main rules and
 * the player reads "Repair 3/4", since Refinery 4 aboard and Refinery 2 on the first planet would read
 * as a punishment.
 */
export function VesselScreen({ vessel, fetchedAt, focusGroup, focusItem }: {
  vessel: VesselView;
  fetchedAt: number;
  /** What the screen was opened for, in the main Base's words: readying a defence or reaching for ships is the yard. */
  focusGroup?: string;
  focusItem?: string;
}) {
  const { t } = useTranslation();
  const say = useToast();
  const repair = useRepairVessel();
  const openCrates = useOpenCrates();
  const view = useMemo(() => vesselToPlanetView(vessel), [vessel]);
  const held = useProjected(view.planet, fetchedAt);
  const progress = progressOf(vessel);
  const ahead = afterQueue(progress, queuedSteps(vessel));
  const [system, setSystem] = useState<VesselSystem>(() => nextRequiredStep(progress, queuedSteps(vessel))?.step.system ?? 'REFINERY');
  const [picked, setPicked] = useState<RepairStep | null>(null);
  const [jumping, setJumping] = useState<MigrationView | null>(null);
  const [deck, setDeck] = useState<ShipDeck>('repairs');
  const decks = vessel.features.includes('fleet');
  const wantsYard = focusGroup === 'defend' || focusGroup === 'reach';
  useEffect(() => { if (wantsYard && decks) setDeck('yard'); }, [wantsYard, decks]);
  // The handover is about the ship: it is shown, whichever deck the first ship was built from.
  const lesson = useStarterLesson();
  const handingOver = lesson?.kind === 'step' && lesson.id === 'farewell';
  useEffect(() => { if (handingOver) setDeck('repairs'); }, [handingOver]);
  const sky = useMainSky(true);
  const select = (next: VesselSystem): void => { setSystem(next); setPicked(null); };
  const context: RepairContext = {
    now: progress,
    ahead,
    held,
    income: { alloyPerHour: view.planet.alloyPerHour, crystalPerHour: view.planet.crystalPerHour },
    queueFull: repairs(vessel).length >= STARTER.queues.construction,
    busy: repair.isPending,
    queue: repairs(vessel),
    order: (step) => {
      repair.mutate({ module: step.module, stage: step.stage }, {
        onSuccess: () => { setPicked(null); say(t('starter.ordered', { name: moduleName(step.module) })); },
        onError: (error) => { say(describe(error), 'error'); },
      });
    },
  };
  // A finished system still shows its last machine, standing repaired.
  const shown = picked ?? cardStep(system, ahead, queuedSteps(vessel)) ?? systemSteps(system).at(-1);
  const percent = Math.round(vessel.progress.share * 100);
  if (deck !== 'repairs') {
    return (
      <div className="flex min-h-full flex-col gap-2 bg-gradient-to-b from-v2-void to-v2-panel pb-2.5 font-v2-ui">
        <DeckSwitch vessel={vessel} value={deck} onChange={setDeck} />
        {deck === 'yard' ? <YardDeck vessel={vessel} view={view} fetchedAt={fetchedAt} focusDock={focusItem === REPAIR_STATION_ITEM} /> : <div className="px-3"><ResearchPanel /></div>}
      </div>
    );
  }
  return (
    <div className="flex min-h-full flex-col gap-1.5 bg-gradient-to-b from-v2-void to-v2-panel pb-2 font-v2-ui">
      <DeckSwitch vessel={vessel} value={deck} onChange={setDeck} />
      <ShipHero id={vessel.id} progress={progress} selected={system} onSelect={select} compact={decks} />
      {/* Who this ship is and how far it has come: the mock's frame, with this ship's own silhouette on it. */}
      <div className="relative z-10 -mt-3 mx-3 flex items-center gap-2 rounded-control border border-v2-line bg-v2-panel/70 px-2 py-1">
        <img src={heroArt(vesselHull(vessel.id), vesselLook(progress))} alt="" draggable={false} className="h-7 w-11 shrink-0 object-cover [mask-image:radial-gradient(closest-side,#000_60%,transparent)]" />
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline justify-between gap-2 leading-tight">
            <span data-testid="ship-name" className="min-w-0 truncate text-caption font-semibold text-v2-ink">{vessel.name}</span>
            <span data-testid="ship-repair" className="shrink-0 text-micro text-v2-ink-2">{t('starter.readyLabel')} <span className="font-v2-mono font-semibold text-v2-self">{percent}%</span></span>
          </p>
          <span className="mt-1 block h-1.5 overflow-hidden rounded-full border border-v2-line-hi bg-v2-void">
            <span className="block h-full rounded-full bg-v2-self shadow-[0_0_8px_var(--color-v2-self)]" style={{ width: `${String(percent)}%` }} />
          </span>
        </div>
        <span aria-hidden="true" className="text-micro text-v2-ink-2">›</span>
        <span aria-label={t('starter.mainRow.legFuel')} className="flex shrink-0 flex-col items-center text-v2-crystal"><Icon id="m-recover" className="size-4"/><span className="font-v2-mono text-micro">{vessel.fuel}/{vessel.jumpFuel}</span></span>
        <span aria-hidden="true" className="text-micro text-v2-ink-2">›</span>
        <img src="/assets/images/starter/galaxy-badge.webp" alt={t('starter.visual.galaxy')} draggable={false} className="h-7 w-9 shrink-0 object-cover mix-blend-screen [mask-image:radial-gradient(closest-side,#000_55%,transparent)]" />
      </div>
      {/* The goal is said while the ship is all there is. Once the Shipyard works, the room goes to the decks. */}
      {!decks && <p data-testid="ship-goal" className="-mt-1 px-3 text-micro leading-snug text-v2-ink-3">{t('starter.goal')}</p>}
      {/* Below the ship's own strip, which tucks under the hero (owner playtest 2026-11-07: a card between
          them was overlapped), and on the screen's one inset, as every other block is. */}
      <div className="px-3 empty:hidden"><UnlockMoment vessel={vessel} /></div>
      <QuietNotice vessel={vessel} />
      <div className="px-3 empty:hidden"><CrateBay crates={vessel.crates} onOpen={() => { openCrates.mutate(undefined, { onError: (error) => { say(describe(error), 'error'); } }); }} /></div>
      <StarterWaitLine queue={vessel.queue} />
      <SystemTabs progress={progress} ahead={ahead} selected={system} onSelect={select} />
      {shown && <RepairCard shown={shown} system={system} context={context} onShow={setPicked} />}
      {system === 'DRIVE' && <MigrationPanel vessel={vessel} onJump={setJumping} />}
      {jumping && (
        <LandingChoice
          view={jumping}
          onCancel={() => { setJumping(null); }}
          onLanded={(landing) => {
            setJumping(null);
            // The scene plays from what this client already holds; the ship's picture needs no more reads.
            startJump({ shardName: landing.placement.shardName, hull: vesselHull(vessel.id), look: vesselLook(progress), sky: sky.data?.points ?? [], landing, start: 0 });
          }}
        />
      )}
      <div className="mt-auto v2-split:mt-1">
        <RepairSlots
          orders={view.queues?.CONSTRUCTION ?? []}
          queue={repairs(vessel)}
          addLabel={shown ? `${t('starter.repair')}: ${moduleName(shown.module)}` : t('starter.repair')}
          onAdd={shown && canOrder(shown, context) ? () => { context.order(shown); } : null}
        />
      </div>
    </div>
  );
}
