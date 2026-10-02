import { fleetCount, fleetEntries } from '@astera/rules';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useClanSupportActions, useSetDefencePosture } from '../api/queries.js';
import type { ClanSupportWave, PlanetView } from '../api/schemas.js';
import { describeError } from '../i18n/errors.js';
import { hullName } from '../i18n/names.js';
import { compact } from '../lib/format.js';
import { factorLabel, hostFactor } from '../lib/supportFactor.js';
import { countdown, useNow } from '../lib/time.js';
import { Toggle } from '../v2/kit/Toggle.js';

/**
 * KLAN SAVUNMA DESTEĞİ ON THE HANGAR PAGE (`docs/clan-defense-support-plan.md`, K1 · K4).
 *
 * Two pieces under the Hangar's own room, because the bay IS the Hangar's: the posture
 * card (the retreat or clan support, never both, saved together) and the bay itself —
 * who stands here, who is flying in, and the room it holds, which is this world's own
 * Hangar room. Each answers the four questions where it is read: what the toggle does
 * is the sentence under it, what a wave costs to send back is said before the tap.
 */

interface Toggles { escape: boolean; support: boolean }

/** A season dealt before the rule has no posture, and draws (and asks the server) nothing. */
export function DefencePostureCard({ planet }: { planet: PlanetView }) {
  const posture = planet.defencePosture ?? null;
  return posture ? <PostureCard planet={planet} posture={posture} /> : null;
}

function PostureCard({ planet, posture }: {
  planet: PlanetView;
  posture: NonNullable<PlanetView['defencePosture']>;
}) {
  const { t } = useTranslation();
  const save = useSetDefencePosture();
  const [draft, setDraft] = useState<Toggles>({ escape: posture.escape, support: posture.support });
  const [confirming, setConfirming] = useState(false);
  const current = posture.posture;
  useEffect(() => {
    setDraft({ escape: posture.escape, support: posture.support });
    setConfirming(false);
    // The stored posture is the reset trigger: a save, or another tab's change, lands as a new one.
  }, [current]);

  const locked = posture.supportLocked !== null;
  const dirty = draft.escape !== posture.escape || draft.support !== posture.support;
  const leaving = posture.support && !draft.support ? (planet.clanSupport?.waves.length ?? 0) : 0;

  const commit = (): void => {
    save.mutate({ planetId: planet.planet.id, ...draft }, { onSuccess: () => { setConfirming(false); } });
  };

  return (
    <section data-defence-posture="" className="flex flex-col gap-2 rounded-control border border-v2-line bg-v2-deep/60 px-3 py-2.5">
      <p className="flex items-center justify-between gap-2">
        <span className="text-micro font-semibold uppercase tracking-wide text-v2-ink-3">{t('clanSupport.postureTitle')}</span>
        <span className="text-micro text-v2-ink-3">{t('clanSupport.exclusive')}</span>
      </p>
      <div className="flex flex-col gap-1">
        <Toggle tone="self" checked={draft.escape}
          onChange={(on) => { setDraft((was) => ({ escape: on, support: on ? false : was.support })); setConfirming(false); }}>
          <span className="block font-semibold">{t('clanSupport.escapeLabel')}</span>
          <span className="block text-micro text-v2-ink-2">{t('clanSupport.escapeOn')}</span>
        </Toggle>
        <Toggle tone="self" checked={draft.support} disabled={locked}
          onChange={(on) => { setDraft((was) => ({ support: on, escape: on ? false : was.escape })); setConfirming(false); }}>
          <span className="block font-semibold">{t('clanSupport.supportLabel')}</span>
          <span className="block text-micro text-v2-ink-2">
            {locked ? t('clanSupport.supportLocked') : t('clanSupport.supportOn')}
          </span>
        </Toggle>
      </div>
      {!draft.escape && !draft.support && (
        <p className="px-1 text-micro text-v2-warn">{t('clanSupport.holdBoth')}</p>
      )}
      {confirming ? (
        <div className="flex flex-col gap-1.5 rounded-control border border-v2-warn/40 bg-v2-warn/5 px-2.5 py-2">
          <p className="text-caption text-v2-warn">{t('clanSupport.confirmClose', { count: leaving })}</p>
          <div className="grid grid-cols-2 gap-1.5">
            <button type="button" onClick={() => { setConfirming(false); }}
              className="min-h-9 rounded-control border border-v2-line px-2 text-caption text-v2-ink">
              {t('clanSupport.keep')}
            </button>
            <button type="button" onClick={commit} disabled={save.isPending}
              className="min-h-9 rounded-control bg-v2-warn px-2 text-caption font-semibold text-v2-deep disabled:opacity-60">
              {t('clanSupport.confirm')}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end">
          <button type="button" disabled={!dirty || save.isPending}
            onClick={() => { if (leaving > 0) setConfirming(true); else commit(); }}
            className="min-h-8 min-w-24 rounded-control bg-v2-self px-4 text-caption font-semibold text-v2-self-ink disabled:bg-v2-raise disabled:text-v2-ink-3">
            {save.isPending ? t('clanSupport.saving') : t('clanSupport.save')}
          </button>
        </div>
      )}
      {save.isError && <p role="alert" className="text-caption text-v2-warn">{describeError(save.error)}</p>}
    </section>
  );
}

/** How many wave rows show before the list folds (owner: cut, tighten). */
const FOLD_AFTER = 3;

export function ClanSupportBay({ planet }: { planet: PlanetView }) {
  const { t } = useTranslation();
  const bay = planet.clanSupport ?? null;
  const [open, setOpen] = useState(false);
  const now = useNow();
  if (!bay) return null;
  const supporting = planet.defencePosture?.posture === 'SUPPORT';
  if (!supporting && bay.waves.length === 0) {
    // Outside a clan the switch is locked and the card above says why; "turn it on" would be a dead end.
    if (planet.defencePosture?.supportLocked != null) return null;
    return (
      <p data-support-bay="closed" className="px-1 text-micro leading-snug text-v2-ink-3">
        {t('clanSupport.closedEmpty')}
      </p>
    );
  }
  const taken = bay.room.used + bay.room.reserved;
  const scale = Math.max(bay.room.total, taken, 1);
  const share = (value: number): string => `${String(Math.round((value / scale) * 1000) / 10)}%`;
  const shown = open ? bay.waves : bay.waves.slice(0, FOLD_AFTER);
  const factor = hostFactor(planet, now);

  return (
    <section data-support-bay="" className="flex flex-col gap-1.5 rounded-control border border-v2-line bg-v2-deep/60 px-3 py-2.5">
      <p className="flex items-center justify-between gap-2">
        <span className="text-micro font-semibold uppercase tracking-wide text-v2-ink-3">{t('clanSupport.bayTitle')}</span>
        <span className="font-v2-mono text-caption tabular-nums text-v2-ink">
          {compact(taken)}<span className="text-v2-ink-3"> / {compact(bay.room.total)}</span>
        </span>
      </p>
      <span role="img" aria-label={t('clanSupport.bayReading', { used: compact(taken), total: compact(bay.room.total) })}
        className="flex h-2 w-full overflow-hidden rounded-full bg-v2-line">
        {bay.room.used > 0 && <span data-part="standing" className="h-full bg-v2-self" style={{ width: share(bay.room.used) }} />}
        {bay.room.reserved > 0 && <span data-part="inbound" className="h-full bg-v2-self/40" style={{ width: share(bay.room.reserved) }} />}
      </span>
      <p className="flex gap-3 text-micro text-v2-ink-3">
        <span className="flex items-center gap-1"><span aria-hidden="true" className="size-2 rounded-full bg-v2-self" />{t('clanSupport.bayLegendStanding')}</span>
        <span className="flex items-center gap-1"><span aria-hidden="true" className="size-2 rounded-full bg-v2-self/40" />{t('clanSupport.bayLegendInbound')}</span>
      </p>
      <p className="text-micro leading-snug text-v2-ink-2">{t('clanSupport.bayHint')}</p>
      {/* The stakes the host accepted: the factor the standing support puts on its Dominion. */}
      <p data-support-factor="" className="text-micro leading-snug">
        <span className="font-v2-mono font-semibold text-v2-ink">
          {factor === 1
            ? t('clanSupport.bayFactorNone')
            : t('clanSupport.bayFactor', { factor: factorLabel(factor) })}
        </span>
        <span className="block text-v2-ink-3">{t('clanSupport.bayFactorRule')}</span>
      </p>
      {bay.waves.length === 0 ? (
        <p className="text-caption text-v2-ink-2">{t('clanSupport.empty')}</p>
      ) : (
        <ul className="flex flex-col">
          {shown.map((wave) => <WaveRow key={wave.id} wave={wave} />)}
        </ul>
      )}
      {!open && bay.waves.length > FOLD_AFTER && (
        <button type="button" onClick={() => { setOpen(true); }} className="self-start text-micro font-semibold text-v2-self">
          {t('clanSupport.more', { count: bay.waves.length - FOLD_AFTER })}
        </button>
      )}
      <p className="text-micro leading-snug text-v2-ink-3">{t('clanSupport.ruleLine')}</p>
    </section>
  );
}

function WaveRow({ wave }: { wave: ClanSupportWave }) {
  const { t } = useTranslation();
  const now = useNow();
  const actions = useClanSupportActions();
  const [asking, setAsking] = useState(false);
  const inbound = wave.status === 'OUTBOUND';
  const when = inbound
    ? t('clanSupport.arriving', { time: countdown(wave.arriveAt.getTime() - now) })
    : wave.expiresAt ? t('clanSupport.leftFor', { time: countdown(wave.expiresAt.getTime() - now) }) : '';
  const landing = inbound && wave.arriveAt.getTime() <= now;
  return (
    <li data-support-wave={wave.id} className="flex flex-col gap-1 border-b border-v2-line/70 py-2 last:border-b-0">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-caption font-semibold text-v2-ink">
            <span className="truncate">{wave.sender.name}</span>
            {wave.damaged && (
              <span className="rounded-chip border border-v2-warn/50 px-1 text-micro font-normal text-v2-warn">{t('clanSupport.damaged')}</span>
            )}
          </span>
          <span className="block truncate text-micro text-v2-ink-2">
            {fleetEntries(wave.fleet).map(([hull, n]) => `${String(n)} ${hullName(hull)}`).join(' · ')}
          </span>
          <span className="block font-v2-mono text-micro text-v2-ink-3">
            {t('clanSupport.waveMeta', { ships: fleetCount(wave.fleet), bulk: compact(wave.bulk) })}
            {when && <> · {when}</>}
          </span>
        </span>
        {!asking && !landing && (
          <button type="button" onClick={() => { setAsking(true); }}
            aria-label={t('clanSupport.sendBackOf', { name: wave.sender.name })}
            className="min-h-8 shrink-0 rounded-control border border-v2-line px-2 text-micro text-v2-ink">
            {t('clanSupport.sendBack')}
          </button>
        )}
      </div>
      {wave.outOfBand && <p className="text-micro text-v2-warn">{t('clanSupport.outOfBand')}</p>}
      {asking && (
        <div className="flex items-center gap-2 rounded-control border border-v2-line bg-v2-deep px-2 py-1.5">
          <p className="min-w-0 flex-1 text-micro text-v2-ink-2">{t('clanSupport.sendBackConfirm')}</p>
          <button type="button" onClick={() => { setAsking(false); }} className="text-micro text-v2-ink-3">{t('clanSupport.cancel')}</button>
          <button type="button" disabled={actions.sendBack.isPending}
            onClick={() => { actions.sendBack.mutate(wave.id, { onSuccess: () => { setAsking(false); } }); }}
            className="min-h-8 rounded-control bg-v2-warn px-2 text-micro font-semibold text-v2-deep">
            {t('clanSupport.sendBack')}
          </button>
        </div>
      )}
      {actions.sendBack.isError && <p role="alert" className="text-micro text-v2-warn">{describeError(actions.sendBack.error)}</p>}
    </li>
  );
}
