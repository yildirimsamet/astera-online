export type StreamCloseReason = 'client' | 'error' | 'slow' | 'shutdown';

export interface StreamLease {
  release(reason: StreamCloseReason): void;
}

export interface StreamStatus {
  active: number;
  opened: number;
  closed: number;
  slowClosed: number;
  shutdownClosed: number;
  bytesWritten: number;
}

/** Tracks and drains hijacked SSE sockets without retaining closed responses. */
export class StreamRegistry {
  private readonly active = new Map<symbol, () => void>();
  private opened = 0;
  private closed = 0;
  private slowClosed = 0;
  private shutdownClosed = 0;
  private bytesWritten = 0;

  open(onShutdown: () => void): StreamLease {
    const id = Symbol('stream');
    this.active.set(id, onShutdown);
    this.opened += 1;
    let released = false;
    return {
      release: (reason) => {
        if (released) return;
        released = true;
        this.active.delete(id);
        this.closed += 1;
        if (reason === 'slow') this.slowClosed += 1;
        if (reason === 'shutdown') this.shutdownClosed += 1;
      },
    };
  }

  wrote(bytes: number): void {
    this.bytesWritten += Math.max(0, bytes);
  }

  drain(): void {
    for (const close of [...this.active.values()]) close();
  }

  status(): StreamStatus {
    return {
      active: this.active.size,
      opened: this.opened,
      closed: this.closed,
      slowClosed: this.slowClosed,
      shutdownClosed: this.shutdownClosed,
      bytesWritten: this.bytesWritten,
    };
  }
}
