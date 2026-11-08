import { COMBAT_CLASSES, HULLS, STARTER, counters, type ClassReading, type CombatClass, type HullClass, type HullId } from '@astera/rules';
import { Fragment, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { VesselView } from '../api/starterSchemas.js';
import { combatClassLabel, hullLabel } from '../i18n/names.js';
import { compact, full } from '../lib/format.js';
import { RESOURCE_ART } from '../ui/assets.js';
import { ClassEmblem } from '../v2/kit/ClassEmblem.js';
import { VictoryMark } from './CrateBay.js';

interface Band { low: number; high: number }

/** The first victory's crate while it still waits for the win (N9): what the first hunt pays besides its loot. */
export function sealedVictoryCrate(vessel: Pick<VesselView, 'crates'>): { alloy: number; crystal: number } | null {
  const crate = vessel.crates.find(c => c.fact === 'FIRST_OUTPOST_VICTORY' && c.state === 'sealed');
  return crate ? { alloy: crate.alloy, crystal: crate.crystal } : null;
}

/** This galaxy builds one hull of each class, so a class reads as the ship a player knows from the yard. */
const shipOf = (cls: CombatClass): HullId | undefined => STARTER.hulls.find(hull => HULLS[hull].cls === cls);

/** The triangle as drawn, built from the rule: each class beside the one it beats, the last beating the first. */
const RING = ((first: CombatClass) => [first, counters(first), counters(counters(first))] as const)('SKIRMISHER');

/** The class most of the guard is: the one the triangle lights. */
function leading(reading: ClassReading | undefined): CombatClass | null {
  if (reading?.kind === 'DOMINANT') return reading.cls;
  if (reading?.kind !== 'RANGES' && reading?.kind !== 'SHARES') return null;
  const low = (cls: CombatClass) => reading.kind === 'RANGES' ? reading.shares[cls].low : reading.shares[cls];
  const [top, next] = [...COMBAT_CLASSES].sort((a, b) => low(b) - low(a));
  return top && next && low(top) > low(next) ? top : null;
}

function Guard({ reading }: { reading: ClassReading | undefined }) {
  const { t } = useTranslation();
  // A probe reads shares in whole percents.
  const percent = (low: number, high: number): string => {
    const [a, b] = [Math.round(low), Math.round(high)];
    return t('units.percent', { value: a === b ? String(a) : `${String(a)}${t('units.rangeJoin')}${String(b)}` });
  };
  const named = (cls: CombatClass, words: ReactNode) => (
    <span key={cls} data-guard-class={cls} className="whitespace-nowrap text-v2-ink">
      <ClassEmblem cls={cls} decorative className="mr-1 inline-block size-3 align-middle" />
      {combatClassLabel(cls)} <span className="font-v2-mono text-v2-ink-2">{words}</span>
    </span>
  );
  if (reading?.kind === 'RANGES' || reading?.kind === 'SHARES') {
    const share = (cls: CombatClass): Band => reading.kind === 'RANGES' ? reading.shares[cls] : { low: reading.shares[cls], high: reading.shares[cls] };
    return [...COMBAT_CLASSES].sort((a, b) => share(b).high - share(a).high || share(b).low - share(a).low)
      .map(cls => named(cls, percent(share(cls).low, share(cls).high)));
  }
  if (reading?.kind === 'DOMINANT') return named(reading.cls, t('starter.outpostReading.most'));
  const word = reading?.kind === 'NONE' ? 'none' : reading?.kind === 'EVEN' ? 'even' : 'unread';
  return <span className="text-v2-ink-2">{t(`starter.outpostReading.${word}`)}</span>;
}

/**
 * THE FIRST HUNT'S READING (plan §5.4, F4): who holds the outpost, the triangle that decides the
 * fight with each class beside the ship that flies it, and what the holds can carry home. The
 * inputs and the rule, never the answer: which ship to bring is the player's to work out.
 */
export function OutpostReading({ reading, carry, stock, crate, own = null }: {
  reading: ClassReading | undefined;
  /** What the ships at home could carry back; null leaves the line out. */
  carry: number | null;
  stock: Band | null;
  /** The first victory crate's purse while it is sealed; null once it is won. */
  crate: { alloy: number; crystal: number } | null;
  /** The class most of the player's fleet is, set on the same row as the guard: the rule, never the verdict. */
  own?: HullClass | null;
}) {
  const { t } = useTranslation();
  const lit = leading(reading);
  const short = carry !== null && stock !== null && carry < stock.low;
  return (
    <div data-testid="outpost-reading" className="flex flex-col gap-1.5 font-v2-ui">
      <p data-outpost-guard="" className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-micro leading-snug">
        <span className="v2-legend">{t('starter.outpostReading.guard')}</span>
        <Guard reading={reading} />
      </p>
      <div data-outpost-cycle="" className="flex flex-col gap-0.5">
        <div className="flex items-center gap-1">
          {RING.map((cls, index) => {
            const ship = shipOf(cls);
            return (
              <Fragment key={cls}>
                <span data-rung={cls} {...(cls === lit ? { 'data-lit': '' } : {})} {...(cls === own ? { 'data-own': '' } : {})}
                  className={`flex min-w-0 flex-1 items-center gap-1 rounded-control border px-1.5 py-1 ${cls === lit ? 'border-v2-hostile/60 bg-v2-hostile/10' : cls === own ? 'border-v2-self/60 bg-v2-self/10' : 'border-v2-line bg-v2-void/50'}`}>
                  <ClassEmblem cls={cls} decorative className="size-3.5 shrink-0" />
                  <span className="min-w-0 leading-tight">
                    <span className="block truncate text-micro font-semibold text-v2-ink">{combatClassLabel(cls)}</span>
                    {ship && <span className="block truncate text-micro text-v2-ink-3">{hullLabel(ship)}</span>}
                  </span>
                </span>
                <span aria-hidden="true" className="shrink-0 text-caption text-v2-ink-3">{index < RING.length - 1 ? '›' : '↺'}</span>
              </Fragment>
            );
          })}
        </div>
        <span className="flex items-baseline justify-between gap-2 text-micro">
          {own && own !== 'SUPPORT' ? <span data-outpost-own="" className="truncate font-semibold text-v2-self">{t('starter.outpostReading.own', { cls: combatClassLabel(own) })}</span> : <span />}
          <span data-outpost-beats="" className="text-right text-v2-ink-3">
            {t('starter.outpostReading.beats', { last: combatClassLabel(RING[2]), first: combatClassLabel(RING[0]) })}
          </span>
        </span>
      </div>
      {carry !== null && (
        <p data-outpost-carry="" {...(short ? { 'data-short': '' } : {})} className="flex items-baseline justify-between gap-2 text-micro">
          <span className="v2-legend">{t('starter.outpostReading.carry')}</span>
          <span className="truncate font-v2-mono">
            <span className={short ? 'text-v2-warn' : 'text-v2-ink'}>{full(carry)}</span>
            {stock && <span className="text-v2-ink-3"> · {t('starter.outpostReading.stock', { band: `${full(stock.low)}${t('units.rangeJoin')}${full(stock.high)}` })}</span>}
          </span>
        </p>
      )}
      {crate && (
        <p data-outpost-crate="" className="flex items-center gap-1.5 text-micro text-v2-warn">
          <VictoryMark />
          <span className="min-w-0 flex-1 truncate">{t('starter.outpostReading.crate')}</span>
          <span className="flex shrink-0 items-center gap-1 font-v2-mono">
            <img src={RESOURCE_ART.alloy} alt="" draggable={false} className="size-3.5" />+{compact(crate.alloy)}
            <img src={RESOURCE_ART.crystal} alt="" draggable={false} className="size-3.5" />+{compact(crate.crystal)}
          </span>
        </p>
      )}
    </div>
  );
}
