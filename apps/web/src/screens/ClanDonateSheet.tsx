import type { Resources } from '@astera/rules';
import { useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { useClanWarActions } from '../api/queries.js';
import type { ClanWar, PlanetView } from '../api/schemas.js';
import { describeError } from '../i18n/errors.js';
import { full } from '../lib/format.js';
import { RESOURCE_ART } from '../ui/assets.js';
import { ChoiceChips } from '../v2/kit/ChoiceChips.js';
import { Sheet } from '../v2/kit/Sheet.js';

const KEYS = ['alloy', 'crystal', 'deuterium'] as const;
const ZERO: Resources = { alloy: 0, crystal: 0, deuterium: 0 };
const TONE = { alloy: 'text-v2-alloy', crystal: 'text-v2-crystal', deuterium: 'text-v2-deut' } as const;

/**
 * A GIFT TO THE SHARED TREASURY. It used to be a dropdown of worlds and three number
 * boxes under the war room — browser form controls the spec keeps out of the game. Now a
 * small page: the world as a chip, each resource as a slider in its own colour that stops
 * at what the world holds or what the treasury still needs (the lower), the figure beside
 * it, and one Donate. Choosing another world starts the gift again: its stock is another.
 */
export function ClanDonateSheet({ war, worlds, onClose }: {
  war: ClanWar;
  worlds: readonly PlanetView[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const actions = useClanWarActions();
  const [donorId, setDonorId] = useState(worlds[0]?.planet.id ?? '');
  const [gift, setGift] = useState<Resources>({ ...ZERO });
  const donor = worlds.find((world) => world.planet.id === donorId) ?? worlds[0];
  const limit = (key: (typeof KEYS)[number]): number =>
    Math.min(war.room?.[key] ?? 0, Math.max(0, Math.floor(donor?.planet[key] ?? 0)));
  const empty = KEYS.every((key) => gift[key] === 0);

  return (
    <Sheet
      eyebrow={t('clanWar.treasury')}
      title={t('clanWar.donate')}
      detents={['fit']}
      onClose={onClose}
      footer={(
        <div className="grid gap-1.5">
          <button
            type="button"
            disabled={!donor || empty || actions.donate.isPending}
            onClick={() => {
              if (!donor) return;
              actions.donate.mutate({ planetId: donor.planet.id, resources: gift }, {
                onSuccess: () => { setGift({ ...ZERO }); onClose(); },
              });
            }}
            className="min-h-10 rounded-control bg-v2-self px-3 text-caption font-semibold text-v2-self-ink disabled:opacity-40"
          >
            {t('clanWar.donate')}
          </button>
          {actions.donate.isError && <p role="alert" className="text-caption text-v2-warn">{describeError(actions.donate.error)}</p>}
        </div>
      )}
    >
      <div className="flex flex-col gap-3 pt-1">
        {worlds.length > 1 && (
          <ChoiceChips
            label={t('clanWar.selectWorld')}
            value={donor?.planet.id ?? ''}
            options={worlds.map((world) => ({ id: world.planet.id, label: world.planet.name }))}
            onChange={(id) => { setDonorId(id); setGift({ ...ZERO }); }}
          />
        )}
        {KEYS.map((key) => {
          const top = limit(key);
          const value = Math.min(gift[key], top);
          const fill = top > 0 ? Math.round((value / top) * 100) : 0;
          return (
            <label key={key} className="flex flex-col gap-1">
              <span className="flex items-baseline gap-2 text-caption">
                <img src={RESOURCE_ART[key]} alt="" aria-hidden className="size-3.5 self-center object-contain" />
                <span className="text-v2-ink-2">{t(`clan.resources.${key}`)}</span>
                <span className={`ml-auto font-v2-mono font-semibold ${TONE[key]}`}>{full(value)}</span>
                <span className="font-v2-mono text-micro text-v2-ink-3">/ {full(top)}</span>
              </span>
              <input
                type="range"
                min={0}
                max={top}
                step={Math.max(1, Math.round(top / 100))}
                value={value}
                disabled={top === 0}
                aria-label={t(`clan.resources.${key}`)}
                onChange={(event) => {
                  const next = Math.max(0, Math.min(top, Math.floor(event.currentTarget.valueAsNumber || 0)));
                  setGift((current) => ({ ...current, [key]: next }));
                }}
                style={{ '--slider-fill': `${String(fill)}%` } as CSSProperties}
                className={`slider slider-${key} w-full disabled:opacity-40`}
              />
            </label>
          );
        })}
        <p className="text-micro leading-snug text-v2-ink-3">{t('clanWar.donateHint')}</p>
      </div>
    </Sheet>
  );
}
