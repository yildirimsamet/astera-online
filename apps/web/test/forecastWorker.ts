import { vi } from 'vitest';
import type { BattleForecastRequest, BattleForecastResult } from '../src/lib/battleForecast.js';
export class ControlledWorker {
  static instances: ControlledWorker[] = [];
  onmessage: ((event: MessageEvent<BattleForecastResult>) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  postMessage = vi.fn((_request: BattleForecastRequest) => undefined);
  terminate = vi.fn();
  constructor() { ControlledWorker.instances.push(this); }
  complete(value: BattleForecastResult = { lines: { clears: { low: 1, high: 2 }, breaks: { low: 3, high: 4 } }, loss: { low: .1, high: .2 } }) { this.onmessage?.(new MessageEvent('message', { data: value })); }
}
