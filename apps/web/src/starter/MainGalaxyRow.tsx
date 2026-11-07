import { STARTER } from '@astera/rules';
import { useTranslation } from 'react-i18next';
import { Icon } from '../v2/icons.js';

const DAY_MS = 86_400_000;

/** One leg of the way there, with how far along it is. */
function Leg({ label, share, figure, done }: { label: string; share: number; figure: string; done: boolean }) {
  return (
    <li className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="flex items-baseline justify-between gap-1">
        <span className={`truncate text-micro ${done ? 'text-v2-self' : 'text-v2-ink-2'}`}>{label}</span>
        <span className="shrink-0 font-v2-mono text-micro tabular-nums text-v2-ink">{figure}</span>
      </span>
      <span className="block h-1 overflow-hidden rounded-full bg-v2-void">
        <span className="block h-full rounded-full bg-v2-self shadow-[0_0_6px_var(--color-v2-self)]" style={{ width: `${String(Math.round(Math.min(1, share) * 100))}%` }} />
      </span>
    </li>
  );
}

/**
 * THE MAIN GALAXY, TAPPED: WHERE THE JOURNEY REALLY STARTS (owner 2026-11-06: the card read as a
 * season notice; it is the story). Where the fleet was bound, how far the ship is from it, and the
 * only way across: the ship. Its worlds still cannot be picked and nothing can be sent there (K1).
 */
export function MainGalaxyRow({ sky, now, jumpReady, road, onOpenShip, onClose }: {
  sky: { server: string; worlds: number; seasonEndsAt: Date | null };
  now: number;
  jumpReady: boolean;
  /** The repairs done, as a share, and the Deuterium in the jump tank. */
  road: { repair: number; fuel: number };
  onOpenShip: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const days = sky.seasonEndsAt ? Math.max(0, Math.ceil((sky.seasonEndsAt.getTime() - now) / DAY_MS)) : null;
  const need = STARTER.fuelForJump;
  return (
    <div data-testid="main-galaxy-row" role="status" className="pointer-events-auto relative mx-auto flex w-full max-w-[440px] flex-col gap-2 overflow-hidden rounded-plate border border-v2-self/40 bg-v2-panel/95 px-3 py-2.5 font-v2-ui shadow-lg animate-[line-in_0.4s_ease-out_both]">
      <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-12 size-36 animate-[ember_4s_ease-in-out_infinite] rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--color-v2-self)_35%,transparent),transparent)]" />
      <div className="relative flex items-start gap-2.5">
        <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full border border-v2-self/50 bg-v2-void/60 text-v2-self shadow-[0_0_14px_-4px_var(--color-v2-self)]">
          <Icon id="i-galaxy" className="size-5 animate-[spin_40s_linear_infinite]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="v2-legend text-v2-self">{t('starter.mainRow.eyebrow')}</p>
          <p className="text-body font-semibold leading-tight text-v2-ink">{sky.server}</p>
        </div>
        <button type="button" aria-label={t('starter.landing.dismiss')} onClick={onClose} className="-m-1 grid size-9 shrink-0 place-items-center text-v2-ink-2"><Icon id="i-close" className="size-4" /></button>
      </div>
      <p className="relative text-caption leading-snug text-v2-ink">{t('starter.mainRow.story')}</p>
      <ol className="relative flex gap-3">
        <Leg label={t('starter.mainRow.legRepair')} share={road.repair} figure={`${String(Math.round(road.repair * 100))}%`} done={road.repair >= 1} />
        <Leg label={t('starter.mainRow.legFuel')} share={road.fuel / need} figure={`${String(Math.floor(road.fuel))}/${String(need)}`} done={road.fuel >= need} />
      </ol>
      <p className="relative text-micro leading-snug text-v2-ink-3">
        {days === null ? t('starter.mainRow.waiting') : t('starter.mainRow.facts', { worlds: sky.worlds, days })}
        {' '}{t(jumpReady ? 'starter.mainRow.ready' : 'starter.mainRow.repair')}
      </p>
      <button type="button" data-testid="main-galaxy-go" onClick={onOpenShip} className="relative flex min-h-9 items-center justify-center gap-1.5 rounded-control border border-v2-self/60 bg-v2-self/10 text-caption font-semibold text-v2-self">
        {t('starter.mainRow.go')}<Icon id="i-chev" className="size-4" />
      </button>
    </div>
  );
}
