import { fleetCount } from '@astera/rules';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { PlanetView } from '../api/schemas.js';
import { satelliteLabel } from '../i18n/names.js';
import { compact, full } from '../lib/format.js';
import { powerOf } from '../lib/gains.js';
import { countdown, useNow } from '../lib/time.js';
import { SATELLITE_ART, RESOURCE_ART } from './assets.js';
import { Meter } from './kit/index.js';
import { PlanetSigil } from './PlanetSigil.js';

/**
 * "This is MY planet."
 *
 * The ownership pillar is carried by an image, not a heading. The planet is the
 * largest object in the interface; the satellites orbit it; the shield encloses it.
 * A player who buys a satellite should see it appear overhead, and that is the
 * entire feedback loop for a screen full of purchases.
 *
 * Underneath: POWER and output, then three verdicts. "None" is a verdict. "0
 * ground units" is a number the player still has to interpret.
 */
export function PlanetHero({
  planet,
  compact: compactMode = false,
}: {
  planet: PlanetView;
  /**
   * Drops the portrait and the name. Used when this sits in a panel over the live
   * galaxy — the planet is already on screen behind the sheet, and drawing it
   * twice would be the only duplicated object in the interface.
   */
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const now = useNow(1000);
  const orbitals = planet.orbit;
  const disruptedFor = planet.planet.disruptedUntil
    ? planet.planet.disruptedUntil.getTime() - now
    : 0;

  const ground = fleetCount(planet.ground);
  const home = fleetCount(planet.fleet);
  const exposed = Math.max(
    0,
    planet.planet.alloy
      + planet.planet.crystal
      + planet.planet.deuterium
      - planet.planet.vaultFloor,
  );

  if (compactMode) {
    return (
      <div className="flex flex-col gap-3">
        {/*
          THE KIND LEADS; THE NAME CONFIRMS.

          The sheet above already states the world in its eyebrow and the
          commander in its title, and this block used to repeat the world's name
          two hundred and fifty pixels below at a LARGER size — the same word
          twice in one glance, at two different hierarchy levels, with the bigger
          one being the thing a commander cannot fail to know. The name stays,
          because a planet surface that does not name its planet is worse; what
          changes is which half is loud. CAPITAL WORLD is what the header does
          not say.
        */}
        <div
          data-planet-subject
          className="flex items-center gap-3 border-b border-line-soft pb-3"
        >
          <div className="relative grid size-20 shrink-0 place-items-center" aria-hidden>
            <span
              className={`absolute top-0 size-2.5 ${
                planet.planet.kind === 'COLONY'
                  ? 'rotate-180 bg-opportunity [clip-path:polygon(50%_0,100%_100%,0_100%)]'
                  : 'rotate-45 border border-crystal bg-crystal/30'
              }`}
            />
            <PlanetSigil
              seed={planet.planet.id}
              size={68}
              shielded={planet.planet.shield > 0}
            />
          </div>
          <div className="min-w-0">
            <p className={`name truncate ${ planet.planet.kind === 'COLONY' ? 'text-opportunity' : 'text-crystal' }`}>
              {t(planet.planet.kind === 'COLONY' ? 'planetHero.colony' : 'planetHero.capital')}
            </p>
            <p className="legend mt-1 truncate">{planet.planet.name}</p>
          </div>
        </div>
        <Readouts planet={planet} />
        <Verdicts planet={planet} ground={ground} home={home} exposed={exposed} />
        {disruptedFor > 0 && <Disrupted ms={disruptedFor} />}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/*
        Side by side rather than stacked.
        A full-width portrait with the numbers underneath pushed every actual
        decision below the fold — the player had to scroll past their own planet
        to do anything with it. The planet keeps its presence; it just stops
        occupying the screen alone.
      */}
      <div className="flex items-center gap-3">
        <div className="relative flex size-[152px] shrink-0 items-center justify-center">
          <div
            className="pointer-events-none absolute inset-[-14px]"
            style={{
              background:
                'radial-gradient(60% 55% at 50% 46%, rgba(46,74,120,0.30) 0%, transparent 70%)',
            }}
          />


          <div className="absolute size-[132px] rounded-full border border-line-soft/50" />
          <div className="absolute size-[132px] motion-safe:animate-[spin_84s_linear_infinite]">
            {orbitals.map((type, i) => {
              const angle = (i / Math.max(1, orbitals.length)) * 360;
              return (
                <img
                  key={type}
                  src={SATELLITE_ART[type]}
                  alt={satelliteLabel(type)}
                  title={satelliteLabel(type)}
                  className="absolute left-1/2 top-1/2 size-8 object-contain drop-shadow-[0_0_6px_rgba(111,211,224,0.35)]"
                  style={{
                    transform: `rotate(${String(angle)}deg) translate(66px) rotate(${String(-angle)}deg) translate(-50%, -50%)`,
                  }}
                />
              );
            })}
          </div>

          <PlanetSigil seed={planet.planet.id} size={100} shielded={planet.planet.shield > 0} />
        </div>

        <div className="min-w-0 flex-1">
          <p className={`legend mb-1 ${ planet.planet.kind === 'COLONY' ? 'text-opportunity' : 'text-crystal' }`}>
            {t(planet.planet.kind === 'COLONY' ? 'planetHero.colony' : 'planetHero.capital')}
          </p>
          <h1 className="headline text-figure leading-tight text-bone">
            {planet.planet.name}
          </h1>
          <div className="plate plate-inset mt-2 px-3 py-2">
            <p className="legend">{t('planetHero.power')}</p>
            <p className="readout mt-1 text-figure text-bone">{full(powerOf(planet))}</p>
          </div>
          <div className="mt-2 flex gap-3">
            <Rate art={RESOURCE_ART.alloy} value={planet.planet.alloyPerHour} tone="text-alloy" />
            <Rate
              art={RESOURCE_ART.crystal}
              value={planet.planet.crystalPerHour}
              tone="text-crystal"
            />
          </div>
        </div>
      </div>

      {disruptedFor > 0 && <Disrupted ms={disruptedFor} />}
      <Verdicts planet={planet} ground={ground} home={home} exposed={exposed} />
    </div>
  );
}

/**
 * POWER and output.
 *
 * Power is everything this planet is worth — buildings, satellites, ships and
 * stock. It answers "am I getting stronger", and without it a player has no way to
 * feel a season of investment.
 */
function Readouts({ planet }: { planet: PlanetView }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-stretch gap-2">
      <div className="plate plate-inset flex-1 px-3 py-3">
        <p className="legend">{t('planetHero.power')}</p>
        <p className="readout mt-2 text-readout text-bone">{full(powerOf(planet))}</p>
      </div>
      <div className="plate plate-inset w-[142px] px-3 py-3">
        <p className="legend">{t('planetHero.perHour')}</p>
        <div className="mt-2 space-y-1">
          <Rate art={RESOURCE_ART.alloy} value={planet.planet.alloyPerHour} tone="text-alloy" />
          <Rate
            art={RESOURCE_ART.crystal}
            value={planet.planet.crystalPerHour}
            tone="text-crystal"
          />
        </div>
      </div>
    </div>
  );
}

function Disrupted({ ms }: { ms: number }) {
  const { t } = useTranslation();
  return (
    <p className="num mt-3 rounded-chip border border-threat/40 bg-threat/10 px-3 py-2 text-center text-caption text-threat-ink">
      {t('planetHero.disrupted', { countdown: countdown(ms) })}
    </p>
  );
}

function Verdicts({
  planet,
  ground,
  home,
  exposed,
}: {
  planet: PlanetView;
  ground: number;
  home: number;
  exposed: number;
}) {
  const { t } = useTranslation();
  const shield = planet.planet.shield;
  const shieldMax = planet.planet.shieldMax;
  const shieldShare = shieldMax > 0 ? shield / shieldMax : 0;
  return (
    <div className="grid grid-cols-2 gap-2">
      <Verdict
        label={t('planetHero.defence')}
        value={
          ground === 0
            ? t('planetHero.defenceNone')
            : ground < 5
              ? t('planetHero.defenceThin')
              : t('planetHero.defenceHeld')
        }
        detail={
          ground === 0
            ? t('planetHero.defenceShipsOnly', { count: home })
            : t('planetHero.defenceOnGround', { count: ground })
        }
        tone={ground === 0 ? 'gap' : ground < 5 ? 'warn' : 'good'}
      />
      <Verdict
        label={t('planetHero.shield')}
        value={
          shieldMax > 0
            ? t('planetHero.shieldValue', { current: compact(shield), max: compact(shieldMax) })
            : t('planetHero.shieldNone')
        }
        detail={
          shieldMax > 0
            ? (
                <div className="mt-2">
                  <Meter
                    value={shield}
                    cap={shieldMax}
                    tone="crystal"
                    cells={8}
                    label={t('planetHero.shieldMeter')}
                  />
                  <p className="mt-1 text-micro text-faint">
                    {t('planetHero.shieldRegen', { amount: compact(planet.planet.shieldPerHour) })}
                  </p>
                </div>
              )
            : t('planetHero.shieldNoAegis')
        }
        tone={shieldMax === 0 ? 'gap' : shieldShare < 0.35 ? 'warn' : 'good'}
      />
      <VaultVerdict
        planet={planet}
        exposed={exposed}
      />
    </div>
  );
}

function VaultVerdict({ planet, exposed }: { planet: PlanetView; exposed: number }) {
  const { t } = useTranslation();
  const protectedStock = planet.planet.vaultProtected;
  const resources = [
    { id: 'alloy', amount: protectedStock.alloy, tone: 'text-alloy' },
    { id: 'crystal', amount: protectedStock.crystal, tone: 'text-crystal' },
    { id: 'deuterium', amount: protectedStock.deuterium, tone: 'text-deuterium' },
  ] as const;

  return (
    <div className="plate plate-inset col-span-2 flex flex-col gap-2 px-3 py-3">
      {/*
        ONE HEADING, ONE MEANING — AND THE SENTENCE IS GONE.

        The header read "VAULT · SAFE" on the left and "463 exposed" on the right,
        two opposite claims sharing one line, and under the figures sat "A raid
        cannot touch these amounts", which is the left half of that header said
        again in words. Three statements of one fact.

        What is left says the fact once and shows the OTHER half beside it: this
        much is safe, that much is not. Two figures, one rule, no prose.
      */}
      <div className="flex items-baseline justify-between gap-3">
        <p className="legend">{t('planetHero.vaultSafe')}</p>
        <p className={`num text-label ${exposed > 0 ? 'text-alloy' : 'text-opportunity'}`}>
          {t('planetHero.atRiskValue', { amount: compact(exposed) })}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {resources.map(({ id, amount, tone }) => (
          <div
            key={id}
            className="plate plate-sunk flex min-w-0 items-center gap-2 rounded-chip px-2 py-2"
            aria-label={t(`planetHero.${id}Safe`, { amount: full(amount) })}
          >
            <img src={RESOURCE_ART[id]} alt="" aria-hidden className="size-4 shrink-0 object-contain" />
            <span className={`num truncate text-caption ${tone}`}>{compact(amount)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Rate({ art, value, tone }: { art: string; value: number; tone: string }) {
  const { t } = useTranslation();
  return (
    <p className={`num flex items-center gap-2 text-body ${tone}`}>
      <img src={art} alt="" aria-hidden className="size-4 object-contain" />
      {compact(value)}
      <span className="text-micro text-faint">{t('planetHero.perHourSuffix')}</span>
    </p>
  );
}

/**
 * A GAP IS AMBER; RED IS SOMETHING HAPPENING TO YOU.
 *
 * DEFENCE and SHIELD sat side by side, both reading "None", and one was red while
 * the other was bone. Two adjacent cards saying the same word in two colours
 * teaches that one absence is dangerous and the other is normal, which is not
 * true of either. `interface.md` I0 also reserves threat red for an attack,
 * disruption or recovery — a system you have not built yet is none of those.
 *
 * So there are three readings and each means one thing: a GAP to close, a system
 * that is thin, and a system that is holding. Red belongs to `Disrupted`, and to
 * the raid that earns it.
 */
const TONE = {
  gap: 'text-alloy',
  warn: 'text-alloy',
  good: 'text-opportunity',
  neutral: 'text-dim',
} as const;

function Verdict({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: ReactNode;
  tone: keyof typeof TONE;
}) {
  return (
    <div className="plate plate-inset px-3 py-2">
      <p className="legend">{label}</p>
      <p className={`readout mt-2 text-title ${TONE[tone]}`}>{value}</p>
      {typeof detail === 'string'
        ? <p className="num mt-1 text-micro text-faint">{detail}</p>
        : detail}
    </div>
  );
}
