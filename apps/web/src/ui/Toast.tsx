import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

type Tone = 'info' | 'error';
interface Message {
  id: number;
  text: string;
  tone: Tone;
}

const ToastContext = createContext<((text: string, tone?: Tone) => void) | null>(null);

/** Four seconds each, one at a time. */
const DWELL_MS = 4000;

let sequence = 0;

/**
 * One line, bottom of the screen, gone in four seconds.
 *
 * Refusals are the main thing that lands here, and a refusal must say what to do
 * next — the API already writes them that way ("Command Core must be raised
 * first"), so this shows the server's sentence rather than inventing one.
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
          className="pointer-events-none fixed inset-x-0 bottom-[calc(112px+env(safe-area-inset-bottom))] z-50 flex justify-center px-4"
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

/** Every refusal the player sees comes through here, so none of them leak a stack. */
export const describe = (err: unknown): string =>
  err instanceof Error ? err.message : 'Something went wrong';
