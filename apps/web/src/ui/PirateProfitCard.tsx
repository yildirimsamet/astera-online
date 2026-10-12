import { useTranslation } from 'react-i18next';
import type { PirateProfitForecast, Resources } from '@astera/rules';
import { full } from '../lib/format.js';
import { RESOURCE_ART } from './assets.js';

export type PirateProfitState = 'empty' | 'unavailable' | 'pending' | 'ready';
const resources = ['alloy', 'crystal', 'deuterium'] as const;
const signed = (value: number): string => {
  const amount = Math.round(Math.abs(value));
  return `${amount === 0 ? '' : value < 0 ? '−' : '+'}${full(amount)}`;
};

/** The return after expenses, with the three materials kept separate. */
export function PirateProfitCard({ forecast, state, radiation = false }: {
  forecast: PirateProfitForecast | null;
  state: PirateProfitState;
  radiation?: boolean;
}) {
  const { t } = useTranslation();
  if (state !== 'ready' || forecast === null) {
    return <section data-testid="pirate-profit" aria-live="polite" aria-busy={state === 'pending'}
      className="rounded-control border border-v2-line bg-v2-deep/40 px-3 py-2">
      <h3 className="text-caption font-semibold text-v2-ink-2">{t('pirate.profit.title')}</h3>
      <p className="mt-1 text-caption leading-snug text-v2-ink-3">{t(`pirate.profit.${state === 'ready' ? 'unavailable' : state}`)}</p>
    </section>;
  }
  const positive = forecast.verdict === 'PROFIT';
  const rows: { key: 'loot' | 'salvage' | 'loss' | 'repair' | 'fuel'; amount: Resources; expense: boolean }[] = [
    { key: 'loot', amount: forecast.loot, expense: false },
    ...(resources.some(key => forecast.salvage[key] > 0)
      ? [{ key: 'salvage' as const, amount: forecast.salvage, expense: false }] : []),
    { key: 'loss', amount: forecast.lossCost, expense: true },
    { key: 'repair', amount: forecast.repair, expense: true },
    { key: 'fuel', amount: { alloy: 0, crystal: 0, deuterium: forecast.fuel }, expense: true },
  ];
  return <section data-testid="pirate-profit" aria-live="polite"
    className={`overflow-hidden rounded-control border bg-v2-deep/60 ${positive ? 'border-v2-self/35' : 'border-v2-hostile/35'}`}>
    <header className={`flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b px-3 py-2 ${positive ? 'border-v2-self/20 bg-v2-self/5' : 'border-v2-hostile/20 bg-v2-hostile/5'}`}>
      <h3 className="text-caption font-semibold text-v2-ink">{t('pirate.profit.title')}</h3>
      <p className={`text-caption font-semibold ${positive ? 'text-v2-self' : 'text-v2-hostile'}`}>{t(`pirate.profit.${forecast.verdict}`)}</p>
    </header>
    <div className="px-2.5 py-2">
      <table className="w-full table-fixed text-micro">
        <colgroup><col className="w-[34%]" /><col /><col /><col /></colgroup>
        <thead><tr><th scope="col"><span className="sr-only">{t('pirate.profit.title')}</span></th>
          {resources.map(key => <th key={key} scope="col" className="pb-1 text-right font-medium text-v2-ink-2">
            <span className="inline-flex flex-wrap items-center justify-end gap-1">
              <img src={RESOURCE_ART[key]} alt="" aria-hidden className="size-4 object-contain" />
              {t(`leaderboard.archive.resources.${key}`)}
            </span>
          </th>)}
        </tr></thead>
        <tbody>
          <tr><th scope="row" className="text-left text-caption font-normal text-v2-ink-2">{t('pirate.profit.net')}</th>
            {resources.map(key => <td key={key} className="text-right align-top">
              <div data-profit-net={key} className={`break-words font-v2-mono text-caption font-semibold ${forecast.net[key] < 0 ? 'text-v2-hostile' : 'text-v2-ink'}`}>{signed(forecast.net[key])}</div>
            </td>)}
          </tr>
          <tr><th scope="row" className="pb-2 text-left font-normal text-v2-ink-3">{t('pirate.profit.range')}</th>
            {resources.map(key => <td key={key} className="break-words pb-2 text-right font-v2-mono text-micro text-v2-ink-3">{signed(forecast.low[key])}…{signed(forecast.high[key])}</td>)}
          </tr>
          {rows.map(row => <tr key={row.key} className="border-t border-v2-line/50">
            <th scope="row" className="py-1 pr-1 text-left font-normal leading-snug text-v2-ink-3">{t(`pirate.profit.${row.key}`)}</th>
            {resources.map(key => <td key={key} className="break-words py-1 text-right font-v2-mono text-v2-ink-2">{signed(row.amount[key] * (row.expense ? -1 : 1))}</td>)}
          </tr>)}
        </tbody>
      </table>
      {(forecast.cargoLimitedShare > 0 || forecast.lossChance > 0) && <div className="mt-2 border-l-2 border-v2-hostile/50 pl-2 text-caption leading-snug text-v2-hostile">
        {forecast.cargoLimitedShare > 0 && <p>{t('pirate.profit.cargo')}</p>}
        {forecast.lossChance > 0 && <p>{t('pirate.profit.losses')}</p>}
      </div>}
      <p className="mt-2 text-micro leading-snug text-v2-ink-3">{t('pirate.profit.uncertain')}</p>
      <p className="mt-1 text-micro leading-snug text-v2-ink-3">{t('pirate.profit.exclusions')} {t('pirate.profit.value')}</p>
      {radiation && <p className="mt-1 text-micro leading-snug text-v2-ink-3">{t('pirate.profit.radiation')}</p>}
    </div>
  </section>;
}
