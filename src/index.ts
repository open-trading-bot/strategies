export type { Candle, MarketType, Signal, SignalAction, StrategyParams } from './types.js';
export { strategies, getStrategy, getAllStrategies, type Strategy } from './strategies/index.js';
export {
  runBacktest,
  DEFAULT_FEE_RATE,
  DEFAULT_SLIPPAGE_RATE,
  STRATEGY_WINDOW,
  type BacktestInput,
  type BacktestResult,
  type BacktestTrade,
} from './backtest/index.js';
