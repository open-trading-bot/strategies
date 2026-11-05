import type { Candle, MarketType, StrategyParams } from '../types.js';
import { getStrategy } from '../strategies/index.js';

/** Fee for each side of a trade, as a fraction of the traded value. 0.001 is 0.1%. */
export const DEFAULT_FEE_RATE = 0.001;
/** Price movement against the trade on each fill, as a fraction of the price. 0.0005 is 0.05%. */
export const DEFAULT_SLIPPAGE_RATE = 0.0005;

export interface BacktestInput {
  strategyId: string;
  candles: Candle[];
  symbol: string;
  marketType: MarketType;
  tradeAmount: number;
  params: StrategyParams;
  /** Default: DEFAULT_FEE_RATE. */
  feeRate?: number;
  /** Default: DEFAULT_SLIPPAGE_RATE. */
  slippageRate?: number;
}
export interface BacktestTrade {
  /** Fill price, after slippage. */
  entryPrice: number;
  /** Fill price, after slippage. */
  exitPrice: number;
  side: 'buy' | 'sell';
  /** Profit or loss, after fees and slippage. */
  pnl: number;
  pnlPct: number;
  /** Fees for the entry and the exit. */
  fees: number;
  entryTime: number;
  exitTime: number;
}
export interface BacktestResult {
  trades: BacktestTrade[]; totalReturn: number; winRate: number; maxDrawdown: number; sharpeRatio: number; equity: { timestamp: number; value: number }[];
}

interface Position { side: 'buy' | 'sell'; entryPrice: number; quantity: number; entryTime: number }

function checkRate(name: string, rate: number): void {
  if (!Number.isFinite(rate) || rate < 0 || rate >= 1) throw new Error(`${name} must be a number from 0 to less than 1`);
}

/** A buy fills above the candle close and a sell fills below it. */
function fillPrice(close: number, orderSide: 'buy' | 'sell', slippageRate: number): number {
  return orderSide === 'buy' ? close * (1 + slippageRate) : close * (1 - slippageRate);
}

function closeTrade(position: Position, close: number, exitTime: number, tradeAmount: number, feeRate: number, slippageRate: number): BacktestTrade {
  const exitPrice = fillPrice(close, position.side === 'buy' ? 'sell' : 'buy', slippageRate);
  const gross = position.side === 'buy'
    ? (exitPrice - position.entryPrice) * position.quantity
    : (position.entryPrice - exitPrice) * position.quantity;
  const fees = tradeAmount * feeRate + exitPrice * position.quantity * feeRate;
  const pnl = gross - fees;
  return {
    entryPrice: position.entryPrice, exitPrice, side: position.side,
    pnl, pnlPct: (pnl / tradeAmount) * 100, fees,
    entryTime: position.entryTime, exitTime,
  };
}

function calculateStats(trades: BacktestTrade[]): { totalReturn: number; winRate: number; sharpeRatio: number } {
  const wins = trades.filter((t) => t.pnl > 0).length;
  const totalReturn = trades.reduce((sum, t) => sum + t.pnl, 0);
  const returns = trades.map((t) => t.pnlPct);
  const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const stdDev = returns.length > 1
    ? Math.sqrt(returns.reduce((sum, r) => sum + (r - avgReturn) ** 2, 0) / (returns.length - 1))
    : 0;
  return {
    totalReturn,
    winRate: trades.length > 0 ? (wins / trades.length) * 100 : 0,
    sharpeRatio: stdDev > 0 ? avgReturn / stdDev : 0,
  };
}

/**
 * Candles that each strategy call sees. The live bot fetches 100 candles per
 * tick, so the backtest uses the same window. A full-history slice per candle
 * made the backtest O(n^2): 30 days of 1m candles blocked the event loop for
 * minutes.
 */
export const STRATEGY_WINDOW = 100;

export function runBacktest(input: BacktestInput): BacktestResult {
  const strategy = getStrategy(input.strategyId);
  if (!strategy) throw new Error(`Strategy ${input.strategyId} not found`);
  const feeRate = input.feeRate ?? DEFAULT_FEE_RATE;
  const slippageRate = input.slippageRate ?? DEFAULT_SLIPPAGE_RATE;
  checkRate('feeRate', feeRate);
  checkRate('slippageRate', slippageRate);
  const trades: BacktestTrade[] = [];
  const equity: { timestamp: number; value: number }[] = [];
  let balance = input.tradeAmount * 10;
  let position: Position | null = null;
  let peak = balance;
  let maxDrawdown = 0;

  for (let i = 20; i < input.candles.length; i++) {
    const slice = input.candles.slice(Math.max(0, i + 1 - STRATEGY_WINDOW), i + 1);
    const signal = strategy.analyze(slice, input.params, input.symbol, input.marketType);

    if (position && signal.action !== 'hold' && signal.action !== position.side) {
      const trade = closeTrade(position, input.candles[i].close, input.candles[i].timestamp, input.tradeAmount, feeRate, slippageRate);
      trades.push(trade);
      balance += trade.pnl;
      position = null;
    }

    if (!position && signal.action !== 'hold') {
      const side = signal.action as 'buy' | 'sell';
      const price = fillPrice(input.candles[i].close, side, slippageRate);
      position = { side, entryPrice: price, quantity: input.tradeAmount / price, entryTime: input.candles[i].timestamp };
    }

    equity.push({ timestamp: input.candles[i].timestamp, value: balance });
    if (balance > peak) peak = balance;
    const drawdown = peak > 0 ? ((peak - balance) / peak) * 100 : 0;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  const stats = calculateStats(trades);
  return { trades, equity, maxDrawdown, ...stats };
}
