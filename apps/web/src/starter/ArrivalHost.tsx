import { FIRST_SEASON_START, fleetEntries, type Fleet } from '@astera/rules';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useGalaxy, usePirates, usePlanet, useReports } from '../api/queries.js';
import { Banner, Glyph, type GlyphId } from '../game-ui/index.js';
import { landedWorld } from './jumpWorld.js';
import { useTranslation } from 'react-i18next';
import { useApi } from '../api/context.js';
import { buildingName, hullLabel } from '../i18n/names.js';
import { full } from '../lib/format.js';
import { haptic } from '../lib/haptics.js';
import { playSound } from '../lib/sound.js';
import { RESOURCE_ART } from '../ui/assets.js';
import type { ShellRoute } from '../v2/shell/GameShell.js';
import { Icon, type IconId } from '../v2/icons.js';
import { Sheet } from '../v2/kit/Sheet.js';
import { scenePlayed, startJump, useJump, fromTheLanding } from './jump.js';
import { dismissTip, tipDismissed, tipFor, tipTriggers, type LandingTip, type TipReport } from './landingTips.js';
import { arrivalQuery, useMarkArrivalSeen } from './queries.js';
import { ProtectionLines } from './ProtectionLines.js';
import { LandingRewards, useLandingRewardsDue } from './LandingRewards.js';
import { nearestPirate } from '../lib/rewardGates.js';
import { useAttention } from '../shell/attention/store.js';
import { SURFACES } from '../shell/attention/surfaces.js';

const CARD_LINES = ['battle', 'opened', 'alerts'] as const;

interface Holding { alloy: number; crystal: number; deuterium: number; fleet: Fleet }

const ships = (fleet: Fleet): number => fleetEntries(fleet).reduce((sum, [, count]) => sum + count, 0);

/**
 * WHAT CAME DOWN, WHAT THE FIRST SEASON GAVE, AND WHAT THAT MAKES (plan F7, moment 17). Every account
 * that boards a colony ship is new, so its world opens with the first-season start (`joinSeason` and
 * the ship's door share that one question); the hold lands on top of it.
 */
function Ledger({ carried }: { carried: Holding }) {
  const { t } = useTranslation();
  const start: Holding = { ...FIRST_SEASON_START.resources, fleet: FIRST_SEASON_START.fleet };
  const total: Holding = { alloy: carried.alloy + start.alloy, crystal: carried.crystal + start.crystal, deuterium: carried.deuterium + start.deuterium, fleet: {} };
  const rows = [
    { id: 'carried', holding: carried, count: ships(carried.fleet) },
    { id: 'package', holding: start, count: ships(start.fleet) },
    { id: 'total', holding: total, count: ships(carried.fleet) + ships(start.fleet) },
  ] as const;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto_auto] items-center gap-x-2.5 gap-y-1 rounded-control border border-v2-line bg-v2-void/50 px-2 py-1.5 font-v2-mono text-micro tabular-nums">
      <span />
      {(['alloy', 'crystal', 'deuterium'] as const).map(resource => <img key={resource} src={RESOURCE_ART[resource]} alt={t(`vocabulary.resource.${resource}`)} className="size-3.5 justify-self-end object-contain" />)}
      <Icon id="i-fleet" className="size-3.5 justify-self-end text-v2-ink-2" />
      {rows.map(({ id, holding, count }) => (
        <div key={id} data-testid={`arrival-${id}`} className={`col-span-5 grid grid-cols-subgrid ${id === 'total' ? 'border-t border-v2-line-hi pt-1 font-semibold text-v2-self' : 'text-v2-ink'}`}>
          <span className="truncate font-v2-ui text-v2-ink-2">{t(`starter.arrival.${id}`)}</span>
          <span className="text-right">{full(holding.alloy)}</span>
          <span className="text-right">{full(holding.crystal)}</span>
          <span className="text-right">{full(holding.deuterium)}</span>
          <span className="text-right">{t('starter.arrival.ships', { count })}</span>
        </div>
      ))}
    </div>
  );
}

/** One of the two first moves: what it is for, in the new world's own numbers. */
function Move({ id, icon, title, line, onPick }: { id: string; icon: IconId; title: string; line: string; onPick: () => void }) {
  return (
    <button type="button" data-testid={`arrival-${id}`} onClick={onPick}
      className="flex min-h-14 flex-1 flex-col items-start gap-0.5 rounded-control border border-v2-self/50 bg-gradient-to-b from-v2-self/15 to-v2-void/40 px-2 py-1.5 text-left shadow-[0_0_14px_-6px_var(--color-v2-self)] active:scale-[.98]">
      <span className="flex items-center gap-1.5 text-caption font-semibold text-v2-ink"><Icon id={icon} className="size-4 shrink-0 text-v2-self" />{title}</span>
      <span className="text-micro leading-snug text-v2-ink-2">{line}</span>
    </button>
  );
}

/**
 * THE ONE CARD AFTER THE LANDING, and the week of short notes behind it. Reads from the main game's
 * side, since the account no longer has a ship. A scene cut short plays its ending first, once.
 */
/** Each note's mark: the thing it explains. */
const TIP_GLYPH: Record<LandingTip, GlyphId> = { core: 'target', colony: 'colony', clan: 'support', dominion: 'ranking', honor: 'star' };

export function ArrivalHost({ onPanel, onFocusContact }: { onPanel: ShellRoute; onFocusContact?: (id: string) => void }) {
  const { t } = useTranslation();
  const api = useApi();
  const jump = useJump();
  const seen = useMarkArrivalSeen();
  const { data } = useQuery(arrivalQuery(api));
  const [now] = useState(() => Date.now());
  const [tip, setTip] = useState<LandingTip | null>(null);
  const arrival = data?.arrival ?? null;
  const hull = arrival?.hull;
  const shardName = arrival?.shardName;

  // The way in, seen from here: the ship comes from its first galaxy to this world. It waits for the map.
  const planets = useGalaxy().data?.planets;
  const ordinal = arrival?.ordinal;
  const berth = arrival?.berth ?? null;
  const world = useMemo(() => (planets && ordinal !== undefined ? landedWorld(planets, ordinal, berth) : null), [planets, ordinal, berth]);
  useEffect(() => {
    if (!hull || shardName === undefined || !world || jump || scenePlayed()) return;
    startJump({ shardName, hull, look: 'RENEWED', world, landing: null, start: fromTheLanding });
  }, [hull, shardName, world, jump]);

  const landedAt = data?.landedAt?.getTime();
  // What the first week has brought so far: a note opens with the need it explains (plan 2026-11-13 §4.8).
  const reports = useReports().data?.reports;
  const core = usePlanet().data?.buildings.CORE ?? 0;
  const met = useMemo(() => {
    const battles = (reports ?? []).filter((report): report is Extract<typeof report, TipReport> =>
      'neutral' in report && 'lootAlloy' in report && 'yourLosses' in report);
    return landedAt === undefined ? new Set<LandingTip>() : tipTriggers(battles, core, landedAt);
  }, [reports, core, landedAt]);
  useEffect(() => {
    if (arrival || landedAt === undefined) { setTip(null); return; }
    setTip(tipFor({ landedAtMs: landedAt, nowMs: now, met, dismissed: tipDismissed }));
  }, [arrival, landedAt, now, met]);

  // Plan 2026-11-13 §4.7: a ship that left before its first hunt is pointed at a pirate, which keeps the shield.
  const pirates = usePirates().data?.pirates;
  const prey = arrival && !arrival.hunted && onFocusContact ? nearestPirate(pirates) : null;

  // Held open once it starts: taking the rewards empties the count that called it.
  const rewardsDue = useLandingRewardsDue(landedAt, now);
  const [rewards, setRewards] = useState<'idle' | 'open' | 'done'>('idle');
  useEffect(() => { if (rewardsDue && !arrival) setRewards(state => (state === 'idle' ? 'open' : state)); }, [rewardsDue, arrival]);

  // Each waits its turn on the screen (plan 2026-11-20 §5.5); the note never shows beside the rewards.
  const card = useAttention('arrival_card', arrival !== null && !jump, SURFACES.arrival_card);
  const payout = useAttention('landing_rewards', !arrival && rewards === 'open' && !jump, SURFACES.landing_rewards);
  const note = useAttention('landing_tip', !arrival && rewards !== 'open' && tip !== null && !jump, SURFACES.landing_tip);

  if (jump) return null;
  if (arrival) {
    if (!card.shown) return null;
    const close = (code: string) => { card.release(code); seen.mutate(); };
    const pick = (move: string, go: () => void) => { playSound('tap'); haptic('tap'); close(`act:${move}`); go(); };
    const fuel = arrival.cargo.deuterium + FIRST_SEASON_START.resources.deuterium;
    return (
      <Sheet
        title={t('starter.landing.title', { name: arrival.shardName })}
        onClose={() => { close('dismiss'); }}
        footer={
          <div className="flex items-center gap-2">
            {/* Watched again only through the map it crosses: without it the scene had nothing to fly in. */}
            <button type="button" disabled={!world} className="min-h-[var(--gk-hit)] shrink-0 rounded-control border border-v2-line-hi px-3 text-caption text-v2-ink-2 disabled:opacity-40"
              onClick={() => { if (world) startJump({ shardName: arrival.shardName, hull: arrival.hull, look: 'RENEWED', world, landing: null, start: 0, replay: true }); }}>
              {t('starter.jump.replay')}
            </button>
            <button type="button" onClick={() => { close('act:go'); }}
              className="min-h-[var(--gk-hit)] flex-1 rounded-control border border-v2-self bg-gradient-to-b from-v2-self to-v2-self/55 text-body font-bold uppercase tracking-wide text-v2-void">
              {t('starter.landing.go')}
            </button>
          </div>
        }
      >
        <div data-testid="landing-card" className="flex flex-col gap-2 pt-1 font-v2-ui">
          <Ledger carried={arrival.cargo} />
          {ships(arrival.cargo.fleet) > 0 && (
            <p className="-mt-1 text-micro leading-snug text-v2-ink-3">{fleetEntries(arrival.cargo.fleet).map(([id, count]) => `${String(count)} ${hullLabel(id)}`).join(' · ')}</p>
          )}
          <section data-testid="arrival-decide" aria-label={t('starter.arrival.decide')} className="flex flex-col gap-1">
            <h3 className="v2-legend text-v2-self">{t('starter.arrival.decide')}</h3>
            <div className="flex gap-1.5">
              {prey && onFocusContact
                ? <Move id="hunt" icon="i-attack" title={t('starter.arrival.hunt')} line={t('starter.arrival.huntLine', { minutes: prey.minutes })}
                    onPick={() => { pick('hunt', () => { onFocusContact(prey.id); }); }} />
                : <Move id="outward" icon="i-fleet" title={t('starter.arrival.outward')} line={t('starter.arrival.outwardLine', { deuterium: full(fuel) })}
                    onPick={() => { pick('outward', () => { onPanel('intel'); }); }} />}
              <Move id="grow" icon="i-mine" title={t('starter.arrival.grow')} line={t('starter.arrival.growLine', { research: t('research.synthesisName'), plant: buildingName('DEUTERIUM_PLANT') })}
                onPick={() => { pick('grow', () => { onPanel('planet', undefined, undefined, { group: 'grow', itemId: 'DEUTERIUM_PLANT' }); }); }} />
            </div>
          </section>
          {/* How the new world is kept, in its own numbers (plan 2026-11-13 §4.7). */}
          <section data-testid="arrival-protection" aria-label={t('starter.arrival.protection')} className="flex flex-col gap-1">
            <h3 className="v2-legend text-v2-self">{t('starter.arrival.protection')}</h3>
            <ProtectionLines className="flex flex-col gap-1.5 text-caption leading-snug text-v2-ink [&>li]:border-l-2 [&>li]:border-v2-self/60 [&>li]:pl-2" />
          </section>
          {/* What else changed down here: quieter than the protection, so the two do not read as one block. */}
          <ul className="mt-1 flex list-disc flex-col gap-1 border-t border-v2-line pl-4 pt-2 marker:text-v2-ink-3">
            {CARD_LINES.map(line => (
              <li key={line} className="text-caption leading-snug text-v2-ink-2">{t(`starter.landing.line.${line}`)}</li>
            ))}
          </ul>
        </div>
      </Sheet>
    );
  }
  // The landing pays first (plan 2026-11-06 §7.1 R1); the first-week note waits until it is closed.
  if (rewards === 'open') return payout.shown ? <LandingRewards onDone={(code) => { payout.release(code); setRewards('done'); }} /> : null;
  if (!tip || !note.shown) return null;
  // Under the top bar and any note it holds (`--v2-top-h` measures both): two notes never stack (owner 2026-11-18).
  return (
    <div data-testid="landing-tip" data-tip={tip} role="status" className="gk pointer-events-auto fixed inset-x-3 top-[calc(var(--v2-top-h,86px)+5px)] z-[60] mx-auto max-w-[396px]">
      <Banner tone="info" variant="strip" glyph={TIP_GLYPH[tip]} title={t(`starter.landing.tip.${tip}`)}
        action={(
          <button type="button" aria-label={t('starter.landing.dismiss')} onClick={() => { playSound('tap'); haptic('tap'); note.release('dismiss'); dismissTip(tip); setTip(null); }}
            className="-my-2 -mr-1 grid size-[var(--gk-hit)] shrink-0 place-items-center text-v2-ink-2">
            <Glyph id="close" className="gk-glyph size-4" />
          </button>
        )} />
    </div>
  );
}
