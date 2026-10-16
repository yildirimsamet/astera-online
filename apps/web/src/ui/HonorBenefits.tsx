import { HONOR_BENEFIT_RATES, type HonorBenefitTier, type Resources } from '@astera/rules';
import { useTranslation } from 'react-i18next';
import type { HonorBenefitsView } from '../api/schemas.js';
import { honorScore } from '../lib/honor.js';
import { full } from '../lib/format.js';
import { HonorIcon } from './icons/index.js';
import { RESOURCE_ART } from './assets.js';

const tiers: readonly HonorBenefitTier[] = [2, 1, 0, -1, -2];
const goods = ['alloy', 'crystal', 'deuterium'] as const;
const signedPercent = (value: number): string => value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : '0';
const tone = (beneficial: boolean, adverse: boolean): string => beneficial ? 'text-v2-self' : adverse ? 'text-threat-ink' : 'text-v2-ink-2';

/** All economic effects in one place; current terms come from the private server quote. */
export function HonorBenefitsSection({ value }: { value: HonorBenefitsView | null | undefined }) {
  const { t } = useTranslation();
  if (!value) return null;
  const tierName = (tier: HonorBenefitTier) => tier > 0 ? t('honorBenefits.positiveTier', { tier })
    : tier < 0 ? t('honorBenefits.negativeTier', { tier: Math.abs(tier) }) : t('honorBenefits.neutral');
  const rates = (tier: HonorBenefitTier) => {
    const rate = HONOR_BENEFIT_RATES[tier];
    return [rate.repairPct, rate.convoyPct, rate.tradePct];
  };
  const headings = [t('honorBenefits.repair'), t('honorBenefits.convoy'), t('honorBenefits.trade')];
  const range = (tier: HonorBenefitTier): string => {
    const { positive: p, negative: n } = value.thresholds;
    if (tier === 2) return t('honorBenefits.atLeast', { amount: honorScore(p[1]) });
    if (tier === -2) return t('honorBenefits.atMost', { amount: honorScore(-n[1]) });
    if (tier === 1) return t('honorBenefits.range', { low: honorScore(p[0]), high: honorScore(p[1]) });
    if (tier === -1) return t('honorBenefits.negativeRange', { low: honorScore(-n[1]), high: honorScore(-n[0]) });
    return t('honorBenefits.neutralRange', { low: honorScore(-n[0]), high: honorScore(p[0]) });
  };
  return <section data-honor-benefits className="flex flex-col gap-3 rounded-control border border-v2-line-hi bg-linear-to-br from-v2-self/8 via-v2-panel to-v2-deep p-3 font-v2-ui">
    <div className="flex items-start justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2"><HonorIcon className="size-5 shrink-0 text-v2-self" />
        <h3 className="text-body font-bold text-v2-ink">{t('honorBenefits.title')}</h3></div>
      <strong className={`shrink-0 font-v2-mono text-caption ${tone(value.tier > 0, value.tier < 0)}`}>{honorScore(value.score)}</strong>
    </div>
    <div className="flex items-baseline justify-between gap-2 text-caption">
      <span className={tone(value.tier > 0, value.tier < 0)}>{tierName(value.tier)}</span>
      <span className="text-right text-micro text-v2-ink-3">{t('honorBenefits.current')}</span>
    </div>
    <div className="grid grid-cols-3 gap-2 border-y border-v2-line py-2">
      {rates(value.tier).map((percent, index) => <div key={index} className="flex min-w-0 flex-col gap-1">
        <span className="text-micro leading-snug text-v2-ink-2">{headings[index]}</span>
        <strong className={`font-v2-mono text-body ${tone(value.tier > 0, value.tier < 0)}`}>
          {t('honorBenefits.percent', { amount: signedPercent(percent) })}</strong>
      </div>)}
    </div>
    <details className="group flex flex-col gap-2">
      <summary className="cursor-pointer list-none py-1 text-caption font-semibold text-v2-ink underline decoration-v2-line-hi underline-offset-4">{t('honorBenefits.allTiers')}</summary>
      <div className="flex flex-col divide-y divide-v2-line">
        {tiers.map(tier => <div key={tier} data-honor-tier={tier} data-current-honor-tier={tier === value.tier ? true : undefined}
          className={`flex flex-col gap-2 py-2 ${tier === value.tier ? 'text-v2-ink' : 'text-v2-ink-2'}`}>
          <div className="flex items-baseline justify-between gap-2"><strong className="text-caption font-semibold">{tierName(tier)}</strong>
            <span className="text-right font-v2-mono text-micro">{range(tier)}</span></div>
          <div className="grid grid-cols-3 gap-2">{rates(tier).map((percent, index) => <span key={index} className="flex min-w-0 flex-col gap-1 text-micro">
            <span>{headings[index]}</span><strong className={`font-v2-mono text-caption ${tone(tier > 0, tier < 0)}`}>{t('honorBenefits.percent', { amount: signedPercent(percent) })}</strong>
          </span>)}</div>
        </div>)}
      </div>
      <p className="py-2 text-micro leading-relaxed text-v2-ink-2">{t('honorBenefits.rules')}</p>
    </details>
  </section>;
}

/** The exact effect and net pile beside the commitment, never a colour-only promise. */
export function HonorEffectQuote({ kind, value, base, net }: { kind: 'repair' | 'convoy' | 'trade';
  value: HonorBenefitsView | null | undefined; base: Resources; net: Resources }) {
  const { t } = useTranslation();
  if (!value) return null;
  const percent = kind === 'repair' ? value.repairPct : kind === 'convoy' ? value.convoyPct : value.tradePct;
  const beneficial = kind === 'trade' ? value.tier > 0 : kind === 'repair' ? percent < 0 : percent > 0;
  const adverse = kind === 'trade' ? percent > 0 : kind === 'repair' ? percent > 0 : percent < 0;
  const title = kind === 'trade' ? t(beneficial ? 'honorBenefits.freeCommission' : adverse ? 'honorBenefits.commission' : 'honorBenefits.neutralCommission', { amount: percent })
    : t(beneficial ? 'honorBenefits.bonus' : adverse ? 'honorBenefits.penalty' : 'honorBenefits.noChange', { amount: signedPercent(percent) });
  return <div data-honor-effect={kind} className="flex flex-col gap-2 border-l-2 border-v2-line-hi pl-2.5 font-v2-ui">
    <p className={`flex items-center gap-1.5 text-caption font-semibold ${tone(beneficial, adverse)}`}><HonorIcon className="size-3.5 shrink-0" /><span>{title}</span></p>
    <div className="grid grid-cols-[repeat(4,minmax(0,1fr))] items-center gap-x-2 gap-y-1 text-micro">
      <span /><span className="text-right text-v2-ink-3">{t('honorBenefits.base')}</span>
      <span className="text-right text-v2-ink-3">{t('honorBenefits.difference')}</span><span className="text-right text-v2-ink-2">{t(kind === 'repair' ? 'honorBenefits.youPay' : 'honorBenefits.net')}</span>
      {goods.filter(good => base[good] > 0 || net[good] > 0).map(good => {
        const delta = net[good] - base[good];
        return <div key={good} className="contents"><span className="flex min-w-0 items-center gap-1 text-v2-ink-2"><img src={RESOURCE_ART[good]} alt="" className="size-4 shrink-0" /><span className="truncate">{t(`vocabulary.resource.${good}`)}</span></span>
          <span className="break-all text-right font-v2-mono text-v2-ink-3">{full(base[good])}</span>
          <span className={`break-all text-right font-v2-mono ${delta === 0 ? 'text-v2-ink-3' : tone(beneficial, adverse)}`}>{delta === 0 ? '0' : `${delta > 0 ? '+' : '−'}${full(Math.abs(delta))}`}</span>
          <strong className="break-all text-right font-v2-mono font-semibold text-v2-ink">{full(net[good])}</strong></div>;
      })}
    </div>
    <p className="text-micro leading-relaxed text-v2-ink-3">{t(kind === 'repair' ? 'honorBenefits.repairRule' : kind === 'convoy' ? 'honorBenefits.convoyRule' : 'honorBenefits.tradeRule')}</p>
  </div>;
}
