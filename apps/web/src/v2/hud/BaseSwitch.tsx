import { useTranslation } from 'react-i18next';
import { GameTabs } from '../../game-ui/index.js';

export type BaseView = 'world' | 'research' | 'ship';

/**
 * PLANET | RESEARCH | SHIP. Decision K6 (docs/ui-v2/gozlemevi.md); one short word each since S2
 * (owner 2026-11-16), so the three plates stay one width.
 *
 * Research used to be its own panel behind a corner button; it lives on the Base now,
 * one switch away from the world it is built on. The two pages keep their own routes
 * (`planet`, `research`), so a notification or a refusal that names either still lands
 * on it; this is only the door between them.
 */
export function BaseSwitch({ value, onChange, arenaAvailable = false }: {
  value: BaseView; onChange: (view: BaseView) => void; arenaAvailable?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="gk px-3 pb-2">
      <GameTabs
        label={t('baseSwitch.label')}
        tabs={[
          // Owner 2026-10-27: a coloured glyph beside each word — the world, its research, the ship flown.
          { id: 'world', label: t('baseSwitch.world'), glyph: { id: 'home', tone: 'alloy' } },
          { id: 'research', label: t('baseSwitch.research'), glyph: { id: 'star', tone: 'crystal' } },
          ...(arenaAvailable ? [{ id: 'ship' as const, label: t('baseSwitch.ship'), glyph: { id: 'rocket' as const, tone: 'self' as const } }] : []),
        ]}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}
