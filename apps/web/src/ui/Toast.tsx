import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Banner, RoundButton, type GlyphId } from '../game-ui/index.js';
import { haptic } from '../lib/haptics.js';
import { playSound } from '../lib/sound.js';
import { describeError } from '../i18n/errors.js';

/** News; a "done, but" to read (the store kept some back); a refusal, or a threat. */
type Tone = 'info' | 'warn' | 'error';

/** Each tone's kit face: the colour of what it says, and its mark. */
const FACE: Record<Tone, { tone: 'info' | 'warn' | 'hostile'; glyph: GlyphId }> = {
  info: { tone: 'info', glyph: 'star' },
  warn: { tone: 'warn', glyph: 'warn' },
  error: { tone: 'hostile', glyph: 'warn' },
};
interface Message {
  id: number;
  text: string;
  tone: Tone;
}

const ToastContext = createContext<((text: string, tone?: Tone) => void) | null>(null);
const ToastSilenceContext = createContext<((keepErrors?: boolean) => () => void) | null>(null);

/** The Academy speaks in its coach, never over it. Drop messages, don't defer
 * them until exit; a returning commander must not receive practice toasts. */
export function useSilenceToasts(keepErrors = false): void {
  const silence = useContext(ToastSilenceContext);
  useLayoutEffect(() => silence?.(keepErrors), [silence, keepErrors]);
}

/**
 * How long one line holds the slot before the next may have it.
 *
 * EXPORTED so the tests can express the queue's RULE — "the first has had its
 * turn and handed over" — rather than a millisecond count that has to be edited
 * every time this is tuned. A test that hard-codes the number goes red on a
 * change of pacing and says nothing about the behaviour it exists to protect.
 */
export const DWELL_MS = 2400;
export const ERROR_DWELL_MS = 4000;

let sequence = 0;

/**
 * One line under the top bar, gone in a few seconds.
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
  const quiet = useRef(0);
  const quietInfo = useRef(0);
  const silence = useCallback((keepErrors = false) => {
    const counter = keepErrors ? quietInfo : quiet;
    counter.current += 1;
    setQueue(current => keepErrors ? current.filter(message => message.tone === 'error') : []);
    return () => { counter.current -= 1; };
  }, []);
  const message = queue[0] ?? null;

  const say = useCallback((text: string, tone: Tone = 'info') => {
    if (quiet.current > 0 || (tone !== 'error' && quietInfo.current > 0)) return;
    sequence += 1;
    setQueue((current) => [...current, { id: sequence, text, tone }]);
  }, []);

  const head = message?.id;
  const tone = message?.tone;
  // A warning asks to be read as a refusal does: it holds as long, and is felt in the hand.
  const dwell = tone === undefined || tone === 'info' ? DWELL_MS : ERROR_DWELL_MS;
  useEffect(() => {
    if (head === undefined || tone === undefined) return;
    playSound(tone === 'error' ? 'alert' : 'confirm');
    if (tone !== 'info') haptic('warn');
  }, [head, tone]);
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
    <ToastSilenceContext.Provider value={silence}><ToastContext.Provider value={say}>
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
          className="gk pointer-events-none fixed inset-x-[var(--gk-gutter)] top-[calc(var(--toast-lift,100px)+env(safe-area-inset-top))] z-[90] flex justify-center"
        >
          {/*
            A REFUSAL LOOKS LIKE A REFUSAL (G1-d3, 2026-11-14: the kit's toast). The rim and the
            mark take the colour of what it says — news in the info blue, a "done, but" in the
            warning amber, a refusal in the enemy's red — and the words stay in plain ink, so
            every one of them reads. Its key restarts the drop for each line in turn.
          */}
          <div key={message.id} className="pointer-events-auto w-full max-w-sm">
            <Banner
              variant="toast"
              tone={FACE[message.tone].tone}
              glyph={FACE[message.tone].glyph}
              role={message.tone === 'error' ? 'alert' : null}
              title={message.text}
              action={<RoundButton small glyph="close" label={t('toast.dismiss')} onPress={() => { setQueue((current) => current.slice(1)); }} />}
            />
          </div>
        </div>
      )}
    </ToastContext.Provider></ToastSilenceContext.Provider>
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
