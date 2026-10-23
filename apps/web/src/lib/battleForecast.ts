import { forecastLines, forecastLoss, type Fleet, type Forecast, type ForecastInput, type ForecastSpan } from '@astera/rules';

export interface BattleForecastRequest { wing: Fleet; input: ForecastInput; power: ForecastSpan }
export interface BattleForecastResult { lines: Forecast; loss: ForecastSpan }

/** The worker and the no-Worker fallback must use exactly the settlement engine. */
export function calculateBattleForecast(request: BattleForecastRequest): BattleForecastResult {
  return { lines: forecastLines(request.wing, request.input), loss: forecastLoss(request.wing, request.power, request.input) };
}
