import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CORE_TOP_LEVEL, coreTier } from '@astera/rules';

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
    <section data-core-tier-info className="rounded-control border border-v2-line bg-v2-deep/60 px-3 py-2.5">
      <button type="button" aria-expanded={open} aria-controls={id}
        onClick={() => { setOpen(value => !value); }}
        className="flex min-h-10 w-full items-center gap-2 text-left text-caption font-semibold text-v2-self">
        <span aria-hidden="true" className="shrink-0">ⓘ</span>
        <span className="min-w-0 flex-1">{t('itemSheet.coreTierGuide')}</span>
        <span aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      <p className="font-v2-mono text-caption text-v2-ink">{t('itemSheet.coreTierCurrent', { level, tier: currentTier })}</p>
      {open && <div id={id}>
        <p className="mb-2 mt-2 text-caption leading-snug text-v2-ink-2">{t('itemSheet.coreTierRule')}</p>
        <table className="w-full table-fixed text-caption" aria-label={t('itemSheet.coreTierGuide')}>
          <thead className="text-v2-ink-3"><tr>
            <th scope="col" className="pb-1 text-left font-medium">{t('itemSheet.coreTierLevel')}</th>
            <th scope="col" className="pb-1 text-right font-medium">{t('itemSheet.coreTierPlanet')}</th>
          </tr></thead>
          <tbody>{rows.map(row => <tr key={row.tier} aria-current={row.tier === currentTier ? 'true' : undefined}
            className={`border-t border-v2-line ${row.tier === currentTier ? 'bg-v2-self/10 text-v2-self' : 'text-v2-ink-2'}`}>
            <td className="py-1 font-v2-mono">{t('itemSheet.coreTierRange', { from: row.from, to: row.to })}</td>
            <td className="py-1 text-right">{t('planetHero.tier', { tier: row.tier })}</td>
          </tr>)}</tbody>
        </table>
      </div>}
    </section>
  );
}
