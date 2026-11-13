import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CORE_TOP_LEVEL, coreTier } from '@astera/rules';
import { Glyph } from '../game-ui/icons.js';

/** Read the boundaries from the rules, including the player's current/next tier. */
export function CoreTierInfo({ level }: { level: number }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const id = useId();
  const currentTier = coreTier(level);
  const throughTier = coreTier(Math.max(CORE_TOP_LEVEL, level + 1));
  const rows: { tier: number; from: number; to: number }[] = [];
  for (let core = 1; coreTier(core) <= throughTier; core++) {
    const tier = coreTier(core);
    const previous = rows.at(-1);
    if (previous?.tier === tier) previous.to = core;
    else rows.push({ tier, from: core, to: core });
  }

  return (
    <section data-core-tier-info className="gk-well gk-tiers">
      <button type="button" aria-expanded={open} aria-controls={id}
        onClick={() => { setOpen(value => !value); }}
        className="gk-tiers__toggle">
        <Glyph id="ranking" />
        <span className="gk-tiers__title">{t('itemSheet.coreTierGuide')}</span>
        <Glyph id={open ? 'minus' : 'plus'} />
      </button>
      <p className="gk-tiers__now gk-num">{t('itemSheet.coreTierCurrent', { level, tier: currentTier })}</p>
      {open && <div id={id} className="gk-tiers__body">
        <p className="gk-tiers__rule">{t('itemSheet.coreTierRule')}</p>
        <table className="gk-tiers__table" aria-label={t('itemSheet.coreTierGuide')}>
          <thead><tr>
            <th scope="col">{t('itemSheet.coreTierLevel')}</th>
            <th scope="col">{t('itemSheet.coreTierPlanet')}</th>
          </tr></thead>
          <tbody>{rows.map(row => <tr key={row.tier} aria-current={row.tier === currentTier ? 'true' : undefined}>
            <td className="gk-num">{t('itemSheet.coreTierRange', { from: row.from, to: row.to })}</td>
            <td>{t('planetHero.tier', { tier: row.tier })}</td>
          </tr>)}</tbody>
        </table>
      </div>}
    </section>
  );
}
