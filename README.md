# @open-trading-bot/strategies

[![npm](https://img.shields.io/npm/v/@open-trading-bot/strategies)](https://www.npmjs.com/package/@open-trading-bot/strategies)
[![CI](https://github.com/open-trading-bot/strategies/actions/workflows/ci.yml/badge.svg)](https://github.com/open-trading-bot/strategies/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Crypto trading strategies and a backtester. The package needs no server, database or exchange keys. You give it candles, and it gives you signals or backtest results.

Use it in a script, a notebook or your own bot. It includes MA crossover, RSI, MACD, Bollinger Bands and Wyckoff. Backtests include fees and slippage.

This package is the strategy code of [open-trading-bot](https://github.com/open-trading-bot/open-trading-bot).

> **Disclaimer:** Use this software only for education and research. It is **not financial advice**.
> Crypto trading has a high risk of loss. A good backtest result does not predict future results.
> You use this software at your own risk. The authors are not responsible for financial losses.

## Install

Requirements: Node.js 20 or later. The package is ESM only.

```bash
npm install @open-trading-bot/strategies
```

## Quick start

```js
import { runBacktest, getStrategy } from '@open-trading-bot/strategies';

// Synthetic candles for this example. Use real closed candles, oldest first.
const candles = Array.from({ length: 1000 }, (_, i) => {
  const close = 100 + Math.sin(i / 20) * 10 + i * 0.01;
  return { timestamp: i * 3_600_000, open: close, high: close + 1, low: close - 1, close, volume: 1000 };
});

const result = runBacktest({
  strategyId: 'rsi',
  candles,
  symbol: 'BTC/USDT',
  marketType: 'futures',
  tradeAmount: 100,
  params: getStrategy('rsi').defaultParams,
  feeRate: 0.001,       // 0.1% on each side
  slippageRate: 0.0005, // 0.05% on each fill
});

console.log({
  trades: result.trades.length,
  totalReturn: result.totalReturn.toFixed(2),
  winRate: result.winRate.toFixed(1),
  maxDrawdown: result.maxDrawdown.toFixed(2),
});
```

```text
{
  trades: 16,
  totalReturn: '-194.02',
  winRate: '6.3',
  maxDrawdown: '19.51'
}
```

This output comes from synthetic candles. It does not show how a strategy performs on a real market.

`totalReturn` and `pnl` use the same currency as `tradeAmount`. `winRate` and `maxDrawdown` are percentages.

## Get a signal

```ts
import { getStrategy } from '@open-trading-bot/strategies';

const rsi = getStrategy('rsi')!;
const signal = rsi.analyze(candles, rsi.defaultParams, 'BTC/USDT', 'spot');

console.log(signal.action, signal.confidence); // for example: buy 0.72
```

Remove the candle that is still open before you call `analyze`. Otherwise, the signal can change inside one candle.

## Strategies

| ID | Name |
|---|---|
| `ma_crossover` | Moving average crossover |
| `rsi` | RSI |
| `macd` | MACD |
| `bollinger` | Bollinger Bands |
| `wyckoff` | Wyckoff |

Each strategy has `defaultParams` and `defaultInterval`. To list the strategies, use `getAllStrategies()`.

## Fees and slippage

The backtester always applies costs, unless you set them to `0`.

| Input | Default | Effect |
|---|---|---|
| `feeRate` | `0.001` (0.1%) | The fee on the entry and on the exit. |
| `slippageRate` | `0.0005` (0.05%) | A buy fills above the close. A sell fills below the close. |

These defaults are estimates. Set the values for your exchange and your order size.

## Limits of the backtester

Read these limits before you trust a result.

- A trade fills at the close of the candle that gave the signal. A real order can fill only after that close.
- The backtester does not count a position that is still open at the last candle. Thus a loss on this position does not show in the result.
- The equity curve and `maxDrawdown` include closed trades only.
- `sharpeRatio` is calculated per trade. It is not an annual value.
- Each trade uses the same `tradeAmount`. The start balance is 10 times `tradeAmount`.
- A `sell` signal opens a short position, also for `spot`. Most spot markets do not let you do this.
- The backtester does not include stop loss, position limits, funding fees or liquidation.

## License

[MIT](LICENSE)
