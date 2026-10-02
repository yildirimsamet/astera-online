import { HULLS, MOBILE_HULLS, NON_COMBATANT_HULLS, fleetCount, type Fleet, type HullId } from '@astera/rules';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../api/client.js';
import { useClanSupportActions } from '../api/queries.js';
import type { PlanetView } from '../api/schemas.js';
import { describeError } from '../i18n/errors.js';
import { hullName } from '../i18n/names.js';
import { full } from '../lib/format.js';
import { countdown, useNow } from '../lib/time.js';
import { HULL_ART } from '../ui/assets.js';
import { HullMark } from '../ui/icons/hulls.js';
import { QuantityStepper } from '../ui/QuantityStepper.js';
import { ChoiceChips } from '../v2/kit/ChoiceChips.js';
import { ClassEmblem } from '../v2/kit/ClassEmblem.js';
import { Figure, Figures } from '../v2/kit/Figure.js';
import { HoldButton } from '../v2/kit/HoldButton.js';
import { Sheet } from '../v2/kit/Sheet.js';

/** How long the picked fleet sits still before its quote is asked for. */
const QUOTE_SETTLE_MS = 350;

export interface SupportHost {
  planetId: string;
  planetName: string;
  ownerName: string;
}

/**
 * SEND CLAN SUPPORT, FROM A CLANMATE'S WORLD (`docs/clan-defense-support-plan.md`, K1–K8).
 *
 * The launch page every fleet leaves by — the world as a chip, the ships as rows, the
 * flight in figures — with the rules that bind THIS flight stated before the hold, not
 * after it: what it burns and that none comes back, when it lands and when it must
 * leave, the host's room after it, the tier band, that the host stops retreating, and
 * what share of the ladder the sender carries. The first refusal is the button's face.
 */
export function ClanSupportSheet({ host, worlds, onClose, onSent }: {
  host: SupportHost;
  worlds: readonly PlanetView[];
  onClose: () => void;
  onSent: (world: string) => void;
}) {
  const { t } = useTranslation();
  const actions = useClanSupportActions();
  const now = useNow();
  const [originId, setOriginId] = useState(worlds[0]?.planet.id ?? '');
  const [fleet, setFleet] = useState<Fleet>({});
  const [quotedKey, setQuotedKey] = useState<string | null>(null);
  const origin = worlds.find((world) => world.planet.id === originId) ?? worlds[0];
  const quoteKey = `${origin?.planet.id ?? ''}:${JSON.stringify(fleet)}`;
  const quote = quotedKey === quoteKey ? actions.quote.data : undefined;
  const picked = fleetCount(fleet);

  const setCount = (hull: HullId, value: number): void => {
    const next = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
    setFleet((current) => ({ ...current, [hull]: next }));
    setQuotedKey(null);
  };

  const requestQuote = actions.quote.mutate;
  const originPlanetId = origin?.planet.id ?? null;
  useEffect(() => {
    if (originPlanetId === null || fleetCount(fleet) === 0) return;
    const asked = `${originPlanetId}:${JSON.stringify(fleet)}`;
    const timer = setTimeout(() => {
      requestQuote({ originPlanetId, hostPlanetId: host.planetId, fleet }, { onSuccess: () => { setQuotedKey(asked); } });
    }, QUOTE_SETTLE_MS);
    return () => { clearTimeout(timer); };
  }, [requestQuote, originPlanetId, host.planetId, fleet]);

  const firstRefusal = quote?.refusals[0];
  const refusal = !origin ? t('clanSupport.noOrigin')
    : picked === 0 ? t('clanSupport.noFleet')
      : actions.send.isPending ? t('clanSupport.sending')
        : quote === undefined ? (actions.quote.isError ? describeError(actions.quote.error) : t('clanSupport.quoting'))
          : firstRefusal ? describeError(new ApiError(firstRefusal.code, firstRefusal.message, 409, firstRefusal.params))
            : null;

  // A support wave is a fighting line: the mining craft never go (CLAN_SUPPORT_NONCOMBATANT).
  const hulls = MOBILE_HULLS.filter((hull) => (origin?.fleet[hull] ?? 0) > 0 && !NON_COMBATANT_HULLS.includes(hull));

  return (
    <Sheet
      eyebrow={t('clanSupport.sheetEyebrow', { world: host.planetName })}
      title={`${host.ownerName} · ${host.planetName}`}
      detents={['fit']}
      placement="page"
      onClose={onClose}
      footer={(
        <div data-support-commit="" className="grid gap-1.5">
          {quote && <p className="text-micro leading-snug text-v2-ink-3">{t('clanSupport.recallRule')}</p>}
          <HoldButton
            label={t('clanSupport.holdSend', { count: picked })}
            disabledReason={refusal}
            onCommit={() => {
              if (!origin) return;
              actions.send.mutate(
                { originPlanetId: origin.planet.id, hostPlanetId: host.planetId, fleet },
                { onSuccess: () => { setFleet({}); setQuotedKey(null); onSent(host.planetName); } },
              );
            }}
          />
          {actions.send.isError && (
            <p role="alert" className="text-caption text-v2-warn">{describeError(actions.send.error)}</p>
          )}
        </div>
      )}
    >
      <div className="flex flex-col gap-3 pt-1">
        <p className="text-caption leading-snug text-v2-ink-2">{t('clanSupport.sendActionHint')}</p>
        {worlds.length > 1 && (
          <ChoiceChips
            label={t('clanWar.origin')}
            value={origin?.planet.id ?? ''}
            options={worlds.map((world) => ({
              id: world.planet.id,
              label: world.planet.name,
              detail: t('clanWar.shipsHome', { count: fleetCount(world.fleet) }),
            }))}
            onChange={(id) => { setOriginId(id); setFleet({}); setQuotedKey(null); }}
          />
        )}

        {hulls.length === 0 ? (
          <p className="text-caption text-v2-ink-2">{t('clanSupport.noShips')}</p>
        ) : (
          <div>
            {hulls.map((hull) => {
              const held = origin?.fleet[hull] ?? 0;
              const art = HULL_ART[hull];
              return (
                <div key={hull} data-hull-row={hull}
                  className={`flex items-center gap-2 border-b border-v2-line/70 px-1 py-2 last:border-b-0 ${
                    (fleet[hull] ?? 0) > 0 ? 'bg-v2-self/5' : ''}`}>
                  <span data-art className="grid size-9 shrink-0 place-items-center">
                    {art ? <img src={art} alt="" aria-hidden className="size-9 object-contain" loading="lazy" />
                      : <HullMark hull={hull} className="size-6 text-v2-ink-3" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 text-caption font-semibold text-v2-ink">
                      <span className="truncate">{hullName(hull)}</span>
                      <ClassEmblem cls={HULLS[hull].cls} className="size-2.5 shrink-0 text-v2-ink-2" />
                    </span>
                    <span className="block font-v2-mono text-micro text-v2-ink-3">{t('launch.atHome', { count: held })}</span>
                  </span>
                  <QuantityStepper
                    look="v2"
                    value={fleet[hull] ?? 0}
                    min={0}
                    max={held}
                    onChange={(value) => { setCount(hull, value); }}
                    decreaseLabel={t('launch.fewer', { name: hullName(hull) })}
                    increaseLabel={t('launch.more', { name: hullName(hull) })}
                    valueLabel={t('launch.quantity', { name: hullName(hull) })}
                    maxLabel={t('launch.max', { name: hullName(hull) })}
                    maxText={t('launch.maxShort')}
                  />
                </div>
              );
            })}
          </div>
        )}

        {quote && (
          <>
            <Figures data-support-figures="">
              <Figure label={t('clanSupport.figFuel')} value={full(quote.fuel)} sub={t('clanSupport.figFuelSub')} />
              <Figure label={t('clanSupport.figArrive')} value={countdown(quote.arriveAt.getTime() - now)} sub={host.planetName} />
              <Figure label={t('clanSupport.figRoom')}
                value={`${full(quote.hostRoom.after)}/${full(quote.hostRoom.total)}`} sub={t('clanSupport.figRoomSub')}
                {...(quote.hostRoom.after > quote.hostRoom.total ? { tone: 'threat' as const } : {})} />
              <Figure label={t('clanSupport.figBays')} value={`${full(quote.bays.used)}/${full(quote.bays.total)}`}
                sub={t('clanSupport.figBaysSub')} />
            </Figures>
            <ul data-support-rules="" className="flex flex-col gap-1 text-micro leading-snug text-v2-ink-2">
              <li>{t('clanSupport.stay', { time: countdown(quote.stationUntil.getTime() - now) })}</li>
              {quote.seasonClipped && <li className="text-v2-warn">{t('clanSupport.stayClipped')}</li>}
              <li className={quote.band.ok ? '' : 'text-v2-warn'}>
                {t('clanSupport.band', { mine: quote.band.mine, theirs: quote.band.theirs })} · {
                  quote.band.ok ? t('clanSupport.bandOk') : t('clanSupport.bandOut')}
              </li>
              <li>{t('clanSupport.noEscapeNote')}</li>
              <li>{t('clanSupport.share')}</li>
            </ul>
            {quote.refusals.map((blocking) => (
              <p key={blocking.code} role="alert" className="text-caption text-v2-warn">
                {describeError(new ApiError(blocking.code, blocking.message, 409, blocking.params))}
              </p>
            ))}
          </>
        )}
      </div>
    </Sheet>
  );
}
