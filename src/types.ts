export type SignalAction = 'buy' | 'sell' | 'hold';
export type MarketType = 'spot' | 'futures';

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Signal {
  action: SignalAction;
  symbol: string;
  strategy: string;
  confidence: number; // 0-1
  price: number;
  timestamp: number;
  marketType: MarketType;
}

export interface StrategyParams {
  [key: string]: number | string | boolean;
}
