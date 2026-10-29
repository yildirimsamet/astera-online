export type StreamCloseReason = 'client' | 'error' | 'slow' | 'shutdown' | 'superseded';

export interface StreamLease {
  release(reason: StreamCloseReason): void;
}

export interface StreamStatus {
  active: number;
  opened: number;
  closed: number;
  slowClosed: number;
  shutdownClosed: number;
  supersededClosed: number;
  bytesWritten: number;
}

/**
 * One account's live streams in this process. Scaling plan F1.1 (M10).
 *
 * Every stream costs a fan-out delivery per galaxy event, so one account opening
 * tabs or scripts without limit multiplies that cost. The fourth closes the oldest
 * as `superseded`; the client then waits to be shown or focused before it returns,
 * so open tabs cannot keep closing each other. Per process: nginx spreads one
 * account's tabs over the API replicas, which bounds the total at three each.
 */
export const STREAMS_PER_ACCOUNT = 3;

interface Handlers {
  shutdown: () => void;
  superseded: () => void;
}

/** Tracks and drains hijacked SSE sockets without retaining closed responses. */
export class StreamRegistry {
  private readonly active = new Map<symbol, Handlers>();
  /** Insertion order is open order, so the first entry is always the oldest. */
  private readonly byAccount = new Map<string, Set<symbol>>();
  private opened = 0;
  private closed = 0;
  private slowClosed = 0;
  private shutdownClosed = 0;
  private supersededClosed = 0;
  private bytesWritten = 0;

  open(accountId: string, handlers: Handlers): StreamLease {
    const id = Symbol('stream');
    const mine = this.byAccount.get(accountId) ?? new Set<symbol>();
    this.byAccount.set(accountId, mine);
    const [oldest] = mine;
    if (oldest !== undefined && mine.size >= STREAMS_PER_ACCOUNT) this.active.get(oldest)?.superseded();
    this.active.set(id, handlers);
    mine.add(id);
    this.opened += 1;
    let released = false;
    return {
      release: (reason) => {
        if (released) return;
        released = true;
        this.active.delete(id);
        mine.delete(id);
        if (mine.size === 0 && this.byAccount.get(accountId) === mine) this.byAccount.delete(accountId);
        this.closed += 1;
        if (reason === 'slow') this.slowClosed += 1;
        if (reason === 'shutdown') this.shutdownClosed += 1;
        if (reason === 'superseded') this.supersededClosed += 1;
      },
    };
  }

  wrote(bytes: number): void {
    this.bytesWritten += Math.max(0, bytes);
  }

  drain(): void {
    for (const { shutdown } of [...this.active.values()]) shutdown();
  }

  status(): StreamStatus {
    return {
      active: this.active.size,
      opened: this.opened,
      closed: this.closed,
      slowClosed: this.slowClosed,
      shutdownClosed: this.shutdownClosed,
      supersededClosed: this.supersededClosed,
      bytesWritten: this.bytesWritten,
    };
  }
}
