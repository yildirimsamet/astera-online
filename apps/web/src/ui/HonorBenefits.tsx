import { HONOR_BENEFIT_RATES, type HonorBenefitTier, type Resources } from '@astera/rules';
import { useTranslation } from 'react-i18next';
import type { HonorBenefitsView } from '../api/schemas.js';
import { honorScore } from '../lib/honor.js';
import { full } from '../lib/format.js';
import { HonorIcon } from './icons/index.js';
import { Glyph, HonorBadge } from '../game-ui/index.js';
import { RulesRow } from './RulesRow.js';
import { RESOURCE_ART } from './assets.js';

const tiers: readonly HonorBenefitTier[] = [2, 1, 0, -1, -2];
const goods = ['alloy', 'crystal', 'deuterium'] as const;
const signedPercent = (value: number): string => value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : '0';
type Tone = 'good' | 'hostile' | undefined;
const tone = (beneficial: boolean, adverse: boolean): Tone => beneficial ? 'good' : adverse ? 'hostile' : undefined;
/** What each effect does to me: a cheaper repair and a bigger convoy are good, a commission is harm. */
const effectTones = (tier: HonorBenefitTier): readonly Tone[] => {
  const rate = HONOR_BENEFIT_RATES[tier];
  return [tone(rate.repairPct < 0, rate.repairPct > 0), tone(rate.convoyPct > 0, rate.convoyPct < 0), tone(false, rate.tradePct > 0)];
};

/**
 * All economic effects in one place; current terms come from the private server quote (G9-a, on the
 * kit): the tier's badge, the three effects in their colour, the Honor the next tier needs, the
 * ladder one press away.
 */
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
  const { positive: p, negative: n } = value.thresholds;
  const range = (tier: HonorBenefitTier): string => {
    if (tier === 2) return t('honorBenefits.atLeast', { amount: honorScore(p[1]) });
    if (tier === -2) return t('honorBenefits.atMost', { amount: honorScore(-n[1]) });
    if (tier === 1) return t('honorBenefits.range', { low: honorScore(p[0]), high: honorScore(p[1]) });
    if (tier === -1) return t('honorBenefits.negativeRange', { low: honorScore(-n[1]), high: honorScore(-n[0]) });
    return t('honorBenefits.neutralRange', { low: honorScore(-n[0]), high: honorScore(p[0]) });
  };
  // A positive tier is reached AT its threshold, so the gap is exact; a penalty is left only ABOVE its line.
  const next = value.tier === 2 ? null
    : value.tier >= 0 ? t('honorBenefits.next', { amount: honorScore(BigInt(p[value.tier === 0 ? 0 : 1]) - BigInt(value.score)), tier: tierName(value.tier === 0 ? 1 : 2) })
      : t('honorBenefits.climb', { amount: honorScore(-n[value.tier === -1 ? 0 : 1]), tier: tierName(value.tier === -1 ? 0 : -1) });
  const now = effectTones(value.tier);
  return <section data-honor-benefits className="gk gk-well gk-honorperk" data-tone={value.tier > 0 ? 'good' : value.tier < 0 ? 'hostile' : undefined}>
    <div className="gk-honorperk__head">
      <HonorBadge tier={value.tier} label={tierName(value.tier)} height={40} />
      <div className="gk-honorperk__name">
        <h3 className="gk-label">{t('honorBenefits.title')}</h3>
        <p className="gk-display gk-honorperk__tier">{tierName(value.tier)}</p>
      </div>
    </div>
    <dl className="gk-figures gk-honorperk__now">
      {rates(value.tier).map((percent, index) => <div key={index} className="gk-figure">
        <dt className="gk-label">{headings[index]}</dt>
        <dd className="gk-num gk-figure__value" data-tone={now[index]}>{t('honorBenefits.percent', { amount: signedPercent(percent) })}</dd>
      </div>)}
    </dl>
    {next ? <p data-honor-next className="gk-honorperk__next"><Glyph id="up" />{next}</p> : null}
    <RulesRow glyph="ranking" title={t('honorBenefits.allTiers')}>
      <div className="gk-honorperk__cols" aria-hidden="true">{headings.map((heading) => <span key={heading}>{heading}</span>)}</div>
      <ol className="gk-honorperk__ladder">
        {tiers.map(tier => {
          const paint = effectTones(tier);
          return <li key={tier} data-honor-tier={tier} data-current-honor-tier={tier === value.tier ? true : undefined} className="gk-honorperk__rung">
            <HonorBadge tier={tier} label="" height={26} />
            <span className="gk-honorperk__rungname"><strong>{tierName(tier)}</strong><span className="gk-num">{range(tier)}</span></span>
            <span className="gk-honorperk__rates">{rates(tier).map((percent, index) => <span key={index} className="gk-num gk-honorperk__rate" data-tone={paint[index]}
              aria-label={`${headings[index]} ${t('honorBenefits.percent', { amount: signedPercent(percent) })}`}>
              {t('honorBenefits.percent', { amount: signedPercent(percent) })}</span>)}</span>
          </li>;
        })}
      </ol>
      <p className="gk-note">{t('honorBenefits.rules')}</p>
    </RulesRow>
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
  const shown = goods.filter(good => base[good] > 0 || net[good] > 0);
  return <div data-honor-effect={kind} className="gk gk-well gk-honorquote" data-tone={tone(beneficial, adverse)}>
    <p className="gk-honorquote__title" data-tone={tone(beneficial, adverse)}><HonorIcon className="gk-honorquote__icon" /><span>{title}</span></p>
    {shown.length > 0 ? <table className="gk-honorquote__table">
      <thead><tr><th scope="col" /><th scope="col">{t('honorBenefits.base')}</th><th scope="col">{t('honorBenefits.difference')}</th>
        <th scope="col">{t(kind === 'repair' ? 'honorBenefits.youPay' : 'honorBenefits.net')}</th></tr></thead>
      <tbody>{shown.map(good => {
        const delta = net[good] - base[good];
        return <tr key={good}>
          <th scope="row"><img src={RESOURCE_ART[good]} alt="" /><span>{t(`vocabulary.resource.${good}`)}</span></th>
          <td className="gk-num">{full(base[good])}</td>
          <td className="gk-num" data-tone={delta === 0 ? undefined : tone(beneficial, adverse)}>{delta === 0 ? '0' : `${delta > 0 ? '+' : '−'}${full(Math.abs(delta))}`}</td>
          <td className="gk-num gk-honorquote__net">{full(net[good])}</td>
        </tr>;
      })}</tbody>
    </table> : null}
    <p className="gk-note">{t(kind === 'repair' ? 'honorBenefits.repairRule' : kind === 'convoy' ? 'honorBenefits.convoyRule' : 'honorBenefits.tradeRule')}</p>
  </div>;
}
