import { useState, useMemo } from 'react';
import {
  ExternalLink,
  Globe,
  Shield,
  RefreshCw,
  Search,
  ArrowUpRight,
  Check,
  Copy,
  Flame,
  Layers,
  Sparkles,
  ArrowLeft,
  Info,
  TrendingUp,
  Cpu,
  Lock,
} from 'lucide-react';

interface UsReportsViewProps {
  onSelectTicker: (symbol: string) => void;
  onClose: () => void;
}

interface Top50Constituent {
  rank: number;
  symbol: string;
  name: string;
  sector: string;
  highlight: string;
}

const US_TOP_50: Top50Constituent[] = [
  { rank: 1, symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology', highlight: 'Consumer Electronics, Services & Edge AI' },
  { rank: 2, symbol: 'MSFT', name: 'Microsoft Corporation', sector: 'Technology', highlight: 'Cloud Infrastructure & Enterprise Copilot AI' },
  { rank: 3, symbol: 'NVDA', name: 'NVIDIA Corporation', sector: 'Technology', highlight: 'Accelerated Computing & AI Data Center GPUs' },
  { rank: 4, symbol: 'AMZN', name: 'Amazon.com Inc.', sector: 'Consumer Cyclical', highlight: 'AWS Cloud Architecture & Global E-Commerce' },
  { rank: 5, symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'Communication Services', highlight: 'Search Engine, YouTube & Gemini AI Systems' },
  { rank: 6, symbol: 'META', name: 'Meta Platforms Inc.', sector: 'Communication Services', highlight: 'Social Ecosystems & Open Llama AI Models' },
  { rank: 7, symbol: 'TSLA', name: 'Tesla Inc.', sector: 'Consumer Cyclical', highlight: 'Electric Vehicles, Energy & Full Self-Driving' },
  { rank: 8, symbol: 'BRK-B', name: 'Berkshire Hathaway Inc.', sector: 'Financial', highlight: 'Insurance Operations, Rail & Sovereign Holdings' },
  { rank: 9, symbol: 'LLY', name: 'Eli Lilly and Company', sector: 'Healthcare', highlight: 'GLP-1 Metabolic Weight Loss & Oncology' },
  { rank: 10, symbol: 'AVGO', name: 'Broadcom Inc.', sector: 'Technology', highlight: 'Semiconductor Custom Silicon & Infrastructure Software' },
  { rank: 11, symbol: 'JPM', name: 'JPMorgan Chase & Co.', sector: 'Financial', highlight: 'Global Investment & Commercial Banking Leader' },
  { rank: 12, symbol: 'V', name: 'Visa Inc.', sector: 'Financial', highlight: 'Global Electronic Payments & Settlement Network' },
  { rank: 13, symbol: 'UNH', name: 'UnitedHealth Group Inc.', sector: 'Healthcare', highlight: 'Managed Healthcare & Optum Health Services' },
  { rank: 14, symbol: 'XOM', name: 'Exxon Mobil Corp.', sector: 'Energy', highlight: 'Global Integrated Hydrocarbons & Refined Energy' },
  { rank: 15, symbol: 'MA', name: 'Mastercard Inc.', sector: 'Financial', highlight: 'Payment Processing & Cross-Border Clearing' },
  { rank: 16, symbol: 'COST', name: 'Costco Wholesale Corp.', sector: 'Consumer Defensive', highlight: 'Subscription Membership Retail Distribution' },
  { rank: 17, symbol: 'PG', name: 'Procter & Gamble Co.', sector: 'Consumer Defensive', highlight: 'Global Household Brands & Essential Consumer Goods' },
  { rank: 18, symbol: 'HD', name: 'Home Depot Inc.', sector: 'Consumer Cyclical', highlight: 'Home Improvement Retail & Professional Supply' },
  { rank: 19, symbol: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare', highlight: 'Innovative Pharmaceuticals & MedTech Equipment' },
  { rank: 20, symbol: 'NFLX', name: 'Netflix Inc.', sector: 'Communication Services', highlight: 'Direct-to-Consumer Streaming & Content Studio' },
  { rank: 21, symbol: 'BAC', name: 'Bank of America Corp.', sector: 'Financial', highlight: 'Consumer Banking, Wealth Management & Lending' },
  { rank: 22, symbol: 'ABBV', name: 'AbbVie Inc.', sector: 'Healthcare', highlight: 'Immunology, Oncology & Targeted Biopharma' },
  { rank: 23, symbol: 'CRM', name: 'Salesforce Inc.', sector: 'Technology', highlight: 'Enterprise CRM Cloud & Autonomous Agentforce' },
  { rank: 24, symbol: 'WMT', name: 'Walmart Inc.', sector: 'Consumer Defensive', highlight: 'Omnichannel Retail Scale & Logistics Automation' },
  { rank: 25, symbol: 'CVX', name: 'Chevron Corp.', sector: 'Energy', highlight: 'Deepwater Drilling, LNG & Downstream Refining' },
  { rank: 26, symbol: 'MRK', name: 'Merck & Co. Inc.', sector: 'Healthcare', highlight: 'Keytruda Immuno-Oncology & Life Science Vaccines' },
  { rank: 27, symbol: 'KO', name: 'The Coca-Cola Company', sector: 'Consumer Defensive', highlight: 'Worldwide Beverage Licensing & Direct Distribution' },
  { rank: 28, symbol: 'AMD', name: 'Advanced Micro Devices', sector: 'Technology', highlight: 'Data Center EPYC CPUs & Instinct MI300 AI Chips' },
  { rank: 29, symbol: 'PEP', name: 'PepsiCo Inc.', sector: 'Consumer Defensive', highlight: 'Global Snacks, Foods & Carbonated Beverages' },
  { rank: 30, symbol: 'ORCL', name: 'Oracle Corporation', sector: 'Technology', highlight: 'Mission-Critical Autonomous Databases & OCI' },
  { rank: 31, symbol: 'LIN', name: 'Linde plc', sector: 'Basic Materials', highlight: 'Industrial Gases, Hydrogen & Engineering Facilities' },
  { rank: 32, symbol: 'ADBE', name: 'Adobe Inc.', sector: 'Technology', highlight: 'Digital Content Creation, Firefly GenAI & Creative Cloud' },
  { rank: 33, symbol: 'MCD', name: 'McDonald\'s Corp.', sector: 'Consumer Cyclical', highlight: 'Global Fast-Food Franchise Footprint & Real Estate' },
  { rank: 34, symbol: 'TMO', name: 'Thermo Fisher Scientific', sector: 'Healthcare', highlight: 'Analytical Instruments, Bioscience Reagents & Labs' },
  { rank: 35, symbol: 'CSCO', name: 'Cisco Systems Inc.', sector: 'Technology', highlight: 'Enterprise Ethernet Switches, Routers & Splunk Security' },
  { rank: 36, symbol: 'WFC', name: 'Wells Fargo & Company', sector: 'Financial', highlight: 'Commercial Financing, Mortgages & Corporate Lending' },
  { rank: 37, symbol: 'GE', name: 'GE Aerospace', sector: 'Industrials', highlight: 'Commercial Jet Engines & Defense Propulsion' },
  { rank: 38, symbol: 'QCOM', name: 'QUALCOMM Inc.', sector: 'Technology', highlight: 'Snapdragon Mobile SoCs & Automotive Telematics' },
  { rank: 39, symbol: 'ACN', name: 'Accenture plc', sector: 'Technology', highlight: 'Global System Integration & Cloud Migration Advisory' },
  { rank: 40, symbol: 'INTU', name: 'Intuit Inc.', sector: 'Technology', highlight: 'Small Business TurboTax, QuickBooks & Credit Karma' },
  { rank: 41, symbol: 'AMAT', name: 'Applied Materials Inc.', sector: 'Technology', highlight: 'Semiconductor Wafer Fabrication Equipment' },
  { rank: 42, symbol: 'IBM', name: 'International Business Machines', sector: 'Technology', highlight: 'Hybrid Cloud Red Hat & Enterprise watsonx AI' },
  { rank: 43, symbol: 'TXN', name: 'Texas Instruments Inc.', sector: 'Technology', highlight: 'Analog Semiconductors & Embedded Auto Processors' },
  { rank: 44, symbol: 'DHR', name: 'Danaher Corporation', sector: 'Healthcare', highlight: 'Bioprocessing, Medical Diagnostics & Filtration' },
  { rank: 45, symbol: 'CAT', name: 'Caterpillar Inc.', sector: 'Industrials', highlight: 'Heavy Construction Excavators & Mining Machinery' },
  { rank: 46, symbol: 'DIS', name: 'The Walt Disney Company', sector: 'Communication Services', highlight: 'Theme Parks, Theatrical IP, Disney+ & ESPN' },
  { rank: 47, symbol: 'PM', name: 'Philip Morris International', sector: 'Consumer Defensive', highlight: 'IQOS Heated Tobacco & Reduced-Risk Products' },
  { rank: 48, symbol: 'NOW', name: 'ServiceNow Inc.', sector: 'Technology', highlight: 'Now Platform Enterprise Workflow Orchestration' },
  { rank: 49, symbol: 'ISRG', name: 'Intuitive Surgical Inc.', sector: 'Healthcare', highlight: 'da Vinci Robotic Minimally Invasive Systems' },
  { rank: 50, symbol: 'NEE', name: 'NextEra Energy Inc.', sector: 'Utilities', highlight: 'Florida Power & Light + North America Clean Wind/Solar' },
];

const SECTORS = [
  'All',
  'Technology',
  'Healthcare',
  'Financial',
  'Consumer Cyclical',
  'Consumer Defensive',
  'Communication Services',
  'Industrials',
  'Energy',
  'Basic Materials',
  'Utilities',
];

export default function UsReportsView({ onSelectTicker, onClose }: UsReportsViewProps) {
  const [activeTab, setActiveTab] = useState<'portal' | 'constituents' | 'strategy'>('portal');
  const [targetUrl, setTargetUrl] = useState<'us' | 'portal'>('us');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState('All');
  const [iframeKey, setIframeKey] = useState(0);
  const [copied, setCopied] = useState(false);

  const reportUrl = targetUrl === 'us'
    ? 'https://stock-reports.omnigo.workers.dev/us/'
    : 'https://stock-reports.omnigo.workers.dev/';

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(reportUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredStocks = useMemo(() => {
    return US_TOP_50.filter((item) => {
      const matchSearch =
        item.symbol.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        item.highlight.toLowerCase().includes(searchQuery.toLowerCase().trim());
      const matchSector = selectedSector === 'All' || item.sector === selectedSector;
      return matchSearch && matchSector;
    });
  }, [searchQuery, selectedSector]);

  return (
    <div className="animate-fade-in space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#1f2128] pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#6366f1]/15 text-[#818cf8] border border-[#6366f1]/30">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold text-white tracking-tight uppercase font-mono">
                  InvestMate · 美股 Top 50 投資報告
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#6366f1]/20 text-[#a5b4fc] border border-[#6366f1]/30">
                  HERMES AI
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#22c55e]/15 text-[#4ade80] border border-[#22c55e]/30">
                  DAILY ACTIVE
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-mono mt-1">
                每日盤後自動更新 · 動能 + 品質雙因子量化模型 · 部署於 Cloudflare Edge
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href="https://stock-reports.omnigo.workers.dev/us/"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 text-xs font-mono font-bold bg-gradient-to-r from-[#6366f1] to-[#4f46e5] hover:from-[#4f46e5] hover:to-[#4338ca] text-white rounded transition-all cursor-pointer flex items-center gap-2 shadow-[0_0_15px_rgba(99,102,241,0.35)]"
          >
            <span>開啟完整報告</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>

          <a
            href="https://stock-reports.omnigo.workers.dev/"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 text-xs font-mono font-semibold bg-[#121316] hover:bg-[#1a1b20] border border-[#20232a] hover:border-[#6366f1] text-[#a5b4fc] rounded transition-all cursor-pointer flex items-center gap-1.5"
          >
            <span>InvestMate 首頁</span>
            <ArrowUpRight className="h-3.5 w-3.5 text-zinc-400" />
          </a>

          <button
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-mono font-bold bg-[#121316] hover:bg-[#1a1b20] border border-[#20232a] text-[#8a8a8a] hover:text-white rounded transition-all cursor-pointer flex items-center gap-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>返回儀表板</span>
          </button>
        </div>
      </div>

      {/* Highlights KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-[#0f1013] border border-[#1f2128] rounded-lg p-4">
          <div className="flex items-center justify-between text-xs font-mono text-zinc-400 mb-2">
            <span className="uppercase">資產覆蓋</span>
            <Flame className="h-4 w-4 text-[#818cf8]" />
          </div>
          <div className="text-xl font-extrabold text-white font-mono">美股 Top 50 權值</div>
          <div className="text-[11px] text-zinc-500 font-mono mt-1">涵蓋 S&P 500 與 NASDAQ 最關鍵核心標的</div>
        </div>

        <div className="bg-[#0f1013] border border-[#1f2128] rounded-lg p-4">
          <div className="flex items-center justify-between text-xs font-mono text-zinc-400 mb-2">
            <span className="uppercase">更新頻率</span>
            <RefreshCw className="h-4 w-4 text-[#22c55e]" />
          </div>
          <div className="text-xl font-extrabold text-white font-mono">美股收盤後更新</div>
          <div className="text-[11px] text-zinc-500 font-mono mt-1">每日結算後運算多因子訊號與技術指標</div>
        </div>

        <div className="bg-[#0f1013] border border-[#1f2128] rounded-lg p-4">
          <div className="flex items-center justify-between text-xs font-mono text-zinc-400 mb-2">
            <span className="uppercase">評估維度</span>
            <Cpu className="h-4 w-4 text-[#d4af37]" />
          </div>
          <div className="text-xl font-extrabold text-white font-mono">動能 + 品質雙因子</div>
          <div className="text-[11px] text-zinc-500 font-mono mt-1">兼顧短中線趨勢爆發力與基本面防禦性</div>
        </div>

        <div className="bg-[#0f1013] border border-[#1f2128] rounded-lg p-4">
          <div className="flex items-center justify-between text-xs font-mono text-zinc-400 mb-2">
            <span className="uppercase">安全環境</span>
            <Shield className="h-4 w-4 text-[#60a5fa]" />
          </div>
          <div className="text-xl font-extrabold text-white font-mono">Cloudflare Access</div>
          <div className="text-[11px] text-zinc-500 font-mono mt-1">支援 Email OTP 授權與邊緣快速交付</div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-[#1f2128] pb-2 font-mono text-xs">
        <button
          onClick={() => setActiveTab('portal')}
          className={`px-4 py-2 rounded font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'portal'
              ? 'bg-[#6366f1]/20 text-[#a5b4fc] border border-[#6366f1]/40'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
          }`}
        >
          <Globe className="h-3.5 w-3.5" />
          <span>線上報告入口 (Live Portal)</span>
        </button>

        <button
          onClick={() => setActiveTab('constituents')}
          className={`px-4 py-2 rounded font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'constituents'
              ? 'bg-[#6366f1]/20 text-[#a5b4fc] border border-[#6366f1]/40'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          <span>Top 50 權值清單與直接分析 ({filteredStocks.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('strategy')}
          className={`px-4 py-2 rounded font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'strategy'
              ? 'bg-[#6366f1]/20 text-[#a5b4fc] border border-[#6366f1]/40'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>Hermes 模型策略說明</span>
        </button>
      </div>

      {/* Tab 1: Live Portal & Embedded View */}
      {activeTab === 'portal' && (
        <div className="space-y-4">
          {/* URL & Access Notice */}
          <div className="bg-[#0f1013] border border-[#1f2128] rounded-lg p-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-mono">
                  <Lock className="h-3.5 w-3.5 text-amber-400" />
                  <span className="text-zinc-300 font-bold">Cloudflare Access 授權提醒：</span>
                </div>
                <p className="text-xs text-zinc-400 font-mono leading-relaxed">
                  此報告服務 (`stock-reports.omnigo.workers.dev`) 由 Cloudflare Access 保護。現代瀏覽器因安全性標頭 (`X-Frame-Options: DENY`) 可能會限制跨網域登入表單直接內嵌。建議直接點擊右側按鈕於新視窗開啟，登入一次後即可完整流暢瀏覽！
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleCopyUrl}
                  className="px-3 py-1.5 text-xs font-mono bg-[#121316] hover:bg-[#1a1b20] border border-[#20232a] text-zinc-300 rounded flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5 text-zinc-400" />}
                  <span>{copied ? '已複製' : '複製連結'}</span>
                </button>
                <a
                  href={reportUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-1.5 text-xs font-mono font-bold bg-[#6366f1] hover:bg-[#4f46e5] text-white rounded flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                >
                  <span>新分頁開啟</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>

          {/* Embedded Viewer Shell */}
          <div className="bg-[#0f1013] border border-[#1f2128] rounded-lg overflow-hidden shadow-2xl">
            {/* Browser-like Toolbar */}
            <div className="bg-[#0a0a0f] border-b border-[#1f2128] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
                </div>
                <div className="ml-2 flex items-center gap-1.5 bg-[#121316] border border-[#20232a] rounded px-3 py-1 text-zinc-300 text-[11px] min-w-[280px]">
                  <Lock className="h-3 w-3 text-green-400" />
                  <span className="truncate">{reportUrl}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTargetUrl(targetUrl === 'us' ? 'portal' : 'us')}
                  className="px-2.5 py-1 text-[11px] bg-[#121316] hover:bg-[#1a1b20] border border-[#20232a] text-zinc-300 rounded cursor-pointer transition-all"
                >
                  切換: {targetUrl === 'us' ? '美股 Top 50 (/us/)' : '首頁總覽 (/)'}
                </button>
                <button
                  onClick={() => setIframeKey((prev) => prev + 1)}
                  className="px-2.5 py-1 text-[11px] bg-[#121316] hover:bg-[#1a1b20] border border-[#20232a] text-zinc-300 rounded flex items-center gap-1 cursor-pointer transition-all"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>重整</span>
                </button>
              </div>
            </div>

            {/* Iframe Viewport */}
            <div className="relative w-full h-[680px] bg-[#0b0f19]">
              <iframe
                key={iframeKey}
                src={reportUrl}
                title="InvestMate US Top 50 Report"
                className="w-full h-full border-0"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
              />
              
              {/* Overlay Tip in bottom corner */}
              <div className="absolute bottom-4 right-4 max-w-sm bg-[#090a0f]/90 border border-[#1f2128] backdrop-blur-md rounded-lg p-3 text-xs font-mono text-zinc-400 shadow-xl pointer-events-auto">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-[#818cf8] shrink-0 mt-0.5" />
                  <div>
                    <span className="text-white font-bold">無法載入或顯示空白？</span>
                    <p className="mt-1 text-[11px] text-zinc-400">
                      Cloudflare Access 安全防護會阻止跨站 iframe 登入。請直接點擊上方「新分頁開啟」即可順暢使用。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: US Top 50 Constituents & Deep Dive */}
      {activeTab === 'constituents' && (
        <div className="space-y-4">
          {/* Search & Sector Filters */}
          <div className="bg-[#0f1013] border border-[#1f2128] rounded-lg p-4 space-y-3 font-mono">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="搜尋代號、公司名稱或關鍵字 (例: NVDA, Apple, AI)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs bg-[#090a0f] border border-[#20232a] focus:border-[#6366f1] rounded text-white placeholder-zinc-600 focus:outline-none"
                />
              </div>

              <div className="text-xs text-zinc-400 self-center">
                顯示 <span className="text-white font-bold">{filteredStocks.length}</span> / {US_TOP_50.length} 檔標的
              </div>
            </div>

            {/* Sector Tags */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
              {SECTORS.map((sector) => (
                <button
                  key={sector}
                  onClick={() => setSelectedSector(sector)}
                  className={`px-2.5 py-1 rounded transition-all cursor-pointer whitespace-nowrap ${
                    selectedSector === sector
                      ? 'bg-[#6366f1]/20 text-[#a5b4fc] border border-[#6366f1]/40 font-bold'
                      : 'text-zinc-500 hover:text-white bg-[#090a0f] border border-[#20232a]'
                  }`}
                >
                  {sector}
                </button>
              ))}
            </div>
          </div>

          {/* Constituents Table */}
          <div className="bg-[#0f1013] border border-[#1f2128] rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-mono text-xs">
                <thead>
                  <tr className="border-b border-[#1f2128] bg-[#0c0d12] text-zinc-500 font-bold uppercase text-[10px] tracking-wider">
                    <th className="p-4 w-14 text-center">排名</th>
                    <th className="p-4">股票代號</th>
                    <th className="p-4">公司名稱</th>
                    <th className="p-4">所屬產業</th>
                    <th className="p-4">核心業務與亮點</th>
                    <th className="p-4 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1f2128]/40">
                  {filteredStocks.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-zinc-500">
                        未找到符合搜尋條件的標的。
                      </td>
                    </tr>
                  ) : (
                    filteredStocks.map((stock) => (
                      <tr
                        key={stock.symbol}
                        className="hover:bg-[#121316]/70 transition-all group border-b border-[#1f2128]/40"
                      >
                        <td className="p-4 text-center text-zinc-500 font-bold">
                          #{stock.rank}
                        </td>
                        <td className="p-4">
                          <span className="font-extrabold text-white text-sm group-hover:text-[#818cf8] transition-colors">
                            {stock.symbol}
                          </span>
                        </td>
                        <td className="p-4 font-semibold text-zinc-200">
                          {stock.name}
                        </td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 rounded text-[10px] bg-zinc-800/80 text-zinc-300 border border-zinc-700/50">
                            {stock.sector}
                          </span>
                        </td>
                        <td className="p-4 text-zinc-400 text-[11px] max-w-md">
                          {stock.highlight}
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => onSelectTicker(stock.symbol)}
                            className="px-3 py-1.5 rounded text-[11px] font-bold bg-[#6366f1]/15 hover:bg-[#6366f1]/25 border border-[#6366f1]/30 text-[#a5b4fc] transition-all cursor-pointer flex items-center gap-1 mx-auto"
                          >
                            <span>深度分析</span>
                            <ArrowUpRight className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Quantitative Model & Strategy Explanation */}
      {activeTab === 'strategy' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 font-mono">
          {/* Card 1: Momentum */}
          <div className="bg-[#0f1013] border border-[#1f2128] rounded-lg p-5 space-y-3">
            <div className="flex items-center gap-2.5 text-[#818cf8]">
              <TrendingUp className="h-5 w-5" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                1. 動能因子 (Momentum Factor)
              </h3>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              透過多週期技術路徑評估價格強弱與突破動能：
            </p>
            <ul className="text-xs text-zinc-400 space-y-2 list-disc list-inside">
              <li><strong className="text-white">相對強弱度 (RSI)：</strong> 判斷股價是否處於健康上升波段或過熱回檔區間。</li>
              <li><strong className="text-white">均線多頭排列：</strong> MA5 &gt; MA20 &gt; MA60 形成支撐保護網。</li>
              <li><strong className="text-white">成交量能爆發：</strong> 量先於價，篩選機構法人大筆資金介入之標的。</li>
              <li><strong className="text-white">新高距離：</strong> 優先挑選距離近 20/60 日高點具備續漲爆發力之標的。</li>
            </ul>
          </div>

          {/* Card 2: Quality */}
          <div className="bg-[#0f1013] border border-[#1f2128] rounded-lg p-5 space-y-3">
            <div className="flex items-center gap-2.5 text-[#22c55e]">
              <Shield className="h-5 w-5" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                2. 品質因子 (Quality Factor)
              </h3>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              聚焦企業真實獲利能力與資產負債表的防禦韌性：
            </p>
            <ul className="text-xs text-zinc-400 space-y-2 list-disc list-inside">
              <li><strong className="text-white">股東權益報酬率 (ROE)：</strong> 挑選長年維持高資本運用回報率之優質龍頭。</li>
              <li><strong className="text-white">營業利益率 (Operating Margin)：</strong> 具備護城河與定價權以對抗通膨。</li>
              <li><strong className="text-white">自由現金流覆蓋：</strong> 充沛的現金流支持持續研發、股票回購與股息分配。</li>
              <li><strong className="text-white">低財務槓桿：</strong> 負債比適中，在高利率宏觀環境下具備高抗風險能力。</li>
            </ul>
          </div>

          {/* Card 3: Hermes AI */}
          <div className="bg-[#0f1013] border border-[#1f2128] rounded-lg p-5 space-y-3">
            <div className="flex items-center gap-2.5 text-[#d4af37]">
              <Sparkles className="h-5 w-5" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                3. Hermes AI 智慧點評
              </h3>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              全自動化盤後簡報生成系統：
            </p>
            <ul className="text-xs text-zinc-400 space-y-2 list-disc list-inside">
              <li><strong className="text-white">每日美股收盤自動運算：</strong> 無需人工整理，即時計算指標。</li>
              <li><strong className="text-white">動態權重排序：</strong> 依據動能 + 品質雙因子即時調整 Top 50 投資評級。</li>
              <li><strong className="text-white">關鍵價位標示：</strong> 演算出每日關鍵阻力 (Res) 與支撐 (Sup) 點位。</li>
              <li><strong className="text-white">無縫連動本系統：</strong> 任選標的即可跳轉回本儀表板進行歷史回測與深入分析。</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
