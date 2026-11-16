import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TRANSFER_CARGO_HULLS,
  TRADE,
  fleetCount,
  combatValue,
  garrisonOf,
  quoteTrade,
  honorTradeResources,
  transferCargoCapacity,
  type Fleet,
  type HullId,
  type Resources,
  type TechLevels,
  type TradeQuote,
} from '@astera/rules';
import { useGalaxy, useLaunchTrade } from '../api/queries.js';
import type { PlanetView } from '../api/schemas.js';
import { hullLabel } from '../i18n/names.js';
import { compact, full } from '../lib/format.js';
import { flightModifiers, planTradeRoute } from '../lib/navigation.js';
import { launchFault } from '../lib/faults.js';
import {
  balanceTake,
  dearestFirst,
  largestOffer,
  offerCeiling,
  offerStep,
  tradeWindowOpen,
  type TradeGood,
  type TradeShipEvent,
} from '../lib/trade.js';
import { duration, useNow } from '../lib/time.js';
import { HULL_ART, RESOURCE_ART } from '../ui/assets.js';
import { QuantityStepper } from '../ui/QuantityStepper.js';
import { RadiationPreview } from '../ui/RadiationPreview.js';
import { HonorEffectQuote } from '../ui/HonorBenefits.js';
import { lethalAfterRefusal, radiationRefusalCount, routeHpRadiation, toHpRadiationSources, type RadiationRefusal } from '../lib/radiation.js';
import { SpendBar } from '../ui/SpendBar.js';
import { HullMark } from '../ui/icons/hulls.js';
import { Choices, GameHold, Glyph, SectionTag, Slider } from '../game-ui/index.js';
import { Sheet } from '../v2/kit/Sheet.js';
import { describe, useToast } from '../ui/Toast.js';

/**
 * TİCARET KONVOYU — WHERE A COMMANDER DECIDES WHAT TO SWAP. D156.
 *
 * REBUILT ON OWNER REPORT, and the report is worth keeping because it names four
 * separate failures in one breath:
 *
 *   *"Kayan barları sağa sola çekiyorum, benim maximumum ne belli değil, bir halt
 *   belli değil. Her şeyi doğru ayarlamalıyım ki en alttaki buton aktif olsun.
 *   Kullanıcıya mı bırakacağız bunları? Oranlar belli."*
 *
 * The first version was `TransferSheet` with a merchant bolted on: a ship picker
 * offering all nineteen hulls, three free sliders running to the edge of the
 * store, a leftover the player had to notice and act on, and a commit button that
 * stayed dead until every one of those happened to line up. It asked the player to
 * solve an arithmetic problem the rate table had already answered.
 *
 * FOUR CONTROLS NOW, AND NONE OF THEM CAN BE WRONG.
 *
 *   1. THE CONVOY COMES FIRST, because it sets the hold and the hold sets every
 *      other maximum on the screen. It was at the BOTTOM before, which is why the
 *      limits above it read as arbitrary. Only the three carriers are offered:
 *      a warship in a trade convoy adds bulk, fuel and a bay and carries nothing,
 *      and `transferCargoCapacity` — not `fleetCargo` — is what this lane is
 *      measured with.
 *   2. WHICH GOOD LEAVES, as a segmented control.
 *   3. HOW MUCH, on a slider whose ceiling is `offerCeiling`: the smallest of what
 *      the store holds, what fits going out and what its haul needs coming home.
 *      The line under it NAMES which of the three is binding, because "maks 2.100"
 *      with no reason attached is the same mystery in a smaller font.
 *   4. THE SPLIT, one slider, because the ask is not two amounts — it is a choice
 *      between two goods for a number of units that is already fixed. The dearer
 *      good leads and the cheaper absorbs the remainder EXACTLY (`balanceTake`),
 *      so the merchant never keeps a unit and there is no leftover to explain.
 *
 * D208 keeps the worked-example invariant at its new rate: offer 64 alloy and the
 * counter opens at two deuterium; drag it down one notch and the rest comes home
 * as sixteen crystal. Nothing to reconcile, nothing to top up, no dead button.
 *
 * `quoteTrade` IS STILL THE ONLY ARITHMETIC that decides anything, and the refusal
 * ladder below is still `services/trade.ts`'s own order. Most of its rungs are now
 * unreachable through these controls — that is the point of the rebuild — but they
 * stay wired, because the alternative is a screen that would send a trade the
 * server refuses if the two ever drifted apart. D155 records that exact bug on the
 * pirate lane.
 */

/** The only hulls with a hold. Off the rule, never off a literal. */
const CARRIERS = TRANSFER_CARGO_HULLS as readonly HullId[];

const EMPTY: Resources = { alloy: 0, crystal: 0, deuterium: 0 };

/**
 * A part's share of a whole, clamped, with an empty origin drawing nothing.
 *
 * A world whose every craft is already away has no firepower at all, and
 * dividing by it would put `NaN%` into a style attribute.
 */
const share = (part: number, whole: number): number =>
  whole <= 0 ? 0 : Math.max(0, Math.min(100, (part / whole) * 100));

export function TradeSheet({
  merchant,
  seasonStart,
  planet,
  onClose,
  onLaunched,
  onAim,
}: {
  merchant: TradeShipEvent;
  /** The epoch the orbit is evaluated from. Server-authored, like every clock. */
  seasonStart: Date;
  planet: PlanetView;
  onClose: () => void;
  onLaunched: () => void;
  /**
   * WHERE THE CHOSEN CONVOY WOULD MEET THE MERCHANT, for the disc to draw. D155.
   *
   * Reported upward rather than drawn here, exactly as `LaunchSheet` does it: the
   * rendezvous is a point in the galaxy and this is a panel over it. `null`
   * whenever there is nothing to draw — nothing selected, or a convoy that cannot
   * make the meeting at all.
   */
  onAim?: (at: { x: number; y: number; z: number } | null) => void;
}) {
  const { t } = useTranslation();
  const say = useToast();
  const launch = useLaunchTrade(planet.planet.id);
  const launchBlock = launchFault(planet.faults, 'fleet', planet.silentSpace === true);

  const [fleet, setFleet] = useState<Fleet>({});
  const [give, setGive] = useState<TradeGood>('alloy');
  const [offer, setOffer] = useState(0);
  /**
   * HOW MANY OF THE DEARER GOOD THE PLAYER ASKED FOR — `null` until they say.
   *
   * Not a number defaulted to the maximum, because those two states behave
   * differently the moment the offer changes: an untouched split should follow the
   * new ceiling ("give more, get more"), while a split the player deliberately
   * dragged to one deuterium should stay at one deuterium. Collapsing them into a
   * single number silently overwrites a choice somebody made.
   */
  const [lead, setLead] = useState<number | null>(null);

  /**
   * A COARSE CLOCK, AND IT IS LOAD-BEARING RATHER THAN COSMETIC.
   *
   * The merchant moves, so the rendezvous solve needs an instant — and reading
   * `serverNow()` in the render body would make `aim` a different point on every
   * render, which republishes it to the disc, which re-renders this sheet, which
   * moves the point again. A ticked value is constant WITHIN a tick, so the loop
   * cannot start; five seconds is `GalaxyView`'s own cadence, so the sheet costs
   * the screen no extra renders at all.
   */
  const now = useNow(5_000);
  const nowMinutes = (now - seasonStart.getTime()) / 60_000;

  const mods = flightModifiers(planet);

  const { rate } = merchant;
  const hold = transferCargoCapacity(fleet, mods.tech);

  /*
    SOLVED ON EVERY RENDER, DELIBERATELY UNMEMOISED — the same as `LaunchSheet`.

    `interceptOrbit` is a scan and a bisection over a three-hour horizon: a few
    hundred distance evaluations, well under a millisecond, and this screen renders
    only when the player moves something or the five-second tick fires. Memoising it
    would need the fleet object as a key, and every honest key for a fresh object
    literal is either a stringify or a lie.

    IT IS SOLVED BEFORE THE STORE, and that ordering is the fix for a refusal the
    player could not act on. It depends on the convoy and the merchant, never on
    the offer, so nothing here is circular.
  */
  const route = planTradeRoute(
    planet.planet.position,
    { orbit: merchant.orbit, expiresAtMinute: merchant.expiresAtMinute },
    nowMinutes,
    fleet,
    planet.fleet,
    planet.ground,
    mods,
  );
  const fuel = route?.fuel ?? 0;
  const galaxy = useGalaxy();
  const hpViews = galaxy.data?.hpRadiation;
  const hpSources = useMemo(() => toHpRadiationSources(hpViews ?? []), [hpViews]);
  const [radiationRefused, setRadiationRefused] = useState<RadiationRefusal | null>(null);
  const meet = route?.rendezvous;
  const arrival = now + (route?.oneWayMinutes ?? 0) * 60_000;
  const dockEnd = arrival + TRADE.dockSeconds * 1000;
  const hpQuote = route && meet ? routeHpRadiation({ fleet, tech: mods.tech,
    path: [{ from: planet.planet.position, to: meet, startMs: now, endMs: arrival },
      { from: meet, to: meet, startMs: arrival, endMs: dockEnd },
      { from: meet, to: planet.planet.position, startMs: dockEnd, endMs: now + route.exposureMinutes * 60_000 }] }, hpSources) : null;
  const radiation = lethalAfterRefusal(hpQuote, radiationRefused, fleet);

  /**
   * WHAT IS ACTUALLY SPENDABLE — AND THE TANK KEEPS ITS OWN FLIGHT'S WORTH.
   *
   * `assertFuel`'s guard is on the SUM: deuterium handed to the merchant has left
   * this world as far as the flight is concerned (D136). Offering the whole tank is
   * therefore a launch with no fuel, and the sheet used to open on exactly that —
   * pick Deuterium and the commit went straight to "not enough deuterium for the
   * flight", a refusal produced by the sheet's own default with nothing on screen
   * naming what to drag.
   *
   * Reserving it here turns that refusal into a ceiling, which is what every other
   * limit on this screen already is.
   */
  const store = Math.floor(
    give === 'deuterium' ? Math.max(0, planet.planet.deuterium - fuel) : planet.planet[give],
  );
  const step = offerStep(give, rate);
  const top = offerCeiling(store, hold, give, rate).top;
  const [dear, cheap] = dearestFirst(give, rate);

  /*
    THE OFFER IS CLAMPED ON READ, NOT ON WRITE.

    Removing a ship shrinks the hold under an offer that no longer fits. Leaving
    the slider past its own end and refusing the commit was the first version's
    answer and it is the behaviour the report is about; trimming it in the setter
    instead would need every path that can move the hold to remember to do it.
    Deriving it means there is no path that can forget.
  */
  const amount = Math.min(offer, top);
  const units = amount * rate[give];
  const offered = useMemo<Resources>(() => ({ ...EMPTY, [give]: amount }), [give, amount]);

  /** The ask, always spending the offer to nothing. `null` lead means "as much as possible". */
  const want = balanceTake(units, give, lead ?? Infinity, rate, hold);
  /** THE ONE ARITHMETIC. Everything drawn below is a field of this object. */
  const quote: TradeQuote = quoteTrade(offered, want, rate);
  const netWant = planet.honorBenefits ? honorTradeResources(want, planet.honorBenefits).net : want;

  /** The two ends of the split slider, both reachable, neither of them invalid. */
  const splitTop = rate[dear] > 0 ? Math.floor(units / rate[dear]) : 0;
  const splitFloor = balanceTake(units, give, 0, rate, hold)[dear];

  const aim = route?.rendezvous ?? null;

  /**
   * HAND THE AIM POINT TO THE DISC, AND TAKE IT BACK ON THE WAY OUT.
   *
   * The cleanup is the load-bearing half (D155): a mark left behind by a closed
   * sheet is a target sitting on the galaxy as though the player had committed to
   * it. Depends on the COORDINATES rather than the object, because `route` is
   * rebuilt whenever anything moves and an object identity would republish the
   * same point on every keystroke.
   */
  useEffect(() => {
    onAim?.(aim);
    return () => { onAim?.(null); };
  }, [onAim, aim?.x, aim?.y, aim?.z]);

  const ships = fleetCount(fleet);
  const baysFree = Math.max(0, planet.flight.total - planet.flight.used);
  const carrying = hold > 0;
  const windowOpen = tradeWindowOpen(merchant, now);
  const minutesLeft = Math.max(0, (merchant.endsAt.getTime() - now) / 60_000);
  /** What is left to burn once the merchant's payment has left the tank. D136. */
  const spendableDeuterium = Math.max(0, planet.planet.deuterium - offered.deuterium);
  const fuelled = spendableDeuterium >= fuel;

  /**
   * THE LADDER, IN `services/trade.ts`'S OWN ORDER.
   *
   * `null` means Send is live. Every other value is both the reason drawn on the
   * control and the code the server would answer with, so the two can be compared
   * row by row rather than by reading two files side by side.
   */
  const refusal: string | null =
    launchBlock !== null ? t(`faults.launchBlock.${launchBlock}`)
    : ships === 0 ? t('trade.chooseFleet')
    : !windowOpen ? t('trade.windowClosed')
    : baysFree <= 0 ? t('trade.noBay')
    : !carrying ? t('trade.needsCarrier')
    : quote.refusal === 'EMPTY_GIVE' ? t('trade.noOffer')
    : quote.refusal === 'EMPTY_WANT' ? t('trade.noAsk')
    : netWant.alloy + netWant.crystal + netWant.deuterium === 0 ? t('honorBenefits.tooSmall')
    : quote.refusal === 'OVERLAPPING_RESOURCE' ? t('trade.selfSwap')
    : quote.refusal === 'BAD_AMOUNT' ? t('trade.badAmount')
    : quote.refusal === 'INSUFFICIENT_OFFER' ? t('trade.cannotPay')
    : quote.requiredHold > hold ? t('trade.overHold')
    : amount > store ? t('trade.noStock')
    : route === null ? t('trade.cannotReach')
    : !fuelled ? t('trade.noFuel')
    : null;

  /**
   * A CONVOY THAT CAN CARRY SOMETHING OPENS WITH SOMETHING IN IT.
   *
   * Owner instruction: the rate is published and fixed, so the sheet already knows
   * what a full trade looks like the moment there is a hold to put it in. Opening
   * at zero and making the commander build it up by hand was the interaction cost
   * the report is about. They drag DOWN from a working trade instead of up from a
   * dead one — and `offer` is only ever raised to the new ceiling when it was
   * already sitting on the old one, so a deliberately small trade is never
   * silently maximised by adding a ship.
   */
  const setShip = (hull: HullId, value: number): void => {
    const available = planet.fleet[hull] ?? 0;
    const next = { ...fleet, [hull]: Math.max(0, Math.min(available, value)) };
    const room = transferCargoCapacity(next, mods.tech);
    const ceiling = largestOffer(store, room, give, rate);
    setFleet(next);
    if (offer >= top) setOffer(ceiling);
  };

  const pickGive = (good: TradeGood): void => {
    setGive(good);
    setOffer(largestOffer(Math.floor(planet.planet[good]), hold, good, rate));
    setLead(null);
  };

  const remainingFleet = useMemo<Fleet>(() => Object.fromEntries(
    (Object.keys(planet.fleet) as HullId[]).map((id) => [
      id,
      Math.max(0, (planet.fleet[id] ?? 0) - (fleet[id] ?? 0)),
    ]),
  ), [fleet, planet.fleet]);
  // Firepower, the one force unit the launch sheet and a probe use. D199.
  const holdingPower = combatValue(garrisonOf(remainingFleet, planet.ground));
  const powerNow = combatValue(garrisonOf(planet.fleet, planet.ground));

  /*
    WHY THE OFFER STOPS WHERE IT DOES, IN WORDS. The report's "maximumum ne belli
    değil" is answered here: two different walls produce the same number, and which
    one it is decides what the player should do about it — wait for production, or
    grow the convoy.

    AND THE LINE ALSO STATES WHAT THE CEILING BUYS, because that is where its last
    digits come from. An Atlas holds 6,000 and the ceiling reads 5,940; the sixty
    missing units are not a fee (there is none) but the fact that 6,000 alloy is not
    a whole number of deuterium and 5,940 is exactly sixty-six of them. Saying the
    worth turns a figure that looks shaved into one that means something.
  */
  /** The leg that needs the most room, which is the one setting the ceiling. */
  const returnDecides = quote.returnVolume > quote.outboundVolume;

  /*
    THE WALL COMES OFF THE SAME CALCULATION AS THE CEILING. D166.

    It used to be worked out here, with `rate[dear]` — while `largestOffer` capped
    the offer with `rate[cheap]`, the wall the RETURN leg sets. Two formulas for one
    number: giving deuterium with one Atlas at a world holding a hundred, the
    ceiling was 66 (the convoy) and this said "store", so the sheet told the player
    to wait for production when the fix was to add a ship.
  */
  const { wall } = offerCeiling(store, hold, give, rate);

  const keepsLine = t('trade.homeDefence', {
    ships: fleetCount(remainingFleet) + fleetCount(planet.ground),
    power: compact(holdingPower),
  });
  const splitLabel = t('trade.splitLabel');

  return (
    <Sheet
      detents={['full']}
      kit={{ tone: 'self' }}
      eyebrow={t('trade.sheetEyebrow', { duration: duration(minutesLeft) })}
      title={t('trade.sheetTitle')}
      onClose={onClose}
      footer={(
        <div className="gk gk-launch__commit">
          {/*
            THE PRICE, BEFORE THE BUTTON (K4, B14). The second screen said it after the
            decision; a trade that would go says it here: it cannot be turned, and for how
            long this world does without the ships.
          */}
          {refusal === null && (
            <div data-trade-warning className="gk-trade__warning">
              <p className="gk-inote" data-tone="warn"><Glyph id="warn" />
                {t('trade.warning', { duration: duration(route?.exposureMinutes ?? 0) })}
              </p>
              <p className="gk-sub">{t('trade.fleetsave')}</p>
            </div>
          )}
          <div data-testid="trade-commit">
            <RadiationPreview radiation={radiation} />
            {/* A trade spends the offer and the fuel: the kit's spend weight, one second. */}
            <GameHold
              weight="spends"
              glyph="share"
              label={t('trade.send')}
              /*
                A DISABLED CONTROL STATES ITS OWN REASON. `interface.md`: an unavailable
                action stays visible with the reason on it.
              */
              disabledReason={launchBlock !== null
                ? t(`faults.launchBlock.${launchBlock}`)
                : launch.isPending ? t('trade.sending') : refusal}
              onCommit={() => {
                launch.mutate(
                  { occurrenceId: merchant.id, fleet, give: offered, want,
                    ...(planet.honorBenefits ? { expectedHonorTier: planet.honorBenefits.tier } : {}),
                    ...(radiation && radiation.destroyed > 0 ? { acknowledgeRadiationLoss: true } : {}) },
                  {
                    onSuccess: (result) => {
                      say(t('trade.launched', { duration: duration(result.flightMinutes) }));
                      onLaunched();
                    },
                    onError: (error) => {
                      say(describe(error), 'error');
                      const count = radiationRefusalCount(error);
                      if (count !== null) setRadiationRefused({ count, fleet });
                    },
                  },
                );
              }}
            />
          </div>
        </div>
      )}
    >
      <div className="gk-trade">
      <HonorEffectQuote kind="trade" value={planet.honorBenefits} base={want} net={netWant} />

      {/*
        WHAT THIS WORLD IS LEFT HOLDING, on the transfer's garrison bar. A convoy is not an
        attack, so the departing slice is alloy rather than threat red — but the shape is the
        same, because the consequence is: those craft are not here while they are out there.
      */}
      <div className="gk-keeps">
        <div data-origin-defence className="gk-keeps__bar" role="img" aria-label={keepsLine}>
          <span data-part="holds" className="gk-keeps__holds" style={{ width: `${String(share(holdingPower, powerNow))}%` }} />
          <span data-part="leaves" className="gk-keeps__leaves" style={{ width: `${String(share(powerNow - holdingPower, powerNow))}%` }} />
        </div>
        <p className="gk-sub gk-num">{keepsLine}</p>
      </div>

      {/* ── the convoy, first, because it sets every maximum below ── */}
      <section className="gk-launch__fleet">
        <SectionTag as="h3">{t('trade.convoyHeading')}</SectionTag>
        {/*
          THE CARRIERS AND NOTHING ELSE. Owner instruction: *"Filo yollarken sadece cargo
          gemilerimizi seçebilmeliyiz."* A warship in a trade convoy takes hangar bulk, burns
          fuel and occupies the same flight bay while adding not one unit of hold —
          `transferCargoCapacity` counts the carriers and only them.

          THEY ARE LISTED WHETHER OR NOT THIS WORLD OWNS ONE: a commander with no Atlas
          otherwise saw no Atlas row, a hold of nothing, and the reason written nowhere.
        */}
        <div className="gk-ledger gk-launch__rows">
          {CARRIERS.map((id) => {
            const held = planet.fleet[id] ?? 0;
            const packed = fleet[id] ?? 0;
            const art = HULL_ART[id];
            return (
              <div key={id} data-hull-row={id} data-owned={held > 0 ? 'true' : 'false'} className="gk-lrow"
                {...(packed > 0 ? { 'data-chosen': '' } : {})}>
                <span data-art className="gk-lrow__art" {...(held > 0 ? {} : { 'data-none': '' })}>
                  {art ? <img src={art} alt="" aria-hidden width={36} height={36} loading="lazy" /> : <HullMark hull={id} className="gk-lrow__mark" />}
                </span>
                <span className="gk-lrow__name">{hullLabel(id)}</span>
                {held > 0
                  ? <span className="gk-sub gk-num gk-lrow__info">{t('trade.carrierRoom', { count: held, volume: full(holdOf(id, mods.tech)) })}</span>
                  : <span className="gk-sub gk-lrow__info" data-tone="warn">{t('trade.hullNone')}</span>}
                <QuantityStepper
                  look="kit"
                  value={packed}
                  min={0}
                  max={held}
                  onChange={(value) => { setShip(id, value); }}
                  decreaseLabel={t('trade.fewer', { name: hullLabel(id) })}
                  increaseLabel={t('trade.more', { name: hullLabel(id) })}
                  valueLabel={t('trade.quantity', { name: hullLabel(id) })}
                  maxLabel={t('trade.max', { name: hullLabel(id) })}
                  maxText={t('trade.maxShort')}
                />
              </div>
            );
          })}
        </div>
        {/*
          THE HOLD, AS ONE NUMBER, DIRECTLY UNDER WHAT SETS IT. The controls below cannot
          exceed it, so what is left to say is how much room this convoy has.
        */}
        <p data-testid="trade-hold" className="gk-inote" {...(carrying ? {} : { 'data-tone': 'warn' })}>
          <Glyph id={carrying ? 'crate' : 'warn'} />
          {carrying ? t('trade.holdReading', { volume: full(hold) }) : t('trade.holdNoCarrier')}
        </p>
        {/* A launch takes a flight bay; none free is the reason the send would refuse. */}
        <p className="gk-inote" {...(baysFree > 0 ? {} : { 'data-tone': 'warn' })}><Glyph id="bay" />
          {t('trade.baysReading', { used: planet.flight.used, total: planet.flight.total })}
        </p>
      </section>

      {/* ── what leaves ─────────────────────────────────────────── */}
      <section className="gk-launch__fleet">
        <SectionTag as="h3">{t('trade.offerHeading')}</SectionTag>
        <Choices
          label={t('trade.givePick')}
          options={(['alloy', 'crystal', 'deuterium'] as const).map((good) => ({ id: good, label: t(`trade.${good}`) }))}
          value={give}
          onChange={pickGive}
        />
        <div className="gk-well gk-cargo__row">
          {/*
            NO SPEND BAR HERE, AND THAT IS A REMOVAL RATHER THAN AN OMISSION. Owner report:
            *"Sliderlarda neden 'depodan çıkan' bölümü var?"* The figure states the amount and
            the line below its ceiling and why — which is the part that was actually missing.
          */}
          <span className="gk-cargo__head">
            <img src={RESOURCE_ART[give]} alt="" aria-hidden />
            <span className="gk-label">{t(`trade.${give}`)}</span>
          </span>
          <span data-testid="trade-offer" className="gk-num gk-trade__amount">{full(amount)}</span>
          <Slider
            label={t('trade.giveAmount', { resource: t(`trade.${give}`) })}
            value={amount}
            max={Math.max(step, top)}
            step={step}
            onChange={(value) => { setOffer(Math.max(0, Math.floor(value))); }}
          />
          {/*
            WHAT THE CEILING IS AND WHY. Owner report: *"benim maximumum ne belli değil."*
            The number alone is half an answer — the other half is whether to wait for the
            mine or add a ship, and only the wall knows that.
          */}
          <p data-testid="trade-ceiling" className="gk-sub gk-trade__wide">
            {t(wall === 'hold' ? 'trade.ceilingHold' : 'trade.ceilingStore', {
              amount: full(top),
              worth: full((top * rate[give]) / rate[dear]),
              good: t(`trade.${dear}`),
            })}
          </p>
        </div>
      </section>

      {/* ── what comes home ─────────────────────────────────────── */}
      <section className="gk-launch__fleet">
        <SectionTag as="h3" aside={t('trade.askUnits', { units: full(units) })}>{t('trade.askHeading')}</SectionTag>
        {/*
          BOTH ENDS OF THE SWAP, READ OFF ONE CONTROL. The units are already bought; all that
          is left is which goods they come home as. CHEAP LEFT, DEAR RIGHT — the order the
          handle moves in (owner): the slider's value IS the dear good, so dragging right buys
          more of it.
        */}
        <div data-testid="trade-split" className="gk-well gk-trade__split">
          <div className="gk-trade__ends">
            {([cheap, dear] as const).map((good) => (
              <span key={good} className="gk-trade__end">
                <img src={RESOURCE_ART[good]} alt="" aria-hidden />
                <span className="gk-trade__endwords">
                  <span className="gk-label">{t(`trade.${good}`)}</span>
                  <span data-take={good} className="gk-num gk-trade__take">{full(netWant[good])}</span>
                </span>
              </span>
            ))}
          </div>
          {units > 0
            ? <Slider label={splitLabel} value={want[dear]} min={splitFloor} max={Math.max(splitFloor, splitTop)}
                onChange={(value) => { setLead(Math.max(0, Math.floor(value))); }} />
            : <p className="gk-sub">{t('trade.noOffer')}</p>}
          <div className="gk-trade__toward gk-sub">
            <span>{t('trade.splitToward', { resource: t(`trade.${cheap}`) })}</span>
            <span>{t('trade.splitToward', { resource: t(`trade.${dear}`) })}</span>
          </div>
        </div>

        {/*
          WHY A FULL STORE STILL BUYS SO LITTLE. Owner report: *"Bir sürü döteryumum var ama
          örneğin sadece 20-30 tane verebiliyorum."* The convoy is sized by the leg that
          carries the most, and for a commander selling the dear good that is always the way
          HOME. BOTH LEGS ARE DRAWN AGAINST THE ROOM THEY COMPETE FOR (D142), and the sentence
          appears only when the return is the binding one.
        */}
        <div data-testid="trade-legs" className="gk-well gk-trade__legs">
          <dl className="gk-figures gk-trade__legfigs">
            <div className="gk-figure" {...(returnDecides ? {} : { 'data-binding': '' })}>
              <dt className="gk-label">{t('trade.legOut')}</dt>
              <dd className="gk-num gk-figure__value">{full(quote.outboundVolume)}</dd>
            </div>
            <div className="gk-figure" {...(returnDecides ? { 'data-binding': '' } : {})}>
              <dt className="gk-label">{t(planet.honorBenefits && planet.honorBenefits.tradePct > 0 ? 'honorBenefits.grossReturn' : 'trade.legHome')}</dt>
              <dd className="gk-num gk-figure__value">{full(quote.returnVolume)}</dd>
            </div>
            <div className="gk-figure">
              <dt className="gk-label">{t('trade.legHold')}</dt>
              <dd className="gk-num gk-figure__value">{full(hold)}</dd>
            </div>
          </dl>
          {planet.honorBenefits && planet.honorBenefits.tradePct > 0
            ? <p className="gk-sub">{t('honorBenefits.grossCargoRule')}</p> : null}
          {returnDecides && <p className="gk-inote" data-tone="warn"><Glyph id="warn" />{t('trade.legReturnDecides')}</p>}
        </div>
      </section>

      {/* ── the flight ──────────────────────────────────────────── */}
      <dl className="gk-well gk-figures gk-figures--well">
        <TradeFigure label={t('trade.figureOut')} value={route === null ? t('trade.figureNone') : duration(route.oneWayMinutes)}
          threat={route === null} />
        <TradeFigure label={t('trade.figureAway')} value={route === null ? t('trade.figureNone') : duration(route.exposureMinutes)} />
        <TradeFigure label={t('trade.figureDistance')} value={route === null ? t('trade.figureNone') : route.distance.toFixed(0)} />
      </dl>

      {fuel > 0 && (
        <div data-testid="trade-fuel" className="gk-well gk-cargo__fuel">
          {/*
            THE TANK, MINUS WHAT THE MERCHANT WAS PAID. `assertFuel`'s guard is on the SUM —
            deuterium in a hold has already left this world as far as the flight is concerned —
            so offering the last of the tank visibly eats the fuel bar. D136.
          */}
          <SpendBar inline stock={spendableDeuterium} spend={fuel} tone="deuterium" label={t('trade.fuel')} />
        </div>
      )}
      </div>
    </Sheet>
  );
}

/**
 * What one of each carrier adds to the hold — stated on its own row, not inferred.
 *
 * TAKES THE COMMANDER'S TECH SINCE D180: `CARGO_HOLDS` lifts this figure, so a row
 * quoting the catalogue would disagree with the convoy total printed above it on
 * the same screen.
 */
const holdOf = (id: HullId, tech: TechLevels): number => transferCargoCapacity({ [id]: 1 }, tech);

/** A figure of the flight, in the kit's figure; red when it is why the send will refuse. */
function TradeFigure({ label, value, threat = false }: { label: string; value: string; threat?: boolean }) {
  return (
    <div className="gk-figure">
      <dt className="gk-label">{label}</dt>
      <dd className="gk-num gk-figure__value" {...(threat ? { 'data-tone': 'hostile' } : {})}>{value}</dd>
    </div>
  );
}
