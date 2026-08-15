import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

type Tone = 'info' | 'error';
interface Message {
  id: number;
  text: string;
  tone: Tone;
}

const ToastContext = createContext<((text: string, tone?: Tone) => void) | null>(null);

/**
 * One line, bottom of the screen, gone in four seconds.
 *
 * Refusals are the main thing that lands here, and a refusal must say what to do
 * next — the API already writes them that way ("Command Core must be raised
 * first"), so this shows the server's sentence rather than inventing one.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<Message | null>(null);

  const say = useCallback((text: string, tone: Tone = 'info') => {
    setMessage({ id: Date.now(), text, tone });
  }, []);

  useEffect(() => {
    if (!message) return;
    const id = setTimeout(() => {
      setMessage(null);
    }, 4000);
    return () => {
      clearTimeout(id);
    };
  }, [message]);

  return (
    <ToastContext.Provider value={say}>
      {children}
      {message && (
        <div
          role="status"
          className="pointer-events-none fixed inset-x-0 bottom-[calc(112px+env(safe-area-inset-bottom))] z-50 flex justify-center px-4"
        >
          <p
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
