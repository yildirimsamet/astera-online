export type Tab = 'planet' | 'galaxy' | 'intel';

const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: 'planet', label: 'Planet', hint: 'Your planet' },
  { id: 'galaxy', label: 'Galaxy', hint: 'Everyone else' },
  { id: 'intel', label: 'Intel', hint: 'What you know' },
];

/**
 * Three screens, thumb height, no menu.
 *
 * Their order is the loop: develop, choose a target, read what you know. A fourth
 * tab would mean the session had stopped being four minutes long.
 */
export function TabBar({ active, onSelect }: { active: Tab; onSelect: (tab: Tab) => void }) {
  return (
    <nav className="grid grid-cols-3 border-t border-line bg-deep pb-[env(safe-area-inset-bottom)]">
      {TABS.map((tab) => {
        const on = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            aria-current={on ? 'page' : undefined}
            aria-label={tab.hint}
            onClick={() => {
              onSelect(tab.id);
            }}
            className={`relative py-3.5 font-display text-[12px] uppercase tracking-[0.16em] transition-colors ${
              on ? 'text-bone' : 'text-faint'
            }`}
          >
            {on && <span className="absolute inset-x-7 top-0 h-px bg-bone" />}
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
