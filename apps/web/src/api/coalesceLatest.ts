/** How long a burst of chat read marks waits to become one write (F1.8 Q16). */
export const CHAT_READ_COALESCE_MS = 2_500;

/**
 * One call at once, then at most one per window, carrying the newest argument; every
 * call that arrived in the window shares that call's result. Only for calls whose
 * newest argument supersedes the older ones, like a read cursor that only moves forward.
 */
export function coalesceLatest<A, R>(
  send: (arg: A) => Promise<R>,
  windowMs: number,
): ((arg: A) => Promise<R>) & { queued: () => boolean } {
  let quietUntil = -Infinity;
  let queued: { arg: A; result: Promise<R> } | null = null;
  const call = (arg: A): Promise<R> => {
    if (queued) {
      queued.arg = arg;
      return queued.result;
    }
    const now = Date.now();
    if (now >= quietUntil) {
      quietUntil = now + windowMs;
      return send(arg);
    }
    const entry: { arg: A; result: Promise<R> } = {
      arg,
      result: new Promise<void>((resolve) => { setTimeout(resolve, quietUntil - now); }).then(() => {
        queued = null;
        quietUntil = Date.now() + windowMs;
        return send(entry.arg);
      }),
    };
    queued = entry;
    return entry.result;
  };
  return Object.assign(call, { queued: () => queued !== null });
}
