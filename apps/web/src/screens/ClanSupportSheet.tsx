import { MOBILE_HULLS, NON_COMBATANT_HULLS, fleetCount, partitionCombatFleet, type Fleet, type HullId } from '@astera/rules';
import { useEffect, useState } from 'react';
import { HonorSoloNotice } from '../ui/HonorSoloNotice.js';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../api/client.js';
import { useClanSupportActions } from '../api/queries.js';
import type { PlanetView } from '../api/schemas.js';
import { describeError } from '../i18n/errors.js';
import { hullName } from '../i18n/names.js';
import { full } from '../lib/format.js';
import { countdown, durationPrecise, useNow } from '../lib/time.js';
import { supportVerdict } from '../lib/clanAlarm.js';
import { HULL_ART } from '../ui/assets.js';
import { HullMark } from '../ui/icons/hulls.js';
import { QuantityStepper } from '../ui/QuantityStepper.js';
import { Choices, GameHold, Glyph, SectionTag } from '../game-ui/index.js';
import { Sheet } from '../v2/kit/Sheet.js';
import { useCommanderShip } from '../api/commanderShip.js';
import { escortOf } from '../lib/admiralEscort.js';
import { serverNow } from '../lib/clock.js';
import { EscortRow } from '../ui/EscortRow.js';

/** How long the picked fleet sits still before its quote is asked for. */
const QUOTE_SETTLE_MS = 350;

export interface SupportHost {
  planetId: string;
  planetName: string;
  ownerName: string;
  /** F2 E1: the clan alarm this sheet answers — the raid's landing instant beside the wave's. */
  alarm?: { id: string; arriveAt: Date };
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
  const available = origin ? origin.fleetCombatReady ?? partitionCombatFleet(origin.fleet, origin.fleetDamage).eligible : {};
  // The commander ship may stand with the wave (Y9); the server prices its road in the quote.
  const escort = escortOf(useCommanderShip(true).data, serverNow());
  const [escortWanted, setEscortWanted] = useState(false);
  const escorted = escortWanted && escort?.kind === 'ready';
  const quoteKey = `${origin?.planet.id ?? ''}:${JSON.stringify(fleet)}:${String(escorted)}`;
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
    const asked = `${originPlanetId}:${JSON.stringify(fleet)}:${String(escorted)}`;
    const timer = setTimeout(() => {
      requestQuote({ originPlanetId, hostPlanetId: host.planetId, fleet, ...(escorted ? { admiral: true } : {}) },
        { onSuccess: () => { setQuotedKey(asked); } });
    }, QUOTE_SETTLE_MS);
    return () => { clearTimeout(timer); };
  }, [requestQuote, originPlanetId, host.planetId, fleet, escorted]);

  const firstRefusal = quote?.refusals[0];
  const refusal = !origin ? t('clanSupport.noOrigin')
    : picked === 0 ? t('clanSupport.noFleet')
      : actions.send.isPending ? t('clanSupport.sending')
        : quote === undefined ? (actions.quote.isError ? describeError(actions.quote.error) : t('clanSupport.quoting'))
          : firstRefusal ? describeError(new ApiError(firstRefusal.code, firstRefusal.message, 409, firstRefusal.params))
            : null;

  // A support wave is a fighting line: the mining craft never go (CLAN_SUPPORT_NONCOMBATANT).
  const hulls = MOBILE_HULLS.filter((hull) => (available[hull] ?? 0) > 0 && !NON_COMBATANT_HULLS.includes(hull));

  const figure = (label: string, value: string, sub: string, tone?: 'hostile') => (
    <div className="gk-figure">
      <dt className="gk-label">{label}</dt>
      <dd className="gk-num gk-figure__value" {...(tone ? { 'data-tone': tone } : {})}>{value}</dd>
      <dd className="gk-figure__sub">{sub}</dd>
    </div>
  );

  return (
    <Sheet
      kit={{ tone: 'self' }}
      eyebrow={t('clanSupport.sheetEyebrow', { world: host.planetName })}
      title={`${host.ownerName} · ${host.planetName}`}
      detents={['fit']}
      placement="page"
      onClose={onClose}
      footer={(
        <div data-support-commit="" className="gk gk-launch__commit">
          {quote && <p className="gk-sub">{t('clanSupport.recallRule')}</p>}
          {/* The fuel is burnt on the hold, though the line can be called home: the kit's spend weight. */}
          <GameHold
            weight="spends"
            glyph="support"
            label={t('clanSupport.holdSend', { count: picked })}
            disabledReason={refusal}
            onCommit={() => {
              if (!origin) return;
              actions.send.mutate(
                { originPlanetId: origin.planet.id, hostPlanetId: host.planetId, fleet,
                  ...(escorted ? { admiral: true } : {}), ...(host.alarm ? { alarmId: host.alarm.id } : {}) },
                { onSuccess: () => { setFleet({}); setQuotedKey(null); setEscortWanted(false); onSent(host.planetName); } },
              );
            }}
          />
          {actions.send.isError && (
            <p role="alert" className="gk-inote" data-tone="warn"><Glyph id="warn" />{describeError(actions.send.error)}</p>
          )}
        </div>
      )}
    >
      <div className="gk-clan__parts gk-support">
        <HonorSoloNotice look="kit" />
        {host.alarm && <AlarmStrip raidAt={host.alarm.arriveAt} landsAt={quote?.arriveAt ?? null} now={now} />}
        <p className="gk-inote" data-tone="self"><Glyph id="shield" />{t('clanSupport.sendActionHint')}</p>
        {worlds.length > 1 && (
          <Choices
            label={t('clanWar.origin')}
            value={origin?.planet.id ?? ''}
            options={worlds.map((world) => ({ id: world.planet.id, label: world.planet.name }))}
            onChange={(id) => { setOriginId(id); setFleet({}); setQuotedKey(null); }}
          />
        )}

        <section className="gk-clan__part">
          <SectionTag as="h3">{t('clanSupport.lineShips')}</SectionTag>
          {hulls.length === 0 ? (
            <p className="gk-inote" data-tone="warn"><Glyph id="hull" />{t('clanSupport.noShips')}</p>
          ) : (
            <div className="gk-ledger gk-launch__rows">
              {hulls.map((hull) => {
                const held = available[hull] ?? 0;
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

        {picked > 0 && <EscortRow escort={escort} on={escorted} onChange={setEscortWanted} defence />}
        {quote && (
          <>
            <dl data-support-figures="" className="gk-well gk-figures gk-figures--well gk-figures--two">
              {figure(t('clanSupport.figFuel'), full(quote.fuel), t('clanSupport.figFuelSub'))}
              {figure(t('clanSupport.figArrive'), countdown(quote.arriveAt.getTime() - now), host.planetName)}
              {figure(t('clanSupport.figRoom'), `${full(quote.hostRoom.after)}/${full(quote.hostRoom.total)}`, t('clanSupport.figRoomSub'),
                quote.hostRoom.after > quote.hostRoom.total ? 'hostile' : undefined)}
              {figure(t('clanSupport.figBays'), `${full(quote.bays.used)}/${full(quote.bays.total)}`, t('clanSupport.figBaysSub'))}
            </dl>
            {/* What binds THIS flight, before the hold: the stay, the season, the band, no retreat, the ladder's share. */}
            <ul data-support-rules="" className="gk-well gk-support__rules">
              <li className="gk-inote"><Glyph id="clock" />{t('clanSupport.stay', {
                hours: Math.round((quote.stationUntil.getTime() - quote.arriveAt.getTime()) / 3_600_000),
                time: countdown(quote.stationUntil.getTime() - now),
              })}</li>
              {quote.seasonClipped && <li className="gk-inote" data-tone="warn"><Glyph id="timed" />{t('clanSupport.stayClipped')}</li>}
              <li className="gk-inote" {...(quote.band.ok ? {} : { 'data-tone': 'warn' })}>
                <Glyph id="ranking" />{t('clanSupport.band', { mine: quote.band.mine, theirs: quote.band.theirs })} · {
                  quote.band.ok ? t('clanSupport.bandOk') : t('clanSupport.bandOut')}
              </li>
              <li className="gk-inote"><Glyph id="lock" />{t('clanSupport.noEscapeNote')}</li>
              <li className="gk-inote"><Glyph id="share" />{t('clanSupport.share')}</li>
            </ul>
            {quote.refusals.map((blocking) => (
              <p key={blocking.code} role="alert" className="gk-inote" data-tone="warn">
                <Glyph id="warn" />{describeError(new ApiError(blocking.code, blocking.message, 409, blocking.params))}
              </p>
            ))}
          </>
        )}
      </div>
    </Sheet>
  );
}

/**
 * THE CALL THIS SHEET ANSWERS (F2 E1). The raid's clock first, so the picking happens against
 * it; once the flight is priced, the verdict for these ships: in time, by how much, or too late.
 */
function AlarmStrip({ raidAt, landsAt, now }: { raidAt: Date; landsAt: Date | null; now: number }) {
  const { t } = useTranslation();
  const landed = raidAt.getTime() <= now;
  const verdict = landsAt && !landed ? supportVerdict(landsAt, raidAt) : null;
  return (
    <div data-alarm-strip="" className="gk-well gk-support__alarm">
      <p className="gk-support__alarmhead">
        <span className="gk-label">{t('clanSupport.alarmAnswering')}</span>
        <span className="gk-num">
          {landed ? t('clanSupport.alarmRaidLanded') : t('clanSupport.alarmRaidIn', { time: countdown(raidAt.getTime() - now) })}
        </span>
      </p>
      {verdict && (
        <p data-alarm-verdict={verdict.inTime ? 'in-time' : 'late'} className="gk-inote" data-tone={verdict.inTime ? 'good' : 'warn'}>
          {t(verdict.inTime ? 'clanSupport.alarmInTime' : 'clanSupport.alarmLate', { time: durationPrecise(verdict.minutes) })}
        </p>
      )}
    </div>
  );
}
