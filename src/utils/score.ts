import { HistoricalData } from '../types';

/**
 * Compute a composite score (0-100) for a given day based on technical indicators.
 * Mirrors the logic used in the backend scoring.
 */
export function computeScore(data: HistoricalData): number {
  let trend = 0;
  if (data.ma5 !== undefined && data.close > data.ma5) trend += 10;
  if (data.ma5 !== undefined && data.ma20 !== undefined && data.ma5 > data.ma20) trend += 10;
  if (data.ma20 !== undefined && data.ma60 !== undefined && data.ma20 > data.ma60) trend += 10;

  let momentum = 0;
  if (data.rsi !== undefined) {
    if (data.rsi >= 50 && data.rsi <= 70) momentum += 10;
    else if (data.rsi > 30 && data.rsi < 50) momentum += 5;
    else if (data.rsi <= 30) momentum += 10;
    else if (data.rsi > 70) momentum += 3;
  }
  if (data.macdHist !== undefined && data.macdHist > 0) momentum += 10;
  else if (data.macdHist !== undefined && data.macdHist < 0) momentum += 5;

  let fundamentals = 0;
  // Optional fields for fundamentals; add modest points if present.
  if ((data as any).peg !== undefined) fundamentals += 5;
  if ((data as any).pb !== undefined) fundamentals += 3;
  if ((data as any).roe !== undefined) fundamentals += 5;
  if ((data as any).revGrowth !== undefined) fundamentals += 5;
  if ((data as any).margin !== undefined) fundamentals += 3;

  let risk = 10;
  if ((data as any).beta !== undefined) {
    const beta = (data as any).beta;
    if (beta > 1.5) risk -= 4;
    else if (beta > 1.2) risk -= 2;
  }
  if ((data as any).debtToEquity !== undefined) {
    const dte = (data as any).debtToEquity;
    if (dte > 100) risk -= 3;
    else if (dte > 50) risk -= 1;
  }

  const total = Math.min(100, Math.max(0, Math.round(trend + momentum + fundamentals + risk)));
  return total;
}
