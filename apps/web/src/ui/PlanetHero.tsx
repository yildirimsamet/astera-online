import {
  DEATH_STAR,
  HULLS,
  combatValue,
  coreTier,
  fleetCount,
  fleetEntries,
  garrisonOf,
  satelliteSlots,
  unarmedCount,
} from '@astera/rules';
import { Fragment, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { PlanetView } from '../api/schemas.js';
import { satelliteLabel } from '../i18n/names.js';
import { compact, full } from '../lib/format.js';
import { projectedQueueState } from '../lib/predict.js';
import { countdown, duration, useNow } from '../lib/time.js';
import { SATELLITE_ART } from './assets.js';
import { FleetCards } from './FleetCards.js';
import { Banner, Glyph, ProgressBar, StoreGauge, type GlyphId } from '../game-ui/index.js';
import { PlanetSigil } from './PlanetSigil.js';
import { StarField } from '../v2/kit/StarField.js';

/**
 * "This is MY planet."
 *
 * The ownership pillar is carried by an image, not a heading. The planet is the
 * largest object on the Base; the satellites orbit it; the shield encloses it. A
 * player who buys a satellite should see it appear overhead, and that is the entire
 * feedback loop for a screen full of purchases.
 *
 * UNDERNEATH, ONE PRODUCTION ROW (E5, the mock's Base): what each resource brings in,
 * how full its store is, and the part of it the Vault keeps from a raid. What the hero
 * used to stack under the world as well — firepower, the defence and shield verdicts,
 * the fleet — answers "can this world hold?", so it opens the Defence tab instead
 * (`DefenceReadings`). Nothing was dropped; each fact moved to the question it answers.
 */
/**
 * A COLONY'S LOYALTY IN ONE ROW: the bar, the figure, and how long it lasts at this rate. The
 * hero and the fault sheet draw it alike, so the two never disagree about how long a world has.
 */
export function LoyaltyRow({ loyalty }: { loyalty: { value: number; minutesLeft: number | null } }) {
  const { t } = useTranslation();
  return (
    <div className="gk-loyalty__row">
      <span className="gk-label">{t('faults.loyalty.title')}</span>
      <span className="gk-bar gk-loyalty__bar">
        <span
          data-loyalty-bar
          className={`gk-bar__fill ${loyalty.value <= 25 ? 'gk-fill-hostile' : 'gk-fill-self'}`}
          style={{ width: `${String(Math.max(2, Math.round(loyalty.value)))}%` }}
        />
      </span>
      <span className="gk-loyalty__value gk-num">{t('faults.loyalty.bar', { value: Math.round(loyalty.value) })}</span>
      {loyalty.minutesLeft !== null && (
        <span className="gk-sub gk-num">{t('faults.loyalty.left', { time: duration(loyalty.minutesLeft) })}</span>
      )}
    </div>
  );
}

export function PlanetHero({ planet }: { planet: PlanetView }) {
  const { t } = useTranslation();
  const now = useNow(1000);
  const disruptedFor = planet.planet.disruptedUntil
    ? planet.planet.disruptedUntil.getTime() - now
    : 0;
  const coreOnline = !(planet.faults ?? []).some((fault) => fault.kind === 'CORE_OUTAGE');

  /**
   * HOW MUCH OF THIS WORLD IS STILL YOURS, AND HOW LONG THAT LASTS.
   *
   * ONE LINE, AND THE SECOND HALF IS THE POINT. A bar at 34% SHOWS; "eleven hours"
   * HELPS, because it is what "fix it now or after work" is answered with. `CLAUDE.md`'s
   * first question — is a big one good, which decision am I supposed to use it for —
   * has no answer without the time.
   *
   * ABSENT WHERE IT CANNOT MOVE. Capitals get null from the server. Every colony
   * gets a line, including at 100%, so the commander can confirm the healthy state
   * before anything goes wrong.
   */
  const loyalty = planet.loyalty ?? null;
  const faultProtectionRemaining = (planet.faultProtectedUntil?.getTime() ?? 0)
    - Math.max(now, planet.vacationUntil?.getTime() ?? 0);
  const faultProtectionPaused = (planet.vacationUntil?.getTime() ?? 0) > now;

  return (
    <div className="flex flex-col gap-2">
      {loyalty && (
        <div data-loyalty data-testid="loyalty-line" className="gk gk-loyalty">
          <LoyaltyRow loyalty={loyalty} />
          <p className="gk-sub">{t('faults.loyalty.battleLoss', { strike: DEATH_STAR.colonyLoyaltyLoss })}</p>
          <div data-testid="fault-protection" className="gk-loyalty__guard">
            {faultProtectionRemaining > 0 && (
              <p className="gk-loyalty__guarded gk-num">
                {t(faultProtectionPaused ? 'faults.protection.paused' : 'faults.protection.active', {
                  time: countdown(faultProtectionRemaining),
                })}
              </p>
            )}
            <p className="gk-sub">{t('faults.protection.rule')}</p>
            {(planet.faults?.length ?? 0) > 0 && <p className="gk-sub">{t('faults.protection.existing')}</p>}
          </div>
        </div>
      )}
      {/*
        THE KIND LEADS; THE NAME CONFIRMS. The sheet above already states the world in
        its eyebrow and the commander in its title; the name stays, because a planet
        surface that does not name its planet is worse, and CAPITAL WORLD is what the
        header does not say.

        THE WORLD IS THE HERO (E5, the mock's Base): the portrait centred and large, its
        satellites on the ring around it, the name and the kind under it.
      */}
      <div data-planet-subject className="gk relative isolate flex flex-col items-center gap-1 overflow-hidden rounded-control pb-3 pt-3">
        {/* The world on the galaxy, as the mock draws it: the sky is this section's alone. */}
        <StarField className="absolute inset-0 -z-10" />
        <div data-planet-portrait className="flex flex-col items-center">
          <div className="relative grid size-[156px] place-items-center">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-[-10px]"
              style={{ background: 'radial-gradient(55% 50% at 50% 48%, rgba(46,230,200,0.10) 0%, transparent 70%)' }}
            />
            <div aria-hidden className="absolute size-[140px] rounded-full border border-v2-line-hi/60" />
            <PlanetSigil
              seed={planet.planet.id}
              skinId={planet.planet.skinId}
              size={104}
              shielded={coreOnline && planet.planet.shield > 0}
            />
            <OrbitSockets planet={planet} />
          </div>
          <div className="gk-hero__kind">
            <span className={`gk-label${planet.planet.kind === 'COLONY' ? ' gk-tone-self' : ''}`}>
              {t(planet.planet.kind === 'COLONY' ? 'planetHero.colony' : 'planetHero.capital')}
            </span>
            <span aria-hidden>·</span>
            <TierMark planet={planet} />
          </div>
          <OrbitLine planet={planet} />
        </div>
      </div>
      <ProductionRow planet={planet} />
      {disruptedFor > 0 && <Disrupted ms={disruptedFor} />}
    </div>
  );
}

/**
 * THE WORLD'S OWN TIER, UNDER ITS PORTRAIT. Owner report.
 *
 * *"Benim gezegenlerimin tier'ı kaç görebileceğim bir alan yok."* — and there was
 * not. The tier is the figure the whole galaxy is sorted by: the disc draws a
 * world's size from it (D34), every dossier prints a foreign world's, the
 * leaderboard prints a rival's — and the planet sheet, the surface a commander
 * spends the session on, printed nothing about their own.
 *
 * THAT IS THE WRONG WAY ROUND FOR D168 ABOVE ALL. The attack band is measured on
 * the tallest Core a commander holds ANYWHERE, so "which of my worlds is my
 * tallest, and what tier does that make me" is a question the rule asks of the
 * player. A commander whose colony has grown past their capital could not see
 * that it had — which is exactly the confusion a live player reported.
 *
 * IT IS A CAPTION, NOT A HEADING. Micro type under the portrait: the picture says
 * WHICH world, this says how far along it is, and anything larger would compete
 * with the world's own name two centimetres away.
 */
function TierMark({ planet }: { planet: PlanetView }) {
  const { t } = useTranslation();
  return (
    <p data-planet-tier className="gk-hero__tier">
      {t('planetHero.tier', { tier: coreTier(planet.buildings.CORE ?? 0) })}
    </p>
  );
}

/**
 * THE ORBIT'S SOCKETS, WHERE THE SATELLITES FLY. E5: "yörüngede uydu yuvaları (dolu,
 * boş, kilitli + açılacağı Çekirdek)".
 *
 * The four satellites share one scarce set of sockets, and D108 kept that rack above
 * every category so the trade is read before any tab is opened. The hero stands above
 * every tab, so the rack became the ring itself: every socket the Core can ever open,
 * at a fixed place on it — a satellite where one is fitted, an empty ring where one
 * could be, a lock with the Core level that opens it where the Core is still short.
 *
 * READ OFF THE QUEUE, as the rack was: a Core level or a satellite already paid for
 * counts, so buying one never shows a socket that the next minute contradicts. The
 * thresholds come from `satelliteSlots` itself, never from a copy of its numbers.
 */
const MOST_SOCKETS = satelliteSlots(Number.MAX_SAFE_INTEGER);
/** The ring's radius and the four places on it: the diagonals, clear of the name and the bubble. */
const SOCKET_ANGLES = [225, 315, 45, 135] as const;

/** The lowest Core level at which the socket at `index` exists. */
const socketOpensAt = (index: number): number => {
  let level = 0;
  while (satelliteSlots(level) <= index) level += 1;
  return level;
};

function orbitOf(planet: PlanetView) {
  const projected = projectedQueueState(planet, 'CONSTRUCTION');
  const core = projected.buildings.CORE;
  const total = satelliteSlots(core);
  const next = total < MOST_SOCKETS ? socketOpensAt(total) : null;
  return { fitted: projected.orbit, total, next };
}

function OrbitSockets({ planet }: { planet: PlanetView }) {
  const { t } = useTranslation();
  const { fitted, total } = orbitOf(planet);
  return (
    <div role="group" aria-label={t('planet.orbit.rackLabel')} className="pointer-events-none absolute inset-0">
      {Array.from({ length: MOST_SOCKETS }, (_, index) => {
        const satellite = fitted[index];
        const state = satellite
          ? index < total ? 'held' : 'inactive'
          : index < total ? 'open' : 'locked';
        const angle = SOCKET_ANGLES[index % SOCKET_ANGLES.length] ?? 0;
        const label = satellite
          ? state === 'inactive'
            ? `${satelliteLabel(satellite)} · ${t('planet.orbit.inactiveSatellite')} · ${t('planet.orbit.slotsNext', { level: socketOpensAt(index) })}`
            : satelliteLabel(satellite)
          : state === 'open'
            ? t('planet.orbit.slotEmpty')
            : t('planet.orbit.slotsNext', { level: socketOpensAt(index) });
        return (
          <span
            key={index}
            data-orbit-slot={state}
            role="img"
            aria-label={label}
            title={label}
            className="gk-socket"
            style={{ transform: `rotate(${String(angle)}deg) translate(70px) rotate(${String(-angle)}deg) translate(-50%, -50%)` }}
          >
            {satellite && (
              <img
                src={SATELLITE_ART[satellite]}
                alt=""
                className="gk-socket__art"
              />
            )}
            {state === 'inactive' && <span className="gk-socket__badge"><Glyph id="lock" /></span>}
            {state === 'locked' && (
              <>
                <Glyph id="lock" />
                <span className="gk-socket__level gk-num">{socketOpensAt(index)}</span>
              </>
            )}
          </span>
        );
      })}
    </div>
  );
}

/** The orbit in words, under the world: sockets used, full or not, and where the next one opens. */
function OrbitLine({ planet }: { planet: PlanetView }) {
  const { t } = useTranslation();
  const { fitted, total, next } = orbitOf(planet);
  const used = Math.min(fitted.length, total);
  const full = total > 0 && used >= total;
  const parts: ReactNode[] = [];
  if (total > 0) {
    parts.push(<span key="used">{t('planetHero.orbit')} <span>{t('planet.orbit.slotsUsed', { used, total })}</span></span>);
  }
  /* A full orbit is a ceiling the Core raises: a gap in yellow, never a threat's red (K2). */
  if (full) parts.push(<span key="full" className="gk-tone-warn">{t('planet.orbit.slotsNone')}</span>);
  if (next !== null) parts.push(<span key="next">{t('planet.orbit.slotsNext', { level: next })}</span>);
  return (
    <p data-testid="orbit-line" className="gk-hero__orbit gk-num">
      {parts.map((part, index) => <Fragment key={String(index)}>{index > 0 && ' · '}{part}</Fragment>)}
    </p>
  );
}

/**
 * ONE ROW PER RESOURCE: HOW FULL THE STORE IS, WHAT IS SAFE, AND WHAT COMES IN.
 *
 * ROWS, AS THE STORE WAS DRAWN BEFORE (owner, 2026-09-24, with the old STORE panel as the
 * picture). In three narrow columns the bar was a hundred pixels and the Vault's bracket
 * on it read as a square; a full-width row gives the cells room, so the bracket hugs the
 * cells it protects. Each row reads left to right: the resource, what the store holds of
 * what it can, the bar with the safe part boxed under the shield (the kit's `StoreGauge`,
 * stage 4.1), and the rate at the end. The rule of the box is said once, under the rows.
 *
 * DEUTERIUM IS ALWAYS HERE. Owner instruction, 2026-09-15: *"bu sectionda döteryum
 * üretimi gözükmüyor"* — it is the resource that decides whether a fleet can leave,
 * and ZERO IS A READING, NOT AN ABSENCE: a world with no plant makes none YET, which
 * is the reason to build one.
 *
 * A FULL STORE IS A GAP YOU CAN CLOSE (H2, K2): its figures turn yellow and the cells
 * close with a yellow cap — never the red of something happening to you.
 */
function ProductionRow({ planet }: { planet: PlanetView }) {
  const { t } = useTranslation();
  const p = planet.planet;
  const rows = [
    { id: 'alloy', rate: p.alloyPerHour, held: p.alloy, cap: p.alloyCap, safe: p.vaultProtected.alloy },
    { id: 'crystal', rate: p.crystalPerHour, held: p.crystal, cap: p.crystalCap, safe: p.vaultProtected.crystal },
    { id: 'deuterium', rate: p.deuteriumPerHour ?? 0, held: p.deuterium, cap: p.deuteriumCap, safe: p.vaultProtected.deuterium },
  ] as const;

  return (
    <div data-testid="planet-rates" className="gk gk-stores">
      {rows.map(({ id, rate, held, cap, safe }) => (
        <StoreGauge
          key={id}
          resource={id}
          held={held}
          cap={cap}
          safe={safe}
          rate={rate}
          label={t(`planetHero.${id}Store`, { held: full(Math.floor(held)), cap: full(cap), safe: full(safe) })}
        />
      ))}
      <p className="gk-sub gk-stores__rule">{t('planetHero.storeRule')}</p>
    </div>
  );
}

function Disrupted({ ms }: { ms: number }) {
  const { t } = useTranslation();
  return (
    <div className="gk">
      <Banner tone="hostile" variant="strip" title={<span className="gk-num">{t('planetHero.disrupted', { countdown: countdown(ms) })}</span>} />
    </div>
  );
}

/**
 * WHAT STANDS ON THIS WORLD, AND WHAT A RAID COULD TAKE. The head of the Defence tab.
 *
 * Four readings, each one answering the tab's question from a different side:
 * FIREPOWER (the line, in the unit a probe reads it in), DEFENCE (what that line is
 * made of), SHIELD (the Aegis) and what is EXPOSED (the ore outside the Vault — why a
 * raider would come). Then the fleet itself, the one reading drawn as a picture.
 */
export function DefenceReadings({ planet }: { planet: PlanetView }) {
  const { t } = useTranslation();
  const coreOnline = !(planet.faults ?? []).some((fault) => fault.kind === 'CORE_OUTAGE');
  const shield = planet.planet.shield;
  const shieldMax = planet.planet.shieldMax;
  const shieldShare = shieldMax > 0 ? shield / shieldMax : 0;
  const exposed = Math.max(
    0,
    planet.planet.alloy + planet.planet.crystal + planet.planet.deuterium - planet.planet.vaultFloor,
  );
  /*
    WHAT STANDS, NEVER A JUDGEMENT THE SHEET CANNOT MAKE. D199.

    It said Thin under five ground guns and Held at five or more — at every stage of
    every season, against any raid, and counting only the guns. "Held" against
    what? The honest verdicts are "nothing here can fire" and what is actually in
    the line; how strong that is, is the firepower figure beside it.
  */
  const line = garrisonOf(planet.fleet, coreOnline ? planet.ground : {});
  const armed = combatValue(line) > 0;
  const ships = fleetEntries(planet.fleet).reduce((sum, [id, n]) => sum + (HULLS[id].atk > 0 ? n : 0), 0);
  const guns = coreOnline ? fleetCount(planet.ground) : 0;
  const unarmed = unarmedCount(line);
  // Kalıcı gemi hasarı: this world's, but waiting in the Repair Station — not in the line.
  const docked = fleetCount(planet.fleetDocked ?? {});
  const standing = [
    ships > 0 ? t('planetHero.defenceShips', { count: ships }) : null,
    guns > 0 ? t('planetHero.defenceGuns', { count: guns }) : null,
  ].filter((part): part is string => part !== null).join(' · ');
  const shieldDetail = !coreOnline
    ? t('planetHero.shieldCoreOffline')
    : shieldMax > 0
      ? (
          <>
            <ProgressBar value={shield} max={shieldMax} tone="crystal" segments={8} label={t('planetHero.shieldMeter')} />
            <span className="gk-verdict__sub">{t('planetHero.shieldRegen', { amount: compact(planet.planet.shieldPerHour) })}</span>
          </>
        )
      : t('planetHero.shieldNoAegis');
  return (
    <div data-defence-readings className="gk gk-verdicts">
      {/*
        THE WORLD'S FIREPOWER — WHAT AN ENEMY PROBE MEASURES ABOUT IT. D199. It was "Power"
        (`wealth()`), which fell while a building rose and grew while ore waited to be raided.
        Firepower is what the hulls and guns in this world's defending line cost, transports and
        miners left out: the figure a rival's probe reports, learned on the one world the
        commander knows exactly.
      */}
      <Verdict testId="planet-firepower-plate" glyph="attack" label={t('planetHero.firepower')} tone="neutral"
        value={<span data-testid="planet-firepower">{full(combatValue(line))}</span>} />
      <Verdict
        testId="planet-defence"
        glyph="rocket"
        label={t('planetHero.defence')}
        value={armed ? standing : t('planetHero.defenceNone')}
        detail={[
          !coreOnline
            ? t('planetHero.defenceCoreOffline')
            : unarmed > 0 ? t('planetHero.defenceUnarmed', { count: unarmed }) : null,
          docked > 0 ? t('planetHero.defenceDocked', { count: docked }) : null,
        ].filter((part): part is string => part !== null).join(' · ') || undefined}
        tone={armed ? 'neutral' : 'gap'}
      />
      <Verdict
        testId="planet-shield"
        glyph="shield"
        label={t('planetHero.shield')}
        value={
          !coreOnline
            ? t('planetHero.shieldOffline')
            : shieldMax > 0
            ? t('planetHero.shieldValue', { current: compact(shield), max: compact(shieldMax) })
            : t('planetHero.shieldNone')
        }
        detail={shieldDetail}
        tone={!coreOnline || shieldMax === 0 ? 'gap' : shieldShare < 0.35 ? 'warn' : 'good'}
      />
      <Verdict
        testId="planet-exposed"
        glyph="crate"
        label={t('planetHero.atRisk')}
        value={t('planetHero.atRiskValue', { amount: compact(exposed) })}
        tone={exposed > 0 ? 'gap' : 'good'}
      />
      {/*
        THE WHOLE FORCE, UNDER THE VERDICTS ABOUT IT. D170. It spans both columns
        because a fleet is not another verdict — it is the answer to what the line is
        made of, and the one thing here read as a picture rather than as a sentence.
        `FleetCards` draws nothing when there is nothing to draw.
      */}
      <div className="gk-verdicts__fleet">
        <FleetCards fleet={planet.fleet} fleetAway={planet.fleetAway} fleetDocked={planet.fleetDocked ?? {}} />
      </div>
    </div>
  );
}

/**
 * A GAP IS YELLOW; RED IS SOMETHING HAPPENING TO YOU. K2.
 *
 * DEFENCE and SHIELD sat side by side, both reading "None", and one was red while
 * the other was bone. Two adjacent cards saying the same word in two colours
 * teaches that one absence is dangerous and the other is normal, which is not
 * true of either. Red is reserved for an attack, a disruption or a recovery — a
 * system you have not built yet is none of those.
 *
 * So there are three readings and each means one thing: a GAP to close (or a
 * system that is thin), a system that is holding, and a plain fact.
 */
type VerdictTone = 'gap' | 'warn' | 'good' | 'neutral';

/** One reading on a glass well: its picture, what it is, the verdict, and one line under it. */
function Verdict({
  label,
  value,
  detail,
  tone,
  glyph,
  testId,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone: VerdictTone;
  glyph: GlyphId;
  testId: string;
}) {
  return (
    <div data-testid={testId} data-tone={tone} className="gk-verdict gk-well">
      {/* the picture beside the name, so a long name (VERTEIDIGUNG at 320 px) has the plate's width */}
      <span className="gk-verdict__head">
        <span className="gk-verdict__coin" aria-hidden="true"><Glyph id={glyph} /></span>
        <span className="gk-label">{label}</span>
      </span>
      {/* A verdict is a WORD — "None", "4 ships". A word does not need a heading's size to land. */}
      <span className="gk-verdict__value gk-num">{value}</span>
      {typeof detail === 'string' ? <span className="gk-verdict__sub">{detail}</span> : detail}
    </div>
  );
}
