import { useMemo, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import {
  HULLS,
  TRANSFER_CARGO_HULLS,
  allowedPaces,
  distance,
  missionFuel,
  fleetCount,
  combatValue,
  garrisonOf,
  fleetTravelExact,
  hangarCapacity,
  hangarLoad,
  resourcesTotal,
  transferCargoCapacity,
  type Fleet,
  type HullId,
  type MissionPace,
  type Vec3,
} from '@astera/rules';
import { useTransfer } from '../api/queries.js';
import type { PlanetView } from '../api/schemas.js';
import { hullName } from '../i18n/names.js';
import { compact } from '../lib/format.js';
import { clockTime, duration, useNow } from '../lib/time.js';
import { HULL_ART, RESOURCE_ART } from '../ui/assets.js';
import { PaceRow } from '../ui/PaceRow.js';
import { QuantityStepper } from '../ui/QuantityStepper.js';
import { CapacityBar } from '../ui/CapacityBar.js';
import { SpendBar } from '../ui/SpendBar.js';
import { Tally } from '../ui/Tally.js';
import { HullMark } from '../ui/icons/hulls.js';
import { flightModifiers } from '../lib/navigation.js';
import { launchFault } from '../lib/faults.js';
import { serverNow } from '../lib/clock.js';
import { HoldButton } from '../v2/kit/HoldButton.js';
import { Sheet } from '../v2/kit/Sheet.js';
import { describe, useToast } from '../ui/Toast.js';

const MOVABLE = (Object.keys(HULLS) as HullId[]).filter(
  (id) => !HULLS[id].ground && id !== 'PROSPECTOR',
);
/** Off the rule, never off a literal — see `TRANSFER_CARGO_HULLS`. */
const CARRIES_ORE = (id: HullId): boolean =>
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
  // Focusing a controlled destination also makes it active. The source therefore
  // travels explicitly instead of being re-read from the now-changed selector.
  const transfer = useTransfer(planet.planet.id);
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
  /**
   * THE ORIGIN'S OWN MODIFIERS — the ladder and the Beacon. D180.
   *
   * `capacity` moves with `CARGO_HOLDS` and the ETA moves with `SHIP_PROPULSION`;
   * both were quoting a commander who had bought neither, and the server has always
   * applied both. One value so a screen cannot pick up one and miss the other.
   */
  const mods = flightModifiers(planet);
  const capacity = transferCargoCapacity(fleet, mods.tech);
  const loaded = resourcesTotal(cargo);
  /** Does this world own an ore carrier at all — a different problem from not loading one. */
  const ownsCarrier = transferCargoCapacity(planet.fleet, mods.tech) > 0;
  const remainingFleet = useMemo<Fleet>(() => Object.fromEntries(
    (Object.keys(planet.fleet) as HullId[]).map((id) => [
      id,
      Math.max(0, (planet.fleet[id] ?? 0) - (fleet[id] ?? 0)),
    ]),
  ), [fleet, planet.fleet]);
  // Firepower, the one force unit the launch sheet and a probe use. D199.
  const homeDefence = combatValue(garrisonOf(remainingFleet, planet.ground));
  /** What the origin holds before anything is packed, so the bar has a whole. */
  const defencePowerNow = combatValue(garrisonOf(planet.fleet, planet.ground));
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
  /**
   * WHAT THE FLIGHT ITSELF BURNS, AND IT WAS NOWHERE ON THIS SCREEN. T6.
   *
   * One leg — a transfer arrives and stays — which is the same call `movement.ts`
   * makes before it charges. The raid sheet has quoted its fuel since T6; this is
   * the same launch through a different door and it quoted nothing, while offering
   * a deuterium slider that runs all the way to the tank. Fill the hold and press
   * send and the server answers `INSUFFICIENT_FUEL`, because its guard is on the
   * SUM: what is left after the cargo has to cover the flight.
   *
   * Without the figure there is no way to know how much to leave behind, which is
   * the worse half — a screen causing a refusal it cannot explain.
   */
  const fuel = useMemo(
    () => fleetCount(fleet) > 0 ? missionFuel(fleet, span, 1, 'HOMEWARD') : 0,
    [fleet, span],
  );
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
      ?? hangarLoad({ ...targetPlanet.fleet, ...targetPlanet.fleetAway })
    : undefined;
  const incomingRoom = hangarLoad(fleet);
  const destinationFits = destinationTotal === undefined || destinationUsed === undefined
    || destinationUsed + incomingRoom <= destinationTotal;

  const setShip = (id: HullId, value: number) => {
    const max = planet.fleet[id] ?? 0;
    const next = { ...fleet, [id]: Math.max(0, Math.min(max, value)) };
    setFleet(next);
    /*
      A HEAVIER CONVOY BURNS MORE, AND THE LOAD FOLLOWS ITS CEILING DOWN.
      Packing the hold to the limit and then adding a hull is the one way back
      into the state the ceiling exists to remove — a screen offering a launch the
      server will refuse — because the flight got dearer after the load was set.
    */
    const room = Math.max(0, planet.planet.deuterium - missionFuel(next, span, 1, 'HOMEWARD'));
    setCargo((current) => fitCargo(
      { ...current, deuterium: Math.min(current.deuterium, room) },
      transferCargoCapacity(next, mods.tech),
    ));
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
  const holdsLine = t('transfer.homeDefence', {
    ships: fleetCount(remainingFleet) + fleetCount(planet.ground),
    power: compact(homeDefence),
  });

  return (
    <Sheet
      detents={['full']}
      eyebrow={t('transfer.eyebrow')}
      title={target.name}
      onClose={onClose}
      footer={(
        <div data-transfer-commit className="grid gap-2">
          {/* THE RULE, BEFORE THE BUTTON: it turns once; what the origin keeps heads the sheet. */}
          <p className="text-micro leading-snug text-v2-ink-3">{t('transfer.rules')}</p>
          <HoldButton
            label={t('transfer.commit')}
            disabledReason={transfer.isPending ? t('transfer.sending') : refusal}
            onCommit={() => {
              transfer.mutate({ targetPlanetId: target.id, fleet, cargo, pace }, {
                onSuccess: () => {
                  say(t('transfer.launched', { duration: duration(eta) }));
                  onLaunched();
                },
                onError: (error) => { say(describe(error), 'error'); },
              });
            }}
          />
        </div>
      )}
    >
      <div className="flex flex-col gap-3 pt-1">
        {/*
          WHAT THIS WORLD IS LEFT HOLDING, the garrison as a bar with the part that flies away carved
          off it — alloy, not threat red: a transfer is logistics, not exposure, but the consequence
          has the same shape.
        */}
        <div className="grid gap-1">
          <div
            data-origin-defence
            className="flex h-2 w-full overflow-hidden rounded-full bg-v2-line"
            role="img"
            aria-label={holdsLine}
          >
            <span
              data-part="holds"
              className="h-full bg-v2-self transition-[width] duration-200"
              style={{ width: `${String(share(homeDefence, defencePowerNow))}%` }}
            />
            <span
              data-part="leaves"
              className="h-full bg-v2-alloy transition-[width] duration-200"
              style={{ width: `${String(share(defencePowerNow - homeDefence, defencePowerNow))}%` }}
            />
          </div>
          <p className="text-micro text-v2-ink-3">{holdsLine}</p>
        </div>

        <section className="grid gap-1.5">
          <h3 className="px-1 text-micro font-semibold uppercase tracking-wide text-v2-ink-3">{t('transfer.fleet')}</h3>
          {/*
            THE ORE CARRIERS ARE ALWAYS LISTED, whether or not this world owns one: a row at zero with
            its reason beside it is the sentence the server's refusal never had on screen.
          */}
          <div>
            {MOVABLE.filter((id) => (planet.fleet[id] ?? 0) > 0 || CARRIES_ORE(id)).map((id) => {
              const held = planet.fleet[id] ?? 0;
              const art = HULL_ART[id];
              return (
                <div
                  key={id}
                  data-hull-row={id}
                  data-owned={held > 0 ? 'true' : 'false'}
                  className={`border-b border-v2-line/70 px-1 py-2 last:border-b-0 ${(fleet[id] ?? 0) > 0 ? 'bg-v2-self/5' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    {/* A hull this world does not own is drawn and greyed rather than left out (I1, D132). */}
                    <span data-art className="grid size-8 shrink-0 place-items-center">
                      {art ? (
                        <img
                          src={art}
                          alt=""
                          aria-hidden
                          className={`size-8 object-contain ${held > 0 ? '' : 'opacity-35 grayscale'}`}
                          loading="lazy"
                        />
                      ) : (
                        <HullMark hull={id} className="size-6 text-v2-ink-3" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-caption font-semibold text-v2-ink">{hullName(id) ?? id}</span>
                      {/* How many are here, as pips the eye can count; past eight the numeral takes over. */}
                      {held > 0 ? (
                        held <= 8 ? (
                          <span className="mt-1 flex items-center gap-2">
                            <Tally
                              used={fleet[id] ?? 0}
                              total={held}
                              size="sm"
                              label={t('transfer.hullPacked', {
                                packed: fleet[id] ?? 0,
                                held,
                                name: hullName(id) ?? id,
                              })}
                            />
                          </span>
                        ) : (
                          <span className="mt-1 block font-v2-mono text-micro text-v2-ink-2">
                            {fleet[id] ?? 0}
                            <span className="text-v2-ink-3">/{held}</span>
                          </span>
                        )
                      ) : (
                        <span className="mt-1 block text-micro text-v2-warn">{t('transfer.hullNone')}</span>
                      )}
                    </span>
                  <QuantityStepper
                    look="v2"
                    value={fleet[id] ?? 0}
                    min={0}
                    max={held}
                    onChange={(value) => { setShip(id, value); }}
                    decreaseLabel={t('launch.fewer', { name: hullName(id) ?? id })}
                    increaseLabel={t('launch.more', { name: hullName(id) ?? id })}
                    valueLabel={t('launch.quantity', { name: hullName(id) ?? id })}
                    editable
                    maxLabel={t('launch.max', { name: hullName(id) ?? id })}
                    maxText={t('launch.maxShort')}
                  />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="grid gap-1.5">
          <h3 className="px-1 text-micro font-semibold uppercase tracking-wide text-v2-ink-3">{t('transfer.cargo')}</h3>
          {/*
            PERMANENT, AND IT CHANGES WHAT IT SAYS: which of the three hold states this mission is in.
            Warn, not red: red is for an attack, and a missing carrier is an absence.
          */}
          <p className={`px-1 text-caption ${capacity > 0 ? 'text-v2-ink-2' : 'text-v2-warn'}`}>
            {capacity > 0
              ? t('transfer.holdReady', { capacity: compact(capacity) })
              : ownsCarrier
                ? t('transfer.holdNeedsLoad')
                : t('transfer.holdNoCarrier')}
          </p>
          <div className="grid gap-2">
            {RESOURCE_ORDER.map((resource) => {
              const stock = Math.floor(planet.planet[resource]);
              const otherCargo = loaded - cargo[resource];
              const max = loadCeiling(resource, { stock, capacity, otherCargo, fuel });
              const fill = max > 0 ? Math.min(100, (cargo[resource] / max) * 100) : 0;
              return (
                <label key={resource} className="block rounded-control border border-v2-line bg-v2-panel px-2.5 py-2">
                  <span className="flex items-center gap-2">
                    <img src={RESOURCE_ART[resource]} alt="" aria-hidden className="size-4 shrink-0 object-contain" />
                    <span className="flex-1 text-micro uppercase tracking-wide text-v2-ink-3">{t(`transfer.${resource}`)}</span>
                  </span>
                  {/* What leaves the store, drawn as the store losing it — the fuel line's own shape. */}
                  <span className="mt-2 block">
                    <SpendBar
                      stock={stock}
                      spend={cargo[resource]}
                      tone={resource}
                      label={t('transfer.cargoSending')}
                      readout="spend"
                      compactSize
                    />
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={max}
                    step={1}
                    value={cargo[resource]}
                    onChange={(event) => {
                      const value = Math.max(0, Math.floor(event.currentTarget.valueAsNumber || 0));
                      setCargo((current) => ({ ...current, [resource]: value }));
                    }}
                    style={{ '--slider-fill': `${String(fill)}%` } as CSSProperties}
                    className={`slider slider-${resource} mt-2 w-full`}
                  />
                </label>
              );
            })}
          </div>
        </section>

        {/* The rungs over the figures they move; a transfer is slowed to stay in the air, not to land on time. */}
        <PaceRow data-transfer-pace paces={paces} pace={pace} onChange={setWantedPace} hint={t('transfer.paceHint')} />

        <dl className="grid grid-cols-2 gap-1.5">
          <div data-transfer-eta className="rounded-control border border-v2-line bg-v2-panel px-2 py-1.5">
            <dt className="text-micro uppercase tracking-wide text-v2-ink-3">{t('transfer.eta')}</dt>
            <dd className="mt-0.5 font-v2-mono text-caption text-v2-ink">{eta > 0 ? duration(eta) : '—'}</dd>
            {landsAt && <dd className="font-v2-mono text-micro text-v2-ink-3">{t('now.at', { time: landsAt })}</dd>}
          </div>
          <div className="rounded-control border border-v2-line bg-v2-panel px-2 py-1.5">
            <dt className="text-micro uppercase tracking-wide text-v2-ink-3">{t('transfer.capacity')}</dt>
            {/* An em dash rather than `0 / 0`: this mission has no hold at all, which is not a limit. */}
            <dd className={`mt-0.5 font-v2-mono text-caption ${loaded > capacity ? 'text-v2-hostile' : 'text-v2-ink'}`}>
              {capacity > 0 ? `${compact(loaded)} / ${compact(capacity)}` : '—'}
            </dd>
          </div>
        </dl>

        {fuel > 0 && (
          <div data-transfer-fuel className="rounded-control border border-v2-line bg-v2-panel px-2.5 py-2">
            {/*
              THE TANK, MINUS WHAT THE FLIGHT BURNS, measured against what is left AFTER the hold takes
              its deuterium — the exact sum the server's guard uses.
            */}
            <SpendBar stock={Math.max(0, spendableDeuterium)} spend={fuel} tone="deuterium" label={t('transfer.fuel')} />
            {/* Why this is smaller than the raid sheet's: the rule and its boundary, where the figure is. */}
            <p className="mt-1.5 text-micro text-v2-ink-3">{t('transfer.homewardFuel')}</p>
          </div>
        )}

        {destinationTotal !== undefined && destinationUsed !== undefined && (
          <div data-transfer-destination>
            {/* The destination's room in the bar the build sheet taught; the order's segment grows as ships are added. */}
            <CapacityBar total={destinationTotal} used={destinationUsed} incoming={incomingRoom} label={t('transfer.destinationLabel')} />
          </div>
        )}
      </div>
    </Sheet>
  );
}
