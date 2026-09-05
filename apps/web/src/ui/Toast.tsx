import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { describeError } from '../i18n/errors.js';
import { CloseIcon, RaidedIcon } from './icons/index.js';

type Tone = 'info' | 'error';
interface Message {
  id: number;
  text: string;
  tone: Tone;
}

const ToastContext = createContext<((text: string, tone?: Tone) => void) | null>(null);

/**
 * How long one line holds the slot before the next may have it.
 *
 * EXPORTED so the tests can express the queue's RULE — "the first has had its
 * turn and handed over" — rather than a millisecond count that has to be edited
 * every time this is tuned. A test that hard-codes the number goes red on a
 * change of pacing and says nothing about the behaviour it exists to protect.
 */
export const DWELL_MS = 2400;
export const ERROR_DWELL_MS = 6000;

let sequence = 0;

/**
 * One line, bottom of the screen, gone in four seconds.
 *
 * Refusals are the main thing that lands here, and a refusal must say what to do
 * next — the API writes them that way ("Command Core must be raised first") and
 * the client's own catalogue is written to the same rule, keyed by the API's code
 * so the sentence can be said in either language. See `i18n/errors.ts`.
 *
 * IT IS A QUEUE, BECAUSE IT WAS A SINGLE SLOT. D45.
 *
 * `setMessage` overwrote whatever was on screen, so two things happening at once
 * showed one of them — and because a caller looping over a batch overwrites on
 * every iteration, the one that survived was whichever was written LAST. A player
 * whose raid landed in the same second their fleet came home saw exactly one of
 * those facts, chosen by array order.
 *
 * Messages queue and are shown in the order they were said. The dwell timer keys
 * on the HEAD's id rather than on the array, so a message arriving behind the
 * current one does not restart its four seconds.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [queue, setQueue] = useState<Message[]>([]);
  const message = queue[0] ?? null;

  const say = useCallback((text: string, tone: Tone = 'info') => {
    sequence += 1;
    setQueue((current) => [...current, { id: sequence, text, tone }]);
  }, []);

  const head = message?.id;
  const dwell = message?.tone === 'error' ? ERROR_DWELL_MS : DWELL_MS;
  useEffect(() => {
    if (head === undefined) return;
    const id = setTimeout(() => {
      setQueue((current) => current.slice(1));
    }, dwell);
    return () => {
      clearTimeout(id);
    };
  }, [dwell, head]);

  return (
    <ToastContext.Provider value={say}>
      {children}
      {message && (
        <div
          role="status"
          aria-live={message.tone === 'error' ? 'assertive' : 'polite'}
          /**
           * LIFTED OVER WHATEVER IS ALREADY SPEAKING. D56.
           *
           * The onboarding card sits along the bottom edge and is taller than the
           * gap this used to leave, so a toast landed across the middle of the
           * sentence telling the player what to do next. The card publishes its own
           * height as `--toast-lift` while it is mounted; everywhere else the
           * variable is absent and the original offset stands.
           */
          className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--toast-lift,112px)+env(safe-area-inset-bottom))] z-50 flex justify-center px-2"
        >
          {/*
            A REFUSAL LOOKS LIKE A REFUSAL, AND IT USED TO LOOK LIKE THE WEATHER.

            The error variant differed from the informational one by a slightly
            pink text colour and `border-alert/50` — which drew nothing at all,
            because `.plate` builds its edge from `box-shadow` and carries no
            border width, so a border COLOUR is a declaration the browser drops in
            silence. The one signal in the game that says "that did not happen"
            was a two-shade difference inside a sentence.

            It is a plate lit in the threat colour with a mark on it now, which is
            the grammar every other state in this interface already uses: hue for
            the category, light for the fact that it is on right now.
          */}
          <div
            key={message.id}
            role={message.tone === 'error' ? 'alert' : undefined}
            className={`plate pointer-events-auto flex max-w-sm items-center gap-2 px-3 py-3 text-body ${
              message.tone === 'error' ? 'plate-threat text-threat-ink' : 'text-bone'
            }`}
          >
            {message.tone === 'error' && (
              <span
                aria-hidden
                className="grid size-7 shrink-0 place-items-center rounded-full bg-threat/25 text-threat-ink"
              >
                <RaidedIcon className="size-4" />
              </span>
            )}
            <p className="min-w-0 flex-1">{message.text}</p>
            <button
              type="button"
              aria-label={t('toast.dismiss')}
              className="flex size-10 shrink-0 items-center justify-center rounded-chip text-current/75 hover:bg-raised hover:text-current"
              onClick={() => { setQueue((current) => current.slice(1)); }}
            >
              <CloseIcon className="size-5" />
            </button>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): (text: string, tone?: Tone) => void {
  const say = useContext(ToastContext);
  if (!say) throw new Error('useToast called outside ToastProvider');
  return say;
}

/**
 * Every refusal the player sees comes through here, so none of them leak a stack
 * — and none of them arrive in the wrong language.
 *
 * The API answers with a stable code and the figures the sentence was built from;
 * `describeError` turns that back into a sentence in whichever language is up.
 * The server's own English is the fallback for a code this build has never heard
 * of, which is exactly what a phone one deploy behind the server needs.
 */
export const describe = (err: unknown): string => describeError(err);
