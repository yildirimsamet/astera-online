import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { describeError } from '../i18n/errors.js';

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
export const DWELL_MS = 750;

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
  const [queue, setQueue] = useState<Message[]>([]);
  const message = queue[0] ?? null;

  const say = useCallback((text: string, tone: Tone = 'info') => {
    sequence += 1;
    setQueue((current) => [...current, { id: sequence, text, tone }]);
  }, []);

  const head = message?.id;
  useEffect(() => {
    if (head === undefined) return;
    const id = setTimeout(() => {
      setQueue((current) => current.slice(1));
    }, DWELL_MS);
    return () => {
      clearTimeout(id);
    };
  }, [head]);

  return (
    <ToastContext.Provider value={say}>
      {children}
      {message && (
        <div
          role="status"
          /**
           * LIFTED OVER WHATEVER IS ALREADY SPEAKING. D56.
           *
           * The onboarding card sits along the bottom edge and is taller than the
           * gap this used to leave, so a toast landed across the middle of the
           * sentence telling the player what to do next. The card publishes its own
           * height as `--toast-lift` while it is mounted; everywhere else the
           * variable is absent and the original offset stands.
           */
          className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--toast-lift,112px)+env(safe-area-inset-bottom))] z-50 flex justify-center px-4"
        >
          <p
            key={message.id}
            className={`panel max-w-sm px-3.5 py-2.5 text-[13px] shadow-lg ${
              message.tone === 'error' ? 'border-alert/50 text-[#ffb9ae]' : 'text-bone'
            }`}
          >
            {message.text}
          </p>
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
