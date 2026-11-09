import { FIRST_SEASON_START, fleetEntries, type Fleet } from '@astera/rules';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
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
import { dismissTip, tipDismissed, tipFor, type LandingTip } from './landingTips.js';
import { arrivalQuery, useMarkArrivalSeen } from './queries.js';

const CARD_LINES = ['battle', 'shield', 'absence', 'core', 'opened', 'alerts'] as const;

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
export function ArrivalHost({ onPanel }: { onPanel: ShellRoute }) {
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

  useEffect(() => {
    if (!hull || shardName === undefined || jump || scenePlayed()) return;
    startJump({ shardName, hull, look: 'RENEWED', sky: [], landing: null, start: fromTheLanding });
  }, [hull, shardName, jump]);

  const landedAt = data?.landedAt?.getTime();
  useEffect(() => {
    if (arrival || landedAt === undefined) { setTip(null); return; }
    const next = tipFor(landedAt, now);
    setTip(next && !tipDismissed(next) ? next : null);
  }, [arrival, landedAt, now]);

  if (jump) return null;
  if (arrival) {
    const pick = (go: () => void) => { playSound('tap'); haptic('tap'); seen.mutate(); go(); };
    const fuel = arrival.cargo.deuterium + FIRST_SEASON_START.resources.deuterium;
    return (
      <Sheet
        title={t('starter.landing.title', { name: arrival.shardName })}
        onClose={() => { seen.mutate(); }}
        footer={
          <div className="flex items-center gap-2">
            <button type="button" className="min-h-11 shrink-0 rounded-control border border-v2-line-hi px-3 text-caption text-v2-ink-2"
              onClick={() => { startJump({ shardName: arrival.shardName, hull: arrival.hull, look: 'RENEWED', sky: [], landing: null, start: 0, replay: true }); }}>
              {t('starter.jump.replay')}
            </button>
            <button type="button" onClick={() => { seen.mutate(); }}
              className="min-h-11 flex-1 rounded-control border border-v2-self bg-gradient-to-b from-v2-self to-v2-self/55 text-body font-bold uppercase tracking-wide text-v2-void">
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
              <Move id="outward" icon="i-fleet" title={t('starter.arrival.outward')} line={t('starter.arrival.outwardLine', { deuterium: full(fuel) })}
                onPick={() => { pick(() => { onPanel('intel'); }); }} />
              <Move id="grow" icon="i-mine" title={t('starter.arrival.grow')} line={t('starter.arrival.growLine', { research: t('research.synthesisName'), plant: buildingName('DEUTERIUM_PLANT') })}
                onPick={() => { pick(() => { onPanel('planet', undefined, undefined, { group: 'grow', itemId: 'DEUTERIUM_PLANT' }); }); }} />
            </div>
          </section>
          <ul className="flex flex-col gap-1.5">
            {CARD_LINES.map(line => (
              <li key={line} className="border-l-2 border-v2-self/60 pl-2 text-caption leading-snug text-v2-ink">{t(`starter.landing.line.${line}`)}</li>
            ))}
          </ul>
        </div>
      </Sheet>
    );
  }
  if (!tip) return null;
  return (
    <div data-testid="landing-tip" role="status" className="pointer-events-auto fixed inset-x-3 top-[calc(env(safe-area-inset-top)+96px)] z-[60] mx-auto flex max-w-[440px] items-start gap-2 rounded-control border border-v2-self/40 bg-v2-panel/95 px-2.5 py-2 font-v2-ui shadow-lg">
      <p className="min-w-0 flex-1 text-caption leading-snug text-v2-ink">{t(`starter.landing.tip.${tip}`)}</p>
      <button type="button" aria-label={t('starter.landing.dismiss')} onClick={() => { dismissTip(tip); setTip(null); }}
        className="-m-1 min-h-8 min-w-8 text-v2-ink-2">×</button>
    </div>
  );
}
