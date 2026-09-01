import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  HULLS,
  fleetCount,
  fleetPower,
  hullFuelRate,
  type Fleet,
  type MobileHullId,
} from '@astera/rules';
import { useLaunch } from '../api/queries.js';
import type { GalaxyPlanet, PlanetView } from '../api/schemas.js';
import { hullLabel } from '../i18n/names.js';
import { compact } from '../lib/format.js';
import { duration } from '../lib/time.js';
import { MOBILE, planRoute, techOf } from '../lib/navigation.js';
import { StatStrip } from '../ui/Action.js';
import { CapacityBar } from '../ui/CapacityBar.js';
import { SpendBar } from '../ui/SpendBar.js';
import { HULL_ART } from '../ui/assets.js';
import { HullMark } from '../ui/icons/hulls.js';
import { QuantityStepper } from '../ui/QuantityStepper.js';
import { Button, Sheet } from '../ui/kit/index.js';
import { describe, useToast } from '../ui/Toast.js';

/**
 * The commitment.
 *
 * This screen is built around one line — home defence after launch, and for how
 * long — because that is the actual bet. A fleet in flight is a fleet that is not
 * defending you, and the player must feel that before pressing the button, not
 * discover it when someone else's fleet lands.
 *
 * There is no recall endpoint and there is not going to be one.
 */
export function LaunchSheet({
  target,
  planet,
  onClose,
  onLaunched,
}: {
  target: GalaxyPlanet;
  planet: PlanetView;
  onClose: () => void;
  onLaunched: () => void;
}) {
  const { t } = useTranslation();
  const launch = useLaunch();
  const say = useToast();
  const [sending, setSending] = useState<Fleet>({});
  const [confirming, setConfirming] = useState(false);

  // The commander's own ladders, off the payload, so the preview quotes exactly
  // what the server will charge and carry. T8.
  const tech = techOf(planet);
  const route = planRoute(
    planet.planet.position, target.position, sending, planet.fleet, planet.ground, tech,
  );
  const total = fleetCount(sending);
  const canSend = total > 0
    && route.oneWayMinutes > 0
    // The server refuses this too; offering a control that cannot work is worse
    // than refusing early, because it teaches a rule that is not true.
    && route.fuel <= planet.planet.deuterium;

  /**
   * WHERE THE REST OF THE FLEET IS. Owner report.
   *
   * `planet.fleet` is only what is STANDING on this world, which is the right
   * number to offer — nothing in the air can be launched again. But a hull that
   * is entirely away loses its row altogether, so the sheet read as a fleet that
   * had shrunk, with nothing on it to say why. A raid is a twelve-minute round
   * trip and a mining run is longer; players forget what they sent.
   *
   * MOBILE hulls only. `fleetAway` also carries Prospectors out on a run, and
   * naming those here would promise a craft this sheet can never send.
   *
   * THE SENTENCE MAY NOT PROMISE A RETURN. `fleetAway` is every unit of this
   * world whose `location` is not `home`, and a transfer or a settlement fleet
   * never comes back — `resolveTransfer` and `resolveSettlement` hand it to the
   * destination world for good. So the caption says what is true of every mission
   * kind: these are away, and only what is standing here can be sent.
   */
  const away = MOBILE.map((hull) => ({ hull, count: planet.fleetAway[hull] ?? 0 })).filter(
    (entry) => entry.count > 0,
  );
  /**
   * Launchable ships at home — NOT `fleetCount(planet.fleet)`, which counts the
   * Prospector too. A world whose only craft at home was a miner showed an empty
   * list and no explanation for it.
   */
  const atHome = MOBILE.reduce((sum, hull) => sum + (planet.fleet[hull] ?? 0), 0);

  /**
   * THE BET, AS A QUANTITY THAT CAN BE DRAWN. Owner instruction.
   *
   * The headline of this sheet has always been a COUNT of units left holding, and
   * a count is the wrong measure of a garrison: twelve Wasps and three Bulwarks
   * are the same number and not remotely the same defence. Power is what decides
   * the fight, so power is what the bar is made of — and the split between what
   * stays and what leaves is the whole decision, drawn as the thing being taken
   * away from the thing that remains.
   *
   * The unit count stays underneath as the caption, because it is the figure the
   * launch toast and the confirmation sentence both quote and the two must agree.
   */
  const standing = { ...planet.fleet, ...planet.ground };
  const powerNow = fleetPower(standing);
  const powerLeaving = fleetPower(sending);
  const powerHolding = Math.max(0, powerNow - powerLeaving);

  const set = (hull: MobileHullId, value: number): void => {
    const available = planet.fleet[hull] ?? 0;
    setSending((current) => ({ ...current, [hull]: Math.max(0, Math.min(available, value)) }));
  };

  return (
    <Sheet
      eyebrow={t('launch.eyebrow')}
      /**
       * A WORLD YOU CANNOT SEE HAS NO NAME TO PUT HERE. D127.
       *
       * `name` is omitted for an unsurveyed world and the schema fills it with an
       * empty string, so the single most important commitment surface in the game
       * — the one where a fleet becomes irreversible — opened with a BLANK TITLE.
       * The launch itself is legitimate and stays: diving blind is the choice D127
       * exists to create. What it may not do is look broken while you make it.
       */
      title={target.intel === 'UNKNOWN' ? t('focus.planet.unsurveyedTitle') : target.name}
      onClose={onClose}
      footer={
        confirming ? (
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={() => {
                setConfirming(false);
              }}
            >
              {t('launch.back')}
            </Button>
            <Button
              variant="commit"
              size="lg"
              className="flex-[2]"
              disabled={launch.isPending}
              onClick={() => {
                launch.mutate(
                  { targetPlanetId: target.id, fleet: sending },
                  {
                    onSuccess: (result) => {
                      say(
                        t('launch.launched', {
                          duration: duration(result.exposureMinutes),
                          count: result.homeDefenceAfter,
                        }),
                      );
                      onLaunched();
                    },
                    onError: (err) => {
                      say(describe(err), 'error');
                      setConfirming(false);
                    },
                  },
                );
              }}
            >
              {launch.isPending ? t('launch.launching') : t('launch.commit')}
            </Button>
          </div>
        ) : (
          <Button
            variant="commit"
            size="lg"
            full
            disabled={!canSend}
            onClick={() => {
              setConfirming(true);
            }}
          >
            {total === 0 ? t('launch.chooseFleet') : t('launch.send', { count: total })}
          </Button>
        )
      }
    >
      {/*
        THE LINE. Everything else on this sheet is supporting detail — and it is
        now a SHAPE, because the one thing a commander is deciding here is how much
        of their own defence to take away from themselves.

        THE BAR IS THE GARRISON. What holds is solid bone; what leaves is carved
        off the right-hand end in threat red and hatched, so a fleet being packed
        looks like the wall coming down. Nothing about that needs reading, and
        pressing "+" on a Bulwark takes a visibly bigger bite than pressing it on a
        Wasp — which is the counter cycle teaching itself at the moment it matters.

        THE TWO FIGURES ARE THE SAME TWO THE SHEET HAS ALWAYS SHOWN: how many units
        hold, and for how long they are alone. They are captions now.
      */}
      <div className="plate plate-threat mt-1 px-3 py-3">
        <p className="legend text-threat-ink">{t('launch.whileAway')}</p>

        <div
          data-defence-bar
          className="socket mt-3 flex h-3.5 w-full overflow-hidden rounded-full"
          role="img"
          aria-label={t('launch.defenceReading', {
            holds: compact(powerHolding),
            leaves: compact(powerLeaving),
          })}
        >
          <span
            data-part="holds"
            className="h-full bg-bone/60 transition-[width] duration-200"
            style={{ width: `${String(barShare(powerHolding, powerNow))}%` }}
          />
          <span
            data-part="leaves"
            className="h-full bg-threat/70 transition-[width] duration-200"
            style={{
              width: `${String(barShare(powerLeaving, powerNow))}%`,
              backgroundImage:
                'repeating-linear-gradient(45deg, rgb(0 0 0 / 28%) 0 3px, transparent 3px 6px)',
            }}
          />
        </div>

        <div className="mt-2 flex items-baseline justify-between gap-3">
          <p className="num text-title leading-tight text-bone">
            {t('launch.defending', { count: route.homeDefenceAfter })}
          </p>
          <p className="num text-body text-threat-ink">
            {total === 0
              ? t('launch.nothingSent')
              : t('launch.exposedFor', { duration: duration(route.exposureMinutes) })}
          </p>
        </div>
      </div>

      {/*
        THE FLIGHT, IN THREE FIGURES AND ONE PICTURE.

        Time, cargo and distance stay as numerals — a duration is one of the few
        quantities that reads faster written than drawn, and the other two have no
        ceiling to draw them against. FUEL has one, and it is the tank: a spend
        against a store is exactly the shape `SpendBar` exists for, and it replaces
        a figure that went red with no way of telling whether the player was ten
        deuterium short or a thousand.
      */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        <Figure
          label={t('launch.oneWay')}
          value={
            route.oneWayMinutes > 0 ? duration(route.oneWayMinutes) : t('launch.oneWayUnknown')
          }
        />
        <Figure label={t('launch.cargo')} value={compact(route.cargo)} />
        <Figure label={t('launch.distance')} value={route.distance.toFixed(0)} />
      </div>
      {route.fuel > 0 && (
        <div className="plate mt-3 px-3 py-3">
          <SpendBar
            stock={planet.planet.deuterium}
            spend={route.fuel}
            tone="deuterium"
            label={t('launch.fuel')}
          />
        </div>
      )}
      {planet.capacity && (
        <div className="mt-3">
          <CapacityBar
            total={planet.capacity.hangar}
            used={planet.capacity.hangarUsed}
            incoming={0}
            label={t('launch.hangarLabel')}
          />
          {/*
            THE BAR CARRIES THE FIGURES; THE SENTENCE CARRIES THE RULE that no
            picture can — that a fleet in the air still occupies this world's
            hangar, so launching frees nothing.
          */}
          <p className="mt-2 text-caption leading-snug text-faint">{t('launch.hangarNote')}</p>
        </div>
      )}

      <div className="mt-6">
        <p className="legend mb-2">{t('launch.fleetHeading')}</p>
        {/*
          WHAT IS ALREADY IN THE AIR, DRAWN AS THE SHIPS THEMSELVES. Owner report.

          This was a joined sentence — "2 Wasp · 1 Hauler away on a flight" — sitting
          above a list of art wells, so the one question it answers ("where did my
          Haulers go") was the only thing on the sheet a player had to READ rather
          than recognise. The same hulls now appear as their own renders, greyed and
          at half size, in a row that is visibly OUTSIDE the picker below it. Absent
          and accounted for, which is a different thing from gone.
        */}
        {away.length > 0 && (
          <div data-away className="mb-3 flex flex-wrap items-center gap-2">
            {away.map((entry) => {
              // Bound to a local: TS narrows an element access by a `const` key,
              // never by a property, so `HULL_ART[entry.hull]` stays `string | null`.
              const art = HULL_ART[entry.hull];
              return (
              <span
                key={entry.hull}
                className="flex items-center gap-1.5 rounded-chip border border-dashed border-line px-2 py-1"
                title={hullLabel(entry.hull)}
              >
                {art ? (
                  <img
                    src={art}
                    alt=""
                    aria-hidden
                    className="size-6 object-contain opacity-40 grayscale"
                    loading="lazy"
                  />
                ) : (
                  <HullMark hull={entry.hull} className="size-5 text-faint" />
                )}
                <span className="num text-label text-faint">
                  {t('launch.awayHull', { count: entry.count, name: hullLabel(entry.hull) })}
                </span>
              </span>
              );
            })}
            <span className="sr-only">
              {t('launch.away', {
                fleet: away
                  .map((entry) =>
                    t('launch.awayHull', { count: entry.count, name: hullLabel(entry.hull) }),
                  )
                  .join(t('launch.awaySeparator')),
              })}
            </span>
          </div>
        )}
        {MOBILE.map((hull) => {
          const available = planet.fleet[hull] ?? 0;
          const chosen = sending[hull] ?? 0;
          if (available === 0) return null;
          return (
            <div
              key={hull}
              className={`border-b border-line-soft py-3 px-1 ${chosen > 0 ? 'bg-crystal/[0.05]' : ''}`}
            >
              {/*
                THE SHIP, NOT ITS NAME.
                This picker used to be a name and a speed, which is the one place
                in the game a player is actually choosing between hulls and the one
                place they were given nothing to choose WITH. The counter cycle is
                the whole of combat, and it is decided by these four numbers.
              */}
              <div className="flex items-center gap-3">
                <div data-art className="socket size-12 shrink-0 rounded-control">
                  {HULL_ART[hull] ? (
                    <img
                      src={HULL_ART[hull]}
                      alt=""
                      aria-hidden
                      className="size-11 object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <HullMark hull={hull} className="size-7 text-dim" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <p className="name text-bone">
                      {hullLabel(hull)}
                    </p>
                    <span className="num text-label text-faint">
                      {t('launch.atHome', { count: available })}
                    </span>
                  </div>
                  <div className="mt-1">
                    <StatStrip
                      atk={HULLS[hull].atk}
                      hp={HULLS[hull].hp}
                      speed={HULLS[hull].speed}
                      cargo={HULLS[hull].cargo}
                      fuel={hullFuelRate(hull)}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-2">
                <QuantityStepper
                  value={chosen}
                  min={0}
                  max={available}
                  onChange={(value) => { set(hull, value); }}
                  decreaseLabel={t('launch.fewer', { name: hullLabel(hull) })}
                  increaseLabel={t('launch.more', { name: hullLabel(hull) })}
                  valueLabel={t('launch.quantity', { name: hullLabel(hull) })}
                  editable
                  maxLabel={t('launch.max', { name: hullLabel(hull) })}
                  maxText={t('launch.maxShort')}
                />
              </div>
            </div>
          );
        })}
        {atHome === 0 && <p className="text-body text-dim">{t('launch.noShips')}</p>}
      </div>

      {confirming && (
        <>
          <p className="mt-6 text-body leading-relaxed text-threat-ink">
            {t('launch.warning', { count: route.homeDefenceAfter })}
          </p>
          {/*
            THE CHEAPEST DEPTH IN THE GAME. D28.

            A fleet in flight is already untouchable — nothing can be raided that is
            not on the ground — and the player was never told. In OGame this same
            rule is called fleetsave and it took their players years to discover on
            their own; it is the single most important behaviour in that game and
            nobody designed it.

            Saying it out loud turns an existing rule into a strategy, and it makes
            the sentence above cut both ways: a launch is a risk to your planet AND
            the only way to make your fleet safe. That is a real decision, and it
            costs one line of text.
          */}
          <p className="mt-2 text-body leading-relaxed text-dim">{t('launch.fleetsave')}</p>
        </>
      )}
    </Sheet>
  );
}

/**
 * A part's share of a whole, clamped, with an empty garrison drawing nothing.
 *
 * `powerNow` is zero on a world with no craft standing at all — every hull away,
 * no ground guns — and dividing by it would put `NaN%` into a style attribute.
 */
const barShare = (part: number, whole: number): number =>
  whole <= 0 ? 0 : Math.max(0, Math.min(100, (part / whole) * 100));

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
