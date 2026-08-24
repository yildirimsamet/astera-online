import { Redis } from 'ioredis';

export interface RateLimitBackendStatus {
  mode: 'memory' | 'shared';
  status: string;
}

/** Optional shared store; local development keeps the plugin's in-memory store. */
export class RateLimitBackend {
  readonly client: Redis | null;

  constructor(url: string | undefined) {
    this.client = url
      ? new Redis(url, {
          connectionName: 'astera-rate-limit',
          lazyConnect: true,
          connectTimeout: 1000,
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
        })
      : null;
    // ioredis emits `error`; a listener prevents an outage becoming an uncaught
    // EventEmitter error. Request failures still reach fastify-rate-limit.
    this.client?.on('error', () => undefined);
  }

  async start(): Promise<void> {
    if (this.client?.status === 'wait') await this.client.connect();
  }

  async stop(): Promise<void> {
    if (!this.client) return;
    if (this.client.status === 'ready') {
      await this.client.quit();
      return;
    }
    this.client.disconnect(false);
  }

  status(): RateLimitBackendStatus {
    return this.client
      ? { mode: 'shared', status: this.client.status }
      : { mode: 'memory', status: 'ready' };
  }
}
