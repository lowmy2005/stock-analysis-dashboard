import { HistoricalData } from '../types';

export function computeIndicators(data: HistoricalData[]): HistoricalData[] {
  if (!data || data.length === 0) return [];

  const closes = data.map(d => d.close);
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const volumes = data.map(d => d.volume);

  const len = data.length;

  // 1. Simple Moving Averages
  const ma5 = getSMA(closes, 5);
  const ma20 = getSMA(closes, 20);
  const ma60 = getSMA(closes, 60);
  const volMa5 = getSMA(volumes, 5);

  // 2. Bollinger Bands (20 days)
  const bbUpper: (number | undefined)[] = Array(len).fill(undefined);
  const bbLower: (number | undefined)[] = Array(len).fill(undefined);
  for (let i = 0; i < len; i++) {
    if (ma20[i] !== undefined && i >= 19) {
      const slice = closes.slice(i - 19, i + 1);
      const mean = ma20[i]!;
      const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / 20;
      const stdDev = Math.sqrt(variance);
      bbUpper[i] = mean + 2 * stdDev;
      bbLower[i] = mean - 2 * stdDev;
    }
  }

  // 3. RSI (14 days)
  const rsi: (number | undefined)[] = Array(len).fill(undefined);
  if (len > 14) {
    const deltas = Array(len).fill(0);
    for (let i = 1; i < len; i++) {
      deltas[i] = closes[i] - closes[i - 1];
    }

    const gains = deltas.map(d => (d > 0 ? d : 0));
    const losses = deltas.map(d => (d < 0 ? -d : 0));

    // First averages are SMAs
    let avgGain = gains.slice(1, 15).reduce((a, b) => a + b, 0) / 14;
    let avgLoss = losses.slice(1, 15).reduce((a, b) => a + b, 0) / 14;

    if (avgLoss === 0) {
      rsi[14] = 100;
    } else {
      rsi[14] = 100 - 100 / (1 + avgGain / avgLoss);
    }

    // Wilder's smoothed EMA: alpha = 1 / 14
    for (let i = 15; i < len; i++) {
      avgGain = avgGain + (gains[i] - avgGain) / 14;
      avgLoss = avgLoss + (losses[i] - avgLoss) / 14;

      if (avgLoss === 0) {
        rsi[i] = 100;
      } else {
        const rs = avgGain / avgLoss;
        rsi[i] = 100 - 100 / (1 + rs);
      }
    }
  }

  // 4. MACD (12, 26, 9)
  const ema12 = getEMA(closes, 12);
  const ema26 = getEMA(closes, 26);
  const macdLine: (number | undefined)[] = Array(len).fill(undefined);
  for (let i = 0; i < len; i++) {
    if (ema12[i] !== undefined && ema26[i] !== undefined) {
      macdLine[i] = ema12[i]! - ema26[i]!;
    }
  }

  // Signal line is EMA(9) of MACD line
  const macdSignal = getEMAOfNullable(macdLine, 9);
  const macdHist: (number | undefined)[] = Array(len).fill(undefined);
  for (let i = 0; i < len; i++) {
    if (macdLine[i] !== undefined && macdSignal[i] !== undefined) {
      macdHist[i] = macdLine[i]! - macdSignal[i]!;
    }
  }

  // 5. KD Stochastic (9, 3, 3)
  // RSV = (Close - Low_9) / (High_9 - Low_9) * 100
  // K = ewm(com=2), alpha = 1/3
  // D = ewm(com=2), alpha = 1/3
  const kVal: (number | undefined)[] = Array(len).fill(undefined);
  const dVal: (number | undefined)[] = Array(len).fill(undefined);

  if (len >= 9) {
    const rsv: (number | undefined)[] = Array(len).fill(undefined);
    for (let i = 8; i < len; i++) {
      const highSlice = highs.slice(i - 8, i + 1);
      const lowSlice = lows.slice(i - 8, i + 1);
      const maxHigh = Math.max(...highSlice);
      const minLow = Math.min(...lowSlice);

      if (maxHigh === minLow) {
        rsv[i] = 50; // default
      } else {
        rsv[i] = ((closes[i] - minLow) / (maxHigh - minLow)) * 100;
      }
    }

    // Compute K (ewm, alpha=1/3, starting at index 8)
    let prevK = 50; // seed
    const alpha = 1 / 3;
    for (let i = 8; i < len; i++) {
      if (rsv[i] !== undefined) {
        prevK = rsv[i]! * alpha + prevK * (1 - alpha);
        kVal[i] = prevK;
      }
    }

    // Compute D (ewm of K, alpha=1/3, starting at index 8)
    let prevD = 50; // seed
    for (let i = 8; i < len; i++) {
      if (kVal[i] !== undefined) {
        prevD = kVal[i]! * alpha + prevD * (1 - alpha);
        dVal[i] = prevD;
      }
    }
  }

  // Merge computed indicators back
  return data.map((d, i) => ({
    ...d,
    ma5: ma5[i],
    ma20: ma20[i],
    ma60: ma60[i],
    bbUpper: bbUpper[i],
    bbLower: bbLower[i],
    rsi: rsi[i],
    macdLine: macdLine[i],
    macdSignal: macdSignal[i],
    macdHist: macdHist[i],
    k: kVal[i],
    d: dVal[i],
    volMa5: volMa5[i],
  }));
}

// Helpers
function getSMA(vals: number[], period: number): (number | undefined)[] {
  const len = vals.length;
  const sma: (number | undefined)[] = Array(len).fill(undefined);
  let sum = 0;
  for (let i = 0; i < len; i++) {
    sum += vals[i];
    if (i >= period) {
      sum -= vals[i - period];
    }
    if (i >= period - 1) {
      sma[i] = sum / period;
    }
  }
  return sma;
}

function getEMA(vals: number[], period: number): (number | undefined)[] {
  const len = vals.length;
  const ema: (number | undefined)[] = Array(len).fill(undefined);
  if (len === 0) return ema;

  const alpha = 2 / (period + 1);
  ema[0] = vals[0]; // Seed first value

  for (let i = 1; i < len; i++) {
    ema[i] = vals[i] * alpha + ema[i - 1]! * (1 - alpha);
  }
  return ema;
}

function getEMAOfNullable(vals: (number | undefined)[], period: number): (number | undefined)[] {
  const len = vals.length;
  const ema: (number | undefined)[] = Array(len).fill(undefined);

  // Find first non-undefined
  let firstIdx = -1;
  for (let i = 0; i < len; i++) {
    if (vals[i] !== undefined) {
      firstIdx = i;
      break;
    }
  }

  if (firstIdx === -1) return ema;

  const alpha = 2 / (period + 1);
  ema[firstIdx] = vals[firstIdx];

  for (let i = firstIdx + 1; i < len; i++) {
    if (vals[i] !== undefined && ema[i - 1] !== undefined) {
      ema[i] = vals[i]! * alpha + ema[i - 1]! * (1 - alpha);
    } else if (vals[i] !== undefined) {
      ema[i] = vals[i];
    }
  }
  return ema;
}
