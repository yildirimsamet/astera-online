import { useEffect, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import type { ActiveGalaxyEvent } from '../../api/schemas.js';
import type { Focus } from '../../galaxy/FocusPanel.jsx';
import { EVENT_GLYPH, EVENT_NAME } from '../../lib/nowLine.js';
import { duration } from '../../lib/time.js';
import { DropGroup, DropPanel, PickRow, RoundButton, StatusChip, Tally, artIconSrc, type GlyphId, type TallyPaint } from '../../game-ui/index.js';
import type { MonumentDifficulty } from '@astera/rules';
import { useNativeBack } from '../../platform/nativeBack.js';

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

/**
 * WHAT IS OUT THERE, AT A GLANCE. Owner, 2026-09-24: who is in the galaxy and what it
 * holds, back at the top right where the disc's caption stood — a sheet away, nobody
 * read it. On the game kit since G1-d2 (2026-11-14): who is here reads as two quiet lines
 * of words over the stars; what can be found is a row of counts, each in the colour of what
 * it counts with its mark (K2), and a press on one drops the list of them — the finder of
 * the loop's next target. A figure an older server does not send is left out, never zero.
 */
export interface GalaxyTarget {
  kind: 'asteroid' | 'contact' | 'debris' | 'monument' | 'planet';
  id: string;
  label: string;
  detail: string;
  difficulty?: MonumentDifficulty;
  ordinal?: number;
}

/** Each thing that can be found wears its own mark and colour (K2): ore crystal, pirates red, wrecks alloy. */
const FINDABLE: Record<GalaxyTarget['kind'], { glyph: GlyphId; paint: TallyPaint }> = {
  asteroid: { glyph: 'asteroid', paint: 'crystal' },
  contact: { glyph: 'pirate', paint: 'hostile' },
  debris: { glyph: 'debris', paint: 'alloy' },
  planet: { glyph: 'colony', paint: 'warn' },
  monument: { glyph: 'star', paint: 'deut' },
};

export function GalaxyReadout({ onlineToday, counts, targets = [], onFocusTarget }: {
  onlineToday?: number;
  counts: { worlds: number; fleetsAway: number; rocks: number; pirates: number; wrecks: number; monuments?: number; ships?: number; outposts?: number };
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
  useNativeBack(root, () => { setOpenKind(null); }, openKind !== null && listed.length > 0);
  if (openKind === 'monument') {
    const order = (target: GalaxyTarget) => target.difficulty === 'HARD' ? 0 : target.difficulty === 'EASY' ? 1 : 2;
    listed.sort((a, b) => order(a) - order(b) || (a.ordinal ?? 0) - (b.ordinal ?? 0));
  }
  /** A count's words without the separator they carry when they run on in a sentence. */
  const words = (text: string): string => text.trim().replace(/^·\s*/, '');
  const LABEL: Record<GalaxyTarget['kind'], string> = {
    asteroid: t('galaxy.rocks', { count: counts.rocks }),
    contact: t('galaxy.pirates', { count: counts.pirates }),
    debris: t('galaxy.wrecks', { count: counts.wrecks }),
    planet: t('starter.readout.outposts', { count: counts.outposts ?? 0 }),
    monument: t('monument.finder', { count: counts.monuments ?? 0 }),
  };
  const tally = (kind: GalaxyTarget['kind'], value: number) => {
    if (value === 0) return null;
    const { glyph, paint } = FINDABLE[kind];
    const label = words(LABEL[kind]);
    if (!onFocusTarget || !targets.some((target) => target.kind === kind)) {
      return <Tally key={kind} glyph={glyph} paint={paint} value={String(value)} label={label} />;
    }
    return (
      <Tally
        key={kind}
        glyph={glyph}
        paint={paint}
        value={String(value)}
        label={label}
        expanded={openKind === kind}
        {...(openKind === kind ? { controls: 'galaxy-target-list' } : {})}
        onPress={() => { setOpenKind((current) => current === kind ? null : kind); }}
      />
    );
  };
  const tallies = [
    tally('asteroid', counts.rocks),
    tally('contact', counts.pirates),
    tally('debris', counts.wrecks),
    tally('planet', counts.outposts ?? 0),
    tally('monument', counts.monuments ?? 0),
  ].filter((node) => node !== null);
  return (
    <div
      ref={root}
      data-galaxy-readout
      data-native-back-layer={openKind !== null && listed.length > 0 ? 'popover' : undefined}
      className="pointer-events-none relative flex max-w-[min(82vw,320px)] flex-col items-end text-right"
    >
      {/* Owner, 2026-10-11: daily activity only; live counts reveal quiet attack windows. */}
      {onlineToday !== undefined && (
        <p className="gk-scene-line flex items-center gap-1.5">
          <span aria-hidden="true" className="gk-scene-line__dot" />
          <span><Trans i18nKey="galaxy.onlineToday" count={onlineToday} components={[<strong key="count" />]} /></span>
        </p>
      )}
      <div data-testid="view-caption" className="flex flex-col items-end">
        {/* Who is here reads as words; what can be found is counted, each in its own colour. */}
        <p className="gk-scene-line">
          {counts.ships === undefined ? t('galaxy.worlds', { count: counts.worlds }) : t('starter.readout.ships', { count: counts.ships })}
          {counts.fleetsAway > 0 && t('galaxy.fleetAway', { count: counts.fleetsAway })}
        </p>
        {tallies.length > 0 && <div className="flex flex-wrap justify-end gap-x-1 [&_button]:pointer-events-auto">{tallies}</div>}
      </div>
      {openKind !== null && listed.length > 0 && (
        <DropPanel id="galaxy-target-list" label={words(LABEL[openKind])} title={words(LABEL[openKind])} paint={FINDABLE[openKind].paint}>
          {listed.map((target, index) => {
            const hard = target.difficulty === 'HARD';
            const heads = (target.difficulty === 'HARD' || target.difficulty === 'EASY') && listed[index - 1]?.difficulty !== target.difficulty;
            return (
              <li key={target.id}>
                {heads && <DropGroup tone={hard ? 'hostile' : 'self'}>{t(hard ? 'monument.hard' : 'monument.easy')}</DropGroup>}
                <PickRow
                  glyph="target"
                  tone={hard ? 'hostile' : 'self'}
                  index={String(target.ordinal ?? index + 1).padStart(2, '0')}
                  title={target.label}
                  detail={target.detail}
                  onPress={() => {
                    onFocusTarget?.({ kind: target.kind, id: target.id });
                    setOpenKind(null);
                  }}
                />
              </li>
            );
          })}
        </DropPanel>
      )}
    </div>
  );
}

/** Fly the camera to the active world — the disc's old Home mark; a painted pin on a world (G1-d2). */
export function HomeChip({ onHome, aboard = false }: { onHome: () => void; aboard?: boolean }) {
  const { t } = useTranslation();
  return <RoundButton art={artIconSrc('hud-home')} label={t(aboard ? 'starter.intel.home' : 'view.home')} onPress={onHome} />;
}

/** The chat, one press away; a dot while something is unread. */
export function ChatChip({ unread, onOpen }: { unread: number; onOpen: () => void }) {
  const { t } = useTranslation();
  return (
    <RoundButton
      art={artIconSrc('hud-chat')}
      label={unread > 0 ? `${t('bell.chat')} · ${t('bell.chatUnread', { count: unread })}` : t('bell.chat')}
      count={unread}
      onPress={onOpen}
    />
  );
}

/**
 * THE BELL, LEFT OF THE CHAT (owner, 2026-11-14). The strip above the top bar went and the
 * menu took the bell's place at its end; the bell came down here, where a thumb reaches it.
 * It counts news, not states, swings when news arrives and beats only for something that
 * cannot wait: a bell that always moves is a bell nobody reads.
 */
export function SignalBell({ unseen, urgent, onOpen }: { unseen: number; urgent: boolean; onOpen: () => void }) {
  const { t } = useTranslation();
  return (
    <RoundButton
      art={artIconSrc('hud-bell')}
      label={unseen > 0 ? t('signals.beaconUnread', { count: unseen }) : t('signals.beacon')}
      count={unseen}
      urgent={urgent}
      onPress={onOpen}
    />
  );
}

/**
 * THE EVENTS RUNNING NOW, EACH WITH ITS TIME LEFT — as the mock draws them under the Now
 * line. The context card says the same once; closed, it said nothing, and the event
 * was still running. Kit status chips since G1-d2 (2026-11-14): the event's mark, the
 * shower's multiplier, the time left; the name is the chip's name for the reader and the
 * card's title when the event arrives. A press frames the ship or opens the events guide.
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
    <div className="flex flex-col items-start [&_button]:pointer-events-auto">
      {events.map((event) => {
        const left = duration(Math.max(0, event.endsAt.getTime() - now) / 60_000);
        const shower = event.kind === 'ASTEROID_SHOWER';
        return (
          <StatusChip
            key={event.id}
            glyph={EVENT_GLYPH[event.kind]}
            tone="info"
            label={t(EVENT_NAME[event.kind])}
            value={shower ? `${String(event.asteroidSpawnMultiplier)}x` : left}
            {...(shower ? { until: left } : {})}
            onPress={() => { onOpen(event); }}
          />
        );
      })}
    </div>
  );
}
