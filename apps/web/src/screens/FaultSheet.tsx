import { useTranslation } from 'react-i18next';
import { FAULT, deuteriumRate, leakRates } from '@astera/rules';
import type { FaultView, PlanetView } from '../api/schemas.js';
import { useRepairFault } from '../api/queries.js';
import { useToast } from '../ui/Toast.js';
import { FaultMark } from '../ui/marks.js';
import { SpendBar } from '../ui/SpendBar.js';
import { full } from '../lib/format.js';
import { countdown, duration, useNow } from '../lib/time.js';
import { Button, Sheet } from '../ui/kit/index.js';

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
 * THE FOUR QUESTIONS (`CLAUDE.md`), in the order a player asks them:
 *
 *   1 · WHAT HAPPENED — one sentence naming the thing and what it stopped.
 *   2 · WHAT IT IS COSTING YOU — and this is the block that earns the sheet. A
 *       notification that says "your refinery is out" is news; "you are not making
 *       1,770 alloy an hour" is a DECISION. Without a measured figure from THIS world
 *       the player cannot rank one fault against another, and ranking them is the whole
 *       game the three repair lanes create.
 *   3 · WHAT IT COSTS — priced by the server, drawn against what the world holds.
 *   4 · HOW LONG — a RANGE, never a figure. The duration is drawn when the crew is
 *       hired, and a sheet that promised nine minutes would be promising something the
 *       server has not decided yet. Predictability: give the inputs and the rule,
 *       withhold the answer.
 *
 * And the fifth line, which is not a question but a warning: THERE IS NO CANCEL. Said
 * before the button rather than discovered after it.
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

  const running = fault.repair !== null;
  const faults = planet.faults ?? [];
  const busy = faults.filter((row) => row.repair !== null).length;
  const lanesFull = !running && busy >= FAULT.repairSlots;
  const short = planet.planet.alloy < fault.cost.alloy
    || planet.planet.crystal < fault.cost.crystal;

  /**
   * WHAT THIS ONE IS TAKING, PER HOUR, ON THIS WORLD.
   *
   * Measured rather than described. The three outages quote the production that is not
   * happening; the leak quotes what is going into orbit where anybody can see it; the
   * rest stop a capability rather than a number and say so in words, because inventing
   * a figure for "no fleet can leave" would be worse than the sentence.
   */
  const bleeding = ((): string | null => {
    switch (fault.kind) {
      case 'REFINERY_OUTAGE':
        return t('faults.toll.alloy', {
          amount: full(planet.planet.nominalAlloyPerHour ?? planet.planet.alloyPerHour),
        });
      case 'EXTRACTOR_OUTAGE':
        return t('faults.toll.crystal', {
          amount: full(planet.planet.nominalCrystalPerHour ?? planet.planet.crystalPerHour),
        });
      case 'PLANT_OUTAGE':
        return t('faults.toll.deuterium');
      case 'VAULT_LEAK': {
        /*
          THE MEASURED FIGURE, NOT A DESCRIPTION. "Your vault is leaking" is news; "5,481
          an hour into orbit, where your neighbours can see it" is what ranks this fault
          against the other two a commander is choosing between. `leakRates` is the same
          pure function the server prices the drain with, read off this world's own
          ladders — the one place this sheet computes rather than quotes, because it is
          a RATE rather than a price and no endpoint will ever refuse it.
        */
        const rate = leakRates(
          {
            alloy: planet.planet.nominalAlloyPerHour ?? planet.planet.alloyPerHour,
            crystal: planet.planet.nominalCrystalPerHour ?? planet.planet.crystalPerHour,
            deuterium: planet.planet.nominalDeuteriumPerHour
              ?? deuteriumRate(planet.buildings.DEUTERIUM_PLANT ?? 0),
          },
          planet.buildings.VAULT ?? 0,
        );
        return t('faults.toll.leak', {
          amount: full(rate.alloy + rate.crystal + rate.deuterium),
        });
      }
      default:
        return null;
    }
  })();

  /*
    THE SERVER'S OWN FIGURE, NOT A SECOND ONE. `minutesUntilLoyaltyZero` is pure and this
    client imports it, so recomputing was easy and wrong: the payload already carries the
    answer, computed against the fault count and the loyalty the server actually holds,
    and two surfaces disagreeing about how long a world has is the one thing this line is
    supposed to settle.
  */
  const loyalty = planet.loyalty;
  const left = loyalty?.minutesLeft ?? null;

  return (
    <Sheet
      eyebrow={planet.planet.name}
      title={t(`faults.name.${fault.kind}`)}
      onClose={onClose}
      footer={
        running ? (
          <p className="text-caption text-faint">
            {t('faults.running', { time: countdown(fault.repair!.readyAt.getTime() - now) })}
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {/*
              THE WARNING GOES ABOVE THE BUTTON, not in a confirm behind it. Five to
              fifteen minutes is too short to be worth a second tap, and a rule the
              player reads before acting is a rule; one they meet afterwards is a trap.
            */}
            <p className="text-micro text-faint">{t('faults.noCancel')}</p>
            <Button
              variant="primary"
              disabled={repair.isPending || lanesFull || short}
              onClick={() => {
                repair.mutate(
                  { planetId: planet.planet.id, faultId: fault.id },
                  {
                    onSuccess: () => {
                      say(t('faults.started'));
                      onClose();
                    },
                    onError: () => { say(t('faults.failed')); },
                  },
                );
              }}
            >
              {lanesFull
                ? t('faults.lanesFull', { count: FAULT.repairSlots })
                : t('faults.repair')}
            </Button>
          </div>
        )
      }
    >
      <div className="flex flex-col gap-4 px-4 pb-4 pt-1">
        <p className="flex items-start gap-2 text-body text-dim">
          <span className="mt-0.5 shrink-0 text-bone"><FaultMark className="size-4" /></span>
          {t(`faults.stopped.${fault.kind}`)}
        </p>

        {bleeding && (
          <section className="plate plate-inset px-3 py-2">
            <h3 className="legend text-faint">{t('faults.toll.title')}</h3>
            <p className="num mt-1 text-body text-bone">{bleeding}</p>
          </section>
        )}

        {/*
          THE WORLD'S OWN STAKE, and it is why this sheet is worth opening on a fault
          that costs no ore at all. A telescope outage takes nothing per hour and still
          pulls loyalty down at the same rate as any other, so without this line the
          player would rank it as harmless.
        */}
        {loyalty && (
          <section className="plate plate-inset px-3 py-2">
            <h3 className="legend text-faint">{t('faults.loyalty.title')}</h3>
            <p className="mt-1 text-body text-dim">
              {t('faults.loyalty.line', {
                value: Math.round(loyalty.value),
                count: faults.length,
                time: left === null ? '—' : duration(left),
              })}
            </p>
          </section>
        )}

        {!running && (
          <section className="flex flex-col gap-2">
            <h3 className="legend text-faint">{t('faults.price.title')}</h3>
            <SpendBar
              stock={planet.planet.alloy}
              spend={fault.cost.alloy}
              tone="alloy"
              label={t('faults.price.crew')}
            />
            {fault.cost.crystal > 0 && (
              <SpendBar
                stock={planet.planet.crystal}
                spend={fault.cost.crystal}
                tone="crystal"
                label={t('faults.price.parts')}
              />
            )}
            <p className="text-caption text-faint">
              {t('faults.price.takes', {
                min: FAULT.repairMinMinutes,
                max: FAULT.repairMaxMinutes,
              })}
            </p>
          </section>
        )}
      </div>
    </Sheet>
  );
}
