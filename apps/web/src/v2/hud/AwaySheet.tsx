import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { ReturnEntry, ReturnPayload } from '../../api/schemas.js';
import { awayRows, type AwayDoor, type AwayRow, type AwayTone } from '../../lib/awayStory.js';
import { full } from '../../lib/format.js';
import { duration } from '../../lib/time.js';
import { Icon, type IconId } from '../icons.js';
import { Sheet } from '../kit/Sheet.js';

const TONE: Record<AwayTone, { frame: string; mark: string; icon: IconId }> = {
  // A threat to you: the one place this sheet is red (K2).
  alarm: { frame: 'border-v2-hostile/40', mark: 'bg-v2-hostile/15 text-v2-hostile', icon: 'i-warn' },
  gain: { frame: 'border-v2-self/30', mark: 'bg-v2-self/15 text-v2-self', icon: 'i-collect' },
  opportunity: { frame: 'border-v2-warn/40', mark: 'bg-v2-warn/15 text-v2-warn', icon: 'i-spark' },
};

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

function Line({ row, onDoor }: { row: AwayRow; onDoor: (door: AwayDoor) => void }) {
  const { t } = useTranslation();
  const { title, detail } = words(row.entry, t);
  const tone = TONE[row.tone];
  return (
    <li data-away-row="" data-tone={row.tone} className={`flex items-center gap-2.5 rounded-control border bg-v2-deep/60 px-3 py-2 ${tone.frame}`}>
      <span aria-hidden="true" className={`grid size-8 shrink-0 place-items-center rounded-full ${tone.mark}`}>
        <Icon id={tone.icon} className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-caption font-semibold leading-snug text-v2-ink">{title}</span>
        <span className="block text-micro leading-snug text-v2-ink-2">{detail}</span>
      </span>
      <button
        type="button"
        onClick={() => { onDoor(row.door); }}
        className="shrink-0 rounded-control border border-v2-line-hi px-2.5 py-1.5 text-micro font-semibold text-v2-ink"
      >
        {t(`away.door.${row.door}`)} ›
      </button>
    </li>
  );
}

/**
 * WHILE YOU WERE AWAY. E10 · K5 · rule 6 ("Dönüşte önce hikâye").
 *
 * The question that brings a player back — what happened? — answered on the first
 * screen: at most three lines, the threat first, then the gain, then the opportunity,
 * each with the one door that answers it; the whole list one press away in Signals.
 * Every way out of it is a dismissal, and the shell closes the window on it.
 */
export function AwaySheet({
  story,
  onDoor,
  onAll,
  onDismiss,
}: {
  story: ReturnPayload;
  onDoor: (door: AwayDoor) => void;
  onAll: () => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const rows = awayRows(story.entries);
  return (
    <Sheet
      title={t('away.title')}
      eyebrow={t('away.eyebrow', { duration: duration(story.awayMinutes) })}
      detents={['fit']}
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
      <ul className="flex flex-col gap-2 pt-1">
        {rows.map((row) => <Line key={`${row.entry.kind}-${String(row.entry.at.getTime())}`} row={row} onDoor={onDoor} />)}
      </ul>
    </Sheet>
  );
}
