// Runs all strategies on real BTC/USDT candles from the public Bybit API.
// It needs no API keys. It uses a fixed past period, so the result does not change.
import { runBacktest, getAllStrategies, DEFAULT_FEE_RATE, DEFAULT_SLIPPAGE_RATE } from '@open-trading-bot/strategies';

const SYMBOL = 'BTCUSDT';
const INTERVAL_MINUTES = 60;
const START = Date.UTC(2026, 6, 1); // 2026-07-01
const END = Date.UTC(2026, 9, 1); // 2026-10-01, not included
const TRADE_AMOUNT = 100;
const STEP = INTERVAL_MINUTES * 60_000;

async function fetchPage(start, end) {
  const query = new URLSearchParams({
    category: 'linear', symbol: SYMBOL, interval: String(INTERVAL_MINUTES), start: String(start), end: String(end), limit: '1000',
  });
  const response = await fetch(`https://api.bybit.com/v5/market/kline?${query}`);
  if (!response.ok) throw new Error(`Bybit returned HTTP ${response.status}. Bybit blocks some countries and networks.`);
  const body = await response.json();
  if (body.retCode !== 0) throw new Error(`Bybit returned an error: ${body.retMsg}`);
  return body.result.list;
}

async function fetchCandles() {
  const byTime = new Map();
  for (let start = START; start < END; start += 1000 * STEP) {
    const end = Math.min(start + 1000 * STEP, END) - 1;
    for (const [timestamp, open, high, low, close, volume] of await fetchPage(start, end)) {
      byTime.set(Number(timestamp), { timestamp: Number(timestamp), open: +open, high: +high, low: +low, close: +close, volume: +volume });
    }
  }
  const candles = [...byTime.values()].sort((a, b) => a.timestamp - b.timestamp);
  const expected = (END - START) / STEP;
  if (candles.length !== expected) throw new Error(`Expected ${expected} candles, but received ${candles.length}`);
  return candles;
}

function buyAndHold(candles) {
  const entry = candles[0].close * (1 + DEFAULT_SLIPPAGE_RATE);
  const exit = candles.at(-1).close * (1 - DEFAULT_SLIPPAGE_RATE);
  const quantity = TRADE_AMOUNT / entry;
  return (exit - entry) * quantity - TRADE_AMOUNT * DEFAULT_FEE_RATE - exit * quantity * DEFAULT_FEE_RATE;
}

const candles = await fetchCandles();
const rows = getAllStrategies().map((strategy) => {
  const result = runBacktest({
    strategyId: strategy.id, candles, symbol: 'BTC/USDT', marketType: 'futures', tradeAmount: TRADE_AMOUNT, params: strategy.defaultParams,
  });
  return {
    name: strategy.id,
    trades: String(result.trades.length),
    pnl: result.totalReturn.toFixed(2),
    win: `${result.winRate.toFixed(1)}%`,
    drawdown: `${result.maxDrawdown.toFixed(2)}%`,
  };
});
rows.push({ name: 'buy and hold', trades: '1', pnl: buyAndHold(candles).toFixed(2), win: '-', drawdown: '-' });

console.log(`${SYMBOL} perpetual, 1h candles, ${new Date(START).toISOString().slice(0, 10)} to ${new Date(END - 1).toISOString().slice(0, 10)} (${candles.length} candles)`);
console.log(`Trade amount: ${TRADE_AMOUNT}. Fee: ${DEFAULT_FEE_RATE * 100}% per side. Slippage: ${DEFAULT_SLIPPAGE_RATE * 100}% per fill.\n`);
console.log(`${'STRATEGY'.padEnd(14)}${'TRADES'.padStart(7)}${'PNL'.padStart(10)}${'WIN RATE'.padStart(10)}${'DRAWDOWN'.padStart(10)}`);
for (const r of rows) {
  console.log(`${r.name.padEnd(14)}${r.trades.padStart(7)}${r.pnl.padStart(10)}${r.win.padStart(10)}${r.drawdown.padStart(10)}`);
}
