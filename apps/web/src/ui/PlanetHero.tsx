import {
  HULLS,
  combatValue,
  coreTier,
  fleetCount,
  fleetEntries,
  garrisonOf,
  unarmedCount,
} from '@astera/rules';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { PlanetView } from '../api/schemas.js';
import { satelliteLabel } from '../i18n/names.js';
import { compact, full } from '../lib/format.js';
import { countdown, useNow } from '../lib/time.js';
import { SATELLITE_ART, RESOURCE_ART } from './assets.js';
import { FleetCards } from './FleetCards.js';
import { Meter } from './kit/index.js';
import { ShieldIcon } from './icons/index.js';
import { PlanetSigil } from './PlanetSigil.js';

/**
 * "This is MY planet."
 *
 * The ownership pillar is carried by an image, not a heading. The planet is the
 * largest object in the interface; the satellites orbit it; the shield encloses it.
 * A player who buys a satellite should see it appear overhead, and that is the
 * entire feedback loop for a screen full of purchases.
 *
 * Underneath: FIREPOWER and output, then three verdicts. "None" is a verdict. "0
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

  const exposed = Math.max(
    0,
    planet.planet.alloy
      + planet.planet.crystal
      + planet.planet.deuterium
      - planet.planet.vaultFloor,
  );

  if (compactMode) {
    return (
      <div className="flex flex-col gap-2">
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
          className="flex items-center gap-2 border-b border-line-soft pb-1"
        >
          {/* The portrait and the one fact about it that is not drawn. */}
          <div data-planet-portrait className="shrink-0">
            <div className="relative grid size-20 place-items-center" aria-hidden>
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
            <TierMark planet={planet} />
          </div>
          <div className="min-w-0">
            <p className={`name truncate ${ planet.planet.kind === 'COLONY' ? 'text-opportunity' : 'text-crystal' }`}>
              {t(planet.planet.kind === 'COLONY' ? 'planetHero.colony' : 'planetHero.capital')}
            </p>
            <p className="legend mt-1 truncate">{planet.planet.name}</p>
          </div>
          <Readouts planet={planet} />
        </div>
        
        <Verdicts planet={planet} exposed={exposed} />
        {disruptedFor > 0 && <Disrupted ms={disruptedFor} />}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/*
        Side by side rather than stacked.
        A full-width portrait with the numbers underneath pushed every actual
        decision below the fold — the player had to scroll past their own planet
        to do anything with it. The planet keeps its presence; it just stops
        occupying the screen alone.
      */}
      <div className="flex items-center gap-2">
        <div data-planet-portrait className="shrink-0">
        <div className="relative flex size-[152px] items-center justify-center">
          <div
            className="pointer-events-none absolute inset-[-14px]"
            style={{
              background:
                'radial-gradient(60% 55% at 50% 46%, rgba(46,74,120,0.30) 0%, transparent 70%)',
            }}
          />


          <div className="absolute size-[132px] rounded-full border border-line-soft/50" />
          <div className="absolute size-[132px] animate-[spin_84s_linear_infinite]">
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
        <TierMark planet={planet} />
        </div>

        <div className="min-w-0 flex-1">
          <p className={`legend mb-1 ${ planet.planet.kind === 'COLONY' ? 'text-opportunity' : 'text-crystal' }`}>
            {t(planet.planet.kind === 'COLONY' ? 'planetHero.colony' : 'planetHero.capital')}
          </p>
          <h1 className="headline text-figure leading-tight text-bone">
            {planet.planet.name}
          </h1>
          <div className="plate plate-inset mt-2 px-3 py-2">
            <Firepower planet={planet} />
          </div>
          <div className="mt-2 flex gap-2">
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
      <Verdicts planet={planet} exposed={exposed} />
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
    <p data-planet-tier className="legend mt-1 text-center text-micro">
      {t('planetHero.tier', { tier: coreTier(planet.buildings.CORE ?? 0) })}
    </p>
  );
}

/**
 * THE WORLD'S FIREPOWER — WHAT AN ENEMY PROBE MEASURES ABOUT IT. D199.
 *
 * This was "Power", and Power was `wealth()`: buildings, satellites, ships and the
 * STORE. It ranked nothing and taught the opposite of the game — it fell while a
 * building was under construction, fell when the fleet flew, and grew while ore
 * waited to be raided. Owner: *"hiç bir halt anlamıyor."*
 *
 * Firepower is the one force unit every surface is written in: what the hulls and
 * guns in this world's defending line cost, transports and miners left out. It is
 * the figure a rival's probe reports about this world, so the commander learns the
 * scale on the one world they know exactly — "mine reads 12k; a world that reads
 * 12k is a world like mine".
 */
function Firepower({ planet }: { planet: PlanetView }) {
  const { t } = useTranslation();
  return (
    <>
      {/*
        NO GLYPH HERE, ON PURPOSE. Measured at 350: the icon widened this plate by
        twenty pixels, and the plate's width comes out of the world's kind label
        beside the portrait, which was already cut. The launch sheet's heading has
        the room and carries the glyph; this carries the word.
      */}
      <p className="legend">{t('planetHero.firepower')}</p>
      <p data-testid="planet-firepower" className="readout mt-1 text-body text-bone">
        {full(combatValue(garrisonOf(planet.fleet, planet.ground)))}
      </p>
    </>
  );
}

/** Firepower and output. */
function Readouts({ planet }: { planet: PlanetView }) {
  const { t } = useTranslation();
  return (
    /*
      30px WAS A POSTER, NOT A READOUT. Owner directive: *"gereksiz büyük fontlar."*

      `--text-readout` exists for a figure that is the entire point of its screen —
      a season score on the recap. Firepower is the first of FOUR readings in
      this block, and at 30px it made the other three look like footnotes to it
      while eating a fifth of the sheet before a commander reached anything they
      could press. `--text-figure` is 21px, still the largest thing here, and it
      leaves the block readable as one group instead of one number and some others.
    */
    <div className="flex items-stretch gap-1 ml-auto">
      <div className="plate plate-inset flex-1 px-2 py-2 min-w-[80px]">
        <Firepower planet={planet} />
      </div>
      <div className="plate plate-inset flex-1 px-2 py-2 min-w-[100px]">
        <p className="legend">{t('planetHero.perHour')}</p>
        <div className="mt-1 space-y-0.5">
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
  exposed,
}: {
  planet: PlanetView;
  exposed: number;
}) {
  const { t } = useTranslation();
  const shield = planet.planet.shield;
  const shieldMax = planet.planet.shieldMax;
  const shieldShare = shieldMax > 0 ? shield / shieldMax : 0;
  /*
    WHAT STANDS, NEVER A JUDGEMENT THE SHEET CANNOT MAKE. D199.

    It said Thin under five ground guns and Held at five or more — at every stage of
    every season, against any raid, and counting only the guns. "Held" against
    what? The honest verdicts are "nothing here can fire" and what is actually in
    the line; how strong that is, is the firepower figure beside it.
  */
  const line = garrisonOf(planet.fleet, planet.ground);
  const armed = combatValue(line) > 0;
  const ships = fleetEntries(planet.fleet).reduce((sum, [id, n]) => sum + (HULLS[id].atk > 0 ? n : 0), 0);
  const guns = fleetCount(planet.ground);
  const unarmed = unarmedCount(line);
  const standing = [
    ships > 0 ? t('planetHero.defenceShips', { count: ships }) : null,
    guns > 0 ? t('planetHero.defenceGuns', { count: guns }) : null,
  ].filter((part): part is string => part !== null).join(' · ');
  return (
    <div className="grid grid-cols-2 gap-2">
      <Verdict
        testId="planet-defence"
        label={t('planetHero.defence')}
        value={armed ? standing : t('planetHero.defenceNone')}
        detail={unarmed > 0 ? t('planetHero.defenceUnarmed', { count: unarmed }) : undefined}
        tone={armed ? 'neutral' : 'gap'}
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
      {/*
        THE WHOLE FORCE, UNDER THE TWO VERDICTS ABOUT IT. D170.

        It spans both columns because a fleet is not a third verdict standing
        beside defence and shield — it is the answer to what those two are made
        of, and the one thing on this sheet that is read as a picture rather than
        as a sentence. `FleetCards` draws nothing when there is nothing to draw,
        so an empty world keeps the compact two-up it always had.
      */}
      <div className="col-span-2">
        <FleetCards fleet={planet.fleet} fleetAway={planet.fleetAway} />
      </div>
    </div>
  );
}

/**
 * ONE BAR PER RESOURCE, AND THE SAFE PART IS A BLOCK WITH THE VAULT ON IT. D190.
 *
 * The report came in three rounds and each one was right.
 *
 *   1. *"Kullanıcılar kasa logic'ini anlamakta güçlük çekiyor. Sanıyorlar ki
 *      sadece belirli bir miktar kaynağı korur. Deponun kapasitesini arttırdığını
 *      bilmiyor."* The card showed three numbers and all three were the FLOOR, so
 *      that is the only thing it could teach.
 *   2. *"Görsel olarak da anlayamıyor. Bu oyunu 50 yaşındaki insanlar bile
 *      oynuyor."* Words were not going to fix a picture.
 *   3. *"İşaretli dilim hiç ama hiç belli olmuyor ki."* — with a screenshot. Also
 *      right: a 1px ring on a five-pixel segmented cell is nothing, and the store
 *      in that screenshot was ten times over its ceiling, so every cell was lit
 *      and there was no shape left to read at all.
 *
 * SO THE PROTECTED PART IS ONE CONTINUOUS BLOCK, not a run of cells, in bone
 * against the resource hue, with the VAULT'S OWN GLYPH sitting on it. The glyph is
 * the association the whole report is about: this block is the Vault's doing.
 * Segmented cells are the right language for a quantity you count; a rule you have
 * to recognise wants a shape you cannot mistake for the fill beside it.
 *
 * FULL WIDTH, THREE ROWS. Three columns left each bar about a hundred pixels, so
 * the protected slice was fifteen and could not carry a mark of any kind. Stacked,
 * the slice is around thirty-six and the block reads at a glance — for the same
 * height, because the columns were two lines each anyway.
 *
 * OVER-CAPACITY IS DRAWN RATHER THAN CLAMPED AWAY, and it is common: a fresh world
 * opens holding 1,500 alloy against a 1,575 ceiling and outgrows it within the
 * day. The fill pins at the end with a hard cap mark, and the pale block still
 * says how little of that pile a raid cannot reach — which is exactly the moment a
 * commander should be thinking about the Vault.
 */
function StoreBar({ held, cap, safe, tone }: {
  held: number; cap: number; safe: number; tone: 'alloy' | 'crystal' | 'deuterium';
}) {
  const CELLS = 12;
  const room = Math.max(1, cap);
  const lit = Math.round(Math.min(1, held / room) * CELLS);
  /*
    THE BRACKET CLOSES ON A CELL BOUNDARY, never between two. A box that ends
    halfway through a square reads as a rendering fault; one that encloses a whole
    number of them reads as a count, which is what it is.

    At least one cell whenever there is any protection at all — the floor is 15% of
    the store, so it rounds to two of twelve, and a zone drawn as nothing is a zone
    the player is entitled to think does not exist.
  */
  const safeCells = safe > 0 ? Math.max(1, Math.round(Math.min(1, safe / room) * CELLS)) : 0;
  const over = held > cap + 0.5;
  const hue = tone === 'alloy' ? 'bg-alloy' : tone === 'crystal' ? 'bg-crystal' : 'bg-deuterium';

  return (
    <span className="relative block min-w-0 flex-1 pt-2.5">
      <span className="relative flex h-[7px] gap-px">
        {Array.from({ length: CELLS }, (_, i) => (
          <span
            key={i}
            className={`flex-1 rounded-cell ${i < lit ? hue : 'bg-line/70'}`}
            style={{ opacity: i < lit ? 0.9 : 1 }}
          />
        ))}
        {over && <span aria-hidden className="absolute -right-0.5 -top-0.5 h-[11px] w-[3px] rounded-cell bg-bone/90" />}
      </span>
      {/*
        THE PROTECTED ZONE IS A BRACKET AROUND THE CELLS, NOT A DIFFERENT FILL.
        Owner sketch: enclose the safe part with a line and put a shield over it.

        Better than the fill it replaces, and for a reason worth keeping: a
        recoloured segment competes with the fill for the same reading — is that
        ore, or is that a rule? — while a line drawn AROUND a region annotates it
        without pretending to be a quantity. The bracket sits proud of the cells on
        every side so it reads as a marking laid on top, and the shield hangs above
        it where nothing else is drawn.
      */}
      {safeCells > 0 && (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-[3px] left-[-2px] top-[7px] rounded-cell border border-bone/85"
            style={{ width: `calc(${String((safeCells / CELLS) * 100)}% + 3px)` }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute top-0 -translate-x-1/2 text-bone"
            style={{ left: `${String((safeCells / CELLS) * 50)}%` }}
          >
            <ShieldIcon className="size-2.5" />
          </span>
        </>
      )}
    </span>
  );
}

function VaultVerdict({ planet, exposed }: { planet: PlanetView; exposed: number }) {
  const { t } = useTranslation();
  const p = planet.planet;
  const safe = p.vaultProtected;
  const rows = [
    { id: 'alloy', held: p.alloy, cap: p.alloyCap, safe: safe.alloy },
    { id: 'crystal', held: p.crystal, cap: p.crystalCap, safe: safe.crystal },
    { id: 'deuterium', held: p.deuterium, cap: p.deuteriumCap, safe: safe.deuterium },
  ] as const;

  return (
    <div className="plate plate-inset col-span-2 flex flex-col gap-1.5 px-3 py-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="legend">{t('planetHero.storeLabel')}</p>
        <p className={`num text-label ${exposed > 0 ? 'text-alloy' : 'text-opportunity'}`}>
          {t('planetHero.atRiskValue', { amount: compact(exposed) })}
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        {rows.map(({ id, held, cap, safe: safeAmount }) => (
          <div
            key={id}
            className="flex min-w-0 items-center gap-2"
            aria-label={t(`planetHero.${id}Store`, {
              held: full(Math.floor(held)),
              cap: full(cap),
              safe: full(safeAmount),
            })}
          >
            <img src={RESOURCE_ART[id]} alt="" aria-hidden className="size-4 shrink-0 object-contain" />
            <span className="num w-[86px] shrink-0 truncate text-caption text-bone">
              {compact(Math.floor(held))}
              <span className="text-faint">{`/${compact(cap)}`}</span>
            </span>
            <StoreBar held={held} cap={cap} safe={safeAmount} tone={id} />
          </div>
        ))}
      </div>
      <p className="text-micro leading-snug text-faint">{t('planetHero.storeRule')}</p>
    </div>
  );
}

function Rate({ art, value, tone }: { art: string; value: number; tone: string }) {
  const { t } = useTranslation();
  return (
    <p className={`num flex items-center gap-2 text-caption ${tone}`}>
      <img src={art} alt="" aria-hidden className="size-3.5 object-contain" />
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
  testId,
}: {
  label: string;
  value: string;
  detail?: ReactNode;
  tone: keyof typeof TONE;
  testId?: string;
}) {
  return (
    <div data-testid={testId} className="plate plate-inset px-3 py-2">
      <p className="legend">{label}</p>
      {/* A verdict is a WORD — "Weak", "None". A word does not need 18px to land,
         and at 18px two of them beside a 30px figure read as a third heading level
         nobody asked for. */}
      <p className={`readout mt-1 text-body ${TONE[tone]}`}>{value}</p>
      {typeof detail === 'string'
        ? <p className="num mt-1 text-micro text-faint">{detail}</p>
        : detail}
    </div>
  );
}
