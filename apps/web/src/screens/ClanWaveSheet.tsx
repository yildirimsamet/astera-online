import { MOBILE_HULLS, fleetCount, type Fleet, type HullId } from '@astera/rules';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useClanWarActions } from '../api/queries.js';
import { ApiError } from '../api/client.js';
import type { ClanWar, PlanetView } from '../api/schemas.js';
import { describeError } from '../i18n/errors.js';
import { hullName, monumentName } from '../i18n/names.js';
import { full } from '../lib/format.js';
import { countdown, useNow } from '../lib/time.js';
import { HULL_ART } from '../ui/assets.js';
import { HullMark } from '../ui/icons/hulls.js';
import { QuantityStepper } from '../ui/QuantityStepper.js';
import { RadiationPreview } from '../ui/RadiationPreview.js';
import { Choices, GameHold, Glyph, SectionTag, Toggle } from '../game-ui/index.js';
import { Sheet } from '../v2/kit/Sheet.js';

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
  const [acknowledgeRadiation, setAcknowledgeRadiation] = useState(false);
  const origin = worlds.find((world) => world.planet.id === originId) ?? worlds[0];
  const quoteKey = `${origin?.planet.id ?? ''}:${JSON.stringify(fleet)}`;
  const quote = quotedKey === quoteKey ? actions.quote.data : undefined;
  const radiationLoss = (quote?.radiation?.destroyed ?? 0) > 0;
  const blockingRefusals = quote?.refusals.filter((refusal) => refusal.code !== 'SHIELD_WOULD_DROP'
    && !(refusal.code === 'RADIATION_LETHAL' && radiationLoss)) ?? [];
  const quoteCanSend = quote !== undefined && (quote.ok
    || ((quote.shieldWouldDrop !== null || radiationLoss) && blockingRefusals.length === 0));
  const picked = fleetCount(fleet);

  const setCount = (hull: HullId, value: number): void => {
    const next = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
    setFleet((current) => ({ ...current, [hull]: next }));
    setQuotedKey(null);
    setAcknowledgeShield(false);
    setAcknowledgeRadiation(false);
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
              : radiationLoss && !acknowledgeRadiation ? t('monument.consent')
              : quoteCanSend ? null : t('clanWar.quoting');

  const hulls = MOBILE_HULLS.filter((hull) => (origin?.fleet[hull] ?? 0) > 0);

  const figure = (label: string, value: string, sub?: string, tone?: 'hostile') => (
    <div className="gk-figure">
      <dt className="gk-label">{label}</dt>
      <dd className="gk-num gk-figure__value" {...(tone ? { 'data-tone': tone } : {})}>{value}</dd>
      {sub !== undefined && <dd className="gk-figure__sub">{sub}</dd>}
    </div>
  );

  return (
    <Sheet
      kit={{ tone: 'hostile' }}
      eyebrow={t('clanWar.waveEyebrow', { world: operation.staging.name })}
      title={operation.target.kind === 'MONUMENT' ? monumentName(operation.target.monumentOrdinal ?? undefined)
        : `${operation.target.username} · ${operation.target.planetName}`}
      detents={['fit']}
      placement="page"
      onClose={onClose}
      footer={(
        <div data-wave-commit="" className="gk gk-launch__commit">
          {quote && <p className="gk-sub">{t('clanWar.recallRule')}</p>}
          {/* The fuel is spent on the hold; the wave can be called back until the strike starts: the kit's spend weight. */}
          <GameHold
            weight="spends"
            glyph="attack"
            label={t('clanWar.holdSend', { count: picked })}
            disabledReason={refusal}
            onCommit={() => {
              if (!origin) return;
              actions.contribute.mutate(
                { originPlanetId: origin.planet.id, fleet, acknowledgeShieldLoss: acknowledgeShield,
                  ...(acknowledgeRadiation ? { acknowledgeRadiationLoss: true } : {}) },
                { onSuccess: () => { setFleet({}); setQuotedKey(null); setAcknowledgeShield(false); onSent(); } },
              );
            }}
          />
          {actions.contribute.isError && (
            <p role="alert" className="gk-inote" data-tone="warn"><Glyph id="warn" />{describeError(actions.contribute.error)}</p>
          )}
        </div>
      )}
    >
      <div className="gk-clan__parts gk-wave">
        {worlds.length > 1 && (
          <Choices
            label={t('clanWar.origin')}
            value={origin?.planet.id ?? ''}
            options={worlds.map((world) => ({ id: world.planet.id, label: world.planet.name }))}
            onChange={(id) => {
              setOriginId(id);
              setFleet({});
              setQuotedKey(null);
              setAcknowledgeShield(false);
              setAcknowledgeRadiation(false);
            }}
          />
        )}

        {/* The launch's own row (B14): the ship, how many are picked of those home, the stepper at its right. */}
        <section className="gk-clan__part">
          <SectionTag as="h3">{t('clanWar.waveShips')}</SectionTag>
          {hulls.length === 0 ? (
            <p className="gk-inote" data-tone="warn"><Glyph id="hull" />{t('clanWar.noShipsHere')}</p>
          ) : (
            <div className="gk-ledger gk-launch__rows">
              {hulls.map((hull) => {
                const held = origin?.fleet[hull] ?? 0;
                const chosen = fleet[hull] ?? 0;
                const art = HULL_ART[hull];
                return (
                  <div key={hull} data-hull-row={hull} className="gk-lrow gk-lrow--tight" {...(chosen > 0 ? { 'data-chosen': '' } : {})}>
                    <span data-art className="gk-lrow__art">
                      {art ? <img src={art} alt="" aria-hidden width={36} height={36} loading="lazy" /> : <HullMark hull={hull} className="gk-lrow__mark" />}
                    </span>
                    <span className="gk-lrow__name">{hullName(hull)}</span>
                    <span className="gk-sub gk-num gk-lrow__info" aria-label={t('launch.atHome', { count: held })}>
                      {chosen}<span className="gk-lrow__of">/{held}</span>
                    </span>
                    <QuantityStepper
                      value={chosen}
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
        </section>

        {/* THE FLIGHT IN FIGURES, once the server has priced it. */}
        {quote && (
          <>
            <dl data-wave-figures="" className="gk-well gk-figures gk-figures--well">
              {figure(t('clanWar.figFuel'), full(quote.fuel.total), t('clanWar.figOf', { total: full(quote.fuel.available) }),
                quote.fuel.total > quote.fuel.available ? 'hostile' : undefined)}
              {figure(t('fleetPage.bays'), `${full(quote.bays.used)}/${full(quote.bays.total)}`, t('clanWar.figThisOne'))}
              {quote.travel.stagingEta && figure(t('clanWar.figArrive'), countdown(quote.travel.stagingEta.getTime() - now), operation.staging.name)}
              {figure(t('clanWar.figPersonal'), `${full(quote.personalHangar.afterSend)}/${full(quote.personalHangar.total)}`, t('clanWar.figAfter'))}
              {figure(t('clanWar.figClan'), `${full(quote.clanHangar.afterSend)}/${full(quote.clanHangar.total)}`, t('clanWar.figAfter'))}
              {quote.travel.earliestHome && figure(t('clanWar.figHome'), countdown(quote.travel.earliestHome.getTime() - now))}
            </dl>
            {quote.fuel.reserved && <p className="gk-inote"><Glyph id="fuel" />{t('monument.clanFuelReserveRule')}</p>}
            {quote.latestStartAt && (
              <p className="gk-inote"><Glyph id="clock" />{t('clanWar.latestStart', { time: countdown(quote.latestStartAt.getTime() - now) })}</p>
            )}
            {blockingRefusals.map((blocking) => (
              <p key={blocking.code} role="alert" className="gk-inote" data-tone="warn">
                <Glyph id="warn" />{describeError(new ApiError(blocking.code, blocking.message, 409))}
              </p>
            ))}
            {quote.radiation && <RadiationPreview combat radiation={{ kind: 'HP', doseHp: quote.radiation.doseHp,
              destroyed: quote.radiation.destroyed, lostFleet: quote.radiation.lostFleet,
              lots: quote.radiation.health, docks: quote.radiation.health.some((lot) => lot.needsDock) }} />}
            {radiationLoss && <Toggle checked={acknowledgeRadiation} onChange={setAcknowledgeRadiation} label={t('monument.radiation')} />}
            {quote.shieldWouldDrop && (
              <div className="gk-war__shield">
                <p className="gk-inote" data-tone="hostile"><Glyph id="shield" />{t('clanWar.shield', { kind: quote.shieldWouldDrop.kind })}</p>
                <Toggle checked={acknowledgeShield} onChange={setAcknowledgeShield} label={t('clanWar.acknowledgeShield')} />
              </div>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}
