import type { Resources } from '@astera/rules';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useClanWarActions } from '../api/queries.js';
import type { ClanWar, PlanetView } from '../api/schemas.js';
import { describeError } from '../i18n/errors.js';
import { full } from '../lib/format.js';
import { RESOURCE_ART } from '../ui/assets.js';
import { SpendBar } from '../ui/SpendBar.js';
import { Choices, GameHold, Glyph, Slider } from '../game-ui/index.js';
import { Sheet } from '../v2/kit/Sheet.js';

const KEYS = ['alloy', 'crystal', 'deuterium'] as const;
const ZERO: Resources = { alloy: 0, crystal: 0, deuterium: 0 };

/**
 * A GIFT TO THE SHARED TREASURY. It used to be a dropdown of worlds and three number
 * boxes under the war room — browser form controls the spec keeps out of the game. Now a
 * small page: the world on the kit's choices, each resource on the aid page's row — what the
 * world holds and what the gift takes out of it, the kit's slider stopping at the stock or at
 * what the treasury still needs (the lower) — and the gift on the kit's final hold, because a
 * gift is not called back (G7-h). Choosing another world starts the gift again: its stock is another.
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
  /*
    WHAT IS SENT IS WHAT THE SLIDERS SHOW (review, 2026-09-25). The room shrinks while the sheet
    is open — a clanmate's gift — and each slider draws its figure within it; the press sends
    those figures, never an older, larger one the server would refuse.
  */
  const shown: Resources = { alloy: Math.min(gift.alloy, limit('alloy')), crystal: Math.min(gift.crystal, limit('crystal')), deuterium: Math.min(gift.deuterium, limit('deuterium')) };
  const empty = KEYS.every((key) => shown[key] === 0);

  return (
    <Sheet
      kit={{ tone: 'self' }}
      eyebrow={t('clanWar.treasury')}
      title={t('clanWar.donate')}
      detents={['fit']}
      onClose={onClose}
      footer={(
        <div data-donate-commit="" className="gk gk-launch__commit">
          <GameHold
            weight="final"
            glyph="crate"
            label={t('clanWar.donate')}
            disabledReason={!donor ? t('clanWar.noOrigin') : empty ? t('clanWar.donatePick') : actions.donate.isPending ? t('clanWar.donate') : null}
            onCommit={() => {
              if (!donor) return;
              actions.donate.mutate({ planetId: donor.planet.id, resources: shown }, {
                onSuccess: () => { setGift({ ...ZERO }); onClose(); },
              });
            }}
          />
          {actions.donate.isError && <p role="alert" className="gk-inote" data-tone="warn"><Glyph id="warn" />{describeError(actions.donate.error)}</p>}
        </div>
      )}
    >
      <div className="gk-clan__parts gk-donate">
        {worlds.length > 1 && (
          <Choices
            label={t('clanWar.selectWorld')}
            value={donor?.planet.id ?? ''}
            options={worlds.map((world) => ({ id: world.planet.id, label: world.planet.name }))}
            onChange={(id) => { setDonorId(id); setGift({ ...ZERO }); }}
          />
        )}
        <div className="gk-clan__part">
          {KEYS.map((key) => {
            const top = limit(key);
            const stock = Math.max(0, Math.floor(donor?.planet[key] ?? 0));
            return (
              <div key={key} data-donate-row={key} className="gk-well gk-cargo__row">
                <span className="gk-cargo__head">
                  <img src={RESOURCE_ART[key]} alt="" aria-hidden />
                  <span className="gk-label">{t(`clan.resources.${key}`)}</span>
                  <span className="gk-sub gk-num gk-donate__need">{t('clanWar.donateNeed', { amount: full(war.room?.[key] ?? 0) })}</span>
                </span>
                <SpendBar inline stock={stock} spend={shown[key]} tone={key} label={t('clanWar.donate')} />
                <Slider label={t(`clan.resources.${key}`)} value={shown[key]} max={top}
                  onChange={(next) => { setGift((current) => ({ ...current, [key]: next })); }} />
              </div>
            );
          })}
        </div>
        <p className="gk-sub">{t('clanWar.donateHint')}</p>
      </div>
    </Sheet>
  );
}
