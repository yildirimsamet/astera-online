import { useTranslation } from 'react-i18next';
import { DOCK_TABS, type DockBadges, type DockTab } from '../../lib/dock.js';
import { Icon, type IconId } from '../icons.js';

const ICON: Record<DockTab, IconId> = {
  galaxy: 'i-galaxy',
  base: 'i-base',
  fleet: 'i-fleet',
  intel: 'i-intel',
  clan: 'i-clan',
};

const LABEL = {
  galaxy: 'dock.galaxy',
  base: 'dock.base',
  fleet: 'dock.fleet',
  intel: 'dock.intel',
  clan: 'dock.clan',
} as const satisfies Record<DockTab, string>;

/** A count on a tab: exact to nine, then "9+" — past that the number is not the decision. */
const shown = (count: number): string => (count > 9 ? '9+' : String(count));

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
   * A page is open over the galaxy (a tab's, the fleet, the bell, the timers). Owner,
   * 2026-09-24: the dock is fully see-through over the galaxy and backs itself only
   * then, so the tabs still read over a page's own content.
   */
  over?: boolean;
  /**
   * E11 · K10: on a desk the dock is a tab bar in the top bar — the icon beside the
   * name, and the key that opens it (1–5, `shortcutOf`).
   */
  bar?: boolean;
}

/**
 * THE DOCK. Spec B4 (docs/ui-v2/gozlemevi.md), decision K1.
 *
 * Five labelled tabs in one order, always — a place with no name is a place a
 * player never finds. Each says what is waiting behind it without being opened:
 * a warn dot on Base (something to collect or repair: a gap you can close), a
 * ring on Fleet filling toward your next own landing beside how many are up, the
 * unseen reports on Intel, what the clan needs on Clan.
 */
export function Dock({ active, badges, onSelect, disabled = [], over = false, bar = false }: DockProps) {
  const { t } = useTranslation();

  return (
    <nav
      aria-label={t('dock.label')}
      {...(bar ? { 'data-bar': '' } : {})}
      className={`flex font-v2-ui ${
        bar
          ? 'h-full items-stretch'
          : over
            ? 'border-t border-v2-line/70 bg-gradient-to-t from-v2-deep/95 to-v2-deep/60 pb-[env(safe-area-inset-bottom)]'
            : 'pb-[env(safe-area-inset-bottom)] [text-shadow:0_1px_3px_var(--color-v2-void)]'
      }`}
    >
      {DOCK_TABS.map((tab, index) => {
        const label = t(LABEL[tab]);
        const on = tab === active;
        const said = tab === 'base' && badges.base
          ? t('dock.baseWaiting')
          : tab === 'fleet' && badges.fleet.airborne > 0
            ? t('dock.airborne', { count: badges.fleet.airborne })
            : tab === 'intel' && badges.intel > 0
              ? t('dock.reports', { count: badges.intel })
              : tab === 'clan' && badges.clan > 0
                ? t('dock.attention', { count: badges.clan })
                : null;
        const count = tab === 'fleet' ? badges.fleet.airborne : tab === 'intel' ? badges.intel : tab === 'clan' ? badges.clan : 0;
        const progress = tab === 'fleet' ? badges.fleet.progress : null;

        return (
          <button
            key={tab}
            type="button"
            aria-label={said === null ? label : `${label} · ${said}`}
            aria-keyshortcuts={String(index + 1)}
            {...(on ? { 'aria-current': 'page' as const } : {})}
            disabled={disabled.includes(tab)}
            onClick={() => { onSelect(tab); }}
            className={`relative flex min-w-0 disabled:opacity-35 ${
              bar
                ? 'items-center gap-1.5 px-2.5 hover:text-v2-ink'
                : 'h-16 flex-1 flex-col items-center justify-center gap-1'
            } ${on ? 'text-v2-ink' : 'text-v2-ink-3'}`}
          >
            {on && (
              <span
                aria-hidden="true"
                className={`absolute h-0.5 bg-v2-self ${bar ? 'inset-x-2.5 bottom-0 rounded-t-full' : 'inset-x-4 top-0 rounded-b-full'}`}
              />
            )}
            <span className="relative grid size-8 place-items-center">
              {progress !== null && (
                <span
                  data-ring=""
                  data-progress={String(Math.round(progress * 100) / 100)}
                  aria-hidden="true"
                  className="absolute inset-0 rounded-full"
                  style={{ background: `conic-gradient(var(--color-v2-self) ${String(progress)}turn, var(--color-v2-line) 0)` }}
                >
                  <span className="absolute inset-0.5 rounded-full bg-v2-deep" />
                </span>
              )}
              <Icon id={ICON[tab]} className="relative size-5.25" />
              {tab === 'base' && badges.base && (
                <span data-badge="" aria-hidden="true" className="absolute right-0.5 top-0.5 size-2 rounded-full bg-v2-warn ring-2 ring-v2-deep" />
              )}
              {count > 0 && (
                <span
                  data-badge=""
                  aria-hidden="true"
                  className={`absolute -right-2 -top-1 min-w-4 rounded-full px-1 text-center font-v2-mono text-micro leading-4 ${
                    tab === 'clan' ? 'bg-v2-ally text-v2-void' : tab === 'intel' ? 'bg-v2-self text-v2-self-ink' : 'bg-v2-raise text-v2-ink'
                  }`}
                >
                  {shown(count)}
                </span>
              )}
            </span>
            <span className="max-w-full truncate px-0.5 text-caption font-stretch-semi-condensed">{label}</span>
            {bar && (
              <kbd className="rounded-cell border border-v2-line-hi px-1 font-v2-mono text-micro leading-4 text-v2-ink-3">
                {index + 1}
              </kbd>
            )}
          </button>
        );
      })}
    </nav>
  );
}
