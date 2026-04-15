"use client";
import axios from 'axios';
import { AlertTriangle, BrainCircuit, CheckCircle, Clock, Info, Search, ShieldAlert, ShieldCheck, Sparkles, Star, XCircle, Zap, ZoomIn, X } from 'lucide-react';
import { useState } from 'react';

// --- TYPE DEFINITIONS ---
interface Review {
  author: string;
  date?: string;
  text: string;
  stars: number;
  is_fake: boolean;
  is_mismatch: boolean;
}

interface EvidenceItem { word: string; impact: string; color: string; }
interface RawExplanationItem { word: string; score: number; }
interface TrustBadge { label: string; type: string; icon: string; }

// UPDATED: Added optional flags (?) to prevent strict TypeScript build errors on Vercel
interface ScorecardItem {
  aspect: string;
  score: string;
  confidence: string;
  short_quote?: string;
  detailed_summary?: string;
  evidence?: string; 
}

interface AuditReport {
  risk_score: number; verdict: string; verdict_color: string; summary: string;
  trust_badges: TrustBadge[]; sentiment_score: number; rating_score: number;
  consistency_gap: number; evidence: EvidenceItem[]; raw_explanation: RawExplanationItem[];
}

interface DashboardData {
  restaurant_name: string;
  scorecard: ScorecardItem[];
  stats: {
    trust_score: number; real: number; fakes: number; total: number;
    google_rating: number; genuine_positive: number; genuine_neutral: number; genuine_negative: number;
  };
  reviews: Review[];
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<'search' | 'live'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [scanDepth, setScanDepth] = useState<number>(20); 
  const [data, setData] = useState<DashboardData | null>(null);

  // Modal State
  const [selectedCard, setSelectedCard] = useState<ScorecardItem | null>(null);

  const [liveText, setLiveText] = useState('');
  const [liveStars, setLiveStars] = useState(5);
  const [liveReport, setLiveReport] = useState<AuditReport | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const API_URL = "https://nickolaitheek-trustxplain-backend.hf.space";
  const isLanding = !data && !liveReport && !loading;

  const handleSearch = async () => {
    if (!searchQuery) return;
    setLoading(true); setError(''); setData(null);
    try {
      const res = await axios.get(`${API_URL}/search?query=${encodeURIComponent(searchQuery)}&limit=${scanDepth}`);
      setData(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Could not fetch live reviews. Please try again.");
    }
    setLoading(false);
  };

  const handleLiveAudit = async () => {
    if (!liveText) return;
    setLoading(true); setLiveReport(null); setError('');
    try {
      const res = await axios.post(`${API_URL}/explain`, { text: liveText, stars: liveStars });
      setLiveReport(res.data);
    } catch (err) {
      setError("Analysis failed. Backend might be warming up.");
    }
    setLoading(false);
  }

  const getScoreColor = (score: number) => {
    if (score >= 4.0) return 'bg-green-500';
    if (score >= 2.5) return 'bg-yellow-400';
    if (score > 0) return 'bg-red-500';
    return 'bg-gray-300';
  };

  if (isLanding) {
    return (
      <div className="min-h-screen font-sans bg-[url('/hero-bg.png')] bg-cover bg-bottom bg-no-repeat flex flex-col items-center justify-center p-4">
        <div className="text-center max-w-5xl px-4 -mt-20 animate-fade-in-up w-full">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg shadow-blue-600/20">
              <ShieldCheck className="text-white" size={32} strokeWidth={2} />
            </div>
            <h1 className="text-4xl font-bold text-blue-600 tracking-tight">TrustXplain</h1>
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold text-blue-900 mb-8 leading-tight drop-shadow-sm">AI Credibility Inspector</h2>
          <div className="flex justify-center mb-8">
            <div className="bg-white p-1 rounded-full shadow-md border border-gray-200 inline-flex">
              <button onClick={() => setActiveTab('search')} className={`px-6 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'search' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
                <Search size={16} /> Live Search
              </button>
              <button onClick={() => setActiveTab('live')} className={`px-6 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'live' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
                <Zap size={16} /> Single Audit
              </button>
            </div>
          </div>
          {activeTab === 'search' ? (
            <div className="w-full max-w-3xl mx-auto mb-12">
              <div className="bg-white rounded-full shadow-2xl p-2 flex items-center border border-blue-50 transition-transform hover:scale-[1.01] mb-6">
                <Search className="text-gray-400 ml-5" size={22} />
                <input type="text" placeholder="Search for a restaurant..." className="flex-1 bg-transparent border-none outline-none text-gray-700 text-lg px-4 py-3 placeholder-gray-400" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
                <button onClick={handleSearch} disabled={!searchQuery} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-full shadow-md disabled:opacity-50">Search</button>
              </div>

              {/* ULTRA-MODERN MINIMALIST SCAN SELECTOR */}
              <div className="animate-fade-in-up max-w-lg mx-auto">
                <div className="flex items-center justify-center mb-2">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Scan Volume</span>
                </div>
                <div className="flex bg-white/70 backdrop-blur-md p-1.5 rounded-2xl border border-gray-200 shadow-sm">
                  <button 
                    onClick={() => setScanDepth(10)}
                    className={`flex-1 flex flex-col items-center justify-center py-3 rounded-xl transition-all duration-200 ${
                      scanDepth === 10 
                        ? 'bg-white text-blue-700 shadow-sm border border-gray-200/50' 
                        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700 border border-transparent'
                    }`}
                  >
                    <span className="font-bold text-sm">Quick Scan</span>
                    <span className={`text-[10px] font-medium mt-0.5 ${scanDepth === 10 ? 'text-gray-600' : 'text-gray-400'}`}>10 Reviews</span>
                    <span className={`text-[10px] font-bold mt-1.5 flex items-center gap-1 ${scanDepth === 10 ? 'text-blue-500' : 'text-gray-400'}`}>
                      <Clock size={11} /> 3-5 Seconds
                    </span>
                  </button>

                  <button 
                    onClick={() => setScanDepth(20)}
                    className={`flex-1 flex flex-col items-center justify-center py-3 rounded-xl transition-all duration-200 ${
                      scanDepth === 20 
                        ? 'bg-white text-blue-700 shadow-sm border border-gray-200/50' 
                        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700 border border-transparent'
                    }`}
                  >
                    <span className="font-bold text-sm">Standard</span>
                    <span className={`text-[10px] font-medium mt-0.5 ${scanDepth === 20 ? 'text-gray-600' : 'text-gray-400'}`}>20 Reviews</span>
                    <span className={`text-[10px] font-bold mt-1.5 flex items-center gap-1 ${scanDepth === 20 ? 'text-blue-500' : 'text-gray-400'}`}>
                      <Clock size={11} /> 8-15 Seconds
                    </span>
                  </button>

                  <button 
                    onClick={() => setScanDepth(50)}
                    className={`flex-1 flex flex-col items-center justify-center py-3 rounded-xl transition-all duration-200 ${
                      scanDepth === 50 
                        ? 'bg-white text-blue-700 shadow-sm border border-gray-200/50' 
                        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700 border border-transparent'
                    }`}
                  >
                    <span className="font-bold text-sm">Deep Scan</span>
                    <span className={`text-[10px] font-medium mt-0.5 ${scanDepth === 50 ? 'text-gray-600' : 'text-gray-400'}`}>50 Reviews</span>
                    <span className={`text-[10px] font-bold mt-1.5 flex items-center gap-1 ${scanDepth === 50 ? 'text-blue-500' : 'text-gray-400'}`}>
                      <Clock size={11} /> 15-30 Seconds
                    </span>
                  </button>
                </div>
              </div>

            </div>
          ) : (
            <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-2xl p-6 border border-blue-50 mb-12 text-left">
              <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Paste Any Review Text</label>
              <textarea className="w-full p-3 bg-gray-50 rounded-lg border border-gray-200 text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none h-32 resize-none mb-4" placeholder="Paste a review here..." onChange={(e) => setLiveText(e.target.value)}></textarea>
              <div className="flex justify-between items-center">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Star Rating</label>
                  <div className="flex gap-1 text-yellow-400 cursor-pointer">
                    {[1, 2, 3, 4, 5].map(star => <Star key={star} size={24} fill={star <= liveStars ? "currentColor" : "none"} onClick={() => setLiveStars(star)} />)}
                  </div>
                </div>
                <button onClick={handleLiveAudit} disabled={!liveText} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl shadow-md disabled:opacity-50 flex items-center gap-2">
                  <Zap size={18} /> Analyze
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans antialiased">
      <div className="max-w-[98%] xl:max-w-7xl mx-auto mb-8 flex justify-between items-center animate-fade-in">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => { setData(null); setLiveReport(null); }}>
          <ShieldCheck size={28} className="text-blue-600" />
          <h1 className="text-xl font-bold text-gray-900">TrustXplain Dashboard</h1>
        </div>
        <button onClick={() => { setData(null); setLiveReport(null); }} className="text-sm font-bold text-gray-500 hover:text-blue-600">Start New Search</button>
      </div>

      {loading && (
        <div className="text-center mt-32 animate-fade-in">
          <div className="inline-flex flex-col items-center gap-4 p-8 bg-white rounded-2xl shadow-sm border border-gray-100">
            <BrainCircuit className="animate-spin text-blue-600" size={48} />
            <span className="text-lg font-medium text-gray-600">Extracting data & analyzing authenticity...</span>
          </div>
        </div>
      )}

      {error && (
        <div className="max-w-xl mx-auto mt-8 text-center bg-red-50 p-6 rounded-xl border border-red-200 shadow-sm animate-fade-in">
          <AlertTriangle className="mx-auto text-red-500 mb-2" size={32} />
          <p className="text-red-700 font-medium">{error}</p>
        </div>
      )}

      {data && !loading && (
        <main className="max-w-[98%] xl:max-w-7xl mx-auto animate-fade-in w-full relative">
          <div className="mb-8">
            <h2 className="text-4xl font-black text-gray-900">{data.restaurant_name}</h2>
            <p className="text-gray-500 mt-2 font-medium flex items-center gap-2">
              <Sparkles size={16} className="text-blue-500" /> Summary.
            </p>
          </div>

          {/* SCORECARD GRID */}
          {data.scorecard && data.scorecard.length > 0 && (
            <div className="mb-10">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {data.scorecard.map((item, idx) => {
                  const numScore = item.score !== "N/A" ? parseFloat(item.score.split('/')[0]) : 0;
                  const pct = (numScore / 5) * 100;
                  const barColor = getScoreColor(numScore);
                  const isClickable = item.score !== "N/A";

                  return (
                    <div 
                      key={idx} 
                      onClick={() => isClickable && setSelectedCard(item)}
                      className={`bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between h-full transition-all duration-200 group
                        ${isClickable ? 'cursor-pointer hover:shadow-lg hover:border-blue-300 hover:-translate-y-1' : 'opacity-80'}`}
                    >
                      <div>
                        <div className="flex justify-between items-start mb-3">
                          <h4 className="font-extrabold text-gray-800 text-sm">{item.aspect}</h4>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${item.confidence === 'High' ? 'bg-blue-50 text-blue-600' :
                            item.confidence === 'Medium' ? 'bg-purple-50 text-purple-600' : 'bg-gray-100 text-gray-500'
                            }`}>
                            {item.confidence}
                          </span>
                        </div>

                        <div className="flex items-baseline gap-1 mb-2">
                          <span className="font-black text-2xl text-gray-900">{item.score !== "N/A" ? numScore.toFixed(1) : "-"}</span>
                          {item.score !== "N/A" && <span className="text-gray-400 text-sm font-bold">/5</span>}
                        </div>

                        {item.score !== "N/A" && (
                          <div className="w-full bg-gray-100 rounded-full h-1.5 mb-4">
                            <div className={`${barColor} h-1.5 rounded-full transition-all duration-1000 ease-out`} style={{ width: `${pct}%` }}></div>
                          </div>
                        )}
                      </div>

                      {/* Authentic Quote Box */}
                      <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 mt-2 flex flex-col grow">
                        <p className="text-sm text-gray-700 font-medium line-clamp-3 leading-snug italic flex-grow">
                          "{item.short_quote || item.evidence || "Analyzing data..."}"
                        </p>
                        
                        {/* Interactive Hint */}
                        {isClickable && (
                          <div className="flex items-center justify-end gap-1 mt-2 text-blue-500 font-bold text-[10px] uppercase tracking-wider opacity-60 group-hover:opacity-100 transition-opacity">
                            <ZoomIn size={12} /> View Details
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* MIDDLE SECTION: Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12 border-t border-b border-gray-200 py-8">
            <MetricCard label="Google Rating" value={`⭐ ${data.stats.google_rating}`} icon={<Star className="text-yellow-500" />} color="yellow" />

            <MetricCard
              label="Organic Sentiment"
              value={
                <div className="flex items-center justify-center gap-2">
                  <span className="text-green-600">{data.stats.genuine_positive} Pos</span>
                  <span className="text-gray-300 text-2xl font-light">|</span>
                  <span className="text-yellow-500">{data.