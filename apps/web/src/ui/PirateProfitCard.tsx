import { useTranslation } from 'react-i18next';
import type { PirateProfitForecast, Resources } from '@astera/rules';
import { full } from '../lib/format.js';
import { RESOURCE_ART } from './assets.js';
import { Glyph } from '../game-ui/index.js';

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
    return <section data-testid="pirate-profit" aria-live="polite" aria-busy={state === 'pending'} className="gk-well gk-profit">
      <h3 className="gk-label">{t('pirate.profit.title')}</h3>
      <p className="gk-sub">{t(`pirate.profit.${state === 'ready' ? 'unavailable' : state}`)}</p>
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
  return <section data-testid="pirate-profit" aria-live="polite" className="gk-well gk-profit" data-verdict={positive ? 'profit' : 'loss'}>
    <header className="gk-profit__head">
      <h3 className="gk-label">{t('pirate.profit.title')}</h3>
      <p className="gk-profit__verdict">{t(`pirate.profit.${forecast.verdict}`)}</p>
    </header>
    <table className="gk-profit__table">
      <colgroup><col className="gk-profit__labels" /><col /><col /><col /></colgroup>
      <thead><tr><th scope="col"><span className="sr-only">{t('pirate.profit.title')}</span></th>
        {resources.map(key => <th key={key} scope="col">
          <span className="gk-profit__res">
            <img src={RESOURCE_ART[key]} alt="" aria-hidden />
            {t(`leaderboard.archive.resources.${key}`)}
          </span>
        </th>)}
      </tr></thead>
      <tbody>
        <tr className="gk-profit__net"><th scope="row">{t('pirate.profit.net')}</th>
          {resources.map(key => <td key={key}>
            <div data-profit-net={key} className="gk-num" {...(forecast.net[key] < 0 ? { 'data-tone': 'hostile' } : {})}>{signed(forecast.net[key])}</div>
          </td>)}
        </tr>
        <tr className="gk-profit__range"><th scope="row">{t('pirate.profit.range')}</th>
          {resources.map(key => <td key={key} className="gk-num">{signed(forecast.low[key])}…{signed(forecast.high[key])}</td>)}
        </tr>
        {rows.map(row => <tr key={row.key} className="gk-profit__row">
          <th scope="row">{t(`pirate.profit.${row.key}`)}</th>
          {resources.map(key => <td key={key} className="gk-num">{signed(row.amount[key] * (row.expense ? -1 : 1))}</td>)}
        </tr>)}
      </tbody>
    </table>
    {(forecast.cargoLimitedShare > 0 || forecast.lossChance > 0) && <div className="gk-profit__risk">
      {forecast.cargoLimitedShare > 0 && <p className="gk-inote" data-tone="warn"><Glyph id="warn" />{t('pirate.profit.cargo')}</p>}
      {forecast.lossChance > 0 && <p className="gk-inote" data-tone="warn"><Glyph id="warn" />{t('pirate.profit.losses')}</p>}
    </div>}
    <p className="gk-sub">{t('pirate.profit.uncertain')}</p>
    <p className="gk-sub">{t('pirate.profit.exclusions')} {t('pirate.profit.value')}</p>
    {radiation && <p className="gk-sub">{t('pirate.profit.radiation')}</p>}
  </section>;
}
