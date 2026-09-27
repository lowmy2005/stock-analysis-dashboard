import { useState, useEffect } from 'react';
import { Search, LayoutGrid, ShieldAlert, ArrowUpRight } from 'lucide-react';

interface ScreenerViewProps {
  onSelectTicker: (symbol: string) => void;
  onClose: () => void;
}

const formatScreenerCap = (val: number | undefined | null): string => {
  if (val === undefined || val === null || val === 0) return 'N/A';
  if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
  if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
  return `$${val.toLocaleString()}`;
};

export default function ScreenerView({ onSelectTicker, onClose }: ScreenerViewProps) {
  const [screenerType, setScreenerType] = useState<'most_active' | 'sp500' | 'nasdaq100'>('most_active');
  const [screenerData, setScreenerData] = useState<any[]>([]);
  const [screenerLoading, setScreenerLoading] = useState(false);
  const [screenerError, setScreenerError] = useState<string | null>(null);
  const [screenerSearchQuery, setScreenerSearchQuery] = useState('');

  useEffect(() => {
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
  }, [screenerType]);

  const filtered = screenerData.filter((stock) => {
    const q = screenerSearchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      stock.symbol.toLowerCase().includes(q) ||
      stock.name.toLowerCase().includes(q)
    );
  }).sort((a, b) => b.score - a.score);

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header & Category Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1f2128] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-[#22c55e]" />
            <h2 className="text-xl font-extrabold text-white tracking-tight uppercase font-mono">
              Institutional Intelligence Stock Screener
            </h2>
          </div>
          <p className="text-xs text-zinc-500 font-mono mt-1">
            Select market cohorts to screen live quotes, volumes, and daily metrics from Yahoo Finance
          </p>
        </div>

        {/* Back to Dashboard Link */}
        <button
          onClick={onClose}
          className="px-3.5 py-1.5 text-xs font-mono font-bold bg-[#121316] hover:bg-[#1a1b20] border border-[#20232a] text-[#8a8a8a] hover:text-white rounded transition-all cursor-pointer flex items-center gap-1.5 self-start md:self-auto"
        >
          ← Back to Dashboard
        </button>
      </div>

      {/* Selector & Search Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0f1013] border border-[#1f2128] rounded p-4">
        {/* Screener Categories */}
        <div className="flex bg-[#090a0f] p-1 rounded border border-[#20232a] text-xs font-mono">
          <button
            onClick={() => setScreenerType('most_active')}
            className={`px-4 py-2 rounded transition-all cursor-pointer font-bold uppercase tracking-wider ${
              screenerType === 'most_active'
                ? 'bg-[#22c55e]/20 text-[#22c55e]'
                : 'text-zinc-500 hover:text-white'
            }`}
          >
            Yahoo Most Active
          </button>
          <button
            onClick={() => setScreenerType('sp500')}
            className={`px-4 py-2 rounded transition-all cursor-pointer font-bold uppercase tracking-wider ${
              screenerType === 'sp500'
                ? 'bg-[#22c55e]/20 text-[#22c55e]'
                : 'text-zinc-500 hover:text-white'
            }`}
          >
            S&P 500
          </button>
          <button
            onClick={() => setScreenerType('nasdaq100')}
            className={`px-4 py-2 rounded transition-all cursor-pointer font-bold uppercase tracking-wider ${
              screenerType === 'nasdaq100'
                ? 'bg-[#22c55e]/20 text-[#22c55e]'
                : 'text-zinc-500 hover:text-white'
            }`}
          >
            Nasdaq 100
          </button>
        </div>

        {/* Live Filter Input */}
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            placeholder="Filter by ticker or name..."
            value={screenerSearchQuery}
            onChange={(e) => setScreenerSearchQuery(e.target.value)}
            className="w-full pl-8 pr-4 py-2 text-xs font-mono bg-[#090a0f] border border-[#20232a] hover:border-[#22c55e]/50 focus:border-[#22c55e] rounded text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#22c55e]"
          />
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-600" />
        </div>
      </div>

      {/* Main Error Alert */}
      {screenerError && (
        <div className="bg-red-500/5 border border-red-500/20 text-red-200 p-5 rounded text-xs font-mono leading-relaxed flex items-start gap-3 animate-fade-in">
          <ShieldAlert className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-red-400 uppercase tracking-wider mr-1">Screener Error:</span> {screenerError}
          </div>
        </div>
      )}

      {/* Grid/List Results */}
      {screenerLoading ? (
        <div className="min-h-[40vh] flex flex-col items-center justify-center gap-4">
          <div className="relative h-10 w-10">
            <div className="absolute inset-0 rounded border-2 border-zinc-800" />
            <div className="absolute inset-0 rounded border-2 border-t-[#22c55e] animate-spin" />
          </div>
          <p className="text-xs font-mono text-[#8a8a8a] uppercase tracking-widest animate-pulse">
            Scanning market coordinates...
          </p>
        </div>
      ) : (
        <div className="bg-[#0f1013] border border-[#1f2128] rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-mono text-xs">
              <thead>
                <tr className="border-b border-[#1f2128] bg-[#0c0d12] text-zinc-500 font-bold uppercase text-[10px] tracking-wider">
                  <th className="p-4">Ticker</th>
                  <th className="p-4">Company Name</th>
                  <th className="p-4 text-right">Price</th>
                  <th className="p-4 text-right">Change</th>
                  <th className="p-4 text-right">Change %</th>
                  <th className="p-4 text-right">Volume</th>
                  <th className="p-4 text-right">Market Cap</th>
                  <th className="p-4 text-center">Score</th>
                  <th className="p-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1f2128]/40">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-zinc-500">
                      No matching equities identified in this cohort query.
                    </td>
                  </tr>
                ) : (
                  filtered.map((stock) => {
                    const isUp = stock.change >= 0;
                    return (
                      <tr
                        key={stock.symbol}
                        className="hover:bg-[#121316]/50 transition-all group border-b border-[#1f2128]/40"
                      >
                        <td className="p-4 font-bold text-white group-hover:text-[#22c55e] transition-colors font-mono">
                          {stock.symbol}
                        </td>
                        <td className="p-4 text-zinc-400 font-medium max-w-xs truncate">
                          {stock.name}
                        </td>
                        <td className="p-4 text-right font-bold text-zinc-100 font-mono">
                          ${stock.price.toFixed(2)}
                        </td>
                        <td
                          className={`p-4 text-right font-bold font-mono ${
                            isUp ? 'text-[#22c55e]' : 'text-[#ef4444]'
                          }`}
                        >
                          {isUp ? '+' : ''}
                          {stock.change.toFixed(2)}
                        </td>
                        <td
                          className={`p-4 text-right font-bold font-mono ${
                            isUp ? 'text-[#22c55e]' : 'text-[#ef4444]'
                          }`}
                        >
                          {isUp ? '+' : ''}
                          {stock.changePercent.toFixed(2)}%
                        </td>
                        <td className="p-4 text-right text-zinc-400 font-mono">
                          {stock.volume.toLocaleString()}
                        </td>
                        <td className="p-4 text-right text-zinc-400 font-mono">
                          {stock.marketCap > 0 ? formatScreenerCap(stock.marketCap) : 'N/A'}
                        </td>
                        <td className="p-4 text-center font-bold font-mono text-[#22c55e]">
                          {stock.score}
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => onSelectTicker(stock.symbol)}
                            className="px-3 py-1.5 bg-[#121316] hover:bg-[#22c55e]/20 hover:text-[#22c55e] border border-[#20232a] group-hover:border-[#22c55e]/30 rounded text-zinc-400 font-bold transition-all cursor-pointer text-[10px] tracking-wider uppercase inline-flex items-center gap-1 font-mono"
                          >
                            Analyze <ArrowUpRight className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
