import { describe, it, expect, afterEach } from 'vitest';
import { runBacktest, DEFAULT_FEE_RATE, DEFAULT_SLIPPAGE_RATE } from '../src/backtest/index.js';
import { strategies, type Strategy } from '../src/strategies/index.js';
import type { Candle, SignalAction } from '../src/types.js';

const ENTRY = 21;
const EXIT = 23;

/** Close is 100 at the entry candle and 110 at the exit candle. */
function candles(): Candle[] {
  return Array.from({ length: 25 }, (_, i) => {
    const close = i >= EXIT ? 110 : 100;
    return { timestamp: i, open: close, high: close, low: close, close, volume: 1 };
  });
}

function scripted(entry: SignalAction, exit: SignalAction): void {
  (strategies as Record<string, Strategy>).__scripted__ = {
    id: '__scripted__', name: 'scripted', defaultParams: {}, defaultInterval: '1m',
    analyze(c, _p, symbol, marketType) {
      const t = c.at(-1)!.timestamp;
      const action = t === ENTRY ? entry : t === EXIT ? exit : 'hold';
      return { action, symbol, marketType, strategy: '__scripted__', confidence: 1, price: c.at(-1)!.close, timestamp: t };
    },
  };
}

function run(costs: { feeRate?: number; slippageRate?: number }) {
  return runBacktest({ strategyId: '__scripted__', candles: candles(), symbol: 'BTC/USDT', marketType: 'futures', tradeAmount: 100, params: {}, ...costs });
}

afterEach(() => { delete (strategies as Record<string, Strategy>).__scripted__; });

describe('Backtest costs', () => {
  it('gives the gross result when the costs are zero', () => {
    scripted('buy', 'sell');
    const [trade] = run({ feeRate: 0, slippageRate: 0 }).trades;
    expect(trade.pnl).toBeCloseTo(10);
    expect(trade.fees).toBe(0);
  });

  it('removes the fee for the entry and the exit from a long trade', () => {
    scripted('buy', 'sell');
    const [trade] = run({ feeRate: 0.001, slippageRate: 0 }).trades;
    // Entry fee: 100 * 0.1% = 0.10. Exit value is 110, so the exit fee is 0.11.
    expect(trade.fees).toBeCloseTo(0.21);
    expect(trade.pnl).toBeCloseTo(9.79);
  });

  it('fills a long trade above the close and exits below the close', () => {
    scripted('buy', 'sell');
    const [trade] = run({ feeRate: 0, slippageRate: 0.01 }).trades;
    expect(trade.entryPrice).toBeCloseTo(101);
    expect(trade.exitPrice).toBeCloseTo(108.9);
    expect(trade.pnl).toBeCloseTo((108.9 - 101) * (100 / 101));
  });

  it('fills a short trade below the close and exits above the close', () => {
    scripted('sell', 'buy');
    const [trade] = run({ feeRate: 0, slippageRate: 0.01 }).trades;
    expect(trade.entryPrice).toBeCloseTo(99);
    expect(trade.exitPrice).toBeCloseTo(111.1);
    expect(trade.pnl).toBeCloseTo((99 - 111.1) * (100 / 99));
  });

  it('applies the default costs when the input does not set them', () => {
    scripted('buy', 'sell');
    const withDefaults = run({}).trades[0];
    const explicit = run({ feeRate: DEFAULT_FEE_RATE, slippageRate: DEFAULT_SLIPPAGE_RATE }).trades[0];
    expect(withDefaults.pnl).toBe(explicit.pnl);
    expect(withDefaults.pnl).toBeLessThan(10);
  });

  it('removes the costs from the total return and the equity', () => {
    scripted('buy', 'sell');
    const result = run({ feeRate: 0.001, slippageRate: 0 });
    expect(result.totalReturn).toBeCloseTo(9.79);
    expect(result.equity.at(-1)!.value).toBeCloseTo(1009.79);
  });

  it.each([-0.1, 1, Number.NaN])('rejects the rate %s', (rate) => {
    scripted('buy', 'sell');
    expect(() => run({ feeRate: rate })).toThrow('feeRate');
    expect(() => run({ slippageRate: rate })).toThrow('slippageRate');
  });
});

describe('Backtest performance', () => {
  function wave(n: number): Candle[] {
    return Array.from({ length: n }, (_, i) => {
      const p = 100 + Math.sin(i / 15) * 10;
      return { timestamp: i * 60_000, open: p, high: p + 1, low: p - 1, close: p, volume: 1 };
    });
  }

  it('passes each strategy call a bounded window, like the live bot', () => {
    const sizes: number[] = [];
    (strategies as Record<string, Strategy>).__scripted__ = {
      id: '__scripted__', name: 'spy', defaultParams: {}, defaultInterval: '1m',
      analyze: (c, _p, symbol, marketType) => { sizes.push(c.length); return { action: 'hold', confidence: 0, price: 0, symbol, marketType, strategy: '__scripted__', timestamp: 0 }; },
    };
    runBacktest({ strategyId: '__scripted__', candles: wave(5000), symbol: 'BTC/USDT', marketType: 'spot', tradeAmount: 100, params: {} });
    expect(Math.max(...sizes)).toBeLessThanOrEqual(100);
  });

  // The O(n^2) version took about 126 s. The limit has margin for a loaded CI machine.
  it('runs 43,000 one-minute candles (30 days) in under 5 seconds', () => {
    const t0 = performance.now();
    runBacktest({ strategyId: 'rsi', candles: wave(43_000), symbol: 'BTC/USDT', marketType: 'spot', tradeAmount: 100, params: { period: 14, oversold: 30, overbought: 70 } });
    expect(performance.now() - t0).toBeLessThan(5000);
  });
});
