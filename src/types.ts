export interface HistoricalData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  // Computed technical indicators
  ma5?: number;
  ma20?: number;
  ma60?: number;
  bbUpper?: number;
  bbLower?: number;
  rsi?: number;
  macdLine?: number;
  macdSignal?: number;
  macdHist?: number;
  k?: number;
  d?: number;
  volMa5?: number;
}

export interface KeyLevels {
  res_1: string;
  res_2: string;
  sup_1: string;
  sup_2: string;
  ma5: string;
  ma20: string;
  ma60: string;
}

export interface InsideAnalyst {
  consensus: string;
  target_bhs: string;
  mspr: number;
  net_shares: string;
  inst_hold: string;
  short_float: string;
}

export interface MultiPeriod {
  daily: string;
  weekly: string;
  monthly: string;
  d20_high: string;
  d20_low: string;
  d60_high: string;
  dist_60d: string;
}

export interface ScoreBreakdown {
  trend: number;
  momentum: number;
  fund: number;
  risk: number;
  remarks: string[];
}

export interface Fundamentals {
  rev_ttm: string;
  rev_qoq: string;
  rev_qoq_raw: number;
  eps_ttm: string;
  roe: string;
  roa: string;
  peg: string;
  pb: string;
  div: string;
  margin: string;
}

export interface IndicatorSignals {
  trend: string;
  macd: string;
  kd: string;
  rsi: string;
  win_pct: string;
}

export interface StockQueryResponse {
  ticker: string;
  companyName: string;
  latestPrice: number;
  priceChange: number;
  priceChangePercent: number;
  key_levels: KeyLevels;
  inside_analyst: InsideAnalyst;
  multi_period: MultiPeriod;
  breakdown: ScoreBreakdown;
  fundamentals: Fundamentals;
  indicators: IndicatorSignals;
  chart_data: HistoricalData[];
  ai_analysis?: string;
  error?: string;
}
