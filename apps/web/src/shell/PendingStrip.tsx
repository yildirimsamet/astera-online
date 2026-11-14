import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useRecallFlight, useRecallMining } from '../api/queries.js';
import { useAirborne, type FlightMark, type StripFocus } from '../lib/airborne.js';
import { legProgress } from '../lib/fleetPage.js';
import { countdown } from '../lib/time.js';
import { FlightBar } from '../ui/FlightBar.js';
import {
  AttackIcon,
  DrillIcon,
  HomeworldIcon,
  IncomingIcon,
  ReturnedIcon,
  ScanIcon,
  SendIcon,
  WarBannerIcon,
} from '../ui/icons/index.js';
import { Sheet } from '../ui/kit/index.js';
import { describe, useToast } from '../ui/Toast.js';

/**
 * DESIGN LAW #1, made visible.
 *
 * "Every session must end with something in flight." A player can only act on
 * that if they can see it, so this strip is always on screen, counting down. Its
 * sheet is the complete owned-flight roster: mission threads and mining runs meet
 * here even though the API keeps them separate. When it is empty it says so
 * plainly — an empty strip is a prompt, not decoration.
 */
export function PendingStrip({ onFocus }: { onFocus?: (focus: StripFocus) => void }) {
  const { t } = useTranslation();
  const { items, now } = useAirborne();
  const [open, setOpen] = useState(false);

  const incoming = items.find((item) => item.incoming);
  const soonest = items[0];
  const shown = incoming ?? soonest;

  return (
    <>
      <button
        type="button"
        aria-label={t('pendingStrip.openFlights')}
        onClick={() => { setOpen(true); }}
        className={`w-full border-t px-2 py-2 text-left transition-colors hover:bg-raised/60 ${
          incoming ? 'border-alert/40 bg-alert/10' : 'border-line-soft bg-deep/80'
        }`}
      >
        {shown ? (
          <span className="flex items-center gap-2">
            {/*
              THE KIND, THEN THE NAME. A raid, a probe and a mining run were three
              sentences that differed only in wording; the glyph says which before
              the title is read, and it is the same glyph the notification, the
              report and the disc use for that act.
            */}
            <Mark of={shown.mark} incoming={shown.incoming} />
            <span className={`legend min-w-0 truncate ${incoming ? 'text-threat-ink' : ''}`}>
              {shown.title}
            </span>
            {/*
              THE LEG REPLACED ITS OWN LABEL. This slot held a hairline rule and,
              beside it, a chip reading OUTBOUND or RETURN — a spacer and a word
              where the same width can carry the actual journey. The marker's
              position is the progress and its direction is the leg, so the chip
              has nothing left to say that the picture does not.
            */}
            <span className="min-w-0 flex-1">
              <FlightBar
                progress={legProgress(shown.span, now)}
                direction={
                  shown.incoming ? 'incoming' : shown.leg === 'return' ? 'back' : 'out'
                }
                tone={incoming ? 'threat' : 'crystal'}
              />
            </span>
            <span className={`num text-caption whitespace-nowrap ${incoming ? 'text-threat-ink' : 'text-bone'}`}>
              {shown.arrival <= now && shown.engages
                ? t('pendingStrip.engaging')
                : countdown(shown.arrival - now)}
            </span>
            {items.length > 1 && (
              <span className="num text-label text-faint">
                {t('pendingStrip.more', { count: items.length - 1 })}
              </span>
            )}
            <span aria-hidden className="text-faint">⌃</span>
          </span>
        ) : (
          <span className="flex items-center justify-between gap-2">
            <span className="legend text-faint">{t('pendingStrip.empty')}</span>
            <span aria-hidden className="text-faint">⌃</span>
          </span>
        )}
      </button>

      {open && (
        <Sheet
          eyebrow={t('pendingStrip.sheetEyebrow')}
          title={t('pendingStrip.sheetTitle')}
          onClose={() => { setOpen(false); }}
        >
          <FlightList
            onFocus={(focus) => { onFocus?.(focus); }}
            onDone={() => { setOpen(false); }}
          />
        </Sheet>
      )}
    </>
  );
}

/**
 * THE FLIGHT ROSTER: each row focusable where there is something to look at, and
 * the recall on the rows that can still be called back. `onDone` closes whatever
 * sheet holds the list before the camera moves.
 */
export function FlightList({ onFocus, onDone }: { onFocus: (focus: StripFocus) => void; onDone: () => void }) {
  const { t } = useTranslation();
  const { items, now } = useAirborne();
  const recall = useRecallMining();
  const recallFleet = useRecallFlight();
  const say = useToast();

  return (
    <>
    {items.length === 0 ? (
      <p className="pt-2 text-body text-dim">{t('pendingStrip.sheetEmpty')}</p>
    ) : (
      <div className="space-y-2 pt-2">
        {items.map((item) => {
          const focus = item.focus;
          const body = (
            <>
              <Mark of={item.mark} incoming={item.incoming} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="name min-w-0 flex-1 truncate text-bone">
                    {item.title}
                  </span>
                  <span
                    className={`num shrink-0 text-caption ${
                      item.incoming ? 'text-threat-ink' : 'text-crystal'
                    }`}
                  >
                    {countdown(item.arrival - now)}
                  </span>
                </span>
                {/*
                  THE JOURNEY, UNDER THE NAME AND ACROSS THE FULL ROW.

                  "12m" is the same string for a fleet two minutes from a
                  target and a fleet two minutes from home carrying the
                  loot, and those are opposite situations. The leg says
                  which, so the countdown finally means one thing.
                */}
                <span className="mt-1.5 block">
                  <FlightBar
                    progress={legProgress(item.span, now)}
                    direction={
                      item.incoming ? 'incoming' : item.leg === 'return' ? 'back' : 'out'
                    }
                    tone={item.incoming ? 'threat' : 'crystal'}
                  />
                </span>
                <span className="mt-1 block text-label text-faint">{item.detail}</span>
              </span>
              {focus && <span aria-hidden className="self-center text-faint">›</span>}
            </>
          );
          /*
            THE SAME ROW, FOR THE SAME ACT. A commander who has learned to pull a drill back
            should not have to learn a second control to pull a squadron back, so the fleet
            recall wears the Prospector recall's shape — one glyph, one label, one tap, on
            the screen they are already looking at when a raid is inbound.
          */
          const recallMission = item.recallMission;
          if (recallMission) {
            return (
              <div key={item.key} className="plate flex min-h-14 w-full items-stretch">
                <button
                  type="button"
                  onClick={() => {
                    onDone();
                    if (focus) onFocus(focus);
                  }}
                  className="flex min-w-0 flex-1 items-start gap-2 px-3 py-3 text-left transition-colors hover:bg-bone/[0.03] active:bg-raised/60"
                >
                  {body}
                </button>
                <button
                  type="button"
                  aria-label={t('pendingStrip.recallFleet')}
                  disabled={recallFleet.isPending}
                  onClick={() => {
                    recallFleet.mutate(recallMission, {
                      onSuccess: () => { say(t('pendingStrip.recallFleetStarted')); },
                      onError: (error) => { say(describe(error), 'error'); },
                    });
                  }}
                  className="flex min-w-20 shrink-0 flex-col items-center justify-center gap-1 border-l border-line-soft px-3 text-label text-alloy transition-colors hover:bg-alloy/[0.06] disabled:opacity-50"
                >
                  <ReturnedIcon className="size-4" />
                  {recallFleet.isPending
                    ? t('pendingStrip.recallingFleet')
                    : t('pendingStrip.recallFleet')}
                </button>
              </div>
            );
          }
          const recallInput = item.recall;
          if (recallInput) {
            return (
              <div key={item.key} className="plate flex min-h-14 w-full items-stretch">
                <button
                  type="button"
                  onClick={() => {
                    onDone();
                    if (focus) onFocus(focus);
                  }}
                  className="flex min-w-0 flex-1 items-start gap-2 px-3 py-3 text-left transition-colors hover:bg-bone/[0.03] active:bg-raised/60"
                >
                  {body}
                </button>
                <button
                  type="button"
                  aria-label={t('pendingStrip.recallProspectors')}
                  disabled={recall.isPending}
                  onClick={() => {
                    recall.mutate(recallInput, {
                      onSuccess: () => {
                        say(t('pendingStrip.recallStarted'));
                      },
                      onError: (error) => {
                        say(describe(error), 'error');
                      },
                    });
                  }}
                  className="flex min-w-20 shrink-0 flex-col items-center justify-center gap-1 border-l border-line-soft px-3 text-label text-alloy transition-colors hover:bg-alloy/[0.06] disabled:opacity-50"
                >
                  <ReturnedIcon className="size-4" />
                  {recall.isPending
                    ? t('pendingStrip.recallingProspectors')
                    : t('pendingStrip.recallProspectors')}
                </button>
              </div>
            );
          }
          return focus ? (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                onDone();
                onFocus(focus);
              }}
              className="plate flex min-h-14 w-full items-start gap-2 px-3 py-3 text-left transition-colors hover:bg-bone/[0.03] active:bg-raised/60"
            >
              {body}
            </button>
          ) : (
            <div key={item.key} className="plate flex min-h-14 items-start gap-2 px-3 py-3">
              {body}
            </div>
          );
        })}
      </div>
    )}
    </>
  );
}

const MARK: Record<FlightMark, (props: { className?: string }) => ReactNode> = {
  unknown_signal: ScanIcon,
  monument: AttackIcon,
  fleet: AttackIcon,
  probe: ScanIcon,
  incoming: IncomingIcon,
  transfer: SendIcon,
  settlement: HomeworldIcon,
  death_star: WarBannerIcon,
  radiation_bomb: WarBannerIcon,
  mining: DrillIcon,
  salvage: DrillIcon,
  // A pirate raid IS a raid: same glyph, because the act is the same act and a
  // second symbol would say it is a different kind of commitment. D150.
  pirate: AttackIcon,
  // A convoy IS a transfer: cargo leaving a world under escort. Same reasoning as
  // the pirate line above — the glyph names the ACT, not the destination. D156.
  trade: SendIcon,
  intergalactic_convoy: AttackIcon,
};

/**
 * ONE GLYPH IN A WELL, and the well is what makes it read as a subject rather
 * than as decoration. An inbound attack is the only one that takes threat red,
 * because it is the only one being done TO the commander.
 */
function Mark({ of, incoming }: { of: FlightMark; incoming: boolean }) {
  const Glyph = MARK[of];
  return (
    <span
      aria-hidden
      data-flight-mark-kind={of}
      className={`socket grid size-8 shrink-0 place-items-center rounded-control ${
        incoming ? 'socket-threat text-threat-ink' : 'text-dim'
      }`}
    >
      <Glyph className="size-4" />
    </span>
  );
}
