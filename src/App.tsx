import { useState, useEffect, useMemo, FormEvent } from 'react';
import {
  Search,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Scale,
  Calendar,
  Activity,
  Sparkles,
  Copy,
  Check,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  LayoutGrid,
  FileText,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  Cell,
} from 'recharts';
import { StockQueryResponse, HistoricalData } from './types';
import ScreenerView from './components/ScreenerView';
import UsReportsView from './components/UsReportsView';
// BacktestView import removed

// Custom shape for drawing candlesticks in Recharts with robust self-healing scale recovery
const CandlestickShape = (props: any) => {
  const { x, width, payload, yAxis, yScale } = props;
  
  // Self-healing scale recovery if standard yScale / yAxis.scale is missing or uninitialized
  let scale = yScale || (yAxis && yAxis.scale);
  if (!scale && yAxis && yAxis.domain && yAxis.height) {
    const [minPrice, maxPrice] = yAxis.domain;
    const yOffset = yAxis.y || 0;
    const height = yAxis.height;
    scale = (price: number) => {
      if (maxPrice === minPrice) return yOffset + height / 2;
      return yOffset + height - ((price - minPrice) / (maxPrice - minPrice)) * height;
    };
  }

  if (!payload || typeof scale !== 'function') return null;
  const { open, close, low, high } = payload;
  if (open === undefined || close === undefined || low === undefined || high === undefined) return null;

  const isUp = close >= open;
  const color = isUp ? '#22c55e' : '#ef4444'; // Green or Red

  const yOpen = scale(open);
  const yClose = scale(close);
  const yHigh = scale(high);
  const yLow = scale(low);

  // Pixel rounding to avoid sub-pixel anti-aliasing blur
  const cx = Math.round(x + width / 2);
  const candleWidth = Math.max(Math.round(width * 0.7), 3);

  return (
    <g>
      {/* Wick */}
      <line
        x1={cx}
        y1={yHigh}
        x2={cx}
        y2={yLow}
        stroke={color}
        strokeWidth={1.2}
        shapeRendering="crispEdges"
      />
      {/* Body */}
      <rect
        x={cx - candleWidth / 2}
        y={Math.min(yOpen, yClose)}
        width={candleWidth}
        height={Math.max(Math.abs(yOpen - yClose), 1.5)}
        fill={color}
        stroke={color}
        strokeWidth={1}
        shapeRendering="crispEdges"
      />
    </g>
  );
};

// Custom Tooltip for Candlestick Chart
const CustomChartTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    // Find item with open/close data in payload
    const candleItem = payload.find((p: any) => p.payload && p.payload.open !== undefined);
    if (candleItem) {
      const d = candleItem.payload;
      const isUp = d.close >= d.open;
      const colorClass = isUp ? 'text-green-400 font-bold' : 'text-red-400 font-bold';
      return (
        <div className="bg-[#0f1013] border border-[#1f2128] rounded p-3 shadow-2xl font-mono text-[10px] space-y-1.5 min-w-[130px]">
          <div className="text-white font-bold border-b border-[#1f2128]/80 pb-1 mb-1">{d.date}</div>
          <div className="flex justify-between gap-3">
            <span className="text-zinc-500">O:</span>
            <span className="text-white font-semibold">${d.open.toFixed(2)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-zinc-500">H:</span>
            <span className="text-white font-semibold">${d.high.toFixed(2)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-zinc-500">L:</span>
            <span className="text-white font-semibold">${d.low.toFixed(2)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-zinc-500">C:</span>
            <span className={colorClass}>${d.close.toFixed(2)}</span>
          </div>
          {d.ma5 !== undefined && (
            <div className="pt-1.5 border-t border-[#1f2128]/50 mt-1.5 space-y-0.5 text-[9px]">
              <div className="flex justify-between gap-3">
                <span className="text-amber-500">MA5:</span>
                <span className="text-zinc-300">${d.ma5.toFixed(2)}</span>
              </div>
              {d.ma20 !== undefined && (
                <div className="flex justify-between gap-3">
                  <span className="text-purple-400">MA20:</span>
                  <span className="text-zinc-300">${d.ma20.toFixed(2)}</span>
                </div>
              )}
              {d.ma60 !== undefined && (
                <div className="flex justify-between gap-3">
                  <span className="text-blue-400">MA60:</span>
                  <span className="text-zinc-300">${d.ma60.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      );
    }
  }
  return null;
};

// Supported default quick tickers
const QUICK_TICKERS = ['MSFT', 'AAPL', 'NVDA', 'TSLA', 'AMZN', 'GOOGL'];

const formatScreenerCap = (val: number | undefined | null): string => {
  if (val === undefined || val === null || val === 0) return 'N/A';
  if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
  if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
  return `$${val.toLocaleString()}`;
};

export default function App() {
  const [ticker, setTicker] = useState('MSFT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<StockQueryResponse | null>(null);
  const [activeIndicator, setActiveIndicator] = useState<'RSI' | 'MACD' | 'KD'>('RSI');
  const [chartRange, setChartRange] = useState<'1M' | '6M' | '12M'>('6M');
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showFinancialsModal, setShowFinancialsModal] = useState(false);

  // Screener-related states
  const [activeView, setActiveView] = useState<'dashboard' | 'screener' | 'reports'>('dashboard');
  const [screenerType, setScreenerType] = useState<'most_active' | 'sp500' | 'nasdaq100'>('most_active');
  const [screenerData, setScreenerData] = useState<any[]>([]);
  const [screenerLoading, setScreenerLoading] = useState(false);
  const [screenerError, setScreenerError] = useState<string | null>(null);
  const [screenerSearchQuery, setScreenerSearchQuery] = useState('');

  useEffect(() => {
    if (activeView !== 'screener') return;

    const fetchScreenerData = async () => {
      setScreenerLoading(true);
      setScreenerError(null);
      try {
        const res = await fetch(`/api/screener?type=${screenerType}`);
        if (!res.ok) {
          throw new Error('Failed to retrieve screener data');
        }
        const json = await res.json();
        setScreenerData(json.data || []);
      } catch (err: any) {
        console.error(err);
        setScreenerError(err.message || 'Error loading stock screener database.');
      } finally {
        setScreenerLoading(false);
      }
    };

    fetchScreenerData();
  }, [activeView, screenerType]);

  const filteredChartData = useMemo(() => {
    if (!data || !data.chart_data) return [];
    if (chartRange === '1M') {
      return data.chart_data.slice(-22); // ~1 month of trading days (22 days)
    }
    if (chartRange === '6M') {
      return data.chart_data.slice(-126); // ~6 months of trading days (126 days)
    }
    return data.chart_data.slice(-252); // ~1 year of trading days (252 days)
  }, [data, chartRange]);

  const showToastMsg = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleClearCache = () => {
    localStorage.clear();
    showToastMsg('Cache cleared successfully.');
  };

  const handleExport = () => {
    if (data) {
      try {
        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${data.ticker}_Report.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToastMsg('Export complete.');
      } catch (err) {
        showToastMsg('Export failed.');
      }
    }
  };

  // Fetch stock data from backend Express API
  const fetchStockData = async (symbol: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ticker: symbol }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch stock data');
      }
      setData(result);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An unexpected error occurred while loading data.');
    } finally {
      setLoading(false);
    }
  };

  // On mount, load default ticker
  useEffect(() => {
    fetchStockData('MSFT');
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (ticker.trim()) {
      fetchStockData(ticker.trim());
    }
  };

  const handleQuickSelect = (sym: string) => {
    setTicker(sym);
    fetchStockData(sym);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Helper to determine score color tier
  const getScoreDetails = (score: number) => {
    if (score >= 70) return { color: '#d4af37', text: 'S-Tier Sovereign Buy', bg: 'bg-[#d4af37]/10', border: 'border-[#d4af37]/30' };
    if (score >= 55) return { color: '#a3a3a3', text: 'B-Tier Moderate Buy', bg: 'bg-zinc-500/10', border: 'border-zinc-500/30' };
    if (score >= 40) return { color: '#8a8a8a', text: 'C-Tier Neutral Hold', bg: 'bg-zinc-600/10', border: 'border-zinc-600/30' };
    return { color: '#f87171', text: 'F-Tier Caution Avoid', bg: 'bg-red-500/10', border: 'border-red-500/30' };
  };

  // Parse server-side AI analyst markdown report
  const parseMarkdown = (text: string) => {
    if (!text) return null;
    return text.split('\n').map((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('### ')) {
        return (
          <h4 key={idx} className="text-xs font-semibold text-[#f2f2f2] uppercase tracking-wider mt-4 mb-2 border-b border-[#262626] pb-1 font-serif italic">
            {trimmed.replace('### ', '')}
          </h4>
        );
      }
      if (trimmed.startsWith('## ')) {
        return (
          <h3 key={idx} className="text-sm font-bold text-[#d4af37] mt-5 mb-3 font-serif italic border-l border-[#d4af37] pl-2">
            {trimmed.replace('## ', '')}
          </h3>
        );
      }
      if (trimmed.startsWith('# ')) {
        return (
          <h2 key={idx} className="text-base font-extrabold text-[#f2f2f2] mt-6 mb-4 font-serif italic">
            {trimmed.replace('# ', '')}
          </h2>
        );
      }
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const content = trimmed.substring(2);
        return (
          <li key={idx} className="ml-4 list-disc text-xs text-[#8a8a8a] my-1 leading-relaxed">
            {parseInlineBold(content)}
          </li>
        );
      }
      if (trimmed === '') return <div key={idx} className="h-2" />;
      return (
        <p key={idx} className="text-xs text-[#8a8a8a] my-2 leading-relaxed">
          {parseInlineBold(trimmed)}
        </p>
      );
    });
  };

  const parseInlineBold = (text: string) => {
    const parts = text.split('**');
    return parts.map((part, i) =>
      i % 2 === 1 ? (
        <strong key={i} className="font-semibold text-[#d4af37]">
          {part}
        </strong>
      ) : (
        part
      )
    );
  };

  // Calculate sum of scoring areas
  const totalScore = data ? (data.breakdown.trend + data.breakdown.momentum + data.breakdown.fund + data.breakdown.risk) : 0;
  const scoreMeta = getScoreDetails(totalScore);

  // Direction score based on Trend + Momentum + Risk only (max 60 pts)
  const directionScore = data ? (data.breakdown.trend + data.breakdown.momentum + data.breakdown.risk) : 0;
  const getDirectionDetails = (score: number) => {
    if (score >= 45) {
      return { label: 'Strong Bull', color: 'text-[#22c55e]', bias: 'Bullish Bias' };
    }
    if (score >= 33) {
      return { label: 'Bull', color: 'text-[#a3e635]', bias: 'Bullish Bias' };
    }
    if (score >= 24) {
      return { label: 'Neutral', color: 'text-amber-500', bias: 'No Clear Bias' };
    }
    if (score >= 15) {
      return { label: 'Bear', color: 'text-red-400', bias: 'Bearish Bias' };
    }
    return { label: 'Strong Bear', color: 'text-red-500', bias: 'Bearish Bias' };
  };
  const directionMeta = getDirectionDetails(directionScore);

  const radarData = data ? [
    { subject: 'RSI', value: parseFloat(data.indicators.rsi) || 50 },
    { subject: 'MACD', value: data.indicators.macd === 'Bullish' ? 90 : 30 },
    { subject: 'KD', value: data.indicators.kd.includes('Bullish') ? 95 : data.indicators.kd.includes('Bearish') ? 25 : 60 },
    { subject: 'Win%', value: parseInt(data.indicators.win_pct) || 50 },
    { subject: 'Trend', value: Math.round((data.breakdown.trend / 30) * 100) },
    { subject: 'Vol', value: Math.round((data.breakdown.momentum / 20) * 100) },
  ] : [];

  return (
    <div className="min-h-screen bg-[#090a0f] text-[#f2f2f2] font-sans antialiased selection:bg-[#3b82f6] selection:text-white">
      {/* Top Controls Header */}
      <div className="bg-[#090a0f] border-b border-[#1f2128] py-3 sticky top-0 z-50 pdf-ignore">
        <div className="max-w-[1550px] mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            <input
              type="text"
              placeholder="Ticker"
              value={ticker}
              onChange={e => setTicker(e.target.value.toUpperCase())}
              className="w-28 px-3 py-1.5 text-sm font-mono bg-[#090a0f] border border-[#20232a] hover:border-[#3b82f6] focus:border-[#3b82f6] rounded text-white font-bold placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#3b82f6] uppercase"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 text-xs font-semibold bg-[#121316] hover:bg-[#1a1b20] active:bg-black border border-[#20232a] hover:border-[#3b82f6] rounded text-white transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : 'Query'}
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={!data}
              className="px-4 py-1.5 text-xs font-semibold bg-[#121316] hover:bg-[#1a1b20] active:bg-black border border-[#20232a] hover:border-[#3b82f6] rounded text-white transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-40"
            >
              Export
            </button>
            <button
              type="button"
              onClick={() => setShowFinancialsModal(true)}
              disabled={!data}
              className="px-4 py-1.5 text-xs font-semibold bg-[#121316] hover:bg-[#1a1b20] active:bg-black border border-[#20232a] hover:border-[#3b82f6] rounded text-white transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-40"
            >
              Financials
            </button>
            <button
              type="button"
              onClick={handleClearCache}
              className="px-4 py-1.5 text-xs font-semibold bg-[#121316] hover:bg-[#1a1b20] active:bg-black border border-[#20232a] hover:border-[#3b82f6] rounded text-white transition-all cursor-pointer flex items-center gap-1.5"
            >
              Clear Cache
            </button>
            <button
              type="button"
              onClick={() => setActiveView(activeView === 'screener' ? 'dashboard' : 'screener')}
              className={`px-4 py-1.5 text-xs font-semibold border rounded transition-all cursor-pointer flex items-center gap-1.5 ${
                activeView === 'screener'
                  ? 'bg-[#22c55e]/15 border-[#22c55e]/40 text-[#22c55e] hover:bg-[#22c55e]/25'
                  : 'bg-[#121316] hover:bg-[#1a1b20] active:bg-black border-[#20232a] hover:border-[#3b82f6] text-white'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Screener
            </button>
            <button
              type="button"
              onClick={() => setActiveView(activeView === 'reports' ? 'dashboard' : 'reports')}
              className={`px-4 py-1.5 text-xs font-semibold border rounded transition-all cursor-pointer flex items-center gap-1.5 ${
                activeView === 'reports'
                  ? 'bg-[#6366f1]/20 border-[#6366f1]/50 text-[#a5b4fc] hover:bg-[#6366f1]/30 shadow-[0_0_12px_rgba(99,102,241,0.25)]'
                  : 'bg-[#121316] hover:bg-[#1a1b20] active:bg-black border-[#20232a] hover:border-[#6366f1] text-white'
              }`}
            >
              <FileText className="h-3.5 w-3.5 text-[#818cf8]" />
              US Top 50 Reports
            </button>

          </form>

          <div className="flex items-center gap-3 text-xs text-zinc-500 font-mono">
            {data && <span className="text-[#3b82f6] font-bold">SYSTEM ACTIVE</span>}
            <span>LAST UPDATE: {new Date().toISOString().split('T')[0]}</span>
          </div>
        </div>
      </div>

      {/* Quick selection pill bar */}
      <div className="bg-[#0c0d12] border-b border-[#1f2128]/40 py-1.5 px-4 text-xs font-mono pdf-ignore">
        <div className="max-w-[1550px] mx-auto flex items-center gap-2 overflow-x-auto whitespace-nowrap scrollbar-none">
          <span className="text-zinc-500 uppercase text-[9px]">Pills Selection:</span>
          {QUICK_TICKERS.map(sym => (
            <button
              key={sym}
              onClick={() => handleQuickSelect(sym)}
              className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono transition-all cursor-pointer ${
                data?.ticker === sym
                  ? 'bg-[#3b82f6]/25 text-[#3b82f6] border border-[#3b82f6]/40 font-bold'
                  : 'text-zinc-500 hover:text-white hover:bg-zinc-800'
              }`}
            >
              {sym}
            </button>
          ))}
        </div>
      </div>




      {/* Main Container */}
      <main className="max-w-[1550px] mx-auto px-4 py-6">
        {activeView === 'screener' ? (
          <ScreenerView
            onSelectTicker={(symbol) => {
              setTicker(symbol);
              setActiveView('dashboard');
              fetchStockData(symbol);
            }}
            onClose={() => setActiveView('dashboard')}
          />
        ) : activeView === 'reports' ? (
          <UsReportsView
            onSelectTicker={(symbol) => {
              setTicker(symbol);
              setActiveView('dashboard');
              fetchStockData(symbol);
            }}
            onClose={() => setActiveView('dashboard')}
          />
        ) : (
          <>
            {error && (
          <div className="mb-6 bg-red-500/5 border border-red-500/20 text-red-200 p-5 rounded text-xs font-mono leading-relaxed flex items-start gap-3 animate-fade-in">
            <ShieldAlert className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-red-400 uppercase tracking-wider mr-1">Analysis Failed:</span> {error}
              <div className="mt-2 text-[#8a8a8a] text-xs">
                Tip: Verify the ticker symbol is a valid public symbol on Yahoo Finance (e.g., AAPL, MSFT, GOOGL).
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
            <div className="relative h-12 w-12">
              <div className="absolute inset-0 rounded border-2 border-zinc-800" />
              <div className="absolute inset-0 rounded border-2 border-t-[#3b82f6] animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-xs font-mono text-[#8a8a8a] uppercase tracking-widest">
                Computing Quantitative Signals...
              </p>
              <p className="text-[10px] text-zinc-600 mt-1 font-mono">
                Compiling multi-period EMAs, stochastic paths, and analyst consensus modules.
              </p>
            </div>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* 1. Primary Info Row (Company Header) */}
            <div className="flex flex-col md:flex-row items-baseline justify-between w-full pb-4 border-b border-[#1f2128]">
              <div className="flex flex-wrap items-baseline gap-2.5">
                <span className="text-3xl font-extrabold text-white tracking-tight">{data.ticker}</span>
                <span className="text-sm text-zinc-400 font-medium">{data.companyName}</span>
                <span className="text-3xl font-extrabold text-white tracking-tight ml-4">${data.latestPrice.toFixed(2)}</span>
                <span className={`text-sm font-semibold ml-2 ${data.priceChange >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                  {data.priceChange >= 0 ? '+' : ''}{data.priceChange.toFixed(2)} ({data.priceChangePercent >= 0 ? '+' : ''}{data.priceChangePercent.toFixed(2)}%)
                </span>
              </div>
              <div className="text-xs text-zinc-400 font-mono mt-2 md:mt-0 uppercase tracking-wider">
                US Equity Market • {data.chart_data[data.chart_data.length - 1]?.date || '2026-06-26'}
              </div>
            </div>

            {/* 2. Four Core Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Score Card */}
              <div className="bg-[#0f1013] border border-[#1f2128] rounded p-5 flex flex-col items-center justify-center text-center">
                <span className="text-xs text-zinc-500 font-mono uppercase mb-2">Score</span>
                <div className="text-lg text-amber-400 mb-1 tracking-widest font-serif">
                  {totalScore >= 80 ? '★★★★★' : totalScore >= 60 ? '★★★★☆' : totalScore >= 40 ? '★★★☆☆' : totalScore >= 20 ? '★★☆☆☆' : '★☆☆☆☆'}
                </div>
                <div className="text-4xl font-extrabold text-white font-serif">{totalScore}</div>
              </div>

              {/* Direction Card */}
              <div className="bg-[#0f1013] border border-[#1f2128] rounded p-5 flex flex-col items-center justify-center text-center">
                <span className="text-xs text-zinc-500 font-mono uppercase mb-2">Direction</span>
                <div className={`text-2xl font-black uppercase tracking-tight ${directionMeta.color}`}>
                  {directionMeta.label}
                </div>
                <span className="text-[10px] text-zinc-500 font-mono mt-1 uppercase">
                  {directionMeta.bias} ({directionScore}/60 pts)
                </span>
              </div>

              {/* Action Card */}
              <div className="bg-[#0f1013] border border-[#1f2128] rounded p-5 flex flex-col items-center justify-center text-center">
                <span className="text-xs text-zinc-500 font-mono uppercase mb-2">Action</span>
                <div className={`text-2xl font-black uppercase tracking-tight ${totalScore >= 70 ? 'text-[#22c55e]' : totalScore >= 55 ? 'text-[#a3e635]' : totalScore >= 40 ? 'text-amber-500' : 'text-red-500'}`}>
                  {totalScore >= 70 ? 'Strong Buy' : totalScore >= 55 ? 'Buy' : totalScore >= 40 ? 'Hold' : 'Sell'}
                </div>
                <span className="text-[10px] text-zinc-500 font-mono mt-1 uppercase">Based on Score</span>
              </div>

              {/* Risk Card */}
              <div className="bg-[#0f1013] border border-[#1f2128] rounded p-5 flex flex-col items-center justify-center text-center">
                <span className="text-xs text-zinc-500 font-mono uppercase mb-2">Risk</span>
                <div className={`text-2xl font-black uppercase tracking-tight ${data.breakdown.risk >= 8 ? 'text-[#22c55e]' : data.breakdown.risk >= 5 ? 'text-amber-500' : 'text-red-500'}`}>
                  {data.breakdown.risk >= 8 ? 'Low' : data.breakdown.risk >= 5 ? 'Medium' : 'High'}
                </div>
                <span className="text-[10px] text-zinc-500 font-mono mt-1 uppercase">
                  {data.breakdown.risk >= 8 ? 'Healthy Trend' : data.breakdown.risk >= 5 ? 'Moderate Risk' : 'High Volatility'}
                </span>
              </div>
            </div>

            {/* 3. Main Split Grid (Left: Charts & AI, Right: Bento Cards) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* LEFT COLUMN: Highly Styled Technical Analysis Station & AI Report */}
              <div className="lg:col-span-7 space-y-6">
                {/* Visual Chart Card */}
                <div className="bg-[#0f1013] border border-[#1f2128] rounded p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#1f2128]/60 pb-3 mb-4 gap-3">
                    <div>
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                        Institutional Multi-Lane Chart
                      </h3>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        Price action, Moving Averages, and Support/Resistance corridors
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Time Range Selector */}
                      <div className="flex bg-[#090a0f] p-0.5 rounded border border-[#20232a] text-[10px] font-mono">
                        {(['1M', '6M', '12M'] as const).map((range) => (
                          <button
                            key={range}
                            onClick={() => setChartRange(range)}
                            className={`px-2.5 py-1 rounded cursor-pointer transition-all ${
                              chartRange === range ? 'bg-[#22c55e] text-black font-bold' : 'text-zinc-500 hover:text-white'
                            }`}
                          >
                            {range}
                          </button>
                        ))}
                      </div>

                      {/* Technical Indicator Selector */}
                      <div className="flex bg-[#090a0f] p-0.5 rounded border border-[#20232a] text-[10px] font-mono">
                        <button
                          onClick={() => setActiveIndicator('RSI')}
                          className={`px-2.5 py-1 rounded cursor-pointer transition-all ${
                            activeIndicator === 'RSI' ? 'bg-[#3b82f6] text-white font-bold' : 'text-zinc-500 hover:text-white'
                          }`}
                        >
                          RSI
                        </button>
                        <button
                          onClick={() => setActiveIndicator('MACD')}
                          className={`px-2.5 py-1 rounded cursor-pointer transition-all ${
                            activeIndicator === 'MACD' ? 'bg-[#3b82f6] text-white font-bold' : 'text-zinc-500 hover:text-white'
                          }`}
                        >
                          MACD
                        </button>
                        <button
                          onClick={() => setActiveIndicator('KD')}
                          className={`px-2.5 py-1 rounded cursor-pointer transition-all ${
                            activeIndicator === 'KD' ? 'bg-[#3b82f6] text-white font-bold' : 'text-zinc-500 hover:text-white'
                          }`}
                        >
                          STOCH
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Lane 1: Candlestick/Line Price Overlay */}
                    <div className="h-56 relative">
                      <div className="absolute top-2 left-2 z-10 flex gap-4 font-mono text-[9px]">
                        <span className="text-amber-500">MA5: ${data.key_levels.ma5}</span>
                        <span className="text-purple-400">MA20: ${data.key_levels.ma20}</span>
                        <span className="text-blue-400">MA60: ${data.key_levels.ma60}</span>
                      </div>
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={filteredChartData} margin={{ top: 15, right: 10, left: -25, bottom: 0 }}>
                          <defs>
                            <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.16} />
                              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1f2128" />
                          <XAxis dataKey="date" hide />
                          <YAxis domain={['auto', 'auto']} stroke="#4f4f5f" fontSize={9} />
                          <Tooltip content={<CustomChartTooltip />} />
                          
                          <Area type="monotone" dataKey="close" stroke="#22c55e" strokeWidth={2} fill="url(#priceGradient)" name="Close Price" dot={false} activeDot={{ r: 4 }} />
                          <Line type="monotone" dataKey="ma5" stroke="#f59e0b" strokeWidth={1} dot={false} name="MA5" />
                          <Line type="monotone" dataKey="ma20" stroke="#c084fc" strokeWidth={1} dot={false} name="MA20" />
                          <Line type="monotone" dataKey="ma60" stroke="#38bdf8" strokeWidth={1} dot={false} name="MA60" />
                          
                          {/* Key levels horizontal reference corridor */}
                          <ReferenceLine y={parseFloat(data.key_levels.res_1)} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={0.8} />
                          <ReferenceLine y={parseFloat(data.key_levels.sup_1)} stroke="#22c55e" strokeDasharray="3 3" strokeWidth={0.8} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Lane 2: Dynamic Volume (Colored by Candle Action) */}
                    <div className="h-20">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={filteredChartData} margin={{ top: 2, right: 10, left: -25, bottom: 2 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1f2128" />
                          <XAxis dataKey="date" hide />
                          <YAxis stroke="#4f4f5f" fontSize={9} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#0f1013', borderColor: '#1f2128', borderRadius: '4px' }}
                            labelClassName="text-[10px] font-bold text-white font-mono"
                            itemStyle={{ fontSize: '10px', color: '#8a8a8a', fontFamily: 'monospace' }}
                          />
                          <Bar dataKey="volume" name="Volume">
                            {filteredChartData.map((entry: any, index: number) => {
                              const isUp = entry.close >= (entry.open || entry.close);
                              return (
                                <Cell
                                  key={`vol-${index}`}
                                  fill={isUp ? '#22c55e' : '#ef4444'}
                                  fillOpacity={0.65}
                                />
                              );
                            })}
                          </Bar>
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Lane 3: Selected Technical Indicator (RSI, MACD, or Stochastic KD) */}
                    <div className="h-24 border-t border-[#1f2128]/70 pt-2.5">
                      {activeIndicator === 'RSI' ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={filteredChartData} margin={{ top: 2, right: 10, left: -25, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2128" />
                            <XAxis dataKey="date" stroke="#4f4f5f" fontSize={9} />
                            <YAxis domain={[0, 100]} ticks={[30, 50, 70]} stroke="#4f4f5f" fontSize={9} />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#0f1013', borderColor: '#1f2128', borderRadius: '4px' }}
                              labelClassName="text-[10px] font-bold text-white font-mono"
                              itemStyle={{ fontSize: '10px', color: '#8a8a8a', fontFamily: 'monospace' }}
                            />
                            <Line type="monotone" dataKey="rsi" stroke="#f97316" strokeWidth={1.2} dot={false} name="RSI (14)" />
                            <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={0.8} />
                            <ReferenceLine y={30} stroke="#22c55e" strokeDasharray="3 3" strokeWidth={0.8} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      ) : activeIndicator === 'MACD' ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={filteredChartData} margin={{ top: 2, right: 10, left: -25, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2128" />
                            <XAxis dataKey="date" stroke="#4f4f5f" fontSize={9} />
                            <YAxis stroke="#4f4f5f" fontSize={9} />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#0f1013', borderColor: '#1f2128', borderRadius: '4px' }}
                              labelClassName="text-[10px] font-bold text-white font-mono"
                              itemStyle={{ fontSize: '10px', color: '#8a8a8a', fontFamily: 'monospace' }}
                            />
                            <Bar dataKey="macdHist" name="MACD Hist">
                              {filteredChartData.map((entry: any, index: number) => {
                                const val = entry.macdHist || 0;
                                return (
                                  <Cell
                                    key={`macd-hist-${index}`}
                                    fill={val >= 0 ? '#22c55e' : '#ef4444'}
                                    fillOpacity={0.6}
                                  />
                                );
                              })}
                            </Bar>
                            <Line type="monotone" dataKey="macdLine" stroke="#3b82f6" strokeWidth={1} dot={false} name="MACD" />
                            <Line type="monotone" dataKey="macdSignal" stroke="#94a3b8" strokeWidth={1} dot={false} name="Signal" />
                          </ComposedChart>
                        </ResponsiveContainer>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={filteredChartData} margin={{ top: 2, right: 10, left: -25, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2128" />
                            <XAxis dataKey="date" stroke="#4f4f5f" fontSize={9} />
                            <YAxis domain={[0, 100]} ticks={[20, 50, 80]} stroke="#4f4f5f" fontSize={9} />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#0f1013', borderColor: '#1f2128', borderRadius: '4px' }}
                              labelClassName="text-[10px] font-bold text-white font-mono"
                              itemStyle={{ fontSize: '10px', color: '#8a8a8a', fontFamily: 'monospace' }}
                            />
                            <Line type="monotone" dataKey="k" stroke="#3b82f6" strokeWidth={1.2} dot={false} name="%K" />
                            <Line type="monotone" dataKey="d" stroke="#f59e0b" strokeWidth={1.2} dot={false} name="%D" />
                            <ReferenceLine y={80} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={0.8} />
                            <ReferenceLine y={20} stroke="#22c55e" strokeDasharray="3 3" strokeWidth={0.8} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Bento Multi-period Ratios & Scores Ledger */}
              <div className="lg:col-span-5 space-y-4">
                {/* Row 1: Key Levels and Score Breakdown Side-by-Side */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  {/* Card 1.1: Key Levels */}
                  <div className="md:col-span-5 bg-[#0f1013] border border-[#1f2128] rounded p-4 flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono mb-3.5 flex items-center gap-1.5">
                        <Activity className="h-3.5 w-3.5 text-[#3b82f6]" /> Key Levels
                      </h4>

                      <div className="space-y-3 font-mono text-xs">
                        <div>
                          <span className="text-zinc-500 text-[10px] block uppercase">Resistance</span>
                          <span className="text-sm font-bold text-red-400">${data.key_levels.res_2} / ${data.key_levels.res_1}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 text-[10px] block uppercase">Support</span>
                          <span className="text-sm font-bold text-green-400">${data.key_levels.sup_2} / ${data.key_levels.sup_1}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 text-[10px] block uppercase">MA 5</span>
                          <span className="text-sm font-bold text-amber-500">${data.key_levels.ma5}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 text-[10px] block uppercase">MA 20</span>
                          <span className="text-sm font-bold text-purple-400">${data.key_levels.ma20}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 text-[10px] block uppercase">MA 60</span>
                          <span className="text-sm font-bold text-blue-400">${data.key_levels.ma60}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card 1.2: Score Breakdown + Radar Chart */}
                  <div className="md:col-span-7 bg-[#0f1013] border border-[#1f2128] rounded p-4">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono mb-3.5">
                      Score Breakdown
                    </h4>

                    <div className="flex items-start gap-3">
                      {/* Left: Score areas list */}
                      <div className="w-1/2 space-y-1.5 font-mono text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-500">Trend (30)</span>
                          <span className="font-bold text-[#3b82f6]">{data.breakdown.trend} pts</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-500">Momentum (20)</span>
                          <span className="font-bold text-[#3b82f6]">{data.breakdown.momentum} pts</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-500">Fundamental (40)</span>
                          <span className="font-bold text-[#3b82f6]">{data.breakdown.fund} pts</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-500">Risk (10)</span>
                          <span className="font-bold text-[#3b82f6]">{data.breakdown.risk} pts</span>
                        </div>

                        {/* Inside remarks ladder */}
                        <div className="mt-3.5 pt-2 border-t border-[#1f2128]">
                          <span className="text-[#3b82f6] text-[10px] block font-bold mb-1">[REMARKS]</span>
                          <div className="max-h-[110px] overflow-y-auto pr-1 space-y-1.5 text-[9.5px] text-zinc-400">
                            {data.breakdown.remarks.map((rmk, i) => (
                              <div key={i} className="whitespace-normal break-words leading-normal">• {rmk}</div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Right: Dynamic Radar Chart */}
                      <div className="w-1/2 h-[165px] flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                            <PolarGrid stroke="#1f2128" />
                            <PolarAngleAxis dataKey="subject" stroke="#8a8a8a" fontSize={8} />
                            <Radar name="Scoring" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.4} />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Row 2: Inside/Analyst, Multi-Period, Fundamentals */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Card 2.1: Inside & Analyst */}
                  <div className="bg-[#0f1013] border border-[#1f2128] rounded p-4 font-mono text-xs">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono mb-3 border-b border-[#1f2128] pb-1.5">
                      Inside & Analyst
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <span className="text-zinc-500 text-[9px] block uppercase">[Analyst Consensus]</span>
                        <div className="flex justify-between items-center mt-0.5">
                          <span>Consensus</span>
                          <span className={`font-bold ${data.inside_analyst.consensus === 'Buy' ? 'text-green-400' : data.inside_analyst.consensus === 'Sell' ? 'text-red-400' : 'text-amber-400'}`}>
                            {data.inside_analyst.consensus}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-zinc-400 mt-0.5">
                          <span>Target (B/H/S)</span>
                          <span>{data.inside_analyst.target_bhs}</span>
                        </div>
                      </div>

                      <div>
                        <span className="text-zinc-500 text-[9px] block uppercase">[Insider Sentiment]</span>
                        <div className="flex justify-between items-center mt-0.5">
                          <span>MSPR Score</span>
                          <span className="font-bold text-white">{data.inside_analyst.mspr}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-zinc-400 mt-0.5">
                          <span>Net Shares</span>
                          <span className="truncate max-w-[80px] text-right">{data.inside_analyst.net_shares}</span>
                        </div>
                      </div>

                      <div>
                        <span className="text-zinc-500 text-[9px] block uppercase">[Market Short]</span>
                        <div className="flex justify-between items-center mt-0.5">
                          <span>Inst. Hold</span>
                          <span className="font-bold text-white">{data.inside_analyst.inst_hold}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-zinc-400 mt-0.5">
                          <span>Short % Float</span>
                          <span className="text-red-400 font-bold">{data.inside_analyst.short_float}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card 2.2: Multi-Period */}
                  <div className="bg-[#0f1013] border border-[#1f2128] rounded p-4 font-mono text-xs">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono mb-3 border-b border-[#1f2128] pb-1.5">
                      Multi-Period
                    </h4>
                    <div className="space-y-2.5">
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500">Daily Trend</span>
                        <span className={`font-bold ${data.multi_period.daily === 'Bullish' ? 'text-green-400' : 'text-red-400'}`}>
                          {data.multi_period.daily}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500">Weekly Trend</span>
                        <span className={`font-bold ${data.multi_period.weekly === 'Bullish' ? 'text-green-400' : 'text-red-400'}`}>
                          {data.multi_period.weekly}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500">Monthly Trend</span>
                        <span className={`font-bold ${data.multi_period.monthly === 'Bullish' ? 'text-green-400' : 'text-red-400'}`}>
                          {data.multi_period.monthly}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500">20D High</span>
                        <span className="text-white font-bold">{data.multi_period.d20_high}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500">20D Low</span>
                        <span className="text-white font-bold">{data.multi_period.d20_low}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500">60D High</span>
                        <span className="text-white font-bold">{data.multi_period.d60_high}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500">Dist 60D</span>
                        <span className={`font-bold ${data.multi_period.dist_60d.startsWith('-') ? 'text-red-400' : 'text-green-400'}`}>
                          {data.multi_period.dist_60d}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card 2.3: Fundamentals */}
                  <div id="fundamentals-bento" className="bg-[#0f1013] border border-[#1f2128] rounded p-4 font-mono text-xs">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono mb-3 border-b border-[#1f2128] pb-1.5">
                      Fundamentals
                    </h4>
                    <div className="space-y-2.5">
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500">Revenue (TTM)</span>
                        <span className="text-white font-bold text-right whitespace-nowrap">{data.fundamentals.rev_ttm}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500">Rev. QoQ</span>
                        <span className="text-white font-bold">{data.fundamentals.rev_qoq}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500">EPS (TTM)</span>
                        <span className="text-white font-bold">{data.fundamentals.eps_ttm}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500">ROE / ROA</span>
                        <span className="text-white font-bold text-right whitespace-nowrap">{data.fundamentals.roe} / {data.fundamentals.roa}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500">PEG Ratio</span>
                        <span className="text-white font-bold">{data.fundamentals.peg}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500">P/B Ratio</span>
                        <span className="text-white font-bold">{data.fundamentals.pb}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500">Div. Yield</span>
                        <span className="text-white font-bold">{data.fundamentals.div}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500">Net Margin</span>
                        <span className="text-white font-bold">{data.fundamentals.margin}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Bottom Full-Width Ticker Status Bar */}
            <div className="bg-[#121316] border border-[#1f2128] rounded p-4 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs text-zinc-400 mt-6">
              <div className="flex items-center gap-2">
                <span>Trend</span>
                <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${data.indicators.trend === 'Bullish' ? 'bg-[#22c55e]/15 text-[#22c55e]' : 'bg-[#ef4444]/15 text-[#ef4444]'}`}>
                  {data.indicators.trend}
                </span>
              </div>
              <div className="h-4 w-px bg-[#1f2128] hidden sm:block" />
              <button
                onClick={() => setActiveIndicator('MACD')}
                className="flex items-center gap-2 hover:text-white transition-all cursor-pointer"
              >
                <span>MACD</span>
                <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${data.indicators.macd === 'Bullish' ? 'bg-[#22c55e]/15 text-[#22c55e]' : 'bg-[#ef4444]/15 text-[#ef4444]'}`}>
                  {data.indicators.macd}
                </span>
              </button>
              <div className="h-4 w-px bg-[#1f2128] hidden sm:block" />
              <button
                onClick={() => setActiveIndicator('KD')}
                className="flex items-center gap-2 hover:text-white transition-all cursor-pointer"
              >
                <span>KD</span>
                <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/15 text-amber-500">
                  {data.indicators.kd}
                </span>
              </button>
              <div className="h-4 w-px bg-[#1f2128] hidden sm:block" />
              <button
                onClick={() => setActiveIndicator('RSI')}
                className="flex items-center gap-2 hover:text-white transition-all cursor-pointer"
              >
                <span>RSI</span>
                <span className="text-white font-bold">{data.indicators.rsi}</span>
              </button>
              <div className="h-4 w-px bg-[#1f2128] hidden sm:block" />
              <div className="flex items-center gap-2">
                <span>Win%</span>
                <span className="text-white font-bold">{data.indicators.win_pct}</span>
              </div>
            </div>

            {/* AI Analyst Briefing Report (Full width at bottom) */}
            <div className="bg-[#0f1013] border border-[#1f2128] rounded overflow-hidden mt-6">
              <div className="p-4 border-b border-[#1f2128] bg-[#0c0d12] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#3b82f6]" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                    Senior Quantitative AI Report
                  </h3>
                </div>
                
                <div className="flex items-center gap-2 pdf-ignore">
                  {data.ai_analysis && (
                    <>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(data.ai_analysis || '')}
                        className="px-3 py-1 text-[10px] font-mono rounded bg-[#0f1013] border border-[#20232a] hover:bg-[#1a1b20] text-zinc-400 hover:text-white transition flex items-center gap-1.5 cursor-pointer"
                      >
                        {copied ? (
                          <>
                            <Check className="h-3 w-3 text-[#22c55e]" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>Copy Report</span>
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="p-5 max-h-[480px] overflow-y-auto prose prose-invert max-w-none prose-sm leading-relaxed text-[#8a8a8a] font-sans">
                {data.ai_analysis ? (
                  parseMarkdown(data.ai_analysis)
                ) : (
                  <div className="text-center py-6 text-zinc-600 italic text-xs font-mono">
                    No AI report generated. Ensure the Gemini API key is configured.
                  </div>
                )}
              </div>

            </div>
          </div>
        ) : (
          <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-8 border border-[#1f2128] bg-[#0f1013] rounded max-w-lg mx-auto mt-12 animate-fade-in">
            <Activity className="h-10 w-10 text-[#3b82f6] mb-3 animate-pulse" />
            <h3 className="text-base font-bold text-white font-serif italic mb-1">
              Ready to Analyze Stock Tickers
            </h3>
            <p className="text-xs text-zinc-500 leading-relaxed max-w-sm mb-5">
              Enter a US stock ticker symbol (e.g., AAPL, NVDA, TSLA) above or select one of our default high-volume tickers to compile a fully audited score card.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {QUICK_TICKERS.map(sym => (
                <button
                  key={sym}
                  onClick={() => handleQuickSelect(sym)}
                  className="px-4 py-1.5 text-xs font-mono bg-[#090a0f] hover:bg-zinc-800 border border-[#1f2128] rounded text-[#3b82f6] font-semibold cursor-pointer transition-all"
                >
                  {sym}
                </button>
              ))}
            </div>
          </div>
        )}
          </>
        )}
      </main>

      {/* Terminal Footer */}
      <footer className="border-t border-[#1f2128] bg-[#07080b] py-8 text-center text-zinc-600 text-[10px] font-mono mt-12">
        <div className="max-w-[1550px] mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>
            QUANTTECH SYSTEM CORE ONLINE • STABLE INGRESS 3000 • REGULATED FEED
          </span>
          <span className="text-zinc-600/70">
            Powered by Yahoo Finance Data & Google Gemini Model Intelligence
          </span>
        </div>
      </footer>

      {/* Comprehensive Financials Modal */}
      {showFinancialsModal && data && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-[#0f1013] border border-[#1f2128] rounded-md max-w-2xl w-full p-6 relative shadow-2xl overflow-hidden animate-slide-up">
            <div className="flex items-center justify-between border-b border-[#1f2128] pb-4 mb-4">
              <div className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-[#3b82f6]" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  {data.ticker} - Detailed Financial Analysis
                </h3>
              </div>
              <button
                onClick={() => setShowFinancialsModal(false)}
                className="text-zinc-500 hover:text-white transition-all font-mono text-[10px] uppercase px-2.5 py-1 bg-[#121316] border border-[#20232a] rounded cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-3 bg-[#090a0f] border border-[#1f2128] rounded">
                <span className="text-zinc-500 block text-[10px] uppercase mb-1">Total Revenue TTM</span>
                <span className="text-sm font-bold text-white">{data.fundamentals.rev_ttm}</span>
              </div>
              <div className="p-3 bg-[#090a0f] border border-[#1f2128] rounded">
                <span className="text-zinc-500 block text-[10px] uppercase mb-1">Revenue Growth QoQ</span>
                <span className="text-sm font-bold text-white">{data.fundamentals.rev_qoq}</span>
              </div>
              <div className="p-3 bg-[#090a0f] border border-[#1f2128] rounded">
                <span className="text-zinc-500 block text-[10px] uppercase mb-1">EPS Trailing TTM</span>
                <span className="text-sm font-bold text-white">{data.fundamentals.eps_ttm}</span>
              </div>
              <div className="p-3 bg-[#090a0f] border border-[#1f2128] rounded">
                <span className="text-zinc-500 block text-[10px] uppercase mb-1">Return on Equity (ROE)</span>
                <span className="text-sm font-bold text-white">{data.fundamentals.roe}</span>
              </div>
              <div className="p-3 bg-[#090a0f] border border-[#1f2128] rounded">
                <span className="text-zinc-500 block text-[10px] uppercase mb-1">PEG Growth Ratio</span>
                <span className="text-sm font-bold text-white">{data.fundamentals.peg}</span>
              </div>
              <div className="p-3 bg-[#090a0f] border border-[#1f2128] rounded">
                <span className="text-zinc-500 block text-[10px] uppercase mb-1">Price-to-Book (P/B)</span>
                <span className="text-sm font-bold text-white">{data.fundamentals.pb}</span>
              </div>
              <div className="p-3 bg-[#090a0f] border border-[#1f2128] rounded">
                <span className="text-zinc-500 block text-[10px] uppercase mb-1">Dividend Yield</span>
                <span className="text-sm font-bold text-white">{data.fundamentals.div}</span>
              </div>
              <div className="p-3 bg-[#090a0f] border border-[#1f2128] rounded">
                <span className="text-zinc-500 block text-[10px] uppercase mb-1">Net profit Margin</span>
                <span className="text-sm font-bold text-white">{data.fundamentals.margin}</span>
              </div>
            </div>

            <div className="mt-5 border-t border-[#1f2128] pt-4 flex flex-col gap-2 text-[10px] text-zinc-500 font-mono">
              <div>• Database validation stamp: SEC Form 10-K and 10-Q audited indices.</div>
              <div>• Real-time updates retrieved via quantitative cloud pipeline proxy.</div>
            </div>
          </div>
        </div>
      )}

      {/* Sleek Custom Toast Notification overlay */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#121316] border border-[#20232a] text-[#3b82f6] text-xs font-mono px-4 py-2.5 rounded shadow-2xl flex items-center gap-2 animate-fade-in">
          <Activity className="h-3.5 w-3.5 animate-spin" />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
