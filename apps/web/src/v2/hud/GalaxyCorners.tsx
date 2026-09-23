import { useTranslation } from 'react-i18next';
import type { ActiveGalaxyEvent } from '../../api/schemas.js';
import { EVENT_NAME } from '../../lib/nowLine.js';
import { duration } from '../../lib/time.js';
import { Icon, type IconId } from '../icons.js';

/**
 * THE GALAXY'S CORNERS. Owner feedback, 2026-09-24.
 *
 * The old disc kept three things in plain sight that the v2 shell had folded away: a
 * way home to the active world, the event running now with its time left, and the
 * chat. They come back small and see-through, so the galaxy stays the screen: the
 * round buttons stand in a column under the View chip at top right, where no card
 * or rail ever covers them, and the events run along the top left, where the mock
 * draws them.
 */

const ROUND = 'pointer-events-auto relative grid size-9 place-items-center rounded-full border border-v2-line-hi bg-v2-panel/60 text-v2-ink-2';

/** Fly the camera to the active world — the disc's old Home mark. */
export function HomeChip({ onHome }: { onHome: () => void }) {
  const { t } = useTranslation();
  return (
    <button type="button" aria-label={t('view.home')} onClick={onHome} className={ROUND}>
      <Icon id="m-capital" className="size-4" />
    </button>
  );
}

/** The chat, one press away; a dot while something is unread. */
export function ChatChip({ unread, onOpen }: { unread: number; onOpen: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      aria-label={unread > 0 ? `${t('bell.chat')} · ${t('bell.chatUnread', { count: unread })}` : t('bell.chat')}
      onClick={onOpen}
      className={ROUND}
    >
      <Icon id="i-chat" className="size-4" />
      {unread > 0 && (
        <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-v2-self ring-2 ring-v2-deep" />
      )}
    </button>
  );
}

const EVENT_ICON = {
  TRADE_SHIP: 'i-trade',
  INTERGALACTIC_CONVOY: 'i-fleet',
  ASTEROID_SHOWER: 'm-rock',
} as const satisfies Record<ActiveGalaxyEvent['kind'], IconId>;

/**
 * THE EVENTS RUNNING NOW, EACH WITH ITS TIME LEFT — as the mock draws them under the Now
 * line. The context card says the same once; closed, it said nothing, and the event
 * was still running.
 */
export function EventChips({
  events,
  now,
  onOpen,
}: {
  events: readonly ActiveGalaxyEvent[];
  now: number;
  onOpen: (event: ActiveGalaxyEvent) => void;
}) {
  const { t } = useTranslation();
  if (events.length === 0) return null;
  return (
    <div className="flex flex-col items-start gap-1.5">
      {events.map((event) => {
        const name = t(EVENT_NAME[event.kind]);
        const left = duration(Math.max(0, event.endsAt.getTime() - now) / 60_000);
        return (
          <button
            key={event.id}
            type="button"
            aria-label={`${name} · ${left}`}
            onClick={() => { onOpen(event); }}
            className="pointer-events-auto flex h-7 items-center gap-1.5 rounded-full border border-v2-line-hi bg-v2-panel/60 px-2.5 font-v2-ui"
          >
            <Icon id={EVENT_ICON[event.kind]} className="size-3.5 text-v2-self" />
            <span className="text-caption text-v2-ink-2">{name}</span>
            <span className="font-v2-mono text-caption font-semibold text-v2-ink">{left}</span>
          </button>
        );
      })}
    </div>
  );
}
