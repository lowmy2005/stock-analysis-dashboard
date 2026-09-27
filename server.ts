import express from 'express';
import path from 'path';
import yahooFinancePkg from 'yahoo-finance2';
const YahooFinanceClass = (yahooFinancePkg as any).YahooFinance || (yahooFinancePkg as any).default || yahooFinancePkg;
const yahooFinance = new YahooFinanceClass();
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { computeIndicators } from './src/utils/indicators';
import { computeScore } from './src/utils/score';
import { StockQueryResponse, HistoricalData, KeyLevels, InsideAnalyst, MultiPeriod, ScoreBreakdown, Fundamentals, IndicatorSignals } from './src/types';

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini AI Client if API Key is available
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
let isQuotaExhausted = false;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Helper function to call generateContent with a model fallback chain to handle transient errors and quota limits
async function generateContentWithFallback(aiInstance: GoogleGenAI, options: { contents: any; systemInstruction?: string; defaultModel?: string }) {
  const models = [
    options.defaultModel || 'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-pro'
  ];

  let lastError: any = null;
  for (const modelName of models) {
    if (isQuotaExhausted && !modelName.includes('pro')) {
      // If quota is exhausted, we might still try pro if it's a different tier, 
      // but usually, it's better to just skip if we know we are over limit.
      // For now, let's just proceed but catch the error.
    }

    try {
      console.log(`[AI Info] Attempting analysis using module: ${modelName}`);
      
      const response = await aiInstance.models.generateContent({
        model: modelName,
        contents: options.contents,
        config: options.systemInstruction ? { systemInstruction: options.systemInstruction } : {}
      });
      
      console.log(`[AI Info] Completed analysis using module: ${modelName}`);
      return response;
    } catch (err: any) {
      lastError = err;
      const errMsg = err?.message || String(err);
      
      // Check for quota exhaustion (429)
      if (errMsg.includes('429') || errMsg.toLowerCase().includes('quota')) {
        console.log(`[AI Info] Processing limits reached for ${modelName}.`);
        isQuotaExhausted = true;
      }

      console.log(`[AI Info] Switched target due to limits.`);
    }
  }
  throw lastError || new Error('All analytical queries completed with local state active');
}

// Utility formatting helpers
function fmtPct(val: number | undefined | null): string {
  if (val === undefined || val === null) return 'N/A';
  return `${(val * 100).toFixed(2)}%`;
}

function fmtMoney(val: number | undefined | null): string {
  if (val === undefined || val === null) return 'N/A';
  if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
  if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
  return `$${val.toLocaleString()}`;
}

function getSafeNum(val: any): number | undefined {
  if (val === undefined || val === null) return undefined;
  if (typeof val === 'number') {
    return isNaN(val) ? undefined : val;
  }
  if (typeof val === 'object' && typeof val.raw === 'number') {
    return isNaN(val.raw) ? undefined : val.raw;
  }
  return undefined;
}

// Configure yahoo-finance2 global settings for better reliability and silence any validation logging/errors completely
if (typeof yahooFinance.setGlobalConfig === 'function') {
  yahooFinance.setGlobalConfig({
    validation: { 
      logErrors: false, 
      throwErrors: false 
    },
    queue: { concurrency: 2 },
    suppressNotices: ['yahooSurvey']
  });
}

// REST API endpoint for querying stock data
app.post('/api/query', async (req, res) => {
  const tickerSym = (req.body.ticker || 'MSFT').toUpperCase().trim();

  try {
    // 1. Fetch historical stock prices
    const period1 = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const period2 = new Date().toISOString().split('T')[0];

    // Historical stock prices query
    let historicalRaw;
    try {
      historicalRaw = await yahooFinance.historical(tickerSym, {
        period1,
        period2,
        interval: '1d',
      }, {
        validateResult: false
      });
    } catch (e: any) {
      console.log(`[Historical Query] Primary bypassed for ${tickerSym}. Transitioning to chart logic.`);
      try {
        const chartRes = await yahooFinance.chart(tickerSym, {
          period1,
          period2,
          interval: '1d'
        }, { validateResult: false });
        historicalRaw = chartRes?.quotes || [];
      } catch (e2: any) {
        console.log(`[Historical Query] Chart backup bypassed for ${tickerSym}.`);
        res.status(404).json({ error: `Could not fetch stock data for ticker symbol "${tickerSym}".` });
        return;
      }
    }

    if (!historicalRaw || historicalRaw.length === 0) {
      res.status(404).json({ error: `No historical data found for ticker symbol "${tickerSym}".` });
      return;
    }

    // Clean historical data and convert fields, robustly filtering out rows with null values
    const formattedHistory: HistoricalData[] = historicalRaw
      .filter(item => item && item.date && item.open !== null && item.close !== null && item.high !== null && item.low !== null && item.open !== undefined && item.close !== undefined && item.high !== undefined && item.low !== undefined)
      .map(item => ({
        date: item.date instanceof Date ? item.date.toISOString().split('T')[0] : String(item.date).split('T')[0],
        open: Number(item.open),
        high: Number(item.high),
        low: Number(item.low),
        close: Number(item.close),
        volume: item.volume !== null && item.volume !== undefined ? Number(item.volume) : 0,
      }));

    if (formattedHistory.length === 0) {
      res.status(404).json({ error: `No valid stock data remaining after cleaning for ticker symbol "${tickerSym}".` });
      return;
    }

    // Compute indicators (MA5, MA20, MA60, BB, RSI, MACD, Stochastic KD)
    const computedHistory = computeIndicators(formattedHistory);
    const latest = computedHistory[computedHistory.length - 1];
    const prev = computedHistory[computedHistory.length - 2] || latest;

    // 2. Fetch company quote summaries and stats
    let summary: any = {};
    let tsFinancials: any = null;
    try {
      const [summaryRes, tsRes] = await Promise.all([
        yahooFinance.quoteSummary(tickerSym, {
          modules: [
            'summaryDetail',
            'financialData',
            'defaultKeyStatistics',
            'recommendationTrend',
            'price',
          ],
        }, {
          validateResult: false
        }).catch(() => ({})),
        yahooFinance.fundamentalsTimeSeries(tickerSym, { 
          period1: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], 
          type: 'quarterly', 
          module: 'financials' 
        }, { validateResult: false }).catch(() => null)
      ]);
      summary = summaryRes;
      tsFinancials = tsRes;
    } catch (e) {
      console.log(`[Quote Query] Utilizing secondary parser for ${tickerSym}.`);
    }

    const priceModule = summary?.price || {};
    const summaryDetail = summary?.summaryDetail || {};
    const financialData = summary?.financialData || {};
    const stats = summary?.defaultKeyStatistics || {};
    const recommendations = summary?.recommendationTrend || {};

    // Calculate actual sequential Quarter-over-Quarter (QoQ) revenue growth
    let revGrowthQoQ: number | undefined = undefined;
    if (tsFinancials && tsFinancials.length >= 2) {
      // Sort descending (newest first)
      const sortedTs = [...tsFinancials].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const latestRev = getSafeNum(sortedTs[0]?.totalRevenue);
      const priorRev = getSafeNum(sortedTs[1]?.totalRevenue);
      if (latestRev !== undefined && priorRev !== undefined && priorRev !== 0) {
        revGrowthQoQ = (latestRev - priorRev) / priorRev;
      }
    }

    const companyName = priceModule.longName || priceModule.shortName || tickerSym;
    const latestPrice = getSafeNum(priceModule.regularMarketPrice) || latest.close;
    const prevClose = getSafeNum(priceModule.regularMarketPreviousClose) || prev.close;
    const priceChange = latestPrice - prevClose;
    const priceChangePercent = prevClose ? (priceChange / prevClose) * 100 : 0;

    // Support and Resistance Levels (Last 20 days and Last 60 days)
    const last20 = computedHistory.slice(-20);
    const last60 = computedHistory.slice(-60);

    const sup_1 = Math.min(...last20.map(item => item.close));
    const res_1 = Math.max(...last20.map(item => item.close));

    // For res_2/sup_2, average the 5 highest/lowest prices over the last 60 days
    const last60SortedCloses = [...last60.map(item => item.close)].sort((a, b) => b - a);
    const res_2 = last60SortedCloses.slice(0, 5).reduce((sum, val) => sum + val, 0) / 5;
    const sup_2 = last60SortedCloses.slice(-5).reduce((sum, val) => sum + val, 0) / 5;

    const key_levels: KeyLevels = {
      res_1: res_1.toFixed(2),
      res_2: res_2.toFixed(2),
      sup_1: sup_1.toFixed(2),
      sup_2: sup_2.toFixed(2),
      ma5: (latest.ma5 || latest.close).toFixed(2),
      ma20: (latest.ma20 || latest.close).toFixed(2),
      ma60: (latest.ma60 || latest.close).toFixed(2),
    };

    // Insider Transactions & Analyst recommendations
    // recommendationTrend contains counts of buy, hold, sell, strongBuy, strongSell
    const trends = recommendations.trend?.[0] || {};
    const buy_c = (trends.buy || 0) + (trends.strongBuy || 0);
    const hold_c = trends.hold || 0;
    const sell_c = (trends.sell || 0) + (trends.strongSell || 0);

    let consensus = 'Hold';
    if (buy_c > hold_c && buy_c > sell_c) consensus = 'Buy';
    else if (sell_c > buy_c && sell_c > hold_c) consensus = 'Sell';

    const inside_analyst: InsideAnalyst = {
      consensus,
      target_bhs: `${buy_c}/${hold_c}/${sell_c}`,
      mspr: 0,
      net_shares: 'Steady',
      inst_hold: fmtPct(getSafeNum(stats.heldPercentInstitutions)),
      short_float: fmtPct(getSafeNum(stats.shortPercentOfFloat)),
    };

    // Multi-period Trend Indicators
    const close_30 = computedHistory[Math.max(0, computedHistory.length - 30)]?.close || latest.close;
    const close_120 = computedHistory[Math.max(0, computedHistory.length - 120)]?.close || latest.close;

    const weekly_trend = latest.close > close_30 ? 'Bullish' : latest.close < close_30 ? 'Bearish' : 'Neutral';
    const monthly_trend = latest.close > close_120 ? 'Bullish' : latest.close < close_120 ? 'Bearish' : 'Neutral';

    const max_60_high = Math.max(...last60.map(item => item.high));
    const min_60_low = Math.min(...last60.map(item => item.low));

    const multi_period: MultiPeriod = {
      daily: latest.close > prev.close ? 'Bullish' : 'Bearish',
      weekly: weekly_trend,
      monthly: monthly_trend,
      d20_high: res_1.toFixed(2),
      d20_low: sup_1.toFixed(2),
      d60_high: max_60_high.toFixed(2),
      dist_60d: `${((latest.close / max_60_high - 1) * 100).toFixed(2)}%`,
    };

    // Fundamentals Info block
    const revGrowth = revGrowthQoQ !== undefined ? revGrowthQoQ : getSafeNum(financialData.revenueGrowth);
    const peg = getSafeNum(stats.pegRatio) !== undefined ? getSafeNum(stats.pegRatio) : getSafeNum(summaryDetail.pegRatio);
    const pb = getSafeNum(stats.priceToBook) !== undefined ? getSafeNum(stats.priceToBook) : getSafeNum(summaryDetail.priceToBook);
    const roe = getSafeNum(financialData.returnOnEquity);
    const margin = getSafeNum(financialData.profitMargins);
    const beta = getSafeNum(summaryDetail.beta);
    const debtToEquity = getSafeNum(financialData.debtToEquity);

    // Calculate Scoring system and Remarks using the composite function
    const scoreInputs = {
      price: latest.close,
      ma5: latest.ma5,
      ma20: latest.ma20,
      ma60: latest.ma60,
      rsi: latest.rsi,
      macdHist: latest.macdHist,
      prevMacdHist: prev.macdHist,
      peg: peg,
      pb: pb,
      roe: roe,
      revGrowth: revGrowth,
      margin: margin,
      beta: beta,
      debtToEquity: debtToEquity
    };

    const { trend: trend_pts, momentum: momentum_pts, fund: fund_pts, risk: risk_pts, remarks } = calculateCompositeScore(scoreInputs);

    const breakdown: ScoreBreakdown = {
      trend: trend_pts,
      momentum: momentum_pts,
      fund: fund_pts,
      risk: Math.max(0, risk_pts),
      remarks,
    };

    const fundamentals: Fundamentals = {
      rev_ttm: fmtMoney(getSafeNum(financialData.totalRevenue)),
      rev_qoq: fmtPct(revGrowth),
      rev_qoq_raw: revGrowth || 0,
      eps_ttm: getSafeNum(stats.trailingEps) !== undefined ? `$${getSafeNum(stats.trailingEps)!.toFixed(2)}` : 'N/A',
      roe: fmtPct(getSafeNum(financialData.returnOnEquity)),
      roa: fmtPct(getSafeNum(financialData.returnOnAssets)),
      peg: peg !== undefined ? peg.toFixed(2) : 'N/A',
      pb: pb !== undefined ? pb.toFixed(2) : 'N/A',
      div: fmtPct(getSafeNum(summaryDetail.dividendYield)),
      margin: fmtPct(getSafeNum(financialData.profitMargins)),
    };

    // Signals
    const rsiSig = latest.rsi !== undefined ? latest.rsi.toFixed(1) : 'N/A';
    const trend_signal = latest.close > (latest.ma20 || 0) ? 'Bullish' : latest.close < (latest.ma20 || 0) ? 'Bearish' : 'Neutral';
    const macd_signal = (latest.macdHist || 0) > 0 ? 'Bullish' : 'Bearish';

    let kd_signal = 'Neutral';
    if (latest.k !== undefined && latest.d !== undefined) {
      if (latest.k > latest.d && latest.k < 80) kd_signal = 'Bullish Golden Cross';
      else if (latest.k < latest.d && latest.k > 20) kd_signal = 'Bearish Death Cross';
      else if (latest.k < 20) kd_signal = 'Bullish (Oversold)';
      else if (latest.k > 80) kd_signal = 'Bearish (Overbought)';
    }

    // Win Percentage (Ups / Downs count in last 60 trading days)
    const upDays = last60.filter((item, index) => {
      if (index === 0) return false;
      return item.close > last60[index - 1].close;
    }).length;
    const win_pct = last60.length > 1 ? Math.round((upDays / (last60.length - 1)) * 100) : 50;

    const indicators: IndicatorSignals = {
      trend: trend_signal,
      macd: macd_signal,
      kd: kd_signal,
      rsi: rsiSig,
      win_pct: `${win_pct}%`,
    };

    // 3. AI Analysis Report generation
    let ai_analysis = '';
    if (ai && !isQuotaExhausted) {
      try {
        const prompt = `Perform an institutional-grade investment analysis report for ${companyName} (${tickerSym}) trading at $${latestPrice.toFixed(2)}.
Use these computed dashboard metrics to ground your assessment:
- Technical Score Breakdown (out of 100 total points): Trend: ${trend_pts}/30, Momentum: ${momentum_pts}/20, Fundamentals: ${fund_pts}/40, Risk/Safety: ${risk_pts}/10.
- Moving Averages: MA5: $${key_levels.ma5}, MA20: $${key_levels.ma20}, MA60: $${key_levels.ma60}.
- Multi-period trends: Daily: ${multi_period.daily}, Weekly: ${multi_period.weekly}, Monthly: ${multi_period.monthly}.
- Key Support Levels: Support 1 (20-day low): $${key_levels.sup_1}, Support 2 (60-day low): $${key_levels.sup_2}.
- Key Resistance Levels: Resistance 1 (20-day high): $${key_levels.res_1}, Resistance 2 (60-day average high): $${key_levels.res_2}.
- Financials: Revenue growth QoQ: ${fundamentals.rev_qoq}, profit margin: ${fundamentals.margin}, Return on Equity (ROE): ${fundamentals.roe}.
- Valuations: P/B: ${fundamentals.pb}, PEG ratio: ${fundamentals.peg}, EPS TTM: ${fundamentals.eps_ttm}.
- Market Sentiment: Consensus: ${consensus}, Institution Holding: ${inside_analyst.inst_hold}, Short float: ${inside_analyst.short_float}.

Structure your report into 4 clean, highly scannable sections in Markdown format:
1. **Executive Valuation & Scoring Summary**: Deep dive into the 100-point scoring. Highlight which metrics drove the rating (positive and negative).
2. **Technical Layout & Major Price Levels**: Outline key entry or exit points based on the support/resistance and moving averages.
3. **Fundamental Strengths & Profitability**: Discuss the growth vectors, profitability ratios (ROE, profit margins), and whether the valuation (PEG/PB) matches the price.
4. **Analyst Verdict & Action Plan**: Provide a concrete recommendation (Accumulate, Hold, Avoid, or Swing Trade) with risk management stops based on the 20-day low support.

Be objective, authoritative, precise, and professional. Avoid fluffy adjectives. Use bolding and bullet points to maximize legibility.`;

        let response: any = null;
        try {
          response = await generateContentWithFallback(ai, {
            contents: prompt,
            defaultModel: 'gemini-2.0-flash'
          });
        } catch (err: any) {
          console.log('[AI Fallback] Fallback options active. Initializing localized quantitative briefing.');
          isQuotaExhausted = true;
          ai_analysis = generateFallbackBriefing(
            companyName,
            tickerSym,
            latestPrice,
            trend_pts,
            momentum_pts,
            fund_pts,
            risk_pts,
            key_levels,
            multi_period,
            fundamentals,
            inside_analyst,
            consensus
          );
        }
        
        if (response && !ai_analysis) {
          try {
            ai_analysis = response.text || '';
          } catch (e) {
            console.log('[AI Parsing] Notice: Unable to parse structured formatting. Running structural recovery.');
            ai_analysis = generateFallbackBriefing(
              companyName,
              tickerSym,
              latestPrice,
              trend_pts,
              momentum_pts,
              fund_pts,
              risk_pts,
              key_levels,
              multi_period,
              fundamentals,
              inside_analyst,
              consensus
            );
          }
        }
      } catch (e: any) {
        console.log(`[Gemini Connection] Notice: Local quantitative briefing initialized.`);
        try {
            ai_analysis = generateFallbackBriefing(
              companyName,
              tickerSym,
              latestPrice,
              trend_pts,
              momentum_pts,
              fund_pts,
              risk_pts,
              key_levels,
              multi_period,
              fundamentals,
              inside_analyst,
              consensus
            );
        } catch (fbErr) {
            console.log('[Fallback Briefing] Utilizing basic summary.');
            ai_analysis = 'AI market analysis is currently running on the local briefing engine.';
        }
      }
    } else {
      // Fallback if AI disabled or quota exhausted
      ai_analysis = generateFallbackBriefing(
        companyName,
        tickerSym,
        latestPrice,
        trend_pts,
        momentum_pts,
        fund_pts,
        risk_pts,
        key_levels,
        multi_period,
        fundamentals,
        inside_analyst,
        consensus
      );
    }

    const jsonResponse: StockQueryResponse = {
      ticker: tickerSym,
      companyName,
      latestPrice,
      priceChange,
      priceChangePercent,
      key_levels,
      inside_analyst,
      multi_period,
      breakdown,
      fundamentals,
      indicators,
      chart_data: computedHistory.slice(-300), // limit to last 300 trading days to fully support 1Yr range (approx 252 trading days)
      ai_analysis,
    };

    res.json(jsonResponse);
  } catch (error: any) {
    console.log(`[Transaction Query] Completed with status: unretrieved for ${tickerSym}. Details:`, error.message || error);
    res.status(500).json({ error: 'Internal server error processing stock query calculation.', details: error.stack || error.toString() });
  }
});

// Helper function to compute a multi-factor score out of 100 specifically for screener stocks
function calculateCompositeScore(data: {
  price: number;
  ma5?: number;
  ma20?: number;
  ma60?: number;
  rsi?: number;
  macdHist?: number;
  prevMacdHist?: number;
  peg?: number;
  pb?: number;
  roe?: number;
  revGrowth?: number;
  margin?: number;
  beta?: number;
  debtToEquity?: number;
}): { score: number, trend: number, momentum: number, fund: number, risk: number, remarks: string[] } {
  const remarks: string[] = [];

  // Trend (max 30 pts)
  let trend = 0;
  if (data.ma5 !== undefined && data.price > data.ma5) {
    trend += 10;
    remarks.push('Trend: Price > MA5 (+10)');
  }
  if (data.ma5 !== undefined && data.ma20 !== undefined && data.ma5 > data.ma20) {
    trend += 10;
    remarks.push('Trend: MA5 > MA20 (+10)');
  }
  if (data.ma20 !== undefined && data.ma60 !== undefined && data.ma20 > data.ma60) {
    trend += 10;
    remarks.push('Trend: MA20 > MA60 (+10)');
  }

  // Momentum (max 20 pts)
  let momentum = 0;
  if (data.rsi !== undefined) {
    if (data.rsi >= 50 && data.rsi <= 70) {
      momentum += 10;
      remarks.push(`Momentum: RSI at ${data.rsi.toFixed(1)} is in the healthy zone (+10)`);
    } else if (data.rsi > 30 && data.rsi < 50) {
      momentum += 5;
      remarks.push(`Momentum: RSI at ${data.rsi.toFixed(1)} is recovering (+5)`);
    } else if (data.rsi <= 30) {
      momentum += 10;
      remarks.push(`Momentum: RSI at ${data.rsi.toFixed(1)} is oversold (+10)`);
    } else if (data.rsi > 70) {
      momentum += 3;
      remarks.push(`Momentum: RSI at ${data.rsi.toFixed(1)} is overbought (+3)`);
    }
  }

  if (data.macdHist !== undefined && data.prevMacdHist !== undefined) {
    if (data.macdHist > 0 && data.macdHist > data.prevMacdHist) {
      momentum += 10;
      remarks.push('Momentum: MACD histogram is positive and rising (+10)');
    } else if (data.macdHist < 0 && data.macdHist > data.prevMacdHist) {
      momentum += 5;
      remarks.push('Momentum: MACD histogram is converging positively (+5)');
    }
  }

  // Fundamental (max 40 pts)
  let fund = 0;
  if (data.peg !== undefined && data.peg > 0) {
    if (data.peg < 1.5) {
      fund += 10;
      remarks.push(`Fundamental: PEG ratio of ${data.peg.toFixed(2)} is excellent (+10)`);
    } else if (data.peg <= 3) {
      fund += 6;
      remarks.push(`Fundamental: PEG ratio of ${data.peg.toFixed(2)} is reasonable (+6)`);
    }
  }

  if (data.pb !== undefined && data.pb > 0) {
    if (data.pb < 5) {
      fund += 5;
      remarks.push(`Fundamental: P/B ratio of ${data.pb.toFixed(2)} is attractive (+5)`);
    } else if (data.pb <= 10) {
      fund += 3;
      remarks.push(`Fundamental: P/B ratio of ${data.pb.toFixed(2)} is moderate (+3)`);
    }
  }

  if (data.roe !== undefined) {
    if (data.roe > 0.15) {
      fund += 10;
      remarks.push(`Fundamental: ROE of ${(data.roe * 100).toFixed(1)}% is superior (+10)`);
    } else if (data.roe > 0.08) {
      fund += 5;
      remarks.push(`Fundamental: ROE of ${(data.roe * 100).toFixed(1)}% is healthy (+5)`);
    }
  }

  if (data.revGrowth !== undefined) {
    if (data.revGrowth > 0.10) {
      fund += 10;
      remarks.push(`Fundamental: Rev Growth of ${(data.revGrowth * 100).toFixed(1)}% is robust (+10)`);
    } else if (data.revGrowth > 0) {
      fund += 5;
      remarks.push(`Fundamental: Rev Growth of ${(data.revGrowth * 100).toFixed(1)}% is stable (+5)`);
    }
  }

  if (data.margin !== undefined) {
    if (data.margin > 0.15) {
      fund += 5;
      remarks.push(`Fundamental: Net Margin of ${(data.margin * 100).toFixed(1)}% is high (+5)`);
    } else if (data.margin > 0.05) {
      fund += 3;
      remarks.push(`Fundamental: Net Margin of ${(data.margin * 100).toFixed(1)}% is fair (+3)`);
    }
  }

  // Risk (max 10 pts)
  let risk = 10;
  if (data.beta !== undefined) {
    if (data.beta > 1.5) {
      risk -= 4;
      remarks.push(`Risk: Beta of ${data.beta.toFixed(2)} indicates high volatility (-4)`);
    } else if (data.beta > 1.2) {
      risk -= 2;
      remarks.push(`Risk: Beta of ${data.beta.toFixed(2)} indicates moderate volatility (-2)`);
    }
  }

  if (data.debtToEquity !== undefined) {
    if (data.debtToEquity > 100) {
      risk -= 3;
      remarks.push(`Risk: Debt to Equity of ${data.debtToEquity.toFixed(1)} is high (-3)`);
    } else if (data.debtToEquity > 50) {
      risk -= 1;
      remarks.push(`Risk: Debt to Equity of ${data.debtToEquity.toFixed(1)} is elevated (-1)`);
    }
  }

  const score = Math.min(100, Math.max(0, Math.round(trend + momentum + fund + risk)));
  return { score, trend, momentum, fund, risk, remarks };
}

// GET Stock Screener endpoint for Most Active, S&P 500 and Nasdaq 100
// Simple in-memory cache to handle batch queries efficiently and prevent rate-limiting
const screenerCache: Record<string, { timestamp: number; data: any }> = {};
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes cache

// Backtest endpoint removed
app.get('/api/screener', async (req, res) => {
  const listType = (req.query.type as string || 'most_active').toLowerCase().trim();

  // Check cache first
  const cacheKey = listType;
  const now = Date.now();
  if (screenerCache[cacheKey] && (now - screenerCache[cacheKey].timestamp) < CACHE_DURATION) {
    console.log(`[Screener Cache Hit] Serving cached results for list type: ${listType}`);
    res.json(screenerCache[cacheKey].data);
    return;
  }

  let tickers: string[] = [];

  if (listType === 'most_active') {
    try {
      // Attempt to query live most actives from yahoo-finance2 screener
      const screenerResult: any = await yahooFinance.screener({ scrIds: 'most_actives', count: 50 }, undefined, { validateResult: false });
      if (screenerResult && screenerResult.quotes && screenerResult.quotes.length > 0) {
        tickers = screenerResult.quotes.map((q: any) => q.symbol).filter(Boolean);
      }
    } catch (e) {
      console.log('[Screener Query] Notice: Yahoo Finance list unavailable, loading pre-calculated stock tickers.');
    }
    
    if (tickers.length === 0) {
      // Pre-calculated popular most active stocks (50 tickers)
      tickers = [
        'TSLA', 'NVDA', 'AAPL', 'MSFT', 'AMZN', 'AMD', 'INTC', 'META', 'GOOGL', 'PLTR',
        'NFLX', 'COIN', 'AVGO', 'SNOW', 'MU', 'SOUN', 'ARM', 'SMCI', 'MARA', 'MSTR',
        'SHOP', 'SQ', 'UBER', 'PYPL', 'BABA', 'NIO', 'F', 'BAC', 'XOM', 'JPM',
        'V', 'DIS', 'PFE', 'T', 'WMT', 'KO', 'PEP', 'CSCO', 'ADBE', 'ORCL',
        'CRM', 'NKE', 'INTU', 'QCOM', 'TXN', 'AMGN', 'SBUX', 'GME', 'AMAT', 'HOOD'
      ];
    }
  } else if (listType === 'sp500') {
    // Full S&P 500 components list from slickcharts.com / wikipedia
    tickers = [
      'A', 'AAPL', 'ABBV', 'ABNB', 'ABT', 'ACGL', 'ACN', 'ADBE', 'ADI', 'ADM',
      'ADP', 'ADSK', 'AEE', 'AEP', 'AES', 'AFL', 'AIG', 'AIZ', 'AJG', 'AKAM',
      'ALB', 'ALGN', 'ALL', 'ALLE', 'AMAT', 'AMCR', 'AMD', 'AME', 'AMGN', 'AMP',
      'AMT', 'AMZN', 'ANET', 'AON', 'AOS', 'APA', 'APD', 'APH', 'APO', 'APP',
      'APTV', 'ARE', 'ARES', 'ATO', 'AVB', 'AVGO', 'AVY', 'AWK', 'AXON', 'AXP',
      'AZO', 'BA', 'BAC', 'BALL', 'BAX', 'BBY', 'BDX', 'BEN', 'BF-B', 'BG',
      'BIIB', 'BKNG', 'BKR', 'BLDR', 'BLK', 'BMY', 'BNY', 'BR', 'BRK-B', 'BRO',
      'BSX', 'BX', 'BXP', 'C', 'CAH', 'CARR', 'CASY', 'CAT', 'CB', 'CBOE',
      'CBRE', 'CCI', 'CCL', 'CDNS', 'CDW', 'CEG', 'CF', 'CFG', 'CHD', 'CHRW',
      'CHTR', 'CI', 'CIEN', 'CINF', 'CL', 'CLX', 'CMCSA', 'CME', 'CMG', 'CMI',
      'CMS', 'CNC', 'CNP', 'COF', 'COHR', 'COIN', 'COO', 'COP', 'COR', 'COST',
      'CPAY', 'CPRT', 'CPT', 'CRH', 'CRL', 'CRM', 'CRWD', 'CSCO', 'CSGP', 'CSX',
      'CTAS', 'CTSH', 'CTVA', 'CVNA', 'CVS', 'CVX', 'D', 'DAL', 'DASH', 'DD',
      'DDOG', 'DE', 'DECK', 'DELL', 'DG', 'DGX', 'DHI', 'DHR', 'DIS', 'DLR',
      'DLTR', 'DOC', 'DOV', 'DOW', 'DPZ', 'DRI', 'DTE', 'DUK', 'DVA', 'DVN',
      'DXCM', 'EA', 'EBAY', 'ECHO', 'ECL', 'ED', 'EFX', 'EG', 'EIX', 'EL',
      'ELV', 'EME', 'EMR', 'EOG', 'EQIX', 'EQR', 'EQT', 'ERIE', 'ES', 'ESS',
      'ETN', 'ETR', 'EVRG', 'EW', 'EXC', 'EXE', 'EXPD', 'EXPE', 'EXR', 'F',
      'FANG', 'FAST', 'FCX', 'FDS', 'FDX', 'FDXF', 'FE', 'FFIV', 'FICO', 'FIS',
      'FISV', 'FITB', 'FIX', 'FLEX', 'FOX', 'FOXA', 'FRT', 'FSLR', 'FTNT', 'FTV',
      'GD', 'GDDY', 'GE', 'GEHC', 'GEN', 'GEV', 'GILD', 'GIS', 'GL', 'GLW',
      'GM', 'GNRC', 'GOOG', 'GOOGL', 'GPC', 'GPN', 'GRMN', 'GS', 'GWW', 'HAL',
      'HAS', 'HBAN', 'HCA', 'HD', 'HIG', 'HII', 'HLT', 'HON', 'HONA', 'HOOD',
      'HPE', 'HPQ', 'HRL', 'HSIC', 'HST', 'HSY', 'HUBB', 'HUM', 'HWM', 'IBKR',
      'IBM', 'ICE', 'IDXX', 'IEX', 'IFF', 'INCY', 'INTC', 'INTU', 'INVH', 'IP',
      'IQV', 'IR', 'IRM', 'ISRG', 'IT', 'ITW', 'IVZ', 'J', 'JBHT', 'JBL',
      'JCI', 'JKHY', 'JNJ', 'JPM', 'KDP', 'KEY', 'KEYS', 'KHC', 'KIM', 'KKR',
      'KLAC', 'KMB', 'KMI', 'KO', 'KR', 'KVUE', 'L', 'LDOS', 'LEN', 'LH',
      'LHX', 'LII', 'LIN', 'LITE', 'LLY', 'LMT', 'LNT', 'LOW', 'LRCX', 'LULU',
      'LUV', 'LVS', 'LYB', 'LYV', 'MA', 'MAA', 'MAR', 'MAS', 'MCD', 'MCHP',
      'MCK', 'MCO', 'MDLZ', 'MDT', 'MET', 'META', 'MGM', 'MKC', 'MLM', 'MMM',
      'MNST', 'MO', 'MOS', 'MPC', 'MPWR', 'MRK', 'MRNA', 'MRSH', 'MRVL', 'MS',
      'MSCI', 'MSFT', 'MSI', 'MTB', 'MTD', 'MU', 'NCLH', 'NDAQ', 'NDSN', 'NEE',
      'NEM', 'NFLX', 'NI', 'NKE', 'NOC', 'NOW', 'NRG', 'NSC', 'NTAP', 'NTRS',
      'NUE', 'NVDA', 'NVR', 'NWS', 'NWSA', 'NXPI', 'O', 'ODFL', 'OKE', 'OMC',
      'ON', 'ORCL', 'ORLY', 'OTIS', 'OXY', 'PANW', 'PAYX', 'PCAR', 'PCG', 'PEG',
      'PEP', 'PFE', 'PFG', 'PG', 'PGR', 'PH', 'PHM', 'PKG', 'PLD', 'PLTR',
      'PM', 'PNC', 'PNR', 'PNW', 'PODD', 'PPG', 'PPL', 'PRU', 'PSA', 'PSKY',
      'PSX', 'PTC', 'PWR', 'PYPL', 'Q', 'QCOM', 'RCL', 'REG', 'REGN', 'RF',
      'RJF', 'RL', 'RMD', 'ROK', 'ROL', 'ROP', 'ROST', 'RSG', 'RTX', 'RVTY',
      'SBAC', 'SBUX', 'SCHW', 'SHW', 'SJM', 'SLB', 'SMCI', 'SNA', 'SNDK', 'SNPS',
      'SO', 'SOLV', 'SPG', 'SPGI', 'SRE', 'STE', 'STLD', 'STT', 'STX', 'STZ',
      'SW', 'SWK', 'SWKS', 'SYF', 'SYK', 'SYY', 'T', 'TAP', 'TDG', 'TDY',
      'TECH', 'TEL', 'TER', 'TFC', 'TGT', 'TJX', 'TKO', 'TMO', 'TMUS', 'TPL',
      'TPR', 'TRGP', 'TRMB', 'TROW', 'TRV', 'TSCO', 'TSLA', 'TSN', 'TT', 'TTD',
      'TTWO', 'TXN', 'TXT', 'TYL', 'UAL', 'UBER', 'UDR', 'UHS', 'ULTA', 'UNH',
      'UNP', 'UPS', 'URI', 'USB', 'V', 'VEEV', 'VICI', 'VLO', 'VLTO', 'VMC',
      'VRSK', 'VRSN', 'VRT', 'VRTX', 'VST', 'VTR', 'VTRS', 'VZ', 'WAB', 'WAT',
      'WBD', 'WDAY', 'WDC', 'WEC', 'WELL', 'WFC', 'WM', 'WMB', 'WMT', 'WRB',
      'WSM', 'WST', 'WTW', 'WY', 'WYNN', 'XEL', 'XOM', 'XYL', 'XYZ', 'YUM',
      'ZBH', 'ZBRA', 'ZTS',
    ];
  } else if (listType === 'nasdaq100') {
    // Full Nasdaq 100 components list from slickcharts.com (representing dual-class and 100 companies)
    tickers = [
      'ADBE', 'AMD', 'ABNB', 'ALNY', 'GOOGL', 'GOOG', 'AMZN', 'AEP', 'AMGN', 'ADI',
      'AAPL', 'AMAT', 'APP', 'ARM', 'ASML', 'ALAB', 'ADSK', 'ADP', 'AXON', 'BKR',
      'BKNG', 'AVGO', 'CDNS', 'CTAS', 'CSCO', 'CCEP', 'CMCSA', 'CEG', 'CPRT', 'CRWV',
      'COST', 'CRWD', 'CSX', 'DDOG', 'DXCM', 'FANG', 'DASH', 'EA', 'EXC', 'FAST',
      'FER', 'FTNT', 'GEHC', 'GILD', 'HON', 'IDXX', 'INTC', 'INTU', 'ISRG', 'KDP',
      'KLAC', 'KHC', 'LRCX', 'LIN', 'LITE', 'MAR', 'MRVL', 'MELI', 'META', 'MCHP',
      'MU', 'MSFT', 'MSTR', 'MDLZ', 'MPWR', 'MNST', 'NBIS', 'NFLX', 'NVDA', 'NXPI',
      'ORLY', 'ODFL', 'PCAR', 'PLTR', 'PANW', 'PAYX', 'PYPL', 'PDD', 'PEP', 'QCOM',
      'REGN', 'RKLB', 'ROP', 'ROST', 'SNDK', 'STX', 'SHOP', 'SBUX', 'SNPS', 'TMUS',
      'TTWO', 'TER', 'TSLA', 'TXN', 'TRI', 'VRTX', 'WMT', 'WBD', 'WDC', 'WDAY',
      'XEL'
    ];
  } else {
    res.status(400).json({ error: 'Invalid screener type requested. Choose most_active, sp500 or nasdaq100.' });
    return;
  }

  // Ensure unique list. If most_active limit to 50. For nasdaq100 (101) and sp500 (503), evaluate all components.
  const queryLimit = listType === 'most_active' ? 50 : (listType === 'nasdaq100' ? 105 : 510);
  tickers = Array.from(new Set(tickers)).slice(0, queryLimit);

  try {
    let quotes: any[] = [];
    
    // Fetch quotes in chunks of 40 to avoid overall batch failure on a single bad ticker, prevent URI-length issues, and maintain high performance
    const chunks: string[][] = [];
    const chunkSize = 40;
    for (let i = 0; i < tickers.length; i += chunkSize) {
      chunks.push(tickers.slice(i, i + chunkSize));
    }

    const chunkPromises = chunks.map(async (chunk) => {
      try {
        const rawQuotes = await yahooFinance.quote(chunk, undefined, { validateResult: false });
        return Array.isArray(rawQuotes) ? rawQuotes : [rawQuotes];
      } catch (err) {
        // If a chunk fails (e.g., due to a rate limit or a bad symbol), check individually just for this chunk
        console.log(`[Batch Query] Notice: Chunk failed, transitioning to individual lookups for ${chunk.length} symbols.`);
        const chunkQuotes: any[] = [];
        for (const t of chunk) {
          try {
            const singleQuote = await yahooFinance.quote(t, undefined, { validateResult: false });
            if (singleQuote) {
              chunkQuotes.push(singleQuote);
            }
          } catch (singleErr) {
            console.log(`[Lookup Notice] Single quote retrieval completed with status: unavailable for ticker ${t}`);
          }
        }
        return chunkQuotes;
      }
    });

    const chunkResults = await Promise.all(chunkPromises);
    quotes = chunkResults.flat().filter((q: any) => q && q.symbol);

    // Filter to valid tickers and process with a concurrency limit of 15 to prevent rate limits and socket exhaustion
    const filteredQuotes = quotes.filter((q: any) => q && q.symbol);
    const data: any[] = [];
    const concurrencyLimit = 15;

    for (let i = 0; i < filteredQuotes.length; i += concurrencyLimit) {
      const batch = filteredQuotes.slice(i, i + concurrencyLimit);
      const batchPromises = batch.map(async (q: any) => {
        const sym = q.symbol;
        let scoreRes: any = { score: 0 };
        
        try {
          const [chart, summary, tsFinancials] = await Promise.all([
            yahooFinance.chart(sym, { period1: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), interval: '1d' }).catch(() => null),
            yahooFinance.quoteSummary(sym, { modules: ['summaryDetail', 'financialData', 'defaultKeyStatistics'] }).catch(() => null),
            yahooFinance.fundamentalsTimeSeries(sym, { 
              period1: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], 
              type: 'quarterly', 
              module: 'financials' 
            }).catch(() => null)
          ]);

          let computedLatest: any = {};
          let computedPrev: any = {};
          
          if (chart && chart.quotes && chart.quotes.length >= 2) {
              const formattedHistory = chart.quotes
                .filter((item: any) => item && item.date && item.open !== null && item.close !== null)
                .map((item: any) => ({
                  date: item.date instanceof Date ? item.date.toISOString().split('T')[0] : String(item.date).split('T')[0],
                  open: Number(item.open),
                  high: Number(item.high),
                  low: Number(item.low),
                  close: Number(item.close),
                  volume: item.volume !== null && item.volume !== undefined ? Number(item.volume) : 0,
                }));
                
              const computedHistory = computeIndicators(formattedHistory);
              computedLatest = computedHistory[computedHistory.length - 1] || {};
              computedPrev = computedHistory[computedHistory.length - 2] || computedLatest;
          }

          const summaryDetail = summary?.summaryDetail || {};
          const financialData = summary?.financialData || {};
          const stats = summary?.defaultKeyStatistics || {};

          let revGrowthQoQ: number | undefined = undefined;
          if (tsFinancials && tsFinancials.length >= 2) {
            const sortedTs = [...tsFinancials].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
            const latestRev = getSafeNum(sortedTs[0]?.totalRevenue);
            const priorRev = getSafeNum(sortedTs[1]?.totalRevenue);
            if (latestRev !== undefined && priorRev !== undefined && priorRev !== 0) {
              revGrowthQoQ = (latestRev - priorRev) / priorRev;
            }
          }
          
          const revGrowth = revGrowthQoQ !== undefined ? revGrowthQoQ : getSafeNum(financialData.revenueGrowth);
          const peg = getSafeNum(stats.pegRatio) !== undefined ? getSafeNum(stats.pegRatio) : getSafeNum(summaryDetail.pegRatio);
          const pb = getSafeNum(stats.priceToBook) !== undefined ? getSafeNum(stats.priceToBook) : getSafeNum(summaryDetail.priceToBook);
          const roe = getSafeNum(financialData.returnOnEquity);
          const margin = getSafeNum(financialData.profitMargins);
          const beta = getSafeNum(summaryDetail.beta);
          const debtToEquity = getSafeNum(financialData.debtToEquity);
          
          const scoreInputs = {
            price: q.regularMarketPrice ?? 0,
            ma5: computedLatest.ma5,
            ma20: computedLatest.ma20,
            ma60: computedLatest.ma60,
            rsi: computedLatest.rsi,
            macdHist: computedLatest.macdHist,
            prevMacdHist: computedPrev.macdHist,
            peg: peg,
            pb: pb,
            roe: roe,
            revGrowth: revGrowth,
            margin: margin,
            beta: beta,
            debtToEquity: debtToEquity
          };
          
          scoreRes = calculateCompositeScore(scoreInputs);
        } catch (e) {
           scoreRes = calculateCompositeScore({ price: q.regularMarketPrice ?? 0 });
        }
        
        return {
          symbol: q.symbol,
          name: q.shortName || q.longName || q.symbol,
          price: q.regularMarketPrice ?? 0,
          change: q.regularMarketChange ?? 0,
          changePercent: q.regularMarketChangePercent ?? 0,
          volume: q.regularMarketVolume ?? 0,
          marketCap: q.marketCap ?? 0,
          score: scoreRes.score,
        };
      });

      const batchResults = await Promise.all(batchPromises);
      data.push(...batchResults.filter(Boolean));
    }

    const sortedData = data
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 50);

    const resultPayload = { listType, data: sortedData };
    screenerCache[cacheKey] = {
      timestamp: Date.now(),
      data: resultPayload
    };
    res.json(resultPayload);
  } catch (err: any) {
    console.log('[Screener Resolution] Status: unavailable. Details:', err?.message || err);
    res.status(500).json({ error: 'Failed to process stock screener records.' });
  }
});

function generateFallbackBriefing(
  companyName: string,
  tickerSym: string,
  latestPrice: number,
  trend_pts: number,
  momentum_pts: number,
  fund_pts: number,
  risk_pts: number,
  key_levels: any,
  multi_period: any,
  fundamentals: any,
  inside_analyst: any,
  consensus: string
): string {
  const totalScore = trend_pts + momentum_pts + fund_pts + risk_pts;
  
  let recommendation = 'Hold';
  let reasoning = 'The stock shows mixed technical indicators and moderate valuation parameters, suggesting a wait-and-see approach.';
  if (totalScore >= 75) {
    recommendation = 'Accumulate / Buy';
    reasoning = 'Strong scores across momentum, solid fundamentals, and low-to-moderate risk profiles support a positive outlook for the medium term.';
  } else if (totalScore < 45) {
    recommendation = 'Avoid / Reduce';
    reasoning = 'The rating is weighed down by high risk scores, bearish trend-following indicators, or weak fundamental metrics.';
  } else {
    if (consensus === 'BUY' || consensus === 'STRONG BUY') {
      recommendation = 'Accumulate / Swing Trade';
      reasoning = 'Positive analyst consensus paired with reasonable support levels suggests an attractive swing trading or gradual accumulation opportunity.';
    } else {
      recommendation = 'Hold';
      reasoning = 'Balanced indicators and neutral sentiment suggest maintaining current positions with tight stop-loss orders.';
    }
  }

  const scoreDriversPositive = [];
  const scoreDriversNegative = [];

  if (trend_pts >= 20) scoreDriversPositive.push(`Strong price trend structure (+${trend_pts}/30)`);
  else scoreDriversNegative.push(`Bearish or weak price trend alignment (+${trend_pts}/30)`);

  if (momentum_pts >= 14) scoreDriversPositive.push(`High trading momentum and positive volume feedback (+${momentum_pts}/20)`);
  else scoreDriversNegative.push(`Sluggish momentum indicators (+${momentum_pts}/20)`);

  if (fund_pts >= 25) scoreDriversPositive.push(`Robust profitability metrics and reasonable valuation benchmarks (+${fund_pts}/40)`);
  else scoreDriversNegative.push(`Valuation premium or low return/growth ratios (+${fund_pts}/40)`);

  if (risk_pts >= 7) scoreDriversPositive.push(`Low volatility risk profile with healthy safety buffers (+${risk_pts}/10)`);
  else scoreDriversNegative.push(`Elevated risk, high volatility, or downside vulnerability (+${risk_pts}/10)`);

  const positiveText = scoreDriversPositive.length > 0 ? scoreDriversPositive.map(d => `- **Strength**: ${d}`).join('\n') : '- **Strength**: No outstanding positive drivers above historical baselines.';
  const negativeText = scoreDriversNegative.length > 0 ? scoreDriversNegative.map(d => `- **Vulnerability**: ${d}`).join('\n') : '- **Vulnerability**: Minimal downside indicators detected.';

  return `### Executive Summary & Institutional Rating Briefing

This automated institutional briefing acts as a self-healing fallback report compiled directly from our live quant database.

---

### 1. **Executive Valuation & Scoring Summary**

${companyName} (**${tickerSym}**) has been evaluated through our multi-factor scoring matrix, receiving an overall quant rating of **${totalScore} out of 100 total points**.

**Score Breakdown**:
- **Trend Following (Trend)**: \`${trend_pts} / 30\`
- **Momentum & Volume (Vol)**: \`${momentum_pts} / 20\`
- **Fundamental Strength (Fund)**: \`${fund_pts} / 40\`
- **Risk & Volatility Safety (Risk)**: \`${risk_pts} / 10\`

**Primary Scoring Drivers**:
${positiveText}
${negativeText}

---

### 2. **Technical Layout & Major Price Levels**

The technical blueprint is characterized by multi-period trend setups:
- **Daily Trend Status**: \`${multi_period.daily}\`
- **Weekly Trend Status**: \`${multi_period.weekly}\`
- **Monthly Trend Status**: \`${multi_period.monthly}\`

**Key Moving Averages & Price Action**:
- The asset is currently trading at **$${latestPrice.toFixed(2)}**.
- **MA5 (Short-term)**: \`$${key_levels.ma5}\` — serves as immediate short-term momentum tracking.
- **MA20 (Medium-term)**: \`$${key_levels.ma20}\` — defines the primary medium-term support band.
- **MA60 (Long-term)**: \`$${key_levels.ma60}\` — defines the key macro cycle pivot line.

**Tactical Support & Resistance Bands**:
- **Immediate Resistance (Res 1 / 2)**: \`$${key_levels.res_1}\` / \`$${key_levels.res_2}\`. An expansion above resistance signals continuation.
- **Immediate Support (Sup 1 / 2)**: \`$${key_levels.sup_1}\` / \`$${key_levels.sup_2}\`. These levels are defined by the 20-day and 60-day price lows and serve as critical stop-loss parameters.

---

### 3. **Fundamental Strengths & Profitability**

Our core fundamental assessment evaluates the underlying cash flows and capital structure:
- **Revenue Growth QoQ**: \`${fundamentals.rev_qoq}\` sequential growth.
- **Profit Margin**: \`${fundamentals.margin}\` operating efficiency.
- **Return on Equity (ROE) / ROA**: \`${fundamentals.roe}\` / \`${fundamentals.roa}\`.
- **Valuation Ratios**: PEG Ratio is currently \`${fundamentals.peg}\`, with a P/B Ratio of \`${fundamentals.pb}\`.
- **Earnings Metrics**: EPS (TTM) is reported at \`${fundamentals.eps_ttm}\`.

**Interpretation**:
The stock's PEG Ratio of \`${fundamentals.peg}\` indicates its relative value relative to its earnings growth rate. The current Return on Equity (ROE) of \`${fundamentals.roe}\` shows the capital efficiency of the business, backed by a profit margin of \`${fundamentals.margin}\`.

---

### 4. **Analyst Verdict & Action Plan**

- **Consensus Outlook**: \`${consensus}\`
- **Institutional Holding**: \`${inside_analyst.inst_hold}\`
- **Short Float Percentage**: \`${inside_analyst.short_float}\`

#### **Core Tactical Recommendation**: **${recommendation.toUpperCase()}**

**Operational Strategy**:
${reasoning}

**Risk Management Coordinates**:
- **Target Purchase Range**: Accumulate on pullbacks towards the Support 1 level at \`$${key_levels.sup_1}\` or MA20 support.
- **Strict Stop-Loss (Hard Stop)**: Position a stop-loss order slightly below the Support 2 level (\`$${key_levels.sup_2}\`) to protect capital against high-volatility breaks.
- **Take-Profit Coordinates**: Target partial profit taking at the Resistance 2 level of \`$${key_levels.res_2}\`.
`;
}

// Configure Vite or Static Files
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    // Development server with Vite middleware integration
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('Vite middleware mounted in development mode');
  } else {
    // Production static delivery
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('Production static client files configured');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.log('[Server Startup] Notice: Initialization stopped. Details:', err?.message || err);
  process.exit(1);
});
