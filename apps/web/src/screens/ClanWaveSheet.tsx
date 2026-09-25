import { HULLS, MOBILE_HULLS, fleetCount, type Fleet, type HullId } from '@astera/rules';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useClanWarActions } from '../api/queries.js';
import { ApiError } from '../api/client.js';
import type { ClanWar, PlanetView } from '../api/schemas.js';
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
import { Toggle } from '../v2/kit/Toggle.js';

/** How long the picked fleet has to sit still before its quote is asked for. */
const QUOTE_SETTLE_MS = 350;

/**
 * A CLAN WAVE, FROM THE LAUNCH PAGE. E9 → B14: "Form doldurmak yerine 'Dalga gönder'
 * standart fırlatma ekranını açar." The room used to hold a form — a dropdown of worlds,
 * the ships, a paragraph of fuel legs — under the target; the wave now leaves the way
 * every fleet leaves: the world as a chip, the ships as rows, the flight in figures, the
 * price and the recall rule before a held send (K4).
 *
 * THE QUOTE ASKS ITSELF (B14): the route, the fuel, the bays and the refusals follow the
 * ships as they are picked, once the picking settles. A reply for a fleet since changed is
 * never shown: it is filed under the key it was asked with.
 *
 * A refusal is a gap you can close (warn); the one red line is a shield the send would end,
 * because that is something happening to you (K2), and it is agreed to with a switch.
 */
export function ClanWaveSheet({ operation, worlds, onClose, onSent }: {
  operation: NonNullable<ClanWar['operation']>;
  worlds: readonly PlanetView[];
  onClose: () => void;
  onSent: () => void;
}) {
  const { t } = useTranslation();
  const actions = useClanWarActions();
  const now = useNow();
  const [originId, setOriginId] = useState(worlds[0]?.planet.id ?? '');
  const [fleet, setFleet] = useState<Fleet>({});
  const [quotedKey, setQuotedKey] = useState<string | null>(null);
  const [acknowledgeShield, setAcknowledgeShield] = useState(false);
  const origin = worlds.find((world) => world.planet.id === originId) ?? worlds[0];
  const quoteKey = `${origin?.planet.id ?? ''}:${JSON.stringify(fleet)}`;
  const quote = quotedKey === quoteKey ? actions.quote.data : undefined;
  const blockingRefusals = quote?.refusals.filter((refusal) => refusal.code !== 'SHIELD_WOULD_DROP') ?? [];
  const quoteCanSend = quote !== undefined && (quote.ok
    || (quote.shieldWouldDrop !== null && blockingRefusals.length === 0));
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
      requestQuote({ originPlanetId, fleet }, { onSuccess: () => { setQuotedKey(asked); } });
    }, QUOTE_SETTLE_MS);
    return () => { clearTimeout(timer); };
  }, [requestQuote, originPlanetId, fleet]);

  /** Why the wave cannot go yet, on the held button's face — or null when it can. */
  const refusal = !origin ? t('clanWar.noOrigin')
    : picked === 0 ? t('clanWar.noFleet')
      : actions.contribute.isPending ? t('clanWar.sending')
        : quote === undefined ? (actions.quote.isError ? describeError(actions.quote.error) : t('clanWar.quoting'))
          : blockingRefusals[0] ? describeError(new ApiError(blockingRefusals[0].code, blockingRefusals[0].message, 409))
            : quote.shieldWouldDrop !== null && !acknowledgeShield ? t('clanWar.acknowledgeFirst')
              : quoteCanSend ? null : t('clanWar.quoting');

  const hulls = MOBILE_HULLS.filter((hull) => (origin?.fleet[hull] ?? 0) > 0);

  return (
    <Sheet
      eyebrow={t('clanWar.waveEyebrow', { world: operation.staging.name })}
      title={`${operation.target.username} · ${operation.target.planetName}`}
      detents={['fit']}
      placement="page"
      onClose={onClose}
      footer={(
        <div data-wave-commit="" className="grid gap-1.5">
          {quote && <p className="text-micro leading-snug text-v2-ink-3">{t('clanWar.recallRule')}</p>}
          <HoldButton
            label={t('clanWar.holdSend', { count: picked })}
            disabledReason={refusal}
            onCommit={() => {
              if (!origin) return;
              actions.contribute.mutate(
                { originPlanetId: origin.planet.id, fleet, acknowledgeShieldLoss: acknowledgeShield },
                { onSuccess: () => { setFleet({}); setQuotedKey(null); setAcknowledgeShield(false); onSent(); } },
              );
            }}
          />
          {actions.contribute.isError && (
            <p role="alert" className="text-caption text-v2-warn">{describeError(actions.contribute.error)}</p>
          )}
        </div>
      )}
    >
      <div className="flex flex-col gap-3 pt-1">
        {worlds.length > 1 && (
          <ChoiceChips
            label={t('clanWar.origin')}
            value={origin?.planet.id ?? ''}
            options={worlds.map((world) => ({
              id: world.planet.id,
              label: world.planet.name,
              detail: t('clanWar.shipsHome', { count: fleetCount(world.fleet) }),
            }))}
            onChange={(id) => {
              setOriginId(id);
              setFleet({});
              setQuotedKey(null);
              setAcknowledgeShield(false);
            }}
          />
        )}

        {/* The launch's own row (B14): the ship, how many stand home, the stepper at its right. */}
        {hulls.length === 0 ? (
          <p className="text-caption text-v2-ink-2">{t('clanWar.noShipsHere')}</p>
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

        {/* THE FLIGHT IN FIGURES, once the server has priced it. */}
        {quote && (
          <>
            <Figures data-wave-figures="">
              <Figure label={t('clanWar.figFuel')} value={full(quote.fuel.total)} sub={t('clanWar.figOf', { total: full(quote.fuel.available) })}
                {...(quote.fuel.total > quote.fuel.available ? { tone: 'threat' as const } : {})} />
              <Figure label={t('fleetPage.bays')} value={`${full(quote.bays.used)}/${full(quote.bays.total)}`} sub={t('clanWar.figThisOne')} />
              {quote.travel.stagingEta && (
                <Figure label={t('clanWar.figArrive')} value={countdown(quote.travel.stagingEta.getTime() - now)} sub={operation.staging.name} />
              )}
              <Figure label={t('clanWar.figPersonal')} value={`${full(quote.personalHangar.afterSend)}/${full(quote.personalHangar.total)}`} sub={t('clanWar.figAfter')} />
              <Figure label={t('clanWar.figClan')} value={`${full(quote.clanHangar.afterSend)}/${full(quote.clanHangar.total)}`} sub={t('clanWar.figAfter')} />
              {quote.travel.earliestHome && (
                <Figure label={t('clanWar.figHome')} value={countdown(quote.travel.earliestHome.getTime() - now)} />
              )}
            </Figures>
            {quote.latestStartAt && (
              <p className="text-micro text-v2-ink-3">{t('clanWar.latestStart', { time: countdown(quote.latestStartAt.getTime() - now) })}</p>
            )}
            {blockingRefusals.map((blocking) => (
              <p key={blocking.code} role="alert" className="text-caption text-v2-warn">
                {describeError(new ApiError(blocking.code, blocking.message, 409))}
              </p>
            ))}
            {quote.shieldWouldDrop && (
              <div className="flex flex-col gap-1 rounded-control border border-v2-hostile/40 bg-v2-hostile/5 px-2.5 py-2">
                <p className="text-caption text-v2-hostile">{t('clanWar.shield', { kind: quote.shieldWouldDrop.kind })}</p>
                <Toggle tone="hostile" checked={acknowledgeShield} onChange={setAcknowledgeShield}>
                  {t('clanWar.acknowledgeShield')}
                </Toggle>
              </div>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}
