import { STARTER_FEATURES, type StarterFeature } from '@astera/rules';
import type { TFunction } from 'i18next';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReturnEntry, ReturnPayload } from '../../api/schemas.js';
import { Banner, GameButton, NewsList, NewsRow, type GlyphId, type NewsOutcome, type NewsTone } from '../../game-ui/index.js';
import type { CssVars } from '../../game-ui/style.js';
import { serverNow } from '../../lib/clock.js';
import { FEATURE_SYSTEM } from '../../starter/UnlockMoment.js';
import { aboardRows, awayRows, type AwayDoor, type AwayRow, type AwayTone, type Sighting, type WorldCare } from '../../lib/awayStory.js';
import { full } from '../../lib/format.js';
import { haptic } from '../../lib/haptics.js';
import { playSound } from '../../lib/sound.js';
import { clockTime, duration } from '../../lib/time.js';
import { Icon, type IconId } from '../icons.js';
import { Sheet } from '../kit/Sheet.js';
import { ATMOSPHERE } from '../../ui/atmosphere.js';

/**
 * THE MARK EACH LINE STANDS BEHIND (the mock's square): red only for a threat to you
 * (K2), your colour for what you gained, and an opening drawn as an outline — it is a
 * chance, not yet anything of yours. The ship's story keeps it (G15); the world's lines are
 * the kit's news (C1).
 */
const TONE: Record<AwayTone, string> = {
  alarm: 'border-v2-hostile/50 bg-v2-hostile/10 text-v2-hostile',
  gain: 'border-v2-self/40 bg-v2-self/10 text-v2-self',
  opportunity: 'border-dashed border-v2-line-hi text-v2-ink-2',
};

/** The coin's colour: a threat the enemy's red (K2), a gain green, an opening the galaxy's blue. */
const NEWS_TONE: Record<AwayTone, NewsTone> = { alarm: 'hostile', gain: 'good', opportunity: 'info' };

/** What the line is about, on the kit's coin. */
function glyphOf(row: AwayRow): GlyphId {
  if (row.kind === 'sighting') return 'eye';
  switch (row.entry.kind) {
    case 'raided': return 'shield';
    case 'raid_result': return 'attack';
    case 'scan_detected': return 'target';
    case 'convoy_result': return 'crate';
    case 'fleet_returned': return 'recall';
    case 'accrued': return 'mine';
    case 'unlock': return 'unlock';
  }
}

/**
 * How a fight went for the reader: the ground its line lies on. A raid held is a win, a raid
 * that took is a loss; your own raid thrown back is amber — your loss, not a threat (red stays K2's).
 */
function outcomeOf(row: AwayRow): NewsOutcome {
  if (row.kind !== 'entry') return 'neutral';
  const { entry } = row;
  if (entry.kind === 'raided') return entry.params.grade === 'REPELLED' ? 'win' : 'loss';
  if (entry.kind === 'raid_result') return entry.params.grade === 'REPELLED' ? 'partial' : 'win';
  return 'neutral';
}

/** What the ship's hero line is about, in one glyph. */
function iconOf(row: AwayRow): IconId {
  if (row.kind === 'sighting') return 'i-telescope';
  switch (row.entry.kind) {
    case 'raided': return 'i-shield';
    case 'raid_result': return 'i-attack';
    case 'scan_detected': return 'i-radar';
    case 'convoy_result':
    case 'fleet_returned': return 'i-fleet';
    case 'accrued': return 'i-collect';
    case 'unlock': return 'i-spark';
  }
}

/** A ship names each resource it got, and leaves out the ones it got none of (E-03). */
function haulLine(t: TFunction, held: { alloy?: number; crystal?: number; deuterium?: number }): string[] {
  return ([['alloy', 'haulAlloy'], ['crystal', 'haulCrystal'], ['deuterium', 'haulDeuterium']] as const)
    .flatMap(([kind, key]) => (held[kind] ?? 0) > 0 ? [t(`starter.away.${key}`, { value: full(held[kind] ?? 0) })] : []);
}

/** A line's words, from its kind and parameters, in the reader's language (S3). */
function words(entry: ReturnEntry, t: TFunction, aboard: boolean): { title: string; detail: string } {
  switch (entry.kind) {
    case 'raided':
      return {
        title: t(`reports.verdict.title.defending.${entry.params.grade}`),
        detail: entry.params.grade === 'REPELLED'
          ? t('away.held', { lost: entry.params.lost })
          : t('away.taken', { loot: full(entry.params.loot), lost: entry.params.lost }),
      };
    case 'raid_result': {
      const looted = t('away.looted', { loot: full(entry.params.loot), lost: entry.params.lost });
      const { opponent, firstVictory, beatenBy } = entry.params;
      // An outpost's own two outcomes, as its signal says them (F4f).
      if (aboard && opponent !== undefined && firstVictory === true) {
        return { title: t('starter.away.fell', { name: opponent }), detail: `${t('starter.away.crateReady')} ${looted}` };
      }
      if (aboard && opponent !== undefined && beatenBy) return { title: t('starter.away.beaten', { name: opponent, by: beatenBy }), detail: looted };
      return { title: t(`reports.verdict.title.attacking.${entry.params.grade}`), detail: looted };
    }
    case 'scan_detected':
      return { title: t('away.scan', { count: entry.params.count }), detail: t('away.scanDetail') };
    case 'convoy_result':
    case 'fleet_returned':
      // A colony ship has no convoy; only a returning fleet carries the per-resource haul.
      if (aboard && entry.kind === 'fleet_returned') {
        const haul = haulLine(t, entry.params);
        return {
          title: t('starter.away.fleetHome'),
          detail: entry.params.alloy === undefined
            ? t('starter.away.fleetHomeDetail', { count: entry.params.ships, resources: full(entry.params.resources) })
            : [
              ...haul,
              ...((entry.params.lost ?? 0) >= 1 ? [t('starter.away.lost', { value: full(entry.params.lost ?? 0) })] : []),
              t('starter.away.ships', { count: entry.params.ships }),
            ].join(' · '),
        };
      }
      return {
        title: t(entry.kind === 'fleet_returned' ? 'away.convoyDelivered' : 'away.convoySecured'),
        detail: t('away.convoyDetail', { count: entry.params.ships, resources: full(entry.params.resources) }),
      };
    case 'accrued':
      // Aboard a ship the Extractor may not run yet, and "+0 crystal" reads as a fault.
      if (aboard) return { title: haulLine(t, entry.params).join(' · '), detail: t('away.accruedDetail') };
      return {
        title: t('away.accrued', { alloy: full(entry.params.alloy), crystal: full(entry.params.crystal) }),
        detail: t('away.accruedDetail'),
      };
    case 'unlock':
      return {
        title: t(`vocabulary.unlock.${entry.params.unlock}.title`),
        detail: t(`vocabulary.unlock.${entry.params.unlock}.body`),
      };
  }
}

/** A sighting's words: whose, which world, and when it is covered again. */
function seen(sighting: Sighting, t: TFunction): { title: string; detail: string } {
  return {
    title: t('away.sighting', { planet: sighting.planetName }),
    detail: sighting.etaMinutes === null
      ? t('away.sightingSeen')
      : t('away.sightingBack', { time: clockTime(new Date(serverNow() + sighting.etaMinutes * 60_000)) }),
  };
}

/** The door under the ship's hero line: a link, as the mock writes it (G15 keeps it). */
function Door({ label, onOpen }: { label: string; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="mt-1 py-0.5 text-micro font-semibold text-v2-self">
      {label} →
    </button>
  );
}

/**
 * ONE LINE OF THE STORY (C1): the kit's row of news. The whole row is its one door, as wide as
 * the card, and says under the sentence where it goes; a sighting names whose fleet is out.
 */
function Line({ row, aboard, index, onDoor }: { row: AwayRow; aboard: boolean; index: number; onDoor: (door: AwayDoor, planetId?: string) => void }) {
  const { t } = useTranslation();
  const { title, detail } = row.kind === 'entry' ? words(row.entry, t, aboard) : seen(row.sighting, t);
  const planetId = row.kind === 'sighting' ? row.sighting.planetId : undefined;
  const door = aboard && row.door === 'base' ? t('starter.away.toShip') : t(`away.door.${row.door}`);
  const order: CssVars = { '--i': index };
  return (
    <li data-away-row="" data-tone={row.tone} className="gk-away__row" style={order}>
      <NewsRow
        glyph={glyphOf(row)}
        tone={NEWS_TONE[row.tone]}
        outcome={outcomeOf(row)}
        fresh
        detail={row.kind === 'sighting' ? `${row.sighting.owner} · ${detail}` : detail}
        open={{ label: door, onPress: () => { onDoor(row.door, planetId); }, shown: true }}
      >
        <strong>{title}</strong>
      </NewsRow>
    </li>
  );
}

/**
 * The moment's colour: a gain in the player's own, a threat in red, an opening as an outline, and a
 * raid thrown back in amber — the player's loss, not a threat (red stays K2's).
 */
type HeroLook = AwayTone | 'loss';
const HERO: Record<HeroLook, { panel: string; bar: string; mark: string }> = {
  alarm: { panel: 'border-v2-hostile/60 bg-v2-hostile/10 shadow-[0_0_24px_-8px_var(--color-v2-hostile)]', bar: 'bg-v2-hostile', mark: TONE.alarm },
  gain: { panel: 'border-v2-self/60 bg-v2-self/10 shadow-[0_0_24px_-8px_var(--color-v2-self)]', bar: 'bg-v2-self', mark: TONE.gain },
  opportunity: { panel: 'border-dashed border-v2-line-hi bg-v2-void/40', bar: 'bg-v2-line-hi', mark: TONE.opportunity },
  loss: { panel: 'border-v2-warn/60 bg-v2-warn/10 shadow-[0_0_24px_-8px_var(--color-v2-warn)]', bar: 'bg-v2-warn', mark: 'border-v2-warn/50 bg-v2-warn/10 text-v2-warn' },
};

/** THE ONE MOMENT (plan F5): what the player sent out and what came of it, larger than the rest. */
function Hero({ row, onDoor }: { row: AwayRow & { kind: 'entry' }; onDoor: (door: AwayDoor, planetId?: string) => void }) {
  const { t } = useTranslation();
  const { title, detail } = words(row.entry, t, true);
  const look: HeroLook = row.entry.kind === 'raid_result' && row.entry.params.grade === 'REPELLED' ? 'loss' : row.tone;
  // It lands with the weight of what it says: a threat as an alert, a loss as a blow, a gain as a confirmation.
  useEffect(() => { playSound(look === 'alarm' ? 'alert' : look === 'loss' ? 'impact' : 'confirm'); }, [look]);
  return (
    <div data-testid="away-hero" data-tone={look}
      className={`relative overflow-hidden rounded-control border px-3 pb-2 pt-3 animate-[away-hero_0.6s_cubic-bezier(.2,1.4,.4,1)_both] ${HERO[look].panel}`}>
      <style>{`
        @keyframes away-hero {0%{opacity:0;transform:translateY(8px) scale(.96)} 100%{opacity:1;transform:none}}
        @keyframes away-bar {0%{transform:scaleX(0)} 100%{transform:scaleX(1)}}
      `}</style>
      <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-0.5 origin-left animate-[away-bar_0.8s_ease-out_0.15s_both] ${HERO[look].bar}`} />
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className={`grid size-11 shrink-0 place-items-center rounded-control border ${HERO[look].mark}`}>
          <Icon id={iconOf(row)} className="size-5" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col items-start">
          <span className="text-body font-semibold leading-snug text-v2-ink">{title}</span>
          <span className="mt-0.5 text-caption leading-snug text-v2-ink-2">{detail}</span>
          <Door label={row.door === 'base' ? t('starter.away.toShip') : t(`away.door.${row.door}`)} onOpen={() => { onDoor(row.door); }} />
        </span>
      </div>
    </div>
  );
}

const isStarterFeature = (unlock: string): unlock is StarterFeature => (STARTER_FEATURES as readonly string[]).includes(unlock);

/** The ship's story: the one moment, the rest folded under it, and what came back online last. */
function AboardStory({ story, onDoor }: { story: ReturnPayload; onDoor: (door: AwayDoor, planetId?: string) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [hero, ...rest] = aboardRows(story.entries);
  const systems = [...new Set(story.newUnlocks.filter(isStarterFeature).map((feature) => FEATURE_SYSTEM[feature]))];
  return (
    <div className="flex flex-col gap-2">
      {hero?.kind === 'entry' && <Hero row={hero} onDoor={onDoor} />}
      {rest.length > 0 && (
        <button type="button" aria-expanded={open} onClick={() => { haptic('tap'); setOpen(!open); }}
          className="flex min-h-8 items-center gap-1 self-start text-micro font-semibold text-v2-ink-2">
          <Icon id="i-chev" className={`size-3.5 transition-transform ${open ? 'rotate-90' : ''}`} />
          {t('starter.away.details', { count: rest.length })}
        </button>
      )}
      {open && (
        <NewsList label={t('away.title')}>
          {rest.map((row, index) => (
            <Line aboard index={index} key={row.kind === 'entry' ? `${row.entry.kind}-${String(row.entry.at.getTime())}` : `seen-${row.sighting.planetId}`} row={row} onDoor={onDoor} />
          ))}
        </NewsList>
      )}
      {systems.length > 0 && (
        <p data-testid="away-online" className="flex items-center gap-1.5 text-micro leading-snug text-v2-self">
          <Icon id="i-spark" className="size-3.5 shrink-0" />
          <span>{t('starter.away.online', { systems: systems.map((system) => t(`starter.system.${system}`)).join(' · ') })}</span>
        </p>
      )}
    </div>
  );
}

/**
 * WHILE YOU WERE AWAY. E10 · K5 · rule 6 ("Dönüşte önce hikâye"), the mock's card.
 *
 * The question that brings a player back — what happened? — answered on the first
 * screen, a card in the middle of it: at most three lines, the threat first, then the
 * gain, then the opportunity (a world the Telescope sees with its fleet out counts,
 * live), each with the one door that answers it; under them the world that needs
 * repairs, if one does; the whole list one press away in Signals. Every way out of it
 * is a dismissal, and the shell closes the window on it.
 *
 * On the kit (C1, 2026-11-14): the lines are the kit's news, read out one after another and
 * landing with the weight of the first; the world to repair is a warning with its own press;
 * the two ways out are the kit's buttons.
 */
export function AwaySheet({
  story,
  sightings = [],
  care = null,
  aboard = false,
  onDoor,
  onAll,
  onDismiss,
}: {
  story: ReturnPayload;
  /** The reader is on a colony ship, so the story is told in the ship's words. */
  aboard?: boolean;
  /** What the Telescope sees out right now (`sightingsOf`). */
  sightings?: readonly Sighting[];
  /** The world with faults standing (`worldCare`), or null. */
  care?: WorldCare | null;
  onDoor: (door: AwayDoor, planetId?: string) => void;
  onAll: () => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const rows = aboard ? [] : awayRows(story.entries, sightings);
  // It lands with the weight of what it leads with: a threat as an alert, anything else as a confirmation.
  // The ship's story sounds its own hero line.
  const lead = rows[0]?.tone;
  useEffect(() => {
    if (lead !== undefined) playSound(lead === 'alarm' ? 'alert' : 'confirm');
  }, [lead]);
  return (
    <Sheet
      title={t('away.title')}
      headerArt={ATMOSPHERE.season}
      eyebrow={t('away.eyebrow', { duration: duration(story.awayMinutes) })}
      detents={['fit']}
      placement="card"
      onClose={onDismiss}
      footer={(
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
          <GameButton tone="steel" size="sm" onPress={onAll}>{t('away.all', { count: story.entries.length })}</GameButton>
          <GameButton tone="action" wide onPress={onDismiss}>{t('away.done')}</GameButton>
        </div>
      )}
    >
      <div className="gk gk-away">
        {aboard && <AboardStory story={story} onDoor={onDoor} />}
        {rows.length > 0 && (
          <NewsList label={t('away.title')}>
            {rows.map((row, index) => (
              <Line
                aboard={aboard}
                index={index}
                key={row.kind === 'entry' ? `${row.entry.kind}-${String(row.entry.at.getTime())}` : `seen-${row.sighting.planetId}`}
                row={row}
                onDoor={onDoor}
              />
            ))}
          </NewsList>
        )}
        {care && (
          <div data-away-care="">
            <Banner
              variant="strip"
              tone="warn"
              glyph="repair"
              role={null}
              title={care.name}
              body={[
                ...(care.loyalty === null ? [] : [t('away.careLoyalty', { loyalty: care.loyalty })]),
                t('away.careFaults', { count: care.faults }),
              ].join(' · ')}
              action={<GameButton tone="steel" size="sm" glyph="repair" onPress={() => { onDoor('repair', care.planetId); }}>{t('away.door.repair')}</GameButton>}
            />
          </div>
        )}
      </div>
    </Sheet>
  );
}
