import type { Candle, Signal, StrategyParams, MarketType } from '../types.js';

export interface Strategy {
  id: string;
  name: string;
  defaultParams: StrategyParams;
  defaultInterval: string;
  analyze(candles: Candle[], params: StrategyParams, symbol: string, marketType: MarketType): Signal;
}
