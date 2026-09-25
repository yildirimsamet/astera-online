import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { ReturnEntry, ReturnPayload } from '../../api/schemas.js';
import { serverNow } from '../../lib/clock.js';
import { awayRows, type AwayDoor, type AwayRow, type AwayTone, type Sighting, type WorldCare } from '../../lib/awayStory.js';
import { full } from '../../lib/format.js';
import { clockTime, duration } from '../../lib/time.js';
import { Icon, type IconId } from '../icons.js';
import { Sheet } from '../kit/Sheet.js';

/**
 * THE MARK EACH LINE STANDS BEHIND (the mock's square): red only for a threat to you
 * (K2), your colour for what you gained, and an opening drawn as an outline — it is a
 * chance, not yet anything of yours.
 */
const TONE: Record<AwayTone, string> = {
  alarm: 'border-v2-hostile/50 bg-v2-hostile/10 text-v2-hostile',
  gain: 'border-v2-self/40 bg-v2-self/10 text-v2-self',
  opportunity: 'border-dashed border-v2-line-hi text-v2-ink-2',
};

/** What the line is about, in one glyph. */
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

/** A line's words, from its kind and parameters, in the reader's language (S3). */
function words(entry: ReturnEntry, t: TFunction): { title: string; detail: string } {
  switch (entry.kind) {
    case 'raided':
      return {
        title: t(`reports.verdict.title.defending.${entry.params.grade}`),
        detail: entry.params.grade === 'REPELLED'
          ? t('away.held', { lost: entry.params.lost })
          : t('away.taken', { loot: full(entry.params.loot), lost: entry.params.lost }),
      };
    case 'raid_result':
      return {
        title: t(`reports.verdict.title.attacking.${entry.params.grade}`),
        detail: t('away.looted', { loot: full(entry.params.loot), lost: entry.params.lost }),
      };
    case 'scan_detected':
      return { title: t('away.scan', { count: entry.params.count }), detail: t('away.scanDetail') };
    case 'convoy_result':
    case 'fleet_returned':
      return {
        title: t(entry.kind === 'fleet_returned' ? 'away.convoyDelivered' : 'away.convoySecured'),
        detail: t('away.convoyDetail', { count: entry.params.ships, resources: full(entry.params.resources) }),
      };
    case 'accrued':
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

/** The door, written as the mock writes it: a link under the line, not a slab beside it. */
function Door({ label, onOpen }: { label: string; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="mt-1 py-0.5 text-micro font-semibold text-v2-self">
      {label} →
    </button>
  );
}

function Line({ row, onDoor }: { row: AwayRow; onDoor: (door: AwayDoor, planetId?: string) => void }) {
  const { t } = useTranslation();
  const { title, detail } = row.kind === 'entry' ? words(row.entry, t) : seen(row.sighting, t);
  const planetId = row.kind === 'sighting' ? row.sighting.planetId : undefined;
  return (
    <li data-away-row="" data-tone={row.tone} className="flex gap-3 py-3 first:pt-1 last:pb-1">
      <span aria-hidden="true" className={`grid size-9 shrink-0 place-items-center rounded-control border ${TONE[row.tone]}`}>
        <Icon id={iconOf(row)} className="size-4" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col items-start">
        <span className="flex min-w-0 max-w-full items-center gap-1.5 text-caption font-semibold leading-snug text-v2-ink">
          {row.kind === 'sighting' && (
            <span className="shrink-0 rounded-chip border border-v2-line px-1 text-micro text-v2-ink-2">{row.sighting.owner}</span>
          )}
          <span className="min-w-0">{title}</span>
        </span>
        <span className="text-micro leading-snug text-v2-ink-2">{detail}</span>
        <Door label={t(`away.door.${row.door}`)} onOpen={() => { onDoor(row.door, planetId); }} />
      </span>
    </li>
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
 */
export function AwaySheet({
  story,
  sightings = [],
  care = null,
  onDoor,
  onAll,
  onDismiss,
}: {
  story: ReturnPayload;
  /** What the Telescope sees out right now (`sightingsOf`). */
  sightings?: readonly Sighting[];
  /** The world with faults standing (`worldCare`), or null. */
  care?: WorldCare | null;
  onDoor: (door: AwayDoor, planetId?: string) => void;
  onAll: () => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const rows = awayRows(story.entries, sightings);
  return (
    <Sheet
      title={t('away.title')}
      eyebrow={t('away.eyebrow', { duration: duration(story.awayMinutes) })}
      detents={['fit']}
      placement="card"
      onClose={onDismiss}
      footer={(
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <button
            type="button"
            onClick={onAll}
            className="min-h-10 rounded-control border border-v2-line-hi px-3 text-caption font-semibold text-v2-ink"
          >
            {t('away.all', { count: story.entries.length })}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="min-h-10 rounded-control bg-v2-self px-3 text-caption font-semibold text-v2-self-ink"
          >
            {t('away.done')}
          </button>
        </div>
      )}
    >
      <ul className="flex flex-col divide-y divide-v2-line">
        {rows.map((row) => (
          <Line
            key={row.kind === 'entry' ? `${row.entry.kind}-${String(row.entry.at.getTime())}` : `seen-${row.sighting.planetId}`}
            row={row}
            onDoor={onDoor}
          />
        ))}
      </ul>
      {care && (
        <p
          data-away-care=""
          className="mt-2 flex items-start gap-2 rounded-control border border-v2-warn/40 bg-v2-warn/5 px-3 py-2 text-micro leading-snug text-v2-warn"
        >
          <Icon id="i-warn" className="mt-px size-3.5 shrink-0" />
          <span>
            {[
              care.loyalty === null ? care.name : t('away.careLoyalty', { world: care.name, loyalty: care.loyalty }),
              t('away.careFaults', { count: care.faults }),
            ].join(' · ')}
            {' · '}
            <button type="button" onClick={() => { onDoor('repair', care.planetId); }} className="font-semibold underline underline-offset-2">
              {t('away.door.repair')}
            </button>
          </span>
        </p>
      )}
    </Sheet>
  );
}
