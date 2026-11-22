import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  HULLS,
  TRANSFER_CARGO_HULLS,
  fleetCargo,
  transferReturningFleet,
  transferStayingFleet,
  allowedPaces,
  distance,
  missionFuel,
  fleetCount,
  splitHealthFleet,
  partitionCombatFleet,
  combatValue,
  garrisonOf,
  fleetTravelExact,
  hangarCapacity,
  hangarLoad,
  resourcesTotal,
  type Fleet,
  type HullId,
  type MissionPace,
  type Vec3,
  type TransferReturnPlan,
} from '@astera/rules';
import { useGalaxy, useTransfer } from '../api/queries.js';
import { OriginBodyPicker, TargetBodyPicker } from './MoonControls.js';
import {
  lethalAfterRefusal, radiationRefusalCount, routeRadiation, transferHpRadiation, toHpRadiationSources, toRadiationSources, type RadiationRefusal,
} from '../lib/radiation.js';
import type { PlanetView } from '../api/schemas.js';
import { hullName } from '../i18n/names.js';
import { compact, full } from '../lib/format.js';
import { clockTime, duration, useNow } from '../lib/time.js';
import { HULL_ART, RESOURCE_ART } from '../ui/assets.js';
import { PaceRow } from '../ui/PaceRow.js';
import { QuantityStepper } from '../ui/QuantityStepper.js';
import { RadiationPreview } from '../ui/RadiationPreview.js';
import { SpendBar } from '../ui/SpendBar.js';
import { HullMark } from '../ui/icons/hulls.js';
import { flightModifiers } from '../lib/navigation.js';
import { launchFault } from '../lib/faults.js';
import { serverNow } from '../lib/clock.js';
import { Choices, GameHold, Glyph, InfoPeek, RoomGauge, SectionTag, Slider } from '../game-ui/index.js';
import { Sheet } from '../v2/kit/Sheet.js';
import { describe, useToast } from '../ui/Toast.js';
import { sumFleets } from '../lib/fleetPage.js';
import { readTransferReturnPlan, rememberTransferReturnPlan } from '../lib/transferChoice.js';

const MOVABLE = (Object.keys(HULLS) as HullId[]).filter(
  (id) => !HULLS[id].ground && id !== 'PROSPECTOR',
);
/** The dedicated transport group; other mobile hulls may still have cargo space. */
const IS_HAULER = (id: HullId): boolean =>
  (TRANSFER_CARGO_HULLS as readonly HullId[]).includes(id);
const RESOURCE_ORDER = ['alloy', 'crystal', 'deuterium'] as const;

/**
 * A part's share of a whole, clamped, with an empty origin drawing nothing.
 *
 * A world whose every craft is already away has no firepower at all, and
 * dividing by it would put `NaN%` into a style attribute.
 */
const share = (part: number, whole: number): number =>
  whole <= 0 ? 0 : Math.max(0, Math.min(100, (part / whole) * 100));

function fitCargo(
  cargo: Record<(typeof RESOURCE_ORDER)[number], number>,
  capacity: number,
): typeof cargo {
  const total = resourcesTotal(cargo);
  if (total <= capacity) return cargo;
  if (capacity <= 0) return { alloy: 0, crystal: 0, deuterium: 0 };
  const ratio = capacity / total;
  const fitted = {
    alloy: Math.floor(cargo.alloy * ratio),
    crystal: Math.floor(cargo.crystal * ratio),
    deuterium: Math.floor(cargo.deuterium * ratio),
  };
  let spare = capacity - resourcesTotal(fitted);
  for (const resource of RESOURCE_ORDER) {
    const add = Math.min(spare, cargo[resource] - fitted[resource]);
    fitted[resource] += add;
    spare -= add;
  }
  return fitted;
}

/**
 * HOW MUCH OF ONE STORE THIS MISSION MAY CARRY. Owner instruction.
 *
 * Three limits meet on the deuterium slider and only two of them were in it: the
 * store itself, the room left in the hold — and THE FLIGHT. Deuterium is the one
 * resource that is both cargo and fuel, the server's guard is on the sum, and the
 * screen used to run the slider to the last drop in the tank and let the commander
 * discover the third limit by overshooting it. A ceiling that has the launch
 * already subtracted is the rule made visible in the control, which is I1 and I2:
 * a max button that hands back a load the server will refuse is not a max.
 *
 * ALLOY AND CRYSTAL DO NOT FLY THE SHIP, so nothing comes off theirs.
 */
export function loadCeiling(
  resource: (typeof RESOURCE_ORDER)[number],
  { stock, capacity, otherCargo, fuel }: {
    stock: number;
    capacity: number;
    /** What the other two stores have already taken out of the hold. */
    otherCargo: number;
    /** What this exact fleet burns over this exact distance, in deuterium. */
    fuel: number;
  },
): number {
  const store = resource === 'deuterium' ? stock - fuel : stock;
  return Math.max(0, Math.floor(Math.min(store, capacity - otherCargo)));
}

/**
 * WHERE THE CARGO IS GOING, IN THE THREE FIELDS THIS SHEET ACTUALLY USES.
 *
 * It used to take a whole `GalaxyPlanet`, which is a row off the PUBLIC disc
 * projection — and that made a transfer between two of the commander's OWN worlds
 * depend on the fogged, cached, shared view of the galaxy for an id, a name and a
 * position it already holds privately. Owner report: pressing "send here" on a
 * freshly settled colony closed the worlds sheet and opened nothing, because the
 * disc projection had not yet learned the world existed.
 *
 * Narrowing the prop is the fix rather than a workaround: the caller can now build
 * this from `/api/planets`, which is uncached and authoritative for worlds you
 * control, and the sheet stops caring which of the two payloads it came from.
 */
export interface TransferTarget {
  id: string;
  name: string;
  position: Vec3;
}

export function TransferSheet({
  target,
  targetPlanet,
  planet,
  onClose,
  onLaunched,
}: {
  target: TransferTarget;
  /** Full private view of this owned destination, when already loaded. */
  targetPlanet?: PlanetView;
  planet: PlanetView;
  onClose: () => void;
  onLaunched: () => void;
}) {
  const { t } = useTranslation();
  const say = useToast();
  // Both route ends travel explicitly; target focus and later world selection
  // must never change the source of an already-open transfer picker.
  const transfer = useTransfer(planet.planet.id);
  const [originBody, setOriginBody] = useState<'PLANET' | 'MOON'>('PLANET');
  const [targetBody, setTargetBody] = useState<'PLANET' | 'MOON'>('PLANET');
  const hasOriginMoonShips = fleetCount(planet.moon?.fleet ?? {}) > 0;
  const launchBlocked = launchFault(planet.faults, 'fleet') !== null;
  /**
   * THE FIVE MINUTES AFTER A SQUADRON LANDED HERE. Faz 2A.3.
   *
   * Read on the sheet rather than discovered on commit. The pause fires at exactly the moment a
   * commander is in a hurry — a raid is inbound and they are trying to move the fleet — and a rule
   * they can only learn by losing that attempt to it is not a rule they can plan around.
   *
   * AGAINST A TICKING CLOCK, NOT THE FIELD'S PRESENCE. The server sends null once the pause has
   * passed — but only on a fresh read, and nothing refetches the planet at that instant, so a
   * sheet that treated "the field is set" as the lock stayed locked after the five minutes were
   * over (review 2026-09-22, #4). The clock only ticks each second while there is a pause to count.
   */
  const cooldownUntil = planet.planet.transferReadyAt ?? null;
  const now = useNow(cooldownUntil === null ? 60_000 : 1_000);
  const cooling = cooldownUntil !== null && cooldownUntil.getTime() > now;
  const [fleet, setFleet] = useState<Fleet>({});
  const [cargo, setCargo] = useState({ alloy: 0, crystal: 0, deuterium: 0 });
  const [cargoAdjustment, setCargoAdjustment] = useState<{ before: number; after: number } | null>(null);
  const [returnPlan, setReturnPlan] = useState<TransferReturnPlan>(readTransferReturnPlan);
  /**
   * THE ORIGIN'S OWN MODIFIERS — the ladder and the Beacon. D180.
   *
   * `capacity` moves with `CARGO_HOLDS` and the ETA moves with `SHIP_PROPULSION`;
   * both were quoting a commander who had bought neither, and the server has always
   * applied both. One value so a screen cannot pick up one and miss the other.
   */
  const mods = flightModifiers(planet);
  const capacity = fleetCargo(fleet, mods.tech);
  const loaded = resourcesTotal(cargo);
  const ownsHold = fleetCargo(planet.fleet, mods.tech) > 0;
  const returningFleet = transferReturningFleet(fleet, returnPlan);
  const selectedHealth = useMemo(() => {
    try { return splitHealthFleet(planet.fleet, planet.fleetDamage, fleet); }
    catch (error) { if (!(error instanceof RangeError)) throw error; return null; }
  }, [planet.fleet, planet.fleetDamage, fleet]);
  const stayingFleet = transferStayingFleet(fleet, returningFleet);
  const remainingFleet = useMemo<Fleet>(() => Object.fromEntries(
    (Object.keys(planet.fleet) as HullId[]).map((id) => [
      id,
      Math.max(0, (planet.fleet[id] ?? 0) - (fleet[id] ?? 0)),
    ]),
  ), [fleet, planet.fleet]);
  // Firepower, the one force unit the launch sheet and a probe use. D199.
  const homeDefence = combatValue(garrisonOf(selectedHealth
    ? partitionCombatFleet(selectedHealth.remaining, selectedHealth.remainingDamage).eligible : remainingFleet, planet.ground));
  /** What the origin holds before anything is packed, so the bar has a whole. */
  const defencePowerNow = combatValue(garrisonOf(partitionCombatFleet(planet.fleet, planet.fleetDamage).eligible, planet.ground));
  /** The one distance this sheet is about: the ETA, the fuel and the trim share it. */
  const span = distance(planet.planet.position, target.position);
  /**
   * HOW FAST THIS TRANSFER FLIES. Plan §15.5a, review 2026-09-22 #1.
   *
   * The server has taken a pace on this lane since Faz 2A; the sheet never offered one, so the
   * launch most likely to WANT a slow flight — a fleetsave, ships kept in the air until a raid has
   * passed — was the one that could not be slowed. Held as the player's wish and narrowed to what
   * this wing may legally fly, falling back to full speed rather than refusing.
   */
  const [wantedPace, setWantedPace] = useState<MissionPace>(1);
  const paces: readonly MissionPace[] = fleetCount(fleet) > 0 ? allowedPaces(span, fleet, mods) : [1];
  const pace = paces.includes(wantedPace) ? wantedPace : 1;
  const eta = useMemo(
    () => fleetCount(fleet) > 0 ? fleetTravelExact(span, fleet, { ...mods, pace }) : 0,
    [fleet, span, mods, pace],
  );
  // The group ordered home flies back at the transfer's pace (owner, 2026-10-06).
  const returnMinutes = fleetCount(returningFleet) > 0
    ? fleetTravelExact(span, returningFleet, { ...mods, pace }) : 0;
  /**
   * RADYASYON ON THE WAY OUT, quoted before the press (plan D10): the dose the server
   * settles at the landing, and a lethal route's hold is the acknowledgement it asks for.
   */
  const galaxy = useGalaxy();
  const targetHasMoon = galaxy.data?.moons?.list.some((m) => m.planetId === target.id) ?? false;
  const targetMoonRarity = galaxy.data?.moons?.rarity[target.id];
  const clouds = galaxy.data?.radiation;
  const sources = useMemo(() => toRadiationSources(clouds ?? []), [clouds]);
  const departMs = serverNow();
  const hpClouds = galaxy.data?.hpRadiation;
  const hpSources = useMemo(() => toHpRadiationSources(hpClouds ?? []), [hpClouds]);
  const hpModel = galaxy.data?.radiationModel === 'HP' || hpSources.length > 0;
  // A server refusal for this same selection outranks the quote (see `lethalAfterRefusal`).
  const [refused, setRefused] = useState<RadiationRefusal | null>(null);
  const radiation = eta > 0
    ? lethalAfterRefusal(hpModel && selectedHealth ? transferHpRadiation({ fleet, returning: returningFleet, tech: mods.tech,
        damage: selectedHealth.selectedDamage,
        path: [{ from: planet.planet.position, to: target.position, startMs: departMs, endMs: departMs + eta * 60_000 },
          { from: target.position, to: planet.planet.position, startMs: departMs + eta * 60_000,
            endMs: departMs + (eta + returnMinutes) * 60_000 }] }, hpSources) : routeRadiation({
        fleet, damage: selectedHealth?.selectedDamage,
        from: planet.planet.position, to: target.position, departMs, arriveMs: departMs + eta * 60_000,
      }, sources), refused, fleet)
    : null;
  /**
   * WHAT THE FLIGHT ITSELF BURNS, AND IT WAS NOWHERE ON THIS SCREEN. T6.
   *
   * The outbound leg always flies. Selected ships also fly home, and both legs
   * are paid at launch. The raid sheet has quoted its fuel since T6; this is
   * the same launch through a different door and it quoted nothing, while offering
   * a deuterium slider that runs all the way to the tank. Fill the hold and press
   * send and the server answers `INSUFFICIENT_FUEL`, because its guard is on the
   * SUM: what is left after the cargo has to cover the flight.
   *
   * Without the figure there is no way to know how much to leave behind, which is
   * the worse half — a screen causing a refusal it cannot explain.
   */
  const fuel = fleetCount(fleet) > 0
    ? missionFuel(fleet, span, 1, 'HOMEWARD', pace)
      + (fleetCount(returningFleet) > 0 ? missionFuel(returningFleet, span, 1, 'HOMEWARD', pace) : 0)
    : 0;
  const fullFuel = fleetCount(fleet) > 0
    ? missionFuel(fleet, span, 1, 'HOMEWARD')
      + (fleetCount(returningFleet) > 0 ? missionFuel(returningFleet, span, 1, 'HOMEWARD') : 0)
    : 0;
  const availableCargoDeuterium = Math.max(0, Math.floor(planet.planet.deuterium - fuel));
  // Settle before commit, including a pace fallback or a live route/stock update.
  // Persist the reduction so slowing down again never silently adds cargo.
  if (cargo.deuterium > availableCargoDeuterium) {
    setCargo({ ...cargo, deuterium: availableCargoDeuterium });
    setCargoAdjustment({ before: cargo.deuterium, after: availableCargoDeuterium });
  }
  const spendableDeuterium = planet.planet.deuterium - cargo.deuterium;
  const fuelled = spendableDeuterium >= fuel;
  /*
    THE FAR WORLD'S HANGAR, THE SAME CEILING `landingBlock` READS. 2026-09-18.
    Only an owned destination whose view is loaded can be judged; otherwise the
    server stays the authority and the sheet says nothing it cannot know.
  */
  const destinationTotal = targetPlanet
    ? targetPlanet.capacity?.hangar ?? hangarCapacity(targetPlanet.buildings.HANGAR ?? 0)
    : undefined;
  const destinationUsed = targetPlanet
    ? targetPlanet.capacity?.hangarUsed
      // Summed rather than spread: the same hull at home and away is two berths, not one.
      ?? hangarLoad(sumFleets(targetPlanet.fleet, targetPlanet.fleetAway, targetPlanet.fleetDocked ?? {}))
    : undefined;
  const incomingRoom = hangarLoad(stayingFleet);
  const destinationFits = destinationTotal === undefined || destinationUsed === undefined
    || destinationUsed + incomingRoom <= destinationTotal;

  const setShip = (id: HullId, value: number) => {
    const max = planet.fleet[id] ?? 0;
    const next = { ...fleet, [id]: Math.max(0, Math.min(max, value)) };
    setFleet(next);
    setCargoAdjustment(null);
    setCargo((current) => fitCargo(current, fleetCargo(next, mods.tech)));
  };

  const setReturnChoice = (group: keyof TransferReturnPlan, choice: TransferReturnPlan[typeof group]) => {
    const next = { ...returnPlan, [group]: choice };
    setReturnPlan(next);
    rememberTransferReturnPlan(next);
    setCargoAdjustment(null);
  };

  /**
   * WHAT STOPS THIS TRANSFER, ON THE HELD COMMIT (B14). The button used to grey out in silence for
   * every reason but the revolt and the pause; a control that will not press states why.
   */
  const refusal: string | null = launchBlocked
    ? t('faults.launchBlock.SHIPYARD_REVOLT')
    : cooling
      ? t('transfer.cooldown', { duration: duration((cooldownUntil.getTime() - now) / 60_000) })
      : fleetCount(fleet) === 0
        ? t('launch.chooseFleet')
        : selectedHealth === null
          ? t('errors.SHIP_SELECTION_CHANGED')
        : !destinationFits
          ? t('transfer.noRoom')
          : loaded > capacity
              || cargo.alloy > planet.planet.alloy
              || cargo.crystal > planet.planet.crystal
              || cargo.deuterium > planet.planet.deuterium
            ? t('transfer.overLoad')
            : !fuelled
              ? t('launch.noFuel')
              : null;
  const landsAt = eta > 0 ? clockTime(new Date(serverNow() + eta * 60_000)) : null;
  const homeAt = returnMinutes > 0 && eta > 0
    ? clockTime(new Date(serverNow() + (eta + returnMinutes) * 60_000)) : null;
  const holdsLine = t('transfer.homeDefence', {
    ships: fleetCount(remainingFleet) + fleetCount(planet.ground),
    power: compact(homeDefence),
  });

  return (
    <Sheet
      detents={['full']}
      kit={{ tone: 'self' }}
      eyebrow={t('transfer.eyebrow')}
      title={target.name}
      onClose={onClose}
      footer={(
        <div data-transfer-commit className="gk gk-launch__commit">
          <RadiationPreview radiation={radiation} />
          {/* A transfer spends fuel: the kit's spend weight, one second. */}
          <GameHold
            weight="spends"
            glyph="crate"
            label={t('transfer.commit')}
            disabledReason={transfer.isPending ? t('transfer.sending') : refusal}
            onCommit={() => {
              transfer.mutate({
                targetPlanetId: target.id, fleet, cargo, pace, returnPlan,
                ...(originBody === 'MOON' ? { originBody } : {}),
                ...(targetBody === 'MOON' && targetHasMoon ? { targetBody } : {}),
                ...(radiation !== null && radiation.destroyed > 0 ? { acknowledgeRadiation: true } : {}),
              }, {
                onSuccess: () => {
                  say(t('transfer.launched', { duration: duration(eta) }));
                  onLaunched();
                },
                onError: (error) => {
                  say(describe(error), 'error');
                  const count = radiationRefusalCount(error);
                  if (count !== null) setRefused({ count, fleet });
                },
              });
            }}
          />
        </div>
      )}
    >
      <div className="gk gk-launch">
        <OriginBodyPicker value={originBody} hasMoonShips={hasOriginMoonShips} onChange={setOriginBody} />
        <TargetBodyPicker
          value={targetBody}
          hasMoon={targetHasMoon}
          knownRarity={targetMoonRarity}
          onChange={setTargetBody}
          showAttackHint={false}
        />
        {/*
          WHAT THIS WORLD IS LEFT HOLDING, the garrison as a bar with the part that flies away carved
          off it — alloy, not threat red: a transfer is logistics, not exposure, but the consequence
          has the same shape.
        */}
        <div className="gk-keeps">
          <div data-origin-defence className="gk-keeps__bar" role="img" aria-label={holdsLine}>
            <span data-part="holds" className="gk-keeps__holds" style={{ width: `${String(share(homeDefence, defencePowerNow))}%` }} />
            <span data-part="leaves" className="gk-keeps__leaves" style={{ width: `${String(share(defencePowerNow - homeDefence, defencePowerNow))}%` }} />
          </div>
          <p className="gk-sub gk-num">{holdsLine}</p>
        </div>

        <section className="gk-launch__fleet">
          <SectionTag as="h3">{t('transfer.fleet')}</SectionTag>
          {/*
            THE HAULERS ARE ALWAYS LISTED, whether or not this world owns one: a row at zero with
            its reason beside it is the sentence the server's refusal never had on screen.
          */}
          <div className="gk-ledger gk-launch__rows">
            {MOVABLE.filter((id) => (planet.fleet[id] ?? 0) > 0 || IS_HAULER(id)).map((id) => {
              const held = planet.fleet[id] ?? 0;
              const packed = fleet[id] ?? 0;
              const art = HULL_ART[id];
              return (
                <div key={id} data-hull-row={id} data-owned={held > 0 ? 'true' : 'false'} className="gk-lrow gk-lrow--tight"
                  {...(packed > 0 ? { 'data-chosen': '' } : {})}>
                  {/* A hull this world does not own is drawn and greyed rather than left out (I1, D132). */}
                  <span data-art className="gk-lrow__art" {...(held > 0 ? {} : { 'data-none': '' })}>
                    {art ? (
                      <img src={art} alt="" aria-hidden width={36} height={36} loading="lazy" />
                    ) : (
                      <HullMark hull={id} className="gk-lrow__mark" />
                    )}
                  </span>
                  <span className="gk-lrow__name">{hullName(id) ?? id}</span>
                  {held > 0
                    ? <span className="gk-sub gk-num gk-lrow__info" aria-label={t('transfer.hullPacked', { packed, held, name: hullName(id) ?? id })}>
                      {packed}<span className="gk-lrow__of">/{held}</span>
                    </span>
                    : <span className="gk-sub gk-lrow__info" data-tone="warn">{t('transfer.hullNone')}</span>}
                  <QuantityStepper
                    value={packed}
                    min={0}
                    max={held}
                    onChange={(value) => { setShip(id, value); }}
                    decreaseLabel={t('launch.fewer', { name: hullName(id) ?? id })}
                    increaseLabel={t('launch.more', { name: hullName(id) ?? id })}
                    valueLabel={t('launch.quantity', { name: hullName(id) ?? id })}
                    maxLabel={t('launch.max', { name: hullName(id) ?? id })}
                    maxText={t('launch.maxShort')}
                  />
                </div>
              );
            })}
          </div>
        </section>

        <section className="gk-launch__fleet" data-transfer-return-plan>
          <SectionTag as="h3">{t('transfer.afterDelivery')}</SectionTag>
          {(['cargoShips', 'otherShips'] as const).map((group) => (
            <div key={group} className="gk-plan">
              <span className="gk-label">{t(`transfer.${group}`)}</span>
              <Choices
                label={t(`transfer.${group}`)}
                value={returnPlan[group]}
                onChange={(choice) => { setReturnChoice(group, choice); }}
                options={(['STAY', 'RETURN'] as const).map((choice) => ({
                  id: choice,
                  label: t(choice === 'STAY' ? 'transfer.stay' : 'transfer.return'),
                  spoken: `${t(`transfer.${group}`)} ${t(choice === 'STAY' ? 'transfer.stay' : 'transfer.return')}`,
                }))}
              />
            </div>
          ))}
          <p className="gk-sub">{t('transfer.returnHint')}</p>
        </section>

        {/* Choose fuel and travel time before packing deuterium into the hold. */}
        <PaceRow data-transfer-pace paces={paces} pace={pace} onChange={(next) => {
          setWantedPace(next); setCargoAdjustment(null);
        }} hint={t('transfer.paceHint')} reset={fleetCount(fleet) > 0 && pace !== wantedPace}
          comparison={{ fuel, fullFuel, minutes: eta,
            fullMinutes: fleetCount(fleet) > 0 ? fleetTravelExact(span, fleet, mods) : 0 }} />

        <dl className="gk-well gk-figures gk-figures--well gk-figures--two">
          <div data-transfer-eta className="gk-figure">
            <dt className="gk-label">{t('transfer.eta')}</dt>
            <dd className="gk-num gk-figure__value">{eta > 0 ? duration(eta) : '—'}</dd>
            {landsAt && <dd className="gk-num gk-figure__sub">{t('now.at', { time: landsAt })}</dd>}
            {homeAt && (
              <dd data-transfer-return-eta className="gk-figure__sub" data-tone="self">
                {t('transfer.returnEta', { duration: duration(eta + returnMinutes), time: homeAt })}
              </dd>
            )}
          </div>
          <div className="gk-figure">
            <dt className="gk-label">{t('transfer.capacity')}</dt>
            {/* An em dash rather than `0 / 0`: this mission has no hold at all, which is not a limit. */}
            <dd className="gk-num gk-figure__value" {...(loaded > capacity ? { 'data-tone': 'hostile' } : {})}>
              {capacity > 0 ? `${compact(loaded)} / ${compact(capacity)}` : '—'}
            </dd>
          </div>
        </dl>

        <section className="gk-launch__fleet">
          <SectionTag as="h3">{t('transfer.cargo')}</SectionTag>
          {/*
            PERMANENT, AND IT CHANGES WHAT IT SAYS: which of the three hold states this mission is in.
            Warn, not red: red is for an attack, and a missing carrier is an absence.
          */}
          <p className="gk-inote" {...(capacity > 0 ? {} : { 'data-tone': 'warn' })}>
            {capacity > 0
              ? t('transfer.holdReady', { capacity: compact(capacity) })
              : ownsHold
                ? t('transfer.holdNeedsLoad')
                : t('transfer.holdNoCarrier')}
          </p>
          <div className="gk-cargo">
            {RESOURCE_ORDER.map((resource) => {
              const stock = Math.floor(planet.planet[resource]);
              const otherCargo = loaded - cargo[resource];
              const max = loadCeiling(resource, { stock, capacity, otherCargo, fuel });
              return (
                <div key={resource} data-cargo-row={resource} className="gk-well gk-cargo__row">
                  <span className="gk-cargo__head">
                    <img src={RESOURCE_ART[resource]} alt="" aria-hidden />
                    <span className="gk-label">{t(`transfer.${resource}`)}</span>
                  </span>
                  {/* What leaves the store, drawn as the store losing it — the fuel line's own shape. */}
                  <SpendBar inline stock={stock} spend={cargo[resource]} tone={resource} label={t('transfer.cargoSending')} />
                  <Slider
                    label={t(`transfer.${resource}`)}
                    value={cargo[resource]}
                    max={max}
                    onChange={(value) => {
                      setCargoAdjustment(null);
                      setCargo((current) => ({ ...current, [resource]: Math.max(0, Math.floor(value)) }));
                    }}
                  />
                </div>
              );
            })}
          </div>
          {cargoAdjustment && <p data-transfer-cargo-adjusted role="status" className="gk-inote" data-tone="warn">
            {t('transfer.cargoFuelAdjusted', { before: full(cargoAdjustment.before), after: full(cargoAdjustment.after) })}
          </p>}
        </section>

        {fuel > 0 && (
          <div data-transfer-fuel className="gk-well gk-cargo__fuel">
            {/*
              THE TANK, MINUS WHAT THE FLIGHT BURNS, measured against what is left AFTER the hold takes
              its deuterium — the exact sum the server's guard uses.
            */}
            <SpendBar inline stock={Math.max(0, spendableDeuterium)} spend={fuel} tone="deuterium" label={t('transfer.fuel')} />
            {/* Why this is smaller than the raid sheet's: the rule and its boundary, where the figure is. */}
            <p className="gk-sub">{t('transfer.homewardFuel')}</p>
          </div>
        )}

        {destinationTotal !== undefined && destinationUsed !== undefined && (
          <div data-transfer-destination {...(destinationUsed + incomingRoom >= destinationTotal ? { 'data-full': '' } : {})}>
            {/* The destination's room in the gauge the Base's hangar taught; the order's segment grows as ships are added. */}
            <RoomGauge label={t('transfer.destinationLabel')} total={destinationTotal} home={destinationUsed} away={0} queued={0}
              incoming={incomingRoom} />
            {destinationUsed + incomingRoom >= destinationTotal && (
              <p className="gk-inote" data-tone="warn"><Glyph id="warn" />{t('capacity.full')}</p>
            )}
          </div>
        )}
        {/* THE RULE, LAST IN THE BODY (E6): the one fact on its line, the rest behind its ⓘ; the commit box keeps its one button. */}
        <div data-transfer-rule>
          <InfoPeek fact={<span className="gk-sub">{t('transfer.recallOnce')}</span>} rule={<p className="gk-sub">{t('transfer.rules')}</p>} />
        </div>
      </div>
    </Sheet>
  );
}
