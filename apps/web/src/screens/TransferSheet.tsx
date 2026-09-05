import { useMemo, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import {
  HULLS,
  TRANSFER_CARGO_HULLS,
  distance,
  missionFuel,
  fleetCount,
  fleetPower,
  fleetTravelExact,
  hangarCapacity,
  hangarLoad,
  prospectorRoom,
  resourcesTotal,
  transferCargoCapacity,
  type Fleet,
  type HullId,
  type Vec3,
} from '@astera/rules';
import { useTransfer } from '../api/queries.js';
import type { PlanetView } from '../api/schemas.js';
import { hullName } from '../i18n/names.js';
import { compact } from '../lib/format.js';
import { duration } from '../lib/time.js';
import { HULL_ART, RESOURCE_ART } from '../ui/assets.js';
import { CapacityBar } from '../ui/CapacityBar.js';
import { QuantityStepper } from '../ui/QuantityStepper.js';
import { SpendBar } from '../ui/SpendBar.js';
import { Tally } from '../ui/Tally.js';
import { HullMark } from '../ui/icons/hulls.js';
import { Button, Sheet } from '../ui/kit/index.js';
import { describe, useToast } from '../ui/Toast.js';

const MOVABLE = (Object.keys(HULLS) as HullId[]).filter((id) => !HULLS[id].ground);
/** Off the rule, never off a literal — see `TRANSFER_CARGO_HULLS`. */
const CARRIES_ORE = (id: HullId): boolean =>
  (TRANSFER_CARGO_HULLS as readonly HullId[]).includes(id);
const RESOURCE_ORDER = ['alloy', 'crystal', 'deuterium'] as const;

/**
 * A part's share of a whole, clamped, with an empty origin drawing nothing.
 *
 * A world whose every craft is already away has no defence power at all, and
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
  const [fleet, setFleet] = useState<Fleet>({});
  const [cargo, setCargo] = useState({ alloy: 0, crystal: 0, deuterium: 0 });
  const capacity = transferCargoCapacity(fleet);
  const loaded = resourcesTotal(cargo);
  const targetOwned = targetPlanet
    ? {
      ...targetPlanet.fleet,
      ...Object.fromEntries(
        (Object.keys(HULLS) as HullId[]).map((id) => [
          id,
          (targetPlanet.fleet[id] ?? 0)
          + (targetPlanet.ground[id] ?? 0)
          + (targetPlanet.fleetAway[id] ?? 0),
        ]),
      ),
    }
    : undefined;
  const destinationCapacity = targetPlanet
    ? targetPlanet.capacity?.hangar ?? hangarCapacity(targetPlanet.buildings.HANGAR ?? 0)
    : undefined;
  const destinationUsed = targetPlanet
    ? targetPlanet.capacity?.hangarUsed ?? hangarLoad(targetOwned ?? {})
    : undefined;
  const incomingSpace = hangarLoad(fleet);
  const destinationFits = destinationCapacity === undefined || destinationUsed === undefined
    ? true
    : destinationUsed + incomingSpace <= destinationCapacity;
  const targetProspectors = targetOwned?.PROSPECTOR ?? 0;
  const prospectorsFit = targetPlanet === undefined
    || (fleet.PROSPECTOR ?? 0) <= prospectorRoom(targetProspectors);
  /** Does this world own an ore carrier at all — a different problem from not loading one. */
  const ownsCarrier = transferCargoCapacity(planet.fleet) > 0;
  const remainingFleet = useMemo<Fleet>(() => Object.fromEntries(
    (Object.keys(planet.fleet) as HullId[]).map((id) => [
      id,
      Math.max(0, (planet.fleet[id] ?? 0) - (fleet[id] ?? 0)),
    ]),
  ), [fleet, planet.fleet]);
  const homeDefence = fleetPower({ ...remainingFleet, ...planet.ground });
  /** What the origin holds before anything is packed, so the bar has a whole. */
  const defencePowerNow = fleetPower({ ...planet.fleet, ...planet.ground });
  /** The one distance this sheet is about: the ETA, the fuel and the trim share it. */
  const span = distance(planet.planet.position, target.position);
  const eta = useMemo(
    () => fleetCount(fleet) > 0 ? fleetTravelExact(span, fleet) : 0,
    [fleet, span],
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
    () => fleetCount(fleet) > 0 ? missionFuel(fleet, span, 1) : 0,
    [fleet, span],
  );
  const spendableDeuterium = planet.planet.deuterium - cargo.deuterium;
  const fuelled = spendableDeuterium >= fuel;
  const valid = fleetCount(fleet) > 0 && loaded <= capacity && destinationFits && prospectorsFit
    && cargo.alloy <= planet.planet.alloy
    && cargo.crystal <= planet.planet.crystal
    && cargo.deuterium <= planet.planet.deuterium
    && fuelled;

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
    const room = Math.max(0, planet.planet.deuterium - missionFuel(next, span, 1));
    setCargo((current) => fitCargo(
      { ...current, deuterium: Math.min(current.deuterium, room) },
      transferCargoCapacity(next),
    ));
  };

  return (
    <Sheet
      eyebrow={t('transfer.eyebrow')}
      title={target.name}
      onClose={onClose}
      footer={(
        <Button
          variant="commit"
          size="lg"
          full
          disabled={!valid || transfer.isPending}
          onClick={() => {
            transfer.mutate({ targetPlanetId: target.id, fleet, cargo }, {
              onSuccess: () => {
                say(t('transfer.launched', { duration: duration(eta) }));
                onLaunched();
              },
              onError: (error) => { say(describe(error), 'error'); },
            });
          }}
        >
          {transfer.isPending ? t('transfer.sending') : t('transfer.commit')}
        </Button>
      )}
    >
      {/*
        THE FLIGHT, AND THEN THE THREE CEILINGS IT HAS TO CLEAR. Owner instruction.

        This sheet used to be five grey sentences stacked on top of each other —
        an ETA, a `400 / 1200`, a fuel line, a "Destination Hangar after landing:
        18 + 12 / 40" and a defence tally — every one of them a quantity measured
        against a limit, and every one of them written out for the player to
        assemble. The launch sheet next door has drawn its equivalents since D142;
        these are the same facts and now wear the same shapes.
      */}
      <div className="grid grid-cols-2 gap-2 pt-2">
        <p className="plate px-3 py-2 text-caption text-dim">
          {t('transfer.eta')} <strong className="text-bone">{eta > 0 ? duration(eta) : '—'}</strong>
        </p>
        <p className="plate px-3 py-2 text-caption text-dim">
          {t('transfer.capacity')}{' '}
          <strong className={loaded > capacity ? 'text-threat-ink' : 'text-bone'}>
            {/*
              An em dash rather than `0 / 0`, which reads as a limit the player is
              up against when what is true is that this mission has no hold at all.
              The ETA cell beside it has said absence this way since it was written.
            */}
            {capacity > 0 ? `${compact(loaded)} / ${compact(capacity)}` : '—'}
          </strong>
        </p>
      </div>
      {fuel > 0 && (
        <div data-transfer-fuel className="plate mt-2 px-3 py-3">
          {/*
            THE TANK, MINUS WHAT THE FLIGHT BURNS — and the store it is measured
            against is what is left AFTER the hold takes its deuterium, which is
            the exact sum the server's guard uses. Loading the last of the tank as
            cargo now visibly eats the fuel bar rather than producing a refusal on
            commit with nothing on screen to explain it.
          */}
          <SpendBar
            stock={Math.max(0, spendableDeuterium)}
            spend={fuel}
            tone="deuterium"
            label={t('transfer.fuel')}
          />
        </div>
      )}
      {destinationCapacity !== undefined && destinationUsed !== undefined && (
        <div className="mt-2">
          {/*
            THE DESTINATION'S ROOM, IN THE HANGAR BAR THE BUILD SHEET ALREADY
            TAUGHT. `used + incoming / total` was a sum spelled out; the same three
            parts drawn are read without arithmetic, and the ORDER's segment grows
            as ships are added — so a transfer that will not fit is visible while
            it is being packed rather than at the moment it is refused.
          */}
          <CapacityBar
            total={destinationCapacity}
            used={destinationUsed}
            incoming={incomingSpace}
            label={t('transfer.destinationLabel')}
          />
          {!prospectorsFit && (
            <p className="mt-2 text-caption text-alloy">
              {t('transfer.destinationProspectorFull')}
            </p>
          )}
        </div>
      )}
      <h3 className="legend mt-2">{t('transfer.fleet')}</h3>
      {/*
        WHAT THIS WORLD IS LEFT HOLDING, drawn the way the raid sheet draws it:
        the garrison as a bar, with the part that flies away carved off it. A
        transfer is not an attack, so the departing slice is alloy rather than
        threat red — this is a decision about logistics, not one about exposure —
        but the shape is deliberately the same, because the consequence is.
      */}
      <div
        data-origin-defence
        className="socket mt-2 flex h-3 w-full overflow-hidden rounded-full"
        role="img"
        aria-label={t('transfer.homeDefence', {
          ships: fleetCount(remainingFleet) + fleetCount(planet.ground),
          power: compact(homeDefence),
        })}
      >
        <span
          data-part="holds"
          className="h-full bg-bone/60 transition-[width] duration-200"
          style={{ width: `${String(share(homeDefence, defencePowerNow))}%` }}
        />
        <span
          data-part="leaves"
          className="h-full bg-alloy/70 transition-[width] duration-200"
          style={{ width: `${String(share(defencePowerNow - homeDefence, defencePowerNow))}%` }}
        />
      </div>
      <p className="mt-2 text-label text-dim">
        {t('transfer.homeDefence', {
          ships: fleetCount(remainingFleet) + fleetCount(planet.ground),
          power: compact(homeDefence),
        })}
      </p>
      <div className="mt-2 space-y-2">
        {/*
          THE ORE CARRIERS ARE ALWAYS LISTED, whether or not this world owns one.
          The list used to be "hulls with more than none of them here", so a
          commander with no Hauler saw no Hauler row, a cargo readout of `0 / 0`,
          three sliders pinned at zero and the reason written nowhere at all. The
          server has refused that transfer for as long as it has existed; the
          screen simply never said the sentence. A row at zero with a reason beside
          it is the sentence.
        */}
        {MOVABLE.filter((id) => (planet.fleet[id] ?? 0) > 0 || CARRIES_ORE(id)).map((id) => {
          const held = planet.fleet[id] ?? 0;
          const art = HULL_ART[id];
          return (
            <div
              key={id}
              data-hull-row={id}
              data-owned={held > 0 ? 'true' : 'false'}
              className={`min-h-14 rounded-chip border border-line-soft px-3 py-2 ${(fleet[id] ?? 0) > 0 ? 'bg-crystal/[0.05]' : ''
                }`}
            >
              <div className="flex items-center gap-2">
              {/*
              THE SHIP, NOT ITS NAME. The raid sheet next door has shown the render
              since it was written; this one — the other half of the same verb —
              listed hull names as plain text, so a player learning which craft
              carries ore had to already know what a Runner was.

              A HULL THIS WORLD DOES NOT OWN IS DRAWN AND GREYED rather than left
              out (I1, and D132's rule that a row at zero states its reason). The
              art at 35% behind an amber count says "this exists, you have none"
              in the same shape the whole game uses for a thing not yet owned.
            */}
              <span data-art className="socket size-10 shrink-0 rounded-control">
                {art ? (
                  <img
                    src={art}
                    alt=""
                    aria-hidden
                    className={`size-9 object-contain ${held > 0 ? '' : 'opacity-35 grayscale'}`}
                    loading="lazy"
                  />
                ) : (
                  <HullMark hull={id} className="size-6 text-dim" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="name block truncate text-bone">{hullName(id) ?? id}</span>
                {/*
                HOW MANY ARE HERE, AS PIPS WHERE THE EYE CAN COUNT THEM. A hangar
                holds a handful of anything expensive, and "/3" is a figure to
                read where three marks is a quantity to see. Past eight the rack
                would be a smear, so the numeral takes over — which is the same
                threshold `Tally` is sized for everywhere else.
              */}
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
                    <span className="num mt-1 block text-label text-dim">
                      {fleet[id] ?? 0}
                      <span className="text-faint">/{held}</span>
                    </span>
                  )
                ) : (
                  <span className="mt-1 block text-label text-alloy">{t('transfer.hullNone')}</span>
                )}
              </span>
              </div>
              <div className="mt-2">
                <QuantityStepper
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
      <h3 className="legend mt-2">{t('transfer.cargo')}</h3>
      {/*
        PERMANENT, AND IT CHANGES WHAT IT SAYS RATHER THAN WHETHER IT IS THERE. A
        line that only appears when something is wrong teaches nothing the first
        time and is missed the second; this one is where the rule lives, and it
        reports which of the three states the mission is in. Amber, not red:
        `interface.md` reserves red for an attack, and a missing system is an
        absence.
      */}
      <p className={`mt-1 text-caption ${capacity > 0 ? 'text-dim' : 'text-threat'}`}>
        {capacity > 0
          ? t('transfer.holdReady', { capacity: compact(capacity) })
          : ownsCarrier
            ? t('transfer.holdNeedsLoad')
            : t('transfer.holdNoCarrier')}
      </p>
      <div className="mt-2 space-y-3">
        {RESOURCE_ORDER.map((resource) => {
          const stock = Math.floor(planet.planet[resource]);
          const otherCargo = loaded - cargo[resource];
          const max = loadCeiling(resource, { stock, capacity, otherCargo, fuel });
          const fill = max > 0 ? Math.min(100, (cargo[resource] / max) * 100) : 0;
          return (
            <label key={resource} className="block rounded-chip border border-line-soft bg-deep/55 px-3 py-3">
              <span className="flex items-center gap-2">
                {/*
                THE SUBSTANCE IS ITS OWN RENDER. Three sliders under three grey
                words were the same control three times; the art is what the
                header has taught since the first session, and it identifies the
                row before the label is read.
              */}
                <img
                  src={RESOURCE_ART[resource]}
                  alt=""
                  aria-hidden
                  className="size-4 shrink-0 object-contain"
                />
                <span className="legend flex-1 text-dim">{t(`transfer.${resource}`)}</span>
              </span>
              {/*
              WHAT LEAVES THE STORE, AS THE STORE LOSING IT. `x / y` under a
              slider is the player doing the subtraction; the spend bar draws the
              hole the load makes, and it is the same shape the fuel line above it
              uses — because loading ore and burning fuel are the same act against
              the same three stores.
            */}
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
      <p className="mt-3 text-caption text-dim">{t('transfer.irreversible')}</p>
    </Sheet>
  );
}
