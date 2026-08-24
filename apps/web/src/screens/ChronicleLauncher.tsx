import { useTranslation } from 'react-i18next';
import { useChronicle } from '../api/queries.js';
import { haptic } from '../lib/haptics.js';
import { GalaxyIcon } from '../ui/icons/index.js';

export function ChronicleLauncher({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation();
  const latest = useChronicle().data?.pages[0]?.events[0];
  let line = t('chronicle.launcherQuiet');
  if (latest) {
    switch (latest.kind) {
      case 'bombardment':
        line = t('chronicle.launcherBombardment', { planet: latest.payload.planetName });
        break;
      case 'core_tier':
        line = t('chronicle.launcherCoreTier', {
          planet: latest.payload.planetName,
          tier: latest.payload.tier,
        });
        break;
      case 'isotope_exhausted':
        line = t('chronicle.launcherIsotope');
        break;
      case 'wreck_formed':
        line = t('chronicle.launcherWreck', { planet: latest.payload.planetName });
        break;
      case 'wreck_exhausted':
        line = t('chronicle.launcherWreckGone', { planet: latest.payload.planetName });
        break;
      case 'dominion_leader':
        line = t('chronicle.launcherLeader', { commander: latest.payload.commanderName });
        break;
      case 'season_act':
        line = t(`chronicle.act.${latest.payload.act}.launcher`);
        break;
      case 'neutral_claim':
        line = t('chronicle.launcherNeutralClaim', { planet: latest.payload.planetName });
        break;
      case 'death_star_impact':
        line = t('chronicle.launcherDeathStar', { planet: latest.payload.planetName });
        break;
      case 'control_transfer':
        line = t('chronicle.launcherControl', { planet: latest.payload.planetName });
        break;
    }
  }
  return (
    <button
      type="button"
      aria-label={t('chronicle.launcher')}
      onClick={() => {
        haptic('tap');
        onOpen();
      }}
      className="pointer-events-auto absolute bottom-3 right-16 z-20 flex h-11 max-w-[min(14rem,calc(100vw-8rem))] items-center gap-2 rounded-md border border-line bg-deep/95 px-3 text-opportunity shadow-[0_10px_30px_rgba(0,0,0,0.4)] transition-colors hover:border-opportunity/60 hover:text-bone active:scale-95"
    >
      <GalaxyIcon className="size-5 shrink-0" />
      <span className="truncate font-display text-[10px] font-bold uppercase tracking-wide">{line}</span>
    </button>
  );
}
