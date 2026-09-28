import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ActiveGalaxyEvent } from '../../api/schemas.js';
import type { Focus } from '../../galaxy/FocusPanel.jsx';
import { EVENT_NAME } from '../../lib/nowLine.js';
import { duration } from '../../lib/time.js';
import { Icon, type IconId } from '../icons.js';

/**
 * THE GALAXY'S CORNERS. Owner feedback, 2026-09-24.
 *
 * The old disc kept three things in plain sight that the v2 shell had folded away: a
 * way home to the active world, the event running now with its time left, and the
 * chat. They come back small and see-through, so the galaxy stays the screen: the
 * round buttons stand in a column at top right, under the galaxy's readout, where no
 * card or rail ever covers them; the events run along the top left, where the mock
 * draws them; and chat stands low on the right, where a thumb reaches it.
 */

const ROUND = 'pointer-events-auto relative grid size-9 place-items-center rounded-full border border-v2-line-hi bg-v2-panel/10 text-v2-ink-2';

/**
 * WHAT IS OUT THERE, AT A GLANCE. Owner, 2026-09-24: who is in the galaxy and what it
 * holds, back at the top right where the disc's caption stood — a sheet away, nobody
 * read it. Two short lines, right-aligned, no ground of its own: the stars show through
 * and a shadow keeps the words read. Each count wears the colour of what it is (K2);
 * a figure an older server does not send is left out, never printed as zero.
 */
export interface GalaxyTarget {
  kind: 'asteroid' | 'contact' | 'debris';
  id: string;
  label: string;
  detail: string;
}

export function GalaxyReadout({ online, onlineToday, counts, targets = [], onFocusTarget }: {
  online?: number;
  onlineToday?: number;
  counts: { worlds: number; fleetsAway: number; rocks: number; pirates: number; wrecks: number };
  targets?: readonly GalaxyTarget[];
  onFocusTarget?: (focus: Focus) => void;
}) {
  const { t } = useTranslation();
  const [openKind, setOpenKind] = useState<GalaxyTarget['kind'] | null>(null);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (openKind === null) return;
    const dismissOutside = (event: PointerEvent): void => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpenKind(null);
    };
    const dismissEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpenKind(null);
    };
    document.addEventListener('pointerdown', dismissOutside);
    document.addEventListener('keydown', dismissEscape);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside);
      document.removeEventListener('keydown', dismissEscape);
    };
  }, [openKind]);
  useEffect(() => {
    if (openKind !== null && !targets.some((target) => target.kind === openKind)) {
      setOpenKind(null);
    }
  }, [openKind, targets]);
  const listed = openKind === null ? [] : targets.filter((target) => target.kind === openKind);
  const countLabel = openKind === 'asteroid'
    ? t('galaxy.rocks', { count: counts.rocks })
    : openKind === 'contact'
      ? t('galaxy.pirates', { count: counts.pirates })
      : t('galaxy.wrecks', { count: counts.wrecks });
  const count = (kind: GalaxyTarget['kind'], value: number, label: string, colour: string) => {
    if (value === 0) return null;
    if (!onFocusTarget || !targets.some((target) => target.kind === kind)) {
      return <span className={colour}>{label}</span>;
    }
    return (
      <button
        type="button"
        aria-expanded={openKind === kind}
        aria-controls={openKind === kind ? 'galaxy-target-list' : undefined}
        onClick={() => { setOpenKind((current) => current === kind ? null : kind); }}
        className={`pointer-events-auto inline-flex min-h-7 items-center justify-end px-1 text-right underline decoration-dotted underline-offset-2 ${colour}`}
      >
        {label}
      </button>
    );
  };
  return (
    <div
      ref={root}
      data-galaxy-readout
      className="pointer-events-none relative flex max-w-[58vw] flex-col items-end gap-0.5 text-right font-v2-ui [text-shadow:0_1px_3px_var(--color-v2-void)]"
    >
      {online !== undefined && (
        <p className="flex items-center gap-1.5 text-caption text-v2-ink-2">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-v2-self" />
          <span>{t('galaxy.online', { count: online })}</span>
          {onlineToday !== undefined && <span className="text-v2-ink-3">{t('galaxy.onlineToday', { count: onlineToday })}</span>}
        </p>
      )}
      <p data-testid="view-caption" className="font-v2-mono text-micro leading-snug text-v2-ink grid grid-cols-2">
        <span className="text-v2-self flex items-center" >{t('galaxy.worlds', { count: counts.worlds })}</span>
        {counts.fleetsAway > 0 && <span className="text-v2-self flex items-center">{t('galaxy.fleetAway', { count: counts.fleetsAway })}</span>}
        {count('asteroid', counts.rocks, t('galaxy.rocks', { count: counts.rocks }), 'text-v2-crystal flex items-center')}
        {count('contact', counts.pirates, t('galaxy.pirates', { count: counts.pirates }), 'col-start-2 text-v2-hostile flex items-center')}
        {count('debris', counts.wrecks, t('galaxy.wrecks', { count: counts.wrecks }), 'text-v2-alloy flex items-center')}
      </p>
      {openKind !== null && listed.length > 0 && (
        <ul
          id="galaxy-target-list"
          aria-label={countLabel.trim().replace(/^·\s*/, '')}
          className="pointer-events-auto absolute right-0 top-full z-20 mt-2 max-h-[38vh] w-[min(74vw,17rem)] overflow-y-auto rounded-control border border-v2-line-hi bg-v2-deep p-1 text-left shadow-lg"
        >
          {listed.map((target, index) => (
            <li key={target.id}>
              <button
                type="button"
                onClick={() => {
                  onFocusTarget?.({ kind: target.kind, id: target.id });
                  setOpenKind(null);
                }}
                className="flex min-h-10 w-full items-center gap-2 rounded-chip px-2 py-1 text-left hover:bg-v2-raise focus-visible:bg-v2-raise"
              >
                <span className="font-v2-mono text-micro text-v2-ink-3">{String(index + 1).padStart(2, '0')}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-caption text-v2-ink">{target.label}</span>
                  <span className="block truncate text-micro text-v2-ink-3">{target.detail}</span>
                </span>
                <Icon id="i-mark" className="size-3.5 shrink-0 text-v2-self" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

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
            className="pointer-events-auto flex h-7 items-center gap-1 rounded-full border border-v2-line-hi bg-v2-panel/60 px-1 font-v2-ui"
          >
            <Icon id={EVENT_ICON[event.kind]} className="size-3.5 text-v2-self" />
            <span className="text-micro text-v2-ink-2">{name}</span>
            <span className="font-v2-mono text-micro font-semibold text-v2-ink">{left}</span>
          </button>
        );
      })}
    </div>
  );
}
