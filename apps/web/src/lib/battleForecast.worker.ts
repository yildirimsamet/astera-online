import { calculateBattleForecast, type BattleForecastRequest } from './battleForecast.js';

self.addEventListener('message', (event: MessageEvent<BattleForecastRequest>) => {
  self.postMessage(calculateBattleForecast(event.data));
});
