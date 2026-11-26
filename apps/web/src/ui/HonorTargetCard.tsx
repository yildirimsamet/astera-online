import { useTranslation } from 'react-i18next';
import type { HonorTarget } from '../api/schemas.js';
import { Glyph, InfoPeek } from '../game-ui/index.js';
import { HonorSoloPolicy } from './HonorSoloNotice.js';

/**
 * Coarse current guidance; the committed battle keeps its own authoritative references.
 *
 * FOLDED (owner 2026-11-25: "küçültülmeli, accordion veya infobox gibi olmalı"). Closed it is one line, what
 * kind of target and what military return. A PRICE STAYS OPEN, as the line that changes the decision: a weaker
 * target's warning, and a no-return target's "again within 24 hours costs Honor" (headed "No military return",
 * the card's old rule). Every other rule the card used to print is one press away (UI-12 progressive disclosure).
 */
export function HonorTargetCard({ value }: { value: HonorTarget }) {
  const { t } = useTranslation();
  if (!value.enabled || !value.eligible) return null;
  const weak = value.kind === 'WEAK';
  // A target that pays nothing back and charges a second raid: its price is read before the press.
  const noReturn = !weak && !value.related && value.militaryReturn === 'NONE';
  const fold = value.kind === 'PEER' && noReturn ? t('leaderboard.honorTarget.noReturn')
    : t('leaderboard.honorTarget.fold', {
      kind: t(`leaderboard.honorTarget.${value.kind}`),
      value: t(`leaderboard.honorTarget.short.${value.related ? 'RELATED' : value.militaryReturn}`),
    });
  return <section data-honor-target aria-label={t('leaderboard.honorTarget.title')} className="gk-well gk-honor"
    data-kind={value.kind}>
    <InfoPeek
      lead={<Glyph id="ranking" />}
      fact={weak ? t('leaderboard.honorTarget.WEAK') : fold}
      about={t('leaderboard.honorTarget.more')}
      rule={<>
        {value.topTierPeer && <p className="gk-honor__line" data-tone="self">
          {t('leaderboard.honorTarget.topTierPeer')}
        </p>}
        {!weak && !value.related && value.militaryReturn !== 'NONE' && <p className="gk-honor__line">
          {t('leaderboard.honorTarget.eligible')}
        </p>}
        {value.related ? <p className="gk-honor__line" data-tone="ink">{t('leaderboard.honorReason.RELATED')}</p>
          : !weak && !noReturn && <p className="gk-honor__line">{t(`leaderboard.honorTarget.${value.militaryReturn}`)}</p>}
        {value.repeated && <p className="gk-honor__line">{t('leaderboard.honorTarget.repeated')}</p>}
        {value.retaliation && <p className="gk-honor__line">{t('leaderboard.honorTarget.retaliation', {
          percent: value.retaliationLootPercent ?? 20,
        })}</p>}
        {value.soloCredit && <HonorSoloPolicy look="kit" />}
        <p className="gk-sub">{t('leaderboard.honorTarget.estimate')}</p>
      </>} />
    {weak && <p className="gk-honor__line" data-tone="warn">
      {t(`leaderboard.honorTarget.${value.repeatRaid ? 'repeatRaid' : 'weakWarning'}`)}
    </p>}
    {/* Honor V2: a weaker target raided again costs more; that price stays open with the warning above. */}
    {weak && (value.weakMultiplier ?? 1) >= 2 && (
      <p data-honor-escalated-warning className="gk-honor__line" data-tone="hostile">
        {t(
          (value.priorWeakCount ?? 0) >= 1
            ? 'leaderboard.honorTarget.escalatedWeak'
            : 'leaderboard.honorTarget.escalatedInFlight',
          { multiplier: value.weakMultiplier },
        )}
      </p>
    )}
    {noReturn && <p className="gk-honor__line">{t('leaderboard.honorTarget.NONE')}</p>}
  </section>;
}
