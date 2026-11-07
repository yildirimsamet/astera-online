import { VESSEL_SYSTEMS, type VesselProgress, type VesselSystem } from '@astera/rules';
import { useTranslation } from 'react-i18next';
import { Icon } from '../v2/icons.js';
import { SYSTEM_ART, SYSTEM_ICON, moduleArt, systemOpen, systemPercent } from './shipScreen.js';

/**
 * The five systems as five pictures. A locked one still opens: its card says what it needs. The lock
 * reads the ship as its queue will leave it, as the card does (player test A-04).
 */
export function SystemTabs({ progress, ahead, selected, onSelect }: {
  progress: VesselProgress; ahead: VesselProgress; selected: VesselSystem; onSelect: (system: VesselSystem) => void;
}) {
  const { t } = useTranslation();
  return (
    <div role="tablist" aria-label={t('starter.systemsLabel')} className="grid grid-cols-5 gap-1.5 px-3">
      {VESSEL_SYSTEMS.map(system => {
        const percent = systemPercent(progress, system);
        const open = systemOpen(system, ahead);
        const on = selected === system;
        return (
          <button
            key={system}
            type="button"
            role="tab"
            data-guide={`system-${system}`}
            aria-selected={on}
            aria-label={`${t(`starter.system.${system}`)}, ${String(percent)}%${open ? '' : `, ${t('starter.locked')}`}`}
            onClick={() => { onSelect(system); }}
            className={`relative h-[74px] overflow-hidden rounded-control border bg-v2-void text-center ${on ? 'border-v2-self shadow-[0_0_12px_-1px_var(--color-v2-self)]' : 'border-v2-line'}`}
          >
            <img src={moduleArt(SYSTEM_ART[system], 1)} alt="" draggable={false}
              className={`absolute inset-0 size-full object-cover ${open ? '' : 'opacity-60 saturate-[.6]'}`} />
            <span aria-hidden="true" className="absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-v2-void/90 to-transparent" />
            <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-v2-void to-transparent" />
            <span className="absolute left-1 top-1 flex items-center gap-1">
              <span aria-hidden="true" className="grid size-3.5 place-items-center rounded-full"
                style={{ background: `conic-gradient(var(--color-v2-self) ${String(percent)}%, rgba(255,255,255,.28) 0)` }}>
                <span className="size-2.5 rounded-full bg-v2-void" />
              </span>
              <span className={`font-v2-mono text-micro leading-none ${percent > 0 ? 'text-v2-self' : 'text-v2-ink-2'}`}>{percent}%</span>
            </span>
            {!open && <span className="absolute bottom-4 right-1 flex items-center gap-0.5 text-v2-ink"><Icon id="i-lock" className="size-3"/><Icon id={SYSTEM_ICON[system]} className="size-3"/></span>}
            <span className={`absolute inset-x-0 bottom-1 truncate px-0.5 text-micro font-medium ${on ? 'text-v2-ink' : 'text-v2-ink-2'}`}>
              {t(`starter.systemShort.${system}`)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
