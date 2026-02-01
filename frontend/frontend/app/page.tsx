"use client";
import axios from 'axios';
import { AlertTriangle, BrainCircuit, CheckCircle, Database, Info, LayoutDashboard, Search, ShieldAlert, ShieldCheck, Star, XCircle, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';

// --- TYPE DEFINITIONS ---
interface Review {
  text: string;
  stars: number;
  is_fake: boolean;
  is_mismatch: boolean;
}

interface EvidenceItem {
  word: string;
  impact: string;
  color: string;
}

interface RawExplanationItem {
  word: string;
  score: number;
}

interface TrustBadge {
  label: string;
  type: string;
  icon: string;
}

interface AuditReport {
  risk_score: number;
  verdict: string;
  verdict_color: string;
  summary: string;
  trust_badges: TrustBadge[];
  sentiment_score: number;
  rating_score: number;
  consistency_gap: number;
  evidence: EvidenceItem[];
  raw_explanation: RawExplanationItem[];
}

interface DashboardData {
  stats: {
    trust_score: number;
    real: number;
    fakes: number;
    total: number;
  };
  reviews: Review[];
}

export default function Home() {
  // --- STATE ---
  const [activeTab, setActiveTab] = useState<'search' | 'live'>('search');

  // Search Mode State
  const [restaurants, setRestaurants] = useState<string[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState('');
  const [data, setData] = useState<DashboardData | null>(null);

  // Live Audit Mode State
  const [liveText, setLiveText] = useState('');
  const [liveStars, setLiveStars] = useState(5);
  const [liveReport, setLiveReport] = useState<AuditReport | null>(null);

  // Common State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // CHANGE THIS TO YOUR LIVE BACKEND URL
  const API_URL = "https://nickolaitheek-trustxplain-backend.hf.space";

  const isLanding = !data && !liveReport && !loading;

  useEffect(() => {
    axios.get(`${API_URL}/restaurants`)
      .then(res => setRestaurants(res.data))
      .catch(err => {
        console.error("Backend Error:", err);
      });
  }, []);

  const handleSearch = async (name: string) => {
    setSelectedRestaurant(name);
    setLoading(true);
    setError('');
    setData(null);
    try {
      const res = await axios.get(`${API_URL}/search?name=${encodeURIComponent(name)}`);
      setData(res.data);
    } catch (err) {
      setError("Could not load data. The backend might be busy.");
    }
    setLoading(false);
  };

  const handleLiveAudit = async () => {
    if (!liveText) return;
    setLoading(true);
    setLiveReport(null);
    setError('');
    try {
      const res = await axios.post(`${API_URL}/explain`, { text: liveText, stars: liveStars });
      setLiveReport(res.data);
    } catch (err) {
      setError("Analysis failed. Backend might be warming up.");
    }
    setLoading(false);
  }

  // --- 1. LANDING SCREEN (With Tabs) ---
  if (isLanding) {
    return (
      <div className="min-h-screen font-sans bg-[url('/hero-bg.png')] bg-cover bg-bottom bg-no-repeat flex flex-col items-center justify-center p-4">

        <div className="text-center max-w-5xl px-4 -mt-20 animate-fade-in-up w-full">
          {/* LOGO */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg shadow-blue-600/20">
              <ShieldCheck className="text-white" size={32} strokeWidth={2} />
            </div>
            <h1 className="text-4xl font-bold text-blue-600 tracking-tight">TrustXplain</h1>
          </div>

          <h2 className="text-4xl md:text-5xl font-extrabold text-blue-900 mb-8 leading-tight drop-shadow-sm">
            AI Credibility Inspector
          </h2>

          {/* TABS SWITCHER */}
          <div className="flex justify-center mb-8">
            <div className="bg-white p-1 rounded-full shadow-md border border-gray-200 inline-flex">
              {/* RENAMED TAB HERE */}
              <button
                onClick={() => setActiveTab('search')}
                className={`px-6 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'search' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
              >
                <Database size={16} /> Restaurant Domain
              </button>
              <button
                onClick={() => setActiveTab('live')}
                className={`px-6 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'live' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
              >
                <Zap size={16} /> Live Audit
              </button>
            </div>
          </div>

          {/* INPUT AREA (Swaps based on Tab) */}
          {activeTab === 'search' ? (
            // TAB 1: DB SEARCH
            <div className="max-w-2xl mx-auto bg-white rounded-full shadow-2xl p-2 flex items-center border border-blue-50 mb-12 transition-transform hover:scale-[1.01]">
              <Search className="text-gray-400 ml-5" size={22} />
              <div className="flex-1 relative">
                <select
                  className="w-full bg-transparent border-none outline-none text-gray-700 text-lg px-4 py-3 appearance-none cursor-pointer placeholder-gray-400"
                  onChange={(e) => handleSearch(e.target.value)}
                  defaultValue=""
                >
                  <option value="" disabled>Search demo database...</option>
                  {restaurants.map((r, i) => <option key={i} value={r}>{r}</option>)}
                </select>
              </div>
              <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-full shadow-md">Search</button>
            </div>
          ) : (
            // TAB 2: LIVE AUDIT INPUT
            <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-2xl p-6 border border-blue-50 mb-12 text-left">
              <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Paste Any Review Text</label>
              <textarea
                className="w-full p-3 bg-gray-50 rounded-lg border border-gray-200 text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none h-32 resize-none mb-4"
                placeholder="Paste a review from Google Maps, Yelp, or Facebook here..."
                onChange={(e) => setLiveText(e.target.value)}
              ></textarea>

              <div className="flex justify-between items-center">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Star Rating</label>
                  <div className="flex gap-1 text-yellow-400 cursor-pointer">
                    {[1, 2, 3, 4, 5].map(star => (
                      <Star
                        key={star}
                        size={24}
                        fill={star <= liveStars ? "currentColor" : "none"}
                        onClick={() => setLiveStars(star)}
                      />
                    ))}
                  </div>
                </div>
                <button
                  onClick={handleLiveAudit}
                  disabled={!liveText}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Zap size={18} /> Analyze Now
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- 2. RESULTS VIEW (DASHBOARD or SINGLE RESULT) ---
  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans antialiased">
      {/* HEADER */}
      <div className="max-w-5xl mx-auto mb-8 flex justify-between items-center animate-fade-in">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => { setData(null); setLiveReport(null); }}>
          <ShieldCheck size={28} className="text-blue-600" />
          <h1 className="text-xl font-bold text-gray-900">TrustXplain</h1>
        </div>
        <button onClick={() => { setData(null); setLiveReport(null); }} className="text-sm font-bold text-gray-500 hover:text-blue-600">
          Start New Analysis
        </button>
      </div>

      {/* LOADING */}
      {loading && (
        <div className="text-center mt-20 animate-fade-in">
          <div className="inline-flex flex-col items-center gap-4 p-8 bg-white rounded-2xl shadow-sm border border-gray-100">
            <BrainCircuit className="animate-spin text-blue-600" size={48} />
            <span className="text-lg font-medium text-gray-600">Running AI Inference & XAI Logic...</span>
          </div>
        </div>
      )}

      {/* ERROR */}
      {error && (
        <div className="max-w-xl mx-auto mt-8 text-center bg-red-50 p-6 rounded-xl border border-red-200 shadow-sm animate-fade-in">
          <AlertTriangle className="mx-auto text-red-500 mb-2" size={32} />
          <p className="text-red-700 font-medium">{error}</p>
        </div>
      )}

      {/* --- SCENARIO A: DATABASE RESULTS --- */}
      {data && !loading && (
        <main className="max-w-5xl mx-auto animate-fade-in w-full">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
            <MetricCard label="Trust Score" value={`${data.stats.trust_score}/100`} icon={<ShieldCheck className="text-blue-600" />} color="blue" />
            <MetricCard label="Genuine Reviews" value={data.stats.real} icon={<CheckCircle className="text-green-600" />} color="green" />
            <MetricCard label="Suspicious Reviews" value={data.stats.fakes} icon={<XCircle className="text-red-600" />} color="red" />
            <MetricCard label="Rating Mismatches" value={data.reviews.filter(r => r.is_mismatch).length} icon={<AlertTriangle className="text-orange-600" />} color="orange" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2"><LayoutDashboard size={24} className="text-gray-400" /> Database Results</h2>
          <div className="space-y-6">
            {data.reviews.map((review, idx) => (
              <ReviewCard key={idx} review={review} apiUrl={API_URL} />
            ))}
          </div>
        </main>
      )}

      {/* --- SCENARIO B: LIVE AUDIT RESULT --- */}
      {liveReport && !loading && (
        <main className="max-w-3xl mx-auto animate-fade-in w-full">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
              <Zap size={24} className="text-yellow-500 fill-current" /> Live Audit Report
            </h2>
            <p className="text-gray-500">Real-time analysis of your custom text.</p>
          </div>

          {/* Render the Report View Directly */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-md">
            <div className="mb-6 p-4 bg-gray-50 rounded-lg italic text-gray-700 border-l-4 border-blue-400">
              "{liveText}"
            </div>
            {/* Reuse the Professional Audit Report Component Logic */}
            <AuditResultView report={liveReport} onClose={() => { }} isStatic={true} />
          </div>
        </main>
      )}
    </div>
  );
}

// --- METRIC CARD ---
function MetricCard({ label, value, icon, color }: any) {
  const colors: any = {
    blue: "bg-blue-50 border-blue-200 hover:border-blue-300",
    green: "bg-green-50 border-green-200 hover:border-green-300",
    red: "bg-red-50 border-red-200 hover:border-red-300",
    orange: "bg-orange-50 border-orange-200 hover:border-orange-300"
  };
  return (
    <div className={`p-6 rounded-2xl border transition-all duration-200 ${colors[color]} text-center shadow-sm hover:shadow-md hover:-translate-y-1`}>
      <div className="flex justify-center mb-3 scale-110 transform">{icon}</div>
      <div className="text-3xl font-extrabold text-gray-900 mb-1">{value}</div>
      <div className="text-xs text-gray-600 uppercase tracking-wider font-bold">{label}</div>
    </div>
  );
}

// --- REVIEW CARD (Wrapper for Database items) ---
function ReviewCard({ review, apiUrl }: { review: Review, apiUrl: string }) {
  const [report, setReport] = useState<AuditReport | null>(null);
  const [loading, setLoading] = useState(false);

  const handleExplain = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${apiUrl}/explain`, { text: review.text, stars: review.stars });
      setReport(res.data);
    } catch (err) {
      alert("Analysis failed.");
    }
    setLoading(false);
  };

  const isHighRisk = review.is_fake;

  return (
    <div className={`bg-white p-6 rounded-xl border shadow-sm hover:shadow-md transition-all duration-200 ${isHighRisk ? 'border-red-100' : 'border-gray-200'}`}>
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wide ${isHighRisk ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-green-100 text-green-800 border border-green-200'}`}>
            {isHighRisk ? "🚨 Suspicious" : "✅ Genuine"}
          </span>
          <div className="flex items-center text-yellow-400">
            {[...Array(5)].map((_, i) => (<Star key={i} size={18} fill={i < review.stars ? "currentColor" : "none"} strokeWidth={1.5} />))}
          </div>
        </div>
      </div>

      {!report && <p className="text-gray-700 mb-4 leading-relaxed text-[15px]">{review.text}</p>}

      {report && (
        <AuditResultView report={report} onClose={() => setReport(null)} isStatic={false} />
      )}

      {!report && (
        <button onClick={handleExplain} disabled={loading} className="flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors">
          {loading ? <BrainCircuit size={16} className="animate-spin" /> : <BrainCircuit size={16} />}
          Run Deep Audit
        </button>
      )}
    </div>
  );
}

// --- REUSABLE AUDIT RESULT VIEW (WITH YELLOW LIGHT FIX) ---
function AuditResultView({ report, onClose, isStatic }: { report: AuditReport, onClose: () => void, isStatic: boolean }) {

  // 🔥 FIX: Mapping colors based on backend verdict_color (red, orange, green)
  const theme = {
    red: {
      border: "border-red-200",
      bg: "bg-red-50/30",
      headerBg: "bg-red-100/80",
      headerText: "text-red-900",
      icon: <ShieldAlert size={18} />
    },
    orange: {
      border: "border-yellow-200",
      bg: "bg-yellow-50/30",
      headerBg: "bg-yellow-100/80",
      headerText: "text-yellow-900",
      icon: <AlertTriangle size={18} />
    },
    green: {
      border: "border-green-200",
      bg: "bg-green-50/30",
      headerBg: "bg-green-100/80",
      headerText: "text-green-900",
      icon: <ShieldCheck size={18} />
    }
  }[report.verdict_color] || { // Fallback
    border: "border-gray-200", bg: "bg-gray-50", headerBg: "bg-gray-100", headerText: "text-gray-900", icon: <Info size={18} />
  };

  return (
    <div className={`rounded-lg border overflow-hidden animate-fade-in mb-4 shadow-inner ${theme.border} ${theme.bg}`}>
      {/* HEADER */}
      <div className={`p-4 border-b flex justify-between items-center ${theme.headerBg} ${theme.border}`}>
        <h4 className={`font-black text-sm uppercase tracking-wider flex items-center gap-2 ${theme.headerText}`}>
          {theme.icon}
          Credibility Audit: {report.verdict}
        </h4>
        {!isStatic && <button onClick={onClose} className="text-xs font-bold text-gray-500 hover:text-gray-800">CLOSE</button>}
      </div>

      <div className="p-5 bg-white/60 backdrop-blur-sm">
        {/* BADGES */}
        <div className="flex flex-wrap gap-2 mb-6">
          {report.trust_badges?.map((badge, i) => (
            <span key={i} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wide border shadow-sm ${badge.type === 'green' ? 'bg-green-100 text-green-800 border-green-200' : badge.type === 'blue' ? 'bg-blue-100 text-blue-800 border-blue-200' : badge.type === 'yellow' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : 'bg-red-100 text-red-800 border-red-200'}`}>
              <span className="text-base">{badge.icon}</span> {badge.label}
            </span>
          ))}
        </div>

        {/* SUMMARY */}
        <div className="mb-8">
          <h5 className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1"><Info size={14} /> Analysis Summary</h5>
          <p className="text-sm text-gray-800 leading-7 font-medium bg-white p-4 rounded-lg border border-gray-200 shadow-sm">{report.summary}</p>
        </div>

        {/* CONSISTENCY BAR */}
        <div className="mb-8 bg-gray-50 p-5 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex justify-between items-end mb-4">
            <h5 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1"><BrainCircuit size={14} /> Consistency Check</h5>
            {report.consistency_gap > 35 && <span className="text-xs font-extrabold text-red-600 flex items-center gap-1 bg-red-100 px-2 py-1 rounded-full border border-red-200 animate-pulse"><AlertTriangle size={14} /> Mismatch</span>}
          </div>
          {/* Bars */}
          <div className="mb-4 relative">
            <div className="flex justify-between text-xs font-bold text-gray-700 mb-1"><span>Star Rating Value</span><span>{report.rating_score}%</span></div>
            <div className="w-full bg-gray-200 rounded-full h-3 shadow-inner"><div className="bg-gradient-to-r from-yellow-300 to-yellow-500 h-3 rounded-full" style={{ width: `${report.rating_score}%` }}></div></div>
          </div>
          <div className="relative">
            <div className="flex justify-between text-xs font-bold text-gray-700 mb-1"><span>Text Sentiment Score</span><span>{report.sentiment_score}%</span></div>
            <div className="w-full bg-gray-200 rounded-full h-3 shadow-inner"><div className={`h-3 rounded-full ${report.sentiment_score < 40 ? 'bg-gradient-to-r from-red-400 to-red-600' : 'bg-gradient-to-r from-blue-400 to-blue-600'}`} style={{ width: `${report.sentiment_score}%` }}></div></div>
          </div>
        </div>

        {/* EVIDENCE HIGHLIGHTS */}
        <div>
          <h5 className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1"><Search size={14} /> Evidence Highlights (Hover)</h5>
          <div className="text-gray-800 text-[15px] leading-8 bg-white p-5 rounded-lg border border-gray-200 font-mono shadow-sm">
            {report.raw_explanation?.map((item, i) => {
              if (item.score > 0.05) return <HighlightWithTooltip key={i} word={item.word} colorClass="bg-red-100 text-red-900 border-b-2 border-red-400 hover:bg-red-200" tooltipText={`+${Math.round(item.score * 100)}% to FAKE`} />;
              if (item.score < -0.05) return <HighlightWithTooltip key={i} word={item.word} colorClass="bg-green-100 text-green-900 border-b-2 border-green-400 hover:bg-green-200" tooltipText={`+${Math.round(Math.abs(item.score) * 100)}% to GENUINE`} />;
              return <span key={i}>{item.word} </span>;
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- HELPER ---
function HighlightWithTooltip({ word, colorClass, tooltipText }: { word: string, colorClass: string, tooltipText: string }) {
  return (
    <span className="group relative inline-block cursor-help">
      <span className={`px-1 rounded-sm transition-colors ${colorClass}`}>{word}</span>
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-3 py-2 bg-gray-900 text-white text-xs font-bold rounded-md opacity-0 transform scale-95 transition-all duration-200 group-hover:opacity-100 group-hover:scale-100 shadow-lg z-50 whitespace-nowrap">
        {tooltipText}<span className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></span>
      </span>
      <span> </span>
    </span>
  );
}