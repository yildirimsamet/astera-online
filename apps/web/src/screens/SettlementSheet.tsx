import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MULTI_WORLD, distance, fleetTravelExact, honorFuelCost, missionFuel } from '@astera/rules';
import type { CapsuleIdView, GalaxyPlanet, PlanetView } from '../api/schemas.js';
import { capsuleChoices } from '../lib/synthesis.js';
import { CapsuleRow } from '../ui/CapsuleRow.js';
import { full } from '../lib/format.js';
import { flightModifiers } from '../lib/navigation.js';
import { launchFault } from '../lib/faults.js';
import { countdown, duration } from '../lib/time.js';
import type { CSSProperties } from 'react';
import { CostLine, GameHold, Glyph } from '../game-ui/index.js';
import { Sheet } from '../v2/kit/Sheet.js';

/**
 * Settlement is an irreversible launch into a public race. The focus rail
 * explains how to get here; this sheet says exactly what leaves, what it costs,
 * when it arrives and what happens if somebody else wins first.
 *
 * ON THE KIT (G4-g, 2026-11-15): the race leads in a well — its rule, then a line from now to
 * the race's end with where the Couriers land on it (and where my own hour ends), so the
 * player sees whether they land in time; what leaves in the store's own pictures; the two
 * endings as two lines; the launch on the kit's final hold, 1.5 s.
 */
export function SettlementSheet({
  target,
  planet,
  now,
  pending,
  onClose,
  onConfirm,
  capsuleStock = null,
}: {
  target: GalaxyPlanet;
  planet: PlanetView;
  now: number;
  pending: boolean;
  onClose: () => void;
  /** The capsules the Couriers wear: Optik Örtü or nothing (plan 2026-11-24 §3.5). */
  onConfirm: (capsules: CapsuleIdView[]) => void;
  /** Sentez capsules held, or null where the galaxy has no laboratory. */
  capsuleStock?: Record<CapsuleIdView, number> | null;
}) {
  const { t } = useTranslation();
  const launchBlocked = launchFault(planet.faults, 'fleet') !== null;
  const fleet = { COURIER: MULTI_WORLD.settlement.transports } as const;
  const [capsules, setCapsules] = useState<CapsuleIdView[]>([]);
  const wearing = capsuleStock ? capsuleChoices('settlement', fleet, capsuleStock)
    .filter((one) => one.enough && capsules.includes(one.id)).map((one) => one.id) : [];
  const span = distance(planet.planet.position, target.position);
  /*
    THE COMMANDER'S LADDER, AND DELIBERATELY NOT THEIR BEACON. D180.

    `launchSettlement` on the server passes `{ boost: 1, tech }` — real research,
    no Beacon — so this quotes the same. The asymmetry with every other lane
    (a transfer and a raid both take the Beacon) is the SERVER's, and it is
    mirrored here rather than corrected here: a preview that disagreed with the
    launch would be the bug this whole change exists to remove. If that boost is
    wrong it is wrong in `movement.ts`, and this line moves when that one does.
  */
  const travelMinutes = fleetTravelExact(
    span, fleet, { boost: 1, tech: flightModifiers(planet).tech },
  );
  const fuel = honorFuelCost(missionFuel(fleet, span, 1), planet.honorBenefits);
  const closesIn = Math.max(0, (target.neutral?.claimUntil?.getTime() ?? now) - now);
  /*
    THE RAIDER'S OWN HOUR (owner, 2026-10-07). Inside it nobody else may land, so a raider
    whose Couriers touch down before it ends is not in a race at all — and one who lands
    after it is, from that instant. Strictly before: a landing ON the hour's end ties with
    anyone else's.
  */
  const priorityUntil = target.neutral?.claimPriorityUntil?.getTime() ?? 0;
  const ownHour = target.claimPriorityMine === true && priorityUntil > now;
  const raceLine = !ownHour
    ? 'focus.planet.settlementConfirm.race'
    : now + travelMinutes * 60_000 < priorityUntil
      ? 'focus.planet.settlementConfirm.priorityMineFirst'
      : 'focus.planet.settlementConfirm.priorityMineLate';
  const tier = target.neutral?.tier;
  const opening = tier === undefined ? null : MULTI_WORLD.neutral[tier].captureStock;

  const arrivalMs = travelMinutes * 60_000;
  const priorityMs = ownHour ? priorityUntil - now : null;
  // The line runs to whichever comes last, so a landing after the race's end still sits on it.
  const lineMs = Math.max(closesIn, arrivalMs, priorityMs ?? 0, 1);
  const at = (ms: number): CSSProperties => ({ width: `${String(Math.min(100, Math.max(1.5, (ms / lineMs) * 100)))}%` });
  const tone = !ownHour ? undefined : raceLine === 'focus.planet.settlementConfirm.priorityMineFirst' ? 'self' : 'warn';
  const arrives = duration(travelMinutes);
  const closes = countdown(closesIn);
  const priority = priorityMs === null ? null : countdown(priorityMs);
  const charge = MULTI_WORLD.settlement.charge;

  return (
    <Sheet
      detents={['full']}
      kit={{ tone: 'self' }}
      eyebrow={t('focus.planet.settlementConfirm.eyebrow')}
      // The verb is the hold's; the head names the world the race is for.
      title={target.intel === 'UNKNOWN' ? t('focus.planet.settlementConfirm.unsurveyedTitle') : target.name}
      onClose={onClose}
      footer={
        <div className="gk gk-launch__commit">
          {/* A launch that cannot be called back: the kit's final weight, 1.5 s (B9, K4). */}
          <GameHold
            weight="final"
            glyph="colony"
            label={t('focus.planet.settlementConfirm.confirm')}
            disabledReason={launchBlocked
              ? t('faults.launchBlock.SHIPYARD_REVOLT')
              : pending ? t('focus.planet.settlementConfirm.confirming') : null}
            onCommit={() => { onConfirm(wearing); }}
          />
        </div>
      }
    >
      {/* The race and whether I land in time, before any figure: this is what the press decides. */}
      <section data-race className="gk-well gk-race" {...(tone ? { 'data-tone': tone } : {})}>
        <p className="gk-race__lead"><Glyph id="flag" />{t(raceLine)}</p>
        <div className="gk-race__line" role="img" aria-label={priority === null
          ? t('focus.planet.settlementConfirm.line', { arrives, closes })
          : t('focus.planet.settlementConfirm.linePriority', { arrives, priority, closes })}>
          <span data-part="arrival" className="gk-race__run" style={at(arrivalMs)}><Glyph id="colony" /></span>
          {priorityMs !== null && <span data-part="priority" className="gk-race__mark" style={at(priorityMs)} />}
        </div>
        <dl className="gk-race__ends">
          <div><dt className="gk-label">{t('focus.planet.settlementConfirm.arrives')}</dt><dd className="gk-num">{arrives}</dd></div>
          {priority !== null && (
            <div data-end="priority"><dt className="gk-label">{t('focus.planet.settlementConfirm.priorityEnds')}</dt><dd className="gk-num">{priority}</dd></div>
          )}
          <div data-end="close"><dt className="gk-label">{t('focus.planet.settlementConfirm.closes')}</dt><dd className="gk-num">{closes}</dd></div>
        </dl>
        <p className="gk-sub gk-race__fixed"><Glyph id="lock" />{t('focus.planet.settlementConfirm.noRecall')}</p>
      </section>

      {/* The veil takes the Couriers off every rival's map: the race does not see them coming. */}
      {capsuleStock && <CapsuleRow kind="settlement" fleet={fleet} held={capsuleStock} chosen={capsules} onChange={setCapsules} />}

      {/* What leaves, in the store's own pictures; what the store cannot pay yet wears the warning. */}
      <dl className="gk-well gk-figures gk-figures--well">
        <div className="gk-figure">
          <dt className="gk-label">{t('focus.planet.settlementConfirm.transports')}</dt>
          <dd className="gk-num gk-figure__value">{String(MULTI_WORLD.settlement.transports)}</dd>
        </div>
        {/*
          ONE COST AND ONE OPENING. D209, owner instruction.
          The cargo and the fee used to be two rows because the cargo landed as the
          colony's stock. Nothing lands now: the whole charge is spent on success and
          the world opens on its tier's `captureStock`, which is only stated for a
          tier this commander can actually read.
        */}
        <div className="gk-figure">
          <dt className="gk-label">{t('focus.planet.settlementConfirm.foundingCost')}</dt>
          <dd className="gk-figure__value">
            <span className="sr-only">{t('focus.planet.settlementConfirm.cargoValue', { alloy: full(charge.alloy), crystal: full(charge.crystal) })}</span>
            <span aria-hidden><CostLine cost={charge} held={planet.planet} /></span>
          </dd>
        </div>
        <div className="gk-figure">
          <dt className="gk-label">{t('focus.planet.settlementConfirm.fuel')}</dt>
          <dd className="gk-figure__value">
            <CostLine cost={{ alloy: 0, crystal: 0, deuterium: fuel }} held={planet.planet} />
            {(planet.honorBenefits?.fuelPct ?? 0) > 0 && (
              <span className="gk-sub" data-tone="hostile" data-honor-fuel-penalty>
                {` · ${t('honorBenefits.fuel')} +${String(planet.honorBenefits!.fuelPct)}%`}
              </span>
            )}
          </dd>
        </div>
      </dl>

      {/* Both endings before the press: what the win opens with, what the loss gives back. */}
      <ul className="gk-endings">
        <li data-ending="win" className="gk-ending" data-tone="self">
          <span className="gk-label">{t('focus.planet.settlementConfirm.ifWin')}</span>
          {opening ? (
            <span className="gk-ending__body">
              <span className="gk-sub">{t('focus.planet.settlementConfirm.winSpent')}</span>
              <span className="sr-only">{t('focus.planet.settlementConfirm.stockValue', {
                alloy: full(opening.alloy), crystal: full(opening.crystal), deuterium: full(opening.deuterium),
              })}</span>
              <span aria-hidden><CostLine cost={opening} /></span>
            </span>
          ) : <span className="gk-sub gk-ending__body">{t('focus.planet.settlementConfirm.winUnread')}</span>}
        </li>
        <li data-ending="loss" className="gk-ending" data-tone="warn">
          <span className="gk-label">{t('focus.planet.settlementConfirm.ifLose')}</span>
          <span className="gk-sub gk-ending__body">{t('focus.planet.settlementConfirm.loseBack')}</span>
        </li>
      </ul>
    </Sheet>
  );
}
