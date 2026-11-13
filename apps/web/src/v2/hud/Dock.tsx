import { useTranslation } from 'react-i18next';
import { BottomNav, DOCK_ART, artIconSrc, type NavItem } from '../../game-ui/index.js';
import { DOCK_TABS, type DockBadges, type DockTab } from '../../lib/dock.js';

const LABEL = {
  galaxy: 'dock.galaxy',
  base: 'dock.base',
  fleet: 'dock.fleet',
  intel: 'dock.intel',
  clan: 'dock.clan',
} as const satisfies Record<DockTab, string>;

export interface DockProps {
  /** The tab whose page is open; null while a page from elsewhere is (the bell, the commander). */
  active: DockTab | null;
  badges: DockBadges;
  /** Every press, the active tab's included: pressing Galaxy again flies home (the host's call). */
  onSelect: (tab: DockTab) => void;
  /**
   * Tabs that keep their place but do nothing — a season with no clan layer. The
   * order never moves, so a thumb that learned it is never wrong.
   */
  disabled?: readonly DockTab[];
  /**
   * Tabs a colony ship has not opened yet, each with what opens it. Unlike `disabled`
   * they still answer a press: the press is how a player learns what opens them, so
   * the bar says it in place, with the refusal's sound.
   */
  locked?: Partial<Record<DockTab, string>>;
  /** Tabs that have just opened: they shine and say "New" until first pressed (owner 2026-11-06). */
  fresh?: readonly DockTab[];
  /**
   * A page is open over the galaxy (a tab's, the fleet, the bell, the timers). Owner,
   * 2026-09-24: the dock lets the galaxy through and backs itself only then.
   */
  over?: boolean;
  /** E11 · K10: on a desk the dock is a tab bar in the top bar, with the key that opens each tab. */
  bar?: boolean;
}

/**
 * THE DOCK. Spec B4 (docs/ui-v2/gozlemevi.md), decision K1; on the game kit since G1-a
 * (2026-11-14).
 *
 * Five labelled places in one order, always — a place with no name is a place a
 * player never finds. Each says what is waiting behind it without being opened:
 * a warning dot on Base (a fault to repair: a gap you can close), a ring on Fleet
 * filling toward your next own landing beside a quiet count of what is up, the
 * unseen reports on Intel and what the clan needs on Clan in the red of news.
 */
export function Dock({ active, badges, onSelect, disabled = [], locked = {}, fresh = [], over = false, bar = false }: DockProps) {
  const { t } = useTranslation();

  const items: NavItem[] = DOCK_TABS.map((tab, index) => {
    const lock = locked[tab];
    const said = lock !== undefined
      ? t('dock.locked')
      : tab === 'base' && badges.base
        ? t('dock.baseWaiting')
        : tab === 'fleet' && badges.fleet.airborne > 0
          ? t('dock.airborne', { count: badges.fleet.airborne })
          : tab === 'intel' && badges.intel > 0
            ? t('dock.reports', { count: badges.intel })
            : tab === 'clan' && badges.clan > 0
              ? t('dock.attention', { count: badges.clan })
              : undefined;
    return {
      id: tab,
      label: t(LABEL[tab]),
      art: artIconSrc(DOCK_ART[tab]),
      shortcut: String(index + 1),
      guide: `dock-${tab}`,
      ...(said === undefined ? {} : { said }),
      ...(lock === undefined ? {} : { locked: lock }),
      ...(disabled.includes(tab) ? { disabled: true } : {}),
      ...(fresh.includes(tab) ? { fresh: t('dock.fresh') } : {}),
      ...(tab === 'base' && badges.base ? { warn: true } : {}),
      ...(tab === 'fleet' ? { tally: badges.fleet.airborne, progress: badges.fleet.progress } : {}),
      ...(tab === 'intel' ? { badge: badges.intel } : {}),
      ...(tab === 'clan' ? { badge: badges.clan } : {}),
    };
  });

  const pick = (id: string): void => {
    const tab = DOCK_TABS.find((each) => each === id);
    if (tab) onSelect(tab);
  };

  return (
    <div data-dock="" className={bar ? 'h-full' : ''}>
      <BottomNav label={t('dock.label')} items={items} value={active} onChange={pick} onReselect={pick} clear={!over} bar={bar} />
    </div>
  );
}
