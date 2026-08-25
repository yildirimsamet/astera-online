import type { PendingThread } from '../api/schemas.js';

/**
 * The mission's own id where there is one. D52.
 *
 * Own threads always carry an id. The fallback exists only for anonymous inbound
 * rows, which are never focusable, but keeps list rendering deterministic.
 */
export const threadKey = (thread: PendingThread, index: number): string =>
  thread.id ?? `${thread.kind}:${thread.leg ?? 'out'}:${thread.targetName}:${String(index)}`;
