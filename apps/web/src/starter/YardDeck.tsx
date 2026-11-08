import { HULLS, STARTER, dockBill, hangarLoad, hullBulk, type CombatClass, type HullId } from '@astera/rules';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCancelBuildOrder, useIntel, useStartRepair } from '../api/queries.js';
import type { BuildOrderView, IntelView, PlanetView } from '../api/schemas.js';
import type { VesselView } from '../api/starterSchemas.js';
import { combatClassLabel, hullLabel, hullPitch, hullTag } from '../i18n/names.js';
import { full } from '../lib/format.js';
import { haptic } from '../lib/haptics.js';
import { namedWall } from '../lib/matchup.js';
import { orderMinutes } from '../lib/orderTime.js';
import { projectedQueueState } from '../lib/predict.js';
import { useProjected, type Projected } from '../lib/projection.js';
import { roomParts } from '../lib/room.js';
import { durationPrecise, useNow } from '../lib/time.js';
import { BuildSheet } from '../screens/PlanetScreen.js';
import { HULL_ART } from '../ui/assets.js';
import { MatchupMark } from '../ui/CounterMark.js';
import { describe as describeError, useToast } from '../ui/Toast.js';
import { UpgradeRow } from '../ui/UpgradeRow.js';
import { ClassEmblem } from '../v2/kit/ClassEmblem.js';
import { Cost } from '../v2/kit/Cost.js';
import { QueueLane, orderLeft } from '../v2/kit/QueueLane.js';
import { QueueSheet } from '../v2/kit/QueueSheet.js';
import { RoomBar } from '../v2/kit/RoomBar.js';
import { ATMOSPHERE } from '../ui/atmosphere.js';
import { AtmosphereImage } from '../ui/AtmosphereArt.js';

/** The Station as a ship has it: one job, everything hurt at home, and no lots to sort through. */
function ShipDock({ vessel, orders, held, focus }: { vessel: VesselView; orders: readonly BuildOrderView[]; held: Projected; focus: boolean }) {
  const { t } = useTranslation();
  const self = useRef<HTMLElement>(null);
  // It sits below the hulls: whoever came for the station should not have to look for it.
  useEffect(() => { if (focus) self.current?.scrollIntoView({ block: 'center' }); }, [focus]);
  const say = useToast();
  const now = useNow();
  const start = useStartRepair();
  const running = orders[0];
  const hurt = vessel.damage.reduce((sum, lot) => sum + lot.count, 0);
  const bill = dockBill(vessel.damage);
  const canPay = bill.cost.alloy <= held.alloy && bill.cost.crystal <= held.crystal && bill.cost.deuterium <= held.deuterium;
  return (
    <section ref={self} data-testid="ship-dock" className="scene-panel repair-scene relative overflow-hidden rounded-control border border-v2-line bg-v2-panel p-2.5">
      <AtmosphereImage art={ATMOSPHERE.repair} />
      <div className="relative flex flex-col gap-1.5">
        <p className="flex items-baseline justify-between gap-2">
          <span className="text-caption font-semibold text-v2-ink">{t('repairStation.title')}</span>
          {running && <span data-testid="dock-clock" className="font-v2-mono text-micro text-v2-self">{orderLeft(running, now)}</span>}
        </p>
        <p className="text-micro leading-snug text-v2-ink-2">{t('starter.yard.dockRule', { percent: STARTER.repair.pct })}</p>
        {!running && hurt > 0 && (
          <>
            <p className="flex items-center justify-between gap-2">
              <span data-testid="dock-hurt" className="text-micro font-semibold text-v2-warn">{t('starter.yard.dockHurt', { count: hurt })}</span>
              <span data-testid="dock-bill" className="flex items-center gap-2">
                <Cost cost={bill.cost} held={held} />
                <span className="font-v2-mono text-micro text-v2-ink-2">{durationPrecise(bill.minutes)}</span>
              </span>
            </p>
            <button
              type="button"
              disabled={!canPay || start.isPending}
              onClick={() => {
                start.mutate({ planetId: vessel.id, request: { all: true } }, {
                  onSuccess: () => { say(t('repairStation.started')); },
                  onError: (error) => { say(describeError(error), 'error'); },
                });
              }}
              className="min-h-9 rounded-control bg-v2-self px-3 text-caption font-semibold text-v2-self-ink disabled:bg-v2-raise disabled:text-v2-ink-3"
            >
              {canPay ? t('starter.yard.dockGo', { count: hurt }) : t('itemSheet.short')}
            </button>
          </>
        )}
        {!running && hurt === 0 && <p className="text-micro text-v2-ink-3">{t('repairStation.idle')}</p>}
      </div>
    </section>
  );
}

interface Target { id: string; name: string; wall: CombatClass }

/** What the probes have read a class for, still where they read it: the latest first. */
function targetsOf(intel: IntelView | undefined): Target[] {
  return (intel?.probeReports ?? [])
    .filter(report => report.spatiallyCurrent !== false)
    .toSorted((a, b) => b.at.getTime() - a.at.getTime())
    .flatMap(report => {
      const wall = namedWall(report.classReading);
      return wall ? [{ id: report.targetPlanetId, name: report.targetName, wall }] : [];
    });
}

/**
 * THE TARGET THE YARD BUILDS FOR (plan §5.5, F4c): each probed target with the class its guard is
 * mostly, one tap apart, so the two roads of the first hunt can be weighed on the same cards.
 */
function TargetPicker({ targets, picked, onPick }: { targets: readonly Target[]; picked: Target; onPick: (id: string) => void }) {
  const { t } = useTranslation();
  return (
    <div data-testid="yard-target" className="flex items-center gap-2">
      <span className="v2-legend shrink-0">{t('starter.yard.against')}</span>
      <div className="flex min-w-0 gap-1.5 overflow-x-auto">
        {targets.map(target => (
          <button
            key={target.id}
            type="button"
            aria-pressed={target.id === picked.id}
            onClick={() => { haptic('tap'); onPick(target.id); }}
            className={`flex min-h-8 shrink-0 items-center gap-1.5 rounded-control border px-2.5 text-caption ${target.id === picked.id ? 'border-v2-hostile/60 bg-v2-hostile/10 font-semibold text-v2-ink' : 'border-v2-line bg-v2-void/50 text-v2-ink-2'}`}
          >
            <ClassEmblem cls={target.wall} decorative className="size-3 shrink-0" />
            {target.name}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * THE YARD, ON THE SHIP. Plan §3.7. The main game's rows and its build sheet, narrowed to the five
 * hulls this galaxy builds: same prices, same class chips, same order form, so nothing has to be
 * learned twice. What the list leaves out is what the main yard is for later.
 */
export function YardDeck({ vessel, view, fetchedAt, focusDock = false }: { vessel: VesselView; view: PlanetView; fetchedAt: number; focusDock?: boolean }) {
  const { t } = useTranslation();
  const say = useToast();
  const now = useNow();
  const held = useProjected(view.planet, fetchedAt);
  const cancel = useCancelBuildOrder();
  const [building, setBuilding] = useState<HullId | null>(null);
  const [queueOpen, setQueueOpen] = useState(false);
  const yard = view.queues?.YARD ?? [];
  const room = roomParts(view, false);
  const committed = hangarLoad(projectedQueueState(view, 'YARD').units);
  const income = { alloyPerHour: view.planet.alloyPerHour, crystalPerHour: view.planet.crystalPerHour };
  const targets = targetsOf(useIntel().data);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const target = targets.find(each => each.id === pickedId) ?? targets[0];
  return (
    <div className="flex flex-col gap-2.5 px-3 pb-3">
      <div data-testid="yard-room">
        <RoomBar label={t('roomBar.hangar')} total={room.total} home={room.home} away={room.away} queued={room.queued} />
      </div>
      {target && <TargetPicker targets={targets} picked={target} onPick={setPickedId} />}
      {yard.length > 0 && <QueueLane label={t('starter.yard.queue')} orders={yard} now={now} onOpen={() => { setQueueOpen(true); }} />}
      <div className="grid grid-cols-2 gap-2 v2-split:grid-cols-3">
        {STARTER.hulls.map(id => {
          const spec = HULLS[id];
          const home = view.fleet[id] ?? 0;
          const full_ = committed + hullBulk(id) > room.total;
          const queueFull = yard.length >= STARTER.queues.yard;
          return (
            <div key={id} data-testid="yard-hull" data-hull={id} className="relative">
              <UpgradeRow
                layout="card"
                summary="hull"
                art={HULL_ART[id]}
                name={hullLabel(id)}
                nameBadge={<span data-class={spec.cls} aria-hidden="true" title={combatClassLabel(spec.cls)}><ClassEmblem cls={spec.cls} decorative /></span>}
                nameAside={t('planet.reach.hullLocationCounts', { home, away: 0 })}
                tag={hullTag(id)}
                role={hullPitch(id)}
                cost={{ alloy: spec.alloy, crystal: spec.crystal, deuterium: spec.deuterium }}
                held={held}
                income={income}
                takes={orderMinutes('HULL', spec, view, 1, { hull: id })}
                unowned={home === 0}
                {...(full_ ? { completed: t('planet.capacity.hangarFull', { used: committed, total: room.total }) } : {})}
                {...(queueFull ? { blocked: { reason: t('planet.blocked.queueFull') } } : {})}
                verb="build"
                onOpen={() => { setBuilding(id); }}
                onAct={() => { setBuilding(id); }}
              />
              {/* How this hull meets the picked target's guard, on its picture; it turns over with the target. */}
              {target && spec.cls !== 'SUPPORT' && (
                <span key={target.id} className="pop pointer-events-none absolute right-1.5 top-1.5 z-20 rounded-chip border border-v2-line-hi bg-v2-deep/85 px-1 py-px">
                  <MatchupMark attacker={spec.cls} defender={target.wall} />
                </span>
              )}
            </div>
          );
        })}
      </div>
      {vessel.features.includes('fleet') && <ShipDock vessel={vessel} orders={view.queues?.REPAIR ?? []} held={held} focus={focusDock} />}
      {building && <BuildSheet hull={building} planet={view} held={held} onNeed={() => { setBuilding(null); }} onClose={() => { setBuilding(null); }} />}
      {queueOpen && (
        <QueueSheet
          queues={{ CONSTRUCTION: [], YARD: [...yard] }}
          now={now}
          {...(cancel.isPending ? { cancelling: cancel.variables } : {})}
          onCancel={(order) => {
            cancel.mutate(order.id, {
              onSuccess: (result) => { say(t('planet.queue.cancelled', { alloy: full(result.refund.alloy), crystal: full(result.refund.crystal), deuterium: full(result.refund.deuterium) })); },
              onError: (error) => { say(describeError(error), 'error'); },
            });
          }}
          onClose={() => { setQueueOpen(false); }}
        />
      )}
    </div>
  );
}
