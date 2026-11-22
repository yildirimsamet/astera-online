import { useTranslation } from 'react-i18next';
import { GameTabs } from '../../game-ui/index.js';
import { useMoonT } from '../../i18n/moon.js';

export type BaseView = 'world' | 'moon' | 'research' | 'ship';

/**
 * PLANET | MOON | RESEARCH | SHIP. Decision K6 (docs/ui-v2/gozlemevi.md); one short word each since S2
 * (owner 2026-11-16), so the plates stay one width.
 *
 * Moon sits directly to the right of Planet whenever the galaxy has moons enabled, giving every
 * world's lunar dock, Planet↔Moon transfer, Moon Gate and Gözcü scanner a dedicated first-class
 * door rather than hiding them inside the Intel tab.
 */
export function BaseSwitch({ value, onChange, moonAvailable = false, arenaAvailable = false }: {
  value: BaseView; onChange: (view: BaseView) => void; moonAvailable?: boolean; arenaAvailable?: boolean;
}) {
  const { t } = useTranslation();
  const mt = useMoonT();
  return (
    <div className="gk px-3 pb-2">
      <GameTabs
        label={t('baseSwitch.label')}
        tabs={[
          // Owner 2026-10-27: a coloured glyph beside each word — the world, its moon, research, the ship flown.
          { id: 'world', label: t('baseSwitch.world'), glyph: { id: 'home', tone: 'alloy' } },
          ...(moonAvailable ? [{ id: 'moon' as const, label: mt('title'), glyph: { id: 'moon' as const, tone: 'warn' as const } }] : []),
          { id: 'research', label: t('baseSwitch.research'), glyph: { id: 'star', tone: 'crystal' } },
          ...(arenaAvailable ? [{ id: 'ship' as const, label: t('baseSwitch.ship'), glyph: { id: 'rocket' as const, tone: 'self' as const } }] : []),
        ]}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}
