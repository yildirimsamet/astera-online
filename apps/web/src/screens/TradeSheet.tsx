import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TRANSFER_CARGO_HULLS,
  fleetCount,
  fleetPower,
  fleetSpeedMult,
  quoteTrade,
  transferCargoCapacity,
  type Fleet,
  type HullId,
  type Resources,
  type TradeQuote,
} from '@astera/rules';
import { useLaunchTrade } from '../api/queries.js';
import type { PlanetView } from '../api/schemas.js';
import { hullLabel } from '../i18n/names.js';
import { compact, full } from '../lib/format.js';
import { planTradeRoute, techOf } from '../lib/navigation.js';
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
import { SpendBar } from '../ui/SpendBar.js';
import { Tally } from '../ui/Tally.js';
import { HullMark } from '../ui/icons/hulls.js';
import { Button, Segmented, Sheet } from '../ui/kit/index.js';
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
 * The owner's own worked example is the acceptance test: offer 180 alloy and the
 * counter opens at two deuterium; drag it down one notch and the rest comes home
 * as thirty crystal. Nothing to reconcile, nothing to top up, no dead button.
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
 * A world whose every craft is already away has no defence power at all, and
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
  const [confirming, setConfirming] = useState(false);

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

  const tech = techOf(planet);
  const speedMult = fleetSpeedMult(planet.effectiveOrbit ?? planet.orbit);

  const { rate } = merchant;
  const hold = transferCargoCapacity(fleet);

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
    tech,
    speedMult,
  );
  const fuel = route?.fuel ?? 0;

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
    ships === 0 ? t('trade.chooseFleet')
    : !windowOpen ? t('trade.windowClosed')
    : baysFree <= 0 ? t('trade.noBay')
    : !carrying ? t('trade.needsCarrier')
    : quote.refusal === 'EMPTY_GIVE' ? t('trade.noOffer')
    : quote.refusal === 'EMPTY_WANT' ? t('trade.noAsk')
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
    const room = transferCargoCapacity(next);
    const ceiling = largestOffer(store, room, give, rate);
    setFleet(next);
    if (offer >= top) setOffer(ceiling);
    setConfirming(false);
  };

  const pickGive = (good: TradeGood): void => {
    setGive(good);
    setOffer(largestOffer(Math.floor(planet.planet[good]), hold, good, rate));
    setLead(null);
    setConfirming(false);
  };

  const remainingFleet = useMemo<Fleet>(() => Object.fromEntries(
    (Object.keys(planet.fleet) as HullId[]).map((id) => [
      id,
      Math.max(0, (planet.fleet[id] ?? 0) - (fleet[id] ?? 0)),
    ]),
  ), [fleet, planet.fleet]);
  const holdingPower = fleetPower({ ...remainingFleet, ...planet.ground });
  const powerNow = fleetPower({ ...planet.fleet, ...planet.ground });

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

  return (
    <Sheet
      eyebrow={t('trade.sheetEyebrow', { duration: duration(minutesLeft) })}
      title={t('trade.sheetTitle')}
      onClose={onClose}
      footer={
        confirming ? (
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={() => { setConfirming(false); }}
            >
              {t('trade.back')}
            </Button>
            <Button
              testId="trade-confirm"
              variant="commit"
              size="lg"
              className="flex-[2]"
              disabled={launch.isPending}
              onClick={() => {
                launch.mutate(
                  {
                    occurrenceId: merchant.id,
                    fleet,
                    give: offered,
                    want,
                  },
                  {
                    onSuccess: (result) => {
                      say(t('trade.launched', { duration: duration(result.flightMinutes) }));
                      onLaunched();
                    },
                    onError: (error) => {
                      say(describe(error), 'error');
                      setConfirming(false);
                    },
                  },
                );
              }}
            >
              {launch.isPending ? t('trade.sending') : t('trade.commit')}
            </Button>
          </div>
        ) : (
          <Button
            testId="trade-commit"
            variant="commit"
            size="lg"
            full
            disabled={refusal !== null}
            onClick={() => { setConfirming(true); }}
          >
            {/*
              A DISABLED CONTROL STATES ITS OWN REASON. `interface.md`: an
              unavailable action stays visible with the reason on it, because a
              button that simply will not press teaches nothing.
            */}
            {refusal ?? t('trade.send')}
          </Button>
        )
      }
    >
      {/* ── the convoy, first, because it sets every maximum below ── */}
      <h3 className="legend mt-1">{t('trade.convoyHeading')}</h3>
      <div className="mt-2 space-y-2">
        {/*
          THE THREE CARRIERS AND NOTHING ELSE. Owner instruction: *"Filo yollarken
          sadece cargo gemilerimizi seçebilmeliyiz."* A warship in a trade convoy
          takes hangar bulk, burns fuel and occupies the same flight bay while
          adding not one unit of hold — `transferCargoCapacity` counts these three
          and only these three. Offering the rest was `TransferSheet`'s shape
          inherited without its reason: that screen moves ships between worlds as
          well as ore, and this one does not.

          THEY ARE LISTED WHETHER OR NOT THIS WORLD OWNS ONE, which is the lesson
          the transfer sheet had to learn first: a commander with no Atlas otherwise
          saw no Atlas row, a hold of nothing, and the reason written nowhere.
        */}
        {CARRIERS.map((id) => {
          const held = planet.fleet[id] ?? 0;
          const art = HULL_ART[id];
          return (
            <div
              key={id}
              data-hull-row={id}
              data-owned={held > 0 ? 'true' : 'false'}
              className={`min-h-14 rounded-chip border border-line-soft px-3 py-2 ${
                (fleet[id] ?? 0) > 0 ? 'bg-crystal/[0.05]' : ''
              }`}
            >
              <div className="flex items-center gap-2">
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
                  <span className="name block truncate text-bone">{hullLabel(id)}</span>
                  <span className="num mt-1 block text-label text-dim">
                    {held > 0
                      ? t('trade.carrierRoom', { count: held, volume: full(holdOf(id)) })
                      : t('trade.hullNone')}
                  </span>
                </span>
              </div>
              <div className="mt-2">
                <QuantityStepper
                  value={fleet[id] ?? 0}
                  min={0}
                  max={held}
                  onChange={(value) => { setShip(id, value); }}
                  decreaseLabel={t('trade.fewer', { name: hullLabel(id) })}
                  increaseLabel={t('trade.more', { name: hullLabel(id) })}
                  valueLabel={t('trade.quantity', { name: hullLabel(id) })}
                  editable
                  maxLabel={t('trade.max', { name: hullLabel(id) })}
                  maxText={t('trade.maxShort')}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/*
        THE HOLD, AS ONE NUMBER, DIRECTLY UNDER WHAT SETS IT. A bar was drawn here
        before, against a demand the player was expected to keep inside by hand.
        There is nothing to keep inside any more — the controls below cannot exceed
        it — so what is left to say is how much room this convoy has.
      */}
      <p
        data-testid="trade-hold"
        className={`mt-3 text-body ${carrying ? 'text-dim' : 'text-alloy'}`}
      >
        {carrying
          ? t('trade.holdReading', { volume: full(hold) })
          : t('trade.holdNoCarrier')}
      </p>

      {/* ── what leaves ─────────────────────────────────────────── */}
      <h3 className="legend mt-5">{t('trade.offerHeading')}</h3>
      <Segmented
        className="mt-2"
        label={t('trade.givePick')}
        segments={(['alloy', 'crystal', 'deuterium'] as const).map((good) => ({
          id: good,
          label: t(`trade.${good}`),
        }))}
        value={give}
        onSelect={pickGive}
      />
      <label className="mt-2 block rounded-chip border border-line-soft bg-deep/55 px-3 py-3">
        <span className="flex items-center gap-2">
          <img
            src={RESOURCE_ART[give]}
            alt=""
            aria-hidden
            className="size-4 shrink-0 object-contain"
          />
          <span className="legend flex-1 text-dim">{t(`trade.${give}`)}</span>
          <span data-testid="trade-offer" className="num shrink-0 text-title text-bone">
            {full(amount)}
          </span>
        </span>
        {/*
          NO SPEND BAR HERE, AND THAT IS A REMOVAL RATHER THAN AN OMISSION. Owner
          report: *"Sliderlarda neden 'depodan çıkan' bölümü var? Zaten ne kadar
          göndereceğimi seçiyorum, hemen üstünde de aynı şeyi gösteriyor."* The
          figure, the bar and the slider were three drawings of one number. The
          readout above states it and the line below states its ceiling and why —
          which is the part that was actually missing. The fuel bar further down
          keeps its `SpendBar` because deuterium in a hold and deuterium in a tank
          are two different quantities competing for one store (D136).
        */}
        <input
          type="range"
          min={0}
          max={Math.max(step, top)}
          step={step}
          value={amount}
          aria-label={t('trade.giveAmount', { resource: t(`trade.${give}`) })}
          onChange={(event) => {
            setOffer(Math.max(0, Math.floor(event.currentTarget.valueAsNumber || 0)));
            setConfirming(false);
          }}
          style={{ '--slider-fill': `${String(share(amount, Math.max(1, top)))}%` } as CSSProperties}
          className={`slider slider-${give} mt-2 w-full`}
        />
        {/*
          WHAT THE CEILING IS AND WHY. Owner report: *"benim maximumum ne belli
          değil."* The number alone is half an answer — the other half is whether
          to wait for the mine or add a ship, and only the wall knows that.
        */}
        <span data-testid="trade-ceiling" className="mt-2 block text-caption text-faint">
          {t(wall === 'hold' ? 'trade.ceilingHold' : 'trade.ceilingStore', {
            amount: full(top),
            worth: full((top * rate[give]) / rate[dear]),
            good: t(`trade.${dear}`),
          })}
        </span>
      </label>

      {/* ── what comes home ─────────────────────────────────────── */}
      <h3 className="legend mt-5">
        {t('trade.askHeading')}
        <span className="num ml-2 text-dim">{t('trade.askUnits', { units: full(units) })}</span>
      </h3>
      <div
        data-testid="trade-split"
        className="mt-2 rounded-chip border border-line-soft bg-deep/55 px-3 py-3"
      >
        {/*
          BOTH ENDS OF THE SWAP, READ OFF ONE CONTROL. The units are already bought;
          all that is left is which goods they come home as. Two independent amounts
          would let a player pay for units they never collect, which is the leftover
          the first sheet had to invent a "use it all" button to clean up after.
        */}
        {/*
          CHEAP LEFT, DEAR RIGHT — THE ORDER THE HANDLE MOVES IN. Owner instruction:
          *"Al kısmında alınan, yani tercih edilen sağda olmalı, çünkü slider'ı o
          tarafa doğru çekiyoruz."* The slider's value IS the dear good, so dragging
          right buys more of it; the readouts sat dear-first, which put the number
          that grows on the far side of the control that grows it.
        */}
        <div className="flex items-center gap-2">
          {([cheap, dear] as const).map((good, index) => (
            <span key={good} className={`flex min-w-0 flex-1 items-center gap-2 ${index % 2 === 1 ? 'flex-row-reverse' : ''}`}>
              <img
                src={RESOURCE_ART[good]}
                alt=""
                aria-hidden
                className="size-5 shrink-0 object-contain"
              />
              <span className="min-w-0">
                <span className="legend block truncate text-dim">{t(`trade.${good}`)}</span>
                <span data-take={good} className="num block text-title text-bone">
                  {full(want[good])}
                </span>
              </span>
            </span>
          ))}
        </div>
        <input
          type="range"
          min={splitFloor}
          max={Math.max(splitFloor, splitTop)}
          step={1}
          value={want[dear]}
          disabled={units <= 0}
          aria-label={t('trade.splitLabel')}
          onChange={(event) => {
            setLead(Math.max(0, Math.floor(event.currentTarget.valueAsNumber || 0)));
            setConfirming(false);
          }}
          style={{
            '--slider-fill': `${String(share(want[dear] - splitFloor, Math.max(1, splitTop - splitFloor)))}%`,
          } as CSSProperties}
          className={`slider slider-${dear} mt-3 w-full`}
        />
        <div className="mt-2 flex justify-between text-caption text-faint">
          <span>{t('trade.splitToward', { resource: t(`trade.${cheap}`) })}</span>
          <span>{t('trade.splitToward', { resource: t(`trade.${dear}`) })}</span>
        </div>
      </div>

      {/*
        WHY A FULL STORE STILL BUYS SO LITTLE. Owner report: *"Bir sürü döteryumum
        var ama örneğin sadece 20-30 tane verebiliyorum."*

        Because the convoy is sized by the leg that carries the most, and for a
        commander selling the dear good that is always the way HOME: twenty
        deuterium is twenty units of hold going out and eighteen hundred coming
        back. The screen stated the ceiling and named what it bought, and never once
        said which of the two legs had set it — so six thousand of hold beside an
        offer of thirty-two read as a bug rather than as the trade-off it is.

        BOTH LEGS ARE DRAWN AGAINST THE ROOM THEY COMPETE FOR (D142), and the
        sentence appears only when the return is the binding one — the other way
        round it would be noise on a screen that already has enough.
      */}
      <div data-testid="trade-legs" className="plate mt-3 px-3 py-2">
        <div className="flex items-baseline justify-between gap-2 text-caption">
          <span className="text-faint">{t('trade.legOut')}</span>
          <span className={`num ${returnDecides ? 'text-dim' : 'text-bone'}`}>
            {full(quote.outboundVolume)}
          </span>
          <span className="text-faint">{t('trade.legHome')}</span>
          <span className={`num ${returnDecides ? 'text-bone' : 'text-dim'}`}>
            {full(quote.returnVolume)}
          </span>
          <span className="text-faint">{t('trade.legHold')}</span>
          <span className="num text-dim">{full(hold)}</span>
        </div>
        {returnDecides && (
          <p className="mt-2 text-caption leading-snug text-alloy">
            {t('trade.legReturnDecides')}
          </p>
        )}
      </div>

      {/* ── the flight ──────────────────────────────────────────── */}
      <div className="mt-5 grid grid-cols-3 gap-2">
        <Figure
          label={t('trade.figureOut')}
          value={route === null ? t('trade.figureNone') : duration(route.oneWayMinutes)}
          tone={route === null ? 'threat' : undefined}
        />
        <Figure
          label={t('trade.figureAway')}
          value={route === null ? t('trade.figureNone') : duration(route.exposureMinutes)}
        />
        <Figure
          label={t('trade.figureDistance')}
          value={route === null ? t('trade.figureNone') : route.distance.toFixed(0)}
        />
      </div>

      {fuel > 0 && (
        <div data-testid="trade-fuel" className="plate mt-3 px-3 py-3">
          {/*
            THE TANK, MINUS WHAT THE MERCHANT WAS PAID. `assertFuel`'s guard is on
            the SUM — deuterium in a hold has already left this world as far as the
            flight is concerned — so offering the last of the tank visibly eats the
            fuel bar rather than producing a refusal with nothing on screen to
            explain it. D136.
          */}
          <SpendBar
            stock={spendableDeuterium}
            spend={fuel}
            tone="deuterium"
            label={t('trade.fuel')}
          />
        </div>
      )}

      {/* A launch takes a flight bay, and a rack this small is counted, not read. */}
      <div className="mt-3 flex items-center gap-2">
        <span className="legend flex-1 text-dim">{t('trade.bays')}</span>
        <Tally
          used={planet.flight.used}
          total={planet.flight.total}
          label={t('trade.baysReading', {
            used: planet.flight.used,
            total: planet.flight.total,
          })}
          tone={baysFree > 0 ? 'crystal' : 'alloy'}
        />
      </div>

      {/*
        WHAT THIS WORLD IS LEFT HOLDING, drawn the way both neighbouring sheets
        draw it. A convoy is not an attack, so the departing slice is alloy rather
        than threat red — but the shape is deliberately the same, because the
        consequence is: those craft are not here while they are out there.
      */}
      <div
        data-origin-defence
        className="socket mt-3 flex h-3 w-full overflow-hidden rounded-full"
        role="img"
        aria-label={t('trade.homeDefence', {
          ships: fleetCount(remainingFleet) + fleetCount(planet.ground),
          power: compact(holdingPower),
        })}
      >
        <span
          data-part="holds"
          className="h-full bg-bone/60 transition-[width] duration-200"
          style={{ width: `${String(share(holdingPower, powerNow))}%` }}
        />
        <span
          data-part="leaves"
          className="h-full bg-alloy/70 transition-[width] duration-200"
          style={{ width: `${String(share(powerNow - holdingPower, powerNow))}%` }}
        />
      </div>
      <p className="mt-2 text-label text-dim">
        {t('trade.homeDefence', {
          ships: fleetCount(remainingFleet) + fleetCount(planet.ground),
          power: compact(holdingPower),
        })}
      </p>

      {confirming && (
        <>
          <p className="mt-6 text-body leading-relaxed text-threat-ink">
            {t('trade.warning', {
              duration: duration(route?.exposureMinutes ?? 0),
            })}
          </p>
          <p className="mt-2 text-body leading-relaxed text-dim">{t('trade.fleetsave')}</p>
        </>
      )}
    </Sheet>
  );
}

/** What one of each carrier adds to the hold — stated on its own row, not inferred. */
const holdOf = (id: HullId): number => transferCargoCapacity({ [id]: 1 });

function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  /** Red for a figure that is the reason the commit will refuse. */
  tone?: 'threat';
}) {
  return (
    <div>
      <p className="legend">{label}</p>
      <p className={`num mt-1 text-title ${tone === 'threat' ? 'text-threat-ink' : 'text-bone'}`}>
        {value}
      </p>
    </div>
  );
}
