import { useTranslation } from 'react-i18next';
import { FAULT, deuteriumRate, leakRates } from '@astera/rules';
import type { FaultView, PlanetView } from '../api/schemas.js';
import { useRepairFault } from '../api/queries.js';
import { CostLine, GameHold, Glyph, TimerRow } from '../game-ui/index.js';
import { useToast } from '../ui/Toast.js';
import { RESOURCE_ART } from '../ui/assets.js';
import { LoyaltyRow } from '../ui/PlanetHero.js';
import { decimal, full } from '../lib/format.js';
import { countdown, useNow } from '../lib/time.js';
import { Sheet } from '../v2/kit/Sheet.js';
import { productionPaceOf } from '../lib/gains.js';

/**
 * ONE BROKEN THING, AND WHAT TO DO ABOUT IT. Koloni arızaları.
 *
 * A SEPARATE SURFACE FROM `ItemSheet`, and not for want of reuse. That sheet answers
 * "should I grow this" — a ladder, a payload, a price for the next rung. This one
 * answers a different question with a different shape, and the owner asked for it in as
 * many words: *"alttan geliştirme tab'ı degil yeni tasarlayacagın fixle sheeti
 * çıkmalı."* Folding one into the other would have put a conditional on every block of
 * the busiest sheet in the game.
 *
 * ON THE GAME KIT (G2-d, 2026-11-14). The player's moment is "is it worth mending?", and
 * the sheet is drawn to answer it at a glance:
 *
 *   1 · WHAT HAPPENED — one sentence naming the thing and what it stopped.
 *   2 · WHAT IT TAKES AN HOUR BESIDE WHAT THE CREW COSTS — the two halves of the
 *       decision side by side, a figure each. "You are not making 1,770 alloy an hour"
 *       against "600 alloy, 200 crystal" is the comparison the three crews create.
 *   3 · HOW LONG — a RANGE, never a figure. The duration is drawn when the crew is
 *       hired; a sheet that promised nine minutes would promise what the server has not
 *       decided. Predictability: give the inputs and the rule, withhold the answer.
 *   4 · THE WORLD'S STAKE — a colony's loyalty, drawn as the hero draws it.
 *
 * And the warning, which is not a question: THERE IS NO CANCEL. Said above the hold
 * rather than discovered after it, and the hold is the kit's one-second weight for what
 * spends — a repair is never a tap.
 */
export function FaultSheet({
  fault,
  planet,
  onClose,
}: {
  fault: FaultView;
  planet: PlanetView;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const say = useToast();
  const repair = useRepairFault();
  /*
    THE SHARED SERVER CLOCK, like every other countdown in this game. `Date.now()` is the
    phone's clock, and a device a few minutes off would have shown a repair finishing
    before it had started — the exact reason every queue on this client derives its
    countdown from an absolute instant and one ticking source.
  */
  const now = useNow(1000);

  const faults = planet.faults ?? [];
  const busy = faults.filter((row) => row.repair !== null).length;
  const free = Math.max(0, FAULT.repairSlots - busy);
  const held = { alloy: planet.planet.alloy, crystal: planet.planet.crystal };
  const short = held.alloy < fault.cost.alloy || held.crystal < fault.cost.crystal;
  const refused = free === 0
    ? t('faults.lanesFull', { count: FAULT.repairSlots })
    : short ? t('faults.short') : null;

  /**
   * WHAT THIS ONE IS TAKING, PER HOUR, ON THIS WORLD.
   *
   * Measured rather than described. The three outages quote the production that is not
   * happening — at the pace the works were RUNNING, half the rating in Silent Space
   * (D212); the leak quotes what is going into orbit where anybody can see it. The rest
   * stop a capability rather than a number and say so in the sentence above, because
   * inventing a figure for "no fleet can leave" would be worse than the sentence.
   */
  const toll = ((): { amount: number; art: string | null; what: string } | null => {
    const pace = productionPaceOf(planet);
    const nominal = {
      alloy: planet.planet.nominalAlloyPerHour ?? planet.planet.alloyPerHour,
      crystal: planet.planet.nominalCrystalPerHour ?? planet.planet.crystalPerHour,
      deuterium: planet.planet.nominalDeuteriumPerHour ?? deuteriumRate(planet.buildings.DEUTERIUM_PLANT ?? 0),
    };
    switch (fault.kind) {
      case 'REFINERY_OUTAGE':
        return { amount: Math.round(nominal.alloy * pace), art: RESOURCE_ART.alloy, what: t('faults.toll.what.REFINERY_OUTAGE') };
      case 'EXTRACTOR_OUTAGE':
        return { amount: Math.round(nominal.crystal * pace), art: RESOURCE_ART.crystal, what: t('faults.toll.what.EXTRACTOR_OUTAGE') };
      case 'PLANT_OUTAGE':
        return { amount: Math.round(nominal.deuterium * pace), art: RESOURCE_ART.deuterium, what: t('faults.toll.what.PLANT_OUTAGE') };
      case 'VAULT_LEAK': {
        /*
          `leakRates` is the same pure function the server prices the drain with, read off
          this world's own ladders — the one place this sheet computes rather than quotes,
          because it is a RATE rather than a price and no endpoint will ever refuse it.
        */
        const rate = leakRates(nominal, planet.buildings.VAULT ?? 0);
        return { amount: rate.alloy + rate.crystal + rate.deuterium, art: null, what: t('faults.toll.what.VAULT_LEAK') };
      }
      default:
        return null;
    }
  })();

  /*
    THE SERVER'S OWN FIGURE, NOT A SECOND ONE. `minutesLeft` is computed against the fault
    count and the loyalty the server actually holds, and two surfaces disagreeing about
    how long a world has is the one thing this block is supposed to settle. A capital
    gets null: its loyalty cannot move.
  */
  const loyalty = planet.loyalty ?? null;
  const left = fault.repair ? Math.max(0, fault.repair.readyAt.getTime() - now) : 0;
  const slot = (fault.repair?.slot ?? 0) + 1;

  const start = (): void => {
    if (repair.isPending) return;
    repair.mutate(
      { planetId: planet.planet.id, faultId: fault.id },
      {
        onSuccess: () => {
          say(t('faults.started'));
          onClose();
        },
        onError: () => { say(t('faults.failed'), 'error'); },
      },
    );
  };

  return (
    <Sheet
      detents={['fit']}
      kit={{
        tone: 'warn',
        meta: <span className="gk-sub">{t('faults.crewsFree', { free, count: FAULT.repairSlots })}</span>,
      }}
      eyebrow={planet.planet.name}
      title={t(`faults.name.${fault.kind}`)}
      onClose={onClose}
      footer={
        fault.repair ? (
          <div data-fault-running className="gk">
            {/* No cancel control: its absence is the contract (`faults.test.tsx`). */}
            <TimerRow
              tone="warn"
              glyph="repair"
              remaining={left}
              total={FAULT.repairMaxMinutes * 60_000}
              title={t('faults.crewOn')}
              detail={t('faults.strip.lane', { slot })}
              time={countdown(left)}
            />
          </div>
        ) : (
          <div className="gk grid gap-2">
            <p className="gk-fault__final"><Glyph id="lock" />{t('faults.noCancel')}</p>
            <GameHold weight="spends" glyph="repair" commitSound="weld" label={t('faults.repair')} disabledReason={refused} onCommit={start} />
          </div>
        )
      }
    >
      <div className="gk gk-fault">
        <p className="gk-fault__what">
          <span className="gk-fault__mark" aria-hidden="true"><Glyph id="damaged" /></span>
          {t(`faults.stopped.${fault.kind}`)}
        </p>

        {(toll !== null || fault.repair === null) && (
          <div data-fault-ledger className="gk-fault__ledger">
            {toll !== null && (
              <div data-fault-toll className="gk-well gk-fault__half">
                <span className="gk-label">{t('faults.toll.title')}</span>
                <span className="gk-fault__rate gk-num">
                  {toll.art === null ? <Glyph id="debris" /> : <img src={toll.art} alt="" />}
                  {t('faults.toll.rate', { amount: full(toll.amount) })}
                </span>
                <span className="gk-sub">{toll.what}</span>
              </div>
            )}
            {fault.repair === null && (
              <div data-fault-price className="gk-well gk-fault__half">
                <span className="gk-label">{t('faults.price.title')}</span>
                <CostLine cost={fault.cost} held={held} />
                <span className="gk-fault__range gk-num">
                  <Glyph id="timed" />
                  {t('faults.price.range', {
                    min: decimal(FAULT.repairMinMinutes, 2),
                    max: decimal(FAULT.repairMaxMinutes, 2),
                  })}
                </span>
              </div>
            )}
          </div>
        )}

        {fault.repair === null && <p className="gk-sub">{t('faults.price.drawn')}</p>}

        {loyalty && (
          <section data-fault-loyalty className="gk-loyalty">
            <LoyaltyRow loyalty={loyalty} />
            <p className="gk-sub">{t('faults.loyalty.why', { count: faults.length })}</p>
          </section>
        )}
      </div>
    </Sheet>
  );
}
